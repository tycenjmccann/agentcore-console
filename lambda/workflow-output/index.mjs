/**
 * Workflow Output Lambda — receives structured work products from agents.
 * Stores to S3, marks tickets done in DynamoDB, and returns a confirmation.
 *
 * Tools: submit_ticket_plan, save_design_doc, report_completion
 */

import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";

const REGION = process.env.AWS_REGION || "us-east-1";
const s3 = new S3Client({ region: REGION });
const BUCKET = process.env.ARTIFACT_BUCKET || "";

async function submitTicketPlan({ workflow_id, requirements, tickets }) {
  const key = `workflows/${workflow_id}/shared/ticket-plan.json`;
  await s3.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: JSON.stringify({ requirements, tickets }, null, 2),
    ContentType: "application/json",
  }));
  return {
    status: "saved",
    location: `s3://${BUCKET}/${key}`,
    ticket_count: tickets.length,
    message: `Ticket plan saved with ${tickets.length} tickets. The orchestration engine will create these tickets.`,
  };
}

async function saveDesignDoc({ workflow_id, agent_id, title, content, format = "markdown" }) {
  const ext = format === "json" ? "json" : "md";
  const filename = title
    ? title.toLowerCase().replace(/[^a-z0-9]+/g, "-") + `.${ext}`
    : `design-doc-${Date.now()}.${ext}`;
  const key = `workflows/${workflow_id}/${agent_id}/${filename}`;
  await s3.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: content,
    ContentType: format === "json" ? "application/json" : "text/markdown",
  }));
  const sharedKey = `workflows/${workflow_id}/shared/${filename}`;
  await s3.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: sharedKey,
    Body: content,
    ContentType: format === "json" ? "application/json" : "text/markdown",
  }));
  // Update manifest with design doc reference
  if (workflow_id && agent_id) {
    try {
      await updateManifest(workflow_id, agent_id, [{
        type: "design-doc", format: format === "json" ? "json" : "markdown",
        description: title || "Design document", s3Key: sharedKey, addedBy: agent_id, critical: true,
      }]);
    } catch { /* non-fatal */ }
  }

  return {
    status: "saved",
    location: `s3://${BUCKET}/${key}`,
    shared_location: `s3://${BUCKET}/${sharedKey}`,
    message: `Design doc saved. Other agents can read it from the shared location.`,
  };
}

async function reportCompletion({ ticket_id, summary, artifacts = "", branch, commit_sha, pr_url }) {
  const key = `completions/${ticket_id}.json`;
  const report = {
    ticket_id,
    summary,
    artifacts,
    branch: branch || null,
    commit_sha: commit_sha || null,
    pr_url: pr_url || null,
    completed_at: new Date().toISOString(),
  };
  await s3.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: JSON.stringify(report, null, 2),
    ContentType: "application/json",
  }));
  console.log(`[report_completion] Saved s3://${BUCKET}/${key}`);

  return {
    status: "complete",
    message: `Completion saved for ${ticket_id}.`,
  };
}

// ─── Manifest Updates ──────────────────────────────────────────────────────────

const PHASE_MAP = {
  "team-requirements-analyst": "requirements",
  "team-frontend-designer": "design", "team-ios-designer": "design",
  "team-backend-designer": "design", "team-android-designer": "design",
  "team-security-reviewer": "design", "team-legal-compliance": "design",
  "team-localization": "design", "team-analytics-designer": "design",
  "team-frontend-dev": "development", "team-backend-dev": "development",
  "team-api-dev": "development",
  "team-qa-verifier": "verification", "team-ci-agent": "verification",
};

async function updateManifest(workflowId, agentId, entries) {
  if (!workflowId || !entries || entries.length === 0) return;
  const manifestKey = `workflows/${workflowId}/shared/manifest.json`;
  let manifest;
  try {
    const result = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: manifestKey }));
    manifest = JSON.parse(await result.Body.transformToString());
  } catch {
    manifest = {
      workflowId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      phases: { intake: [], requirements: [], design: [], development: [], verification: [] },
    };
  }

  const phase = PHASE_MAP[agentId] || "development";
  const now = new Date().toISOString();
  const newEntries = entries.map((e, i) => ({ id: `${phase}-${Date.now().toString(36)}-${i}`, addedAt: now, ...e }));
  manifest.phases[phase] = [...(manifest.phases[phase] || []), ...newEntries];
  manifest.updatedAt = now;

  await s3.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: manifestKey,
    Body: JSON.stringify(manifest, null, 2),
    ContentType: "application/json",
  }));
  console.log(`[manifest] Added ${newEntries.length} entries to ${phase} for ${workflowId}`);
}

const TOOLS = {
  submit_ticket_plan: submitTicketPlan,
  save_design_doc: saveDesignDoc,
  report_completion: reportCompletion,
  // Full prefixed names (sent by main.py @tool functions)
  "WorkflowOutput___submit_ticket_plan": submitTicketPlan,
  "WorkflowOutput___save_design_doc": saveDesignDoc,
  "WorkflowOutput___report_completion": reportCompletion,
};

/**
 * Infer tool from flat args when gateway doesn't include tool name.
 */
function inferToolFromArgs(args) {
  if (args.requirements && args.tickets) return "submit_ticket_plan";
  if (args.title && args.content && args.agent_id) return "save_design_doc";
  if (args.ticket_id && args.summary) return "report_completion";
  if (args.tickets) return "submit_ticket_plan";
  if (args.content && args.workflow_id) return "save_design_doc";
  return null;
}

export const handler = async (event) => {
  console.log("Workflow output event:", JSON.stringify(event));

  // Method 1: Explicit tool name
  let toolName = event.name || event.tool_name;
  let args = event.arguments || event.input;

  if (toolName && args) {
    console.log(`Routing via explicit name: ${toolName}`);
  } else {
    // Method 2: Gateway flat args
    args = event;
    toolName = inferToolFromArgs(args);
    console.log(`Routing via inference: ${toolName}`);
  }

  if (!toolName || !TOOLS[toolName]) {
    return {
      content: [{
        type: "text",
        text: `Unknown tool: "${toolName}". Available: ${Object.keys(TOOLS).join(", ")}. Keys: ${JSON.stringify(Object.keys(event))}`,
      }],
    };
  }

  try {
    const result = await TOOLS[toolName](args);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  } catch (err) {
    console.error(`[workflow-output] Error in ${toolName}:`, err);
    return {
      content: [{ type: "text", text: `Error: ${err.message}` }],
      isError: true,
    };
  }
};
