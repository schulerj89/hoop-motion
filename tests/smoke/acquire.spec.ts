import { expect, test } from "@playwright/test";
import { mkdirSync, readFileSync } from "node:fs";
import path from "node:path";

test("searches and hands off acquired motion from the Acquire screen", async ({ page }) => {
  const animationFixture = readFileSync(path.resolve("public/runs/fixture-reach/animation.json"), "utf8");
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
  await page.route("https://videos.pexels.com/**", async (route) => {
    await route.fulfill({
      contentType: "video/mp4",
      path: path.resolve("data/input/fixture_reach.mp4")
    });
  });
  await page.route("**/api/acquire/search", async (route) => {
    const request = route.request().postDataJSON() as { page?: number };
    const pageNumber = request.page ?? 1;
    const id = pageNumber === 1 ? "12345" : "67890";
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        schemaVersion: "kinerig.stock-video-search.v1",
        generatedAt: "2026-06-18T00:00:00.000Z",
        prompt: "full body person walking",
        queries: ["full body person walking"],
        providers: ["pexels"],
        page: pageNumber,
        limit: 6,
        warnings: [],
        notes: [],
        candidates: [
          {
            provider: "pexels",
            id,
            query: "full body person walking",
            sourceUrl: `https://www.pexels.com/video/${id}/`,
            downloadUrl: `https://videos.pexels.com/video-files/${id}/mock.mp4`,
            contributorName: "Demo Creator",
            attributionText: "Video by Demo Creator on Pexels",
            licenseName: "Pexels License",
            licenseUrl: "https://www.pexels.com/license/",
            providerGuidelinesUrl: "https://www.pexels.com/api/documentation/",
            durationSec: 8,
            width: 1280,
            height: 720,
            previewImageUrl: "/runs/fixture-reach/screenshots/original/frame_0000.png"
          }
        ]
      })
    });
  });
  await page.route("**/runs/mock-walk/animation.json", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: animationFixture
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

  await page.goto("/?mode=rig");
  await expect(page.locator("#runLabel")).toHaveText("Rig Builder");
  await page.locator("#autoRig").click();
  await expect(page.locator("#rigCountLabel")).toHaveText("18 / 18");

  await page.locator("#acquireMode").click();
  await expect(page.locator("#runLabel")).toHaveText("Acquire Motion");
  await expect(page.locator("#acquireKeyStatus")).toContainText("pexels ready");
  await expect(page.locator("#activeRigStatus")).toContainText("Active rig:");

  await page.locator("#searchStock").click();
  await expect(page.locator("#candidateList")).toContainText("pexels 12345");
  await expect(page.locator("#acquireStatus")).toContainText("Found 1 candidates on page 1");
  await expect(page.locator("#searchPageLabel")).toHaveText("Page 1");

  await page.locator("#nextSearchPage").click();
  await expect(page.locator("#candidateList")).toContainText("pexels 67890");
  await expect(page.locator("#searchPageLabel")).toHaveText("Page 2");

  const screenshotDir = path.resolve("docs/screenshots/v1.4.0");
  mkdirSync(screenshotDir, { recursive: true });
  await page.mouse.move(24, 24);
  await page.waitForTimeout(250);
  await page.screenshot({
    path: path.join(screenshotDir, "acquire-paginated-search.png"),
    fullPage: true
  });

  await page.locator("#acquireRunName").fill("mock-walk");
  await page.locator("#processPreviewRig").click();
  await expect(page.locator("#rigPreviewLabel")).toContainText("Previewing mock-walk on active rig");
  await expect(page.locator("#rigCountLabel")).toHaveText("18 / 18");
  await expect(page.locator("#runLibrary")).toContainText("mock-walk");

  await page.mouse.move(24, 24);
  await page.waitForTimeout(250);

  await page.screenshot({
    path: path.join(screenshotDir, "acquire-process-preview-rig.png"),
    fullPage: true
  });
});
