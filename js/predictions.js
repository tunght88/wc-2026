(function () {
  const session = requireAuth();
  if (!session) return;

  renderNav('predictions');

  let allMatches = [];
  let userPredictions = {};

  const matchesContainer = document.getElementById('matches-container');
  const errorBanner = document.getElementById('error-banner');

  function renderMatchCard(match) {
    const locked = isMatchLocked(match.utcDate);
    const existing = userPredictions[String(match.id)] || '';
    const stageLabel = getStageLabel(match.stage);
    const disabledClass = locked ? ' disabled' : '';
    const lockedBadge = locked
      ? '<span class="badge badge-locked">Đã khóa dự đoán</span>'
      : '';

    return (
      '<div class="match-card' + (locked ? ' locked' : '') + '" data-match-id="' + escapeHtml(String(match.id)) + '">' +
        '<div class="match-header">' +
          '<span>' + escapeHtml(formatMatchDate(match.utcDate)) + ' · ' + escapeHtml(formatMatchTime(match.utcDate)) + '</span>' +
          '<span class="badge badge-stage">' + escapeHtml(stageLabel) + '</span>' +
        '</div>' +
        '<div class="match-teams">' +
          '<div class="team home">' +
            '<span>' + escapeHtml(match.homeTeam.shortName || match.homeTeam.name) + '</span>' +
            (match.homeTeam.crest ? '<img src="' + escapeHtml(match.homeTeam.crest) + '" alt="" class="team-crest">' : '') +
          '</div>' +
          '<span class="match-vs">VS</span>' +
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
    const sorted = sortMatchesByDate(allMatches);

    if (sorted.length === 0) {
      matchesContainer.innerHTML =
        '<div class="empty-state">' +
          '<div class="empty-state-icon">🎯</div>' +
          '<p>Chưa có trận đấu nào</p>' +
        '</div>';
      return;
    }

    matchesContainer.innerHTML = sorted.map(renderMatchCard).join('');

    matchesContainer.querySelectorAll('.btn-save-prediction').forEach(function (btn) {
      btn.addEventListener('click', handleSave);
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
    } catch (err) {
      showToast(err.message || 'Lưu thất bại', 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Lưu dự đoán';
    }
  }

  async function init() {
    showLoading(true);

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
