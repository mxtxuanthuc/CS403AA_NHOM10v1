// --- LOGIC TRANG Ô NHIỄM KHÔNG KHÍ (POLLUTION) ---

console.log('🔄 Đang tải pollution.js...');
let pollutionData = {};
let pollutionChart = null;
let pollutionAlertsHistory = [];
const MAX_ALERTS = 20;
let autoRefreshInterval = null;
const AUTO_REFRESH_INTERVAL = 30 * 1000; // 30 giây cập nhật dữ liệu thực

// Hàm trigger cảnh báo ô nhiễm - gọi AlertManager nếu có sẵn
function triggerPollutionAlert(alertData) {
  try {
    // Chờ cho đến khi alertManager sẵn sàng
    let attempts = 0;
    const maxAttempts = 5;

    const tryTrigger = setInterval(() => {
      attempts++;

      // Nếu AlertManager sẵn sàng
      if (typeof alertManager !== 'undefined' && window.alertManager && window.alertManager.initialize) {
        clearInterval(tryTrigger);

        // Phát âm thanh
        if (window.alertManager.soundEnabled) {
          window.alertManager.playWarningSound();
          console.log('🔊 Âm thanh cảnh báo được phát');
        }

        // Cập nhật alert container
        if (window.alertManager.statusUpdateEnabled) {
          window.alertManager.updateAlertContainer([alertData], alertData.severity || 'warning', []);
          console.log('📢 Alert container được cập nhật');
        }

        console.log('✅ Cảnh báo ô nhiễm được xử lý thành công');
      } else if (attempts >= maxAttempts) {
        clearInterval(tryTrigger);
        console.warn('⚠️ alertManager chưa khả dụng, nhưng cảnh báo vẫn được ghi lại');
      }
    }, 100);

  } catch (error) {
    console.error('❌ Lỗi trigger cảnh báo:', error);
  }
}

// Lấy mức độ, màu, và icon AQI dựa trên giá trị chỉ số
function getAQILevel(aqi) {
  if (!aqi && aqi !== 0) {
    return { level: 'Chưa có dữ liệu', color: 'unknown', emoji: '❓' };
  }

  if (aqi <= 50) {
    return { level: '✅ Tốt', color: 'good', emoji: '😊' };
  } else if (aqi <= 100) {
    return { level: '⚠️ Trung bình', color: 'moderate', emoji: '😐' };
  } else if (aqi <= 150) {
    return { level: '⚠️ Không tốt cho nhóm nhạy cảm', color: 'moderate-unhealthy', emoji: '😟' };
  } else if (aqi <= 200) {
    return { level: '🛑 Không tốt', color: 'unhealthy', emoji: '😷' };
  } else if (aqi <= 300) {
    return { level: '🚨 Rất không tốt', color: 'very-unhealthy', emoji: '🤢' };
  } else {
    return { level: '💀 Nguy hiểm', color: 'hazardous', emoji: '☠️' };
  }
}

// Lấy mức độ ô nhiễm và class hiển thị dựa trên giá trị và chất
function getPollutantLevel(value, pollutant) {
  if (!value && value !== 0) return { text: '--', className: 'status-unknown' };

  // Ngưỡng theo chất (Ví dụ, ngưỡng của US EPA)
  const thresholds = {
    pm25: { good: 12, moderate: 35, unhealthy: 55, veryunhealthy: 150 },
    pm10: { good: 54, moderate: 154, unhealthy: 254, veryunhealthy: 354 },
    o3: { good: 55, moderate: 70, unhealthy: 85, veryunhealthy: 105 },
    no2: { good: 53, moderate: 100, unhealthy: 360, veryunhealthy: 649 }
  };

  const thresh = thresholds[pollutant];
  if (!thresh) return { text: '--', className: 'status-unknown' };

  if (value <= thresh.good) return { text: '✅ Tốt', className: 'status-good' };
  if (value <= thresh.moderate) return { text: '⚠️ Trung bình', className: 'status-moderate' };
  // Chỉnh sửa logic hiển thị: Nếu > 55 và <= 150 (PM2.5) thì là "Không tốt cho nhóm nhạy cảm"
  if (value <= 150 && pollutant === 'pm25') return { text: '🛑 Không tốt cho nhóm nhạy cảm', className: 'status-moderate-unhealthy' }; 
  if (value <= thresh.unhealthy) return { text: '🛑 Không tốt', className: 'status-unhealthy' };
  if (value <= thresh.veryunhealthy) return { text: '🚨 Rất không tốt', className: 'status-very-unhealthy' };
  return { text: '💀 Nguy hiểm', className: 'status-hazardous' };
}

