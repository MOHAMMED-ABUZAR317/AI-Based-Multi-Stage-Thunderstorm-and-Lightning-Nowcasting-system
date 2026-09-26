"""Deterministic, non-operational Hyderabad demonstration scenario."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from pathlib import Path
import sys
from typing import Any

BACKEND_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_DIR / "src"))

from storm_tracking import (
    StormTracker,
    estimate_arrival_time,
    predict_trajectory,
)
from storm_tracking.geo import parse_utc

from backend.adapters.synthetic_adapter import frame_dict_to_detections


CITY = {"name": "Hyderabad", "latitude": 17.385, "longitude": 78.4867}
START_TIME = datetime(2026, 9, 26, 12, 0, tzinfo=timezone.utc)
SAFETY_NOTICE = (
    "DEMO ONLY — synthetic scenario values and unvalidated estimates. "
    "Not an operational warning service. No citizen alerts are sent."
)

STAGES = (
    {
        "phase": "baseline",
        "label": "Baseline",
        "description": "Synthetic clear baseline; no storm detection is supplied.",
        "risk_level": "LOW",
        "risk_index": 2,
        "lightning_probability": 2,
    },
    {
        "phase": "initiation",
        "label": "Storm initiation",
        "description": "A synthetic storm cell appears southwest of the city.",
        "risk_level": "LOW",
        "risk_index": 12,
        "lightning_probability": 8,
    },
    {
        "phase": "development",
        "label": "Storm development",
        "description": "A second synthetic observation allows a motion estimate.",
        "risk_level": "WATCH",
        "risk_index": 28,
        "lightning_probability": 19,
    },
    {
        "phase": "tracking",
        "label": "Storm tracking",
        "description": "The integrated tracker links another synthetic observation.",
        "risk_level": "WATCH",
        "risk_index": 43,
        "lightning_probability": 34,
    },
    {
        "phase": "risk",
        "label": "Risk assessment",
        "description": "Scenario-authored risk rises; weather and radar inputs remain unavailable.",
        "risk_level": "ELEVATED",
        "risk_index": 61,
        "lightning_probability": 52,
    },
    {
        "phase": "alert",
        "label": "Demonstration alert",
        "description": "A simulated alert is displayed locally and is not dispatched.",
        "risk_level": "HIGH",
        "risk_index": 78,
        "lightning_probability": 74,
    },
    {
        "phase": "clearance",
        "label": "Clearance",
        "description": "The synthetic detection ends; the demonstration alert is cleared.",
        "risk_level": "LOW",
        "risk_index": 9,
        "lightning_probability": 7,
    },
)

POSITIONS = (
    (17.2000, 78.1500),
    (17.2200, 78.1700),
    (17.2400, 78.1900),
    (17.2600, 78.2100),
    (17.2800, 78.2300),
)


def _frame(step: int) -> dict[str, Any]:
    timestamp = START_TIME + timedelta(minutes=5 * step)
    storms = []
    if 1 <= step <= len(POSITIONS):
        latitude, longitude = POSITIONS[step - 1]
        storms.append(
            {
                "detection_id": f"demo-{step:02d}",
                "latitude": latitude,
                "longitude": longitude,
                "confidence": 0.8,
            }
        )
    return {
        "timestamp": timestamp.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "storms": storms,
    }


def build_nowcast(step: int) -> dict[str, Any]:
    """Build one stable nowcast by replaying scenario frames from the start."""
    stage = STAGES[step]
    tracker = StormTracker()
    current_time = START_TIME

    if step:
        for frame_step in range(1, step + 1):
            frame = _frame(frame_step)
            current_time = parse_utc(frame["timestamp"])
            tracker.update(current_time, frame_dict_to_detections(frame))

    active_tracks = [
        track for track in tracker.get_all_tracks() if track.status == "active"
    ]
    tracked_storms = []
    for track in active_tracks:
        forecast = predict_trajectory(track)
        arrival = estimate_arrival_time(track, CITY["latitude"], CITY["longitude"])
        tracked_storms.append(
            {
                **track.to_dict(),
                "forecast": forecast,
                "estimated_city_arrival": arrival,
                "estimate_notice": "Unvalidated constant-motion demonstration estimate.",
            }
        )

    if not step:
        current_time = START_TIME
    alert_status = {
        "status": (
            "SIMULATED_CLEARED"
            if stage["phase"] == "clearance"
            else "SIMULATED_NOT_DISPATCHED"
            if stage["phase"] == "alert"
            else "NONE"
        ),
        "active": stage["phase"] == "alert",
        "recipient_count": 0,
        "message": (
            "Demonstration alert only. Not sent to citizens, agencies, or "
            "external alerting systems."
            if stage["phase"] == "alert"
            else "No alert has been dispatched."
        ),
    }

    return {
        "api_version": "1.0",
        "demo": True,
        "operational": False,
        "safety_notice": SAFETY_NOTICE,
        "location": CITY,
        "scenario": {
            "id": "hyderabad-deterministic-demo-v1",
            "step": step,
            "total_steps": len(STAGES),
            "phase": stage["phase"],
            "label": stage["label"],
            "description": stage["description"],
            "timestamp": current_time.strftime("%Y-%m-%dT%H:%M:%SZ"),
        },
        "members": [
            {
                "member": 1,
                "role": "Weather observations / NWP",
                "status": "UNAVAILABLE",
                "data": None,
                "note": "No current weather feed is connected.",
            },
            {
                "member": 2,
                "role": "Storm detection",
                "status": "SYNTHETIC_DEMO",
                "data": _frame(step)["storms"],
                "note": "Demo detections only; no live satellite or radar feed.",
            },
            {
                "member": 3,
                "role": "Lightning guidance",
                "status": "SIMULATED_DEMO_ONLY",
                "data": None,
                "note": (
                    "The displayed percentages are authored scenario values, "
                    "not model predictions or validated probabilities."
                ),
            },
            {
                "member": 4,
                "role": "Storm tracking",
                "status": "INTEGRATED_SYNTHETIC_INPUT",
                "data": tracked_storms,
                "note": (
                    "Member 4 tracker processes deterministic synthetic frames; "
                    "trajectory and arrival outputs are unvalidated estimates."
                ),
            },
            {
                "member": 5,
                "role": "Nowcast composition",
                "status": "DEMO_SCENARIO_ONLY",
                "data": None,
                "note": "Risk labels and indices are scenario-authored, not operational.",
            },
        ],
        "nowcast": {
            "risk": {
                "level": stage["risk_level"],
                "index": stage["risk_index"],
                "basis": "scenario-authored demonstration value",
                "valid_for_decisions": False,
            },
            "lightning": {
                "status": "SIMULATED_DEMO_ONLY",
                "probabilities_percent": {
                    "15min": stage["lightning_probability"],
                    "30min": min(stage["lightning_probability"] + 8, 95),
                    "60min": min(stage["lightning_probability"] + 16, 95),
                },
                "valid_for_decisions": False,
                "note": (
                    "Illustrative values scripted for this demo; not a "
                    "lightning-prediction model output."
                ),
            },
            "weather": {
                "status": "UNAVAILABLE",
                "values": None,
                "note": "No current meteorological observations or NWP feed connected.",
            },
            "radar": {
                "status": "UNAVAILABLE",
                "values": None,
                "note": "No live radar feed connected.",
            },
            "active_storm_count": len(tracked_storms),
        },
        "tracking": {
            "status": "DEMO_TRACKING" if tracked_storms else "NO_ACTIVE_STORM",
            "storms": tracked_storms,
            "history": [
                {
                    "timestamp": (_frame(i)["timestamp"]),
                    "latitude": position[0],
                    "longitude": position[1],
                }
                for i, position in enumerate(POSITIONS[: min(step, len(POSITIONS))], start=1)
            ],
        },
        "alert": alert_status,
    }
