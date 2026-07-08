(async function () {
  let session = requireAuth();
  if (!session) return;
  session = await initGroupContext(session);
  if (!session) return;

  renderNav('predictions');

  let allMatches = [];
  let allPredictions = [];
  let userPredictions = {};
  let userHopeStarByMatch = {};
  let activePlayers = [];
  let predictionMapByMatch = {};
  let pickStatsByMatch = {};
  let championPredictions = [];
  let userChampionPick = null;
  let currentTimeFilter = 'upcoming-all';
  let currentPredFilter = 'all';

  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('pred') === 'not-predicted') {
    currentPredFilter = 'not-predicted';
  }

  const matchesContainer = document.getElementById('matches-container');
  const championCard = document.getElementById('champion-card');
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
    userHopeStarByMatch = buildHopeStarByMatchMap(allPredictions, session.username);
  }

  function renderHopeStarLegend() {
    return (
      '<div class="hope-star-legend wc-card">' +
        '<div class="hope-star-legend-title">⭐ Ngôi sao hy vọng</div>' +
        '<p class="hope-star-legend-desc">Mỗi trận hoặc dự đoán vô địch có thể gắn ngôi sao hy vọng. ' +
        'Đúng: <strong>−×1 điểm phạt</strong> (giảm phạt). Sai: <strong>+×2 điểm phạt</strong>.</p>' +
      '</div>'
    );
  }

  function getUserChampionPick() {
    return (championPredictions || []).find(function (pick) {
      return pick.username === session.username;
    }) || null;
  }

  function renderChampionCard() {
    if (!championCard) return;

    const groupStartDate = getCurrentGroupStartDate();
    const teams = extractTeamsFromMatches(allMatches);
    const locked = isChampionPredictionLocked(allMatches, groupStartDate);
    const lockTime = getChampionPredictionLockTime(allMatches, groupStartDate);
    const pick = userChampionPick;
    const actualChampion = getChampionTeamFromMatches(
      filterMatchesForGroup(allMatches, groupStartDate)
    );
    const hopeStar = pick && isHopeStarActive(pick.hopeStar);

    let statusHtml = '';
    if (actualChampion) {
      const penalty = computeChampionPenaltyPoints(pick, actualChampion, hopeStar);
      let resultClass = 'champion-result-pending';
      let resultText = 'Chờ kết quả';
      if (penalty !== null) {
        if (pick && String(pick.teamId) === String(actualChampion.id)) {
          resultClass = 'champion-result-correct';
          resultText = '✓ Đúng (' + formatPenaltyLabel(penalty) + ')';
        } else {
          resultClass = 'champion-result-wrong';
          resultText = pick ? '✗ Sai (' + formatPenaltyLabel(penalty) + ')' : 'Chưa dự đoán (' + formatPenaltyLabel(penalty) + ')';
        }
      }
      statusHtml =
        '<div class="champion-result">' +
          '<span class="champion-result-label">Đội vô địch:</span> ' +
          '<strong>' + escapeHtml(actualChampion.name) + '</strong>' +
          ' · <span class="' + resultClass + '">' + resultText + '</span>' +
        '</div>';
    }

    let lockBadge = '';
    if (locked) {
      lockBadge = '<span class="badge badge-locked">Đã khóa dự đoán vô địch</span>';
    } else if (lockTime) {
      lockBadge =
        '<span class="badge badge-countdown" data-kickoff="' + escapeHtml(lockTime) + '">' +
          escapeHtml(formatLockCountdown(lockTime)) +
        '</span>';
    }

    let teamOptions = '<option value="">-- Chọn đội vô địch --</option>';
    teams.forEach(function (team) {
      const selected = pick && String(pick.teamId) === String(team.id) ? ' selected' : '';
      teamOptions +=
        '<option value="' + escapeHtml(String(team.id)) + '" data-name="' + escapeHtml(team.name) + '"' + selected + '>' +
          escapeHtml(team.name) +
        '</option>';
    });

    const hopeStarTitle = 'Ngôi sao hy vọng — đúng: −40đ, sai/không chọn: +20đ';
    const hopeStarHtml = locked
      ? (hopeStar ? '<span class="champion-hope-star-badge">⭐ Hy vọng</span>' : '')
      : '<label class="hope-star-option champion-hope-star"' +
          ' title="' + escapeHtml(hopeStarTitle) + '">' +
          '<input type="checkbox" id="champion-hope-star"' +
            (hopeStar ? ' checked' : '') +
            ' aria-label="Ngôi sao hy vọng cho dự đoán vô địch">' +
          '<span class="hope-star-icon" aria-hidden="true"></span>' +
          '<span class="hope-star-label">Hy vọng</span>' +
        '</label>';

    championCard.innerHTML =
      '<div class="champion-card wc-card' + (hopeStar ? ' has-hope-star' : '') + (locked ? ' locked' : '') + '">' +
        '<div class="champion-card-header">' +
          '<h2 class="wc-card-title">🏆 Dự đoán đội vô địch</h2>' +
          lockBadge +
        '</div>' +
        '<p class="champion-card-desc">' +
          'Đúng: <strong>−20đ</strong> · Sai hoặc không chọn: <strong>+10đ</strong> · ' +
          '⭐ nhân đôi hiệu ứng (đúng <strong>−40đ</strong>, sai <strong>+20đ</strong>)' +
        '</p>' +
        statusHtml +
        '<div class="champion-card-form">' +
          '<select id="champion-team-select" class="form-input champion-team-select"' +
            (locked ? ' disabled' : '') + '>' +
            teamOptions +
          '</select>' +
          hopeStarHtml +
          '<button type="button" id="btn-save-champion" class="btn btn-primary"' +
            (locked ? ' disabled' : '') + '>Lưu dự đoán vô địch</button>' +
        '</div>' +
        (pick && !actualChampion
          ? '<p class="champion-current-pick">Dự đoán hiện tại: <strong>' +
              escapeHtml(pick.teamName) + (hopeStar ? ' ⭐' : '') +
            '</strong></p>'
          : '') +
      '</div>';

    const saveBtn = document.getElementById('btn-save-champion');
    if (saveBtn) {
      saveBtn.addEventListener('click', handleSaveChampion);
    }
  }

  async function handleSaveChampion() {
    const select = document.getElementById('champion-team-select');
    const hopeStarCheckbox = document.getElementById('champion-hope-star');
    const btn = document.getElementById('btn-save-champion');

    if (!select || !select.value) {
      showToast('Vui lòng chọn đội vô địch', 'error');
      return;
    }

    const selectedOption = select.options[select.selectedIndex];
    const teamId = select.value;
    const teamName = selectedOption.dataset.name || selectedOption.textContent;
    const hopeStar = hopeStarCheckbox ? hopeStarCheckbox.checked : false;

    btn.disabled = true;
    btn.textContent = 'Đang lưu...';

    try {
      await saveChampionPrediction(
        session.username,
        session.passwordHash,
        getCurrentGroupId(),
        teamId,
        teamName,
        hopeStar
      );

      championPredictions = championPredictions.filter(function (pick) {
        return pick.username !== session.username;
      });
      championPredictions.push({
        username: session.username,
        teamId: teamId,
        teamName: teamName,
        hopeStar: hopeStar,
      });
      userChampionPick = getUserChampionPick();
      showToast('Đã lưu dự đoán vô địch', 'success');
      renderChampionCard();
      startCountdownTicker();
    } catch (err) {
      showToast(err.message || 'Lưu thất bại', 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Lưu dự đoán vô địch';
    }
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
    const hasHopeStar = !!userHopeStarByMatch[matchIdStr];
    const hopeStarDisabled = locked;

    const hopeStarTitle = 'Ngôi sao hy vọng — đúng: −×1 điểm phạt, sai: +×2 điểm phạt';
    const hopeStarHtml = beforeGroupStart
      ? ''
      : '<label class="hope-star-option' + (hopeStarDisabled ? ' disabled' : '') + '"' +
          ' title="' + escapeHtml(hopeStarTitle) + '">' +
          '<input type="checkbox" class="hope-star-checkbox" data-match-id="' + escapeHtml(matchIdStr) + '"' +
            (hasHopeStar ? ' checked' : '') +
            (hopeStarDisabled ? ' disabled' : '') +
            ' aria-label="Ngôi sao hy vọng">' +
          '<span class="hope-star-icon" aria-hidden="true"></span>' +
          '<span class="hope-star-label">Hy vọng</span>' +
        '</label>';

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
      championPredictions = predResult.championPredictions || [];
      userChampionPick = getUserChampionPick();
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

      renderChampionCard();
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
