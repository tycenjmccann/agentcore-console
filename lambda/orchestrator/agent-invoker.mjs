/**
 * Agent Invoker Lambda — Async Agent Execution
 *
 * Invoked ASYNCHRONOUSLY by the Orchestration Lambda (InvocationType: "Event").
 * Streams the AgentCore Harness agent to completion, then writes "done" to DynamoDB.
 * The DynamoDB write triggers the orchestrator again via DynamoDB Streams.
 *
 * This Lambda can run up to 15 minutes (Lambda max) to accommodate long agent runs.
 *
 * Input: { harnessArn, sessionId, prompt, workflowId, agentId, modelOverride }
 * Output: none (async fire-and-forget)
 */

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, UpdateCommand, GetCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { EventBridgeClient, PutEventsCommand } from "@aws-sdk/client-eventbridge";

const REGION = process.env.AWS_REGION || "us-east-1";
const TICKETS_TABLE = process.env.TICKETS_TABLE || "agentis-tickets";
const WORKFLOWS_TABLE = process.env.WORKFLOWS_TABLE || "agentis-workflows";
const ARTIFACT_BUCKET = process.env.ARTIFACT_BUCKET || "";
const EVENT_BUS = process.env.EVENT_BUS || "default";
const AGENTCORE_ENDPOINT = process.env.AGENTCORE_ENDPOINT || `https://bedrock-agent-runtime.${REGION}.amazonaws.com`;

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }), {
  marshallOptions: { removeUndefinedValues: true },
});
const s3 = new S3Client({ region: REGION });
const events = new EventBridgeClient({ region: REGION });

export const handler = async (event) => {
  const { harnessArn, sessionId, prompt, workflowId, agentId, modelOverride } = event;
  console.log(`[agent-invoker] Starting ${agentId} for workflow ${workflowId}`);

  let output = "";
  let error = null;

  try {
    // Determine invocation mode: Runtime (preferred) or Harness (legacy)
    // ARN format: arn:aws:bedrock-agentcore:REGION:ACCOUNT:runtime/ID (colon before "runtime", not slash)
    const useRuntime = harnessArn.includes(":runtime/") || harnessArn.includes("/runtime/") || process.env.USE_RUNTIME === "true";

    const MAX_RETRIES = 1;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const retrySessionId = attempt === 0 ? sessionId : `${sessionId}-retry${attempt}`;
        if (useRuntime) {
          output = await invokeRuntimeAgent(harnessArn, retrySessionId, prompt, workflowId, agentId, modelOverride);
        } else {
          output = await invokeHarnessAgent(harnessArn, retrySessionId, prompt, workflowId, agentId, modelOverride);
        }
        break; // Success
      } catch (invokeErr) {
        const msg = invokeErr.message || String(invokeErr);
        if (msg.includes("Read timed out") && attempt < MAX_RETRIES) {
          console.warn(`[agent-invoker] ${agentId} timed out (attempt ${attempt + 1}). Retrying...`);
          continue;
        }
        throw invokeErr; // Non-timeout or exhausted retries
      }
    }
    console.log(`[agent-invoker] ${agentId} completed. Output length: ${output.length}`);

    // Check for structured completion report in S3
    let completionData = {};
    try {
      const reportKey = `workflows/${workflowId}/${agentId}/completion-report.json`;
      // Read is optional — agent may not have called report_completion
      const { S3Client: _, GetObjectCommand: __ } = await import("@aws-sdk/client-s3");
      const s3Read = new S3Client({ region: REGION });
      const resp = await s3Read.send(new (await import("@aws-sdk/client-s3")).GetObjectCommand({
        Bucket: ARTIFACT_BUCKET,
        Key: reportKey,
      }));
      const body = await resp.Body.transformToString();
      completionData = JSON.parse(body);
      console.log(`[agent-invoker] Found completion report for ${agentId}`);
    } catch {
      // No completion report — that's fine
    }

    // Write output to S3 as artifact
    if (ARTIFACT_BUCKET && output) {
      try {
        await s3.send(new PutObjectCommand({
          Bucket: ARTIFACT_BUCKET,
          Key: `workflows/${workflowId}/${agentId}/output.md`,
          Body: output,
          ContentType: "text/markdown",
        }));
      } catch { /* non-fatal */ }
    }

    // Mark the ticket as "done" in DynamoDB
    // This triggers the DynamoDB Stream → Orchestration Lambda → cascade
    const ticketId = await findTicketForAgent(workflowId, agentId);
    if (ticketId) {
      await ddb.send(new UpdateCommand({
        TableName: TICKETS_TABLE,
        Key: { ticketId },
        UpdateExpression: "SET #s = :s, #u = :u",
        ExpressionAttributeNames: { "#s": "status", "#u": "updatedAt" },
        ExpressionAttributeValues: { ":s": "done", ":u": new Date().toISOString() },
      }));
      console.log(`[agent-invoker] Marked ${ticketId} as done`);
    }

    // Update workflow metadata with output/branch/commit
    await updateWorkflowTask(workflowId, agentId, {
      status: "complete",
      output: output.slice(0, 10000), // truncate for DynamoDB item size
      completedAt: new Date().toISOString(),
      branch: completionData.branch,
      commitSha: completionData.commit_sha,
      prUrl: completionData.pr_url,
    });

  } catch (err) {
    error = err.message || String(err);
    console.error(`[agent-invoker] ${agentId} failed:`, error);

    // Mark ticket as blocked
    const ticketId = await findTicketForAgent(workflowId, agentId);
    if (ticketId) {
      await ddb.send(new UpdateCommand({
        TableName: TICKETS_TABLE,
        Key: { ticketId },
        UpdateExpression: "SET #s = :s, #u = :u",
        ExpressionAttributeNames: { "#s": "status", "#u": "updatedAt" },
        ExpressionAttributeValues: { ":s": "blocked", ":u": new Date().toISOString() },
      }));
    }

    await updateWorkflowTask(workflowId, agentId, {
      status: "error",
      error,
      completedAt: new Date().toISOString(),
    });
  }

  // Publish event for real-time UI updates
  await publishAgentEvent(workflowId, agentId, error ? "agent.error" : "agent.complete", {
    output: output.slice(0, 1000),
    error,
  });
};

