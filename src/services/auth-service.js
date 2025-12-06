// --- DỊCH VỤ XÁC THỰC HIỆN ĐẠI (AUTH SERVICE) ---
// Hỗ trợ: Google, Facebook, Email/Password, 2FA.

const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');

// Cấu hình 2FA - TOTP
let totp;
try {
  totp = require('speakeasy');
} catch (e) {
  console.warn('⚠️ speakeasy chưa được cài đặt. 2FA qua TOTP sẽ bị tắt.');
}

class AuthService {
  constructor(db) {
    this.db = db;
    this.otpStorage = new Map(); // Lưu mã OTP trong bộ nhớ (Email 2FA)
    this.tokenBlacklist = new Set(); // Danh sách token bị thu hồi
  }

  // Hash mật khẩu bằng bcrypt
  // @param {string} password - Mật khẩu plain text
  // @returns {Promise<string>} Mật khẩu đã hash
  async hashPassword(password) {
    const saltRounds = 12; // Tăng cường bảo mật
    return await bcrypt.hash(password, saltRounds);
  }

  // So sánh mật khẩu với hash
  // @param {string} password - Mật khẩu plain text
  // @param {string} hash - Mật khẩu đã hash
  // @returns {Promise<boolean>}
  async comparePassword(password, hash) {
    return await bcrypt.compare(password, hash);
  }

  // Tạo JWT token (implement đơn giản)
  // @param {Object} payload - Payload của token
  // @param {string} secret - Khóa bí mật
  // @param {number} expiresIn - Thời gian hết hạn (giây)
  // @returns {string} JWT token
  generateToken(payload, secret, expiresIn = 86400) {
    // Implement JWT đơn giản (Nên dùng thư viện `jsonwebtoken` trong môi trường sản xuất)
    const header = {
      alg: 'HS256',
      typ: 'JWT'
    };

    const iat = Math.floor(Date.now() / 1000);
    const exp = iat + expiresIn;

    const tokenPayload = {
      ...payload,
      iat,
      exp
    };

    const headerEncoded = this._base64Encode(JSON.stringify(header));
    const payloadEncoded = this._base64Encode(JSON.stringify(tokenPayload));

    const signature = this._createHmacSignature(
      `${headerEncoded}.${payloadEncoded}`,
      secret
    );

    return `${headerEncoded}.${payloadEncoded}.${signature}`;
  }

