// ==========================================
// Railway Management System — App Core
// Shared utilities, API client, auth state
// ==========================================

const API_BASE = 'http://localhost:5000/api';

// ---- Theme Manager ----
const Theme = {
  get() {
    return localStorage.getItem('railway_theme') || 'dark';
  },
  set(theme) {
    localStorage.setItem('railway_theme', theme);
    document.documentElement.setAttribute('data-theme', theme);
    this.updateToggleIcon();
  },
  toggle() {
    const current = this.get();
    this.set(current === 'dark' ? 'light' : 'dark');
  },
  init() {
    const saved = this.get();
    document.documentElement.setAttribute('data-theme', saved);
  },
  updateToggleIcon() {
    const btn = document.getElementById('theme-toggle-btn');
    if (btn) {
      const isDark = this.get() === 'dark';
      btn.innerHTML = isDark ? '' : '';
      btn.title = isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode';
    }
  }
};
// Apply theme immediately (before DOM loads to prevent flash)
Theme.init();

// ---- Auth State ----
const Auth = {
  getToken() {
    return localStorage.getItem('railway_token');
  },
  getUser() {
    const user = localStorage.getItem('railway_user');
    return user ? JSON.parse(user) : null;
  },
  setAuth(token, user) {
    localStorage.setItem('railway_token', token);
    localStorage.setItem('railway_user', JSON.stringify(user));
  },
  logout() {
    localStorage.removeItem('railway_token');
    localStorage.removeItem('railway_user');
    window.location.href = '/pages/login.html';
  },
  isLoggedIn() {
    return !!this.getToken();
  },
  isAdmin() {
    const user = this.getUser();
    return user && user.role === 'admin';
  },
  requireAuth() {
    if (!this.isLoggedIn()) {
      window.location.href = '/pages/login.html';
      return false;
    }
    return true;
  }
};

// ---- API Client ----
const API = {
  async request(endpoint, options = {}) {
    const url = `${API_BASE}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers
    };

    const token = Auth.getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers
      });

      const data = await response.json();

      if (!response.ok) {
        throw { status: response.status, ...data };
      }

      return data;
    } catch (err) {
      if (err.status === 401) {
        Auth.logout();
      }
      throw err;
    }
  },

  get(endpoint) {
    return this.request(endpoint);
  },

  post(endpoint, body) {
    return this.request(endpoint, {
      method: 'POST',
      body: JSON.stringify(body)
    });
  },

  put(endpoint, body) {
    return this.request(endpoint, {
      method: 'PUT',
      body: JSON.stringify(body)
    });
  },

  delete(endpoint) {
    return this.request(endpoint, { method: 'DELETE' });
  }
};

// ---- Toast Notifications ----
const Toast = {
  container: null,

  init() {
    if (!this.container) {
      this.container = document.createElement('div');
      this.container.className = 'toast-container';
      document.body.appendChild(this.container);
    }
  },

  show(message, type = 'info', duration = 4000) {
    this.init();
    const icons = { success: '', error: '', info: '', warning: '' };
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<span>${icons[type] || ''}</span><span>${message}</span>`;
    this.container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100%)';
      toast.style.transition = '0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, duration);
  },

  success(msg) { this.show(msg, 'success'); },
  error(msg) { this.show(msg, 'error'); },
  info(msg) { this.show(msg, 'info'); },
  warning(msg) { this.show(msg, 'warning'); }
};

