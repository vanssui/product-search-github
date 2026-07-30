function updateTaskApi_(payload) {
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
    var currentEmployeeId = stringify_(
      getCell_(context.row, context.columns.employeeId)
    );
    return {
      updated: false,
      alreadyClosed: true,
      status: currentStatus,
      statusSearch: currentStatus || 'Закрыто',
      wbSticker: getCell_(context.row, context.columns.wbSticker),
      message: buildAlreadyClosedMessage_(currentStatus, currentEmployeeId),
      taskToken: taskToken
    };
  }

  context.sheet
    .getRange(context.rowNumber, context.columns.statusSearch + 1)
    .setValue(result);
  context.sheet
    .getRange(context.rowNumber, context.columns.employeeId + 1)
    .setValue(identity.employeeId);
  SpreadsheetApp.flush();
  clearSnapshotCache_();
  return {
    updated: true,
    alreadyClosed: false,
    status: result,
    statusSearch: result,
    wbSticker: getCell_(context.row, context.columns.wbSticker),
    message: 'Статус обновлён: ' + result + '.',
    employeeId: identity.employeeId,
    taskToken: taskToken
  };
}

function buildAlreadyClosedMessage_(status, employeeId) {
  var normalizedStatus = stringify_(status) || 'закрыто';
  var suffix = employeeId ? ' ID: ' + employeeId + '.' : '.';
  return 'Задание уже закрыто: ' + normalizedStatus + suffix;
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
