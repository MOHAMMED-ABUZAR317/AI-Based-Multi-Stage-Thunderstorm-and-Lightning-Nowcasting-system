# Member 4: Real-World Limitations

This module uses a simple, explainable baseline. It is a good starting
point, not a finished physical model of storm behaviour. Known limitations:

1. **Storm motion is not always linear.** The tracker fits a trend
   (linear regression by default) over the last few observed positions and
   assumes it continues unchanged. Real storms curve, accelerate, and
   decelerate.

2. **Storms can accelerate or decelerate.** Speed is estimated from the two
   (or few) most recent legs only; a sudden speed change will not be
   reflected until new detections arrive.

3. **Storms can change direction.** `direction_degrees` is the most
   recently observed bearing (or a short trend fit), not a forecast of
   future turning. Scenario I in the synthetic test suite specifically
   exercises this and shows prediction error growing as the true storm
   curves away from the extrapolated straight line.

4. **Cells can merge.** `events.py` only flags "possible_merge" when two
   tracked storms' positions come within `merge_distance_km` of each other.
   It does not model the resulting combined storm's new motion or intensity.

5. **Cells can split.** Split detection is a best-effort heuristic
   (`detect_split_from_matches`) triggered when more than one detection is
   plausibly the successor of a single previous storm. It is not a
   validated split-tracking algorithm.

6. **Detection errors propagate into tracking.** If Member 2's detector
   produces a noisy or offset centroid, that error flows directly into
   speed/direction estimates and therefore into every downstream
   prediction. Smoothing (`motion.py`) reduces but does not eliminate this.

7. **Long-horizon uncertainty increases.** A +15 minute forecast is a much
   smaller extrapolation than a +180 minute forecast under the same
   constant-velocity assumption. `trajectory_confidence` does not currently
   vary by horizon - it reflects confidence in the *current* motion
   estimate, not in how far that estimate can safely be projected. This is
   a known gap for future work (e.g. widening an uncertainty radius with
   horizon length).

8. **Storm propagation is not identical to centroid movement.** Real storm
   cells grow, shrink, and can propagate (regenerate) in a preferred
   direction relative to their bulk motion (e.g. discrete propagation along
   a boundary). This module only tracks the geometric centroid.

9. **`trajectory_confidence` is a heuristic, not a calibrated probability.**
   It has not been validated against a labelled set of real storm outcomes.
   Treat a value of, say, 0.8 as "several stability signals look good," not
   as "correct 80% of the time."

10. **Matching is greedy, not globally optimal.** In frames with several
    storms close together, a full Hungarian assignment could occasionally
    produce a better global match than the current nearest-neighbour-first
    approach (see the architecture doc's upgrade table).

These limitations should be stated plainly in any hackathon presentation of
this module - they are the reason the module reports `observed`,
`estimated`, and `predicted` values separately rather than presenting a
single number as fact.
