import { Bone, Box3, Object3D, Vector3 } from "three";
import { BONES, JOINT_NAMES } from "./skeleton";
import type {
  AnimationFile,
  JointName,
  RetargetPackageFile,
  RigFile,
  RigJointMarker,
  Vec3
} from "./types";

export interface DetectedRigResult {
  rig: RigFile;
  detected: JointName[];
  missing: JointName[];
  boneCount: number;
}

export function createEmptyRig(name = "untitled-rig", modelUrl?: string, modelName?: string): RigFile {
  return {
    schemaVersion: "kinerig.rig.v1",
    name,
    generatedAt: new Date().toISOString(),
    modelUrl,
    modelName,
    authoringPose: "custom",
    joints: {},
    bones: BONES
  };
}

export function createRigFromDetectedBones(
  model: Object3D,
  name = "detected-rig",
  modelUrl?: string,
  modelName?: string,
  existingRig?: RigFile
): DetectedRigResult {
  const bones = collectBones(model);
  const joints: Partial<Record<JointName, RigJointMarker>> = {};
  const detected: JointName[] = [];
  const missing: JointName[] = [];

  for (const joint of JOINT_NAMES) {
    const existing = existingRig?.joints[joint];
    if (existing && existing.source !== "auto") {
      joints[joint] = marker(joint, existing.position, existing.source);
      detected.push(joint);
      continue;
    }

    const bone = findBoneForJoint(bones, joint);
    if (!bone) {
      if (existing) {
        joints[joint] = marker(joint, existing.position, existing.source);
      } else {
        missing.push(joint);
      }
      continue;
    }

    const position = bone.getWorldPosition(new Vector3());
    joints[joint] = marker(joint, [position.x, position.y, position.z], "detect");
    detected.push(joint);
  }

  return {
    rig: {
      schemaVersion: "kinerig.rig.v1",
      name,
      generatedAt: new Date().toISOString(),
      modelUrl,
      modelName,
      authoringPose: "detected",
      joints,
      bones: BONES
    },
    detected,
    missing,
    boneCount: bones.length
  };
}

export function createAutoRigFromModel(
  model: Object3D,
  name = "auto-rig",
  modelUrl?: string,
  modelName?: string,
  existingRig?: RigFile
): RigFile {
  const bounds = new Box3().setFromObject(model);
  const size = bounds.getSize(new Vector3());
  const center = bounds.getCenter(new Vector3());
  const height = Math.max(size.y, 1);
  const minY = bounds.min.y;
  const z = center.z;
  const shoulder = Math.max(size.x * 0.28, height * 0.16);
  const hip = Math.max(size.x * 0.16, height * 0.08);
  const arm = height * 0.18;
  const forearm = height * 0.17;

  const at = (x: number, y: number, nextZ = z): Vec3 => [x, y, nextZ];
  const y = (ratio: number) => minY + height * ratio;
  const x = center.x;

  const positions: Record<JointName, Vec3> = {
    Hips: at(x, y(0.48)),
    Chest: at(x, y(0.72)),
    Neck: at(x, y(0.82)),
    Head: at(x, y(0.92)),
    LeftShoulder: at(x - shoulder, y(0.75)),
    RightShoulder: at(x + shoulder, y(0.75)),
    LeftElbow: at(x - shoulder - arm, y(0.62)),
    RightElbow: at(x + shoulder + arm, y(0.62)),
    LeftWrist: at(x - shoulder - arm - forearm, y(0.51)),
    RightWrist: at(x + shoulder + arm + forearm, y(0.51)),
    LeftHip: at(x - hip, y(0.47)),
    RightHip: at(x + hip, y(0.47)),
    LeftKnee: at(x - hip * 1.15, y(0.25)),
    RightKnee: at(x + hip * 1.15, y(0.25)),
    LeftAnkle: at(x - hip * 1.15, y(0.05)),
    RightAnkle: at(x + hip * 1.15, y(0.05)),
    LeftFoot: at(x - hip * 1.45, y(0.02), z + height * 0.06),
    RightFoot: at(x + hip * 1.45, y(0.02), z + height * 0.06)
  };

  const hasPreservedMarkers = JOINT_NAMES.some((joint) => {
    const existing = existingRig?.joints[joint];
    return Boolean(existing && existing.source !== "auto");
  });
  const joints = Object.fromEntries(
    JOINT_NAMES.map((joint) => {
      const existing = existingRig?.joints[joint];
      return [
        joint,
        existing && existing.source !== "auto"
          ? marker(joint, existing.position, existing.source)
          : marker(joint, positions[joint], "auto")
      ];
    })
  ) as Record<JointName, RigJointMarker>;

  return {
    schemaVersion: "kinerig.rig.v1",
    name,
    generatedAt: new Date().toISOString(),
    modelUrl,
    modelName,
    authoringPose: hasPreservedMarkers ? existingRig?.authoringPose ?? "custom" : "t-pose",
    joints,
    bones: BONES
  };
}

