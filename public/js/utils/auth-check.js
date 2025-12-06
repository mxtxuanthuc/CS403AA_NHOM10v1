// Kiểm tra trạng thái đăng nhập khi tải trang
(async function checkAuth() {
    // Các trang không yêu cầu đăng nhập
    const publicPages = ['/pages/login.html', '/pages/register.html', '/pages/forgot-password.html'];
    const currentPath = window.location.pathname;
    
    // Nếu đang ở trang public, bỏ qua kiểm tra
    if (publicPages.some(page => currentPath.endsWith(page))) {
        return;
    }

    try {
        const response = await fetch('/api/auth/check');
        const data = await response.json();
        
        if (!data.authenticated) {
            // Chưa đăng nhập, redirect về login
            window.location.href = '/pages/login.html';
        }
    } catch (error) {
        console.error('Lỗi kiểm tra xác thực:', error);
        // Nếu có lỗi, redirect về login để an toàn
        window.location.href = '/pages/login.html';
    }
})();
