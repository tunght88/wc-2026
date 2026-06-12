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
        '<div class="stat-card"><div class="stat-value">' + stats.penalties + '</div><div class="stat-label">Điểm phạt</div></div>' +
        '<div class="stat-card"><div class="stat-value">' + stats.wrong + '</div><div class="stat-label">Sai</div></div>' +
        '<div class="stat-card"><div class="stat-value">' + stats.missed + '</div><div class="stat-label">Chưa dự đoán</div></div>' +
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
            '<th>Phạt</th>' +
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
          '<td>' + escapeHtml(row.penaltyLabel) + '</td>' +
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

      const stats = { total: myPreds.length, finished: 0, correct: 0, wrong: 0, missed: 0, penalties: 0 };
      const rows = [];
      const myPredMap = {};

      myPreds.forEach(function (pred) {
        myPredMap[String(pred.matchId)] = pred.prediction;
      });

      getFinishedMatchesWithResult(matches).forEach(function (match) {
        const matchId = String(match.id);
        const prediction = myPredMap[matchId];
        const penalty = getStagePenalty(match.stage);

        stats.finished++;
        if (!prediction) {
          stats.missed++;
          stats.penalties += penalty;
        } else {
          const actual = getActualResult(match);
          if (prediction === actual) {
            stats.correct++;
          } else {
            stats.wrong++;
            stats.penalties += penalty;
          }
        }
      });

      myPreds.forEach(function (pred) {
        const match = matchMap[pred.matchId];
        if (!match) return;

        const actual = getActualResult(match);
        const myLabel = getPredictionLabel(pred.prediction, match);
        let actualLabel = 'Chưa có kết quả';
        let resultBadge = '<span class="badge badge-pending">Chờ kết quả</span>';
        let penaltyLabel = '-';

        if (actual) {
          actualLabel = getPredictionLabel(actual, match);
          const penalty = getStagePenalty(match.stage);
          if (pred.prediction === actual) {
            resultBadge = '<span class="badge badge-correct">✓ Đúng</span>';
            penaltyLabel = '0';
          } else {
            resultBadge = '<span class="badge badge-wrong">✗ Sai</span>';
            penaltyLabel = '+' + penalty;
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
          penaltyLabel: penaltyLabel,
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
