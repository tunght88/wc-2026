const SESSION_KEY = 'wc2026_session';

async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

function saveSession(session) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

function getSession() {
  const raw = localStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

function requireAuth(requiredRole) {
  const session = getSession();
  if (!session) {
    window.location.href = getPagePath('login.html');
    return null;
  }
  if (requiredRole === 'ADMIN' && session.role !== 'ADMIN') {
    window.location.href = getPagePath('fixtures.html');
    return null;
  }
  return session;
}

function getPagePath(page) {
  const path = window.location.pathname;
  if (path.includes('/pages/')) {
    return page;
  }
  return 'pages/' + page;
}

function getAssetPath(relativePath) {
  const path = window.location.pathname;
  if (path.includes('/pages/')) {
    return '../' + relativePath;
  }
  return relativePath;
}

function logout() {
  clearSession();
  window.location.href = getPagePath('login.html');
}

function renderNav(activePage) {
  const session = getSession();
  if (!session) return;

  const nav = document.getElementById('main-nav');
  if (!nav) return;

  const items = [
    { href: 'dashboard.html', label: 'Tổng quan', id: 'dashboard' },
    { href: 'fixtures.html', label: 'Lịch thi đấu', id: 'fixtures' },
    { href: 'predictions.html', label: 'Dự đoán', id: 'predictions' },
    { href: 'my-results.html', label: 'Kết quả của tôi', id: 'my-results' },
    { href: 'leaderboard.html', label: 'Bảng xếp hạng', id: 'leaderboard' },
  ];

  if (session.role === 'ADMIN') {
    items.push({ href: 'admin.html', label: 'Admin', id: 'admin' });
  }

  let html = '<div class="nav-links">';
  items.forEach((item) => {
    const active = activePage === item.id ? ' nav-active' : '';
    html += `<a href="${item.href}" class="nav-link${active}">${escapeHtml(item.label)}</a>`;
  });
  html += `<button type="button" id="logout-btn" class="nav-link nav-logout">Đăng xuất</button>`;
  html += '</div>';

  nav.innerHTML = html;

  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', logout);
  }

  const userInfo = document.getElementById('user-info');
  if (userInfo) {
    userInfo.textContent = session.fullName || session.username;
  }
}

function showToast(message, type) {
  const toast = document.getElementById('toast');
  if (!toast) return;

  toast.textContent = message;
  toast.className = 'toast toast-' + (type || 'info') + ' toast-visible';

  setTimeout(() => {
    toast.classList.remove('toast-visible');
  }, 3000);
}

function showLoading(show) {
  const loader = document.getElementById('loading');
  if (loader) {
    loader.classList.toggle('hidden', !show);
  }
}
