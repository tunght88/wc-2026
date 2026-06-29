const SPREADSHEET_ID = 'YOUR_SPREADSHEET_ID_HERE';
const USERS_SHEET = 'Users';
const PREDICTIONS_SHEET = 'Predictions';
const GROUPS_SHEET = 'Groups';
const GROUP_MEMBERS_SHEET = 'GroupMembers';
const MATCH_INSIGHTS_SHEET = 'MatchInsights';
const MATCHES_SHEET = 'Matches';
const DEFAULT_COMPETITION = 'WC';
const DEFAULT_SEASON = '2026';
const DEFAULT_GROUP_ID = 'group1';
const DEFAULT_GROUP_NAME = 'Nhóm 8 9l';
const REGISTRATION_GROUP_ID = 'group2';
const REGISTRATION_GROUP_NAME = 'Group 2';
const APP_TIMEZONE = 'Asia/Ho_Chi_Minh';

function doGet(e) {
  return handleRequest(e);
}

function doPost(e) {
  return handleRequest(e);
}

function handleRequest(e) {
  try {
    if (e.parameter && e.parameter.method === 'OPTIONS') {
      return corsResponse('');
    }

    var payload = {};
    if (e.postData && e.postData.contents) {
      payload = JSON.parse(e.postData.contents);
    }

    var action = (payload.action || (e.parameter && e.parameter.action) || '').toString();

    switch (action) {
      case 'login':
        return corsResponse(JSON.stringify(handleLogin(payload)));
      case 'register':
        return corsResponse(JSON.stringify(handleRegister(payload)));
      case 'savePrediction':
        return corsResponse(JSON.stringify(handleSavePrediction(payload)));
      case 'getPredictions':
        return corsResponse(JSON.stringify(handleGetPredictions(payload)));
      case 'getUsers':
        return corsResponse(JSON.stringify(handleGetUsers(payload)));
      case 'createUser':
        return corsResponse(JSON.stringify(handleCreateUser(payload)));
      case 'resetPassword':
        return corsResponse(JSON.stringify(handleResetPassword(payload)));
      case 'toggleUserStatus':
        return corsResponse(JSON.stringify(handleToggleUserStatus(payload)));
      case 'getFootballMatches':
        return corsResponse(JSON.stringify(handleGetFootballMatches(payload)));
      case 'getFootballMatch':
        return corsResponse(JSON.stringify(handleGetFootballMatch(payload)));
      case 'getFootballMatchDetail':
        return corsResponse(JSON.stringify(handleGetFootballMatchDetail(payload)));
      case 'getFootballMatchHead2Head':
        return corsResponse(JSON.stringify(handleGetFootballMatchHead2Head(payload)));
      case 'getMatchInsights':
        return corsResponse(JSON.stringify(handleGetMatchInsights(payload)));
      case 'getFotMobMatchInfo':
        return corsResponse(JSON.stringify(handleGetFotMobMatchInfo(payload)));
      case 'getMatchPredictionStats':
        return corsResponse(JSON.stringify(handleGetMatchPredictionStats(payload)));
      case 'syncMatches':
        return corsResponse(JSON.stringify(handleSyncMatches(payload)));
      case 'getMissingPredictions':
        return corsResponse(JSON.stringify(handleGetMissingPredictions(payload)));
      case 'getMyGroups':
        return corsResponse(JSON.stringify(handleGetMyGroups(payload)));
      case 'getGroups':
        return corsResponse(JSON.stringify(handleGetGroups(payload)));
      case 'createGroup':
        return corsResponse(JSON.stringify(handleCreateGroup(payload)));
      case 'toggleGroupStatus':
        return corsResponse(JSON.stringify(handleToggleGroupStatus(payload)));
      case 'updateGroup':
        return corsResponse(JSON.stringify(handleUpdateGroup(payload)));
      case 'getGroupMembers':
        return corsResponse(JSON.stringify(handleGetGroupMembers(payload)));
      case 'addGroupMember':
        return corsResponse(JSON.stringify(handleAddGroupMember(payload)));
      case 'removeGroupMember':
        return corsResponse(JSON.stringify(handleRemoveGroupMember(payload)));
      default:
        return corsResponse(JSON.stringify({ success: false, message: 'Action không hợp lệ' }));
    }
  } catch (err) {
    return corsResponse(JSON.stringify({ success: false, message: err.message || 'Lỗi server' }));
  }
}

function corsResponse(content) {
  return ContentService.createTextOutput(content).setMimeType(ContentService.MimeType.JSON);
}

function getSpreadsheet() {
  return SpreadsheetApp.openById(SPREADSHEET_ID);
}

function getUsersSheet() {
  return getSpreadsheet().getSheetByName(USERS_SHEET);
}

function getPredictionsSheet() {
  return getSpreadsheet().getSheetByName(PREDICTIONS_SHEET);
}

function getGroupsSheet() {
  return getSpreadsheet().getSheetByName(GROUPS_SHEET);
}

function getGroupMembersSheet() {
  return getSpreadsheet().getSheetByName(GROUP_MEMBERS_SHEET);
}

function addUserToGroup(username, groupId) {
  if (!username || !groupId) return false;
  if (!getGroupMembersSheet()) return false;

  var group = getGroupById(groupId);
  if (!group) return false;
  if (isUserInGroup(username, groupId)) return true;

  getGroupMembersSheet().appendRow([group.groupId, username, new Date().toISOString()]);
  return true;
}

function sanitizeGroupId(value) {
  if (!value) return '';
  return String(value).trim().replace(/[^a-zA-Z0-9_-]/g, '').substring(0, 50).toLowerCase();
}

function groupIdsMatch(a, b) {
  return sanitizeGroupId(a) === sanitizeGroupId(b);
}

function normalizeGroupStartDate(value) {
  if (value === null || value === undefined || value === '') return '';
  if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value.getTime())) {
    return Utilities.formatDate(value, APP_TIMEZONE, 'yyyy-MM-dd');
  }
  var str = String(value).trim();
  if (!str) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  var parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    return Utilities.formatDate(parsed, APP_TIMEZONE, 'yyyy-MM-dd');
  }
  return '';
}

function mapGroupFromRow(data, rowIndex) {
  return {
    groupId: String(data[0]),
    name: String(data[1]),
    active: String(data[2]).toUpperCase() === 'TRUE',
    createdAt: String(data[3] || ''),
    startDate: normalizeGroupStartDate(data[4]),
    row: rowIndex + 1,
  };
}

function getMatchDateInAppTimezone(utcDateIso) {
  if (!utcDateIso) return '';
  try {
    var d = new Date(utcDateIso);
    if (isNaN(d.getTime())) return '';
    return Utilities.formatDate(d, APP_TIMEZONE, 'yyyy-MM-dd');
  } catch (err) {
    return '';
  }
}

function isMatchOnOrAfterGroupStart(match, startDate) {
  if (!startDate) return true;
  if (!match || !match.utcDate) return true;
  return getMatchDateInAppTimezone(match.utcDate) >= startDate;
}

function getGroupById(groupId) {
  var sheet = getGroupsSheet();
  if (!sheet) return null;
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (!data[i][0]) continue;
    if (groupIdsMatch(data[i][0], groupId)) {
      return mapGroupFromRow(data[i], i);
    }
  }
  return null;
}

function isUserInGroup(username, groupId) {
  var sheet = getGroupMembersSheet();
  if (!sheet) return false;
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (groupIdsMatch(data[i][0], groupId) && String(data[i][1]) === username) {
      return true;
    }
  }
  return false;
}

function verifyGroupMembership(username, groupId) {
  if (!groupId) {
    return { valid: false, message: 'Thiếu groupId' };
  }
  var group = getGroupById(groupId);
  if (!group) {
    return { valid: false, message: 'Nhóm không tồn tại' };
  }
  if (!group.active) {
    return { valid: false, message: 'Nhóm đã bị khóa' };
  }
  if (!isUserInGroup(username, groupId)) {
    return { valid: false, message: 'Bạn không thuộc nhóm này' };
  }
  return { valid: true, group: group };
}

function getUserNameMap() {
  var usersData = getUsersSheet().getDataRange().getValues();
  var nameMap = {};
  for (var u = 1; u < usersData.length; u++) {
    nameMap[String(usersData[u][0])] = String(usersData[u][2]);
  }
  return nameMap;
}

function getGroupMemberUsernames(groupId) {
  var sheet = getGroupMembersSheet();
  var data = sheet.getDataRange().getValues();
  var members = [];
  for (var i = 1; i < data.length; i++) {
    if (groupIdsMatch(data[i][0], groupId)) {
      members.push(String(data[i][1]));
    }
  }
  return members;
}

function getActiveUsersInGroup(groupId) {
  var memberUsernames = getGroupMemberUsernames(groupId);
  var memberSet = {};
  memberUsernames.forEach(function (uname) {
    memberSet[uname] = true;
  });

  var usersData = getUsersSheet().getDataRange().getValues();
  var activeUsers = [];
  for (var a = 1; a < usersData.length; a++) {
    if (!usersData[a][0]) continue;
    var uname = String(usersData[a][0]);
    if (!memberSet[uname]) continue;
    if (String(usersData[a][4]).toUpperCase() !== 'TRUE') continue;
    activeUsers.push({
      username: uname,
      fullName: String(usersData[a][2]),
      role: String(usersData[a][3]).toUpperCase(),
    });
  }
  return activeUsers;
}

function getActivePlayersInGroup(groupId) {
  return getActiveUsersInGroup(groupId).filter(function (user) {
    return user.role !== 'ADMIN';
  });
}

function getActivePlayerUsernamesInGroup(groupId) {
  var players = getActivePlayersInGroup(groupId);
  var map = {};
  players.forEach(function (player) {
    map[player.username] = true;
  });
  return map;
}

function getAllGroupsMap() {
  var sheet = getGroupsSheet();
  if (!sheet) return {};
  var data = sheet.getDataRange().getValues();
  var map = {};
  for (var i = 1; i < data.length; i++) {
    if (!data[i][0]) continue;
    var group = mapGroupFromRow(data[i], i);
    map[sanitizeGroupId(group.groupId)] = group;
  }
  return map;
}

function getGroupsForUser(username) {
  var membersSheet = getGroupMembersSheet();
  if (!membersSheet) return [];
  var membersData = membersSheet.getDataRange().getValues();
  var memberGroupKeys = {};
  for (var i = 1; i < membersData.length; i++) {
    if (String(membersData[i][1]) === username) {
      memberGroupKeys[sanitizeGroupId(membersData[i][0])] = true;
    }
  }

  var groupKeys = Object.keys(memberGroupKeys);
  if (groupKeys.length === 0) return [];

  var groupsMap = getAllGroupsMap();
  var groups = [];
  groupKeys.forEach(function (key) {
    var group = groupsMap[key];
    if (group && group.active) {
      groups.push({
        groupId: group.groupId,
        name: group.name,
        startDate: group.startDate || '',
      });
    }
  });
  return groups;
}

function countGroupMembers(groupId) {
  var sheet = getGroupMembersSheet();
  var data = sheet.getDataRange().getValues();
  var count = 0;
  for (var i = 1; i < data.length; i++) {
    if (groupIdsMatch(data[i][0], groupId)) count++;
  }
  return count;
}

function getMatchInsightsSheet() {
  return getSpreadsheet().getSheetByName(MATCH_INSIGHTS_SHEET);
}

function getMatchesSheet() {
  return ensureMatchesSheet();
}

function ensureMatchesSheet() {
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName(MATCHES_SHEET);
  if (!sheet) {
    sheet = ss.insertSheet(MATCHES_SHEET);
  }

  if (sheet.getLastRow() === 0) {
    sheet
      .getRange(1, 1, 1, 11)
      .setValues([
        [
          'match_id',
          'utc_date',
          'home_team',
          'away_team',
          'stage',
          'group',
          'status',
          'home_score',
          'away_score',
          'result',
          'synced_at',
        ],
      ])
      .setFontWeight('bold');
    sheet.setFrozenRows(1);
  }

  return sheet;
}

function mapWinnerToResult(winner) {
  var w = String(winner || '').toUpperCase();
  if (w === 'HOME_TEAM' || w === 'HOME') return 'HOME';
  if (w === 'AWAY_TEAM' || w === 'AWAY') return 'AWAY';
  if (w === 'DRAW') return 'DRAW';
  return '';
}

function getScoreGoalsFromApi(scorePart) {
  if (!scorePart) return { home: null, away: null };
  var home = scorePart.home;
  var away = scorePart.away;
  if (home === undefined || home === null) home = scorePart.homeTeam;
  if (away === undefined || away === null) away = scorePart.awayTeam;
  return { home: home, away: away };
}

