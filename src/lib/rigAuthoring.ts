import { Box3, Object3D, Vector3 } from "three";
import { BONES, JOINT_NAMES } from "./skeleton";
import type {
  AnimationFile,
  JointName,
  RetargetPackageFile,
  RigFile,
  RigJointMarker,
  Vec3
} from "./types";

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

export function createAutoRigFromModel(
  model: Object3D,
  name = "auto-rig",
  modelUrl?: string,
  modelName?: string
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

  const joints = Object.fromEntries(
    JOINT_NAMES.map((joint) => [joint, marker(joint, positions[joint], "auto")])
  ) as Record<JointName, RigJointMarker>;

  return {
    schemaVersion: "kinerig.rig.v1",
    name,
    generatedAt: new Date().toISOString(),
    modelUrl,
    modelName,
    authoringPose: "t-pose",
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
