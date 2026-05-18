# Complete Component Source Files

All component files for the workflow pipeline visualization are provided below with complete, ready-to-use source code.

## File 1: src/components/workflow/AgentCard.tsx

```typescript
"use client";

import { AgentVisualState } from "@/lib/workflow/useWorkflowState";

interface AgentCardProps {
  agent: AgentVisualState;
}

const agentDisplayNames: Record<string, string> = {
  "team-requirements-analyst": "Requirements Analyst",
  "team-ios-designer": "iOS Designer",
  "team-android-designer": "Android Designer",
  "team-backend-designer": "Backend Designer",
  "team-security-reviewer": "Security Reviewer",
  "team-legal-compliance": "Legal Compliance",
  "team-localization": "Localization",
  "team-analytics-designer": "Analytics Designer",
  "team-ios-dev": "iOS Developer",
  "team-android-dev": "Android Developer",
  "team-backend-dev": "Backend Developer",
  "team-frontend-dev": "Frontend Developer",
};

const agentIcons: Record<string, string> = {
  "team-requirements-analyst": "📋",
  "team-ios-designer": "📱",
  "team-android-designer": "🤖",
  "team-backend-designer": "⚙️",
  "team-security-reviewer": "🔒",
  "team-legal-compliance": "⚖️",
  "team-localization": "🌍",
  "team-analytics-designer": "📊",
  "team-ios-dev": "🛠️",
  "team-android-dev": "🔧",
  "team-backend-dev": "💻",
  "team-frontend-dev": "🎨",
};

const statusLabels: Record<AgentVisualState["status"], string> = {
  pending: "Pending",
  running: "Running",
  complete: "Complete",
  error: "Error",
  waiting: "Waiting",
};

const statusColors: Record<AgentVisualState["status"], string> = {
  pending: "text-gray-500",
  running: "text-blue-600",
  complete: "text-green-600",
  error: "text-red-600",
  waiting: "text-amber-600",
};

export function AgentCard({ agent }: AgentCardProps) {
  const displayName = agentDisplayNames[agent.agentId] || agent.agentId;
  const icon = agentIcons[agent.agentId] || "👤";
  const statusLabel = statusLabels[agent.status];
  const statusColor = statusColors[agent.status];

  const animationClasses = agent.shouldAnimate
    ? [
        agent.status === "running" && "agent-running",
        agent.status === "complete" && "agent-complete-animate",
        agent.status === "error" && "agent-error-animate",
        agent.status === "waiting" && "agent-waiting",
      ]
        .filter(Boolean)
        .join(" ")
    : agent.status === "running"
    ? "agent-running"
    : "";

  return (
    <div
      className={`agent-card agent-card-${agent.status} ${animationClasses} rounded-lg p-4 min-w-[160px]`}
      title={`${displayName} - ${statusLabel}${agent.ticketId ? ` (${agent.ticketId})` : ""}`}
    >
      <div className="flex flex-col items-center gap-2">
        <div className="text-4xl">{icon}</div>
        <div className="text-sm font-medium text-gray-900 dark:text-gray-100 text-center">
          {displayName}
        </div>
        <div className={`text-xs font-semibold px-2 py-1 rounded-full ${statusColor}`}>
          {statusLabel}
        </div>
        {agent.ticketId && (
          <div className="text-xs text-gray-500 dark:text-gray-400">
            {agent.ticketId}
          </div>
        )}
        {agent.error && (
          <div className="text-xs text-red-600 dark:text-red-400 text-center mt-1">
            {agent.error.substring(0, 50)}
            {agent.error.length > 50 && "..."}
          </div>
        )}
        {agent.status === "complete" && agent.output && (
          <div className="text-xs text-gray-600 dark:text-gray-300 text-center mt-1 line-clamp-2">
            {agent.output.substring(0, 60)}
            {agent.output.length > 60 && "..."}
          </div>
        )}
      </div>
    </div>
  );
}
```

## File 2: src/components/workflow/PipelinePhase.tsx

