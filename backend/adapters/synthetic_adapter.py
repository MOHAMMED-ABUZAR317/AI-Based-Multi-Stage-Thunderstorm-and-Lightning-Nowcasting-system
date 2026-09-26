"""
Adapter: synthetic generator output -> tracker input.

Per requirement #24, the tracking engine (src/storm_tracking/) never imports
this file or knows it exists; only the demo/evaluation scripts do. This
keeps the tracker fully decoupled from where its input comes from, so
swapping in `member2_adapter.py` later requires no tracker changes.
"""

import sys
from pathlib import Path
from typing import Dict, List

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))

from storm_tracking.models import Detection
from storm_tracking.geo import parse_utc


def frame_dict_to_detections(frame: Dict) -> List[Detection]:
    """
    Convert one synthetic-generator frame:

        {
          "timestamp": "2026-06-15T14:30:00Z",
          "storms": [ {detection_id, latitude, longitude, ...}, ... ]
        }

    into a list of Detection objects. This has the same shape as the
    documented Member 2 input contract (see docs/integration_contract.md),
    so the synthetic generator doubles as a contract test.
    """
    timestamp = parse_utc(frame["timestamp"])
    detections = []
    for s in frame["storms"]:
        detections.append(
            Detection(
                detection_id=s["detection_id"],
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
