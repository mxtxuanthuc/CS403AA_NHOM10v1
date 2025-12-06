// --- XỬ LÝ CẤU HÌNH Ô NHIỄM KHÔNG KHÍ ---
// Quản lý các ngưỡng cảnh báo và cài đặt cụ thể cho chất lượng không khí.

// Tải ngưỡng cảnh báo ô nhiễm từ LocalStorage hoặc giá trị mặc định.
function loadPollutionThresholds() {
  try {
    // Thử lấy từ localStorage (cache) trước
    const cached = localStorage.getItem('pollutionThresholds');
    if (cached) {
      const thresholds = JSON.parse(cached);
      updatePollutionThresholdInputs(thresholds);
      console.log('📦 Ngưỡng ô nhiễm đã tải từ localStorage:', thresholds);
      return thresholds;
    }

    // Giá trị ngưỡng mặc định (chuẩn US EPA AQI)
    const defaults = {
      aqiThreshold: 150, 	    // Ngưỡng Không tốt
      pm25Threshold: 75, 	    // μg/m³ - Ngưỡng Không tốt
      pm10Threshold: 150, 	    // μg/m³ - Ngưỡng Không tốt
      no2Threshold: 100, 	    // ppb - Ngưỡng Không tốt
      o3Threshold: 70 	      // ppb - Ngưỡng Không tốt
    };

    updatePollutionThresholdInputs(defaults);
    localStorage.setItem('pollutionThresholds', JSON.stringify(defaults));
    console.log('✅ Ngưỡng ô nhiễm đặt về mặc định:', defaults);
    return defaults;
  } catch (error) {
    console.error('❌ Lỗi tải ngưỡng ô nhiễm:', error);
    return null;
  }
}

// Cập nhật giá trị vào các trường input ngưỡng ô nhiễm.
function updatePollutionThresholdInputs(thresholds) {
  if (thresholds.aqiThreshold !== undefined) {
    const input = document.getElementById('aqiThreshold');
    if (input) input.value = thresholds.aqiThreshold;
  }

  if (thresholds.pm25Threshold !== undefined) {
    const input = document.getElementById('pm25Threshold');
    if (input) input.value = thresholds.pm25Threshold;
  }

  if (thresholds.pm10Threshold !== undefined) {
    const input = document.getElementById('pm10Threshold');
    if (input) input.value = thresholds.pm10Threshold;
  }

  if (thresholds.no2Threshold !== undefined) {
    const input = document.getElementById('no2Threshold');
    if (input) input.value = thresholds.no2Threshold;
  }

  if (thresholds.o3Threshold !== undefined) {
    const input = document.getElementById('o3Threshold');
    if (input) input.value = thresholds.o3Threshold;
  }

  console.log('✅ Input ngưỡng ô nhiễm đã cập nhật');
}

// Thu thập và kiểm tra ngưỡng ô nhiễm từ form.
function collectPollutionThresholds() {
  const thresholds = {
    aqiThreshold: parseFloat(document.getElementById('aqiThreshold')?.value || '150'),
    pm25Threshold: parseFloat(document.getElementById('pm25Threshold')?.value || '75'),
    pm10Threshold: parseFloat(document.getElementById('pm10Threshold')?.value || '150'),
    no2Threshold: parseFloat(document.getElementById('no2Threshold')?.value || '100'),
    o3Threshold: parseFloat(document.getElementById('o3Threshold')?.value || '70')
  };

  // Kiểm tra tính hợp lệ: tất cả phải là số dương
  for (const [key, value] of Object.entries(thresholds)) {
    if (value < 0) {
      console.error(`❌ ${key} phải là số dương`);
      return null;
    }
    if (value > 500) {
      console.warn(`⚠️ ${key} có vẻ rất cao (${value}), nhưng vẫn cho phép`);
    }
  }

  return thresholds;
}

// Lưu ngưỡng ô nhiễm vào LocalStorage và Server.
async function savePollutionThresholds(thresholds) {
  try {
    // Kiểm tra và thu thập nếu chưa có
    if (!thresholds) {
      thresholds = collectPollutionThresholds();
      if (!thresholds) return false;
    }

    // Lưu vào LocalStorage
    localStorage.setItem('pollutionThresholds', JSON.stringify(thresholds));
    console.log('💾 Ngưỡng ô nhiễm đã lưu vào localStorage:', thresholds);

    // Lưu lên Server
    const response = await fetch('/api/pollution-thresholds', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(thresholds)
    });

    if (!response.ok) {
      console.warn('⚠️ Lưu Server thất bại, nhưng LocalStorage đã cập nhật');
      return true;
    }

    console.log('✅ Ngưỡng ô nhiễm đã lưu lên Server:', thresholds);

    // Phát sự kiện cập nhật ngưỡng
    window.dispatchEvent(new CustomEvent('pollutionThresholdsUpdated', {
      detail: thresholds
    }));

    return true;
  } catch (error) {
    console.error('❌ Lỗi lưu ngưỡng ô nhiễm:', error);
    return false;
  }
}