function deriveMatchResultFromApi(match) {
  if (!match || !match.score || match.status !== 'FINISHED') return '';

  var score = match.score;
  var fromWinner = mapWinnerToResult(score.winner);
  if (fromWinner) return fromWinner;

  var fullTime = getScoreGoalsFromApi(score.fullTime);
  var home = fullTime.home;
  var away = fullTime.away;

  if (score.penalties) {
    var pen = getScoreGoalsFromApi(score.penalties);
    if (pen.home !== null && pen.away !== null && pen.home !== pen.away) {
      return pen.home > pen.away ? 'HOME' : 'AWAY';
    }
  }

  if (score.extraTime) {
    var extra = getScoreGoalsFromApi(score.extraTime);
    if (extra.home !== null && extra.away !== null) {
      home = extra.home;
      away = extra.away;
    }
  }

  if (home === null || home === undefined || away === null || away === undefined) {
    return '';
  }
  if (home > away) return 'HOME';
  if (away > home) return 'AWAY';
  return 'DRAW';
}

function buildMatchSheetRow(match) {
  var homeScore = '';
  var awayScore = '';
  if (match.score && match.score.fullTime) {
    var ft = getScoreGoalsFromApi(match.score.fullTime);
    if (ft.home !== null && ft.home !== undefined) homeScore = ft.home;
    if (ft.away !== null && ft.away !== undefined) awayScore = ft.away;
  }

  var group = '';
  if (match.group) {
    group = String(match.group).replace('GROUP_', '');
  }

  return [
    String(match.id),
    match.utcDate || '',
    match.homeTeam ? String(match.homeTeam.shortName || match.homeTeam.name || '') : '',
    match.awayTeam ? String(match.awayTeam.shortName || match.awayTeam.name || '') : '',
    match.stage || '',
    group,
    match.status || '',
    homeScore,
    awayScore,
    deriveMatchResultFromApi(match),
    new Date().toISOString(),
  ];
}

function syncMatchesToSheet(competition, season) {
  var data = footballApiGet(
    '/competitions/' + competition + '/matches?season=' + season
  );
  var matches = data.matches || [];
  var sheet = ensureMatchesSheet();
  var existing = sheet.getDataRange().getValues();
  var rowMap = {};

  for (var i = 1; i < existing.length; i++) {
    if (existing[i][0]) {
      rowMap[String(existing[i][0])] = i + 1;
    }
  }

  var updated = 0;
  var added = 0;

  matches.forEach(function (match) {
    var row = buildMatchSheetRow(match);
    var matchId = String(match.id);
    if (rowMap[matchId]) {
      sheet.getRange(rowMap[matchId], 1, 1, row.length).setValues([row]);
      updated++;
    } else {
      sheet.appendRow(row);
      rowMap[matchId] = sheet.getLastRow();
      added++;
    }
  });

  return {
    total: matches.length,
    updated: updated,
    added: added,
    syncedAt: new Date().toISOString(),
  };
}

function handleSyncMatches(payload) {
  var auth = verifyAdmin(payload.username, String(payload.passwordHash || ''));
  if (!auth.valid) {
    return { success: false, message: auth.message };
  }

  var competition = String(payload.competition || DEFAULT_COMPETITION);
  var season = String(payload.season || DEFAULT_SEASON);

  try {
    var result = syncMatchesToSheet(competition, season);
    setLastMatchSyncTime();
    ensureMatchSyncTrigger();
    return { success: true, sync: result };
  } catch (err) {
    return { success: false, message: err.message };
  }
}

function getLastMatchSyncTime() {
  var value = PropertiesService.getScriptProperties().getProperty('MATCHES_LAST_SYNC');
  return value ? parseInt(value, 10) : 0;
}

function setLastMatchSyncTime() {
  PropertiesService.getScriptProperties().setProperty('MATCHES_LAST_SYNC', String(Date.now()));
}

function maybeAutoSyncMatches() {
  var intervalMs = 60 * 60 * 1000;
  if (Date.now() - getLastMatchSyncTime() < intervalMs) {
    return null;
  }

  try {
    var result = syncMatchesToSheet(DEFAULT_COMPETITION, DEFAULT_SEASON);
    setLastMatchSyncTime();
    ensureMatchSyncTrigger();
    return result;
  } catch (err) {
    Logger.log('maybeAutoSyncMatches failed: ' + (err.message || err));
    return null;
  }
}

function scheduledSyncMatches() {
  try {
    syncMatchesToSheet(DEFAULT_COMPETITION, DEFAULT_SEASON);
    setLastMatchSyncTime();
  } catch (err) {
    Logger.log('scheduledSyncMatches failed: ' + (err.message || err));
  }
}

function hasMatchSyncTrigger() {
  return ScriptApp.getProjectTriggers().some(function (trigger) {
    return trigger.getHandlerFunction() === 'scheduledSyncMatches';
  });
}

function ensureMatchSyncTrigger() {
  if (hasMatchSyncTrigger()) {
    return false;
  }

  ScriptApp.newTrigger('scheduledSyncMatches').timeBased().everyHours(1).create();
  return true;
}

function setupMatchSyncTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (trigger) {
    if (trigger.getHandlerFunction() === 'scheduledSyncMatches') {
      ScriptApp.deleteTrigger(trigger);
    }
  });

  ScriptApp.newTrigger('scheduledSyncMatches').timeBased().everyHours(1).create();
  return 'Đã tạo trigger đồng bộ trận đấu mỗi 1 giờ';
}

function onOpen() {
  try {
    maybeAutoSyncMatches();
  } catch (err) {
    Logger.log('onOpen auto sync failed: ' + (err.message || err));
  }
}

function getFootballApiKey() {
  return PropertiesService.getScriptProperties().getProperty('FOOTBALL_API_KEY') || '';
}

function getOddsApiIoKey() {
  return PropertiesService.getScriptProperties().getProperty('ODDS_API_IO_KEY') || '';
}

function getOddsApiIoBookmakers() {
  return (
    PropertiesService.getScriptProperties().getProperty('ODDS_API_IO_BOOKMAKERS') ||
    'Bet365,Unibet,Betfair'
  );
}

function findUserRow(username) {
  var sheet = getUsersSheet();
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]).toLowerCase() === String(username).toLowerCase()) {
      return { row: i + 1, data: data[i] };
    }
  }
  return null;
}

function getUserByUsername(username) {
  var found = findUserRow(username);
  if (!found) return null;
  return {
    username: String(found.data[0]),
    passwordHash: String(found.data[1]),
    fullName: String(found.data[2]),
    role: String(found.data[3]).toUpperCase(),
    active: String(found.data[4]).toUpperCase() === 'TRUE',
    row: found.row,
  };
}

function verifyUser(username, passwordHash) {
  var user = getUserByUsername(username);
  if (!user) {
    return { valid: false, message: 'Tài khoản không tồn tại' };
  }
  if (!user.active) {
    return { valid: false, message: 'Tài khoản đã bị khóa' };
  }
  if (user.passwordHash !== passwordHash) {
    return { valid: false, message: 'Mật khẩu không đúng' };
  }
  return { valid: true, user: user };
}

function verifyAdmin(username, passwordHash) {
  var result = verifyUser(username, passwordHash);
  if (!result.valid) return result;
  if (result.user.role !== 'ADMIN') {
    return { valid: false, message: 'Không có quyền admin' };
  }
  return result;
}

function handleLogin(payload) {
  var username = sanitizeUsername(payload.username);
  var passwordHash = String(payload.passwordHash || '');

  if (!username || !passwordHash) {
    return { success: false, message: 'Thiếu thông tin đăng nhập' };
  }

  var result = verifyUser(username, passwordHash);
  if (!result.valid) {
    return { success: false, message: result.message };
  }

  return {
    success: true,
    username: result.user.username,
    fullName: result.user.fullName,
    role: result.user.role,
  };
}

function handleRegister(payload) {
  var username = sanitizeUsername(payload.username);
  var passwordHash = String(payload.passwordHash || '');
  var fullName = sanitizeText(payload.fullName, 100);

  if (!username || !passwordHash || !fullName) {
    return { success: false, message: 'Thiếu thông tin đăng ký' };
  }

  if (getUserByUsername(username)) {
    return { success: false, message: 'Username đã tồn tại' };
  }

  getUsersSheet().appendRow([username, passwordHash, fullName, 'USER', 'FALSE']);

  addUserToGroup(username, REGISTRATION_GROUP_ID);

  return {
    success: true,
    message: 'Đăng ký thành công. Vui lòng chờ admin kích hoạt tài khoản.',
    username: username,
    fullName: fullName,
    role: 'USER',
  };
}

function footballApiGet(path, extraHeaders) {
  var apiKey = getFootballApiKey();
  if (!apiKey) {
    throw new Error('Chưa cấu hình FOOTBALL_API_KEY trong Script Properties');
  }

  var cache = CacheService.getScriptCache();
  var cacheKey = 'fd_' + path + (extraHeaders ? '_' + JSON.stringify(extraHeaders) : '');
  var cached = cache.get(cacheKey);
  if (cached) {
    return JSON.parse(cached);
  }

  var headers = { 'X-Auth-Token': apiKey };
  if (extraHeaders) {
    Object.keys(extraHeaders).forEach(function (key) {
      headers[key] = extraHeaders[key];
    });
  }

  var url = 'https://api.football-data.org/v4' + path;
  var response = UrlFetchApp.fetch(url, {
    method: 'get',
    headers: headers,
    muteHttpExceptions: true,
  });

  var code = response.getResponseCode();
  var body = response.getContentText();

  if (code !== 200) {
    if (code === 403) {
      throw new Error('FOOTBALL_API_KEY không hợp lệ hoặc season không hỗ trợ. Dùng season=2026.');
    }
    if (code === 429) {
      throw new Error('Vượt giới hạn football-data.org API. Đợi 1 phút rồi thử lại.');
    }
    throw new Error('football-data.org API lỗi HTTP ' + code + ': ' + body);
  }

  var data = JSON.parse(body);
  cache.put(cacheKey, JSON.stringify(data), 300);
  return data;
}

function fetchMatchFromApi(matchId) {
  return footballApiGet('/matches/' + encodeURIComponent(matchId));
}

function handleGetFootballMatches(payload) {
  var auth = verifyUser(payload.username, String(payload.passwordHash || ''));
  if (!auth.valid) {
    return { success: false, message: auth.message };
  }

  var competition = String(payload.competition || 'WC');
  var season = String(payload.season || '2026');

  try {
    maybeAutoSyncMatches();
    var data = footballApiGet('/competitions/' + competition + '/matches?season=' + season);
    return { success: true, matches: data.matches || [] };
  } catch (err) {
    return { success: false, message: err.message };
  }
}

function handleGetFootballMatch(payload) {
  var auth = verifyUser(payload.username, String(payload.passwordHash || ''));
  if (!auth.valid) {
    return { success: false, message: auth.message };
  }

  var matchId = String(payload.matchId || '');
  if (!matchId) {
    return { success: false, message: 'Thiếu matchId' };
  }

  try {
    var match = footballApiGet('/matches/' + encodeURIComponent(matchId));
    return { success: true, match: match };
  } catch (err) {
    return { success: false, message: err.message };
  }
}

function handleGetFootballMatchDetail(payload) {
  var auth = verifyUser(payload.username, String(payload.passwordHash || ''));
  if (!auth.valid) {
    return { success: false, message: auth.message };
  }

  var matchId = String(payload.matchId || '');
  if (!matchId) {
    return { success: false, message: 'Thiếu matchId' };
  }

  try {
    var match = footballApiGet('/matches/' + encodeURIComponent(matchId), {
      'X-Unfold-Lineups': 'true',
    });
    return { success: true, match: match };
  } catch (err) {
    return { success: false, message: err.message };
  }
}

function handleGetFootballMatchHead2Head(payload) {
  var auth = verifyUser(payload.username, String(payload.passwordHash || ''));
  if (!auth.valid) {
    return { success: false, message: auth.message };
  }

  var matchId = String(payload.matchId || '');
  if (!matchId) {
    return { success: false, message: 'Thiếu matchId' };
  }

  var limit = parseInt(payload.limit, 10);
  if (!limit || limit < 1) limit = 5;
  if (limit > 10) limit = 10;

  try {
    var data = footballApiGet(
      '/matches/' + encodeURIComponent(matchId) + '/head2head?limit=' + limit
    );
    return { success: true, head2head: data };
  } catch (err) {
    return { success: false, message: err.message };
  }
}

