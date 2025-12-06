// Tạo biểu đồ

function taoBieuDo(id, label, color = "blue") {
  try {
    const canvasEl = document.getElementById(id);
    if (!canvasEl) return null;

    const chart = new Chart(canvasEl, {
      type: "line",
      data: {
        labels: [],
        datasets: [{
          label,
          data: [],
          borderWidth: 2,
          borderColor: color,
          backgroundColor: color + "10",
          tension: 0.4,
          fill: true
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: true, labels: { font: { size: 12 } } }
        },
        scales: { y: { beginAtZero: false } }
      }
    });
    return chart;
  } catch (e) {
    console.error(`Lỗi tạo biểu đồ "${id}":`, e);
    return null;
  }
}

// Thêm dữ liệu vào biểu đồ
function themDuLieu(chart, tg, value) {
  if (!chart) return;

  try {
    const time = tg > 10000000000 ? new Date(tg).toLocaleTimeString() : new Date(tg * 1000).toLocaleTimeString();
    chart.data.labels.push(time);
    chart.data.datasets[0].data.push(value);
    if (chart.data.labels.length > 20) {
      chart.data.labels.shift();
      chart.data.datasets[0].data.shift();
    }
    chart.update();
  } catch (e) {
    console.error('Lỗi thêm dữ liệu biểu đồ:', e);
  }
}

// Thêm tin nhắn vào chat
function themChat(logId, nguoi, text) {
  const log = document.getElementById(logId);
  if (!log) return;
  if (log.innerHTML.includes("ℹ️ Chưa có tin nhắn nào")) log.innerHTML = "";
  log.innerHTML += `<p><b>${nguoi}:</b> ${text}</p>`;
  log.scrollTop = log.scrollHeight;
}

// Gửi tin chat theo chủ đề
async function sendTopicChat(topic, inputId, logId) {
  const input = document.getElementById(inputId);
  if (!input) return;
  const text = input.value.trim();
  if (!text) return;
  input.value = "";
  themChat(logId, "Bạn", text);

  try {
    const tone = (document.getElementById('aiTone') && document.getElementById('aiTone').value) || 'friendly';
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text, tone, topic })
    });
    const data = await res.json();
    themChat(logId, '🤖 AI', data.reply || 'Không có phản hồi');
  } catch (err) {
    themChat(logId, '🤖 AI', '❌ Lỗi: ' + err.message);
  }
}

// Lấy dữ liệu ô nhiễm
async function fetchPollutionData() {
  try {
    const res = await fetch('/api/pollution');
    if (!res.ok) throw new Error(res.statusText);
    const payload = await res.json();
    if (document.getElementById('pollutionStatus')) document.getElementById('pollutionStatus').textContent = payload.summary || '--';
    if (Array.isArray(payload.points) && typeof bieuDoO_Nhiem !== 'undefined') {
      payload.points.forEach(p => themDuLieu(bieuDoO_Nhiem, p.time, p.value));
    }
  } catch (e) {
    console.error('Lỗi tải ô nhiễm:', e);
    if (document.getElementById('pollutionStatus')) document.getElementById('pollutionStatus').textContent = 'Lỗi tải dữ liệu';
  }
}

// Cập nhật thông số
function capNhatThongSo(data) {
  if (!data) return;

  const ids = {
    tsNhietDo: `🌡 Nhiệt độ: ${data.nhietDo?.toFixed(1) || '--'} °C`,
    tsDoAm: `💧 Độ ẩm: ${data.doAm?.toFixed(1) || '--'} %`,
    tsPin: `🔋 Pin: ${data.pin?.toFixed(0) || '--'} %`,
    tsThietBi: `🔌 Thiết bị: ${data.thietBi || 'N/A'}`
  };
  Object.entries(ids).forEach(([id, text]) => {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  });
}

// Cập nhật vị trí hiển thị
function capNhatViTri(locationData) {
  if (!locationData) return;

  const locationEl = document.getElementById('tsLocation');
  if (!locationEl) return;

  let displayText = '📍 Vị trí: ';

  if (locationData.address && locationData.address.fullAddress) {
    displayText += locationData.address.fullAddress;
  } else if (locationData.city) {
    displayText += locationData.city;
  } else if (locationData.latitude && locationData.longitude) {
    displayText += `${locationData.latitude.toFixed(4)}, ${locationData.longitude.toFixed(4)}`;
  } else {
    displayText += 'Chưa xác định';
  }

  if (locationData.verified) {
    displayText += ' ✓';
  }

  locationEl.textContent = displayText;
  locationEl.title = locationData.address?.displayName || displayText;

  const homeLocationEl = document.getElementById('homeLocation');
  if (homeLocationEl) {
    let homeText = '';
    if (locationData.address && locationData.address.components) {
      const comp = locationData.address.components;
      if (comp.district && comp.city) {
        homeText = `${comp.district}, ${comp.city}`;
      } else if (comp.city) {
        homeText = comp.city;
      } else if (locationData.city) {
        homeText = locationData.city;
      }
    } else if (locationData.city) {
      homeText = locationData.city;
    }
    if (homeText) {
      homeLocationEl.textContent = homeText;
    }
  }
}

// Socket: nhận dữ liệu dự báo
if (typeof socket !== 'undefined') {
  socket.on('duBaoTraVe', (data) => {
    if (typeof updateForecastChart === 'function') {
      const chart = window.bieuDoDuBaoEnhanced || window.bieuDoDuBao;
      if (chart && Array.isArray(data.points)) {
        updateForecastChart(chart, data.points);
      }
    }
  });

  socket.on('layDuBao', (data) => {
    if (typeof loadForecastData === 'function') {
      const chart = window.bieuDoDuBaoEnhanced || window.bieuDoDuBao;
      if (chart) {
        loadForecastData(chart);
      }
    }
  });
}

