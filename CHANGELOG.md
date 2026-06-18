# Changelog

All notable changes to KineRig Studio are tracked here using semantic versioning.

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
