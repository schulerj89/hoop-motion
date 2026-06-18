import { Bone, BoxGeometry, Group, Mesh, MeshBasicMaterial } from "three";
import { describe, expect, it } from "vitest";
import {
  createAutoRigFromModel,
  createEmptyRig,
  createRigFromDetectedBones,
  createRetargetPackage,
  sanitizeRigFile,
  withJointMarker
} from "../../src/lib/rigAuthoring";
import { JOINT_NAMES } from "../../src/lib/skeleton";

describe("rig authoring", () => {
  it("creates a complete auto rig from model bounds", () => {
    const model = new Mesh(new BoxGeometry(1, 2, 0.5), new MeshBasicMaterial());
    const rig = createAutoRigFromModel(model, "box-rig", "/models/box.glb", "box.glb");

    expect(rig.schemaVersion).toBe("kinerig.rig.v1");
    expect(Object.keys(rig.joints)).toHaveLength(JOINT_NAMES.length);
    expect(rig.joints.Hips?.position[1]).toBeLessThan(rig.joints.Head!.position[1]);
    expect(rig.joints.LeftWrist!.position[0]).toBeLessThan(rig.joints.RightWrist!.position[0]);
  });

  it("sanitizes imported rig data and creates retarget packages", () => {
    const model = new Mesh(new BoxGeometry(1, 2, 0.5), new MeshBasicMaterial());
    const rig = createAutoRigFromModel(model, "box-rig");
    const sanitized = sanitizeRigFile(rig);
    const pkg = createRetargetPackage(sanitized);

    expect(sanitized.joints.Head?.source).toBe("import");
    expect(pkg.schemaVersion).toBe("kinerig.retarget-package.v1");
    expect(pkg.rig.joints.Hips).toBeDefined();
  });

  it("preserves clicked markers when auto-filling missing joints", () => {
    const model = new Mesh(new BoxGeometry(1, 2, 0.5), new MeshBasicMaterial());
    const clickedPosition: [number, number, number] = [0.42, 1.23, -0.2];
    const existing = withJointMarker(createEmptyRig("partial-rig"), "Head", clickedPosition, "click");
    const filled = createAutoRigFromModel(model, "box-rig", "/models/box.glb", "box.glb", existing);

    expect(filled.joints.Head?.source).toBe("click");
    expect(filled.joints.Head?.position).toEqual(clickedPosition);
    expect(filled.joints.Hips?.source).toBe("auto");
    expect(filled.authoringPose).toBe("custom");
    expect(Object.keys(filled.joints)).toHaveLength(JOINT_NAMES.length);
  });

  it("detects common humanoid bones without replacing clicked markers", () => {
    const model = new Group();
    const clickedPosition: [number, number, number] = [0.25, 1.8, 0.1];
    const existing = withJointMarker(createEmptyRig("detected-rig"), "Head", clickedPosition, "click");

    addBone(model, "mixamorigHips", [0, 1, 0]);
    addBone(model, "mixamorigSpine2", [0, 1.45, 0]);
    addBone(model, "mixamorigNeck", [0, 1.65, 0]);
    addBone(model, "mixamorigLeftForeArm", [-0.55, 1.35, 0]);
    addBone(model, "mixamorigRightForeArm", [0.55, 1.35, 0]);
    addBone(model, "mixamorigLeftHand", [-0.8, 1.22, 0]);
    addBone(model, "mixamorigRightHand", [0.8, 1.22, 0]);
    addBone(model, "mixamorigLeftUpLeg", [-0.18, 0.95, 0]);
    addBone(model, "mixamorigRightUpLeg", [0.18, 0.95, 0]);

    const result = createRigFromDetectedBones(model, "model-detected", "/models/model.glb", "model.glb", existing);

    expect(result.boneCount).toBe(9);
    expect(result.rig.authoringPose).toBe("detected");
    expect(result.rig.joints.Head?.source).toBe("click");
    expect(result.rig.joints.Head?.position).toEqual(clickedPosition);
    expect(result.rig.joints.Hips?.source).toBe("detect");
    expect(result.rig.joints.LeftWrist?.source).toBe("detect");
    expect(result.detected).toContain("RightHip");
    expect(result.missing).toContain("LeftShoulder");
  });
});

function addBone(parent: Group, name: string, position: [number, number, number]): void {
  const bone = new Bone();
  bone.name = name;
  bone.position.set(position[0], position[1], position[2]);
  parent.add(bone);
}
