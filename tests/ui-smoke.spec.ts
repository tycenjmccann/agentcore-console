import { test, expect } from "@playwright/test";

test.describe("Agentis MVP - UI Smoke Tests", () => {
  test("Dashboard renders with stats and navigation", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("h1")).toContainText("Agentis");
    await expect(page.locator("[data-testid='nav-dashboard']")).toBeVisible();
    await expect(page.locator("[data-testid='nav-agents']")).toBeVisible();
    await expect(page.locator("[data-testid='nav-build']")).toBeVisible();
    await expect(page.locator("[data-testid='nav-deploy']")).toBeVisible();
    await expect(page.locator("[data-testid='nav-invoke']")).toBeVisible();
    await expect(page.locator("[data-testid='nav-monitor']")).toBeVisible();
    await expect(page.locator("[data-testid='nav-debug']")).toBeVisible();
    // Stats should be visible
    await expect(page.getByText("Active Agents")).toBeVisible();
    await expect(page.getByText("Tasks Today")).toBeVisible();
    await expect(page.getByText("Success Rate")).toBeVisible();
    await expect(page.getByText("PRs Created")).toBeVisible();
  });

  test("Agents page shows agent cards", async ({ page }) => {
    await page.goto("/agents");
    await expect(page.locator("[data-testid='agent-card-agent-backend-001']")).toBeVisible();
    await expect(page.getByText("Backend Agent")).toBeVisible();
    await expect(page.getByText("iOS Agent")).toBeVisible();
    await expect(page.getByText("Security Agent")).toBeVisible();
    await expect(page.locator("[data-testid='create-agent-btn']")).toBeVisible();
  });

  test("Agent detail page renders", async ({ page }) => {
    await page.goto("/agents/agent-backend-001");
    await expect(page.getByText("Backend Agent")).toBeVisible();
    await expect(page.getByText("Blueprint Configuration")).toBeVisible();
    await expect(page.getByText("Recent Tasks")).toBeVisible();
  });

  test("Build page shows builder chat interface", async ({ page }) => {
    await page.goto("/build");
    await expect(page.getByText("Agent Builder Chat")).toBeVisible();
    await expect(page.getByText("Harness Mode")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Harness Configuration" })).toBeVisible();
    await expect(page.locator("[data-testid='build-description-input']")).toBeVisible();
    await expect(page.locator("[data-testid='build-submit-btn']")).toBeVisible();
    await expect(page.locator("[data-testid='deploy-agent-btn']")).toBeVisible();
  });

  test("Build page - send message triggers builder stream", async ({ page }) => {
    await page.goto("/build");
    const input = page.locator("[data-testid='build-description-input']");
    await input.fill("I need a backend API agent");
    await expect(input).toHaveValue("I need a backend API agent");
    // Verify submit button is enabled when input has value
    await expect(page.locator("[data-testid='build-submit-btn']")).toBeEnabled();
  });

  test("Deploy page shows agent deployments", async ({ page }) => {
    await page.goto("/deploy");
    await expect(page.getByText("Backend Agent")).toBeVisible();
    await expect(page.getByText("iOS Agent")).toBeVisible();
    await expect(page.locator("[data-testid='deploy-new-btn']")).toBeVisible();
    // Check status badges
    await expect(page.getByText("Running").first()).toBeVisible();
  });

  test("Invoke page shows streaming chat interface", async ({ page }) => {
    await page.goto("/invoke");
    await expect(page.locator("[data-testid='invoke-agent-selector']")).toBeVisible();
    await expect(page.locator("[data-testid='invoke-chat-input']")).toBeVisible();
    await expect(page.locator("[data-testid='invoke-send-btn']")).toBeVisible();
    // Info banner should be visible
    await expect(page.getByText("Interactive chat is in preview")).toBeVisible();
  });

  test("Invoke page - send message works", async ({ page }) => {
    await page.goto("/invoke");
    const input = page.locator("[data-testid='invoke-chat-input']");
    await input.fill("Build a new user preferences API");
    await expect(input).toHaveValue("Build a new user preferences API");
    // Verify send button is enabled
    await expect(page.locator("[data-testid='invoke-send-btn']")).toBeEnabled();
  });

  test("Monitor page shows metrics and invocation log", async ({ page }) => {
    await page.goto("/monitor");
    await expect(page.getByRole("heading", { name: "Invocations (24h)" })).toBeVisible();
    await expect(page.getByText("Avg Duration")).toBeVisible();
    await expect(page.getByText("Error Rate")).toBeVisible();
    await expect(page.getByText("Recent Invocations")).toBeVisible();
    // Table should have data
    await expect(page.getByText("Add user preferences API")).toBeVisible();
  });

  test("Debug page shows execution traces", async ({ page }) => {
    await page.goto("/debug");
    await expect(page.getByText("Execution Traces")).toBeVisible();
    await expect(page.getByText("Evaluations")).toBeVisible();
    // Trace steps should be visible
    await expect(page.locator("[data-testid='trace-step-s1']")).toBeVisible();
    await expect(page.getByText("Analyzing task requirements")).toBeVisible();
  });

  test("Debug page - evaluations tab", async ({ page }) => {
    await page.goto("/debug");
    await page.getByText("Evaluations").click();
    await expect(page.locator("[data-testid='run-eval-btn']")).toBeVisible();
    await expect(page.getByText("Code quality check")).toBeVisible();
    await expect(page.getByText("Overall Score")).toBeVisible();
  });

  test("Navigation between pages works", async ({ page }) => {
    await page.goto("/");
    await page.locator("[data-testid='nav-agents']").click();
    await expect(page).toHaveURL("/agents");
    await page.locator("[data-testid='nav-build']").click();
    await expect(page).toHaveURL("/build");
    await page.locator("[data-testid='nav-monitor']").click();
    await expect(page).toHaveURL("/monitor");
    await page.locator("[data-testid='nav-debug']").click();
    await expect(page).toHaveURL("/debug");
  });

  test("Global search input is accessible", async ({ page }) => {
    await page.goto("/");
    const search = page.locator("[data-testid='global-search']");
    await expect(search).toBeVisible();
    await search.fill("backend");
    await expect(search).toHaveValue("backend");
  });
});
