const SPREADSHEET_ID = 'YOUR_SPREADSHEET_ID_HERE';
const USERS_SHEET = 'Users';
const PREDICTIONS_SHEET = 'Predictions';

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

function fetchMatchFromApi(matchId) {
  var apiKey = getFootballApiKey();
  if (!apiKey) {
    throw new Error('Chưa cấu hình FOOTBALL_API_KEY trong Script Properties');
  }

  var url = 'https://api.football-data.org/v4/matches/' + encodeURIComponent(matchId);
  var response = UrlFetchApp.fetch(url, {
    method: 'get',
    headers: { 'X-Auth-Token': apiKey },
    muteHttpExceptions: true,
  });

  var code = response.getResponseCode();
  if (code !== 200) {
    throw new Error('Không thể lấy thông tin trận đấu (HTTP ' + code + ')');
  }

  return JSON.parse(response.getContentText());
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
