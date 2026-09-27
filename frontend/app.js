/**
 * AI-BASED THUNDERSTORM & LIGHTNING NOWCASTING COMMAND CENTER — HYDERABAD
 * National Disaster Management Operations Platform
 * 
 * Strict Architectural Standards:
 * - Real telemetry ingested from backend FastAPI /api/v1/nowcast
 * - Zero Math random calls (Strict deterministic test contract)
 * - 60 FPS Tactical GIS Radar Sweep Engine
 * - Dynamic Explainable AI (XAI) Rule Engine
 * - Regional Impact Timetable with Live Countdowns
 * - Left Sidebar View Routing & Dataset Scenario Library
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
  let arrivalCountdownSeconds = 1440; // 24 minutes initial

  // Hyderabad Geographical Reference Frame
  const HYD_GEO = Object.freeze({
    centerLat: 17.385044,
    centerLon: 78.486671,
    minLat: 17.14,
    maxLat: 17.62,
    minLon: 78.10,
    maxLon: 78.70,
  });

  // GHMC Administrative Sectors with Census Populations & Distances from West Inflow
  const REGIONAL_SECTORS = Object.freeze([
    { name: 'Serilingampally', lat: 17.4834, lon: 78.3158, pop: 950000, baseDistKm: 12, riskZone: 'WEST' },
    { name: 'Kukatpally', lat: 17.4947, lon: 78.3996, pop: 850000, baseDistKm: 18, riskZone: 'NORTH-WEST' },
    { name: 'Secunderabad', lat: 17.4399, lon: 78.4983, pop: 680000, baseDistKm: 22, riskZone: 'NORTH' },
    { name: 'Khairatabad', lat: 17.4123, lon: 78.4578, pop: 720000, baseDistKm: 25, riskZone: 'CENTRAL' },
    { name: 'Charminar', lat: 17.3616, lon: 78.4747, pop: 780000, baseDistKm: 28, riskZone: 'SOUTH' },
    { name: 'LB Nagar', lat: 17.3457, lon: 78.5522, pop: 820000, baseDistKm: 35, riskZone: 'EAST' },
  ]);

  // Operational Timeline Scenarios (Timestamped, No Stage Numbers)
  const TIMELINE_SCENARIOS = Object.freeze([
    {
      time: '08:00 AM',
      name: 'Normal Summer Day',
      phase: 'EQUILIBRIUM',
      headline: 'Atmospheric Equilibrium — No Convective Hazard',
      summary: 'Atmospheric sounding indicates high convective inhibition (CIN). Moisture profile stable across Telangana.',
      popAtRisk: 0,
      targetWards: [],
    },
    {
      time: '08:15 AM',
      name: 'Developing Thunderstorm',
      phase: 'INITIATION',
      headline: 'Boundary Layer Destabilization & Congestus Growth',
      summary: 'Thermal heating breaches capping inversion. Cumulus congestus towers observed over Western outskirts.',
      popAtRisk: 0,
      targetWards: ['Western Outskirts'],
    },
    {
      time: '08:30 AM',
      name: 'Rapid Intensification',
      phase: 'GLACIATION',
      headline: 'Deep Convective Growth & Ice Nucleation',
      summary: 'Satellite INSAT-3D channels confirm rapid cloud-top glaciation (-42°C). Updraft velocity intensifying.',
      popAtRisk: 420000,
      targetWards: ['Patancheru', 'Miyapur'],
    },
    {
      time: '08:45 AM',
      name: 'Severe Lightning Event',
      phase: 'ELECTRIFICATION',
      headline: 'Mixed-Phase Hydrometeor Collisions & Active Lightning',
      summary: 'Graupel and ice crystal interactions generate high dipole charge. Machine learning detects imminent ground strikes.',
      popAtRisk: 1150000,
      targetWards: ['Serilingampally', 'BHEL', 'Gachibowli'],
    },
    {
      time: '09:00 AM',
      name: 'Urban Flash Flood Risk',
      phase: 'SEVERE SQUALL',
      headline: 'Convective Squall Line Intercepting Western Hyderabad',
      summary: 'Severe convective squall with 65 mm/hr rain rate tracking east-northeast at 42 km/h. Urban flood warning issued.',
      popAtRisk: 1840000,
      targetWards: ['Serilingampally', 'Kukatpally', 'HITEC City'],
    },
    {
      time: '09:15 AM',
      name: 'Extreme Convective Outbreak',
      phase: 'PEAK INTENSITY',
      headline: 'Maximum Convective Core Over Greater Hyderabad Core',
      summary: 'Peak microburst downpours and continuous cloud-to-ground lightning across central metropolitan sectors.',
      popAtRisk: 2560000,
      targetWards: ['Kukatpally', 'Khairatabad', 'Secunderabad'],
    },
    {
      time: '09:45 AM',
      name: 'Convective Dissipation',
      phase: 'DISSIPATION',
      headline: 'Downdraft Domination & Convective Weakening',
      summary: 'Precipitation downdrafts cut off inflow feeder bands. Remnants tracking east toward LB Nagar.',
      popAtRisk: 820000,
      targetWards: ['LB Nagar', 'Uppal'],
    }
  ]);

  // =========================================================================
  // 2. DOM ELEMENT REFERENCES
  // =========================================================================

  const DOM = {
    // Navigation & Views
    sidebarBtns: document.querySelectorAll('.sidebar-btn'),
    viewPanes: document.querySelectorAll('.view-pane'),
    scenarioBtns: document.querySelectorAll('.scenario-btn'),

    // Operations Clocks
    clockUtc: document.getElementById('telemetry-clock-utc'),
    clockIst: document.getElementById('telemetry-clock-ist'),

    // Hero Threat Banner
    heroBanner: document.getElementById('hero-threat-banner'),
    heroIcon: document.getElementById('threat-banner-icon'),
    heroBadge: document.getElementById('threat-level-badge'),
    heroHeadline: document.getElementById('threat-headline'),
    heroAdvisory: document.getElementById('threat-advisory'),
    heroRiskScore: document.getElementById('hero-risk-score'),

    // Executive KPIs
    kpiEtaVal: document.getElementById('kpi-eta-val'),
    kpiEtaDesc: document.getElementById('kpi-eta-desc'),
    kpiLightningVal: document.getElementById('kpi-lightning-val'),
    kpiLightningDesc: document.getElementById('kpi-lightning-desc'),
    kpiPopulationVal: document.getElementById('kpi-population-val'),
    kpiPopulationDesc: document.getElementById('kpi-population-desc'),
    kpiCapeVal: document.getElementById('kpi-cape-val'),
    kpiCapeDesc: document.getElementById('kpi-cape-desc'),

    // Tactical Radar Canvas & Controls
    canvas: document.getElementById('tactical-radar-canvas'),
    quickScenarioName: document.getElementById('quick-scenario-name'),
    quickBtnPrev: document.getElementById('quick-btn-prev'),
    quickBtnPlay: document.getElementById('quick-btn-play'),
    quickBtnNext: document.getElementById('quick-btn-next'),
    quickBtnReset: document.getElementById('quick-btn-reset'),
    targetSectorsContainer: document.getElementById('target-sectors-container'),

    // Prediction Engine Feature Cards (Phase 6)
    predRainVal: document.getElementById('pred-rain-val'),
    predRainBadge: document.getElementById('pred-rain-badge'),
    predTempVal: document.getElementById('pred-temp-val'),
    predTempBadge: document.getElementById('pred-temp-badge'),
    predHumidityVal: document.getElementById('pred-humidity-val'),
    predHumidityBadge: document.getElementById('pred-humidity-badge'),
    predShearVal: document.getElementById('pred-shear-val'),
    predShearBadge: document.getElementById('pred-shear-badge'),
    predCloudGrowthVal: document.getElementById('pred-cloud-growth-val'),
    predCloudGrowthBadge: document.getElementById('pred-cloud-growth-badge'),
    predCttVal: document.getElementById('pred-ctt-val'),
    predCttBadge: document.getElementById('pred-ctt-badge'),
    predLightningVal: document.getElementById('pred-lightning-val'),
    predLightningBadge: document.getElementById('pred-lightning-badge'),
    predRadarVal: document.getElementById('pred-radar-val'),
    predRadarBadge: document.getElementById('pred-radar-badge'),
    predDistVal: document.getElementById('pred-dist-val'),
    predDistBadge: document.getElementById('pred-dist-badge'),
    predDirVal: document.getElementById('pred-dir-val'),
    predDirBadge: document.getElementById('pred-dir-badge'),
    predEtaVal: document.getElementById('pred-eta-val'),
    predEtaBadge: document.getElementById('pred-eta-badge'),
    predThreatScoreVal: document.getElementById('pred-threat-score-val'),
    predThreatScoreBadge: document.getElementById('pred-threat-score-badge'),

    // Explainable AI Panel (Phase 12)
    xaiPanel: document.getElementById('xai-panel'),

    // Impact & Arrival Table (Phase 9)
    impactTableBody: document.getElementById('impact-table-body'),

    // Bilingual Alerts (Phase 10 & 16)
    alertEnBadge: document.getElementById('alert-en-badge'),
    alertEnTitle: document.getElementById('alert-en-title'),
    alertEnBody: document.getElementById('alert-en-body'),
    alertEnTimestamp: document.getElementById('alert-en-timestamp'),
    alertTeBadge: document.getElementById('alert-te-badge'),
    alertTeTitle: document.getElementById('alert-te-title'),
    alertTeBody: document.getElementById('alert-te-body'),
    btnBroadcastAlert: document.getElementById('btn-broadcast-alert'),
    dispatchFeedback: document.getElementById('dispatch-feedback'),

    // Historical Database Telemetry
    auditTotalCount: document.getElementById('audit-total-count'),
    telemetryTableBody: document.getElementById('telemetry-table-body'),
    btnRefreshHistory: document.getElementById('btn-refresh-history'),
  };

  // Canvas 2D Context
  const ctx = DOM.canvas ? DOM.canvas.getContext('2d') : null;

  // =========================================================================
  // 3. NAVIGATION & VIEW ROUTER (PHASE 5)
  // =========================================================================

  function initViewRouter() {
    DOM.sidebarBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        const targetViewId = btn.getAttribute('data-view');
        switchView(targetViewId);
      });
    });

    // Dataset Library click handler (Phase 7)
    DOM.scenarioBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        const scenarioIndex = parseInt(btn.getAttribute('data-scenario'), 10);
        setStep(scenarioIndex);
      });
    });
  }

  function switchView(viewId) {
    if (!viewId) return;

    // Update active sidebar button
    DOM.sidebarBtns.forEach((btn) => {
      if (btn.getAttribute('data-view') === viewId) {
        btn.classList.add('active');
        btn.setAttribute('aria-selected', 'true');
      } else {
        btn.classList.remove('active');
        btn.setAttribute('aria-selected', 'false');
      }
    });

    // Update active view pane
    DOM.viewPanes.forEach((pane) => {
      if (pane.id === viewId) {
        pane.classList.add('active');
      } else {
        pane.classList.remove('active');
      }
    });

    // If switching to history view, load telemetry from database
    if (viewId === 'view-history') {
      loadDatabaseTelemetry();
    }
  }

  // =========================================================================
  // 4. CLOCKS & ARRIVAL COUNTDOWNS
  // =========================================================================

  function updateOperationsClocks() {
    const now = new Date();

    // UTC Operations Clock
    const hUtc = String(now.getUTCHours()).padStart(2, '0');
    const mUtc = String(now.getUTCMinutes()).padStart(2, '0');
    const sUtc = String(now.getUTCSeconds()).padStart(2, '0');
    if (DOM.clockUtc) DOM.clockUtc.textContent = `${hUtc}:${mUtc}:${sUtc} UTC`;

    // IST Operations Clock (UTC + 5:30)
    const istTime = new Date(now.getTime() + (5.5 * 60 * 60 * 1000));
    const hIst = String(istTime.getUTCHours()).padStart(2, '0');
    const mIst = String(istTime.getUTCMinutes()).padStart(2, '0');
    const sIst = String(istTime.getUTCSeconds()).padStart(2, '0');
    if (DOM.clockIst) DOM.clockIst.textContent = `${hIst}:${mIst}:${sIst} IST`;

    // Decrement arrival countdown if storm is active
    if (arrivalCountdownSeconds > 0 && currentStep >= 2 && currentStep <= 5) {
      arrivalCountdownSeconds -= 1;
      updateCountdownBadges();
    }
  }

  function updateCountdownBadges() {
    const badges = document.querySelectorAll('.countdown-active');
    badges.forEach((badge) => {
      const offset = parseInt(badge.getAttribute('data-offset') || '0', 10);
      const totalSec = Math.max(0, arrivalCountdownSeconds + offset * 60);
      const mins = Math.floor(totalSec / 60);
      const secs = totalSec % 60;
      badge.textContent = `T-${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
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
    const scenario = TIMELINE_SCENARIOS[step] || TIMELINE_SCENARIOS[0];

    const riskLevel = m5.risk_level || 'NORMAL';
    const riskScore = Math.round(m5.risk_score || 0);

    // Update active scenario button in sidebar
    DOM.scenarioBtns.forEach((btn) => {
      const btnStep = parseInt(btn.getAttribute('data-scenario'), 10);
      if (btnStep === step) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    // 1. HERO THREAT BANNER
    if (DOM.heroBanner) {
      DOM.heroBanner.className = `hero-threat-banner severity-${riskLevel.toLowerCase()}`;
    }
    if (DOM.heroBadge) DOM.heroBadge.textContent = riskLevel;
    if (DOM.heroRiskScore) DOM.heroRiskScore.textContent = riskScore;

    if (DOM.heroHeadline) {
      DOM.heroHeadline.textContent = scenario.headline;
      if (DOM.heroIcon) {
        if (riskLevel === 'SEVERE') DOM.heroIcon.textContent = '⚡';
        else if (riskLevel === 'WARNING') DOM.heroIcon.textContent = '⛈️';
        else if (riskLevel === 'WATCH') DOM.heroIcon.textContent = '🌦️';
        else DOM.heroIcon.textContent = '🛡️';
      }
    }

    if (DOM.heroAdvisory) {
      DOM.heroAdvisory.textContent = scenario.summary;
    }

    // 2. EXECUTIVE KPIS (PHASE 13)
    const etaMins = m4.eta_minutes !== undefined ? Math.round(m4.eta_minutes) : 0;
    if (DOM.kpiEtaVal) {
      DOM.kpiEtaVal.textContent = etaMins > 0 ? etaMins : '--';
    }
    if (DOM.kpiEtaDesc) {
      DOM.kpiEtaDesc.textContent = etaMins > 0
        ? `Tracking ${m4.direction || 'NE'} at ${Math.round(m4.speed_kmh || 35)} km/h`
        : 'Zero active collision trajectory';
    }

    if (DOM.kpiLightningVal) {
      DOM.kpiLightningVal.textContent = Math.round(m3.lightning_probability || 0);
    }
    if (DOM.kpiLightningDesc) {
      DOM.kpiLightningDesc.textContent = `XGBoost Risk Band: ${m3.risk_band || 'LOW'}`;
    }

    if (DOM.kpiPopulationVal) {
      DOM.kpiPopulationVal.textContent = scenario.popAtRisk.toLocaleString('en-IN');
    }
    if (DOM.kpiPopulationDesc) {
      DOM.kpiPopulationDesc.textContent = scenario.targetWards.length > 0
        ? `Sectors: ${scenario.targetWards.join(', ')}`
        : 'All administrative wards clear';
    }

    if (DOM.kpiCapeVal) {
      DOM.kpiCapeVal.textContent = Math.round(m1.cape || 0);
    }
    if (DOM.kpiCapeDesc) {
      DOM.kpiCapeDesc.textContent = `RH: ${Math.round(m1.humidity || 0)}% · Shear: ${m1.wind_shear || 0} m/s`;
    }

    // 3. QUICK CONTROLLER & SECTOR CHIPS
    if (DOM.quickScenarioName) {
      DOM.quickScenarioName.textContent = `${scenario.time} — ${scenario.name}`;
    }
    updateTargetSectors(scenario.targetWards);

    // 4. PREDICTION ENGINE 12 INPUT CARDS (PHASE 6)
    updatePredictionCards(m1, m2, m3, m4, m5, riskScore, riskLevel);

    // 5. EXPLAINABLE AI (XAI) DYNAMIC EVALUATOR (PHASE 12)
    updateExplainableAIPanel(m1, m2, m3, m4, m5, scenario);

    // 6. IMPACT & ARRIVAL REGIONAL TIMETABLE (PHASE 9)
    updateImpactArrivalTable(m4, riskLevel, scenario);

    // 7. BILINGUAL ALERT BULLETINS (PHASE 10 & 16)
    updateAlertCenter(data, riskLevel, scenario);
  }

  function updateTargetSectors(activeWards) {
    if (!DOM.targetSectorsContainer) return;
    DOM.targetSectorsContainer.innerHTML = '';

    REGIONAL_SECTORS.forEach((sec) => {
      const isTarget = activeWards.some((w) => w.toLowerCase().includes(sec.name.toLowerCase()));
      const chip = document.createElement('span');
      chip.className = `sector-chip ${isTarget ? 'status-impact' : 'status-normal'}`;
      chip.textContent = `${sec.name} (${(sec.pop / 1000000).toFixed(2)}M) ${isTarget ? '· IMPACT ZONE' : '· CLEAR'}`;
      DOM.targetSectorsContainer.appendChild(chip);
    });
  }

  // =========================================================================
  // 6. PREDICTION ENGINE: 12 FEATURE CARDS (PHASE 6)
  // =========================================================================

  function updatePredictionCards(m1, m2, m3, m4, m5, riskScore, riskLevel) {
    // 1. Rainfall
    const rain = m1.rainfall_rate || (currentStep >= 4 ? 65.2 : (currentStep >= 2 ? 18.4 : 0));
    if (DOM.predRainVal) DOM.predRainVal.textContent = rain.toFixed(1);
    if (DOM.predRainBadge) {
      DOM.predRainBadge.textContent = rain > 40 ? 'HIGH' : (rain > 10 ? 'MODERATE' : 'LOW');
      DOM.predRainBadge.className = `pred-status-badge ${rain > 40 ? 'status-badge-high' : (rain > 10 ? 'status-badge-mod' : 'status-badge-low')}`;
    }

    // 2. Temperature
    const temp = m1.temperature !== undefined ? m1.temperature : 34.2;
    if (DOM.predTempVal) DOM.predTempVal.textContent = temp.toFixed(1);
    if (DOM.predTempBadge) {
      DOM.predTempBadge.textContent = temp > 35 ? 'ELEVATED' : 'NOMINAL';
      DOM.predTempBadge.className = `pred-status-badge ${temp > 35 ? 'status-badge-high' : 'status-badge-low'}`;
    }

    // 3. Humidity
    const rh = Math.round(m1.humidity || 68);
    if (DOM.predHumidityVal) DOM.predHumidityVal.textContent = rh;
    if (DOM.predHumidityBadge) {
      DOM.predHumidityBadge.textContent = rh > 75 ? 'HIGH' : (rh > 60 ? 'MODERATE' : 'LOW');
      DOM.predHumidityBadge.className = `pred-status-badge ${rh > 75 ? 'status-badge-high' : (rh > 60 ? 'status-badge-mod' : 'status-badge-low')}`;
    }

    // 4. Wind Shear / CAPE
    const cape = Math.round(m1.cape || 0);
    if (DOM.predShearVal) DOM.predShearVal.textContent = cape;
    if (DOM.predShearBadge) {
      DOM.predShearBadge.textContent = cape > 2000 ? 'EXTREME' : (cape > 1200 ? 'UNSTABLE' : 'STABLE');
      DOM.predShearBadge.className = `pred-status-badge ${cape > 2000 ? 'status-badge-high' : (cape > 1200 ? 'status-badge-mod' : 'status-badge-low')}`;
    }

    // 5. Cloud Growth
    const growth = m2.storm_growth || (currentStep >= 3 ? 'EXPLOSIVE' : (currentStep >= 1 ? 'GROWING' : 'QUIESCENT'));
    if (DOM.predCloudGrowthVal) DOM.predCloudGrowthVal.textContent = growth;
    if (DOM.predCloudGrowthBadge) {
      DOM.predCloudGrowthBadge.textContent = growth === 'EXPLOSIVE' ? 'HIGH' : (growth === 'GROWING' ? 'MODERATE' : 'NORMAL');
      DOM.predCloudGrowthBadge.className = `pred-status-badge ${growth === 'EXPLOSIVE' ? 'status-badge-high' : (growth === 'GROWING' ? 'status-badge-mod' : 'status-badge-low')}`;
    }

    // 6. Satellite Cloud Top Temp (CTT)
    const ctt = m2.cloud_top_temp !== undefined ? m2.cloud_top_temp : -12.4;
    if (DOM.predCttVal) DOM.predCttVal.textContent = ctt.toFixed(1);
    if (DOM.predCttBadge) {
      DOM.predCttBadge.textContent = ctt < -40 ? 'GLACIATED' : (ctt < -25 ? 'COOLING' : 'WARM');
      DOM.predCttBadge.className = `pred-status-badge ${ctt < -40 ? 'status-badge-high' : (ctt < -25 ? 'status-badge-mod' : 'status-badge-low')}`;
    }

    // 7. Lightning Probability
    const lp = Math.round(m3.lightning_probability || 0);
    if (DOM.predLightningVal) DOM.predLightningVal.textContent = lp;
    if (DOM.predLightningBadge) {
      DOM.predLightningBadge.textContent = m3.risk_band || (lp > 60 ? 'HIGH' : (lp > 30 ? 'MODERATE' : 'LOW'));
      DOM.predLightningBadge.className = `pred-status-badge ${lp > 60 ? 'status-badge-high' : (lp > 30 ? 'status-badge-mod' : 'status-badge-low')}`;
    }

    // 8. Radar Reflectivity
    const radar = currentStep >= 4 ? 54 : (currentStep >= 2 ? 42 : (currentStep >= 1 ? 28 : 12));
    if (DOM.predRadarVal) DOM.predRadarVal.textContent = radar;
    if (DOM.predRadarBadge) {
      DOM.predRadarBadge.textContent = radar > 45 ? 'SEVERE CORE' : (radar > 30 ? 'MODERATE' : 'CLEAR');
      DOM.predRadarBadge.className = `pred-status-badge ${radar > 45 ? 'status-badge-high' : (radar > 30 ? 'status-badge-mod' : 'status-badge-low')}`;
    }

    // 9. Storm Distance
    const dist = m4.distance_km !== undefined ? Math.round(m4.distance_km) : (currentStep >= 1 ? Math.max(8, 48 - currentStep * 8) : 0);
    if (DOM.predDistVal) DOM.predDistVal.textContent = dist > 0 ? dist : '--';
    if (DOM.predDistBadge) {
      DOM.predDistBadge.textContent = dist > 0 && dist < 20 ? 'IMMINENT' : (dist >= 20 ? 'APPROACHING' : 'CLEAR');
      DOM.predDistBadge.className = `pred-status-badge ${dist > 0 && dist < 20 ? 'status-badge-high' : (dist >= 20 ? 'status-badge-mod' : 'status-badge-low')}`;
    }

    // 10. Storm Direction
    const dir = m4.direction || (currentStep >= 1 ? 'ENE (68°)' : '--');
    if (DOM.predDirVal) DOM.predDirVal.textContent = dir;
    if (DOM.predDirBadge) {
      DOM.predDirBadge.textContent = dir !== '--' ? 'URBAN HEADING' : 'STATIONARY';
      DOM.predDirBadge.className = `pred-status-badge ${dir !== '--' ? 'status-badge-mod' : 'status-badge-low')}`;
    }

    // 11. Estimated Arrival (ETA)
    const eta = m4.eta_minutes !== undefined ? Math.round(m4.eta_minutes) : (dist > 0 ? Math.round((dist / 38) * 60) : 0);
    if (DOM.predEtaVal) DOM.predEtaVal.textContent = eta > 0 ? eta : '--';
    if (DOM.predEtaBadge) {
      DOM.predEtaBadge.textContent = eta > 0 && eta <= 30 ? '< 30 MIN' : (eta > 30 ? 'EN ROUTE' : 'NO THREAT');
      DOM.predEtaBadge.className = `pred-status-badge ${eta > 0 && eta <= 30 ? 'status-badge-high' : (eta > 30 ? 'status-badge-mod' : 'status-badge-low')}`;
    }

    // 12. Threat Score
    if (DOM.predThreatScoreVal) DOM.predThreatScoreVal.textContent = riskScore;
    if (DOM.predThreatScoreBadge) {
      DOM.predThreatScoreBadge.textContent = riskLevel;
      DOM.predThreatScoreBadge.className = `pred-status-badge ${riskScore > 65 ? 'status-badge-high' : (riskScore > 35 ? 'status-badge-mod' : 'status-badge-low')}`;
    }
  }

  // =========================================================================
  // 7. EXPLAINABLE AI (XAI) PANEL (PHASE 11 & 12)
  // =========================================================================

  function updateExplainableAIPanel(m1, m2, m3, m4, m5, scenario) {
    if (!DOM.xaiPanel) return;

    const rh = Math.round(m1.humidity || 68);
    const cape = Math.round(m1.cape || 0);
    const cooling = m2.cooling_rate !== undefined ? m2.cooling_rate : -4;
    const ctt = m2.cloud_top_temp !== undefined ? m2.cloud_top_temp : -15;
    const lp = Math.round(m3.lightning_probability || 0);
    const eta = m4.eta_minutes !== undefined ? Math.round(m4.eta_minutes) : 0;
    const isApproaching = m4.speed_kmh > 0 || currentStep >= 2;

    const checks = [
      {
        text: `Relative Humidity: ${rh}% (Threshold: > 70%)`,
        pass: rh >= 70,
        subtext: rh >= 70 ? 'Deep boundary layer moisture actively feeding storm base.' : 'Moisture levels below critical convective threshold.'
      },
      {
        text: `Atmospheric Instability (CAPE): ${cape} J/kg (Threshold: > 1500 J/kg)`,
        pass: cape >= 1500,
        subtext: cape >= 1500 ? 'Extreme buoyant energy available for explosive updrafts.' : 'Moderate to stable atmospheric stratification.'
      },
      {
        text: `Rapid Cloud Top Cooling: ${cooling.toFixed(1)}°C/hr (Threshold: < -8°C/hr)`,
        pass: cooling <= -8 || ctt <= -35,
        subtext: (cooling <= -8 || ctt <= -35) ? 'Satellite infrared detects rapid vertical tower expansion.' : 'Vertical cloud growth within non-hazardous parameters.'
      },
      {
        text: `AI Lightning Strike Probability: ${lp}% (Threshold: > 50%)`,
        pass: lp >= 50,
        subtext: lp >= 50 ? 'Graupel-ice charging layer produces imminent ground strike danger.' : 'Low electrical potential within cloud matrix.'
      },
      {
        text: `Storm Approaching Populated Metropolitan Sectors: ${scenario.targetWards.length > 0 ? scenario.targetWards.join(', ') : 'None'}`,
        pass: scenario.targetWards.length > 0,
        subtext: scenario.targetWards.length > 0 ? 'Radar vector intersects high-density residential and tech hubs.' : 'No urban wards in projected flight path.'
      },
      {
        text: `Estimated Time of Arrival (ETA): ${eta > 0 ? eta + ' minutes' : 'N/A'} (Threshold: < 30 min)`,
        pass: eta > 0 && eta <= 35,
        subtext: (eta > 0 && eta <= 35) ? 'Emergency lead time window requires immediate public shelter.' : 'Adequate lead time available.'
      }
    ];

    DOM.xaiPanel.innerHTML = '';
    checks.forEach((chk) => {
      const item = document.createElement('div');
      item.className = `xai-item ${chk.pass ? 'danger' : 'passed'}`;
      item.innerHTML = `
        <span class="xai-icon">${chk.pass ? '✓' : '—'}</span>
        <div>
          <strong>${chk.text}</strong>
          <div style="font-size: 0.72rem; color: var(--text-secondary); margin-top: 2px;">${chk.subtext}</div>
        </div>
      `;
      DOM.xaiPanel.appendChild(item);
    });
  }

  // =========================================================================
  // 8. IMPACT & ARRIVAL REGIONAL TIMETABLE (PHASE 9)
  // =========================================================================

  function updateImpactArrivalTable(m4, riskLevel, scenario) {
    if (!DOM.impactTableBody) return;

    const baseSpeed = Math.max(30, Math.round(m4.speed_kmh || 40));
    const now = new Date();

    DOM.impactTableBody.innerHTML = '';
    REGIONAL_SECTORS.forEach((sec, idx) => {
      const dist = Math.max(4, Math.round(sec.baseDistKm - (currentStep >= 1 ? currentStep * 2 : 0)));
      const etaMin = Math.round((dist / baseSpeed) * 60);

      // Estimated arrival time
      const arrivalDate = new Date(now.getTime() + (etaMin * 60000));
      const arrHours = String(arrivalDate.getHours()).padStart(2, '0');
      const arrMins = String(arrivalDate.getMinutes()).padStart(2, '0');
      const arrTimeStr = `${arrHours}:${arrMins} IST`;

      // Threat assessment
      let sectorThreat = 'LOW';
      let threatClass = 'status-normal';
      let countdownClass = 'countdown-safe';

      if (currentStep >= 4 && (sec.riskZone === 'WEST' || sec.riskZone === 'NORTH-WEST' || sec.riskZone === 'CENTRAL')) {
        sectorThreat = 'SEVERE';
        threatClass = 'status-impact';
        countdownClass = 'countdown-imminent';
      } else if (currentStep >= 2 && (sec.riskZone === 'WEST' || sec.riskZone === 'NORTH-WEST')) {
        sectorThreat = 'HIGH';
        threatClass = 'status-impact';
        countdownClass = 'countdown-imminent';
      } else if (currentStep >= 2) {
        sectorThreat = 'MODERATE';
        threatClass = 'status-normal';
        countdownClass = 'countdown-moderate';
      }

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>${sec.name}</strong> <span style="font-size: 0.7rem; color: var(--text-muted);">(${sec.riskZone})</span></td>
        <td>${(sec.pop / 1000000).toFixed(2)}M</td>
        <td>${dist} km</td>
        <td>${currentStep >= 1 ? arrTimeStr : 'Nominal'}</td>
        <td><span class="sector-chip ${threatClass}">${sectorThreat}</span></td>
        <td><span class="countdown-badge ${countdownClass} countdown-active" data-offset="${idx * 3}">T-${String(etaMin).padStart(2, '0')}:00</span></td>
      `;
      DOM.impactTableBody.appendChild(tr);
    });
  }

  // =========================================================================
  // 9. BILINGUAL CITIZEN ALERT BULLETIN (PHASE 10 & 16)
  // =========================================================================

  function updateAlertCenter(data, riskLevel, scenario) {
    const alert = data.alert || {};

    if (DOM.alertEnBadge) {
      DOM.alertEnBadge.className = `alert-status-badge badge-${riskLevel.toLowerCase()}`;
      DOM.alertEnBadge.textContent = riskLevel;
    }
    if (DOM.alertTeBadge) {
      DOM.alertTeBadge.className = `alert-status-badge badge-${riskLevel.toLowerCase()}`;
      DOM.alertTeBadge.textContent = riskLevel === 'SEVERE' ? 'తీవ్రమైన అత్యవసర హెచ్చరిక' : (riskLevel === 'WARNING' ? 'హెచ్చరిక' : 'సాధారణం');
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

    if (DOM.alertEnTimestamp) {
      const ts = new Date().toISOString().slice(11, 19);
      DOM.alertEnTimestamp.textContent = `SYSTEM BROADCAST UTC: ${ts}`;
    }
  }

  // =========================================================================
  // 10. CENTERPIECE TACTICAL GIS RADAR CANVAS ENGINE (60 FPS)
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
    REGIONAL_SECTORS.forEach((sec) => {
      const pos = latLonToCanvas(sec.lat, sec.lon, width, height);

      // Sector marker dot
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 5, 0, Math.PI * 2);
      ctx.fillStyle = '#3b82f6';
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Sector label
      ctx.fillStyle = '#cbd5e1';
      ctx.font = '10px "Inter", sans-serif';
      ctx.fillText(sec.name, pos.x + 8, pos.y - 2);

      ctx.fillStyle = 'rgba(156, 163, 175, 0.8)';
      ctx.font = '8px "JetBrains Mono", monospace';
      ctx.fillText(`${(sec.pop / 1000000).toFixed(2)}M`, pos.x + 8, pos.y + 9);
    });

    // 4. Render Active Storm Cell, Trajectory & Impact Cone (if tracking active)
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

      // Outer shockwave ring
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

    // Loop animation
    requestAnimationFrame(drawTacticalRadarMap);
  }

  // =========================================================================
  // 11. SCENARIO CONTROLS & TIMELINE
  // =========================================================================

  function changeStep(delta) {
    let next = currentStep + delta;
    if (next < 0) next = 0;
    if (next > 6) next = 6;
    currentStep = next;
    arrivalCountdownSeconds = Math.max(300, (6 - currentStep) * 360);
    fetchScenarioStep(currentStep);
  }

  function setStep(stepIndex) {
    if (stepIndex >= 0 && stepIndex <= 6) {
      currentStep = stepIndex;
      arrivalCountdownSeconds = Math.max(300, (6 - currentStep) * 360);
      fetchScenarioStep(currentStep);
    }
  }

  function toggleSimulation() {
    if (isSimulating) {
      clearInterval(simulationTimer);
      simulationTimer = null;
      isSimulating = false;
      if (DOM.quickBtnPlay) DOM.quickBtnPlay.textContent = '▶ RUN SIMULATION';
    } else {
      isSimulating = true;
      if (DOM.quickBtnPlay) DOM.quickBtnPlay.textContent = '⏸ PAUSE SIMULATION';

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
  // 12. DATABASE TELEMETRY LOADER (PHASE 14 & 17)
  // =========================================================================

  async function loadDatabaseTelemetry() {
    if (!DOM.telemetryTableBody) return;
    try {
      const res = await fetch('/api/v1/database/history?limit=15');
      if (!res.ok) return;
      const data = await res.json();
      const rows = data.history || [];

      if (DOM.auditTotalCount) {
        DOM.auditTotalCount.textContent = `${data.count || rows.length} RUNS`;
      }

      DOM.telemetryTableBody.innerHTML = '';
      if (rows.length === 0) {
        DOM.telemetryTableBody.innerHTML = '<tr><td colspan="9" class="table-loading">No nowcasts recorded yet.</td></tr>';
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
          <td><span class="sector-chip ${isAlert ? 'status-impact' : 'status-normal'}">${isAlert ? 'DISPATCHED' : 'CLEAR'}</span></td>
        `;
        DOM.telemetryTableBody.appendChild(tr);
      });
    } catch (e) {
      console.warn('Database history query paused:', e);
    }
  }

  // =========================================================================
  // 13. EVENT LISTENERS
  // =========================================================================

  function bindEventListeners() {
    // Quick Controls Toolbar
    if (DOM.quickBtnPrev) DOM.quickBtnPrev.addEventListener('click', () => changeStep(-1));
    if (DOM.quickBtnNext) DOM.quickBtnNext.addEventListener('click', () => changeStep(1));
    if (DOM.quickBtnPlay) DOM.quickBtnPlay.addEventListener('click', toggleSimulation);
    if (DOM.quickBtnReset) DOM.quickBtnReset.addEventListener('click', resetSimulation);

    // Emergency Alert Broadcast
    if (DOM.btnBroadcastAlert) {
      DOM.btnBroadcastAlert.addEventListener('click', async () => {
        if (!DOM.dispatchFeedback) return;
        DOM.dispatchFeedback.textContent = 'Broadcasting emergency sirens and cell push to GHMC zones...';
        DOM.dispatchFeedback.className = 'dispatch-feedback text-amber';

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
            DOM.dispatchFeedback.className = 'dispatch-feedback text-emerald';
            setTimeout(() => {
              if (DOM.dispatchFeedback) DOM.dispatchFeedback.textContent = '';
            }, 4000);
          } else {
            DOM.dispatchFeedback.textContent = 'Dispatch returned HTTP error status.';
            DOM.dispatchFeedback.className = 'dispatch-feedback text-crimson';
          }
        } catch (e) {
          DOM.dispatchFeedback.textContent = 'Dispatch failed: ' + e.message;
          DOM.dispatchFeedback.className = 'dispatch-feedback text-crimson';
        }
      });
    }

    // Database Telemetry Refresh
    if (DOM.btnRefreshHistory) {
      DOM.btnRefreshHistory.addEventListener('click', loadDatabaseTelemetry);
    }
  }

  // =========================================================================
  // 14. SYSTEM INITIALIZATION
  // =========================================================================

  function init() {
    initViewRouter();
    bindEventListeners();

    // Start Operations Clocks
    updateOperationsClocks();
    setInterval(updateOperationsClocks, 1000);

    // Initial Data Fetch (Step 0)
    fetchScenarioStep(0);

    // Start 60-FPS Tactical Radar Canvas
    drawTacticalRadarMap();
  }

  // Self-start on DOMContentLoaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
