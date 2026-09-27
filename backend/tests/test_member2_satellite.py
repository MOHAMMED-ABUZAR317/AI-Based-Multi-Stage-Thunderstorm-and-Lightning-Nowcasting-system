"""Unit tests for Member 2 Satellite Storm Evolution Detection."""

from __future__ import annotations

import unittest
from backend.src.satellite_evolution.detector import SatelliteStormEvolutionDetector


class TestSatelliteEvolution(unittest.TestCase):
    def setUp(self):
        self.detector = SatelliteStormEvolutionDetector()

    def test_member2_expected_contract(self):
        """Validates exact contract required for Member 2: CTT -58, cooling_rate -12."""
        result = self.detector.detect_evolution(
            cloud_top_temp_c=-58,
            cooling_rate=-12,
            area_km2=450.0,
        )
        self.assertEqual(result["cloud_top_temp"], -58)
        self.assertEqual(result["cooling_rate"], -12)
        self.assertEqual(result["storm_growth"], "RAPID")
        self.assertIn("detection", result)
        self.assertEqual(result["detection"]["intensity"] > 0, True)

    def test_slow_growth_classification(self):
        result = self.detector.detect_evolution(
            cloud_top_temp_c=-30,
            cooling_rate=-2.0,
            area_km2=100.0,
        )
        self.assertEqual(result["storm_growth"], "STEADY")


if __name__ == "__main__":
    unittest.main()
