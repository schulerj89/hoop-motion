import "./style.css";
import {
  AmbientLight,
  Clock,
  Color,
  DirectionalLight,
  GridHelper,
  Group,
  Mesh,
  MeshStandardMaterial,
  PCFSoftShadowMap,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  Vector3,
  WebGLRenderer
} from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { applyAnimationFrame, createSkeletonDebugLine } from "./lib/modelRig";
import { createRetargetPackage, sanitizeRigFile } from "./lib/rigAuthoring";
import { RigBuilderScene } from "./lib/rigBuilderScene";
import { JOINT_NAMES } from "./lib/skeleton";
import type { AnimationFile, JointName, RigFile, ValidationReport } from "./lib/types";

declare global {
  interface Window {
    __KINERIG_READY?: boolean;
    __KINERIG_RIG_READY?: boolean;
  }
}

const app = document.querySelector<HTMLDivElement>("#app");
if (!app) {
  throw new Error("Missing #app element");
}

app.innerHTML = `
  <main class="shell">
    <section class="viewer-panel">
      <header class="toolbar">
        <div class="brand">
          <span class="mark"></span>
          <div>
            <h1>KineRig Studio</h1>
            <p id="runLabel">Loading</p>
          </div>
        </div>
        <div class="mode-tabs" role="tablist" aria-label="Workspace mode">
          <button id="motionMode" class="active" type="button">Motion</button>
          <button id="rigMode" type="button">Rig Builder</button>
        </div>
        <div class="run-picker">
          <input id="runInput" type="text" value="fixture-reach" aria-label="Run name" />
          <button id="loadRun" type="button">Load</button>
        </div>
        <div class="controls">
          <button id="playPause" type="button">Play</button>
          <button id="reset" type="button">Reset</button>
          <label class="toggle"><input id="debug" type="checkbox" checked /> Skeleton</label>
          <select id="speed" aria-label="Playback speed">
            <option value="0.5">0.5x</option>
            <option value="1" selected>1x</option>
            <option value="1.5">1.5x</option>
            <option value="2">2x</option>
          </select>
        </div>
      </header>
      <div id="stage" class="stage"></div>
      <div class="timeline-row">
        <span id="timeLabel">0.00s</span>
        <input id="timeline" type="range" min="0" max="0" value="0" step="1" aria-label="Timeline" />
      </div>
    </section>
    <aside class="report-panel">
      <section id="motionPanel">
        <h2>Run Report</h2>
        <dl id="reportList"></dl>
      </section>
      <section id="rigPanel" class="rig-panel" hidden>
        <h2>Rig Builder</h2>
        <div class="rig-row">
          <input id="rigModelUrl" type="text" value="/models/posebot.glb" aria-label="Model URL" />
          <button id="loadRigModel" type="button">Load</button>
        </div>
        <label class="file-button">
          <span>GLB File</span>
          <input id="rigModelFile" type="file" accept=".glb,.gltf,model/gltf-binary,model/gltf+json" />
        </label>
        <div class="rig-actions">
          <button id="autoRig" type="button">Auto A/T</button>
          <button id="exportRig" type="button">Export Rig</button>
          <button id="exportPackage" type="button">Export Package</button>
        </div>
        <label class="file-button">
          <span>Import Rig</span>
          <input id="importRig" type="file" accept="application/json,.json" />
        </label>
        <div class="rig-status">
          <span id="selectedJointLabel">Hips</span>
          <span id="rigCountLabel">0 / 18</span>
        </div>
        <div id="jointButtons" class="joint-grid"></div>
      </section>
    </aside>
  </main>
`;