// Gọi API lấy dữ liệu ô nhiễm
async function fetchPollutionData() {
  try {
    console.log('🌍 Đang tải dữ liệu ô nhiễm từ API...');
    const response = await fetch('/api/pollution');
    if (!response.ok) {
        const error = new Error(`HTTP ${response.status}`);
        error.response = response;
        throw error;
    }

    const data = await response.json();
    console.log('✅ Dữ liệu ô nhiễm đã tải:', data);
    return data;
  } catch (error) {
    console.error('❌ Lỗi tải dữ liệu ô nhiễm:', error);
    throw error;
  }
}

// Cập nhật dữ liệu ô nhiễm với animation smooth
async function refreshPollutionData() {
  const loader = document.getElementById('pollutionLoader');
  try {
    if(loader) loader.style.display = 'block';
    const data = await fetchPollutionData();
    if (data) {
      // Lưu dữ liệu cũ để so sánh
      const oldAqi = pollutionData.aqi || 0;

      // Cập nhật dữ liệu mới
      pollutionData = data;

      // Cập nhật hiển thị
      updatePollutionDisplay();

      // Lấy gợi ý từ AI
      fetchAIRecommendations(data);

      // Nếu AQI thay đổi hoặc có điểm dữ liệu mới, cập nhật chart
      if (oldAqi !== data.aqi && Array.isArray(data.pollution_points)) {
        initializePollutionChart(data.pollution_points);
      }

      // Hiển thị cảnh báo nếu có
      if (Array.isArray(data.alerts) && data.alerts.length > 0) {
        displayPollutionAlerts(data.alerts);
      }

      console.log('✅ Dữ liệu ô nhiễm đã cập nhật thành công');
    }
  } catch (error) {
    console.error('❌ Lỗi làm mới dữ liệu ô nhiễm:', error);
    let errorMessage = 'Lỗi tải dữ liệu ô nhiễm: ' + error.message;
    if (error.response) {
        try {
            const errorData = await error.response.json();
            errorMessage = `Lỗi tải dữ liệu ô nhiễm: ${errorData.error || error.message}`;
        } catch (e) {
            // Bỏ qua nếu lỗi phân tích JSON
        }
    }
    // Dùng hàm hiển thị trạng thái nếu có
    if (typeof showStatus === 'function') {
      showStatus(errorMessage, 'error');
    } else {
      console.error(errorMessage);
    }
  } finally {
    if(loader) loader.style.display = 'none';
  }
}

