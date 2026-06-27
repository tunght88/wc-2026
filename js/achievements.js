const ACHIEVEMENT_DEFS = {
  oracle: { id: 'oracle', label: 'Oracle', title: 'Dự đoán đúng trận chung kết' },
  'perfect-day': { id: 'perfect-day', label: 'Perfect Day', title: 'Dự đoán đúng hết trong ngày (12h–12h)' },
  contrarian: {
    id: 'contrarian',
    label: 'Ngược đám đông',
    title: 'Dự đoán đúng kết quả ít người chọn nhất (hôm nay + hôm qua, 12h–12h)',
  },
  'knockout-king': { id: 'knockout-king', label: 'Vua knock-out', title: 'Nhiều dự đoán đúng nhất ở vòng knock-out' },
};

function getFinishedMatchesSorted(matches) {
  return getFinishedMatchesWithResult(matches).sort(function (a, b) {
    return new Date(a.utcDate).getTime() - new Date(b.utcDate).getTime();
  });
}

function computeCurrentStreak(username, predictions, matches) {
  const predMap = buildUserPredictionMap(predictions, username);
  const finished = getFinishedMatchesSorted(matches);
  let streak = 0;

  for (let i = finished.length - 1; i >= 0; i--) {
    const match = finished[i];
    const prediction = predMap[String(match.id)];
    const actual = getActualResult(match);

    if (!prediction || !actual) {
      break;
    }
    if (prediction === actual) {
      streak++;
    } else {
      break;
    }
  }

  return streak;
}

function computePerfectDays(username, predictions, matches) {
  const predMap = buildUserPredictionMap(predictions, username);
  const finished = getFinishedMatchesWithResult(matches);
  const dayMap = {};

  finished.forEach(function (match) {
    if (!isInNoonDay(match.utcDate)) return;
    const prediction = predMap[String(match.id)];
    if (!prediction) return;

    const window = getNoonDayWindow(new Date(match.utcDate));
    const dayKey = window.start.getTime();
    if (!dayMap[dayKey]) {
      dayMap[dayKey] = {
        start: window.start,
        predicted: 0,
        correct: 0,
        wrong: 0,
      };
    }

    const actual = getActualResult(match);
    dayMap[dayKey].predicted++;
    if (prediction === actual) {
      dayMap[dayKey].correct++;
    } else {
      dayMap[dayKey].wrong++;
    }
  });

  const perfectDays = [];
  Object.keys(dayMap).forEach(function (key) {
    const day = dayMap[key];
    if (day.predicted > 0 && day.wrong === 0) {
      perfectDays.push({
        date: day.start,
        label: formatNoonDayLabel(day.start),
        count: day.correct,
      });
    }
  });

  perfectDays.sort(function (a, b) {
    return a.date.getTime() - b.date.getTime();
  });

  return perfectDays;
}

function hasOracleBadge(username, predictions, matches) {
  const predMap = buildUserPredictionMap(predictions, username);
  return matches.some(function (match) {
    if (match.stage !== 'FINAL' || match.status !== 'FINISHED') return false;
    const prediction = predMap[String(match.id)];
    const actual = getActualResult(match);
    return prediction && actual && prediction === actual;
  });
}

function hasContrarianBadge(username, predictions, matches, activePlayers) {
  const players = getActivePlayers(activePlayers);
  const predMap = buildPredictionMap(predictions);

  return matches.some(function (match) {
    if (!isInTodayOrYesterdayNoonDay(match.utcDate)) return false;
    if (match.status !== 'FINISHED') return false;

    const actual = getActualResult(match);
    if (!actual) return false;

    const userPrediction = predMap[username] && predMap[username][String(match.id)];
    if (!userPrediction || userPrediction !== actual) return false;

    const counts = buildMatchPickCounts(match.id, predMap, players);
    return isMinorityPick(counts, userPrediction);
  });
}

function countKnockoutCorrect(username, predictions, matches) {
  const predMap = buildUserPredictionMap(predictions, username);
  let correct = 0;

  matches.forEach(function (match) {
    if (!isKnockoutStage(match.stage) || match.status !== 'FINISHED') return;
    const prediction = predMap[String(match.id)];
    const actual = getActualResult(match);
    if (prediction && actual && prediction === actual) {
      correct++;
    }
  });

  return correct;
}

function computeKnockoutLeader(players, predictions, matches) {
  let leader = null;

  players.forEach(function (player) {
    const correct = countKnockoutCorrect(player.username, predictions, matches);
    if (!leader || correct > leader.correct) {
      leader = {
        username: player.username,
        fullName: player.fullName,
        correct: correct,
      };
    } else if (leader && correct === leader.correct && correct > 0) {
      if (player.fullName.localeCompare(leader.fullName, 'vi') < 0) {
        leader = {
          username: player.username,
          fullName: player.fullName,
          correct: correct,
        };
      }
    }
  });

  return leader && leader.correct > 0 ? leader : null;
}

function computeUserAchievements(username, predictions, matches, activePlayers) {
  const badges = [];
  const perfectDays = computePerfectDays(username, predictions, matches);
  const knockoutCorrect = countKnockoutCorrect(username, predictions, matches);
  const knockoutLeader = computeKnockoutLeader(
    getActivePlayers(activePlayers),
    predictions,
    matches
  );

  if (hasOracleBadge(username, predictions, matches)) {
    badges.push(ACHIEVEMENT_DEFS.oracle);
  }
  if (perfectDays.length > 0) {
    badges.push(ACHIEVEMENT_DEFS['perfect-day']);
  }
  if (hasContrarianBadge(username, predictions, matches, activePlayers)) {
    badges.push(ACHIEVEMENT_DEFS.contrarian);
  }
  if (knockoutLeader && knockoutLeader.username === username) {
    badges.push(ACHIEVEMENT_DEFS['knockout-king']);
  }

  return {
    streak: computeCurrentStreak(username, predictions, matches),
    badges: badges,
    perfectDays: perfectDays,
    knockoutCorrect: knockoutCorrect,
  };
}

function renderAchievementBadges(badges, maxVisible) {
  const limit = maxVisible || 3;
  const visible = (badges || []).slice(0, limit);
  const hidden = (badges || []).slice(limit);

  let html = '<div class="achievement-badges">';
  visible.forEach(function (badge) {
    html +=
      '<span class="achievement-badge" title="' + escapeHtml(badge.title) + '">' +
        escapeHtml(badge.label) +
      '</span>';
  });
  if (hidden.length > 0) {
    const titles = hidden.map(function (b) {
      return b.label;
    }).join(', ');
    html +=
      '<span class="achievement-badge achievement-badge-more" title="' + escapeHtml(titles) + '">' +
        '+' + hidden.length +
      '</span>';
  }
  html += '</div>';
  return html;
}
