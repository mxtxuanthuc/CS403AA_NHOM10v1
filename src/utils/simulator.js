// --- GIẢ LẬP THIẾT BỊ IoT GỬI DỮ LIỆU ---

const io = require("socket.io-client");
const fs = require("fs");
const path = require("path");
const axios = require("axios");

const socket = io("http://localhost:3000");

// Tải cấu hình
function loadConfig() {
  const configPath = path.join(__dirname, "..", "..", "config", "config.json");
  if (fs.existsSync(configPath)) {
    try {
      return JSON.parse(fs.readFileSync(configPath, "utf8"));
    } catch (e) {
      console.warn("⚠️ Lỗi tải cấu hình:", e.message);
      return {};
    }
  }
  return {};
}

let baseTemp = 25; // Nhiệt độ cơ sở mặc định
let baseHumidity = 70; // Độ ẩm cơ sở mặc định
let lastWeatherUpdate = 0;
const WEATHER_UPDATE_INTERVAL = 300000; // Lấy thời tiết thực mỗi 5 phút

// Lấy dữ liệu thời tiết thực để đặt nhiệt độ cơ sở
async function updateWeatherBase() {
  try {
    const config = loadConfig();
    if (!config.weatherApiKey || !config.weatherProvider) {
      console.warn("⚠️ API Thời tiết chưa được cấu hình, dùng giá trị mặc định");
      return;
    }

    if (config.weatherProvider === "openweather") {
      const lat = config.weatherLat || 21.0285;
      const lon = config.weatherLon || 105.8542;
      const response = await axios.get("https://api.openweathermap.org/data/2.5/weather", {
        params: {
          lat,
          lon,
          appid: config.weatherApiKey,
          units: "metric"
        },
        timeout: 5000
      });
      baseTemp = response.data.main.temp;
      baseHumidity = response.data.main.humidity;
      console.log(`📍 Cơ sở Thời tiết: ${baseTemp.toFixed(1)}°C, ${baseHumidity}% (tại ${config.weatherCity || 'vị trí đã cấu hình'})`);
    } else if (config.weatherProvider === "weatherapi") {
      const response = await axios.get("https://api.weatherapi.com/v1/current.json", {
        params: {
          key: config.weatherApiKey,
          q: config.weatherCity || "Hanoi"
        },
        timeout: 5000
      });
      baseTemp = response.data.current.temp_c;
      baseHumidity = response.data.current.humidity;
      console.log(`📍 Cơ sở Thời tiết: ${baseTemp.toFixed(1)}°C, ${baseHumidity}% (tại ${config.weatherCity || 'Hanoi'})`);
    }
  } catch (err) {
    console.warn("⚠️ Lỗi lấy thời tiết thực, dùng mặc định:", err.message);
  }
  lastWeatherUpdate = Date.now();
}

// Tạo dữ liệu cảm biến giả lập với dao động nhỏ
function generateSensorData() {
  // Dao động nhỏ (±0.5°C cho nhiệt độ, ±3% cho độ ẩm, ±2% cho pin)
  const tempVar = (Math.random() - 0.5) * 1; 
  const humidityVar = Math.floor((Math.random() - 0.5) * 6); 
  const batteryVar = Math.floor((Math.random() - 0.5) * 4); 

  return {
    // Giới hạn 15-40°C
    nhietDo: Math.max(15, Math.min(40, parseFloat((baseTemp + tempVar).toFixed(1)))), 
    // Giới hạn 20-95%
    doAm: Math.max(20, Math.min(95, baseHumidity + humidityVar)), 
    // Pin ~80%, dao động ±2%
    pin: Math.max(10, Math.min(100, 80 + batteryVar)), 
    thietBi: "CAMBIEN-01",
    thoigian: Date.now()
  };
}

// Cập nhật cơ sở thời tiết khi khởi động
updateWeatherBase();

// Gửi dữ liệu cảm biến sau mỗi 2 giây
setInterval(() => {
  const goiTin = generateSensorData();
  console.log("📤 Gửi dữ liệu:", goiTin);
  socket.emit("camBien", goiTin);

  // Làm mới dữ liệu thời tiết cơ sở sau mỗi 5 phút
  if (Date.now() - lastWeatherUpdate > WEATHER_UPDATE_INTERVAL) {
    updateWeatherBase();
  }
}, 2000);