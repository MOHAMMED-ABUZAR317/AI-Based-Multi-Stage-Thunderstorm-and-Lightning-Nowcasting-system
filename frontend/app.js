(() => {
  "use strict";

  const totalSteps = 7;
  const city = { latitude: 17.3850, longitude: 78.4867 };
  let step = 0;
  let timer = null;
  let cachedPayload = null;

  const $ = (id) => document.getElementById(id);
  const buttons = {
    previous: $("previous-button"),
    play: $("play-button"),
    next: $("next-button"),
    reset: $("reset-button"),
    refreshHistory: $("refresh-history-btn"),
  };

  function setConnection(ok, message) {
    const state = $("connection-state");
    if (!state) return;
    state.textContent = message;
    state.className = `status-chip ${ok ? "connected" : "failed"}`;
  }

  function showError(message) {
    const error = $("error-message");
    if (!error) return;
    error.textContent = message;
    error.hidden = false;
  }

  // Geographic projection: maps Hyderabad bounding box to 720 x 310 SVG coordinates
  // Longitude bounds: 78.10 to 78.60 (span 0.50)
  // Latitude bounds: 17.15 to 17.55 (span 0.40)
  function project(latitude, longitude) {
    const minLon = 78.10;
    const maxLon = 78.60;
    const minLat = 17.15;
    const maxLat = 17.55;

    const x = 50 + Math.max(0, Math.min(1, (longitude - minLon) / (maxLon - minLon))) * 620;
    const y = 40 + Math.max(0, Math.min(1, 1 - (latitude - minLat) / (maxLat - minLat))) * 220;
    return { x: Math.round(x), y: Math.round(y) };
  }

  function renderMap(payload) {
    const width = 720;
    const height = 310;
    const cityPoint = project(city.latitude, city.longitude);
    const zones = payload.ghmc_zones || [];
    const targetZones = payload.alert?.target_zones || [];
    const tracking = payload.tracking || {};
    const history = (tracking.history || []).map((pt) => project(pt.latitude, pt.longitude));
    const storm = (tracking.storms || [])[0];

    const forecastPoint = storm?.forecast?.predictions?.["60min"] || storm?.forecast?.["60min"];
    const forecast = forecastPoint ? project(forecastPoint.latitude, forecastPoint.longitude) : null;

    // Grid lines
    const gridLines = [150, 270, 390, 510, 630]
      .map((x) => `<line class="map-grid" x1="${x}" y1="0" x2="${x}" y2="${height}"/>`)
      .join("");
    const horizontalLines = [75, 145, 215, 275]
      .map((y) => `<line class="map-grid" x1="0" y1="${y}" x2="${width}" y2="${y}"/>`)
      .join("");

    // GHMC Zone Sectors
    const zoneElements = zones.map((z) => {
      const pt = project(z.lat, z.lon);
      const isTargeted = targetZones.some((tz) => z.name.toLowerCase().includes(tz.toLowerCase()) || tz.toLowerCase().includes(z.name.toLowerCase()));
      const radius = 24;
      const circleClass = isTargeted ? "map-sector-threat" : "map-sector-boundary";
      return `
        <g class="ghmc-sector" data-zone="${z.zone_id}">
          <circle cx="${pt.x}" cy="${pt.y}" r="${radius}" class="${circleClass}"/>
          <circle cx="${pt.x}" cy="${pt.y}" r="4" class="map-sector-point"/>
          <text x="${pt.x}" y="${pt.y + 16}" text-anchor="middle" class="map-sector-label">${z.name.replace(" Zone", "")}</text>
        </g>
      `;
    }).join("");

    // Past route
    const route = history.map((pt) => `${pt.x},${pt.y}`).join(" ");
    const last = history.at(-1);

    // Trajectory vector
    const forecastMarkup = last && forecast
      ? `<line class="forecast-line" x1="${last.x}" y1="${last.y}" x2="${forecast.x}" y2="${forecast.y}"/>
         <circle cx="${forecast.x}" cy="${forecast.y}" r="4" fill="#5ce1d2"/>
         <text x="${forecast.x + 8}" y="${forecast.y - 6}" class="map-sub-label">+60m ETA</text>`
      : "";

    // Storm cell representation
    let stormMarkup = "";
    if (last) {
      if (storm) {
        stormMarkup = `
          <circle class="storm-buffer" cx="${last.x}" cy="${last.y}" r="38"/>
          <circle class="storm-point" cx="${last.x}" cy="${last.y}" r="8"/>
          <text class="map-label" x="${last.x + 14}" y="${last.y - 8}">ACTIVE STORM CELL (${payload.scenario.phase.toUpperCase()})</text>
        `;
      } else {
        stormMarkup = `
          <circle class="storm-point inactive" cx="${last.x}" cy="${last.y}" r="6"/>
          <text class="map-label" x="${last.x + 12}" y="${last.y - 8}">DISSIPATED / CLEARED</text>
        `;
      }
    } else {
      stormMarkup = `<text class="map-sub-label" x="40" y="45">Stage 1: Stable Atmosphere — No Storm Cells Detected</text>`;
    }

    const cityMarkup = `
      <circle class="city-buffer" cx="${cityPoint.x}" cy="${cityPoint.y}" r="18"/>
      <circle class="city-point" cx="${cityPoint.x}" cy="${cityPoint.y}" r="6"/>
      <text class="map-label" x="${cityPoint.x + 10}" y="${cityPoint.y + 4}">Hyderabad City Center</text>
    `;

    $("map-view").innerHTML = `
      <svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" aria-hidden="true">
        ${gridLines}${horizontalLines}
        ${zoneElements}
        ${route ? `<polyline class="track-line" points="${route}"/>` : ""}
        ${forecastMarkup}
        ${stormMarkup}
        ${cityMarkup}
      </svg>
    `;
  }

  function renderMembers(members) {
    const list = $("member-list");
    if (!list) return;
    list.replaceChildren();
    (members || []).forEach((member) => {
      const row = document.createElement("div");
      row.className = "member-row";

      const num = document.createElement("span");
      num.className = "member-number";
      num.textContent = `M${member.member}`;

      const details = document.createElement("div");
      const role = document.createElement("div");
      role.className = "member-role";
      role.textContent = member.role;
      const note = document.createElement("div");
      note.className = "member-note";
      note.textContent = member.note;
      details.append(role, note);

      const status = document.createElement("span");
      status.className = `member-status ${member.status.includes("INTEGRATED") || member.status.includes("ARCHIVED") ? "available" : ""}`;
      status.textContent = member.status.replaceAll("_", " ");

      row.append(num, details, status);
      list.append(row);
    });
  }

  function renderFusionBars(m5out) {
    const contrib = m5out?.member_contributions || {};
    const s1 = contrib.member1_instability_score ?? 73;
    const s2 = contrib.member2_satellite_growth_score ?? 90;
    const s3 = contrib.member3_lightning_probability ?? 78;
    const s4 = contrib.member4_tracking_urgency_score ?? 95;

    $("score-m1").textContent = `${Math.round(s1)} / 100`;
    $("score-m2").textContent = `${Math.round(s2)} / 100`;
    $("score-m3").textContent = `${Math.round(s3)} / 100`;
    $("score-m4").textContent = `${Math.round(s4)} / 100`;

    $("bar-fill-m1").style.width = `${Math.min(100, Math.max(0, s1))}%`;
    $("bar-fill-m2").style.width = `${Math.min(100, Math.max(0, s2))}%`;
    $("bar-fill-m3").style.width = `${Math.min(100, Math.max(0, s3))}%`;
    $("bar-fill-m4").style.width = `${Math.min(100, Math.max(0, s4))}%`;
  }

  function renderSectorTable(zones, targetZones, riskLevel) {
    const tbody = $("sector-table-body");
    if (!tbody) return;
    tbody.replaceChildren();

    (zones || []).forEach((z) => {
      const isTargeted = (targetZones || []).some(
        (tz) => z.name.toLowerCase().includes(tz.toLowerCase()) || tz.toLowerCase().includes(z.name.toLowerCase())
      );
      const tr = document.createElement("tr");

      let threatText = "NORMAL";
      let threatClass = "threat-normal";

      if (isTargeted) {
        if (riskLevel === "SEVERE") {
          threatText = "IMMINENT IMPACT";
          threatClass = "threat-severe";
        } else if (riskLevel === "WARNING") {
          threatText = "WARNING";
          threatClass = "threat-warning";
        } else {
          threatText = "WATCH ACTIVE";
          threatClass = "threat-watch";
        }
      }

      tr.innerHTML = `
        <td><strong>${z.name}</strong></td>
        <td>${z.mandals.slice(0, 3).join(", ")}</td>
        <td>${(z.population / 100000).toFixed(1)} Lakh</td>
        <td><span class="threat-tag ${threatClass}">${threatText}</span></td>
      `;
      tbody.append(tr);
    });
  }

  async function loadHistoryTable() {
    const tbody = $("history-table-body");
    if (!tbody) return;
    try {
      const res = await window.StormDataService.getHistory(6);
      tbody.replaceChildren();
      (res.history || []).forEach((r) => {
        const tr = document.createElement("tr");
        const badgeClass =
          r.risk_level === "SEVERE"
            ? "threat-severe"
            : r.risk_level === "WARNING"
            ? "threat-warning"
            : r.risk_level === "WATCH"
            ? "threat-watch"
            : "threat-normal";
        tr.innerHTML = `
          <td>Step ${r.step ?? "—"}</td>
          <td>${r.phase || "—"}</td>
          <td><span class="threat-tag ${badgeClass}">${r.risk_score} (${r.risk_level})</span></td>
          <td>${r.cape != null ? Math.round(r.cape) + " J/kg" : "—"}</td>
          <td>${r.lightning_prob != null ? r.lightning_prob + "%" : "—"}</td>
          <td>${r.eta_minutes != null ? Math.round(r.eta_minutes) + " m" : "—"}</td>
          <td>${r.alert_active ? "🚨 DISPATCH" : "STANDBY"}</td>
        `;
        tbody.append(tr);
      });
    } catch (err) {
      console.warn("Could not fetch database history:", err);
    }
  }

  function render(payload) {
    cachedPayload = payload;
    const scenario = payload.scenario;
    const risk = payload.nowcast.risk;
    const lightning = payload.nowcast.lightning.probabilities_percent || {};
    const weather = payload.member_outputs.member1_weather || {};
    const tracking = payload.member_outputs.member4_tracking || {};
    const m5 = payload.member_outputs.member5_fusion || {};

    // Lifecycle indicators
    $("step-count").textContent = `Step ${scenario.step + 1} / ${scenario.total_steps}`;
    $("progress-fill").style.width = `${(scenario.step / (scenario.total_steps - 1)) * 100}%`;
    $("stage-label").textContent = scenario.label;
    $("stage-description").textContent = scenario.description;
    $("scenario-time").textContent = `Convective Timeline: ${scenario.timestamp} (Step ${scenario.step})`;
    $("stage-marker").classList.toggle("alert", payload.alert.active);

    // Primary Metric Grid
    $("risk-index").textContent = `${risk.index} / 100`;
    $("risk-level").textContent = `${risk.level} · Composite Decision`;
    $("lightning-value").textContent = `${lightning["30min"] ?? m5.risk_score ?? "—"}%`;
    $("lightning-horizons").textContent = `15m: ${lightning["15min"] ?? "—"}% | 30m: ${lightning["30min"] ?? "—"}% | 60m: ${lightning["60min"] ?? "—"}%`;

    const speed = tracking.speed_kmh != null ? `${tracking.speed_kmh} km/h ${tracking.direction || "NE"}` : "STATIONARY";
    const etaText = tracking.eta_minutes != null ? `ETA: ${tracking.eta_minutes} min to city` : "Clear of city boundary";
    $("tracking-speed").textContent = speed;
    $("motion-detail").textContent = etaText;

    $("cape-value").textContent = weather.cape != null ? `${Math.round(weather.cape)} J/kg` : "—";
    $("instability-detail").textContent = `Humidity: ${weather.humidity != null ? Math.round(weather.humidity) : "—"}% · Instability: ${weather.instability || "NORMAL"}`;

    // Fusion bars
    renderFusionBars(payload.nowcast.risk);

    // Alert Panel
    const alertPanel = $("alert-panel");
    if (payload.alert.active) {
      alertPanel.hidden = false;
      $("alert-title").textContent = payload.alert.headline;
      $("alert-description-en").textContent = payload.alert.message_en;
      $("alert-description-te").textContent = payload.alert.message_te || "";
      $("alert-zones-tag").textContent = `SECTORS: ${(payload.alert.target_zones || []).join(", ") || "METROPOLITAN CORE"}`;

      const actionsList = $("alert-actions-list");
      actionsList.replaceChildren();
      (risk.recommended_actions || []).forEach((act) => {
        const li = document.createElement("li");
        li.textContent = act;
        actionsList.append(li);
      });
    } else {
      alertPanel.hidden = true;
    }

    // Navigation buttons state
    buttons.previous.disabled = step === 0;
    buttons.next.disabled = step === totalSteps - 1;

    // Components
    renderMembers(payload.members);
    renderMap(payload);
    renderSectorTable(payload.ghmc_zones, payload.alert.target_zones, risk.level);
    loadHistoryTable();
  }

  async function loadScenario(nextStep) {
    $("error-message").hidden = true;
    try {
      const payload = await window.StormDataService.getNowcast(nextStep);
      step = nextStep;
      render(payload);
      setConnection(true, "API CONNECTED · MULTI-STAGE LIVE");
    } catch (error) {
      setConnection(false, "API UNAVAILABLE");
      showError(`Could not load scenario from API: ${error.message}`);
      stopPlayback();
    }
  }

  function stopPlayback() {
    if (timer !== null) {
      window.clearInterval(timer);
      timer = null;
    }
    buttons.play.textContent = "▶ Play Scenario";
  }

  buttons.previous.addEventListener("click", () => loadScenario(Math.max(0, step - 1)));
  buttons.next.addEventListener("click", () => loadScenario(Math.min(totalSteps - 1, step + 1)));
  buttons.reset.addEventListener("click", () => {
    stopPlayback();
    loadScenario(0);
  });
  buttons.play.addEventListener("click", () => {
    if (timer !== null) {
      stopPlayback();
      return;
    }
    if (step === totalSteps - 1) {
      loadScenario(0);
    }
    buttons.play.textContent = "Ⅱ Pause Scenario";
    timer = window.setInterval(() => {
      if (step >= totalSteps - 1) {
        stopPlayback();
      } else {
        loadScenario(step + 1);
      }
    }, 2800);
  });

  if (buttons.refreshHistory) {
    buttons.refreshHistory.addEventListener("click", loadHistoryTable);
  }

  // Initial boot
  loadScenario(step);
})();
