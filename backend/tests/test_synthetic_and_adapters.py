import unittest
import conftest_paths  # noqa: F401

from generator import ALL_SCENARIOS
from synthetic_adapter import frame_dict_to_detections
from storm_tracking.tracker import StormTracker


class TestSyntheticScenarios(unittest.TestCase):
    def test_all_scenarios_produce_frames_and_truth(self):
        for name, fn in ALL_SCENARIOS.items():
            frames, truth = fn()
            self.assertTrue(len(frames) > 0, f"{name} produced no frames")
            self.assertTrue(len(truth) > 0, f"{name} produced no ground truth")
            for frame in frames:
                self.assertIn("timestamp", frame)
                self.assertIn("storms", frame)
                for s in frame["storms"]:
                    self.assertIn("detection_id", s)
                    self.assertIn("latitude", s)
                    self.assertIn("longitude", s)

    def test_adapter_converts_frame_to_detections(self):
        frames, _ = ALL_SCENARIOS["A_single_storm"]()
        detections = frame_dict_to_detections(frames[0])
        self.assertEqual(len(detections), len(frames[0]["storms"]))
        self.assertEqual(detections[0].latitude, frames[0]["storms"][0]["latitude"])

    def test_full_pipeline_runs_on_every_scenario_without_crashing(self):
        for name, fn in ALL_SCENARIOS.items():
            frames, _ = fn()
            tracker = StormTracker()
            for frame in frames:
                detections = frame_dict_to_detections(frame)
                tracker.update(detections[0].timestamp if detections else _parse(frame["timestamp"]), detections)
            # Should not have crashed, and should have produced at least one track
            self.assertTrue(len(tracker.get_all_tracks()) >= 1, f"{name} produced no tracks")


def _parse(ts):
    from storm_tracking.geo import parse_utc
    return parse_utc(ts)


if __name__ == "__main__":
    unittest.main()