function handleGetMatchInsights(payload) {
  var auth = verifyUser(payload.username, String(payload.passwordHash || ''));
  if (!auth.valid) {
    return { success: false, message: auth.message };
  }

  var matchId = String(payload.matchId || '');
  if (!matchId) {
    return { success: false, message: 'Thiếu matchId' };
  }

  var sheet = getMatchInsightsSheet();
  if (!sheet) {
    return { success: true, insights: null };
  }

  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]) === matchId) {
      return {
        success: true,
        insights: {
          expectedLineup: String(data[i][1] || ''),
          expertAssessment: String(data[i][2] || ''),
          pickSuggestion: String(data[i][3] || '').toUpperCase(),
          pickNote: String(data[i][4] || ''),
          fotmobMatchId: String(data[i][5] || ''),
          winProbHome: parseSheetPercent(data[i][6]),
          winProbDraw: parseSheetPercent(data[i][7]),
          winProbAway: parseSheetPercent(data[i][8]),
          injuries: String(data[i][9] || ''),
          marketValue: String(data[i][10] || ''),
        },
      };
    }
  }

  return { success: true, insights: null };
}

function isMatchOpenForPrediction(match) {
  var allowedStatuses = ['SCHEDULED', 'TIMED'];
  if (allowedStatuses.indexOf(match.status) === -1) {
    return false;
  }
  var kickoff = new Date(match.utcDate);
  var now = new Date();
  return now < kickoff;
}

function handleSavePrediction(payload) {
  var username = sanitizeUsername(payload.username);
  var passwordHash = String(payload.passwordHash || '');
  var groupId = sanitizeGroupId(payload.groupId);
  var matchId = String(payload.matchId || '');
  var prediction = String(payload.prediction || '').toUpperCase();
  var hopeStar = payload.hopeStar === true || String(payload.hopeStar || '').toUpperCase() === 'TRUE';

  if (!username || !passwordHash || !groupId || !matchId || !prediction) {
    return { success: false, message: 'Thiếu thông tin dự đoán' };
  }

  if (['HOME', 'DRAW', 'AWAY'].indexOf(prediction) === -1) {
    return { success: false, message: 'Dự đoán không hợp lệ' };
  }

  var auth = verifyUser(username, passwordHash);
  if (!auth.valid) {
    return { success: false, message: auth.message };
  }

  var groupAuth = verifyGroupMembership(username, groupId);
  if (!groupAuth.valid) {
    return { success: false, message: groupAuth.message };
  }

  var match;
  try {
    match = fetchMatchFromApi(matchId);
  } catch (err) {
    return { success: false, message: err.message };
  }

  if (!isMatchOpenForPrediction(match)) {
    return { success: false, message: 'Đã khóa dự đoán - trận đấu đã bắt đầu' };
  }

  var canonicalGroup = getGroupById(groupId);
  if (!canonicalGroup) {
    return { success: false, message: 'Nhóm không tồn tại' };
  }

  if (!isMatchOnOrAfterGroupStart(match, canonicalGroup.startDate)) {
    return { success: false, message: 'Trận đấu trước ngày bắt đầu của nhóm' };
  }

  var hopeStarRound = '';
  if (hopeStar) {
    hopeStarRound = getHopeStarRoundKey(match.stage);
    if (!hopeStarRound) {
      return { success: false, message: 'Ngôi sao hy vọng chỉ áp dụng từ vòng 32 đội trở đi' };
    }
  }

  var sheet = getPredictionsSheet();
  var data = sheet.getDataRange().getValues();
  var now = new Date().toISOString();
  var foundRow = -1;

  if (hopeStar && hopeStarRound) {
    for (var j = 1; j < data.length; j++) {
      if (!groupIdsMatch(data[j][0], canonicalGroup.groupId)) continue;
      if (String(data[j][1]) !== username) continue;
      if (String(data[j][2]) === matchId) continue;
      if (String(data[j][6] || '').toUpperCase() !== 'TRUE') continue;
      if (String(data[j][7] || '') === hopeStarRound) {
        sheet.getRange(j + 1, 7).setValue('');
        sheet.getRange(j + 1, 8).setValue('');
      }
    }
  }

  for (var i = 1; i < data.length; i++) {
    if (
      groupIdsMatch(data[i][0], canonicalGroup.groupId) &&
      String(data[i][1]) === username &&
      String(data[i][2]) === matchId
    ) {
      foundRow = i + 1;
      break;
    }
  }

  if (foundRow > 0) {
    sheet.getRange(foundRow, 4).setValue(prediction);
    sheet.getRange(foundRow, 5).setValue(now);
    sheet.getRange(foundRow, 7).setValue(hopeStar ? 'TRUE' : '');
    sheet.getRange(foundRow, 8).setValue(hopeStar ? hopeStarRound : '');
  } else {
    sheet.appendRow([
      canonicalGroup.groupId,
      username,
      matchId,
      prediction,
      now,
      '',
      hopeStar ? 'TRUE' : '',
      hopeStar ? hopeStarRound : '',
    ]);
  }

  return { success: true, message: 'Đã lưu dự đoán' };
}

function getHopeStarRoundKey(stage) {
  var keys = {
    LAST_32: 'r32',
    ROUND_OF_32: 'r32',
    LAST_16: 'r16',
    ROUND_OF_16: 'r16',
    QUARTER_FINALS: 'qf',
    SEMI_FINALS: 'sf',
    THIRD_PLACE: 'third',
    FINAL: 'final',
  };
  return keys[stage] || '';
}

function handleGetPredictions(payload) {
  var username = sanitizeUsername(payload.username);
  var passwordHash = String(payload.passwordHash || '');
  var groupId = sanitizeGroupId(payload.groupId);

  var auth = verifyUser(username, passwordHash);
  if (!auth.valid) {
    return { success: false, message: auth.message };
  }

  if (!groupId) {
    return { success: false, message: 'Thiếu groupId' };
  }

  var group = getGroupById(groupId);
  if (!group) {
    return { success: false, message: 'Nhóm không tồn tại' };
  }

  if (auth.user.role !== 'ADMIN') {
    var groupAuth = verifyGroupMembership(username, groupId);
    if (!groupAuth.valid) {
      return { success: false, message: groupAuth.message };
    }
  } else if (!group.active) {
    return { success: false, message: 'Nhóm đã bị khóa' };
  }

  var nameMap = getUserNameMap();
  var activeUsers = getActiveUsersInGroup(groupId);

  var sheet = getPredictionsSheet();
  var data = sheet.getDataRange().getValues();
  var predictions = [];

  for (var i = 1; i < data.length; i++) {
    if (!data[i][0] || !groupIdsMatch(data[i][0], groupId)) continue;
    predictions.push({
      username: String(data[i][1]),
      matchId: String(data[i][2]),
      prediction: String(data[i][3]),
      updatedAt: String(data[i][4]),
      hopeStar: String(data[i][6] || '').toUpperCase() === 'TRUE',
      fullName: nameMap[String(data[i][1])] || String(data[i][1]),
    });
  }

  return { success: true, predictions: predictions, activeUsers: activeUsers };
}

function getActivePlayers() {
  var usersData = getUsersSheet().getDataRange().getValues();
  var players = [];

  for (var i = 1; i < usersData.length; i++) {
    if (!usersData[i][0]) continue;
    if (String(usersData[i][4]).toUpperCase() !== 'TRUE') continue;
    if (String(usersData[i][3]).toUpperCase() === 'ADMIN') continue;
    players.push({
      username: String(usersData[i][0]),
      fullName: String(usersData[i][2]),
    });
  }

  return players;
}

function getActivePlayerUsernames() {
  var players = getActivePlayers();
  var map = {};
  players.forEach(function (player) {
    map[player.username] = true;
  });
  return map;
}

function buildPredictionMapByMatch(groupId) {
  var sheet = getPredictionsSheet();
  var data = sheet.getDataRange().getValues();
  var map = {};

  for (var i = 1; i < data.length; i++) {
    if (!data[i][0] || !data[i][2]) continue;
    if (groupId && !groupIdsMatch(data[i][0], groupId)) continue;
    var matchId = String(data[i][2]);
    if (!map[matchId]) map[matchId] = {};
    map[matchId][String(data[i][1])] = String(data[i][3]).toUpperCase();
  }

  return map;
}

function getMissingPlayersForMatch(matchId, players, predictionMap) {
  var predicted = predictionMap[String(matchId)] || {};
  var missing = [];

  players.forEach(function (player) {
    if (!predicted[player.username]) {
      missing.push(player);
    }
  });

  return missing;
}

function handleGetMatchPredictionStats(payload) {
  var auth = verifyUser(payload.username, String(payload.passwordHash || ''));
  if (!auth.valid) {
    return { success: false, message: auth.message };
  }

  var groupId = sanitizeGroupId(payload.groupId);
  var matchId = String(payload.matchId || '');
  if (!groupId || !matchId) {
    return { success: false, message: 'Thiếu groupId hoặc matchId' };
  }

  var groupAuth = verifyGroupMembership(payload.username, groupId);
  if (!groupAuth.valid) {
    return { success: false, message: groupAuth.message };
  }

  var players = getActivePlayersInGroup(groupId);
  var playerSet = getActivePlayerUsernamesInGroup(groupId);
  var sheet = getPredictionsSheet();
  var data = sheet.getDataRange().getValues();
  var counts = { home: 0, draw: 0, away: 0, total: 0 };
  var predictedUsers = {};

  for (var i = 1; i < data.length; i++) {
    if (!data[i][0] || !groupIdsMatch(data[i][0], groupId)) continue;
    if (String(data[i][2]) !== matchId) continue;
    if (!playerSet[String(data[i][1])]) continue;

    var prediction = String(data[i][3]).toUpperCase();
    if (prediction === 'HOME') counts.home++;
    else if (prediction === 'DRAW') counts.draw++;
    else if (prediction === 'AWAY') counts.away++;
    else continue;

    counts.total++;
    predictedUsers[String(data[i][1])] = true;
  }

  var notPredicted = players.filter(function (player) {
    return !predictedUsers[player.username];
  });

  var total = counts.total;
  return {
    success: true,
    stats: {
      home: counts.home,
      draw: counts.draw,
      away: counts.away,
      total: total,
      expectedTotal: players.length,
      homePct: total ? Math.round((counts.home / total) * 100) : 0,
      drawPct: total ? Math.round((counts.draw / total) * 100) : 0,
      awayPct: total ? Math.round((counts.away / total) * 100) : 0,
      notPredicted: notPredicted,
    },
  };
}

function handleGetMissingPredictions(payload) {
  var auth = verifyAdmin(payload.username, String(payload.passwordHash || ''));
  if (!auth.valid) {
    return { success: false, message: auth.message };
  }

  var groupId = sanitizeGroupId(payload.groupId);
  if (!groupId) {
    return { success: false, message: 'Thiếu groupId' };
  }

  var group = getGroupById(groupId);
  if (!group) {
    return { success: false, message: 'Nhóm không tồn tại' };
  }

  var competition = String(payload.competition || DEFAULT_COMPETITION);
  var season = String(payload.season || DEFAULT_SEASON);
  var onlyUpcoming = String(payload.onlyUpcoming || 'true').toLowerCase() !== 'false';

  try {
    var data = footballApiGet(
      '/competitions/' + competition + '/matches?season=' + season
    );
    var matches = data.matches || [];
    var players = getActivePlayersInGroup(groupId);
    var predictionMap = buildPredictionMapByMatch(groupId);
    var items = [];

    matches.forEach(function (match) {
      var status = String(match.status || '');
      if (onlyUpcoming && status === 'FINISHED') return;
      if (!isMatchOnOrAfterGroupStart(match, group.startDate)) return;

      var matchId = String(match.id);
      var missing = getMissingPlayersForMatch(matchId, players, predictionMap);
      if (missing.length === 0) return;

      items.push({
        matchId: matchId,
        utcDate: match.utcDate || '',
        homeTeam: match.homeTeam
          ? String(match.homeTeam.shortName || match.homeTeam.name || '')
          : '',
        awayTeam: match.awayTeam
          ? String(match.awayTeam.shortName || match.awayTeam.name || '')
          : '',
        stage: match.stage || '',
        status: status,
        predictedCount: players.length - missing.length,
        expectedCount: players.length,
        missing: missing,
      });
    });

    items.sort(function (a, b) {
      return new Date(a.utcDate).getTime() - new Date(b.utcDate).getTime();
    });

    return { success: true, items: items };
  } catch (err) {
    return { success: false, message: err.message };
  }
}

function handleGetUsers(payload) {
  var auth = verifyAdmin(payload.username, String(payload.passwordHash || ''));
  if (!auth.valid) {
    return { success: false, message: auth.message };
  }

  var sheet = getUsersSheet();
  var data = sheet.getDataRange().getValues();
  var users = [];

  for (var i = 1; i < data.length; i++) {
    if (!data[i][0]) continue;
    users.push({
      username: String(data[i][0]),
      fullName: String(data[i][2]),
      role: String(data[i][3]).toUpperCase(),
      active: String(data[i][4]).toUpperCase() === 'TRUE',
    });
  }

  return { success: true, users: users };
}

