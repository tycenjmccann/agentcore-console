"use client";

import { useState } from "react";
import { Bug, ChevronRight, ChevronDown, Terminal, FileCode, GitPullRequest, CheckCircle, XCircle, Clock, Play } from "lucide-react";

interface TraceStep {
  id: string;
  type: "THINKING" | "TOOL_CALL" | "TOOL_RESULT" | "FILE_WRITE" | "FILE_READ" | "SHELL" | "DECISION";
  title: string;
  detail: string;
  duration_ms: number;
  timestamp: string;
  status: "success" | "error";
}

interface TaskTrace {
  task_id: string;
  description: string;
  status: "COMPLETED" | "FAILED" | "RUNNING";
  agent: string;
  repo: string;
  started_at: string;
  completed_at?: string;
  total_steps: number;
  steps: TraceStep[];
}

const mockTrace: TaskTrace = {
  task_id: "t-010",
  description: "Add user preferences API endpoint",
  status: "COMPLETED",
  agent: "Backend Agent",
  repo: "tinder/backend-api",
  started_at: "2026-05-13T10:15:00Z",
  completed_at: "2026-05-13T10:19:32Z",
  total_steps: 12,
  steps: [
    { id: "s1", type: "THINKING", title: "Analyzing task requirements", detail: "Parsing task description and identifying required changes: new REST endpoint, database schema update, unit tests.", duration_ms: 2100, timestamp: "2026-05-13T10:15:00Z", status: "success" },
    { id: "s2", type: "SHELL", title: "Cloning repository", detail: "git clone https://github.com/tinder/backend-api.git && cd backend-api", duration_ms: 4500, timestamp: "2026-05-13T10:15:02Z", status: "success" },
    { id: "s3", type: "FILE_READ", title: "Reading existing API structure", detail: "Read src/routes/index.ts, src/models/user.ts, src/services/userService.ts to understand patterns", duration_ms: 800, timestamp: "2026-05-13T10:15:07Z", status: "success" },
    { id: "s4", type: "THINKING", title: "Planning implementation", detail: "Will create: 1) PreferencesModel, 2) PreferencesService, 3) /api/v1/preferences route, 4) Migration script, 5) Unit tests", duration_ms: 1500, timestamp: "2026-05-13T10:15:08Z", status: "success" },
    { id: "s5", type: "FILE_WRITE", title: "Creating preferences model", detail: "Created src/models/preferences.ts with UserPreferences interface and schema", duration_ms: 1200, timestamp: "2026-05-13T10:15:09Z", status: "success" },
    { id: "s6", type: "FILE_WRITE", title: "Creating preferences service", detail: "Created src/services/preferencesService.ts with CRUD operations", duration_ms: 1800, timestamp: "2026-05-13T10:15:11Z", status: "success" },
    { id: "s7", type: "FILE_WRITE", title: "Creating API route", detail: "Created src/routes/preferences.ts with GET, PUT, PATCH endpoints", duration_ms: 2200, timestamp: "2026-05-13T10:15:13Z", status: "success" },
    { id: "s8", type: "FILE_WRITE", title: "Creating migration script", detail: "Created migrations/042_add_preferences_table.sql", duration_ms: 900, timestamp: "2026-05-13T10:15:15Z", status: "success" },
    { id: "s9", type: "FILE_WRITE", title: "Writing unit tests", detail: "Created tests/preferences.test.ts with 12 test cases", duration_ms: 3200, timestamp: "2026-05-13T10:15:16Z", status: "success" },
    { id: "s10", type: "SHELL", title: "Running tests", detail: "npm test -- --testPathPattern=preferences\n\n12 tests passed, 0 failed", duration_ms: 8500, timestamp: "2026-05-13T10:15:19Z", status: "success" },
    { id: "s11", type: "SHELL", title: "Creating pull request", detail: "git add . && git commit -m 'feat: add user preferences API endpoint' && gh pr create --title 'feat: add user preferences API' --body '...'", duration_ms: 5200, timestamp: "2026-05-13T10:15:28Z", status: "success" },
    { id: "s12", type: "DECISION", title: "Task complete", detail: "PR created: https://github.com/tinder/backend-api/pull/142\nAll tests passing. Migration script included.", duration_ms: 500, timestamp: "2026-05-13T10:15:33Z", status: "success" },
  ],
};

const evalResults = [
  { name: "Code quality check", passed: true, score: 92 },
  { name: "Test coverage", passed: true, score: 88 },
  { name: "Security scan", passed: true, score: 100 },
  { name: "API contract validation", passed: true, score: 95 },
  { name: "Performance benchmark", passed: false, score: 72 },
];

const typeIcons: Record<string, typeof Terminal> = {
  THINKING: Bug,
  TOOL_CALL: Terminal,
  TOOL_RESULT: Terminal,
  FILE_WRITE: FileCode,
  FILE_READ: FileCode,
  SHELL: Terminal,
  DECISION: CheckCircle,
};

