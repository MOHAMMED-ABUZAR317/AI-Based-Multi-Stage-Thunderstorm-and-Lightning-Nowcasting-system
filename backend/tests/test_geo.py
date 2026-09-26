import unittest
import conftest_paths  # noqa: F401  (sets up sys.path)

from storm_tracking.geo import (
    haversine_distance_km,
    initial_bearing_deg,
    bearing_to_compass,
    speed_kmh,
    destination_point,
    cross_track_distance_km,
)


class TestDistance(unittest.TestCase):
    def test_zero_distance_same_point(self):
        self.assertAlmostEqual(haversine_distance_km(17.4, 78.4, 17.4, 78.4), 0.0, places=6)

    def test_known_distance_hyderabad_bangalore(self):
        # Hyderabad ~17.385,78.4867 to Bangalore ~12.9716,77.5946 is ~500 km
        d = haversine_distance_km(17.385, 78.4867, 12.9716, 77.5946)
        self.assertTrue(490 <= d <= 510, f"expected ~500km, got {d}")

    def test_one_degree_latitude_is_about_111km(self):
        d = haversine_distance_km(17.0, 78.0, 18.0, 78.0)
        self.assertTrue(110 <= d <= 112, f"expected ~111km, got {d}")


class TestBearing(unittest.TestCase):
    def test_due_north(self):
        b = initial_bearing_deg(17.0, 78.0, 18.0, 78.0)
        self.assertAlmostEqual(b, 0.0, delta=0.5)

    def test_due_east(self):
        b = initial_bearing_deg(17.0, 78.0, 17.0, 79.0)
        self.assertAlmostEqual(b, 90.0, delta=1.0)

    def test_due_south(self):
        b = initial_bearing_deg(18.0, 78.0, 17.0, 78.0)
        self.assertAlmostEqual(b, 180.0, delta=0.5)

    def test_compass_conversion(self):
        self.assertEqual(bearing_to_compass(0), "N")
        self.assertEqual(bearing_to_compass(45), "NE")
        self.assertEqual(bearing_to_compass(90), "E")
        self.assertEqual(bearing_to_compass(180), "S")
        self.assertEqual(bearing_to_compass(270), "W")


class TestSpeed(unittest.TestCase):
    def test_speed_basic(self):
        # 30 km in 1 hour = 30 km/h
        self.assertAlmostEqual(speed_kmh(30, 3600), 30.0, places=6)

    def test_speed_zero_time(self):
        self.assertEqual(speed_kmh(10, 0), 0.0)


class TestDestinationPoint(unittest.TestCase):
    def test_round_trip_distance(self):
        lat, lon = destination_point(17.4, 78.4, 45.0, 50.0)
        d = haversine_distance_km(17.4, 78.4, lat, lon)
        self.assertAlmostEqual(d, 50.0, places=1)

    def test_destination_bearing_matches(self):
        lat, lon = destination_point(17.4, 78.4, 90.0, 20.0)
        b = initial_bearing_deg(17.4, 78.4, lat, lon)
        self.assertAlmostEqual(b, 90.0, delta=0.5)


class TestCrossTrack(unittest.TestCase):
    def test_point_on_the_line_has_zero_cross_track(self):
        lat0, lon0 = 17.4, 78.4
        bearing = 45.0
        on_line_lat, on_line_lon = destination_point(lat0, lon0, bearing, 40.0)
        xt = cross_track_distance_km(lat0, lon0, bearing, on_line_lat, on_line_lon)
        self.assertAlmostEqual(xt, 0.0, delta=0.5)

    def test_point_off_the_line_has_nonzero_cross_track(self):
        lat0, lon0 = 17.4, 78.4
        bearing = 0.0  # due north
        xt = cross_track_distance_km(lat0, lon0, bearing, 17.5, 79.0)
        self.assertGreater(xt, 10.0)


if __name__ == "__main__":
    unittest.main()
