import { describe, expect, it } from "vitest";
import {
  choosePexelsVideoFile,
  choosePixabayVideoFile,
  createMotionSearchPlan,
  normalizeRunName,
  scoreStockCandidate
} from "../../src/lib/motionAcquisition";

describe("motion acquisition", () => {
  it("creates preset search plans for known motions", () => {
    const plan = createMotionSearchPlan({ motion: "defensive slide" });

    expect(plan.queries[0]).toContain("basketball defensive slide");
    expect(plan.providerHints).toContain("Prefer one full-body person with visible feet and limited camera movement.");
  });

  it("normalizes run names for downloaded clips", () => {
    expect(normalizeRunName("Pexels: Full Body Walk / 123")).toBe("pexels-full-body-walk-123");
  });

  it("chooses practical mp4 files from provider responses", () => {
    const pexels = choosePexelsVideoFile([
      { file_type: "video/mp4", width: 3840, height: 2160, link: "too-large.mp4" },
      { file_type: "video/mp4", width: 1280, height: 720, link: "hd.mp4" },
      { file_type: "application/x-mpegURL", width: 1280, height: 720, link: "stream.m3u8" }
    ]);
    const pixabay = choosePixabayVideoFile({
      tiny: { url: "tiny.mp4", width: 320, height: 180, size: 100 },
      medium: { url: "medium.mp4", width: 1280, height: 720, size: 4_000_000 },
      large: { url: "large.mp4", width: 1920, height: 1080, size: 40_000_000 }
    });

    expect(pexels?.link).toBe("hd.mp4");
    expect(pixabay?.url).toBe("medium.mp4");
  });

  it("scores short full-body-sized clips above awkward candidates", () => {
    const good = scoreStockCandidate({
      provider: "pexels",
      id: "1",
      query: "walk",
      sourceUrl: "https://example.com/1",
      downloadUrl: "https://example.com/1.mp4",
      licenseName: "Pexels License",
      licenseUrl: "https://www.pexels.com/license/",
      providerGuidelinesUrl: "https://www.pexels.com/api/documentation/",
      durationSec: 8,
      width: 1280,
      height: 720
    });
    const awkward = scoreStockCandidate({
      provider: "pexels",
      id: "2",
      query: "walk",
      sourceUrl: "https://example.com/2",
      downloadUrl: "https://example.com/2.mp4",
      licenseName: "Pexels License",
      licenseUrl: "https://www.pexels.com/license/",
      providerGuidelinesUrl: "https://www.pexels.com/api/documentation/",
      durationSec: 40,
      width: 200,
      height: 120
    });

    expect(good).toBeGreaterThan(awkward);
  });
});
