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
import {
  buildIdStats,
  buildReportStats,
  buildReportText,
  extractIdsForStats,
  parseReportRows,
  pluralTimes
} from '../utils/report.js';
import '../types/contracts.js';

const api = createProductSearchApi(APP_CONFIG.backendUrl);
const { pageSize: PAGE_SIZE, snapshotPageSize: SNAPSHOT_PAGE_SIZE } = APP_CONFIG;
const store = createCatalogStore();

let refreshTimer = 0;
let searchTimer = 0;
let requestSequence = 0;
let profileRequired = false;
let idStatsMode = 'all';
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
  'connection', 'reportButton', 'idStatsButton', 'employeeButton', 'refreshButton',
  'searchInput', 'blockGrid',
  'myTasksButton', 'photoFilterButton', 'floorGrid', 'filteredMetric',
  'totalMetric', 'floorMetric', 'photoMetric', 'updatedText', 'notice',
  'catalogEyebrow', 'catalogTitle', 'modeBadge', 'taskList', 'loadMoreButton', 'detailPane',
  'detailEmpty', 'taskDetail', 'detailSource', 'detailSticker', 'detailName',
  'detailBadges', 'detailMx', 'detailRoute', 'detailGrid', 'photoCountLabel',
  'pastePhotoButton', 'galleryPhotoButton', 'cameraPhotoButton', 'galleryPhotoInput',
  'cameraPhotoInput', 'photoStatus', 'photoList', 'detailMessage', 'foundButton',
  'notFoundButton', 'closeDetailButton', 'detailBackdrop', 'profileModal',
  'profileForm', 'employeeInput', 'profileMessage', 'cancelProfileButton',
  'photoViewer', 'photoViewerClose', 'photoViewerBody', 'reportModal',
  'reportTitle', 'reportCloseButton', 'reportInput', 'reportClearButton',
  'reportCopyButton', 'reportCalculateButton', 'reportMessage', 'reportOutput',
  'idStatsModal', 'idStatsTitle', 'idStatsCloseButton', 'idStatsModes',
  'idStatsInput', 'idStatsClearButton', 'idStatsCopyButton',
  'idStatsCalculateButton', 'idStatsMessage', 'idStatsSummary',
  'idStatsOutput', 'loadingOverlay', 'loadingText', 'toastStack'
];
const el = Object.fromEntries(ids.map((id) => [id, app.ownerDocument.getElementById(id)]));

el.searchInput.value = store.get().query;

function setNotice(text = '', tone = '') {
  el.notice.innerHTML = text
    ? `<div class="notice ${tone}">${escapeHtml(text)}</div>`
    : '';
}

function showLoading(text = 'Загрузка…') {
  el.loadingText.textContent = text;
  el.loadingOverlay.hidden = false;
}

function hideLoading() {
  el.loadingOverlay.hidden = true;
}

function showToast(text, tone = '') {
  if (!text) return;
  const toast = document.createElement('div');
  toast.className = `toast ${tone}`.trim();
  toast.textContent = text;
  el.toastStack.appendChild(toast);
  window.setTimeout(() => toast.remove(), 3600);
}

