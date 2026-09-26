"""
Core data models.

These are the shapes that flow between adapters -> tracker -> trajectory ->
arrival -> Nowcast Engine (Member 5). Keeping them as plain dataclasses (not
tied to pandas/numpy) makes the module easy to serialize to/from JSON and
easy for other members to consume.
"""

from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional, List, Dict, Any


@dataclass
class Detection:
    """
    A single storm-cell detection at one point in time, as produced by
    Member 2 (or the synthetic generator standing in for Member 2).

    Only latitude/longitude/timestamp are required. Everything else is
    optional metadata that, when present, can sharpen confidence scoring.
    """

    detection_id: str
    timestamp: datetime
    latitude: float
    longitude: float
    intensity: Optional[float] = None
    area_km2: Optional[float] = None
    confidence: Optional[float] = None
    reflectivity: Optional[float] = None
    cloud_top_temperature: Optional[float] = None
    lightning_count: Optional[float] = None
    extra: Dict[str, Any] = field(default_factory=dict)


@dataclass
class Frame:
    """All detections observed at a single timestamp."""

    timestamp: datetime
    detections: List[Detection]


@dataclass
class TrackPoint:
    """
    One historical point in a storm's track, distinguishing the raw
    observation from any smoothed/estimated position (requirement #11 /
    #31: never silently blend "observed" and "estimated").
    """

    timestamp: datetime
    raw_latitude: float
    raw_longitude: float
    smoothed_latitude: float
    smoothed_longitude: float
    detection_id: Optional[str] = None
    is_missing: bool = False  # True if this point is a gap-filled placeholder
    detection_confidence: Optional[float] = None


@dataclass
class StormTrack:
    """
    A persistent storm identity across time, e.g. "S01". Holds full history
    plus the most recently computed motion estimate.
    """

    storm_id: str
    history: List[TrackPoint] = field(default_factory=list)

    # Most recent motion estimate (populated by motion.py). None until the
    # track has >= 2 real observations.
    speed_kmh: Optional[float] = None
    direction_degrees: Optional[float] = None
    direction_name: Optional[str] = None
    motion_confidence: Optional[float] = None
    trajectory_confidence: Optional[float] = None

    consecutive_missing_frames: int = 0
    status: str = "active"  # "active" | "missing" | "ended"

    def latest(self) -> Optional[TrackPoint]:
        real_points = [p for p in self.history if not p.is_missing]
        return real_points[-1] if real_points else None

    def observation_count(self) -> int:
        return sum(1 for p in self.history if not p.is_missing)

    def to_dict(self) -> Dict[str, Any]:
        latest = self.latest()
        return {
            "storm_id": self.storm_id,
            "status": self.status,
            "observation_count": self.observation_count(),
            "current_position": {
                "latitude": latest.smoothed_latitude,
                "longitude": latest.smoothed_longitude,
            } if latest else None,
            "raw_position": {
                "latitude": latest.raw_latitude,
                "longitude": latest.raw_longitude,
            } if latest else None,
            "motion": {
                "speed_kmh": self.speed_kmh,
                "direction_degrees": self.direction_degrees,
                "direction": self.direction_name,
            },
            "motion_confidence": self.motion_confidence,
            "trajectory_confidence": self.trajectory_confidence,
        }
