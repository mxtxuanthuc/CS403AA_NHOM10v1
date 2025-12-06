// ===========================
// SERVER CHÍNH — NHÓM 10 (Tối ưu hóa v2)
// ===========================
// Kiến trúc sạch, module hóa, quản lý dữ liệu và logic chính.

const express = require("express");
const app = express();
const http = require("http").createServer(app);
const io = require("socket.io")(http);
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const nodemailer = require("nodemailer");
const session = require("express-session");
const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const FacebookStrategy = require("passport-facebook").Strategy;
require("dotenv").config();

const db = require("./src/db/db");
const ai = require("./src/services/ai");

const SESSION_SECRET = process.env.SESSION_SECRET || "iot-ai-monitor-session-secret";
const hasGoogleAuth = process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET;
const hasFacebookAuth = process.env.FACEBOOK_CLIENT_ID && process.env.FACEBOOK_CLIENT_SECRET;

const mailTransporter = createMailTransporter();
const MAIL_FROM = process.env.MAIL_FROM || process.env.MAIL_USER || "no-reply@iot-ai.local";

// ===== HỆ THỐNG QUẢN LÝ CẢNH BÁO =====
const alertCache = new Map(); // Lưu cảnh báo gần nhất để khử trùng lặp
const MAX_ALERT_CACHE = 100; // Cảnh báo tối đa trong bộ nhớ
const ALERT_COOLDOWN = 30 * 1000; // 30 giây - thời gian cooldown cảnh báo
const AI_CALL_COOLDOWN = 15 * 60 * 1000; // 15 phút - giới hạn AI
const aiCallTimestamps = new Map(); // Theo dõi thời gian gọi AI
const alertBuffer = []; // Bộ đệm cho cảnh báo liên tục
const MAX_BUFFER_SIZE = 500; // Giữ 500 cảnh báo cuối trong bộ nhớ

app.use(express.json());

// Cấu hình session
app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 24 * 60 * 60 * 1000, // 24 giờ
    httpOnly: true,
    secure: false // Đặt true nếu dùng HTTPS
  }
}));

// Middleware kiểm tra đăng nhập
function requireAuth(req, res, next) {
  if (req.session && req.session.userId) {
    return next();
  }
  // Nếu là API request, trả về 401
  if (req.path.startsWith('/api/')) {
    return res.status(401).json({ success: false, message: 'Vui lòng đăng nhập' });
  }
  // Nếu là trang web, redirect về login
  return res.redirect('/pages/login.html');
}

// Các trang public không cần đăng nhập
const publicPaths = [
  '/pages/login.html',
  '/pages/register.html',
  '/pages/forgot-password.html',
  '/css',
  '/js',
  '/images',
  '/fonts'
];

// Static files với kiểm tra đăng nhập
app.use((req, res, next) => {
  // Cho phép truy cập các trang public
  const isPublic = publicPaths.some(path => req.path.startsWith(path));
  if (isPublic) {
    return express.static('public')(req, res, next);
  }
  
  // Kiểm tra đăng nhập cho các trang khác
  if (req.path.endsWith('.html') && !req.session?.userId) {
    return res.redirect('/pages/login.html');
  }
  
  express.static('public')(req, res, next);
});

// Thiết lập header ngôn ngữ
app.use((req, res, next) => {
  res.setHeader('Content-Language', 'vi');
  res.setHeader('Accept-Language', 'vi-VN, vi;q=0.9, en;q=0.8');
  next();
});

// POST /api/password/forgot - Xử lý quên mật khẩu
app.post("/api/password/forgot", async (req, res) => {
  const { email } = req.body;
  const normalizedEmail = (email || "").trim().toLowerCase();
  const genericMessage = "Nếu email tồn tại, mật khẩu mới đã được gửi. Vui lòng kiểm tra hộp thư.";

  if (!normalizedEmail) {
    return res.status(400).json({ success: false, message: "Vui lòng nhập email đã đăng ký" });
  }

  try {
    const user = await db.timUserTheoEmail(normalizedEmail);
    if (!user) {
      return res.json({ success: true, message: genericMessage });
    }

    const newPasswordPlain = generateRandomPassword(12);
    const hashed = hashPassword(newPasswordPlain);
    await db.capNhatMatKhauTheoEmail(normalizedEmail, hashed);

    try {
      await sendPasswordResetEmail(normalizedEmail, user.fullName || user.username, newPasswordPlain);
    } catch (mailErr) {
      console.error("❌ Lỗi gửi email khôi phục:", mailErr.message);
      return res.status(500).json({ success: false, message: "Không thể gửi email khôi phục. Vui lòng thử lại sau." });
    }

    return res.json({ success: true, message: genericMessage });
  } catch (err) {
    console.error("❌ Lỗi quên mật khẩu:", err.message);
    return res.status(500).json({ success: false, message: "Lỗi máy chủ khi xử lý quên mật khẩu" });
  }
});

// POST /api/profile/update - Cập nhật hồ sơ
app.post("/api/profile/update", async (req, res) => {
  try {
    const { userId, fullName } = req.body;

    if (!userId) {
      return res.status(400).json({ success: false, message: "Thiếu userId" });
    }

    const user = await db.timUserTheoId(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: "Không tìm thấy người dùng" });
    }

    const safeName = (fullName || "").trim();
    if (!safeName) {
      return res.status(400).json({ success: false, message: "Họ tên không hợp lệ" });
    }

    await db.capNhatHoSoNguoiDung(userId, safeName);
    res.json({ success: true, message: "Đã cập nhật hồ sơ", fullName: safeName });
  } catch (error) {
    console.error("❌ Lỗi cập nhật hồ sơ:", error.message);
    res.status(500).json({ success: false, message: "Lỗi máy chủ khi cập nhật hồ sơ" });
  }
});

// POST /api/profile/change-password - Đổi mật khẩu
app.post("/api/profile/change-password", async (req, res) => {
  try {
    const { userId, currentPassword, newPassword } = req.body;

    if (!userId || !currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: "Vui lòng nhập đủ thông tin" });
    }

    if ((newPassword || "").length < 6) {
      return res.status(400).json({ success: false, message: "Mật khẩu mới phải ít nhất 6 ký tự" });
    }

    const user = await db.timUserTheoId(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: "Không tìm thấy người dùng" });
    }

    if (hashPassword(currentPassword) !== user.password) {
      return res.status(400).json({ success: false, message: "Mật khẩu hiện tại không đúng" });
    }

    const hashed = hashPassword(newPassword);
    await db.capNhatMatKhauTheoId(userId, hashed);
    res.json({ success: true, message: "Đổi mật khẩu thành công" });
  } catch (error) {
    console.error("❌ Lỗi đổi mật khẩu:", error.message);
    res.status(500).json({ success: false, message: "Lỗi máy chủ khi đổi mật khẩu" });
  }
});

// Trang gốc - Redirect về login
app.get("/", (req, res) => {
  if (req.session && req.session.userId) {
    return res.sendFile(path.join(__dirname, "public", "pages", "home.html"));
  }
  res.redirect('/pages/login.html');
});

// Đường dẫn file cấu hình
const configPath = path.join(__dirname, "config", "config.json");
const thresholdsPath = path.join(__dirname, "config", "thresholds.json");

// Ngưỡng cảnh báo mặc định
let THRESHOLDS = {
  tempMax: 27,
  tempMin: 19,
  humidityMax: 82,
  humidityMin: 40
};

// Giới hạn ổn định dữ liệu cảm biến
const SENSOR_STABILITY_LIMITS = {
  tempDelta: 3, // °C trên mỗi lần đọc
  humidityDelta: 12, // % trên mỗi lần đọc
  tempRange: { min: -10, max: 60 },
  humidityRange: { min: 0, max: 100 }
};

const lastSensorSnapshots = new Map();

// Chuẩn hóa, giới hạn và ổn định dữ liệu
function normalizeNumber(value) {
  const num = typeof value === 'number' ? value : parseFloat(value);
  return Number.isFinite(num) ? num : null;
}

