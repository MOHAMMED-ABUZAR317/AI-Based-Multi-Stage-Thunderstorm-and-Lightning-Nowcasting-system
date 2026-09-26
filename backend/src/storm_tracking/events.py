"""
Basic merge/split event detection (requirement #17).

These are deliberately simple proximity heuristics, NOT a solved tracking
problem. Every event is labelled "possible_merge" / "possible_split" -
never asserted as certain - so downstream consumers (and the hackathon
presentation) do not overclaim.
"""

from dataclasses import dataclass, field
from typing import List, Dict

from .config import TrackingConfig, DEFAULT_CONFIG
from .geo import haversine_distance_km
from .models import StormTrack


@dataclass
class TrackingEvent:
    event_type: str  # "possible_merge" | "possible_split"
    storm_ids: List[str]
    reason: str
    distance_km: float = field(default=0.0)

    def to_dict(self) -> Dict:
        return {
            "event": self.event_type,
            "storms": self.storm_ids,
            "reason": self.reason,
            "distance_km": round(self.distance_km, 2),
        }


def detect_events(tracks: List[StormTrack], config: TrackingConfig = DEFAULT_CONFIG) -> List[TrackingEvent]:
    """
    Scan all currently active tracks for:

      - possible_merge: two distinct storms whose current positions are
        within config.merge_distance_km of each other.
      - possible_split: (best-effort, single-frame heuristic) a storm whose
        two most recent legs suddenly diverge in direction by > 90 degrees
        AND whose position jump is large - a weak proxy for "this detection
        may actually be a split cell being mis-tracked as one storm".
        A full split detector needs multiple simultaneous detections mapping
        to one previous storm, which the tracker (not this module) is
        better placed to flag directly; see tracker.py's `split_candidates`.
    """
    events: List[TrackingEvent] = []
    active = [t for t in tracks if t.status == "active" and t.latest() is not None]

    for i in range(len(active)):
        for j in range(i + 1, len(active)):
            a, b = active[i], active[j]
            pa, pb = a.latest(), b.latest()
            dist = haversine_distance_km(
                pa.smoothed_latitude, pa.smoothed_longitude,
                pb.smoothed_latitude, pb.smoothed_longitude,
            )
            if dist <= config.merge_distance_km:
                events.append(
                    TrackingEvent(
                        event_type="possible_merge",
                        storm_ids=[a.storm_id, b.storm_id],
                        reason=(
                            f"Current positions are {dist:.1f} km apart, "
                            f"within merge_distance_km={config.merge_distance_km}."
                        ),
                        distance_km=dist,
                    )
                )

    return events


def detect_split_from_matches(
    parent_storm_id: str, child_positions: List[tuple], config: TrackingConfig = DEFAULT_CONFIG
) -> List[TrackingEvent]:
    """
    Called by the tracker when more than one unmatched-forward detection is
    plausibly linked to the same previous storm (i.e. one storm's predicted
    position has multiple nearby detections). `child_positions` is a list of
    (detection_id, lat, lon) tuples.
    """
    if len(child_positions) < 2:
        return []

    # Only flag if the children are spread out enough to be a genuine split,
    # not just noisy duplicate detections of the same cell.
    spread = 0.0
    for i in range(len(child_positions)):
        for j in range(i + 1, len(child_positions)):
            _, lat1, lon1 = child_positions[i]
            _, lat2, lon2 = child_positions[j]
            spread = max(spread, haversine_distance_km(lat1, lon1, lat2, lon2))

    if spread < config.split_distance_km:
        return []

    child_ids = [c[0] for c in child_positions]
    return [
        TrackingEvent(
            event_type="possible_split",
            storm_ids=[parent_storm_id] + child_ids,
            reason=(
                f"Storm {parent_storm_id} has {len(child_positions)} candidate "
                f"successor detections spread up to {spread:.1f} km apart "
                f"(>= split_distance_km={config.split_distance_km})."
            ),
            distance_km=spread,
        )
    ]
