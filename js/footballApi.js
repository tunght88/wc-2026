const CACHE_KEY = 'wc2026_matches_cache_v2';
const CACHE_TTL = 5 * 60 * 1000;

const STAGE_FILTERS = {
  all: { label: 'Tất cả', stages: [] },
  group: { label: 'Vòng bảng', stages: ['GROUP_STAGE'] },
  r32: { label: 'Vòng 32', stages: ['LAST_32', 'ROUND_OF_32'] },
  r16: { label: 'Vòng 16', stages: ['LAST_16', 'ROUND_OF_16'] },
  qf: { label: 'Tứ kết', stages: ['QUARTER_FINALS'] },
  sf: { label: 'Bán kết', stages: ['SEMI_FINALS'] },
  final: { label: 'Chung kết', stages: ['FINAL', 'THIRD_PLACE'] },
};

const STAGE_LABELS = {
  GROUP_STAGE: 'Vòng bảng',
  LAST_32: 'Vòng 32',
  ROUND_OF_32: 'Vòng 32',
  LAST_16: 'Vòng 16',
  ROUND_OF_16: 'Vòng 16',
  QUARTER_FINALS: 'Tứ kết',
  SEMI_FINALS: 'Bán kết',
  FINAL: 'Chung kết',
  THIRD_PLACE: 'Tranh hạng 3',
};

const STAGE_PENALTIES = {
  GROUP_STAGE: 1,
  LAST_32: 2,
  ROUND_OF_32: 2,
  LAST_16: 3,
  ROUND_OF_16: 3,
  QUARTER_FINALS: 4,
  SEMI_FINALS: 5,
  THIRD_PLACE: 10,
  FINAL: 20,
};

const STAGE_PENALTY_LEGEND = [
  { label: 'Vòng bảng', penalty: 1, stages: ['GROUP_STAGE'] },
  { label: 'Vòng 32 đội', penalty: 2, stages: ['LAST_32', 'ROUND_OF_32'] },
  { label: 'Vòng 16 đội', penalty: 3, stages: ['LAST_16', 'ROUND_OF_16'] },
  { label: 'Tứ kết', penalty: 4, stages: ['QUARTER_FINALS'] },
  { label: 'Bán kết', penalty: 5, stages: ['SEMI_FINALS'] },
  { label: 'Tranh hạng 3-4', penalty: 10, stages: ['THIRD_PLACE'] },
  { label: 'Chung kết', penalty: 20, stages: ['FINAL'] },
];

const LEADERBOARD_STAGE_FILTERS = [
  { key: 'group', label: 'Vòng bảng', stages: ['GROUP_STAGE'] },
  { key: 'r32', label: 'Vòng 32', stages: ['LAST_32', 'ROUND_OF_32'] },
  { key: 'r16', label: 'Vòng 16', stages: ['LAST_16', 'ROUND_OF_16'] },
  { key: 'qf', label: 'Tứ kết', stages: ['QUARTER_FINALS'] },
  { key: 'sf', label: 'Bán kết', stages: ['SEMI_FINALS'] },
  { key: 'third', label: 'Tranh hạng 3', stages: ['THIRD_PLACE'] },
  { key: 'final', label: 'Chung kết', stages: ['FINAL'] },
];

function getAllLeaderboardStageFilterKeys() {
  return LEADERBOARD_STAGE_FILTERS.map(function (filter) {
    return filter.key;
  });
}

function filterMatchesByLeaderboardStages(matches, selectedKeys) {
  if (!selectedKeys || !selectedKeys.length) return [];
  const allKeys = getAllLeaderboardStageFilterKeys();
  if (selectedKeys.length >= allKeys.length) return matches;

  const stageSet = {};
  LEADERBOARD_STAGE_FILTERS.forEach(function (filter) {
    if (selectedKeys.indexOf(filter.key) === -1) return;
    filter.stages.forEach(function (stage) {
      stageSet[stage] = true;
    });
  });

  return matches.filter(function (match) {
    return !!stageSet[match.stage];
  });
}

function getLeaderboardStageFilterSummary(selectedKeys) {
  if (!selectedKeys || !selectedKeys.length) return 'Chưa chọn vòng nào';
  const allKeys = getAllLeaderboardStageFilterKeys();
  if (selectedKeys.length >= allKeys.length) return 'Tất cả vòng';

  const labels = LEADERBOARD_STAGE_FILTERS.filter(function (filter) {
    return selectedKeys.indexOf(filter.key) !== -1;
  }).map(function (filter) {
    return filter.label;
  });

  return labels.join(', ');
}

