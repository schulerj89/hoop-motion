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
import type { AnimationFile, ValidationReport } from "./lib/types";

declare global {
  interface Window {
    __HOOPMOTION_READY?: boolean;
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
            <h1>HoopMotion</h1>
            <p id="runLabel">Loading</p>
          </div>
        </div>
        <div class="run-picker">
          <input id="runInput" type="text" value="fixture-jump-shot" aria-label="Run name" />
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
      <h2>Run Report</h2>
      <dl id="reportList"></dl>
    </aside>
  </main>
`;

const stage = document.querySelector<HTMLDivElement>("#stage")!;
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
  new MeshStandardMaterial({ color: 0xb86b36, roughness: 0.72, metalness: 0.02 })
);
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);

const grid = new GridHelper(8, 16, 0xf4d7a0, 0x3aa17e);
grid.position.y = 0.003;
scene.add(grid);

let modelRoot = new Group();
scene.add(modelRoot);

const debugLine = createSkeletonDebugLine();
scene.add(debugLine);

const clock = new Clock();
let animation: AnimationFile | undefined;
let report: ValidationReport | undefined;
let frameIndex = 0;
let playing = true;
let runName = new URLSearchParams(window.location.search).get("run") ?? "fixture-jump-shot";
let loading = false;

runInput.value = runName;
loadRun(runName).catch(showError);

loadRunButton.addEventListener("click", () => {
  const nextRun = runInput.value.trim();
  if (nextRun) {
    window.history.replaceState(null, "", `?run=${encodeURIComponent(nextRun)}`);
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

new ResizeObserver(resize).observe(stage);
resize();
renderer.setAnimationLoop(render);

async function loadRun(nextRunName: string): Promise<void> {
  if (loading) {
    return;
  }
  loading = true;
  window.__HOOPMOTION_READY = false;
  runName = nextRunName;
  runLabel.textContent = runName;
  reportList.innerHTML = "";

  const animationResponse = await fetch(`/runs/${runName}/animation.json`, { cache: "no-store" });
  if (!animationResponse.ok) {
    throw new Error(`Could not load /runs/${runName}/animation.json`);
  }
  animation = await animationResponse.json() as AnimationFile;
  report = animation.report;

  scene.remove(modelRoot);
  const loader = new GLTFLoader();
  const gltf = await loader.loadAsync(animation.modelUrl);
  modelRoot = gltf.scene;
  modelRoot.name = "HoopMotion_ModelRoot";
  scene.add(modelRoot);

  frameIndex = 0;
  timeline.max = String(Math.max(animation.frames.length - 1, 0));
  timeline.value = "0";
  playing = true;
  playPauseButton.textContent = "Pause";
  renderReport(report);
  renderCurrentFrame();
  loading = false;
  window.__HOOPMOTION_READY = true;
}

function render(): void {
  const delta = clock.getDelta();
  if (animation && playing && animation.frames.length > 0) {
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
