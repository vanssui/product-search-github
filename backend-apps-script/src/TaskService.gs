function claimPropertyKey_(taskToken) {
  return 'CLAIM_' + hashWebSafe_(taskToken).slice(0, 44);
}

function getClaim_(taskToken) {
  var properties = PropertiesService.getScriptProperties();
  var key = claimPropertyKey_(taskToken);
  var claim = safeJsonParse_(properties.getProperty(key), null);
  if (!claim) return null;
  if (!claim.expiresAt || new Date(claim.expiresAt).getTime() <= Date.now()) {
    properties.deleteProperty(key);
    return null;
  }
  return claim;
}

function requireIdentity_(payload) {
  return {
    employeeId: requireText_(payload.employeeId, 'employeeId', 64).toUpperCase(),
    sessionId: requireText_(payload.sessionId, 'sessionId', 120)
  };
}

function takeTaskApi_(payload) {
  var identity = requireIdentity_(payload);
  var lock = LockService.getScriptLock();
  lock.waitLock(APP_CONFIG.lockTimeoutMs);
  try {
    var context = getRowContext_(payload, true);
    if (!isActiveStatus_(getCell_(context.row, context.columns.statusSearch))) {
      throw apiError_('TASK_CLOSED', 'Задание уже закрыто.');
    }
    var existing = getClaim_(context.taskToken);
    if (existing &&
        (existing.employeeId !== identity.employeeId || existing.sessionId !== identity.sessionId)) {
      throw apiError_('TASK_LOCKED', 'Задание уже взято другим сотрудником до ' + existing.expiresAt + '.');
    }

    var claim = {
      taskToken: context.taskToken,
      sheetName: context.sheetName,
      rowNumber: context.rowNumber,
      employeeId: identity.employeeId,
      sessionId: identity.sessionId,
      claimedAt: existing ? existing.claimedAt : nowIso_(),
      expiresAt: new Date(Date.now() + APP_CONFIG.claimTtlMs).toISOString()
    };
    PropertiesService.getScriptProperties()
      .setProperty(claimPropertyKey_(context.taskToken), JSON.stringify(claim));
    return claim;
  } finally {
    lock.releaseLock();
  }
}

function releaseTaskApi_(payload) {
  var identity = requireIdentity_(payload);
  var lock = LockService.getScriptLock();
  lock.waitLock(APP_CONFIG.lockTimeoutMs);
  try {
    var context = getRowContext_(payload, false);
    var claim = getClaim_(context.taskToken);
    if (!claim) return { released: true, alreadyReleased: true };
    if (claim.employeeId !== identity.employeeId || claim.sessionId !== identity.sessionId) {
      throw apiError_('NOT_TASK_OWNER', 'Нельзя освободить чужое задание.');
    }
    PropertiesService.getScriptProperties().deleteProperty(claimPropertyKey_(context.taskToken));
    return { released: true, alreadyReleased: false };
  } finally {
    lock.releaseLock();
  }
}

function ensureOwnership_(context, payload) {
  var identity = requireIdentity_(payload);
  var claim = getClaim_(context.taskToken);
  if (!claim) throw apiError_('CLAIM_REQUIRED', 'Сначала возьмите задание.');
  if (claim.employeeId !== identity.employeeId || claim.sessionId !== identity.sessionId) {
    throw apiError_('NOT_TASK_OWNER', 'Задание принадлежит другому сотруднику.');
  }
  return { identity: identity, claim: claim };
}

function normalizeCompletionStatus_(value) {
  var status = stringify_(value);
  if (status === APP_CONFIG.foundStatus || status === APP_CONFIG.notFoundStatus) return status;
  throw apiError_('INVALID_STATUS', 'Разрешено только "Найдено" или "Не найдено".');
}

function completeTaskApi_(payload) {
  var requestedStatus = normalizeCompletionStatus_(payload.newStatus);
  var lock = LockService.getScriptLock();
  lock.waitLock(APP_CONFIG.lockTimeoutMs);
  try {
    var context = getRowContext_(payload, true);
    var oldStatus = stringify_(getCell_(context.row, context.columns.statusSearch));
    var oldEmployeeId = stringify_(getCell_(context.row, context.columns.employeeId));
    if (!isActiveStatus_(oldStatus)) {
      return {
        alreadyClosed: true,
        statusSearch: oldStatus || 'Закрыто',
        employeeId: oldEmployeeId,
        message: 'Задание уже закрыто: ' + (oldStatus || 'закрыто') + '.'
      };
    }

    var ownership = ensureOwnership_(context, payload);
    context.sheet.getRange(context.rowNumber, context.columns.statusSearch + 1).setValue(requestedStatus);
    context.sheet.getRange(context.rowNumber, context.columns.employeeId + 1).setValue(ownership.identity.employeeId);
    SpreadsheetApp.flush();
    clearTaskCache_();
    PropertiesService.getScriptProperties().deleteProperty(claimPropertyKey_(context.taskToken));
    return {
      alreadyClosed: false,
      statusSearch: requestedStatus,
      employeeId: ownership.identity.employeeId,
      message: 'Статус обновлён: ' + requestedStatus + '.'
    };
  } finally {
    lock.releaseLock();
  }
}

