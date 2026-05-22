#!/usr/bin/env node
/**
 * Deploy Builder Agent — an AgentCore harness that creates other agents.
 *
 * The builder uses:
 *   - code_interpreter: to call boto3 CreateHarness/CreateAgentRuntime APIs
 *   - remote_mcp (optional): connects to customer's MCP servers for tool discovery
 *   - memory (optional): remembers past agent builds
 *
 * The builder sees all tools available via MCP, then creates child agents wired
 * to the appropriate subset. Works with any infrastructure (AWS, GCP, on-prem)
 * as long as it's exposed via MCP.
 *
 * Usage:
 *   # Minimal — builder with code_interpreter only
 *   node deploy/setup-builder-agent.mjs \
 *     --harness-role-arn arn:aws:iam::ACCOUNT:role/YourRole
 *
 *   # With MCP servers for tool discovery
 *   node deploy/setup-builder-agent.mjs \
 *     --harness-role-arn arn:aws:iam::ACCOUNT:role/YourRole \
 *     --mcp-url https://api.githubcopilot.com/mcp/ \
 *     --mcp-url https://my-tools.example.com/mcp
 *
 *   # With memory for persistent context
 *   node deploy/setup-builder-agent.mjs \
 *     --harness-role-arn arn:aws:iam::ACCOUNT:role/YourRole \
 *     --mcp-url https://my-tools.example.com/mcp \
 *     --memory-id my-builder-memory
 *
 * Prerequisites:
 *   - AWS credentials configured
 *   - IAM execution role with: Bedrock model access + AgentCore permissions
 *     (CreateHarness, ListHarnesses, ListAgentRuntimes, CreateAgentRuntime, etc.)
 */

const args = process.argv.slice(2);
function getArg(name) {
  const idx = args.indexOf(`--${name}`);
  return idx >= 0 ? args[idx + 1] : null;
}
function getAllArgs(name) {
  const results = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === `--${name}` && i + 1 < args.length) {
      results.push(args[i + 1]);
    }
  }
  return results;
}

const REGION = getArg("region") || process.env.AWS_REGION || "us-east-1";
const HARNESS_ROLE_ARN = getArg("harness-role-arn");
const MEMORY_ID = getArg("memory-id");
const MCP_URLS = getAllArgs("mcp-url");
const MODEL_ID = getArg("model-id") || "global.anthropic.claude-sonnet-4-5-20250929-v1:0";

if (!HARNESS_ROLE_ARN) {
  console.error(`
Usage:
  node deploy/setup-builder-agent.mjs \\
    --harness-role-arn <arn:aws:iam::ACCOUNT:role/YourRole> \\
    [--mcp-url <url>] \\
    [--memory-id <memory-id>] \\
    [--model-id <bedrock-model-id>] \\
    [--region us-east-1]

Required:
  --harness-role-arn  IAM role for the harness (needs Bedrock + AgentCore permissions)

Optional:
  --mcp-url           Remote MCP server URL (repeatable — for tool discovery)
  --memory-id         AgentCore memory ID (for persistent context across sessions)
  --model-id          Bedrock model ID (default: Claude Sonnet 4.5)
  --region            AWS region (default: us-east-1)

Examples:
  # Minimal
  node deploy/setup-builder-agent.mjs \\
    --harness-role-arn arn:aws:iam::123456789012:role/AgentCoreRole

  # With GitHub + custom MCP
  node deploy/setup-builder-agent.mjs \\
    --harness-role-arn arn:aws:iam::123456789012:role/AgentCoreRole \\
    --mcp-url https://api.githubcopilot.com/mcp/ \\
    --mcp-url https://my-internal-tools.company.com/mcp

  # Full setup with memory
  node deploy/setup-builder-agent.mjs \\
    --harness-role-arn arn:aws:iam::123456789012:role/AgentCoreRole \\
    --mcp-url https://api.githubcopilot.com/mcp/ \\
    --memory-id builder-memory-abc123
`);
  process.exit(1);
}

// --- Dynamic imports ---
const {
  BedrockAgentCoreControlClient,
  CreateHarnessCommand,
  GetHarnessCommand,
  ListHarnessesCommand,
} = await import("@aws-sdk/client-bedrock-agentcore-control");

const agentcore = new BedrockAgentCoreControlClient({ region: REGION });
const accountId = HARNESS_ROLE_ARN.split(":")[4];

console.log("\n  Deploying Builder Agent");
console.log("  " + "=".repeat(50));
console.log(`  Region:       ${REGION}`);
console.log(`  Model:        ${MODEL_ID}`);
console.log(`  Role:         ${HARNESS_ROLE_ARN}`);
console.log(`  MCP Servers:  ${MCP_URLS.length > 0 ? MCP_URLS.join("\n                ") : "(none — builder can still create agents via code_interpreter)"}`);
console.log(`  Memory:       ${MEMORY_ID || "(none)"}`);
console.log("  " + "=".repeat(50) + "\n");

// --- Check if already exists ---
const list = await agentcore.send(new ListHarnessesCommand({}));
const existing = (list.harnesses || []).find(
  (h) => h.harnessName === "agentis_builder" && h.status === "READY"
);

if (existing) {
  console.log(`  Already exists: ${existing.harnessId} (READY)`);
  printDone(existing.harnessId);
  process.exit(0);
}

// --- Build tools array ---
const tools = [
  // code_interpreter lets the builder use boto3 to call CreateHarness, ListAgentRuntimes, etc.
  { type: "code_interpreter", name: "code_interpreter" },
];

// Add customer's MCP servers for tool discovery
for (let i = 0; i < MCP_URLS.length; i++) {
  const url = MCP_URLS[i];
  // Derive a name from the URL hostname
  const hostname = new URL(url).hostname.replace(/\./g, "_").slice(0, 30);
  tools.push({
    type: "remote_mcp",
    name: `mcp_${hostname}`,
    config: { remoteMcp: { url } },
  });
}