function clampRange(value, range) {
  if (value === null) return value;
  return Math.min(range.max, Math.max(range.min, value));
}

function clampDelta(current, previous, maxDelta) {
  if (current === null || previous === null || maxDelta <= 0) {
    return current;
  }

  const delta = current - previous;
  if (Math.abs(delta) <= maxDelta) {
    return current;
  }

  return Number((previous + Math.sign(delta) * maxDelta).toFixed(1));
}

// Ổn định dữ liệu cảm biến (ngăn chặn nhảy vọt)
function stabilizeSensorData(reading) {
  const sanitized = { ...reading };
  const deviceId = sanitized.thietBi || 'UNKNOWN_DEVICE';
  const anomalies = [];
  const lastSnapshot = lastSensorSnapshots.get(deviceId);

  // Giới hạn phạm vi
  sanitized.nhietDo = clampRange(normalizeNumber(sanitized.nhietDo), SENSOR_STABILITY_LIMITS.tempRange);
  sanitized.doAm = clampRange(normalizeNumber(sanitized.doAm), SENSOR_STABILITY_LIMITS.humidityRange);

  if (lastSnapshot) {
    // Giới hạn thay đổi đột ngột
    const stabilizedTemp = clampDelta(sanitized.nhietDo, lastSnapshot.nhietDo, SENSOR_STABILITY_LIMITS.tempDelta);
    if (sanitized.nhietDo !== null && stabilizedTemp !== sanitized.nhietDo) {
      anomalies.push(`Nhiệt độ nhảy vọt ${sanitized.nhietDo}°C → ${stabilizedTemp}°C`);
      sanitized.nhietDo = stabilizedTemp;
    }

    const stabilizedHumidity = clampDelta(sanitized.doAm, lastSnapshot.doAm, SENSOR_STABILITY_LIMITS.humidityDelta);
    if (sanitized.doAm !== null && stabilizedHumidity !== sanitized.doAm) {
      anomalies.push(`Độ ẩm nhảy vọt ${sanitized.doAm}% → ${stabilizedHumidity}%`);
      sanitized.doAm = stabilizedHumidity;
    }
  }

  lastSensorSnapshots.set(deviceId, {
    nhietDo: sanitized.nhietDo,
    doAm: sanitized.doAm,
    timestamp: Date.now()
  });

  return { sanitizedData: sanitized, anomalies, deviceId };
}

// ===== LƯU TRỮ NGƯỠNG CẢNH BÁO (THRESHOLDS PERSISTENCE) =====
function loadThresholds() {
  try {
    if (fs.existsSync(thresholdsPath)) {
      const data = fs.readFileSync(thresholdsPath, 'utf-8');
      const loaded = JSON.parse(data);
      THRESHOLDS = { ...THRESHOLDS, ...loaded };
      console.log('✅ Ngưỡng đã tải từ file');
    } else {
      console.log('📝 Không tìm thấy file ngưỡng, dùng mặc định');
    }
  } catch (e) {
    console.error('❌ Lỗi tải ngưỡng:', e.message);
  }
}

function saveThresholds() {
  try {
    fs.writeFileSync(thresholdsPath, JSON.stringify(THRESHOLDS, null, 2), 'utf-8');
    console.log('✅ Ngưỡng đã lưu vào file');
  } catch (e) {
    console.error('❌ Lỗi lưu ngưỡng:', e.message);
  }
}

// ===== KHỬ TRÙNG LẶP & CACHING CẢNH BÁO =====
function shouldFireAlert(alertType) {
  // Key: alertType (e.g., "temp_high")
  const key = alertType;
  const now = Date.now();

  if (alertCache.has(key)) {
    const lastTime = alertCache.get(key);
    if (now - lastTime < ALERT_COOLDOWN) {
      return false; // Bỏ qua cảnh báo trùng lặp trong thời gian cooldown
    }
  }

  alertCache.set(key, now);

  // Dọn dẹp cache cũ
  if (alertCache.size > MAX_ALERT_CACHE) {
    const oldestKey = Array.from(alertCache.entries())
      .sort((a, b) => a[1] - b[1])[0][0];
    alertCache.delete(oldestKey);
  }

  return true;
}

function shouldCallAI(context) {
  // Giới hạn gọi AI theo context
  const now = Date.now();
  const lastCall = aiCallTimestamps.get(context) || 0;

  if (now - lastCall < AI_CALL_COOLDOWN) {
    return false;
  }

  aiCallTimestamps.set(context, now);
  return true;
}

// Chuẩn bị dữ liệu biểu đồ 24 giờ
function prepareChart24hData(historyData) {
  if (!historyData || historyData.length === 0) return [];

  // Nhóm dữ liệu theo giờ (24 giờ cuối)
  const hourlyData = {};

  historyData.forEach(d => {
    const date = new Date(d.thoigian);
    const hourKey = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')} ${date.getHours().toString().padStart(2, '0')}:00`;

    if (!hourlyData[hourKey]) {
      hourlyData[hourKey] = {
        times: [],
        temps: [],
        humidities: [],
        time: date
      };
    }

    hourlyData[hourKey].times.push(d.thoigian);
    hourlyData[hourKey].temps.push(parseFloat(d.nhietDo) || 0);
    hourlyData[hourKey].humidities.push(parseFloat(d.doAm) || 0);
  });

  // Chuyển sang mảng và tính trung bình theo giờ, lấy 24 điểm gần nhất
  const chart24h = Object.keys(hourlyData)
    .sort()
    .slice(-24) // Lấy 24 giờ cuối
    .map(hourKey => {
      const hourInfo = hourlyData[hourKey];
      const avgTemp = (hourInfo.temps.reduce((a, b) => a + b, 0) / hourInfo.temps.length).toFixed(1);
      const avgHumidity = (hourInfo.humidities.reduce((a, b) => a + b, 0) / hourInfo.humidities.length).toFixed(1);

      return {
        time: hourKey.split(' ')[1], // định dạng HH:00
        nhietDo: parseFloat(avgTemp),
        doAm: parseFloat(avgHumidity)
      };
    });

  return chart24h;
}

// Hàm tải cấu hình API
function loadConfig() {
  if (fs.existsSync(configPath)) {
    try {
      const cfg = JSON.parse(fs.readFileSync(configPath, "utf8"));
      // cung cấp giá trị mặc định cho các khóa mới
      return Object.assign({
        apiKey: "",
        apiType: "local",
        aiModel: "gpt-3.5-turbo",
        aiTone: "friendly",
        weatherProvider: "",
        weatherApiKey: "",
        weatherCity: "",
        weatherLat: null,
        weatherLon: null,
        weatherPollInterval: 60000,
        ttsProvider: "",
        ttsApiKey: "",
        ttsLang: "vi-VN"
      }, cfg);
    } catch (e) {
      console.error("❌ Lỗi đọc config.json:", e.message);
      return { apiKey: "", apiType: "local", aiModel: "gpt-3.5-turbo", weatherPollInterval: 60000, ttsLang: "vi-VN" };
    }
  }
  return { apiKey: "", apiType: "local", aiModel: "gpt-3.5-turbo", weatherPollInterval: 60000, ttsLang: "vi-VN" };
}

// Hàm lưu cấu hình API
function saveConfig(config) {
  const existing = loadConfig();
  const merged = Object.assign({}, existing, config);
  fs.writeFileSync(configPath, JSON.stringify(merged, null, 2));
}

// Hash mật khẩu đơn giản bằng SHA-256
function hashPassword(password) {
  return crypto.createHash("sha256").update(password).digest("hex");
}

function generateRandomPassword(length = 12) {
  let password = "";
  while (password.length < length) {
    password += crypto.randomBytes(length).toString("base64").replace(/[^a-zA-Z0-9]/g, "");
  }
  return password.slice(0, length);
}

