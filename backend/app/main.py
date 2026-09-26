"""FastAPI service and same-origin dashboard for the local prototype."""

from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI, Query
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

BACKEND_DIR = Path(__file__).resolve().parents[1]
FRONTEND_DIR = BACKEND_DIR.parent / "frontend"

from backend.app.demo_scenario import SAFETY_NOTICE, STAGES, build_nowcast

app = FastAPI(
    title="Hyderabad Thunderstorm Nowcast Prototype",
    description=SAFETY_NOTICE,
    version="1.0.0",
)


@app.get("/api/v1/health")
def health() -> dict[str, str | bool]:
    return {
        "status": "ok",
        "demo": True,
        "operational": False,
        "safety_notice": SAFETY_NOTICE,
    }


@app.get("/api/v1/nowcast")
def nowcast(step: int = Query(default=0, ge=0, le=len(STAGES) - 1)) -> dict:
    return build_nowcast(step)


@app.get("/api/v1/archives")
def archives() -> dict:
    return build_nowcast(0)["archives"]


@app.get("/", include_in_schema=False)
def dashboard() -> FileResponse:
    return FileResponse(FRONTEND_DIR / "index.html")


app.mount("/assets", StaticFiles(directory=FRONTEND_DIR), name="assets")
