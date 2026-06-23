(async function () {
  let session = requireAuth();
  if (!session) return;
  session = await initGroupContext(session);
  if (!session) return;

  renderNav('fixtures');

  let allMatches = [];
  let pickStatsByMatch = {};
  let currentStage = 'all';
  let searchQuery = '';

  const matchesContainer = document.getElementById('matches-container');
  const errorBanner = document.getElementById('error-banner');
  const searchInput = document.getElementById('search-input');
  const filterBar = document.getElementById('filter-bar');

  function renderFilters() {
    let html = '';
    Object.keys(STAGE_FILTERS).forEach(function (key) {
      const active = key === currentStage ? ' active' : '';
      html += '<button type="button" class="filter-btn' + active + '" data-stage="' + key + '">' +
        escapeHtml(STAGE_FILTERS[key].label) + '</button>';
    });
    filterBar.innerHTML = html;

    filterBar.querySelectorAll('.filter-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        currentStage = btn.dataset.stage;
        renderFilters();
        renderMatches();
      });
    });
  }

  function renderMatchCard(match) {
    const score = getMatchScore(match);
    const stageLabel = getStageLabel(match.stage);
    const groupInfo = match.group ? ' · ' + escapeHtml(match.group) : '';

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

    return (
      '<div class="match-card">' +
        '<div class="match-header">' +
          '<span>' + escapeHtml(formatMatchDate(match.utcDate)) + ' · ' + escapeHtml(formatMatchTime(match.utcDate)) + '</span>' +
          '<span class="badge badge-stage">' + escapeHtml(stageLabel) + groupInfo + '</span>' +
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
      '</div>'
    );
  }

  function renderMatches() {
    let filtered = filterMatchesByStage(allMatches, currentStage);
    filtered = filterMatchesBySearch(filtered, searchQuery);
    filtered = sortMatchesByDate(filtered);

    if (filtered.length === 0) {
      matchesContainer.innerHTML =
        '<div class="empty-state">' +
          '<div class="empty-state-icon">📅</div>' +
          '<p>Không tìm thấy trận đấu nào</p>' +
        '</div>';
      return;
    }

    matchesContainer.innerHTML = filtered.map(renderMatchCard).join('');
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
      pickStatsByMatch = buildAllMatchPickStats(
        predResult.predictions || [],
        predResult.activeUsers || []
      );
      renderMatches();
      initReminderBanner(session, {
        matches: allMatches,
        userPredMap: buildUserPredictionMap(predResult.predictions || [], session.username),
      });
    } catch (err) {
      errorBanner.textContent = err.message || 'Không thể tải lịch thi đấu';
      errorBanner.classList.remove('hidden');
    } finally {
      showLoading(false);
    }
  }

  searchInput.addEventListener('input', function () {
    searchQuery = searchInput.value.trim();
    renderMatches();
  });

  init();
})();
