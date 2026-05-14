#!/usr/bin/env node
/**
 * Deploy Builder Agent — an AgentCore harness that creates other agents.
 *
 * Creates:
 *   1. Builder-tools Lambda (list_agents, list_gateway_tools, create_harness, etc.)
 *   2. Gateway targets for each tool on your IAM gateway
 *   3. Builder Agent harness with memory + gateway tools
 *
 * Prerequisites:
 *   - AWS credentials configured
 *   - An existing IAM-auth AgentCore gateway
 *   - An IAM execution role for harnesses (with Bedrock model access)
 *   - An existing AgentCore memory (or create one via console)
 *
 * Usage:
 *   node deploy/setup-builder-agent.mjs \
 *     --gateway-id <your-iam-gateway-id> \
 *     --harness-role-arn <arn:aws:iam::ACCOUNT:role/YourHarnessRole> \
 *     --memory-id <your-memory-id> \
 *     [--region us-east-1]
 */

import { readFileSync } from "fs";
import { execSync } from "child_process";
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
const MEMORY_ID = getArg("memory-id");

if (!GATEWAY_ID || !HARNESS_ROLE_ARN) {
  console.error(`
Usage:
  node deploy/setup-builder-agent.mjs \\
    --gateway-id <your-iam-gateway-id> \\
    --harness-role-arn <arn:aws:iam::ACCOUNT:role/YourHarnessRole> \\
    [--memory-id <memory-id>] \\
    [--region us-east-1]

Required:
  --gateway-id        IAM-auth AgentCore gateway ID
  --harness-role-arn  IAM role ARN for harness (needs Bedrock + AgentCore access)

Optional:
  --memory-id         AgentCore memory ID (for persistent context)
  --region            AWS region (default: us-east-1)
`);
  process.exit(1);
}

// --- Dynamic imports ---
const { IAMClient, GetRoleCommand, CreateRoleCommand, PutRolePolicyCommand } = await import("@aws-sdk/client-iam");
const { LambdaClient, CreateFunctionCommand, UpdateFunctionCodeCommand, GetFunctionCommand, AddPermissionCommand } = await import("@aws-sdk/client-lambda");
const { BedrockAgentCoreControlClient, CreateHarnessCommand, GetHarnessCommand, ListHarnessesCommand, CreateMemoryCommand } = await import("@aws-sdk/client-bedrock-agentcore-control");

const iam = new IAMClient({ region: REGION });
const lambda = new LambdaClient({ region: REGION });
const agentcore = new BedrockAgentCoreControlClient({ region: REGION });

const LAMBDA_NAME = "agentis-builder-tools";
const ROLE_NAME = "AgentisBuilderToolsRole";
const accountId = HARNESS_ROLE_ARN.split(":")[4];
const gatewayArn = `arn:aws:bedrock-agentcore:${REGION}:${accountId}:gateway/${GATEWAY_ID}`;

console.log("\n🏗️  Deploying Agentis Builder Agent");
console.log(`   Region: ${REGION}`);
console.log(`   Gateway: ${GATEWAY_ID}`);
console.log(`   Harness Role: ${HARNESS_ROLE_ARN}`);
console.log(`   Memory: ${MEMORY_ID || "(will create)"}\n`);

// ============================================================
// Step 1: IAM Role for Lambda
// ============================================================
console.log("1/4 Creating IAM role for builder-tools Lambda...");

const trustPolicy = JSON.stringify({
  Version: "2012-10-17",
  Statement: [{
    Effect: "Allow",
    Principal: { Service: "lambda.amazonaws.com" },
    Action: "sts:AssumeRole",
  }],
});

