/**
 * V2 Demo Recording — Agentis Hub
 *
 * Improved flow:
 * 1. Wait for dashboard to fully load BEFORE recording
 * 2. Show dashboard (point out no dark mode — narration handles this)
 * 3. Navigate to Ticket History (show established usage)
 * 4. Navigate to Workflow — fill + submit
 * 5. Watch agents work through all phases
 * 6. Dwell on completion state
 *
 * Run: DEMO_MODE=true npx playwright test demo/record-demo-v2.spec.ts --config demo/playwright.config.ts
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

test.setTimeout(360000); // 6 minutes

test("Record Agentis Hub demo v2", async ({ browser }) => {
  fs.mkdirSync(RECORDING_DIR, { recursive: true });

  // ─── Pre-warm: Load page and wait for data before recording ────────
  console.log("[pre] Warming up — loading dashboard data...");
  const warmupContext = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const warmupPage = await warmupContext.newPage();
  await warmupPage.goto(BASE_URL);

  // Wait for dashboard metrics to populate (not just dashes)
  await warmupPage.waitForFunction(() => {
    const body = document.body.textContent || "";
    return body.includes("505") || body.includes("sessions") || body.includes("invocations");
  }, { timeout: 30000 }).catch(() => {
    console.log("[pre] Dashboard data didn't load in 30s, continuing anyway");
  });

  // Extra wait to ensure everything is populated
  await warmupPage.waitForTimeout(5000);
  await warmupContext.close();
  console.log("[pre] Warmup complete, starting recording...");

  // ─── Start recording ───────────────────────────────────────────────
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    recordVideo: {
      dir: RECORDING_DIR,
      size: { width: 1920, height: 1080 },
    },
  });

  const page = await context.newPage();

  // ─── Scene 1: Dashboard (already loaded) — 8s ─────────────────────
  console.log("[00:00] Scene 1: Dashboard");
  await page.goto(BASE_URL);
  await page.waitForLoadState("networkidle");

  // Wait for actual data to appear
  await page.waitForFunction(() => {
    const body = document.body.textContent || "";
    return body.includes("505") || body.includes("sessions");
  }, { timeout: 15000 }).catch(() => {});

  // Dwell on dashboard — narration points out no dark mode toggle
  await page.waitForTimeout(8000);

  // ─── Scene 2: Ticket History (show established usage) — 8s ────────
  console.log("[00:08] Scene 2: Ticket History");
  await page.click('[data-testid="nav-ticket history"]');
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(2000);

  // Scroll down slightly to show more sessions
  await page.evaluate(() => window.scrollBy(0, 200));
  await page.waitForTimeout(6000);

  // ─── Scene 3: Navigate to Workflow — 3s ────────────────────────────
  console.log("[00:16] Scene 3: Navigate to Workflow");
  await page.click('[data-testid="nav-workflow"]');
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(3000);

  // ─── Scene 4: Fill the Intake Form — 15s ──────────────────────────
  console.log("[00:19] Scene 4: Fill Intake Form");

  const titleInput = page.locator('input[placeholder*="profile photo"]');
  await titleInput.click();
  await page.waitForTimeout(300);
  await titleInput.type(FEATURE_REQUEST.title, { delay: 40 });
  await page.waitForTimeout(800);

  const descInput = page.locator('textarea[placeholder*="Describe"]');
  await descInput.click();
  await page.waitForTimeout(300);
  await descInput.type(FEATURE_REQUEST.description, { delay: 15 });
  await page.waitForTimeout(800);

  const repoInput = page.locator('input[placeholder*="github.com"]');
  await repoInput.click();
  await repoInput.fill(FEATURE_REQUEST.repoUrl);
  await page.waitForTimeout(500);

  const modelSelect = page.locator("#model-select");
  if (await modelSelect.isVisible().catch(() => false)) {
    await modelSelect.selectOption({ label: "Claude Opus 4" });
    await page.waitForTimeout(500);
  }

  // Pause to show filled form
  await page.waitForTimeout(2000);

  // ─── Scene 5: Submit ───────────────────────────────────────────────
  console.log("[00:34] Scene 5: Submit workflow");
  const submitBtn = page.locator('button[type="submit"]');
  await submitBtn.click();
  await page.waitForTimeout(3000);

  // ─── Scene 6-8: Watch agents work ─────────────────────────────────
  console.log("[00:37] Scene 6-8: Agents working...");

  const startTime = Date.now();
  const MAX_WAIT = 120000;
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

    const elapsed = Math.round((Date.now() - startTime) / 1000);
    if (elapsed % 30 < 6) {
      console.log(`  [${elapsed}s] Waiting for completion...`);
    }

    await page.waitForTimeout(5000);
  }

  const totalElapsed = Math.round((Date.now() - startTime) / 1000);
  if (completed) {
    console.log(`[${totalElapsed}s] Workflow completed!`);
  } else {
    console.log(`[${totalElapsed}s] WARNING: Timed out`);
  }

  // ─── Scene 9: Dwell on completion (8s) ─────────────────────────────
  console.log("Scene 9: Completion dwell");
  await page.waitForTimeout(8000);

  // ─── Close recording ───────────────────────────────────────────────
  await context.close();

  // Rename video file
  const files = fs.readdirSync(RECORDING_DIR).filter(f => f.endsWith(".webm") && f !== "raw-demo.webm" && f !== "raw-demo-v2.webm");
  if (files.length > 0) {
    const sorted = files
      .map(f => ({ name: f, time: fs.statSync(path.join(RECORDING_DIR, f)).mtime.getTime() }))
      .sort((a, b) => b.time - a.time);
    const finalPath = path.join(RECORDING_DIR, "raw-demo-v2.webm");
    fs.renameSync(path.join(RECORDING_DIR, sorted[0].name), finalPath);
    console.log(`\nRecording saved: ${finalPath}`);
    const stats = fs.statSync(finalPath);
    console.log(`File size: ${(stats.size / 1024 / 1024).toFixed(1)} MB`);
    console.log(`Duration: check with ffprobe`);
  }
});
