import unittest
from datetime import datetime, timedelta, timezone
import conftest_paths  # noqa: F401

from storm_tracking.models import Detection
from storm_tracking.tracker import StormTracker
from storm_tracking.config import TrackingConfig
from storm_tracking.confidence import compute_trajectory_confidence

T0 = datetime(2026, 6, 15, 14, 0, 0, tzinfo=timezone.utc)


def det(det_id, lat, lon, t):
    return Detection(detection_id=det_id, timestamp=t, latitude=lat, longitude=lon)


class TestMergeDetection(unittest.TestCase):
    def test_two_close_storms_flagged_as_possible_merge(self):
        config = TrackingConfig(merge_distance_km=20.0)
        tracker = StormTracker(config)
        t1, t2 = T0, T0 + timedelta(minutes=5)
        # Two storms starting far apart, converging to within merge_distance_km
        tracker.update(t1, [det("a1", 17.00, 78.00, t1), det("b1", 17.30, 78.30, t1)])
        tracker.update(t2, [det("a2", 17.10, 78.10, t2), det("b2", 17.15, 78.15, t2)])

        merge_events = [e for e in tracker.events if e.event_type == "possible_merge"]
        self.assertTrue(len(merge_events) >= 1)

    def test_distant_storms_not_flagged(self):
        config = TrackingConfig(merge_distance_km=5.0)
        tracker = StormTracker(config)
        t1 = T0
        tracker.update(t1, [det("a1", 17.00, 78.00, t1), det("b1", 20.00, 82.00, t1)])
        merge_events = [e for e in tracker.events if e.event_type == "possible_merge"]
        self.assertEqual(len(merge_events), 0)


class TestConfidence(unittest.TestCase):
    def test_confidence_none_with_single_observation(self):
        tracker = StormTracker()
        tracker.update(T0, [det("d0", 17.4, 78.4, T0)])
        track = tracker.get_all_tracks()[0]
        self.assertIsNone(compute_trajectory_confidence(track))

    def test_confidence_increases_with_stable_consistent_motion(self):
        tracker = StormTracker()
        lat, lon = 17.40, 78.40
        t = T0
        confidences = []
        for i in range(6):
            tracker.update(t, [det(f"d{i}", lat, lon, t)])
            track = tracker.get_all_tracks()[0]
            if track.trajectory_confidence is not None:
                confidences.append(track.trajectory_confidence)
            lat += 0.04
            lon += 0.04
            t = t + timedelta(minutes=5)
        # confidence should generally trend up (more history) for perfectly
        # consistent straight-line motion
        self.assertTrue(confidences[-1] >= confidences[0])

    def test_confidence_is_bounded(self):
        tracker = StormTracker()
        lat, lon = 17.40, 78.40
        t = T0
        for i in range(5):
            tracker.update(t, [det(f"d{i}", lat, lon, t)])
            lat += 0.03
            t = t + timedelta(minutes=5)
        track = tracker.get_all_tracks()[0]
        conf = compute_trajectory_confidence(track)
        self.assertGreaterEqual(conf, 0.0)
        self.assertLessEqual(conf, 1.0)


if __name__ == "__main__":
    unittest.main()
