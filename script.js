/**
 * Nimbus — Smart City Weather Dashboard
 * Updated script supporting the redesigned UI
 */

// ==========================================
// CONFIGURATION
// ==========================================
const API_KEY = 'ee8dce99bc63209d0782ce2987028561';
const BASE_URL = 'https://api.openweathermap.org/data/2.5';

// ==========================================
// DOM ELEMENTS
// ==========================================
const searchForm      = document.getElementById('search-form');
const cityInput       = document.getElementById('city-input');
const errorMessage    = document.getElementById('error-message');
const errorText       = document.getElementById('error-text');
const loadingEl       = document.getElementById('loading');
const weatherContent  = document.getElementById('weather-content');

const cityDisplay      = document.getElementById('city-display');
const countryDisplay   = document.getElementById('country-display');
const currentIcon      = document.getElementById('current-icon');
const currentTemp      = document.getElementById('current-temp');
const currentCondition = document.getElementById('current-condition');
const currentHumidity  = document.getElementById('current-humidity');
const currentWind      = document.getElementById('current-wind');
const feelsLikeEl      = document.getElementById('feels-like');
const visibilityEl     = document.getElementById('visibility');
const sunriseEl        = document.getElementById('sunrise-time');
const sunsetEl         = document.getElementById('sunset-time');
const adviceContainer  = document.getElementById('advice-container');
const forecastContainer = document.getElementById('forecast-container');

// ==========================================
// INIT
// ==========================================
document.addEventListener('DOMContentLoaded', initApp);

searchForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const city = cityInput.value.trim();
    if (city) fetchWeatherData(city);
});

function initApp() {
    const saved = localStorage.getItem('lastSearchedCity');
    if (saved) {
        fetchWeatherData(saved);
    } else if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition(
            pos => fetchWeatherByCoords(pos.coords.latitude, pos.coords.longitude),
            ()  => fetchWeatherData('London')
        );
    } else {
        fetchWeatherData('London');
    }
}

// ==========================================
// FETCH
// ==========================================
async function fetchWeatherByCoords(lat, lon) {
    showLoading();
    try {
        const [curRes, fcRes] = await Promise.all([
            fetch(`${BASE_URL}/weather?lat=${lat}&lon=${lon}&units=metric&appid=${API_KEY}`),
            fetch(`${BASE_URL}/forecast?lat=${lat}&lon=${lon}&units=metric&appid=${API_KEY}`)
        ]);
        handleApiResponses(curRes, fcRes);
    } catch { showError("Failed to connect to weather service."); }
}

async function fetchWeatherData(city) {
    showLoading();
    try {
        const [curRes, fcRes] = await Promise.all([
            fetch(`${BASE_URL}/weather?q=${city}&units=metric&appid=${API_KEY}`),
            fetch(`${BASE_URL}/forecast?q=${city}&units=metric&appid=${API_KEY}`)
        ]);
        handleApiResponses(curRes, fcRes);
    } catch { showError("Failed to connect to weather service."); }
}

async function handleApiResponses(curRes, fcRes) {
    if (curRes.status === 401) { showError("Invalid API Key."); return; }
    if (!curRes.ok || !fcRes.ok) { showError("City not found. Please try another search."); return; }

    const current  = await curRes.json();
    const forecast = await fcRes.json();

    localStorage.setItem('lastSearchedCity', current.name);
    cityInput.value = '';
    updateUI(current, forecast);
}

// ==========================================
// UI UPDATE
// ==========================================
function updateUI(current, forecast) {
    hideError();
    hideLoading();

    // Location
    cityDisplay.textContent    = current.name;
    countryDisplay.textContent = current.sys.country;

    // Temp & Condition
    const temp = Math.round(current.main.temp);
    currentTemp.textContent      = `${temp}°`;
    currentCondition.textContent = current.weather[0].description;
    currentHumidity.textContent  = `${current.main.humidity}%`;
    currentWind.textContent      = `${current.wind.speed} m/s`;
    feelsLikeEl.textContent      = `${Math.round(current.main.feels_like)}°`;
    visibilityEl.textContent     = `${(current.visibility / 1000).toFixed(1)} km`;

    // Icon
    currentIcon.src = `https://openweathermap.org/img/wn/${current.weather[0].icon}@4x.png`;

    // Sun times
    const sunrise = formatTime(current.sys.sunrise, current.timezone);
    const sunset  = formatTime(current.sys.sunset, current.timezone);
    sunriseEl.textContent = sunrise;
    sunsetEl.textContent  = sunset;
    animateSunArc(current.sys.sunrise, current.sys.sunset);

    // Advice
    const pop = forecast.list[0].pop * 100;
    generateAdvice(temp, pop, current.weather[0].main);

    // Forecast
    renderForecast(forecast);

    // Reveal
    weatherContent.classList.remove('hidden');
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            weatherContent.classList.add('revealed');
        });
    });
}

