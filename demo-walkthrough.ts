import { chromium } from "playwright";
import { join } from "path";

const BASE = "http://localhost:3001";
const SCREENSHOT_DIR = join(__dirname, "demo-screenshots");

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    colorScheme: "dark",
  });
  const page = await context.newPage();

  // Collect console errors and network failures
  const issues: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      issues.push(`[CONSOLE ERROR] ${msg.text()}`);
    }
  });
  page.on("pageerror", (err) => {
    issues.push(`[PAGE ERROR] ${err.message}`);
  });
  page.on("response", (res) => {
    if (res.status() >= 500) {
      issues.push(`[HTTP 5xx] ${res.url()} → ${res.status()}`);
    }
  });

  const screenshots: string[] = [];
  async function snap(name: string) {
    const path = join(SCREENSHOT_DIR, `${String(screenshots.length + 1).padStart(2, "0")}-${name}.png`);
    await page.screenshot({ path, fullPage: false });
    screenshots.push(path);
    console.log(`📸 ${name}`);
  }

  // --- DEMO FLOW ---

  // 1. Dashboard
  console.log("\n🏠 Dashboard");
  await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 15000 });
  await page.waitForTimeout(3000);
  await snap("dashboard");

  // Check branding
  const sidebarTitle = await page.textContent("aside h1");
  const sidebarSub = await page.textContent("aside p");
  if (sidebarTitle !== "Agentis") issues.push(`[BRANDING] Sidebar title is "${sidebarTitle}", expected "Agentis"`);
  if (sidebarSub !== "Hub") issues.push(`[BRANDING] Sidebar subtitle is "${sidebarSub}", expected "Hub"`);

  // Check page title
  const pageTitle = await page.title();
  if (!pageTitle.includes("Agentis Hub")) issues.push(`[BRANDING] Page title is "${pageTitle}", expected to contain "Agentis Hub"`);

  // Check region selector exists
  const regionBtn = await page.locator("button:has(svg)").filter({ hasText: /us-east|us-west|loading|switching/ });
  if (await regionBtn.count() === 0) issues.push("[UI] Region selector not found in header");

  // Check search bar is gone
  const searchInput = await page.locator('[data-testid="global-search"]');
  if (await searchInput.count() > 0) issues.push("[UI] Search input still visible (should be removed)");

  // Check agent cards loaded
  await page.waitForTimeout(2000);
  await snap("dashboard-loaded");
  const agentCards = await page.locator('[class*="cursor-pointer"]').count();
  console.log(`  Found ${agentCards} agent cards`);
  if (agentCards === 0) issues.push("[DATA] No agent cards on dashboard");

  // 2. Agents page
  console.log("\n🤖 Agents Page");
  await page.click('[data-testid="nav-agents"]');
  await page.waitForTimeout(2000);
  await snap("agents-page");

  const agentRows = await page.locator("table tbody tr, [class*='grid'] > div").count();
  console.log(`  Found ${agentRows} agent entries`);

  // 3. Click first agent → detail page
  console.log("\n📋 Agent Detail Page");
  const firstAgentLink = page.locator("a[href*='/agents/']").first();
  if (await firstAgentLink.count() > 0) {
    await firstAgentLink.click();
    await page.waitForTimeout(3000);
    await snap("agent-detail");

    // Check key sections exist
    const hasChat = await page.locator("textarea, input[placeholder*='message'], input[placeholder*='Ask']").count();
    if (hasChat === 0) issues.push("[UI] No chat input on agent detail page");

    // Check session panel
    const sessionPanel = await page.locator("text=Sessions").count();
    if (sessionPanel === 0) issues.push("[UI] No sessions panel on agent detail page");

    // Check memory selector
    const memorySelect = await page.locator("select").count();
    console.log(`  Memory selectors found: ${memorySelect}`);

    // Try sending a message (don't wait for full response, just check it doesn't crash)
    const chatInput = page.locator("textarea, input[placeholder*='message'], input[placeholder*='Ask']").first();
    if (await chatInput.count() > 0) {
      await chatInput.fill("Hello, what can you help me with?");
      await snap("agent-chat-typed");

      // Find and click send button
      const sendBtn = page.locator("button").filter({ hasText: /send/i }).first();
      const submitBtn = page.locator('button[type="submit"]').first();
      const arrowBtn = page.locator("button svg").last();

      if (await sendBtn.count() > 0) {
        await sendBtn.click();
      } else if (await submitBtn.count() > 0) {
        await submitBtn.click();
      } else {
        // Try pressing Enter
        await chatInput.press("Enter");
      }

      console.log("  Sent message, waiting for response...");
      await page.waitForTimeout(8000);
      await snap("agent-chat-response");

      // Check for error messages in chat
      const errorInChat = await page.locator("text=Error:").count();
      if (errorInChat > 0) {
        const errorText = await page.locator("text=Error:").first().textContent();
        issues.push(`[CHAT ERROR] ${errorText}`);
      }
    }
  } else {
    issues.push("[UI] No agent links found on agents page");
  }

  // 4. Build page
  console.log("\n🔨 Build Page");
  await page.click('[data-testid="nav-build"]');
  await page.waitForTimeout(2000);
  await snap("build-page");

  // Check build page has content
  const buildContent = await page.locator("main").textContent();
  if (!buildContent || buildContent.length < 20) issues.push("[UI] Build page appears empty");

  // 5. Test region dropdown
  console.log("\n🌍 Region Selector");
  await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 15000 });
  await page.waitForTimeout(3000);
  const regionButton = page.locator("button").filter({ hasText: /us-east-1|us-west/ }).first();
  if (await regionButton.count() > 0) {
    await regionButton.click();
    await page.waitForTimeout(500);
    await snap("region-dropdown-open");

    const regionOptions = await page.locator('[class*="font-mono"]').count();
    console.log(`  Region options visible: ${regionOptions}`);
    if (regionOptions <= 1) issues.push("[UI] Region dropdown has no options");

    // Close dropdown without switching
    await page.keyboard.press("Escape");
  } else {
    issues.push("[UI] Region button not found");
  }

  // 6. Check responsive / visual issues
  console.log("\n📐 Visual Checks");
  // Check for overflow issues
  const bodyOverflow = await page.evaluate(() => {
    return document.body.scrollWidth > window.innerWidth;
  });
  if (bodyOverflow) issues.push("[VISUAL] Horizontal overflow detected");

  // Check for broken images
  const brokenImages = await page.evaluate(() => {
    const imgs = document.querySelectorAll("img");
    return Array.from(imgs).filter((img) => !img.complete || img.naturalWidth === 0).length;
  });
  if (brokenImages > 0) issues.push(`[VISUAL] ${brokenImages} broken image(s)`);

  // --- REPORT ---
  console.log("\n\n" + "=".repeat(60));
  console.log("📊 DEMO WALKTHROUGH REPORT");
  console.log("=".repeat(60));
  console.log(`\nScreenshots: ${screenshots.length} captured in demo-screenshots/`);
  console.log(`Issues found: ${issues.length}\n`);

  if (issues.length > 0) {
    for (const issue of issues) {
      console.log(`  ⚠️  ${issue}`);
    }
  } else {
    console.log("  ✅ No issues found!");
  }

  console.log("\n" + "=".repeat(60));
  await browser.close();
}

main().catch((err) => {
  console.error("Script failed:", err);
  process.exit(1);
});
