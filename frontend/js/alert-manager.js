/**
 * AlertManager - Emergency Alert Classification, Dispatch & History System
 * Handles multi-tier alert hierarchy (CRITICAL, HIGH, MEDIUM, LOW),
 * audio chimes, filtering, CSV/JSON export, and operator acknowledgement.
 */
const AlertManager = (function() {
  'use strict';

  let alerts = [
    {
      id: 'ALT-1094',
      type: 'LIGHTNING',
      location: 'Cyberabad & HITEC City Corridor',
      time: '23:02:14',
      timestamp: Date.now() - 240000,
      risk_level: 'CRITICAL',
      description: 'Intense cloud-to-ground strike cluster detected within 3.5 km. Peak stroke amplitude 78 kA.',
      expected_arrival: 'Immediate (< 10 min)',
      recommended_action: 'Seek grounded indoor shelter immediately. Avoid glass facades, towers, and open verandas.',
      acknowledged: false,
      dismissed: false
    },
    {
      id: 'ALT-1093',
      type: 'STORM',
      location: 'Central Hyderabad & Hussain Sagar',
      time: '22:54:02',
      timestamp: Date.now() - 720000,
      risk_level: 'CRITICAL',
      description: 'Supercell Doppler reflectivity > 58 dBZ. Severe downburst and hail probability elevated.',
      expected_arrival: '15 min',
      recommended_action: 'Suspend surface transport. Clear outdoor parking zones and low-lying underpasses.',
      acknowledged: true,
      dismissed: false
    },
    {
      id: 'ALT-1092',
      type: 'WIND',
      location: 'Shamshabad (RGIA Aviation Zone)',
      time: '22:45:30',
      timestamp: Date.now() - 1200000,
      risk_level: 'HIGH',
      description: 'Microburst gust front approaching runway heading 09/27. Sustained velocity 68 km/h.',
      expected_arrival: '25 min',
      recommended_action: 'Aviation crosswind alert active. Ground handling crews on immediate standby.',
      acknowledged: true,
      dismissed: false
    },
    {
      id: 'ALT-1091',
      type: 'LIGHTNING',
      location: 'Secunderabad & Cantonment',
      time: '22:38:18',
      timestamp: Date.now() - 1650000,
      risk_level: 'MEDIUM',
      description: 'Lightning AI model forecasts 72% probability of lightning within 30-minute window.',
      expected_arrival: '30 min',
      recommended_action: 'Outdoor gatherings advised to move toward reinforced structures.',
      acknowledged: true,
      dismissed: false
    },
    {
      id: 'ALT-1090',
      type: 'STORM',
      location: 'Kukatpally & Miyapur NW Sector',
      time: '22:20:45',
      timestamp: Date.now() - 2700000,
      risk_level: 'LOW',
      description: 'Convective cloud deck thickening. Rain gauge accumulation rate 12 mm/h.',
      expected_arrival: '45 min',
      recommended_action: 'Standard storm monitoring protocol in effect.',
      acknowledged: true,
      dismissed: false
    }
  ];

  let audioMuted = false;
  let audioCtx = null;
  const subscribers = [];

  function subscribe(fn) {
    if (typeof fn === 'function') subscribers.push(fn);
  }

  function notify() {
    subscribers.forEach(fn => {
      try { fn(alerts); } catch (e) { console.error('AlertManager listener error:', e); }
    });
  }

  /**
   * Web Audio API synthesized emergency chime
   */
  function playAlertChime(severity) {
    if (audioMuted) return;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      if (!audioCtx) audioCtx = new AudioContext();
      if (audioCtx.state === 'suspended') audioCtx.resume();

      const now = audioCtx.currentTime;
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc.type = severity === 'CRITICAL' ? 'sawtooth' : 'sine';
      osc.frequency.setValueAtTime(severity === 'CRITICAL' ? 880 : 587.33, now);
      osc.frequency.exponentialRampToValueAtTime(severity === 'CRITICAL' ? 1760 : 880, now + 0.18);

      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

      osc.connect(gain);
      gain.connect(audioCtx.destination);

      osc.start(now);
      osc.stop(now + 0.36);
    } catch (e) {
      // Audio autoplay policy fallback
    }
  }

  /**
   * Dispatch a new alert
   */
  function addAlert(data) {
    const time = new Date().toLocaleTimeString('en-IN', { hour12: false });
    const newAlert = {
      id: `ALT-${Math.floor(1000 + Math.random() * 9000)}`,
      type: data.type || 'STORM',
      location: data.location || 'Hyderabad Metropolitan Region',
      time: time,
      timestamp: Date.now(),
      risk_level: data.risk_level || 'HIGH',
      description: data.description || 'Elevated storm risk detected by automated nowcast fusion.',
      expected_arrival: data.expected_arrival || '15-20 min',
      recommended_action: data.recommended_action || 'Remain indoors and monitor official civil defense notices.',
      acknowledged: false,
      dismissed: false
    };

    alerts.unshift(newAlert);
    if (newAlert.risk_level === 'CRITICAL' || newAlert.risk_level === 'HIGH') {
      playAlertChime(newAlert.risk_level);
    }

    notify();
    return newAlert;
  }

  function acknowledge(id) {
    const found = alerts.find(a => a.id === id);
    if (found) {
      found.acknowledged = true;
      notify();
    }
  }

  function dismiss(id) {
    const found = alerts.find(a => a.id === id);
    if (found) {
      found.dismissed = true;
      notify();
    }
  }

  function toggleMute() {
    audioMuted = !audioMuted;
    return audioMuted;
  }

  function isMuted() {
    return audioMuted;
  }

  function getActiveAlerts() {
    return alerts.filter(a => !a.dismissed);
  }

  function getUnacknowledgedCriticalCount() {
    return alerts.filter(a => !a.dismissed && !a.acknowledged && (a.risk_level === 'CRITICAL' || a.risk_level === 'HIGH')).length;
  }

  function getFilteredAlerts(sevFilter = 'ALL', typeFilter = 'ALL') {
    return alerts.filter(a => {
      if (a.dismissed) return false;
      const matchSev = sevFilter === 'ALL' || a.risk_level === sevFilter;
      const matchType = typeFilter === 'ALL' || a.type === typeFilter;
      return matchSev && matchType;
    });
  }

  function exportCSV() {
    let csv = 'Timestamp,Incident ID,Type,Location,Severity,Expected Arrival,Description,Recommended Action,Status\n';
    alerts.forEach(a => {
      csv += `"${a.time}","${a.id}","${a.type}","${a.location}","${a.risk_level}","${a.expected_arrival}","${a.description.replace(/"/g, '""')}","${a.recommended_action.replace(/"/g, '""')}","${a.acknowledged ? 'ACKNOWLEDGED' : 'ACTIVE'}"\n`;
    });
    downloadBlob(csv, `stormnow_alerts_${Date.now()}.csv`, 'text/csv');
  }

  function exportJSON() {
    const jsonStr = JSON.stringify(alerts, null, 2);
    downloadBlob(jsonStr, `stormnow_alerts_${Date.now()}.json`, 'application/json');
  }

  function downloadBlob(content, fileName, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  return {
    addAlert,
    acknowledge,
    dismiss,
    toggleMute,
    isMuted,
    getActiveAlerts,
    getUnacknowledgedCriticalCount,
    getFilteredAlerts,
    exportCSV,
    exportJSON,
    subscribe,
    getAll: () => alerts
  };
})();
