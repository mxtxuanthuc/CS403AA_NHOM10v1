// --- LOGIC TRANG CHỦ (INDEX.HTML) ---
// File này liên kết tất cả các module và xử lý khởi tạo cho trang chính (Dashboard Nhiệt độ).

document.addEventListener('DOMContentLoaded', () => {
  // Khởi tạo biểu đồ chính
  window.bieuDoNhietDo = taoBieuDo("bieuDoNhietDo", "Nhiệt độ (°C)", "#ff6b6b");
  window.bieuDoDoAm = taoBieuDo("bieuDoDoAm", "Độ ẩm (%)", "#4ecdc4");

  // Tải ngưỡng cảnh báo từ server ngay khi DOM sẵn sàng
  if (window.thresholdAlertSystem) {
    window.thresholdAlertSystem.loadThresholdsFromServer();
  }

  // Khởi tạo biểu đồ dự báo 24 giờ và tích hợp cập nhật Socket.io
  if (typeof initializeForecastChart === 'function') {
    console.log('🌡️ Đang khởi tạo biểu đồ dự báo nhiệt độ 24 giờ...');
    window.bieuDoDuBao = initializeForecastChart('bieuDoDuBaoNhietDo', socket);
  } else {
    console.warn('⚠️ initializeForecastChart không khả dụng, dùng biểu đồ cơ bản.');
    window.bieuDoDuBao = taoBieuDo("bieuDoDuBaoNhietDo", "Dự báo (°C)", "#ffa502");
  }

  // Khởi tạo Lịch sử Cảnh báo (Alert History Manager)
  if (typeof AlertHistoryManager !== 'undefined') {
    window.alertHistoryManager = new AlertHistoryManager();
    window.alertHistoryManager.initialize();
    console.log('✅ Alert History Manager đã khởi tạo');
  } else {
    console.warn('⚠️ AlertHistoryManager chưa được tải');
  }

  // Thiết lập cập nhật thời gian thực qua Socket.io
  if (socket && typeof socket.on === 'function') {
    // Cập nhật dự báo khi có dữ liệu cảm biến mới
    socket.on('capNhat', async (data) => {
      if (data && data.dulieu) {
        console.log('📡 Nhận dữ liệu cảm biến mới, đang cập nhật biểu đồ dự báo...');
        // Làm mới biểu đồ dự báo
        if (typeof loadForecastData === 'function' && window.bieuDoDuBao) {
          await loadForecastData(window.bieuDoDuBao).catch(e => {
            console.warn('⚠️ Cập nhật biểu đồ dự báo thất bại:', e.message);
          });
          // Log thống kê sau khi cập nhật
          if (typeof logForecastStats === 'function') {
            logForecastStats();
          }
        }
      }
    });

    // Lắng nghe cập nhật thống kê (dữ liệu tổng hợp theo giờ)
    socket.on('statsUpdate', (statsData) => {
      if (statsData && statsData.data && Array.isArray(statsData.data)) {
        console.log(`📊 Stats cập nhật: ${statsData.data.length} điểm dữ liệu theo giờ`);
        if (typeof updateForecastChart === 'function' && window.bieuDoDuBao) {
          updateForecastChart(window.bieuDoDuBao, statsData.data);
        }
      }
    });
  }

  // Nút làm mới dự báo
  const btnDuBaoRefresh = document.getElementById("btnDuBaoRefresh");
  if (btnDuBaoRefresh) {
    btnDuBaoRefresh.addEventListener('click', async () => {
      // Hàm giả định: Tắt nút Header
      if (typeof disableHeaderButtons === 'function') disableHeaderButtons(btnDuBaoRefresh);
      try {
        console.log('🔄 Kích hoạt làm mới dự báo thủ công...');
        if (typeof refreshForecastData === 'function') {
          await refreshForecastData();
        } else if (typeof loadForecastData === 'function' && window.bieuDoDuBao) {
          await loadForecastData(window.bieuDoDuBao);
        } else {
          socket.emit("layDuBao");
        }
      } finally {
        // Hàm giả định: Bật lại nút Header
        if (typeof enableHeaderButtons === 'function') enableHeaderButtons();
      }
    });
  }

  // Nút cập nhật dữ liệu thủ công
  const btnUpdateData = document.getElementById("btnUpdateData");
  if (btnUpdateData) {
    btnUpdateData.addEventListener('click', async () => {
      // Hàm giả định: Tắt nút Header
      if (typeof disableHeaderButtons === 'function') disableHeaderButtons(btnUpdateData);
      try {
        console.log('🔄 Kích hoạt cập nhật dữ liệu thủ công...');
        socket.emit('requestInitialWeather');
        const res = await fetch('/api/data/latest');
        if (res.ok) {
          const latest = await res.json();
          if (latest && latest.thoigian) {
            // Hàm giả định: Cập nhật thông số hiển thị
            if (typeof capNhatThongSo === 'function') capNhatThongSo(latest);
            // Hàm giả định: Thêm dữ liệu vào biểu đồ
            if (typeof themDuLieu === 'function') {
              themDuLieu(bieuDoNhietDo, latest.thoigian, latest.nhietDo);
              themDuLieu(bieuDoDoAm, latest.thoigian, latest.doAm);
            }
            
            if (typeof onSensorDataUpdate === 'function') {
              onSensorDataUpdate(latest);
            }

            // Làm mới biểu đồ dự báo
            if (typeof loadForecastData === 'function' && window.bieuDoDuBao) {
              await loadForecastData(window.bieuDoDuBao);
            }
          }
        }
        socket.emit('layThongKe');
      } catch (e) {
        console.error('❌ Cập nhật thất bại:', e);
      } finally {
        // Hàm giả định: Bật lại nút Header
        if (typeof enableHeaderButtons === 'function') enableHeaderButtons();
      }
    });
  }

  // Khởi tạo các chức năng cấu hình
  if (typeof initializeConfigModalV2Tabs === 'function') initializeConfigModalV2Tabs();
  initializeConfigFeatures();
  initializeDarkMode();

  console.log('✅ Khởi tạo trang chính hoàn tất');
});

