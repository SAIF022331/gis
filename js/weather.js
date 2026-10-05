/* =========================================================
   WEATHER STATIONS + NETWORK DATA (Open-Meteo)
   - 120 stations, fetched in batches of 50 locations per request
   - Hovering a station opens its live popup with all 6 values
   - Auto-refresh (default 5 min)
   ========================================================= */
const WEATHER_API = "https://api.open-meteo.com/v1/forecast";
const WEATHER_FIELDS = "temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,weather_code,wind_speed_10m,wind_direction_10m,is_day";
const BATCH_SIZE = 50;

const weatherCache = new Map();
const pendingRequests = new Map();

async function fetchBatch(points) {
    const url = `${WEATHER_API}?latitude=${points.map(p => p.lat).join(",")}` +
        `&longitude=${points.map(p => p.lon).join(",")}&current=${WEATHER_FIELDS}&timezone=auto`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Weather API error ${res.status}`);
    const json = await res.json();
    (Array.isArray(json) ? json : [json]).forEach((d, i) => { if (d.current) weatherCache.set(points[i].key, d.current); });
}

function getWeather(key, lat, lon) {
    if (weatherCache.has(key)) return Promise.resolve(weatherCache.get(key));
    if (pendingRequests.has(key)) return pendingRequests.get(key);
    const p = fetchBatch([{ key, lat, lon }])
        .then(() => { if (!weatherCache.has(key)) throw new Error("No data"); return weatherCache.get(key); })
        .finally(() => pendingRequests.delete(key));
    pendingRequests.set(key, p);
    return p;
}

async function loadAllWeather() {
    const points = stations.map(s => ({ key: s.key, lat: s.lat, lon: s.lon }));
    const jobs = [];
    for (let i = 0; i < points.length; i += BATCH_SIZE) jobs.push(fetchBatch(points.slice(i, i + BATCH_SIZE)));
    await Promise.allSettled(jobs);   // old values stay if a batch fails
}

/* ---------- Markers + popup ---------- */
function stationIcon(color) {
    return L.divIcon({
        className: "weather-marker",
        html: `<div class="weather-marker-inner" style="background:${color}">☁</div>`,
        iconSize: [28, 28], iconAnchor: [14, 14], popupAnchor: [0, -14]
    });
}

function weatherPopupHtml(name, w) {
    const it = (ico, label, val) => `<div class="pop-item"><span>${ico} ${label}</span><strong>${val}</strong></div>`;
    const day = w.is_day !== 0;
    return `
        <div class="live-badge"><i></i>LIVE WEATHER</div>
        <div class="pop-title"><span class="ico">${getEmoji(w.weather_code, day)}</span>
            <div><strong>${name}</strong><small>${getCondition(w.weather_code)}</small></div></div>
        <div class="pop-grid">
            ${it("🌡️", "Temperature", `${w.temperature_2m} °C`)}
            ${it("💧", "Humidity", `${w.relative_humidity_2m} %`)}
            ${it("🌧️", "Precipitation", `${w.precipitation} mm`)}
            ${it("💨", "Wind Speed", `${w.wind_speed_10m} km/h`)}
            ${it("🧭", "Wind Direction", windDirText(w.wind_direction_10m))}
            ${it("☁️", "Conditions", getCondition(w.weather_code))}
        </div>
        <div class="pop-src">Source: Open-Meteo · ${w.time ? w.time.replace("T", " ") : ""} (local)</div>`;
}

const stations = [];
const stationGroup = L.markerClusterGroup({ showCoverageOnHover: false, maxClusterRadius: 42, disableClusteringAtZoom: 8 }).addTo(map);
const hoverPopup = L.popup({ closeButton: false, autoPan: false, offset: [0, -4], maxWidth: 320 });
let activeStation = null;

function openStationPopup(st) {
    activeStation = st.key;
    hoverPopup.setLatLng([st.lat, st.lon]);
    if (weatherCache.has(st.key)) {
        hoverPopup.setContent(weatherPopupHtml(st.name, weatherCache.get(st.key))).openOn(map);
        return;
    }
    hoverPopup.setContent('<div class="pop-msg">Loading weather...</div>').openOn(map);
    getWeather(st.key, st.lat, st.lon)
        .then(w => { if (activeStation === st.key && map.hasLayer(hoverPopup)) hoverPopup.setContent(weatherPopupHtml(st.name, w)); })
        .catch(() => { if (activeStation === st.key && map.hasLayer(hoverPopup)) hoverPopup.setContent('<div class="pop-msg">Weather data unavailable.</div>'); });
}
function closeStationPopup() { activeStation = null; map.closePopup(hoverPopup); }

function pickStation(st) {
    selectLocation({ key: st.key, name: st.name.replace(" Weather Station", ""), province: st.province, type: "Weather Station", lat: st.lat, lon: st.lon }, true);
}

/* Province filter */
const provinceFilter = document.getElementById("province-filter");
function applyProvinceFilter() {
    const prov = provinceFilter.value;
    const shown = stations.filter(s => prov === "all" || s.province === prov);
    stationGroup.clearLayers();
    stationGroup.addLayers(shown.map(s => s.marker));
    if (prov === "all") map.setView(PK_CENTER, PK_ZOOM);
    else if (shown.length) map.fitBounds(L.latLngBounds(shown.map(s => [s.lat, s.lon])), { padding: [40, 40], maxZoom: 9 });
    setText("station-summary", `Current conditions across ${shown.length} weather stations` + (prov === "all" ? "" : ` in ${prov}`));
}
provinceFilter.addEventListener("change", applyProvinceFilter);

/* Load stations */
fetch("data/weather-stations.geojson")
    .then(r => { if (!r.ok) throw new Error("Unable to load weather-stations.geojson"); return r.json(); })
    .then(data => {
        data.features.forEach(f => {
            const [lon, lat] = f.geometry.coordinates;
            const p = f.properties;
            const st = { key: p.station_id, name: p.name, province: p.province, lat, lon };

            st.marker = L.marker([lat, lon], { icon: stationIcon("#2563eb"), keyboard: false });
            st.marker.on("mouseover", () => openStationPopup(st));
            st.marker.on("mouseout", closeStationPopup);
            st.marker.on("click", () => { openStationPopup(st); pickStation(st); });

            addToSearchIndex({
                name: p.name, province: p.province, kind: "Station",
                open() {
                    if (!stationGroup.hasLayer(st.marker)) { provinceFilter.value = "all"; applyProvinceFilter(); }
                    map.flyTo([lat, lon], 10);
                    map.once("moveend", () => { openStationPopup(st); pickStation(st); });
                }
            });
            stations.push(st);
        });

        [...new Set(stations.map(s => s.province))].sort().forEach(prov =>
            provinceFilter.insertAdjacentHTML("beforeend", `<option value="${prov}">${prov}</option>`));

        stationGroup.addLayers(stations.map(s => s.marker));
        registerOverlayLayer("Weather Stations", stationGroup);
        setText("station-summary", `Current conditions across ${stations.length} weather stations`);
        refreshWeatherUI();
    })
    .catch(err => { console.error("Error loading weather stations:", err); setStatus("err", "Station data unavailable"); });

/* ---------- Overview cards ---------- */
function setStatus(state, text) {
    document.getElementById("status-dot").className = "status-dot" + (state ? " " + state : "");
    setText("weather-status-text", text);
}

function updateDashboard() {
    const rows = stations.filter(s => weatherCache.has(s.key))
        .map(s => ({ name: s.name.replace(" Weather Station", ""), w: weatherCache.get(s.key) }));
    if (!rows.length) return false;
    const avg = a => a.reduce((s, v) => s + v, 0) / a.length;
    const hot = rows.reduce((a, b) => (b.w.temperature_2m > a.w.temperature_2m ? b : a));
    const cold = rows.reduce((a, b) => (b.w.temperature_2m < a.w.temperature_2m ? b : a));
    setText("average-temperature", `${avg(rows.map(r => r.w.temperature_2m)).toFixed(1)} °C`);
    setText("highest-temperature", `${hot.w.temperature_2m.toFixed(1)} °C`);
    setText("hottest-location", hot.name);
    setText("lowest-temperature", `${cold.w.temperature_2m.toFixed(1)} °C`);
    setText("coolest-location", cold.name);
    setText("average-precipitation", `${avg(rows.map(r => r.w.precipitation)).toFixed(1)} mm`);
    return true;
}

function colorMarkers() {
    stations.forEach(s => {
        const w = weatherCache.get(s.key);
        if (w) s.marker.setIcon(stationIcon(getTemperatureStyle(w.temperature_2m).fill));
    });
}

/* ---------- Station comparison chart (ranked horizontal bars) ---------- */
let comparisonChart = null;
const METRICS = {
    temperature:   { key: "temperature_2m",       unit: "°C",   label: "Temperature" },
    humidity:      { key: "relative_humidity_2m", unit: "%",    label: "Humidity" },
    precipitation: { key: "precipitation",        unit: " mm",  label: "Precipitation" },
    wind:          { key: "wind_speed_10m",       unit: " km/h", label: "Wind speed" }
};

function createComparisonChart() {
    if (typeof Chart === "undefined") return;
    const metric = document.getElementById("weather-chart-type").value;
    const order = document.getElementById("weather-chart-order").value;
    const m = METRICS[metric];

    const rows = stations.filter(s => weatherCache.has(s.key))
        .map(s => ({ name: s.name.replace(" Weather Station", ""), v: weatherCache.get(s.key)[m.key] }))
        .sort((a, b) => order === "high" ? b.v - a.v : a.v - b.v).slice(0, 15);
    if (!rows.length) return;

    const colors = rows.map(r => metric === "temperature" ? getTemperatureStyle(r.v).fill : "#3b82f6");
    const valueLabels = {
        id: "valueLabels",
        afterDatasetsDraw(chart) {
            const { ctx } = chart;
            ctx.save();
            ctx.fillStyle = "#e8eefc"; ctx.font = "600 11px Inter, Arial"; ctx.textBaseline = "middle";
            chart.getDatasetMeta(0).data.forEach((bar, i) => ctx.fillText(`${rows[i].v}${m.unit}`, bar.x + 8, bar.y));
            ctx.restore();
        }
    };

    if (comparisonChart) comparisonChart.destroy();
    comparisonChart = new Chart(document.getElementById("weather-chart"), {
        type: "bar",
        data: { labels: rows.map(r => r.name), datasets: [{ data: rows.map(r => r.v), backgroundColor: colors.map(c => c + "cc"), borderColor: colors, borderWidth: 1, borderRadius: 6, barPercentage: .72 }] },
        options: {
            indexAxis: "y", responsive: true, maintainAspectRatio: false,
            layout: { padding: { right: 64 } },
            plugins: { legend: { display: false },
                tooltip: { backgroundColor: "#0f1b3d", borderColor: "rgba(255,255,255,.15)", borderWidth: 1, padding: 10, displayColors: false,
                    callbacks: { label: c => `${m.label}: ${c.parsed.x}${m.unit}` } } },
            scales: {
                x: { beginAtZero: metric !== "temperature", grid: { color: "rgba(255,255,255,.07)" }, border: { display: false }, ticks: { callback: v => v + m.unit.trim() } },
                y: { grid: { display: false }, border: { display: false }, ticks: { font: { size: 12 } } }
            }
        },
        plugins: [valueLabels]
    });
}
document.getElementById("weather-chart-type").addEventListener("change", createComparisonChart);
document.getElementById("weather-chart-order").addEventListener("change", createComparisonChart);

/* ---------- Refresh + auto-refresh ---------- */
let isRefreshing = false;

async function refreshWeatherUI() {
    if (isRefreshing) return;
    isRefreshing = true;
    const btn = document.getElementById("refresh-weather");
    btn.disabled = true; btn.textContent = "↻ Updating...";
    setStatus("", "Updating live weather...");

    await loadAllWeather();
    if (typeof loadHero === "function") loadHero(true);   // refresh selected-location forecast too

    if (updateDashboard()) {
        colorMarkers();
        createComparisonChart();
        setStatus("ok", `LIVE · ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} · ${weatherCache.size}/${stations.length} stations`);
    } else {
        setStatus("err", "Weather unavailable — check connection");
    }
    btn.disabled = false; btn.textContent = "↻ Refresh now";
    isRefreshing = false;
    scheduleNextRefresh();
}
document.getElementById("refresh-weather").addEventListener("click", refreshWeatherUI);

const autoSelect = document.getElementById("auto-refresh");
let nextRefreshAt = null;
try {
    const saved = localStorage.getItem("autoRefreshMinutes");
    if (saved !== null && [...autoSelect.options].some(o => o.value === saved)) autoSelect.value = saved;
} catch (e) {}

function scheduleNextRefresh() {
    const min = Number(autoSelect.value);
    nextRefreshAt = min > 0 ? Date.now() + min * 60000 : null;
    updateCountdown();
}
function updateCountdown() {
    const el = document.getElementById("next-refresh");
    if (!nextRefreshAt) { el.textContent = "Auto-refresh off"; return; }
    const left = Math.max(0, Math.round((nextRefreshAt - Date.now()) / 1000));
    el.textContent = `Next update in ${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`;
}
autoSelect.addEventListener("change", () => {
    try { localStorage.setItem("autoRefreshMinutes", autoSelect.value); } catch (e) {}
    scheduleNextRefresh();
});
// Pauses while the tab is hidden and catches up when you return.
setInterval(() => {
    if (!stations.length || isRefreshing) return;
    updateCountdown();
    if (nextRefreshAt && !document.hidden && Date.now() >= nextRefreshAt) refreshWeatherUI();
}, 1000);
