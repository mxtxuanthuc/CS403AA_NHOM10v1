// --- QUẢN LÝ VỊ TRÍ (LOCATION MANAGER) ---
// Quản lý vị trí cố định từ cấu hình và vị trí người dùng (Geolocation API) cho ứng dụng.

class LocationManager {
  constructor() {
    this.config = null;
    this.userLocation = null;
    this.locationType = 'fixed'; // 'fixed' hoặc 'user'
  }

  // Tải config từ server
  async loadConfig() {
    try {
      const response = await fetch('/api/config');
      if (response.ok) {
        this.config = await response.json();
        console.log('✅ Cấu hình đã tải:', this.config);
        return this.config;
      }
    } catch (error) {
      console.warn('⚠️ Lỗi tải cấu hình:', error);
    }
    return null;
  }

  // Lấy vị trí của người dùng qua Geolocation API.
  // @returns {Promise<object>}
  getUserLocation() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        return reject(new Error('Trình duyệt không hỗ trợ Geolocation.'));
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          this.userLocation = {
            city: `Vị trí của bạn`,
            lat: latitude,
            lon: longitude,
            display: `📍 Vị trí của bạn`
          };
          console.log('✅ Vị trí người dùng đã nhận:', this.userLocation);
          resolve(this.userLocation);
        },
        (error) => {
          console.error('❌ Lỗi Geolocation:', error);
          let message = 'Lỗi khi lấy vị trí.';
          switch (error.code) {
            case error.PERMISSION_DENIED:
              message = 'Bạn đã từ chối quyền truy cập vị trí.';
              break;
            case error.POSITION_UNAVAILABLE:
              message = 'Không thể xác định vị trí.';
              break;
            case error.TIMEOUT:
              message = 'Yêu cầu vị trí đã hết hạn.';
              break;
          }
          reject(new Error(message));
        }
      );
    });
  }

  // Chuyển đổi loại vị trí (cố định hoặc người dùng) và cập nhật thời tiết.
  // @param {'fixed' | 'user'} type
  async setLocationType(type) {
    if (type === 'user') {
      try {
        await this.getUserLocation();
        this.locationType = 'user';
      } catch (error) {
        console.warn('⚠️ Không thể lấy vị trí người dùng, chuyển sang cố định.', error.message);
        this.locationType = 'fixed'; // Fallback về vị trí cố định
      }
    } else {
      this.locationType = 'fixed';
    }
    this.updateLocationDisplay();
    const location = this.getCoordinates();
    if (location.lat && location.lon) {
      await this.updateWeatherAndNotify(location.lat, location.lon);
    }
  }

  // Lấy vị trí hiện tại (cố định hoặc của người dùng).
  getLocation() {
    if (this.locationType === 'user' && this.userLocation) {
      return this.userLocation;
    }

    if (!this.config) {
      return {
        city: 'Chưa cấu hình',
        lat: null,
        lon: null,
        display: '📍 Vị trí: Chưa cấu hình'
      };
    }

    // Lấy vị trí cố định từ config (mặc định Hà Nội)
    const lat = this.config.weatherLat || 21.0285;
    const lon = this.config.weatherLon || 105.8542;
    const city = this.config.weatherCity || `Lat: ${lat.toFixed(4)}, Lon: ${lon.toFixed(4)}`;

    return {
      city: city,
      lat: lat,
      lon: lon,
      display: `📍 ${city}`
    };
  }

  // Cập nhật vị trí trên header.
  updateLocationDisplay() {
    const location = this.getLocation();

    const tsLocation = document.getElementById('tsLocation');
    if (tsLocation) {
      tsLocation.textContent = location.display;
    }

    console.log('✅ Hiển thị vị trí đã cập nhật:', location);
    return location;
  }

  // Cập nhật thông tin thời tiết dựa trên tọa độ và thông báo cho hệ thống.
  // @param {number} lat
  // @param {number} lon
  async updateWeatherAndNotify(lat, lon) {
    if (!this.config || !this.config.weatherApiKey || !lat || !lon) {
      console.warn('⚠️ Thiếu API key hoặc tọa độ để lấy thời tiết.');
      return;
    }

    const apiKey = this.config.weatherApiKey;
    const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric&lang=vi`;

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Lỗi API thời tiết: ${response.statusText}`);
      }
      const data = await response.json();
      console.log('✅ Dữ liệu thời tiết:', data);

      // Cập nhật UI
      const tsNhietDo = document.getElementById('tsNhietDo');
      const tsDoAm = document.getElementById('tsDoAm');
      if (tsNhietDo) {
        tsNhietDo.textContent = `🌡 Nhiệt độ: ${data.main.temp.toFixed(1)}°C`;
      }
      if (tsDoAm) {
        tsDoAm.textContent = `💧 Độ ẩm: ${data.main.humidity}%`;
      }

      // Gửi dữ liệu thời tiết mới lên server để broadcast
      if (typeof socket !== 'undefined' && socket.connected) {
        const weatherUpdate = {
          temperature: data.main.temp,
          humidity: data.main.humidity,
          source: 'weather_api'
        };
        socket.emit('weather_update', weatherUpdate);
        console.log('📤 Đã gửi cập nhật thời tiết đến server:', weatherUpdate);
      }

      // Lưu vị trí mới vào config trên server
      await this.saveLocationToConfig(lat, lon);

    } catch (error) {
      console.error('❌ Lỗi khi lấy dữ liệu thời tiết:', error);
    }
  }

  // Lưu vị trí mới vào file config trên server.
  // @param {number} lat
  // @param {number} lon
  async saveLocationToConfig(lat, lon) {
    try {
      // Chỉ lưu lat, lon
      const payload = {
        weatherLat: lat,
        weatherLon: lon,
      };

      const res = await fetch("/api/config/location", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const result = await res.json();
      if (result.success) {
        console.log('✅ Đã lưu vị trí mới vào config trên server.');
      } else {
        console.error('❌ Lỗi lưu vị trí:', result.message);
      }
    } catch (error) {
      console.error('❌ Lỗi khi gửi yêu cầu lưu vị trí:', error);
    }
  }

  // Lấy vị trí từ AI và cập nhật.
  // @param {string} locationName
  async getLocationFromAI(locationName) {
    if (!locationName) {
      console.warn('⚠️ Tên địa điểm không được để trống.');
      return;
    }

    try {
      const res = await fetch("/api/ai/locate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locationName })
      });

      const result = await res.json();
      if (result.success) {
        console.log('✅ AI đã tìm thấy vị trí:', result);
        this.userLocation = {
          city: locationName,
          lat: result.lat,
          lon: result.lon,
          display: `📍 ${locationName}`
        };
        this.locationType = 'user'; // Coi vị trí AI như vị trí người dùng
        this.updateLocationDisplay();
        await this.updateWeatherAndNotify(result.lat, result.lon);
      } else {
        console.error('❌ Lỗi khi lấy vị trí từ AI:', result.message);
        alert(`Lỗi: ${result.message}`);
      }
    } catch (error) {
      console.error('❌ Lỗi khi gửi yêu cầu đến AI:', error);
      alert('Không thể kết nối đến dịch vụ AI.');
    }
  }

  // Khởi tạo location manager.
  async initialize() {
    console.log('🌍 Đang khởi tạo LocationManager...');
    await this.loadConfig();
    await this.setLocationType('user'); // Mặc định thử lấy vị trí người dùng
    console.log('✅ LocationManager đã khởi tạo');
  }

  // Lấy tọa độ.
  getCoordinates() {
    const location = this.getLocation();
    return {
      lat: location.lat,
      lon: location.lon
    };
  }

  // Lấy API key của Google Maps.
  getGoogleMapsApiKey() {
    if (!this.config) {
      console.warn('⚠️ Cấu hình chưa được tải');
      return null;
    }
    return this.config.googleMapsApiKey;
  }
}

// Thực thể toàn cục
window.locationManager = null;

// Khởi tạo LocationManager.
function initLocationManager() {
  if (!window.locationManager) {
    window.locationManager = new LocationManager();
    window.locationManager.initialize().catch(e => {
      console.error('❌ Lỗi khởi tạo LocationManager:', e);
    });
  }
  return window.locationManager;
}

// Khởi tạo khi DOM sẵn sàng
document.addEventListener('DOMContentLoaded', () => {
  initLocationManager();
});

// Cập nhật vị trí và thời tiết theo yêu cầu.
// @param {'user' | 'fixed'} [type='user']
window.updateLocationAndWeather = async (type = 'user') => {
  if (window.locationManager) {
    await window.locationManager.setLocationType(type);
  }
};

// Cập nhật vị trí bằng cách hỏi AI.
window.updateLocationFromAI = async () => {
  const locationName = prompt("Nhập tên địa điểm bạn muốn tìm (ví dụ: 'Hanoi', 'New York'):");
  if (locationName && window.locationManager) {
    await window.locationManager.getLocationFromAI(locationName);
  }
};

console.log('✅ location-manager.js đã tải');