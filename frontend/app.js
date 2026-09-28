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

    // Cascading Early Warning Engine Elements
    btnStartCascade: document.getElementById('btn-start-cascade'),
    btnStartSimulationHero: document.getElementById('btn-start-simulation-hero'),
    btnEmergencyBypass: document.getElementById('btn-emergency-bypass'),
    btnSidebarEmergency: document.getElementById('btn-sidebar-emergency'),
    emergencyBypassNotice: document.getElementById('emergency-bypass-notice'),
    cascadeLog: document.getElementById('cascade-log'),
    heroStatusPill: document.getElementById('hero-status-pill'),
    heroStatusText: document.getElementById('hero-status-text'),

    // Storytelling Cascade Stages (1 to 5)
    storyStages: [
      document.getElementById('story-stage-1'),
      document.getElementById('story-stage-2'),
      document.getElementById('story-stage-3'),
      document.getElementById('story-stage-4'),
      document.getElementById('story-stage-5'),
    ],
    badgeStatuses: [
      document.getElementById('badge-status-1'),
      document.getElementById('badge-status-2'),
      document.getElementById('badge-status-3'),
      document.getElementById('badge-status-4'),
      document.getElementById('badge-status-5'),
    ],
    narrativeTexts: [
      document.getElementById('narrative-text-1'),
      document.getElementById('narrative-text-2'),
      document.getElementById('narrative-text-3'),
      document.getElementById('narrative-text-4'),
      document.getElementById('narrative-text-5'),
    ],
    alertChips: [
      document.getElementById('alert-chip-1'),
      document.getElementById('alert-chip-2'),
      document.getElementById('alert-chip-3'),
      document.getElementById('alert-chip-4'),
      document.getElementById('alert-chip-5'),
    ],
    compBadges: [
      document.getElementById('comp-badge-1'),
      document.getElementById('comp-badge-2'),
      document.getElementById('comp-badge-3'),
      document.getElementById('comp-badge-4'),
      document.getElementById('comp-badge-5'),
    ],
    triggerBadges: [
      document.getElementById('trigger-next-1'),
      document.getElementById('trigger-next-2'),
      document.getElementById('trigger-next-3'),
      document.getElementById('trigger-next-4'),
    ],

    // Story Tickers
    tickerCape: document.getElementById('ticker-cape'),
    tickerHumidity: document.getElementById('ticker-humidity'),
    tickerTemp: document.getElementById('ticker-temp'),
    tickerShear: document.getElementById('ticker-shear'),
    tickerLifted: document.getElementById('ticker-lifted'),

    tickerCtt: document.getElementById('ticker-ctt'),
    tickerCooling: document.getElementById('ticker-cooling'),
    tickerExpansion: document.getElementById('ticker-expansion'),
    tickerConvective: document.getElementById('ticker-convective'),

    tickerRefl: document.getElementById('ticker-refl'),
    tickerEcho: document.getElementById('ticker-echo'),
    tickerCell: document.getElementById('ticker-cell'),
    tickerIntensity: document.getElementById('ticker-intensity'),

    tickerCharge: document.getElementById('ticker-charge'),
    tickerGraupel: document.getElementById('ticker-graupel'),
    tickerIce: document.getElementById('ticker-ice'),
    tickerProb: document.getElementById('ticker-prob'),

    trackCurrLoc: document.getElementById('track-curr-loc'),
    trackDirection: document.getElementById('track-direction'),
    trackSpeed: document.getElementById('track-speed'),
    nodePatancheruTime: document.getElementById('node-patancheru-time'),
    nodeMiyapurTime: document.getElementById('node-miyapur-time'),
    nodeKukatpallyTime: document.getElementById('node-kukatpally-time'),
    nodeSecunderabadTime: document.getElementById('node-secunderabad-time'),

    // Final Warning Master Panel
    finalWarningPanel: document.getElementById('final-warning-panel'),
    finalWarningTime: document.getElementById('final-warning-time'),
    fwProb: document.getElementById('fw-prob'),
    fwImpact: document.getElementById('fw-impact'),
    fwAreas: document.getElementById('fw-areas'),
    fwStatus: document.getElementById('fw-status'),
    btnWarningPortalJump: document.getElementById('btn-warning-portal-jump'),

    // Tactical GIS Radar Map Frame
    gisRadarIframe: document.getElementById('gis-radar-iframe'),

    // Emergency Bypass Elements
    btnTriggerBypassAction: document.getElementById('btn-trigger-bypass-action'),

    // Citizen Portal Elements
    citizenNormalState: document.getElementById('citizen-normal-state'),
    citizenWarningActiveState: document.getElementById('citizen-warning-active-state'),
    cWarnProb: document.getElementById('c-warn-prob'),
    cWarnEta: document.getElementById('c-warn-eta'),
    cWarnAreas: document.getElementById('c-warn-areas'),
    citizenWarningPopup: document.getElementById('citizen-warning-popup'),
    btnAckCitizenPopup: document.getElementById('btn-ack-citizen-popup'),

    // Cascading Cards
    cardNwp: document.getElementById('card-nwp'),
    cardSat: document.getElementById('card-sat'),
    cardRadar: document.getElementById('card-radar'),
    cardLightning: document.getElementById('card-lightning'),
    cardTracking: document.getElementById('card-tracking'),
    cardWarning: document.getElementById('card-warning'),

    statusNwp: document.getElementById('status-nwp'),
    statusSat: document.getElementById('status-sat'),
    statusRadar: document.getElementById('status-radar'),
    statusLightning: document.getElementById('status-lightning'),
    statusTracking: document.getElementById('status-tracking'),
    statusWarning: document.getElementById('status-warning'),

    decisionNwp: document.getElementById('decision-nwp'),
    decisionSat: document.getElementById('decision-sat'),
    decisionRadar: document.getElementById('decision-radar'),
    decisionLightning: document.getElementById('decision-lightning'),
    decisionTracking: document.getElementById('decision-tracking'),
    decisionWarning: document.getElementById('decision-warning'),

    actionNwp: document.getElementById('action-nwp'),
    actionSat: document.getElementById('action-sat'),
    actionRadar: document.getElementById('action-radar'),
    actionLightning: document.getElementById('action-lightning'),
    actionTracking: document.getElementById('action-tracking'),
    actionWarning: document.getElementById('action-warning'),

    telemNwp: document.getElementById('telem-nwp'),
    telemSat: document.getElementById('telem-sat'),
    telemRadar: document.getElementById('telem-radar'),
    telemLightning: document.getElementById('telem-lightning'),
    telemTracking: document.getElementById('telem-tracking'),
    telemWarning: document.getElementById('telem-warning'),

    // Voice Control
    btnToggleVoice: document.getElementById('btn-toggle-voice'),
    voiceIcon: document.getElementById('voice-icon'),
    voiceText: document.getElementById('voice-text'),

    // Severe Lightning Modal (Command Center)
    severeLightningModal: document.getElementById('severe-lightning-alert-modal'),
    btnCloseLightningModal: document.getElementById('btn-close-lightning-modal'),
    btnAckLightning: document.getElementById('btn-ack-lightning'),
    btnGotoCitizen: document.getElementById('btn-goto-citizen'),
    lightningModalProb: document.getElementById('lightning-modal-prob'),
    lightningModalRate: document.getElementById('lightning-modal-rate'),
    lightningModalThreat: document.getElementById('lightning-modal-threat'),

    // Citizen Portal (View 5)
    citizenExtremePopup: document.getElementById('citizen-extreme-popup'),
    btnLangEn: document.getElementById('btn-lang-en'),
    btnLangTe: document.getElementById('btn-lang-te'),
    advisoryEn: document.getElementById('advisory-en'),
    advisoryTe: document.getElementById('advisory-te'),
    citizenThreatCard: document.getElementById('citizen-threat-card'),
    citizenHeadline: document.getElementById('citizen-headline'),
    citizenSeverityBadge: document.getElementById('citizen-severity-badge'),
    citizenCountdownTimer: document.getElementById('citizen-countdown-timer'),

    // Card Timestamps & Calculated Model Parameter Data Displays
    timeNwp: document.getElementById('time-nwp'),
    timeSat: document.getElementById('time-sat'),
    timeRadar: document.getElementById('time-radar'),
    timeLightning: document.getElementById('time-lightning'),
    timeTracking: document.getElementById('time-tracking'),
    timeWarning: document.getElementById('time-warning'),

    valNwp: document.getElementById('val-nwp'),
    valSat: document.getElementById('val-sat'),
    valRadar: document.getElementById('val-radar'),
    valLightning: document.getElementById('val-lightning'),
    valTracking: document.getElementById('val-tracking'),
    valWarning: document.getElementById('val-warning'),

    // Timeline Steps
    timelineSteps: document.querySelectorAll('.t-step'),

    // Impact Timetable (View 5)
    impactTableBody: document.getElementById('impact-table-body'),
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
        const dsId = btn.getAttribute('data-dataset') || ('dataset-' + (parseInt(btn.getAttribute('data-event') || '0', 10) + 1));
        // Switch to Command Center if not currently there so user sees the live model values
        switchView('view-command');
        loadDatasetAndSimulate(dsId);
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
  // =========================================================================
  // 13. AUDIO SYNTHESIS & VOICE ANNOUNCEMENT ENGINE
  // =========================================================================

  let voiceEnabled = true;

  function speakAnnouncement(text) {
    if (!voiceEnabled) return;
    if (!('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.05;
      utterance.pitch = 1.0;
      utterance.lang = 'en-US';
      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.warn('Speech synthesis unavailable:', e);
    }
  }

  function playPopSound() {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const actx = new AudioCtx();
      const osc = actx.createOscillator();
      const gain = actx.createGain();

      osc.type = 'sine';
      const now = actx.currentTime;
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.exponentialRampToValueAtTime(180, now + 0.08);

      gain.gain.setValueAtTime(0.35, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

      osc.connect(gain);
      gain.connect(actx.destination);

      osc.start(now);
      osc.stop(now + 0.09);
    } catch (e) {
      console.warn('Web Audio error:', e);
    }
  }

  function playFivePopSound() {
    for (let i = 0; i < 5; i++) {
      setTimeout(() => {
        playPopSound();
      }, i * 220);
    }
  }

  // =========================================================================
  // 14. SAMPLE DATASETS DEFINITION (HYDERABAD METROPOLITAN AREA)
  // =========================================================================

  const DATASETS = Object.freeze({
    'dataset-1': {
      id: 'dataset-1',
      name: 'Begumpet Severe Cell',
      category: 'SEVERE CONVECTIVE STORM',
      isExtreme: false,
      hasSevereLightning: true,
      lightningData: {
        prob: '84%',
        rate: '46 strikes/min',
        threat: 'HIGH HAZARD'
      },
      stages: [
        {
          time: '14:00 IST',
          voice: 'Alert detected at 14:00 hours. High atmospheric instability observed. Triggering Satellite Evolution Analysis.',
          decision: '✔ Atmospheric instability confirmed. CAPE > 2400 J/kg.',
          action: 'Triggering Satellite Analysis →',
          telem: 'Reading AWS network... CAPE: 2,450 J/kg · RH: 82% · Shear: 25.7 m/s',
          val: 'CAPE: 2,450 J/kg · CIN: -32 J/kg · KI: 36.4°C · Prob: 78%',
          log: '<span class="log-time">[14:00:00 IST]</span> Reading atmospheric sounding... CAPE 2,450 J/kg breaches initiation threshold. Triggering Satellite Analysis.'
        },
        {
          time: '14:15 IST',
          voice: 'Alert detected at 14:15 hours. Rapid cloud top cooling observed. Triggering Doppler Radar Tracking.',
          decision: '✔ Rapid cloud top glaciation detected (-10.5°C/hr).',
          action: 'Triggering Radar Analysis →',
          telem: 'INSAT-3DR Infrared: Rapid cooling observed (-10.5°C/hr)',
          val: 'Cloud Top Temp: -48.2°C · Cooling Rate: -10.5°C/hr · Glaciation: 82%',
          log: '<span class="log-time">[14:15:00 IST]</span> INSAT-3DR Infrared: Rapid cooling observed (-10.5°C/hr). Cumulus congestus breaching tropopause.'
        },
        {
          time: '14:25 IST',
          voice: 'Alert detected at 14:25 hours. High radar reflectivity detected. Triggering XGBoost Lightning Prediction.',
          decision: '✔ Deep core reflectivity verified (54 dBZ).',
          action: 'Triggering Lightning Prediction →',
          telem: 'DWR-HYD Begumpet: Reflectivity 54 dBZ · Strong convective structure',
          val: 'Max Reflectivity: 54 dBZ · Echo Top: 14.8 km · VIL: 48 kg/m²',
          log: '<span class="log-time">[14:25:00 IST]</span> DWR Begumpet: Reflectivity 54 dBZ · Echo top 14.8 km. Triggering XGBoost Electrification Model.'
        },
        {
          time: '14:30 IST',
          voice: 'Severe lightning alert detected at 14:30 hours. High strike probability. Triggering Storm Vector Tracking.',
          decision: '✔ XGBoost strike probability: 84% (Severe).',
          action: 'Triggering Movement Prediction →',
          telem: 'XGBoost Electrification: Dipole charge confirmed (Probability: 84%)',
          val: 'XGBoost Prob: 84% · Est. Rate: 46 strikes/min · Polarity: 88% -CG',
          log: '<span class="log-time" style="color:var(--crimson)">[14:30:00 IST]</span> ⚡ <strong>CRITICAL ALERT:</strong> Severe lightning detected. Strike probability 84% (46 strikes/min).'
        },
        {
          time: '14:32 IST',
          voice: 'Storm movement vector locked at 14:32 hours. Triggering Warning Dissemination Engine.',
          decision: '✔ Storm moving northeast at 42 km/h toward Secunderabad.',
          action: 'Impact: Begumpet (14m), Secunderabad (22m), Malkajgiri (30m) →',
          telem: 'Vector Extrapolation: ENE (68°) · Speed: 42 km/h',
          val: 'Vector: ENE (68°) · Velocity: 42 km/h · Target: Secunderabad, Begumpet',
          log: '<span class="log-time">[14:32:00 IST]</span> Vector Extrapolation: Trajectory locked toward Secunderabad. Velocity 42 km/h.'
        },
        {
          time: '14:33 IST',
          voice: 'Final warning generated at 14:33 hours. Severe risk warning dispatched.',
          decision: '🚨 84% Lightning Risk · Arrival: 14-25 Min.',
          action: 'Warning Issued: YES (Sirens & SMS Active)',
          telem: 'Dissemination Active: Secunderabad, Begumpet, Malkajgiri',
          val: 'Threat Level: SEVERE · Lead Time: 22 Mins · Broadcast: Sirens + Push Active',
          log: '<span class="log-time" style="color:var(--crimson)">[14:33:00 IST]</span> 🚨 <strong>WARNING GENERATED:</strong> Severe Thunderstorm Warning active across Begumpet and Secunderabad.'
        }
      ]
    },
    'dataset-2': {
      id: 'dataset-2',
      name: 'HITEC Supercell (Extreme)',
      category: 'EXTREME SUPERCELL OUTBREAK',
      isExtreme: true,
      hasSevereLightning: true,
      lightningData: {
        prob: '98%',
        rate: '92 strikes/min',
        threat: 'EXTREME HAZARD'
      },
      stages: [
        {
          time: '15:00 IST',
          voice: 'Alert detected at 15:00 hours. Extreme atmospheric destabilization. Triggering Satellite Evolution Analysis.',
          decision: '✔ Extreme instability detected. CAPE > 3800 J/kg.',
          action: 'Triggering Satellite Analysis →',
          telem: 'Reading AWS network... CAPE: 3,850 J/kg · CIN: -12 J/kg · KI: 42.1°C',
          val: 'CAPE: 3,850 J/kg · CIN: -12 J/kg · KI: 42.1°C · Prob: 95%',
          log: '<span class="log-time">[15:00:00 IST]</span> Severe boundary layer heating breaches cap. Supercell conditions identified over Western Corridor.'
        },
        {
          time: '15:15 IST',
          voice: 'Alert detected at 15:15 hours. Violent cloud top glaciation detected. Triggering Doppler Radar Tracking.',
          decision: '✔ Violent cloud top glaciation (-18.2°C/hr). Overshooting top.',
          action: 'Triggering Radar Analysis →',
          telem: 'INSAT-3DR Infrared: Cloud top cooling -18.2°C/hr · CTT -64.8°C',
          val: 'Cloud Top Temp: -64.8°C · Cooling Rate: -18.2°C/hr · Glaciation: 96%',
          log: '<span class="log-time">[15:15:00 IST]</span> INSAT-3DR: Overshooting convective top identified over Patancheru. Tropopause breach detected.'
        },
        {
          time: '15:25 IST',
          voice: 'Alert detected at 15:25 hours. Hail core and extreme reflectivity observed. Triggering XGBoost Lightning Prediction.',
          decision: '✔ Mesocyclonic reflectivity core verified (65 dBZ). Hail signature.',
          action: 'Triggering Lightning Prediction →',
          telem: 'DWR Begumpet: Reflectivity 65 dBZ · Echo top 17.5 km · Hail core',
          val: 'Max Reflectivity: 65 dBZ · Echo Top: 17.5 km · VIL: 68 kg/m² · Hail Core',
          log: '<span class="log-time">[15:25:00 IST]</span> DWR Begumpet: Extreme reflectivity core 65 dBZ with bounded weak echo region.'
        },
        {
          time: '15:30 IST',
          voice: 'Severe lightning alert detected at 15:30 hours. Extreme lightning strike surge imminent. Triggering Storm Vector Tracking.',
          decision: '✔ XGBoost strike probability: 98% (Extreme Supercell Surge).',
          action: 'Triggering Movement Prediction →',
          telem: 'XGBoost Electrification: Severe dipole surge (Probability: 98% · 92 strikes/min)',
          val: 'XGBoost Prob: 98% · Est. Rate: 92 strikes/min · Violent Ground Strikes',
          log: '<span class="log-time" style="color:var(--crimson)">[15:30:00 IST]</span> ⚡ <strong>CRITICAL ALERT:</strong> Extreme lightning surge detected. Strike probability 98% (92 strikes/min).'
        },
        {
          time: '15:32 IST',
          voice: 'Storm movement vector locked at 15:32 hours. Supercell tracking east toward HITEC City. Triggering Warning Dissemination Engine.',
          decision: '✔ Supercell tracking east at 56 km/h directly into Cyberabad.',
          action: 'Impact: Gachibowli (8m), HITEC City (12m), Madhapur (16m) →',
          telem: 'Vector Extrapolation: E (82°) · Speed: 56 km/h',
          val: 'Vector: E (82°) · Velocity: 56 km/h · Target: Serilingampally, HITEC City, Gachibowli',
          log: '<span class="log-time">[15:32:00 IST]</span> Vector Extrapolation: Cell tracking east at 56 km/h. Direct impact trajectory on high-density IT corridor.'
        },
        {
          time: '15:33 IST',
          voice: 'Emergency warning generated at 15:33 hours. Extreme risk threat. Sounding civilian defense sirens.',
          decision: '🚨 98% Extreme Risk · Supercell Microburst & Lightning Imminent',
          action: 'Warning Issued: YES (EMERGENCY BROADCAST + SIRENS)',
          telem: 'Dissemination Active: HITEC City, Gachibowli, Kondapur, Serilingampally',
          val: 'Threat Level: EXTREME · Lead Time: 12 Mins · 🚨 EXTREME EMERGENCY POPUP ACTIVE',
          log: '<span class="log-time" style="color:var(--crimson)">[15:33:00 IST]</span> 🚨 <strong>EXTREME RISK GENERATED:</strong> Supercell Outbreak imminent. Municipal sirens and mobile popups active.'
        }
      ]
    },
    'dataset-3': {
      id: 'dataset-3',
      name: 'Shamshabad Squall Line',
      category: 'CONVECTIVE GUST FRONT',
      isExtreme: false,
      hasSevereLightning: true,
      lightningData: {
        prob: '89%',
        rate: '58 strikes/min',
        threat: 'HIGH HAZARD'
      },
      stages: [
        {
          time: '16:00 IST',
          voice: 'Alert detected at 16:00 hours. Squall line pre-convective conditions. Triggering Satellite Evolution Analysis.',
          decision: '✔ Convective available potential energy 2,820 J/kg.',
          action: 'Triggering Satellite Analysis →',
          telem: 'Reading AWS network... CAPE: 2,820 J/kg · CIN: -25 J/kg · KI: 38.6°C',
          val: 'CAPE: 2,820 J/kg · CIN: -25 J/kg · KI: 38.6°C · Prob: 82%',
          log: '<span class="log-time">[16:00:00 IST]</span> Pre-frontal squall line thermodynamics confirm high initiation probability.'
        },
        {
          time: '16:15 IST',
          voice: 'Alert detected at 16:15 hours. Rapid linear cloud band growth. Triggering Doppler Radar Tracking.',
          decision: '✔ Rapid linear cloud cooling (-12.1°C/hr). Squall arc forming.',
          action: 'Triggering Radar Analysis →',
          telem: 'INSAT-3DR Infrared: Cloud top cooling -12.1°C/hr · Linear band',
          val: 'Cloud Top Temp: -52.4°C · Cooling Rate: -12.1°C/hr · Glaciation: 86%',
          log: '<span class="log-time">[16:15:00 IST]</span> INSAT-3DR: Organized convective squall line expanding 32 km in length.'
        },
        {
          time: '16:25 IST',
          voice: 'Alert detected at 16:25 hours. Intense bow echo and gust front detected. Triggering XGBoost Lightning Prediction.',
          decision: '✔ Bow echo signature (58 dBZ) with 74 km/h gust front.',
          action: 'Triggering Lightning Prediction →',
          telem: 'DWR Begumpet: Reflectivity 58 dBZ · Gust front 74 km/h',
          val: 'Max Reflectivity: 58 dBZ · Gust Front: 74 km/h · Squall Arc: 32 km',
          log: '<span class="log-time">[16:25:00 IST]</span> DWR Begumpet: Bow echo with severe radial wind shear along leading edge.'
        },
        {
          time: '16:30 IST',
          voice: 'Severe lightning alert detected at 16:30 hours. High strike rate along gust front. Triggering Storm Vector Tracking.',
          decision: '✔ XGBoost strike probability: 89% along gust line.',
          action: 'Triggering Movement Prediction →',
          telem: 'XGBoost Electrification: Linear charge separation (Probability: 89%)',
          val: 'XGBoost Prob: 89% · Est. Rate: 58 strikes/min · High CG Density',
          log: '<span class="log-time" style="color:var(--crimson)">[16:30:00 IST]</span> ⚡ <strong>CRITICAL ALERT:</strong> Severe lightning detected along Shamshabad squall line.'
        },
        {
          time: '16:32 IST',
          voice: 'Storm movement vector locked at 16:32 hours. Squall advancing northeast at 48 km/h. Triggering Warning Dissemination Engine.',
          decision: '✔ Squall line advancing northeast at 48 km/h toward Airport.',
          action: 'Impact: Shamshabad Airport (10m), Rajendranagar (18m), Charminar (26m) →',
          telem: 'Vector Extrapolation: NE (45°) · Speed: 48 km/h',
          val: 'Vector: NE (45°) · Velocity: 48 km/h · Target: Airport, Rajendranagar, Charminar',
          log: '<span class="log-time">[16:32:00 IST]</span> Vector Extrapolation: Trajectory directly crossing Rajiv Gandhi International Airport runway corridor.'
        },
        {
          time: '16:33 IST',
          voice: 'Final warning generated at 16:33 hours. Severe squall warning dispatched to Aviation & GHMC.',
          decision: '🚨 89% Lightning & Wind Hazard · Arrival: 10-18 Min',
          action: 'Warning Issued: YES (Airport Ground Stop + City Sirens)',
          telem: 'Dissemination Active: Shamshabad, Rajendranagar, Falaknuma, Charminar',
          val: 'Threat Level: SEVERE · Lead Time: 18 Mins · Broadcast: Airport Stop + Sirens',
          log: '<span class="log-time" style="color:var(--crimson)">[16:33:00 IST]</span> 🚨 <strong>WARNING GENERATED:</strong> Severe Squall and Lightning Warning dispatched to RGIA and GHMC South.'
        }
      ]
    },
    'dataset-4': {
      id: 'dataset-4',
      name: 'Secunderabad Convective Cell',
      category: 'MODERATE CONVECTIVE CELL',
      isExtreme: false,
      hasSevereLightning: false,
      stages: [
        {
          time: '13:30 IST',
          voice: 'Alert detected at 13:30 hours. Moderate atmospheric instability. Triggering Satellite Evolution Analysis.',
          decision: '✔ Moderate instability detected. CAPE 1,840 J/kg.',
          action: 'Triggering Satellite Analysis →',
          telem: 'Reading AWS network... CAPE: 1,840 J/kg · CIN: -48 J/kg · KI: 32.8°C',
          val: 'CAPE: 1,840 J/kg · CIN: -48 J/kg · KI: 32.8°C · Prob: 64%',
          log: '<span class="log-time">[13:30:00 IST]</span> Moderate convective instability detected over Northern Cantonment.'
        },
        {
          time: '13:45 IST',
          voice: 'Alert detected at 13:45 hours. Moderate cloud growth observed. Triggering Doppler Radar Tracking.',
          decision: '✔ Moderate cloud cooling (-7.2°C/hr). Isolated cell growth.',
          action: 'Triggering Radar Analysis →',
          telem: 'INSAT-3DR Infrared: Cloud top cooling -7.2°C/hr · Isolated cell',
          val: 'Cloud Top Temp: -38.6°C · Cooling Rate: -7.2°C/hr · Glaciation: 68%',
          log: '<span class="log-time">[13:45:00 IST]</span> INSAT-3DR: Moderate vertical development observed over Bowenpally.'
        },
        {
          time: '13:55 IST',
          voice: 'Alert detected at 13:55 hours. Moderate radar reflectivity observed. Triggering XGBoost Lightning Prediction.',
          decision: '✔ Moderate reflectivity core (46 dBZ).',
          action: 'Triggering Lightning Prediction →',
          telem: 'DWR Begumpet: Reflectivity 46 dBZ · Echo top 11.2 km',
          val: 'Max Reflectivity: 46 dBZ · Echo Top: 11.2 km · Moderate Updraft',
          log: '<span class="log-time">[13:55:00 IST]</span> DWR Begumpet: Isolated cell with 46 dBZ core reflectivity.'
        },
        {
          time: '14:00 IST',
          voice: 'Evaluating electrification at 14:00 hours. Moderate strike potential. Triggering Storm Vector Tracking.',
          decision: '✔ XGBoost strike probability: 68% (Moderate).',
          action: 'Triggering Movement Prediction →',
          telem: 'XGBoost Electrification: Moderate charge separation (Probability: 68%)',
          val: 'XGBoost Prob: 68% · Est. Rate: 22 strikes/min · Intra-cloud dominant',
          log: '<span class="log-time">[14:00:00 IST]</span> XGBoost Model: Strike probability 68% (predominantly intra-cloud).'
        },
        {
          time: '14:02 IST',
          voice: 'Storm movement vector locked at 14:02 hours. Tracking north-northeast. Triggering Warning Dissemination Engine.',
          decision: '✔ Storm tracking north-northeast at 35 km/h.',
          action: 'Impact: Malkajgiri (16m), Alwal (24m), Medchal (35m) →',
          telem: 'Vector Extrapolation: NNE (30°) · Speed: 35 km/h',
          val: 'Vector: NNE (30°) · Velocity: 35 km/h · Target: Malkajgiri, Secunderabad',
          log: '<span class="log-time">[14:02:00 IST]</span> Vector Extrapolation: Cell tracking NNE at 35 km/h toward Medchal corridor.'
        },
        {
          time: '14:03 IST',
          voice: 'Advisory warning issued at 14:03 hours. Moderate thunderstorm advisory active.',
          decision: '🟡 68% Moderate Lightning Risk · Arrival: 16-25 Min',
          action: 'Warning Issued: ADVISORY (Mobile App & Web Push)',
          telem: 'Dissemination Active: Malkajgiri, Alwal, Secunderabad Station',
          val: 'Threat Level: MODERATE · Lead Time: 28 Mins · Broadcast: Advisory Warning',
          log: '<span class="log-time" style="color:var(--amber)">[14:03:00 IST]</span> 🟡 <strong>ADVISORY ISSUED:</strong> Moderate Thunderstorm Advisory for Secunderabad and Northern Zone.'
        }
      ]
    },
    'dataset-5': {
      id: 'dataset-5',
      name: 'Deccan Calm (Equilibrium)',
      category: 'EQUILIBRIUM / CLEAR SKY',
      isExtreme: false,
      hasSevereLightning: false,
      stages: [
        {
          time: '11:00 IST',
          voice: 'Background monitoring at 11:00 hours. Atmosphere is stable. Thermodynamic equilibrium maintained.',
          decision: 'Atmospheric stability strong. High CIN cap (-180 J/kg).',
          action: 'Evaluating soundings... Background monitoring.',
          telem: 'Reading AWS network... CAPE: 650 J/kg · CIN: -180 J/kg · KI: 18.2°C',
          val: 'CAPE: 650 J/kg · CIN: -180 J/kg · KI: 18.2°C · Prob: 8%',
          log: '<span class="log-time">[11:00:00 IST]</span> Thermodynamic sounding indicates stable atmosphere with capping inversion.'
        },
        {
          time: '11:15 IST',
          voice: 'Satellite review at 11:15 hours. Cloud tops normal. No convective growth.',
          decision: 'Cloud development normal. No vertical growth.',
          action: 'Awaiting convective threshold... (Standby)',
          telem: 'INSAT-3DR Infrared: Cloud top temperature -8.4°C · Cooling: +0.5°C/hr',
          val: 'Cloud Top Temp: -8.4°C · Cooling Rate: +0.5°C/hr · No Glaciation',
          log: '<span class="log-time">[11:15:00 IST]</span> INSAT-3DR: Clear to scattered fair-weather cumulus. No glaciation.'
        },
        {
          time: '11:25 IST',
          voice: 'Doppler radar review at 11:25 hours. Precipitation echoes clear.',
          decision: 'Precipitation echoes low (12 dBZ). No cells detected.',
          action: 'Awaiting radar cell formation... (Standby)',
          telem: 'DWR Begumpet: Reflectivity 12 dBZ (Ground clutter only)',
          val: 'Max Reflectivity: 12 dBZ · Boundary Layer Clutter Only',
          log: '<span class="log-time">[11:25:00 IST]</span> DWR Begumpet: Reflectivity below 15 dBZ initiation threshold.'
        },
        {
          time: '11:30 IST',
          voice: 'Electrification review at 11:30 hours. Zero lightning probability.',
          decision: 'Lightning strike probability 4%. No electrical charge.',
          action: 'Awaiting electrical charge... (Standby)',
          telem: 'XGBoost Electrification: Negligible charge separation (Probability: 4%)',
          val: 'XGBoost Prob: 4% · Zero Strike Potential · Background State',
          log: '<span class="log-time">[11:30:00 IST]</span> XGBoost Model: Atmospheric charge zero. Strike probability 4%.'
        },
        {
          time: '11:32 IST',
          voice: 'Tracking review at 11:32 hours. Stationary equilibrium conditions.',
          decision: 'Stationary background conditions. No storm track.',
          action: 'Monitoring urban vector... (Standby)',
          telem: 'Vector Extrapolation: Stationary / Dispersed',
          val: 'Vector: Stationary / Dissipated · Velocity: 0 km/h',
          log: '<span class="log-time">[11:32:00 IST]</span> Vector Extrapolation: No convective targets identified in Hyderabad region.'
        },
        {
          time: '11:33 IST',
          voice: 'Evaluation complete at 11:33 hours. Atmosphere remains calm. No warning required.',
          decision: '✔ No active hazard. Metropolitan region safe.',
          action: 'Warning Issued: NO (Routine Monitoring)',
          telem: 'Dissemination Active: Routine Meteorological Watch',
          val: 'Threat Level: EQUILIBRIUM · Lead Time: N/A · Status: Safe',
          log: '<span class="log-time" style="color:var(--emerald)">[11:33:00 IST]</span> ✔ <strong>EQUILIBRIUM CONFIRMED:</strong> Clear weather across Greater Hyderabad.'
        }
      ]
    }
  });

  let activeDatasetKey = 'dataset-1';
  let cascadeTimer = null;
  let isCascading = false;

  function syncMapStage(stageNum, isBypass = false) {
    if (DOM.gisRadarIframe && DOM.gisRadarIframe.contentWindow) {
      try {
        DOM.gisRadarIframe.contentWindow.postMessage({
          type: 'SET_STAGE',
          stage: stageNum,
          bypass: isBypass
        }, '*');
      } catch (e) {
        console.warn('Map postMessage error:', e);
      }
    }
  }

  function resetCascadeCards(datasetKey) {
    const dsKey = datasetKey || activeDatasetKey;
    const dataset = DATASETS[dsKey] || DATASETS['dataset-1'];

    // Legacy cards reset
    const cards = [DOM.cardNwp, DOM.cardSat, DOM.cardRadar, DOM.cardLightning, DOM.cardTracking, DOM.cardWarning];
    cards.forEach((c) => {
      if (c) c.classList.remove('card-active', 'card-complete', 'card-alert');
    });
    if (DOM.emergencyBypassNotice) DOM.emergencyBypassNotice.style.display = 'none';
    if (DOM.severeLightningModal) DOM.severeLightningModal.style.display = 'none';

    // Storytelling centerpiece cards reset
    if (DOM.storyStages) {
      DOM.storyStages.forEach((stageCard) => {
        if (stageCard) stageCard.className = 'story-stage-card stage-idle';
      });
    }

    if (DOM.badgeStatuses) {
      const defaultBadgeText = [
        '🟡 AWAITING TRIGGER',
        '🟠 AWAITING TRIGGER',
        '🔴 AWAITING TRIGGER',
        '⚡ AWAITING TRIGGER',
        '📍 AWAITING TRIGGER'
      ];
      DOM.badgeStatuses.forEach((badge, idx) => {
        if (badge) {
          badge.className = 'stage-status-badge status-idle';
          badge.textContent = defaultBadgeText[idx] || 'AWAITING TRIGGER';
        }
      });
    }

    if (DOM.alertChips) {
      DOM.alertChips.forEach((chip) => {
        if (chip) chip.style.display = 'none';
      });
    }

    if (DOM.compBadges) {
      DOM.compBadges.forEach((b) => {
        if (b) {
          b.className = 'step-completion-badge';
          b.textContent = 'PENDING TRIGGER';
        }
      });
    }

    if (DOM.triggerBadges) {
      DOM.triggerBadges.forEach((b) => {
        if (b) {
          b.className = 'step-trigger-badge';
          b.textContent = 'STANDBY';
        }
      });
    }

    // Default ticker values
    if (DOM.tickerCape) DOM.tickerCape.textContent = '500';
    if (DOM.tickerHumidity) DOM.tickerHumidity.textContent = '55%';
    if (DOM.tickerShear) DOM.tickerShear.textContent = '10';
    if (DOM.tickerCtt) DOM.tickerCtt.textContent = '-28°C';
    if (DOM.tickerCooling) DOM.tickerCooling.textContent = '2°C/hr';
    if (DOM.tickerRefl) DOM.tickerRefl.textContent = '20 dBZ';
    if (DOM.tickerEcho) DOM.tickerEcho.textContent = '5 km';
    if (DOM.tickerProb) DOM.tickerProb.textContent = '12%';

    if (DOM.finalWarningPanel) DOM.finalWarningPanel.style.display = 'none';

    // Citizen Portal state
    if (DOM.citizenNormalState) DOM.citizenNormalState.style.display = 'block';
    if (DOM.citizenWarningActiveState) DOM.citizenWarningActiveState.style.display = 'none';
    if (DOM.citizenWarningPopup) DOM.citizenWarningPopup.style.display = 'none';

    // Hero banner status
    if (DOM.heroStatusPill) DOM.heroStatusPill.classList.remove('active');
    if (DOM.heroStatusText) DOM.heroStatusText.textContent = 'STANDBY';

    // Sync GIS map to idle baseline
    syncMapStage(0);

    // Populate initial timestamps from dataset
    const stages = dataset.stages || [];
    if (DOM.timeNwp && stages[0]) DOM.timeNwp.textContent = stages[0].time;
    if (DOM.timeSat && stages[1]) DOM.timeSat.textContent = stages[1].time;
    if (DOM.timeRadar && stages[2]) DOM.timeRadar.textContent = stages[2].time;
    if (DOM.timeLightning && stages[3]) DOM.timeLightning.textContent = stages[3].time;
    if (DOM.timeTracking && stages[4]) DOM.timeTracking.textContent = stages[4].time;
    if (DOM.timeWarning && stages[5]) DOM.timeWarning.textContent = stages[5].time;

    // Populate initial calculated values from dataset
    if (DOM.valNwp && stages[0]) DOM.valNwp.querySelector('.v-val').textContent = stages[0].val;
    if (DOM.valSat && stages[1]) DOM.valSat.querySelector('.v-val').textContent = stages[1].val;
    if (DOM.valRadar && stages[2]) DOM.valRadar.querySelector('.v-val').textContent = stages[2].val;
    if (DOM.valLightning && stages[3]) DOM.valLightning.querySelector('.v-val').textContent = stages[3].val;
    if (DOM.valTracking && stages[4]) DOM.valTracking.querySelector('.v-val').textContent = stages[4].val;
    if (DOM.valWarning && stages[5]) DOM.valWarning.querySelector('.v-val').textContent = stages[5].val;

    if (DOM.statusNwp) { DOM.statusNwp.textContent = 'MONITORING'; DOM.statusNwp.className = 'card-status status-monitoring'; }
    if (DOM.statusSat) { DOM.statusSat.textContent = 'STANDBY'; DOM.statusSat.className = 'card-status status-standby'; }
    if (DOM.statusRadar) { DOM.statusRadar.textContent = 'STANDBY'; DOM.statusRadar.className = 'card-status status-standby'; }
    if (DOM.statusLightning) { DOM.statusLightning.textContent = 'STANDBY'; DOM.statusLightning.className = 'card-status status-standby'; }
    if (DOM.statusTracking) { DOM.statusTracking.textContent = 'STANDBY'; DOM.statusTracking.className = 'card-status status-standby'; }
    if (DOM.statusWarning) { DOM.statusWarning.textContent = 'STANDBY'; DOM.statusWarning.className = 'card-status status-standby'; }

    if (DOM.decisionNwp) DOM.decisionNwp.textContent = stages[0]?.decision || 'Evaluating atmospheric soundings.';
    if (DOM.decisionSat) DOM.decisionSat.textContent = 'Cloud development normal.';
    if (DOM.decisionRadar) DOM.decisionRadar.textContent = 'Precipitation echoes low.';
    if (DOM.decisionLightning) DOM.decisionLightning.textContent = 'Lightning probability 0%.';
    if (DOM.decisionTracking) DOM.decisionTracking.textContent = 'Stationary background conditions.';
    if (DOM.decisionWarning) DOM.decisionWarning.textContent = 'No active hazard. Standby.';

    if (DOM.actionNwp) DOM.actionNwp.textContent = 'Evaluating soundings...';
    if (DOM.actionSat) DOM.actionSat.textContent = 'Awaiting convective threshold...';
    if (DOM.actionRadar) DOM.actionRadar.textContent = 'Awaiting radar cell formation...';
    if (DOM.actionLightning) DOM.actionLightning.textContent = 'Awaiting electrical charge...';
    if (DOM.actionTracking) DOM.actionTracking.textContent = 'Monitoring urban vector...';
    if (DOM.actionWarning) DOM.actionWarning.textContent = 'Warning Issued: NO';

    DOM.timelineSteps.forEach((node) => node.classList.remove('active', 'completed'));
    if (DOM.timelineSteps[0]) DOM.timelineSteps[0].classList.add('active');
  }

  function startCascadingSimulation(datasetId) {
    if (datasetId && DATASETS[datasetId]) {
      activeDatasetKey = datasetId;
    }
    const dataset = DATASETS[activeDatasetKey] || DATASETS['dataset-1'];
    const stages = dataset.stages;

    if (cascadeTimer) {
      clearTimeout(cascadeTimer);
      cascadeTimer = null;
    }
    isCascading = true;
    resetCascadeCards(activeDatasetKey);

    if (DOM.btnStartSimulationHero) {
      DOM.btnStartSimulationHero.classList.add('running');
      DOM.btnStartSimulationHero.innerHTML = '<span class="btn-hero-icon">⏳</span> SIMULATION ACTIVE...';
      DOM.btnStartSimulationHero.disabled = true;
    }
    if (DOM.btnStartCascade) {
      DOM.btnStartCascade.innerHTML = '<span class="btn-icon">⏳</span> EVALUATING: ' + dataset.name.toUpperCase();
      DOM.btnStartCascade.disabled = true;
    }
    if (DOM.heroStatusPill) DOM.heroStatusPill.classList.add('active');
    if (DOM.heroStatusText) DOM.heroStatusText.textContent = 'CASCADING WORKFLOW RUNNING';

    // =========================================================================
    // STAGE 1: NUMERICAL WEATHER PREDICTION (NWP)
    // Question: Can a thunderstorm form?
    // =========================================================================
    if (DOM.storyStages && DOM.storyStages[0]) DOM.storyStages[0].className = 'story-stage-card stage-running';
    if (DOM.badgeStatuses && DOM.badgeStatuses[0]) {
      DOM.badgeStatuses[0].textContent = '🟡 NWP ANALYSIS RUNNING';
      DOM.badgeStatuses[0].className = 'stage-status-badge status-running';
    }
    if (DOM.narrativeTexts && DOM.narrativeTexts[0]) DOM.narrativeTexts[0].textContent = 'Atmospheric instability increasing.';

    // Legacy card sync
    if (DOM.cardNwp) DOM.cardNwp.classList.add('card-active');
    if (DOM.statusNwp) { DOM.statusNwp.textContent = 'ANALYZING...'; DOM.statusNwp.className = 'card-status status-active'; }
    if (DOM.cascadeLog) DOM.cascadeLog.innerHTML = stages[0].log;
    if (DOM.telemNwp) DOM.telemNwp.textContent = stages[0].telem;
    if (DOM.valNwp) DOM.valNwp.querySelector('.v-val').textContent = stages[0].val;
    if (DOM.timeNwp) DOM.timeNwp.textContent = stages[0].time;
    speakAnnouncement('NWP analysis running. Atmospheric instability increasing.');
    setStep(0);

    // Ticker changes: CAPE 500 -> 900 -> 1400 -> 1800; Humidity 55% -> 68% -> 79% -> 84%; Shear 10 -> 14 -> 19 -> 25
    setTimeout(() => {
      if (DOM.tickerCape) DOM.tickerCape.textContent = '900';
      if (DOM.tickerHumidity) DOM.tickerHumidity.textContent = '68%';
      if (DOM.tickerShear) DOM.tickerShear.textContent = '14';
    }, 400);

    setTimeout(() => {
      if (DOM.tickerCape) DOM.tickerCape.textContent = '1400';
      if (DOM.tickerHumidity) DOM.tickerHumidity.textContent = '79%';
      if (DOM.tickerShear) DOM.tickerShear.textContent = '19';
    }, 800);

    setTimeout(() => {
      if (DOM.tickerCape) DOM.tickerCape.textContent = '1800';
      if (DOM.tickerHumidity) DOM.tickerHumidity.textContent = '84%';
      if (DOM.tickerShear) DOM.tickerShear.textContent = '25';
      if (DOM.badgeStatuses && DOM.badgeStatuses[0]) {
        DOM.badgeStatuses[0].textContent = '✓ CONDITIONS FAVORABLE';
        DOM.badgeStatuses[0].className = 'stage-status-badge status-complete';
      }
      if (DOM.alertChips && DOM.alertChips[0]) DOM.alertChips[0].style.display = 'inline-flex';
      if (DOM.narrativeTexts && DOM.narrativeTexts[0]) DOM.narrativeTexts[0].textContent = 'NWP indicates thunderstorm ingredients are present.';
      if (DOM.compBadges && DOM.compBadges[0]) {
        DOM.compBadges[0].textContent = 'TASK COMPLETED';
        DOM.compBadges[0].className = 'step-completion-badge complete';
      }
      if (DOM.triggerBadges && DOM.triggerBadges[0]) DOM.triggerBadges[0].textContent = 'TRIGGERING SATELLITE ANALYSIS...';
      syncMapStage(1);
    }, 1300);

    // =========================================================================
    // STAGE 2: INSAT-3DR SATELLITE ANALYSIS (t = 2200ms)
    // Question: Is a storm cloud actually developing?
    // =========================================================================
    cascadeTimer = setTimeout(() => {
      if (DOM.storyStages && DOM.storyStages[0]) DOM.storyStages[0].className = 'story-stage-card stage-complete';
      if (DOM.storyStages && DOM.storyStages[1]) DOM.storyStages[1].className = 'story-stage-card stage-running';
      if (DOM.badgeStatuses && DOM.badgeStatuses[1]) {
        DOM.badgeStatuses[1].textContent = '🟠 SATELLITE ANALYSIS RUNNING';
        DOM.badgeStatuses[1].className = 'stage-status-badge status-running';
      }
      if (DOM.narrativeTexts && DOM.narrativeTexts[1]) DOM.narrativeTexts[1].textContent = 'Cloud tops rapidly cooling.';

      // Legacy card sync
      if (DOM.cardNwp) { DOM.cardNwp.classList.remove('card-active'); DOM.cardNwp.classList.add('card-complete'); }
      if (DOM.statusNwp) { DOM.statusNwp.textContent = 'TRIGGERED (OK)'; DOM.statusNwp.className = 'card-status status-complete'; }
      if (DOM.timelineSteps[0]) DOM.timelineSteps[0].classList.add('completed');
      if (DOM.timelineSteps[1]) DOM.timelineSteps[1].classList.add('active');

      if (DOM.cardSat) DOM.cardSat.classList.add('card-active');
      if (DOM.statusSat) { DOM.statusSat.textContent = 'ANALYZING...'; DOM.statusSat.className = 'card-status status-active'; }
      if (DOM.cascadeLog) DOM.cascadeLog.innerHTML = stages[1].log;
      if (DOM.telemSat) DOM.telemSat.textContent = stages[1].telem;
      if (DOM.valSat) DOM.valSat.querySelector('.v-val').textContent = stages[1].val;
      if (DOM.timeSat) DOM.timeSat.textContent = stages[1].time;
      speakAnnouncement('Satellite analysis running. Cloud tops rapidly cooling.');
      setStep(1);

      // Ticker changes: CTT -28°C -> -34°C -> -41°C -> -52°C; Cooling Rate 2°C/hr -> 5°C/hr -> 8°C/hr
      setTimeout(() => {
        if (DOM.tickerCtt) DOM.tickerCtt.textContent = '-34°C';
        if (DOM.tickerCooling) DOM.tickerCooling.textContent = '5°C/hr';
      }, 400);

      setTimeout(() => {
        if (DOM.tickerCtt) DOM.tickerCtt.textContent = '-41°C';
        if (DOM.tickerCooling) DOM.tickerCooling.textContent = '8°C/hr';
      }, 800);

      setTimeout(() => {
        if (DOM.tickerCtt) DOM.tickerCtt.textContent = '-52°C';
        if (DOM.tickerCooling) DOM.tickerCooling.textContent = '8°C/hr';
        if (DOM.badgeStatuses && DOM.badgeStatuses[1]) {
          DOM.badgeStatuses[1].textContent = '✓ RAPID CLOUD DEVELOPMENT DETECTED';
          DOM.badgeStatuses[1].className = 'stage-status-badge status-complete';
        }
        if (DOM.alertChips && DOM.alertChips[1]) DOM.alertChips[1].style.display = 'inline-flex';
        if (DOM.narrativeTexts && DOM.narrativeTexts[1]) DOM.narrativeTexts[1].textContent = 'Satellite confirms active cloud growth.';
        if (DOM.compBadges && DOM.compBadges[1]) {
          DOM.compBadges[1].textContent = 'TASK COMPLETED';
          DOM.compBadges[1].className = 'step-completion-badge complete';
        }
        if (DOM.triggerBadges && DOM.triggerBadges[1]) DOM.triggerBadges[1].textContent = 'TRIGGERING RADAR ANALYSIS...';
        syncMapStage(2);
      }, 1300);

      // =======================================================================
      // STAGE 3: DWR-HYD RADAR ANALYSIS (t = 4400ms)
      // Question: Is the cloud becoming a real thunderstorm?
      // =======================================================================
      cascadeTimer = setTimeout(() => {
        if (DOM.storyStages && DOM.storyStages[1]) DOM.storyStages[1].className = 'story-stage-card stage-complete';
        if (DOM.storyStages && DOM.storyStages[2]) DOM.storyStages[2].className = 'story-stage-card stage-running';
        if (DOM.badgeStatuses && DOM.badgeStatuses[2]) {
          DOM.badgeStatuses[2].textContent = '🔴 RADAR ANALYSIS RUNNING';
          DOM.badgeStatuses[2].className = 'stage-status-badge status-running';
        }
        if (DOM.narrativeTexts && DOM.narrativeTexts[2]) DOM.narrativeTexts[2].textContent = 'Strong convective structure detected.';

        // Legacy card sync
        if (DOM.cardSat) { DOM.cardSat.classList.remove('card-active'); DOM.cardSat.classList.add('card-complete'); }
        if (DOM.statusSat) { DOM.statusSat.textContent = 'TRIGGERED (OK)'; DOM.statusSat.className = 'card-status status-complete'; }
        if (DOM.timelineSteps[1]) DOM.timelineSteps[1].classList.add('completed');
        if (DOM.timelineSteps[2]) DOM.timelineSteps[2].classList.add('active');

        if (DOM.cardRadar) DOM.cardRadar.classList.add('card-active');
        if (DOM.statusRadar) { DOM.statusRadar.textContent = 'ANALYZING...'; DOM.statusRadar.className = 'card-status status-active'; }
        if (DOM.cascadeLog) DOM.cascadeLog.innerHTML = stages[2].log;
        if (DOM.telemRadar) DOM.telemRadar.textContent = stages[2].telem;
        if (DOM.valRadar) DOM.valRadar.querySelector('.v-val').textContent = stages[2].val;
        if (DOM.timeRadar) DOM.timeRadar.textContent = stages[2].time;
        speakAnnouncement('Radar analysis running. Strong convective structure detected.');
        setStep(2);

        // Ticker changes: Reflectivity 20 -> 35 -> 45 -> 58 dBZ; Echo Height 5 -> 8 -> 11 km
        setTimeout(() => {
          if (DOM.tickerRefl) DOM.tickerRefl.textContent = '35 dBZ';
          if (DOM.tickerEcho) DOM.tickerEcho.textContent = '8 km';
        }, 400);

        setTimeout(() => {
          if (DOM.tickerRefl) DOM.tickerRefl.textContent = '45 dBZ';
          if (DOM.tickerEcho) DOM.tickerEcho.textContent = '10 km';
        }, 800);

        setTimeout(() => {
          if (DOM.tickerRefl) DOM.tickerRefl.textContent = '58 dBZ';
          if (DOM.tickerEcho) DOM.tickerEcho.textContent = '11 km';
          if (DOM.badgeStatuses && DOM.badgeStatuses[2]) {
            DOM.badgeStatuses[2].textContent = '✓ ACTIVE THUNDERSTORM CONFIRMED';
            DOM.badgeStatuses[2].className = 'stage-status-badge status-complete';
          }
          if (DOM.alertChips && DOM.alertChips[2]) DOM.alertChips[2].style.display = 'inline-flex';
          if (DOM.narrativeTexts && DOM.narrativeTexts[2]) DOM.narrativeTexts[2].textContent = 'Radar confirms mature thunderstorm.';
          if (DOM.compBadges && DOM.compBadges[2]) {
            DOM.compBadges[2].textContent = 'TASK COMPLETED';
            DOM.compBadges[2].className = 'step-completion-badge complete';
          }
          if (DOM.triggerBadges && DOM.triggerBadges[2]) DOM.triggerBadges[2].textContent = 'TRIGGERING LIGHTNING MODEL...';
          syncMapStage(3);
        }, 1300);

        // =====================================================================
        // STAGE 4: LIGHTNING AI ANALYSIS (t = 6600ms)
        // Question: Has the storm become electrically dangerous?
        // =====================================================================
        cascadeTimer = setTimeout(() => {
          if (DOM.storyStages && DOM.storyStages[2]) DOM.storyStages[2].className = 'story-stage-card stage-complete';
          if (DOM.storyStages && DOM.storyStages[3]) DOM.storyStages[3].className = 'story-stage-card stage-running';
          if (DOM.badgeStatuses && DOM.badgeStatuses[3]) {
            DOM.badgeStatuses[3].textContent = '⚡ LIGHTNING MODEL RUNNING';
            DOM.badgeStatuses[3].className = 'stage-status-badge status-running';
          }
          if (DOM.narrativeTexts && DOM.narrativeTexts[3]) DOM.narrativeTexts[3].textContent = 'Electrical charge building rapidly.';

          // Legacy card sync
          if (DOM.cardRadar) { DOM.cardRadar.classList.remove('card-active'); DOM.cardRadar.classList.add('card-complete'); }
          if (DOM.statusRadar) { DOM.statusRadar.textContent = 'TRIGGERED (OK)'; DOM.statusRadar.className = 'card-status status-complete'; }
          if (DOM.timelineSteps[2]) DOM.timelineSteps[2].classList.add('completed');
          if (DOM.timelineSteps[3]) DOM.timelineSteps[3].classList.add('active');

          if (DOM.cardLightning) DOM.cardLightning.classList.add('card-alert');
          if (DOM.statusLightning) { DOM.statusLightning.textContent = 'SEVERE ALERT'; DOM.statusLightning.className = 'card-status status-alert'; }
          if (DOM.cascadeLog) DOM.cascadeLog.innerHTML = stages[3].log;
          if (DOM.telemLightning) DOM.telemLightning.textContent = stages[3].telem;
          if (DOM.valLightning) DOM.valLightning.querySelector('.v-val').textContent = stages[3].val;
          if (DOM.timeLightning) DOM.timeLightning.textContent = stages[3].time;
          speakAnnouncement('Lightning AI running. Electrical charge building rapidly.');
          setStep(3);

          // Ticker changes: 12% -> 24% -> 42% -> 67% -> 84%
          setTimeout(() => { if (DOM.tickerProb) DOM.tickerProb.textContent = '24%'; }, 300);
          setTimeout(() => { if (DOM.tickerProb) DOM.tickerProb.textContent = '42%'; }, 600);
          setTimeout(() => { if (DOM.tickerProb) DOM.tickerProb.textContent = '67%'; }, 900);

          setTimeout(() => {
            if (DOM.tickerProb) DOM.tickerProb.textContent = '84%';
            if (DOM.badgeStatuses && DOM.badgeStatuses[3]) {
              DOM.badgeStatuses[3].textContent = '✓ HIGH LIGHTNING PROBABILITY';
              DOM.badgeStatuses[3].className = 'stage-status-badge status-complete';
            }
            if (DOM.alertChips && DOM.alertChips[3]) DOM.alertChips[3].style.display = 'inline-flex';
            if (DOM.narrativeTexts && DOM.narrativeTexts[3]) DOM.narrativeTexts[3].textContent = 'Dangerous cloud-to-ground lightning likely.';
            if (DOM.compBadges && DOM.compBadges[3]) {
              DOM.compBadges[3].textContent = 'TASK COMPLETED';
              DOM.compBadges[3].className = 'step-completion-badge complete';
            }
            if (DOM.triggerBadges && DOM.triggerBadges[3]) DOM.triggerBadges[3].textContent = 'TRIGGERING MOVEMENT MODEL...';
            syncMapStage(4);
          }, 1300);

          // ===================================================================
          // STAGE 5: STORM TRACKING & MOVEMENT MODEL (t = 8800ms)
          // Question: Where will the storm move next?
          // ===================================================================
          cascadeTimer = setTimeout(() => {
            if (DOM.storyStages && DOM.storyStages[3]) DOM.storyStages[3].className = 'story-stage-card stage-complete';
            if (DOM.storyStages && DOM.storyStages[4]) DOM.storyStages[4].className = 'story-stage-card stage-running';
            if (DOM.badgeStatuses && DOM.badgeStatuses[4]) {
              DOM.badgeStatuses[4].textContent = '📍 TRACKING ACTIVE';
              DOM.badgeStatuses[4].className = 'stage-status-badge status-running';
            }

            // Legacy card sync
            if (DOM.cardLightning) { DOM.cardLightning.classList.remove('card-active'); DOM.cardLightning.classList.add('card-complete'); }
            if (DOM.timelineSteps[3]) DOM.timelineSteps[3].classList.add('completed');
            if (DOM.timelineSteps[4]) DOM.timelineSteps[4].classList.add('active');

            if (DOM.cardTracking) DOM.cardTracking.classList.add('card-active');
            if (DOM.statusTracking) { DOM.statusTracking.textContent = 'ANALYZING...'; DOM.statusTracking.className = 'card-status status-active'; }
            if (DOM.cascadeLog) DOM.cascadeLog.innerHTML = stages[4].log;
            if (DOM.telemTracking) DOM.telemTracking.textContent = stages[4].telem;
            if (DOM.valTracking) DOM.valTracking.querySelector('.v-val').textContent = stages[4].val;
            if (DOM.timeTracking) DOM.timeTracking.textContent = stages[4].time;
            speakAnnouncement('Storm movement model calculating projected trajectory and arrival zones.');
            setStep(4);

            setTimeout(() => {
              if (DOM.badgeStatuses && DOM.badgeStatuses[4]) {
                DOM.badgeStatuses[4].textContent = '✓ IMPACT ZONES GENERATED';
                DOM.badgeStatuses[4].className = 'stage-status-badge status-complete';
              }
              if (DOM.alertChips && DOM.alertChips[4]) DOM.alertChips[4].style.display = 'inline-flex';
              if (DOM.narrativeTexts && DOM.narrativeTexts[4]) DOM.narrativeTexts[4].textContent = 'Steering flow tracks storm east-northeast at 52 km/h across urban corridor.';
              if (DOM.compBadges && DOM.compBadges[4]) {
                DOM.compBadges[4].textContent = 'TASK COMPLETED';
                DOM.compBadges[4].className = 'step-completion-badge complete';
              }
              if (DOM.storyStages && DOM.storyStages[4]) DOM.storyStages[4].className = 'story-stage-card stage-complete';
              syncMapStage(5);
            }, 1000);

            // =================================================================
            // FINAL WARNING PANEL & CITIZEN PORTAL TRIGGER (t = 10000ms)
            // =================================================================
            cascadeTimer = setTimeout(() => {
              if (DOM.cardTracking) { DOM.cardTracking.classList.remove('card-active'); DOM.cardTracking.classList.add('card-complete'); }
              if (DOM.timelineSteps[4]) DOM.timelineSteps[4].classList.add('completed');
              if (DOM.timelineSteps[5]) DOM.timelineSteps[5].classList.add('active');

              if (DOM.cardWarning) DOM.cardWarning.classList.add('card-alert');
              if (DOM.statusWarning) { DOM.statusWarning.textContent = 'WARNING ISSUED'; DOM.statusWarning.className = 'card-status status-alert'; }

              // Show Final Warning Master Card
              if (DOM.finalWarningPanel) {
                DOM.finalWarningPanel.style.display = 'block';
                DOM.finalWarningPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
              }
              if (DOM.fwProb) DOM.fwProb.textContent = '84%';
              if (DOM.fwImpact) DOM.fwImpact.textContent = 'Within 30 Minutes';
              if (DOM.fwAreas) DOM.fwAreas.textContent = 'Patancheru, Miyapur, Kukatpally, Secunderabad';
              if (DOM.fwStatus) DOM.fwStatus.textContent = 'SENT TO CITIZENS';

              // Automatically Update Citizen Portal to Warning State
              if (DOM.citizenNormalState) DOM.citizenNormalState.style.display = 'none';
              if (DOM.citizenWarningActiveState) DOM.citizenWarningActiveState.style.display = 'block';
              if (DOM.cWarnProb) DOM.cWarnProb.textContent = '84%';
              if (DOM.cWarnEta) DOM.cWarnEta.textContent = '30 Minutes';
              if (DOM.cWarnAreas) DOM.cWarnAreas.textContent = 'Kukatpally, Miyapur, Secunderabad';

              // Open Citizen Warning Popup Modal
              if (DOM.citizenWarningPopup) DOM.citizenWarningPopup.style.display = 'flex';

              // Play 5 Times Alert Pop Sound
              playFivePopSound();

              // Voice Broadcast Announcement
              speakAnnouncement('Warning issued! Severe thunderstorm warning sent to citizens. Expected arrival within thirty minutes. Move indoors immediately.');
              setStep(5);

              // Reset hero button to replay state
              if (DOM.btnStartSimulationHero) {
                DOM.btnStartSimulationHero.classList.remove('running');
                DOM.btnStartSimulationHero.innerHTML = '<span class="btn-hero-icon">↺</span> REPLAY AUTO SIMULATION';
                DOM.btnStartSimulationHero.disabled = false;
              }
              if (DOM.btnStartCascade) {
                DOM.btnStartCascade.innerHTML = '<span class="btn-icon">↺</span> REPLAY SIMULATION';
                DOM.btnStartCascade.disabled = false;
              }
              if (DOM.heroStatusText) DOM.heroStatusText.textContent = 'WARNING DISPATCHED';

              isCascading = false;
            }, 1800);
          }, 2200);
        }, 2200);
      }, 2200);
    }, 2200);
  }

  function loadDatasetAndSimulate(datasetId) {
    if (!DATASETS[datasetId]) {
      datasetId = 'dataset-1';
    }
    activeDatasetKey = datasetId;

    // Highlight active dataset button in sidebar
    if (DOM.datasetBtns) {
      DOM.datasetBtns.forEach((btn) => {
        const id = btn.getAttribute('data-dataset');
        if (id === datasetId) {
          btn.classList.add('active');
        } else {
          btn.classList.remove('active');
        }
      });
    }

    startCascadingSimulation(datasetId);
  }

  function initCitizenPortal() {
    // Bilingual Tabs
    if (DOM.btnLangEn && DOM.btnLangTe) {
      DOM.btnLangEn.addEventListener('click', () => {
        DOM.btnLangEn.classList.add('active');
        DOM.btnLangTe.classList.remove('active');
        if (DOM.advisoryEn) DOM.advisoryEn.style.display = 'block';
        if (DOM.advisoryTe) DOM.advisoryTe.style.display = 'none';
      });
      DOM.btnLangTe.addEventListener('click', () => {
        DOM.btnLangTe.classList.add('active');
        DOM.btnLangEn.classList.remove('active');
        if (DOM.advisoryEn) DOM.advisoryEn.style.display = 'none';
        if (DOM.advisoryTe) DOM.advisoryTe.style.display = 'block';
      });
    }

    // Acknowledge Citizen Warning Popup
    if (DOM.btnAckCitizenPopup) {
      DOM.btnAckCitizenPopup.addEventListener('click', () => {
        if (DOM.citizenWarningPopup) DOM.citizenWarningPopup.style.display = 'none';
      });
    }

    // Severe Lightning Modal Controls
    if (DOM.btnCloseLightningModal) {
      DOM.btnCloseLightningModal.addEventListener('click', () => {
        if (DOM.severeLightningModal) DOM.severeLightningModal.style.display = 'none';
      });
    }
    if (DOM.btnAckLightning) {
      DOM.btnAckLightning.addEventListener('click', () => {
        if (DOM.severeLightningModal) DOM.severeLightningModal.style.display = 'none';
      });
    }
    if (DOM.btnGotoCitizen) {
      DOM.btnGotoCitizen.addEventListener('click', () => {
        if (DOM.severeLightningModal) DOM.severeLightningModal.style.display = 'none';
        switchView('view-alerts');
      });
    }

    // Voice Announcements Toggle
    if (DOM.btnToggleVoice) {
      DOM.btnToggleVoice.addEventListener('click', () => {
        voiceEnabled = !voiceEnabled;
        if (voiceEnabled) {
          DOM.btnToggleVoice.classList.add('active');
          DOM.btnToggleVoice.classList.remove('muted');
          if (DOM.voiceIcon) DOM.voiceIcon.textContent = '🔊';
          if (DOM.voiceText) DOM.voiceText.textContent = 'Voice On';
        } else {
          DOM.btnToggleVoice.classList.remove('active');
          DOM.btnToggleVoice.classList.add('muted');
          if (DOM.voiceIcon) DOM.voiceIcon.textContent = '🔇';
          if (DOM.voiceText) DOM.voiceText.textContent = 'Voice Muted';
          if ('speechSynthesis' in window) window.speechSynthesis.cancel();
        }
      });
    }
  }

  function triggerEmergencyBypass() {
    if (cascadeTimer) {
      clearTimeout(cascadeTimer);
      cascadeTimer = null;
    }
    isCascading = false;

    // Show Emergency Notice
    if (DOM.emergencyBypassNotice) {
      DOM.emergencyBypassNotice.style.display = 'flex';
    }

    // Bypass Stages 1, 2, 3
    if (DOM.storyStages && DOM.storyStages[0]) DOM.storyStages[0].className = 'story-stage-card stage-idle';
    if (DOM.storyStages && DOM.storyStages[1]) DOM.storyStages[1].className = 'story-stage-card stage-idle';
    if (DOM.storyStages && DOM.storyStages[2]) DOM.storyStages[2].className = 'story-stage-card stage-idle';

    if (DOM.badgeStatuses && DOM.badgeStatuses[0]) { DOM.badgeStatuses[0].textContent = 'BYPASSED (SKIPPED)'; DOM.badgeStatuses[0].className = 'stage-status-badge status-idle'; }
    if (DOM.badgeStatuses && DOM.badgeStatuses[1]) { DOM.badgeStatuses[1].textContent = 'BYPASSED (SKIPPED)'; DOM.badgeStatuses[1].className = 'stage-status-badge status-idle'; }
    if (DOM.badgeStatuses && DOM.badgeStatuses[2]) { DOM.badgeStatuses[2].textContent = 'BYPASSED (SKIPPED)'; DOM.badgeStatuses[2].className = 'stage-status-badge status-idle'; }

    // Instant Spike in Lightning Model
    if (DOM.storyStages && DOM.storyStages[3]) DOM.storyStages[3].className = 'story-stage-card stage-running';
    if (DOM.badgeStatuses && DOM.badgeStatuses[3]) {
      DOM.badgeStatuses[3].textContent = '⚡ EMERGENCY SPIKE (96%)';
      DOM.badgeStatuses[3].className = 'stage-status-badge status-running';
    }
    if (DOM.tickerProb) DOM.tickerProb.textContent = '96%';
    if (DOM.alertChips && DOM.alertChips[3]) DOM.alertChips[3].style.display = 'inline-flex';
    if (DOM.narrativeTexts && DOM.narrativeTexts[3]) {
      DOM.narrativeTexts[3].textContent = 'Emergency lightning detection triggered immediate warning.';
    }

    // Final Warning Master Panel
    if (DOM.finalWarningPanel) {
      DOM.finalWarningPanel.style.display = 'block';
      DOM.finalWarningPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
    if (DOM.fwProb) DOM.fwProb.textContent = '96%';
    if (DOM.fwImpact) DOM.fwImpact.textContent = 'IMMEDIATE OVERRIDE';
    if (DOM.fwAreas) DOM.fwAreas.textContent = 'Greater Hyderabad Metropolitan Area';
    if (DOM.fwStatus) DOM.fwStatus.textContent = 'SENT TO CITIZENS (EMERGENCY OVERRIDE)';

    // Automatically Update Citizen Portal to Warning State
    if (DOM.citizenNormalState) DOM.citizenNormalState.style.display = 'none';
    if (DOM.citizenWarningActiveState) DOM.citizenWarningActiveState.style.display = 'block';
    if (DOM.cWarnProb) DOM.cWarnProb.textContent = '96%';
    if (DOM.cWarnEta) DOM.cWarnEta.textContent = 'IMMEDIATE';
    if (DOM.cWarnAreas) DOM.cWarnAreas.textContent = 'Greater Hyderabad Metropolitan Area';

    // Show popup & play 5-pop alert sound
    if (DOM.citizenWarningPopup) DOM.citizenWarningPopup.style.display = 'flex';
    playFivePopSound();

    // Voice announcement
    speakAnnouncement('Emergency lightning detection triggered immediate warning. Bypassing NWP, satellite, and radar models.');

    // Sync Tactical Map
    syncMapStage(4, true);

    // Timeline Steps
    DOM.timelineSteps.forEach((node) => node.classList.add('active', 'completed'));
    setStep(5);

    if (DOM.btnStartSimulationHero) {
      DOM.btnStartSimulationHero.classList.remove('running');
      DOM.btnStartSimulationHero.innerHTML = '<span class="btn-hero-icon">↺</span> REPLAY AUTO SIMULATION';
      DOM.btnStartSimulationHero.disabled = false;
    }
    if (DOM.btnStartCascade) {
      DOM.btnStartCascade.innerHTML = '<span class="btn-icon">▶</span> START CASCADING SIMULATION';
      DOM.btnStartCascade.disabled = false;
    }
  }

  // =========================================================================
  // 14. EVENT LISTENERS
  // =========================================================================

  function bindEventListeners() {
    // Cascading Simulation & Emergency Bypass
    if (DOM.btnStartSimulationHero) DOM.btnStartSimulationHero.addEventListener('click', () => startCascadingSimulation());
    if (DOM.btnStartCascade) DOM.btnStartCascade.addEventListener('click', () => startCascadingSimulation());
    if (DOM.btnEmergencyBypass) DOM.btnEmergencyBypass.addEventListener('click', triggerEmergencyBypass);
    if (DOM.btnSidebarEmergency) DOM.btnSidebarEmergency.addEventListener('click', triggerEmergencyBypass);
    if (DOM.btnTriggerBypassAction) DOM.btnTriggerBypassAction.addEventListener('click', triggerEmergencyBypass);

    // Jump from final warning to citizen portal
    if (DOM.btnWarningPortalJump) {
      DOM.btnWarningPortalJump.addEventListener('click', () => {
        switchView('view-alerts');
      });
    }

    // Timeline Step Node Clicks
    DOM.timelineSteps.forEach((stepNode) => {
      stepNode.addEventListener('click', () => {
        const stepIdx = parseInt(stepNode.getAttribute('data-step') || '0', 10);
        setStep(stepIdx);
      });
    });

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
    initCitizenPortal();
    resetCascadeCards('dataset-1');

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
