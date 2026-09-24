/**
 * DemoController - Deterministic 7-Stage Storm Event Simulator
 * Provides controllable, repeatable demonstrations of storm lifecycle progression.
 */
const DemoController = (function() {
  'use strict';

  let isDemoActive = false;
  let currentStageIndex = 0;
  let autoPlayTimer = null;
  let isPlaying = false;
  const subscribers = [];

  const DEMO_STAGES = [
    {
      index: 1,
      name: 'Normal Conditions',
      tag: 'BASELINE',
      description: 'Clear tropospheric conditions. Atmospheric stability normal with low convective potential.',
      weather: { cape: 850, humidity: 55, wind: 18, pressure: 1012, cin: 45, shear: '14 m/s' },
      storm: { lat: 17.28, lon: 78.32, strength: 0.25, confidence: 96, reflectivity_dBZ: 24.5, cell_area_km2: 45 },
      lightning: { p15: 12, p30: 18, p60: 22, confidence: 95, stroke_rate_per_min: 0, strikes: [] },
      tracking: { direction: 'NE', speed: 18, eta: 75, heading_deg: 45 },
      alertToTrigger: null
    },
    {
      index: 2,
      name: 'Convective Instability Rising',
      tag: 'WARMING',
      description: 'Solar heating and high boundary moisture rapidly increasing CAPE. Cloud top cooling observed.',
      weather: { cape: 2150, humidity: 76, wind: 34, pressure: 1004, cin: 22, shear: '20 m/s' },
      storm: { lat: 17.33, lon: 78.38, strength: 0.48, confidence: 91, reflectivity_dBZ: 41.0, cell_area_km2: 110 },
      lightning: { p15: 38, p30: 48, p60: 55, confidence: 90, stroke_rate_per_min: 2, strikes: [] },
      tracking: { direction: 'NE', speed: 28, eta: 50, heading_deg: 45 },
      alertToTrigger: {
        type: 'STORM',
        location: 'Western Hyderabad & Outer Ring Road',
        risk_level: 'MEDIUM',
        description: 'Convective cumulus cell rapidly deepening. Isolated lightning risk within 45 minutes.',
        expected_arrival: '45-50 min',
        recommended_action: 'General advisory for outdoor work crews.'
      }
    },
    {
      index: 3,
      name: 'Early Lightning Detected',
      tag: 'LIGHTNING AI',
      description: 'First cloud-to-ground lightning flashes registered by Member 3 GNN Model. High strike rate.',
      weather: { cape: 2850, humidity: 82, wind: 45, pressure: 998, cin: 12, shear: '26 m/s' },
      storm: { lat: 17.38, lon: 78.43, strength: 0.68, confidence: 93, reflectivity_dBZ: 50.5, cell_area_km2: 175 },
      lightning: {
        p15: 72, p30: 80, p60: 84, confidence: 92, stroke_rate_per_min: 12,
        strikes: [
          { id: 'DEMO-1', lat: 17.385, lon: 78.432, prob: 94, amplitude_kA: 42, type: 'Cloud-to-Ground', time: '14:22:10' },
          { id: 'DEMO-2', lat: 17.391, lon: 78.428, prob: 88, amplitude_kA: 35, type: 'Intra-Cloud', time: '14:22:18' }
        ]
      },
      tracking: { direction: 'NE', speed: 36, eta: 32, heading_deg: 45 },
      alertToTrigger: {
        type: 'LIGHTNING',
        location: 'Cyberabad, Madhapur & Gachibowli',
        risk_level: 'HIGH',
        description: 'Frequent lightning ground strikes confirmed. Lightning probability elevated to 72% in next 15 min.',
        expected_arrival: '30 min',
        recommended_action: 'Outdoor activities suspended immediately. Seek enclosed building shelter.'
      }
    },
    {
      index: 4,
      name: 'Supercell Storm Detected',
      tag: 'RADAR DETECTION',
      description: 'Member 2 Doppler radar confirms severe convective core > 56 dBZ with hail signature.',
      weather: { cape: 3200, humidity: 88, wind: 58, pressure: 992, cin: 8, shear: '30 m/s' },
      storm: { lat: 17.41, lon: 78.47, strength: 0.85, confidence: 96, reflectivity_dBZ: 58.0, cell_area_km2: 240 },
      lightning: {
        p15: 84, p30: 90, p60: 92, confidence: 95, stroke_rate_per_min: 20,
        strikes: [
          { id: 'DEMO-3', lat: 17.412, lon: 78.468, prob: 98, amplitude_kA: 68, type: 'Cloud-to-Ground', time: '14:35:04' },
          { id: 'DEMO-4', lat: 17.408, lon: 78.475, prob: 92, amplitude_kA: 55, type: 'Cloud-to-Ground', time: '14:35:12' },
          { id: 'DEMO-5', lat: 17.420, lon: 78.462, prob: 86, amplitude_kA: 38, type: 'Intra-Cloud', time: '14:35:25' }
        ]
      },
      tracking: { direction: 'NE', speed: 42, eta: 18, heading_deg: 45 },
      alertToTrigger: {
        type: 'HAIL',
        location: 'Central Hyderabad & Banjara Hills',
        risk_level: 'CRITICAL',
        description: 'Severe thunderstorm core tracking toward city center. Hail diameter 2-3 cm possible with gale gusts.',
        expected_arrival: '18 min',
        recommended_action: 'Protect vehicles, avoid transit under trees and overhead power lines.'
      }
    },
    {
      index: 5,
      name: 'High Risk Peak Impact',
      tag: 'NOWCAST MAXIMUM',
      description: 'Member 5 ensemble fusion reaches maximum hazard threshold. Microburst gusts & intense lightning.',
      weather: { cape: 3600, humidity: 94, wind: 72, pressure: 986, cin: 4, shear: '34 m/s' },
      storm: { lat: 17.43, lon: 78.50, strength: 0.96, confidence: 97, reflectivity_dBZ: 63.5, cell_area_km2: 320 },
      lightning: {
        p15: 96, p30: 94, p60: 88, confidence: 96, stroke_rate_per_min: 28,
        strikes: [
          { id: 'DEMO-6', lat: 17.432, lon: 78.498, prob: 99, amplitude_kA: 88, type: 'Cloud-to-Ground', time: '14:48:02' },
          { id: 'DEMO-7', lat: 17.428, lon: 78.504, prob: 97, amplitude_kA: 74, type: 'Cloud-to-Ground', time: '14:48:15' },
          { id: 'DEMO-8', lat: 17.439, lon: 78.490, prob: 95, amplitude_kA: 82, type: 'Cloud-to-Ground', time: '14:48:22' }
        ]
      },
      tracking: { direction: 'NE', speed: 46, eta: 8, heading_deg: 45 },
      alertToTrigger: {
        type: 'LIGHTNING',
        location: 'Secunderabad & Hyderabad Metropolitan Core',
        risk_level: 'CRITICAL',
        description: 'RED ALERT: Violent thunderstorm overhead. Emergency sirens and civil defense broadcast active.',
        expected_arrival: 'Immediate (< 10 min)',
        recommended_action: 'IMMEDIATE EVACUATION of open areas. Stay away from ungrounded infrastructure.'
      }
    },
    {
      index: 6,
      name: 'Critical Warning Active',
      tag: 'CIVIL DEFENSE DISPATCH',
      description: 'Emergency alert protocol fully dispatched across telecom SMS, NDMA CAP gateway, and sirens.',
      weather: { cape: 2900, humidity: 95, wind: 60, pressure: 990, cin: 16, shear: '28 m/s' },
      storm: { lat: 17.46, lon: 78.54, strength: 0.88, confidence: 95, reflectivity_dBZ: 57.0, cell_area_km2: 290 },
      lightning: {
        p15: 86, p30: 78, p60: 65, confidence: 93, stroke_rate_per_min: 16,
        strikes: [
          { id: 'DEMO-9', lat: 17.458, lon: 78.538, prob: 92, amplitude_kA: 58, type: 'Cloud-to-Ground', time: '15:02:11' }
        ]
      },
      tracking: { direction: 'NE', speed: 40, eta: 14, heading_deg: 45 },
      alertToTrigger: null
    },
    {
      index: 7,
      name: 'Risk Decreasing / Clearance',
      tag: 'POST-FRONTAL DISSIPATION',
      description: 'Convective energy exhausted. Storm cell propagating out toward NE rural corridor. Weather clearing.',
      weather: { cape: 1100, humidity: 68, wind: 24, pressure: 1008, cin: 38, shear: '16 m/s' },
      storm: { lat: 17.52, lon: 78.62, strength: 0.38, confidence: 94, reflectivity_dBZ: 32.0, cell_area_km2: 120 },
      lightning: { p15: 22, p30: 25, p60: 30, confidence: 92, stroke_rate_per_min: 2, strikes: [] },
      tracking: { direction: 'NE', speed: 30, eta: 60, heading_deg: 45 },
      alertToTrigger: {
        type: 'STORM',
        location: 'All Metropolitan Sectors',
        risk_level: 'LOW',
        description: 'Severe weather advisory terminated. Normal municipal and aviation operations may resume.',
        expected_arrival: 'Past Cell',
        recommended_action: 'Remain watchful for localized waterlogged roadways.'
      }
    }
  ];

  function subscribe(fn) {
    if (typeof fn === 'function') subscribers.push(fn);
  }

  function notify(stageData) {
    subscribers.forEach(fn => {
      try { fn(stageData); } catch (e) { console.error('DemoController subscriber error:', e); }
    });
  }

  function applyStage(index) {
    if (index < 0 || index >= DEMO_STAGES.length) return;
    currentStageIndex = index;
    const stage = DEMO_STAGES[currentStageIndex];

    // Feed current stage into DataService state
    const feed = DataService.getFeed();
    feed.weather = { ...stage.weather };
    feed.storm = { ...stage.storm };
    feed.lightning = { ...stage.lightning };
    feed.tracking = { ...stage.tracking };

    // Trigger alert if stage specifies one
    if (stage.alertToTrigger) {
      AlertManager.addAlert(stage.alertToTrigger);
    }

    // Evaluate RiskEngine
    const risk = RiskEngine.calculate(feed);
    feed.risk = risk;
    feed.nowcast = {
      risk_level: risk.overall.level,
      horizons: risk.horizons,
      primaryThreat: risk.primaryThreat,
      timestamp: risk.timestamp
    };

    // Update map
    MapManager.updateData(feed, risk);

    notify({
      stage,
      totalStages: DEMO_STAGES.length,
      currentStep: currentStageIndex + 1,
      feed,
      risk
    });
  }

  function toggleDemo(enable) {
    isDemoActive = enable !== undefined ? enable : !isDemoActive;
    if (isDemoActive) {
      DataService.stop(); // Pause random generator during demo
      applyStage(currentStageIndex);
    } else {
      pause();
      DataService.start(); // Resume live telemetry
    }
    return isDemoActive;
  }

  function next() {
    if (currentStageIndex < DEMO_STAGES.length - 1) {
      applyStage(currentStageIndex + 1);
    } else {
      applyStage(0); // loop
    }
  }

  function prev() {
    if (currentStageIndex > 0) {
      applyStage(currentStageIndex - 1);
    }
  }

  function play() {
    if (isPlaying) return;
    isPlaying = true;
    autoPlayTimer = setInterval(next, 6000); // 6s per stage
  }

  function pause() {
    isPlaying = false;
    if (autoPlayTimer) clearInterval(autoPlayTimer);
  }

  function reset() {
    pause();
    applyStage(0);
  }

  return {
    toggleDemo,
    isActive: () => isDemoActive,
    isPlaying: () => isPlaying,
    getCurrentStage: () => DEMO_STAGES[currentStageIndex],
    getStages: () => DEMO_STAGES,
    next,
    prev,
    play,
    pause,
    reset,
    applyStage,
    subscribe
  };
})();
