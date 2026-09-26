"""API and end-to-end scenario contract tests."""

import unittest
from pathlib import Path

from fastapi.testclient import TestClient

from backend.app.main import app


client = TestClient(app)


class NowcastApiTests(unittest.TestCase):
    def test_health_is_explicitly_non_operational(self):
        response = client.get("/api/v1/health")
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertTrue(payload["demo"])
        self.assertFalse(payload["operational"])
        self.assertIn("No citizen alerts", payload["safety_notice"])

    def test_scenario_progression_is_deterministic_and_contract_complete(self):
        phases = [
            "baseline",
            "initiation",
            "development",
            "tracking",
            "risk",
            "alert",
            "clearance",
        ]
        responses = []
        for step, phase in enumerate(phases):
            response = client.get("/api/v1/nowcast", params={"step": step})
            self.assertEqual(response.status_code, 200)
            payload = response.json()
            self.assertEqual(payload["scenario"]["phase"], phase)
            self.assertEqual(payload["scenario"]["step"], step)
            self.assertTrue(payload["demo"])
            self.assertFalse(payload["operational"])
            self.assertEqual([member["member"] for member in payload["members"]], [1, 2, 3, 4, 5])
            self.assertIsNone(payload["nowcast"]["weather"]["values"])
            self.assertIsNone(payload["nowcast"]["radar"]["values"])
            self.assertEqual(
                payload["members"][0]["status"], "HISTORICAL_ARCHIVE_ONLY"
            )
            self.assertEqual(
                payload["archives"]["member2_satellite"]["status"], "ARCHIVED_EXTRACT"
            )
            self.assertIn(
                "Data provenance",
                payload["archives"]["member1_weather"]["note"],
            )
            self.assertEqual(
                payload["nowcast"]["lightning"]["status"], "SIMULATED_DEMO_ONLY"
            )
            self.assertFalse(payload["nowcast"]["lightning"]["valid_for_decisions"])
            self.assertEqual(payload["alert"]["recipient_count"], 0)
            responses.append(payload)

        self.assertEqual(responses[0], client.get("/api/v1/nowcast").json())
        self.assertEqual(responses[1]["tracking"]["storms"][0]["observation_count"], 1)
        self.assertIsNone(responses[1]["tracking"]["storms"][0]["forecast"])
        self.assertIsNotNone(responses[2]["tracking"]["storms"][0]["forecast"])
        self.assertTrue(responses[5]["alert"]["active"])
        self.assertEqual(responses[5]["alert"]["status"], "SIMULATED_NOT_DISPATCHED")
        self.assertFalse(responses[6]["alert"]["active"])
        self.assertEqual(responses[6]["alert"]["status"], "SIMULATED_CLEARED")
        self.assertEqual(responses[6]["tracking"]["storms"], [])

    def test_archives_endpoint_serves_historical_reference_data(self):
        response = client.get("/api/v1/archives")
        self.assertEqual(response.status_code, 200)
        archives = response.json()
        self.assertEqual(archives["member1_weather"]["record_count"], 1106)
        self.assertEqual(len(archives["member2_satellite"]["samples"]), 8)
        self.assertEqual(archives["member3_ctp"]["record_count"], 16)
        self.assertTrue(archives["member3_ctp"]["as_of"].startswith("01-MAY-2025"))

    def test_invalid_scenario_step_is_rejected(self):
        self.assertEqual(client.get("/api/v1/nowcast", params={"step": -1}).status_code, 422)
        self.assertEqual(client.get("/api/v1/nowcast", params={"step": 7}).status_code, 422)

    def test_dashboard_and_static_assets_are_served(self):
        dashboard_response = client.get("/")
        self.assertEqual(dashboard_response.status_code, 200)
        self.assertIn("DEMO ONLY", dashboard_response.text)
        self.assertEqual(client.get("/assets/app.js").status_code, 200)
        self.assertEqual(client.get("/assets/js/data-service.js").status_code, 200)
        self.assertEqual(client.get("/assets/styles.css").status_code, 200)
        self.assertEqual(client.get("/assets/favicon.svg").status_code, 200)
        self.assertEqual(client.get("/api/v1/nowcast/live").status_code, 404)
        frontend = Path(__file__).resolve().parents[2] / "frontend"
        index = (frontend / "index.html").read_text(encoding="utf-8")
        app_script = (frontend / "app.js").read_text(encoding="utf-8")
        self.assertNotIn("dispatchManualAlert", index)
        self.assertNotIn("Math.random", app_script)


if __name__ == "__main__":
    unittest.main()
