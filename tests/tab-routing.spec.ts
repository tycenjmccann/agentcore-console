import { test, expect } from "@playwright/test";

test.describe("Routing Tab", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/routing");
  });

  test("renders routing pipeline heading", async ({ page }) => {
    await expect(page.getByText("Agent Routing Pipeline")).toBeVisible();
  });

  test("shows sample tickets section", async ({ page }) => {
    await expect(page.getByText("SAMPLE TICKETS")).toBeVisible();
  });

  test("shows Jira Intake heading", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Jira Intake" })).toBeVisible();
  });

  test("displays sample ticket options", async ({ page }) => {
    await expect(page.getByText("Add push notification support for iOS")).toBeVisible();
  });

  test("Start Flow button is visible", async ({ page }) => {
    await expect(page.getByText("Start Flow")).toBeVisible();
  });

  test("clicking sample ticket fills the form", async ({ page }) => {
    await page.locator("button").filter({ hasText: "Add push notification" }).click();
    const titleInput = page.locator("input[placeholder*='title' i]");
    await expect(titleInput).not.toBeEmpty();
  });

  test("can fill custom ticket", async ({ page }) => {
    const titleInput = page.locator("input[placeholder*='title' i]").first();
    const descInput = page.locator("textarea").first();
    await titleInput.fill("Implement OAuth2 login flow");
    await descInput.fill("Users need to log in with Google and Apple accounts");
    await expect(titleInput).toHaveValue("Implement OAuth2 login flow");
  });

  test("shows pipeline visualization area", async ({ page }) => {
    // The routing page should have a pipeline/flow visualization
    const pipeline = page.locator("[class*='pipeline'], [class*='flow'], svg, canvas").first();
    await expect(pipeline).toBeVisible();
  });
});
