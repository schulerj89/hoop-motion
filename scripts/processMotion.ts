import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { processLandmarks } from "../src/lib/motionProcessing";
import type { LandmarkFile } from "../src/lib/types";

interface ProcessArgs {
  input: string;
  output: string;
  report: string;
  modelUrl?: string;
}

export async function writeProcessedMotion(args: ProcessArgs): Promise<void> {
  const raw = JSON.parse(await readFile(args.input, "utf8")) as LandmarkFile;
  const animation = processLandmarks(raw, { modelUrl: args.modelUrl });

  await mkdir(path.dirname(args.output), { recursive: true });
  await mkdir(path.dirname(args.report), { recursive: true });
  await writeFile(args.output, `${JSON.stringify(animation, null, 2)}\n`);
  await writeFile(args.report, `${JSON.stringify(animation.report, null, 2)}\n`);

  console.log(`Wrote ${args.output}`);
  console.log(`Wrote ${args.report}`);
}

function parseArgs(argv: string[]): ProcessArgs {
  const args = new Map<string, string>();
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    if (!key.startsWith("--")) {
      continue;
    }
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`Missing value for ${key}`);
    }
    args.set(key.slice(2), value);
    index += 1;
  }

  const input = args.get("input");
  const output = args.get("output") ?? "public/runs/latest/animation.json";
  const report = args.get("report") ?? "public/runs/latest/report.json";
  if (!input) {
    throw new Error("Usage: npm run process -- --input public/runs/<name>/raw_landmarks.json --output public/runs/<name>/animation.json --report public/runs/<name>/report.json");
  }
  return {
    input,
    output,
    report,
    modelUrl: args.get("model-url")
  };
}

const isDirectRun = process.argv[1]
  ? path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
  : false;

if (isDirectRun) {
  writeProcessedMotion(parseArgs(process.argv.slice(2))).catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
