async function loadMyGroups(session, forceReload) {
  if (!forceReload && Array.isArray(session.groups)) {
    return session.groups;
  }

  const data = await getMyGroups(session.username, session.passwordHash);
  const groups = data.groups || [];
  session.groups = groups;
  saveSession(session);
  return groups;
}

function clearCurrentGroup(session) {
  session.currentGroupId = null;
  saveSession(session);
}

async function initGroupContext(session, options) {
  if (!session) return null;

  const forceReload = options && options.forceReload;
  const groups = await loadMyGroups(session, forceReload);

  if (groups.length === 0) {
    clearCurrentGroup(session);
    window.location.href = getPagePath('no-group.html');
    return null;
  }

  const validIds = groups.map(function (g) {
    return g.groupId;
  });

  if (session.currentGroupId && validIds.indexOf(session.currentGroupId) !== -1) {
    saveSession(session);
    return session;
  }

  session.currentGroupId = groups[0].groupId;
  saveSession(session);
  return session;
}

function getCurrentGroupName(session) {
  const groups = session.groups || [];
  const current = groups.find(function (g) {
    return g.groupId === session.currentGroupId;
  });
  return current ? current.name : session.currentGroupId || '';
}

function getCurrentGroupStartDate() {
  const session = getSession();
  if (!session || !session.groups) return '';
  const current = session.groups.find(function (g) {
    return g.groupId === session.currentGroupId;
  });
  return current && current.startDate ? current.startDate : '';
}

function formatGroupStartDate(startDate) {
  if (!startDate) return '';
  try {
    return new Date(startDate + 'T00:00:00').toLocaleDateString('vi-VN');
  } catch {
    return startDate;
  }
}

function renderGroupSwitcher() {
  const session = getSession();
  if (!session || !session.groups || session.groups.length === 0) return;

  const headerInner = document.querySelector('.wc-header-inner');
  if (!headerInner) return;

  let switcher = document.getElementById('group-switcher');
  if (!switcher) {
    switcher = document.createElement('div');
    switcher.id = 'group-switcher';
    switcher.className = 'group-switcher';
    const userBadge = document.getElementById('user-info');
    if (userBadge) {
      headerInner.insertBefore(switcher, userBadge);
    } else {
      headerInner.appendChild(switcher);
    }
  }

  if (session.groups.length === 1) {
    const startLabel = getCurrentGroupStartDate()
      ? ' · từ ' + formatGroupStartDate(getCurrentGroupStartDate())
      : '';
    switcher.innerHTML =
      '<span class="group-switcher-label">Nhóm:</span>' +
      '<span class="group-switcher-current">' +
      escapeHtml(getCurrentGroupName(session) + startLabel) +
      '</span>';
    return;
  }

  let html =
    '<label class="group-switcher-label" for="group-select">Nhóm:</label>' +
    '<select id="group-select" class="group-switcher-select">';

  session.groups.forEach(function (group) {
    const selected = group.groupId === session.currentGroupId ? ' selected' : '';
    html +=
      '<option value="' + escapeHtml(group.groupId) + '"' + selected + '>' +
      escapeHtml(group.name) +
      '</option>';
  });

  html += '</select>';
  switcher.innerHTML = html;

  const select = document.getElementById('group-select');
  if (select) {
    select.addEventListener('change', function () {
      const nextGroupId = select.value;
      if (nextGroupId && nextGroupId !== session.currentGroupId) {
        setCurrentGroupId(nextGroupId);
        window.location.reload();
      }
    });
  }
}
