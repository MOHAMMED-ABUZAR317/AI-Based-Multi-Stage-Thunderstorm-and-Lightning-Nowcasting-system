# Integration Contract

## Integrated prototype status

This document describes the Member 4 tracker interface; it does not claim a
live Member 2 detector or Member 5 nowcast engine is connected. The available
Member 2 output is an archived INSAT-3DR brightness-temperature CSV, not a
storm-detection feed. The runnable API uses the synthetic adapter for its
deterministic demonstration, returns the Member 1/2/3 archives separately as
dated reference data, and explicitly marks current weather/radar inputs and
defensible lightning predictions unavailable. Demo lightning percentages
and risk levels are scripted scenario fields only. Nothing here dispatches
citizen alerts.

## From Member 2 (Storm Detection) -> Member 4 (this module)

One JSON object per timestamp:

```json
{
  "timestamp": "2026-06-15T14:30:00Z",
  "storms": [
    {
      "detection_id": "det_001",
      "latitude": 17.45,
      "longitude": 78.45,
      "intensity": 0.82,
      "area_km2": 35.4,
      "confidence": 0.91
    }
  ]
}
```

**Required fields:** `timestamp` (ISO-8601 UTC), `latitude`, `longitude`.
**Optional fields:** `intensity`, `area_km2`, `confidence`, `reflectivity`,
`cloud_top_temperature`, `lightning_count`. Any other fields are ignored
(not an error).

If Member 2's real output differs from this shape, only
`adapters/member2_adapter.py` needs to change - not the tracking engine.

## From Member 4 (this module) -> Member 5 (Nowcast Engine)

Per storm, per processed frame:

```json
{
  "storm_id": "S01",
  "timestamp": "2026-06-15T14:30:00Z",
  "current_position": {"latitude": 17.45, "longitude": 78.45},
  "motion": {
    "speed_kmh": 32.0,
    "direction_degrees": 45.0,
    "direction": "NE"
  },
  "trajectory_confidence": 0.81,
  "forecast": {
    "15min": {"latitude": 17.50, "longitude": 78.50, "valid_at": "2026-06-15T14:45:00Z"},
    "30min": {"latitude": 17.56, "longitude": 78.56, "valid_at": "2026-06-15T15:00:00Z"},
    "60min": {"latitude": 17.68, "longitude": 78.68, "valid_at": "2026-06-15T15:30:00Z"},
    "180min": {"latitude": 18.09, "longitude": 79.13, "valid_at": "2026-06-15T17:30:00Z"}
  }
}
```

This is produced by combining `StormTrack.to_dict()` with
`predict_trajectory(track)` (see `demo_tracking.py` for the exact call
pattern). `motion` / `forecast` / `trajectory_confidence` are all `None`
(or the whole `forecast` key absent) until a storm has >= 2 real
observations - Member 5 should treat a missing forecast as "not enough
history yet," not as a zero-confidence prediction.

## On-demand arrival query

```python
from storm_tracking.arrival import estimate_arrival_time
result = estimate_arrival_time(track, target_lat, target_lon)
```

Returns:

```json
{
  "storm_id": "S01",
  "will_reach": true,
  "estimated_arrival_time": "2026-06-15T15:03:00Z",
  "minutes_until_arrival": 38.0,
  "closest_approach_km": 0.0,
  "confidence": 0.81
}
```

If `will_reach` is `false`, a human-readable `reason` field explains why
(e.g. target is behind the current heading, or beyond the configured
search horizon).

## Public entry points

```python
from storm_tracking import StormTracker, predict_trajectory, estimate_arrival_time

tracker = StormTracker()
active_tracks = tracker.update(timestamp, detections)   # one call per frame

for track in active_tracks:
    forecast = predict_trajectory(track)                # None until >=2 obs
    arrival = estimate_arrival_time(track, lat, lon)     # for a target location
```

## What Member 4 needs from Member 2 to move off synthetic data

1. Confirmation of the exact field names/types in Member 2's real output
   (only matters if it differs from the contract above).
2. Typical detection frequency (frame interval) - the tracker's
   `maximum_matching_distance_km` / `maximum_reasonable_speed_kmh`
   thresholds in `config.py` should be sanity-checked against Member 2's
   real cadence once available.
3. Whether Member 2 can supply `confidence` per detection - it currently
   feeds into `trajectory_confidence` when present, and falls back to a
   neutral default (0.75) when absent.
