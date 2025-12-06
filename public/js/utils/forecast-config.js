// --- XỬ LÝ CẤU HÌNH DỰ BÁO THỜI TIẾT ---
// Quản lý các ngưỡng cảnh báo và cài đặt cụ thể cho dự báo thời tiết.

// Tải ngưỡng dự báo từ LocalStorage hoặc giá trị mặc định.
function loadForecastThresholds() {
  try {
    // Thử lấy từ localStorage (cache) trước
    const cached = localStorage.getItem('forecastThresholds');
    if (cached) {
      const thresholds = JSON.parse(cached);
      updateForecastThresholdInputs(thresholds);
      console.log('📦 Ngưỡng dự báo đã tải từ localStorage:', thresholds);
      return thresholds;
    }

    // Giá trị ngưỡng mặc định
    const defaults = {
      humidityThreshold: 85,
      cloudCoverThreshold: 80,
      precipitationThreshold: 50, // mm
      windSpeedThreshold: 40 // km/h
    };

    updateForecastThresholdInputs(defaults);
    localStorage.setItem('forecastThresholds', JSON.stringify(defaults));
    console.log('✅ Ngưỡng dự báo đặt về mặc định:', defaults);
    return defaults;
  } catch (error) {
    console.error('❌ Lỗi tải ngưỡng dự báo:', error);
    return null;
  }
}

// Cập nhật giá trị vào các trường input ngưỡng dự báo.
function updateForecastThresholdInputs(thresholds) {
  if (thresholds.humidityThreshold !== undefined) {
    const input = document.getElementById('humidityThreshold');
    if (input) input.value = thresholds.humidityThreshold;
  }

  if (thresholds.cloudCoverThreshold !== undefined) {
    const input = document.getElementById('cloudCoverThreshold');
    if (input) input.value = thresholds.cloudCoverThreshold;
  }

  if (thresholds.precipitationThreshold !== undefined) {
    const input = document.getElementById('precipitationThreshold');
    if (input) input.value = thresholds.precipitationThreshold;
  }

  if (thresholds.windSpeedThreshold !== undefined) {
    const input = document.getElementById('windSpeedThreshold');
    if (input) input.value = thresholds.windSpeedThreshold;
  }

  console.log('✅ Input ngưỡng dự báo đã cập nhật');
}

// Thu thập và kiểm tra ngưỡng dự báo từ form.
function collectForecastThresholds() {
  const thresholds = {
    humidityThreshold: parseFloat(document.getElementById('humidityThreshold')?.value || '85'),
    cloudCoverThreshold: parseFloat(document.getElementById('cloudCoverThreshold')?.value || '80'),
    precipitationThreshold: parseFloat(document.getElementById('precipitationThreshold')?.value || '50'),
    windSpeedThreshold: parseFloat(document.getElementById('windSpeedThreshold')?.value || '40')
  };

  // Kiểm tra tính hợp lệ (0-100% hoặc phải dương)
  if (thresholds.humidityThreshold < 0 || thresholds.humidityThreshold > 100) {
    console.error('❌ Ngưỡng độ ẩm phải nằm trong khoảng 0-100');
    return null;
  }

  if (thresholds.cloudCoverThreshold < 0 || thresholds.cloudCoverThreshold > 100) {
    console.error('❌ Ngưỡng mây che phủ phải nằm trong khoảng 0-100');
    return null;
  }

  if (thresholds.precipitationThreshold < 0) {
    console.error('❌ Ngưỡng lượng mưa phải là số dương');
    return null;
  }

  if (thresholds.windSpeedThreshold < 0) {
    console.error('❌ Ngưỡng tốc độ gió phải là số dương');
    return null;
  }

  return thresholds;
}

// Lưu ngưỡng dự báo vào LocalStorage và Server.
async function saveForecastThresholds(thresholds) {
  try {
    // Kiểm tra và thu thập nếu chưa có
    if (!thresholds) {
      thresholds = collectForecastThresholds();
      if (!thresholds) return false;
    }

    // Lưu vào LocalStorage
    localStorage.setItem('forecastThresholds', JSON.stringify(thresholds));
    console.log('💾 Ngưỡng dự báo đã lưu vào localStorage:', thresholds);

    // Lưu lên Server
    const response = await fetch('/api/forecast-thresholds', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(thresholds)
    });

    if (!response.ok) {
      console.warn('⚠️ Lưu Server thất bại, nhưng LocalStorage đã cập nhật');
      return true;
    }

    console.log('✅ Ngưỡng dự báo đã lưu lên Server:', thresholds);

    // Phát sự kiện cập nhật ngưỡng
    window.dispatchEvent(new CustomEvent('forecastThresholdsUpdated', {
      detail: thresholds
    }));

    return true;
  } catch (error) {
    console.error('❌ Lỗi lưu ngưỡng dự báo:', error);
    return false;
  }
}

