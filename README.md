Đồ án nhóm 10
# 📡 IoT-AI Monitoring Dashboard

## 🎯 Mô tả Dự án

**Framework** giám sát môi trường thông minh kết hợp **IoT**, **AI** và **xử lý ngôn ngữ tự nhiên**.

⚠️ **Lưu ý**: Hiện tại chỉ có **Simulator giả lập**, chưa có thiết bị thật. Hệ thống đã có đầy đủ API & Socket.IO sẵn sàng kết nối thiết bị thật hoặc OpenWeatherMap.

---

## ✨ Tính năng Chính

### Backend
- ✅ RESTful API + Socket.IO real-time
- ✅ Simulator giả lập dữ liệu IoT
- ✅ OpenWeatherMap API (dự báo, chất lượng không khí)
- ✅ Tích hợp AI: OpenAI, Google Gemini
- ✅ SQLite Database
- ✅ Phân tích thông minh & khuyến nghị tự động

### Frontend
- ✅ Dashboard hiện đại (responsive design)
- ✅ Biểu đồ real-time Chart.js
- ✅ Modal cấu hình API & thresholds
- ✅ Chat AI + STT/TTS (voice interaction)
- ✅ Thống kê & cảnh báo

---

## 🚀 Cài đặt & Chạy

### Yêu cầu
- Node.js >= 14.0.0
- npm >= 6.0.0
- Trình duyệt: Chrome, Edge, Safari

### Chạy
```bash
npm install
npm start                 # Server tại http://localhost:3000
node simulator.js         # Terminal khác - giả lập dữ liệu (optional)
```

---

## 📊 Chức Năng Chính

### Giám sát Real-time
- Biểu đồ nhiệt độ, độ ẩm (Socket.IO)
- Cảnh báo tự động khi vượt ngưỡng
- Lịch sử & thống kê

### Thời tiết & Không khí
- Dự báo 24h (OpenWeatherMap)
- Chất lượng không khí (AQI, PM2.5)
- Xác định vị trí GPS

### AI & Chat
- Chat với AI (Local, OpenAI, Gemini)
- Nhập giọng nói (STT)
- Đọc kết quả (TTS)
- Khuyến nghị tự động

### Cấu hình
- API key quản lý
- Ngưỡng cảnh báo tùy chỉnh
- Lưu trữ cấu hình

---

## 🔧 API Endpoints

```
Cấu hình:
  GET  /api/config               POST /api/config
  GET  /api/thresholds           POST /api/thresholds

Dữ liệu:
  GET  /api/data/latest          GET  /api/data/history
  DELETE /api/data/clear

Thời tiết:
  GET  /api/forecast             GET  /api/pollution

Chat & Phân tích:
  POST /api/chat                 POST /api/analyze
  GET  /api/suggestions

Thống kê:
  GET  /api/alerts/history       GET  /api/statistics
```

---

## 📁 Cấu trúc Thư mục

