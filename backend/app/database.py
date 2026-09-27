"""Database ORM & Persistence Layer.

Provides SQLAlchemy models and transactional logging with dual-mode storage:
lightweight zero-config SQLite for local edge execution and PostgreSQL for
production clustered deployments.
"""

from __future__ import annotations

from datetime import datetime, timezone
import json
import os
from pathlib import Path
from typing import Any, Dict, List, Optional

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Float,
    Integer,
    String,
    Text,
    create_engine,
    desc,
)
from sqlalchemy.orm import declarative_base, sessionmaker

DB_PATH = Path(__file__).resolve().parents[1] / "nowcast.db"
DEFAULT_SQLITE_URL = f"sqlite:///{DB_PATH}"

DATABASE_URL = os.getenv("DATABASE_URL", DEFAULT_SQLITE_URL)
# Fix heroku/render postgres prefix if needed
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

connect_args = {"check_same_thread": False} if "sqlite" in DATABASE_URL else {}
engine = create_engine(DATABASE_URL, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


class NowcastLog(Base):
    """Historical timeline of nowcast frames, member metrics, and fusion risks."""

    __tablename__ = "nowcast_logs"

    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime, default=lambda: datetime.now(timezone.utc), index=True)
    step = Column(Integer, nullable=True)
    phase = Column(String(50), nullable=True)
    risk_score = Column(Integer, index=True)
    risk_level = Column(String(30), index=True)
    alert_active = Column(Boolean, default=False)
    cape = Column(Float, nullable=True)
    humidity = Column(Float, nullable=True)
    cloud_top_temp = Column(Float, nullable=True)
    cooling_rate = Column(Float, nullable=True)
    lightning_prob = Column(Integer, nullable=True)
    storm_speed = Column(Float, nullable=True)
    storm_direction = Column(String(20), nullable=True)
    eta_minutes = Column(Float, nullable=True)
    details_json = Column(Text, nullable=True)


class AlertDispatch(Base):
    """Audit log of generated emergency alerts, citizen messages, and dissemination status."""

    __tablename__ = "alert_dispatches"

    id = Column(Integer, primary_key=True, index=True)
    alert_id = Column(String(64), unique=True, index=True)
    timestamp = Column(DateTime, default=lambda: datetime.now(timezone.utc), index=True)
    severity = Column(String(30), index=True)
    headline = Column(String(255))
    message_en = Column(Text)
    message_te = Column(Text, nullable=True)
    target_zones = Column(String(255))
    dispatched_channels = Column(String(100))
    status = Column(String(50), default="DISPATCHED")


class TelemetryFrame(Base):
    """Raw ingest telemetry audit log for data provenance verification."""

    __tablename__ = "telemetry_frames"

    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime, default=lambda: datetime.now(timezone.utc), index=True)
    source = Column(String(100), index=True)
    payload = Column(Text)


def init_db() -> None:
    """Creates database schema if tables do not exist."""
    Base.metadata.create_all(bind=engine)


