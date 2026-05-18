/**
 * Capture before/after mockup screenshots at 1920x1080
 */
import { test } from "@playwright/test";
import * as path from "path";

test("Capture before mockup", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();
  await page.goto(`file://${path.join(__dirname, "mockups/before.html")}`);
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(__dirname, "mockups/before.png") });
  await context.close();
  console.log("Saved: demo/mockups/before.png");
});

test("Capture after mockup", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();
  await page.goto(`file://${path.join(__dirname, "mockups/after.html")}`);
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(__dirname, "mockups/after.png") });
  await context.close();
  console.log("Saved: demo/mockups/after.png");
});
