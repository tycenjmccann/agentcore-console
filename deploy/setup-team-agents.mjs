#!/usr/bin/env node
/**
 * setup-team-agents.mjs
 *
 * Deploys all 13 pipeline agents defined in src/config/agents.json
 * as AgentCore harness agents.
 *
 * Usage:
 *   node deploy/setup-team-agents.mjs \
 *     --gateway-id <your-gateway-id> \
 *     --harness-role-arn arn:aws:iam::ACCOUNT:role/YourHarnessRole \
 *     --s3-bucket <artifact-bucket-name> \
 *     [--region us-east-1] \
 *     [--model global.anthropic.claude-sonnet-4-5-20250929-v1:0]
 *
 * Prerequisites:
 *   - AWS credentials configured (profile or env vars)
 *   - An existing AgentCore gateway (created via console or CLI)
 *   - An IAM execution role for harnesses (with Bedrock model access)
 *   - Node.js 18+ with @aws-sdk/client-bedrock-agentcore-control installed
 *
 * Per-phase model overrides:
 *   --model-requirements  Model for requirements phase agents (default: opus)
 *   --model-design        Model for design phase agents (default: --model value)
 *   --model-development   Model for development phase agents (default: --model value)
 *   --model-verification  Model for verification phase agents (default: --model value)
 *   --model-review        Model for review phase agents (default: --model value)
 */

import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

// --- Parse CLI args ---
const args = process.argv.slice(2);
function getArg(name) {
  const idx = args.indexOf(`--${name}`);
  return idx >= 0 ? args[idx + 1] : null;
}

const REGION = getArg("region") || process.env.AWS_REGION || "us-east-1";
const GATEWAY_ID = getArg("gateway-id");
const HARNESS_ROLE_ARN = getArg("harness-role-arn");
const S3_BUCKET = getArg("s3-bucket");
const DEFAULT_MODEL = getArg("model") || "global.anthropic.claude-sonnet-4-5-20250929-v1:0";

// Per-phase model overrides
const MODEL_OVERRIDES = {
  requirements: getArg("model-requirements") || "global.anthropic.claude-opus-4-20250514-v1:0",
  design: getArg("model-design") || DEFAULT_MODEL,
  development: getArg("model-development") || DEFAULT_MODEL,
  verification: getArg("model-verification") || DEFAULT_MODEL,
  review: getArg("model-review") || DEFAULT_MODEL,
};

if (!GATEWAY_ID || !HARNESS_ROLE_ARN || !S3_BUCKET) {
  console.error(`
Usage:
  node deploy/setup-team-agents.mjs \\
    --gateway-id <your-gateway-id> \\
    --harness-role-arn <arn:aws:iam::ACCOUNT:role/YourHarnessRole> \\
    --s3-bucket <artifact-bucket-name> \\
    [--region us-east-1] \\
    [--model global.anthropic.claude-sonnet-4-5-20250929-v1:0] \\
    [--model-requirements <model-id>] \\
    [--model-design <model-id>] \\
    [--model-development <model-id>] \\
    [--model-verification <model-id>] \\
    [--model-review <model-id>]

Required:
  --gateway-id        Your AgentCore gateway ID (e.g. "mygw-abc123")
  --harness-role-arn  IAM role ARN for harness agents (needs Bedrock model access)
  --s3-bucket         S3 bucket for artifact storage between agents

Optional:
  --region            AWS region (default: us-east-1 or AWS_REGION env var)
  --model             Default model for all agents (default: claude-sonnet-4.5)
  --model-requirements  Model for requirements agents (default: claude-opus-4)
  --model-design        Model for design agents (default: --model value)
  --model-development   Model for dev agents (default: --model value)
  --model-verification  Model for verification agents (default: --model value)
  --model-review        Model for review agents (default: --model value)
`);
  process.exit(1);
}

// --- Load agent definitions ---
const agentsJsonPath = join(__dirname, "..", "src", "config", "agents.json");
const agentsConfig = JSON.parse(readFileSync(agentsJsonPath, "utf-8"));
const agents = agentsConfig.agents;

