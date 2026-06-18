import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";
import path from "node:path";

test("searches and hands off acquired motion from the Acquire screen", async ({ page }) => {
  await page.route("**/api/acquire/status", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        providers: [
          { provider: "pexels", configured: true, source: "pexel_key.txt" },
          { provider: "pixabay", configured: true, source: "pixabay_key.txt" }
        ]
      })
    });
  });
  await page.route("**/api/acquire/search", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        schemaVersion: "kinerig.stock-video-search.v1",
        generatedAt: "2026-06-18T00:00:00.000Z",
        prompt: "full body person walking",
        queries: ["full body person walking"],
        providers: ["pexels"],
        warnings: [],
        notes: [],
        candidates: [
          {
            provider: "pexels",
            id: "12345",
            query: "full body person walking",
            sourceUrl: "https://www.pexels.com/video/12345/",
            downloadUrl: "https://videos.pexels.com/video-files/mock.mp4",
            contributorName: "Demo Creator",
            attributionText: "Video by Demo Creator on Pexels",
            licenseName: "Pexels License",
            licenseUrl: "https://www.pexels.com/license/",
            providerGuidelinesUrl: "https://www.pexels.com/api/documentation/",
            durationSec: 8,
            width: 1280,
            height: 720
          }
        ]
      })
    });
  });
  await page.route("**/api/acquire/process", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        runName: "mock-walk",
        index: {
          schemaVersion: "kinerig.run-index.v1",
          generatedAt: "2026-06-18T00:00:00.000Z",
          runs: [
            {
              name: "fixture-reach",
              provider: "synthetic",
              detectionSuccessRate: 1
            },
            {
              name: "mock-walk",
              provider: "pexels",
              attributionText: "Video by Demo Creator on Pexels",
              licenseName: "Pexels License",
              detectionSuccessRate: 0.92
            }
          ]
        }
      })
    });
  });

  await page.goto("/?mode=acquire");
  await expect(page.locator("#runLabel")).toHaveText("Acquire Motion");
  await expect(page.locator("#acquireKeyStatus")).toContainText("pexels ready");

  await page.locator("#searchStock").click();
  await expect(page.locator("#candidateList")).toContainText("pexels 12345");
  await expect(page.locator("#acquireStatus")).toContainText("Found 1 candidates");

  await page.locator("#acquireRunName").fill("mock-walk");
  await page.locator("#processStock").click();
  await expect(page.locator("#acquireStatus")).toContainText("Processed mock-walk");
  await expect(page.locator("#openProcessedMotion")).toBeEnabled();
  await expect(page.locator("#previewProcessedRig")).toBeEnabled();
  await expect(page.locator("#runLibrary")).toContainText("mock-walk");

  await page.mouse.move(24, 24);
  await page.waitForTimeout(250);

  const screenshotDir = path.resolve("docs/screenshots/v1.3.1");
  mkdirSync(screenshotDir, { recursive: true });
  await page.screenshot({
    path: path.join(screenshotDir, "acquire-motion-workflow.png"),
    fullPage: true
  });
});
