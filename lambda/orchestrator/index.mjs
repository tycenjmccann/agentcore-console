/**
 * Orchestration Lambda — Event-Driven Workflow Engine
 *
 * Triggered by DynamoDB Streams on the `agentis-tickets` table.
 * Reacts to ticket status changes and drives the workflow forward:
 *
 *   ticket → "done"  → unblock dependents, check QA gate, check completion
 *   ticket → "ready" → invoke the assigned agent via AgentCore Harness
 *   ticket → "in_progress" → publish status event (UI notification)
 *
 * The Next.js app is read-only. It just visualizes state.
 * This Lambda is the SOLE orchestrator.
 */

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  UpdateCommand,
  QueryCommand,
} from "@aws-sdk/lib-dynamodb";
import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";
import { S3Client, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { EventBridgeClient, PutEventsCommand } from "@aws-sdk/client-eventbridge";
import {
  BedrockAgentRuntimeClient,
  InvokeAgentCommand,
} from "@aws-sdk/client-bedrock-agent-runtime";

// ─── Config ────────────────────────────────────────────────────────────────────

const REGION = process.env.AWS_REGION || "us-east-1";
const TICKETS_TABLE = process.env.TICKETS_TABLE || "agentis-tickets";
const WORKFLOWS_TABLE = process.env.WORKFLOWS_TABLE || "agentis-workflows";
const EVENTS_TABLE = process.env.EVENTS_TABLE || "agentis-events";
const ARTIFACT_BUCKET = process.env.ARTIFACT_BUCKET || "";
const GITHUB_LAMBDA = process.env.GITHUB_LAMBDA || "agentis-github-mcp";
const EVENT_BUS = process.env.EVENT_BUS || "default";
const MAX_QA_RETRIES = 3;

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }), {
  marshallOptions: { removeUndefinedValues: true },
});
const lambda = new LambdaClient({ region: REGION });
const s3 = new S3Client({ region: REGION });
const events = new EventBridgeClient({ region: REGION });
const bedrockAgent = new BedrockAgentRuntimeClient({ region: REGION });

// ─── Agent Roster (mirrors src/config/agents.json) ─────────────────────────────

const AGENT_ROSTER = [
  { id: "team-requirements-analyst", phase: "requirements", harnessName: "team_requirements_analyst" },
  { id: "team-frontend-designer", phase: "design", harnessName: "team_frontend_designer" },
  { id: "team-ios-designer", phase: "design", harnessName: "team_ios_designer" },
  { id: "team-backend-designer", phase: "design", harnessName: "team_backend_designer" },
  { id: "team-android-designer", phase: "design", harnessName: "team_android_designer" },
  { id: "team-security-reviewer", phase: "design", harnessName: "team_security_reviewer" },
  { id: "team-legal-compliance", phase: "design", harnessName: "team_legal_compliance" },
  { id: "team-localization", phase: "design", harnessName: "team_localization" },
  { id: "team-analytics-designer", phase: "design", harnessName: "team_analytics_designer" },
  { id: "team-backend-dev", phase: "development", harnessName: "team_backend_dev" },
  { id: "team-api-dev", phase: "development", harnessName: "team_api_dev" },
  { id: "team-frontend-dev", phase: "development", harnessName: "team_frontend_dev" },
  { id: "team-qa-verifier", phase: "verification", harnessName: "team_qa_verifier" },
  { id: "team-ci-agent", phase: "review", harnessName: "team_ci_agent" },
];

function getAgentDef(id) {
  return AGENT_ROSTER.find((a) => a.id === id);
}

// ─── DynamoDB Stream Handler ───────────────────────────────────────────────────

export const handler = async (event) => {
  console.log(`[orchestrator] Received ${event.Records.length} stream records`);

  for (const record of event.Records) {
    try {
      await processRecord(record);
    } catch (err) {
      console.error(`[orchestrator] Error processing record:`, err);
      // Don't throw — process remaining records
    }
  }
};

