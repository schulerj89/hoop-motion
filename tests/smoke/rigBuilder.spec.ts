import { expect, test } from "@playwright/test";
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
  await page.waitForTimeout(1_500);

  const outputDir = path.resolve("docs/screenshots/v1.1.1");
  const artifactDir = path.resolve("docs/artifacts/v1.1.1");
  mkdirSync(outputDir, { recursive: true });
  mkdirSync(artifactDir, { recursive: true });
  await page.screenshot({
    path: path.join(outputDir, "rig-builder-auto-rig.png"),
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

  const outputDir = path.resolve("docs/screenshots/v1.1.1");
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
