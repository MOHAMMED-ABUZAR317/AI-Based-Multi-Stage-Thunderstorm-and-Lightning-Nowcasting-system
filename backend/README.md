# Backend and Member 4 tracker

The repository-level `README.md` is the canonical setup and run guide for the integrated FastAPI application. From the repository root, start the API and dashboard with:

```powershell
python -m pip install -r backend\requirements.txt
python -m uvicorn backend.app.main:app --reload
```

The tracker library is under `src/storm_tracking/`. Run its deterministic, synthetic evaluation demo from the backend directory:

```powershell
python demo_tracking.py
```

Run the integrated tracker and API tests from the repository root:

```powershell
python -m unittest discover -s backend\tests -p "test_*.py" -v
```

`adapters/member2_adapter.py` maps the documented `timestamp` + `storms[]` JSON contract to tracker detections. Current team data provides archived INSAT brightness-temperature samples, not an operational storm detector. The runnable web scenario therefore uses the deterministic synthetic adapter; it does not convert satellite brightness temperatures into live storm detections.

**Demo/research only:** motion, confidence, and arrival outputs are baseline estimates without operational validation. Synthetic demo observations and unverified archive data must not be used for safety decisions. See `docs/member4_limitations.md`.

```text
backend/
├── app/                    # FastAPI service and archive-backed scenario
├── adapters/               # Member 2 contract and synthetic fixture adapter
├── src/storm_tracking/     # Member 4 library
├── synthetic/              # Reproducible scenario generators
├── tests/                  # Tracker, archive, API, and dashboard contract tests
├── evaluation/             # Optional synthetic evaluation and plots
└── docs/                   # Integration contracts and tracker limitations
```
