#!/usr/bin/env node
/**
 * Deploy Routing Agents — one-command setup for the Agentis Hub routing demo.
 *
 * Creates:
 *   1. IAM role for the skill-loader Lambda
 *   2. Skill-loader Lambda function (serves skill instructions to agents)
 *   3. Gateway target on your AgentCore gateway (exposes load_skill tool)
 *   4. Design Agent harness (calls load_skill → produces architecture docs)
 *   5. Dev Agent harness (calls load_skill → produces implementation)
 *
 * Prerequisites:
 *   - AWS credentials configured (profile or env vars)
 *   - An existing AgentCore gateway (created via console or CLI)
 *   - An IAM execution role for harnesses (with Bedrock model access)
 *
 * Usage:
 *   node deploy/setup-routing-agents.mjs \
 *     --gateway-id <your-gateway-id> \
 *     --harness-role-arn <arn:aws:iam::ACCOUNT:role/YourHarnessRole> \
 *     [--region us-east-1]
 *
 * The script outputs the agent IDs to paste into your .env.local or routing page.
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

if (!GATEWAY_ID || !HARNESS_ROLE_ARN) {
  console.error(`
Usage:
  node deploy/setup-routing-agents.mjs \\
    --gateway-id <your-gateway-id> \\
    --harness-role-arn <arn:aws:iam::ACCOUNT:role/YourHarnessRole> \\
    [--region us-east-1]

Required:
  --gateway-id        Your AgentCore gateway ID (e.g. "mygw-abc123")
  --harness-role-arn  IAM role ARN for harness agents (needs Bedrock model access)

Optional:
  --region            AWS region (default: us-east-1 or AWS_REGION env var)
`);
  process.exit(1);
}

// --- Dynamic imports (AWS SDK) ---
const { IAMClient, CreateRoleCommand, PutRolePolicyCommand, GetRoleCommand } = await import("@aws-sdk/client-iam");
const { LambdaClient, CreateFunctionCommand, UpdateFunctionCodeCommand, GetFunctionCommand, AddPermissionCommand } = await import("@aws-sdk/client-lambda");
const { BedrockAgentCoreControlClient, CreateHarnessCommand, GetHarnessCommand, DeleteHarnessCommand, ListHarnessesCommand } = await import("@aws-sdk/client-bedrock-agentcore-control");

const iam = new IAMClient({ region: REGION });
const lambda = new LambdaClient({ region: REGION });
const agentcore = new BedrockAgentCoreControlClient({ region: REGION });

const LAMBDA_NAME = "agentis-skill-loader";
const ROLE_NAME = "AgentisSkillLoaderRole";
const GATEWAY_ARN_PREFIX = `arn:aws:bedrock-agentcore:${REGION}`;

console.log("\n🚀 Deploying Agentis Routing Agents");
console.log(`   Region: ${REGION}`);
console.log(`   Gateway: ${GATEWAY_ID}`);
console.log(`   Harness Role: ${HARNESS_ROLE_ARN}\n`);

// ============================================================
// Step 1: IAM Role for Lambda
// ============================================================
console.log("1/5 Creating IAM role for skill-loader Lambda...");

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
    Description: "Execution role for agentis-skill-loader Lambda",
  }));
  lambdaRoleArn = role.Role.Arn;

  // Attach basic Lambda execution policy
  await iam.send(new PutRolePolicyCommand({
    RoleName: ROLE_NAME,
    PolicyName: "BasicExecution",
    PolicyDocument: JSON.stringify({
      Version: "2012-10-17",
      Statement: [{
        Effect: "Allow",
        Action: ["logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents"],
        Resource: "arn:aws:logs:*:*:*",
      }],
    }),
  }));
  console.log(`   ✓ Created: ${lambdaRoleArn}`);
  // Wait for role propagation
  console.log("   ⏳ Waiting for IAM propagation (10s)...");
  await sleep(10000);
}

// ============================================================
// Step 2: Deploy skill-loader Lambda
// ============================================================
console.log("2/5 Deploying skill-loader Lambda...");

// Build zip from the lambda source
const lambdaDir = join(__dirname, "..", "lambda", "skill-loader");
execSync(`cd "${lambdaDir}" && zip -j function.zip index.mjs`, { stdio: "pipe" });
const zipBuffer = readFileSync(join(lambdaDir, "function.zip"));

let lambdaArn;
try {
  await lambda.send(new GetFunctionCommand({ FunctionName: LAMBDA_NAME }));
  // Update existing
  const updated = await lambda.send(new UpdateFunctionCodeCommand({
    FunctionName: LAMBDA_NAME,
    ZipFile: zipBuffer,
  }));
  lambdaArn = updated.FunctionArn;
  console.log(`   ✓ Updated existing Lambda: ${lambdaArn}`);
} catch {
  // Create new
  const created = await lambda.send(new CreateFunctionCommand({
    FunctionName: LAMBDA_NAME,
    Runtime: "nodejs20.x",
    Handler: "index.handler",
    Role: lambdaRoleArn,
    Code: { ZipFile: zipBuffer },
    Timeout: 10,
    Description: "Serves skill instructions to AgentCore routing agents",
  }));
  lambdaArn = created.FunctionArn;
  console.log(`   ✓ Created: ${lambdaArn}`);
}

// Add invoke permission for the gateway
try {
  const accountId = HARNESS_ROLE_ARN.split(":")[4];
  const gatewayArn = `${GATEWAY_ARN_PREFIX}:${accountId}:gateway/${GATEWAY_ID}`;
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

// ============================================================
// Step 3: Create gateway target (SkillLoader)
// ============================================================
console.log("3/5 Creating gateway target (SkillLoader)...");

// Use the MCP gateway target create via SDK (http call)
// Since there's no SDK for gateway targets, we'll use the existing one via CLI
const accountId = HARNESS_ROLE_ARN.split(":")[4];
const gatewayArn = `${GATEWAY_ARN_PREFIX}:${accountId}:gateway/${GATEWAY_ID}`;

try {
  // Use AWS CLI for gateway target creation (SDK doesn't expose this directly)
  const targetConfig = JSON.stringify({
    mcp: {
      lambda: {
        lambdaArn,
        toolSchema: {
          inlinePayload: [{
            name: "load_skill",
            description: "Load detailed instructions for a named skill. ALWAYS call this first. Design skills: ios-architecture, backend-systems, privacy-compliance, localization, general-design. Dev skills: swift-development, node-typescript, data-services, i18n-tooling, full-stack.",
            inputSchema: {
              type: "object",
              properties: {
                skill_name: {
                  type: "string",
                  description: "Name of the skill to load",
                },
              },
              required: ["skill_name"],
            },
          }],
        },
      },
    },
  });

  const credConfig = JSON.stringify([{ credentialProviderType: "GATEWAY_IAM_ROLE" }]);

  // Try via SDK's generic HTTP — fall back to noting manual step
  console.log(`   ℹ Gateway target must be created via AgentCore API or MCP tools.`);
  console.log(`   Run this in Claude Code or use the AgentCore MCP tool:`);
  console.log(`   gateway_target_create(`);
  console.log(`     gateway_identifier: "${GATEWAY_ID}",`);
  console.log(`     name: "SkillLoader",`);
  console.log(`     target_configuration: ${targetConfig}`);
  console.log(`   )`);
  console.log(`   ✓ If already created, skip this step.`);
} catch (e) {
  console.log(`   ⚠ ${e.message}`);
}

// ============================================================
// Step 4: Create Design Agent harness
// ============================================================
console.log("4/5 Creating Design Agent harness...");

const designPrompt = `You are the Design Agent — an expert software architect and UX designer.

## CRITICAL: Skill Loading
Before producing ANY design work, you MUST call the load_skill tool to get detailed instructions.
Choose the most appropriate skill based on the task:
- ios-architecture: iOS/mobile features, notifications, native capabilities
- backend-systems: APIs, services, infrastructure, rate limiting
- privacy-compliance: GDPR, data export, deletion, consent
- localization: i18n, multi-language, translations
- general-design: anything else

After loading the skill, follow its instructions precisely to produce your design document.

## Behavior
1. Analyze the incoming task/ticket
2. Select and load the appropriate skill via load_skill tool
3. Follow the loaded skill's instructions to produce a comprehensive design document
4. Format output as structured markdown`;

const designId = await createHarness("routing_designer", designPrompt);

// ============================================================
// Step 5: Create Dev Agent harness
// ============================================================
console.log("5/5 Creating Dev Agent harness...");

const devPrompt = `You are the Dev Agent — an expert full-stack software engineer.

## CRITICAL: Skill Loading
Before writing ANY code, you MUST call the load_skill tool to get detailed implementation instructions.
Choose the most appropriate skill based on the task:
- swift-development: iOS/Swift/SwiftUI implementation
- node-typescript: Backend Node.js/TypeScript/Lambda
- data-services: Data processing, export, compliance features
- i18n-tooling: Localization infrastructure
- full-stack: Features spanning frontend and backend

After loading the skill, follow its instructions precisely to produce your implementation.

## Behavior
1. Analyze the design document provided
2. Select and load the appropriate skill via load_skill tool
3. Follow the loaded skill's instructions to implement the solution
4. Produce code, tests, and deployment notes`;

const devId = await createHarness("routing_developer", devPrompt);

// ============================================================
// Done!
// ============================================================
console.log("\n" + "═".repeat(60));
console.log("✅ Deployment complete!\n");
console.log("Agent IDs (add to .env.local or routing page):");
console.log(`  DESIGN_AGENT_ID=${designId}`);
console.log(`  DEV_AGENT_ID=${devId}`);
console.log("\nUpdate src/app/routing/page.tsx:");
console.log(`  const DESIGN_AGENT_ID = "${designId}";`);
console.log(`  const DEV_AGENT_ID = "${devId}";`);
console.log("═".repeat(60) + "\n");

// ============================================================
// Helpers
// ============================================================

async function createHarness(baseName, systemPrompt) {
  // Check if already exists with a working version
  const list = await agentcore.send(new ListHarnessesCommand({}));
  const existing = (list.harnesses || []).find(
    (h) => h.harnessName?.startsWith(baseName) && h.status === "READY"
  );
  if (existing) {
    console.log(`   ✓ Already exists: ${existing.harnessId} (READY)`);
    return existing.harnessId;
  }

  // Find a unique name (append _v suffix if needed)
  let name = baseName;
  const conflicts = (list.harnesses || []).filter((h) => h.harnessName?.startsWith(baseName));
  if (conflicts.length > 0) {
    name = `${baseName}_v${conflicts.length + 1}`;
  }

  const res = await agentcore.send(new CreateHarnessCommand({
    harnessName: name,
    executionRoleArn: HARNESS_ROLE_ARN,
    model: { bedrockModelConfig: { modelId: "global.anthropic.claude-sonnet-4-5-20250929-v1:0" } },
    systemPrompt: [{ text: systemPrompt }],
    tools: [{
      type: "agentcore_gateway",
      name: "skills_gateway",
      config: { agentCoreGateway: { gatewayArn: gatewayArn } },
    }],
    allowedTools: ["*"],
    truncation: { strategy: "sliding_window", config: { slidingWindow: { messagesCount: 150 } } },
    maxIterations: 75,
    timeoutSeconds: 3600,
  }));

  const harnessId = res.harness?.harnessId;
  console.log(`   ⏳ Creating ${name} (${harnessId})...`);

  // Poll until ready
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
      console.error(`   ✗ ${name} failed: ${reason}`);
      process.exit(1);
    }
  }
  console.error(`   ✗ ${name} timed out waiting for READY`);
  process.exit(1);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