export function withJointMarker(
  rig: RigFile,
  joint: JointName,
  position: Vec3,
  source: RigJointMarker["source"]
): RigFile {
  return {
    ...rig,
    generatedAt: new Date().toISOString(),
    authoringPose: source === "auto" ? rig.authoringPose : "custom",
    joints: {
      ...rig.joints,
      [joint]: marker(joint, position, source)
    }
  };
}

export function countPlacedJoints(rig: RigFile): number {
  return JOINT_NAMES.filter((joint) => Boolean(rig.joints[joint])).length;
}

export function createRetargetPackage(rig: RigFile, animation?: AnimationFile): RetargetPackageFile {
  return {
    schemaVersion: "kinerig.retarget-package.v1",
    generatedAt: new Date().toISOString(),
    rig,
    animation
  };
}

export function sanitizeRigFile(input: RigFile): RigFile {
  if (input.schemaVersion !== "kinerig.rig.v1" && input.schemaVersion !== "hoopmotion.rig.v1") {
    throw new Error("Unsupported rig schema");
  }

  const rig = createEmptyRig(input.name || "imported-rig", input.modelUrl, input.modelName);
  rig.authoringPose = input.authoringPose ?? "custom";
  for (const joint of JOINT_NAMES) {
    const item = input.joints?.[joint];
    if (!item) {
      continue;
    }
    rig.joints[joint] = marker(joint, item.position, "import");
  }
  return rig;
}

function marker(joint: JointName, position: Vec3, source: RigJointMarker["source"]): RigJointMarker {
  return {
    joint,
    position: [position[0], position[1], position[2]],
    source
  };
}

function collectBones(model: Object3D): Array<{ bone: Bone; key: string }> {
  const bones: Array<{ bone: Bone; key: string }> = [];
  model.updateMatrixWorld(true);
  model.traverse((object) => {
    if (object instanceof Bone) {
      bones.push({
        bone: object,
        key: normalizeBoneName(object.name)
      });
    }
  });
  return bones;
}

function findBoneForJoint(bones: Array<{ bone: Bone; key: string }>, joint: JointName): Bone | undefined {
  const aliases = BONE_ALIASES[joint];
  for (const alias of aliases) {
    const match = bones.find((entry) => entry.key === alias || entry.key.endsWith(alias));
    if (match) {
      return match.bone;
    }
  }
  return undefined;
}

function normalizeBoneName(name: string): string {
  return name
    .toLowerCase()
    .replace(/^mixamorig/i, "")
    .replace(/^armature/i, "")
    .replace(/[^a-z0-9]/g, "");
}

const BONE_ALIASES: Record<JointName, string[]> = {
  Hips: ["hips", "pelvis", "root"],
  Chest: ["spine2", "spine1", "chest", "upperchest", "spine"],
  Neck: ["neck"],
  Head: ["head"],
  LeftShoulder: ["leftshoulder", "leftclavicle", "lshoulder", "lclavicle"],
  RightShoulder: ["rightshoulder", "rightclavicle", "rshoulder", "rclavicle"],
  LeftElbow: ["leftforearm", "leftlowerarm", "leftelbow", "lforearm", "llowerarm"],
  RightElbow: ["rightforearm", "rightlowerarm", "rightelbow", "rforearm", "rlowerarm"],
  LeftWrist: ["lefthand", "leftwrist", "lhand", "lwrist"],
  RightWrist: ["righthand", "rightwrist", "rhand", "rwrist"],
  LeftHip: ["leftupleg", "leftthigh", "lefthip", "lupleg", "lthigh"],
  RightHip: ["rightupleg", "rightthigh", "righthip", "rupleg", "rthigh"],
  LeftKnee: ["leftleg", "leftshin", "leftcalf", "leftknee", "lleg", "lshin"],
  RightKnee: ["rightleg", "rightshin", "rightcalf", "rightknee", "rleg", "rshin"],
  LeftAnkle: ["leftfoot", "leftankle", "lfoot", "lankle"],
  RightAnkle: ["rightfoot", "rightankle", "rfoot", "rankle"],
  LeftFoot: ["lefttoebase", "lefttoe", "leftfoot", "ltoebase", "ltoe", "lfoot"],
  RightFoot: ["righttoebase", "righttoe", "rightfoot", "rtoebase", "rtoe", "rfoot"]
};
