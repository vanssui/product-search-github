const DEFAULT_TIMEOUT_MS = 25000;

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
    this.timeoutMs = options.timeoutMs || DEFAULT_TIMEOUT_MS;
  }

  assertConfigured() {
    if (!/^https:\/\/script\.google\.com\/macros\/s\/[^/]+\/exec$/.test(this.baseUrl)) {
      throw new ApiError('CONFIG_ERROR', 'URL тестового backend не настроен.');
    }
  }

  async get(action, params = {}) {
    this.assertConfigured();
    let lastError;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        return await this.request('GET', action, params);
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

  async post(action, payload = {}) {
    this.assertConfigured();
    return this.request('POST', action, payload);
  }

  async request(method, action, payload) {
    const requestId = newRequestId();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
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

