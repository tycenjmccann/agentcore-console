/**
 * Orchestration Engine — Ticket-Driven Workflow
 *
 * The engine is a lightweight ticket watcher:
 * - When a ticket status flips to "ready", invoke the assigned agent
 * - When an agent completes, mark ticket "done" → downstream tickets may unblock
 * - The requirements agent decides which tickets to create (selective involvement)
 */

import type {
  WorkflowState,
  WorkflowInput,
  WorkflowPhase,
  AgentTask,
  AgentMessage,
  JiraTicket,
} from "./types";
import {
  getWorkflow,
  setWorkflow,
  getTicket,
  setTicket,
  getReadyTickets,
  emitEvent,
  persistWorkflow,
  findWorkflowByTicket,
} from "./store";
import { getTicketProvider } from "./ticket-provider";
import type { TicketProvider } from "./ticket-provider";
import { getAgentDef, AGENT_ROSTER } from "./agents";

// Convenience: get the ticket provider (lazy singleton)
function tickets(): TicketProvider {
  return getTicketProvider();
}
import { generateSessionId } from "./session";
import { invokeHarnessAgent, discoverAgents } from "@/lib/agentcore-sdk";
import { processIntakeSources, buildRequirementsContext } from "./intake";
import { provisionWorkspace, startCodeInterpreterSession, stopCodeInterpreterSession, writeArtifact, readArtifact, listArtifacts } from "./workspace";
import { getCodeSearchProvider } from "./code-search-provider";

const DEFAULT_REGION = process.env.AWS_REGION || "us-east-1";
const ARTIFACT_BUCKET = process.env.TEAM_WORKFLOW_S3_BUCKET || "agentcore-artifacts-023392223961-us-east-1";

/**
 * Read the ticket plan from S3 (written by the requirements agent via WorkflowOutput tool).
 */
async function readTicketPlanFromS3(workflowId: string): Promise<TicketPlan | null> {
  try {
    const content = await readArtifact({
      workflowId,
      agentId: "shared",
      filename: "ticket-plan.json",
    });
    if (!content) return null;
    const parsed = JSON.parse(content);
    if (parsed.tickets && Array.isArray(parsed.tickets)) {
      return {
        requirements: parsed.requirements || "",
        tickets: parsed.tickets.map((t: Record<string, unknown>) => ({
          title: t.title || "Untitled",
          description: t.description || "",
          assignee: t.assignee || "team-frontend-dev",
          blockedBy: Array.isArray(t.blockedBy) ? t.blockedBy : [],
        })),
      };
    }
    return null;
  } catch {
    return null;
  }
}

// ─── Engine Entry Point ──────────────────────────────────────────────────────

/**
 * Start a new workflow. Creates the epic, processes intake, invokes requirements agent.
 */
export async function startWorkflow(input: WorkflowInput): Promise<string> {
  const workflowId = `wf_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  // Create the epic
  const epic = await tickets().createEpic({
    title: input.title,
    description: input.description,
  });

  // Initialize workflow state
  const state: WorkflowState = {
    id: workflowId,
    phase: "intake",
    epicId: epic.id,
    repoConfig: input.repoConfig,
    input,
    agentTasks: {},
    messages: [],
    humanNotifications: [],
    startedAt: new Date().toISOString(),
  };
  setWorkflow(state);

  emitEvent(workflowId, { type: "phase_change", phase: "intake" });

  // Kick off the pipeline asynchronously (don't block the HTTP response)
  processIntakeAndStart(workflowId, input, epic.id).catch((err) => {
    console.error(`Workflow ${workflowId} failed:`, err);
    const ws = getWorkflow(workflowId);
    if (ws) {
      ws.phase = "error";
      ws.error = (err as Error).message;
      setWorkflow(ws);
      emitEvent(workflowId, { type: "error", error: (err as Error).message });
    }
  });

  return workflowId;
}

// ─── Internal Pipeline ───────────────────────────────────────────────────────

async function processIntakeAndStart(
  workflowId: string,
  input: WorkflowInput,
  epicId: string
): Promise<void> {
  const state = getWorkflow(workflowId)!;

  // Process intake sources (fetch URLs, read S3, etc.)
  let processedSources: Awaited<ReturnType<typeof processIntakeSources>> = [];
  if (input.sources.length > 0) {
    try {
      processedSources = await processIntakeSources(workflowId, input.sources);
    } catch (err) {
      console.warn("Intake processing partial failure:", err);
    }
  }

  // Phase: Requirements
  state.phase = "requirements";
  setWorkflow(state);
  emitEvent(workflowId, { type: "phase_change", phase: "requirements" });

  // Build intake context for requirements agent (uses processed sources)
  let intakeContext = processedSources.length > 0
    ? buildRequirementsContext(input, processedSources)
    : buildIntakeContext(input);

  // Inject workflow_id so the agent can use it in tool calls
  intakeContext += `\n\n## Workflow Context\nworkflow_id: ${workflowId}\n`;

  // Multimodal: prepend image download instructions for the requirements agent
  const imageInstructions = await getImageStagingInstructions(workflowId);
  if (imageInstructions) {
    intakeContext = imageInstructions + intakeContext;
  }

  // Invoke requirements agent (fire-and-forget)
  const reqAgent = getAgentDef("team-requirements-analyst")!;
  const reqSessionId = generateSessionId(epicId, reqAgent.id);

  const reqTask: AgentTask = {
    id: `task_${Date.now()}`,
    agentId: reqAgent.id,
    ticketId: epicId,
    status: "running",
    input: intakeContext,
    startedAt: new Date().toISOString(),
  };
  state.agentTasks[reqAgent.id] = reqTask;
  setWorkflow(state);

  await tickets().markInProgress(epicId, workflowId);
  emitEvent(workflowId, { type: "agent_status", agentId: reqAgent.id, status: "running", ticketId: epicId });

  // Fire-and-forget: invoke requirements agent in background
  invokeRequirementsAgentBackground(workflowId, epicId, reqAgent, reqSessionId, intakeContext)
    .catch((err) => console.error(`[engine] Requirements agent background error:`, err));
}

/**
 * Background invocation for the requirements agent.
 * Same deterministic model: stream end = done, then check S3 for ticket plan.
 */
