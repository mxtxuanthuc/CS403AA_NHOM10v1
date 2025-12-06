// Quản lý cấu hình API và giao diện

// ===== HẰNG SỐ VÀ PHẦN TỬ DOM =====
const config = {
  modal: document.getElementById("modalConfig"),
  modalStats: document.getElementById("modalThongKe"),
  buttons: {
    config: document.getElementById("btnConfig"),
    thongKe: document.getElementById("btnThongKe"),
    luu: document.getElementById("btnLuu"),
    luuThresholds: document.getElementById("btnLuuThresholds"),
    huy: document.getElementById("btnHuy"),
    huyThresholds: document.getElementById("btnHuyThresholds")
  },
  closeButtons: {
    config: document.getElementById("closeConfig"),
    stats: document.getElementById("closeStats"),
    statsBtn: document.getElementById("closeStatsBtn")
  }
};

// ===== QUẢN LÝ MODAL =====
class ModalManager {
  static open(modal) {
    if (modal) {
      modal.classList.add('show');
      modal.style.display = 'flex';
    }
  }

  static close(modal) {
    if (modal) {
      modal.classList.remove('show');
      modal.style.display = 'none';
    }
  }

  static setup() {
    // Config Modal
    config.buttons.config?.addEventListener("click", () => {
      ModalManager.open(config.modal);
      loadApiConfig();
      loadThresholds();
    });

    config.buttons.thongKe?.addEventListener("click", () => {
      ModalManager.open(config.modalStats);
    });

    config.closeButtons.config?.addEventListener("click", () => {
      ModalManager.close(config.modal);
    });

    config.buttons.huy?.addEventListener("click", () => {
      ModalManager.close(config.modal);
    });

    config.buttons.huyThresholds?.addEventListener("click", () => {
      ModalManager.close(config.modal);
    });

    config.closeButtons.stats?.addEventListener("click", () => {
      ModalManager.close(config.modalStats);
    });

    config.closeButtons.statsBtn?.addEventListener("click", () => {
      ModalManager.close(config.modalStats);
    });

    // Đóng khi nhấp vào nền modal (ngoài modal-content)
    document.addEventListener("click", (e) => {
      // Kiểm tra xem phần tử nhấp có phải modal không
      let modal = null;

      // Nếu nhấp trực tiếp vào nền modal
      if (e.target.classList && e.target.classList.contains('modal')) {
        modal = e.target;
      }
      // Nếu nhấp vào trang nhưng không bên trong modal
      else {
        return;
      }

      // Lấy nội dung modal
      const modalContent = modal.querySelector('.modal-content');

      // Nếu click bên trong modal-content, không đóng
      if (modalContent && modalContent.contains(e.target)) {
        return;
      }

      // Nếu nhấp trực tiếp vào nền modal, đóng nó
      if (e.target === modal) {
        ModalManager.close(modal);
        console.log('🔒 Modal đã đóng');
      }
    }, true); // Sử dụng capture phase để bắt click sớm
  }
}

// ===== QUẢN LÝ TAB =====
class TabManager {
  static setup(tabButtonSelector, tabContentSelector) {
    const buttons = document.querySelectorAll(tabButtonSelector);
    const contents = document.querySelectorAll(tabContentSelector);

    buttons.forEach(btn => {
      btn.addEventListener("click", function() {
        const tabId = this.getAttribute("data-tab");

        // Vô hiệu hóa tất cả
        buttons.forEach(b => b.classList.remove("active"));
        contents.forEach(c => c.classList.remove("active"));

        // Kích hoạt được chọn
        this.classList.add("active");
        const tab = document.getElementById(tabId);
        if (tab) tab.classList.add("active");

        // Xử lý đặc biệt cho tab lịch sử cảnh báo
        if (tabId === "stats-history" && typeof alertHistoryManager !== "undefined") {
          alertHistoryManager.render();
        }
      });
    });
  }
}

// ===== HIỂN THỊ TIN NHẮN TRẠNG THÁI =====
function showConfigStatus(message, type = "info") {
  const statusEl = document.getElementById("apiStatus");
  if (!statusEl) return;

  statusEl.textContent = message;
  statusEl.className = `config-status-message ${type === "error" ? "error" : type === "success" ? "success" : ""}`;

  if (type === "success") {
    setTimeout(() => {
      statusEl.className = "config-status-message";
      statusEl.textContent = "";
    }, 3000);
  }
}

