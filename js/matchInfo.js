(function () {
  const modal = document.getElementById('match-info-modal');
  if (!modal) return;

  const titleEl = document.getElementById('match-info-title');
  const bodyEl = document.getElementById('match-info-body');
  const closeBtn = document.getElementById('match-info-close');
  const backdrop = modal.querySelector('.modal-backdrop');

  function closeMatchInfoModal() {
    modal.classList.add('hidden');
    document.body.classList.remove('modal-open');
    bodyEl.innerHTML = '';
  }

  function renderLineupPlayers(players) {
    if (!players || players.length === 0) return '';
    return (
      '<ul class="lineup-list">' +
      players
        .map(function (entry) {
          const name = entry.player ? entry.player.name : entry.name || '';
          const pos = entry.position ? ' (' + entry.position + ')' : '';
          return '<li>' + escapeHtml(name) + escapeHtml(pos) + '</li>';
        })
        .join('') +
      '</ul>'
    );
  }

  function renderLineupSection(match, insights) {
    const homeName = match.homeTeam.shortName || match.homeTeam.name;
    const awayName = match.awayTeam.shortName || match.awayTeam.name;
    const homeLineup = match.homeTeam && match.homeTeam.lineup;
    const awayLineup = match.awayTeam && match.awayTeam.lineup;
    const hasApiLineup =
      (homeLineup && homeLineup.length > 0) || (awayLineup && awayLineup.length > 0);

    if (hasApiLineup) {
      return (
        '<div class="match-info-lineups">' +
          '<div class="lineup-block">' +
            '<div class="lineup-team">' + escapeHtml(homeName) + '</div>' +
            (homeLineup && homeLineup.length
              ? renderLineupPlayers(homeLineup)
              : '<p class="match-info-empty">Chưa công bố</p>') +
          '</div>' +
          '<div class="lineup-block">' +
            '<div class="lineup-team">' + escapeHtml(awayName) + '</div>' +
            (awayLineup && awayLineup.length
              ? renderLineupPlayers(awayLineup)
              : '<p class="match-info-empty">Chưa công bố</p>') +
          '</div>' +
        '</div>'
      );
    }

    if (insights && insights.expectedLineup) {
      return (
        '<div class="match-info-text">' +
          escapeHtml(insights.expectedLineup).replace(/\n/g, '<br>') +
        '</div>'
      );
    }

    return '<p class="match-info-empty">Chưa có đội hình dự kiến</p>';
  }

  function countH2HResult(winner, matchHomeId, matchAwayId, currentHomeId) {
    if (winner === 'DRAW') return 'draw';
    const winningId = winner === 'HOME_TEAM' ? matchHomeId : matchAwayId;
    if (winningId === currentHomeId) return 'home';
    return 'away';
  }

  function renderH2HSection(h2h, match) {
    const matches = (h2h && h2h.matches) || [];
    if (matches.length === 0) {
      return '<p class="match-info-empty">Chưa có dữ liệu lịch sử đối đầu</p>';
    }

    const homeTeamId = match.homeTeam.id;
    const homeLabel = match.homeTeam.shortName || match.homeTeam.name;
    const awayLabel = match.awayTeam.shortName || match.awayTeam.name;
    let homeWins = 0;
    let awayWins = 0;
    let draws = 0;

    const rows = matches
      .map(function (m) {
        const score = getMatchScore(m) || '-';
        const date = formatMatchDate(m.utcDate);
        const comp = m.competition ? m.competition.name : '';
        const winner = m.score && m.score.winner;
        const result = countH2HResult(winner, m.homeTeam.id, m.awayTeam.id, homeTeamId);

        if (result === 'home') homeWins++;
        else if (result === 'away') awayWins++;
        else if (result === 'draw') draws++;

        const home = m.homeTeam.shortName || m.homeTeam.name;
        const away = m.awayTeam.shortName || m.awayTeam.name;

        return (
          '<tr>' +
            '<td>' + escapeHtml(date) + '</td>' +
            '<td>' + escapeHtml(home) + ' ' + escapeHtml(score) + ' ' + escapeHtml(away) + '</td>' +
            '<td class="h2h-comp">' + escapeHtml(comp) + '</td>' +
          '</tr>'
        );
      })
      .join('');

    return (
      '<div class="h2h-summary">' +
        '<span>' + escapeHtml(homeLabel) + ': <strong>' + homeWins + '</strong></span>' +
        '<span>Hòa: <strong>' + draws + '</strong></span>' +
        '<span>' + escapeHtml(awayLabel) + ': <strong>' + awayWins + '</strong></span>' +
      '</div>' +
      '<div class="table-wrapper">' +
        '<table class="data-table h2h-table">' +
          '<thead><tr><th>Ngày</th><th>Kết quả</th><th>Giải</th></tr></thead>' +
          '<tbody>' + rows + '</tbody>' +
        '</table>' +
      '</div>'
    );
  }

  function renderPickSuggestion(insights, match) {
    if (!insights || !insights.pickSuggestion) {
      return '<p class="match-info-empty">Chưa có gợi ý</p>';
    }

    const label = getPredictionLabel(insights.pickSuggestion, match);
    let html =
      '<div class="pick-suggestion">' +
        '<span class="pick-badge pick-' + escapeHtml(insights.pickSuggestion.toLowerCase()) + '">' +
          escapeHtml(label) +
        '</span>';

    if (insights.pickNote) {
      html +=
        '<p class="pick-note">' +
          escapeHtml(insights.pickNote).replace(/\n/g, '<br>') +
        '</p>';
    }

    html += '</div>';
    return html;
  }

  function renderMatchInfoContent(match, detail, h2h, insights) {
    const merged = detail || match;

    return (
      '<section class="match-info-section">' +
        '<h3 class="match-info-section-title">Đội hình dự kiến</h3>' +
        renderLineupSection(merged, insights) +
      '</section>' +
      '<section class="match-info-section">' +
        '<h3 class="match-info-section-title">Đánh giá chuyên môn</h3>' +
        (insights && insights.expertAssessment
          ? '<div class="match-info-text">' +
              escapeHtml(insights.expertAssessment).replace(/\n/g, '<br>') +
            '</div>'
          : '<p class="match-info-empty">Chưa có nhận định</p>') +
      '</section>' +
      '<section class="match-info-section">' +
        '<h3 class="match-info-section-title">Lịch sử đối đầu</h3>' +
        renderH2HSection(h2h, match) +
      '</section>' +
      '<section class="match-info-section">' +
        '<h3 class="match-info-section-title">Gợi ý chọn</h3>' +
        renderPickSuggestion(insights, match) +
      '</section>'
    );
  }

  async function openMatchInfoModal(match) {
    const home = match.homeTeam.shortName || match.homeTeam.name;
    const away = match.awayTeam.shortName || match.awayTeam.name;

    titleEl.textContent = home + ' vs ' + away;
    bodyEl.innerHTML =
      '<div class="match-info-loading"><div class="spinner"></div><p>Đang tải thông tin...</p></div>';
    modal.classList.remove('hidden');
    document.body.classList.add('modal-open');

    try {
      const results = await Promise.allSettled([
        getMatchDetail(match.id),
        getMatchHead2Head(match.id, 5),
        getMatchInsightsData(match.id),
      ]);

      const detail = results[0].status === 'fulfilled' ? results[0].value : null;
      const h2h = results[1].status === 'fulfilled' ? results[1].value : null;
      const insights = results[2].status === 'fulfilled' ? results[2].value : null;

      bodyEl.innerHTML = renderMatchInfoContent(match, detail, h2h, insights);
    } catch (err) {
      bodyEl.innerHTML =
        '<p class="match-info-empty">' +
          escapeHtml(err.message || 'Không thể tải thông tin trận đấu') +
        '</p>';
    }
  }

  closeBtn.addEventListener('click', closeMatchInfoModal);
  backdrop.addEventListener('click', closeMatchInfoModal);
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !modal.classList.contains('hidden')) {
      closeMatchInfoModal();
    }
  });

  window.openMatchInfoModal = openMatchInfoModal;
})();
