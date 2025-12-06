// Module Thống kê (Statistics) - Cải tiến

// ===== QUẢN LÝ TRẠNG THÁI NỘI BỘ =====
const statsState = {
  // Biểu đồ thống kê chính
  chartInstance: null, 
  // Biểu đồ lịch sử (nếu có)
  historyChartInstance: null, 
  // ID interval làm mới (không dùng)
  updateInterval: null, 
  // Thời gian cập nhật gần nhất
  lastUpdate: null, 
  // Trạng thái mở/đóng Modal
  isModalOpen: false,
  // Tổng số cảnh báo lũy kế (lưu LocalStorage)
  cumulativeAlerts: 0, 
  // Số lượng cảnh báo lần cuối (dùng cho so sánh)
  lastAlertCount: 0,
  // Ngưỡng cập nhật biểu đồ (1 giờ)
  chartUpdateThreshold: 1 * 60 * 60 * 1000
};

// ===== KHỞI TẠO MODULE =====
document.addEventListener('DOMContentLoaded', function() {
  initializeStatsModule();
});

// Khởi tạo Module Thống kê (tải dữ liệu, thiết lập UI, kết nối Socket).
function initializeStatsModule() {
  // Tải dữ liệu đã lưu (số cảnh báo lũy kế)
  loadCumulativeAlerts();

  // Thiết lập các Event Listener
  setupEventListeners();

  // Thiết lập chức năng Tab (Tổng quan, Lịch sử)
  setupStatsTabs();

  // Lắng nghe sự kiện từ Socket (nếu có)
  if (typeof socket !== 'undefined') {
    socket.on('statsUpdate', handleStatsUpdate);
  }

  console.log('✅ Stats module initialized');
}

// ===== THIẾT LẬP EVENT LISTENERS =====
// Thiết lập các Event Listener cho các nút chức năng.
function setupEventListeners() {
  const btnThongKe = document.getElementById('btnThongKe');
  const btnClearAllStats = document.getElementById('btnClearAllStats');
  const btnExportAlertHistory = document.getElementById('btnExportAlertHistory');
  const btnClearAlertHistory = document.getElementById('btnClearAlertHistory');
  const closeStatsBtn = document.getElementById('closeStatsBtn');
  const modal = document.getElementById('modalThongKe');
  const modalContent = document.querySelector('.stats-modal');

  if (btnThongKe) {
    btnThongKe.addEventListener('click', openStatsModal);
  }

  if (btnClearAllStats) {
    btnClearAllStats.addEventListener('click', clearAllStatistics);
  }

  if (btnExportAlertHistory) {
    btnExportAlertHistory.addEventListener('click', exportAlertHistory);
  }

  if (btnClearAlertHistory) {
    btnClearAlertHistory.addEventListener('click', clearAlertHistory);
  }

  if (closeStatsBtn) {
    closeStatsBtn.addEventListener('click', closeStatsModal);
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
      if (e.target === modal) {
        e.stopPropagation();
        console.log('🔒 Stats modal click outside blocked - must use close button');
      }
    });
  }
}

// ===== QUẢN LÝ MODAL =====

// Mở Modal Thống kê, tải dữ liệu, vẽ biểu đồ và khởi động làm mới lịch sử cảnh báo.
async function openStatsModal() {
  const modal = document.getElementById('modalThongKe');
  if (!modal) return;

  statsState.isModalOpen = true;
  modal.classList.add('show');

  // Tải dữ liệu thống kê qua API
  try {
    const response = await fetch('/api/statistics');
    const stats = await response.json();

    updateStatsDisplay(stats.today);
    drawStatsChart(stats.data || []);

    // Lưu cache (nếu có DataPersistence)
    if (typeof DataPersistence !== 'undefined') {
      DataPersistence.cacheStatsData(stats.today, stats.data || []);
    }
  } catch (error) {
    console.error('Lỗi tải thống kê:', error);
    showStatsError('Lỗi tải thống kê');
  }

  // Khởi động làm mới lịch sử cảnh báo
  if (typeof alertHistoryManager !== 'undefined') {
    alertHistoryManager.startAutoRefresh();
    // Cập nhật ngay số cảnh báo từ lịch sử
    updateKPICard('statAlerts', alertHistoryManager.history.length);
  }
}

