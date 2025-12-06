// Kết nối Socket.IO cho đồng bộ dữ liệu realtime
const socket = io();

let lastRiskLevel = "normal";
let isReady = false;

// Đợi DOM sẵn sàng
document.addEventListener('DOMContentLoaded', () => {
  isReady = true;
});

// Xử lý dữ liệu cảm biến realtime và kiểm tra ngưỡng cảnh báo
socket.on("capNhat", (data) => {
  try {
    if (!isReady) return;
    const d = data.dulieu;

    console.log('📨 Socket capNhat:', { data, d });
    console.log('🔍 AlertManager ready?', typeof alertManager !== 'undefined' && window.alertManager);
    console.log('🔍 ThresholdAlertSystem ready?', typeof thresholdAlertSystem !== 'undefined' && window.thresholdAlertSystem);

    // Cập nhật giao diện
    if (typeof capNhatThongSo === 'function') capNhatThongSo(d);
    if (typeof themDuLieu === 'function') {
      const tempChartInstance = window.bieuDoNhietDo || tempChart;
      if (tempChartInstance) themDuLieu(tempChartInstance, d.thoigian, d.nhietDo);
    }
    if (typeof themDuLieu === 'function') {
      const humidityChartInstance = window.bieuDoDoAm || humidityChart;
      if (humidityChartInstance) themDuLieu(humidityChartInstance, d.thoigian, d.doAm);
    }
    if (typeof onSensorDataUpdate === 'function') onSensorDataUpdate(d);

    // Kiểm tra ngưỡng cảnh báo từ client
    if (typeof thresholdAlertSystem !== 'undefined' && d) {
      console.log('✅ Calling thresholdAlertSystem.checkAndAlert');
      thresholdAlertSystem.checkAndAlert(d);
    }

    // Process alerts from server (nếu có)
    if (data.alerts && data.alerts.length > 0 && typeof alertManager !== 'undefined') {
      console.log('✅ Server alerts:', data.alerts);
      alertManager.processAlerts(data);
      lastRiskLevel = data.riskLevel || 'high';
    }
  } catch (e) {
    console.error('❌ Lỗi trong trình xử lý capNhat:', e);
  }
});

// Nhận dữ liệu từ server
socket.on('duBaoTraVe', (data) => {
  // Handled by forecast chart via /api/data/history
});

// Nhận cập nhật thống kê từ server
socket.on('thongKeTraVe', (payload) => {
  // Handled by stats.js modal
});

// Nhận cập nhật thống kê realtime
socket.on('statsUpdate', (data) => {
  try {
    const modalStats = document.getElementById('modalThongKe');
    if (modalStats && modalStats.classList.contains('show')) {
    }
  } catch (e) {
    console.error('statsUpdate handler error:', e);
  }
});

// Nhận khuyến nghị từ AI (async)
socket.on('aiRecommendation', (data) => {
  try {
    if (data.recommendations && window.alertManager) {
      console.log('💡 Nhận khuyến nghị AI:', data.recommendations);
      // Cập nhật khuyến nghị vào container cảnh báo
      const container = window.alertManager.alertContainer;
      if (container) {
        const recSection = container.querySelector('.recommendations-section');
        if (recSection) {
          const list = recSection.querySelector('.recommendations-list');
          data.recommendations.forEach(rec => {
            const li = document.createElement('li');
            li.className = 'recommendation-item';
            li.innerHTML = `<span class="ai-badge">🤖 AI</span> ${rec.message || rec}`;
            list.appendChild(li);
          });
        }
      }
    }
  } catch (e) {
    console.error('aiRecommendation handler error:', e);
  }
});
