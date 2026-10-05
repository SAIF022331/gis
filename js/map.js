/* =========================================================
   MAP SETUP + UNIFIED SEARCH
   ========================================================= */
const PK_CENTER = [30.3753, 69.3451];
const PK_ZOOM = 5;

const map = L.map("map", { center: PK_CENTER, zoom: PK_ZOOM, minZoom: 4, maxZoom: 18 });

const CARTO_ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions" target="_blank" rel="noopener">CARTO</a>';
const voyager = L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", { maxZoom: 19, subdomains: "abcd", attribution: CARTO_ATTR }).addTo(map);
const darkMap = L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", { maxZoom: 19, subdomains: "abcd", attribution: CARTO_ATTR });
const osmLayer = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: CARTO_ATTR.split(" &copy; <a href=\"https://carto")[0] });
const satelliteLayer = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", { maxZoom: 19, attribution: "Tiles &copy; Esri" });

const layerControl = L.control.layers(
    { "Light (English labels)": voyager, "Dark": darkMap, "OpenStreetMap": osmLayer, "Satellite": satelliteLayer },
    {}, { collapsed: true, position: "topright" }
).addTo(map);

function registerOverlayLayer(name, layer) { layerControl.addOverlay(layer, name); }

document.getElementById("reset-map").addEventListener("click", () => {
    map.closePopup();
    map.setView(PK_CENTER, PK_ZOOM);
});

document.getElementById("pinned-chip").addEventListener("click", () => {
    document.getElementById("hero").scrollIntoView({ behavior: "smooth", block: "start" });
});

/* ---------- Legend ---------- */
const legend = L.control({ position: "bottomleft" });
legend.onAdd = function () {
    const div = L.DomUtil.create("div", "map-legend");
    const sw = c => `<span class="legend-swatch" style="background:${c}"></span>`;
    div.innerHTML = `
        <div class="legend-title">Map Legend</div>
        <div class="legend-item"><span class="legend-swatch" style="background:#fff;border:3px solid #0f766e"></span>City</div>
        <div class="legend-title" style="margin-top:8px">Station temperature</div>
        <div class="legend-item">${sw("#EF4444")}35 °C +</div>
        <div class="legend-item">${sw("#F97316")}30 – 35 °C</div>
        <div class="legend-item">${sw("#EAB308")}25 – 30 °C</div>
        <div class="legend-item">${sw("#22C55E")}20 – 25 °C</div>
        <div class="legend-item">${sw("#3B82F6")}10 – 20 °C</div>
        <div class="legend-item">${sw("#2563EB")}below 10 °C</div>`;
    return div;
};
legend.addTo(map);

/* ---------- Unified search (cities + stations) ---------- */
const searchIndex = [];
function addToSearchIndex(entry) { searchIndex.push(entry); }

const searchInput = document.getElementById("city-search");
const searchResults = document.getElementById("search-results");
const clearSearchBtn = document.getElementById("clear-search");
const hideResults = () => { searchResults.style.display = "none"; };

searchInput.addEventListener("input", function () {
    const q = this.value.trim().toLowerCase();
    clearSearchBtn.style.display = q ? "block" : "none";
    if (!q) return hideResults();

    const matches = searchIndex
        .filter(e => e.name.toLowerCase().includes(q))
        .sort((a, b) => a.name.toLowerCase().indexOf(q) - b.name.toLowerCase().indexOf(q))
        .slice(0, 8);

    if (!matches.length) {
        searchResults.innerHTML = '<div class="search-no-result">No matching location found.</div>';
    } else {
        searchResults.innerHTML = matches.map((m, i) => `
            <div class="search-result" data-i="${i}">
                <div><b>${m.name}</b><small>${m.province}</small></div><em>${m.kind}</em>
            </div>`).join("");
        searchResults.querySelectorAll(".search-result").forEach(el => {
            el.addEventListener("click", () => {
                const m = matches[Number(el.dataset.i)];
                searchInput.value = m.name;
                hideResults();
                m.open();
            });
        });
    }
    searchResults.style.display = "block";
});

clearSearchBtn.addEventListener("click", () => {
    searchInput.value = "";
    clearSearchBtn.style.display = "none";
    hideResults();
    searchInput.focus();
});
document.addEventListener("click", e => { if (!e.target.closest(".map-search")) hideResults(); });