async function invokeRequirementsAgentBackground(
  workflowId: string,
  epicId: string,
  reqAgent: { id: string; harnessName: string; name: string; phase: string },
  sessionId: string,
  context: string
): Promise<void> {
  const state = getWorkflow(workflowId);
  if (!state) return;
  const reqTask = state.agentTasks[reqAgent.id];
  if (!reqTask) return;

  try {
    // Await stream — when this returns, agent is definitively done
    const reqOutput = await invokeAgentWithRetry(reqAgent.harnessName, sessionId, context, workflowId, reqAgent.id);

    // Check if webhook already completed this
    const currentState = getWorkflow(workflowId);
    const currentTask = currentState?.agentTasks[reqAgent.id];
    if (currentTask?.status === "complete") {
      console.log(`[engine] Requirements agent already completed via webhook before stream ended`);
      return;
    }

    // Stream ended = agent is done. Trigger requirements completion.
    console.log(`[engine] Requirements agent stream ended — processing ticket plan`);
    await handleRequirementsCompletion(workflowId, epicId, reqOutput);
  } catch (err) {
    reqTask.status = "error";
    reqTask.error = (err as Error).message;
    reqTask.completedAt = new Date().toISOString();
    setWorkflow(state);
    persistWorkflow(workflowId);
    emitEvent(workflowId, { type: "error", agentId: reqAgent.id, error: (err as Error).message });
    await tickets().markBlocked(epicId, (err as Error).message, workflowId);
  }
}

/**
 * Handle requirements agent completion — reads ticket plan, creates child tickets,
 * advances workflow phase, and kicks off the ticket-driven loop.
 *
 * Called by handleAgentCompletion (for requirements agent specifically) or by fallback.
 */
export async function handleRequirementsCompletion(
  workflowId: string,
  epicId: string,
  output: string
): Promise<void> {
  const state = getWorkflow(workflowId);
  if (!state) return;

  const reqAgent = getAgentDef("team-requirements-analyst")!;
  const reqTask = state.agentTasks[reqAgent.id];

  // Mark task complete
  if (reqTask && reqTask.status !== "complete") {
    reqTask.status = "complete";
    reqTask.output = output;
    reqTask.completedAt = new Date().toISOString();
    setWorkflow(state);
  }

  emitEvent(workflowId, { type: "agent_complete", agentId: reqAgent.id, output });

  // Read ticket plan from S3 (agent should have called submit_ticket_plan tool)
  // Falls back to parsing text response if S3 artifact not found
  const ticketPlan = await readTicketPlanFromS3(workflowId) || parseRequirementsOutput(output);
  await tickets().markDone(epicId, workflowId);

  // Store requirements as artifact
  await tickets().addArtifact(epicId, {
    type: "requirements",
    title: "Requirements Document",
    content: ticketPlan.requirements,
    producedBy: reqAgent.id,
  });

  // Create child tickets based on requirements agent's plan
  await createTicketsFromPlan(ticketPlan, epicId, workflowId);

  // Transition to design/development phases — driven by ticket readiness
  state.phase = "design";
  setWorkflow(state);
  persistWorkflow(workflowId);
  emitEvent(workflowId, { type: "phase_change", phase: "design" });

  // Process ready tickets (this kicks off the ticket-driven loop)
  await processReadyTickets(workflowId, epicId);
}

/**
 * The core ticket-driven loop. Finds all "ready" tickets and invokes their assigned agents.
 * Called whenever tickets may have become ready (after creation, after markDone).
 */
export async function processReadyTickets(workflowId: string, epicId: string): Promise<void> {
  const state = getWorkflow(workflowId);
  if (!state) return;

  const readyTickets = getReadyTickets(epicId);
  if (readyTickets.length === 0) {
    // Check if workflow is complete
    if (await tickets().isWorkflowComplete(epicId)) {
      await completeWorkflow(workflowId);
    }
    return;
  }

  // Determine current phase from ready tickets
  const phases = readyTickets.map((t) => {
    const agent = t.assignee ? getAgentDef(t.assignee) : undefined;
    return agent?.phase;
  });
  if (phases.includes("development") && state.phase === "design") {
    state.phase = "development";
    setWorkflow(state);
    emitEvent(workflowId, { type: "phase_change", phase: "development" });
  }

  // Invoke all ready tickets in parallel
  const invocations = readyTickets
    .filter((t) => t.assignee && t.type !== "epic")
    .map((ticket) => invokeAgentForTicket(workflowId, epicId, ticket));

  await Promise.allSettled(invocations);
}

/**
 * Invoke the agent assigned to a ticket (fire-and-forget).
 * The agent runs in the background. Completion is signaled by:
 * 1. Agent calling report_completion tool → Lambda → webhook → handleAgentCompletion
 * 2. Jira webhook (ticket transitioned to Done) → handleAgentCompletion
 * 3. Fallback: stream ends without webhook → timeout → handleAgentCompletion
 */
async function invokeAgentForTicket(
  workflowId: string,
  epicId: string,
  ticket: JiraTicket
): Promise<void> {
  const state = getWorkflow(workflowId);
  if (!state || !ticket.assignee) return;

  const agentDef = getAgentDef(ticket.assignee);
  if (!agentDef) {
    await tickets().markBlocked(ticket.id, `Agent ${ticket.assignee} not found`, workflowId);
    return;
  }

  const sessionId = generateSessionId(ticket.id, agentDef.id);

  // Provision workspace for the agent
  provisionWorkspace(workflowId, agentDef.id);

  // Start Code Interpreter for dev agents
  if (agentDef.phase === "development") {
    await startCodeInterpreterSession(workflowId, agentDef.id);
  }

  // Build context for the agent (async — reads design artifacts from S3 for dev agents)
  const context = await buildAgentContext(ticket, state);

  const task: AgentTask = {
    id: `task_${Date.now()}_${agentDef.id}`,
    agentId: agentDef.id,
    ticketId: ticket.id,
    status: "running",
    input: context,
    startedAt: new Date().toISOString(),
  };
  state.agentTasks[agentDef.id] = task;
  setWorkflow(state);

  await tickets().markInProgress(ticket.id, workflowId);
  emitEvent(workflowId, { type: "agent_status", agentId: agentDef.id, status: "running", ticketId: ticket.id });

  // Multimodal: Prepend image viewing instructions for requirements/design agents
  let agentContext = context;
  if (agentDef.phase === "requirements" || agentDef.phase === "design") {
    const imageInstructions = await getImageStagingInstructions(workflowId);
    if (imageInstructions) {
      agentContext = imageInstructions + agentContext;
    }
  }

  // Fire-and-forget: invoke agent in background, consume stream for SSE relay
  invokeAgentBackground(workflowId, epicId, agentDef, ticket, sessionId, agentContext)
    .catch((err) => console.error(`[engine] Background invoke error for ${agentDef.id}:`, err));
}