// Kiểm tra dữ liệu ô nhiễm vượt ngưỡng và kích hoạt cảnh báo.
function checkPollutionThresholds(pollutionData) {
  try {
    const thresholds = JSON.parse(localStorage.getItem('pollutionThresholds') || '{}');
    const alerts = [];

    // Kiểm tra AQI
    if (pollutionData.aqi !== undefined && pollutionData.aqi > thresholds.aqiThreshold) {
      alerts.push({
        type: 'aqi_high',
        message: `😷 AQI cao: ${pollutionData.aqi} (Ngưỡng: ${thresholds.aqiThreshold})`,
        severity: 'critical',
        timestamp: new Date(),
        value: pollutionData.aqi,
        threshold: thresholds.aqiThreshold
      });
    }

    // Kiểm tra PM2.5
    if (pollutionData.pm25 !== undefined && pollutionData.pm25 > thresholds.pm25Threshold) {
      alerts.push({
        type: 'pm25_high',
        message: `💨 PM2.5 cao: ${pollutionData.pm25} μg/m³ (Ngưỡng: ${thresholds.pm25Threshold} μg/m³)`,
        severity: 'warning',
        timestamp: new Date(),
        value: pollutionData.pm25,
        threshold: thresholds.pm25Threshold
      });
    }

    // Kiểm tra PM10
    if (pollutionData.pm10 !== undefined && pollutionData.pm10 > thresholds.pm10Threshold) {
      alerts.push({
        type: 'pm10_high',
        message: `🌪️ PM10 cao: ${pollutionData.pm10} μg/m³ (Ngưỡng: ${thresholds.pm10Threshold} μg/m³)`,
        severity: 'warning',
        timestamp: new Date(),
        value: pollutionData.pm10,
        threshold: thresholds.pm10Threshold
      });
    }

    // Kiểm tra NO2
    if (pollutionData.no2 !== undefined && pollutionData.no2 > thresholds.no2Threshold) {
      alerts.push({
        type: 'no2_high',
        message: `🏭 NO₂ cao: ${pollutionData.no2} ppb (Ngưỡng: ${thresholds.no2Threshold} ppb)`,
        severity: 'warning',
        timestamp: new Date(),
        value: pollutionData.no2,
        threshold: thresholds.no2Threshold
      });
    }

    // Kiểm tra O3
    if (pollutionData.o3 !== undefined && pollutionData.o3 > thresholds.o3Threshold) {
      alerts.push({
        type: 'o3_high',
        message: `🌫️ O₃ cao: ${pollutionData.o3} ppb (Ngưỡng: ${thresholds.o3Threshold} ppb)`,
        severity: 'warning',
        timestamp: new Date(),
        value: pollutionData.o3,
        threshold: thresholds.o3Threshold
      });
    }

    // Kích hoạt cảnh báo nếu có
    if (alerts.length > 0) {
      alerts.forEach(alert => {
        // Hàm giả định: Kích hoạt cảnh báo
        if (typeof triggerPollutionAlert === 'function') { 
          triggerPollutionAlert(alert);
        }
        console.log('⚠️ Cảnh báo ngưỡng ô nhiễm:', alert.message);
      });
    }

    return alerts;
  } catch (error) {
    console.error('❌ Lỗi kiểm tra ngưỡng ô nhiễm:', error);
    return [];
  }
}

// Khởi tạo cấu hình ô nhiễm khi tải trang.
function initializePollutionConfig() {
  console.log('😷 Đang khởi tạo cấu hình ô nhiễm...');

  // Tải ngưỡng khi tải trang
  loadPollutionThresholds();

  // Lắng nghe sự kiện lưu cấu hình chung
  window.addEventListener('configSaved', (e) => {
    if (e.detail && e.detail.type === 'pollution') {
      savePollutionThresholds(e.detail.thresholds);
    }
  });

  // Lắng nghe sự kiện cập nhật ngưỡng
  window.addEventListener('thresholdsUpdated', (e) => {
    // Nếu có trường cụ thể của ô nhiễm, lưu chúng
    if (e.detail.aqiThreshold || e.detail.pm25Threshold) {
      savePollutionThresholds(e.detail);
    }
  });

  console.log('✅ Cấu hình ô nhiễm đã khởi tạo');
}

// Tự động khởi tạo khi DOM đã sẵn sàng
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializePollutionConfig);
} else {
  initializePollutionConfig();
}