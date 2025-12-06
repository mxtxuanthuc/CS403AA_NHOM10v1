// --- HỆ THỐNG QUẢN LÝ CẢNH BÁO (ALERT MANAGER) ---
// Xử lý thông báo chuyên nghiệp, lưu trữ lịch sử, âm thanh và chuyển đổi UI.

class AlertManager {
  constructor() {
    this.alertHistory = [];
    this.maxHistorySize = 20;
    this.alertQueue = [];
    this.isProcessing = false;
    this.alertContainer = null;
    this.toastContainer = null;
    this.notificationSound = null;
    this.warningSound = null;
    this.lastAlertTime = 0;
    this.alertDebounceMs = 1000;
    this.lastSoundPlayTime = 0;
    this.soundPlayDebounceMs = 500;
    this.isSoundPlaying = false;

    // Cache button references để tránh DOM search liên tục
    this.btnToggleAlerts = null;
    this.btnToggleSound = null;
    this.btnToggleToasts = null;

    // Cài đặt điều khiển cảnh báo
    this.isAlertsEnabled = true;
    this.soundEnabled = true;
    this.toastsEnabled = true;
    this.statusUpdateEnabled = true;

    // Định nghĩa mức độ nghiêm trọng
    this.severityLevels = {
      critical: { color: '#dc3545', icon: '🚨', title: 'Nguy hiểm' },
      high: { color: '#fd7e14', icon: '⚠️', title: 'Cảnh báo' },
      warning: { color: '#ffc107', icon: '⚡', title: 'Chú ý' },
      info: { color: '#17a2b8', icon: 'ℹ️', title: 'Thông tin' },
      success: { color: '#28a745', icon: '✅', title: 'Thành công' }
    };
  }

  // Khởi tạo quản lý cảnh báo
  initialize() {
    this.createAlertContainers();
    this.setupEventListeners();
    this.setupToggleButtons();
    this.loadAlertSettings();
    this.loadAlertHistory();

    // Khởi tạo âm thanh thông báo
    this.initNotificationSound();

    console.log('✅ AlertManager đã khởi tạo');
  }

  // Tạo các container DOM cho cảnh báo
  createAlertContainers() {
    // Container hiển thị cảnh báo chính
    this.alertContainer = document.getElementById('mainAlerts');
    if (!this.alertContainer) {
      this.alertContainer = document.createElement('div');
      this.alertContainer.id = 'mainAlerts';
      this.alertContainer.className = 'box';
      document.body.appendChild(this.alertContainer);
      console.log('✅ Đã tạo container mainAlerts');
    }

    // Container thông báo toast
    this.toastContainer = document.getElementById('toastContainer');
    if (!this.toastContainer) {
      this.toastContainer = document.createElement('div');
      this.toastContainer.id = 'toastContainer';
      this.toastContainer.className = 'toast-container';
      document.body.appendChild(this.toastContainer);
      console.log('✅ Đã tạo container toastContainer');
    }

    console.log('✅ Container cảnh báo đã sẵn sàng:', {
      alertContainer: !!this.alertContainer,
      toastContainer: !!this.toastContainer
    });
  }

  // Thiết lập các trình nghe sự kiện cho tương tác cảnh báo
  setupEventListeners() {
    // Lắng nghe cảnh báo từ socket
    if (typeof socket !== 'undefined') {
      socket.on('capNhat', (data) => {
        console.log('📨 Nhận dữ liệu socket:', data);
        if (data.analysis && data.analysis.alerts) {
          this.processAlerts(data.analysis);
        }
      });

      // Lắng nghe sự kiện cảnh báo trực tiếp
      socket.on('alert', (data) => {
        console.log('🚨 Nhận cảnh báo:', data);
        this.processAlerts({
          alerts: Array.isArray(data) ? data : [data],
          riskLevel: data.severity || 'warning'
        });
      });
    }
  }

