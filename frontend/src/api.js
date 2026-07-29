const DEFAULT_READ_TIMEOUT_MS = 75000;
const DEFAULT_WRITE_TIMEOUT_MS = 45000;
const DEFAULT_CONFIRM_TIMEOUT_MS = 15000;
const DEFAULT_CONFIRM_ATTEMPTS = 4;
const DEFAULT_CONFIRM_DELAY_MS = 1500;
const AMBIGUOUS_WRITE_CODES = new Set([
  'TIMEOUT',
  'NETWORK_ERROR',
  'HTTP_502',
  'HTTP_503',
  'HTTP_504'
]);

export class ApiError extends Error {
  constructor(code, message, requestId = '') {
    super(message);
    this.name = 'ApiError';
    this.code = code || 'API_ERROR';
    this.requestId = requestId;
  }
}

function newRequestId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `web-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class ApiClient {
  constructor(baseUrl, options = {}) {
    this.baseUrl = String(baseUrl || '').trim();
    this.readTimeoutMs = options.readTimeoutMs || options.timeoutMs || DEFAULT_READ_TIMEOUT_MS;
    this.writeTimeoutMs = options.writeTimeoutMs || DEFAULT_WRITE_TIMEOUT_MS;
    this.confirmTimeoutMs = options.confirmTimeoutMs || DEFAULT_CONFIRM_TIMEOUT_MS;
    this.confirmAttempts = options.confirmAttempts || DEFAULT_CONFIRM_ATTEMPTS;
    this.confirmDelayMs = options.confirmDelayMs ?? DEFAULT_CONFIRM_DELAY_MS;
  }

  assertConfigured() {
    if (!/^https:\/\/script\.google\.com\/macros\/s\/[^/]+\/exec$/.test(this.baseUrl)) {
      throw new ApiError('CONFIG_ERROR', 'URL backend не настроен.');
    }
  }

  async get(action, params = {}) {
    this.assertConfigured();
    let lastError;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        return await this.request('GET', action, params, { timeoutMs: this.readTimeoutMs });
      } catch (error) {
        lastError = error;
        if (attempt > 0 || (error instanceof ApiError && !['TIMEOUT', 'NETWORK_ERROR', 'HTTP_503'].includes(error.code))) {
          throw error;
        }
        await delay(500);
      }
    }
    throw lastError;
  }

  async post(action, payload = {}, options = {}) {
    this.assertConfigured();
    try {
      return await this.request('POST', action, payload, {
        timeoutMs: options.timeoutMs || this.writeTimeoutMs
      });
    } catch (error) {
      if (!this.canConfirmWrite(error, payload)) throw error;
      options.onUncertain?.(error);
      return this.confirmWrite(action, payload.idempotencyKey, options);
    }
  }

  canConfirmWrite(error, payload) {
    return Boolean(
      payload?.idempotencyKey &&
      error instanceof ApiError &&
      AMBIGUOUS_WRITE_CODES.has(error.code)
    );
  }

  async confirmWrite(action, idempotencyKey, options = {}) {
    const attempts = options.confirmAttempts || this.confirmAttempts;
    const delayMs = options.confirmDelayMs ?? this.confirmDelayMs;
    let lastRequestId = '';

    for (let attempt = 0; attempt < attempts; attempt += 1) {
      try {
        const status = await this.request('GET', 'getOperationStatus', {
          writeAction: action,
          idempotencyKey
        }, {
          timeoutMs: options.confirmTimeoutMs || this.confirmTimeoutMs
        });
        if (status?.completed) return status.result;
      } catch (error) {
        if (!(error instanceof ApiError) || !AMBIGUOUS_WRITE_CODES.has(error.code)) {
          throw error;
        }
        lastRequestId = error.requestId || lastRequestId;
      }

      if (attempt < attempts - 1 && delayMs > 0) await delay(delayMs);
    }

    throw new ApiError(
      'RESULT_UNKNOWN',
      'Ответ сервера задерживается, а результат пока не подтверждён. Обновите состояние задания перед повтором.',
      lastRequestId
    );
  }

  async request(method, action, payload, options = {}) {
    const requestId = newRequestId();
    const controller = new AbortController();
    const timer = setTimeout(
      () => controller.abort(),
      options.timeoutMs || this.readTimeoutMs
    );
    let response;

    try {
      if (method === 'GET') {
        const url = new URL(this.baseUrl);
        url.searchParams.set('action', action);
        url.searchParams.set('requestId', requestId);
        Object.entries(payload || {}).forEach(([key, value]) => {
          if (value !== undefined && value !== null && value !== '') {
            url.searchParams.set(key, typeof value === 'object' ? JSON.stringify(value) : String(value));
          }
        });
        response = await fetch(url, {
          method: 'GET',
          mode: 'cors',
          credentials: 'omit',
          cache: 'no-store',
          signal: controller.signal
        });
      } else {
        response = await fetch(this.baseUrl, {
          method: 'POST',
          mode: 'cors',
          credentials: 'omit',
          cache: 'no-store',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({ action, requestId, ...payload }),
          signal: controller.signal
        });
      }
    } catch (error) {
      if (error?.name === 'AbortError') {
        throw new ApiError('TIMEOUT', 'Сервер отвечает слишком долго.', requestId);
      }
      throw new ApiError('NETWORK_ERROR', 'Не удалось связаться с сервером.', requestId);
    } finally {
      clearTimeout(timer);
    }

    if (!response.ok) {
      throw new ApiError(`HTTP_${response.status}`, `HTTP ${response.status}`, requestId);
    }

    let envelope;
    try {
      envelope = await response.json();
    } catch {
      throw new ApiError('INVALID_JSON', 'Сервер вернул некорректный ответ.', requestId);
    }

    if (!envelope?.ok) {
      throw new ApiError(
        envelope?.error?.code || 'API_ERROR',
        envelope?.error?.message || 'Операция не выполнена.',
        envelope?.requestId || requestId
      );
    }
    return envelope.data;
  }
}
