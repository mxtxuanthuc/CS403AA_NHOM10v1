// --- LOGIC TRANG DỰ BÁO THỜI TIẾT ---
// Xử lý dữ liệu thời tiết hiện tại, dự báo, cảnh báo và biểu đồ.

let currentWeatherData = {};
let precipChart = null;
let uvIndexChart = null; // Biểu đồ UV không được dùng nhưng giữ lại để bảo toàn trạng thái
let weatherAlertsHistory = [];
const MAX_ALERTS = 20;

// Ánh xạ điều kiện thời tiết sang Icon Emoji
function getWeatherIcon(condition) {
  if (!condition) return '🌤️';
  const lower = condition.toLowerCase();

  const iconMap = {
    'clear': '☀️',
    'sunny': '☀️',
    'cloudless': '☀️',
    'cloudy': '☁️',
    'partly cloudy': '⛅',
    'overcast': '☁️',
    'rainy': '🌧️',
    'rain': '🌧️',
    'drizzle': '🌦️',
    'thunderstorm': '⛈️',
    'thunder': '⛈️',
    'snow': '❄️',
    'sleet': '🌨️',
    'mist': '🌫️',
    'fog': '🌫️',
    'haze': '🌫️',
    'dust': '🌪️',
    'squall': '🌪️'
  };

  for (const [key, icon] of Object.entries(iconMap)) {
    if (lower.includes(key)) return icon;
  }
  return '🌤️';
}

// Định dạng thời gian từ Unix timestamp
function formatTime(timestamp) {
  if (!timestamp) return '--';
  const date = new Date(timestamp * 1000);
  return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
}

// Định dạng ngày giờ cho cảnh báo
function formatDateTime(timestamp) {
  if (!timestamp) return '--';
  const date = new Date(timestamp * 1000);
  return date.toLocaleString('vi-VN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

// Gọi API lấy dữ liệu dự báo thời tiết
async function fetchForecast() {
  const loader = document.getElementById('weatherLoader');
  try {
    if(loader) loader.style.display = 'block';
    console.log('🌤️ Đang tải dữ liệu dự báo từ OpenWeatherMap...');
    const response = await fetch('/api/forecast');
    if (!response.ok) {
        const error = new Error(`HTTP ${response.status}`);
        error.response = response;
        throw error;
    }

    const payload = await response.json();

    // Cập nhật thời tiết hiện tại
    if (payload.current && Object.keys(payload.current).length > 0) {
      currentWeatherData = payload.current;
      updateWeatherDisplay();
      console.log('✅ Thời tiết hiện tại đã cập nhật:', currentWeatherData);
    }

    // Khởi tạo biểu đồ lượng mưa 
    if (Array.isArray(payload.rainPoints) && payload.rainPoints.length > 0) {
      initializeRainChart(payload.rainPoints);
      console.log('📈 Biểu đồ mưa đã khởi tạo với', payload.rainPoints.length, 'điểm');
    }

    // Hiển thị cảnh báo thời tiết
    if (Array.isArray(payload.alerts) && payload.alerts.length > 0) {
      displayWeatherAlerts(payload.alerts);
      console.log('⚠️ Cảnh báo thời tiết đã cập nhật:', payload.alerts.length, 'cảnh báo');
    }

    // Cập nhật tóm tắt dự báo
    const rainSummaryEl = document.getElementById('rainSummary');
    if (rainSummaryEl && payload.summary) {
        rainSummaryEl.textContent = payload.summary;
    }

    console.log('✅ Tải dữ liệu dự báo thành công');
  } catch (error) {
    console.error('❌ Lỗi tải dự báo:', error);
    let errorMessage = 'Lỗi tải dự báo. Vui lòng kiểm tra lại API key và kết nối mạng.';
    if (error.response) {
        errorMessage = `Lỗi từ máy chủ: ${error.response.status}. Vui lòng thử lại.`;
        try {
            const errorData = await error.response.json();
            console.error('Dữ liệu lỗi server:', errorData);
            errorMessage = `Lỗi tải dự báo: ${errorData.error || error.message}`;
        } catch (e) {
            console.error('Không thể phân tích JSON lỗi:', e);
        }
    }
    if (typeof showStatus === 'function') {
      showStatus(errorMessage, 'error');
    }
  } finally {
    if(loader) loader.style.display = 'none';
  }
}

// Khởi tạo và vẽ biểu đồ Lượng mưa
function initializeRainChart(forecastPoints) {
  const canvasEl = document.getElementById('bieuDoMua');
  if (!canvasEl) return;

  // Hủy biểu đồ cũ nếu có
  if (precipChart) {
    precipChart.destroy();
  }

  // Chuẩn bị nhãn (thời gian)
  const allLabels = forecastPoints.map(p => {
    // Xử lý cả Unix timestamp (giây) và miligiây
    const time = p.time > 10000000000 ? p.time : p.time * 1000;
    const date = new Date(time);
    return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  });

  const labels = allLabels;

  // Chuẩn bị dữ liệu (Lượng mưa)
  const rainAmounts = forecastPoints.map(p => parseFloat(p.luongMua || 0));

  // Tạo biểu đồ thanh (Bar Chart)
  precipChart = new Chart(canvasEl, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: '☔ Lượng mưa (mm)',
        data: rainAmounts,
        backgroundColor: '#4a90e2',
        borderColor: '#357abd',
        borderWidth: 1,
        borderRadius: 4,
        hoverBackgroundColor: '#357abd'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: {
          display: true,
          labels: {
            color: '#333',
            usePointStyle: true,
            padding: 15,
            font: { size: 12 }
          }
        },
        tooltip: {
          backgroundColor: 'rgba(0,0,0,0.8)',
          padding: 12,
          titleColor: '#fff',
          bodyColor: '#fff',
          borderColor: '#4a90e2',
          borderWidth: 1,
          callbacks: {
            title: (context) => {
              if (context.length > 0) {
                const idx = context[0].dataIndex;
                return allLabels[idx] || 'N/A';
              }
              return 'N/A';
            },
            label: (context) => `${context.parsed.y.toFixed(1)} mm`
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            color: '#666',
            callback: function(value) {
              return value + " mm"
            }
          },
          grid: { color: 'rgba(0,0,0,0.05)' },
          title: {
            display: true,
            text: 'Lượng mưa (mm)',
            color: '#333'
          }
        },
        x: {
          ticks: {
            color: '#666',
            maxRotation: 45,
            minRotation: 0,
            font: { size: 10 },
            maxTicksLimit: 24
          },
          grid: { display: false },
          title: {
            display: true,
            text: 'Thời gian',
            color: '#333'
          }
        }
      }
    }
  });
}

