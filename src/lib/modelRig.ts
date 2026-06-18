import {
  BufferAttribute,
  BufferGeometry,
  LineBasicMaterial,
  LineSegments,
  Object3D,
  Quaternion,
  Vector3
} from "three";
import { BONES, JOINT_NAMES, MODEL_JOINT_PREFIX } from "./skeleton";
import type { AnimationFile, AnimationFrame, JointName } from "./types";

const Y_AXIS = new Vector3(0, 1, 0);
const tempStart = new Vector3();
const tempEnd = new Vector3();
const tempMid = new Vector3();
const tempDirection = new Vector3();
const tempQuaternion = new Quaternion();

export function createSkeletonDebugLine(): LineSegments {
  const geometry = new BufferGeometry();
  const positions = new Float32Array(BONES.length * 2 * 3);
  geometry.setAttribute("position", new BufferAttribute(positions, 3));
  const material = new LineBasicMaterial({
    color: 0xfff2a8,
    linewidth: 2,
    transparent: true,
    opacity: 0.95,
    depthTest: false
  });
  const line = new LineSegments(geometry, material);
  line.name = "HoopMotion_DebugSkeleton";
  line.renderOrder = 20;
  return line;
}

export function applyAnimationFrame(
  modelRoot: Object3D,
  debugLine: LineSegments,
  animation: AnimationFile,
  frame: AnimationFrame,
  debugVisible: boolean
): void {
  const hip = frame.joints.Hips.position;
  modelRoot.position.set(-hip[0], 0, -hip[2]);
  debugLine.position.copy(modelRoot.position);

  for (const bone of animation.bones) {
    const segment = modelRoot.getObjectByName(bone.segmentName);
    if (!segment) {
      continue;
    }
    setVec(tempStart, frame.joints[bone.from].position);
    setVec(tempEnd, frame.joints[bone.to].position);
    tempMid.copy(tempStart).add(tempEnd).multiplyScalar(0.5);
    tempDirection.copy(tempEnd).sub(tempStart);
    const length = Math.max(tempDirection.length(), 0.001);
    tempDirection.normalize();
    tempQuaternion.setFromUnitVectors(Y_AXIS, tempDirection);
    segment.position.copy(tempMid);
    segment.quaternion.copy(tempQuaternion);
    segment.scale.set(bone.thickness, length, bone.thickness);
    segment.visible = length > 0.01;
  }

  for (const joint of JOINT_NAMES) {
    const jointMesh = modelRoot.getObjectByName(`${MODEL_JOINT_PREFIX}${joint}`);
    if (!jointMesh) {
      continue;
    }
    setVec(tempStart, frame.joints[joint].position);
    jointMesh.position.copy(tempStart);
    const scale = joint === "Head" ? 0.18 : joint.includes("Foot") ? 0.08 : 0.095;
    jointMesh.scale.setScalar(scale);
  }

  const ball = modelRoot.getObjectByName("Prop_Ball");
  if (ball) {
    setVec(tempStart, frame.joints.RightWrist.position);
    ball.position.set(tempStart.x + 0.12, Math.max(0.12, tempStart.y - 0.05), tempStart.z + 0.08);
    ball.scale.setScalar(0.18);
  }

  updateSkeletonDebug(debugLine, frame, debugVisible);
}

function updateSkeletonDebug(line: LineSegments, frame: AnimationFrame, visible: boolean): void {
  line.visible = visible;
  const position = line.geometry.getAttribute("position") as BufferAttribute;
  for (let index = 0; index < BONES.length; index += 1) {
    const bone = BONES[index];
    const start = frame.joints[bone.from].position;
    const end = frame.joints[bone.to].position;
    position.setXYZ(index * 2, start[0], start[1], start[2]);
    position.setXYZ(index * 2 + 1, end[0], end[1], end[2]);
  }
  position.needsUpdate = true;
  line.geometry.computeBoundingSphere();
}

function setVec(target: Vector3, source: [number, number, number]): void {
  target.set(source[0], source[1], source[2]);
}
