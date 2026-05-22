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
  getTicketsForWorkflow,
  emitEvent,
  persistWorkflow,
  findWorkflowByTicket,
} from "./store";
import { getTicketProvider } from "./ticket-provider";
import type { TicketProvider } from "./ticket-provider";
import { getAgentDef, AGENT_ROSTER, getAgentsForPhase } from "./agents";

// ─── Config-Driven Phase & Agent Helpers ─────────────────────────────────────

/** Ordered list of workflow phases — drives transitions without hardcoding. */
const PHASE_ORDER: WorkflowPhase[] = [
  "intake",
  "requirements",
  "design",
  "development",
  "verification",
  "review",
  "complete",
];

/** Get the next phase in the workflow sequence. Returns current if already terminal. */
function nextPhase(current: WorkflowPhase): WorkflowPhase {
  const idx = PHASE_ORDER.indexOf(current);
  return idx >= 0 && idx < PHASE_ORDER.length - 1 ? PHASE_ORDER[idx + 1] : current;
}

/** Get the intake/requirements agent — the first agent whose phase is "requirements". */
function getIntakeAgent() {
  const agents = getAgentsForPhase("requirements");
  if (agents.length === 0) throw new Error("No agent configured for 'requirements' phase");
  return agents[0];
}

/** Get a default development agent — first agent in the "development" phase. */
function getDefaultDevAgent() {
  const agents = getAgentsForPhase("development");
  if (agents.length === 0) throw new Error("No agent configured for 'development' phase");
  return agents[0];
}

/** Get a default design agent — first agent in the "design" phase. */
function getDefaultDesignAgent() {
  const agents = getAgentsForPhase("design");
  if (agents.length === 0) throw new Error("No agent configured for 'design' phase");
  return agents[0];
}

// Convenience: get the ticket provider (lazy singleton)
function tickets(): TicketProvider {
  return getTicketProvider();
}
import { generateSessionId } from "./session";
import { invokeHarnessAgent, discoverAgents } from "@/lib/agentcore-sdk";
import { processIntakeSources, buildRequirementsContext } from "./intake";
import { provisionWorkspace, startCodeInterpreterSession, stopCodeInterpreterSession, writeArtifact, readArtifact, listArtifacts } from "./workspace";
import { initManifest, addManifestEntries, getManifest, buildManifestContext } from "./manifest";
import { getCodeSearchProvider } from "./code-search-provider";
import { saveWorkflowToDynamo } from "./dynamo-workflow-store";
import { createTicketSkeletons } from "./ticket-skeletons";
import { ARTIFACT_BUCKET } from "./agent-setup";

const DEFAULT_REGION = process.env.AWS_REGION || "us-east-1";

/**
 * Orchestration mode:
 * - "in-process" (default): Next.js engine drives everything (current behavior)
 * - "lambda": DynamoDB Streams + Lambda orchestrator drives workflow after initial kickoff
 *
 * In Lambda mode, startWorkflow:
 * 1. Creates ticket skeletons in DynamoDB (all 13 agents + epic)
 * 2. Saves workflow metadata to agentis-workflows table
 * 3. Sets requirements ticket to "todo" → DynamoDB Stream fires → Lambda invokes agent
 * 4. Returns immediately — Stream handles all cascading from here
 */
const ORCHESTRATION_MODE = process.env.ORCHESTRATION_MODE || "in-process";

/**
 * Sync tickets from DynamoDB into the in-memory store.
 * Called after the requirements agent finishes in DynamoDB mode.
 * The agent created tickets via JiraIntegration___create_ticket (Lambda → DynamoDB),
 * and we need the in-memory store to reflect that so processReadyTickets works.
 */
async function syncDynamoTicketsToStore(epicId: string): Promise<void> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { DynamoDBProvider } = require("./ticket-provider-dynamodb");
    const dynamo = new DynamoDBProvider();

    // Get the epic itself
    const epic = await dynamo.getTicket(epicId);
    if (epic) setTicket(epic);

    // Get all child tickets
    const children = await dynamo.getChildTickets(epicId);
    console.log(`[engine] Synced ${children.length} tickets from DynamoDB for epic ${epicId}`);

    for (const ticket of children) {
      // Map DynamoDB "todo" status to the in-memory "ready" status the engine expects
      if (ticket.status === "todo" && (!ticket.blockedBy || ticket.blockedBy.length === 0)) {
        ticket.status = "ready";
      }
      setTicket(ticket);
    }
  } catch (err) {
    console.error(`[engine] Failed to sync DynamoDB tickets:`, err);
  }
}

/**
 * Read the ticket plan from S3 (written by the requirements agent via WorkflowOutput tool).
 */
async function readTicketPlanFromS3(workflowId: string): Promise<TicketPlan | null> {
  try {
    const content = await readArtifact({
      workflowId,
      shared: true,
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
          assignee: t.assignee || getDefaultDevAgent().id,
          blockedBy: Array.isArray(t.blockedBy) ? t.blockedBy : [],
        })),
      };
    }
    return null;
  } catch (err) {
    console.warn(`[engine] Failed to read ticket-plan.json from S3 for ${workflowId}:`, err);
    return null;
  }
}

// ─── Engine Entry Point ──────────────────────────────────────────────────────

/**
 * Start a new workflow. Creates the epic, processes intake, invokes requirements agent.
 *
 * In Lambda mode: creates ticket skeletons in DynamoDB, saves workflow metadata,
 * and returns immediately. The DynamoDB Stream + orchestrator Lambda handles everything.
 *
 * In in-process mode: current behavior (engine drives orchestration inline).
 */
