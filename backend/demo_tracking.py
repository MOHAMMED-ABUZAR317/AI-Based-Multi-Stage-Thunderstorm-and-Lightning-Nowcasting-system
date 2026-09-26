#!/usr/bin/env python3
"""
End-to-end demo (requirement #21).

Run with:
    python demo_tracking.py

What it does:
  1. Generates a synthetic storm scenario (Scenario A: one storm, NE motion)
  2. Runs the baseline tracker frame-by-frame, assigning a persistent ID
  3. Computes motion (speed/direction) and trajectory_confidence
  4. Predicts 15/30/60/180-minute future positions
  5. Estimates arrival time at a configurable target location
  6. Evaluates tracker/prediction accuracy against every synthetic scenario
     (ground truth is known because the data is synthetic)
  7. Generates the 5 required plots under outputs/plots/
  8. Saves full JSON results under outputs/results/
  9. Prints a concise, human-readable summary
"""

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT / "src"))
sys.path.insert(0, str(ROOT / "adapters"))
sys.path.insert(0, str(ROOT / "synthetic"))
sys.path.insert(0, str(ROOT / "evaluation"))

from storm_tracking.tracker import StormTracker
from storm_tracking.trajectory import predict_trajectory
from storm_tracking.arrival import estimate_arrival_time
from storm_tracking.geo import parse_utc, destination_point
from synthetic_adapter import frame_dict_to_detections
from generator import scenario_a_single_storm, ALL_SCENARIOS
from evaluate import evaluate_all_scenarios
from visualize import generate_all_plots

RESULTS_DIR = ROOT / "outputs" / "results"
RESULTS_DIR.mkdir(parents=True, exist_ok=True)


def run_demo_tracking():
    frames, _ = scenario_a_single_storm(n_frames=6, interval_min=5, speed_kmh=32.0)
    tracker = StormTracker()

    last_track = None
    for frame in frames:
        detections = frame_dict_to_detections(frame)
        ts = parse_utc(frame["timestamp"])
        active = tracker.update(ts, detections)
        if active:
            last_track = active[0]

    prediction = predict_trajectory(last_track)

    # Choose a target ~38 minutes ahead along the storm's own heading, so the
    # demo output is a realistic, non-trivial "reached" case rather than a
    # hard-coded location.
    latest = last_track.latest()
    target_lat, target_lon = destination_point(
        latest.smoothed_latitude, latest.smoothed_longitude,
        last_track.direction_degrees, last_track.speed_kmh * (38.0 / 60.0),
    )
    arrival = estimate_arrival_time(last_track, target_lat, target_lon)

    return last_track, prediction, arrival, (target_lat, target_lon)


def print_summary(track, prediction, arrival, target):
    latest = track.latest()
    print("=" * 40)
    print("STORM TRACKING DEMO")
    print("=" * 40)
    print()
    print(f"Storm {track.storm_id}")
    print(f"Current position: {latest.smoothed_latitude:.2f}, {latest.smoothed_longitude:.2f}")
    print(f"Speed: {track.speed_kmh:.1f} km/h")
    print(f"Direction: {track.direction_name} ({track.direction_degrees:.1f}°)")
    print(f"Confidence: {track.trajectory_confidence:.2f}")
    print()
    print("Forecast:")
    for horizon, p in prediction["predictions"].items():
        print(f"  {horizon:>6} -> {p['latitude']:.2f}, {p['longitude']:.2f}")
    print()
    print("Target:")
    print(f"  {target[0]:.2f}, {target[1]:.2f}")
    print()
    if arrival["will_reach"]:
        print("Estimated arrival:")
        print(f"  ~{arrival['minutes_until_arrival']:.0f} minutes ({arrival['estimated_arrival_time']})")
        print(f"  Closest approach: {arrival['closest_approach_km']:.1f} km")
    else:
        print(f"Target not reached by current trajectory: {arrival.get('reason')}")
    print()
    print("Tracking status:", track.status.upper())
    print()


def print_evaluation_summary(eval_results):
    print("=" * 40)
    print("EVALUATION (across all 11 synthetic scenarios)")
    print("=" * 40)
    print()
    total_switches = sum(r["id_switches"] for r in eval_results.values())
    continuities = [r["track_continuity_pct"] for r in eval_results.values()]
    print(f"Total ID switches across all scenarios: {total_switches}")
    print(f"Average track continuity: {sum(continuities) / len(continuities):.1f}%")
    print()
    a_result = eval_results["A_single_storm"]
    for horizon in ["15min", "30min", "60min"]:
        stats = a_result["position_error_by_horizon"].get(horizon, {})
        mean_km = stats.get("mean_km")
        label = f"{mean_km:.3f} km" if mean_km is not None else "n/a (scenario too short for this horizon)"
        print(f"{horizon:>6} error (Scenario A, noise-free): {label}")
    print()
    h_result = eval_results["H_noisy_detections"]
    for horizon in ["15min", "30min", "60min"]:
        stats = h_result["position_error_by_horizon"].get(horizon, {})
        mean_km = stats.get("mean_km")
        label = f"{mean_km:.3f} km" if mean_km is not None else "n/a"
        print(f"{horizon:>6} error (Scenario H, noisy):     {label}")
    print()
    print("(Full per-scenario metrics saved to outputs/results/evaluation.json)")
    print("=" * 40)


def main():
    track, prediction, arrival, target = run_demo_tracking()
    print_summary(track, prediction, arrival, target)

    print("Running evaluation across all synthetic scenarios...")
    eval_results = evaluate_all_scenarios()
    with open(RESULTS_DIR / "evaluation.json", "w") as f:
        json.dump(eval_results, f, indent=2)

    print_evaluation_summary(eval_results)

    print("Generating plots...")
    generate_all_plots()

    demo_output = {
        "storm": track.to_dict(),
        "prediction": prediction,
        "arrival_estimate": arrival,
        "target": {"latitude": target[0], "longitude": target[1]},
    }
    with open(RESULTS_DIR / "demo_output.json", "w") as f:
        json.dump(demo_output, f, indent=2)
    print(f"\nSaved JSON results to {RESULTS_DIR}")


if __name__ == "__main__":
    main()
