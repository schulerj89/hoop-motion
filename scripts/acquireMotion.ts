import { existsSync, readFileSync } from "node:fs";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import {
  choosePexelsVideoFile,
  choosePixabayVideoFile,
  createMotionSearchPlan,
  normalizeRunName,
  scoreStockCandidate,
  type PexelsVideoFile,
  type PixabayVideoVariant,
  type StockVideoCandidate,
  type StockVideoProvider
} from "../src/lib/motionAcquisition";
import type { MotionSourceMetadata } from "../src/lib/types";
import { updateRunIndex } from "./runIndex";

interface AcquireArgs {
  query?: string;
  motion?: string;
  provider: "all" | StockVideoProvider;
  limit: number;
  page: number;
  candidateIndex: number;
  runName?: string;
  download: boolean;
  process: boolean;
  maxFrames?: string;
}

interface SearchManifest {
  schemaVersion: "kinerig.stock-video-search.v1";
  generatedAt: string;
  prompt: string;
  queries: string[];
  providers: Array<"pexels" | "pixabay">;
  candidates: StockVideoCandidate[];
  page: number;
  limit: number;
  warnings: string[];
  notes: string[];
}

interface PexelsVideo {
  id: number;
  width: number;
  height: number;
  url: string;
  image?: string;
  duration?: number;
  user?: {
    name?: string;
    url?: string;
  };
  video_files?: PexelsVideoFile[];
}

interface PexelsSearchResponse {
  videos?: PexelsVideo[];
}

interface PixabayVideo {
  id: number;
  pageURL: string;
  tags?: string;
  duration?: number;
  user?: string;
  user_id?: number;
  videos?: Record<string, PixabayVideoVariant | undefined>;
}

interface PixabaySearchResponse {
  hits?: PixabayVideo[];
}

const PEXELS_GUIDELINES_URL = "https://www.pexels.com/api/documentation/";
const PEXELS_LICENSE_URL = "https://www.pexels.com/license/";
const PIXABAY_GUIDELINES_URL = "https://pixabay.com/api/docs/";
const PIXABAY_LICENSE_URL = "https://pixabay.com/service/license-summary/";

async function main(): Promise<void> {
  loadLocalEnv();
  const args = parseArgs(process.argv.slice(2));
  const plan = createMotionSearchPlan({ query: args.query, motion: args.motion });
  const providers = resolveProviders(args.provider);
  const warnings: string[] = [];
  const candidates: StockVideoCandidate[] = [];

  for (const provider of providers) {
    const key = provider === "pexels" ? process.env.PEXELS_API_KEY : process.env.PIXABAY_API_KEY;
    if (!key) {
      warnings.push(`Missing ${provider === "pexels" ? "PEXELS_API_KEY" : "PIXABAY_API_KEY"}; skipped ${provider}.`);
      continue;
    }

    for (const query of plan.queries) {
      const next = provider === "pexels"
        ? await searchPexels(query, key, args.limit, args.page)
        : await searchPixabay(query, key, args.limit, args.page);
      candidates.push(...next);
    }
  }

  const deduped = dedupeCandidates(candidates)
    .sort((left, right) => scoreStockCandidate(right) - scoreStockCandidate(left))
    .slice(0, args.limit);
  const searchSlug = normalizeRunName(plan.prompt);
  const searchDir = path.join("data", "search", searchSlug);
  await mkdir(searchDir, { recursive: true });

  const manifest: SearchManifest = {
    schemaVersion: "kinerig.stock-video-search.v1",
    generatedAt: new Date().toISOString(),
    prompt: plan.prompt,
    queries: plan.queries,
    providers,
    candidates: deduped,
    page: args.page,
    limit: args.limit,
    warnings,
    notes: [
      ...plan.providerHints,
      "Do not use this as a mass downloader. Review source pages and process a small number of clips intentionally."
    ]
  };
  const manifestPath = path.join(searchDir, "candidates.json");
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  printCandidates(manifest, manifestPath);

  if (!args.download) {
    return;
  }

  const candidate = deduped[args.candidateIndex];
  if (!candidate) {
    throw new Error(`No candidate at index ${args.candidateIndex}. Search metadata written to ${manifestPath}`);
  }

  const runName = normalizeRunName(args.runName ?? `${candidate.provider}-${plan.prompt}-${candidate.id}`);
  const inputPath = path.join("data", "input", `${runName}.mp4`);
  await downloadVideo(candidate.downloadUrl, inputPath);
  await writeFile(path.join("data", "input", `${runName}.source.json`), `${JSON.stringify(candidate, null, 2)}\n`);
  console.log(`Downloaded ${inputPath}`);

  if (args.process) {
    runPipeline(inputPath, runName, args.maxFrames);
    const source = createSourceMetadata(runName, inputPath, candidate);
    await writeFile(path.join("public", "runs", runName, "source.json"), `${JSON.stringify(source, null, 2)}\n`);
    await updateRunIndex();
    console.log(`Motion run ready: public/runs/${runName}`);
  }
}