// Cập nhật khu vực hiển thị thời tiết hiện tại
function updateWeatherDisplay() {
  const data = currentWeatherData;

  // Thông tin thời tiết chính
  const weatherIcon = document.getElementById('weatherIcon');
  if (weatherIcon) weatherIcon.textContent = getWeatherIcon(data.condition || '');

  const weatherCondition = document.getElementById('weatherCondition');
  if (weatherCondition) weatherCondition.textContent = data.condition || 'Chưa có dữ liệu';

  const weatherTemp = document.getElementById('weatherTemp');
  if (weatherTemp) weatherTemp.textContent = Math.round(data.temp || 0);

  // Chi tiết (Độ ẩm, Gió, Khả năng mưa)
  const weatherHumidity = document.getElementById('weatherHumidity');
  if (weatherHumidity) weatherHumidity.textContent = (data.humidity || 0) + '%';

  const weatherWind = document.getElementById('weatherWind');
  if (weatherWind) weatherWind.textContent = (data.windSpeed || 0).toFixed(1) + ' m/s';

  const weatherRain = document.getElementById('weatherRain');
  if (weatherRain) weatherRain.textContent = (data.rainChance || 0) + '%';

  const weatherVisibility = document.getElementById('weatherVisibility');
  if (weatherVisibility) weatherVisibility.textContent = (data.visibility || 0).toFixed(1) + ' km';

  // Thông tin mặt trời và mây
  const sunrise = document.getElementById('sunrise');
  if (sunrise) {
    const sunriseTime = formatTime(data.sunrise) || '--';
    sunrise.textContent = sunriseTime;
  }

  const sunset = document.getElementById('sunset');
  if (sunset) {
    const sunsetTime = formatTime(data.sunset) || '--';
    sunset.textContent = sunsetTime;
  }

  const cloudCover = document.getElementById('cloudCover');
  if (cloudCover) {
    const cloudPercent = data.cloudCover || 0;
    cloudCover.textContent = cloudPercent + '%';

    // Cập nhật thanh tiến trình mây
    const cloudProgress = document.getElementById('cloudProgress');
    if (cloudProgress) {
      cloudProgress.style.width = cloudPercent + '%';
    }
  }

  // Điểm sương (Dew Point)
  const dewPointMain = document.getElementById('dewPoint');
  if (dewPointMain) {
    const dewValue = data.dewPoint !== null && data.dewPoint !== undefined ? data.dewPoint.toFixed(1) : '--';
    dewPointMain.textContent = dewValue + ' °C';

    // Cập nhật trạng thái điểm sương
    const dewStatus = document.getElementById('dewStatus');
    if (dewStatus) {
      if (data.dewPoint === null || data.dewPoint === undefined) {
        dewStatus.textContent = 'Không có dữ liệu';
      } else if (data.dewPoint < 0) {
        dewStatus.textContent = '❄️ Rất lạnh';
      } else if (data.dewPoint < 10) {
        dewStatus.textContent = '🥶 Lạnh';
      } else if (data.dewPoint < 15) {
        dewStatus.textContent = '😊 Thoải mái';
      } else if (data.dewPoint < 20) {
        dewStatus.textContent = '☁️ Ẩm ướt';
      } else {
        dewStatus.textContent = '💦 Rất ẩm ướt';
      }
    }
  }

  // Áp suất khí quyển
  const pressure = document.getElementById('pressure');
  if (pressure) {
    pressure.textContent = (data.pressure || 0) + ' hPa';

    // Cập nhật trạng thái áp suất
    const pressureStatus = document.getElementById('pressureStatus');
    if (pressureStatus) {
      const pres = data.pressure || 1013;
      if (pres < 1000) {
        pressureStatus.textContent = '⬇️ Thấp (Mưa có thể)';
      } else if (pres < 1013) {
        pressureStatus.textContent = '📉 Giảm';
      } else if (pres > 1025) {
        pressureStatus.textContent = '📈 Cao (Trời đẹp)';
      } else {
        pressureStatus.textContent = '✅ Bình thường';
      }
    }
  }

  // Gió giật (Wind Gust)
  const windGust = document.getElementById('windGust');
  if (windGust) {
    windGust.textContent = (data.windGust || 0).toFixed(1) + ' m/s';

    // Cập nhật trạng thái gió giật
    const windGustStatus = document.getElementById('windGustStatus');
    if (windGustStatus) {
      const gust = data.windGust || 0;
      if (gust < 5) {
        windGustStatus.textContent = '🌬️ Yên tĩnh';
      } else if (gust < 10) {
        windGustStatus.textContent = '💨 Nhẹ';
      } else if (gust < 15) {
        windGustStatus.textContent = '🌪️ Trung bình';
      } else if (gust < 20) {
        windGustStatus.textContent = '⚡ Mạnh';
      } else {
        windGustStatus.textContent = '🌀 Rất mạnh';
      }
    }
  }

  // Chi tiết Khả năng hiển thị (Visibility)
  const visibilityDetail = document.getElementById('visibilityDetail');
  if (visibilityDetail) {
    const vis = data.visibility || 0;
    visibilityDetail.textContent = vis.toFixed(1) + ' km';

    // Cập nhật trạng thái khả năng hiển thị
    const visibilityStatus = document.getElementById('visibilityStatus');
    if (visibilityStatus) {
      if (vis < 1) {
        visibilityStatus.textContent = '❌ Rất xấu';
      } else if (vis < 5) {
        visibilityStatus.textContent = '⚠️ Kém';
      } else if (vis < 10) {
        visibilityStatus.textContent = '😐 Trung bình';
      } else {
        visibilityStatus.textContent = '✅ Tốt';
      }
    }
  }

  // Chi tiết Độ ẩm
  const humidityDetail = document.getElementById('humidityDetail');
  if (humidityDetail) {
    const humidity = data.humidity || 0;
    humidityDetail.textContent = humidity + '%';

    // Cập nhật trạng thái độ ẩm
    const humidityStatus = document.getElementById('humidityStatus');
    if (humidityStatus) {
      if (humidity < 30) {
        humidityStatus.textContent = '🏜️ Khô';
      } else if (humidity < 50) {
        humidityStatus.textContent = '✅ Thoải mái';
      } else if (humidity < 70) {
        humidityStatus.textContent = '😐 Ẩm';
      } else {
        humidityStatus.textContent = '💦 Rất ẩm';
      }
    }
  }
}

