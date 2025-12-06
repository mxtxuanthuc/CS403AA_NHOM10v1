// --- QUẢN LÝ DỮ LIỆU VÀ PHỤC HỒI (DATA PERSISTENCE & RECOVERY) ---
// Xử lý lưu trữ dữ liệu cục bộ bằng LocalStorage (cache nhanh) và IndexedDB (dữ liệu lịch sử offline).

const DataPersistence = {
  // Các khóa LocalStorage
  CACHE_KEYS: {
    LAST_STATS: 'iot_stats_cache',
    LAST_UPDATE: 'iot_stats_timestamp',
    CURRENT_SENSOR: 'iot_current_sensor',
    ALERT_HISTORY: 'iot_alert_history',
    STATS_24H: 'iot_stats_24h_data'
  },

  // ===== THAO TÁC LOCALSTORAGE =====

  // Lưu cache dữ liệu thống kê cục bộ.
  // @param {Object} stats - Đối tượng Thống kê từ server
  // @param {Object} chartData - Mảng dữ liệu biểu đồ
  cacheStatsData: function(stats, chartData = []) {
    try {
      const cacheData = {
        stats: stats,
        chartData: chartData,
        timestamp: Date.now(),
        cachedAt: new Date().toLocaleTimeString('vi-VN')
      };

      localStorage.setItem(this.CACHE_KEYS.LAST_STATS, JSON.stringify(cacheData));
      localStorage.setItem(this.CACHE_KEYS.LAST_UPDATE, Date.now().toString());

      console.log('💾 Stats đã lưu cache vào localStorage:', {
        records: stats?.tongGhiNhan,
        alerts: stats?.tongCanhBao,
        cachedAt: cacheData.cachedAt
      });

      return true;
    } catch (e) {
      console.warn('⚠️ Lỗi lưu cache stats:', e.message);
      return false;
    }
  },

  // Lấy dữ liệu thống kê đã cache từ localStorage.
  // @returns {Object|null} Dữ liệu cache hoặc null
  getCachedStats: function() {
    try {
      const cached = localStorage.getItem(this.CACHE_KEYS.LAST_STATS);
      if (!cached) return null;

      const data = JSON.parse(cached);
      const age = Date.now() - data.timestamp;

      console.log('📂 Đã khôi phục từ cache:', {
        records: data.stats?.tongGhiNhan,
        alerts: data.stats?.tongCanhBao,
        age: `${Math.floor(age / 1000)}s trước`,
        cachedAt: data.cachedAt
      });

      return data;
    } catch (e) {
      console.warn('⚠️ Lỗi đọc cache stats:', e.message);
      return null;
    }
  },

  // Lưu cache dữ liệu cảm biến hiện tại.
  // @param {Object} sensorData - Bản ghi cảm biến mới nhất
  cacheSensorData: function(sensorData) {
    try {
      localStorage.setItem(this.CACHE_KEYS.CURRENT_SENSOR, JSON.stringify({
        data: sensorData,
        timestamp: Date.now()
      }));
    } catch (e) {
      console.warn('⚠️ Lỗi lưu cache dữ liệu cảm biến:', e.message);
    }
  },

  // Lấy dữ liệu cảm biến đã cache gần nhất.
  // @returns {Object|null}
  getCachedSensorData: function() {
    try {
      const cached = localStorage.getItem(this.CACHE_KEYS.CURRENT_SENSOR);
      return cached ? JSON.parse(cached).data : null;
    } catch (e) {
      return null;
    }
  },

  // Lưu cache lịch sử cảnh báo.
  // @param {Array} alerts - Mảng các đối tượng cảnh báo
  cacheAlertHistory: function(alerts) {
    try {
      localStorage.setItem(this.CACHE_KEYS.ALERT_HISTORY, JSON.stringify({
        alerts: alerts,
        timestamp: Date.now()
      }));
    } catch (e) {
      console.warn('⚠️ Lỗi lưu cache cảnh báo:', e.message);
    }
  },

  // Lấy lịch sử cảnh báo đã cache.
  // @returns {Array}
  getCachedAlertHistory: function() {
    try {
      const cached = localStorage.getItem(this.CACHE_KEYS.ALERT_HISTORY);
      return cached ? JSON.parse(cached).alerts : [];
    } catch (e) {
      return [];
    }
  },

  // Xóa tất cả dữ liệu đã cache.
  clearCache: function() {
    try {
      Object.values(this.CACHE_KEYS).forEach(key => {
        localStorage.removeItem(key);
      });
      console.log('✅ Đã xóa toàn bộ cache');
      return true;
    } catch (e) {
      console.warn('⚠️ Lỗi xóa cache:', e.message);
      return false;
    }
  },

  // ===== KHÔI PHỤC DỮ LIỆU KHI TẢI TRANG =====

  // Khôi phục thống kê từ cache khi tải trang.
  // @returns {Object|null}
  restoreStatsOnLoad: function() {
    try {
      const cached = this.getCachedStats();
      if (!cached) return null;

      console.log('♻️ Đã khôi phục thống kê từ cache');
      return cached;
    } catch (e) {
      console.warn('⚠️ Lỗi khôi phục stats:', e.message);
      return null;
    }
  },

  // Khôi phục hiển thị cảm biến hiện tại từ cache.
  // @returns {Object|null}
  restoreSensorOnLoad: function() {
    try {
      const cached = this.getCachedSensorData();
      if (!cached) return null;

      console.log('♻️ Đã khôi phục dữ liệu cảm biến từ cache:', {
        temp: cached.nhietDo,
        humidity: cached.doAm,
        battery: cached.pin
      });
      return cached;
    } catch (e) {
      return null;
    }
  },

  // Khôi phục cảnh báo từ cache.
  // @returns {Array}
  restoreAlertsOnLoad: function() {
    try {
      const alerts = this.getCachedAlertHistory();
      if (alerts.length > 0) {
        console.log(`♻️ Đã khôi phục ${alerts.length} cảnh báo từ cache`);
      }
      return alerts;
    } catch (e) {
      return [];
    }
  },

  // ===== INDEXEDDB CHO TẬP DỮ LIỆU LỚN =====

  // Khởi tạo IndexedDB cho dữ liệu lịch sử 24h.
  initIndexedDB: async function() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('IotDatabase', 1);

      request.onerror = () => {
        console.warn('⚠️ Lỗi mở IndexedDB:', request.error);
        reject(request.error);
      };

      // Xử lý nâng cấp/tạo store
      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        if (!db.objectStoreNames.contains('sensorData')) {
          const store = db.createObjectStore('sensorData', { keyPath: 'id', autoIncrement: true });
          // Tạo index cho truy vấn theo thời gian
          store.createIndex('timestamp', 'thoigian', { unique: false }); 
          console.log('📦 IndexedDB store đã tạo: sensorData');
        }

        if (!db.objectStoreNames.contains('alerts')) {
          const alertStore = db.createObjectStore('alerts', { keyPath: 'id', autoIncrement: true });
          // Tạo index cho truy vấn theo thời gian
          alertStore.createIndex('timestamp', 'thoigian', { unique: false }); 
          console.log('📦 IndexedDB store đã tạo: alerts');
        }
      };

      request.onsuccess = () => {
        console.log('✅ IndexedDB đã khởi tạo');
        resolve(request.result);
      };
    });
  },

  // Lưu dữ liệu cảm biến vào IndexedDB.
  // @param {Object} sensorData
  saveSensorToIndexedDB: async function(sensorData) {
    try {
      const db = await this.initIndexedDB();
      const transaction = db.transaction(['sensorData'], 'readwrite');
      const store = transaction.objectStore('sensorData');

      // Giới hạn chỉ giữ lại 288 bản ghi cuối (24h)
      const countRequest = store.count();
      countRequest.onsuccess = () => {
        if (countRequest.result > 288) {
          // Xóa các bản ghi cũ nhất (cách đây hơn 24h)
          const index = store.index('timestamp');
          const range = IDBKeyRange.upperBound(Date.now() - 86400000); // 24h = 86400000ms
          index.openCursor(range).onsuccess = (event) => {
            const cursor = event.target.result;
            if (cursor) {
              store.delete(cursor.primaryKey);
              cursor.continue();
            }
          };
        }
      };

      // Thêm bản ghi mới
      store.add(sensorData); 
    } catch (e) {
      console.warn('⚠️ Lỗi lưu vào IndexedDB:', e.message);
    }
  },

  // Lấy tất cả dữ liệu cảm biến từ IndexedDB.
  // @returns {Promise<Array>}
  getSensorDataFromIndexedDB: async function() {
    try {
      const db = await this.initIndexedDB();
      const transaction = db.transaction(['sensorData'], 'readonly');
      const store = transaction.objectStore('sensorData');

      return new Promise((resolve, reject) => {
        const request = store.getAll();
        request.onsuccess = () => {
          resolve(request.result);
        };
        request.onerror = () => {
          reject(request.error);
        };
      });
    } catch (e) {
      console.warn('⚠️ Lỗi đọc từ IndexedDB:', e.message);
      return [];
    }
  },

  // ===== KIỂM TRA TRẠNG THÁI LƯU TRỮ =====

  // Lấy trạng thái lưu trữ (LocalStorage và IndexedDB).
  // @returns {Object}
  getStorageStatus: function() {
    const status = {
      localStorage: {
        available: !!localStorage,
        quota: localStorage ? 'unlimited' : 'N/A', // Thực tế là bị giới hạn
        used: JSON.stringify(localStorage).length || 0,
        items: localStorage ? localStorage.length : 0
      },
      indexedDB: {
        available: !!window.indexedDB,
        estimate: 'pending'
      }
    };

    // Kiểm tra dung lượng IndexedDB
    if (navigator.storage && navigator.storage.estimate) {
      navigator.storage.estimate().then(estimate => {
        status.indexedDB.usage = estimate.usage;
        status.indexedDB.quota = estimate.quota;
        console.log('💾 Trạng thái lưu trữ:', status);
      });
    }

    return status;
  },

  // Lấy thông tin chi tiết về cache.
  // @returns {Object}
  getCacheInfo: function() {
    return {
      lastStats: this.getCachedStats(),
      currentSensor: this.getCachedSensorData(),
      alertHistory: this.getCachedAlertHistory(),
      storageStatus: this.getStorageStatus()
    };
  }
};

// ===== Export =====
if (typeof module !== 'undefined' && module.exports) {
  module.exports = DataPersistence;
}