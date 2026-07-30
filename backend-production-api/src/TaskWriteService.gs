function markFoundApi_(payload) {
  var next = copyObject_(payload);
  next.result = APP_CONFIG.foundStatus;
  return completeTaskApi_(next);
}

function markNotFoundApi_(payload) {
  var next = copyObject_(payload);
  next.result = APP_CONFIG.notFoundStatus;
  return completeTaskApi_(next);
}

function completeTaskApi_(payload) {
  var taskToken = requireText_(payload.taskToken, 'taskToken', 120);
  var identity = requireIdentity_(payload);
  var result = normalizeCompletionResult_(
    payload.result || payload.newStatus
  );
  var context = getWritableTaskContextByToken_(taskToken, {});
  var currentStatus = stringify_(
    getCell_(context.row, context.columns.statusSearch)
  );

  if (!isActiveStatus_(currentStatus)) {
    return {
      updated: false,
      alreadyClosed: true,
      status: currentStatus,
      taskToken: taskToken
    };
  }

  ensureClaimAllowsWrite_(
    taskToken,
    identity,
    APP_CONFIG.requireClaimForCompletion
  );
  context.sheet
    .getRange(context.rowNumber, context.columns.statusSearch + 1)
    .setValue(result);
  context.sheet
    .getRange(context.rowNumber, context.columns.employeeId + 1)
    .setValue(identity.employeeId);
  SpreadsheetApp.flush();
  clearSnapshotCache_();
  clearClaim_(taskToken);
  return {
    updated: true,
    alreadyClosed: false,
    status: result,
    employeeId: identity.employeeId,
    taskToken: taskToken
  };
}

function updateEmployeeApi_(payload) {
  var identity = requireIdentity_(payload);
  return {
    employeeId: identity.employeeId,
    sessionId: identity.sessionId,
    persistedByBackend: false
  };
}

function normalizeCompletionResult_(value) {
  var result = stringify_(value);
  if (result !== APP_CONFIG.foundStatus &&
      result !== APP_CONFIG.notFoundStatus) {
    throw apiError_(
      'INVALID_STATUS',
      'Допустимы только результаты "Найдено" и "Не найдено".'
    );
  }
  return result;
}

function copyObject_(value) {
  var result = {};
  Object.keys(value || {}).forEach(function(key) {
    result[key] = value[key];
  });
  return result;
}
