// Lớp Xử lý Xác thực (Authentication Handler)
// Hỗ trợ: Email/Mật khẩu, OAuth2 (Google, Facebook), và Xác thực 2 Yếu tố (2FA).

class AuthenticationHandler {
  constructor() {
    this.currentUser = null;
    this.authToken = null;
    this.twoFARequired = false;
    this.init();
  }

  async init() {
    // Kiểm tra token đã tồn tại trong LocalStorage/SessionStorage
    this.authToken = localStorage.getItem('authToken') || sessionStorage.getItem('authToken');
    if (this.authToken) {
      // Xác thực phiên làm việc nếu tìm thấy token
      await this.validateSession();
    }

    this.setupEventListeners();
    console.log('✅ AuthenticationHandler đã khởi tạo');
  }

  setupEventListeners() {
    // Đăng ký
    const registerBtn = document.getElementById('btnRegister');
    if (registerBtn) {
      registerBtn.addEventListener('click', () => this.handleRegister());
    }

    // Đăng nhập
    const loginBtn = document.getElementById('btnLogin');
    if (loginBtn) {
      loginBtn.addEventListener('click', () => this.handleLogin());
    }

    // Xác thực 2FA
    const verify2FABtn = document.getElementById('btnVerify2FA');
    if (verify2FABtn) {
      verify2FABtn.addEventListener('click', () => this.handleVerify2FA());
    }

    // Thiết lập 2FA
    const setup2FABtn = document.getElementById('btnSetup2FA');
    if (setup2FABtn) {
      setup2FABtn.addEventListener('click', () => this.handleSetup2FA());
    }

    // Nút OAuth (Google)
    const googleBtn = document.querySelector('.btn.auth-social.google');
    if (googleBtn) {
      googleBtn.addEventListener('click', () => this.handleGoogleLogin());
    }

    // Nút OAuth (Facebook)
    const facebookBtn = document.querySelector('.btn.auth-social.facebook');
    if (facebookBtn) {
      facebookBtn.addEventListener('click', () => this.handleFacebookLogin());
    }

    // Đăng xuất
    const logoutBtn = document.getElementById('btnLogout');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => this.handleLogout());
    }
  }

  // Xử lý đăng ký người dùng
  async handleRegister() {
    console.log('🔄 Đang xử lý đăng ký...');
    const fullName = document.getElementById('fullName')?.value?.trim();
    const email = document.getElementById('registerEmail')?.value?.trim();
    const username = document.getElementById('username')?.value?.trim();
    const password = document.getElementById('registerPassword')?.value?.trim();
    const confirmPassword = document.getElementById('confirmPassword')?.value?.trim();

    if (!fullName || !email || !username || !password || !confirmPassword) {
      this.showError('Vui lòng điền đầy đủ tất cả các trường');
      return;
    }

    if (password !== confirmPassword) {
      this.showError('Mật khẩu và xác nhận không khớp');
      return;
    }

    if (password.length < 8) {
      this.showError('Mật khẩu phải có ít nhất 8 ký tự');
      return;
    }

    try {
      const button = event.target;
      button.disabled = true;
      button.textContent = 'Đang xử lý...';

      const response = await fetch('/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName, email, username, password, confirmPassword })
      });

      const data = await response.json();

      if (!data.success) {
        this.showError(data.message || 'Đăng ký thất bại');
        button.disabled = false;
        button.textContent = 'Đăng ký';
        return;
      }

      this.showSuccess('Đăng ký thành công! Vui lòng kiểm tra email để xác minh.');
      setTimeout(() => {
        window.location.href = '/pages/login.html';
      }, 2000);

    } catch (error) {
      console.error('❌ Lỗi kết nối đăng ký:', error);
      this.showError('Lỗi kết nối: ' + error.message);
    }
  }

  // Xử lý đăng nhập người dùng
  async handleLogin() {
    console.log('🔄 Đang xử lý đăng nhập...');
    const identifier = document.getElementById('loginEmail')?.value?.trim();
    const password = document.getElementById('loginPassword')?.value?.trim();
    const rememberMe = document.getElementById('rememberMe')?.checked;

    if (!identifier || !password) {
      this.showError('Vui lòng nhập email/tên đăng nhập và mật khẩu');
      return;
    }

    try {
      const button = event.target;
      button.disabled = true;
      button.textContent = 'Đang đăng nhập...';

      const response = await fetch('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, password })
      });

      const data = await response.json();

      if (!data.success) {
        this.showError(data.message || 'Đăng nhập thất bại');
        button.disabled = false;
        button.textContent = 'Đăng nhập';
        return;
      }

      // Kiểm tra yêu cầu 2FA
      if (data.requiresTwoFA) {
        console.log('⚠️ Yêu cầu Xác thực 2 Yếu tố (2FA)');
        this.twoFARequired = true;
        this.currentUser = { id: data.userId };
        this.showTwoFAForm(data.twoFAMethod);
        button.disabled = false;
        button.textContent = 'Đăng nhập';
        return;
      }

      // Lưu token và thông tin user (Local hoặc Session)
      const storage = rememberMe ? localStorage : sessionStorage;
      storage.setItem('authToken', data.token);
      storage.setItem('currentUser', JSON.stringify(data.user));
      this.authToken = data.token;
      this.currentUser = data.user;

      this.showSuccess('Đăng nhập thành công');
      setTimeout(() => {
        window.location.href = '/pages/home.html';
      }, 1000);

    } catch (error) {
      console.error('❌ Lỗi kết nối đăng nhập:', error);
      this.showError('Lỗi kết nối: ' + error.message);
    }
  }

  // Xử lý xác thực 2FA
  async handleVerify2FA() {
    console.log('🔄 Đang xử lý xác thực 2FA...');
    const otpCode = document.getElementById('otpCode')?.value?.trim();

    if (!otpCode || otpCode.length !== 6) {
      this.showError('Vui lòng nhập mã 6 chữ số');
      return;
    }

    try {
      const button = event.target;
      button.disabled = true;
      button.textContent = 'Đang xác thực...';

      const response = await fetch('/auth/verify-2fa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: this.currentUser.id,
          otpCode
        })
      });

      const data = await response.json();

      if (!data.success) {
        this.showError(data.message || '2FA xác thực thất bại');
        button.disabled = false;
        button.textContent = 'Xác thực';
        return;
      }

      // Lưu token và thông tin user sau khi xác thực thành công
      localStorage.setItem('authToken', data.token);
      localStorage.setItem('currentUser', JSON.stringify(data.user));
      this.authToken = data.token;
      this.currentUser = data.user;

      this.showSuccess('Xác thực thành công');
      setTimeout(() => {
        window.location.href = '/pages/home.html';
      }, 1000);

    } catch (error) {
      console.error('❌ Lỗi kết nối 2FA:', error);
      this.showError('Lỗi kết nối: ' + error.message);
    }
  }

  // Hiển thị form 2FA
  showTwoFAForm(method) {
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
      loginForm.style.display = 'none';
    }

    let twoFAForm = document.getElementById('twoFAForm');
    if (!twoFAForm) {
      twoFAForm = document.createElement('form');
      twoFAForm.id = 'twoFAForm';
      twoFAForm.innerHTML = `
        <div class="form-group">
          <label>Mã xác thực ${method === 'email' ? '(gửi qua email)' : '(từ ứng dụng xác thực)'}</label>
          <input type="text" id="otpCode" placeholder="Nhập mã 6 chữ số" maxlength="6" pattern="[0-9]{6}" required>
        </div>
        <button type="button" class="btn btn-primary btn-block" id="btnVerify2FA">Xác thực</button>
        <p class="text-muted text-small">Mã sẽ hết hạn sau 10 phút</p>
      `;
      const formContainer = document.querySelector('.auth-card');
      if (formContainer) {
        formContainer.appendChild(twoFAForm);
      }
    }

    twoFAForm.style.display = 'block';
    this.setupEventListeners();
    console.log('✅ Form 2FA đã hiển thị');
  }

  // Xử lý đăng nhập Google
  handleGoogleLogin() {
    console.log('🔄 Chuyển hướng đăng nhập Google...');
    window.location.href = '/auth/google';
  }

  // Xử lý đăng nhập Facebook
  handleFacebookLogin() {
    console.log('🔄 Chuyển hướng đăng nhập Facebook...');
    window.location.href = '/auth/facebook';
  }

  // Xử lý đăng xuất
  async handleLogout() {
    console.log('🔄 Đang xử lý đăng xuất...');
    try {
      const response = await fetch('/auth/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: this.authToken,
          revokeAll: false // Đặt 'true' để đăng xuất trên mọi thiết bị
        })
      });

      const data = await response.json();

      if (data.success) {
        // Xóa tất cả thông tin đăng nhập trong bộ nhớ
        localStorage.removeItem('authToken');
        localStorage.removeItem('currentUser');
        sessionStorage.removeItem('authToken');
        sessionStorage.removeItem('currentUser');
        this.authToken = null;
        this.currentUser = null;

        window.location.href = '/pages/login.html';
      }

    } catch (error) {
      console.error('❌ Lỗi đăng xuất:', error);
    }
  }

  // Xử lý thiết lập 2FA
  async handleSetup2FA() {
    console.log('🔄 Đang xử lý thiết lập 2FA...');
    const method = document.getElementById('twoFAMethod')?.value || 'email';

    try {
      const response = await fetch('/auth/setup-2fa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: this.currentUser.id,
          method
        })
      });

      const data = await response.json();

      if (!data.success) {
        this.showError(data.message);
        return;
      }

      if (method === 'totp') {
        this.showTOTPSetup(data.qrCode, data.secret);
      } else {
        this.showSuccess('Email 2FA đã được cấu hình');
      }

    } catch (error) {
      console.error('❌ Lỗi kết nối thiết lập 2FA:', error);
      this.showError('Lỗi kết nối: ' + error.message);
    }
  }

  // Hiển thị form thiết lập TOTP
  showTOTPSetup(qrCode, secret) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="modal-content">
        <h2>Cấu hình Xác thực hai yếu tố</h2>
        <p>Quét mã QR bằng ứng dụng xác thực (Google Authenticator, Authy, v.v.)</p>
        <img src="${qrCode}" alt="TOTP QR Code" style="width: 300px; height: 300px;">
        <p>Hoặc nhập mã thủ công: <code>${secret}</code></p>
        <div class="form-group">
          <label>Nhập mã từ ứng dụng xác thực</label>
          <input type="text" id="totpVerificationCode" placeholder="Nhập mã 6 chữ số" maxlength="6" pattern="[0-9]{6}">
        </div>
        <button class="btn btn-primary" id="btnConfirmTOTP">Xác nhận</button>
        <button class="btn btn-secondary" id="btnCancelTOTP">Hủy</button>
      </div>
    `;

    document.body.appendChild(modal);

    document.getElementById('btnConfirmTOTP').addEventListener('click', async () => {
      const code = document.getElementById('totpVerificationCode').value;
      if (!code || code.length !== 6) {
        this.showError('Vui lòng nhập mã 6 chữ số');
        return;
      }

      try {
        const response = await fetch('/auth/confirm-2fa', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: this.currentUser.id,
            method: 'totp',
            totpCode: code,
            secret: secret
          })
        });

        const data = await response.json();

        if (data.success) {
          this.showSuccess('2FA TOTP đã được bật thành công');
          modal.remove();
        } else {
          this.showError(data.message);
        }

      } catch (error) {
        this.showError('Lỗi kết nối: ' + error.message);
      }
    });

    document.getElementById('btnCancelTOTP').addEventListener('click', () => {
      modal.remove();
    });
    console.log('✅ Form thiết lập TOTP đã hiển thị');
  }

  // Xác thực phiên làm việc
  async validateSession() {
    // (Lưu ý: Trong môi trường production cần gọi API backend để xác thực token)
    const currentUser = localStorage.getItem('currentUser') || sessionStorage.getItem('currentUser');
    if (currentUser) {
      this.currentUser = JSON.parse(currentUser);
      console.log('🔒 Phiên làm việc đã xác thực');
    }
  }

  // Hiển thị thông báo lỗi
  showError(message) {
    alert(`❌ ${message}`);
  }

  // Hiển thị thông báo thành công
  showSuccess(message) {
    alert(`✅ ${message}`);
  }

  // Lấy thông tin người dùng hiện tại
  getCurrentUser() {
    return this.currentUser;
  }

  // Lấy Auth Token
  getAuthToken() {
    return this.authToken;
  }

  // Kiểm tra xem người dùng đã được xác thực chưa
  isAuthenticated() {
    return !!this.authToken && !!this.currentUser;
  }
}

// Khởi tạo lớp khi DOM đã sẵn sàng
document.addEventListener('DOMContentLoaded', () => {
  window.authHandler = new AuthenticationHandler();
});