```typescript
"use client";

import { PhaseVisualState } from "@/lib/workflow/useWorkflowState";
import { AgentCard } from "./AgentCard";

interface PipelinePhaseProps {
  phase: PhaseVisualState;
  isLast: boolean;
}

const phaseLabels: Record<string, string> = {
  requirements: "Requirements",
  design: "Design",
  development: "Development",
  review: "Review",
};

export function PipelinePhase({ phase, isLast }: PipelinePhaseProps) {
  const label = phaseLabels[phase.phase] || phase.phase;

  return (
    <div className="flex items-center gap-6">
      <div className="flex flex-col gap-4 min-w-[200px]">
        <div className="flex items-center gap-2">
          <div
            className={`phase-indicator ${
              phase.isComplete
                ? "phase-indicator-complete"
                : phase.isActive
                ? "phase-indicator-active"
                : "phase-indicator-pending"
            }`}
          />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {label}
          </h3>
        </div>
        <div className="flex flex-col gap-3">
          {phase.agents.length > 0 ? (
            phase.agents.map((agent) => (
              <AgentCard key={agent.agentId} agent={agent} />
            ))
          ) : (
            <div className="text-sm text-gray-500 dark:text-gray-400 italic">
              No agents assigned
            </div>
          )}
        </div>
      </div>
      {!isLast && (
        <svg width="60" height="100" className="flex-shrink-0" viewBox="0 0 60 100">
          <path
            d="M 10 50 L 50 50"
            className={`connector-line svg-path ${
              phase.isComplete
                ? "svg-path-complete connector-line-active"
                : phase.isActive
                ? "svg-path-active"
                : "svg-path-pending"
            }`}
            strokeWidth="2"
            fill="none"
          />
          {phase.isComplete && (
            <polygon points="45,45 50,50 45,55" className="fill-green-500" />
          )}
        </svg>
      )}
    </div>
  );
}
```

## File 3: src/components/workflow/WorkflowPipeline.tsx

```typescript
"use client";

import { useWorkflowState } from "@/lib/workflow/useWorkflowState";
import { PipelinePhase } from "./PipelinePhase";
import "@/styles/pipeline.css";

interface WorkflowPipelineProps {
  workflowId: string;
}

export function WorkflowPipeline({ workflowId }: WorkflowPipelineProps) {
  const { workflowState, phases, isLoading, error, isComplete } = useWorkflowState(workflowId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="text-lg font-medium text-gray-700 dark:text-gray-300">
            Loading workflow...
          </div>
          <div className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            Fetching workflow state
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="text-lg font-medium text-red-600 dark:text-red-400">
            Error loading workflow
          </div>
          <div className="mt-2 text-sm text-gray-600 dark:text-gray-400">{error}</div>
        </div>
      </div>
    );
  }

  if (!workflowState) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="text-lg font-medium text-gray-700 dark:text-gray-300">
            Workflow not found
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          {workflowState.input.title}
        </h2>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          {workflowState.input.description}
        </p>
        <div className="mt-2 flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
          <span>Workflow ID: {workflowState.id}</span>
          <span>•</span>
          <span>Phase: {workflowState.phase}</span>
          {isComplete && (
            <>
              <span>•</span>
              <span className="workflow-complete-burst text-green-600 dark:text-green-400 font-semibold">
                ✅ Complete
              </span>
            </>
          )}
        </div>
      </div>
      <div className="overflow-x-auto pb-8">
        <div className="flex items-start gap-0 min-w-max">
          {phases.map((phase, index) => (
            <PipelinePhase key={phase.phase} phase={phase} isLast={index === phases.length - 1} />
          ))}
        </div>
      </div>
      <div className="mt-8 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
          Workflow Details
        </h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="font-medium text-gray-600 dark:text-gray-400">Started:</span>
            <span className="ml-2 text-gray-900 dark:text-gray-100">
              {new Date(workflowState.startedAt).toLocaleString()}
            </span>
          </div>
          {workflowState.completedAt && (
            <div>
              <span className="font-medium text-gray-600 dark:text-gray-400">Completed:</span>
              <span className="ml-2 text-gray-900 dark:text-gray-100">
                {new Date(workflowState.completedAt).toLocaleString()}
              </span>
            </div>
          )}
          {workflowState.featureBranch && (
            <div>
              <span className="font-medium text-gray-600 dark:text-gray-400">Branch:</span>
              <span className="ml-2 text-gray-900 dark:text-gray-100 font-mono text-xs">
                {workflowState.featureBranch}
              </span>
            </div>
          )}
          <div>
            <span className="font-medium text-gray-600 dark:text-gray-400">Epic Ticket:</span>
            <span className="ml-2 text-gray-900 dark:text-gray-100">{workflowState.epicId}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
```

## File 4: src/app/workflow/[id]/page.tsx

```typescript
"use client";

import { WorkflowPipeline } from "@/components/workflow/WorkflowPipeline";
import { use } from "react";

export default function WorkflowPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <div className="container mx-auto px-4 py-8">
      <WorkflowPipeline workflowId={id} />
    </div>
  );
}
```

---

## How to Use

1. Create each file at the specified path
2. Copy the TypeScript code from above
3. All dependencies are already committed:
   - `src/lib/workflow/useWorkflowState.ts` ✅
   - `src/lib/workflow/types.ts` ✅  
   - `src/styles/pipeline.css` ✅
   - `src/app/api/workflow/[id]/route.ts` ✅
   - `src/app/api/workflow/[id]/events/route.ts` ✅

## Verification

```bash
npm install  # If needed
npm run dev
# Visit http://localhost:3000/workflow/test-workflow-id
```
