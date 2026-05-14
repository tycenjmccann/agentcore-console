import { test, expect } from "@playwright/test";

/**
 * E2E Test: Build → Deploy → Invoke flow
 *
 * This test exercises the real AgentCore integration:
 * 1. Goes to /build page
 * 2. Asks the builder agent to create a simple hello world agent
 * 3. Waits for the builder to stream back a config
 * 4. Deploys the agent
 * 5. Navigates to the Invoke page with the new agent
 * 6. Sends a message and verifies streaming response
 */
test.describe("E2E: Build → Deploy → Invoke", () => {
  test.setTimeout(120_000); // 2 min timeout for real API calls

  test("Create agent via builder, deploy it, then chat with it", async ({ page }) => {
    // Step 1: Go to Build page
    await page.goto("/build");
    await expect(page.getByText("Agent Builder Chat")).toBeVisible();

    // Step 2: Send a request to build a simple agent
    const input = page.locator("[data-testid='build-description-input']");
    await input.click();
    await input.pressSequentially("Create a hello world greeting agent", { delay: 10 });
    await expect(page.locator("[data-testid='build-submit-btn']")).toBeEnabled({ timeout: 5_000 });
    await page.locator("[data-testid='build-submit-btn']").click();

    // Step 3: Wait for the builder to stream back a response with config
    // The builder should generate an agent-config block which populates the config preview
    await expect(page.locator("[data-testid='config-preview']")).toBeVisible({ timeout: 60_000 });

    // Verify config contains expected fields
    const configText = await page.locator("[data-testid='config-preview']").textContent();
    expect(configText).toContain("agent_name");
    expect(configText).toContain("system_prompt");
    expect(configText).toContain("model_id");

    // Step 4: Deploy the agent
    const deployBtn = page.locator("[data-testid='deploy-agent-btn']");
    await expect(deployBtn).toBeEnabled();
    await deployBtn.click();

    // Wait for deploy success
    await expect(page.getByText("Agent Deployed!")).toBeVisible({ timeout: 10_000 });

    // Verify the agent ID is shown
    const deploySection = page.locator("text=Agent Deployed!").locator("..");
    await expect(deploySection.locator("text=ID:")).toBeVisible();
    await expect(deploySection.locator("text=READY")).toBeVisible();

    // Step 5: Click "Chat with this agent" to navigate to Invoke page
    await page.getByText("Chat with this agent").click();
    await expect(page).toHaveURL(/\/invoke/);

    // The agent selector should have the new agent in the list
    await expect(page.locator("[data-testid='invoke-agent-selector']")).toBeVisible();

    // Step 6: Send a message to the new agent
    const chatInput = page.locator("[data-testid='invoke-chat-input']");
    await chatInput.fill("Hello! How are you today?");
    await page.locator("[data-testid='invoke-send-btn']").click();

    // Wait for streaming response - agent message should appear
    // The agent bubble should get content (non-empty)
    await expect(async () => {
      const agentMessages = page.locator(".text-sm.text-gray-200.whitespace-pre-wrap");
      const count = await agentMessages.count();
      // At minimum: user message + agent response (plus any initial empty state)
      expect(count).toBeGreaterThanOrEqual(2);
      // The last agent message should have real content
      const lastAgent = agentMessages.last();
      const text = await lastAgent.textContent();
      expect(text!.length).toBeGreaterThan(5);
    }).toPass({ timeout: 60_000 });

    // Take a screenshot of the final state
    await page.screenshot({ path: "test-results/e2e-build-deploy-invoke.png", fullPage: true });
  });

  test("Invoke page - chat with existing Claude Sonnet harness agent", async ({ page }) => {
    // Direct test: go to Invoke, select Claude Sonnet Agent, send message
    await page.goto("/invoke");
    await expect(page.locator("[data-testid='invoke-agent-selector']")).toBeVisible();

    // Select Claude Sonnet Agent (first harness agent in the list)
    const selector = page.locator("[data-testid='invoke-agent-selector']");
    await selector.selectOption({ label: "Claude Sonnet Agent" });

    // Send a message
    const chatInput = page.locator("[data-testid='invoke-chat-input']");
    await chatInput.fill("What is 2 + 2? Answer in one word.");
    await page.locator("[data-testid='invoke-send-btn']").click();

    // Wait for streaming indicator
    await expect(page.getByText("Streaming...")).toBeVisible({ timeout: 10_000 });

    // Wait for response to complete
    await expect(async () => {
      const agentMessages = page.locator(".text-sm.text-gray-200.whitespace-pre-wrap");
      const count = await agentMessages.count();
      expect(count).toBeGreaterThanOrEqual(2);
      const lastAgent = agentMessages.last();
      const text = await lastAgent.textContent();
      expect(text!.length).toBeGreaterThan(0);
      // Should not still be streaming
    }).toPass({ timeout: 60_000 });

    await page.screenshot({ path: "test-results/e2e-invoke-sonnet.png", fullPage: true });
  });
});
