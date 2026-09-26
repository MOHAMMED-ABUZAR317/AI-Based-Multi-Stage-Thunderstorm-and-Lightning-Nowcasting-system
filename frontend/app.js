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
    $("member-list").innerHTML = members
      .map((member) => {
        const statusClass = member.status.includes("INTEGRATED") ? "available" : "";
        return `<div class="member-row">
          <span class="member-number">M${member.member}</span>
          <div>
            <div class="member-role">${member.role}</div>
            <div class="member-note">${member.note}</div>
          </div>
          <span class="member-status ${statusClass}">${member.status.replaceAll("_", " ")}</span>
        </div>`;
      })
      .join("");
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
    renderMap(payload);
  }

  async function loadScenario(nextStep) {
    $("error-message").hidden = true;
    try {
      const response = await fetch(`/api/v1/nowcast?step=${nextStep}`, {
        headers: { Accept: "application/json" },
      });
      if (!response.ok) {
        throw new Error(`Nowcast API returned HTTP ${response.status}.`);
      }
      const payload = await response.json();
      if (!payload.demo || payload.operational !== false) {
        throw new Error("API response did not declare the required demo-only status.");
      }
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