// ===== BẬT/TẮT HIỂN THỊ API KEY =====
function setupApiKeyToggle() {
  const toggleBtn = document.getElementById("btnToggleApiKey");
  const apiKeyInput = document.getElementById("apiKey");

  if (toggleBtn && apiKeyInput) {
    toggleBtn.addEventListener("click", function(e) {
      e.preventDefault();
      const isPassword = apiKeyInput.type === "password";
      apiKeyInput.type = isPassword ? "text" : "password";
      toggleBtn.textContent = isPassword ? "🙈" : "👁️";
    });
  }
}

// ===== TẢI CẤU HÌNH =====
async function loadApiConfig() {
  try {
    const res = await fetch("/api/config");
    const config = await res.json();

    // Ánh xạ cấu hình tới các trường biểu mẫu
    const fieldMap = {
      apiType: "apiType",
      aiModel: "aiModel",
      apiKey: "apiKey",
      weatherProvider: "weatherProvider",
      weatherApiKey: "weatherApiKey",
      weatherCity: "weatherCity",
      ttsProvider: "ttsProvider",
      ttsApiKey: "ttsApiKey",
      ttsLang: "ttsLang"
    };

    Object.entries(fieldMap).forEach(([configKey, elementId]) => {
      const element = document.getElementById(elementId);
      if (element && config[configKey]) {
        element.value = config[configKey];
      }
    });

    // Xử lý đặc biệt cho khoảng thời gian (chuyển đổi ms sang giây)
    const intervalEl = document.getElementById("weatherPollInterval");
    if (intervalEl && config.weatherPollInterval) {
      intervalEl.value = Math.floor(config.weatherPollInterval / 1000);
    }

    // Giá trị định vị địa lý
    if (config.weatherLat) document.getElementById("weatherLat").value = config.weatherLat;
    if (config.weatherLon) document.getElementById("weatherLon").value = config.weatherLon;

    // Cập nhật hiển thị vị trí trong header
    if (config.weatherLat && config.weatherLon) {
      const locSpan = document.getElementById("tsLocation");
      if (locSpan) {
        locSpan.textContent = `📍 Vị trí: ${config.weatherLat.toFixed(4)}, ${config.weatherLon.toFixed(4)}`;
      }
    }
    updateConfigButtonStatus(); // Cập nhật trạng thái nút sau khi tải cấu hình
  } catch (error) {
    console.error("Lỗi tải cấu hình:", error);
    showConfigStatus("⚠️ Lỗi tải cấu hình", "error");
    updateConfigButtonStatus(); // Update button status even on error
  }
}

// ===== TẢI NGƯỠNG CẢNH BÁO =====
async function loadThresholds() {
  try {
    const res = await fetch("/api/thresholds");
    const thresholds = await res.json();

    const thresholdMap = {
      tempMax: "tempMax",
      tempMin: "tempMin",
      humidityMax: "humidityMax",
      humidityMin: "humidityMin",
      batteryMin: "batteryMin"
    };

    Object.entries(thresholdMap).forEach(([elementId, key]) => {
      const element = document.getElementById(elementId);
      if (element && thresholds[key] !== undefined) {
        element.value = thresholds[key];
      }
    });
  } catch (error) {
    console.error("Lỗi tải ngưỡng cảnh báo:", error);
  }
}

