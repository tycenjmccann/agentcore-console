/**
 * V3 Demo Recording — Agentis Hub: Pipeline Visualization Feature
 *
 * This records a REAL pipeline run (not demo mode) where the pipeline
 * builds its own animated visualization component.
 *
 * Flow:
 * 1. Dashboard overview (brief)
 * 2. Navigate to Workflow
 * 3. Fill intake form with pipeline visualization PRD
 * 4. Add S3 sources (PRD, screenshot, CSS/JS, context files)
 * 5. Submit and watch agents work through all phases
 * 6. Dwell on completion
 *
 * Run (REAL mode — no DEMO_MODE):
 *   npx playwright test demo/record-demo-v3.spec.ts --config demo/playwright-v3.config.ts
 *
 * Expected duration: 20-40 minutes raw (agents doing real work)
 */

import { test } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

const BASE_URL = process.env.DEMO_BASE_URL || "http://localhost:3000";
const RECORDING_DIR = path.join(__dirname, "recordings");

const S3_BUCKET = "agentcore-artifacts-023392223961-us-east-1";

const FEATURE_REQUEST = {
  title: "Replace WorkflowBoard with Animated Pipeline Visualization",
  description: `Replace the current column-based WorkflowBoard component (src/components/workflow/WorkflowBoard.tsx) with an animated horizontal pipeline visualization inspired by demo/agentis-v1-pipeline.html.

Key requirements:
- Horizontal pipeline layout with phase boxes connected by animated SVG paths
- Real-time: phases/agents animate as SSE events arrive (phase_change, agent_status, agent_output, agent_complete)
- Agent items pulse while working, turn green when done
- SVG connector paths animate between phases on completion
- Celebration burst animation on workflow_complete
- CRITICAL: Close laptop, come back → shows current state immediately (no replay). Derive visual state from fetched WorkflowState on mount.
- Same component interface: <WorkflowBoard workflowId={string} />
- CSS animations only (no external libs)
- Dark theme: bg #0f1419, text #e2e8f0

See PRD and visual references in attached sources.`,
  repoUrl: "https://github.com/tycenjmccann/agentcore-console",
  sources: [
    `s3://${S3_BUCKET}/intake-sources/pipeline-viz/prd-pipeline-visualization.md`,
    `s3://${S3_BUCKET}/intake-sources/pipeline-viz/pipeline-screenshot.png`,
    `s3://${S3_BUCKET}/intake-sources/pipeline-viz/pipeline-css-and-structure.txt`,
    `s3://${S3_BUCKET}/intake-sources/pipeline-viz/context/WorkflowBoard.tsx`,
    `s3://${S3_BUCKET}/intake-sources/pipeline-viz/context/types.ts`,
  ],
};

test.setTimeout(2400000); // 40 minutes max