function createMailTransporter() {
  const { MAIL_HOST, MAIL_PORT, MAIL_USER, MAIL_PASS, MAIL_SECURE } = process.env;
  if (!MAIL_HOST || !MAIL_USER || !MAIL_PASS) {
    console.warn("⚠️ Mail transport chưa được cấu hình (thiếu MAIL_HOST/MAIL_USER/MAIL_PASS). Email quên mật khẩu sẽ bị bỏ qua.");
    return null;
  }
  return nodemailer.createTransport({
    host: MAIL_HOST,
    port: Number(MAIL_PORT || 587),
    secure: MAIL_SECURE === "true",
    auth: {
      user: MAIL_USER,
      pass: MAIL_PASS
    }
  });
}

async function sendPasswordResetEmail(to, fullName, newPassword) {
  if (!mailTransporter) {
    throw new Error("Mail transporter chưa được cấu hình");
  }

  const safeName = fullName || "bạn";
  const html = `
    <div style="font-family:Arial,sans-serif;font-size:15px;color:#0f172a;">
      <p>Chào ${safeName},</p>
      <p>Bạn (hoặc ai đó) vừa yêu cầu đặt lại mật khẩu cho tài khoản IoT-AI Monitor.</p>
      <p><strong>Mật khẩu mới của bạn:</strong></p>
      <p style="font-size:18px;font-weight:700;letter-spacing:1px;background:#f8fafc;padding:12px;border-radius:8px;border:1px solid #e2e8f0;display:inline-block;">${newPassword}</p>
      <p>Vui lòng đăng nhập và đổi lại mật khẩu trong phần hồ sơ để đảm bảo an toàn.</p>
      <p>Nếu bạn không yêu cầu thao tác này, hãy liên hệ quản trị viên ngay.</p>
      <p>— Nhóm IoT-AI Monitor</p>
    </div>
  `;

  await mailTransporter.sendMail({
    from: MAIL_FROM,
    to,
    subject: "Mật khẩu mới IoT-AI Monitor",
    html
  });
}

// GET /api/config - Lấy cấu hình
app.get("/api/config", (req, res) => {
  const config = loadConfig();
  res.json({
    apiKey: config.apiKey || "",
    apiType: config.apiType || "local",
    aiModel: config.aiModel || "gpt-3.5-turbo",
    aiTone: config.aiTone || "friendly",
    weatherProvider: config.weatherProvider || "",
    weatherApiKey: config.weatherApiKey || "",
    weatherCity: config.weatherCity || "",
    weatherLat: config.weatherLat || null,
    weatherLon: config.weatherLon || null,
    weatherPollInterval: config.weatherPollInterval || 60000,
    ttsProvider: config.ttsProvider || "",
    ttsApiKey: config.ttsApiKey || "",
    ttsLang: config.ttsLang || "vi-VN"
  });
});

// POST /api/config - Lưu cấu hình API
app.post("/api/config", requireAuth, (req, res) => {
  const {
    apiKey,
    apiType,
    aiModel,
    aiTone,
    weatherProvider,
    weatherApiKey,
    weatherCity,
    weatherLat,
    weatherLon,
    weatherPollInterval,
    ttsProvider,
    ttsApiKey,
    ttsLang
  } = req.body;

  if (!apiType) {
    return res.status(400).json({ success: false, message: "apiType là bắt buộc" });
  }

  const toSave = { apiType };
  if (apiKey) toSave.apiKey = apiKey;
  if (aiModel) toSave.aiModel = aiModel;
  if (aiTone) toSave.aiTone = aiTone;
  if (weatherProvider) toSave.weatherProvider = weatherProvider;
  if (weatherApiKey) toSave.weatherApiKey = weatherApiKey;
  if (weatherCity) toSave.weatherCity = weatherCity;
  if (weatherLat !== undefined) toSave.weatherLat = weatherLat;
  if (weatherLon !== undefined) toSave.weatherLon = weatherLon;
  if (weatherPollInterval) toSave.weatherPollInterval = weatherPollInterval;
  if (ttsProvider) toSave.ttsProvider = ttsProvider;
  if (ttsApiKey) toSave.ttsApiKey = ttsApiKey;
  if (ttsLang) toSave.ttsLang = ttsLang;

  saveConfig(toSave);
  const newCfg = loadConfig();
  res.json({ success: true, message: "Cấu hình đã được lưu", config: newCfg });
  console.log("✅ Cấu hình đã cập nhật:", toSave);
});

// ==== AUTH API (ĐĂNG KÝ / ĐĂNG NHẬP ĐƠN GIẢN) ====
app.post("/api/register", async (req, res) => {
  try {
    const { fullName, email, username, password } = req.body;

    if (!fullName || !email || !username || !password) {
      return res.status(400).json({ success: false, message: "Vui lòng điền đầy đủ thông tin" });
    }

    const existing = await db.kiemTraTrungEmailUsername(email, username);
    if (existing) {
      if (existing.email === email) {
        return res.status(400).json({ success: false, message: "Email đã được sử dụng" });
      }
      if (existing.username === username) {
        return res.status(400).json({ success: false, message: "Tên đăng nhập đã được sử dụng" });
      }
      return res.status(400).json({ success: false, message: "Tài khoản đã tồn tại" });
    }

    const hashed = hashPassword(password);
    await db.taoUser({ fullName, email, username, password: hashed });

    res.json({ success: true, message: "Đăng ký thành công" });
  } catch (e) {
    console.error("❌ Lỗi đăng ký:", e.message);
    res.status(500).json({ success: false, message: "Lỗi máy chủ khi đăng ký" });
  }
});

app.post("/api/login", async (req, res) => {
  try {
    const { identifier, password } = req.body;

    if (!identifier || !password) {
      return res.status(400).json({ success: false, message: "Vui lòng nhập tài khoản và mật khẩu" });
    }

    const user = await db.timUserTheoEmailHoacUsername(identifier);
    if (!user) {
      return res.status(401).json({ success: false, message: "Tài khoản hoặc mật khẩu không đúng" });
    }

    const hashed = hashPassword(password);
    if (user.password !== hashed) {
      return res.status(401).json({ success: false, message: "Tài khoản hoặc mật khẩu không đúng" });
    }

    // Lưu session
    req.session.userId = user.id;
    req.session.username = user.username;
    req.session.fullName = user.fullName;

    res.json({
      success: true,
      message: "Đăng nhập thành công",
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        username: user.username
      }
    });
  } catch (e) {
    console.error("❌ Lỗi đăng nhập:", e.message);
    res.status(500).json({ success: false, message: "Lỗi máy chủ khi đăng nhập" });
  }
});

// POST /api/logout - Đăng xuất
app.post("/api/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ success: false, message: "Lỗi khi đăng xuất" });
    }
    res.json({ success: true, message: "Đăng xuất thành công" });
  });
});

// GET /api/auth/check - Kiểm tra trạng thái đăng nhập
app.get("/api/auth/check", (req, res) => {
  if (req.session && req.session.userId) {
    return res.json({
      authenticated: true,
      user: {
        id: req.session.userId,
        username: req.session.username,
        fullName: req.session.fullName
      }
    });
  }
  res.json({ authenticated: false });
});

// POST /api/config/location - Lưu vị trí từ Location Manager
app.post("/api/config/location", requireAuth, (req, res) => {
  const { weatherLat, weatherLon } = req.body;
  if (weatherLat !== undefined && weatherLon !== undefined) {
    saveConfig({ weatherLat, weatherLon });
    res.json({ success: true, message: "Vị trí đã được lưu" });
  } else {
    res.status(400).json({ success: false, message: "Tọa độ không hợp lệ" });
  }
});