// Khởi tạo chức năng Dark Mode
function initializeDarkMode() {
  const darkModeToggle = document.getElementById('darkMode');
  if (!darkModeToggle) {
    console.warn('⚠️ Không tìm thấy nút chuyển Dark mode');
    return;
  }

  // Tải tùy chọn Dark mode đã lưu
  const savedDarkMode = localStorage.getItem('darkMode') === 'true';
  console.log('🌙 Đang tải tùy chọn dark mode từ localStorage:', savedDarkMode);

  if (savedDarkMode) {
    darkModeToggle.checked = true;
    document.body.classList.add('dark-mode');
    console.log('🌙 Áp dụng Dark mode khi tải');
  } else {
    darkModeToggle.checked = false;
    document.body.classList.remove('dark-mode');
    console.log('☀️ Áp dụng Light mode khi tải');
  }

  // Lắng nghe sự kiện chuyển đổi
  darkModeToggle.addEventListener('change', (e) => {
    const isDarkMode = e.target.checked;
    console.log('🔄 Thay đổi chế độ Dark mode:', isDarkMode);

    if (isDarkMode) {
      document.body.classList.add('dark-mode');
      localStorage.setItem('darkMode', 'true');
      console.log('🌙 Dark mode ĐÃ BẬT');
    } else {
      document.body.classList.remove('dark-mode');
      localStorage.setItem('darkMode', 'false');
      console.log('☀️ Light mode ĐÃ BẬT');
    }
  });

  console.log('✅ Listener Dark mode đã khởi tạo');
}

// Khởi tạo các nút chức năng và handlers của cấu hình
function initializeConfigFeatures() {
  // Nút chuyển đổi ẩn/hiện API Key
  const apiKeyToggleBtn = document.querySelector('.input-with-icon .btn-icon-small');
  if (apiKeyToggleBtn) {
    apiKeyToggleBtn.addEventListener('click', (e) => {
      e.preventDefault();
      const apiKeyInput = document.getElementById('apiKey');
      if (apiKeyInput) {
        const isPassword = apiKeyInput.type === 'password';
        apiKeyInput.type = isPassword ? 'text' : 'password';
        apiKeyToggleBtn.textContent = isPassword ? '🙈' : '👁️';
      }
    });
  }

  // Nút Test AI
  const btnTestAI = document.getElementById('btnTestAI');
  if (btnTestAI) {
    btnTestAI.addEventListener('click', async (e) => {
      e.preventDefault();
      if (typeof testAIConnection === 'function') await testAIConnection();
    });
  }

  // Nút Định vị (Geolocation)
  const btnGeolocate = document.getElementById('btnGeolocate');
  if (btnGeolocate) {
    btnGeolocate.addEventListener('click', (e) => {
      e.preventDefault();
      if (typeof requestGeolocation === 'function') requestGeolocation();
    });
  }

  // Nút Test Thời tiết
  const btnTestWeather = document.getElementById('btnTestWeather');
  if (btnTestWeather) {
    btnTestWeather.addEventListener('click', async (e) => {
      e.preventDefault();
      if (typeof testWeatherConnection === 'function') await testWeatherConnection();
    });
  }

  // Nút Test TTS (Text-to-Speech)
  const btnTestTTS = document.getElementById('btnTestTTS');
  if (btnTestTTS) {
    btnTestTTS.addEventListener('click', async (e) => {
      e.preventDefault();
      if (typeof testTTSConnection === 'function') await testTTSConnection();
    });
  }

  // Nút Reset về mặc định
  const btnResetDefaults = document.getElementById('btnResetDefaults');
  if (btnResetDefaults) {
    btnResetDefaults.addEventListener('click', (e) => {
      e.preventDefault();
      resetToDefaults();
    });
  }

  // Nút mở modal cấu hình - tải ngưỡng khi mở
  const btnConfig = document.getElementById('btnConfig');
  if (btnConfig) {
    btnConfig.addEventListener('click', () => {
      loadCurrentThresholds();
      loadCurrentSettings();
      openConfigModalV2();
    });
  }

  console.log('✅ Các tính năng cấu hình đã khởi tạo');
}

// Mở modal cấu hình v2
function openConfigModalV2() {
  const modal = document.getElementById('modalConfig');
  if (modal) {
    modal.classList.add('show');
    modal.style.display = 'flex';
    console.log('✅ Modal cấu hình v2 đã mở');
  }
}

