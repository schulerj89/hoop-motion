import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  CylinderGeometry,
  Mesh,
  MeshStandardMaterial,
  Quaternion,
  Scene,
  SphereGeometry,
  Vector3
} from "three";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";

if (typeof globalThis.FileReader === "undefined") {
  globalThis.FileReader = class FileReader {
    result = null;
    onloadend = null;
    onerror = null;

    readAsArrayBuffer(blob) {
      blob.arrayBuffer()
        .then((buffer) => {
          this.result = buffer;
          this.onloadend?.({ target: this });
        })
        .catch((error) => {
          this.onerror?.(error);
        });
    }

    readAsDataURL(blob) {
      blob.arrayBuffer()
        .then((buffer) => {
          const base64 = Buffer.from(buffer).toString("base64");
          this.result = `data:${blob.type || "application/octet-stream"};base64,${base64}`;
          this.onloadend?.({ target: this });
        })
        .catch((error) => {
          this.onerror?.(error);
        });
    }
  };
}

const joints = [
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

const bones = [
  { from: "Hips", to: "Chest", segmentName: "Segment_Spine", thickness: 0.26 },
  { from: "Chest", to: "Neck", segmentName: "Segment_Neck", thickness: 0.16 },
  { from: "Neck", to: "Head", segmentName: "Segment_Head", thickness: 0.22 },
  { from: "Chest", to: "LeftShoulder", segmentName: "Segment_LeftClavicle", thickness: 0.11 },
  { from: "Chest", to: "RightShoulder", segmentName: "Segment_RightClavicle", thickness: 0.11 },
  { from: "LeftShoulder", to: "LeftElbow", segmentName: "Segment_LeftUpperArm", thickness: 0.11 },
  { from: "LeftElbow", to: "LeftWrist", segmentName: "Segment_LeftForeArm", thickness: 0.095 },
  { from: "RightShoulder", to: "RightElbow", segmentName: "Segment_RightUpperArm", thickness: 0.11 },
  { from: "RightElbow", to: "RightWrist", segmentName: "Segment_RightForeArm", thickness: 0.095 },
  { from: "Hips", to: "LeftHip", segmentName: "Segment_LeftHip", thickness: 0.16 },
  { from: "Hips", to: "RightHip", segmentName: "Segment_RightHip", thickness: 0.16 },
  { from: "LeftHip", to: "LeftKnee", segmentName: "Segment_LeftThigh", thickness: 0.14 },
  { from: "LeftKnee", to: "LeftAnkle", segmentName: "Segment_LeftShin", thickness: 0.12 },
  { from: "LeftAnkle", to: "LeftFoot", segmentName: "Segment_LeftFoot", thickness: 0.095 },
  { from: "RightHip", to: "RightKnee", segmentName: "Segment_RightThigh", thickness: 0.14 },
  { from: "RightKnee", to: "RightAnkle", segmentName: "Segment_RightShin", thickness: 0.12 },
  { from: "RightAnkle", to: "RightFoot", segmentName: "Segment_RightFoot", thickness: 0.095 }
];

const restPose = {
  Hips: [0, 0.98, 0],
  Chest: [0, 1.44, 0],
  Neck: [0, 1.63, 0],
  Head: [0, 1.84, 0],
  LeftShoulder: [-0.34, 1.50, 0],
  RightShoulder: [0.34, 1.50, 0],
  LeftElbow: [-0.72, 1.47, 0],
  RightElbow: [0.72, 1.47, 0],
  LeftWrist: [-1.07, 1.43, 0],
  RightWrist: [1.07, 1.43, 0],
  LeftHip: [-0.18, 0.94, 0],
  RightHip: [0.18, 0.94, 0],
  LeftKnee: [-0.21, 0.52, 0],
  RightKnee: [0.21, 0.52, 0],
  LeftAnkle: [-0.22, 0.12, 0],
  RightAnkle: [0.22, 0.12, 0],
  LeftFoot: [-0.28, 0.06, 0.18],
  RightFoot: [0.28, 0.06, 0.18]
};

const scene = new Scene();
scene.name = "KineRig_PoseBot";

const torso = new MeshStandardMaterial({ color: 0x277a8c, roughness: 0.82, metalness: 0.02 });
const limb = new MeshStandardMaterial({ color: 0xe7ba8f, roughness: 0.88, metalness: 0.0 });
const shoe = new MeshStandardMaterial({ color: 0x202327, roughness: 0.7, metalness: 0.05 });

const segmentGeometry = new CylinderGeometry(0.5, 0.5, 1, 16, 1);
const jointGeometry = new SphereGeometry(0.5, 16, 12);

for (const bone of bones) {
  const material = bone.segmentName.includes("Spine") || bone.segmentName.includes("Clavicle") || bone.segmentName.includes("Hip")
    ? torso
    : bone.segmentName.includes("Foot")
      ? shoe
      : limb;
  const mesh = new Mesh(segmentGeometry, material);
  mesh.name = bone.segmentName;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  placeSegment(mesh, restPose[bone.from], restPose[bone.to], bone.thickness);
  scene.add(mesh);
}

for (const name of joints) {
  const material = name.includes("Foot") || name.includes("Ankle") ? shoe : limb;
  const mesh = new Mesh(jointGeometry, material);
  mesh.name = `Joint_${name}`;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.position.fromArray(restPose[name]);
  mesh.scale.setScalar(name === "Head" ? 0.18 : name.includes("Foot") ? 0.08 : 0.095);
  scene.add(mesh);
}

const exporter = new GLTFExporter();
const glb = await new Promise((resolve, reject) => {
  exporter.parse(
    scene,
    (result) => resolve(result),
    (error) => reject(error),
    { binary: true }
  );
});

const output = path.resolve("public/models/posebot.glb");
await mkdir(path.dirname(output), { recursive: true });
await writeFile(output, Buffer.from(glb));
console.log(`Wrote ${output}`);

function placeSegment(mesh, from, to, thickness) {
  const start = new Vector3().fromArray(from);
  const end = new Vector3().fromArray(to);
  const direction = end.clone().sub(start);
  const length = Math.max(direction.length(), 0.001);
  const midpoint = start.clone().add(end).multiplyScalar(0.5);
  const rotation = new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), direction.clone().normalize());
  mesh.position.copy(midpoint);
  mesh.quaternion.copy(rotation);
  mesh.scale.set(thickness, length, thickness);
}
