/* AETHER OS - WEATHER SYSTEM
  Developed for: Personal Portfolio / 
  Description: Integrated Voice-AI Weather Dashboard using OpenWeatherMap API
*/

// ==========================================
// 1. CONFIGURATION & STATE
// ==========================================

// ⚠️ IMPORTANT: Replace with your own API Key from OpenWeatherMap
// Get one here: https://home.openweathermap.org/api_keys
const API_KEY =  "YOUR_API_KEY";


const BASE_URL = "https://api.openweathermap.org/data/2.5";

const appState = { 
    unit: 'metric', // 'metric' for Celsius, 'imperial' for Fahrenheit
    voice: false,   // Voice starts OFF by default for better UX
    currentCity: "Hospet" // Default fallback city
};

// ==========================================
// 2. INITIALIZATION & EVENT LISTENERS
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
    // 1. Greet the user based on time of day
    greetUser();

    // 2. Attempt to locate user, otherwise load default city
    initAutoScan();

    // 3. Search Button Click
    document.getElementById('search-btn').onclick = () => {
        const city = document.getElementById('city-input').value.trim();
        if(city) startInstantScan(city);
    };

    // 4. Enter Key Support
    document.getElementById('city-input').onkeypress = (e) => {
        if(e.key === 'Enter') document.getElementById('search-btn').click();
    };

    // 5. GPS Location Button
    document.getElementById('loc-btn').onclick = () => {
        document.getElementById('city-input').value = ""; // Clear search box
        initAutoScan();
    };

    // 6. Voice Toggle (AI Persona)
    document.getElementById('voice-toggle').onclick = function() {
        appState.voice = !appState.voice;
        
        // Update Icon
        this.innerHTML = appState.voice ? 
            '<i class="fa-solid fa-microphone" style="color:#00f2fe"></i>' : 
            '<i class="fa-solid fa-microphone-slash"></i>';
        
        // Speak Confirmation
        if(appState.voice) {
            AetherTalk("Voice systems online. Audio feedback enabled.");
        } else {
            window.speechSynthesis.cancel();
            document.getElementById('ai-text').innerText = "Voice systems muted.";
        }
    };

    // 7. Unit Toggle (C/F)
    document.getElementById('unit-btn').onclick = function() {
        appState.unit = appState.unit === 'metric' ? 'imperial' : 'metric';
        this.innerText = appState.unit === 'metric' ? '°C' : '°F';
        
        // Refresh data with new unit
        // Use the last known city stored in the UI
        let currentDisplayed = document.getElementById('city-name').dataset.rawName || appState.currentCity;
        startInstantScan(currentDisplayed);
    };
});

// ==========================================
// 3. CORE LOGIC & API HANDLING
// ==========================================

function initAutoScan() {
    AetherTalk("Initializing global positioning satellites...");
    document.getElementById('city-name').innerText = "LOCATING...";
    
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (p) => startInstantScan(null, p.coords.latitude, p.coords.longitude),
            (e) => {
                // Permission denied or error
                AetherTalk("GPS Signal lost. Defaulting to base coordinates.");
                startInstantScan(appState.currentCity);
            },
            { enableHighAccuracy: true, timeout: 5000 }
        );
    } else { 
        startInstantScan(appState.currentCity); 
    }
}

async function startInstantScan(city, lat = null, lon = null) {
    // UI Loading State
    const statusHeader = document.getElementById('city-name');
    statusHeader.innerText = "SCANNING...";
    document.getElementById('weather-desc').innerText = "ANALYZING DATA...";
    
    try {
        // Construct URLs based on City Name OR Coordinates
        let weatherUrl, forecastUrl;
        
        if (city) {
            weatherUrl = `${BASE_URL}/weather?q=${city}&units=${appState.unit}&appid=${API_KEY}`;
            forecastUrl = `${BASE_URL}/forecast?q=${city}&units=${appState.unit}&appid=${API_KEY}`;
        } else {
            weatherUrl = `${BASE_URL}/weather?lat=${lat}&lon=${lon}&units=${appState.unit}&appid=${API_KEY}`;
            forecastUrl = `${BASE_URL}/forecast?lat=${lat}&lon=${lon}&units=${appState.unit}&appid=${API_KEY}`;
        }

        // Parallel Fetch for speed
        const [weatherRes, forecastRes] = await Promise.all([
            fetch(weatherUrl), 
            fetch(forecastUrl)
        ]);

        const wData = await weatherRes.json();
        const fData = await forecastRes.json();

        // Error Handling (e.g., City not found)
        if (wData.cod !== 200) throw new Error(wData.message);

        // Success - Update UI
        updateCurrentWeather(wData);
        updateForecast(fData);
        updateAQI(wData.coord.lat, wData.coord.lon);
        
        // Store raw name for Unit Toggle refresh
        statusHeader.dataset.rawName = wData.name;
        
        // Generate AI Report
        generateTodayReport(wData);

    } catch (error) {
        console.error(error);
        handleError();
    }
}

function handleError() {
    document.getElementById('city-name').innerText = "TARGET NOT FOUND";
    document.getElementById('temperature').innerText = "--";
    document.getElementById('weather-desc').innerText = "SYSTEM ERROR";
    document.getElementById('ai-text').innerText = "Error: Could not locate target. Please check inputs.";
    AetherTalk("Target coordinates invalid. System could not locate city.");
}

// ==========================================
// 4. UI UPDATE FUNCTIONS
// ==========================================

