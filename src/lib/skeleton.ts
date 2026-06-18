import type { BoneDefinition, JointName } from "./types";

export const JOINT_NAMES: JointName[] = [
  "Hips",
  "Chest",
  "Neck",
  "Head",
  "LeftShoulder",
  "RightShoulder",
  "LeftElbow",
  "RightElbow",
  "LeftWrist",
  "RightWrist",
  "LeftHip",
  "RightHip",
  "LeftKnee",
  "RightKnee",
  "LeftAnkle",
  "RightAnkle",
  "LeftFoot",
  "RightFoot"
];

export const MEDIAPIPE = {
  nose: 0,
  leftShoulder: 11,
  rightShoulder: 12,
  leftElbow: 13,
  rightElbow: 14,
  leftWrist: 15,
  rightWrist: 16,
  leftHip: 23,
  rightHip: 24,
  leftKnee: 25,
  rightKnee: 26,
  leftAnkle: 27,
  rightAnkle: 28,
  leftFoot: 31,
  rightFoot: 32
} as const;

export const BONES: BoneDefinition[] = [
  { name: "spine", from: "Hips", to: "Chest", segmentName: "Segment_Spine", thickness: 0.26 },
  { name: "neck", from: "Chest", to: "Neck", segmentName: "Segment_Neck", thickness: 0.16 },
  { name: "head", from: "Neck", to: "Head", segmentName: "Segment_Head", thickness: 0.22 },
  { name: "left-clavicle", from: "Chest", to: "LeftShoulder", segmentName: "Segment_LeftClavicle", thickness: 0.11 },
  { name: "right-clavicle", from: "Chest", to: "RightShoulder", segmentName: "Segment_RightClavicle", thickness: 0.11 },
  { name: "left-upper-arm", from: "LeftShoulder", to: "LeftElbow", segmentName: "Segment_LeftUpperArm", thickness: 0.11 },
  { name: "left-forearm", from: "LeftElbow", to: "LeftWrist", segmentName: "Segment_LeftForeArm", thickness: 0.095 },
  { name: "right-upper-arm", from: "RightShoulder", to: "RightElbow", segmentName: "Segment_RightUpperArm", thickness: 0.11 },
  { name: "right-forearm", from: "RightElbow", to: "RightWrist", segmentName: "Segment_RightForeArm", thickness: 0.095 },
  { name: "left-hip", from: "Hips", to: "LeftHip", segmentName: "Segment_LeftHip", thickness: 0.16 },
  { name: "right-hip", from: "Hips", to: "RightHip", segmentName: "Segment_RightHip", thickness: 0.16 },
  { name: "left-thigh", from: "LeftHip", to: "LeftKnee", segmentName: "Segment_LeftThigh", thickness: 0.14 },
  { name: "left-shin", from: "LeftKnee", to: "LeftAnkle", segmentName: "Segment_LeftShin", thickness: 0.12 },
  { name: "left-foot", from: "LeftAnkle", to: "LeftFoot", segmentName: "Segment_LeftFoot", thickness: 0.095 },
  { name: "right-thigh", from: "RightHip", to: "RightKnee", segmentName: "Segment_RightThigh", thickness: 0.14 },
  { name: "right-shin", from: "RightKnee", to: "RightAnkle", segmentName: "Segment_RightShin", thickness: 0.12 },
  { name: "right-foot", from: "RightAnkle", to: "RightFoot", segmentName: "Segment_RightFoot", thickness: 0.095 }
];

export const MODEL_JOINT_PREFIX = "Joint_";