async function searchPexels(query: string, apiKey: string, limit: number, page: number): Promise<StockVideoCandidate[]> {
  const url = new URL("https://api.pexels.com/v1/videos/search");
  url.searchParams.set("query", query);
  url.searchParams.set("per_page", String(Math.min(Math.max(limit, 1), 20)));
  url.searchParams.set("page", String(Math.max(page, 1)));
  const cachePath = path.join("data", "cache", "stock-search", `pexels-${normalizeRunName(query)}-${limit}-page-${page}.json`);
  const payload = await fetchJsonWithCache<PexelsSearchResponse>(cachePath, 6 * 60 * 60 * 1000, async () => {
    const response = await fetch(url, { headers: { Authorization: apiKey } });
    if (!response.ok) {
      throw new Error(`Pexels search failed: ${response.status} ${await response.text()}`);
    }
    return await response.json() as PexelsSearchResponse;
  });
  return (payload.videos ?? []).flatMap((video) => {
    const file = choosePexelsVideoFile(video.video_files ?? []);
    if (!file?.link) {
      return [];
    }
    return [{
      provider: "pexels",
      id: String(video.id),
      query,
      sourceUrl: video.url,
      downloadUrl: file.link,
      contributorName: video.user?.name,
      contributorUrl: video.user?.url,
      attributionText: video.user?.name ? `Video by ${video.user.name} on Pexels` : "Video from Pexels",
      licenseName: "Pexels License",
      licenseUrl: PEXELS_LICENSE_URL,
      providerGuidelinesUrl: PEXELS_GUIDELINES_URL,
      durationSec: video.duration,
      width: file.width ?? video.width,
      height: file.height ?? video.height,
      fileType: file.file_type,
      fps: file.fps,
      previewImageUrl: video.image
    } satisfies StockVideoCandidate];
  });
}

async function searchPixabay(query: string, apiKey: string, limit: number, page: number): Promise<StockVideoCandidate[]> {
  const url = new URL("https://pixabay.com/api/videos/");
  url.searchParams.set("key", apiKey);
  url.searchParams.set("q", query);
  url.searchParams.set("per_page", String(Math.min(Math.max(limit, 3), 20)));
  url.searchParams.set("page", String(Math.max(page, 1)));
  url.searchParams.set("safesearch", "true");
  const cachePath = path.join("data", "cache", "stock-search", `pixabay-${normalizeRunName(query)}-${limit}-page-${page}.json`);
  const payload = await fetchJsonWithCache<PixabaySearchResponse>(cachePath, 24 * 60 * 60 * 1000, async () => {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Pixabay search failed: ${response.status} ${await response.text()}`);
    }
    return await response.json() as PixabaySearchResponse;
  });
  return (payload.hits ?? []).flatMap((video) => {
    const file = choosePixabayVideoFile(video.videos ?? {});
    if (!file?.url) {
      return [];
    }
    const contributorUrl = video.user && video.user_id
      ? `https://pixabay.com/users/${encodeURIComponent(video.user)}-${video.user_id}/`
      : undefined;
    return [{
      provider: "pixabay",
      id: String(video.id),
      query,
      sourceUrl: video.pageURL,
      downloadUrl: file.url,
      contributorName: video.user,
      contributorUrl,
      attributionText: video.user ? `Video by ${video.user} via Pixabay` : "Video from Pixabay",
      licenseName: "Pixabay Content License",
      licenseUrl: PIXABAY_LICENSE_URL,
      providerGuidelinesUrl: PIXABAY_GUIDELINES_URL,
      durationSec: video.duration,
      width: file.width,
      height: file.height,
      sizeBytes: file.size,
      previewImageUrl: file.thumbnail,
      tags: video.tags?.split(",").map((tag) => tag.trim()).filter(Boolean)
    } satisfies StockVideoCandidate];
  });
}

