/**
 * RiskEngine - Centralized Smart Risk Calculation System
 * Calculates deterministic multi-hazard weather risk scores across multiple horizons.
 */
const RiskEngine = (function() {
  'use strict';

  // Standardized Risk Thresholds
  const THRESHOLDS = {
    LOW: 35,
    MEDIUM: 65,
    HIGH: 85
    // CRITICAL is >= 85
  };

  /**
   * Determine categorical risk level and styling metadata
   * @param {number} score - 0 to 100
   * @returns {Object} { level, label, color, bg, border, badgeClass }
   */
  function getRiskMeta(score) {
    const val = Math.max(0, Math.min(100, Math.round(score)));
    if (val >= THRESHOLDS.HIGH) {
      return {
        score: val,
        level: 'CRITICAL',
        label: 'CRITICAL RISK',
        color: '#ff4757',
        bg: 'rgba(255, 71, 87, 0.18)',
        border: 'rgba(255, 71, 87, 0.5)',
        badgeClass: 'badge-critical'
      };
    }
    if (val >= THRESHOLDS.MEDIUM) {
      return {
        score: val,
        level: 'HIGH',
        label: 'HIGH RISK',
        color: '#ff793f',
        bg: 'rgba(255, 121, 63, 0.16)',
        border: 'rgba(255, 121, 63, 0.45)',
        badgeClass: 'badge-high'
      };
    }
    if (val >= THRESHOLDS.LOW) {
      return {
        score: val,
        level: 'MEDIUM',
        label: 'MEDIUM RISK',
        color: '#ffb142',
        bg: 'rgba(255, 177, 66, 0.14)',
        border: 'rgba(255, 177, 66, 0.4)',
        badgeClass: 'badge-medium'
      };
    }
    return {
      score: val,
      level: 'LOW',
      label: 'LOW RISK',
      color: '#00e676',
      bg: 'rgba(0, 230, 118, 0.12)',
      border: 'rgba(0, 230, 118, 0.35)',
      badgeClass: 'badge-low'
    };
  }

  /**
   * Calculate multi-horizon risk from atmospheric and tracking parameters
   * @param {Object} inputs - Normalized inputs from Members 1-4
   * @returns {Object} Comprehensive risk assessment
   */
  function calculate(inputs) {
    const weather = inputs.weather || {};
    const storm = inputs.storm || {};
    const lightning = inputs.lightning || {};
    const tracking = inputs.tracking || {};

    // 1. Atmospheric Instability Factor (0 - 1)
    const cape = weather.cape || 1500;
    const capeFactor = Math.min(1.0, Math.max(0, cape / 3800));
    const humidity = (weather.humidity || 70) / 100;
    const windSpeed = (weather.wind || 30) / 100; // normalized up to 100 km/h
    const atmScore = (capeFactor * 0.55 + humidity * 0.25 + windSpeed * 0.20) * 100;

    // 2. Storm Physical Severity Factor (0 - 100)
    const stormStrength = storm.strength || 0.5; // 0 to 1
    const reflectivity = (storm.reflectivity_dBZ || 40) / 70; // normalized up to 70 dBZ
    const stormScore = (stormStrength * 0.6 + reflectivity * 0.4) * 100;

    // 3. Lightning Threat Factor (0 - 100)
    const p15 = lightning.p15 || 50;
    const p30 = lightning.p30 || 55;
    const p60 = lightning.p60 || 60;
    const strokeDensity = Math.min(1.0, (lightning.stroke_rate_per_min || 10) / 30);
    const lightningScore = (p15 * 0.4 + p30 * 0.3 + p60 * 0.15 + strokeDensity * 100 * 0.15);

    // 4. Proximity / Kinematic Threat Factor
    const eta = tracking.eta !== undefined ? tracking.eta : 30; // in minutes
    // ETA < 15 min = 1.0, ETA > 60 min = 0.2
    const etaFactor = Math.max(0.2, Math.min(1.0, (75 - eta) / 60));
    const speedFactor = Math.min(1.0, (tracking.speed || 30) / 70);
    const kinScore = (etaFactor * 0.7 + speedFactor * 0.3) * 100;

    // 5. Synthesis: Overall Comprehensive Risk
    const overallRaw = (stormScore * 0.35 + lightningScore * 0.35 + atmScore * 0.15 + kinScore * 0.15);
    const overall = getRiskMeta(overallRaw);

    // 6. Horizon Risk Projections
    // 15 MIN: Dominated by immediate lightning + current storm core
    const t15Raw = (p15 * 0.50 + stormScore * 0.35 + etaFactor * 100 * 0.15);
    const t15 = getRiskMeta(t15Raw);

    // 30 MIN: Weighted by storm propagation speed & medium lightning probability
    const t30Raw = (p30 * 0.45 + stormScore * 0.35 + atmScore * 0.20);
    const t30 = getRiskMeta(t30Raw);

    // 60 MIN: Reflects atmospheric feeding (CAPE + shear)
    const t60Raw = (p60 * 0.40 + atmScore * 0.35 + stormScore * 0.25);
    const t60 = getRiskMeta(t60Raw);

    // 3 HOURS: Trend extrapolation
    const t3hRaw = Math.max(10, Math.min(95, t60Raw * 0.88 + (capeFactor > 0.7 ? 12 : -10)));
    const t3h = getRiskMeta(t3hRaw);

    // 6 HOURS: Diurnal dissipation factor
    const t6hRaw = Math.max(5, Math.min(90, t3hRaw * 0.80 - 8));
    const t6h = getRiskMeta(t6hRaw);

    // Trend Direction Helper
    function getTrend(prev, curr) {
      const diff = curr.score - prev.score;
      if (diff >= 3) return { dir: 'increasing', symbol: '↑', label: 'Increasing', css: 'trend-up' };
      if (diff <= -3) return { dir: 'decreasing', symbol: '↓', label: 'Decreasing', css: 'trend-down' };
      return { dir: 'steady', symbol: '→', label: 'Steady', css: 'trend-steady' };
    }

    // Threat Identification
    let primaryThreat = 'Atmospheric Convection';
    if (lightning.p15 > 75) primaryThreat = 'Frequent Cloud-to-Ground Lightning';
    else if (storm.reflectivity_dBZ > 55) primaryThreat = 'Severe Downburst & Hail';
    else if (weather.wind > 65) primaryThreat = 'Destructive Wind Gusts';
    else if (storm.strength > 0.8) primaryThreat = 'Intense Multicell Core';

    return {
      overall,
      components: {
        atmospheric: getRiskMeta(atmScore),
        storm: getRiskMeta(stormScore),
        lightning: getRiskMeta(lightningScore),
        kinematic: getRiskMeta(kinScore)
      },
      horizons: {
        h15: { ...t15, change: getTrend(overall, t15), threat: primaryThreat, confidence: 95 },
        h30: { ...t30, change: getTrend(t15, t30), threat: 'Cell Propagation & Heavy Rain', confidence: 91 },
        h60: { ...t60, change: getTrend(t30, t60), threat: 'Secondary Cell Ingress', confidence: 85 },
        h3h: { ...t3h, change: getTrend(t60, t3h), threat: 'Squall Line Reorganization', confidence: 73 },
        h6h: { ...t6h, change: getTrend(t3h, t6h), threat: 'Post-Frontal Dissipation', confidence: 62 }
      },
      primaryThreat,
      timestamp: new Date().toISOString()
    };
  }

  return {
    calculate,
    getRiskMeta,
    THRESHOLDS
  };
})();
