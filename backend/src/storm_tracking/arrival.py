"""
Arrival-time estimation (requirement #13, #14).

Deliberately NOT a straight-line distance / speed calculation. Instead we
consider whether the storm's predicted great-circle *trajectory* (current
position + constant bearing) passes near the target, using cross-track /
along-track geometry:

  - cross_track_distance_km : perpendicular distance from the target to the
    storm's trajectory line (its "closest approach" distance).
  - along_track_distance_km : distance along that trajectory line to the
    point of closest approach.

If the along-track distance is negative, the closest approach is *behind*
the storm's current heading (i.e. the storm is moving away from the
target's line) and we do not report an arrival, even if the raw straight
-line distance looks small.

The target is only considered "reached" if the trajectory's closest
approach falls within `arrival_radius_km` AND is not behind the current
heading.
"""

from datetime import timedelta
from typing import Dict

from .config import TrackingConfig, DEFAULT_CONFIG
from .geo import (
    along_track_distance_km,
    cross_track_distance_km,
    format_utc,
    haversine_distance_km,
)
from .models import StormTrack


def estimate_arrival_time(
    track: StormTrack, target_lat: float, target_lon: float, config: TrackingConfig = DEFAULT_CONFIG
) -> Dict:
    """
    Estimate whether/when `track`'s trajectory will bring it near
    (target_lat, target_lon).

    Returns a dict with:
        will_reach (bool)
        estimated_arrival_time (str ISO-UTC or None)
        minutes_until_arrival (float or None)
        closest_approach_km (float)
        confidence (float or None) - same as the track's trajectory_confidence
    """
    latest = track.latest()

    if latest is None or track.speed_kmh is None or track.direction_degrees is None:
        straight_km = (
            haversine_distance_km(latest.smoothed_latitude, latest.smoothed_longitude, target_lat, target_lon)
            if latest is not None else None
        )
        return {
            "storm_id": track.storm_id,
            "will_reach": False,
            "estimated_arrival_time": None,
            "minutes_until_arrival": None,
            "closest_approach_km": straight_km,
            "confidence": None,
            "reason": "Storm has no motion estimate yet (needs >= 2 observations).",
        }

    lat0, lon0 = latest.smoothed_latitude, latest.smoothed_longitude
    bearing = track.direction_degrees

    closest_km = cross_track_distance_km(lat0, lon0, bearing, target_lat, target_lon)
    along_km = along_track_distance_km(lat0, lon0, bearing, target_lat, target_lon)

    will_reach = (closest_km <= config.arrival_radius_km) and (along_km >= 0)

    result = {
        "storm_id": track.storm_id,
        "will_reach": will_reach,
        "estimated_arrival_time": None,
        "minutes_until_arrival": None,
        "closest_approach_km": round(closest_km, 2),
        "confidence": track.trajectory_confidence,
    }

    if not will_reach:
        if along_km < 0:
            result["reason"] = "Target lies behind the storm's current heading."
        else:
            result["reason"] = (
                f"Closest approach ({closest_km:.1f} km) exceeds arrival_radius_km "
                f"({config.arrival_radius_km} km)."
            )
        return result

    if track.speed_kmh <= 0:
        result["will_reach"] = False
        result["reason"] = "Storm speed estimate is zero; cannot project an arrival time."
        return result

    hours_to_closest_point = along_km / track.speed_kmh
    minutes_to_closest_point = hours_to_closest_point * 60.0

    if minutes_to_closest_point > config.arrival_search_horizon_min:
        result["will_reach"] = False
        result["reason"] = (
            f"Projected arrival ({minutes_to_closest_point:.0f} min) exceeds the "
            f"arrival_search_horizon_min ({config.arrival_search_horizon_min} min)."
        )
        return result

    arrival_time = latest.timestamp + timedelta(minutes=minutes_to_closest_point)
    result["estimated_arrival_time"] = format_utc(arrival_time)
    result["minutes_until_arrival"] = round(minutes_to_closest_point, 1)
    return result
