"""
Trajectory confidence scoring (requirement #15).

IMPORTANT: `trajectory_confidence` is a transparent, explainable HEURISTIC
score in [0, 1]. It is explicitly NOT a statistically calibrated
probability (e.g. "0.8 confidence" does not mean "correct 80% of the time
in the long run"). It has not been calibrated against a validation set of
real storm outcomes. If/when such calibration is done (e.g. isotonic
regression against observed hit-rate), this docstring and the field name
should be revisited.

The score is a weighted combination of factors that are known to correlate
with tracking/trajectory reliability:

    - observation_count_score : more history -> more reliable motion estimate
    - motion_confidence       : direction/speed stability (see motion.py)
    - recency_score           : penalises tracks with recent missing frames
    - detection_confidence    : Member 2's own detection confidence, if provided

weights = {observation_count: 0.25, motion: 0.40, recency: 0.20, detection: 0.15}

Weights are fixed constants chosen for interpretability, not fitted to data.
"""

from typing import Optional

from .config import TrackingConfig, DEFAULT_CONFIG
from .models import StormTrack

WEIGHTS = {
    "observation_count": 0.25,
    "motion": 0.40,
    "recency": 0.20,
    "detection": 0.15,
}


def compute_trajectory_confidence(
    track: StormTrack, config: TrackingConfig = DEFAULT_CONFIG
) -> Optional[float]:
    """
    Compute trajectory_confidence for a track. Returns None if the track
    has no motion estimate yet (fewer than 2 real observations) - we do not
    fabricate a confidence value for a trajectory that does not exist yet.
    """
    if track.motion_confidence is None:
        return None

    obs_count = track.observation_count()
    observation_count_score = min(1.0, obs_count / config.history_length)

    motion_score = track.motion_confidence

    recency_score = max(
        0.0, 1.0 - (track.consecutive_missing_frames / max(1, config.missing_frame_tolerance + 1))
    )

    latest = track.latest()
    detection_score = (
        latest.detection_confidence
        if latest is not None and latest.detection_confidence is not None
        else 0.75  # neutral-ish default when Member 2 supplies no confidence
    )

    score = (
        WEIGHTS["observation_count"] * observation_count_score
        + WEIGHTS["motion"] * motion_score
        + WEIGHTS["recency"] * recency_score
        + WEIGHTS["detection"] * detection_score
    )
    return round(max(0.0, min(1.0, score)), 3)
