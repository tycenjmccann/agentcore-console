# PRD: Real-Time Pipeline Visualization

## Summary

Replace the existing column-based `WorkflowBoard` component with an animated horizontal pipeline visualization. The new component must be driven by real SSE workflow events (not scripted timings), support close-laptop-and-reconnect (derive visual state from fetched WorkflowState), and fire a celebration animation on `workflow_complete`.

**Visual reference:** `demo/agentis-v1-pipeline.html` (self-contained HTML demo showing the target aesthetic)
**Screenshot:** `demo/pipeline-screenshot.png`

---

## Current State

The current `WorkflowBoard` (`src/components/workflow/WorkflowBoard.tsx`) renders:
- Vertical phase columns (PhaseColumn components)
- AgentCards inside each column showing task status (pending/running/complete/error)
- Streaming text output per agent
- 3-second polling fallback + SSE live updates
- Status: functional but visually basic (text-heavy, no animation)

---

## Target State

An animated pipeline visualization matching the aesthetic of `demo/agentis-v1-pipeline.html`:

- **Layout:** Horizontal pipeline with 5 phase boxes arranged left-to-right
- **Phase boxes:** Dark card (`bg-#1a2332`, border `#1e293b`) with phase name, agent count, identity row (AgentCore + Bedrock icons as colored indicators)
- **Agent items:** Rows within each phase showing tools, agents, skills, and outputs
- **SVG connectors:** Animated paths between phases that light up as data flows
- **Status bar:** Bottom status showing current phase + description
- **Animations:** CSS keyframe animations for agent working state (breathing pulse), phase activation, celebration burst

### Visual States

| Element State | Visual Treatment |
|---------------|-----------------|
| Inactive/pending | Dimmed (opacity 0.35), border `#1e293b` |
| Active (phase current) | Full opacity, translateY(0) |
| Awake (agent box) | Blue border `#0ea5e9`, blue glow shadow |
| Working (agent item) | Pulsing blue border animation (1s cycle) |
| Done (agent item) | Green dot, reduced opacity 0.7 |
| Done (agent box) | Green border `#22c55e50`, subtle glow |
| Trigger (firing connector) | Orange flash `#f97316`, scale pulse |
| Celebration | All elements burst orange/white then settle to done state |

---

## Real-Time Event Mapping

The component receives SSE events from `/api/workflow/{id}/stream`. Map them to visual state:

| SSE Event | Visual Effect |
|-----------|--------------|
| `phase_change` | New phase: add `.active` to phase div, `.awake` to agent box. Previous phase: add `.done` |
| `agent_status: running` | Agent item gets `.working` class (pulsing blue border animation) |
| `agent_status: complete` | Agent item gets `.done` class (green indicator) |
| `agent_status: error` | Agent item gets `.error` class (red indicator) |
| `agent_output` | Accumulate streaming text; show in expandable panel below agent |
| `agent_complete` | Mark agent done, show output summary, activate output items (S3 write, Gateway) |
| `ticket_created` | Flash `.trigger` on the output item that produced the ticket |
| `workflow_complete` | Add `.celebrate` class to wrapper div — burst animation on all done elements |

---

## Reconnection Behavior (Critical Requirement)

When a user closes their laptop and comes back, the component must show the **current state immediately** without replaying the animation from the beginning.

### On Component Mount:
1. Fetch `GET /api/workflow/{id}/state` → get full `WorkflowState`
2. Fetch `GET /api/workflow/{id}/tickets` → get all tickets
3. **Derive visual state from data:**
   - `state.phase` tells us which phase is current
   - Phases before current → `.done` class (instant, no transition)
   - Current phase → `.active` class
   - Future phases → default (dimmed)
   - `state.agentTasks[agentId].status === "complete"` → `.done` on that agent item
   - `state.agentTasks[agentId].status === "running"` → `.working` on that agent item
   - `state.agentTasks[agentId].status === "pending"` → default
   - `state.phase === "complete"` → show celebration settled state (not the burst, just the final glow)
4. Open SSE connection for live updates going forward
5. On SSE error/disconnect: exponential backoff reconnect, re-fetch state on reconnect

### NO replay animation on reconnect. Instant state render.

---

## Technical Constraints

