"""Extract archived INSAT-3DR CTP samples near Hyderabad from supplied HDF5 files."""

from __future__ import annotations

import argparse
import csv
import math
from pathlib import Path

import h5py
import numpy as np

TARGET_LAT = 17.38
TARGET_LON = 78.48
OUTPUT_FIELDS = (
    "Timestamp_UTC",
    "File_Name",
    "Cloud_Top_Temp_K",
    "Cloud_Top_Pressure_hPa",
)


def _attribute_text(value: object) -> str:
    if isinstance(value, bytes):
        return value.decode("utf-8")
    if hasattr(value, "item"):
        value = value.item()
    if isinstance(value, bytes):
        return value.decode("utf-8")
    return str(value)


def extract_records(input_dir: Path) -> list[dict[str, object]]:
    files = sorted(
        path for path in input_dir.iterdir() if path.suffix.casefold() in {".h5", ".hdf"}
    )
    if not files:
        raise ValueError(f"No .h5/.hdf source files found in {input_dir}")

    records = []
    for path in files:
        try:
            with h5py.File(path, "r") as source:
                required = ("Latitude", "Longitude", "CTT", "CTP")
                missing = [name for name in required if name not in source]
                if missing:
                    raise ValueError(f"Missing datasets: {', '.join(missing)}")
                latitudes = np.asarray(source["Latitude"][:], dtype=float) / 100.0
                longitudes = np.asarray(source["Longitude"][:], dtype=float) / 100.0
                ctt = np.asarray(source["CTT"][0, :, :], dtype=float)
                ctp = np.asarray(source["CTP"][0, :, :], dtype=float)
                if not (
                    latitudes.shape == longitudes.shape == ctt.shape == ctp.shape
                ):
                    raise ValueError("Latitude, longitude, CTT, and CTP grids must match")
                longitude_scale = math.cos(math.radians(TARGET_LAT))
                distances = np.hypot(
                    latitudes - TARGET_LAT,
                    (longitudes - TARGET_LON) * longitude_scale,
                )
                valid = (
                    np.isfinite(distances)
                    & np.isfinite(ctt)
                    & np.isfinite(ctp)
                    & (ctt > 0)
                    & (ctt != -999.0)
                    & (ctp > 0)
                    & (ctp != -999.0)
                )
                if not np.any(valid):
                    raise ValueError("No valid cloud-top temperature and pressure pixels")
                indices = np.where(valid, distances, np.inf)
                row, column = np.unravel_index(np.argmin(indices), indices.shape)
                timestamp = source.attrs.get("Acquisition_Start_Time")
                if timestamp is None:
                    raise ValueError("Missing Acquisition_Start_Time metadata")
                records.append(
                    {
                        "Timestamp_UTC": _attribute_text(timestamp),
                        "File_Name": path.name,
                        "Cloud_Top_Temp_K": float(ctt[row, column]),
                        "Cloud_Top_Pressure_hPa": float(ctp[row, column]),
                    }
                )
        except (OSError, KeyError, ValueError) as error:
            raise ValueError(f"Could not process {path.name}: {error}") from error
    return records


def main() -> int:
    parser = argparse.ArgumentParser(
        description=(
            "Extract historical INSAT-3DR CTP samples near Hyderabad. "
            "This does not generate lightning predictions."
        )
    )
    parser.add_argument("input_dir", type=Path, help="Directory of supplied .h5/.hdf source files")
    parser.add_argument("output_csv", type=Path, help="Output CSV path (kept separate from bundled archives)")
    args = parser.parse_args()
    input_dir = args.input_dir.expanduser().resolve()
    output_csv = args.output_csv.expanduser().resolve()
    if not input_dir.is_dir():
        parser.error(f"input directory does not exist: {input_dir}")
    if input_dir == output_csv.parent or input_dir in output_csv.parents:
        parser.error("output CSV must be outside the source directory")

    try:
        records = extract_records(input_dir)
        output_csv.parent.mkdir(parents=True, exist_ok=True)
        with output_csv.open("w", encoding="utf-8", newline="") as output:
            writer = csv.DictWriter(output, fieldnames=OUTPUT_FIELDS)
            writer.writeheader()
            writer.writerows(records)
    except (OSError, ValueError) as error:
        parser.exit(1, f"Extraction failed: {error}\n")
    print(f"Wrote {len(records)} historical CTP records to {output_csv}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
