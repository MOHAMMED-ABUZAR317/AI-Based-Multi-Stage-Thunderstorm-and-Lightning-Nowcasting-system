(() => {
  "use strict";

  const TOTAL_STEPS = 7;
  const CITY_COORDS = { latitude: 17.3850, longitude: 78.4867 };
  let currentStep = 0;
  let playbackTimer = null;
  let cachedPayload = null;

  const $ = (id) => document.getElementById(id);

  // Layer toggle states
  const layerState = {
    radar: true,
    cone: true,
    sectors: true,
    sweep: true,
  };

  // Geographic Projection Bounds for Hyderabad Metropolitan Region
  // SVG Canvas: width = 720, height = 480
  const GEO_BOUNDS = {
    minLon: 78.08,
    maxLon: 78.62,
    minLat: 17.14,
    maxLat: 17.58,
  };

  function project(lat, lon) {
    const x = 50 + Math.max(0, Math.min(1, (lon - GEO_BOUNDS.minLon) / (GEO_BOUNDS.maxLon - GEO_BOUNDS.minLon))) * 620;
    const y = 35 + Math.max(0, Math.min(1, 1 - (lat - GEO_BOUNDS.minLat) / (GEO_BOUNDS.maxLat - GEO_BOUNDS.minLat))) * 390;
    return { x: Math.round(x), y: Math.round(y) };
  }

  // Update real-time military UTC clock
  function initClock() {
    const clockEl = $("telemetry-clock");
    function update() {
      const now = new Date();
      const utc = now.toUTCString().split(" ")[4] + " UTC";
      if (clockEl) clockEl.textContent = utc;
    }
    update();
    setInterval(update, 1000);
  }

  function setConnectionStatus(connected, text) {
    const el = $("connection-state");
    if (!el) return;
    el.textContent = text;
    el.className = connected ? "live-indicator" : "stage-phase-chip";
  }

  function showErrorMessage(msg) {
    const el = $("error-message");
    if (!el) return;
    el.textContent = msg;
    el.hidden = false;
  }

  // Draw Static Radar Grid & Range Rings
  function renderRadarGrid() {
    const group = $("radar-grid-group");
    if (!group) return;
    const center = project(CITY_COORDS.latitude, CITY_COORDS.longitude);

    const radii = [60, 120, 180, 240];
    const labels = ["20 KM", "40 KM", "60 KM", "80 KM"];

    let ringsHtml = "";
    radii.forEach((r, idx) => {
      ringsHtml += `
        <circle cx="${center.x}" cy="${center.y}" r="${r}" class="radar-range-ring"/>
        <text x="${center.x + r - 16}" y="${center.y - 6}" class="range-ring-label">${labels[idx]}</text>
      `;
    });

    // Crosshairs
    ringsHtml += `
      <line x1="${center.x}" y1="20" x2="${center.x}" y2="460" class="grid-line"/>
      <line x1="20" y1="${center.y}" x2="700" y2="${center.y}" class="grid-line"/>
    `;

    group.innerHTML = ringsHtml;
  }

  // Render GHMC Sector Polygons & Centroids
  function renderGhmcSectors(zones, targetZones) {
    const group = $("ghmc-sectors-group");
    if (!group) return;

    if (!layerState.sectors) {
      group.innerHTML = "";
      return;
    }

    const html = (zones || []).map((z) => {
      const pt = project(z.lat, z.lon);
      const isTargeted = (targetZones || []).some(
        (tz) => z.name.toLowerCase().includes(tz.toLowerCase()) || tz.toLowerCase().includes(z.name.toLowerCase())
      );
      const polyClass = isTargeted ? "sector-polygon threatened" : "sector-polygon";
      const radius = isTargeted ? 34 : 26;

      return `
        <g class="ghmc-sector-item" data-zone="${z.zone_id}">
          <circle cx="${pt.x}" cy="${pt.y}" r="${radius}" class="${polyClass}"/>
          <circle cx="${pt.x}" cy="${pt.y}" r="4" class="sector-centroid-dot"/>
          <text x="${pt.x}" y="${pt.y + 16}" text-anchor="middle" class="sector-text">${z.name.replace(" Zone", "")}</text>
        </g>
      `;
    }).join("");

    group.innerHTML = html;
  }

  // Render Convective Cell, Reflectivity Rings, Trajectory, and Impact Cone
  function renderTacticalStorm(payload) {
    const tracking = payload.tracking || {};
    const storms = tracking.storms || [];
    const history = tracking.history || [];
    const motion = tracking.motion || {};

    const pastTrackEl = $("storm-past-track");
    const forecastVectorEl = $("storm-forecast-vector");
    const waypointsGroup = $("trajectory-waypoints-group");
    const stormCellGroup = $("storm-cell-group");
    const impactConeGroup = $("impact-cone-group");

    // Past track line
    if (history.length > 0) {
      const pts = history.map((pt) => project(pt.latitude, pt.longitude));
      const dStr = pts.reduce((acc, p, idx) => (idx === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`), "");
      pastTrackEl.setAttribute("d", dStr);
    } else {
      pastTrackEl.setAttribute("d", "");
    }

    // Active storm detection
    if (storms.length > 0) {
      const primary = storms[0];
      const curPos = primary.current_position || {};
      const pt = project(curPos.latitude || 17.28, curPos.longitude || 78.26);
      const forecast = primary.forecast || {};
      const fp60 = forecast["60min"] || (forecast.predictions && forecast.predictions["60min"]);

      // Trajectory vector line
      if (fp60) {
        const dest = project(fp60.latitude, fp60.longitude);
        forecastVectorEl.setAttribute("x1", pt.x);
        forecastVectorEl.setAttribute("y1", pt.y);
        forecastVectorEl.setAttribute("x2", dest.x);
        forecastVectorEl.setAttribute("y2", dest.y);

        // Waypoints
        const waypoints = [
          { key: "15min", label: "+15m" },
          { key: "30min", label: "+30m" },
          { key: "60min", label: "+60m" },
        ];

        let wpMarkup = "";
        waypoints.forEach((wp) => {
          const wObj = forecast[wp.key] || (forecast.predictions && forecast.predictions[wp.key]);
          if (wObj) {
            const wPt = project(wObj.latitude, wObj.longitude);
            wpMarkup += `
              <circle cx="${wPt.x}" cy="${wPt.y}" r="4" class="waypoint-node"/>
              <text x="${wPt.x + 8}" y="${wPt.y - 4}" class="waypoint-text">${wp.label} (${Math.round(wObj.latitude * 100) / 100}°N)</text>
            `;
          }
        });
        waypointsGroup.innerHTML = wpMarkup;

        // Convective Impact Dispersion Cone
        if (layerState.cone) {
          const dx = dest.x - pt.x;
          const dy = dest.y - pt.y;
          const angle = Math.atan2(dy, dx);
          const spread = 0.35; // ~20 degrees
          const len = Math.sqrt(dx * dx + dy * dy);
          const p1x = pt.x + len * Math.cos(angle - spread);
          const p1y = pt.y + len * Math.sin(angle - spread);
          const p2x = pt.x + len * Math.cos(angle + spread);
          const p2y = pt.y + len * Math.sin(angle + spread);

          impactConeGroup.innerHTML = `
            <polygon points="${pt.x},${pt.y} ${p1x},${p1y} ${p2x},${p2y}" class="impact-cone"/>
          `;
        } else {
          impactConeGroup.innerHTML = "";
        }
      } else {
        forecastVectorEl.setAttribute("x1", 0);
        forecastVectorEl.setAttribute("y1", 0);
        forecastVectorEl.setAttribute("x2", 0);
        forecastVectorEl.setAttribute("y2", 0);
        waypointsGroup.innerHTML = "";
        impactConeGroup.innerHTML = "";
      }

      // Radar Reflectivity Storm Core
      if (layerState.radar) {
        stormCellGroup.innerHTML = `
          <circle cx="${pt.x}" cy="${pt.y}" r="50" class="storm-reflectivity-outer"/>
          <circle cx="${pt.x}" cy="${pt.y}" r="32" class="storm-reflectivity-mid"/>
          <circle cx="${pt.x}" cy="${pt.y}" r="12" class="storm-reflectivity-core"/>
          <text x="${pt.x + 16}" y="${pt.y - 12}" fill="#ffffff" font-family="var(--font-mono)" font-size="11" font-weight="800">
            CELL S01 · Z &gt; 55 dBZ
          </text>
        `;
      } else {
        stormCellGroup.innerHTML = `
          <circle cx="${pt.x}" cy="${pt.y}" r="8" fill="#ff1744" stroke="#ffffff" stroke-width="2"/>
        `;
      }
    } else {
      forecastVectorEl.setAttribute("x1", 0);
      forecastVectorEl.setAttribute("y1", 0);
      forecastVectorEl.setAttribute("x2", 0);
      forecastVectorEl.setAttribute("y2", 0);
      waypointsGroup.innerHTML = "";
      impactConeGroup.innerHTML = "";

      if (history.length > 0) {
        const lastPt = project(history[history.length - 1].latitude, history[history.length - 1].longitude);
        stormCellGroup.innerHTML = `
          <circle cx="${lastPt.x}" cy="${lastPt.y}" r="7" class="storm-point inactive"/>
          <text x="${lastPt.x + 12}" y="${lastPt.y - 6}" fill="#94a3b8" font-family="var(--font-mono)" font-size="10">CELL DISSIPATED / EXITED BOUNDARY</text>
        `;
      } else {
        stormCellGroup.innerHTML = `
          <text x="50" y="60" fill="#64748b" font-family="var(--font-mono)" font-size="11">STAGE 1: ATMOSPHERIC BASELINE — NO ACTIVE CONVECTIVE CELLS</text>
        `;
      }
    }
  }

  // Update Threat Telemetry HUD
  function renderThreatHud(payload) {
    const risk = payload.nowcast?.risk || {};
    const riskScore = risk.index ?? 0;
    const riskLevel = risk.level || "NORMAL";

    const scoreNumEl = $("risk-score-num");
    const badgeEl = $("threat-level-badge");
    const thresholdTextEl = $("risk-threshold-text");

    scoreNumEl.textContent = riskScore;
    badgeEl.textContent = riskLevel;

    scoreNumEl.className = `risk-score-value ${riskLevel.toLowerCase()}`;
    badgeEl.className = `stage-phase-chip ${riskLevel.toLowerCase()}`;

    if (riskLevel === "SEVERE") {
      thresholdTextEl.textContent = "Severe (≥ 75) 🚨";
      thresholdTextEl.style.color = "var(--crimson)";
    } else if (riskLevel === "WARNING") {
      thresholdTextEl.textContent = "Warning (55–74) ⚠";
      thresholdTextEl.style.color = "var(--amber)";
    } else if (riskLevel === "WATCH") {
      thresholdTextEl.textContent = "Watch (30–54)";
      thresholdTextEl.style.color = "var(--cyan)";
    } else {
      thresholdTextEl.textContent = "Normal (< 30)";
      thresholdTextEl.style.color = "var(--emerald)";
    }

    // Lightning horizons
    const lightning = payload.nowcast?.lightning?.probabilities_percent || {};
    const prob30 = lightning["30min"] ?? 0;
    const prob15 = lightning["15min"] ?? 0;
    const prob60 = lightning["60min"] ?? 0;

    $("lightning-prob-main").textContent = `${prob30}%`;
    $("lightning-band-sub").textContent = payload.nowcast?.lightning?.risk_band || "Low Hazard";

    $("prob-15m").textContent = `${prob15}%`;
    $("prob-30m").textContent = `${prob30}%`;
    $("prob-60m").textContent = `${prob60}%`;

    $("bar-15m").style.width = `${prob15}%`;
    $("bar-30m").style.width = `${prob30}%`;
    $("bar-60m").style.width = `${prob60}%`;

    // Tracking & Kinematics
    const tracking = payload.member_outputs?.member4_tracking || {};
    const eta = tracking.eta_minutes;
    const speed = tracking.speed_kmh;
    const direction = tracking.direction || "NE";

    if (eta !== null && eta !== undefined) {
      $("eta-main").textContent = `${eta} min`;
      $("eta-sub").textContent = "Direct approach to Hyderabad core";
    } else {
      $("eta-main").textContent = "--";
      $("eta-sub").textContent = "Clear of city boundary";
    }

    $("speed-main").textContent = speed !== null && speed !== undefined ? `${speed} km/h` : "-- km/h";
    $("heading-sub").textContent = `Heading: ${direction} · Doppler Locked`;

    // Weather Instability
    const weather = payload.member_outputs?.member1_weather || {};
    const cape = weather.cape ?? 0;
    const humidity = weather.humidity ?? 0;
    const instability = weather.instability || "NORMAL";

    $("cape-main").textContent = `${Math.round(cape)} J/kg`;
    $("instability-level-sub").textContent = `Instability: ${instability} (${Math.round(humidity)}% RH)`;
  }

  // Multi-Stage Pipeline Visualization
  function renderPipelineFlow(stepIdx) {
    const nodes = [
      { id: "node-m1", activeStep: 1, summary: "Thermodynamic CAPE/CIN destabilization" },
      { id: "node-m2", activeStep: 2, summary: "INSAT-3DR glaciation & vertical cooling" },
      { id: "node-m3", activeStep: 3, summary: "Mixed-phase electrification & XGBoost AI" },
      { id: "node-m4", activeStep: 4, summary: "Doppler tracking & Haversine arrival ETA" },
      { id: "node-m5", activeStep: 4, summary: "Calibrated multi-stage threat fusion" },
      { id: "node-m6", activeStep: 5, summary: "Bilingual disaster alert delivery" },
    ];

    nodes.forEach((n) => {
      const el = $(n.id);
      if (!el) return;
      if (stepIdx >= n.activeStep) {
        el.classList.add("active");
      } else {
        el.classList.remove("active");
      }
    });
  }

  // AI Explainability Decomposition Matrix
  function renderExplainability(payload) {
    const risk = payload.nowcast?.risk || {};
    const contrib = risk.contributions || {};

    const s1 = contrib.member1_instability_score ?? 50;
    const s2 = contrib.member2_satellite_growth_score ?? 65;
    const s3 = contrib.member3_lightning_probability ?? 50;
    const s4 = contrib.member4_tracking_urgency_score ?? 85;

    $("factor-score-m1").textContent = `${Math.round(s1)}/100`;
    $("factor-score-m2").textContent = `${Math.round(s2)}/100`;
    $("factor-score-m3").textContent = `${Math.round(s3)}/100`;
    $("factor-score-m4").textContent = `${Math.round(s4)}/100`;

    $("factor-bar-m1").style.width = `${Math.min(100, Math.max(0, s1))}%`;
    $("factor-bar-m2").style.width = `${Math.min(100, Math.max(0, s2))}%`;
    $("factor-bar-m3").style.width = `${Math.min(100, Math.max(0, s3))}%`;
    $("factor-bar-m4").style.width = `${Math.min(100, Math.max(0, s4))}%`;

    // Explainability textual rationale
    const summaryEl = $("ai-reasoning-summary");
    if (summaryEl) {
      if (risk.level === "SEVERE") {
        summaryEl.innerHTML = `<strong>CRITICAL ALERT TRIGGER:</strong> Coincident deep convective cooling (CTT &lt; -60°C), peak thermodynamic instability (CAPE &gt; 3400 J/kg), mixed-phase charge separation, and locked Doppler translation vector (ETA &lt; 35m).`;
        summaryEl.style.borderColor = "var(--crimson)";
      } else if (risk.level === "WARNING") {
        summaryEl.innerHTML = `<strong>ELEVATED THREAT DETECTED:</strong> Moderate-to-high instability combined with rapid cloud shield expansion. Convective cells approaching metropolitan perimeter.`;
        summaryEl.style.borderColor = "var(--amber)";
      } else if (risk.level === "WATCH") {
        summaryEl.innerHTML = `<strong>ATMOSPHERIC WATCH ACTIVE:</strong> Favorable environmental wind shear and moisture accumulation. Convective initiation diagnosed.`;
        summaryEl.style.borderColor = "var(--cyan)";
      } else {
        summaryEl.innerHTML = `<strong>NORMAL CLIMATOLOGY:</strong> Atmosphere remains stable with convective inhibition capping significant updrafts.`;
        summaryEl.style.borderColor = "rgba(45, 75, 110, 0.3)";
      }
    }
  }

  // Bilingual Citizen Emergency Alert Terminal
  function renderAlertTerminal(payload) {
    const alert = payload.alert || {};
    const deckEl = $("alert-command-deck");
    if (!deckEl) return;

    if (alert.active) {
      deckEl.hidden = false;
      $("alert-deck-headline").textContent = `🚨 ${alert.headline}`;
      $("alert-terminal-en").textContent = alert.message_en;
      $("alert-terminal-te").textContent = alert.message_te || "";

      const sectors = alert.target_zones || [];
      $("target-sectors-badge").textContent = `TARGET: ${sectors.join(", ") || "METROPOLITAN CORE"}`;

      // Recommended directives
      const actionsContainer = $("disaster-actions-container");
      actionsContainer.replaceChildren();
      const actions = payload.nowcast?.risk?.recommended_actions || [];
      actions.forEach((act) => {
        const item = document.createElement("div");
        item.className = "action-item";
        item.innerHTML = `<span style="color: var(--amber);">✔</span> <span>${act}</span>`;
        actionsContainer.append(item);
      });
    } else {
      deckEl.hidden = true;
    }
  }

  // Municipal GHMC Sector Threat Table
  function renderSectorMatrix(zones, targetZones, riskLevel) {
    const tbody = $("sector-matrix-body");
    if (!tbody) return;
    tbody.replaceChildren();

    (zones || []).forEach((z) => {
      const isTargeted = (targetZones || []).some(
        (tz) => z.name.toLowerCase().includes(tz.toLowerCase()) || tz.toLowerCase().includes(z.name.toLowerCase())
      );

      let statusBadge = `<span class="stage-phase-chip normal">MONITORING</span>`;
      if (isTargeted) {
        if (riskLevel === "SEVERE") {
          statusBadge = `<span class="stage-phase-chip" style="background: rgba(255, 51, 85, 0.2); border-color: var(--crimson); color: #ff99aa;">IMMINENT IMPACT</span>`;
        } else if (riskLevel === "WARNING") {
          statusBadge = `<span class="stage-phase-chip warning">WARNING</span>`;
        } else {
          statusBadge = `<span class="stage-phase-chip" style="background: rgba(0, 240, 255, 0.15); border-color: var(--cyan); color: #7dd3fc;">WATCH</span>`;
        }
      }

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td style="color: var(--cyan); font-weight: 700;">${z.zone_id}</td>
        <td><strong>${z.name}</strong></td>
        <td>${z.mandals.slice(0, 3).join(", ")}</td>
        <td>${(z.population / 100000).toFixed(1)} Lakh</td>
        <td>${statusBadge}</td>
      `;
      tbody.append(tr);
    });
  }

  // Database Persistence Audit Stream
  async function loadDatabaseHistory() {
    const tbody = $("db-history-body");
    if (!tbody) return;
    try {
      const data = await window.StormDataService.getHistory(8);
      tbody.replaceChildren();
      (data.history || []).forEach((r) => {
        const tr = document.createElement("tr");
        const badgeColor =
          r.risk_level === "SEVERE"
            ? "color: var(--crimson);"
            : r.risk_level === "WARNING"
            ? "color: var(--amber);"
            : "color: var(--emerald);";

        tr.innerHTML = `
          <td style="color: var(--cyan);">#${r.id}</td>
          <td>${(r.timestamp || "").split("T")[1]?.slice(0, 8) || "—"}</td>
          <td>${r.phase || "—"}</td>
          <td style="${badgeColor} font-weight: 700;">${r.risk_score} (${r.risk_level})</td>
          <td>${r.cape != null ? Math.round(r.cape) + " J/kg" : "—"}</td>
          <td>${r.cooling_rate != null ? r.cooling_rate + "°C/h" : "—"}</td>
          <td>${r.lightning_prob != null ? r.lightning_prob + "%" : "—"}</td>
          <td>${r.eta_minutes != null ? Math.round(r.eta_minutes) + "m" : "—"}</td>
        `;
        tbody.append(tr);
      });
    } catch (err) {
      console.warn("Could not fetch database logs:", err);
    }
  }

  // Master Render Cycle
  function renderAll(payload) {
    cachedPayload = payload;
    const scenario = payload.scenario || {};

    // Progress bar and stage details
    $("lifecycle-progress-fill").style.width = `${(scenario.step / (TOTAL_STEPS - 1)) * 100}%`;
    $("step-count-display").textContent = `STAGE ${scenario.step + 1} OF ${TOTAL_STEPS}`;
    $("stage-name-display").textContent = scenario.label || `Step ${scenario.step}`;
    $("stage-desc-display").textContent = scenario.description || "";
    $("stage-time-display").textContent = `Timeline: ${scenario.timestamp}`;

    const phaseChip = $("stage-phase-chip");
    phaseChip.textContent = (scenario.phase || "").toUpperCase();
    phaseChip.className = `stage-phase-chip ${payload.alert?.active ? "severe" : "normal"}`;

    // Components
    renderThreatHud(payload);
    renderTacticalStorm(payload);
    renderGhmcSectors(payload.ghmc_zones, payload.alert?.target_zones);
    renderPipelineFlow(scenario.step);
    renderExplainability(payload);
    renderAlertTerminal(payload);
    renderSectorMatrix(payload.ghmc_zones, payload.alert?.target_zones, payload.nowcast?.risk?.level);
    loadDatabaseHistory();

    // Button states
    $("btn-prev").disabled = currentStep === 0;
    $("btn-next").disabled = currentStep === TOTAL_STEPS - 1;
  }

  // Step Loading
  async function loadStep(nextStep) {
    $("error-message").hidden = true;
    try {
      const payload = await window.StormDataService.getNowcast(nextStep);
      currentStep = nextStep;
      renderAll(payload);
      setConnectionStatus(true, "DEFCON-1 MONITORING");
    } catch (err) {
      setConnectionStatus(false, "API UNAVAILABLE");
      showErrorMessage(`API Communication Fault: ${err.message}`);
      stopPlayback();
    }
  }

  function stopPlayback() {
    if (playbackTimer !== null) {
      clearInterval(playbackTimer);
      playbackTimer = null;
    }
    const btn = $("btn-play");
    if (btn) btn.textContent = "▶ RUN SIMULATION";
  }

  function startPlayback() {
    if (playbackTimer !== null) {
      stopPlayback();
      return;
    }
    if (currentStep === TOTAL_STEPS - 1) {
      loadStep(0);
    }
    const btn = $("btn-play");
    if (btn) btn.textContent = "⏸ PAUSE SIMULATION";
    playbackTimer = setInterval(() => {
      if (currentStep >= TOTAL_STEPS - 1) {
        stopPlayback();
      } else {
        loadStep(currentStep + 1);
      }
    }, 2800);
  }

  // Layer Toggles
  function initLayerToggles() {
    $("toggle-radar")?.addEventListener("change", (e) => {
      layerState.radar = e.target.checked;
      if (cachedPayload) renderTacticalStorm(cachedPayload);
    });
    $("toggle-cone")?.addEventListener("change", (e) => {
      layerState.cone = e.target.checked;
      if (cachedPayload) renderTacticalStorm(cachedPayload);
    });
    $("toggle-sectors")?.addEventListener("change", (e) => {
      layerState.sectors = e.target.checked;
      if (cachedPayload) renderGhmcSectors(cachedPayload.ghmc_zones, cachedPayload.alert?.target_zones);
    });
    $("toggle-sweep")?.addEventListener("change", (e) => {
      layerState.sweep = e.target.checked;
      const beam = $("radar-sweep-beam");
      if (beam) beam.style.display = layerState.sweep ? "block" : "none";
    });
  }

  // Initialize Event Listeners
  function initEvents() {
    $("btn-prev")?.addEventListener("click", () => loadStep(Math.max(0, currentStep - 1)));
    $("btn-next")?.addEventListener("click", () => loadStep(Math.min(TOTAL_STEPS - 1, currentStep + 1)));
    $("btn-reset")?.addEventListener("click", () => {
      stopPlayback();
      loadStep(0);
    });
    $("btn-play")?.addEventListener("click", startPlayback);
    $("btn-refresh-history")?.addEventListener("click", loadDatabaseHistory);
  }

  // Bootstrap
  initClock();
  renderRadarGrid();
  initLayerToggles();
  initEvents();
  loadStep(currentStep);
})();
