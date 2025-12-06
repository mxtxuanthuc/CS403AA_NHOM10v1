// --- XỬ LÝ BIỂU ĐỒ DỰ BÁO 24 GIỜ (NHIỆT ĐỘ) ---
// Xử lý dữ liệu lịch sử cảm biến, định dạng thời gian và trực quan hóa biểu đồ.

/**
 * Định dạng Timestamp sang Giờ (HH:00)
 * @param {number|Date} timestamp - Unix timestamp (miligiây)
 * @returns {string} Giờ định dạng "HH:00" (ví dụ: "14:00")
 */
function formatForecastTime(timestamp) {
  const date = new Date(timestamp);
  const hours = String(date.getHours()).padStart(2, '0');
  return `${hours}:00`;
}

/**
 * Cập nhật dữ liệu cho biểu đồ Dự báo 24 giờ
 * @param {Chart} chartInstance - Phiên bản Chart.js
 * @param {Array<Object>} forecastData - Mảng các đối tượng {time, nhietDo}
 * @returns {void}
 */
function updateForecastChart(chartInstance, forecastData) {
  if (!chartInstance || !Array.isArray(forecastData)) {
    console.warn('Dữ liệu hoặc biểu đồ không hợp lệ');
    return;
  }

  // Cảnh báo nếu thiếu điểm dữ liệu
  if (forecastData.length < 24) {
    console.warn(`⚠️ Chỉ có ${forecastData.length} điểm dữ liệu, cần 24.`);
  }

  // Sắp xếp theo thời gian tăng dần và giới hạn 24 điểm
  const sortedData = [...forecastData].sort((a, b) => a.time - b.time);

  // Trích xuất Nhãn (Thời gian)
  const labels = sortedData.slice(0, 24).map(point => {
    if (point.time) {
      const date = new Date(point.time);
      const hours = String(date.getHours()).padStart(2, '0');
      return `${hours}:00`;
    }
    return '--:--';
  });

  // Trích xuất Giá trị (Nhiệt độ)
  const values = sortedData.slice(0, 24).map(point => {
    const temp = point.nhietDo;
    const value = typeof temp === 'number' ? temp : parseFloat(temp) || 20;
    // Làm tròn đến 1 chữ số thập phân
    return Math.round(value * 10) / 10; 
  });

  // Cập nhật và vẽ lại biểu đồ (không hiệu ứng chuyển động)
  chartInstance.data.labels = labels;
  chartInstance.data.datasets[0].data = values;
  chartInstance.update('none'); 

  console.log(`📈 Biểu đồ dự báo đã cập nhật với ${values.length} điểm`);
}

/**
 * Khởi tạo biểu đồ dự báo Nhiệt độ (Line Chart) với hiệu ứng Gradient
 * @param {string} canvasId - ID của phần tử DOM
 * @param {string} label - Nhãn biểu đồ
 * @param {string} lineColor - Màu đường biểu đồ
 * @returns {Chart} Phiên bản Chart.js
 */
