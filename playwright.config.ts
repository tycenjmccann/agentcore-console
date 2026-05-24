import { defineConfig } from "@playwright/test";

/**
 * Target the deployed App Runner site.
 * Set PLAYWRIGHT_BASE_URL in your environment (see .env.example).
 */
const baseURL = process.env.PLAYWRIGHT_BASE_URL;
if (!baseURL) {
  throw new Error("PLAYWRIGHT_BASE_URL must be set (e.g. https://xxxxx.us-east-1.awsapprunner.com)");
}

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
