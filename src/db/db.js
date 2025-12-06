const sqlite3 = require("sqlite3").verbose();
const db = new sqlite3.Database("./data/iot.db");

// Tạo bảng cảm biến
db.run(`
  CREATE TABLE IF NOT EXISTS cambien (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nhietDo REAL,
    doAm REAL,
    thietBi TEXT,
    thoigian INTEGER
  )
`);

// Tạo bảng thời tiết
db.run(`
  CREATE TABLE IF NOT EXISTS thoiTiet (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nhietDo REAL,
    doAm REAL,
    thoigian INTEGER
  )
`);

// Tạo bảng cảnh báo
db.run(`
  CREATE TABLE IF NOT EXISTS canhBao (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    loai TEXT,
    chiTiet TEXT,
    thoigian INTEGER
  )
`);

// Tạo bảng thống kê - ghi nhận các mục hàng ngày
db.run(`
  CREATE TABLE IF NOT EXISTS thongKe (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ngay TEXT,
    tongGhiNhan INTEGER DEFAULT 0,
    tongCanhBao INTEGER DEFAULT 0,
    canhBaoNhietDo INTEGER DEFAULT 0,
    canhBaoDoAm INTEGER DEFAULT 0,
    nhieuDoBinhQuan REAL DEFAULT 0,
    doAmBinhQuan REAL DEFAULT 0,
    nhieuDoMax REAL DEFAULT 0,
    nhieuDoMin REAL DEFAULT 0,
    doAmMax REAL DEFAULT 0,
    doAmMin REAL DEFAULT 0,
    thoigian INTEGER
  )
`);

// Tạo bảng ô nhiễm
db.run(`
  CREATE TABLE IF NOT EXISTS oNhiem (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    aqi REAL,
    pm25 REAL,
    pm10 REAL,
    thoigian INTEGER
  )
`);

// Tạo bảng users cho xác thực
db.run(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    fullName TEXT,
    email TEXT UNIQUE,
    username TEXT UNIQUE,
    password TEXT,
    createdAt INTEGER,
    lastLogin INTEGER,
    provider TEXT,
    providerId TEXT,
    avatarUrl TEXT,
    twoFAEnabled BOOLEAN DEFAULT 0,
    twoFAMethod TEXT,
    totpSecret TEXT,
    emailVerified BOOLEAN DEFAULT 0,
    isActive BOOLEAN DEFAULT 1
  )
`);

// Tạo bảng OAuth tokens
db.run(`
  CREATE TABLE IF NOT EXISTS oauth_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId INTEGER NOT NULL,
    provider TEXT,
    accessToken TEXT,
    refreshToken TEXT,
    tokenExpiry INTEGER,
    createdAt INTEGER,
    FOREIGN KEY (userId) REFERENCES users(id)
  )
`);

// Tạo bảng login sessions
db.run(`
  CREATE TABLE IF NOT EXISTS login_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId INTEGER NOT NULL,
    token TEXT UNIQUE,
    userAgent TEXT,
    ipAddress TEXT,
    createdAt INTEGER,
    expiresAt INTEGER,
    isActive BOOLEAN DEFAULT 1,
    FOREIGN KEY (userId) REFERENCES users(id)
  )
`);

// Tạo bảng password reset tokens
db.run(`
  CREATE TABLE IF NOT EXISTS password_resets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId INTEGER NOT NULL,
    resetToken TEXT UNIQUE,
    expiresAt INTEGER,
    createdAt INTEGER,
    used BOOLEAN DEFAULT 0,
    FOREIGN KEY (userId) REFERENCES users(id)
  )
`);

// Tạo bảng login attempts (rate limiting)
db.run(`
  CREATE TABLE IF NOT EXISTS login_attempts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT,
    ipAddress TEXT,
    success BOOLEAN,
    timestamp INTEGER
  )
