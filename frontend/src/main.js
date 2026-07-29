import './styles/app.css';
import { ApiClient, ApiError } from './api.js';
import { createStore, saveEmployeeId, saveQuery } from './state.js';
import { formatRoute, formatTime, matchesTask, splitWbStickers } from './utils.js';

const api = new ApiClient(import.meta.env.VITE_BACKEND_URL);
const store = createStore();
let refreshTimer = 0;

const app = document.querySelector('#app');
app.innerHTML = `
  <main class="shell">
    <header class="topbar">
      <div><p class="eyebrow">Тестовая GitHub-версия</p><h1>Поиск товаров</h1></div>
      <span class="connection" id="connection">Онлайн</span>
    </header>
    <section class="searchPanel">
      <input id="search" type="search" autocomplete="off" placeholder="ID товара, WB-стикер, MX или BOX" aria-label="Поиск заданий">
      <div class="summary"><span id="count">0 заданий</span><span id="updated">ещё не обновлялось</span></div>
    </section>
    <div id="message"></div>
    <section class="taskList" id="taskList" aria-live="polite"></section>
  </main>
  <nav class="bottomNav" aria-label="Основная навигация">
    <button class="navButton" id="showAll" type="button">Все задания</button>
    <button class="primary" id="refresh" type="button">Обновить</button>
  </nav>
  <div class="backdrop" id="backdrop" hidden>
    <article class="sheet" role="dialog" aria-modal="true" aria-labelledby="taskTitle">
      <header class="sheetHeader">
        <div><p class="eyebrow" id="taskZone"></p><h2 id="taskTitle"></h2><div class="route" id="taskRoute"></div></div>
        <button class="iconButton" id="closeSheet" type="button" aria-label="Закрыть">×</button>
      </header>
      <div class="chips" id="taskStickers"></div>
      <div class="detailGrid" id="taskDetails"></div>
      <label class="field">ID сотрудника
        <input id="employeeId" maxlength="64" autocomplete="username" placeholder="Например E017">
      </label>
      <div id="sheetMessage"></div>
      <div class="actions">
        <button class="primary wide" id="takeTask" type="button">Взять задание</button>
        <button class="secondary wide" id="releaseTask" type="button" hidden>Освободить задание</button>
        <label class="secondary wide" for="photoInput" style="display:grid;place-items:center">Добавить фото</label>
        <input id="photoInput" type="file" accept="image/jpeg,image/png,image/webp" capture="environment" hidden>
        <img class="photoPreview" id="photoPreview" alt="Предпросмотр фото" hidden>
        <button class="successButton" id="foundTask" type="button">Найдено</button>
        <button class="dangerButton" id="missingTask" type="button">Не найдено</button>
      </div>
    </article>
  </div>
`;

const el = Object.fromEntries([
  'connection','search','count','updated','message','taskList','refresh','showAll','backdrop',
  'closeSheet','taskZone','taskTitle','taskRoute','taskStickers','taskDetails','employeeId',
  'sheetMessage','takeTask','releaseTask','photoInput','photoPreview','foundTask','missingTask'
].map((id) => [id, document.getElementById(id)]));

el.search.value = store.get().query;
el.employeeId.value = store.get().employeeId;

function setMessage(text = '', tone = '') {
  el.message.innerHTML = text ? `<div class="notice ${tone}">${escapeHtml(text)}</div>` : '';
}

function setSheetMessage(text = '', tone = '') {
  el.sheetMessage.innerHTML = text ? `<div class="notice ${tone}">${escapeHtml(text)}</div>` : '';
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
  })[char]);
}

function filteredTasks(state) {
  return state.tasks.filter((task) => matchesTask(task, state.query));
}

function render(state) {
  el.connection.textContent = state.offline ? 'Нет связи' : 'Онлайн';
  el.connection.classList.toggle('offline', state.offline);
  el.refresh.disabled = state.loading || state.saving || state.offline;
  el.updated.textContent = state.loading ? 'загрузка…' : `обновлено ${formatTime(state.generatedAt)}`;
  const tasks = filteredTasks(state);
  el.count.textContent = `${tasks.length} из ${state.tasks.length}`;

  if (state.loading && !state.tasks.length) {
    el.taskList.innerHTML = '<div class="empty"><div class="spinner" style="margin:0 auto 12px"></div>Загружаю задания…</div>';
    return;
  }
  if (!tasks.length) {
    el.taskList.innerHTML = `<div class="empty">${state.query ? 'Ничего не найдено. Проверьте ID или WB-стикер.' : 'Активных заданий нет.'}</div>`;
    return;
  }
  el.taskList.innerHTML = tasks.map((task) => `
    <button class="taskCard" type="button" data-key="${escapeHtml(task.taskToken)}">
      <div class="cardTop"><span class="cardId">${escapeHtml(task.itemId || task.wbSticker || 'Без ID')}</span><span class="zone">${escapeHtml(task.zone || '—')}</span></div>
      <div class="itemName">${escapeHtml(task.itemName || 'Без названия')}</div>
      <div class="route">${escapeHtml(formatRoute(task))}</div>
      <div class="chips">
        ${splitWbStickers(task.wbSticker).map((value) => `<span class="chip">WB ${escapeHtml(value)}</span>`).join('')}
        ${task.box ? `<span class="chip">BOX ${escapeHtml(task.box)}</span>` : ''}
        ${task.photoCount ? `<span class="chip">Фото ${task.photoCount}</span>` : ''}
      </div>
    </button>
  `).join('');
}