// Hiển thị cảnh báo thời tiết trong khu vực lịch sử
function displayWeatherAlerts(alerts) {
  const alertsContainer = document.getElementById('weatherAlerts');
  if (!alertsContainer) return;

  // Thêm cảnh báo mới vào lịch sử (unshift: thêm vào đầu)
  alerts.forEach(alert => {
    weatherAlertsHistory.unshift({
      event: alert.event,
      description: alert.description,
      severity: alert.severity || 'info',
      timestamp: Date.now() / 1000
    });

    // Thêm vào lịch sử cảnh báo chung nếu AlertManager có sẵn
    if (typeof alertHistoryManager !== 'undefined' && window.alertHistoryManager) {
      window.alertHistoryManager.addAlert({
        message: `Cảnh báo thời tiết: ${alert.event}`,
        type: 'Thời tiết',
        severity: alert.severity || 'info',
        details: alert.description || 'Thông báo thời tiết',
        value: null,
        pollutant: null
      });
    }
  });

  // Giữ lại số lượng cảnh báo gần nhất
  weatherAlertsHistory = weatherAlertsHistory.slice(0, MAX_ALERTS);

  // Render cảnh báo
  if (weatherAlertsHistory.length === 0) {
    alertsContainer.innerHTML = '<div class="alert-empty">✅ Không có cảnh báo</div>';
    return;
  }

  alertsContainer.innerHTML = weatherAlertsHistory.map((alert, idx) => {
    const severityClass = getSeverityClass(alert.severity);
    const severityIcon = getSeverityIcon(alert.severity);
    return `
      <div class="alert-item ${severityClass}" key="${idx}">
        <div class="alert-header">
          <span class="alert-icon">${severityIcon}</span>
          <span class="alert-event">${alert.event}</span>
          <span class="alert-time">${formatDateTime(alert.timestamp)}</span>
        </div>
        <div class="alert-description">${alert.description || ''}</div>
      </div>
    `;
  }).join('');
}