// ---- Navbar ----
function initNavbar() {
  const user = Auth.getUser();
  const navAuth = document.getElementById('nav-auth');
  const navLinks = document.getElementById('nav-links');

  if (!navAuth) return;

  if (user) {
    // Show user links
    if (navLinks) {
      const isAdmin = user.role === 'admin';
      navLinks.innerHTML = `
        <a href="/index.html" class="${isActivePage('index') ? 'active' : ''}">Home</a>
        <a href="/pages/search.html" class="${isActivePage('search') ? 'active' : ''}">Search Trains</a>
        <a href="/pages/my-bookings.html" class="${isActivePage('my-bookings') ? 'active' : ''}">My Bookings</a>
        <a href="/pages/train-status.html" class="${isActivePage('train-status') ? 'active' : ''}">Train Status</a>
        <a href="/pages/coolie.html" class="${isActivePage('coolie') ? 'active' : ''}">Coolie</a>
        ${isAdmin ? `<a href="/pages/admin.html" class="${isActivePage('admin') ? 'active' : ''}">Admin</a>` : ''}
      `;
    }

    const initials = user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    navAuth.innerHTML = `
      <button class="theme-toggle" id="theme-toggle-btn" onclick="Theme.toggle()" title="Toggle theme"></button>
      <button class="nav-notification-btn" onclick="window.location.href='/pages/notifications.html'" id="nav-notif-btn">
        
        <span class="notification-badge" id="notif-badge" style="display:none">0</span>
      </button>
      <div class="nav-user-menu">
        <button class="nav-user-btn" onclick="toggleUserMenu()">
          <span class="nav-user-avatar">${initials}</span>
          ${user.name.split(' ')[0]}
        </button>
        <div class="nav-dropdown" id="user-dropdown">
          <a href="/pages/my-bookings.html">My Bookings</a>
          <a href="/pages/notifications.html">Notifications</a>
          <div class="divider"></div>
          <button onclick="Auth.logout()">Logout</button>
        </div>
      </div>
    `;

    // Load notification count
    loadNotificationCount();
  } else {
    if (navLinks) {
      navLinks.innerHTML = `
        <a href="/index.html" class="${isActivePage('index') ? 'active' : ''}">Home</a>
      `;
    }
    navAuth.innerHTML = `
      <button class="theme-toggle" id="theme-toggle-btn" onclick="Theme.toggle()" title="Toggle theme"></button>
      <a href="/pages/login.html" class="btn btn-ghost">Login</a>
      <a href="/pages/register.html" class="btn btn-primary btn-sm">Sign Up</a>
    `;
  }

  // Scroll effect
  window.addEventListener('scroll', () => {
    const navbar = document.querySelector('.navbar');
    if (navbar) {
      navbar.classList.toggle('scrolled', window.scrollY > 20);
    }
  });

  // Mobile toggle
  const toggle = document.querySelector('.nav-toggle');
  if (toggle) {
    toggle.addEventListener('click', () => {
      navLinks?.classList.toggle('show');
    });
  }
}

function isActivePage(page) {
  const path = window.location.pathname;
  if (page === 'index') return path === '/' || path.endsWith('index.html');
  return path.includes(page);
}

function toggleUserMenu() {
  const dropdown = document.getElementById('user-dropdown');
  if (dropdown) {
    dropdown.classList.toggle('show');
  }
}

// Close dropdown on outside click
document.addEventListener('click', (e) => {
  if (!e.target.closest('.nav-user-menu')) {
    const dropdown = document.getElementById('user-dropdown');
    if (dropdown) dropdown.classList.remove('show');
  }
});

async function loadNotificationCount() {
  try {
    const data = await API.get('/notifications');
    const badge = document.getElementById('notif-badge');
    if (badge && data.unread_count > 0) {
      badge.textContent = data.unread_count;
      badge.style.display = 'flex';
    }
  } catch (e) {
    // silent
  }
}

// ---- Helpers ----
function formatDate(dateStr) {
  if (!dateStr) return '--';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatTime(timeStr) {
  if (!timeStr) return '--';
  return timeStr.substring(0, 5);
}

function formatCurrency(amount) {
  return `₹${parseFloat(amount).toLocaleString('en-IN')}`;
}

function getStatusBadge(status) {
  const classes = {
    confirmed: 'status-confirmed',
    cancelled: 'status-cancelled',
    waiting: 'status-waiting',
    completed: 'status-completed',
    pending: 'status-waiting'
  };
  const icons = {
    confirmed: '✓',
    cancelled: '✕',
    waiting: '',
    completed: '✓',
    pending: ''
  };
  return `<span class="status-badge ${classes[status] || ''}">${icons[status] || ''} ${status}</span>`;
}

// Init navbar on every page
document.addEventListener('DOMContentLoaded', () => {
  initNavbar();
  Theme.updateToggleIcon();
});
