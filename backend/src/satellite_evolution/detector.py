"""Satellite Storm Evolution Detection Engine (Member 2).

Processes infrared brightness temperatures (INSAT-3DR TIR1/TIR2), tracks
cloud-top cooling rates (dT/dt), monitors convective core expansion, and
classifies storm growth dynamics.
"""

from __future__ import annotations

import csv
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional


class SatelliteStormEvolutionDetector:
    """Detects convective storm evolution and cooling rates from satellite imagery."""

    def __init__(self, archive_csv_path: Optional[str | Path] = None):
        self.archive_path = (
            Path(archive_csv_path)
            if archive_csv_path
            else Path(__file__).resolve().parents[3]
            / "data_pipeline"
            / "results"
            / "hyderabad_bt_neighborhood.csv"
        )

    def detect_evolution(
        self,
        cloud_top_temp_c: Optional[float] = None,
        cloud_top_temp_k: Optional[float] = None,
        cooling_rate: Optional[float] = None,
        previous_temp_c: Optional[float] = None,
        dt_hours: float = 1.0,
        area_km2: float = 350.0,
        previous_area_km2: Optional[float] = None,
        latitude: float = 17.28,
        longitude: float = 78.23,
    ) -> Dict[str, Any]:
        """Evaluates satellite cloud-top characteristics.

        Returns contract-compliant payload:
            {
                "cloud_top_temp": -58,
                "cooling_rate": -12,
                "storm_growth": "RAPID"
            }
        """
        # Resolve temperature in Celsius
        if cloud_top_temp_c is not None:
            ctt_c = float(cloud_top_temp_c)
            ctt_k = ctt_c + 273.15
        elif cloud_top_temp_k is not None:
            ctt_k = float(cloud_top_temp_k)
            ctt_c = ctt_k - 273.15
        else:
            ctt_c = -58.0
            ctt_k = ctt_c + 273.15

        # Resolve cooling rate (negative value indicates cooling / vertical intensification)
        if cooling_rate is not None:
            rate = float(cooling_rate)
        elif previous_temp_c is not None and dt_hours > 0:
            rate = (ctt_c - float(previous_temp_c)) / dt_hours
        else:
            rate = -12.0  # default rapid convective cooling

        # Area expansion calculation
        area_expansion_pct = 0.0
        if previous_area_km2 and previous_area_km2 > 0:
            area_expansion_pct = ((area_km2 - previous_area_km2) / previous_area_km2) * 100.0

        # Convective growth classification
        if rate <= -10.0 or area_expansion_pct >= 15.0 or ctt_c <= -55.0:
            growth = "RAPID"
            growth_score = 90.0
        elif rate <= -5.0 or area_expansion_pct >= 5.0 or ctt_c <= -45.0:
            growth = "DEVELOPING"
            growth_score = 65.0
        elif rate <= -1.0 or ctt_c <= -35.0:
            growth = "STEADY"
            growth_score = 40.0
        else:
            growth = "DISSIPATING"
            growth_score = 15.0

        # Intensity index normalized 0-1
        intensity = max(0.1, min(1.0, abs(rate) / 15.0 * 0.5 + max(0, -ctt_c) / 80.0 * 0.5))

        return {
            "cloud_top_temp": int(round(ctt_c)),
            "cooling_rate": int(round(rate)),
            "storm_growth": growth,
            "cloud_top_temp_c": round(ctt_c, 2),
            "cloud_top_temp_k": round(ctt_k, 2),
            "cooling_rate_per_hour": round(rate, 2),
            "area_km2": round(area_km2, 1),
            "area_growth_pct": round(area_expansion_pct, 1),
            "growth_score": growth_score,
            "detection": {
                "detection_id": f"sat_cell_{int(datetime.now(timezone.utc).timestamp())}",
                "latitude": latitude,
                "longitude": longitude,
                "intensity": round(intensity, 2),
                "area_km2": round(area_km2, 1),
                "confidence": 0.88,
                "cloud_top_temperature": round(ctt_c, 1),
            },
        }

    def load_archived_samples(self) -> List[Dict[str, Any]]:
        """Loads and processes bundled INSAT-3DR brightness temperature samples."""
        if not self.archive_path.is_file():
            return []
        samples = []
        try:
            with open(self.archive_path, "r", encoding="utf-8-sig") as f:
                reader = csv.DictReader(f)
                for row in reader:
                    if row.get("is_point", "").casefold() == "true":
                        k_val = float(row["brightness_temperature_k"])
                        samples.append(
                            {
                                "acquisition_time": row["acquisition_time"],
                                "band": row["band"],
                                "bt_k": k_val,
                                "bt_c": round(k_val - 273.15, 2),
                                "latitude": float(row["target_latitude"]),
                                "longitude": float(row["target_longitude"]),
                            }
                        )
        except Exception:
            return []
        return samples
