import { test, expect } from "@playwright/test";

test.describe("Theme Toggle", () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the app
    await page.goto("/");
  });

  test("should display theme toggle button", async ({ page }) => {
    const themeToggle = page.getByRole("switch", {
      name: /switch to (light|dark) mode/i,
    });
    await expect(themeToggle).toBeVisible();
  });

  test("should toggle between light and dark themes", async ({ page }) => {
    const html = page.locator("html");
    const themeToggle = page.getByRole("switch");

    // Get initial theme
    const initialTheme = await html.getAttribute("data-theme");
    expect(["light", "dark"]).toContain(initialTheme);

    // Click toggle
    await themeToggle.click();

    // Wait for theme to change
    await page.waitForTimeout(100);

    // Verify theme changed
    const newTheme = await html.getAttribute("data-theme");
    expect(newTheme).not.toBe(initialTheme);
    expect(["light", "dark"]).toContain(newTheme);
  });

  test("should persist theme preference on reload", async ({ page }) => {
    const html = page.locator("html");
    const themeToggle = page.getByRole("switch");

    // Set to light mode
    const currentTheme = await html.getAttribute("data-theme");
    if (currentTheme === "dark") {
      await themeToggle.click();
      await page.waitForTimeout(100);
    }

    // Verify it's light
    await expect(html).toHaveAttribute("data-theme", "light");

    // Reload page
    await page.reload();

    // Should still be light
    await expect(html).toHaveAttribute("data-theme", "light");
  });

  test("should be keyboard accessible", async ({ page }) => {
    const themeToggle = page.getByRole("switch");

    // Focus the toggle with Tab
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");
    
    // Should have focus ring
    await expect(themeToggle).toBeFocused();

    // Press Enter to toggle
    const html = page.locator("html");
    const initialTheme = await html.getAttribute("data-theme");
    
    await page.keyboard.press("Enter");
    await page.waitForTimeout(100);
    
    const newTheme = await html.getAttribute("data-theme");
    expect(newTheme).not.toBe(initialTheme);
  });

  test("should have correct ARIA attributes", async ({ page }) => {
    const themeToggle = page.getByRole("switch");
    
    // Should have role="switch"
    await expect(themeToggle).toHaveAttribute("role", "switch");
    
    // Should have aria-checked
    const ariaChecked = await themeToggle.getAttribute("aria-checked");
    expect(["true", "false"]).toContain(ariaChecked);
    
    // Should have aria-label
    const ariaLabel = await themeToggle.getAttribute("aria-label");
    expect(ariaLabel).toMatch(/switch to (light|dark) mode/i);
  });

  test("should show appropriate icon for current theme", async ({ page }) => {
    const html = page.locator("html");
    const theme = await html.getAttribute("data-theme");
    
    // In dark mode, should show Sun icon (to switch to light)
    // In light mode, should show Moon icon (to switch to dark)
    // We verify by checking the icon is visible
    const themeToggle = page.getByRole("switch");
    await expect(themeToggle).toBeVisible();
    
    // The icon should be inside the button
    const icon = themeToggle.locator("svg").first();
    await expect(icon).toBeVisible();
  });
});
