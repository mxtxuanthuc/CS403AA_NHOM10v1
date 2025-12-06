const axios = require("axios");

// ===== XỬ LÝ KIỂM SOÁT HỆ THỐNG NÂNG CAO =====
// AI có thể điều khiển toàn bộ hệ thống (ngưỡng, cấu hình, tính năng, chế độ).
function parseSystemCommand(question) {
  const q = question.toLowerCase().trim();
  console.log("🤖 Phân tích lệnh hệ thống AI:", q);

  // Phát hiện loại lệnh
  const commandTypes = {
    // Điều khiển ngưỡng
    threshold: /(?:đặt|cài|set)\s+(?:ngưỡng|cảnh báo)/i.test(q),
    // Điều khiển tính năng
    feature: /(?:bật|tắt|enable|disable|mở|đóng)/i.test(q),
    // Chế độ hệ thống
    mode: /(?:chế độ|mode|quiet|silent|work|night|day)/i.test(q),
    // Yêu cầu thông tin
    info: /(?:cho|báo|cảm biến|sensor|dữ liệu|data|trạng thái|status)/i.test(q),
    // Tối ưu hóa tự động
    optimize: /(?:tự động|auto|tối ưu|optimize)/i.test(q),
    // Reset/khôi phục
    reset: /(?:reset|khôi phục|restore|clear)/i.test(q)
  };

  // Mẫu lệnh Threshold
  const thresholdPatterns = [
    { regex: /(?:đặt|set|cài)\s+(?:nhiệt độ|temp)\s+(?:cao nhất|max|tối đa)\s*(\d+(?:[.,]\d+)?)/i, field: 'tempMax' },
    { regex: /(?:đặt|set|cài)\s+(?:nhiệt độ|temp)\s+(?:thấp nhất|min|tối thiểu)\s*(\d+(?:[.,]\d+)?)/i, field: 'tempMin' },
    { regex: /(?:đặt|set|cài)\s+(?:độ ẩm|humidity)\s+(?:cao nhất|max|tối đa)\s*(\d+(?:[.,]\d+)?)/i, field: 'humidityMax' },
    { regex: /(?:đặt|set|cài)\s+(?:độ ẩm|humidity)\s+(?:thấp nhất|min|tối thiểu)\s*(\d+(?:[.,]\d+)?)/i, field: 'humidityMin' },
    { regex: /(?:đặt|set|cài)\s+(?:pin|battery)\s+(?:tối thiểu|min)\s*(\d+(?:[.,]\d+)?)/i, field: 'batteryMin' },
    { regex: /cảnh báo.*?(\d+)\s*độ(?:\s+(?:nhiệt độ|temp))?/i, field: 'tempMax' },
    { regex: /ngưỡng.*?(\d+)\s*%(?:\s+(?:ẩm|humidity))?/i, field: 'humidityMax' }
  ];

  // Mẫu kiểm soát tính năng (bật/tắt)
  const featurePatterns = [
    { regex: /(?:bật|enable|mở)\s+(?:hết|toàn bộ|tất cả)?\s*(?:alert|cảnh báo)/i, action: 'enable', feature: 'alerts' },
    { regex: /(?:tắt|disable|đóng)\s+(?:hết|toàn bộ|tất cả)?\s*(?:alert|cảnh báo)/i, action: 'disable', feature: 'alerts' },
    { regex: /(?:bật|enable|mở)\s+(?:hết|toàn bộ|tất cả)?\s*(?:âm thanh|sound|tiếng)/i, action: 'enable', feature: 'sound' },
    { regex: /(?:tắt|disable|đóng)\s+(?:hết|toàn bộ|tất cả)?\s*(?:âm thanh|sound|tiếng)/i, action: 'disable', feature: 'sound' },
    { regex: /(?:bật|enable|mở)\s+(?:hết|toàn bộ|tất cả)?\s*(?:toast|thông báo|notify)/i, action: 'enable', feature: 'toast' },
    { regex: /(?:tắt|disable|đóng)\s+(?:hết|toàn bộ|tất cả)?\s*(?:toast|thông báo|notify)/i, action: 'disable', feature: 'toast' },
    { regex: /(?:bật|enable|mở)\s+(?:hết|toàn bộ|tất cả)?\s*(?:tự động|auto|adjust)/i, action: 'enable', feature: 'auto' },
    { regex: /(?:tắt|disable|đóng)\s+(?:hết|toàn bộ|tất cả)?\s*(?:tự động|auto|adjust)/i, action: 'disable', feature: 'auto' },
    { regex: /(?:bật|enable|mở)\s+(?:hết|toàn bộ|tất cả)?\s*(?:log|ghi|record|sensor)/i, action: 'enable', feature: 'logging' },
    { regex: /(?:tắt|disable|đóng)\s+(?:hết|toàn bộ|tất cả)?\s*(?:log|ghi|record|sensor)/i, action: 'disable', feature: 'logging' },
    { regex: /(?:bật|enable|mở)\s+(?:giao diện\s+)?(?:tối|dark|night)/i, action: 'enable', feature: 'darkmode' },
    { regex: /(?:tắt|disable|đóng)\s+(?:giao diện\s+)?(?:tối|dark|night)/i, action: 'disable', feature: 'darkmode' }
  ];

  // Mẫu chế độ
  const modePatterns = [
    { regex: /(?:chế độ|mode)?\s*(?:yên tĩnh|quiet|silent|không)/i, mode: 'quiet' },
    { regex: /(?:chế độ|mode)?\s*(?:đêm|night|tối)/i, mode: 'night' },
    { regex: /(?:chế độ|mode)?\s*(?:ngày|day|sáng)/i, mode: 'day' },
    { regex: /(?:chế độ|mode)?\s*(?:làm việc|work|office)/i, mode: 'work' },
    { regex: /(?:chế độ|mode)?\s*(?:nhà|home|normal)/i, mode: 'home' }
  ];

  // Phân loại lệnh
  if (commandTypes.threshold) {
    // Xử lý lệnh ngưỡng
    for (const pattern of thresholdPatterns) {
      const match = q.match(pattern.regex);
      if (match) {
        const value = parseFloat(match[1].replace(',', '.'));
        console.log(`✅ Ngưỡng khớp! Field: ${pattern.field}, Value: ${value}`);
        return {
          type: 'threshold',
          field: pattern.field,
          value: value,
          isSystemCommand: true
        };
      }
    }
  }

  if (commandTypes.feature) {
    // Xử lý lệnh bật/tắt tính năng
    for (const pattern of featurePatterns) {
      const match = q.match(pattern.regex);
      if (match) {
        console.log(`✅ Tính năng khớp! Action: ${pattern.action}, Feature: ${pattern.feature}`);
        return {
          type: 'feature',
          action: pattern.action,
          feature: pattern.feature,
          isSystemCommand: true
        };
      }
    }
  }

  if (commandTypes.mode) {
    // Xử lý lệnh chế độ
    for (const pattern of modePatterns) {
      const match = q.match(pattern.regex);
      if (match) {
        console.log(`✅ Chế độ khớp! Mode: ${pattern.mode}`);
        return {
          type: 'mode',
          mode: pattern.mode,
          isSystemCommand: true
        };
      }
    }
  }

  if (commandTypes.optimize) {
    // Tối ưu hóa tự động
    console.log("🤖 Yêu cầu tối ưu hóa tự động");
    return {
      type: 'optimize',
      isSystemCommand: true
    };
  }

  if (commandTypes.reset) {
    // Reset hệ thống
    console.log("⚠️ Yêu cầu reset hệ thống");
    return {
      type: 'reset',
      isSystemCommand: true
    };
  }

  console.log("❌ Không nhận ra lệnh hệ thống nào");
  return { isSystemCommand: false };
}

