import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright E2E Test Configuration
 * 
 * Run tests with:
 * - npm run test:e2e          - Run all E2E tests
 * - npm run test:e2e:ui       - Run with Playwright UI
 * - npm run test:model-selection - Run model selection tests only
 */
export default defineConfig({
  testDir: "./tests",
  outputDir: "./test-results",
  
  // Test execution settings
  timeout: 30000,
  expect: {
    timeout: 5000,
  },
  
  // Run tests in parallel for faster execution
  fullyParallel: true,
  
  // Fail the build on CI if you accidentally left test.only in source
  forbidOnly: !!process.env.CI,
  
  // Retry failed tests in CI
  retries: process.env.CI ? 2 : 0,
  
  // Reporter configuration
  reporter: process.env.CI 
    ? [["html", { open: "never" }], ["github"]] 
    : [["html", { open: "on-failure" }]],
  
  use: {
    baseURL: "http://localhost:3000",
    screenshot: "only-on-failure",
    trace: "on-first-retry",
    video: "on-first-retry",
  },
  
  // Web server configuration
  webServer: {
    command: "npm run dev",
    port: 3000,
    reuseExistingServer: !process.env.CI,
    timeout: 60000,
  },
  
  // Browser configurations
  projects: [
    {
      name: "chromium",
      use: { 
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
      },
    },
    // Uncomment to test in other browsers
    // {
    //   name: "firefox",
    //   use: { ...devices["Desktop Firefox"] },
    // },
    // {
    //   name: "webkit",
    //   use: { ...devices["Desktop Safari"] },
    // },
    // Mobile testing
    // {
    //   name: "mobile-chrome",
    //   use: { ...devices["Pixel 5"] },
    // },
  ],
});
