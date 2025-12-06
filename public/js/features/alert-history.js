console.log('🔄 alert-history.js is loading...');

/**
 * Alert History Manager - Quản lý lịch sử cảnh báo chi tiết
 */
class AlertHistoryManager {
  constructor() {
    this.history = [];
    this.maxHistorySize = Infinity; // Không giới hạn số cảnh báo
    this.filteredHistory = [];
    this.searchTerm = '';
    this.severityFilter = '';
    this.autoRefreshInterval = null;
    this.autoRefreshTime = 10 * 1000; // 10 giây

    // DOM elements
    this.historyListContainer = null;
    this.historyCountElement = null;
    this.searchInput = null;
    this.severitySelect = null;
    this.exportBtn = null;
    this.clearBtn = null;
  }

  /**
   * Khởi tạo history manager
   */
  initialize() {
    console.log('📋 Initializing Alert History Manager...');

    // Gắn các DOM elements
    this.historyListContainer = document.getElementById('alertHistoryList');
    this.historyCountElement = document.getElementById('alertHistoryCount');
    this.searchInput = document.getElementById('alertHistorySearch');
    this.severitySelect = document.getElementById('alertHistorySeverity');
    this.exportBtn = document.getElementById('btnExportAlertHistory');
    this.clearBtn = document.getElementById('btnClearAlertHistory');

    // Thiết lập event listeners
    this.setupEventListeners();

    // Tải lịch sử từ localStorage
    this.loadHistory();

    // Hiển thị lịch sử ban đầu
    this.render();

    // **Bắt đầu auto-refresh 10s 1 lần**
    this.startAutoRefresh();

    console.log('✅ Alert History Manager initialized');
  }

  /**
   * Thiết lập event listeners
   */
  setupEventListeners() {
    // Tìm kiếm
    if (this.searchInput) {
      this.searchInput.addEventListener('input', (e) => {
        this.searchTerm = e.target.value.toLowerCase();
        this.applyFilters();
      });
    }

    // Lọc theo mức độ
    if (this.severitySelect) {
      this.severitySelect.addEventListener('change', (e) => {
        this.severityFilter = e.target.value;
        this.applyFilters();
      });
    }

    // Xuất báo cáo
    if (this.exportBtn) {
      this.exportBtn.addEventListener('click', () => {
        this.exportToCSV();
      });
    }

    // Xóa lịch sử
    if (this.clearBtn) {
      this.clearBtn.addEventListener('click', () => {
        this.clearHistory();
      });
    }

    console.log('✅ Event listeners setup:', {
      historyList: !!this.historyListContainer,
      historyCount: !!this.historyCountElement,
      searchInput: !!this.searchInput,
      severitySelect: !!this.severitySelect,
      exportBtn: !!this.exportBtn,
      clearBtn: !!this.clearBtn
    });
  }

  /**
   * Thêm cảnh báo vào lịch sử
   */
  addAlert(alertData) {
    if (!alertData) return;

    const alertEntry = {
      id: Date.now() + Math.random(),
      message: alertData.message || alertData,
      type: alertData.type || 'unknown',
      severity: alertData.severity || 'info',
      value: alertData.value || null,
      pollutant: alertData.pollutant || null,
      details: alertData.details || null,
      recommendations: alertData.recommendations || [],
      timestamp: Date.now(),
      timeStr: new Date().toLocaleString('vi-VN'),
      status: 'active' // active, resolved, ignored
    };

    // Thêm vào đầu mảng
    this.history.unshift(alertEntry);

    // Giữ chỉ những alert gần đây
    if (this.history.length > this.maxHistorySize) {
      this.history = this.history.slice(0, this.maxHistorySize);
    }

    // Lưu vào localStorage
    this.saveHistory();

    // Cập nhật giao diện
    this.applyFilters();

    console.log('✅ Alert thêm vào lịch sử:', alertEntry);
  }

  /**
   * Áp dụng bộ lọc tìm kiếm và mức độ
   */
  applyFilters() {
    this.filteredHistory = this.history.filter(alert => {
      const matchesSearch = !this.searchTerm ||
        alert.message.toLowerCase().includes(this.searchTerm) ||
        alert.type.toLowerCase().includes(this.searchTerm) ||
        (alert.pollutant && alert.pollutant.toLowerCase().includes(this.searchTerm));

      const matchesSeverity = !this.severityFilter ||
        alert.severity === this.severityFilter;

      return matchesSearch && matchesSeverity;
    });

    this.render();
  }