const stage = document.querySelector<HTMLDivElement>("#stage")!;
const motionModeButton = document.querySelector<HTMLButtonElement>("#motionMode")!;
const rigModeButton = document.querySelector<HTMLButtonElement>("#rigMode")!;
const runInput = document.querySelector<HTMLInputElement>("#runInput")!;
const runLabel = document.querySelector<HTMLParagraphElement>("#runLabel")!;
const loadRunButton = document.querySelector<HTMLButtonElement>("#loadRun")!;
const playPauseButton = document.querySelector<HTMLButtonElement>("#playPause")!;
const resetButton = document.querySelector<HTMLButtonElement>("#reset")!;
const debugInput = document.querySelector<HTMLInputElement>("#debug")!;
const speedSelect = document.querySelector<HTMLSelectElement>("#speed")!;
const timeline = document.querySelector<HTMLInputElement>("#timeline")!;
const timeLabel = document.querySelector<HTMLSpanElement>("#timeLabel")!;
const reportList = document.querySelector<HTMLElement>("#reportList")!;
const motionPanel = document.querySelector<HTMLElement>("#motionPanel")!;
const rigPanel = document.querySelector<HTMLElement>("#rigPanel")!;
const rigModelUrl = document.querySelector<HTMLInputElement>("#rigModelUrl")!;
const loadRigModelButton = document.querySelector<HTMLButtonElement>("#loadRigModel")!;
const rigModelFile = document.querySelector<HTMLInputElement>("#rigModelFile")!;
const autoRigButton = document.querySelector<HTMLButtonElement>("#autoRig")!;
const exportRigButton = document.querySelector<HTMLButtonElement>("#exportRig")!;
const exportPackageButton = document.querySelector<HTMLButtonElement>("#exportPackage")!;
const importRigInput = document.querySelector<HTMLInputElement>("#importRig")!;
const selectedJointLabel = document.querySelector<HTMLSpanElement>("#selectedJointLabel")!;
const rigCountLabel = document.querySelector<HTMLSpanElement>("#rigCountLabel")!;
const jointButtons = document.querySelector<HTMLDivElement>("#jointButtons")!;

const scene = new Scene();
scene.background = new Color(0x101418);

const camera = new PerspectiveCamera(45, 1, 0.1, 100);
camera.position.set(0, 1.65, 4.2);
camera.lookAt(0, 1.1, 0);

const renderer = new WebGLRenderer({ antialias: true });
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = PCFSoftShadowMap;
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
stage.appendChild(renderer.domElement);

const ambient = new AmbientLight(0xffffff, 1.8);
scene.add(ambient);

const key = new DirectionalLight(0xffffff, 3.2);
key.position.set(3.5, 4.5, 2.5);
key.castShadow = true;
scene.add(key);

const floor = new Mesh(
  new PlaneGeometry(8, 5),
  new MeshStandardMaterial({ color: 0x2f3b44, roughness: 0.8, metalness: 0.03 })
);
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);

const grid = new GridHelper(8, 16, 0x8fa7b3, 0x32424c);
grid.position.y = 0.003;
scene.add(grid);

let modelRoot = new Group();
scene.add(modelRoot);

const debugLine = createSkeletonDebugLine();
scene.add(debugLine);

const clock = new Clock();
let mode: "motion" | "rig" = new URLSearchParams(window.location.search).get("mode") === "rig" ? "rig" : "motion";
let animation: AnimationFile | undefined;
let report: ValidationReport | undefined;
let frameIndex = 0;
let playing = true;
let runName = new URLSearchParams(window.location.search).get("run") ?? "fixture-reach";
let loading = false;
const rigBuilder = new RigBuilderScene(scene, camera, renderer, stage, updateRigPanel);

runInput.value = runName;
renderJointButtons();
setMode(mode);
if (mode === "rig") {
  loadRigAuthoringModel(rigModelUrl.value).catch(showError);
} else {
  loadRun(runName).catch(showError);
}

motionModeButton.addEventListener("click", () => setMode("motion"));
rigModeButton.addEventListener("click", () => {
  setMode("rig");
  if (!rigBuilder.getPlacedCount()) {
    loadRigAuthoringModel(rigModelUrl.value).catch(showError);
  }
});

loadRunButton.addEventListener("click", () => {
  const nextRun = runInput.value.trim();
  if (nextRun) {
    setMode("motion");
    window.history.replaceState(null, "", `?run=${encodeURIComponent(nextRun)}&mode=motion`);
    loadRun(nextRun).catch(showError);
  }
});

