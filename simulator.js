// ===========================
// SIMULATOR IoT - Phát dữ liệu giả lập
// ===========================

const io = require("socket.io-client");
const fs = require("fs");
const path = require("path");
const axios = require("axios");

// Kết nối Server
const socket = io("http://localhost:3000");

// Đường dẫn cấu hình
const configPath = path.join(__dirname, "config", "config.json");

// Tải cấu hình
function loadConfig() {
  try {
    if (fs.existsSync(configPath)) {
      return JSON.parse(fs.readFileSync(configPath, "utf8"));
    }
  } catch (e) {
    console.error("⚠️ Lỗi tải config:", e.message);
  }
  return {};
}

// Biến điều khiển giả lập
let simulationInterval = null;
const config = loadConfig();
let lastSentData = null;

// Sự kiện kết nối
socket.on("connect", () => {
  console.log("✅ Simulator đã kết nối đến server");
  console.log("📤 Bắt đầu phát dữ liệu cảm biến...");
  startSimulation();
});

socket.on("disconnect", () => {
  console.log("❌ Simulator ngắt kết nối");
  stopSimulation();
});

socket.on("error", (error) => {
  console.error("❌ Lỗi kết nối:", error);
});

// Lấy dữ liệu cảm biến thực (hoặc giả lập)
async function fetchRealSensorData() {
  // Nếu có cấu hình OpenWeatherMap, cố gắng lấy dữ liệu thực
  if (config.weatherProvider === "openweather" && config.weatherApiKey) {
    try {
      const response = await axios.get("https://api.openweathermap.org/data/2.5/weather", {
        params: {
          lat: config.weatherLat || 21.0285,
          lon: config.weatherLon || 105.8542,
          appid: config.weatherApiKey,
          units: "metric"
        },
        timeout: 5000
      });
      return {
        nhietDo: response.data.main.temp,
        doAm: response.data.main.humidity
      };
    } catch (err) {
      console.warn("⚠️ Không lấy được dữ liệu thời tiết thật, dùng dữ liệu giả lập:", err.message);
    }
  }

  // Fallback giả lập nếu không có API
  return {
    nhietDo: parseFloat((Math.random() * 10 + 20).toFixed(1)),
    doAm: Math.floor(Math.random() * 40 + 40)
  };
}

// Giới hạn thay đổi đột ngột (maxDelta)
function limitChange(current, lastValue, maxDelta = 2) {
  if (lastValue == null) return current;
  const diff = current - lastValue;
  if (Math.abs(diff) <= maxDelta) return current;
  // Trả về giá trị đã giới hạn
  return lastValue + Math.sign(diff) * maxDelta;
}

// Tạo gói dữ liệu cảm biến
async function generateSensorData() {
  const realData = await fetchRealSensorData();

  // Giới hạn thay đổi giữa các lần gửi
  const nhietDo = limitChange(realData.nhietDo, lastSentData?.nhietDo);
  const doAm = limitChange(realData.doAm, lastSentData?.doAm);

  const packet = {
    nhietDo: parseFloat(nhietDo.toFixed(1)),
    doAm: Math.round(doAm),
    thietBi: "CAMBIEN-01", // Thêm ID thiết bị
    pin: Math.floor(Math.random() * 10 + 80), // Giả lập mức pin 80-90%
    thoigian: new Date().toISOString()
  };

  lastSentData = packet;
  return packet;
}

// Phát dữ liệu cảm biến
async function emitSensorData() {
  const data = await generateSensorData();
  socket.emit("camBien", data);
  console.log(
    `📡 [${new Date().toLocaleTimeString('vi-VN')}] Gửi: ${data.nhietDo}°C, ${data.doAm}%`
  );
}

// Bắt đầu giả lập
function startSimulation() {
  // Gửi dữ liệu lần đầu
  emitSensorData();
  // Gửi dữ liệu mỗi 5 giây
  simulationInterval = setInterval(() => {
    emitSensorData();
  }, 5000);
}

// Dừng giả lập
function stopSimulation() {
  if (simulationInterval) {
    clearInterval(simulationInterval);
    simulationInterval = null;
  }
}

// Xử lý tắt ứng dụng
process.on("SIGINT", () => {
  console.log("\n⏹️ Dừng simulator");
  stopSimulation();
  socket.disconnect();
  process.exit(0);
});

// Thử kết nối
socket.connect();

console.log("🔄 Đang kết nối đến server http://localhost:3000...");
console.log("⏱️ Timeout sau 5 giây nếu server không phản hồi\n");

// Timeout nếu không kết nối được
setTimeout(() => {
  if (!socket.connected) {
    console.error("❌ Không thể kết nối đến server. Kiểm tra:");
    console.error("   1. Server đã chạy? (npm start)");
    console.error("   2. Port 3000 có mở không?");
    console.error("   3. Firewall có chặn không?");
    process.exit(1);
  }
}, 5000);