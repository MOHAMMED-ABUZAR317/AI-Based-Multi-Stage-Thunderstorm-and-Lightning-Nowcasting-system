/**
 * MapManager - Real Geospatial Maps & High-Performance Visualization
 * Features:
 * 1. Real Satellite Imagery (ESRI World Imagery), Real Topographic, Real Streets & Tactical Dark
 * 2. Real Global Doppler Weather Radar Overlay (RainViewer Live API)
 * 3. Real Key Metropolitan Landmarks (Hussain Sagar, RGIA Airport, HITEC City, etc.)
 * 4. User Geolocation (GPS "Locate Me") with real-time range/bearing to storm
 * 5. Dynamic 3-Tier Risk Envelopes, Lightning Strikes, Motion Cone, and Storm Centroid
 */
const MapManager = (function() {
  'use strict';

  let map = null;
  let baseLayers = {};
  let currentBaseLayer = null;
  let currentTheme = 'satellite'; // Default to Real Satellite!
  let isClassicMode = false;
  let classicFeedCache = null;

  let layers = {};
  let layerVisibility = {
    risk: true,
    lightning: true,
    track: true,
    radar: true,
    liveRadar: true,
    landmarks: true,
    userLoc: true
  };

  // Cached persistent marker references
  let stormMarker = null;
  let userMarker = null;
  let gpsMarker = null;
  let gpsCircle = null;
  let rainViewerLayer = null;
  let latestRadarTimestamp = null;

  // Hyderabad State Disaster Operations Center (EOC)
  const OPERATOR_LOC = {
    lat: 17.4065,
    lon: 78.4772,
    name: 'State Disaster Operations Command (EOC)',
    elevation: '542m MSL'
  };

  // Real Key Metropolitan Infrastructure / Landmarks
  const LANDMARKS = [
    { id: 'lm-hitec', name: 'Cyber Towers (HITEC City)', lat: 17.4504, lon: 78.3808, type: 'IT Hub', icon: '🏢' },
    { id: 'lm-lake', name: 'Hussain Sagar Lake', lat: 17.4239, lon: 78.4738, type: 'Waterbody / Flood Sensor', icon: '🌊' },
    { id: 'lm-airport', name: 'Rajiv Gandhi Int. Airport (RGIA)', lat: 17.2403, lon: 78.4294, type: 'Aviation Runway 09/27', icon: '✈️' },
    { id: 'lm-secunderabad', name: 'Secunderabad Junction', lat: 17.4344, lon: 78.5017, type: 'Transit Hub', icon: '🚆' },
    { id: 'lm-charminar', name: 'Charminar Heritage Sector', lat: 17.3616, lon: 78.4747, type: 'High Density Zone', icon: '🏛️' },
    { id: 'lm-cantonment', name: 'Bolarum AWS Station', lat: 17.5140, lon: 78.5170, type: 'Meteorological Sensor', icon: '📡' }
  ];

  function init(mapElementId) {
    if (map) return map;

    map = L.map(mapElementId, {
      center: [17.40, 78.48],
      zoom: 11,
      minZoom: 7,
      maxZoom: 18,
      zoomControl: true,
      attributionControl: true
    });

    // ── 1. REAL BASE MAP TILES ──
    // A. Real Satellite Map (ESRI World Imagery - Photorealistic Aerial)
    baseLayers.satellite = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      attribution: '© <a href="https://www.esri.com/">Esri</a>, Maxar, Earthstar Geographics | StormNow Pro',
      maxZoom: 19
    });

    // B. Real Street Map (OpenStreetMap Standard - Crisp Roads & Waterways)
    baseLayers.streets = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> | StormNow Pro',
      subdomains: 'abc',
      maxZoom: 19
    });

    // C. Real Topographic Terrain Map (ESRI World Topo - Contours & Elevation)
    baseLayers.topo = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}', {
      attribution: '© <a href="https://www.esri.com/">Esri</a> Topographic | StormNow Pro',
      maxZoom: 19
    });

    // D. Tactical Dark Map (Dark Styled Canvas)
    baseLayers.dark = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap Tactical Dark | StormNow Pro',
      subdomains: 'abc',
      maxZoom: 19
    });

    // E. Hyderabad HD — Clean Cartographic Map bounded to Hyderabad Metro
    baseLayers.hydHD = L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      attribution: '© <a href="https://carto.com/">CARTO</a> Voyager | Hyderabad HD | StormNow Pro',
      subdomains: 'abcd',
      maxZoom: 19
    });

    // F. Classic Canvas Map — Retro grid-style canvas from StormNow v1
    // Uses the same tile layer underneath but overlays a canvas renderer
    baseLayers.classic = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png', {
      attribution: '© CARTO Dark No Labels | Classic Mode | StormNow Pro',
      subdomains: 'abcd',
      maxZoom: 19
    });

    // Set Default Base Map (Real Satellite!)
    setBaseMap('satellite');

    // ── 2. INITIALIZE DEDICATED OVERLAY LAYERS ──
    layers.liveRadar = L.layerGroup().addTo(map);
    layers.radar = L.layerGroup().addTo(map);
    layers.risk = L.layerGroup().addTo(map);
    layers.track = L.layerGroup().addTo(map);
    layers.lightning = L.layerGroup().addTo(map);
    layers.landmarks = L.layerGroup().addTo(map);
    layers.userLoc = L.layerGroup().addTo(map);

    // Initialize Overlays
    initOperatorMarker();
    initLandmarkMarkers();
    initRealWeatherRadar();

    return map;
  }

  /**
   * Switch between Real Base Maps
   */
  function setBaseMap(type) {
    if (!baseLayers[type]) return;
    const mapEl = document.getElementById('map');
    const classicCanvas = document.getElementById('classicMapCanvas');

    if (currentBaseLayer) {
      map.removeLayer(currentBaseLayer);
    }

    currentBaseLayer = baseLayers[type];
    map.addLayer(currentBaseLayer);
    currentTheme = type;

    // Apply dark filter class ONLY if Tactical Dark mode is selected!
    if (mapEl) {
      mapEl.classList.toggle('map-theme-dark', type === 'dark');
    }

    // Hyderabad HD: Lock viewport to Hyderabad metro area
    if (type === 'hydHD') {
      const hydBounds = L.latLngBounds([17.15, 78.20], [17.60, 78.70]);
      map.setMaxBounds(hydBounds);
      map.fitBounds(hydBounds);
      map.setMinZoom(11);
    } else {
      map.setMaxBounds(null);
      map.setMinZoom(7);
    }

    // Classic Canvas Map overlay toggle
    if (classicCanvas) {
      if (type === 'classic') {
        classicCanvas.style.display = 'block';
        isClassicMode = true;
        drawClassicCanvas();
      } else {
        classicCanvas.style.display = 'none';
        isClassicMode = false;
      }
    }

    // Update UI active buttons
    document.querySelectorAll('.basemap-btn').forEach(b => {
      b.classList.toggle('active', b.getAttribute('data-base') === type);
    });
  }

  /**
   * Real Global Doppler Weather Radar Ingestion (RainViewer Live API)
   */
  async function initRealWeatherRadar() {
    try {
      const res = await fetch('https://api.rainviewer.com/public/weather-maps.json');
      if (!res.ok) throw new Error('RainViewer API offline');
      const data = await res.json();
      if (data && data.radar && data.radar.past && data.radar.past.length > 0) {
        const latest = data.radar.past[data.radar.past.length - 1];
        latestRadarTimestamp = latest.time;

        if (rainViewerLayer) {
          layers.liveRadar.removeLayer(rainViewerLayer);
        }

        // Live Doppler Radar Tiles overlay (Global + Hyderabad composite)
        rainViewerLayer = L.tileLayer(`https://tilecache.rainviewer.com/v2/radar/${latestRadarTimestamp}/256/{z}/{x}/{y}/2/1_1.png`, {
          opacity: 0.72,
          zIndex: 400
        });

        if (layerVisibility.liveRadar) {
          layers.liveRadar.addLayer(rainViewerLayer);
        }

        const radarStatusEl = document.getElementById('radar-live-timestamp');
        if (radarStatusEl) {
          radarStatusEl.textContent = `LIVE RADAR: ${new Date(latestRadarTimestamp * 1000).toLocaleTimeString('en-IN', { hour12: false })}`;
        }
      }
    } catch (e) {
      console.warn('Real live radar tile fallback:', e.message);
    }
  }

  /**
   * Real Hyderabad Key Infrastructure & Landmarks
   */
  function initLandmarkMarkers() {
    layers.landmarks.clearLayers();
    LANDMARKS.forEach(lm => {
      const lmIcon = L.divIcon({
        html: `
          <div style="display:flex;align-items:center;gap:4px;
            background:rgba(4,8,15,0.85);border:1px solid rgba(255,255,255,0.18);
            padding:3px 7px;border-radius:12px;backdrop-filter:blur(8px);
            font-family:Inter,sans-serif;font-size:10px;font-weight:700;color:#e2e8f0;
            white-space:nowrap;box-shadow:0 2px 8px rgba(0,0,0,0.6);">
            <span>${lm.icon}</span> ${lm.name.split(' (')[0]}
          </div>`,
        className: '',
        iconAnchor: [35, 12]
      });

      L.marker([lm.lat, lm.lon], { icon: lmIcon })
        .bindPopup(`
          <div style="font-family:Inter,sans-serif;min-width:180px;">
            <div style="font-size:12px;font-weight:800;color:#00d4ff;margin-bottom:3px;">${lm.icon} ${lm.name}</div>
            <div style="font-size:10px;color:#8892b0;">Category: <b style="color:#f0f4ff;">${lm.type}</b></div>
            <div style="font-size:10px;color:#8892b0;">Coordinates: ${lm.lat.toFixed(4)}°N, ${lm.lon.toFixed(4)}°E</div>
            <div id="dist-to-${lm.id}" style="font-size:10px;color:#ffd32a;margin-top:4px;font-weight:600;">Calculating distance to storm...</div>
          </div>
        `, { className: 'custom-popup' })
        .addTo(layers.landmarks);
    });
  }

  function initOperatorMarker() {
    const eocIcon = L.divIcon({
      html: `
        <div style="display:flex;align-items:center;gap:6px;
          background:rgba(4,8,15,0.95);border:1.5px solid #00d4ff;
          padding:5px 11px;border-radius:20px;backdrop-filter:blur(14px);
          font-family:Inter,sans-serif;font-size:11px;font-weight:800;color:#f0f4ff;
          box-shadow:0 0 16px rgba(0,212,255,0.45);white-space:nowrap;">
          <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#00d4ff;box-shadow:0 0 8px #00d4ff;"></span>
          EOC Command Center
        </div>`,
      className: '',
      iconAnchor: [65, 14]
    });

    userMarker = L.marker([OPERATOR_LOC.lat, OPERATOR_LOC.lon], { icon: eocIcon, zIndexOffset: 2000 })
      .bindPopup(`
        <div style="font-family:Inter,sans-serif;min-width:190px;">
          <div style="font-size:13px;font-weight:800;color:#00d4ff;margin-bottom:4px;">📍 ${OPERATOR_LOC.name}</div>
          <div style="font-size:11px;color:#8892b0;">Location: 17.406°N, 78.477°E (Secretariat Complex)</div>
          <div style="font-size:11px;color:#8892b0;">Status: <b style="color:#00e676;">EMERGENCY OPS ACTIVE</b></div>
          <div id="eoc-dist-bearing" style="font-size:11px;color:#ffd32a;margin-top:6px;font-weight:600;">Calculating storm range...</div>
        </div>
      `, { className: 'custom-popup' })
      .addTo(layers.userLoc);
  }

  /**
   * Real Geolocation: "Locate Me" via HTML5 GPS
   */
  function locateUser() {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser.');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      pos => {
        const uLat = pos.coords.latitude;
        const uLon = pos.coords.longitude;
        const accuracy = Math.round(pos.coords.accuracy);

        if (gpsMarker) map.removeLayer(gpsMarker);
        if (gpsCircle) map.removeLayer(gpsCircle);

        const gpsIcon = L.divIcon({
          html: `
            <div style="width:16px;height:16px;border-radius:50%;background:#00e676;border:2.5px solid #ffffff;
              box-shadow:0 0 14px #00e676;animation:gpsPulse 1.5s infinite alternate;">
            </div>
            <style>@keyframes gpsPulse{from{transform:scale(0.9);box-shadow:0 0 8px #00e676}to{transform:scale(1.3);box-shadow:0 0 20px #00e676}}</style>
          `,
          className: '',
          iconAnchor: [8, 8]
        });

        gpsMarker = L.marker([uLat, uLon], { icon: gpsIcon, zIndexOffset: 3000 })
          .bindPopup(`
            <div style="font-family:Inter,sans-serif;">
              <b style="color:#00e676;">📍 Your Real Location</b><br>
              <small style="color:#8892b0;">Lat: ${uLat.toFixed(4)}°, Lon: ${uLon.toFixed(4)}°</small><br>
              <small style="color:#8892b0;">GPS Accuracy: ±${accuracy}m</small>
            </div>
          `, { className: 'custom-popup' })
          .addTo(map);

        gpsCircle = L.circle([uLat, uLon], {
          radius: accuracy,
          color: '#00e676',
          fillColor: '#00e676',
          fillOpacity: 0.08,
          weight: 1
        }).addTo(map);

        map.setView([uLat, uLon], 12);
        gpsMarker.openPopup();
      },
      err => {
        alert(`Location access denied or unavailable: ${err.message}`);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }

  function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    return +(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))).toFixed(1);
  }

  function calculateBearing(lat1, lon1, lat2, lon2) {
    const y = Math.sin((lon2 - lon1) * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180);
    const x = Math.cos(lat1 * Math.PI / 180) * Math.sin(lat2 * Math.PI / 180) -
              Math.sin(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.cos((lon2 - lon1) * Math.PI / 180);
    const brng = (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
    const dirs = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
    return dirs[Math.round(brng / 22.5) % 16];
  }

  /**
   * Update map overlays with live pipeline feeds
   */
  function updateData(feed, riskAssessment) {
    if (!map) return;
    const storm = feed.storm || { lat: 17.40, lon: 78.48, strength: 0.7, reflectivity_dBZ: 50 };
    const tracking = feed.tracking || { direction: 'NE', speed: 35, eta: 25 };
    const lightning = feed.lightning || { p15: 75, strikes: [] };
    const risk = riskAssessment.overall || { score: 65, level: 'MEDIUM' };

    // 1. Distance & Bearing from EOC
    const distKm = calculateDistance(OPERATOR_LOC.lat, OPERATOR_LOC.lon, storm.lat, storm.lon);
    const bearing = calculateBearing(OPERATOR_LOC.lat, OPERATOR_LOC.lon, storm.lat, storm.lon);
    const eocInfoEl = document.getElementById('eoc-dist-bearing');
    if (eocInfoEl) {
      eocInfoEl.textContent = `Storm Range: ${distKm} km ${bearing} · Closing at ${tracking.speed} km/h`;
    }

    // Update landmark distance pills
    LANDMARKS.forEach(lm => {
      const lmDist = calculateDistance(lm.lat, lm.lon, storm.lat, storm.lon);
      const lmDistEl = document.getElementById(`dist-to-${lm.id}`);
      if (lmDistEl) {
        lmDistEl.textContent = `Distance to Storm: ${lmDist} km (${lmDist < 12 ? 'HIGH RISK' : lmDist < 25 ? 'WATCH' : 'SAFE'})`;
      }
    });

    // 2. Risk Zones
    layers.risk.clearLayers();
    if (layerVisibility.risk) {
      const str = storm.strength || 0.7;

      // Outer Advisory Perimeter (~18-22 km)
      L.circle([storm.lat, storm.lon], {
        radius: Math.round(18000 * str),
        color: '#00e676',
        fillColor: '#00e676',
        fillOpacity: 0.05,
        opacity: 0.35,
        weight: 1,
        dashArray: '6, 8'
      }).addTo(layers.risk).bindPopup(`<b style="color:#00e676">🟢 Advisory Zone (Perimeter: ${Math.round(18 * str)} km)</b><br><small style="color:#8892b0">Peripheral gust shifts and overcast ceiling.</small>`);

      // Medium Threat Zone (~10-12 km)
      L.circle([storm.lat, storm.lon], {
        radius: Math.round(10500 * str),
        color: '#ffb142',
        fillColor: '#ffb142',
        fillOpacity: 0.09,
        opacity: 0.5,
        weight: 1.5,
        dashArray: '5, 6'
      }).addTo(layers.risk).bindPopup(`<b style="color:#ffb142">🟠 Warning Zone (Perimeter: ${Math.round(10.5 * str)} km)</b><br><small style="color:#8892b0">Gusty winds > 45 km/h, rain bands and lightning.</small>`);

      // Severe Core Danger Zone (~4.5-6 km)
      L.circle([storm.lat, storm.lon], {
        radius: Math.round(5200 * str),
        color: '#ff4757',
        fillColor: '#ff4757',
        fillOpacity: 0.18,
        opacity: 0.8,
        weight: 2
      }).addTo(layers.risk).bindPopup(`<b style="color:#ff4757">🔴 Critical Core (Perimeter: ${Math.round(5.2 * str)} km)</b><br><small style="color:#8892b0">Hail, violent microburst downbursts, frequent CG strikes.</small>`);

      // Storm Centroid Marker
      const stormEyeIcon = L.divIcon({
        html: `
          <div style="width:48px;height:48px;border-radius:50%;
            background:radial-gradient(circle, rgba(79,158,255,0.98) 0%, rgba(79,158,255,0.35) 50%, transparent 70%);
            border:2px solid rgba(79,158,255,0.9);
            display:flex;align-items:center;justify-content:center;
            font-size:24px;box-shadow:0 0 24px rgba(79,158,255,0.65), 0 0 45px rgba(79,158,255,0.3);
            animation:eyePulse 1.8s ease infinite alternate;">
            ⛈
          </div>
        `,
        className: '',
        iconAnchor: [24, 24]
      });

      stormMarker = L.marker([storm.lat, storm.lon], { icon: stormEyeIcon, zIndexOffset: 1500 })
        .bindPopup(`
          <div style="font-family:Inter,sans-serif;min-width:180px;">
            <div style="font-size:13px;font-weight:800;color:#4f9eff;margin-bottom:6px;">⛈ Storm Eye Centroid</div>
            <div style="font-size:11px;color:#8892b0;">Coordinates: <b style="color:#f0f4ff;">${storm.lat.toFixed(3)}°N, ${storm.lon.toFixed(3)}°E</b></div>
            <div style="font-size:11px;color:#8892b0;">Core Reflectivity: <b style="color:#ff4757;">${storm.reflectivity_dBZ} dBZ</b></div>
            <div style="font-size:11px;color:#8892b0;">Severity Metric: <b style="color:#ff793f;">${storm.strength} / 1.0</b></div>
            <div style="font-size:11px;color:#8892b0;">Confidence: <b style="color:#00e676;">${storm.confidence}%</b></div>
            <div style="font-size:11px;color:#ffd32a;margin-top:4px;">Threat Level: ${risk.label} (${risk.score}%)</div>
          </div>
        `, { className: 'custom-popup' })
        .addTo(layers.risk);
    }

    // 3. Radar Reflectivity Echo Rings (Simulated Doppler Echo with calibrated dBZ palette)
    layers.radar.clearLayers();
    if (layerVisibility.radar) {
      const echoCount = 6;
      for (let i = 0; i < echoCount; i++) {
        const angle = (i / echoCount) * Math.PI * 2 + 0.3;
        const radLat = storm.lat + Math.cos(angle) * 0.055;
        const radLon = storm.lon + Math.sin(angle) * 0.075;
        const col = i % 2 === 0 ? 'rgba(255,71,87,' : 'rgba(255,177,66,';

        L.circle([radLat, radLon], {
          radius: 3200 + (i * 450),
          color: col + '0.45)',
          fillColor: col + '0.12)',
          fillOpacity: 1,
          weight: 1
        }).addTo(layers.radar);
      }
    }

    // 4. Motion Vector & Projected Cone
    layers.track.clearLayers();
    if (layerVisibility.track) {
      const dirAngles = { N: [1, 0], NE: [0.72, 0.72], E: [0, 1], SE: [-0.72, 0.72], S: [-1, 0], SW: [-0.72, -0.72], W: [0, -1], NW: [0.72, -0.72] };
      const [dLat, dLon] = dirAngles[tracking.direction] || [0.72, 0.72];

      const futLat15 = storm.lat + dLat * 0.06;
      const futLon15 = storm.lon + dLon * 0.08;
      const futLat30 = storm.lat + dLat * 0.12;
      const futLon30 = storm.lon + dLon * 0.16;

      L.polyline([[storm.lat, storm.lon], [futLat15, futLon15], [futLat30, futLon30]], {
        color: '#00d4ff',
        weight: 3.5,
        opacity: 0.9,
        dashArray: '8, 6'
      }).addTo(layers.track);

      const trackIcon = L.divIcon({
        html: `
          <div style="background:rgba(4,8,15,0.92);border:1.5px dashed #00d4ff;border-radius:50%;
            width:34px;height:34px;display:flex;align-items:center;justify-content:center;
            font-size:11px;font-weight:800;color:#00d4ff;box-shadow:0 0 12px rgba(0,212,255,0.5);">
            +30m
          </div>`,
        className: '',
        iconAnchor: [17, 17]
      });

      L.marker([futLat30, futLon30], { icon: trackIcon })
        .bindPopup(`
          <div style="font-family:Inter,sans-serif;">
            <b style="color:#00d4ff;">🛰️ Projected Vector (+30 min)</b><br>
            <small style="color:#8892b0;">Heading: ${tracking.direction} (${tracking.heading_deg}°) · ${tracking.speed} km/h</small>
          </div>
        `, { className: 'custom-popup' })
        .addTo(layers.track);
    }

    // 5. Lightning Strikes
    layers.lightning.clearLayers();
    if (layerVisibility.lightning) {
      const strikes = lightning.strikes || [];
      strikes.forEach(strike => {
        const isCG = strike.type === 'Cloud-to-Ground';
        const boltIcon = L.divIcon({
          html: `
            <div style="font-size:${isCG ? '22px' : '18px'};
              filter:drop-shadow(0 0 10px #ffd32a) drop-shadow(0 0 5px #ff9800);
              cursor:pointer;animation:boltFlicker 1.4s ease infinite alternate;">
              ⚡
            </div>
          `,
          className: '',
          iconAnchor: [11, 20]
        });

        L.marker([strike.lat, strike.lon], { icon: boltIcon })
          .bindPopup(`
            <div style="font-family:Inter,sans-serif;min-width:170px;">
              <div style="font-size:13px;font-weight:800;color:#ffd32a;margin-bottom:4px;">⚡ ${strike.type} Strike</div>
              <div style="font-size:11px;color:#8892b0;">Recorded At: <b style="color:#f0f4ff;">${strike.time}</b></div>
              <div style="font-size:11px;color:#8892b0;">Peak Current: <b style="color:#ff793f;">${strike.amplitude_kA} kA</b></div>
              <div style="font-size:11px;color:#8892b0;">Model Probability: <b style="color:#ffd32a;">${strike.prob}%</b></div>
            </div>
          `, { className: 'lightning-popup' })
          .addTo(layers.lightning);
      });
    }
  }

  function toggleLayer(layerName) {
    if (!layers[layerName]) return false;
    layerVisibility[layerName] = !layerVisibility[layerName];

    if (layerVisibility[layerName]) {
      map.addLayer(layers[layerName]);
    } else {
      map.removeLayer(layers[layerName]);
    }
    return layerVisibility[layerName];
  }

  function invalidateSize() {
    if (map) map.invalidateSize();
  }

  return {
    init,
    setBaseMap,
    locateUser,
    updateData,
    toggleLayer,
    invalidateSize,
    getMap: () => map,
    getLayers: () => layers,
    getVisibility: () => layerVisibility,
    getCurrentTheme: () => currentTheme
  };
})();
