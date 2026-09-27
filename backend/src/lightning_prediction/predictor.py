"""Machine Learning Lightning Prediction Engine (Member 3).

Executes trained gradient-boosted decision tree (XGBoost) inference and physical
electrification heuristics over INSAT-3DR satellite cloud-top characteristics to
predict strike probabilities across 15, 30, and 60-minute nowcasting horizons.
"""

from __future__ import annotations

import math
from pathlib import Path
from typing import Any, Dict, Optional

import numpy as np

try:
    import xgboost as xgb
    XGB_AVAILABLE = True
except ImportError:
    xgb = None
    XGB_AVAILABLE = False


class LightningPredictor:
    """Predicts thunderstorm lightning hazard likelihood using ML & physical heuristics."""

    # Exact training standardization parameters from historical INSAT-3DR dataset
    SCALER_MEANS = [295.6929, 772.9797, 0.9835]
    SCALER_STDS = [3.9979, 6.9373, 1.7186]

    def __init__(self, model_path: Optional[str | Path] = None):
        self.model_path = (
            Path(model_path)
            if model_path
            else Path(__file__).resolve().parent
            / "model_registry"
            / "lightning_xgb_model.json"
        )
        self.model: Optional[Any] = None
        self._load_model()

    def _load_model(self) -> None:
        """Loads serialized XGBoost weights if available."""
        if not XGB_AVAILABLE or not self.model_path.is_file():
            return
        try:
            self.model = xgb.XGBClassifier()
            self.model.load_model(str(self.model_path))
        except Exception:
            self.model = None

    def predict_lightning(
        self,
        cloud_top_temp_c: Optional[float] = None,
        cloud_top_temp_k: Optional[float] = None,
        cloud_top_pressure_hpa: float = 750.0,
        cooling_rate_per_hour: float = -12.0,
        cape: Optional[float] = None,
        ctt_drop_30min: Optional[float] = None,
    ) -> Dict[str, Any]:
        """Predicts lightning probabilities across horizons.

        Returns contract-compliant output:
            {
                "lightning_probability": 78
            }
        """
        # Convert CTT to Kelvin and Celsius
        if cloud_top_temp_k is not None:
            ctt_k = float(cloud_top_temp_k)
            ctt_c = ctt_k - 273.15
        elif cloud_top_temp_c is not None:
            ctt_c = float(cloud_top_temp_c)
            ctt_k = ctt_c + 273.15
        else:
            ctt_c = -58.0
            ctt_k = ctt_c + 273.15

        pressure = float(cloud_top_pressure_hpa)

        if ctt_drop_30min is not None:
            drop_30m = float(ctt_drop_30min)
        else:
            # Cooling rate is per hour, so 30-min drop is half of that
            drop_30m = float(cooling_rate_per_hour) * 0.5

        # 1. Physical Electrification Scoring (Microphysics of mixed-phase convective updrafts)
        # Glaciation and charge separation between graupel & ice crystals occurs intensely when CTT < -38C (235K)
        temp_factor = max(0.0, min(1.0, (-ctt_c - 15.0) / 45.0))  # -15C to -60C
        cooling_factor = max(0.0, min(1.0, abs(min(0.0, drop_30m)) / 5.0))  # rapid cooling indicates strong updraft
        pressure_factor = max(0.0, min(1.0, (1000.0 - pressure) / 500.0))  # vertical penetration
        cape_factor = (
            max(0.0, min(1.0, (float(cape) - 1200.0) / 2000.0))
            if cape is not None
            else 0.80
        )

        physical_probability = (
            0.40 * temp_factor + 0.30 * cooling_factor + 0.15 * pressure_factor + 0.15 * cape_factor
        ) * 100.0

        # 2. Machine Learning XGBoost Inference (if model weights loaded)
        ml_probability: Optional[float] = None
        if self.model is not None:
            try:
                # Scale features to training distribution
                raw_features = np.array([ctt_k, pressure, drop_30m], dtype=float)
                scaled_features = (raw_features - self.SCALER_MEANS) / self.SCALER_STDS
                X = scaled_features.reshape(1, -1)
                proba = float(self.model.predict_proba(X)[0, 1]) * 100.0
                ml_probability = proba
            except Exception:
                ml_probability = None

        # Ensemble hybrid decision: blend ML and Physical Microphysics
        if ml_probability is not None:
            # Under severe convective conditions (strong cooling and deep CTT <= -40C),
            # physical charge separation governs electrification
            if ctt_c <= -40.0:
                blended = max(physical_probability, 0.35 * ml_probability + 0.65 * physical_probability)
            else:
                blended = 0.50 * ml_probability + 0.50 * physical_probability
        else:
            blended = physical_probability

        # Anchor to realistic 0-100 range
        primary_prob = int(round(max(0.0, min(100.0, blended))))

        # Calculate horizon look-aheads (15 min, 30 min, 60 min)
        prob_15m = int(round(max(0.0, min(100.0, primary_prob * 0.85))))
        prob_30m = primary_prob
        prob_60m = int(round(max(0.0, min(100.0, min(primary_prob * 1.15, primary_prob + 15)))))

        if primary_prob >= 75:
            risk_band = "SEVERE"
        elif primary_prob >= 50:
            risk_band = "HIGH"
        elif primary_prob >= 25:
            risk_band = "MODERATE"
        else:
            risk_band = "LOW"

        return {
            "lightning_probability": primary_prob,
            "probabilities_by_horizon": {
                "15min": prob_15m,
                "30min": prob_30m,
                "60min": prob_60m,
            },
            "risk_band": risk_band,
            "diagnostics": {
                "cloud_top_temp_c": round(ctt_c, 1),
                "cloud_top_pressure_hpa": round(pressure, 1),
                "ctt_drop_30min_k": round(drop_30m, 1),
                "model_type": "Hybrid XGBoost + Atmospheric Microphysics",
                "ml_active": self.model is not None,
            },
        }
