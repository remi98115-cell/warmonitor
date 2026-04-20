// Argos — app logic
// Leaflet map + dashboard grid panels.
(() => {
  const LAYERS = WM.LAYERS;
  const VIEWS  = WM.VIEWS;
  const STATIC = WM.STATIC;
  const FETCH  = WM.fetchers;

  const state = {
    activeLayers: new Set(),
    timeRange: "7d",
    view: "global",
    dashboard: "world",
    center: [20, 0],
    zoom: 2,
    mapMode: "2d",
    liveMode: true,
    soundOn: false,
    clusterOn: true,
    heatmapOn: false,
    labelsOn: true,
    events: [],
    filtered: [],
    lastUpdate: null,
  };

  // URL state
  function parseURL() {
    const p = new URLSearchParams(location.search);
    if (p.get("lat") && p.get("lon")) state.center = [parseFloat(p.get("lat")), parseFloat(p.get("lon"))];
    if (p.get("zoom")) state.zoom = parseFloat(p.get("zoom"));
    if (p.get("view")) state.view = p.get("view");
    if (p.get("timeRange")) state.timeRange = p.get("timeRange");
    if (p.get("layers")) {
      p.get("layers").split(",").forEach(id => state.activeLayers.add(id));
    } else {
      ["conflicts","bases","hotspots","nuclear","sanctions","weather","economic","waterways","outages","cyberThreats","military","natural","iranAttacks","aircraft","shipping","disease"]
        .forEach(id => state.activeLayers.add(id));
    }
    if (p.get("dash")) state.dashboard = p.get("dash");
  }
  function updateURL() {
    const p = new URLSearchParams();
    p.set("lat", state.center[0].toFixed(4));
    p.set("lon", state.center[1].toFixed(4));
    p.set("zoom", state.zoom.toFixed(2));
    p.set("view", state.view);
    p.set("timeRange", state.timeRange);
    p.set("layers", [...state.activeLayers].join(","));
    p.set("dash", state.dashboard);
    history.replaceState(null, "", "?" + p.toString());
  }

  // Map
  let map, markerGroups = {}, heatLayer, terminatorLayer;

  function initMap() {
    map = L.map("map", {
      zoomControl: true,
      worldCopyJump: false,
      minZoom: 2,
      maxZoom: 12,
      preferCanvas: true,
      maxBounds: [[-85, -180], [85, 180]],
      maxBoundsViscosity: 1.0,
    }).setView(state.center, state.zoom);

    // Satellite Esri (imagerie aérienne haute résolution)
    L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
      attribution: '&copy; Esri · DigitalGlobe · Argos',
      maxZoom: 18,
      noWrap: true,
      bounds: [[-90, -180], [90, 180]],
    }).addTo(map);
    // Surcouche labels (noms pays/villes) au-dessus du satellite
    L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}", {
      attribution: '',
      maxZoom: 18,
      noWrap: true,
      pane: "overlayPane",
    }).addTo(map);

    map.on("moveend", () => {
      const c = map.getCenter();
      state.center = [c.lat, c.lng];
      state.zoom = map.getZoom();
      updateURL();
    });

    // Couches sans cluster : peu de markers et icônes spécifiques (ship, etc.)
    const NO_CLUSTER = new Set(["shipping"]);
    LAYERS.forEach(l => {
      const useCluster = state.clusterOn && !NO_CLUSTER.has(l.id);
      const grp = useCluster ? L.markerClusterGroup({
        maxClusterRadius: 48, showCoverageOnHover: false, spiderfyOnMaxZoom: true,
      }) : L.layerGroup();
      markerGroups[l.id] = grp;
    });

    setTimeout(() => map.invalidateSize(), 200);
  }

  // Sidebar layers
  function renderLayers() {
    const ul = document.getElementById("layers");
    ul.innerHTML = "";
    LAYERS.forEach(l => {
      const li = document.createElement("li");
      li.className = "layer-item" + (state.activeLayers.has(l.id) ? " active" : "") + (l.locked ? " locked" : "");
      li.dataset.id = l.id;
      li.innerHTML = `
        <div class="check"></div>
        <span class="icon">${l.icon}</span>
        <span class="swatch" style="background:${l.color}"></span>
        <span class="label">${l.label}</span>
        <span class="count" data-count="${l.id}">0</span>
      `;
      li.addEventListener("click", () => {
        if (l.locked) { toast("Couche verrouillée — abonnement requis"); return; }
        if (state.activeLayers.has(l.id)) state.activeLayers.delete(l.id);
        else state.activeLayers.add(l.id);
        li.classList.toggle("active");
        updateURL();
        applyFilters(); // recompile state.filtered + re-render carte/stats/légende
      });
      ul.appendChild(li);
    });
  }

  // Met à jour seulement les badges count des couches (left sidebar)
  // Les stat-cards severity sont gérées en live par updateLiveStats() depuis Instabilité
  function renderStats() {
    const byLayer = {};
    for (const e of state.filtered) byLayer[e._layer] = (byLayer[e._layer] || 0) + 1;
    LAYERS.forEach(l => {
      const c = document.querySelector(`[data-count="${l.id}"]`);
      if (c) c.textContent = byLayer[l.id] || 0;
    });
  }

  function renderLegend() {
    const el = document.getElementById("legend");
    const active = LAYERS.filter(l => state.activeLayers.has(l.id));
    if (!active.length) { el.innerHTML = ""; el.style.display = "none"; return; }
    el.style.display = "block";
    // Show first 10 to keep compact, with severity markers
    const items = active.slice(0, 12);
    el.innerHTML = `<h4>Légende</h4>` + items.map(l =>
      `<div class="legend-item"><span class="dot" style="background:${l.color}"></span>${l.icon} ${l.label}</div>`
    ).join("");
  }

  // Load
  async function loadAll() {
    setUpdating(true);
    const events = [];
    for (const l of LAYERS) {
      const arr = STATIC[l.id] || [];
      arr.forEach(e => events.push({ ...e, _layer: l.id, id: e.id || `${l.id}-${Math.random().toString(36).slice(2, 8)}` }));
    }
    const live = await Promise.all([
      FETCH.natural(state.timeRange),
      FETCH.earthquakes(state.timeRange),
      FETCH.fires(state.timeRange),
      FETCH.weather(state.timeRange),
      FETCH.aircraft(),
      FETCH.ships(),
    ]);
    const [natural, quakes, fires, weather, aircraft, ships] = live;
    if (natural) natural.forEach(e => events.push({ ...e, _layer: "natural" }));
    if (quakes)  quakes.forEach(e => events.push({ ...e, _layer: "natural" }));
    if (fires)   fires.forEach(e => events.push({ ...e, _layer: "fires" }));
    if (weather) weather.forEach(e => events.push({ ...e, _layer: "weather" }));
    if (aircraft) aircraft.forEach(e => events.push({ ...e, _layer: "aircraft" }));
    if (ships) ships.forEach(e => events.push({ ...e, _layer: "shipping" }));
    state.events = events;
    state.lastUpdate = new Date();
    applyFilters();
    setUpdating(false);
    const info = document.getElementById("updateInfo");
    if (info) info.textContent = "MAJ " + state.lastUpdate.toLocaleTimeString("fr-FR");
    renderDashboardPanels();
  }

  function setUpdating(on) { document.getElementById("refresh")?.classList.toggle("spinning", on); }

  function applyFilters() {
    const now = Date.now();
    const ranges = { "1h": 3600e3, "6h": 6*3600e3, "24h": 86400e3, "48h": 48*3600e3, "7d": 7*86400e3, "30d": 30*86400e3, "90d": 90*86400e3, "all": Infinity };
    const span = ranges[state.timeRange] ?? ranges["7d"];
    const cutoff = span === Infinity ? -Infinity : now - span;
    state.filtered = state.events.filter(e => {
      if (!state.activeLayers.has(e._layer)) return false;
      if (e.date) {
        const t = new Date(e.date).getTime();
        if (t < cutoff) return false;
      }
      return true;
    });
    renderMapLayers();
    renderStats();
    renderLegend();
  }

  function renderMapLayers() {
    LAYERS.forEach(l => {
      const g = markerGroups[l.id];
      g.clearLayers();
      if (state.activeLayers.has(l.id)) { if (!map.hasLayer(g)) g.addTo(map); }
      else { if (map.hasLayer(g)) map.removeLayer(g); }
    });
    state.filtered.forEach(ev => {
      const layer = LAYERS.find(l => l.id === ev._layer); if (!layer) return;
      markerGroups[ev._layer].addLayer(buildMarker(ev, layer));
    });
    if (state.heatmapOn) {
      const pts = state.filtered.map(e => [e.lat, e.lon, severityWeight(e.sev)]);
      if (heatLayer) map.removeLayer(heatLayer);
      heatLayer = L.heatLayer(pts, { radius: 22, blur: 18, maxZoom: 8 }); heatLayer.addTo(map);
    } else if (heatLayer) { map.removeLayer(heatLayer); heatLayer = null; }
    if (state.activeLayers.has("daynight")) drawTerminator(); else clearTerminator();
  }

  function severityWeight(sev) { return ({ critical: 1, high: 0.75, med: 0.5, low: 0.25 })[sev] || 0.3; }

  function buildMarker(ev, layer) {
    const size = ev.sev === "critical" ? 14 : ev.sev === "high" ? 11 : ev.sev === "med" ? 9 : 7;
    const pulse = ev.sev === "critical" || ev.sev === "high" ? " marker-pulse" : "";
    let icon;
    if (layer.id === "shipping") {
      icon = L.divIcon({
        className: "custom-marker ship-marker",
        html: `<span style="font-size:18px;line-height:1;text-shadow:0 0 4px rgba(0,0,0,.9);filter:drop-shadow(0 0 2px ${layer.color})">🚢</span>`,
        iconSize: [22, 22], iconAnchor: [11, 11],
      });
    } else if (layer.id === "aisShips") {
      // Triangle vert pivoté selon le cap pour navires AIS live
      const heading = ev._heading || 0;
      icon = L.divIcon({
        className: "custom-marker ais-marker",
        html: `<span style="display:inline-block;font-size:13px;line-height:1;color:${layer.color};transform:rotate(${heading}deg);text-shadow:0 0 3px rgba(0,0,0,.9)">▲</span>`,
        iconSize: [16, 16], iconAnchor: [8, 8],
      });
    } else if (layer.id === "aircraft") {
      icon = L.divIcon({
        className: "custom-marker aircraft-marker",
        html: `<span style="font-size:14px;line-height:1;color:${layer.color};text-shadow:0 0 4px rgba(0,0,0,.9)">✈</span>`,
        iconSize: [16, 16], iconAnchor: [8, 8],
      });
    } else {
      icon = L.divIcon({
        className: `custom-marker${pulse}`,
        html: `<span style="background:${layer.color};width:${size}px;height:${size}px;border-radius:50%;display:block;color:${layer.color};"></span>`,
        iconSize: [size+4, size+4], iconAnchor: [(size+4)/2, (size+4)/2],
      });
    }
    const m = L.marker([ev.lat, ev.lon], { icon });
    // Aircraft : description riche en HTML déjà sanitisée à la source (data.js)
    // Autres layers : escape pour sécurité
    const descHtml = layer.id === "aircraft" ? (ev.desc || "") : escapeHtml(ev.desc || "");
    const linkLabel = layer.id === "aircraft" ? "Voir vol sur FlightAware ↗" : "Source →";
    const html = `
      <div class="popup-title">${layer.icon} ${escapeHtml(ev.title || layer.label)}</div>
      <div class="popup-meta">
        ${ev.sev ? `<span class="popup-severity sev-${ev.sev}">${labelSev(ev.sev)}</span>` : ""}
        ${ev.date ? `<span>${relDate(ev.date)}</span>` : ""}
      </div>
      <div class="popup-desc">${descHtml}</div>
      ${(ev.tags || []).map(t => `<span class="popup-tag">${escapeHtml(t)}</span>`).join("")}
      ${ev.url ? `<div style="margin-top:6px"><a href="${ev.url}" target="_blank" style="color:var(--accent);font-size:10px">${linkLabel}</a></div>` : ""}
    `;
    m.bindPopup(html, { maxWidth: 320, minWidth: 240 });
    m.on("click", () => showDetail(ev, layer));
    return m;
  }

  function labelSev(s) { return ({ critical: "CRITIQUE", high: "ÉLEVÉ", med: "MOYEN", low: "FAIBLE" })[s] || s.toUpperCase(); }
  function relDate(iso) { const d = new Date(iso); const dif = Date.now() - d.getTime(); if (dif < 3600e3) return Math.round(dif/60000) + " min"; if (dif < 86400e3) return Math.round(dif/3600e3) + "h"; return Math.round(dif/86400e3) + "j"; }
  function escapeHtml(s) { return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }

  function showDetail(ev, layer) {
    const p = document.getElementById("detailPanel");
    const c = document.getElementById("detailContent");
    c.innerHTML = `
      <h3>${layer.icon} ${escapeHtml(ev.title || layer.label)}</h3>
      <div class="row"><span class="k">Couche</span><span>${layer.label}</span></div>
      <div class="row"><span class="k">Sévérité</span><span class="popup-severity sev-${ev.sev}">${labelSev(ev.sev || "low")}</span></div>
      ${ev.date ? `<div class="row"><span class="k">Date</span><span>${new Date(ev.date).toLocaleString("fr-FR")}</span></div>` : ""}
      <div class="row"><span class="k">Coordonnées</span><span>${ev.lat.toFixed(3)}, ${ev.lon.toFixed(3)}</span></div>
      ${(ev.tags||[]).length ? `<div class="row"><span class="k">Tags</span><span>${(ev.tags||[]).join(", ")}</span></div>` : ""}
      ${ev.desc ? `<div class="desc">${escapeHtml(ev.desc)}</div>` : ""}
    `;
    p.hidden = false;
  }
  document.getElementById("detailClose")?.addEventListener("click", () => {
    const p = document.getElementById("detailPanel"); if (p) p.hidden = true;
  });

  // Day/night terminator (solar position)
  function drawTerminator() {
    clearTerminator();
    const pts = [];
    const now = new Date();
    const T = now.getTime()/86400000 - 10957.5;
    for (let lon = -180; lon <= 180; lon += 2) pts.push([solarLat(T, lon), lon]);
    terminatorLayer = L.polygon([...pts, [90, 180], [90, -180]], { color: "#000", fillColor: "#000", fillOpacity: 0.35, stroke: false, interactive: false }).addTo(map);
  }
  function clearTerminator() { if (terminatorLayer) { map.removeLayer(terminatorLayer); terminatorLayer = null; } }
  function solarLat(T, lon) {
    const g = (357.529 + 0.98560028 * T) * Math.PI/180;
    const q = (280.459 + 0.98564736 * T);
    const L = (q + 1.915*Math.sin(g) + 0.020*Math.sin(2*g)) * Math.PI/180;
    const e = (23.439 - 0.00000036 * T) * Math.PI/180;
    const ra = Math.atan2(Math.cos(e)*Math.sin(L), Math.cos(L)) * 180/Math.PI;
    const dec = Math.asin(Math.sin(e)*Math.sin(L)) * 180/Math.PI;
    const GMST = (18.697374558 + 24.06570982441908 * T) % 24;
    const ha = (GMST * 15 + lon - ra) * Math.PI/180;
    return Math.atan(-Math.cos(ha)/Math.tan(dec*Math.PI/180)) * 180/Math.PI;
  }

  // DEFCON — calculé live depuis la moyenne mondiale Instabilité Pays (GDELT)
  // 1 = guerre majeure, 2 = mobilisation, 3 = alerte renforcée, 4 = alerte, 5 = paix
  function updateDEFCON(avgScore) {
    if (avgScore == null) return;
    let level = 5;
    if (avgScore >= 80) level = 1;
    else if (avgScore >= 65) level = 2;
    else if (avgScore >= 50) level = 3;
    else if (avgScore >= 35) level = 4;
    const prev = parseFloat(localStorage.getItem("wm_defcon_prev_avg") || avgScore);
    const delta = prev > 0 ? Math.round(((avgScore - prev) / prev) * 100) : 0;
    try { localStorage.setItem("wm_defcon_prev_avg", String(avgScore)); } catch {}
    const v = document.getElementById("defconValue"); if (v) v.textContent = level;
    const d = document.getElementById("defconDelta");
    if (d) {
      d.textContent = (delta >= 0 ? "+" : "") + delta + "%";
      d.style.color = delta > 1 ? "var(--danger)" : delta < -1 ? "var(--ok)" : "";
    }
  }

  // =========== DASHBOARD PANELS ===========
  const PANEL_META = {
    news:        { label: "Actualités en direct",              src: "YouTube Live · 22 chaînes internationales" },
    camwall:     { label: "Cam en direct",                      src: "YouTube Live · OSINT aggregators · EarthCam" },
    weather:     { label: "Météo monde",                        src: "Open-Meteo · mise à jour 15 min · 60 villes" },
    earthquakes: { label: "Séismes en direct (USGS)",           src: "USGS Earthquake Hazards · M4.5+ semaine" },
    insights:    { label: "Insights IA",                        src: "GDELT 2.0 · USGS · NASA EONET · analyse locale" },
    instability: { label: "Instabilité Pays",                   src: "GDELT 2.0 · ton moyen 24h par pays (live)" },
    risk:        { label: "Vue d'ensemble Risques",             src: "Moyenne live des scores Instabilité Pays (GDELT)" },
    intel:       { label: "Flux de Renseignements",             src: "GDELT 2.0 DOC API · monde entier · 24h" },
    intellive:   { label: "Renseignements en direct",           src: "GDELT 2.0 filtré par catégorie · temps réel" },
    market:      { label: "Implications pour le marché de l'IA",src: "CoinGecko (crypto) · ExchangeRate (forex)" },
    commodities: { label: "Matières premières",                 src: "Yahoo Finance · gold-api · live spot prices" },
    stocks:      { label: "Marchés boursiers",                  src: "Yahoo Finance · indices majeurs (différé ~15 min)" },
    cyber:       { label: "Cybermenaces actives",                src: "CISA Known Exploited Vulnerabilities (gouv US)" },
    predictions: { label: "Prédictions",                        src: "Polymarket Gamma API · marchés de prédiction" },
    airlines:    { label: "Renseignements aériens",             src: "NOAA aviationweather.gov · METAR temps réel" },
    maritime:    { label: "Trafic maritime temps réel",          src: "MarineTraffic AIS · positions navires live" },
    aerien:      { label: "Trafic aérien temps réel",            src: "ADS-B Exchange · positions avions live" },
  };

  function renderDashboardPanels() {
    renderCamwall();
    renderInstability().catch(() => {});
    renderInsights();
    renderNewsCount();
    injectPanelCloseButtons();
    applyHiddenPanels();
    applyPanelOrder();
    scheduleMasonry();
    // Async (fire-and-forget, errors caught inside)
    renderIntelFeed().catch(() => {});
    renderIntelLive().catch(() => {});
    renderMarket().catch(() => {});
    renderInsightsAI().catch(() => {});
    renderWeather().catch(() => {});
    renderQuakes().catch(() => {});
    renderCommodities().catch(() => {});
    renderStocks().catch(() => {});
    renderCyber().catch(() => {});
    renderPredictions().catch(() => {});
    renderAirlines().catch(() => {});
  }

  // ===== MATIÈRES PREMIÈRES =====
  async function renderCommodities() {
    const grid = document.getElementById("commoGrid");
    if (!grid) return;
    const cat = document.querySelector("#commoTabs button.active")?.dataset?.cat || "metals";
    grid.innerHTML = `<div style="grid-column:1/-1;color:var(--text-dim);text-align:center;font-size:11px">Chargement…</div>`;
    const items = await WM.liveFeeds.commodities(cat);
    if (!items.length) { grid.innerHTML = `<div style="color:var(--text-dim);text-align:center">Indisponible</div>`; return; }
    grid.innerHTML = items.map(it => {
      const delta = +it.delta || 0;
      const cls = delta >= 0 ? "up" : "down";
      const sign = delta >= 0 ? "+" : "";
      const price = typeof it.price === "number" ? it.price.toLocaleString("fr-FR", { maximumFractionDigits: 2 }) : it.price;
      return `<div class="commo-cell">
        <div class="commo-name">${escapeHtml(it.ticker)}</div>
        <div class="commo-price">${price} <span class="commo-unit">${escapeHtml(it.unit || "")}</span></div>
        <div class="commo-delta ${cls}">${sign}${delta.toFixed(2)}%</div>
      </div>`;
    }).join("");
  }

  // ===== MARCHÉS BOURSIERS (Yahoo Finance live) =====
  async function renderStocks() {
    const ul = document.getElementById("stocksList");
    if (!ul) return;
    ul.innerHTML = `<li style="color:var(--text-dim);text-align:center;padding:14px">Chargement Yahoo Finance…</li>`;
    const items = await WM.liveFeeds.stocks();
    const c = document.getElementById("stocksCount");
    if (c) c.textContent = items.length;
    if (!items.length) { ul.innerHTML = `<li style="color:var(--text-dim);text-align:center">Indisponible (CORS)</li>`; return; }
    ul.innerHTML = items.map(s => {
      const cls = s.delta >= 0 ? "up" : "down";
      const sign = s.delta >= 0 ? "+" : "";
      const price = typeof s.price === "number" ? s.price.toLocaleString("fr-FR", { maximumFractionDigits: 2 }) : s.price;
      return `<li class="stock-item">
        <div class="stock-name">${escapeHtml(s.ticker)}</div>
        <div class="stock-price">${price}</div>
        <div class="stock-delta ${cls}">${sign}${s.delta.toFixed(2)}%</div>
      </li>`;
    }).join("");
  }

  // ===== CYBERMENACES (CISA KEV live) =====
  async function renderCyber() {
    const ul = document.getElementById("cyberList");
    if (!ul) return;
    ul.innerHTML = `<li style="color:var(--text-dim);text-align:center;padding:14px">Chargement CISA…</li>`;
    const items = await WM.liveFeeds.cisaKEV();
    const c = document.getElementById("cyberCount");
    if (c) c.textContent = items.length;
    if (!items.length) { ul.innerHTML = `<li style="color:var(--text-dim);text-align:center">Indisponible</li>`; return; }
    ul.innerHTML = items.slice(0, 20).map(v => `
      <li class="cyber-item ${v.ransomware ? 'ransom' : ''}">
        <div class="cyber-head">
          <span class="cyber-cve">${escapeHtml(v.cve)}</span>
          ${v.ransomware ? '<span class="cyber-ransom">RANSOMWARE</span>' : ''}
          <span class="cyber-date">${escapeHtml(v.date || "")}</span>
        </div>
        <div class="cyber-name">${escapeHtml(v.name || "")}</div>
        <div class="cyber-meta">${escapeHtml(v.vendor || "")} · ${escapeHtml(v.product || "")}</div>
      </li>`).join("");
  }

  // ===== PRÉDICTIONS POLYMARKET =====
  async function renderPredictions() {
    const ul = document.getElementById("predList");
    if (!ul) return;
    ul.innerHTML = `<li style="color:var(--text-dim);text-align:center;padding:14px">Chargement Polymarket…</li>`;
    const markets = await WM.liveFeeds.polymarket();
    if (!markets.length) { ul.innerHTML = `<li style="color:var(--text-dim);text-align:center">Indisponible</li>`; return; }
    ul.innerHTML = markets.slice(0, 8).map(m => {
      const oui = m.outcomes[0] ? Math.round(+m.outcomes[0] * 100) : null;
      const non = m.outcomes[1] ? Math.round(+m.outcomes[1] * 100) : null;
      const vol = m.volume ? " · " + Math.round(m.volume / 1e6) + " M$" : "";
      return `<li class="pred-item">
        <a href="${escapeHtml(m.url)}" target="_blank" rel="noopener" class="pred-question">${escapeHtml(m.question)}</a>
        <div class="pred-bar">
          ${oui != null ? `<span class="pred-oui" style="width:${oui}%">Oui ${oui}%</span>` : ""}
          ${non != null ? `<span class="pred-non" style="width:${non}%">Non ${non}%</span>` : ""}
        </div>
        <div class="pred-meta">Polymarket${vol}</div>
      </li>`;
    }).join("");
  }

  // ===== RENSEIGNEMENTS AÉRIENS — METAR live (NOAA aviationweather.gov) =====
  const AIRPORTS = [
    { code:"EGLL", name:"Londres Heathrow" },
    { code:"LFPG", name:"Paris Charles de Gaulle" },
    { code:"EDDF", name:"Francfort" },
    { code:"LTFM", name:"Istanbul" },
    { code:"OMDB", name:"Dubai International" },
    { code:"OERK", name:"Riyad King Khalid" },
    { code:"LTFJ", name:"Sabiha Gökçen" },
    { code:"LTAC", name:"Ankara Esenboğa" },
    { code:"KJFK", name:"John F Kennedy" },
    { code:"KLAX", name:"Los Angeles" },
    { code:"RJAA", name:"Tokyo Narita" },
    { code:"VHHH", name:"Hong Kong" },
  ];
  async function renderAirlines() {
    const ul = document.getElementById("airlineList");
    if (!ul) return;
    ul.innerHTML = `<li style="color:var(--text-dim);text-align:center;padding:14px">Chargement METAR (NOAA)…</li>`;
    const metar = await WM.liveFeeds.airportMetar(AIRPORTS.map(a => a.code));
    const byCode = {};
    metar.forEach(m => { byCode[m.code] = m; });
    ul.innerHTML = AIRPORTS.map(a => {
      const m = byCode[a.code];
      const status = m?.status || "—";
      const delay = m?.delay || "—";
      const col = status === "GRAVE" ? "var(--danger)" : status === "MODÉRÉE" ? "var(--warn)" : status === "MINEURE" ? "var(--accent-2)" : status === "NORMALE" ? "var(--ok)" : "var(--text-dim)";
      return `<li class="airline-item" title="${escapeHtml(m?.raw || '')}">
        <span class="ap-code">${a.code}</span>
        <span class="ap-name">${escapeHtml(a.name)}</span>
        <span class="ap-status" style="color:${col}">${status}</span>
        <span class="ap-delay">${escapeHtml(delay)}</span>
      </li>`;
    }).join("");
  }

  // ===== WEATHER PANEL =====
  const WEATHER_CITIES = {
    conflicts: [
      { name:"Tel Aviv", lat:32.08, lon:34.78 }, { name:"Kyiv", lat:50.45, lon:30.52 },
      { name:"Tehran", lat:35.69, lon:51.42 }, { name:"Gaza", lat:31.50, lon:34.47 },
      { name:"Damas", lat:33.51, lon:36.29 }, { name:"Beyrouth", lat:33.89, lon:35.50 },
      { name:"Khartoum", lat:15.55, lon:32.53 }, { name:"Sanaa", lat:15.35, lon:44.20 },
      { name:"Bagdad", lat:33.31, lon:44.36 }, { name:"Sébastopol", lat:44.61, lon:33.53 },
      { name:"Jérusalem", lat:31.78, lon:35.22 }, { name:"Donetsk", lat:48.00, lon:37.80 },
    ],
    capitals: [
      { name:"New York", lat:40.71, lon:-74.01 }, { name:"London", lat:51.51, lon:-0.13 },
      { name:"Tokyo", lat:35.68, lon:139.69 }, { name:"Hong Kong", lat:22.32, lon:114.17 },
      { name:"Singapour", lat:1.35, lon:103.82 }, { name:"Francfort", lat:50.11, lon:8.68 },
      { name:"Zurich", lat:47.37, lon:8.54 }, { name:"Dubai", lat:25.20, lon:55.27 },
      { name:"Shanghai", lat:31.23, lon:121.47 }, { name:"São Paulo", lat:-23.55, lon:-46.63 },
      { name:"Sydney", lat:-33.87, lon:151.21 }, { name:"Toronto", lat:43.65, lon:-79.38 },
    ],
    asia: [
      { name:"Tokyo", lat:35.68, lon:139.69 }, { name:"Séoul", lat:37.57, lon:126.98 },
      { name:"Taipei", lat:25.03, lon:121.57 }, { name:"Pékin", lat:39.91, lon:116.40 },
      { name:"Mumbai", lat:19.08, lon:72.88 }, { name:"Hong Kong", lat:22.32, lon:114.17 },
      { name:"Bangkok", lat:13.76, lon:100.50 }, { name:"Jakarta", lat:-6.21, lon:106.85 },
      { name:"Manille", lat:14.60, lon:120.98 }, { name:"Hanoï", lat:21.03, lon:105.85 },
      { name:"Kaboul", lat:34.53, lon:69.17 }, { name:"Karachi", lat:24.86, lon:67.01 },
    ],
    americas: [
      { name:"Washington", lat:38.91, lon:-77.04 }, { name:"New York", lat:40.71, lon:-74.01 },
      { name:"Los Angeles", lat:34.05, lon:-118.24 }, { name:"Mexico", lat:19.43, lon:-99.13 },
      { name:"Caracas", lat:10.48, lon:-66.90 }, { name:"Bogotá", lat:4.71, lon:-74.07 },
      { name:"Lima", lat:-12.05, lon:-77.04 }, { name:"Rio", lat:-22.91, lon:-43.17 },
      { name:"Buenos Aires", lat:-34.61, lon:-58.38 }, { name:"Santiago", lat:-33.45, lon:-70.65 },
      { name:"Port-au-Prince", lat:18.59, lon:-72.31 }, { name:"Havane", lat:23.13, lon:-82.36 },
    ],
    europe: [
      { name:"Paris", lat:48.85, lon:2.35 }, { name:"Londres", lat:51.51, lon:-0.13 },
      { name:"Berlin", lat:52.52, lon:13.40 }, { name:"Madrid", lat:40.42, lon:-3.70 },
      { name:"Rome", lat:41.90, lon:12.50 }, { name:"Moscou", lat:55.75, lon:37.62 },
      { name:"Istanbul", lat:41.01, lon:28.98 }, { name:"Varsovie", lat:52.23, lon:21.01 },
      { name:"Bruxelles", lat:50.85, lon:4.35 }, { name:"Vienne", lat:48.21, lon:16.37 },
      { name:"Stockholm", lat:59.33, lon:18.07 }, { name:"Athènes", lat:37.98, lon:23.73 },
    ],
  };
  const WEATHER_CODES = {
    0:"Ciel clair ☀️", 1:"Peu nuageux 🌤", 2:"Partiellement nuageux ⛅", 3:"Couvert ☁️",
    45:"Brouillard 🌫", 48:"Brouillard givrant 🌫",
    51:"Bruine légère 🌦", 53:"Bruine 🌦", 55:"Bruine dense 🌦",
    61:"Pluie légère 🌧", 63:"Pluie 🌧", 65:"Pluie forte 🌧",
    71:"Neige légère 🌨", 73:"Neige 🌨", 75:"Neige forte 🌨",
    77:"Grains neigeux 🌨",
    80:"Averses légères 🌦", 81:"Averses 🌦", 82:"Averses violentes ⛈",
    85:"Averses neige 🌨", 86:"Averses neige fortes 🌨",
    95:"Orage ⛈", 96:"Orage + grêle ⛈", 99:"Orage violent + grêle ⛈",
  };
  const codeIcon = (c) => (WEATHER_CODES[c] || "—").split(" ").pop();
  const codeLabel = (c) => (WEATHER_CODES[c] || "Inconnu");

  async function renderWeather() {
    const grid = document.getElementById("weatherGrid");
    if (!grid) return;
    const tab = document.querySelector("#weatherTabs button.active")?.textContent?.toLowerCase() || "conflits";
    let key = "conflicts";
    if (tab.includes("capitales")) key = "capitals";
    else if (tab.includes("asie")) key = "asia";
    else if (tab.includes("amér") || tab.includes("amer")) key = "americas";
    else if (tab.includes("europe")) key = "europe";
    const cities = WEATHER_CITIES[key] || WEATHER_CITIES.conflicts;
    grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;color:var(--text-dim);font-size:11px;padding:20px">Chargement météo Open-Meteo…</div>`;
    const data = await WM.liveFeeds.multiWeather(cities);
    if (!data.length) { grid.innerHTML = `<div style="grid-column:1/-1;color:var(--text-dim);text-align:center">Service indisponible</div>`; return; }
    const countEl = document.getElementById("weatherCount");
    if (countEl) countEl.textContent = data.length;
    grid.innerHTML = data.map((w, i) => `
      <div class="weather-cell ${i===0?'active':''} ${w.severe?'severe':''}" data-i="${i}" title="${w.severeReason ? '⚠ '+w.severeReason : codeLabel(w.code)}">
        ${w.severe ? '<span class="wc-alert-dot"></span>' : ''}
        <div class="wc-name">${escapeHtml(w.name)}</div>
        <div class="wc-temp" style="${w.temp != null && w.temp > 35 ? 'color:var(--accent)' : w.temp != null && w.temp < 0 ? 'color:var(--info)' : ''}">${w.temp != null ? Math.round(w.temp)+'°' : '—'}</div>
        <div class="wc-icon">${codeIcon(w.code)}</div>
      </div>
    `).join("");
    if (data[0]) setWeatherFeatured(data[0]);
    if (!grid.dataset.delegated) {
      grid.addEventListener("click", e => {
        const cell = e.target.closest(".weather-cell"); if (!cell) return;
        grid.querySelectorAll(".weather-cell").forEach(x => x.classList.remove("active"));
        cell.classList.add("active");
        const w = data[+cell.dataset.i];
        if (w) setWeatherFeatured(w);
      });
      grid.dataset.delegated = "1";
    }
  }
  function setWeatherFeatured(w) {
    const featured = document.getElementById("weatherFeatured");
    if (!featured) return;
    featured.classList.toggle("severe", !!w.severe);
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    set("wfCity", (w.severe ? "⚠ " : "") + w.name);
    set("wfTemp", w.temp != null ? Math.round(w.temp) + "°" : "—°");
    set("wfCond", codeLabel(w.code) + (w.severe ? ` — ${w.severeReason}` : ""));
    set("wfWind", w.wind != null ? Math.round(w.wind) : "—");
    set("wfRain", w.rain != null ? w.rain.toFixed(1) : "—");
    set("wfFeels", w.feels != null ? Math.round(w.feels) + "°" : "—");
    set("wfUv", w.uv != null ? w.uv.toFixed(1) : "—");
  }

  // ===== EARTHQUAKES PANEL (USGS) =====
  async function renderQuakes() {
    const list = document.getElementById("quakeList");
    if (!list) return;
    list.innerHTML = `<li style="color:var(--text-dim);text-align:center;padding:14px">Chargement USGS…</li>`;
    const quakes = await WM.liveFeeds.usgsSignificant();
    const countEl = document.getElementById("quakesCount");
    if (countEl) countEl.textContent = quakes.length;
    if (!quakes.length) {
      list.innerHTML = `<li style="color:var(--text-dim);text-align:center;padding:14px">Aucun séisme significatif récent</li>`;
      return;
    }
    list.innerHTML = quakes.slice(0, 25).map(q => {
      const m = q.mag;
      const cls = m >= 7 ? "M7" : m >= 6 ? "M6" : m >= 5 ? "M5" : "";
      const date = q.date ? relDate(q.date) : "";
      return `<li class="quake-item ${cls}">
        <div class="quake-head">
          <span class="quake-mag ${cls}">M ${m.toFixed(1)}</span>
          <span class="quake-place">${escapeHtml(q.place || "")}</span>
          <span class="quake-time">${date}</span>
        </div>
        <div class="quake-meta"><a href="${escapeHtml(q.url)}" target="_blank" rel="noopener" style="color:var(--text-dim);text-decoration:none">Source USGS ↗</a></div>
      </li>`;
    }).join("");
  }

  // Source badge injection (panneaux toujours visibles, pas de bouton ×)
  function injectPanelCloseButtons() {
    document.querySelectorAll(".dash-panel[data-panel]").forEach(p => {
      const head = p.querySelector(".dash-head");
      const meta = PANEL_META[p.dataset.panel];
      if (meta?.src && head && !p.querySelector(".panel-source")) {
        const src = document.createElement("div");
        src.className = "panel-source";
        src.title = meta.src;
        src.innerHTML = `<span class="ps-icon">📡</span><span class="ps-text">${escapeHtml(meta.src)}</span>`;
        head.insertAdjacentElement("afterend", src);
      }
    });
  }
  function applyHiddenPanels() {
    // Tous les panneaux toujours visibles + nettoie l'ancien stockage
    try { localStorage.removeItem("wm_hidden_panels"); } catch {}
    document.querySelectorAll(".dash-panel[data-panel]").forEach(p => { p.hidden = false; });
  }
  // Masonry — calcule grid-row: span N pour chaque panneau selon sa hauteur réelle.
  // Évite les trous : les panneaux longs prennent plus de lignes dans la grille.
  // Masonry désactivée — la grille CSS gère désormais des rangées uniformes.
  function scheduleMasonry() {}

  function applyPanelOrder() {
    try {
      const saved = JSON.parse(localStorage.getItem("wm_panel_order") || "[]");
      if (!saved.length) return;
      const dash = document.getElementById("dashboard"); if (!dash) return;
      const map = {};
      dash.querySelectorAll(".dash-panel[data-panel]").forEach(p => { map[p.dataset.panel] = p; });
      saved.forEach(id => { if (map[id]) dash.appendChild(map[id]); });
    } catch {}
  }

  // News sources — live video IDs vérifiés via oEmbed (OK = embeddable).
  const NEWS_SOURCES = {
    france24:    { name: "France 24",      vid: "l8PMl7tUDIE", yt: "UCCCPCZNChQdGa9EkATeye4g" },
    france24en:  { name: "France 24 EN",   vid: "Ap-UM1O9RBU", yt: "UCQfwfsi5VrQ8yKZ-UWmAEFg" },
    france24ar:  { name: "France 24 AR",   vid: "3ursYA8HMeo", yt: "UCI1Y_nCwMGfPzZEgd60xH1Q" },
    franceinfo:  { name: "France Info",    vid: "NG7ZX42nZKc", yt: "UCyG16W5bfDnbE--rlpzfKEg" },
    cnews:       { name: "CNEWS",                                yt: "UCciBAhIME9MQEmGbBPnh44g" },
    tv5monde:    { name: "TV5MONDE",                             yt: "UCJsZHPR1jqKu-soDmKNMBFg" },
    publicsenat: { name: "Public Sénat",                         yt: "UCTa1bPArjpvNMgSHAb_pflA" },
    lcp:         { name: "LCP-AN",                               yt: "UCHGFbA0KWBgf6gMbyUCZeCQ" },
    africanews:  { name: "Africanews FR",                        yt: "UC25EuGAePOPvPrUA5cmu3dQ" },
    uatv:        { name: "UATV English (Ukraine)",               yt: "UCOmfcmDrWs7iJrXx7V5Cnwg" },
    kyivindep:   { name: "Kyiv Independent",                     yt: "UCGAC5yzlYgjKoJABDZ7zEyw" },
    iranintl:    { name: "Iran International",                   yt: "UCeAM41X9HVepZK2MPy1jonA" },
    asharq:      { name: "Asharq News",                          yt: "UCRJUVYt9gjg8MnlGacySUdg" },
    presstv:     { name: "Press TV (Iran)",                      yt: "UC0OO19kc2jt8ZtOWZMVa3Vw" },
    tvpworld:    { name: "TVP World (Pologne)",                  yt: "UCBjUPsHj7bXt24SUWNoZ0zA" },
    bbcnews:     { name: "BBC News",                             yt: "UC16niRr50-MSBwiO3YDb3RA" },
    cbsnews:     { name: "CBS News",                             yt: "UC8p1vwvWtl6T73JiExfWs1g" },
    cnni:        { name: "CNN International",                    yt: "UCAFzeJzD2zw3g9lk22JsqCg" },
    dw:          { name: "DW News",        vid: "LuKwFajn37U", yt: "UCknLrEdhRCp1aegoMqRaCZg" },
    aljazeera:   { name: "Al Jazeera",     vid: "gCNeDWCI0vo", yt: "UCNye-wNBqNL5ZzHSJj3l8Bg" },
    skynews:     { name: "Sky News",       vid: "YDvsBbKfLPA", yt: "UCoMdktPbSTixAyNGwb-UYkQ" },
    skyarabia:   { name: "Sky News Arabia",vid: "U--OjmpjF5o", yt: "UCaYSqhSc1OQlC7xnMMYw4Kw" },
    euronews:    { name: "Euronews FR",    vid: "NiRIbKwAejk", yt: "UCSrZ3UV4jOidv8ppoVuvW9Q" },
    euronewsen:  { name: "Euronews EN",    vid: "pykpO5kQJ98", yt: "UCSrZ3UV4jOidv8ppoVuvW9Q" },
    bloomberg:   { name: "Bloomberg",      vid: "iEpJwprxDdk", yt: "UCIALMKvObZNtJ6AmdCLP7Lg" },
    cnbc:        { name: "CNBC TV18",      vid: "h2vKHpBHSQc", yt: "UCwqusr8YDwM-3mEYTDeJHzw" },
    cnn:         { name: "CNN-News18",     vid: "urmvmK4BJjM", yt: "UCwqusr8YDwM-3mEYTDeJHzw" },
    alarabiya:   { name: "Al Arabiya",     vid: "n7eQejkXbnM", yt: "UCjAQRQ59EscjOHmXSRPkCAg" },
    nhk:         { name: "NHK World",      yt: "UCSbUPGmmKUTzRmspnZvmmfA" },
    cgtn:        { name: "CGTN",           yt: "UCIRLvheU2LtPwDe3ZR1zxmw" },
    trtworld:    { name: "TRT World",      yt: "UC7fWeaHhqgM4Ry-RMpM2YYw" },
    i24:         { name: "i24 NEWS",       yt: "UCLtd48QGPxpNNmTc2dhYqjw" },
    arirang:     { name: "Arirang",        yt: "UC8cZTsmtmygXlMLUDdqcvqQ" },
    abc:         { name: "ABC News",       yt: "UCBi2mrWuNuyYy4gbM6fU18Q" },
    nbc:         { name: "NBC News",       yt: "UCeY0bbntWzzVIaj2z3QigXg" },
    reuters:     { name: "Reuters",        yt: "UChqUTb7kYRX8-EiaN3XFrSQ" },
  };

  function setNewsSource(srcId) {
    const s = NEWS_SOURCES[srcId];
    if (!s) return;
    const player = document.getElementById("newsPlayer");
    if (!player) return;
    const npTitle = document.getElementById("npTitle");
    if (npTitle) npTitle.textContent = "Flux " + s.name;
    const headline = document.getElementById("newsHeadline");
    if (headline) headline.textContent = "Source en direct : " + s.name;
    const url = s.vid
      ? `https://www.youtube.com/embed/${s.vid}?autoplay=1&mute=1`
      : `https://www.youtube.com/embed/live_stream?channel=${s.yt}&autoplay=1&mute=1`;
    player.innerHTML = `<iframe src="${url}" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen style="width:100%;height:100%;border:0;background:#000"></iframe>`;
  }

  // Webcams — real YouTube live IDs vérifiés oEmbed, classés par zone.
  const WEBCAMS = {
    // 🎯 Iran / Israël / Liban / Gaza / Syrie
    iran: [
      { title: "Iran HD (Tehran, Isfahan)",        loc: "Iran",            vid: "-zGuR1qVKrU" },
      { title: "Tel Aviv — ville",                  loc: "Israël",          vid: "nvtv8CQksdI" },
      { title: "Tel Aviv — skyline",                loc: "Israël",          vid: "KMZbvDRgAh8" },
      { title: "Mur des Lamentations (EarthCam)",   loc: "Jérusalem",       vid: "77akujLn4k8" },
      { title: "Jerusalem — crise Israël-Iran",     loc: "Israël",          vid: "OlO4V4h2xcM" },
      { title: "Jerusalem 24/7 — prière",           loc: "Israël",          vid: "RppRqS2bUaA" },
      { title: "Beyrouth — skyline (cessez-le-feu)",loc: "Liban",           vid: "QvMBk6BWqxg" },
      { title: "Israël 24/7 (Guerre Iran)",         loc: "Israël",          vid: "KSwPNkzEgxg" },
      { title: "MELC — Middle East Live",           loc: "Moyen-Orient",    vid: "hOQxOotcKPI" },
      { title: "War Room — US/IL/IR/Chypre",        loc: "Régional",        vid: "4-mx61VREJk" },
      { title: "Middle East HD Feeds",              loc: "Israël / Iran",   vid: "JboXN7CuKxc" },
      { title: "Moyen-Orient multi-cam",            loc: "Iran/Israël/Qatar",vid: "oxT5R6I0N6E" },
      { title: "Israel/Iran/Syria multi",           loc: "Régional",        vid: "gmtlJ_m2r5A" },
    ],
    // ⚔️ Ukraine / Russie
    ukraine: [
      { title: "Ukraine multi-cam (Kyiv, Odessa, Kharkiv)", loc: "Ukraine", vid: "e2gC37ILQmk" },
      { title: "Ukraine HD (Donetsk, Sumy, Kyiv)",           loc: "Ukraine", vid: "V_0az0lQ6Ww" },
      { title: "Ukraine 24/7 news+cams",                     loc: "Ukraine", vid: "IA4RCA5Bjn4" },
      { title: "Ukraine — dernières évolutions",             loc: "Ukraine", vid: "1Ig7-knCAHY" },
    ],
    // 🌍 Moyen-Orient élargi (inclut Liban, Gaza)
    mena: [
      { title: "Al Jazeera English",            loc: "Qatar",         vid: "gCNeDWCI0vo" },
      { title: "Beyrouth skyline",              loc: "Liban",         vid: "QvMBk6BWqxg" },
      { title: "Jerusalem 24/7",                loc: "Israël",        vid: "RppRqS2bUaA" },
      { title: "Middle East 24/7 (IL/IR/SY)",   loc: "Régional",      vid: "gmtlJ_m2r5A" },
      { title: "Conflicts Live HD",             loc: "Moyen-Orient",  vid: "nma1ycEnYmU" },
      { title: "MELC Middle East",              loc: "Moyen-Orient",  vid: "hOQxOotcKPI" },
      { title: "Iran HD",                       loc: "Iran",          vid: "-zGuR1qVKrU" },
      { title: "Moyen-Orient multi",            loc: "Régional",      vid: "oxT5R6I0N6E" },
    ],
    // 🇪🇺 Europe — conflit Ukraine
    europe: [
      { title: "Ukraine multi-cam",   loc: "Ukraine",   vid: "e2gC37ILQmk" },
      { title: "Ukraine 24/7",        loc: "Ukraine",   vid: "IA4RCA5Bjn4" },
      { title: "Ukraine HD",          loc: "Ukraine",   vid: "V_0az0lQ6Ww" },
      { title: "Ukraine update",      loc: "Ukraine",   vid: "1Ig7-knCAHY" },
    ],
    // 🌏 Asie — Taïwan, Corée, détroits
    asia: [
      { title: "Danjiang Bridge Taïwan 24/7",   loc: "Taïwan",        vid: "4AKop_729y4" },
      { title: "Taipei — aéroport TPE",         loc: "Taïwan",        vid: "91PfFoqvuUk" },
      { title: "TVBS Taiwan News 24/7",         loc: "Taïwan",        vid: "2mCSYvcfhtc" },
      { title: "Séoul — Hangang",               loc: "Corée du Sud",  vid: "-JhoMGoAfFc" },
      { title: "Séoul — Station Plaza",         loc: "Corée du Sud",  vid: "DSgn-lTHJzM" },
    ],
    // 🇺🇸 Amériques
    americas: [
      { title: "Times Square 4K — EarthCam",    loc: "New York",      vid: "rnXIjl_Rzy4" },
      { title: "NYC Times Square 24/7",         loc: "New York",      vid: "VGnFLdQW39A" },
      { title: "Times Square 1560 Broadway",    loc: "New York",      vid: "4qyZLflp-sI" },
    ],
    // 🛰 Espace / Géo-surveillance
    space: [
      { title: "NASA — Earth from Space 24/7",  loc: "NASA/ISS",      vid: "vytmBNhc9ig" },
      { title: "Earth & Space 4K",              loc: "ISS",           vid: "fO9e9jnhYK8" },
      { title: "ISS HD Views",                  loc: "ISS",           vid: "zPH5KtjJFaQ" },
      { title: "ISS Official Live",             loc: "ISS",           vid: "sWasdbDVNvc" },
      { title: "GlobalQuake — séismes live",    loc: "Monde",         vid: "rvtygG4n6ew" },
      { title: "Al Jazeera English",            loc: "Qatar",         vid: "gCNeDWCI0vo" },
    ],
    all: [],
  };
  // de-duplicate by vid across all categories
  WEBCAMS.all = (() => {
    const seen = new Set();
    const out = [];
    Object.keys(WEBCAMS).forEach(k => {
      if (k === "all") return;
      (WEBCAMS[k] || []).forEach(c => {
        if (c && c.vid && !seen.has(c.vid)) { seen.add(c.vid); out.push(c); }
      });
    });
    return out;
  })();

  function camEmbedURL(cam, muted = true, controls = false) {
    return `https://www.youtube.com/embed/${cam.vid}?autoplay=1&mute=${muted?1:0}&controls=${controls?1:0}&modestbranding=1&playsinline=1`;
  }

  // Instability — score live calculé depuis le ton GDELT par pays (24h)
  // GDELT exige des phrases ≥ 5 caractères entre guillemets — sinon on les retire automatiquement
  const INSTAB_COUNTRIES = [
    // MENA
    { name: "Iran",        query: "Iran Tehran",     lat: 32,    lon: 53,     region: "MENA" },
    { name: "Israel",      query: "Israel",          lat: 31.5,  lon: 34.75,  region: "MENA" },
    { name: "Yemen",       query: "Yemen Houthis",   lat: 15.5,  lon: 48.5,   region: "MENA" },
    { name: "Syria",       query: "Syria Damascus",  lat: 34.8,  lon: 38.9,   region: "MENA" },
    // Europe
    { name: "Russia",      query: "Russia",          lat: 61,    lon: 105,    region: "Europe" },
    { name: "Ukraine",     query: "Ukraine",         lat: 49,    lon: 32,     region: "Europe" },
    // Asie
    { name: "China",       query: "China Beijing",   lat: 35,    lon: 105,    region: "Asie" },
    { name: "Myanmar",     query: "Myanmar",         lat: 21.9,  lon: 95.9,   region: "Asie" },
    { name: "North Korea", query: "North Korea",     lat: 40,    lon: 127,    region: "Asie" },
    // Afrique
    { name: "Sudan",       query: "Sudan",           lat: 15,    lon: 30,     region: "Afrique" },
    { name: "Ethiopia",    query: "Ethiopia",        lat: 9.15,  lon: 40.49,  region: "Afrique" },
    // Amériques
    { name: "Haiti",       query: "Haiti",           lat: 18.97, lon: -72.3,  region: "Amériques" },
    { name: "Venezuela",   query: "Venezuela",       lat: 6.42,  lon: -66.6,  region: "Amériques" },
  ];
  async function renderInstability() {
    const ul = document.getElementById("instabList");
    if (!ul) return;

    // Trend storage
    let prev = {};
    try { prev = JSON.parse(localStorage.getItem("wm_instab_prev") || "{}"); } catch {}

    // Helper: rerender depuis le map de tons (partiel ou complet)
    const rerender = (tones, progress) => {
      const next = {};
      const enriched = INSTAB_COUNTRIES.map(ctry => {
        const t = tones[ctry.query];
        const loaded = t != null && t.articles > 0;
        const tone = t?.tone ?? 0;
        const articles = t?.articles ?? 0;
        const score = loaded ? Math.max(5, Math.min(99, Math.round(50 - tone * 7))) : null;
        if (loaded) next[ctry.query] = score;
        const prevScore = prev[ctry.query];
        const trend = (loaded && prevScore != null) ? score - prevScore : 0;
        return { ...ctry, score, tone, articles, trend, loaded };
      });
      // Sort: chargés (par score) puis pas encore chargés
      enriched.sort((a, b) => {
        if (a.loaded !== b.loaded) return a.loaded ? -1 : 1;
        return (b.score || 0) - (a.score || 0);
      });
      try { localStorage.setItem("wm_instab_prev", JSON.stringify(next)); } catch {}
      // Met à jour Vue d'ensemble Risques avec ce qu'on a déjà
      const loaded = enriched.filter(c => c.loaded);
      if (loaded.length) renderRiskGauge(loaded);
      const header = progress
        ? `<li style="color:var(--text-dim);text-align:center;padding:6px;font-size:10px;border-bottom:1px dashed var(--border)">⏳ Chargement GDELT ${progress.done}/${progress.total} pays…</li>`
        : "";
      ul.innerHTML = header + enriched.map(c => {
        if (!c.loaded) {
          return `<li class="instab-item dim" data-lat="${c.lat}" data-lon="${c.lon}">
            <div class="instab-row">
              <span class="instab-dot" style="background:var(--text-dim2)"></span>
              <span class="instab-name">${c.name}</span>
              <span class="instab-score" style="color:var(--text-dim2)">…</span>
            </div>
            <div class="instab-sub">En attente GDELT…</div>
          </li>`;
        }
        const color = c.score >= 80 ? "var(--accent)" : c.score >= 60 ? "var(--warn)" : "var(--ok)";
        const arrow = c.trend > 1 ? `<span class="instab-arrow trend-up">↗ +${c.trend}</span>`
                    : c.trend < -1 ? `<span class="instab-arrow trend-dn">↘ ${c.trend}</span>`
                    : `<span class="instab-arrow">→</span>`;
        return `
          <li class="instab-item" data-lat="${c.lat}" data-lon="${c.lon}" title="Ton moyen GDELT 24h : ${c.tone.toFixed(2)} (${c.articles} dépêches)">
            <div class="instab-row">
              <span class="instab-dot" style="background:${color}"></span>
              <span class="instab-name">${c.name}</span>
              <span class="instab-score" style="color:${color}">${c.score}</span>
              ${arrow}
            </div>
            <div class="instab-bar"><div class="bar-fill" style="width:${c.score}%;background:${color}"></div></div>
            <div class="instab-sub">Ton ${c.tone.toFixed(1)} · ${c.articles} dépêches GDELT 24h</div>
          </li>`;
      }).join("");
      ul.querySelectorAll(".instab-item").forEach(li => {
        li.addEventListener("click", () => {
          map.flyTo([+li.dataset.lat, +li.dataset.lon], 5, { duration: 0.8 });
        });
      });
    };

    // Rendu initial (vide ou avec cache)
    const partial = {};
    rerender(partial, { done: 0, total: INSTAB_COUNTRIES.length });

    // Fetch avec callback streaming
    const tones = await WM.liveFeeds.gdeltCountryTone(
      INSTAB_COUNTRIES.map(c => c.query),
      (name, val, done, total) => {
        partial[name] = val;
        rerender(partial, done < total ? { done, total } : null);
      }
    );
    // Render final (au cas où onProgress ne s'est pas exécuté pour les cachés)
    rerender(tones, null);
  }

  // Intel feed — REAL DATA from GDELT 2.0 DOC API (no auth, updated every 15 min)
  async function renderIntelFeed() {
    const ul = document.getElementById("intelFeed");
    if (!ul) return;
    ul.innerHTML = `<li class="intel-item" style="color:var(--text-dim);text-align:center">Chargement GDELT…</li>`;
    const articles = await WM.liveFeeds.gdelt("", 12); // toute actu francophone récente
    if (!articles.length) {
      ul.innerHTML = `<li class="intel-item">GDELT momentanément inaccessible</li>`;
      return;
    }
    ul.innerHTML = articles.slice(0, 10).map(a => {
      const sev = a.tone < -5 ? "critical" : a.tone < -2 ? "alert" : "dipl";
      const label = sev === "critical" ? "CRITICAL" : sev === "alert" ? "ALERT" : "INFO";
      const date = a.seendate ? new Date(a.seendate.slice(0,4)+"-"+a.seendate.slice(4,6)+"-"+a.seendate.slice(6,8)+"T"+a.seendate.slice(9,11)+":"+a.seendate.slice(11,13)+":00Z") : null;
      return `
        <li class="intel-item">
          <div class="intel-header">
            <span class="intel-source">${escapeHtml(a.source || "GDELT")}</span>
            <span class="intel-tag ${sev}">${label}</span>
          </div>
          <div class="intel-title"><a href="${escapeHtml(a.url)}" target="_blank" rel="noopener" style="color:var(--text);text-decoration:none">${escapeHtml(a.title || "")}</a></div>
          <div class="intel-meta"><span>📍 ${escapeHtml(a.country || "Global")}</span><span>${date ? relDate(date.toISOString()) : "live"}</span></div>
        </li>`;
    }).join("");
  }

  // Intel live — REAL DATA via GDELT filtered by active tab category
  async function renderIntelLive() {
    const ul = document.getElementById("intelLive");
    if (!ul) return;
    const activeTab = document.querySelector("#intelTabs button.active")?.textContent?.toLowerCase() || "militaire";
    // Filtre client-side par mots-clés selon l'onglet
    const filters = {
      militaire: /militaire|armée|défense|guerre|conflit|otan|missile|drone/i,
      cyber: /cyber|piratage|ransomware|attaque informatique|hack/i,
      éco: /écono|inflation|bourse|sanctions|gdp|récession|marché|finance/i,
      maritime: /maritime|navire|détroit|port|naval|ais|cargo/i,
    };
    let filterRe = filters.militaire;
    if (activeTab.includes("cyber")) filterRe = filters.cyber;
    else if (activeTab.includes("écono") || activeTab.includes("econo")) filterRe = filters.éco;
    else if (activeTab.includes("maritime")) filterRe = filters.maritime;
    ul.innerHTML = `<li class="intel-item" style="color:var(--text-dim);text-align:center">Chargement…</li>`;
    // Fetch large batch (sourcelang:French alone), filtre client-side
    const all = await WM.liveFeeds.gdelt("", 75);
    const articles = all.filter(a => filterRe.test(a.title || "")).slice(0, 14);
    if (!articles.length) {
      ul.innerHTML = `<li class="intel-item">Aucun article ${activeTab} sur 24h</li>`;
      return;
    }
    ul.innerHTML = articles.slice(0, 12).map(a => {
      const date = a.seendate ? new Date(a.seendate.slice(0,4)+"-"+a.seendate.slice(4,6)+"-"+a.seendate.slice(6,8)+"T"+a.seendate.slice(9,11)+":"+a.seendate.slice(11,13)+":00Z") : null;
      return `
        <li class="intel-item">
          <div class="intel-header">
            <span class="intel-source">${escapeHtml((a.source || "").toUpperCase())}</span>
            <span style="margin-left:auto;color:var(--text-dim);font-size:9px">${date ? relDate(date.toISOString()) : ""}</span>
          </div>
          <div class="intel-title"><a href="${escapeHtml(a.url)}" target="_blank" rel="noopener" style="color:var(--text);text-decoration:none">${escapeHtml(a.title || "")}</a></div>
        </li>`;
    }).join("");
  }

  // Vue d'ensemble Risques — moyenne live des scores Instabilité Pays (GDELT)
  function renderRiskGauge(enriched) {
    if (!enriched || !enriched.length) return;
    const avg = Math.round(enriched.reduce((a, c) => a + c.score, 0) / enriched.length);
    const critical = enriched.filter(c => c.score >= 70).length;
    const totalArticles = enriched.reduce((a, c) => a + (c.articles || 0), 0);
    const avgTone = enriched.reduce((a, c) => a + (c.tone || 0), 0) / enriched.length;
    const lbl = avg >= 75 ? "CRITIQUE" : avg >= 60 ? "ÉLEVÉ" : avg >= 45 ? "MODÉRÉ" : "FAIBLE";
    const color = avg >= 75 ? "#ff3040" : avg >= 60 ? "#ffb020" : avg >= 45 ? "#ffd25f" : "#22d39a";

    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    set("riskVal", avg);
    set("metCritical", critical);
    set("metAvg", avg);
    set("metTone", avgTone.toFixed(1));
    set("metArticles", totalArticles);
    set("riskUpdated", new Date().toLocaleTimeString("fr-FR"));

    const gaugeLbl = document.querySelector(".gauge-lbl");
    if (gaugeLbl) { gaugeLbl.textContent = lbl; gaugeLbl.style.color = color; }
    const ring = document.getElementById("gaugeRing");
    if (ring) {
      const C = 2 * Math.PI * 48;
      ring.setAttribute("stroke-dasharray", C);
      ring.setAttribute("stroke-dashoffset", C - (avg / 100) * C);
      ring.setAttribute("stroke", color);
    }

    // Tendance vs avg précédent
    const prev = parseFloat(localStorage.getItem("wm_risk_avg_prev") || avg);
    let trend = "Stable", arrow = "→", trendCol = "var(--info)";
    if (avg > prev + 1) { trend = "En escalade"; arrow = "↗"; trendCol = "var(--danger)"; }
    else if (avg < prev - 1) { trend = "En baisse"; arrow = "↘"; trendCol = "var(--ok)"; }
    try { localStorage.setItem("wm_risk_avg_prev", String(avg)); } catch {}
    const trendEl = document.getElementById("riskTrend");
    const arrowEl = document.getElementById("riskTrendArrow");
    if (trendEl) { trendEl.textContent = trend; trendEl.style.color = trendCol; }
    if (arrowEl) { arrowEl.textContent = arrow; arrowEl.style.color = trendCol; }

    // Top 3 pays à risque
    const top3 = [...enriched].sort((a, b) => b.score - a.score).slice(0, 3);
    const topList = document.getElementById("riskTop");
    if (topList) {
      topList.innerHTML = top3.map(c =>
        `<li>${escapeHtml(c.name)} <span style="color:var(--text-dim);font-weight:400">— score ${c.score} (ton ${c.tone.toFixed(1)})</span></li>`
      ).join("");
    }

    // Stats par région (moyenne des scores Instabilité par zone)
    const regions = {};
    enriched.forEach(c => {
      if (!regions[c.region]) regions[c.region] = { sum: 0, n: 0, articles: 0 };
      regions[c.region].sum += c.score;
      regions[c.region].n += 1;
      regions[c.region].articles += c.articles || 0;
    });
    const regionList = document.getElementById("riskRegions");
    if (regionList) {
      const sorted = Object.entries(regions).map(([name, v]) => ({ name, avg: Math.round(v.sum / v.n), n: v.n, articles: v.articles })).sort((a, b) => b.avg - a.avg);
      regionList.innerHTML = sorted.map(r => {
        const col = r.avg >= 70 ? "var(--danger)" : r.avg >= 55 ? "var(--warn)" : r.avg >= 40 ? "var(--ok)" : "var(--text-dim)";
        return `<li class="region-row"><span class="region-name">${escapeHtml(r.name)}</span><span class="region-bar"><span class="region-fill" style="width:${r.avg}%;background:${col}"></span></span><span class="region-score" style="color:${col}">${r.avg}</span><span class="region-meta">${r.n} pays</span></li>`;
      }).join("");
    }

    // DEFCON topbar live
    updateDEFCON(avg);
    // Sidebar stats live
    updateLiveStats(enriched);
  }

  // Sidebar : breakdown live des pays par tranche de score
  function updateLiveStats(enriched) {
    const el = document.getElementById("stats");
    if (!el) return;
    let crit = 0, hi = 0, mod = 0, low = 0, articles = 0;
    enriched.forEach(c => {
      if (c.score >= 70) crit++;
      else if (c.score >= 55) hi++;
      else if (c.score >= 40) mod++;
      else low++;
      articles += c.articles || 0;
    });
    el.innerHTML = `
      <li class="stat-card critical"><div class="stat-label">Critiques</div><div class="stat-value">${crit}</div></li>
      <li class="stat-card warn"><div class="stat-label">Élevés</div><div class="stat-value">${hi}</div></li>
      <li class="stat-card"><div class="stat-label">Modérés</div><div class="stat-value">${mod}</div></li>
      <li class="stat-card"><div class="stat-label">Stables</div><div class="stat-value">${low}</div></li>
      <li class="stat-card" style="grid-column:1/-1"><div class="stat-label">Dépêches GDELT 24h</div><div class="stat-value">${articles}</div></li>
    `;
  }

  // Insights — placeholder pendant le chargement GDELT (renderInsightsAI prend le relais)
  function renderInsights() {
    const bodyEl = document.getElementById("insightBody");
    if (bodyEl) bodyEl.textContent = "Analyse GDELT en cours de chargement…";
    const foot = document.querySelector(".insight-foot");
    if (foot) foot.innerHTML = "";
  }

  // Insights IA — génère un briefing riche depuis les articles GDELT réels
  // Extrait les pays, thèmes et ton dominant, puis compose un paragraphe type World Brief.
  async function renderInsightsAI() {
    const bodyEl = document.getElementById("insightBody");
    const footEl = document.querySelector(".insight-foot");
    if (!bodyEl) return;
    const articles = await WM.liveFeeds.gdelt("", 30); // toute actu francophone récente
    if (!articles || !articles.length) return; // keep base text

    // Compte les pays et calcule le ton moyen
    const countryCount = {};
    let toneSum = 0, toneN = 0;
    const stopWords = new Set(["dans","pour","avec","sans","mais","plus","moins","tout","tous","leur","leurs","cette","cela","ceux","celles","entre","chez","être","avoir","fait","faire","peut","autre","autres","aussi","sont","était","ainsi","alors","encore","après","avant","depuis","contre","selon","face","vers","sous","comme","très","bien","quand","pendant","dont","ceci","ceuls"]);
    const wordCount = {};
    articles.forEach(a => {
      if (a.country) countryCount[a.country] = (countryCount[a.country] || 0) + 1;
      if (typeof a.tone === "number") { toneSum += a.tone; toneN++; }
      (a.title || "").toLowerCase().match(/[a-zà-ÿ]{4,}/g)?.forEach(w => {
        if (!stopWords.has(w)) wordCount[w] = (wordCount[w] || 0) + 1;
      });
    });
    const avgTone = toneN ? (toneSum / toneN) : 0;
    const topCountries = Object.entries(countryCount).sort((a,b) => b[1]-a[1]).slice(0, 5).map(([c]) => c);
    const topWords = Object.entries(wordCount).sort((a,b) => b[1]-a[1]).slice(0, 8).map(([w]) => w);

    // Compose un briefing dans le style World Brief
    const critical = state.filtered.filter(e => e.sev === "critical").length;
    const high = state.filtered.filter(e => e.sev === "high").length;
    const toneDesc = avgTone < -4 ? "très négatif" : avgTone < -1 ? "négatif" : avgTone < 1 ? "neutre" : "positif";
    const country1 = topCountries[0] || "plusieurs zones";
    const countryList = topCountries.slice(0, 3).join(", ");

    const briefing = `Analyse de ${articles.length} dépêches (dernières 24h) — ton global ${toneDesc} (${avgTone.toFixed(1)}). ` +
      `Foyers d'attention : ${countryList}. ` +
      `Carte : ${critical} événements critiques, ${high} élevés. ` +
      `Thématiques dominantes identifiées dans les titres : ${topWords.slice(0, 4).join(", ")}. ` +
      `Sources : GDELT Project · USGS · NASA EONET · Open-Meteo (live).`;

    bodyEl.textContent = briefing;
    if (footEl) {
      footEl.innerHTML = topCountries.slice(0, 4).map(c => `<span class="tag">${escapeHtml(c)}</span>`).join("") +
        topWords.slice(0, 3).map(w => `<span class="tag">${escapeHtml(w)}</span>`).join("");
    }
  }

  function renderNewsCount() {
    const nc = document.getElementById("newsCount");
    if (nc) nc.textContent = 80 + Math.floor(Math.random() * 30);
    // Initial news stream: load France 24 once on first render
    if (!document.querySelector("#newsPlayer iframe")) {
      setNewsSource("france24");
    }
  }

  // Camera Wall — featured cam player (big) + thumbnails (click to swap featured).
  // Does NOT replace the news player — fully independent.
  function renderCamwall() {
    const grid = document.getElementById("camwallGrid");
    const featured = document.getElementById("camFeatured");
    if (!grid || !featured) return;
    const active = document.querySelector("#camwallTabs button.active")?.textContent?.toLowerCase() || "iran";
    let list;
    if (active.includes("iran") || active.includes("israël") || active.includes("israel")) list = WEBCAMS.iran;
    else if (active.includes("ukraine")) list = WEBCAMS.ukraine;
    else if (active.includes("mena") || active.includes("moyen")) list = WEBCAMS.mena;
    else if (active.includes("europe")) list = WEBCAMS.europe;
    else if (active.includes("amér") || active.includes("amer")) list = WEBCAMS.americas;
    else if (active.includes("asie")) list = WEBCAMS.asia;
    else if (active.includes("espace") || active.includes("iss")) list = WEBCAMS.space;
    else list = WEBCAMS.all || [];
    const items = list.slice(0, 20); // jusqu'à 20 vignettes pour défilement horizontal
    const countEl = document.getElementById("camCount");
    if (countEl) countEl.textContent = list.length;
    // Aperçu statique YouTube (image) au lieu d'iframe pour des thumbs cliquables et légers
    grid.innerHTML = items.map((c, i) => `
      <div class="cam-cell ${i===0?'active':''}" data-vid="${c.vid}" data-title="${escapeHtml(c.title)}" title="${escapeHtml(c.title)} — ${escapeHtml(c.loc||'')}">
        <img src="https://i.ytimg.com/vi/${c.vid}/mqdefault.jpg" alt="${escapeHtml(c.title)}" loading="lazy" />
        <span class="cam-live">● LIVE</span>
        <span class="cam-title">${escapeHtml(c.title)}</span>
      </div>
    `).join("");
    if (items[0]) setCamFeatured(items[0]);
    // Event delegation — one listener on the grid, survives re-renders
    if (!grid.dataset.delegated) {
      grid.addEventListener("click", e => {
        const cell = e.target.closest(".cam-cell");
        if (!cell) return;
        grid.querySelectorAll(".cam-cell").forEach(x => x.classList.remove("active"));
        cell.classList.add("active");
        setCamFeatured({ vid: cell.dataset.vid, title: cell.dataset.title });
      });
      grid.dataset.delegated = "1";
    }
  }
  function setCamFeatured(c) {
    const featured = document.getElementById("camFeatured");
    if (!featured) return;
    featured.dataset.vid = c.vid;
    featured.dataset.title = c.title || "";
    featured.innerHTML = `<iframe src="https://www.youtube.com/embed/${c.vid}?autoplay=1&mute=1&modestbranding=1&playsinline=1" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>
    <div class="cam-featured-title" id="camFeaturedTitle">${escapeHtml(c.title || "Live cam")}</div>`;
  }
  function openCamModal(vid, title) {
    const modal = document.getElementById("camModal");
    const video = document.getElementById("camModalVideo");
    const tEl = document.getElementById("camModalTitle");
    if (!modal || !video) return;
    video.innerHTML = `<iframe src="https://www.youtube.com/embed/${vid}?autoplay=1&modestbranding=1&playsinline=1" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>`;
    if (tEl) tEl.textContent = title || "Caméra en direct";
    modal.hidden = false;
  }
  function closeCamModal() {
    const modal = document.getElementById("camModal");
    const video = document.getElementById("camModalVideo");
    if (modal) modal.hidden = true;
    if (video) video.innerHTML = ""; // stop playback
  }

  // AI MARKET IMPLICATIONS — REAL DATA from CoinGecko + ExchangeRate-API
  async function renderMarket() {
    const el = document.getElementById("marketList");
    if (!el) return;
    el.innerHTML = `<li class="market-item" style="color:var(--text-dim);text-align:center">Chargement prix live…</li>`;
    const [crypto, forex] = await Promise.all([
      WM.liveFeeds.crypto(),
      WM.liveFeeds.forex(),
    ]);
    const all = [...(crypto||[]), ...(forex||[])];
    if (!all.length) {
      el.innerHTML = `<li class="market-item">Prix momentanément indisponibles</li>`;
      return;
    }
    el.innerHTML = all.map(a => {
      const d = +a.delta || 0;
      const cls = d >= 0 ? "up" : "down";
      const sign = d >= 0 ? "+" : "";
      const priceTxt = a.price ? (typeof a.price === "number" ? a.price.toLocaleString("fr-FR", {maximumFractionDigits: 4}) : a.price) : "";
      return `<li class="market-item">
        <div class="market-delta ${cls}">${sign}${d.toFixed(2)}%</div>
        <div class="market-body">
          <div class="market-ticker">${escapeHtml(a.ticker)} <span style="color:var(--text-dim);font-weight:500;margin-left:6px">${priceTxt ? "$" + priceTxt : ""}</span></div>
          <div class="market-desc">${escapeHtml(a.desc || "")}</div>
        </div>
      </li>`;
    }).join("");
  }

  // =========== UI WIRING ===========
  function wire() {
    const sidebarToggle = () => {
      const app = document.getElementById("app");
      if (window.matchMedia("(max-width: 900px)").matches) {
        app.classList.toggle("sidebar-open");
      } else {
        app.classList.toggle("collapsed");
      }
    };
    document.getElementById("toggleSidebar")?.addEventListener("click", sidebarToggle);
    document.getElementById("mobileMenuBtn")?.addEventListener("click", sidebarToggle);
    // Click outside sidebar on mobile closes it
    document.addEventListener("click", e => {
      const app = document.getElementById("app");
      if (!app.classList.contains("sidebar-open")) return;
      if (e.target.closest("#sidebar") || e.target.closest("#mobileMenuBtn") || e.target.closest("#toggleSidebar")) return;
      app.classList.remove("sidebar-open");
    });
    document.getElementById("hideMapBtn").addEventListener("click", () => {
      document.getElementById("app").classList.toggle("no-map");
      setTimeout(() => map.invalidateSize(), 100);
    });
    document.getElementById("fullscreen").addEventListener("click", () => {
      if (!document.fullscreenElement) document.documentElement.requestFullscreen && document.documentElement.requestFullscreen();
      else document.exitFullscreen && document.exitFullscreen();
    });
    document.getElementById("share").addEventListener("click", async () => {
      try { await navigator.clipboard.writeText(location.href); toast("Lien copié !"); } catch { toast("Copie impossible"); }
    });
    document.getElementById("mapMode2d3d").addEventListener("click", () => {
      state.mapMode = state.mapMode === "2d" ? "3d" : "2d";
      document.getElementById("mapModeLabel").textContent = state.mapMode.toUpperCase();
      toast(`Mode ${state.mapMode.toUpperCase()}`);
      const m = document.getElementById("map");
      m.style.transform = state.mapMode === "3d" ? "perspective(900px) rotateX(28deg)" : "";
      m.style.transformOrigin = "50% 50%";
      setTimeout(() => map.invalidateSize(), 300);
    });

    document.getElementById("timeRange").addEventListener("click", e => {
      const b = e.target.closest("button"); if (!b) return;
      document.querySelectorAll("#timeRange button").forEach(x => x.classList.remove("active"));
      b.classList.add("active");
      state.timeRange = b.dataset.range;
      updateURL(); loadAll();
    });
    document.getElementById("viewSelect").addEventListener("click", e => {
      const b = e.target.closest("button"); if (!b) return;
      document.querySelectorAll("#viewSelect button").forEach(x => x.classList.remove("active"));
      b.classList.add("active");
      state.view = b.dataset.view;
      const v = VIEWS[state.view];
      map.flyTo(v.center, v.zoom, { duration: 0.8 });
      updateURL();
    });

    // Dashboards (topbar)
    document.querySelectorAll("[data-dash]").forEach(btn => {
      btn.addEventListener("click", () => {
        document.querySelectorAll("[data-dash]").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        state.dashboard = btn.dataset.dash;
        applyDashboardPreset(state.dashboard);
        updateURL();
      });
    });

    // Layer all/none
    document.getElementById("layersAll").addEventListener("click", () => {
      LAYERS.forEach(l => { if (!l.locked) state.activeLayers.add(l.id); });
      renderLayers(); applyFilters(); updateURL();
    });
    document.getElementById("layersNone").addEventListener("click", () => {
      state.activeLayers.clear();
      renderLayers(); applyFilters(); updateURL();
    });

    // Refresh + options
    document.getElementById("refresh").addEventListener("click", loadAll);
    document.getElementById("optSound").addEventListener("change", e => { state.soundOn = e.target.checked; });
    document.getElementById("optHeatmap").addEventListener("change", e => { state.heatmapOn = e.target.checked; renderMapLayers(); });
    document.getElementById("optCluster").addEventListener("change", e => { state.clusterOn = e.target.checked; rebuildGroups(); renderMapLayers(); });

    // Export
    document.getElementById("exportCsv").addEventListener("click", exportCSV);
    document.getElementById("exportJson").addEventListener("click", exportJSON);

    // Settings / theme
    document.getElementById("settingsBtn").addEventListener("click", () => document.getElementById("settingsModal").hidden = false);
    document.querySelectorAll("[data-close-modal]").forEach(b => b.addEventListener("click", () => b.closest(".modal").hidden = true));
    document.getElementById("themeBtn").addEventListener("click", () => {
      document.body.classList.toggle("light-mode");
      const dark = !document.body.classList.contains("light-mode");
      document.getElementById("themeBtn").textContent = dark ? "🌙" : "☀️";
    });

    // Playback
    document.getElementById("pbLive").addEventListener("click", () => {
      state.liveMode = !state.liveMode;
      document.getElementById("pbLive").classList.toggle("active", state.liveMode);
      document.getElementById("pbTime").textContent = state.liveMode ? "Temps réel" : "Historique";
    });
    document.getElementById("pbSlider").addEventListener("input", e => {
      const v = +e.target.value;
      const ranges = { "1h": 3600e3, "6h": 6*3600e3, "24h": 86400e3, "48h": 48*3600e3, "7d": 7*86400e3, "30d": 30*86400e3, "90d": 90*86400e3, "all": Infinity };
      const past = ranges[state.timeRange];
      const t = Date.now() - past + (past * v / 100);
      document.getElementById("pbTime").textContent = new Date(t).toLocaleString("fr-FR");
      state.liveMode = v === 100;
      document.getElementById("pbLive").classList.toggle("active", state.liveMode);
    });
    document.getElementById("pbPrev").addEventListener("click", () => nudgeSlider(-5));
    document.getElementById("pbNext").addEventListener("click", () => nudgeSlider(+5));
    document.getElementById("pbBackFast").addEventListener("click", () => nudgeSlider(-20));
    document.getElementById("pbFirst").addEventListener("click", () => { const s=document.getElementById("pbSlider"); s.value=0; s.dispatchEvent(new Event("input")); });
    document.getElementById("pbLast").addEventListener("click", () => { const s=document.getElementById("pbSlider"); s.value=100; s.dispatchEvent(new Event("input")); });

    // News tabs
    document.getElementById("newsTabs").addEventListener("click", e => {
      const b = e.target.closest("button"); if (!b) return;
      document.querySelectorAll("#newsTabs button").forEach(x => x.classList.remove("active"));
      b.classList.add("active");
      setNewsSource(b.dataset.src);
    });

    // Tab arrows (scroll news tabs horizontally)
    document.querySelectorAll(".tabs-arrow").forEach(btn => {
      btn.addEventListener("click", () => {
        const tabs = document.getElementById("newsTabs");
        if (!tabs) return;
        tabs.scrollBy({ left: (+btn.dataset.dir || 1) * 240, behavior: "smooth" });
      });
    });

    // Mouse wheel → horizontal scroll on news tabs
    const newsTabsEl = document.getElementById("newsTabs");
    if (newsTabsEl) {
      newsTabsEl.addEventListener("wheel", e => {
        if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
          e.preventDefault();
          newsTabsEl.scrollLeft += e.deltaY;
        }
      }, { passive: false });
    }

    // Risk refresh

    // Cam enlarge button → open modal on the currently featured cam
    document.getElementById("camExpandBtn")?.addEventListener("click", () => {
      const f = document.getElementById("camFeatured");
      if (!f) return;
      openCamModal(f.dataset.vid, f.dataset.title);
    });
    // Double-click on featured cam also enlarges
    document.getElementById("camFeatured")?.addEventListener("dblclick", () => {
      const f = document.getElementById("camFeatured");
      openCamModal(f.dataset.vid, f.dataset.title);
    });
    // Close cam modal: X button, Esc key, clicking backdrop
    document.getElementById("camModalClose")?.addEventListener("click", closeCamModal);
    document.getElementById("camModal")?.addEventListener("click", e => {
      if (e.target.id === "camModal") closeCamModal();
    });
    document.addEventListener("keydown", e => {
      if (e.key === "Escape") closeCamModal();
    });

    // Intel tabs — all unlocked (test mode)
    document.getElementById("intelTabs").addEventListener("click", e => {
      const b = e.target.closest("button"); if (!b) return;
      document.querySelectorAll("#intelTabs button").forEach(x => x.classList.remove("active"));
      b.classList.add("active");
      renderIntelLive();
    });

    // Cam wall tabs
    document.getElementById("camwallTabs")?.addEventListener("click", e => {
      const b = e.target.closest("button"); if (!b) return;
      document.querySelectorAll("#camwallTabs button").forEach(x => x.classList.remove("active"));
      b.classList.add("active");
      renderCamwall();
    });

    // Weather tabs
    document.getElementById("weatherTabs")?.addEventListener("click", e => {
      const b = e.target.closest("button"); if (!b) return;
      document.querySelectorAll("#weatherTabs button").forEach(x => x.classList.remove("active"));
      b.classList.add("active");
      renderWeather().catch(() => {});
    });

    // Commodities tabs
    document.getElementById("commoTabs")?.addEventListener("click", e => {
      const b = e.target.closest("button"); if (!b) return;
      document.querySelectorAll("#commoTabs button").forEach(x => x.classList.remove("active"));
      b.classList.add("active");
      renderCommodities().catch(() => {});
    });

    // Search
    const inp = document.getElementById("search");
    inp.addEventListener("input", onSearchInput);
    inp.addEventListener("focus", onSearchInput);
    document.addEventListener("click", e => {
      if (!e.target.closest(".search-wrap")) document.getElementById("searchResults").hidden = true;
    });
    document.addEventListener("keydown", e => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); inp.focus(); }
      if (e.key === "Escape") { document.getElementById("searchResults").hidden = true; document.getElementById("detailPanel").hidden = true; }
    });
  }

  function nudgeSlider(delta) { const s = document.getElementById("pbSlider"); s.value = Math.max(0, Math.min(100, +s.value + delta)); s.dispatchEvent(new Event("input")); }
  function rebuildGroups() {
    const NO_CLUSTER = new Set(["shipping"]);
    LAYERS.forEach(l => {
      const oldG = markerGroups[l.id];
      if (oldG && map.hasLayer(oldG)) map.removeLayer(oldG);
      const useCluster = state.clusterOn && !NO_CLUSTER.has(l.id);
      markerGroups[l.id] = useCluster ? L.markerClusterGroup({ maxClusterRadius: 48, showCoverageOnHover: false }) : L.layerGroup();
    });
  }

  function applyDashboardPreset(d) {
    const presets = {
      world: ["conflicts","bases","hotspots","nuclear","sanctions","weather","economic","waterways","outages","cyberThreats","military","natural","iranAttacks"],
      tech: ["datacenters","cables","cyberThreats","outages","gps","orbital"],
      finance: ["economic","sanctions","trade","minerals","shipping","waterways"],
      commodity: ["minerals","pipelines","shipping","waterways","trade","fires","natural"],
      goodnews: [],
    };
    state.activeLayers = new Set(presets[d] || []);
    renderLayers(); applyFilters();
    if (d === "goodnews") toast("☀️ Mode Bonnes nouvelles");
  }

  function onSearchInput() {
    const q = document.getElementById("search").value.trim().toLowerCase();
    const el = document.getElementById("searchResults");
    if (!q) { el.hidden = true; return; }
    const hits = [];
    state.events.forEach(e => {
      const t = (e.title||"").toLowerCase(); const d = (e.desc||"").toLowerCase();
      if (t.includes(q) || d.includes(q) || (e.tags||[]).some(x => x.toLowerCase().includes(q))) hits.push(e);
    });
    COUNTRY_CENTROIDS.forEach(c => { if (c.name.toLowerCase().includes(q)) hits.push({ _country: c }); });
    el.innerHTML = hits.slice(0, 12).map(h => {
      if (h._country) return `<div data-lat="${h._country.lat}" data-lon="${h._country.lon}" data-zoom="5">${h._country.name}<span class="s-type">pays</span></div>`;
      const l = LAYERS.find(x=>x.id===h._layer);
      return `<div data-lat="${h.lat}" data-lon="${h.lon}" data-zoom="6">${l.icon} ${escapeHtml(h.title||l.label)}<span class="s-type">${l.label}</span></div>`;
    }).join("") || `<div>Aucun résultat</div>`;
    el.hidden = false;
    el.querySelectorAll("div[data-lat]").forEach(d => d.addEventListener("click", () => {
      map.flyTo([+d.dataset.lat, +d.dataset.lon], +d.dataset.zoom, { duration: 0.9 });
      el.hidden = true;
    }));
  }

  function exportCSV() {
    const rows = [["layer","title","desc","severity","lat","lon","date","tags"]];
    state.filtered.forEach(e => rows.push([e._layer, e.title||"", e.desc||"", e.sev||"", e.lat, e.lon, e.date||"", (e.tags||[]).join("|")]));
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(",")).join("\n");
    download("argos-" + Date.now() + ".csv", csv, "text/csv");
  }
  function exportJSON() { download("argos-" + Date.now() + ".json", JSON.stringify(state.filtered, null, 2), "application/json"); }
  function download(name, content, mime) {
    const b = new Blob([content], { type: mime });
    const u = URL.createObjectURL(b); const a = document.createElement("a"); a.href = u; a.download = name; a.click();
    setTimeout(() => URL.revokeObjectURL(u), 1000);
  }

  function toast(msg) { const t = document.createElement("div"); t.className = "toast"; t.textContent = msg; document.body.appendChild(t); setTimeout(() => t.remove(), 2500); }

  function updateClock() {
    const clockEl = document.getElementById("clock");
    if (!clockEl) return;
    const n = new Date();
    const hh = String(n.getUTCHours()).padStart(2,"0"), mm = String(n.getUTCMinutes()).padStart(2,"0"), ss = String(n.getUTCSeconds()).padStart(2,"0");
    clockEl.textContent = `${hh}:${mm}:${ss} UTC`;
  }
  setInterval(updateClock, 1000);

  const COUNTRY_CENTROIDS = [
    {name:"France",lat:46.6,lon:2.2},{name:"Allemagne",lat:51.16,lon:10.45},{name:"Royaume-Uni",lat:55.3,lon:-3.4},
    {name:"Italie",lat:41.87,lon:12.56},{name:"Espagne",lat:40.4,lon:-3.7},{name:"Russie",lat:61,lon:105},
    {name:"Chine",lat:35,lon:105},{name:"Japon",lat:36,lon:138},{name:"Corée du Nord",lat:40,lon:127},
    {name:"USA",lat:39.8,lon:-98.6},{name:"Canada",lat:56,lon:-106},{name:"Mexique",lat:23,lon:-102},
    {name:"Brésil",lat:-10,lon:-55},{name:"Iran",lat:32,lon:53},{name:"Israël",lat:31.5,lon:34.75},
    {name:"Syrie",lat:34.8,lon:38.9},{name:"Turquie",lat:39,lon:35},{name:"Ukraine",lat:49,lon:32},
    {name:"Inde",lat:20.6,lon:78.9},{name:"Arabie saoudite",lat:23.9,lon:45.1},{name:"Yémen",lat:15.5,lon:48.5},
    {name:"Égypte",lat:26.8,lon:30.8},{name:"Soudan",lat:12.9,lon:30.2},{name:"Nigeria",lat:9.08,lon:8.68},
    {name:"Haïti",lat:18.97,lon:-72.3},{name:"Venezuela",lat:6.42,lon:-66.6},{name:"Taïwan",lat:23.7,lon:120.96},
  ];

  setInterval(() => { if (document.getElementById("setAutoRefresh")?.checked) loadAll(); }, 5*60*1000);


  function hideSplash() {
    const s = document.getElementById("splash");
    if (s && !s.classList.contains("hide")) {
      s.classList.add("hide");
      setTimeout(() => s.remove(), 600);
    }
  }

  // Auto-check video IDs via YouTube oEmbed (OK if embeddable).
  // Returns a Set of embeddable IDs.
  async function verifyIds(ids) {
    const ok = new Set();
    await Promise.all(ids.map(async v => {
      try {
        const r = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${v}&format=json`);
        if (r.ok) ok.add(v);
      } catch {}
    }));
    return ok;
  }
  async function pruneBrokenCams() {
    const allIds = new Set();
    Object.values(WEBCAMS).forEach(arr => (arr||[]).forEach(c => c.vid && allIds.add(c.vid)));
    const ok = await verifyIds([...allIds]);
    Object.keys(WEBCAMS).forEach(k => {
      WEBCAMS[k] = (WEBCAMS[k] || []).filter(c => !c.vid || ok.has(c.vid));
    });
    renderCamwall();
  }

  // Popup astuce uBlock — affichée une seule fois, mémorisée dans localStorage
  function showAdblockTip() {
    if (localStorage.getItem("wm_adblock_tip_seen") === "1") return;
    const modal = document.getElementById("adblockModal");
    if (!modal) return;
    modal.hidden = false;
    const close = () => {
      modal.hidden = true;
      try { localStorage.setItem("wm_adblock_tip_seen", "1"); } catch {}
    };
    document.getElementById("adblockOk")?.addEventListener("click", close, { once: true });
    document.getElementById("adblockClose")?.addEventListener("click", close, { once: true });
    modal.addEventListener("click", e => { if (e.target.id === "adblockModal") close(); }, { once: true });
  }

  function init() {
    try {
      parseURL();
      initMap();
      renderLayers();
      wire();
      updateClock();
    } catch (e) {
      console.error("init error", e);
    }
    setTimeout(hideSplash, 2500);
    setTimeout(showAdblockTip, 3000); // après le splash
    loadAll().catch(e => console.error("loadAll error", e)).finally(() => {
      hideSplash();
      // Self-heal: drop any webcam IDs that YouTube reports as non-embeddable
      pruneBrokenCams().catch(() => {});
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
