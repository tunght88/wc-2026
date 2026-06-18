(function () {
  const session = requireAuth('ADMIN');
  if (!session) return;

  renderNav('admin');

  let allUsers = [];
  let allPredictions = [];
  let allMatches = [];
  const matchMap = {};

  const usersTable = document.getElementById('users-table');
  const predictionsTable = document.getElementById('predictions-table');
  const missingPredictionsTable = document.getElementById('missing-predictions-table');
  const errorBanner = document.getElementById('error-banner');
  const createUserForm = document.getElementById('create-user-form');
  const exportCsvBtn = document.getElementById('export-csv-btn');
  const syncMatchesBtn = document.getElementById('sync-matches-btn');
  const syncMatchesStatus = document.getElementById('sync-matches-status');

  function renderUsersTable() {
    if (allUsers.length === 0) {
      usersTable.innerHTML = '<p class="text-gray-500 text-sm">Chưa có user nào</p>';
      return;
    }

    let html =
      '<div class="table-wrapper">' +
        '<table class="data-table">' +
          '<thead><tr>' +
            '<th>Username</th>' +
            '<th>Họ tên</th>' +
            '<th>Role</th>' +
            '<th>Trạng thái</th>' +
            '<th>Thao tác</th>' +
          '</tr></thead><tbody>';

    allUsers.forEach(function (user) {
      const statusBadge = user.active
        ? '<span class="badge badge-correct">Active</span>'
        : '<span class="badge badge-wrong">Locked</span>';

      html +=
        '<tr>' +
          '<td>' + escapeHtml(user.username) + '</td>' +
          '<td>' + escapeHtml(user.fullName) + '</td>' +
          '<td>' + escapeHtml(user.role) + '</td>' +
          '<td>' + statusBadge + '</td>' +
          '<td class="admin-actions">' +
            '<button type="button" class="btn btn-secondary btn-sm btn-reset-pw" data-username="' + escapeHtml(user.username) + '">Reset MK</button>' +
            '<button type="button" class="btn btn-danger btn-sm btn-toggle-status" data-username="' + escapeHtml(user.username) + '" data-active="' + user.active + '">' +
              (user.active ? 'Khóa' : 'Mở khóa') +
            '</button>' +
          '</td>' +
        '</tr>';
    });

    html += '</tbody></table></div>';
    usersTable.innerHTML = html;

    usersTable.querySelectorAll('.btn-reset-pw').forEach(function (btn) {
      btn.addEventListener('click', handleResetPassword);
    });

    usersTable.querySelectorAll('.btn-toggle-status').forEach(function (btn) {
      btn.addEventListener('click', handleToggleStatus);
    });
  }

  function renderPredictionsTable() {
    if (allPredictions.length === 0) {
      predictionsTable.innerHTML = '<p class="text-gray-500 text-sm">Chưa có dự đoán nào</p>';
      return;
    }

    let html =
      '<div class="table-wrapper">' +
        '<table class="data-table">' +
          '<thead><tr>' +
            '<th>Username</th>' +
            '<th>Họ tên</th>' +
            '<th>Trận đấu</th>' +
            '<th>Dự đoán</th>' +
            '<th>Cập nhật</th>' +
          '</tr></thead><tbody>';

    allPredictions.forEach(function (pred) {
      const match = matchMap[pred.matchId];
      let matchLabel = 'Match #' + pred.matchId;
      let predLabel = pred.prediction;

      if (match) {
        matchLabel =
          (match.homeTeam.shortName || match.homeTeam.name) +
          ' vs ' +
          (match.awayTeam.shortName || match.awayTeam.name);
        predLabel = getPredictionLabel(pred.prediction, match);
      }

      html +=
        '<tr>' +
          '<td>' + escapeHtml(pred.username) + '</td>' +
          '<td>' + escapeHtml(pred.fullName) + '</td>' +
          '<td>' + escapeHtml(matchLabel) + '</td>' +
          '<td>' + escapeHtml(predLabel) + '</td>' +
          '<td>' + escapeHtml(formatDateTime(pred.updatedAt)) + '</td>' +
        '</tr>';
    });

    html += '</tbody></table></div>';
    predictionsTable.innerHTML = html;
  }

  function renderMissingPredictionsTable(items) {
    if (!items || items.length === 0) {
      missingPredictionsTable.innerHTML =
        '<p class="text-gray-500 text-sm">Tất cả người chơi đã dự đoán các trận sắp tới</p>';
      return;
    }

    let html =
      '<div class="table-wrapper">' +
        '<table class="data-table">' +
          '<thead><tr>' +
            '<th>Trận đấu</th>' +
            '<th>Thời gian</th>' +
            '<th>Đã dự đoán</th>' +
            '<th>Chưa dự đoán</th>' +
          '</tr></thead><tbody>';

    items.forEach(function (item) {
      const matchLabel = item.homeTeam + ' vs ' + item.awayTeam;
      const missingNames = (item.missing || [])
        .map(function (user) {
          return user.fullName || user.username;
        })
        .join(', ');

      html +=
        '<tr>' +
          '<td>' + escapeHtml(matchLabel) + '</td>' +
          '<td>' + escapeHtml(formatDateTime(item.utcDate)) + '</td>' +
          '<td>' + escapeHtml(String(item.predictedCount) + '/' + item.expectedCount) + '</td>' +
          '<td class="missing-predictions-cell">' + escapeHtml(missingNames) + '</td>' +
        '</tr>';
    });

    html += '</tbody></table></div>';
    missingPredictionsTable.innerHTML = html;
  }

  async function handleSyncMatches() {
    syncMatchesBtn.disabled = true;
    syncMatchesBtn.textContent = 'Đang đồng bộ...';
    syncMatchesStatus.textContent = '';

    try {
      const result = await syncMatches(
        session.username,
        session.passwordHash,
        WC_COMPETITION_CODE,
        WC_SEASON
      );
      const sync = result.sync || {};
      syncMatchesStatus.textContent =
        'Đã đồng bộ ' + (sync.total || 0) + ' trận (' +
        (sync.added || 0) + ' mới, ' + (sync.updated || 0) + ' cập nhật).';
      showToast('Đồng bộ trận đấu thành công', 'success');
    } catch (err) {
      showToast(err.message || 'Đồng bộ thất bại', 'error');
    } finally {
      syncMatchesBtn.disabled = false;
      syncMatchesBtn.textContent = 'Đồng bộ về Sheets';
    }
  }

  async function loadMissingPredictions() {
    const result = await getMissingPredictions(
      session.username,
      session.passwordHash,
      WC_COMPETITION_CODE,
      WC_SEASON
    );
    renderMissingPredictionsTable(result.items || []);
  }

  function formatDateTime(iso) {
    if (!iso) return '';
    try {
      return new Date(iso).toLocaleString('vi-VN');
    } catch {
      return iso;
    }
  }

  async function handleCreateUser(e) {
    e.preventDefault();

    const username = document.getElementById('new-username').value.trim();
    const fullName = document.getElementById('new-fullname').value.trim();
    const password = document.getElementById('new-password').value;
    const role = document.getElementById('new-role').value;

    if (!username || !fullName || !password) {
      showToast('Vui lòng nhập đầy đủ thông tin', 'error');
      return;
    }

    try {
      const passwordHash = await hashPassword(password);
      await createUser(session.username, session.passwordHash, {
        username: username,
        passwordHash: passwordHash,
        fullName: fullName,
        role: role,
      });
      showToast('Đã tạo user thành công', 'success');
      createUserForm.reset();
      await loadUsers();
    } catch (err) {
      showToast(err.message || 'Tạo user thất bại', 'error');
    }
  }

  async function handleResetPassword(e) {
    const targetUsername = e.target.dataset.username;
    const newPassword = prompt('Nhập mật khẩu mới cho ' + targetUsername + ':');
    if (!newPassword) return;

    try {
      const newPasswordHash = await hashPassword(newPassword);
      await resetPassword(
        session.username,
        session.passwordHash,
        targetUsername,
        newPasswordHash
      );
      showToast('Đã reset mật khẩu cho ' + targetUsername, 'success');
    } catch (err) {
      showToast(err.message || 'Reset thất bại', 'error');
    }
  }

  async function handleToggleStatus(e) {
    const targetUsername = e.target.dataset.username;
    const isActive = e.target.dataset.active === 'true';
    const action = isActive ? 'khóa' : 'mở khóa';

    if (!confirm('Bạn có chắc muốn ' + action + ' user ' + targetUsername + '?')) return;

    try {
      await toggleUserStatus(session.username, session.passwordHash, targetUsername);
      showToast('Đã ' + action + ' user ' + targetUsername, 'success');
      await loadUsers();
    } catch (err) {
      showToast(err.message || 'Thao tác thất bại', 'error');
    }
  }

  function exportCsv() {
    if (allPredictions.length === 0) {
      showToast('Không có dữ liệu để xuất', 'error');
      return;
    }

    const headers = ['username', 'full_name', 'match_id', 'match', 'prediction', 'updated_at'];
    const rows = [headers.join(',')];

    allPredictions.forEach(function (pred) {
      const match = matchMap[pred.matchId];
      let matchLabel = '';
      if (match) {
        matchLabel =
          (match.homeTeam.name || '') + ' vs ' + (match.awayTeam.name || '');
      }

      rows.push([
        csvEscape(pred.username),
        csvEscape(pred.fullName),
        csvEscape(pred.matchId),
        csvEscape(matchLabel),
        csvEscape(pred.prediction),
        csvEscape(pred.updatedAt),
      ].join(','));
    });

    const blob = new Blob(['\uFEFF' + rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'wc2026_predictions_' + new Date().toISOString().slice(0, 10) + '.csv';
    link.click();
    URL.revokeObjectURL(link.href);
    showToast('Đã xuất CSV', 'success');
  }

  function csvEscape(value) {
    const str = String(value || '');
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return '"' + str.replace(/"/g, '""') + '"';
    }
    return str;
  }

  async function loadUsers() {
    const result = await getUsers(session.username, session.passwordHash);
    allUsers = result.users || [];
    renderUsersTable();
  }

  async function loadPredictions() {
    const result = await getPredictions(session.username, session.passwordHash);
    allPredictions = result.predictions || [];
    renderPredictionsTable();
  }

  async function init() {
    showLoading(true);

    try {
      allMatches = await getMatches();
      allMatches.forEach(function (m) {
        matchMap[String(m.id)] = m;
      });

      await Promise.all([loadUsers(), loadPredictions(), loadMissingPredictions()]);
    } catch (err) {
      errorBanner.textContent = err.message || 'Không thể tải dữ liệu admin';
      errorBanner.classList.remove('hidden');
    } finally {
      showLoading(false);
    }
  }

  createUserForm.addEventListener('submit', handleCreateUser);
  exportCsvBtn.addEventListener('click', exportCsv);
  syncMatchesBtn.addEventListener('click', handleSyncMatches);
  init();
})();