// POST /api/ai/locate - Lấy vị trí từ AI
app.post("/api/ai/locate", requireAuth, async (req, res) => {
  const { locationName } = req.body;
  if (!locationName) {
    return res.status(400).json({ success: false, message: "Tên địa điểm là bắt buộc" });
  }

  try {
    const config = loadConfig();
    const prompt = `Lấy tọa độ kinh độ và vĩ độ của "${locationName}". Trả về dưới dạng JSON: {"lat": kinh_do, "lon": vi_do}`;
    const aiResponse = await ai.traLoiAI(prompt, config);

    // Trích xuất JSON từ phản hồi AI
    const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const coords = JSON.parse(jsonMatch[0]);
      if (coords.lat && coords.lon) {
        saveConfig({ weatherLat: coords.lat, weatherLon: coords.lon });
        return res.json({ success: true, message: `Đã cập nhật vị trí thành ${locationName}`, lat: coords.lat, lon: coords.lon });
      }
    }

    res.status(500).json({ success: false, message: "Không thể lấy tọa độ từ AI" });
  } catch (error) {
    console.error('❌ Lỗi AI location:', error.message);
    res.status(500).json({ success: false, message: "Lỗi khi xử lý yêu cầu" });
  }
});

// POST /api/thresholds - Cập nhật thresholds
app.post("/api/thresholds", requireAuth, (req, res) => {
  const { tempMax, tempMin, humidityMax, humidityMin } = req.body;

  if (tempMax !== undefined) THRESHOLDS.tempMax = tempMax;
  if (tempMin !== undefined) THRESHOLDS.tempMin = tempMin;
  if (humidityMax !== undefined) THRESHOLDS.humidityMax = humidityMax;
  if (humidityMin !== undefined) THRESHOLDS.humidityMin = humidityMin;

  // Lưu thresholds vào file
  saveThresholds();

  console.log('✅ Ngưỡng đã cập nhật:', THRESHOLDS);
  res.json({ success: true, thresholds: THRESHOLDS });
});

// GET /api/thresholds - Lấy thresholds
app.get("/api/thresholds", requireAuth, (req, res) => {
  res.json(THRESHOLDS);
});

// POST /api/chat - API CHAT AI
app.post("/api/chat", requireAuth, async (req, res) => {
  const cauHoi = req.body.message;
  const tone = req.body.tone || "friendly";
  const topic = req.body.topic || "";
  const config = loadConfig();
  config.aiTone = tone;
  config.topic = topic;
  const traLoi = await ai.traLoiAI(cauHoi, config);
  res.json({ reply: traLoi });
});

// POST /api/ai-analyze - Phân tích AI (có giới hạn tần suất)
app.post("/api/ai-analyze", async (req, res) => {
  const { prompt, dataContext, riskLevel, alertCount } = req.body;

  if (!prompt) {
    return res.json({ success: false, recommendations: [], error: 'Không có prompt' });
  }

  try {
    const config = loadConfig();

    // Giới hạn tần suất: Chỉ gọi AI 1 lần/15 phút/context
    const contextKey = `analyze_${riskLevel || 'general'}`;
    if (!shouldCallAI(contextKey)) {
      return res.json({
        success: true,
        recommendations: [],
        cached: true,
        message: '⏳ Lệnh AI đang trong thời gian cooldown. Thử lại sau 15 phút.'
      });
    }

    // Gọi AI (có giới hạn tần suất)
    const traLoi = await ai.traLoiAI(prompt, config);

    // Phân tích phản hồi AI cho khuyến nghị
    const recommendations = [];
    if (traLoi && !traLoi.includes('❌') && !traLoi.includes('⚠️')) {
      // Trích xuất các mục hành động từ phản hồi
      const lines = traLoi.split('\n').filter(l => l.trim());
      lines.forEach(line => {
        if (line.trim().length > 0) {
          recommendations.push({
            message: line.trim(),
            icon: '💡',
            action: line.trim(),
            severity: 'info'
          });
        }
      });
    }

    res.json({
      success: true,
      recommendations: recommendations.length > 0 ? recommendations : [],
      rawResponse: traLoi,
      cached: false
    });
  } catch (error) {
    console.error('❌ Lỗi AI Analysis:', error.message);
    res.json({ success: false, recommendations: [], error: error.message });
  }
});

// GET /api/data/latest - Lấy dữ liệu mới nhất
app.get("/api/data/latest", requireAuth, async (req, res) => {
  const data = await db.layDuLieuMoiNhat();
  res.json(data);
});

// GET /api/data/history - Lấy lịch sử 24h
app.get("/api/data/history", requireAuth, async (req, res) => {
  const data = await db.layLichSu24h();
  res.json(data);
});

// GET /api/alerts/history - Lấy lịch sử cảnh báo (từ bộ đệm)
app.get("/api/alerts/history", requireAuth, async (req, res) => {
  // Trả về 50 cảnh báo cuối từ bộ đệm bộ nhớ
  const recentAlerts = alertBuffer.slice(-50).map(a => ({
    timestamp: a.timestamp,
    type: a.type,
    icon: a.icon,
    message: a.message,
    severity: a.severity
  }));
  res.json(recentAlerts);
});

// POST /api/alerts/clear - Xóa bộ đệm cảnh báo
app.post("/api/alerts/clear", requireAuth, (req, res) => {
  alertCache.clear();
  console.log('✅ Cache cảnh báo đã xóa');
  res.json({ success: true, message: 'Cache cảnh báo đã xóa' });
});

// ===== HỆ THỐNG THỐNG KÊ (STATISTICS SYSTEM) =====
// Tính toán thống kê từ dữ liệu
function calculateStats(historyData) {
  const stats = {
    tongGhiNhan: historyData.length || 0,
    tongCanhBao: 0,
    canhBaoNhietDo: 0,
    canhBaoDoAm: 0,
    nhieuDoBinhQuan: 0,
    doAmBinhQuan: 0,
    nhieuDoMax: -Infinity,
    nhieuDoMin: Infinity,
    doAmMax: -Infinity,
    doAmMin: Infinity
  };

  if (historyData && historyData.length > 0) {
    let totalTemp = 0, totalHumidity = 0;

    historyData.forEach(record => {
      const temp = parseFloat(record.nhietDo) || 0;
      const humidity = parseFloat(record.doAm) || 0;

      totalTemp += temp;
      totalHumidity += humidity;

      stats.nhieuDoMax = Math.max(stats.nhieuDoMax, temp);
      stats.nhieuDoMin = Math.min(stats.nhieuDoMin, temp);
      stats.doAmMax = Math.max(stats.doAmMax, humidity);
      stats.doAmMin = Math.min(stats.doAmMin, humidity);

      if (temp > THRESHOLDS.tempMax || temp < THRESHOLDS.tempMin) stats.canhBaoNhietDo++;
      if (humidity > THRESHOLDS.humidityMax || humidity < THRESHOLDS.humidityMin) stats.canhBaoDoAm++;
    });

    stats.tongCanhBao = stats.canhBaoNhietDo + stats.canhBaoDoAm;
    stats.nhieuDoBinhQuan = parseFloat((totalTemp / historyData.length).toFixed(1));
    stats.doAmBinhQuan = parseFloat((totalHumidity / historyData.length).toFixed(1));

    stats.nhieuDoMax = stats.nhieuDoMax === -Infinity ? 0 : parseFloat(stats.nhieuDoMax.toFixed(1));
    stats.nhieuDoMin = stats.nhieuDoMin === Infinity ? 0 : parseFloat(stats.nhieuDoMin.toFixed(1));
    stats.doAmMax = stats.doAmMax === -Infinity ? 0 : parseFloat(stats.doAmMax.toFixed(1));
    stats.doAmMin = stats.doAmMin === Infinity ? 0 : parseFloat(stats.doAmMin.toFixed(1));
  }

  return stats;
}

