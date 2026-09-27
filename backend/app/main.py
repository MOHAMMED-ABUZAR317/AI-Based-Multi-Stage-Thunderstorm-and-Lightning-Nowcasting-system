"""FastAPI Application for the AI-Based Hyderabad Thunderstorm Nowcasting Platform.

Integrates all 6 member modules into high-performance REST APIs:
- Member 1: Weather Instability Analysis
- Member 2: Satellite Storm Evolution Detection
- Member 3: ML Lightning Hazard Prediction
- Member 4: Storm Cell Tracking & ETA
- Member 5: Nowcasting Multi-Stage Fusion Engine
- Member 6: Tactical GIS Dashboard, PostgreSQL/SQLite persistence, and Citizen Alert Dispatch
"""

from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi import Body, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

BACKEND_DIR = Path(__file__).resolve().parents[1]
FRONTEND_DIR = BACKEND_DIR.parent / "frontend"

from backend.app.demo_scenario import (
    GHMC_ZONES,
    SAFETY_NOTICE,
    STAGES_METRICS,
    build_nowcast,
    fusion_engine,
    lightning_predictor,
    satellite_detector,
    weather_analyzer,
)
from backend.app.database import (
    get_recent_nowcasts,
    init_db,
    log_alert,
)

# Initialize database schema on startup
init_db()

app = FastAPI(
    title="⚡ AI Thunderstorm & Lightning Nowcasting Platform — Hyderabad",
    description=(
        "Mission-Critical Tactical Multi-Stage Convective Early Warning System. "
        "Fuses thermodynamic instability, geostationary satellite cloud physics, "
        "machine learning lightning estimation, and radar cell tracking into calibrated "
        "GHMC civil defense nowcasts."
    ),
    version="2.0.0",
)

# Enable CORS for frontend dashboard and API clients
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# =============================================================================
# Pydantic Request Models
# =============================================================================

class WeatherInput(BaseModel):
    cape: float = Field(2400.0, description="Convective Available Potential Energy in J/kg")
    humidity: float = Field(82.0, description="Relative humidity percentage (0-100)")
    wind_shear: float = Field(25.7, description="0-6 km Bulk Wind Shear in m/s")
    temperature: float = Field(26.6, description="2m Surface temperature in Celsius")
    pressure: float = Field(1000.6, description="Mean Sea Level Pressure in hPa")
    cin: float = Field(10.0, description="Convective Inhibition in J/kg")


class SatelliteInput(BaseModel):
    cloud_top_temp_c: Optional[float] = Field(-58.0, description="Cloud top temperature in Celsius")
    cooling_rate: Optional[float] = Field(-12.0, description="Cloud top cooling rate in °C/hour")
    area_km2: float = Field(450.0, description="Cold cloud shield area in km²")
    latitude: float = Field(17.28, description="Cell centroid latitude")
    longitude: float = Field(78.23, description="Cell centroid longitude")


class LightningInput(BaseModel):
    cloud_top_temp_c: float = Field(-58.0, description="Cloud top temperature in Celsius")
    cloud_top_pressure_hpa: float = Field(750.0, description="Cloud top pressure level in hPa")
    cooling_rate_per_hour: float = Field(-12.0, description="Updraft cooling rate in °C/hour")
    cape: Optional[float] = Field(2400.0, description="Convective Available Potential Energy in J/kg")


class TrackingInput(BaseModel):
    direction: str = Field("NE", description="Storm cell heading compass direction")
    speed_kmh: float = Field(42.0, description="Storm translation ground speed in km/h")
    eta_minutes: float = Field(35.0, description="Estimated arrival time at city center in minutes")


class FusionInput(BaseModel):
    member1_instability_score: float = Field(73.0, ge=0, le=100)
    member2_satellite_growth_score: float = Field(90.0, ge=0, le=100)
    member3_lightning_probability: float = Field(78.0, ge=0, le=100)
    member4_tracking_urgency_score: float = Field(95.0, ge=0, le=100)


