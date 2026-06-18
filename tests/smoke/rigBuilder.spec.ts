import { expect, test, type Page } from "@playwright/test";
import { existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import os from "node:os";
import path from "node:path";

test("auto-builds and exports a rig profile", async ({ page }) => {
  await page.goto("/?mode=rig");
  await page.waitForFunction(() => window.__KINERIG_RIG_READY === true);
  await expect(page.locator("#runLabel")).toHaveText("Rig Builder");
  await expect(page.locator("#selectedJointLabel")).toHaveText("Model");

  await page.locator("#autoRig").click();
  await expect(page.locator("#rigCountLabel")).toHaveText("18 / 18");
  await page.mouse.move(24, 24);
  await page.waitForTimeout(1_500);

  const outputDir = path.resolve("docs/screenshots/v1.2.0");
  const artifactDir = path.resolve("docs/artifacts/v1.2.0");
  mkdirSync(outputDir, { recursive: true });
  mkdirSync(artifactDir, { recursive: true });
  await page.screenshot({
    path: path.join(outputDir, "rig-builder-auto-rig.png"),
    fullPage: true
  });
  await page.locator("#autoRig").hover();
  await page.waitForTimeout(250);
  await page.screenshot({
    path: path.join(outputDir, "rig-builder-auto-tooltip.png"),
    fullPage: true
  });

  await page.locator("#previewRigMotion").click();
  await page.waitForFunction(() => window.__KINERIG_RIG_PREVIEW_READY === true);
  await expect(page.locator("#rigPreviewLabel")).toContainText("Previewing fixture-reach");
  const beforePreview = await getMarkerPosition(page, "LeftWrist");
  await page.waitForTimeout(1_000);
  const afterPreview = await getMarkerPosition(page, "LeftWrist");
  expect(distance(beforePreview, afterPreview)).toBeGreaterThan(0.01);
  await page.locator("#timeline").evaluate((input) => {
    const timeline = input as HTMLInputElement;
    timeline.value = "84";
    timeline.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await page.locator("#previewRigMotion").hover();
  await page.waitForTimeout(250);
  await page.screenshot({
    path: path.join(outputDir, "rig-builder-motion-preview.png"),
    fullPage: true
  });

  const download = page.waitForEvent("download");
  await page.locator("#exportRig").click();
  const rigDownload = await download;
  await rigDownload.saveAs(path.join(artifactDir, "posebot-auto-rig.json"));
});

test("imports and moves a GLB model root", async ({ page }) => {
  await page.goto("/?mode=rig");
  await page.waitForFunction(() => window.__KINERIG_RIG_READY === true);

  const importedModel = findLatestDownloadGlb();
  if (importedModel) {
    await page.locator("#rigModelFile").setInputFiles(importedModel);
    await page.waitForFunction(() => window.__KINERIG_RIG_READY === true);
    await expect(page.locator("#rigModelUrl")).toHaveValue(path.basename(importedModel));
  }

  await page.locator("#moveModel").click();
  await expect(page.locator("#selectedJointLabel")).toHaveText("Model");
  await expect(page.locator("#moveModel")).toHaveClass(/active/);
  const before = await page.evaluate(() => {
    const api = (window as unknown as {
      __KINERIG_RIG_TEST_API: { getModelPosition: () => [number, number, number] };
    }).__KINERIG_RIG_TEST_API;
    return api.getModelPosition();
  });

  await page.evaluate(() => {
    const api = (window as unknown as {
      __KINERIG_RIG_TEST_API: { translateModel: (offset: [number, number, number]) => void };
    }).__KINERIG_RIG_TEST_API;
    api.translateModel([0.45, 0, 0]);
  });

  const after = await page.evaluate(() => {
    const api = (window as unknown as {
      __KINERIG_RIG_TEST_API: { getModelPosition: () => [number, number, number] };
    }).__KINERIG_RIG_TEST_API;
    return api.getModelPosition();
  });
  expect(after[0]).toBeGreaterThan(before[0] + 0.4);
  await expect(page.locator("#modelTransformLabel")).toContainText(`X ${after[0].toFixed(2)}`);
  await page.waitForTimeout(1_000);

  const outputDir = path.resolve("docs/screenshots/v1.2.0");
  mkdirSync(outputDir, { recursive: true });
  await page.screenshot({
    path: path.join(outputDir, "rig-builder-imported-model-moved.png"),
    fullPage: true
  });
});

function findLatestDownloadGlb(): string | undefined {
  const downloadsDir = path.join(os.homedir(), "Downloads");
  if (!existsSync(downloadsDir)) {
    return undefined;
  }
  return readdirSync(downloadsDir)
    .filter((fileName) => fileName.toLowerCase().endsWith(".glb"))
    .map((fileName) => path.join(downloadsDir, fileName))
    .sort((left, right) => statSync(right).mtimeMs - statSync(left).mtimeMs)[0];
}

async function getMarkerPosition(page: Page, joint: string): Promise<[number, number, number]> {
  const position = await page.evaluate((targetJoint) => {
    const api = (window as unknown as {
      __KINERIG_RIG_TEST_API: { getMarkerPosition: (joint: string) => [number, number, number] | undefined };
    }).__KINERIG_RIG_TEST_API;
    return api.getMarkerPosition(targetJoint);
  }, joint);
  if (!position) {
    throw new Error(`No marker position for ${joint}`);
  }
  return position;
}

function distance(left: [number, number, number], right: [number, number, number]): number {
  return Math.hypot(left[0] - right[0], left[1] - right[1], left[2] - right[2]);
}
