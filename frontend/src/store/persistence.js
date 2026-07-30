const EMPLOYEE_KEY = 'product_search_employee_id';
const QUERY_KEY = 'product_search_query';
const SESSION_KEY = 'product_search_session_id';
const SELECTED_TASK_KEY = 'product_search_selected_task';

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
    sessionId,
    selectedToken: sessionStorage.getItem(SELECTED_TASK_KEY) || ''
  };
}

export function saveEmployeeId(value) {
  localStorage.setItem(EMPLOYEE_KEY, String(value || '').trim().toUpperCase());
}

export function saveQuery(value) {
  localStorage.setItem(QUERY_KEY, String(value || ''));
}

export function saveSelectedTask(taskToken) {
  const value = String(taskToken || '');
  if (value) sessionStorage.setItem(SELECTED_TASK_KEY, value);
  else sessionStorage.removeItem(SELECTED_TASK_KEY);
}