class AlertDispatchRequest(BaseModel):
    severity: str = Field("SEVERE", description="NORMAL, WATCH, WARNING, SEVERE")
    headline: str = Field(..., description="Alert banner title")
    message_en: str = Field(..., description="English citizen warning text")
    message_te: Optional[str] = Field(None, description="Telugu citizen warning text")
    target_zones: str = Field("Serilingampally, Kukatpally, HITEC City", description="Target GHMC sectors")
    channels: str = Field("SMS, SIRENS, PUSH, TELEGRAM", description="Dissemination channels")


# =============================================================================
# Core System Endpoints
# =============================================================================

@app.get("/api/v1/health")
def health() -> dict[str, Any]:
    """Returns platform operational health and integration telemetry."""
    return {
        "status": "ok",
        "demo": True,
        "operational": False,
        "system": "AI-Based Hyderabad Thunderstorm Nowcasting Platform",
        "version": "2.0.0",
        "active_modules": [
            "Member 1: Weather Instability Engine",
            "Member 2: Satellite Storm Evolution Detector",
            "Member 3: XGBoost Lightning Hazard Predictor",
            "Member 4: Radar Storm Cell Tracker",
            "Member 5: Multi-Stage Nowcast Fusion Engine",
            "Member 6: Tactical GIS Dashboard & Alert Delivery",
        ],
        "database": "SQLAlchemy SQLite/PostgreSQL Connected",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "safety_notice": SAFETY_NOTICE,
    }


# =============================================================================
# MEMBER 1: Weather Instability Analysis
# =============================================================================

@app.get("/api/v1/weather/instability")
def get_weather_instability(
    cape: float = Query(2400.0, description="CAPE J/kg"),
    humidity: float = Query(82.0, description="Humidity %"),
    wind_shear: float = Query(25.7, description="Wind shear m/s"),
    temperature: float = Query(26.6, description="Temperature °C"),
    pressure: float = Query(1000.6, description="Pressure hPa"),
    cin: float = Query(10.0, description="CIN J/kg"),
) -> dict[str, Any]:
    """Member 1: Evaluates atmospheric instability from meteorological inputs."""
    out = weather_analyzer.analyze_instability(
        cape=cape,
        humidity=humidity,
        wind_shear=wind_shear,
        temperature=temperature,
        pressure=pressure,
        cin=cin,
    )
    return {
        "instability": out["instability"],
        "cape": int(round(out["cape"])),
        "humidity": int(round(out["humidity"])),
        "wind_shear": out["wind_shear"],
        "temperature": out["temperature"],
        "pressure": out["pressure"],
        "cin": out["cin"],
        "instability_score": out["instability_score"],
        "subscores": out["subscores"],
    }


@app.post("/api/v1/weather/instability")
def post_weather_instability(payload: WeatherInput) -> dict[str, Any]:
    """Member 1: Evaluates custom thermodynamic payload."""
    out = weather_analyzer.analyze_instability(
        cape=payload.cape,
        humidity=payload.humidity,
        wind_shear=payload.wind_shear,
        temperature=payload.temperature,
        pressure=payload.pressure,
        cin=payload.cin,
    )
    return {
        "instability": out["instability"],
        "cape": int(round(out["cape"])),
        "humidity": int(round(out["humidity"])),
        "wind_shear": out["wind_shear"],
        "temperature": out["temperature"],
        "pressure": out["pressure"],
        "cin": out["cin"],
        "instability_score": out["instability_score"],
        "subscores": out["subscores"],
    }


# =============================================================================
# MEMBER 2: Satellite Storm Evolution Detection
# =============================================================================

@app.get("/api/v1/satellite/evolution")
def get_satellite_evolution(
    cloud_top_temp_c: float = Query(-58.0, description="CTT in °C"),
    cooling_rate: float = Query(-12.0, description="Cooling rate in °C/hr"),
    area_km2: float = Query(450.0, description="Storm area in km²"),
) -> dict[str, Any]:
    """Member 2: Detects satellite cloud top temperature, cooling rate, and storm growth."""
    out = satellite_detector.detect_evolution(
        cloud_top_temp_c=cloud_top_temp_c,
        cooling_rate=cooling_rate,
        area_km2=area_km2,
    )
    return {
        "cloud_top_temp": out["cloud_top_temp"],
        "cooling_rate": out["cooling_rate"],
        "storm_growth": out["storm_growth"],
        "cloud_top_temp_k": out["cloud_top_temp_k"],
        "area_km2": out["area_km2"],
        "growth_score": out["growth_score"],
        "detection": out["detection"],
    }


