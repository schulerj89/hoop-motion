# HoopMotion

HoopMotion is an MVP pipeline that turns a short basketball MP4 into JSON motion data and plays it on a humanoid model in a local Three.js viewer.

Version 1 adds a Rig Builder for authoring a skeleton/retarget profile on a GLB/GLTF model:

1. Load a model in A-pose, T-pose, or a neutral stance.
2. Select a canonical joint.
3. Click the model to place a marker for that joint.
4. Auto-place a starter skeleton from model bounds.
5. Export `rig.json` or a retarget package for downstream animation work.

The app still prioritizes end-to-end proof over production animation quality:

1. Drop an MP4 into `data/input/`.
2. Run one command.
3. Generate MediaPipe body landmarks, smoothed animation JSON, validation screenshots, and a report.
4. Open the Three.js page and watch a humanoid perform the detected motion.

## Requirements

- Node.js 20+
- Python 3.10+
- A short, single-person basketball MP4

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
npx tsx scripts/runPipeline.ts --input data/input/my-jump-shot.mp4 --name my-jump-shot
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

Open [http://127.0.0.1:5173/?run=my-jump-shot](http://127.0.0.1:5173/?run=my-jump-shot).

## Build A Skeleton Profile

Start the app:

```powershell
npm run dev
```

Open [http://127.0.0.1:5173/?mode=rig](http://127.0.0.1:5173/?mode=rig).

Rig Builder supports:

- GLB/GLTF file loading.
- Model URL loading.
- Auto A/T-pose marker placement.
- Per-joint marker selection and click placement on the model.
- Transform-handle marker adjustment.
- `rig.json` import/export.
- Retarget package export.

Clicked markers define a HoopMotion retarget sidecar. They do not create skin weights for an unrigged mesh. If a character is not rigged, use Mixamo, AccuRIG, or Blender first, then use HoopMotion to author/validate the retarget profile.

## Real Pexels Samples

Download and process the committed real-footage examples:

```powershell
npm run process:pexels
```

Then open:

- [http://127.0.0.1:5173/?run=pexels-5586522](http://127.0.0.1:5173/?run=pexels-5586522)
- [http://127.0.0.1:5173/?run=pexels-5192069](http://127.0.0.1:5173/?run=pexels-5192069)

The MP4 files are downloaded from Pexels into `data/input/` and intentionally ignored by git. The generated viewer-ready `animation.json` and `report.json` files for these two runs are committed under `public/runs/`.

Record a local viewer proof video:

```powershell
npm run build
npm run record:pexels
```

## Smoke Test

The smoke path generates three small synthetic basketball clips, processes them, builds the app, and captures final viewer screenshots:

```powershell
npm run smoke
```

Synthetic fallback is only enabled for the fixture commands. Normal `npm run pipeline` uses MediaPipe and fails if pose extraction cannot run.

## Model Workflow

The MVP ships with a generated GLB segment humanoid at `public/models/hoopbot.glb`. It is intentionally simple and uses named parts that HoopMotion can place directly from pose joints.

For a production character:

1. Generate a humanoid in Meshy or Tripo.
2. If it is not rigged, auto-rig it in Mixamo.
3. Export GLB.
4. Replace `public/models/hoopbot.glb` or extend the retarget map in `src/lib/modelRig.ts`.

## Clip Guidance

Recommended testing motions:

- Jump shot
- Dribble
- Defensive slide

Use self-recorded footage or royalty-free clips from Pexels or Pixabay. Keep clips short, with one full-body player in frame and limited camera shake.

## Versioning

HoopMotion uses semantic versioning: major, minor, patch. Each release should update `package.json`, add a `CHANGELOG.md` entry, run smoke tests, capture versioned screenshots under `docs/screenshots/<version>/`, export versioned artifacts under `docs/artifacts/<version>/`, commit, tag, and push.
