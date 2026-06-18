# Changelog

All notable changes to KineRig Studio are tracked here using semantic versioning.

## 1.3.0 - 2026-06-18

### Added

- Added an `Acquire` screen that turns the stock-video CLI into a local UI workflow for key status, provider selection, search, candidate selection, download, processing, and handoff to Motion or Rig Builder.
- Added local Vite middleware for `/api/acquire/status`, `/api/acquire/search`, and `/api/acquire/process`, keeping Pexels and Pixabay keys server-side.
- Added support for `pexel_key.txt` and `pixabay_key.txt` credential files in the parent Projects folder, including raw-key and `KEY=value` formats.
- Added a mocked Playwright smoke test and screenshot for the acquisition workflow.

### Changed

- Bumped to `1.3.0` because motion acquisition is now part of the interactive app workflow, not only a CLI.

## 1.2.0 - 2026-06-18

### Added

- Added a royalty-free stock video acquisition workflow for searching Pexels and Pixabay, caching provider search responses, downloading a selected MP4, and optionally running the existing MediaPipe motion pipeline.
- Added `kinerig.motion-source.v1` metadata and `public/runs/index.json` so generated animations keep provider, source URL, license, attribution, and validation summary data.
- Added a Motion Library and Motion Source panel in the Three.js app so processed runs can be selected and traced before applying them to an authored rig.
- Added unit coverage for stock-video query planning and provider rendition selection.

### Changed

- Promoted the app to `1.2.0` because the workflow now covers motion acquisition plus rig-preview/export, not only local clip processing.

## 1.1.3 - 2026-06-18

### Added

- Added Rig Builder motion preview for loading a processed motion run and animating the authored skeleton overlay on the current model.
- Added a versioned Playwright smoke check that proves a rig marker moves during overlay playback and captures a `rig-builder-motion-preview.png` artifact.

### Fixed

- Kept rig export data tied to the authored rest-pose markers while motion preview temporarily animates only the visible dots and bone lines.

## 1.1.2 - 2026-06-18

### Fixed

- Changed Rig Builder `Auto A/T` so it preserves clicked and imported joint dots, then only fills missing or previous auto-generated joints.
- Added hover tooltips for Rig Builder controls to clarify model movement, joint placement, auto-fill behavior, export, and import actions.

### Added

- Patch screenshots proving the updated auto-fill tooltip and imported-model movement flow.

## 1.1.1 - 2026-06-18

### Fixed

- Added an explicit Rig Builder `Move Model` transform target so imported GLB models can be translated, rotated, or scaled directly.
- Kept placed rig markers aligned when the model root is transformed after auto-rigging or marker placement.

### Added

- Patch screenshots proving imported-model transform behavior with the recent local Downloads GLB when available.

## 1.1.0 - 2026-06-18

### Changed

- Renamed the app to KineRig Studio so the product covers general human animation instead of a sport-specific workflow.
- Replaced current default fixtures with neutral `reach`, `wave`, and `side-step` motions.
- Replaced the default sample model with neutral `posebot.glb`, removing the prop-driven sample model.
- Updated schema output names to `kinerig.*.v1` while allowing older rig sidecars to import.
- Removed hardcoded current-branch sample clip downloads and committed neutral fixture runs instead.

### Added

- Versioned `v1.1.0` screenshots and rig export artifacts using non-sport demo content.

## 1.0.0 - 2026-06-18

### Added

- Rig Builder mode for loading a GLB/GLTF model and authoring canonical skeleton markers directly on the model.
- Click-to-place joint markers, transform-handle adjustment, auto A/T-pose marker generation, rig JSON import/export, and retarget package export.
- Rig and retarget-package sidecar schemas.
- Playwright smoke coverage and screenshot/export artifacts for the rig builder flow.

### Changed

- The app is positioned as both a motion extraction viewer and a skeleton/retarget profile authoring web app.

## 0.1.1 - 2026-06-17

### Added

- Pexels sample download script for two real clips.
- Committed real-footage animation/report outputs for `pexels-5586522` and `pexels-5192069`.
- Playwright WebM recording of the local Three.js viewer playing a real-footage-derived animation on the humanoid model.
- Compact source-frame and pose-overlay proof images for real-footage validation.

## 0.1.0 - 2026-06-17

### Added

- Initial MP4-to-motion pipeline using MediaPipe Pose Landmarker for real clips and an explicit synthetic fallback for smoke fixtures.
- Landmark smoothing, missing-joint interpolation, simple humanoid skeleton animation JSON, and validation report output.
- Three.js viewer with GLTF humanoid segment model, playback controls, reset, timeline scrubber, speed control, report panel, and skeleton debug overlay.
- Synthetic motion clips for repeatable smoke testing.
- Versioned screenshot capture under `docs/screenshots/v0.1.0`.
