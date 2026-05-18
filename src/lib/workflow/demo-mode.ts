/**
 * Demo Mode — Simulates the full workflow pipeline with pre-canned responses.
 *
 * When DEMO_MODE=true, the engine uses this module instead of real AgentCore invocations.
 * Each "agent" completes after a realistic delay with pre-written output, allowing
 * the full lifecycle to play out in ~3 minutes for demo recordings.
 */

import type { WorkflowInput, WorkflowState, AgentTask } from "./types";
import { getWorkflow, setWorkflow, emitEvent, persistWorkflow } from "./store";
import { getTicketProvider } from "./ticket-provider";
import type { TicketProvider } from "./ticket-provider";
import { getAgentDef } from "./agents";

export const DEMO_MODE = process.env.DEMO_MODE === "true";

function tickets(): TicketProvider {
  return getTicketProvider();
}

// Pre-canned agent outputs for "Add light/dark mode" feature
const DEMO_OUTPUTS: Record<string, { delay: number; output: string }> = {
  "team-requirements-analyst": {
    delay: 12000, // 12 seconds
    output: `## Requirements Analysis Complete

### Feature: Add Light/Dark Mode Toggle

**Scope**: Full-stack (frontend only — theme toggle with system preference detection)

**Requirements**:
1. Theme toggle switch in the header/settings area
2. Persist user preference in localStorage
3. Respect system color-scheme preference on first visit
4. Smooth transition between themes (CSS transitions)
5. All existing components must support both themes
6. Accessible contrast ratios maintained in both modes

**Acceptance Criteria**:
- [ ] Toggle switch visually indicates current theme
- [ ] Theme persists across page reloads
- [ ] System preference detected on first visit
- [ ] No flash of wrong theme on load (FOUC prevention)
- [ ] All text meets WCAG AA contrast in both modes

**Affected Agents**: backend-designer (CSS variables/theme system), frontend-dev (implementation)`,
  },
  "team-backend-designer": {
    delay: 15000, // 15 seconds
    output: `## Design: Theme System Architecture

### Approach: CSS Custom Properties + Next.js Theme Provider

**Theme Token Structure**:
\`\`\`css
:root[data-theme="light"] {
  --color-bg-primary: #ffffff;
  --color-bg-secondary: #f8f9fa;
  --color-text-primary: #1a1a2e;
  --color-text-secondary: #4a4a6a;
  --color-border: #e2e8f0;
  --color-accent: #6366f1;
  --color-card-bg: #ffffff;
  --color-sidebar-bg: #1a1a2e;
}

:root[data-theme="dark"] {
  --color-bg-primary: #0f0f1a;
  --color-bg-secondary: #1a1a2e;
  --color-text-primary: #e2e8f0;
  --color-text-secondary: #94a3b8;
  --color-border: #2d2d44;
  --color-accent: #818cf8;
  --color-card-bg: #1e1e32;
  --color-sidebar-bg: #0a0a14;
}
\`\`\`

**Implementation Plan**:
1. Create \`src/lib/theme-provider.tsx\` — React Context + localStorage + system detection
2. Create \`src/styles/themes.css\` — CSS custom property definitions
3. Add \`ThemeToggle\` component to Header
4. Update \`layout.tsx\` to wrap app in ThemeProvider
5. Prevent FOUC with inline script in \`<head>\`

**Component Changes Required**:
- Header.tsx — Add toggle button
- Sidebar.tsx — Use CSS variables instead of hardcoded colors
- All card components — Use var(--color-card-bg)
- Layout.tsx — Add provider + anti-FOUC script`,
  },
  "team-frontend-dev": {
    delay: 20000, // 20 seconds
    output: `## Implementation Complete: Light/Dark Mode

### Files Created/Modified:

**New Files**:
- \`src/lib/theme-provider.tsx\` — ThemeProvider context with localStorage persistence
- \`src/components/layout/ThemeToggle.tsx\` — Toggle button with sun/moon icons
- \`src/styles/themes.css\` — Complete CSS custom property system

**Modified Files**:
- \`src/app/layout.tsx\` — Added ThemeProvider wrapper + anti-FOUC script
- \`src/components/layout/Header.tsx\` — Added ThemeToggle component
- \`src/components/layout/Sidebar.tsx\` — Converted to CSS variables
- \`src/app/globals.css\` — Added theme variable imports

### Key Implementation Details:
- Used \`next-themes\` pattern but custom implementation (no extra dependency)
- Anti-FOUC: Inline \`<script>\` in layout reads localStorage before paint
- System preference: \`matchMedia('(prefers-color-scheme: dark)')\` with event listener
- Transition: 200ms ease on background-color and color properties
- Toggle animation: Smooth rotation between sun ↔ moon icons

### Branch: \`feature/TEAM-101-add-light-dark-mode\`
### Commit: \`a3f7b2c\` — feat: add light/dark mode with system preference detection

All acceptance criteria verified:
✅ Toggle switch works and indicates current theme
✅ Theme persists across reloads (localStorage)
✅ System preference detected on first visit
✅ No FOUC (inline script runs before render)
✅ WCAG AA contrast ratios in both modes`,
  },
};