// --- System prompt ---
const SYSTEM_PROMPT = `You are the Builder Agent — you create and configure AI agents on Amazon Bedrock AgentCore.

## Your Tools

1. **code_interpreter** — Run Python/boto3 to call AgentCore APIs:
   - \`CreateHarness\` / \`CreateAgentRuntime\` — deploy new agents
   - \`ListHarnesses\` / \`ListAgentRuntimes\` — see existing agents
   - \`GetHarness\` / \`GetAgentRuntime\` — inspect agent configs
   - \`ListGateways\` / \`ListGatewayTargets\` — see available gateway tools
   - \`ListMemories\` — see available memory resources
${MCP_URLS.length > 0 ? `
2. **MCP Tools** — You're connected to ${MCP_URLS.length} MCP server(s) for tool discovery.
   Call \`list_tools\` on each to see what's available, then wire the appropriate
   \`remote_mcp\` entries into agents you create.
   Connected servers: ${MCP_URLS.join(", ")}
` : ""}
## How to Build an Agent

1. **Understand the request** — What should the agent do? What tools does it need?
2. **Discover available tools** — ${MCP_URLS.length > 0 ? "Use your MCP connections to list available tools. Also" : "Use"} code_interpreter with boto3 to call ListGateways/ListGatewayTargets.
3. **Design the agent** — Choose model, write system prompt, select tools.
4. **Create it** — Use code_interpreter to call CreateHarness:

\`\`\`python
import boto3
client = boto3.client("bedrock-agentcore-control", region_name="${REGION}")

response = client.create_harness(
    harnessName="my_new_agent",
    executionRoleArn="${HARNESS_ROLE_ARN}",
    model={"bedrockModelConfig": {"modelId": "global.anthropic.claude-sonnet-4-5-20250929-v1:0"}},
    systemPrompt=[{"text": "Your system prompt here..."}],
    tools=[
        # Add remote_mcp for each MCP server the agent needs:
        {"type": "remote_mcp", "name": "tools", "config": {"remoteMcp": {"url": "https://..."}}},
        # Or code_interpreter if it needs to run code:
        {"type": "code_interpreter", "name": "code_interpreter"},
    ],
    allowedTools=["*"],
    maxIterations=50,
    timeoutSeconds=3600,
)
print(f"Created: {response['harness']['harnessId']}")
\`\`\`

## Agent Design Guidelines

- **Naming**: snake_case, descriptive: \`customer_support_agent\`, \`code_review_agent\`
- **Models**:
  - \`global.anthropic.claude-sonnet-4-5-20250929-v1:0\` — Fast, good for most tasks (default)
  - \`global.anthropic.claude-opus-4-6-v1\` — Most capable, complex reasoning
  - \`global.anthropic.claude-haiku-4-5-20251001-v1:0\` — Fastest, cheapest
- **System Prompts**: Clear role, specific capabilities, when/how to use tools
- **Tool Wiring**: Use \`remote_mcp\` to connect agents to MCP servers. The URL is all that's needed — the agent discovers available tools at runtime.

## Important

- The execution role \`${HARNESS_ROLE_ARN}\` is shared across agents you create.
- When creating agents, use this same role ARN for \`executionRoleArn\`.
- MCP servers are the universal adapter — any tool (AWS, GCP, on-prem, SaaS) can be exposed via MCP.
- Always verify an agent was created successfully (status=READY) before reporting back.`;

// --- Create harness ---
console.log("  Creating builder agent harness...");

const harnessConfig = {
  harnessName: "agentis_builder",
  executionRoleArn: HARNESS_ROLE_ARN,
  model: { bedrockModelConfig: { modelId: MODEL_ID } },
  systemPrompt: [{ text: SYSTEM_PROMPT }],
  tools,
  allowedTools: ["*"],
  truncation: { strategy: "sliding_window", config: { slidingWindow: { messagesCount: 150 } } },
  maxIterations: 75,
  timeoutSeconds: 3600,
};

// Add memory if provided
if (MEMORY_ID) {
  const memoryArn = `arn:aws:bedrock-agentcore:${REGION}:${accountId}:memory/${MEMORY_ID}`;
  harnessConfig.memory = {
    agentCoreMemoryConfiguration: {
      arn: memoryArn,
      messagesCount: 20,
    },
  };
}

console.log(`  Tools: ${tools.map(t => t.name).join(", ")}`);

const res = await agentcore.send(new CreateHarnessCommand(harnessConfig));
const harnessId = res.harness?.harnessId;
console.log(`  Creating agentis_builder (${harnessId})...`);

// Poll until ready
for (let i = 0; i < 30; i++) {
  await new Promise((r) => setTimeout(r, 5000));
  const status = await agentcore.send(new GetHarnessCommand({ harnessId }));
  const s = status.harness?.status;
  if (s === "READY") {
    console.log(`  agentis_builder is READY`);
    printDone(harnessId);
    process.exit(0);
  }
  if (s === "CREATE_FAILED") {
    const reason = status.harness?.failureReason || "unknown";
    console.error(`  Create failed: ${reason}`);
    process.exit(1);
  }
}
console.error("  Timed out waiting for READY");
process.exit(1);

function printDone(id) {
  console.log("\n" + "=".repeat(56));
  console.log("  Builder Agent deployed!\n");
  console.log(`  BUILDER_AGENT_ID=${id}`);
  console.log(`\n  Add to .env.local:`);
  console.log(`    BUILDER_AGENT_ID=${id}`);
  console.log("\n  The Build page will now use this harness for agent creation.");
  console.log("=".repeat(56) + "\n");
}
