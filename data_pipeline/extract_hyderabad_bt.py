"""Extract INSAT-3DR brightness temperatures around Hyderabad from HDF5 files."""

from __future__ import annotations

import argparse
import csv
import math
import os
import re
import tempfile
from datetime import datetime
from pathlib import Path
from typing import Any


TARGET_LATITUDE = 17.385
TARGET_LONGITUDE = 78.4867
FILL_VALUE = -999.0
CENTRAL_LONGITUDE = 75.0
SEMI_MAJOR_AXIS_M = 6378137.0
SEMI_MINOR_AXIS_M = 6356752.3142
EXPECTED_TARGET_PIXEL = (1115, 1628)
INPUT_PATTERN = "3RIMG_*_L1C_SGP_V01R00_B34.h5"
OUTPUT_FILENAME = "hyderabad_bt_neighborhood.csv"
BANDS = ("TIR1_BT", "TIR2_BT")
MONTH_NUMBERS = {
    month: number
    for number, month in enumerate(
        ("JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"),
        start=1,
    )
}
CSV_FIELDS = (
    "acquisition_time",
    "source_file",
    "band",
    "target_latitude",
    "target_longitude",
    "target_projected_x_m",
    "target_projected_y_m",
    "target_pixel_row",
    "target_pixel_column",
    "pixel_row",
    "pixel_column",
    "row_offset",
    "column_offset",
    "is_point",
    "pixel_x_m",
    "pixel_y_m",
    "brightness_temperature_k",
)


def _normalized_path(value: str) -> str:
    return value.strip("/").casefold()


def _find_dataset(handle: Any, h5py: Any, name: str, explicit_path: str | None = None) -> Any:
    datasets: list[tuple[str, Any]] = []
    handle.visititems(
        lambda path, item: datasets.append((path, item))
        if isinstance(item, h5py.Dataset)
        else None
    )

    if explicit_path:
        requested = _normalized_path(explicit_path)
        matches = [item for path, item in datasets if _normalized_path(path) == requested]
    elif name in (*BANDS, "X", "Y"):
        matches = [
            item
            for path, item in datasets
            if path.rsplit("/", 1)[-1].casefold() == name.casefold()
        ]
    else:
        matches = []

    if len(matches) != 1:
        available = ", ".join(path for path, _ in datasets) or "none"
        if not matches:
            raise ValueError(
                f"Could not find an unambiguous {name} dataset. Available datasets: {available}"
            )
        raise ValueError(
            f"Found multiple datasets for {name}; use the corresponding dataset-path option. "
            f"Available datasets: {available}"
        )
    return matches[0]


def _find_projection_info(handle: Any, h5py: Any, explicit_path: str | None) -> Any:
    objects: list[tuple[str, Any]] = []
    handle.visititems(lambda path, item: objects.append((path, item)))
    if explicit_path:
        requested = _normalized_path(explicit_path)
        matches = [item for path, item in objects if _normalized_path(path) == requested]
    else:
        matches = [
            item
            for path, item in objects
            if path.rsplit("/", 1)[-1].casefold() == "projection_information"
            and isinstance(item, (h5py.Group, h5py.Dataset))
        ]
    if len(matches) != 1:
        raise ValueError(
            "Could not find one Projection_Information group or dataset; "
            "use --projection-info to specify its exact HDF5 path"
        )
    return matches[0]


def _acquisition_time(path: Path) -> datetime:
    match = re.search(r"_(\d{2}[A-Z]{3}\d{4})_(\d{4})_L1C_", path.name, re.IGNORECASE)
    if not match:
        raise ValueError(f"Could not parse acquisition date/time from filename: {path.name}")
    date_part, time_part = (part.upper() for part in match.groups())
    month = MONTH_NUMBERS.get(date_part[2:5])
    if month is None:
        raise ValueError(f"Could not parse acquisition month from filename: {path.name}")
    return datetime(
        int(date_part[5:]),
        month,
        int(date_part[:2]),
        int(time_part[:2]),
        int(time_part[2:]),
    )


def _metadata_string(value: Any) -> str:
    if isinstance(value, bytes):
        return value.decode("utf-8", errors="replace")
    if hasattr(value, "tolist"):
        value = value.tolist()
    if isinstance(value, (list, tuple)):
        return " ".join(_metadata_string(part) for part in value)
    return str(value)


