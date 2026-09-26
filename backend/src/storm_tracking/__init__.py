"""
storm_tracking
==============

Baseline, explainable storm tracking + trajectory prediction + arrival-time
estimation module (Member 4) for the AI thunderstorm/lightning nowcasting
project.

Public entry points (see docs/integration_contract.md for full details):

    track_storms(input_data)        -> updates persistent StormTrack objects
    predict_trajectory(track)       -> forecast positions at configured horizons
    estimate_arrival(track, target) -> arrival-time estimate for a target location

Everything here is intentionally simple (nearest-neighbour matching +
geodesic motion extrapolation) so it can be explained end-to-end, and is
structured so any stage can be swapped for a more advanced method later
(see docs/member4_architecture.md, section "Future Upgrade Path").
"""

from .models import Detection, Frame, TrackPoint, StormTrack
from .config import TrackingConfig, DEFAULT_CONFIG
from .tracker import StormTracker
from .trajectory import predict_trajectory
from .arrival import estimate_arrival_time
from .confidence import compute_trajectory_confidence
from .events import detect_events

__all__ = [
    "Detection",
    "Frame",
    "TrackPoint",
    "StormTrack",
    "TrackingConfig",
    "DEFAULT_CONFIG",
    "StormTracker",
    "predict_trajectory",
    "estimate_arrival_time",
    "compute_trajectory_confidence",
    "detect_events",
]
