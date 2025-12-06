// Trợ lý Điều khiển Nhanh - AI Quick Control Assistant
// Đề xuất và thực hiện hàng loạt hành động điều khiển thiết bị dựa trên dữ liệu realtime

class SmartRecommendationEngine {
  constructor() {
    this.recommendations = [];
    this.thresholds = {
      tempHigh: 27,    // Dễ trigger với dữ liệu ~27°C
      tempLow: 19,
      humidityHigh: 82, // Dễ trigger với dữ liệu ~83-85%
      humidityLow: 40,
      batteryLow: 50    // Để kiểm tra pin (hiện 78-81%)
    };
    this.lastUpdate = null;
    this.updateInterval = 10000; // 10 seconds - update every 10 seconds
    this.lastSensorData = null; // Lưu dữ liệu cảm biến lần cuối để phát hiện thay đổi
    this.lastRecommendationsHash = null; // Lưu hash của recommendations lần cuối
    this.init();
  }

  /**
   * Khởi tạo công cụ đề xuất
   */
  init() {
    // Tải các ngưỡng từ config nếu có
    this.loadThresholds();

    // Bắt đầu cập nhật đề xuất định kỳ
    this.startAutoUpdate();

    console.log('✅ Trợ lý Điều khiển Nhanh khởi động thành công');
  }

  /**
   * Tải các ngưỡng từ API server (không chặn)
   */
  loadThresholds() {
    try {
      // Lấy từ server (không chặn, sử dụng .then())
      fetch('/api/thresholds')
        .then(r => {
          if (!r.ok) throw new Error('Failed to fetch thresholds');
          return r.json();
        })
        .then(data => {
          // Ánh xạ tên trường từ server sang tên trường của client
          const mapped = {
            tempHigh: data.tempMax || this.thresholds.tempHigh,
            tempLow: data.tempMin || this.thresholds.tempLow,
            humidityHigh: data.humidityMax || this.thresholds.humidityHigh,
            humidityLow: data.humidityMin || this.thresholds.humidityLow,
            batteryLow: data.batteryMin || this.thresholds.batteryLow
          };
          this.thresholds = mapped;
          console.log('✅ Loaded thresholds from server:', this.thresholds);
        })
        .catch(e => {
          console.warn('⚠️ Failed to load thresholds from server, using defaults:', e);
        });
    } catch (e) {
      console.warn('Failed to load thresholds:', e);
    }
  }

  /**
   * Lưu các ngưỡng vào localStorage
   */
  saveThresholds() {
    try {
      localStorage.setItem('recommendationThresholds', JSON.stringify(this.thresholds));
    } catch (e) {
      console.warn('Failed to save thresholds:', e);
    }
  }

  /**
   * Bắt đầu cập nhật tự động cho các đề xuất
   */
  startAutoUpdate() {
    if (this.autoUpdateId) clearInterval(this.autoUpdateId);

    this.autoUpdateId = setInterval(() => {
      this.update();
    }, this.updateInterval);
  }

  /**
   * Dừng cập nhật tự động
   */
  stopAutoUpdate() {
    if (this.autoUpdateId) {
      clearInterval(this.autoUpdateId);
      this.autoUpdateId = null;
    }
  }

