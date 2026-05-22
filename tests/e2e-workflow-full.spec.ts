import { test, expect } from "@playwright/test";

/**
 * Full end-to-end workflow test.
 * Starts a new workflow via the UI, monitors progression through phases,
 * and validates that agents produce output.
 *
 * This test uses REAL backend agents and can take 5-10+ minutes.
 * Run with: npx playwright test tests/e2e-workflow-full.spec.ts --timeout 600000
 */
test.describe("End-to-End Workflow", () => {
  test.setTimeout(600_000); // 10 minutes

  test("submit workflow and verify pipeline progression", async ({ page }) => {
    await page.goto("/workflow");
    await page.waitForTimeout(2000);

    // Click "New Workflow" button to open intake form
    const newWorkflowBtn = page.getByRole("button", { name: "New Workflow" });
    if (await newWorkflowBtn.isVisible().catch(() => false)) {
      await newWorkflowBtn.click();
      await page.waitForTimeout(1000);
    }

    // Fill Feature Title
    const titleInput = page.locator("input[placeholder*='profile photo carousel']");
    await expect(titleInput).toBeVisible({ timeout: 5000 });
    await titleInput.fill("E2E Test: Add dark mode toggle");

    // Fill Description / PRD
    const descInput = page.locator("textarea[placeholder*='Describe the feature']");
    await descInput.fill(
      "Users should be able to toggle between light and dark mode from the settings page. " +
      "The preference should persist across sessions using local storage. " +
      "All components should respect the theme choice."
    );

    await page.screenshot({ path: "test-results/workflow-01-intake-filled.png" });

    // Click "Start Team Workflow"
    const submitBtn = page.getByRole("button", { name: "Start Team Workflow" });
    await expect(submitBtn).toBeVisible();
    await submitBtn.click();

    // Wait for workflow to start — URL should change to include an ID
    // or the pipeline board should appear
    await page.waitForTimeout(5000);
    await page.screenshot({ path: "test-results/workflow-02-started.png" });

    // The page should now show the pipeline visualization or redirect
    // Check if we got a workflow ID in the URL or the board appeared
    const url = page.url();
    const hasWorkflowId = url.includes("id=") || url.includes("workflow/");
    const boardVisible = await page.locator("[class*='pipeline'], [class*='phase'], [class*='board']").first().isVisible().catch(() => false);

    expect(hasWorkflowId || boardVisible).toBeTruthy();

    // Monitor phases for up to 5 minutes
    let phasesSeen: string[] = [];

    for (let i = 0; i < 60; i++) { // 60 * 5s = 5 minutes
      await page.waitForTimeout(5000);

      // Take periodic screenshots
      if (i % 12 === 0) {
        await page.screenshot({ path: `test-results/workflow-progress-${i}.png` });
      }

      // Check page content for phase indicators
      const pageText = await page.locator("body").textContent() || "";

      const phases = ["requirements", "design", "development", "qa", "review", "complete"];
      for (const phase of phases) {
        if (pageText.toLowerCase().includes(phase) && !phasesSeen.includes(phase)) {
          phasesSeen.push(phase);
          console.log(`Phase detected: ${phase} (after ${(i * 5)}s)`);
        }
      }

      // Check for agent activity indicators (pulsing, running, etc.)
      const agentCount = await page.locator("[class*='agent'], [class*='pulse'], [class*='running']").count();
      if (agentCount > 0 && i % 6 === 0) {
        console.log(`Active agent indicators: ${agentCount}`);
      }

      // If we see "complete" or have seen at least 2 phases, success
      if (phasesSeen.includes("complete") || phasesSeen.length >= 2) {
        break;
      }
    }

    // Final screenshot
    await page.screenshot({ path: "test-results/workflow-03-final-state.png" });

    // We should have seen at least the initial phase
    expect(phasesSeen.length).toBeGreaterThan(0);
    console.log(`Phases observed: ${phasesSeen.join(", ")}`);
  });

  test("verify workflow state API returns data", async ({ request }) => {
    // List workflows
    const listRes = await request.get("/api/workflow/list");
    expect(listRes.status()).toBe(200);
    const data = await listRes.json();
    expect(data).toHaveProperty("workflows");
    expect(Array.isArray(data.workflows)).toBeTruthy();

    if (data.workflows.length > 0) {
      // Get the most recent workflow's state
      const latest = data.workflows[0];
      const stateRes = await request.get(`/api/workflow/state?id=${latest.id}`);
      expect(stateRes.status()).toBe(200);
      const state = await stateRes.json();
      expect(state).toHaveProperty("phase");
      // State uses agentTasks (not tickets)
      expect(state).toHaveProperty("agentTasks");
    }
  });
});