function handleCreateUser(payload) {
  var auth = verifyAdmin(payload.username, String(payload.passwordHash || ''));
  if (!auth.valid) {
    return { success: false, message: auth.message };
  }

  var newUsername = sanitizeUsername(payload.newUsername);
  var newPasswordHash = String(payload.newPasswordHash || '');
  var fullName = sanitizeText(payload.fullName, 100);
  var role = String(payload.role || 'USER').toUpperCase();

  if (!newUsername || !newPasswordHash || !fullName) {
    return { success: false, message: 'Thiếu thông tin tạo user' };
  }

  if (['ADMIN', 'USER'].indexOf(role) === -1) {
    return { success: false, message: 'Role không hợp lệ' };
  }

  if (getUserByUsername(newUsername)) {
    return { success: false, message: 'Username đã tồn tại' };
  }

  getUsersSheet().appendRow([newUsername, newPasswordHash, fullName, role, 'TRUE']);

  return { success: true, message: 'Đã tạo user thành công' };
}

function handleResetPassword(payload) {
  var auth = verifyAdmin(payload.username, String(payload.passwordHash || ''));
  if (!auth.valid) {
    return { success: false, message: auth.message };
  }

  var targetUsername = sanitizeUsername(payload.targetUsername);
  var newPasswordHash = String(payload.newPasswordHash || '');

  if (!targetUsername || !newPasswordHash) {
    return { success: false, message: 'Thiếu thông tin reset password' };
  }

  var found = findUserRow(targetUsername);
  if (!found) {
    return { success: false, message: 'User không tồn tại' };
  }

  getUsersSheet().getRange(found.row, 2).setValue(newPasswordHash);

  return { success: true, message: 'Đã reset mật khẩu' };
}

function handleToggleUserStatus(payload) {
  var auth = verifyAdmin(payload.username, String(payload.passwordHash || ''));
  if (!auth.valid) {
    return { success: false, message: auth.message };
  }

  var targetUsername = sanitizeUsername(payload.targetUsername);
  if (!targetUsername) {
    return { success: false, message: 'Thiếu username' };
  }

  if (targetUsername.toLowerCase() === String(payload.username).toLowerCase()) {
    return { success: false, message: 'Không thể khóa chính mình' };
  }

  var found = findUserRow(targetUsername);
  if (!found) {
    return { success: false, message: 'User không tồn tại' };
  }

  var currentActive = String(found.data[4]).toUpperCase() === 'TRUE';
  var newActive = currentActive ? 'FALSE' : 'TRUE';
  getUsersSheet().getRange(found.row, 5).setValue(newActive);

  return {
    success: true,
    message: newActive === 'TRUE' ? 'Đã mở khóa user' : 'Đã khóa user',
    active: newActive === 'TRUE',
  };
}

function handleGetMyGroups(payload) {
  var username = sanitizeUsername(payload.username);
  var passwordHash = String(payload.passwordHash || '');

  var auth = verifyUser(username, passwordHash);
  if (!auth.valid) {
    return { success: false, message: auth.message };
  }

  return { success: true, groups: getGroupsForUser(username) };
}

function handleGetGroups(payload) {
  var auth = verifyAdmin(payload.username, String(payload.passwordHash || ''));
  if (!auth.valid) {
    return { success: false, message: auth.message };
  }

  var sheet = getGroupsSheet();
  var data = sheet.getDataRange().getValues();
  var groups = [];

  for (var i = 1; i < data.length; i++) {
    if (!data[i][0]) continue;
    var groupId = String(data[i][0]);
    groups.push({
      groupId: groupId,
      name: String(data[i][1]),
      active: String(data[i][2]).toUpperCase() === 'TRUE',
      memberCount: countGroupMembers(groupId),
      createdAt: String(data[i][3] || ''),
      startDate: normalizeGroupStartDate(data[i][4]),
    });
  }

  return { success: true, groups: groups };
}

function handleCreateGroup(payload) {
  var auth = verifyAdmin(payload.username, String(payload.passwordHash || ''));
  if (!auth.valid) {
    return { success: false, message: auth.message };
  }

  var groupId = sanitizeGroupId(payload.groupId);
  var name = sanitizeText(payload.name, 100);
  var startDate = normalizeGroupStartDate(payload.startDate);

  if (!groupId || !name) {
    return { success: false, message: 'Thiếu groupId hoặc tên nhóm' };
  }

  if (getGroupById(groupId)) {
    return { success: false, message: 'groupId đã tồn tại' };
  }

  getGroupsSheet().appendRow([groupId, name, 'TRUE', new Date().toISOString(), startDate]);

  return {
    success: true,
    message: 'Đã tạo nhóm thành công',
    groupId: groupId,
    name: name,
    startDate: startDate,
  };
}

function handleUpdateGroup(payload) {
  var auth = verifyAdmin(payload.username, String(payload.passwordHash || ''));
  if (!auth.valid) {
    return { success: false, message: auth.message };
  }

  var groupId = sanitizeGroupId(payload.groupId);
  if (!groupId) {
    return { success: false, message: 'Thiếu groupId' };
  }

  var group = getGroupById(groupId);
  if (!group) {
    return { success: false, message: 'Nhóm không tồn tại' };
  }

  var name = payload.name !== undefined ? sanitizeText(payload.name, 100) : group.name;
  var startDate =
    payload.startDate !== undefined
      ? normalizeGroupStartDate(payload.startDate)
      : group.startDate;

  if (!name) {
    return { success: false, message: 'Tên nhóm không hợp lệ' };
  }

  getGroupsSheet().getRange(group.row, 2).setValue(name);
  getGroupsSheet().getRange(group.row, 5).setValue(startDate);

  return {
    success: true,
    message: 'Đã cập nhật nhóm',
    group: {
      groupId: group.groupId,
      name: name,
      startDate: startDate,
      active: group.active,
    },
  };
}

function handleToggleGroupStatus(payload) {
  var auth = verifyAdmin(payload.username, String(payload.passwordHash || ''));
  if (!auth.valid) {
    return { success: false, message: auth.message };
  }

  var groupId = sanitizeGroupId(payload.groupId);
  if (!groupId) {
    return { success: false, message: 'Thiếu groupId' };
  }

  if (groupIdsMatch(groupId, DEFAULT_GROUP_ID)) {
    return { success: false, message: 'Không thể khóa nhóm mặc định' };
  }

  var group = getGroupById(groupId);
  if (!group) {
    return { success: false, message: 'Nhóm không tồn tại' };
  }

  var newActive = group.active ? 'FALSE' : 'TRUE';
  getGroupsSheet().getRange(group.row, 3).setValue(newActive);

  return {
    success: true,
    message: newActive === 'TRUE' ? 'Đã mở khóa nhóm' : 'Đã khóa nhóm',
    active: newActive === 'TRUE',
  };
}

function handleGetGroupMembers(payload) {
  var auth = verifyAdmin(payload.username, String(payload.passwordHash || ''));
  if (!auth.valid) {
    return { success: false, message: auth.message };
  }

  var groupId = sanitizeGroupId(payload.groupId);
  if (!groupId) {
    return { success: false, message: 'Thiếu groupId' };
  }

  var group = getGroupById(groupId);
  if (!group) {
    return { success: false, message: 'Nhóm không tồn tại' };
  }

  var nameMap = getUserNameMap();
  var sheet = getGroupMembersSheet();
  var data = sheet.getDataRange().getValues();
  var members = [];

  for (var i = 1; i < data.length; i++) {
    if (!groupIdsMatch(data[i][0], groupId)) continue;
    var uname = String(data[i][1]);
    members.push({
      username: uname,
      fullName: nameMap[uname] || uname,
      joinedAt: String(data[i][2] || ''),
    });
  }

  return { success: true, members: members, group: { groupId: group.groupId, name: group.name } };
}

function handleAddGroupMember(payload) {
  var auth = verifyAdmin(payload.username, String(payload.passwordHash || ''));
  if (!auth.valid) {
    return { success: false, message: auth.message };
  }

  var groupId = sanitizeGroupId(payload.groupId);
  var targetUsername = sanitizeUsername(payload.targetUsername);

  if (!groupId || !targetUsername) {
    return { success: false, message: 'Thiếu groupId hoặc username' };
  }

  var group = getGroupById(groupId);
  if (!group) {
    return { success: false, message: 'Nhóm không tồn tại' };
  }

  if (!getUserByUsername(targetUsername)) {
    return { success: false, message: 'User không tồn tại' };
  }

  if (isUserInGroup(targetUsername, groupId)) {
    return { success: false, message: 'User đã thuộc nhóm này' };
  }

  var canonicalGroupId = getGroupById(groupId).groupId;

  getGroupMembersSheet().appendRow([canonicalGroupId, targetUsername, new Date().toISOString()]);

  return { success: true, message: 'Đã thêm thành viên vào nhóm' };
}

function handleRemoveGroupMember(payload) {
  var auth = verifyAdmin(payload.username, String(payload.passwordHash || ''));
  if (!auth.valid) {
    return { success: false, message: auth.message };
  }

  var groupId = sanitizeGroupId(payload.groupId);
  var targetUsername = sanitizeUsername(payload.targetUsername);

  if (!groupId || !targetUsername) {
    return { success: false, message: 'Thiếu groupId hoặc username' };
  }

  var sheet = getGroupMembersSheet();
  var data = sheet.getDataRange().getValues();

  for (var i = 1; i < data.length; i++) {
    if (groupIdsMatch(data[i][0], groupId) && String(data[i][1]) === targetUsername) {
      sheet.deleteRow(i + 1);
      return { success: true, message: 'Đã xóa thành viên khỏi nhóm' };
    }
  }

  return { success: false, message: 'Thành viên không tồn tại trong nhóm' };
}

function sanitizeUsername(value) {
  if (!value) return '';
  return String(value).trim().replace(/[^a-zA-Z0-9_]/g, '').substring(0, 50);
}

function sanitizeText(value, maxLen) {
  if (!value) return '';
  return String(value).trim().substring(0, maxLen || 100);
}

function parseSheetPercent(value) {
  if (value === '' || value === null || value === undefined) return null;
  var num = parseFloat(String(value).replace('%', '').trim());
  if (isNaN(num)) return null;
  return Math.round(num);
}

var FOTMOB_WC_LEAGUE_ID = 77;
var FOTMOB_SITE = 'https://www.fotmob.com';
var FOTMOB_API_DATA = FOTMOB_SITE + '/api/data';
var FOTMOB_API_LEGACY = FOTMOB_SITE + '/api';
var ODDS_API_IO_BASE = 'https://api.odds-api.io/v3';

function fotmobRequestHeaders(acceptType) {
  return {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    Accept: acceptType || '*/*',
    Referer: FOTMOB_SITE + '/',
    'Accept-Language': 'en-US,en;q=0.9',
  };
}

function fotmobFetchJson(url, cachePrefix) {
  var cache = CacheService.getScriptCache();
  var cacheKey = (cachePrefix || 'fmj_') + url;
  var cached = cache.get(cacheKey);
  if (cached) {
    return JSON.parse(cached);
  }

  var response = UrlFetchApp.fetch(url, {
    method: 'get',
    headers: fotmobRequestHeaders('application/json, text/plain, */*'),
    muteHttpExceptions: true,
  });

  var code = response.getResponseCode();
  if (code !== 200) {
    return null;
  }

  try {
    var data = JSON.parse(response.getContentText());
    cache.put(cacheKey, JSON.stringify(data), 300);
    return data;
  } catch (parseErr) {
    return null;
  }
}

function oddsApiIoGet(path, params) {
  var apiKey = getOddsApiIoKey();
  if (!apiKey) return null;

  var query = [];
  var payload = params || {};
  payload.apiKey = apiKey;

  Object.keys(payload).forEach(function (key) {
    if (payload[key] === null || payload[key] === undefined || payload[key] === '') return;
    query.push(encodeURIComponent(key) + '=' + encodeURIComponent(String(payload[key])));
  });

  var url = ODDS_API_IO_BASE + path + (query.length ? '?' + query.join('&') : '');
  var cache = CacheService.getScriptCache();
  var cacheKey = 'oio_' + url;
  var cached = cache.get(cacheKey);
  if (cached) {
    return JSON.parse(cached);
  }

  var response = UrlFetchApp.fetch(url, {
    method: 'get',
    muteHttpExceptions: true,
    headers: {
      Accept: 'application/json',
      'User-Agent': 'Mozilla/5.0',
    },
  });

  if (response.getResponseCode() !== 200) return null;

  try {
    var data = JSON.parse(response.getContentText());
    cache.put(cacheKey, JSON.stringify(data), 120);
    return data;
  } catch (err) {
    return null;
  }
}

function fotmobFetchData(path, params) {
  var query = '';
  if (params) {
    var parts = [];
    Object.keys(params).forEach(function (key) {
      parts.push(encodeURIComponent(key) + '=' + encodeURIComponent(params[key]));
    });
    query = '?' + parts.join('&');
  }
  return fotmobFetchJson(FOTMOB_API_DATA + path + query, 'fmd_');
}

