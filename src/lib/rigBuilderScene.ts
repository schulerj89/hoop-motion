import {
  BufferAttribute,
  BufferGeometry,
  Group,
  LineBasicMaterial,
  LineSegments,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  PerspectiveCamera,
  Raycaster,
  Scene,
  SphereGeometry,
  Vector2,
  Vector3,
  WebGLRenderer
} from "three";
import { TransformControls } from "three/examples/jsm/controls/TransformControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { createAutoRigFromModel, createEmptyRig, countPlacedJoints, withJointMarker } from "./rigAuthoring";
import { BONES, JOINT_NAMES } from "./skeleton";
import type { JointName, RigFile, Vec3 } from "./types";

const HIDDEN_POINT = new Vector3(0, -1000, 0);
type TransformTarget = "model" | "joint";
type TransformMode = "translate" | "rotate" | "scale";

export class RigBuilderScene {
  readonly transformControls: TransformControls;

  private readonly scene: Scene;
  private readonly camera: PerspectiveCamera;
  private readonly renderer: WebGLRenderer;
  private readonly stage: HTMLElement;
  private readonly loader = new GLTFLoader();
  private readonly raycaster = new Raycaster();
  private readonly pointer = new Vector2();
  private readonly markerGeometry = new SphereGeometry(0.045, 18, 12);
  private readonly markerMaterial = new MeshBasicMaterial({ color: 0xffb347, depthTest: false });
  private readonly selectedMaterial = new MeshBasicMaterial({ color: 0x79ffb1, depthTest: false });
  private readonly markerGroup = new Group();
  private readonly rigLine = createRigLine();
  private modelRoot = new Group();
  private selectedJoint: JointName = "Hips";
  private rig: RigFile = createEmptyRig("untitled-rig", "/models/posebot.glb", "posebot.glb");
  private active = false;
  private modelUrl = "/models/posebot.glb";
  private modelName = "posebot.glb";
  private transformTarget: TransformTarget = "model";
  private transformMode: TransformMode = "translate";
  private onChange: (rig: RigFile) => void;
  private readonly transformHelper: Object3D;
  private readonly previousModelMatrixWorld = new Matrix4();

  constructor(
    scene: Scene,
    camera: PerspectiveCamera,
    renderer: WebGLRenderer,
    stage: HTMLElement,
    onChange: (rig: RigFile) => void
  ) {
    this.scene = scene;
    this.camera = camera;
    this.renderer = renderer;
    this.stage = stage;
    this.onChange = onChange;
    this.markerGroup.name = "KineRig_RigMarkers";
    this.markerGroup.renderOrder = 30;
    this.scene.add(this.modelRoot, this.markerGroup, this.rigLine);
    this.transformControls = new TransformControls(camera, renderer.domElement);
    this.transformControls.setMode(this.transformMode);
    this.transformHelper = this.transformControls.getHelper();
    this.transformHelper.visible = false;
    this.transformControls.addEventListener("objectChange", () => this.syncTransformObject());
    this.scene.add(this.transformHelper);
    this.stage.addEventListener("pointerdown", (event) => this.onPointerDown(event));
    this.setVisible(false);
  }

  async loadModelFromUrl(modelUrl: string, modelName = modelUrl.split("/").at(-1) ?? "model.glb"): Promise<void> {
    this.modelUrl = modelUrl;
    this.modelName = modelName;
    const gltf = await this.loader.loadAsync(modelUrl);
    this.replaceModel(gltf.scene);
  }

  async loadModelFromFile(file: File): Promise<void> {
    const objectUrl = URL.createObjectURL(file);
    this.modelUrl = `local://${file.name}`;
    this.modelName = file.name;
    const gltf = await this.loader.loadAsync(objectUrl);
    URL.revokeObjectURL(objectUrl);
    this.replaceModel(gltf.scene);
  }

  setVisible(visible: boolean): void {
    this.active = visible;
    this.modelRoot.visible = visible;
    this.markerGroup.visible = visible;
    this.rigLine.visible = visible;
    this.transformHelper.visible = visible && Boolean(this.transformControls.object);
  }