let lambdaRoleArn;
try {
  const existing = await iam.send(new GetRoleCommand({ RoleName: ROLE_NAME }));
  lambdaRoleArn = existing.Role.Arn;
  console.log(`   ✓ Role exists: ${lambdaRoleArn}`);
} catch {
  const role = await iam.send(new CreateRoleCommand({
    RoleName: ROLE_NAME,
    AssumeRolePolicyDocument: trustPolicy,
    Description: "Execution role for agentis-builder-tools Lambda",
  }));
  lambdaRoleArn = role.Role.Arn;

  await iam.send(new PutRolePolicyCommand({
    RoleName: ROLE_NAME,
    PolicyName: "BuilderToolsPolicy",
    PolicyDocument: JSON.stringify({
      Version: "2012-10-17",
      Statement: [
        {
          Effect: "Allow",
          Action: ["logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents"],
          Resource: "arn:aws:logs:*:*:*",
        },
        {
          Effect: "Allow",
          Action: [
            "bedrock-agentcore:ListHarnesses",
            "bedrock-agentcore:ListAgentRuntimes",
            "bedrock-agentcore:ListMemories",
            "bedrock-agentcore:ListGateways",
            "bedrock-agentcore:ListGatewayTargets",
            "bedrock-agentcore:GetHarness",
            "bedrock-agentcore:GetAgentRuntime",
            "bedrock-agentcore:CreateHarness",
          ],
          Resource: "*",
        },
      ],
    }),
  }));
  console.log(`   ✓ Created: ${lambdaRoleArn}`);
  console.log("   ⏳ Waiting for IAM propagation (10s)...");
  await sleep(10000);
}

// ============================================================
// Step 2: Deploy builder-tools Lambda
// ============================================================
console.log("2/4 Deploying builder-tools Lambda...");

const lambdaDir = join(__dirname, "..", "lambda", "builder-tools");

// Bundle with node_modules for SDK (Lambda doesn't include bedrock-agentcore-control by default)
// Use a lightweight inline package.json + install approach
const packageJson = JSON.stringify({
  name: "agentis-builder-tools",
  type: "module",
  dependencies: {
    "@aws-sdk/client-bedrock-agentcore-control": "*",
  },
});

execSync(`cd "${lambdaDir}" && echo '${packageJson}' > package.json && npm install --omit=dev --silent 2>/dev/null`, { stdio: "pipe" });
execSync(`cd "${lambdaDir}" && zip -rq function.zip index.mjs node_modules package.json`, { stdio: "pipe" });
const zipBuffer = readFileSync(join(lambdaDir, "function.zip"));

let lambdaArn;
try {
  await lambda.send(new GetFunctionCommand({ FunctionName: LAMBDA_NAME }));
  const updated = await lambda.send(new UpdateFunctionCodeCommand({
    FunctionName: LAMBDA_NAME,
    ZipFile: zipBuffer,
  }));
  lambdaArn = updated.FunctionArn;
  console.log(`   ✓ Updated existing Lambda: ${lambdaArn}`);
} catch {
  const created = await lambda.send(new CreateFunctionCommand({
    FunctionName: LAMBDA_NAME,
    Runtime: "nodejs20.x",
    Handler: "index.handler",
    Role: lambdaRoleArn,
    Code: { ZipFile: zipBuffer },
    Timeout: 30,
    MemorySize: 256,
    Environment: {
      Variables: {
        AWS_REGION_OVERRIDE: REGION,
        HARNESS_ROLE_ARN: HARNESS_ROLE_ARN,
      },
    },
    Description: "Management tools for the Agentis Builder Agent (list/create agents, tools, memories)",
  }));
  lambdaArn = created.FunctionArn;
  console.log(`   ✓ Created: ${lambdaArn}`);
}

// Add gateway invoke permission
try {
  await lambda.send(new AddPermissionCommand({
    FunctionName: LAMBDA_NAME,
    StatementId: "AllowAgentCoreGateway",
    Action: "lambda:InvokeFunction",
    Principal: "bedrock-agentcore.amazonaws.com",
    SourceArn: gatewayArn,
  }));
  console.log("   ✓ Gateway invoke permission added");
} catch (e) {
  if (e.name === "ResourceConflictException") {
    console.log("   ✓ Gateway invoke permission already exists");
  } else {
    console.warn(`   ⚠ Permission warning: ${e.message}`);
  }
}

// Clean up build artifacts
execSync(`cd "${lambdaDir}" && rm -rf node_modules package.json function.zip`, { stdio: "pipe" });

// ============================================================
// Step 3: Create gateway targets for each builder tool
// ============================================================
console.log("3/4 Creating gateway targets for builder tools...");
console.log(`   ℹ Create these gateway targets on gateway ${GATEWAY_ID}:`);
console.log(`   Each target uses Lambda ARN: ${lambdaArn}\n`);

