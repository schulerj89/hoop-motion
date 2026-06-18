import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type {
  AnimationFile,
  MotionRunIndexEntry,
  MotionRunIndexFile,
  MotionSourceMetadata,
  ValidationReport
} from "../src/lib/types";

const RUNS_ROOT = path.join("public", "runs");

export async function updateRunIndex(runsRoot = RUNS_ROOT): Promise<MotionRunIndexFile> {
  await mkdir(runsRoot, { recursive: true });
  const entries = await readdir(runsRoot, { withFileTypes: true });
  const runs: MotionRunIndexEntry[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    const runDir = path.join(runsRoot, entry.name);
    const animation = await readJsonIfExists<AnimationFile>(path.join(runDir, "animation.json"));
    const report = await readJsonIfExists<ValidationReport>(path.join(runDir, "report.json"));
    const source = await readJsonIfExists<MotionSourceMetadata>(path.join(runDir, "source.json"));
    if (!animation && !report) {
      continue;
    }

    runs.push({
      name: entry.name,
      sourceVideo: report?.sourceVideo ?? animation?.sourceVideo,
      provider: source?.provider ?? (report?.synthetic ? "synthetic" : "local"),
      sourceUrl: source?.sourceUrl,
      contributorName: source?.contributorName,
      attributionText: source?.attributionText,
      licenseName: source?.licenseName,
      durationMs: animation?.durationMs,
      framesProcessed: report?.framesProcessed,
      detectionSuccessRate: report?.detectionSuccessRate,
      averageConfidence: report?.averageConfidence
    });
  }

  runs.sort((left, right) => left.name.localeCompare(right.name));
  const payload: MotionRunIndexFile = {
    schemaVersion: "kinerig.run-index.v1",
    generatedAt: new Date().toISOString(),
    runs
  };
  await writeFile(path.join(runsRoot, "index.json"), `${JSON.stringify(payload, null, 2)}\n`);
  return payload;
}

async function readJsonIfExists<T>(filePath: string): Promise<T | undefined> {
  if (!existsSync(filePath)) {
    return undefined;
  }
  return JSON.parse(await readFile(filePath, "utf8")) as T;
}

const isDirectRun = process.argv[1]
  ? path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
  : false;

if (isDirectRun) {
  updateRunIndex().then((index) => {
    console.log(`Indexed ${index.runs.length} runs in ${path.join(RUNS_ROOT, "index.json")}`);
  }).catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
