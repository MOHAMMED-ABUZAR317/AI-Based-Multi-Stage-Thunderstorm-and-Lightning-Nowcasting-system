"""
Trajectory prediction (requirement #12).

Given a storm's current smoothed position and its current speed/direction
estimate, extrapolate forward at configured horizons. This is a straight
-line (constant velocity, constant bearing) extrapolation - the simplest
reliable baseline. It does NOT model acceleration, turning, or storm
lifecycle (growth/decay); see docs/member4_limitations.md.

A prediction is only ever returned when the storm has a motion estimate.
If a track has fewer than 2 observations, `predict_trajectory` returns None
for the whole storm - we do not guess a direction for a storm with only one
observed point.
"""

from datetime import timedelta
from typing import Dict, Optional

from .config import TrackingConfig, DEFAULT_CONFIG
from .geo import destination_point, format_utc
from .models import StormTrack


def predict_trajectory(
    track: StormTrack, config: TrackingConfig = DEFAULT_CONFIG
) -> Optional[Dict]:
    """
    Predict this storm's position at each of config.prediction_horizons_min
    minutes into the future, assuming constant speed and bearing.

    Returns a dict:
        {
          "storm_id": ...,
          "current_position": {...},
          "motion": {...},
          "trajectory_confidence": ...,
          "predictions": {"15min": {...}, "30min": {...}, ...}
        }
    or None if the storm has no motion estimate yet.
    """
    latest = track.latest()
    if latest is None or track.speed_kmh is None or track.direction_degrees is None:
        return None

    predictions = {}
    for horizon_min in config.prediction_horizons_min:
        distance_km = track.speed_kmh * (horizon_min / 60.0)
        pred_lat, pred_lon = destination_point(
            latest.smoothed_latitude, latest.smoothed_longitude, track.direction_degrees, distance_km
        )
        pred_timestamp = latest.timestamp + timedelta(minutes=horizon_min)
        predictions[f"{horizon_min}min"] = {
            "latitude": round(pred_lat, 5),
            "longitude": round(pred_lon, 5),
            "valid_at": format_utc(pred_timestamp),
        }

    return {
        "storm_id": track.storm_id,
        "timestamp": format_utc(latest.timestamp),
        "current_position": {
            "latitude": round(latest.smoothed_latitude, 5),
            "longitude": round(latest.smoothed_longitude, 5),
        },
        "motion": {
            "speed_kmh": track.speed_kmh,
            "direction_degrees": track.direction_degrees,
            "direction": track.direction_name,
        },
        "trajectory_confidence": track.trajectory_confidence,
        "predictions": predictions,
    }
