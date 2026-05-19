/**
 * Unit tests for GET /api/workflow/list/summary
 */

import { computeWorkflowStats, formatDuration, computeProgressPercent } from "@/lib/workflow/stats";

describe("computeWorkflowStats", () => {
  it("returns all pending when no agent tasks exist and phase is intake", () => {
    const workflow = { phase: "intake", agentTasks: {} };
    const stats = computeWorkflowStats(workflow);

    expect(stats.agentProgress.total).toBe(13); // all agents in roster
    expect(stats.agentProgress.pending).toBe(13);
    expect(stats.agentProgress.running).toBe(0);
    expect(stats.agentProgress.completed).toBe(0);
    expect(stats.agentProgress.failed).toBe(0);
  });

  it("counts running/completed agents correctly", () => {
    const workflow = {
      phase: "design",
      agentTasks: {
        "team-requirements-analyst": { status: "complete" },
        "team-ios-designer": { status: "running" },
        "team-backend-designer": { status: "running" },
        "team-android-designer": { status: "pending" },
        "team-security-reviewer": { status: "error" },
      },
    };
    const stats = computeWorkflowStats(workflow);

    expect(stats.agentProgress.total).toBe(5);
    expect(stats.agentProgress.completed).toBe(1);
    expect(stats.agentProgress.running).toBe(2);
    expect(stats.agentProgress.pending).toBe(1);
    expect(stats.agentProgress.failed).toBe(1);
  });

  it("marks all phases complete when workflow phase is complete", () => {
    const workflow = {
      phase: "complete",
      agentTasks: {
        "team-requirements-analyst": { status: "complete" },
        "team-ios-designer": { status: "complete" },
        "team-backend-dev": { status: "complete" },
        "team-qa-verifier": { status: "complete" },
        "team-ci-agent": { status: "complete" },
      },
    };
    const stats = computeWorkflowStats(workflow);

    expect(stats.phaseBreakdown.requirements).toBe("complete");
    expect(stats.phaseBreakdown.design).toBe("complete");
    expect(stats.phaseBreakdown.development).toBe("complete");
    expect(stats.phaseBreakdown.verification).toBe("complete");
    expect(stats.phaseBreakdown.review).toBe("complete");
  });

  it("marks earlier phases as complete and current as active", () => {
    const workflow = {
      phase: "development",
      agentTasks: {
        "team-requirements-analyst": { status: "complete" },
        "team-backend-dev": { status: "running" },
      },
    };
    const stats = computeWorkflowStats(workflow);

    expect(stats.phaseBreakdown.requirements).toBe("complete");
    expect(stats.phaseBreakdown.design).toBe("complete");
    expect(stats.phaseBreakdown.development).toBe("active");
    expect(stats.phaseBreakdown.verification).toBe("pending");
    expect(stats.phaseBreakdown.review).toBe("pending");
  });

  it("infers requirements running when phase is requirements", () => {
    const workflow = { phase: "requirements", agentTasks: {} };
    const stats = computeWorkflowStats(workflow);

    expect(stats.agentProgress.running).toBe(1);
    expect(stats.agentProgress.pending).toBe(12);
  });
});

describe("formatDuration", () => {
  it("returns < 1m for short durations", () => {
    expect(formatDuration(30_000)).toBe("< 1m");
    expect(formatDuration(0)).toBe("< 1m");
  });

  it("formats minutes and seconds", () => {
    expect(formatDuration(90_000)).toBe("1m 30s");
    expect(formatDuration(300_000)).toBe("5m");
  });

  it("formats hours and minutes", () => {
    expect(formatDuration(3_660_000)).toBe("1h 1m");
    expect(formatDuration(7_200_000)).toBe("2h");
  });
});

describe("computeProgressPercent", () => {
  it("returns 0 when no agents", () => {
    const stats = { agentProgress: { total: 0, completed: 0, running: 0, pending: 0, failed: 0 }, phaseBreakdown: {} as any };
    expect(computeProgressPercent(stats)).toBe(0);
  });

  it("computes correct percentage", () => {
    const stats = { agentProgress: { total: 10, completed: 7, running: 2, pending: 1, failed: 0 }, phaseBreakdown: {} as any };
    expect(computeProgressPercent(stats)).toBe(70);
  });
});