// Đóng Modal Thống kê và dừng làm mới tự động.
function closeStatsModal() {
  const modal = document.getElementById('modalThongKe');
  if (modal) {
    modal.classList.remove('show');
    statsState.isModalOpen = false;
  }

  // Dừng tự động làm mới lịch sử cảnh báo
  if (typeof alertHistoryManager !== 'undefined') {
    alertHistoryManager.stopAutoRefresh();
  }

  // Xóa interval cập nhật (nếu đang chạy)
  if (statsState.updateInterval) {
    clearInterval(statsState.updateInterval);
  }
}

// ===== THEO DÕI CẢNH BÁO LŨY KẾ =====

// Tải số cảnh báo lũy kế từ LocalStorage.
function loadCumulativeAlerts() {
  try {
    const saved = localStorage.getItem('cumulativeAlertCount');
    if (saved) {
      statsState.cumulativeAlerts = parseInt(saved, 10);
    }

    const savedCount = localStorage.getItem('lastAlertHistoryLength');
    if (savedCount) {
      statsState.lastAlertCount = parseInt(savedCount, 10);
    }
  } catch (error) {
    console.error('Lỗi tải cảnh báo lũy kế:', error);
  }
}

// Lưu số cảnh báo lũy kế vào LocalStorage.
function saveCumulativeAlerts() {
  try {
    localStorage.setItem('cumulativeAlertCount', statsState.cumulativeAlerts.toString());
    localStorage.setItem('lastAlertHistoryLength', statsState.lastAlertCount.toString());
  } catch (error) {
    console.error('Lỗi lưu cảnh báo lũy kế:', error);
  }
}

// ===== XỬ LÝ CẬP NHẬT TỪ SOCKET =====

// Xử lý dữ liệu thống kê cập nhật từ Socket.
function handleStatsUpdate(data) {
  // Chỉ cập nhật nếu Modal đang mở
  if (!statsState.isModalOpen) return;

  updateStatsDisplay(data.stats);
  statsState.lastUpdate = data.timestamp;

  // Cập nhật biểu đồ nếu đã quá ngưỡng thời gian
  const now = Date.now();
  if (now - statsState.chartUpdateThreshold >= 0) {
    if (data.data && data.data.length > 0) {
      drawStatsChart(data.data);
    }
  }
}

// ===== CẬP NHẬT HIỂN THỊ THỐNG KÊ (KPI) =====

// Cập nhật các chỉ số KPI trên Modal.
function updateStatsDisplay(stats) {
  if (!stats) return;

  // Cập nhật số cảnh báo (lấy từ lịch sử thực tế)
  if (typeof alertHistoryManager !== 'undefined' && alertHistoryManager.history) {
    const currentCount = alertHistoryManager.history.length;
    updateKPICard('statAlerts', currentCount);
    statsState.lastAlertCount = currentCount;
  }

  // Cập nhật các thẻ KPI
  updateKPICard('statTempAvg', `${stats.nhieuDoBinhQuan || '--'}°C`);
  updateKPICard('statHumidityAvg', `${stats.doAmBinhQuan || '--'}%`);

  // Cập nhật thời gian cuối cùng
  updateLastUpdateTime();

  // Thêm hiệu ứng cập nhật
  addPulseAnimation(['statAlerts', 'statTempAvg', 'statHumidityAvg']);
}

// Cập nhật giá trị cho một thẻ KPI cụ thể.
function updateKPICard(elementId, value) {
  const element = document.getElementById(elementId);
  if (element) element.textContent = value || '--';
}

// Cập nhật thời gian cập nhật gần nhất.
function updateLastUpdateTime() {
  const timeElement = document.querySelector('.stats-last-update');
  if (timeElement && statsState.lastUpdate) {
    const time = new Date(statsState.lastUpdate).toLocaleTimeString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
    timeElement.textContent = `Cập nhật lúc: ${time}`;
  }
}

