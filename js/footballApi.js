const CACHE_KEY = 'wc2026_matches_cache';
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

async function getFinishedMatches() {
  const matches = await getMatches();
  return matches.filter((m) => m.status === 'FINISHED');
}

function mapWinnerToPrediction(winner) {
  if (winner === 'HOME_TEAM') return 'HOME';
  if (winner === 'AWAY_TEAM') return 'AWAY';
  if (winner === 'DRAW') return 'DRAW';
  return null;
}

function getActualResult(match) {
  if (match.status !== 'FINISHED' || !match.score) return null;
  return mapWinnerToPrediction(match.score.winner);
}

function getMatchScore(match) {
  if (!match.score || !match.score.fullTime) return null;
  const home = match.score.fullTime.home;
  const away = match.score.fullTime.away;
  if (home === null || away === null) return null;
  return home + ' - ' + away;
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