def log_nowcast_run(payload: Dict[str, Any]) -> int:
    """Persists a nowcast calculation frame to the database."""
    init_db()
    db = SessionLocal()
    try:
        nowcast = payload.get("nowcast", {})
        risk = nowcast.get("risk", {})
        weather_val = (nowcast.get("weather") or {}).get("values") or {}
        lightning_val = (nowcast.get("lightning") or {}).get("probabilities_percent") or {}
        tracking = payload.get("tracking", {})
        primary_storm = (tracking.get("storms") or [{}])[0]
        motion = primary_storm.get("motion") or {}
        arrival = primary_storm.get("estimated_city_arrival") or {}
        scenario = payload.get("scenario") or {}

        member_outputs = payload.get("member_outputs") or {}
        m1_vals = member_outputs.get("member1_weather") or {}
        m2_vals = member_outputs.get("member2_satellite") or {}
        m3_vals = member_outputs.get("member3_lightning") or {}
        m4_vals = member_outputs.get("member4_tracking") or {}

        cape_val = m1_vals.get("cape") if m1_vals.get("cape") is not None else weather_val.get("cape_j_kg")
        humidity_val = m1_vals.get("humidity") if m1_vals.get("humidity") is not None else weather_val.get("humidity_percent")
        ctt_val = m2_vals.get("cloud_top_temp")
        cool_rate_val = m2_vals.get("cooling_rate")
        lightning_val_prob = m3_vals.get("lightning_probability") if m3_vals.get("lightning_probability") is not None else lightning_val.get("30min")
        storm_speed_val = m4_vals.get("speed_kmh") if m4_vals.get("speed_kmh") is not None else motion.get("speed_kmh")
        storm_dir_val = m4_vals.get("direction") if m4_vals.get("direction") is not None else motion.get("direction")
        eta_val = m4_vals.get("eta_minutes") if m4_vals.get("eta_minutes") is not None else arrival.get("minutes_until_arrival")

        record = NowcastLog(
            step=scenario.get("step"),
            phase=scenario.get("phase"),
            risk_score=risk.get("index", 0),
            risk_level=risk.get("level", "NORMAL"),
            alert_active=payload.get("alert", {}).get("active", False),
            cape=float(cape_val) if cape_val is not None else None,
            humidity=float(humidity_val) if humidity_val is not None else None,
            cloud_top_temp=float(ctt_val) if ctt_val is not None else None,
            cooling_rate=float(cool_rate_val) if cool_rate_val is not None else None,
            lightning_prob=int(lightning_val_prob) if lightning_val_prob is not None else None,
            storm_speed=float(storm_speed_val) if storm_speed_val is not None else None,
            storm_direction=str(storm_dir_val) if storm_dir_val is not None else None,
            eta_minutes=float(eta_val) if eta_val is not None else None,
            details_json=json.dumps(
                {
                    "members": payload.get("members"),
                    "risk_breakdown": risk,
                }
            ),
        )
        db.add(record)
        db.commit()
        db.refresh(record)
        return record.id
    finally:
        db.close()


def log_alert(
    severity: str,
    headline: str,
    message_en: str,
    target_zones: str,
    channels: str = "SMS, SIRENS, PUSH, TELEGRAM",
    message_te: Optional[str] = None,
) -> Dict[str, Any]:
    init_db()
    db = SessionLocal()
    try:
        import uuid
        alert_id = f"HYD-ALERT-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S%f')}-{uuid.uuid4().hex[:6]}"
        record = AlertDispatch(
            alert_id=alert_id,
            severity=severity,
            headline=headline,
            message_en=message_en,
            message_te=message_te,
            target_zones=target_zones,
            dispatched_channels=channels,
            status="DISPATCHED",
        )
        db.add(record)
        db.commit()
        db.refresh(record)
        return {
            "alert_id": record.alert_id,
            "timestamp": record.timestamp.isoformat(),
            "severity": record.severity,
            "headline": record.headline,
            "status": record.status,
            "target_zones": record.target_zones,
            "channels": record.dispatched_channels,
        }
    finally:
        db.close()


def get_recent_nowcasts(limit: int = 15) -> List[Dict[str, Any]]:
    """Retrieves chronological past nowcast records."""
    init_db()
    db = SessionLocal()
    try:
        rows = (
            db.query(NowcastLog)
            .order_by(desc(NowcastLog.id))
            .limit(limit)
            .all()
        )
        return [
            {
                "id": r.id,
                "timestamp": r.timestamp.isoformat(),
                "step": r.step,
                "phase": r.phase,
                "risk_score": r.risk_score,
                "risk_level": r.risk_level,
                "alert_active": r.alert_active,
                "cape": r.cape,
                "humidity": r.humidity,
                "cloud_top_temp": r.cloud_top_temp,
                "cooling_rate": r.cooling_rate,
                "lightning_prob": r.lightning_prob,
                "storm_speed": r.storm_speed,
                "storm_direction": r.storm_direction,
                "eta_minutes": r.eta_minutes,
            }
            for r in rows
        ]
    finally:
        db.close()