// ===== LƯU CẤU HÌNH =====
async function saveApiConfig() {
  try {
    const aiModel = document.getElementById("aiModel")?.value || "";
    const apiKey = document.getElementById("apiKey")?.value || "";

    // Tự động phát hiện loại API dựa trên mô hình
    let apiType = "local";
    if (aiModel.startsWith("gpt-")) {
      apiType = "openai";
    } else if (aiModel.startsWith("gemini-")) {
      apiType = "google";
    }

    // Xác thực API key nếu cần
    if (apiType !== "local" && !apiKey) {
      showConfigStatus("❌ Vui lòng nhập API Key", "error");
      return;
    }

    // Chuẩn bị payload
    const payload = {
      apiType,
      apiKey: apiKey || undefined,
      aiModel: aiModel || undefined,
      aiTone: document.getElementById("aiTone")?.value || "friendly",
      weatherProvider: document.getElementById("weatherProvider")?.value || undefined,
      weatherApiKey: document.getElementById("weatherApiKey")?.value || undefined,
      weatherCity: document.getElementById("weatherCity")?.value || undefined,
      weatherPollInterval: (parseInt(document.getElementById("weatherPollInterval")?.value || "60") * 1000),
      ttsProvider: document.getElementById("ttsProvider")?.value || undefined,
      ttsApiKey: document.getElementById("ttsApiKey")?.value || undefined,
      ttsLang: document.getElementById("ttsLang")?.value || "vi-VN",
      weatherLat: parseFloat(document.getElementById("weatherLat")?.value || "0") || undefined,
      weatherLon: parseFloat(document.getElementById("weatherLon")?.value || "0") || undefined
    };

    // Gửi tới máy chủ
    const res = await fetch("/api/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const result = await res.json();

    if (result.success) {
      showConfigStatus("✅ Cấu hình đã được lưu thành công", "success");
      updateConfigButtonStatus(); // Cập nhật trạng thái nút sau khi lưu
      setTimeout(() => {
        ModalManager.close(config.modal);
        document.getElementById("apiKey").value = "";
      }, 1500);
    } else {
      showConfigStatus(`❌ ${result.message || "Lỗi lưu cấu hình"}`, "error");
    }
  } catch (error) {
    console.error("Lỗi lưu cấu hình:", error);
    showConfigStatus("❌ Lỗi lưu cấu hình", "error");
  }
}

// ===== LƯU NGƯỠNG CẢNH BÁO =====
async function saveThresholds() {
  try {
    const thresholds = {
      tempMax: parseFloat(document.getElementById("tempMax")?.value || "30"),
      tempMin: parseFloat(document.getElementById("tempMin")?.value || "15"),
      humidityMax: parseFloat(document.getElementById("humidityMax")?.value || "90"),
      humidityMin: parseFloat(document.getElementById("humidityMin")?.value || "30"),
      batteryMin: parseFloat(document.getElementById("batteryMin")?.value || "20")
    };

    // Xác thực giá trị
    if (thresholds.tempMin >= thresholds.tempMax) {
      showThresholdStatus("❌ Nhiệt độ tối thiểu phải nhỏ hơn tối đa", "error");
      return;
    }

    if (thresholds.humidityMin >= thresholds.humidityMax) {
      showThresholdStatus("❌ Độ ẩm tối thiểu phải nhỏ hơn tối đa", "error");
      return;
    }

    const res = await fetch("/api/thresholds", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(thresholds)
    });

    const result = await res.json();

    if (result.success) {
      showThresholdStatus("✅ Ngưỡng cảnh báo đã được lưu thành công", "success");
      setTimeout(() => {
        ModalManager.close(config.modal);
      }, 1500);
    } else {
      showThresholdStatus(`❌ ${result.message || "Lỗi lưu ngưỡng"}`, "error");
    }
  } catch (error) {
    console.error("Lỗi lưu ngưỡng cảnh báo:", error);
    showThresholdStatus("❌ Lỗi lưu ngưỡng cảnh báo", "error");
  }
}

// ===== TIN NHẮN TRẠNG THÁI NGƯỠNG =====
function showThresholdStatus(message, type = "info") {
  const statusEl = document.getElementById("thresholdStatus");
  if (!statusEl) return;

  statusEl.textContent = message;
  statusEl.className = `config-status-message ${type === "error" ? "error" : type === "success" ? "success" : ""}`;

  if (type === "success") {
    setTimeout(() => {
      statusEl.className = "config-status-message";
      statusEl.textContent = "";
    }, 3000);
  }
}

// ===== ĐỊNH VỊ ĐỊA LÝ =====
// Xử lý định vị địa lý hiện được quản lý trong geolocation-handler.js
// Hàm này được giữ lại để tương thích ngược
async function requestGeolocation() {
  // Ủy quyền cho trình xử lý định vị địa lý toàn cầu
  if (window.geolocationHandler) {
    window.geolocationHandler.requestGeolocation();
  } else {
    console.warn("GeolocationHandler chưa được khởi tạo");
  }
}

let isApplyingGeolocationUpdate = false;

async function resetSystemToDefaults() {
  const res = await fetch("/api/system-reset", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ confirmReset: true })
  });

  const result = await res.json();
  if (!result.success) {
    throw new Error(result.message || "Không thể reset hệ thống");
  }

  return result;
}

