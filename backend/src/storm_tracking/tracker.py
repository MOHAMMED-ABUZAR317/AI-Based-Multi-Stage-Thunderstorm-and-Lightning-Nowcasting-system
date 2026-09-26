"""
Baseline storm tracker (requirement #8).

Algorithm (deliberately simple and explainable):

  1. For the incoming frame's detections, compute the distance from every
     active track's last known (smoothed) position to every detection.
  2. Reject any pair whose implied speed exceeds `maximum_reasonable_speed_kmh`
     or whose distance exceeds `maximum_matching_distance_km`.
  3. Greedily match remaining pairs in ascending order of distance
     (a lightweight stand-in for a full Hungarian assignment - see
     docs/member4_architecture.md "Future Upgrade Path" for when to switch
     to `scipy.optimize.linear_sum_assignment`).
  4. Unmatched detections become new storms.
  5. Unmatched (previously active) tracks are marked "missing" for up to
     `missing_frame_tolerance` frames, then "ended".
  6. If more than one detection could plausibly match the same previous
     storm (a split candidate), it is exposed via events.detect_split_from_matches
     rather than silently picking one.

This is intentionally NOT Kalman/optical-flow/ML based. See
docs/member4_architecture.md for the upgrade path.
"""

import itertools
import logging
from typing import Dict, List, Optional, Tuple

from .config import TrackingConfig, DEFAULT_CONFIG
from .events import TrackingEvent, detect_events, detect_split_from_matches
from .geo import haversine_distance_km, speed_kmh
from .models import Detection, StormTrack, TrackPoint
from .motion import estimate_motion, smooth_position
from .confidence import compute_trajectory_confidence
from .validation import validate_frame_detections, validate_frame_ordering

logger = logging.getLogger("storm_tracking.tracker")


