import unittest
from datetime import datetime, timezone
import conftest_paths  # noqa: F401

from storm_tracking.models import Detection
from storm_tracking.validation import validate_detection, validate_frame_detections, validate_frame_ordering
from storm_tracking.config import DEFAULT_CONFIG


def make_det(**overrides):
    base = dict(
        detection_id="d1",
        timestamp=datetime(2026, 6, 15, 14, 0, tzinfo=timezone.utc),
        latitude=17.4,
        longitude=78.4,
    )
    base.update(overrides)
    return Detection(**base)


class TestValidateDetection(unittest.TestCase):
    def test_valid_detection_passes(self):
        ok, reasons = validate_detection(make_det())
        self.assertTrue(ok)
        self.assertEqual(reasons, [])

    def test_invalid_latitude(self):
        ok, reasons = validate_detection(make_det(latitude=999))
        self.assertFalse(ok)
        self.assertTrue(any("latitude" in r for r in reasons))

    def test_invalid_longitude(self):
        ok, reasons = validate_detection(make_det(longitude=-999))
        self.assertFalse(ok)
        self.assertTrue(any("longitude" in r for r in reasons))

    def test_negative_intensity(self):
        ok, reasons = validate_detection(make_det(intensity=-1))
        self.assertFalse(ok)

    def test_confidence_out_of_range(self):
        ok, reasons = validate_detection(make_det(confidence=1.5))
        self.assertFalse(ok)

    def test_missing_timestamp(self):
        ok, reasons = validate_detection(make_det(timestamp=None))
        self.assertFalse(ok)


class TestValidateFrame(unittest.TestCase):
    def test_drops_invalid_and_keeps_valid(self):
        dets = [make_det(detection_id="good"), make_det(detection_id="bad", latitude=500)]
        valid, issues = validate_frame_detections(dets, DEFAULT_CONFIG)
        self.assertEqual(len(valid), 1)
        self.assertEqual(valid[0].detection_id, "good")
        self.assertEqual(len(issues), 1)

    def test_drops_duplicate_ids(self):
        dets = [make_det(detection_id="d1"), make_det(detection_id="d1", latitude=17.5)]
        valid, issues = validate_frame_detections(dets, DEFAULT_CONFIG)
        self.assertEqual(len(valid), 1)
        self.assertEqual(len(issues), 1)

    def test_empty_frame_is_fine(self):
        valid, issues = validate_frame_detections([], DEFAULT_CONFIG)
        self.assertEqual(valid, [])
        self.assertEqual(issues, [])


class TestFrameOrdering(unittest.TestCase):
    def test_first_frame_always_ok(self):
        self.assertTrue(validate_frame_ordering(None, datetime(2026, 1, 1)))

    def test_increasing_timestamps_ok(self):
        self.assertTrue(validate_frame_ordering(datetime(2026, 1, 1, 0, 0), datetime(2026, 1, 1, 0, 5)))

    def test_decreasing_timestamps_flagged(self):
        self.assertFalse(validate_frame_ordering(datetime(2026, 1, 1, 0, 5), datetime(2026, 1, 1, 0, 0)))


if __name__ == "__main__":
    unittest.main()
