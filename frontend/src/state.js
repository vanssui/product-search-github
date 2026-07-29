const EMPLOYEE_KEY = 'product_search_employee_id';
const QUERY_KEY = 'product_search_query';
const SESSION_KEY = 'product_search_session_id';

function createSessionId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `session-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function loadPersistentState() {
  let sessionId = sessionStorage.getItem(SESSION_KEY);
  if (!sessionId) {
    sessionId = createSessionId();
    sessionStorage.setItem(SESSION_KEY, sessionId);
  }
  return {
    employeeId: localStorage.getItem(EMPLOYEE_KEY) || '',
    query: localStorage.getItem(QUERY_KEY) || '',
    sessionId
  };
}

export function saveEmployeeId(value) {
  localStorage.setItem(EMPLOYEE_KEY, String(value || '').trim().toUpperCase());
}

export function saveQuery(value) {
  localStorage.setItem(QUERY_KEY, String(value || ''));
}

export function createStore(initial = {}) {
  let state = {
    tasks: [],
    generatedAt: '',
    loading: false,
    saving: false,
    offline: !navigator.onLine,
    selectedTask: null,
    claim: null,
    message: null,
    ...loadPersistentState(),
    ...initial
  };
  const listeners = new Set();

  return {
    get: () => state,
    set(patch) {
      state = { ...state, ...patch };
      listeners.forEach((listener) => listener(state));
    },
    update(updater) {
      this.set(updater(state));
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    }
  };
}