// Tải ngưỡng hiện tại vào form
function loadCurrentThresholds() {
  try {
    let thresholds = null;

    // Lấy từ localStorage
    const saved = localStorage.getItem('thresholds') || localStorage.getItem('thresholdSettings');
    if (saved) {
      thresholds = JSON.parse(saved);
    }

    // Lấy từ ThresholdAlertSystem
    if (!thresholds && window.thresholdAlertSystem) {
      thresholds = window.thresholdAlertSystem.getThresholds();
    }

    // Giá trị mặc định nếu không tìm thấy
    if (!thresholds) {
      thresholds = {
        tempMax: 30,
        tempMin: 15,
        humidityMax: 80,
        humidityMin: 30,
        batteryMin: 20
      };
    }

    // Cập nhật các trường form
    const tempMaxInput = document.getElementById('tempMax');
    const tempMinInput = document.getElementById('tempMin');
    const humidityMaxInput = document.getElementById('humidityMax');
    const humidityMinInput = document.getElementById('humidityMin');
    const batteryMinInput = document.getElementById('batteryMin');

    if (tempMaxInput) tempMaxInput.value = thresholds.tempMax || 30;
    if (tempMinInput) tempMinInput.value = thresholds.tempMin || 15;
    if (humidityMaxInput) humidityMaxInput.value = thresholds.humidityMax || 80;
    if (humidityMinInput) humidityMinInput.value = thresholds.humidityMin || 30;
    if (batteryMinInput) batteryMinInput.value = thresholds.batteryMin || 20;

    console.log('✅ Ngưỡng đã tải vào form:', thresholds);
  } catch (e) {
    console.error('❌ Lỗi tải ngưỡng:', e);
  }
}

// Cập nhật trạng thái thông báo trong tab Cấu hình
function updateNotificationStatusDisplay() {
  try {
    const statusAlerts = document.getElementById('statusAlerts');
    const statusSound = document.getElementById('statusSound');
    const statusToasts = document.getElementById('statusToasts');

    if (window.alertManager) {
      if (statusAlerts) {
        statusAlerts.textContent = window.alertManager.isAlertsEnabled ? '✅ Bật' : '❌ Tắt';
      }
      if (statusSound) {
        statusSound.textContent = window.alertManager.soundEnabled ? '✅ Bật' : '❌ Tắt';
      }
      if (statusToasts) {
        statusToasts.textContent = window.alertManager.toastsEnabled ? '✅ Bật' : '❌ Tắt';
      }
    } else {
      // Dùng giá trị fallback từ form
      const enableAlerts = document.getElementById('enableAlerts');
      const enableSound = document.getElementById('enableSound');
      const enableToast = document.getElementById('enableToasts');

      if (statusAlerts && enableAlerts) {
        statusAlerts.textContent = enableAlerts.checked ? '✅ Bật' : '❌ Tắt';
      }
      if (statusSound && enableSound) {
        statusSound.textContent = enableSound.checked ? '✅ Bật' : '❌ Tắt';
      }
      if (statusToasts && enableToast) {
        statusToasts.textContent = enableToast.checked ? '✅ Bật' : '❌ Tắt';
      }
    }

    console.log('📊 Trạng thái thông báo đã được cập nhật');
  } catch (e) {
    console.error('Lỗi cập nhật trạng thái thông báo:', e);
  }
}

// Tải cài đặt hiện tại vào form
function loadCurrentSettings() {
  try {
    // Tải cài đặt chung
    const generalSettings = JSON.parse(localStorage.getItem('generalSettings') || '{}');

    const language = document.getElementById('language');
    const theme = document.getElementById('theme');
    const darkMode = document.getElementById('darkMode');

    if (language) language.value = generalSettings.language || 'vi';
    if (theme) theme.value = generalSettings.theme || 'light';
    if (darkMode) darkMode.checked = generalSettings.darkMode || localStorage.getItem('darkMode') === 'true';

    // Tải cài đặt thông báo (từ LocalStorage và AlertManager)
    const notificationSettings = JSON.parse(localStorage.getItem('notificationSettings') || '{}');

    const enableSound = document.getElementById('enableSound');
    const enableToast = document.getElementById('enableToasts');
    const enableAlerts = document.getElementById('enableAlerts');
    const soundVolume = document.getElementById('soundVolume');

    // Lấy trạng thái thời gian thực từ AlertManager
    if (window.alertManager) {
      if (enableSound) enableSound.checked = window.alertManager.soundEnabled;
      if (enableToast) enableToast.checked = window.alertManager.toastsEnabled;
      if (enableAlerts) enableAlerts.checked = window.alertManager.isAlertsEnabled;
    } else {
      // Fallback LocalStorage
      if (enableSound) enableSound.checked = notificationSettings.enableSound !== false;
      if (enableToast) enableToast.checked = notificationSettings.enableToasts !== false;
      if (enableAlerts) enableAlerts.checked = notificationSettings.enableAlerts !== false;
    }

    if (soundVolume) soundVolume.value = notificationSettings.soundVolume || 0.5;

    // Thiết lập listeners cho form để đồng bộ với AlertManager
    if (enableAlerts) {
      enableAlerts.addEventListener('change', (e) => {
        if (window.alertManager) {
          if (e.target.checked !== window.alertManager.isAlertsEnabled) {
            window.alertManager.toggleAlerts();
          }
        }
      });
    }

    if (enableSound) {
      enableSound.addEventListener('change', (e) => {
        if (window.alertManager) {
          if (e.target.checked !== window.alertManager.soundEnabled) {
            window.alertManager.toggleSound();
          }
        }
      });
    }

    if (enableToast) {
      enableToast.addEventListener('change', (e) => {
        if (window.alertManager) {
          if (e.target.checked !== window.alertManager.toastsEnabled) {
            window.alertManager.toggleToasts();
          }
        }
        // Cập nhật hiển thị trạng thái
        updateNotificationStatusDisplay();
        console.log('📝 Chuyển đổi Toast, trạng thái đã cập nhật');
      });
    }

    // Cập nhật trạng thái hiển thị ban đầu
    updateNotificationStatusDisplay();

    // Lắng nghe thay đổi AlertManager và cập nhật hiển thị
    window.addEventListener('alertStateChanged', () => {
      console.log('🔄 Trạng thái cảnh báo thay đổi, đang cập nhật hiển thị');
      updateNotificationStatusDisplay();
    });

    console.log('✅ Cài đặt đã tải vào form:', { generalSettings, notificationSettings });
  } catch (e) {
    console.error('❌ Lỗi tải cài đặt:', e);
  }
}