// Khởi tạo layout và biểu đồ khi DOM sẵn sàng
document.addEventListener('DOMContentLoaded', function () {
  try {
    // Di chuyển chat card tới vị trí column 3 row 1
    const chatLogs = document.querySelectorAll('.chat-log');
    chatLogs.forEach(log => {
      const card = log.closest('.card');
      if (card) {
        card.classList.add('js-moved-chat');
      }
    });

    // Tạo canvas bổ sung cho biểu đồ thời tiết
    const forecastArea = document.getElementById('forecast24') || document.querySelector('.forecast-container');
    if (forecastArea) {
      if (!document.getElementById('bieuDoThoiTietMoi')) {
        const wrapper = document.createElement('div');
        wrapper.className = 'forecast-extra-chart';

        const canvas = document.createElement('canvas');
        canvas.id = 'bieuDoThoiTietMoi';
        wrapper.appendChild(canvas);
        forecastArea.appendChild(wrapper);

        try {
          window.bieuDoThoiTietMoi = taoBieuDo('bieuDoThoiTietMoi', 'Biểu đồ thời tiết mới', '#ff6600');
          const now = Date.now();
          for (let i = 5; i > 0; i--) {
            themDuLieu(window.bieuDoThoiTietMoi, now - i * 3600 * 1000, Math.round(20 + Math.random() * 6));
          }
        } catch (e) {
          console.warn('Lỗi khởi tạo biểu đồ bổ sung:', e);
        }
      }
      const forecastItems = forecastArea.querySelectorAll('.forecast-item, .forecast-extra-chart, canvas');
      if (forecastItems.length < 2) {
        const extraDiv = document.createElement('div');
        extraDiv.className = 'forecast-item';
        extraDiv.textContent = 'Dự báo phụ: Đang cập nhật...';
        forecastArea.appendChild(extraDiv);
      }
    }
      const isNhietDoPage = document.getElementById('bieuDoNhietDo') || document.body.classList.contains('nhietdo');
      if (isNhietDoPage) {
        let chatCard = null;
        document.querySelectorAll('.card').forEach(card => {
          if (card.classList.contains('js-moved-chat') || card.querySelector('.chat-log')) {
            const col = (card.style && card.style.gridColumn) || window.getComputedStyle(card).gridColumnStart;
            const row = (card.style && card.style.gridRow) || window.getComputedStyle(card).gridRowStart;
            if (col == '3' && row == '1') chatCard = card;
          }
        });
        if (!chatCard && !document.getElementById('chatLogAuto')) {
          const tempEl = document.getElementById('bieuDoNhietDo');
          let targetInsert = null;
          if (tempEl) {
            const tempCard = tempEl.closest('.card');
            if (tempCard) targetInsert = tempCard;
          }

          const grid = document.querySelector('main, .luoi');
          const newCard = document.createElement('div');
          newCard.className = 'card js-moved-chat';
          const h2 = document.createElement('h2');
          h2.textContent = 'Chat AI';

          const box = document.createElement('div');
          box.className = 'box';

          const chatLog = document.createElement('div');
          chatLog.className = 'chat-log';
          chatLog.id = 'chatLogAuto';
          const p = document.createElement('p');
          p.textContent = 'ℹ️ Chưa có tin nhắn nào';
          chatLog.appendChild(p);
          box.appendChild(chatLog);

          const controls = document.createElement('div');
          controls.className = 'chat-controls';
          const input = document.createElement('input');
          input.className = 'chat-input';
          input.id = 'chatInputAuto';
          input.placeholder = 'Nhập tin nhắn...';
          const btn = document.createElement('button');
          btn.className = 'btn btn-chat';
          btn.type = 'button';
          btn.textContent = 'Gửi';
          btn.addEventListener('click', function () {
            sendTopicChat('nhietdo', 'chatInputAuto', 'chatLogAuto');
          });
          controls.appendChild(input);
          controls.appendChild(btn);

          newCard.appendChild(h2);
          newCard.appendChild(box);
          newCard.appendChild(controls);

          if (targetInsert && targetInsert.parentNode) {
            targetInsert.parentNode.insertBefore(newCard, targetInsert.nextSibling);
          } else if (grid) {
            grid.appendChild(newCard);
          }
        }
      }
  } catch (err) {
    console.error('Lỗi khởi tạo layout:', err);
  }
});

// Quản lý trạng thái button header
const headerButtonIds = ['btnDuBaoRefresh', 'btnUpdateData', 'btnThongKe', 'btnConfig', 'btnUpdatePollution'];
let originalButtonTexts = {};

// Vô hiệu hóa các button header
function disableHeaderButtons(clickedButton = null) {
  headerButtonIds.forEach(id => {
    const button = document.getElementById(id);
    if (button) {
      originalButtonTexts[id] = button.innerHTML;
      button.disabled = true;
      if (button === clickedButton) {
        button.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Đang xử lý...';
      } else {
        button.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Đang bận...';
      }
    }
  });
}

// Kích hoạt lại các button header
function enableHeaderButtons() {
  headerButtonIds.forEach(id => {
    const button = document.getElementById(id);
    if (button && originalButtonTexts[id]) {
      button.disabled = false;
      button.innerHTML = originalButtonTexts[id];
    }
  });
  originalButtonTexts = {};
}
