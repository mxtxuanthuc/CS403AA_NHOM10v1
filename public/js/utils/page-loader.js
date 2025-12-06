
const PUBLIC_AUTH_PATHS = [
  '/',
  '/index.html',
  '/pages/login.html',
  '/pages/register.html',
  '/pages/forgot-password.html'
];

function isPublicPage() {
  const path = window.location.pathname;
  return PUBLIC_AUTH_PATHS.some((publicPath) => path === publicPath || path.endsWith(publicPath));
}

function enforceAuthGuard() {
  if (isPublicPage()) {
    return;
  }

  try {
    const profile = localStorage.getItem('currentUserProfile');
    if (!profile) {
      const redirectUrl = `${window.location.pathname}${window.location.search || ''}${window.location.hash || ''}`;
      const encoded = encodeURIComponent(redirectUrl || '/pages/home.html');
      window.location.replace(`/pages/login.html?redirect=${encoded}`);
    }
  } catch (err) {
    console.warn('Không thể kiểm tra phiên đăng nhập:', err);
    window.location.replace('/pages/login.html');
  }
}

class PageLoader {
  constructor() {
    this.isLoading = false;
    this.minLoadTime = 300; // Thời gian loading tối thiểu (ms)
    this.startTime = 0;
    this.init();
  }

  init() {
    // Tạo HTML overlay nếu chưa có
    this.createOverlay();
    
    // Gắn event listener cho tất cả navigation links
    this.attachNavigationListeners();

    // Prevent default behavior cho submit forms
    this.attachFormListeners();
  }

  createOverlay() {
    if (!document.getElementById('pageLoadingOverlay')) {
      const overlay = document.createElement('div');
      overlay.id = 'pageLoadingOverlay';
      overlay.innerHTML = `
        <div class="loading-container">
          <div class="loading-logo">IoT-AI</div>
          <div class="loading-spinner"></div>
          <div class="loading-text">Đang tải dữ liệu</div>
          <div class="loading-progress">
            <div class="loading-progress-bar"></div>
          </div>
        </div>
      `;
      document.body.appendChild(overlay);
    }
  }

  attachNavigationListeners() {
    // Lấy tất cả links trong sidebar
    const navLinks = document.querySelectorAll('.nav-item a, a.nav-btn');
    
    navLinks.forEach(link => {
      link.addEventListener('click', (e) => {
        // Kiểm tra xem link có href không
        const href = link.getAttribute('href');
        
        if (href && !href.startsWith('#') && !href.startsWith('javascript')) {
          e.preventDefault();
          this.showLoading();
          
          // Đặt timeout để đảm bảo loading hiển thị
          setTimeout(() => {
            window.location.href = href;
          }, 100);
        }
      });
    });
  }

  attachFormListeners() {
    // Nếu cần xử lý form submission với loading
    const forms = document.querySelectorAll('form[method="get"]');
    
    forms.forEach(form => {
      form.addEventListener('submit', (e) => {
        const action = form.getAttribute('action');
        if (action && !action.includes('#')) {
          this.showLoading();
        }
      });
    });
  }

  showLoading() {
    if (this.isLoading) return;
    
    this.isLoading = true;
    this.startTime = Date.now();
    
    const overlay = document.getElementById('pageLoadingOverlay');
    if (overlay) {
      overlay.classList.remove('hide');
      overlay.classList.add('active');
      document.body.classList.add('page-loading');
    }
  }

  hideLoading() {
    if (!this.isLoading) return;
    
    // Tính thời gian loading đã qua
    const elapsedTime = Date.now() - this.startTime;
    
    // Nếu loading chưa đủ thời gian minimum, đợi thêm
    const remainingTime = Math.max(0, this.minLoadTime - elapsedTime);
    
    setTimeout(() => {
      const overlay = document.getElementById('pageLoadingOverlay');
      if (overlay) {
        overlay.classList.add('hide');
        
        // Xóa classes sau animation complete
        setTimeout(() => {
          overlay.classList.remove('active', 'hide');
          document.body.classList.remove('page-loading');
          this.isLoading = false;
        }, 300);
      }
    }, remainingTime);
  }

  // Hàm tiện ích để navigate với loading
  navigateTo(url) {
    this.showLoading();
    setTimeout(() => {
      window.location.href = url;
    }, 100);
  }
}

// Khởi tạo PageLoader khi trang load xong
document.addEventListener('DOMContentLoaded', () => {
  enforceAuthGuard();
  window.pageLoader = new PageLoader();
  
  // Tự động ẩn loading khi trang đã load
  window.addEventListener('load', () => {
    window.pageLoader.hideLoading();
  });
  
  // Ẩn loading sau 5 giây nếu chưa load (fallback)
  setTimeout(() => {
    if (window.pageLoader.isLoading) {
      window.pageLoader.hideLoading();
    }
  }, 5000);
});

// Export cho sử dụng toàn cục
if (typeof module !== 'undefined' && module.exports) {
  module.exports = PageLoader;
}
