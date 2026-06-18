import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  CylinderGeometry,
  Mesh,
  MeshStandardMaterial,
  Scene,
  SphereGeometry
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

const segments = [
  "Segment_Spine",
  "Segment_Neck",
  "Segment_Head",
  "Segment_LeftClavicle",
  "Segment_RightClavicle",
  "Segment_LeftUpperArm",
  "Segment_LeftForeArm",
  "Segment_RightUpperArm",
  "Segment_RightForeArm",
  "Segment_LeftHip",
  "Segment_RightHip",
  "Segment_LeftThigh",
  "Segment_LeftShin",
  "Segment_LeftFoot",
  "Segment_RightThigh",
  "Segment_RightShin",
  "Segment_RightFoot"
];

const scene = new Scene();
scene.name = "HoopMotion_HoopBot";

const jersey = new MeshStandardMaterial({ color: 0x1f7f5c, roughness: 0.82, metalness: 0.02 });
const limb = new MeshStandardMaterial({ color: 0xe7ba8f, roughness: 0.88, metalness: 0.0 });
const shoe = new MeshStandardMaterial({ color: 0x202327, roughness: 0.7, metalness: 0.05 });
const ball = new MeshStandardMaterial({ color: 0xd86e1d, roughness: 0.65, metalness: 0.0 });

const segmentGeometry = new CylinderGeometry(0.5, 0.5, 1, 16, 1);
const jointGeometry = new SphereGeometry(0.5, 16, 12);

for (const name of segments) {
  const material = name.includes("Spine") || name.includes("Clavicle") || name.includes("Hip")
    ? jersey
    : name.includes("Foot")
      ? shoe
      : limb;
  const mesh = new Mesh(segmentGeometry, material);
  mesh.name = name;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);
}

for (const name of joints) {
  const material = name.includes("Foot") || name.includes("Ankle") ? shoe : limb;
  const mesh = new Mesh(jointGeometry, material);
  mesh.name = `Joint_${name}`;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);
}

const ballMesh = new Mesh(new SphereGeometry(0.5, 32, 16), ball);
ballMesh.name = "Prop_Ball";
ballMesh.castShadow = true;
ballMesh.receiveShadow = true;
scene.add(ballMesh);

const exporter = new GLTFExporter();
const glb = await new Promise((resolve, reject) => {
  exporter.parse(
    scene,
    (result) => resolve(result),
    (error) => reject(error),
    { binary: true }
  );
});

const output = path.resolve("public/models/hoopbot.glb");
await mkdir(path.dirname(output), { recursive: true });
await writeFile(output, Buffer.from(glb));
console.log(`Wrote ${output}`);