`);

// Helper: Thêm cột nếu thiếu (cho bảo mật nâng cao)
function addColumnIfMissing(column, definition) {
  db.run(`ALTER TABLE users ADD COLUMN ${column} ${definition}`, (err) => {
    if (err && !/duplicate column name/i.test(err.message || '')) {
      console.error(`❌ Không thể thêm cột ${column}:`, err.message);
    }
  });
}

// Thêm các cột mới cho bảo mật
addColumnIfMissing('provider', 'TEXT');
addColumnIfMissing('providerId', 'TEXT');
addColumnIfMissing('avatarUrl', 'TEXT');
addColumnIfMissing('twoFAEnabled', 'BOOLEAN DEFAULT 0');
addColumnIfMissing('twoFAMethod', 'TEXT');
addColumnIfMissing('totpSecret', 'TEXT');
addColumnIfMissing('emailVerified', 'BOOLEAN DEFAULT 0');
addColumnIfMissing('isActive', 'BOOLEAN DEFAULT 1');
addColumnIfMissing('lastLogin', 'INTEGER');

module.exports = {
  // Lưu dữ liệu cảm biến
  luuDuLieuCamBien: (d) => {
    return new Promise((res, rej) => {
      db.run(
        `INSERT INTO cambien(nhietDo, doAm, thietBi, thoigian)
          VALUES (?, ?, ?, ?)`,
        [d.nhietDo, d.doAm, d.thietBi, d.thoigian],
        function(err) {
          if (err) rej(err);
          else res({ id: this.lastID });
        }
      );
    });
  },

  // Lưu dữ liệu ô nhiễm
  luuDuLieuOnhie: (d) => {
    return new Promise((res, rej) => {
      db.run(
        `INSERT INTO oNhiem(aqi, pm25, pm10, thoigian)
          VALUES (?, ?, ?, ?)`,
        [d.aqi, d.pm25, d.pm10, Date.now()],
        function(err) {
          if (err) rej(err);
          else res({ id: this.lastID });
        }
      );
    });
  },

  // Lấy lịch sử ô nhiễm (24 giờ)
  layLichSuOnhie: () =>
    new Promise((res, rej) => {
      const twentyFourHoursAgo = Date.now() - (24 * 60 * 60 * 1000);
      db.all(
        `SELECT * FROM oNhiem WHERE thoigian >= ? ORDER BY thoigian ASC`,
        [twentyFourHoursAgo],
        (err, rows) => {
          if (err) rej(err);
          else res(rows || []);
        }
      );
    }),

  // Lấy dự báo 24 giờ (24 bản ghi cuối)
  layDuBao24h: () =>
    new Promise((res, rej) => {
      db.all(
        `SELECT * FROM cambien ORDER BY id DESC LIMIT 24`,
        (err, rows) => {
          if (err) rej(err);
          else res(rows ? rows.reverse() : []);
        }
      );
    }),

  // Lấy dữ liệu cảm biến mới nhất
  layDuLieuMoiNhat: () =>
    new Promise((res, rej) => {
      db.get(
        `SELECT * FROM cambien ORDER BY id DESC LIMIT 1`,
        (err, row) => {
          if (err) rej(err);
          else res(row || {});
        }
      );
    }),

  // Lấy lịch sử 24h (288 bản ghi cuối)
  layLichSu24h: () =>
    new Promise((res, rej) => {
      db.all(
        `SELECT * FROM cambien ORDER BY thoigian DESC LIMIT 288`,
        (err, rows) => {
          if (err) rej(err);
          else res(rows ? rows.reverse() : []);
        }
      );
    }),

  // Lưu cảnh báo
  luuCanhBao: (loai, chiTiet) => {
    return new Promise((res, rej) => {
      db.run(
        `INSERT INTO canhBao(loai, chiTiet, thoigian) VALUES (?, ?, ?)`,
        [loai, chiTiet, Date.now()],
        function(err) {
          if (err) rej(err);
          else res({ id: this.lastID });
        }
      );
    });
  },

  // Xóa toàn bộ dữ liệu (cảm biến, cảnh báo, thống kê)
  xoaToangBoDuLieu: () =>
    new Promise((res, rej) => {
      // Xóa tất cả 3 bảng
      db.run(`DELETE FROM cambien`, (err1) => {
        if (err1) rej(err1);
        else {
          db.run(`DELETE FROM canhBao`, (err2) => {
            if (err2) rej(err2);
            else {
              db.run(`DELETE FROM thongKe`, (err3) => {
                if (err3) rej(err3);
                else res({ success: true });
              });
            }
          });
        }
      });
    }),

  // Ghi nhận thống kê hàng ngày
  ghiThongKe: (data) => {
    return new Promise((res, rej) => {
      const ngay = new Date().toISOString().split('T')[0];
      db.run(
        `INSERT OR REPLACE INTO thongKe(
          ngay, tongGhiNhan, tongCanhBao, canhBaoNhietDo, canhBaoDoAm,
          nhieuDoBinhQuan, doAmBinhQuan,
          nhieuDoMax, nhieuDoMin, doAmMax, doAmMin, thoigian
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          ngay,
          data.tongGhiNhan || 0,
          data.tongCanhBao || 0,
          data.canhBaoNhietDo || 0,
          data.canhBaoDoAm || 0,
          data.nhieuDoBinhQuan || 0,
          data.doAmBinhQuan || 0,
          data.nhieuDoMax || 0,
          data.nhieuDoMin || 0,
          data.doAmMax || 0,
          data.doAmMin || 0,
          Date.now()
        ],
        function(err) {
          if (err) rej(err);
          else res({ success: true, id: this.lastID });
        }
      );
    });
  },

  // Lấy thống kê hôm nay
  layThongKeHomNay: () =>
    new Promise((res, rej) => {
      const ngay = new Date().toISOString().split('T')[0];
      db.get(
        `SELECT * FROM thongKe WHERE ngay = ? ORDER BY id DESC LIMIT 1`,
        [ngay],
        (err, row) => {
          if (err) rej(err);
          else res(row || {});
        }
      );
    }),

  // Lấy thống kê các ngày gần đây (30 ngày)
  layThongKe30Ngay: () =>
    new Promise((res, rej) => {
      db.all(
        `SELECT * FROM thongKe ORDER BY ngay DESC LIMIT 30`,
        (err, rows) => {
          if (err) rej(err);
          else res(rows ? rows.reverse() : []);
        }
      );
    }),

  // ==== HỖ TRỢ XÁC THỰC NGƯỜI DÙNG ====
  
  // Tạo người dùng (Email/Password)
  taoUser: (user) =>
    new Promise((res, rej) => {
      db.run(
        `INSERT INTO users(fullName, email, username, password, createdAt)
          VALUES (?, ?, ?, ?, ?)` ,
        [user.fullName, user.email, user.username, user.password, Date.now()],
        function(err) {
          if (err) rej(err);
          else res({ id: this.lastID });
        }
      );
    }),

  // Tìm người dùng theo Email hoặc Username
  timUserTheoEmailHoacUsername: (identifier) =>
    new Promise((res, rej) => {
      db.get(
        `SELECT * FROM users WHERE email = ? OR username = ? LIMIT 1`,
        [identifier, identifier],
        (err, row) => {
          if (err) rej(err);
          else res(row || null);
        }
      );
    }),

  // Kiểm tra trùng lặp Email/Username
  kiemTraTrungEmailUsername: (email, username) =>
    new Promise((res, rej) => {
      db.get(
        `SELECT * FROM users WHERE email = ? OR username = ? LIMIT 1`,
        [email, username],
        (err, row) => {
          if (err) rej(err);
          else res(row || null);
        }
      );
    }),

  // Tìm người dùng theo Email
  timUserTheoEmail: (email) =>
    new Promise((res, rej) => {
      db.get(
        `SELECT * FROM users WHERE LOWER(email) = LOWER(?) LIMIT 1`,
        [email],
        (err, row) => {
          if (err) rej(err);
          else res(row || null);
        }
      );
    }),

  // Tìm người dùng theo Username
  timUserTheoUsername: (username) =>
    new Promise((res, rej) => {
      db.get(
        `SELECT * FROM users WHERE LOWER(username) = LOWER(?) LIMIT 1`,
        [username],
        (err, row) => {
          if (err) rej(err);
          else res(row || null);
        }
      );
    }),

  // Cập nhật mật khẩu theo Email
  capNhatMatKhauTheoEmail: (email, hashedPassword) =>
    new Promise((res, rej) => {
      db.run(
        `UPDATE users SET password = ? WHERE LOWER(email) = LOWER(?)`,
        [hashedPassword, email],
        function(err) {
          if (err) rej(err);
          else res({ changes: this.changes });
        }
      );
    }),

  // Tìm người dùng theo ID
  timUserTheoId: (id) =>
    new Promise((res, rej) => {
      db.get(
        `SELECT * FROM users WHERE id = ? LIMIT 1`,
        [id],
        (err, row) => {
          if (err) rej(err);
          else res(row || null);
        }
      );
    }),

  // Cập nhật hồ sơ người dùng
  capNhatHoSoNguoiDung: (id, fullName) =>
    new Promise((res, rej) => {
      db.run(
        `UPDATE users SET fullName = ? WHERE id = ?`,
        [fullName, id],
        function(err) {
          if (err) rej(err);
          else res({ changes: this.changes });
        }
      );
    }),

  // Cập nhật mật khẩu theo ID
  capNhatMatKhauTheoId: (id, hashedPassword) =>
    new Promise((res, rej) => {
      db.run(
        `UPDATE users SET password = ? WHERE id = ?`,
        [hashedPassword, id],
        function(err) {
          if (err) rej(err);
          else res({ changes: this.changes });
        }
      );
    }),

  // Tìm người dùng theo nhà cung cấp (Social/OAuth)
  timUserTheoProvider: (provider, providerId) =>
    new Promise((res, rej) => {
      db.get(
        `SELECT * FROM users WHERE provider = ? AND providerId = ? LIMIT 1`,
        [provider, providerId],
        (err, row) => {
          if (err) rej(err);
          else res(row || null);
        }
      );
    }),

  // Cập nhật provider cho người dùng
  capNhatProviderChoUser: (id, provider, providerId, avatarUrl) =>
    new Promise((res, rej) => {
      db.run(
        `UPDATE users SET provider = ?, providerId = ?, avatarUrl = COALESCE(?, avatarUrl) WHERE id = ?`,
        [provider, providerId, avatarUrl || null, id],
        function(err) {
          if (err) rej(err);
          else res({ changes: this.changes });
        }
      );
    }),

  // Tạo người dùng từ Social/OAuth
  taoUserTuSocial: ({ fullName, email, username, provider, providerId, avatarUrl }) =>
    new Promise((res, rej) => {
      db.run(
        `INSERT INTO users(fullName, email, username, password, createdAt, provider, providerId, avatarUrl)
          VALUES (?, ?, ?, NULL, ?, ?, ?, ?)`,
        [fullName, email, username, Date.now(), provider, providerId, avatarUrl || null],
        function(err) {
          if (err) rej(err);
          else res({ id: this.lastID });
        }
      );
    }),

  // ==== PHƯƠNG THỨC XÁC THỰC MỚI (2FA & OAUTH) ====
  
  // Tạo người dùng chi tiết
  taoNguoiDung: (user) =>
    new Promise((res, rej) => {
      db.run(
        `INSERT INTO users(fullName, email, username, password, createdAt, provider, providerId, avatarUrl, twoFAEnabled, emailVerified, isActive)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          user.fullName,
          user.email,
          user.username,
          user.password || null,
          user.createdAt || Date.now(),
          user.provider || null,
          user.providerId || null,
          user.avatarUrl || null,
          user.twoFAEnabled ? 1 : 0,
          user.emailVerified ? 1 : 0,
          user.isActive !== false ? 1 : 0
        ],
        function(err) {
          if (err) rej(err);
          else res({ id: this.lastID });
        }
      );
    }),

  // Liên kết tài khoản OAuth
  linkOAuthAccount: (userId, provider, providerId) =>
    new Promise((res, rej) => {
      db.run(
        `UPDATE users SET provider = ?, providerId = ? WHERE id = ?`,
        [provider, providerId, userId],
        function(err) {
          if (err) rej(err);
          else res({ changes: this.changes });
        }
      );
    }),

  // Cập nhật thời gian đăng nhập lần cuối
  capNhatLastLogin: (userId) =>
    new Promise((res, rej) => {
      db.run(
        `UPDATE users SET lastLogin = ? WHERE id = ?`,
        [Date.now(), userId],
        function(err) {
          if (err) rej(err);
          else res({ changes: this.changes });
        }
      );
    }),

  // Bật xác thực 2FA
  enableTwoFA: (userId, method, totpSecret) =>
    new Promise((res, rej) => {
      db.run(
        `UPDATE users SET twoFAEnabled = 1, twoFAMethod = ?, totpSecret = ? WHERE id = ?`,
        [method, totpSecret || null, userId],
        function(err) {
          if (err) rej(err);
          else res({ changes: this.changes });
        }
      );
    }),

  // Tắt xác thực 2FA
  disableTwoFA: (userId) =>
    new Promise((res, rej) => {
      db.run(
        `UPDATE users SET twoFAEnabled = 0, twoFAMethod = NULL, totpSecret = NULL WHERE id = ?`,
        [userId],
        function(err) {
          if (err) rej(err);
          else res({ changes: this.changes });
        }
      );
    }),

  // Lấy mã bí mật TOTP
  getTOTPSecret: (userId) =>
    new Promise((res, rej) => {
      db.get(
        `SELECT totpSecret FROM users WHERE id = ?`,
        [userId],
        (err, row) => {
          if (err) rej(err);
          else res(row?.totpSecret || null);
        }
      );
    }),

  // Xác minh Email
  verifyEmail: (userId) =>
    new Promise((res, rej) => {
      db.run(
        `UPDATE users SET emailVerified = 1 WHERE id = ?`,
        [userId],
        function(err) {
          if (err) rej(err);
          else res({ changes: this.changes });
        }
      );
    }),

  // Lưu OAuth token
  saveOAuthToken: (userId, provider, accessToken, refreshToken, expiresIn) =>
    new Promise((res, rej) => {
      const tokenExpiry = expiresIn ? Date.now() + (expiresIn * 1000) : null;
      db.run(
        `INSERT OR REPLACE INTO oauth_tokens(userId, provider, accessToken, refreshToken, tokenExpiry, createdAt)
          VALUES (?, ?, ?, ?, ?, ?)`,
        [userId, provider, accessToken, refreshToken || null, tokenExpiry, Date.now()],
        function(err) {
          if (err) rej(err);
          else res({ id: this.lastID });
        }
      );
    }),

  // Lấy OAuth token
  getOAuthToken: (userId, provider) =>
    new Promise((res, rej) => {
      db.get(
        `SELECT * FROM oauth_tokens WHERE userId = ? AND provider = ?`,
        [userId, provider],
        (err, row) => {
          if (err) rej(err);
          else res(row || null);
        }
      );
    }),

  // Tạo phiên đăng nhập (session)
  createLoginSession: (userId, token, userAgent, ipAddress, expiresIn = 86400) =>
    new Promise((res, rej) => {
      db.run(
        `INSERT INTO login_sessions(userId, token, userAgent, ipAddress, createdAt, expiresAt, isActive)
          VALUES (?, ?, ?, ?, ?, ?, 1)`,
        [userId, token, userAgent, ipAddress, Date.now(), Date.now() + (expiresIn * 1000)],
        function(err) {
          if (err) rej(err);
          else res({ id: this.lastID });
        }
      );
    }),

  // Lấy phiên đăng nhập
  getLoginSession: (token) =>
    new Promise((res, rej) => {
      db.get(
        `SELECT * FROM login_sessions WHERE token = ? AND isActive = 1 AND expiresAt > ?`,
        [token, Date.now()],
        (err, row) => {
          if (err) rej(err);
          else res(row || null);
        }
      );
    }),

  // Thu hồi phiên đăng nhập
  revokeLoginSession: (token) =>
    new Promise((res, rej) => {
      db.run(
        `UPDATE login_sessions SET isActive = 0 WHERE token = ?`,
        [token],
        function(err) {
          if (err) rej(err);
          else res({ changes: this.changes });
        }
      );
    }),

  // Tạo token đặt lại mật khẩu
  createPasswordResetToken: (userId, resetToken, expiresIn = 3600) =>
    new Promise((res, rej) => {
      db.run(
        `INSERT INTO password_resets(userId, resetToken, expiresAt, createdAt, used)
          VALUES (?, ?, ?, ?, 0)`,
        [userId, resetToken, Date.now() + (expiresIn * 1000), Date.now()],
        function(err) {
          if (err) rej(err);
          else res({ id: this.lastID });
        }
      );
    }),

  // Lấy token đặt lại mật khẩu
  getPasswordResetToken: (resetToken) =>
    new Promise((res, rej) => {
      db.get(
        `SELECT * FROM password_resets WHERE resetToken = ? AND used = 0 AND expiresAt > ?`,
        [resetToken, Date.now()],
        (err, row) => {
          if (err) rej(err);
          else res(row || null);
        }
      );
    }),

  // Đánh dấu token đặt lại mật khẩu đã sử dụng
  markPasswordResetUsed: (resetToken) =>
    new Promise((res, rej) => {
      db.run(
        `UPDATE password_resets SET used = 1 WHERE resetToken = ?`,
        [resetToken],
        function(err) {
          if (err) rej(err);
          else res({ changes: this.changes });
        }
      );
    }),

  // Ghi lại nỗ lực đăng nhập (rate limiting)
  recordLoginAttempt: (email, ipAddress, success) =>
    new Promise((res, rej) => {
      db.run(
        `INSERT INTO login_attempts(email, ipAddress, success, timestamp)
          VALUES (?, ?, ?, ?)`,
        [email.toLowerCase(), ipAddress, success ? 1 : 0, Date.now()],
        function(err) {
          if (err) rej(err);
          else res({ id: this.lastID });
        }
      );
    }),

  // Lấy nỗ lực đăng nhập (trong khoảng thời gian)
  getLoginAttempts: (email, ipAddress, withinMinutes = 15) =>
    new Promise((res, rej) => {
      const timeWindow = Date.now() - (withinMinutes * 60 * 1000);
      db.all(
        `SELECT * FROM login_attempts WHERE email = ? AND ipAddress = ? AND timestamp > ? ORDER BY timestamp DESC`,
        [email.toLowerCase(), ipAddress, timeWindow],
        (err, rows) => {
          if (err) rej(err);
          else res(rows || []);
        }
      );
    }),

  // Lấy phiên người dùng (tất cả các phiên hoạt động)
  getUserSessions: (userId) =>
    new Promise((res, rej) => {
      db.all(
        `SELECT * FROM login_sessions WHERE userId = ? AND isActive = 1 AND expiresAt > ? ORDER BY createdAt DESC`,
        [userId, Date.now()],
        (err, rows) => {
          if (err) rej(err);
          else res(rows || []);
        }
      );
    }),

  // Thu hồi tất cả các phiên người dùng (đăng xuất khỏi tất cả thiết bị)
  revokeAllUserSessions: (userId) =>
    new Promise((res, rej) => {
      db.run(
        `UPDATE login_sessions SET isActive = 0 WHERE userId = ?`,
        [userId],
        function(err) {
          if (err) rej(err);
          else res({ changes: this.changes });
        }
      );
    })
};