playPauseButton.addEventListener("click", () => {
  playing = !playing;
  playPauseButton.textContent = playing ? "Pause" : "Play";
});

resetButton.addEventListener("click", () => {
  frameIndex = 0;
  playing = false;
  playPauseButton.textContent = "Play";
  renderCurrentFrame();
});

timeline.addEventListener("input", () => {
  frameIndex = Number(timeline.value);
  playing = false;
  playPauseButton.textContent = "Play";
  renderCurrentFrame();
});

loadRigModelButton.addEventListener("click", () => {
  setMode("rig");
  loadRigAuthoringModel(rigModelUrl.value).catch(showError);
});

rigModelFile.addEventListener("change", () => {
  const file = rigModelFile.files?.[0];
  if (!file) {
    return;
  }
  setMode("rig");
  rigBuilder.loadModelFromFile(file)
    .then(() => {
      rigModelUrl.value = file.name;
      window.__KINERIG_RIG_READY = true;
      updateRigPanel(rigBuilder.getRig());
      renderCurrentRigFrame();
    })
    .catch(showError);
});

autoRigButton.addEventListener("click", () => {
  rigBuilder.autoRig();
  renderCurrentRigFrame();
});

exportRigButton.addEventListener("click", () => {
  downloadJson(`${rigBuilder.getRig().name}.json`, rigBuilder.getRig());
});

exportPackageButton.addEventListener("click", () => {
  downloadJson(`${rigBuilder.getRig().name}-retarget-package.json`, createRetargetPackage(rigBuilder.getRig(), animation));
});

importRigInput.addEventListener("change", () => {
  const file = importRigInput.files?.[0];
  if (!file) {
    return;
  }
  file.text()
    .then((text) => {
      rigBuilder.applyRig(sanitizeRigFile(JSON.parse(text) as RigFile));
      renderCurrentRigFrame();
    })
    .catch(showError);
});

new ResizeObserver(resize).observe(stage);
resize();
renderer.setAnimationLoop(render);

async function loadRun(nextRunName: string): Promise<void> {
  if (loading) {
    return;
  }
  loading = true;
  window.__KINERIG_READY = false;
  runName = nextRunName;
  runLabel.textContent = runName;
  reportList.innerHTML = "";

  const animationResponse = await fetch(`/runs/${runName}/animation.json`, { cache: "no-store" });
  if (!animationResponse.ok) {
    throw new Error(`Could not load /runs/${runName}/animation.json`);
  }
  animation = await animationResponse.json() as AnimationFile;
  report = animation.report;

  rigBuilder.setVisible(false);
  scene.remove(modelRoot);
  const loader = new GLTFLoader();
  const gltf = await loader.loadAsync(animation.modelUrl);
  modelRoot = gltf.scene;
  modelRoot.name = "KineRig_ModelRoot";
  scene.add(modelRoot);

  frameIndex = 0;
  timeline.max = String(Math.max(animation.frames.length - 1, 0));
  timeline.value = "0";
  playing = true;
  playPauseButton.textContent = "Pause";
  renderReport(report);
  renderCurrentFrame();
  loading = false;
  window.__KINERIG_READY = true;
}

async function loadRigAuthoringModel(modelUrl: string): Promise<void> {
  if (loading) {
    return;
  }
  loading = true;
  window.__KINERIG_RIG_READY = false;
  runLabel.textContent = "Rig Builder";
  scene.remove(modelRoot);
  modelRoot = new Group();
  scene.add(modelRoot);
  debugLine.visible = false;
  await rigBuilder.loadModelFromUrl(modelUrl);
  rigBuilder.setVisible(true);
  updateRigPanel(rigBuilder.getRig());
  renderCurrentRigFrame();
  loading = false;
  window.__KINERIG_RIG_READY = true;
}