const builderTools = [
  {
    name: "BuilderListAgents",
    toolName: "list_agents",
    description: "List all deployed AI agents (harnesses and runtimes) in this AWS account. Returns name, type, status, and ID for each agent.",
    inputSchema: {
      type: "object",
      properties: {
        _tool_name: { type: "string", const: "list_agents" },
      },
      required: ["_tool_name"],
    },
  },
  {
    name: "BuilderListTools",
    toolName: "list_gateway_tools",
    description: "List all available tools across all AgentCore gateways. Shows what tools can be attached to new agents.",
    inputSchema: {
      type: "object",
      properties: {
        _tool_name: { type: "string", const: "list_gateway_tools" },
      },
      required: ["_tool_name"],
    },
  },
  {
    name: "BuilderListMemories",
    toolName: "list_memories",
    description: "List all AgentCore memory resources available for attachment to agents.",
    inputSchema: {
      type: "object",
      properties: {
        _tool_name: { type: "string", const: "list_memories" },
      },
      required: ["_tool_name"],
    },
  },
  {
    name: "BuilderCreateAgent",
    toolName: "create_harness",
    description: "Deploy a new AI agent as an AgentCore harness. Requires name, system prompt, and optionally gateway/memory configuration.",
    inputSchema: {
      type: "object",
      properties: {
        _tool_name: { type: "string", const: "create_harness" },
        harness_name: { type: "string", description: "Agent name (snake_case, starts with letter, max 48 chars)" },
        system_prompt: { type: "string", description: "Full system prompt for the agent" },
        model_id: { type: "string", description: "Model ID (default: global.anthropic.claude-sonnet-4-5-20250929-v1:0)" },
        gateway_id: { type: "string", description: "Gateway ID to attach tools from" },
        memory_arn: { type: "string", description: "Memory ARN for persistent context" },
        execution_role_arn: { type: "string", description: "IAM role ARN for the harness" },
      },
      required: ["_tool_name", "harness_name", "system_prompt"],
    },
  },
  {
    name: "BuilderGetAgentDetail",
    toolName: "get_agent_detail",
    description: "Get full configuration details of a specific agent by its ID. Shows model, tools, memory, system prompt, and settings.",
    inputSchema: {
      type: "object",
      properties: {
        _tool_name: { type: "string", const: "get_agent_detail" },
        agent_id: { type: "string", description: "Harness or runtime agent ID" },
      },
      required: ["_tool_name", "agent_id"],
    },
  },
];

for (const tool of builderTools) {
  console.log(`   → ${tool.name} (${tool.toolName})`);
}

console.log(`\n   To create these targets, use the AgentCore MCP gateway_target_create tool`);
console.log(`   or run the targets setup interactively (see README).`);
console.log(`   Lambda ARN for all targets: ${lambdaArn}`);

// ============================================================
// Step 4: Create Builder Agent harness
// ============================================================
console.log("\n4/4 Creating Builder Agent harness...");

// Resolve memory ARN
let memoryArn = null;
if (MEMORY_ID) {
  memoryArn = `arn:aws:bedrock-agentcore:${REGION}:${accountId}:memory/${MEMORY_ID}`;
}