// Gọi API lấy gợi ý từ AI
async function fetchAIRecommendations(pollutionData) {
  const recommendationsContainer = document.getElementById('aiRecommendations');
  if (!recommendationsContainer) return;

  try {
    recommendationsContainer.innerHTML = '<div class="loading-spinner"></div>';

    const response = await fetch('/api/pollution/recommendations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        aqi: pollutionData.aqi,
        pm25: pollutionData.pm25,
        pm10: pollutionData.pm10,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();

    // Hiển thị gợi ý
    if (data.recommendations && Array.isArray(data.recommendations) && data.recommendations.length > 0) {
      let html = '<div class="recommendations-list">';
      data.recommendations.forEach(rec => {
        html += `
          <div class="recommendation-item">
            <div class="recommendation-reason">
              <span class="rec-icon">💡</span>
              <strong>Vì sao?</strong> ${rec.reason}
            </div>
            <div class="recommendation-action">
              <span class="rec-icon">👉</span>
              <strong>Nên làm gì?</strong> ${rec.action}
            </div>
          </div>
        `;
      });
      html += '</div>';
      recommendationsContainer.innerHTML = html;
    } else {
      recommendationsContainer.innerHTML = '<p class="text-center">Không có gợi ý nào từ AI.</p>';
    }
  } catch (error) {
    console.error('❌ Lỗi tải gợi ý AI:', error);
    recommendationsContainer.innerHTML = '<p class="text-center error-message">Lỗi khi lấy gợi ý từ AI.</p>';
  }
}

// Cập nhật hiển thị AQI và các chất gây ô nhiễm
function updatePollutionDisplay() {
  const data = pollutionData;

  // Cập nhật vòng tròn AQI với animation
  const aqi = data.aqi || 0;
  const aqiLevel = getAQILevel(aqi);
  const aqiCircle = document.getElementById('aqiCircle');

  if (aqiCircle) {
    aqiCircle.className = 'aqi-circle ' + aqiLevel.color;
    // Kích hoạt animation
    aqiCircle.style.animation = 'none';
    setTimeout(() => {
      aqiCircle.style.animation = 'pulse 2s infinite';
    }, 10);
  }

  // Cập nhật giá trị AQI
  if (document.getElementById('aqiValue')) {
    const valueEl = document.getElementById('aqiValue');
    valueEl.style.transition = 'all 0.5s ease';
    valueEl.textContent = aqi;
  }

  // Cập nhật nhãn AQI
  if (document.getElementById('aqiLabel')) {
    const labelEl = document.getElementById('aqiLabel');
    labelEl.style.transition = 'all 0.5s ease';
    labelEl.textContent = aqiLevel.level;
  }

  // Cập nhật giá trị các chất gây ô nhiễm
  const updateValue = (elementId, value, unit) => {
    const el = document.getElementById(elementId);
    if (el) {
      el.style.transition = 'all 0.3s ease';
      el.textContent = (value !== undefined ? value.toFixed(1) : '--') + ' ' + unit;
    }
  };

  updateValue('pm25Value', data.pm25, 'µg/m³');
  updateValue('pm10Value', data.pm10, 'µg/m³');
  updateValue('o3Value', data.o3, 'ppb');
  updateValue('no2Value', data.no2, 'ppb');

  // Cập nhật trạng thái mức độ ô nhiễm
  const updateStatus = (elementId, value, pollutant) => {
    const el = document.getElementById(elementId);
    if (el) {
      const level = getPollutantLevel(value, pollutant);
      el.textContent = level.text;
      el.className = 'info-value ' + level.className;
    }
  };

  updateStatus('pm25Status', data.pm25, 'pm25');
  updateStatus('pm10Status', data.pm10, 'pm10');
  updateStatus('o3Status', data.o3, 'o3');
  updateStatus('no2Status', data.no2, 'no2');

  const lastUpdatedEl = document.getElementById('lastUpdated');
  if (lastUpdatedEl) {
    const now = new Date();
    lastUpdatedEl.textContent = `Cập nhật lần cuối lúc ${now.toLocaleTimeString('vi-VN')}`;
  }
}

// Khởi tạo biểu đồ PM2.5 24 giờ
function initializePollutionChart(pollutionPoints) {
  const canvasEl = document.getElementById('bieuDoO_Nhiem');
  if (!canvasEl) return;

  // Hủy biểu đồ cũ nếu có
  if (pollutionChart) {
    pollutionChart.destroy();
  }

  // Chuẩn bị dữ liệu
  const labels = pollutionPoints.map((_, idx) => idx + 'h');
  const pm25Values = pollutionPoints.map(p => p.pm25 || 0);

  // Tạo biểu đồ
  pollutionChart = new Chart(canvasEl, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: '💨 Bụi mịn PM2.5 (µg/m³)',
        data: pm25Values,
        borderColor: '#ff9500',
        backgroundColor: 'rgba(255, 149, 0, 0.1)',
        borderWidth: 2,
        fill: true,
        tension: 0.4,
        pointRadius: 3,
        pointHoverRadius: 5,
        pointBackgroundColor: '#ff9500',
        pointBorderColor: '#fff',
        pointBorderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: {
          display: true,
          labels: { color: '#333', usePointStyle: true }
        },
        tooltip: {
          backgroundColor: 'rgba(0,0,0,0.8)',
          padding: 12,
          titleColor: '#fff',
          bodyColor: '#fff',
          borderColor: '#ff9500',
          borderWidth: 1,
          callbacks: {
            label: (context) => `${context.parsed.y.toFixed(1)} µg/m³`
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { color: '#666' },
          grid: { color: 'rgba(0,0,0,0.05)' }
        },
        x: {
          ticks: { color: '#666' },
          grid: { color: 'rgba(0,0,0,0.05)' }
        }
      }
    }
  });
}