async function processRecord(record) {
  const eventName = record.eventName; // INSERT, MODIFY, REMOVE
  if (eventName === "REMOVE") return;

  const newImage = record.dynamodb?.NewImage;
  const oldImage = record.dynamodb?.OldImage;
  if (!newImage) return;

  const ticketId = unwrapDdbValue(newImage.ticketId);
  const newStatus = unwrapDdbValue(newImage.status);
  const oldStatus = oldImage ? unwrapDdbValue(oldImage.status) : null;

  // Skip counter item
  if (ticketId === "__COUNTER__") return;

  // Only react to status changes (or new inserts with actionable status)
  if (eventName === "MODIFY" && newStatus === oldStatus) return;

  console.log(`[orchestrator] ${ticketId}: ${oldStatus || "NEW"} → ${newStatus}`);

  switch (newStatus) {
    case "done":
      await handleTicketDone(ticketId, newImage);
      break;
    case "ready":
    case "todo":
      // "todo" with no blockers = ready to invoke
      const blockedBy = unwrapDdbValue(newImage.blockedBy) || [];
      if (blockedBy.length === 0) {
        await handleTicketReady(ticketId, newImage);
      }
      break;
    case "in_progress":
      const startedAssignee = unwrapDdbValue(newImage.assignee);
      await publishEvent(ticketId, "agent.started", { ticketId, assignee: startedAssignee, agentId: startedAssignee });
      break;
  }
}

// ─── Core Handlers ─────────────────────────────────────────────────────────────

/**
 * A ticket was marked "done". Unblock dependents, check QA gate, check completion.
 */
async function handleTicketDone(ticketId, image) {
  const parentId = unwrapDdbValue(image.parentId);
  const workflowId = unwrapDdbValue(image.workflowId);
  const assignee = unwrapDdbValue(image.assignee);

  if (!parentId) {
    console.log(`[orchestrator] ${ticketId} has no parent — likely an epic. Skipping cascade.`);
    return;
  }

  // Get the workflow metadata (resilient to bad workflowId from agent-created tickets)
  const workflow = await resolveWorkflow(workflowId, parentId);
  if (!workflow) {
    console.warn(`[orchestrator] No workflow found for ${ticketId} (parent: ${parentId}, wf: ${workflowId})`);
    return;
  }

  // Update agent task status in workflow metadata (keyed by ticketId)
  if (ticketId && workflow.agentTasks?.[ticketId]) {
    workflow.agentTasks[ticketId].status = "complete";
    workflow.agentTasks[ticketId].completedAt = new Date().toISOString();
    await saveWorkflow(workflow);
  }

  // Unblock dependents: find tickets blocked by this one
  const siblings = await getChildTickets(parentId);
  const unblocked = [];

  for (const sibling of siblings) {
    if (sibling.ticketId === ticketId) continue;
    const blockers = sibling.blockedBy || [];
    if (blockers.includes(ticketId)) {
      const remaining = blockers.filter((id) => id !== ticketId);
      if (remaining.length === 0) {
        // All blockers resolved — only unblock if still "blocked" (not already done/skipped)
        if (sibling.status === "blocked") {
          await ddb.send(new UpdateCommand({
            TableName: TICKETS_TABLE,
            Key: { ticketId: sibling.ticketId },
            UpdateExpression: "SET #s = :s, #bb = :bb, #u = :u",
            ExpressionAttributeNames: { "#s": "status", "#bb": "blockedBy", "#u": "updatedAt" },
            ExpressionAttributeValues: { ":s": "todo", ":bb": [], ":u": new Date().toISOString() },
          }));
          unblocked.push(sibling.ticketId);
        } else {
          // Ticket already done/in_progress — just clear the blockedBy array
          await ddb.send(new UpdateCommand({
            TableName: TICKETS_TABLE,
            Key: { ticketId: sibling.ticketId },
            UpdateExpression: "SET #bb = :bb, #u = :u",
            ExpressionAttributeNames: { "#bb": "blockedBy", "#u": "updatedAt" },
            ExpressionAttributeValues: { ":bb": [], ":u": new Date().toISOString() },
          }));
        }
      } else {
        // Still blocked by others — just remove this blocker
        await ddb.send(new UpdateCommand({
          TableName: TICKETS_TABLE,
          Key: { ticketId: sibling.ticketId },
          UpdateExpression: "SET #bb = :bb, #u = :u",
          ExpressionAttributeNames: { "#bb": "blockedBy", "#u": "updatedAt" },
          ExpressionAttributeValues: { ":bb": remaining, ":u": new Date().toISOString() },
        }));
      }
    }
  }

  console.log(`[orchestrator] ${ticketId} done. Unblocked: [${unblocked.join(", ")}]`);

  // Publish event for UI
  await publishEvent(ticketId, "agent.complete", { ticketId, assignee, agentId: assignee, unblocked, workflowId: workflow?.id });

  // Check if workflow is complete (all tickets done)
  if (unblocked.length === 0) {
    if (await isWorkflowComplete(parentId)) {
      await completeWorkflow(workflow);
    }
  }

  // Special case: fix ticket completed → re-run QA
  const title = unwrapDdbValue(image.title) || "";
  if (title.startsWith("Fix: QA findings")) {
    console.log(`[orchestrator] Fix ticket done. Re-triggering QA verification.`);
    await createQaVerificationTicket(workflow);
  }
}

