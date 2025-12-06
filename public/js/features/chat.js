// --- KHỞI TẠO CHAT VÀ TÍNH NĂNG GIỌNG NÓI (STT/TTS) ---

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const speechRecognition = SpeechRecognition ? new SpeechRecognition() : null;

if (speechRecognition) {
  speechRecognition.lang = "vi-VN";
  speechRecognition.continuous = false;
  speechRecognition.interimResults = false;
}

// Lấy ID các phần tử Chat/Voice dựa trên trang hiện tại
function getCurrentChatElements() {
  const path = window.location.pathname;
  if (path.includes('home.html')) {
    return { inputId: 'chatNhapHome', sendBtnId: 'chatGuiHome', logId: 'chatLogHome', voiceBtnId: 'btnVoice', ttsBtnId: 'btnTTS' };
  } else if (path.includes('forecast.html')) {
    return { inputId: 'chatNhapForecast', sendBtnId: 'chatGuiForecast', logId: 'chatLogForecast', voiceBtnId: 'btnVoiceForecast', ttsBtnId: 'btnTTSForecast' };
  } else if (path.includes('pollution.html')) {
    return { inputId: 'chatNhapPollution', sendBtnId: 'chatGuiPollution', logId: 'chatLogPollution', voiceBtnId: 'btnVoicePollution', ttsBtnId: 'btnTTSPollution' };
  } else { 
    // Mặc định
    return { inputId: 'chatNhap', sendBtnId: 'chatGui', logId: 'chatLog', voiceBtnId: 'btnVoice', ttsBtnId: 'btnTTS' };
  }
}

// Xử lý gửi tin nhắn, lệnh điều khiển và gọi API
async function sendTopicChat(topic, inputId, logId) {
  const chatInput = document.getElementById(inputId);
  const message = chatInput.value.trim();
  if (!message) return;
  chatInput.value = "";
  themChat(logId, "Bạn", message);

  // Xử lý lệnh điều khiển cảnh báo
  const controlResponse = processAlertControlCommand(message);
  if (controlResponse) {
    themChat(logId, "🤖 AI", controlResponse);
    return;
  }

  // Xử lý lệnh điều hướng trang
  const navigationResponse = processNavigationCommand(message);
  if (navigationResponse) {
    themChat(logId, "🤖 AI", navigationResponse);
    return;
  }

  // Xử lý Lệnh hệ thống AI (ưu tiên cao nhất)
  if (typeof processAIChatMessage === 'function') {
    try {
      console.log('🤖 Processing AI chat message...');
      const aiResponse = await processAIChatMessage(message);
      console.log('✅ AI response received:', aiResponse);

      if (aiResponse && aiResponse.type !== 'unknown') {
        themChat(logId, "🤖 AI", aiResponse.message);
        console.log(`📝 Message displayed for type: ${aiResponse.type}`);

        // Cập nhật ngưỡng cảnh báo (Thresholds) nếu có
        if (aiResponse.type === 'threshold' && window.smartRecommendationEngine && aiResponse.data) {
          window.smartRecommendationEngine.updateThresholds(aiResponse.data);
          console.log('⚙️ Thresholds updated');
        }

        // Phát tín hiệu cập nhật hệ thống qua Socket.io
        if (aiResponse.type === 'system_control' || aiResponse.type === 'mode' || aiResponse.type === 'optimize') {
          console.log('📡 Broadcasting system update via Socket.io');
          if (window.socket) {
            window.socket.emit('aiSystemUpdate', {
              type: aiResponse.type,
              data: aiResponse.data,
              timestamp: Date.now()
            });
            console.log('✅ Socket.io event emitted');
          }
        }

        // Cập nhật hệ thống cảnh báo Threshold Alert System
        if (aiResponse.type === 'threshold' && window.thresholdAlertSystem) {
          window.thresholdAlertSystem.updateThresholds(aiResponse.data);
          // Gửi Custom Event để đồng bộ giữa các component
          window.dispatchEvent(new CustomEvent('thresholdsUpdated', {
            detail: aiResponse.data
          }));
          console.log('🔄 thresholdsUpdated event dispatched');
        }

        return;
      }
    } catch (err) {
      console.error('❌ Error in AI integration:', err);
    }
  }

  // Xử lý chat thông thường qua API backend
  try {
    const aiTone = document.getElementById("aiTone")?.value || "friendly";
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({ message: message, tone: aiTone, topic: topic })
    });
    const data = await res.json();
    themChat(logId, "🤖 AI", data.reply);

    if (data.reply === "🔄 Đang cập nhật vị trí và thời tiết...") {
      if (window.updateLocationAndWeather) {
        window.updateLocationAndWeather();
      }
    }
  } catch (error) {
    themChat(logId, "🤖 AI", "❌ Lỗi: " + error.message);
  }
}