// GET /api/statistics - THỐNG KÊ (tính toán từ dữ liệu 24h)
app.get("/api/statistics", requireAuth, async (req, res) => {
  try {
    const historyData = await db.layLichSu24h();
    const calculatedStats = calculateStats(historyData);

    // Lưu vào database
    await db.ghiThongKe(calculatedStats);

    // Chuẩn bị dữ liệu biểu đồ
    const chartData = historyData.slice(0, 24).reverse().map((d, idx) => ({
      time: new Date(d.thoigian).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
      nhietDo: parseFloat(d.nhietDo),
      doAm: parseFloat(d.doAm)
    }));

    res.json({
      timestamp: Date.now(),
      today: calculatedStats,
      overall: {
        totalRecords: historyData.length,
        avgTemp: calculatedStats.nhieuDoBinhQuan,
        avgHumidity: calculatedStats.doAmBinhQuan,
        maxTemp: calculatedStats.nhieuDoMax,
        minTemp: calculatedStats.nhieuDoMin,
        maxHumidity: calculatedStats.doAmMax,
        minHumidity: calculatedStats.doAmMin,
        alertCount: calculatedStats.tongCanhBao
      },
      data: chartData
    });
  } catch (error) {
    console.error('❌ Lỗi API Thống kê:', error.message);
    res.json({
      today: { tongGhiNhan: 0, tongCanhBao: 0 },
      overall: {},
      data: [],
      error: error.message
    });
  }
});

// GET /api/statistics/history - LẤY THỐNG KÊ 30 NGÀY
app.get("/api/statistics/history", requireAuth, async (req, res) => {
  try {
    const history = await db.layThongKe30Ngay();

    const formattedHistory = history.map(record => ({
      ngay: record.ngay,
      tongGhiNhan: record.tongGhiNhan || 0,
      tongCanhBao: record.tongCanhBao || 0,
      nhieuDoBinhQuan: parseFloat(record.nhieuDoBinhQuan) || 0,
      doAmBinhQuan: parseFloat(record.doAmBinhQuan) || 0,
      nhieuDoMax: parseFloat(record.nhieuDoMax) || 0,
      nhieuDoMin: parseFloat(record.nhieuDoMin) || 0
    }));

    res.json({ success: true, data: formattedHistory });
  } catch (error) {
    console.error('❌ Lỗi API Lịch sử thống kê:', error.message);
    res.json({ success: false, data: [], error: error.message });
  }
});