// ─── AgentCore Harness Invocation ──────────────────────────────────────────────

/**
 * Invoke the AgentCore Harness agent using InvokeHarnessCommand.
 * Uses @aws-sdk/client-bedrock-agentcore (bundled with Lambda).
 * Response is an event stream: messageStart, contentBlockStart, contentBlockDelta, contentBlockStop, messageStop, metadata.
 */
async function invokeHarnessAgent(harnessArn, sessionId, prompt, workflowId, agentId, modelOverride) {
  const { BedrockAgentCoreClient, InvokeHarnessCommand } = await import("@aws-sdk/client-bedrock-agentcore");
  const { NodeHttpHandler } = await import("@smithy/node-http-handler");
  const client = new BedrockAgentCoreClient({
    region: REGION,
    requestHandler: new NodeHttpHandler({
      connectionTimeout: 30_000,       // 30s to establish connection
      requestTimeout: 840_000,         // 14 min read timeout (agents can run long)
    }),
  });

  const messages = [{ role: "user", content: [{ text: prompt }] }];

  const commandInput = {
    harnessArn,
    runtimeSessionId: sessionId,
    messages,
    timeoutSeconds: 900,    // 15 min — harness default is 3600 but be explicit
    maxIterations: 50,      // Allow plenty of tool call cycles
  };

  // Per-invocation model override
  if (modelOverride) {
    if (typeof modelOverride === "object" && modelOverride.bedrockModelConfig) {
      // Already formatted by orchestrator
      commandInput.model = modelOverride;
    } else if (typeof modelOverride === "string") {
      commandInput.model = { bedrockModelConfig: { modelId: modelOverride } };
    }
  }

  const command = new InvokeHarnessCommand(commandInput);
  const response = await client.send(command);

  let fullOutput = "";

  if (response.stream) {
    for await (const event of response.stream) {
      if ("contentBlockDelta" in event) {
        const delta = event.contentBlockDelta?.delta;
        if (delta?.text) {
          fullOutput += delta.text;
          // Publish streaming event for real-time UI (non-blocking)
          await publishAgentEvent(workflowId, agentId, "agent.streaming", {
            type: "text",
            content: delta.text.slice(0, 200),
          }).catch(() => {});
        }
      } else if ("contentBlockStart" in event) {
        const toolUse = event.contentBlockStart?.start?.toolUse;
        if (toolUse) {
          await publishAgentEvent(workflowId, agentId, "agent.streaming", {
            type: "trace",
            toolName: toolUse.name,
          }).catch(() => {});
        }
      }
    }
  }

  return fullOutput;
}