/**
 * A ticket is ready (status=todo/ready, no blockers). Invoke the assigned agent.
 */
async function handleTicketReady(ticketId, image) {
  const assignee = unwrapDdbValue(image.assignee);
  const parentId = unwrapDdbValue(image.parentId);
  const workflowId = unwrapDdbValue(image.workflowId);
  const ticketType = unwrapDdbValue(image.type);

  if (!assignee || ticketType === "epic") return;

  const agentDef = getAgentDef(assignee);
  if (!agentDef) {
    console.warn(`[orchestrator] Unknown agent: ${assignee}`);
    return;
  }

  // Get workflow metadata (resilient to bad workflowId from agent-created tickets)
  const workflow = await resolveWorkflow(workflowId, parentId);
  if (!workflow) {
    console.warn(`[orchestrator] No workflow for ticket ${ticketId} (workflowId=${workflowId}, parent=${parentId})`);
    return;
  }

  // No concurrency guard — same agent can run multiple tickets in parallel.
  // Each ticket gets its own AgentCore Runtime session.

  // Ensure manifest exists (initializes on first agent invocation)
  try { await initManifestIfNeeded(workflow); } catch (err) {
    console.warn(`[orchestrator] Manifest init failed (non-fatal): ${err.message}`);
  }

  // Advance phase if needed
  const phaseOrder = ["intake", "requirements", "design", "development", "verification", "review", "complete"];
  const agentPhaseIdx = phaseOrder.indexOf(agentDef.phase);
  const currentPhaseIdx = phaseOrder.indexOf(workflow.phase);
  if (agentPhaseIdx > currentPhaseIdx) {
    workflow.phase = agentDef.phase;
    await publishEvent(ticketId, "workflow.phase_change", { phase: agentDef.phase, workflowId: workflow.id });

    // Create shared feature branch when entering development
    if (agentDef.phase === "development" && !workflow.featureBranch) {
      try {
        const { owner, repo } = parseRepoUrl(workflow.repoConfig);
        const baseBranch = workflow.repoConfig?.repos?.[0]?.defaultBranch || "main";
        const slug = workflow.input.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40).replace(/-$/, "");
        const branchName = `feature/${workflow.epicId}-${slug}`;
        await callGitHub("create_branch", { owner, repo, branch_name: branchName, from_branch: baseBranch });
        workflow.featureBranch = branchName;
        console.log(`[orchestrator] Created shared feature branch: ${branchName}`);
      } catch (err) {
        console.warn(`[orchestrator] Failed to create branch: ${err.message}`);
      }
    }
  }

  // Mark ticket in_progress (triggers stream event for UI)
  await ddb.send(new UpdateCommand({
    TableName: TICKETS_TABLE,
    Key: { ticketId },
    UpdateExpression: "SET #s = :s, #u = :u",
    ExpressionAttributeNames: { "#s": "status", "#u": "updatedAt" },
    ExpressionAttributeValues: { ":s": "in_progress", ":u": new Date().toISOString() },
  }));

  // Record agent task in workflow (keyed by ticketId to support multiple tickets per agent)
  const task = {
    id: `task_${Date.now()}_${assignee}`,
    agentId: assignee,
    ticketId,
    status: "running",
    startedAt: new Date().toISOString(),
  };
  if (!workflow.agentTasks) workflow.agentTasks = {};
  workflow.agentTasks[ticketId] = task;
  await saveWorkflow(workflow);

  // Build context and invoke agent
  const ticket = await getTicket(ticketId);
  const context = await buildAgentContext(ticket, workflow);

  console.log(`[orchestrator] Invoking agent ${assignee} for ticket ${ticketId}`);
  await publishEvent(ticketId, "agent.invoked", { ticketId, assignee, agentId: assignee, phase: agentDef.phase, workflowId: workflow.id });

  // Fire-and-forget: invoke agent via AgentCore Harness
  // The agent will call report_completion when done → writes "done" to DynamoDB → triggers this Lambda again
  await invokeAgent(agentDef, context, workflow);
}

// ─── QA Gate ───────────────────────────────────────────────────────────────────