export async function startWorkflow(input: WorkflowInput): Promise<string> {
  const workflowId = `wf_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  if (ORCHESTRATION_MODE === "lambda") {
    return startWorkflowLambdaMode(workflowId, input);
  }

  // ─── In-Process Mode (default, current behavior) ─────────────────────────

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

/**
 * Lambda Orchestration Mode — DynamoDB is the sole state machine.
 *
 * Creates all ticket skeletons with dependency chains, saves workflow metadata
 * to agentis-workflows table, then returns. The DynamoDB Stream fires for the
 * requirements ticket (status="todo") → orchestrator Lambda picks it up.
 *
 * This is the target architecture for Jira swap:
 * - DynamoDB table → Jira project
 * - DynamoDB Streams → Jira webhooks
 * - Ticket status in DynamoDB → Jira ticket status (the state machine)
 */
async function startWorkflowLambdaMode(workflowId: string, input: WorkflowInput): Promise<string> {
  console.log(`[engine] Starting workflow in LAMBDA orchestration mode: ${workflowId}`);

  // 1. Create all ticket skeletons in DynamoDB with dependency chains
  //    Requirements ticket starts as "todo" (no blockers) → Stream fires immediately
  const { epicId, requirementsTicketId, ticketIds } = await createTicketSkeletons(
    workflowId,
    input.title,
    input.description
  );

  // 2. Build agentTasks map from skeleton IDs
  const agentTasks: Record<string, AgentTask> = {};
  for (const [agentId, ticketId] of Object.entries(ticketIds)) {
    agentTasks[agentId] = {
      id: `task_${Date.now()}_${agentId}`,
      agentId,
      ticketId,
      status: "pending",
      input: "", // Populated by orchestrator Lambda at invocation time
      startedAt: new Date().toISOString(),
    };
  }

  // 3. Save workflow state to BOTH in-memory store (for UI) AND DynamoDB (for Lambda)
  const state: WorkflowState = {
    id: workflowId,
    phase: "requirements",
    epicId,
    repoConfig: input.repoConfig,
    input,
    agentTasks,
    messages: [],
    humanNotifications: [],
    startedAt: new Date().toISOString(),
  };

  // In-memory (for Next.js UI polling/SSE)
  setWorkflow(state);
  emitEvent(workflowId, { type: "phase_change", phase: "requirements" });

  // DynamoDB workflows table (for Lambda orchestrator to read)
  await saveWorkflowToDynamo(state);

  console.log(`[engine] Lambda mode: ${Object.keys(ticketIds).length} skeleton tickets created. Requirements ticket ${requirementsTicketId} is "todo" — Stream will invoke agent.`);

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

    // Hard stop: if ALL sources failed to load, abort the workflow
    const failedCount = processedSources.filter(s => s.content.startsWith("[Error")).length;
    if (failedCount === processedSources.length && processedSources.length > 0) {
      const errorMsg = `All ${failedCount} intake sources failed to load. Aborting workflow.`;
      console.error(`[engine] ${errorMsg}`);
      state.phase = "error" as WorkflowState["phase"];
      state.error = errorMsg;
      setWorkflow(state);
      emitEvent(workflowId, { type: "error", error: errorMsg });
      throw new Error(errorMsg);
    }
  }

  // Initialize the cumulative workflow manifest with intake sources
  try {
    await initManifest(workflowId, processedSources);
  } catch (err) {
    console.warn("[engine] Manifest initialization failed (non-fatal):", err);
  }

  // Phase: Requirements
  state.phase = "requirements";
  setWorkflow(state);
  emitEvent(workflowId, { type: "phase_change", phase: "requirements" });

  // Build intake context for requirements agent (uses processed sources)
  let intakeContext = processedSources.length > 0
    ? buildRequirementsContext(input, processedSources)
    : buildIntakeContext(input);

  // Inject workflow_id and epic_id so the agent can use them in tool calls
  intakeContext += `\n\n## Workflow Context\nworkflow_id: ${workflowId}\nepic_id: ${epicId}\n\n`;
  intakeContext += `## CRITICAL INSTRUCTION: Epic Already Exists\nThe epic "${epicId}" has ALREADY been created for this workflow. Do NOT create another epic.\nUse "${epicId}" as the parent_key for ALL child tickets you create.\n`;

  // FIX: Inline directory structure and types directly so requirements agent
  // doesn't need Gateway tools (which fail silently on managed harness)
  try {
    const { owner, repo } = parseRepoUrlFromConfig(input.repoConfig);
    const branch = input.repoConfig.repos[0]?.defaultBranch || "main";

    // Try GitHub first, then local filesystem
    let dirTree = "";
    try {
      const srcListing = await callGitHubLambda("list_files", { owner, repo, path: "src" }) as Array<{ name: string; type: string; path: string }>;
      if (srcListing?.length > 0) {
        dirTree = "src/\n";
        for (const item of srcListing) {
          dirTree += `  ${item.name}${item.type === "dir" ? "/" : ""}\n`;
        }
      }
    } catch { /* GitHub unavailable */ }

    if (!dirTree) {
      try {
        const fs = await import("fs/promises");
        const path = await import("path");
        const srcDir = path.join(process.cwd(), "src");
        const topLevel = await fs.readdir(srcDir, { withFileTypes: true });
        dirTree = "src/\n";
        for (const entry of topLevel.filter(e => e.isDirectory())) {
          dirTree += `  ${entry.name}/\n`;
          const subEntries = await fs.readdir(path.join(srcDir, entry.name), { withFileTypes: true });
          for (const sub of subEntries.slice(0, 15)) {
            dirTree += `    ${sub.name}${sub.isDirectory() ? "/" : ""}\n`;
          }
        }
      } catch { /* fallback failed */ }
    }

    if (dirTree) {
      intakeContext += `\n## Existing Codebase Structure\n\`\`\`\n${dirTree}\`\`\`\n`;
      intakeContext += `This is a Next.js 14 project using \`src/\` layout. All code goes under \`src/\`.\n\n`;
    }

    // Inline types.ts so requirements agent can reference existing types
    let typesContent: string | null = null;
    try {
      const typesResult = await callGitHubLambda("get_file", { owner, repo, path: "src/lib/workflow/types.ts", ref: branch }) as { content?: string };
      typesContent = typesResult?.content || null;
    } catch { /* not on GitHub */ }
    if (!typesContent) {
      try {
        const fs = await import("fs/promises");
        const path = await import("path");
        typesContent = await fs.readFile(path.join(process.cwd(), "src/lib/workflow/types.ts"), "utf-8");
      } catch { /* not found locally */ }
    }
    if (typesContent) {
      intakeContext += `## Existing Types (src/lib/workflow/types.ts)\n\`\`\`typescript\n${typesContent.slice(0, 3000)}\n\`\`\`\n\n`;
    }
  } catch { /* non-fatal */ }

  // Multimodal: prepend image download instructions for the requirements agent
  const imageInstructions = await getImageStagingInstructions(workflowId);
  if (imageInstructions) {
    intakeContext = imageInstructions + intakeContext;
  }

  // Invoke requirements agent (fire-and-forget) — resolved from config
  const reqAgent = getIntakeAgent();
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

  const reqAgent = getIntakeAgent();
  const reqTask = state.agentTasks[reqAgent.id];

  // Mark task complete
  if (reqTask && reqTask.status !== "complete") {
    reqTask.status = "complete";
    reqTask.output = output;
    reqTask.completedAt = new Date().toISOString();
    setWorkflow(state);
  }

  emitEvent(workflowId, { type: "agent_complete", agentId: reqAgent.id, output });

  const providerType = process.env.TICKET_PROVIDER || "memory";

  if (providerType === "dynamodb") {
    // ─── DynamoDB path: tickets already exist (agent created them via JiraIntegration tools) ───
    // The agent called JiraIntegration___create_ticket for each ticket during its run.
    // We just need to mark the epic done and sync DynamoDB state into the in-memory store.
    console.log(`[engine] DynamoDB mode — tickets already created by agent via gateway tools`);
    await tickets().markDone(epicId, workflowId);

    // Store requirements text as an artifact on the epic
    await tickets().addArtifact(epicId, {
      type: "requirements",
      title: "Requirements Document",
      content: output,
      producedBy: reqAgent.id,
    });

    // Sync: pull tickets from DynamoDB into in-memory store so processReadyTickets works
    await syncDynamoTicketsToStore(epicId);
  } else {
    // ─── Legacy path: read ticket plan from S3 or parse text, then create tickets ───
    const s3Plan = await readTicketPlanFromS3(workflowId);
    const ticketPlan = s3Plan || parseRequirementsOutput(output);
    console.log(`[engine] Ticket plan source: ${s3Plan ? "S3 artifact" : "text parsing fallback"}, tickets: ${ticketPlan.tickets.length}, assignees: [${ticketPlan.tickets.map(t => t.assignee).join(", ")}]`);
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
  }

  // Transition to next phase after requirements — driven by ticket readiness
  const nextWorkflowPhase = nextPhase("requirements");
  state.phase = nextWorkflowPhase;
  setWorkflow(state);
  persistWorkflow(workflowId);
  emitEvent(workflowId, { type: "phase_change", phase: nextWorkflowPhase });

  // In Lambda mode: the DynamoDB Stream handles cascading.
  // The requirements agent already marked tickets done/skip in DynamoDB via tool calls.
  // Those writes trigger Stream → orchestrator Lambda → unblocks + invokes next agents.
  if (ORCHESTRATION_MODE === "lambda") {
    console.log(`[engine] Lambda mode: requirements complete. Stream handles cascade from here.`);
    await saveWorkflowToDynamo(state);
    return;
  }

  // In-process mode: drive the cascade ourselves
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
    // Before completing, check if QA verification is needed
    if (await tickets().isWorkflowComplete(epicId)) {
      await completeWorkflow(workflowId);
    } else if (shouldCreateQaTicket(workflowId, epicId)) {
      await createQaVerificationTicket(workflowId, epicId);
    }
    return;
  }

  // Determine current phase from ready tickets — advance phase if tickets are ahead
  const ticketPhases = readyTickets.map((t) => {
    const agent = t.assignee ? getAgentDef(t.assignee) : undefined;
    return agent?.phase;
  });
  const currentPhaseIdx = PHASE_ORDER.indexOf(state.phase);
  const furthestTicketPhase = ticketPhases.reduce<WorkflowPhase | undefined>((acc, p) => {
    if (!p) return acc;
    const pAsWorkflowPhase = p as WorkflowPhase;
    const pIdx = PHASE_ORDER.indexOf(pAsWorkflowPhase);
    const accIdx = acc ? PHASE_ORDER.indexOf(acc) : -1;
    return pIdx > accIdx ? pAsWorkflowPhase : acc;
  }, undefined);

  if (furthestTicketPhase && PHASE_ORDER.indexOf(furthestTicketPhase) > currentPhaseIdx) {
    state.phase = furthestTicketPhase;

    // Create a single shared feature branch for ALL dev agents when entering development
    if (furthestTicketPhase === "development" && !state.featureBranch) {
      try {
        const { owner, repo } = parseRepoUrlFromConfig(state.repoConfig);
        const branch = state.repoConfig.repos[0]?.defaultBranch || "main";
        const slug = state.input.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40).replace(/-$/, "");
        const branchName = `feature/${state.epicId}-${slug}`;
        await callGitHubLambda("create_branch", { owner, repo, branch_name: branchName, from_branch: branch });
        state.featureBranch = branchName;
        console.log(`[engine] Created shared feature branch: ${branchName}`);
      } catch (err) {
        // Branch may already exist or GitHub unavailable — agents will create their own
        console.warn(`[engine] Failed to create shared branch: ${(err as Error).message}`);
      }
    }

    setWorkflow(state);
    emitEvent(workflowId, { type: "phase_change", phase: furthestTicketPhase });
  }

  // Invoke ready tickets — deduplicate by agent (only one ticket per agent at a time)
  // If multiple tickets are ready for the same agent, invoke only the first.
  // The rest will be picked up when that agent's ticket completes (via cascade).
  const seenAgents = new Set<string>();
  const invocations = readyTickets
    .filter((t) => t.assignee && t.type !== "epic")
    .filter((t) => {
      if (seenAgents.has(t.assignee!)) {
        console.log(`[engine] Deferring ticket ${t.id} — agent ${t.assignee} already has a running ticket`);
        return false;
      }
      // Also skip if agent already has a running task
      const existingTask = state.agentTasks[t.assignee!];
      if (existingTask && existingTask.status === "running") {
        console.log(`[engine] Deferring ticket ${t.id} — agent ${t.assignee} still running ${existingTask.ticketId}`);
        return false;
      }
      seenAgents.add(t.assignee!);
      return true;
    })
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
  // Sync in-memory store
  const inMemTicketStart = getTicket(ticket.id);
  if (inMemTicketStart) { inMemTicketStart.status = "in_progress"; setTicket(inMemTicketStart); }
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
    // Determine model override: apply to ALL agents when specified
    // Normalize: accept both string shorthand (e.g., "claude-opus-46") and full object
    let modelOverride = state.input?.modelOverride || undefined;
    if (typeof modelOverride === "string") {
      // Map shorthand to proper bedrockModelConfig format
      const MODEL_ID_MAP: Record<string, string> = {
        "claude-opus-47": "us.anthropic.claude-opus-4-7",
        "claude-opus-46": "us.anthropic.claude-opus-4-6-v1",
        "claude-sonnet-45": "us.anthropic.claude-sonnet-4-5-20250929-v1:0",
      };
      const fullModelId = MODEL_ID_MAP[modelOverride as string] || (modelOverride as string);
      modelOverride = { bedrockModelConfig: { modelId: fullModelId } };
    }

    if (modelOverride) {
      const modelId = modelOverride.bedrockModelConfig?.modelId || modelOverride.openAiModelConfig?.modelId || "unknown";
      console.log(`[engine] Using model override for ${agentDef.id}: ${modelId}`);
    }

    // This awaits the full stream — when it returns, the agent is definitively done
    const output = await invokeAgentWithRetry(agentDef.harnessName, sessionId, agentContext, workflowId, agentDef.id, modelOverride);

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

  // Register the agent's output in the cumulative manifest
  try {
    const entryType = agentDef.phase === "development" ? "code" :
                      agentDef.phase === "design" ? "design-doc" :
                      agentDef.phase === "verification" ? "report" : "analysis";
    await addManifestEntries(workflowId, agentDef.phase, [{
      type: entryType as "code" | "design-doc" | "report" | "analysis",
      format: "markdown",
      description: `${agentDef.name} output`,
      s3Key: `workflows/${workflowId}/shared/output.md`,
      sizeBytes: output.length,
      addedBy: agentDef.id,
      critical: agentDef.phase === "design", // Design outputs are critical for dev agents
    }]);
  } catch { /* manifest update failure is non-fatal */ }

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
  if (agentId === getIntakeAgent().id) {
    console.log(`[engine] Requirements agent completed (source: ${payload.source || "unknown"}). Creating tickets...`);
    await handleRequirementsCompletion(workflowId, state.epicId, output);
    return { success: true };
  }

  // Mark ticket done → may unblock downstream tickets
  const newlyReady = await tickets().markDone(task.ticketId, workflowId);

  // Sync in-memory store so shouldCreateQaTicket / isWorkflowComplete see current state
  const inMemTicket = getTicket(task.ticketId);
  if (inMemTicket) {
    inMemTicket.status = "done";
    setTicket(inMemTicket);
  }

  // Sync newly-unblocked tickets to "ready" in memory (DynamoDB sets them to "todo")
  for (const readyId of newlyReady) {
    const readyTicket = getTicket(readyId);
    if (readyTicket) {
      readyTicket.status = "ready";
      readyTicket.blockedBy = [];
      setTicket(readyTicket);
    }
  }

  persistWorkflow(workflowId);

  console.log(`[engine] Agent ${agentId} completed (source: ${payload.source || "unknown"}). Newly ready: [${newlyReady.join(", ")}]`);

  // Special case: fix ticket completed → re-run QA verification
  const ticket = getTicket(task.ticketId);
  if (ticket && isFixTicket(ticket)) {
    console.log(`[engine] Fix ticket ${task.ticketId} completed. Re-triggering QA verification...`);
    await createQaVerificationTicket(workflowId, state.epicId);
    return { success: true };
  }

  // If new tickets became ready, process them
  if (newlyReady.length > 0) {
    await processReadyTickets(workflowId, state.epicId);
  } else if (shouldCreateQaTicket(workflowId, state.epicId)) {
    // QA check BEFORE workflow completion — ensures verification runs
    await createQaVerificationTicket(workflowId, state.epicId);
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

// ─── QA Verification Gate ────────────────────────────────────────────────────

/**
 * Determine if a QA verification ticket should be created.
 * Returns true if:
 * 1. All dev tickets are done
 * 2. No QA ticket already exists for this workflow
 * 3. Workflow has visual input (mockups) worth comparing against
 */
function shouldCreateQaTicket(workflowId: string, epicId: string): boolean {
  const allTickets = getTicketsForWorkflow(epicId);

  // Check if an active (non-blocked, non-done) QA ticket already exists
  const hasActiveQaTicket = allTickets.some(
    (t) => t.assignee === "team-qa-verifier" && t.status !== "blocked" && t.status !== "done"
  );
  if (hasActiveQaTicket) return false;

  // Check if all dev tickets are done
  const devTickets = allTickets.filter(
    (t) => t.assignee && (
      t.assignee.includes("-dev") || t.assignee.includes("-frontend")
    )
  );
  if (devTickets.length === 0) return false;
  const allDevsDone = devTickets.every((t) => t.status === "done");
  if (!allDevsDone) return false;

  // Check if design tickets are done too (QA needs design context)
  const designTickets = allTickets.filter(
    (t) => t.assignee && t.assignee.includes("-designer")
  );
  const allDesignDone = designTickets.every((t) => t.status === "done");

  return allDevsDone && allDesignDone;
}

/**
 * Create a QA verification ticket that will trigger the team-qa-verifier agent.
 * The QA agent gets: mockup URLs, feature branch, acceptance criteria.
 * If QA fails, it creates a fix ticket back to the dev agent (max 3 retries).
 */
async function createQaVerificationTicket(
  workflowId: string,
  epicId: string
): Promise<void> {
  const state = getWorkflow(workflowId);
  if (!state) return;

  console.log(`[engine] All dev agents complete. Creating QA verification ticket...`);

  // Transition workflow phase
  state.phase = "verification";
  emitEvent(workflowId, {
    type: "phase_change",
    phase: "verification",
  });

  // Build QA context from workflow state
  const allTickets = getTicketsForWorkflow(epicId);
  const devTickets = allTickets.filter(
    (t) => t.assignee && t.assignee.includes("-dev")
  );

  // Gather what was built
  const devSummaries = devTickets
    .map((t) => `- ${t.title} (${t.assignee}): ${t.status}`)
    .join("\n");

  // Get mockup/input URLs from original workflow input
  const inputSources = state.input.sources
    .map((s) => `- ${s.type}: ${s.value}`)
    .join("\n");

  const qaDescription = `## QA Verification: ${state.input.title}

### What was built:
${devSummaries}

### Feature branch: \`${state.featureBranch || "unknown"}\`

### Original input/mockups:
${inputSources}

### Acceptance criteria (from requirements):
Check the requirements artifact on the epic ticket for full acceptance criteria.

### Your job:
1. Build and run the app on the feature branch
2. Visually compare EVERY affected page against the original mockups
3. Run functional tests (does the feature actually work?)
4. Run regression tests (is anything else broken?)
5. If all passes → report_completion
6. If anything fails → request_fix back to the dev agent with evidence`;

  // Create the QA ticket
  const qaTicket = await tickets().createTicket({
    parentId: epicId,
    title: `QA: Visual & functional verification`,
    description: qaDescription,
    assignee: "team-qa-verifier",
    blockedBy: [], // No blockers — devs are already done
  }, workflowId);

  console.log(`[engine] Created QA ticket ${qaTicket.id}, processing...`);

  // Process ready tickets (QA ticket is immediately ready since no blockers)
  await processReadyTickets(workflowId, epicId);
}

// ─── QA Fix Request Handler ─────────────────────────────────────────────────

const MAX_QA_RETRIES = 3;

/**
 * Handle a QA fix request — the QA agent found issues and is sending work
 * back to the dev agent. Creates a fix ticket assigned to the target dev agent,
 * then re-invokes the dev agent. After the fix, QA runs again.
 *
 * Called from webhook when event_type = "request_fix".
 */
export async function handleQaFixRequest(
  workflowId: string,
  payload: {
    targetAgent: string;       // dev agent to fix: "team-frontend-dev"
    findings: string;          // what failed (screenshots, diffs, error logs)
    severity: "blocking" | "cosmetic";
    qaTicketId: string;        // the QA ticket that found the issue
  }
): Promise<{ success: boolean; error?: string }> {
  const state = getWorkflow(workflowId);
  if (!state) {
    return { success: false, error: `Workflow ${workflowId} not found` };
  }

  // Track retry count
  state.qaRetryCount = (state.qaRetryCount || 0) + 1;

  if (state.qaRetryCount > MAX_QA_RETRIES) {
    // Escalate to human — too many fix cycles
    console.warn(`[engine] QA retry limit (${MAX_QA_RETRIES}) exceeded for workflow ${workflowId}. Escalating.`);

    const notification = {
      id: `notif-qa-escalation-${Date.now()}`,
      type: "blocker" as const,
      title: `QA verification failed after ${MAX_QA_RETRIES} fix cycles`,
      details: `The QA agent could not verify the output after ${MAX_QA_RETRIES} attempts. Latest findings:\n\n${payload.findings}`,
      timestamp: new Date().toISOString(),
      acknowledged: false,
    };
    state.humanNotifications.push(notification);
    emitEvent(workflowId, { type: "notification", notification });
    setWorkflow(state);
    persistWorkflow(workflowId);
    return { success: true };
  }

  console.log(`[engine] QA fix request #${state.qaRetryCount} → ${payload.targetAgent}`);

  // Transition back to development phase
  state.phase = "development";
  emitEvent(workflowId, { type: "phase_change", phase: "development" });

  // Create a fix ticket assigned to the target dev agent
  const fixDescription = `## Fix Required (QA Cycle #${state.qaRetryCount})

### QA Findings:
${payload.findings}

### Severity: ${payload.severity}

### Instructions:
1. Read the QA findings above carefully
2. Fix the issues on the feature branch: \`${state.featureBranch}\`
3. After fixing, run the app and visually verify against the original mockup
4. Take a screenshot and compare before reporting completion
5. Push the fix commit to the same branch

### Context:
- This is fix cycle #${state.qaRetryCount} of max ${MAX_QA_RETRIES}
- If you cannot fix the issue, add a comment explaining why and report_completion anyway
- The QA agent will re-verify after you complete`;

  const fixTicket = await tickets().createTicket({
    parentId: state.epicId,
    title: `Fix: QA findings (cycle #${state.qaRetryCount})`,
    description: fixDescription,
    assignee: payload.targetAgent,
    blockedBy: [], // Immediately ready
  }, workflowId);

  console.log(`[engine] Created fix ticket ${fixTicket.id} for ${payload.targetAgent}`);

  // Mark the QA ticket as "blocked" (waiting for fix) rather than done
  await tickets().markBlocked(payload.qaTicketId, `Waiting for fix from ${payload.targetAgent}`, workflowId);

  setWorkflow(state);
  persistWorkflow(workflowId);

  // Process the ready fix ticket (invoke the dev agent)
  await processReadyTickets(workflowId, state.epicId);

  return { success: true };
}

/**
 * After a dev agent completes a FIX ticket (qa retry), re-create the QA ticket
 * so the QA agent runs again to verify the fix.
 */
function isFixTicket(ticket: JiraTicket): boolean {
  return ticket.title.startsWith("Fix: QA findings");
}

// ─── Workflow Completion ─────────────────────────────────────────────────────

async function completeWorkflow(workflowId: string): Promise<void> {
  const state = getWorkflow(workflowId);
  if (!state || state.phase === "complete") return;

  state.phase = "complete";
  state.completedAt = new Date().toISOString();

  // If shared branch exists, create a single unified PR
  let prUrl = "";
  if (state.featureBranch) {
    try {
      const { owner, repo } = parseRepoUrlFromConfig(state.repoConfig);
      const baseBranch = state.repoConfig.repos[0]?.defaultBranch || "main";

      // List files on the branch to build PR description
      let filesOnBranch: string[] = [];
      try {
        const branchFiles = await callGitHubLambda("list_files", { owner, repo, path: "src", ref: state.featureBranch }) as Array<{ name: string }>;
        filesOnBranch = branchFiles?.map(f => f.name) || [];
      } catch { /* non-fatal */ }

      // Build PR body from all dev agent outputs
      const devOutputs = Object.values(state.agentTasks)
        .filter(t => t.status === "complete" && getAgentDef(t.agentId)?.phase === "development")
        .map(t => `### ${t.agentId}\n${(t.output || "").slice(0, 500)}`)
        .join("\n\n");

      const prBody = `## Summary\nAutomated implementation by agentic team workflow (${state.epicId}).\n\n## Agent Contributions\n${devOutputs}\n\n## Files Changed\nBranch: \`${state.featureBranch}\``;

      const prResult = await callGitHubLambda("create_pr", {
        owner,
        repo,
        title: `feat: ${state.input.title} (${state.epicId})`,
        body: prBody.slice(0, 5000),
        head: state.featureBranch,
        base: baseBranch,
      }) as { html_url?: string; number?: number };
      prUrl = prResult?.html_url || "";
      console.log(`[engine] Created unified PR: ${prUrl}`);
    } catch (err) {
      console.warn(`[engine] Failed to create unified PR: ${(err as Error).message}`);
    }
  }

  setWorkflow(state);
  persistWorkflow(workflowId);

  // Build summary
  const branches = Object.values(state.agentTasks)
    .filter((t) => t.branch)
    .map((t) => `- ${t.agentId}: \`${t.branch}\` (${t.commitSha?.slice(0, 7) || "N/A"})`)
    .join("\n");

  const summary = state.featureBranch
    ? `Workflow complete! All code committed to single branch: \`${state.featureBranch}\`${prUrl ? `\n\nPR: ${prUrl}` : ""}`
    : `Workflow complete! All tickets resolved.\n\nBranches created:\n${branches || "No code branches (design-only workflow)"}`;

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
 * Supports per-invocation model override (e.g., Opus for complex dev tasks).
 */
async function invokeAgent(
  harnessName: string,
  sessionId: string,
  prompt: string,
  workflowId: string,
  agentId: string,
  modelOverride?: { bedrockModelConfig?: { modelId: string }; openAiModelConfig?: { modelId: string; apiKeyArn: string } }
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
    ...(modelOverride ? { model: modelOverride } : {}),
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
          } else if (data.type === "trace") {
            if (data.event === "tool_start" && data.name) {
              // Forward tool-use events so the pipeline visualization can light up icons
              emitEvent(workflowId, { type: "tool_use", agentId, toolName: data.name });
            } else if (data.event === "block_stop" && data.name) {
              // Tool completed — capture duration if available
              emitEvent(workflowId, { type: "tool_end", agentId, toolName: data.name });
            } else if (data.event === "usage" && (data.inputTokens || data.outputTokens)) {
              // Token usage per model call
              emitEvent(workflowId, {
                type: "token_usage",
                agentId,
                inputTokens: data.inputTokens || 0,
                outputTokens: data.outputTokens || 0,
              });
            }
          }
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

  // Include repo context for ALL agents (needed for GitHubIntegration tool calls)
  if (state.repoConfig?.repos?.length > 0) {
    const { owner, repo } = parseRepoUrlFromConfig(state.repoConfig);
    const defaultBranch = state.repoConfig.repos[0]?.defaultBranch || "main";
    context += `## GitHub Repository Context\n`;
    context += `When calling ANY GitHubIntegration tool, use these values:\n`;
    context += `- owner: "${owner}"\n`;
    context += `- repo: "${repo}"\n`;
    context += `- default branch: "${defaultBranch}"\n\n`;
    context += `## S3 Workflow Artifacts\n`;
    context += `When calling S3Storage tools, workflow artifacts are at:\n`;
    context += `- Shared artifacts: workflows/${state.id}/shared/\n`;
    context += `- Your agent workspace: workflows/${state.id}/agents/${agentDef?.id || ticket.assignee}/\n\n`;
  }

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

  // For dev agents: inject the cumulative manifest so they can access ALL upstream artifacts
  if (agentDef?.phase === "development") {
    // Manifest-based context: inlines critical artifacts directly into prompt
    try {
      const manifest = await getManifest(state.id);
      if (manifest) {
        context += await buildManifestContext(manifest, agentDef.phase, agentDef.id);
      }
    } catch { /* manifest read failed — fall back to inline excerpts */ }

    // Fallback: if manifest is empty or unavailable, include truncated inline excerpts
    const manifest = await getManifest(state.id).catch(() => null);
    const hasManifestEntries = manifest && (
      manifest.phases.intake.length > 0 ||
      manifest.phases.design.length > 0 ||
      manifest.phases.requirements.length > 0
    );

    if (!hasManifestEntries) {
      context += `## Design Artifacts (inline excerpts)\n`;
      for (const [aid, task] of Object.entries(state.agentTasks)) {
        const def = getAgentDef(aid);
        if (def?.phase === "design" && task.status === "complete" && task.output) {
          context += `### ${def.name} Output\n${task.output.slice(0, 4000)}\n\n`;
        }
      }
    }

    context += `## Repository\n`;
    context += `Layout: ${state.repoConfig.layout}\n`;
    for (const repo of state.repoConfig.repos) {
      context += `- ${repo.platform}: ${repo.url} (branch: ${repo.defaultBranch}${repo.pathPrefix ? `, path: ${repo.pathPrefix}` : ""})\n`;
    }
    const baseBranch = state.featureBranch || state.repoConfig.repos[0]?.defaultBranch || "main";
    context += `\nBranch name: feature/${ticket.id}-${agentDef.id.replace("team-", "")}\n`;
    context += `Base branch (fork FROM this): ${baseBranch}\n`;
    context += `IMPORTANT: When calling create_branch, use from_branch: "${baseBranch}" — do NOT fork from main directly.\n`;
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
            context += `7. Use the EXISTING type definitions — do NOT redefine interfaces that already exist.\n`;
            context += `8. PREFER modifying existing files over creating new parallel modules. If a file is large, you MUST still modify it — use get_file to read it, then commit the full modified version. Do NOT create a wrapper/parallel file to avoid editing a large file.\n`;
            context += `9. All AWS ARNs, credentials, session IDs, and service identifiers are SERVER-ONLY. NEVER expose them via NEXT_PUBLIC_ environment variables. Client components call server API routes which handle AWS interaction.\n`;
            context += `10. Before your FINAL commit, review all files you created. If you iterated and created duplicate/abandoned files, DELETE them (commit an empty file or don't include them). Only ONE implementation of each feature should exist.\n`;
            context += `11. Never use template placeholder syntax like {{...}}. Write final, complete content directly.\n`;
            context += `12. Every feature must be FULLY WIRED end-to-end. If you create a utility function, it MUST be imported and called somewhere. If you create an API route, the UI MUST call it. No orphaned code.\n\n`;
          }
        }
      } catch { /* fallback failed — non-fatal */ }
    }
  }

  // For requirements and design agents: inject manifest so they can access intake sources directly
  if (agentDef?.phase === "requirements" || agentDef?.phase === "design") {
    try {
      const manifest = await getManifest(state.id);
      if (manifest) {
        context += await buildManifestContext(manifest, agentDef.phase, agentDef.id);
      }
    } catch { /* manifest read failed — non-fatal */ }
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

  // For dev agents: inject shared feature branch instruction
  if (agentDef?.phase === "development" && state.featureBranch) {
    context += `\n## SHARED FEATURE BRANCH\n`;
    context += `**CRITICAL: Do NOT create a new branch.** A shared feature branch already exists: \`${state.featureBranch}\`\n`;
    context += `All dev agents commit to this SAME branch so there will be ONE mergeable PR.\n`;
    context += `- Skip the create_branch step entirely\n`;
    context += `- Commit all your files directly to branch: \`${state.featureBranch}\`\n`;
    context += `- When committing, use the branch parameter: branch="${state.featureBranch}"\n`;
    context += `- Only the LAST dev agent to complete should create the PR (check if a PR already exists first)\n\n`;
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
  // Heuristic: if the requirements mention frontend/UI/React/component, skip designer
  const lowerOutput = output.toLowerCase();
  const isFrontendOnly = /\b(react|component|css|ui|visualization|frontend|next\.js|tailwind)\b/.test(lowerOutput) &&
    !/\b(api endpoint|database|lambda|dynamodb|backend service)\b/.test(lowerOutput);

  if (isFrontendOnly) {
    return {
      requirements: output,
      tickets: [
        {
          title: "Frontend Implementation",
          description: "Implement the frontend component based on requirements and design reference",
          assignee: "team-frontend-dev",
          blockedBy: [],
        },
      ],
    };
  }

  return {
    requirements: output,
    tickets: [
      {
        title: "Design",
        description: "Design the implementation based on requirements",
        assignee: getDefaultDesignAgent().id,
        blockedBy: [],
      },
      {
        title: "Implementation",
        description: "Implement the feature based on design specs",
        assignee: getDefaultDevAgent().id,
        blockedBy: ["Design"],
      },
    ],
  };
}

/**
 * Build keyword map dynamically from agent roster.
 * Generates keywords from agent id, name, role, and phase.
 */
function buildKeywordMap(): [string[], string][] {
  return AGENT_ROSTER.map((agent) => {
    const keywords: string[] = [];
    // Derive keywords from agent id (e.g., "team-ios-designer" → "iosdesigner")
    const idNormalized = agent.id.replace(/^team-/, "").replace(/[_\-\s]+/g, "");
    keywords.push(idNormalized);
    // Derive from name (e.g., "iOS Designer" → "iosdesigner")
    const nameNormalized = agent.name.toLowerCase().replace(/[_\-\s]+/g, "");
    keywords.push(nameNormalized);
    // Derive from phase
    keywords.push(agent.phase);
    // Derive component words from role (first 3 significant words)
    const roleWords = agent.role.toLowerCase()
      .replace(/[^a-z0-9\s]/g, "")
      .split(/\s+/)
      .filter((w) => w.length > 3)
      .slice(0, 5);
    keywords.push(...roleWords);
    return [keywords, agent.id] as [string[], string];
  });
}

/** Cached keyword map — built once from AGENT_ROSTER. */
const KEYWORD_MAP = buildKeywordMap();

/**
 * Resolve a fuzzy assignee name from the requirements agent to a valid agent ID.
 * The requirements agent sometimes outputs names like "ios-developer", "backend",
 * "security" instead of exact IDs like "team-frontend-dev".
 */
function resolveAssignee(rawAssignee: string): string {
  // Exact match first
  if (getAgentDef(rawAssignee)) return rawAssignee;

  const lower = rawAssignee.toLowerCase().replace(/[_\-\s]+/g, "");

  // Config-driven keyword → agent ID mapping (built from AGENT_ROSTER)
  for (const [keywords, agentId] of KEYWORD_MAP) {
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

  // Last resort: default to first dev agent for generic "developer" references
  if (lower.includes("dev") || lower.includes("implement") || lower.includes("engineer")) {
    return getDefaultDevAgent().id;
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
    const bucket = ARTIFACT_BUCKET;

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
    FunctionName: process.env.GITHUB_LAMBDA_NAME || "github-mcp",
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
  maxWaitMs: 600000,   // Give up after 10 min
};

/**
 * Monitor CI status for a branch after PR creation.
 * If CI fails, invoke the CI agent to analyze and fix.
 * Retries up to CI_CONFIG.maxRetries times before marking ticket blocked.
 */
async function monitorCIForBranch(
  workflowId: string,
  epicId: string,
  ticketId: string,
  devAgentId: string,
  repoConfig: import("./types").RepoConfig,
  branch: string
): Promise<void> {
  const { owner, repo } = parseRepoUrlFromConfig(repoConfig);
  if (!owner || !repo) return;

  let retryCount = 0;
  let elapsed = 0;

  emitEvent(workflowId, {
    type: "notification",
    notification: {
      id: `notif_ci_${Date.now()}`,
      type: "phase_complete",
      title: `CI Monitoring: ${branch}`,
      details: `Waiting for GitHub Actions to complete on branch ${branch}...`,
      timestamp: new Date().toISOString(),
      acknowledged: false,
    },
  });

  while (retryCount < CI_CONFIG.maxRetries && elapsed < CI_CONFIG.maxWaitMs) {
    // Wait for CI to have time to start and run
    await sleep(CI_CONFIG.pollIntervalMs);
    elapsed += CI_CONFIG.pollIntervalMs;

    try {
      // Get workflow runs for this branch
      const runs = await callGitHubLambda("get_workflow_runs", { owner, repo, branch }) as {
        runs: Array<{ id: number; status: string; conclusion: string | null }>;
      };

      const latestRun = runs.runs?.[0];
      if (!latestRun) continue; // No run yet, keep waiting

      if (latestRun.status !== "completed") continue; // Still running

      if (latestRun.conclusion === "success") {
        // CI passed!
        emitEvent(workflowId, {
          type: "notification",
          notification: {
            id: `notif_ci_pass_${Date.now()}`,
            type: "pr_ready",
            title: `CI Passed: ${branch}`,
            details: `Build and tests passed for ${branch}. PR is ready for review.`,
            timestamp: new Date().toISOString(),
            acknowledged: false,
          },
        });
        return; // Done — CI passed
      }

      if (latestRun.conclusion === "failure") {
        retryCount++;
        console.log(`[ci-monitor] CI failed for ${branch} (attempt ${retryCount}/${CI_CONFIG.maxRetries})`);

        // Get detailed failure logs
        const logs = await callGitHubLambda("get_workflow_logs", {
          owner, repo, run_id: String(latestRun.id),
        });

        // Invoke the CI agent to fix the issue
        const ciFixed = await invokeCIAgent(workflowId, ticketId, branch, logs, repoConfig, retryCount);

        if (!ciFixed) {
          // CI agent couldn't fix it — mark blocked
          emitEvent(workflowId, {
            type: "notification",
            notification: {
              id: `notif_ci_blocked_${Date.now()}`,
              type: "blocker",
              title: `CI Failed: ${branch}`,
              details: `Build failed after ${retryCount} fix attempts. Manual intervention needed.`,
              timestamp: new Date().toISOString(),
              acknowledged: false,
            },
          });
          return;
        }

        // CI agent pushed a fix — reset elapsed and wait for new CI run
        elapsed = 0;
      }
    } catch (err) {
      console.warn(`[ci-monitor] Poll error: ${(err as Error).message}`);
    }
  }

  if (retryCount >= CI_CONFIG.maxRetries) {
    console.log(`[ci-monitor] Max retries reached for ${branch}. Marking ticket for review.`);
    emitEvent(workflowId, {
      type: "notification",
      notification: {
        id: `notif_ci_max_${Date.now()}`,
        type: "blocker",
        title: `CI Fix Limit Reached: ${branch}`,
        details: `CI agent attempted ${retryCount} fixes but build still fails. Human review needed.`,
        timestamp: new Date().toISOString(),
        acknowledged: false,
      },
    });
  }
}

/**
 * Invoke the CI agent to analyze a build failure and fix it.
 * Returns true if the agent was able to push a fix commit.
 */
async function invokeCIAgent(
  workflowId: string,
  ticketId: string,
  branch: string,
  ciLogs: unknown,
  repoConfig: import("./types").RepoConfig,
  attempt: number
): Promise<boolean> {
  const ciAgentDef = getAgentDef("team-ci-agent");
  if (!ciAgentDef) {
    console.warn("[ci-monitor] CI agent not found in roster");
    return false;
  }

  const { owner, repo } = parseRepoUrlFromConfig(repoConfig);
  const sessionId = generateSessionId(ticketId, `ci-fix-${attempt}`);

  const context = `# CI Build Failure — Fix Required (Attempt ${attempt}/${CI_CONFIG.maxRetries})

## Repository
Owner: ${owner}
Repo: ${repo}
Branch: ${branch}

## CI Failure Logs
\`\`\`json
${JSON.stringify(ciLogs, null, 2).slice(0, 8000)}
\`\`\`

## Instructions
1. Analyze the failure above
2. Use get_file to read the relevant config/source files
3. Determine what's wrong (wrong paths, missing files, syntax errors)
4. Fix the issue by committing corrected files to branch: ${branch}
5. Report what you fixed

## Workflow Context
workflow_id: ${workflowId}
agent_id: team-ci-agent
`;

  try {
    emitEvent(workflowId, {
      type: "agent_status",
      agentId: "team-ci-agent",
      status: "running",
      ticketId,
    });

    const output = await invokeAgentWithRetry(
      ciAgentDef.harnessName,
      sessionId,
      context,
      workflowId,
      "team-ci-agent"
    );

    emitEvent(workflowId, {
      type: "agent_complete",
      agentId: "team-ci-agent",
      output: output.slice(0, 2000),
    });

    // Check if the agent committed a fix (look for commit SHA in output)
    const commitMatch = output.match(/commit[:\s]+`?([a-f0-9]{7,40})`?/i);
    return !!commitMatch;
  } catch (err) {
    console.error(`[ci-monitor] CI agent invocation failed: ${(err as Error).message}`);
    emitEvent(workflowId, {
      type: "error",
      agentId: "team-ci-agent",
      error: (err as Error).message,
    });
    return false;
  }
}

function parseRepoUrlFromConfig(repoConfig: import("./types").RepoConfig): { owner: string; repo: string } {
  const url = repoConfig.repos[0]?.url || "";
  const match = url.match(/github\.com\/([^/]+)\/([^/.]+)/);
  return { owner: match?.[1] || "", repo: match?.[2] || "" };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Crash Recovery & Resume ────────────────────────────────────────────────

/**
 * Resume any stalled workflows after server restart.
 * A workflow is "stalled" if it's not complete/error and has no running agents.
 * Called after rehydration.
 */
export async function resumeStalledWorkflows(): Promise<void> {
  const { listWorkflows } = await import("./store");
  const allWorkflows = listWorkflows();

  for (const wf of allWorkflows) {
    // Skip completed or errored workflows
    if (wf.phase === "complete" || wf.phase === "error") continue;

    // Check if any agents are "running" — they were interrupted by the crash
    const hasRunning = Object.values(wf.agentTasks).some(
      (t) => t.status === "running"
    );

    if (hasRunning) {
      // Mark crashed running tasks as "error" so they can be retried
      for (const task of Object.values(wf.agentTasks)) {
        if (task.status === "running") {
          task.status = "error";
          task.error = "Server restart — agent interrupted";

          // Reset the ticket to "ready" so it gets picked up again
          const ticket = getTicket(task.ticketId);
          if (ticket && ticket.status === "in_progress") {
            ticket.status = "ready";
            setTicket(ticket);
          }
        }
      }
      setWorkflow(wf);
    }

    // Check for ready tickets that need processing
    const readyTickets = getReadyTickets(wf.epicId);
    if (readyTickets.length > 0) {
      console.log(`[resume] Workflow ${wf.id} has ${readyTickets.length} ready tickets — resuming`);
      // Resume processing in background
      processReadyTickets(wf.id, wf.epicId).catch((err) => {
        console.error(`[resume] Failed to resume workflow ${wf.id}:`, err.message);
      });
    }
  }
}

// ─── Retry Logic ────────────────────────────────────────────────────────────

const MAX_RETRIES = 1;

/**
 * Invoke an agent with retry on failure.
 */
async function invokeAgentWithRetry(
  harnessName: string,
  sessionId: string,
  prompt: string,
  workflowId: string,
  agentId: string,
  modelOverride?: { bedrockModelConfig?: { modelId: string }; openAiModelConfig?: { modelId: string; apiKeyArn: string } }
): Promise<string> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const output = await invokeAgent(harnessName, sessionId, prompt, workflowId, agentId, modelOverride);
      if (!output || output.trim().length === 0) {
        throw new Error("Agent returned empty response");
      }
      return output;
    } catch (err) {
      lastError = err as Error;
      const errMsg = lastError.message || "";

      // Model validation failure — fallback to default model instead of retrying with same bad ID
      if (errMsg.includes("ValidationException") && modelOverride) {
        console.warn(`[retry] Agent ${agentId} model override failed ("${modelOverride.bedrockModelConfig?.modelId || modelOverride.openAiModelConfig?.modelId}"): ${errMsg.slice(0, 120)}. Falling back to default model.`);
        modelOverride = undefined; // Clear override, use harness default
        sessionId = `${sessionId}_fallback`;
        continue;
      }

      if (attempt < MAX_RETRIES) {
        console.warn(`[retry] Agent ${agentId} failed (attempt ${attempt + 1}): ${lastError.message}. Retrying...`);
        // Wait before retry (exponential backoff)
        await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
        // Use a new session ID for retry
        sessionId = `${sessionId}_retry${attempt + 1}`;
      }
    }
  }

  throw lastError || new Error(`Agent ${agentId} failed after ${MAX_RETRIES + 1} attempts`);
}

// ─── Post-Agent Completion S3 Check ──────────────────────────────────────────

/**
 * After a design/dev agent completes, check S3 for their work products.
 * The agent may have used the WorkflowOutput tools OR shell/file_operations.
 * Either way, we try to find what they produced.
 */
async function checkAgentArtifacts(workflowId: string, agentId: string): Promise<{
  hasDesignDoc: boolean;
  hasCompletionReport: boolean;
}> {
  const result = { hasDesignDoc: false, hasCompletionReport: false };

  try {
    const completionReport = await readArtifact({
      workflowId,
      agentId,
      filename: "completion-report.json",
    });
    if (completionReport) {
      result.hasCompletionReport = true;
    }
  } catch { /* ignore */ }

  try {
    // Check shared area for design docs
    const artifacts = await listArtifacts({ workflowId, agentId });
    result.hasDesignDoc = artifacts.some(
      (a) => a.key.endsWith(".md") && !a.key.includes("intake")
    );
  } catch { /* ignore */ }

  return result;
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Inject a human message into a workflow (answer a blocker, provide info).
 */
export function injectHumanMessage(
  workflowId: string,
  targetAgentId: string,
  content: string
): void {
  const state = getWorkflow(workflowId);
  if (!state) return;

  const message: AgentMessage = {
    id: `msg_${Date.now()}`,
    from: "human",
    to: targetAgentId,
    type: "answer",
    content,
    timestamp: new Date().toISOString(),
    resolved: true,
  };

  state.messages.push(message);
  setWorkflow(state);
  emitEvent(workflowId, { type: "message", message });
}

/**
 * Get current workflow state (for reconnection).
 */
export function getWorkflowState(workflowId: string): WorkflowState | undefined {
  return getWorkflow(workflowId);
}

/**
 * Manually retry a failed agent task.
 */
export async function retryAgentTask(workflowId: string, agentId: string): Promise<void> {
  const state = getWorkflow(workflowId);
  if (!state) return;

  const task = state.agentTasks[agentId];
  if (!task || task.status !== "error") return;

  // Find the ticket and reset it to ready
  const ticket = getTicket(task.ticketId);
  if (!ticket) return;

  ticket.status = "ready";
  setTicket(ticket);

  // Clear the error state
  delete state.agentTasks[agentId];
  setWorkflow(state);

  // Re-invoke
  await invokeAgentForTicket(workflowId, state.epicId, ticket);
}
