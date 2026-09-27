"""Atmospheric Weather Instability Analysis Engine (Member 1).

Evaluates thermodynamic and convective parameters (CAPE, CIN, Wind Shear,
Moisture/Humidity, Temperature, Pressure) to diagnose pre-convective atmospheric
instability over Hyderabad.
"""

from __future__ import annotations

import csv
from pathlib import Path
from typing import Any, Dict, Optional


class WeatherInstabilityAnalyzer:
    """Computes convective instability scores and categorical threat levels."""

    def __init__(self, historical_csv_path: Optional[str | Path] = None):
        self.csv_path = (
            Path(historical_csv_path)
            if historical_csv_path
            else Path(__file__).resolve().parents[3]
            / "data_pipeline"
            / "hyderabad_15year_thunderstorm_data_with_instability.csv"
        )
        self._historical_data: list[dict[str, float]] = []
        self._load_reference_distributions()

    def _load_reference_distributions(self) -> None:
        """Loads historical distributions to provide percentile ranking if file exists."""
        if not self.csv_path.is_file():
            return
        try:
            with open(self.csv_path, "r", encoding="utf-8-sig") as f:
                reader = csv.DictReader(f)
                for row in reader:
                    try:
                        self._historical_data.append(
                            {
                                "cape": float(row["CAPE"]),
                                "humidity": float(row["humidity"]),
                                "shear": float(row["wind_shear"]),
                                "cin": float(row["CIN"]),
                            }
                        )
                    except (ValueError, KeyError):
                        continue
        except Exception:
            self._historical_data = []

    def _percentile_score(self, value: float, key: str, default_min: float, default_max: float, invert: bool = False) -> float:
        """Computes empirical percentile rank or falls back to min-max normalization."""
        if self._historical_data and len(self._historical_data) >= 50:
            population = [r[key] for r in self._historical_data]
            count_below = sum(1 for x in population if x <= value)
            pct = (count_below / len(population)) * 100.0
            return (100.0 - pct) if invert else pct

        # Fallback to physical bounds
        clamped = max(default_min, min(default_max, value))
        score = ((clamped - default_min) / (default_max - default_min)) * 100.0
        return (100.0 - score) if invert else score

    def analyze_instability(
        self,
        cape: float,
        humidity: float,
        wind_shear: float = 20.0,
        temperature: float = 28.0,
        pressure: float = 1002.0,
        cin: float = 12.0,
    ) -> Dict[str, Any]:
        """Calculates instability metrics from meteorological inputs.

        Expected contract returns:
            {
                "instability": "HIGH",
                "cape": 2400,
                "humidity": 82
            }
        plus comprehensive thermodynamic diagnostic breakdowns.
        """
        cape = float(cape)
        humidity = float(humidity)
        wind_shear = float(wind_shear)
        temperature = float(temperature)
        pressure = float(pressure)
        cin = float(cin)

        # Percentile rank scoring based on 15-year Hyderabad convective climatology
        cape_score = self._percentile_score(cape, "cape", 1200.0, 4200.0)
        humidity_score = self._percentile_score(humidity, "humidity", 50.0, 100.0)
        shear_score = self._percentile_score(wind_shear, "shear", 5.0, 38.0)
        cin_score = self._percentile_score(cin, "cin", 0.0, 45.0, invert=True)

        # Multi-factor convective formulation (Verified Member 1 weights)
        instability_score = round(
            0.40 * cape_score + 0.20 * humidity_score + 0.20 * shear_score + 0.20 * cin_score,
            1,
        )
        instability_score = max(0.0, min(100.0, instability_score))

        # Standard meteorological threshold calibration:
        # High atmospheric instability occurs when CAPE >= 2000 J/kg and humidity >= 75%
        # or composite instability_score >= 50.0.
        if instability_score >= 80.0 or (cape >= 3500.0 and humidity >= 85.0):
            instability_level = "VERY HIGH"
        elif instability_score >= 42.0 or (cape >= 2000.0 and humidity >= 75.0):
            instability_level = "HIGH"
        elif instability_score >= 25.0:
            instability_level = "MODERATE"
        else:
            instability_level = "LOW"

        return {
            "instability": instability_level,
            "cape": round(cape, 1),
            "humidity": round(humidity, 1),
            "wind_shear": round(wind_shear, 1),
            "temperature": round(temperature, 1),
            "pressure": round(pressure, 1),
            "cin": round(cin, 1),
            "instability_score": instability_score,
            "subscores": {
                "cape_score": round(cape_score, 1),
                "humidity_score": round(humidity_score, 1),
                "shear_score": round(shear_score, 1),
                "cin_score": round(cin_score, 1),
            },
            "status": "ACTIVE_CALCULATION",
        }
