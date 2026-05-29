import { test, expect } from "@playwright/test";

test.describe("Connectors Validation", () => {
  test("page loads and displays correct title", async ({ page }) => {
    await page.goto("/connectors");
    await expect(page.getByText("Connector Validation")).toBeVisible();
    await expect(
      page.getByText("Monitor and validate external service connections")
    ).toBeVisible();
  });

  test("all 4 connector cards are visible", async ({ page }) => {
    await page.goto("/connectors");
    await expect(page.getByText("GitHub")).toBeVisible();
    await expect(page.getByText("Jira")).toBeVisible();
    await expect(page.getByText("Slack")).toBeVisible();
    await expect(page.getByText("AWS S3")).toBeVisible();
  });

  test("status badges show correctly", async ({ page }) => {
    await page.goto("/connectors");
    await expect(page.getByText("Connected").first()).toBeVisible();
    await expect(page.getByText("Failed")).toBeVisible();
    await expect(page.getByText("Validating")).toBeVisible();
  });

  test("status summary bar shows correct counts", async ({ page }) => {
    await page.goto("/connectors");
    const summaryBar = page.locator(".card").filter({ hasText: "Healthy" });
    await expect(summaryBar.getByText("2")).toBeVisible();
    await expect(summaryBar.getByText("Healthy")).toBeVisible();
    await expect(summaryBar.getByText("1").first()).toBeVisible();
    await expect(summaryBar.getByText("Validating")).toBeVisible();
    await expect(summaryBar.getByText("Failed")).toBeVisible();
  });

  test("validation history table renders with correct data", async ({
    page,
  }) => {
    await page.goto("/connectors");
    await expect(page.getByText("Validation History")).toBeVisible();
    const table = page.locator("table");
    await expect(table).toBeVisible();
    // Table headers
    await expect(table.getByText("Connector")).toBeVisible();
    await expect(table.getByText("Status")).toBeVisible();
    await expect(table.getByText("Checks")).toBeVisible();
    await expect(table.getByText("Duration")).toBeVisible();
    await expect(table.getByText("Timestamp")).toBeVisible();
    // Table data
    await expect(table.getByText("5/5").first()).toBeVisible();
    await expect(table.getByText("2/4")).toBeVisible();
    await expect(table.getByText("1.2s")).toBeVisible();
    await expect(table.getByText("2 min ago")).toBeVisible();
  });

  test("Validate All button exists and is clickable", async ({ page }) => {
    await page.goto("/connectors");
    const validateBtn = page.getByRole("button", { name: "Validate All" });
    await expect(validateBtn).toBeVisible();
    await expect(validateBtn).toBeEnabled();
  });

  test("API /api/connectors returns valid JSON with connector data", async ({
    request,
  }) => {
    const res = await request.get("/api/connectors");
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty("connectors");
    expect(Array.isArray(data.connectors)).toBe(true);
    expect(data.connectors).toHaveLength(4);

    const ids = data.connectors.map((c: { id: string }) => c.id);
    expect(ids).toContain("github");
    expect(ids).toContain("jira");
    expect(ids).toContain("slack");
    expect(ids).toContain("s3");

    const github = data.connectors.find(
      (c: { id: string }) => c.id === "github"
    );
    expect(github).toHaveProperty("name", "GitHub");
    expect(github).toHaveProperty("status", "connected");
    expect(github).toHaveProperty("checks");
    expect(github.checks.total).toBe(5);
    expect(github.checks.passed).toBe(5);
  });

  test("API /api/connectors/validate returns validation results", async ({
    request,
  }) => {
    const res = await request.post("/api/connectors/validate");
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty("results");
    expect(data).toHaveProperty("validatedAt");
    expect(Array.isArray(data.results)).toBe(true);
    expect(data.results).toHaveLength(4);

    const github = data.results.find(
      (r: { id: string }) => r.id === "github"
    );
    expect(github).toHaveProperty("status", "connected");
    expect(github.checks.total).toBe(5);
    expect(github.checks.passed).toBe(5);
  });
});
