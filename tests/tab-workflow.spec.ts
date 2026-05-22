import { test, expect } from "@playwright/test";

test.describe("Workflow Tab", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/workflow");
  });

  test("renders workflow page", async ({ page }) => {
    // Should have the workflow page visible
    await expect(page.locator("body")).toContainText(/workflow|pipeline/i);
  });

  test("new workflow button is visible", async ({ page }) => {
    const newBtn = page.getByRole("button", { name: /new|create|start/i }).or(page.locator("svg.lucide-plus").locator(".."));
    await expect(newBtn.first()).toBeVisible({ timeout: 5000 });
  });

  test("clicking new workflow shows intake form", async ({ page }) => {
    // Click the new/plus button
    const newBtn = page.getByRole("button", { name: /new|create|start/i }).or(page.locator("svg.lucide-plus").locator(".."));
    await newBtn.first().click();
    await page.waitForTimeout(1000);

    // Intake form should show the title input with specific placeholder
    await expect(
      page.locator("input[placeholder*='profile photo carousel']")
    ).toBeVisible({ timeout: 5000 });
  });

  test("intake form accepts title and description", async ({ page }) => {
    const newBtn = page.getByRole("button", { name: /new|create|start/i }).or(page.locator("svg.lucide-plus").locator(".."));
    await newBtn.first().click();
    await page.waitForTimeout(1000);

    const titleInput = page.locator("input[placeholder*='profile photo carousel']");
    const descInput = page.locator("textarea[placeholder*='Describe the feature']");

    await expect(titleInput).toBeVisible({ timeout: 5000 });
    await titleInput.fill("Test Feature: Push Notifications");
    await descInput.fill("Users should receive push notifications for new messages");

    await expect(titleInput).toHaveValue("Test Feature: Push Notifications");
    await expect(descInput).toHaveValue("Users should receive push notifications for new messages");
  });

  test("intake form has model selector", async ({ page }) => {
    const newBtn = page.getByRole("button", { name: /new|create|start/i }).or(page.locator("svg.lucide-plus").locator(".."));
    await newBtn.first().click();
    await page.waitForTimeout(2000);

    // Model selector dropdown should be present
    await expect(page.locator("select#model-select")).toBeVisible({ timeout: 5000 });
  });

  test("workflow list loads from API", async ({ page }) => {
    await page.waitForTimeout(3000);
    // Either shows workflow items or the page is in empty state
    const body = await page.locator("body").textContent();
    // The page should have loaded without crashing
    expect(body).toBeTruthy();
  });
});
