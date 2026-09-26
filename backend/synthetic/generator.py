"""
Synthetic storm-detection sequence generator (requirement #5, #6).

Stands in for Member 2's real detector until it is available. Produces
frames in exactly the documented input contract shape (see
docs/integration_contract.md), and also returns ground-truth trajectories
so evaluation.py can score the tracker/predictor against known-correct
answers.

Each scenario function returns:
    (frames, ground_truth)

    frames: List[Dict] - one dict per timestamp, contract-shaped
    ground_truth: Dict[str, List[Dict]] - {true_storm_id: [{"timestamp":..,
                  "latitude":.., "longitude":..}, ...]}, the noise-free path
                  each synthetic storm actually followed (independent of
                  what the tracker later calls it).
"""

import random
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Dict, List, Tuple

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))
from storm_tracking.geo import destination_point


START_TIME = datetime(2026, 6, 15, 14, 0, 0, tzinfo=timezone.utc)
BASE_LAT, BASE_LON = 17.40, 78.40  # near Hyderabad, per project context


def _ts(minutes_offset: int) -> str:
    return (START_TIME + timedelta(minutes=minutes_offset)).strftime("%Y-%m-%dT%H:%M:%SZ")


def _frame(minutes_offset: int, storms: List[Dict]) -> Dict:
    return {"timestamp": _ts(minutes_offset), "storms": storms}


def _det(det_id: str, lat: float, lon: float, **kwargs) -> Dict:
    d = {"detection_id": det_id, "latitude": round(lat, 5), "longitude": round(lon, 5)}
    d.update(kwargs)
    return d


def _move(lat: float, lon: float, bearing_deg: float, speed_kmh: float, minutes: float) -> Tuple[float, float]:
    distance_km = speed_kmh * (minutes / 60.0)
    return destination_point(lat, lon, bearing_deg, distance_km)


def _add_noise(lat: float, lon: float, noise_km: float, rng: random.Random) -> Tuple[float, float]:
    if noise_km <= 0:
        return lat, lon
    angle = rng.uniform(0, 360)
    dist = rng.uniform(0, noise_km)
    return destination_point(lat, lon, angle, dist)


# ---------------------------------------------------------------------------
# Scenario A: one storm, constant NE motion
# ---------------------------------------------------------------------------
def scenario_a_single_storm(n_frames: int = 6, interval_min: int = 5, speed_kmh: float = 30.0):
    bearing = 45.0
    lat, lon = BASE_LAT, BASE_LON
    frames, truth = [], {"true_S1": []}
    for i in range(n_frames):
        t_min = i * interval_min
        if i > 0:
            lat, lon = _move(lat, lon, bearing, speed_kmh, interval_min)
        frames.append(_frame(t_min, [_det("A_det_%03d" % i, lat, lon, confidence=0.9)]))
        truth["true_S1"].append({"timestamp": _ts(t_min), "latitude": lat, "longitude": lon})
    return frames, truth


# ---------------------------------------------------------------------------
# Scenario B: multiple independent storms
# ---------------------------------------------------------------------------
def scenario_b_multiple_storms(n_frames: int = 6, interval_min: int = 5):
    storms_def = [
        {"id": "true_S1", "lat": 17.40, "lon": 78.40, "bearing": 45, "speed": 28},
        {"id": "true_S2", "lat": 18.00, "lon": 79.20, "bearing": 200, "speed": 22},
        {"id": "true_S3", "lat": 16.80, "lon": 77.90, "bearing": 90, "speed": 35},
    ]
    frames, truth = [], {s["id"]: [] for s in storms_def}
    for i in range(n_frames):
        t_min = i * interval_min
        dets = []
        for s in storms_def:
            if i > 0:
                s["lat"], s["lon"] = _move(s["lat"], s["lon"], s["bearing"], s["speed"], interval_min)
            dets.append(_det(f"{s['id']}_det_{i:03d}", s["lat"], s["lon"], confidence=0.88))
            truth[s["id"]].append({"timestamp": _ts(t_min), "latitude": s["lat"], "longitude": s["lon"]})
        frames.append(_frame(t_min, dets))
    return frames, truth


# ---------------------------------------------------------------------------
# Scenario C: storms moving at very different speeds
# ---------------------------------------------------------------------------
def scenario_c_different_speeds(n_frames: int = 6, interval_min: int = 5):
    storms_def = [
        {"id": "true_slow", "lat": 17.40, "lon": 78.40, "bearing": 60, "speed": 8},
        {"id": "true_fast", "lat": 17.40, "lon": 78.60, "bearing": 60, "speed": 55},
    ]
    frames, truth = [], {s["id"]: [] for s in storms_def}
    for i in range(n_frames):
        t_min = i * interval_min
        dets = []
        for s in storms_def:
            if i > 0:
                s["lat"], s["lon"] = _move(s["lat"], s["lon"], s["bearing"], s["speed"], interval_min)
            dets.append(_det(f"{s['id']}_det_{i:03d}", s["lat"], s["lon"]))
            truth[s["id"]].append({"timestamp": _ts(t_min), "latitude": s["lat"], "longitude": s["lon"]})
        frames.append(_frame(t_min, dets))
    return frames, truth


