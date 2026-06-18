import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";
import path from "node:path";

test("auto-builds and exports a rig profile", async ({ page }) => {
  await page.goto("/?mode=rig");
  await page.waitForFunction(() => window.__KINERIG_RIG_READY === true);
  await expect(page.locator("#runLabel")).toHaveText("Rig Builder");

  await page.locator("#autoRig").click();
  await expect(page.locator("#rigCountLabel")).toHaveText("18 / 18");
  await page.waitForTimeout(1_500);

  const outputDir = path.resolve("docs/screenshots/v1.1.0");
  const artifactDir = path.resolve("docs/artifacts/v1.1.0");
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