// --- HIỂN THỊ TIN NHẮN TRONG LOG CHAT ---
function themChat(logId, sender, message) {
  const chatLog = document.getElementById(logId);
  if (chatLog) {
    const p = document.createElement('p');
    p.innerHTML = `<strong>${sender}:</strong> ${message}`;
    chatLog.appendChild(p);
    chatLog.scrollTop = chatLog.scrollHeight;
  }
}

// --- XỬ LÝ SỰ KIỆN NHẬN DẠNG GIỌNG NÓI (STT) ---
if (speechRecognition) {
  speechRecognition.onresult = (event) => {
    const transcript = Array.from(event.results)
      .map(result => result[0].transcript)
      .join("");
    const { inputId, logId } = getCurrentChatElements();
    const input = document.getElementById(inputId);
    if (input) {
      input.value = transcript;
      // Tự động gửi tin nhắn sau khi nhận dạng giọng nói
      sendTopicChat(logId.replace('chatLog', '').toLowerCase(), inputId, logId);
    }
  };

  speechRecognition.onerror = (event) => {
    console.error("STT Error:", event.error);
    alert("Lỗi STT: " + event.error);
  };
}

// --- THIẾT LẬP EVENT LISTENERS CHO CÁC NÚT CHAT/VOICE ---
document.addEventListener('DOMContentLoaded', () => {
  const { inputId, sendBtnId, logId, voiceBtnId, ttsBtnId } = getCurrentChatElements();

  const chatInput = document.getElementById(inputId);
  const chatBtn = document.getElementById(sendBtnId);
  const btnVoice = document.getElementById(voiceBtnId);
  const btnTTS = document.getElementById(ttsBtnId);

  if (chatBtn) {
    chatBtn.addEventListener('click', () => {
      if (chatInput && chatInput.value.trim()) {
        sendTopicChat(logId.replace('chatLog', '').toLowerCase(), inputId, logId);
      }
    });
  }

  if (chatInput) {
    chatInput.addEventListener('keypress', (e) => {
      // Xử lý phím Enter (không kèm Shift)
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (chatBtn) chatBtn.click();
      }
    });
  }

  if (btnVoice) {
    btnVoice.onclick = () => {
      if (!speechRecognition) {
        alert("Trình duyệt không hỗ trợ STT");
        return;
      }
      speechRecognition.start();
    };
  }

  if (btnTTS) {
    btnTTS.addEventListener('click', () => {
      const lastMessage = document.querySelector(`#${logId} > p:last-child`);
      if (!lastMessage) {
        alert("Không có tin nhắn để đọc");
        return;
      }
      // Loại bỏ tên người gửi trước khi đọc
      const text = lastMessage.textContent.replace(/^(Bạn|🤖 AI):\s+/, "");
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "vi-VN";
      window.speechSynthesis.speak(utterance);
    });
  }
});