# ---------------------------------------------------------------------------
# Scenario D: missing detection for one frame, then returns
# ---------------------------------------------------------------------------
def scenario_d_missing_detection(n_frames: int = 6, interval_min: int = 5, speed_kmh: float = 25.0,
                                  missing_frame_index: int = 2):
    bearing = 30.0
    lat, lon = BASE_LAT, BASE_LON
    frames, truth = [], {"true_S1": []}
    for i in range(n_frames):
        t_min = i * interval_min
        if i > 0:
            lat, lon = _move(lat, lon, bearing, speed_kmh, interval_min)
        truth["true_S1"].append({"timestamp": _ts(t_min), "latitude": lat, "longitude": lon})
        if i == missing_frame_index:
            frames.append(_frame(t_min, []))  # storm undetected this frame
        else:
            frames.append(_frame(t_min, [_det("D_det_%03d" % i, lat, lon)]))
    return frames, truth


# ---------------------------------------------------------------------------
# Scenario E: a new storm appears partway through
# ---------------------------------------------------------------------------
def scenario_e_new_storm(n_frames: int = 6, interval_min: int = 5, appear_at: int = 3):
    lat1, lon1, bearing1, speed1 = 17.40, 78.40, 45, 25
    lat2, lon2, bearing2, speed2 = 18.20, 78.10, 150, 18
    frames, truth = [], {"true_S1": [], "true_S2": []}
    for i in range(n_frames):
        t_min = i * interval_min
        if i > 0:
            lat1, lon1 = _move(lat1, lon1, bearing1, speed1, interval_min)
        truth["true_S1"].append({"timestamp": _ts(t_min), "latitude": lat1, "longitude": lon1})
        dets = [_det("E_s1_det_%03d" % i, lat1, lon1)]
        if i >= appear_at:
            if i > appear_at:
                lat2, lon2 = _move(lat2, lon2, bearing2, speed2, interval_min)
            truth["true_S2"].append({"timestamp": _ts(t_min), "latitude": lat2, "longitude": lon2})
            dets.append(_det("E_s2_det_%03d" % i, lat2, lon2))
        frames.append(_frame(t_min, dets))
    return frames, truth


# ---------------------------------------------------------------------------
# Scenario F: a storm stops being detected (dissipates) partway through
# ---------------------------------------------------------------------------
def scenario_f_storm_disappearance(n_frames: int = 6, interval_min: int = 5, disappear_at: int = 3):
    lat, lon, bearing, speed = 17.40, 78.40, 60, 30
    frames, truth = [], {"true_S1": []}
    for i in range(n_frames):
        t_min = i * interval_min
        if i > 0 and i < disappear_at:
            lat, lon = _move(lat, lon, bearing, speed, interval_min)
        if i < disappear_at:
            truth["true_S1"].append({"timestamp": _ts(t_min), "latitude": lat, "longitude": lon})
            frames.append(_frame(t_min, [_det("F_det_%03d" % i, lat, lon)]))
        else:
            frames.append(_frame(t_min, []))
    return frames, truth


# ---------------------------------------------------------------------------
# Scenario G: two storms cross paths
# ---------------------------------------------------------------------------
def scenario_g_crossing_storms(n_frames: int = 6, interval_min: int = 5):
    s1 = {"lat": 17.20, "lon": 78.20, "bearing": 45, "speed": 35}
    s2 = {"lat": 17.20, "lon": 79.00, "bearing": 135, "speed": 35}
    frames, truth = [], {"true_S1": [], "true_S2": []}
    for i in range(n_frames):
        t_min = i * interval_min
        if i > 0:
            s1["lat"], s1["lon"] = _move(s1["lat"], s1["lon"], s1["bearing"], s1["speed"], interval_min)
            s2["lat"], s2["lon"] = _move(s2["lat"], s2["lon"], s2["bearing"], s2["speed"], interval_min)
        truth["true_S1"].append({"timestamp": _ts(t_min), "latitude": s1["lat"], "longitude": s1["lon"]})
        truth["true_S2"].append({"timestamp": _ts(t_min), "latitude": s2["lat"], "longitude": s2["lon"]})
        frames.append(_frame(t_min, [
            _det("G_s1_det_%03d" % i, s1["lat"], s1["lon"]),
            _det("G_s2_det_%03d" % i, s2["lat"], s2["lon"]),
        ]))
    return frames, truth


# ---------------------------------------------------------------------------
# Scenario H: noisy detections (small location errors)
# ---------------------------------------------------------------------------
def scenario_h_noisy_detections(n_frames: int = 8, interval_min: int = 5, speed_kmh: float = 30.0,
                                 noise_km: float = 2.0, seed: int = 42):
    rng = random.Random(seed)
    bearing = 45.0
    lat, lon = BASE_LAT, BASE_LON
    frames, truth = [], {"true_S1": []}
    for i in range(n_frames):
        t_min = i * interval_min
        if i > 0:
            lat, lon = _move(lat, lon, bearing, speed_kmh, interval_min)
        truth["true_S1"].append({"timestamp": _ts(t_min), "latitude": lat, "longitude": lon})
        noisy_lat, noisy_lon = _add_noise(lat, lon, noise_km, rng)
        frames.append(_frame(t_min, [_det("H_det_%03d" % i, noisy_lat, noisy_lon)]))
    return frames, truth