  /**
   * Hiển thị lịch sử cảnh báo
   */
  render() {
    if (!this.historyListContainer) return;

    // LUÔN hiển thị số lượng thực tế (không reset)
    if (this.historyCountElement) {
      this.historyCountElement.textContent = `${this.history.length} cảnh báo`;
    }

    // Nếu không có cảnh báo nào trong lịch sử
    if (this.history.length === 0) {
      this.historyListContainer.innerHTML = '<div class="history-empty">📭 Chưa có cảnh báo nào</div>';
      return;
    }

    // Nếu có dữ liệu nhưng không match filter, vẫn hiển thị tất cả
    const dataToDisplay = this.filteredHistory.length > 0 ? this.filteredHistory : this.history;

    // Tạo HTML cho lịch sử
    let html = '';

    dataToDisplay.forEach((alert, index) => {
      const severityIcons = {
        critical: '🚨',
        high: '⚠️',
        warning: '⚡',
        info: 'ℹ️',
        success: '✅'
      };

      const severityColors = {
        critical: '#dc3545',
        high: '#fd7e14',
        warning: '#ffc107',
        info: '#17a2b8',
        success: '#28a745'
      };

      const icon = severityIcons[alert.severity] || 'ℹ️';
      const color = severityColors[alert.severity] || '#17a2b8';

      // Tính thời gian trôi qua
      const timeAgo = this.getTimeAgo(alert.timestamp);

      html += `
        <div class="alert-history-item" data-alert-id="${alert.id}">
          <div class="alert-history-header">
            <div class="alert-history-info">
              <span class="alert-icon" style="color: ${color}">${icon}</span>
              <div class="alert-meta">
                <span class="alert-type">${alert.type}</span>
                <span class="alert-severity">${alert.severity.toUpperCase()}</span>
                ${alert.pollutant ? `<span class="alert-pollutant">${alert.pollutant}</span>` : ''}
              </div>
            </div>
            <div class="alert-time-info">
              <span class="alert-time-relative">${timeAgo}</span>
              <span class="alert-time-absolute">${alert.timeStr}</span>
            </div>
          </div>

          <div class="alert-history-content">
            <p class="alert-message">${this.sanitize(alert.message)}</p>

            ${alert.value ? `<div class="alert-value">📊 Giá trị: <strong>${alert.value.toFixed(2)}</strong></div>` : ''}

            ${alert.details ? `<div class="alert-details">📝 Chi tiết: ${this.sanitize(alert.details)}</div>` : ''}

            ${alert.recommendations && alert.recommendations.length > 0 ? `
              <div class="alert-recommendations">
                <strong>💡 Khuyến nghị:</strong>
                <ul>
                  ${alert.recommendations.map(rec => `<li>${this.sanitize(typeof rec === 'string' ? rec : rec.text || rec)}</li>`).join('')}
                </ul>
              </div>
            ` : ''}
          </div>

          <div class="alert-history-actions">
            <button class="btn-small btn-mark-resolved" data-alert-id="${alert.id}" data-action="resolve">✓ Xác nhận</button>
            <button class="btn-small btn-delete" data-alert-id="${alert.id}" data-action="delete">🗑️ Xóa</button>
          </div>
        </div>
      `;
    });

    this.historyListContainer.innerHTML = html;

    // Gắn event listeners cho nút xác nhận và xóa
    this.historyListContainer.querySelectorAll('.btn-mark-resolved, .btn-delete').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const alertId = btn.getAttribute('data-alert-id');
        const action = btn.getAttribute('data-action');

        if (action === 'resolve') {
          this.markResolved(alertId);
        } else if (action === 'delete') {
          this.deleteAlert(alertId);
        }
      });
    });
  }

  /**
   * Tính thời gian trôi qua
   */
  getTimeAgo(timestamp) {
    const now = Date.now();
    const diff = now - timestamp;

    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (seconds < 60) return 'Vừa xong';
    if (minutes < 60) return `${minutes}m trước`;
    if (hours < 24) return `${hours}h trước`;
    if (days === 1) return 'Hôm qua';
    if (days < 7) return `${days}d trước`;

    return new Date(timestamp).toLocaleDateString('vi-VN');
  }

  /**
   * Đánh dấu cảnh báo đã xử lý
   */
  markResolved(alertId) {
    // Chuyển alertId thành số nếu nó là string
    const id = typeof alertId === 'string' ? parseFloat(alertId) : alertId;

    const alert = this.history.find(a => a.id === id);
    if (alert) {
      alert.status = 'resolved';
      this.saveHistory();
      this.applyFilters();
      console.log('✅ Cảnh báo đã đánh dấu là xử lý:', id);
    } else {
      console.warn('⚠️ Không tìm thấy cảnh báo với ID:', id);
    }
  }

  /**
   * Xóa cảnh báo riêng lẻ
   */
  deleteAlert(alertId) {
    // Chuyển alertId thành số nếu nó là string
    const id = typeof alertId === 'string' ? parseFloat(alertId) : alertId;

    const index = this.history.findIndex(a => a.id === id);
    if (index > -1) {
      const removed = this.history.splice(index, 1);
      this.saveHistory();
      this.applyFilters();
      console.log('✅ Cảnh báo đã xóa:', removed);

      // Cập nhật stats khi xóa cảnh báo
      this.updateStatsAfterDelete();
    } else {
      console.warn('⚠️ Không tìm thấy cảnh báo với ID:', id);
    }
  }

  /**
   * Xóa toàn bộ lịch sử
   */
  clearHistory() {
    if (confirm('⚠️ Bạn chắc chắn muốn xóa toàn bộ lịch sử cảnh báo? Hành động này không thể hoàn tác.')) {
      const previousLength = this.history.length;
      this.history = [];
      this.filteredHistory = [];
      this.saveHistory();
      this.render();
      console.log('✅ Lịch sử cảnh báo đã xóa');

      // Cập nhật stats khi xóa toàn bộ
      this.updateStatsAfterDelete(previousLength);
    }
  }

  /**
   * Cập nhật stats sau khi xóa cảnh báo
   */
  updateStatsAfterDelete(previousLength = 1) {
    // Cập nhật KPI card thống kê để phản ánh lịch sử hiện tại
    if (typeof statsState !== 'undefined') {
      // Lấy số lượng cảnh báo hiện tại từ lịch sử
      statsState.lastAlertCount = this.history.length;

      // Lưu lại để lần tiếp theo không tính thêm
      if (typeof saveCumulativeAlerts === 'undefined') {
        localStorage.setItem('lastAlertHistoryLength', this.history.length.toString());
      } else {
        saveCumulativeAlerts();
      }

      console.log('✅ Stats đã cập nhật sau xóa cảnh báo');
    }
  }

  /**
   * Lưu lịch sử vào localStorage
   */
  saveHistory() {
    try {
      localStorage.setItem('alertHistory_pollution', JSON.stringify(this.history));
    } catch (error) {
      console.error('❌ Lỗi lưu lịch sử:', error);
    }
  }

  /**
   * Tải lịch sử từ localStorage
   */
  loadHistory() {
    try {
      const saved = localStorage.getItem('alertHistory_pollution');
      if (saved) {
        this.history = JSON.parse(saved);
        console.log(`✅ Đã tải ${this.history.length} cảnh báo từ lưu trữ`);
      } else {
        this.history = [];
        console.log('📭 Chưa có cảnh báo nào trong lịch sử');
      }
    } catch (error) {
      console.error('❌ Lỗi tải lịch sử:', error);
      this.history = [];
    }
  }

  /**
   * Xuất lịch sử sang CSV
   */
  exportToCSV() {
    try {
      const headers = ['Thời gian', 'Loại', 'Mức độ', 'Thông báo', 'Giá trị', 'Chi tiết', 'Trạng thái'];
      const rows = this.filteredHistory.map(alert => [
        alert.timeStr,
        alert.type,
        alert.severity,
        alert.message,
        alert.value || '',
        alert.details || '',
        alert.status
      ]);

      // Tạo CSV content
      let csvContent = headers.join(',') + '\n';
      rows.forEach(row => {
        const escapedRow = row.map(cell => {
          const str = (cell || '').toString();
          return `"${str.replace(/"/g, '""')}"`;
        }).join(',');
        csvContent += escapedRow + '\n';
      });

      // Tạo blob và tải file
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);

      link.setAttribute('href', url);
      link.setAttribute('download', `alert-history-${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      console.log('✅ Xuất lịch sử thành công');
    } catch (error) {
      console.error('❌ Lỗi xuất file:', error);
      alert('❌ Không thể xuất file CSV');
    }
  }

  /**
   * Lấy thống kê lịch sử
   */
  getStatistics() {
    const stats = {
      total: this.history.length,
      bySeverity: {},
      byType: {},
      byStatus: {},
      lastAlert: this.history.length > 0 ? this.history[0].timeStr : 'N/A'
    };

    ['critical', 'high', 'warning', 'info', 'success'].forEach(severity => {
      stats.bySeverity[severity] = this.history.filter(a => a.severity === severity).length;
    });

    this.history.forEach(alert => {
      stats.byType[alert.type] = (stats.byType[alert.type] || 0) + 1;
      stats.byStatus[alert.status] = (stats.byStatus[alert.status] || 0) + 1;
    });

    return stats;
  }

  /**
   * Lấy alerts trong khoảng thời gian
   */
  getAlertsInTimeRange(startTime, endTime) {
    return this.history.filter(alert =>
      alert.timestamp >= startTime && alert.timestamp <= endTime
    );
  }

  /**
   * Sanitize HTML
   */
  sanitize(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Print báo cáo
   */
  printReport() {
    try {
      const printWindow = window.open('', '', 'height=600,width=800');

      let html = `
        <html>
          <head>
            <title>Báo cáo cảnh báo ô nhiễm</title>
            <style>
              body { font-family: Arial, sans-serif; margin: 20px; }
              h1 { color: #333; }
              table { width: 100%; border-collapse: collapse; margin-top: 20px; }
              th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
              th { background-color: #007bff; color: white; }
              .critical { background-color: #ffebee; }
              .high { background-color: #fff3e0; }
            </style>
          </head>
          <body>
            <h1>📋 Báo cáo lịch sử cảnh báo ô nhiễm</h1>
            <p>Thời gian in: ${new Date().toLocaleString('vi-VN')}</p>
            <table>
              <tr>
                <th>Thời gian</th>
                <th>Loại</th>
                <th>Mức độ</th>
                <th>Thông báo</th>
                <th>Giá trị</th>
              </tr>
      `;

      this.filteredHistory.forEach(alert => {
        html += `
          <tr class="${alert.severity}">
            <td>${alert.timeStr}</td>
            <td>${alert.type}</td>
            <td>${alert.severity.toUpperCase()}</td>
            <td>${alert.message}</td>
            <td>${alert.value || 'N/A'}</td>
          </tr>
        `;
      });

      html += `
            </table>
          </body>
        </html>
      `;

      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.print();

      console.log('✅ Báo cáo được in thành công');
    } catch (error) {
      console.error('❌ Lỗi in báo cáo:', error);
    }
  }

  /**
   * Bắt đầu auto-refresh 10s một lần
   */
  startAutoRefresh() {
    // Xóa interval cũ nếu có
    if (this.autoRefreshInterval) {
      clearInterval(this.autoRefreshInterval);
    }

    // Bắt đầu interval mới
    this.autoRefreshInterval = setInterval(() => {
      console.log('🔄 Auto-refresh lịch sử cảnh báo (10s)...');

      // Tải lại dữ liệu từ localStorage
      this.loadHistory();

      // Cập nhật giao diện
      this.applyFilters();

      console.log('✅ Lịch sử cảnh báo đã cập nhật');
    }, this.autoRefreshTime);

    console.log('✅ Auto-refresh bắt đầu (10s 1 lần)');
  }

  /**
   * Dừng auto-refresh
   */
  stopAutoRefresh() {
    if (this.autoRefreshInterval) {
      clearInterval(this.autoRefreshInterval);
      this.autoRefreshInterval = null;
      console.log('⏹️ Auto-refresh đã dừng');
    }
  }

  /**
   * Restart auto-refresh (khi Modal mở/đóng)
   */
  restartAutoRefresh() {
    this.startAutoRefresh();
  }
}

// Tạo thực thể toàn cục
const alertHistoryManager = new AlertHistoryManager();

// Khởi tạo khi DOM sẵn sàng
document.addEventListener('DOMContentLoaded', () => {
  alertHistoryManager.initialize();
});

console.log('✅ alert-history.js loaded');
