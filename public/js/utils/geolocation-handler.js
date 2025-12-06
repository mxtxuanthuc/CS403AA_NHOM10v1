// --- XỬ LÝ ĐỊNH VỊ (GEOLOCATION HANDLER) ---
// Xử lý tất cả các nút "📍 Xác định vị trí hiện tại" trên hệ thống để đồng bộ chức năng.

class GeolocationHandler {
  constructor() {
    this.isSupported = !!navigator.geolocation;
    this.statusElements = {};
    this.inputFields = {
      lat: null,
      lon: null
    };
  }

  // Khởi tạo Geolocation handler (tìm và gắn listener cho tất cả các nút).
  init() {
    console.log("🔄 Đang khởi tạo GeolocationHandler...");
    
    // Tìm tất cả nút btnGeolocate
    const buttons = document.querySelectorAll('#btnGeolocate');
    console.log(`Đã tìm thấy ${buttons.length} nút định vị`);
    
    buttons.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        this.requestGeolocation();
      });
    });

    // Tìm các phần tử hiển thị trạng thái
    this.statusElements.geo = document.getElementById("geoStatus");
    
    // Tìm các input field cho lat/lon
    this.inputFields.lat = document.getElementById("weatherLat");
    this.inputFields.lon = document.getElementById("weatherLon");
    
    console.log("✅ GeolocationHandler đã khởi tạo");
  }

  // Yêu cầu định vị địa lý.
  async requestGeolocation() {
    try {
      console.log("🔄 Đang yêu cầu định vị...");
      
      // Hiển thị thông báo đang tải
      this.updateStatus("🔄 Đang xác định vị trí...", "info");

      // Kiểm tra hỗ trợ
      if (!this.isSupported) {
        this.handleError("Trình duyệt không hỗ trợ định vị");
        return;
      }

      // Yêu cầu vị trí hiện tại
      navigator.geolocation.getCurrentPosition(
        (position) => this.handleSuccess(position),
        (error) => this.handleError(error)
      );
    } catch (error) {
      console.error("Lỗi định vị:", error);
      this.updateStatus(`❌ Lỗi: ${error.message}`, "error");
      this.showToast(`❌ Lỗi: ${error.message}`, "error");
    }
  }

  // Xử lý khi định vị thành công.
  handleSuccess(position) {
    const lat = position.coords.latitude;
    const lon = position.coords.longitude;
    const accuracy = position.coords.accuracy;

    console.log(`✅ Định vị thành công: ${lat}, ${lon} (độ chính xác: ${accuracy}m)`);

    // Cập nhật input fields
    if (this.inputFields.lat) this.inputFields.lat.value = lat;
    if (this.inputFields.lon) this.inputFields.lon.value = lon;

    // Hiển thị thành công
    const successMsg = `✅ Vị trí: ${lat.toFixed(4)}, ${lon.toFixed(4)} (độ chính xác: ${accuracy.toFixed(0)}m)`;
    this.updateStatus(successMsg, "success");

    // Gọi hàm callback nếu có
    if (window.onGeolocationSuccess) {
      window.onGeolocationSuccess(lat, lon, accuracy);
    }
  }

  // Xử lý lỗi định vị.
  handleError(error) {
    let errorMsg = "❌ Không thể xác định vị trí";
    let errorCode = "UNKNOWN";

    if (typeof error === 'string') {
      errorMsg = `❌ ${error}`;
      errorCode = error;
    } else if (error.code) {
      errorCode = error.code;
      switch (error.code) {
        case 1:
          errorMsg = "❌ Bạn từ chối quyền định vị";
          break;
        case 2:
          errorMsg = "❌ Không thể lấy vị trí hiện tại";
          break;
        case 3:
          errorMsg = "❌ Yêu cầu định vị hết thời gian";
          break;
        default:
          errorMsg = `❌ ${error.message || 'Lỗi không xác định'}`;
      }
    }

    // Gỡ bỏ dòng console.error lặp lại
    console.error(`Lỗi định vị (${errorCode}):`, error); 
    this.updateStatus(errorMsg, "error");
    // Gọi hàm callback lỗi nếu có
    if (window.onGeolocationError) {
      window.onGeolocationError(errorCode, error);
    }
  }

  // Cập nhật phần tử hiển thị trạng thái.
  updateStatus(message, type = "info") {
    if (this.statusElements.geo) {
      this.statusElements.geo.textContent = message;
      this.statusElements.geo.className = `geo-status geo-status-${type}`;
    }
  }

  // Hiển thị toast notification.
  showToast(message, type = "info") {
    // Thử dùng window.showToast nếu có
    if (window.showToast) {
      window.showToast(message, type);
      return;
    }

    // Fallback: Tạo toast notification đơn giản
    this.createSimpleToast(message, type);
  }

  // Tạo toast notification đơn giản nếu không có hàm toàn cục.
  createSimpleToast(message, type = "info") {
    // Tạo toast container nếu chưa tồn tại
    let toastContainer = document.querySelector(".toast-container");
    if (!toastContainer) {
      toastContainer = document.createElement("div");
      toastContainer.className = "toast-container";
      document.body.appendChild(toastContainer);
    }

    // Tạo phần tử toast
    const toast = document.createElement("div");
    const typeClass = type === "success" ? "toast-success" : 
                      type === "error" ? "toast-critical" : 
                      type === "warning" ? "toast-warning" : "toast-info";
    
    toast.className = `toast ${typeClass}`;
    
    // Thêm icon dựa trên loại
    const iconMap = {
      success: "✅",
      error: "❌",
      warning: "⚠️",
      info: "ℹ️"
    };
    
    toast.textContent = `${iconMap[type] || ""} ${message}`;
    toastContainer.appendChild(toast);

    console.log(`[Toast ${type.toUpperCase()}] ${message}`);

    // Tự động xóa sau 3 giây
    setTimeout(() => {
      toast.classList.add("closing");
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }
}

// Khởi tạo toàn cục khi DOM sẵn sàng
document.addEventListener('DOMContentLoaded', () => {
  if (!window.geolocationHandler) {
    window.geolocationHandler = new GeolocationHandler();
    window.geolocationHandler.init();
  }
});

// Khởi tạo sau 1 giây để đảm bảo DOM fully loaded (Giữ lại logic cũ)
setTimeout(() => {
  // Chỉ khởi tạo nếu chưa được khởi tạo
  if (!window.geolocationHandler) { 
    window.geolocationHandler = new GeolocationHandler();
    window.geolocationHandler.init();
  }
}, 1000);

console.log("✅ geolocation-handler.js đã tải");