function newIdempotencyKey(action, taskToken) {
  const unique = globalThis.crypto?.randomUUID
    ? globalThis.crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${action}:${String(taskToken || '').slice(0, 12)}:${unique}`;
}

async function loadCapabilities() {
  try {
    const data = await api.getCapabilities();
    store.set({
      capabilities: {
        updateTask: Boolean(data?.write?.updateTask),
        uploadTaskPhoto: Boolean(data?.write?.uploadTaskPhoto)
      }
    });
  } catch (error) {
    store.set({
      capabilities: {
        updateTask: false,
        uploadTaskPhoto: false
      }
    });
    setNotice(formatError(error), 'error');
  }
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
  if (state.offline || (append && state.loading)) return;
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
    : state.saving
      ? 'Сохраняю результат…'
      : state.uploadBusy
        ? 'Загружаю фото…'
    : state.loading
      ? 'Обновление…'
      : state.capabilities.updateTask
        ? 'Production • рабочий режим'
        : 'Production • чтение';
  el.connection.classList.toggle('offline', state.offline);
  el.employeeButton.textContent = state.employeeId || 'Указать ID';
  el.refreshButton.disabled =
    state.loading || state.saving || state.uploadBusy || state.offline;
  el.searchInput.disabled = state.loading && !state.tasks.length;
  el.modeBadge.textContent = state.capabilities.updateTask
    ? 'Рабочий режим'
    : 'Только чтение';
  el.foundButton.disabled =
    !state.selectedTask ||
    !state.capabilities.updateTask ||
    state.saving ||
    state.uploadBusy ||
    state.offline;
  el.notFoundButton.disabled = el.foundButton.disabled;
  const photoDisabled =
    !state.selectedTask ||
    !state.capabilities.uploadTaskPhoto ||
    state.saving ||
    state.uploadBusy ||
    state.offline;
  el.pastePhotoButton.disabled = photoDisabled;
  el.galleryPhotoButton.disabled = photoDisabled;
  el.cameraPhotoButton.disabled = photoDisabled;

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
  el.foundButton.textContent = state.saving ? 'Сохраняю…' : 'Найдено';
  el.notFoundButton.textContent = state.saving ? 'Сохраняю…' : 'Не найдено';
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
  el.detailMessage.textContent = '';
  el.detailMessage.className = 'detailMessage';
  el.photoStatus.textContent = '';
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

function openProfile({ required = false } = {}) {
  profileRequired = required;
  el.employeeInput.value = store.get().employeeId || '';
  el.profileMessage.textContent = required
    ? 'Без ID нельзя открыть рабочий каталог.'
    : '';
  el.profileMessage.className = 'profileMessage';
  el.cancelProfileButton.hidden = required;
  el.profileModal.hidden = false;
  window.setTimeout(() => el.employeeInput.focus(), 20);
}

function closeProfile() {
  if (profileRequired && !store.get().employeeId) return;
  profileRequired = false;
  el.profileModal.hidden = true;
}

function selectFirstVisibleTask() {
  const first = store.get().tasks[0];
  if (first) selectTask(first);
  else clearSelection();
}

function removeClosedTask(taskToken) {
  const state = store.get();
  if (state.catalogComplete) {
    store.set({
      allTasks: state.allTasks.filter((task) => task.taskToken !== taskToken)
    });
    applyLocalCatalog({}, { resetLimit: false });
  } else {
    store.set({
      tasks: state.tasks.filter((task) => task.taskToken !== taskToken),
      filteredCount: Math.max(0, state.filteredCount - 1),
      totalActive: Math.max(0, state.totalActive - 1)
    });
  }
  selectFirstVisibleTask();
}

async function closeTask(newStatus) {
  const state = store.get();
  const task = state.selectedTask;
  if (!task || state.saving) return;
  if (!state.employeeId) {
    openProfile({ required: true });
    return;
  }
  if (!state.capabilities.updateTask) {
    const message = 'Запись результата пока не включена на backend.';
    el.detailMessage.textContent = message;
    el.detailMessage.className = 'detailMessage error';
    showToast(message, 'error');
    return;
  }

  const startedAt = performance.now();
  store.set({ saving: true });
  el.detailMessage.textContent = '';
  el.detailMessage.className = 'detailMessage';
  showLoading(`Сохраняю «${newStatus}»…`);
  try {
    const result = await api.updateTask({
      taskToken: task.taskToken,
      newStatus,
      employeeId: state.employeeId,
      sessionId: state.sessionId,
      idempotencyKey: newIdempotencyKey('updateTask', task.taskToken)
    }, {
      onUncertain: () => {
        showLoading('Ответ задерживается. Проверяю результат…');
        el.detailMessage.textContent =
          'Сервер уже мог сохранить результат. Проверяю операцию без повторной записи…';
      }
    });
    store.set({ saving: false });
    hideLoading();
    const message = result?.message || `Статус обновлён: ${newStatus}.`;
    removeClosedTask(task.taskToken);
    showToast(message, 'success');
    recordMetric('update_task', startedAt, {
      status: newStatus,
      alreadyClosed: Boolean(result?.alreadyClosed)
    });
    loadCatalog({ silent: true, fresh: true });
  } catch (error) {
    store.set({ saving: false });
    hideLoading();
    const message = formatError(error);
    el.detailMessage.textContent = message;
    el.detailMessage.className = 'detailMessage error';
    showToast(message, 'error');
    recordMetric('update_task_error', startedAt, {
      status: newStatus,
      code: error?.code || 'ERROR'
    });
  }
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Не удалось прочитать изображение.'));
    reader.readAsDataURL(file);
  });
}

function loadImage(dataUrl) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Не удалось открыть изображение.'));
    image.src = dataUrl;
  });
}

async function compressImage(file) {
  const image = await loadImage(await readFileAsDataUrl(file));
  const maxSide = 1600;
  const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.getContext('2d').drawImage(image, 0, 0, width, height);
  return canvas.toDataURL('image/jpeg', 0.78);
}

async function uploadPhoto(file) {
  const state = store.get();
  const task = state.selectedTask;
  if (!file || !task || state.uploadBusy) return;
  if (!file.type?.startsWith('image/')) {
    showToast('Выберите изображение.', 'error');
    return;
  }
  if (!state.employeeId) {
    openProfile({ required: true });
    return;
  }
  if (!state.capabilities.uploadTaskPhoto) {
    showToast('Загрузка фото пока не включена на backend.', 'error');
    return;
  }

  const startedAt = performance.now();
  store.set({ uploadBusy: true });
  el.photoStatus.textContent = 'Подготавливаю изображение…';
  showLoading('Подготавливаю изображение…');
  try {
    const dataUrl = await compressImage(file);
    el.photoStatus.textContent = 'Загружаю фото…';
    showLoading('Загружаю фото…');
    const result = await api.uploadTaskPhoto({
      taskToken: task.taskToken,
      employeeId: state.employeeId,
      sessionId: state.sessionId,
      idempotencyKey: newIdempotencyKey('uploadTaskPhoto', task.taskToken),
      dataUrl,
      fileName: file.name || `task-${Date.now()}.jpg`,
      mimeType: 'image/jpeg'
    }, {
      onUncertain: () => {
        el.photoStatus.textContent = 'Ответ задерживается. Проверяю результат…';
        showLoading('Проверяю результат загрузки…');
      }
    });
    const freshTask = await api.getTask(task.taskToken);
    store.set({ uploadBusy: false });
    hideLoading();
    selectTask(freshTask, { persist: false });
    showToast(result?.message || 'Фото загружено.', 'success');
    recordMetric('photo_upload', startedAt);
    loadCatalog({ silent: true, fresh: true });
  } catch (error) {
    store.set({ uploadBusy: false });
    hideLoading();
    const message = formatError(error);
    el.photoStatus.textContent = message;
    showToast(message, 'error');
    recordMetric('photo_upload_error', startedAt, {
      code: error?.code || 'ERROR'
    });
  } finally {
    el.galleryPhotoInput.value = '';
    el.cameraPhotoInput.value = '';
  }
}

async function pastePhotoFromClipboard() {
  try {
    if (!navigator.clipboard?.read) {
      throw new Error('Вставьте изображение сочетанием клавиш Ctrl/Cmd+V.');
    }
    const items = await navigator.clipboard.read();
    for (const item of items) {
      const imageType = item.types.find((type) => type.startsWith('image/'));
      if (!imageType) continue;
      const blob = await item.getType(imageType);
      await uploadPhoto(new File([blob], `clipboard-${Date.now()}.png`, {
        type: imageType
      }));
      return;
    }
    throw new Error('В буфере обмена нет изображения.');
  } catch (error) {
    showToast(error?.message || 'Не удалось вставить изображение.', 'error');
  }
}

function handleDocumentPaste(event) {
  if (!store.get().selectedTask || store.get().uploadBusy) return;
  const item = [...(event.clipboardData?.items || [])]
    .find((entry) => entry.type.startsWith('image/'));
  const file = item?.getAsFile();
  if (file) {
    event.preventDefault();
    uploadPhoto(file);
  }
}

function openUtilityModal(modal) {
  if (modal === el.reportModal) {
    el.reportTitle.textContent = `Отчёт ${store.get().zone || 'выбранному блоку'}`;
  }
  modal.hidden = false;
  document.documentElement.classList.add('utilityOpen');
  const input = modal.querySelector('textarea');
  window.setTimeout(() => input?.focus(), 40);
}

function closeUtilityModal(modal) {
  modal.hidden = true;
  if (el.reportModal.hidden && el.idStatsModal.hidden) {
    document.documentElement.classList.remove('utilityOpen');
  }
}

async function copyText(text) {
  const value = String(text || '');
  if (!value) throw new Error('Нет данных для копирования.');
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }
  const textarea = document.createElement('textarea');
  textarea.value = value;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand('copy');
  textarea.remove();
  if (!copied) throw new Error('Не удалось скопировать результат.');
}

function calculateReport() {
  const rows = parseReportRows(el.reportInput.value);
  if (!rows.length) {
    el.reportMessage.textContent = 'Вставьте строки из таблицы.';
    el.reportMessage.className = 'utilityMessage error';
    el.reportOutput.textContent = '';
    return;
  }
  el.reportOutput.textContent = buildReportText(buildReportStats(rows));
  el.reportMessage.textContent = `Отчёт посчитан: ${rows.length} строк.`;
  el.reportMessage.className = 'utilityMessage success';
}

function calculateIdStats() {
  const ids = extractIdsForStats(el.idStatsInput.value, idStatsMode);
  if (!ids.length) {
    el.idStatsMessage.textContent =
      'Не нашёл ID 5–8 цифр. Проверьте вставленный список.';
    el.idStatsMessage.className = 'utilityMessage error';
    el.idStatsSummary.innerHTML = '';
    el.idStatsOutput.innerHTML = '';
    el.idStatsOutput.dataset.copyText = '';
    return;
  }
  const stats = buildIdStats(ids);
  el.idStatsSummary.innerHTML =
    `<div><b>${ids.length}</b><span>строк</span></div>` +
    `<div><b>${stats.unique}</b><span>уникальных ID</span></div>`;
  const max = stats.rows[0]?.count || 1;
  el.idStatsOutput.innerHTML = stats.rows.map((row) => {
    const width = Math.max(6, Math.round((row.count / max) * 100));
    return `<div class="idStatsRow">` +
      `<div class="idStatsRowTop"><strong>${escapeHtml(row.id)}</strong>` +
      `<span>${row.count} ${pluralTimes(row.count)}</span></div>` +
      `<div class="idStatsBar"><i style="width:${width}%"></i></div></div>`;
  }).join('');
  el.idStatsMessage.textContent =
    `Посчитано ID: ${ids.length}, уникальных: ${stats.unique}.`;
  el.idStatsMessage.className = 'utilityMessage success';
  el.idStatsOutput.dataset.copyText = stats.text;
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
el.taskList.addEventListener('click', async (event) => {
  const card = event.target.closest('[data-task-token]');
  if (!card) return;
  const token = card.dataset.taskToken;
  const task = store.get().tasks.find((item) => item.taskToken === token);
  if (task) {
    selectTask(task);
    return;
  }
  try {
    selectTask(await api.getTask(token));
  } catch (error) {
    setNotice(formatError(error), 'error');
  }
});
el.photoList.addEventListener('click', (event) => {
  const button = event.target.closest('[data-photo-token]');
  if (button) openPhoto(button.dataset.photoToken);
});
el.loadMoreButton.addEventListener('click', () => loadCatalog({ append: true }));
el.refreshButton.addEventListener('click', () => loadCatalog({ fresh: true }));
el.closeDetailButton.addEventListener('click', clearSelection);
el.detailBackdrop.addEventListener('click', clearSelection);
el.employeeButton.addEventListener('click', () => openProfile());
el.cancelProfileButton.addEventListener('click', closeProfile);
el.profileForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const employeeId = el.employeeInput.value.trim().toUpperCase();
  if (!employeeId) {
    el.profileMessage.textContent = 'Введите ID сотрудника.';
    el.profileMessage.className = 'profileMessage error';
    return;
  }
  const firstLogin = !store.get().employeeId;
  saveEmployeeId(employeeId);
  store.set({ employeeId });
  closeProfile();
  if (firstLogin) {
    loadCapabilities();
    loadCatalog();
  } else if (store.get().myOnly) {
    updateFilters({ employeeId });
  }
});
el.foundButton.addEventListener('click', () => closeTask('Найдено'));
el.notFoundButton.addEventListener('click', () => closeTask('Не найдено'));
el.pastePhotoButton.addEventListener('click', pastePhotoFromClipboard);
el.galleryPhotoButton.addEventListener('click', () => el.galleryPhotoInput.click());
el.cameraPhotoButton.addEventListener('click', () => el.cameraPhotoInput.click());
el.galleryPhotoInput.addEventListener('change', () => uploadPhoto(el.galleryPhotoInput.files?.[0]));
el.cameraPhotoInput.addEventListener('change', () => uploadPhoto(el.cameraPhotoInput.files?.[0]));
document.addEventListener('paste', handleDocumentPaste);
el.photoViewerClose.addEventListener('click', closePhoto);
el.photoViewer.addEventListener('click', (event) => {
  if (event.target === el.photoViewer) closePhoto();
});
el.reportButton.addEventListener('click', () => openUtilityModal(el.reportModal));
el.reportCloseButton.addEventListener('click', () => closeUtilityModal(el.reportModal));
el.reportModal.addEventListener('click', (event) => {
  if (event.target === el.reportModal) closeUtilityModal(el.reportModal);
});
el.reportCalculateButton.addEventListener('click', calculateReport);
el.reportClearButton.addEventListener('click', () => {
  el.reportInput.value = '';
  el.reportOutput.textContent = '';
  el.reportMessage.textContent = '';
});
el.reportCopyButton.addEventListener('click', async () => {
  try {
    await copyText(el.reportOutput.textContent);
    el.reportMessage.textContent = 'Отчёт скопирован.';
    el.reportMessage.className = 'utilityMessage success';
  } catch (error) {
    el.reportMessage.textContent = error.message;
    el.reportMessage.className = 'utilityMessage error';
  }
});
el.idStatsButton.addEventListener('click', () => openUtilityModal(el.idStatsModal));
el.idStatsCloseButton.addEventListener('click', () => closeUtilityModal(el.idStatsModal));
el.idStatsModal.addEventListener('click', (event) => {
  if (event.target === el.idStatsModal) closeUtilityModal(el.idStatsModal);
});
el.idStatsModes.addEventListener('click', (event) => {
  const button = event.target.closest('[data-id-mode]');
  if (!button) return;
  idStatsMode = button.dataset.idMode;
  [...el.idStatsModes.querySelectorAll('[data-id-mode]')].forEach((item) => {
    item.classList.toggle('active', item === button);
  });
});
el.idStatsCalculateButton.addEventListener('click', calculateIdStats);
el.idStatsClearButton.addEventListener('click', () => {
  el.idStatsInput.value = '';
  el.idStatsMessage.textContent = '';
  el.idStatsSummary.textContent = '';
  el.idStatsOutput.innerHTML = '';
  el.idStatsOutput.dataset.copyText = '';
});
el.idStatsCopyButton.addEventListener('click', async () => {
  try {
    await copyText(el.idStatsOutput.dataset.copyText);
    el.idStatsMessage.textContent = 'Статистика скопирована.';
    el.idStatsMessage.className = 'utilityMessage success';
  } catch (error) {
    el.idStatsMessage.textContent = error.message;
    el.idStatsMessage.className = 'utilityMessage error';
  }
});
window.addEventListener('online', () => {
  store.set({ offline: false });
  if (store.get().employeeId) {
    loadCapabilities();
    loadCatalog();
  }
});
window.addEventListener('offline', () => {
  store.set({ offline: true });
  setNotice('Соединение потеряно. Фильтры и ID сохранены.', 'error');
});
window.addEventListener('resize', () => renderDetail(store.get()));
document.addEventListener('visibilitychange', scheduleRefresh);

store.subscribe(render);
render(store.get());
if (store.get().employeeId) {
  loadCapabilities();
  loadCatalog();
} else {
  openProfile({ required: true });
}
}
