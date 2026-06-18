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

test("records real Pexels clip animation playback", async ({ page }) => {
  await page.goto("/?run=pexels-5586522");
  await page.waitForFunction(() => window.__HOOPMOTION_READY === true);
  await expect(page.locator("#runLabel")).toHaveText("pexels-5586522");
  await expect(page.locator("#reportList")).toContainText("100.0%");
  await page.waitForTimeout(5_000);

  const video = page.video();
  await page.close();
  const videoPath = await video?.path();
  if (!videoPath) {
    throw new Error("Playwright did not produce a video artifact");
  }

  const outputDir = path.resolve("docs/screenshots/v0.1.1");
  mkdirSync(outputDir, { recursive: true });
  copyFileSync(videoPath, path.join(outputDir, "pexels-5586522-viewer-playback.webm"));
});
