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
          const shirt = entry.shirt ? entry.shirt + '. ' : '';
          return '<li>' + escapeHtml(shirt + (entry.name || '')) + '</li>';
        })
        .join('') +
      '</ul>'
    );
  }

  function renderFotmobLineupSection(fotmob, match, insights) {
    const homeName = match.homeTeam.shortName || match.homeTeam.name;
    const awayName = match.awayTeam.shortName || match.awayTeam.name;
    const lineup = fotmob && fotmob.lineup;

    if (lineup && ((lineup.home && lineup.home.players.length) || (lineup.away && lineup.away.players.length))) {
      return (
        '<div class="match-info-lineups">' +
          '<div class="lineup-block">' +
            '<div class="lineup-team">' +
              escapeHtml(lineup.home && lineup.home.name ? lineup.home.name : homeName) +
              (lineup.home && lineup.home.formation
                ? ' <span class="lineup-formation">(' + escapeHtml(lineup.home.formation) + ')</span>'
                : '') +
            '</div>' +
            (lineup.home && lineup.home.players.length
              ? renderLineupPlayers(lineup.home.players)
              : '<p class="match-info-empty">Chưa công bố</p>') +
          '</div>' +
          '<div class="lineup-block">' +
            '<div class="lineup-team">' +
              escapeHtml(lineup.away && lineup.away.name ? lineup.away.name : awayName) +
              (lineup.away && lineup.away.formation
                ? ' <span class="lineup-formation">(' + escapeHtml(lineup.away.formation) + ')</span>'
                : '') +
            '</div>' +
            (lineup.away && lineup.away.players.length
              ? renderLineupPlayers(lineup.away.players)
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

  function renderFormBadge(result) {
    const cls =
      result === 'W' ? 'form-w' : result === 'D' ? 'form-d' : result === 'L' ? 'form-l' : 'form-u';
    return '<span class="form-badge ' + cls + '">' + escapeHtml(result || '?') + '</span>';
  }

  function renderFormSection(fotmob, match) {
    const form = fotmob && fotmob.form;
    if (!form || ((!form.home || !form.home.length) && (!form.away || !form.away.length))) {
      return '<p class="match-info-empty">Chưa có dữ liệu phong độ</p>';
    }

    const homeName = match.homeTeam.shortName || match.homeTeam.name;
    const awayName = match.awayTeam.shortName || match.awayTeam.name;

    return (
      '<div class="form-section">' +
        '<div class="form-row">' +
          '<span class="form-team">' + escapeHtml(homeName) + '</span>' +
          '<span class="form-badges">' +
            (form.home || []).map(renderFormBadge).join('') +
          '</span>' +
        '</div>' +
        '<div class="form-row">' +
          '<span class="form-team">' + escapeHtml(awayName) + '</span>' +
          '<span class="form-badges">' +
            (form.away || []).map(renderFormBadge).join('') +
          '</span>' +
        '</div>' +
      '</div>'
    );
  }

  function renderProbabilitiesSection(fotmob, match) {
    const probs = fotmob && fotmob.probabilities;
    if (!probs) {
      return '<p class="match-info-empty">Chưa có xác suất</p>';
    }

    const homeName = match.homeTeam.shortName || match.homeTeam.name;
    const awayName = match.awayTeam.shortName || match.awayTeam.name;

    return (
      '<div class="prob-bars">' +
        '<div class="prob-row">' +
          '<span class="prob-label">' + escapeHtml(homeName) + '</span>' +
          '<div class="prob-track"><div class="prob-fill prob-home" style="width:' + probs.home + '%"></div></div>' +
          '<span class="prob-value">' + probs.home + '%</span>' +
        '</div>' +
        '<div class="prob-row">' +
          '<span class="prob-label">Hòa</span>' +
          '<div class="prob-track"><div class="prob-fill prob-draw" style="width:' + probs.draw + '%"></div></div>' +
          '<span class="prob-value">' + probs.draw + '%</span>' +
        '</div>' +
        '<div class="prob-row">' +
          '<span class="prob-label">' + escapeHtml(awayName) + '</span>' +
          '<div class="prob-track"><div class="prob-fill prob-away" style="width:' + probs.away + '%"></div></div>' +
          '<span class="prob-value">' + probs.away + '%</span>' +
        '</div>' +
      '</div>' +
      '<p class="prob-source">Nguồn: FotMob</p>'
    );
  }

  function renderFotmobH2H(fotmob, match) {
    const h2h = fotmob && fotmob.h2h;
    if (!h2h || !h2h.matches || !h2h.matches.length) {
      return '<p class="match-info-empty">Chưa có dữ liệu lịch sử đối đầu</p>';
    }

    const homeLabel = match.homeTeam.shortName || match.homeTeam.name;
    const awayLabel = match.awayTeam.shortName || match.awayTeam.name;

    const rows = h2h.matches
      .map(function (m) {
        const date = m.date ? formatMatchDate(m.date) : '-';
        return (
          '<tr>' +
            '<td>' + escapeHtml(date) + '</td>' +
            '<td>' +
              escapeHtml(m.home) + ' ' + escapeHtml(m.score || '-') + ' ' + escapeHtml(m.away) +
            '</td>' +
            '<td class="h2h-comp">' + escapeHtml(m.league || '') + '</td>' +
          '</tr>'
        );
      })
      .join('');

    return (
      '<div class="h2h-summary">' +
        '<span>' + escapeHtml(homeLabel) + ': <strong>' + (h2h.homeWins || 0) + '</strong></span>' +
        '<span>Hòa: <strong>' + (h2h.draws || 0) + '</strong></span>' +
        '<span>' + escapeHtml(awayLabel) + ': <strong>' + (h2h.awayWins || 0) + '</strong></span>' +
      '</div>' +
      '<div class="table-wrapper">' +
        '<table class="data-table h2h-table">' +
          '<thead><tr><th>Ngày</th><th>Kết quả</th><th>Giải</th></tr></thead>' +
          '<tbody>' + rows + '</tbody>' +
        '</table>' +
      '</div>'
    );
  }

  function renderPickSection(fotmob, insights, match) {
    const sheetPick = insights && insights.pickSuggestion;
    const fotmobPick = fotmob && fotmob.pickSuggestion;
    const pick = sheetPick || fotmobPick;

    if (!pick) {
      return '<p class="match-info-empty">Chưa có gợi ý</p>';
    }

    const label = getPredictionLabel(pick, match);
    let note = (insights && insights.pickNote) || (fotmob && fotmob.pickNote) || '';

    if (sheetPick && fotmob && fotmob.pickNote && !insights.pickNote) {
      note = fotmob.pickNote;
    }

    let html =
      '<div class="pick-suggestion">' +
        '<span class="pick-badge pick-' + escapeHtml(pick.toLowerCase()) + '">' +
          escapeHtml(label) +
        '</span>';

    if (note) {
      html +=
        '<p class="pick-note">' + escapeHtml(note).replace(/\n/g, '<br>') + '</p>';
    }

    if (!sheetPick && fotmobPick) {
      html += '<p class="pick-note pick-note-muted">Gợi ý tự động từ xác suất FotMob</p>';
    }

    html += '</div>';
    return html;
  }

  function renderMatchInfoContent(match, fotmob, insights) {
    const expertText =
      (insights && insights.expertAssessment) ||
      (fotmob && fotmob.expertAssessment) ||
      '';

    return (
      '<section class="match-info-section">' +
        '<h3 class="match-info-section-title">Đội hình dự kiến</h3>' +
        renderFotmobLineupSection(fotmob, match, insights) +
      '</section>' +
      '<section class="match-info-section">' +
        '<h3 class="match-info-section-title">Phong độ gần đây</h3>' +
        renderFormSection(fotmob, match) +
      '</section>' +
      '<section class="match-info-section">' +
        '<h3 class="match-info-section-title">Xác suất thắng / hòa / thua</h3>' +
        renderProbabilitiesSection(fotmob, match) +
      '</section>' +
      '<section class="match-info-section">' +
        '<h3 class="match-info-section-title">Đánh giá chuyên môn</h3>' +
        (expertText
          ? '<div class="match-info-text">' + escapeHtml(expertText).replace(/\n/g, '<br>') + '</div>'
          : '<p class="match-info-empty">Chưa có nhận định</p>') +
      '</section>' +
      '<section class="match-info-section">' +
        '<h3 class="match-info-section-title">Lịch sử đối đầu</h3>' +
        renderFotmobH2H(fotmob, match) +
      '</section>' +
      '<section class="match-info-section">' +
        '<h3 class="match-info-section-title">Gợi ý chọn</h3>' +
        renderPickSection(fotmob, insights, match) +
      '</section>'
    );
  }

  async function openMatchInfoModal(match) {
    const home = match.homeTeam.shortName || match.homeTeam.name;
    const away = match.awayTeam.shortName || match.awayTeam.name;

    titleEl.textContent = home + ' vs ' + away;
    bodyEl.innerHTML =
      '<div class="match-info-loading"><div class="spinner"></div><p>Đang tải từ FotMob...</p></div>';
    modal.classList.remove('hidden');
    document.body.classList.add('modal-open');

    try {
      const results = await Promise.allSettled([
        loadFotMobMatchInfo(match),
        getMatchInsightsData(match.id),
      ]);

      const fotmob = results[0].status === 'fulfilled' ? results[0].value : null;
      const insights = results[1].status === 'fulfilled' ? results[1].value : null;
      const fotmobError =
        results[0].status === 'rejected'
          ? (results[0].reason && results[0].reason.message) || 'Không tải được FotMob'
          : '';

      if (!fotmob && !insights) {
        throw results[0].status === 'rejected' ? results[0].reason : new Error('Không có dữ liệu');
      }

      let html = '';
      if (fotmobError && !fotmob) {
        html +=
          '<div class="match-info-fallback-banner">' + escapeHtml(fotmobError) + '</div>';
      }
      html += renderMatchInfoContent(match, fotmob, insights);
      bodyEl.innerHTML = html;
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
