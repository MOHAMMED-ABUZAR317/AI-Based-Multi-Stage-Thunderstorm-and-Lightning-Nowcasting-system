"""
Adapter: Member 2's real storm-detection output -> tracker input.

STATUS: Member 2's real output format is not available yet (see project
instructions, section 5). This file is a placeholder that assumes Member 2
will send data matching docs/integration_contract.md's input contract:

    {
      "timestamp": "2026-06-15T14:30:00Z",
      "storms": [
        {
          "detection_id": "det_001",
          "latitude": 17.45,
          "longitude": 78.45,
          "intensity": 0.82,       # optional
          "area_km2": 35.4,        # optional
          "confidence": 0.91       # optional
        }
      ]
    }

Only `timestamp`, `latitude`, and `longitude` are required; everything else
is optional and passed through if present.

WHEN MEMBER 2's REAL FORMAT IS AVAILABLE:
    Only this file should need to change (per requirement #24). Update
    `frame_dict_to_detections` below to map Member 2's actual field names
    onto storm_tracking.models.Detection. Do NOT modify src/storm_tracking/.

If Member 2's format differs materially from the contract above (e.g.
nested structures, different coordinate reference system, per-cell polygons
instead of centroids), that is a genuine integration decision that should
be raised with the project team rather than guessed at here.
"""

import sys
from pathlib import Path
from typing import Dict, List

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))

from storm_tracking.models import Detection
from storm_tracking.geo import parse_utc


def frame_dict_to_detections(frame: Dict) -> List[Detection]:
    """Identical logic to synthetic_adapter for now, since the contract is
    the same. Kept as a separate function/file so Member 2's eventual real
    format can diverge without touching the synthetic path or the tracker."""
    timestamp = parse_utc(frame["timestamp"])
    detections = []
    for s in frame.get("storms", []):
        if "latitude" not in s or "longitude" not in s:
            # Skip malformed entries rather than crashing the whole frame.
            continue
        detections.append(
            Detection(
                detection_id=s.get("detection_id", f"unknown_{len(detections)}"),
                timestamp=timestamp,
                latitude=s["latitude"],
                longitude=s["longitude"],
                intensity=s.get("intensity"),
                area_km2=s.get("area_km2"),
                confidence=s.get("confidence"),
                reflectivity=s.get("reflectivity"),
                cloud_top_temperature=s.get("cloud_top_temperature"),
                lightning_count=s.get("lightning_count"),
            )
        )
    return detections
