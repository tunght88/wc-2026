(async function () {
  let session = requireAuth();
  if (!session) return;
  session = await initGroupContext(session);
  if (!session) return;

  renderNav('dashboard');

  let allMatches = [];
  let allPredictions = [];
  let userPredMap = {};
  let activePlayers = [];

  const summaryEl = document.getElementById('dashboard-summary');
  const nextMatchEl = document.getElementById('dashboard-next-match');
  const urgentEl = document.getElementById('dashboard-urgent');
  const quickPredictEl = document.getElementById('dashboard-quick-predict');
  const errorBanner = document.getElementById('error-banner');

  function renderSummary(leaderboardRows, achievements) {
    const rankInfo = getUserLeaderboardRank(leaderboardRows, session.username);
    const row = rankInfo.row;
    const rankText = rankInfo.rank
      ? rankInfo.rank + ' / ' + leaderboardRows.length
      : '-';

    summaryEl.innerHTML =
      '<div class="dashboard-summary wc-card">' +
        '<div class="stats-grid dashboard-stats-grid">' +
          '<div class="stat-card"><div class="stat-value">' + escapeHtml(String(rankText)) + '</div><div class="stat-label">Hạng</div></div>' +
          '<div class="stat-card"><div class="stat-value">' + (row ? row.penalties : '-') + '</div><div class="stat-label">Điểm phạt</div></div>' +
          '<div class="stat-card"><div class="stat-value text-correct">' + (row ? row.correct : 0) + '</div><div class="stat-label">Đúng</div></div>' +
          '<div class="stat-card"><div class="stat-value text-wrong">' + (row ? row.wrong : 0) + '</div><div class="stat-label">Sai</div></div>' +
          '<div class="stat-card"><div class="stat-value">' + achievements.streak + '</div><div class="stat-label">Chuỗi đúng</div></div>' +
        '</div>' +
        (achievements.badges.length
          ? '<div class="dashboard-badges">' + renderAchievementBadges(achievements.badges) + '</div>'
          : '') +
      '</div>';
  }

  function renderNextMatch(match) {
    if (!match) {
      nextMatchEl.innerHTML =
        '<div class="dashboard-next-match wc-card">' +
          '<h2 class="wc-card-title">Trận sắp tới</h2>' +
          '<p class="text-gray-500 text-sm">Không có trận sắp diễn ra</p>' +
        '</div>';
      return;
    }

    const home = match.homeTeam.shortName || match.homeTeam.name;
    const away = match.awayTeam.shortName || match.awayTeam.name;
    const predicted = !!userPredMap[String(match.id)];
    const warnClass = predicted ? '' : ' dashboard-next-match-warn';

    nextMatchEl.innerHTML =
      '<div class="dashboard-next-match wc-card' + warnClass + '">' +
        '<h2 class="wc-card-title">Trận sắp tới</h2>' +
        '<div class="dashboard-next-match-teams">' +
          '<span class="dashboard-team">' + escapeHtml(home) + '</span>' +
          '<span class="dashboard-vs">vs</span>' +
          '<span class="dashboard-team">' + escapeHtml(away) + '</span>' +
        '</div>' +
        '<p class="dashboard-next-match-time">' +
          escapeHtml(formatMatchDate(match.utcDate)) + ' · ' + escapeHtml(formatMatchTime(match.utcDate)) +
        '</p>' +
        '<p class="dashboard-countdown kickoff-countdown" data-kickoff="' + escapeHtml(match.utcDate) + '">' +
          escapeHtml(formatKickoffCountdown(match.utcDate)) +
        '</p>' +
        (predicted
          ? '<p class="dashboard-next-match-status dashboard-status-ok">Đã dự đoán</p>'
          : '<p class="dashboard-next-match-status dashboard-status-warn">Chưa dự đoán — cần dự đoán trước khi trận bắt đầu</p>') +
        '<a href="predictions.html" class="btn btn-secondary btn-sm dashboard-link-btn">Đến trang dự đoán</a>' +
      '</div>';
  }

  function renderUrgent(matches) {
    if (!matches.length) {
      urgentEl.innerHTML = '';
      return;
    }

    let html =
      '<div class="dashboard-urgent wc-card">' +
        '<div class="dashboard-section-header">' +
          '<h2 class="wc-card-title">Cần dự đoán gấp (24h)</h2>' +
          '<a href="predictions.html?pred=not-predicted" class="dashboard-link">Xem tất cả</a>' +
        '</div>' +
        '<ul class="dashboard-urgent-list">';

    matches.forEach(function (match) {
      const home = match.homeTeam.shortName || match.homeTeam.name;
      const away = match.awayTeam.shortName || match.awayTeam.name;
      html +=
        '<li class="dashboard-urgent-item">' +
          '<div class="dashboard-urgent-match">' +
            '<span class="font-semibold">' + escapeHtml(home) + ' vs ' + escapeHtml(away) + '</span>' +
            '<span class="text-xs text-gray-500">' +
              escapeHtml(formatMatchDate(match.utcDate)) + ' ' + escapeHtml(formatMatchTime(match.utcDate)) +
            '</span>' +
          '</div>' +
          '<span class="badge badge-countdown" data-kickoff="' + escapeHtml(match.utcDate) + '">' +
            escapeHtml(formatLockCountdown(match.utcDate)) +
          '</span>' +
        '</li>';
    });

    html += '</ul></div>';
    urgentEl.innerHTML = html;
  }

  function renderQuickPredict(matches) {
    if (!matches.length) {
      quickPredictEl.innerHTML =
        '<div class="dashboard-quick-predict wc-card">' +
          '<h2 class="wc-card-title">Dự đoán nhanh</h2>' +
          '<p class="text-gray-500 text-sm">Bạn đã dự đoán hết các trận sắp tới. Tuyệt vời!</p>' +
        '</div>';
      return;
    }

    let html =
      '<div class="dashboard-quick-predict wc-card">' +
        '<h2 class="wc-card-title">Dự đoán nhanh</h2>' +
        '<p class="text-gray-600 text-sm mb-4">Chọn nhanh cho ' + matches.length + ' trận sắp tới</p>';

    matches.forEach(function (match) {
      const home = match.homeTeam.shortName || match.homeTeam.name;
      const away = match.awayTeam.shortName || match.awayTeam.name;
      html +=
        '<div class="dashboard-quick-card" data-match-id="' + escapeHtml(String(match.id)) + '">' +
          '<div class="dashboard-quick-header">' +
            '<span class="font-semibold">' + escapeHtml(home) + ' vs ' + escapeHtml(away) + '</span>' +
            '<span class="badge badge-countdown" data-kickoff="' + escapeHtml(match.utcDate) + '">' +
              escapeHtml(formatLockCountdown(match.utcDate)) +
            '</span>' +
          '</div>' +
          '<div class="prediction-options prediction-options-compact">' +
            '<label class="prediction-option">' +
              '<input type="radio" name="quick-pred-' + match.id + '" value="HOME">' +
              '<span>' + escapeHtml(home) + '</span>' +
            '</label>' +
            '<label class="prediction-option">' +
              '<input type="radio" name="quick-pred-' + match.id + '" value="DRAW">' +
              '<span>Hòa</span>' +
            '</label>' +
            '<label class="prediction-option">' +
              '<input type="radio" name="quick-pred-' + match.id + '" value="AWAY">' +
              '<span>' + escapeHtml(away) + '</span>' +
            '</label>' +
          '</div>' +
          '<button type="button" class="btn btn-primary btn-sm btn-quick-save" data-match-id="' +
            escapeHtml(String(match.id)) + '">Lưu</button>' +
        '</div>';
    });

    html += '</div>';
    quickPredictEl.innerHTML = html;

    quickPredictEl.querySelectorAll('.btn-quick-save').forEach(function (btn) {
      btn.addEventListener('click', handleQuickSave);
    });
  }

  async function handleQuickSave(e) {
    const matchId = e.target.dataset.matchId;
    const radio = document.querySelector('input[name="quick-pred-' + matchId + '"]:checked');

    if (!radio) {
      showToast('Vui lòng chọn dự đoán', 'error');
      return;
    }

    const btn = e.target;
    btn.disabled = true;
    btn.textContent = 'Đang lưu...';

    try {
      await savePrediction(
        session.username,
        session.passwordHash,
        getCurrentGroupId(),
        matchId,
        radio.value
      );
      userPredMap[matchId] = radio.value;
      allPredictions = allPredictions.filter(function (p) {
        return !(p.username === session.username && String(p.matchId) === String(matchId));
      });
      allPredictions.push({
        username: session.username,
        matchId: matchId,
        prediction: radio.value,
      });
      showToast('Đã lưu dự đoán', 'success');
      refreshDashboard();
    } catch (err) {
      showToast(err.message || 'Lưu thất bại', 'error');
      btn.disabled = false;
      btn.textContent = 'Lưu';
    }
  }

  function refreshDashboard() {
    const groupStart = getCurrentGroupStartDate();
    const groupMatches = filterMatchesForGroup(allMatches, groupStart);
    const leaderboardRows = computeLeaderboard(
      activePlayers,
      allPredictions,
      allMatches,
      groupStart
    );
    const achievements = computeUserAchievements(
      session.username,
      allPredictions,
      groupMatches,
      activePlayers
    );
    const nextMatch = getNextUpcomingMatch(allMatches);
    const urgent = getUpcomingUnpredicted(allMatches, userPredMap, 24, groupStart);
    const quickMatches = sortMatchesByDate(
      allMatches.filter(function (m) {
        return isMatchOpenForPrediction(m, groupStart) && !userPredMap[String(m.id)];
      })
    ).slice(0, 5);

    renderSummary(leaderboardRows, achievements);
    renderNextMatch(nextMatch);
    renderUrgent(urgent);
    renderQuickPredict(quickMatches);
    renderReminderBanner(allMatches, userPredMap);
    startCountdownTicker();
  }

  async function init() {
    showLoading(true);

    try {
      const [matches, predResult] = await Promise.all([
        getMatches(),
        getPredictions(session.username, session.passwordHash, getCurrentGroupId()),
      ]);

      allMatches = matches;
      allPredictions = predResult.predictions || [];
      activePlayers = getActivePlayers(predResult.activeUsers || []);
      userPredMap = buildUserPredictionMap(allPredictions, session.username);

      refreshDashboard();
    } catch (err) {
      errorBanner.textContent = err.message || 'Không thể tải dữ liệu';
      errorBanner.classList.remove('hidden');
    } finally {
      showLoading(false);
    }
  }

  init();
})();