// ==========================================
// SUN ARC
// ==========================================
function animateSunArc(sunriseUnix, sunsetUnix) {
    const now   = Math.floor(Date.now() / 1000);
    const total = sunsetUnix - sunriseUnix;
    const elapsed = Math.min(Math.max(now - sunriseUnix, 0), total);
    const progress = elapsed / total; // 0–1

    const pathLength = 300;
    const dashOffset = pathLength * (1 - progress);

    const progressPath = document.getElementById('sun-progress-path');
    const sunDot = document.getElementById('sun-dot');

    if (progressPath) {
        progressPath.style.strokeDashoffset = dashOffset;
        progressPath.style.transition = 'stroke-dashoffset 1.5s ease-out';
    }

    // Position the dot along the arc using parametric SVG path
    if (sunDot) {
        // Arc: Q100 0 190 100 from x=10,y=100
        const t = progress;
        // Bezier quadratic: P = (1-t)^2 * P0 + 2*(1-t)*t * P1 + t^2 * P2
        const x = Math.pow(1 - t, 2) * 10   + 2 * (1 - t) * t * 100 + t * t * 190;
        const y = Math.pow(1 - t, 2) * 100  + 2 * (1 - t) * t * 0   + t * t * 100;
        sunDot.setAttribute('cx', x.toFixed(1));
        sunDot.setAttribute('cy', y.toFixed(1));
    }
}

function formatTime(unixTimestamp, timezoneOffset) {
    const date = new Date((unixTimestamp + timezoneOffset) * 1000);
    const h = date.getUTCHours().toString().padStart(2, '0');
    const m = date.getUTCMinutes().toString().padStart(2, '0');
    return `${h}:${m}`;
}

// ==========================================
// ADVICE
// ==========================================
function generateAdvice(temp, pop, weatherMain) {
    const list = [];
    const wm = weatherMain.toLowerCase();

    if (temp < 10)       list.push({ icon: '🧥', text: 'Heavy coat recommended — it\'s cold out.' });
    else if (temp < 18)  list.push({ icon: '🧣', text: 'Layer up with a jacket or sweater.' });
    else if (temp <= 26) list.push({ icon: '👕', text: 'Light clothing is perfect today.' });
    else                 list.push({ icon: '🩴', text: 'Stay cool — breathable cotton is best.' });

    if (pop > 20 || wm.includes('rain') || wm.includes('drizzle'))
        list.push({ icon: '☂️', text: 'Bring an umbrella — rain is likely.' });

    if (wm.includes('snow'))
        list.push({ icon: '❄️', text: 'Snowfall expected — wear winter boots.' });

    if (wm.includes('thunderstorm'))
        list.push({ icon: '⚡', text: 'Thunderstorms nearby — stay indoors if possible.' });

    if (wm.includes('fog') || wm.includes('mist') || wm.includes('haze'))
        list.push({ icon: '🌫️', text: 'Low visibility — drive carefully.' });

    if (temp > 30)
        list.push({ icon: '💧', text: 'Stay hydrated — high heat alert.' });

    adviceContainer.innerHTML = '';
    list.forEach((item, i) => {
        const el = document.createElement('div');
        el.className = 'advice-item';
        el.style.animationDelay = `${i * 0.1 + 0.3}s`;
        el.innerHTML = `
            <span class="advice-emoji">${item.icon}</span>
            <span class="advice-text">${item.text}</span>
        `;
        adviceContainer.appendChild(el);
    });
}

// ==========================================
// FORECAST
// ==========================================
function renderForecast(forecastData) {
    forecastContainer.innerHTML = '';

    let daily = forecastData.list.filter(i => i.dt_txt.includes('12:00:00'));
    if (daily.length < 5) {
        daily = forecastData.list.filter((_, idx) => idx % 8 === 0).slice(0, 5);
    }

    daily.forEach((day, i) => {
        const date    = new Date(day.dt * 1000);
        const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
        const temp    = Math.round(day.main.temp);
        const icon    = day.weather[0].icon;
        const desc    = day.weather[0].main;

        const card = document.createElement('div');
        card.className = 'forecast-card';
        card.style.animationDelay = `${i * 0.08 + 0.2}s`;
        card.innerHTML = `
            <span class="forecast-day">${dayName}</span>
            <img class="forecast-icon" src="https://openweathermap.org/img/wn/${icon}@2x.png" alt="${desc}">
            <span class="forecast-temp">${temp}°</span>
            <span class="forecast-desc">${desc}</span>
        `;
        forecastContainer.appendChild(card);
    });
}

// ==========================================
// HELPERS
// ==========================================
let loadingTimer;

function showLoading() {
    hideError();
    weatherContent.classList.remove('revealed');
    clearTimeout(loadingTimer);
    loadingTimer = setTimeout(() => {
        weatherContent.classList.add('hidden');
        loadingEl.classList.remove('hidden');
    }, 300);
}

function hideLoading() {
    clearTimeout(loadingTimer);
    loadingEl.classList.add('hidden');
}

function showError(msg) {
    hideLoading();
    errorText.textContent = msg;
    errorMessage.classList.remove('hidden');
}

function hideError() {
    errorMessage.classList.add('hidden');
}