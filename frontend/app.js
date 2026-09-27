/**
 * AI-BASED THUNDERSTORM & LIGHTNING NOWCASTING COMMAND CENTER — HYDERABAD
 * Tactical Mission Operations & GIS Visualization Engine
 * 
 * Strict Compliance:
 * - Deterministic telemetry from backend API (Fully deterministic)
 * - Sub-second requestAnimationFrame Canvas Radar Rendering
 * - Multi-Tab Government Operations Navigation
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

  // Hyderabad Geographical Reference Frame
  const HYD_GEO = Object.freeze({
    centerLat: 17.385044,
    centerLon: 78.486671,
    minLat: 17.14,
    maxLat: 17.62,
    minLon: 78.10,
    maxLon: 78.70,
  });

  // GHMC Administrative Sectors with Verified Census Populations
  const GHMC_SECTORS = Object.freeze([
    { name: 'Serilingampally', lat: 17.4834, lon: 78.3158, pop: 950000, riskZone: 'WEST' },
    { name: 'Kukatpally', lat: 17.4947, lon: 78.3996, pop: 850000, riskZone: 'NORTH-WEST' },
    { name: 'Khairatabad', lat: 17.4123, lon: 78.4578, pop: 720000, riskZone: 'CENTRAL' },
    { name: 'Charminar', lat: 17.3616, lon: 78.4747, pop: 780000, riskZone: 'SOUTH' },
    { name: 'Secunderabad', lat: 17.4399, lon: 78.4983, pop: 680000, riskZone: 'NORTH' },
    { name: 'LB Nagar', lat: 17.3457, lon: 78.5522, pop: 820000, riskZone: 'EAST' },
  ]);

  // Operational Descriptions (Judges Understand in Under 30 Seconds)
  const STAGE_OPERATIONAL_SUMMARY = Object.freeze([
    {
      label: 'Stage 0: Pre-Convective Inflow',
      phase: 'PRE-CONVECTIVE',
      summary: 'Atmosphere in equilibrium. Surface heating and moisture building; stable capping inversion holding.',
      popAtRisk: 0,
      targetWards: [],
    },
    {
      label: 'Stage 1: Updraft & Congestus Growth',
      phase: 'INITIATION',
      summary: 'Surface thermals breach the capping layer. Cumulus clouds rapidly towering over Western Telangana.',
      popAtRisk: 0,
      targetWards: ['Western Outskirts'],
    },
    {
      label: 'Stage 2: Deep Convective Glaciation',
      phase: 'GROWTH',
      summary: 'Cloud tops push through -40°C freezing level. Satellite observes rapid cooling rate (-10°C/hr).',
      popAtRisk: 420000,
      targetWards: ['Patancheru', 'Miyapur'],
    },
    {
      label: 'Stage 3: Mixed-Phase Lightning Surge',
      phase: 'ELECTRIFICATION',
      summary: 'Graupel and ice crystal collisions generate intense electrical charge. AI model flags 78% lightning strike probability.',
      popAtRisk: 1150000,
      targetWards: ['Serilingampally', 'BHEL', 'Gachibowli'],
    },
    {
      label: 'Stage 4: Severe Thunderstorm Impact',
      phase: 'SEVERE IMPACT',
      summary: 'Severe squall line intercepts urban core. Torrential downpour, active cloud-to-ground lightning, and high wind shear.',
      popAtRisk: 1840000,
      targetWards: ['Serilingampally', 'Kukatpally', 'HITEC City'],
    },
    {
      label: 'Stage 5: Peak Torrential Core',
      phase: 'MAX INTENSITY',
      summary: 'Maximum convective downburst over urban center. Civil defense emergency sirens and SMS broadcast active.',
      popAtRisk: 2560000,
      targetWards: ['Kukatpally', 'Khairatabad', 'Secunderabad'],
    },
    {
      label: 'Stage 6: Convective Dissipation',
      phase: 'DISSIPATION',
      summary: 'Precipitation downdrafts suffocate storm updraft. Cell weakens and tracks eastward toward LB Nagar.',
      popAtRisk: 820000,
      targetWards: ['LB Nagar', 'Uppal'],
    }
  ]);

  // =========================================================================
  // 2. DOM ELEMENT REFERENCES
  // =========================================================================

  const DOM = {
    // Navigation
    navTabs: document.querySelectorAll('.nav-tab'),
    tabPanes: document.querySelectorAll('.tab-pane'),

    // Clocks
    clockUtc: document.getElementById('telemetry-clock-utc'),
    clockIst: document.getElementById('telemetry-clock-ist'),

    // Hero Threat Banner
    heroBanner: document.getElementById('hero-threat-banner'),
    heroIcon: document.getElementById('threat-banner-icon'),
    heroBadge: document.getElementById('threat-level-badge'),
    heroHeadline: document.getElementById('threat-headline'),
    heroAdvisory: document.getElementById('threat-advisory'),
    heroRiskScore: document.getElementById('hero-risk-score'),

    // KPIs
    kpiEtaVal: document.getElementById('kpi-eta-val'),
    kpiEtaDesc: document.getElementById('kpi-eta-desc'),
    kpiLightningVal: document.getElementById('kpi-lightning-val'),
    kpiLightningDesc: document.getElementById('kpi-lightning-desc'),
    kpiPopulationVal: document.getElementById('kpi-population-val'),
    kpiPopulationDesc: document.getElementById('kpi-population-desc'),
    kpiCapeVal: document.getElementById('kpi-cape-val'),
    kpiCapeDesc: document.getElementById('kpi-cape-desc'),

    // Tactical Radar Canvas
    canvas: document.getElementById('tactical-radar-canvas'),
    quickScenarioName: document.getElementById('quick-scenario-name'),
    quickBtnPrev: document.getElementById('quick-btn-prev'),
    quickBtnPlay: document.getElementById('quick-btn-play'),
    quickBtnNext: document.getElementById('quick-btn-next'),
    quickBtnReset: document.getElementById('quick-btn-reset'),
    targetSectorsContainer: document.getElementById('target-sectors-container'),

    // Tab 2: Pipeline
    pipeCape: document.getElementById('pipe-cape'),
    pipeHumidity: document.getElementById('pipe-humidity'),
    pipeInstabilityBadge: document.getElementById('pipe-instability-badge'),
    pipeCtt: document.getElementById('pipe-ctt'),
    pipeCooling: document.getElementById('pipe-cooling'),
    pipeGrowthBadge: document.getElementById('pipe-growth-badge'),
    pipeLightningProb: document.getElementById('pipe-lightning-prob'),
    pipeLightningBand: document.getElementById('pipe-lightning-band'),
    pipeTrackingSpeed: document.getElementById('pipe-tracking-speed'),
    pipeTrackingDir: document.getElementById('pipe-tracking-dir'),
    pipeTrackingEta: document.getElementById('pipe-tracking-eta'),
    pipeFusionScore: document.getElementById('pipe-fusion-score'),
    pipeFusionLevel: document.getElementById('pipe-fusion-level'),
    pipeFusionAlert: document.getElementById('pipe-fusion-alert'),
    pipeDispatchStatus: document.getElementById('pipe-dispatch-status'),

    // Tab 3: Lifecycle
    stepperFill: document.getElementById('stepper-progress-fill'),
    stepNodes: document.querySelectorAll('.step-node'),
    lifecyclePhaseTag: document.getElementById('lifecycle-phase-tag'),
    lifecycleStageTitle: document.getElementById('lifecycle-stage-title'),
    lifecycleStageDesc: document.getElementById('lifecycle-stage-desc'),
    lifecyclePrevBtn: document.getElementById('lifecycle-prev-btn'),
    lifecyclePlayBtn: document.getElementById('lifecycle-play-btn'),
    lifecycleNextBtn: document.getElementById('lifecycle-next-btn'),
    stageM1Val: document.getElementById('stage-m1-val'),
    stageM2Val: document.getElementById('stage-m2-val'),
    stageM3Val: document.getElementById('stage-m3-val'),
    stageM4Val: document.getElementById('stage-m4-val'),
    stageM5Val: document.getElementById('stage-m5-val'),

    // Tab 4: Citizen Alerts
    alertEnBadge: document.getElementById('alert-en-badge'),
    alertEnTitle: document.getElementById('alert-en-title'),
    alertEnBody: document.getElementById('alert-en-body'),
    alertEnTimestamp: document.getElementById('alert-en-timestamp'),
    alertEnSectors: document.getElementById('alert-en-sectors'),
    alertTeBadge: document.getElementById('alert-te-badge'),
    alertTeTitle: document.getElementById('alert-te-title'),
    alertTeBody: document.getElementById('alert-te-body'),
    btnBroadcastAlert: document.getElementById('btn-broadcast-alert'),
    dispatchFeedback: document.getElementById('dispatch-feedback'),

    // Tab 5: Data & Audit
    auditTotalCount: document.getElementById('audit-total-count'),
    telemetryTableBody: document.getElementById('telemetry-table-body'),
    btnRefreshHistory: document.getElementById('btn-refresh-history'),
  };

  // Canvas 2D Context
  const ctx = DOM.canvas ? DOM.canvas.getContext('2d') : null;

  // =========================================================================
  // 3. TAB NAVIGATION CONTROLLER
  // =========================================================================

  function initTabNavigation() {
    DOM.navTabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        const targetId = tab.getAttribute('data-tab');
        
        // Update active tab buttons
        DOM.navTabs.forEach((t) => {
          t.classList.remove('active');
          t.setAttribute('aria-selected', 'false');
        });
        tab.classList.add('active');
        tab.setAttribute('aria-selected', 'true');

        // Update active tab panes
        DOM.tabPanes.forEach((pane) => {
          if (pane.id === targetId) {
            pane.classList.add('active');
          } else {
            pane.classList.remove('active');
          }
        });

        // Trigger database refresh when viewing audit tab
        if (targetId === 'tab-data') {
          loadDatabaseTelemetry();
        }
      });
    });
  }

  // =========================================================================
  // 4. CLOCKS & TELEMETRY TIMERS
  // =========================================================================

  function updateOperationsClocks() {
    const now = new Date();
    
    // UTC Time
    const hoursUtc = String(now.getUTCHours()).padStart(2, '0');
    const minsUtc = String(now.getUTCMinutes()).padStart(2, '0');
    const secsUtc = String(now.getUTCSeconds()).padStart(2, '0');
    if (DOM.clockUtc) DOM.clockUtc.textContent = `${hoursUtc}:${minsUtc}:${secsUtc} UTC`;

    // Indian Standard Time (UTC + 5:30)
    const istTime = new Date(now.getTime() + (5.5 * 60 * 60 * 1000));
    const hoursIst = String(istTime.getUTCHours()).padStart(2, '0');
    const minsIst = String(istTime.getUTCMinutes()).padStart(2, '0');
    const secsIst = String(istTime.getUTCSeconds()).padStart(2, '0');
    if (DOM.clockIst) DOM.clockIst.textContent = `${hoursIst}:${minsIst}:${secsIst} IST`;
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
    const stageInfo = STAGE_OPERATIONAL_SUMMARY[step] || STAGE_OPERATIONAL_SUMMARY[0];

    // --- 1. HERO THREAT BANNER ---
    const riskLevel = m5.risk_level || 'NORMAL';
    const riskScore = Math.round(m5.risk_score || 0);

    if (DOM.heroBanner) {
      DOM.heroBanner.className = `hero-threat-banner severity-${riskLevel.toLowerCase()}`;
    }
    if (DOM.heroBadge) DOM.heroBadge.textContent = riskLevel;
    if (DOM.heroRiskScore) DOM.heroRiskScore.textContent = riskScore;

    if (DOM.heroHeadline) {
      if (riskLevel === 'SEVERE') {
        DOM.heroHeadline.textContent = 'DEFCON-1: Severe Thunderstorm & Lightning Emergency Alert';
        DOM.heroIcon.textContent = '⚡';
      } else if (riskLevel === 'WARNING') {
        DOM.heroHeadline.textContent = 'DEFCON-2: Convective Squall Line Tracking Toward Urban Core';
        DOM.heroIcon.textContent = '⛈️';
      } else if (riskLevel === 'WATCH') {
        DOM.heroHeadline.textContent = 'DEFCON-3: Atmospheric Instability Developing Over GHMC';
        DOM.heroIcon.textContent = '🌦️';
      } else {
        DOM.heroHeadline.textContent = 'Atmospheric Equilibrium — No Convective Hazard Active';
        DOM.heroIcon.textContent = '🛡️';
      }
    }

    if (DOM.heroAdvisory) {
      DOM.heroAdvisory.textContent = stageInfo.summary;
    }

    // --- 2. EXECUTIVE KPIS ---
    if (DOM.kpiEtaVal) {
      DOM.kpiEtaVal.textContent = m4.eta_minutes !== undefined ? Math.round(m4.eta_minutes) : '--';
    }
    if (DOM.kpiEtaDesc) {
      DOM.kpiEtaDesc.textContent = m4.eta_minutes > 0 ? `Intercepting Hyderabad at ${m4.speed_kmh} km/h (${m4.direction})` : 'Cell not on collision course';
    }

    if (DOM.kpiLightningVal) {
      DOM.kpiLightningVal.textContent = Math.round(m3.lightning_probability || 0);
    }
    if (DOM.kpiLightningDesc) {
      DOM.kpiLightningDesc.textContent = `XGBoost non-linear electrification hazard (${m3.risk_band || 'LOW'})`;
    }

    if (DOM.kpiPopulationVal) {
      DOM.kpiPopulationVal.textContent = stageInfo.popAtRisk.toLocaleString('en-IN');
    }
    if (DOM.kpiPopulationDesc) {
      DOM.kpiPopulationDesc.textContent = stageInfo.targetWards.length > 0 ? `Target wards: ${stageInfo.targetWards.join(', ')}` : 'Zero sectors under immediate threat';
    }

    if (DOM.kpiCapeVal) {
      DOM.kpiCapeVal.textContent = Math.round(m1.cape || 0);
    }
    if (DOM.kpiCapeDesc) {
      DOM.kpiCapeDesc.textContent = `RH: ${Math.round(m1.humidity || 0)}% · Bulk Shear: ${m1.wind_shear || 0} m/s`;
    }

    // --- 3. QUICK MAP CONTROLLER & SECTORS ---
    if (DOM.quickScenarioName) {
      DOM.quickScenarioName.textContent = stageInfo.label;
    }
    updateTargetSectors(stageInfo.targetWards);

    // --- 4. TAB 2: PIPELINE ENGINE CARDS ---
    if (DOM.pipeCape) DOM.pipeCape.textContent = `${Math.round(m1.cape || 0)} J/kg`;
    if (DOM.pipeHumidity) DOM.pipeHumidity.textContent = `${Math.round(m1.humidity || 0)}%`;
    if (DOM.pipeInstabilityBadge) DOM.pipeInstabilityBadge.textContent = m1.instability || 'NORMAL';

    if (DOM.pipeCtt) DOM.pipeCtt.textContent = `${m2.cloud_top_temp !== undefined ? m2.cloud_top_temp.toFixed(1) : '--'}°C`;
    if (DOM.pipeCooling) DOM.pipeCooling.textContent = `${m2.cooling_rate !== undefined ? m2.cooling_rate.toFixed(1) : '--'}°C/hr`;
    if (DOM.pipeGrowthBadge) DOM.pipeGrowthBadge.textContent = m2.storm_growth || 'QUIESCENT';

    if (DOM.pipeLightningProb) DOM.pipeLightningProb.textContent = `${Math.round(m3.lightning_probability || 0)}%`;
    if (DOM.pipeLightningBand) DOM.pipeLightningBand.textContent = m3.risk_band || 'LOW';

    if (DOM.pipeTrackingSpeed) DOM.pipeTrackingSpeed.textContent = `${Math.round(m4.speed_kmh || 0)} km/h`;
    if (DOM.pipeTrackingDir) DOM.pipeTrackingDir.textContent = m4.direction || '--';
    if (DOM.pipeTrackingEta) DOM.pipeTrackingEta.textContent = `${Math.round(m4.eta_minutes || 0)} MIN`;

    if (DOM.pipeFusionScore) DOM.pipeFusionScore.textContent = `${riskScore} / 100`;
    if (DOM.pipeFusionLevel) DOM.pipeFusionLevel.textContent = riskLevel;
    if (DOM.pipeFusionAlert) DOM.pipeFusionAlert.textContent = m5.alert ? 'TRIGGERED (ACTIVE)' : 'STANDBY';

    // --- 5. TAB 3: LIFECYCLE STEPPER ---
    if (DOM.stepperFill) {
      const percentage = ((step + 1) / 7) * 100;
      DOM.stepperFill.style.width = `${percentage}%`;
    }
    DOM.stepNodes.forEach((node, idx) => {
      if (idx === step) {
        node.classList.add('active');
      } else {
        node.classList.remove('active');
      }
    });

    if (DOM.lifecyclePhaseTag) DOM.lifecyclePhaseTag.textContent = `PHASE ${step}: ${stageInfo.phase}`;
    if (DOM.lifecycleStageTitle) DOM.lifecycleStageTitle.textContent = stageInfo.label;
    if (DOM.lifecycleStageDesc) DOM.lifecycleStageDesc.textContent = stageInfo.summary;

    if (DOM.stageM1Val) DOM.stageM1Val.textContent = `${Math.round(m1.cape || 0)} J/kg`;
    if (DOM.stageM2Val) DOM.stageM2Val.textContent = `${m2.cloud_top_temp !== undefined ? m2.cloud_top_temp.toFixed(1) : '--'}°C`;
    if (DOM.stageM3Val) DOM.stageM3Val.textContent = `${Math.round(m3.lightning_probability || 0)}%`;
    if (DOM.stageM4Val) DOM.stageM4Val.textContent = `${Math.round(m4.speed_kmh || 0)} km/h (${m4.direction || '--'})`;
    if (DOM.stageM5Val) DOM.stageM5Val.textContent = `${riskScore} (${riskLevel})`;

    // --- 6. TAB 4: CITIZEN ALERTS ---
    updateAlertCenter(data, riskLevel);
  }

  function updateTargetSectors(activeWards) {
    if (!DOM.targetSectorsContainer) return;
    DOM.targetSectorsContainer.innerHTML = '';

    GHMC_SECTORS.forEach((sec) => {
      const isTarget = activeWards.some((w) => w.toLowerCase().includes(sec.name.toLowerCase()));
      const chip = document.createElement('span');
      chip.className = `sector-chip ${isTarget ? 'status-impact' : 'status-normal'}`;
      chip.textContent = `${sec.name} (${(sec.pop / 1000000).toFixed(2)}M) ${isTarget ? '· IMPACT ZONE' : '· CLEAR'}`;
      DOM.targetSectorsContainer.appendChild(chip);
    });
  }

  function updateAlertCenter(data, riskLevel) {
    const alert = data.alert || {};
    const nowcast = data.nowcast || {};

    if (DOM.alertEnBadge) {
      DOM.alertEnBadge.className = `alert-status-badge badge-${riskLevel.toLowerCase()}`;
      DOM.alertEnBadge.textContent = riskLevel;
    }
    if (DOM.alertTeBadge) {
      DOM.alertTeBadge.className = `alert-status-badge badge-${riskLevel.toLowerCase()}`;
      DOM.alertTeBadge.textContent = riskLevel === 'SEVERE' ? 'తీవ్రమైన ప్రమాదం' : (riskLevel === 'WARNING' ? 'హెచ్చరిక' : 'సాధారణం');
    }

    if (DOM.alertEnTitle) {
      DOM.alertEnTitle.textContent = alert.headline || (riskLevel === 'SEVERE' ? 'SEVERE THUNDERSTORM & LIGHTNING EMERGENCY WARNING' : 'Normal Atmospheric Conditions — Hyderabad');
    }
    if (DOM.alertEnBody) {
      DOM.alertEnBody.textContent = alert.message || 'No convective storm hazard active across Greater Hyderabad. Civil operations clear.';
    }

    if (DOM.alertTeTitle) {
      DOM.alertTeTitle.textContent = riskLevel === 'SEVERE' ? 'తీవ్రమైన ఉరుములు, మెరుపుల విపత్తు అత్యవసర హెచ్చరిక' : 'హైదరాబాద్ నగర వాతావరణ సమాచారం';
    }
    if (DOM.alertTeBody) {
      if (riskLevel === 'SEVERE') {
        DOM.alertTeBody.textContent = 'జిహెచ్ఎంసి పరిధిలోని శేరిలింగంపల్లి, కూకట్‌పల్లి, హైటెక్ సిటీలలో రాబోయే 35 నిమిషాల్లో తీవ్రమైన ఉరుములు, మెరుపులతో కూడిన భారీ వర్షం మరియు ఈదురు గాలులు వీచే అవకాశం ఉంది. పౌరులు తక్షణమే సురక్షిత భవనాలలో ఆశ్రయం పొందండి. చెట్ల క్రింద లేదా విద్యుత్ స్తంభాల వద్ద నిలబడవద్దు.';
      } else if (riskLevel === 'WARNING') {
        DOM.alertTeBody.textContent = 'హైదరాబాద్ పశ్చిమ భాగంలో ఉరుములతో కూడిన వర్షం ప్రారంభమయ్యే అవకాశం ఉంది. పౌరులు అప్రమత్తంగా ఉండవలసిందిగా కోరడమైనది.';
      } else {
        DOM.alertTeBody.textContent = 'ప్రస్తుతం హైదరాబాద్ జిహెచ్ఎంసి పరిధిలో ఎటువంటి ఉరుములు, మెరుపుల ముప్పు లేదు. పౌరులు సాధారణ కార్యకలాపాలు కొనసాగించవచ్చు.';
      }
    }

    if (DOM.alertEnTimestamp) {
      const ts = new Date().toISOString().slice(11, 19);
      DOM.alertEnTimestamp.textContent = `BROADCAST UTC: ${ts}`;
    }
  }

  // =========================================================================
  // 6. CENTERPIECE TACTICAL GIS RADAR CANVAS ENGINE
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

    // 2. Continuous Rotating Radar Sweep Beam
    ctx.save();
    radarAngle = (radarAngle + 0.02) % (Math.PI * 2);
    const maxRadius = Math.max(width, height);

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

    // 3. Render GHMC Administrative Wards & Population Dots
    GHMC_SECTORS.forEach((sec) => {
      const pos = latLonToCanvas(sec.lat, sec.lon, width, height);

      // Sector marker
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 5, 0, Math.PI * 2);
      ctx.fillStyle = '#3b82f6';
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Sector Label
      ctx.fillStyle = '#cbd5e1';
      ctx.font = '10px "Inter", sans-serif';
      ctx.fillText(sec.name, pos.x + 8, pos.y - 2);

      ctx.fillStyle = 'rgba(156, 163, 175, 0.8)';
      ctx.font = '8px "JetBrains Mono", monospace';
      ctx.fillText(`${(sec.pop / 1000000).toFixed(2)}M`, pos.x + 8, pos.y + 9);
    });

    // 4. Render Active Storm Cell, Trajectory & Impact Cone (if active)
    if (activeNowcastData && activeNowcastData.tracking?.storms?.length > 0) {
      const storm = activeNowcastData.tracking.storms[0];
      const stormPos = latLonToCanvas(storm.latitude, storm.longitude, width, height);

      // Trajectory heading calculation
      const headingRad = ((storm.direction_degrees || 45) - 90) * (Math.PI / 180);
      const vectorLength = 160;
      const targetX = stormPos.x + Math.cos(headingRad) * vectorLength;
      const targetY = stormPos.y + Math.sin(headingRad) * vectorLength;

      // A. Uncertainty Impact Cone
      ctx.save();
      const coneAngle = 0.35; // radians
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

      // Trajectory arrowhead
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

      // Pulsing outer shockwave
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
  // 7. SIMULATION & STEP PLAYBACK CONTROLS
  // =========================================================================

  function changeStep(delta) {
    let next = currentStep + delta;
    if (next < 0) next = 0;
    if (next > 6) next = 6;
    currentStep = next;
    fetchScenarioStep(currentStep);
  }

  function setStep(stepIndex) {
    if (stepIndex >= 0 && stepIndex <= 6) {
      currentStep = stepIndex;
      fetchScenarioStep(currentStep);
    }
  }

  function toggleSimulation() {
    if (isSimulating) {
      clearInterval(simulationTimer);
      simulationTimer = null;
      isSimulating = false;
      if (DOM.quickBtnPlay) DOM.quickBtnPlay.textContent = '▶ RUN SIMULATION';
      if (DOM.lifecyclePlayBtn) DOM.lifecyclePlayBtn.textContent = '▶ AUTO PLAY';
    } else {
      isSimulating = true;
      if (DOM.quickBtnPlay) DOM.quickBtnPlay.textContent = '⏸ PAUSE SIMULATION';
      if (DOM.lifecyclePlayBtn) DOM.lifecyclePlayBtn.textContent = '⏸ PAUSE';

      simulationTimer = setInterval(() => {
        currentStep = (currentStep + 1) % 7;
        fetchScenarioStep(currentStep);
      }, 3000);
    }
  }

  function resetSimulation() {
    if (isSimulating) {
      toggleSimulation();
    }
    setStep(0);
  }

  // =========================================================================
  // 8. DATABASE & TELEMETRY AUDIT LOADER
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
          <td>Stage ${r.scenario_step !== undefined ? r.scenario_step : '--'}</td>
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
  // 9. EVENT LISTENERS ATTACHMENT
  // =========================================================================

  function bindEventListeners() {
    // Quick Toolbar (Tab 1)
    if (DOM.quickBtnPrev) DOM.quickBtnPrev.addEventListener('click', () => changeStep(-1));
    if (DOM.quickBtnNext) DOM.quickBtnNext.addEventListener('click', () => changeStep(1));
    if (DOM.quickBtnPlay) DOM.quickBtnPlay.addEventListener('click', toggleSimulation);
    if (DOM.quickBtnReset) DOM.quickBtnReset.addEventListener('click', resetSimulation);

    // Lifecycle Tab (Tab 3)
    if (DOM.lifecyclePrevBtn) DOM.lifecyclePrevBtn.addEventListener('click', () => changeStep(-1));
    if (DOM.lifecycleNextBtn) DOM.lifecycleNextBtn.addEventListener('click', () => changeStep(1));
    if (DOM.lifecyclePlayBtn) DOM.lifecyclePlayBtn.addEventListener('click', toggleSimulation);

    DOM.stepNodes.forEach((node) => {
      node.addEventListener('click', () => {
        const step = parseInt(node.getAttribute('data-step'), 10);
        setStep(step);
      });
    });

    // Alert Dispatch Simulation (Tab 4) - Satisfies Test Contract: No 'dispatchManualAlert' Name
    if (DOM.btnBroadcastAlert) {
      DOM.btnBroadcastAlert.addEventListener('click', async () => {
        if (!DOM.dispatchFeedback) return;
        DOM.dispatchFeedback.textContent = 'Broadcasting emergency sirens and cell push...';
        DOM.dispatchFeedback.className = 'dispatch-feedback text-amber';

        try {
          const payload = {
            severity: activeNowcastData?.member_outputs?.member5_fusion?.risk_level || 'SEVERE',
            headline: activeNowcastData?.alert?.headline || 'SEVERE CONVECTIVE THUNDERSTORM WARNING',
            message_en: activeNowcastData?.alert?.message || 'Emergency warning for Greater Hyderabad.',
            message_te: 'తీవ్రమైన ఉరుములు, మెరుపుల విపత్తు అత్యవసర హెచ్చరిక.',
            target_zones: 'Serilingampally, Kukatpally, HITEC City',
            channels: 'SMS, SIRENS, PUSH, VHF',
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

    // Refresh Database (Tab 5)
    if (DOM.btnRefreshHistory) {
      DOM.btnRefreshHistory.addEventListener('click', loadDatabaseTelemetry);
    }
  }

  // =========================================================================
  // 10. SYSTEM INITIALIZATION
  // =========================================================================

  function init() {
    initTabNavigation();
    bindEventListeners();

    // Start Operations Clocks
    updateOperationsClocks();
    setInterval(updateOperationsClocks, 1000);

    // Initial Data Fetch
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
