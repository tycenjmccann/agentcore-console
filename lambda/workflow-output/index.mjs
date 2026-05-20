/**
 * Workflow Output Lambda — receives structured work products from agents.
 * Stores to S3, marks tickets done in DynamoDB, and returns a confirmation.
 *
 * Tools: submit_ticket_plan, save_design_doc, report_completion
 */

import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, UpdateCommand, GetCommand } from "@aws-sdk/lib-dynamodb";

const REGION = process.env.AWS_REGION || "us-east-1";
const s3 = new S3Client({ region: REGION });
const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }), {
  marshallOptions: { removeUndefinedValues: true },
});

const BUCKET = process.env.ARTIFACT_BUCKET || "agentcore-artifacts-023392223961-us-east-1";
const TICKETS_TABLE = process.env.TICKETS_TABLE || "agentis-tickets";
const WORKFLOWS_TABLE = process.env.WORKFLOWS_TABLE || "agentis-workflows";

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
  return {
    status: "saved",
    location: `s3://${BUCKET}/${key}`,
    shared_location: `s3://${BUCKET}/${sharedKey}`,
    message: `Design doc saved. Other agents can read it from the shared location.`,
  };
}

async function reportCompletion({ ticket_id, summary, artifacts = "", branch, commit_sha, pr_url }) {
  // 1. Save completion report to S3 (for audit trail)
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

  // 2. Mark ticket as DONE in DynamoDB — this triggers the orchestrator stream
  if (ticket_id) {
    await ddb.send(new UpdateCommand({
      TableName: TICKETS_TABLE,
      Key: { ticketId: ticket_id },
      UpdateExpression: "SET #s = :s, #u = :u, #out = :out, #br = :br, #pr = :pr",
      ExpressionAttributeNames: {
        "#s": "status",
        "#u": "updatedAt",
        "#out": "output",
        "#br": "branch",
        "#pr": "prUrl",
      },
      ExpressionAttributeValues: {
        ":s": "done",
        ":u": new Date().toISOString(),
        ":out": summary,
        ":br": branch || null,
        ":pr": pr_url || null,
      },
    }));
    console.log(`[report_completion] Marked ${ticket_id} as done`);
  }

  // 3. Update workflow agentTasks map (powers the UI output panel)
  const workflowId = ticket_id ? await findWorkflowForTicket(ticket_id) : null;
  if (workflowId) {
    try {
      const wf = await ddb.send(new GetCommand({ TableName: WORKFLOWS_TABLE, Key: { workflowId } }));
      if (wf.Item) {
        const agentTasks = wf.Item.agentTasks || {};
        // Find the task entry for this ticket
        const taskKey = Object.keys(agentTasks).find(k => agentTasks[k]?.ticketId === ticket_id) || ticket_id;
        agentTasks[taskKey] = {
          ...agentTasks[taskKey],
          status: "complete",
          output: summary?.slice(0, 10000),
          branch: branch || null,
          commitSha: commit_sha || null,
          prUrl: pr_url || null,
          completedAt: new Date().toISOString(),
        };
        await ddb.send(new UpdateCommand({
          TableName: WORKFLOWS_TABLE,
          Key: { workflowId },
          UpdateExpression: "SET #at = :at, #u = :u",
          ExpressionAttributeNames: { "#at": "agentTasks", "#u": "updatedAt" },
          ExpressionAttributeValues: { ":at": agentTasks, ":u": new Date().toISOString() },
        }));
        console.log(`[report_completion] Updated workflow ${workflowId} agentTasks for ${taskKey}`);
      }
    } catch (err) {
      console.warn(`[report_completion] Failed to update workflow agentTasks: ${err.message}`);
    }
  }

  return {
    status: "complete",
    message: `Ticket ${ticket_id} marked done. Orchestrator will unblock dependents.`,
  };
}

async function findWorkflowForTicket(ticketId) {
  try {
    const result = await ddb.send(new GetCommand({
      TableName: TICKETS_TABLE,
      Key: { ticketId },
      ProjectionExpression: "workflowId",
    }));
    return result.Item?.workflowId || null;
  } catch {
    return null;
  }
}

const TOOLS = {
  submit_ticket_plan: submitTicketPlan,
  save_design_doc: saveDesignDoc,
  report_completion: reportCompletion,
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
