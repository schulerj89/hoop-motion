import { BONES, JOINT_NAMES, MEDIAPIPE } from "./skeleton";
import type {
  AnimationFile,
  AnimationFrame,
  JointName,
  JointSample,
  LandmarkFile,
  RawLandmark,
  RawPoseFrame,
  ValidationReport,
  Vec3
} from "./types";

export interface MotionProcessingOptions {
  minJointConfidence?: number;
  smoothingAlpha?: number;
  modelUrl?: string;
}

interface PartialJointFrame {
  index: number;
  timeMs: number;
  detected: boolean;
  confidence: number;
  missingJointCount: number;
  joints: Partial<Record<JointName, JointSample>>;
}

const DEFAULT_MODEL_URL = "/models/hoopbot.glb";

export function processLandmarks(
  landmarks: LandmarkFile,
  options: MotionProcessingOptions = {}
): AnimationFile {
  const minJointConfidence = options.minJointConfidence ?? 0.2;
  const smoothingAlpha = options.smoothingAlpha ?? 0.35;
  const mapped = landmarks.frames.map((frame) => mapFrameToJoints(frame, minJointConfidence));
  const normalized = normalizeMotion(mapped);
  const { frames: interpolated, interpolatedJointCount } = interpolateMissingJoints(normalized);
  const smoothed = smoothFrames(interpolated, smoothingAlpha);
  const report = buildReport(landmarks, smoothed, interpolatedJointCount);
  const lastFrame = smoothed.at(-1);

  return {
    schemaVersion: "hoopmotion.animation.v1",
    sourceVideo: landmarks.sourceVideo,
    generatedAt: new Date().toISOString(),
    synthetic: Boolean(landmarks.synthetic),
    fps: landmarks.fps,
    durationMs: lastFrame ? lastFrame.timeMs : 0,
    joints: JOINT_NAMES,
    bones: BONES,
    modelUrl: options.modelUrl ?? DEFAULT_MODEL_URL,
    report,
    frames: smoothed
  };
}

export function buildReport(
  landmarks: LandmarkFile,
  frames: AnimationFrame[],
  interpolatedJointCount: number
): ValidationReport {
  const framesProcessed = landmarks.processedFrames || landmarks.frames.length;
  const detectedFrames = landmarks.frames.filter((frame) => frame.detected).length;
  const confidenceValues = landmarks.frames
    .filter((frame) => frame.detected)
    .map((frame) => frame.confidence);
  const averageConfidence = confidenceValues.length
    ? average(confidenceValues)
    : 0;
  const missingJointCount = frames.reduce((sum, frame) => sum + frame.missingJointCount, 0);

  return {
    schemaVersion: "hoopmotion.report.v1",
    sourceVideo: landmarks.sourceVideo,
    generatedAt: new Date().toISOString(),
    synthetic: Boolean(landmarks.synthetic),
    fps: landmarks.fps,
    framesProcessed,
    detectedFrames,
    detectionSuccessRate: framesProcessed ? detectedFrames / framesProcessed : 0,
    averageConfidence,
    missingJointCount,
    interpolatedJointCount
  };
}

function mapFrameToJoints(frame: RawPoseFrame, minConfidence: number): PartialJointFrame {
  const get = (index: number): JointSample | undefined => {
    const landmark = frame.landmarks[index];
    if (!landmark) {
      return undefined;
    }
    const confidence = landmarkConfidence(landmark);
    if (confidence < minConfidence) {
      return undefined;
    }
    return {
      position: normalizedToScene(landmark),
      confidence
    };
  };

  const point = {
    nose: get(MEDIAPIPE.nose),
    leftShoulder: get(MEDIAPIPE.leftShoulder),
    rightShoulder: get(MEDIAPIPE.rightShoulder),
    leftElbow: get(MEDIAPIPE.leftElbow),
    rightElbow: get(MEDIAPIPE.rightElbow),
    leftWrist: get(MEDIAPIPE.leftWrist),
    rightWrist: get(MEDIAPIPE.rightWrist),
    leftHip: get(MEDIAPIPE.leftHip),
    rightHip: get(MEDIAPIPE.rightHip),
    leftKnee: get(MEDIAPIPE.leftKnee),
    rightKnee: get(MEDIAPIPE.rightKnee),
    leftAnkle: get(MEDIAPIPE.leftAnkle),
    rightAnkle: get(MEDIAPIPE.rightAnkle),
    leftFoot: get(MEDIAPIPE.leftFoot),
    rightFoot: get(MEDIAPIPE.rightFoot)
  };

  const joints: Partial<Record<JointName, JointSample>> = {
    Hips: midpoint(point.leftHip, point.rightHip),
    Chest: midpoint(point.leftShoulder, point.rightShoulder),
    LeftShoulder: point.leftShoulder,
    RightShoulder: point.rightShoulder,
    LeftElbow: point.leftElbow,
    RightElbow: point.rightElbow,
    LeftWrist: point.leftWrist,
    RightWrist: point.rightWrist,
    LeftHip: point.leftHip,
    RightHip: point.rightHip,
    LeftKnee: point.leftKnee,
    RightKnee: point.rightKnee,
    LeftAnkle: point.leftAnkle,
    RightAnkle: point.rightAnkle,
    LeftFoot: point.leftFoot,
    RightFoot: point.rightFoot
  };

  const chest = joints.Chest;
  const head = point.nose;
  if (chest && head) {
    joints.Neck = lerpSample(chest, head, 0.38);
    joints.Head = head;
  }

  const missingJointCount = JOINT_NAMES.filter((joint) => !joints[joint]).length;

  return {
    index: frame.index,
    timeMs: frame.timeMs,
    detected: frame.detected,
    confidence: frame.confidence,
    missingJointCount,
    joints
  };
}