function createEnhancedForecastChart(canvasId, label = "Dự báo 24 giờ (°C)", lineColor = "#ffa502") {
  const canvas = document.getElementById(canvasId);
  if (!canvas) {
    console.error(`❌ Không tìm thấy phần tử Canvas: "${canvasId}"`);
    return null;
  }

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    console.error(`❌ Không lấy được context 2D từ canvas "${canvasId}"`);
    return null;
  }

  // Tạo hiệu ứng gradient cho nền
  const gradient = ctx.createLinearGradient(0, 0, 0, 400);
  gradient.addColorStop(0, lineColor + '30'); 
  gradient.addColorStop(1, lineColor + '05'); 

  return new Chart(canvas, {
    type: "line",
    data: {
      labels: [],
      datasets: [{
        label,
        data: [],
        borderWidth: 2.5,
        borderColor: lineColor,
        backgroundColor: gradient,
        fill: true,
        tension: 0.3,
        pointRadius: 5,
        pointBackgroundColor: lineColor,
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
        pointHoverRadius: 7,
        pointHoverBackgroundColor: lineColor,
        pointHoverBorderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        intersect: false,
        mode: 'index'
      },
      plugins: {
        legend: {
          display: true,
          labels: {
            font: { size: 12, weight: 'bold' },
            color: '#333',
            padding: 12,
            usePointStyle: true
          }
        },
        tooltip: {
          enabled: true,
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          titleColor: '#fff',
          bodyColor: '#fff',
          borderColor: lineColor,
          borderWidth: 1,
          padding: 10,
          titleFont: { size: 12, weight: 'bold' },
          bodyFont: { size: 11 },
          displayColors: true,
          callbacks: {
            title: (context) => {
              if (context && context[0]) {
                return `Giờ: ${context[0].label}`;
              }
              return '';
            },
            label: (context) => {
              return `Nhiệt độ: ${context.parsed.y.toFixed(1)}°C`;
            },
            afterLabel: (context) => {
              // Hiển thị xu hướng nhiệt độ
              const dataIndex = context.dataIndex;
              const data = context.chart.data.datasets[0].data;
              if (dataIndex > 0 && dataIndex < data.length - 1) {
                const current = data[dataIndex];
                const next = data[dataIndex + 1];
                const trend = next > current ? '📈 tăng' : next < current ? '📉 giảm' : '➡️ ổn định';
                return `Xu hướng: ${trend}`;
              }
              return '';
            }
          }
        }
      },
      scales: {
        y: {
          beginAtZero: false,
          ticks: {
            callback: (value) => `${value.toFixed(1)}°C`,
            font: { size: 11 },
            color: '#666'
          },
          title: {
            display: true,
            text: 'Nhiệt độ (°C)',
            font: { size: 12, weight: 'bold' }
          },
          grid: {
            color: 'rgba(0, 0, 0, 0.05)',
            drawBorder: true
          }
        },
        x: {
          ticks: {
            font: { size: 10 },
            color: '#666',
            maxRotation: 45,
            minRotation: 0,
            // Đảm bảo hiển thị đủ 24 điểm giờ
            maxTicksLimit: 24 
          },
          title: {
            display: true,
            text: 'Giờ (24h)',
            font: { size: 12, weight: 'bold' }
          },
          grid: {
            color: 'rgba(0, 0, 0, 0.05)',
            drawBorder: true
          }
        }
      }
    }
  });
}

/**
 * Chuẩn bị dữ liệu dự báo 24 giờ từ Lịch sử Cảm biến.
 * Đảm bảo tạo ra chính xác 24 điểm dữ liệu theo giờ.
 * @param {Array} historyData - Dữ liệu lịch sử cảm biến thô
 * @returns {Array<Object>} Dữ liệu dự báo với format {time, nhietDo}
 */
function prepare24hForecastData(historyData) {
  if (!Array.isArray(historyData)) {
    historyData = [];
  }

  // Tạo 24 khung giờ trống (từ 23h trước đến hiện tại)
  const now = new Date();
  const forecast24h = [];

  for (let i = 23; i >= 0; i--) {
    const hourTime = new Date(now);
    hourTime.setHours(hourTime.getHours() - i);
    hourTime.setMinutes(0);
    hourTime.setSeconds(0);
    hourTime.setMilliseconds(0);

    forecast24h.push({
      time: hourTime.getTime(),
      hour: hourTime.getHours(),
      date: hourTime.toISOString().split('T')[0],
      nhietDo: null 
    });
  }

  // Nếu có dữ liệu lịch sử, tính trung bình theo giờ và điền vào
  if (historyData.length > 0) {
    const hourlyAvg = {};

    historyData.forEach(record => {
      try {
        const recordDate = new Date(record.thoigian);
        // Tạo khóa dựa trên ngày và giờ (để phân biệt giữa các ngày)
        const hourKey = `${recordDate.toISOString().split('T')[0]} ${recordDate.getHours().toString().padStart(2, '0')}:00`; 

        if (!hourlyAvg[hourKey]) {
          hourlyAvg[hourKey] = {
            temps: [],
            time: recordDate.getTime()
          };
        }

        const temp = parseFloat(record.nhietDo);
        if (!isNaN(temp)) {
          hourlyAvg[hourKey].temps.push(temp);
        }
      } catch (e) {
        console.warn('Lỗi xử lý bản ghi lịch sử:', record);
      }
    });

    // Điền dữ liệu trung bình vào khung giờ dự báo
    forecast24h.forEach(point => {
      const pointDate = new Date(point.time);
      const hourKey = `${point.date} ${point.hour.toString().padStart(2, '0')}:00`;

      if (hourlyAvg[hourKey]) {
        const temps = hourlyAvg[hourKey].temps;
        if (temps.length > 0) {
          const avgTemp = temps.reduce((a, b) => a + b, 0) / temps.length;
          point.nhietDo = parseFloat(avgTemp.toFixed(1));
        }
      }
    });
  }

  // Nội suy (Interpolation) hoặc dùng giá trị mặc định cho các giờ thiếu dữ liệu (null)
  let lastValidTemp = null;
  let nextValidTemp = null;

  for (let i = 0; i < forecast24h.length; i++) {
    if (forecast24h[i].nhietDo !== null) {
      lastValidTemp = forecast24h[i].nhietDo;
    } else {
      // Tìm giá trị hợp lệ tiếp theo
      nextValidTemp = null;
      for (let j = i + 1; j < forecast24h.length; j++) {
        if (forecast24h[j].nhietDo !== null) {
          nextValidTemp = forecast24h[j].nhietDo;
          break;
        }
      }

      // Nội suy tuyến tính hoặc dùng giá trị hợp lệ gần nhất
      if (lastValidTemp !== null) {
        if (nextValidTemp !== null) {
          const range = nextValidTemp - lastValidTemp;
          // Tìm khoảng cách giữa điểm hiện tại và điểm hợp lệ trước đó
          const steps = i - forecast24h.findIndex((p, idx) => idx < i && p.nhietDo !== null); 
          forecast24h[i].nhietDo = parseFloat((lastValidTemp + (range / (steps + 1))).toFixed(1));
        } else {
          // Dùng giá trị cuối cùng nếu không tìm thấy giá trị hợp lệ nào sau đó
          forecast24h[i].nhietDo = lastValidTemp; 
        }
      } else if (nextValidTemp !== null) {
        // Dùng giá trị đầu tiên hợp lệ nếu các điểm đầu bị thiếu
        forecast24h[i].nhietDo = nextValidTemp; 
      } else {
        // Giá trị mặc định cuối cùng
        forecast24h[i].nhietDo = 25; 
      }
    }
  }

  console.log(`📊 Đã tạo dữ liệu dự báo 24 giờ với ${forecast24h.length} điểm`);
  return forecast24h;
}

