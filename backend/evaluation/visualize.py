"""
Visualization (requirement #20). Generates the 5 required plots using
matplotlib lat/lon scatter plots (no geographic mapping library is assumed
to be available, so plain lat/lon axes are used - see docstring note below).

Plots are saved under outputs/plots/.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "adapters"))
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "synthetic"))

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

from storm_tracking.tracker import StormTracker
from storm_tracking.trajectory import predict_trajectory
from storm_tracking.geo import haversine_distance_km, parse_utc
from synthetic_adapter import frame_dict_to_detections
from generator import ALL_SCENARIOS

OUTPUT_DIR = Path(__file__).resolve().parent.parent / "outputs" / "plots"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)


def _run_tracker(scenario_name: str):
    frames, ground_truth = ALL_SCENARIOS[scenario_name]()
    tracker = StormTracker()
    history_per_track = {}
    predictions_per_frame = []

    for frame in frames:
        detections = frame_dict_to_detections(frame)
        ts = parse_utc(frame["timestamp"])
        active = tracker.update(ts, detections)
        for track in active:
            latest = track.latest()
            history_per_track.setdefault(track.storm_id, []).append(
                (latest.raw_latitude, latest.raw_longitude, latest.smoothed_latitude, latest.smoothed_longitude)
            )
            pred = predict_trajectory(track)
            if pred:
                predictions_per_frame.append((track.storm_id, ts, pred))

    return frames, ground_truth, tracker, history_per_track, predictions_per_frame


def plot_1_observations_over_time(scenario_name: str = "B_multiple_storms"):
    frames, _, _, _, _ = _run_tracker(scenario_name)
    fig, ax = plt.subplots(figsize=(6, 6))
    cmap = plt.get_cmap("viridis")
    n = len(frames)
    for i, frame in enumerate(frames):
        for s in frame["storms"]:
            ax.scatter(s["longitude"], s["latitude"], color=cmap(i / max(1, n - 1)), s=40)
    ax.set_xlabel("Longitude")
    ax.set_ylabel("Latitude")
    ax.set_title(f"Plot 1: Storm observations over time ({scenario_name})\n(color = time, light->dark)")
    fig.tight_layout()
    fig.savefig(OUTPUT_DIR / "plot1_observations_over_time.png", dpi=120)
    plt.close(fig)


def plot_2_tracked_trajectories(scenario_name: str = "G_crossing_storms"):
    _, _, _, history_per_track, _ = _run_tracker(scenario_name)
    fig, ax = plt.subplots(figsize=(6, 6))
    for storm_id, points in history_per_track.items():
        lons = [p[3] for p in points]
        lats = [p[2] for p in points]
        ax.plot(lons, lats, marker="o", label=storm_id)
    ax.set_xlabel("Longitude")
    ax.set_ylabel("Latitude")
    ax.set_title(f"Plot 2: Tracked storm trajectories ({scenario_name})")
    ax.legend()
    fig.tight_layout()
    fig.savefig(OUTPUT_DIR / "plot2_tracked_trajectories.png", dpi=120)
    plt.close(fig)


def plot_3_observed_vs_predicted(scenario_name: str = "A_single_storm"):
    frames, ground_truth, _, history_per_track, predictions_per_frame = _run_tracker(scenario_name)
    fig, ax = plt.subplots(figsize=(6, 6))

    for storm_id, points in ground_truth.items():
        lons = [p["longitude"] for p in points]
        lats = [p["latitude"] for p in points]
        ax.plot(lons, lats, "k--", label=f"{storm_id} (true)", linewidth=1)

    for storm_id, points in history_per_track.items():
        lons = [p[3] for p in points]
        lats = [p[2] for p in points]
        ax.plot(lons, lats, marker="o", label=f"{storm_id} (tracked)", linewidth=1)

    if predictions_per_frame:
        _, _, last_pred = predictions_per_frame[-1]
        for horizon, p in last_pred["predictions"].items():
            ax.scatter(p["longitude"], p["latitude"], marker="x", s=80, color="red")
            ax.annotate(horizon, (p["longitude"], p["latitude"]))

    ax.set_xlabel("Longitude")
    ax.set_ylabel("Latitude")
    ax.set_title(f"Plot 3: Observed vs predicted trajectory ({scenario_name})")
    ax.legend(fontsize=8)
    fig.tight_layout()
    fig.savefig(OUTPUT_DIR / "plot3_observed_vs_predicted.png", dpi=120)
    plt.close(fig)


def plot_4_forecast_positions(scenario_name: str = "A_single_storm"):
    _, _, _, _, predictions_per_frame = _run_tracker(scenario_name)
    if not predictions_per_frame:
        return
    storm_id, ts, pred = predictions_per_frame[-1]

    fig, ax = plt.subplots(figsize=(6, 6))
    cur = pred["current_position"]
    ax.scatter(cur["longitude"], cur["latitude"], color="black", s=100, label="current", zorder=5)

    colors = {"15min": "tab:blue", "30min": "tab:orange", "60min": "tab:green", "180min": "tab:red"}
    for horizon, p in pred["predictions"].items():
        ax.scatter(p["longitude"], p["latitude"], color=colors.get(horizon, "gray"), s=60, label=horizon)

    ax.set_xlabel("Longitude")
    ax.set_ylabel("Latitude")
    ax.set_title(f"Plot 4: 15/30/60/180-min forecast positions\nStorm {storm_id} ({scenario_name})")
    ax.legend()
    fig.tight_layout()
    fig.savefig(OUTPUT_DIR / "plot4_forecast_positions.png", dpi=120)
    plt.close(fig)


def plot_5_prediction_error_over_time(scenario_name: str = "H_noisy_detections"):
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    from evaluate import evaluate_scenario

    result = evaluate_scenario(scenario_name)
    horizons = list(result["position_error_by_horizon"].keys())
    means = [result["position_error_by_horizon"][h]["mean_km"] or 0 for h in horizons]
    ns = [result["position_error_by_horizon"][h]["n"] for h in horizons]

    fig, ax = plt.subplots(figsize=(6, 5))
    bars = ax.bar(horizons, means, color="steelblue")
    for bar, n in zip(bars, ns):
        ax.annotate(f"n={n}", (bar.get_x() + bar.get_width() / 2, bar.get_height()),
                    textcoords="offset points", xytext=(0, 3), ha="center", fontsize=8)
    ax.set_xlabel("Forecast horizon")
    ax.set_ylabel("Mean position error (km)")
    ax.set_title(f"Plot 5: Prediction error by horizon ({scenario_name})")
    fig.tight_layout()
    fig.savefig(OUTPUT_DIR / "plot5_prediction_error.png", dpi=120)
    plt.close(fig)


def generate_all_plots():
    plot_1_observations_over_time()
    plot_2_tracked_trajectories()
    plot_3_observed_vs_predicted()
    plot_4_forecast_positions()
    plot_5_prediction_error_over_time()
    print(f"Saved plots to {OUTPUT_DIR}")


if __name__ == "__main__":
    generate_all_plots()