const BUILDER_SYSTEM_PROMPT = `You are the Agentis Builder Agent — an expert at creating and configuring AI agents on Amazon Bedrock AgentCore.

## Your Capabilities
You have tools to:
1. **list_agents** — See all deployed agents in this account (harnesses + runtimes)
2. **list_gateway_tools** — See all available tools across all gateways
3. **list_memories** — See all memory resources available
4. **create_harness** — Deploy a new agent with specified configuration
5. **get_agent_detail** — Inspect an existing agent's full config

## How to Build Agents
When a user asks you to create an agent:

1. **Understand the requirement** — What should the agent do? What tools does it need?
2. **Check existing agents** — Call list_agents to see if a similar agent already exists. If so, suggest modifying or reusing it.
3. **Check available tools** — Call list_gateway_tools to see what tools are available on gateways. Match tools to the agent's needs.
4. **Check memories** — Call list_memories if the agent needs persistent context.
5. **Design the configuration**:
   - Choose an appropriate model (default: Claude Sonnet for most tasks, Opus for complex reasoning)
   - Write a focused system prompt
   - Select the right gateway for tools
   - Optionally attach memory
6. **Create the agent** — Call create_harness with the complete configuration.
7. **Report back** — Share the agent ID and explain what was created.

## Agent Naming Convention
- Use snake_case: \`trust_safety_agent\`, \`backend_api_agent\`
- Must match: [a-zA-Z][a-zA-Z0-9_]{0,47}
- Be descriptive but concise

## Available Models
- \`global.anthropic.claude-sonnet-4-5-20250929-v1:0\` — Fast, great for most tasks (DEFAULT)
- \`global.anthropic.claude-opus-4-6-v1\` — Most capable, for complex reasoning
- \`global.anthropic.claude-haiku-4-5-20251001-v1:0\` — Fastest and cheapest

## System Prompt Best Practices
When writing system prompts for new agents:
- Start with a clear role and purpose
- List specific capabilities and constraints
- Include output format expectations
- If the agent has gateway tools, explain WHEN and HOW to use them
- Keep prompts focused — one agent, one job

## Memory Usage
When you have memory enabled:
- You remember all agents you've previously created
- If a user asks for something similar to a past creation, reference it
- Track what worked and what didn't
- Build on successful patterns

Be conversational, helpful, and proactive. If you see an opportunity to improve an agent design, suggest it. Always verify what tools and resources are available before making recommendations.`;

// Check if builder harness already exists
const list = await agentcore.send(new ListHarnessesCommand({}));
const existing = (list.harnesses || []).find(
  (h) => h.harnessName?.startsWith("agentis_builder") && h.status === "READY"
);

if (existing) {
  console.log(`   ✓ Already exists: ${existing.harnessId} (READY)`);
  printDone(existing.harnessId);
  process.exit(0);
}

// Build harness config
const harnessConfig = {
  harnessName: "agentis_builder",
  executionRoleArn: HARNESS_ROLE_ARN,
  model: { bedrockModelConfig: { modelId: "global.anthropic.claude-sonnet-4-5-20250929-v1:0" } },
  systemPrompt: [{ text: BUILDER_SYSTEM_PROMPT }],
  tools: [{
    type: "agentcore_gateway",
    name: "builder_tools",
    config: { agentCoreGateway: { gatewayArn } },
  }],
  allowedTools: ["*"],
  truncation: { strategy: "sliding_window", config: { slidingWindow: { messagesCount: 150 } } },
  maxIterations: 75,
  timeoutSeconds: 3600,
};

// Add memory if provided
if (memoryArn) {
  harnessConfig.memory = {
    agentCoreMemoryConfiguration: {
      arn: memoryArn,
      messagesCount: 20,
    },
  };
}

const res = await agentcore.send(new CreateHarnessCommand(harnessConfig));
const harnessId = res.harness?.harnessId;
console.log(`   ⏳ Creating agentis_builder (${harnessId})...`);

// Poll until ready
for (let i = 0; i < 30; i++) {
  await sleep(5000);
  const status = await agentcore.send(new GetHarnessCommand({ harnessId }));
  const s = status.harness?.status;
  if (s === "READY") {
    console.log(`   ✓ agentis_builder → READY`);
    printDone(harnessId);
    process.exit(0);
  }
  if (s === "CREATE_FAILED") {
    const reason = status.harness?.failureReason || "unknown";
    console.error(`   ✗ Create failed: ${reason}`);
    process.exit(1);
  }
}
console.error("   ✗ Timed out waiting for READY");
process.exit(1);

// ============================================================
// Helpers
// ============================================================

function printDone(id) {
  console.log("\n" + "═".repeat(60));
  console.log("✅ Builder Agent deployed!\n");
  console.log(`  BUILDER_AGENT_ID=${id}`);
  console.log(`\nAdd to .env.local:`);
  console.log(`  BUILDER_AGENT_ID=${id}`);
  console.log("\nThe Builder page will now use this harness agent instead of raw Converse.");
  console.log("═".repeat(60) + "\n");
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
