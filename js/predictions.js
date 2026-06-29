(async function () {
  let session = requireAuth();
  if (!session) return;
  session = await initGroupContext(session);
  if (!session) return;

  renderNav('predictions');

  let allMatches = [];
  let allPredictions = [];
  let userPredictions = {};
  let userHopeStars = {};
  let userHopeStarByMatch = {};
  let activePlayers = [];
  let predictionMapByMatch = {};
  let pickStatsByMatch = {};
  let currentTimeFilter = 'upcoming-all';
  let currentPredFilter = 'all';

  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('pred') === 'not-predicted') {
    currentPredFilter = 'not-predicted';
  }

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

  function rebuildHopeStarState() {
    userHopeStars = buildHopeStarUsageMap(allPredictions, session.username, allMatches);
    userHopeStarByMatch = buildHopeStarByMatchMap(allPredictions, session.username);
  }

  function renderHopeStarLegend() {
    const rounds = Object.keys(HOPE_STAR_ROUND_LABELS);
    let items = rounds.map(function (roundKey) {
      const used = !!userHopeStars[roundKey];
      const cls = used ? 'hope-star-legend-used' : 'hope-star-legend-available';
      const status = used ? 'đã dùng' : 'còn trống';
      return (
        '<span class="hope-star-legend-item ' + cls + '">' +
          '⭐ ' + escapeHtml(HOPE_STAR_ROUND_LABELS[roundKey]) + ': ' + status +
        '</span>'
      );
    }).join('');

    return (
      '<div class="hope-star-legend wc-card">' +
        '<div class="hope-star-legend-title">⭐ Ngôi sao hy vọng</div>' +
        '<p class="hope-star-legend-desc">Từ vòng 32 đội, mỗi vòng được chọn <strong>1 trận</strong>. ' +
        'Đúng: <strong>−×3 điểm phạt</strong> (giảm phạt). Sai: <strong>+×2 điểm phạt</strong>.</p>' +
        '<div class="hope-star-legend-rounds">' + items + '</div>' +
      '</div>'
    );
  }

  function renderMatchCard(match) {
    const groupStartDate = getCurrentGroupStartDate();
    const beforeGroupStart = !isMatchEligibleForGroup(match, groupStartDate);
    const locked = isMatchLocked(match.utcDate) || beforeGroupStart;
    const existing = userPredictions[String(match.id)] || '';
    const resultStatus = getPredictionResultStatus(match, existing);
    const stageLabel = getStageLabel(match.stage);
    const disabledClass = locked ? ' disabled' : '';
    const score = getMatchScore(match);
    const lockedBadge = beforeGroupStart
      ? '<span class="badge badge-locked">Trước ngày bắt đầu nhóm</span>'
      : locked
      ? '<span class="badge badge-locked">Đã khóa dự đoán</span>'
      : '<span class="badge badge-countdown" data-kickoff="' + escapeHtml(match.utcDate) + '">' +
          escapeHtml(formatLockCountdown(match.utcDate)) +
        '</span>';
    const statusBadge = STATUS_BADGES[resultStatus] || '';
    const missingPlayers = getMissingPlayersForMatch(
      match.id,
      activePlayers,
      predictionMapByMatch
    );
    const missingHtml =
      match.status === 'FINISHED'
        ? ''
        : renderMatchMissingPredictions(missingPlayers, activePlayers.length);

    let scoreHtml = '';
    if (match.status === 'FINISHED' && score) {
      scoreHtml = '<div class="match-score">' + escapeHtml(score) + '</div>';
    } else if (match.status === 'IN_PLAY' || match.status === 'PAUSED') {
      scoreHtml = '<div class="match-score">' + escapeHtml(score || 'Đang đấu') + '</div>';
    }

    let pickRatesHtml = '';
    if (match.status === 'FINISHED') {
      pickRatesHtml = renderMatchPickRates(pickStatsByMatch[String(match.id)], match);
    }

    const matchIdStr = String(match.id);
    const hopeStarEligible = isHopeStarEligible(match.stage) && !beforeGroupStart;
    const roundKey = getHopeStarRoundKey(match.stage);
    const hasHopeStar = !!userHopeStarByMatch[matchIdStr];
    const hopeStarUsedElsewhere =
      roundKey && userHopeStars[roundKey] && userHopeStars[roundKey] !== matchIdStr;
    const hopeStarDisabled = locked || (hopeStarUsedElsewhere && !hasHopeStar);

    let hopeStarHtml = '';
    if (hopeStarEligible) {
      const hopeStarTitle = hopeStarUsedElsewhere && !hasHopeStar
        ? 'Đã dùng ngôi sao hy vọng ở vòng ' + (HOPE_STAR_ROUND_LABELS[roundKey] || '')
        : 'Ngôi sao hy vọng — đúng: −×3 điểm phạt, sai: +×2 điểm phạt';
      hopeStarHtml =
        '<label class="hope-star-option' + (hopeStarDisabled ? ' disabled' : '') + '"' +
          ' title="' + escapeHtml(hopeStarTitle) + '">' +
          '<input type="checkbox" class="hope-star-checkbox" data-match-id="' + escapeHtml(matchIdStr) + '"' +
            (hasHopeStar ? ' checked' : '') +
            (hopeStarDisabled ? ' disabled' : '') +
            ' aria-label="Ngôi sao hy vọng">' +
          '<span class="hope-star-icon" aria-hidden="true"></span>' +
          '<span class="hope-star-label">Hy vọng</span>' +
        '</label>';
    }

    return (
      '<div class="match-card match-card-pred-' + resultStatus + (locked ? ' locked' : '') + (hasHopeStar ? ' has-hope-star' : '') + '" data-match-id="' + escapeHtml(matchIdStr) + '">' +
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
        pickRatesHtml +
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
          hopeStarHtml +
        '</div>' +
        '<div class="flex items-center gap-2 flex-wrap">' +
          lockedBadge +
          '<button type="button" class="btn btn-primary btn-save-prediction"' +
            (locked ? ' disabled' : '') +
            ' data-match-id="' + escapeHtml(String(match.id)) + '">Lưu dự đoán</button>' +
        '</div>' +
        missingHtml +
      '</div>'
    );
  }

  function renderMatches() {
    const sorted = getFilteredMatches();

    if (sorted.length === 0) {
      stopCountdownTicker();
      matchesContainer.innerHTML =
        '<div class="empty-state">' +
          '<div class="empty-state-icon">🎯</div>' +
          '<p>Không tìm thấy trận đấu nào</p>' +
        '</div>';
      return;
    }

    const legend = document.getElementById('hope-star-legend');
    if (legend) {
      legend.innerHTML = renderHopeStarLegend();
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
          openMatchInfoModal(match, {
            predictions: allPredictions,
            activePlayers: activePlayers,
          });
        }
      });
    });

    startCountdownTicker();
  }

  async function handleSave(e) {
    const matchId = e.target.dataset.matchId;
    const radio = document.querySelector('input[name="pred-' + matchId + '"]:checked');

    if (!radio) {
      showToast('Vui lòng chọn dự đoán', 'error');
      return;
    }

    const hopeStarCheckbox = document.querySelector(
      '.hope-star-checkbox[data-match-id="' + matchId + '"]'
    );
    const hopeStar = hopeStarCheckbox ? hopeStarCheckbox.checked : false;

    const btn = e.target;
    btn.disabled = true;
    btn.textContent = 'Đang lưu...';

    try {
      await savePrediction(
        session.username,
        session.passwordHash,
        getCurrentGroupId(),
        matchId,
        radio.value,
        hopeStar
      );
      userPredictions[matchId] = radio.value;
      if (!predictionMapByMatch[matchId]) {
        predictionMapByMatch[matchId] = {};
      }
      predictionMapByMatch[matchId][session.username] = true;
      allPredictions = allPredictions.filter(function (p) {
        return !(p.username === session.username && String(p.matchId) === String(matchId));
      });
      if (hopeStar) {
        const savedMatch = allMatches.find(function (m) {
          return String(m.id) === String(matchId);
        });
        const savedRoundKey = savedMatch ? getHopeStarRoundKey(savedMatch.stage) : null;
        if (savedRoundKey) {
          allPredictions.forEach(function (p) {
            if (p.username !== session.username || !isHopeStarActive(p.hopeStar)) return;
            const otherMatch = allMatches.find(function (m) {
              return String(m.id) === String(p.matchId);
            });
            if (otherMatch && getHopeStarRoundKey(otherMatch.stage) === savedRoundKey) {
              p.hopeStar = false;
            }
          });
        }
      }
      allPredictions.push({
        username: session.username,
        matchId: matchId,
        prediction: radio.value,
        hopeStar: hopeStar,
      });
      rebuildHopeStarState();
      pickStatsByMatch = buildAllMatchPickStats(allPredictions, activePlayers);
      showToast('Đã lưu dự đoán', 'success');
      renderMatches();
      initReminderBanner(session, {
        matches: allMatches,
        userPredMap: userPredictions,
      });
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
        getPredictions(session.username, session.passwordHash, getCurrentGroupId()),
      ]);

      allMatches = matches;
      allPredictions = predResult.predictions || [];
      activePlayers = getActivePlayers(predResult.activeUsers || []);
      predictionMapByMatch = buildPredictionMapByMatch(
        allPredictions,
        activePlayers
      );
      allPredictions.forEach(function (p) {
        if (p.username === session.username) {
          userPredictions[p.matchId] = p.prediction;
        }
      });
      rebuildHopeStarState();
      pickStatsByMatch = buildAllMatchPickStats(allPredictions, activePlayers);

      renderMatches();
      initReminderBanner(session, {
        matches: allMatches,
        userPredMap: userPredictions,
      });
    } catch (err) {
      errorBanner.textContent = err.message || 'Không thể tải dữ liệu';
      errorBanner.classList.remove('hidden');
    } finally {
      showLoading(false);
    }
  }

  init();
})();