function getStagePenalty(stage) {
  return STAGE_PENALTIES[stage] || 1;
}

function isHopeStarActive(value) {
  if (value === true || value === 1) return true;
  if (typeof value === 'string') {
    return value.toUpperCase() === 'TRUE' || value === '1';
  }
  return false;
}

const HOPE_STAR_CORRECT_MULTIPLIER = 2;
const HOPE_STAR_WRONG_MULTIPLIER = 2;

function computeMatchPenaltyPoints(match, prediction, hopeStar) {
  const basePenalty = getStagePenalty(match.stage);
  if (!prediction) return basePenalty;
  const actual = getActualResult(match);
  if (!actual) return null;
  if (prediction === actual) {
    return hopeStar ? -basePenalty * HOPE_STAR_CORRECT_MULTIPLIER : 0;
  }
  return hopeStar ? basePenalty * HOPE_STAR_WRONG_MULTIPLIER : basePenalty;
}

function formatPenaltyLabel(points) {
  if (points === null || points === undefined) return '-';
  if (points === 0) return '0';
  if (points > 0) return '+' + points;
  return String(points);
}

function buildHopeStarByMatchMap(predictions, username) {
  const map = {};
  (predictions || []).forEach(function (prediction) {
    if (prediction.username !== username) return;
    if (isHopeStarActive(prediction.hopeStar)) {
      map[String(prediction.matchId)] = true;
    }
  });
  return map;
}

function getFinishedMatchesWithResult(matches) {
  return matches.filter(function (m) {
    return m.status === 'FINISHED' && getActualResult(m);
  });
}

const GROUP_TIMEZONE = 'Asia/Ho_Chi_Minh';

function getMatchDateInGroupTimezone(utcDate) {
  if (!utcDate) return '';
  try {
    return new Date(utcDate).toLocaleDateString('en-CA', { timeZone: GROUP_TIMEZONE });
  } catch {
    return String(utcDate).slice(0, 10);
  }
}

function isMatchEligibleForGroup(match, startDate) {
  if (!startDate) return true;
  if (!match || !match.utcDate) return true;
  return getMatchDateInGroupTimezone(match.utcDate) >= startDate;
}

function filterMatchesForGroup(matches, startDate) {
  if (!startDate) return matches;
  return matches.filter(function (m) {
    return isMatchEligibleForGroup(m, startDate);
  });
}

function buildPredictionMap(predictions) {
  const map = {};
  predictions.forEach(function (p) {
    if (!map[p.username]) map[p.username] = {};
    map[p.username][String(p.matchId)] = p.prediction;
  });
  return map;
}

function buildHopeStarByMatchMapForUsers(predictions) {
  const map = {};
  (predictions || []).forEach(function (prediction) {
    if (!isHopeStarActive(prediction.hopeStar)) return;
    if (!map[prediction.username]) map[prediction.username] = {};
    map[prediction.username][String(prediction.matchId)] = true;
  });
  return map;
}

function getActivePlayers(activeUsers) {
  return (activeUsers || []).filter(function (user) {
    return String(user.role || 'USER').toUpperCase() !== 'ADMIN';
  });
}

function buildPredictionMapByMatch(predictions, players) {
  const playerSet = {};
  players.forEach(function (player) {
    playerSet[player.username] = true;
  });

  const map = {};
  (predictions || []).forEach(function (prediction) {
    if (!playerSet[prediction.username]) return;
    const matchId = String(prediction.matchId);
    if (!map[matchId]) map[matchId] = {};
    map[matchId][prediction.username] = true;
  });

  return map;
}

function getMissingPlayersForMatch(matchId, players, predictionMapByMatch) {
  const predicted = predictionMapByMatch[String(matchId)] || {};
  return players.filter(function (player) {
    return !predicted[player.username];
  });
}

