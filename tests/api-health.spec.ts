import { test, expect } from "@playwright/test";

test.describe("API: /api/health", () => {
  test("AC-1: returns HTTP 200", async ({ request }) => {
    const res = await request.get("/api/health");
    expect(res.status()).toBe(200);
  });

  test("AC-2: Content-Type is application/json", async ({ request }) => {
    const res = await request.get("/api/health");
    expect(res.headers()["content-type"]).toContain("application/json");
  });

  test("AC-3 & AC-8: body has exactly three keys (status, timestamp, uptime)", async ({
    request,
  }) => {
    const res = await request.get("/api/health");
    const body = await res.json();
    const keys = Object.keys(body).sort();
    expect(keys).toEqual(["status", "timestamp", "uptime"]);
  });

  test("AC-4: status equals 'ok'", async ({ request }) => {
    const res = await request.get("/api/health");
    const body = await res.json();
    expect(body.status).toBe("ok");
  });

  test("AC-5: timestamp parses as a valid Date", async ({ request }) => {
    const res = await request.get("/api/health");
    const body = await res.json();
    const date = new Date(body.timestamp);
    expect(date.toString()).not.toBe("Invalid Date");
  });

  test("AC-6: timestamp ends with Z (UTC)", async ({ request }) => {
    const res = await request.get("/api/health");
    const body = await res.json();
    expect(body.timestamp).toMatch(/Z$/);
  });

  test("AC-7: uptime is a non-negative number", async ({ request }) => {
    const res = await request.get("/api/health");
    const body = await res.json();
    expect(typeof body.uptime).toBe("number");
    expect(body.uptime).toBeGreaterThanOrEqual(0);
  });

  test("AC-9: sequential requests return non-decreasing uptime", async ({ request }) => {
    const res1 = await request.get("/api/health");
    const body1 = await res1.json();
    const res2 = await request.get("/api/health");
    const body2 = await res2.json();
    expect(body2.uptime).toBeGreaterThanOrEqual(body1.uptime);
  });
});
