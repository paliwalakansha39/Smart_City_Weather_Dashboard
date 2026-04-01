/**
 * Smart City Weather Dashboard - Main Script
 * Handles real-time weather fetching, forecast mapping, UI rendering, and Geolocation.
 */

// ==========================================
// CONFIGURATION
// ==========================================
// Replace this with your OpenWeatherMap API Key
const API_KEY = 'ee8dce99bc63209d0782ce2987028561'; // Your personal OpenWeatherMap API Key
const BASE_URL = 'https://api.openweathermap.org/data/2.5';

// ==========================================
// DOM ELEMENTS
// ==========================================
const appBody = document.getElementById('app-body');
const searchForm = document.getElementById('search-form');
const cityInput = document.getElementById('city-input');
const errorMessage = document.getElementById('error-message');
const errorText = document.getElementById('error-text');
const loadingIndicator = document.getElementById('loading');
const weatherContent = document.getElementById('weather-content');

// Current Weather Elements
const cityDisplay = document.getElementById('city-display');
const countryDisplay = document.getElementById('country-display');
const currentIcon = document.getElementById('current-icon');
const currentTemp = document.getElementById('current-temp');
const currentCondition = document.getElementById('current-condition');
const currentHumidity = document.getElementById('current-humidity');
const currentWind = document.getElementById('current-wind');

// Advice & Forecast Elements
const adviceContainer = document.getElementById('advice-container');
const forecastContainer = document.getElementById('forecast-container');

// ==========================================
// EVENT LISTENERS
// ==========================================
document.addEventListener('DOMContentLoaded', initApp);

searchForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const city = cityInput.value.trim();
    if (city) {
        fetchWeatherData(city);
    }
});

// ==========================================
// CORE FUNCTIONS
// ==========================================

function initApp() {
    // Check if we have a saved city in localStorage
    const savedCity = localStorage.getItem('lastSearchedCity');

    if (savedCity) {
        // Fetch weather for the saved city
        fetchWeatherData(savedCity);
    } else {
        // Try to get geolocation
        if ("geolocation" in navigator) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const lat = position.coords.latitude;
                    const lon = position.coords.longitude;
                    fetchWeatherByCoords(lat, lon);
                },
                (error) => {
                    console.warn("Geolocation denied or failed.", error);
                    // Fallback to a default city if geolocation fails
                    fetchWeatherData('London');
                }
            );
        } else {
            // Geolocation not supported
            fetchWeatherData('London');
        }
    }
}

// Fetch Weather by coordinates (Geolocation)
async function fetchWeatherByCoords(lat, lon) {
    showLoading();
    try {
        const [currentRes, forecastRes] = await Promise.all([
            fetch(`${BASE_URL}/weather?lat=${lat}&lon=${lon}&units=metric&appid=${API_KEY}`),
            fetch(`${BASE_URL}/forecast?lat=${lat}&lon=${lon}&units=metric&appid=${API_KEY}`)
        ]);

        handleApiResponses(currentRes, forecastRes);
    } catch (error) {
        showError("Failed to connect to weather service.");
    }
}

// Fetch Weather by City Name
async function fetchWeatherData(city) {
    showLoading();
    try {
        const [currentRes, forecastRes] = await Promise.all([
            fetch(`${BASE_URL}/weather?q=${city}&units=metric&appid=${API_KEY}`),
            fetch(`${BASE_URL}/forecast?q=${city}&units=metric&appid=${API_KEY}`)
        ]);

        handleApiResponses(currentRes, forecastRes, city);
    } catch (error) {
        showError("Failed to connect to weather service.");
    }
}

// Process API Responses
async function handleApiResponses(currentRes, forecastRes, searchedCityName = null) {
    if (currentRes.status === 401 || forecastRes.status === 401) {
        showError("Invalid API Key. Please update the API_KEY variable in script.js.");
        return;
    }

    if (!currentRes.ok || !forecastRes.ok) {
        showError("City not found. Please try another search.");
        return;
    }

    const currentData = await currentRes.json();
    const forecastData = await forecastRes.json();

    // Store successful search
    localStorage.setItem('lastSearchedCity', currentData.name);
    cityInput.value = ''; // clear input

    updateUI(currentData, forecastData);
}

// ==========================================
// UI & LOGIC UPDATES
// ==========================================

function updateUI(current, forecast) {
    hideError();
    hideLoading();

    // 1. Update Current Weather
    cityDisplay.textContent = current.name;
    countryDisplay.innerHTML = `<i class="fa-solid fa-location-dot mr-1"></i>${current.sys.country}`;

    // Check if rain exists in the last hour
    const rainVol = current.rain && current.rain['1h'] ? current.rain['1h'] : 0;

    const temp = Math.round(current.main.temp);
    currentTemp.textContent = `${temp}°`;
    currentCondition.textContent = current.weather[0].description;
    currentHumidity.textContent = `${current.main.humidity}%`;
    currentWind.textContent = `${current.wind.speed} m/s`;

    // Set dynamic icon mapping
    const iconCode = current.weather[0].icon;
    currentIcon.src = `https://openweathermap.org/img/wn/${iconCode}@4x.png`;

    // Background remains static gradient as per new design

    // 3. Generate "What to Wear" Advice
    // probability of precipitation (pop) could be estimated from weather code or rain volume
    // For a more accurate "pop" we can look at the first item of forecastData
    const currentPop = forecast.list[0].pop * 100; // probability of precipitation in %
    generateClothingAdvice(temp, currentPop, current.weather[0].main);

    // 4. Update 5-Day Forecast
    renderForecast(forecast);

    // Show content with fade-in
    weatherContent.classList.remove('hidden');
    // slight delay for opacity transition
    setTimeout(() => {
        weatherContent.classList.remove('opacity-0');
    }, 50);
}

