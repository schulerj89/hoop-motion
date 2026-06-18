import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { mkdir, readFile } from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import path from "node:path";
import { normalizeRunName } from "../src/lib/motionAcquisition";
import type { MotionRunIndexFile } from "../src/lib/types";

type Next = () => void;
type Provider = "all" | "pexels" | "pixabay";

interface AcquireSearchRequest {
  query?: string;
  provider?: Provider;
  limit?: number;
}

interface AcquireProcessRequest extends AcquireSearchRequest {
  candidateIndex?: number;
  runName?: string;
  maxFrames?: string;
}

interface ProviderStatus {
  provider: "pexels" | "pixabay";
  configured: boolean;
  source?: string;
}

const PROJECT_ROOT = path.resolve(".");
const PROVIDERS: ProviderStatus["provider"][] = ["pexels", "pixabay"];

export function createMotionAcquireApiMiddleware() {
  return (req: IncomingMessage, res: ServerResponse, next: Next): void => {
    if (!req.url?.startsWith("/api/acquire")) {
      next();
      return;
    }

    handleAcquireRequest(req, res).catch((error: unknown) => {
      sendJson(res, 500, {
        error: error instanceof Error ? error.message : String(error)
      });
    });
  };
}

async function handleAcquireRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = new URL(req.url ?? "/", "http://127.0.0.1");
  if (req.method === "GET" && url.pathname === "/api/acquire/status") {
    sendJson(res, 200, {
      providers: PROVIDERS.map((provider) => getProviderStatus(provider))
    });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/acquire/search") {
    const body = await readJsonBody<AcquireSearchRequest>(req);
    const query = requireQuery(body.query);
    const provider = normalizeProvider(body.provider);
    const limit = normalizeLimit(body.limit);
    await runAcquireCommand(["--query", query, "--provider", provider, "--limit", String(limit)]);
    const manifest = await readSearchManifest(query);
    sendJson(res, 200, manifest);
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/acquire/process") {
    const body = await readJsonBody<AcquireProcessRequest>(req);
    const query = requireQuery(body.query);
    const provider = normalizeProvider(body.provider);
    const limit = normalizeLimit(body.limit);
    const candidateIndex = Number.isFinite(body.candidateIndex) ? String(body.candidateIndex) : "0";
    const runName = normalizeRunName(body.runName || `${provider}-${query}`);
    const argv = [
      "--query",
      query,
      "--provider",
      provider,
      "--limit",
      String(limit),
      "--candidate-index",
      candidateIndex,
      "--run-name",
      runName,
      "--download",
      "--process"
    ];
    if (body.maxFrames) {
      argv.push("--max-frames", body.maxFrames);
    }

    await runAcquireCommand(argv);
    const index = await readRunIndex();
    sendJson(res, 200, {
      runName,
      index
    });
    return;
  }

  sendJson(res, 404, { error: "Unknown acquisition API route" });
}

function getProviderStatus(provider: ProviderStatus["provider"]): ProviderStatus {
  const envName = provider === "pexels" ? "PEXELS_API_KEY" : "PIXABAY_API_KEY";
  if (process.env[envName]) {
    return { provider, configured: true, source: "environment" };
  }

  const names = provider === "pexels" ? ["pexel_key.txt", "pexels_key.txt"] : ["pixabay_key.txt"];
  for (const root of [path.resolve(".."), PROJECT_ROOT]) {
    for (const name of names) {
      const filePath = path.join(root, name);
      if (!existsSync(filePath)) {
        continue;
      }
      const value = parseCredentialText(readFileSync(filePath, "utf8"), envName);
      if (value) {
        return { provider, configured: true, source: name };
      }
    }
  }
  return { provider, configured: false };
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

async function readJsonBody<T>(req: IncomingMessage): Promise<T> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) as T : {} as T;
}

function requireQuery(query: string | undefined): string {
  const normalized = query?.trim();
  if (!normalized) {
    throw new Error("Search query is required");
  }
  return normalized;
}

function normalizeProvider(provider: Provider | undefined): Provider {
  if (provider === "pexels" || provider === "pixabay" || provider === "all") {
    return provider;
  }
  return "pexels";
}

function normalizeLimit(limit: number | undefined): number {
  if (typeof limit !== "number" || !Number.isFinite(limit)) {
    return 6;
  }
  return Math.min(Math.max(Math.round(limit), 1), 12);
}

async function runAcquireCommand(argv: string[]): Promise<void> {
  await mkdir(path.join(PROJECT_ROOT, "data"), { recursive: true });
  const executable = process.platform === "win32" ? "npx.cmd" : "npx";
  await new Promise<void>((resolve, reject) => {
    const child = spawn(executable, ["tsx", "scripts/acquireMotion.ts", ...argv], {
      cwd: PROJECT_ROOT,
      env: process.env,
      shell: false,
      stdio: ["ignore", "pipe", "pipe"]
    });
    let stderr = "";
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(stderr.trim() || `acquireMotion exited with ${code ?? "no status"}`));
    });
  });
}

async function readSearchManifest(query: string): Promise<unknown> {
  const filePath = path.join(PROJECT_ROOT, "data", "search", normalizeRunName(query), "candidates.json");
  return JSON.parse(await readFile(filePath, "utf8")) as unknown;
}

async function readRunIndex(): Promise<MotionRunIndexFile | undefined> {
  const filePath = path.join(PROJECT_ROOT, "public", "runs", "index.json");
  if (!existsSync(filePath)) {
    return undefined;
  }
  return JSON.parse(await readFile(filePath, "utf8")) as MotionRunIndexFile;
}

function sendJson(res: ServerResponse, status: number, payload: unknown): void {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(payload));
}
