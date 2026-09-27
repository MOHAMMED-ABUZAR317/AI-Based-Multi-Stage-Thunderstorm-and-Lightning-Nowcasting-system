"""Unit tests for Member 1 Weather Instability Analysis."""

from __future__ import annotations

import unittest
from backend.src.weather_analysis.analyzer import WeatherInstabilityAnalyzer


class TestWeatherInstability(unittest.TestCase):
    def setUp(self):
        self.analyzer = WeatherInstabilityAnalyzer()

    def test_member1_expected_contract(self):
        """Validates exact contract required for Member 1: CAPE 2400, Humidity 82%."""
        result = self.analyzer.analyze_instability(
            cape=2400,
            humidity=82,
            wind_shear=25.7,
            temperature=26.6,
            pressure=1000.6,
        )
        self.assertIn(result["instability"], ["HIGH", "VERY HIGH"])
        self.assertEqual(result["cape"], 2400)
        self.assertEqual(result["humidity"], 82)
        self.assertGreater(result["instability_score"], 42.0)

    def test_low_instability(self):
        result = self.analyzer.analyze_instability(
            cape=800,
            humidity=40,
            wind_shear=5.0,
            cin=45.0,
        )
        self.assertEqual(result["instability"], "LOW")
        self.assertLess(result["instability_score"], 35.0)


if __name__ == "__main__":
    unittest.main()
