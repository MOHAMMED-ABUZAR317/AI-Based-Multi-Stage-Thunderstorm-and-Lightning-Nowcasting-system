"""Validated access to bundled historical/reference CSV datasets."""

from __future__ import annotations

import csv
import math
from pathlib import Path
from typing import Any


REPOSITORY_ROOT = Path(__file__).resolve().parents[2]
DATA_PIPELINE_DIR = REPOSITORY_ROOT / "data_pipeline"


def _read_csv(filename: str, required_fields: set[str]) -> list[dict[str, str]]:
    path = DATA_PIPELINE_DIR / filename
    if not path.is_file():
        raise FileNotFoundError(f"Required bundled archive is missing: {path}")
    with path.open("r", encoding="utf-8-sig", newline="") as source:
        reader = csv.DictReader(source)
        fields = set(reader.fieldnames or ())
        missing = required_fields - fields
        if missing:
            raise ValueError(
                f"Archive {path} is missing required columns: {', '.join(sorted(missing))}"
            )
        rows = list(reader)
    if not rows:
        raise ValueError(f"Required bundled archive contains no records: {path}")
    return rows


def _number(row: dict[str, str], key: str, source: str) -> float:
    try:
        value = float(row[key])
    except (TypeError, ValueError) as error:
        raise ValueError(f"Invalid {key!r} value in {source}: {row.get(key)!r}") from error
    if not math.isfinite(value):
        raise ValueError(f"Non-finite {key!r} value in {source}: {row[key]!r}")
    return value


def load_archive_references() -> dict[str, Any]:
    """Return compact, explicitly dated summaries from the bundled datasets."""
    weather_rows = _read_csv(
        "hyderabad_15year_thunderstorm_data_with_instability.csv",
        {
            "timestamp",
            "latitude",
            "longitude",
            "CAPE",
            "CIN",
            "temperature",
            "humidity",
            "pressure",
            "wind_speed",
            "wind_direction",
            "wind_shear",
            "instability_score",
            "instability_level",
        },
    )
    weather = weather_rows[-1]
    weather_reference = {
        "status": "HISTORICAL_UNVERIFIED",
        "as_of": weather["timestamp"],
        "record_count": len(weather_rows),
        "source": "data_pipeline/hyderabad_15year_thunderstorm_data_with_instability.csv",
        "values": {
            "latitude": _number(weather, "latitude", "Member 1 archive"),
            "longitude": _number(weather, "longitude", "Member 1 archive"),
            "cape_j_kg": _number(weather, "CAPE", "Member 1 archive"),
            "cin_j_kg": _number(weather, "CIN", "Member 1 archive"),
            "temperature_c": _number(weather, "temperature", "Member 1 archive"),
            "humidity_percent": _number(weather, "humidity", "Member 1 archive"),
            "pressure_hpa": _number(weather, "pressure", "Member 1 archive"),
            "wind_speed_kmh": _number(weather, "wind_speed", "Member 1 archive"),
            "wind_direction_degrees": _number(weather, "wind_direction", "Member 1 archive"),
            "wind_shear": _number(weather, "wind_shear", "Member 1 archive"),
            "instability_score": _number(weather, "instability_score", "Member 1 archive"),
            "instability_level": weather["instability_level"],
        },
        "note": (
            "Historical archive reference only. Data provenance and generation "
            "method have not been verified; not a current observation or forecast."
        ),
    }

    satellite_rows = _read_csv(
        "results/hyderabad_bt_neighborhood.csv",
        {
            "acquisition_time",
            "source_file",
            "band",
            "is_point",
            "brightness_temperature_k",
        },
    )
    satellite_by_key: dict[tuple[str, str], list[dict[str, str]]] = {}
    for row in satellite_rows:
        satellite_by_key.setdefault((row["acquisition_time"], row["band"]), []).append(row)
    satellite_samples = []
    for (timestamp, band), group in sorted(satellite_by_key.items()):
        point_rows = [row for row in group if row["is_point"].casefold() == "true"]
        if len(point_rows) != 1:
            raise ValueError(
                f"Satellite archive needs one point sample for {timestamp} {band}; "
                f"found {len(point_rows)}"
            )
        values = [
            _number(row, "brightness_temperature_k", f"satellite {timestamp} {band}")
            for row in group
        ]
        satellite_samples.append(
            {
                "timestamp": f"{timestamp}:00Z",
                "band": band,
                "point_temperature_k": _number(
                    point_rows[0], "brightness_temperature_k", f"satellite {timestamp} {band}"
                ),
                "neighborhood_mean_temperature_k": sum(values) / len(values),
                "neighborhood_pixel_count": len(values),
                "source_file": point_rows[0]["source_file"],
            }
        )
    if not satellite_samples:
        raise ValueError("Satellite brightness-temperature archive has no usable samples")
    satellite_reference = {
        "status": "ARCHIVED_EXTRACT",
        "as_of": max(sample["timestamp"] for sample in satellite_samples),
        "source": "data_pipeline/results/hyderabad_bt_neighborhood.csv",
        "samples": satellite_samples,
        "note": (
            "INSAT-3DR brightness-temperature extracts from 2026-09-25 (GMT). "
            "Archived point/neighborhood measurements are not storm detections, "
            "a live feed, or a validated severity classification."
        ),
    }

    ctp_rows = _read_csv(
        "hyderabad_extracted_data.csv",
        {"Timestamp_UTC", "File_Name", "Cloud_Top_Temp_K", "Cloud_Top_Pressure_hPa"},
    )
    ctp = ctp_rows[-1]
    ctp_reference = {
        "status": "ARCHIVED_EXTRACT",
        "as_of": ctp["Timestamp_UTC"],
        "record_count": len(ctp_rows),
        "source": "data_pipeline/hyderabad_extracted_data.csv",
        "values": {
            "cloud_top_temperature_k": _number(
                ctp, "Cloud_Top_Temp_K", "Member 3 historical INSAT archive"
            ),
            "cloud_top_pressure_hpa": _number(
                ctp, "Cloud_Top_Pressure_hPa", "Member 3 historical INSAT archive"
            ),
        },
        "note": (
            "Processed INSAT-3DR CTP snapshot from 2025-05-01. This historical "
            "brightness-temperature/cloud-top input is not lightning observation "
            "ground truth and is not used to produce lightning probabilities."
        ),
    }
    return {"member1_weather": weather_reference, "member2_satellite": satellite_reference, "member3_ctp": ctp_reference}