async function loadTasks({ silent = false } = {}) {
  if (store.get().loading || store.get().saving || !navigator.onLine) return;
  store.set({ loading: true });
  if (!silent) setMessage('');
  try {
    const data = await api.get('getTasks');
    store.set({ tasks: data.tasks || [], generatedAt: data.generatedAt || new Date().toISOString(), loading: false });
  } catch (error) {
    store.set({ loading: false });
    setMessage(formatError(error), 'error');
  } finally {
    scheduleRefresh();
  }
}

function scheduleRefresh() {
  clearTimeout(refreshTimer);
  const delay = document.hidden ? 300000 : 150000;
  refreshTimer = window.setTimeout(() => {
    if (!store.get().selectedTask && !store.get().saving) loadTasks({ silent: true });
  }, delay);
}

function selectTask(task) {
  store.set({ selectedTask: task, claim: null });
  el.taskZone.textContent = task.zone || task.sourceLabel || '';
  el.taskTitle.textContent = task.itemName || task.itemId || 'Задание';
  el.taskRoute.textContent = formatRoute(task);
  el.taskStickers.innerHTML = splitWbStickers(task.wbSticker)
    .map((value) => `<span class="chip">WB ${escapeHtml(value)}</span>`).join('');
  el.taskDetails.innerHTML = [
    ['ID товара', task.itemId],
    ['MX', task.mx],
    ['BOX', task.box],
    ['Сборщик', task.pickerId],
    ['Лист', task.sheetName],
    ['Строка', task.rowNumber]
  ].map(([label, value]) => `<div class="detail"><span>${label}</span><strong>${escapeHtml(value || '—')}</strong></div>`).join('');
  el.employeeId.value = store.get().employeeId;
  el.backdrop.hidden = false;
  document.body.style.overflow = 'hidden';
  updateActionState();
  setSheetMessage('');
}

function closeTaskSheet() {
  if (store.get().saving) return;
  el.backdrop.hidden = true;
  document.body.style.overflow = '';
  el.photoPreview.hidden = true;
  el.photoPreview.removeAttribute('src');
  store.set({ selectedTask: null, claim: null });
  scheduleRefresh();
}

function currentIdentity() {
  const employeeId = el.employeeId.value.trim().toUpperCase();
  if (!employeeId) {
    setSheetMessage('Укажите ID сотрудника.', 'error');
    el.employeeId.focus();
    return null;
  }
  saveEmployeeId(employeeId);
  store.set({ employeeId });
  return { employeeId, sessionId: store.get().sessionId };
}

function taskPayload(extra = {}) {
  const task = store.get().selectedTask;
  return {
    sheetName: task.sheetName,
    rowNumber: task.rowNumber,
    taskToken: task.taskToken,
    ...currentIdentity(),
    ...extra
  };
}

function updateActionState() {
  const { saving, claim } = store.get();
  const owned = Boolean(claim?.owned);
  el.takeTask.hidden = owned;
  el.releaseTask.hidden = !owned;
  [el.takeTask, el.releaseTask, el.photoInput, el.foundTask, el.missingTask].forEach((button) => {
    button.disabled = saving || (button !== el.takeTask && !owned);
  });
}

async function takeSelectedTask() {
  const identity = currentIdentity();
  if (!identity) return;
  const task = store.get().selectedTask;
  store.set({ saving: true });
  updateActionState();
  setSheetMessage('Фиксирую задание за вами…');
  try {
    const claim = await api.post('takeTask', {
      ...identity,
      sheetName: task.sheetName,
      rowNumber: task.rowNumber,
      taskToken: task.taskToken,
      idempotencyKey: `take:${identity.sessionId}:${task.taskToken}`
    }, {
      onUncertain: () => setSheetMessage('Ответ задерживается. Проверяю, закреплено ли задание…')
    });
    store.set({ claim: { ...claim, owned: true }, saving: false });
    setSheetMessage(`Задание ваше до ${formatTime(claim.expiresAt)}.`, 'success');
  } catch (error) {
    store.set({ saving: false });
    setSheetMessage(formatError(error), 'error');
  }
  updateActionState();
}