// Thêm hiệu ứng Pulse cho các thẻ KPI được cập nhật.
function addPulseAnimation(elementIds) {
  elementIds.forEach(id => {
    const element = document.getElementById(id);
    if (element) {
      element.classList.add('updating');
      setTimeout(() => element.classList.remove('updating'), 600);
    }
  });
}

// ===== VẼ BIỂU ĐỒ =====

// Xóa và vẽ lại biểu đồ Thống kê.
function drawStatsChart(data) {
  const canvas = document.getElementById('statsChart');
  if (!canvas) return;

  try {
    if (!data || data.length === 0) return;

    // Chuẩn bị dữ liệu
    const labels = data.map(d => d.time || 'N/A');
    const tempData = data.map(d => parseFloat(d.nhietDo) || 0);
    const humidityData = data.map(d => parseFloat(d.doAm) || 0);
    const batteryData = data.map(d => parseFloat(d.pin) || 0);

    // Hủy biểu đồ cũ nếu tồn tại
    if (statsState.chartInstance) {
      statsState.chartInstance.destroy();
    }

    // Tạo biểu đồ mới
    statsState.chartInstance = new Chart(canvas, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: '🌡️ Nhiệt độ (°C)',
            data: tempData,
            backgroundColor: '#ff6b6b',
            borderColor: '#d63447',
            borderWidth: 1,
            borderRadius: 4,
            yAxisID: 'y'
          },
          {
            label: '💧 Độ ẩm (%)',
            data: humidityData,
            backgroundColor: '#4a90e2',
            borderColor: '#2e5c99',
            borderWidth: 1,
            borderRadius: 4,
            yAxisID: 'y'
          },
          {
            label: '🔋 Pin (%)',
            data: batteryData,
            backgroundColor: '#4cd137',
            borderColor: '#36a019',
            borderWidth: 1,
            borderRadius: 4,
            yAxisID: 'y'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        animation: { duration: 300 },
        interaction: {
          mode: 'index',
          intersect: false
        },
        plugins: {
          legend: {
            display: true,
            labels: {
              font: { size: 12 },
              padding: 15,
              usePointStyle: true
            }
          },
          tooltip: {
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            padding: 12,
            titleFont: { size: 13, weight: 'bold' },
            bodyFont: { size: 12 },
            borderColor: '#fff',
            borderWidth: 1
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            max: 100,
            ticks: {
              font: { size: 11 }
            },
            grid: {
              color: 'rgba(0, 0, 0, 0.05)',
              drawBorder: true
            }
          },
          x: {
            ticks: {
              font: { size: 10 }
            },
            grid: {
              display: false
            }
          }
        }
      }
    });
  } catch (error) {
    console.error('Lỗi vẽ biểu đồ:', error);
  }
}

// ===== XÓA THỐNG KÊ =====

// Xóa toàn bộ thống kê (dữ liệu lịch sử, cảnh báo và biểu đồ).
async function clearAllStatistics() {
  if (!confirm('⚠️ Bạn chắc chắn muốn xóa tất cả thống kê? Hành động này không thể hoàn tác.')) {
    return;
  }

  try {
    // Gọi API xóa dữ liệu trên Server
    const response = await fetch('/api/data/clear', { method: 'DELETE' });

    if (!response.ok) {
      throw new Error(`Lỗi HTTP: ${response.status}`);
    }

    const result = await response.json();

    if (result.success || response.ok) {
      // Reset trạng thái và LocalStorage
      statsState.cumulativeAlerts = 0;
      statsState.lastAlertCount = 0;
      saveCumulativeAlerts();

      // Cập nhật hiển thị KPI
      updateKPICard('statAlerts', 0);
      updateKPICard('statTempAvg', '--');
      updateKPICard('statHumidityAvg', '--');

      // Xóa biểu đồ
      if (statsState.chartInstance) {
        statsState.chartInstance.data.labels = [];
        statsState.chartInstance.data.datasets.forEach(d => d.data = []);
        statsState.chartInstance.update();
      }

      // Xóa lịch sử cảnh báo (nếu có Alert History Manager)
      if (typeof alertHistoryManager !== 'undefined') {
        alertHistoryManager.history = [];
        alertHistoryManager.filteredHistory = [];
        alertHistoryManager.saveHistory();
        alertHistoryManager.render();
      }

      alert('✅ Đã xóa tất cả thống kê và lịch sử cảnh báo');
      console.log('✅ All statistics cleared successfully');
    } else {
      throw new Error(result.message || 'Lỗi xóa thống kê');
    }
  } catch (error) {
    console.error('Lỗi xóa thống kê:', error);
    alert(`❌ Lỗi xóa thống kê: ${error.message}`);
  }
}