// Test kết nối AI
async function testAIConnection() {
  const apiType = document.getElementById('apiType')?.value;
  const aiModel = document.getElementById('aiModel')?.value;
  const apiKey = document.getElementById('apiKey')?.value;

  if (!apiType || apiType === 'local') {
    showConfigStatus('ℹ️ Đang sử dụng chế độ local, không cần kết nối API', 'info');
    return;
  }

  if (!aiModel) {
    showConfigStatus('❌ Vui lòng chọn mô hình AI', 'error');
    return;
  }

  if (!apiKey) {
    showConfigStatus('❌ Vui lòng nhập API Key', 'error');
    return;
  }

  try {
    showConfigStatus('🔄 Đang kiểm tra kết nối AI...', 'info');

    const response = await fetch('/api/test-ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        apiType,
        aiModel,
        apiKey
      })
    });

    const result = await response.json();

    if (result.success) {
      showConfigStatus('✅ Kết nối AI thành công! ' + (result.message || ''), 'success');
    } else {
      showConfigStatus('❌ ' + (result.message || 'Không thể kết nối với AI API'), 'error');
    }
  } catch (error) {
    console.error('Lỗi kiểm tra AI:', error);
    showConfigStatus('❌ Lỗi kiểm tra kết nối: ' + error.message, 'error');
  }
}

// Yêu cầu định vị (Geolocation)
function requestGeolocation() {
  if (!navigator.geolocation) {
    showConfigStatus('❌ Trình duyệt không hỗ trợ định vị', 'error');
    return;
  }

  showConfigStatus('🔄 Đang xác định vị trí...', 'info');

  navigator.geolocation.getCurrentPosition(
    (position) => {
      const lat = position.coords.latitude;
      const lon = position.coords.longitude;

      // Cập nhật vào trường form
      document.getElementById('weatherLat').value = lat;
      document.getElementById('weatherLon').value = lon;

      showConfigStatus(`✅ Vị trí: ${lat.toFixed(4)}, ${lon.toFixed(4)}`, 'success');
      console.log('📍 Geolocation:', { lat, lon });
    },
    (error) => {
      showConfigStatus(`❌ Lỗi xác định vị trí: ${error.message}`, 'error');
      console.error('Lỗi Geolocation:', error);
    }
  );
}

// Test kết nối thời tiết
async function testWeatherConnection() {
  const weatherProvider = document.getElementById('weatherProvider')?.value;
  const weatherApiKey = document.getElementById('weatherApiKey')?.value;
  const weatherCity = document.getElementById('weatherCity')?.value;
  const weatherLat = document.getElementById('weatherLat')?.value;
  const weatherLon = document.getElementById('weatherLon')?.value;

  if (!weatherProvider) {
    showConfigStatus('❌ Vui lòng chọn nhà cung cấp thời tiết', 'error');
    return;
  }

  if (!weatherApiKey) {
    showConfigStatus('❌ Vui lòng nhập API Key', 'error');
    return;
  }

  if (!weatherCity && (!weatherLat || !weatherLon)) {
    showConfigStatus('❌ Vui lòng nhập thành phố hoặc vị trí', 'error');
    return;
  }

  try {
    showConfigStatus('🔄 Đang kiểm tra kết nối thời tiết...', 'info');

    const response = await fetch('/api/test-weather', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider: weatherProvider,
        apiKey: weatherApiKey,
        city: weatherCity || `${weatherLat},${weatherLon}`
      })
    });

    const result = await response.json();

    if (result.success) {
      showConfigStatus('✅ Kết nối thời tiết thành công! Temp: ' + result.data?.temp + '°C', 'success');
    } else {
      showConfigStatus('❌ ' + (result.message || 'Không thể kết nối với API thời tiết'), 'error');
    }
  } catch (error) {
    console.error('Lỗi kiểm tra thời tiết:', error);
    showConfigStatus('❌ Lỗi kiểm tra: ' + error.message, 'error');
  }
}

// Test kết nối TTS
async function testTTSConnection() {
  const ttsProvider = document.getElementById('ttsProvider')?.value;
  const ttsApiKey = document.getElementById('ttsApiKey')?.value;
  const ttsLang = document.getElementById('ttsLang')?.value || 'vi-VN';

  if (!ttsProvider) {
    showConfigStatus('❌ Vui lòng chọn nhà cung cấp TTS', 'error');
    return;
  }

  if (!ttsApiKey) {
    showConfigStatus('❌ Vui lòng nhập API Key', 'error');
    return;
  }

  try {
    showConfigStatus('🔄 Đang kiểm tra TTS...', 'info');

    const response = await fetch('/api/test-tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider: ttsProvider,
        apiKey: ttsApiKey,
        lang: ttsLang,
        text: 'Xin chào, đây là kiểm tra Text to Speech'
      })
    });

    const result = await response.json();

    if (result.success) {
      showConfigStatus('✅ TTS hoạt động thành công!', 'success');
    } else {
      showConfigStatus('❌ ' + (result.message || 'Không thể kết nối với TTS API'), 'error');
    }
  } catch (error) {
    console.error('Lỗi kiểm tra TTS:', error);
    showConfigStatus('❌ Lỗi kiểm tra: ' + error.message, 'error');
  }
}

