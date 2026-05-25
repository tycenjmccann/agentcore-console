/**
 * Eval Packager Lambda
 *
 * Trigger: CloudWatch Logs Subscription Filter (on eval result log groups)
 *
 * When an evaluation result arrives:
 * 1. Parse eval scores from the CW log event
 * 2. Read the agent's current prompt from S3
 * 3. Include tools, skills, and recent git history
 * 4. Package everything into one report
 * 5. Write package to S3 (audit trail)
 * 6. Invoke the fleet improver agent with the package
 * 7. Write the agent's PRD response to S3 (triggers prd-submitter)
 *
 * Environment:
 *   ARTIFACT_BUCKET - S3 bucket
 *   IMPROVEMENT_AGENT_ID - AgentCore runtime ID for the fleet improver
 */

import { S3Client, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { BedrockAgentCoreClient, InvokeAgentRuntimeCommand } from "@aws-sdk/client-bedrock-agentcore";
import { gunzipSync } from "zlib";

const REGION = process.env.AWS_REGION || "us-east-1";
const BUCKET = process.env.ARTIFACT_BUCKET;
const AGENT_ID = process.env.IMPROVEMENT_AGENT_ID;
const ACCOUNT_ID = process.env.AWS_ACCOUNT_ID;

if (!BUCKET) throw new Error("ARTIFACT_BUCKET env var required");
if (!AGENT_ID) throw new Error("IMPROVEMENT_AGENT_ID env var required");
if (!ACCOUNT_ID) throw new Error("AWS_ACCOUNT_ID env var required");

const s3 = new S3Client({ region: REGION });
const agentcore = new BedrockAgentCoreClient({ region: REGION });

const CONFIG_TO_AGENT = {
  eval_agentis_analytics_designer: "agentis_analytics_designer",
  eval_agentis_android_designer: "agentis_android_designer",
  eval_agentis_api_dev: "agentis_api_dev",
  eval_agentis_backend_designer: "agentis_backend_designer",
  eval_agentis_backend_dev: "agentis_backend_dev",
  eval_agentis_ci_agent: "agentis_ci_agent",
  eval_agentis_frontend_designer: "agentis_frontend_designer",
  eval_agentis_frontend_dev: "agentis_frontend_dev",
  eval_agentis_ios_designer: "agentis_ios_designer",
  eval_agentis_legal_compliance: "agentis_legal_compliance",
  eval_agentis_localization: "agentis_localization",
  eval_agentis_qa_verifier: "agentis_qa_verifier",
  eval_agentis_requirements_analyst: "agentis_requirements_analyst",
  eval_agentis_security_reviewer: "agentis_security_reviewer",
};

// All agents share the same tool set
const AGENT_TOOLS = [
  "code_interpreter (sandboxed Python/Node.js)",
  "browser (cloud browser automation)",
  "shell (command execution)",
  "file_read, file_write, editor",
  "http_request",
  "image_reader",
  "python_repl",
  "S3Storage (read_object, write_object, list_objects)",
  "JiraIntegration (create_ticket, transition_ticket, update_ticket, list_tickets, add_comment, search_issues)",
  "WorkflowOutput (report_completion, save_design_doc, submit_ticket_plan)",
  "SkillLoader (load_skill — role-specific instructions)",
  "claude_code (delegate coding tasks to Claude Code CLI — dev agents only)",
  "GitHub MCP (repos, PRs, issues, files — via GITHUB_PAT)",
];

export async function handler(event) {
  // CW Logs subscription delivers base64-encoded, gzipped data
  const payload = Buffer.from(event.awslogs.data, "base64");
  const json = JSON.parse(gunzipSync(payload).toString());

  const logGroup = json.logGroup || "";
  const logEvents = json.logEvents || [];

  // Determine which agent
  const configMatch = Object.keys(CONFIG_TO_AGENT).find(c => logGroup.includes(c));
  if (!configMatch) {
    console.log(`[eval-packager] Unknown log group: ${logGroup}`);
    return { statusCode: 200, body: "Unknown config" };
  }
  const agentName = CONFIG_TO_AGENT[configMatch];
  console.log(`[eval-packager] ${logEvents.length} eval events for ${agentName}`);

  // Parse scores from log events
  const scores = {};
  let sessionId = "";
  const rawEvents = [];

  let parseFailures = 0;
  let noEvaluatorCount = 0;

  for (const logEvent of logEvents) {
    try {
      const parsed = JSON.parse(logEvent.message);
      rawEvents.push(parsed);

      const attrs = parsed.attributes || {};
      sessionId = sessionId || attrs["session.id"] || parsed.session_id || parsed.sessionId || parsed.traceId || `session-${Date.now()}`;
      const evaluator = attrs["gen_ai.evaluation.name"] || parsed.evaluator_id || parsed.evaluatorId || parsed.evaluator || "";
      const score = attrs["gen_ai.evaluation.score.value"] ?? parsed.score ?? parsed.result?.score;
      const reason = attrs["gen_ai.evaluation.explanation"] || parsed.reason || parsed.result?.reason || parsed.explanation || "";

      if (evaluator && score !== undefined && score !== null) {
        scores[evaluator] = { score: Number(score), reason: String(reason).slice(0, 500) };
      } else {
        noEvaluatorCount++;
        if (noEvaluatorCount <= 2) {
          console.log(`[eval-packager] Event missing evaluator/score. Keys: ${Object.keys(parsed).join(",")}, attrs keys: ${Object.keys(attrs).join(",")}, name field: ${parsed.name || "none"}`);
        }
      }
    } catch (err) {
      parseFailures++;
      if (parseFailures <= 2) {
        console.log(`[eval-packager] JSON parse error: ${err.message}. First 200 chars: ${String(logEvent.message).slice(0, 200)}`);
      }
      rawEvents.push({ raw: logEvent.message });
    }
  }

  if (Object.keys(scores).length === 0) {
    console.log(`[eval-packager] No parseable scores for ${agentName}. Events: ${logEvents.length}, parseFailures: ${parseFailures}, noEvaluator: ${noEvaluatorCount}`);
    return { statusCode: 200, body: "No scores" };
  }

  // Read current prompt
  let currentPrompt = "";
  try {
    const result = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: `prompts/${agentName}.txt` }));
    currentPrompt = await result.Body.transformToString();
  } catch (err) {
    console.warn(`[eval-packager] No prompt for ${agentName}: ${err.message}`);
  }

  // Read recent changes (git log for this agent's prompt)
  let recentChanges = "";
  try {
    const result = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: `changelog/${agentName}.txt` }));
    recentChanges = await result.Body.transformToString();
  } catch {
    recentChanges = "(no changelog available)";
  }

  // Build package
  const scoreValues = Object.values(scores).map(s => s.score);
  const pkg = {
    agent: agentName,
    session_id: sessionId,
    timestamp: new Date().toISOString(),
    eval_config: configMatch,
    scores,
    summary: {
      overall_avg: Math.round((scoreValues.reduce((a, b) => a + b, 0) / scoreValues.length) * 100) / 100,
      min_score: Math.round(Math.min(...scoreValues) * 100) / 100,
      count: scoreValues.length,
    },
    current_prompt: currentPrompt,
    tools: AGENT_TOOLS,
    skills: `Agent loads role-specific skills via SkillLoader___load_skill. Skills are stored in lambda/skill-loader/ and provide detailed instructions for the agent's specialty.`,
    recent_changes: recentChanges,
    raw_eval_events: rawEvents,
    prompt_path: `deploy/runtime-agent/prompts/${agentName}.txt`,
  };

  // Write package to S3 (audit trail)
  const pkgKey = `eval-packages/${agentName}/${sessionId}.json`;
  await s3.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: pkgKey,
    Body: JSON.stringify(pkg, null, 2),
    ContentType: "application/json",
  }));
  console.log(`[eval-packager] Package: ${pkgKey}`);

  // Invoke the fleet improver agent — it writes its own output to S3 via tools
  const response = await agentcore.send(new InvokeAgentRuntimeCommand({
    agentRuntimeArn: `arn:aws:bedrock-agentcore:${REGION}:${ACCOUNT_ID}:runtime/${AGENT_ID}`,
    runtimeSessionId: `improve-${agentName}-${Date.now()}`,
    payload: JSON.stringify({
      prompt: JSON.stringify(pkg),
    }),
  }));

  // Consume the stream (agent does its own S3 writes via tools)
  if (response.output?.stream) {
    for await (const chunk of response.output.stream) {
      // Agent handles everything — we just need to drain the stream
    }
  }

  console.log(`[eval-packager] Agent invoked for ${agentName}`);
  return { statusCode: 200, body: JSON.stringify({ agent: agentName, pkgKey }) };
}
