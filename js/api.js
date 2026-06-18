function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

async function postAction(action, payload) {
  const response = await fetch(APPS_SCRIPT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action, ...payload }),
  });

  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('Phản hồi không hợp lệ từ server');
  }

  if (!data.success) {
    throw new Error(data.message || 'Yêu cầu thất bại');
  }

  return data;
}

async function login(username, passwordHash) {
  return postAction('login', { username, passwordHash });
}

async function register(username, passwordHash, fullName) {
  return postAction('register', { username, passwordHash, fullName });
}

async function savePrediction(username, passwordHash, matchId, prediction) {
  return postAction('savePrediction', { username, passwordHash, matchId, prediction });
}

async function getPredictions(username, passwordHash) {
  return postAction('getPredictions', { username, passwordHash });
}

async function getUsers(username, passwordHash) {
  return postAction('getUsers', { username, passwordHash });
}

async function createUser(adminUsername, adminPasswordHash, newUser) {
  return postAction('createUser', {
    username: adminUsername,
    passwordHash: adminPasswordHash,
    newUsername: newUser.username,
    newPasswordHash: newUser.passwordHash,
    fullName: newUser.fullName,
    role: newUser.role,
  });
}

async function resetPassword(adminUsername, adminPasswordHash, targetUsername, newPasswordHash) {
  return postAction('resetPassword', {
    username: adminUsername,
    passwordHash: adminPasswordHash,
    targetUsername,
    newPasswordHash,
  });
}

async function toggleUserStatus(adminUsername, adminPasswordHash, targetUsername) {
  return postAction('toggleUserStatus', {
    username: adminUsername,
    passwordHash: adminPasswordHash,
    targetUsername,
  });
}

async function getFootballMatches(username, passwordHash, competition, season) {
  return postAction('getFootballMatches', {
    username,
    passwordHash,
    competition,
    season,
  });
}

async function getFootballMatch(username, passwordHash, matchId) {
  return postAction('getFootballMatch', {
    username,
    passwordHash,
    matchId,
  });
}

async function getFootballMatchDetail(username, passwordHash, matchId) {
  return postAction('getFootballMatchDetail', {
    username,
    passwordHash,
    matchId,
  });
}

async function getFootballMatchHead2Head(username, passwordHash, matchId, limit) {
  return postAction('getFootballMatchHead2Head', {
    username,
    passwordHash,
    matchId,
    limit: limit || 5,
  });
}

async function getMatchInsights(username, passwordHash, matchId) {
  return postAction('getMatchInsights', {
    username,
    passwordHash,
    matchId,
  });
}

async function getFotMobMatchInfo(username, passwordHash, match) {
  return postAction('getFotMobMatchInfo', {
    username,
    passwordHash,
    matchId: match.id,
    homeTeamName: match.homeTeam.name,
    awayTeamName: match.awayTeam.name,
    homeTeamShortName: match.homeTeam.shortName || '',
    awayTeamShortName: match.awayTeam.shortName || '',
    utcDate: match.utcDate,
    fotmobMatchId: match.fotmobMatchId || '',
  });
}

async function getMatchPredictionStats(username, passwordHash, matchId) {
  return postAction('getMatchPredictionStats', {
    username,
    passwordHash,
    matchId,
  });
}

async function syncMatches(adminUsername, adminPasswordHash, competition, season) {
  return postAction('syncMatches', {
    username: adminUsername,
    passwordHash: adminPasswordHash,
    competition,
    season,
  });
}

async function getMissingPredictions(adminUsername, adminPasswordHash, competition, season) {
  return postAction('getMissingPredictions', {
    username: adminUsername,
    passwordHash: adminPasswordHash,
    competition,
    season,
  });
}