// Hiển thị thông báo trạng thái cấu hình
function showConfigStatus(message, type = 'info') {
  const statusDiv = document.getElementById('configStatus');
  if (!statusDiv) return;

  statusDiv.textContent = message;
  statusDiv.className = `config-status-v2 show ${type}`;

  if (type === 'success' || type === 'info') {
    setTimeout(() => {
      statusDiv.classList.remove('show');
    }, 4000);
  }
}

// Khởi tạo chuyển đổi Tab cho Modal cấu hình v2
function initializeConfigModalV2Tabs() {
  const tabs = document.querySelectorAll('.config-tab-v2');
  const panes = document.querySelectorAll('.config-tab-pane');
  const closeBtn = document.getElementById('closeConfig');
  const saveBtns = document.querySelectorAll('#btnLuu');
  const cancelBtns = document.querySelectorAll('#btnHuy');
  const modal = document.getElementById('modalConfig');
  const modalContent = document.querySelector('.config-modal-v2');

  if (tabs.length === 0) {
    console.warn('⚠️ Không tìm thấy tab cấu hình v2');
    return;
  }

  // Chặn lan truyền sự kiện khi click vào nội dung Modal
  if (modalContent) {
    modalContent.addEventListener('click', (e) => {
      e.stopPropagation();
    });
  }

  // Chặn đóng Modal khi click ra ngoài Overlay
  if (modal) {
    modal.addEventListener('click', (e) => {
      // Chặn đóng
      if (e.target === modal) {
        e.stopPropagation();
        console.log('🔒 Click ngoài modal bị chặn - phải dùng nút đóng/hủy');
      }
    });
  }

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const targetTab = tab.getAttribute('data-tab');
      if (!targetTab) return;

      // Xóa active khỏi tất cả tabs và panes
      tabs.forEach(t => t.classList.remove('active'));
      panes.forEach(p => p.classList.remove('active'));

      // Thêm active vào tab đã click
      tab.classList.add('active');

      // Thêm active vào pane tương ứng
      const targetPane = document.getElementById(`${targetTab}-tab`);
      if (targetPane) {
        targetPane.classList.add('active');
        console.log(`📑 Chuyển đổi tab cấu hình sang: ${targetTab}`);
      }
    });
  });

  // Handler nút Đóng
  if (closeBtn) {
    closeBtn.addEventListener('click', (e) => {
      e.preventDefault();
      closeConfigModalV2();
    });
  }

  // Handler nút Lưu
  saveBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      saveConfigModalV2Settings();
    });
  });

  // Handler nút Hủy
  cancelBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      closeConfigModalV2();
    });
  });

  // Khởi tạo các công tắc và thanh trượt
  initializeToggleSwitches();
  initializeThresholdSliders();

  console.log('✅ Tab Modal cấu hình v2 đã khởi tạo');
}

// Đóng modal cấu hình v2
function closeConfigModalV2() {
  const modal = document.getElementById('modalConfig');
  if (modal) {
    modal.classList.remove('show');
    modal.style.display = 'none';
    console.log('❌ Modal cấu hình v2 đã đóng');
  }
}