// "What to Wear" Recommendation Logic
function getClothingAdvice(temp, pop, weatherMain) {
    const adviceList = [];

    // Temperature Logic
    if (temp < 15) {
        adviceList.push({ text: "Wear warm clothes", icon: "🧥", emojiClass: "text-[#3b82f6]" });
    } else if (temp >= 15 && temp <= 25) {
        adviceList.push({ text: "Light clothing", icon: "👕", emojiClass: "text-emerald-500" });
    } else {
        adviceList.push({ text: "Stay cool, wear cotton", icon: "☀️", emojiClass: "text-[#f97316]" });
    }

    // Rain Logic
    if (pop > 20 || weatherMain.toLowerCase().includes('rain') || weatherMain.toLowerCase().includes('drizzle')) {
        adviceList.push({ text: "Carry an umbrella", icon: "☔", emojiClass: "text-[#3b82f6]" });
    }

    // Explicit Snow Logic
    if (weatherMain.toLowerCase().includes('snow')) {
        adviceList.push({ text: "Wear winter boots", icon: "❄️", emojiClass: "text-[#1e293b]" });
    }

    return adviceList;
}

function generateClothingAdvice(temp, pop, weatherMain) {
    const adviceList = getClothingAdvice(temp, pop, weatherMain);
    adviceContainer.innerHTML = '';

    adviceList.forEach(advice => {
        const item = document.createElement('div');
        item.className = 'advice-item shadow-sm';
        item.innerHTML = `
            <span class="text-3xl ${advice.emojiClass}">${advice.icon}</span>
            <span class="font-semibold text-lg text-[#1e293b]">${advice.text}</span>
        `;
        adviceContainer.appendChild(item);
    });
}

// Render 5-day Forecast 
function renderForecast(forecastData) {
    forecastContainer.innerHTML = '';

    // The API returns data every 3 hours (40 items for 5 days).
    // We want to extract 1 item per day (e.g., at 12:00:00).
    // We filter the array for times that include '12:00:00'.
    const dailyForecasts = forecastData.list.filter(item => item.dt_txt.includes('12:00:00'));

    // Sometimes the current day doesn't have 12:00:00 left, so if we don't get 5, 
    // we can fallback to just taking every 8th item (24 hours / 3 hours)
    let finalForecasts = dailyForecasts;
    if (dailyForecasts.length < 5) {
        finalForecasts = forecastData.list.filter((_, index) => index % 8 === 0).slice(0, 5);
    }

    finalForecasts.forEach((day, index) => {
        const dateObj = new Date(day.dt * 1000);
        // Short day name (Mon, Tue, etc.)
        const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'short' });
        const temp = Math.round(day.main.temp);
        const iconCode = day.weather[0].icon;

        const card = document.createElement('div');
        card.className = `bg-white rounded-[1.5rem] p-4 flex flex-col items-center justify-center text-center shadow-lg hover:shadow-xl transition-all forecast-card-anim`;
        // Cascading animation delay
        card.style.animationDelay = `${index * 0.1}s`;
        card.style.opacity = '0'; // start hidden for animation

        card.innerHTML = `
            <div class="font-bold text-sm mb-2 text-[#64748b] uppercase tracking-widest">${dayName}</div>
            <img src="https://openweathermap.org/img/wn/${iconCode}@2x.png" alt="Forecast Icon" class="w-16 h-16 drop-shadow-sm mb-2">
            <div class="text-2xl font-bold text-[#1e293b]">${temp}°</div>
            <div class="text-xs text-[#64748b] capitalize mt-1 hidden md:block">${day.weather[0].main}</div>
        `;

        forecastContainer.appendChild(card);
    });
}

// ==========================================
// HELPERS
// ==========================================

let loadingTimeout;

function showLoading() {
    errorMessage.classList.add('hidden');
    weatherContent.classList.add('opacity-0');
    // small timeout to allow fade out
    clearTimeout(loadingTimeout);
    loadingTimeout = setTimeout(() => {
        weatherContent.classList.add('hidden');
        loadingIndicator.classList.remove('hidden');
    }, 300);
}

function hideLoading() {
    clearTimeout(loadingTimeout);
    loadingIndicator.classList.add('hidden');
}

function showError(msg) {
    hideLoading();
    errorText.textContent = msg;
    errorMessage.classList.remove('hidden');
}

function hideError() {
    errorMessage.classList.add('hidden');
}
