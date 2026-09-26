"""
Evaluation framework (requirement #19).

Runs the tracker over a synthetic scenario (where ground truth is known by
construction) and reports actual, measured metrics - never fabricated
numbers.

Metrics:
    Position error (per horizon): mean/median/MAE km between predicted
        position at t+H and the true synthetic position at t+H, matched by
        nearest-in-time ground truth sample.
    Motion error: speed error (km/h) and direction error (degrees) between
        the tracker's motion estimate and the true instantaneous motion.
    Tracking quality: ID switches, missed tracks, false tracks, track
        continuity (% of ground-truth frames where the corresponding storm
        had an active track).

Because a synthetic storm's true identity is unknown to the tracker (it
only sees anonymous lat/lon detections), tracks are matched to ground-truth
storms by proximity at each frame - this matching is itself part of what's
being evaluated (an ID switch = the closest ground-truth truth storm
changes track_id between consecutive frames).
"""

import sys
from pathlib import Path
from statistics import mean, median
from typing import Dict, List, Optional, Tuple

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "adapters"))
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "synthetic"))

from storm_tracking.tracker import StormTracker
from storm_tracking.trajectory import predict_trajectory
from storm_tracking.geo import haversine_distance_km, parse_utc
from storm_tracking.config import TrackingConfig, DEFAULT_CONFIG
from synthetic_adapter import frame_dict_to_detections
from generator import ALL_SCENARIOS


def _closest_truth_storm(lat: float, lon: float, truth_at_time: Dict[str, Tuple[float, float]]) -> Optional[str]:
    best_id, best_dist = None, float("inf")
    for storm_id, (t_lat, t_lon) in truth_at_time.items():
        d = haversine_distance_km(lat, lon, t_lat, t_lon)
        if d < best_dist:
            best_dist, best_id = d, storm_id
    return best_id


def _truth_lookup_by_time(ground_truth: Dict[str, List[Dict]]) -> Dict[str, Dict[str, Tuple[float, float]]]:
    """{timestamp_str: {true_storm_id: (lat, lon)}}"""
    lookup: Dict[str, Dict[str, Tuple[float, float]]] = {}
    for storm_id, points in ground_truth.items():
        for p in points:
            lookup.setdefault(p["timestamp"], {})[storm_id] = (p["latitude"], p["longitude"])
    return lookup


