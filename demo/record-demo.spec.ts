/**
 * Demo Recording Script
 *
 * Records the full AgentCore Console workflow at 1080p using Playwright's
 * native video recording. Captures:
 * 1. Dashboard overview
 * 2. Navigate to Workflow tab
 * 3. Fill and submit "Add light/dark mode" feature request
 * 4. Watch agents work (full recording, sped up in post-processing)
 * 5. Show completion / PR link
 *
 * Run: npx playwright test demo/record-demo.ts
 * Output: demo/recordings/raw-demo.webm
 */

import { test } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

const BASE_URL = process.env.DEMO_BASE_URL || "http://localhost:3000";
const RECORDING_DIR = path.join(__dirname, "recordings");

const FEATURE_REQUEST = {
  title: "Add light/dark mode theme toggle",
  description: `Add a theme toggle button to the site header that switches between light and dark mode. Requirements:
- Use CSS custom properties (variables) for all colors so components adapt automatically
- Add a toggle button (sun/moon icon) in the Header component
- Persist the user's preference in localStorage
- Default to dark mode (current state) but respect system preference via prefers-color-scheme
- Ensure smooth transition between themes (0.2s transition on background-color and color)`,
  repoUrl: "https://github.com/tycenjmccann/agentcore-console",
};

test.setTimeout(300000); // 5 minutes (demo mode completes in ~90s)

test("Record full workflow demo", async ({ browser }) => {
  fs.mkdirSync(RECORDING_DIR, { recursive: true });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    recordVideo: {
      dir: RECORDING_DIR,
      size: { width: 1920, height: 1080 },
    },
  });

  const page = await context.newPage();

  // ─── Scene 1: Dashboard (4s) ──────────────────────────────────────
  console.log("[00:00] Scene 1: Dashboard");
  await page.goto(BASE_URL);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(4000);

  // ─── Scene 2: Navigate to Workflow (3s) ────────────────────────────
  console.log("[00:04] Scene 2: Navigate to Workflow");
  await page.click('[data-testid="nav-workflow"]');
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(3000);

  // ─── Scene 3: Fill the Intake Form (15s) ───────────────────────────
  console.log("[00:07] Scene 3: Fill Intake Form");

  // Title — use placeholder selector since there's only one text input with this placeholder
  const titleInput = page.locator('input[placeholder*="profile photo"]');
  await titleInput.click();
  await page.waitForTimeout(300);
  await titleInput.type(FEATURE_REQUEST.title, { delay: 40 });
  await page.waitForTimeout(800);

  // Description
  const descInput = page.locator('textarea[placeholder*="Describe"]');
  await descInput.click();
  await page.waitForTimeout(300);
  await descInput.type(FEATURE_REQUEST.description, { delay: 15 });
  await page.waitForTimeout(800);

  // Repo URL
  const repoInput = page.locator('input[placeholder*="github.com"]');
  await repoInput.click();
  await repoInput.fill(FEATURE_REQUEST.repoUrl);
  await page.waitForTimeout(500);

  // Select Opus model (if dropdown is visible)
  const modelSelect = page.locator("#model-select");
  if (await modelSelect.isVisible().catch(() => false)) {
    // Select Claude Opus 4 option
    await modelSelect.selectOption({ label: "Claude Opus 4" });
    await page.waitForTimeout(500);
  }

  // Pause to show filled form
  await page.waitForTimeout(2000);

  // ─── Scene 4: Submit ───────────────────────────────────────────────
  console.log("[00:22] Scene 4: Submit workflow");
  const submitBtn = page.locator('button[type="submit"]');
  await submitBtn.click();
  await page.waitForTimeout(3000);

  // ─── Scene 5-7: Watch agents work ─────────────────────────────────
  console.log("[00:25] Scene 5-7: Agents working (recording continuously)...");

  const startTime = Date.now();
  const MAX_WAIT = 120000; // 2 min (demo mode completes in ~90s)
  let completed = false;

  while (Date.now() - startTime < MAX_WAIT) {
    const bodyText = await page.textContent("body").catch(() => "");
    const lower = (bodyText || "").toLowerCase();

    if (
      lower.includes("workflow complete") ||
      lower.includes("pr ready for review") ||
      lower.includes("pull request ready")
    ) {
      completed = true;
      break;
    }

    // Log progress every 30s
    const elapsed = Math.round((Date.now() - startTime) / 1000);
    if (elapsed % 30 < 6) {
      // Check for phase info
      const phaseMatch = lower.match(/phase[:\s]*(requirements|design|development|review|complete)/);
      const phase = phaseMatch ? phaseMatch[1] : "unknown";
      console.log(`  [${elapsed}s] Phase: ${phase}`);
    }

    await page.waitForTimeout(5000);
  }

  const totalElapsed = Math.round((Date.now() - startTime) / 1000);
  if (completed) {
    console.log(`[${totalElapsed}s] Workflow completed!`);
  } else {
    console.log(`[${totalElapsed}s] WARNING: Workflow timed out, continuing with what we have`);
  }

  // Let the final state render
  await page.waitForTimeout(5000);

  // ─── Scene 8: Check for PR link ────────────────────────────────────
  console.log("Scene 8: Looking for PR link...");
  const prLink = page.locator('a[href*="github.com"][href*="pull"]').first();
  if (await prLink.isVisible().catch(() => false)) {
    const prUrl = await prLink.getAttribute("href");
    console.log(`  Found PR: ${prUrl}`);

    // Click to open PR in same tab
    await prLink.click();
    await page.waitForLoadState("networkidle").catch(() => {});
    await page.waitForTimeout(5000);

    // Scroll through the PR
    await page.evaluate(() => window.scrollBy(0, 400));
    await page.waitForTimeout(2000);
    await page.evaluate(() => window.scrollBy(0, 400));
    await page.waitForTimeout(3000);
  }

  // ─── Final pause and close ─────────────────────────────────────────
  await page.waitForTimeout(3000);
  await context.close();

  // Rename the video file
  const files = fs.readdirSync(RECORDING_DIR).filter(f => f.endsWith(".webm"));
  if (files.length > 0) {
    // Use the most recently modified file
    const sorted = files
      .map(f => ({ name: f, time: fs.statSync(path.join(RECORDING_DIR, f)).mtime.getTime() }))
      .sort((a, b) => b.time - a.time);
    const finalPath = path.join(RECORDING_DIR, "raw-demo.webm");
    fs.renameSync(path.join(RECORDING_DIR, sorted[0].name), finalPath);
    console.log(`\nRecording saved: ${finalPath}`);
    const stats = fs.statSync(finalPath);
    console.log(`File size: ${(stats.size / 1024 / 1024).toFixed(1)} MB`);
  }
});
