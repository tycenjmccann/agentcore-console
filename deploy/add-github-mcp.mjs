#!/usr/bin/env node
/**
 * add-github-mcp.mjs
 *
 * Adds GitHub's hosted MCP server as a remote_mcp tool to all team harness agents.
 * Uses UpdateHarnessCommand to add the tool without recreating.
 *
 * Usage:
 *   GITHUB_PAT=ghp_xxx node deploy/add-github-mcp.mjs [--agent <harnessName>] [--region us-east-1]
 *
 * If --agent is specified, only updates that one agent. Otherwise updates all team agents.
 */

const REGION = process.argv.includes("--region")
  ? process.argv[process.argv.indexOf("--region") + 1]
  : process.env.AWS_REGION || "us-east-1";

const SINGLE_AGENT = process.argv.includes("--agent")
  ? process.argv[process.argv.indexOf("--agent") + 1]
  : null;

const GITHUB_PAT = process.env.GITHUB_PAT;
if (!GITHUB_PAT) {
  console.error("Error: GITHUB_PAT environment variable is required.");
  console.error("  export GITHUB_PAT=ghp_your_token_here");
  process.exit(1);
}

const {
  BedrockAgentCoreControlClient,
  ListHarnessesCommand,
  GetHarnessCommand,
  UpdateHarnessCommand,
} = await import("@aws-sdk/client-bedrock-agentcore-control");

const client = new BedrockAgentCoreControlClient({ region: REGION });

// GitHub MCP tool definition
const GITHUB_MCP_TOOL = {
  type: "remote_mcp",
  name: "github",
  config: {
    remoteMcp: {
      url: "https://api.githubcopilot.com/mcp/",
      headers: {
        Authorization: `Bearer ${GITHUB_PAT}`,
      },
    },
  },
};

// List all harnesses
const listRes = await client.send(new ListHarnessesCommand({ maxResults: 50 }));
const harnesses = (listRes.harnesses || []).filter(
  (h) => h.harnessName?.startsWith("team_") && h.status === "READY"
);

if (SINGLE_AGENT) {
  const target = harnesses.find((h) => h.harnessName === SINGLE_AGENT);
  if (!target) {
    console.error(`Harness "${SINGLE_AGENT}" not found or not READY.`);
    console.error("Available:", harnesses.map((h) => h.harnessName).join(", "));
    process.exit(1);
  }
  await addGithubMcp(target);
} else {
  console.log(`Found ${harnesses.length} team harnesses. Adding GitHub MCP to all...\n`);
  for (const h of harnesses) {
    await addGithubMcp(h);
  }
}

async function addGithubMcp(harness) {
  const harnessId = harness.harnessId;
  console.log(`Updating ${harness.harnessName} (${harnessId})...`);

  // Get current config
  const getRes = await client.send(new GetHarnessCommand({ harnessId }));
  const current = getRes.harness;
  if (!current) {
    console.log(`  ✗ Could not fetch harness details`);
    return;
  }

  // Remove existing github tool if present (to update token)
  const existingTools = current.tools || [];
  const filteredTools = existingTools.filter(
    (t) => !(t.name === "github" && t.type === "remote_mcp")
  );

  // Add GitHub MCP with current token
  const updatedTools = [...filteredTools, GITHUB_MCP_TOOL];

  await client.send(
    new UpdateHarnessCommand({
      harnessId,
      tools: updatedTools,
    })
  );

  console.log(`  ✓ Added GitHub MCP tool`);
}

console.log("\n✓ Done. GitHub MCP tools added.");