// --- XỬ LÝ LỆNH ĐIỀU KHIỂN CẢNH BÁO (Alerts) ---
function processAlertControlCommand(message) {
  const msg = message.toLowerCase().trim();

  // Định nghĩa các lệnh điều khiển
  const commandMap = {
    'bật cảnh báo': () => {
      if (typeof alertManager !== 'undefined') {
        alertManager.setAlertsState(true);
        return '✅ Cảnh báo đã được bật';
      }
      return null;
    },
    'bật thông báo': () => {
      if (typeof alertManager !== 'undefined') {
        alertManager.setAlertsState(true);
        return '✅ Cảnh báo đã được bật';
      }
      return null;
    },
    'tắt cảnh báo': () => {
      if (typeof alertManager !== 'undefined') {
        alertManager.setAlertsState(false);
        return '🔕 Cảnh báo đã được tắt';
      }
      return null;
    },
    'tắt thông báo': () => {
      if (typeof alertManager !== 'undefined') {
        alertManager.setAlertsState(false);
        return '🔕 Cảnh báo đã được tắt';
      }
      return null;
    },
    'bật âm thanh': () => {
      if (typeof alertManager !== 'undefined') {
        alertManager.setSoundState(true);
        return '🔊 Âm thanh đã được bật';
      }
      return null;
    },
    'bật âm': () => {
      if (typeof alertManager !== 'undefined') {
        alertManager.setSoundState(true);
        return '🔊 Âm thanh đã được bật';
      }
      return null;
    },
    'tắt âm thanh': () => {
      if (typeof alertManager !== 'undefined') {
        alertManager.setSoundState(false);
        return '🔇 Âm thanh đã được tắt';
      }
      return null;
    },
    'tắt âm': () => {
      if (typeof alertManager !== 'undefined') {
        alertManager.setSoundState(false);
        return '🔇 Âm thanh đã được tắt';
      }
      return null;
    },
    'bật thông báo pop-up': () => {
      if (typeof alertManager !== 'undefined') {
        alertManager.setToastsState(true);
        return '💬 Thông báo pop-up đã được bật';
      }
      return null;
    },
    'tắt thông báo pop-up': () => {
      if (typeof alertManager !== 'undefined') {
        alertManager.setToastsState(false);
        return '💬 Thông báo pop-up đã được tắt';
      }
      return null;
    },

    // Lấy trạng thái
    'trạng thái cảnh báo': () => {
      if (typeof alertManager !== 'undefined') {
        const settings = alertManager.getAlertSettings();
        return `📊 Trạng thái cảnh báo:\n` +
          `• Cảnh báo: ${settings.alertsEnabled ? '✅ Bật' : '❌ Tắt'}\n` +
          `• Âm thanh: ${settings.soundEnabled ? '🔊 Bật' : '🔇 Tắt'}\n` +
          `• Pop-up: ${settings.toastsEnabled ? '💬 Bật' : '❌ Tắt'}`;
      }
      return null;
    },
    'xem trạng thái': () => {
      if (typeof alertManager !== 'undefined') {
        const settings = alertManager.getAlertSettings();
        return `📊 Trạng thái cảnh báo:\n` +
          `• Cảnh báo: ${settings.alertsEnabled ? '✅ Bật' : '❌ Tắt'}\n` +
          `• Âm thanh: ${settings.soundEnabled ? '🔊 Bật' : '🔇 Tắt'}\n` +
          `• Pop-up: ${settings.toastsEnabled ? '💬 Bật' : '❌ Tắt'}`;
      }
      return null;
    }
  };

  // Kiểm tra lệnh và thực thi
  for (const [command, handler] of Object.entries(commandMap)) {
    if (msg === command || msg.includes(command)) {
      const result = handler();
      if (result) return result;
    }
  }

  return null; // Không phải lệnh điều khiển
}

// --- XỬ LÝ LỆNH ĐIỀU HƯỚNG TRANG ---
function processNavigationCommand(message) {
  const msg = message.toLowerCase().trim();
  const navigationMap = {
    'nhiệt độ': '/index.html',
    'thời tiết': '/pages/forecast.html',
    'không khí': '/pages/pollution.html'
  };

  for (const [keyword, url] of Object.entries(navigationMap)) {
    if (msg.includes(keyword)) {
      window.location.href = url;
      return `✅ Đang chuyển đến trang ${keyword}...`;
    }
  }

  return null;
}

console.log("✅ chat.js loaded");