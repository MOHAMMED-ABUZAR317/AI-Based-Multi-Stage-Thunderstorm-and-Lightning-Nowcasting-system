"""
Central configuration for the storm tracking module.

All tunable thresholds live here rather than being buried inside functions,
per project requirement #27. Every value is documented with its unit and
rationale so it can be re-tuned against real Member 2 data later.
"""

from dataclasses import dataclass, field
from typing import List


@dataclass
class TrackingConfig:
    # --- Matching -----------------------------------------------------
    # Maximum distance (km) a storm may plausibly move between two
    # consecutive frames. Detections farther apart than this are never
    # matched to the same track, even if nothing closer exists.
    maximum_matching_distance_km: float = 60.0

    # Hard physical sanity limit (km/h). Indian mesoscale convective storms
    # very rarely exceed this. Any implied speed above this rejects the match.
    maximum_reasonable_speed_kmh: float = 120.0

    # --- History / smoothing ------------------------------------------
    # Number of most recent observations kept per storm track.
    history_length: int = 20

    # Number of recent points used for smoothing motion (rolling window).
    smoothing_window: int = 3

    # Smoothing method: "raw", "rolling_average", "ewma", or "linear_regression"
    smoothing_method: str = "linear_regression"

    # Alpha for exponentially weighted moving average (0-1, higher = less smoothing)
    ewma_alpha: float = 0.5

    # --- Missing data ---------------------------------------------------
    # Number of consecutive frames a storm may go undetected before its
    # track is considered ended (rather than merely "missing").
    missing_frame_tolerance: int = 2

    # --- Prediction -----------------------------------------------------
    # Forecast horizons in minutes.
    prediction_horizons_min: List[int] = field(default_factory=lambda: [15, 30, 60, 180])

    # --- Merge / split heuristics ----------------------------------------
    # If two storms' predicted/observed positions come within this distance
    # (km) of each other, flag a possible merge.
    merge_distance_km: float = 15.0

    # If a single previous storm's region plausibly splits into detections
    # farther apart than this (km) in one frame, flag a possible split.
    split_distance_km: float = 15.0

    # --- Validation -------------------------------------------------------
    max_latitude: float = 90.0
    min_latitude: float = -90.0
    max_longitude: float = 180.0
    min_longitude: float = -180.0

    # --- Arrival estimation -------------------------------------------------
    # A target is considered "reached" if the predicted trajectory passes
    # within this distance (km) of the target coordinates.
    arrival_radius_km: float = 10.0

    # How far into the future (minutes) to search for closest approach.
    arrival_search_horizon_min: float = 240.0

    # Step size (minutes) used when scanning the trajectory for closest approach.
    arrival_search_step_min: float = 1.0


DEFAULT_CONFIG = TrackingConfig()