// Lưu cài đặt của Modal cấu hình v2
function saveConfigModalV2Settings() {
  // Thu thập dữ liệu form
  const generalSettings = {
    darkMode: document.getElementById('darkMode')?.checked || false,
    language: document.getElementById('language')?.value || 'vi',
    theme: document.getElementById('theme')?.value || 'light'
  };

  const aiSettings = {
    apiType: document.getElementById('apiType')?.value || 'local',
    aiModel: document.getElementById('aiModel')?.value || '',
    apiKey: document.getElementById('apiKey')?.value || ''
  };

  const weatherSettings = {
    weatherProvider: document.getElementById('weatherProvider')?.value || '',
    weatherApiKey: document.getElementById('weatherApiKey')?.value || '',
    weatherCity: document.getElementById('weatherCity')?.value || '',
    weatherPollInterval: parseInt(document.getElementById('weatherPollInterval')?.value || '60') * 1000,
    weatherLat: parseFloat(document.getElementById('weatherLat')?.value || '0') || 0,
    weatherLon: parseFloat(document.getElementById('weatherLon')?.value || '0') || 0
  };

  const notificationSettings = {
    enableSound: document.getElementById('enableSound')?.checked || true,
    enableToasts: document.getElementById('enableToasts')?.checked || true,
    enableAlerts: document.getElementById('enableAlerts')?.checked || true,
    soundVolume: parseFloat(document.getElementById('soundVolume')?.value || '0.5')
  };

  // Thu thập ngưỡng cảnh báo theo trang
  let thresholdSettings = {};
  let pageType = 'main'; // mặc định

  // Xác định trang hiện tại để thu thập ngưỡng phù hợp
  if (window.location.pathname.includes('/pages/forecast')) {
    pageType = 'forecast';
    // Ngưỡng trang Dự báo
    thresholdSettings = {
      humidityThreshold: parseFloat(document.getElementById('humidityThreshold')?.value || '85'),
      cloudCoverThreshold: parseFloat(document.getElementById('cloudCoverThreshold')?.value || '80'),
      precipitationThreshold: parseFloat(document.getElementById('precipitationThreshold')?.value || '50'),
      windSpeedThreshold: parseFloat(document.getElementById('windSpeedThreshold')?.value || '40')
    };

    // Kiểm tra tính hợp lệ ngưỡng Dự báo
    if (thresholdSettings.humidityThreshold < 0 || thresholdSettings.humidityThreshold > 100) {
      showConfigStatus('❌ Độ ẩm phải nằm trong khoảng 0-100%', 'error');
      return;
    }
  } else if (window.location.pathname.includes('/pages/pollution')) {
    pageType = 'pollution';
    // Ngưỡng trang Ô nhiễm
    thresholdSettings = {
      aqiThreshold: parseFloat(document.getElementById('aqiThreshold')?.value || '150'),
      pm25Threshold: parseFloat(document.getElementById('pm25Threshold')?.value || '75'),
      pm10Threshold: parseFloat(document.getElementById('pm10Threshold')?.value || '150'),
      no2Threshold: parseFloat(document.getElementById('no2Threshold')?.value || '100'),
      o3Threshold: parseFloat(document.getElementById('o3Threshold')?.value || '70')
    };
  } else {
    // Ngưỡng trang chính (Nhiệt độ)
    thresholdSettings = {
      tempMax: parseFloat(document.getElementById('tempMax')?.value || '30'),
      tempMin: parseFloat(document.getElementById('tempMin')?.value || '15'),
      humidityMax: parseFloat(document.getElementById('humidityMax')?.value || '80'),
      humidityMin: parseFloat(document.getElementById('humidityMin')?.value || '30'),
      batteryMin: parseFloat(document.getElementById('batteryMin')?.value || '20')
    };

    // Kiểm tra tính hợp lệ ngưỡng Nhiệt độ/Độ ẩm
    if (thresholdSettings.tempMin >= thresholdSettings.tempMax) {
      showConfigStatus('❌ Nhiệt độ tối thiểu phải nhỏ hơn tối đa', 'error');
      return;
    }

    if (thresholdSettings.humidityMin >= thresholdSettings.humidityMax) {
      showConfigStatus('❌ Độ ẩm tối thiểu phải nhỏ hơn tối đa', 'error');
      return;
    }
  }

  // Lưu vào localStorage
  localStorage.setItem('generalSettings', JSON.stringify(generalSettings));
  localStorage.setItem('aiSettings', JSON.stringify(aiSettings));
  localStorage.setItem('weatherSettings', JSON.stringify(weatherSettings));
  localStorage.setItem('notificationSettings', JSON.stringify(notificationSettings));

  // Lưu ngưỡng riêng theo trang
  if (pageType === 'forecast') {
    localStorage.setItem('forecastThresholds', JSON.stringify(thresholdSettings));
    console.log('💾 Ngưỡng dự báo đã lưu:', thresholdSettings);
  } else if (pageType === 'pollution') {
    localStorage.setItem('pollutionThresholds', JSON.stringify(thresholdSettings));
    console.log('💾 Ngưỡng ô nhiễm đã lưu:', thresholdSettings);
  } else {
    localStorage.setItem('thresholds', JSON.stringify(thresholdSettings));
    console.log('💾 Ngưỡng trang chính đã lưu:', thresholdSettings);
  }

  // Lưu Dark mode riêng để áp dụng ngay
  localStorage.setItem('darkMode', generalSettings.darkMode ? 'true' : 'false');

  // Đồng bộ cài đặt thông báo với AlertManager (thời gian thực)
  if (window.alertManager) {
    const alertsChanged = notificationSettings.enableAlerts !== window.alertManager.isAlertsEnabled;
    const soundChanged = notificationSettings.enableSound !== window.alertManager.soundEnabled;
    const toastChanged = notificationSettings.enableToasts !== window.alertManager.toastsEnabled;

    if (alertsChanged) {
      window.alertManager.toggleAlerts();
      console.log('✅ AlertManager - Cảnh báo đã chuyển:', notificationSettings.enableAlerts);
    }
    if (soundChanged) {
      window.alertManager.toggleSound();
      console.log('✅ AlertManager - Âm thanh đã chuyển:', notificationSettings.enableSound);
    }
    if (toastChanged) {
      window.alertManager.toggleToasts();
      console.log('✅ AlertManager - Toast đã chuyển:', notificationSettings.enableToasts);
    }

    // Phát sự kiện thay đổi trạng thái
    if (alertsChanged || soundChanged || toastChanged) {
      window.dispatchEvent(new CustomEvent('alertStateChanged', {
        detail: {
          alerts: notificationSettings.enableAlerts,
          sound: notificationSettings.enableSound,
          toasts: notificationSettings.enableToasts
        }
      }));
      console.log('📢 Sự kiện thay đổi trạng thái cảnh báo đã phát sóng');
    }
  }

  // Cập nhật ngưỡng trong ThresholdAlertSystem (chỉ cho trang chính)
  if (pageType === 'main' && window.thresholdAlertSystem) {
    window.thresholdAlertSystem.updateThresholds(thresholdSettings);
    console.log('✅ Hệ thống ngưỡng đã cập nhật với giá trị mới:', thresholdSettings);
  }

  // Phát sự kiện cập nhật ngưỡng cho các trang khác
  if (pageType === 'forecast' && typeof saveForecastThresholds === 'function') {
    if (typeof saveForecastThresholds === 'function') saveForecastThresholds(thresholdSettings);
    window.dispatchEvent(new CustomEvent('forecastThresholdsUpdated', {
      detail: thresholdSettings
    }));
    console.log('📢 Sự kiện cập nhật ngưỡng dự báo đã phát sóng');
  } else if (pageType === 'pollution' && typeof savePollutionThresholds === 'function') {
    if (typeof savePollutionThresholds === 'function') savePollutionThresholds(thresholdSettings);
    window.dispatchEvent(new CustomEvent('pollutionThresholdsUpdated', {
      detail: thresholdSettings
    }));
    console.log('📢 Sự kiện cập nhật ngưỡng ô nhiễm đã phát sóng');
  } else {
    // Trang chính phát sự kiện
    window.dispatchEvent(new CustomEvent('thresholdsUpdated', {
      detail: thresholdSettings
    }));
  }

  // Lưu lên server
  saveAllConfigToServer(aiSettings, weatherSettings, notificationSettings, thresholdSettings);

  // Hiển thị trạng thái thành công
  const statusDiv = document.getElementById('configStatus');
  if (statusDiv) {
    statusDiv.textContent = '✅ Cấu hình đã được lưu thành công!';
    statusDiv.className = 'config-status-v2 success show';
    setTimeout(() => {
      statusDiv.classList.remove('show');
      closeConfigModalV2();
    }, 2000);
  }

  console.log('✅ Cấu hình đã lưu:', {
    generalSettings,
    aiSettings: { ...aiSettings, apiKey: '***' },
    weatherSettings,
    notificationSettings,
    thresholdSettings
  });
}

