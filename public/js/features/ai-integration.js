// --- HỆ THỐNG TÍCH HỢP AI (AI INTEGRATION SYSTEM) ---
// Xử lý cấu hình, định vị, và các lệnh ngôn ngữ tự nhiên. AI có thể kiểm soát toàn bộ hệ thống.

class AIIntegrationSystem {
  constructor() {
    this.location = null;
    this.locationVerified = false;
    this.thresholds = {
      tempHigh: 30,
      tempLow: 15,
      humidityHigh: 80,
      humidityLow: 30,
      batteryLow: 20
    };
    this.currentWeatherData = null;

    // Cờ kiểm soát hệ thống
    this.systemControls = {
      toastsEnabled: true,
      soundEnabled: true,
      historyEnabled: true,
      autoAdjustEnabled: false,
      sensorLoggingEnabled: true,
      alertsEnabled: true
    };

    // Phân tích AI
    this.analytics = {
      avgTemperature: null,
      avgHumidity: null,
      alertCount: 0,
      lastUpdate: null
    };

    // Khóa API MapTiler
    this.mapTilerKey = 'TU3zDldb3knP5Hoeqiok';

    this.init();
  }

  // Khởi tạo hệ thống tích hợp AI
  init() {
    this.loadThresholds();
    this.loadLocation();
    this.loadSystemControls();

    // Cập nhật vị trí lên header nếu đã có
    if (this.location && typeof capNhatViTri === 'function') {
      capNhatViTri(this.location);
    }

    // Lắng nghe thay đổi chế độ tối từ giao diện (nút modal)
    window.addEventListener('darkModeChanged', (event) => {
      console.log('🔄 Chế độ tối thay đổi qua giao diện:', event.detail);
      // AI đồng bộ hóa với sự thay đổi
    });

    console.log('✅ AI Integration System initialized (EXTENDED MODE)');
  }

  // Tự động phát hiện vị trí người dùng bằng Geolocation API
  // @returns {Promise<Object>} Đối tượng vị trí {latitude, longitude, city}
  async detectLocation() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Trình duyệt không hỗ trợ định vị'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;

