import { describe, expect, it } from "vitest";
import { processLandmarks } from "../../src/lib/motionProcessing";
import type { LandmarkFile, RawLandmark } from "../../src/lib/types";

describe("processLandmarks", () => {
  it("interpolates missing joints and reports detection metrics", () => {
    const landmarks = buildRawLandmarks();
    landmarks.frames[1].landmarks[15] = null;
    const animation = processLandmarks(landmarks);

    expect(animation.frames).toHaveLength(3);
    expect(animation.report.framesProcessed).toBe(3);
    expect(animation.report.detectionSuccessRate).toBe(1);
    expect(animation.report.missingJointCount).toBeGreaterThan(0);
    expect(animation.report.interpolatedJointCount).toBeGreaterThan(0);
    expect(animation.frames[1].joints.LeftWrist.interpolated).toBe(true);
  });
});

function buildRawLandmarks(): LandmarkFile {
  return {
    schemaVersion: "hoopmotion.landmarks.v1",
    sourceVideo: "fixture.mp4",
    generatedAt: new Date(0).toISOString(),
    synthetic: true,
    fps: 30,
    width: 640,
    height: 360,
    totalFrames: 3,
    processedFrames: 3,
    frames: [0, 1, 2].map((index) => ({
      index,
      timeMs: index * 33,
      detected: true,
      confidence: 0.9,
      landmarks: makeFrame(index)
    }))
  };
}

function makeFrame(offset: number): Array<RawLandmark | null> {
  const landmarks: Array<RawLandmark | null> = Array.from({ length: 33 }, () => null);
  const set = (index: number, x: number, y: number) => {
    landmarks[index] = {
      x: x + offset * 0.005,
      y,
      z: 0,
      visibility: 0.9,
      presence: 0.9
    };
  };
  set(0, 0.5, 0.25);
  set(11, 0.42, 0.38);
  set(12, 0.58, 0.38);
  set(13, 0.35, 0.48);
  set(14, 0.65, 0.48);
  set(15, 0.32, 0.6);
  set(16, 0.68, 0.6);
  set(23, 0.45, 0.62);
  set(24, 0.55, 0.62);
  set(25, 0.43, 0.76);
  set(26, 0.57, 0.76);
  set(27, 0.42, 0.9);
  set(28, 0.58, 0.9);
  set(31, 0.39, 0.93);
  set(32, 0.61, 0.93);
  return landmarks;
}
