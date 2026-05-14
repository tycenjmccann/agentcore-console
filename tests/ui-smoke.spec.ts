import { test, expect } from "@playwright/test";

test.describe("Agentis Hub - UI Smoke Tests", () => {
  test("Dashboard renders with agent activity metrics", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("h1")).toContainText("Agentis");
    // Navigation
    await expect(page.locator("[data-testid='nav-dashboard']")).toBeVisible();
    await expect(page.locator("[data-testid='nav-agents']")).toBeVisible();
    await expect(page.locator("[data-testid='nav-build']")).toBeVisible();
    await expect(page.locator("[data-testid='nav-routing']")).toBeVisible();
    // Agent Activity metrics
    await expect(page.getByText("Invocations")).toBeVisible();
    await expect(page.getByText("Tokens")).toBeVisible();
    await expect(page.getByText("Active Agents")).toBeVisible();
    // Agent Performance table
    await expect(page.getByText("Agent Performance")).toBeVisible();
  });

  test("Dashboard loads real agent data", async ({ page }) => {
    await page.goto("/");
    // Wait for agents to load (replaces "Discovering agents...")
    await expect(page.getByText("Discovering agents...")).not.toBeVisible({ timeout: 15000 });
    // Should show agent table with real data
    await expect(page.locator("table")).toBeVisible();
    // At least one agent should be listed
    await expect(page.locator("table tbody tr").first()).toBeVisible();
  });

  test("Agents page shows discovered agents", async ({ page }) => {
    await page.goto("/agents");
    // Wait for agent cards to load
    await expect(page.getByText("Discovering agents...")).not.toBeVisible({ timeout: 15000 });
    // Should have at least one agent card
    await expect(page.locator(".card, [class*='card']").first()).toBeVisible();
  });

  test("Agent detail page renders chat interface", async ({ page }) => {
    await page.goto("/");
    // Wait for data then click first agent link
    await expect(page.getByText("Discovering agents...")).not.toBeVisible({ timeout: 15000 });
    await page.locator("table tbody tr a").first().click();
    // Should show agent detail with chat
    await expect(page.getByText("Chat")).toBeVisible({ timeout: 10000 });
    await expect(page.locator("input[placeholder*='message'], textarea[placeholder*='message']").first()).toBeVisible();
  });

  test("Build page shows builder chat interface", async ({ page }) => {
    await page.goto("/build");
    await expect(page.getByText("Agent Builder Chat")).toBeVisible();
    await expect(page.getByText("Harness Mode")).toBeVisible();
    await expect(page.locator("[data-testid='build-description-input']")).toBeVisible();
    await expect(page.locator("[data-testid='build-submit-btn']")).toBeVisible();
    await expect(page.locator("[data-testid='deploy-agent-btn']")).toBeVisible();
  });

  test("Build page - input accepts text", async ({ page }) => {
    await page.goto("/build");
    const input = page.locator("[data-testid='build-description-input']");
    await input.fill("I need a backend API agent");
    await expect(input).toHaveValue("I need a backend API agent");
    await expect(page.locator("[data-testid='build-submit-btn']")).toBeEnabled();
  });

  test("Routing page renders pipeline UI", async ({ page }) => {
    await page.goto("/routing");
    await expect(page.getByText("Agent Routing Pipeline")).toBeVisible();
    await expect(page.getByText("Sample Tickets")).toBeVisible();
    await expect(page.getByText("Pipeline")).toBeVisible();
    // Pipeline stages
    await expect(page.getByText("Jira Intake")).toBeVisible();
    await expect(page.getByText("Design Agent")).toBeVisible();
    await expect(page.getByText("Dev Agent")).toBeVisible();
    await expect(page.getByText("Complete")).toBeVisible();
  });

  test("Routing page - sample ticket selection fills form", async ({ page }) => {
    await page.goto("/routing");
    // Click first sample ticket
    await page.locator("button").filter({ hasText: "Add push notification" }).click();
    // Title and description should be filled
    const titleInput = page.locator("input[placeholder*='title']");
    await expect(titleInput).not.toBeEmpty();
  });

  test("Navigation between pages works", async ({ page }) => {
    await page.goto("/");
    await page.locator("[data-testid='nav-agents']").click();
    await expect(page).toHaveURL("/agents");
    await page.locator("[data-testid='nav-build']").click();
    await expect(page).toHaveURL("/build");
    await page.locator("[data-testid='nav-routing']").click();
    await expect(page).toHaveURL("/routing");
    await page.locator("[data-testid='nav-dashboard']").click();
    await expect(page).toHaveURL("/");
  });

  test("Region selector is visible in header", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("us-east-1")).toBeVisible();
  });
});
