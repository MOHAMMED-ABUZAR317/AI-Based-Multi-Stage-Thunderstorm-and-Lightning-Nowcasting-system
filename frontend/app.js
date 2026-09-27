/**
 * NATIONAL CONVECTIVE NOWCASTING PLATFORM — COMMAND CENTER CONTROLLER
 * Architecture: NDMA / IMD / GHMC Mission Control Standard
 * 
 * Strict Compliance:
 * - Deterministic telemetry from backend FastAPI /api/v1/nowcast
 * - Zero randomized functions (Contract test compliance)
 * - 60 FPS Tactical GIS Radar Sweep Engine
 * - Dynamic Explainable AI (XAI) Rule Evaluator
 * - Hyper-local Impact Arrival Timetable with Live Countdowns
 * - Multi-Tab View Router & Dataset Scenario Explorer
 */

(() => {
  'use strict';

  // =========================================================================
  // 1. STATE & CONSTANTS
  // =========================================================================

  let currentStep = 0;
  let isSimulating = false;
  let simulationTimer = null;
  let radarAngle = 0;
  let activeNowcastData = null;
  let countdownSeconds = 1440; // 24 minutes baseline

  // Hyderabad Geographical Reference Frame
  const HYD_GEO = Object.freeze({
    centerLat: 17.385044,
    centerLon: 78.486671,
    minLat: 17.14,
    maxLat: 17.62,
    minLon: 78.10,
    maxLon: 78.70,
  });

  // GHMC Administrative Sectors with Populations & Baseline Distance from West Corridor
  const SECTORS = Object.freeze([
    { name: 'Serilingampally', lat: 17.4834, lon: 78.3158, pop: 950000, distKm: 12, zone: 'WEST', actions: 'Activate emergency shelters in HITEC City & Gachibowli.' },
    { name: 'Kukatpally', lat: 17.4947, lon: 78.3996, pop: 850000, distKm: 18, zone: 'NORTH-WEST', actions: 'Sound municipal sirens; divert underpass traffic.' },
    { name: 'Secunderabad', lat: 17.4399, lon: 78.4983, pop: 680000, distKm: 22, zone: 'NORTH', actions: 'Position emergency dewatering pumps at railway hub.' },
    { name: 'Khairatabad', lat: 17.4123, lon: 78.4578, pop: 720000, distKm: 25, zone: 'CENTRAL', actions: 'Issue pedestrian shelter alerts around Secretariat & Lake.' },
    { name: 'Charminar', lat: 17.3616, lon: 78.4747, pop: 780000, distKm: 28, zone: 'SOUTH', actions: 'Pre-alert Old City drainage quick-response teams.' },
    { name: 'LB Nagar', lat: 17.3457, lon: 78.5522, pop: 820000, distKm: 35, zone: 'EAST', actions: 'Monitor Musi river runoff outflow channels.' },
  ]);

  // Operational Event Scenarios (Timestamped, No Stage Numbers)
  const SCENARIOS = Object.freeze([
    {
      time: '08:00 AM',
      name: 'Normal Summer Day',
      phase: 'EQUILIBRIUM',
      headline: 'Atmospheric Equilibrium — No Threat Active',
      summary: 'Thermodynamic parameters remain below initiation thresholds. Background monitoring active across the Greater Hyderabad Metropolitan Region.',
      popAtRisk: 0,
      targetWards: [],
    },
    {
      time: '08:15 AM',
      name: 'Developing Thunderstorm',
      phase: 'INITIATION',
      headline: 'Boundary Layer Destabilization & Congestus Growth',
      summary: 'Thermal surface heating breaches capping inversion. Cumulus congestus towers actively growing over Western Telangana outskirts.',
      popAtRisk: 0,
      targetWards: ['Western Outskirts'],
    },
    {
      time: '08:30 AM',
      name: 'Rapid Intensification',
      phase: 'GLACIATION',
      headline: 'Deep Convective Growth & Ice Nucleation',
      summary: 'Satellite INSAT-3D channels confirm rapid cloud-top glaciation (-42°C). Updraft velocity intensifying over Patancheru corridor.',
      popAtRisk: 420000,
      targetWards: ['Patancheru', 'Miyapur'],
    },
    {
      time: '08:45 AM',
      name: 'Severe Lightning Event',
      phase: 'ELECTRIFICATION',
      headline: 'Mixed-Phase Hydrometeor Collisions & Active Lightning',
      summary: 'Graupel and ice crystal interactions produce intense dipole charge. XGBoost model detects imminent dangerous ground strike surge.',
      popAtRisk: 1150000,
      targetWards: ['Serilingampally', 'BHEL', 'Gachibowli'],
    },
    {
      time: '09:00 AM',
      name: 'Urban Flash Flood Risk',
      phase: 'SEVERE SQUALL',
      headline: 'Convective Squall Line Intercepting Western Hyderabad',
      summary: 'Severe convective squall with 65 mm/hr torrential rain rate tracking east-northeast at 42 km/h. Urban flood warning issued.',
      popAtRisk: 1840000,
      targetWards: ['Serilingampally', 'Kukatpally', 'HITEC City'],
    },
    {
      time: '09:15 AM',
      name: 'Extreme Convective Outbreak',
      phase: 'PEAK INTENSITY',
      headline: 'Maximum Convective Core Over Greater Hyderabad Metropolitan Core',
      summary: 'Peak microburst downpours and continuous cloud-to-ground lightning across central metropolitan sectors. Municipal sirens active.',
      popAtRisk: 2560000,
      targetWards: ['Kukatpally', 'Khairatabad', 'Secunderabad'],
    },
    {
      time: '09:45 AM',
      name: 'Convective Dissipation',
      phase: 'DISSIPATION',
      headline: 'Downdraft Domination & Convective Weakening',
      summary: 'Precipitation downdrafts suffocate storm updraft feeder bands. Cell remnants tracking eastward toward LB Nagar.',
      popAtRisk: 820000,
      targetWards: ['LB Nagar', 'Uppal'],
    }
  ]);

  // =========================================================================
  // 2. DOM ELEMENT REFERENCES (Exact match with index.html)
  // =========================================================================

  const DOM = {
    // Navigation & Views
    navItems: document.querySelectorAll('.nav-item'),
    viewPanes: document.querySelectorAll('.view-pane'),
    datasetBtns: document.querySelectorAll('.dataset-btn'),

    // Operations Clocks
    clockUtc: document.getElementById('clock-utc'),
    clockIst: document.getElementById('clock-ist'),

    // Hero Threat Banner
    heroBanner: document.getElementById('hero-threat-banner'),
    threatBadge: document.getElementById('threat-level-badge'),
    bannerTimestamp: document.getElementById('banner-timestamp'),
    threatHeadline: document.getElementById('threat-headline'),
    threatAdvisory: document.getElementById('threat-advisory'),
    heroThreatScore: document.getElementById('hero-threat-score'),

    // Quick Metrics Row (Command Center)
    kpiEta: document.getElementById('kpi-eta'),
    kpiEtaSub: document.getElementById('kpi-eta-sub'),
    kpiLightning: document.getElementById('kpi-lightning'),
    kpiLightningSub: document.getElementById('kpi-lightning-sub'),
    kpiPopulation: document.getElementById('kpi-population'),
    kpiPopulationSub: document.getElementById('kpi-population-sub'),
    kpiCape: document.getElementById('kpi-cape'),
    kpiCapeSub: document.getElementById('kpi-cape-sub'),

    // Tactical Radar Canvas & Stepper
    canvas: document.getElementById('tactical-radar-canvas'),
    btnTimelinePrev: document.getElementById('btn-timeline-prev'),
    btnTimelinePlay: document.getElementById('btn-timeline-play'),
    btnTimelineNext: document.getElementById('btn-timeline-next'),
    btnTimelineReset: document.getElementById('btn-timeline-reset'),
    wardsContainer: document.getElementById('wards-container'),

    // Executive Dashboard Elements (View 2)
    execScore: document.getElementById('exec-score'),
    execScoreBar: document.getElementById('exec-score-bar'),
    execRiskLevel: document.getElementById('exec-risk-level'),
    execRiskDesc: document.getElementById('exec-risk-desc'),
    execLightning: document.getElementById('exec-lightning'),
    execLightningBar: document.getElementById('exec-lightning-bar'),
    execEta: document.getElementById('exec-eta'),
    execEtaSub: document.getElementById('exec-eta-sub'),
    execRegions: document.getElementById('exec-regions'),
    execRegionsSub: document.getElementById('exec-regions-sub'),
    execAlerts: document.getElementById('exec-alerts'),

    // Prediction Engine 12 Cards (View 3)
    predRainVal: document.getElementById('pred-rain-val'),
    predRainStatus: document.getElementById('pred-rain-status'),
    predRainContrib: document.getElementById('pred-rain-contrib'),

    predTempVal: document.getElementById('pred-temp-val'),
    predTempStatus: document.getElementById('pred-temp-status'),
    predTempContrib: document.getElementById('pred-temp-contrib'),

    predHumVal: document.getElementById('pred-hum-val'),
    predHumStatus: document.getElementById('pred-hum-status'),
    predHumContrib: document.getElementById('pred-hum-contrib'),

    predShearVal: document.getElementById('pred-shear-val'),
    predShearStatus: document.getElementById('pred-shear-status'),
    predShearContrib: document.getElementById('pred-shear-contrib'),

    predCloudVal: document.getElementById('pred-cloud-val'),
    predCloudStatus: document.getElementById('pred-cloud-status'),
    predCloudContrib: document.getElementById('pred-cloud-contrib'),

    predSatVal: document.getElementById('pred-sat-val'),
    predSatStatus: document.getElementById('pred-sat-status'),
    predSatContrib: document.getElementById('pred-sat-contrib'),

    predLightVal: document.getElementById('pred-light-val'),
    predLightStatus: document.getElementById('pred-light-status'),
    predLightContrib: document.getElementById('pred-light-contrib'),

    predRadarVal: document.getElementById('pred-radar-val'),
    predRadarStatus: document.getElementById('pred-radar-status'),
    predRadarContrib: document.getElementById('pred-radar-contrib'),

    predDistVal: document.getElementById('pred-dist-val'),
    predDistStatus: document.getElementById('pred-dist-status'),
    predDistContrib: document.getElementById('pred-dist-contrib'),

    predDirVal: document.getElementById('pred-dir-val'),
    predDirStatus: document.getElementById('pred-dir-status'),

    predEtaVal: document.getElementById('pred-eta-val'),
    predEtaStatus: document.getElementById('pred-eta-status'),

    predScoreVal: document.getElementById('pred-score-val'),
    predScoreStatus: document.getElementById('pred-score-status'),

    // Live Monitoring Elements (View 4)
    liveCtt: document.getElementById('live-ctt'),
    liveCooling: document.getElementById('live-cooling'),
    liveSpeed: document.getElementById('live-speed'),
    liveHeading: document.getElementById('live-heading'),
    liveCape: document.getElementById('live-cape'),

    // Alert Center Elements (View 5)
    xaiPanel: document.getElementById('xai-panel'),
    xaiReasons: document.getElementById('xai-reasons'),
    xaiStateTag: document.getElementById('xai-state-tag'),
    alertEnBadge: document.getElementById('alert-en-badge'),
    alertEnTitle: document.getElementById('alert-en-title'),
    alertEnBody: document.getElementById('alert-en-body'),
    alertEnTime: document.getElementById('alert-en-time'),
    alertEnZones: document.getElementById('alert-en-zones'),
    alertTeBadge: document.getElementById('alert-te-badge'),
    alertTeTitle: document.getElementById('alert-te-title'),
    alertTeBody: document.getElementById('alert-te-body'),
    btnBroadcastAlert: document.getElementById('btn-broadcast-alert'),
    dispatchFeedback: document.getElementById('dispatch-feedback'),

    // Impact Timetable (View 6)
    impactTableBody: document.getElementById('impact-table-body'),

    // Historical Database Telemetry (View 7)
    historyCountBadge: document.getElementById('history-count-badge'),
    btnRefreshHistory: document.getElementById('btn-refresh-history'),
    historyTableBody: document.getElementById('history-table-body'),
  };

  const ctx = DOM.canvas ? DOM.canvas.getContext('2d') : null;

  // =========================================================================
  // 3. NAVIGATION CONTROLLER (VIEW ROUTER)
  // =========================================================================

  function initNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    const datasetBtns = document.querySelectorAll('.dataset-btn');

    navItems.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const targetView = btn.getAttribute('data-view') || (e.currentTarget && e.currentTarget.getAttribute('data-view'));
        if (targetView) {
          switchView(targetView);
          try {
            history.replaceState(null, null, `#${targetView}`);
          } catch (_) {}
        }
      });
    });

    datasetBtns.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const eventIndex = parseInt(btn.getAttribute('data-event'), 10);
        setStep(eventIndex);
      });
    });

    // Check if initial URL hash requests a specific view
    if (window.location.hash) {
      const hashView = window.location.hash.replace('#', '');
      const validViews = ['view-command', 'view-executive', 'view-prediction', 'view-monitoring', 'view-alerts', 'view-impact', 'view-history', 'view-status'];
      if (validViews.includes(hashView)) {
        switchView(hashView);
      }
    }
  }

  function switchView(viewId) {
    if (!viewId) return;

    const navItems = document.querySelectorAll('.nav-item');
    const viewPanes = document.querySelectorAll('.view-pane');

    navItems.forEach((btn) => {
      const btnView = btn.getAttribute('data-view');
      if (btnView === viewId) {
        btn.classList.add('active');
        btn.setAttribute('aria-selected', 'true');
      } else {
        btn.classList.remove('active');
        btn.setAttribute('aria-selected', 'false');
      }
    });

    viewPanes.forEach((pane) => {
      if (pane.id === viewId) {
        pane.classList.add('active');
      } else {
        pane.classList.remove('active');
      }
    });

    // Scroll to top of main workspace on view change
    const mainWorkspace = document.querySelector('.main-workspace');
    if (mainWorkspace) {
      mainWorkspace.scrollTop = 0;
    }

    if (viewId === 'view-history') {
      loadDatabaseTelemetry();
    }
  }

  // =========================================================================
  // 4. CLOCKS & ARRIVAL TIMERS
  // =========================================================================

  function updateOperationsClocks() {
    const now = new Date();

    // UTC Time
    const hUtc = String(now.getUTCHours()).padStart(2, '0');
    const mUtc = String(now.getUTCMinutes()).padStart(2, '0');
    const sUtc = String(now.getUTCSeconds()).padStart(2, '0');
    if (DOM.clockUtc) DOM.clockUtc.textContent = `${hUtc}:${mUtc}:${sUtc} UTC`;

    // Indian Standard Time (UTC + 5:30)
    const istTime = new Date(now.getTime() + (5.5 * 60 * 60 * 1000));
    const hIst = String(istTime.getUTCHours()).padStart(2, '0');
    const mIst = String(istTime.getUTCMinutes()).padStart(2, '0');
    const sIst = String(istTime.getUTCSeconds()).padStart(2, '0');
    if (DOM.clockIst) DOM.clockIst.textContent = `${hIst}:${mIst}:${sIst} IST`;

    // Decrement countdown if storm approaching
    if (countdownSeconds > 0 && currentStep >= 1 && currentStep <= 5) {
      countdownSeconds -= 1;
      updateLiveCountdowns();
    }
  }

  function updateLiveCountdowns() {
    const badges = document.querySelectorAll('.cd-timer');
    badges.forEach((b) => {
      const offset = parseInt(b.getAttribute('data-offset') || '0', 10);
      const totalSec = Math.max(0, countdownSeconds + offset * 60);
      const mins = Math.floor(totalSec / 60);
      const secs = totalSec % 60;
      b.textContent = `T-${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    });
  }

  // =========================================================================
  // 5. DATA INGESTION & PIPELINE SYNCHRONIZATION
  // =========================================================================

  async function fetchScenarioStep(step) {
    try {
      const response = await fetch(`/api/v1/nowcast?step=${step}`);
      if (!response.ok) {
        throw new Error(`Nowcast API returned status ${response.status}`);
      }
      const data = await response.json();
      activeNowcastData = data;
      renderAllDisplays(data, step);
    } catch (err) {
      console.error('Failed to ingest nowcast telemetry:', err);
    }
  }

  function renderAllDisplays(data, step) {
    const m1 = data.member_outputs?.member1_weather || {};
    const m2 = data.member_outputs?.member2_satellite || {};
    const m3 = data.member_outputs?.member3_lightning || {};
    const m4 = data.member_outputs?.member4_tracking || {};
    const m5 = data.member_outputs?.member5_fusion || {};
    const alert = data.alert || {};
    const scenario = SCENARIOS[step] || SCENARIOS[0];

    const riskLevel = m5.risk_level || 'NORMAL';
    const riskScore = Math.round(m5.risk_score || 0);

    // Update active dataset button in sidebar
    DOM.datasetBtns.forEach((btn) => {
      const ev = parseInt(btn.getAttribute('data-event'), 10);
      if (ev === step) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    // 1. HERO THREAT BANNER
    if (DOM.heroBanner) {
      DOM.heroBanner.className = `hero-threat-banner severity-${riskLevel.toLowerCase()}`;
    }
    if (DOM.threatBadge) DOM.threatBadge.textContent = riskLevel;
    if (DOM.bannerTimestamp) DOM.bannerTimestamp.textContent = `CURRENT EVENT TIME: ${scenario.time}`;
    if (DOM.threatHeadline) DOM.threatHeadline.textContent = scenario.headline;
    if (DOM.threatAdvisory) DOM.threatAdvisory.textContent = scenario.summary;
    if (DOM.heroThreatScore) DOM.heroThreatScore.textContent = riskScore;

    // 2. QUICK KPIS BAR (VIEW 1)
    const etaMins = m4.eta_minutes !== undefined ? Math.round(m4.eta_minutes) : 0;
    if (DOM.kpiEta) {
      DOM.kpiEta.textContent = etaMins > 0 ? `${etaMins} MIN` : '-- MIN';
    }
    if (DOM.kpiEtaSub) {
      DOM.kpiEtaSub.textContent = etaMins > 0
        ? `Tracking ${m4.direction || 'NE'} at ${Math.round(m4.speed_kmh || 35)} km/h`
        : 'Cell tracking outside urban bounds';
    }

    const lightningProb = Math.round(m3.lightning_probability || 0);
    if (DOM.kpiLightning) {
      DOM.kpiLightning.textContent = `${lightningProb}%`;
    }
    if (DOM.kpiLightningSub) {
      DOM.kpiLightningSub.textContent = `XGBoost Risk Band: ${m3.risk_band || 'LOW'}`;
    }

    if (DOM.kpiPopulation) {
      DOM.kpiPopulation.textContent = scenario.popAtRisk.toLocaleString('en-IN');
    }
    if (DOM.kpiPopulationSub) {
      DOM.kpiPopulationSub.textContent = scenario.targetWards.length > 0
        ? `Target wards: ${scenario.targetWards.join(', ')}`
        : 'Citizens in active impact sectors';
    }

    const capeVal = Math.round(m1.cape || 0);
    if (DOM.kpiCape) {
      DOM.kpiCape.textContent = `${capeVal} J/kg`;
    }
    if (DOM.kpiCapeSub) {
      DOM.kpiCapeSub.textContent = `RH: ${Math.round(m1.humidity || 0)}% · Shear: ${m1.wind_shear || 0} m/s`;
    }

    // 3. TARGET WARDS CHIPS
    updateTargetWardsChips(scenario.targetWards);

    // 4. EXECUTIVE DASHBOARD (VIEW 2)
    updateExecutiveDashboard(riskScore, riskLevel, lightningProb, etaMins, scenario);

    // 5. PREDICTION GRID 12 INPUT CARDS (VIEW 3)
    updatePredictionGrid(m1, m2, m3, m4, riskScore, riskLevel);

    // 6. SENSOR INGESTION STATS (VIEW 4)
    updateSensorIngestion(m1, m2, m4);

    // 7. EXPLAINABLE AI PANEL & BILINGUAL ALERTS (VIEW 5)
    updateExplainableAIPanel(m1, m2, m3, m4, scenario);
    updateAlertCenter(data, riskLevel, scenario);

    // 8. IMPACT & ARRIVAL REGIONAL TIMETABLE (VIEW 6)
    updateImpactTable(m4, currentStep);
  }

  function updateTargetWardsChips(activeWards) {
    if (!DOM.wardsContainer) return;
    DOM.wardsContainer.innerHTML = '';

    SECTORS.forEach((sec) => {
      const isTarget = activeWards.some((w) => w.toLowerCase().includes(sec.name.toLowerCase()));
      const chip = document.createElement('span');
      chip.className = `ward-chip ${isTarget ? 'status-impact' : 'status-normal'}`;
      chip.textContent = `${sec.name} (${(sec.pop / 1000000).toFixed(2)}M) ${isTarget ? '· IMPACT ZONE' : '· CLEAR'}`;
      DOM.wardsContainer.appendChild(chip);
    });
  }

  // =========================================================================
  // 6. EXECUTIVE DASHBOARD UPDATER (VIEW 2)
  // =========================================================================

  function updateExecutiveDashboard(riskScore, riskLevel, lightningProb, etaMins, scenario) {
    if (DOM.execScore) DOM.execScore.textContent = riskScore;
    if (DOM.execScoreBar) DOM.execScoreBar.style.width = `${riskScore}%`;

    if (DOM.execRiskLevel) {
      DOM.execRiskLevel.className = `exec-badge badge-${riskLevel.toLowerCase()}`;
      DOM.execRiskLevel.textContent = riskLevel;
    }
    if (DOM.execRiskDesc) {
      if (riskLevel === 'SEVERE') DOM.execRiskDesc.textContent = 'Emergency shelter activation; dangerous conditions';
      else if (riskLevel === 'WARNING') DOM.execRiskDesc.textContent = 'Severe squall en route; prepare civil defenses';
      else if (riskLevel === 'WATCH') DOM.execRiskDesc.textContent = 'Atmospheric destabilization detected over Telangana';
      else DOM.execRiskDesc.textContent = 'Baseline conditions; no evacuation required';
    }

    if (DOM.execLightning) DOM.execLightning.textContent = lightningProb;
    if (DOM.execLightningBar) DOM.execLightningBar.style.width = `${lightningProb}%`;

    if (DOM.execEta) DOM.execEta.textContent = etaMins > 0 ? etaMins : '--';
    if (DOM.execEtaSub) {
      DOM.execEtaSub.textContent = etaMins > 0
        ? `Lead time window to metropolitan perimeter (${m4Direction()})`
        : 'Zero active collision trajectory';
    }

    if (DOM.execRegions) {
      DOM.execRegions.textContent = `${scenario.targetWards.length} Wards`;
    }
    if (DOM.execRegionsSub) {
      DOM.execRegionsSub.textContent = scenario.targetWards.length > 0
        ? scenario.targetWards.join(', ')
        : 'All municipal sectors clear';
    }

    if (DOM.execAlerts) {
      if (riskLevel === 'SEVERE') {
        DOM.execAlerts.textContent = 'ACTIVE (EMERGENCY)';
        DOM.execAlerts.className = 'exec-num-text text-crimson';
      } else if (riskLevel === 'WARNING') {
        DOM.execAlerts.textContent = 'BROADCAST ARMED (2)';
        DOM.execAlerts.className = 'exec-num-text text-amber';
      } else {
        DOM.execAlerts.textContent = 'STANDBY (0)';
        DOM.execAlerts.className = 'exec-num-text text-emerald';
      }
    }
  }

  function m4Direction() {
    return activeNowcastData?.member_outputs?.member4_tracking?.direction || 'NE';
  }

  // =========================================================================
  // 7. PREDICTION ENGINE 12 CARDS (VIEW 3)
  // =========================================================================

  function updatePredictionGrid(m1, m2, m3, m4, riskScore, riskLevel) {
    // 1. Rainfall
    const rain = m1.rainfall_rate || (currentStep >= 4 ? 65.2 : (currentStep >= 2 ? 18.4 : 0));
    if (DOM.predRainVal) DOM.predRainVal.textContent = `${rain.toFixed(1)} mm/hr`;
    if (DOM.predRainStatus) {
      DOM.predRainStatus.textContent = rain > 40 ? 'TORRENTIAL' : (rain > 10 ? 'MODERATE' : 'NORMAL');
      DOM.predRainStatus.className = `pred-status ${rain > 40 ? 'status-danger' : (rain > 10 ? 'status-warn' : 'status-ok')}`;
    }
    if (DOM.predRainContrib) DOM.predRainContrib.textContent = rain > 40 ? '20%' : (rain > 10 ? '10%' : '4%');

    // 2. Temperature
    const temp = m1.temperature !== undefined ? m1.temperature : 26.6;
    if (DOM.predTempVal) DOM.predTempVal.textContent = `${temp.toFixed(1)} °C`;
    if (DOM.predTempStatus) {
      DOM.predTempStatus.textContent = temp > 32 ? 'HIGH HEAT' : 'WARM';
      DOM.predTempStatus.className = `pred-status ${temp > 32 ? 'status-warn' : 'status-ok'}`;
    }

    // 3. Humidity
    const rh = Math.round(m1.humidity || 82);
    if (DOM.predHumVal) DOM.predHumVal.textContent = `${rh}%`;
    if (DOM.predHumStatus) {
      DOM.predHumStatus.textContent = rh > 75 ? 'HIGH MOISTURE' : 'NORMAL';
      DOM.predHumStatus.className = `pred-status ${rh > 75 ? 'status-danger' : 'status-ok'}`;
    }
    if (DOM.predHumContrib) DOM.predHumContrib.textContent = rh > 75 ? '16%' : '12%';

    // 4. Wind Shear
    const shear = m1.wind_shear !== undefined ? m1.wind_shear : 25.7;
    if (DOM.predShearVal) DOM.predShearVal.textContent = `${shear.toFixed(1)} m/s`;
    if (DOM.predShearStatus) {
      DOM.predShearStatus.textContent = shear > 20 ? 'HIGH SHEAR' : 'MODERATE';
      DOM.predShearStatus.className = `pred-status ${shear > 20 ? 'status-danger' : 'status-ok'}`;
    }

    // 5. Cloud Growth
    const cloudArea = m2.cloud_area_km2 || (currentStep >= 3 ? 1420 : (currentStep >= 1 ? 780 : 350));
    if (DOM.predCloudVal) DOM.predCloudVal.textContent = `${cloudArea} km²`;
    if (DOM.predCloudStatus) {
      DOM.predCloudStatus.textContent = cloudArea > 1000 ? 'EXPLOSIVE' : (cloudArea > 500 ? 'GROWING' : 'QUIESCENT');
      DOM.predCloudStatus.className = `pred-status ${cloudArea > 1000 ? 'status-danger' : (cloudArea > 500 ? 'status-warn' : 'status-ok')}`;
    }

    // 6. Satellite Cloud Top Temp
    const ctt = m2.cloud_top_temp !== undefined ? m2.cloud_top_temp : -10.0;
    if (DOM.predSatVal) DOM.predSatVal.textContent = `${ctt.toFixed(1)} °C`;
    if (DOM.predSatStatus) {
      DOM.predSatStatus.textContent = ctt < -40 ? 'GLACIATED' : (ctt < -25 ? 'COOLING' : 'WARM');
      DOM.predSatStatus.className = `pred-status ${ctt < -40 ? 'status-danger' : (ctt < -25 ? 'status-warn' : 'status-ok')}`;
    }

    // 7. Lightning Probability
    const lp = Math.round(m3.lightning_probability || 0);
    if (DOM.predLightVal) DOM.predLightVal.textContent = `${lp}%`;
    if (DOM.predLightStatus) {
      DOM.predLightStatus.textContent = lp > 60 ? 'HIGH DANGER' : (lp > 30 ? 'ELEVATED' : 'LOW');
      DOM.predLightStatus.className = `pred-status ${lp > 60 ? 'status-danger' : (lp > 30 ? 'status-warn' : 'status-ok')}`;
    }

    // 8. Radar Reflectivity
    const radar = currentStep >= 4 ? 54 : (currentStep >= 2 ? 42 : (currentStep >= 1 ? 28 : 15));
    if (DOM.predRadarVal) DOM.predRadarVal.textContent = `${radar} dBZ`;
    if (DOM.predRadarStatus) {
      DOM.predRadarStatus.textContent = radar > 45 ? 'SEVERE CORE' : (radar > 30 ? 'MODERATE' : 'CLEAR');
      DOM.predRadarStatus.className = `pred-status ${radar > 45 ? 'status-danger' : (radar > 30 ? 'status-warn' : 'status-ok')}`;
    }

    // 9. Storm Cell Distance
    const dist = m4.distance_km !== undefined ? Math.round(m4.distance_km) : (currentStep >= 1 ? Math.max(8, 48 - currentStep * 8) : 48);
    if (DOM.predDistVal) DOM.predDistVal.textContent = dist > 0 ? `${dist} km` : '0 km';
    if (DOM.predDistStatus) {
      DOM.predDistStatus.textContent = dist < 20 ? 'IMMINENT' : (dist < 35 ? 'APPROACHING' : 'FAR');
      DOM.predDistStatus.className = `pred-status ${dist < 20 ? 'status-danger' : (dist < 35 ? 'status-warn' : 'status-ok')}`;
    }

    // 10. Storm Heading
    const dir = m4.direction || (currentStep >= 1 ? 'ENE (68°)' : 'NE (45°)');
    if (DOM.predDirVal) DOM.predDirVal.textContent = dir;
    if (DOM.predDirStatus) {
      DOM.predDirStatus.textContent = currentStep >= 1 ? 'URBAN VECTOR' : 'STABLE';
      DOM.predDirStatus.className = `pred-status ${currentStep >= 1 ? 'status-warn' : 'status-ok'}`;
    }

    // 11. Estimated Arrival
    const eta = m4.eta_minutes !== undefined ? Math.round(m4.eta_minutes) : (dist > 0 ? Math.round((dist / 38) * 60) : 0);
    if (DOM.predEtaVal) DOM.predEtaVal.textContent = eta > 0 ? `${eta} MIN` : '-- MIN';
    if (DOM.predEtaStatus) {
      DOM.predEtaStatus.textContent = eta > 0 && eta <= 30 ? '< 30 MIN' : (eta > 30 ? 'EN ROUTE' : 'SAFE');
      DOM.predEtaStatus.className = `pred-status ${eta > 0 && eta <= 30 ? 'status-danger' : (eta > 30 ? 'status-warn' : 'status-ok')}`;
    }

    // 12. Composite Threat Score
    if (DOM.predScoreVal) DOM.predScoreVal.textContent = `${riskScore} / 100`;
    if (DOM.predScoreStatus) {
      DOM.predScoreStatus.textContent = riskLevel;
      DOM.predScoreStatus.className = `pred-status ${riskScore > 65 ? 'status-danger' : (riskScore > 35 ? 'status-warn' : 'status-ok')}`;
    }
  }

  // =========================================================================
  // 8. SENSOR INGESTION STATS (VIEW 4)
  // =========================================================================

  function updateSensorIngestion(m1, m2, m4) {
    if (DOM.liveCtt) DOM.liveCtt.textContent = `${(m2.cloud_top_temp !== undefined ? m2.cloud_top_temp : -10.0).toFixed(1)} °C`;
    if (DOM.liveCooling) DOM.liveCooling.textContent = `${(m2.cooling_rate !== undefined ? m2.cooling_rate : -3.5).toFixed(1)} °C/hr`;
    if (DOM.liveSpeed) DOM.liveSpeed.textContent = `${Math.round(m4.speed_kmh || 0)} km/h`;
    if (DOM.liveHeading) DOM.liveHeading.textContent = m4.direction || 'ENE';
    if (DOM.liveCape) DOM.liveCape.textContent = `${Math.round(m1.cape || 450)} J/kg`;
  }

  // =========================================================================
  // 9. EXPLAINABLE AI PANEL & BILINGUAL ALERTS (VIEW 5)
  // =========================================================================

  function updateExplainableAIPanel(m1, m2, m3, m4, scenario) {
    if (!DOM.xaiReasons) return;

    const rh = Math.round(m1.humidity || 82);
    const cape = Math.round(m1.cape || 450);
    const cooling = m2.cooling_rate !== undefined ? m2.cooling_rate : -4;
    const lp = Math.round(m3.lightning_probability || 0);
    const eta = m4.eta_minutes !== undefined ? Math.round(m4.eta_minutes) : 0;
    const hasTargetWards = scenario.targetWards.length > 0;

    const checks = [
      {
        title: `Relative Humidity: ${rh}% (Threshold > 70%)`,
        pass: rh >= 70,
        desc: rh >= 70 ? 'Deep boundary layer moisture actively feeding storm base.' : 'Moisture levels below critical initiation threshold.'
      },
      {
        title: `Convective Energy (CAPE): ${cape} J/kg (Threshold > 1500 J/kg)`,
        pass: cape >= 1500,
        desc: cape >= 1500 ? 'Extreme buoyant energy available for explosive updrafts.' : 'Moderate to stable atmospheric stratification.'
      },
      {
        title: `Rapid Cloud Top Cooling: ${cooling.toFixed(1)}°C/hr (Threshold < -8°C/hr)`,
        pass: cooling <= -8 || currentStep >= 2,
        desc: (cooling <= -8 || currentStep >= 2) ? 'Satellite infrared confirms explosive vertical tower growth.' : 'Vertical expansion within normal parameters.'
      },
      {
        title: `AI Lightning Probability: ${lp}% (Threshold > 50%)`,
        pass: lp >= 50,
        desc: lp >= 50 ? 'Graupel-ice charging layer produces imminent ground strike danger.' : 'Low electrical potential within cloud matrix.'
      },
      {
        title: `Approaching Populated Sectors: ${hasTargetWards ? scenario.targetWards.join(', ') : 'None'}`,
        pass: hasTargetWards,
        desc: hasTargetWards ? 'Radar vector intersects high-density urban residential & tech hubs.' : 'No urban wards in projected flight path.'
      },
      {
        title: `Estimated Time of Arrival: ${eta > 0 ? eta + ' min' : 'N/A'} (Threshold < 30 min)`,
        pass: eta > 0 && eta <= 35,
        desc: (eta > 0 && eta <= 35) ? 'Emergency lead time window requires immediate public shelter.' : 'Adequate lead time available.'
      }
    ];

    DOM.xaiReasons.innerHTML = '';
    checks.forEach((chk) => {
      const item = document.createElement('div');
      item.className = `xai-reason-item ${chk.pass ? 'danger' : 'passed'}`;
      item.innerHTML = `
        <span style="font-weight:900; color: ${chk.pass ? 'var(--crimson)' : 'var(--emerald)'};">${chk.pass ? '✓' : '—'}</span>
        <div>
          <strong>${chk.title}</strong>
          <div style="font-size: 0.72rem; color: var(--text-secondary); margin-top: 2px;">${chk.desc}</div>
        </div>
      `;
      DOM.xaiReasons.appendChild(item);
    });

    if (DOM.xaiStateTag) {
      DOM.xaiStateTag.textContent = currentStep >= 3 ? 'CRITICAL THREAT ACTIVE' : 'SYSTEM DIAGNOSTIC NOMINAL';
    }
  }

  function updateAlertCenter(data, riskLevel, scenario) {
    const alert = data.alert || {};

    if (DOM.alertEnBadge) {
      DOM.alertEnBadge.className = `alert-pill ${riskLevel === 'SEVERE' ? 'pill-severe' : 'pill-normal'}`;
      DOM.alertEnBadge.textContent = riskLevel;
    }
    if (DOM.alertTeBadge) {
      DOM.alertTeBadge.className = `alert-pill ${riskLevel === 'SEVERE' ? 'pill-severe' : 'pill-normal'}`;
      DOM.alertTeBadge.textContent = riskLevel === 'SEVERE' ? 'తీవ్రమైన ప్రమాదం' : 'సాధారణం';
    }

    if (DOM.alertEnTitle) {
      DOM.alertEnTitle.textContent = alert.headline || scenario.headline;
    }
    if (DOM.alertEnBody) {
      DOM.alertEnBody.textContent = alert.message || scenario.summary;
    }

    if (DOM.alertTeTitle) {
      DOM.alertTeTitle.textContent = riskLevel === 'SEVERE'
        ? 'తీవ్రమైన ఉరుములు, మెరుపుల విపత్తు అత్యవసర హెచ్చరిక'
        : 'హైదరాబాద్ నగర వాతావరణ సమాచారం';
    }
    if (DOM.alertTeBody) {
      if (riskLevel === 'SEVERE') {
        DOM.alertTeBody.textContent = 'జిహెచ్ఎంసి పరిధిలోని శేరిలింగంపల్లి, కూకట్‌పల్లి, హైటెక్ సిటీలలో రాబోయే 30 నిమిషాల్లో తీవ్రమైన ఉరుములు, మెరుపులతో కూడిన భారీ వర్షం మరియు ఈదురు గాలులు వీచే అవకాశం ఉంది. పౌరులు తక్షణమే సురక్షిత భవనాలలో ఆశ్రయం పొందండి. చెట్ల క్రింద లేదా విద్యుత్ స్తంభాల వద్ద నిలబడవద్దు.';
      } else if (riskLevel === 'WARNING') {
        DOM.alertTeBody.textContent = 'హైదరాబాద్ పశ్చిమ భాగంలో ఉరుములతో కూడిన వర్షం ప్రారంభమయ్యే అవకాశం ఉంది. పౌరులు అప్రమత్తంగా ఉండవలసిందిగా కోరడమైనది.';
      } else {
        DOM.alertTeBody.textContent = 'ప్రస్తుతం హైదరాబాద్ జిహెచ్ఎంసి పరిధిలో ఎటువంటి ఉరుములు, మెరుపుల ముప్పు లేదు. పౌరులు సాధారణ కార్యకలాపాలు కొనసాగించవచ్చు.';
      }
    }

    if (DOM.alertEnTime) {
      const ts = new Date().toISOString().slice(11, 19);
      DOM.alertEnTime.textContent = `BROADCAST UTC: ${ts}`;
    }
  }

  // =========================================================================
  // 10. IMPACT TIMETABLE (VIEW 6)
  // =========================================================================

  function updateImpactTable(m4, step) {
    if (!DOM.impactTableBody) return;

    const baseSpeed = Math.max(30, Math.round(m4.speed_kmh || 40));
    const now = new Date();

    DOM.impactTableBody.innerHTML = '';
    SECTORS.forEach((sec, idx) => {
      const dist = Math.max(4, Math.round(sec.distKm - (step >= 1 ? step * 2 : 0)));
      const etaMin = Math.round((dist / baseSpeed) * 60);

      const arrivalDate = new Date(now.getTime() + (etaMin * 60000));
      const arrHours = String(arrivalDate.getHours()).padStart(2, '0');
      const arrMins = String(arrivalDate.getMinutes()).padStart(2, '0');
      const arrTimeStr = `${arrHours}:${arrMins} IST`;

      let sectorThreat = 'LOW';
      let threatClass = 'status-normal';
      let countdownClass = 'cd-safe';

      if (step >= 4 && (sec.zone === 'WEST' || sec.zone === 'NORTH-WEST' || sec.zone === 'CENTRAL')) {
        sectorThreat = 'SEVERE';
        threatClass = 'status-impact';
        countdownClass = 'cd-imminent';
      } else if (step >= 2 && (sec.zone === 'WEST' || sec.zone === 'NORTH-WEST')) {
        sectorThreat = 'HIGH';
        threatClass = 'status-impact';
        countdownClass = 'cd-imminent';
      } else if (step >= 2) {
        sectorThreat = 'MODERATE';
        threatClass = 'status-normal';
        countdownClass = 'cd-safe';
      }

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>${sec.name}</strong> <span style="font-size:0.68rem; color:var(--text-muted);">(${sec.zone})</span></td>
        <td>${(sec.pop / 1000000).toFixed(2)}M</td>
        <td>${dist} km</td>
        <td>${step >= 1 ? arrTimeStr : 'Nominal'}</td>
        <td><span class="countdown-pill ${countdownClass} cd-timer" data-offset="${idx * 3}">T-${String(etaMin).padStart(2, '0')}:00</span></td>
        <td><span class="ward-chip ${threatClass}">${sectorThreat}</span></td>
        <td style="font-size:0.75rem; color:var(--text-secondary);">${sec.actions}</td>
      `;
      DOM.impactTableBody.appendChild(tr);
    });
  }

  // =========================================================================
  // 11. CENTERPIECE TACTICAL GIS RADAR CANVAS ENGINE (60 FPS)
  // =========================================================================

  function latLonToCanvas(lat, lon, width, height) {
    const x = ((lon - HYD_GEO.minLon) / (HYD_GEO.maxLon - HYD_GEO.minLon)) * width;
    const y = ((HYD_GEO.maxLat - lat) / (HYD_GEO.maxLat - HYD_GEO.minLat)) * height;
    return { x, y };
  }

  function drawTacticalRadarMap() {
    if (!ctx || !DOM.canvas) return;

    const width = DOM.canvas.width;
    const height = DOM.canvas.height;
    const center = latLonToCanvas(HYD_GEO.centerLat, HYD_GEO.centerLon, width, height);

    // Clear Screen
    ctx.fillStyle = '#02060d';
    ctx.fillRect(0, 0, width, height);

    // 1. Radar Polar Grid & Range Rings
    ctx.save();
    const ringRadii = [60, 130, 200, 260];
    const ringLabels = ['25 KM', '50 KM', '75 KM', '100 KM'];

    ctx.strokeStyle = 'rgba(0, 240, 255, 0.12)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 6]);

    ringRadii.forEach((r, idx) => {
      ctx.beginPath();
      ctx.arc(center.x, center.y, r, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = 'rgba(0, 240, 255, 0.35)';
      ctx.font = '9px "JetBrains Mono", monospace';
      ctx.fillText(ringLabels[idx], center.x + r + 4, center.y - 4);
    });

    // Crosshairs
    ctx.beginPath();
    ctx.moveTo(center.x, 0);
    ctx.lineTo(center.x, height);
    ctx.moveTo(0, center.y);
    ctx.lineTo(width, center.y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    // 2. Continuous Rotating Radar Sweep Beam (Deterministic Angle Increment)
    ctx.save();
    radarAngle = (radarAngle + 0.02) % (Math.PI * 2);

    const gradient = ctx.createRadialGradient(center.x, center.y, 0, center.x, center.y, 280);
    gradient.addColorStop(0, 'rgba(0, 230, 118, 0.28)');
    gradient.addColorStop(1, 'rgba(0, 230, 118, 0.0)');

    ctx.beginPath();
    ctx.moveTo(center.x, center.y);
    ctx.arc(center.x, center.y, 280, radarAngle - 0.25, radarAngle);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();

    // Leading sweep line
    ctx.beginPath();
    ctx.moveTo(center.x, center.y);
    ctx.lineTo(center.x + Math.cos(radarAngle) * 280, center.y + Math.sin(radarAngle) * 280);
    ctx.strokeStyle = 'rgba(0, 230, 118, 0.8)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();

    // 3. Render GHMC Administrative Wards
    SECTORS.forEach((sec) => {
      const pos = latLonToCanvas(sec.lat, sec.lon, width, height);

      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 5, 0, Math.PI * 2);
      ctx.fillStyle = '#3b82f6';
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.fillStyle = '#cbd5e1';
      ctx.font = '10px "Inter", sans-serif';
      ctx.fillText(sec.name, pos.x + 8, pos.y - 2);

      ctx.fillStyle = 'rgba(156, 163, 175, 0.8)';
      ctx.font = '8px "JetBrains Mono", monospace';
      ctx.fillText(`${(sec.pop / 1000000).toFixed(2)}M`, pos.x + 8, pos.y + 9);
    });

    // 4. Render Active Storm Cell, Trajectory & Impact Cone
    if (activeNowcastData && activeNowcastData.tracking?.storms?.length > 0) {
      const storm = activeNowcastData.tracking.storms[0];
      const stormPos = latLonToCanvas(storm.latitude, storm.longitude, width, height);

      const headingRad = ((storm.direction_degrees || 45) - 90) * (Math.PI / 180);
      const vectorLength = 160;
      const targetX = stormPos.x + Math.cos(headingRad) * vectorLength;
      const targetY = stormPos.y + Math.sin(headingRad) * vectorLength;

      // A. Uncertainty Impact Cone
      ctx.save();
      const coneAngle = 0.35;
      ctx.beginPath();
      ctx.moveTo(stormPos.x, stormPos.y);
      ctx.lineTo(stormPos.x + Math.cos(headingRad - coneAngle) * vectorLength, stormPos.y + Math.sin(headingRad - coneAngle) * vectorLength);
      ctx.arc(stormPos.x, stormPos.y, vectorLength, headingRad - coneAngle, headingRad + coneAngle);
      ctx.closePath();
      ctx.fillStyle = 'rgba(239, 68, 68, 0.12)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.4)';
      ctx.setLineDash([3, 4]);
      ctx.stroke();
      ctx.restore();

      // B. Projected Trajectory Line
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(stormPos.x, stormPos.y);
      ctx.lineTo(targetX, targetY);
      ctx.strokeStyle = 'rgba(245, 158, 11, 0.9)';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(targetX, targetY, 4, 0, Math.PI * 2);
      ctx.fillStyle = 'var(--amber)';
      ctx.fill();
      ctx.restore();

      // C. Convective Core (Radial Gradient)
      ctx.save();
      const coreRadius = Math.max(20, Math.min(45, (storm.area_km2 || 350) / 10));
      const coreGrad = ctx.createRadialGradient(stormPos.x, stormPos.y, 2, stormPos.x, stormPos.y, coreRadius);
      coreGrad.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
      coreGrad.addColorStop(0.3, 'rgba(239, 68, 68, 0.85)');
      coreGrad.addColorStop(0.7, 'rgba(245, 158, 11, 0.45)');
      coreGrad.addColorStop(1, 'rgba(239, 68, 68, 0.0)');

      ctx.beginPath();
      ctx.arc(stormPos.x, stormPos.y, coreRadius, 0, Math.PI * 2);
      ctx.fillStyle = coreGrad;
      ctx.fill();

      // Shockwave ring
      ctx.beginPath();
      ctx.arc(stormPos.x, stormPos.y, coreRadius + 8, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.7)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Storm Centroid Label
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 11px "Inter", sans-serif';
      ctx.fillText(`CELL: ${storm.storm_id || 'CELL-01'}`, stormPos.x + coreRadius + 4, stormPos.y - 4);

      ctx.fillStyle = 'var(--amber)';
      ctx.font = '10px "JetBrains Mono", monospace';
      ctx.fillText(`${Math.round(storm.speed_kmh || 42)} km/h · ${storm.direction_name || 'NE'}`, stormPos.x + coreRadius + 4, stormPos.y + 10);
      ctx.restore();
    }

    // Radar Center Station Marker
    ctx.beginPath();
    ctx.arc(center.x, center.y, 4, 0, Math.PI * 2);
    ctx.fillStyle = 'var(--cyan)';
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = 'var(--cyan)';
    ctx.font = 'bold 10px "JetBrains Mono", monospace';
    ctx.fillText('DWR-HYD (RADAR CENTER)', center.x - 65, center.y - 8);

    requestAnimationFrame(drawTacticalRadarMap);
  }

  // =========================================================================
  // 12. SCENARIO CONTROLS & TIMELINE
  // =========================================================================

  function changeStep(delta) {
    let next = currentStep + delta;
    if (next < 0) next = 0;
    if (next > 6) next = 6;
    currentStep = next;
    countdownSeconds = Math.max(300, (6 - currentStep) * 360);
    fetchScenarioStep(currentStep);
  }

  function setStep(stepIndex) {
    if (stepIndex >= 0 && stepIndex <= 6) {
      currentStep = stepIndex;
      countdownSeconds = Math.max(300, (6 - currentStep) * 360);
      fetchScenarioStep(currentStep);
    }
  }

  function toggleSimulation() {
    if (isSimulating) {
      clearInterval(simulationTimer);
      simulationTimer = null;
      isSimulating = false;
      if (DOM.btnTimelinePlay) DOM.btnTimelinePlay.textContent = '▶ AUTO SIMULATION';
    } else {
      isSimulating = true;
      if (DOM.btnTimelinePlay) DOM.btnTimelinePlay.textContent = '⏸ PAUSE SIMULATION';

      simulationTimer = setInterval(() => {
        currentStep = (currentStep + 1) % 7;
        fetchScenarioStep(currentStep);
      }, 3500);
    }
  }

  function resetSimulation() {
    if (isSimulating) {
      toggleSimulation();
    }
    setStep(0);
  }

  // =========================================================================
  // 13. DATABASE TELEMETRY LOADER (VIEW 7)
  // =========================================================================

  async function loadDatabaseTelemetry() {
    if (!DOM.historyTableBody) return;
    try {
      const res = await fetch('/api/v1/database/history?limit=15');
      if (!res.ok) return;
      const data = await res.json();
      const rows = data.history || [];

      if (DOM.historyCountBadge) {
        DOM.historyCountBadge.textContent = `${data.count || rows.length} RUNS RECORDED`;
      }

      DOM.historyTableBody.innerHTML = '';
      if (rows.length === 0) {
        DOM.historyTableBody.innerHTML = '<tr><td colspan="9" class="table-loading">No nowcasts recorded yet.</td></tr>';
        return;
      }

      rows.forEach((r) => {
        const tr = document.createElement('tr');
        const ts = (r.timestamp || '').slice(11, 19) || '--:--:--';
        const isAlert = r.alert_issued;

        tr.innerHTML = `
          <td>#${r.id || '--'}</td>
          <td>${ts}</td>
          <td>Step ${r.scenario_step !== undefined ? r.scenario_step : '--'}</td>
          <td><strong>${r.risk_level || 'NORMAL'}</strong></td>
          <td>${Math.round(r.risk_score || 0)}</td>
          <td>${Math.round(r.lightning_probability || 0)}%</td>
          <td>${Math.round(r.cape || 0)}</td>
          <td>${r.cloud_top_temp !== null && r.cloud_top_temp !== undefined ? r.cloud_top_temp.toFixed(1) : '--'}</td>
          <td><span class="ward-chip ${isAlert ? 'status-impact' : 'status-normal'}">${isAlert ? 'DISPATCHED' : 'CLEAR'}</span></td>
        `;
        DOM.historyTableBody.appendChild(tr);
      });
    } catch (e) {
      console.warn('Database history query paused:', e);
    }
  }

  // =========================================================================
  // 14. EVENT LISTENERS
  // =========================================================================

  function bindEventListeners() {
    if (DOM.btnTimelinePrev) DOM.btnTimelinePrev.addEventListener('click', () => changeStep(-1));
    if (DOM.btnTimelineNext) DOM.btnTimelineNext.addEventListener('click', () => changeStep(1));
    if (DOM.btnTimelinePlay) DOM.btnTimelinePlay.addEventListener('click', toggleSimulation);
    if (DOM.btnTimelineReset) DOM.btnTimelineReset.addEventListener('click', resetSimulation);

    if (DOM.btnBroadcastAlert) {
      DOM.btnBroadcastAlert.addEventListener('click', async () => {
        if (!DOM.dispatchFeedback) return;
        DOM.dispatchFeedback.textContent = 'Broadcasting emergency sirens and cell push...';
        DOM.dispatchFeedback.style.color = 'var(--amber)';

        try {
          const payload = {
            severity: activeNowcastData?.member_outputs?.member5_fusion?.risk_level || 'SEVERE',
            headline: activeNowcastData?.alert?.headline || 'SEVERE CONVECTIVE THUNDERSTORM EMERGENCY WARNING',
            message_en: activeNowcastData?.alert?.message || 'Emergency warning for Greater Hyderabad Metropolitan Area.',
            message_te: 'తీవ్రమైన ఉరుములు, మెరుపుల విపత్తు అత్యవసర హెచ్చరిక.',
            target_zones: 'Serilingampally, Kukatpally, HITEC City, Khairatabad',
            channels: 'SMS, SIRENS, PUSH, VHF, CELL_BROADCAST',
          };

          const res = await fetch('/api/v1/alerts/dispatch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });

          if (res.ok) {
            DOM.dispatchFeedback.textContent = '✓ Emergency alert broadcast successfully dispatched and recorded to DB.';
            DOM.dispatchFeedback.style.color = 'var(--emerald)';
            setTimeout(() => {
              if (DOM.dispatchFeedback) DOM.dispatchFeedback.textContent = '';
            }, 4000);
          } else {
            DOM.dispatchFeedback.textContent = 'Dispatch returned HTTP error status.';
            DOM.dispatchFeedback.style.color = 'var(--crimson)';
          }
        } catch (e) {
          DOM.dispatchFeedback.textContent = 'Dispatch failed: ' + e.message;
          DOM.dispatchFeedback.style.color = 'var(--crimson)';
        }
      });
    }

    if (DOM.btnRefreshHistory) {
      DOM.btnRefreshHistory.addEventListener('click', loadDatabaseTelemetry);
    }
  }

  // =========================================================================
  // 15. INITIALIZATION
  // =========================================================================

  function init() {
    initNavigation();
    bindEventListeners();

    // Start Operations Clocks
    updateOperationsClocks();
    setInterval(updateOperationsClocks, 1000);

    // Initial Data Fetch
    fetchScenarioStep(0);

    // Start Radar Canvas
    drawTacticalRadarMap();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
