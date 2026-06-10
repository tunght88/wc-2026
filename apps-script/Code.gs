const SPREADSHEET_ID = 'YOUR_SPREADSHEET_ID_HERE';
const USERS_SHEET = 'Users';
const PREDICTIONS_SHEET = 'Predictions';
const MATCH_INSIGHTS_SHEET = 'MatchInsights';

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

function getMatchInsightsSheet() {
  return getSpreadsheet().getSheetByName(MATCH_INSIGHTS_SHEET);
}

function getFootballApiKey() {
  return PropertiesService.getScriptProperties().getProperty('FOOTBALL_API_KEY') || '';
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
  var matchId = String(payload.matchId || '');
  var prediction = String(payload.prediction || '').toUpperCase();

  if (!username || !passwordHash || !matchId || !prediction) {
    return { success: false, message: 'Thiếu thông tin dự đoán' };
  }

  if (['HOME', 'DRAW', 'AWAY'].indexOf(prediction) === -1) {
    return { success: false, message: 'Dự đoán không hợp lệ' };
  }

  var auth = verifyUser(username, passwordHash);
  if (!auth.valid) {
    return { success: false, message: auth.message };
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

  var sheet = getPredictionsSheet();
  var data = sheet.getDataRange().getValues();
  var now = new Date().toISOString();
  var foundRow = -1;

  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]) === username && String(data[i][1]) === matchId) {
      foundRow = i + 1;
      break;
    }
  }

  if (foundRow > 0) {
    sheet.getRange(foundRow, 3).setValue(prediction);
    sheet.getRange(foundRow, 4).setValue(now);
  } else {
    sheet.appendRow([username, matchId, prediction, now]);
  }

  return { success: true, message: 'Đã lưu dự đoán' };
}

