document.addEventListener('DOMContentLoaded', () => {
  const logoutButton = document.getElementById('btnSidebarLogout');
  if (!logoutButton) return;

  logoutButton.addEventListener('click', async () => {
    if (!confirm('Bạn chắc chắn muốn đăng xuất khỏi IoT-AI Monitor?')) {
      return;
    }

    try {
      // Gọi API logout để xóa session
      const response = await fetch('/api/logout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();
      
      // Xóa dữ liệu local
      localStorage.removeItem('currentUserName');
      sessionStorage.clear();
      
      // Redirect về trang login
      window.location.href = '/pages/login.html';
    } catch (err) {
      console.error('Lỗi đăng xuất:', err);
      // Vẫn redirect về login ngay cả khi có lỗi
      window.location.href = '/pages/login.html';
    }
  });
});
