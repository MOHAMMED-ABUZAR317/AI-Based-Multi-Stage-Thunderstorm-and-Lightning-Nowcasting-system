import unittest
from datetime import datetime, timedelta, timezone
import conftest_paths  # noqa: F401

from storm_tracking.models import Detection
from storm_tracking.tracker import StormTracker
from storm_tracking.trajectory import predict_trajectory
from storm_tracking.arrival import estimate_arrival_time
from storm_tracking.geo import destination_point, haversine_distance_km

T0 = datetime(2026, 6, 15, 14, 0, 0, tzinfo=timezone.utc)


def det(det_id, lat, lon, t):
    return Detection(detection_id=det_id, timestamp=t, latitude=lat, longitude=lon)


def build_moving_track(bearing=45.0, speed_kmh=30.0, n=4, interval_min=5):
    tracker = StormTracker()
    lat, lon = 17.40, 78.40
    t = T0
    for i in range(n):
        tracker.update(t, [det(f"d{i}", lat, lon, t)])
        lat, lon = destination_point(lat, lon, bearing, speed_kmh * (interval_min / 60.0))
        t = t + timedelta(minutes=interval_min)
    return tracker.get_all_tracks()[0]


class TestTrajectoryPrediction(unittest.TestCase):
    def test_no_prediction_with_single_observation(self):
        tracker = StormTracker()
        tracker.update(T0, [det("d0", 17.4, 78.4, T0)])
        track = tracker.get_all_tracks()[0]
        self.assertIsNone(predict_trajectory(track))

    def test_prediction_present_after_two_observations(self):
        track = build_moving_track(n=2)
        result = predict_trajectory(track)
        self.assertIsNotNone(result)
        self.assertIn("15min", result["predictions"])
        self.assertIn("30min", result["predictions"])
        self.assertIn("60min", result["predictions"])

    def test_prediction_direction_matches_actual_motion(self):
        track = build_moving_track(bearing=90.0, speed_kmh=40.0, n=3)  # due east
        result = predict_trajectory(track)
        self.assertAlmostEqual(result["motion"]["direction_degrees"], 90.0, delta=2.0)
        self.assertEqual(result["motion"]["direction"], "E")

    def test_prediction_distance_scales_with_horizon(self):
        track = build_moving_track(bearing=45.0, speed_kmh=30.0, n=3)
        result = predict_trajectory(track)
        cur = result["current_position"]
        d15 = haversine_distance_km(cur["latitude"], cur["longitude"],
                                     result["predictions"]["15min"]["latitude"],
                                     result["predictions"]["15min"]["longitude"])
        d60 = haversine_distance_km(cur["latitude"], cur["longitude"],
                                     result["predictions"]["60min"]["latitude"],
                                     result["predictions"]["60min"]["longitude"])
        self.assertAlmostEqual(d15, 30.0 * 0.25, delta=1.0)
        self.assertAlmostEqual(d60, 30.0 * 1.0, delta=1.0)
        self.assertGreater(d60, d15)


class TestArrivalEstimation(unittest.TestCase):
    def test_target_directly_ahead_is_reached(self):
        track = build_moving_track(bearing=0.0, speed_kmh=60.0, n=3)  # due north
        latest = track.latest()
        target_lat, target_lon = destination_point(
            latest.smoothed_latitude, latest.smoothed_longitude, 0.0, 60.0
        )  # exactly 60km north = 1 hour away
        result = estimate_arrival_time(track, target_lat, target_lon)
        self.assertTrue(result["will_reach"])
        self.assertAlmostEqual(result["minutes_until_arrival"], 60.0, delta=2.0)
        self.assertIsNotNone(result["estimated_arrival_time"])

    def test_target_behind_storm_is_not_reached(self):
        track = build_moving_track(bearing=0.0, speed_kmh=60.0, n=3)  # heading north
        latest = track.latest()
        target_lat, target_lon = destination_point(
            latest.smoothed_latitude, latest.smoothed_longitude, 180.0, 60.0
        )  # 60km behind (south)
        result = estimate_arrival_time(track, target_lat, target_lon)
        self.assertFalse(result["will_reach"])

    def test_target_far_off_trajectory_line_is_not_reached(self):
        track = build_moving_track(bearing=0.0, speed_kmh=60.0, n=3)  # heading north
        latest = track.latest()
        target_lat, target_lon = destination_point(
            latest.smoothed_latitude, latest.smoothed_longitude, 90.0, 200.0
        )  # 200km due east, well off the northward line
        result = estimate_arrival_time(track, target_lat, target_lon)
        self.assertFalse(result["will_reach"])

    def test_no_motion_estimate_yet(self):
        tracker = StormTracker()
        tracker.update(T0, [det("d0", 17.4, 78.4, T0)])
        track = tracker.get_all_tracks()[0]
        result = estimate_arrival_time(track, 18.0, 79.0)
        self.assertFalse(result["will_reach"])
        self.assertIsNone(result["estimated_arrival_time"])


if __name__ == "__main__":
    unittest.main()
