import { BoxGeometry, Mesh, MeshBasicMaterial } from "three";
import { describe, expect, it } from "vitest";
import {
  createAutoRigFromModel,
  createEmptyRig,
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
});