// Hàm cũ giữ lại cho tương thích ngược
function parseThresholdCommand(question) {
  const result = parseSystemCommand(question);
  if (result.isSystemCommand && result.type === 'threshold') {
    return {
      isThresholdCommand: true,
      field: result.field,
      value: result.value
    };
  }
  return { isThresholdCommand: false };
}

// Từ khóa liên quan đến thời tiết (để tập trung chat)
const WEATHER_KEYWORDS = [
  "nhiệt độ", "temp", "thời tiết", "weather", "độ ẩm", "humidity",
  "mưa", "rain", "nắng", "sunny", "mây", "cloud", "gió", "wind",
  "áp suất", "pressure", "dew", "sương", "fog", "mù",
  "giông", "thunder", "tuyết", "snow", "đông", "lạnh", "cold",
  "nóng", "hot", "ẩm ướt", "wet", "khô", "dry", "cảnh báo", "dự báo",
  "forecast", "alert", "°c", "độ c", "độ f", "humidity",
  "không khí", "air", "ô nhiễm", "pollution", "aqi", "pm2.5", "pm10", "chất lượng không khí"
];

// Cấu hình thử lại
const MAX_RETRIES = 3;
const INITIAL_DELAY = 1000; // 1 giây
const BACKOFF_MULTIPLIER = 2;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function isWeatherRelated(question, topic) {
  const q = question.toLowerCase();
  // Nếu ở trang ô nhiễm, coi câu hỏi về chất lượng không khí là liên quan
  if (topic === 'pollution' && (q.includes('không khí') || q.includes('ô nhiễm') || q.includes('aqi') || q.includes('pm2.5') || q.includes('pm10'))) {
    return true;
  }
  // Nếu ở trang dự báo, coi câu hỏi về dự báo là liên quan
  if (topic === 'forecast' && (q.includes('dự báo') || q.includes('forecast') || q.includes('thời tiết'))) {
    return true;
  }
  return WEATHER_KEYWORDS.some(keyword => q.includes(keyword));
}