function renderMatchMissingPredictions(missing, expectedTotal) {
  if (!expectedTotal) return '';

  if (!missing || missing.length === 0) {
    return (
      '<div class="match-missing-predictions match-missing-complete">' +
        '<span class="match-missing-label">Dự đoán</span>' +
        '<span class="match-missing-names">Tất cả người chơi đã dự đoán (' +
          expectedTotal + '/' + expectedTotal + ')</span>' +
      '</div>'
    );
  }

  const names = missing
    .map(function (user) {
      return escapeHtml(user.fullName || user.username);
    })
    .join(', ');

  return (
    '<div class="match-missing-predictions">' +
      '<span class="match-missing-label">Chưa dự đoán (' +
        missing.length + '/' + expectedTotal + ')</span>' +
      '<span class="match-missing-names">' + names + '</span>' +
    '</div>'
  );
}

function createLeaderboardEntry(user) {
  return {
    username: user.username,
    fullName: user.fullName,
    penalties: 0,
    correct: 0,
    wrong: 0,
    missed: 0,
    total: 0,
  };
}

function computeLeaderboard(activeUsers, predictions, matches, startDate, stageFilterKeys) {
  const scores = {};
  activeUsers.forEach(function (user) {
    scores[user.username] = createLeaderboardEntry(user);
  });

  const predMap = buildPredictionMap(predictions);
  let finishedMatches = getFinishedMatchesWithResult(
    filterMatchesForGroup(matches, startDate)
  );

  if (stageFilterKeys) {
    finishedMatches = filterMatchesByLeaderboardStages(finishedMatches, stageFilterKeys);
  }

  const hopeStarMap = buildHopeStarByMatchMapForUsers(predictions);

  finishedMatches.forEach(function (match) {
    const matchId = String(match.id);
    const actual = getActualResult(match);

    activeUsers.forEach(function (user) {
      const entry = scores[user.username];
      const prediction = predMap[user.username] && predMap[user.username][matchId];
      const hopeStar = hopeStarMap[user.username] && hopeStarMap[user.username][matchId];
      const penalty = computeMatchPenaltyPoints(match, prediction, hopeStar);

      entry.total++;

      if (!prediction) {
        entry.penalties += penalty;
        entry.missed++;
      } else if (prediction === actual) {
        entry.correct++;
        if (hopeStar) entry.penalties += penalty;
      } else {
        entry.penalties += penalty;
        entry.wrong++;
      }
    });
  });

  return Object.values(scores).sort(function (a, b) {
    if (a.penalties !== b.penalties) return a.penalties - b.penalties;
    if (b.correct !== a.correct) return b.correct - a.correct;
    if (a.wrong !== b.wrong) return a.wrong - b.wrong;
    if (a.missed !== b.missed) return a.missed - b.missed;
    return a.fullName.localeCompare(b.fullName, 'vi');
  });
}

function getFootballSession() {
  const session = getSession();
  if (!session) {
    throw new Error('Chưa đăng nhập');
  }
  return session;
}

function getCachedMatches() {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const cached = JSON.parse(raw);
    if (Date.now() - cached.timestamp > CACHE_TTL) {
      sessionStorage.removeItem(CACHE_KEY);
      return null;
    }
    if (matchesCacheNeedsRefresh(cached.matches)) {
      sessionStorage.removeItem(CACHE_KEY);
      return null;
    }
    return cached.matches;
  } catch {
    return null;
  }
}

function setCachedMatches(matches) {
  sessionStorage.setItem(
    CACHE_KEY,
    JSON.stringify({ timestamp: Date.now(), matches })
  );
}

async function getMatches() {
  const cached = getCachedMatches();
  if (cached) return cached;

  const session = getFootballSession();
  const data = await getFootballMatches(
    session.username,
    session.passwordHash,
    WC_COMPETITION_CODE,
    WC_SEASON
  );
  const matches = data.matches || [];
  setCachedMatches(matches);
  return matches;
}

async function getMatch(matchId) {
  const session = getFootballSession();
  const data = await getFootballMatch(session.username, session.passwordHash, matchId);
  return data.match;
}

const MATCH_INFO_CACHE = {};

async function getMatchDetail(matchId) {
  const key = 'detail_' + matchId;
  if (MATCH_INFO_CACHE[key]) return MATCH_INFO_CACHE[key];

  const session = getFootballSession();
  const data = await getFootballMatchDetail(session.username, session.passwordHash, matchId);
  MATCH_INFO_CACHE[key] = data.match;
  return data.match;
}

