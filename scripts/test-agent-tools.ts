#!/usr/bin/env npx tsx
/**
 * Agent Tool Validation Script
 *
 * Invokes each harness agent with a minimal prompt that exercises its declared tools.
 * Verifies that tools actually execute server-side (via tool_start/tool_stop traces).
 *
 * Usage:
 *   npx tsx scripts/test-agent-tools.ts [--agent <harnessName>] [--verbose]
 *
 * Requirements:
 *   - AWS credentials configured (AWS_PROFILE or env vars)
 *   - AWS_REGION set (defaults to us-east-1)
 *   - TEAM_WORKFLOW_S3_BUCKET set (for S3 tool tests)
 */

import {
  BedrockAgentCoreClient,
  InvokeHarnessCommand,
} from "@aws-sdk/client-bedrock-agentcore";
import {
  BedrockAgentCoreControlClient,
  ListHarnessesCommand,
  GetHarnessCommand,
} from "@aws-sdk/client-bedrock-agentcore-control";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const REGION = process.env.AWS_REGION || "us-east-1";
const S3_BUCKET = process.env.TEAM_WORKFLOW_S3_BUCKET || "";
const VERBOSE = process.argv.includes("--verbose");
const AGENT_FILTER = (() => {
  const idx = process.argv.indexOf("--agent");
  return idx !== -1 ? process.argv[idx + 1] : null;
})();

// ─── Test Prompts ───────────────────────────────────────────────────────────
// Each prompt is designed to trigger specific tool usage.
// We look for tool_start events in the stream to confirm execution.

interface ToolTest {
  name: string;
  prompt: string;
  expectedTools: string[]; // Tool names we expect to see in traces
  setup?: () => Promise<void>; // Optional setup (e.g., write a test file to S3)
}

