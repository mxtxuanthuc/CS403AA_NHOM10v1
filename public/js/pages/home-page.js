// --- LOGIC TRANG CHỦ (HOME PAGE) ---
// Tổng quan Dashboard với các chỉ số nhanh và cảnh báo gần đây.

let homeAlertHistory = [];
const MAX_HOME_ALERTS = 15;

// Thêm cảnh báo vào Dashboard trang chủ
window.addToHomeAlertHistory = (message, type = 'warning', icon = '⚠️') => {
  const now = new Date();
  const timeStr = now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

  // Thêm cảnh báo mới vào đầu mảng
  homeAlertHistory.unshift({
    message,
    type,
    icon,
    time: timeStr,
    timestamp: now.getTime()
  });

  // Giữ số lượng cảnh báo tối đa
  if (homeAlertHistory.length > MAX_HOME_ALERTS) {
    homeAlertHistory.pop();
  }

  updateHomeAlertDisplay();
};

// Cập nhật khu vực hiển thị cảnh báo trên trang chủ
function updateHomeAlertDisplay() {
  const historyEl = document.getElementById('homeAlertHistory');
  if (!historyEl) return;

  if (homeAlertHistory.length === 0) {
    historyEl.innerHTML = '<div class="alert-empty">✅ Không có cảnh báo gần đây</div>';
    return;
  }

  historyEl.innerHTML = homeAlertHistory.map((alert, idx) => `
    <div class="alert-item alert-${alert.type}">
      <div class="alert-header">
        <span class="alert-icon">${alert.icon}</span>
        <span class="alert-time">${alert.time}</span>
      </div>
      <div class="alert-msg">${alert.message}</div>
    </div>
  `).join('');
}

// Cập nhật các chỉ số nhanh trên Dashboard
function updateHomeQuickStats(data) {
  if (!data) return;

  // Nhiệt độ
  const homeTemp = document.getElementById('homeTemp');
  if (homeTemp && data.nhietDo !== undefined) {
    homeTemp.textContent = data.nhietDo.toFixed(1) + '°C';
  }

  // Độ ẩm
  const homeHumidity = document.getElementById('homeHumidity');
  if (homeHumidity && data.doAm !== undefined) {
    homeHumidity.textContent = data.doAm.toFixed(1) + '%';
  }

  // Pin
  const homeBattery = document.getElementById('homeBattery');
  if (homeBattery && data.pin !== undefined) {
    homeBattery.textContent = data.pin.toFixed(0) + '%';
  }
}

// Khởi tạo trang chủ
document.addEventListener('DOMContentLoaded', () => {
  console.log('🔄 Đang khởi tạo trang chủ...');

  // Thiết lập Socket listeners để nhận cập nhật thời gian thực
  if (typeof socket !== 'undefined') {
    // Cập nhật dữ liệu cảm biến
    socket.on('capNhat', (data) => {
      updateHomeQuickStats(data);
    });

    // Nhận cảnh báo mới
    socket.on('canhBao', (message) => {
      window.addToHomeAlertHistory(message.message, message.type || 'warning', message.icon || '⚠️');
    });
  }

  // Chức năng Chat/Voice (Sử dụng Speech-to-Text)
  const voiceBtn = document.getElementById('btnVoice');

  if (voiceBtn) {
    voiceBtn.addEventListener('click', () => {
        if (typeof speechRecognition !== 'undefined') {
            speechRecognition.start();
        } else {
            alert("Trình duyệt không hỗ trợ STT");
        }
    });
  }

  // Lấy dữ liệu thống kê ban đầu
  fetch('/api/data/latest')
    .then(res => res.json())
    .then(data => {
      if (data) {
        updateHomeQuickStats(data);
      }
    })
    .catch(err => console.error('❌ Lỗi tải thống kê trang chủ:', err));

  console.log('✅ Trang chủ đã khởi tạo');
});

console.log('✅ home-page.js đã tải');