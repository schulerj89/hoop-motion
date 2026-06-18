# KineRig Studio

KineRig Studio is a local web app for turning short single-person MP4 clips into JSON body motion and previewing that motion on a humanoid Three.js model.

It also includes a Rig Builder for authoring skeleton/retarget profiles on GLB or GLTF characters:

1. Load a model in A-pose, T-pose, or a neutral stance.
2. Select a canonical joint.
3. Click the model to place a marker for that joint.
4. Auto-place a starter skeleton from model bounds.
5. Export `rig.json` or a retarget package for downstream animation work.

The app prioritizes end-to-end proof over production animation quality:

1. Drop an MP4 into `data/input/`.
2. Run one command.
3. Generate MediaPipe body landmarks, smoothed animation JSON, validation screenshots, and a report.
4. Open the Three.js page and watch a humanoid perform the detected motion.

## Requirements

- Node.js 20+
- Python 3.10+
- A short, single-person MP4 with the full body visible

Install JavaScript dependencies:

```powershell
npm install
```

Install Python dependencies in a project virtual environment:

```powershell
npm run python:setup
```

Download the MediaPipe Pose Landmarker model:

```powershell
npm run pose:model
```

## Run on Your Video

Put a clip in `data/input/`, then run:

```powershell
npx tsx scripts/runPipeline.ts --input data/input/my-motion.mp4 --name my-motion
```

Outputs are written to `public/runs/<name>/`:

- `raw_landmarks.json`
- `animation.json`
- `report.json`
- `screenshots/original/*.png`
- `screenshots/overlay/*.png`

Start the viewer:

```powershell
npm run dev
```

Open [http://127.0.0.1:5173/?run=my-motion](http://127.0.0.1:5173/?run=my-motion).

## Build A Skeleton Profile

Start the app:

```powershell
npm run dev
```

Open [http://127.0.0.1:5173/?mode=rig](http://127.0.0.1:5173/?mode=rig).

Rig Builder supports:

- GLB/GLTF file loading.
- Model URL loading.
- Model-root translate, rotate, and scale controls for positioning imported characters.
- Auto A/T-pose marker placement.
- Per-joint marker selection and click placement on the model.
- Transform-handle marker adjustment.
- `rig.json` import/export.
- Retarget package export.

Clicked markers define a KineRig retarget sidecar. They do not create skin weights for an unrigged mesh. If a character is not rigged, use Mixamo, AccuRIG, or Blender first, then use KineRig Studio to author and validate the retarget profile.

## Neutral Fixtures

The smoke path generates three small synthetic clips, processes them, builds the app, and captures final viewer screenshots:

```powershell
npm run smoke
```

Fixture motions:

- `fixture-reach`
- `fixture-wave`
- `fixture-side-step`

Synthetic fallback is only enabled for fixture commands. Normal `npm run pipeline` uses MediaPipe and fails if pose extraction cannot run.

Record a local viewer proof video:

```powershell
npm run build
npm run record:sample
```

## Model Workflow

The app ships with a generated GLB segment humanoid at `public/models/posebot.glb`. It is intentionally simple and uses named parts that KineRig Studio can place directly from pose joints.

For a production character:

1. Generate or import a humanoid character.
2. If it is not rigged, auto-rig it in Mixamo, AccuRIG, or Blender.
3. Export GLB.
4. Load it in Rig Builder and export a retarget profile.
5. Use that profile with generated animation JSON.

## Clip Guidance

Recommended testing motions:

- Arm reach
- Wave
- Side step
- Walk cycle
- Turn-in-place

Use self-recorded footage or royalty-free clips from Pexels or Pixabay. Keep clips short, with one full-body person in frame and limited camera shake.

## Versioning

KineRig Studio uses semantic versioning: major, minor, patch. Each release should update `package.json`, add a `CHANGELOG.md` entry, run smoke tests, capture versioned screenshots under `docs/screenshots/<version>/`, export versioned artifacts under `docs/artifacts/<version>/`, commit, tag, and push.
