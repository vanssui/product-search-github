var READ_ACTIONS_ = {
  health: function(payload) { return getHealth_(); },
  getCatalog: function(payload) { return getCatalogApi_(payload); },
  getTask: function(payload) { return getTaskApi_(payload); },
  getTaskPhoto: function(payload) { return getTaskPhotoApi_(payload); }
};

function doGet(e) {
  var parameters = e && e.parameter ? e.parameter : {};
  var action = stringify_(parameters.action) || 'health';
  return handleApiRequest_(action, parameters);
}

function doPost(e) {
  return jsonOutput_({
    ok: false,
    data: null,
    error: {
      code: 'READ_ONLY',
      message: 'Production backend пока работает только на чтение.'
    },
    requestId: Utilities.getUuid(),
    timestamp: nowIso_(),
    meta: { readOnly: true, serverDurationMs: 0 }
  });
}

function handleApiRequest_(action, payload) {
  var startedAt = Date.now();
  var requestId = clampText_(payload && payload.requestId, 100) || Utilities.getUuid();
  try {
    var handler = READ_ACTIONS_[action];
    if (!handler) {
      throw apiError_('ACTION_NOT_ALLOWED', 'Действие не разрешено в режиме чтения.');
    }
    var data = handler(payload || {});
    return jsonOutput_({
      ok: true,
      data: data,
      error: null,
      requestId: requestId,
      timestamp: nowIso_(),
      meta: {
        readOnly: true,
        serverDurationMs: Date.now() - startedAt
      }
    });
  } catch (error) {
    var code = error && error.apiCode ? error.apiCode : 'INTERNAL_ERROR';
    var message = error && error.apiCode
      ? error.message
      : 'Внутренняя ошибка сервера. Повторите попытку позднее.';
    console.error(JSON.stringify({
      requestId: requestId,
      action: clampText_(action, 80),
      code: code,
      message: error && error.message ? error.message : String(error || '')
    }));
    return jsonOutput_({
      ok: false,
      data: null,
      error: { code: code, message: message },
      requestId: requestId,
      timestamp: nowIso_(),
      meta: {
        readOnly: true,
        serverDurationMs: Date.now() - startedAt
      }
    });
  }
}

function jsonOutput_(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

function getHealth_() {
  hydrateRuntimeConfig_();
  return {
    project: APP_CONFIG.projectName,
    environment: APP_CONFIG.environment,
    mode: 'read-only',
    sourceCount: APP_CONFIG.sourceSheets.length,
    status: 'ok',
    time: nowIso_()
  };
}
