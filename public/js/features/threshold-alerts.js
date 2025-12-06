// --- HỆ THỐNG CẢNH BÁO THEO NGƯỠNG GIỚI HẠN (THRESHOLD ALERT SYSTEM) ---
// Kiểm tra dữ liệu cảm biến (nhiệt độ, độ ẩm, pin) so với ngưỡng đã thiết lập và gửi cảnh báo.

class ThresholdAlertSystem {
  constructor() {
    // Thời gian cảnh báo gần nhất cho mỗi loại cảnh báo (dùng để khử rung/debounce)
    this.lastAlertTime = {}; 
    // Ngưỡng thời gian khử rung (5 giây)
    this.alertDebounceMs = 5000; 
    // Các giá trị ngưỡng giới hạn
    this.thresholds = {};
    this.init();
  }

  init() {
    this.loadThresholds();
    this.loadThresholdsFromServer();
    this.setupThresholdUpdateListener();
    console.log('✅ ThresholdAlertSystem khởi động');
  }

  // Tải ngưỡng từ server khi khởi động
  async loadThresholdsFromServer() {
    try {
      const response = await fetch('/api/thresholds');
      if (response.ok) {
        const serverThresholds = await response.json();
        this.thresholds = { ...this.thresholds, ...serverThresholds };

        // Lưu vào localStorage để sử dụng offline
        localStorage.setItem('thresholds', JSON.stringify(this.thresholds));
        console.log('✅ Thresholds loaded from server:', this.thresholds);
      }
    } catch (e) {
      console.warn('⚠️ Could not load thresholds from server, using cached/default values:', e.message);
    }
  }

  // Tải ngưỡng từ LocalStorage hoặc sử dụng mặc định
  loadThresholds() {
    try {
      // Thử load từ localStorage (key mới) trước
      let saved = localStorage.getItem('thresholds');

      // Nếu không có, thử từ key cũ
      if (!saved) {
        saved = localStorage.getItem('thresholdSettings');
      }

      if (saved) {
        this.thresholds = JSON.parse(saved);
        console.log('📥 Ngưỡng tải từ localStorage:', this.thresholds);
      } else {
        // Giá trị mặc định
        this.thresholds = {
          tempMax: 30,
          tempMin: 15,
          humidityMax: 80,
          humidityMin: 30,
          batteryMin: 20
        };
        console.log('⚙️ Sử dụng giá trị ngưỡng mặc định:', this.thresholds);
      }
    } catch (e) {
      console.warn('⚠️ Lỗi tải ngưỡng:', e);
      // Giá trị mặc định khi có lỗi
      this.thresholds = {
        tempMax: 30,
        tempMin: 15,
        humidityMax: 80,
        humidityMin: 30,
        batteryMin: 20
      };
    }
  }

  // Lắng nghe sự thay đổi ngưỡng từ modal cấu hình hoặc tab khác
  setupThresholdUpdateListener() {
    // Lắng nghe sự kiện storage khi thay đổi ở tab khác
    window.addEventListener('storage', (e) => {
      if (e.key === 'thresholds' || e.key === 'thresholdSettings') {
        console.log('📡 Ngưỡng được cập nhật từ tab khác, đang tải lại...');
        this.loadThresholds();
      }
    });

    // Lắng nghe sự kiện tùy chỉnh để đồng bộ trong cùng tab
    window.addEventListener('thresholdsUpdated', (e) => {
      console.log('📡 Sự kiện thresholdUpdated nhận được:', e.detail);
      this.loadThresholds();
    });
  }

