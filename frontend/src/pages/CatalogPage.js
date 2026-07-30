import '../styles/app.css';
import { ApiError } from '../api/ApiClient.js';
import { createProductSearchApi } from '../api/ProductSearchApi.js';
import { APP_CONFIG } from '../config/app.js';
import { buildCatalogRequestParams } from '../api/catalogRequest.js';
import { createCatalogStore, deriveLocalCatalog } from '../store/catalogStore.js';
import { saveEmployeeId, saveQuery, saveSelectedTask } from '../store/persistence.js';
import { renderAppShell } from '../components/AppShell.js';
import { renderBlockButtons, renderFloorButtons } from '../components/Filters.js';
import { renderTaskCards } from '../components/TaskCard.js';
import { buildTaskDetailView } from '../components/TaskDetail.js';
import { escapeHtml } from '../ui/html.js';
import { formatTime } from '../utils/tasks.js';
import '../types/contracts.js';

const api = createProductSearchApi(APP_CONFIG.backendUrl);
const { pageSize: PAGE_SIZE, snapshotPageSize: SNAPSHOT_PAGE_SIZE } = APP_CONFIG;
const store = createCatalogStore();

let refreshTimer = 0;
let searchTimer = 0;
let requestSequence = 0;
const photoCache = new Map();
const metrics = [];
globalThis.__PRODUCT_SEARCH_METRICS__ = metrics;

export function mountCatalogPage(app = document.querySelector('#app')) {
  if (!app) throw new Error('Не найден корневой элемент приложения.');
  app.innerHTML = renderAppShell();
  startCatalogPage(app);
}

