/* =========================================================
   CITIES LAYER
   ========================================================= */
const cityIcon = L.divIcon({
    className: "city-marker",
    html: '<div class="city-dot"></div>',
    iconSize: [14, 14], iconAnchor: [7, 7], popupAnchor: [0, -9]
});

let citiesLayer;

function createCityPopup(p) {
    return `
        <div class="pop-title"><span class="ico">🏙️</span><div><strong>${p.name}</strong><small>Click to open forecast</small></div></div>
        <div class="pop-row"><span>Province / Region</span><strong>${p.province}</strong></div>
        <div class="pop-row"><span>City Type</span><strong>${p.type}</strong></div>`;
}

fetch("data/cities.geojson")
    .then(r => { if (!r.ok) throw new Error("Unable to load cities.geojson"); return r.json(); })
    .then(data => {
        citiesLayer = L.geoJSON(data, {
            pointToLayer: (f, latlng) => L.marker(latlng, { icon: cityIcon, zIndexOffset: 1000 }),
            onEachFeature: (feature, layer) => {
                const p = feature.properties;
                layer.bindPopup(createCityPopup(p), { maxWidth: 300 });

                const pick = () => {
                    const ll = layer.getLatLng();
                    selectLocation({ key: `city:${p.name}`, name: p.name, province: p.province, type: p.type, lat: ll.lat, lon: ll.lng }, true);
                };
                layer.on("click", pick);

                addToSearchIndex({
                    name: p.name, province: p.province, kind: "City",
                    open() {
                        map.flyTo(layer.getLatLng(), 10);
                        map.once("moveend", () => { layer.openPopup(); pick(); });
                    }
                });
            }
        }).addTo(map);
        registerOverlayLayer("Cities", citiesLayer);
    })
    .catch(err => console.error("Error loading city data:", err));
