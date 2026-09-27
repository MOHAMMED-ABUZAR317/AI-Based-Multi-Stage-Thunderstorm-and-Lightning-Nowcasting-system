"""End-to-End integration tests for all FastAPI endpoints."""

from __future__ import annotations

import unittest
from fastapi.testclient import TestClient

from backend.app.main import app


class TestFullPipelineAPI(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)

    def test_health(self):
        resp = self.client.get("/api/v1/health")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["status"], "ok")
        self.assertEqual(data["operational"], False)
        self.assertTrue(data["demo"])

    def test_member1_weather_endpoint(self):
        resp = self.client.get("/api/v1/weather/instability?cape=2400&humidity=82")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertIn(data["instability"], ["HIGH", "VERY HIGH"])
        self.assertEqual(data["cape"], 2400)
        self.assertEqual(data["humidity"], 82)

    def test_member2_satellite_endpoint(self):
        resp = self.client.get("/api/v1/satellite/evolution?cloud_top_temp_c=-58&cooling_rate=-12")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["cloud_top_temp"], -58)
        self.assertEqual(data["cooling_rate"], -12)
        self.assertEqual(data["storm_growth"], "RAPID")

    def test_member3_ml_lightning_endpoint(self):
        resp = self.client.get("/api/v1/ml/lightning?cloud_top_temp_c=-58&cooling_rate=-12")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertGreaterEqual(data["lightning_probability"], 75)
        self.assertIn("15min", data["probabilities_by_horizon"])

    def test_member4_tracking_endpoint(self):
        resp = self.client.get("/api/v1/tracking/vectors")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertIn("direction", data)
        self.assertIn("speed_kmh", data)
        self.assertIn("eta_minutes", data)

    def test_member5_fusion_endpoint(self):
        resp = self.client.get("/api/v1/nowcast/fusion")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertIn("risk_score", data)
        self.assertIn("risk_level", data)
        self.assertIn("alert", data)

    def test_fusion_post_contract(self):
        payload = {
            "member1_instability_score": 73.0,
            "member2_satellite_growth_score": 90.0,
            "member3_lightning_probability": 78.0,
            "member4_tracking_urgency_score": 95.0,
        }
        resp = self.client.post("/api/v1/nowcast/fusion", json=payload)
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["risk_score"], 84)
        self.assertEqual(data["risk_level"], "SEVERE")
        self.assertEqual(data["alert"], True)

    def test_full_pipeline_endpoint(self):
        resp = self.client.get("/api/v1/nowcast/pipeline")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertIn("member_outputs", data)
        self.assertIn("nowcast", data)
        self.assertIn("tracking", data)
        self.assertIn("alert", data)

    def test_alert_dispatch_endpoint(self):
        payload = {
            "severity": "SEVERE",
            "headline": "TEST WARNING",
            "message_en": "Emergency alert test.",
            "target_zones": "Charminar, Khairatabad",
            "channels": "SMS, SIRENS",
        }
        resp = self.client.post("/api/v1/alerts/dispatch", json=payload)
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["status"], "success")

    def test_database_history_endpoint(self):
        resp = self.client.get("/api/v1/database/history?limit=5")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertIn("count", data)
        self.assertIn("history", data)

    def test_tracking_post_endpoint(self):
        payload = {
            "timestamp": "2026-09-27T12:00:00Z",
            "detections": [
                {
                    "detection_id": "test_cell_01",
                    "latitude": 17.25,
                    "longitude": 78.20,
                    "intensity": 0.85,
                    "area_km2": 320.0,
                    "confidence": 0.92,
                }
            ],
        }
        resp = self.client.post("/api/v1/tracking/vectors", json=payload)
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertIn("direction", data)
        self.assertIn("speed_kmh", data)
        self.assertIn("active_track_count", data)


if __name__ == "__main__":
    unittest.main()