def evaluate_scenario(scenario_name: str, config: TrackingConfig = DEFAULT_CONFIG) -> Dict:
    frames, ground_truth = ALL_SCENARIOS[scenario_name]()
    truth_by_time = _truth_lookup_by_time(ground_truth)
    truth_times_sorted = sorted(truth_by_time.keys())

    tracker = StormTracker(config)

    # track_id -> matched ground truth id per frame index, to count ID switches
    track_to_truth_history: Dict[str, List[str]] = {}
    truth_to_track_per_frame: List[Dict[str, str]] = []

    position_errors_by_horizon: Dict[str, List[float]] = {f"{h}min": [] for h in config.prediction_horizons_min}
    speed_errors = []
    direction_errors = []

    for frame in frames:
        detections = frame_dict_to_detections(frame)
        ts = parse_utc(frame["timestamp"])
        active_tracks = tracker.update(ts, detections)

        truth_now = truth_by_time.get(frame["timestamp"], {})
        frame_matches = {}
        for track in active_tracks:
            latest = track.latest()
            matched_truth = _closest_truth_storm(latest.smoothed_latitude, latest.smoothed_longitude, truth_now)
            if matched_truth:
                frame_matches[matched_truth] = track.storm_id
                track_to_truth_history.setdefault(track.storm_id, []).append(matched_truth)

            # --- motion error, if we have a motion estimate ---
            if track.speed_kmh is not None and matched_truth is not None:
                true_points = [p for p in ground_truth[matched_truth] if p["timestamp"] <= frame["timestamp"]]
                if len(true_points) >= 2:
                    a, b = true_points[-2], true_points[-1]
                    from storm_tracking.geo import initial_bearing_deg, speed_kmh as speed_fn
                    from datetime import timedelta
                    dt_seconds = (parse_utc(b["timestamp"]) - parse_utc(a["timestamp"])).total_seconds()
                    true_dist = haversine_distance_km(a["latitude"], a["longitude"], b["latitude"], b["longitude"])
                    true_speed = speed_fn(true_dist, dt_seconds)
                    true_bearing = initial_bearing_deg(a["latitude"], a["longitude"], b["latitude"], b["longitude"])
                    speed_errors.append(abs(track.speed_kmh - true_speed))
                    diff = abs((track.direction_degrees - true_bearing + 180) % 360 - 180)
                    direction_errors.append(diff)

            # --- position error at each horizon ---
            pred = predict_trajectory(track, config)
            if pred is None or matched_truth is None:
                continue
            for horizon_min in config.prediction_horizons_min:
                key = f"{horizon_min}min"
                target_time = ts.timestamp() + horizon_min * 60
                # find the ground truth point closest in time to target_time
                candidates = ground_truth[matched_truth]
                best_pt, best_dt = None, float("inf")
                for p in candidates:
                    pt_time = parse_utc(p["timestamp"]).timestamp()
                    dt = abs(pt_time - target_time)
                    if dt < best_dt:
                        best_dt, best_pt = dt, p
                # only score if a ground-truth sample exists reasonably close
                # in time (within half the frame interval band, generously 3 min)
                if best_pt is not None and best_dt <= 3 * 60:
                    pred_lat = pred["predictions"][key]["latitude"]
                    pred_lon = pred["predictions"][key]["longitude"]
                    err_km = haversine_distance_km(pred_lat, pred_lon, best_pt["latitude"], best_pt["longitude"])
                    position_errors_by_horizon[key].append(err_km)

        truth_to_track_per_frame.append(frame_matches)

    # --- ID switches: for each ground-truth storm, count how many times its
    # matched track_id changed between consecutive frames it appeared in ---
    id_switches = 0
    truth_ids = set(ground_truth.keys())
    for truth_id in truth_ids:
        seq = [fm.get(truth_id) for fm in truth_to_track_per_frame if truth_id in fm]
        for a, b in zip(seq[:-1], seq[1:]):
            if a is not None and b is not None and a != b:
                id_switches += 1

    # --- track continuity: fraction of (truth_storm, frame) pairs where a
    # track was successfully matched to that truth storm ---
    total_truth_frame_pairs = sum(len(points) for points in ground_truth.values())
    matched_pairs = sum(len(fm) for fm in truth_to_track_per_frame)
    track_continuity_pct = 100.0 * matched_pairs / total_truth_frame_pairs if total_truth_frame_pairs else 0.0

    # --- missed / false tracks (simple counts, requirement #19) ---
    all_tracks = tracker.get_all_tracks()
    matched_track_ids = {tid for fm in truth_to_track_per_frame for tid in fm.values()}
    false_tracks = sum(1 for t in all_tracks if t.storm_id not in matched_track_ids)
    missed_tracks = sum(1 for truth_id in truth_ids if not any(truth_id in fm for fm in truth_to_track_per_frame))

    def _stats(values: List[float]) -> Dict:
        if not values:
            return {"mean_km": None, "median_km": None, "mae_km": None, "n": 0}
        return {
            "mean_km": round(mean(values), 3),
            "median_km": round(median(values), 3),
            "mae_km": round(mean(abs(v) for v in values), 3),
            "n": len(values),
        }

    return {
        "scenario": scenario_name,
        "n_frames": len(frames),
        "n_ground_truth_storms": len(ground_truth),
        "n_tracks_created": len(all_tracks),
        "position_error_by_horizon": {k: _stats(v) for k, v in position_errors_by_horizon.items()},
        "speed_error_kmh": _stats(speed_errors) if speed_errors else {"mean_km": None, "n": 0},
        "direction_error_deg": (
            {"mean_deg": round(mean(direction_errors), 2), "n": len(direction_errors)}
            if direction_errors else {"mean_deg": None, "n": 0}
        ),
        "id_switches": id_switches,
        "missed_tracks": missed_tracks,
        "false_tracks": false_tracks,
        "track_continuity_pct": round(track_continuity_pct, 1),
        "tracking_events": [e.to_dict() for e in tracker.events],
    }


def evaluate_all_scenarios(config: TrackingConfig = DEFAULT_CONFIG) -> Dict[str, Dict]:
    return {name: evaluate_scenario(name, config) for name in ALL_SCENARIOS}


if __name__ == "__main__":
    import json
    results = evaluate_all_scenarios()
    print(json.dumps(results, indent=2))
