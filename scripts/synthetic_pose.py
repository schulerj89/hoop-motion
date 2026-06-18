from __future__ import annotations

import math
from typing import Iterable

import cv2
import numpy as np


POSE_CONNECTIONS: tuple[tuple[int, int], ...] = (
    (0, 11),
    (0, 12),
    (11, 12),
    (11, 13),
    (13, 15),
    (12, 14),
    (14, 16),
    (11, 23),
    (12, 24),
    (23, 24),
    (23, 25),
    (25, 27),
    (27, 31),
    (24, 26),
    (26, 28),
    (28, 32),
)


def blank_landmarks() -> list[dict[str, float] | None]:
    return [None for _ in range(33)]


def confidence_landmark(x: float, y: float, z: float = 0.0, confidence: float = 0.96) -> dict[str, float]:
    return {
        "x": float(np.clip(x, 0.02, 0.98)),
        "y": float(np.clip(y, 0.02, 0.98)),
        "z": float(z),
        "visibility": confidence,
        "presence": confidence,
    }


def generate_landmarks(motion: str, frame_index: int, total_frames: int) -> list[dict[str, float] | None]:
    t = frame_index / max(total_frames - 1, 1)
    landmarks = blank_landmarks()

    lateral = 0.0
    jump = 0.0
    squat = 0.0
    arm_raise = 0.25
    dribble = 0.0

    if motion == "defensive-slide":
        lateral = math.sin(t * math.tau) * 0.12
        squat = 0.05
        arm_raise = 0.15
    elif motion == "dribble":
        lateral = math.sin(t * math.tau * 0.75) * 0.04
        dribble = (math.sin(t * math.tau * 3.0) + 1.0) * 0.5
        squat = 0.03
        arm_raise = 0.05
    else:
        takeoff = math.sin(min(max((t - 0.22) / 0.58, 0.0), 1.0) * math.pi)
        jump = takeoff * 0.16
        squat = max(0.0, 0.08 - abs(t - 0.18) * 0.4)
        arm_raise = min(1.0, max(0.0, (t - 0.18) / 0.34))

    hips_x = 0.5 + lateral
    hips_y = 0.60 + squat - jump
    shoulder_y = hips_y - 0.20
    head_y = shoulder_y - 0.12
    hip_width = 0.09
    shoulder_width = 0.16

    landmarks[23] = confidence_landmark(hips_x - hip_width / 2, hips_y)
    landmarks[24] = confidence_landmark(hips_x + hip_width / 2, hips_y)
    landmarks[11] = confidence_landmark(hips_x - shoulder_width / 2, shoulder_y)
    landmarks[12] = confidence_landmark(hips_x + shoulder_width / 2, shoulder_y)
    landmarks[0] = confidence_landmark(hips_x, head_y)

    left_knee_x = hips_x - 0.07 - lateral * 0.25
    right_knee_x = hips_x + 0.07 - lateral * 0.25
    knee_y = hips_y + 0.17 + squat * 0.4
    ankle_y = hips_y + 0.34 + squat * 0.2
    landmarks[25] = confidence_landmark(left_knee_x, knee_y)
    landmarks[26] = confidence_landmark(right_knee_x, knee_y)
    landmarks[27] = confidence_landmark(left_knee_x - 0.02, ankle_y)
    landmarks[28] = confidence_landmark(right_knee_x + 0.02, ankle_y)
    landmarks[31] = confidence_landmark(left_knee_x - 0.05, ankle_y + 0.025)
    landmarks[32] = confidence_landmark(right_knee_x + 0.05, ankle_y + 0.025)

    if motion == "dribble":
        landmarks[13] = confidence_landmark(hips_x - 0.15, shoulder_y + 0.11)
        landmarks[15] = confidence_landmark(hips_x - 0.18, shoulder_y + 0.20)
        landmarks[14] = confidence_landmark(hips_x + 0.13, shoulder_y + 0.17)
        landmarks[16] = confidence_landmark(hips_x + 0.18, shoulder_y + 0.28 + dribble * 0.18)
    elif motion == "defensive-slide":
        landmarks[13] = confidence_landmark(hips_x - 0.23, shoulder_y + 0.06)
        landmarks[15] = confidence_landmark(hips_x - 0.31, shoulder_y + 0.12)
        landmarks[14] = confidence_landmark(hips_x + 0.23, shoulder_y + 0.06)
        landmarks[16] = confidence_landmark(hips_x + 0.31, shoulder_y + 0.12)
    else:
        elbow_y = shoulder_y + 0.11 - arm_raise * 0.22
        wrist_y = shoulder_y + 0.18 - arm_raise * 0.36
        landmarks[13] = confidence_landmark(hips_x - 0.12 + arm_raise * 0.04, elbow_y)
        landmarks[15] = confidence_landmark(hips_x - 0.08 + arm_raise * 0.04, wrist_y)
        landmarks[14] = confidence_landmark(hips_x + 0.12 - arm_raise * 0.04, elbow_y)
        landmarks[16] = confidence_landmark(hips_x + 0.08 - arm_raise * 0.04, wrist_y)

    # Leave occasional gaps so interpolation is exercised by smoke tests.
    if frame_index % 29 == 0 and frame_index > 0:
        landmarks[15] = None
    if frame_index % 37 == 0 and frame_index > 0:
        landmarks[28] = None

    return landmarks


def average_confidence(landmarks: Iterable[dict[str, float] | None]) -> float:
    values = [
        (landmark.get("visibility", 1.0) + landmark.get("presence", 1.0)) / 2.0
        for landmark in landmarks
        if landmark is not None
    ]
    return float(sum(values) / len(values)) if values else 0.0


def draw_pose(frame: np.ndarray, landmarks: list[dict[str, float] | None]) -> np.ndarray:
    overlay = frame.copy()
    height, width = overlay.shape[:2]

    for start, end in POSE_CONNECTIONS:
        a = landmarks[start]
        b = landmarks[end]
        if a is None or b is None:
            continue
        cv2.line(
            overlay,
            (int(a["x"] * width), int(a["y"] * height)),
            (int(b["x"] * width), int(b["y"] * height)),
            (0, 220, 255),
            3,
            cv2.LINE_AA,
        )

    for landmark in landmarks:
        if landmark is None:
            continue
        cv2.circle(
            overlay,
            (int(landmark["x"] * width), int(landmark["y"] * height)),
            4,
            (40, 255, 80),
            -1,
            cv2.LINE_AA,
        )

    return overlay


def draw_court_frame(width: int, height: int) -> np.ndarray:
    frame = np.full((height, width, 3), (42, 80, 92), dtype=np.uint8)
    cv2.rectangle(frame, (0, int(height * 0.72)), (width, height), (39, 112, 145), -1)
    cv2.line(frame, (0, int(height * 0.72)), (width, int(height * 0.72)), (220, 235, 220), 2)
    cv2.circle(frame, (int(width * 0.5), int(height * 0.83)), int(width * 0.13), (220, 235, 220), 2)
    cv2.rectangle(
        frame,
        (int(width * 0.42), int(height * 0.72)),
        (int(width * 0.58), height),
        (220, 235, 220),
        2,
    )
    return frame


def infer_motion_from_path(path: str) -> str:
    normalized = path.lower().replace("_", "-")
    if "dribble" in normalized:
        return "dribble"
    if "defensive" in normalized or "slide" in normalized:
        return "defensive-slide"
    return "jump-shot"
