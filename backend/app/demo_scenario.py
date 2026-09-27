"""Multi-Stage Hyderabad Thunderstorm Nowcasting Pipeline & Scenario Engine.

Orchestrates live meteorological analysis (Member 1), satellite evolution (Member 2),
ML lightning prediction (Member 3), storm cell tracking (Member 4), and weighted
fusion decision classification (Member 5), with persistent database logging.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from pathlib import Path
import sys
from typing import Any, Dict, List

BACKEND_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_DIR / "src"))

from storm_tracking.models import Detection
from storm_tracking.tracker import StormTracker
from storm_tracking.trajectory import predict_trajectory
from storm_tracking.arrival import estimate_arrival_time
from storm_tracking.geo import parse_utc

from backend.src.weather_analysis.analyzer import WeatherInstabilityAnalyzer
from backend.src.satellite_evolution.detector import SatelliteStormEvolutionDetector
from backend.src.lightning_prediction.predictor import LightningPredictor
from backend.src.nowcast_engine.fusion import NowcastFusionEngine
from backend.app.archive_data import load_archive_references
from backend.app.database import log_nowcast_run, log_alert

# Instantiate singleton core engines
weather_analyzer = WeatherInstabilityAnalyzer()
satellite_detector = SatelliteStormEvolutionDetector()
lightning_predictor = LightningPredictor()
fusion_engine = NowcastFusionEngine()

CITY = {
    "name": "Hyderabad",
    "latitude": 17.3850,
    "longitude": 78.4867,
    "state": "Telangana",
    "country": "India",
}

START_TIME = datetime(2026, 9, 27, 12, 0, tzinfo=timezone.utc)
SAFETY_NOTICE = (
    "DEMO ONLY — synthetic scenario values and unvalidated estimates. "
    "Not an operational warning service. No citizen alerts are sent."
)

# 7-Step Thunderstorm Lifecycle Progression across 5 Meteorological Stages
STAGES_METRICS = (
    {
        "step": 0,
        "phase": "baseline",
        "label": "Stage 1: Atmospheric Baseline",
        "description": "Stable atmosphere prior to convective heating; no storm cells present.",
        "cape": 1250.0,
        "humidity": 58.0,
        "shear": 12.0,
        "temp": 32.5,
        "pressure": 1006.0,
        "cin": 38.0,
        "ctt_c": -18.0,
        "cooling_rate": 0.0,
        "area_km2": 0.0,
        "has_detection": False,
        "target_zones": [],
    },
    {
        "step": 1,
        "phase": "initiation",
        "label": "Stage 1: Atmospheric Instability Rising",
        "description": "Surface heating and moisture advection trigger rapid thermodynamic destabilization.",
        "cape": 2400.0,
        "humidity": 82.0,
        "shear": 24.0,
        "temp": 29.8,
        "pressure": 1002.5,
        "cin": 14.0,
        "ctt_c": -38.0,
        "cooling_rate": -5.0,
        "area_km2": 180.0,
        "has_detection": True,
        "position": (17.1800, 78.1400),
        "target_zones": ["Shamshabad Airport Perimeter"],
    },
    {
        "step": 2,
        "phase": "development",
        "label": "Stage 2: Convective Cloud Developing",
        "description": "Satellite infrared imagery detects vertical cloud tower glaciation and cooling.",
        "cape": 2850.0,
        "humidity": 85.5,
        "shear": 26.5,
        "temp": 28.4,
        "pressure": 1000.8,
        "cin": 8.0,
        "ctt_c": -48.0,
        "cooling_rate": -9.0,
        "area_km2": 320.0,
        "has_detection": True,
        "position": (17.2200, 78.1800),
        "target_zones": ["Shamshabad", "Rajendranagar"],
    },
    {
        "step": 3,
        "phase": "tracking",
        "label": "Stage 3: Lightning Risk Increasing",
        "description": "Mixed-phase updraft electrification detected; lightning hazard probability surges.",
        "cape": 3200.0,
        "humidity": 88.0,
        "shear": 28.0,
        "temp": 26.8,
        "pressure": 999.2,
        "cin": 4.0,
        "ctt_c": -54.0,
        "cooling_rate": -11.0,
        "area_km2": 420.0,
        "has_detection": True,
        "position": (17.2500, 78.2200),
        "target_zones": ["Serilingampally", "Gachibowli", "HITEC City"],
    },
    {
        "step": 4,
        "phase": "risk",
        "label": "Stage 4: Storm Moving Toward Hyderabad",
        "description": "Cell tracking vector firmly locked at 42 km/h heading NE; ETA to GHMC core is 35 minutes.",
        "cape": 3450.0,
        "humidity": 90.5,
        "shear": 31.0,
        "temp": 25.6,
        "pressure": 998.0,
        "cin": 2.0,
        "ctt_c": -58.0,
        "cooling_rate": -12.0,
        "area_km2": 540.0,
        "has_detection": True,
        "position": (17.2800, 78.2600),
        "target_zones": ["Serilingampally", "Kukatpally", "Khairatabad", "HITEC City"],
    },
    {
        "step": 5,
        "phase": "alert",
        "label": "Stage 5: Severe Thunderstorm Emergency",
        "description": "Severe convective core impact imminent. Multi-stage fusion triggers civil defense alert.",
        "cape": 3800.0,
        "humidity": 93.0,
        "shear": 34.0,
        "temp": 23.8,
        "pressure": 996.5,
        "cin": 0.5,
        "ctt_c": -62.0,
        "cooling_rate": -14.0,
        "area_km2": 680.0,
        "has_detection": True,
        "position": (17.3200, 78.3200),
        "target_zones": ["Charminar", "Khairatabad", "Secunderabad", "Serilingampally", "Kukatpally"],
    },
    {
        "step": 6,
        "phase": "clearance",
        "label": "Stage 5: Dissipation & Clearance",
        "description": "Updraft collapses; convective cold pool disperses; storm cell exits Hyderabad boundary.",
        "cape": 1500.0,
        "humidity": 72.0,
        "shear": 14.0,
        "temp": 24.2,
        "pressure": 1004.0,
        "cin": 28.0,
        "ctt_c": -24.0,
        "cooling_rate": 8.0,
        "area_km2": 210.0,
        "has_detection": False,
        "target_zones": [],
    },
)

GHMC_ZONES = [
    {
        "zone_id": "GHMC_01",
        "name": "Khairatabad Zone",
        "mandals": ["Banjara Hills", "Jubilee Hills", "Somajiguda", "Nampally"],
        "lat": 17.4125,
        "lon": 78.4550,
        "population": 1250000,
    },
    {
        "zone_id": "GHMC_02",
        "name": "Charminar Zone",
        "mandals": ["Falaknuma", "Chandrayangutta", "Bahadurpura", "Santoshnagar"],
        "lat": 17.3616,
        "lon": 78.4747,
        "population": 1450000,
    },
    {
        "zone_id": "GHMC_03",
        "name": "Secunderabad Zone",
        "mandals": ["Begumpet", "Marredpally", "Alwal", "Malkajgiri"],
        "lat": 17.4411,
        "lon": 78.4983,
        "population": 1100000,
    },
    {
        "zone_id": "GHMC_04",
        "name": "Serilingampally Zone",
        "mandals": ["HITEC City", "Gachibowli", "Madhapur", "Kondapur"],
        "lat": 17.4504,
        "lon": 78.3610,
        "population": 980000,
    },
    {
        "zone_id": "GHMC_05",
        "name": "Kukatpally Zone",
        "mandals": ["Kukatpally", "Miyapur", "Nizampet", "Moosapet"],
        "lat": 17.4947,
        "lon": 78.3996,
        "population": 1300000,
    },
    {
        "zone_id": "GHMC_06",
        "name": "LB Nagar Zone",
        "mandals": ["Dilsukhnagar", "Saroornagar", "Hayathnagar", "Nagole"],
        "lat": 17.3457,
        "lon": 78.5522,
        "population": 1150000,
    },
    {
        "zone_id": "GHMC_AIRPORT",
        "name": "Shamshabad Airport Zone",
        "mandals": ["RGIA Airport", "Shamshabad Rural"],
        "lat": 17.2403,
        "lon": 78.4294,
        "population": 350000,
    },
]


def _build_frame(step_idx: int) -> dict[str, Any]:
    timestamp = START_TIME + timedelta(minutes=5 * step_idx)
    cfg = STAGES_METRICS[step_idx]
    storms = []
    if cfg["has_detection"]:
        storms.append(
            {
                "detection_id": f"hyd_cell_01",
                "latitude": cfg["position"][0],
                "longitude": cfg["position"][1],
                "intensity": 0.85,
                "area_km2": cfg["area_km2"],
                "confidence": 0.92,
                "cloud_top_temperature": cfg["ctt_c"],
            }
        )
    return {
        "timestamp": timestamp.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "storms": storms,
    }


def build_nowcast(step: int = 4) -> Dict[str, Any]:
    """Executes the end-to-end multi-stage nowcast chain for a given scenario step."""
    step = max(0, min(len(STAGES_METRICS) - 1, int(step)))
    cfg = STAGES_METRICS[step]
    current_time = START_TIME + timedelta(minutes=5 * step)
    archives = load_archive_references()

    # =========================================================================
    # STAGE 1: Member 1 - Weather Instability Analysis
    # =========================================================================
    m1_out = weather_analyzer.analyze_instability(
        cape=cfg["cape"],
        humidity=cfg["humidity"],
        wind_shear=cfg["shear"],
        temperature=cfg["temp"],
        pressure=cfg["pressure"],
        cin=cfg["cin"],
    )

    # =========================================================================
    # STAGE 2: Member 2 - Satellite Storm Evolution
    # =========================================================================
    m2_out = satellite_detector.detect_evolution(
        cloud_top_temp_c=cfg["ctt_c"],
        cooling_rate=cfg["cooling_rate"],
        area_km2=cfg["area_km2"],
        latitude=cfg.get("position", (17.385, 78.486))[0],
        longitude=cfg.get("position", (17.385, 78.486))[1],
    )

    # =========================================================================
    # STAGE 3: Member 3 - Lightning Hazard Prediction
    # =========================================================================
    m3_out = lightning_predictor.predict_lightning(
        cloud_top_temp_c=cfg["ctt_c"],
        cloud_top_pressure_hpa=cfg["pressure"] * 0.75,
        cooling_rate_per_hour=cfg["cooling_rate"],
        cape=cfg["cape"],
    )

    # =========================================================================
    # STAGE 4: Member 4 - Storm Tracking & ETA Generation
    # =========================================================================
    tracker = StormTracker()
    for s_idx in range(1, step + 1):
        frame = _build_frame(s_idx)
        if frame["storms"]:
            det_objs = [
                Detection(
                    detection_id=d["detection_id"],
                    timestamp=parse_utc(frame["timestamp"]),
                    latitude=d["latitude"],
                    longitude=d["longitude"],
                    intensity=d.get("intensity", 0.8),
                    area_km2=d.get("area_km2", 250.0),
                    confidence=d.get("confidence", 0.85),
                )
                for d in frame["storms"]
            ]
            tracker.update(parse_utc(frame["timestamp"]), det_objs)

    active_tracks = [t for t in tracker.get_all_tracks() if t.status == "active"]
    tracked_storms = []
    m4_direction = "NE"
    m4_speed = 42.0
    m4_eta = 35.0

    if active_tracks and cfg["has_detection"]:
        primary = active_tracks[0]
        forecast = predict_trajectory(primary)
        arrival = estimate_arrival_time(primary, CITY["latitude"], CITY["longitude"])
        if primary.direction_name:
            m4_direction = primary.direction_name
        if primary.speed_kmh is not None:
            m4_speed = round(primary.speed_kmh, 1)
        if arrival and arrival.get("will_reach") and arrival.get("minutes_until_arrival") is not None:
            m4_eta = round(arrival["minutes_until_arrival"], 1)

        tracked_storms.append(
            {
                **primary.to_dict(),
                "forecast": forecast,
                "estimated_city_arrival": arrival,
            }
        )

    m4_out = {
        "direction": m4_direction,
        "speed_kmh": int(round(m4_speed)),
        "eta_minutes": int(round(m4_eta)) if cfg["has_detection"] else None,
        "active_cell_count": len(tracked_storms),
        "trajectory_confidence": 0.88 if tracked_storms else 0.0,
    }

    # =========================================================================
    # STAGE 5: Member 5 - Nowcasting Fusion Engine
    # =========================================================================
    m5_out = fusion_engine.fuse(
        member1_weather=m1_out,
        member2_satellite=m2_out,
        member3_lightning=m3_out,
        member4_tracking=m4_out if cfg["has_detection"] else None,
        manual_override_scores=None if cfg["has_detection"] else {"m1": m1_out["instability_score"], "m2": 15.0, "m3": 5.0, "m4": 0.0},
    )

    # Format bilingual citizen warning message
    target_zones_str = ", ".join(cfg["target_zones"]) if cfg["target_zones"] else "All Hyderabad Metropolitan Zones"
    citizen_alert_en = (
        f"🚨 EMERGENCY THUNDERSTORM & LIGHTNING ALERT: Severe convective storm approaching "
        f"Hyderabad from {m4_direction} at {int(m4_speed)} km/h. Estimated arrival in {int(m4_eta)} min. "
        f"High lightning probability ({m3_out['lightning_probability']}%). Target sectors: {target_zones_str}. "
        f"ACTION: Disconnect appliances, take interior shelter immediately."
        if m5_out["alert"]
        else f"ADVISORY: Thunderstorm watch active for Hyderabad ({m5_out['risk_level']}). No immediate evacuation required."
    )
    citizen_alert_te = (
        f"🚨 అత్యవసర ఉరుములు, మెరుపుల హెచ్చరిక: హైదరాబాద్ వైపు {m4_direction} దిశగా గంటకు {int(m4_speed)} కి.మీ వేగంతో "
        f"తీవ్రమైన తుఫాను వస్తోంది. మరో {int(m4_eta)} నిమిషాల్లో తాకే అవకాశం ఉంది. మెరుపుల ప్రమాదం {m3_out['lightning_probability']}%. "
        f"ప్రభావిత ప్రాంతాలు: {target_zones_str}. సూచన: ఇళ్లలోనే ఉండండి, కిటికీలు మరియు విద్యుత్ స్తంభాలకు దూరంగా ఉండండి."
        if m5_out["alert"]
        else "సమాచారం: హైదరాబాద్ పరిసరాల్లో సాధారణ వాతావరణం. ప్రమాదం లేదు."
    )

    # Construct the master response payload
    payload: Dict[str, Any] = {
        "api_version": "2.0.0",
        "system": "Hyderabad AI-Based Thunderstorm & Lightning Nowcasting Platform",
        "demo": True,
        "operational": False,
        "safety_notice": SAFETY_NOTICE,
        "location": CITY,
        "scenario": {
            "step": step,
            "total_steps": len(STAGES_METRICS),
            "phase": cfg["phase"],
            "label": cfg["label"],
            "description": cfg["description"],
            "timestamp": current_time.strftime("%Y-%m-%dT%H:%M:%SZ"),
        },
        "members": [
            {
                "member": 1,
                "role": "Weather observations / NWP",
                "status": "HISTORICAL_ARCHIVE_ONLY",
                "data": archives["member1_weather"],
                "live_calculation": m1_out,
                "note": "Bundled reference is dated and provenance is unverified; current weather remains unavailable.",
            },
            {
                "member": 2,
                "role": "Storm detection",
                "status": "ARCHIVED_SATELLITE_PLUS_SYNTHETIC_DEMO",
                "data": {
                    "satellite_reference": archives["member2_satellite"],
                    "demo_detections": _build_frame(step)["storms"],
                },
                "live_detection": m2_out,
                "note": "Satellite temperatures are archived measurements, not detections; scenario cells are synthetic. No live radar feed.",
            },
            {
                "member": 3,
                "role": "Lightning guidance",
                "status": "SIMULATED_DEMO_ONLY",
                "data": {"historical_ctp_reference": archives["member3_ctp"]},
                "live_prediction": m3_out,
                "note": (
                    "No defensible lightning source/model is available. The historical "
                    "CTP extract is reference data only; displayed percentages are "
                    "scripted scenario values, not predictions or validated probabilities."
                ),
            },
            {
                "member": 4,
                "role": "Storm tracking",
                "status": "INTEGRATED_SYNTHETIC_INPUT",
                "data": tracked_storms,
                "note": (
                    "Member 4 tracker processes deterministic synthetic frames; "
                    "trajectory and arrival outputs are unvalidated estimates."
                ),
            },
            {
                "member": 5,
                "role": "Nowcast composition",
                "status": "DEMO_SCENARIO_ONLY",
                "data": m5_out,
                "note": "Risk labels and indices are scenario-authored, not operational.",
            },
        ],
        "member_outputs": {
            "member1_weather": {
                "instability": m1_out["instability"],
                "cape": m1_out["cape"],
                "humidity": m1_out["humidity"],
                "instability_score": m1_out["instability_score"],
                "wind_shear": m1_out["wind_shear"],
                "temperature": m1_out["temperature"],
            },
            "member2_satellite": {
                "cloud_top_temp": m2_out["cloud_top_temp"],
                "cooling_rate": m2_out["cooling_rate"],
                "storm_growth": m2_out["storm_growth"],
                "area_km2": m2_out["area_km2"],
            },
            "member3_lightning": {
                "lightning_probability": m3_out["lightning_probability"],
                "probabilities_by_horizon": m3_out["probabilities_by_horizon"],
                "risk_band": m3_out["risk_band"],
            },
            "member4_tracking": {
                "direction": m4_out["direction"],
                "speed_kmh": m4_out["speed_kmh"],
                "eta_minutes": m4_out["eta_minutes"],
            },
            "member5_fusion": {
                "risk_score": m5_out["risk_score"],
                "risk_level": m5_out["risk_level"],
                "alert": m5_out["alert"],
            },
        },
        "nowcast": {
            "risk": {
                "level": m5_out["risk_level"],
                "index": m5_out["risk_score"],
                "basis": "scenario-authored demonstration value",
                "valid_for_decisions": False,
                "headline": m5_out["headline"],
                "recommended_actions": m5_out["recommended_actions"],
                "contributions": m5_out["member_contributions"],
            },
            "lightning": {
                "status": "SIMULATED_DEMO_ONLY",
                "probability": m3_out["lightning_probability"],
                "probabilities_percent": m3_out["probabilities_by_horizon"],
                "risk_band": m3_out["risk_band"],
                "valid_for_decisions": False,
                "note": (
                    "Illustrative values scripted for this demo; not a "
                    "lightning-prediction model output."
                ),
            },
            "weather": {
                "status": "UNAVAILABLE",
                "values": None,
                "historical_reference": archives["member1_weather"],
                "live_calculation": m1_out,
                "note": "Current weather/NWP data unavailable. Archive reference is not used as current input.",
            },
            "radar": {
                "status": "UNAVAILABLE",
                "values": None,
                "live_tracking": m4_out,
                "note": "No live radar feed connected.",
            },
            "satellite": {
                "status": "LIVE_CALCULATION",
                "values": m2_out,
            },
            "active_storm_count": len(tracked_storms),
        },
        "tracking": {
            "status": "TRACKING_ACTIVE" if tracked_storms else "NO_ACTIVE_CELLS",
            "storms": tracked_storms,
            "motion": {
                "direction": m4_direction,
                "speed_kmh": m4_speed,
                "eta_minutes": m4_eta,
            },
            "history": [
                {
                    "timestamp": (_build_frame(i)["timestamp"]),
                    "latitude": STAGES_METRICS[i]["position"][0],
                    "longitude": STAGES_METRICS[i]["position"][1],
                }
                for i in range(1, step + 1)
                if STAGES_METRICS[i].get("position")
            ],
        },
        "alert": {
            "status": (
                "SIMULATED_NOT_DISPATCHED" if m5_out["alert"]
                else "SIMULATED_CLEARED" if cfg["phase"] == "clearance"
                else "NORMAL"
            ),
            "active": m5_out["alert"],
            "severity": m5_out["risk_level"],
            "headline": m5_out["headline"],
            "message_en": citizen_alert_en,
            "message_te": citizen_alert_te,
            "target_zones": cfg["target_zones"],
            "recipient_count": 0,
            "channels": ["Cell Broadcast (CBC)", "Emergency SMS", "City Sirens", "Telegram Bot", "Civic Dashboard"],
        },
        "ghmc_zones": GHMC_ZONES,
        "archives": archives,
    }

    # Automatically persist execution record to SQLite/PostgreSQL
    try:
        log_nowcast_run(payload)
        if m5_out["alert"]:
            log_alert(
                severity=m5_out["risk_level"],
                headline=m5_out["headline"],
                message_en=citizen_alert_en,
                message_te=citizen_alert_te,
                target_zones=target_zones_str,
            )
    except Exception:
        pass

    return payload
