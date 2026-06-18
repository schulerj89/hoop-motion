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
import type { StockVideoCandidate } from "./lib/motionAcquisition";
import { createRetargetPackage, sanitizeRigFile } from "./lib/rigAuthoring";
import { RigBuilderScene } from "./lib/rigBuilderScene";
import { JOINT_NAMES } from "./lib/skeleton";
import type {
  AnimationFile,
  JointName,
  MotionRunIndexEntry,
  MotionRunIndexFile,
  MotionSourceMetadata,
  RigFile,
  ValidationReport
} from "./lib/types";

declare global {
  interface Window {
    __KINERIG_READY?: boolean;
    __KINERIG_LIBRARY_READY?: boolean;
    __KINERIG_RIG_READY?: boolean;
    __KINERIG_RIG_PREVIEW_READY?: boolean;
    __KINERIG_RIG_TEST_API?: {
      getMarkerPosition: (joint: JointName) => [number, number, number] | undefined;
      getModelPosition: () => [number, number, number];
      getTransformTarget: () => string;
      translateModel: (offset: [number, number, number]) => void;
    };
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
          <button id="acquireMode" type="button">Acquire</button>
          <button id="rigMode" type="button">Rig Builder</button>
        </div>
        <div class="run-picker">
          <input id="runInput" type="text" value="fixture-reach" list="runOptions" aria-label="Run name" />
          <button id="loadRun" type="button">Load</button>
          <datalist id="runOptions"></datalist>
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
        <h2>Motion Source</h2>
        <dl id="sourceList"></dl>
        <h2>Motion Library</h2>
        <div id="runLibrary" class="run-library"></div>
      </section>
      <section id="acquirePanel" class="acquire-panel" hidden>
        <h2>Acquire Motion</h2>
        <div id="acquireKeyStatus" class="key-status"></div>
        <label class="field-stack">
          <span>Provider</span>
          <select id="acquireProvider" aria-label="Stock video provider">
            <option value="pexels" selected>Pexels</option>
            <option value="pixabay">Pixabay</option>
            <option value="all">All</option>
          </select>
        </label>
        <label class="field-stack">
          <span>Search</span>
          <input id="acquireQuery" type="text" value="full body person walking" aria-label="Motion search query" />
        </label>
        <div class="split-row">
          <label class="field-stack">
            <span>Limit</span>
            <input id="acquireLimit" type="number" min="1" max="12" value="6" aria-label="Search result limit" />
          </label>
          <label class="field-stack">
            <span>Max Frames</span>
            <input id="acquireMaxFrames" type="number" min="30" max="600" value="180" aria-label="Maximum frames to process" />
          </label>
        </div>
        <label class="field-stack">
          <span>Run Name</span>
          <input id="acquireRunName" type="text" value="stock-walk" aria-label="Generated run name" />
        </label>
        <div class="rig-actions">
          <button id="searchStock" type="button" data-tooltip="Search stock video APIs using local keys. No clips are downloaded until you process a selected candidate.">Search</button>
          <button id="processStock" type="button" data-tooltip="Download the selected MP4, run pose extraction, write animation JSON, and refresh Motion Library.">Download + Process</button>
        </div>
        <div id="acquireStatus" class="rig-model-transform">Ready</div>
        <div id="candidateList" class="candidate-list"></div>
        <div class="rig-actions">
          <button id="openProcessedMotion" type="button" disabled>Open Motion</button>
          <button id="previewProcessedRig" type="button" disabled>Preview In Rig</button>
        </div>
      </section>
      <section id="rigPanel" class="rig-panel" hidden>
        <h2>Rig Builder</h2>
        <div class="rig-row">
          <input id="rigModelUrl" type="text" value="/models/posebot.glb" aria-label="Model URL" />
          <button id="loadRigModel" type="button" data-tooltip="Load the GLB or GLTF URL into the Rig Builder.">Load</button>
        </div>
        <label class="file-button" data-tooltip="Import a local GLB or GLTF file from this computer.">
          <span>GLB File</span>
          <input id="rigModelFile" type="file" accept=".glb,.gltf,model/gltf-binary,model/gltf+json" />
        </label>
        <div class="rig-transform-target">
          <button id="moveModel" type="button" data-tooltip="Attach the transform gizmo to the whole model. Use this to position, rotate, or scale an imported character.">Move Model</button>
          <button id="placeJoints" type="button" data-tooltip="Attach the workflow to skeleton dots. Click the model to place the selected joint marker.">Place Joints</button>
        </div>
        <select id="transformMode" aria-label="Transform mode" data-tooltip="Choose whether the gizmo translates, rotates, or scales the selected target.">
          <option value="translate" selected>Translate</option>
          <option value="rotate">Rotate</option>
          <option value="scale">Scale</option>
        </select>
        <div class="rig-row">
          <input id="rigPreviewRun" type="text" value="fixture-reach" list="runOptions" aria-label="Motion run" />
          <button id="previewRigMotion" type="button" data-tooltip="Load a motion run and animate the authored skeleton overlay on this model. This previews retarget fit; mesh deformation still requires a skinned GLB.">Preview Motion</button>
        </div>
        <div id="rigPreviewLabel" class="rig-model-transform">No motion preview loaded</div>
        <div class="rig-actions">
          <button id="autoRig" type="button" data-tooltip="Fill missing joint dots from the model bounds. Clicked or imported dots stay where you placed them.">Auto A/T</button>
          <button id="exportRig" type="button" data-tooltip="Download the current skeleton marker profile as rig JSON.">Export Rig</button>
          <button id="exportPackage" type="button" data-tooltip="Download the rig plus loaded animation data as a retarget package JSON.">Export Package</button>
        </div>
        <label class="file-button" data-tooltip="Load an existing rig JSON profile and show its markers on this model.">
          <span>Import Rig</span>
          <input id="importRig" type="file" accept="application/json,.json" />
        </label>
        <div class="rig-status">
          <span id="selectedJointLabel">Hips</span>
          <span id="rigCountLabel">0 / 18</span>
        </div>
        <div id="modelTransformLabel" class="rig-model-transform">Model X 0.00 Y 0.00 Z 0.00</div>
        <div id="jointButtons" class="joint-grid"></div>
      </section>
    </aside>
  </main>
`;

const stage = document.querySelector<HTMLDivElement>("#stage")!;
const motionModeButton = document.querySelector<HTMLButtonElement>("#motionMode")!;
const acquireModeButton = document.querySelector<HTMLButtonElement>("#acquireMode")!;
const rigModeButton = document.querySelector<HTMLButtonElement>("#rigMode")!;
const runInput = document.querySelector<HTMLInputElement>("#runInput")!;
const runOptions = document.querySelector<HTMLDataListElement>("#runOptions")!;
const runLabel = document.querySelector<HTMLParagraphElement>("#runLabel")!;
const loadRunButton = document.querySelector<HTMLButtonElement>("#loadRun")!;
const playPauseButton = document.querySelector<HTMLButtonElement>("#playPause")!;
const resetButton = document.querySelector<HTMLButtonElement>("#reset")!;
const debugInput = document.querySelector<HTMLInputElement>("#debug")!;
const speedSelect = document.querySelector<HTMLSelectElement>("#speed")!;
const timeline = document.querySelector<HTMLInputElement>("#timeline")!;
const timeLabel = document.querySelector<HTMLSpanElement>("#timeLabel")!;
const reportList = document.querySelector<HTMLElement>("#reportList")!;
const sourceList = document.querySelector<HTMLElement>("#sourceList")!;
const runLibrary = document.querySelector<HTMLDivElement>("#runLibrary")!;
const motionPanel = document.querySelector<HTMLElement>("#motionPanel")!;
const acquirePanel = document.querySelector<HTMLElement>("#acquirePanel")!;
const rigPanel = document.querySelector<HTMLElement>("#rigPanel")!;
const acquireKeyStatus = document.querySelector<HTMLDivElement>("#acquireKeyStatus")!;
const acquireProvider = document.querySelector<HTMLSelectElement>("#acquireProvider")!;
const acquireQuery = document.querySelector<HTMLInputElement>("#acquireQuery")!;
const acquireLimit = document.querySelector<HTMLInputElement>("#acquireLimit")!;
const acquireMaxFrames = document.querySelector<HTMLInputElement>("#acquireMaxFrames")!;
const acquireRunName = document.querySelector<HTMLInputElement>("#acquireRunName")!;
const searchStockButton = document.querySelector<HTMLButtonElement>("#searchStock")!;
const processStockButton = document.querySelector<HTMLButtonElement>("#processStock")!;
const acquireStatus = document.querySelector<HTMLDivElement>("#acquireStatus")!;
const candidateList = document.querySelector<HTMLDivElement>("#candidateList")!;
const openProcessedMotionButton = document.querySelector<HTMLButtonElement>("#openProcessedMotion")!;
const previewProcessedRigButton = document.querySelector<HTMLButtonElement>("#previewProcessedRig")!;
const rigModelUrl = document.querySelector<HTMLInputElement>("#rigModelUrl")!;
const loadRigModelButton = document.querySelector<HTMLButtonElement>("#loadRigModel")!;
const rigModelFile = document.querySelector<HTMLInputElement>("#rigModelFile")!;
const moveModelButton = document.querySelector<HTMLButtonElement>("#moveModel")!;
const placeJointsButton = document.querySelector<HTMLButtonElement>("#placeJoints")!;
const transformModeSelect = document.querySelector<HTMLSelectElement>("#transformMode")!;
const rigPreviewRunInput = document.querySelector<HTMLInputElement>("#rigPreviewRun")!;
const previewRigMotionButton = document.querySelector<HTMLButtonElement>("#previewRigMotion")!;
const rigPreviewLabel = document.querySelector<HTMLDivElement>("#rigPreviewLabel")!;
const autoRigButton = document.querySelector<HTMLButtonElement>("#autoRig")!;
const exportRigButton = document.querySelector<HTMLButtonElement>("#exportRig")!;
const exportPackageButton = document.querySelector<HTMLButtonElement>("#exportPackage")!;
const importRigInput = document.querySelector<HTMLInputElement>("#importRig")!;
const selectedJointLabel = document.querySelector<HTMLSpanElement>("#selectedJointLabel")!;
const rigCountLabel = document.querySelector<HTMLSpanElement>("#rigCountLabel")!;
const modelTransformLabel = document.querySelector<HTMLDivElement>("#modelTransformLabel")!;
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
type AppMode = "motion" | "acquire" | "rig";
const requestedMode = new URLSearchParams(window.location.search).get("mode");
let mode: AppMode = requestedMode === "rig" || requestedMode === "acquire" ? requestedMode : "motion";
let animation: AnimationFile | undefined;
let rigPreviewAnimation: AnimationFile | undefined;
let report: ValidationReport | undefined;
let runIndex: MotionRunIndexFile | undefined;
let candidates: StockVideoCandidate[] = [];
let selectedCandidateIndex = 0;
let processedRunName: string | undefined;
let frameIndex = 0;
let playing = true;
let runName = new URLSearchParams(window.location.search).get("run") ?? "fixture-reach";
let loading = false;
const rigBuilder = new RigBuilderScene(scene, camera, renderer, stage, updateRigPanel);
window.__KINERIG_RIG_TEST_API = {
  getMarkerPosition: (joint) => rigBuilder.getMarkerPosition(joint),
  getModelPosition: () => rigBuilder.getModelPosition(),
  getTransformTarget: () => rigBuilder.getTransformTarget(),
  translateModel: (offset) => {
    rigBuilder.translateModel(offset);
    renderCurrentRigFrame();
  }
};

runInput.value = runName;
renderJointButtons();
loadRunIndex().catch(() => {
  runLibrary.innerHTML = `<p class="muted">No run index found</p>`;
});
loadAcquireStatus().catch(showError);
setMode(mode);
if (mode === "rig") {
  loadRigAuthoringModel(rigModelUrl.value).catch(showError);
} else if (mode === "motion") {
  loadRun(runName).catch(showError);
}

motionModeButton.addEventListener("click", () => setMode("motion"));
acquireModeButton.addEventListener("click", () => setMode("acquire"));
rigModeButton.addEventListener("click", () => {
  setMode("rig");
  if (!rigBuilder.getPlacedCount()) {
    loadRigAuthoringModel(rigModelUrl.value).catch(showError);
  }
});

searchStockButton.addEventListener("click", () => {
  searchStockVideos().catch(showError);
});

processStockButton.addEventListener("click", () => {
  processSelectedCandidate().catch(showError);
});

openProcessedMotionButton.addEventListener("click", () => {
  if (!processedRunName) {
    return;
  }
  runInput.value = processedRunName;
  setMode("motion");
  loadRun(processedRunName).catch(showError);
});

previewProcessedRigButton.addEventListener("click", () => {
  if (!processedRunName) {
    return;
  }
  rigPreviewRunInput.value = processedRunName;
  setMode("rig");
  loadRigPreviewRun(processedRunName, true).catch(showError);
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
  if (mode === "rig") {
    renderCurrentRigFrame();
  } else {
    renderCurrentFrame();
  }
});

timeline.addEventListener("input", () => {
  frameIndex = Number(timeline.value);
  playing = false;
  playPauseButton.textContent = "Play";
  if (mode === "rig") {
    renderCurrentRigFrame();
  } else {
    renderCurrentFrame();
  }
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
  window.__KINERIG_RIG_READY = false;
  rigBuilder.loadModelFromFile(file)
    .then(() => {
      rigModelUrl.value = file.name;
      window.__KINERIG_RIG_READY = true;
      updateRigPanel(rigBuilder.getRig());
      renderCurrentRigFrame();
    })
    .catch(showError);
});

moveModelButton.addEventListener("click", () => {
  markRigPreviewStopped("Motion preview stopped after switching to model transform.");
  rigBuilder.selectModel();
  updateRigPanel(rigBuilder.getRig());
  renderCurrentRigFrame();
});

placeJointsButton.addEventListener("click", () => {
  markRigPreviewStopped("Motion preview stopped for joint editing.");
  rigBuilder.selectJointTarget();
  updateRigPanel(rigBuilder.getRig());
  renderCurrentRigFrame();
});

transformModeSelect.addEventListener("change", () => {
  rigBuilder.setTransformMode(transformModeSelect.value as "translate" | "rotate" | "scale");
  updateRigPanel(rigBuilder.getRig());
});

previewRigMotionButton.addEventListener("click", () => {
  const nextRun = rigPreviewRunInput.value.trim() || "fixture-reach";
  setMode("rig");
  loadRigPreviewRun(nextRun, true).catch(showError);
});

autoRigButton.addEventListener("click", () => {
  markRigPreviewStopped("Motion preview reset after auto-fill.");
  rigBuilder.autoRig();
  renderCurrentRigFrame();
});

exportRigButton.addEventListener("click", () => {
  downloadJson(`${rigBuilder.getRig().name}.json`, rigBuilder.getRig());
});

exportPackageButton.addEventListener("click", () => {
  downloadJson(
    `${rigBuilder.getRig().name}-retarget-package.json`,
    createRetargetPackage(rigBuilder.getRig(), rigPreviewAnimation ?? animation)
  );
});

importRigInput.addEventListener("change", () => {
  const file = importRigInput.files?.[0];
  if (!file) {
    return;
  }
  file.text()
    .then((text) => {
      markRigPreviewStopped("Motion preview reset after rig import.");
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
  sourceList.innerHTML = "";

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
  renderSource(runName, report).catch(showError);
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
  clearRigPreview("No motion preview loaded");
  rigBuilder.setVisible(true);
  updateRigPanel(rigBuilder.getRig());
  renderCurrentRigFrame();
  loading = false;
  window.__KINERIG_RIG_READY = true;
}

async function loadRigPreviewRun(nextRunName: string, shouldPlay: boolean): Promise<void> {
  window.__KINERIG_RIG_PREVIEW_READY = false;
  rigPreviewLabel.textContent = `Loading ${nextRunName}`;
  if (window.__KINERIG_RIG_READY !== true) {
    await loadRigAuthoringModel(rigModelUrl.value);
  }

  const animationResponse = await fetch(`/runs/${nextRunName}/animation.json`, { cache: "no-store" });
  if (!animationResponse.ok) {
    throw new Error(`Could not load /runs/${nextRunName}/animation.json`);
  }

  rigPreviewAnimation = await animationResponse.json() as AnimationFile;
  if (rigBuilder.getPlacedCount() < JOINT_NAMES.length) {
    rigBuilder.autoRig();
  }
  rigBuilder.setPreviewAnimation(rigPreviewAnimation);

  frameIndex = 0;
  timeline.max = String(Math.max(rigPreviewAnimation.frames.length - 1, 0));
  timeline.value = "0";
  playing = shouldPlay;
  playPauseButton.textContent = shouldPlay ? "Pause" : "Play";
  rigPreviewRunInput.value = nextRunName;
  rigPreviewLabel.textContent = `Previewing ${nextRunName} on authored skeleton overlay`;
  runLabel.textContent = "Rig Builder";
  updateRigPanel(rigBuilder.getRig());
  renderCurrentRigFrame();
  window.__KINERIG_RIG_PREVIEW_READY = true;
}

async function loadRunIndex(): Promise<void> {
  window.__KINERIG_LIBRARY_READY = false;
  const response = await fetch("/runs/index.json", { cache: "no-store" });
  if (!response.ok) {
    throw new Error("No run index found");
  }
  runIndex = await response.json() as MotionRunIndexFile;
  runOptions.innerHTML = runIndex.runs
    .map((run) => `<option value="${escapeHtml(run.name)}"></option>`)
    .join("");
  renderRunLibrary(runIndex.runs);
  window.__KINERIG_LIBRARY_READY = true;
}

async function loadAcquireStatus(): Promise<void> {
  const response = await fetch("/api/acquire/status", { cache: "no-store" });
  if (!response.ok) {
    acquireKeyStatus.innerHTML = `<span class="key-pill missing">Local API unavailable</span>`;
    return;
  }
  const payload = await response.json() as {
    providers: Array<{ provider: string; configured: boolean; source?: string }>;
  };
  acquireKeyStatus.innerHTML = payload.providers
    .map((provider) => `
      <span class="key-pill ${provider.configured ? "ready" : "missing"}">
        ${escapeHtml(provider.provider)} ${provider.configured ? "ready" : "missing"}
        ${provider.source ? `<small>${escapeHtml(provider.source)}</small>` : ""}
      </span>
    `)
    .join("");
}

async function searchStockVideos(): Promise<void> {
  const query = acquireQuery.value.trim();
  if (!query) {
    acquireStatus.textContent = "Enter a search query.";
    return;
  }

  setAcquireBusy(true, `Searching ${query}`);
  const response = await fetch("/api/acquire/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query,
      provider: acquireProvider.value,
      limit: Number(acquireLimit.value)
    })
  });
  const payload = await response.json() as {
    candidates?: StockVideoCandidate[];
    warnings?: string[];
    error?: string;
  };
  if (!response.ok || payload.error) {
    throw new Error(payload.error ?? "Stock video search failed");
  }

  candidates = payload.candidates ?? [];
  selectedCandidateIndex = 0;
  processedRunName = undefined;
  openProcessedMotionButton.disabled = true;
  previewProcessedRigButton.disabled = true;
  renderCandidates(candidates);
  const warning = payload.warnings?.[0] ? ` ${payload.warnings[0]}` : "";
  setAcquireBusy(false, `Found ${candidates.length} candidates.${warning}`);
}

async function processSelectedCandidate(): Promise<void> {
  const query = acquireQuery.value.trim();
  const selected = candidates[selectedCandidateIndex];
  if (!query || !selected) {
    acquireStatus.textContent = "Search and select a candidate first.";
    return;
  }

  const runName = acquireRunName.value.trim() || `${selected.provider}-${selected.id}`;
  setAcquireBusy(true, `Processing ${runName}. This can take a minute.`);
  const response = await fetch("/api/acquire/process", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query,
      provider: acquireProvider.value,
      limit: Number(acquireLimit.value),
      candidateIndex: selectedCandidateIndex,
      runName,
      maxFrames: acquireMaxFrames.value.trim()
    })
  });
  const payload = await response.json() as {
    runName?: string;
    index?: MotionRunIndexFile;
    error?: string;
  };
  if (!response.ok || payload.error) {
    throw new Error(payload.error ?? "Stock video processing failed");
  }

  processedRunName = payload.runName ?? runName;
  if (payload.index) {
    runIndex = payload.index;
    runOptions.innerHTML = runIndex.runs
      .map((run) => `<option value="${escapeHtml(run.name)}"></option>`)
      .join("");
    renderRunLibrary(runIndex.runs);
  } else {
    await loadRunIndex();
  }
  runInput.value = processedRunName;
  rigPreviewRunInput.value = processedRunName;
  openProcessedMotionButton.disabled = false;
  previewProcessedRigButton.disabled = false;
  setAcquireBusy(false, `Processed ${processedRunName}. Open it in Motion or preview it on the rig.`);
}

function renderCandidates(nextCandidates: StockVideoCandidate[]): void {
  candidateList.innerHTML = "";
  if (nextCandidates.length === 0) {
    candidateList.innerHTML = `<p class="muted">No candidates yet. Try a more specific full-body query.</p>`;
    return;
  }

  nextCandidates.forEach((candidate, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "candidate-card";
    button.classList.toggle("active", index === selectedCandidateIndex);
    button.innerHTML = `
      ${candidate.previewImageUrl ? `<img src="${escapeHtml(candidate.previewImageUrl)}" alt="" loading="lazy" />` : ""}
      <span>
        <strong>${escapeHtml(candidate.provider)} ${escapeHtml(candidate.id)}</strong>
        <small>${formatCandidateMeta(candidate)}</small>
      </span>
    `;
    button.addEventListener("click", () => {
      selectedCandidateIndex = index;
      acquireRunName.value = `${candidate.provider}-${candidate.id}`;
      renderCandidates(candidates);
    });
    candidateList.appendChild(button);
  });
}

function setAcquireBusy(busy: boolean, label: string): void {
  searchStockButton.disabled = busy;
  processStockButton.disabled = busy;
  acquireStatus.textContent = label;
}

function render(): void {
  const delta = clock.getDelta();
  if (mode === "motion" && animation && playing && animation.frames.length > 0) {
    const speed = Number(speedSelect.value);
    const frameStep = Math.max(1, Math.round(delta * animation.fps * speed));
    frameIndex = (frameIndex + frameStep) % animation.frames.length;
    renderCurrentFrame();
  }
  if (mode === "rig" && rigPreviewAnimation && rigBuilder.hasPreviewAnimation() && playing && rigPreviewAnimation.frames.length > 0) {
    const speed = Number(speedSelect.value);
    const frameStep = Math.max(1, Math.round(delta * rigPreviewAnimation.fps * speed));
    frameIndex = (frameIndex + frameStep) % rigPreviewAnimation.frames.length;
    renderCurrentRigFrame();
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
  if (rigPreviewAnimation && rigBuilder.hasPreviewAnimation() && rigPreviewAnimation.frames.length > 0) {
    const frame = rigPreviewAnimation.frames[Math.min(frameIndex, rigPreviewAnimation.frames.length - 1)];
    rigBuilder.applyPreviewFrame(frame);
    timeline.value = String(frameIndex);
    timeLabel.textContent = `${(frame.timeMs / 1000).toFixed(2)}s`;
  }
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

async function renderSource(nextRunName: string, nextReport: ValidationReport): Promise<void> {
  const response = await fetch(`/runs/${nextRunName}/source.json`, { cache: "no-store" });
  const source = response.ok ? await response.json() as MotionSourceMetadata : undefined;
  const rows: Array<[string, string]> = [
    ["Provider", source?.provider ?? (nextReport.synthetic ? "synthetic" : "local")],
    ["License", source?.licenseUrl ? link(source.licenseName, source.licenseUrl) : source?.licenseName ?? "Local clip"],
    ["Credit", source?.attributionText ?? "Local source"],
    ["Source", source?.sourceUrl ? link("Open", source.sourceUrl) : source?.localVideoPath ?? nextReport.sourceVideo]
  ];
  sourceList.innerHTML = rows
    .map(([label, value]) => `<div><dt>${label}</dt><dd>${value}</dd></div>`)
    .join("");
}

function renderRunLibrary(runs: MotionRunIndexEntry[]): void {
  runLibrary.innerHTML = "";
  for (const run of runs) {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.run = run.name;
    button.dataset.tooltip = run.attributionText || run.sourceVideo || run.name;
    button.innerHTML = `
      <span>${escapeHtml(run.name)}</span>
      <small>${escapeHtml(run.provider)} ${formatPercent(run.detectionSuccessRate)}</small>
    `;
    button.addEventListener("click", () => {
      runInput.value = run.name;
      setMode("motion");
      loadRun(run.name).catch(showError);
    });
    runLibrary.appendChild(button);
  }
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

function setMode(nextMode: AppMode): void {
  mode = nextMode;
  const isRig = mode === "rig";
  const isAcquire = mode === "acquire";
  motionModeButton.classList.toggle("active", mode === "motion");
  acquireModeButton.classList.toggle("active", isAcquire);
  rigModeButton.classList.toggle("active", isRig);
  motionPanel.hidden = isRig || isAcquire;
  acquirePanel.hidden = !isAcquire;
  rigPanel.hidden = !isRig;
  document.body.classList.toggle("rig-mode", isRig);
  rigBuilder.setVisible(isRig);

  if (isRig) {
    window.history.replaceState(null, "", "?mode=rig");
    runLabel.textContent = "Rig Builder";
    playing = false;
    playPauseButton.textContent = "Play";
    renderCurrentRigFrame();
  } else if (isAcquire) {
    window.history.replaceState(null, "", "?mode=acquire");
    runLabel.textContent = "Acquire Motion";
    playing = false;
    playPauseButton.textContent = "Play";
    renderCurrentFrame();
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
    button.dataset.tooltip = `Select ${button.textContent} for click placement or marker adjustment.`;
    button.addEventListener("click", () => {
      rigBuilder.selectJoint(joint);
      updateRigPanel(rigBuilder.getRig());
    });
    jointButtons.appendChild(button);
  }
}

function updateRigPanel(rig: RigFile): void {
  const selectedJoint = rigBuilder.getSelectedJoint();
  const transformTarget = rigBuilder.getTransformTarget();
  selectedJointLabel.textContent = transformTarget === "model" ? "Model" : selectedJoint;
  rigCountLabel.textContent = `${rigBuilder.getPlacedCount()} / ${JOINT_NAMES.length}`;
  moveModelButton.classList.toggle("active", transformTarget === "model");
  placeJointsButton.classList.toggle("active", transformTarget === "joint");
  transformModeSelect.value = rigBuilder.getTransformMode();
  const modelPosition = rigBuilder.getModelPosition();
  modelTransformLabel.textContent = `Model X ${modelPosition[0].toFixed(2)} Y ${modelPosition[1].toFixed(2)} Z ${modelPosition[2].toFixed(2)}`;
  if (window.__KINERIG_RIG_PREVIEW_READY && !rigBuilder.hasPreviewAnimation()) {
    markRigPreviewStopped("Motion preview stopped after rig edit.");
  }
  for (const button of jointButtons.querySelectorAll<HTMLButtonElement>("button")) {
    const joint = button.dataset.joint as JointName;
    button.classList.toggle("active", joint === selectedJoint);
    button.classList.toggle("placed", Boolean(rig.joints[joint]));
  }
}

function clearRigPreview(label: string): void {
  rigBuilder.restoreRigPose();
  rigPreviewAnimation = undefined;
  window.__KINERIG_RIG_PREVIEW_READY = false;
  rigPreviewLabel.textContent = label;
}

function markRigPreviewStopped(label: string): void {
  if (!rigPreviewAnimation && !window.__KINERIG_RIG_PREVIEW_READY) {
    return;
  }
  clearRigPreview(label);
  playing = false;
  playPauseButton.textContent = "Play";
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

function formatPercent(value: number | undefined): string {
  return typeof value === "number" ? `${(value * 100).toFixed(0)}%` : "";
}

function formatCandidateMeta(candidate: StockVideoCandidate): string {
  const size = candidate.width && candidate.height ? `${candidate.width}x${candidate.height}` : "size unknown";
  const duration = candidate.durationSec ? `${candidate.durationSec}s` : "duration unknown";
  const credit = candidate.contributorName ? ` by ${candidate.contributorName}` : "";
  return `${size} ${duration}${credit}`;
}

function link(label: string, href: string): string {
  const safeHref = href.startsWith("http://") || href.startsWith("https://") ? href : "#";
  return `<a href="${escapeHtml(safeHref)}" target="_blank" rel="noreferrer">${escapeHtml(label)}</a>`;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => {
    switch (char) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case "\"":
        return "&quot;";
      case "'":
        return "&#039;";
      default:
        return char;
    }
  });
}
