/* =========================================================
   SHARED HELPERS
   ========================================================= */
function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
}

const CONDITIONS = {
    0: "Clear sky", 1: "Mainly clear", 2: "Partly cloudy", 3: "Overcast", 45: "Fog", 48: "Rime fog",
    51: "Light drizzle", 53: "Moderate drizzle", 55: "Dense drizzle", 56: "Freezing drizzle", 57: "Freezing drizzle",
    61: "Slight rain", 63: "Moderate rain", 65: "Heavy rain", 66: "Freezing rain", 67: "Freezing rain",
    71: "Slight snow", 73: "Moderate snow", 75: "Heavy snow", 77: "Snow grains",
    80: "Rain showers", 81: "Moderate rain showers", 82: "Heavy rain showers", 85: "Snow showers", 86: "Heavy snow showers",
    95: "Thunderstorm", 96: "Thunderstorm with hail", 99: "Thunderstorm with heavy hail"
};
const getCondition = c => CONDITIONS[c] || "Unknown conditions";

function getEmoji(c, isDay = true) {
    if (c === 0) return isDay ? "☀️" : "🌙";
    if (c === 1) return isDay ? "🌤️" : "🌙";
    if (c === 2) return isDay ? "⛅" : "☁️";
    if (c === 3) return "☁️";
    if (c === 45 || c === 48) return "🌫️";
    if ([51, 53, 55, 56, 57].includes(c)) return "🌦️";
    if ([61, 63, 65, 66, 67, 80, 81, 82].includes(c)) return "🌧️";
    if ([71, 73, 75, 77, 85, 86].includes(c)) return "❄️";
    if ([95, 96, 99].includes(c)) return "⛈️";
    return "🌦️";
}

/* 245 -> "245° (WSW)" */
function windDirText(deg) {
    if (deg === null || deg === undefined) return "—";
    const pts = ["N","NNE","NE","ENE","E","ESE","SE","SSE","S","SSW","SW","WSW","W","WNW","NW","NNW"];
    return `${deg}° (${pts[Math.round(deg / 22.5) % 16]})`;
}

function getTemperatureStyle(t) {
    if (t >= 40) return { fill: "#DC2626", label: "Extreme heat" };
    if (t >= 35) return { fill: "#EF4444", label: "Very hot" };
    if (t >= 30) return { fill: "#F97316", label: "Hot" };
    if (t >= 25) return { fill: "#EAB308", label: "Warm" };
    if (t >= 20) return { fill: "#22C55E", label: "Moderate" };
    if (t >= 10) return { fill: "#3B82F6", label: "Cool" };
    return { fill: "#2563EB", label: "Cold" };
}

/* "2026-10-05T14:00" -> "2 pm" */
function hourLabel(timeStr) {
    const h = Number(timeStr.slice(11, 13));
    return `${h % 12 || 12} ${h < 12 ? "am" : "pm"}`;
}
