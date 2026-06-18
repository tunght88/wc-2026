function renderReminderBanner(matches, userPredMap) {
  const banner = document.getElementById('reminder-banner');
  if (!banner) return;

  const missing = getTodayUnpredicted(matches, userPredMap);
  if (!missing.length) {
    banner.classList.add('hidden');
    banner.innerHTML = '';
    return;
  }

  const count = missing.length;
  const label = count === 1 ? 'trận' : 'trận';

  banner.innerHTML =
    '<div class="reminder-banner-inner">' +
      '<span class="reminder-banner-text">' +
        'Còn <strong>' + count + '</strong> ' + label + ' chưa dự đoán hôm nay' +
      '</span>' +
      '<a href="predictions.html?pred=not-predicted" class="reminder-banner-action">Dự đoán ngay</a>' +
    '</div>';
  banner.classList.remove('hidden');
}

async function initReminderBanner(session, options) {
  if (!session) return;

  const opts = options || {};
  try {
    let matches = opts.matches;
    let userPredMap = opts.userPredMap;

    if (!matches || !userPredMap) {
      const [loadedMatches, predResult] = await Promise.all([
        getMatches(),
        getPredictions(session.username, session.passwordHash),
      ]);
      matches = loadedMatches;
      userPredMap = buildUserPredictionMap(predResult.predictions || [], session.username);
    }

    renderReminderBanner(matches, userPredMap);
  } catch {
    const banner = document.getElementById('reminder-banner');
    if (banner) {
      banner.classList.add('hidden');
    }
  }
}