async function fetchJsonWithCache<T>(cachePath: string, ttlMs: number, fetcher: () => Promise<T>): Promise<T> {
  if (existsSync(cachePath)) {
    const info = await stat(cachePath);
    if (Date.now() - info.mtimeMs < ttlMs) {
      return JSON.parse(await readFile(cachePath, "utf8")) as T;
    }
  }
  const payload = await fetcher();
  await mkdir(path.dirname(cachePath), { recursive: true });
  await writeFile(cachePath, `${JSON.stringify(payload, null, 2)}\n`);
  return payload;
}

async function downloadVideo(url: string, outputPath: string): Promise<void> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Video download failed: ${response.status} ${response.statusText}`);
  }
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, Buffer.from(await response.arrayBuffer()));
}

function runPipeline(inputPath: string, runName: string, maxFrames?: string): void {
  const argv = ["tsx", "scripts/runPipeline.ts", "--input", inputPath, "--name", runName];
  if (maxFrames) {
    argv.push("--max-frames", maxFrames);
  }
  const result = spawnSync("npx", argv, { stdio: "inherit", shell: process.platform === "win32" });
  if (result.status !== 0) {
    throw new Error(`npx ${argv.join(" ")} exited with ${result.status ?? "no status"}`);
  }
}

function createSourceMetadata(runName: string, localVideoPath: string, candidate: StockVideoCandidate): MotionSourceMetadata {
  return {
    schemaVersion: "kinerig.motion-source.v1",
    generatedAt: new Date().toISOString(),
    runName,
    provider: candidate.provider,
    providerId: candidate.id,
    query: candidate.query,
    sourceUrl: candidate.sourceUrl,
    downloadedFrom: candidate.downloadUrl,
    localVideoPath,
    contributorName: candidate.contributorName,
    contributorUrl: candidate.contributorUrl,
    attributionText: candidate.attributionText,
    licenseName: candidate.licenseName,
    licenseUrl: candidate.licenseUrl,
    providerGuidelinesUrl: candidate.providerGuidelinesUrl,
    durationSec: candidate.durationSec,
    width: candidate.width,
    height: candidate.height,
    selectedFile: {
      url: candidate.downloadUrl,
      width: candidate.width,
      height: candidate.height,
      sizeBytes: candidate.sizeBytes,
      fps: candidate.fps,
      fileType: candidate.fileType
    },
    notes: [
      "Review the source page and license before publishing commercial work.",
      "KineRig Studio uses this clip only to extract body motion landmarks."
    ]
  };
}

function parseArgs(argv: string[]): AcquireArgs {
  const args = new Map<string, string | boolean>();
  const positionals: string[] = [];
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    if (!key.startsWith("--")) {
      positionals.push(key);
      continue;
    }
    if (["--download", "--process"].includes(key)) {
      args.set(key.slice(2), true);
      continue;
    }
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`Missing value for ${key}`);
    }
    args.set(key.slice(2), value);
    index += 1;
  }

  return {
    query: stringArg(args, "query") ?? envArg("query") ?? positionals[0],
    motion: stringArg(args, "motion") ?? envArg("motion"),
    provider: (stringArg(args, "provider") ?? envArg("provider") ?? positionals[1] ?? "all") as AcquireArgs["provider"],
    limit: Number(stringArg(args, "limit") ?? envArg("limit") ?? positionals[2] ?? "8"),
    page: Math.max(1, Number(stringArg(args, "page") ?? envArg("page") ?? "1")),
    candidateIndex: Number(stringArg(args, "candidate-index") ?? envArg("candidate_index") ?? "0"),
    runName: stringArg(args, "run-name") ?? envArg("run_name"),
    download: args.get("download") === true || envBool("download"),
    process: args.get("process") === true || envBool("process"),
    maxFrames: stringArg(args, "max-frames") ?? envArg("max_frames")
  };
}

function stringArg(args: Map<string, string | boolean>, name: string): string | undefined {
  const value = args.get(name);
  return typeof value === "string" ? value : undefined;
}

function envArg(name: string): string | undefined {
  const value = process.env[`npm_config_${name}`];
  return value && value !== "true" && value !== "false" ? value : undefined;
}

function envBool(name: string): boolean {
  return process.env[`npm_config_${name}`] === "true";
}

function resolveProviders(provider: AcquireArgs["provider"]): StockVideoProvider[] {
  if (provider === "all") {
    return ["pexels", "pixabay"];
  }
  if (provider !== "pexels" && provider !== "pixabay") {
    throw new Error("--provider must be all, pexels, or pixabay");
  }
  return [provider];
}

function dedupeCandidates(candidates: StockVideoCandidate[]): StockVideoCandidate[] {
  const seen = new Set<string>();
  return candidates.filter((candidate) => {
    const key = `${candidate.provider}:${candidate.id}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function printCandidates(manifest: SearchManifest, manifestPath: string): void {
  console.log(`Wrote ${manifestPath}`);
  if (manifest.warnings.length > 0) {
    for (const warning of manifest.warnings) {
      console.warn(warning);
    }
  }
  manifest.candidates.forEach((candidate, index) => {
    const size = candidate.width && candidate.height ? `${candidate.width}x${candidate.height}` : "unknown size";
    const duration = candidate.durationSec ? `${candidate.durationSec}s` : "unknown duration";
    console.log(`[${index}] ${candidate.provider} ${candidate.id} ${size} ${duration} ${candidate.sourceUrl}`);
  });
}