const TOOL_TESTS: Record<string, ToolTest[]> = {
  // Requirements Analyst — has: s3_read, gateway (SkillLoader, WorkflowOutput, Jira)
  team_requirements_analyst: [
    {
      name: "SkillLoader via Gateway",
      prompt: `Call the SkillLoader___load_skill tool with skill_name "requirements-analysis". Return exactly what you receive. Do not do anything else.`,
      expectedTools: ["SkillLoader___load_skill", "load_skill"],
    },
    {
      name: "WorkflowOutput submit_ticket_plan",
      prompt: `Call WorkflowOutput___submit_ticket_plan with the following data:
{
  "requirements": "Test requirement: user login",
  "tickets": [{"title": "Test ticket", "description": "Test", "assignee": "team-frontend-dev", "blockedBy": []}]
}
Only call that tool and return the result. Do nothing else.`,
      expectedTools: ["WorkflowOutput___submit_ticket_plan", "submit_ticket_plan"],
    },
  ],

  // iOS Designer — has: s3_read, s3_write, a2a, gateway, figma
  team_ios_designer: [
    {
      name: "S3 Read",
      prompt: `Use the s3_read tool to read the file at key "test/tool-validation.txt" from the workflow artifacts bucket. Return exactly what you read, or the error message if it fails.`,
      expectedTools: ["s3_read", "file_read", "read"],
    },
    {
      name: "S3 Write",
      prompt: `Use the s3_write tool to write the text "tool-test-ok" to the key "test/validation-output.txt". Return confirmation.`,
      expectedTools: ["s3_write", "file_write", "write"],
    },
    {
      name: "Gateway - SkillLoader",
      prompt: `Call SkillLoader___load_skill with skill_name "ios-architecture". Return the first 100 characters of what you receive.`,
      expectedTools: ["SkillLoader___load_skill", "load_skill"],
    },
  ],

  // Backend Designer — has: s3_read, s3_write, a2a, gateway, figma
  team_backend_designer: [
    {
      name: "Gateway - SkillLoader",
      prompt: `Call SkillLoader___load_skill with skill_name "backend-systems". Return the first 100 characters of what you receive.`,
      expectedTools: ["SkillLoader___load_skill", "load_skill"],
    },
    {
      name: "S3 Read",
      prompt: `Use s3_read to read the key "test/tool-validation.txt". Return what you get.`,
      expectedTools: ["s3_read", "file_read", "read"],
    },
  ],

  // Frontend Dev — has: s3_read, code_interpreter, git, a2a, gateway
  team_frontend_dev: [
    {
      name: "Gateway - GitHubIntegration list_files",
      prompt: `Call GitHubIntegration___list_files with path "src/components". Return the list of files you see.`,
      expectedTools: ["GitHubIntegration___list_files", "list_files"],
    },
    {
      name: "Gateway - SkillLoader",
      prompt: `Call SkillLoader___load_skill with skill_name "full-stack". Return the first 100 characters.`,
      expectedTools: ["SkillLoader___load_skill", "load_skill"],
    },
    {
      name: "Code Interpreter",
      prompt: `Use the code_interpreter tool (or shell/execute_command) to run: echo "hello-from-ci". Return the output.`,
      expectedTools: ["code_interpreter", "shell", "execute_command", "execute_code"],
    },
  ],

  // Backend Dev — has: s3_read, code_interpreter, git, a2a, gateway
  team_backend_dev: [
    {
      name: "Gateway - GitHubIntegration list_files",
      prompt: `Call GitHubIntegration___list_files with path "src/lib". Return the file list.`,
      expectedTools: ["GitHubIntegration___list_files", "list_files"],
    },
    {
      name: "Code Interpreter",
      prompt: `Use the code_interpreter tool (or shell/execute_command) to run: node -e "console.log(JSON.stringify({status:'ok'}))". Return the output.`,
      expectedTools: ["code_interpreter", "shell", "execute_command", "execute_code"],
    },
  ],

  // API Dev — has: s3_read, code_interpreter, git, a2a, gateway
  team_api_dev: [
    {
      name: "Gateway - GitHubIntegration list_files",
      prompt: `Call GitHubIntegration___list_files with path "src/app/api". Return the file list.`,
      expectedTools: ["GitHubIntegration___list_files", "list_files"],
    },
  ],

  // QA Verifier — has: s3_read, code_interpreter, git, a2a, gateway
  team_qa_verifier: [
    {
      name: "Code Interpreter",
      prompt: `Use the code_interpreter tool (or shell/execute_command) to run: echo "qa-tool-ok". Return the output.`,
      expectedTools: ["code_interpreter", "shell", "execute_command", "execute_code"],
    },
    {
      name: "Gateway - GitHubIntegration list_files",
      prompt: `Call GitHubIntegration___list_files with path "src". Return the file list.`,
      expectedTools: ["GitHubIntegration___list_files", "list_files"],
    },
  ],

  // CI Agent — has: gateway, a2a
  team_ci_agent: [
    {
      name: "Gateway - GitHubIntegration list_files",
      prompt: `Call GitHubIntegration___list_files with path "src". Return the file list.`,
      expectedTools: ["GitHubIntegration___list_files", "list_files"],
    },
  ],

  // Security Reviewer — has: s3_read, s3_write, a2a, gateway
  team_security_reviewer: [
    {
      name: "Gateway - GitHubIntegration search_code",
      prompt: `Call GitHubIntegration___search_code with query "authentication". Return the first result.`,
      expectedTools: ["GitHubIntegration___search_code", "search_code"],
    },
  ],
};

// ─── Stream Consumer ────────────────────────────────────────────────────────

interface InvocationResult {
  text: string;
  toolsUsed: string[];
  errors: string[];
  traces: Array<{ event: string; name?: string; timestamp?: string }>;
}

async function invokeAndCollect(
  client: BedrockAgentCoreClient,
  harnessArn: string,
  prompt: string,
  sessionId: string,
): Promise<InvocationResult> {
  const command = new InvokeHarnessCommand({
    harnessArn,
    runtimeSessionId: sessionId,
    messages: [{ role: "user", content: [{ text: prompt }] }],
  });

  const response = await client.send(command);
  const result: InvocationResult = { text: "", toolsUsed: [], errors: [], traces: [] };

  if (response.stream) {
    for await (const event of response.stream as AsyncIterable<Record<string, unknown>>) {
      if ("contentBlockDelta" in event) {
        const delta = event.contentBlockDelta as { delta?: { text?: string } };
        if (delta.delta?.text) {
          result.text += delta.delta.text;
        }
      } else if ("contentBlockStart" in event) {
        const block = event.contentBlockStart as { start?: { toolUse?: { toolUseId?: string; name?: string } } };
        if (block.start?.toolUse?.name) {
          result.toolsUsed.push(block.start.toolUse.name);
          result.traces.push({ event: "tool_start", name: block.start.toolUse.name });
        }
      } else if ("messageStart" in event) {
        result.traces.push({ event: "message_start" });
      } else if ("messageStop" in event) {
        result.traces.push({ event: "message_stop" });
      }
    }
  }

  // Check for error indicators in the text output
  if (result.text.includes("[Error") || result.text.includes("ToolNotFound") || result.text.includes("tool is not available")) {
    result.errors.push("Agent reported tool unavailable or error in text output");
  }

  return result;
}