function normalizeMotion(frames: PartialJointFrame[]): PartialJointFrame[] {
  const hipSamples = frames
    .map((frame) => frame.joints.Hips?.position)
    .filter((position): position is Vec3 => Boolean(position));
  const firstHip = hipSamples[0] ?? [0, 1, 0];
  const footYs = frames
    .flatMap((frame) => [
      frame.joints.LeftAnkle?.position[1],
      frame.joints.RightAnkle?.position[1],
      frame.joints.LeftFoot?.position[1],
      frame.joints.RightFoot?.position[1]
    ])
    .filter((value): value is number => typeof value === "number");
  const groundY = footYs.length ? Math.min(...footYs) : 0;

  return frames.map((frame) => ({
    ...frame,
    joints: mapJointRecord(frame.joints, (sample) => ({
      ...sample,
      position: [
        sample.position[0] - firstHip[0],
        sample.position[1] - groundY + 0.03,
        sample.position[2] - firstHip[2]
      ]
    }))
  }));
}

function interpolateMissingJoints(frames: PartialJointFrame[]): {
  frames: AnimationFrame[];
  interpolatedJointCount: number;
} {
  let interpolatedJointCount = 0;
  const completeFrames = frames.map((frame) => ({
    ...frame,
    joints: { ...frame.joints } as Record<JointName, JointSample>
  }));

  for (const joint of JOINT_NAMES) {
    for (let index = 0; index < completeFrames.length; index += 1) {
      if (completeFrames[index].joints[joint]) {
        continue;
      }

      const previous = findNeighbor(completeFrames, joint, index, -1);
      const next = findNeighbor(completeFrames, joint, index, 1);
      const replacement = interpolateJoint(previous, next, index);
      completeFrames[index].joints[joint] = replacement;
      interpolatedJointCount += 1;
    }
  }

  return {
    frames: completeFrames.map((frame) => ({
      index: frame.index,
      timeMs: frame.timeMs,
      detected: frame.detected,
      confidence: frame.confidence,
      missingJointCount: frame.missingJointCount,
      joints: frame.joints
    })),
    interpolatedJointCount
  };
}

function smoothFrames(frames: AnimationFrame[], alpha: number): AnimationFrame[] {
  const previous = new Map<JointName, JointSample>();

  return frames.map((frame) => {
    const joints = {} as Record<JointName, JointSample>;
    for (const joint of JOINT_NAMES) {
      const current = frame.joints[joint];
      const prior = previous.get(joint);
      const position = prior
        ? lerpVec3(prior.position, current.position, alpha)
        : current.position;
      const sample = {
        ...current,
        position
      };
      joints[joint] = sample;
      previous.set(joint, sample);
    }

    return {
      ...frame,
      joints
    };
  });
}

function findNeighbor(
  frames: Array<{ joints: Record<JointName, JointSample> | Partial<Record<JointName, JointSample>> }>,
  joint: JointName,
  startIndex: number,
  direction: -1 | 1
): { index: number; sample: JointSample } | undefined {
  for (
    let index = startIndex + direction;
    index >= 0 && index < frames.length;
    index += direction
  ) {
    const sample = frames[index].joints[joint];
    if (sample) {
      return { index, sample };
    }
  }
  return undefined;
}

function interpolateJoint(
  previous: { index: number; sample: JointSample } | undefined,
  next: { index: number; sample: JointSample } | undefined,
  targetIndex: number
): JointSample {
  if (previous && next) {
    const span = next.index - previous.index;
    const t = span ? (targetIndex - previous.index) / span : 0;
    return {
      position: lerpVec3(previous.sample.position, next.sample.position, t),
      confidence: Math.min(previous.sample.confidence, next.sample.confidence) * 0.5,
      interpolated: true
    };
  }

  const fallback = previous?.sample ?? next?.sample;
  if (fallback) {
    return {
      position: [...fallback.position],
      confidence: fallback.confidence * 0.4,
      interpolated: true
    };
  }

  return {
    position: [0, 1, 0],
    confidence: 0,
    interpolated: true
  };
}

function normalizedToScene(landmark: RawLandmark): Vec3 {
  return [
    (landmark.x - 0.5) * 4.0,
    (1 - landmark.y) * 3.2,
    -landmark.z * 2.0
  ];
}

function landmarkConfidence(landmark: RawLandmark): number {
  const values = [landmark.visibility, landmark.presence].filter(
    (value): value is number => typeof value === "number"
  );
  if (!values.length) {
    return 1;
  }
  return average(values);
}

function midpoint(a: JointSample | undefined, b: JointSample | undefined): JointSample | undefined {
  if (!a && !b) {
    return undefined;
  }
  if (!a || !b) {
    const sample = a ?? b;
    return sample
      ? {
          position: [...sample.position],
          confidence: sample.confidence * 0.7,
          interpolated: true
        }
      : undefined;
  }

  return {
    position: lerpVec3(a.position, b.position, 0.5),
    confidence: Math.min(a.confidence, b.confidence)
  };
}

function lerpSample(a: JointSample, b: JointSample, t: number): JointSample {
  return {
    position: lerpVec3(a.position, b.position, t),
    confidence: Math.min(a.confidence, b.confidence)
  };
}

function mapJointRecord(
  joints: Partial<Record<JointName, JointSample>>,
  transform: (sample: JointSample) => JointSample
): Partial<Record<JointName, JointSample>> {
  const next: Partial<Record<JointName, JointSample>> = {};
  for (const joint of JOINT_NAMES) {
    const sample = joints[joint];
    if (sample) {
      next[joint] = transform(sample);
    }
  }
  return next;
}

function lerpVec3(a: Vec3, b: Vec3, t: number): Vec3 {
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t
  ];
}

function average(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}