function handleGetPredictions(payload) {
  var username = sanitizeUsername(payload.username);
  var passwordHash = String(payload.passwordHash || '');

  var auth = verifyUser(username, passwordHash);
  if (!auth.valid) {
    return { success: false, message: auth.message };
  }

  var usersSheet = getUsersSheet();
  var usersData = usersSheet.getDataRange().getValues();
  var nameMap = {};
  for (var u = 1; u < usersData.length; u++) {
    nameMap[String(usersData[u][0])] = String(usersData[u][2]);
  }

  var activeUsers = [];
  for (var a = 1; a < usersData.length; a++) {
    if (!usersData[a][0]) continue;
    if (String(usersData[a][4]).toUpperCase() === 'TRUE') {
      activeUsers.push({
        username: String(usersData[a][0]),
        fullName: String(usersData[a][2]),
      });
    }
  }

  var sheet = getPredictionsSheet();
  var data = sheet.getDataRange().getValues();
  var predictions = [];

  for (var i = 1; i < data.length; i++) {
    if (!data[i][0]) continue;
    predictions.push({
      username: String(data[i][0]),
      matchId: String(data[i][1]),
      prediction: String(data[i][2]),
      updatedAt: String(data[i][3]),
      fullName: nameMap[String(data[i][0])] || String(data[i][0]),
    });
  }

  return { success: true, predictions: predictions, activeUsers: activeUsers };
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

function sanitizeUsername(value) {
  if (!value) return '';
  return String(value).trim().replace(/[^a-zA-Z0-9_]/g, '').substring(0, 50);
}

function sanitizeText(value, maxLen) {
  if (!value) return '';
  return String(value).trim().substring(0, maxLen || 100);
}

var FOTMOB_WC_LEAGUE_ID = 77;
var FOTMOB_SITE = 'https://www.fotmob.com';
var FOTMOB_API_DATA = FOTMOB_SITE + '/api/data';
var FOTMOB_API_LEGACY = FOTMOB_SITE + '/api';

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

function normalizeTeamKey(name) {
  return String(name || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

function teamsLikelyMatch(a, b) {
  var na = normalizeTeamKey(a);
  var nb = normalizeTeamKey(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  if (na.indexOf(nb) !== -1 || nb.indexOf(na) !== -1) return true;
  return false;
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

  var data = fotmobFetchData('/leagues', { id: FOTMOB_WC_LEAGUE_ID, tab: 'fixtures' });
  if (!data) {
    data = fotmobFetchLegacy('/leagues', { id: FOTMOB_WC_LEAGUE_ID, tab: 'fixtures' });
  }
  if (!data) return null;

  return findFotmobMatchInCollected(
    collectFotmobMatches(data),
    homeName,
    awayName,
    utcDateIso
  );
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

function resolveFotmobMatchRef(homeName, awayName, utcDateIso, overrideId) {
  if (overrideId) {
    return { id: String(overrideId), pageUrl: '' };
  }

  var found = findFotmobMatchFromWorldCupPage(homeName, awayName, utcDateIso);
  if (found) return found;

  return findFotmobMatchFromDayPage(homeName, awayName, utcDateIso);
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

function parseFotmobTeamLineup(teamLineup, playersOut) {
  if (!teamLineup) return null;

  var players = playersOut || [];
  var rows = teamLineup.players || [];
  for (var r = 0; r < rows.length; r++) {
    var row = rows[r] || [];
    for (var p = 0; p < row.length; p++) {
      players.push({
        name: getPlayerDisplayName(row[p]),
        shirt: String(row[p].shirt || row[p].shirtNumber || ''),
      });
    }
  }

  if (teamLineup.optaLineup && teamLineup.optaLineup.starting) {
    players = teamLineup.optaLineup.starting.map(function (pl) {
      return {
        name: getPlayerDisplayName(pl),
        shirt: String(pl.shirt || pl.shirtNumber || ''),
      };
    });
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
      players: (lineup.homeTeam.starters || []).map(function (p) {
        return { name: p.name || '', shirt: String(p.shirtNumber || '') };
      }),
    };
  }

  if (lineup.awayTeam) {
    result.away = {
      name: lineup.awayTeam.name || (general.awayTeam && general.awayTeam.name) || '',
      formation: lineup.awayTeam.formation || '',
      players: (lineup.awayTeam.starters || []).map(function (p) {
        return { name: p.name || '', shirt: String(p.shirtNumber || '') };
      }),
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

function parseFotmobForm(details) {
  var teamForm =
    details.content && details.content.matchFacts && details.content.matchFacts.teamForm;
  if (!teamForm || !teamForm.length) return null;

  function mapFormRow(row) {
    return (row || [])
      .map(function (item) {
        return item.resultString || '';
      })
      .filter(function (v) {
        return !!v;
      });
  }

  return {
    home: mapFormRow(teamForm[0]),
    away: mapFormRow(teamForm[1]),
  };
}

function parseFotmobProbabilities(details) {
  var poll = details.content && details.content.matchFacts && details.content.matchFacts.poll;
  if (!poll || !poll.voteResult || !poll.voteResult.Votes) return null;

  var votes = poll.voteResult.Votes;
  var total = 0;
  var map = { home: 0, draw: 0, away: 0 };

  votes.forEach(function (v) {
    var count = (v.Votes && v.Votes[0]) || 0;
    total += count;
    var name = String(v.Name || '').toLowerCase();
    if (name === '1' || name === 'home') map.home = count;
    else if (name === 'x' || name === 'draw') map.draw = count;
    else if (name === '2' || name === 'away') map.away = count;
  });

  if (total <= 0) return null;

  return {
    home: Math.round((map.home / total) * 100),
    draw: Math.round((map.draw / total) * 100),
    away: Math.round((map.away / total) * 100),
    source: 'fotmob',
  };
}

function parseFotmobExpertText(details) {
  var parts = [];
  var facts = details.content && details.content.matchFacts;
  if (!facts) return '';

  (facts.insights || []).forEach(function (ins) {
    var text = ins.defaultText || ins.text;
    if (text) parts.push(String(text));
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

function buildFotmobMatchInfo(details, fotmobMatchId) {
  var probabilities = parseFotmobProbabilities(details);
  var pickSuggestion = derivePickFromProbabilities(probabilities);
  var pickNote = '';

  if (probabilities) {
    pickNote =
      'Xác suất FotMob: Nhà ' +
      probabilities.home +
      '% · Hòa ' +
      probabilities.draw +
      '% · Khách ' +
      probabilities.away +
      '%';
  }

  return {
    fotmobMatchId: String(fotmobMatchId),
    lineup: parseFotmobLineup(details),
    h2h: parseFotmobH2H(details),
    form: parseFotmobForm(details),
    probabilities: probabilities,
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
  var utcDate = String(payload.utcDate || '');

  if (!homeName || !awayName || !utcDate) {
    return { success: false, message: 'Thiếu thông tin trận đấu' };
  }

  try {
    var overrideId = payload.fotmobMatchId || getFotmobMatchIdFromSheet(matchId);
    var ref = resolveFotmobMatchRef(homeName, awayName, utcDate, overrideId);
    if (!ref || !ref.id) {
      return { success: false, message: 'Không tìm thấy trận trên FotMob' };
    }

    var details = fetchFotmobMatchDetails(ref.id, ref.pageUrl);
    return {
      success: true,
      fotmob: buildFotmobMatchInfo(details, ref.id),
    };
  } catch (err) {
    return { success: false, message: err.message || 'Không thể tải dữ liệu FotMob' };
  }
}