function buildSystemPrompt(tone = "friendly", hasGeolocation = false, topic = "") {
  const toneGuides = {
    casual: "Trò chuyện thoải mái, thân thiện như bạn bè. Ngôn ngữ gần gũi, tự nhiên.",
    friendly: "Thân thiện, hỗ trợ tích cực. Ngôn ngữ lịch sự nhưng dễ hiểu.",
    formal: "Chuyên nghiệp, trang trọng. Ngôn ngữ chính thức.",
    technical: "Chi tiết, chính xác khoa học. Giải thích bằng nguyên lý vật lý."
  };

  const guide = toneGuides[tone] || toneGuides.friendly;

  const formattingGuide = `
HƯỚNG DẪN TRÌNH BÀY:

✅ NGẮN GỌN - HIỆU QUẢ:
- Trả lời ngắn gọn, không dài dòng
- Chỉ giữ lại thông tin quan trọng nhất
- Mỗi đoạn tối đa 2-3 dòng
- Để dòng trống giữa các phần
- Dùng emoji để nhấn mạnh

❌ TRÁNH:
- Dài dòng, lặp lại
- Quá nhiều chi tiết không cần thiết
- Viết chùm khó đọc

KIỂU TRẢ LỜI ĐÚNG:

🌤️ Thời tiết Hà Nội hôm nay

Nhiệt độ: 28°C, độ ẩm 70%
Dự báo: Nắng, gió nhẹ từ Đông

☀️ Khuyến nghị: Uống nước đầy đủ`;

  if (hasGeolocation) {
    // Người dùng đã định vị - cho phép chủ đề rộng hơn
    return `Bạn là trợ lý AI thông minh. ${guide}

Người dùng đã định vị. Trả lời tự do về bất kỳ chủ đề nào.

${formattingGuide}

QUYẾT TẮC: Ngắn gọn, hiệu quả, không lặp lại. Chỉ thông tin cần thiết.`;
  } else {
    // Chưa có định vị - hạn chế theo chủ đề hoặc mặc định là thời tiết
    let restriction = "THỜI TIẾT, NHIỆT ĐỘ, ĐỘ ẨM, MƯA, GIÓ, DỰ BÁO.";
    if (topic === 'pollution') {
      restriction = "CHẤT LƯỢNG KHÔNG KHÍ, Ô NHIỄM, AQI, PM2.5, PM10.";
    } else if (topic === 'forecast') {
      restriction = "DỰ BÁO THỜI TIẾT, XU HƯỚNG NHIỆT ĐỘ, MƯA, ĐỘ ẨM.";
    }

    return `Bạn là trợ lý thông minh. ${guide}

Chuyên trả lời về ${restriction}

Nếu không liên quan đến chủ đề trên, từ chối lịch sự.

${formattingGuide}

QUYẾT TẮC: Ngắn gọn, hiệu quả, không lặp lại. Chỉ thông tin cần thiết.`;
  }
}

