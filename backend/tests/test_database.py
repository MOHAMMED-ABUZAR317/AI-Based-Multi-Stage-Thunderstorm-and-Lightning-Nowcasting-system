"""Unit tests for SQLAlchemy Database Layer."""

from __future__ import annotations

import unittest
from backend.app.database import (
    init_db,
    log_alert,
    log_nowcast_run,
    get_recent_nowcasts,
)


class TestDatabase(unittest.TestCase):
    def setUp(self):
        init_db()

    def test_alert_persistence(self):
        res = log_alert(
            severity="SEVERE",
            headline="TEST DISPATCH HEADLINE",
            message_en="Take immediate shelter.",
            target_zones="Serilingampally, Kukatpally",
        )
        self.assertIn("HYD-ALERT-", res["alert_id"])
        self.assertEqual(res["severity"], "SEVERE")

    def test_nowcast_logging(self):
        dummy_payload = {
            "scenario": {"step": 4, "phase": "tracking_approach"},
            "nowcast": {
                "risk": {"index": 84, "level": "SEVERE"},
                "weather": {"values": {"cape_j_kg": 3400, "humidity_percent": 90}},
                "lightning": {"probabilities_percent": {"30min": 78}},
            },
            "tracking": {
                "storms": [
                    {
                        "motion": {"speed_kmh": 42.0, "direction": "NE"},
                        "estimated_city_arrival": {"minutes_until_arrival": 35.0},
                    }
                ]
            },
            "alert": {"active": True},
        }
        row_id = log_nowcast_run(dummy_payload)
        self.assertGreater(row_id, 0)

        history = get_recent_nowcasts(limit=5)
        self.assertGreaterEqual(len(history), 1)
        self.assertIn(history[0]["risk_level"], ["SEVERE", "WARNING", "WATCH", "NORMAL"])


if __name__ == "__main__":
    unittest.main()