  // Kiểm tra dữ liệu so với ngưỡng và gửi cảnh báo tới AlertManager
  // Chỉ kiểm tra thay đổi trạng thái, không tạo cảnh báo trùng (debounce)
  checkAndAlert(data) {
    if (!data || !window.alertManager) {
      console.warn('❌ Data or AlertManager not available');
      return;
    }

    const temperature = data.temperature || data.nhietDo;
    const humidity = data.humidity || data.doAm;
    const battery = data.battery || data.pin;

    // Đảm bảo ngưỡng đã được tải
    if (!this.thresholds || Object.keys(this.thresholds).length === 0) {
      this.loadThresholds();
    }

    console.log('🔍 Checking thresholds:', this.thresholds);
    console.log('📊 Data values:', { temperature, humidity, battery });

    const alerts = [];

    // Nhiệt độ cao
    if (temperature !== null && temperature !== undefined && temperature > (this.thresholds.tempMax || 30)) {
      const alertId = 'temp-high';
      const now = Date.now();
      // Áp dụng Debounce
      if (!this.lastAlertTime[alertId] || now - this.lastAlertTime[alertId] >= this.alertDebounceMs) {
        alerts.push({
          type: 'Nhiệt độ cao',
          severity: 'high',
          message: `🌡️ Nhiệt độ cao: ${temperature}°C (ngưỡng: ${this.thresholds.tempMax}°C)`,
        });
        this.lastAlertTime[alertId] = now;
        console.log('🚨 Temp high alert triggered:', temperature);
      }
    }

    // Nhiệt độ thấp
    if (temperature !== null && temperature !== undefined && temperature < (this.thresholds.tempMin || 15)) {
      const alertId = 'temp-low';
      const now = Date.now();
      // Áp dụng Debounce
      if (!this.lastAlertTime[alertId] || now - this.lastAlertTime[alertId] >= this.alertDebounceMs) {
        alerts.push({
          type: 'Nhiệt độ thấp',
          severity: 'warning',
          message: `❄️ Nhiệt độ thấp: ${temperature}°C (ngưỡng: ${this.thresholds.tempMin}°C)`,
        });
        this.lastAlertTime[alertId] = now;
        console.log('🚨 Temp low alert triggered:', temperature);
      }
    }

    // Độ ẩm cao
    if (humidity !== null && humidity !== undefined && humidity > (this.thresholds.humidityMax || 80)) {
      const alertId = 'humidity-high';
      const now = Date.now();
      // Áp dụng Debounce
      if (!this.lastAlertTime[alertId] || now - this.lastAlertTime[alertId] >= this.alertDebounceMs) {
        alerts.push({
          type: 'Độ ẩm cao',
          severity: 'critical',
          message: `💧 Độ ẩm cao: ${humidity}% (ngưỡng: ${this.thresholds.humidityMax}%)`,
        });
        this.lastAlertTime[alertId] = now;
        console.log('🚨 Humidity high alert triggered:', humidity);
      }
    }

    // Độ ẩm thấp
    if (humidity !== null && humidity !== undefined && humidity < (this.thresholds.humidityMin || 30)) {
      const alertId = 'humidity-low';
      const now = Date.now();
      // Áp dụng Debounce
      if (!this.lastAlertTime[alertId] || now - this.lastAlertTime[alertId] >= this.alertDebounceMs) {
        alerts.push({
          type: 'Độ ẩm thấp',
          severity: 'warning',
          message: `🏜️ Độ ẩm thấp: ${humidity}% (ngưỡng: ${this.thresholds.humidityMin}%)`,
        });
        this.lastAlertTime[alertId] = now;
        console.log('🚨 Humidity low alert triggered:', humidity);
      }
    }

    // Pin yếu
    if (battery !== null && battery !== undefined && battery < (this.thresholds.batteryMin || 20)) {
      const alertId = 'battery-low';
      const now = Date.now();
      // Áp dụng Debounce
      if (!this.lastAlertTime[alertId] || now - this.lastAlertTime[alertId] >= this.alertDebounceMs) {
        alerts.push({
          type: 'Pin yếu',
          severity: 'critical',
          message: `🔋 Pin yếu: ${battery}% (ngưỡng: ${this.thresholds.batteryMin}%)`,
        });
        this.lastAlertTime[alertId] = now;
        console.log('🚨 Battery low alert triggered:', battery);
      }
    }

    // Gửi tới AlertManager để xử lý
    if (alerts.length > 0 && window.alertManager) {
      console.log('✅ Sending', alerts.length, 'alerts to AlertManager');
      window.alertManager.processAlerts({
        alerts,
        riskLevel: alerts.some(a => a.severity === 'critical') ? 'critical' : 'high',
        recommendations: []
      });
    } else if (alerts.length === 0) {
      console.log('✅ No alerts to trigger (values within thresholds)');
    }
  }

  // Cập nhật ngưỡng và lưu vào LocalStorage
  updateThresholds(newThresholds) {
    this.thresholds = { ...this.thresholds, ...newThresholds };
    try {
      localStorage.setItem('thresholds', JSON.stringify(this.thresholds));
    } catch (e) {
      console.warn('Lỗi lưu ngưỡng:', e);
    }
  }

  // Lấy giá trị ngưỡng hiện tại
  getThresholds() {
    return { ...this.thresholds };
  }
}

window.thresholdAlertSystem = new ThresholdAlertSystem();
console.log('✅ threshold-alerts.js đã tải');