// Lưu tất cả cấu hình lên server
async function saveAllConfigToServer(aiSettings, weatherSettings, notificationSettings, thresholdSettings) {
  try {
    // Lưu cấu hình API/AI
    if (aiSettings.apiType) {
      const aiPayload = {
        apiType: aiSettings.apiType,
        aiModel: aiSettings.aiModel,
        apiKey: aiSettings.apiKey || undefined
      };

      await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(aiPayload)
      });
    }

    // Lưu cấu hình thời tiết
    if (weatherSettings.weatherProvider) {
      const weatherPayload = {
        weatherProvider: weatherSettings.weatherProvider,
        weatherApiKey: weatherSettings.weatherApiKey,
        weatherCity: weatherSettings.weatherCity,
        weatherPollInterval: weatherSettings.weatherPollInterval,
        weatherLat: weatherSettings.weatherLat,
        weatherLon: weatherSettings.weatherLon
      };

      await fetch('/api/weather-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(weatherPayload)
      });
    }

    // Lưu ngưỡng cảnh báo (CRITICAL cho đồng bộ hệ thống cảnh báo)
    if (thresholdSettings) {
      const response = await fetch('/api/thresholds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(thresholdSettings)
      });

      if (response.ok) {
        const result = await response.json();
        console.log('✅ Ngưỡng đã lưu lên server:', result.thresholds);

        // Đảm bảo localStorage cũng được cập nhật
        localStorage.setItem('thresholds', JSON.stringify(thresholdSettings));
        console.log('✅ Ngưỡng đã lưu cache vào localStorage');
      }
    }

    // Lưu cài đặt thông báo cục bộ
    if (notificationSettings) {
      localStorage.setItem('notificationPreferences', JSON.stringify(notificationSettings));
    }

    console.log('✅ Tất cả cấu hình đã lưu lên server và localStorage');
  } catch (error) {
    console.error('❌ Lỗi khi lưu lên server:', error);
    showConfigStatus('⚠️ Cấu hình đã lưu cục bộ nhưng có lỗi khi gửi lên server', 'info');
  }
}

// Khởi tạo chức năng công tắc
function initializeToggleSwitches() {
  // Thiết lập listeners cho TẤT CẢ công tắc (trong modal và bên ngoài)
  const toggles = document.querySelectorAll('input[type="checkbox"]');

  toggles.forEach(toggle => {
    // Xử lý đặc biệt cho công tắc Dark Mode
    if (toggle.id === 'darkMode') {
      // Tải trạng thái đã lưu
      const savedState = localStorage.getItem('darkMode') === 'true';
      toggle.checked = savedState;

      // Thêm listener
      toggle.addEventListener('change', () => {
        const isDarkMode = toggle.checked;
        console.log(`🔄 Công tắc Dark mode chuyển sang: ${isDarkMode}`);

        if (isDarkMode) {
          document.body.classList.add('dark-mode');
          localStorage.setItem('darkMode', 'true');
          console.log('🌙 Dark mode ĐÃ ÁP DỤNG');

          // Phát sự kiện đồng bộ AI
          window.dispatchEvent(new CustomEvent('darkModeChanged', {
            detail: { enabled: true, source: 'ui' }
          }));
        } else {
          document.body.classList.remove('dark-mode');
          localStorage.setItem('darkMode', 'false');
          console.log('☀️ Light mode ĐÃ ÁP DỤNG');

          // Phát sự kiện đồng bộ AI
          window.dispatchEvent(new CustomEvent('darkModeChanged', {
            detail: { enabled: false, source: 'ui' }
          }));
        }
      }, { once: false });

      return; // Bỏ qua listener chung cho DarkMode
    }

    // Xử lý công tắc chung
    const savedState = localStorage.getItem(`toggle_${toggle.id}`);
    if (savedState !== null) {
      toggle.checked = savedState === 'true';
    }

    toggle.addEventListener('change', () => {
      localStorage.setItem(`toggle_${toggle.id}`, toggle.checked);
      console.log(`✓ Công tắc '${toggle.id}' đặt là: ${toggle.checked}`);
    });
  });

  // Cập nhật thanh trượt Âm lượng
  const volumeSlider = document.getElementById('soundVolume');
  const volumeValue = document.getElementById('volumeValue');
  if (volumeSlider && volumeValue) {
    volumeSlider.addEventListener('input', () => {
      const percent = Math.round(parseFloat(volumeSlider.value) * 100);
      volumeValue.textContent = percent;
    });
  }
}

