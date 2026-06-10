(function () {
  const session = requireAuth();
  if (!session) return;

  renderNav('predictions');

  let allMatches = [];
  let userPredictions = {};
  let currentTimeFilter = 'upcoming-all';
  let currentPredFilter = 'all';

  const matchesContainer = document.getElementById('matches-container');
  const errorBanner = document.getElementById('error-banner');
  const timeFilterBar = document.getElementById('time-filter-bar');
  const predFilterBar = document.getElementById('pred-filter-bar');

  const STATUS_BADGES = {
    none: '',
    pending: '<span class="badge badge-pending">Chờ kết quả</span>',
    correct: '<span class="badge badge-correct">✓ Đúng</span>',
    wrong: '<span class="badge badge-wrong">✗ Sai</span>',
  };

  function renderFilterBar(container, filters, currentKey, dataAttr, onChange) {
    let html = '';
    Object.keys(filters).forEach(function (key) {
      const active = key === currentKey ? ' active' : '';
      html +=
        '<button type="button" class="filter-btn' + active + '" data-' + dataAttr + '="' + key + '">' +
        escapeHtml(filters[key].label) +
        '</button>';
    });
    container.innerHTML = html;

    container.querySelectorAll('.filter-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        onChange(btn.dataset[dataAttr]);
      });
    });
  }

  function renderFilters() {
    renderFilterBar(timeFilterBar, TIME_FILTERS, currentTimeFilter, 'time', function (key) {
      currentTimeFilter = key;
      renderFilters();
      renderMatches();
    });

    renderFilterBar(predFilterBar, PREDICTION_FILTERS, currentPredFilter, 'pred', function (key) {
      currentPredFilter = key;
      renderFilters();
      renderMatches();
    });
  }

  function getFilteredMatches() {
    let filtered = filterMatchesByTime(allMatches, currentTimeFilter);
    filtered = filterMatchesByPrediction(filtered, userPredictions, currentPredFilter);
    return sortMatchesByDate(filtered);
  }

  function renderMatchCard(match) {
    const locked = isMatchLocked(match.utcDate);
    const existing = userPredictions[String(match.id)] || '';
    const resultStatus = getPredictionResultStatus(match, existing);
    const stageLabel = getStageLabel(match.stage);
    const disabledClass = locked ? ' disabled' : '';
    const score = getMatchScore(match);
    const lockedBadge = locked
      ? '<span class="badge badge-locked">Đã khóa dự đoán</span>'
      : '';
    const statusBadge = STATUS_BADGES[resultStatus] || '';

    let scoreHtml = '';
    if (match.status === 'FINISHED' && score) {
      scoreHtml = '<div class="match-score">' + escapeHtml(score) + '</div>';
    } else if (match.status === 'IN_PLAY' || match.status === 'PAUSED') {
      scoreHtml = '<div class="match-score">' + escapeHtml(score || 'Đang đấu') + '</div>';
    }

    return (
      '<div class="match-card match-card-pred-' + resultStatus + (locked ? ' locked' : '') + '" data-match-id="' + escapeHtml(String(match.id)) + '">' +
        '<div class="match-header">' +
          '<span>' + escapeHtml(formatMatchDate(match.utcDate)) + ' · ' + escapeHtml(formatMatchTime(match.utcDate)) + '</span>' +
          '<span class="match-header-badges">' +
            '<button type="button" class="btn-match-info" data-match-id="' + escapeHtml(String(match.id)) + '" title="Thông tin trận đấu" aria-label="Thông tin trận đấu">i</button>' +
            statusBadge +
            '<span class="badge badge-stage">' + escapeHtml(stageLabel) + '</span>' +
          '</span>' +
        '</div>' +
        '<div class="match-teams">' +
          '<div class="team home">' +
            '<span>' + escapeHtml(match.homeTeam.shortName || match.homeTeam.name) + '</span>' +
            (match.homeTeam.crest ? '<img src="' + escapeHtml(match.homeTeam.crest) + '" alt="" class="team-crest">' : '') +
          '</div>' +
          (scoreHtml ? scoreHtml : '<span class="match-vs">VS</span>') +
          '<div class="team away">' +
            (match.awayTeam.crest ? '<img src="' + escapeHtml(match.awayTeam.crest) + '" alt="" class="team-crest">' : '') +
            '<span>' + escapeHtml(match.awayTeam.shortName || match.awayTeam.name) + '</span>' +
          '</div>' +
        '</div>' +
        '<div class="prediction-options">' +
          '<label class="prediction-option' + disabledClass + '">' +
            '<input type="radio" name="pred-' + match.id + '" value="HOME"' +
              (existing === 'HOME' ? ' checked' : '') +
              (locked ? ' disabled' : '') + '>' +
            '<span>' + escapeHtml(match.homeTeam.shortName || match.homeTeam.name) + ' thắng</span>' +
          '</label>' +
          '<label class="prediction-option' + disabledClass + '">' +
            '<input type="radio" name="pred-' + match.id + '" value="DRAW"' +
              (existing === 'DRAW' ? ' checked' : '') +
              (locked ? ' disabled' : '') + '>' +
            '<span>Hòa</span>' +
          '</label>' +
          '<label class="prediction-option' + disabledClass + '">' +
            '<input type="radio" name="pred-' + match.id + '" value="AWAY"' +
              (existing === 'AWAY' ? ' checked' : '') +
              (locked ? ' disabled' : '') + '>' +
            '<span>' + escapeHtml(match.awayTeam.shortName || match.awayTeam.name) + ' thắng</span>' +
          '</label>' +
        '</div>' +
        '<div class="flex items-center gap-2 flex-wrap">' +
          lockedBadge +
          '<button type="button" class="btn btn-primary btn-save-prediction"' +
            (locked ? ' disabled' : '') +
            ' data-match-id="' + escapeHtml(String(match.id)) + '">Lưu dự đoán</button>' +
        '</div>' +
      '</div>'
    );
  }

  function renderMatches() {
    const sorted = getFilteredMatches();

    if (sorted.length === 0) {
      matchesContainer.innerHTML =
        '<div class="empty-state">' +
          '<div class="empty-state-icon">🎯</div>' +
          '<p>Không tìm thấy trận đấu nào</p>' +
        '</div>';
      return;
    }

    matchesContainer.innerHTML = sorted.map(renderMatchCard).join('');

    matchesContainer.querySelectorAll('.btn-save-prediction').forEach(function (btn) {
      btn.addEventListener('click', handleSave);
    });

    matchesContainer.querySelectorAll('.btn-match-info').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const matchId = btn.dataset.matchId;
        const match = allMatches.find(function (m) {
          return String(m.id) === matchId;
        });
        if (match && typeof openMatchInfoModal === 'function') {
          openMatchInfoModal(match);
        }
      });
    });
  }

  async function handleSave(e) {
    const matchId = e.target.dataset.matchId;
    const radio = document.querySelector('input[name="pred-' + matchId + '"]:checked');

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
        matchId,
        radio.value
      );
      userPredictions[matchId] = radio.value;
      showToast('Đã lưu dự đoán', 'success');
      renderMatches();
    } catch (err) {
      showToast(err.message || 'Lưu thất bại', 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Lưu dự đoán';
    }
  }

  async function init() {
    showLoading(true);
    renderFilters();

    try {
      const [matches, predResult] = await Promise.all([
        getMatches(),
        getPredictions(session.username, session.passwordHash),
      ]);

      allMatches = matches;
      (predResult.predictions || []).forEach(function (p) {
        if (p.username === session.username) {
          userPredictions[p.matchId] = p.prediction;
        }
      });

      renderMatches();
    } catch (err) {
      errorBanner.textContent = err.message || 'Không thể tải dữ liệu';
      errorBanner.classList.remove('hidden');
    } finally {
      showLoading(false);
    }
  }

  init();
})();