function startCatalogPage(app) {
const ids = [
  'connection', 'employeeButton', 'refreshButton', 'searchInput', 'blockGrid',
  'myTasksButton', 'photoFilterButton', 'floorGrid', 'filteredMetric',
  'totalMetric', 'floorMetric', 'photoMetric', 'updatedText', 'notice',
  'catalogEyebrow', 'catalogTitle', 'taskList', 'loadMoreButton', 'detailPane',
  'detailEmpty', 'taskDetail', 'detailSource', 'detailSticker', 'detailName',
  'detailBadges', 'detailMx', 'detailRoute', 'detailGrid', 'photoCountLabel',
  'photoList', 'closeDetailButton', 'detailBackdrop', 'profileModal',
  'profileForm', 'employeeInput', 'cancelProfileButton', 'photoViewer',
  'photoViewerClose', 'photoViewerBody'
];
const el = Object.fromEntries(ids.map((id) => [id, app.ownerDocument.getElementById(id)]));

el.searchInput.value = store.get().query;

function setNotice(text = '', tone = '') {
  el.notice.innerHTML = text
    ? `<div class="notice ${tone}">${escapeHtml(text)}</div>`
    : '';
}

function recordMetric(name, startedAt, extra = {}) {
  const entry = {
    name,
    durationMs: Math.round((performance.now() - startedAt) * 10) / 10,
    at: new Date().toISOString(),
    ...extra
  };
  metrics.push(entry);
  if (metrics.length > 100) metrics.shift();
  return entry;
}

function applyLocalCatalog(patch = {}, { resetLimit = true } = {}) {
  const result = deriveLocalCatalog(
    { ...store.get(), ...patch },
    { pageSize: PAGE_SIZE, resetLimit }
  );
  if (!result) return false;
  store.set({ ...patch, ...result });
  return true;
}

async function loadCatalog({
  append = false,
  silent = false,
  fresh = false
} = {}) {
  const state = store.get();
  if (state.loading || state.offline) return;
  if (append && state.catalogComplete) {
    applyLocalCatalog(
      { visibleLimit: state.visibleLimit + PAGE_SIZE },
      { resetLimit: false }
    );
    return;
  }

  const sequence = ++requestSequence;
  const page = append ? state.page + 1 : 1;
  const startedAt = performance.now();

  store.set({ loading: true });
  if (!silent) setNotice('');

  try {
    const parameters = buildCatalogRequestParams(state, {
      append,
      page,
      pageSize: PAGE_SIZE,
      snapshotPageSize: SNAPSHOT_PAGE_SIZE,
      fresh
    });
    const data = await api.getCatalog(parameters);
    if (sequence !== requestSequence) return;

    const returnedTasks = data.tasks || [];
    const isCompleteSnapshot = !append &&
      !data.hasMore &&
      returnedTasks.length === (data.totalActive || 0);
    if (isCompleteSnapshot) {
      store.set({
        allTasks: returnedTasks,
        catalogComplete: true,
        totalActive: data.totalActive || 0,
        generatedAt: data.generatedAt || new Date().toISOString(),
        visibleLimit: PAGE_SIZE,
        loading: false
      });
      applyLocalCatalog({}, { resetLimit: true });
      recordMetric('catalog_load', startedAt, {
        serverGeneratedAt: data.generatedAt,
        returned: returnedTasks.length,
        filteredCount: data.totalActive || 0,
        localFiltering: true
      });
      if (store.get().selectedToken) restoreSelectedTask();
      return;
    }

    const tasks = append ? [...store.get().tasks, ...(data.tasks || [])] : (data.tasks || []);
    store.set({
      tasks,
      catalogComplete: false,
      blocks: data.blocks || [],
      floors: data.floors || [],
      filteredCount: data.filteredCount || 0,
      totalActive: data.totalActive || 0,
      photoCount: data.photoCount || 0,
      generatedAt: data.generatedAt || new Date().toISOString(),
      page: data.page || page,
      pageCount: data.pageCount || 1,
      hasMore: Boolean(data.hasMore),
      loading: false
    });
    recordMetric(append ? 'catalog_next_page' : 'catalog_load', startedAt, {
      serverGeneratedAt: data.generatedAt,
      returned: (data.tasks || []).length,
      filteredCount: data.filteredCount || 0
    });
    if (!append && store.get().selectedToken) {
      restoreSelectedTask();
    }
  } catch (error) {
    if (sequence !== requestSequence) return;
    store.set({ loading: false });
    setNotice(formatError(error), 'error');
    recordMetric('catalog_error', startedAt, { code: error?.code || 'ERROR' });
  } finally {
    scheduleRefresh();
  }
}

async function restoreSelectedTask() {
  const token = store.get().selectedToken;
  if (!token) return;
  const inPage = store.get().tasks.find((task) => task.taskToken === token);
  if (inPage) {
    selectTask(inPage, { persist: false });
    return;
  }
  try {
    const task = await api.getTask(token);
    selectTask(task, { persist: false });
  } catch {
    clearSelection();
  }
}

function scheduleRefresh() {
  clearTimeout(refreshTimer);
  refreshTimer = window.setTimeout(() => {
    if (!document.hidden && !store.get().selectedTask) {
      loadCatalog({ silent: true });
    }
  }, document.hidden ? APP_CONFIG.refreshHiddenMs : APP_CONFIG.refreshVisibleMs);
}

function render(state) {
  el.connection.textContent = state.offline
    ? 'Нет связи'
    : state.loading
      ? 'Обновление…'
      : 'Production • чтение';
  el.connection.classList.toggle('offline', state.offline);
  el.employeeButton.textContent = state.employeeId || 'Указать ID';
  el.refreshButton.disabled = state.loading || state.offline;
  el.searchInput.disabled = state.loading && !state.tasks.length;

  renderBlocks(state);
  renderFloors(state);
  renderSummary(state);
  renderTasks(state);
  renderDetail(state);
}

function renderBlocks(state) {
  el.blockGrid.innerHTML = renderBlockButtons(state.blocks, state.zone);
  el.myTasksButton.classList.toggle('active', state.myOnly);
  el.photoFilterButton.classList.toggle('active', state.photoOnly);
}

function renderFloors(state) {
  el.floorGrid.innerHTML = renderFloorButtons(state.floors, state.floor);
}

function renderSummary(state) {
  el.filteredMetric.textContent = state.filteredCount;
  el.totalMetric.textContent = state.totalActive;
  el.floorMetric.textContent = state.floors.length;
  el.photoMetric.textContent = state.photoCount;
  el.updatedText.textContent = state.loading
    ? 'Получаю свежие данные…'
    : `Обновлено ${formatTime(state.generatedAt)}`;
  el.catalogEyebrow.textContent = state.zone || 'Все блоки';
  el.catalogTitle.textContent = state.floor
    ? `Задания • ${state.floor === 'Без этажа' ? state.floor : `этаж ${state.floor}`}`
    : 'Задания по маршруту';
}

function renderTasks(state) {
  if (state.loading && !state.tasks.length) {
    el.taskList.innerHTML = Array.from({ length: 6 }, () => '<div class="taskSkeleton"></div>').join('');
    el.loadMoreButton.hidden = true;
    return;
  }
  if (!state.tasks.length) {
    el.taskList.innerHTML = `
      <div class="emptyState">
        <h3>Заданий не найдено</h3>
        <p>Измените блок, этаж или строку поиска.</p>
      </div>`;
    el.loadMoreButton.hidden = true;
    return;
  }

  el.taskList.innerHTML = renderTaskCards(state);

  el.loadMoreButton.hidden = !state.hasMore;
  el.loadMoreButton.disabled = state.loading;
  el.loadMoreButton.textContent = state.loading ? 'Загрузка…' : 'Показать ещё';
}

function renderDetail(state) {
  const task = state.selectedTask;
  el.detailEmpty.hidden = Boolean(task);
  el.taskDetail.hidden = !task;
  el.detailBackdrop.hidden = !task ||
    window.innerWidth >= APP_CONFIG.detailDesktopBreakpoint;
  document.documentElement.classList.toggle('detailOpen', Boolean(task));
  if (!task) return;

  const detail = buildTaskDetailView(task);
  el.detailSource.textContent = detail.source;
  el.detailSticker.textContent = detail.sticker;
  el.detailName.textContent = detail.name;
  el.detailMx.textContent = detail.mx;
  el.detailRoute.textContent = detail.route;
  el.detailBadges.innerHTML = detail.badgesHtml;
  el.detailGrid.innerHTML = detail.gridHtml;

  el.photoCountLabel.textContent = task.photoCount || 0;
  renderPhotos(task, state.selectedPhotos, state.photosLoading, state.photoBusy);
}

function renderPhotos(task, photos, loading, busy) {
  if (loading) {
    el.photoList.innerHTML = '<div class="photoEmpty">Загрузка списка фото…</div>';
    return;
  }
  if (!task.photoCount || !photos.length) {
    el.photoList.innerHTML = '<div class="photoEmpty">Фото пока не добавлено</div>';
    return;
  }
  el.photoList.innerHTML = photos.map((photo, index) => {
    const photoToken = photo.photoToken;
    const dataUrl = photoCache.get(photoToken);
    if (dataUrl) {
      return `<button class="photoThumb" data-photo-token="${escapeHtml(photoToken)}" type="button">
        <img src="${escapeHtml(dataUrl)}" alt="Фото ${index + 1}">
      </button>`;
    }
    return `<button class="photoPlaceholder" data-photo-token="${escapeHtml(photoToken)}"
      type="button" ${busy ? 'disabled' : ''}>Открыть фото ${index + 1}</button>`;
  }).join('');
}

function selectTask(task, { persist = true } = {}) {
  const startedAt = performance.now();
  if (persist) saveSelectedTask(task.taskToken);
  store.set({
    selectedTask: task,
    selectedToken: task.taskToken,
    selectedPhotos: [],
    photosLoading: Boolean(task.photoCount)
  });
  recordMetric('open_task', startedAt, { taskToken: task.taskToken.slice(0, 8) });
  if (task.photoCount) loadTaskPhotos(task);
}

function clearSelection() {
  saveSelectedTask('');
  store.set({
    selectedTask: null,
    selectedToken: '',
    selectedPhotos: [],
    photosLoading: false
  });
}

async function loadTaskPhotos(task) {
  try {
    const data = await api.getTaskPhotos(task.taskToken);
    if (store.get().selectedToken !== task.taskToken) return;
    store.set({
      selectedPhotos: data.photos || [],
      photosLoading: false
    });
  } catch (error) {
    if (store.get().selectedToken !== task.taskToken) return;
    store.set({ selectedPhotos: [], photosLoading: false });
    setNotice(formatError(error), 'error');
  }
}

async function openPhoto(photoToken) {
  const task = store.get().selectedTask;
  if (!task || store.get().photoBusy) return;
  if (photoCache.has(photoToken)) {
    showPhoto(photoCache.get(photoToken));
    return;
  }
  store.set({ photoBusy: true });
  const startedAt = performance.now();
  try {
    const data = await api.getTaskPhoto(task.taskToken, photoToken);
    const dataUrl = `data:${data.mimeType || 'image/jpeg'};base64,${data.base64}`;
    photoCache.set(photoToken, dataUrl);
    store.set({ photoBusy: false });
    recordMetric('photo_load', startedAt);
    showPhoto(dataUrl);
  } catch (error) {
    store.set({ photoBusy: false });
    setNotice(formatError(error), 'error');
  }
}

function showPhoto(dataUrl) {
  el.photoViewerBody.innerHTML = `<img src="${escapeHtml(dataUrl)}" alt="Фото задания">`;
  el.photoViewer.hidden = false;
}

function closePhoto() {
  el.photoViewer.hidden = true;
  el.photoViewerBody.innerHTML = '';
}

function openProfile() {
  el.employeeInput.value = store.get().employeeId || '';
  el.profileModal.hidden = false;
  window.setTimeout(() => el.employeeInput.focus(), 20);
}

function closeProfile() {
  el.profileModal.hidden = true;
}

function updateFilters(patch) {
  if (store.get().catalogComplete) {
    applyLocalCatalog({ ...patch, visibleLimit: PAGE_SIZE }, { resetLimit: true });
    return;
  }
  store.set({ ...patch, page: 1, tasks: [] });
  loadCatalog();
}

function formatError(error) {
  if (error instanceof ApiError) {
    return `${error.message}${error.requestId ? ` Код запроса: ${error.requestId}` : ''}`;
  }
  return error?.message || 'Неизвестная ошибка.';
}

el.blockGrid.addEventListener('click', (event) => {
  const button = event.target.closest('[data-zone]');
  if (!button) return;
  updateFilters({ zone: button.dataset.zone || '', floor: '' });
});
el.floorGrid.addEventListener('click', (event) => {
  const button = event.target.closest('[data-floor]');
  if (!button) return;
  updateFilters({ floor: button.dataset.floor || '' });
});
el.myTasksButton.addEventListener('click', () => {
  if (!store.get().employeeId) {
    openProfile();
    return;
  }
  updateFilters({ myOnly: !store.get().myOnly });
});
el.photoFilterButton.addEventListener('click', () => {
  updateFilters({ photoOnly: !store.get().photoOnly });
});
el.searchInput.addEventListener('input', () => {
  const query = el.searchInput.value;
  saveQuery(query);
  store.set({ query });
  clearTimeout(searchTimer);
  searchTimer = window.setTimeout(() => updateFilters({ query }), 350);
});
el.taskList.addEventListener('click', (event) => {
  const card = event.target.closest('[data-task-token]');
  if (!card) return;
  const task = store.get().tasks.find((item) => item.taskToken === card.dataset.taskToken);
  if (task) selectTask(task);
});
el.photoList.addEventListener('click', (event) => {
  const button = event.target.closest('[data-photo-token]');
  if (button) openPhoto(button.dataset.photoToken);
});
el.loadMoreButton.addEventListener('click', () => loadCatalog({ append: true }));
el.refreshButton.addEventListener('click', () => loadCatalog({ fresh: true }));
el.closeDetailButton.addEventListener('click', clearSelection);
el.detailBackdrop.addEventListener('click', clearSelection);
el.employeeButton.addEventListener('click', openProfile);
el.cancelProfileButton.addEventListener('click', closeProfile);
el.profileForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const employeeId = el.employeeInput.value.trim().toUpperCase();
  saveEmployeeId(employeeId);
  store.set({ employeeId });
  closeProfile();
  if (store.get().myOnly) updateFilters({ employeeId });
});
el.photoViewerClose.addEventListener('click', closePhoto);
el.photoViewer.addEventListener('click', (event) => {
  if (event.target === el.photoViewer) closePhoto();
});
window.addEventListener('online', () => {
  store.set({ offline: false });
  loadCatalog();
});
window.addEventListener('offline', () => {
  store.set({ offline: true });
  setNotice('Соединение потеряно. Фильтры и ID сохранены.', 'error');
});
window.addEventListener('resize', () => renderDetail(store.get()));
document.addEventListener('visibilitychange', scheduleRefresh);

store.subscribe(render);
render(store.get());
loadCatalog();
}