function updateCurrentWeather(w) {
    // Basic Info
    document.getElementById('city-name').innerText = `${w.name}, ${w.sys.country}`;
    document.getElementById('temperature').innerText = Math.round(w.main.temp);
    document.getElementById('weather-desc').innerText = w.weather[0].description.toUpperCase();
    
    // Quick Stats
    document.getElementById('feels-like').innerText = Math.round(w.main.feels_like) + "°";
    
    // Wind Speed Conversion (Metric: m/s to km/h | Imperial: mph)
    let windText = "";
    if(appState.unit === 'metric') {
        windText = Math.round(w.wind.speed * 3.6) + " KM/H";
    } else {
        windText = Math.round(w.wind.speed) + " MPH";
    }
    document.getElementById('wind-speed').innerText = windText;

    // 1. VISIBILITY LOGIC
    const visKM = (w.visibility / 1000).toFixed(1);
    document.getElementById('visibility').innerText = visKM + " KM";
    
    let visText = "CLEAR VIEW";
    if (visKM < 2) visText = "DENSE FOG";
    else if (visKM < 5) visText = "HAZE / MIST";
    else if (visKM < 8) visText = "MODERATE";
    
    document.getElementById('visibility-text').innerText = visText;

    // 2. HUMIDITY LOGIC
    const h = w.main.humidity;
    document.getElementById('humidity').innerText = h + "%";
    
    let humText = "COMFORTABLE";
    if (h > 85) humText = "EXTREME DAMP";
    else if (h > 65) humText = "HIGH HUMIDITY";
    else if (h < 30) humText = "DRY AIR";
    
    document.getElementById('humidity-text').innerText = humText;
}

function updateForecast(data) {
    const list = document.getElementById('forecast-display');
    list.innerHTML = ""; // Clear previous
    
    // Loop through the list. API gives 3-hour steps. 
    // We want roughly one entry per day (skip 8 items = 24 hours).
    // Starting at 7 ensures we don't pick the "current" hour but the future.
    for (let i = 7; i < data.list.length; i += 8) {
        if(list.children.length >= 3) break; // Limit to 3 days

        const d = data.list[i];
        const dayName = new Date(d.dt * 1000).toLocaleDateString('en-US', { weekday: 'short' });
        
        list.innerHTML += `
            <div class="forecast-item">
                <span>${dayName.toUpperCase()}</span>
                <b>${Math.round(d.main.temp)}°</b>
            </div>`;
    }
}

async function updateAQI(lat, lon) {
    try {
        const res = await fetch(`${BASE_URL}/air_pollution?lat=${lat}&lon=${lon}&appid=${API_KEY}`);
        const data = await res.json();
        
        if(data.list && data.list.length > 0) {
            const aqi = data.list[0].main.aqi; // 1 (Good) to 5 (Poor)
            
            const labels = ["EXCELLENT", "GOOD", "MODERATE", "POOR", "HAZARDOUS"];
            const colors = ["#00f2fe", "#00ff88", "#ffce00", "#ff4b2b", "#8b0000"]; // Colors for text
            const tips = ["PURE AIR", "SAFE AIR", "MASK ADVISED", "USE MASK", "AVOID EXIT"];
            
            const statusElem = document.getElementById('aqi-status');
            const descElem = document.getElementById('aqi-desc');

            statusElem.innerText = labels[aqi - 1];
            descElem.innerText = tips[aqi - 1];
            descElem.style.color = colors[aqi - 1];
        }
    } catch(e) {
        console.log("AQI Data unavailable");
        document.getElementById('aqi-status').innerText = "N/A";
    }
}

// ==========================================
// 5. AI PERSONALITY ENGINE
// ==========================================

function greetUser() {
    const hour = new Date().getHours();
    let greeting = "System Online.";
    if (hour < 12) greeting = "Good Morning. Systems Active.";
    else if (hour < 18) greeting = "Good Afternoon. Ready to scan.";
    else greeting = "Good Evening. Night mode standby.";
    
    document.getElementById('ai-text').innerText = greeting;
}

function generateTodayReport(w) {
    // Only speak if user triggered it manually or if voice is ON
    const t = Math.round(w.main.temp);
    const cond = w.weather[0].description;
    const name = w.name;
    
    let speech = `Reporting live from ${name}. `;
    speech += `Current conditions: ${cond}. `;
    speech += `Temperature is ${t} degrees. `;
    
    // Add a smart tip based on data
    if (t > 30) speech += "It is significantly hot. Stay hydrated.";
    else if (t < 10) speech += "Thermal levels are low. Wear a jacket.";
    else if (w.weather[0].main.toLowerCase().includes("rain")) speech += "Precipitation detected. Umbrella advised.";
    else speech += "Atmospheric conditions are stable.";

    AetherTalk(speech);
}

function AetherTalk(text) {
    // 1. Visual Update
    const textBox = document.getElementById('ai-text');
    const bot = document.getElementById('avatar');
    
    textBox.innerText = text;
    
    // 2. Animation Trigger
    bot.classList.add('talking');
    
    // 3. Audio Logic
    if (appState.voice) {
        // Stop any previous speech
        window.speechSynthesis.cancel();

        const msg = new SpeechSynthesisUtterance(text);
        
        // Select a robotic voice if available
        const voices = window.speechSynthesis.getVoices();
        // Try to find a "Google US English" or generic English voice
        const preferredVoice = voices.find(v => v.name.includes("Google US English")) || voices[0];
        if(preferredVoice) msg.voice = preferredVoice;

        msg.rate = 1.0; 
        msg.pitch = 0.9; // Slightly lower pitch for "AI" feel

        msg.onend = () => {
            bot.classList.remove('talking');
        };
        
        window.speechSynthesis.speak(msg);
    } else {
        // If voice is OFF, just animate for 3 seconds then stop
        setTimeout(() => bot.classList.remove('talking'), 3000);
    }
}

