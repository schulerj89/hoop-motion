from __future__ import annotations

import argparse
import os
import urllib.request


MODEL_URL = "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/latest/pose_landmarker_full.task"


def main() -> None:
    parser = argparse.ArgumentParser(description="Download the MediaPipe Pose Landmarker task model.")
    parser.add_argument("--output", default="models/pose_landmarker_full.task")
    args = parser.parse_args()

    if os.path.exists(args.output) and os.path.getsize(args.output) > 0:
        print(f"Pose model already exists: {args.output}")
        return

    os.makedirs(os.path.dirname(args.output), exist_ok=True)
    print(f"Downloading Pose Landmarker model to {args.output}")
    urllib.request.urlretrieve(MODEL_URL, args.output)
    print("Pose model ready")


if __name__ == "__main__":
    main()
