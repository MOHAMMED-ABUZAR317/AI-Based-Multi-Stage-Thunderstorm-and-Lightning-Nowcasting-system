"""
Data quality validation (requirement #18).

Validation never raises on a single bad detection; it drops/flags the bad
detection and logs a warning so one malformed record cannot crash a whole
frame or the whole pipeline (requirement #16).
"""

import logging
from datetime import datetime
from typing import List, Tuple

from .config import TrackingConfig, DEFAULT_CONFIG
from .models import Detection

logger = logging.getLogger("storm_tracking.validation")


class ValidationIssue:
    def __init__(self, detection_id: str, reason: str):
        self.detection_id = detection_id
        self.reason = reason

    def __repr__(self) -> str:
        return f"ValidationIssue(detection_id={self.detection_id!r}, reason={self.reason!r})"


def validate_detection(
    detection: Detection, config: TrackingConfig = DEFAULT_CONFIG
) -> Tuple[bool, List[str]]:
    """Return (is_valid, list_of_reasons_if_invalid)."""
    reasons = []

    if detection.latitude is None or detection.longitude is None:
        reasons.append("missing latitude/longitude")
    else:
        if not (config.min_latitude <= detection.latitude <= config.max_latitude):
            reasons.append(f"latitude {detection.latitude} out of range")
        if not (config.min_longitude <= detection.longitude <= config.max_longitude):
            reasons.append(f"longitude {detection.longitude} out of range")

    if detection.timestamp is None:
        reasons.append("missing timestamp")
    elif not isinstance(detection.timestamp, datetime):
        reasons.append("timestamp is not a datetime")

    if detection.intensity is not None and detection.intensity < 0:
        reasons.append("negative intensity")

    if detection.area_km2 is not None and detection.area_km2 < 0:
        reasons.append("negative area_km2")

    if detection.confidence is not None and not (0.0 <= detection.confidence <= 1.0):
        reasons.append("confidence out of [0, 1] range")

    return (len(reasons) == 0, reasons)


def validate_frame_detections(
    detections: List[Detection], config: TrackingConfig = DEFAULT_CONFIG
) -> Tuple[List[Detection], List[ValidationIssue]]:
    """
    Validate a list of detections belonging to one frame.

    - Drops individually invalid detections (bad lat/lon/timestamp/etc.)
    - Drops duplicate detection_ids within the frame (keeps the first)
    - Returns (valid_detections, issues) so callers can log/report issues
      without the pipeline crashing.
    """
    valid: List[Detection] = []
    issues: List[ValidationIssue] = []
    seen_ids = set()

    for det in detections:
        ok, reasons = validate_detection(det, config)
        if not ok:
            issues.append(ValidationIssue(det.detection_id, "; ".join(reasons)))
            logger.warning("Dropping invalid detection %s: %s", det.detection_id, reasons)
            continue

        if det.detection_id in seen_ids:
            issues.append(ValidationIssue(det.detection_id, "duplicate detection_id in frame"))
            logger.warning("Dropping duplicate detection_id %s in frame", det.detection_id)
            continue

        seen_ids.add(det.detection_id)
        valid.append(det)

    return valid, issues


def validate_frame_ordering(previous_timestamp, current_timestamp) -> bool:
    """
    Return True if current_timestamp comes strictly after previous_timestamp
    (or previous_timestamp is None, i.e. first frame). Detects impossible
    time ordering (requirement #18).
    """
    if previous_timestamp is None:
        return True
    return current_timestamp > previous_timestamp