function loadLocalEnv(): void {
  const envFiles = [
    path.resolve("..", ".env"),
    path.resolve("..", "kinerig.env"),
    path.resolve(".env"),
    path.resolve(".env.local")
  ];
  for (const filePath of envFiles) {
    if (!existsSync(filePath)) {
      continue;
    }
    const content = readFileSync(filePath, "utf8");
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) {
        continue;
      }
      const separator = trimmed.indexOf("=");
      if (separator === -1) {
        continue;
      }
      const key = trimmed.slice(0, separator).trim();
      const value = trimmed.slice(separator + 1).trim().replace(/^["']|["']$/g, "");
      if (key && !process.env[key]) {
        process.env[key] = value;
      }
    }
  }
  loadTextCredential("PEXELS_API_KEY", ["pexel_key.txt", "pexels_key.txt"]);
  loadTextCredential("PIXABAY_API_KEY", ["pixabay_key.txt"]);
}

function loadTextCredential(envName: string, fileNames: string[]): void {
  if (process.env[envName]) {
    return;
  }
  const roots = [path.resolve(".."), path.resolve(".")];
  for (const root of roots) {
    for (const fileName of fileNames) {
      const filePath = path.join(root, fileName);
      if (!existsSync(filePath)) {
        continue;
      }
      const value = parseCredentialText(readFileSync(filePath, "utf8"), envName);
      if (value) {
        process.env[envName] = value;
        return;
      }
    }
  }
}

function parseCredentialText(content: string, envName: string): string | undefined {
  const acceptedKeys = getCredentialKeyAliases(envName);
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const separator = trimmed.indexOf("=");
    if (separator !== -1) {
      const key = trimmed.slice(0, separator).trim();
      const value = trimmed.slice(separator + 1).trim().replace(/^["']|["']$/g, "");
      if (acceptedKeys.has(key) && value) {
        return value;
      }
      continue;
    }
    return trimmed.replace(/^["']|["']$/g, "");
  }
  return undefined;
}

function getCredentialKeyAliases(envName: string): Set<string> {
  const aliases = new Set([envName, "API_KEY"]);
  if (envName === "PEXELS_API_KEY") {
    aliases.add("PEXEL_API_KEY");
    aliases.add("PEXELS_KEY");
    aliases.add("PEXEL_KEY");
  }
  if (envName === "PIXABAY_API_KEY") {
    aliases.add("PIXABAY_KEY");
  }
  return aliases;
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