/**
 * Background agent invocation — consumes stream for real-time SSE.
 *
 * Completion model (no fallbacks, deterministic signals only):
 *
 * PRIMARY signal: Stream ends → agent is done (microVM stopped, nothing more coming).
 * This is infrastructure-level truth, not an LLM decision.
 *
 * ENRICHMENT signal: If the agent called report_completion via the Gateway tool,
 * its structured output (branch, PR URL, summary) will be in S3. We read it
 * after stream ends to get richer metadata. If it's not there, we still complete
 * — we just have less structured data (raw stream text only).
 *
 * EXTERNAL signal: Jira webhook (ticket → Done). This handles cases where
 * a human closes the ticket externally. The webhook route calls handleAgentCompletion
 * independently — same idempotency guard prevents double-processing.
 */
async function invokeAgentBackground(
  workflowId: string,
  epicId: string,
  agentDef: { id: string; harnessName: string; name: string; phase: string },
  ticket: JiraTicket,
  sessionId: string,
  agentContext: string
): Promise<void> {
  const state = getWorkflow(workflowId);
  if (!state) return;
  const task = state.agentTasks[agentDef.id];
  if (!task) return;

  try {
    // This awaits the full stream — when it returns, the agent is definitively done
    const output = await invokeAgentWithRetry(agentDef.harnessName, sessionId, agentContext, workflowId, agentDef.id);

    // Check if webhook already completed this (race: agent called report_completion
    // mid-stream, Lambda webhook arrived before stream fully drained)
    const currentState = getWorkflow(workflowId);
    const currentTask = currentState?.agentTasks[agentDef.id];
    if (currentTask?.status === "complete") {
      console.log(`[engine] Agent ${agentDef.id} already completed via webhook before stream ended`);
      return;
    }

    // Stream ended = agent is done. Now check S3 for structured completion data
    // (the agent may have called report_completion, which saves metadata to S3)
    let completionPayload: CompletionPayload = { output, source: "stream" as CompletionPayload["source"] };
    try {
      const reportContent = await readArtifact({
        workflowId,
        agentId: agentDef.id,
        filename: "completion-report.json",
      });
      if (reportContent) {
        const report = JSON.parse(reportContent);
        completionPayload = {
          output,
          summary: report.summary,
          branch: report.branch,
          commitSha: report.commit_sha,
          prUrl: report.pr_url,
          artifacts: report.artifacts,
          source: "stream" as CompletionPayload["source"],
        };
        console.log(`[engine] Agent ${agentDef.id} stream ended — found completion report in S3`);
      } else {
        console.log(`[engine] Agent ${agentDef.id} stream ended — no completion report, using stream output`);
      }
    } catch {
      // No completion report in S3 — that's fine, agent just didn't call the tool
    }

    // Complete the agent
    await handleAgentCompletion(workflowId, agentDef.id, completionPayload);
  } catch (err) {
    task.status = "error";
    task.error = (err as Error).message;
    task.completedAt = new Date().toISOString();
    setWorkflow(state);
    persistWorkflow(workflowId);
    emitEvent(workflowId, { type: "error", agentId: agentDef.id, error: (err as Error).message });
    await tickets().markBlocked(ticket.id, (err as Error).message, workflowId);
  }
}

// ─── Event-Driven Completion Handler ────────────────────────────────────────

export interface CompletionPayload {
  output?: string;
  summary?: string;
  branch?: string;
  commitSha?: string;
  prUrl?: string;
  artifacts?: Array<{ name: string; type: string }>;
  source?: "stream" | "webhook" | "jira_webhook";
}

/**
 * Handle agent completion — called by:
 * 1. Webhook route (agent called report_completion → Lambda → POST /api/workflow/webhook)
 * 2. Jira webhook (ticket transitioned to Done externally)
 * 3. Fallback (stream ended, no webhook within timeout)
 *
 * This is the single place that drives the workflow forward after an agent finishes.
 */
