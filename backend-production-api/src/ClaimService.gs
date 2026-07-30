function claimPropertyKey_(taskToken) {
  return 'CLAIM_' + sha256WebSafe_(taskToken).slice(0, 44);
}

function requireIdentity_(payload) {
  return {
    employeeId: normalizeEmployeeId_(payload.employeeId),
    sessionId: requireText_(payload.sessionId, 'sessionId', 120)
  };
}

function readActiveClaim_(taskToken) {
  var properties = PropertiesService.getScriptProperties();
  var key = claimPropertyKey_(taskToken);
  var claim = safeJsonParse_(properties.getProperty(key), null);
  if (!claim) return null;
  if (!claim.expiresAt || claim.expiresAt <= Date.now()) {
    properties.deleteProperty(key);
    return null;
  }
  return claim;
}

function isClaimOwner_(claim, identity) {
  return Boolean(
    claim &&
    claim.employeeId === identity.employeeId &&
    claim.sessionId === identity.sessionId
  );
}

function takeTaskApi_(payload) {
  var taskToken = requireText_(payload.taskToken, 'taskToken', 120);
  var context = getWritableTaskContextByToken_(taskToken, {});
  var currentStatus = stringify_(
    getCell_(context.row, context.columns.statusSearch)
  );
  if (!isActiveStatus_(currentStatus)) {
    throw apiError_(
      'TASK_CLOSED',
      'Задание уже завершено и не может быть взято в работу.'
    );
  }
  var identity = requireIdentity_(payload);
  var claim = readActiveClaim_(taskToken);
  if (claim && !isClaimOwner_(claim, identity)) {
    throw apiError_('TASK_LOCKED', 'Задание уже взято другим сотрудником.');
  }
  var nextClaim = {
    employeeId: identity.employeeId,
    sessionId: identity.sessionId,
    createdAt: claim && claim.createdAt ? claim.createdAt : Date.now(),
    expiresAt: Date.now() + APP_CONFIG.claimTtlMs
  };
  PropertiesService.getScriptProperties().setProperty(
    claimPropertyKey_(taskToken),
    JSON.stringify(nextClaim)
  );
  return {
    owned: true,
    employeeId: nextClaim.employeeId,
    expiresAt: new Date(nextClaim.expiresAt).toISOString()
  };
}

function releaseTaskApi_(payload) {
  var taskToken = requireText_(payload.taskToken, 'taskToken', 120);
  var identity = requireIdentity_(payload);
  var claim = readActiveClaim_(taskToken);
  if (!claim) return { released: true, alreadyReleased: true };
  if (!isClaimOwner_(claim, identity)) {
    throw apiError_('NOT_TASK_OWNER', 'Освободить задание может только владелец.');
  }
  PropertiesService.getScriptProperties().deleteProperty(
    claimPropertyKey_(taskToken)
  );
  return { released: true, alreadyReleased: false };
}

function ensureClaimAllowsWrite_(taskToken, identity, required) {
  var claim = readActiveClaim_(taskToken);
  if (!claim) {
    if (required) {
      throw apiError_('TASK_NOT_CLAIMED', 'Сначала возьмите задание.');
    }
    return;
  }
  if (!isClaimOwner_(claim, identity)) {
    throw apiError_('TASK_LOCKED', 'Задание взято другим сотрудником.');
  }
}

function clearClaim_(taskToken) {
  PropertiesService.getScriptProperties().deleteProperty(
    claimPropertyKey_(taskToken)
  );
}