async function updateSystemWeatherForCoords(lat, lon) {
  const latNum = parseFloat(lat);
  const lonNum = parseFloat(lon);

  if (Number.isNaN(latNum) || Number.isNaN(lonNum)) {
    throw new Error("Tọa độ không hợp lệ");
  }

  const ensureLocationManager = () => {
    if (typeof initLocationManager === "function") {
      return initLocationManager();
    }
    return window.locationManager || null;
  };

  const manager = ensureLocationManager();

  if (manager) {
    if (!manager.config && typeof manager.loadConfig === "function") {
      await manager.loadConfig();
    }

    manager.userLocation = {
      city: manager.userLocation?.city || "Vị trí thực tế",
      lat: latNum,
      lon: lonNum,
      display: `📍 ${latNum.toFixed(4)}, ${lonNum.toFixed(4)}`
    };
    manager.locationType = "user";

    await manager.updateWeatherAndNotify(latNum, lonNum);
  } else {
    const res = await fetch("/api/config/location", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ weatherLat: latNum, weatherLon: lonNum })
    });
    const result = await res.json();
    if (!result.success) {
      throw new Error(result.message || "Không thể lưu tọa độ mới");
    }
  }
}

window.onGeolocationSuccess = async (lat, lon) => {
  if (isApplyingGeolocationUpdate) {
    console.log("⏳ Đang cập nhật định vị địa lý, bỏ qua trùng lặp");
    return;
  }

  isApplyingGeolocationUpdate = true;
  showConfigStatus("🔄 Đã lấy tọa độ, đang reset hệ thống...", "info");

  try {
    await resetSystemToDefaults();
    showConfigStatus("🔄 Đang cập nhật thời tiết theo vị trí mới...", "info");
    await updateSystemWeatherForCoords(lat, lon);
    showConfigStatus("✅ Đã reset và đồng bộ thời tiết theo vị trí mới", "success");
    if (window.showToast) {
      window.showToast("✅ Đã cập nhật thời tiết theo vị trí hiện tại", "success");
    }
  } catch (error) {
    console.error("❌ Lỗi đồng bộ định vị địa lý:", error);
    showConfigStatus(`❌ ${error.message || "Không thể cập nhật vị trí"}`, "error");
  } finally {
    isApplyingGeolocationUpdate = false;
  }
};

window.onGeolocationError = (code, error) => {
  console.warn("⚠️ Lỗi định vị địa lý", code, error);
  showConfigStatus("⚠️ Không thể cập nhật vị trí mới", "warning");
};

// ===== CẬP NHẬT TRẠNG THÁI NÚT CẤU HÌNH =====
async function updateConfigButtonStatus() {
  const btnConfig = document.getElementById("btnConfig");
  if (!btnConfig) return;

  try {
    const res = await fetch("/api/config");
    const currentConfig = await res.json();

    let isAiConfigured = false;
    if (currentConfig.apiType !== "local" && currentConfig.apiKey) {
      isAiConfigured = true;
    }

    let isWeatherConfigured = false;
    if (currentConfig.weatherProvider && currentConfig.weatherApiKey) {
      isWeatherConfigured = true;
    }

    btnConfig.classList.remove("config-status-ok", "config-status-warning", "config-status-error");

    if (isAiConfigured && isWeatherConfigured) {
      btnConfig.classList.add("config-status-ok");
      btnConfig.title = "Cấu hình AI và Thời tiết đã sẵn sàng";
    } else if (isAiConfigured || isWeatherConfigured) {
      btnConfig.classList.add("config-status-warning");
      btnConfig.title = "Cấu hình AI hoặc Thời tiết chưa hoàn chỉnh";
    } else {
      btnConfig.classList.add("config-status-error");
      btnConfig.title = "Cấu hình AI và Thời tiết chưa được thiết lập";
    }
  } catch (error) {
    console.error("Lỗi cập nhật trạng thái nút cấu hình:", error);
    btnConfig.classList.remove("config-status-ok", "config-status-warning");
    btnConfig.classList.add("config-status-error");
    btnConfig.title = "Không thể kiểm tra trạng thái cấu hình";
  }
}

// ===== KHỞI TẠO =====
document.addEventListener("DOMContentLoaded", function() {
  // Thiết lập modal
  ModalManager.setup();

  // Thiết lập tab
  TabManager.setup(".config-tab-btn", ".config-tab-content");
  TabManager.setup(".stats-tab-btn", ".stats-tab-content");

  // Thiết lập bật/tắt hiển thị API key
  setupApiKeyToggle();

  // Thiết lập nút lưu
  config.buttons.luu?.addEventListener("click", saveApiConfig);
  config.buttons.luuThresholds?.addEventListener("click", saveThresholds);

  // Lưu ý: trình xử lý btnGeolocate hiện được quản lý bởi geolocation-handler.js
  // Điều này cung cấp trình xử lý định vị địa lý toàn cầu thống nhất cho tất cả trang

  // Cập nhật ban đầu trạng thái nút cấu hình
  updateConfigButtonStatus();

  console.log("✅ Module cấu hình đã được khởi tạo");
});