// ===== XUẤT LỊCH SỬ CẢNH BÁO =====

// Xuất lịch sử cảnh báo thành file CSV.
async function exportAlertHistory() {
  try {
    if (typeof alertHistoryManager === 'undefined' || !alertHistoryManager.history) {
      alert('⚠️ Không có dữ liệu cảnh báo để xuất');
      return;
    }

    const data = alertHistoryManager.history;
    // Tạo chuỗi CSV
    const csv = [
      ['Thời gian', 'Mức độ', 'Tin nhắn'],
      ...data.map(alert => [
        new Date(alert.timestamp).toLocaleString('vi-VN'),
        alert.severity || 'N/A',
        alert.message || 'N/A'
      ])
    ].map(row => row.join(',')).join('\n');

    // Kích hoạt tải xuống
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `alert-history-${Date.now()}.csv`;
    link.click();

    console.log('✅ Exported alert history');
  } catch (error) {
    console.error('Lỗi xuất lịch sử cảnh báo:', error);
    alert('❌ Lỗi xuất dữ liệu');
  }
}

// ===== XÓA LỊCH SỬ CẢNH BÁO =====

// Xóa lịch sử cảnh báo chỉ trên LocalStorage.
async function clearAlertHistory() {
  if (!confirm('⚠️ Bạn chắc chắn muốn xóa lịch sử cảnh báo?')) {
    return;
  }

  try {
    if (typeof alertHistoryManager !== 'undefined') {
      alertHistoryManager.clear();
      alertHistoryManager.render();
      alert('✅ Đã xóa lịch sử cảnh báo');
    }
  } catch (error) {
    console.error('Lỗi xóa lịch sử cảnh báo:', error);
    alert('❌ Lỗi xóa lịch sử');
  }
}

// ===== XỬ LÝ LỖI HIỂN THỊ =====

// Hiển thị thông báo lỗi trên Modal Thống kê.
function showStatsError(message) {
  const statusEl = document.querySelector('.stats-header-info');
  if (!statusEl) return;

  const errorHtml = `<div class="update-status" style="background: #ffe0e0; border-left-color: #dc3545; color: #dc3545;">
    <span class="status-icon">❌</span>
    <span>${message}</span>
  </div>`;

  statusEl.innerHTML = errorHtml;
}

// ===== THIẾT LẬP TAB (Sử dụng lại logic từ config.js) =====

// Thiết lập chức năng chuyển đổi giữa các Tab (Tổng quan, Lịch sử).
function setupStatsTabs() {
  const tabButtons = document.querySelectorAll('.stats-tab-btn');
  const tabContents = document.querySelectorAll('.stats-tab-content');

  tabButtons.forEach(btn => {
    btn.addEventListener('click', function() {
      const tabId = this.getAttribute('data-tab');

      // Hủy kích hoạt tất cả
      tabButtons.forEach(b => b.classList.remove('active'));
      tabContents.forEach(c => c.classList.remove('active'));

      // Kích hoạt Tab được chọn
      this.classList.add('active');
      const tab = document.getElementById(tabId);
      if (tab) tab.classList.add('active');

      // Làm mới lịch sử cảnh báo nếu chuyển sang tab Lịch sử
      if (tabId === 'stats-history' && typeof alertHistoryManager !== 'undefined') {
        alertHistoryManager.render();
      }
    });
  });
}

// ===== EXPORT CÁC HÀM CÔNG KHAI =====

// Export các hàm chính (Public API).
window.statsModule = {
  openModal: openStatsModal,
  closeModal: closeStatsModal,
  clearAll: clearAllStatistics
};