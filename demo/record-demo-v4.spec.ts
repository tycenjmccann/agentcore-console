/**
 * V4 Demo Recording — Agentis Hub: Collapsible Sidebar + Intake Card
 *
 * This records a REAL pipeline run where the pipeline implements:
 * - Collapsible/resizable history sidebar with auto-hide
 * - Intake card showing epic name and expandable source links
 *
 * Flow:
 * 1. Dashboard overview (brief)
 * 2. Navigate to Workflow
 * 3. Fill intake form with sidebar/intake card PRD
 * 4. Add S3 sources (PRD + context files)
 * 5. Select Claude Opus 4 model
 * 6. Submit and watch agents work through all phases
 * 7. Dwell on completion
 *
 * Run (REAL mode — no DEMO_MODE):
 *   npx playwright test demo/record-demo-v4.spec.ts --config demo/playwright-v4.config.ts
 *
 * Expected duration: 20-40 minutes raw (agents doing real work)
 */

import { test } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

const BASE_URL = process.env.DEMO_BASE_URL || "http://localhost:3000";
const RECORDING_DIR = path.join(__dirname, "recordings");

const S3_BUCKET = process.env.S3_BUCKET || "agentcore-artifacts-023392223961-us-east-1";

const FEATURE_REQUEST = {
  title: "Collapsible History Sidebar + Intake Card Enhancements",
  description: `Enhance the workflow page with two improvements:

1. COLLAPSIBLE SIDEBAR: Make the left history sidebar collapsible/resizable:
   - Auto-collapses when user selects a workflow (gives pipeline full width)
   - ChevronRight expand button appears on left edge when collapsed
   - Drag handle on right edge for resize (220px-480px range, default 320px)
   - Epic titles in list wrap instead of truncating
   - Smooth 300ms transition animation

2. INTAKE CARD ENHANCEMENTS: Enrich the Intake phase card in the pipeline:
   - Show epic/feature title (from state.input.title) as subtitle in Phase 1 box
   - Make "User Actions" items expandable with chevron indicators
   - Expanded items reveal actual source links from state.input.sources
   - S3 sources show filename, URL sources open in new tab
   - Epic ID shown in Trigger section when workflow is loaded

Files to modify:
- src/app/workflow/page.tsx (sidebar logic)
- src/components/workflow/WorkflowBoard.tsx (intake card)

Dependencies already available: lucide-react (ChevronLeft, ChevronRight, GripVertical, ChevronDown), Tailwind CSS, CSS variables.

See attached PRD for full spec, acceptance criteria, and technical context.`,
  repoUrl: "https://github.com/tycenjmccann/agentcore-console",
  sources: [
    `s3://${S3_BUCKET}/intake-sources/sidebar-intake-v4/prd.md`,
    `s3://${S3_BUCKET}/intake-sources/sidebar-intake-v4/context/page.tsx`,
    `s3://${S3_BUCKET}/intake-sources/sidebar-intake-v4/context/WorkflowBoard.tsx`,
    `s3://${S3_BUCKET}/intake-sources/sidebar-intake-v4/context/types.ts`,
  ],
};

test.setTimeout(2400000); // 40 minutes max

test("Record Agentis Hub demo v4 — Collapsible Sidebar + Intake Card", async ({ browser }) => {
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
  await page.click('a[href="/workflow"], [data-testid="nav-workflow"]');
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(3000);

  // ─── Scene 3: Click New Workflow ───────────────────────────────────
  console.log("[00:08] Scene 3: New Workflow");
  await page.click('button[title="New Workflow"]');
  await page.waitForTimeout(1500);

  // ─── Scene 4: Fill the Intake Form ─────────────────────────────────
  console.log("[00:10] Scene 4: Fill Intake Form");

  // Title
  const titleInput = page.locator('input[placeholder*="profile photo"], input[placeholder*="carousel"], input[placeholder*="feature"], input[placeholder*="Add"]').first();
  await titleInput.click();
  await page.waitForTimeout(300);
  await titleInput.type(FEATURE_REQUEST.title, { delay: 30 });
  await page.waitForTimeout(500);

  // Description
  const descInput = page.locator('textarea[placeholder*="Describe"]');
  await descInput.click();
  await page.waitForTimeout(300);
  await descInput.type(FEATURE_REQUEST.description, { delay: 8 });
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

  // Model selector — select Opus 4
  const modelSelect = page.locator("#model-select");
  if (await modelSelect.isVisible().catch(() => false)) {
    await modelSelect.selectOption({ label: "Claude Opus 4" });
    await page.waitForTimeout(300);
  }

  // Pause to show filled form
  await page.waitForTimeout(3000);

  // ─── Scene 5: Submit ───────────────────────────────────────────────
  console.log("[--:--] Scene 5: Submit workflow");
  const submitBtn = page.locator('button[type="submit"]');
  await submitBtn.click();
  await page.waitForTimeout(5000);

  // ─── Scene 6+: Watch agents work ──────────────────────────────────
  console.log("[--:--] Scene 6+: Agents working (real invocation)...");

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
      lower.includes("all agents have completed") ||
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

  // ─── Scene 7: Dwell on completion (10s) ────────────────────────────
  console.log("Scene 7: Completion dwell");
  await page.waitForTimeout(10000);

  // ─── Take a final screenshot for reference ─────────────────────────
  await page.screenshot({ path: path.join(RECORDING_DIR, "v4-final-state.png"), fullPage: true });

  // ─── Close recording ───────────────────────────────────────────────
  await context.close();

  // Rename video file
  const files = fs.readdirSync(RECORDING_DIR).filter(f => f.endsWith(".webm") && !f.startsWith("raw-demo"));
  if (files.length > 0) {
    const sorted = files
      .map(f => ({ name: f, time: fs.statSync(path.join(RECORDING_DIR, f)).mtime.getTime() }))
      .sort((a, b) => b.time - a.time);
    const finalPath = path.join(RECORDING_DIR, "raw-demo-v4.webm");
    fs.renameSync(path.join(RECORDING_DIR, sorted[0].name), finalPath);
    console.log(`\nRecording saved: ${finalPath}`);
    const stats = fs.statSync(finalPath);
    console.log(`File size: ${(stats.size / 1024 / 1024).toFixed(1)} MB`);
    console.log(`Duration: ~${Math.round(totalElapsed / 60)} minutes`);
  }
});