# ---------------------------------------------------------------------------
# Scenario I: storm gradually changes direction
# ---------------------------------------------------------------------------
def scenario_i_changing_direction(n_frames: int = 8, interval_min: int = 5, speed_kmh: float = 25.0):
    lat, lon = BASE_LAT, BASE_LON
    frames, truth = [], {"true_S1": []}
    for i in range(n_frames):
        t_min = i * interval_min
        bearing = 30.0 + i * 15.0  # curving from NNE towards SE over time
        if i > 0:
            lat, lon = _move(lat, lon, bearing, speed_kmh, interval_min)
        truth["true_S1"].append({"timestamp": _ts(t_min), "latitude": lat, "longitude": lon})
        frames.append(_frame(t_min, [_det("I_det_%03d" % i, lat, lon)]))
    return frames, truth


# ---------------------------------------------------------------------------
# Scenario J: two cells approach and potentially merge
# ---------------------------------------------------------------------------
def scenario_j_storm_merge(n_frames: int = 6, interval_min: int = 5):
    s1 = {"lat": 17.30, "lon": 78.20, "bearing": 75, "speed": 30}
    s2 = {"lat": 17.35, "lon": 78.70, "bearing": 255, "speed": 30}
    frames, truth = [], {"true_S1": [], "true_S2": []}
    for i in range(n_frames):
        t_min = i * interval_min
        if i > 0:
            s1["lat"], s1["lon"] = _move(s1["lat"], s1["lon"], s1["bearing"], s1["speed"], interval_min)
            s2["lat"], s2["lon"] = _move(s2["lat"], s2["lon"], s2["bearing"], s2["speed"], interval_min)
        truth["true_S1"].append({"timestamp": _ts(t_min), "latitude": s1["lat"], "longitude": s1["lon"]})
        truth["true_S2"].append({"timestamp": _ts(t_min), "latitude": s2["lat"], "longitude": s2["lon"]})
        frames.append(_frame(t_min, [
            _det("J_s1_det_%03d" % i, s1["lat"], s1["lon"]),
            _det("J_s2_det_%03d" % i, s2["lat"], s2["lon"]),
        ]))
    return frames, truth


# ---------------------------------------------------------------------------
# Scenario K: one storm becomes two detections (split)
# ---------------------------------------------------------------------------
def scenario_k_storm_split(n_frames: int = 6, interval_min: int = 5, split_at: int = 3):
    lat, lon, bearing, speed = 17.40, 78.40, 45, 28
    frames, truth = [], {"true_S1": []}
    child_a = {"bearing": 20, "speed": 22}
    child_b = {"bearing": 80, "speed": 30}
    lat_a = lon_a = lat_b = lon_b = None
    for i in range(n_frames):
        t_min = i * interval_min
        if i < split_at:
            if i > 0:
                lat, lon = _move(lat, lon, bearing, speed, interval_min)
            truth["true_S1"].append({"timestamp": _ts(t_min), "latitude": lat, "longitude": lon})
            frames.append(_frame(t_min, [_det("K_det_%03d" % i, lat, lon)]))
        else:
            if lat_a is None:
                lat_a, lon_a, lat_b, lon_b = lat, lon, lat, lon
                truth["true_S1_child_a"] = []
                truth["true_S1_child_b"] = []
            else:
                lat_a, lon_a = _move(lat_a, lon_a, child_a["bearing"], child_a["speed"], interval_min)
                lat_b, lon_b = _move(lat_b, lon_b, child_b["bearing"], child_b["speed"], interval_min)
            truth["true_S1_child_a"].append({"timestamp": _ts(t_min), "latitude": lat_a, "longitude": lon_a})
            truth["true_S1_child_b"].append({"timestamp": _ts(t_min), "latitude": lat_b, "longitude": lon_b})
            frames.append(_frame(t_min, [
                _det("K_a_det_%03d" % i, lat_a, lon_a),
                _det("K_b_det_%03d" % i, lat_b, lon_b),
            ]))
    return frames, truth


ALL_SCENARIOS = {
    "A_single_storm": scenario_a_single_storm,
    "B_multiple_storms": scenario_b_multiple_storms,
    "C_different_speeds": scenario_c_different_speeds,
    "D_missing_detection": scenario_d_missing_detection,
    "E_new_storm": scenario_e_new_storm,
    "F_storm_disappearance": scenario_f_storm_disappearance,
    "G_crossing_storms": scenario_g_crossing_storms,
    "H_noisy_detections": scenario_h_noisy_detections,
    "I_changing_direction": scenario_i_changing_direction,
    "J_storm_merge": scenario_j_storm_merge,
    "K_storm_split": scenario_k_storm_split,
}