  // Thiết lập các nút chuyển đổi cho cảnh báo
  setupToggleButtons() {
    // Lưu vào bộ nhớ đệm
    this.btnToggleAlerts = document.getElementById('btnToggleAlerts');
    this.btnToggleSound = document.getElementById('btnToggleSound');
    this.btnToggleToasts = document.getElementById('btnToggleToasts');

    // Nút chuyển đổi cảnh báo chính
    if (this.btnToggleAlerts) {
      this.btnToggleAlerts.addEventListener('click', (e) => {
        e.preventDefault();
        this.toggleAlerts();
      });
    }

    // Nút chuyển đổi âm thanh
    if (this.btnToggleSound) {
      this.btnToggleSound.addEventListener('click', (e) => {
        e.preventDefault();
        this.toggleSound();
      });
    }

    // Nút chuyển đổi thông báo toast
    if (this.btnToggleToasts) {
      this.btnToggleToasts.addEventListener('click', (e) => {
        e.preventDefault();
        this.toggleToasts();
      });
    }

    this.updateButtonStates();
  }

  // Xử lý cảnh báo đến
  processAlerts(analysis) {
    if (!analysis) return;

    const alerts = analysis.alerts || [];
    const riskLevel = analysis.riskLevel || 'normal';

    // Bỏ qua nếu cảnh báo TẮT HOÀN TOÀN
    if (!this.isAlertsEnabled) {
      console.log('🔕 Cảnh báo tắt - bỏ qua');
      return;
    }

    // Thêm vào hàng đợi (batch processing)
    if (alerts.length > 0) {
      this.alertQueue.push({
        alerts,
        riskLevel,
        timestamp: Date.now(),
        recommendations: analysis.recommendations || []
      });

      // Xử lý hàng đợi ngay lập tức
      this.processAlertQueue();
    }
  }

  // Xử lý hàng đợi cảnh báo (Batch processing)
  async processAlertQueue() {
    if (this.isProcessing || this.alertQueue.length === 0) return;

    this.isProcessing = true;

    // Gộp tất cả alerts trong queue
    const batchedAlerts = [];
    const batchRecommendations = [];
    let highestRiskLevel = 'normal';

    while (this.alertQueue.length > 0) {
      const item = this.alertQueue.shift();
      batchedAlerts.push(...item.alerts);
      batchRecommendations.push(...item.recommendations);

      // Xác định mức rủi ro cao nhất
      if (item.riskLevel === 'critical') {
        highestRiskLevel = 'critical';
      } else if (item.riskLevel === 'high' && highestRiskLevel !== 'critical') {
        highestRiskLevel = 'high';
      }
    }

    // Hiển thị tất cả cảnh báo 1 lần
    await this.displayAlerts(batchedAlerts, highestRiskLevel, batchRecommendations);
    this.isProcessing = false;
  }

  // Hiển thị cảnh báo trong container chính và dưới dạng toast
  async displayAlerts(alerts, riskLevel, recommendations = []) {
    if (!alerts || alerts.length === 0) return;

    console.log(`📢 Hiển thị: ${alerts.length} cảnh báo, mức rủi ro=${riskLevel}`);

    // Thêm vào lịch sử
    alerts.forEach(alert => {
      this.addToHistory(alert, riskLevel);
    });

    // Cập nhật container cảnh báo chính ngay lập tức
    if (this.statusUpdateEnabled) {
      this.updateAlertContainer(alerts, riskLevel, recommendations);
    }

    // Lọc cảnh báo cần hiển thị toast + sound (critical/high)
    const criticalAlerts = alerts.filter(a =>
      a.severity === 'critical' || a.severity === 'high'
    );

    // Hiển thị toast thông báo (nếu bật)
    if (this.toastsEnabled && criticalAlerts.length > 0) {
      criticalAlerts.forEach(alert => {
        this.showToast(alert.message, alert.severity || 'warning');
      });
    }

    // Phát âm thanh một lần cho tất cả cảnh báo (nếu bật)
    if (this.soundEnabled && criticalAlerts.length > 0) {
      this.playWarningSound();
    }
  }

  // Lấy khuyến nghị (Hiện tại được truyền trực tiếp qua socket)
  async getAIPoweredRecommendations(alerts, riskLevel) {
    // Không gọi AI ở đây - client chỉ nhận khuyến nghị qua socket 'aiRecommendation'
    return [];
  }

