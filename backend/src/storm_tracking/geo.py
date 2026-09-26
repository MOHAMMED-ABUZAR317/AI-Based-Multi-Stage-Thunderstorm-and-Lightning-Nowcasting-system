"""
Geodesic calculations.

Latitude/longitude are treated as points on a sphere (Earth), NOT as
ordinary Cartesian coordinates. All formulas below are standard great-circle
(haversine) formulas. No external geospatial library is required or used,
which keeps the module dependency-free and easy to audit.

Units convention (documented once here, used everywhere in this package):
    - distances: kilometres (km)
    - speeds: kilometres per hour (km/h)
    - bearings/directions: degrees, 0-360, clockwise from true North
      (i.e. the standard meteorological/navigational convention:
       0=N, 90=E, 180=S, 270=W)
    - time: minutes for horizons/durations, UTC timestamps (timezone-aware
      datetime objects) everywhere else.

Earth is modelled as a sphere of radius EARTH_RADIUS_KM. This is accurate to
within ~0.3% versus the WGS-84 ellipsoid, which is more than sufficient for
storm-scale (multi-km) tracking.
"""

import math
from datetime import datetime, timedelta
from typing import Tuple

EARTH_RADIUS_KM = 6371.0088


def haversine_distance_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Great-circle distance between two lat/lon points, in kilometres."""
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)

    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return EARTH_RADIUS_KM * c


def initial_bearing_deg(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Initial (forward) bearing from point 1 to point 2, in degrees,
    0-360 clockwise from true North.
    """
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dlambda = math.radians(lon2 - lon1)

    x = math.sin(dlambda) * math.cos(phi2)
    y = math.cos(phi1) * math.sin(phi2) - math.sin(phi1) * math.cos(phi2) * math.cos(dlambda)
    theta = math.atan2(x, y)
    return (math.degrees(theta) + 360.0) % 360.0


def bearing_to_compass(bearing_deg: float) -> str:
    """Convert a bearing in degrees to a 16-point compass direction name."""
    directions = [
        "N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE",
        "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW",
    ]
    idx = int((bearing_deg % 360) / 22.5 + 0.5) % 16
    return directions[idx]


def speed_kmh(distance_km: float, elapsed_seconds: float) -> float:
    """Average speed in km/h given a distance (km) and elapsed time (seconds)."""
    if elapsed_seconds <= 0:
        return 0.0
    hours = elapsed_seconds / 3600.0
    return distance_km / hours


def destination_point(lat: float, lon: float, bearing_deg: float, distance_km: float) -> Tuple[float, float]:
    """
    Given a start point, bearing (degrees) and distance (km), compute the
    destination lat/lon assuming great-circle travel at constant bearing.
    """
    phi1 = math.radians(lat)
    lambda1 = math.radians(lon)
    theta = math.radians(bearing_deg)
    delta = distance_km / EARTH_RADIUS_KM

    phi2 = math.asin(
        math.sin(phi1) * math.cos(delta) + math.cos(phi1) * math.sin(delta) * math.cos(theta)
    )
    lambda2 = lambda1 + math.atan2(
        math.sin(theta) * math.sin(delta) * math.cos(phi1),
        math.cos(delta) - math.sin(phi1) * math.sin(phi2),
    )

    lat2 = math.degrees(phi2)
    lon2 = (math.degrees(lambda2) + 540.0) % 360.0 - 180.0  # normalize to [-180, 180]
    return lat2, lon2


def cross_track_distance_km(
    lat1: float, lon1: float, bearing_deg: float, lat3: float, lon3: float
) -> float:
    """
    Perpendicular ("cross-track") distance in km from point 3 to the
    great-circle path that starts at point 1 heading along bearing_deg.

    Used by arrival-time estimation to judge whether a storm's trajectory
    line actually passes near a target, rather than just comparing straight
    -line distance from the storm's current position to the target.
    """
    delta_13 = haversine_distance_km(lat1, lon1, lat3, lon3) / EARTH_RADIUS_KM
    theta_13 = math.radians(initial_bearing_deg(lat1, lon1, lat3, lon3))
    theta_12 = math.radians(bearing_deg)

    d_xt = math.asin(math.sin(delta_13) * math.sin(theta_13 - theta_12)) * EARTH_RADIUS_KM
    return abs(d_xt)


def along_track_distance_km(
    lat1: float, lon1: float, bearing_deg: float, lat3: float, lon3: float
) -> float:
    """
    Distance in km, measured along the great-circle path from point 1
    (heading along bearing_deg), to the point closest to point 3.
    Negative values mean point 3's closest approach is "behind" point 1,
    i.e. the storm has already passed that point along its heading or is
    moving away from it.
    """
    delta_13 = haversine_distance_km(lat1, lon1, lat3, lon3) / EARTH_RADIUS_KM
    d_xt = cross_track_distance_km(lat1, lon1, bearing_deg, lat3, lon3) / EARTH_RADIUS_KM
    # Guard against tiny floating point errors pushing the value out of [-1, 1]
    cos_arg = max(-1.0, min(1.0, math.cos(delta_13) / math.cos(d_xt)))
    d_at = math.acos(cos_arg) * EARTH_RADIUS_KM

    # acos always returns a non-negative magnitude; determine sign by
    # checking whether point 3 lies within +/-90 degrees of the heading
    # (ahead) or beyond that (behind).
    theta_13 = initial_bearing_deg(lat1, lon1, lat3, lon3)
    angle_diff = abs((theta_13 - bearing_deg + 180.0) % 360.0 - 180.0)
    if angle_diff > 90.0:
        return -d_at
    return d_at


def parse_utc(timestamp: str) -> datetime:
    """Parse an ISO-8601 UTC timestamp string (accepts trailing 'Z') to datetime."""
    ts = timestamp.replace("Z", "+00:00")
    return datetime.fromisoformat(ts)


def format_utc(dt: datetime) -> str:
    """Format a datetime (assumed UTC) back to an ISO-8601 string with 'Z' suffix."""
    return dt.strftime("%Y-%m-%dT%H:%M:%SZ")