module.exports = {
  traLoiAI: async (cauHoi, config = {}) => {
    const apiType = config.apiType || "local";
    const apiKey = config.apiKey || "";
    const tone = config.aiTone || "friendly";
    const aiModel = config.aiModel || null; // Lấy mô hình đã chọn từ config
    const hasGeolocation = config.weatherLat && config.weatherLon;
    const topic = config.topic || ""; // Lấy chủ đề từ config

    // ===== XỬ LÝ LỆNH HỆ THỐNG TRƯỚC (ƯU TIÊN) =====
    const systemCmd = parseSystemCommand(cauHoi);
    if (systemCmd.isSystemCommand) {
      console.log("🚀 Lệnh hệ thống được phát hiện:", systemCmd);
      try {
        // Xử lý cập nhật ngưỡng
        if (systemCmd.type === 'threshold') {
          const response = await axios.post("http://localhost:3000/api/thresholds", {
            [systemCmd.field]: systemCmd.value
          });

          console.log("📡 Phản hồi API Ngưỡng:", response.data);
          if (response.data.success) {
            const fieldNames = {
              tempMax: "Nhiệt độ tối đa",
              tempMin: "Nhiệt độ tối thiểu",
              humidityMax: "Độ ẩm tối đa",
              humidityMin: "Độ ẩm tối thiểu",
              batteryMin: "Pin tối thiểu"
            };
            const msg = `✅ AI đã cập nhật: ${fieldNames[systemCmd.field]} = ${systemCmd.value}`;
            console.log("✅ Phản hồi được gửi:", msg);
            return msg;
          } else {
            return `❌ Lỗi cập nhật ngưỡng: ${response.data.message || 'Không xác định'}`;
          }
        }

        // Xử lý điều khiển tính năng
        if (systemCmd.type === 'feature') {
          const featureNames = {
            alerts: 'Cảnh báo',
            sound: 'Âm thanh',
            toast: 'Thông báo toast',
            auto: 'Tự động điều chỉnh',
            logging: 'Ghi nhật ký cảm biến',
            darkmode: 'Giao diện tối'
          };

          const featureName = featureNames[systemCmd.feature];
          const status = systemCmd.action === 'enable' ? 'BẬT' : 'TẮT';
          const emoji = systemCmd.action === 'enable' ? '✅' : '❌';

          // Xử lý darkmode riêng (chỉ phía client)
          if (systemCmd.feature === 'darkmode') {
            const shouldEnable = systemCmd.action === 'enable';
            // Cập nhật DOM và LocalStorage
            // *LƯU Ý: Đoạn code này chạy trên server, nên các thao tác DOM phải được xử lý ở client (đã có trong processAIChatMessage)*
            // Tuy nhiên, logic server vẫn cần phản hồi xác nhận lệnh.
            return `${emoji} AI đã ${status} ${featureName}`;
          }

          // Lưu trạng thái tính năng vào API
          try {
            await axios.post("http://localhost:3000/api/system-features", {
              feature: systemCmd.feature,
              enabled: systemCmd.action === 'enable'
            });
          } catch (e) {
            console.warn("⚠️ Cập nhật tính năng API thất bại:", e.message);
          }

          return `${emoji} AI đã ${status} ${featureName}`;
        }

        // Xử lý chuyển đổi chế độ
        if (systemCmd.type === 'mode') {
          const modeNames = {
            quiet: '🔇 Chế độ yên tĩnh',
            night: '🌙 Chế độ đêm',
            day: '☀️ Chế độ ngày',
            work: '💼 Chế độ làm việc',
            home: '🏠 Chế độ nhà'
          };

          const modeName = modeNames[systemCmd.mode];

          // Áp dụng cài đặt chế độ
          const modeConfig = {
            quiet: { alertsEnabled: false, soundEnabled: false, toastsEnabled: true },
            night: { alertsEnabled: true, soundEnabled: false, toastsEnabled: false },
            day: { alertsEnabled: true, soundEnabled: true, toastsEnabled: true },
            work: { alertsEnabled: true, soundEnabled: false, toastsEnabled: true },
            home: { alertsEnabled: true, soundEnabled: true, toastsEnabled: true }
          };

          try {
            await axios.post("http://localhost:3000/api/system-mode", {
              mode: systemCmd.mode,
              config: modeConfig[systemCmd.mode]
            });
          } catch (e) {
            console.warn("⚠️ Cập nhật chế độ thất bại:", e.message);
          }

          return `✅ AI đã chuyển sang ${modeName}`;
        }

        // Xử lý tối ưu hóa
        if (systemCmd.type === 'optimize') {
          try {
            await axios.post("http://localhost:3000/api/auto-optimize", {
              enabled: true
            });
          } catch (e) {
            console.warn("⚠️ Yêu cầu tối ưu hóa tự động thất bại:", e.message);
          }

          return `🤖 AI đang tối ưu hóa hệ thống. Vui lòng đợi...`;
        }

        // Xử lý reset
        if (systemCmd.type === 'reset') {
          try {
            await axios.post("http://localhost:3000/api/system-reset", {
              confirmReset: true
            });
          } catch (e) {
            console.warn("⚠️ Yêu cầu reset thất bại:", e.message);
          }

          return `⚠️ AI đã reset lại hệ thống. Các cài đặt sẽ quay về mặc định.`;
        }
      } catch (error) {
        console.error("❌ Lỗi xử lý lệnh hệ thống:", error.message);
        return `❌ Lỗi: ${error.message}`;
      }
    }

    // ===== XỬ LÝ LỆNH NGƯỠNG (TƯƠNG THÍCH NGƯỢC) =====
    const thresholdCmd = parseThresholdCommand(cauHoi);
    if (thresholdCmd.isThresholdCommand) {
      if (thresholdCmd.field === 'updateLocation') {
        return "🔄 Đang cập nhật vị trí và thời tiết...";
      }
      console.log("🚀 Lệnh ngưỡng phát hiện, đang cập nhật:", thresholdCmd);
      try {
        const response = await axios.post("http://localhost:3000/api/thresholds", {
          [thresholdCmd.field]: thresholdCmd.value
        });

        console.log("📡 Phản hồi API:", response.data);
        if (response.data.success) {
          const fieldNames = {
            tempMax: "Nhiệt độ tối đa",
            tempMin: "Nhiệt độ tối thiểu",
            humidityMax: "Độ ẩm tối đa",
            humidityMin: "Độ ẩm tối thiểu",
            batteryMin: "Pin tối thiểu"
          };
          const msg = `✅ Đã cập nhật: ${fieldNames[thresholdCmd.field]} = ${thresholdCmd.value}`;
          console.log("✅ Phản hồi được gửi:", msg);
          return msg;
        } else {
          return `❌ Lỗi cập nhật ngưỡng: ${response.data.message || 'Không xác định'}`;
        }
      } catch (error) {
        console.error("❌ Lỗi thay đổi ngưỡng:", error.message);
        return `❌ Không thể cập nhật ngưỡng. Lỗi: ${error.message}`;
      }
    }

    // Kiểm tra câu hỏi có liên quan đến thời tiết
    if (!hasGeolocation && !isWeatherRelated(cauHoi)) {
      return "🌧️ Xin lỗi, tôi chỉ có thể trợ giúp về các chủ đề liên quan đến **thời tiết**. Hãy định vị vị trí của bạn (📍 Tự định vị) để hỏi những câu hỏi tự do hơn!";
    }

    // Chế độ Mock cho thử nghiệm
    if (apiKey === "mock-key-for-testing" || apiType === "mock") {
      return generateMockAIResponse(cauHoi);
    }

    // Nếu không có API cấu hình hoặc đang dùng local mode
    if (apiType === "local" || !apiKey) {
      return "⚠️ Không có API AI được cấu hình. Vui lòng cấu hình OpenAI hoặc Google AI trong ⚙️ Cấu hình để nhận câu trả lời từ AI.";
    }

    try {
      // Gọi API thực với mô hình đã chọn
      if (apiType === "openai") {
        return await callOpenAI(cauHoi, apiKey, tone, hasGeolocation, aiModel);
      }

      if (apiType === "google") {
        return await callGoogleAI(cauHoi, apiKey, tone, hasGeolocation, aiModel);
      }
    } catch (error) {
      // Log lỗi và trả về thông báo thân thiện
      if (error && error.response) {
        try {
          console.error("❌ Lỗi API:", error.response.status, error.response.data);
        } catch (e) {
          console.error("❌ Lỗi API (không có body):", error.response.status);
        }

        if (error.response.status === 429) {
          return "⏳ API đang quá tải (429 - Rate limit). Vui lòng thử lại sau một lúc.";
        }

        if (error.response.status === 400) {
          return "❌ Lỗi: Yêu cầu không hợp lệ. Vui lòng kiểm tra API key hoặc mô hình AI.";
        }

        if (error.response.status === 401 || error.response.status === 403) {
          return "❌ Lỗi xác thực: API key không hợp lệ. Vui lòng kiểm tra lại cấu hình.";
        }

        if (error.response.status === 503) {
          return "🔧 Dịch vụ API tạm thời không khả dụng. Vui lòng thử lại.";
        }

        return `❌ Lỗi gọi API (${error.response.status}). Vui lòng kiểm tra API key và cấu hình.`;
      } else if (error && error.message) {
        console.error("❌ Lỗi API:", error.message);
        // Thông báo chi tiết hơn dựa trên nội dung lỗi
        if (error.message.includes("Invalid response structure") || error.message.includes("missing content parts")) {
          return "❌ API trả về dữ liệu không hợp lệ. Hãy thử lại hoặc đổi mô hình AI.";
        }
        if (error.message.includes("blocked")) {
          return "⚠️ Phản hồi bị chặn bởi bộ lọc nội dung. Thử câu hỏi khác.";
        }
        return `❌ Lỗi: ${error.message}. Vui lòng thử lại.`;
      }
    }

    return "❌ Không thể kết nối đến API. Vui lòng kiểm tra cấu hình.";
  }
};