function fotmobFetchLegacy(path, params) {
  var query = '';
  if (params) {
    var parts = [];
    Object.keys(params).forEach(function (key) {
      parts.push(encodeURIComponent(key) + '=' + encodeURIComponent(params[key]));
    });
    query = '?' + parts.join('&');
  }
  return fotmobFetchJson(FOTMOB_API_LEGACY + path + query, 'fml_');
}

function fotmobFetchHtml(url) {
  var cache = CacheService.getScriptCache();
  var cacheKey = 'fmh_' + url;
  var cached = cache.get(cacheKey);
  if (cached) {
    return cached;
  }

  var response = UrlFetchApp.fetch(url, {
    method: 'get',
    headers: fotmobRequestHeaders('text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'),
    muteHttpExceptions: true,
    followRedirects: true,
  });

  if (response.getResponseCode() !== 200) {
    throw new Error('FotMob page lỗi HTTP ' + response.getResponseCode());
  }

  var html = response.getContentText();
  cache.put(cacheKey, html, 300);
  return html;
}

function fetchFotmobPageProps(pagePath) {
  var url = pagePath.indexOf('http') === 0 ? pagePath : FOTMOB_SITE + pagePath;
  return extractFotmobNextData(fotmobFetchHtml(url));
}

function extractFotmobNextData(html) {
  var marker = 'id="__NEXT_DATA__"';
  var markerIdx = html.indexOf(marker);
  if (markerIdx === -1) {
    throw new Error('Không tìm thấy dữ liệu FotMob trên trang');
  }

  var start = html.indexOf('>', markerIdx) + 1;
  var end = html.indexOf('</script>', start);
  if (start <= 0 || end === -1) {
    throw new Error('Không parse được dữ liệu FotMob');
  }

  var wrapper = JSON.parse(html.substring(start, end));
  var pageProps = wrapper.props && wrapper.props.pageProps;
  if (!pageProps) {
    throw new Error('FotMob pageProps trống');
  }

  return pageProps;
}

function normalizeFotmobMatchDetails(pageProps) {
  if (!pageProps) return null;
  if (pageProps.general && pageProps.content) return pageProps;
  if (pageProps.data && pageProps.data.general) return pageProps.data;
  if (pageProps.match && pageProps.match.general) return pageProps.match;
  if (pageProps.matchDetails && pageProps.matchDetails.general) return pageProps.matchDetails;
  if (pageProps.initialState && pageProps.initialState.match && pageProps.initialState.match.general) {
    return pageProps.initialState.match;
  }
  return null;
}

function collectFotmobMatchesFromNode(node, depth, matches) {
  if (!node || depth > 10) return;
  if (Array.isArray(node)) {
    for (var i = 0; i < node.length; i++) {
      var item = node[i];
      if (item && item.id && item.home && item.away && item.home.name && item.away.name) {
        matches.push(item);
      }
      collectFotmobMatchesFromNode(item, depth + 1, matches);
    }
    return;
  }
  if (typeof node !== 'object') return;

  if (node.allMatches && Array.isArray(node.allMatches)) {
    collectFotmobMatchesFromNode(node.allMatches, depth + 1, matches);
  }
  if (node.matches && Array.isArray(node.matches)) {
    collectFotmobMatchesFromNode(node.matches, depth + 1, matches);
  }
  if (node.leagues && Array.isArray(node.leagues)) {
    collectFotmobMatchesFromNode(node.leagues, depth + 1, matches);
  }

  Object.keys(node).forEach(function (key) {
    if (key === 'home' || key === 'away' || key === 'status' || key === 'content') return;
    collectFotmobMatchesFromNode(node[key], depth + 1, matches);
  });
}

function collectFotmobMatches(pageProps) {
  var matches = [];
  collectFotmobMatchesFromNode(pageProps, 0, matches);

  var unique = {};
  var result = [];
  matches.forEach(function (m) {
    var id = String(m.id);
    if (!unique[id]) {
      unique[id] = true;
      result.push(m);
    }
  });
  return result;
}

var TEAM_KEY_ALIASES = {
  bosniah: 'bosniaherzegovina',
  bosnia: 'bosniaherzegovina',
  bosniaandherzegovina: 'bosniaherzegovina',
  bosniaherzegovina: 'bosniaherzegovina',
  usa: 'unitedstates',
  us: 'unitedstates',
  korearepublic: 'southkorea',
  korearep: 'southkorea',
  republicofireland: 'ireland',
  caboverde: 'capeverde',
  curacao: 'curacao',
  cotedivoire: 'ivorycoast',
  turkiye: 'turkey',
};

var TEAM_SLUG_ALIASES = {
  'bosnia-h': 'bosnia-herzegovina',
  bosnia: 'bosnia-herzegovina',
  'bosnia-and-herzegovina': 'bosnia-herzegovina',
  'korea-republic': 'south-korea',
  'korea-rep': 'south-korea',
  usa: 'united-states',
  'cote-divoire': 'ivory-coast',
  'cape-verde': 'cabo-verde',
};