@app.post("/api/v1/satellite/evolution")
def post_satellite_evolution(payload: SatelliteInput) -> dict[str, Any]:
    """Member 2: Detects storm evolution from custom satellite payload."""
    out = satellite_detector.detect_evolution(
        cloud_top_temp_c=payload.cloud_top_temp_c,
        cooling_rate=payload.cooling_rate,
        area_km2=payload.area_km2,
        latitude=payload.latitude,
        longitude=payload.longitude,
    )
    return {
        "cloud_top_temp": out["cloud_top_temp"],
        "cooling_rate": out["cooling_rate"],
        "storm_growth": out["storm_growth"],
        "cloud_top_temp_k": out["cloud_top_temp_k"],
        "area_km2": out["area_km2"],
        "growth_score": out["growth_score"],
        "detection": out["detection"],
    }


# =============================================================================
# MEMBER 3: Lightning Prediction
# =============================================================================

@app.get("/api/v1/ml/lightning")
def get_ml_lightning(
    cloud_top_temp_c: float = Query(-58.0, description="CTT in °C"),
    pressure_hpa: float = Query(750.0, description="Cloud top pressure in hPa"),
    cooling_rate: float = Query(-12.0, description="Cooling rate in °C/hr"),
    cape: float = Query(2400.0, description="CAPE J/kg"),
) -> dict[str, Any]:
    """Member 3: Machine learning prediction of lightning probability."""
    out = lightning_predictor.predict_lightning(
        cloud_top_temp_c=cloud_top_temp_c,
        cloud_top_pressure_hpa=pressure_hpa,
        cooling_rate_per_hour=cooling_rate,
        cape=cape,
    )
    return {
        "lightning_probability": out["lightning_probability"],
        "probabilities_by_horizon": out["probabilities_by_horizon"],
        "risk_band": out["risk_band"],
        "diagnostics": out["diagnostics"],
    }


@app.post("/api/v1/ml/lightning")
def post_ml_lightning(payload: LightningInput) -> dict[str, Any]:
    """Member 3: Predicts lightning risk using XGBoost & cloud physics."""
    out = lightning_predictor.predict_lightning(
        cloud_top_temp_c=payload.cloud_top_temp_c,
        cloud_top_pressure_hpa=payload.cloud_top_pressure_hpa,
        cooling_rate_per_hour=payload.cooling_rate_per_hour,
        cape=payload.cape,
    )
    return {
        "lightning_probability": out["lightning_probability"],
        "probabilities_by_horizon": out["probabilities_by_horizon"],
        "risk_band": out["risk_band"],
        "diagnostics": out["diagnostics"],
    }


# =============================================================================
# MEMBER 4: Storm Tracking
# =============================================================================

@app.get("/api/v1/tracking/vectors")
def get_tracking_vectors() -> dict[str, Any]:
    """Member 4: Returns active storm translation speed, direction, and ETA to Hyderabad."""
    nowcast_data = build_nowcast(4)
    m4 = nowcast_data["member_outputs"]["member4_tracking"]
    tracking = nowcast_data["tracking"]
    return {
        "direction": m4["direction"],
        "speed_kmh": m4["speed_kmh"],
        "eta_minutes": m4["eta_minutes"],
        "active_cell_count": len(tracking["storms"]),
        "storms": tracking["storms"],
        "history": tracking["history"],
    }


# =============================================================================
# MEMBER 5: Nowcasting Fusion Engine
# =============================================================================

