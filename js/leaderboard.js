(async function () {
  let session = requireAuth();
  if (!session) return;
  session = await initGroupContext(session);
  if (!session) return;

  renderNav('leaderboard');

  const leaderboardContainer = document.getElementById('leaderboard-container');
  const errorBanner = document.getElementById('error-banner');

  function renderPenaltyLegend() {
    let html =
      '<div class="leaderboard-legend wc-card">' +
        '<div class="wc-card-title">Quy tắc điểm phạt</div>' +
        '<p class="leaderboard-legend-desc">Dự đoán <strong>sai</strong> hoặc <strong>không dự đoán</strong> sẽ cộng điểm phạt theo vòng đấu. ' +
        'Xếp hạng theo <strong>điểm phạt thấp nhất</strong> (đúng = 0 điểm phạt).</p>' +
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

  function renderLeaderboard(rows, predictions, matches, players) {
    if (rows.length === 0) {
      leaderboardContainer.innerHTML =
        renderPenaltyLegend() +
        '<div class="empty-state">' +
          '<div class="empty-state-icon">🏆</div>' +
          '<p>Chưa có dữ liệu bảng xếp hạng</p>' +
        '</div>';
      return;
    }

    const knockoutLeader = computeKnockoutLeader(players, predictions, matches);
    let html = renderPenaltyLegend() + renderKnockoutLeaderCallout(knockoutLeader);

    html +=
      '<div class="wc-card">' +
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
        matches,
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

  async function init() {
    showLoading(true);

    try {
      const [matches, predResult] = await Promise.all([
        getMatches(),
        getPredictions(session.username, session.passwordHash, getCurrentGroupId()),
      ]);

      const players = getActivePlayers(predResult.activeUsers || []);
      const predictions = predResult.predictions || [];

      const rows = computeLeaderboard(players, predictions, matches);

      renderLeaderboard(rows, predictions, matches, players);
      initReminderBanner(session, {
        matches: matches,
        userPredMap: buildUserPredictionMap(predictions, session.username),
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
