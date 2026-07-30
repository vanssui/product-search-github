import test from 'node:test';
import assert from 'node:assert/strict';
import { ApiClient, ApiError } from '../src/api.js';

const BACKEND_URL = 'https://script.google.com/macros/s/test-deployment/exec';

function jsonResponse(payload) {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
}

function successEnvelope(data) {
  return { ok: true, data, error: null, requestId: 'server-request' };
}

test('read retries a transient BACKEND_BUSY response', async (t) => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  t.after(() => { globalThis.fetch = originalFetch; });

  globalThis.fetch = async () => {
    calls += 1;
    if (calls === 1) {
      return jsonResponse({
        ok: false,
        data: null,
        error: {
          code: 'BACKEND_BUSY',
          message: 'Каталог обновляется.'
        },
        requestId: 'busy-request'
      });
    }
    return jsonResponse(successEnvelope({ totalActive: 201 }));
  };

  const client = new ApiClient(BACKEND_URL);
  const result = await client.get('getCatalog');

  assert.equal(result.totalActive, 201);
  assert.equal(calls, 2);
});

test('timed-out POST is confirmed without sending a second POST', async (t) => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  t.after(() => { globalThis.fetch = originalFetch; });

  globalThis.fetch = async (url, options) => {
    calls.push({ url: String(url), method: options.method });
    if (options.method === 'POST') {
      return new Promise((resolve, reject) => {
        options.signal.addEventListener('abort', () => {
          const error = new Error('request aborted');
          error.name = 'AbortError';
          reject(error);
        }, { once: true });
      });
    }
    return jsonResponse(successEnvelope({
      completed: true,
      result: { updated: true, statusSearch: 'Найдено' }
    }));
  };

  const client = new ApiClient(BACKEND_URL, {
    writeTimeoutMs: 5,
    confirmAttempts: 1,
    confirmDelayMs: 0
  });
  const result = await client.post('updateTask', {
    idempotencyKey: 'update:session:task'
  });

  assert.equal(result.statusSearch, 'Найдено');
  assert.equal(calls.filter((call) => call.method === 'POST').length, 1);
  assert.equal(calls.filter((call) => call.method === 'GET').length, 1);
  assert.match(calls[1].url, /action=getOperationStatus/);
});

test('confirmation polls pending result and keeps the same idempotency key', async (t) => {
  const originalFetch = globalThis.fetch;
  const confirmationUrls = [];
  let confirmationAttempt = 0;
  t.after(() => { globalThis.fetch = originalFetch; });

  globalThis.fetch = async (url, options) => {
    if (options.method === 'POST') throw new TypeError('connection interrupted');
    confirmationUrls.push(String(url));
    confirmationAttempt += 1;
    if (confirmationAttempt === 1) {
      return jsonResponse(successEnvelope({ completed: false, state: 'pending_or_unknown' }));
    }
    return jsonResponse(successEnvelope({
      completed: true,
      result: { updated: true, statusSearch: 'Не найдено' }
    }));
  };

  const client = new ApiClient(BACKEND_URL, {
    confirmAttempts: 2,
    confirmDelayMs: 0
  });
  const result = await client.post('updateTask', {
    idempotencyKey: 'update:session:task'
  });

  assert.deepEqual(result, { updated: true, statusSearch: 'Не найдено' });
  assert.equal(confirmationUrls.length, 2);
  confirmationUrls.forEach((url) => {
    assert.match(url, /idempotencyKey=update%3Asession%3Atask/);
  });
});

test('unknown result never retries the write', async (t) => {
  const originalFetch = globalThis.fetch;
  let postCount = 0;
  t.after(() => { globalThis.fetch = originalFetch; });

  globalThis.fetch = async (url, options) => {
    if (options.method === 'POST') {
      postCount += 1;
      throw new TypeError('connection interrupted');
    }
    return jsonResponse(successEnvelope({
      completed: false,
      state: 'pending_or_unknown'
    }));
  };

  const client = new ApiClient(BACKEND_URL, {
    confirmAttempts: 2,
    confirmDelayMs: 0
  });
  await assert.rejects(
    client.post('uploadTaskPhoto', { idempotencyKey: 'photo:session:task:file' }),
    (error) => error instanceof ApiError && error.code === 'RESULT_UNKNOWN'
  );
  assert.equal(postCount, 1);
});

test('confirmed server failure is returned as an API error without another POST', async (t) => {
  const originalFetch = globalThis.fetch;
  let postCount = 0;
  t.after(() => { globalThis.fetch = originalFetch; });

  globalThis.fetch = async (url, options) => {
    if (options.method === 'POST') {
      postCount += 1;
      throw new TypeError('connection interrupted');
    }
    return jsonResponse(successEnvelope({
      completed: true,
      state: 'failed',
      error: {
        code: 'TASK_CHANGED',
        message: 'Строка задания изменилась.'
      },
      originalRequestId: 'original-request'
    }));
  };

  const client = new ApiClient(BACKEND_URL, {
    confirmAttempts: 1,
    confirmDelayMs: 0
  });
  await assert.rejects(
    client.post('updateTask', { idempotencyKey: 'failed-write' }),
    (error) =>
      error instanceof ApiError &&
      error.code === 'TASK_CHANGED' &&
      error.requestId === 'original-request'
  );
  assert.equal(postCount, 1);
});
