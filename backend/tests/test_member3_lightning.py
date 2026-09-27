"""Unit tests for Member 3 ML Lightning Prediction."""

from __future__ import annotations

import unittest
from backend.src.lightning_prediction.predictor import LightningPredictor


class TestLightningPrediction(unittest.TestCase):
    def setUp(self):
        self.predictor = LightningPredictor()

    def test_member3_high_convective_lightning_contract(self):
        """Validates contract required for Member 3 high lightning probability."""
        result = self.predictor.predict_lightning(
            cloud_top_temp_c=-58,
            cloud_top_pressure_hpa=750.0,
            cooling_rate_per_hour=-12.0,
            cape=2400.0,
        )
        self.assertGreaterEqual(result["lightning_probability"], 75)
        self.assertIn("15min", result["probabilities_by_horizon"])
        self.assertIn("30min", result["probabilities_by_horizon"])
        self.assertIn("60min", result["probabilities_by_horizon"])
        self.assertIn(result["risk_band"], ["HIGH", "SEVERE"])

    def test_low_convection_no_lightning(self):
        result = self.predictor.predict_lightning(
            cloud_top_temp_c=-10,
            cloud_top_pressure_hpa=850.0,
            cooling_rate_per_hour=0.0,
            cape=500.0,
        )
        self.assertLess(result["lightning_probability"], 30)


if __name__ == "__main__":
    unittest.main()
