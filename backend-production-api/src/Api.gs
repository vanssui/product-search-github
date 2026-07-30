var API_VERSION_ = 'v1';

var READ_ACTIONS_ = {
  health: function(payload) { return getHealth_(); },
  getCapabilities: function(payload) { return getCapabilitiesApi_(); },
  getCatalog: function(payload) { return getCatalogApi_(payload); },
  getTask: function(payload) { return getTaskApi_(payload); },
  getStatistics: function(payload) { return getStatisticsApi_(payload); },
  getTaskPhotos: function(payload) { return getTaskPhotosApi_(payload); },
  getTaskPhoto: function(payload) { return getTaskPhotoApi_(payload); },
  getOperationStatus: function(payload) { return getOperationStatusApi_(payload); }
};

var WRITE_ACTIONS_ = {
  takeTask: function(payload) { return takeTaskApi_(payload); },
  releaseTask: function(payload) { return releaseTaskApi_(payload); },
  markFound: function(payload) { return markFoundApi_(payload); },
  markNotFound: function(payload) { return markNotFoundApi_(payload); },
  updateTask: function(payload) { return completeTaskApi_(payload); },
  completeTask: function(payload) { return completeTaskApi_(payload); },
  uploadTaskPhoto: function(payload) { return uploadTaskPhotoApi_(payload); },
  updateEmployee: function(payload) { return updateEmployeeApi_(payload); }
};

function doGet(e) {
  var parameters = e && e.parameter ? e.parameter : {};
  var action = stringify_(parameters.action) || 'health';
  return handleApiRequest_(action, parameters, false);
}

function doPost(e) {
  var payload = parsePostPayload_(e);
  return handleApiRequest_(stringify_(payload.action), payload, true);
}

function parsePostPayload_(e) {
  var contents = e && e.postData ? stringify_(e.postData.contents) : '';
  if (contents) {
    var parsed = safeJsonParse_(contents, null);
    if (parsed && typeof parsed === 'object') return parsed;
  }
  if (e && e.parameter) return e.parameter;
  return {};
}

function handleApiRequest_(action, payload, isWrite) {
  var startedAt = Date.now();
  var requestId = clampText_(payload && payload.requestId, 100) || Utilities.getUuid();

  try {
    assertApiVersion_(payload && payload.apiVersion);
    if (!action) throw apiError_('ACTION_REQUIRED', 'Не указано действие API.');

    var handler = isWrite ? WRITE_ACTIONS_[action] : READ_ACTIONS_[action];
    if (!handler) {
      throw apiError_('ACTION_NOT_ALLOWED', 'Действие API не разрешено.');
    }

    var data;
    if (isWrite) {
      assertWriteActionEnabled_(action);
      data = withIdempotency_(
        action,
        payload || {},
        requestId,
        function() { return handler(payload || {}); }
      );
    } else {
      data = handler(payload || {});
    }

    return jsonOutput_(buildEnvelope_(
      true,
      data,
      null,
      requestId,
      startedAt
    ));
  } catch (error) {
    var code = error && error.apiCode ? error.apiCode : 'INTERNAL_ERROR';
    var message = error && error.apiCode
      ? error.message
      : 'Внутренняя ошибка сервера. Повторите попытку позднее.';
    logApiError_(requestId, action, code, error);
    return jsonOutput_(buildEnvelope_(
      false,
      null,
      { code: code, message: message },
      requestId,
      startedAt
    ));
  }
}

function buildEnvelope_(ok, data, error, requestId, startedAt) {
  var readOnly = true;
  try {
    hydrateRuntimeConfig_();
    readOnly = APP_CONFIG.readOnly;
  } catch (ignored) {
    // Конфигурационная ошибка уже попадёт в основной error envelope.
  }
  return {
    ok: ok,
    data: data,
    error: error,
    requestId: requestId,
    timestamp: nowIso_(),
    meta: {
      apiVersion: API_VERSION_,
      readOnly: readOnly,
      serverDurationMs: Date.now() - startedAt
    }
  };
}

function assertApiVersion_(requestedVersion) {
  var version = stringify_(requestedVersion);
  if (version && version !== API_VERSION_) {
    throw apiError_(
      'API_VERSION_UNSUPPORTED',
      'Эта версия API не поддерживается.'
    );
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
    apiVersion: API_VERSION_,
    environment: APP_CONFIG.environment,
    mode: APP_CONFIG.readOnly ? 'read-only' : 'controlled-write',
    sourceCount: APP_CONFIG.sourceSheets.length,
    capabilities: getCapabilities_(),
    status: 'ok',
    time: nowIso_()
  };
}

function logApiError_(requestId, action, code, error) {
  console.error(JSON.stringify({
    requestId: requestId,
    action: clampText_(action, 80),
    code: code,
    message: error && error.message ? clampText_(error.message, 500) : ''
  }));
}
