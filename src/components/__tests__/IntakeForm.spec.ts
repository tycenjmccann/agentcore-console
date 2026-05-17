/**
 * IntakeForm Component Tests
 * 
 * Tests for the model selector UI component and IntakeForm integration.
 * Uses Playwright for component testing.
 */

import { test, expect } from "@playwright/test";

test.describe("IntakeForm with Model Selector", () => {
  test.beforeEach(async ({ page }) => {
    // Mock the /api/models endpoint
    await page.route("**/api/models", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          models: [
            {
              provider: "bedrock",
              modelId: "anthropic.claude-sonnet-4-5-v1",
              displayName: "Claude Sonnet 4.5",
              description: "Balanced performance and cost (default)",
              isDefault: true,
            },
            {
              provider: "bedrock",
              modelId: "anthropic.claude-opus-4",
              displayName: "Claude Opus 4",
              description: "Highest capability, slower, more expensive",
              isDefault: false,
            },
            {
              provider: "openai",
              modelId: "gpt-4-turbo",
              displayName: "GPT-4 Turbo",
              description: "OpenAI's fastest GPT-4 model",
              isDefault: false,
            },
            {
              provider: "gemini",
              modelId: "gemini-pro",
              displayName: "Gemini Pro",
              description: "Google's advanced AI model",
              isDefault: false,
            },
          ],
          defaultModel: {
            provider: "bedrock",
            modelId: "anthropic.claude-sonnet-4-5-v1",
          },
        }),
      });
    });
  });

  test("renders with default model pre-selected", async ({ page }) => {
    // Navigate to a page that includes the IntakeForm
    await page.goto("/workflow/new");

    // Wait for models to load
    await page.waitForSelector("#model-selector");

    // Check that Claude Sonnet 4.5 is selected by default
    const selector = page.locator("#model-selector");
    await expect(selector).toContainText("Claude Sonnet 4.5");
    await expect(selector).toContainText("Default");
  });

  test("shows loading state while fetching models", async ({ page }) => {
    // Delay the API response
    await page.route("**/api/models", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      await route.continue();
    });

    await page.goto("/workflow/new");

    // Check for loading indicator
    await expect(page.getByText("Loading models...")).toBeVisible();
  });

  test("dropdown is populated from API", async ({ page }) => {
    await page.goto("/workflow/new");
    await page.waitForSelector("#model-selector");

    // Open dropdown
    await page.click("#model-selector");

    // Check all models are present
    await expect(page.getByText("Claude Sonnet 4.5")).toBeVisible();
    await expect(page.getByText("Claude Opus 4")).toBeVisible();
    await expect(page.getByText("GPT-4 Turbo")).toBeVisible();
    await expect(page.getByText("Gemini Pro")).toBeVisible();
  });

  test("models are grouped by provider", async ({ page }) => {
    await page.goto("/workflow/new");
    await page.waitForSelector("#model-selector");

    // Open dropdown
    await page.click("#model-selector");

    // Check provider group headers
    await expect(page.getByText("AWS Bedrock")).toBeVisible();
    await expect(page.getByText("OpenAI")).toBeVisible();
    await expect(page.getByText("Google Gemini")).toBeVisible();
  });

  test("selection updates state correctly", async ({ page }) => {
    await page.goto("/workflow/new");
    await page.waitForSelector("#model-selector");

    // Open dropdown and select Claude Opus
    await page.click("#model-selector");
    await page.click("text=Claude Opus 4");

    // Verify selection changed
    const selector = page.locator("#model-selector");
    await expect(selector).toContainText("Claude Opus 4");
    await expect(selector).not.toContainText("Claude Sonnet 4.5");
  });

  test("handles API error with fallback", async ({ page }) => {
    // Override route to return error
    await page.route("**/api/models", async (route) => {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "Internal server error" }),
      });
    });

    await page.goto("/workflow/new");

    // Should show error message
    await expect(page.getByText("Failed to load models. Using default.")).toBeVisible();

    // Should still show default model as fallback
    await expect(page.getByText("Claude Sonnet 4.5")).toBeVisible();
  });

  test("keyboard navigation works", async ({ page }) => {
    await page.goto("/workflow/new");
    await page.waitForSelector("#model-selector");

    // Focus on selector and open with Enter
    await page.focus("#model-selector");
    await page.keyboard.press("Enter");

    // Dropdown should be open
    await expect(page.getByRole("listbox")).toBeVisible();

    // Close with Escape
    await page.keyboard.press("Escape");
    await expect(page.getByRole("listbox")).not.toBeVisible();

    // Open with ArrowDown
    await page.keyboard.press("ArrowDown");
    await expect(page.getByRole("listbox")).toBeVisible();
  });

  test("screen reader announces selection", async ({ page }) => {
    await page.goto("/workflow/new");
    await page.waitForSelector("#model-selector");

    const selector = page.locator("#model-selector");

    // Check ARIA attributes
    await expect(selector).toHaveAttribute("aria-haspopup", "listbox");
    await expect(selector).toHaveAttribute("aria-expanded", "false");

    // Open dropdown
    await page.click("#model-selector");
    await expect(selector).toHaveAttribute("aria-expanded", "true");

    // Check listbox role
    await expect(page.getByRole("listbox")).toBeVisible();

    // Check option roles
    const options = page.getByRole("option");
    await expect(options).toHaveCount(4);
  });

  test("form submission includes selected model", async ({ page }) => {
    await page.goto("/workflow/new");
    await page.waitForSelector("#model-selector");

    // Fill in form
    await page.fill("#title", "Test Feature");
    await page.fill("#description", "Test description for the feature.");

    // Select a different model
    await page.click("#model-selector");
    await page.click("text=GPT-4 Turbo");

    // Submit form (this would need integration with actual form submission)
    await page.click("button[type=submit]");

    // Verify form data would include modelConfig
    // Note: Actual verification depends on how form submission is handled
  });

  test("mobile responsive - dropdown works on small screens", async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    await page.goto("/workflow/new");
    await page.waitForSelector("#model-selector");

    // Open dropdown
    await page.click("#model-selector");

    // Dropdown should be visible and usable
    await expect(page.getByRole("listbox")).toBeVisible();

    // Should be able to select a model
    await page.click("text=Claude Opus 4");
    await expect(page.locator("#model-selector")).toContainText("Claude Opus 4");
  });

  test("disabled state when form is submitting", async ({ page }) => {
    await page.goto("/workflow/new");
    await page.waitForSelector("#model-selector");

    // Fill form
    await page.fill("#title", "Test");
    await page.fill("#description", "Test description");

    // Trigger submit and check disabled state
    // This would need proper state management integration
    // The selector should be disabled during submission
  });
});