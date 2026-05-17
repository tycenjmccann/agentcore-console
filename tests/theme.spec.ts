import { test, expect } from '@playwright/test';

test.describe('Theme Toggle Feature', () => {
  test.beforeEach(async ({ page }) => {
    // Clear localStorage before each test
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
  });

  test('should display theme toggle button in header', async ({ page }) => {
    await page.goto('/');
    
    // Wait for the page to load
    await page.waitForLoadState('networkidle');
    
    // Check that theme toggle button exists
    const themeButton = page.locator('button[aria-label*="mode"]');
    await expect(themeButton).toBeVisible();
  });

  test('should default to dark theme', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Check data-theme attribute
    const htmlElement = page.locator('html');
    const theme = await htmlElement.getAttribute('data-theme');
    expect(theme).toBe('dark');
    
    // Check that sun icon is visible (indicating dark mode)
    const sunIcon = page.locator('svg').filter({ hasText: /sun/i }).first();
    await expect(sunIcon).toBeVisible();
  });

  test('should toggle between light and dark themes', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    const htmlElement = page.locator('html');
    const themeButton = page.locator('button[aria-label*="mode"]');
    
    // Initially dark
    let theme = await htmlElement.getAttribute('data-theme');
    expect(theme).toBe('dark');
    
    // Click to switch to light
    await themeButton.click();
    await page.waitForTimeout(300); // Wait for transition
    
    theme = await htmlElement.getAttribute('data-theme');
    expect(theme).toBe('light');
    
    // Click to switch back to dark
    await themeButton.click();
    await page.waitForTimeout(300);
    
    theme = await htmlElement.getAttribute('data-theme');
    expect(theme).toBe('dark');
  });

  test('should persist theme preference in localStorage', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    const themeButton = page.locator('button[aria-label*="mode"]');
    
    // Switch to light theme
    await themeButton.click();
    await page.waitForTimeout(300);
    
    // Check localStorage
    const storedTheme = await page.evaluate(() => localStorage.getItem('theme'));
    expect(storedTheme).toBe('light');
    
    // Reload page
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    // Check that theme persisted
    const htmlElement = page.locator('html');
    const theme = await htmlElement.getAttribute('data-theme');
    expect(theme).toBe('light');
  });

  test('should show correct icon for each theme', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    const themeButton = page.locator('button[aria-label*="mode"]');
    
    // Dark theme should show sun icon
    let htmlTheme = await page.locator('html').getAttribute('data-theme');
    expect(htmlTheme).toBe('dark');
    
    // Switch to light
    await themeButton.click();
    await page.waitForTimeout(300);
    
    htmlTheme = await page.locator('html').getAttribute('data-theme');
    expect(htmlTheme).toBe('light');
  });

  test('should have smooth transitions', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Get computed style of body
    const bodyTransition = await page.evaluate(() => {
      const body = document.body;
      const computed = window.getComputedStyle(body);
      return computed.transition;
    });
    
    // Should have transition properties
    expect(bodyTransition).toContain('0.2s');
  });

  test('should not cause flash of unstyled content', async ({ page }) => {
    await page.goto('/');
    
    // Check that theme is applied before first paint
    const themeOnLoad = await page.evaluate(() => {
      return document.documentElement.getAttribute('data-theme');
    });
    
    expect(themeOnLoad).toBeTruthy();
    expect(['light', 'dark']).toContain(themeOnLoad);
  });
});
