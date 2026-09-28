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

    // Phase 2 Refinement Controls & Innovation Cards
    simulationSpeed: document.getElementById('simulation-speed'),
    speedDisplayTag: document.getElementById('speed-display-tag'),
    btnJuryMode: document.getElementById('btn-jury-mode'),
    juryModeLabel: document.getElementById('jury-mode-label'),
    innovationCards: document.querySelectorAll('.innovation-card'),

    // Whole Day Event Timeline Elements
    simEventClock: document.getElementById('sim-event-clock'),
    simEventDesc: document.getElementById('sim-event-desc'),
    wdtProgressLine: document.getElementById('wdt-progress-line'),
    wdtNodes: document.querySelectorAll('.wdt-node'),

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

    // Stage Progress Bars & Status Texts
    statusNwpText: document.getElementById('status-nwp-text'),
    progBarNwp: document.getElementById('prog-bar-nwp'),
    progPctNwp: document.getElementById('prog-pct-nwp'),
    cdmCheckNwp: document.getElementById('cdm-check-nwp'),
    cdmResNwp: document.getElementById('cdm-res-nwp'),
    cdmDecNwp: document.getElementById('cdm-dec-nwp'),
    cdmActNwp: document.getElementById('cdm-act-nwp'),

    statusSatText: document.getElementById('status-sat-text'),
    progBarSat: document.getElementById('prog-bar-sat'),
    progPctSat: document.getElementById('prog-pct-sat'),
    cdmCheckSat: document.getElementById('cdm-check-sat'),
    cdmResSat: document.getElementById('cdm-res-sat'),
    cdmDecSat: document.getElementById('cdm-dec-sat'),
    cdmActSat: document.getElementById('cdm-act-sat'),

    statusRadarText: document.getElementById('status-radar-text'),
    progBarRadar: document.getElementById('prog-bar-radar'),
    progPctRadar: document.getElementById('prog-pct-radar'),
    cdmCheckRadar: document.getElementById('cdm-check-radar'),
    cdmResRadar: document.getElementById('cdm-res-radar'),
    cdmDecRadar: document.getElementById('cdm-dec-radar'),
    cdmActRadar: document.getElementById('cdm-act-radar'),

    statusLightningText: document.getElementById('status-lightning-text'),
    progBarLightning: document.getElementById('prog-bar-lightning'),
    progPctLightning: document.getElementById('prog-pct-lightning'),
    cdmCheckLightning: document.getElementById('cdm-check-lightning'),
    cdmResLightning: document.getElementById('cdm-res-lightning'),
    cdmDecLightning: document.getElementById('cdm-dec-lightning'),
    cdmActLightning: document.getElementById('cdm-act-lightning'),

    statusTrackingText: document.getElementById('status-tracking-text'),
    progBarTracking: document.getElementById('prog-bar-tracking'),
    progPctTracking: document.getElementById('prog-pct-tracking'),
    cdmCheckTracking: document.getElementById('cdm-check-tracking'),
    cdmResTracking: document.getElementById('cdm-res-tracking'),
    cdmDecTracking: document.getElementById('cdm-dec-tracking'),
    cdmActTracking: document.getElementById('cdm-act-tracking'),

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

    // Citizen Portal Elements & Prominent Red Alert Card
    citizenNormalState: document.getElementById('citizen-normal-state'),
    citizenWarningActiveState: document.getElementById('citizen-warning-active-state'),
    cWarnProb: document.getElementById('c-warn-prob'),
    cWarnEta: document.getElementById('c-warn-eta'),
    cWarnAreas: document.getElementById('c-warn-areas'),
    citizenWarningPopup: document.getElementById('citizen-warning-popup'),
    btnAckCitizenPopup: document.getElementById('btn-ack-citizen-popup'),

    citizenRedAlertCard: document.getElementById('citizen-red-alert-card'),
    cRedArea: document.getElementById('c-red-area'),
    cRedEta: document.getElementById('c-red-eta'),
    cRedProb: document.getElementById('c-red-prob'),
    cRedStatus: document.getElementById('c-red-status'),
    btnCitizenMute: document.getElementById('btn-citizen-mute'),
    citizenMuteText: document.getElementById('citizen-mute-text'),

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

    // Image 1: Top Warning Issued Card (at very top)
    topWarningIssuedCard: document.getElementById('top-warning-issued-card'),
    topWarnProb: document.getElementById('top-warn-prob'),
    topWarnImpact: document.getElementById('top-warn-impact'),
    topWarnAreas: document.getElementById('top-warn-areas'),
    btnTopWarnPortal: document.getElementById('btn-top-warn-portal'),
    topWarnSentBadge: document.getElementById('top-warn-sent-badge'),

    // Image 4/5: Top 4-KPI Row
    kpiCardRisk: document.getElementById('kpi-card-risk'),
    kpiRiskVal: document.getElementById('kpi-risk-val'),
    kpiRiskDot: document.getElementById('kpi-risk-dot'),
    kpiRiskSub: document.getElementById('kpi-risk-sub'),
    kpiActiveAlerts: document.getElementById('kpi-active-alerts'),
    kpiCitizensRisk: document.getElementById('kpi-citizens-risk'),
    kpiSmsLogs: document.getElementById('kpi-sms-logs'),

    // Image 2, 4, 5: Stream Engine Playback
    streamEngineCard: document.getElementById('stream-engine-card'),
    btnPlayStream: document.getElementById('btn-play-stream'),
    btnStepStream: document.getElementById('btn-step-stream'),
    streamSlider: document.getElementById('stream-slider'),
    streamRowCurr: document.getElementById('stream-row-curr'),
    streamTimestamp: document.getElementById('stream-timestamp'),
    saRowNum: document.getElementById('sa-row-num'),
    saTimestamp: document.getElementById('sa-timestamp'),
    saRiskScore: document.getElementById('sa-risk-score'),
    saPredBadge: document.getElementById('sa-pred-badge'),
    saStatusBadge: document.getElementById('sa-status-badge'),
    speedPillBtns: document.querySelectorAll('.speed-pill-btn'),
    tabStreamCsv: document.getElementById('tab-stream-csv'),
    tabStreamForm: document.getElementById('tab-stream-form'),
    tabStreamRaw: document.getElementById('tab-stream-raw'),

    // Stage 6: Weakening
    cardWeakening: document.getElementById('card-weakening'),
    progBarWeakening: document.getElementById('prog-bar-weakening'),
    progPctWeakening: document.getElementById('prog-pct-weakening'),
    statusWeakText: document.getElementById('status-weak-text'),
    statusWeakening: document.getElementById('status-weakening'),
    tickerWeakDowndraft: document.getElementById('ticker-weak-downdraft'),
    tickerWeakRain: document.getElementById('ticker-weak-rain'),
    tickerWeakLtg: document.getElementById('ticker-weak-ltg'),
    tickerWeakClear: document.getElementById('ticker-weak-clear'),
    cdmCheckWeak: document.getElementById('cdm-check-weak'),
    cdmResWeak: document.getElementById('cdm-res-weak'),
    cdmDecWeak: document.getElementById('cdm-dec-weak'),
    cdmActWeak: document.getElementById('cdm-act-weak'),
    narWeakening: document.getElementById('nar-weakening'),
    chipWeakening: document.getElementById('chip-weakening'),
    handoffWeakening: document.getElementById('handoff-weakening'),

    // Image 3: Citizen Portal
    cStatusTopCard: document.getElementById('c-status-top-card'),
    cTopStatusText: document.getElementById('c-top-status-text'),
    cTopStatusDot: document.getElementById('c-top-status-dot'),
    cTopStatusIcon: document.getElementById('c-top-status-icon'),
    cTopHeadline: document.getElementById('c-top-headline'),
    cTopDesc: document.getElementById('c-top-desc'),
    btnNavigateSafe: document.getElementById('btn-navigate-safe'),
    cNavMode: document.getElementById('c-nav-mode'),
    cShelterDist: document.getElementById('c-shelter-dist'),
    cShelterTitle: document.getElementById('c-shelter-title'),
    cShelterDesc: document.getElementById('c-shelter-desc'),
    btnCPortalBack: document.getElementById('btn-c-portal-back'),
    btnCitizenRefresh: document.getElementById('btn-citizen-refresh'),
    btnCOpenGmaps: document.getElementById('btn-c-open-gmaps'),
    btnCExpandGis: document.getElementById('btn-c-expand-gis'),
    btnCHelpline: document.getElementById('btn-c-helpline'),

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

  let isAlertSoundMuted = false;
  let juryModeActive = false;
  let simSpeedMultiplier = 2; // Default 2x
  let activeDatasetKey = 'dataset-1';
  let cascadeTimer = null;
  let isCascading = false;
  let currentCascadeTimeouts = [];

  function clearAllCascadeTimeouts() {
    if (cascadeTimer) {
      clearTimeout(cascadeTimer);
      cascadeTimer = null;
    }
    currentCascadeTimeouts.forEach((t) => clearTimeout(t));
    currentCascadeTimeouts = [];
  }

  function queueTimeout(fn, delay) {
    const t = setTimeout(fn, delay);
    currentCascadeTimeouts.push(t);
    return t;
  }

  function playPopSound() {
    if (isAlertSoundMuted) return;
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
    if (isAlertSoundMuted) return;
    for (let i = 0; i < 5; i++) {
      setTimeout(() => {
        if (!isAlertSoundMuted) playPopSound();
      }, i * 220);
    }
  }

  function highlightInnovationCard(keywordOrIdx) {
    if (!DOM.innovationCards) return;
    DOM.innovationCards.forEach((c) => c.classList.remove('jury-highlight'));
    if (!juryModeActive) return;

    let targetIdx = -1;
    if (typeof keywordOrIdx === 'number') {
      targetIdx = keywordOrIdx;
    } else if (typeof keywordOrIdx === 'string') {
      // 0: Relay Race Pipeline, 1: Prior Detection, 2: Pocket Hazard Zones, 3: Emergency Bypass, 4: Sensor Harmonization
      if (keywordOrIdx.includes('prior') || keywordOrIdx.includes('nwp')) targetIdx = 1;
      else if (keywordOrIdx.includes('relay') || keywordOrIdx.includes('sat') || keywordOrIdx.includes('radar')) targetIdx = 0;
      else if (keywordOrIdx.includes('sensor') || keywordOrIdx.includes('harmon') || keywordOrIdx.includes('lightning')) targetIdx = 4;
      else if (keywordOrIdx.includes('pocket') || keywordOrIdx.includes('move') || keywordOrIdx.includes('warn')) targetIdx = 2;
      else if (keywordOrIdx.includes('bypass')) targetIdx = 3;
    }

    if (targetIdx >= 0 && DOM.innovationCards[targetIdx]) {
      DOM.innovationCards[targetIdx].classList.add('jury-highlight');
      DOM.innovationCards[targetIdx].scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  function updateWholeDayTimeline(timeStr, descStr, pct, nodeIdx, isDanger = false) {
    if (DOM.simEventClock) DOM.simEventClock.textContent = timeStr;
    if (DOM.simEventDesc) DOM.simEventDesc.textContent = descStr;
    if (DOM.wdtProgressLine) DOM.wdtProgressLine.style.width = pct + '%';

    if (DOM.wdtNodes) {
      DOM.wdtNodes.forEach((node, idx) => {
        node.classList.remove('active', 'passed', 'danger');
        if (idx < nodeIdx) {
          node.classList.add('passed');
        } else if (idx === nodeIdx) {
          node.classList.add('active');
          if (isDanger) node.classList.add('danger');
        }
      });
    }
  }

  // =========================================================================
  // 14. REALISTIC HYDERABAD STORM SCENARIOS (7 DATASETS)
  // =========================================================================

  const DATASETS = Object.freeze({
    'dataset-1': {
      id: 'dataset-1',
      name: 'Hyderabad Convective Outbreak Track',
      scenarioTime: '11:00 IST',
      subtitle: 'Complete 6-Stage Atmospheric Evolution',
      category: 'MULTI-STAGE CASCADING CONVECTION',
      isExtreme: false,
      hasSevereLightning: true,
      isHazard: true,
      targetArea: 'Patancheru, Miyapur, Kukatpally, Secunderabad',
      etaMinutes: 'Within 30 Minutes',
      probPercent: '84%',
      nwp: {
        temp: ['29.0°C', '30.2°C', '31.4°C', '32.1°C', '32.8°C'],
        hum: ['65%', '68%', '72%', '75%', '78%'],
        cape: ['900 J/kg', '1,250 J/kg', '1,680 J/kg', '2,100 J/kg', '2,450 J/kg'],
        li: ['-1.5', '-2.4', '-3.3', '-4.1', '-4.8'],
        shear: ['10 m/s', '13 m/s', '16 m/s', '19 m/s', '21 m/s'],
        check: 'Temperature, Humidity, Instability, CAPE, Wind Shear',
        result: 'Thermodynamic destabilization detected. CAPE exceeds 2,450 J/kg threshold.',
        decision: '1. Fuel Building Detected (Evolving Stage)',
        action: 'Automatically Triggering Stage 2 (INSAT Satellite) →',
        badge: '✓ 1. FUEL BUILDING DETECTED',
        trigger: 'TRIGGERING SATELLITE ANALYSIS...'
      },
      sat: {
        ctt: ['-28.0°C', '-34.5°C', '-41.0°C', '-47.8°C', '-54.2°C'],
        cooling: ['-2.0°C/hr', '-4.5°C/hr', '-7.2°C/hr', '-9.8°C/hr', '-11.5°C/hr'],
        growth: ['Cumulus Congestus', 'Towering Cumulus', 'Rapid Glaciation', 'Active Anvil', 'Mature Convective Cloud'],
        expansion: ['18 km²/hr', '26 km²/hr', '35 km²/hr', '44 km²/hr', '52 km²/hr'],
        check: 'Cloud Top Cooling Rate & Vertical Development',
        result: 'Cloud rising rapidly (-11.5°C/hr cooling rate). Deep glaciation confirmed.',
        decision: '2. Cloud Growing Confirmed',
        action: 'Automatically Triggering Stage 3 (Doppler Radar) →',
        badge: '✓ 2. CLOUD GROWING DETECTED',
        trigger: 'TRIGGERING DOPPLER RADAR...'
      },
      radar: {
        refl: ['20 dBZ', '28 dBZ', '36 dBZ', '45 dBZ', '54 dBZ'],
        echo: ['5.0 km', '7.2 km', '9.8 km', '12.1 km', '14.2 km'],
        velocity: ['18 km/h', '24 km/h', '30 km/h', '35 km/h', '38 km/h'],
        core: ['Developing Cell', 'Moderate Core', 'Convective Core', 'Dense Ice Region', 'Mature Supercell Core'],
        check: 'Core Reflectivity, Echo Top, Mixed-Phase Hydrometeors',
        result: 'Cloud becomes tall (14.2 km echo top, 54 dBZ core). Strong updrafts & ice developed.',
        decision: '3. Storm Growing Confirmed',
        action: 'Automatically Triggering Stage 4 (Lightning Sensors) →',
        badge: '✓ 3. STORM GROWING CONFIRMED',
        trigger: 'TRIGGERING LIGHTNING SENSORS...'
      },
      lightning: {
        field: ['12 kV/m', '26 kV/m', '44 kV/m', '64 kV/m', '82 kV/m'],
        flash: ['Low Dipole', 'Charge Separation', 'Mixed-Phase Collisions', 'Frequent Ground Strikes', 'Dangerous Strike Surge (46/min)'],
        prob: ['12%', '32%', '54%', '72%', '84%'],
        check: 'Electric Field Gradient & Mixed-Phase Hydrometeor Collisions',
        result: 'Ice and hail collisions create intense electrical charge. 84% lightning probability.',
        decision: '4. Electrifying Confirmed',
        action: 'Automatically Triggering Stage 5 (Active Storm Model) →',
        badge: '✓ 4. ELECTRIFYING DETECTED',
        trigger: 'TRIGGERING ACTIVE STORM MODEL...'
      },
      movement: {
        speed: ['28 km/h', '32 km/h', '36 km/h', '39 km/h', '42 km/h'],
        dir: ['NE (45°)', 'NE (45°)', 'NE (45°)', 'NE (45°)', 'NE (45°)'],
        eta: ['45 Mins', '38 Mins', '32 Mins', '26 Mins', '22 Minutes'],
        target: 'Patancheru, Miyapur, Kukatpally, Secunderabad',
        check: 'Translation Velocity & High-Density Population Geofence',
        result: 'Active storm confirmed: dangerous lightning + heavy rain + strong winds tracking into urban wards.',
        decision: '5. Active Storm Confirmed',
        action: 'Automatically Triggering Stage 6 (Weakening & Warning Dissemination) →',
        badge: '✓ 5. ACTIVE STORM ENGAGED',
        trigger: 'TRIGGERING WEAKENING ANALYSIS...'
      },
      weakening: {
        downdraft: ['18 km/h', '24 km/h', '30 km/h', '36 km/h', '38 km/h'],
        rain: ['Convective Core', 'Downdraft Outflow', 'Rain Dominance', 'Heavy Downpours', 'Rain Shield Dominates'],
        ltg: ['Peak 46/min', 'Decaying 28/min', 'Decaying 14/min', 'Scattered Flashes', 'Decaying Trend'],
        clear: ['Outflow Active', 'Precip Spreading', 'Corridor Safe Route', 'Shelter Safe Path', 'Evacuation Route Open'],
        check: 'Updraft Dissipation, Rain Downpour Rate, Flash Density Decoupling',
        result: 'Updraft disappears, rain dominates. Microburst outflow and civil defense warning dispatched.',
        decision: '6. Weakening Phase Confirmed · Warning Issued',
        action: 'Disseminated to Citizen Portal, Mobile App & Municipal Sirens',
        badge: '✓ 6. WEAKENING CONFIRMED',
        trigger: 'FINAL CIVIL DEFENSE WARNING DISPATCHED'
      },
      warning: {
        time: '11:30 IST',
        issued: true,
        level: 'SEVERE',
        headline: '🚨 WARNING ISSUED: Severe Thunderstorm & Lightning Imminent',
        summary: 'Civil defense level alert: Dangerous ground strikes and downburst winds tracking into Patancheru, Miyapur, Kukatpally, and Secunderabad within 30 minutes.',
        areas: 'Patancheru, Miyapur, Kukatpally, Secunderabad',
        voice: 'Warning issued! Severe thunderstorm and dangerous lightning imminent for Patancheru, Miyapur, Kukatpally, and Secunderabad. Citizens must seek immediate indoor shelter.'
      }
    },

    'dataset-2': {
      id: 'dataset-2',
      name: 'Western Hyderabad Instability Event',
      scenarioTime: '12:30 IST',
      subtitle: 'Fuel Alert Scenario',
      category: 'ATMOSPHERIC INSTABILITY EVENT',
      isExtreme: false,
      hasSevereLightning: false,
      isHazard: true,
      targetArea: 'Patancheru, BHEL & Chandanagar',
      etaMinutes: '45 Minutes',
      probPercent: '64%',
      nwp: {
        temp: ['29.5°C', '30.2°C', '31.0°C', '31.5°C', '31.8°C'],
        hum: ['64%', '67%', '69%', '71%', '72%'],
        cape: ['980 J/kg', '1,280 J/kg', '1,650 J/kg', '1,920 J/kg', '2,150 J/kg'],
        li: ['-1.8', '-2.6', '-3.2', '-3.8', '-4.2'],
        shear: ['11 m/s', '13 m/s', '14 m/s', '15 m/s', '16 m/s'],
        check: 'Temperature, Humidity, Instability, CAPE & Shear',
        result: 'Boundary layer heating breaches cap. Instability building.',
        decision: 'Atmospheric Fuel Alert Generated (CAPE > 2000 J/kg)',
        action: 'Triggering Satellite Analysis →',
        badge: '✓ FUEL ALERT GENERATED',
        trigger: 'TRIGGERING SATELLITE ANALYSIS...'
      },
      sat: {
        ctt: ['-18.4°C', '-24.0°C', '-29.5°C', '-34.2°C', '-38.2°C'],
        cooling: ['-2.8°C/hr', '-4.1°C/hr', '-5.2°C/hr', '-5.9°C/hr', '-6.4°C/hr'],
        growth: ['Cumulus Congestus', 'Towering Cumulus', 'Moderate Glaciation', 'Active Cell', 'Convective Cell'],
        expansion: ['6 km²/hr', '10 km²/hr', '14 km²/hr', '16 km²/hr', '18 km²/hr'],
        check: 'Cloud Cooling Rate & Vertical Development',
        result: 'Moderate convective cloud cooling detected over Patancheru.',
        decision: 'Early Storm Development Alert',
        action: 'Triggering Radar Analysis →',
        badge: '✓ CLOUD GROWTH DETECTED',
        trigger: 'TRIGGERING RADAR ANALYSIS...'
      },
      radar: {
        refl: ['24 dBZ', '31 dBZ', '36 dBZ', '40 dBZ', '44 dBZ'],
        echo: ['5.2 km', '6.8 km', '8.0 km', '9.1 km', '9.8 km'],
        velocity: ['18 km/h', '22 km/h', '25 km/h', '27 km/h', '28 km/h'],
        core: ['Developing Cell', 'Moderate Echo', 'Convective Column', 'Precip Core', 'Cell Established'],
        check: 'Reflectivity Core & Echo Top Velocity',
        result: 'Precipitation core 44 dBZ reaching 9.8 km echo height.',
        decision: 'Convective Cell Verified',
        action: 'Triggering Lightning Analysis →',
        badge: '✓ CELL FORMATION VERIFIED',
        trigger: 'TRIGGERING LIGHTNING MODEL...'
      },
      lightning: {
        field: ['12 kV/m', '18 kV/m', '24 kV/m', '28 kV/m', '32 kV/m'],
        flash: ['Low Potential', 'Moderate Surge', 'Elevated Potential', 'Developing Hazard', 'Moderate Strikes'],
        prob: ['28%', '39%', '48%', '58%', '64%'],
        check: 'Electric Field & Mixed Phase Electrification',
        result: 'Moderate electrification. Strike probability 64%.',
        decision: 'Moderate Lightning Advisory Threshold Exceeded',
        action: 'Triggering Movement Prediction →',
        badge: '✓ LIGHTNING RISK VERIFIED',
        trigger: 'TRIGGERING MOVEMENT PREDICTION...'
      },
      movement: {
        speed: ['24 km/h', '26 km/h', '28 km/h', '30 km/h', '32 km/h'],
        dir: ['ENE (60°)', 'ENE (60°)', 'ENE (62°)', 'ENE (62°)', 'ENE (62°)'],
        eta: ['58 Mins', '52 Mins', '49 Mins', '47 Mins', '45 Minutes'],
        target: 'Patancheru, BHEL, Chandanagar, Miyapur',
        check: 'Storm Velocity Vector & Target Population Buffer',
        result: 'Convective cell tracking ENE at 32 km/h toward Miyapur corridor.',
        decision: 'Public Advisory Warning Required',
        action: 'Issuing Public Warning →',
        badge: '✓ TRAJECTORY LOCKED',
        trigger: 'ISSUING CITIZEN WARNING...'
      },
      warning: {
        time: '12:35 IST',
        issued: true,
        level: 'ADVISORY',
        headline: 'Thunderstorm Fuel Alert & Developing Convective Advisory',
        summary: 'Atmospheric instability exceeding threshold. Developing cell approaching Patancheru & Miyapur within 45 mins.',
        areas: 'Patancheru, BHEL, Chandanagar, Miyapur',
        voice: 'Fuel alert generated. Developing convective storm approaching Patancheru and Miyapur within 45 minutes.'
      }
    },

    'dataset-3': {
      id: 'dataset-3',
      name: 'Madhapur Convective Development',
      scenarioTime: '13:15 IST',
      subtitle: 'Storm Growth Scenario',
      category: 'RAPID STORM GROWTH',
      isExtreme: false,
      hasSevereLightning: true,
      isHazard: true,
      targetArea: 'Madhapur & Durgam Cheruvu Corridor',
      etaMinutes: '32 Minutes',
      probPercent: '78%',
      nwp: {
        temp: ['30.1°C', '30.8°C', '31.6°C', '32.1°C', '32.6°C'],
        hum: ['68%', '71%', '73%', '75%', '76%'],
        cape: ['1,200 J/kg', '1,580 J/kg', '1,920 J/kg', '2,240 J/kg', '2,480 J/kg'],
        li: ['-2.4', '-3.2', '-3.9', '-4.6', '-5.1'],
        shear: ['14 m/s', '16 m/s', '18 m/s', '20 m/s', '21 m/s'],
        check: 'Thermodynamic Lift, Temperature Gradient & CAPE',
        result: 'Strong instability with CAPE reaching 2,480 J/kg. Updraft potential high.',
        decision: 'Convective Fuel Alert Triggered',
        action: 'Triggering Satellite Analysis →',
        badge: '✓ FUEL ALERT GENERATED',
        trigger: 'TRIGGERING SATELLITE ANALYSIS...'
      },
      sat: {
        ctt: ['-24.2°C', '-31.5°C', '-38.0°C', '-42.6°C', '-46.5°C'],
        cooling: ['-4.5°C/hr', '-6.2°C/hr', '-7.8°C/hr', '-8.9°C/hr', '-9.8°C/hr'],
        growth: ['Rapid Cumulus', 'Towering Cloud Core', 'Vigorous Glaciation', 'Active Cell Top', 'Mature Cloud Top'],
        expansion: ['12 km²/hr', '18 km²/hr', '24 km²/hr', '28 km²/hr', '32 km²/hr'],
        check: 'INSAT-3DR Rapid Cooling & Cloud Area Growth',
        result: 'Rapid cloud top cooling (-9.8°C/hr) over Western IT belt.',
        decision: 'Storm Growth Scenario Active',
        action: 'Triggering Radar Analysis →',
        badge: '✓ RAPID CLOUD GROWTH',
        trigger: 'TRIGGERING RADAR ANALYSIS...'
      },
      radar: {
        refl: ['28 dBZ', '35 dBZ', '40 dBZ', '44 dBZ', '48 dBZ'],
        echo: ['6.5 km', '8.2 km', '9.8 km', '11.2 km', '12.4 km'],
        velocity: ['24 km/h', '29 km/h', '33 km/h', '36 km/h', '38 km/h'],
        core: ['Intensifying', 'Strong Core', 'Hydrometeor Arc', 'Convective Core', 'Intense Updraft Core'],
        check: 'Reflectivity Core & Dual-Pol Hydrometeor Growth',
        result: 'Reflectivity core reaches 48 dBZ with echo top at 12.4 km.',
        decision: 'Active Thunderstorm Core Confirmed',
        action: 'Triggering Lightning Analysis →',
        badge: '✓ CONVECTIVE CORE DETECTED',
        trigger: 'TRIGGERING LIGHTNING MODEL...'
      },
      lightning: {
        field: ['22 kV/m', '31 kV/m', '40 kV/m', '44 kV/m', '48 kV/m'],
        flash: ['Developing', 'Elevated Surges', 'High Strike Rate', 'Dense Activity', 'High Strike Threat'],
        prob: ['38%', '52%', '64%', '72%', '78%'],
        check: 'Graupel-Ice Collisions & Electric Dipole Strength',
        result: 'Dipole charge established. 78% lightning strike probability.',
        decision: 'High Lightning Hazard Detected',
        action: 'Triggering Movement Prediction →',
        badge: '✓ HIGH LIGHTNING PROBABILITY',
        trigger: 'TRIGGERING MOVEMENT PREDICTION...'
      },
      movement: {
        speed: ['28 km/h', '31 km/h', '34 km/h', '36 km/h', '38 km/h'],
        dir: ['E (82°)', 'E (84°)', 'E (85°)', 'E (85°)', 'E (85°)'],
        eta: ['45 Mins', '41 Mins', '37 Mins', '34 Mins', '32 Minutes'],
        target: 'Madhapur, Durgam Cheruvu, Jubilee Hills, Banjara Hills',
        check: 'Steering Wind Flow & Polygon Intersections',
        result: 'Tracking east across Madhapur with arrival in 32 minutes.',
        decision: 'Severe Thunderstorm Warning Required',
        action: 'Issuing Public Warning →',
        badge: '✓ IMPACT VECTOR LOCKED',
        trigger: 'ISSUING CITIZEN WARNING...'
      },
      warning: {
        time: '13:20 IST',
        issued: true,
        level: 'WARNING',
        headline: 'Convective Storm & Lightning Warning for Madhapur',
        summary: 'Rapid cloud growth confirmed by satellite and radar. Strong lightning risk for Madhapur and Jubilee Hills within 32 mins.',
        areas: 'Madhapur, Durgam Cheruvu, Jubilee Hills, Banjara Hills',
        voice: 'Storm growth alert. Convective cell tracking towards Madhapur. Expected arrival in 32 minutes. Seek shelter.'
      }
    },

    'dataset-4': {
      id: 'dataset-4',
      name: 'Gachibowli Severe Thunderstorm',
      scenarioTime: '14:00 IST',
      subtitle: 'High Lightning Risk',
      category: 'SEVERE THUNDERSTORM EVENT',
      isExtreme: false,
      hasSevereLightning: true,
      isHazard: true,
      targetArea: 'Gachibowli & Financial District',
      etaMinutes: '22 Minutes',
      probPercent: '88%',
      nwp: {
        temp: ['30.8°C', '31.5°C', '32.2°C', '32.8°C', '33.2°C'],
        hum: ['72%', '75%', '77%', '79%', '81%'],
        cape: ['1,450 J/kg', '1,820 J/kg', '2,180 J/kg', '2,480 J/kg', '2,750 J/kg'],
        li: ['-3.1', '-4.0', '-4.8', '-5.6', '-6.2'],
        shear: ['17 m/s', '19 m/s', '22 m/s', '24 m/s', '26 m/s'],
        check: 'Temperature, Humidity, Instability & Wind Shear',
        result: 'CAPE 2,750 J/kg exceeds severe threshold. Heavy boundary convergence.',
        decision: 'Severe Fuel Alert Generated',
        action: 'Triggering Satellite Analysis →',
        badge: '✓ FUEL ALERT GENERATED',
        trigger: 'TRIGGERING SATELLITE ANALYSIS...'
      },
      sat: {
        ctt: ['-28.5°C', '-36.2°C', '-44.0°C', '-49.8°C', '-54.2°C'],
        cooling: ['-5.8°C/hr', '-8.1°C/hr', '-10.0°C/hr', '-11.4°C/hr', '-12.4°C/hr'],
        growth: ['Rapid Cumulonimbus', 'Massive Glaciation', 'Expanding Anvil', 'Deep Convection', 'Severe Storm Core'],
        expansion: ['18 km²/hr', '26 km²/hr', '35 km²/hr', '41 km²/hr', '46 km²/hr'],
        check: 'Cloud Top Glaciation & Cooling Rate',
        result: 'Vigorous cloud cooling (-12.4°C/hr) with deep anvil development.',
        decision: 'Severe Storm Development Alert',
        action: 'Triggering Radar Analysis →',
        badge: '✓ SEVERE CLOUD GROWTH',
        trigger: 'TRIGGERING RADAR ANALYSIS...'
      },
      radar: {
        refl: ['34 dBZ', '41 dBZ', '46 dBZ', '51 dBZ', '54 dBZ'],
        echo: ['7.8 km', '9.9 km', '11.8 km', '13.4 km', '14.5 km'],
        velocity: ['28 km/h', '33 km/h', '38 km/h', '41 km/h', '44 km/h'],
        core: ['Intensifying Updraft', 'Precip Core', 'Hydrometeor Column', 'Intense Core', 'Severe Reflectivity Core'],
        check: 'DWR Begumpet Core Reflectivity & Echo Heights',
        result: '54 dBZ deep core with 14.5 km echo top over Western corridor.',
        decision: 'Severe Thunderstorm Imminent',
        action: 'Triggering Lightning Analysis →',
        badge: '✓ 54 dBZ CONVECTIVE CORE',
        trigger: 'TRIGGERING LIGHTNING MODEL...'
      },
      lightning: {
        field: ['28 kV/m', '38 kV/m', '50 kV/m', '60 kV/m', '68 kV/m'],
        flash: ['High Strike Surge', 'Severe CG Potential', 'Multiple Ground Strikes', 'Frequent Flashes', 'Severe CG Hazard (62/min)'],
        prob: ['45%', '60%', '74%', '82%', '88%'],
        check: 'Electric Field Gradient & XGBoost Electrification Model',
        result: '88% lightning probability with 62 strikes/minute estimated.',
        decision: 'Severe Lightning Hazard Alert',
        action: 'Triggering Movement Prediction →',
        badge: '✓ 88% SEVERE LIGHTNING',
        trigger: 'TRIGGERING MOVEMENT PREDICTION...'
      },
      movement: {
        speed: ['34 km/h', '37 km/h', '40 km/h', '42 km/h', '44 km/h'],
        dir: ['ENE (66°)', 'ENE (68°)', 'ENE (70°)', 'ENE (70°)', 'ENE (70°)'],
        eta: ['34 Mins', '30 Mins', '27 Mins', '24 Mins', '22 Minutes'],
        target: 'Gachibowli, Financial District, Nanakramguda, HITEC City',
        check: 'Vector Extrapolation & Critical Infrastructure Overlay',
        result: 'Tracking east-northeast at 44 km/h directly into Gachibowli.',
        decision: 'Issue Severe Thunderstorm Emergency Warning',
        action: 'Disseminating Public Warning →',
        badge: '✓ ARRIVAL: 22 MINUTES',
        trigger: 'DISPATCHING EMERGENCY ALERT...'
      },
      warning: {
        time: '14:05 IST',
        issued: true,
        level: 'SEVERE',
        headline: '⚠ Severe Thunderstorm & Lightning Warning for Gachibowli',
        summary: 'Intense thunderstorm with 88% lightning risk approaching Gachibowli & Financial District. Take shelter immediately.',
        areas: 'Gachibowli, Financial District, Nanakramguda, HITEC City',
        voice: 'Warning issued! Severe thunderstorm warning sent to citizens. Expected arrival within 22 minutes. Take shelter immediately.'
      }
    },

    'dataset-5': {
      id: 'dataset-5',
      name: 'HITEC City Supercell Track',
      scenarioTime: '15:00 IST',
      subtitle: 'Extreme Impact Scenario',
      category: 'EXTREME SUPERCELL OUTBREAK',
      isExtreme: true,
      hasSevereLightning: true,
      isHazard: true,
      targetArea: 'HITEC City, Madhapur & Kondapur',
      etaMinutes: '12 Minutes',
      probPercent: '98%',
      nwp: {
        temp: ['31.5°C', '32.4°C', '33.2°C', '34.0°C', '34.5°C'],
        hum: ['76%', '79%', '82%', '84%', '86%'],
        cape: ['1,800 J/kg', '2,400 J/kg', '3,050 J/kg', '3,500 J/kg', '3,850 J/kg'],
        li: ['-4.2', '-5.5', '-6.8', '-7.7', '-8.4'],
        shear: ['20 m/s', '24 m/s', '27 m/s', '30 m/s', '32 m/s'],
        check: 'Extreme Atmospheric CAPE, Helicity & Wind Shear',
        result: 'Extreme boundary destabilization. CAPE 3,850 J/kg with supercell helicity.',
        decision: 'Extreme Outbreak Fuel Alert Generated',
        action: 'Triggering Satellite Analysis →',
        badge: '✓ EXTREME FUEL ALERT',
        trigger: 'TRIGGERING SATELLITE ANALYSIS...'
      },
      sat: {
        ctt: ['-34.0°C', '-44.5°C', '-54.0°C', '-61.2°C', '-66.8°C'],
        cooling: ['-8.2°C/hr', '-11.5°C/hr', '-14.8°C/hr', '-17.0°C/hr', '-18.5°C/hr'],
        growth: ['Violent Cumulonimbus', 'Overshooting Top', 'Tropopause Penetration', 'Giant Mesocyclone Anvil', 'Extreme Supercell Structure'],
        expansion: ['28 km²/hr', '40 km²/hr', '52 km²/hr', '61 km²/hr', '68 km²/hr'],
        check: 'INSAT-3DR Overshooting Top & Violent Glaciation',
        result: 'Violent cloud top cooling (-18.5°C/hr). Overshooting top penetrates tropopause.',
        decision: 'Supercell Outbreak Alert',
        action: 'Triggering Radar Analysis →',
        badge: '✓ OVERSHOOTING TOP DETECTED',
        trigger: 'TRIGGERING RADAR ANALYSIS...'
      },
      radar: {
        refl: ['42 dBZ', '49 dBZ', '56 dBZ', '61 dBZ', '65 dBZ'],
        echo: ['10.5 km', '12.8 km', '14.9 km', '16.5 km', '17.8 km'],
        velocity: ['36 km/h', '42 km/h', '48 km/h', '52 km/h', '56 km/h'],
        core: ['Mesocyclone Signature', 'Intense Hail Core', 'Bounded Weak Echo Region', 'Microburst Potential', 'Violent 65 dBZ Core'],
        check: 'Radar Mesocyclone, Reflectivity Core & Hail Signature',
        result: '65 dBZ hail core with echo tops reaching 17.8 km over Cyberabad.',
        decision: 'Supercell Outbreak Confirmed',
        action: 'Triggering Lightning Analysis →',
        badge: '✓ 65 dBZ HAIL CORE',
        trigger: 'TRIGGERING LIGHTNING MODEL...'
      },
      lightning: {
        field: ['42 kV/m', '58 kV/m', '74 kV/m', '86 kV/m', '94 kV/m'],
        flash: ['Violent Strike Surge', 'Severe CG Cascade', 'Extreme Strike Frequency', 'Massive Ground Discharge', 'Violent Surge (92 strikes/min)'],
        prob: ['65%', '78%', '88%', '94%', '98%'],
        check: 'Severe Dipole Charge & Lightning Strike Rate Model',
        result: 'Extreme strike surge (98% probability, 92 strikes/minute).',
        decision: 'Extreme Lightning & Microburst Threat',
        action: 'Triggering Movement Prediction →',
        badge: '✓ 98% EXTREME HAZARD',
        trigger: 'TRIGGERING MOVEMENT PREDICTION...'
      },
      movement: {
        speed: ['44 km/h', '48 km/h', '51 km/h', '54 km/h', '56 km/h'],
        dir: ['E (78°)', 'E (80°)', 'E (82°)', 'E (82°)', 'E (82°)'],
        eta: ['22 Mins', '19 Mins', '16 Mins', '14 Mins', '12 Minutes'],
        target: 'HITEC City, Madhapur, Kondapur, Serilingampally',
        check: 'Fast Urban Corridor Vector & High-Density Buffer',
        result: 'Tracking east at 56 km/h directly into Cyberabad IT corridor.',
        decision: 'Emergency Red Alert & Siren Broadcast',
        action: 'Emergency Broadcast Dispatch →',
        badge: '✓ ARRIVAL: 12 MINUTES',
        trigger: 'SOUNDING CIVILIAN SIRENS...'
      },
      warning: {
        time: '15:05 IST',
        issued: true,
        level: 'EXTREME',
        headline: '🚨 EXTREME SUPERCELL & LIGHTNING EMERGENCY WARNING',
        summary: 'Supercell outbreak with violent microburst and 98% lightning probability imminent for HITEC City and Madhapur within 12 mins. TAKE IMMEDIATE SHELTER.',
        areas: 'HITEC City, Madhapur, Kondapur, Serilingampally',
        voice: 'Emergency warning generated! Extreme risk threat. Supercell microburst and severe lightning imminent for HITEC City. Sounding civilian defense sirens.'
      }
    },

    'dataset-6': {
      id: 'dataset-6',
      name: 'Shamshabad Gust Front Event',
      scenarioTime: '16:30 IST',
      subtitle: 'Storm Propagation Scenario',
      category: 'CONVECTIVE GUST FRONT',
      isExtreme: false,
      hasSevereLightning: true,
      isHazard: true,
      targetArea: 'Shamshabad Airport Corridor & Rajendranagar',
      etaMinutes: '18 Minutes',
      probPercent: '82%',
      nwp: {
        temp: ['30.0°C', '30.6°C', '31.2°C', '31.6°C', '32.0°C'],
        hum: ['70%', '72%', '75%', '76%', '78%'],
        cape: ['1,500 J/kg', '1,900 J/kg', '2,250 J/kg', '2,580 J/kg', '2,820 J/kg'],
        li: ['-2.8', '-3.6', '-4.4', '-5.0', '-5.6'],
        shear: ['15 m/s', '18 m/s', '20 m/s', '22 m/s', '24 m/s'],
        check: 'Thermodynamics & Outflow Boundary Convergence',
        result: 'Squall line pre-convective conditions. CAPE 2,820 J/kg.',
        decision: 'Squall Line Fuel Alert Generated',
        action: 'Triggering Satellite Analysis →',
        badge: '✓ FUEL ALERT GENERATED',
        trigger: 'TRIGGERING SATELLITE ANALYSIS...'
      },
      sat: {
        ctt: ['-26.0°C', '-34.2°C', '-41.8°C', '-47.5°C', '-52.0°C'],
        cooling: ['-5.2°C/hr', '-7.4°C/hr', '-9.1°C/hr', '-10.4°C/hr', '-11.5°C/hr'],
        growth: ['Organized Linear Band', 'Squall Arc', 'Extending Gust Line', 'Linear Cloud Growth', 'Organized Squall Line'],
        expansion: ['22 km²/hr', '32 km²/hr', '41 km²/hr', '48 km²/hr', '54 km²/hr'],
        check: 'INSAT-3DR Linear Convective Cloud Banding',
        result: 'Rapid linear cloud cooling (-11.5°C/hr) forming 32 km squall arc.',
        decision: 'Squall Line Formation Alert',
        action: 'Triggering Radar Analysis →',
        badge: '✓ SQUALL BAND DETECTED',
        trigger: 'TRIGGERING RADAR ANALYSIS...'
      },
      radar: {
        refl: ['36 dBZ', '44 dBZ', '50 dBZ', '55 dBZ', '58 dBZ'],
        echo: ['7.2 km', '9.4 km', '11.2 km', '12.8 km', '13.8 km'],
        velocity: ['30 km/h', '36 km/h', '41 km/h', '45 km/h', '48 km/h'],
        core: ['Linear Arc', 'Bow Echo Forming', 'Gust Front 74 km/h', 'Intense Squall Line', 'Bow Echo (58 dBZ)'],
        check: 'Bow Echo Signature, Gust Front & Radial Velocity',
        result: 'Bow echo signature (58 dBZ) with 74 km/h leading gust front.',
        decision: 'Severe Bow Echo Hazard Confirmed',
        action: 'Triggering Lightning Analysis →',
        badge: '✓ 58 dBZ BOW ECHO',
        trigger: 'TRIGGERING LIGHTNING MODEL...'
      },
      lightning: {
        field: ['26 kV/m', '36 kV/m', '46 kV/m', '52 kV/m', '58 kV/m'],
        flash: ['High Strike Surge', 'Linear CG Density', 'Frequent Strikes', 'Gust Lightning', 'Severe Strike Threat (58/min)'],
        prob: ['42%', '56%', '68%', '76%', '82%'],
        check: 'Charge Separation Along Leading Gust Front',
        result: 'High strike rate (82% probability) concentrated along gust front.',
        decision: 'Severe Gust Lightning Hazard',
        action: 'Triggering Movement Prediction →',
        badge: '✓ 82% GUST LIGHTNING',
        trigger: 'TRIGGERING MOVEMENT PREDICTION...'
      },
      movement: {
        speed: ['36 km/h', '40 km/h', '43 km/h', '46 km/h', '48 km/h'],
        dir: ['NE (42°)', 'NE (44°)', 'NE (45°)', 'NE (45°)', 'NE (45°)'],
        eta: ['28 Mins', '25 Mins', '22 Mins', '20 Mins', '18 Minutes'],
        target: 'Shamshabad Airport Corridor, Rajendranagar, Falaknuma',
        check: 'Vector Extrapolation & Runway Approach Path',
        result: 'Advancing northeast at 48 km/h directly toward Airport runway.',
        decision: 'Aviation Ground Stop & Civilian Warning',
        action: 'Issuing Public Warning →',
        badge: '✓ ARRIVAL: 18 MINUTES',
        trigger: 'ISSUING AIRPORT & CITY WARNING...'
      },
      warning: {
        time: '16:35 IST',
        issued: true,
        level: 'SEVERE',
        headline: '⚠ Severe Squall & Lightning Warning for Shamshabad',
        summary: 'Approaching bow echo and 74 km/h gust front with 82% lightning risk toward RGIA Shamshabad in 18 mins. Aviation ground stop advised.',
        areas: 'Shamshabad Airport Corridor, Rajendranagar, Falaknuma',
        voice: 'Warning issued! Severe squall line and lightning approaching Shamshabad and Airport runway. Expected arrival in 18 minutes.'
      }
    },

    'dataset-7': {
      id: 'dataset-7',
      name: 'Secunderabad Lightning Corridor',
      scenarioTime: '17:15 IST',
      subtitle: 'Urban Lightning Scenario',
      category: 'URBAN LIGHTNING CORRIDOR',
      isExtreme: false,
      hasSevereLightning: true,
      isHazard: true,
      targetArea: 'Secunderabad Station, Malkajgiri & Alwal',
      etaMinutes: '16 Minutes',
      probPercent: '85%',
      nwp: {
        temp: ['29.8°C', '30.3°C', '30.8°C', '31.1°C', '31.4°C'],
        hum: ['72%', '74%', '77%', '79%', '80%'],
        cape: ['1,350 J/kg', '1,720 J/kg', '2,050 J/kg', '2,320 J/kg', '2,520 J/kg'],
        li: ['-2.9', '-3.7', '-4.3', '-4.9', '-5.4'],
        shear: ['14 m/s', '17 m/s', '19 m/s', '21 m/s', '22 m/s'],
        check: 'Temperature, Relative Humidity & Instability',
        result: 'Urban thermal heat island convergence. CAPE 2,520 J/kg.',
        decision: 'Urban Convective Fuel Alert Generated',
        action: 'Triggering Satellite Analysis →',
        badge: '✓ FUEL ALERT GENERATED',
        trigger: 'TRIGGERING SATELLITE ANALYSIS...'
      },
      sat: {
        ctt: ['-22.5°C', '-31.0°C', '-38.4°C', '-44.2°C', '-49.6°C'],
        cooling: ['-4.8°C/hr', '-6.9°C/hr', '-8.4°C/hr', '-9.5°C/hr', '-10.2°C/hr'],
        growth: ['Urban Convective Cell', 'Rapid Anvil Formation', 'Active Core', 'Intense Cloud Top', 'Mature Urban Cell'],
        expansion: ['14 km²/hr', '21 km²/hr', '28 km²/hr', '34 km²/hr', '38 km²/hr'],
        check: 'INSAT-3DR Cooling Rate & Cloud Area',
        result: 'Rapid cloud top cooling (-10.2°C/hr) centered over Northern Cantonment.',
        decision: 'Convective Cell Development Alert',
        action: 'Triggering Radar Analysis →',
        badge: '✓ RAPID CLOUD EXPANSION',
        trigger: 'TRIGGERING RADAR ANALYSIS...'
      },
      radar: {
        refl: ['30 dBZ', '38 dBZ', '44 dBZ', '49 dBZ', '52 dBZ'],
        echo: ['6.8 km', '8.9 km', '10.8 km', '12.2 km', '13.2 km'],
        velocity: ['26 km/h', '31 km/h', '35 km/h', '38 km/h', '40 km/h'],
        core: ['Developing Cell', 'Precip Arc', 'Strong Core', 'Dense Hydrometeors', 'Convective Core (52 dBZ)'],
        check: 'Core Reflectivity & Echo Top Velocity',
        result: '52 dBZ core reflectivity reaching 13.2 km echo top over Secunderabad.',
        decision: 'Active Thunderstorm Verified',
        action: 'Triggering Lightning Analysis →',
        badge: '✓ 52 dBZ CORE VERIFIED',
        trigger: 'TRIGGERING LIGHTNING MODEL...'
      },
      lightning: {
        field: ['24 kV/m', '36 kV/m', '48 kV/m', '56 kV/m', '62 kV/m'],
        flash: ['High Strike Surge', 'Frequent Ground Strikes', 'High CG Density', 'Active Corridor', 'Severe Lightning (54 strikes/min)'],
        prob: ['40%', '55%', '69%', '78%', '85%'],
        check: 'Electric Field & Cloud-to-Ground Strike Potential',
        result: 'High-density strike corridor (85% probability, 54 strikes/minute).',
        decision: 'Urban Lightning Hazard Warning',
        action: 'Triggering Movement Prediction →',
        badge: '✓ 85% URBAN LIGHTNING',
        trigger: 'TRIGGERING MOVEMENT PREDICTION...'
      },
      movement: {
        speed: ['30 km/h', '34 km/h', '37 km/h', '39 km/h', '40 km/h'],
        dir: ['NNE (30°)', 'NNE (30°)', 'NNE (32°)', 'NNE (32°)', 'NNE (32°)'],
        eta: ['26 Mins', '23 Mins', '20 Mins', '18 Mins', '16 Minutes'],
        target: 'Secunderabad Station, Malkajgiri, Alwal, Tarnaka',
        check: 'Centroid Vector Extrapolation & Railway Transit Buffer',
        result: 'Tracking north-northeast at 40 km/h along Secunderabad corridor.',
        decision: 'Urban Lightning Warning Dispatched',
        action: 'Issuing Public Warning →',
        badge: '✓ ARRIVAL: 16 MINUTES',
        trigger: 'DISPATCHING EMERGENCY ALERT...'
      },
      warning: {
        time: '17:20 IST',
        issued: true,
        level: 'SEVERE',
        headline: '⚠ Severe Lightning Warning for Secunderabad Corridor',
        summary: 'High-density lightning corridor with 85% strike probability approaching Secunderabad and Malkajgiri within 16 mins. Seek immediate shelter.',
        areas: 'Secunderabad Station, Malkajgiri, Alwal, Tarnaka',
        voice: 'Warning issued! Severe lightning warning for Secunderabad and Malkajgiri. Expected arrival in 16 minutes. Take shelter indoors.'
      }
    }
  });

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

    clearAllCascadeTimeouts();
    isCascading = false;

    // Reset Whole-Day Event Timeline
    updateWholeDayTimeline('08:00 IST', 'Stable Atmospheric Conditions Across Hyderabad', 0, 0, false);

    // Reset Innovation Highlights
    if (DOM.innovationCards) {
      DOM.innovationCards.forEach((c) => c.classList.remove('jury-highlight'));
    }

    // Reset Legacy & Storytelling Cards
    const allStageCards = [
      DOM.cardNwp, DOM.cardSat, DOM.cardRadar, DOM.cardLightning, DOM.cardTracking, DOM.cardWeakening
    ];
    allStageCards.forEach((c) => {
      if (c) c.className = 'story-stage-card stage-idle';
    });

    if (DOM.emergencyBypassNotice) DOM.emergencyBypassNotice.style.display = 'none';
    if (DOM.severeLightningModal) DOM.severeLightningModal.style.display = 'none';

    // Reset Stage Status Badges
    if (DOM.badgeStatuses) {
      const defaultBadgeText = [
        '🟡 AWAITING TRIGGER',
        '🟠 AWAITING TRIGGER',
        '🔴 AWAITING TRIGGER',
        '⚡ AWAITING TRIGGER',
        '🌩️ AWAITING TRIGGER',
        '💨 AWAITING TRIGGER'
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
    if (DOM.chipWeakening) DOM.chipWeakening.style.display = 'none';

    // Reset Progress Bars
    if (DOM.statusNwpText) DOM.statusNwpText.textContent = 'STATUS: Awaiting Activation';
    if (DOM.progBarNwp) DOM.progBarNwp.style.width = '0%';
    if (DOM.progPctNwp) DOM.progPctNwp.textContent = '0%';

    if (DOM.statusSatText) DOM.statusSatText.textContent = 'STATUS: Standby (Awaiting Fuel Alert)';
    if (DOM.progBarSat) DOM.progBarSat.style.width = '0%';
    if (DOM.progPctSat) DOM.progPctSat.textContent = '0%';

    if (DOM.statusRadarText) DOM.statusRadarText.textContent = 'STATUS: Standby (Awaiting Satellite Trigger)';
    if (DOM.progBarRadar) DOM.progBarRadar.style.width = '0%';
    if (DOM.progPctRadar) DOM.progPctRadar.textContent = '0%';

    if (DOM.statusLightningText) DOM.statusLightningText.textContent = 'STATUS: Standby (Awaiting Radar Confirmation)';
    if (DOM.progBarLightning) DOM.progBarLightning.style.width = '0%';
    if (DOM.progPctLightning) DOM.progPctLightning.textContent = '0%';

    if (DOM.statusTrackingText) DOM.statusTrackingText.textContent = 'STATUS: Standby (Awaiting Threat Confirmation)';
    if (DOM.progBarTracking) DOM.progBarTracking.style.width = '0%';
    if (DOM.progPctTracking) DOM.progPctTracking.textContent = '0%';

    if (DOM.statusWeakText) DOM.statusWeakText.textContent = 'STATUS: Standby (Awaiting Storm Peak)';
    if (DOM.progBarWeakening) DOM.progBarWeakening.style.width = '0%';
    if (DOM.progPctWeakening) DOM.progPctWeakening.textContent = '0%';

    // Reset Decision Matrix
    if (DOM.cdmCheckNwp) DOM.cdmCheckNwp.textContent = 'Temperature, Humidity, Instability, CAPE, Wind Shear';
    if (DOM.cdmResNwp) DOM.cdmResNwp.textContent = 'Reading atmospheric soundings... Awaiting threshold breach';
    if (DOM.cdmDecNwp) DOM.cdmDecNwp.textContent = 'Standby Monitoring';
    if (DOM.cdmActNwp) DOM.cdmActNwp.textContent = 'Awaiting thermodynamic destabilization';

    if (DOM.cdmCheckSat) DOM.cdmCheckSat.textContent = 'Cloud Cooling, Cloud Expansion, Tropopause Penetration';
    if (DOM.cdmResSat) DOM.cdmResSat.textContent = 'Standby: Awaiting stage 1 Fuel Alert trigger';
    if (DOM.cdmDecSat) DOM.cdmDecSat.textContent = 'Standby';
    if (DOM.cdmActSat) DOM.cdmActSat.textContent = 'Heavy infrared radiometric models idle';

    if (DOM.cdmCheckRadar) DOM.cdmCheckRadar.textContent = 'Core Reflectivity, Echo Top, Vertically Integrated Liquid (VIL)';
    if (DOM.cdmResRadar) DOM.cdmResRadar.textContent = 'Doppler surveillance on standby awaiting satellite validation';
    if (DOM.cdmDecRadar) DOM.cdmDecRadar.textContent = 'Standby';
    if (DOM.cdmActRadar) DOM.cdmActRadar.textContent = 'Volume scan sweeps hold until convective core initiated';

    if (DOM.cdmCheckLightning) DOM.cdmCheckLightning.textContent = 'Electric Field Gradient, Mixed-Phase Hydrometeors, Ground Charge';
    if (DOM.cdmResLightning) DOM.cdmResLightning.textContent = 'Awaiting mature convective cell confirmation';
    if (DOM.cdmDecLightning) DOM.cdmDecLightning.textContent = 'Standby';
    if (DOM.cdmActLightning) DOM.cdmActLightning.textContent = 'XGBoost electrification tensor models primed';

    if (DOM.cdmCheckTracking) DOM.cdmCheckTracking.textContent = 'Cell Advection Velocity, Extrapolation Vectors, Street Geofences';
    if (DOM.cdmResTracking) DOM.cdmResTracking.textContent = 'Awaiting kinematic trajectory calculation';
    if (DOM.cdmDecTracking) DOM.cdmDecTracking.textContent = 'Standby';
    if (DOM.cdmActTracking) DOM.cdmActTracking.textContent = 'Generating localized polygon hazard zones';

    if (DOM.cdmCheckWeak) DOM.cdmCheckWeak.textContent = 'Updraft Dissipation, Rain Downpour Rate, Flash Density Decoupling';
    if (DOM.cdmResWeak) DOM.cdmResWeak.textContent = 'Awaiting peak core collapse and cold pool spread';
    if (DOM.cdmDecWeak) DOM.cdmDecWeak.textContent = 'Standby';
    if (DOM.cdmActWeak) DOM.cdmActWeak.textContent = 'Broadcasting civil defense warnings & safe routes';

    // Baseline Ticker Values
    if (DOM.tickerTemp) DOM.tickerTemp.textContent = dataset.nwp.temp[0];
    if (DOM.tickerHumidity) DOM.tickerHumidity.textContent = dataset.nwp.hum[0];
    if (DOM.tickerCape) DOM.tickerCape.textContent = dataset.nwp.cape[0];
    if (DOM.tickerLifted) DOM.tickerLifted.textContent = dataset.nwp.li[0];
    if (DOM.tickerShear) DOM.tickerShear.textContent = dataset.nwp.shear[0];

    if (DOM.tickerCtt) DOM.tickerCtt.textContent = dataset.sat.ctt[0];
    if (DOM.tickerCooling) DOM.tickerCooling.textContent = dataset.sat.cooling[0];
    if (DOM.tickerConvective) DOM.tickerConvective.textContent = dataset.sat.growth[0];
    if (DOM.tickerExpansion) DOM.tickerExpansion.textContent = dataset.sat.expansion[0];

    if (DOM.tickerRefl) DOM.tickerRefl.textContent = dataset.radar.refl[0];
    if (DOM.tickerEcho) DOM.tickerEcho.textContent = dataset.radar.echo[0];
    if (DOM.tickerCell) DOM.tickerCell.textContent = dataset.radar.velocity[0];
    if (DOM.tickerIntensity) DOM.tickerIntensity.textContent = dataset.radar.core[0];

    if (DOM.tickerCharge) DOM.tickerCharge.textContent = dataset.lightning.field[0];
    if (DOM.tickerGraupel) DOM.tickerGraupel.textContent = dataset.lightning.flash[0];
    if (DOM.tickerProb) DOM.tickerProb.textContent = dataset.lightning.prob[0];

    if (DOM.trackSpeed) DOM.trackSpeed.textContent = dataset.movement.speed[0];
    if (DOM.trackDirection) DOM.trackDirection.textContent = dataset.movement.dir[0];
    if (DOM.trackCurrLoc) DOM.trackCurrLoc.textContent = dataset.movement.target;

    // Reset Top Warning Issued Card (Image 1)
    if (DOM.topWarningIssuedCard) DOM.topWarningIssuedCard.style.display = 'none';

    // Reset Top 4-KPI Row (Image 4 & 5)
    if (DOM.kpiRiskVal) {
      DOM.kpiRiskVal.textContent = 'LOW 11%';
      DOM.kpiRiskVal.className = 'kpi-value text-emerald';
    }
    if (DOM.kpiRiskDot) DOM.kpiRiskDot.classList.remove('danger');
    if (DOM.kpiRiskSub) DOM.kpiRiskSub.textContent = 'Normal environmental baseline. No active flood or lightning threat detected.';
    if (DOM.kpiActiveAlerts) DOM.kpiActiveAlerts.textContent = '0';
    if (DOM.kpiCitizensRisk) DOM.kpiCitizensRisk.textContent = '0';
    if (DOM.kpiSmsLogs) DOM.kpiSmsLogs.textContent = '0';

    // Reset Citizen Portal (Image 3)
    if (DOM.cStatusTopCard) DOM.cStatusTopCard.classList.remove('danger');
    if (DOM.cTopStatusText) DOM.cTopStatusText.textContent = 'NORMAL';
    if (DOM.cTopStatusDot) DOM.cTopStatusDot.classList.remove('danger');
    if (DOM.cTopStatusIcon) DOM.cTopStatusIcon.textContent = '✓';
    if (DOM.cTopHeadline) DOM.cTopHeadline.textContent = 'HYDERABAD URBAN SECTOR SAFE';
    if (DOM.cTopDesc) DOM.cTopDesc.textContent = 'Zero active emergency warnings.';
    if (DOM.cNavMode) DOM.cNavMode.textContent = 'PREPAREDNESS MODE';
    if (DOM.cShelterDist) DOM.cShelterDist.textContent = '1.8 km away (~14 min)';
    if (DOM.cShelterTitle) DOM.cShelterTitle.textContent = 'Gachibowli High Ground Shelter';
    if (DOM.cShelterDesc) DOM.cShelterDesc.textContent = 'Elevated bedrock ridge, zero debris accumulation vector';

    if (DOM.citizenRedAlertCard) DOM.citizenRedAlertCard.style.display = 'none';
    if (DOM.citizenWarningPopup) DOM.citizenWarningPopup.style.display = 'none';

    // Hero banner status
    if (DOM.heroStatusPill) DOM.heroStatusPill.classList.remove('active');
    if (DOM.heroStatusText) DOM.heroStatusText.textContent = 'STANDBY';

    // Sync GIS map to idle baseline
    syncMapStage(0);

    // Initial timeline step
    DOM.timelineSteps.forEach((node) => node.classList.remove('active', 'completed'));
    if (DOM.timelineSteps[0]) DOM.timelineSteps[0].classList.add('active');
  }

  function startCascadingSimulation(datasetId) {
    if (datasetId && DATASETS[datasetId]) {
      activeDatasetKey = datasetId;
    }
    const dataset = DATASETS[activeDatasetKey] || DATASETS['dataset-1'];

    clearAllCascadeTimeouts();
    isCascading = true;
    resetCascadeCards(activeDatasetKey);

    // Base Stage Duration calculated from Speed Multiplier
    const stageDuration = Math.round(7500 / simSpeedMultiplier);
    const transGap = Math.round(500 / simSpeedMultiplier);

    if (DOM.btnStartSimulationHero) {
      DOM.btnStartSimulationHero.classList.add('running');
      DOM.btnStartSimulationHero.innerHTML = '<span class="btn-hero-icon">⏳</span> EVALUATING: ' + dataset.name.toUpperCase();
      DOM.btnStartSimulationHero.disabled = true;
    }
    if (DOM.btnStartCascade) {
      DOM.btnStartCascade.innerHTML = '<span class="btn-icon">⏳</span> RUNNING: ' + dataset.name.toUpperCase();
      DOM.btnStartCascade.disabled = true;
    }
    if (DOM.heroStatusPill) DOM.heroStatusPill.classList.add('active');
    if (DOM.heroStatusText) DOM.heroStatusText.textContent = 'CASCADING WORKFLOW RUNNING (' + simSpeedMultiplier + 'x SPEED)';

    // =========================================================================
    // 1. FUEL BUILDING 🔥 (NWP / Weather Models)
    // Physical Mechanism: Air becomes hot + moist and unstable
    // =========================================================================
    if (DOM.cardNwp) DOM.cardNwp.className = 'story-stage-card stage-running';
    if (DOM.statusNwpText) DOM.statusNwpText.textContent = 'Reading Soundings... Destabilizing';
    if (DOM.progBarNwp) DOM.progBarNwp.style.width = '0%';
    if (DOM.progPctNwp) DOM.progPctNwp.textContent = '0%';

    updateWholeDayTimeline('09:00 IST', 'Stage 1: Fuel Building — Air Becoming Hot & Moist', 11, 1, false);
    highlightInnovationCard('prior');
    speakAnnouncement('Stage 1: Numerical Weather Prediction evaluating fuel building. Air is heating and destabilizing.');
    setStep(0);
    syncMapStage(0);

    // NWP Ticker Sub-Steps
    queueTimeout(() => {
      if (DOM.progBarNwp) DOM.progBarNwp.style.width = '25%';
      if (DOM.progPctNwp) DOM.progPctNwp.textContent = '25%';
      if (DOM.tickerTemp) DOM.tickerTemp.textContent = dataset.nwp.temp[1];
      if (DOM.tickerHumidity) DOM.tickerHumidity.textContent = dataset.nwp.hum[1];
      if (DOM.tickerCape) DOM.tickerCape.textContent = dataset.nwp.cape[1];
      if (DOM.tickerLifted) DOM.tickerLifted.textContent = dataset.nwp.li[1];
      if (DOM.tickerShear) DOM.tickerShear.textContent = dataset.nwp.shear[1];
    }, Math.round(stageDuration * 0.25));

    queueTimeout(() => {
      if (DOM.progBarNwp) DOM.progBarNwp.style.width = '55%';
      if (DOM.progPctNwp) DOM.progPctNwp.textContent = '55%';
      if (DOM.tickerTemp) DOM.tickerTemp.textContent = dataset.nwp.temp[2];
      if (DOM.tickerHumidity) DOM.tickerHumidity.textContent = dataset.nwp.hum[2];
      if (DOM.tickerCape) DOM.tickerCape.textContent = dataset.nwp.cape[2];
      if (DOM.tickerLifted) DOM.tickerLifted.textContent = dataset.nwp.li[2];
      if (DOM.tickerShear) DOM.tickerShear.textContent = dataset.nwp.shear[2];
    }, Math.round(stageDuration * 0.55));

    queueTimeout(() => {
      if (DOM.progBarNwp) DOM.progBarNwp.style.width = '80%';
      if (DOM.progPctNwp) DOM.progPctNwp.textContent = '80%';
      if (DOM.tickerTemp) DOM.tickerTemp.textContent = dataset.nwp.temp[3];
      if (DOM.tickerHumidity) DOM.tickerHumidity.textContent = dataset.nwp.hum[3];
      if (DOM.tickerCape) DOM.tickerCape.textContent = dataset.nwp.cape[3];
      if (DOM.tickerLifted) DOM.tickerLifted.textContent = dataset.nwp.li[3];
      if (DOM.tickerShear) DOM.tickerShear.textContent = dataset.nwp.shear[3];
    }, Math.round(stageDuration * 0.8));

    // STAGE 1 COMPLETION: Detects Fuel Building (Evolving stage) -> Triggers Stage 2
    queueTimeout(() => {
      if (DOM.progBarNwp) DOM.progBarNwp.style.width = '100%';
      if (DOM.progPctNwp) DOM.progPctNwp.textContent = '100%';
      if (DOM.tickerTemp) DOM.tickerTemp.textContent = dataset.nwp.temp[4];
      if (DOM.tickerHumidity) DOM.tickerHumidity.textContent = dataset.nwp.hum[4];
      if (DOM.tickerCape) DOM.tickerCape.textContent = dataset.nwp.cape[4];
      if (DOM.tickerLifted) DOM.tickerLifted.textContent = dataset.nwp.li[4];
      if (DOM.tickerShear) DOM.tickerShear.textContent = dataset.nwp.shear[4];

      if (DOM.statusNwpText) DOM.statusNwpText.textContent = 'STATUS: ✓ 1. FUEL BUILDING DETECTED';
      if (DOM.cardNwp) DOM.cardNwp.className = 'story-stage-card stage-complete';

      const alertChipNwp = document.getElementById('chip-nwp');
      const condNwp = document.getElementById('cond-nwp');
      if (alertChipNwp) alertChipNwp.style.display = 'inline-flex';
      if (condNwp) condNwp.style.display = 'inline-flex';

      const handoffCompNwp = document.getElementById('handoff-comp-nwp');
      const handoffTrigNwp = document.getElementById('handoff-trig-nwp');
      if (handoffCompNwp) handoffCompNwp.textContent = 'STAGE 1 COMPLETED';
      if (handoffTrigNwp) handoffTrigNwp.textContent = 'TRIGGERING INSAT SATELLITE...';

      if (DOM.cdmCheckNwp) DOM.cdmCheckNwp.textContent = dataset.nwp.check;
      if (DOM.cdmResNwp) DOM.cdmResNwp.textContent = dataset.nwp.result;
      if (DOM.cdmDecNwp) DOM.cdmDecNwp.textContent = dataset.nwp.decision;
      if (DOM.cdmActNwp) DOM.cdmActNwp.textContent = dataset.nwp.action;

      updateWholeDayTimeline('11:00 IST', 'Fuel Building Confirmed (Evolving Stage Detected)', 33, 3, false);
      syncMapStage(1);
      speakAnnouncement('Fuel Building detected. Air is hot, moist, and unstable. Evolving stage confirmed. Triggering INSAT Satellite automatically.');

      // AUTOMATICALLY TRIGGER STAGE 2
      runStage2();
    }, stageDuration);

    // =========================================================================
    // 2. CLOUD GROWING ☁️ (INSAT Satellite)
    // Physical Mechanism: Cloud starts rising rapidly
    // =========================================================================
    function runStage2() {
      queueTimeout(() => {
        if (DOM.cardNwp) DOM.cardNwp.className = 'story-stage-card stage-complete';
        if (DOM.cardSat) DOM.cardSat.className = 'story-stage-card stage-running';
        if (DOM.statusSatText) DOM.statusSatText.textContent = 'Scanning Cloud Tops... Vertical Ascent';
        if (DOM.progBarSat) DOM.progBarSat.style.width = '0%';
        if (DOM.progPctSat) DOM.progPctSat.textContent = '0%';

        updateWholeDayTimeline('12:00 IST', 'Stage 2: Cloud Growing — Cloud Rising Rapidly', 44, 4, false);
        highlightInnovationCard('relay');
        setStep(1);

        queueTimeout(() => {
          if (DOM.progBarSat) DOM.progBarSat.style.width = '25%';
          if (DOM.progPctSat) DOM.progPctSat.textContent = '25%';
          if (DOM.tickerCtt) DOM.tickerCtt.textContent = dataset.sat.ctt[1];
          if (DOM.tickerCooling) DOM.tickerCooling.textContent = dataset.sat.cooling[1];
          if (DOM.tickerConvective) DOM.tickerConvective.textContent = dataset.sat.growth[1];
          if (DOM.tickerExpansion) DOM.tickerExpansion.textContent = dataset.sat.expansion[1];
        }, Math.round(stageDuration * 0.25));

        queueTimeout(() => {
          if (DOM.progBarSat) DOM.progBarSat.style.width = '55%';
          if (DOM.progPctSat) DOM.progPctSat.textContent = '55%';
          if (DOM.tickerCtt) DOM.tickerCtt.textContent = dataset.sat.ctt[2];
          if (DOM.tickerCooling) DOM.tickerCooling.textContent = dataset.sat.cooling[2];
          if (DOM.tickerConvective) DOM.tickerConvective.textContent = dataset.sat.growth[2];
          if (DOM.tickerExpansion) DOM.tickerExpansion.textContent = dataset.sat.expansion[2];
        }, Math.round(stageDuration * 0.55));

        queueTimeout(() => {
          if (DOM.progBarSat) DOM.progBarSat.style.width = '80%';
          if (DOM.progPctSat) DOM.progPctSat.textContent = '80%';
          if (DOM.tickerCtt) DOM.tickerCtt.textContent = dataset.sat.ctt[3];
          if (DOM.tickerCooling) DOM.tickerCooling.textContent = dataset.sat.cooling[3];
          if (DOM.tickerConvective) DOM.tickerConvective.textContent = dataset.sat.growth[3];
          if (DOM.tickerExpansion) DOM.tickerExpansion.textContent = dataset.sat.expansion[3];
        }, Math.round(stageDuration * 0.8));

        // STAGE 2 COMPLETION: Detects Cloud Growing -> Triggers Stage 3
        queueTimeout(() => {
          if (DOM.progBarSat) DOM.progBarSat.style.width = '100%';
          if (DOM.progPctSat) DOM.progPctSat.textContent = '100%';
          if (DOM.tickerCtt) DOM.tickerCtt.textContent = dataset.sat.ctt[4];
          if (DOM.tickerCooling) DOM.tickerCooling.textContent = dataset.sat.cooling[4];
          if (DOM.tickerConvective) DOM.tickerConvective.textContent = dataset.sat.growth[4];
          if (DOM.tickerExpansion) DOM.tickerExpansion.textContent = dataset.sat.expansion[4];

          if (DOM.statusSatText) DOM.statusSatText.textContent = 'STATUS: ✓ 2. CLOUD GROWING DETECTED';
          if (DOM.cardSat) DOM.cardSat.className = 'story-stage-card stage-complete';

          const chipSat = document.getElementById('chip-sat');
          const condSat = document.getElementById('cond-sat');
          if (chipSat) chipSat.style.display = 'inline-flex';
          if (condSat) condSat.style.display = 'inline-flex';

          const handoffCompSat = document.getElementById('handoff-comp-sat');
          const handoffTrigSat = document.getElementById('handoff-trig-sat');
          if (handoffCompSat) handoffCompSat.textContent = 'STAGE 2 COMPLETED';
          if (handoffTrigSat) handoffTrigSat.textContent = 'TRIGGERING DOPPLER RADAR...';

          if (DOM.cdmCheckSat) DOM.cdmCheckSat.textContent = dataset.sat.check;
          if (DOM.cdmResSat) DOM.cdmResSat.textContent = dataset.sat.result;
          if (DOM.cdmDecSat) DOM.cdmDecSat.textContent = dataset.sat.decision;
          if (DOM.cdmActSat) DOM.cdmActSat.textContent = dataset.sat.action;

          syncMapStage(2);
          speakAnnouncement('Cloud Growing detected. Cloud rising rapidly. Triggering Doppler Radar automatically.');

          // AUTOMATICALLY TRIGGER STAGE 3
          runStage3();
        }, stageDuration);
      }, transGap);
    }

    // =========================================================================
    // 3. STORM GROWING ⬆️ (Satellite + Radar)
    // Physical Mechanism: Cloud becomes tall, strong updrafts/ice develop
    // =========================================================================
    function runStage3() {
      queueTimeout(() => {
        if (DOM.cardSat) DOM.cardSat.className = 'story-stage-card stage-complete';
        if (DOM.cardRadar) DOM.cardRadar.className = 'story-stage-card stage-running';
        if (DOM.statusRadarText) DOM.statusRadarText.textContent = 'Radar Volume Scan... Detecting Core';
        if (DOM.progBarRadar) DOM.progBarRadar.style.width = '0%';
        if (DOM.progPctRadar) DOM.progPctRadar.textContent = '0%';

        updateWholeDayTimeline('13:00 IST', 'Stage 3: Storm Growing — Tall Cloud & Updrafts Developed', 55, 5, false);
        highlightInnovationCard('relay');
        setStep(2);

        queueTimeout(() => {
          if (DOM.progBarRadar) DOM.progBarRadar.style.width = '25%';
          if (DOM.progPctRadar) DOM.progPctRadar.textContent = '25%';
          if (DOM.tickerRefl) DOM.tickerRefl.textContent = dataset.radar.refl[1];
          if (DOM.tickerEcho) DOM.tickerEcho.textContent = dataset.radar.echo[1];
          if (DOM.tickerCell) DOM.tickerCell.textContent = dataset.radar.velocity[1];
          if (DOM.tickerIntensity) DOM.tickerIntensity.textContent = dataset.radar.core[1];
        }, Math.round(stageDuration * 0.25));

        queueTimeout(() => {
          if (DOM.progBarRadar) DOM.progBarRadar.style.width = '55%';
          if (DOM.progPctRadar) DOM.progPctRadar.textContent = '55%';
          if (DOM.tickerRefl) DOM.tickerRefl.textContent = dataset.radar.refl[2];
          if (DOM.tickerEcho) DOM.tickerEcho.textContent = dataset.radar.echo[2];
          if (DOM.tickerCell) DOM.tickerCell.textContent = dataset.radar.velocity[2];
          if (DOM.tickerIntensity) DOM.tickerIntensity.textContent = dataset.radar.core[2];
        }, Math.round(stageDuration * 0.55));

        queueTimeout(() => {
          if (DOM.progBarRadar) DOM.progBarRadar.style.width = '80%';
          if (DOM.progPctRadar) DOM.progPctRadar.textContent = '80%';
          if (DOM.tickerRefl) DOM.tickerRefl.textContent = dataset.radar.refl[3];
          if (DOM.tickerEcho) DOM.tickerEcho.textContent = dataset.radar.echo[3];
          if (DOM.tickerCell) DOM.tickerCell.textContent = dataset.radar.velocity[3];
          if (DOM.tickerIntensity) DOM.tickerIntensity.textContent = dataset.radar.core[3];
        }, Math.round(stageDuration * 0.8));

        // STAGE 3 COMPLETION: Detects Storm Growing -> Triggers Stage 4
        queueTimeout(() => {
          if (DOM.progBarRadar) DOM.progBarRadar.style.width = '100%';
          if (DOM.progPctRadar) DOM.progPctRadar.textContent = '100%';
          if (DOM.tickerRefl) DOM.tickerRefl.textContent = dataset.radar.refl[4];
          if (DOM.tickerEcho) DOM.tickerEcho.textContent = dataset.radar.echo[4];
          if (DOM.tickerCell) DOM.tickerCell.textContent = dataset.radar.velocity[4];
          if (DOM.tickerIntensity) DOM.tickerIntensity.textContent = dataset.radar.core[4];

          if (DOM.statusRadarText) DOM.statusRadarText.textContent = 'STATUS: ✓ 3. STORM GROWING CONFIRMED';
          if (DOM.cardRadar) DOM.cardRadar.className = 'story-stage-card stage-complete';

          const chipRadar = document.getElementById('chip-radar');
          const condRadar = document.getElementById('cond-radar');
          if (chipRadar) chipRadar.style.display = 'inline-flex';
          if (condRadar) condRadar.style.display = 'inline-flex';

          const handoffCompRadar = document.getElementById('handoff-comp-radar');
          const handoffTrigRadar = document.getElementById('handoff-trig-radar');
          if (handoffCompRadar) handoffCompRadar.textContent = 'STAGE 3 COMPLETED';
          if (handoffTrigRadar) handoffTrigRadar.textContent = 'TRIGGERING LIGHTNING SENSORS...';

          if (DOM.cdmCheckRadar) DOM.cdmCheckRadar.textContent = dataset.radar.check;
          if (DOM.cdmResRadar) DOM.cdmResRadar.textContent = dataset.radar.result;
          if (DOM.cdmDecRadar) DOM.cdmDecRadar.textContent = dataset.radar.decision;
          if (DOM.cdmActRadar) DOM.cdmActRadar.textContent = dataset.radar.action;

          syncMapStage(3);
          speakAnnouncement('Storm Growing detected. Tall cloud with strong updrafts and ice developed. Triggering Lightning Sensors automatically.');

          // AUTOMATICALLY TRIGGER STAGE 4
          runStage4();
        }, stageDuration);
      }, transGap);
    }

    // =========================================================================
    // 4. ELECTRIFYING ⚡ (Lightning Sensors + Radar)
    // Physical Mechanism: Ice/hail collisions create electrical charge
    // =========================================================================
    function runStage4() {
      queueTimeout(() => {
        if (DOM.cardRadar) DOM.cardRadar.className = 'story-stage-card stage-complete';
        if (DOM.cardLightning) DOM.cardLightning.className = 'story-stage-card stage-running';
        if (DOM.statusLightningText) DOM.statusLightningText.textContent = 'Calculating Dipole Charge & Graupel Rate...';
        if (DOM.progBarLightning) DOM.progBarLightning.style.width = '0%';
        if (DOM.progPctLightning) DOM.progPctLightning.textContent = '0%';

        updateWholeDayTimeline('14:00 IST', 'Stage 4: Electrifying — Ice/Hail Collisions Separating Charge', 66, 6, false);
        highlightInnovationCard('sensor');
        setStep(3);

        queueTimeout(() => {
          if (DOM.progBarLightning) DOM.progBarLightning.style.width = '25%';
          if (DOM.progPctLightning) DOM.progPctLightning.textContent = '25%';
          if (DOM.tickerCharge) DOM.tickerCharge.textContent = dataset.lightning.field[1];
          if (DOM.tickerGraupel) DOM.tickerGraupel.textContent = dataset.lightning.flash[1];
          if (DOM.tickerProb) DOM.tickerProb.textContent = dataset.lightning.prob[1];
        }, Math.round(stageDuration * 0.25));

        queueTimeout(() => {
          if (DOM.progBarLightning) DOM.progBarLightning.style.width = '55%';
          if (DOM.progPctLightning) DOM.progPctLightning.textContent = '55%';
          if (DOM.tickerCharge) DOM.tickerCharge.textContent = dataset.lightning.field[2];
          if (DOM.tickerGraupel) DOM.tickerGraupel.textContent = dataset.lightning.flash[2];
          if (DOM.tickerProb) DOM.tickerProb.textContent = dataset.lightning.prob[2];
        }, Math.round(stageDuration * 0.55));

        queueTimeout(() => {
          if (DOM.progBarLightning) DOM.progBarLightning.style.width = '80%';
          if (DOM.progPctLightning) DOM.progPctLightning.textContent = '80%';
          if (DOM.tickerCharge) DOM.tickerCharge.textContent = dataset.lightning.field[3];
          if (DOM.tickerGraupel) DOM.tickerGraupel.textContent = dataset.lightning.flash[3];
          if (DOM.tickerProb) DOM.tickerProb.textContent = dataset.lightning.prob[3];
        }, Math.round(stageDuration * 0.8));

        // STAGE 4 COMPLETION: Detects Electrifying -> Triggers Stage 5
        queueTimeout(() => {
          if (DOM.progBarLightning) DOM.progBarLightning.style.width = '100%';
          if (DOM.progPctLightning) DOM.progPctLightning.textContent = '100%';
          if (DOM.tickerCharge) DOM.tickerCharge.textContent = dataset.lightning.field[4];
          if (DOM.tickerGraupel) DOM.tickerGraupel.textContent = dataset.lightning.flash[4];
          if (DOM.tickerProb) DOM.tickerProb.textContent = dataset.lightning.prob[4];

          if (DOM.statusLightningText) DOM.statusLightningText.textContent = 'STATUS: ✓ 4. ELECTRIFYING DETECTED';
          if (DOM.cardLightning) DOM.cardLightning.className = 'story-stage-card stage-complete';

          const chipLightning = document.getElementById('chip-lightning');
          const condLightning = document.getElementById('cond-lightning');
          if (chipLightning) chipLightning.style.display = 'inline-flex';
          if (condLightning) condLightning.style.display = 'inline-flex';

          const handoffCompLtg = document.getElementById('handoff-comp-lightning');
          const handoffTrigLtg = document.getElementById('handoff-trig-lightning');
          if (handoffCompLtg) handoffCompLtg.textContent = 'STAGE 4 COMPLETED';
          if (handoffTrigLtg) handoffTrigLtg.textContent = 'TRIGGERING ACTIVE STORM MODEL...';

          if (DOM.cdmCheckLightning) DOM.cdmCheckLightning.textContent = dataset.lightning.check;
          if (DOM.cdmResLightning) DOM.cdmResLightning.textContent = dataset.lightning.result;
          if (DOM.cdmDecLightning) DOM.cdmDecLightning.textContent = dataset.lightning.decision;
          if (DOM.cdmActLightning) DOM.cdmActLightning.textContent = dataset.lightning.action;

          syncMapStage(4);
          speakAnnouncement('Electrifying detected. Ice and hail collisions create electrical charge. Triggering Active Storm Model automatically.');

          // AUTOMATICALLY TRIGGER STAGE 5
          runStage5();
        }, stageDuration);
      }, transGap);
    }

    // =========================================================================
    // 5. ACTIVE STORM 🌩️ (Radar + Lightning + Satellite)
    // Physical Mechanism: Lightning + heavy rain + strong winds
    // =========================================================================
    function runStage5() {
      queueTimeout(() => {
        if (DOM.cardLightning) DOM.cardLightning.className = 'story-stage-card stage-complete';
        if (DOM.cardTracking) DOM.cardTracking.className = 'story-stage-card stage-running';
        if (DOM.statusTrackingText) DOM.statusTrackingText.textContent = 'Tracking Advection & High Hazard Winds...';
        if (DOM.progBarTracking) DOM.progBarTracking.style.width = '0%';
        if (DOM.progPctTracking) DOM.progPctTracking.textContent = '0%';

        updateWholeDayTimeline('15:00 IST', 'Stage 5: Active Storm — Lightning, Heavy Rain & Strong Winds', 80, 7, false);
        highlightInnovationCard('pocket');
        setStep(4);

        queueTimeout(() => {
          if (DOM.progBarTracking) DOM.progBarTracking.style.width = '25%';
          if (DOM.progPctTracking) DOM.progPctTracking.textContent = '25%';
          if (DOM.trackSpeed) DOM.trackSpeed.textContent = dataset.movement.speed[1];
          if (DOM.trackDirection) DOM.trackDirection.textContent = dataset.movement.dir[1];
        }, Math.round(stageDuration * 0.25));

        queueTimeout(() => {
          if (DOM.progBarTracking) DOM.progBarTracking.style.width = '55%';
          if (DOM.progPctTracking) DOM.progPctTracking.textContent = '55%';
          if (DOM.trackSpeed) DOM.trackSpeed.textContent = dataset.movement.speed[2];
          if (DOM.trackDirection) DOM.trackDirection.textContent = dataset.movement.dir[2];
          if (DOM.trackCurrLoc) DOM.trackCurrLoc.textContent = dataset.movement.target;
        }, Math.round(stageDuration * 0.55));

        queueTimeout(() => {
          if (DOM.progBarTracking) DOM.progBarTracking.style.width = '80%';
          if (DOM.progPctTracking) DOM.progPctTracking.textContent = '80%';
          if (DOM.trackSpeed) DOM.trackSpeed.textContent = dataset.movement.speed[3];
          if (DOM.trackDirection) DOM.trackDirection.textContent = dataset.movement.dir[3];
        }, Math.round(stageDuration * 0.8));

        // STAGE 5 COMPLETION: Detects Active Storm -> Triggers Stage 6
        queueTimeout(() => {
          if (DOM.progBarTracking) DOM.progBarTracking.style.width = '100%';
          if (DOM.progPctTracking) DOM.progPctTracking.textContent = '100%';
          if (DOM.trackSpeed) DOM.trackSpeed.textContent = dataset.movement.speed[4];
          if (DOM.trackDirection) DOM.trackDirection.textContent = dataset.movement.dir[4];
          if (DOM.trackCurrLoc) DOM.trackCurrLoc.textContent = dataset.movement.target;

          if (DOM.statusTrackingText) DOM.statusTrackingText.textContent = 'STATUS: ✓ 5. ACTIVE STORM ENGAGED';
          if (DOM.cardTracking) DOM.cardTracking.className = 'story-stage-card stage-complete';

          const chipTracking = document.getElementById('chip-tracking');
          const condTracking = document.getElementById('cond-tracking');
          if (chipTracking) chipTracking.style.display = 'inline-flex';
          if (condTracking) condTracking.style.display = 'inline-flex';

          const handoffCompTrk = document.getElementById('handoff-comp-tracking');
          const handoffTrigTrk = document.getElementById('handoff-trig-tracking');
          if (handoffCompTrk) handoffCompTrk.textContent = 'STAGE 5 COMPLETED';
          if (handoffTrigTrk) handoffTrigTrk.textContent = 'TRIGGERING WEAKENING ANALYSIS...';

          if (DOM.cdmCheckTracking) DOM.cdmCheckTracking.textContent = dataset.movement.check;
          if (DOM.cdmResTracking) DOM.cdmResTracking.textContent = dataset.movement.result;
          if (DOM.cdmDecTracking) DOM.cdmDecTracking.textContent = dataset.movement.decision;
          if (DOM.cdmActTracking) DOM.cdmActTracking.textContent = dataset.movement.action;

          syncMapStage(5);
          speakAnnouncement('Active Storm confirmed with lightning, heavy rain, and microburst winds. Triggering Weakening Analysis automatically.');

          // AUTOMATICALLY TRIGGER STAGE 6
          runStage6();
        }, stageDuration);
      }, transGap);
    }

    // =========================================================================
    // 6. WEAKENING 💨 (Radar + Satellite + Lightning Trend)
    // Physical Mechanism: Updraft disappears, rain dominates
    // Warning Generation: Top warning card illuminated, citizen portal active
    // =========================================================================
    function runStage6() {
      queueTimeout(() => {
        if (DOM.cardTracking) DOM.cardTracking.className = 'story-stage-card stage-complete';
        if (DOM.cardWeakening) DOM.cardWeakening.className = 'story-stage-card stage-running';
        if (DOM.statusWeakText) DOM.statusWeakText.textContent = 'Updraft Disappearing... Rain Dominates';
        if (DOM.progBarWeakening) DOM.progBarWeakening.style.width = '0%';
        if (DOM.progPctWeakening) DOM.progPctWeakening.textContent = '0%';

        updateWholeDayTimeline('15:15 IST', 'Stage 6: Weakening Phase & Civil Defense Warning Dissemination', 100, 9, true);
        highlightInnovationCard('pocket');

        queueTimeout(() => {
          if (DOM.progBarWeakening) DOM.progBarWeakening.style.width = '35%';
          if (DOM.progPctWeakening) DOM.progPctWeakening.textContent = '35%';
          if (DOM.tickerWeakDowndraft) DOM.tickerWeakDowndraft.textContent = dataset.weakening?.downdraft[1] || '24 km/h';
          if (DOM.tickerWeakRain) DOM.tickerWeakRain.textContent = dataset.weakening?.rain[1] || 'Moderate Downpour';
        }, Math.round(stageDuration * 0.35));

        queueTimeout(() => {
          if (DOM.progBarWeakening) DOM.progBarWeakening.style.width = '70%';
          if (DOM.progPctWeakening) DOM.progPctWeakening.textContent = '70%';
          if (DOM.tickerWeakDowndraft) DOM.tickerWeakDowndraft.textContent = dataset.weakening?.downdraft[3] || '36 km/h';
          if (DOM.tickerWeakRain) DOM.tickerWeakRain.textContent = dataset.weakening?.rain[3] || 'Heavy Downpours';
          if (DOM.tickerWeakLtg) DOM.tickerWeakLtg.textContent = dataset.weakening?.ltg[3] || 'Scattered Flashes';
        }, Math.round(stageDuration * 0.7));

        // STAGE 6 COMPLETION: Full Cycle Completed -> Warning Issued at Top
        queueTimeout(() => {
          if (DOM.progBarWeakening) DOM.progBarWeakening.style.width = '100%';
          if (DOM.progPctWeakening) DOM.progPctWeakening.textContent = '100%';
          if (DOM.tickerWeakDowndraft) DOM.tickerWeakDowndraft.textContent = dataset.weakening?.downdraft[4] || '38 km/h';
          if (DOM.tickerWeakRain) DOM.tickerWeakRain.textContent = dataset.weakening?.rain[4] || 'Rain Shield Dominates';
          if (DOM.tickerWeakLtg) DOM.tickerWeakLtg.textContent = dataset.weakening?.ltg[4] || 'Decaying Trend';
          if (DOM.tickerWeakClear) DOM.tickerWeakClear.textContent = dataset.weakening?.clear[4] || 'Evacuation Route Open';

          if (DOM.statusWeakText) DOM.statusWeakText.textContent = 'STATUS: ✓ 6. WEAKENING CONFIRMED';
          if (DOM.cardWeakening) DOM.cardWeakening.className = 'story-stage-card stage-complete';

          if (DOM.chipWeakening) DOM.chipWeakening.style.display = 'inline-flex';
          const handoffCompWeak = document.getElementById('handoff-comp-weakening');
          const handoffTrigWeak = document.getElementById('handoff-trig-weakening');
          if (handoffCompWeak) handoffCompWeak.textContent = 'STAGE 6 COMPLETED';
          if (handoffTrigWeak) handoffTrigWeak.textContent = 'ALL 6 STAGES FINISHED';

          if (DOM.cdmCheckWeak) DOM.cdmCheckWeak.textContent = dataset.weakening?.check || 'Updraft Dissipation, Rain Downpour Rate, Flash Density Decoupling';
          if (DOM.cdmResWeak) DOM.cdmResWeak.textContent = dataset.weakening?.result || 'Updraft collapsed into rain-cooled downdraft. Heavy rain dominates.';
          if (DOM.cdmDecWeak) DOM.cdmDecWeak.textContent = dataset.weakening?.decision || 'Civil Defense Warning Dispatched & Safe Evacuation Active';
          if (DOM.cdmActWeak) DOM.cdmActWeak.textContent = dataset.weakening?.action || 'Dispatched to Citizen Portal & Municipal Sirens';

          // ===================================================================
          // ILLUMINATE TOP WARNING ISSUED CARD (AT VERY TOP - IMAGE 1 MATCH)
          // ===================================================================
          if (DOM.topWarningIssuedCard) {
            DOM.topWarningIssuedCard.style.display = 'flex';
            DOM.topWarningIssuedCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
          if (DOM.topWarnProb) DOM.topWarnProb.textContent = dataset.probPercent || '84%';
          if (DOM.topWarnImpact) DOM.topWarnImpact.textContent = dataset.etaMinutes || 'Within 30 Minutes';
          if (DOM.topWarnAreas) DOM.topWarnAreas.textContent = dataset.targetArea || 'Patancheru, Miyapur, Kukatpally, Secunderabad';

          // UPDATE TOP 4-KPI ROW (IMAGE 4 & 5 MATCH)
          if (DOM.kpiRiskVal) {
            DOM.kpiRiskVal.textContent = 'HIGH ' + (dataset.probPercent || '84%');
            DOM.kpiRiskVal.className = 'kpi-value text-crimson';
          }
          if (DOM.kpiRiskDot) DOM.kpiRiskDot.classList.add('danger');
          if (DOM.kpiRiskSub) DOM.kpiRiskSub.textContent = 'Severe convective cell active. High strike surge imminent.';
          if (DOM.kpiActiveAlerts) DOM.kpiActiveAlerts.textContent = '1';
          if (DOM.kpiCitizensRisk) DOM.kpiCitizensRisk.textContent = '240,000+';
          if (DOM.kpiSmsLogs) DOM.kpiSmsLogs.textContent = '1,280';

          // UPDATE CITIZEN PORTAL (IMAGE 3 MATCH)
          if (DOM.cStatusTopCard) DOM.cStatusTopCard.classList.add('danger');
          if (DOM.cTopStatusText) DOM.cTopStatusText.textContent = 'ACTIVE EMERGENCY WARNING';
          if (DOM.cTopStatusDot) DOM.cTopStatusDot.classList.add('danger');
          if (DOM.cTopStatusIcon) DOM.cTopStatusIcon.textContent = '🚨';
          if (DOM.cTopHeadline) DOM.cTopHeadline.textContent = 'WARNING: SEVERE LIGHTNING IMMINENT';
          if (DOM.cTopDesc) DOM.cTopDesc.textContent = 'Dangerous ground strikes & squall winds approaching ' + (dataset.targetArea || 'Patancheru, Miyapur, Kukatpally') + '.';
          if (DOM.cNavMode) DOM.cNavMode.textContent = 'EVACUATION MODE';
          if (DOM.cShelterTitle) DOM.cShelterTitle.textContent = 'Gachibowli High Ground Shelter';
          if (DOM.cShelterDesc) DOM.cShelterDesc.textContent = 'Elevated bedrock ridge, zero debris accumulation vector';

          // Play 5 Times Alert Pop Sound
          playFivePopSound();

          // Voice Broadcast Announcement
          speakAnnouncement(dataset.warning.voice || 'Civil defense warning dispatched! Citizens must seek immediate indoor shelter.');

          // Re-enable Simulation Buttons
          if (DOM.btnStartSimulationHero) {
            DOM.btnStartSimulationHero.classList.remove('running');
            DOM.btnStartSimulationHero.innerHTML = '<span class="btn-hero-icon">↺</span> REPLAY AUTO SIMULATION';
            DOM.btnStartSimulationHero.disabled = false;
          }
          if (DOM.btnStartCascade) {
            DOM.btnStartCascade.innerHTML = '<span class="btn-icon">↺</span> REPLAY SIMULATION';
            DOM.btnStartCascade.disabled = false;
          }
          if (DOM.heroStatusText) DOM.heroStatusText.textContent = 'WARNING DISPATCHED TO CITIZENS';

          isCascading = false;
        }, stageDuration);
      }, transGap);
    }
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

    // Citizen Alert Sound Mute Button
    if (DOM.btnCitizenMute) {
      DOM.btnCitizenMute.addEventListener('click', () => {
        isAlertSoundMuted = !isAlertSoundMuted;
        DOM.btnCitizenMute.classList.toggle('muted', isAlertSoundMuted);
        if (DOM.citizenMuteText) {
          DOM.citizenMuteText.textContent = isAlertSoundMuted ? 'Unmute Sound' : 'Mute Sound';
        }
      });
    }

    // Simulation Speed Control Dropdown
    if (DOM.simulationSpeed) {
      DOM.simulationSpeed.addEventListener('change', () => {
        simSpeedMultiplier = parseFloat(DOM.simulationSpeed.value) || 2;
        if (DOM.speedDisplayTag) {
          DOM.speedDisplayTag.textContent = DOM.simulationSpeed.value + 'x';
        }
      });
    }

    // Jury Demonstration Mode Toggle
    if (DOM.btnJuryMode) {
      DOM.btnJuryMode.addEventListener('click', () => {
        juryModeActive = !juryModeActive;
        DOM.btnJuryMode.classList.toggle('active', juryModeActive);
        if (DOM.juryModeLabel) {
          DOM.juryModeLabel.textContent = juryModeActive ? 'JURY DEMONSTRATION MODE (ACTIVE)' : 'JURY DEMONSTRATION MODE';
        }
        if (juryModeActive) {
          highlightInnovationCard('relay');
          speakAnnouncement('Jury Demonstration Mode activated. The system highlights architectural innovations at each stage.');
        } else {
          highlightInnovationCard(-1);
        }
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

    // Image 1: Jump from Top Warning card to Citizen Portal
    if (DOM.btnTopWarnPortal) {
      DOM.btnTopWarnPortal.addEventListener('click', () => {
        switchView('view-alerts');
      });
    }

    // Image 3: Citizen Portal Navigation
    if (DOM.btnCPortalBack) {
      DOM.btnCPortalBack.addEventListener('click', () => {
        switchView('view-command');
      });
    }

    if (DOM.btnCitizenRefresh) {
      DOM.btnCitizenRefresh.addEventListener('click', () => {
        DOM.btnCitizenRefresh.style.transition = 'transform 0.5s ease';
        DOM.btnCitizenRefresh.style.transform = 'rotate(360deg)';
        setTimeout(() => {
          if (DOM.btnCitizenRefresh) DOM.btnCitizenRefresh.style.transform = 'rotate(0deg)';
        }, 500);
      });
    }

    if (DOM.btnNavigateSafe) {
      DOM.btnNavigateSafe.addEventListener('click', () => {
        const evacMap = document.getElementById('c-map-evac-card');
        if (evacMap) evacMap.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
    }

    if (DOM.btnCOpenGmaps) {
      DOM.btnCOpenGmaps.addEventListener('click', () => {
        window.open('https://maps.google.com/?q=17.440081,78.348915', '_blank');
      });
    }

    if (DOM.btnCExpandGis) {
      DOM.btnCExpandGis.addEventListener('click', () => {
        const svg = document.querySelector('.c-map-route-visual');
        if (svg) svg.classList.toggle('expanded');
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
  // 14B. TIME-SERIES STREAM ENGINE CONTROLLER (Half-Hourly CSV Playback)
  // =========================================================================

  const STREAM_DATA = [];
  const TOTAL_STREAM_ROWS = 192;
  const BASE_DATE = new Date(2026, 8, 3, 0, 0, 0); // 2026-09-03 00:00:00

  for (let i = 1; i <= TOTAL_STREAM_ROWS; i++) {
    const d = new Date(BASE_DATE.getTime() + (i - 1) * 30 * 60 * 1000);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    const ss = '00';
    const ts = `${yyyy}-${mm}-${dd} ${hh}:${min}:${ss}`;

    let rainHr, accum24, accum3d, accum7d, soilMoist, riskPct, predText, isThreat;

    if (i <= 6) {
      rainHr = (1.2 + i * 0.3).toFixed(1);
      accum24 = (2.0 + i * 0.7).toFixed(1);
      accum3d = (3.5 + i * 0.4).toFixed(1);
      accum7d = (5.0 + i * 0.2).toFixed(1);
      soilMoist = (2.1 + i * 0.1).toFixed(1);
      riskPct = Math.min(25, 8 + i * 3);
      predText = 'NO PREDICTION YET';
      isThreat = false;
    } else if (i <= 14) {
      const prog = (i - 6);
      rainHr = (3.0 + prog * 4.2).toFixed(1);
      accum24 = (6.2 + prog * 5.5).toFixed(1);
      accum3d = (6.5 + prog * 6.0).toFixed(1);
      accum7d = (8.0 + prog * 6.0).toFixed(1);
      soilMoist = (2.7 + prog * 0.45).toFixed(1);
      riskPct = Math.min(88, 30 + prog * 8);
      predText = riskPct >= 70 ? 'SEVERE THUNDERSTORM IMMINENT' : 'CONVECTIVE SURGE DETECTED';
      isThreat = riskPct >= 70;
    } else {
      const decay = (i - 14);
      rainHr = Math.max(2.0, (36.0 - decay * 1.8)).toFixed(1);
      accum24 = (50.2 + decay * 0.6).toFixed(1);
      accum3d = (54.5 + decay * 0.6).toFixed(1);
      accum7d = (56.0 + decay * 0.6).toFixed(1);
      soilMoist = Math.min(5.8, (6.3 - decay * 0.05)).toFixed(1);
      riskPct = Math.max(15, (84 - decay * 5));
      predText = riskPct > 50 ? 'POST-CONVECTIVE DOWNPOUR' : 'SYSTEM WEAKENING';
      isThreat = false;
    }

    STREAM_DATA.push({
      row: i,
      timestamp: ts,
      rain_mm_per_hr: rainHr,
      rain_current_hr: rainHr,
      rain_accum_24h: accum24 + ' mm',
      rain_accum_3d: accum3d + ' mm',
      rain_accum_7d: accum7d + ' mm',
      soil_moisture: soilMoist,
      riskPct: riskPct,
      predText: predText,
      isThreat: isThreat
    });
  }

  let streamCurrentIndex = 3; // Row 4 (0-indexed: 3)
  let streamPlaybackTimer = null;
  let streamPlaybackSpeed = 1;

  function renderStreamRow(idx) {
    if (idx < 0) idx = 0;
    if (idx >= STREAM_DATA.length) idx = STREAM_DATA.length - 1;
    streamCurrentIndex = idx;
    const row = STREAM_DATA[idx];

    // Update Slider & Row Counters
    if (DOM.streamSlider) DOM.streamSlider.value = row.row;
    if (DOM.streamRowCurr) DOM.streamRowCurr.textContent = `${row.row} / ${TOTAL_STREAM_ROWS}`;
    if (DOM.streamTimestamp) DOM.streamTimestamp.textContent = row.timestamp;
    if (DOM.saRowNum) DOM.saRowNum.textContent = `Row [ ${row.row} / ${TOTAL_STREAM_ROWS} ]`;
    if (DOM.saTimestamp) DOM.saTimestamp.textContent = row.timestamp;

    // Update Live Telemetry in Left Box
    const stRainHr = document.getElementById('st-rain-hr');
    const stAccum24 = document.getElementById('st-accum-24');
    const stAccum7d = document.getElementById('st-accum-7d');
    const stCurrentHr = document.getElementById('st-current-hr');
    const stAccum3d = document.getElementById('st-accum-3d');
    const stSoilMoist = document.getElementById('st-soil-moist');

    if (stRainHr) stRainHr.textContent = row.rain_mm_per_hr;
    if (stAccum24) stAccum24.textContent = row.rain_accum_24h;
    if (stAccum7d) stAccum7d.textContent = row.rain_accum_7d;
    if (stCurrentHr) stCurrentHr.textContent = row.rain_current_hr;
    if (stAccum3d) stAccum3d.textContent = row.rain_accum_3d;
    if (stSoilMoist) stSoilMoist.textContent = row.soil_moisture;

    // Update Telemetry Breakdown in Right Box
    const sbRainHr = document.getElementById('sb-rain-hr');
    const sbCurrentHr = document.getElementById('sb-current-hr');
    const sbAccum24 = document.getElementById('sb-accum-24');
    const sbAccum3d = document.getElementById('sb-accum-3d');
    const sbAccum7d = document.getElementById('sb-accum-7d');
    const sbSoilMoist = document.getElementById('sb-soil-moist');

    if (sbRainHr) sbRainHr.textContent = row.rain_mm_per_hr;
    if (sbCurrentHr) sbCurrentHr.textContent = row.rain_current_hr;
    if (sbAccum24) sbAccum24.textContent = row.rain_accum_24h;
    if (sbAccum3d) sbAccum3d.textContent = row.rain_accum_3d;
    if (sbAccum7d) sbAccum7d.textContent = row.rain_accum_7d;
    if (sbSoilMoist) sbSoilMoist.textContent = row.soil_moisture;

    // Update Live Risk Score & Prediction Badge
    if (DOM.saRiskScore) {
      DOM.saRiskScore.textContent = `${row.riskPct}%`;
      DOM.saRiskScore.className = row.riskPct >= 70 ? 'text-crimson' : (row.riskPct >= 40 ? 'text-amber' : 'text-emerald');
    }
    if (DOM.saPredBadge) {
      DOM.saPredBadge.textContent = row.predText;
      DOM.saPredBadge.className = row.isThreat ? 'sa-pred-badge danger' : 'sa-pred-badge';
    }

    // Trigger Warning when threat threshold is crossed
    if (row.isThreat) {
      if (DOM.topWarningIssuedCard) {
        DOM.topWarningIssuedCard.style.display = 'flex';
      }
      if (DOM.topWarnProb) DOM.topWarnProb.textContent = `${row.riskPct}%`;
      if (DOM.kpiRiskVal) {
        DOM.kpiRiskVal.textContent = `HIGH ${row.riskPct}%`;
        DOM.kpiRiskVal.className = 'kpi-value text-crimson';
      }
      if (DOM.kpiRiskDot) DOM.kpiRiskDot.classList.add('danger');
      if (DOM.kpiActiveAlerts) DOM.kpiActiveAlerts.textContent = '1';
      if (DOM.kpiCitizensRisk) DOM.kpiCitizensRisk.textContent = '240,000+';
      if (DOM.kpiSmsLogs) DOM.kpiSmsLogs.textContent = '1,280';

      // Citizen portal update
      if (DOM.cStatusTopCard) DOM.cStatusTopCard.classList.add('danger');
      if (DOM.cTopStatusText) DOM.cTopStatusText.textContent = 'ACTIVE EMERGENCY WARNING';
      if (DOM.cTopStatusDot) DOM.cTopStatusDot.classList.add('danger');
      if (DOM.cTopStatusIcon) DOM.cTopStatusIcon.textContent = '🚨';
      if (DOM.cTopHeadline) DOM.cTopHeadline.textContent = 'WARNING: SEVERE LIGHTNING IMMINENT';
      if (DOM.cNavMode) DOM.cNavMode.textContent = 'EVACUATION MODE';
    }
  }

  function stepStreamRow(delta) {
    let next = streamCurrentIndex + delta;
    if (next >= STREAM_DATA.length) next = 0;
    if (next < 0) next = STREAM_DATA.length - 1;
    renderStreamRow(next);
  }

  function toggleStreamPlayback() {
    if (streamPlaybackTimer) {
      // Pause
      clearInterval(streamPlaybackTimer);
      streamPlaybackTimer = null;
      if (DOM.btnPlayStream) DOM.btnPlayStream.innerHTML = '▶ PLAY TIME-SERIES STREAM';
      if (DOM.saStatusBadge) {
        DOM.saStatusBadge.textContent = 'PLAYBACK PAUSED';
        DOM.saStatusBadge.className = 'sa-status-badge';
      }
    } else {
      // Play
      if (DOM.btnPlayStream) DOM.btnPlayStream.innerHTML = '⏸ PAUSE STREAM';
      if (DOM.saStatusBadge) {
        DOM.saStatusBadge.textContent = 'STREAMING LIVE';
        DOM.saStatusBadge.className = 'sa-status-badge active';
      }
      const interval = Math.max(100, Math.round(1000 / streamPlaybackSpeed));
      streamPlaybackTimer = setInterval(() => {
        if (streamCurrentIndex >= STREAM_DATA.length - 1) {
          toggleStreamPlayback(); // Stop at end
          return;
        }
        stepStreamRow(1);
      }, interval);
    }
  }

  function initStreamEngine() {
    renderStreamRow(3); // Initial row 4

    if (DOM.btnPlayStream) {
      DOM.btnPlayStream.addEventListener('click', toggleStreamPlayback);
    }
    if (DOM.btnStepStream) {
      DOM.btnStepStream.addEventListener('click', () => stepStreamRow(1));
    }
    if (DOM.streamSlider) {
      DOM.streamSlider.addEventListener('input', (e) => {
        const val = parseInt(e.target.value, 10) - 1;
        renderStreamRow(val);
      });
    }

    if (DOM.speedPillBtns) {
      DOM.speedPillBtns.forEach((btn) => {
        btn.addEventListener('click', () => {
          DOM.speedPillBtns.forEach((b) => b.classList.remove('active'));
          btn.classList.add('active');
          streamPlaybackSpeed = parseFloat(btn.getAttribute('data-speed') || '1');
          if (streamPlaybackTimer) {
            // Restart with new speed
            clearInterval(streamPlaybackTimer);
            const interval = Math.max(100, Math.round(1000 / streamPlaybackSpeed));
            streamPlaybackTimer = setInterval(() => {
              if (streamCurrentIndex >= STREAM_DATA.length - 1) {
                toggleStreamPlayback();
                return;
              }
              stepStreamRow(1);
            }, interval);
          }
        });
      });
    }

    // Image 2 Tabs: CSV / Feature Form / Raw
    if (DOM.tabStreamCsv) {
      DOM.tabStreamCsv.addEventListener('click', () => {
        DOM.tabStreamCsv.classList.add('active');
        if (DOM.tabStreamForm) DOM.tabStreamForm.classList.remove('active');
        if (DOM.tabStreamRaw) DOM.tabStreamRaw.classList.remove('active');
      });
    }
    if (DOM.tabStreamForm) {
      DOM.tabStreamForm.addEventListener('click', () => {
        DOM.tabStreamForm.classList.add('active');
        if (DOM.tabStreamCsv) DOM.tabStreamCsv.classList.remove('active');
        if (DOM.tabStreamRaw) DOM.tabStreamRaw.classList.remove('active');
      });
    }
    if (DOM.tabStreamRaw) {
      DOM.tabStreamRaw.addEventListener('click', () => {
        DOM.tabStreamRaw.classList.add('active');
        if (DOM.tabStreamCsv) DOM.tabStreamCsv.classList.remove('active');
        if (DOM.tabStreamForm) DOM.tabStreamForm.classList.remove('active');
      });
    }
  }

  // =========================================================================
  // 15. INITIALIZATION
  // =========================================================================

  function init() {
    initNavigation();
    bindEventListeners();
    initCitizenPortal();
    initStreamEngine();
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