async function getMatchHead2Head(matchId, limit) {
  const key = 'h2h_' + matchId + '_' + (limit || 5);
  if (MATCH_INFO_CACHE[key]) return MATCH_INFO_CACHE[key];

  const session = getFootballSession();
  const data = await getFootballMatchHead2Head(
    session.username,
    session.passwordHash,
    matchId,
    limit
  );
  MATCH_INFO_CACHE[key] = data.head2head;
  return data.head2head;
}

async function getMatchInsightsData(matchId) {
  const key = 'insights_' + matchId;
  if (MATCH_INFO_CACHE[key]) return MATCH_INFO_CACHE[key];

  const session = getFootballSession();
  const data = await getMatchInsights(session.username, session.passwordHash, matchId);
  MATCH_INFO_CACHE[key] = data.insights;
  return data.insights;
}

async function getMatchPredictionStatsData(matchId) {
  const groupId = getCurrentGroupId();
  const key = 'pickstats_' + groupId + '_' + matchId;
  if (MATCH_INFO_CACHE[key]) return MATCH_INFO_CACHE[key];

  const session = getFootballSession();
  const data = await getMatchPredictionStats(
    session.username,
    session.passwordHash,
    groupId,
    matchId
  );
  MATCH_INFO_CACHE[key] = data.stats;
  return data.stats;
}

async function loadFotMobMatchInfo(match) {
  const key = 'fotmob_' + match.id;
  if (MATCH_INFO_CACHE[key]) return MATCH_INFO_CACHE[key];

  const session = getFootballSession();
  const payload = Object.assign({}, match);
  const insights = await getMatchInsightsData(match.id);
  if (insights && insights.fotmobMatchId) {
    payload.fotmobMatchId = insights.fotmobMatchId;
  }

  const data = await getFotMobMatchInfo(session.username, session.passwordHash, payload);
  MATCH_INFO_CACHE[key] = data.fotmob;
  return data.fotmob;
}

async function getFinishedMatches() {
  const matches = await getMatches();
  return matches.filter((m) => m.status === 'FINISHED');
}

function mapWinnerToPrediction(winner) {
  const w = String(winner || '').toUpperCase();
  if (w === 'HOME_TEAM' || w === 'HOME') return 'HOME';
  if (w === 'AWAY_TEAM' || w === 'AWAY') return 'AWAY';
  if (w === 'DRAW') return 'DRAW';
  return null;
}

function getScoreGoals(scorePart) {
  if (!scorePart) return { home: null, away: null };
  let home = scorePart.home;
  let away = scorePart.away;
  if (home === undefined || home === null) home = scorePart.homeTeam;
  if (away === undefined || away === null) away = scorePart.awayTeam;
  return { home: home, away: away };
}

function deriveResultFromScore(score) {
  if (!score) return null;

  const fromWinner = mapWinnerToPrediction(score.winner);
  if (fromWinner) return fromWinner;

  const fullTime = getScoreGoals(score.fullTime);
  let home = fullTime.home;
  let away = fullTime.away;

  if (score.penalties) {
    const pen = getScoreGoals(score.penalties);
    if (pen.home !== null && pen.away !== null && pen.home !== pen.away) {
      return pen.home > pen.away ? 'HOME' : 'AWAY';
    }
  }

  if (score.extraTime) {
    const extra = getScoreGoals(score.extraTime);
    if (extra.home !== null && extra.away !== null) {
      home = extra.home;
      away = extra.away;
    }
  }

  if (home === null || home === undefined || away === null || away === undefined) {
    return null;
  }
  if (home > away) return 'HOME';
  if (away > home) return 'AWAY';
  return 'DRAW';
}

function getActualResult(match) {
  if (!match.score || match.status !== 'FINISHED') return null;
  return deriveResultFromScore(match.score);
}

function getMatchScore(match) {
  if (!match.score || !match.score.fullTime) return null;
  const goals = getScoreGoals(match.score.fullTime);
  if (goals.home === null || goals.away === null) return null;
  return goals.home + ' - ' + goals.away;
}

function matchesCacheNeedsRefresh(matches) {
  if (!matches || !matches.length) return false;

  const now = Date.now();
  const staleAfterMs = 3 * 60 * 60 * 1000;

  return matches.some(function (m) {
    if (m.status === 'FINISHED') return false;
    const kickoff = new Date(m.utcDate).getTime();
    return kickoff < now - staleAfterMs;
  });
}

