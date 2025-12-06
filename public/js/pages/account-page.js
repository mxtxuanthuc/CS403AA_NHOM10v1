document.addEventListener('DOMContentLoaded', () => {
  const profileNameInput = document.getElementById('profileName');
  const profileEmailInput = document.getElementById('profileEmail');
  const profileUsernameInput = document.getElementById('profileUsername');
  const profileForm = document.getElementById('profileForm');
  const passwordForm = document.getElementById('changePasswordForm');
  const profileStatus = document.getElementById('profileStatus');
  const passwordStatus = document.getElementById('passwordStatus');

  let currentProfile = null;

  function loadProfileFromStorage() {
    try {
      const profileRaw = localStorage.getItem('currentUserProfile');
      if (!profileRaw) return;

      currentProfile = JSON.parse(profileRaw);
      if (profileNameInput && currentProfile.fullName) {
        profileNameInput.value = currentProfile.fullName;
      }
      if (profileEmailInput && currentProfile.email) {
        profileEmailInput.value = currentProfile.email;
      }
      if (profileUsernameInput && currentProfile.username) {
        profileUsernameInput.value = currentProfile.username;
      }
    } catch (err) {
      console.warn('Không thể tải thông tin hồ sơ từ localStorage:', err);
    }
  }

  async function updateProfile(e) {
    e.preventDefault();
    if (!currentProfile || !currentProfile.id) {
      loadProfileFromStorage();
    }
    if (!currentProfile || !currentProfile.id) {
      return showStatus(profileStatus, 'Vui lòng đăng nhập lại để cập nhật thông tin', 'error');
    }

    const fullName = (profileNameInput?.value || '').trim();
    if (!fullName) {
      return showStatus(profileStatus, 'Họ và tên không được để trống', 'error');
    }

    try {
      const res = await fetch('/api/profile/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentProfile.id, fullName })
      });
      const data = await res.json();

      if (!data.success) {
        return showStatus(profileStatus, data.message || 'Không thể cập nhật hồ sơ', 'error');
      }

      currentProfile.fullName = data.fullName;
      localStorage.setItem('currentUserProfile', JSON.stringify(currentProfile));
      localStorage.setItem('currentUserName', data.fullName);
      showStatus(profileStatus, '✅ Đã lưu thông tin tài khoản', 'success');
    } catch (error) {
      console.error('Lỗi cập nhật hồ sơ:', error);
      showStatus(profileStatus, 'Không thể cập nhật hồ sơ. Vui lòng thử lại.', 'error');
    }
  }

  async function changePassword(e) {
    e.preventDefault();
    if (!currentProfile || !currentProfile.id) {
      loadProfileFromStorage();
    }
    if (!currentProfile || !currentProfile.id) {
      return showStatus(passwordStatus, 'Vui lòng đăng nhập lại để đổi mật khẩu', 'error');
    }

    const currentPassword = document.getElementById('currentPassword')?.value || '';
    const newPassword = document.getElementById('newPassword')?.value || '';
    const confirmPassword = document.getElementById('confirmNewPassword')?.value || '';

    if (!currentPassword || !newPassword || !confirmPassword) {
      return showStatus(passwordStatus, 'Vui lòng nhập đầy đủ các trường mật khẩu', 'error');
    }

    if (newPassword.length < 6) {
      return showStatus(passwordStatus, 'Mật khẩu mới phải ít nhất 6 ký tự', 'error');
    }

    if (newPassword !== confirmPassword) {
      return showStatus(passwordStatus, 'Mật khẩu mới và xác nhận không khớp', 'error');
    }

    try {
      const res = await fetch('/api/profile/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentProfile.id,
          currentPassword,
          newPassword
        })
      });
      const data = await res.json();

      if (!data.success) {
        return showStatus(passwordStatus, data.message || 'Không thể đổi mật khẩu', 'error');
      }

      document.getElementById('currentPassword').value = '';
      document.getElementById('newPassword').value = '';
      document.getElementById('confirmNewPassword').value = '';
      showStatus(passwordStatus, '✅ Đổi mật khẩu thành công', 'success');
    } catch (error) {
      console.error('Lỗi đổi mật khẩu:', error);
      showStatus(passwordStatus, 'Không thể đổi mật khẩu. Vui lòng thử lại.', 'error');
    }
  }

  loadProfileFromStorage();

  function showStatus(el, message, type) {
    if (!el) {
      alert(message);
      return;
    }
    el.textContent = message;
    el.className = `form-status show ${type}`;
  }

  if (profileForm) {
    profileForm.addEventListener('submit', updateProfile);
    profileForm.addEventListener('click', (e) => {
      if (e.target?.matches('button')) {
        profileForm.requestSubmit?.();
      }
    });
  }

  if (passwordForm) {
    passwordForm.addEventListener('submit', changePassword);
    passwordForm.addEventListener('click', (e) => {
      if (e.target?.matches('button')) {
        passwordForm.requestSubmit?.();
      }
    });
  }
});
