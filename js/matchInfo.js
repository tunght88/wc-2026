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

  function getWinProbability(fotmob, insights) {
    if (
      insights &&
      insights.winProbHome !== null &&
      insights.winProbHome !== undefined &&
      insights.winProbDraw !== null &&
      insights.winProbDraw !== undefined &&
      insights.winProbAway !== null &&
      insights.winProbAway !== undefined
    ) {
      return {
        home: insights.winProbHome,
        draw: insights.winProbDraw,
        away: insights.winProbAway,
        source: 'sheet',
      };
    }

    const probs = fotmob && (fotmob.winProbability || fotmob.probabilities);
    return probs || null;
  }

  function derivePickFromProbability(probs) {
    if (!probs) return '';
    if (probs.home >= probs.draw && probs.home >= probs.away) return 'HOME';
    if (probs.away >= probs.draw && probs.away >= probs.home) return 'AWAY';
    return 'DRAW';
  }

  function getProbabilitySourceLabel(source) {
    if (source === 'sheet') return 'Sheet (thủ công)';
    if (source === 'fotmob-odds' || source === 'football-data-odds') return 'Kèo châu Âu';
    if (source === 'fotmob-votes') return 'Bình chọn FotMob';
    return 'FotMob';
  }

  function formatProbabilityNote(probs) {
    if (!probs) return '';
    if (probs.odds) {
      return (
        'Kèo châu Âu: ' +
        probs.odds.home + ' / ' + probs.odds.draw + ' / ' + probs.odds.away +
        ' → ' + probs.home + '% / ' + probs.draw + '% / ' + probs.away + '%'
      );
    }
    return (
      'Dựa trên xác suất cao nhất: ' +
      probs.home + '% / ' + probs.draw + '% / ' + probs.away + '%'
    );
  }

  function formatShortDate(dateStr) {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '-';
    return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
  }

  function isSafePlayerImageUrl(url) {
    return /^https:\/\/images\.fotmob\.com\//i.test(String(url || ''));
  }

  function getPlayerImageUrl(entry) {
    if (isSafePlayerImageUrl(entry.imageUrl)) return entry.imageUrl;
    if (entry.playerId) {
      return (
        'https://images.fotmob.com/image_resources/playerimages/' +
        encodeURIComponent(String(entry.playerId)) +
        '.png'
      );
    }
    return '';
  }

  function renderLineupPlayerAvatar(entry) {
    const shirt = entry.shirt ? escapeHtml(entry.shirt) : '?';
    const imageUrl = getPlayerImageUrl(entry);

    if (imageUrl) {
      return (
        '<span class="lineup-player-avatar">' +
          '<img class="lineup-player-photo" src="' + escapeHtml(imageUrl) + '" alt="" loading="lazy"' +
            ' onerror="this.remove(); this.parentElement.classList.add(\'lineup-player-avatar-fallback\');">' +
          '<span class="lineup-player-shirt lineup-player-shirt-fallback-only">' + shirt + '</span>' +
        '</span>'
      );
    }

    return (
      '<span class="lineup-player-avatar lineup-player-avatar-fallback">' +
        '<span class="lineup-player-shirt">' + shirt + '</span>' +
      '</span>'
    );
  }

  function renderLineupPlayers(players) {
    if (!players || players.length === 0) return '';
    return (
      '<ul class="lineup-list">' +
      players
        .map(function (entry) {
          const hasPhoto = !!getPlayerImageUrl(entry);
          const label = hasPhoto
            ? (entry.name || '')
            : (entry.shirt ? entry.shirt + '. ' : '') + (entry.name || '');
          return (
            '<li class="lineup-player">' +
              renderLineupPlayerAvatar(entry) +
              '<span class="lineup-player-name">' + escapeHtml(label) + '</span>' +
            '</li>'
          );
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

  function renderRecentMatchesTable(matches) {
    if (!matches || !matches.length) {
      return '<p class="match-info-empty">Chưa có dữ liệu</p>';
    }

    const rows = matches
      .map(function (m) {
        return (
          '<tr>' +
            '<td>' + escapeHtml(formatShortDate(m.date)) + '</td>' +
            '<td>' + escapeHtml(m.matchLabel || '-') + '</td>' +
            '<td>' + escapeHtml(m.score || '-') + '</td>' +
            '<td>' + renderFormBadge(m.result) + '</td>' +
          '</tr>'
        );
      })
      .join('');

    return (
      '<div class="table-wrapper">' +
        '<table class="data-table recent-form-table">' +
          '<thead><tr><th>Ngày</th><th>Trận</th><th>Tỷ số</th><th>KT</th></tr></thead>' +
          '<tbody>' + rows + '</tbody>' +
        '</table>' +
      '</div>'
    );
  }

  function renderVenueFormBlock(label, stats) {
    if (!stats) return '';
    return (
      '<div class="venue-form-block">' +
        '<div class="venue-form-title">' + escapeHtml(label) + '</div>' +
        '<table class="data-table venue-form-table">' +
          '<thead><tr><th>Loại</th><th>W</th><th>D</th><th>L</th></tr></thead>' +
          '<tbody>' +
            '<tr><td>Sân nhà</td><td>' + stats.home.w + '</td><td>' + stats.home.d + '</td><td>' + stats.home.l + '</td></tr>' +
            '<tr><td>Sân khách</td><td>' + stats.away.w + '</td><td>' + stats.away.d + '</td><td>' + stats.away.l + '</td></tr>' +
          '</tbody>' +
        '</table>' +
      '</div>'
    );
  }

  function renderFormSection(fotmob, match) {
    const form = fotmob && fotmob.form;
    const recent = (fotmob && fotmob.recentMatches) || (form && form.recentMatches);
    if (!form && !recent) {
      return '<p class="match-info-empty">Chưa có dữ liệu phong độ</p>';
    }

    const homeName = match.homeTeam.shortName || match.homeTeam.name;
    const awayName = match.awayTeam.shortName || match.awayTeam.name;
    let html = '';

    if (form && ((form.home && form.home.length) || (form.away && form.away.length))) {
      html +=
        '<div class="form-section">' +
          '<div class="form-row">' +
            '<span class="form-team">' + escapeHtml(homeName) + '</span>' +
            '<span class="form-badges">' + (form.home || []).map(renderFormBadge).join('') + '</span>' +
          '</div>' +
          '<div class="form-row">' +
            '<span class="form-team">' + escapeHtml(awayName) + '</span>' +
            '<span class="form-badges">' + (form.away || []).map(renderFormBadge).join('') + '</span>' +
          '</div>' +
        '</div>';
    }

    if (recent) {
      html +=
        '<div class="recent-matches-group">' +
          '<div class="recent-matches-team">' + escapeHtml(homeName) + '</div>' +
          renderRecentMatchesTable(recent.home) +
          '<div class="recent-matches-team">' + escapeHtml(awayName) + '</div>' +
          renderRecentMatchesTable(recent.away) +
        '</div>';
    }

    return html || '<p class="match-info-empty">Chưa có dữ liệu phong độ</p>';
  }

  function renderVenueFormSection(fotmob, match) {
    const venueForm = fotmob && fotmob.venueForm;
    if (!venueForm) {
      return '<p class="match-info-empty">Chưa có thống kê sân nhà / sân khách</p>';
    }

    const homeName = match.homeTeam.shortName || match.homeTeam.name;
    const awayName = match.awayTeam.shortName || match.awayTeam.name;

    return (
      renderVenueFormBlock(homeName, venueForm.home) +
      renderVenueFormBlock(awayName, venueForm.away)
    );
  }

  function renderProbabilitiesSection(fotmob, match, insights) {
    const probs = getWinProbability(fotmob, insights);
    if (!probs) {
      return (
        '<p class="match-info-empty">Chưa có xác suất từ FotMob.</p>' +
        '<p class="match-info-hint">Có thể nhập thủ công vào sheet MatchInsights: cột G/H/I (home/draw/away %).</p>'
      );
    }

    const homeName = match.homeTeam.shortName || match.homeTeam.name;
    const awayName = match.awayTeam.shortName || match.awayTeam.name;
    const sourceLabel = getProbabilitySourceLabel(probs.source);
    const oddsNote = probs.odds
      ? '<p class="prob-odds">Kèo 1X2: ' +
        probs.odds.home + ' / ' + probs.odds.draw + ' / ' + probs.odds.away +
        '</p>'
      : '';

    return (
      '<div class="prob-table-wrap">' +
        '<table class="data-table prob-table">' +
          '<thead><tr><th>Kết quả</th><th>Xác suất</th></tr></thead>' +
          '<tbody>' +
            '<tr><td>' + escapeHtml(homeName) + ' thắng</td><td><strong>' + probs.home + '%</strong></td></tr>' +
            '<tr><td>Hòa</td><td><strong>' + probs.draw + '%</strong></td></tr>' +
            '<tr><td>' + escapeHtml(awayName) + ' thắng</td><td><strong>' + probs.away + '%</strong></td></tr>' +
          '</tbody>' +
        '</table>' +
      '</div>' +
      oddsNote +
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
      '<p class="prob-source">Nguồn: ' + escapeHtml(sourceLabel) + '</p>'
    );
  }

  function renderFifaRankingSection(fotmob, match) {
    const ranks = fotmob && fotmob.fifaRanking;
    if (!ranks || (ranks.home === null && ranks.away === null)) {
      return '<p class="match-info-empty">Chưa có thứ hạng FIFA</p>';
    }

    const homeName = match.homeTeam.shortName || match.homeTeam.name;
    const awayName = match.awayTeam.shortName || match.awayTeam.name;

    return (
      '<table class="data-table compact-table">' +
        '<thead><tr><th>Đội</th><th>FIFA</th></tr></thead>' +
        '<tbody>' +
          (ranks.home !== null ? '<tr><td>' + escapeHtml(homeName) + '</td><td><strong>' + ranks.home + '</strong></td></tr>' : '') +
          (ranks.away !== null ? '<tr><td>' + escapeHtml(awayName) + '</td><td><strong>' + ranks.away + '</strong></td></tr>' : '') +
        '</tbody>' +
      '</table>'
    );
  }

  function renderInjuriesSection(fotmob, insights, match) {
    const homeName = match.homeTeam.shortName || match.homeTeam.name;
    const awayName = match.awayTeam.shortName || match.awayTeam.name;
    const injuries = (fotmob && fotmob.injuries) || { home: [], away: [] };
    let html = '';

    function renderList(title, items) {
      if (!items || !items.length) {
        return '<p class="match-info-empty">' + escapeHtml(title) + ': chưa có thông tin</p>';
      }
      return (
        '<div class="injury-block">' +
          '<div class="injury-team">' + escapeHtml(title) + '</div>' +
          '<ul class="lineup-list">' +
            items.map(function (item) {
              return '<li>' + escapeHtml(item) + '</li>';
            }).join('') +
          '</ul>' +
        '</div>'
      );
    }

    html += renderList(homeName, injuries.home);
    html += renderList(awayName, injuries.away);

    if (insights && insights.injuries) {
      html +=
        '<div class="match-info-text match-info-supplement">' +
          escapeHtml(insights.injuries).replace(/\n/g, '<br>') +
        '</div>';
    }

    return html;
  }

  function renderMarketValueSection(fotmob, insights, match) {
    const market = (fotmob && fotmob.marketValue) || {};
    const homeName = match.homeTeam.shortName || match.homeTeam.name;
    const awayName = match.awayTeam.shortName || match.awayTeam.name;

    if (insights && insights.marketValue) {
      return (
        '<div class="match-info-text">' +
          escapeHtml(insights.marketValue).replace(/\n/g, '<br>') +
        '</div>'
      );
    }

    if (!market.home && !market.away) {
      return (
        '<p class="match-info-empty">Chưa có giá trị đội hình (Transfermarkt).</p>' +
        '<p class="match-info-hint">Nhập vào cột K sheet MatchInsights, ví dụ: Mexico €220M / South Africa €28M</p>'
      );
    }

    return (
      '<table class="data-table compact-table">' +
        '<thead><tr><th>Đội</th><th>Giá trị</th></tr></thead>' +
        '<tbody>' +
          (market.home ? '<tr><td>' + escapeHtml(homeName) + '</td><td><strong>' + escapeHtml(market.home) + '</strong></td></tr>' : '') +
          (market.away ? '<tr><td>' + escapeHtml(awayName) + '</td><td><strong>' + escapeHtml(market.away) + '</strong></td></tr>' : '') +
        '</tbody>' +
      '</table>'
    );
  }

  function renderGoalsStatsSection(fotmob, match) {
    const stats = fotmob && fotmob.goalsStats;
    const homeName = match.homeTeam.shortName || match.homeTeam.name;
    const awayName = match.awayTeam.shortName || match.awayTeam.name;

    if (!stats || (!stats.home && !stats.away)) {
      return '<p class="match-info-empty">Chưa có chỉ số ghi bàn / thủng lưới</p>';
    }

    function row(name, data) {
      if (!data) return '';
      return (
        '<tr>' +
          '<td>' + escapeHtml(name) + '</td>' +
          '<td>' + escapeHtml(data.scored) + '/trận</td>' +
          '<td>' + escapeHtml(data.conceded) + '/trận</td>' +
        '</tr>'
      );
    }

    return (
      '<table class="data-table compact-table">' +
        '<thead><tr><th>Đội</th><th>Ghi bàn</th><th>Thủng lưới</th></tr></thead>' +
        '<tbody>' +
          row(homeName, stats.home) +
          row(awayName, stats.away) +
        '</tbody>' +
      '</table>'
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
            '<td>' + escapeHtml(m.home) + ' ' + escapeHtml(m.score || '-') + ' ' + escapeHtml(m.away) + '</td>' +
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

  function buildPlayerPickPieGradient(stats) {
    if (!stats || !stats.total) return '#e5e7eb';

    const homeEnd = (stats.home / stats.total) * 100;
    const drawEnd = homeEnd + (stats.draw / stats.total) * 100;

    return (
      'conic-gradient(#16a34a 0% ' + homeEnd + '%, ' +
      '#4f46e5 ' + homeEnd + '% ' + drawEnd + '%, ' +
      '#d97706 ' + drawEnd + '% 100%)'
    );
  }

  function renderMissingPredictionsList(stats) {
    const missing = (stats && stats.notPredicted) || [];
    if (!missing.length) {
      return '<p class="match-info-empty">Tất cả người chơi đã dự đoán trận này</p>';
    }

    const names = missing
      .map(function (user) {
        return escapeHtml(user.fullName || user.username);
      })
      .join(', ');

    const expectedTotal = stats.expectedTotal || missing.length + (stats.total || 0);

    return (
      '<div class="missing-predictions-list">' +
        '<p class="missing-predictions-summary">' +
          escapeHtml(String(missing.length) + '/' + expectedTotal + ' người chưa dự đoán') +
        '</p>' +
        '<p class="missing-predictions-names">' + names + '</p>' +
      '</div>'
    );
  }

  function buildMatchPickGroups(match, predictions, activePlayers) {
    const players = getActivePlayers(activePlayers || []);
    const nameMap = {};
    players.forEach(function (player) {
      nameMap[player.username] = player.fullName || player.username;
    });

    const groups = {
      HOME: [],
      DRAW: [],
      AWAY: [],
      counts: { HOME: 0, DRAW: 0, AWAY: 0, total: 0 },
    };

    (predictions || []).forEach(function (pred) {
      if (String(pred.matchId) !== String(match.id)) return;
      if (!nameMap[pred.username]) return;
      const pick = String(pred.prediction || '').toUpperCase();
      if (pick !== 'HOME' && pick !== 'DRAW' && pick !== 'AWAY') return;

      groups.counts[pick]++;
      groups.counts.total++;
      groups[pick].push({
        username: pred.username,
        fullName: nameMap[pred.username],
        prediction: pick,
      });
    });

    groups.HOME.sort(function (a, b) {
      return a.fullName.localeCompare(b.fullName, 'vi');
    });
    groups.DRAW.sort(function (a, b) {
      return a.fullName.localeCompare(b.fullName, 'vi');
    });
    groups.AWAY.sort(function (a, b) {
      return a.fullName.localeCompare(b.fullName, 'vi');
    });

    return groups;
  }

  function getMajorityPick(counts) {
    if (!counts || !counts.total) return null;
    let majority = 'HOME';
    if (counts.DRAW >= counts.HOME && counts.DRAW >= counts.AWAY) majority = 'DRAW';
    if (counts.AWAY >= counts.HOME && counts.AWAY >= counts.DRAW) majority = 'AWAY';
    return majority;
  }

  function renderPickName(player, match, counts, actual) {
    let className = 'pick-name';
    let badge = '';

    if (match.status === 'FINISHED' && actual && player.prediction === actual) {
      className += ' pick-name-correct';
    }

    if (
      isInTodayOrYesterdayNoonDay(match.utcDate) &&
      match.status === 'FINISHED' &&
      actual &&
      player.prediction === actual &&
      isMinorityPick(counts, player.prediction)
    ) {
      className += ' pick-name-contrarian';
      badge = ' <span class="pick-contrarian-badge">Ngược đám đông</span>';
    }

    return (
      '<li class="' + className + '">' +
        escapeHtml(player.fullName) + badge +
      '</li>'
    );
  }

  function renderPickBreakdown(match, predictions, activePlayers) {
    const locked = isMatchLocked(match.utcDate);
    if (!locked) {
      return (
        '<p class="match-info-hint pick-breakdown-hint">' +
          'Tên người chơi sẽ hiện sau khi trận bắt đầu.' +
        '</p>'
      );
    }

    const groups = buildMatchPickGroups(match, predictions, activePlayers);
    if (!groups.counts.total) {
      return '<p class="match-info-empty">Chưa có dự đoán nào</p>';
    }

    const actual = getActualResult(match);
    const majorityPick = getMajorityPick(groups.counts);
    const counts = groups.counts;

    const homeName = match.homeTeam.shortName || match.homeTeam.name;
    const awayName = match.awayTeam.shortName || match.awayTeam.name;
    const columns = [
      { key: 'HOME', label: homeName + ' thắng' },
      { key: 'DRAW', label: 'Hòa' },
      { key: 'AWAY', label: awayName + ' thắng' },
    ];

    let html = '<div class="pick-breakdown">';
    columns.forEach(function (col) {
      const isMajority = col.key === majorityPick;
      html +=
        '<div class="pick-breakdown-col' + (isMajority ? ' pick-breakdown-majority' : '') + '">' +
          '<h4 class="match-info-subtitle">' + escapeHtml(col.label) + '</h4>' +
          '<ul class="pick-breakdown-list">';

      if (!groups[col.key].length) {
        html += '<li class="pick-name pick-name-empty">—</li>';
      } else {
        groups[col.key].forEach(function (player) {
          html += renderPickName(player, match, counts, actual);
        });
      }

      html += '</ul></div>';
    });
    html += '</div>';
    return html;
  }

  function renderPlayerPickChart(stats, match, pickContext) {
    const homeName = match.homeTeam.shortName || match.homeTeam.name;
    const awayName = match.awayTeam.shortName || match.awayTeam.name;
    const missingHtml = renderMissingPredictionsList(stats);
    const locked = isMatchLocked(match.utcDate);
    const breakdownHtml = pickContext
      ? renderPickBreakdown(match, pickContext.predictions, pickContext.activePlayers)
      : '';

    if (!stats || !stats.total) {
      return (
        '<p class="match-info-empty">Chưa có người chơi nào chọn trận này</p>' +
        '<div class="match-info-subsection">' +
          '<h4 class="match-info-subtitle">Người chưa dự đoán</h4>' +
          missingHtml +
        '</div>' +
        (locked
          ? '<div class="match-info-subsection">' +
              '<h4 class="match-info-subtitle">Ai chọn gì</h4>' +
              breakdownHtml +
            '</div>'
          : '')
      );
    }

    const pieStyle = 'background:' + buildPlayerPickPieGradient(stats);

    return (
      '<div class="player-pick-chart">' +
        '<div class="player-pick-pie-wrap">' +
          '<div class="player-pick-pie" style="' + pieStyle + '"></div>' +
          '<div class="player-pick-pie-center">' +
            '<span class="player-pick-pie-total">' + stats.total + '</span>' +
            '<span class="player-pick-pie-label">lượt chọn</span>' +
          '</div>' +
        '</div>' +
        '<ul class="player-pick-legend">' +
          '<li class="player-pick-legend-item">' +
            '<span class="player-pick-dot player-pick-dot-home"></span>' +
            '<span class="player-pick-legend-text">' + escapeHtml(homeName) + ' thắng</span>' +
            '<span class="player-pick-legend-value">' + stats.home + ' (' + stats.homePct + '%)</span>' +
          '</li>' +
          '<li class="player-pick-legend-item">' +
            '<span class="player-pick-dot player-pick-dot-draw"></span>' +
            '<span class="player-pick-legend-text">Hòa</span>' +
            '<span class="player-pick-legend-value">' + stats.draw + ' (' + stats.drawPct + '%)</span>' +
          '</li>' +
          '<li class="player-pick-legend-item">' +
            '<span class="player-pick-dot player-pick-dot-away"></span>' +
            '<span class="player-pick-legend-text">' + escapeHtml(awayName) + ' thắng</span>' +
            '<span class="player-pick-legend-value">' + stats.away + ' (' + stats.awayPct + '%)</span>' +
          '</li>' +
        '</ul>' +
      '</div>' +
      '<div class="match-info-subsection">' +
        '<h4 class="match-info-subtitle">Người chưa dự đoán</h4>' +
        missingHtml +
      '</div>' +
      '<div class="match-info-subsection">' +
        '<h4 class="match-info-subtitle">Ai chọn gì</h4>' +
        breakdownHtml +
      '</div>'
    );
  }

  function renderPickSection(fotmob, insights, match) {
    const probs = getWinProbability(fotmob, insights);
    const sheetPick = insights && insights.pickSuggestion;
    const fotmobPick =
      (fotmob && fotmob.pickSuggestion) || derivePickFromProbability(probs);
    const pick = sheetPick || fotmobPick;

    if (!pick) {
      return (
        '<p class="match-info-empty">Chưa có gợi ý — cần kèo châu Âu hoặc xác suất thắng/hòa/thua.</p>' +
        '<p class="match-info-hint">Nhập xác suất vào cột G/H/I hoặc pick vào cột D sheet MatchInsights.</p>'
      );
    }

    const label = getPredictionLabel(pick, match);
    let note = (insights && insights.pickNote) || (fotmob && fotmob.pickNote) || '';

    if (!note && probs) {
      note = formatProbabilityNote(probs);
    }

    let html =
      '<div class="pick-suggestion">' +
        '<span class="pick-badge pick-' + escapeHtml(pick.toLowerCase()) + '">' +
          escapeHtml(label) +
        '</span>';

    if (note) {
      html += '<p class="pick-note">' + escapeHtml(note).replace(/\n/g, '<br>') + '</p>';
    }

    if (!sheetPick && fotmobPick) {
      const autoLabel = probs && probs.odds
        ? 'Gợi ý tự động từ kèo châu Âu'
        : 'Gợi ý tự động từ xác suất';
      html += '<p class="pick-note pick-note-muted">' + escapeHtml(autoLabel) + '</p>';
    }

    html += '</div>';
    return html;
  }

  function renderMatchInfoContent(match, fotmob, insights, pickStats, pickContext) {
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
        '<h3 class="match-info-section-title">Xác suất thắng / hòa / thua</h3>' +
        renderProbabilitiesSection(fotmob, match, insights) +
      '</section>' +
      '<section class="match-info-section">' +
        '<h3 class="match-info-section-title">Thứ hạng FIFA</h3>' +
        renderFifaRankingSection(fotmob, match) +
      '</section>' +
      '<section class="match-info-section">' +
        '<h3 class="match-info-section-title">Phong độ 5 trận gần nhất</h3>' +
        renderFormSection(fotmob, match) +
      '</section>' +
      '<section class="match-info-section">' +
        '<h3 class="match-info-section-title">Thành tích sân nhà / sân khách</h3>' +
        renderVenueFormSection(fotmob, match) +
      '</section>' +
      '<section class="match-info-section">' +
        '<h3 class="match-info-section-title">Tình trạng lực lượng</h3>' +
        renderInjuriesSection(fotmob, insights, match) +
      '</section>' +
      '<section class="match-info-section">' +
        '<h3 class="match-info-section-title">Giá trị đội hình</h3>' +
        renderMarketValueSection(fotmob, insights, match) +
      '</section>' +
      '<section class="match-info-section">' +
        '<h3 class="match-info-section-title">Chỉ số ghi bàn / thủng lưới</h3>' +
        renderGoalsStatsSection(fotmob, match) +
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
        '<h3 class="match-info-section-title">Tỷ lệ chọn của người chơi</h3>' +
        renderPlayerPickChart(pickStats, match, pickContext) +
      '</section>' +
      '<section class="match-info-section">' +
        '<h3 class="match-info-section-title">Gợi ý chọn</h3>' +
        renderPickSection(fotmob, insights, match) +
      '</section>'
    );
  }

  async function openMatchInfoModal(match, context) {
    const home = match.homeTeam.shortName || match.homeTeam.name;
    const away = match.awayTeam.shortName || match.awayTeam.name;

    titleEl.textContent = home + ' vs ' + away;
    bodyEl.innerHTML =
      '<div class="match-info-loading"><div class="spinner"></div><p>Đang tải từ FotMob...</p></div>';
    modal.classList.remove('hidden');
    document.body.classList.add('modal-open');

    try {
      let pickContext = context || null;
      const needsPredictions =
        isMatchLocked(match.utcDate) &&
        (!pickContext || !pickContext.predictions);

      const fetchTasks = [
        loadFotMobMatchInfo(match),
        getMatchInsightsData(match.id),
        getMatchPredictionStatsData(match.id),
      ];

      if (needsPredictions) {
        const session = getSession();
        if (session) {
          fetchTasks.push(
            getPredictions(session.username, session.passwordHash).then(function (data) {
              return {
                predictions: data.predictions || [],
                activePlayers: getActivePlayers(data.activeUsers || []),
              };
            })
          );
        }
      }

      const results = await Promise.allSettled(fetchTasks);

      const fotmob = results[0].status === 'fulfilled' ? results[0].value : null;
      const insights = results[1].status === 'fulfilled' ? results[1].value : null;
      const pickStats = results[2].status === 'fulfilled' ? results[2].value : null;

      if (needsPredictions && results[3] && results[3].status === 'fulfilled') {
        pickContext = results[3].value;
      } else if (pickContext && pickContext.activePlayers) {
        pickContext.activePlayers = getActivePlayers(pickContext.activePlayers);
      } else if (pickContext && pickContext.activeUsers) {
        pickContext.activePlayers = getActivePlayers(pickContext.activeUsers);
      }

      const fotmobError =
        results[0].status === 'rejected'
          ? (results[0].reason && results[0].reason.message) || 'Không tải được FotMob'
          : '';

      if (!fotmob && !insights) {
        throw results[0].status === 'rejected' ? results[0].reason : new Error('Không có dữ liệu');
      }

      let html = '';
      if (fotmobError && !fotmob) {
        html += '<div class="match-info-fallback-banner">' + escapeHtml(fotmobError) + '</div>';
      }
      html += renderMatchInfoContent(match, fotmob, insights, pickStats, pickContext);
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
