"""Unit tests for Member 5 Nowcasting Multi-Stage Fusion Engine."""

from __future__ import annotations

import unittest
from backend.src.nowcast_engine.fusion import NowcastFusionEngine


class TestNowcastFusion(unittest.TestCase):
    def setUp(self):
        self.fusion = NowcastFusionEngine()

    def test_member5_severe_fusion_contract(self):
        """Validates contract required for Member 5: risk_score ~84, SEVERE, alert true."""
        result = self.fusion.fuse(
            manual_override_scores={
                "m1": 73.0,  # Member 1 Instability
                "m2": 90.0,  # Member 2 Satellite Growth
                "m3": 78.0,  # Member 3 Lightning Prob
                "m4": 95.0,  # Member 4 Tracking & Proximity
            }
        )
        # 0.20*73 + 0.25*90 + 0.30*78 + 0.25*95 = 14.6 + 22.5 + 23.4 + 23.75 = 84.25 -> 84
        self.assertEqual(result["risk_score"], 84)
        self.assertEqual(result["risk_level"], "SEVERE")
        self.assertEqual(result["alert"], True)
        self.assertIn("member_contributions", result)

    def test_normal_clear_fusion(self):
        result = self.fusion.fuse(
            manual_override_scores={
                "m1": 15.0,
                "m2": 10.0,
                "m3": 5.0,
                "m4": 0.0,
            }
        )
        self.assertLess(result["risk_score"], 30)
        self.assertEqual(result["risk_level"], "NORMAL")
        self.assertEqual(result["alert"], False)


if __name__ == "__main__":
    unittest.main()