/**
 * Gọi API lấy dữ liệu lịch sử (24h) và cập nhật biểu đồ
 * @param {Chart} chartInstance - Phiên bản Chart.js cần cập nhật
 * @param {Function} errorCallback - Callback xử lý lỗi (tùy chọn)
 * @returns {Promise<Array>} Mảng các điểm dự báo
 */
async function loadForecastData(chartInstance, errorCallback = null) {
  try {
    console.log('📥 Đang gọi API lấy dữ liệu dự báo 24 giờ...');

    // Lấy lịch sử cảm biến 24 giờ
    const response = await fetch('/api/data/history');
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    let historyData = await response.json();

    // Xử lý các định dạng response khác nhau
    if (historyData.data && Array.isArray(historyData.data)) {
      historyData = historyData.data;
    } else if (!Array.isArray(historyData)) {
      historyData = [];
    }

    console.log(`📊 Đã nhận được ${historyData.length} bản ghi lịch sử từ server`);

    // Chuẩn bị dữ liệu (tạo ra chính xác 24 điểm)
    const forecastPoints = prepare24hForecastData(historyData);

    if (forecastPoints.length === 0) {
      console.warn('⚠️ Không có dữ liệu dự báo khả dụng');
      return [];
    }

    // Kiểm tra tính đầy đủ
    if (forecastPoints.length !== 24) {
      console.warn(`⚠️ Dự kiến 24 điểm, nhưng chỉ nhận được ${forecastPoints.length}`);
    } else {
      console.log('✅ Đã tạo đủ dữ liệu dự báo 24 giờ (24 điểm)');
    }

    // Cập nhật biểu đồ
    if (chartInstance) {
      updateForecastChart(chartInstance, forecastPoints);
    }

    return forecastPoints;
  } catch (error) {
    console.error('❌ Lỗi khi tải dữ liệu dự báo:', error);
    if (errorCallback) {
      errorCallback(error);
    }
    return [];
  }
}

/**
 * Khởi tạo biểu đồ dự báo, tải dữ liệu ban đầu và thiết lập Socket.io
 * @param {string} canvasId - ID phần tử DOM cho biểu đồ (mặc định 'bieuDoDuBaoNhietDo')
 * @param {Object} socketInstance - Phiên bản Socket.io (tùy chọn)
 * @returns {Chart} Phiên bản Chart.js
 */
