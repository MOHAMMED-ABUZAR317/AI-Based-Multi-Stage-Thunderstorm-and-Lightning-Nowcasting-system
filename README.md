# ⚡ AI-Based Multi-Stage Thunderstorm & Lightning Nowcasting System (Hyderabad Sector)

[![FastAPI](https://img.shields.io/badge/FastAPI-0.110+-009688?style=flat&logo=fastapi)](https://fastapi.tiangolo.com)
[![Python](https://img.shields.io/badge/Python-3.11%20%7C%203.13-3776AB?style=flat&logo=python)](https://www.python.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Tests](https://img.shields.io/badge/Tests-74%20Passed%20(100%25)-emerald)](backend/tests/)
[![Platform](https://img.shields.io/badge/Deployment-Render%20%7C%20Docker-46e3b7)](https://render.com)

A mission-critical AI-driven convective early warning prototype and tactical nowcasting platform designed for the **Greater Hyderabad Metropolitan Area (GHMC)**. The system integrates thermodynamic sounding analysis, geostationary satellite physical growth detection, machine learning lightning hazard estimation, Doppler radar storm cell vector tracking, and a weighted multi-stage decision fusion engine.

---

## 📌 Table of Contents

- [Executive Summary & Problem Context](#-executive-summary--problem-context)
- [System Architecture](#-system-architecture)
- [Team Member Module Contributions](#-team-member-module-contributions)
- [Cascading 6-Stage Convective Pipeline](#-cascading-6-stage-convective-pipeline)
- [Technology Stack](#-technology-stack)
- [Interactive Command Center & Citizen Portal](#-interactive-command-center--citizen-portal)
- [API Reference Guide](#-api-reference-guide)
- [Local Installation & Setup](#-local-installation--setup)
- [Running Unit Tests](#-running-unit-tests)
- [Production Web Deployment](#-production-web-deployment)
- [Research & Safety Notice](#-research--safety-notice)

---

## 🌪️ Executive Summary & Problem Context

Severe localized thunderstorms, downbursts, and cloud-to-ground lightning present high life-safety and infrastructure hazards in the rapidly urbanizing Hyderabad metropolitan corridor (HITEC City, Gachibowli, Kukatpally, Secunderabad). 

Traditional numerical weather prediction (NWP) models provide regional outlooks but suffer from spatial coarseness and temporal latency (3–6 hours). This platform implements a **0–60 minute nowcasting architecture** with a **30-minute advance tactical lead window** to alert municipal authorities (GHMC), disaster management teams (NDMA/SDRF), and citizens before convective ground impact.

---

## 🏛️ System Architecture

```
                  ┌─────────────────────────────────────────────────────────┐
                  │                 Data Ingestion Layer                    │
                  │  • Thermodynamic Soundings (CAPE, CIN, Wind Shear)      │
                  │  • INSAT-3DR Geostationary Infrared (TIR1/TIR2, CTT)     │
                  │  • DWR Hyderabad Doppler Weather Radar (Reflectivity)   │
                  │  • GHMC Ward Administrative & Population Data           │
                  └────────────────────────────┬────────────────────────────┘
                                               │
                                               ▼
                  ┌─────────────────────────────────────────────────────────┐
                  │             Multi-Stage Convective Pipeline             │
                  │  1. Member 1: Weather Instability Analysis (Thermodynamics)
                  │  2. Member 2: Satellite Storm Growth (Cloud-Top Glaciation)
                  │  3. Member 3: ML Lightning Hazard Prediction (XGBoost)  │
                  │  4. Member 4: Storm Cell Tracking & 30-min ETA Vector   │
                  │  5. Member 5: Nowcasting Multi-Stage Fusion Engine      │
                  └────────────────────────────┬────────────────────────────┘
                                               │
                                               ▼
                  ┌─────────────────────────────────────────────────────────┐
                  │              FastAPI Unified Backend Engine             │
                  │  • High-Throughput REST APIs (/api/v1/*)                │
                  │  • Dual-Mode SQLite & PostgreSQL Persistence ORM        │
                  │  • Real-Time Alert Dispatch & Notification Engine       │
                  └──────────────┬───────────────────────────┬──────────────┘
                                 │                           │
                   ┌─────────────┴─────────────┐ ┌───────────┴─────────────┐
                   │  Command Center Dashboard │ │ Citizen Emergency Portal │
                   │  • 60 FPS Canvas Radar    │ │ • Smartphone UI Frame   │
                   │  • Simulation Controls    │ │ • In-App Emergency Card │
                   │  • GHMC Ward Risk Map     │ │ • Safe Shelter Navigation│
                   └───────────────────────────┘ └─────────────────────────┘
```

---

## 👥 Team Member Module Contributions

| Module | Responsibility | Key Parameters & Deliverables |
| :--- | :--- | :--- |
| **Member 1** | **Weather Instability Analysis** | Thermodynamic sounding evaluation: CAPE (J/kg), CIN (J/kg), Bulk Wind Shear (0–6 km), Surface Temperature, Humidity, and Lifted Index. |
| **Member 2** | **Satellite Storm Evolution** | Geostationary INSAT-3DR L1C/L2B processing: Cloud Top Temperature (CTT), cooling rate (°C/hr), and convective shield area (km²). |
| **Member 3** | **Lightning Prediction Engine** | Physical graupel/ice collision modeling and XGBoost convective surge probability (%) estimation. |
| **Member 4** | **Radar Storm Cell Tracking** | Doppler radar cell centroid extraction, translation speed (km/h), azimuth heading, and 30-minute arrival ETA at urban sectors. |
| **Member 5** | **Nowcast Fusion Engine** | Weighted multi-modal risk aggregation: Calibrated Risk Score (0–100), Risk Classification (`NORMAL`, `WATCH`, `WARNING`, `SEVERE`). |
| **Member 6** | **Full-Stack & Dissemination** | Unified FastAPI backend, interactive tactical GIS Command Center, smartphone Citizen Portal, and dual SQLite/PostgreSQL persistence. |

---

## ⚡ Cascading 6-Stage Convective Pipeline

1. **Stage 1: Fuel Building (Equilibrium to Destabilization)** — Surface heating breaches capping inversion (CAPE > 1500 J/kg).
2. **Stage 2: Initiation (Cumulus Congestus)** — Updraft initiates vertical cloud growth over Western Telangana outskirts.
3. **Stage 3: Glaciation (Deep Convection)** — Satellite detects rapid cloud-top cooling below -40°C; ice nucleation begins.
4. **Stage 4: Electrification (Mixed-Phase Collision)** — Graupel-ice hydrometeor collisions induce intense dipole electrical charges; surge in strike probability.
5. **Stage 5: Active Severe Storm (Ground Impact)** — Peak reflectivity core tracking ENE at 42 km/h; torrential rain and microburst winds.
6. **Stage 6: Weakening & Dissemination** — Updraft dissipates into rain-cooled downdrafts; civil defense emergency warning dispatched to citizen portal and municipal channels.

---

## 🛠️ Technology Stack

- **Backend Framework:** Python 3.11+, FastAPI, Uvicorn (ASGI)
- **Data Validation & Schemas:** Pydantic v2
- **Database & Persistence:** SQLAlchemy ORM, SQLite (`nowcast.db`), PostgreSQL-ready
- **Machine Learning & Analytics:** XGBoost, NumPy, SciPy, Matplotlib
- **Frontend Architecture:** Vanilla HTML5, CSS3 (Modern Dark-Mode Tactical UI), JavaScript (ES6+)
- **Radar & GIS Rendering:** HTML5 Canvas (60 FPS polar radar sweep), Leaflet / OpenStreetMap
- **Browser Device APIs:** Web Audio API (hardware oscillator emergency sirens), Web Speech API (bilingual voice announcements)
- **Containerization & Hosting:** Docker, Render Blueprint (`render.yaml`), Procfile

---

## 🖥️ Interactive Command Center & Citizen Portal

The frontend is served directly by FastAPI from the same origin (`/`):

### 1. Tactical Command Center (`/`)
- **Cascading Simulation Controller:** Step through deterministic convective scenarios (`0` to `6`) with **`▶ START AUTO SIMULATION`** and **`⏹ STOP SIMULATION`** controls.
- **60 FPS Doppler Radar Sweeper:** Real-time radial radar sweep with range rings and moving storm centroids.
- **GHMC Ward Risk Overlays:** Instantaneous population-at-risk aggregation across Hyderabad's municipal zones (Serilingampally, Kukatpally, Secunderabad, Khairatabad, Charminar, LB Nagar).

### 2. Smartphone Citizen Emergency Portal (`#view-alerts`)
- **Portrait Smartphone Interface:** Replicates a real-time citizen alert app.
- **In-App Native Alert Card:** Appears automatically when an alert is issued, detailing strike probability (e.g. 96%), arrival countdown, and affected sectors.
- **Actionable Safety Protocols:** Immediate civilian guidance (seek indoor shelter, avoid open grounds/trees, stay clear of metal structures).
- **One-Touch Actions:** Quick-dial `112 National SOS` and `🧭 NAVIGATE TO SAFE SHELTER` (routing to Gachibowli High Ground Shelter).

---

## 📡 API Reference Guide

FastAPI automatically generates interactive Swagger documentation at **`/docs`** and ReDoc at **`/redoc`**.

### Core Endpoints

#### `GET /api/v1/health`
Returns system operational health, connected modules, and non-operational research disclaimers.

#### `GET /api/v1/nowcast?step={0..6}`
Returns the assembled multi-stage nowcast for a scenario step:
- `step=0`: Baseline Equilibrium
- `step=2`: Deep Convective Development
- `step=4`: Severe Thunderstorm Ground Impact
- `step=6`: Storm Clearance / Weakening

#### `GET /api/v1/weather/instability`
Evaluates thermodynamic sounding parameters.
- **Query Params:** `cape`, `humidity`, `wind_shear`, `temperature`, `pressure`, `cin`

#### `GET /api/v1/satellite/evolution`
Evaluates satellite cloud physics.
- **Query Params:** `cloud_top_temp_c`, `cooling_rate`, `area_km2`

#### `GET /api/v1/lightning/predict`
Calculates convective lightning ground-strike surge probability.

#### `GET /api/v1/tracking/status`
Returns active tracked storm cells, centroid coordinates, speed (km/h), heading, and arrival ETA.

#### `POST /api/v1/alerts/dispatch`
Dispatches an emergency alert and records it to the persistent database.
```json
{
  "severity": "SEVERE",
  "headline": "SEVERE THUNDERSTORM WARNING",
  "message_en": "Take immediate indoor shelter.",
  "target_zones": "Serilingampally, Kukatpally, HITEC City",
  "channels": "SMS, SIRENS, PUSH, CITIZEN_PORTAL"
}
```

#### `GET /api/v1/database/history?limit=15`
Retrieves chronological nowcast execution logs from SQLite/PostgreSQL.

---

## 💻 Local Installation & Setup

### Prerequisites
- Python 3.10, 3.11, 3.12, or 3.13
- Git

### 1. Clone the Repository
```bash
git clone https://github.com/MOHAMMED-ABUZAR317/AI-Based-Multi-Stage-Thunderstorm-and-Lightning-Nowcasting-system.git
cd AI-Based-Multi-Stage-Thunderstorm-and-Lightning-Nowcasting-system
```

### 2. Set Up Virtual Environment
On Windows (PowerShell):
```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install --upgrade pip
.\.venv\Scripts\python.exe -m pip install -r backend\requirements.txt
```

On Linux / macOS:
```bash
python3 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install -r backend/requirements.txt
```

### 3. Launch the Application
```powershell
.\.venv\Scripts\python.exe -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 --reload
```

Open your browser at:
- **Dashboard:** [http://127.0.0.1:8000/](http://127.0.0.1:8000/)
- **Interactive API Docs:** [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)
- **Hyderabad Route Map:** [http://127.0.0.1:8000/map.html](http://127.0.0.1:8000/map.html)

---

## 🧪 Running Unit Tests

The test suite covers all member modules, API endpoints, schema contracts, tracking geometry, and database persistence:

```powershell
.\.venv\Scripts\python.exe -m unittest discover -s backend\tests -p "test_*.py" -v
```

All **74 unit tests** pass with `100% OK`.

---

## 🚀 Production Web Deployment

The repository is configured for single-service continuous deployment. Both backend API and frontend dashboard run in the same container.

### Deploying to Render.com (Recommended - Free Tier)

1. Sign in to **[Render.com](https://render.com/)** with your GitHub account.
2. Click **New +** → **Web Service** and select this repository.
3. Configure:
   - **Environment:** `Python 3`
   - **Branch:** `main`
   - **Build Command:** `pip install -r backend/requirements.txt`
   - **Start Command:** `uvicorn backend.app.main:app --host 0.0.0.0 --port $PORT`
   - **Plan:** Free
4. Click **Deploy Web Service**. Render will provision SSL and provide a public HTTPS URL (e.g. `https://hyderabad-nowcasting.onrender.com`).

### Deploying with Docker
```bash
docker build -t hyderabad-nowcasting .
docker run -p 8000:8000 hyderabad-nowcasting
```

---

## ⚠️ Research & Safety Notice

> **RESEARCH & SIMULATION PROTOTYPE ONLY — NOT AN OPERATIONAL WARNING SERVICE.**  
> Atmospheric soundings and satellite datasets bundled in this repository are historical research extracts. Predicted tracking vectors are constant-velocity estimates. This software is designed for academic demonstration, architectural validation, and research evaluation. It does not replace official meteorological advisories from the India Meteorological Department (IMD) or emergency orders from the National Disaster Management Authority (NDMA).

---

## 📄 License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.
