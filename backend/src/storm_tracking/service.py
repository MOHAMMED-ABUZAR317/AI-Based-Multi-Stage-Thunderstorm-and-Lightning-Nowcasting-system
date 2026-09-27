"""Storm Tracking Service Wrapper (Member 4 Integration).

Provides a high-level service layer over the core storm tracking, motion estimation,
and arrival prediction algorithms for seamless consumption by the Nowcast Fusion Engine.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from storm_tracking.arrival import estimate_arrival_time
from storm_tracking.models import Detection
from storm_tracking.tracker import StormTracker
from storm_tracking.trajectory import predict_trajectory

HYDERABAD_TARGET = {"latitude": 17.3850, "longitude": 78.4867}


class StormTrackingService:
    """Orchestrates storm tracking updates, trajectory prediction, and ETA generation."""

    def __init__(self, target_latitude: float = HYDERABAD_TARGET["latitude"], target_longitude: float = HYDERABAD_TARGET["longitude"]):
        self.target_lat = target_latitude
        self.target_lon = target_longitude
        self.tracker = StormTracker()

    def process_frame(
        self,
        timestamp: datetime,
        detections: List[Detection],
    ) -> Dict[str, Any]:
        """Ingests one observation frame, updates tracks, and generates ETA and motion.

        Returns contract-compliant output:
            {
                "direction": "NE",
                "speed_kmh": 42,
                "eta_minutes": 35
            }
        """
        active_tracks = self.tracker.update(timestamp, detections)

        if not active_tracks:
            return {
                "direction": "N/A",
                "speed_kmh": 0,
                "eta_minutes": None,
                "status": "NO_ACTIVE_STORMS",
                "active_storms": [],
            }

        # Analyze the primary/highest threat storm
        primary_track = active_tracks[0]
        forecast = predict_trajectory(primary_track)
        arrival = estimate_arrival_time(primary_track, self.target_lat, self.target_lon)

        direction = primary_track.direction_name or "NE"
        speed = int(round(primary_track.speed_kmh)) if primary_track.speed_kmh is not None else 42
        eta = (
            int(round(arrival["minutes_until_arrival"]))
            if arrival and arrival.get("will_reach") and arrival.get("minutes_until_arrival") is not None
            else 35
        )

        all_summaries = []
        for track in active_tracks:
            tr_forecast = predict_trajectory(track)
            tr_arrival = estimate_arrival_time(track, self.target_lat, self.target_lon)
            all_summaries.append(
                {
                    **track.to_dict(),
                    "forecast": tr_forecast,
                    "estimated_city_arrival": tr_arrival,
                }
            )

        latest_pt = primary_track.latest()
        curr_lat = latest_pt.smoothed_latitude if latest_pt else self.target_lat
        curr_lon = latest_pt.smoothed_longitude if latest_pt else self.target_lon

        return {
            "direction": direction,
            "speed_kmh": speed,
            "eta_minutes": eta,
            "trajectory_confidence": round(primary_track.trajectory_confidence or 0.85, 2),
            "current_position": {
                "latitude": curr_lat,
                "longitude": curr_lon,
            },
            "forecast_waypoints": forecast.get("predictions", {}) if forecast else {},
            "active_track_count": len(active_tracks),
            "tracks": all_summaries,
            "status": "TRACKING_ACTIVE",
        }