def _projection_parameters(
    projection_info: Any,
    h5py: Any,
) -> tuple[float, float, float]:
    metadata: dict[str, str] = {}
    text_values: list[str] = []

    def collect(item: Any) -> None:
        for key, value in item.attrs.items():
            text = _metadata_string(value)
            metadata[re.sub(r"[^a-z0-9]", "", key.casefold())] = text
            text_values.append(f"{key}: {text}")
        if isinstance(item, h5py.Dataset):
            text_values.append(_metadata_string(item[()]))

    collect(projection_info)
    if isinstance(projection_info, h5py.Group):
        projection_info.visititems(lambda _name, item: collect(item))

    for segment in re.split(r"[\r\n;,]+", "\n".join(text_values)):
        match = re.match(r"\s*([A-Za-z][A-Za-z0-9 _-]*)\s*[:=]\s*(.*?)\s*$", segment)
        if match:
            key = re.sub(r"[^a-z0-9]", "", match.group(1).casefold())
            metadata.setdefault(key, match.group(2))

    all_metadata_text = " ".join(text_values + list(metadata.values()))
    if "mercator" not in all_metadata_text.casefold():
        raise ValueError("Projection_Information does not identify a Mercator projection")

    number_pattern = re.compile(r"[-+]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][-+]?\d+)?")

    def parameter(names: tuple[str, ...], fallback: float) -> float:
        for name in names:
            if name in metadata:
                match = number_pattern.search(metadata[name])
                if match:
                    return float(match.group())
        return fallback

    central_longitude = parameter(
        ("centrallongitude", "longitudeofprojectionorigin", "longitudeoforigin", "lon0"),
        CENTRAL_LONGITUDE,
    )
    semi_major_axis = parameter(
        ("semimajoraxis", "semimajoraxism", "semimajoraxisofellipsoid"), SEMI_MAJOR_AXIS_M
    )
    semi_minor_axis = parameter(
        ("semiminoraxis", "semiminoraxism", "semiminoraxisofellipsoid"), SEMI_MINOR_AXIS_M
    )
    if semi_major_axis <= 0 or semi_minor_axis <= 0 or semi_minor_axis > semi_major_axis:
        raise ValueError(
            "Projection_Information contains invalid ellipsoid axes: "
            f"semi-major={semi_major_axis}, semi-minor={semi_minor_axis}"
        )
    return central_longitude, semi_major_axis, semi_minor_axis


def _mercator_xy(
    latitude: float,
    longitude: float,
    central_longitude: float,
    semi_major_axis: float,
    semi_minor_axis: float,
) -> tuple[float, float]:
    latitude_radians = math.radians(latitude)
    eccentricity = math.sqrt(1.0 - (semi_minor_axis / semi_major_axis) ** 2)
    sine_latitude = math.sin(latitude_radians)
    x_coordinate = semi_major_axis * math.radians(longitude - central_longitude)
    y_coordinate = semi_major_axis * math.log(
        math.tan(math.pi / 4.0 + latitude_radians / 2.0)
        * ((1.0 - eccentricity * sine_latitude) / (1.0 + eccentricity * sine_latitude))
        ** (eccentricity / 2.0)
    )
    return x_coordinate, y_coordinate


def _nearest_axis_index(coordinates: Any, target: float, name: str) -> int:
    candidates = [
        (abs(float(value) - target), index)
        for index, value in enumerate(coordinates)
        if math.isfinite(float(value))
    ]
    if not candidates:
        raise ValueError(f"{name} coordinate vector contains no finite values")
    return min(candidates)[1]


def _read_file(
    path: Path,
    x_dataset: str | None,
    y_dataset: str | None,
    projection_info_path: str | None,
    h5py: Any,
    np: Any,
) -> tuple[datetime, tuple[int, int], Any, Any, Any, Any, float, float]:
    with h5py.File(path, "r") as handle:
        band_arrays = {
            band: np.asarray(_find_dataset(handle, h5py, band)[0, :, :], dtype=np.float64)
            for band in BANDS
        }
        x_coordinates = np.asarray(
            _find_dataset(handle, h5py, "X", x_dataset)[...], dtype=np.float64
        )
        y_coordinates = np.asarray(
            _find_dataset(handle, h5py, "Y", y_dataset)[...], dtype=np.float64
        )
        projection_info = _find_projection_info(handle, h5py, projection_info_path)
        projection = _projection_parameters(projection_info, h5py)

    image_shape = band_arrays[BANDS[0]].shape
    if (
        len(image_shape) != 2
        or band_arrays[BANDS[1]].shape != image_shape
        or x_coordinates.ndim != 1
        or y_coordinates.ndim != 1
        or x_coordinates.shape[0] != image_shape[1]
        or y_coordinates.shape[0] != image_shape[0]
    ):
        raise ValueError(
            f"{path.name}: expected matching first slices of TIR1_BT/TIR2_BT and 1D X/Y "
            f"vectors matching image rows/columns; got image shapes "
            f"{image_shape} and {band_arrays[BANDS[1]].shape}, X={x_coordinates.shape}, "
            f"Y={y_coordinates.shape}"
        )

    target_x, target_y = _mercator_xy(TARGET_LATITUDE, TARGET_LONGITUDE, *projection)
    target_pixel = (
        _nearest_axis_index(y_coordinates, target_y, "Y"),
        _nearest_axis_index(x_coordinates, target_x, "X"),
    )
    if target_pixel != EXPECTED_TARGET_PIXEL:
        raise ValueError(
            f"{path.name}: projected nearest pixel is row {target_pixel[0]}, column "
            f"{target_pixel[1]}, expected row {EXPECTED_TARGET_PIXEL[0]}, "
            f"column {EXPECTED_TARGET_PIXEL[1]}; check X/Y vectors and Projection_Information"
        )

    return (
        _acquisition_time(path),
        target_pixel,
        band_arrays[BANDS[0]],
        band_arrays[BANDS[1]],
        x_coordinates,
        y_coordinates,
        target_x,
        target_y,
    )