function normalizeTeamKey(name) {
  return String(name || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

function getTeamMatchKeys(name) {
  var raw = normalizeTeamKey(name);
  if (!raw) return [];

  var keys = [raw];
  var stripped = raw.replace(/and/g, '').replace(/the/g, '').replace(/republic/g, '');
  if (stripped && stripped !== raw) keys.push(stripped);

  if (raw.length > 5 && /[a-z]h$/.test(raw)) {
    keys.push(raw.slice(0, -1));
  }

  keys.forEach(function (key) {
    if (TEAM_KEY_ALIASES[key]) keys.push(TEAM_KEY_ALIASES[key]);
  });

  var unique = {};
  var result = [];
  keys.forEach(function (key) {
    if (!key || unique[key]) return;
    unique[key] = true;
    result.push(key);
  });
  return result;
}

function teamsLikelyMatch(a, b) {
  var keysA = getTeamMatchKeys(a);
  var keysB = getTeamMatchKeys(b);
  if (!keysA.length || !keysB.length) return false;

  for (var i = 0; i < keysA.length; i++) {
    for (var j = 0; j < keysB.length; j++) {
      var na = keysA[i];
      var nb = keysB[j];
      if (!na || !nb) continue;
      if (na === nb) return true;

      var minLen = Math.min(na.length, nb.length);
      if (minLen >= 4 && (na.indexOf(nb) !== -1 || nb.indexOf(na) !== -1)) {
        return true;
      }
    }
  }
  return false;
}

function uniqueTeamNames() {
  var seen = {};
  var result = [];
  for (var i = 0; i < arguments.length; i++) {
    var name = String(arguments[i] || '').trim();
    if (!name) continue;
    var key = name.toLowerCase();
    if (seen[key]) continue;
    seen[key] = true;
    result.push(name);
  }
  return result;
}

function toFotmobTeamSlug(name) {
  var slug = String(name || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\./g, '')
    .replace(/\band\b/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return TEAM_SLUG_ALIASES[slug] || slug;
}

function buildFotmobMatchSlug(homeName, awayName) {
  var homeSlug = toFotmobTeamSlug(homeName);
  var awaySlug = toFotmobTeamSlug(awayName);
  if (!homeSlug || !awaySlug) return '';
  return homeSlug + '-vs-' + awaySlug;
}

function extractFotmobMatchIdFromDetails(details) {
  if (!details) return '';
  if (details.general && details.general.matchId) {
    return String(details.general.matchId);
  }
  if (details.header && details.header.matchId) {
    return String(details.header.matchId);
  }
  return '';
}

function formatFotmobDateStr(utcDateIso) {
  return Utilities.formatDate(new Date(utcDateIso), 'GMT', 'yyyyMMdd');
}

function formatFotmobDayKey(utcDateIso) {
  return Utilities.formatDate(new Date(utcDateIso), 'GMT', 'yyyy-MM-dd');
}

function getFotmobMatchIdFromSheet(matchId) {
  var sheet = getMatchInsightsSheet();
  if (!sheet) return '';

  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(matchId)) {
      return String(data[i][5] || '');
    }
  }
  return '';
}

function findFotmobMatchInList(matches, homeName, awayName) {
  for (var i = 0; i < matches.length; i++) {
    var m = matches[i];
    var home = (m.home && m.home.name) || '';
    var away = (m.away && m.away.name) || '';
    if (teamsLikelyMatch(home, homeName) && teamsLikelyMatch(away, awayName)) {
      return {
        id: String(m.id),
        pageUrl: m.pageUrl || '',
      };
    }
  }
  return null;
}

function findFotmobMatchInCollected(matches, homeName, awayName, utcDateIso) {
  var dayKey = formatFotmobDayKey(utcDateIso);
  var exactDay = null;
  var anyDay = null;

  for (var i = 0; i < matches.length; i++) {
    var m = matches[i];
    var home = (m.home && m.home.name) || '';
    var away = (m.away && m.away.name) || '';
    if (!teamsLikelyMatch(home, homeName) || !teamsLikelyMatch(away, awayName)) {
      continue;
    }

    var ref = {
      id: String(m.id),
      pageUrl: m.pageUrl || '',
    };

    var matchDay = '';
    if (m.status && m.status.utcTime) {
      matchDay = formatFotmobDayKey(m.status.utcTime);
    } else if (m.time && m.time.utcTime) {
      matchDay = formatFotmobDayKey(m.time.utcTime);
    }

    if (matchDay && matchDay === dayKey) {
      exactDay = ref;
      break;
    }
    if (!anyDay) anyDay = ref;
  }

  return exactDay || anyDay;
}

function findFotmobMatchFromApi(homeName, awayName, utcDateIso) {
  var dateStr = formatFotmobDateStr(utcDateIso);
  var data = fotmobFetchData('/matches', { date: dateStr });
  if (!data) {
    data = fotmobFetchLegacy('/matches', { date: dateStr });
  }
  if (!data) return null;

  var leagues = data.leagues || [];
  for (var i = 0; i < leagues.length; i++) {
    var found = findFotmobMatchInList(leagues[i].matches || [], homeName, awayName);
    if (found) return found;
  }

  return findFotmobMatchInCollected(collectFotmobMatches(data), homeName, awayName, utcDateIso);
}

function findFotmobMatchFromWorldCupPage(homeName, awayName, utcDateIso) {
  var pagePaths = [
    '/leagues/' + FOTMOB_WC_LEAGUE_ID + '/overview/world-cup',
    '/leagues/' + FOTMOB_WC_LEAGUE_ID + '/fixtures/world-cup',
    '/leagues/' + FOTMOB_WC_LEAGUE_ID + '/table/world-cup',
  ];

  for (var p = 0; p < pagePaths.length; p++) {
    try {
      var pageProps = fetchFotmobPageProps(pagePaths[p]);
      var found = findFotmobMatchInCollected(
        collectFotmobMatches(pageProps),
        homeName,
        awayName,
        utcDateIso
      );
      if (found) return found;
    } catch (pageErr) {
      // try next page variant
    }
  }

  var seasons = ['2025/2026', '2026', '2026/2027', ''];
  for (var s = 0; s < seasons.length; s++) {
    var params = { id: FOTMOB_WC_LEAGUE_ID, tab: 'fixtures' };
    if (seasons[s]) params.season = seasons[s];

    var data = fotmobFetchData('/leagues', params);
    if (!data) {
      data = fotmobFetchLegacy('/leagues', params);
    }
    if (!data) continue;

    var foundLeague = findFotmobMatchInCollected(
      collectFotmobMatches(data),
      homeName,
      awayName,
      utcDateIso
    );
    if (foundLeague) return foundLeague;
  }

  return null;
}

function findFotmobMatchFromDayPage(homeName, awayName, utcDateIso) {
  var dateStr = formatFotmobDateStr(utcDateIso);
  var pagePaths = ['/?date=' + dateStr, '/matches?date=' + dateStr];

  for (var p = 0; p < pagePaths.length; p++) {
    try {
      var pageProps = fetchFotmobPageProps(pagePaths[p]);
      var found = findFotmobMatchInCollected(
        collectFotmobMatches(pageProps),
        homeName,
        awayName,
        utcDateIso
      );
      if (found) return found;
    } catch (pageErr) {
      // try next page variant
    }
  }

  return findFotmobMatchFromApi(homeName, awayName, utcDateIso);
}

function findFotmobMatchFromSlugPage(homeNames, awayNames) {
  for (var h = 0; h < homeNames.length; h++) {
    for (var a = 0; a < awayNames.length; a++) {
      var slug = buildFotmobMatchSlug(homeNames[h], awayNames[a]);
      if (!slug) continue;

      var pagePaths = [
        '/matches/' + slug,
        '/matches/' + slug + '/match',
      ];

      for (var p = 0; p < pagePaths.length; p++) {
        var details = tryFotmobPageDetails(pagePaths[p]);
        var matchId = extractFotmobMatchIdFromDetails(details);
        if (matchId) {
          return { id: matchId, pageUrl: pagePaths[p] };
        }
      }
    }
  }
  return null;
}

function findFotmobMatchFromSearch(homeNames, awayNames, utcDateIso) {
  var terms = [];
  homeNames.forEach(function (home) {
    awayNames.forEach(function (away) {
      terms.push(home + ' ' + away);
      terms.push(away + ' ' + home);
    });
  });

  for (var t = 0; t < terms.length; t++) {
    var data =
      fotmobFetchData('/searchapi', { term: terms[t] }) ||
      fotmobFetchLegacy('/searchData', { term: terms[t] });
    if (!data) continue;

    var matches = collectFotmobMatches(data);
    for (var h = 0; h < homeNames.length; h++) {
      for (var a = 0; a < awayNames.length; a++) {
        var found = findFotmobMatchInCollected(matches, homeNames[h], awayNames[a], utcDateIso);
        if (found) return found;
      }
    }
  }

  return null;
}

function resolveFotmobMatchWithNames(homeName, awayName, utcDateIso) {
  var found = findFotmobMatchFromWorldCupPage(homeName, awayName, utcDateIso);
  if (found) return found;

  found = findFotmobMatchFromDayPage(homeName, awayName, utcDateIso);
  if (found) return found;

  return null;
}

function resolveFotmobMatchRef(homeName, awayName, utcDateIso, overrideId, homeShortName, awayShortName) {
  if (overrideId) {
    return { id: String(overrideId), pageUrl: '' };
  }

  var homeNames = uniqueTeamNames(homeName, homeShortName);
  var awayNames = uniqueTeamNames(awayName, awayShortName);
  if (!homeNames.length) homeNames = [homeName];
  if (!awayNames.length) awayNames = [awayName];

  var h;
  var a;
  var found;

  for (h = 0; h < homeNames.length; h++) {
    for (a = 0; a < awayNames.length; a++) {
      found = resolveFotmobMatchWithNames(homeNames[h], awayNames[a], utcDateIso);
      if (found) return found;
    }
  }

  found = findFotmobMatchFromSlugPage(homeNames, awayNames);
  if (found) return found;

  return findFotmobMatchFromSearch(homeNames, awayNames, utcDateIso);
}

function tryFotmobApiDetails(fotmobMatchId) {
  var data =
    fotmobFetchData('/matchDetails', { matchId: fotmobMatchId }) ||
    fotmobFetchLegacy('/matchDetails', { matchId: fotmobMatchId });
  return normalizeFotmobMatchDetails(data);
}

function tryFotmobPageDetails(pagePath) {
  try {
    var pageProps = fetchFotmobPageProps(pagePath);
    return normalizeFotmobMatchDetails(pageProps);
  } catch (pageErr) {
    return null;
  }
}

function fetchFotmobMatchDetails(fotmobMatchId, pageUrl) {
  var details = tryFotmobApiDetails(fotmobMatchId);
  if (details) return details;

  if (pageUrl) {
    details = tryFotmobPageDetails(pageUrl);
    if (details) return details;
  }

  var pagePaths = [
    '/match/' + fotmobMatchId,
    '/matches/match/' + fotmobMatchId,
    '/matches/a-vs-b/' + fotmobMatchId,
  ];

  for (var i = 0; i < pagePaths.length; i++) {
    details = tryFotmobPageDetails(pagePaths[i]);
    if (details) return details;
  }

  if (!pageUrl) {
    var wcPaths = [
      '/leagues/' + FOTMOB_WC_LEAGUE_ID + '/overview/world-cup',
      '/leagues/' + FOTMOB_WC_LEAGUE_ID + '/fixtures/world-cup',
    ];
    for (var w = 0; w < wcPaths.length; w++) {
      try {
        var wcProps = fetchFotmobPageProps(wcPaths[w]);
        var wcMatches = collectFotmobMatches(wcProps);
        for (var m = 0; m < wcMatches.length; m++) {
          if (String(wcMatches[m].id) === String(fotmobMatchId) && wcMatches[m].pageUrl) {
            details = tryFotmobPageDetails(wcMatches[m].pageUrl);
            if (details) return details;
          }
        }
      } catch (wcErr) {
        // continue
      }
    }
  }

  throw new Error(
    'Không tải được dữ liệu FotMob. Thêm fotmob_match_id (cột F) vào sheet MatchInsights.'
  );
}

function getPlayerDisplayName(player) {
  if (!player) return '';
  if (typeof player.name === 'string') return player.name;
  if (player.name && player.name.full) return player.name.full;
  if (player.name && player.name.first && player.name.last) {
    return player.name.first + ' ' + player.name.last;
  }
  return player.name || '';
}

function getFotmobPlayerImageUrl(player) {
  if (!player) return '';

  var direct = String(player.imageUrl || player.ImageURL || '');
  if (/^https:\/\/images\.fotmob\.com\//i.test(direct)) {
    return direct;
  }

  var playerId = player.id || player.ID || player.playerId;
  if (playerId) {
    return (
      'https://images.fotmob.com/image_resources/playerimages/' +
      encodeURIComponent(String(playerId)) +
      '.png'
    );
  }

  return '';
}

function parseFotmobPlayerEntry(player) {
  return {
    name: getPlayerDisplayName(player),
    shirt: String(player.shirt || player.shirtNumber || ''),
    imageUrl: getFotmobPlayerImageUrl(player),
    playerId: String(player.id || player.ID || player.playerId || ''),
  };
}

function parseFotmobTeamLineup(teamLineup, playersOut) {
  if (!teamLineup) return null;

  var players = playersOut || [];
  var rows = teamLineup.players || [];
  for (var r = 0; r < rows.length; r++) {
    var row = rows[r] || [];
    for (var p = 0; p < row.length; p++) {
      players.push(parseFotmobPlayerEntry(row[p]));
    }
  }

  if (teamLineup.optaLineup && teamLineup.optaLineup.starting) {
    players = teamLineup.optaLineup.starting.map(parseFotmobPlayerEntry);
  } else if (teamLineup.optaLineup && teamLineup.optaLineup.players) {
    players = [];
    var optaRows = teamLineup.optaLineup.players || [];
    for (var or = 0; or < optaRows.length; or++) {
      var optaRow = optaRows[or] || [];
      for (var op = 0; op < optaRow.length; op++) {
        players.push(parseFotmobPlayerEntry(optaRow[op]));
      }
    }
  }

  return {
    name: teamLineup.teamName || teamLineup.name || '',
    formation: teamLineup.formation || '',
    players: players,
  };
}

function parseFotmobLineup(details) {
  var lineup = details.content && details.content.lineup;
  if (!lineup) return null;

  var result = { home: null, away: null };
  var general = details.general || {};

  if (lineup.homeTeam) {
    result.home = {
      name: lineup.homeTeam.name || (general.homeTeam && general.homeTeam.name) || '',
      formation: lineup.homeTeam.formation || '',
      players: (lineup.homeTeam.starters || []).map(parseFotmobPlayerEntry),
    };
  }

  if (lineup.awayTeam) {
    result.away = {
      name: lineup.awayTeam.name || (general.awayTeam && general.awayTeam.name) || '',
      formation: lineup.awayTeam.formation || '',
      players: (lineup.awayTeam.starters || []).map(parseFotmobPlayerEntry),
    };
  }

  if ((!result.home || !result.home.players.length) && lineup.lineup && lineup.lineup.length) {
    for (var i = 0; i < lineup.lineup.length; i++) {
      var teamLineup = lineup.lineup[i];
      var parsed = parseFotmobTeamLineup(teamLineup, []);
      if (!parsed) continue;

      var homeId = general.homeTeam && general.homeTeam.id;
      if (homeId && String(teamLineup.teamId) === String(homeId)) {
        result.home = parsed;
      } else {
        result.away = parsed;
      }
    }
  }

  if (!result.home && !result.away) return null;
  return result;
}

function parseFotmobH2H(details) {
  var h2h = details.content && details.content.h2h;
  if (!h2h) return null;

  var summary = h2h.summary || [];
  var matches = (h2h.matches || []).map(function (m) {
    var date = '';
    if (m.time && m.time.utcTime) {
      date = String(m.time.utcTime);
    } else if (m.status && m.status.utcTime) {
      date = String(m.status.utcTime);
    }

    return {
      date: date,
      home: (m.home && m.home.name) || '',
      away: (m.away && m.away.name) || '',
      score: (m.status && m.status.scoreStr) || '',
      league: (m.league && m.league.name) || '',
    };
  });

  return {
    homeWins: summary[0] || 0,
    draws: summary[1] || 0,
    awayWins: summary[2] || 0,
    matches: matches,
  };
}

function formatFotmobInsightText(insight) {
  var text = String((insight && (insight.defaultText || insight.text)) || '').trim();
  if (!text) return '';

  var values = [];
  (insight.statValues || []).forEach(function (sv) {
    if (sv && sv.value !== undefined && sv.value !== null) {
      values.push(String(sv.value));
    } else if (sv && sv.name !== undefined) {
      values.push(String(sv.name));
    }
  });

  return text.replace(/\{(\d+)\}/g, function (_match, index) {
    var idx = parseInt(index, 10);
    return values[idx] !== undefined ? values[idx] : '';
  });
}

function parseProbabilityTriple(home, draw, away, source) {
  var h = Number(home);
  var d = Number(draw);
  var a = Number(away);
  if (isNaN(h) || isNaN(d) || isNaN(a)) return null;

  if (h <= 1 && d <= 1 && a <= 1 && h + d + a > 0.9 && h + d + a <= 1.1) {
    h *= 100;
    d *= 100;
    a *= 100;
  }

  if (h < 0 || d < 0 || a < 0) return null;
  if (h + d + a < 90 || h + d + a > 110) return null;

  return {
    home: Math.round(h),
    draw: Math.round(d),
    away: Math.round(a),
    source: source || 'fotmob',
  };
}

function coerceOddsNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return isNaN(value) ? null : value;
  if (typeof value === 'string') {
    var cleaned = String(value).trim().replace(',', '.').replace(/[^\d.]/g, '');
    if (!cleaned) return null;
    var parsed = parseFloat(cleaned);
    return isNaN(parsed) ? null : parsed;
  }
  if (typeof value === 'object') {
    if (value.value !== undefined) return coerceOddsNumber(value.value);
    if (value.Value !== undefined) return coerceOddsNumber(value.Value);
    if (value.name !== undefined) return coerceOddsNumber(value.name);
    if (value.Name !== undefined) return coerceOddsNumber(value.Name);
  }
  return null;
}

function parseEuropeanOddsTriple(home, draw, away, source) {
  var h = coerceOddsNumber(home);
  var d = coerceOddsNumber(draw);
  var a = coerceOddsNumber(away);
  if (h === null || d === null || a === null) return null;
  if (h < 1.01 || d < 1.01 || a < 1.01) return null;
  if (h > 500 || d > 500 || a > 500) return null;
  if (h + d + a >= 90 && h + d + a <= 110) return null;

  var impliedHome = 1 / h;
  var impliedDraw = 1 / d;
  var impliedAway = 1 / a;
  var total = impliedHome + impliedDraw + impliedAway;
  if (!total) return null;

  return {
    home: Math.round((impliedHome / total) * 100),
    draw: Math.round((impliedDraw / total) * 100),
    away: Math.round((impliedAway / total) * 100),
    source: source || 'fotmob-odds',
    odds: {
      home: Math.round(h * 100) / 100,
      draw: Math.round(d * 100) / 100,
      away: Math.round(a * 100) / 100,
    },
  };
}

function parseOddsTriple(home, draw, away, source) {
  return (
    parseEuropeanOddsTriple(home, draw, away, source) ||
    parseProbabilityTriple(home, draw, away, source)
  );
}

function findEuropeanOddsInObject(node, depth) {
  if (!node || depth > 12) return null;

  if (Array.isArray(node)) {
    for (var i = 0; i < node.length; i++) {
      var foundInArray = findEuropeanOddsInObject(node[i], depth + 1);
      if (foundInArray) return foundInArray;
    }
    return null;
  }

  if (typeof node !== 'object') return null;

  if (
    node.homeWin !== undefined &&
    node.draw !== undefined &&
    node.awayWin !== undefined &&
    !node.matches
  ) {
    var fromWinKeys = parseEuropeanOddsTriple(
      node.homeWin,
      node.draw,
      node.awayWin,
      'fotmob-odds'
    );
    if (fromWinKeys) return fromWinKeys;
  }

  if (
    node.home !== undefined &&
    node.draw !== undefined &&
    node.away !== undefined &&
    !node.matches &&
    node.homeWin === undefined &&
    node.awayWin === undefined
  ) {
    var fromHomeKeys = parseEuropeanOddsTriple(
      node.home,
      node.draw,
      node.away,
      'fotmob-odds'
    );
    if (fromHomeKeys) return fromHomeKeys;
  }

  if (node.odds && typeof node.odds === 'object') {
    var fromOdds = parseEuropeanOddsTriple(
      node.odds.homeWin || node.odds.home,
      node.odds.draw,
      node.odds.awayWin || node.odds.away,
      'fotmob-odds'
    );
    if (fromOdds) return fromOdds;
  }

  var keys = Object.keys(node);
  for (var k = 0; k < keys.length; k++) {
    var found = findEuropeanOddsInObject(node[keys[k]], depth + 1);
    if (found) return found;
  }

  return null;
}

