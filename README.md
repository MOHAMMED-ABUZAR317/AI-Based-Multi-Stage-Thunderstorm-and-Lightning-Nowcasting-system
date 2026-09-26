# Hyderabad Thunderstorm Nowcast Prototype

A locally runnable, end-to-end prototype that demonstrates a deterministic Hyderabad storm scenario through baseline, initiation, development, tracking, risk assessment, a simulated alert, and clearance. It combines the integrated Member 4 tracking module with a small FastAPI service and an API-backed browser dashboard.

> **Demo only — not an operational warning service.** Scenario values are synthetic, risk indices and lightning percentages are scripted demonstration values, and motion/arrival outputs are unvalidated estimates. Weather and live radar inputs are explicitly unavailable. The API has no alert-dispatch integration; the simulated alert is local to the dashboard and is never sent to citizens or agencies.

## Run locally

Requires Python 3.10 or newer.

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r backend\requirements.txt
.\.venv\Scripts\python.exe -m uvicorn backend.app.main:app --reload
```

Open <http://127.0.0.1:8000/>. Use **Previous**, **Next**, **Play scenario**, and **Reset** to control the fixed seven-step demonstration. The dashboard makes same-origin requests to the local API; it does not generate live-looking random values in the browser.

Useful local endpoints:

- `GET /api/v1/health` — confirms the service is running and non-operational.
- `GET /api/v1/nowcast?step=0` — baseline nowcast; `step` is an integer from `0` through `6`.
- `GET /docs` — interactive API schema.

## Validate

Run the API contract and dashboard smoke tests plus the integrated tracking tests:

```powershell
.\.venv\Scripts\python.exe -m unittest discover -s backend\tests -p "test_*.py" -v
```

No database, external service, model download, or network access is needed after the listed Python packages are installed.

## Components and data boundaries

- **Member 4 tracking:** integrated from the existing `feature/tracking-vector` team branch. It links synthetic detections, estimates motion, and exposes constant-motion trajectories and city-arrival estimates.
- **Member 2 contract:** the demo detections follow the tracker branch's documented `timestamp` + `storms[]` schema. They are authored scenario fixtures, not satellite/radar detections.
- **Members 1 and live radar:** returned as `UNAVAILABLE` with `null` values; there is no connected current weather or radar feed.
- **Member 3 lightning:** operational model output is unavailable. The percentages are explicitly labeled `SIMULATED_DEMO_ONLY`, are authored solely to make the scenario progress visibly, and are not model predictions or validated probabilities.
- **Member 5 composition:** the displayed scenario risk index and labels are demonstration fixture values, not a calibrated risk engine.
- **Alerts:** the step titled “Demonstration alert” changes only the API response and local UI. Recipient count is always zero; no dispatch endpoint or external alert action exists.

Remote team branches were inspected before integration. The Member 4 tracker was selected because it has a dependency-light implementation, documented contracts, and tests. The existing `feature/backend-dashboard` UI was not carried over because its browser-generated random feeds, fabricated live statuses, and emergency-dispatch language are inappropriate for this demo. The Member 3 XGBoost output was excluded because its training labels were generated from cloud-temperature heuristics rather than lightning observations. Historical weather and satellite extracts were not wired as current inputs: they do not constitute live observations or a validated nowcast feed.

See `backend/docs/integration_contract.md` for the tracking contract and `backend/docs/member4_limitations.md` for its known estimation limitations.
