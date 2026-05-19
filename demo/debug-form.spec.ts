import { test } from "@playwright/test";

test.setTimeout(30000);

test("debug form interaction", async ({ page }) => {
  await page.goto("http://localhost:3000/workflow");
  await page.waitForLoadState("networkidle");
  console.log("[debug] Page loaded");

  const buttons = await page.locator("button").all();
  console.log(`[debug] Found ${buttons.length} buttons`);
  for (let i = 0; i < Math.min(buttons.length, 8); i++) {
    const text = await buttons[i].textContent();
    const titleAttr = await buttons[i].getAttribute("title");
    console.log(`  [${i}] text="${text?.trim().slice(0, 40)}" title="${titleAttr}"`);
  }

  // Try clicking the + button
  const plusBtn = page.locator('button[title="New Workflow"]');
  const visible = await plusBtn.isVisible();
  console.log(`[debug] Plus btn visible: ${visible}`);

  if (visible) {
    await plusBtn.click();
    console.log("[debug] Clicked +");
    await page.waitForTimeout(1500);

    const formInput = page.locator('input[placeholder*="profile photo"]');
    const formVisible = await formInput.isVisible();
    console.log(`[debug] Form input visible: ${formVisible}`);
  } else {
    console.log("[debug] Trying text-based button");
    // Maybe the page shows something else
    const content = await page.textContent("body");
    console.log(`[debug] Page text (first 200): ${content?.slice(0, 200)}`);
  }
});
