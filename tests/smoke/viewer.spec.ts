import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";
import path from "node:path";

test("loads fixture animation and captures versioned screenshots", async ({ page }) => {
  await page.goto("/?run=fixture-reach");
  await page.waitForFunction(() => window.__KINERIG_READY === true);
  await expect(page.locator("#runLabel")).toHaveText("fixture-reach");
  await expect(page.locator("#reportList")).toContainText("Frames");
  await page.waitForTimeout(300);

  const screenshotDir = path.resolve("docs/screenshots/v1.1.2");
  mkdirSync(screenshotDir, { recursive: true });
  await page.screenshot({
    path: path.join(screenshotDir, "viewer-fixture-reach.png"),
    fullPage: true
  });
  await page.locator("canvas").screenshot({
    path: path.join(screenshotDir, "animated-character-fixture-reach.png")
  });
});
