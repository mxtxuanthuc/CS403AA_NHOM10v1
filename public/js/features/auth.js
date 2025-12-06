document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('loginForm');
  const loginButton = document.getElementById('btnLogin');
  const registerForm = document.getElementById('registerForm');
  const registerButton = document.getElementById('btnRegister');
  const forgotForm = document.getElementById('forgotForm');
  const forgotButton = document.getElementById('btnForgotSubmit');

  // Hàm hiển thị thông báo lỗi
  function showError(message) {
    alert(message);
  }

  // Hàm hiển thị thông báo thành công
  function showSuccess(message) {
    alert(message);
  }

  // --- CHỨC NĂNG ẨN/HIỆN MẬT KHẨU ---
  
  // Thiết lập chức năng chuyển đổi loại input (password <-> text)
  function setupPasswordToggle(toggleBtnId, inputId) {
    const toggleBtn = document.getElementById(toggleBtnId);
    const input = document.getElementById(inputId);
    
    if (toggleBtn && input) {
      toggleBtn.addEventListener('click', (e) => {
        e.preventDefault();
        const isPassword = input.type === 'password';
        input.type = isPassword ? 'text' : 'password';
        
        const icon = toggleBtn.querySelector('.material-icons');
        if (icon) {
          icon.textContent = isPassword ? 'visibility_off' : 'visibility';
        }
      });
    }
  }

  // Thiết lập cho các trường mật khẩu
  setupPasswordToggle('toggleLoginPassword', 'loginPassword');
  setupPasswordToggle('toggleRegisterPassword', 'registerPassword');
  setupPasswordToggle('toggleConfirmPassword', 'confirmPassword');

  // --- CHỨC NĂNG LƯU THÔNG TIN ĐĂNG NHẬP (REMEMBER ME) ---
  
  function loadRememberedCredentials() {
    const rememberCheckbox = document.getElementById('rememberMe');
    const emailInput = document.getElementById('loginEmail');
    const passwordInput = document.getElementById('loginPassword');

    // Kiểm tra an toàn các phần tử tồn tại
    if (!rememberCheckbox || !emailInput || !passwordInput) {
      console.warn('⚠️ Không tìm thấy các phần tử form đăng nhập');
      return;
    }

    // Luôn xóa SessionStorage khi tải trang
    sessionStorage.removeItem('iot_ai_remember_credentials');

    // Chỉ tải dữ liệu từ LocalStorage nếu người dùng đã chọn "Nhớ đăng nhập" lần trước
    const saved = localStorage.getItem('iot_ai_remember_credentials');

    if (saved) {
      try {
        const { email, password } = JSON.parse(saved);
        if (email && password) {
          emailInput.value = email || '';
          passwordInput.value = password || '';
          rememberCheckbox.checked = true;
        }
      } catch (e) {
        console.error('❌ Lỗi khi tải thông tin đăng nhập đã lưu:', e);
        // Xóa dữ liệu lỗi
        localStorage.removeItem('iot_ai_remember_credentials');
      }
    } else {
      // Nếu không có dữ liệu trong localStorage, xóa sạch form
      emailInput.value = '';
      passwordInput.value = '';
      rememberCheckbox.checked = false;
    }
  }

  // Lưu thông tin vào bộ nhớ
  function saveRememberedCredentials(email, password, shouldRemember) {
    try {
      // Nếu chọn ghi nhớ, lưu vào LocalStorage
      if (shouldRemember) {
        localStorage.setItem('iot_ai_remember_credentials', JSON.stringify({ email, password }));
      } else {
        // Nếu không chọn ghi nhớ, xóa tất cả dữ liệu đã lưu
        localStorage.removeItem('iot_ai_remember_credentials');
      }
      // Luôn xóa SessionStorage
      sessionStorage.removeItem('iot_ai_remember_credentials');
    } catch (e) {
      console.error('❌ Lỗi khi lưu thông tin đăng nhập:', e);
    }
  }

  // Tải thông tin đã lưu khi tải trang (chạy trong DOMContentLoaded)
  loadRememberedCredentials();

  // --- XỬ LÝ ĐĂNG NHẬP ---
  
  if (loginButton && loginForm) {
    const handleLogin = async () => {
      const emailInput = document.getElementById('loginEmail');
      const passwordInput = document.getElementById('loginPassword');
      const rememberCheckbox = document.getElementById('rememberMe');

      const identifier = (emailInput && emailInput.value || '').trim();
      const password = (passwordInput && passwordInput.value || '').trim();
      const shouldRemember = rememberCheckbox?.checked || false;

      if (!identifier || !password) {
        showError('Vui lòng nhập đầy đủ Email/Tên đăng nhập và Mật khẩu.');
        return;
      }

      if (password.length < 6) {
        showError('Mật khẩu phải có ít nhất 6 ký tự.');
        return;
      }

      try {
        loginButton.disabled = true;
        loginButton.textContent = 'Đang đăng nhập...';

        const res = await fetch('/api/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ identifier, password })
        });
        const data = await res.json();

        if (!data.success) {
          showError(data.message || 'Đăng nhập thất bại');
          loginButton.disabled = false;
          loginButton.textContent = 'Đăng nhập';
          return;
        }

        // Lưu thông tin đăng nhập nếu chọn "Ghi nhớ"
        saveRememberedCredentials(identifier, password, shouldRemember);

        // Lưu thông tin user (tên, profile) vào bộ nhớ (Local/Session)
        if (data.user) {
          const displayName = data.user.fullName || data.user.username || '';
          const storage = shouldRemember ? localStorage : sessionStorage;
          storage.setItem('currentUserName', displayName);
          storage.setItem('currentUserProfile', JSON.stringify({
            id: data.user.id,
            fullName: data.user.fullName || '',
            email: data.user.email || '',
            username: data.user.username || ''
          }));
        }

        showSuccess(data.message || 'Đăng nhập thành công');
        const urlParams = new URLSearchParams(window.location.search);
        const redirectTarget = urlParams.get('redirect') || '/pages/home.html';
        // Thêm độ trễ nhỏ để cho phép showSuccess hiển thị
        setTimeout(() => {
          window.location.href = redirectTarget;
        }, 500);
      } catch (e) {
        console.error('❌ Lỗi đăng nhập:', e);
        showError('Lỗi kết nối tới máy chủ: ' + e.message);
        loginButton.disabled = false;
        loginButton.textContent = 'Đăng nhập';
      }
    };

    loginButton.addEventListener('click', handleLogin);
    
    // Xử lý sự kiện Enter
    loginForm.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleLogin();
      }
    });
  }

  // --- XỬ LÝ ĐĂNG KÝ ---
  
  if (registerButton && registerForm) {
    const handleRegister = async () => {
      const fullNameInput = document.getElementById('fullName');
      const emailInput = document.getElementById('registerEmail');
      const usernameInput = document.getElementById('username');
      const passwordInput = document.getElementById('registerPassword');
      const confirmInput = document.getElementById('confirmPassword');

      const fullName = (fullNameInput && fullNameInput.value || '').trim();
      const email = (emailInput && emailInput.value || '').trim();
      const username = (usernameInput && usernameInput.value || '').trim();
      const password = (passwordInput && passwordInput.value || '').trim();
      const confirm = (confirmInput && confirmInput.value || '').trim();

      if (!fullName || !email || !username || !password || !confirm) {
        showError('Vui lòng điền đầy đủ tất cả các trường.');
        return;
      }

      if (password.length < 6) {
        showError('Mật khẩu phải có ít nhất 6 ký tự.');
        return;
      }

      if (password !== confirm) {
        showError('Mật khẩu và Xác nhận mật khẩu không khớp.');
        return;
      }

      try {
        registerButton.disabled = true;
        registerButton.textContent = 'Đang xử lý...';

        const res = await fetch('/api/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fullName, email, username, password })
        });
        const data = await res.json();

        if (!data.success) {
          showError(data.message || 'Đăng ký thất bại');
          registerButton.disabled = false;
          registerButton.textContent = 'Đăng ký';
          return;
        }

        showSuccess(data.message || 'Đăng ký thành công, hãy đăng nhập');
        window.location.href = '/pages/login.html';
      } catch (e) {
        showError('Lỗi kết nối tới máy chủ: ' + e.message);
        registerButton.disabled = false;
        registerButton.textContent = 'Đăng ký';
      }
    };

    registerButton.addEventListener('click', handleRegister);
    
    // Xử lý sự kiện Enter
    registerForm.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleRegister();
      }
    });
  }

  // --- XỬ LÝ QUÊN MẬT KHẨU ---
  
  if (forgotButton && forgotForm) {
    const handleForgot = async () => {
      const emailInput = document.getElementById('forgotEmail');
      const email = (emailInput && emailInput.value || '').trim();

      if (!email) {
        showError('Vui lòng nhập email đã đăng ký.');
        return;
      }

      try {
        forgotButton.disabled = true;
        forgotButton.textContent = 'Đang xử lý...';

        const res = await fetch('/api/password/forgot', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email })
        });
        const data = await res.json();

        if (!data.success) {
          showError(data.message || 'Không thể xử lý yêu cầu.');
          forgotButton.disabled = false;
          forgotButton.textContent = 'Gửi mật khẩu mới';
          return;
        }

        showSuccess(data.message || 'Mật khẩu mới đã được gửi, vui lòng kiểm tra email.');
        window.location.href = '/pages/login.html';
      } catch (e) {
        showError('Lỗi kết nối tới máy chủ: ' + e.message);
        forgotButton.disabled = false;
        forgotButton.textContent = 'Gửi mật khẩu mới';
      }
    };

    forgotButton.addEventListener('click', handleForgot);
    
    // Xử lý sự kiện Enter
    forgotForm.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleForgot();
      }
    });
  }

  // --- XỬ LÝ ĐĂNG NHẬP BẰNG TÀI KHOẢN XÃ HỘI ---
  
  // Facebook
  const facebookBtn = document.querySelector('.btn.auth-social.facebook');
  if (facebookBtn) {
    facebookBtn.addEventListener('click', () => {
      window.location.href = '/auth/facebook';
    });
  }

  // Google
  const googleBtn = document.querySelector('.btn.auth-social.google');
  if (googleBtn) {
    googleBtn.addEventListener('click', () => {
      window.location.href = '/auth/google';
    });
  }

  // Hiển thị lỗi đăng nhập xã hội (nếu có từ URL callback)
  const urlParams = new URLSearchParams(window.location.search);
  const socialError = urlParams.get('error');
  if (socialError) {
    showError('Đăng nhập xã hội thất bại: ' + decodeURIComponent(socialError));
  }
});