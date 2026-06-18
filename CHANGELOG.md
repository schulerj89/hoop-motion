# Changelog

All notable changes to HoopMotion are tracked here using semantic versioning.

## 1.0.0 - 2026-06-18

### Added

- Rig Builder mode for loading a GLB/GLTF model and authoring canonical skeleton markers directly on the model.
- Click-to-place joint markers, transform-handle adjustment, auto A/T-pose marker generation, rig JSON import/export, and retarget package export.
- `hoopmotion.rig.v1` and `hoopmotion.retarget-package.v1` sidecar schemas.
- Playwright smoke coverage and screenshot/export artifacts for the rig builder flow.

### Changed

- HoopMotion is now positioned as both a motion extraction viewer and a skeleton/retarget profile authoring web app.

## 0.1.1 - 2026-06-17

### Added

- Pexels sample download script for two real basketball clips.
- Committed real-footage animation/report outputs for `pexels-5586522` and `pexels-5192069`.
- Playwright WebM recording of the local Three.js viewer playing a real-footage-derived animation on the humanoid model.
- Compact source-frame and pose-overlay proof images for real-footage validation.

## 0.1.0 - 2026-06-17

### Added

- Initial MP4-to-motion pipeline using MediaPipe Pose Landmarker for real clips and an explicit synthetic fallback for smoke fixtures.
- Landmark smoothing, missing-joint interpolation, simple humanoid skeleton animation JSON, and validation report output.
- Three.js viewer with GLTF humanoid segment model, playback controls, reset, timeline scrubber, speed control, report panel, and skeleton debug overlay.
- Synthetic jump shot, dribble, and defensive slide clips for repeatable smoke testing.
- Versioned screenshot capture under `docs/screenshots/v0.1.0`.
