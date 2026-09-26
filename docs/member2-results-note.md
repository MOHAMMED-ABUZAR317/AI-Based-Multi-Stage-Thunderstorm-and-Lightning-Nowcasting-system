# INSAT-3DR TIR temperature check near Hyderabad

## Data and method

Four INSAT-3DR L1C files for 25 September 2026 were inspected. The files contain `TIR1_BT` and `TIR2_BT` brightness-temperature arrays in kelvins, with a fill value of −999. Values below are read directly from those calibrated brightness-temperature datasets; no extra radiance conversion was applied.

Hyderabad’s approximate city-center coordinate (17.385°N, 78.4867°E) was mapped to the nearest projected grid pixel (row 1115, column 1628). A 3×3 pixel neighborhood around that point was also averaged. The array spacing is about 4 km per pixel.

## Temperatures

| GMT | TIR1 point (K) | TIR2 point (K) | TIR1 3×3 mean (K) | TIR2 3×3 mean (K) |
|---|---:|---:|---:|---:|
| 00:15 | 231.54 | 230.30 | 233.10 | 231.03 |
| 00:45 | 227.77 | 227.02 | 228.84 | 226.76 |
| 01:15 | 222.68 | 219.41 | 227.47 | 224.18 |
| 01:45 | 222.47 | 219.88 | 225.54 | 222.07 |

Across the 90 minutes from 00:15 to 01:45 GMT:

- The point pixel cooled by 9.07 K in TIR1 (−6.05 K/hour) and 10.42 K in TIR2 (−6.95 K/hour).
- The 3×3 mean cooled by 7.56 K in TIR1 (−5.04 K/hour) and 8.96 K in TIR2 (−5.97 K/hour).

Rate formula: `(temperature at 01:45 − temperature at 00:15) ÷ 1.5 hours`.

## Spatial view

The four TIR2 maps use one shared color scale and mark Hyderabad. The colder cloud pattern changes position and shape across the snapshots. This means a temperature change at one fixed pixel may partly reflect cloud movement.

![Four TIR2 brightness-temperature maps near Hyderabad](tir2-hyderabad-four-times.png)

## Interpretation and next analysis

The measurements show cooling in brightness temperature near Hyderabad during this period. They do not by themselves confirm storm intensification. To estimate cold-cloud coverage, I added a provisional threshold comparison below because the project brief was not available. Confirm or replace these thresholds with the project requirement if one is supplied.


## Provisional cold-cloud coverage comparison

Because no project-specific threshold was available, I compared two published IR brightness-temperature cutoffs using **TIR1_BT** (10.785 µm), the file's channel closest to the approximately 10.8–11 µm infrared window used in these methods. Prior work uses 235 K for high-cloud/cloud-cluster detection, while stricter values around 208–210 K have been used for deep-convective clouds; there is no universal cutoff, and threshold changes can materially change detections. An India-focused INSAT-3D thunderstorm method uses the 10.8 µm IR channel; this comparison should still be checked against the project instructions.

For each time, I counted valid pixels at or below each threshold in the same 201×201-pixel window centered on Hyderabad (all 40,401 pixels were valid). Pixel areas were estimated from the file's projected X/Y grid and ellipsoid metadata. The window covers approximately 588,704 km² on the ground.

| GMT | TIR1 ≤235 K area (window share) | TIR1 ≤210 K area (window share) |
|---|---:|---:|
| 00:15 | 216,945 km² (36.85%) | 95,002 km² (16.14%) |
| 00:45 | 211,850 km² (35.99%) | 89,404 km² (15.19%) |
| 01:15 | 206,550 km² (35.09%) | 85,238 km² (14.48%) |
| 01:45 | 200,534 km² (34.06%) | 75,756 km² (12.87%) |

Within this fixed window, the ≤235 K coverage decreased by about 7.6% and the ≤210 K coverage by about 20.3% from the first to last image. These are **thresholded cold-pixel areas in a large fixed window**, not the measured area of one storm. The largest connected cold-pixel region touches the window boundary in every image, so its full extent is outside the crop. Cloud movement also changes the window coverage. Do not interpret this decline by itself as storm weakening or dissipation.

### References for the provisional thresholds

- Goyal et al. (2017), *Satellite-based technique for nowcasting of thunderstorms over Indian region*, used INSAT-3D's approximately 10.8 µm infrared channel: https://doi.org/10.1007/s12040-017-0859-2
- Vila et al. (2008), *Forecast and Tracking the Evolution of Cloud Clusters (ForTraCC) Using Satellite Infrared Imagery: Methodology and Validation*, describes 235 K cloud-cluster detection and size-based tracking: https://journals.ametsoc.org/view/journals/wefo/23/2/2007waf2006121_1.xml
- Kotarba and Wojciechowska (2025), *Satellite-based detection of deep-convective clouds: the sensitivity of infrared methods and implications for cloud climatology*, discusses the range of thresholds, no universal cutoff, and detection uncertainty: https://doi.org/10.5194/amt-18-2721-2025

## Cluster tracking follow-up

To follow individual cloud objects rather than all cold pixels in the smaller window, I used a larger 600×600-pixel region centered on Hyderabad and grouped 8-neighbor connected pixels. I retained components with estimated ground area of at least 2,400 km², then matched each next-time component to the previous one by greatest pixel overlap. This follows the general published cluster-detection and overlap-tracking approach; the infrared threshold remains provisional.

| GMT | 235 K cloud shield area | 235 K centroid | 210 K colder core area | 210 K centroid |
|---|---:|---|---:|---|
| 00:15 | 563,436 km² | 18.008°N, 82.432°E | 112,934 km² | 19.579°N, 81.202°E |
| 00:45 | 567,216 km² | 18.285°N, 82.602°E | 112,715 km² | 19.601°N, 81.232°E |
| 01:15 | 592,849 km² | 18.245°N, 82.701°E | 112,151 km² | 19.689°N, 81.216°E |
| 01:45 | 606,950 km² | 18.107°N, 82.792°E | 103,576 km² | 19.879°N, 81.171°E |

The tracked 235 K cloud shield expands by about 7.7% and its centroid shifts about 40 km east-northeast over 90 minutes. The 210 K core shrinks by about 8.3% and its centroid shifts north. Both tracked features are roughly 375–465 km from Hyderabad, so these numbers describe a nearby larger cloud system, not a storm centered over Hyderabad. The tracking is consistent across frames by spatial overlap, but four snapshots and IR temperature alone do not establish storm intensity or rainfall.