async function callOpenAI(question, apiKey, tone = "friendly", hasGeolocation = false, aiModel = null) {
  let lastError;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const systemPrompt = buildSystemPrompt(tone, hasGeolocation);
      const model = aiModel || "gpt-4o-mini"; // Mặc định là GPT-4o Mini

      const response = await axios.post(
        "https://api.openai.com/v1/chat/completions",
        {
          model: model,
          messages: [
            {
              role: "system",
              content: systemPrompt
            },
            { role: "user", content: question }
          ],
          max_tokens: 300,
          temperature: 0.7
        },
        {
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`
          },
          timeout: 10000
        }
      );

      return response.data.choices[0].message.content;
    } catch (error) {
      lastError = error;

      // 429 = Rate limit, 503 = Service unavailable — thử lại với backoff
      if ((error.response?.status === 429 || error.response?.status === 503) && attempt < MAX_RETRIES) {
        const delay = INITIAL_DELAY * Math.pow(BACKOFF_MULTIPLIER, attempt - 1);
        console.warn(`⏳ Giới hạn/Không khả dụng. Thử lại sau ${delay}ms (lần ${attempt}/${MAX_RETRIES})`);
        await sleep(delay);
        continue;
      }

      // Với các lỗi khác, thất bại ngay lập tức
      throw error;
    }
  }

  console.error("❌ Lỗi OpenAI sau khi thử lại:", lastError.message);
  throw lastError;
}

async function callGoogleAI(question, apiKey, tone = "friendly", hasGeolocation = false, aiModel = null) {
  let lastError;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const systemPrompt = buildSystemPrompt(tone, hasGeolocation);
      const fullPrompt = `${systemPrompt}\n\nCâu hỏi: ${question}`;
      const model = aiModel || "gemini-2.0-flash"; // Mặc định là Gemini mới nhất

      // Endpoint API
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

      const response = await axios.post(
        endpoint,
        {
          contents: [
            {
              role: "user",
              parts: [
                { text: fullPrompt }
              ]
            }
          ],
          generationConfig: {
            temperature: 0.7,
            topP: 0.9,
            topK: 40,
            maxOutputTokens: 1000
          },
          safetySettings: [
            {
              category: "HARM_CATEGORY_HARASSMENT",
              threshold: "BLOCK_NONE"
            },
            {
              category: "HARM_CATEGORY_HATE_SPEECH",
              threshold: "BLOCK_NONE"
            },
            {
              category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
              threshold: "BLOCK_NONE"
            },
            {
              category: "HARM_CATEGORY_DANGEROUS_CONTENT",
              threshold: "BLOCK_NONE"
            }
          ]
        },
        {
          timeout: 15000,
          headers: {
            "Content-Type": "application/json"
          }
        }
      );

      // Kiểm tra nội dung bị chặn hoặc không có ứng viên
      if (!response.data.candidates || response.data.candidates.length === 0) {
        throw new Error("Không có phản hồi từ Gemini API (nội dung bị chặn hoặc không hợp lệ)");
      }

      const candidate = response.data.candidates[0];

      // Kiểm tra phản hồi bị chặn/lọc
      if (candidate.finishReason === "RECITATION" || candidate.finishReason === "SAFETY") {
        throw new Error(`Phản hồi bị chặn: ${candidate.finishReason}`);
      }

      // Xử lý trường hợp content.parts trống
      const content = candidate.content;
      if (!content || !content.parts || content.parts.length === 0) {
        // Fallback: kiểm tra xem có văn bản trong chính đối tượng content không
        if (content && content.text) {
          return content.text;
        }
        console.error("Phản hồi đầy đủ:", JSON.stringify(response.data));
        throw new Error(`Phản hồi không hợp lệ từ Gemini API - thiếu nội dung (finishReason: ${candidate.finishReason})`);
      }

      return content.parts[0].text;
    } catch (error) {
      lastError = error;

      // 429 = Giới hạn, 503 = Không khả dụng — thử lại với backoff
      if ((error.response?.status === 429 || error.response?.status === 503) && attempt < MAX_RETRIES) {
        const delay = INITIAL_DELAY * Math.pow(BACKOFF_MULTIPLIER, attempt - 1);
        console.warn(`⏳ Giới hạn/Không khả dụng. Thử lại sau ${delay}ms (lần ${attempt}/${MAX_RETRIES})`);
        await sleep(delay);
        continue;
      }

      // Log lỗi chi tiết
      console.error("❌ Lỗi Google AI:", error.message);
      if (error.response) {
        console.error("Trạng thái phản hồi:", error.response.status);
        console.error("Dữ liệu phản hồi:", JSON.stringify(error.response.data));
      }

      // Với các lỗi khác, thất bại ngay lập tức
      throw error;
    }
  }

  console.error("❌ Lỗi Google AI sau khi thử lại:", lastError.message);
  throw lastError;
}

// Tạo phản hồi mock giả lập cho thử nghiệm
function generateMockAIResponse(question) {
  try {
    const q = (question || '').toLowerCase();
    // Các quy tắc cơ bản để trả về gợi ý giả lập liên quan
    if (q.includes('nhiệt độ') || q.includes('temperature') || q.match(/\btemp\b/)) {
      return JSON.stringify({
        recommendations: [
          { title: 'Hạ nhiệt phòng', detail: 'Bật điều hòa ở 24°C, đóng cửa sổ để giảm nhiệt.', severity: 'warning' },
          { title: 'Uống nước', detail: 'Uống thêm nước để tránh mất nước khi nhiệt cao.', severity: 'info' }
        ]
      });
    }

    if (q.includes('độ ẩm') || q.includes('humidity')) {
      return JSON.stringify({
        recommendations: [
          { title: 'Giảm ẩm', detail: 'Bật máy hút ẩm 1 tiếng hoặc mở cửa sổ nếu an toàn.', severity: 'warning' },
          { title: 'Kiểm tra nguồn ẩm', detail: 'Kiểm tra máy giặt/nhà tắm để giảm nguồn ẩm dư thừa.', severity: 'info' }
        ]
      });
    }

    if (q.includes('pin') || q.includes('battery')) {
      return JSON.stringify({
        recommendations: [
          { title: 'Sạc pin', detail: 'Sạc thiết bị ngay để tránh gián đoạn.', severity: 'critical' },
          { title: 'Chế độ tiết kiệm', detail: 'Kích hoạt chế độ tiết kiệm năng lượng nếu có.', severity: 'warning' }
        ]
      });
    }

    // Fallback chung
    return JSON.stringify({
      recommendations: [
        { title: 'Kiểm tra môi trường', detail: 'Quan sát môi trường và kiểm tra các thiết bị liên quan.', severity: 'info' }
      ]
    });
  } catch (e) {
    return JSON.stringify({ recommendations: [] });
  }
}