  selectJoint(joint: JointName): void {
    this.selectedJoint = joint;
    this.transformTarget = "joint";
    this.refreshMarkerMaterials();
    this.attachSelectedMarker();
    this.onChange(this.rig);
  }

  selectJointTarget(): void {
    this.transformTarget = "joint";
    this.attachSelectedMarker();
    this.onChange(this.rig);
  }

  selectModel(): void {
    this.transformTarget = "model";
    this.transformControls.attach(this.modelRoot);
    this.captureModelMatrix();
    this.transformHelper.visible = this.active;
    this.onChange(this.rig);
  }

  getSelectedJoint(): JointName {
    return this.selectedJoint;
  }

  getTransformTarget(): TransformTarget {
    return this.transformTarget;
  }

  getTransformMode(): TransformMode {
    return this.transformMode;
  }

  setTransformMode(mode: TransformMode): void {
    this.transformMode = mode;
    this.transformControls.setMode(mode);
  }

  getModelPosition(): Vec3 {
    return toVec3(this.modelRoot.position);
  }

  translateModel(offset: Vec3): void {
    this.selectModel();
    this.modelRoot.position.add(new Vector3(offset[0], offset[1], offset[2]));
    this.syncModelTransform();
  }

  getRig(): RigFile {
    return this.rig;
  }

  getPlacedCount(): number {
    return countPlacedJoints(this.rig);
  }

  autoRig(): void {
    this.applyRig(createAutoRigFromModel(this.modelRoot, `${this.modelName}-rig`, this.modelUrl, this.modelName));
  }

  applyRig(rig: RigFile): void {
    this.rig = rig;
    this.markerGroup.clear();
    for (const joint of JOINT_NAMES) {
      const marker = rig.joints[joint];
      if (!marker) {
        continue;
      }
      this.createOrUpdateMarker(joint, marker.position);
    }
    if (this.transformTarget === "model") {
      this.selectModel();
    } else {
      this.attachSelectedMarker();
    }
    this.updateRigLine();
    this.onChange(this.rig);
  }

  private replaceModel(model: Object3D): void {
    this.transformControls.detach();
    this.scene.remove(this.modelRoot);
    this.modelRoot = new Group();
    this.modelRoot.name = "KineRig_RigModelRoot";
    this.modelRoot.add(model);
    this.scene.add(this.modelRoot);
    this.modelRoot.visible = this.active;
    this.transformTarget = "model";
    this.applyRig(createEmptyRig(`${this.modelName}-rig`, this.modelUrl, this.modelName));
    this.selectModel();
  }

  private onPointerDown(event: PointerEvent): void {
    if (!this.active || this.transformControls.dragging || event.button !== 0) {
      return;
    }
    if (this.transformTarget === "model") {
      return;
    }
    this.setPointer(event);

    const markerHit = this.raycaster.intersectObjects(this.markerGroup.children, false)[0];
    if (markerHit?.object.userData.joint) {
      this.selectJoint(markerHit.object.userData.joint as JointName);
      return;
    }

    const modelHit = this.raycaster.intersectObjects(collectMeshes(this.modelRoot), true)[0];
    if (!modelHit) {
      return;
    }
    this.rig = withJointMarker(this.rig, this.selectedJoint, toVec3(modelHit.point), "click");
    const marker = this.createOrUpdateMarker(this.selectedJoint, toVec3(modelHit.point));
    this.transformControls.attach(marker);
    this.transformHelper.visible = true;
    this.updateRigLine();
    this.onChange(this.rig);
  }