// --- Load agent prompts from .ts file ---
// We parse the TypeScript file to extract prompts without needing tsx/ts-node.
const promptsPath = join(__dirname, "..", "src", "config", "agent-prompts.ts");
const promptsSource = readFileSync(promptsPath, "utf-8");

function extractPrompts(source) {
  const prompts = {};
  // Match each key-value pair in the AGENT_PROMPTS record
  // Pattern: "agent-id": `prompt content`
  const regex = /"([^"]+)":\s*`([\s\S]*?)`(?:,|\s*\})/g;
  let match;
  while ((match = regex.exec(source)) !== null) {
    const [, id, prompt] = match;
    // Unescape template literal escapes
    prompts[id] = prompt.replace(/\\`/g, "`").replace(/\\\$/g, "$");
  }
  return prompts;
}

const AGENT_PROMPTS = extractPrompts(promptsSource);

// Validate we got prompts for all agents
const missingPrompts = agents.filter((a) => !AGENT_PROMPTS[a.id]);
if (missingPrompts.length > 0) {
  console.warn(`\n⚠ Missing prompts for agents: ${missingPrompts.map((a) => a.id).join(", ")}`);
  console.warn("  These agents will use a generic prompt based on their role definition.\n");
}

// --- Dynamic imports (AWS SDK) ---
const { BedrockAgentCoreControlClient, CreateHarnessCommand, GetHarnessCommand, ListHarnessesCommand } = await import(
  "@aws-sdk/client-bedrock-agentcore-control"
);

const agentcore = new BedrockAgentCoreControlClient({ region: REGION });

const accountId = HARNESS_ROLE_ARN.split(":")[4];
const gatewayArn = `arn:aws:bedrock-agentcore:${REGION}:${accountId}:gateway/${GATEWAY_ID}`;

// --- Deploy ---
console.log("\n" + "═".repeat(60));
console.log("🚀 Deploying Agentis Team Agents (13 pipeline agents)");
console.log("═".repeat(60));
console.log(`   Region:       ${REGION}`);
console.log(`   Gateway:      ${GATEWAY_ID}`);
console.log(`   Harness Role: ${HARNESS_ROLE_ARN}`);
console.log(`   S3 Bucket:    ${S3_BUCKET}`);
console.log(`   Default Model: ${DEFAULT_MODEL}`);
console.log(`   Models by phase:`);
for (const [phase, model] of Object.entries(MODEL_OVERRIDES)) {
  console.log(`     ${phase}: ${model}`);
}
console.log("");

// Pre-fetch existing harnesses to avoid repeated list calls
const existingList = await agentcore.send(new ListHarnessesCommand({}));
const existingHarnesses = existingList.harnesses || [];

const results = [];
let successCount = 0;
let skipCount = 0;
let failCount = 0;

for (let i = 0; i < agents.length; i++) {
  const agent = agents[i];
  const stepNum = `[${i + 1}/${agents.length}]`;
  console.log(`${stepNum} ${agent.name} (${agent.harnessName})...`);

  try {
    const harnessId = await createHarness(agent);
    results.push({ agent, harnessId, status: "success" });
    successCount++;
  } catch (err) {
    console.error(`   ✗ Failed: ${err.message}`);
    results.push({ agent, harnessId: null, status: "failed", error: err.message });
    failCount++;
  }
}

// --- Summary ---
console.log("\n" + "═".repeat(60));
console.log("📋 Deployment Summary");
console.log("═".repeat(60));
console.log(`   ✓ Success: ${successCount}   ⏭ Skipped (existing): ${skipCount}   ✗ Failed: ${failCount}\n`);

console.log("Agent ARNs / IDs:");
console.log("-".repeat(60));
for (const r of results) {
  const icon = r.status === "success" ? "✓" : r.status === "skipped" ? "⏭" : "✗";
  const id = r.harnessId || "N/A";
  console.log(`  ${icon} ${r.agent.id.padEnd(28)} → ${id}`);
}

