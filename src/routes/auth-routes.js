// --- ĐỊNH TUYẾN XÁC THỰC HIỆN ĐẠI (AUTHENTICATION ROUTES) ---
// Hỗ trợ: Google OAuth2, Facebook OAuth, Email/Password, 2FA.

const express = require('express');
const router = express.Router();
const axios = require('axios');
const crypto = require('crypto');

// Khởi tạo service xác thực và db
let authService;
let db;

function setupAuthRoutes(authServiceInstance, dbInstance, mailTransporter, mailFrom) {
  authService = authServiceInstance;
  db = dbInstance;

  // POST /auth/register
  // Đăng ký người dùng mới bằng email/password
  router.post('/register', async (req, res) => {
    try {
      const { fullName, email, username, password, confirmPassword } = req.body;

      // Kiểm tra dữ liệu đầu vào
      if (!fullName || !email || !username || !password) {
        return res.status(400).json({
          success: false,
          message: 'Vui lòng điền đầy đủ tất cả các trường'
        });
      }

      if (password !== confirmPassword) {
        return res.status(400).json({
          success: false,
          message: 'Mật khẩu và xác nhận không khớp'
        });
      }

      // Kiểm tra định dạng email
      if (!authService.isValidEmail(email)) {
        return res.status(400).json({
          success: false,
          message: 'Email không hợp lệ'
        });
      }

      // Kiểm tra độ mạnh mật khẩu
      const passwordValidation = authService.validatePasswordStrength(password);
      if (!passwordValidation.isValid) {
        return res.status(400).json({
          success: false,
          message: 'Mật khẩu không đủ mạnh',
          issues: passwordValidation.issues,
          score: passwordValidation.score
        });
      }

      // Kiểm tra user đã tồn tại
      const existingUser = await db.kiemTraTrungEmailUsername(email, username);
      if (existingUser) {
        return res.status(409).json({
          success: false,
          message: 'Email hoặc tên đăng nhập đã được sử dụng'
        });
      }

      // Hash mật khẩu
      const hashedPassword = await authService.hashPassword(password);

      // Tạo user
      const result = await db.taoNguoiDung({
        fullName,
        email: email.toLowerCase(),
        username: username.toLowerCase(),
        password: hashedPassword,
        createdAt: Date.now(),
        emailVerified: false,
        twoFAEnabled: false
      });

      // Tạo token xác minh email (24 giờ)
      const verificationToken = authService.generateToken(
        { userId: result.id, type: 'email_verification' },
        process.env.SESSION_SECRET || 'iot-ai-secret',
        86400 // 24 hours
      );

      // Gửi email xác minh
      try {
        await mailTransporter.sendMail({
          from: mailFrom,
          to: email,
          subject: 'Xác minh email - IoT-AI Monitor',
          html: `
            <h2>Chào mừng đến IoT-AI Monitor!</h2>
            <p>Vui lòng xác minh email của bạn bằng cách nhấp vào liên kết dưới đây:</p>
            <a href="http://localhost:3000/auth/verify-email?token=${verificationToken}" style="background: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
              Xác minh Email
            </a>
            <p>Liên kết sẽ hết hạn sau 24 giờ.</p>
          `
        });
      } catch (mailErr) {
        console.warn('⚠️ Không thể gửi email xác minh:', mailErr.message);
      }

      res.status(201).json({
        success: true,
        message: 'Đăng ký thành công! Vui lòng kiểm tra email để xác minh.',
        user: {
          id: result.id,
          fullName,
          email,
          username
        }
      });

    } catch (error) {
      console.error('❌ Lỗi đăng ký:', error.message);
      res.status(500).json({
        success: false,
        message: 'Lỗi máy chủ khi đăng ký'
      });
    }
  });

  // POST /auth/login
  // Đăng nhập bằng email và mật khẩu
  router.post('/login', async (req, res) => {
    try {
      const { identifier, password, ipAddress } = req.body;
      const clientIP = ipAddress || req.ip || req.connection.remoteAddress;

      if (!identifier || !password) {
        return res.status(400).json({
          success: false,
          message: 'Vui lòng nhập email/tên đăng nhập và mật khẩu'
        });
      }

      // Kiểm tra nỗ lực đăng nhập (Rate limiting)
      const attempts = await db.getLoginAttempts(identifier, clientIP);
      const failedAttempts = attempts.filter(a => !a.success).length;

      if (failedAttempts >= 5) {
        await db.recordLoginAttempt(identifier, clientIP, false);
        return res.status(429).json({
          success: false,
          message: 'Quá nhiều lần đăng nhập thất bại. Vui lòng thử lại sau 15 phút.'
        });
      }

      // Tìm user
      const user = await db.timUserTheoEmailHoacUsername(identifier);

      if (!user || !user.password) {
        await db.recordLoginAttempt(identifier, clientIP, false);
        return res.status(401).json({
          success: false,
          message: 'Email/tên đăng nhập hoặc mật khẩu không đúng'
        });
      }

      // Kiểm tra user có hoạt động
      if (user.isActive === false || user.isActive === 0) {
        return res.status(403).json({
          success: false,
          message: 'Tài khoản đã bị khóa'
        });
      }

      // Xác minh mật khẩu
      const passwordMatch = await authService.comparePassword(password, user.password);

      if (!passwordMatch) {
        await db.recordLoginAttempt(identifier, clientIP, false);
        return res.status(401).json({
          success: false,
          message: 'Email/tên đăng nhập hoặc mật khẩu không đúng'
        });
      }

      // Ghi nhận đăng nhập thành công
      await db.recordLoginAttempt(identifier, clientIP, true);
      await db.capNhatLastLogin(user.id);

      // Kiểm tra 2FA
      if (user.twoFAEnabled) {
        const otpCode = authService.generateOTP(user.email);

        // Gửi email OTP
        try {
          await mailTransporter.sendMail({
            from: mailFrom,
            to: user.email,
            subject: 'Mã xác thực 2FA - IoT-AI Monitor',
            html: `
              <h2>Xác thực hai yếu tố</h2>
              <p>Mã xác thực của bạn là:</p>
              <h1 style="font-family: monospace; letter-spacing: 5px; font-size: 32px;">${otpCode}</h1>
              <p>Mã này sẽ hết hạn sau 10 phút.</p>
            `
          });
        } catch (mailErr) {
          console.warn('⚠️ Không thể gửi mã OTP:', mailErr.message);
        }

        return res.status(200).json({
          success: true,
          requiresTwoFA: true,
          message: 'Mã xác thực đã được gửi đến email của bạn',
          userId: user.id,
          twoFAMethod: user.twoFAMethod
        });
      }

      // Tạo JWT token (24 giờ)
      const token = authService.generateToken(
        { userId: user.id, email: user.email },
        process.env.SESSION_SECRET || 'iot-ai-secret',
        86400 // 24 hours
      );

      // Tạo phiên đăng nhập
      await db.createLoginSession(
        user.id,
        token,
        req.get('user-agent') || 'Unknown',
        clientIP
      );

      res.json({
        success: true,
        message: 'Đăng nhập thành công',
        token,
        user: {
          id: user.id,
          fullName: user.fullName,
          email: user.email,
          username: user.username,
          avatarUrl: user.avatarUrl
        }
      });

    } catch (error) {
      console.error('❌ Lỗi đăng nhập:', error.message);
      res.status(500).json({
        success: false,
        message: 'Lỗi máy chủ khi đăng nhập'
      });
    }
  });

  // POST /auth/verify-2fa
  // Xác minh mã OTP 2FA
  router.post('/verify-2fa', async (req, res) => {
    try {
      const { userId, otpCode } = req.body;

      if (!userId || !otpCode) {
        return res.status(400).json({
          success: false,
          message: 'Vui lòng cung cấp ID người dùng và mã OTP'
        });
      }

      const user = await db.timUserTheoId(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy người dùng'
        });
      }

      // Xác minh OTP
      const isValidOTP = authService.verifyOTP(user.email, otpCode);

      if (!isValidOTP) {
        return res.status(401).json({
          success: false,
          message: 'Mã xác thực không hợp lệ hoặc đã hết hạn'
        });
      }

      // Tạo session token
      const token = authService.generateToken(
        { userId: user.id, email: user.email, twoFAVerified: true },
        process.env.SESSION_SECRET || 'iot-ai-secret',
        86400
      );

      await db.createLoginSession(
        user.id,
        token,
        req.get('user-agent') || 'Unknown',
        req.ip || req.connection.remoteAddress
      );

      res.json({
        success: true,
        message: 'Xác thực 2FA thành công',
        token,
        user: {
          id: user.id,
          fullName: user.fullName,
          email: user.email,
          username: user.username,
          avatarUrl: user.avatarUrl
        }
      });

    } catch (error) {
      console.error('❌ Lỗi xác thực 2FA:', error.message);
      res.status(500).json({
        success: false,
        message: 'Lỗi máy chủ khi xác thực 2FA'
      });
    }
  });

  // POST /auth/setup-2fa
  // Cấu hình 2FA cho tài khoản
  router.post('/setup-2fa', async (req, res) => {
    try {
      const { userId, method } = req.body; // method: 'email' hoặc 'totp'

      if (!userId || !method) {
        return res.status(400).json({
          success: false,
          message: 'Vui lòng cung cấp ID người dùng và phương thức'
        });
      }

      const user = await db.timUserTheoId(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy người dùng'
        });
      }

      if (method === 'totp') {
        // Tạo TOTP secret
        const totpData = authService.generateTOTPSecret(user.email);

        if (!totpData) {
          return res.status(500).json({
            success: false,
            message: 'Không thể tạo TOTP secret'
          });
        }

        res.json({
          success: true,
          message: 'TOTP secret đã tạo',
          secret: totpData.secret,
          qrCode: totpData.qrCode,
          manualEntry: totpData.manualEntry
        });

      } else if (method === 'email') {
        // Email OTP đã có sẵn, chỉ cần xác nhận
        res.json({
          success: true,
          message: 'Email 2FA đã được cấu hình',
          method: 'email'
        });

      } else {
        return res.status(400).json({
          success: false,
          message: 'Phương thức không hợp lệ'
        });
      }

    } catch (error) {
      console.error('❌ Lỗi cấu hình 2FA:', error.message);
      res.status(500).json({
        success: false,
        message: 'Lỗi máy chủ khi cấu hình 2FA'
      });
    }
  });

  // POST /auth/confirm-2fa
  // Xác nhận và bật 2FA sau khi user xác minh TOTP
  router.post('/confirm-2fa', async (req, res) => {
    try {
      const { userId, method, totpCode, secret } = req.body;

      if (!userId || !method) {
        return res.status(400).json({
          success: false,
          message: 'Vui lòng cung cấp ID người dùng và phương thức'
        });
      }

      const user = await db.timUserTheoId(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy người dùng'
        });
      }

      if (method === 'totp') {
        if (!totpCode || !secret) {
          return res.status(400).json({
            success: false,
            message: 'Vui lòng cung cấp mã TOTP và secret'
          });
        }

        // Xác minh mã TOTP
        if (!authService.verifyTOTP(secret, totpCode)) {
          return res.status(401).json({
            success: false,
            message: 'Mã TOTP không hợp lệ'
          });
        }

        // Bật 2FA
        await db.enableTwoFA(userId, 'totp', secret);
      } else if (method === 'email') {
        // Bật 2FA qua email
        await db.enableTwoFA(userId, 'email', null);
      }

      res.json({
        success: true,
        message: '2FA đã được bật thành công'
      });

    } catch (error) {
      console.error('❌ Lỗi xác nhận 2FA:', error.message);
      res.status(500).json({
        success: false,
        message: 'Lỗi máy chủ khi bật 2FA'
      });
    }
  });

  // POST /auth/disable-2fa
  // Tắt 2FA cho tài khoản
  router.post('/disable-2fa', async (req, res) => {
    try {
      const { userId, password } = req.body;

      if (!userId || !password) {
        return res.status(400).json({
          success: false,
          message: 'Vui lòng cung cấp mật khẩu để xác nhận'
        });
      }

      const user = await db.timUserTheoId(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy người dùng'
        });
      }

      // Xác minh mật khẩu
      const passwordMatch = await authService.comparePassword(password, user.password);
      if (!passwordMatch) {
        return res.status(401).json({
          success: false,
          message: 'Mật khẩu không đúng'
        });
      }

      await db.disableTwoFA(userId);

      res.json({
        success: true,
        message: '2FA đã được tắt'
      });

    } catch (error) {
      console.error('❌ Lỗi tắt 2FA:', error.message);
      res.status(500).json({
        success: false,
        message: 'Lỗi máy chủ khi tắt 2FA'
      });
    }
  });

  // GET /auth/google
  // Chuyển hướng đến màn hình xác thực Google OAuth
  router.get('/google', (req, res) => {
    if (!process.env.GOOGLE_CLIENT_ID) {
      return res.status(400).json({
        success: false,
        message: 'Google OAuth chưa được cấu hình'
      });
    }

    const redirectUri = encodeURIComponent(`${process.env.OAUTH_CALLBACK_URL || 'http://localhost:3000'}/auth/google/callback`);
    const scope = encodeURIComponent('email profile');
    const state = crypto.randomBytes(16).toString('hex');

    // Lưu state trong session
    req.session = req.session || {};
    req.session.oauthState = state;

    const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${process.env.GOOGLE_CLIENT_ID}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}&state=${state}`;

    res.redirect(googleAuthUrl);
  });

  // GET /auth/google/callback
  // Google OAuth callback
  router.get('/google/callback', async (req, res) => {
    try {
      const { code, state, error } = req.query;

      if (error) {
        return res.redirect(`/pages/login.html?error=${encodeURIComponent('Xác thực Google thất bại')}`);
      }

      if (!code) {
        return res.redirect(`/pages/login.html?error=${encodeURIComponent('Không nhận được mã ủy quyền')}`);
      }

      // Đổi mã lấy token
      const tokenResponse = await axios.post('https://oauth2.googleapis.com/token', {
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        code,
        grant_type: 'authorization_code',
        redirect_uri: `${process.env.OAUTH_CALLBACK_URL || 'http://localhost:3000'}/auth/google/callback`
      });

      const accessToken = tokenResponse.data.access_token;

      // Lấy thông tin người dùng
      const userInfoResponse = await axios.get('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${accessToken}` }
      });

      const profile = userInfoResponse.data;

      // Xử lý người dùng OAuth
      const user = await authService.handleOAuthUser({
        id: profile.id,
        email: profile.email,
        name: profile.name,
        picture: profile.picture
      }, 'google');

      // Lưu OAuth token
      await db.saveOAuthToken(
        user.id,
        'google',
        accessToken,
        tokenResponse.data.refresh_token || null,
        tokenResponse.data.expires_in
      );

      // Tạo session token
      const sessionToken = authService.generateToken(
        { userId: user.id, email: user.email, provider: 'google' },
        process.env.SESSION_SECRET || 'iot-ai-secret',
        86400
      );

      await db.createLoginSession(
        user.id,
        sessionToken,
        req.get('user-agent') || 'Unknown',
        req.ip || req.connection.remoteAddress
      );

      // Lưu token vào cookie hoặc session
      res.cookie('authToken', sessionToken, { httpOnly: true, maxAge: 86400000 });

      res.redirect(`/pages/home.html?provider=google`);

    } catch (error) {
      console.error('❌ Lỗi Google OAuth callback:', error.message);
      res.redirect(`/pages/login.html?error=${encodeURIComponent('Đăng nhập Google thất bại')}`);
    }
  });

  // GET /auth/facebook
  // Chuyển hướng đến Facebook OAuth
  router.get('/facebook', (req, res) => {
    if (!process.env.FACEBOOK_CLIENT_ID) {
      return res.status(400).json({
        success: false,
        message: 'Facebook OAuth chưa được cấu hình'
      });
    }

    const redirectUri = encodeURIComponent(`${process.env.OAUTH_CALLBACK_URL || 'http://localhost:3000'}/auth/facebook/callback`);
    const scope = encodeURIComponent('email public_profile');
    const state = crypto.randomBytes(16).toString('hex');

    req.session = req.session || {};
    req.session.oauthState = state;

    const facebookAuthUrl = `https://www.facebook.com/v18.0/dialog/oauth?client_id=${process.env.FACEBOOK_CLIENT_ID}&redirect_uri=${redirectUri}&scope=${scope}&state=${state}&response_type=code`;

    res.redirect(facebookAuthUrl);
  });

  // GET /auth/facebook/callback
  // Facebook OAuth callback
  router.get('/facebook/callback', async (req, res) => {
    try {
      const { code, error } = req.query;

      if (error) {
        return res.redirect(`/pages/login.html?error=${encodeURIComponent('Xác thực Facebook thất bại')}`);
      }

      if (!code) {
        return res.redirect(`/pages/login.html?error=${encodeURIComponent('Không nhận được mã ủy quyền')}`);
      }

      // Đổi mã lấy token
      const tokenResponse = await axios.get('https://graph.instagram.com/v18.0/oauth/access_token', {
        params: {
          client_id: process.env.FACEBOOK_CLIENT_ID,
          client_secret: process.env.FACEBOOK_CLIENT_SECRET,
          code,
          redirect_uri: `${process.env.OAUTH_CALLBACK_URL || 'http://localhost:3000'}/auth/facebook/callback`
        }
      });

      const accessToken = tokenResponse.data.access_token;

      // Lấy thông tin người dùng
      const userInfoResponse = await axios.get('https://graph.facebook.com/me', {
        params: {
          access_token: accessToken,
          fields: 'id,name,email,picture'
        }
      });

      const profile = userInfoResponse.data;

      // Xử lý người dùng OAuth
      const user = await authService.handleOAuthUser({
        id: profile.id,
        email: profile.email,
        name: profile.name,
        picture: profile.picture?.data?.url
      }, 'facebook');

      // Lưu OAuth token
      await db.saveOAuthToken(
        user.id,
        'facebook',
        accessToken,
        null,
        60 * 60 * 24 * 60 // 60 ngày
      );

      // Tạo session token
      const sessionToken = authService.generateToken(
        { userId: user.id, email: user.email, provider: 'facebook' },
        process.env.SESSION_SECRET || 'iot-ai-secret',
        86400
      );

      await db.createLoginSession(
        user.id,
        sessionToken,
        req.get('user-agent') || 'Unknown',
        req.ip || req.connection.remoteAddress
      );

      res.cookie('authToken', sessionToken, { httpOnly: true, maxAge: 86400000 });

      res.redirect(`/pages/home.html?provider=facebook`);

    } catch (error) {
      console.error('❌ Lỗi Facebook OAuth callback:', error.message);
      res.redirect(`/pages/login.html?error=${encodeURIComponent('Đăng nhập Facebook thất bại')}`);
    }
  });

  // POST /auth/logout
  // Đăng xuất và thu hồi session
  router.post('/logout', async (req, res) => {
    try {
      const { token, revokeAll } = req.body;

      if (!token) {
        return res.status(400).json({
          success: false,
          message: 'Vui lòng cung cấp token'
        });
      }

      const session = await db.getLoginSession(token);

      if (!session) {
        return res.status(401).json({
          success: false,
          message: 'Phiên không hợp lệ'
        });
      }

      if (revokeAll) {
        // Đăng xuất khỏi tất cả thiết bị
        await db.revokeAllUserSessions(session.userId);
      } else {
        // Đăng xuất khỏi thiết bị hiện tại
        await db.revokeLoginSession(token);
      }

      res.json({
        success: true,
        message: 'Đăng xuất thành công'
      });

    } catch (error) {
      console.error('❌ Lỗi đăng xuất:', error.message);
      res.status(500).json({
        success: false,
        message: 'Lỗi máy chủ khi đăng xuất'
      });
    }
  });

  // POST /auth/password/forgot
  // Yêu cầu đặt lại mật khẩu
  router.post('/password/forgot', async (req, res) => {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({
          success: false,
          message: 'Vui lòng nhập email'
        });
      }

      const user = await db.timUserTheoEmail(email.toLowerCase());

      if (!user || !user.password) {
        // Trả lời thành công để tránh tiết lộ user tồn tại
        return res.json({
          success: true,
          message: 'Nếu email tồn tại, liên kết reset mật khẩu đã được gửi'
        });
      }

      // Tạo token reset (1 giờ)
      const resetToken = crypto.randomBytes(32).toString('hex');
      await db.createPasswordResetToken(user.id, resetToken, 3600); // 1 hour

      // Gửi email reset
      try {
        await mailTransporter.sendMail({
          from: mailFrom,
          to: email,
          subject: 'Reset mật khẩu - IoT-AI Monitor',
          html: `
            <h2>Yêu cầu reset mật khẩu</h2>
            <p>Nhấp vào liên kết dưới đây để reset mật khẩu của bạn:</p>
            <a href="http://localhost:3000/pages/reset-password.html?token=${resetToken}" style="background: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
              Reset Mật khẩu
            </a>
            <p>Liên kết sẽ hết hạn sau 1 giờ.</p>
          `
        });
      } catch (mailErr) {
        console.warn('⚠️ Gửi email reset thất bại:', mailErr.message);
      }

      res.json({
        success: true,
        message: 'Liên kết reset mật khẩu đã được gửi đến email'
      });

    } catch (error) {
      console.error('❌ Lỗi quên mật khẩu:', error.message);
      res.status(500).json({
        success: false,
        message: 'Lỗi máy chủ khi xử lý quên mật khẩu'
      });
    }
  });

  // POST /auth/password/reset
  // Đặt lại mật khẩu bằng token
  router.post('/password/reset', async (req, res) => {
    try {
      const { token, password, confirmPassword } = req.body;

      if (!token || !password) {
        return res.status(400).json({
          success: false,
          message: 'Vui lòng cung cấp token và mật khẩu mới'
        });
      }

      if (password !== confirmPassword) {
        return res.status(400).json({
          success: false,
          message: 'Mật khẩu và xác nhận không khớp'
        });
      }

      // Kiểm tra độ mạnh mật khẩu
      const validation = authService.validatePasswordStrength(password);
      if (!validation.isValid) {
        return res.status(400).json({
          success: false,
          message: 'Mật khẩu không đủ mạnh',
          issues: validation.issues
        });
      }

      // Lấy token reset
      const resetRecord = await db.getPasswordResetToken(token);
      if (!resetRecord) {
        return res.status(401).json({
          success: false,
          message: 'Liên kết reset không hợp lệ hoặc đã hết hạn'
        });
      }

      // Hash mật khẩu mới
      const hashedPassword = await authService.hashPassword(password);

      // Cập nhật mật khẩu
      await db.capNhatMatKhauTheoId(resetRecord.userId, hashedPassword);

      // Đánh dấu token đã sử dụng
      await db.markPasswordResetUsed(token);

      // Thu hồi tất cả session (buộc đăng nhập lại)
      await db.revokeAllUserSessions(resetRecord.userId);

      res.json({
        success: true,
        message: 'Mật khẩu đã được reset thành công. Vui lòng đăng nhập lại.'
      });

    } catch (error) {
      console.error('❌ Lỗi đặt lại mật khẩu:', error.message);
      res.status(500).json({
        success: false,
        message: 'Lỗi máy chủ khi reset mật khẩu'
      });
    }
  });

  // GET /auth/verify-email
  // Xác minh địa chỉ email
  router.get('/verify-email', async (req, res) => {
    try {
      const { token } = req.query;

      if (!token) {
        return res.status(400).json({
          success: false,
          message: 'Vui lòng cung cấp token xác minh'
        });
      }

      // Xác minh token
      const payload = authService.verifyToken(token, process.env.SESSION_SECRET || 'iot-ai-secret');

      if (!payload || payload.type !== 'email_verification') {
        return res.status(401).json({
          success: false,
          message: 'Token không hợp lệ hoặc đã hết hạn'
        });
      }

      // Đánh dấu email đã xác minh
      await db.verifyEmail(payload.userId);

      res.json({
        success: true,
        message: 'Email đã được xác minh thành công'
      });

    } catch (error) {
      console.error('❌ Lỗi xác minh email:', error.message);
      res.status(500).json({
        success: false,
        message: 'Lỗi máy chủ khi xác minh email'
      });
    }
  });

  return router;
}

module.exports = setupAuthRoutes;