import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const source = (name) => readFileSync(
  new URL(`../src/${name}`, import.meta.url),
  'utf8'
);

function apiError(code, message) {
  const error = new Error(message);
  error.apiCode = code;
  return error;
}

function propertyStore(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    values,
    service: {
      getProperty: (key) => values.has(key) ? values.get(key) : null,
      setProperty: (key, value) => values.set(key, String(value)),
      deleteProperty: (key) => values.delete(key),
      getProperties: () => Object.fromEntries(values)
    }
  };
}

function featureContext(properties) {
  const context = vm.createContext({
    API_VERSION_: 'v1',
    PropertiesService: {
      getScriptProperties: () => properties.service
    },
    stringify_: (value) => String(value ?? '').trim(),
    safeJsonParse_: (value, fallback) => {
      try { return JSON.parse(value); } catch { return fallback; }
    },
    apiError_: apiError
  });
  vm.runInContext(source('Config.gs'), context);
  vm.runInContext(source('FeatureFlags.gs'), context);
  return context;
}

test('master READ_ONLY disables every production write endpoint', () => {
  const properties = propertyStore({
    ENVIRONMENT: 'production',
    READ_ONLY: 'true',
    SPREADSHEET_ID: 'private-runtime-value',
    EXPECTED_SPREADSHEET_NAME: 'private-runtime-value',
    SOURCE_SHEETS_JSON: '[{"name":"runtime-only"}]',
    TOKEN_SECRET: 'x'.repeat(32),
    FEATURE_COMPLETE_TASK: 'true'
  });
  const context = featureContext(properties);
  const capabilities = context.getCapabilities_();

  assert.equal(capabilities.masterReadOnly, true);
  Object.values(capabilities.write).forEach((enabled) => {
    assert.equal(enabled, false);
  });
  assert.throws(
    () => context.assertWriteActionEnabled_('completeTask'),
    (error) => error.apiCode === 'READ_ONLY'
  );
});

test('write features are independent and default to disabled', () => {
  const properties = propertyStore({
    ENVIRONMENT: 'production',
    READ_ONLY: 'false',
    SPREADSHEET_ID: 'private-runtime-value',
    EXPECTED_SPREADSHEET_NAME: 'private-runtime-value',
    SOURCE_SHEETS_JSON: '[{"name":"runtime-only"}]',
    TOKEN_SECRET: 'x'.repeat(32),
    FEATURE_COMPLETE_TASK: 'true'
  });
  const context = featureContext(properties);
  const capabilities = context.getCapabilities_();

  assert.equal(capabilities.write.completeTask, true);
  assert.equal(capabilities.write.markFound, true);
  assert.equal(capabilities.write.uploadTaskPhoto, false);
  assert.doesNotThrow(() =>
    context.assertWriteActionEnabled_('completeTask')
  );
  assert.throws(
    () => context.assertWriteActionEnabled_('uploadTaskPhoto'),
    (error) => error.apiCode === 'FEATURE_DISABLED'
  );
});

function idempotencyContext() {
  const properties = propertyStore();
  const lock = {
    tryLock: () => true,
    releaseLock: () => {}
  };
  const context = vm.createContext({
    APP_CONFIG: {
      writeLockTimeoutMs: 100,
      idempotencyTtlMs: 86_400_000
    },
    WRITE_ACTIONS_: { completeTask: true, uploadTaskPhoto: true },
    PropertiesService: {
      getScriptProperties: () => properties.service
    },
    LockService: { getScriptLock: () => lock },
    requireText_: (value, field) => {
      const text = String(value ?? '').trim();
      if (!text) throw apiError('VALIDATION_ERROR', field);
      return text;
    },
    stringify_: (value) => String(value ?? '').trim(),
    sha256WebSafe_: (value) =>
      Buffer.from(String(value)).toString('base64url').padEnd(50, 'x'),
    safeJsonParse_: (value, fallback) => {
      try { return JSON.parse(value); } catch { return fallback; }
    },
    clampText_: (value, max) => String(value ?? '').slice(0, max),
    apiError_: apiError,
    nowIso_: () => new Date().toISOString(),
    Math,
    Date
  });
  vm.runInContext(source('IdempotencyService.gs'), context);
  return { context, properties };
}

test('same idempotency key executes a write exactly once', () => {
  const { context } = idempotencyContext();
  let executions = 0;
  const payload = {
    idempotencyKey: 'same-key',
    taskToken: 'task',
    employeeId: 'E1',
    sessionId: 'S1',
    result: 'Найдено'
  };
  const operation = () => ({ number: ++executions });

  const first = context.withIdempotency_(
    'completeTask', payload, 'request-1', operation
  );
  const second = context.withIdempotency_(
    'completeTask', payload, 'request-2', operation
  );

  assert.deepEqual(first, { number: 1 });
  assert.deepEqual(second, { number: 1 });
  assert.equal(executions, 1);
});