// ─── S3 Setup ──────────────────────────────────────────────────────────────

async function setupS3TestFile(): Promise<void> {
  if (!S3_BUCKET) {
    console.warn("  ⚠️  TEAM_WORKFLOW_S3_BUCKET not set — S3 tool tests may fail");
    return;
  }
  const s3 = new S3Client({ region: REGION });
  await s3.send(new PutObjectCommand({
    Bucket: S3_BUCKET,
    Key: "test/tool-validation.txt",
    Body: "tool-validation-test-content-ok",
    ContentType: "text/plain",
  }));
  console.log(`  ✓ S3 test file written to s3://${S3_BUCKET}/test/tool-validation.txt`);
}

// ─── Main ──────────────────────────────────────────────────────────────────

async function main() {
  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log("║      Agent Tool Validation — AgentCore Harness Test     ║");
  console.log("╚══════════════════════════════════════════════════════════╝\n");
  console.log(`Region: ${REGION}`);
  console.log(`S3 Bucket: ${S3_BUCKET || "(not set)"}`);
  console.log(`Filter: ${AGENT_FILTER || "(all agents)"}\n`);

  // Step 1: Discover harnesses
  console.log("─── Discovering Harnesses ─────────────────────────────────\n");
  const controlClient = new BedrockAgentCoreControlClient({ region: REGION });
  const harnessRes = await controlClient.send(new ListHarnessesCommand({ maxResults: 100 }));
  const harnesses = harnessRes.harnesses || [];

  const harnessMap = new Map<string, { arn: string; id: string; status: string }>();
  for (const h of harnesses) {
    const name = h.harnessName || h.harnessId!;
    harnessMap.set(name, { arn: h.arn!, id: h.harnessId!, status: h.status || "UNKNOWN" });
    if (!AGENT_FILTER || name === AGENT_FILTER) {
      console.log(`  ${h.status === "READY" ? "✓" : "✗"} ${name} [${h.status}]`);
    }
  }
  console.log(`\n  Total: ${harnesses.length} harnesses discovered\n`);

  // Step 2: Get harness tool details
  console.log("─── Harness Tool Configuration ────────────────────────────\n");
  for (const [name, info] of harnessMap) {
    if (AGENT_FILTER && name !== AGENT_FILTER) continue;
    try {
      const detail = await controlClient.send(new GetHarnessCommand({ harnessId: info.id }));
      const tools = (detail.harness?.tools as unknown[]) || [];
      const toolNames = tools.map((t: unknown) => {
        const tool = t as { type?: string; remoteMcp?: { url?: string }; inlineFunction?: { name?: string } };
        if (tool.remoteMcp?.url) return `remote_mcp(${tool.remoteMcp.url.split("/").pop()})`;
        if (tool.inlineFunction?.name) return `inline(${tool.inlineFunction.name})`;
        return tool.type || "unknown";
      });
      console.log(`  ${name}:`);
      if (toolNames.length === 0) {
        console.log(`    ⚠️  NO TOOLS CONFIGURED`);
      } else {
        for (const tn of toolNames) {
          console.log(`    - ${tn}`);
        }
      }
    } catch (err) {
      console.log(`  ${name}: ERROR fetching details — ${(err as Error).message}`);
    }
  }
  console.log();

  // Step 3: Setup test data
  console.log("─── Setup ────────────────────────────────────────────────\n");
  await setupS3TestFile();
  console.log();

  // Step 4: Run tool tests
  console.log("─── Running Tool Tests ───────────────────────────────────\n");
  const dataClient = new BedrockAgentCoreClient({ region: REGION });

  const results: Array<{
    agent: string;
    test: string;
    passed: boolean;
    toolsUsed: string[];
    expectedTools: string[];
    error?: string;
    textSnippet?: string;
  }> = [];

  for (const [harnessName, tests] of Object.entries(TOOL_TESTS)) {
    if (AGENT_FILTER && harnessName !== AGENT_FILTER) continue;

    const harnessInfo = harnessMap.get(harnessName);
    if (!harnessInfo) {
      console.log(`  ⚠️  ${harnessName}: NOT FOUND in account — skipping\n`);
      for (const test of tests) {
        results.push({
          agent: harnessName,
          test: test.name,
          passed: false,
          toolsUsed: [],
          expectedTools: test.expectedTools,
          error: "Harness not found in account",
        });
      }
      continue;
    }

    if (harnessInfo.status !== "READY") {
      console.log(`  ⚠️  ${harnessName}: Status is ${harnessInfo.status} — skipping\n`);
      continue;
    }

    console.log(`  ┌─ ${harnessName}`);

    for (const test of tests) {
      const sessionId = `tool-test-${harnessName}-${Date.now()}`;
      process.stdout.write(`  │  Testing: ${test.name}...`);

      try {
        if (test.setup) await test.setup();

        const invResult = await invokeAndCollect(dataClient, harnessInfo.arn, test.prompt, sessionId);

        // Check if ANY of the expected tools were called
        const toolMatched = test.expectedTools.some(expected =>
          invResult.toolsUsed.some(used =>
            used.toLowerCase().includes(expected.toLowerCase()) ||
            expected.toLowerCase().includes(used.toLowerCase())
          )
        );

        const passed = toolMatched && invResult.errors.length === 0;

        if (passed) {
          console.log(` ✅ PASS (tools: ${invResult.toolsUsed.join(", ")})`);
        } else if (invResult.toolsUsed.length === 0) {
          console.log(` ❌ FAIL — No tools invoked`);
          if (VERBOSE) {
            console.log(`  │    Response: ${invResult.text.slice(0, 200)}`);
          }
        } else {
          console.log(` ❌ FAIL — Wrong tools: ${invResult.toolsUsed.join(", ")}`);
          if (invResult.errors.length > 0) {
            console.log(`  │    Errors: ${invResult.errors.join("; ")}`);
          }
        }

        results.push({
          agent: harnessName,
          test: test.name,
          passed,
          toolsUsed: invResult.toolsUsed,
          expectedTools: test.expectedTools,
          error: passed ? undefined : (invResult.errors[0] || "Tool not invoked or wrong tool"),
          textSnippet: invResult.text.slice(0, 300),
        });

        if (VERBOSE) {
          console.log(`  │    Traces: ${JSON.stringify(invResult.traces)}`);
          console.log(`  │    Text: ${invResult.text.slice(0, 200)}`);
        }
      } catch (err) {
        const errMsg = (err as Error).message;
        console.log(` ❌ ERROR — ${errMsg.slice(0, 100)}`);
        results.push({
          agent: harnessName,
          test: test.name,
          passed: false,
          toolsUsed: [],
          expectedTools: test.expectedTools,
          error: errMsg,
        });
      }
    }
    console.log(`  └─\n`);
  }

  // Step 5: Summary
  console.log("═══════════════════════════════════════════════════════════");
  console.log("                     RESULTS SUMMARY                       ");
  console.log("═══════════════════════════════════════════════════════════\n");

  const passed = results.filter(r => r.passed);
  const failed = results.filter(r => !r.passed);

  console.log(`  Total tests: ${results.length}`);
  console.log(`  ✅ Passed: ${passed.length}`);
  console.log(`  ❌ Failed: ${failed.length}\n`);

  if (failed.length > 0) {
    console.log("  Failed tests:");
    for (const f of failed) {
      console.log(`    - ${f.agent} / ${f.test}: ${f.error}`);
    }
    console.log();
  }

  // Step 6: Write results JSON
  const outputPath = `${process.cwd()}/scripts/tool-test-results.json`;
  const fs = await import("fs");
  fs.writeFileSync(outputPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    region: REGION,
    bucket: S3_BUCKET,
    results,
    summary: { total: results.length, passed: passed.length, failed: failed.length },
  }, null, 2));
  console.log(`  Results written to: ${outputPath}\n`);

  // Exit with error code if any tests failed
  if (failed.length > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("\n❌ Fatal error:", err.message);
  if (VERBOSE) console.error(err.stack);
  process.exit(2);
});
