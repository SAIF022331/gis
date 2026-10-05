/* =========================================================
   HERO (selected location) + HOURLY + 7-DAY + 48h CHART
   Data: Open-Meteo forecast API
   ========================================================= */
const HERO_DEFAULT = { key: "city:Islamabad", name: "Islamabad", province: "Islamabad Capital Territory", type: "National Capital", lat: 33.6844, lon: 73.0479 };
const forecastCache = new Map();
let selected = null;
let forecastChart = null;

async function getForecast(key, lat, lon, force) {
    const hit = forecastCache.get(key);
    if (hit && !force && Date.now() - hit.t < 60000) return hit.data;
    const url = `${WEATHER_API}?latitude=${lat}&longitude=${lon}&current=${WEATHER_FIELDS}` +
        `&hourly=temperature_2m,precipitation_probability,weather_code,is_day` +
        `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max` +
        `&forecast_days=7&timezone=auto`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Forecast API error ${res.status}`);
    const data = await res.json();
    forecastCache.set(key, { t: Date.now(), data });
    return data;
}

function selectLocation(loc, showChip) {
    selected = loc;
    document.getElementById("hero").classList.add("loading");
    setText("hero-name", loc.name);
    setText("hero-sub", [loc.type, loc.province].filter(Boolean).join(" · "));
    const chip = document.getElementById("pinned-chip");
    if (showChip) { chip.textContent = `📍 ${loc.name} — view forecast ↑`; chip.style.display = "block"; }
    loadHero(false);
}

async function loadHero(force) {
    const loc = selected;
    if (!loc) return;
    try {
        const d = await getForecast(loc.key, loc.lat, loc.lon, force);
        if (selected === loc) renderHero(loc, d);
    } catch (e) {
        console.error("Forecast error:", e);
        if (selected === loc) { setText("hero-cond", "Forecast unavailable"); setText("hero-summary", "Check your connection and try again."); }
    }
}

function themeFor(code, isDay) {
    if ([95, 96, 99].includes(code)) return "storm";
    if ([71, 73, 75, 77, 85, 86].includes(code)) return "snow";
    if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return "rain";
    if (!isDay) return "night";
    return code >= 2 ? "cloudy" : "clear";
}

function renderHero(loc, d) {
    const c = d.current, day = d.daily, hr = d.hourly;
    const isDay = c.is_day === 1;
    const hero = document.getElementById("hero");
    hero.className = `hero t-${themeFor(c.weather_code, isDay)}`;

    const hi = Math.round(day.temperature_2m_max[0]), lo = Math.round(day.temperature_2m_min[0]);
    setText("hero-temp", `${Math.round(c.temperature_2m)}°`);
    setText("hero-cond", getCondition(c.weather_code));
    setText("hero-hilo", `↑${hi}° / ↓${lo}°`);
    setText("hero-feels", `Feels like ${Math.round(c.apparent_temperature)}°`);
    setText("hero-summary", `${getCondition(c.weather_code)}. ` + (isDay ? `High ${hi}°C today.` : `Low ${lo}°C tonight.`));
    setText("hero-updated", `Live data from Open-Meteo · observed ${c.time.replace("T", " ")} local time`);

    const m = (ico, label, val) => `<div class="metric"><span>${ico} ${label}</span><strong>${val}</strong></div>`;
    document.getElementById("hero-metrics").innerHTML =
        m("🌡️", "Temperature", `${c.temperature_2m} °C`) +
        m("💧", "Humidity", `${c.relative_humidity_2m} %`) +
        m("🌧️", "Precipitation", `${c.precipitation} mm`) +
        m("💨", "Wind Speed", `${c.wind_speed_10m} km/h`) +
        m("🧭", "Wind Direction", windDirText(c.wind_direction_10m)) +
        m("☁️", "Conditions", getCondition(c.weather_code));

    /* Hourly strip: next 24 hours */
    let i0 = hr.time.findIndex(t => t.slice(0, 13) >= c.time.slice(0, 13));
    if (i0 < 0) i0 = 0;
    document.getElementById("hourly").innerHTML = hr.time.slice(i0, i0 + 24).map((t, k) => {
        const i = i0 + k;
        return `<div class="hour${k === 0 ? " now" : ""}"><div class="t">${k === 0 ? "Now" : hourLabel(t)}</div>
            <div class="i">${getEmoji(hr.weather_code[i], hr.is_day[i] === 1)}</div>
            <div class="d">${Math.round(hr.temperature_2m[i])}°</div>
            <div class="p">💧 ${hr.precipitation_probability[i] ?? 0}%</div></div>`;
    }).join("");

    /* 7-day list with temperature range bars */
    const gMin = Math.min(...day.temperature_2m_min), gMax = Math.max(...day.temperature_2m_max);
    const span = Math.max(gMax - gMin, 1);
    document.getElementById("daily").innerHTML = day.time.map((dt, i) => {
        const name = i === 0 ? "Today" : new Date(dt + "T12:00:00").toLocaleDateString("en-US", { weekday: "short" });
        const mn = day.temperature_2m_min[i], mx = day.temperature_2m_max[i];
        return `<div class="day"><span class="n">${name}</span>
            <span class="p">💧 ${day.precipitation_probability_max[i] ?? 0}%</span>
            <span>${getEmoji(day.weather_code[i], true)}</span>
            <span class="lo">${Math.round(mn)}°</span>
            <div class="range"><i style="left:${((mn - gMin) / span) * 100}%;width:${Math.max(((mx - mn) / span) * 100, 6)}%"></i></div>
            <span class="hi">${Math.round(mx)}°</span></div>`;
    }).join("");

    hero.classList.remove("loading");
    drawForecastChart(loc, hr, i0);
}

/* ---------- 48-hour chart: temperature curve + rain probability bars ---------- */
function drawForecastChart(loc, hr, i0) {
    if (typeof Chart === "undefined") return;
    const end = Math.min(i0 + 48, hr.time.length);
    const times = hr.time.slice(i0, end);
    const temps = hr.temperature_2m.slice(i0, end);
    const rain = hr.precipitation_probability.slice(i0, end).map(v => v ?? 0);
    const labels = times.map((t, k) => (k === 0 || t.slice(11, 13) === "00")
        ? [hourLabel(t), new Date(t.slice(0, 10) + "T12:00:00").toLocaleDateString("en-US", { weekday: "short" })]
        : hourLabel(t));

    setText("forecast-sub", `${loc.name} · temperature curve with chance of rain`);

    const crosshair = {
        id: "crosshair",
        afterDatasetsDraw(chart) {
            const act = chart.tooltip && chart.tooltip.getActiveElements();
            if (!act || !act.length) return;
            const x = act[0].element.x, { top, bottom } = chart.chartArea, ctx = chart.ctx;
            ctx.save(); ctx.strokeStyle = "rgba(255,255,255,.35)"; ctx.setLineDash([4, 4]);
            ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x, bottom); ctx.stroke(); ctx.restore();
        }
    };

    if (forecastChart) forecastChart.destroy();
    forecastChart = new Chart(document.getElementById("forecast-chart"), {
        data: {
            labels,
            datasets: [
                { type: "bar", label: "Chance of rain (%)", data: rain, yAxisID: "y1", order: 2, backgroundColor: "rgba(96,165,250,.38)", borderRadius: 3, barPercentage: 1, categoryPercentage: .85 },
                { type: "line", label: "Temperature (°C)", data: temps, yAxisID: "y", order: 1, borderColor: "#fbbf24", borderWidth: 2.5, tension: .4, pointRadius: 0, pointHoverRadius: 5, pointHoverBackgroundColor: "#fff", fill: true,
                  backgroundColor: ctx => {
                      const { chart } = ctx, a = chart.chartArea;
                      if (!a) return "rgba(251,191,36,.2)";
                      const g = chart.ctx.createLinearGradient(0, a.top, 0, a.bottom);
                      g.addColorStop(0, "rgba(251,191,36,.45)"); g.addColorStop(1, "rgba(251,191,36,0)");
                      return g;
                  } }
            ]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            interaction: { mode: "index", intersect: false },
            plugins: {
                legend: { position: "top", align: "end", labels: { usePointStyle: true, boxWidth: 8 } },
                tooltip: { backgroundColor: "#0f1b3d", borderColor: "rgba(255,255,255,.15)", borderWidth: 1, padding: 10,
                    callbacks: {
                        title: items => { const t = times[items[0].dataIndex]; return `${new Date(t.slice(0, 10) + "T12:00:00").toLocaleDateString("en-US", { weekday: "long" })}, ${hourLabel(t)}`; },
                        label: c => c.datasetIndex === 1 ? ` Temperature: ${c.parsed.y}°C` : ` Chance of rain: ${c.parsed.y}%`
                    } }
            },
            scales: {
                x: { grid: { display: false }, border: { display: false }, ticks: { maxTicksLimit: 12, maxRotation: 0 } },
                y: { position: "left", grid: { color: "rgba(255,255,255,.07)" }, border: { display: false }, ticks: { callback: v => v + "°" },
                     suggestedMin: Math.floor(Math.min(...temps)) - 2, suggestedMax: Math.ceil(Math.max(...temps)) + 2 },
                y1: { position: "right", min: 0, max: 100, grid: { drawOnChartArea: false }, border: { display: false }, ticks: { callback: v => v + "%", stepSize: 25 } }
            }
        },
        plugins: [crosshair]
    });
}

/* Chart.js defaults to match the theme */
if (typeof Chart !== "undefined") {
    Chart.defaults.color = "#94a3c4";
    Chart.defaults.font.family = "Inter, Arial, sans-serif";
    Chart.defaults.borderColor = "rgba(255,255,255,.08)";
}

selectLocation(HERO_DEFAULT, false);