// Định dạng ngày giờ cho cảnh báo
function formatDateTime(timestamp) {
  if (!timestamp) return '--';
  const date = new Date(timestamp * 1000);
  return date.toLocaleString('vi-VN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

// Hiển thị cảnh báo ô nhiễm
function displayPollutionAlerts(alerts) {
  const alertsContainer = document.getElementById('pollutionAlerts');
  if (!alertsContainer) return;

  // Thêm cảnh báo mới vào lịch sử
  if (Array.isArray(alerts)) {
    alerts.forEach(alert => {
      // Luôn thêm cảnh báo mới vào lịch sử (không kiểm tra duplicates)
      pollutionAlertsHistory.unshift({
        pollutant: alert.pollutant,
        level: alert.level,
        value: alert.value,
        timestamp: Date.now() / 1000
      });

      // Xác định mức độ cảnh báo (severity)
      let severity = 'info';
      if (alert.level) {
        if (alert.level.includes('Nguy hiểm') || alert.level.includes('💀')) severity = 'critical';
        else if (alert.level.includes('Rất không tốt') || alert.level.includes('🚨')) severity = 'high';
        else if (alert.level.includes('Không tốt') || alert.level.includes('🛑')) severity = 'warning';
      }

      // Thêm vào lịch sử cảnh báo chung
      if (typeof alertHistoryManager !== 'undefined' && window.alertHistoryManager) {
        window.alertHistoryManager.addAlert({
          message: `Cảnh báo ${alert.pollutant}: ${alert.level}`,
          type: 'Ô nhiễm',
          severity: severity,
          value: alert.value,
          pollutant: alert.pollutant,
          details: `Nồng độ: ${alert.value ? alert.value.toFixed(1) : '--'} µg/m³`
        });
      }

      // Phát âm thanh và hiển thị toast khi có cảnh báo critical/high
      if (severity === 'critical' || severity === 'high') {
        // Gọi AlertManager để xử lý
        triggerPollutionAlert({
          message: `Cảnh báo ${alert.pollutant}: ${alert.level}`,
          type: 'Ô nhiễm',
          severity: severity,
          value: alert.value,
          pollutant: alert.pollutant,
          details: `Nồng độ: ${alert.value ? alert.value.toFixed(1) : '--'} µg/m³`
        });
      }
    });
  }

  // Giữ lại số lượng cảnh báo gần nhất
  pollutionAlertsHistory = pollutionAlertsHistory.slice(0, MAX_ALERTS);

  // Render cảnh báo
  if (pollutionAlertsHistory.length === 0) {
    alertsContainer.innerHTML = '<div class="alert-empty">✅ Không có cảnh báo</div>';
    return;
  }

  alertsContainer.innerHTML = pollutionAlertsHistory.map((alert, idx) => {
    const levelClass = alert.level ? alert.level.toLowerCase().replace(/\s+/g, '-') : 'info';
    const icon = alert.level && alert.level.includes('Tốt') ? '✅' : alert.level && alert.level.includes('không tốt') ? '🛑' : 'ℹ️';

    return `
      <div class="alert-item alert-${levelClass}" key="${idx}">
        <div class="alert-header">
          <span class="alert-icon">${icon}</span>
          <span class="alert-event">${alert.pollutant}</span>
          <span class="alert-time">${formatDateTime(alert.timestamp)}</span>
        </div>
        <div class="alert-description">Nồng độ: ${alert.value ? alert.value.toFixed(1) : '--'} - ${alert.level || ''}</div>
      </div>
    `;
  }).join('');
}

// Khởi tạo trang và Event Listeners
document.addEventListener('DOMContentLoaded', () => {
  console.log('🔄 Đang khởi tạo trang ô nhiễm...');

  // Nút cập nhật
  const btnUpdate = document.getElementById('btnUpdatePollution');
  if (btnUpdate) {
    btnUpdate.addEventListener('click', async () => {
      // Hàm giả định: Tắt nút Header
      if (typeof disableHeaderButtons === 'function') disableHeaderButtons(btnUpdate);
      try {
        console.log('🔄 Đang cập nhật dữ liệu ô nhiễm...');
        await refreshPollutionData();
      } finally {
        // Hàm giả định: Bật lại nút Header
        if (typeof enableHeaderButtons === 'function') enableHeaderButtons();
      }
    });
  }

  // Chức năng Chat
  const chatInput = document.getElementById('chatNhapPollution');
  const chatBtn = document.getElementById('chatGuiPollution');

  if (chatBtn) {
    chatBtn.addEventListener('click', () => {
      if (chatInput && chatInput.value.trim()) {
        sendTopicChat('pollution', 'chatNhapPollution', 'chatLogPollution');
      }
    });
  }

  if (chatInput) {
    chatInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (chatBtn) chatBtn.click();
      }
    });
  }


  // Tải dữ liệu ban đầu
  refreshPollutionData().then(() => {
    console.log('✅ Đã tải dữ liệu ô nhiễm ban đầu');
  });


  // Tự động làm mới mỗi 30 giây
  if (autoRefreshInterval) clearInterval(autoRefreshInterval);
  autoRefreshInterval = setInterval(async () => {
    console.log('🔄 Tự động làm mới dữ liệu ô nhiễm (30 giây)');
    await refreshPollutionData();
  }, AUTO_REFRESH_INTERVAL);

  console.log('✅ Trang ô nhiễm đã khởi tạo');
});

// Cleanup khi rời khỏi page
window.addEventListener('beforeunload', () => {
  if (autoRefreshInterval) {
    clearInterval(autoRefreshInterval);
    autoRefreshInterval = null;
  }
});

console.log('✅ pollution.js đã tải');