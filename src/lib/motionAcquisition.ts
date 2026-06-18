export type StockVideoProvider = "pexels" | "pixabay";

export interface MotionSearchPlan {
  prompt: string;
  queries: string[];
  providerHints: string[];
}

export interface StockVideoCandidate {
  provider: StockVideoProvider;
  id: string;
  query: string;
  sourceUrl: string;
  downloadUrl: string;
  contributorName?: string;
  contributorUrl?: string;
  attributionText?: string;
  licenseName: string;
  licenseUrl: string;
  providerGuidelinesUrl: string;
  durationSec?: number;
  width?: number;
  height?: number;
  fileType?: string;
  sizeBytes?: number;
  fps?: number;
  previewImageUrl?: string;
  tags?: string[];
}

export interface SearchMotionInput {
  motion?: string;
  query?: string;
}

export interface PexelsVideoFile {
  id?: number;
  quality?: string;
  file_type?: string;
  width?: number;
  height?: number;
  fps?: number;
  link?: string;
}

export interface PixabayVideoVariant {
  url?: string;
  width?: number;
  height?: number;
  size?: number;
  thumbnail?: string;
}

const MOTION_QUERY_PRESETS: Record<string, string[]> = {
  "jump-shot": [
    "full body basketball jump shot",
    "person shooting basketball full body",
    "athlete jump shot side view"
  ],
  dribble: [
    "full body basketball dribble",
    "person dribbling basketball side view",
    "athlete dribbling full body"
  ],
  "defensive-slide": [
    "basketball defensive slide full body",
    "athlete lateral shuffle full body",
    "person side shuffle sports"
  ],
  walk: [
    "full body person walking side view",
    "person walk cycle full body"
  ],
  dance: [
    "full body person dancing",
    "dancer full body studio"
  ],
  reach: [
    "full body person reaching arms",
    "person arm reach full body"
  ],
  "side-step": [
    "full body person side step",
    "person lateral step full body"
  ]
};

export function createMotionSearchPlan(input: SearchMotionInput): MotionSearchPlan {
  const prompt = (input.query || input.motion || "").trim();
  if (!prompt) {
    throw new Error("Provide --query or --motion for stock video search");
  }

  const key = normalizeMotionKey(prompt);
  const preset = MOTION_QUERY_PRESETS[key];
  const queries = preset ?? [
    prompt,
    `full body ${prompt}`,
    `${prompt} side view`
  ];

  return {
    prompt,
    queries: unique(queries.map((query) => query.trim()).filter(Boolean)).slice(0, 4),
    providerHints: [
      "Prefer one full-body person with visible feet and limited camera movement.",
      "Prefer short clips under 20 seconds for fast pose extraction.",
      "Avoid close-ups, heavy cuts, crowds, and occluded limbs."
    ]
  };
}

export function normalizeRunName(value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return slug || "motion-run";
}

export function choosePexelsVideoFile(files: PexelsVideoFile[], maxHeight = 720): PexelsVideoFile | undefined {
  return files
    .filter((file) => file.file_type === "video/mp4" && file.link && file.width && file.height)
    .sort((left, right) => scoreVideoFile(right, maxHeight) - scoreVideoFile(left, maxHeight))[0];
}

export function choosePixabayVideoFile(
  videos: Record<string, PixabayVideoVariant | undefined>,
  maxHeight = 720
): PixabayVideoVariant | undefined {
  return Object.values(videos)
    .filter((file): file is PixabayVideoVariant => Boolean(file?.url && file.width && file.height))
    .sort((left, right) => scoreVideoFile(right, maxHeight) - scoreVideoFile(left, maxHeight))[0];
}

export function scoreStockCandidate(candidate: StockVideoCandidate): number {
  const duration = candidate.durationSec ?? 30;
  const height = candidate.height ?? 0;
  const width = candidate.width ?? 0;
  const aspect = width && height ? width / height : 1;
  const durationScore = duration <= 20 ? 20 - Math.abs(duration - 8) : Math.max(0, 20 - duration);
  const resolutionScore = height >= 480 ? Math.min(height, 720) / 40 : height / 80;
  const orientationScore = aspect > 0.7 && aspect < 2.2 ? 10 : 0;
  return durationScore + resolutionScore + orientationScore;
}

function normalizeMotionKey(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function scoreVideoFile(file: { width?: number; height?: number; size?: number; sizeBytes?: number }, maxHeight: number): number {
  const height = file.height ?? 0;
  const width = file.width ?? 0;
  const size = file.size ?? file.sizeBytes ?? 0;
  const heightPenalty = height > maxHeight ? (height - maxHeight) / 5 : 0;
  const tooSmallPenalty = height < 360 ? 20 : 0;
  const sizePenalty = size > 30_000_000 ? 8 : 0;
  return width / 100 + height / 20 - heightPenalty - tooSmallPenalty - sizePenalty;
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}