  // Cập nhật hiển thị container cảnh báo chính
  updateAlertContainer(alerts, riskLevel, recommendations = []) {
    if (!this.alertContainer) return;

    try {
      const severityInfo = this.severityLevels[riskLevel] || this.severityLevels.info;

      let html = '';

      // Badge mức độ rủi ro
      html += `
        <div class="alert-status-banner severity-${riskLevel}">
          <span class="severity-icon">${severityInfo.icon}</span>
          <span class="severity-title">${severityInfo.title}</span>
          <span class="severity-time">${this.getCurrentTime()}</span>
        </div>
      `;

      // Danh sách cảnh báo
      if (alerts.length > 0) {
        html += '<div class="alerts-detailed-list">';

        alerts.forEach((alert, index) => {
          const sIcon = this.severityLevels[alert.severity || 'info'].icon;
          const sClass = alert.severity || 'info';
          const message = alert.message || alert;
          const timestamp = new Date().toLocaleTimeString('vi-VN');
          const alertId = `alert-${Date.now()}-${index}`;

          html += `
            <div class="alert-detail-item severity-${sClass}" id="${alertId}">
              <div class="alert-detail-meta">
                <div class="alert-meta-left">
                  <span class="alert-icon">${sIcon}</span>
                  <div>
                    <p class="alert-type">${alert.type || 'Thông báo'}</p>
                    <p class="alert-origin">Nguồn: ${alert.source || 'Hệ thống'}</p>
                  </div>
                </div>
                <div class="alert-meta-right">
                  <span class="alert-time">${timestamp}</span>
                  <button class="btn-close-alert" onclick="alertManager.dismissAlert('${alertId}')" title="Đóng">✕</button>
                </div>
              </div>
              <div class="alert-detail-content">
                <p class="alert-message">${this.sanitize(message)}</p>
                ${alert.action ? `<button class="alert-action-btn" onclick="${alert.action}">${alert.actionLabel || 'Xử lý ngay'}</button>` : ''}
              </div>
            </div>
          `;
        });

        html += '</div>';
      }

      // Khuyến nghị
      if (recommendations && recommendations.length > 0) {
        html += '<div class="recommendations-section">';
        html += '<h4>💡 Khuyến nghị:</h4>';
        html += '<ul class="recommendations-list">';

        recommendations.forEach(rec => {
          const text = rec.text || rec.message || rec;
          const source = rec.source || '';
          const aiBadge = source === 'AI' ? '<span class="ai-badge">🤖 AI</span>' : '';
          html += `<li class="recommendation-item">${aiBadge} ${this.sanitize(text)}</li>`;
        });

        html += '</ul></div>';
      }

      // Nếu không có cảnh báo, hiển thị thông báo bình thường
      if (alerts.length === 0 && (!recommendations || recommendations.length === 0)) {
        html = '<div class="alert-empty">😊 Tất cả các thông số đều bình thường</div>';
      }

      this.alertContainer.innerHTML = html;
      this.alertContainer.classList.remove('empty-state');
      this.alertContainer.classList.add(`status-${riskLevel}`);

    } catch (error) {
      console.error('Lỗi cập nhật container cảnh báo:', error);
      if (this.alertContainer) {
        this.alertContainer.innerHTML = '<div class="alert-error">❌ Lỗi hiển thị cảnh báo</div>';
      }
    }
  }

  // Hiển thị thông báo toast
  showToast(message, severity = 'info') {
    // Kiểm tra nếu thông báo bị tắt
    if (!this.toastsEnabled) {
      console.log('💬 Toast tắt - bỏ qua');
      return;
    }

    if (!this.toastContainer) {
      console.warn('⚠️ Toast container không tồn tại');
      console.log('Tạo container mới...');
      this.toastContainer = document.getElementById('toastContainer');
      if (!this.toastContainer) {
        this.toastContainer = document.createElement('div');
        this.toastContainer.id = 'toastContainer';
        this.toastContainer.className = 'toast-container';
        document.body.appendChild(this.toastContainer);
        console.log('✅ Toast container được tạo');
      }
    }

    const toast = document.createElement('div');
    toast.className = `toast toast-${severity}`;
    toast.style.pointerEvents = 'auto'; 

    const info = this.severityLevels[severity] || this.severityLevels.info;

    toast.innerHTML = `
      <div class="toast-content">
        <span class="toast-icon">${info.icon}</span>
        <span class="toast-message">${this.sanitize(message)}</span>
        <button class="toast-close" aria-label="Đóng">&times;</button>
      </div>
    `;

    console.log('📝 Thêm toast vào container:', this.toastContainer.id);
    this.toastContainer.appendChild(toast);
    console.log('✅ Toast đã thêm:', {
      message,
      severity,
      containerChildCount: this.toastContainer.children.length
    });

    // Xử lý nút đóng
    const closeBtn = toast.querySelector('.toast-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', (e) => {
        e.stopPropagation(); 
        toast.classList.add('closing');
        setTimeout(() => {
          if (toast.parentElement) toast.remove();
        }, 300);
      });
    }