function formatMatchDate(utcDate) {
  const date = new Date(utcDate);
  return date.toLocaleDateString('vi-VN', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function formatMatchTime(utcDate) {
  const date = new Date(utcDate);
  return date.toLocaleTimeString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getStageLabel(stage) {
  return STAGE_LABELS[stage] || stage;
}

function isMatchLocked(utcDate) {
  return Date.now() >= new Date(utcDate).getTime();
}

function filterMatchesByStage(matches, stageKey) {
  const filter = STAGE_FILTERS[stageKey];
  if (!filter || filter.stages.length === 0) return matches;
  return matches.filter((m) => filter.stages.includes(m.stage));
}

function filterMatchesBySearch(matches, query) {
  if (!query) return matches;
  const q = query.toLowerCase();
  return matches.filter(
    (m) =>
      m.homeTeam.name.toLowerCase().includes(q) ||
      m.awayTeam.name.toLowerCase().includes(q) ||
      (m.homeTeam.shortName && m.homeTeam.shortName.toLowerCase().includes(q)) ||
      (m.awayTeam.shortName && m.awayTeam.shortName.toLowerCase().includes(q))
  );
}

function getPredictionLabel(prediction, match) {
  if (prediction === 'HOME') return match.homeTeam.name + ' thắng';
  if (prediction === 'AWAY') return match.awayTeam.name + ' thắng';
  if (prediction === 'DRAW') return 'Hòa';
  return prediction;
}

function sortMatchesByDate(matches) {
  return [...matches].sort(
    (a, b) => new Date(a.utcDate).getTime() - new Date(b.utcDate).getTime()
  );
}

function isMatchFinished(match) {
  return match.status === 'FINISHED';
}

const TIME_FILTERS = {
  'upcoming-1d': { label: 'Sắp diễn ra: 1 ngày' },
  'upcoming-3d': { label: 'Sắp diễn ra: 3 ngày' },
  'upcoming-1w': { label: 'Sắp diễn ra: 1 tuần' },
  'upcoming-all': { label: 'Sắp diễn ra: Tất cả' },
  finished: { label: 'Đã diễn ra' },
};

const PREDICTION_FILTERS = {
  all: { label: 'Tất cả' },
  predicted: { label: 'Đã dự đoán' },
  'not-predicted': { label: 'Chưa dự đoán' },
};

function filterMatchesByTime(matches, timeKey) {
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;

  if (timeKey === 'finished') {
    return matches.filter(isMatchFinished);
  }

  return matches.filter(function (m) {
    if (isMatchFinished(m)) return false;
    const kickoff = new Date(m.utcDate).getTime();
    if (timeKey === 'upcoming-1d') return kickoff <= now + dayMs;
    if (timeKey === 'upcoming-3d') return kickoff <= now + 3 * dayMs;
    if (timeKey === 'upcoming-1w') return kickoff <= now + 7 * dayMs;
    return true;
  });
}

function filterMatchesByPrediction(matches, userPredictions, predKey) {
  if (predKey === 'predicted') {
    return matches.filter(function (m) {
      return !!userPredictions[String(m.id)];
    });
  }
  if (predKey === 'not-predicted') {
    return matches.filter(function (m) {
      return !userPredictions[String(m.id)];
    });
  }
  return matches;
}

function getPredictionResultStatus(match, prediction) {
  if (!prediction) return 'none';
  const actual = getActualResult(match);
  if (!actual) return 'pending';
  return prediction === actual ? 'correct' : 'wrong';
}

const KNOCKOUT_STAGES = [
  'LAST_32',
  'ROUND_OF_32',
  'LAST_16',
  'ROUND_OF_16',
  'QUARTER_FINALS',
  'SEMI_FINALS',
  'THIRD_PLACE',
  'FINAL',
];

function isKnockoutStage(stage) {
  return KNOCKOUT_STAGES.indexOf(stage) !== -1;
}

function getNoonDayWindow(now) {
  const ref = now ? new Date(now) : new Date();
  const noon = new Date(ref);
  noon.setHours(12, 0, 0, 0);

  let start = noon;
  if (ref.getTime() < noon.getTime()) {
    start = new Date(noon);
    start.setDate(start.getDate() - 1);
  }

  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start: start, end: end };
}

function isInNoonDay(utcDate, now) {
  const kickoff = new Date(utcDate).getTime();
  if (isNaN(kickoff)) return false;
  const window = getNoonDayWindow(now);
  return kickoff >= window.start.getTime() && kickoff < window.end.getTime();
}

function getYesterdayNoonDayWindow(now) {
  const todayStart = getNoonDayWindow(now).start;
  const start = new Date(todayStart);
  start.setDate(start.getDate() - 1);
  return { start: start, end: new Date(todayStart) };
}

function isInTodayOrYesterdayNoonDay(utcDate, now) {
  if (isInNoonDay(utcDate, now)) return true;
  const yesterday = getYesterdayNoonDayWindow(now);
  const kickoff = new Date(utcDate).getTime();
  if (isNaN(kickoff)) return false;
  return kickoff >= yesterday.start.getTime() && kickoff < yesterday.end.getTime();
}

function buildMatchPickCounts(matchId, predMap, players) {
  const counts = { HOME: 0, DRAW: 0, AWAY: 0, total: 0 };
  (players || []).forEach(function (player) {
    const pick = predMap[player.username] && predMap[player.username][String(matchId)];
    if (!pick) return;
    const normalized = String(pick).toUpperCase();
    if (normalized !== 'HOME' && normalized !== 'DRAW' && normalized !== 'AWAY') return;
    counts[normalized]++;
    counts.total++;
  });
  return counts;
}

function isMinorityPick(counts, prediction) {
  if (!counts || counts.total < 3 || !prediction) return false;
  const pick = String(prediction).toUpperCase();
  const pickCount = counts[pick];
  if (!pickCount) return false;

  const home = counts.HOME;
  const draw = counts.DRAW;
  const away = counts.AWAY;
  const maxCount = Math.max(home, draw, away);
  const minCount = Math.min(home, draw, away);

  if (pickCount >= maxCount || minCount >= maxCount) return false;

  const tiedAtMin = [home, draw, away].filter(function (c) {
    return c === minCount;
  }).length;

  return pickCount === minCount && tiedAtMin === 1;
}

function computeMatchPickStats(matchId, predMap, players) {
  const counts = buildMatchPickCounts(matchId, predMap, players);
  const total = counts.total;
  return {
    home: counts.HOME,
    draw: counts.DRAW,
    away: counts.AWAY,
    total: total,
    homePct: total ? Math.round((counts.HOME / total) * 100) : 0,
    drawPct: total ? Math.round((counts.DRAW / total) * 100) : 0,
    awayPct: total ? Math.round((counts.AWAY / total) * 100) : 0,
  };
}

function buildAllMatchPickStats(predictions, activeUsers) {
  const players = getActivePlayers(activeUsers);
  const predMap = buildPredictionMap(predictions);
  const matchIds = {};
  const map = {};

  (predictions || []).forEach(function (p) {
    if (!players.some(function (player) {
      return player.username === p.username;
    })) {
      return;
    }
    matchIds[String(p.matchId)] = true;
  });

  Object.keys(matchIds).forEach(function (matchId) {
    map[matchId] = computeMatchPickStats(matchId, predMap, players);
  });

  return map;
}

function renderMatchPickRates(stats, match) {
  if (!stats || !stats.total) return '';

  const homeName = match.homeTeam.shortName || match.homeTeam.name;
  const awayName = match.awayTeam.shortName || match.awayTeam.name;
  const homeEnd = stats.homePct;
  const drawEnd = homeEnd + stats.drawPct;
  const barStyle =
    'background: linear-gradient(to right, #16a34a 0% ' + homeEnd + '%, ' +
    '#4f46e5 ' + homeEnd + '% ' + drawEnd + '%, ' +
    '#d97706 ' + drawEnd + '% 100%)';

  return (
    '<div class="match-pick-rates">' +
      '<span class="match-pick-rates-heading">Nhóm chọn</span>' +
      '<div class="match-pick-rates-bar" style="' + barStyle + '" role="img" aria-label="Tỷ lệ chọn nhóm"></div>' +
      '<div class="match-pick-rates-labels">' +
        '<span class="match-pick-rate match-pick-rate-home" title="' + escapeHtml(homeName) + ' thắng">' +
          escapeHtml(homeName) + ' ' + stats.homePct + '%' +
        '</span>' +
        '<span class="match-pick-rate match-pick-rate-draw" title="Hòa">Hòa ' + stats.drawPct + '%</span>' +
        '<span class="match-pick-rate match-pick-rate-away" title="' + escapeHtml(awayName) + ' thắng">' +
          escapeHtml(awayName) + ' ' + stats.awayPct + '%' +
        '</span>' +
      '</div>' +
    '</div>'
  );
}

function formatNoonDayLabel(date) {
  return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
}

function buildUserPredictionMap(predictions, username) {
  const map = {};
  (predictions || []).forEach(function (p) {
    if (p.username === username) {
      map[String(p.matchId)] = p.prediction;
    }
  });
  return map;
}

function isMatchOpenForPrediction(match, startDate) {
  if (!isMatchEligibleForGroup(match, startDate)) return false;
  return match.status !== 'FINISHED' && !isMatchLocked(match.utcDate);
}

function getUpcomingUnpredicted(matches, userPredMap, hours, startDate) {
  const now = Date.now();
  const limit = now + hours * 60 * 60 * 1000;

  return sortMatchesByDate(
    matches.filter(function (m) {
      if (!isMatchOpenForPrediction(m, startDate)) return false;
      if (userPredMap[String(m.id)]) return false;
      const kickoff = new Date(m.utcDate).getTime();
      return kickoff > now && kickoff <= limit;
    })
  );
}

function getTodayUnpredicted(matches, userPredMap, now, startDate) {
  return sortMatchesByDate(
    matches.filter(function (m) {
      if (!isMatchOpenForPrediction(m, startDate)) return false;
      if (userPredMap[String(m.id)]) return false;
      return isInNoonDay(m.utcDate, now);
    })
  );
}

function formatLockCountdown(utcDate) {
  if (isMatchLocked(utcDate)) return '';
  const diff = new Date(utcDate).getTime() - Date.now();
  if (diff <= 0) return '';

  const totalMinutes = Math.floor(diff / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours > 0) {
    return 'Còn ' + hours + 'h ' + minutes + 'p để dự đoán';
  }
  if (minutes > 0) {
    return 'Còn ' + minutes + 'p để dự đoán';
  }
  return 'Còn dưới 1p để dự đoán';
}

function formatKickoffCountdown(utcDate) {
  const diff = new Date(utcDate).getTime() - Date.now();
  if (diff <= 0) return 'Đã bắt đầu';

  const totalMinutes = Math.floor(diff / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const days = Math.floor(hours / 24);
  const remainHours = hours % 24;

  if (days > 0) {
    return days + ' ngày ' + remainHours + 'h ' + minutes + 'p';
  }
  if (hours > 0) {
    return hours + 'h ' + minutes + 'p';
  }
  if (minutes > 0) {
    return minutes + ' phút';
  }
  return 'Dưới 1 phút';
}

function getNextUpcomingMatch(matches) {
  const now = Date.now();
  const upcoming = matches
    .filter(function (m) {
      return m.status !== 'FINISHED' && new Date(m.utcDate).getTime() > now;
    })
    .sort(function (a, b) {
      return new Date(a.utcDate).getTime() - new Date(b.utcDate).getTime();
    });
  return upcoming[0] || null;
}

function getUserLeaderboardRank(rows, username) {
  const index = rows.findIndex(function (row) {
    return row.username === username;
  });
  if (index === -1) {
    return { rank: null, row: null };
  }
  return { rank: index + 1, row: rows[index] };
}

function updateCountdownElements(selector) {
  document.querySelectorAll(selector || '.badge-countdown[data-kickoff]').forEach(function (el) {
    const kickoff = el.dataset.kickoff;
    const text = formatLockCountdown(kickoff);
    if (!text) {
      el.textContent = 'Đã khóa dự đoán';
      el.classList.remove('badge-countdown');
      el.classList.add('badge-locked');
      return;
    }
    el.textContent = text;
  });

  document.querySelectorAll('.kickoff-countdown[data-kickoff]').forEach(function (el) {
    el.textContent = formatKickoffCountdown(el.dataset.kickoff);
  });
}

let countdownTickerId = null;

function startCountdownTicker() {
  if (countdownTickerId) {
    clearInterval(countdownTickerId);
  }
  updateCountdownElements();
  countdownTickerId = setInterval(function () {
    updateCountdownElements();
  }, 60000);
}

function stopCountdownTicker() {
  if (countdownTickerId) {
    clearInterval(countdownTickerId);
    countdownTickerId = null;
  }
}