async function releaseSelectedTask() {
  const payload = taskPayload();
  if (!payload.employeeId) return;
  store.set({ saving: true });
  updateActionState();
  try {
    await api.post('releaseTask', {
      ...payload,
      idempotencyKey: `release:${payload.sessionId}:${payload.taskToken}`
    }, {
      onUncertain: () => setSheetMessage('Ответ задерживается. Проверяю освобождение задания…')
    });
    store.set({ claim: null, saving: false });
    setSheetMessage('Задание освобождено.', 'success');
  } catch (error) {
    store.set({ saving: false });
    setSheetMessage(formatError(error), 'error');
  }
  updateActionState();
}

async function completeSelectedTask(newStatus) {
  const payload = taskPayload({ newStatus });
  if (!payload.employeeId || store.get().saving) return;
  store.set({ saving: true });
  updateActionState();
  setSheetMessage('Сохраняю результат…');
  try {
    const result = await api.post('completeTask', {
      ...payload,
      idempotencyKey: `complete:${payload.sessionId}:${payload.taskToken}:${newStatus}`
    }, {
      onUncertain: () => setSheetMessage('Ответ задерживается. Проверяю сохранённый результат…')
    });
    store.update((state) => ({
      saving: false,
      tasks: state.tasks.filter((item) => item.taskToken !== payload.taskToken)
    }));
    setMessage(result.message || `Статус обновлён: ${newStatus}.`, 'success');
    closeTaskSheet();
    window.setTimeout(() => loadTasks({ silent: true }), 400);
  } catch (error) {
    store.set({ saving: false });
    setSheetMessage(`${formatError(error)} Повторная отправка автоматически не выполнялась.`, 'error');
    updateActionState();
  }
}

async function compressImage(file) {
  if (!file.type.startsWith('image/')) throw new Error('Выберите изображение.');
  const bitmap = await createImageBitmap(file);
  const maxSide = 1600;
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL('image/jpeg', .82);
}

async function uploadPhoto(file) {
  const payload = taskPayload();
  if (!payload.employeeId || !file || store.get().saving) return;
  store.set({ saving: true });
  updateActionState();
  setSheetMessage('Сжимаю фотографию…');
  try {
    const dataUrl = await compressImage(file);
    el.photoPreview.src = dataUrl;
    el.photoPreview.hidden = false;
    setSheetMessage('Загружаю фотографию…');
    const result = await api.post('uploadTaskPhoto', {
      ...payload,
      fileName: file.name || 'task-photo.jpg',
      mimeType: 'image/jpeg',
      dataUrl,
      idempotencyKey: `photo:${payload.sessionId}:${payload.taskToken}:${file.name}:${file.size}`
    }, {
      onUncertain: () => setSheetMessage('Ответ задерживается. Проверяю, сохранено ли фото…')
    });
    store.set({ saving: false });
    setSheetMessage(`Фото загружено (${result.photoCount}).`, 'success');
  } catch (error) {
    store.set({ saving: false });
    setSheetMessage(`${formatError(error)} Файл сохранён в форме и можно отправить снова вручную.`, 'error');
  }
  updateActionState();
}

function formatError(error) {
  if (error instanceof ApiError) {
    return `${error.message}${error.requestId ? ` Код запроса: ${error.requestId}` : ''}`;
  }
  return error?.message || 'Неизвестная ошибка.';
}

el.taskList.addEventListener('click', (event) => {
  const card = event.target.closest('[data-key]');
  if (!card) return;
  const task = store.get().tasks.find((item) => item.taskToken === card.dataset.key);
  if (task) selectTask(task);
});
el.search.addEventListener('input', () => {
  const query = el.search.value;
  saveQuery(query);
  store.set({ query });
});
el.refresh.addEventListener('click', () => loadTasks());
el.showAll.addEventListener('click', () => {
  el.search.value = '';
  saveQuery('');
  store.set({ query: '' });
  window.scrollTo({ top: 0, behavior: 'smooth' });
});
el.closeSheet.addEventListener('click', closeTaskSheet);
el.backdrop.addEventListener('click', (event) => {
  if (event.target === el.backdrop) closeTaskSheet();
});
el.takeTask.addEventListener('click', takeSelectedTask);
el.releaseTask.addEventListener('click', releaseSelectedTask);
el.foundTask.addEventListener('click', () => completeSelectedTask('Найдено'));
el.missingTask.addEventListener('click', () => completeSelectedTask('Не найдено'));
el.photoInput.addEventListener('change', () => uploadPhoto(el.photoInput.files?.[0]));
el.employeeId.addEventListener('change', () => {
  const employeeId = el.employeeId.value.trim().toUpperCase();
  saveEmployeeId(employeeId);
  store.set({ employeeId });
});
window.addEventListener('online', () => { store.set({ offline: false }); loadTasks(); });
window.addEventListener('offline', () => { store.set({ offline: true }); setMessage('Соединение потеряно. Введённые данные сохранены.', 'error'); });
document.addEventListener('visibilitychange', scheduleRefresh);
store.subscribe(render);
render(store.get());
loadTasks();