    // Tự động xóa sau 6 giây
    const timeout = setTimeout(() => {
      if (toast.parentElement) {
        toast.classList.add('closing');
        setTimeout(() => {
          if (toast.parentElement) toast.remove();
        }, 300);
      }
    }, 6000);

    // Xóa timeout khi nhấp vào
    toast.addEventListener('click', () => clearTimeout(timeout));

    return toast;
  }

  // Thêm cảnh báo vào lịch sử
  addToHistory(alert, riskLevel) {
    const entry = {
      message: alert.message || alert,
      type: alert.type || 'unknown',
      severity: alert.severity || 'info',
      riskLevel,
      timestamp: Date.now(),
      timeStr: new Date().toLocaleTimeString('vi-VN')
    };

    this.alertHistory.unshift(entry);

    if (this.alertHistory.length > this.maxHistorySize) {
      this.alertHistory = this.alertHistory.slice(0, this.maxHistorySize);
    }

    this.saveAlertHistory();

    // Cũng thêm vào alertHistoryManager nếu có sẵn
    if (typeof alertHistoryManager !== 'undefined' && window.alertHistoryManager) {
      window.alertHistoryManager.addAlert({
        message: alert.message || alert,
        type: alert.type || 'unknown',
        severity: alert.severity || 'info',
        details: `Mức độ rủi ro: ${riskLevel}`
      });
    }
  }

  // Tải lịch sử cảnh báo từ localStorage
  loadAlertHistory() {
    try {
      const saved = localStorage.getItem('alertHistory');
      if (saved) {
        this.alertHistory = JSON.parse(saved);
      }
    } catch (error) {
      console.error('❌ Lỗi tải lịch sử cảnh báo:', error);
      this.alertHistory = [];
    }
  }

  // Lưu lịch sử cảnh báo vào localStorage
  saveAlertHistory() {
    try {
      localStorage.setItem('alertHistory', JSON.stringify(this.alertHistory));
    } catch (error) {
      console.error('❌ Lỗi lưu lịch sử cảnh báo:', error);
    }
  }

  // Lấy lịch sử cảnh báo
  getHistory(limit = 10) {
    return this.alertHistory.slice(0, limit);
  }

  // Xóa lịch sử cảnh báo
  clearHistory() {
    this.alertHistory = [];
    this.saveAlertHistory();
    this.updateAlertContainer([], 'normal', []);
  }

  // Phát âm thanh cảnh báo
  playWarningSound() {
    try {
      // Kiểm tra nếu âm thanh tắt
      if (!this.soundEnabled) {
        console.log('🔇 Âm thanh tắt - bỏ qua');
        return;
      }

      // Kiểm tra nếu đã phát âm thanh gần đây (debounce 500ms)
      const now = Date.now();
      if (this.isSoundPlaying || (now - this.lastSoundPlayTime < 500)) {
        console.log('⏭️ Âm thanh: Bỏ qua (đã phát gần đây)');
        return;
      }

      this.lastSoundPlayTime = now;
      this.isSoundPlaying = true;

      // Tạo âm thanh cảnh báo bằng Web Audio API
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) {
        console.warn('⚠️ Web Audio API không hỗ trợ - sử dụng fallback');
        this.playWarningAudioFallback();
        this.isSoundPlaying = false;
        return;
      }

      try {
        const audioContext = new AudioContextClass();

        // Hàm phát tiếng bíp
        const playBeep = (delay, frequency, duration, volume = 0.5) => {
          const osc = audioContext.createOscillator();
          const gain = audioContext.createGain();

          osc.connect(gain);
          gain.connect(audioContext.destination);

          osc.frequency.value = frequency;
          osc.type = 'sine';

          gain.gain.setValueAtTime(volume, audioContext.currentTime + delay);
          gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + delay + duration);

          osc.start(audioContext.currentTime + delay);
          osc.stop(audioContext.currentTime + delay + duration);
        };

        // Phát 2 tiếng bíp cao (1000Hz) mỗi tiếng 0.2s, cách nhau 0.35s
        playBeep(0, 1000, 0.2, 0.5); 
        playBeep(0.35, 1000, 0.2, 0.5); 

        console.log('🔊 Âm thanh: Phát cảnh báo (Web Audio API - 2x beep)');

        // Đánh dấu xong sau 800ms
        setTimeout(() => {
          this.isSoundPlaying = false;
        }, 800);

      } catch (e) {
        console.warn('⚠️ Lỗi Web Audio API:', e.message);
        this.playWarningAudioFallback();
        this.isSoundPlaying = false;
      }

    } catch (error) {
      console.debug('Lỗi âm thanh:', error.message);
      this.isSoundPlaying = false;
    }
  }

  // Fallback: Phát âm thanh cảnh báo bằng Audio element
  playWarningAudioFallback() {
    try {
      // Dùng Data URL cho tiếng beep đơn giản
      const beepAudio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAAB9AAACABAAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj==');
      beepAudio.volume = 0.5;
      beepAudio.play().catch(e => {
        console.debug('Lỗi phát beep fallback:', e.message);
      });
    } catch (e) {
      console.debug('Lỗi âm thanh fallback:', e.message);
    }
  }

  // Phát âm thanh thông báo
  playNotificationSound() {
    try {
      console.log('🔊 Phát âm thanh thông báo');

      // Cách 1: Dùng Web Audio API
      if (typeof AudioContext !== 'undefined' || typeof webkitAudioContext !== 'undefined') {
        try {
          const AudioContextClass = window.AudioContext || window.webkitAudioContext;
          const audioContext = new AudioContextClass();
          const oscillator = audioContext.createOscillator();
          const gainNode = audioContext.createGain();

          oscillator.connect(gainNode);
          gainNode.connect(audioContext.destination);

          // Phát một tiếng bíp
          oscillator.frequency.value = 1000;
          oscillator.type = 'sine';
          gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);

          oscillator.start(audioContext.currentTime);
          oscillator.stop(audioContext.currentTime + 0.3);

          console.log('✅ Âm thanh Web Audio phát thành công');
          return;
        } catch (e) {
          console.warn('⚠️ Lỗi Web Audio API:', e.message);
        }
      }

      // Cách 2: Dùng Audio element
      if (!this.notificationSound) {
        this.notificationSound = new Audio('data:audio/wav;base64,UklGRiYAAABXQVZFZm10IBAAAAABAAEAQB8AAAB9AAACABAAZGF0YQIAAAAAAA==');
      }

      if (this.notificationSound) {
        this.notificationSound.play().catch(e => {
          console.debug('Không thể phát âm thanh:', e.message);
        });
      }

    } catch (error) {
      console.debug('Âm thanh thông báo không khả dụng:', error.message);
    }
  }

  // Khởi tạo âm thanh cảnh báo và thông báo
  initNotificationSound() {
    console.log('✅ Âm thanh cảnh báo sẽ dùng Web Audio API');
  }

  // Tiện ích: Lấy thời gian hiện tại
  getCurrentTime() {
    return new Date().toLocaleTimeString('vi-VN');
  }

  // Loại bỏ/Đóng cảnh báo riêng lẻ
  dismissAlert(alertId) {
    const alertElement = document.getElementById(alertId);
    if (alertElement) {
      alertElement.style.animation = 'slideOut 0.3s ease-out';
      setTimeout(() => {
        alertElement.remove();
        console.log(`✅ Cảnh báo đã đóng: ${alertId}`);
      }, 300);
    }
  }

  // Xoá tất cả cảnh báo
  clearAllAlerts() {
    const container = this.alertContainer;
    if (container) {
      const items = container.querySelectorAll('.alert-detail-item');
      items.forEach((item, index) => {
        setTimeout(() => {
          item.style.animation = 'slideOut 0.3s ease-out';
          setTimeout(() => item.remove(), 300);
        }, index * 100);
      });
      console.log(`✅ Đã xoá ${items.length} cảnh báo`);
    }
  }

  // Tiện ích: Làm sạch HTML để ngăn chặn XSS
  sanitize(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Lấy thống kê cảnh báo
  getStatistics() {
    const stats = {
      total: this.alertHistory.length,
      bySeverity: {},
      byType: {}
    };

    Object.keys(this.severityLevels).forEach(level => {
      stats.bySeverity[level] = this.alertHistory.filter(a => a.severity === level).length;
    });

    this.alertHistory.forEach(alert => {
      stats.byType[alert.type] = (stats.byType[alert.type] || 0) + 1;
    });

    return stats;
  }

  // ===== CÁC PHƯƠNG THỨC ĐIỀU KHIỂN CẢNH BÁO =====

  // Bật/Tắt tất cả cảnh báo - TẮT HOÀN TOÀN (không hiển thị, không âm thanh, không toast)
  toggleAlerts() {
    this.isAlertsEnabled = !this.isAlertsEnabled;

    // Nếu tắt, cũng tắt âm thanh và toast
    if (!this.isAlertsEnabled) {
      this.soundEnabled = false;
      this.toastsEnabled = false;
      this.statusUpdateEnabled = false;
    } else {
      // Bật lại
      this.soundEnabled = true;
      this.toastsEnabled = true;
      this.statusUpdateEnabled = true;
    }

    this.saveAlertSettings();
    this.updateButtonStates();

    const status = this.isAlertsEnabled ? '✅ Cảnh báo bật (Hiển thị + Âm thanh + Thông báo)' : '🔕 Cảnh báo tắt HOÀN TOÀN';
    console.log(status);

    // Thông báo trạng thái
    if (this.alertContainer) {
      if (!this.isAlertsEnabled) {
        this.alertContainer.innerHTML = '<div class="alert-disabled" style="padding:20px; text-align:center; color:#666;">🔕 Cảnh báo TẮT - Không hiển thị, không âm thanh, không thông báo</div>';
      } else {
        this.alertContainer.innerHTML = '<div class="alert-empty">😊 Tất cả các thông số đều bình thường</div>';
      }
    }

    // Broadcast state change for modal sync
    window.dispatchEvent(new CustomEvent('alertStateChanged', {
      detail: {
        alerts: this.isAlertsEnabled,
        sound: this.soundEnabled,
        toasts: this.toastsEnabled
      }
    }));
    console.log('📢 Sự kiện thay đổi trạng thái cảnh báo đã phát sóng từ toggleAlerts');

    return this.isAlertsEnabled;
  }

  // Bật/Tắt âm thanh
  toggleSound() {
    this.soundEnabled = !this.soundEnabled;
    this.saveAlertSettings();
    this.updateButtonStates();

    const status = this.soundEnabled ? '🔊 Âm thanh: BẬT' : '🔇 Âm thanh: TẮT';
    console.log(status);

    // Broadcast state change for modal sync
    window.dispatchEvent(new CustomEvent('alertStateChanged', {
      detail: {
        alerts: this.isAlertsEnabled,
        sound: this.soundEnabled,
        toasts: this.toastsEnabled
      }
    }));
    console.log('📢 Sự kiện thay đổi trạng thái cảnh báo đã phát sóng từ toggleSound');

    return this.soundEnabled;
  }

  // Bật/Tắt thông báo toast
  toggleToasts() {
    this.toastsEnabled = !this.toastsEnabled;
    this.saveAlertSettings();
    this.updateButtonStates();

    const status = this.toastsEnabled ? '💬 Toast: BẬT' : '💬 Toast: TẮT';
    console.log(status);

    if (!this.toastsEnabled && this.toastContainer) {
      // Xoá thông báo hiện có
      this.toastContainer.innerHTML = '';
    }

    // Broadcast state change for modal sync
    window.dispatchEvent(new CustomEvent('alertStateChanged', {
      detail: {
        alerts: this.isAlertsEnabled,
        sound: this.soundEnabled,
        toasts: this.toastsEnabled
      }
    }));
    console.log('📢 Sự kiện thay đổi trạng thái cảnh báo đã phát sóng từ toggleToasts');

    return this.toastsEnabled;
  }

  // Đặt trạng thái cảnh báo theo chương trình (để điều khiển AI)
  setAlertsState(enabled) {
    if (typeof enabled !== 'boolean') return false;

    this.isAlertsEnabled = enabled;
    this.saveAlertSettings();
    this.updateButtonStates();

    if (this.alertContainer) {
      if (!enabled) {
        this.alertContainer.innerHTML = '<div class="alert-disabled">🔕 Cảnh báo tắt</div>';
      } else {
        this.alertContainer.innerHTML = '<div class="alert-empty">😊 Tất cả các thông số đều bình thường</div>';
      }
    }

    return enabled;
  }

  // Đặt trạng thái âm thanh theo chương trình (để điều khiển AI)
  setSoundState(enabled) {
    if (typeof enabled !== 'boolean') return false;

    this.soundEnabled = enabled;
    this.saveAlertSettings();
    this.updateButtonStates();

    return enabled;
  }

  // Đặt trạng thái thông báo toast theo chương trình (để điều khiển AI)
  setToastsState(enabled) {
    if (typeof enabled !== 'boolean') return false;

    this.toastsEnabled = enabled;
    this.saveAlertSettings();
    this.updateButtonStates();

    if (!enabled && this.toastContainer) {
      this.toastContainer.innerHTML = '';
    }

    return enabled;
  }

  // Lấy cài đặt cảnh báo hiện tại
  getAlertSettings() {
    return {
      alertsEnabled: this.isAlertsEnabled,
      soundEnabled: this.soundEnabled,
      toastsEnabled: this.toastsEnabled,
      statusUpdateEnabled: this.statusUpdateEnabled
    };
  }

  // Tải cài đặt cảnh báo từ localStorage
  loadAlertSettings() {
    try {
      const saved = localStorage.getItem('alertSettings');
      if (saved) {
        const settings = JSON.parse(saved);
        this.isAlertsEnabled = settings.alertsEnabled !== false;
        this.soundEnabled = settings.soundEnabled !== false;
        this.toastsEnabled = settings.toastsEnabled !== false;
        this.statusUpdateEnabled = settings.statusUpdateEnabled !== false;
      }
    } catch (error) {
      console.error('❌ Lỗi tải cài đặt cảnh báo:', error);
    }
  }

  // Lưu cài đặt cảnh báo vào localStorage (không chặn)
  saveAlertSettings() {
    try {
      const settings = {
        alertsEnabled: this.isAlertsEnabled,
        soundEnabled: this.soundEnabled,
        toastsEnabled: this.toastsEnabled,
        statusUpdateEnabled: this.statusUpdateEnabled
      };
      // Dùng requestIdleCallback để lưu trong nền nếu có sẵn
      if ('requestIdleCallback' in window) {
        requestIdleCallback(() => {
          localStorage.setItem('alertSettings', JSON.stringify(settings));
        });
      } else {
        // Fallback sang setTimeout
        setTimeout(() => {
          localStorage.setItem('alertSettings', JSON.stringify(settings));
        }, 0);
      }
    } catch (error) {
      console.error('❌ Lỗi lưu cài đặt cảnh báo:', error);
    }
  }

  // Cập nhật trạng thái nút UI - NHANH (dùng các tham chiếu đã lưu)
  updateButtonStates() {
    // Cập nhật nút Cảnh báo
    if (this.btnToggleAlerts) {
      this.btnToggleAlerts.textContent = this.isAlertsEnabled ? '🔔 Tắt' : '🔕 Bật';
      this.btnToggleAlerts.classList.toggle('btn-disabled', !this.isAlertsEnabled);
      this.btnToggleAlerts.title = this.isAlertsEnabled ? 'Tắt cảnh báo hoàn toàn' : 'Bật cảnh báo';
    }

    // Cập nhật nút Âm thanh
    if (this.btnToggleSound) {
      this.btnToggleSound.textContent = this.soundEnabled ? '🔊 Tắt' : '🔇 Bật';
      this.btnToggleSound.classList.toggle('btn-disabled', !this.soundEnabled);
      this.btnToggleSound.title = this.soundEnabled ? 'Tắt âm thanh' : 'Bật âm thanh';
    }

    // Cập nhật nút Thông báo
    if (this.btnToggleToasts) {
      this.btnToggleToasts.textContent = this.toastsEnabled ? '💬 Tắt' : '💬 Bật';
      this.btnToggleToasts.classList.toggle('btn-disabled', !this.toastsEnabled);
      this.btnToggleToasts.title = this.toastsEnabled ? 'Tắt thông báo popup' : 'Bật thông báo popup';
    }
  }
}

// Tạo thực thể toàn cục
const alertManager = new AlertManager();

// Khởi tạo khi DOM sẵn sàng
document.addEventListener('DOMContentLoaded', () => {
  alertManager.initialize();
});

// Xuất để sử dụng trong các module khác
window.AlertManager = AlertManager;
window.alertManager = alertManager;

console.log('✅ alerts.js đã tải');