  /**
   * Cập nhật các đề xuất dựa trên dữ liệu cảm biến hiện tại
   * Chỉ cập nhật khi có thay đổi dữ liệu đáng kể hoặc thay đổi đề xuất
   * @returns {Array<Object>} Mảng các đề xuất
   */
  async update() {
    const data = this.getCurrentSensorData();

    if (!data) {
      this.render();
      return this.recommendations;
    }

    // Kiểm tra xem dữ liệu có thay đổi không
    const dataChanged = this.hasSignificantDataChange(data);
    this.lastSensorData = { ...data }; // Lưu dữ liệu hiện tại

    // Nếu dữ liệu không thay đổi đáng kể, không cập nhật đề xuất
    if (!dataChanged && this.recommendations.length > 0) {
      console.log('📊 Dữ liệu không thay đổi đáng kể, giữ nguyên thông báo');
      this.updateTimestamp();
      return this.recommendations;
    }

    // Nếu dữ liệu thay đổi, cập nhật đề xuất
    console.log('🔄 Phát hiện thay đổi dữ liệu, cập nhật thông báo');
    this.recommendations = [];

    // Phân tích dựa trên quy tắc (nhanh, luôn hoạt động)
    this.analyzeTemperature(data.temperature);
    this.analyzeHumidity(data.humidity);
    this.analyzeBattery(data.battery);
    this.analyzeComboFactors(data);

    // Sắp xếp theo độ nghiêm trọng: critical → warning → info → success
    this.sortRecommendationsByPriority();

    // Nếu có vấn đề nghiêm trọng, lấy gợi ý AI
    const hasCritical = this.recommendations.some(r => r.severity === 'critical');

    if (hasCritical) {
      this.getAIPoweredRecommendations(data)
        .then(aiRecs => {
          if (aiRecs && aiRecs.length > 0) {
            // Thêm gợi ý AI nếu chưa có
            const newAiRecs = aiRecs.filter(ai =>
              !this.recommendations.some(r => r.title.includes(ai.message.substring(0, 20)))
            );
            if (newAiRecs.length > 0) {
              // Chuyển đổi AI recommendations sang format chuẩn
              newAiRecs.forEach(aiRec => {
                this.addRecommendation(
                  'info',
                  `💡 ${aiRec.message.split('\n')[0]}`, // Title là dòng đầu
                  'info',
                  aiRec.message // Detail là toàn bộ message
                );
              });
              this.sortRecommendationsByPriority();
              this.render();
            }
          }
        })
        .catch(e => console.warn('⚠️ Lỗi phân tích AI:', e));
    }

    this.lastUpdate = new Date();
    this.lastRecommendationsHash = this.getRecommendationsHash();
    this.render();

    return this.recommendations;
  }

  /**
   * Kiểm tra xem dữ liệu cảm biến có thay đổi đáng kể so với lần trước không
   * @param {Object} newData Dữ liệu cảm biến mới
   * @returns {Boolean} true nếu có thay đổi, false nếu không
   */
  hasSignificantDataChange(newData) {
    if (!this.lastSensorData) return true; // Lần đầu luôn cập nhật

    // Kiểm tra nếu có thay đổi hơn 0.5°C, 2% độ ẩm hoặc 2% pin
    const tempChange = Math.abs(newData.temperature - this.lastSensorData.temperature) > 0.5;
    const humidityChange = Math.abs(newData.humidity - this.lastSensorData.humidity) > 2;
    const batteryChange = Math.abs(newData.battery - this.lastSensorData.battery) > 2;

    return tempChange || humidityChange || batteryChange;
  }

  /**
   * Tính hash của các đề xuất để phát hiện thay đổi
   * @returns {String} Chuỗi hash
   */
  getRecommendationsHash() {
    const recIds = this.recommendations.map(r => `${r.severity}:${r.title}`).join('|');
    return recIds;
  }

  /**
   * Sắp xếp recommendations theo ưu tiên
   */
  sortRecommendationsByPriority() {
    const priorityMap = { critical: 0, warning: 1, success: 2, info: 3 };
    this.recommendations.sort((a, b) => {
      return (priorityMap[a.severity] || 99) - (priorityMap[b.severity] || 99);
    });
  }

