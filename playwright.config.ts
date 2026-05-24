import { defineConfig } from "@playwright/test";

/**
 * Target the deployed App Runner site by default.
 * Override with PLAYWRIGHT_BASE_URL env var for local testing.
 */
const baseURL =
  process.env.PLAYWRIGHT_BASE_URL ||
  "https://k2krtgqjiu.us-east-1.awsapprunner.com";

export default defineConfig({
  testDir: "./tests",
  outputDir: "./test-results",
  timeout: 30000,
  use: {
    baseURL,
    screenshot: "on",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { browserName: "chromium", viewport: { width: 1440, height: 900 } },
    },
  ],
});