// ─── AgentCore Runtime Invocation (No timeout ceiling) ────────────────────────

/**
 * Invoke a Strands agent deployed on AgentCore Runtime.
 * These agents control their own botocore read_timeout (set to 600s in main.py),
 * so Opus 4.7 can think as long as it needs without being killed.
 *
 * The Runtime agent expects payload: { prompt, workflow_id, agent_id, model_override }
 * Note: system_prompt is NOT passed — it's baked into the agent at deploy time via env var.
 * It returns a streaming response (SSE chunks).
 */
async function invokeRuntimeAgent(runtimeArn, sessionId, prompt, workflowId, agentId, modelOverride) {
  const https = await import("https");
  const { SignatureV4 } = await import("@smithy/signature-v4");
  const { Sha256 } = await import("@aws-crypto/sha256-js");
  const { defaultProvider } = await import("@aws-sdk/credential-provider-node");

  const payload = JSON.stringify({
    prompt,
    workflow_id: workflowId,
    agent_id: agentId,
    model_override: modelOverride?.bedrockModelConfig?.modelId || modelOverride || undefined,
  });

  // Extract runtime ID and account from ARN
  const runtimeId = runtimeArn.split("/").pop();
  const accountId = runtimeArn.split(":")[4];
  const host = `bedrock-agentcore.${REGION}.amazonaws.com`;
  const urlPath = `/runtimes/${encodeURIComponent(runtimeId)}/invocations`;

  console.log(`[agent-invoker] Runtime invoke: id=${runtimeId}, account=${accountId}`);

  // SigV4 sign the request — path and query must be separate for proper signing
  const signer = new SignatureV4({
    service: "bedrock-agentcore",
    region: REGION,
    credentials: defaultProvider(),
    sha256: Sha256,
  });

  const request = {
    method: "POST",
    protocol: "https:",
    hostname: host,
    path: urlPath,
    query: { accountId },
    headers: {
      "host": host,
      "content-type": "application/json",
      "x-amzn-bedrock-agentcore-runtime-session-id": sessionId,
    },
    body: payload,
  };

  const signedRequest = await signer.sign(request);

  // Make the HTTPS request with keepalive to prevent premature connection drops
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Runtime invoke timed out after 840s")), 840_000);

    const fullPath = `${urlPath}?accountId=${accountId}`;
    const req = https.default.request({
      hostname: host,
      path: fullPath,
      method: "POST",
      headers: { ...signedRequest.headers, "connection": "keep-alive" },
      timeout: 840_000,
    }, (res) => {
      // Disable socket timeout on the response — SSE streams can be idle between events
      if (res.socket) {
        res.socket.setTimeout(0);
        res.socket.setKeepAlive(true, 30_000);
      }

      console.log(`[agent-invoker] ${agentId} HTTP ${res.statusCode}, headers:`, JSON.stringify(res.headers));

      let fullOutput = "";
      let buffer = "";
      let rawChunks = [];

      res.on("data", (chunk) => {
        const text = chunk.toString();
        buffer += text;
        if (rawChunks.length < 5) rawChunks.push(text.slice(0, 500)); // Log first 5 chunks

        // Parse SSE events as they arrive
        const lines = buffer.split("\n");
        buffer = lines.pop(); // Keep incomplete last line in buffer

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const event = JSON.parse(line.slice(6));
              if (event.event?.contentBlockDelta?.delta?.text) {
                fullOutput += event.event.contentBlockDelta.delta.text;
              }
              if (event.message?.content?.[0]?.text && !fullOutput) {
                fullOutput = event.message.content[0].text;
              }
              // Also try direct text field at top level
              if (event.text && !fullOutput) {
                fullOutput += event.text;
              }
              // Try response.output format
              if (event.response?.output?.message?.content?.[0]?.text && !fullOutput) {
                fullOutput = event.response.output.message.content[0].text;
              }
              if (event.event?.contentBlockStart?.start?.toolUse) {
                publishAgentEvent(workflowId, agentId, "agent.streaming", {
                  type: "trace",
                  toolName: event.event.contentBlockStart.start.toolUse.name,
                }).catch(() => {});
              }
            } catch { /* non-JSON */ }
          }
          // Also try non-SSE: raw JSON response body
          else if (line.trim().startsWith("{")) {
            try {
              const obj = JSON.parse(line.trim());
              if (obj.message?.content?.[0]?.text) {
                fullOutput = obj.message.content[0].text;
              }
              if (obj.output?.message?.content?.[0]?.text) {
                fullOutput = obj.output.message.content[0].text;
              }
              if (obj.text) fullOutput = obj.text;
            } catch { /* not JSON */ }
          }
        }
      });

      res.on("end", () => {
        clearTimeout(timer);
        // Try to parse any remaining buffer as JSON
        if (!fullOutput && buffer.trim()) {
          try {
            const obj = JSON.parse(buffer.trim());
            if (obj.message?.content?.[0]?.text) fullOutput = obj.message.content[0].text;
            if (obj.output?.message?.content?.[0]?.text) fullOutput = obj.output.message.content[0].text;
            if (obj.text) fullOutput = obj.text;
          } catch { /* not JSON */ }
        }
        console.log(`[agent-invoker] ${agentId} response end. Output length: ${fullOutput.length}, raw chunks: ${rawChunks.length}, first chunk:`, rawChunks[0]?.slice(0, 300));
        if (res.statusCode >= 400) {
          reject(new Error(`Runtime returned ${res.statusCode}: ${fullOutput || buffer}`));
        } else {
          resolve(fullOutput || "[Agent completed but produced no text output]");
        }
      });

      res.on("error", (err) => {
        clearTimeout(timer);
        reject(err);
      });
    });

    // Set socket-level keepalive as soon as socket is assigned
    req.on("socket", (socket) => {
      socket.setKeepAlive(true, 30_000);
      socket.setTimeout(840_000);
      socket.on("timeout", () => {
        req.destroy(new Error("Socket timeout after 840s"));
      });
    });

    req.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });

    req.write(payload);
    req.end();
  });
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