async function shouldCreateQaTicket(epicId, workflow) {
  const children = await getChildTickets(epicId);

  // Check if QA ticket already exists (active OR done — never create more than one)
  const hasQaTicket = children.some(
    (t) => t.assignee === "team-qa-verifier" && t.status !== "blocked"
  );
  if (hasQaTicket) return false;

  // Check if all dev tickets are done
  const devTickets = children.filter(
    (t) => t.assignee && (t.assignee.includes("-dev") || t.assignee.includes("-frontend"))
  );
  if (devTickets.length === 0) return false;
  const allDevsDone = devTickets.every((t) => t.status === "done");
  if (!allDevsDone) return false;

  // Check if design tickets are done
  const designTickets = children.filter((t) => t.assignee && t.assignee.includes("-designer"));
  const allDesignDone = designTickets.every((t) => t.status === "done");

  return allDevsDone && allDesignDone;
}

async function isWorkflowComplete(epicId) {
  const children = await getChildTickets(epicId);
  if (children.length === 0) return false;
  // Must have at least one dev or QA ticket done (not just requirements/design)
  const hasDevOrQaDone = children.some((t) => {
    const assignee = t.assignee || "";
    const isDevOrQa = assignee.includes("-dev") || assignee.includes("-qa") || assignee.includes("-ci");
    return isDevOrQa && t.status === "done";
  });
  if (!hasDevOrQaDone) return false;
  return children.every((t) => t.status === "done");
}