// Khởi tạo hiển thị thanh trượt ngưỡng
function initializeThresholdSliders() {
  const thresholdInputs = document.querySelectorAll('.threshold-input');

  thresholdInputs.forEach(input => {
    const updateSlider = () => {
      const value = parseFloat(input.value);
      const min = parseFloat(input.getAttribute('data-min')) || 0;
      const max = parseFloat(input.getAttribute('data-max')) || 100;

      // Tính phần trăm
      const percentage = ((value - min) / (max - min)) * 100;

      // Tìm và cập nhật thanh trượt tương ứng
      const item = input.closest('.threshold-item');
      if (item) {
        const slider = item.querySelector('.threshold-slider');
        if (slider) {
          slider.style.width = Math.max(0, Math.min(100, percentage)) + '%';
        }
      }

      // Lưu vào localStorage
      localStorage.setItem(`threshold_${input.id}`, value);
      console.log(`⚙️ Ngưỡng '${input.id}' cập nhật: ${value}`);
    };

    // Cập nhật ban đầu
    updateSlider();

    // Cập nhật khi thay đổi
    input.addEventListener('input', updateSlider);
  });
}

// Reset tất cả cài đặt về mặc định
function resetToDefaults() {
  if (!confirm('🔄 Bạn có chắc chắn muốn reset tất cả cài đặt về mặc định?\n\nHành động này không thể hoàn tác!')) {
    return;
  }

  try {
    // Giá trị ngưỡng mặc định
    const defaultThresholds = {
      tempMax: 27,
      tempMin: 19,
      humidityMax: 82,
      humidityMin: 40,
      batteryMin: 50
    };

    // Cài đặt chung mặc định
    const defaultGeneralSettings = {
      language: 'vi',
      darkMode: false,
      theme: 'light'
    };

    // Cài đặt thông báo mặc định
    const defaultNotificationSettings = {
      enableAlerts: true,
      enableSound: true,
      enableToasts: true,
      soundVolume: 1.0
    };

    // Cập nhật các trường form
    if (document.getElementById('tempMax')) document.getElementById('tempMax').value = defaultThresholds.tempMax;
    if (document.getElementById('tempMin')) document.getElementById('tempMin').value = defaultThresholds.tempMin;
    if (document.getElementById('humidityMax')) document.getElementById('humidityMax').value = defaultThresholds.humidityMax;
    if (document.getElementById('humidityMin')) document.getElementById('humidityMin').value = defaultThresholds.humidityMin;
    if (document.getElementById('batteryMin')) document.getElementById('batteryMin').value = defaultThresholds.batteryMin;

    if (document.getElementById('language')) document.getElementById('language').value = defaultGeneralSettings.language;
    if (document.getElementById('darkMode')) document.getElementById('darkMode').checked = defaultGeneralSettings.darkMode;

    if (document.getElementById('enableAlerts')) document.getElementById('enableAlerts').checked = defaultNotificationSettings.enableAlerts;
    if (document.getElementById('enableSound')) document.getElementById('enableSound').checked = defaultNotificationSettings.enableSound;
    if (document.getElementById('enableToasts')) document.getElementById('enableToasts').checked = defaultNotificationSettings.enableToasts;
    if (document.getElementById('soundVolume')) {
      document.getElementById('soundVolume').value = defaultNotificationSettings.soundVolume;
      const volumeValue = document.getElementById('volumeValue');
      if (volumeValue) volumeValue.textContent = '100';
    }

    // Xóa tất cả LocalStorage liên quan đến cài đặt
    localStorage.removeItem('thresholds');
    localStorage.removeItem('thresholdSettings');
    localStorage.removeItem('generalSettings');
    localStorage.removeItem('notificationSettings');
    localStorage.removeItem('darkMode');
    localStorage.removeItem('aiSystemThresholds');
    localStorage.removeItem('aiSystemControls');
    localStorage.removeItem('aiSettings');
    localStorage.removeItem('weatherSettings');

    // Lưu lại mặc định vào LocalStorage
    localStorage.setItem('thresholds', JSON.stringify(defaultThresholds));
    localStorage.setItem('generalSettings', JSON.stringify(defaultGeneralSettings));
    localStorage.setItem('notificationSettings', JSON.stringify(defaultNotificationSettings));

    // Áp dụng cài đặt ngay
    if (window.thresholdAlertSystem) {
      window.thresholdAlertSystem.updateThresholds(defaultThresholds);
    }

    // Cập nhật Dark mode
    if (!defaultGeneralSettings.darkMode) {
      document.body.classList.remove('dark-mode');
    }

    // Gửi lên server
    saveConfigModalV2Settings();

    showConfigStatus('✅ Đã reset tất cả cài đặt về mặc định', 'success');
    console.log('✅ Cài đặt đã reset về mặc định');
  } catch (error) {
    console.error('❌ Lỗi khi reset cài đặt:', error);
    showConfigStatus('❌ Lỗi khi reset cài đặt', 'error');
  }
}