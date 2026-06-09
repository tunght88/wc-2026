(function () {
  const session = requireAuth();
  if (!session) return;

  renderNav('my-results');

  const resultsContainer = document.getElementById('results-container');
  const statsContainer = document.getElementById('stats-container');
  const errorBanner = document.getElementById('error-banner');

  function renderStats(stats) {
    statsContainer.innerHTML =
      '<div class="stats-grid">' +
        '<div class="stat-card"><div class="stat-value">' + stats.total + '</div><div class="stat-label">Đã dự đoán</div></div>' +
        '<div class="stat-card"><div class="stat-value">' + stats.finished + '</div><div class="stat-label">Trận đã kết thúc</div></div>' +
        '<div class="stat-card"><div class="stat-value">' + stats.correct + '</div><div class="stat-label">Dự đoán đúng</div></div>' +
        '<div class="stat-card"><div class="stat-value">' + stats.points + '</div><div class="stat-label">Điểm</div></div>' +
      '</div>';
  }

  function renderResults(rows) {
    if (rows.length === 0) {
      resultsContainer.innerHTML =
        '<div class="empty-state">' +
          '<div class="empty-state-icon">📊</div>' +
          '<p>Bạn chưa dự đoán trận nào</p>' +
        '</div>';
      return;
    }

    let html =
      '<div class="table-wrapper">' +
        '<table class="data-table">' +
          '<thead><tr>' +
            '<th>Trận đấu</th>' +
            '<th>Dự đoán của tôi</th>' +
            '<th>Kết quả thực tế</th>' +
            '<th>Đúng/Sai</th>' +
          '</tr></thead><tbody>';

    rows.forEach(function (row) {
      html +=
        '<tr>' +
          '<td>' +
            '<div class="font-semibold">' + escapeHtml(row.matchLabel) + '</div>' +
            '<div class="text-xs text-gray-500">' + escapeHtml(row.date) + '</div>' +
          '</td>' +
          '<td>' + escapeHtml(row.myPrediction) + '</td>' +
          '<td>' + escapeHtml(row.actualResult) + '</td>' +
          '<td>' + row.resultBadge + '</td>' +
        '</tr>';
    });

    html += '</tbody></table></div>';
    resultsContainer.innerHTML = html;
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

      const myPreds = (predResult.predictions || []).filter(function (p) {
        return p.username === session.username;
      });

      const stats = { total: myPreds.length, finished: 0, correct: 0, points: 0 };
      const rows = [];

      myPreds.forEach(function (pred) {
        const match = matchMap[pred.matchId];
        if (!match) return;

        const actual = getActualResult(match);
        const myLabel = getPredictionLabel(pred.prediction, match);
        let actualLabel = 'Chưa có kết quả';
        let resultBadge = '<span class="badge badge-pending">Chờ kết quả</span>';

        if (actual) {
          stats.finished++;
          actualLabel = getPredictionLabel(actual, match);
          if (pred.prediction === actual) {
            stats.correct++;
            stats.points++;
            resultBadge = '<span class="badge badge-correct">✓ Đúng</span>';
          } else {
            resultBadge = '<span class="badge badge-wrong">✗ Sai</span>';
          }
        }

        rows.push({
          matchLabel:
            (match.homeTeam.shortName || match.homeTeam.name) +
            ' vs ' +
            (match.awayTeam.shortName || match.awayTeam.name),
          date: formatMatchDate(match.utcDate) + ' ' + formatMatchTime(match.utcDate),
          myPrediction: myLabel,
          actualResult: actualLabel,
          resultBadge: resultBadge,
          sortDate: new Date(match.utcDate).getTime(),
        });
      });

      rows.sort(function (a, b) {
        return a.sortDate - b.sortDate;
      });

      renderStats(stats);
      renderResults(rows);
    } catch (err) {
      errorBanner.textContent = err.message || 'Không thể tải dữ liệu';
      errorBanner.classList.remove('hidden');
    } finally {
      showLoading(false);
    }
  }

  init();
})();