export default function DebugPage() {
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set(["s1"]));
  const [tab, setTab] = useState<"traces" | "evals">("traces");

  const toggleStep = (id: string) => {
    setExpandedSteps((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex gap-1 bg-surface-2 rounded-lg p-1 w-fit">
        <button
          onClick={() => setTab("traces")}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            tab === "traces" ? "bg-surface-4 text-white" : "text-gray-500 hover:text-gray-300"
          }`}
        >
          Execution Traces
        </button>
        <button
          onClick={() => setTab("evals")}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            tab === "evals" ? "bg-surface-4 text-white" : "text-gray-500 hover:text-gray-300"
          }`}
        >
          Evaluations
        </button>
      </div>

      {tab === "traces" && (
        <>
          {/* Task Header */}
          <div className="card">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-white">{mockTrace.description}</h3>
                <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                  <span>{mockTrace.agent}</span>
                  <span>|</span>
                  <span>{mockTrace.repo}</span>
                  <span>|</span>
                  <span>{mockTrace.total_steps} steps</span>
                  <span>|</span>
                  <span>4m 32s total</span>
                </div>
              </div>
              <span className="text-xs px-2.5 py-1 rounded-full border bg-green-400/10 text-green-400 border-green-400/30">
                {mockTrace.status}
              </span>
            </div>

            {/* State progression */}
            <div className="mt-4 flex items-center gap-2">
              {["SUBMITTED", "HYDRATING", "RUNNING", "FINALIZING", "COMPLETED"].map((state, i) => (
                <div key={state} className="flex items-center gap-2">
                  <div className={`text-xs px-2 py-0.5 rounded ${
                    i <= 4 ? "bg-green-400/10 text-green-400" : "bg-surface-3 text-gray-500"
                  }`}>
                    {state}
                  </div>
                  {i < 4 && <ChevronRight className="w-3 h-3 text-gray-600" />}
                </div>
              ))}
            </div>
          </div>

          {/* Trace Steps */}
          <div className="space-y-1">
            {mockTrace.steps.map((step, idx) => {
              const Icon = typeIcons[step.type] || Terminal;
              const isExpanded = expandedSteps.has(step.id);
              return (
                <div key={step.id} className="card !p-0 overflow-hidden">
                  <button
                    onClick={() => toggleStep(step.id)}
                    className="w-full flex items-center gap-3 p-3 hover:bg-surface-3/50 transition-colors text-left"
                    data-testid={`trace-step-${step.id}`}
                  >
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4 text-gray-500 flex-shrink-0" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-gray-500 flex-shrink-0" />
                    )}
                    <span className="text-xs text-gray-600 w-6">{idx + 1}</span>
                    <Icon className={`w-4 h-4 flex-shrink-0 ${
                      step.status === "success" ? "text-green-400" : "text-red-400"
                    }`} />
                    <span className="text-sm text-gray-300 flex-1">{step.title}</span>
                    <span className="text-xs text-gray-600">{step.duration_ms}ms</span>
                  </button>
                  {isExpanded && (
                    <div className="px-12 pb-3 border-t border-surface-4/50">
                      <pre className="text-xs text-gray-400 mt-2 whitespace-pre-wrap font-mono bg-surface-0 rounded p-3">
                        {step.detail}
                      </pre>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {tab === "evals" && (
        <>
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">Run evaluations against agent outputs</p>
            <button className="btn-primary flex items-center gap-2 text-sm" data-testid="run-eval-btn">
              <Play className="w-4 h-4" />
              Run Evaluation
            </button>
          </div>

          <div className="card">
            <h3 className="text-sm font-semibold text-gray-300 mb-4">Latest Evaluation — Task t-010</h3>
            <div className="space-y-3">
              {evalResults.map((result) => (
                <div key={result.name} className="flex items-center justify-between py-2 border-b border-surface-4 last:border-0">
                  <div className="flex items-center gap-3">
                    {result.passed ? (
                      <CheckCircle className="w-4 h-4 text-green-400" />
                    ) : (
                      <XCircle className="w-4 h-4 text-red-400" />
                    )}
                    <span className="text-sm text-gray-300">{result.name}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-24 h-1.5 bg-surface-3 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${result.score >= 80 ? "bg-green-400" : result.score >= 60 ? "bg-yellow-400" : "bg-red-400"}`}
                        style={{ width: `${result.score}%` }}
                      />
                    </div>
                    <span className={`text-xs font-medium ${result.score >= 80 ? "text-green-400" : result.score >= 60 ? "text-yellow-400" : "text-red-400"}`}>
                      {result.score}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t border-surface-4 flex items-center justify-between">
              <span className="text-sm text-gray-400">Overall Score</span>
              <span className="text-lg font-bold text-green-400">89.4%</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