  /**
   * Lấy các đề xuất do AI cung cấp dựa trên dữ liệu cảm biến
   * @param {Object} data Dữ liệu cảm biến
   * @returns {Promise<Array>} Các đề xuất từ AI hoặc null
   */
  async getAIPoweredRecommendations(data) {
    try {
      // Xây dựng prompt AI để phân tích toàn diện
      const prompt = `Phân tích dữ liệu cảm biến vượt ngưỡng, đưa ra giải pháp:
- Nhiệt độ: ${data.temperature}°C
- Độ ẩm: ${data.humidity}%
- Pin: ${data.battery}%

Ngắn gọn: 1-2 hành động cụ thể để cải thiện. Tránh lặp lại.`;

      // Gọi AI thông qua API server với timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000); // Timeout 8 giây

      try {
        const response = await fetch('/api/ai-analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt, dataContext: data }),
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (!response.ok) {
          console.warn('⚠️ Lỗi API AI:', response.status);
          return null;
        }

        const result = await response.json();

        if (!result.success || !result.recommendations || result.recommendations.length === 0) {
          return null;
        }

        // Chuyển đổi các đề xuất từ AI sang định dạng cục bộ
        return result.recommendations.map(rec => ({
          icon: rec.icon || '💡',
          type: rec.type || 'recommend',
          message: rec.message,
          severity: rec.severity || 'info',
          action: rec.action || null,
          source: 'AI'
        }));
      } catch (fetchError) {
        clearTimeout(timeoutId);
        if (fetchError.name === 'AbortError') {
          console.warn('⚠️ Phân tích AI hết thời gian');
        } else {
          console.warn('⚠️ Lỗi lấy dữ liệu AI:', fetchError.message);
        }
        return null;
      }
    } catch (e) {
      console.warn('⚠️ Không thể lấy các đề xuất từ AI:', e);
      return null;
    }
  }

  getCurrentSensorData() {
    try {
      // Cố gắng lấy từ đối tượng window toàn cục (được cập nhật bởi main-page.js)
      if (window.currentSensorData) {
        return window.currentSensorData;
      }

      // Phân tích từ các hiển thị đầu
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
    } catch (e) {
      console.warn('Không thể lấy dữ liệu cảm biến:', e);
      return null;
    }
  }

  analyzeTemperature(temperature) {
    if (temperature === null || temperature === undefined) return;

    if (temperature > this.thresholds.tempHigh) {
      const excess = (temperature - this.thresholds.tempHigh).toFixed(1);
      this.addRecommendation(
        'warning',
        `🌡️ Nhiệt độ cao: ${temperature}°C`,
        'warning',
        `Vượt ${excess}°C - Bật điều hòa hoặc mở cửa sổ`
      );
    } else if (temperature < this.thresholds.tempLow) {
      const deficit = (this.thresholds.tempLow - temperature).toFixed(1);
      this.addRecommendation(
        'warning',
        `🥶 Nhiệt độ thấp: ${temperature}°C`,
        'warning',
        `Kém ${deficit}°C - Bật sưởi hoặc đóng cửa sổ`
      );
    }
  }

  analyzeHumidity(humidity) {
    if (humidity === null || humidity === undefined) return;

    if (humidity > this.thresholds.humidityHigh) {
      const excess = (humidity - this.thresholds.humidityHigh).toFixed(1);
      this.addRecommendation(
        'critical',
        `💧 Độ ẩm cao: ${humidity}%`,
        'critical',
        `Vượt ${excess}% - Bật máy hút ẩm ngay`
      );
    } else if (humidity < this.thresholds.humidityLow) {
      const deficit = (this.thresholds.humidityLow - humidity).toFixed(1);
      this.addRecommendation(
        'warning',
        `🏜️ Độ ẩm thấp: ${humidity}%`,
        'warning',
        `Kém ${deficit}% - Bật máy tạo ẩm`
      );
    }
  }

  analyzeBattery(battery) {
    if (battery === null || battery === undefined) return;

    if (battery < this.thresholds.batteryLow) {
      this.addRecommendation(
        'critical',
        `🔋 Pin yếu: ${battery}%`,
        'critical',
        `Sạc pin ngay để tránh gián đoạn`
      );
    } else if (battery < 40) {
      this.addRecommendation(
        'warning',
        `⚡ Pin sắp hết: ${battery}%`,
        'warning',
        `Chuẩn bị sạc pin sớm`
      );
    }
  }

  analyzeComboFactors(data) {
    if (!data.temperature || !data.humidity) return;

    // High temp + High humidity (uncomfortable conditions)
    if (data.temperature > this.thresholds.tempHigh &&
        data.humidity > this.thresholds.humidityHigh) {
      this.addRecommendation(
        'critical',
        `🌡️💧 Nhiệt độ & ẩm cao`,
        'critical',
        `Bật điều hòa + máy hút ẩm cùng lúc`
      );
    }
    // Low temp + Low humidity (dry conditions)
    else if (data.temperature < this.thresholds.tempLow &&
        data.humidity < this.thresholds.humidityLow) {
      this.addRecommendation(
        'warning',
        `🥶🏜️ Lạnh & khô`,
        'warning',
        `Bật sưởi + máy tạo ẩm`
      );
    }
  }

  addRecommendation(level, title, severity = 'info', detail = '') {
    this.recommendations.push({
      level,
      title,
      severity,
      detail,
      timestamp: Date.now(),
      id: `rec-${Date.now()}-${Math.random()}`
    });

    // Giữ tối đa 2 thông báo - xóa thông báo cũ nhất nếu vượt quá
    const maxRecommendations = 2;
    if (this.recommendations.length > maxRecommendations) {
      // Xóa các thông báo cũ nhất (FIFO - First In, First Out)
      this.recommendations = this.recommendations.slice(-maxRecommendations);
    }
  }

  /**
   * Hiển thị các đề xuất lên DOM
   */
  render() {
    const container = document.getElementById('smartRecommendation');
    if (!container) return;

    container.innerHTML = '';

    // Hiển thị tất cả các thông báo (tối đa 4 do addRecommendation đã quản lý)
    const displayRecs = this.recommendations;

    if (displayRecs.length === 0) {
      const item = document.createElement('div');
      item.className = 'recommendation-item recommendation-neutral';
      item.innerHTML = `<span class="rec-icon">✨</span>
                        <div class="rec-content">
                          <span class="rec-text">Chất lượng không khí rất tốt</span>
                          <div class="rec-detail">Tất cả các thông số đều trong thang xanh. Tiếp tục duy trì môi trường sạch!</div>
                        </div>`;
      container.appendChild(item);
    } else {
      displayRecs.forEach(rec => {
        const item = document.createElement('div');
        item.className = `recommendation-item recommendation-${rec.severity}`;
        item.id = rec.id;

        const iconMap = {
          success: '✅',
          info: 'ℹ️',
          warning: '⚠️',
          critical: '🚨'
        };

        const icon = iconMap[rec.severity] || '📌';

        let html = `<span class="rec-icon">${icon}</span>
                    <div class="rec-content">
                      <span class="rec-text">${rec.title}</span>`;

        if (rec.detail) {
          html += `<div class="rec-detail">${rec.detail}</div>`;
        }

        html += '</div>';
        item.innerHTML = html;
        container.appendChild(item);
      });
    }

    this.updateTimestamp();
    this.renderActionButtons();
  }

  renderActionButtons() {
    const container = document.getElementById('actionButtonsContainer');
    if (!container) return;

    container.innerHTML = '';

    const actions = this.generateActions();
    actions.forEach((action, idx) => {
      const btn = document.createElement('button');
      btn.className = 'action-button';
      btn.innerHTML = `<span style="font-size: 18px;">${action.icon}</span><span>${action.label}</span>`;
      btn.dataset.actionId = action.id;
      btn.style.animation = `slideIn 0.3s ease-out ${idx * 0.05}s backwards`;
      btn.onclick = () => this.executeAction(action.id);
      container.appendChild(btn);
    });

    const applyBtn = document.getElementById('applyAllActionsBtn');
    if (applyBtn) {
      applyBtn.onclick = () => this.applyAllActions();
      applyBtn.disabled = actions.length === 0;
      applyBtn.style.opacity = actions.length === 0 ? '0.5' : '1';
    }
  }

  generateActions() {
    const actions = [];
    const data = this.getCurrentSensorData();

    if (!data) return [];

    if (data.temperature > this.thresholds.tempHigh) {
      actions.push({
        id: 'cool-down',
        icon: '❄️',
        label: 'Hạ nhiệt',
        action: () => this.simulateAction('Bật điều hòa ở 24°C')
      });
      actions.push({
        id: 'open-window',
        icon: '🪟',
        label: 'Mở cửa sổ',
        action: () => this.simulateAction('Mở cửa sổ để thông gió')
      });
    }

    if (data.humidity > this.thresholds.humidityHigh) {
      actions.push({
        id: 'dehumidify',
        icon: '💨',
        label: 'Mở máy hút ẩm',
        action: () => this.simulateAction('Bật máy hút ẩm')
      });
    }

    if (data.humidity < this.thresholds.humidityLow) {
      actions.push({
        id: 'humidify',
        icon: '💧',
        label: 'Tạo độ ẩm',
        action: () => this.simulateAction('Bật máy tạo độ ẩm')
      });
    }

    if (data.battery < this.thresholds.batteryLow) {
      actions.push({
        id: 'charge',
        icon: '🔌',
        label: 'Sạc pin',
        action: () => this.simulateAction('Sạc pin thiết bị')
      });
    }

    if (data.temperature < this.thresholds.tempLow) {
      actions.push({
        id: 'warm-up',
        icon: '🔥',
        label: 'Tăng nhiệt',
        action: () => this.simulateAction('Bật hệ thống sưởi')
      });
    }

    return actions;
  }

  executeAction(actionId) {
    const actions = this.generateActions();
    const action = actions.find(a => a.id === actionId);
    if (action) {
      action.action();
      this.showActionFeedback(actionId);
    }
  }

  applyAllActions() {
    const actions = this.generateActions();
    if (actions.length === 0) return;

    actions.forEach((action, idx) => {
      setTimeout(() => {
        action.action();
      }, idx * 300);
    });

    this.showBulkActionFeedback(actions.length);
  }

  simulateAction(message) {
    console.log('🎬 Hành động:', message);
    // Trong thực tế, điều này sẽ kết nối với các hệ thống điều khiển thực tế
  }

  showActionFeedback(actionId) {
    const btn = document.querySelector(`[data-action-id="${actionId}"]`);
    if (btn) {
      btn.classList.add('active');
      btn.style.animation = 'pulse 0.6s ease-out';
      setTimeout(() => {
        btn.classList.remove('active');
        btn.style.animation = '';
      }, 1800);
    }
  }

  showBulkActionFeedback(count) {
    const applyBtn = document.getElementById('applyAllActionsBtn');
    if (applyBtn) {
      const originalText = applyBtn.innerHTML;
      const originalClass = applyBtn.className;

      applyBtn.innerHTML = `✓ Đã áp dụng ${count} hành động!`;
      applyBtn.style.animation = 'pulse 0.6s ease-out';
      applyBtn.disabled = true;

      setTimeout(() => {
        applyBtn.innerHTML = originalText;
        applyBtn.className = originalClass;
        applyBtn.disabled = false;
        applyBtn.style.animation = '';
      }, 2200);
    }
  }

  updateTimestamp() {
    const el = document.getElementById('lastRecUpdate');
    if (!el) return;

    if (this.lastUpdate) {
      const diff = Date.now() - this.lastUpdate;
      let timeStr = 'Vừa xong';

      if (diff > 60000) {
        timeStr = `${Math.floor(diff / 60000)} phút trước`;
      } else if (diff > 1000) {
        timeStr = `${Math.floor(diff / 1000)} giây trước`;
      }

      el.textContent = `Cập nhật: ${timeStr}`;
    }
  }

  forceUpdate() {
    this.update().catch(e => console.warn('Lỗi forceUpdate:', e));
  }

  getRecommendations() {
    return [...this.recommendations];
  }

  setUpdateInterval(ms) {
    this.updateInterval = ms;
    this.startAutoUpdate();
  }

  updateThresholds(newThresholds) {
    this.thresholds = { ...this.thresholds, ...newThresholds };
    console.log('✅ Ngưỡng đã cập nhật:', this.thresholds);
    // Kích hoạt cập nhật không chặn
    this.forceUpdate();
  }
}

// Thực thể toàn cục
window.smartRecommendationEngine = null;

/**
 * Khởi động Trợ lý Điều khiển Nhanh
 */
function initSmartRecommendations() {
  if (!document.getElementById('smartRecommendation')) {
    console.warn('Không tìm thấy container Trợ lý Điều khiển Nhanh');
    return null;
  }

  window.smartRecommendationEngine = new SmartRecommendationEngine();

  // Cập nhật ban đầu
  window.smartRecommendationEngine.update();

  return window.smartRecommendationEngine;
}

/**
 * Cập nhật các đề xuất khi dữ liệu socket đến
 * Kiểm tra xem dữ liệu có thay đổi trước khi gọi update
 */
function onSensorDataUpdate(data) {
  if (window.smartRecommendationEngine) {
    const newData = {
      temperature: data.nhietDo,
      humidity: data.doAm,
      battery: data.pin,
      timestamp: Date.now()
    };

    // Chỉ gọi update nếu có thay đổi đáng kể
    if (window.smartRecommendationEngine.hasSignificantDataChange(newData)) {
      window.currentSensorData = newData;
      window.smartRecommendationEngine.update();
    }
  }
}

// Khởi tạo tự động khi DOM sẵn sàng
document.addEventListener('DOMContentLoaded', () => {
  initSmartRecommendations();
});

console.log('✅ smart-recommendations.js đã tải');
