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

async function footballFetch(endpoint) {
  const response = await fetch(FOOTBALL_API_BASE + endpoint, {
    headers: { 'X-Auth-Token': FOOTBALL_API_KEY },
  });

  if (!response.ok) {
    throw new Error('Lỗi football-data.org API (HTTP ' + response.status + ')');
  }

  return response.json();
}

async function getMatches() {
  const cached = getCachedMatches();
  if (cached) return cached;

  const data = await footballFetch(
    '/competitions/' + WC_COMPETITION_CODE + '/matches?season=' + WC_SEASON
  );
  const matches = data.matches || [];
  setCachedMatches(matches);
  return matches;
}

async function getMatch(matchId) {
  const data = await footballFetch('/matches/' + matchId);
  return data;
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