// Lấy CSS class cho mức độ cảnh báo
function getSeverityClass(severity) {
  const severityMap = {
    'critical': 'alert-critical',
    'warning': 'alert-warning',
    'info': 'alert-info',
    'success': 'alert-success'
  };
  return severityMap[severity] || 'alert-info';
}

// Lấy Icon Emoji cho mức độ cảnh báo
function getSeverityIcon(severity) {
  const iconMap = {
    'critical': '🚨',
    'warning': '⚠️',
    'info': 'ℹ️',
    'success': '✅'
  };
  return iconMap[severity] || 'ℹ️';
}

// Hàm hiển thị trạng thái
function showStatus(message, type = 'info') {
  console.log(`[${type.toUpperCase()}] ${message}`);
  // Có thể tích hợp với hệ thống thông báo toast
}

// Khởi tạo trang và Event Listeners
document.addEventListener('DOMContentLoaded', () => {
  console.log('🔄 Đang khởi tạo trang dự báo...');

  // Nút làm mới
  const btnRefresh = document.getElementById('btnRefreshForecast');
  if (btnRefresh) {
    btnRefresh.addEventListener('click', async () => {
      // Hàm giả định: Tắt nút Header (cần hàm disableHeaderButtons toàn cục)
      if (typeof disableHeaderButtons === 'function') disableHeaderButtons(btnRefresh); 
      try {
        showStatus('🔄 Cập nhật dự báo...', 'info');
        await fetchForecast();
      } finally {
        // Hàm giả định: Bật lại nút Header (cần hàm enableHeaderButtons toàn cục)
        if (typeof enableHeaderButtons === 'function') enableHeaderButtons(); 
      }
    });
  }

  // Chức năng Chat (dùng hàm toàn cục sendTopicChat)
  const chatInput = document.getElementById('chatNhapForecast');
  const chatBtn = document.getElementById('chatGuiForecast');

  if (chatBtn) {
    chatBtn.addEventListener('click', () => {
      if (chatInput && chatInput.value.trim()) {
        sendTopicChat('forecast', 'chatNhapForecast', 'chatLogForecast');
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
  console.log('📥 Đang tải dữ liệu dự báo ban đầu...');
  fetchForecast();

  // Tự động làm mới mỗi 10 phút
  setInterval(() => {
    // Dòng đã được thay đổi
    console.log('🔄 Tự động làm mới dự báo (10 phút)');
    fetchForecast();
  }, 10 * 60 * 1000);

  console.log('✅ Trang dự báo đã khởi tạo');
});

console.log('✅ Trang dự báo đã tải');