function render(): void {
  const delta = clock.getDelta();
  if (mode === "motion" && animation && playing && animation.frames.length > 0) {
    const speed = Number(speedSelect.value);
    const frameStep = Math.max(1, Math.round(delta * animation.fps * speed));
    frameIndex = (frameIndex + frameStep) % animation.frames.length;
    renderCurrentFrame();
  }
  renderer.render(scene, camera);
}

function renderCurrentFrame(): void {
  if (!animation) {
    return;
  }
  const frame = animation.frames[Math.min(frameIndex, animation.frames.length - 1)];
  applyAnimationFrame(modelRoot, debugLine, animation, frame, debugInput.checked);
  timeline.value = String(frameIndex);
  timeLabel.textContent = `${(frame.timeMs / 1000).toFixed(2)}s`;

  const hips = frame.joints.Hips.position;
  const cameraTarget = new Vector3(0, Math.max(1.0, hips[1] + 0.25), 0);
  camera.lookAt(cameraTarget);
  renderer.render(scene, camera);
}

function renderCurrentRigFrame(): void {
  camera.lookAt(0, 1.05, 0);
  renderer.render(scene, camera);
}

function renderReport(nextReport: ValidationReport): void {
  const rows: Array<[string, string]> = [
    ["Frames", String(nextReport.framesProcessed)],
    ["Detection", `${(nextReport.detectionSuccessRate * 100).toFixed(1)}%`],
    ["Avg Confidence", nextReport.averageConfidence.toFixed(3)],
    ["Missing Joints", String(nextReport.missingJointCount)],
    ["Interpolated", String(nextReport.interpolatedJointCount)],
    ["Synthetic", nextReport.synthetic ? "Yes" : "No"]
  ];
  reportList.innerHTML = rows
    .map(([label, value]) => `<div><dt>${label}</dt><dd>${value}</dd></div>`)
    .join("");
}

function resize(): void {
  const rect = stage.getBoundingClientRect();
  const width = Math.max(rect.width, 1);
  const height = Math.max(rect.height, 1);
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}

function showError(error: unknown): void {
  loading = false;
  const message = error instanceof Error ? error.message : String(error);
  runLabel.textContent = message;
  console.error(error);
}

function setMode(nextMode: "motion" | "rig"): void {
  mode = nextMode;
  const isRig = mode === "rig";
  motionModeButton.classList.toggle("active", !isRig);
  rigModeButton.classList.toggle("active", isRig);
  motionPanel.hidden = isRig;
  rigPanel.hidden = !isRig;
  document.body.classList.toggle("rig-mode", isRig);
  rigBuilder.setVisible(isRig);

  if (isRig) {
    window.history.replaceState(null, "", "?mode=rig");
    runLabel.textContent = "Rig Builder";
    playing = false;
    playPauseButton.textContent = "Play";
    renderCurrentRigFrame();
  } else {
    window.history.replaceState(null, "", `?run=${encodeURIComponent(runName)}&mode=motion`);
    debugLine.visible = debugInput.checked;
    if (animation) {
      renderCurrentFrame();
    }
  }
}

function renderJointButtons(): void {
  jointButtons.innerHTML = "";
  for (const joint of JOINT_NAMES) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = joint.replace(/([A-Z])/g, " $1").trim();
    button.dataset.joint = joint;
    button.addEventListener("click", () => {
      rigBuilder.selectJoint(joint);
      updateRigPanel(rigBuilder.getRig());
    });
    jointButtons.appendChild(button);
  }
}

function updateRigPanel(rig: RigFile): void {
  const selectedJoint = rigBuilder.getSelectedJoint();
  selectedJointLabel.textContent = selectedJoint;
  rigCountLabel.textContent = `${rigBuilder.getPlacedCount()} / ${JOINT_NAMES.length}`;
  for (const button of jointButtons.querySelectorAll<HTMLButtonElement>("button")) {
    const joint = button.dataset.joint as JointName;
    button.classList.toggle("active", joint === selectedJoint);
    button.classList.toggle("placed", Boolean(rig.joints[joint]));
  }
}

function downloadJson(filename: string, payload: unknown): void {
  const blob = new Blob([`${JSON.stringify(payload, null, 2)}\n`], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
