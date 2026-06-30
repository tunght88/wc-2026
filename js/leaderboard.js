(async function () {
  let session = requireAuth();
  if (!session) return;
  session = await initGroupContext(session);
  if (!session) return;

  renderNav('leaderboard');

  let allMatches = [];
  let allPredictions = [];
  let allPlayers = [];
  let selectedStageKeys = getAllLeaderboardStageFilterKeys().slice();

  const stageFilterBar = document.getElementById('stage-filter-bar');
  const leaderboardContainer = document.getElementById('leaderboard-container');
  const errorBanner = document.getElementById('error-banner');

  function renderPenaltyLegend() {
    let html =
      '<div class="leaderboard-legend wc-card">' +
        '<div class="wc-card-title">Quy tắc điểm phạt</div>' +
        '<p class="leaderboard-legend-desc">Dự đoán <strong>sai</strong> hoặc <strong>không dự đoán</strong> sẽ cộng điểm phạt theo vòng đấu. ' +
        'Xếp hạng theo <strong>điểm phạt thấp nhất</strong> (đúng = 0 điểm phạt).</p>' +
        '<p class="leaderboard-legend-desc hope-star-legend-inline">' +
        '⭐ <strong>Ngôi sao hy vọng</strong>: mỗi trận có thể gắn — đúng <strong>−×2 điểm phạt</strong>, sai <strong>+×2 điểm phạt</strong>.' +
        '</p>' +
        '<div class="table-wrapper">' +
          '<table class="data-table penalty-legend-table">' +
            '<thead><tr><th>Vòng đấu</th><th>Điểm phạt</th></tr></thead><tbody>';

    STAGE_PENALTY_LEGEND.forEach(function (item) {
      html +=
        '<tr>' +
          '<td>' + escapeHtml(item.label) + '</td>' +
          '<td><strong>+' + item.penalty + '</strong></td>' +
        '</tr>';
    });

    html += '</tbody></table></div></div>';
    return html;
  }

  function renderKnockoutLeaderCallout(leader) {
    if (!leader) return '';
    return (
      '<div class="knockout-leader-callout wc-card">' +
        '<span class="knockout-leader-label">Vua knock-out:</span> ' +
        '<strong>' + escapeHtml(leader.fullName) + '</strong> ' +
        '<span class="knockout-leader-score">(' + leader.correct + ' đúng)</span>' +
      '</div>'
    );
  }

  function renderStageFilters() {
    let html =
      '<button type="button" class="filter-btn filter-btn-sm" data-stage-action="all">Tất cả</button>' +
      '<button type="button" class="filter-btn filter-btn-sm" data-stage-action="none">Bỏ chọn</button>';

    LEADERBOARD_STAGE_FILTERS.forEach(function (filter) {
      const active = selectedStageKeys.indexOf(filter.key) !== -1 ? ' active' : '';
      html +=
        '<button type="button" class="filter-btn filter-btn-multi' + active + '" data-stage-key="' +
          escapeHtml(filter.key) + '">' + escapeHtml(filter.label) + '</button>';
    });

    stageFilterBar.innerHTML = html;

    stageFilterBar.querySelectorAll('[data-stage-action]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (btn.dataset.stageAction === 'all') {
          selectedStageKeys = getAllLeaderboardStageFilterKeys().slice();
        } else {
          selectedStageKeys = [];
        }
        renderStageFilters();
        refreshLeaderboard();
      });
    });

    stageFilterBar.querySelectorAll('[data-stage-key]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const key = btn.dataset.stageKey;
        const index = selectedStageKeys.indexOf(key);
        if (index === -1) {
          selectedStageKeys.push(key);
        } else {
          selectedStageKeys.splice(index, 1);
        }
        renderStageFilters();
        refreshLeaderboard();
      });
    });
  }

  function renderLeaderboardTable(rows, predictions, matches, players) {
    const groupMatches = filterMatchesForGroup(matches, getCurrentGroupStartDate());
    const stageSummary = getLeaderboardStageFilterSummary(selectedStageKeys);
    const isFiltered = selectedStageKeys.length < getAllLeaderboardStageFilterKeys().length;

    if (!selectedStageKeys.length) {
      leaderboardContainer.innerHTML =
        renderPenaltyLegend() +
        '<div class="empty-state">' +
          '<div class="empty-state-icon">🏆</div>' +
          '<p>Chọn ít nhất một vòng để xem bảng xếp hạng</p>' +
        '</div>';
      return;
    }

    if (rows.length === 0) {
      leaderboardContainer.innerHTML =
        renderPenaltyLegend() +
        '<div class="empty-state">' +
          '<div class="empty-state-icon">🏆</div>' +
          '<p>Chưa có dữ liệu cho vòng đã chọn</p>' +
        '</div>';
      return;
    }

    const knockoutLeader = computeKnockoutLeader(players, predictions, matches);
    let html = renderPenaltyLegend() + renderKnockoutLeaderCallout(knockoutLeader);

    html +=
      '<div class="wc-card">' +
        (isFiltered
          ? '<p class="leaderboard-filter-summary">Đang xem: <strong>' + escapeHtml(stageSummary) + '</strong></p>'
          : '') +
        '<div class="table-wrapper">' +
          '<table class="data-table">' +
            '<thead><tr>' +
              '<th class="rank-col">Hạng</th>' +
              '<th>Tên</th>' +
              '<th>Điểm phạt</th>' +
              '<th>Streak</th>' +
              '<th>Thành tích</th>' +
              '<th>Đúng</th>' +
              '<th>Sai</th>' +
              '<th>Chưa dự đoán</th>' +
              '<th>Trận đã tính</th>' +
            '</tr></thead><tbody>';

    rows.forEach(function (row, index) {
      const rank = index + 1;
      const medal = rank === 1 ? '🥇 ' : rank === 2 ? '🥈 ' : rank === 3 ? '🥉 ' : '';
      const achievements = computeUserAchievements(
        row.username,
        predictions,
        groupMatches,
        players
      );

      html +=
        '<tr>' +
          '<td class="rank-col">' + medal + rank + '</td>' +
          '<td class="font-semibold">' + escapeHtml(row.fullName) + '</td>' +
          '<td><strong class="penalty-score">' + row.penalties + '</strong></td>' +
          '<td>' + achievements.streak + '</td>' +
          '<td>' + renderAchievementBadges(achievements.badges) + '</td>' +
          '<td class="text-correct">' + row.correct + '</td>' +
          '<td class="text-wrong">' + row.wrong + '</td>' +
          '<td>' + row.missed + '</td>' +
          '<td>' + row.total + '</td>' +
        '</tr>';
    });

    html += '</tbody></table></div></div>';
    leaderboardContainer.innerHTML = html;
  }

  function refreshLeaderboard() {
    const rows = computeLeaderboard(
      allPlayers,
      allPredictions,
      allMatches,
      getCurrentGroupStartDate(),
      selectedStageKeys
    );
    renderLeaderboardTable(rows, allPredictions, allMatches, allPlayers);
  }

  async function init() {
    showLoading(true);
    renderStageFilters();

    try {
      const [matches, predResult] = await Promise.all([
        getMatches(),
        getPredictions(session.username, session.passwordHash, getCurrentGroupId()),
      ]);

      allMatches = matches;
      allPlayers = getActivePlayers(predResult.activeUsers || []);
      allPredictions = predResult.predictions || [];

      refreshLeaderboard();
      initReminderBanner(session, {
        matches: matches,
        userPredMap: buildUserPredictionMap(allPredictions, session.username),
      });
    } catch (err) {
      errorBanner.textContent = err.message || 'Không thể tải bảng xếp hạng';
      errorBanner.classList.remove('hidden');
    } finally {
      showLoading(false);
    }
  }

  init();
})();
