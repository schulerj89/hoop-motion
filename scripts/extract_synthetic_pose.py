from __future__ import annotations

import argparse
import json
import os
from datetime import datetime, timezone

import cv2

from synthetic_pose import average_confidence, draw_pose, generate_landmarks, infer_motion_from_path


def main() -> None:
    parser = argparse.ArgumentParser(description="Emit synthetic landmarks for fixture videos.")
    parser.add_argument("--input", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--screenshots", required=True)
    parser.add_argument("--motion", choices=["reach", "wave", "side-step"], default=None)
    parser.add_argument("--screenshot-interval", type=int, default=30)
    args = parser.parse_args()

    cap = cv2.VideoCapture(args.input)
    if not cap.isOpened():
        raise RuntimeError(f"Could not open input video: {args.input}")

    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH) or 0)
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT) or 0)
    motion = args.motion or infer_motion_from_path(args.input)
    original_dir = os.path.join(args.screenshots, "original")
    overlay_dir = os.path.join(args.screenshots, "overlay")
    os.makedirs(os.path.dirname(args.output), exist_ok=True)
    os.makedirs(original_dir, exist_ok=True)
    os.makedirs(overlay_dir, exist_ok=True)

    frames = []
    frame_index = 0
    screenshots_saved = 0
    while True:
        ok, frame = cap.read()
        if not ok:
            break
        landmarks = generate_landmarks(motion, frame_index, max(total_frames, 1))
        confidence = average_confidence(landmarks)
        frames.append(
            {
                "index": frame_index,
                "timeMs": int(frame_index * 1000.0 / fps),
                "detected": True,
                "confidence": confidence,
                "landmarks": landmarks,
                "worldLandmarks": landmarks,
            }
        )

        should_save = frame_index == 0 or frame_index % args.screenshot_interval == 0
        if should_save and screenshots_saved < 6:
            filename = f"frame_{frame_index:04d}.png"
            cv2.imwrite(os.path.join(original_dir, filename), frame)
            cv2.imwrite(os.path.join(overlay_dir, filename), draw_pose(frame, landmarks))
            screenshots_saved += 1

        frame_index += 1

    cap.release()
    payload = {
        "schemaVersion": "kinerig.landmarks.v1",
        "sourceVideo": args.input,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "synthetic": True,
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
    print(f"Wrote synthetic landmarks: {args.output}")


if __name__ == "__main__":
    main()
