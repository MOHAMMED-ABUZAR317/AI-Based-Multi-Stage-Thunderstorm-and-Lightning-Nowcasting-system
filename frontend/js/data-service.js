(() => {
  "use strict";

  async function getJson(path) {
    const response = await fetch(path, {
      headers: { Accept: "application/json" },
    });
    if (!response.ok) {
      throw new Error(`Local API request failed (${response.status} ${response.statusText}).`);
    }
    return response.json();
  }

  async function postJson(path, payload) {
    const response = await fetch(path, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      throw new Error(`Local API request failed (${response.status} ${response.statusText}).`);
    }
    return response.json();
  }

  window.StormDataService = Object.freeze({
    async getNowcast(step) {
      if (!Number.isInteger(step) || step < 0 || step > 6) {
        throw new RangeError("Scenario step must be an integer from 0 through 6.");
      }
      const payload = await getJson(`/api/v1/nowcast?step=${step}`);
      if (payload.demo !== true || payload.operational !== false) {
        throw new Error("The API response is not explicitly marked as a non-operational demo.");
      }
      return payload;
    },

    async getHistory(limit = 10) {
      return getJson(`/api/v1/database/history?limit=${limit}`);
    },

    async getZones() {
      return getJson("/api/v1/zones/hyderabad");
    },

    async dispatchAlert(alertData) {
      return postJson("/api/v1/alerts/dispatch", alertData);
    },
  });
})();