// GET /api/statistics/pollution - Thống kê ô nhiễm
app.get("/api/statistics/pollution", requireAuth, async (req, res) => {
  try {
    const history = await db.layLichSuOnhie();
    if (!history || history.length === 0) {
      return res.json({
        success: true,
        stats: {
          avg_aqi: 0, max_aqi: 0, min_aqi: 0,
          avg_pm25: 0, max_pm25: 0, min_pm25: 0,
          avg_pm10: 0, max_pm10: 0, min_pm10: 0,
          count: 0
        }
      });
    }

    const stats = history.reduce((acc, record) => {
      acc.aqi.push(record.aqi);
      acc.pm25.push(record.pm25);
      acc.pm10.push(record.pm10);
      return acc;
    }, { aqi: [], pm25: [], pm10: [] });

    const calculateStats = (arr) => {
      const sum = arr.reduce((a, b) => a + b, 0);
      const avg = sum / arr.length || 0;
      const max = Math.max(...arr);
      const min = Math.min(...arr);
      return { avg, max, min };
    };

    const aqiStats = calculateStats(stats.aqi);
    const pm25Stats = calculateStats(stats.pm25);
    const pm10Stats = calculateStats(stats.pm10);

    res.json({
      success: true,
      stats: {
        avg_aqi: aqiStats.avg.toFixed(0),
        max_aqi: aqiStats.max.toFixed(0),
        min_aqi: aqiStats.min.toFixed(0),
        avg_pm25: pm25Stats.avg.toFixed(1),
        max_pm25: pm25Stats.max.toFixed(1),
        min_pm25: pm25Stats.min.toFixed(1),
        avg_pm10: pm10Stats.avg.toFixed(1),
        max_pm10: pm10Stats.max.toFixed(1),
        min_pm10: pm10Stats.min.toFixed(1),
        count: history.length
      }
    });

  } catch (error) {
    console.error('❌ Lỗi API Thống kê ô nhiễm:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE /api/data/clear - Xóa toàn bộ dữ liệu
app.delete("/api/data/clear", async (req, res) => {
  await db.xoaToangBoDuLieu();
  // Xóa bộ đệm cảnh báo
  alertBuffer.length = 0;
  res.json({ success: true, message: "Dữ liệu và cache cảnh báo đã được xóa" });
});

// ======= Forecast Endpoints =======
// GET /api/forecast - Dự báo 24h (từ OpenWeatherMap)
app.get('/api/forecast', requireAuth, async (req, res) => {
  try {
    const config = loadConfig();
    if (!config.weatherApiKey || config.weatherProvider !== 'openweather') {
      return res.status(400).json({ error: 'Chưa cấu hình API key OpenWeatherMap' });
    }

    const axios = require('axios');
    const lat = config.weatherLat || 21.0285;
    const lon = config.weatherLon || 105.8542;
    const apiKey = config.weatherApiKey;

    // Gọi API song song
    const currentWeatherUrl = 'https://api.openweathermap.org/data/2.5/weather';
    const forecastUrl = 'https://api.openweathermap.org/data/2.5/forecast';

    const [currentWeatherResponse, forecastResponse] = await Promise.all([
      axios.get(currentWeatherUrl, {
        params: { lat, lon, appid: apiKey, units: 'metric', lang: 'vi' },
        timeout: 5000
      }),
      axios.get(forecastUrl, {
        params: { lat, lon, appid: apiKey, units: 'metric', lang: 'vi' },
        timeout: 5000
      })
    ]);

    const currentData = currentWeatherResponse.data;
    const forecastData = forecastResponse.data;

    // Xử lý dữ liệu thời tiết hiện tại
    const current = {
      temp: currentData.main.temp,
      humidity: currentData.main.humidity,
      condition: currentData.weather[0]?.description || 'Không rõ',
      windSpeed: currentData.wind.speed,
      rainChance: 0,
      visibility: (currentData.visibility || 10000) / 1000,
      sunrise: currentData.sys.sunrise,
      sunset: currentData.sys.sunset,
      cloudCover: currentData.clouds.all || 0,
      dewPoint: null,
      pressure: currentData.main.pressure,
      windGust: currentData.wind.gust || 0,
      uvIndex: null
    };

    // Xử lý dữ liệu dự báo cho biểu đồ mưa
    const hourly = forecastData.list || [];
    const rainPoints = hourly.slice(0, 24).map(item => ({
      time: item.dt * 1000,
      rainChance: (item.pop || 0) * 100,
      luongMua: item.rain?.['3h'] || 0
    }));

    if (rainPoints.length > 0) {
        current.rainChance = rainPoints[0].rainChance;
    }

    // Tính toán tóm tắt 24 giờ
    const totalRain = rainPoints.reduce((sum, p) => sum + p.luongMua, 0);
    const summary = `Dự báo từ OpenWeatherMap (v2.5). Tổng lượng mưa trong 24 giờ tới: ${totalRain.toFixed(1)} mm.`;

    // Tạo cảnh báo dựa trên dự báo
    const alerts = [];
    if (totalRain > 10) {
      alerts.push({
        event: 'Mưa lớn',
        description: `Dự báo có mưa lớn trong 24 giờ tới, tổng lượng mưa có thể lên tới ${totalRain.toFixed(1)} mm.`,
        severity: 'warning'
      });
    }

    res.json({ rainPoints, current, alerts, summary });

  } catch (error) {
    console.error('❌ Lỗi API Dự báo:', error);
    if (error.response) {
      console.error('Dữ liệu phản hồi API:', error.response.data);
      console.error('Trạng thái phản hồi API:', error.response.status);
      return res.status(error.response.status).json({ error: `Lỗi từ OpenWeatherMap: ${error.response.data.message}` });
    }
    return res.status(503).json({ error: 'Không thể lấy dữ liệu dự báo từ OpenWeatherMap' });
  }
});

// GET /api/pollution - Dự báo ô nhiễm (từ OpenWeatherMap)
app.get('/api/pollution', requireAuth, async (req, res) => {
  try {
    const config = loadConfig();

    // Lấy dữ liệu thực từ OpenWeatherMap Air Pollution API
    if (!config.weatherApiKey || config.weatherProvider !== 'openweather') {
      return res.status(400).json({ error: 'Chưa cấu hình API key OpenWeatherMap' });
    }

    try {
      const axios = require('axios');
      const lat = config.weatherLat || 21.0285;
      const lon = config.weatherLon || 105.8542;

      // Lấy dữ liệu dự báo ô nhiễm không khí
      const forecastResponse = await axios.get('https://api.openweathermap.org/data/2.5/air_pollution/forecast', {
        params: {
          lat,
          lon,
          appid: config.weatherApiKey
        },
        timeout: 5000
      });

      const forecastData = forecastResponse.data.list;

      // Lấy dữ liệu ô nhiễm hiện tại từ dự báo
      const currentPollution = forecastData[0];
      const components = currentPollution.components;
      const pm25 = components.pm2_5 || 12;
      const pm10 = components.pm10 || 30;
      const o3 = components.o3 || 50;
      const no2 = components.no2 || 40;

      // Tính toán AQI EPA từ PM2.5
      const epAqi = calculateAQI(pm25);

      // Dùng 24 giờ tiếp theo từ dự báo cho biểu đồ
      const pollutionPoints = forecastData.slice(0, 24).map(item => ({
        time: item.dt * 1000,
        pm25: item.components.pm2_5 || 0,
        pm10: item.components.pm10 || 0
      }));

      // Tạo cảnh báo cho ô nhiễm cao
      const alerts = [];
      if (pm25 > 35) {
        alerts.push({
          pollutant: 'Bụi mịn (PM2.5)',
          value: pm25,
          level: pm25 > 55 ? '🛑 Không tốt' : '⚠️ Trung bình'
        });
      }
      if (pm10 > 154) {
        alerts.push({
          pollutant: 'Bụi thô (PM10)',
          value: pm10,
          level: pm10 > 254 ? '🛑 Không tốt' : '⚠️ Trung bình'
        });
      }

      console.log('✅ Dữ liệu ô nhiễm từ OpenWeatherMap:', { pm25, pm10, aqi: epAqi });

      // Lưu vào database (không chặn)
      db.luuDuLieuOnhie({ aqi: epAqi, pm25, pm10 }).catch(console.error);

      return res.json({
        aqi: epAqi,
        pm25: pm25,
        pm10: pm10,
        o3: o3,
        no2: no2,
        pollution_points: pollutionPoints,
        alerts: alerts,
        summary: `AQI: ${epAqi} - PM2.5: ${pm25.toFixed(1)} µg/m³ (OpenWeatherMap)`
      });
    } catch (apiError) {
      console.error('❌ Lỗi API Chất lượng không khí OpenWeatherMap:', apiError.message);
      return res.status(503).json({ error: 'Không thể lấy dữ liệu ô nhiễm từ OpenWeatherMap' });
    }
  } catch (error) {
    console.error('❌ Lỗi API Ô nhiễm:', error);
    res.status(500).json({ error: 'Lỗi lấy dữ liệu ô nhiễm' });
  }
});

// Helper function to calculate AQI from PM2.5
function calculateAQI(pm25) {
  if (pm25 <= 12) return Math.round((pm25 / 12) * 50);
  if (pm25 <= 35.4) return Math.round(50 + ((pm25 - 12) / 23.4) * 50);
  if (pm25 <= 55.4) return Math.round(100 + ((pm25 - 35.4) / 20) * 50);
  if (pm25 <= 150.4) return Math.round(150 + ((pm25 - 55.4) / 95) * 50);
  if (pm25 <= 250.4) return Math.round(200 + ((pm25 - 150.4) / 100) * 50);
  return Math.round(300 + ((pm25 - 250.4) / 500) * 100);
}

// POST /api/pollution/recommendations - Gợi ý hành động từ AI
app.post('/api/pollution/recommendations', requireAuth, async (req, res) => {
  const { aqi, pm25, pm10 } = req.body;

  if (aqi === undefined || pm25 === undefined || pm10 === undefined) {
    return res.status(400).json({ error: 'Thiếu dữ liệu ô nhiễm' });
  }

  const prompt = `Chỉ số chất lượng không khí (AQI) hiện tại là ${aqi}, nồng độ PM2.5 là ${pm25} µg/m³, và nồng độ PM10 là ${pm10} µg/m³. Dựa trên các chỉ số này, hãy đưa ra 2-3 gợi ý để bảo vệ sức khỏe. Trả về một đối tượng JSON có dạng: {"recommendations": [{"reason": "Lý do...", "action": "Hành động..."}]}`;

  try {
    const config = loadConfig();
    const rawReply = await ai.traLoiAI(prompt, config);

    // Trích xuất JSON từ phản hồi thô
    const jsonMatch = rawReply.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const recommendations = JSON.parse(jsonMatch[0]);
      res.json(recommendations);
    } else {
      // Fallback cho phản hồi không phải JSON
      res.json({ recommendations: [{ reason: "Gợi ý chung", action: rawReply }] });
    }
  } catch (error) {
    console.error('❌ Lỗi gợi ý AI:', error.message);
    res.status(500).json({ error: 'Không thể lấy gợi ý từ AI' });
  }
});

// POST /api/tts - API TTS (Text-to-Speech)
app.post("/api/tts", (req, res) => {
  const { text, lang = "vi-VN" } = req.body;

  if (!text) {
    return res.json({ success: false, message: "Text không được để trống" });
  }

  // Tạm thời trả về URL của Google Translate TTS
  const encodedText = encodeURIComponent(text);
  const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodedText}&tl=${lang}&client=tw-ob`;

  res.json({ success: true, audioUrl: ttsUrl });
});

// ============ SOCKET.IO ============

io.on("connection", (socket) => {
  console.log("🟢 Client kết nối");
  let statsUpdateInterval = null;

  // Nhận dữ liệu cảm biến từ simulator
  socket.on("camBien", async (dulieuRaw) => {
    const { sanitizedData: dulieu, anomalies, deviceId } = stabilizeSensorData(dulieuRaw || {});

    if (anomalies.length > 0) {
      console.warn(`⚠️ Dữ liệu bất thường (${deviceId}):`, anomalies.join('; '));
    }

    console.log("📥 Nhận dữ liệu cảm biến:", dulieu);

    // Lưu vào DB (không chặn)
    db.luuDuLieuCamBien(dulieu).catch(err => console.error('Lỗi DB:', err));

    // REALTIME: Cập nhật thống kê
    try {
      const historyData = await db.layLichSu24h();
      const calculatedStats = calculateStats(historyData);
      const chartData24h = prepareChart24hData(historyData);

      io.emit('statsUpdate', {
        timestamp: Date.now(),
        stats: calculatedStats,
        data: chartData24h,
        sensorCount: historyData.length
      });

      console.log(`✅ Thống kê cập nhật: ${calculatedStats.tongGhiNhan} ghi nhận, ${calculatedStats.tongCanhBao} cảnh báo`);
    } catch (err) {
      console.error('⚠️ Lỗi tính toán Stats:', err.message);
    }

    // ===== KIỂM TRA & TẠO CẢNH BÁO =====
    const alerts = [];

    // Cảnh báo Nhiệt độ
    if (dulieu.nhietDo > THRESHOLDS.tempMax) {
      if (shouldFireAlert('temp_high')) {
        alerts.push({
          type: 'Nhiệt độ cao',
          icon: '🌡️',
          message: `Nhiệt độ cao: ${dulieu.nhietDo}°C (ngưỡng: ${THRESHOLDS.tempMax}°C)`,
          severity: 'warning'
        });
      }
    } else if (dulieu.nhietDo < THRESHOLDS.tempMin) {
      if (shouldFireAlert('temp_low')) {
        alerts.push({
          type: 'Nhiệt độ thấp',
          icon: '❄️',
          message: `Nhiệt độ thấp: ${dulieu.nhietDo}°C (ngưỡng: ${THRESHOLDS.tempMin}°C)`,
          severity: 'warning'
        });
      }
    }

    // Cảnh báo Độ ẩm
    if (dulieu.doAm > THRESHOLDS.humidityMax) {
      if (shouldFireAlert('humidity_high')) {
        alerts.push({
          type: 'Độ ẩm cao',
          icon: '💧',
          message: `Độ ẩm cao: ${dulieu.doAm}% (ngưỡng: ${THRESHOLDS.humidityMax}%)`,
          severity: 'warning'
        });
      }
    } else if (dulieu.doAm < THRESHOLDS.humidityMin) {
      if (shouldFireAlert('humidity_low')) {
        alerts.push({
          type: 'Độ ẩm thấp',
          icon: '🏜️',
          message: `Độ ẩm thấp: ${dulieu.doAm}% (ngưỡng: ${THRESHOLDS.humidityMin}%)`,
          severity: 'warning'
        });
      }
    }

    // Gửi cảnh báo ngay lập tức
    if (alerts.length > 0) {
      console.log(`⚠️ Phát ${alerts.length} cảnh báo: ${alerts.map(a => a.type).join(', ')}`);

      // Thêm vào bộ đệm
      alerts.forEach(alert => {
        alertBuffer.push({ ...alert, timestamp: Date.now() });
        if (alertBuffer.length > MAX_BUFFER_SIZE) {
          alertBuffer.shift();
        }
      });

      // Gửi đến clients
      io.emit("capNhat", {
        dulieu,
        alerts,
        recommendations: [],
        anomalies
      });

      // Lấy khuyến nghị AI ASYNC (không chặn)
      if (shouldCallAI('sensor_analysis')) {
        const config = loadConfig();
        if (config.apiType !== 'local' && config.apiKey) {
          (async () => {
            try {
              const prompt = `Cảnh báo: ${alerts.map(a => a.message).join('; ')}.\nCho 1-2 hành động ngắn để khắc phục.`;
              const aiReply = await ai.traLoiAI(prompt, config);
              io.emit("aiRecommendation", {
                recommendations: [{ message: aiReply, icon: '💡' }]
              });
            } catch (err) {
              console.warn('⚠️ Lỗi khuyến nghị AI:', err.message);
            }
          })();
        }
      }
    } else {
      // Không có cảnh báo, chỉ gửi cập nhật dữ liệu
      io.emit("capNhat", {
        dulieu,
        alerts: [],
        recommendations: [],
        anomalies
      });
    }
  });

  // Dọn dẹp khi mất kết nối
  socket.on('disconnect', () => {
    if (statsUpdateInterval) {
      clearInterval(statsUpdateInterval);
      statsUpdateInterval = null;
    }
    console.log('🔴 Client mất kết nối');
  });

  // Cập nhật cấu hình API
  socket.on("capNhatConfig", (config) => {
    saveConfig(config);
    io.emit("configCapNhat", { success: true });
  });

  // Cập nhật thresholds
  socket.on("capNhatThresholds", (thresholds) => {
    if (thresholds.tempMax) THRESHOLDS.tempMax = thresholds.tempMax;
    if (thresholds.tempMin) THRESHOLDS.tempMin = thresholds.tempMin;
    if (thresholds.humidityMax) THRESHOLDS.humidityMax = thresholds.humidityMax;
    if (thresholds.humidityMin) THRESHOLDS.humidityMin = thresholds.humidityMin;

    io.emit("thresholdsCapNhat", THRESHOLDS);
  });

  // Nhận cập nhật thời tiết từ client (sau khi đổi vị trí)
  socket.on("weather_update", (weatherData) => {
    console.log("🌦️ Nhận cập nhật thời tiết từ API:", weatherData);

    // Cập nhật hiển thị nhiệt độ và độ ẩm trên header của tất cả client
    io.emit("header_weather_update", {
      temperature: weatherData.temperature,
      humidity: weatherData.humidity
    });

    // Tạo một đối tượng dữ liệu tương tự 'camBien'
    const dulieu = {
      nhietDo: weatherData.temperature,
      doAm: weatherData.humidity,
      thoigian: new Date().toISOString(),
      source: 'weather_api' // Đánh dấu nguồn dữ liệu
    };

    // Gửi cập nhật này đến tất cả các client
    io.emit("capNhat", {
      dulieu,
      alerts: [],
      recommendations: []
    });
  });
});

// ===========================
// AI INTEGRATION ENDPOINTS
// ===========================

// POST /api/suggest-action - Gợi ý hành động từ AI
app.post('/api/suggest-action', async (req, res) => {
  try {
    const { temperature, humidity, actionType } = req.body;

    // Xây dựng ngữ cảnh
    const context = `Tình trạng: Nhiệt độ ${temperature}°C, Độ ẩm ${humidity}%`;
    const prompt = `${context}. Loại hành động: ${actionType || 'tối ưu hóa'}.
Cho 2 hành động cụ thể người dùng nên làm (nội dung ngắn, <30 từ mỗi).
Trả về JSON: {"actions": ["hành động 1", "hành động 2"]}`;

    const config = loadConfig();
    const aiReply = await ai.traLoiAI(prompt, {
      apiType: config.apiType,
      apiKey: config.apiKey,
      aiTone: config.aiTone || 'technical'
    });

    // Phân tích phản hồi
    try {
      const jsonMatch = aiReply.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return res.json({
          success: true,
          actions: parsed.actions || [],
          source: 'AI'
        });
      }
    } catch (e) {
      // Trả về phản hồi thô của AI dưới dạng hành động đơn
      return res.json({
        success: true,
        actions: [aiReply],
        source: 'AI'
      });
    }

  } catch (error) {
    console.error('❌ Lỗi gợi ý hành động:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// POST /api/analyze-thresholds - Phân tích ngưỡng
app.post('/api/analyze-thresholds', async (req, res) => {
  try {
    const { temperature, humidity, trend } = req.body;

    const prompt = `Phân tích xu hướng: ${trend || 'ổn định'}.
Dữ liệu: Nhiệt độ ${temperature}°C, Độ ẩm ${humidity}%.
Ngưỡng hiện tại có nên điều chỉnh không? Gợi ý ngưỡng mới nếu cần.
Trả về JSON: {"recommendation": "mô tả", "adjustments": {"tempMax": số, "humidityMax": số}}`;

    const config = loadConfig();
    const aiReply = await ai.traLoiAI(prompt, {
      apiType: config.apiType,
      apiKey: config.apiKey,
      aiTone: config.aiTone || 'technical'
    });

    // Phân tích phản hồi
    try {
      const jsonMatch = aiReply.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return res.json({
          success: true,
          recommendation: parsed.recommendation || '',
          adjustments: parsed.adjustments || {},
          source: 'AI'
        });
      }
    } catch (e) {
      return res.json({
        success: true,
        recommendation: aiReply,
        adjustments: {},
        source: 'AI'
      });
    }

  } catch (error) {
    console.error('❌ Lỗi phân tích ngưỡng:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ===== AI SYSTEM CONTROL ENDPOINTS =====

// POST /api/system-features - Điều khiển tính năng hệ thống
app.post("/api/system-features", (req, res) => {
  try {
    const { feature, enabled } = req.body;

    if (!feature) {
      return res.status(400).json({
        success: false,
        message: "❌ Thiếu tham số feature"
      });
    }

    console.log(`⚙️ AI Yêu cầu tính năng hệ thống: ${feature} = ${enabled}`);

    // Broadcast đến tất cả clients
    io.emit("systemFeatureUpdate", {
      feature: feature,
      enabled: enabled,
      timestamp: Date.now()
    });

    res.json({
      success: true,
      message: `✅ Cập nhật ${feature} thành công`,
      feature: feature,
      enabled: enabled
    });
  } catch (error) {
    console.error("❌ Lỗi cập nhật tính năng hệ thống:", error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// POST /api/system-mode - Điều khiển chế độ hệ thống
app.post("/api/system-mode", (req, res) => {
  try {
    const { mode, config } = req.body;

    if (!mode) {
      return res.status(400).json({
        success: false,
        message: "❌ Thiếu tham số mode"
      });
    }

    console.log(`🎯 AI Yêu cầu chế độ hệ thống: ${mode}`, config);

    // Broadcast đến tất cả clients
    io.emit("systemModeUpdate", {
      mode: mode,
      config: config || {},
      timestamp: Date.now()
    });

    const modeNames = {
      quiet: "🔇 Chế độ yên tĩnh",
      night: "🌙 Chế độ đêm",
      day: "☀️ Chế độ ngày",
      work: "💼 Chế độ làm việc",
      home: "🏠 Chế độ nhà"
    };

    res.json({
      success: true,
      message: `✅ Chuyển sang ${modeNames[mode] || mode}`,
      mode: mode,
      config: config
    });
  } catch (error) {
    console.error("❌ Lỗi cập nhật chế độ hệ thống:", error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// POST /api/auto-optimize - Tối ưu hóa hệ thống tự động
app.post("/api/auto-optimize", (req, res) => {
  try {
    const { enabled } = req.body;

    console.log(`🤖 AI Yêu cầu tối ưu hóa tự động: ${enabled}`);

    // Giả lập tối ưu hóa dựa trên ngưỡng hiện tại
    const optimizedThresholds = {
      tempMax: THRESHOLDS.tempMax,
      tempMin: THRESHOLDS.tempMin,
      humidityMax: THRESHOLDS.humidityMax,
      humidityMin: THRESHOLDS.humidityMin,
      batteryMin: THRESHOLDS.batteryMin
    };

    // Có thể áp dụng điều chỉnh dựa trên AI ở đây
    io.emit("autoOptimizeUpdate", {
      enabled: enabled,
      thresholds: optimizedThresholds,
      timestamp: Date.now()
    });

    res.json({
      success: true,
      message: "🤖 AI đang tối ưu hóa hệ thống",
      optimized: optimizedThresholds,
      timestamp: Date.now()
    });
  } catch (error) {
    console.error("❌ Lỗi tối ưu hóa hệ thống tự động:", error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// POST /api/system-reset - Reset hệ thống
app.post("/api/system-reset", (req, res) => {
  try {
    const { confirmReset } = req.body;

    if (!confirmReset) {
      return res.status(400).json({
        success: false,
        message: "❌ Phải xác nhận reset"
      });
    }

    console.log("⚠️ AI Yêu cầu reset hệ thống");

    // Reset thresholds về mặc định
    THRESHOLDS = {
      tempMax: 27,
      tempMin: 19,
      humidityMax: 82,
      humidityMin: 40,
      batteryMin: 50
    };

    saveThresholds();

    // Broadcast đến tất cả clients
    io.emit("systemReset", {
      thresholds: THRESHOLDS,
      timestamp: Date.now()
    });

    res.json({
      success: true,
      message: "✅ Hệ thống đã reset về mặc định",
      thresholds: THRESHOLDS
    });
  } catch (error) {
    console.error("❌ Lỗi reset hệ thống:", error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// GET /api/system-status - Lấy trạng thái hệ thống
app.get("/api/system-status", (req, res) => {
  try {
    res.json({
      success: true,
      thresholds: THRESHOLDS,
      timestamp: Date.now(),
      uptime: process.uptime(),
      connectedClients: Object.keys(io.sockets.sockets).length
    });
  } catch (error) {
    console.error("❌ Lỗi lấy trạng thái hệ thống:", error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// ===== SOCIAL LOGIN ENDPOINTS =====

// GET /auth/facebook - Facebook OAuth Login
app.get("/auth/facebook", (req, res) => {
  if (!process.env.FACEBOOK_CLIENT_ID) {
    return res.status(400).json({ success: false, message: 'Facebook OAuth chưa được cấu hình' });
  }

  const callbackURL = req.query.callback || '/pages/home.html';
  const facebookAuthURL = `https://www.facebook.com/v12.0/dialog/oauth?client_id=${process.env.FACEBOOK_CLIENT_ID || 'MOCK_ID'}&redirect_uri=${encodeURIComponent(req.protocol + '://' + req.get('host') + '/auth/facebook/callback')}&scope=email,public_profile`;
  
  if (process.env.NODE_ENV === 'development') {
    const mockUser = {
      id: 'fb_mock_' + Date.now(),
      email: 'facebook@example.com',
      username: 'facebook_user',
      fullName: 'Facebook User',
      provider: 'facebook'
    };
    
    // Giả lập đăng nhập thành công
    res.json({
      success: true,
      user: mockUser,
      message: 'Đăng nhập Facebook thành công (Mock)'
    });
  } else {
    res.redirect(facebookAuthURL);
  }
});

// GET /auth/facebook/callback - Facebook OAuth Callback
app.get("/auth/facebook/callback", (req, res) => {
  const code = req.query.code;
  const error = req.query.error;

  if (error) {
    return res.redirect(`/pages/login.html?error=${encodeURIComponent('Xác thực Facebook thất bại: ' + error)}`);
  }

  if (!code) {
    return res.redirect(`/pages/login.html?error=${encodeURIComponent('Không nhận được mã ủy quyền')}`);
  }

  try {
    // Giả lập người dùng đơn giản
    const user = {
      id: 'fb_' + Date.now(),
      email: `fb_user_${Date.now()}@example.com`,
      username: `fb_user_${Date.now()}`,
      fullName: 'Facebook User'
    };

    res.redirect('/pages/home.html?provider=facebook');
  } catch (error) {
    res.redirect(`/pages/login.html?error=${encodeURIComponent('Đăng nhập Facebook thất bại')}`);
  }
});

// GET /auth/google - Google OAuth Login
app.get("/auth/google", (req, res) => {
  // Chuyển hướng đến màn hình xác thực Google OAuth
  const googleAuthURL = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${process.env.GOOGLE_CLIENT_ID || 'MOCK_ID'}&redirect_uri=${encodeURIComponent(req.protocol + '://' + req.get('host') + '/auth/google/callback')}&response_type=code&scope=email%20profile`;
  
  if (process.env.NODE_ENV === 'development') {
    res.json({
      success: true,
      message: 'Đăng nhập Google thành công (Mock)',
      provider: 'google'
    });
  } else {
    res.redirect(googleAuthURL);
  }
});

// GET /auth/google/callback - Google OAuth Callback
app.get("/auth/google/callback", (req, res) => {
  const code = req.query.code;
  const error = req.query.error;

  if (error) {
    return res.redirect(`/pages/login.html?error=${encodeURIComponent('Xác thực Google thất bại: ' + error)}`);
  }

  if (!code) {
    return res.redirect(`/pages/login.html?error=${encodeURIComponent('Không nhận được mã ủy quyền')}`);
  }

  try {
    // Giả lập người dùng đơn giản
    const user = {
      id: 'google_' + Date.now(),
      email: `google_user_${Date.now()}@example.com`,
      username: `google_user_${Date.now()}`,
      fullName: 'Google User'
    };

    res.redirect('/pages/login.html?provider=google');
  } catch (error) {
    res.redirect(`/pages/login.html?error=${encodeURIComponent('Đăng nhập Google thất bại')}`);
  }
});

http.listen(3000, () => {
  // Tải thresholds từ file khi server khởi động
  loadThresholds();

  console.log("🚀 Server chạy tại: http://localhost:3000");
  console.log("📁 Thư mục dữ liệu: ", __dirname);
  console.log("⚙️ Ngưỡng hiện tại:", THRESHOLDS);
  console.log("🤖 AI System Control enabled - AI có thể can thiệp toàn bộ hệ thống");
});