# Hyderabad thunderstorm nowcasting prototype

This branch integrates the available team work into one local project: archived Member 1 weather data, Member 2 INSAT-3DR brightness-temperature samples and extractor, Member 3 historical cloud-top inputs and extractor, the Member 4 storm tracker, and a FastAPI-backed dashboard. The Member 5/nowcast-engine branch contains no implementation beyond `main`; the assembled API therefore clearly separates the available archive references from a deterministic demo scenario.

> **DEMO / RESEARCH ONLY — NOT AN OPERATIONAL WARNING SERVICE.** The bundled weather archive has unverified provenance and is historical. The INSAT samples are dated archive extracts, not live detections. Member 3's lightning model is unavailable: its former training labels were derived from cloud-temperature heuristics, not lightning observations, so those scores and model artifacts are excluded. Demo risk and lightning percentages are scripted values; Member 4 motion and arrival results are unvalidated constant-velocity estimates. Do not use this software for safety decisions. It has no citizen-alert or agency-dispatch integration.

## Run the integrated application

Requires Python 3.10 or newer. From the repository root in PowerShell:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r backend\requirements.txt
.\.venv\Scripts\python.exe -m uvicorn backend.app.main:app --reload
```

Open <http://127.0.0.1:8000/>. The local dashboard fetches the assembled nowcast from the same-origin API, shows archive timestamps and provenance caveats, and provides deterministic **Previous**, **Next**, **Play scenario**, and **Reset** controls for the synthetic baseline-to-clearance sequence. No database, external service, model download, or front-end build is needed.

### API

- `GET /api/v1/health` — service health and demo/non-operational status.
- `GET /api/v1/nowcast?step=0` — assembled scenario and source references; valid `step` values are `0`–`6`.
- `GET /api/v1/archives` — compact Member 1, 2, and 3 archive summaries.
- `GET /docs` — interactive API schema.

Missing current weather, radar, and defensible lightning inputs are represented as unavailable. Archive fields are included for inspection, never substituted as current observations. Demo alert responses are local scenario state only, with zero recipients and no dispatch action.

## Validate

```powershell
.\.venv\Scripts\python.exe -m unittest discover -s backend\tests -p "test_*.py" -v
node --check frontend\app.js
node --check frontend\js\data-service.js
```

The Python suite covers archive parsing, API contract/status, all seven deterministic stages, tracking, and dashboard asset serving.

## Integrated team components and data contracts

- **Member 1 — weather:** `data_pipeline/hyderabad_15year_thunderstorm_data_with_instability.csv`, included in the nowcast as a dated `HISTORICAL_UNVERIFIED` reference. The CSV's provenance and generation method are not documented/verified. Its latest entry is from 2025-09-28; its CAPE and instability values are not treated as current forecasts or calibrated risk.
- **Member 2 — satellite:** `data_pipeline/results/hyderabad_bt_neighborhood.csv` and `data_pipeline/extract_hyderabad_bt.py`. The API groups point and 3×3 neighborhood TIR1/TIR2 samples from 2026-09-25, marked `ARCHIVED_EXTRACT`; brightness temperature is not itself a storm detection or validated severity decision. The method and interpretation caveats are in `docs/member2-results-note.md`.
- **Member 3 — archived INSAT/CTP processing:** `data_pipeline/hyderabad_extracted_data.csv` and `data_pipeline/process_insat.py`; the API returns these 2025-05-01 samples as historical CTP references. `data_pipeline/inspect_hdf5.py` and the Member 2 HDF5 extractor are available for users supplying their own source files.
- **Member 3 — lightning:** no defensible lightning-observation labels or validated prediction model are available. The proxy-labelled training CSV, proxy-trained model, and old `/api/v1/nowcast/live` endpoint were excluded. Demo lightning percentages are labelled `SIMULATED_DEMO_ONLY`.
- **Member 4 — tracking:** the complete dependency-light module from `feature/tracking-vector` is in `backend/src/storm_tracking/`, with its Member 2 `timestamp` + `storms[]` adapter contract and tests. The runnable scenario supplies deterministic synthetic detections to this module; predicted tracks/arrival are demo-only estimates. See `backend/docs/integration_contract.md` and `backend/docs/member4_limitations.md`.
- **Member 5 — nowcast engine:** `feature/nowcast-engine` is identical to the empty base. The FastAPI response composes the tracker, archive references, input availability, and a clearly labelled deterministic demo; it is not a trained or validated multimodal risk engine.
- **Dashboard / backend:** the `feature/backend-dashboard` commit was integrated, then its legacy front-end modules were removed in a follow-up: browser-randomized feeds, hardcoded ONLINE/LIVE indicators, simulated strikes, unvalidated risk fallbacks, external live-radar overlay, and citizen-dispatch/evacuation controls did not meet this prototype's data/safety requirements. The entry point is the archive-aware dashboard at `/`, connected through the same-origin `frontend/js/data-service.js` client; its scenario alert remains local and non-dispatched.
- **`ml-dev`:** its empty `ml/README.md` and `ml/requirements.txt` scaffold is included. No usable ML implementation is present.

## Optional source-data extraction

The standard local app uses the bundled CSV extracts and does not need satellite-processing dependencies. To regenerate INSAT extracts from files you have permission to use:

```powershell
python -m pip install -r data_pipeline\requirements.txt
python data_pipeline\extract_hyderabad_bt.py C:\path\to\insat_l1c C:\path\to\output
python data_pipeline\process_insat.py C:\path\to\insat_l2b C:\path\to\output\member3_ctp.csv
```

The extraction scripts require source HDF5 files; the team branch's raw HDF5 binaries are not bundled in this integration. Outputs must be reviewed and intentionally installed as archive data before the API will read them. Extraction does not produce live observations or lightning predictions. `data_pipeline/map.html` is a standalone demonstration map, not part of the application dashboard; it uses external map assets and synthetic route zones, and is explicitly labelled non-operational.