def _rows_for_file(
    path: Path,
    x_dataset: str | None,
    y_dataset: str | None,
    projection_info_path: str | None,
    h5py: Any,
    np: Any,
) -> list[dict[str, object]]:
    (
        timestamp,
        (center_row, center_column),
        tir1,
        tir2,
        x_coordinates,
        y_coordinates,
        target_x,
        target_y,
    ) = _read_file(path, x_dataset, y_dataset, projection_info_path, h5py, np)
    rows: list[dict[str, object]] = []

    for band, image in ((BANDS[0], tir1), (BANDS[1], tir2)):
        for row_offset in (-1, 0, 1):
            for column_offset in (-1, 0, 1):
                pixel_row = center_row + row_offset
                pixel_column = center_column + column_offset
                if not (0 <= pixel_row < image.shape[0] and 0 <= pixel_column < image.shape[1]):
                    continue

                temperature = float(image[pixel_row, pixel_column])
                if not math.isfinite(temperature) or temperature == FILL_VALUE:
                    continue

                rows.append(
                    {
                        "acquisition_time": timestamp.isoformat(timespec="minutes"),
                        "source_file": path.name,
                        "band": band,
                        "target_latitude": TARGET_LATITUDE,
                        "target_longitude": TARGET_LONGITUDE,
                        "target_projected_x_m": target_x,
                        "target_projected_y_m": target_y,
                        "target_pixel_row": center_row,
                        "target_pixel_column": center_column,
                        "pixel_row": pixel_row,
                        "pixel_column": pixel_column,
                        "row_offset": row_offset,
                        "column_offset": column_offset,
                        "is_point": row_offset == 0 and column_offset == 0,
                        "pixel_x_m": float(x_coordinates[pixel_column]),
                        "pixel_y_m": float(y_coordinates[pixel_row]),
                        "brightness_temperature_k": temperature,
                    }
                )
    return rows


def _write_csv(rows: list[dict[str, object]], output_path: Path) -> None:
    temporary_path: Path | None = None
    try:
        with tempfile.NamedTemporaryFile(
            mode="w",
            encoding="utf-8",
            newline="",
            dir=output_path.parent,
            prefix=f".{output_path.name}.",
            suffix=".tmp",
            delete=False,
        ) as temporary_file:
            temporary_path = Path(temporary_file.name)
            writer = csv.DictWriter(temporary_file, fieldnames=CSV_FIELDS)
            writer.writeheader()
            writer.writerows(rows)
        os.replace(temporary_path, output_path)
    finally:
        if temporary_path is not None and temporary_path.exists():
            temporary_path.unlink()


def main() -> int:
    parser = argparse.ArgumentParser(
        description=(
            "Write point and 3x3-neighborhood TIR1_BT/TIR2_BT values around Hyderabad "
            "from INSAT-3DR HDF5 files. Source files are opened read-only."
        )
    )
    parser.add_argument("input_folder", type=Path, help="Folder containing matching INSAT-3DR .h5 files")
    parser.add_argument("output_folder", type=Path, help="Separate folder for the generated CSV")
    parser.add_argument("--x-dataset", help="Exact HDF5 path for the projected X coordinate vector")
    parser.add_argument("--y-dataset", help="Exact HDF5 path for the projected Y coordinate vector")
    parser.add_argument(
        "--projection-info",
        help="Exact HDF5 path for Projection_Information when automatic matching is ambiguous",
    )
    args = parser.parse_args()

    input_folder = args.input_folder.expanduser().resolve()
    output_folder = args.output_folder.expanduser().resolve()
    if not input_folder.is_dir():
        parser.error(f"input folder does not exist or is not a directory: {input_folder}")
    if (
        input_folder == output_folder
        or input_folder in output_folder.parents
        or output_folder in input_folder.parents
    ):
        parser.error("input and output folders must be separate, non-overlapping directories")

    files = sorted(input_folder.glob(INPUT_PATTERN), key=_acquisition_time)
    if not files:
        parser.error(f"no files matching {INPUT_PATTERN!r} found in {input_folder}")

    try:
        import h5py
        import numpy as np
    except ImportError as exc:
        raise SystemExit(
            "ACTUAL EXTRACTION NOT RUN: HDF5/NumPy dependencies are missing or unusable. "
            "Install them with 'py -m pip install -r data_pipeline/requirements.txt'. "
            f"Details: {exc}"
        ) from exc

    rows: list[dict[str, object]] = []
    try:
        for path in files:
            rows.extend(
                _rows_for_file(
                    path,
                    args.x_dataset,
                    args.y_dataset,
                    args.projection_info,
                    h5py,
                    np,
                )
            )
    except (OSError, ValueError) as exc:
        raise SystemExit(f"Extraction failed: {exc}") from exc

    output_folder.mkdir(parents=True, exist_ok=True)
    output_path = output_folder / OUTPUT_FILENAME
    _write_csv(rows, output_path)
    print(f"Processed {len(files)} HDF5 file(s); wrote {len(rows)} valid sample(s) to {output_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())