class StormTracker:
    """Stateful tracker. Call `update(timestamp, detections)` once per frame."""

    def __init__(self, config: TrackingConfig = DEFAULT_CONFIG):
        self.config = config
        self.tracks: Dict[str, StormTrack] = {}
        self._next_id = 1
        self._last_timestamp = None
        self.events: List[TrackingEvent] = []
        # simple diagnostics for evaluation.py
        self.id_switch_count = 0
        self.false_track_count = 0

    # -- public API ---------------------------------------------------------

    def update(self, timestamp, raw_detections: List[Detection]) -> List[StormTrack]:
        """
        Process one frame. Returns the list of currently active StormTracks
        after this update. Never raises on malformed input; invalid
        detections are dropped and logged (requirements #16, #18).
        """
        if not validate_frame_ordering(self._last_timestamp, timestamp):
            logger.warning(
                "Frame timestamp %s is not after previous timestamp %s; "
                "processing anyway but this indicates disordered input.",
                timestamp, self._last_timestamp,
            )

        detections, issues = validate_frame_detections(raw_detections, self.config)
        if issues:
            logger.info("Frame %s: dropped %d invalid/duplicate detection(s).", timestamp, len(issues))

        active_tracks = [t for t in self.tracks.values() if t.status in ("active", "missing")]

        matches, unmatched_detections, unmatched_track_ids, split_groups = self._match(
            active_tracks, detections, timestamp
        )

        # Apply matches
        matched_track_ids = set()
        for track_id, det in matches.items():
            track = self.tracks[track_id]
            self._append_observation(track, det)
            track.consecutive_missing_frames = 0
            track.status = "active"
            matched_track_ids.add(track_id)

        # New storms for unmatched detections
        for det in unmatched_detections:
            new_id = self._allocate_id()
            track = StormTrack(storm_id=new_id)
            self._append_observation(track, det)
            self.tracks[new_id] = track
            logger.info("New storm track %s created at (%.4f, %.4f)", new_id, det.latitude, det.longitude)

        # Handle unmatched previously-active tracks
        for track_id in unmatched_track_ids:
            track = self.tracks[track_id]
            track.consecutive_missing_frames += 1
            if track.consecutive_missing_frames > self.config.missing_frame_tolerance:
                if track.status != "ended":
                    logger.info("Storm track %s ended after %d missing frames.",
                                track_id, track.consecutive_missing_frames)
                track.status = "ended"
            else:
                track.status = "missing"
                # Insert a gap-filled placeholder point so history stays time-ordered,
                # without pretending we observed anything (is_missing=True).
                self._append_missing_placeholder(track, timestamp)

        # Split candidates -> events
        for parent_id, children in split_groups.items():
            self.events.extend(detect_split_from_matches(parent_id, children, self.config))

        # Merge candidates -> events
        self.events.extend(detect_events(list(self.tracks.values()), self.config))

        self._last_timestamp = timestamp
        return [t for t in self.tracks.values() if t.status == "active"]

    def get_all_tracks(self) -> List[StormTrack]:
        return list(self.tracks.values())

    # -- internals ------------------------------------------------------------

    def _allocate_id(self) -> str:
        storm_id = f"S{self._next_id:02d}"
        self._next_id += 1
        return storm_id

    def _append_observation(self, track: StormTrack, det: Detection) -> None:
        point = TrackPoint(
            timestamp=det.timestamp,
            raw_latitude=det.latitude,
            raw_longitude=det.longitude,
            smoothed_latitude=det.latitude,  # placeholder, corrected below
            smoothed_longitude=det.longitude,
            detection_id=det.detection_id,
            is_missing=False,
            detection_confidence=det.confidence,
        )
        track.history.append(point)
        if len(track.history) > self.config.history_length:
            track.history = track.history[-self.config.history_length:]

        smoothed_lat, smoothed_lon = smooth_position(track.history, self.config)
        point.smoothed_latitude = smoothed_lat
        point.smoothed_longitude = smoothed_lon

        estimate_motion(track, self.config)
        track.trajectory_confidence = compute_trajectory_confidence(track, self.config)

    def _append_missing_placeholder(self, track: StormTrack, timestamp) -> None:
        latest = track.latest()
        if latest is None:
            return
        placeholder = TrackPoint(
            timestamp=timestamp,
            raw_latitude=latest.raw_latitude,
            raw_longitude=latest.raw_longitude,
            smoothed_latitude=latest.smoothed_latitude,
            smoothed_longitude=latest.smoothed_longitude,
            detection_id=None,
            is_missing=True,
        )
        track.history.append(placeholder)

    def _match(
        self, active_tracks: List[StormTrack], detections: List[Detection], timestamp
    ) -> Tuple[Dict[str, Detection], List[Detection], List[str], Dict[str, List[Tuple[str, float, float]]]]:
        """
        Greedy nearest-neighbour matching with physical plausibility checks.

        Returns:
            matches: {storm_id: Detection}
            unmatched_detections: [Detection]
            unmatched_track_ids: [storm_id]
            split_groups: {storm_id: [(detection_id, lat, lon), ...]} for
                          storms with >1 plausible successor detection
                          (the extras beyond the chosen match).
        """
        candidates = []  # (distance_km, track_id, det_index)
        plausible_by_track: Dict[str, List[Tuple[str, float, float]]] = {}

        for track in active_tracks:
            latest = track.latest()
            if latest is None:
                continue
            elapsed = (timestamp - latest.timestamp).total_seconds()
            if elapsed <= 0:
                continue

            for idx, det in enumerate(detections):
                dist = haversine_distance_km(
                    latest.smoothed_latitude, latest.smoothed_longitude, det.latitude, det.longitude
                )
                implied_speed = speed_kmh(dist, elapsed)

                if dist > self.config.maximum_matching_distance_km:
                    continue
                if implied_speed > self.config.maximum_reasonable_speed_kmh:
                    continue

                candidates.append((dist, track.storm_id, idx))
                plausible_by_track.setdefault(track.storm_id, []).append((det.detection_id, det.latitude, det.longitude))

        candidates.sort(key=lambda c: c[0])

        matches: Dict[str, Detection] = {}
        matched_det_indices = set()
        matched_track_ids = set()

        for dist, track_id, idx in candidates:
            if track_id in matched_track_ids or idx in matched_det_indices:
                continue
            matches[track_id] = detections[idx]
            matched_det_indices.add(idx)
            matched_track_ids.add(track_id)

        unmatched_detections = [d for i, d in enumerate(detections) if i not in matched_det_indices]
        unmatched_track_ids = [t.storm_id for t in active_tracks if t.storm_id not in matched_track_ids]

        # Split groups: tracks that had >1 plausible candidate detection
        # (i.e. more potential matches than the one greedily chosen).
        split_groups = {
            track_id: dets for track_id, dets in plausible_by_track.items()
            if len(dets) > 1
        }

        return matches, unmatched_detections, unmatched_track_ids, split_groups
