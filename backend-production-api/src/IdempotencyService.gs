function withIdempotency_(action, payload, requestId, operation) {
  var idempotencyKey = requireText_(
    payload.idempotencyKey,
    'idempotencyKey',
    240
  );
  var fingerprint = idempotencyFingerprint_(action, payload);
  var propertyKey = idempotencyPropertyKey_(action, idempotencyKey);
  var properties = PropertiesService.getScriptProperties();
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(APP_CONFIG.writeLockTimeoutMs)) {
    throw apiError_(
      'BACKEND_BUSY',
      'Другая операция записи ещё выполняется. Повторите позже.'
    );
  }

  try {
    var now = Date.now();
    var existing = safeJsonParse_(properties.getProperty(propertyKey), null);
    if (existing && existing.createdAt &&
        now - existing.createdAt <= APP_CONFIG.idempotencyTtlMs) {
      assertSameIdempotencyPayload_(existing, fingerprint);
      if (existing.state === 'completed') return existing.result;
      if (existing.state === 'failed') {
        throw apiError_(
          existing.errorCode || 'WRITE_FAILED',
          existing.errorMessage || 'Предыдущая попытка завершилась ошибкой.'
        );
      }
      throw apiError_(
        'OPERATION_IN_PROGRESS',
        'Операция с этим ключом уже выполняется или ожидает подтверждения.'
      );
    }

    properties.setProperty(propertyKey, JSON.stringify({
      state: 'pending',
      action: action,
      fingerprint: fingerprint,
      createdAt: now,
      requestId: requestId
    }));

    try {
      var result = operation();
      properties.setProperty(propertyKey, JSON.stringify({
        state: 'completed',
        action: action,
        fingerprint: fingerprint,
        createdAt: now,
        completedAt: Date.now(),
        requestId: requestId,
        result: result
      }));
      cleanupIdempotencyProperties_(properties, now);
      return result;
    } catch (operationError) {
      properties.setProperty(propertyKey, JSON.stringify({
        state: 'failed',
        action: action,
        fingerprint: fingerprint,
        createdAt: now,
        completedAt: Date.now(),
        requestId: requestId,
        errorCode: operationError && operationError.apiCode
          ? operationError.apiCode
          : 'INTERNAL_ERROR',
        errorMessage: operationError && operationError.apiCode
          ? clampText_(operationError.message, 500)
          : 'Операция не выполнена.'
      }));
      throw operationError;
    }
  } finally {
    lock.releaseLock();
  }
}

function idempotencyPropertyKey_(action, idempotencyKey) {
  return 'IDEMP_' + sha256WebSafe_(action + ':' + idempotencyKey).slice(0, 44);
}

function idempotencyFingerprint_(action, payload) {
  var dataHash = payload.dataUrl
    ? sha256WebSafe_(stringify_(payload.dataUrl))
    : '';
  return sha256WebSafe_([
    action,
    stringify_(payload.taskToken),
    stringify_(payload.employeeId).toUpperCase(),
    stringify_(payload.sessionId),
    stringify_(payload.result || payload.newStatus),
    stringify_(payload.fileName),
    stringify_(payload.mimeType),
    dataHash
  ].join('|'));
}

function assertSameIdempotencyPayload_(existing, fingerprint) {
  if (existing.fingerprint !== fingerprint) {
    throw apiError_(
      'IDEMPOTENCY_KEY_REUSED',
      'Этот idempotency key уже использован с другими параметрами.'
    );
  }
}

function getOperationStatusApi_(payload) {
  hydrateRuntimeConfig_();
  var writeAction = requireText_(payload.writeAction, 'writeAction', 80);
  var idempotencyKey = requireText_(
    payload.idempotencyKey,
    'idempotencyKey',
    240
  );
  if (!WRITE_ACTIONS_[writeAction]) {
    throw apiError_('ACTION_NOT_ALLOWED', 'Неизвестная операция записи.');
  }
  var properties = PropertiesService.getScriptProperties();
  var key = idempotencyPropertyKey_(writeAction, idempotencyKey);
  var existing = safeJsonParse_(properties.getProperty(key), null);
  if (!existing || !existing.createdAt) {
    return { completed: false, state: 'unknown' };
  }
  if (Date.now() - existing.createdAt > APP_CONFIG.idempotencyTtlMs) {
    properties.deleteProperty(key);
    return { completed: false, state: 'expired' };
  }
  if (existing.state === 'completed') {
    return {
      completed: true,
      state: 'completed',
      result: existing.result,
      originalRequestId: existing.requestId || '',
      completedAt: existing.completedAt
        ? new Date(existing.completedAt).toISOString()
        : ''
    };
  }
  if (existing.state === 'failed') {
    return {
      completed: true,
      state: 'failed',
      error: {
        code: existing.errorCode || 'WRITE_FAILED',
        message: existing.errorMessage || 'Операция не выполнена.'
      },
      originalRequestId: existing.requestId || ''
    };
  }
  return {
    completed: false,
    state: 'pending',
    originalRequestId: existing.requestId || ''
  };
}

function cleanupIdempotencyProperties_(properties, now) {
  if (Math.random() > 0.05) return;
  var all = properties.getProperties();
  Object.keys(all).forEach(function(key) {
    if (key.indexOf('IDEMP_') !== 0) return;
    var record = safeJsonParse_(all[key], null);
    if (!record || !record.createdAt ||
        now - record.createdAt > APP_CONFIG.idempotencyTtlMs) {
      properties.deleteProperty(key);
    }
  });
}