function getOddspollFacts(poll) {
  if (!poll) return [];
  var oddspoll = poll.oddspoll || poll.oddsPoll || poll.Oddspoll;
  if (!oddspoll) return [];
  return oddspoll.Facts || oddspoll.facts || [];
}

function isEuropeanOddsFact(fact) {
  if (!fact) return true;
  var oddsType = String(fact.OddsType || fact.oddsType || '').toLowerCase();
  if (!oddsType) return true;
  if (
    oddsType.indexOf('over') !== -1 ||
    oddsType.indexOf('under') !== -1 ||
    oddsType.indexOf('both') !== -1 ||
    oddsType.indexOf('btts') !== -1 ||
    oddsType.indexOf('handicap') !== -1 ||
    oddsType.indexOf('corner') !== -1
  ) {
    return false;
  }
  return true;
}

function extractEuropeanOddValues(fact) {
  if (!fact) return null;
  var raw = fact.StatValues || fact.statValues || fact.Values || fact.values;
  if (!raw || raw.length < 3) return null;

  var values = [];
  for (var i = 0; i < raw.length; i++) {
    var num = coerceOddsNumber(raw[i]);
    if (num === null) return null;
    values.push(num);
  }
  return values.length >= 3 ? values.slice(0, 3) : null;
}

function parseFotmobEuropeanOddsFromPoll(poll) {
  var facts = getOddspollFacts(poll);
  for (var o = 0; o < facts.length; o++) {
    var oddFact = facts[o];
    if (!isEuropeanOddsFact(oddFact)) continue;
    var values = extractEuropeanOddValues(oddFact);
    if (!values) continue;
    var fromOdds = parseEuropeanOddsTriple(
      values[0],
      values[1],
      values[2],
      'fotmob-odds'
    );
    if (fromOdds && fromOdds.odds) return fromOdds;
  }
  return null;
}

function fetchFotmobMatchOdds(fotmobMatchId) {
  if (!fotmobMatchId) return null;

  var paths = ['/oddspoll', '/matchOdds', '/odds'];
  for (var i = 0; i < paths.length; i++) {
    var data =
      fotmobFetchData(paths[i], { matchId: fotmobMatchId }) ||
      fotmobFetchLegacy(paths[i], { matchId: fotmobMatchId });
    if (!data) continue;

    var fromPoll = parseFotmobEuropeanOddsFromPoll(data.poll || data);
    if (fromPoll) return fromPoll;

    var fromObj = findEuropeanOddsInObject(data, 0);
    if (fromObj) return fromObj;
  }

  return null;
}

function parseFotmobEuropeanOddsOnly(details) {
  if (!details) return null;

  var facts = details.content && details.content.matchFacts;
  var fromPoll = parseFotmobEuropeanOddsFromPoll(facts && facts.poll);
  if (fromPoll) return fromPoll;

  return findEuropeanOddsInObject(details, 0);
}

function tryFotmobOddsFromOtherPages(fotmobMatchId, homeName, awayName, pageUrl) {
  var candidates = [];

  if (pageUrl) {
    candidates.push(pageUrl + '/odds');
    candidates.push(pageUrl + '/match/odds');
  }

  if (homeName && awayName) {
    var slug1 = buildFotmobMatchSlug(homeName, awayName);
    var slug2 = buildFotmobMatchSlug(awayName, homeName);

    if (slug1) {
      candidates.push('/matches/odds-' + slug1);
      candidates.push('/matches/' + slug1 + '/odds');
    }
    if (slug2) {
      candidates.push('/matches/odds-' + slug2);
      candidates.push('/matches/' + slug2 + '/odds');
    }
  }

  if (fotmobMatchId) {
    candidates.push('/match/' + fotmobMatchId + '/odds');
    candidates.push('/matches/match/' + fotmobMatchId + '/odds');
  }

  var seen = {};
  for (var i = 0; i < candidates.length; i++) {
    var path = candidates[i];
    if (!path || seen[path]) continue;
    seen[path] = true;

    try {
      var pageDetails = tryFotmobPageDetails(path);
      if (!pageDetails) continue;

      var fromPageOdds = parseFotmobEuropeanOddsOnly(pageDetails);
      if (fromPageOdds) return fromPageOdds;

      var fromPageProb = parseFotmobProbabilities(pageDetails);
      if (fromPageProb) return fromPageProb;
    } catch (err) {
      // continue
    }
  }

  return null;
}

function resolveWinProbabilityWithOdds(
  details,
  fotmobMatchId,
  footballMatchId,
  pageUrl,
  homeName,
  awayName,
  utcDateIso
) {
  var fallback = parseFotmobProbabilities(details);

  // Priority source: Odds-API.io (explicit odds feed).
  var fromOddsApiIo = parseOddsApiIoOdds(homeName, awayName, utcDateIso);
  if (fromOddsApiIo) return fromOddsApiIo;

  var fromDetails = parseFotmobEuropeanOddsOnly(details);
  if (fromDetails) return fromDetails;

  if (pageUrl) {
    var pageDetails = tryFotmobPageDetails(pageUrl);
    if (pageDetails) {
      var fromPageOdds = parseFotmobEuropeanOddsOnly(pageDetails);
      if (fromPageOdds) return fromPageOdds;

      var fromPageProb = parseFotmobProbabilities(pageDetails);
      if (fromPageProb) return fromPageProb;
    }
  }

  // FotMob đôi khi không trả odds/probabilities trong matchDetails,
  // nên thử thêm từ các trang "Odds" khác.
  var fromAltPages = tryFotmobOddsFromOtherPages(
    fotmobMatchId,
    homeName,
    awayName,
    pageUrl
  );
  if (fromAltPages) return fromAltPages;

  var fromFotmobOdds = fetchFotmobMatchOdds(fotmobMatchId);
  if (fromFotmobOdds) return fromFotmobOdds;

  var fromFootballData = parseFootballDataOdds(footballMatchId, utcDateIso);
  if (fromFootballData) return fromFootballData;

  return fallback;
}

function parseFootballDataMatchOdds(match) {
  if (!match || !match.odds) return null;
  if (
    match.odds.homeWin == null ||
    match.odds.draw == null ||
    match.odds.awayWin == null
  ) {
    return null;
  }

  return parseEuropeanOddsTriple(
    match.odds.homeWin,
    match.odds.draw,
    match.odds.awayWin,
    'football-data-odds'
  );
}

function toFootballDate(utcDateIso) {
  if (!utcDateIso) return '';
  return Utilities.formatDate(new Date(utcDateIso), 'GMT', 'yyyy-MM-dd');
}

function toRfc3339DayRange(utcDateIso) {
  var day = toFootballDate(utcDateIso);
  if (!day) return null;
  return {
    from: day + 'T00:00:00Z',
    to: day + 'T23:59:59Z',
  };
}

function getOddsApiEventTeamName(eventObj, side) {
  if (!eventObj) return '';
  var value = eventObj[side];
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object') {
    return value.name || value.team || value.title || '';
  }
  return '';
}

function resolveOddsApiEventId(homeName, awayName, utcDateIso) {
  var range = toRfc3339DayRange(utcDateIso);
  if (!range) return '';

  var events = oddsApiIoGet('/events', {
    sport: 'football',
    from: range.from,
    to: range.to,
    limit: 200,
  });
  if (!events || !events.length) return '';

  for (var i = 0; i < events.length; i++) {
    var ev = events[i];
    var home = getOddsApiEventTeamName(ev, 'home');
    var away = getOddsApiEventTeamName(ev, 'away');
    if (!home || !away) continue;
    if (teamsLikelyMatch(home, homeName) && teamsLikelyMatch(away, awayName)) {
      return String(ev.id || ev.eventId || ev.key || '');
    }
  }
  return '';
}

function parseOddsApiIoFromOutcomeArray(outcomes) {
  if (!outcomes || !outcomes.length) return null;

  var mapped = { home: null, draw: null, away: null };
  for (var i = 0; i < outcomes.length; i++) {
    var item = outcomes[i] || {};
    var name = String(item.name || item.label || item.outcome || '').toLowerCase();
    var price = coerceOddsNumber(item.price || item.odds || item.value);
    if (price === null) continue;

    if (name === 'home' || name === '1' || name.indexOf('home') !== -1) mapped.home = price;
    else if (name === 'draw' || name === 'x' || name.indexOf('draw') !== -1) mapped.draw = price;
    else if (name === 'away' || name === '2' || name.indexOf('away') !== -1) mapped.away = price;
  }

  if (mapped.home && mapped.draw && mapped.away) {
    return parseEuropeanOddsTriple(
      mapped.home,
      mapped.draw,
      mapped.away,
      'odds-api-io'
    );
  }

  return null;
}

function findOddsApiIoInObject(node, depth) {
  if (!node || depth > 12) return null;

  if (Array.isArray(node)) {
    var fromOutcomeArray = parseOddsApiIoFromOutcomeArray(node);
    if (fromOutcomeArray) return fromOutcomeArray;
    for (var i = 0; i < node.length; i++) {
      var foundInArray = findOddsApiIoInObject(node[i], depth + 1);
      if (foundInArray) return foundInArray;
    }
    return null;
  }

  if (typeof node !== 'object') return null;

  var fromDirect = parseEuropeanOddsTriple(
    node.homeWin || node.homeOdds || node.home,
    node.draw || node.drawOdds || node.tie,
    node.awayWin || node.awayOdds || node.away,
    'odds-api-io'
  );
  if (fromDirect) return fromDirect;

  if (node.outcomes && Array.isArray(node.outcomes)) {
    var fromOutcomes = parseOddsApiIoFromOutcomeArray(node.outcomes);
    if (fromOutcomes) return fromOutcomes;
  }

  var keys = Object.keys(node);
  for (var k = 0; k < keys.length; k++) {
    var found = findOddsApiIoInObject(node[keys[k]], depth + 1);
    if (found) return found;
  }
  return null;
}

function parseOddsApiIoOdds(homeName, awayName, utcDateIso) {
  if (!getOddsApiIoKey()) return null;

  var eventId = resolveOddsApiEventId(homeName, awayName, utcDateIso);
  if (!eventId) return null;

  var odds = oddsApiIoGet('/odds', {
    eventId: eventId,
    bookmakers: getOddsApiIoBookmakers(),
  });
  if (!odds) return null;

  return findOddsApiIoInObject(odds, 0);
}

function parseFootballDataOdds(matchId, utcDateIso) {
  if (!matchId || !getFootballApiKey()) return null;

  try {
    // Primary: direct match endpoint.
    var match = footballApiGet('/matches/' + encodeURIComponent(String(matchId)));
    var fromDirect = parseFootballDataMatchOdds(match);
    if (fromDirect) return fromDirect;

    // Odds API add-on can expose odds only in list endpoints.
    var matchesByIds = footballApiGet('/matches?ids=' + encodeURIComponent(String(matchId)));
    var listByIds = (matchesByIds && matchesByIds.matches) || [];
    for (var i = 0; i < listByIds.length; i++) {
      var fromIds = parseFootballDataMatchOdds(listByIds[i]);
      if (fromIds) return fromIds;
    }

    // Fallback by competition+date window around kickoff day.
    var day = toFootballDate(utcDateIso || (match && match.utcDate));
    if (day) {
      var byCompDate = footballApiGet(
        '/competitions/WC/matches?season=2026&dateFrom=' +
          encodeURIComponent(day) +
          '&dateTo=' +
          encodeURIComponent(day)
      );
      var listByDate = (byCompDate && byCompDate.matches) || [];
      for (var j = 0; j < listByDate.length; j++) {
        if (String(listByDate[j].id) !== String(matchId)) continue;
        var fromDate = parseFootballDataMatchOdds(listByDate[j]);
        if (fromDate) return fromDate;
      }
    }

    return null;
  } catch (err) {
    return null;
  }
}

