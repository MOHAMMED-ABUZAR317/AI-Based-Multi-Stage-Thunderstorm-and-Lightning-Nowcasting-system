"""
Motion estimation: speed, direction, and optional smoothing of noisy raw
positions (requirements #10, #11).

Smoothing never overwrites the raw observation - TrackPoint always stores
both raw_latitude/raw_longitude (what was actually detected) and
smoothed_latitude/smoothed_longitude (what the tracker estimates the true
position to be). All later stages (trajectory, arrival) work off the
smoothed position, since that is the tracker's best estimate.
"""

import math
from typing import List, Tuple

from .config import TrackingConfig, DEFAULT_CONFIG
from .geo import haversine_distance_km, initial_bearing_deg, bearing_to_compass, speed_kmh
from .models import StormTrack, TrackPoint


def smooth_position(
    history: List[TrackPoint], config: TrackingConfig = DEFAULT_CONFIG
) -> Tuple[float, float]:
    """
    Compute a smoothed (latitude, longitude) for the *latest* point in
    history, using the configured smoothing method over the trailing
    `smoothing_window` raw observations (including the latest).

    Falls back to the raw position when there isn't enough history yet.
    """
    real_points = [p for p in history if not p.is_missing]
    if not real_points:
        raise ValueError("smooth_position requires at least one real point")

    if len(real_points) == 1 or config.smoothing_method == "raw":
        latest = real_points[-1]
        return latest.raw_latitude, latest.raw_longitude

    window = real_points[-config.smoothing_window:]

    if config.smoothing_method == "rolling_average":
        lat = sum(p.raw_latitude for p in window) / len(window)
        lon = sum(p.raw_longitude for p in window) / len(window)
        return lat, lon

    if config.smoothing_method == "ewma":
        alpha = config.ewma_alpha
        lat, lon = window[0].raw_latitude, window[0].raw_longitude
        for p in window[1:]:
            lat = alpha * p.raw_latitude + (1 - alpha) * lat
            lon = alpha * p.raw_longitude + (1 - alpha) * lon
        return lat, lon

    if config.smoothing_method == "linear_regression":
        return _linear_regression_position(window)

    # Unknown method configured: fail safe to raw (never invent a fancier
    # answer than what was actually configured).
    latest = real_points[-1]
    return latest.raw_latitude, latest.raw_longitude


def _linear_regression_position(window: List[TrackPoint]) -> Tuple[float, float]:
    """
    Fit lat(t) and lon(t) each as a simple linear function of elapsed
    seconds since the window's first point, then evaluate at the window's
    last timestamp. This is a lightweight de-noising trend fit; for very
    short windows (<3 points) it behaves like straight-line interpolation.
    """
    t0 = window[0].timestamp
    xs = [(p.timestamp - t0).total_seconds() for p in window]
    lats = [p.raw_latitude for p in window]
    lons = [p.raw_longitude for p in window]

    lat_fit = _fit_line(xs, lats)
    lon_fit = _fit_line(xs, lons)

    x_last = xs[-1]
    lat_smoothed = lat_fit[0] * x_last + lat_fit[1]
    lon_smoothed = lon_fit[0] * x_last + lon_fit[1]
    return lat_smoothed, lon_smoothed


def _fit_line(xs: List[float], ys: List[float]) -> Tuple[float, float]:
    """Ordinary least squares slope/intercept for y = slope*x + intercept."""
    n = len(xs)
    mean_x = sum(xs) / n
    mean_y = sum(ys) / n
    denom = sum((x - mean_x) ** 2 for x in xs)
    if denom == 0:
        return 0.0, mean_y
    slope = sum((x - mean_x) * (y - mean_y) for x, y in zip(xs, ys)) / denom
    intercept = mean_y - slope * mean_x
    return slope, intercept


def estimate_motion(track: StormTrack, config: TrackingConfig = DEFAULT_CONFIG) -> None:
    """
    Update track.speed_kmh / direction_degrees / direction_name /
    motion_confidence in place, using the two most recent smoothed points.

    Requires >= 2 real observations; otherwise motion fields are left as
    None (an honestly "unknown" state rather than a fabricated 0).
    """
    real_points = [p for p in track.history if not p.is_missing]
    if len(real_points) < 2:
        track.speed_kmh = None
        track.direction_degrees = None
        track.direction_name = None
        track.motion_confidence = None
        return

    p_prev, p_curr = real_points[-2], real_points[-1]
    elapsed_seconds = (p_curr.timestamp - p_prev.timestamp).total_seconds()

    distance_km = haversine_distance_km(
        p_prev.smoothed_latitude, p_prev.smoothed_longitude,
        p_curr.smoothed_latitude, p_curr.smoothed_longitude,
    )
    bearing = initial_bearing_deg(
        p_prev.smoothed_latitude, p_prev.smoothed_longitude,
        p_curr.smoothed_latitude, p_curr.smoothed_longitude,
    )
    speed = speed_kmh(distance_km, elapsed_seconds)

    track.speed_kmh = round(speed, 2)
    track.direction_degrees = round(bearing, 1)
    track.direction_name = bearing_to_compass(bearing)
    track.motion_confidence = _motion_stability_confidence(real_points, config)


def _motion_stability_confidence(real_points: List[TrackPoint], config: TrackingConfig) -> float:
    """
    A simple, transparent [0, 1] score reflecting how *stable* recent motion
    has been (used as an input to the overall trajectory_confidence, see
    confidence.py). This is NOT a calibrated probability - it is a
    heuristic consistency score, documented as such.

    Factors:
      - direction stability across the last few legs (std dev of bearings)
      - speed stability across the last few legs (coefficient of variation)
    """
    window = real_points[-(config.smoothing_window + 1):]
    if len(window) < 3:
        return 0.5  # not enough legs to judge stability; neutral score

    bearings = []
    speeds = []
    for a, b in zip(window[:-1], window[1:]):
        elapsed = (b.timestamp - a.timestamp).total_seconds()
        if elapsed <= 0:
            continue
        d = haversine_distance_km(a.smoothed_latitude, a.smoothed_longitude,
                                   b.smoothed_latitude, b.smoothed_longitude)
        bearings.append(initial_bearing_deg(a.smoothed_latitude, a.smoothed_longitude,
                                             b.smoothed_latitude, b.smoothed_longitude))
        speeds.append(speed_kmh(d, elapsed))

    if len(bearings) < 2:
        return 0.5

    dir_stability = 1.0 - min(1.0, _circular_std_deg(bearings) / 90.0)

    mean_speed = sum(speeds) / len(speeds)
    if mean_speed <= 1e-6:
        speed_stability = 1.0
    else:
        speed_std = math.sqrt(sum((s - mean_speed) ** 2 for s in speeds) / len(speeds))
        cv = speed_std / mean_speed
        speed_stability = 1.0 - min(1.0, cv)

    return round(max(0.0, min(1.0, 0.5 * dir_stability + 0.5 * speed_stability)), 3)


def _circular_std_deg(bearings_deg: List[float]) -> float:
    """Circular standard deviation of a list of bearings, in degrees."""
    radians = [math.radians(b) for b in bearings_deg]
    mean_sin = sum(math.sin(r) for r in radians) / len(radians)
    mean_cos = sum(math.cos(r) for r in radians) / len(radians)
    r = math.hypot(mean_sin, mean_cos)
    r = min(1.0, max(1e-9, r))
    return math.degrees(math.sqrt(-2 * math.log(r)))
