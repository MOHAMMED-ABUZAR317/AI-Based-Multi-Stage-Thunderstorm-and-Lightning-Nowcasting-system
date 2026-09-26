# Member 4: Storm Tracking, Trajectory Prediction & Arrival-Time Estimation

## Objective

Given a stream of storm-cell detections (from Member 2), maintain a
persistent identity for each storm across time, estimate its motion, predict
its future position at several horizons, and estimate whether/when it will
reach a given target location. Output a clean, documented structure for
the Nowcast Engine (Member 5).

## Inputs

One frame per timestamp, in this contract (see `integration_contract.md`
for the full spec):

```json
{
  "timestamp": "2026-06-15T14:30:00Z",
  "storms": [
    {"detection_id": "det_001", "latitude": 17.45, "longitude": 78.45,
     "intensity": 0.82, "area_km2": 35.4, "confidence": 0.91}
  ]
}
```

Only `timestamp`, `latitude`, `longitude` are required. Everything else is
optional. An adapter (`adapters/synthetic_adapter.py` or
`adapters/member2_adapter.py`) converts this into `storm_tracking.models.Detection`
objects; the tracking engine itself never depends on where the data came from.

## Processing Pipeline

```
Detections (frame t)
        │
        ▼
 validation.py  ──> drop invalid/duplicate detections, log warnings
        │
        ▼
 tracker.py     ──> nearest-neighbour matching against active tracks,
                     with distance + implied-speed plausibility checks;
                     assigns/maintains persistent storm_id
        │
        ▼
 motion.py      ──> smoothing (linear regression over recent raw positions
                     by default) + speed/direction/motion_confidence
        │
        ▼
 confidence.py  ──> trajectory_confidence (heuristic, documented, NOT a
                     calibrated probability)
        │
        ├──> trajectory.py ──> predict_trajectory(): +15/30/60/180 min
        │                      constant-velocity, constant-bearing forecast
        │
        ├──> arrival.py    ──> estimate_arrival_time(): cross-track /
        │                      along-track geometry vs a target location
        │
        └──> events.py     ──> possible_merge / possible_split heuristics
```

## Outputs

Per storm, per frame (see `integration_contract.md` for the exact schema
consumed by Member 5):

- `current_position` (smoothed estimate) and `raw_position` (last raw
  detection) - kept separate, never conflated (requirement #31)
- `motion`: `speed_kmh`, `direction_degrees`, `direction` (compass name)
- `trajectory_confidence`
- `forecast`: position at each configured horizon
- (on demand) `arrival estimate` for a caller-supplied target location
- `tracking_events`: any possible_merge / possible_split flags this frame

## Assumptions

- Storm centroids are the unit of tracking (not full storm polygons/shapes).
- Between two consecutive frames a storm moves along a single great-circle
  bearing at constant speed (used both for matching and for trajectory
  extrapolation). This is a simplification - see `member4_limitations.md`.
- Timestamps are UTC.
- Distances/speeds/bearings use standard geodesic (haversine) formulas on a
  spherical Earth model (`EARTH_RADIUS_KM = 6371.0088`), not flat-Earth
  Cartesian math - important once storms span more than a few km.
- The "trajectory_confidence" score is an explainable heuristic combining
  observation count, motion stability, recency, and detection confidence
  (weights documented in `confidence.py`). It is not statistically
  calibrated.

## Limitations

See `member4_limitations.md` for the full list. Headline items: storm
motion is not always linear, storms accelerate/decelerate/turn, and
long-horizon (60-180 min) predictions carry rapidly increasing uncertainty
because they extrapolate the *current* velocity, not a physically modelled
future evolution.

## Integration Contract

See `integration_contract.md` for the exact JSON shape Member 5 (Nowcast
Engine) can expect to consume, and what Member 2 needs to supply.

## Future Upgrade Path

The baseline is intentionally simple (nearest-neighbour matching +
constant-velocity extrapolation) so it is explainable and has no exotic
dependencies. Each stage can be swapped independently without touching the
others:

| Stage      | Baseline (current)              | Possible upgrade                          | What it would need                              |
|------------|----------------------------------|--------------------------------------------|--------------------------------------------------|
| Matching   | Greedy nearest-neighbour         | Hungarian assignment (`scipy.optimize.linear_sum_assignment`) | A real cost matrix; matters once storm counts per frame grow large |
| Matching   | Distance-only                    | Kalman filter (predict-then-match)         | Per-storm state (position, velocity, covariance) |
| Motion     | Linear regression over last N points | Optical flow on radar/satellite imagery | Gridded radar/satellite frames, not just centroids |
| Motion     | Constant velocity                | pySTEPS-style advection / nowcasting        | Radar reflectivity fields |
| Prediction | Constant bearing + speed         | Learned trajectory model (e.g. LSTM/transformer over track history) | A labelled training set of real storm tracks |
| Matching/Motion | Centroid-only                | Radar-based storm structure / motion estimation | Member 3's radar/structure output |

None of these should require rewriting `models.py`'s data contracts or
`arrival.py` / the output contract to Member 5 - only the internals of
`tracker.py` / `motion.py` / `trajectory.py`.