// Output environment variable format for easy copy-paste
console.log("\n\nEnvironment variables (add to .env.local):");
console.log("-".repeat(60));
for (const r of results) {
  if (r.harnessId) {
    const envKey = r.agent.id.replace(/-/g, "_").toUpperCase() + "_HARNESS_ID";
    console.log(`${envKey}=${r.harnessId}`);
  }
}

// Output JSON mapping for programmatic use
const mapping = {};
for (const r of results) {
  if (r.harnessId) {
    mapping[r.agent.id] = r.harnessId;
  }
}
const mappingPath = join(__dirname, "..", "src", "config", "harness-ids.json");
const { writeFileSync } = await import("fs");
writeFileSync(mappingPath, JSON.stringify(mapping, null, 2) + "\n");
console.log(`\n✓ Harness ID mapping written to: src/config/harness-ids.json`);
console.log("═".repeat(60) + "\n");

if (failCount > 0) {
  process.exit(1);
}

// ============================================================
// Helpers
// ============================================================

async function createHarness(agent) {
  // Check if already exists with READY status
  const existing = existingHarnesses.find(
    (h) => h.harnessName === agent.harnessName && h.status === "READY"
  );
  if (existing) {
    console.log(`   ✓ Already exists: ${existing.harnessId} (READY)`);
    skipCount++;
    return existing.harnessId;
  }

  // Check for non-READY versions (in-progress or failed)
  const conflicts = existingHarnesses.filter((h) => h.harnessName?.startsWith(agent.harnessName));
  let name = agent.harnessName;
  if (conflicts.length > 0 && !existing) {
    name = `${agent.harnessName}_v${conflicts.length + 1}`;
    console.log(`   ℹ Conflict detected, using name: ${name}`);
  }

  // Determine model for this agent's phase
  const model = MODEL_OVERRIDES[agent.phase] || DEFAULT_MODEL;

  // Build system prompt
  const systemPrompt = AGENT_PROMPTS[agent.id] || buildFallbackPrompt(agent);

  // Build the harness configuration
  const res = await agentcore.send(
    new CreateHarnessCommand({
      harnessName: name,
      executionRoleArn: HARNESS_ROLE_ARN,
      model: { bedrockModelConfig: { modelId: model } },
      systemPrompt: [{ text: systemPrompt }],
      tools: [
        {
          type: "agentcore_gateway",
          name: "pipeline_gateway",
          config: { agentCoreGateway: { gatewayArn } },
        },
      ],
      allowedTools: ["*"],
      truncation: { strategy: "sliding_window", config: { slidingWindow: { messagesCount: 150 } } },
      maxIterations: 75,
      timeoutSeconds: 3600,
    })
  );

  const harnessId = res.harness?.harnessId;
  console.log(`   ⏳ Creating ${name} (${harnessId}) with model ${model}...`);

  // Poll until READY
  for (let i = 0; i < 30; i++) {
    await sleep(5000);
    const status = await agentcore.send(new GetHarnessCommand({ harnessId }));
    const s = status.harness?.status;
    if (s === "READY") {
      console.log(`   ✓ ${name} → READY`);
      return harnessId;
    }
    if (s === "CREATE_FAILED") {
      const reason = status.harness?.failureReason || "unknown";
      throw new Error(`${name} creation failed: ${reason}`);
    }
  }
  throw new Error(`${name} timed out waiting for READY status (150s)`);
}

function buildFallbackPrompt(agent) {
  return `You are ${agent.name} on an agentic development team.

Role: ${agent.role}
Phase: ${agent.phase}

## Instructions
1. Call load_skill to get your detailed instructions for this task
2. Read any relevant context from S3 (requirements, design docs, etc.)
3. Execute your role's responsibilities thoroughly
4. Write your output artifacts to S3
5. Report completion when done

## Available Tools
Your tools are provided via the gateway. Use them as needed to fulfill your role.`;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
