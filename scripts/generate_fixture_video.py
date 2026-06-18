from __future__ import annotations

import argparse
import os

import cv2

from synthetic_pose import draw_pose, draw_studio_frame, generate_landmarks


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate small human-motion fixture clips for KineRig Studio smoke tests.")
    parser.add_argument("--motion", choices=["reach", "wave", "side-step"], required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--frames", type=int, default=90)
    parser.add_argument("--fps", type=float, default=30.0)
    parser.add_argument("--width", type=int, default=640)
    parser.add_argument("--height", type=int, default=360)
    args = parser.parse_args()

    os.makedirs(os.path.dirname(args.output), exist_ok=True)
    writer = cv2.VideoWriter(
        args.output,
        cv2.VideoWriter_fourcc(*"mp4v"),
        args.fps,
        (args.width, args.height),
    )
    if not writer.isOpened():
        raise RuntimeError(f"Could not open video writer for {args.output}")

    for frame_index in range(args.frames):
        frame = draw_studio_frame(args.width, args.height)
        landmarks = generate_landmarks(args.motion, frame_index, args.frames)
        frame = draw_pose(frame, landmarks)
        writer.write(frame)

    writer.release()
    print(f"Wrote fixture video: {args.output}")


if __name__ == "__main__":
    main()