async function createQaVerificationTicket(workflow) {
  console.log(`[orchestrator] All dev agents complete. Creating QA ticket...`);

  workflow.phase = "verification";
  await saveWorkflow(workflow);
  await publishEvent(workflow.epicId, "workflow.phase_change", { phase: "verification", workflowId: workflow.id });

  const children = await getChildTickets(workflow.epicId);
  const devTickets = children.filter((t) => t.assignee && t.assignee.includes("-dev"));
  const devSummaries = devTickets.map((t) => `- ${t.title} (${t.assignee}): ${t.status}`).join("\n");
  const inputSources = (workflow.input?.sources || []).map((s) => `- ${s.type}: ${s.value}`).join("\n");

  const qaDescription = `## QA Verification: ${workflow.input.title}

### What was built:
${devSummaries}

### Feature branch: \`${workflow.featureBranch || "unknown"}\`

### Original input/mockups:
${inputSources}

### Your job:
1. Build and run the app on the feature branch
2. Visually compare EVERY affected page against the original mockups
3. Run functional tests
4. Run regression tests
5. If all passes → report_completion
6. If anything fails → request_fix back to the dev agent with evidence`;

  // Create QA ticket (status=todo, no blockers → stream will fire handleTicketReady)
  const ticketId = await nextTicketId();
  await ddb.send(new PutCommand({
    TableName: TICKETS_TABLE,
    Item: {
      ticketId,
      type: "task",
      title: "QA: Visual & functional verification",
      description: qaDescription,
      status: "todo",
      assignee: "team-qa-verifier",
      parentId: workflow.epicId,
      workflowId: workflow.id,
      comments: [],
      artifacts: [],
      blockedBy: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  }));

  console.log(`[orchestrator] Created QA ticket ${ticketId}`);
}

async function completeWorkflow(workflow) {
  if (workflow.phase === "complete") return;
  console.log(`[orchestrator] Workflow ${workflow.id} complete!`);

  workflow.phase = "complete";
  workflow.completedAt = new Date().toISOString();

  // Create unified PR if feature branch exists
  let prUrl = "";
  if (workflow.featureBranch && workflow.repoConfig) {
    try {
      const { owner, repo } = parseRepoUrl(workflow.repoConfig);
      const baseBranch = workflow.repoConfig.repos?.[0]?.defaultBranch || "main";
      const prResult = await callGitHub("create_pr", {
        owner,
        repo,
        title: `feat: ${workflow.input.title} (${workflow.epicId})`,
        body: `Automated implementation by agentic team workflow (${workflow.epicId}).`,
        head: workflow.featureBranch,
        base: baseBranch,
      });
      prUrl = prResult?.html_url || "";
      console.log(`[orchestrator] Created PR: ${prUrl}`);
    } catch (err) {
      console.warn(`[orchestrator] PR creation failed: ${err.message}`);
    }
  }

  await saveWorkflow(workflow);
  await publishEvent(workflow.epicId, "workflow.complete", {
    workflowId: workflow.id,
    featureBranch: workflow.featureBranch,
    prUrl,
  });
}

// ─── Agent Invocation ──────────────────────────────────────────────────────────

/**
 * Discover harness ARN and invoke the agent.
 * Fire-and-forget: agent runs asynchronously. When done, it calls report_completion
 * which writes "done" to DynamoDB, triggering this Lambda again via the stream.
 */
async function invokeAgent(agentDef, context, workflow) {
  // Discover agent ARN — prefer Runtime (no timeout ceiling) over Harness (legacy)
  const runtimeEnvKey = `RUNTIME_ARN_AGENTIS_${agentDef.harnessName.replace(/^team_/, "").toUpperCase()}`;
  const harnessEnvKey = `HARNESS_ARN_${agentDef.harnessName.toUpperCase()}`;
  const harnessArn = process.env[runtimeEnvKey] || process.env[harnessEnvKey];
  if (!harnessArn) {
    console.error(`[orchestrator] No ARN for agent: ${agentDef.harnessName}. Tried ${runtimeEnvKey} and ${harnessEnvKey}. Marking ticket blocked.`);
    // Mark ticket blocked instead of silently returning — prevents stuck workflows
    const task = Object.values(workflow.agentTasks || {}).find(t => t.agentId === agentDef.id && t.status === "running");
    if (task?.ticketId) {
      await ddb.send(new UpdateCommand({
        TableName: TICKETS_TABLE,
        Key: { ticketId: task.ticketId },
        UpdateExpression: "SET #s = :s, #u = :u",
        ExpressionAttributeNames: { "#s": "status", "#u": "updatedAt" },
        ExpressionAttributeValues: { ":s": "blocked", ":u": new Date().toISOString() },
      }));
    }
    await publishEvent(workflow.epicId, "agent.error", {
      agentId: agentDef.id,
      workflowId: workflow.id,
      error: `No runtime ARN configured. Set ${runtimeEnvKey} env var on orchestrator Lambda.`,
    });
    return;
  }
  console.log(`[orchestrator] Using ${harnessArn.includes("/runtime/") ? "Runtime" : "Harness"} for ${agentDef.id}`);

  // Determine model override
  let modelConfig = undefined;
  if (workflow.input?.modelOverride) {
    let override = workflow.input.modelOverride;
    if (typeof override === "string") {
      const modelMap = {
        "claude-opus-47": "us.anthropic.claude-opus-4-7",
        "claude-opus-46": "us.anthropic.claude-opus-4-6-v1",
        "claude-sonnet-45": "us.anthropic.claude-sonnet-4-5-20250929-v1:0",
      };
      override = { bedrockModelConfig: { modelId: modelMap[override] || override } };
    }
    modelConfig = override;
  }

  try {
    // Use BedrockAgentRuntime InvokeAgent — fire and forget
    // The agent stream will run to completion. When done, the agent's report_completion
    // tool writes "done" status to DynamoDB, which triggers this Lambda via stream.
    const sessionId = `${workflow.id}-${agentDef.id}-${Date.now()}`;

    const command = new InvokeAgentCommand({
      agentAliasId: "TSTALIASID", // placeholder — real ARN used via agentId
      agentId: harnessArn.split("/").pop(),
      sessionId,
      inputText: context,
      ...(modelConfig?.bedrockModelConfig ? { bedrockModelArn: modelConfig.bedrockModelConfig.modelId } : {}),
    });

    // Note: In production, we'd use the AgentCore Harness SDK's invokeHarnessAgent
    // For now, invoke as a separate async Lambda that handles the streaming
    await lambda.send(new InvokeCommand({
      FunctionName: "agentis-agent-invoker",
      InvocationType: "Event", // async — don't wait for response
      Payload: JSON.stringify({
        harnessArn,
        sessionId,
        prompt: context,
        workflowId: workflow.id,
        agentId: agentDef.id,
        modelOverride: modelConfig,
      }),
    }));

    console.log(`[orchestrator] Async invoke sent for ${agentDef.id} (session: ${sessionId})`);
  } catch (err) {
    console.error(`[orchestrator] Failed to invoke ${agentDef.id}:`, err);
    // Mark ticket as blocked
    const task = workflow.agentTasks?.[agentDef.id];
    if (task) {
      await ddb.send(new UpdateCommand({
        TableName: TICKETS_TABLE,
        Key: { ticketId: task.ticketId },
        UpdateExpression: "SET #s = :s, #u = :u",
        ExpressionAttributeNames: { "#s": "status", "#u": "updatedAt" },
        ExpressionAttributeValues: { ":s": "blocked", ":u": new Date().toISOString() },
      }));
    }
  }
}

// ─── Context Builder ───────────────────────────────────────────────────────────

async function buildAgentContext(ticket, workflow) {
  let context = `# Your Assignment: ${ticket.title}\n\n`;
  context += `## Ticket\nID: ${ticket.ticketId}\nDescription: ${ticket.description}\n\n`;

  // Workflow context (epic ID, workflow ID, ticket ID)
  context += `## Workflow Context\nworkflow_id: ${workflow.id}\nepic_id: ${workflow.epicId}\nticket_id: ${ticket.ticketId}\n\n`;

  // For requirements agent: inject ticket creation context
  if (ticket.assignee === "team-requirements-analyst") {
    context += `## Ticket Creation Instructions\nYou are responsible for creating tickets for all agents that need to work on this feature.\nUse JiraIntegration___create_ticket with:\n- parent_id: "${workflow.epicId}"\n- workflow_id: "${workflow.id}"\n- blocked_by: comma-separated ticket IDs for dependencies\n- assignee: agent ID from the roster (e.g., "team-frontend-dev")\n\nYour own ticket_id: "${ticket.ticketId}" — transition it to "done" when finished.\n\n`;
  }

  // Requirements artifact (from epic)
  try {
    const epic = await getTicket(workflow.epicId);
    const reqArtifact = (epic?.artifacts || []).find((a) => a.type === "requirements");
    if (reqArtifact) {
      context += `## Requirements\n${reqArtifact.content}\n\n`;
    }
  } catch { /* no requirements yet */ }

  // Repo context for all agents
  if (workflow.repoConfig?.repos?.length > 0) {
    const { owner, repo } = parseRepoUrl(workflow.repoConfig);
    const defaultBranch = workflow.repoConfig.repos[0]?.defaultBranch || "main";
    context += `## GitHub Repository Context\n`;
    context += `You have a "github" MCP tool with full repo access. Use these values:\n`;
    context += `- owner: "${owner}"\n- repo: "${repo}"\n- default branch: "${defaultBranch}"\n`;
    context += `Available tools: github_get_file_contents, github_search_code, github_list_branches, github_create_branch, github_create_or_update_file, github_create_pull_request, github_list_commits, github_list_issues, github_create_issue, github_get_pull_request\n\n`;
  }

  // S3 workspace paths
  const agentDef = getAgentDef(ticket.assignee);
  context += `## S3 Workflow Artifacts\n`;
  context += `- Shared artifacts: workflows/${workflow.id}/shared/\n`;
  context += `- Your agent workspace: workflows/${workflow.id}/agents/${ticket.assignee}/\n\n`;

  // Workflow manifest — upstream artifacts, canonical repo, PR/branch info
  try {
    const manifest = await readManifest(workflow.id);
    if (manifest) {
      context += buildManifestContext(manifest, agentDef?.phase || "development", workflow, ticket);
    }
  } catch { /* manifest read failed — non-fatal */ }

  // Dev agents: branch info and design artifacts
  if (agentDef?.phase === "development") {
    const baseBranch = workflow.featureBranch || workflow.repoConfig?.repos?.[0]?.defaultBranch || "main";
    context += `## Repository\n`;
    context += `Branch name: feature/${ticket.ticketId}-${agentDef.id.replace("team-", "")}\n`;
    context += `Base branch (fork FROM this): ${baseBranch}\n`;
    context += `IMPORTANT: When calling github_create_branch, use from_branch: "${baseBranch}" — do NOT fork from main directly.\n\n`;

    // Include design artifacts from S3
    try {
      const designDoc = await readS3Artifact(workflow.id, "shared/output.md");
      if (designDoc) {
        context += `## Design Artifacts\n${designDoc.slice(0, 8000)}\n\n`;
      }
    } catch { /* no design docs yet */ }
  }

  // Intake context (for requirements agent)
  if (agentDef?.phase === "requirements" && workflow.input) {
    context += `## Feature Request\nTitle: ${workflow.input.title}\nDescription: ${workflow.input.description}\n\n`;
    if (workflow.input.sources?.length > 0) {
      context += `## Input Sources\n`;
      for (const src of workflow.input.sources) {
        context += `- [${src.type}] ${src.label || src.value}\n`;
      }
      context += "\n";
    }
  }

  return context;
}

// ─── DynamoDB Helpers ──────────────────────────────────────────────────────────

async function getWorkflow(id) {
  if (!id || typeof id !== "string") return null;
  const result = await ddb.send(new GetCommand({ TableName: WORKFLOWS_TABLE, Key: { workflowId: id } }));
  return result.Item || null;
}

/**
 * Resolve workflow for a ticket — handles cases where workflowId is missing/invalid.
 * Falls back to looking up the parent epic's workflowId.
 */
async function resolveWorkflow(workflowId, parentId) {
  // Try direct lookup if workflowId is a valid string
  if (typeof workflowId === "string" && workflowId.startsWith("wf_")) {
    const wf = await getWorkflow(workflowId);
    if (wf) return wf;
  }

  // Fallback: look up the parent (epic) ticket to get the workflowId
  if (parentId) {
    const parent = await getTicket(parentId);
    if (parent && typeof parent.workflowId === "string" && parent.workflowId.startsWith("wf_")) {
      return await getWorkflow(parent.workflowId);
    }
    // If parent itself has a parentId, go one level up (task → story → epic)
    if (parent && parent.parentId) {
      const grandparent = await getTicket(parent.parentId);
      if (grandparent && typeof grandparent.workflowId === "string") {
        return await getWorkflow(grandparent.workflowId);
      }
    }
  }

  return null;
}

async function saveWorkflow(workflow) {
  await ddb.send(new PutCommand({ TableName: WORKFLOWS_TABLE, Item: { ...workflow, workflowId: workflow.id } }));
}

async function getTicket(ticketId) {
  const result = await ddb.send(new GetCommand({ TableName: TICKETS_TABLE, Key: { ticketId } }));
  return result.Item || null;
}

async function getChildTickets(parentId) {
  const result = await ddb.send(new QueryCommand({
    TableName: TICKETS_TABLE,
    IndexName: "parentId-index",
    KeyConditionExpression: "parentId = :pid",
    ExpressionAttributeValues: { ":pid": parentId },
  }));
  return result.Items || [];
}

async function nextTicketId() {
  const projectKey = process.env.PROJECT_KEY || "TEAM";
  const result = await ddb.send(new UpdateCommand({
    TableName: TICKETS_TABLE,
    Key: { ticketId: "__COUNTER__" },
    UpdateExpression: "SET #n = if_not_exists(#n, :zero) + :one",
    ExpressionAttributeNames: { "#n": "nextNum" },
    ExpressionAttributeValues: { ":zero": 0, ":one": 1 },
    ReturnValues: "UPDATED_NEW",
  }));
  return `${projectKey}-${result.Attributes.nextNum}`;
}

// ─── S3 Helpers ────────────────────────────────────────────────────────────────

async function readS3Artifact(workflowId, path) {
  if (!ARTIFACT_BUCKET) return null;
  try {
    const result = await s3.send(new GetObjectCommand({
      Bucket: ARTIFACT_BUCKET,
      Key: `workflows/${workflowId}/${path}`,
    }));
    return await result.Body.transformToString();
  } catch {
    return null;
  }
}

// ─── Manifest Helpers ──────────────────────────────────────────────────────────

async function readManifest(workflowId) {
  const raw = await readS3Artifact(workflowId, "shared/manifest.json");
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

async function initManifestIfNeeded(workflow) {
  if (!ARTIFACT_BUCKET) return;
  const existing = await readManifest(workflow.id);
  if (existing) return; // Already initialized

  const manifest = {
    workflowId: workflow.id,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    repoConfig: workflow.repoConfig,
    phases: { intake: [], requirements: [], design: [], development: [], verification: [] },
  };

  // Seed intake entries from workflow input sources (if any)
  if (workflow.input?.sources?.length > 0) {
    manifest.phases.intake = workflow.input.sources
      .filter(s => s.s3Key)
      .map((src, i) => ({
        id: `intake-${i}-${Date.now().toString(36)}`,
        type: "source",
        format: src.contentType?.includes("html") ? "html" : "text",
        description: src.label || src.value || `Source ${i}`,
        s3Key: src.s3Key,
        addedBy: "intake-processor",
        addedAt: manifest.createdAt,
        critical: true,
      }));
  }

  await s3.send(new PutObjectCommand({
    Bucket: ARTIFACT_BUCKET,
    Key: `workflows/${workflow.id}/shared/manifest.json`,
    Body: JSON.stringify(manifest, null, 2),
    ContentType: "application/json",
  }));
  console.log(`[orchestrator] Initialized manifest for ${workflow.id}`);
}

function buildManifestContext(manifest, agentPhase, workflow, ticket) {
  if (!manifest) return "";

  const phaseOrder = ["intake", "requirements", "design", "development", "verification"];
  const currentIdx = phaseOrder.indexOf(agentPhase);
  if (currentIdx < 0) return "";

  let ctx = `## Workflow Manifest — Upstream Artifacts\n\n`;

  // Canonical repo info from manifest (single source of truth)
  if (manifest.repoConfig?.repos?.length > 0) {
    const url = manifest.repoConfig.repos[0].url || "";
    const match = url.match(/github\.com[:/]([^/]+)\/([^/.]+)/);
    if (match) {
      ctx += `### Repository (CANONICAL — use these values for ALL GitHub operations)\n`;
      ctx += `- owner: "${match[1]}"\n- repo: "${match[2]}"\n`;
      ctx += `- default_branch: "${manifest.repoConfig.repos[0].defaultBranch || "main"}"\n\n`;
    }
  }

  // List upstream artifacts by phase
  for (const phase of phaseOrder) {
    if (phaseOrder.indexOf(phase) >= currentIdx) break;
    const entries = manifest.phases?.[phase] || [];
    if (entries.length === 0) continue;

    ctx += `### ${phase.charAt(0).toUpperCase() + phase.slice(1)} Phase Outputs\n`;
    for (const entry of entries) {
      const tag = entry.critical ? "★ " : "";
      ctx += `- ${tag}${entry.description}`;
      if (entry.s3Key) ctx += ` → s3://${ARTIFACT_BUCKET}/${entry.s3Key}`;
      ctx += `\n`;
    }
    ctx += `\n`;
  }

  // For QA/CI agents: inject upstream dev agent PR/branch info directly
  if (agentPhase === "verification" || agentPhase === "review") {
    const devEntries = manifest.phases?.development || [];
    const prEntries = devEntries.filter(e => e.description?.includes("Pull Request"));
    const branchEntries = devEntries.filter(e => e.description?.includes("Branch:"));
    if (prEntries.length > 0 || branchEntries.length > 0) {
      ctx += `### Code to Review (from Development Phase)\n`;
      ctx += `IMPORTANT: Review the code on these branches/PRs. Do NOT search for other repos or branches.\n`;
      for (const e of prEntries) ctx += `- ${e.description}\n`;
      for (const e of branchEntries) ctx += `- ${e.description}\n`;
      ctx += `\n`;
    }
  }

  return ctx;
}

// ─── GitHub Lambda Helper ──────────────────────────────────────────────────────

async function callGitHub(toolName, args) {
  const result = await lambda.send(new InvokeCommand({
    FunctionName: GITHUB_LAMBDA,
    Payload: JSON.stringify({ name: toolName, arguments: args }),
  }));
  const payload = JSON.parse(new TextDecoder().decode(result.Payload));
  if (payload.content?.[0]?.text) {
    return JSON.parse(payload.content[0].text);
  }
  return payload;
}

// ─── EventBridge Publishing ────────────────────────────────────────────────────

async function publishEvent(ticketId, detailType, detail) {
  try {
    await events.send(new PutEventsCommand({
      Entries: [{
        Source: "agentis.orchestrator",
        DetailType: detailType,
        Detail: JSON.stringify({ ...detail, ticketId, timestamp: new Date().toISOString() }),
        EventBusName: EVENT_BUS,
      }],
    }));
  } catch (err) {
    console.warn(`[orchestrator] Failed to publish event:`, err.message);
  }

  // Also write to events table for dashboard polling
  if (EVENTS_TABLE) {
    try {
      await ddb.send(new PutCommand({
        TableName: EVENTS_TABLE,
        Item: {
          workflowId: detail.workflowId || ticketId,
          eventId: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          type: detailType,
          detail,
          timestamp: new Date().toISOString(),
        },
      }));
    } catch { /* non-fatal */ }
  }
}

// ─── Utilities ─────────────────────────────────────────────────────────────────

function parseRepoUrl(repoConfig) {
  const url = repoConfig?.repos?.[0]?.url || "";
  const match = url.match(/github\.com[:/]([^/]+)\/([^/.]+)/);
  return match ? { owner: match[1], repo: match[2] } : { owner: "", repo: "" };
}

/**
 * Unwrap DynamoDB AttributeValue from stream format.
 * Stream records use {"S": "value"}, {"N": "123"}, {"L": [...]}, etc.
 */
function unwrapDdbValue(attr) {
  if (!attr) return undefined;
  if (attr.S !== undefined) return attr.S;
  if (attr.N !== undefined) return Number(attr.N);
  if (attr.BOOL !== undefined) return attr.BOOL;
  if (attr.NULL) return null;
  if (attr.L) return attr.L.map(unwrapDdbValue);
  if (attr.M) {
    const obj = {};
    for (const [k, v] of Object.entries(attr.M)) {
      obj[k] = unwrapDdbValue(v);
    }
    return obj;
  }
  // Already unwrapped (e.g., from DocumentClient format)
  if (typeof attr === "string" || typeof attr === "number" || typeof attr === "boolean") return attr;
  if (Array.isArray(attr)) return attr;
  return attr;
}
