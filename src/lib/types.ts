export type Vec3 = [number, number, number];

export type JointName =
  | "Hips"
  | "Chest"
  | "Neck"
  | "Head"
  | "LeftShoulder"
  | "RightShoulder"
  | "LeftElbow"
  | "RightElbow"
  | "LeftWrist"
  | "RightWrist"
  | "LeftHip"
  | "RightHip"
  | "LeftKnee"
  | "RightKnee"
  | "LeftAnkle"
  | "RightAnkle"
  | "LeftFoot"
  | "RightFoot";

export interface RawLandmark {
  x: number;
  y: number;
  z: number;
  visibility?: number;
  presence?: number;
}

export interface RawPoseFrame {
  index: number;
  timeMs: number;
  detected: boolean;
  confidence: number;
  landmarks: Array<RawLandmark | null>;
  worldLandmarks?: Array<RawLandmark | null>;
}

export interface LandmarkFile {
  schemaVersion: "hoopmotion.landmarks.v1";
  sourceVideo: string;
  generatedAt: string;
  synthetic?: boolean;
  fps: number;
  width: number;
  height: number;
  totalFrames: number;
  processedFrames: number;
  frames: RawPoseFrame[];
}

export interface JointSample {
  position: Vec3;
  confidence: number;
  interpolated?: boolean;
}

export interface AnimationFrame {
  index: number;
  timeMs: number;
  detected: boolean;
  confidence: number;
  missingJointCount: number;
  joints: Record<JointName, JointSample>;
}

export interface BoneDefinition {
  name: string;
  from: JointName;
  to: JointName;
  segmentName: string;
  thickness: number;
}

export interface ValidationReport {
  schemaVersion: "hoopmotion.report.v1";
  sourceVideo: string;
  generatedAt: string;
  synthetic: boolean;
  fps: number;
  framesProcessed: number;
  detectedFrames: number;
  detectionSuccessRate: number;
  averageConfidence: number;
  missingJointCount: number;
  interpolatedJointCount: number;
}

export interface AnimationFile {
  schemaVersion: "hoopmotion.animation.v1";
  sourceVideo: string;
  generatedAt: string;
  synthetic: boolean;
  fps: number;
  durationMs: number;
  joints: JointName[];
  bones: BoneDefinition[];
  modelUrl: string;
  report: ValidationReport;
  frames: AnimationFrame[];
}

export interface RigJointMarker {
  joint: JointName;
  position: Vec3;
  source: "auto" | "click" | "import";
}

export interface RigFile {
  schemaVersion: "hoopmotion.rig.v1";
  name: string;
  generatedAt: string;
  modelUrl?: string;
  modelName?: string;
  authoringPose: "a-pose" | "t-pose" | "custom";
  joints: Partial<Record<JointName, RigJointMarker>>;
  bones: BoneDefinition[];
}

export interface RetargetPackageFile {
  schemaVersion: "hoopmotion.retarget-package.v1";
  generatedAt: string;
  rig: RigFile;
  animation?: AnimationFile;
}