async function findTicketForAgent(workflowId, agentId) {
  // Look up workflow to find the ticket ID
  const wf = await ddb.send(new GetCommand({ TableName: WORKFLOWS_TABLE, Key: { workflowId } }));
  const task = wf.Item?.agentTasks?.[agentId];
  if (task?.ticketId) return task.ticketId;

  // Fallback: scan tickets table for this agent's assigned ticket (race condition workaround)
  // The orchestrator may have written the ticketId but a concurrent updateWorkflowTask overwrote it
  const epicId = wf.Item?.epicId;
  if (epicId) {
    const result = await ddb.send(new QueryCommand({
      TableName: TICKETS_TABLE,
      IndexName: "parentId-index",
      KeyConditionExpression: "parentId = :pid",
      FilterExpression: "assignee = :agent AND #s = :status",
      ExpressionAttributeNames: { "#s": "status" },
      ExpressionAttributeValues: { ":pid": epicId, ":agent": agentId, ":status": "in_progress" },
    }));
    if (result.Items?.length > 0) {
      return result.Items[0].ticketId;
    }
  }
  return null;
}

async function updateWorkflowTask(workflowId, agentId, updates) {
  const wf = await ddb.send(new GetCommand({ TableName: WORKFLOWS_TABLE, Key: { workflowId } }));
  if (!wf.Item) return;

  const workflow = wf.Item;
  if (!workflow.agentTasks) workflow.agentTasks = {};
  workflow.agentTasks[agentId] = { ...workflow.agentTasks[agentId], ...updates };

  await ddb.send(new UpdateCommand({
    TableName: WORKFLOWS_TABLE,
    Key: { workflowId },
    UpdateExpression: "SET #at = :at, #u = :u",
    ExpressionAttributeNames: { "#at": "agentTasks", "#u": "updatedAt" },
    ExpressionAttributeValues: { ":at": workflow.agentTasks, ":u": new Date().toISOString() },
  }));
}

async function publishAgentEvent(workflowId, agentId, detailType, detail) {
  try {
    await events.send(new PutEventsCommand({
      Entries: [{
        Source: "agentis.agent-invoker",
        DetailType: detailType,
        Detail: JSON.stringify({ workflowId, agentId, ...detail, timestamp: new Date().toISOString() }),
        EventBusName: EVENT_BUS,
      }],
    }));
  } catch { /* non-fatal */ }
}