function initializeForecastChart(canvasId = 'bieuDoDuBaoNhietDo', socketInstance = null) {
  // Tạo biểu đồ
  const chart = createEnhancedForecastChart(canvasId, 'Dự báo nhiệt độ 24 giờ (°C)', '#ffa502');

  if (!chart) {
    console.error(`❌ Khởi tạo biểu đồ dự báo thất bại: ${canvasId}`);
    return null;
  }

  // Tải dữ liệu ban đầu
  loadForecastData(chart).catch(err => console.error('Tải dữ liệu ban đầu thất bại:', err));

  // Thiết lập cập nhật theo thời gian thực qua Socket.io
  if (socketInstance && typeof socketInstance.on === 'function') {
    // Nghe sự kiện cập nhật cảm biến (dữ liệu mới) -> Tải lại dự báo
    socketInstance.on('capNhat', async (data) => {
      if (data && data.dulieu) {
        console.log('📡 Nhận dữ liệu cảm biến mới, làm mới biểu đồ dự báo...');
        await loadForecastData(chart).catch(err => console.warn('Làm mới dự báo thất bại:', err));
      }
    });

    // Nghe yêu cầu làm mới dự báo rõ ràng từ server
    socketInstance.on('refreshForecast', async () => {
      console.log('🔄 Đang làm mới dữ liệu dự báo...');
      await loadForecastData(chart);
    });

    // Nghe cập nhật thống kê (cho mục đích hiển thị trực tiếp)
    socketInstance.on('statsUpdate', (statsData) => {
      if (statsData.data && Array.isArray(statsData.data)) {
        console.log('📊 Nhận cập nhật Stats, cập nhật biểu đồ...');
        updateForecastChart(chart, statsData.data);
      }
    });
  }

  // Tự động làm mới mỗi 1 giờ để đảm bảo dữ liệu luôn mới
  setInterval(async () => {
    console.log('⏰ Kích hoạt làm mới dự báo tự động hàng giờ');
    try {
      await loadForecastData(chart);
    } catch (err) {
      console.warn('⚠️ Làm mới hàng giờ thất bại:', err.message);
    }
  }, 60 * 60 * 1000); // 1 giờ

  // Lưu tham chiếu toàn cục
  window.bieuDoDuBaoEnhanced = chart;
  window.bieuDoDuBaoNhietDo = chart;

  console.log('🌡️ Biểu đồ dự báo 24 giờ đã khởi tạo thành công');
  return chart;
}

/**
 * Làm mới dữ liệu dự báo thủ công (có thể gọi từ nút UI)
 * @returns {Promise<void>}
 */
async function refreshForecastData() {
  try {
    const chart = window.bieuDoDuBaoEnhanced || window.bieuDoDuBao;
    if (!chart) {
      console.warn('Biểu đồ dự báo chưa được khởi tạo');
      return;
    }
    await loadForecastData(chart);
    console.log('Dữ liệu dự báo đã được làm mới thủ công');
  } catch (error) {
    console.error('Làm mới dự báo thủ công thất bại:', error);
  }
}

/**
 * Lấy thống kê tóm tắt dự báo
 * @returns {Object} Thống kê với min, max, avg nhiệt độ
 */
function getForecastStats() {
  const chart = window.bieuDoDuBaoEnhanced || window.bieuDoDuBao;
  if (!chart || !chart.data.datasets[0].data.length) {
    return { min: null, max: null, avg: null, count: 0 };
  }

  const temps = chart.data.datasets[0].data;
  const validTemps = temps.filter(t => typeof t === 'number' && !isNaN(t));

  if (validTemps.length === 0) {
    return { min: null, max: null, avg: null, count: 0 };
  }

  const min = Math.min(...validTemps);
  const max = Math.max(...validTemps);
  const avg = (validTemps.reduce((a, b) => a + b, 0) / validTemps.length).toFixed(1);

  return {
    min: min.toFixed(1),
    max: max.toFixed(1),
    avg: avg,
    count: validTemps.length
  };
}

/**
 * Hiển thị thống kê dự báo trong console
 * @returns {void}
 */
function logForecastStats() {
  const stats = getForecastStats();
  console.log(`
🌡️ THỐNG KÊ DỰ BÁO (24h):
  ├─ Số điểm dữ liệu: ${stats.count}/24
  ├─ Nhiệt độ Thấp nhất: ${stats.min}°C
  ├─ Nhiệt độ Cao nhất: ${stats.max}°C
  └─ Nhiệt độ Trung bình: ${stats.avg}°C
  `);
}

console.log("✅ forecast-chart.js loaded");