          try {
            // Cố gắng lấy tên thành phố bằng Reverse Geocoding
            const geocodeResult = await this.reverseGeocode(latitude, longitude);
            const city = geocodeResult.fullAddress || geocodeResult.displayName;

            this.location = {
              latitude,
              longitude,
              city: city || 'Vị trí không xác định',
              address: geocodeResult,
              verified: true,
              timestamp: Date.now()
            };

            this.locationVerified = true;
            this.saveLocation();

            resolve(this.location);
          } catch (err) {
            // Nếu Geocoding thất bại, vẫn lưu tọa độ
            this.location = {
              latitude,
              longitude,
              city: null,
              address: null,
              verified: true,
              timestamp: Date.now()
            };
            this.locationVerified = true;
            this.saveLocation();
            resolve(this.location);
          }
        },
        (error) => {
          reject(new Error(`Định vị thất bại: ${error.message}`));
        }
      );
    });
  }

  // Reverse geocode tọa độ sang địa chỉ đầy đủ (dùng OpenStreetMap Nominatim)
  // @param {number} lat Vĩ độ
  // @param {number} lon Kinh độ
  // @returns {Promise<Object>} Đối tượng địa chỉ với các thành phần chi tiết
  async reverseGeocode(lat, lon) {
    try {
      // Dùng OpenStreetMap Nominatim với mức độ chi tiết tối đa
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1&accept-language=vi`,
        {
          headers: {
            'Accept-Language': 'vi',
            'User-Agent': 'IoT-Monitoring-System'
          }
        }
      );

      if (!response.ok) throw new Error('Geocoding failed');

      const data = await response.json();
      const address = data.address || {};

      // Trích xuất các thành phần địa chỉ
      const addressInfo = {
        street: address.road || address.street || null,
        houseNumber: address.house_number || null,
        hamlet: address.hamlet || null,
        village: address.village || null,
        suburb: address.suburb || null,
        ward: address.ward || address.neighbourhood || null,
        district: address.county || address.city_district || null,
        city: address.city || address.state || null,
        province: address.state || address.province || null,
        country: address.country || 'Vietnam',
        postcode: address.postcode || null
      };

      // Xây dựng địa chỉ đầy đủ đã định dạng
      const addressParts = [];

      // Đường và số nhà
      if (addressInfo.houseNumber && addressInfo.street) {
        addressParts.push(`${addressInfo.houseNumber} ${addressInfo.street}`);
      } else if (addressInfo.street) {
        addressParts.push(addressInfo.street);
      }

      // Xóm/Làng/Thị trấn
      if (addressInfo.hamlet) {
        addressParts.push(addressInfo.hamlet);
      } else if (addressInfo.village) {
        addressParts.push(addressInfo.village);
      }

      // Phường/Xã
      if (addressInfo.ward) {
        addressParts.push(addressInfo.ward);
      }

      // Quận/Huyện
      if (addressInfo.district) {
        addressParts.push(addressInfo.district);
      }

      // Thành phố/Tỉnh
      if (addressInfo.city) {
        addressParts.push(addressInfo.city);
      }

      const fullAddress = addressParts.filter(p => p && p.trim()).join(', ');

      // Trả về cả địa chỉ đầy đủ và các thành phần
      return {
        fullAddress: fullAddress || 'Vị trí không xác định',
        components: addressInfo,
        displayName: data.display_name || fullAddress || null
      };
    } catch (err) {
      console.warn('Lỗi Reverse Geocoding:', err);
      return {
        fullAddress: 'Vị trí không xác định',
        components: {},
        displayName: null
      };
    }
  }

  // Đặt vị trí thủ công từ chuỗi địa chỉ
  async setLocationFromAddress(addressStr) {
    try {
      // Geocode địa chỉ để lấy tọa độ
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(addressStr)}&accept-language=vi`,
        {
          headers: { 'User-Agent': 'IoT-Monitoring-System' }
        }
      );

      if (!response.ok) throw new Error('Geocoding failed');
      const results = await response.json();

      if (!Array.isArray(results) || results.length === 0) {
        return {
          success: false,
          message: '❌ Không tìm thấy địa chỉ. Vui lòng thử lại với tên địa điểm cụ thể hơn.'
        };
      }

      const firstResult = results[0];
      const latitude = parseFloat(firstResult.lat);
      const longitude = parseFloat(firstResult.lon);

      // Reverse geocode để lấy địa chỉ chi tiết
      const geocodeResult = await this.reverseGeocode(latitude, longitude);

      this.location = {
        latitude,
        longitude,
        city: geocodeResult.fullAddress || addressStr,
        address: geocodeResult,
        verified: true,
        timestamp: Date.now()
      };

      this.locationVerified = true;
      this.saveLocation();

      // Cập nhật UI
      if (typeof capNhatViTri === 'function') {
        capNhatViTri(this.location);
      }

      return {
        success: true,
        message: `✅ Đã cập nhật vị trí:\n📍 ${geocodeResult.fullAddress}\n🗺️ ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`,
        location: this.location
      };
    } catch (err) {
      return {
        success: false,
        message: `❌ Lỗi: ${err.message}`
      };
    }
  }

  // Tải vị trí từ localStorage
  loadLocation() {
    try {
      const saved = localStorage.getItem('aiSystemLocation');
      if (saved) {
        this.location = JSON.parse(saved);
        this.locationVerified = this.location.verified;
      }
    } catch (err) {
      console.warn('⚠️ Lỗi tải vị trí:', err);
    }
  }

  // Lưu vị trí vào localStorage
  saveLocation() {
    try {
      localStorage.setItem('aiSystemLocation', JSON.stringify(this.location));
    } catch (err) {
      console.warn('⚠️ Lỗi lưu vị trí:', err);
    }
  }

  // Tải ngưỡng từ localStorage
  loadThresholds() {
    try {
      const saved = localStorage.getItem('aiSystemThresholds');
      if (saved) {
        this.thresholds = { ...this.thresholds, ...JSON.parse(saved) };
      }
    } catch (err) {
      console.warn('⚠️ Lỗi tải ngưỡng:', err);
    }
  }

  // Lưu ngưỡng vào localStorage
  saveThresholds() {
    try {
      localStorage.setItem('aiSystemThresholds', JSON.stringify(this.thresholds));
    } catch (err) {
      console.warn('⚠️ Lỗi lưu ngưỡng:', err);
    }
  }

  // Tải cài đặt hệ thống từ localStorage
  loadSystemControls() {
    try {
      const saved = localStorage.getItem('aiSystemControls');
      if (saved) {
        this.systemControls = { ...this.systemControls, ...JSON.parse(saved) };
      }
    } catch (err) {
      console.warn('⚠️ Lỗi tải cài đặt hệ thống:', err);
    }
  }

  // Lưu cài đặt hệ thống vào localStorage
  saveSystemControls() {
    try {
      localStorage.setItem('aiSystemControls', JSON.stringify(this.systemControls));
    } catch (err) {
      console.warn('⚠️ Lỗi lưu cài đặt hệ thống:', err);
    }
  }

  // Bật/tắt tính năng hệ thống thông qua lệnh AI
  // Ví dụ: "bật toàn bộ alert", "tắt âm thanh", "bật auto-adjust"
  toggleSystemFeature(featureName) {
    const feature = featureName.toLowerCase();
    const results = {
      changed: [],
      failed: [],
      message: ''
    };

    console.log('🔧 toggleSystemFeature được gọi với:', featureName);

    // Dark mode / Giao diện tối
    if (feature.includes('dark') || feature.includes('tối') || feature.includes('theme') || feature.includes('giao diện')) {
      // Xác định trạng thái
      let enableDark = null;
      if (feature.includes('bật') || feature.includes('enable') || feature.includes('mở')) {
        enableDark = true;
      } else if (feature.includes('tắt') || feature.includes('disable') || feature.includes('đóng')) {
        enableDark = false;
      } else {
        // Chuyển đổi nếu không được chỉ định
        enableDark = !document.body.classList.contains('dark-mode');
      }

      console.log(`🌓 Hành động Dark mode: ${enableDark ? 'BẬT' : 'TẮT'}`);

      // Áp dụng chế độ tối
      if (enableDark) {
        document.body.classList.add('dark-mode');
        localStorage.setItem('darkMode', 'true');
        console.log('✅ Class dark mode ĐÃ THÊM vào body');
      } else {
        document.body.classList.remove('dark-mode');
        localStorage.setItem('darkMode', 'false');
        console.log('✅ Class dark mode ĐÃ XÓA khỏi body');
      }

      // Cập nhật checkbox nếu tồn tại
      const darkModeCheckbox = document.getElementById('darkMode');
      if (darkModeCheckbox) {
        darkModeCheckbox.checked = enableDark;
        console.log('✅ Checkbox đã cập nhật:', enableDark);
      } else {
        console.warn('⚠️ Không tìm thấy checkbox dark mode');
      }

      // Phát sự kiện đồng bộ
      window.dispatchEvent(new CustomEvent('darkModeChanged', {
        detail: { enabled: enableDark, source: 'ai' }
      }));
      console.log('📢 Sự kiện darkModeChanged đã được phát đi');

      results.changed.push(`${enableDark ? '🌙' : '☀️'} Giao diện tối: ${enableDark ? 'BẬT' : 'TẮT'}`);
    }

    // Thông báo toast
    if (feature.includes('toast') || feature.includes('thông báo')) {
      this.systemControls.toastsEnabled = !this.systemControls.toastsEnabled;
      if (window.alertManager) {
        window.alertManager.toastsEnabled = this.systemControls.toastsEnabled;
      }
      console.log('✅ Thông báo toast:', this.systemControls.toastsEnabled ? 'BẬT' : 'TẮT');
      results.changed.push(`${this.systemControls.toastsEnabled ? '✅' : '❌'} Thông báo toast: ${this.systemControls.toastsEnabled ? 'BẬT' : 'TẮT'}`);
    }

    // Cảnh báo âm thanh
    if (feature.includes('sound') || feature.includes('âm thanh') || feature.includes('tiếng')) {
      this.systemControls.soundEnabled = !this.systemControls.soundEnabled;
      if (window.alertManager) {
        window.alertManager.soundEnabled = this.systemControls.soundEnabled;
      }
      console.log('✅ Cảnh báo âm thanh:', this.systemControls.soundEnabled ? 'BẬT' : 'TẮT');
      results.changed.push(`${this.systemControls.soundEnabled ? '✅' : '❌'} Âm thanh cảnh báo: ${this.systemControls.soundEnabled ? 'BẬT' : 'TẮT'}`);
    }

    // Lịch sử cảnh báo
    if (feature.includes('history') || feature.includes('lịch sử')) {
      this.systemControls.historyEnabled = !this.systemControls.historyEnabled;
      console.log('✅ Lịch sử cảnh báo:', this.systemControls.historyEnabled ? 'BẬT' : 'TẮT');
      results.changed.push(`${this.systemControls.historyEnabled ? '✅' : '❌'} Lưu lịch sử cảnh báo: ${this.systemControls.historyEnabled ? 'BẬT' : 'TẮT'}`);
    }

    // Tự động điều chỉnh ngưỡng
    if (feature.includes('auto') || feature.includes('tự động') || feature.includes('adjust')) {
      this.systemControls.autoAdjustEnabled = !this.systemControls.autoAdjustEnabled;
      console.log('✅ Tự động điều chỉnh:', this.systemControls.autoAdjustEnabled ? 'BẬT' : 'TẮT');
      results.changed.push(`${this.systemControls.autoAdjustEnabled ? '✅' : '❌'} Tự động điều chỉnh ngưỡng: ${this.systemControls.autoAdjustEnabled ? 'BẬT' : 'TẮT'}`);
      if (this.systemControls.autoAdjustEnabled) {
        results.changed.push('🤖 AI sẽ tự động điều chỉnh ngưỡng dựa trên xu hướng dữ liệu');
      }
    }

    // Ghi nhật ký cảm biến
    if (feature.includes('log') || feature.includes('ghi') || feature.includes('sensor')) {
      this.systemControls.sensorLoggingEnabled = !this.systemControls.sensorLoggingEnabled;
      console.log('✅ Ghi nhật ký cảm biến:', this.systemControls.sensorLoggingEnabled ? 'BẬT' : 'TẮT');
      results.changed.push(`${this.systemControls.sensorLoggingEnabled ? '✅' : '❌'} Ghi nhật ký cảm biến: ${this.systemControls.sensorLoggingEnabled ? 'BẬT' : 'TẮT'}`);
    }

    // Tất cả cảnh báo
    if (feature.includes('toàn bộ') || feature.includes('tất cả')) {
      this.systemControls.alertsEnabled = !this.systemControls.alertsEnabled;
      if (window.alertManager) {
        window.alertManager.toastsEnabled = this.systemControls.alertsEnabled;
        window.alertManager.soundEnabled = this.systemControls.alertsEnabled;
      }
      console.log('✅ Toàn bộ cảnh báo:', this.systemControls.alertsEnabled ? 'BẬT' : 'TẮT');
      results.changed.push(`${this.systemControls.alertsEnabled ? '✅' : '❌'} Toàn bộ cảnh báo: ${this.systemControls.alertsEnabled ? 'BẬT' : 'TẮT'}`);
    }

    if (results.changed.length > 0) {
      this.saveSystemControls();
      results.message = '⚙️ Cập nhật cài đặt hệ thống:\n' + results.changed.join('\n');
      console.log('📝 Kết quả cập nhật hệ thống:', results.message);
    } else {
      results.message = '❓ Không nhận ra tính năng. Thử: toast, âm thanh, lịch sử, auto-adjust, sensor logging';
    }

    return results;
  }

  // Lấy báo cáo trạng thái hệ thống
  getSystemStatus() {
    const status = {
      systemControlsStatus: this.systemControls,
      thresholds: this.thresholds,
      location: this.location,
      analytics: this.analytics,
      currentSensorData: this.getCurrentSensorData()
    };

    let report = '📊 TRẠNG THÁI HỆ THỐNG:\n\n';
    report += '⚙️ Cài đặt:\n';
    report += `  ${this.systemControls.alertsEnabled ? '✅' : '❌'} Cảnh báo\n`;
    report += `  ${this.systemControls.toastsEnabled ? '✅' : '❌'} Thông báo toast\n`;
    report += `  ${this.systemControls.soundEnabled ? '✅' : '❌'} Âm thanh\n`;
    report += `  ${this.systemControls.autoAdjustEnabled ? '✅' : '❌'} Tự động điều chỉnh\n`;

    report += '\n🌡️ Ngưỡng hiện tại:\n';
    report += `  Nhiệt độ: ${this.thresholds.tempLow}°C - ${this.thresholds.tempHigh}°C\n`;
    report += `  Độ ẩm: ${this.thresholds.humidityLow}% - ${this.thresholds.humidityHigh}%\n`;
    report += `  Pin: ≥${this.thresholds.batteryLow}%\n`;

    if (status.currentSensorData) {
      report += '\n📈 Dữ liệu hiện tại:\n';
      report += `  Nhiệt độ: ${status.currentSensorData.temperature}°C\n`;
      report += `  Độ ẩm: ${status.currentSensorData.humidity}%\n`;
      report += `  Pin: ${status.currentSensorData.battery}%\n`;
    }

    if (this.location) {
      report += `\n📍 Vị trí: ${this.location.city || 'Chưa xác định'}\n`;
    }

    return {
      message: report,
      status: status
    };
  }

  // AI tự động điều chỉnh ngưỡng dựa trên xu hướng dữ liệu
  autoAdjustThresholds(sensorHistory = []) {
    if (!this.systemControls.autoAdjustEnabled || sensorHistory.length < 10) {
      return null;
    }

    const temps = sensorHistory.map(d => d.temperature).filter(t => t !== null);
    const humidities = sensorHistory.map(d => d.humidity).filter(h => h !== null);

    if (temps.length === 0 || humidities.length === 0) {
      return null;
    }

    const avgTemp = temps.reduce((a, b) => a + b, 0) / temps.length;
    const avgHumidity = humidities.reduce((a, b) => a + b, 0) / humidities.length;
    const maxTemp = Math.max(...temps);
    const minTemp = Math.min(...temps);

    // Tính ngưỡng đã điều chỉnh với biên độ 10%
    const newTempHigh = Math.ceil(maxTemp * 1.1);
    const newTempLow = Math.floor(minTemp * 0.9);
    const newHumidityHigh = Math.min(100, Math.ceil(avgHumidity * 1.2));
    const newHumidityLow = Math.max(0, Math.floor(avgHumidity * 0.8));

    const adjustments = [];

    if (newTempHigh !== this.thresholds.tempHigh) {
      adjustments.push(`Nhiệt độ tối đa: ${this.thresholds.tempHigh}°C → ${newTempHigh}°C`);
      this.thresholds.tempHigh = newTempHigh;
    }

    if (newTempLow !== this.thresholds.tempLow) {
      adjustments.push(`Nhiệt độ tối thiểu: ${this.thresholds.tempLow}°C → ${newTempLow}°C`);
      this.thresholds.tempLow = newTempLow;
    }

    if (newHumidityHigh !== this.thresholds.humidityHigh) {
      adjustments.push(`Độ ẩm tối đa: ${this.thresholds.humidityHigh}% → ${newHumidityHigh}%`);
      this.thresholds.humidityHigh = newHumidityHigh;
    }

    if (newHumidityLow !== this.thresholds.humidityLow) {
      adjustments.push(`Độ ẩm tối thiểu: ${this.thresholds.humidityLow}% → ${newHumidityLow}%`);
      this.thresholds.humidityLow = newHumidityLow;
    }

    if (adjustments.length > 0) {
      this.saveThresholds();
      this.saveThresholdsToAPI();
      return {
        success: true,
        adjustments: adjustments,
        newThresholds: this.thresholds,
        baselineSummary: {
          avgTemp: avgTemp.toFixed(2),
          avgHumidity: avgHumidity.toFixed(2),
          tempRange: `${minTemp}°C - ${maxTemp}°C`
        }
      };
    }

    return {
      success: false,
      message: 'Dữ liệu đã ổn định, không cần điều chỉnh'
    };
  }

  // Báo cáo chẩn đoán AI
  getDiagnosticReport() {
    let report = '🔧 BÁO CÁO CHẨN ĐOÁN HỆ THỐNG:\n\n';

    // Kiểm tra các thành phần quan trọng
    const checks = {
      'AlertManager': window.alertManager ? '✅ OK' : '❌ Không khả dụng',
      'Socket.IO': window.socket ? '✅ Kết nối' : '❌ Mất kết nối',
      'Threshold System': window.thresholdAlertSystem ? '✅ OK' : '⚠️ Chưa khởi tạo',
      'Local Storage': this._checkLocalStorage() ? '✅ OK' : '❌ Không hoạt động',
      'Geolocation': navigator.geolocation ? '✅ Hỗ trợ' : '❌ Không hỗ trợ',
      'Web Audio': this._checkWebAudio() ? '✅ Hỗ trợ' : '❌ Không hỗ trợ'
    };

    report += 'Thành phần hệ thống:\n';
    Object.entries(checks).forEach(([name, status]) => {
      report += `  ${name}: ${status}\n`;
    });

    report += '\nCài đặt hệ thống:\n';
    report += `  Số cảnh báo: ${this.analytics.alertCount}\n`;
    report += `  Lần cập nhật cuối: ${this.analytics.lastUpdate ? new Date(this.analytics.lastUpdate).toLocaleString('vi-VN') : 'Chưa cập nhật'}\n`;

    return {
      message: report,
      checks: checks
    };
  }

  // Helper - kiểm tra localStorage
  _checkLocalStorage() {
    try {
      const test = '__storage_test__';
      localStorage.setItem(test, test);
      localStorage.removeItem(test);
      return true;
    } catch (e) {
      return false;
    }
  }

  // Helper - kiểm tra Web Audio API
  _checkWebAudio() {
    return !!(window.AudioContext || window.webkitAudioContext);
  }

  // Phân tích lệnh cài đặt ngưỡng từ ngôn ngữ tự nhiên
  parseThresholdCommand(text) {
    const lowerText = text.toLowerCase();
    const results = {
      updated: [],
      failed: [],
      message: ''
    };

    // Kiểm tra từ khóa liên quan đến ngưỡng (bắt buộc)
    const hasThresholdKeyword = /(?:cảnh báo|ngưỡng|đặt|thiết lập|điều chỉnh)/.test(lowerText);
    if (!hasThresholdKeyword) {
      return results; // Bỏ qua nếu không tìm thấy từ khóa
    }

    // Patterns Nhiệt độ tối đa
    const tempHighPatterns = [
      /(?:cảnh báo|ngưỡng|đặt)?.*?(?:nhiệt độ|temp)\s+(?:tối đa|cao|max)\s*(\d+(?:[.,]\d+)?)/,
      /(?:cảnh báo|ngưỡng|đặt)?.*?(?:tối đa|cao|max)\s+(?:nhiệt độ|temp)\s*(\d+(?:[.,]\d+)?)/,
      /(?:cảnh báo|ngưỡng|đặt)?.*?(?:tối đa|cao|max)\s*(\d+(?:[.,]\d+)?)\s*(?:độ|°c|c)(?:.*?(?:nhiệt độ|temp))?/
    ];

    // Patterns Nhiệt độ tối thiểu
    const tempLowPatterns = [
      /(?:cảnh báo|ngưỡng|đặt)?.*?(?:nhiệt độ|temp)\s+(?:tối thiểu|thấp|min)\s*(\d+(?:[.,]\d+)?)/,
      /(?:cảnh báo|ngưỡng|đặt)?.*?(?:tối thiểu|thấp|min)\s+(?:nhiệt độ|temp)\s*(\d+(?:[.,]\d+)?)/,
      /(?:cảnh báo|ngưỡng|đặt)?.*?(?:tối thiểu|thấp|min)\s*(\d+(?:[.,]\d+)?)\s*(?:độ|°c|c)(?:.*?(?:nhiệt độ|temp))?/
    ];

    // Patterns Độ ẩm tối đa
    const humidityHighPatterns = [
      /(?:cảnh báo|ngưỡng|đặt)?.*?(?:độ ẩm|ẩm độ)\s+(?:tối đa|cao|max)\s*(\d+(?:[.,]\d+)?)/,
      /(?:cảnh báo|ngưỡng|đặt)?.*?(?:tối đa|cao|max)\s+(?:độ ẩm|ẩm độ)\s*(\d+(?:[.,]\d+)?)/,
      /(?:cảnh báo|ngưỡng|đặt)?.*?(?:tối đa|cao|max)\s*(\d+(?:[.,]\d+)?)\s*(?:%|phần trăm)(?:.*?(?:độ ẩm|ẩm độ))?/
    ];

    // Patterns Độ ẩm tối thiểu
    const humidityLowPatterns = [
      /(?:cảnh báo|ngưỡng|đặt)?.*?(?:độ ẩm|ẩm độ)\s+(?:tối thiểu|thấp|min)\s*(\d+(?:[.,]\d+)?)/,
      /(?:cảnh báo|ngưỡng|đặt)?.*?(?:tối thiểu|thấp|min)\s+(?:độ ẩm|ẩm độ)\s*(\d+(?:[.,]\d+)?)/,
      /(?:cảnh báo|ngưỡng|đặt)?.*?(?:tối thiểu|thấp|min)\s*(\d+(?:[.,]\d+)?)\s*(?:%|phần trăm)(?:.*?(?:độ ẩm|ẩm độ))?/
    ];

    // Patterns Pin
    const batteryPatterns = [
      /(?:cảnh báo|ngưỡng|đặt)?.*?pin\s+(?:tối thiểu|thấp|min)\s*(\d+(?:[.,]\d+)?)/,
      /(?:cảnh báo|ngưỡng|đặt)?.*?(?:tối thiểu|thấp|min)\s+pin\s*(\d+(?:[.,]\d+)?)/,
      /(?:cảnh báo|ngưỡng|đặt)?.*?(?:tối thiểu|thấp|min)\s*(\d+(?:[.,]\d+)?)\s*(?:%|phần trăm)(?:.*?pin)?/
    ];

    // Hàm helper tìm kiếm
    const findMatch = (patterns) => {
      for (const pattern of patterns) {
        const match = lowerText.match(pattern);
        if (match) return match;
      }
      return null;
    };

    // Cập nhật nhiệt độ tối đa
    const tempHighMatch = findMatch(tempHighPatterns);
    if (tempHighMatch) {
      const newValue = parseFloat(tempHighMatch[1]);
      const oldValue = this.thresholds.tempHigh;
      if (newValue > 0 && newValue < 60) {
        this.updateThresholdUI('tempHigh', newValue);
        results.updated.push(`🌡️ Nhiệt độ tối đa: ${oldValue}°C → ${newValue}°C`);
      } else {
        results.failed.push('Nhiệt độ tối đa không hợp lệ (0-60°C)');
      }
    }

    // Cập nhật nhiệt độ tối thiểu
    const tempLowMatch = findMatch(tempLowPatterns);
    if (tempLowMatch) {
      const newValue = parseFloat(tempLowMatch[1]);
      const oldValue = this.thresholds.tempLow;
      if (newValue > -20 && newValue < 40) {
        this.updateThresholdUI('tempLow', newValue);
        results.updated.push(`🌡️ Nhiệt độ tối thiểu: ${oldValue}°C → ${newValue}°C`);
      } else {
        results.failed.push('Nhiệt độ tối thiểu không hợp lệ (-20-40°C)');
      }
    }

    // Cập nhật độ ẩm tối đa
    const humidityHighMatch = findMatch(humidityHighPatterns);
    if (humidityHighMatch) {
      const newValue = parseFloat(humidityHighMatch[1]);
      const oldValue = this.thresholds.humidityHigh;
      if (newValue > 0 && newValue <= 100) {
        this.updateThresholdUI('humidityHigh', newValue);
        results.updated.push(`💧 Độ ẩm tối đa: ${oldValue}% → ${newValue}%`);
      } else {
        results.failed.push('Độ ẩm tối đa không hợp lệ (0-100%)');
      }
    }

    // Cập nhật độ ẩm tối thiểu
    const humidityLowMatch = findMatch(humidityLowPatterns);
    if (humidityLowMatch) {
      const newValue = parseFloat(humidityLowMatch[1]);
      const oldValue = this.thresholds.humidityLow;
      if (newValue > 0 && newValue <= 100) {
        this.updateThresholdUI('humidityLow', newValue);
        results.updated.push(`💧 Độ ẩm tối thiểu: ${oldValue}% → ${newValue}%`);
      } else {
        results.failed.push('Độ ẩm tối thiểu không hợp lệ (0-100%)');
      }
    }

    // Cập nhật pin tối thiểu
    const batteryMatch = findMatch(batteryPatterns);
    if (batteryMatch) {
      const newValue = parseFloat(batteryMatch[1]);
      const oldValue = this.thresholds.batteryLow;
      if (newValue > 0 && newValue <= 100) {
        this.updateThresholdUI('batteryLow', newValue);
        results.updated.push(`🔋 Pin tối thiểu: ${oldValue}% → ${newValue}%`);
      } else {
        results.failed.push('Ngưỡng pin không hợp lệ (0-100%)');
      }
    }

    if (results.updated.length > 0) {
      this.saveThresholds();
      results.message = '✅ Cập nhật ngay lập tức:\n' + results.updated.join('\n');
    } else if (results.failed.length > 0) {
      results.message = '❌ Lỗi cài đặt:\n' + results.failed.join('\n');
    }

    return results;
  }

  // Lấy dữ liệu cảm biến hiện tại (từ UI/Global)
  // @returns {Object} Dữ liệu cảm biến
  getCurrentSensorData() {
    try {
      if (window.currentSensorData) {
        return window.currentSensorData;
      }

      // Phân tích từ header
      const tempEl = document.getElementById('tsNhietDo');
      const humidityEl = document.getElementById('tsDoAm');
      const batteryEl = document.getElementById('tsPin');

      if (!tempEl || !humidityEl) return null;

      const tempMatch = tempEl.textContent.match(/[\d.]+/);
      const humidityMatch = humidityEl.textContent.match(/[\d.]+/);
      const batteryMatch = batteryEl ? batteryEl.textContent.match(/[\d.]+/) : null;

      return {
        temperature: tempMatch ? parseFloat(tempMatch[0]) : null,
        humidity: humidityMatch ? parseFloat(humidityMatch[0]) : null,
        battery: batteryMatch ? parseFloat(batteryMatch[0]) : null,
        timestamp: Date.now()
      };
    } catch (err) {
      console.warn('⚠️ Lỗi lấy dữ liệu cảm biến:', err);
      return null;
    }
  }

  // Tạo phản hồi AI về thời tiết/nhiệt độ cục bộ
  // @returns {Promise<string>} Nội dung phản hồi AI
  async getWeatherInsight() {
    const sensorData = this.getCurrentSensorData();

    if (!sensorData || !sensorData.temperature) {
      return '⚠️ Chưa có dữ liệu cảm biến. Vui lòng đợi dữ liệu từ thiết bị.';
    }

    if (!this.locationVerified) {
      return '📍 Chưa định vị được vị trí. Hãy bật định vị để tôi có thể giúp bạn tốt hơn.';
    }

    const { temperature, humidity } = sensorData;
    const locationText = this.location.city ? `tại ${this.location.city}` : 'ở vị trí của bạn';

    let insight = `📊 Thông tin thời tiết ${locationText}:\n`;
    insight += `🌡️ Nhiệt độ: ${temperature}°C\n`;
    insight += `💧 Độ ẩm: ${humidity}%\n\n`;

    // Tạo khuyến nghị dựa trên điều kiện hiện tại
    const recommendations = [];

    if (temperature > this.thresholds.tempHigh) {
      recommendations.push(`⚠️ Nhiệt độ cao hơn ngưỡng (${this.thresholds.tempHigh}°C). Khuyến nghị bật điều hòa.`);
    } else if (temperature < this.thresholds.tempLow) {
      recommendations.push(`🥶 Nhiệt độ thấp hơn ngưỡng (${this.thresholds.tempLow}°C). Khuyến nghị bật sưởi.`);
    } else {
      recommendations.push('✅ Nhiệt độ bình thường');
    }

    if (humidity > this.thresholds.humidityHigh) {
      recommendations.push(`💧 Độ ẩm cao (${this.thresholds.humidityHigh}%). Khuyến nghị bật máy hút ẩm.`);
    } else if (humidity < this.thresholds.humidityLow) {
      recommendations.push(`🏜️ Không khí khô (${this.thresholds.humidityLow}%). Khuyến nghị bật máy tạo ẩm.`);
    } else {
      recommendations.push('✅ Độ ẩm hợp lý');
    }

    insight += 'Khuyến nghị:\n' + recommendations.join('\n');

    return insight;
  }

  // Xử lý lệnh ngôn ngữ tự nhiên của AI
  // @param {string} command Lệnh người dùng
  // @returns {Promise<Object>} {type, message, data}
  async processCommand(command) {
    const lowerCmd = command.toLowerCase();
    console.log('🎯 AI Processing command:', command);

    // Phát hiện và ưu tiên lệnh kiểm soát hệ thống
    const systemCmd = this._detectSystemCommand(lowerCmd);
    if (systemCmd) {
      console.log('📋 Lệnh hệ thống đã phát hiện:', systemCmd.type);
      return systemCmd;
    }

    // Cập nhật vị trí thủ công - phát hiện các patterns
    if (lowerCmd.includes('ở ') || lowerCmd.includes('địa chỉ') || lowerCmd.includes('đặt vị trí') ||
        lowerCmd.includes('tôi hiện') || lowerCmd.includes('chuyển đến')) {

      // Trích xuất địa chỉ từ tin nhắn
      let addressStr = null;

      // Pattern 1: "tôi ở [địa chỉ]"
      const match1 = command.match(/(?:tôi\s+)?ở\s+(.+?)(?:\s*$|\.)/i);
      if (match1) addressStr = match1[1].trim();

      // Pattern 2: "địa chỉ: [địa chỉ]" hoặc "địa chỉ là [địa chỉ]"
      const match2 = command.match(/(?:địa\s+chỉ|tọa\s+độ)[\s:]*(.+?)(?:\s*$|\.)/i);
      if (match2) addressStr = match2[1].trim();

      // Pattern 3: "đặt vị trí [địa chỉ]"
      const match3 = command.match(/(?:đặt|cập\s+nhật)\s+(?:vị\s+trí|địa\s+chỉ)\s+(.+?)(?:\s*$|\.)/i);
      if (match3) addressStr = match3[1].trim();

      // Pattern 4: Kiểm tra xem message có chứa chuỗi như "147 trường chinh, cẩm lệ, đà nẵng"
      if (!addressStr) {
        // Lấy từ từ thứ 2 trở đi nếu là "tôi ở" hoặc tương tự
        const words = command.split(/\s+/);
        if (words.length > 2 && (lowerCmd.includes('ở') || lowerCmd.includes('tại'))) {
          const idx = lowerCmd.includes('ở') ? lowerCmd.indexOf('ở') : lowerCmd.indexOf('tại');
          addressStr = command.substring(idx + 1).trim();
        }
      }

      if (addressStr && addressStr.length > 3) {
        const result = await this.setLocationFromAddress(addressStr);
        console.log('📍 Lệnh vị trí đã xử lý');
        return {
          type: 'location',
          message: result.message,
          data: result.location || null
        };
      }
    }

    // Lệnh điều khiển hệ thống (bật/tắt tính năng)
    if (lowerCmd.includes('bật') || lowerCmd.includes('tắt')) {
      console.log('⚙️ Lệnh điều khiển hệ thống đã phát hiện');
      const result = this.toggleSystemFeature(command);
      return {
        type: 'system_control',
        message: result.message,
        data: this.systemControls
      };
    }

    // Trạng thái hệ thống
    if (lowerCmd.includes('trạng thái') || lowerCmd.includes('tình trạng') ||
        lowerCmd.includes('hệ thống') && (lowerCmd.includes('nào') || lowerCmd.includes('gì'))) {
      const result = this.getSystemStatus();
      return {
        type: 'system_status',
        message: result.message,
        data: result.status
      };
    }

    // Chẩn đoán hệ thống
    if (lowerCmd.includes('chẩn đoán') || lowerCmd.includes('diagnos') ||
        (lowerCmd.includes('kiểm tra') && lowerCmd.includes('hệ thống'))) {
      const result = this.getDiagnosticReport();
      return {
        type: 'diagnostic',
        message: result.message,
        data: result.checks
      };
    }

    // Định vị
    if (lowerCmd.includes('định vị') || lowerCmd.includes('vị trí hiện tại') || lowerCmd.includes('location')) {
      try {
        const location = await this.detectLocation();
        // Cập nhật vị trí lên header
        if (typeof capNhatViTri === 'function') {
          capNhatViTri(location);
        }

        // Tạo thông báo chi tiết
        let message = `✅ Đã định vị:\n`;
        if (location.address && location.address.fullAddress) {
          message += `📍 ${location.address.fullAddress}\n`;
          if (location.address.displayName) {
            message += `📌 ${location.address.displayName}\n`;
          }
        } else if (location.city) {
          message += `📍 ${location.city}\n`;
        }
        message += `🗺️ Tọa độ: ${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}`;

        return {
          type: 'location',
          message: message,
          data: location
        };
      } catch (err) {
        return {
          type: 'error',
          message: `❌ ${err.message}`,
          data: null
        };
      }
    }

    // Cài đặt ngưỡng
    if (lowerCmd.includes('đặt') || lowerCmd.includes('cài đặt') || lowerCmd.includes('ngưỡng')) {
      const result = this.parseThresholdCommand(command);
      return {
        type: 'threshold',
        message: result.message,
        data: this.thresholds
      };
    }

    // Thông tin thời tiết
    if (lowerCmd.includes('thời tiết') || lowerCmd.includes('nhiệt độ') ||
        lowerCmd.includes('chỗ tôi') || lowerCmd.includes('tại đây')) {
      const insight = await this.getWeatherInsight();
      return {
        type: 'weather',
        message: insight,
        data: {
          location: this.location,
          thresholds: this.thresholds,
          currentData: this.getCurrentSensorData()
        }
      };
    }

    // Hiển thị cài đặt ngưỡng hiện tại
    if (lowerCmd.includes('ngưỡng nào') || lowerCmd.includes('cài đặt nào')) {
      const msg = `⚙️ Cài đặt ngưỡng hiện tại:\n` +
                  `🌡️ Nhiệt độ: ${this.thresholds.tempLow}°C - ${this.thresholds.tempHigh}°C\n` +
                  `💧 Độ ẩm: ${this.thresholds.humidityLow}% - ${this.thresholds.humidityHigh}%\n` +
                  `🔋 Pin tối thiểu: ${this.thresholds.batteryLow}%`;
      return {
        type: 'config',
        message: msg,
        data: this.thresholds
      };
    }

    return {
      type: 'unknown',
      message: '❓ Tôi không hiểu lệnh. Thử: định vị, đặt ngưỡng, thời tiết, trạng thái, chẩn đoán, hoặc bật/tắt tính năng',
      data: null
    };
  }

  // Phát hiện và xử lý lệnh kiểm soát hệ thống
  // @param {string} cmd Lệnh viết thường
  // @returns {Object|null} Kết quả lệnh hoặc null nếu không phải lệnh hệ thống
  _detectSystemCommand(cmd) {
    // Chế độ hệ thống
    const modePatterns = {
      'yên tĩnh|quiet|silent': 'quiet',
      'đêm|night|tối': 'night',
      'ngày|day|sáng': 'day',
      'làm việc|work|office': 'work',
      'nhà|home|normal': 'home'
    };

    for (const [pattern, mode] of Object.entries(modePatterns)) {
      if (new RegExp(`(?:chế độ|mode)?\\s*(?:${pattern})`, 'i').test(cmd)) {
        return {
          type: 'mode',
          message: this._applyMode(mode),
          data: { mode: mode }
        };
      }
    }

    // Tối ưu hóa tự động
    if (/(?:tự động|auto|tối ưu|optimize)/.test(cmd) && /(?:điều chỉnh|adjust)/.test(cmd)) {
      this.systemControls.autoAdjustEnabled = !this.systemControls.autoAdjustEnabled;
      this.saveSystemControls();
      return {
        type: 'system_control',
        message: `${this.systemControls.autoAdjustEnabled ? '✅' : '❌'} Tự động điều chỉnh: ${this.systemControls.autoAdjustEnabled ? 'BẬT' : 'TẮT'}`,
        data: this.systemControls
      };
    }

    return null;
  }

  // Áp dụng chế độ hệ thống
  // @param {string} mode Tên chế độ
  // @returns {string} Thông báo trạng thái
  _applyMode(mode) {
    const modeConfig = {
      quiet: { alertsEnabled: false, soundEnabled: false, toastsEnabled: true },
      night: { alertsEnabled: true, soundEnabled: false, toastsEnabled: false },
      day: { alertsEnabled: true, soundEnabled: true, toastsEnabled: true },
      work: { alertsEnabled: true, soundEnabled: false, toastsEnabled: true },
      home: { alertsEnabled: true, soundEnabled: true, toastsEnabled: true }
    };

    const config = modeConfig[mode];
    if (!config) return '❌ Chế độ không hợp lệ';

    // Áp dụng cấu hình
    Object.assign(this.systemControls, config);
    this.saveSystemControls();

    const modeNames = {
      quiet: '🔇 Chế độ yên tĩnh',
      night: '🌙 Chế độ đêm',
      day: '☀️ Chế độ ngày',
      work: '💼 Chế độ làm việc',
      home: '🏠 Chế độ nhà'
    };

    return `✅ Chuyển sang ${modeNames[mode]}`;
  }

  // Cập nhật ngưỡng trong hệ thống và form UI
  // @param {string} key Khóa ngưỡng
  // @param {number} value Giá trị mới
  // @returns {boolean} Trạng thái thành công
  updateThresholdUI(key, value) {
    const fieldMap = {
      tempHigh: 'tempMax',
      tempLow: 'tempMin',
      humidityHigh: 'humidityMax',
      humidityLow: 'humidityMin',
      batteryLow: 'batteryMin'
    };

    const fieldId = fieldMap[key];
    if (!fieldId) return false;

    // Cập nhật hệ thống
    if (key in this.thresholds) {
      this.thresholds[key] = value;
    } else {
      return false;
    }

    // Cập nhật form UI nếu có
    const inputEl = document.getElementById(fieldId);
    if (inputEl) {
      inputEl.value = value;
    }

    // Lưu vào localStorage
    this.saveThresholds();

    // Tự động lưu vào API/database ngay lập tức
    this.saveThresholdsToAPI();

    return true;
  }

  // Tự động lưu ngưỡng vào backend API/database
  async saveThresholdsToAPI() {
    try {
      const payload = {
        tempMax: this.thresholds.tempHigh,
        tempMin: this.thresholds.tempLow,
        humidityMax: this.thresholds.humidityHigh,
        humidityMin: this.thresholds.humidityLow,
        batteryMin: this.thresholds.batteryLow
      };

      const res = await fetch('/api/thresholds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!data.success) {
        console.warn('⚠️ Lưu ngưỡng API thất bại:', data.message);
      } else {
        console.log('✅ Ngưỡng đã tự động lưu vào API');
      }
    } catch (error) {
      console.warn('⚠️ Lỗi lưu ngưỡng vào API:', error.message);
    }
  }

  // Cập nhật giá trị ngưỡng trực tiếp
  updateThreshold(key, value) {
    return this.updateThresholdUI(key, value);
  }
}

// Global instance
window.aiIntegrationSystem = null;

// Khởi tạo Hệ thống tích hợp AI
function initAIIntegration() {
  window.aiIntegrationSystem = new AIIntegrationSystem();
  return window.aiIntegrationSystem;
}

// Xử lý tin nhắn chat qua tích hợp AI
// @param {string} message Tin nhắn người dùng
// @returns {Promise<Object>} Phản hồi AI
async function processAIChatMessage(message) {
  console.log('💬 processAIChatMessage được gọi với:', message);
  if (!window.aiIntegrationSystem) {
    console.log('🔄 Đang khởi tạo Hệ thống tích hợp AI...');
    initAIIntegration();
  }
  const result = await window.aiIntegrationSystem.processCommand(message);
  console.log('📤 Kết quả phản hồi AI:', result);
  return result;
}

// Tự động khởi tạo khi DOM sẵn sàng
document.addEventListener('DOMContentLoaded', () => {
  initAIIntegration();
});

console.log('✅ ai-integration.js đã tải');