```
Project/
├── server.js                    # Express + Socket.IO server
├── simulator.js                 # Giả lập dữ liệu IoT (phát qua Socket.IO)
├── package.json                 # Dependencies
├── iot.db                        # SQLite database
│
├── config/                       # Cấu hình
│   ├── config.json              # API key, weather provider, coordinates
│   └── thresholds.json          # Ngưỡng cảnh báo (temp, humidity, battery)
│
├── src/
│   ├── db/
│   │   └── db.js                # SQLite operations (save/query data)
│   ├── services/
│   │   └── ai.js                # OpenAI, Google Gemini, Local AI
│   └── utils/
│       └── (utilities if any)
│
└── public/                       # Frontend
    ├── pages/
    │   ├── home.html            # Trang chủ (dashboard chính)
    │   ├── bang_dieu_khien.html # Dashboard giám sát
    │   ├── du_bao_thoi_tiet.html # Trang dự báo thời tiết
    │   └── chat_luong_khong_khi.html # Trang chất lượng không khí
    │
    ├── css/
    │   ├── styles.css           # Stylesheets chính
    │   └── extra.css            # CSS bổ sung
    │
    ├── js/
    │   ├── core/                # Các module cơ bản
    │   │   ├── common.js        # Hàm utils chung
    │   │   ├── config.js        # Quản lý cấu hình modal
    │   │   └── socket-handler.js # Socket.IO connection & events
    │   │
    │   ├── features/            # Tính năng chính
    │   │   ├── ai-integration.js # Tích hợp AI chat & analyze
    │   │   ├── alerts.js        # Hệ thống cảnh báo
    │   │   ├── alert-history.js # Lịch sử cảnh báo
    │   │   ├── chat.js          # Chat AI interface
    │   │   ├── forecast-chart.js # Biểu đồ dự báo
    │   │   ├── smart-recommendations.js # Gợi ý thông minh
    │   │   ├── stats.js         # Thống kê & tính toán
    │   │   └── threshold-alerts.js # Quản lý ngưỡng cảnh báo
    │   │
    │   ├── pages/               # Logic cho từng trang
    │   │   ├── home-page.js     # Trang chủ logic
    │   │   ├── main-page.js     # Dashboard chính logic
    │   │   ├── forecast.js      # Dự báo thời tiết logic
    │   │   └── pollution.js     # Chất lượng không khí logic
    │   │
    │   └── utils/               # Utilities & helpers
    │       ├── data-persistence.js # Lưu/tải dữ liệu localStorage
    │       ├── geolocation-handler.js # Xác định vị trí GPS
    │       ├── location-manager.js # Quản lý vị trí
    │       ├── page-loader.js   # Dynamic page loading
    │       ├── forecast-config.js # Cấu hình dự báo
    │       └── pollution-config.js # Cấu hình chất lượng không khí
    │
    └── images/                  # Hình ảnh & assets
```

---

## 🌡️ Giám sát Thô

### Simulator (Hiện tại)
- Dữ liệu giả lập: nhiệt độ 20-30°C, độ ẩm 40-80%, pin 30-100%
- Gửi qua Socket.IO mỗi 2 giây

### OpenWeatherMap (Đã tích hợp)
- API Key: `58cc27d06adce1e14eb79de7b17a7dc6`
- Vị trí: Latitude 14.058, Longitude 108.277 (Việt Nam)
- Dự báo 24h + AQI

### Để Kết nối Thiết bị Thật
1. **Arduino + Cảm biến** → Gửi qua Serial port
2. **API Thời tiết** → Thay thế simulator.js
3. **IoT Cloud** (Azure/AWS) → WebSocket tới server

---

## 🛠️ Công Nghệ

| Phần | Công Nghệ |
|-----|----------|
| Backend | Node.js, Express.js |
| Real-time | Socket.IO |
| Database | SQLite3 |
| Frontend | HTML5, CSS3, Vanilla JS |
| Charts | Chart.js |
| AI | OpenAI, Google Gemini |
| Voice | Web Speech API (STT/TTS) |
| Weather | OpenWeatherMap API |

---

## 🔐 Bảo Mật

⚠️ **API Key đã lộ trong config.json** - Tạo key mới:
1. https://openweathermap.org/api → Tạo API key mới
2. Cập nhật trong `config.json`
3. Thêm `config.json` vào `.gitignore`

---

## 🐛 Troubleshooting

### Port 3000 đang dùng
```powershell
Stop-Process -Name node -Force
```

### Không nhận dữ liệu từ simulator
```bash
node simulator.js
# Kiểm tra server port 3000
```

### Socket.IO không kết nối
- Kiểm tra cổng 3000
- Xem console browser (F12)
- Tắt/bật lại server

### STT/TTS không hoạt động
- Chỉ Chrome, Edge, Safari
- Cần HTTPS trên production

---

## 📝 Bước Tiếp Theo

- [ ] Thay thế simulator bằng thiết bị thật (Arduino/RPi)
- [ ] Hoặc tạo weather-connector kết nối OpenWeatherMap full
- [ ] Deploy lên production (Azure, AWS, Heroku)
- [ ] Thêm authentication & database
- [ ] Mobile app (React Native)

---

## 📞 Thông Tin

**Dự án**: IoT Monitoring Dashboard | **Nhóm**: 10 | **Năm**: 2025

---

**Happy Monitoring! 🚀**
