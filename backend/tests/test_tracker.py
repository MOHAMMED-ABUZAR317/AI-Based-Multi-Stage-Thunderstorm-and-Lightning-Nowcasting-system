import unittest
from datetime import datetime, timedelta, timezone
import conftest_paths  # noqa: F401

from storm_tracking.models import Detection
from storm_tracking.tracker import StormTracker
from storm_tracking.config import TrackingConfig

T0 = datetime(2026, 6, 15, 14, 0, 0, tzinfo=timezone.utc)


def det(det_id, lat, lon, t=T0):
    return Detection(detection_id=det_id, timestamp=t, latitude=lat, longitude=lon)


class TestBasicTracking(unittest.TestCase):
    def test_single_storm_keeps_same_id_across_frames(self):
        tracker = StormTracker()
        t1 = T0
        t2 = T0 + timedelta(minutes=5)
        t3 = T0 + timedelta(minutes=10)

        tracker.update(t1, [det("d1", 17.40, 78.40, t1)])
        active = tracker.update(t2, [det("d2", 17.44, 78.44, t2)])
        self.assertEqual(len(active), 1)
        storm_id = active[0].storm_id

        active = tracker.update(t3, [det("d3", 17.48, 78.48, t3)])
        self.assertEqual(len(active), 1)
        self.assertEqual(active[0].storm_id, storm_id, "storm ID must remain stable across frames")

    def test_new_storm_gets_new_id(self):
        tracker = StormTracker()
        t1, t2 = T0, T0 + timedelta(minutes=5)
        tracker.update(t1, [det("d1", 17.40, 78.40, t1)])
        active = tracker.update(t2, [det("d2", 17.44, 78.44, t2), det("d3", 20.0, 80.0, t2)])
        self.assertEqual(len(active), 2)
        ids = {a.storm_id for a in active}
        self.assertEqual(len(ids), 2)

    def test_far_detection_does_not_match(self):
        config = TrackingConfig(maximum_matching_distance_km=10.0)
        tracker = StormTracker(config)
        t1, t2 = T0, T0 + timedelta(minutes=5)
        tracker.update(t1, [det("d1", 17.40, 78.40, t1)])
        active = tracker.update(t2, [det("d2", 20.0, 82.0, t2)])  # very far away
        # Should be treated as a new storm, not matched to the far-away one
        self.assertEqual(len(active), 1)
        # The old storm should now be "missing" (not ended after just 1 frame)
        all_tracks = tracker.get_all_tracks()
        self.assertEqual(len(all_tracks), 2)

    def test_missing_frame_then_return(self):
        config = TrackingConfig(missing_frame_tolerance=2)
        tracker = StormTracker(config)
        t1 = T0
        t2 = T0 + timedelta(minutes=5)
        t3 = T0 + timedelta(minutes=10)

        tracker.update(t1, [det("d1", 17.40, 78.40, t1)])
        active_after_gap = tracker.update(t2, [])  # storm undetected this frame
        self.assertEqual(len(active_after_gap), 0)

        active = tracker.update(t3, [det("d3", 17.48, 78.48, t3)])
        self.assertEqual(len(active), 1, "storm should be re-matched after a single missing frame")

    def test_storm_ends_after_exceeding_missing_tolerance(self):
        config = TrackingConfig(missing_frame_tolerance=1)
        tracker = StormTracker(config)
        t1 = T0
        t2 = T0 + timedelta(minutes=5)
        t3 = T0 + timedelta(minutes=10)
        t4 = T0 + timedelta(minutes=15)

        tracker.update(t1, [det("d1", 17.40, 78.40, t1)])
        tracker.update(t2, [])
        tracker.update(t3, [])  # exceeds tolerance of 1 -> ended
        tracker.update(t4, [det("d4", 30.0, 90.0, t4)])  # unrelated far new storm

        all_tracks = tracker.get_all_tracks()
        original = [t for t in all_tracks if t.storm_id == "S01"][0]
        self.assertEqual(original.status, "ended")

    def test_empty_frame_does_not_crash(self):
        tracker = StormTracker()
        active = tracker.update(T0, [])
        self.assertEqual(active, [])

    def test_multiple_independent_storms_tracked_separately(self):
        tracker = StormTracker()
        t1, t2, t3 = T0, T0 + timedelta(minutes=5), T0 + timedelta(minutes=10)
        tracker.update(t1, [det("a1", 17.0, 78.0, t1), det("b1", 20.0, 80.0, t1)])
        tracker.update(t2, [det("a2", 17.05, 78.05, t2), det("b2", 19.95, 79.95, t2)])
        active = tracker.update(t3, [det("a3", 17.10, 78.10, t3), det("b3", 19.90, 79.90, t3)])
        self.assertEqual(len(active), 2)
        for track in active:
            self.assertEqual(track.observation_count(), 3)


if __name__ == "__main__":
    unittest.main()
