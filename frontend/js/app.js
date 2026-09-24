/**
 * StormNow Pro - Main Application Orchestrator
 * Integrates DataService, RiskEngine, MapManager, AlertManager, and DemoController.
 */
(function() {
  'use strict';

  let currentTab = 'map';
  let activeApiRoute = '/api/weather';
  let apiSimulateStatus = 200; // Simulated response code

  // Chart instances cache
  let chartCape = null;
  let chartLightning = null;
  let chartSectors = null;
  let chartAccuracy = null;
  let chartsInitialized = false;

  // ── TOAST NOTIFICATIONS ──
  function showToast(msg) {
    const t = document.getElementById('toast');
    const txt = document.getElementById('toast-text');
    if (!t || !txt) return;
    txt.textContent = msg;
    t.style.display = 'flex';
    clearTimeout(t._timer);
    t._timer = setTimeout(() => { t.style.display = 'none'; }, 3200);
  }

  // ── CLOCK & RELATIVE TIME ──
  function updateClock() {
    const clkEl = document.getElementById('clk');
    if (clkEl) clkEl.textContent = new Date().toLocaleTimeString('en-IN', { hour12: false });

    // Update relative time badge
    const lastTime = DataService.getLastUpdate();
    const diffSec = Math.max(0, Math.floor((Date.now() - lastTime) / 1000));
    const relEl = document.getElementById('last-updated-rel');
    if (relEl) {
      relEl.textContent = diffSec === 0 ? 'Just now' : `${diffSec}s ago`;
    }

    // Update data freshness indicator
    const freshness = DataService.getFreshness();
    const freshBadge = document.getElementById('data-freshness-badge');
    if (freshBadge) {
      freshBadge.textContent = freshness.label;
      freshBadge.style.color = freshness.color;
      freshBadge.style.borderColor = freshness.color + '55';
    }
  }

  // ── TAB SWITCHING ──
  function switchTab(tabId) {
    currentTab = tabId;
    document.querySelectorAll('.ntab').forEach(t => {
      const isTarget = t.getAttribute('data-tab') === tabId;
      t.classList.toggle('active', isTarget);
      t.setAttribute('aria-selected', isTarget ? 'true' : 'false');
    });

    document.querySelectorAll('.tab-view').forEach(v => {
      v.classList.toggle('active', v.id === `view-${tabId}`);
    });

    if (tabId === 'map') {
      setTimeout(() => { MapManager.invalidateSize(); }, 150);
    } else if (tabId === 'analytics') {
      setTimeout(renderAnalyticsCharts, 100);
    } else if (tabId === 'alerts') {
      renderAlertsTable();
    } else if (tabId === 'api') {
      executeApiTest();
    }
  }

  // ── HUD TOP CARDS UPDATE ──
  function updateTopStats(riskAssessment, feed) {
    const overall = riskAssessment.overall || { score: 50, level: 'MEDIUM', color: '#ffb142' };
    const lightning = feed.lightning || { p30: 50, stroke_rate_per_min: 10 };
    const tracking = feed.tracking || { eta: 25, direction: 'NE' };
    const modules = DataService.getModules();

    // 1. Overall Risk
    const sRisk = document.getElementById('s-risk');
    if (sRisk) {
      sRisk.textContent = `${overall.score}%`;
      sRisk.style.color = overall.color;
    }
    const sRiskLvl = document.getElementById('s-risk-level');
    if (sRiskLvl) {
      sRiskLvl.textContent = overall.level;
      sRiskLvl.style.color = overall.color;
    }

    // 2. Lightning Risk
    const sLight = document.getElementById('s-light');
    if (sLight) sLight.textContent = `${lightning.p30}%`;
    const sStrokeRate = document.getElementById('s-stroke-rate');
    if (sStrokeRate) sStrokeRate.textContent = `${lightning.stroke_rate_per_min} CG/min`;

    // 3. Storm Arrival
    const sEta = document.getElementById('s-eta');
    if (sEta) sEta.textContent = `${tracking.eta} min`;
    const sHeading = document.getElementById('s-heading');
    if (sHeading) sHeading.textContent = `Vector: ${tracking.direction} (${tracking.speed} km/h)`;

    // 4. Active Alerts Count
    const critCount = AlertManager.getUnacknowledgedCriticalCount();
    const sAlerts = document.getElementById('s-alerts-count');
    if (sAlerts) sAlerts.textContent = critCount;
    const badgeEl = document.getElementById('alertsCountBadge');
    if (badgeEl) badgeEl.textContent = critCount;

    // 5. Data Feeds Online
    const onlineCount = Object.values(modules).filter(m => m.status === 'ONLINE').length;
    const sFeeds = document.getElementById('s-feeds-online');
    if (sFeeds) {
      sFeeds.textContent = `${onlineCount}/6`;
      sFeeds.style.color = onlineCount === 6 ? '#00e676' : onlineCount >= 4 ? '#ffb142' : '#ff4757';
    }
  }

  // ── PREDICTION TIMELINE BARS ──
  function updatePredictionTimeline(horizons) {
    if (!horizons) return;
    const slots = [
      { key: 'h15', fId: 'nf15', pId: 'np15', tId: 'nt15', aId: 'na15', thId: 'nth15' },
      { key: 'h30', fId: 'nf30', pId: 'np30', tId: 'nt30', aId: 'na30', thId: 'nth30' },
      { key: 'h60', fId: 'nf60', pId: 'np60', tId: 'nt60', aId: 'na60', thId: 'nth60' },
      { key: 'h3h', fId: 'nf3h', pId: 'np3h', tId: 'nt3h', aId: 'na3h', thId: 'nth3h' },
      { key: 'h6h', fId: 'nf6h', pId: 'np6h', tId: 'nt6h', aId: 'na6h', thId: 'nth6h' }
    ];

    slots.forEach(s => {
      const data = horizons[s.key];
      if (!data) return;

      const fill = document.getElementById(s.fId);
      if (fill) {
        fill.style.width = `${data.score}%`;
        fill.style.background = data.color;
      }

      const pct = document.getElementById(s.pId);
      if (pct) {
        pct.textContent = `${data.score}%`;
        pct.style.color = data.color;
      }

      const tag = document.getElementById(s.tId);
      if (tag) {
        tag.textContent = data.level;
        tag.style.color = data.color;
        tag.style.background = data.bg;
        tag.style.border = `1px solid ${data.border}`;
      }

      const arrow = document.getElementById(s.aId);
      if (arrow && data.change) {
        arrow.textContent = data.change.symbol;
        arrow.className = `trend-arrow ${data.change.css}`;
        arrow.title = `${data.change.label} (${data.confidence}% confidence)`;
      }

      const threat = document.getElementById(s.thId);
      if (threat && data.threat) {
        threat.textContent = data.threat;
      }
    });
  }

  // ── SIDEBAR DATA FEED METRICS ──
  function updateSidebarMetrics(feed) {
    const w = feed.weather || {};
    const s = feed.storm || {};
    const l = feed.lightning || {};
    const t = feed.tracking || {};

    // M1
    setText('v-cape', w.cape);
    setText('v-hum', `${w.humidity}%`);
    setText('v-wind', `${w.wind} km/h`);
    setText('v-pres', `${w.pressure} hPa`);

    // M2
    setText('v-loc', `${s.lat ? s.lat.toFixed(2) : '--'}°N ${s.lon ? s.lon.toFixed(2) : '--'}°E`);
    setText('v-str', `${s.strength || '--'} (${s.reflectivity_dBZ || '--'} dBZ)`);
    setText('v-conf', `${s.confidence || '--'}%`);

    // M3
    setText('v-l15', `${l.p15 || '--'}%`);
    setText('v-l30', `${l.p30 || '--'}%`);
    setText('v-l60', `${l.p60 || '--'}%`);
    setText('v-lconf', `${l.confidence || '--'}%`);

    // M4
    setText('v-dir', `${t.direction || '--'} (${t.heading_deg || 0}°)`);
    setText('v-spd', `${t.speed || '--'} km/h`);
    setText('v-eta', `${t.eta || '--'} min`);
  }

  function setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text !== undefined ? text : '--';
  }

  // ── PIPELINE FLOW MODULE STATUS ──
  function updatePipelineStatus(modules) {
    Object.keys(modules).forEach(k => {
      const m = modules[k];
      const dotEl = document.getElementById(`fnode-dot-${k}`);
      if (dotEl) {
        dotEl.className = `fnode-dot ${m.status === 'ONLINE' ? '' : m.status === 'DEGRADED' ? 'warn' : 'err'}`;
      }
      const latEl = document.getElementById(`fnode-lat-${k}`);
      if (latEl) {
        latEl.textContent = m.status === 'ONLINE' ? `${m.latency}ms` : 'FAIL';
      }
    });
  }

  // ── RECENT ALERTS MINI LOG (Right Panel) ──
  function updateAlertsMiniLog() {
    const alog = document.getElementById('alog');
    if (!alog) return;

    const list = AlertManager.getActiveAlerts().slice(0, 6);
    alog.innerHTML = '';

    if (list.length === 0) {
      alog.innerHTML = '<div style="font-size:0.68rem;color:var(--text3);text-align:center;padding:14px;">No active alerts</div>';
      return;
    }

    list.forEach(a => {
      const item = document.createElement('div');
      const sevClass = a.risk_level === 'CRITICAL' ? 'crit' : a.risk_level === 'HIGH' ? 'crit' : a.risk_level === 'MEDIUM' ? 'warn' : 'info';
      item.className = `alog-item ${sevClass}`;
      item.innerHTML = `
        <div class="alog-msg"><b>[${a.risk_level}]</b> ${a.description}</div>
        <div class="alog-t">${a.time} · ${a.location}</div>
      `;
      alog.appendChild(item);
    });
  }

  // ── VIEW 2: ANALYTICS CHARTS (Chart.js Lazy Loader) ──
  function renderAnalyticsCharts() {
    if (!window.Chart) return;
    const feed = DataService.getFeed();
    const w = feed.weather || {};
    const s = feed.storm || {};
    const l = feed.lightning || {};
    const r = feed.risk || {};

    Chart.defaults.color = '#8892b0';
    Chart.defaults.font.family = "'Inter', sans-serif";

    // Chart 1: Instability vs Radar
    const ctxCape = document.getElementById('chart-cape');
    if (ctxCape) {
      if (chartCape) chartCape.destroy();
      chartCape = new Chart(ctxCape.getContext('2d'), {
        type: 'line',
        data: {
          labels: ['T-50m', 'T-40m', 'T-30m', 'T-20m', 'T-10m', 'Now'],
          datasets: [
            { label: 'CAPE Instability (J/kg)', data: [1600, 1950, 2300, 2800, 3100, w.cape || 2450], borderColor: '#4f9eff', backgroundColor: 'rgba(79, 158, 255, 0.12)', fill: true, tension: 0.35, yAxisID: 'y' },
            { label: 'Reflectivity (dBZ)', data: [28, 34, 42, 49, 54, s.reflectivity_dBZ || 50], borderColor: '#ff4757', borderDash: [4, 4], tension: 0.35, yAxisID: 'y1' }
          ]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { position: 'top', labels: { boxWidth: 10 } } },
          scales: {
            y: { type: 'linear', position: 'left', grid: { color: 'rgba(255,255,255,0.04)' } },
            y1: { type: 'linear', position: 'right', grid: { drawOnChartArea: false } }
          }
        }
      });
    }

    // Chart 2: Lightning AI Horizons
    const ctxLight = document.getElementById('chart-lightning');
    if (ctxLight) {
      if (chartLightning) chartLightning.destroy();
      chartLightning = new Chart(ctxLight.getContext('2d'), {
        type: 'line',
        data: {
          labels: ['-30m', '-15m', 'Now', '+15m', '+30m', '+60m'],
          datasets: [{
            label: 'Strike Probability (%)',
            data: [42, 60, l.p15 || 75, l.p15 || 75, l.p30 || 80, l.p60 || 85],
            borderColor: '#ffd32a',
            backgroundColor: 'rgba(255, 211, 42, 0.15)',
            fill: true, tension: 0.4
          }]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: { y: { min: 0, max: 100, grid: { color: 'rgba(255,255,255,0.04)' } } }
        }
      });
    }

    // Chart 3: Sector Threat
    const ctxSec = document.getElementById('chart-sectors');
    if (ctxSec) {
      if (chartSectors) chartSectors.destroy();
      chartSectors = new Chart(ctxSec.getContext('2d'), {
        type: 'bar',
        data: {
          labels: ['Cyberabad', 'Central Hyd', 'Secunderabad', 'Shamshabad', 'Medchal'],
          datasets: [{
            label: 'Sector Threat',
            data: [r.horizons ? r.horizons.h15.score : 80, 72, 64, 48, 35],
            backgroundColor: ['#ff4757', '#ff793f', '#ffb142', '#00d4ff', '#00e676'],
            borderRadius: 6
          }]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: { y: { min: 0, max: 100, grid: { color: 'rgba(255,255,255,0.04)' } } }
        }
      });
    }

    // Chart 4: Lead-time Ensemble Accuracy
    const ctxAcc = document.getElementById('chart-accuracy');
    if (ctxAcc) {
      if (chartAccuracy) chartAccuracy.destroy();
      chartAccuracy = new Chart(ctxAcc.getContext('2d'), {
        type: 'radar',
        data: {
          labels: ['Precision', 'Recall', 'CSI Index', 'Lead Time', 'Spatial Precision', 'FAR Score'],
          datasets: [{
            label: 'Ensemble Rating',
            data: [95, 92, 89, 96, 91, 94],
            borderColor: '#9d6fff',
            backgroundColor: 'rgba(157, 111, 255, 0.25)',
            pointBackgroundColor: '#9d6fff'
          }]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          scales: { r: { min: 60, max: 100, grid: { color: 'rgba(255,255,255,0.08)' } } }
        }
      });
    }
  }

  // ── VIEW 3: ALERTS TABLE ──
  let alertSevFilter = 'ALL';
  let alertTypeFilter = 'ALL';

  function renderAlertsTable() {
    const tbody = document.getElementById('alerts-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    const list = AlertManager.getFilteredAlerts(alertSevFilter, alertTypeFilter);
    if (list.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:24px;color:var(--text3);">No matching incident alerts</td></tr>';
      return;
    }

    list.forEach(item => {
      const sevClass = item.risk_level === 'CRITICAL' ? 'sev-crit' : item.risk_level === 'HIGH' ? 'sev-high' : item.risk_level === 'MEDIUM' ? 'sev-warn' : 'sev-info';
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td style="font-family:'JetBrains Mono',monospace;">${item.time}</td>
        <td style="font-family:'JetBrains Mono',monospace;color:var(--cyan);font-weight:700;">${item.id}</td>
        <td><b>${item.location}</b></td>
        <td><span class="sev-tag ${sevClass}">${item.risk_level}</span></td>
        <td>${item.description}</td>
        <td style="font-weight:700;color:var(--text);">${item.expected_arrival}</td>
        <td style="font-size:0.62rem;color:var(--text3);">SMS · Siren · CAP</td>
        <td style="display:flex;gap:4px;">
          ${item.acknowledged
            ? '<span style="color:var(--green);font-size:0.65rem;font-weight:700;">✓ ACK</span>'
            : `<button class="btn btn-b" style="padding:2px 7px;font-size:0.62rem;" onclick="window.app.acknowledgeAlert('${item.id}')">Acknowledge</button>`
          }
          <button class="btn btn-r" style="padding:2px 6px;font-size:0.62rem;" onclick="window.app.dismissAlert('${item.id}')">✕</button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  }

  // ── VIEW 4: API PLAYGROUND EXECUTOR ──
  const API_SPEC = {
    '/api/weather': {
      method: 'GET',
      desc: 'Ingests numerical weather prediction variables (CAPE, CIN, humidity, wind, and isobaric surface pressure) from Member 1.',
      getData: () => DataService.getFeed().weather,
      schema: [
        { field: 'cape', type: 'number (J/kg)', provider: 'Member 1', desc: 'Convective Available Potential Energy' },
        { field: 'humidity', type: 'number (%)', provider: 'Member 1', desc: 'Tropospheric relative humidity' },
        { field: 'wind', type: 'number (km/h)', provider: 'Member 1', desc: 'Sustained ground velocity' },
        { field: 'pressure', type: 'number (hPa)', provider: 'Member 1', desc: 'Isobaric pressure' }
      ]
    },
    '/api/storm': {
      method: 'GET',
      desc: 'Retrieves storm centroid coordinates, Doppler reflectivity (dBZ), and core severity index from Member 2.',
      getData: () => DataService.getFeed().storm,
      schema: [
        { field: 'lat', type: 'float (°N)', provider: 'Member 2', desc: 'Storm centroid latitude' },
        { field: 'lon', type: 'float (°E)', provider: 'Member 2', desc: 'Storm centroid longitude' },
        { field: 'reflectivity_dBZ', type: 'float (dBZ)', provider: 'Member 2', desc: 'Doppler core reflectivity' },
        { field: 'strength', type: 'float (0-1)', provider: 'Member 2', desc: 'Normalized storm severity' }
      ]
    },
    '/api/lightning': {
      method: 'GET',
      desc: 'Returns AI lightning strike probability curves across 15, 30, and 60-minute horizons from Member 3.',
      getData: () => DataService.getFeed().lightning,
      schema: [
        { field: 'p15', type: 'number (%)', provider: 'Member 3', desc: '15-min strike probability' },
        { field: 'p30', type: 'number (%)', provider: 'Member 3', desc: '30-min strike probability' },
        { field: 'p60', type: 'number (%)', provider: 'Member 3', desc: '60-min strike probability' },
        { field: 'stroke_rate_per_min', type: 'number', provider: 'Member 3', desc: 'Discharge frequency' }
      ]
    },
    '/api/tracking': {
      method: 'GET',
      desc: 'Provides optical flow motion vectors, translational velocity, and arrival ETA from Member 4.',
      getData: () => DataService.getFeed().tracking,
      schema: [
        { field: 'direction', type: 'string', provider: 'Member 4', desc: 'Compass heading' },
        { field: 'speed', type: 'number (km/h)', provider: 'Member 4', desc: 'Vector speed' },
        { field: 'eta', type: 'number (min)', provider: 'Member 4', desc: 'Estimated impact arrival' }
      ]
    },
    '/api/nowcast': {
      method: 'POST',
      desc: 'Member 5 Multimodal Ensemble Fusion: synthesizes Members 1-4 into the definitive nowcast forecast.',
      getData: () => DataService.getFeed().nowcast,
      schema: [
        { field: 'risk_level', type: 'enum [LOW, MED, HIGH, CRITICAL]', provider: 'Member 5', desc: 'Synthesized hazard level' },
        { field: 'horizons', type: 'object', provider: 'Member 5', desc: 'Multi-step projection matrices' }
      ]
    },
    '/api/alerts': {
      method: 'GET',
      desc: 'Member 6 Public Safety and Civil Defense alert dispatch queue formatted according to the CAP v1.2 standard.',
      getData: () => AlertManager.getActiveAlerts(),
      schema: [
        { field: 'id', type: 'string', provider: 'Member 6', desc: 'Unique incident identifier' },
        { field: 'risk_level', type: 'enum', provider: 'Member 6', desc: 'Severity classification' },
        { field: 'recommended_action', type: 'string', provider: 'Member 6', desc: 'Actionable public advisory' }
      ]
    }
  };

  function executeApiTest() {
    const spec = API_SPEC[activeApiRoute];
    if (!spec) return;

    document.getElementById('api-disp-path').textContent = activeApiRoute;
    const mBadge = document.getElementById('api-disp-method');
    if (mBadge) {
      mBadge.textContent = spec.method;
      mBadge.className = `rm ${spec.method === 'GET' ? 'rm-g' : 'rm-p'}`;
    }
    const dEl = document.getElementById('api-disp-desc');
    if (dEl) dEl.textContent = spec.desc;

    const lat = Math.floor(18 + Math.random() * 32);
    document.getElementById('api-latency').textContent = `${lat} ms`;
    const statusEl = document.getElementById('api-status-code');

    let responsePayload;
    if (apiSimulateStatus === 200) {
      statusEl.textContent = '200 OK';
      statusEl.style.color = '#00e676';
      responsePayload = {
        status: 'success',
        code: 200,
        endpoint: activeApiRoute,
        timestamp: new Date().toISOString(),
        latency_ms: lat,
        data: spec.getData()
      };
    } else if (apiSimulateStatus === 400) {
      statusEl.textContent = '400 Bad Request';
      statusEl.style.color = '#ffb142';
      responsePayload = { status: 'error', code: 400, message: 'Invalid query parameters supplied.' };
    } else if (apiSimulateStatus === 404) {
      statusEl.textContent = '404 Not Found';
      statusEl.style.color = '#ff793f';
      responsePayload = { status: 'error', code: 404, message: `Resource at ${activeApiRoute} not found.` };
    } else if (apiSimulateStatus === 500) {
      statusEl.textContent = '500 Server Error';
      statusEl.style.color = '#ff4757';
      responsePayload = { status: 'error', code: 500, message: 'Upstream model worker process crashed.' };
    } else {
      statusEl.textContent = '504 Gateway Timeout';
      statusEl.style.color = '#ff4757';
      responsePayload = { status: 'error', code: 504, message: 'NWP satellite telemetry ingest timed out after 5000ms.' };
    }

    const pre = document.getElementById('api-response-json');
    if (pre) pre.textContent = JSON.stringify(responsePayload, null, 2);

    // Schema
    const tbody = document.getElementById('api-schema-body');
    if (tbody) {
      tbody.innerHTML = '';
      spec.schema.forEach(s => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td style="color:var(--cyan);font-weight:700;">${s.field}</td>
          <td style="color:var(--yellow);">${s.type}</td>
          <td style="color:var(--purple);">${s.provider}</td>
          <td style="color:var(--text2);font-family:Inter,sans-serif;">${s.desc}</td>
        `;
        tbody.appendChild(tr);
      });
    }
  }

  // ── DEMO MODE UI BINDING ──
  function setupDemoBindings() {
    DemoController.subscribe(({ stage, currentStep, totalStages }) => {
      document.getElementById('demo-stage-name').textContent = stage.name;
      document.getElementById('demo-stage-step').textContent = `${currentStep}/${totalStages}`;
      document.getElementById('demo-stage-desc').textContent = stage.description;
      showToast(`Demo Stage ${currentStep}: ${stage.name}`);
    });
  }

  // ── KEYBOARD SHORTCUTS (Accessibility & Productivity) ──
  function setupKeyboardShortcuts() {
    window.addEventListener('keydown', e => {
      if (['input', 'textarea', 'select'].includes(document.activeElement.tagName.toLowerCase())) return;
      if (e.key === '1') switchTab('map');
      if (e.key === '2') switchTab('analytics');
      if (e.key === '3') switchTab('alerts');
      if (e.key === '4') switchTab('api');
      if (e.key.toLowerCase() === 'm') window.app.toggleAudioMute();
      if (e.key.toLowerCase() === 'd') window.app.toggleDemoMode();
      if (e.key.toLowerCase() === 'r') DataService.refreshAll();
    });
  }

  // ── BOOTSTRAP ──
  function init() {
    // 1. Initialize Map
    MapManager.init('map');

    // 2. Subscribe to Pipeline Events
    DataService.subscribe((eventType, data) => {
      if (eventType === 'pipeline_evaluated') {
        const { feed, risk, modules } = data;
        updateTopStats(risk, feed);
        updatePredictionTimeline(risk.horizons);
        updateSidebarMetrics(feed);
        updatePipelineStatus(modules);
        MapManager.updateData(feed, risk);
        updateAlertsMiniLog();

        if (currentTab === 'analytics') renderAnalyticsCharts();
        if (currentTab === 'api') executeApiTest();
      }
    });

    // 3. Subscribe to Alerts
    AlertManager.subscribe(() => {
      updateAlertsMiniLog();
      if (currentTab === 'alerts') renderAlertsTable();
    });

    // 4. Start Live Ingestion Stream
    DataService.start();

    // 5. Setup Timers & Keyboards
    setInterval(updateClock, 1000);
    updateClock();
    setupDemoBindings();
    setupKeyboardShortcuts();

    // 6. Global Window Handlers for HTML Onclick bindings
    window.app = {
      switchTab,
      toggleLayer: (name) => {
        const on = MapManager.toggleLayer(name);
        const btn = document.getElementById(`lb-${name}`);
        if (btn) btn.classList.toggle('on', on);
        showToast(`Layer ${name.toUpperCase()}: ${on ? 'ON' : 'OFF'}`);
      },
      triggerCriticalAlert: () => {
        AlertManager.addAlert({
          type: 'LIGHTNING',
          location: 'Central Hyderabad & Secretariat Corridor',
          risk_level: 'CRITICAL',
          description: 'Emergency siren protocol activated. Rapid multi-ground stroke discharge clustered.',
          expected_arrival: 'Immediate (< 5 min)',
          recommended_action: 'Mandatory indoor sheltering required.'
        });
        showToast('Critical Emergency Warning dispatched!');
      },
      acknowledgeAlert: (id) => {
        AlertManager.acknowledge(id);
        showToast(`Alert ${id} acknowledged by operator`);
      },
      dismissAlert: (id) => {
        AlertManager.dismiss(id);
        showToast(`Alert ${id} dismissed`);
      },
      filterAlertsBySev: (sev, btn) => {
        alertSevFilter = sev;
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        if (btn) btn.classList.add('active');
        renderAlertsTable();
      },
      dispatchManualAlert: () => {
        const sev = document.getElementById('disp-sev').value;
        const zone = document.getElementById('disp-zone').value;
        const head = document.getElementById('disp-head').value;
        const msg = document.getElementById('disp-msg').value;

        AlertManager.addAlert({
          type: 'STORM',
          location: zone,
          risk_level: sev,
          description: `${head}: ${msg}`,
          expected_arrival: '15 min',
          recommended_action: 'Seek shelter and monitor updates.'
        });
        showToast('Manual emergency broadcast transmitted!');
      },
      exportAlertsCSV: () => {
        AlertManager.exportCSV();
        showToast('Alerts exported as CSV');
      },
      exportAlertsJSON: () => {
        AlertManager.exportJSON();
        showToast('Alerts exported as JSON');
      },
      selectApiRoute: (path, elem) => {
        activeApiRoute = path;
        document.querySelectorAll('.api-item').forEach(i => i.classList.remove('active'));
        if (elem) elem.classList.add('active');
        executeApiTest();
      },
      setApiSimulateStatus: (statusCode) => {
        apiSimulateStatus = parseInt(statusCode, 10);
        executeApiTest();
      },
      executeApiTest,
      copyCurl: () => {
        const spec = API_SPEC[activeApiRoute];
        const url = `${window.location.origin}${activeApiRoute}`;
        const cmd = spec.method === 'GET' ? `curl -X GET "${url}"` : `curl -X POST "${url}" -H "Content-Type: application/json" -d '{"eval":"nowcast"}'`;
        navigator.clipboard.writeText(cmd).then(() => showToast('cURL command copied to clipboard!'));
      },
      copyJsonResponse: () => {
        const pre = document.getElementById('api-response-json');
        if (pre) {
          navigator.clipboard.writeText(pre.textContent).then(() => showToast('JSON copied!'));
        }
      },
      toggleAudioMute: () => {
        const muted = AlertManager.toggleMute();
        const btn = document.getElementById('btn-mute');
        if (btn) btn.textContent = muted ? '🔇' : '🔔';
        showToast(`Alert Sound: ${muted ? 'MUTED' : 'UNMUTED'}`);
      },
      toggleDemoMode: () => {
        const active = DemoController.toggleDemo();
        const btn = document.getElementById('btn-demo');
        const bar = document.getElementById('demo-bar');
        if (btn) btn.classList.toggle('active', active);
        if (bar) bar.classList.toggle('show', active);
        showToast(`Demo Mode: ${active ? 'ENABLED' : 'DISABLED'}`);
      },
      demoNext: () => DemoController.next(),
      demoPrev: () => DemoController.prev(),
      demoPlayPause: () => {
        const isPlaying = DemoController.isPlaying();
        const pBtn = document.getElementById('demo-play-btn');
        if (isPlaying) {
          DemoController.pause();
          if (pBtn) pBtn.textContent = '▶ Play';
        } else {
          DemoController.play();
          if (pBtn) pBtn.textContent = '⏸ Pause';
        }
      },
      demoReset: () => DemoController.reset(),
      toggleConnection: () => {
        const online = !DataService.isConnected();
        DataService.setOnline(online);
        const pill = document.getElementById('conn-pill');
        const pulse = document.getElementById('conn-pulse');
        const txt = document.getElementById('conn-text');
        if (pill) pill.classList.toggle('offline', !online);
        if (pulse) pulse.classList.toggle('offline', !online);
        if (txt) txt.textContent = online ? 'LIVE' : 'OFFLINE';
        showToast(`System Status: ${online ? 'CONNECTED' : 'DISCONNECTED'}`);
      },
      retryModule: (modId) => {
        DataService.toggleModuleStatus(modId);
        showToast(`Module ${modId.toUpperCase()} reconnected`);
      },
      setBaseMap: (type) => {
        MapManager.setBaseMap(type);
        document.querySelectorAll('.basemap-btn').forEach(b => b.classList.remove('active'));
        const activeBtn = document.querySelector(`.basemap-btn[onclick*="${type}"]`);
        if (activeBtn) activeBtn.classList.add('active');
        showToast(`Base Map: ${type.toUpperCase()}`);
      },
      locateMe: () => {
        MapManager.locateUser();
        showToast('Locating your position...');
      }
    };
  }

  window.addEventListener('DOMContentLoaded', init);
})();