  private setPointer(event: PointerEvent): void {
    const rect = this.stage.getBoundingClientRect();
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera);
  }

  private syncTransformObject(): void {
    if (this.transformControls.object === this.modelRoot) {
      this.syncModelTransform();
      return;
    }
    this.syncAttachedMarker();
  }

  private syncAttachedMarker(): void {
    const object = this.transformControls.object;
    const joint = object?.userData.joint as JointName | undefined;
    if (!object || !joint) {
      return;
    }
    this.rig = withJointMarker(this.rig, joint, toVec3(object.position), "click");
    this.updateRigLine();
    this.onChange(this.rig);
  }

  private syncModelTransform(): void {
    const previous = this.previousModelMatrixWorld.clone();
    this.modelRoot.updateMatrixWorld(true);
    const next = this.modelRoot.matrixWorld.clone();
    const delta = next.clone().multiply(previous.invert());
    this.previousModelMatrixWorld.copy(next);

    if (this.getPlacedCount() > 0) {
      this.applyDeltaToMarkers(delta);
      this.updateRigLine();
    }
    this.onChange(this.rig);
  }

  private applyDeltaToMarkers(delta: Matrix4): void {
    const joints: RigFile["joints"] = {};
    for (const joint of JOINT_NAMES) {
      const marker = this.getMarker(joint);
      if (!marker) {
        continue;
      }
      marker.position.applyMatrix4(delta);
      joints[joint] = {
        joint,
        position: toVec3(marker.position),
        source: this.rig.joints[joint]?.source ?? "click"
      };
    }
    this.rig = {
      ...this.rig,
      generatedAt: new Date().toISOString(),
      joints
    };
  }

  private attachSelectedMarker(): void {
    const marker = this.getMarker(this.selectedJoint);
    if (!marker) {
      this.transformControls.detach();
      this.transformHelper.visible = false;
      return;
    }
    this.transformControls.attach(marker);
    this.transformHelper.visible = this.active;
  }

  private captureModelMatrix(): void {
    this.modelRoot.updateMatrixWorld(true);
    this.previousModelMatrixWorld.copy(this.modelRoot.matrixWorld);
  }

  private createOrUpdateMarker(joint: JointName, position: Vec3): Mesh {
    const existing = this.getMarker(joint);
    if (existing) {
      existing.position.set(position[0], position[1], position[2]);
      return existing;
    }
    const marker = new Mesh(this.markerGeometry, joint === this.selectedJoint ? this.selectedMaterial : this.markerMaterial);
    marker.name = `RigMarker_${joint}`;
    marker.userData.joint = joint;
    marker.renderOrder = 40;
    marker.position.set(position[0], position[1], position[2]);
    this.markerGroup.add(marker);
    return marker;
  }

  private getMarker(joint: JointName): Mesh | undefined {
    return this.markerGroup.children.find((child) => child.userData.joint === joint) as Mesh | undefined;
  }

  private refreshMarkerMaterials(): void {
    for (const child of this.markerGroup.children) {
      if (child instanceof Mesh) {
        child.material = child.userData.joint === this.selectedJoint ? this.selectedMaterial : this.markerMaterial;
      }
    }
  }

  private updateRigLine(): void {
    const position = this.rigLine.geometry.getAttribute("position") as BufferAttribute;
    for (let index = 0; index < BONES.length; index += 1) {
      const bone = BONES[index];
      const start = this.rig.joints[bone.from]?.position;
      const end = this.rig.joints[bone.to]?.position;
      const a = start ? new Vector3(start[0], start[1], start[2]) : HIDDEN_POINT;
      const b = end ? new Vector3(end[0], end[1], end[2]) : HIDDEN_POINT;
      position.setXYZ(index * 2, a.x, a.y, a.z);
      position.setXYZ(index * 2 + 1, b.x, b.y, b.z);
    }
    position.needsUpdate = true;
    this.rigLine.geometry.computeBoundingSphere();
  }
}

function createRigLine(): LineSegments {
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(new Float32Array(BONES.length * 2 * 3), 3));
  const material = new LineBasicMaterial({
    color: 0x7dffcf,
    transparent: true,
    opacity: 0.95,
    depthTest: false
  });
  const line = new LineSegments(geometry, material);
  line.name = "KineRig_AuthoringRigLine";
  line.renderOrder = 25;
  return line;
}

function collectMeshes(root: Object3D): Object3D[] {
  const meshes: Object3D[] = [];
  root.traverse((object) => {
    if (object instanceof Mesh) {
      meshes.push(object);
    }
  });
  return meshes;
}

function toVec3(vector: Vector3): Vec3 {
  return [vector.x, vector.y, vector.z];
}
