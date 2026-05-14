import { test, expect } from "@playwright/test";

/**
 * E2E Test: Session Resume with Context
 *
 * Proves that when resuming a session, the agent has full context
 * of the previous conversation (not just the new message).
 */
test.describe("E2E: Session Resume with Context", () => {
  test.setTimeout(90_000);

  test("Resume session carries conversation context to the agent", async ({ page, request }) => {
    const SESSION_ID = `resume_ctx_${Date.now()}_${"x".repeat(20)}`;

    // Step 1: Store a multi-turn conversation in memory
    // Turn 1: User introduces a secret word
    await request.post("/api/agentcore/memory/events", {
      data: {
        agent_id: "csharness_cssonnet-pScJm2ObOd",
        session_id: SESSION_ID,
        user_message: "Remember this secret word: PINEAPPLE. I will ask you about it later.",
        assistant_message: "Got it! I'll remember the secret word PINEAPPLE. Feel free to ask me about it anytime.",
      },
    });

    // Turn 2: Some filler conversation
    await request.post("/api/agentcore/memory/events", {
      data: {
        agent_id: "csharness_cssonnet-pScJm2ObOd",
        session_id: SESSION_ID,
        user_message: "What is 2+2?",
        assistant_message: "2+2 equals 4.",
      },
    });

    // Step 2: Open invoke page (wait a moment for memory to propagate)
    await page.waitForTimeout(1000);
    await page.goto("/invoke");
    await expect(page.getByTestId("invoke-chat-input")).toBeVisible();
    await page.waitForTimeout(3000);

    // Step 3: Find and click the resume session in sidebar
    // If not visible, reload to pick up newly-created session
    const sessionBtn = page.locator(`button:has-text("${SESSION_ID.slice(0, 18)}")`).first();
    if (!(await sessionBtn.isVisible())) {
      await page.reload();
      await page.waitForTimeout(3000);
    }
    await expect(sessionBtn).toBeVisible({ timeout: 15000 });
    await sessionBtn.click();

    // Step 4: Verify history loaded (in the chat area, not the trace panel)
    const chatArea = page.locator(".rounded-2xl");
    await expect(chatArea.getByText("Remember this secret word").first()).toBeVisible({ timeout: 5000 });
    await expect(chatArea.getByText("2+2 equals 4").first()).toBeVisible();

    // Step 5: Ask about the secret word — if context is passed, the agent will know it
    await page.getByTestId("invoke-chat-input").fill("What was my secret word?");
    await page.getByTestId("invoke-send-btn").click();

    // Wait for streaming to complete
    await expect(page.getByText("Streaming...")).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("Streaming...")).not.toBeVisible({ timeout: 30000 });

    // Step 6: Verify the agent's response contains "PINEAPPLE"
    // This proves the conversation history was sent to the model
    const allText = await page.locator(".rounded-2xl.rounded-tl-sm").last().textContent();
    expect(allText?.toUpperCase()).toContain("PINEAPPLE");
  });
});