- **Component interface:** `<WorkflowBoard workflowId={string} />` — drop-in replacement
- **Page integration:** Used in `src/app/workflow/page.tsx`, no changes to page needed
- **Framework:** Next.js 14 App Router, `"use client"` component
- **Styling:** Tailwind CSS for layout + inline `<style>` block for @keyframes animations
- **Types:** Use existing from `src/lib/workflow/types.ts`:
  - `WorkflowState`, `WorkflowPhase`, `AgentTask`, `AgentTaskStatus`
  - `WorkflowEvent` (the SSE event type union)
- **SSE endpoint:** `GET /api/workflow/{id}/stream` (existing, no changes)
- **State endpoint:** `GET /api/workflow/{id}/state` (existing, no changes)
- **Polling fallback:** Keep 3-second polling as backup (existing pattern)
- **No external libraries:** CSS animations only (no Framer Motion, no GSAP)

---

## Dynamic Agent Rendering

The pipeline must render **dynamically** based on which agents have tasks in the current workflow — NOT hardcoded to all 13 agents.

```typescript
// Derive phases and agents from state
const phases = groupBy(Object.values(state.agentTasks), task => {
  const agent = AGENT_ROSTER.find(a => a.id === task.agentId);
  return agent?.phase;
});
```

- Only show phase columns that have at least one agent task
- Within each phase, only show agents that have been assigned work
- The phase box header should show the count: "3 Agents (parallel)" or "1 Agent"

---

## Component Structure

```
<PipelineVisualization workflowId={string}>
  ├─ <style> CSS keyframes + animation classes </style>
  ├─ <StatusBar> current phase + description text
  ├─ <div class="pipeline"> horizontal flex container
  │   ├─ <PhaseBox phase="requirements" state={...}>
  │   │   ├─ Phase header (name, agent count, model indicator)
  │   │   ├─ Tool items (S3, Memory, Gateway, etc.)
  │   │   ├─ Agent items (with working/done states)
  │   │   ├─ Skill items (loaded skills)
  │   │   └─ Output items (S3 write, Gateway completion)
  │   │
  │   ├─ <SVGConnector from="requirements" to="design" />
  │   ├─ <PhaseBox phase="design" state={...}>
  │   │   └─ ... (multiple agents shown)
  │   ├─ <SVGConnector ... />
  │   └─ ... remaining phases
  │
  └─ <AgentOutputPanel> expandable streaming output (when agent clicked)
```

---

## Acceptance Criteria

1. Pipeline renders horizontally with phase boxes and SVG connector paths
2. Phase boxes activate in real-time as `phase_change` events arrive
3. Agent items animate through idle → working (pulse) → done (green) states
4. Parallel agents within a phase all show as working simultaneously
5. SVG connectors animate between phases when a phase completes and triggers the next
6. Streaming output is accessible (click agent to expand output panel)
7. Celebration animation fires on `workflow_complete` (single burst, settles to glow)
8. **Close-and-reopen shows correct current state without replay animation**
9. Responsive: horizontally scrollable on viewports < 1720px
10. Performance: CSS animations only, no layout thrash on rapid SSE events
11. Dark theme: background `#0f1419`, text `#e2e8f0`, consistent with current app

---

## Out of Scope (for this iteration)

- Embedded AWS service icons (use colored dots/small indicators instead)
- Detailed config panels (model IDs, max turns, timeouts) inside phase boxes
- Legend bar at the top
- The "Play/Replay" button (this isn't a scripted demo, it's live state)
- Agent-to-agent message visualization
- Ticket dependency graph

---

## Reference Files

| File | Purpose |
|------|---------|
| `demo/agentis-v1-pipeline.html` | Visual reference (animation style, layout, colors) |
| `demo/pipeline-screenshot.png` | Static screenshot of target aesthetic |
| `src/components/workflow/WorkflowBoard.tsx` | Current implementation to replace |
| `src/lib/workflow/types.ts` | TypeScript types (WorkflowState, events, etc.) |
| `src/lib/workflow/agents.ts` | Agent roster (IDs, phases, tools, roles) |
| `src/app/api/workflow/[id]/stream/route.ts` | SSE endpoint (don't modify) |
| `src/app/api/workflow/[id]/state/route.ts` | State endpoint (don't modify) |