test("Record Agentis Hub demo v3 — Pipeline Visualization", async ({ browser }) => {
  fs.mkdirSync(RECORDING_DIR, { recursive: true });

  // ─── Pre-warm: Load page before recording ──────────────────────────
  console.log("[pre] Warming up — loading page...");
  const warmupContext = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const warmupPage = await warmupContext.newPage();
  await warmupPage.goto(BASE_URL);
  await warmupPage.waitForLoadState("networkidle");
  await warmupPage.waitForTimeout(3000);
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

  // ─── Scene 1: Dashboard — 5s ──────────────────────────────────────
  console.log("[00:00] Scene 1: Dashboard");
  await page.goto(BASE_URL);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(5000);

  // ─── Scene 2: Navigate to Workflow — 3s ────────────────────────────
  console.log("[00:05] Scene 2: Navigate to Workflow");
  await page.click('[data-testid="nav-workflow"]');
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(3000);

  // ─── Scene 3: Fill the Intake Form ─────────────────────────────────
  console.log("[00:08] Scene 3: Fill Intake Form");

  // Title
  const titleInput = page.locator('input[placeholder*="profile photo"], input[placeholder*="carousel"], input[placeholder*="feature"]').first();
  await titleInput.click();
  await page.waitForTimeout(300);
  await titleInput.type(FEATURE_REQUEST.title, { delay: 35 });
  await page.waitForTimeout(500);

  // Description
  const descInput = page.locator('textarea[placeholder*="Describe"]');
  await descInput.click();
  await page.waitForTimeout(300);
  await descInput.type(FEATURE_REQUEST.description, { delay: 10 });
  await page.waitForTimeout(500);

  // Add S3 sources one by one
  console.log("[--:--] Adding S3 sources...");
  const sourceInput = page.locator('input[placeholder*="https://"]').first();
  const addSourceBtn = page.locator('button:has-text("Add")').first();

  for (const source of FEATURE_REQUEST.sources) {
    await sourceInput.click();
    await sourceInput.fill(source);
    await page.waitForTimeout(300);
    await addSourceBtn.click();
    await page.waitForTimeout(500);
  }

  // Repo URL
  const repoInput = page.locator('input[placeholder*="github.com"]');
  await repoInput.click();
  await repoInput.fill(FEATURE_REQUEST.repoUrl);
  await page.waitForTimeout(300);

  // Model selector
  const modelSelect = page.locator("#model-select");
  if (await modelSelect.isVisible().catch(() => false)) {
    await modelSelect.selectOption({ label: "Claude Opus 4" });
    await page.waitForTimeout(300);
  }

  // Pause to show filled form
  await page.waitForTimeout(3000);

  // ─── Scene 4: Submit ───────────────────────────────────────────────
  console.log("[--:--] Scene 4: Submit workflow");
  const submitBtn = page.locator('button[type="submit"]');
  await submitBtn.click();
  await page.waitForTimeout(5000);

  // ─── Scene 5-8: Watch agents work ─────────────────────────────────
  console.log("[--:--] Scene 5+: Agents working (real invocation)...");

  const startTime = Date.now();
  const MAX_WAIT = 2100000; // 35 minutes
  let completed = false;
  let lastPhase = "";

  while (Date.now() - startTime < MAX_WAIT) {
    const bodyText = await page.textContent("body").catch(() => "");
    const lower = (bodyText || "").toLowerCase();

    // Check for completion
    if (
      lower.includes("workflow complete") ||
      lower.includes("pipeline complete") ||
      lower.includes("pr ready for review") ||
      lower.includes("pull request ready") ||
      lower.includes("pull request created")
    ) {
      completed = true;
      break;
    }

    // Log phase transitions
    const phases = ["requirements", "design", "development", "verification", "review", "complete"];
    for (const phase of phases) {
      if (lower.includes(`phase: ${phase}`) || lower.includes(`phase ${phase}`)) {
        if (phase !== lastPhase) {
          const elapsed = Math.round((Date.now() - startTime) / 1000);
          console.log(`  [${elapsed}s] Phase transition: ${phase}`);
          lastPhase = phase;
        }
      }
    }

    const elapsed = Math.round((Date.now() - startTime) / 1000);
    if (elapsed % 60 < 6) {
      console.log(`  [${elapsed}s] Still working... (${lastPhase || "starting"})`);
    }

    await page.waitForTimeout(5000);
  }

  const totalElapsed = Math.round((Date.now() - startTime) / 1000);
  if (completed) {
    console.log(`[${totalElapsed}s] Workflow completed!`);
  } else {
    console.log(`[${totalElapsed}s] WARNING: Timed out after ${Math.round(totalElapsed / 60)} minutes`);
  }

  // ─── Scene 9: Dwell on completion (10s) ────────────────────────────
  console.log("Scene 9: Completion dwell");
  await page.waitForTimeout(10000);

  // ─── Take a final screenshot for reference ─────────────────────────
  await page.screenshot({ path: path.join(RECORDING_DIR, "v3-final-state.png"), fullPage: true });

  // ─── Close recording ───────────────────────────────────────────────
  await context.close();

  // Rename video file
  const files = fs.readdirSync(RECORDING_DIR).filter(f => f.endsWith(".webm") && !f.startsWith("raw-demo"));
  if (files.length > 0) {
    const sorted = files
      .map(f => ({ name: f, time: fs.statSync(path.join(RECORDING_DIR, f)).mtime.getTime() }))
      .sort((a, b) => b.time - a.time);
    const finalPath = path.join(RECORDING_DIR, "raw-demo-v3.webm");
    fs.renameSync(path.join(RECORDING_DIR, sorted[0].name), finalPath);
    console.log(`\nRecording saved: ${finalPath}`);
    const stats = fs.statSync(finalPath);
    console.log(`File size: ${(stats.size / 1024 / 1024).toFixed(1)} MB`);
    console.log(`Duration: ~${Math.round(totalElapsed / 60)} minutes`);
  }
});
