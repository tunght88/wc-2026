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

async function savePrediction(username, passwordHash, groupId, matchId, prediction, hopeStar) {
  return postAction('savePrediction', {
    username,
    passwordHash,
    groupId,
    matchId,
    prediction,
    hopeStar: !!hopeStar,
  });
}

async function getPredictions(username, passwordHash, groupId) {
  return postAction('getPredictions', { username, passwordHash, groupId });
}

async function getMyGroups(username, passwordHash) {
  return postAction('getMyGroups', { username, passwordHash });
}

async function getGroups(adminUsername, adminPasswordHash) {
  return postAction('getGroups', { username: adminUsername, passwordHash: adminPasswordHash });
}

async function createGroup(adminUsername, adminPasswordHash, groupId, name, startDate) {
  return postAction('createGroup', {
    username: adminUsername,
    passwordHash: adminPasswordHash,
    groupId,
    name,
    startDate: startDate || '',
  });
}

async function updateGroup(adminUsername, adminPasswordHash, groupId, updates) {
  return postAction('updateGroup', {
    username: adminUsername,
    passwordHash: adminPasswordHash,
    groupId,
    name: updates.name,
    startDate: updates.startDate,
  });
}

async function toggleGroupStatus(adminUsername, adminPasswordHash, groupId) {
  return postAction('toggleGroupStatus', {
    username: adminUsername,
    passwordHash: adminPasswordHash,
    groupId,
  });
}

async function getGroupMembers(adminUsername, adminPasswordHash, groupId) {
  return postAction('getGroupMembers', {
    username: adminUsername,
    passwordHash: adminPasswordHash,
    groupId,
  });
}

async function addGroupMember(adminUsername, adminPasswordHash, groupId, targetUsername) {
  return postAction('addGroupMember', {
    username: adminUsername,
    passwordHash: adminPasswordHash,
    groupId,
    targetUsername,
  });
}

async function removeGroupMember(adminUsername, adminPasswordHash, groupId, targetUsername) {
  return postAction('removeGroupMember', {
    username: adminUsername,
    passwordHash: adminPasswordHash,
    groupId,
    targetUsername,
  });
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

async function getMatchPredictionStats(username, passwordHash, groupId, matchId) {
  return postAction('getMatchPredictionStats', {
    username,
    passwordHash,
    groupId,
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

async function getMissingPredictions(adminUsername, adminPasswordHash, groupId, competition, season) {
  return postAction('getMissingPredictions', {
    username: adminUsername,
    passwordHash: adminPasswordHash,
    groupId,
    competition,
    season,
  });
}
