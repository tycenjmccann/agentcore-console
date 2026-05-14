import { test, expect } from "@playwright/test";

/**
 * E2E Test: Invoke Page with AgentCore Memory
 *
 * 1. Opens Invoke page, selects agent
 * 2. Sends a message and verifies streaming response
 * 3. Verifies the turn was stored in memory
 * 4. Starts a new session, then resumes the previous one
 * 5. Verifies the history loads correctly
 */
test.describe("E2E: Invoke Page with Memory Sessions", () => {
  test.setTimeout(60_000);

  const SESSION_ID = `e2e_test_${Date.now()}_${"a".repeat(20)}`;

  test("Full flow: chat, store to memory, resume session", async ({ page, request }) => {
    // Step 1: Store a test conversation in memory via API (simulating a past session)
    const storeRes = await request.post("/api/agentcore/memory/events", {
      data: {
        agent_id: "csharness_cssonnet-pScJm2ObOd",
        session_id: SESSION_ID,
        user_message: "What is AgentCore?",
        assistant_message: "AgentCore is AWS's managed service for deploying and running AI agents at scale.",
      },
    });
    expect(storeRes.status()).toBe(200);
    const storeData = await storeRes.json();
    expect(storeData.stored).toBe(true);

    // Step 2: Verify the session appears in the sessions list
    const sessionsRes = await request.get(
      "/api/agentcore/memory/sessions?agent_id=csharness_cssonnet-pScJm2ObOd"
    );
    expect(sessionsRes.status()).toBe(200);
    const sessionsData = await sessionsRes.json();
    const foundSession = sessionsData.sessions.find(
      (s: { sessionId: string }) => s.sessionId === SESSION_ID
    );
    expect(foundSession).toBeTruthy();

    // Step 3: Verify events can be retrieved for the session
    const eventsRes = await request.get(
      `/api/agentcore/memory/events?agent_id=csharness_cssonnet-pScJm2ObOd&session_id=${SESSION_ID}`
    );
    expect(eventsRes.status()).toBe(200);
    const eventsData = await eventsRes.json();
    expect(eventsData.messages.length).toBe(2);
    expect(eventsData.messages[0].role).toBe("user");
    expect(eventsData.messages[0].content).toContain("AgentCore");
    expect(eventsData.messages[1].role).toBe("assistant");

    // Step 4: Open the Invoke page
    await page.goto("/invoke");
    await expect(page.getByTestId("invoke-agent-selector")).toBeVisible();
    await expect(page.getByTestId("invoke-chat-input")).toBeVisible();

    // Step 5: Verify the session shows up in the sidebar
    await expect(page.getByText("History")).toBeVisible();
    await page.waitForTimeout(2000);
    const sessionButton = page.locator(`button:has-text("${SESSION_ID.slice(0, 18)}")`).first();
    await expect(sessionButton).toBeVisible({ timeout: 5000 });

    // Step 6: Click the session to resume it
    await sessionButton.click();

    // Step 7: Verify the history loads in the chat area
    const chatArea = page.locator(".rounded-2xl");
    await expect(chatArea.getByText("What is AgentCore?").first()).toBeVisible({ timeout: 5000 });
    await expect(chatArea.getByText("managed service for deploying").first()).toBeVisible({ timeout: 5000 });
  });

  test("Send a real message and verify streaming", async ({ page }) => {
    await page.goto("/invoke");
    await expect(page.getByTestId("invoke-chat-input")).toBeVisible();

    // Wait for agents to load
    await page.waitForTimeout(1500);

    // Type and send a message
    await page.getByTestId("invoke-chat-input").fill("Say hello in exactly 3 words");
    await page.getByTestId("invoke-send-btn").click();

    // Verify user message appears in the chat area
    await expect(page.locator(".rounded-2xl").getByText("Say hello in exactly 3 words").first()).toBeVisible();

    // Verify streaming indicator appears
    await expect(page.getByText("Streaming...")).toBeVisible({ timeout: 5000 });

    // Wait for response to complete (max 30s)
    await expect(page.getByText("Streaming...")).not.toBeVisible({ timeout: 30000 });

    // Verify an agent response appeared in the chat area
    // The agent's response text should be visible (not empty)
    const responseBubbles = page.locator(".rounded-2xl.rounded-tl-sm p.text-sm");
    await expect(responseBubbles.last()).not.toBeEmpty();
  });
});
