from __future__ import annotations

import argparse
import json
import os
from datetime import datetime, timezone

import cv2
import mediapipe as mp
from mediapipe.tasks import python
from mediapipe.tasks.python import vision

from synthetic_pose import POSE_CONNECTIONS


def landmark_to_dict(landmark: object) -> dict[str, float]:
    visibility = getattr(landmark, "visibility", 1.0)
    presence = getattr(landmark, "presence", 1.0)
    return {
        "x": float(getattr(landmark, "x")),
        "y": float(getattr(landmark, "y")),
        "z": float(getattr(landmark, "z")),
        "visibility": float(visibility if visibility is not None else 1.0),
        "presence": float(presence if presence is not None else 1.0),
    }


def average_confidence(landmarks: list[dict[str, float]]) -> float:
    if not landmarks:
        return 0.0
    values = [(item.get("visibility", 1.0) + item.get("presence", 1.0)) / 2.0 for item in landmarks]
    return float(sum(values) / len(values))


def draw_pose(frame, landmarks: list[dict[str, float]] | None):
    overlay = frame.copy()
    if not landmarks:
        return overlay
    height, width = overlay.shape[:2]

    for start, end in POSE_CONNECTIONS:
        if start >= len(landmarks) or end >= len(landmarks):
            continue
        a = landmarks[start]
        b = landmarks[end]
        cv2.line(
            overlay,
            (int(a["x"] * width), int(a["y"] * height)),
            (int(b["x"] * width), int(b["y"] * height)),
            (0, 220, 255),
            3,
            cv2.LINE_AA,
        )
    for landmark in landmarks:
        cv2.circle(
            overlay,
            (int(landmark["x"] * width), int(landmark["y"] * height)),
            4,
            (40, 255, 80),
            -1,
            cv2.LINE_AA,
        )
    return overlay


def main() -> None:
    parser = argparse.ArgumentParser(description="Extract single-person pose landmarks from an MP4 with MediaPipe.")
    parser.add_argument("--input", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--screenshots", required=True)
    parser.add_argument("--model", default="models/pose_landmarker_full.task")
    parser.add_argument("--max-frames", type=int, default=None)
    parser.add_argument("--screenshot-interval", type=int, default=30)
    parser.add_argument("--min-confidence", type=float, default=0.5)
    args = parser.parse_args()

    if not os.path.exists(args.model):
        raise FileNotFoundError(f"Pose model not found: {args.model}")

    cap = cv2.VideoCapture(args.input)
    if not cap.isOpened():
        raise RuntimeError(f"Could not open input video: {args.input}")

    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH) or 0)
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT) or 0)
    original_dir = os.path.join(args.screenshots, "original")
    overlay_dir = os.path.join(args.screenshots, "overlay")
    os.makedirs(os.path.dirname(args.output), exist_ok=True)
    os.makedirs(original_dir, exist_ok=True)
    os.makedirs(overlay_dir, exist_ok=True)

    base_options = python.BaseOptions(model_asset_path=args.model)
    options = vision.PoseLandmarkerOptions(
        base_options=base_options,
        running_mode=vision.RunningMode.VIDEO,
        num_poses=1,
        min_pose_detection_confidence=args.min_confidence,
        min_pose_presence_confidence=args.min_confidence,
        min_tracking_confidence=args.min_confidence,
        output_segmentation_masks=False,
    )

    frames = []
    screenshots_saved = 0
    with vision.PoseLandmarker.create_from_options(options) as landmarker:
        frame_index = 0
        while True:
            ok, frame = cap.read()
            if not ok:
                break
            if args.max_frames is not None and frame_index >= args.max_frames:
                break

            rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
            time_ms = int(frame_index * 1000.0 / fps)
            result = landmarker.detect_for_video(image, time_ms)
            pose_landmarks = result.pose_landmarks[0] if result.pose_landmarks else []
            world_landmarks = result.pose_world_landmarks[0] if result.pose_world_landmarks else []
            landmarks = [landmark_to_dict(landmark) for landmark in pose_landmarks]
            world = [landmark_to_dict(landmark) for landmark in world_landmarks]
            detected = len(landmarks) > 0
            confidence = average_confidence(landmarks)

            frames.append(
                {
                    "index": frame_index,
                    "timeMs": time_ms,
                    "detected": detected,
                    "confidence": confidence,
                    "landmarks": landmarks if detected else [None for _ in range(33)],
                    "worldLandmarks": world if world else None,
                }
            )

            should_save = frame_index == 0 or frame_index % args.screenshot_interval == 0
            if should_save and screenshots_saved < 6:
                filename = f"frame_{frame_index:04d}.png"
                cv2.imwrite(os.path.join(original_dir, filename), frame)
                cv2.imwrite(os.path.join(overlay_dir, filename), draw_pose(frame, landmarks if detected else None))
                screenshots_saved += 1

            frame_index += 1

    cap.release()
    payload = {
        "schemaVersion": "kinerig.landmarks.v1",
        "sourceVideo": args.input,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "synthetic": False,
        "fps": fps,
        "width": width,
        "height": height,
        "totalFrames": total_frames,
        "processedFrames": len(frames),
        "frames": frames,
    }
    with open(args.output, "w", encoding="utf-8") as file:
        json.dump(payload, file, indent=2)
        file.write("\n")
    print(f"Wrote MediaPipe landmarks: {args.output}")


if __name__ == "__main__":
    main()
