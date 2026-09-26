# Member 4 — Storm Tracking, Trajectory Prediction & Arrival-Time Estimation

Part of the AI-based thunderstorm/lightning nowcasting project for India.
This module sits between **Storm Detection (Member 2)** and the
**Nowcast Engine (Member 5)**.

It answers:
1. Which detection belongs to which storm, across time?
2. What is each storm's direction and speed?
3. Where will it be in 15 / 30 / 60 / (optionally 180) minutes?
4. When will it reach a given location?
5. How confident should we be in that trajectory?

## Quick start

```bash
cd member4
python3 demo_tracking.py
```

This generates a synthetic storm, tracks it, predicts its trajectory,
estimates an arrival time, evaluates the tracker against all 11 synthetic
scenarios, generates plots, and writes JSON results — all in one command,
with no external services or real Member 2 data required.

## Run the tests

```bash
python3 tests/run_all.py
```

(See "A note on tooling" below — this uses `unittest`, not `pytest`.)

## Project layout

```
member4/
├── README.md
├── requirements.txt
├── pyproject.toml
├── src/storm_tracking/       # the tracking engine itself (source-agnostic)
│   ├── models.py             # Detection / Frame / TrackPoint / StormTrack
│   ├── geo.py                # haversine distance/bearing/destination-point
│   ├── config.py             # all tunable thresholds, in one place
│   ├── validation.py         # input data quality checks
│   ├── motion.py             # smoothing + speed/direction estimation
│   ├── tracker.py            # nearest-neighbour matching, persistent IDs
│   ├── trajectory.py         # +15/30/60/180 min forecasts
│   ├── arrival.py            # arrival-time estimation vs a target location
│   ├── confidence.py         # trajectory_confidence heuristic
│   └── events.py             # possible_merge / possible_split heuristics
├── adapters/
│   ├── synthetic_adapter.py  # synthetic generator -> Detection objects
│   └── member2_adapter.py    # placeholder for Member 2's real output
├── synthetic/generator.py    # scenarios A-K synthetic data + ground truth
├── tests/                    # unittest-based test suite (48 tests)
├── evaluation/
│   ├── evaluate.py           # position/motion/tracking-quality metrics
│   └── visualize.py          # the 5 required plots
├── outputs/
│   ├── plots/                # generated PNGs
│   └── results/              # generated JSON (evaluation.json, demo_output.json)
├── docs/
│   ├── member4_architecture.md
│   ├── member4_limitations.md
│   └── integration_contract.md
└── demo_tracking.py
```

## A note on tooling

The task brief for this module specified `pytest`. This sandbox has **no
network access**, so `pip install pytest` fails here
(`ERROR: No matching distribution found for pytest`). All 48 tests are
written with Python's built-in `unittest` module instead, using
pytest-style file/function naming (`test_*.py`), so they will also run
under `pytest tests/` unmodified on a machine with internet access.
Similarly, no geospatial library (e.g. `geopy`) is used — `src/storm_tracking/geo.py`
implements standard haversine/bearing/destination-point formulas directly,
which keeps the module dependency-free (`requirements.txt` only needs
`matplotlib`, already used for plotting, since `numpy` isn't strictly
required by this module).

## Status

Baseline implementation complete: matching, motion estimation with
configurable smoothing, trajectory prediction, arrival-time estimation,
transparent confidence scoring, merge/split heuristics, input validation,
an 11-scenario synthetic data generator, a full evaluation framework, 5
required plots, and a working end-to-end demo. See the final report for
current metrics and next steps.