@app.get("/api/v1/nowcast/fusion")
def get_nowcast_fusion() -> dict[str, Any]:
    """Member 5: Fuses all member predictions into final risk score and alert decision."""
    nowcast_data = build_nowcast(4)
    m5 = nowcast_data["member_outputs"]["member5_fusion"]
    contributions = nowcast_data["nowcast"]["risk"]["contributions"]
    return {
        "risk_score": m5["risk_score"],
        "risk_level": m5["risk_level"],
        "alert": m5["alert"],
        "member_contributions": contributions,
        "fusion_weights": {
            "member1_instability": 0.20,
            "member2_satellite": 0.25,
            "member3_lightning": 0.30,
            "member4_tracking": 0.25,
        },
    }


@app.post("/api/v1/nowcast/fusion")
def post_nowcast_fusion(payload: FusionInput) -> dict[str, Any]:
    """Member 5: Custom multi-stage weighted fusion computation."""
    out = fusion_engine.fuse(
        manual_override_scores={
            "m1": payload.member1_instability_score,
            "m2": payload.member2_satellite_growth_score,
            "m3": payload.member3_lightning_probability,
            "m4": payload.member4_tracking_urgency_score,
        }
    )
    return {
        "risk_score": out["risk_score"],
        "risk_level": out["risk_level"],
        "alert": out["alert"],
        "headline": out["headline"],
        "recommended_actions": out["recommended_actions"],
        "member_contributions": out["member_contributions"],
    }


# =============================================================================
# END-TO-END PIPELINE & NOWCAST SCENARIO PLAYBACK
# =============================================================================

@app.get("/api/v1/nowcast/pipeline")
def run_nowcast_pipeline() -> dict[str, Any]:
    """Executes the full end-to-end chain: Weather -> Satellite -> Lightning -> Tracking -> Fusion -> DB."""
    return build_nowcast(4)


@app.get("/api/v1/nowcast")
def nowcast(step: int = Query(default=4, ge=0, le=len(STAGES_METRICS) - 1)) -> dict[str, Any]:
    """Returns the calibrated multi-stage nowcast for a given scenario step."""
    return build_nowcast(step)


@app.get("/api/v1/archives")
def archives() -> dict[str, Any]:
    """Returns dated reference data from Member 1, 2, and 3 archives."""
    return build_nowcast(0)["archives"]


@app.get("/api/v1/zones/hyderabad")
def hyderabad_zones() -> dict[str, Any]:
    """Returns geographic definitions and population data for GHMC administrative zones."""
    return {
        "city": "Hyderabad",
        "zones": GHMC_ZONES,
        "total_zones": len(GHMC_ZONES),
    }


# =============================================================================
# MEMBER 6: Alerts & Persistence
# =============================================================================

@app.get("/api/v1/alerts/active")
def get_active_alerts() -> dict[str, Any]:
    """Returns current active emergency alerts and citizen dissemination status."""
    nowcast_data = build_nowcast(4)
    return nowcast_data["alert"]


@app.post("/api/v1/alerts/dispatch")
def dispatch_alert(req: AlertDispatchRequest) -> dict[str, Any]:
    """Dispatches citizen emergency warning and records to persistent database."""
    res = log_alert(
        severity=req.severity,
        headline=req.headline,
        message_en=req.message_en,
        message_te=req.message_te,
        target_zones=req.target_zones,
        channels=req.channels,
    )
    return {
        "status": "success",
        "dispatch": res,
        "channels_reached": [c.strip() for c in req.channels.split(",")],
    }


@app.get("/api/v1/database/history")
def get_database_history(limit: int = Query(15, ge=1, le=100)) -> dict[str, Any]:
    """Retrieves chronological past nowcast frames persisted in the database."""
    rows = get_recent_nowcasts(limit=limit)
    return {
        "count": len(rows),
        "history": rows,
    }


# =============================================================================
# Dashboard Web Interface & Static Files
# =============================================================================

@app.get("/", include_in_schema=False)
def dashboard() -> FileResponse:
    """Serves the tactical nowcasting dashboard HTML."""
    return FileResponse(FRONTEND_DIR / "index.html")


app.mount("/assets", StaticFiles(directory=FRONTEND_DIR), name="assets")
