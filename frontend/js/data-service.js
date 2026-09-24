/**
 * DataService - Live Data Architecture & Pipeline Ingestion
 * Handles Member 1-5 feeds, data freshness tracking, connection status,
 * fault isolation, and subscription events.
 */
const DataService = (function() {
  'use strict';

  // Pipeline Module Status
  const modules = {
    m1: { id: 'm1', name: 'Member 1 — Weather Data', role: 'NWP Feed', status: 'ONLINE', latency: 42, lastUpdate: Date.now(), bytesReceived: 10420, error: null },
    m2: { id: 'm2', name: 'Member 2 — Storm Detection', role: 'Satellite + Radar', status: 'ONLINE', latency: 68, lastUpdate: Date.now(), bytesReceived: 48920, error: null },
    m3: { id: 'm3', name: 'Member 3 — Lightning AI', role: 'GNN Strike Model', status: 'ONLINE', latency: 85, lastUpdate: Date.now(), bytesReceived: 18240, error: null },
    m4: { id: 'm4', name: 'Member 4 — Storm Tracking', role: 'Motion Vector', status: 'ONLINE', latency: 34, lastUpdate: Date.now(), bytesReceived: 8400, error: null },
    m5: { id: 'm5', name: 'Nowcast Engine', role: 'Multimodal Fusion', status: 'ONLINE', latency: 120, lastUpdate: Date.now(), bytesReceived: 86000, error: null },
    m6: { id: 'm6', name: 'Integration & Alerts', role: 'Member 6 Backend', status: 'ONLINE', latency: 22, lastUpdate: Date.now(), bytesReceived: 12400, error: null }
  };

  // Internal State Cache
  let currentFeed = {
    weather: { cape: 2450, humidity: 82, wind: 48, pressure: 994, cin: 18, shear: '22 m/s' },
    storm: { lat: 17.43, lon: 78.52, strength: 0.84, confidence: 92, reflectivity_dBZ: 58.4, cell_area_km2: 215 },
    lightning: { p15: 78, p30: 84, p60: 89, confidence: 92, stroke_rate_per_min: 14, strikes: [] },
    tracking: { direction: 'NE', speed: 38, eta: 22, heading_deg: 45 },
    nowcast: {},
    risk: {}
  };

  let isConnected = true;
  let lastGlobalUpdate = Date.now();
  const listeners = [];

  // Polling intervals
  let weatherInterval = null;
  let stormInterval = null;

  function subscribe(fn) {
    if (typeof fn === 'function') listeners.push(fn);
    return () => {
      const idx = listeners.indexOf(fn);
      if (idx !== -1) listeners.splice(idx, 1);
    };
  }

  function emit(type, data) {
    listeners.forEach(fn => {
      try { fn(type, data); } catch (e) { console.error('DataService subscriber error:', e); }
    });
  }

  function rand(min, max) { return Math.random() * (max - min) + min; }
  function randInt(min, max) { return Math.floor(rand(min, max)); }
  function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

  /**
   * Fetch Weather Data (Member 1)
   */
  async function fetchWeatherData() {
    if (modules.m1.status === 'OFFLINE') throw new Error('Member 1 NWP Feed Offline');
    const start = performance.now();
    // Simulate lightweight deterministic drift
    const prev = currentFeed.weather;
    currentFeed.weather = {
      cape: clamp(prev.cape + randInt(-80, 90), 800, 3900),
      humidity: clamp(prev.humidity + randInt(-2, 3), 50, 98),
      wind: clamp(prev.wind + randInt(-3, 4), 15, 85),
      pressure: clamp(prev.pressure + randInt(-1, 2), 975, 1018),
      cin: clamp(prev.cin + randInt(-2, 3), 8, 55),
      shear: `${randInt(18, 34)} m/s`
    };
    modules.m1.latency = Math.round(performance.now() - start) + randInt(18, 35);
    modules.m1.lastUpdate = Date.now();
    modules.m1.bytesReceived += 412;
    emit('weather_updated', currentFeed.weather);
  }

  /**
   * Fetch Storm Detection & Tracking (Members 2 & 4)
   */
  async function fetchStormData() {
    if (modules.m2.status === 'OFFLINE') throw new Error('Member 2 Radar Feed Offline');
    const start = performance.now();
    const prev = currentFeed.storm;
    const str = clamp(prev.strength + rand(-0.04, 0.05), 0.35, 0.98);
    const lat = clamp(17.40 + rand(-0.12, 0.14), 17.20, 17.65);
    const lon = clamp(78.48 + rand(-0.12, 0.14), 78.25, 78.70);
    const dBZ = +(34 + str * 28 + rand(-1.5, 1.5)).toFixed(1);

    currentFeed.storm = {
      lat,
      lon,
      strength: +str.toFixed(2),
      confidence: randInt(82, 98),
      reflectivity_dBZ: dBZ,
      cell_area_km2: +(Math.PI * Math.pow(str * 14, 2)).toFixed(1)
    };

    modules.m2.latency = Math.round(performance.now() - start) + randInt(30, 50);
    modules.m2.lastUpdate = Date.now();
    modules.m2.bytesReceived += 1240;

    // Member 4 Tracking
    const dirs = ['NE', 'N', 'NW', 'E', 'SE'];
    const dir = dirs[randInt(0, dirs.length)];
    const speed = randInt(26, 58);
    const eta = randInt(12, 45);
    currentFeed.tracking = {
      direction: dir,
      speed: speed,
      eta: eta,
      heading_deg: dir === 'NE' ? 45 : dir === 'N' ? 0 : dir === 'NW' ? 315 : dir === 'E' ? 90 : 135
    };
    modules.m4.lastUpdate = Date.now();
    modules.m4.bytesReceived += 320;

    emit('storm_updated', { storm: currentFeed.storm, tracking: currentFeed.tracking });
  }

  /**
   * Fetch Lightning AI (Member 3)
   */
  async function fetchLightningData() {
    if (modules.m3.status === 'OFFLINE') throw new Error('Member 3 Model Feed Offline');
    const start = performance.now();
    const base = rand(40, 88);
    const p15 = clamp(Math.round(base + rand(-4, 5)), 20, 99);
    const p30 = clamp(Math.round(base + rand(2, 10)), 25, 99);
    const p60 = clamp(Math.round(base + rand(5, 14)), 30, 99);
    const strokeRate = randInt(6, 28);

    // Generate local strikes cluster around storm centroid
    const strikes = [];
    const count = Math.floor(p15 / 18) + 2;
    for (let i = 0; i < count; i++) {
      strikes.push({
        id: `STRK-${Date.now()}-${i}`,
        lat: currentFeed.storm.lat + rand(-0.08, 0.08),
        lon: currentFeed.storm.lon + rand(-0.10, 0.10),
        prob: randInt(55, 99),
        amplitude_kA: randInt(14, 85),
        type: Math.random() > 0.4 ? 'Cloud-to-Ground' : 'Intra-Cloud',
        time: new Date().toLocaleTimeString('en-IN', { hour12: false })
      });
    }

    currentFeed.lightning = {
      p15, p30, p60,
      confidence: randInt(84, 98),
      stroke_rate_per_min: strokeRate,
      strikes
    };

    modules.m3.latency = Math.round(performance.now() - start) + randInt(40, 65);
    modules.m3.lastUpdate = Date.now();
    modules.m3.bytesReceived += 880;

    emit('lightning_updated', currentFeed.lightning);
  }

  /**
   * Run Centralized Fusion & Risk Evaluation Pipeline
   */
  function evaluatePipeline() {
    // Member 5 Synthesis using RiskEngine
    const riskData = RiskEngine.calculate(currentFeed);
    currentFeed.risk = riskData;
    currentFeed.nowcast = {
      risk_level: riskData.overall.level,
      horizons: riskData.horizons,
      primaryThreat: riskData.primaryThreat,
      timestamp: riskData.timestamp
    };

    modules.m5.lastUpdate = Date.now();
    modules.m6.lastUpdate = Date.now();
    lastGlobalUpdate = Date.now();

    emit('pipeline_evaluated', {
      feed: currentFeed,
      risk: riskData,
      modules
    });
  }

  /**
   * Complete update cycle (all modules)
   */
  async function refreshAll() {
    if (!isConnected) return;
    try {
      await fetchWeatherData();
      await fetchStormData();
      await fetchLightningData();
      evaluatePipeline();
    } catch (err) {
      console.warn('Pipeline update partial failure:', err.message);
      // Even if one module throws, evaluate with remaining available data!
      evaluatePipeline();
    }
  }

  function start() {
    refreshAll();
    // Weather updates every 25s
    weatherInterval = setInterval(fetchWeatherData, 25000);
    // Storm & Lightning updates every 10s
    stormInterval = setInterval(() => {
      fetchStormData();
      fetchLightningData();
      evaluatePipeline();
    }, 10000);
  }

  function stop() {
    clearInterval(weatherInterval);
    clearInterval(stormInterval);
  }

  function setOnline(online) {
    isConnected = online;
    Object.keys(modules).forEach(k => {
      modules[k].status = online ? 'ONLINE' : 'OFFLINE';
    });
    emit('connection_changed', { isConnected: online });
    if (online) refreshAll();
  }

  function toggleModuleStatus(modId) {
    if (!modules[modId]) return;
    modules[modId].status = modules[modId].status === 'ONLINE' ? 'OFFLINE' : 'ONLINE';
    emit('module_status_changed', { module: modules[modId] });
    evaluatePipeline();
  }

  function getFreshness() {
    const ageSeconds = (Date.now() - lastGlobalUpdate) / 1000;
    if (!isConnected) return { status: 'OFFLINE', label: 'OFFLINE', color: '#ff4757', ageSeconds };
    if (ageSeconds < 15) return { status: 'FRESH', label: 'LIVE (< 15s)', color: '#00e676', ageSeconds };
    if (ageSeconds < 45) return { status: 'STALE', label: 'STALE (> 15s)', color: '#ffb142', ageSeconds };
    return { status: 'DEGRADED', label: 'DEGRADED', color: '#ff5252', ageSeconds };
  }

  return {
    start,
    stop,
    refreshAll,
    subscribe,
    getFeed: () => currentFeed,
    getModules: () => modules,
    setOnline,
    toggleModuleStatus,
    getFreshness,
    isConnected: () => isConnected,
    getLastUpdate: () => lastGlobalUpdate
  };
})();
