document.addEventListener('DOMContentLoaded', () => {
  const userEl = document.getElementById('currentUserDisplay');
  const loginBtn = document.getElementById('btnHeaderLogin');

  // Lấy tên user từ bộ nhớ (ưu tiên LocalStorage)
  let name = localStorage.getItem('currentUserName') || sessionStorage.getItem('currentUserName');

  if (userEl && name) {
    // Hiển thị thông tin người dùng
    userEl.innerHTML = `
      <span class="material-icons" style="font-size:16px;vertical-align:middle;">person</span>
      <span style="margin-left:4px;">Xin chào, <strong>${name}</strong></span>
    `;
    
    // Căn chỉnh icon và text trên cùng một hàng
    userEl.style.display = 'inline-flex';
    userEl.style.alignItems = 'center';

    // Ẩn nút đăng nhập vì đã có user
    if (loginBtn) loginBtn.style.display = 'none';
  }
});