  // Xác minh JWT token
  // @param {string} token - JWT token
  // @param {string} secret - Khóa bí mật
  // @returns {Object|null} Payload hoặc null nếu không hợp lệ
  verifyToken(token, secret) {
    try {
      const [headerEncoded, payloadEncoded, signatureReceived] = token.split('.');

      const signature = this._createHmacSignature(
        `${headerEncoded}.${payloadEncoded}`,
        secret
      );

      // Kiểm tra chữ ký
      if (signature !== signatureReceived) {
        return null;
      }

      const payload = JSON.parse(this._base64Decode(payloadEncoded));

      // Kiểm tra hết hạn
      if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
        return null; // Token đã hết hạn
      }

      // Kiểm tra danh sách đen (blacklist)
      if (this.tokenBlacklist.has(token)) {
        return null;
      }

      return payload;
    } catch (error) {
      console.error('❌ Lỗi xác minh token:', error.message);
      return null;
    }
  }

  // Thu hồi token (thêm vào blacklist)
  // @param {string} token - Token cần thu hồi
  revokeToken(token) {
    this.tokenBlacklist.add(token);
  }

  // Tạo OTP cho 2FA qua Email
  // @param {string} email - Email người dùng
  // @returns {string} Mã OTP
  generateOTP(email) {
    const otp = crypto.randomInt(100000, 999999).toString();
    const expiresAt = Date.now() + (10 * 60 * 1000); // Hết hạn sau 10 phút

    this.otpStorage.set(email, {
      code: otp,
      expiresAt,
      attempts: 0
    });

    return otp;
  }

  // Xác minh OTP
  // @param {string} email - Email người dùng
  // @param {string} code - Mã OTP cần xác minh
  // @returns {boolean}
  verifyOTP(email, code) {
    const storedOTP = this.otpStorage.get(email);

    if (!storedOTP) {
      return false;
    }

    // Kiểm tra hết hạn
    if (Date.now() > storedOTP.expiresAt) {
      this.otpStorage.delete(email);
      return false;
    }

    // Giới hạn 5 lần thử
    if (storedOTP.attempts >= 5) {
      this.otpStorage.delete(email);
      return false;
    }

    storedOTP.attempts++;

    if (storedOTP.code !== code) {
      return false;
    }

    // OTP xác minh thành công
    this.otpStorage.delete(email);
    return true;
  }

  // Tạo TOTP secret cho ứng dụng xác thực
  // @param {string} email - Email người dùng
  // @returns {Object|null} Secret và QR code URL
  generateTOTPSecret(email) {
    if (!totp) {
      return null;
    }

    try {
      const secret = totp.generateSecret({
        name: `IoT-AI Monitor (${email})`,
        issuer: 'IoT-AI',
        length: 32
      });

      return {
        secret: secret.base32,
        qrCode: secret.qr_code_url,
        manualEntry: secret.base32
      };
    } catch (error) {
      console.error('❌ Lỗi tạo TOTP:', error.message);
      return null;
    }
  }

  // Xác minh mã TOTP
  // @param {string} secret - Secret Base32
  // @param {string} token - Mã 6 chữ số từ ứng dụng
  // @returns {boolean}
  verifyTOTP(secret, token) {
    if (!totp) {
      return false;
    }

    try {
      const verified = totp.verifyToken({
        secret: secret,
        encoding: 'base32',
        token: token,
        window: 2 // Cho phép 2 khoảng thời gian (±30 giây)
      });

      // speakeasy trả về null hoặc một số
      return verified !== false; 
    } catch (error) {
      console.error('❌ Lỗi xác minh TOTP:', error.message);
      return false;
    }
  }

  // Hash OAuth token (ít khi dùng, thường chỉ dùng JWT)
  // @param {string} token - OAuth access token
  // @returns {string} Hashed token
  hashOAuthToken(token) {
    return crypto
      .createHash('sha256')
      .update(token)
      .digest('hex');
  }

  // Xử lý người dùng OAuth (tạo hoặc cập nhật)
  // @param {Object} profile - Hồ sơ OAuth từ nhà cung cấp
  // @param {string} provider - Tên nhà cung cấp (google, facebook)
  // @returns {Promise<Object>} Đối tượng User
  async handleOAuthUser(profile, provider) {
    try {
      const email = profile.email?.toLowerCase() || null;
      const providerId = profile.id;

      // 1. Tìm user hiện tại bằng Provider ID
      let user = await this.db.timUserTheoProvider(provider, providerId);

      if (user) {
        // Cập nhật lần đăng nhập cuối
        await this.db.capNhatLastLogin(user.id);
        return user;
      }

      // 2. Kiểm tra user bằng Email
      if (email) {
        user = await this.db.timUserTheoEmail(email);
        if (user) {
          // Liên kết tài khoản OAuth vào user hiện tại
          await this.db.linkOAuthAccount(user.id, provider, providerId);
          await this.db.capNhatLastLogin(user.id);
          return user;
        }
      }

      // 3. Tạo user mới
      const newUser = {
        email: email || `${provider}_${providerId}@oauth.local`,
        username: profile.email?.split('@')[0] || `${provider}_${providerId}`,
        fullName: profile.name || profile.displayName || 'OAuth User',
        provider: provider,
        providerId: providerId,
        avatarUrl: profile.picture || profile.photos?.[0]?.value || null,
        createdAt: Date.now(),
        twoFAEnabled: false
      };

      const result = await this.db.taoNguoiDung(newUser);
      return { ...newUser, id: result.id };

    } catch (error) {
      console.error('❌ Lỗi xử lý người dùng OAuth:', error.message);
      throw error;
    }
  }

  // Kiểm tra định dạng email
  // @param {string} email - Email cần kiểm tra
  // @returns {boolean}
  isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  // Kiểm tra độ mạnh mật khẩu
  // @param {string} password - Mật khẩu cần kiểm tra
  // @returns {Object} Kết quả kiểm tra với mảng lỗi
  validatePasswordStrength(password) {
    const issues = [];

    if (password.length < 8) {
      issues.push('Mật khẩu phải có ít nhất 8 ký tự');
    }

    if (!/[A-Z]/.test(password)) {
      issues.push('Mật khẩu phải chứa chữ cái viết hoa');
    }

    if (!/[a-z]/.test(password)) {
      issues.push('Mật khẩu phải chứa chữ cái viết thường');
    }

    if (!/[0-9]/.test(password)) {
      issues.push('Mật khẩu phải chứa chữ số');
    }

    if (!/[!@#$%^&*]/.test(password)) {
      issues.push('Mật khẩu phải chứa ký tự đặc biệt (!@#$%^&*)');
    }

    return {
      isValid: issues.length === 0,
      issues: issues,
      score: 5 - issues.length // Điểm 0-5
    };
  }

  // Tạo mật khẩu ngẫu nhiên an toàn
  // @param {number} length - Chiều dài mật khẩu (mặc định 16)
  // @returns {string}
  generateSecurePassword(length = 16) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let password = '';
    for (let i = 0; i < length; i++) {
      password += chars.charAt(crypto.randomInt(0, chars.length));
    }
    return password;
  }

  // Private: Base64 mã hóa
  _base64Encode(str) {
    return Buffer.from(str).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  }

  // Private: Base64 giải mã
  _base64Decode(str) {
    str += '=='.slice(0, (4 - str.length % 4) % 4);
    return Buffer.from(str.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString();
  }

  // Private: Tạo chữ ký HMAC
  _createHmacSignature(message, secret) {
    return crypto
      .createHmac('sha256', secret)
      .update(message)
      .digest('base64')
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');
  }
}

module.exports = AuthService;