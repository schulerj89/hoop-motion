import { expect, test } from "@playwright/test";
import { copyFileSync, mkdirSync } from "node:fs";
import path from "node:path";

test.use({
  viewport: { width: 1280, height: 720 },
  video: {
    mode: "on",
    size: { width: 1280, height: 720 }
  }
});

test("records neutral sample animation playback", async ({ page }) => {
  await page.goto("/?run=fixture-reach");
  await page.waitForFunction(() => window.__KINERIG_READY === true);
  await expect(page.locator("#runLabel")).toHaveText("fixture-reach");
  await expect(page.locator("#reportList")).toContainText("Frames");
  await page.waitForTimeout(5_000);

  const video = page.video();
  await page.close();
  const videoPath = await video?.path();
  if (!videoPath) {
    throw new Error("Playwright did not produce a video artifact");
  }

  const outputDir = path.resolve("docs/screenshots/v1.1.3");
  mkdirSync(outputDir, { recursive: true });
  copyFileSync(videoPath, path.join(outputDir, "fixture-reach-viewer-playback.webm"));
});