/**
 * Start a demo workflow — same as real startWorkflow but uses simulated agents.
 */
export async function startDemoWorkflow(input: WorkflowInput): Promise<string> {
  const workflowId = `wf_demo_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

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

  // Run the demo pipeline asynchronously
  runDemoPipeline(workflowId, epic.id, input).catch((err) => {
    console.error(`Demo workflow error:`, err);
  });

  return workflowId;
}

async function runDemoPipeline(workflowId: string, epicId: string, input: WorkflowInput) {
  const state = getWorkflow(workflowId)!;

  // Short intake pause
  await delay(2000);

  // Phase: Requirements
  state.phase = "requirements";
  setWorkflow(state);
  emitEvent(workflowId, { type: "phase_change", phase: "requirements" });

  const reqAgent = getAgentDef("team-requirements-analyst")!;
  const reqDemo = DEMO_OUTPUTS["team-requirements-analyst"];

  // Mark requirements agent as running
  state.agentTasks[reqAgent.id] = {
    id: `task_demo_req`,
    agentId: reqAgent.id,
    ticketId: epicId,
    status: "running",
    input: "demo",
    startedAt: new Date().toISOString(),
  };
  setWorkflow(state);
  await tickets().markInProgress(epicId, workflowId);
  emitEvent(workflowId, { type: "agent_status", agentId: reqAgent.id, status: "running", ticketId: epicId });

  // Simulate streaming chunks during requirements phase
  await simulateStreaming(workflowId, reqAgent.id, reqDemo.output, reqDemo.delay);

  // Requirements complete — create design + dev tickets
  state.agentTasks[reqAgent.id].status = "complete";
  state.agentTasks[reqAgent.id].output = reqDemo.output;
  state.agentTasks[reqAgent.id].completedAt = new Date().toISOString();
  setWorkflow(state);
  emitEvent(workflowId, { type: "agent_complete", agentId: reqAgent.id, output: reqDemo.output });
  await tickets().markDone(epicId, workflowId);

  // Create design ticket
  const designTicket = await tickets().createTicket({
    parentId: epicId,
    title: "Design: Theme system architecture & CSS variables",
    description: "Define the CSS custom property token system, theme provider architecture, and component change plan.",
    assignee: "team-backend-designer",
    blockedBy: [],
  }, workflowId);
  emitEvent(workflowId, { type: "ticket_created", ticket: designTicket });

  // Create dev ticket (blocked by design)
  const devTicket = await tickets().createTicket({
    parentId: epicId,
    title: "Implement: Light/dark mode toggle with persistence",
    description: "Implement ThemeProvider, ThemeToggle component, CSS variables, and update all components.",
    assignee: "team-frontend-dev",
    blockedBy: [designTicket.id],
  }, workflowId);
  emitEvent(workflowId, { type: "ticket_created", ticket: devTicket });

  // Phase: Design
  state.phase = "design";
  setWorkflow(state);
  emitEvent(workflowId, { type: "phase_change", phase: "design" });

  // Run design agent
  const designAgent = getAgentDef("team-backend-designer")!;
  const designDemo = DEMO_OUTPUTS["team-backend-designer"];

  state.agentTasks[designAgent.id] = {
    id: `task_demo_design`,
    agentId: designAgent.id,
    ticketId: designTicket.id,
    status: "running",
    input: "demo",
    startedAt: new Date().toISOString(),
  };
  setWorkflow(state);
  await tickets().markInProgress(designTicket.id, workflowId);
  emitEvent(workflowId, { type: "agent_status", agentId: designAgent.id, status: "running", ticketId: designTicket.id });

  await simulateStreaming(workflowId, designAgent.id, designDemo.output, designDemo.delay);

  // Design complete
  state.agentTasks[designAgent.id].status = "complete";
  state.agentTasks[designAgent.id].output = designDemo.output;
  state.agentTasks[designAgent.id].completedAt = new Date().toISOString();
  setWorkflow(state);
  emitEvent(workflowId, { type: "agent_complete", agentId: designAgent.id, output: designDemo.output });
  await tickets().markDone(designTicket.id, workflowId);

  // Phase: Development (dev ticket now unblocked)
  await delay(1500);
  state.phase = "development";
  setWorkflow(state);
  emitEvent(workflowId, { type: "phase_change", phase: "development" });

  // Create feature branch
  state.featureBranch = `feature/${epicId}-add-light-dark-mode`;
  setWorkflow(state);

  // Run frontend dev agent
  const devAgent = getAgentDef("team-frontend-dev")!;
  const devDemo = DEMO_OUTPUTS["team-frontend-dev"];

  state.agentTasks[devAgent.id] = {
    id: `task_demo_dev`,
    agentId: devAgent.id,
    ticketId: devTicket.id,
    status: "running",
    input: "demo",
    startedAt: new Date().toISOString(),
  };
  setWorkflow(state);
  await tickets().markInProgress(devTicket.id, workflowId);
  emitEvent(workflowId, { type: "agent_status", agentId: devAgent.id, status: "running", ticketId: devTicket.id });

  await simulateStreaming(workflowId, devAgent.id, devDemo.output, devDemo.delay);

  // Dev complete
  state.agentTasks[devAgent.id].status = "complete";
  state.agentTasks[devAgent.id].output = devDemo.output;
  state.agentTasks[devAgent.id].branch = `feature/${epicId}-add-light-dark-mode`;
  state.agentTasks[devAgent.id].commitSha = "a3f7b2c4e8d1f6a9b3c5e7d2f4a8b1c6e3d5f7a9";
  state.agentTasks[devAgent.id].completedAt = new Date().toISOString();
  setWorkflow(state);
  emitEvent(workflowId, { type: "agent_complete", agentId: devAgent.id, output: devDemo.output, branch: state.featureBranch });
  await tickets().markDone(devTicket.id, workflowId);

  // Workflow complete
  await delay(2000);
  state.phase = "complete";
  state.completedAt = new Date().toISOString();
  setWorkflow(state);
  persistWorkflow(workflowId);

  const summary = `Workflow complete! All code committed to branch: \`${state.featureBranch}\`\n\nPR: https://github.com/tycenj/agentcore-console/pull/27`;
  emitEvent(workflowId, { type: "workflow_complete", summary });
  emitEvent(workflowId, {
    type: "notification",
    notification: {
      id: `notif_complete_${Date.now()}`,
      type: "pr_ready",
      title: "Workflow Complete — PR Ready for Review",
      details: summary,
      timestamp: new Date().toISOString(),
      acknowledged: false,
    },
  });
}

/**
 * Simulate agent streaming — emits text chunks over time.
 */
async function simulateStreaming(workflowId: string, agentId: string, fullOutput: string, totalDuration: number) {
  const lines = fullOutput.split("\n");
  const chunkSize = Math.max(1, Math.floor(lines.length / 8));
  const chunkDelay = totalDuration / Math.ceil(lines.length / chunkSize);

  for (let i = 0; i < lines.length; i += chunkSize) {
    const chunk = lines.slice(i, i + chunkSize).join("\n");
    emitEvent(workflowId, { type: "agent_output", agentId, chunk });
    await delay(chunkDelay);
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