// Kiểm tra dữ liệu dự báo vượt ngưỡng và kích hoạt cảnh báo.
function checkForecastThresholds(weatherData) {
  try {
    const thresholds = JSON.parse(localStorage.getItem('forecastThresholds') || '{}');
    const alerts = [];

    // Kiểm tra Độ ẩm
    if (weatherData.humidity !== undefined && weatherData.humidity > thresholds.humidityThreshold) {
      alerts.push({
        type: 'humidity_high',
        message: `💧 Độ ẩm cao: ${weatherData.humidity}% (Ngưỡng: ${thresholds.humidityThreshold}%)`,
        severity: 'warning',
        timestamp: new Date(),
        value: weatherData.humidity,
        threshold: thresholds.humidityThreshold
      });
    }

    // Kiểm tra Mây che phủ
    if (weatherData.cloudCover !== undefined && weatherData.cloudCover > thresholds.cloudCoverThreshold) {
      alerts.push({
        type: 'cloudcover_high',
        message: `☁️ Mây che phủ dày: ${weatherData.cloudCover}% (Ngưỡng: ${thresholds.cloudCoverThreshold}%)`,
        severity: 'warning',
        timestamp: new Date(),
        value: weatherData.cloudCover,
        threshold: thresholds.cloudCoverThreshold
      });
    }

    // Kiểm tra Lượng mưa
    if (weatherData.precipitation !== undefined && weatherData.precipitation > thresholds.precipitationThreshold) {
      alerts.push({
        type: 'precipitation_high',
        message: `🌧️ Mưa dự báo nhiều: ${weatherData.precipitation}mm (Ngưỡng: ${thresholds.precipitationThreshold}mm)`,
        severity: 'warning',
        timestamp: new Date(),
        value: weatherData.precipitation,
        threshold: thresholds.precipitationThreshold
      });
    }

    // Kiểm tra Tốc độ gió
    if (weatherData.windSpeed !== undefined && weatherData.windSpeed > thresholds.windSpeedThreshold) {
      alerts.push({
        type: 'wind_high',
        message: `💨 Gió dự báo mạnh: ${weatherData.windSpeed} km/h (Ngưỡng: ${thresholds.windSpeedThreshold} km/h)`,
        severity: 'warning',
        timestamp: new Date(),
        value: weatherData.windSpeed,
        threshold: thresholds.windSpeedThreshold
      });
    }

    // Kích hoạt cảnh báo nếu có
    if (alerts.length > 0) {
      alerts.forEach(alert => {
        // Hàm giả định: Kích hoạt cảnh báo thời tiết
        if (typeof triggerWeatherAlert === 'function') {
          // Hàm giả định: triggerWeatherAlert(alert); 
        }
        console.log('⚠️ Cảnh báo ngưỡng dự báo:', alert.message);
      });
    }

    return alerts;
  } catch (error) {
    console.error('❌ Lỗi kiểm tra ngưỡng dự báo:', error);
    return [];
  }
}

// Khởi tạo cấu hình dự báo khi tải trang.
function initializeForecastConfig() {
  console.log('🌤️ Đang khởi tạo cấu hình dự báo...');

  // Tải ngưỡng khi tải trang
  loadForecastThresholds();

  // Lắng nghe sự kiện lưu cấu hình chung
  window.addEventListener('configSaved', (e) => {
    if (e.detail && e.detail.type === 'forecast') {
      saveForecastThresholds(e.detail.thresholds);
    }
  });

  // Lắng nghe sự kiện cập nhật ngưỡng
  window.addEventListener('thresholdsUpdated', (e) => {
    // Nếu có trường cụ thể của dự báo, lưu chúng
    if (e.detail.humidityThreshold || e.detail.cloudCoverThreshold) {
      saveForecastThresholds(e.detail);
    }
  });

  console.log('✅ Cấu hình dự báo đã khởi tạo');
}

// Tự động khởi tạo khi DOM đã sẵn sàng
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeForecastConfig);
} else {
  initializeForecastConfig();
}