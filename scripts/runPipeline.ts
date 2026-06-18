import { existsSync } from "node:fs";
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { writeProcessedMotion } from "./processMotion";

interface PipelineArgs {
  input: string;
  name: string;
  syntheticOnFail: boolean;
  maxFrames?: string;
}

const POSE_MODEL_PATH = "models/pose_landmarker_full.task";

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (!existsSync(args.input)) {
    throw new Error(`Input video not found: ${args.input}`);
  }

  const runDir = path.join("public", "runs", args.name);
  const screenshotsDir = path.join(runDir, "screenshots");
  const rawLandmarksPath = path.join(runDir, "raw_landmarks.json");
  const animationPath = path.join(runDir, "animation.json");
  const reportPath = path.join(runDir, "report.json");
  await mkdir(screenshotsDir, { recursive: true });

  runPython(["scripts/download_pose_model.py"]);

  const extractArgs = [
    "scripts/extract_pose.py",
    "--input",
    args.input,
    "--output",
    rawLandmarksPath,
    "--screenshots",
    screenshotsDir,
    "--model",
    POSE_MODEL_PATH
  ];
  if (args.maxFrames) {
    extractArgs.push("--max-frames", args.maxFrames);
  }

  const extraction = runPython(extractArgs, { allowFailure: args.syntheticOnFail });
  const lowFixtureDetection = extraction.ok && args.syntheticOnFail
    ? await hasLowDetectionRate(rawLandmarksPath)
    : false;
  if (!extraction.ok || lowFixtureDetection) {
    if (!args.syntheticOnFail) {
      throw new Error("Pose extraction failed");
    }
    console.warn("Using explicit synthetic smoke fallback.");
    runPython([
      "scripts/extract_synthetic_pose.py",
      "--input",
      args.input,
      "--output",
      rawLandmarksPath,
      "--screenshots",
      screenshotsDir
    ]);
  }

  await writeProcessedMotion({
    input: rawLandmarksPath,
    output: animationPath,
    report: reportPath,
    modelUrl: "/models/hoopbot.glb"
  });

  console.log(`Run ready: ${runDir}`);
}

async function hasLowDetectionRate(rawLandmarksPath: string): Promise<boolean> {
  const payload = JSON.parse(await readFile(rawLandmarksPath, "utf8")) as {
    processedFrames?: number;
    frames?: Array<{ detected?: boolean }>;
  };
  const frames = payload.frames ?? [];
  const processedFrames = payload.processedFrames ?? frames.length;
  const detectedFrames = frames.filter((frame) => frame.detected).length;
  const rate = processedFrames ? detectedFrames / processedFrames : 0;
  return rate < 0.2;
}

function runPython(argv: string[], options: { allowFailure?: boolean } = {}): { ok: boolean } {
  const venvPython = process.platform === "win32"
    ? path.resolve(".venv/Scripts/python.exe")
    : path.resolve(".venv/bin/python");
  const executable = existsSync(venvPython)
    ? venvPython
    : process.platform === "win32"
      ? "python"
      : "python3";
  const result = spawnSync(executable, argv, {
    stdio: "inherit",
    shell: false
  });
  if (result.status !== 0) {
    if (options.allowFailure) {
      return { ok: false };
    }
    throw new Error(`${executable} ${argv.join(" ")} exited with ${result.status ?? "no status"}`);
  }
  return { ok: true };
}

function parseArgs(argv: string[]): PipelineArgs {
  const args = new Map<string, string | boolean>();
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    if (!key.startsWith("--")) {
      continue;
    }
    if (key === "--synthetic-on-fail") {
      args.set("synthetic-on-fail", true);
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
  if (typeof input !== "string") {
    throw new Error("Usage: npm run pipeline -- --input data/input/clip.mp4 --name run-name");
  }
  const parsed = path.parse(input);
  const name = args.get("name");

  return {
    input,
    name: typeof name === "string" ? name : parsed.name,
    syntheticOnFail: args.get("synthetic-on-fail") === true,
    maxFrames: typeof args.get("max-frames") === "string" ? String(args.get("max-frames")) : undefined
  };
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
