import { createWriteStream, existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { pipeline } from "node:stream/promises";

const samples = [
  {
    id: "5586522",
    pageUrl: "https://www.pexels.com/video/man-playing-basketball-5586522/",
    downloadUrl: "https://www.pexels.com/download/video/5586522/",
    output: "data/input/pexels_basketball_5586522.mp4"
  },
  {
    id: "5192069",
    pageUrl: "https://www.pexels.com/video/man-playing-basketball-5192069/",
    downloadUrl: "https://www.pexels.com/download/video/5192069/",
    output: "data/input/pexels_basketball_5192069.mp4"
  }
];

await mkdir("data/input", { recursive: true });

for (const sample of samples) {
  if (existsSync(sample.output)) {
    console.log(`Sample already exists: ${sample.output}`);
    continue;
  }

  console.log(`Downloading Pexels ${sample.id}: ${sample.pageUrl}`);
  const response = await fetch(sample.downloadUrl, { redirect: "follow" });
  if (!response.ok || !response.body) {
    throw new Error(`Download failed for ${sample.id}: ${response.status} ${response.statusText}`);
  }

  await mkdir(path.dirname(sample.output), { recursive: true });
  await pipeline(response.body, createWriteStream(sample.output));
  console.log(`Wrote ${sample.output}`);
}
