(function () {
  const session = requireAuth();
  if (!session) return;

  renderNav('leaderboard');

  const leaderboardContainer = document.getElementById('leaderboard-container');
  const errorBanner = document.getElementById('error-banner');

  function computeLeaderboard(activeUsers, predictions, matchMap) {
    const scores = {};

    activeUsers.forEach(function (user) {
      scores[user.username] = {
        username: user.username,
        fullName: user.fullName,
        points: 0,
        correct: 0,
        total: 0,
      };
    });

    predictions.forEach(function (pred) {
      const match = matchMap[pred.matchId];
      if (!match || match.status !== 'FINISHED') return;

      if (!scores[pred.username]) {
        scores[pred.username] = {
          username: pred.username,
          fullName: pred.fullName || pred.username,
          points: 0,
          correct: 0,
          total: 0,
        };
      }

      const actual = getActualResult(match);
      if (!actual) return;

      scores[pred.username].total++;
      if (pred.prediction === actual) {
        scores[pred.username].points++;
        scores[pred.username].correct++;
      }
    });

    return Object.values(scores).sort(function (a, b) {
      if (b.points !== a.points) return b.points - a.points;
      if (b.correct !== a.correct) return b.correct - a.correct;
      return a.fullName.localeCompare(b.fullName, 'vi');
    });
  }

  function renderLeaderboard(rows) {
    if (rows.length === 0) {
      leaderboardContainer.innerHTML =
        '<div class="empty-state">' +
          '<div class="empty-state-icon">🏆</div>' +
          '<p>Chưa có dữ liệu bảng xếp hạng</p>' +
        '</div>';
      return;
    }

    let html =
      '<div class="wc-card">' +
        '<div class="table-wrapper">' +
          '<table class="data-table">' +
            '<thead><tr>' +
              '<th class="rank-col">Hạng</th>' +
              '<th>Tên</th>' +
              '<th>Điểm</th>' +
              '<th>Số trận đúng</th>' +
              '<th>Số trận đã dự đoán</th>' +
            '</tr></thead><tbody>';

    rows.forEach(function (row, index) {
      const rank = index + 1;
      const medal = rank === 1 ? '🥇 ' : rank === 2 ? '🥈 ' : rank === 3 ? '🥉 ' : '';
      html +=
        '<tr>' +
          '<td class="rank-col">' + medal + rank + '</td>' +
          '<td class="font-semibold">' + escapeHtml(row.fullName) + '</td>' +
          '<td><strong>' + row.points + '</strong></td>' +
          '<td>' + row.correct + '</td>' +
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
        getPredictions(session.username, session.passwordHash),
      ]);

      const matchMap = {};
      matches.forEach(function (m) {
        matchMap[String(m.id)] = m;
      });

      const rows = computeLeaderboard(
        predResult.activeUsers || [],
        predResult.predictions || [],
        matchMap
      );

      renderLeaderboard(rows);
    } catch (err) {
      errorBanner.textContent = err.message || 'Không thể tải bảng xếp hạng';
      errorBanner.classList.remove('hidden');
    } finally {
      showLoading(false);
    }
  }

  init();
})();