function formatProbabilityNote(probs) {
  if (!probs) return '';

  if (probs.odds) {
    return (
      'Kèo châu Âu: ' +
      probs.odds.home +
      ' / ' +
      probs.odds.draw +
      ' / ' +
      probs.odds.away +
      ' → Nhà ' +
      probs.home +
      '% · Hòa ' +
      probs.draw +
      '% · Khách ' +
      probs.away +
      '%'
    );
  }

  return (
    'Xác suất ' +
    probs.source +
    ': Nhà ' +
    probs.home +
    '% · Hòa ' +
    probs.draw +
    '% · Khách ' +
    probs.away +
    '%'
  );
}

function parseFotmobVotesFromPoll(poll) {
  if (!poll || !poll.voteResult || !poll.voteResult.Votes) return null;

  var votes = poll.voteResult.Votes;
  var total = 0;
  var map = { home: 0, draw: 0, away: 0 };

  votes.forEach(function (v) {
    var count = 0;
    if (v.Votes && v.Votes.length) count = Number(v.Votes[0]) || 0;
    else if (v.votes && v.votes.length) count = Number(v.votes[0]) || 0;
    total += count;

    var name = String(v.Name || v.name || '').toLowerCase();
    if (name === '1' || name === 'home' || name.indexOf('home') !== -1) map.home = count;
    else if (name === 'x' || name === 'draw' || name.indexOf('draw') !== -1) map.draw = count;
    else if (name === '2' || name === 'away' || name.indexOf('away') !== -1) map.away = count;
  });

  if (total <= 0) return null;

  return {
    home: Math.round((map.home / total) * 100),
    draw: Math.round((map.draw / total) * 100),
    away: Math.round((map.away / total) * 100),
    source: 'fotmob-votes',
  };
}

function parseFotmobProbabilitiesFromPoll(poll) {
  if (!poll) return null;

  var fromOdds = parseFotmobEuropeanOddsFromPoll(poll);
  if (fromOdds) return fromOdds;

  return parseFotmobVotesFromPoll(poll);
}

function findProbabilityInObject(node, depth) {
  if (!node || depth > 12) return null;

  if (Array.isArray(node)) {
    for (var i = 0; i < node.length; i++) {
      var foundInArray = findProbabilityInObject(node[i], depth + 1);
      if (foundInArray) return foundInArray;
    }
    return null;
  }

  if (typeof node !== 'object') return null;

  if (
    node.home !== undefined &&
    node.draw !== undefined &&
    node.away !== undefined &&
    !node.matches
  ) {
    var direct = parseProbabilityTriple(node.home, node.draw, node.away, 'fotmob');
    if (direct) return direct;
  }

  if (node.winProbability) {
    var nested = findProbabilityInObject(node.winProbability, depth + 1);
    if (nested) return nested;
  }

  var keys = Object.keys(node);
  for (var k = 0; k < keys.length; k++) {
    var found = findProbabilityInObject(node[keys[k]], depth + 1);
    if (found) return found;
  }

  return null;
}

function parseFotmobProbabilities(details) {
  var facts = details.content && details.content.matchFacts;
  var poll = facts && facts.poll;

  var fromOdds = parseFotmobEuropeanOddsFromPoll(poll);
  if (fromOdds) return fromOdds;

  fromOdds = findEuropeanOddsInObject(details, 0);
  if (fromOdds) return fromOdds;

  var fromProb = findProbabilityInObject(details, 0);
  if (fromProb) return fromProb;

  return parseFotmobVotesFromPoll(poll);
}

function parseFotmobFormMatchItem(item) {
  if (!item) return null;

  var date = '';
  if (item.date && item.date.utcTime) date = String(item.date.utcTime);
  else if (item.UTCTime) date = String(item.UTCTime);

  var homeName = (item.home && item.home.name) || '';
  var awayName = (item.away && item.away.name) || '';
  var score = item.score || '';
  var result = item.resultString || '';
  var venue = 'neutral';

  if (item.home && item.home.isOurTeam) venue = 'home';
  else if (item.away && item.away.isOurTeam) venue = 'away';

  return {
    date: date,
    matchLabel: homeName + ' vs ' + awayName,
    score: score,
    result: result,
    venue: venue,
  };
}

function aggregateVenueRecord(matches) {
  var stats = { home: { w: 0, d: 0, l: 0 }, away: { w: 0, d: 0, l: 0 } };
  (matches || []).forEach(function (m) {
    if (!m || !m.result) return;
    var bucket = m.venue === 'home' ? stats.home : m.venue === 'away' ? stats.away : null;
    if (!bucket) return;
    if (m.result === 'W') bucket.w++;
    else if (m.result === 'D') bucket.d++;
    else if (m.result === 'L') bucket.l++;
  });
  return stats;
}

function parseFotmobForm(details) {
  var teamForm =
    details.content && details.content.matchFacts && details.content.matchFacts.teamForm;
  if (!teamForm || !teamForm.length) return null;

  var homeMatches = (teamForm[0] || [])
    .map(parseFotmobFormMatchItem)
    .filter(function (m) {
      return !!m;
    });
  var awayMatches = (teamForm[1] || [])
    .map(parseFotmobFormMatchItem)
    .filter(function (m) {
      return !!m;
    });

  return {
    home: homeMatches.map(function (m) {
      return m.result;
    }),
    away: awayMatches.map(function (m) {
      return m.result;
    }),
    recentMatches: {
      home: homeMatches,
      away: awayMatches,
    },
    venueForm: {
      home: aggregateVenueRecord(homeMatches),
      away: aggregateVenueRecord(awayMatches),
    },
  };
}

function parseFotmobFifaRanking(details) {
  var teams = details.header && details.header.teams;
  if (!teams || teams.length < 2) return null;

  function toRank(value) {
    if (value === null || value === undefined || value === '') return null;
    var num = parseInt(String(value), 10);
    return isNaN(num) ? null : num;
  }

  return {
    home: toRank(teams[0].fifaRank),
    away: toRank(teams[1].fifaRank),
  };
}

function parseFotmobUnavailablePlayers(lineupSide) {
  var players = [];
  if (!lineupSide) return players;

  var lists = [lineupSide.unavailable, lineupSide.missingPlayers, lineupSide.injuries];
  lists.forEach(function (list) {
    (list || []).forEach(function (p) {
      var name = getPlayerDisplayName(p);
      var reason = p.reason || p.status || p.type || 'Vắng mặt';
      if (name) players.push(name + ' (' + reason + ')');
    });
  });

  return players;
}

function parseFotmobInjuries(details) {
  var lineup = details.content && details.content.lineup;
  var result = { home: [], away: [] };
  if (!lineup) return result;

  if (lineup.homeTeam) {
    result.home = parseFotmobUnavailablePlayers(lineup.homeTeam);
  }
  if (lineup.awayTeam) {
    result.away = parseFotmobUnavailablePlayers(lineup.awayTeam);
  }

  if (lineup.naPlayers) {
    (lineup.naPlayers.home || []).forEach(function (p) {
      var name = getPlayerDisplayName(p);
      if (name) result.home.push(name + ' (không có sẵn)');
    });
    (lineup.naPlayers.away || []).forEach(function (p) {
      var name = getPlayerDisplayName(p);
      if (name) result.away.push(name + ' (không có sẵn)');
    });
  }

  return result;
}

function parseGoalsAverageFromTeamData(teamData) {
  if (!teamData) return null;

  var stats =
    teamData.stats ||
    teamData.overview ||
    teamData.detail ||
    (teamData.team && teamData.team.stats) ||
    null;
  if (!stats) return null;

  var scored = stats.goalsScored || stats.goals || stats.goalsFor;
  var conceded = stats.goalsConceded || stats.goalsAgainst;
  var played = stats.matchesPlayed || stats.played || stats.matches;

  if (scored === undefined || conceded === undefined || !played) return null;
  played = Number(played);
  if (!played) return null;

  return {
    scored: (Number(scored) / played).toFixed(1),
    conceded: (Number(conceded) / played).toFixed(1),
  };
}

function tryFotmobTeamData(teamId) {
  if (!teamId) return null;
  return fotmobFetchData('/teams', { id: teamId }) || fotmobFetchLegacy('/teams', { id: teamId });
}

function parseFotmobGoalsStats(details) {
  var result = { home: null, away: null };
  var general = details.general || {};
  var homeId = general.homeTeam && general.homeTeam.id;
  var awayId = general.awayTeam && general.awayTeam.id;

  if (homeId) {
    result.home = parseGoalsAverageFromTeamData(tryFotmobTeamData(homeId));
  }
  if (awayId) {
    result.away = parseGoalsAverageFromTeamData(tryFotmobTeamData(awayId));
  }

  return result;
}

function parseFotmobMarketValue(details) {
  var result = { home: null, away: null };
  var general = details.general || {};
  var homeId = general.homeTeam && general.homeTeam.id;
  var awayId = general.awayTeam && general.awayTeam.id;

  function extractValue(teamData) {
    if (!teamData) return null;
    if (teamData.marketValue) return String(teamData.marketValue);
    if (teamData.team && teamData.team.marketValue) return String(teamData.team.marketValue);
    if (teamData.details && teamData.details.marketValue) return String(teamData.details.marketValue);
    return null;
  }

  result.home = extractValue(tryFotmobTeamData(homeId));
  result.away = extractValue(tryFotmobTeamData(awayId));
  return result;
}

function parseFotmobExpertText(details) {
  var parts = [];
  var facts = details.content && details.content.matchFacts;
  if (!facts) return '';

  (facts.insights || []).forEach(function (ins) {
    var text = formatFotmobInsightText(ins);
    if (text && text.indexOf('{') === -1) parts.push(text);
  });

  (facts.QAData || []).forEach(function (qa) {
    if (qa.answer) parts.push(String(qa.answer));
  });

  return parts.join('\n\n');
}

function derivePickFromProbabilities(probs) {
  if (!probs) return '';
  if (probs.home >= probs.draw && probs.home >= probs.away) return 'HOME';
  if (probs.away >= probs.draw && probs.away >= probs.home) return 'AWAY';
  return 'DRAW';
}

function buildFotmobMatchInfo(
  details,
  fotmobMatchId,
  footballMatchId,
  pageUrl,
  homeName,
  awayName,
  utcDateIso
) {
  var winProbability = resolveWinProbabilityWithOdds(
    details,
    fotmobMatchId,
    footballMatchId,
    pageUrl,
    homeName,
    awayName,
    utcDateIso
  );
  var form = parseFotmobForm(details);
  var lineup = parseFotmobLineup(details);
  var fifaRanking = parseFotmobFifaRanking(details);
  var pickSuggestion = derivePickFromProbabilities(winProbability);
  var pickNote = '';

  if (winProbability) {
    pickNote = formatProbabilityNote(winProbability);
  }

  return {
    fotmobMatchId: String(fotmobMatchId),
    lineup: lineup,
    formations: {
      home: lineup && lineup.home ? lineup.home.formation : '',
      away: lineup && lineup.away ? lineup.away.formation : '',
    },
    form: form,
    recentMatches: form ? form.recentMatches : { home: [], away: [] },
    venueForm: form ? form.venueForm : null,
    h2h: parseFotmobH2H(details),
    winProbability: winProbability,
    probabilities: winProbability,
    fifaRanking: fifaRanking,
    injuries: parseFotmobInjuries(details),
    marketValue: parseFotmobMarketValue(details),
    goalsStats: parseFotmobGoalsStats(details),
    expertAssessment: parseFotmobExpertText(details),
    pickSuggestion: pickSuggestion,
    pickNote: pickNote,
  };
}

function handleGetFotMobMatchInfo(payload) {
  var auth = verifyUser(payload.username, String(payload.passwordHash || ''));
  if (!auth.valid) {
    return { success: false, message: auth.message };
  }

  var matchId = String(payload.matchId || '');
  var homeName = String(payload.homeTeamName || '');
  var awayName = String(payload.awayTeamName || '');
  var homeShortName = String(payload.homeTeamShortName || '');
  var awayShortName = String(payload.awayTeamShortName || '');
  var utcDate = String(payload.utcDate || '');

  if (!homeName || !awayName || !utcDate) {
    return { success: false, message: 'Thiếu thông tin trận đấu' };
  }

  try {
    var overrideId = payload.fotmobMatchId || getFotmobMatchIdFromSheet(matchId);
    var ref = resolveFotmobMatchRef(
      homeName,
      awayName,
      utcDate,
      overrideId,
      homeShortName,
      awayShortName
    );
    if (!ref || !ref.id) {
      return { success: false, message: 'Không tìm thấy trận trên FotMob' };
    }

    var details = fetchFotmobMatchDetails(ref.id, ref.pageUrl);
    var fotmob = buildFotmobMatchInfo(
      details,
      ref.id,
      matchId,
      ref.pageUrl,
      homeName,
      awayName,
      utcDate
    );

    return {
      success: true,
      fotmob: fotmob,
    };
  } catch (err) {
    return { success: false, message: err.message || 'Không thể tải dữ liệu FotMob' };
  }
}
