# Changelog

All notable changes to HoopMotion are tracked here using semantic versioning.

## 0.1.0 - 2026-06-17

### Added

- Initial MP4-to-motion pipeline using MediaPipe Pose Landmarker for real clips and an explicit synthetic fallback for smoke fixtures.
- Landmark smoothing, missing-joint interpolation, simple humanoid skeleton animation JSON, and validation report output.
- Three.js viewer with GLTF humanoid segment model, playback controls, reset, timeline scrubber, speed control, report panel, and skeleton debug overlay.
- Synthetic jump shot, dribble, and defensive slide clips for repeatable smoke testing.
- Versioned screenshot capture under `docs/screenshots/v0.1.0`.
