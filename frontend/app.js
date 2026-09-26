(() => {
  "use strict";

  const totalSteps = 7;
  const city = { latitude: 17.385, longitude: 78.4867 };
  let step = 0;
  let timer = null;

  const $ = (id) => document.getElementById(id);
  const buttons = {
    previous: $("previous-button"),
    play: $("play-button"),
    next: $("next-button"),
    reset: $("reset-button"),
  };

  function setConnection(ok, message) {
    const state = $("connection-state");
    state.textContent = message;
    state.className = `status-chip ${ok ? "connected" : "failed"}`;
  }

  function showError(message) {
    const error = $("error-message");
    error.textContent = message;
    error.hidden = false;
  }

  function project(latitude, longitude) {
    return {
      x: 28 + ((longitude - 78.12) / 0.43) * 44,
      y: 20 + (1 - (latitude - 17.16) / 0.31) * 67,
    };
  }

  function renderMap(payload) {
    const width = 720;
    const height = 270;
    const cityPoint = project(city.latitude, city.longitude);
    const history = payload.tracking.history.map((point) =>
      project(point.latitude, point.longitude),
    );
    const storm = payload.tracking.storms[0];
    const forecastPoint = storm?.forecast?.predictions?.["60min"];
    const forecast = forecastPoint
      ? project(forecastPoint.latitude, forecastPoint.longitude)
      : null;
    const gridLines = Array.from({ length: 6 }, (_, index) => {
      const x = 55 + index * 122;
      return `<line class="map-grid" x1="${x}" y1="0" x2="${x}" y2="${height}"/>`;
    }).join("");
    const horizontalLines = Array.from({ length: 4 }, (_, index) => {
      const y = 35 + index * 62;
      return `<line class="map-grid" x1="0" y1="${y}" x2="${width}" y2="${y}"/>`;
    }).join("");
    const route = history.map((point) => `${point.x},${point.y}`).join(" ");
    const last = history.at(-1);
    const forecastMarkup =
      last && forecast
        ? `<line class="forecast-line" x1="${last.x}" y1="${last.y}" x2="${forecast.x}" y2="${forecast.y}"/>`
        : "";
    const stormMarkup = last
      ? `<circle class="storm-point ${storm ? "" : "inactive"}" cx="${last.x}" cy="${last.y}" r="7"/>
         <text class="map-label" x="${last.x + 12}" y="${last.y - 10}">${storm ? "ACTIVE DEMO CELL" : "LAST OBSERVED · CLEARED"}</text>`
      : `<text class="map-sub-label" x="35" y="42">No synthetic detection at baseline</text>`;
    $("map-view").innerHTML = `
      <svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" aria-hidden="true">
        ${gridLines}${horizontalLines}
        <path class="map-region" d="M35 190 C110 160 90 115 170 113 S265 182 345 157 S440 64 510 94 S620 176 700 125"/>
        <path class="map-region" d="M22 225 C115 204 170 236 246 209 S370 153 436 188 S595 235 705 198"/>
        ${route ? `<polyline class="track-line" points="${route}"/>` : ""}
        ${forecastMarkup}
        ${stormMarkup}
        <circle class="city-point" cx="${cityPoint.x}" cy="${cityPoint.y}" r="6"/>
        <text class="map-label" x="${cityPoint.x + 12}" y="${cityPoint.y + 4}">Hyderabad</text>
      </svg>`;
  }

  function renderMembers(members) {
    const list = $("member-list");
    list.replaceChildren();
    members.forEach((member) => {
      const row = document.createElement("div");
      row.className = "member-row";
      const number = document.createElement("span");
      number.className = "member-number";
      number.textContent = `M${member.member}`;
      const details = document.createElement("div");
      const role = document.createElement("div");
      role.className = "member-role";
      role.textContent = member.role;
      const note = document.createElement("div");
      note.className = "member-note";
      note.textContent = member.note;
      details.append(role, note);
      const status = document.createElement("span");
      status.className = `member-status ${member.status.includes("INTEGRATED") ? "available" : ""}`;
      status.textContent = member.status.replaceAll("_", " ");
      row.append(number, details, status);
      list.append(row);
    });
  }

  function renderArchives(archives) {
    const list = $("archive-list");
    list.replaceChildren();
    const weather = archives.member1_weather;
    const weatherCard = createArchiveCard(
      "M1 · Weather archive",
      weather.as_of,
      `${weather.record_count} rows · CAPE ${weather.values.cape_j_kg} J/kg · humidity ${weather.values.humidity_percent}%`,
      weather.note,
    );
    list.append(weatherCard);

    const satellite = archives.member2_satellite;
    const latestTime = satellite.as_of;
    const latestSamples = satellite.samples.filter((sample) => sample.timestamp === latestTime);
    const satelliteSummary = latestSamples
      .map((sample) => `${sample.band}: point ${sample.point_temperature_k.toFixed(1)} K · 3×3 mean ${sample.neighborhood_mean_temperature_k.toFixed(1)} K`)
      .join(" · ");
    list.append(
      createArchiveCard(
        "M2 · INSAT-3DR archive",
        latestTime,
        satelliteSummary || "No point samples available",
        satellite.note,
      ),
    );

    const ctp = archives.member3_ctp;
    list.append(
      createArchiveCard(
        "M3 · Historical CTP input",
        ctp.as_of,
        `${ctp.record_count} rows · cloud-top temperature ${ctp.values.cloud_top_temperature_k.toFixed(1)} K · pressure ${ctp.values.cloud_top_pressure_hpa.toFixed(1)} hPa`,
        ctp.note,
      ),
    );
  }

  function createArchiveCard(title, timestamp, values, note) {
    const card = document.createElement("article");
    card.className = "archive-card";
    const heading = document.createElement("h3");
    heading.textContent = title;
    const date = document.createElement("time");
    date.className = "archive-date";
    date.textContent = timestamp;
    const summary = document.createElement("div");
    summary.className = "archive-values";
    summary.textContent = values;
    const detail = document.createElement("p");
    detail.className = "archive-note";
    detail.textContent = note;
    card.append(heading, date, summary, detail);
    return card;
  }

  function render(payload) {
    const scenario = payload.scenario;
    const risk = payload.nowcast.risk;
    const lightning = payload.nowcast.lightning.probabilities_percent;
    $("step-count").textContent = `Step ${scenario.step + 1} / ${scenario.total_steps}`;
    $("progress-fill").style.width = `${(scenario.step / (scenario.total_steps - 1)) * 100}%`;
    $("stage-label").textContent = scenario.label;
    $("stage-description").textContent = scenario.description;
    $("scenario-time").textContent = `Scenario time: ${scenario.timestamp} · fixed demo clock`;
    $("stage-marker").classList.toggle("alert", scenario.phase === "alert");
    $("risk-index").textContent = `${risk.index} / 100`;
    $("risk-level").textContent = `${risk.level} · scenario-authored, not operational`;
    $("lightning-value").textContent =
      `${lightning["15min"]}% / ${lightning["30min"]}% / ${lightning["60min"]}%`;
    $("storm-count").textContent = String(payload.nowcast.active_storm_count);
    const activeStorm = payload.tracking.storms[0];
    $("motion-detail").textContent = activeStorm?.motion?.speed_kmh == null
      ? scenario.phase === "clearance"
        ? "No active synthetic storm; prior track retained"
        : "Motion unavailable until two detections"
      : `${activeStorm.motion.speed_kmh.toFixed(1)} km/h ${activeStorm.motion.direction} · unvalidated`;
    $("alert-panel").hidden = !payload.alert.active;
    $("alert-description").textContent = payload.alert.message;
    $("previous-button").disabled = step === 0;
    $("next-button").disabled = step === totalSteps - 1;
    renderMembers(payload.members);
    renderArchives(payload.archives);
    renderMap(payload);
  }

  async function loadScenario(nextStep) {
    $("error-message").hidden = true;
    try {
      const payload = await window.StormDataService.getNowcast(nextStep);
      step = nextStep;
      render(payload);
      setConnection(true, "LOCAL API CONNECTED · DEMO");
    } catch (error) {
      setConnection(false, "LOCAL API UNAVAILABLE");
      showError(`Could not load this scenario from the local API: ${error.message}`);
      stopPlayback();
    }
  }

  function stopPlayback() {
    if (timer !== null) {
      window.clearInterval(timer);
      timer = null;
    }
    buttons.play.textContent = "▶ Play scenario";
  }

  buttons.previous.addEventListener("click", () => loadScenario(Math.max(0, step - 1)));
  buttons.next.addEventListener("click", () =>
    loadScenario(Math.min(totalSteps - 1, step + 1)),
  );
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
    buttons.play.textContent = "Ⅱ Pause";
    timer = window.setInterval(() => {
      if (step >= totalSteps - 1) {
        stopPlayback();
      } else {
        loadScenario(step + 1);
      }
    }, 2500);
  });

  loadScenario(step);
})();
