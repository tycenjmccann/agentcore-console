import { test, expect } from "@playwright/test";

test.describe("Connector Config API", () => {
  test.setTimeout(15_000);

  test("POST /api/connectors/config returns 400 for missing fields", async ({ request }) => {
    const res = await request.post("/api/connectors/config", {
      data: { workspaceId: "ws-123" },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty("error");
    expect(body.error).toContain("required");
  });

  test("POST /api/connectors/config returns 400 for invalid connectorType", async ({ request }) => {
    const res = await request.post("/api/connectors/config", {
      data: { workspaceId: "ws-123", connectorType: "invalid", name: "Test" },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("connectorType");
  });

  test("GET /api/connectors/config returns 400 without workspaceId", async ({ request }) => {
    const res = await request.get("/api/connectors/config");
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty("error");
    expect(body.error).toContain("workspaceId");
  });
});

test.describe("Connector Validate API", () => {
  test.setTimeout(15_000);

  test("POST /api/connectors/validate returns 400 without connectorIds", async ({ request }) => {
    const res = await request.post("/api/connectors/validate", {
      data: { workspaceId: "ws-123" },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty("error");
    expect(body.error).toContain("connectorIds");
  });

  test("POST /api/connectors/validate returns 400 with empty connectorIds", async ({ request }) => {
    const res = await request.post("/api/connectors/validate", {
      data: { workspaceId: "ws-123", connectorIds: [] },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("connectorIds");
  });

  test("POST /api/connectors/validate returns 400 without workspaceId", async ({ request }) => {
    const res = await request.post("/api/connectors/validate", {
      data: { connectorIds: ["conn_abc123"] },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("workspaceId");
  });
});

test.describe("Connector Health API", () => {
  test.setTimeout(15_000);

  test("GET /api/connectors/health returns 400 without workspaceId", async ({ request }) => {
    const res = await request.get("/api/connectors/health");
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty("error");
    expect(body.error).toContain("workspaceId");
  });
});

test.describe("Connector Preflight API", () => {
  test.setTimeout(15_000);

  test("POST /api/connectors/preflight returns 400 without workflowId", async ({ request }) => {
    const res = await request.post("/api/connectors/preflight", {
      data: {},
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty("error");
    expect(body.error).toContain("workflowId");
  });
});