export async function handleAgentCompletion(
  workflowId: string,
  agentId: string,
  payload: CompletionPayload
): Promise<{ success: boolean; error?: string }> {
  const state = getWorkflow(workflowId);
  if (!state) {
    return { success: false, error: `Workflow ${workflowId} not found` };
  }

  const task = state.agentTasks[agentId];
  if (!task) {
    // Race condition: webhook arrived before task was written to state
    // Wait briefly and retry
    await new Promise((r) => setTimeout(r, 500));
    const retryState = getWorkflow(workflowId);
    const retryTask = retryState?.agentTasks[agentId];
    if (!retryTask) {
      return { success: false, error: `Task for agent ${agentId} not found in workflow ${workflowId}` };
    }
    return handleAgentCompletion(workflowId, agentId, payload);
  }

  // Idempotency: if already complete, skip
  if (task.status === "complete") {
    return { success: true };
  }

  const agentDef = getAgentDef(agentId);
  if (!agentDef) {
    return { success: false, error: `Agent definition not found: ${agentId}` };
  }

  // Resolve output — prefer the stream-captured output, then webhook payload
  const output = task.output || payload.output || payload.summary || "";

  // Update task
  task.status = "complete";
  task.output = output;
  task.completedAt = new Date().toISOString();

  // Extract branch/commit info
  if (payload.branch) task.branch = payload.branch;
  if (payload.commitSha) task.commitSha = payload.commitSha;

  // For dev agents: extract from output text if not in payload
  if (agentDef.phase === "development" && !task.branch && output) {
    const branchMatch = output.match(/branch[:\s]+`?(feature\/[^\s`"',]+|[a-z][\w.-]+\/[^\s`"',]+)`?/i)
      || output.match(/pushed to[:\s]+`?([^\s`"',]+\/[^\s`"',]+)`?/i)
      || output.match(/`(feature\/[^\s`"',]+)`/i);
    const shaMatch = output.match(/commit[:\s]+`?([a-f0-9]{7,40})`?/i)
      || output.match(/`([a-f0-9]{40})`/);
    if (branchMatch) task.branch = branchMatch[1];
    if (shaMatch) task.commitSha = shaMatch[1];
    if (!task.branch) {
      task.branch = `feature/${task.ticketId}-${agentDef.id.replace("team-", "")}`;
    }
  }

  setWorkflow(state);
  emitEvent(workflowId, {
    type: "agent_complete",
    agentId: agentDef.id,
    output,
    branch: task.branch,
    commitSha: task.commitSha,
  });

  // Store output as artifact (ticket system + S3)
  try {
    await tickets().addArtifact(task.ticketId, {
      type: agentDef.phase === "development" ? "code" : "design",
      title: `${agentDef.name} Output`,
      content: output,
      producedBy: agentDef.id,
    });
  } catch { /* non-fatal */ }

  try {
    await writeArtifact({
      workflowId,
      agentId: agentDef.id,
      filename: "output.md",
      content: output,
      shared: true,
    });
  } catch { /* S3 write failure is non-fatal */ }

  // Check if agent saved artifacts via tools (design doc, completion report)
  try {
    await checkAgentArtifacts(workflowId, agentDef.id);
  } catch { /* non-fatal */ }

  // Stop Code Interpreter for dev agents
  if (agentDef.phase === "development") {
    await stopCodeInterpreterSession(workflowId, agentDef.id);
  }

  // For dev agents: monitor CI after PR creation (non-blocking)
  if (agentDef.phase === "development" && task.branch) {
    monitorCIForBranch(workflowId, state.epicId, task.ticketId, agentDef.id, state.repoConfig, task.branch)
      .catch((err) => console.warn(`[ci-monitor] Non-fatal: ${(err as Error).message}`));
  }

  // Special case: requirements agent completion triggers ticket creation + phase advance
  if (agentId === "team-requirements-analyst") {
    console.log(`[engine] Requirements agent completed (source: ${payload.source || "unknown"}). Creating tickets...`);
    await handleRequirementsCompletion(workflowId, state.epicId, output);
    return { success: true };
  }

  // Mark ticket done → may unblock downstream tickets
  const newlyReady = await tickets().markDone(task.ticketId, workflowId);
  persistWorkflow(workflowId);

  console.log(`[engine] Agent ${agentId} completed (source: ${payload.source || "unknown"}). Newly ready: [${newlyReady.join(", ")}]`);

  // If new tickets became ready, process them
  if (newlyReady.length > 0) {
    await processReadyTickets(workflowId, state.epicId);
  } else if (await tickets().isWorkflowComplete(state.epicId)) {
    await completeWorkflow(workflowId);
  }

  return { success: true };
}

/**
 * Handle a Jira webhook indicating a ticket was transitioned to Done externally.
 * Looks up the workflow, finds the assigned agent, and triggers completion.
 */
export async function handleJiraWebhook(
  ticketId: string,
  status: string
): Promise<{ success: boolean; error?: string }> {
  if (status !== "done") {
    return { success: true }; // Only care about done transitions
  }

  const state = findWorkflowByTicket(ticketId);
  if (!state) {
    return { success: true }; // Not our ticket, ignore gracefully
  }

  // Find which agent owns this ticket
  const ticket = getTicket(ticketId);
  if (!ticket?.assignee) {
    return { success: true }; // No agent assigned, skip
  }

  // Read completion report from S3 if available
  let payload: CompletionPayload = { source: "jira_webhook" };
  try {
    const report = await readArtifact({
      workflowId: state.id,
      agentId: ticket.assignee,
      filename: "completion-report.json",
    });
    if (report) {
      const parsed = JSON.parse(report);
      payload = {
        ...payload,
        summary: parsed.summary,
        branch: parsed.branch,
        commitSha: parsed.commitSha,
        artifacts: parsed.artifacts,
      };
    }
  } catch { /* no completion report, that's ok */ }

  return handleAgentCompletion(state.id, ticket.assignee, payload);
}

// ─── Workflow Completion ─────────────────────────────────────────────────────

async function completeWorkflow(workflowId: string): Promise<void> {
  const state = getWorkflow(workflowId);
  if (!state || state.phase === "complete") return;

  state.phase = "complete";
  state.completedAt = new Date().toISOString();
  setWorkflow(state);
  persistWorkflow(workflowId);

  // Build summary
  const branches = Object.values(state.agentTasks)
    .filter((t) => t.branch)
    .map((t) => `- ${t.agentId}: \`${t.branch}\` (${t.commitSha?.slice(0, 7) || "N/A"})`)
    .join("\n");

  const summary = `Workflow complete! All tickets resolved.\n\nBranches created:\n${branches || "No code branches (design-only workflow)"}`;

  emitEvent(workflowId, { type: "workflow_complete", summary });
  emitEvent(workflowId, {
    type: "notification",
    notification: {
      id: `notif_complete_${Date.now()}`,
      type: "pr_ready",
      title: "Workflow Complete — Ready for PR",
      details: summary,
      timestamp: new Date().toISOString(),
      acknowledged: false,
    },
  });
}

// ─── Agent Invocation ────────────────────────────────────────────────────────

// Cache harness name → ARN mapping
let harnessArnCache: Map<string, string> | null = null;

async function resolveHarnessArn(harnessName: string): Promise<string | undefined> {
  if (!harnessArnCache) {
    const agents = await discoverAgents(DEFAULT_REGION);
    harnessArnCache = new Map();
    for (const a of agents) {
      if (a.type === "harness") {
        harnessArnCache.set(a.name, a.arn);
      }
    }
  }
  return harnessArnCache.get(harnessName);
}

/**
 * Invoke a harness agent and collect the full response.
 * Streams chunks as SSE events for real-time UI.
 */
async function invokeAgent(
  harnessName: string,
  sessionId: string,
  prompt: string,
  workflowId: string,
  agentId: string
): Promise<string> {
  const arn = await resolveHarnessArn(harnessName);
  if (!arn) {
    throw new Error(`Harness "${harnessName}" not found in account. Create it first via agent-setup.`);
  }

  // invokeHarnessAgent returns a ReadableStream of SSE-formatted chunks
  const stream = await invokeHarnessAgent({
    harnessArn: arn,
    prompt,
    sessionId,
    region: DEFAULT_REGION,
  });

  // Consume the stream, collecting text and forwarding to workflow SSE
  let fullOutput = "";
  const reader = stream.getReader();
  const decoder = new TextDecoder();

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });

      // Parse SSE lines from the chunk
      const lines = chunk.split("\n");
      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        try {
          const data = JSON.parse(line.slice(6));
          if (data.type === "text" && data.content) {
            fullOutput += data.content;
            emitEvent(workflowId, { type: "agent_output", agentId, chunk: data.content });
          }
          // We could also forward trace events here if needed
        } catch {
          // Skip non-JSON lines
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  return fullOutput;
}

// ─── Context Building ────────────────────────────────────────────────────────

function buildIntakeContext(input: WorkflowInput): string {
  let context = `# Product Feature Request\n\n`;
  context += `## Title\n${input.title}\n\n`;
  context += `## Description\n${input.description}\n\n`;

  if (input.sources.length > 0) {
    context += `## Input Sources\n`;
    for (const source of input.sources) {
      context += `- [${source.type}] ${source.label || source.value}\n`;
      if (source.type === "url") {
        context += `  URL: ${source.value}\n`;
      } else if (source.type === "s3") {
        context += `  S3: ${source.value}\n`;
      }
    }
    context += "\n";
  }

  context += `## Repository Configuration\n`;
  context += `Layout: ${input.repoConfig.layout}\n`;
  for (const repo of input.repoConfig.repos) {
    context += `- ${repo.platform}: ${repo.url} (branch: ${repo.defaultBranch}${repo.pathPrefix ? `, path: ${repo.pathPrefix}` : ""})\n`;
  }

  return context;
}

async function buildAgentContext(ticket: JiraTicket, state: WorkflowState): Promise<string> {
  let context = `# Your Assignment: ${ticket.title}\n\n`;
  context += `## Ticket\n`;
  context += `ID: ${ticket.id}\n`;
  context += `Description: ${ticket.description}\n\n`;

  // Include the requirements (from epic artifacts)
  const epic = getTicket(state.epicId);
  if (epic?.artifacts.length) {
    const reqArtifact = epic.artifacts.find((a) => a.type === "requirements");
    if (reqArtifact) {
      context += `## Requirements\n${reqArtifact.content}\n\n`;
    }
  }

  const agentDef = ticket.assignee ? getAgentDef(ticket.assignee) : undefined;

  // Include visual analysis for design and dev agents (image descriptions from requirements agent)
  if (agentDef?.phase === "design" || agentDef?.phase === "development") {
    try {
      const visualAnalysis = await readArtifact({
        workflowId: state.id,
        filename: "visual-analysis.md",
        shared: true,
      });
      if (visualAnalysis) {
        context += `${visualAnalysis}\n\n`;
        context += `> **Note**: The above visual analysis was produced by the Requirements Analyst who viewed all intake images. Use this as your primary visual reference. Only use the browser tool to view image URLs yourself if you need additional detail not captured here.\n\n`;
      }
    } catch { /* no visual analysis available — agent can still read images directly */ }
  }

  // For dev agents: include design artifacts from upstream agents
  if (agentDef?.phase === "development") {
    context += `## Design Artifacts\n`;
    // Collect outputs from completed design agents
    for (const [aid, task] of Object.entries(state.agentTasks)) {
      const def = getAgentDef(aid);
      if (def?.phase === "design" && task.status === "complete" && task.output) {
        context += `### ${def.name} Output\n${task.output.slice(0, 4000)}\n\n`;
      }
    }

    // Also try S3 shared artifacts
    try {
      const sharedArtifacts = await listArtifacts({ workflowId: state.id });
      const designDocs = sharedArtifacts.filter(
        (a) => a.key.includes("/shared/") && a.key.endsWith(".md") && !a.key.includes("intake")
      );
      for (const doc of designDocs.slice(0, 3)) {
        try {
          const content = await readArtifact({
            workflowId: state.id,
            filename: doc.key.split("/shared/").pop() || "",
            shared: true,
          });
          if (content && !context.includes(content.slice(0, 100))) {
            context += `### S3 Design Doc: ${doc.key.split("/").pop()}\n${content.slice(0, 3000)}\n\n`;
          }
        } catch { /* skip */ }
      }
    } catch { /* S3 listing failed — non-fatal */ }

    context += `## Repository\n`;
    context += `Layout: ${state.repoConfig.layout}\n`;
    for (const repo of state.repoConfig.repos) {
      context += `- ${repo.platform}: ${repo.url} (branch: ${repo.defaultBranch}${repo.pathPrefix ? `, path: ${repo.pathPrefix}` : ""})\n`;
    }
    context += `\nBranch name: feature/${ticket.id}-${agentDef.id.replace("team-", "")}\n`;
    context += `\n`;

    // Enrich with codebase context from Knowledge Base (if indexed)
    try {
      const codeSearch = getCodeSearchProvider();
      const repoUrl = state.repoConfig.repos[0]?.url;
      if (repoUrl && await codeSearch.isIndexed(repoUrl)) {
        // Get architecture info (Package.swift, target paths, structure)
        const arch = await codeSearch.getArchitecture(repoUrl, state.repoConfig.repos[0]?.defaultBranch);
        context += `## Codebase Architecture (from Knowledge Base)\n`;
        context += `Build System: ${arch.buildSystem}\n`;
        if (arch.targetPaths.length > 0) {
          context += `### Target Paths (where code MUST go):\n`;
          for (const tp of arch.targetPaths) {
            context += `- ${tp.name}: \`${tp.path}\` (${tp.type})\n`;
          }
          context += `\n**CRITICAL: You MUST put source files in the correct target paths above. Do NOT create new directories outside these paths.**\n\n`;
        }
        if (arch.configFiles.length > 0) {
          context += `### Key Config Files:\n`;
          for (const cf of arch.configFiles) {
            context += `#### ${cf.path}\n\`\`\`\n${cf.content.slice(0, 2000)}\n\`\`\`\n\n`;
          }
        }

        // Search for relevant code patterns
        const searchQuery = `${ticket.title} ${ticket.description.slice(0, 200)}`;
        const codeResults = await codeSearch.searchCode({ query: searchQuery, repo: repoUrl, maxResults: 5 });
        if (codeResults.length > 0) {
          context += `### Relevant Existing Code (search results):\n`;
          for (const r of codeResults.slice(0, 3)) {
            context += `#### ${r.filePath} (relevance: ${(r.score * 100).toFixed(0)}%)\n\`\`\`${r.language}\n${r.content.slice(0, 1500)}\n\`\`\`\n\n`;
          }
        }
      }
    } catch { /* Code search not available — non-fatal */ }

    // Fallback: If KB not indexed, read Package.swift / package.json directly via GitHub Lambda
    if (!context.includes("Target Paths")) {
      try {
        const repoUrl = state.repoConfig.repos[0]?.url;
        if (repoUrl) {
          const { owner, repo } = parseRepoUrlFromConfig(state.repoConfig);
          const branch = state.repoConfig.repos[0]?.defaultBranch || "main";

          // Try Package.swift (iOS/Swift)
          // callGitHubLambda("get_file") returns { path, sha, size, content } where content is file text
          let pkgContent: string | null = null;
          try {
            const pkgResult = await callGitHubLambda("get_file", { owner, repo, path: "Package.swift", ref: branch }) as { content?: string };
            pkgContent = pkgResult?.content || null;
          } catch { /* file not found */ }

          if (pkgContent && pkgContent.includes("targets")) {
            context += `## Codebase Structure (from Package.swift)\n`;
            context += `\`\`\`swift\n${pkgContent.slice(0, 3000)}\n\`\`\`\n\n`;

            // Parse target paths from Package.swift
            const targetPaths: string[] = [];
            const pathRegex = /path:\s*"([^"]+)"/g;
            let m;
            while ((m = pathRegex.exec(pkgContent)) !== null) {
              targetPaths.push(m[1]);
            }
            if (targetPaths.length > 0) {
              context += `### Target Paths (where code MUST go):\n`;
              for (const tp of targetPaths) {
                context += `- \`${tp}\`\n`;
              }
              context += `\n**CRITICAL: You MUST put source files in the correct target paths above. Do NOT create new directories or modify Package.swift unless explicitly required.**\n\n`;
            }
          } else {
            // Try package.json (Node.js)
            let npmContent: string | null = null;
            try {
              const npmResult = await callGitHubLambda("get_file", { owner, repo, path: "package.json", ref: branch }) as { content?: string };
              npmContent = npmResult?.content || null;
            } catch { /* file not found */ }
            if (npmContent) {
              context += `## Codebase Structure (from package.json)\n`;
              context += `\`\`\`json\n${npmContent.slice(0, 2000)}\n\`\`\`\n\n`;
            }

            // Try to get directory tree for better context
            let gotDirTree = false;
            try {
              const srcListing = await callGitHubLambda("list_files", { owner, repo, path: "src" }) as Array<{ name: string; path: string; type: string }>;
              if (srcListing && srcListing.length > 0) {
                context += `## Directory Structure\n\`\`\`\nsrc/\n`;
                for (const item of srcListing) {
                  context += `  ${item.name}/\n`;
                }
                context += `\`\`\`\n\n`;
                gotDirTree = true;

                // Dig one level deeper into key directories
                for (const dir of srcListing.filter(i => i.type === "dir" && ["lib", "components", "app"].includes(i.name))) {
                  try {
                    const subListing = await callGitHubLambda("list_files", { owner, repo, path: dir.path }) as Array<{ name: string; path: string; type: string }>;
                    if (subListing?.length > 0) {
                      context += `### ${dir.path}/\n`;
                      for (const sub of subListing.slice(0, 20)) {
                        context += `- ${sub.name}${sub.type === "dir" ? "/" : ""}\n`;
                      }
                      context += `\n`;
                    }
                  } catch { /* skip */ }
                }
              }
            } catch { /* list_files not available */ }

            // Fallback: generate directory tree from local filesystem if GitHub didn't have it
            if (!gotDirTree) {
              try {
                const fs = await import("fs/promises");
                const path = await import("path");
                const srcDir = path.join(process.cwd(), "src");
                const topLevel = await fs.readdir(srcDir, { withFileTypes: true });
                context += `## Directory Structure (from local filesystem)\n\`\`\`\nsrc/\n`;
                for (const entry of topLevel.filter(e => e.isDirectory())) {
                  context += `  ${entry.name}/\n`;
                  try {
                    const subEntries = await fs.readdir(path.join(srcDir, entry.name), { withFileTypes: true });
                    for (const sub of subEntries.slice(0, 15)) {
                      context += `    ${sub.name}${sub.isDirectory() ? "/" : ""}\n`;
                    }
                  } catch { /* skip */ }
                }
                context += `\`\`\`\n\n`;
              } catch { /* fallback failed */ }
            }

            // Try to read key type definitions that agents MUST align with
            let typesContent: string | null = null;
            try {
              const typesResult = await callGitHubLambda("get_file", { owner, repo, path: "src/lib/workflow/types.ts", ref: branch }) as { content?: string };
              typesContent = typesResult?.content || null;
            } catch { /* file not found on GitHub */ }

            // Fallback: read from local filesystem if GitHub doesn't have it yet
            if (!typesContent) {
              try {
                const fs = await import("fs/promises");
                const path = await import("path");
                const localPath = path.join(process.cwd(), "src/lib/workflow/types.ts");
                typesContent = await fs.readFile(localPath, "utf-8");
              } catch { /* local file not found either */ }
            }

            if (typesContent) {
              context += `## Existing Type Definitions (src/lib/workflow/types.ts)\n`;
              context += `**CRITICAL: You MUST use these existing types. Do NOT redefine WorkflowState, JiraTicket, or any types that already exist here.**\n`;
              context += `\`\`\`typescript\n${typesContent.slice(0, 4000)}\n\`\`\`\n\n`;
            }

            context += `\n**CRITICAL RULES:**\n`;
            context += `1. This is a Next.js 14 project using the \`src/\` directory. ALL source files go under \`src/\`.\n`;
            context += `2. API routes go in \`src/app/api/\` — NOT in \`app/api/\`.\n`;
            context += `3. Components go in \`src/components/\` — NOT in a root \`components/\` directory.\n`;
            context += `4. Types and library code go in \`src/lib/\` — NOT in a root \`lib/\` or \`types/\` directory.\n`;
            context += `5. Do NOT create duplicate implementations. Check what exists first using get_file and list_files.\n`;
            context += `6. Do NOT create files outside the \`src/\` directory (except package.json, tsconfig.json).\n`;
            context += `7. Use the EXISTING type definitions — do NOT redefine interfaces that already exist.\n\n`;
          }
        }
      } catch { /* fallback failed — non-fatal */ }
    }
  }

  // For design agents: include other design agent outputs if available (e.g., security needs backend design)
  if (agentDef?.phase === "design" && agentDef.canQueryAgents.length > 0) {
    const upstreamOutputs: string[] = [];
    for (const queryableId of agentDef.canQueryAgents) {
      const upstreamTask = state.agentTasks[queryableId];
      if (upstreamTask?.status === "complete" && upstreamTask.output) {
        upstreamOutputs.push(`### ${queryableId} Output (excerpt)\n${upstreamTask.output.slice(0, 2000)}\n`);
      }
    }
    if (upstreamOutputs.length > 0) {
      context += `## Upstream Agent Outputs\n${upstreamOutputs.join("\n")}\n`;
    }
  }

  // Always include workflow_id for tool calls
  context += `## Workflow Context\nworkflow_id: ${state.id}\nagent_id: ${ticket.assignee || "unknown"}\n`;

  return context;
}

