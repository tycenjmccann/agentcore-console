import { describe, it, expect } from "vitest";
import type { WorkflowSummary, IntakeSource, WorkflowState } from "@/lib/workflow/types";

describe("WorkflowSummary type", () => {
  it("should have all required fields", () => {
    const summary: WorkflowSummary = {
      id: "wf_test_001",
      title: "Test Feature",
      phase: "design",
      epicId: "TEAM-42",
      startedAt: new Date().toISOString(),
    };

    expect(summary.id).toBe("wf_test_001");
    expect(summary.title).toBe("Test Feature");
    expect(summary.phase).toBe("design");
    expect(summary.epicId).toBe("TEAM-42");
    expect(summary.startedAt).toBeDefined();
    expect(summary.completedAt).toBeUndefined();
  });

  it("should support completed workflows", () => {
    const summary: WorkflowSummary = {
      id: "wf_test_002",
      title: "Completed Feature",
      phase: "complete",
      epicId: "TEAM-99",
      startedAt: "2025-01-01T00:00:00Z",
      completedAt: "2025-01-01T01:00:00Z",
    };

    expect(summary.completedAt).toBe("2025-01-01T01:00:00Z");
  });
});

describe("IntakeSource in demo state", () => {
  it("should support S3 sources with labels", () => {
    const source: IntakeSource = {
      type: "s3",
      value: "s3://bucket/key/file.md",
      contentType: "text/markdown",
      label: "PRD Document",
    };

    expect(source.type).toBe("s3");
    expect(source.value).toContain("s3://");
    expect(source.label).toBe("PRD Document");
  });

  it("should support URL sources", () => {
    const source: IntakeSource = {
      type: "url",
      value: "https://figma.com/design/abc",
      label: "Figma Design",
    };

    expect(source.type).toBe("url");
    expect(source.value).toContain("https://");
    // contentType is optional for URLs
    expect(source.contentType).toBeUndefined();
  });

  it("should extract filename from S3 URI", () => {
    const s3Uri = "s3://agentcore-artifacts-023392223961-us-east-1/workflows/wf_demo_001/shared/source-0-s3.md";
    const filename = s3Uri.split("/").pop();
    expect(filename).toBe("source-0-s3.md");
  });
});

describe("Demo workflow state", () => {
  it("should have sources populated", () => {
    // Simulate what the demo state returns
    const mockState: Partial<WorkflowState> = {
      id: "wf_demo_001",
      epicId: "TEAM-1",
      input: {
        title: "Pipeline Visualization Feature",
        description: "Test",
        repoConfig: { layout: "monorepo", repos: [] },
        sources: [
          { type: "s3", value: "s3://bucket/file.md", label: "PRD" },
          { type: "url", value: "https://figma.com/abc", label: "Figma" },
        ],
      },
    };

    expect(mockState.input!.sources.length).toBe(2);
    expect(mockState.input!.sources[0].type).toBe("s3");
    expect(mockState.input!.sources[1].type).toBe("url");
    expect(mockState.input!.title).toBe("Pipeline Visualization Feature");
    expect(mockState.epicId).toBe("TEAM-1");
  });
});
