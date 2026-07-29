var READ_ACTIONS_ = {
  health: function(payload) { return getHealth_(); },
  getTasks: function(payload) { return getTasksApi_(payload); },
  getTaskDetails: function(payload) { return getTaskDetailsApi_(payload); },
  getTaskPhoto: function(payload) { return getTaskPhotoApi_(payload); },
  getOperationStatus: function(payload) { return getOperationStatusApi_(payload); },
  getTestEnvironmentStatus: function(payload) { return getTestEnvironmentStatusApi_(); }
};

var WRITE_ACTIONS_ = {
  takeTask: function(payload) { return takeTaskApi_(payload); },
  releaseTask: function(payload) { return releaseTaskApi_(payload); },
  updateTask: function(payload) { return completeTaskApi_(payload); },
  completeTask: function(payload) { return completeTaskApi_(payload); },
  uploadTaskPhoto: function(payload) { return uploadTaskPhotoApi_(payload); }
};

function doGet(e) {
  var parameters = e && e.parameter ? e.parameter : {};
  var action = stringify_(parameters.action) || 'health';
  return handleApiRequest_(action, parameters, false);
}

function doPost(e) {
  var payload = parsePostPayload_(e);
  var action = stringify_(payload.action);
  return handleApiRequest_(action, payload, true);
}

function parsePostPayload_(e) {
  var contents = e && e.postData ? stringify_(e.postData.contents) : '';
  if (contents) {
    var parsed = safeJsonParse_(contents, null);
    if (parsed && typeof parsed === 'object') return parsed;
  }
  if (e && e.parameter) {
    if (e.parameter.payload) {
      var nested = safeJsonParse_(e.parameter.payload, null);
      if (nested && typeof nested === 'object') return nested;
    }
    return e.parameter;
  }
  return {};
}

function handleApiRequest_(action, payload, isWrite) {
  var startedAt = Date.now();
  var requestId = clampText_(payload && payload.requestId, 100) || Utilities.getUuid();
  var timestamp = nowIso_();

  try {
    if (!action) throw apiError_('ACTION_REQUIRED', 'Не указано действие API.');
    var handler = isWrite ? WRITE_ACTIONS_[action] : READ_ACTIONS_[action];
    if (!handler) {
      throw apiError_('ACTION_NOT_ALLOWED', 'Действие не разрешено: ' + clampText_(action, 80));
    }

    var data = isWrite
      ? withIdempotency_(action, payload, requestId, function() { return handler(payload); })
      : handler(payload);

    return jsonOutput_({
      ok: true,
      data: data,
      error: null,
      requestId: requestId,
      timestamp: timestamp,
      meta: { serverDurationMs: Date.now() - startedAt }
    });
  } catch (error) {
    var code = error && error.apiCode ? error.apiCode : 'INTERNAL_ERROR';
    var message = error && error.apiCode
      ? error.message
      : 'Внутренняя ошибка сервера. Повторите попытку позднее.';
    logApiError_(requestId, action, code, error);
    return jsonOutput_({
      ok: false,
      data: null,
      error: { code: code, message: message },
      requestId: requestId,
      timestamp: timestamp,
      meta: { serverDurationMs: Date.now() - startedAt }
    });
  }
}

function jsonOutput_(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

function getHealth_() {
  return {
    project: APP_CONFIG.projectName,
    environment: APP_CONFIG.environment,
    status: 'ok',
    time: nowIso_()
  };
}

function withIdempotency_(action, payload, requestId, operation) {
  var idempotencyKey = requireText_(payload.idempotencyKey, 'idempotencyKey', 240);
  var propertyKey = idempotencyPropertyKey_(action, idempotencyKey);
  var properties = PropertiesService.getScriptProperties();
  var existing = safeJsonParse_(properties.getProperty(propertyKey), null);
  var now = Date.now();

  if (existing && existing.createdAt && now - existing.createdAt <= APP_CONFIG.idempotencyTtlMs) {
    return existing.result;
  }

  var result = operation();
  properties.setProperty(propertyKey, JSON.stringify({
    createdAt: now,
    requestId: requestId,
    result: result
  }));
  cleanupIdempotencyProperties_(properties, now);
  return result;
}

function idempotencyPropertyKey_(action, idempotencyKey) {
  return 'IDEMP_' + hashWebSafe_(action + ':' + idempotencyKey).slice(0, 44);
}

function getOperationStatusApi_(payload) {
  var writeAction = requireText_(payload.writeAction, 'writeAction', 80);
  var idempotencyKey = requireText_(payload.idempotencyKey, 'idempotencyKey', 240);
  if (!WRITE_ACTIONS_[writeAction]) {
    throw apiError_('ACTION_NOT_ALLOWED', 'Нельзя проверить неизвестную операцию.');
  }

  var properties = PropertiesService.getScriptProperties();
  var propertyKey = idempotencyPropertyKey_(writeAction, idempotencyKey);
  var existing = safeJsonParse_(properties.getProperty(propertyKey), null);
  if (!existing || !existing.createdAt) {
    return { completed: false, state: 'pending_or_unknown' };
  }
  if (Date.now() - existing.createdAt > APP_CONFIG.idempotencyTtlMs) {
    properties.deleteProperty(propertyKey);
    return { completed: false, state: 'expired' };
  }
  return {
    completed: true,
    state: 'completed',
    result: existing.result,
    originalRequestId: existing.requestId || '',
    completedAt: new Date(existing.createdAt).toISOString()
  };
}

function cleanupIdempotencyProperties_(properties, now) {
  if (Math.random() > 0.05) return;
  var all = properties.getProperties();
  Object.keys(all).forEach(function(key) {
    if (key.indexOf('IDEMP_') !== 0) return;
    var record = safeJsonParse_(all[key], null);
    if (!record || !record.createdAt || now - record.createdAt > APP_CONFIG.idempotencyTtlMs) {
      properties.deleteProperty(key);
    }
  });
}

function logApiError_(requestId, action, code, error) {
  var message = error && error.message ? error.message : String(error || '');
  var stack = error && error.stack ? error.stack : '';
  console.error(JSON.stringify({
    requestId: requestId,
    action: action,
    code: code,
    message: message,
    stack: stack
  }));

  try {
    var sheet = getSpreadsheet_().getSheetByName(APP_CONFIG.logSheetName);
    if (sheet) {
      sheet.appendRow([
        new Date(),
        clampText_(requestId, 100),
        clampText_(action, 80),
        clampText_(code, 80),
        clampText_(message, 500)
      ]);
    }
  } catch (logError) {
    console.error('Could not append API error log: ' + logError.message);
  }
}