// ─── Requirements Output Parsing ─────────────────────────────────────────────

interface TicketPlan {
  requirements: string;
  tickets: Array<{
    title: string;
    description: string;
    assignee: string;
    blockedBy: string[];
  }>;
}

function parseRequirementsOutput(output: string): TicketPlan {
  // Strategy 1: Extract JSON from ```json code block
  const codeBlockMatch = output.match(/```json\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    try {
      const parsed = JSON.parse(codeBlockMatch[1]);
      return {
        requirements: parsed.requirements || output,
        tickets: parsed.tickets || [],
      };
    } catch {
      // JSON in code block had parse error — try to extract just the tickets array
    }
  }

  // Strategy 2: Extract just the tickets array using regex
  const ticketsMatch = output.match(/"tickets"\s*:\s*\[([\s\S]*)\]/);
  if (ticketsMatch) {
    try {
      const ticketsJson = `[${ticketsMatch[1]}]`;
      const tickets = JSON.parse(ticketsJson);
      // Extract requirements text (everything before the JSON block)
      const reqMatch = output.match(/"requirements"\s*:\s*"([\s\S]*?)(?:"\s*,\s*"tickets")/);
      return {
        requirements: reqMatch ? reqMatch[1].replace(/\\n/g, "\n") : output,
        tickets,
      };
    } catch {
      // Fall through
    }
  }

  // Strategy 3: Extract individual ticket objects with regex
  const ticketPattern = /\{\s*"title"\s*:\s*"([^"]+)"\s*,\s*"description"\s*:\s*"([^"]*(?:\\.[^"]*)*)"[^}]*"assignee"\s*:\s*"([^"]+)"[^}]*"blockedBy"\s*:\s*\[([^\]]*)\]\s*\}/g;
  const tickets: { title: string; description: string; assignee: string; blockedBy: string[] }[] = [];
  let match;
  while ((match = ticketPattern.exec(output)) !== null) {
    const blockedByRaw = match[4].trim();
    const blockedBy = blockedByRaw
      ? blockedByRaw.split(",").map((s) => s.trim().replace(/"/g, "")).filter(Boolean)
      : [];
    tickets.push({
      title: match[1],
      description: match[2].replace(/\\n/g, "\n"),
      assignee: match[3],
      blockedBy,
    });
  }

  if (tickets.length > 0) {
    return { requirements: output, tickets };
  }

  // Fallback: couldn't parse structured output, create a generic ticket set
  return {
    requirements: output,
    tickets: [
      {
        title: "Design",
        description: "Design the implementation based on requirements",
        assignee: "team-backend-designer",
        blockedBy: [],
      },
      {
        title: "Implementation",
        description: "Implement the feature based on design specs",
        assignee: "team-frontend-dev",
        blockedBy: ["Design"],
      },
    ],
  };
}

/**
 * Resolve a fuzzy assignee name from the requirements agent to a valid agent ID.
 * The requirements agent sometimes outputs names like "ios-developer", "backend",
 * "security" instead of exact IDs like "team-frontend-dev".
 */
function resolveAssignee(rawAssignee: string): string {
  // Exact match first
  if (getAgentDef(rawAssignee)) return rawAssignee;

  const lower = rawAssignee.toLowerCase().replace(/[_\-\s]+/g, "");

  // Keyword → agent ID mapping
  const keywordMap: [string[], string][] = [
    [["iosdesign", "iosarchitect", "uidesign", "swiftuidesign"], "team-ios-designer"],
    [["androiddesign", "androidarchitect", "materialdesign", "composedesign"], "team-android-designer"],
    [["backenddesign", "apidesign", "backendarchitect", "servicedesign"], "team-backend-designer"],
    [["security", "securityreview", "threatmodel", "owasp"], "team-security-reviewer"],
    [["legal", "compliance", "gdpr", "privacy", "legalcompliance"], "team-legal-compliance"],
    [["localization", "i18n", "l10n", "translation", "locale"], "team-localization"],
    [["analytics", "tracking", "metrics", "events", "instrumentation"], "team-analytics-designer"],
    [["backenddev", "backenddevelop", "backendimpl", "serverdev"], "team-backend-dev"],
    [["apidev", "apidevelop", "apiimpl", "apiengineer"], "team-api-dev"],
    [["frontenddev", "frontenddevelop", "iosdev", "iosdevelop", "uidev", "mobiledevelop", "mobiledev", "iosengineer", "iosdeveloper", "frontenddeveloper"], "team-frontend-dev"],
    [["requirements", "requirementsanalyst", "productanalyst"], "team-requirements-analyst"],
  ];

  for (const [keywords, agentId] of keywordMap) {
    if (keywords.some((kw) => lower.includes(kw) || kw.includes(lower))) {
      return agentId;
    }
  }

  // Fuzzy: find agent whose name or role contains the input
  for (const agent of AGENT_ROSTER) {
    const agentLower = agent.name.toLowerCase().replace(/[_\-\s]+/g, "");
    const roleLower = agent.role.toLowerCase().replace(/[_\-\s]+/g, "");
    if (agentLower.includes(lower) || lower.includes(agentLower) ||
        roleLower.includes(lower)) {
      return agent.id;
    }
  }

  // Last resort: default to frontend dev for generic "developer" references
  if (lower.includes("dev") || lower.includes("implement") || lower.includes("engineer")) {
    return "team-frontend-dev";
  }

  // Return as-is (will cause a blocked ticket, but at least we tried)
  console.warn(`[resolveAssignee] Could not resolve: "${rawAssignee}"`);
  return rawAssignee;
}

async function createTicketsFromPlan(
  plan: TicketPlan,
  epicId: string,
  workflowId: string
): Promise<JiraTicket[]> {
  const created: JiraTicket[] = [];
  const titleToId = new Map<string, string>();

  // First pass: create all tickets without blockers to get their IDs
  for (const t of plan.tickets) {
    const resolvedAssignee = resolveAssignee(t.assignee);
    const ticket = await tickets().createTicket(
      {
        parentId: epicId,
        title: t.title,
        description: t.description,
        assignee: resolvedAssignee,
        blockedBy: [], // will update in second pass
      },
      workflowId
    );
    created.push(ticket);
    titleToId.set(t.title, ticket.id);
  }

  // Second pass: resolve blocker references (title → ID) and update status
  for (let i = 0; i < plan.tickets.length; i++) {
    const planTicket = plan.tickets[i];
    const realTicket = created[i];

    if (planTicket.blockedBy && planTicket.blockedBy.length > 0) {
      const resolvedBlockers = planTicket.blockedBy
        .map((title) => titleToId.get(title))
        .filter((id): id is string => !!id);

      if (resolvedBlockers.length > 0) {
        realTicket.blockedBy = resolvedBlockers;
        // Check if actually blocked
        const allDone = resolvedBlockers.every((bid) => {
          const b = getTicket(bid);
          return b?.status === "done";
        });
        if (!allDone) {
          realTicket.status = "todo";
        }
        setTicket(realTicket);
      }
    }
  }

  return created;
}

// ─── Multimodal: Stage Images on MicroVM ────────────────────────────────────

/**
 * Generate image viewing instructions for multimodal agents.
 * Returns a string to prepend to the agent's context that tells the agent
 * to use the browser tool to navigate to presigned image URLs.
 *
 * Flow: S3 intake images → presigned URL → agent uses browser tool → model sees image
 */
async function getImageStagingInstructions(workflowId: string): Promise<string> {
  try {
    const artifacts = await listArtifacts({ workflowId, agentId: "intake" });
    const imageArtifacts = artifacts.filter((a) =>
      /\.(png|jpg|jpeg|gif|webp|pdf)$/i.test(a.key)
    );

    if (imageArtifacts.length === 0) return "";

    // Generate presigned URLs for each image
    const { S3Client, GetObjectCommand } = await import("@aws-sdk/client-s3");
    const { getSignedUrl } = await import("@aws-sdk/s3-request-presigner");
    const s3 = new S3Client({ region: DEFAULT_REGION });
    const bucket = process.env.TEAM_WORKFLOW_S3_BUCKET || "";

    const images: { filename: string; url: string }[] = [];
    for (const artifact of imageArtifacts) {
      const filename = artifact.key.split("/").pop() || "file";
      const cmd = new GetObjectCommand({ Bucket: bucket, Key: artifact.key });
      const url = await getSignedUrl(s3, cmd, { expiresIn: 600 });
      images.push({ filename, url });
    }

    // Build instructions for the agent — use browser tool to view images
    let instructions = `\n## ⚠️ MANDATORY FIRST STEP: View Images\n\n`;
    instructions += `There are ${images.length} image file(s) (mockups/screenshots/designs) for this task.\n`;
    instructions += `You MUST use the \`browser\` tool to navigate to each URL below to view the images.\n`;
    instructions += `The browser will render the image and you will see its visual content.\n\n`;
    instructions += `**Image URLs to view:**\n`;
    for (const img of images) {
      instructions += `- **${img.filename}**: ${img.url}\n`;
    }
    instructions += `\nDo NOT proceed with your analysis until you have viewed ALL images using the browser tool.\n\n`;

    console.log(`[multimodal] Generated browser instructions for ${images.length} images`);
    return instructions;
  } catch (err) {
    console.warn("[multimodal] Failed to generate image staging instructions (non-fatal):", err);
    return "";
  }
}

// ─── CI Monitoring ──────────────────────────────────────────────────────────

import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";
const lambdaClient = new LambdaClient({ region: DEFAULT_REGION });

async function callGitHubLambda(toolName: string, args: Record<string, unknown>): Promise<unknown> {
  const res = await lambdaClient.send(new InvokeCommand({
    FunctionName: "agentis-github-mcp",
    Payload: Buffer.from(JSON.stringify({ name: toolName, arguments: args })),
  }));
  const result = JSON.parse(new TextDecoder().decode(res.Payload!));
  const text = result.content[0].text;
  if (result.isError) throw new Error(text);
  return JSON.parse(text);
}

interface CIMonitorConfig {
  maxRetries: number;
  pollIntervalMs: number;
  maxWaitMs: number;
}

const CI_CONFIG: CIMonitorConfig = {
  maxRetries: 3,       // Max fix attempts before marking blocked
  pollIntervalMs: 30000, // Poll every 30s
  maxWa
// ... truncated for size