test('reusing an idempotency key with another payload is rejected', () => {
  const { context } = idempotencyContext();
  const base = {
    idempotencyKey: 'reused-key',
    taskToken: 'task',
    employeeId: 'E1',
    sessionId: 'S1',
    result: 'Найдено'
  };
  context.withIdempotency_(
    'completeTask', base, 'request-1', () => ({ updated: true })
  );

  assert.throws(
    () => context.withIdempotency_(
      'completeTask',
      { ...base, result: 'Не найдено' },
      'request-2',
      () => ({ updated: true })
    ),
    (error) => error.apiCode === 'IDEMPOTENCY_KEY_REUSED'
  );
});

test('a pending idempotency record never executes a second write', () => {
  const { context, properties } = idempotencyContext();
  const payload = {
    idempotencyKey: 'pending-key',
    taskToken: 'task',
    employeeId: 'E1',
    sessionId: 'S1',
    result: 'Найдено'
  };
  const fingerprint = context.idempotencyFingerprint_('completeTask', payload);
  const key = context.idempotencyPropertyKey_('completeTask', 'pending-key');
  properties.service.setProperty(key, JSON.stringify({
    state: 'pending',
    fingerprint,
    createdAt: Date.now(),
    requestId: 'original'
  }));
  let executions = 0;

  assert.throws(
    () => context.withIdempotency_(
      'completeTask',
      payload,
      'retry',
      () => ({ number: ++executions })
    ),
    (error) => error.apiCode === 'OPERATION_IN_PROGRESS'
  );
  assert.equal(executions, 0);
});

function claimContext({ status = '' } = {}) {
  const properties = propertyStore();
  const context = vm.createContext({
    APP_CONFIG: { claimTtlMs: 600_000 },
    PropertiesService: {
      getScriptProperties: () => properties.service
    },
    sha256WebSafe_: (value) =>
      Buffer.from(String(value)).toString('base64url').padEnd(50, 'x'),
    requireText_: (value, field) => {
      const text = String(value ?? '').trim();
      if (!text) throw apiError('VALIDATION_ERROR', field);
      return text;
    },
    stringify_: (value) => String(value ?? '').trim(),
    normalizeEmployeeId_: (value) => String(value).trim().toUpperCase(),
    getWritableTaskContextByToken_: () => ({
      row: [status],
      columns: { statusSearch: 0 }
    }),
    getCell_: (row, column) => row[column],
    isActiveStatus_: (value) => !String(value ?? '').trim(),
    safeJsonParse_: (value, fallback) => {
      try { return JSON.parse(value); } catch { return fallback; }
    },
    apiError_: apiError,
    Date
  });
  vm.runInContext(source('ClaimService.gs'), context);
  return { context, properties };
}

test('a closed task cannot be claimed through a stale catalog token', () => {
  const { context } = claimContext({ status: 'Найдено' });

  assert.throws(
    () => context.takeTaskApi_({
      taskToken: 'stale-task',
      employeeId: 'E1',
      sessionId: 'S1'
    }),
    (error) => error.apiCode === 'TASK_CLOSED'
  );
});

test('a second employee cannot take or release an active claim', () => {
  const { context } = claimContext();
  const first = {
    taskToken: 'task',
    employeeId: 'E1',
    sessionId: 'S1'
  };
  const second = {
    taskToken: 'task',
    employeeId: 'E2',
    sessionId: 'S2'
  };

  assert.equal(context.takeTaskApi_(first).owned, true);
  assert.throws(
    () => context.takeTaskApi_(second),
    (error) => error.apiCode === 'TASK_LOCKED'
  );
  assert.throws(
    () => context.releaseTaskApi_(second),
    (error) => error.apiCode === 'NOT_TASK_OWNER'
  );
  assert.equal(context.releaseTaskApi_(first).released, true);
  assert.equal(context.takeTaskApi_(second).owned, true);
});

test('API router exposes independent read and write endpoints', () => {
  const apiSource = source('Api.gs');
  [
    'getCatalog',
    'getTask',
    'getStatistics',
    'getTaskPhotos',
    'getTaskPhoto',
    'getOperationStatus',
    'takeTask',
    'releaseTask',
    'markFound',
    'markNotFound',
    'completeTask',
    'uploadTaskPhoto',
    'updateEmployee'
  ].forEach((action) => {
    assert.match(apiSource, new RegExp(`${action}: function`));
  });
});

test('public task and photo contracts hide Sheets and Drive identifiers', () => {
  const catalogSource = source('CatalogService.gs');
  const publicProjection = catalogSource.match(
    /function projectTask_\(task\) \{([\s\S]*?)\n\}/
  )?.[1] || '';
  const photoSource = source('PhotoReadService.gs');
  const photoWriteSource = source('PhotoWriteService.gs');
  const photoListProjection = photoSource.match(
    /function getTaskPhotosApi_\(payload\) \{([\s\S]*?)\n\}/
  )?.[1] || '';

  assert.doesNotMatch(publicProjection, /sourceLabel|photoFileIds/);
  assert.doesNotMatch(photoListProjection, /fileId\s*:/);
  assert.match(photoListProjection, /photoToken\s*:/);
  assert.doesNotMatch(photoWriteSource, /fileId\s*:/);
  assert.match(photoWriteSource, /photoToken\s*:/);
});
