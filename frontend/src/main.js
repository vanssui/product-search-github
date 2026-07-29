import './styles/app.css';
import { ApiClient, ApiError } from './api.js';
import { createStore, saveEmployeeId, saveQuery } from './state.js';
import { formatRoute, formatTime, matchesTask, splitWbStickers } from './utils.js';

const api = new ApiClient(import.meta.env.VITE_BACKEND_URL);
const PAGE_SIZE = 60;
const SNAPSHOT_PAGE_SIZE = 100;
const store = createStore({
  allTasks: [],
  catalogComplete: false,
  blocks: [],
  floors: [],
  zone: '',
  floor: '',
  photoOnly: false,
  myOnly: false,
  filteredCount: 0,
  totalActive: 0,
  photoCount: 0,
  page: 1,
  pageCount: 1,
  hasMore: false,
  visibleLimit: PAGE_SIZE,
  selectedToken: sessionStorage.getItem('product_search_selected_task') || '',
  photoBusy: false
});

let refreshTimer = 0;
let searchTimer = 0;
let requestSequence = 0;
const photoCache = new Map();
const metrics = [];
globalThis.__PRODUCT_SEARCH_METRICS__ = metrics;

const app = document.querySelector('#app');
app.innerHTML = `
  <div class="appShell">
    <header class="appHeader">
      <div>
        <p class="brand">Поиск товаров</p>
        <h1>Активные задания</h1>
      </div>
      <div class="headerActions">
        <span class="connection" id="connection">Подключение…</span>
        <button class="employeeButton" id="employeeButton" type="button">Указать ID</button>
        <button class="iconButton" id="refreshButton" type="button" aria-label="Обновить">↻</button>
      </div>
    </header>

    <section class="filterPanel" aria-label="Фильтры заданий">
      <label class="searchBox">
        <span aria-hidden="true">⌕</span>
        <input id="searchInput" type="search" autocomplete="off"
          placeholder="WB-стикер, товар, MX или BOX">
      </label>

      <div class="blockGrid" id="blockGrid"></div>

      <div class="quickFilters">
        <button class="filterButton" id="myTasksButton" type="button">Мои задания</button>
        <button class="filterButton" id="photoFilterButton" type="button">С фото</button>
      </div>

      <div class="floorSection">
        <div class="sectionLabel">Этаж</div>
        <div class="floorGrid" id="floorGrid"></div>
      </div>
    </section>

    <section class="summaryBar">
      <div><strong id="filteredMetric">0</strong><span>в фильтре</span></div>
      <div><strong id="totalMetric">0</strong><span>в поиске</span></div>
      <div><strong id="floorMetric">0</strong><span>этажей</span></div>
      <div><strong id="photoMetric">0</strong><span>с фото</span></div>
      <p id="updatedText">Загрузка данных…</p>
    </section>

    <div class="workspace">
      <main class="catalogPane">
        <div id="notice"></div>
        <div class="catalogHeading">
          <div>
            <p class="sectionLabel" id="catalogEyebrow">Все блоки</p>
            <h2 id="catalogTitle">Задания</h2>
          </div>
          <span class="readOnlyBadge">Только чтение</span>
        </div>
        <div class="taskList" id="taskList" aria-live="polite"></div>
        <button class="loadMoreButton" id="loadMoreButton" type="button" hidden>
          Показать ещё
        </button>
      </main>

      <aside class="detailPane" id="detailPane" aria-label="Детали задания">
        <div class="detailEmpty" id="detailEmpty">
          <div class="emptyIcon">↗</div>
          <h2>Выберите задание</h2>
          <p>Карточка откроется здесь. На телефоне — отдельным удобным экраном.</p>
        </div>
        <article class="taskDetail" id="taskDetail" hidden>
          <header class="detailHeader">
            <div>
              <p class="sectionLabel" id="detailSource"></p>
              <h2 id="detailSticker"></h2>
            </div>
            <button class="iconButton" id="closeDetailButton" type="button" aria-label="Закрыть">×</button>
          </header>
          <h3 id="detailName"></h3>
          <div class="detailBadges" id="detailBadges"></div>
          <div class="mxHero">
            <span>MX</span>
            <strong id="detailMx"></strong>
            <small id="detailRoute"></small>
          </div>
          <dl class="detailGrid" id="detailGrid"></dl>
          <section class="photoPanel">
            <div class="photoHeader">
              <div><span>Фото задания</span><strong id="photoCountLabel">0</strong></div>
              <span>Загружаются только по нажатию</span>
            </div>
            <div class="photoList" id="photoList"></div>
          </section>
          <div class="readOnlyNotice">
            Данные подключены к production в безопасном режиме чтения.
            Операции записи будут включены только после отдельной проверки.
          </div>
          <div class="actionGrid">
            <button class="primaryAction" type="button" disabled>Взять</button>
            <button type="button" disabled>Освободить</button>
            <button type="button" disabled>Добавить фото</button>
            <button class="successAction" type="button" disabled>Найдено</button>
            <button class="dangerAction" type="button" disabled>Не найдено</button>
            <button class="primaryAction wide" type="button" disabled>Завершить</button>
          </div>
        </article>
      </aside>
    </div>
  </div>

  <div class="detailBackdrop" id="detailBackdrop" hidden></div>

  <div class="profileModal" id="profileModal" hidden>
    <form class="profileCard" id="profileForm">
      <p class="sectionLabel">Исполнитель</p>
      <h2>Укажите ID</h2>
      <p>ID нужен для фильтра «Мои задания» и будет использован после включения рабочих действий.</p>
      <label>ID сотрудника
        <input id="employeeInput" maxlength="64" autocomplete="username" placeholder="Например E017">
      </label>
      <div class="profileActions">
        <button type="button" id="cancelProfileButton">Отмена</button>
        <button class="primaryAction" type="submit">Сохранить</button>
      </div>
    </form>
  </div>

  <div class="photoViewer" id="photoViewer" hidden>
    <button class="photoViewerClose" id="photoViewerClose" type="button" aria-label="Закрыть">×</button>
    <div class="photoViewerBody" id="photoViewerBody"></div>
  </div>
`;

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
const el = Object.fromEntries(ids.map((id) => [id, document.getElementById(id)]));

el.searchInput.value = store.get().query;

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  })[character]);
}

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

function catalogParams(state, page) {
  return {
    zone: state.zone,
    floor: state.floor,
    query: state.query,
    photoOnly: state.photoOnly,
    myOnly: state.myOnly,
    employeeId: state.employeeId,
    page,
    pageSize: PAGE_SIZE
  };
}

function applyLocalCatalog(patch = {}, { resetLimit = true } = {}) {
  const current = { ...store.get(), ...patch };
  if (!current.catalogComplete) return false;

  const employeeId = String(current.employeeId || '').trim().toUpperCase();
  const baseTasks = current.allTasks.filter((task) => {
    if (current.photoOnly && !task.hasPhoto) return false;
    if (current.myOnly &&
        String(task.employeeId || '').trim().toUpperCase() !== employeeId) return false;
    return matchesTask(task, current.query);
  });

  const blockCounts = new Map();
  baseTasks.forEach((task) => {
    const zone = String(task.zone || '').trim();
    if (zone) blockCounts.set(zone, (blockCounts.get(zone) || 0) + 1);
  });
  const blocks = [...blockCounts.entries()]
    .sort(([left], [right]) => left.localeCompare(right, 'ru', { numeric: true }))
    .map(([id, count]) => ({ id, label: id, count }));

  const zoneTasks = current.zone
    ? baseTasks.filter((task) => task.zone === current.zone)
    : baseTasks;
  const floorCounts = new Map();
  zoneTasks.forEach((task) => {
    const floor = String(task.floor || '').trim() || 'Без этажа';
    floorCounts.set(floor, (floorCounts.get(floor) || 0) + 1);
  });
  const floors = [...floorCounts.entries()]
    .sort(([left], [right]) => left.localeCompare(right, 'ru', { numeric: true }))
    .map(([id, count]) => ({ id, label: id, count }));

  const matching = current.floor
    ? zoneTasks.filter((task) =>
      (String(task.floor || '').trim() || 'Без этажа') === current.floor)
    : zoneTasks;
  const visibleLimit = resetLimit ? PAGE_SIZE : (current.visibleLimit || PAGE_SIZE);
  const tasks = matching.slice(0, visibleLimit);

  store.set({
    ...patch,
    tasks,
    blocks,
    floors,
    filteredCount: matching.length,
    totalActive: current.allTasks.length,
    photoCount: matching.filter((task) => task.hasPhoto).length,
    page: Math.max(1, Math.ceil(tasks.length / PAGE_SIZE)),
    pageCount: Math.max(1, Math.ceil(matching.length / PAGE_SIZE)),
    hasMore: tasks.length < matching.length,
    visibleLimit,
    loading: false
  });
  return true;
}

async function loadCatalog({ append = false, silent = false } = {}) {
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
    const parameters = append
      ? catalogParams(state, page)
      : { page: 1, pageSize: SNAPSHOT_PAGE_SIZE };
    const data = await api.get('getCatalog', parameters);
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
    const task = await api.get('getTask', { taskToken: token });
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
  }, document.hidden ? 300000 : 150000);
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
  const allCount = state.blocks.reduce((sum, block) => sum + block.count, 0);
  const blocks = [{ id: '', label: 'Все', count: allCount }, ...state.blocks];
  el.blockGrid.innerHTML = blocks.map((block) => `
    <button class="blockButton ${state.zone === block.id ? 'active' : ''}"
      data-zone="${escapeHtml(block.id)}" type="button">
      <strong>${escapeHtml(block.label)}</strong>
      <span>${block.count}</span>
    </button>
  `).join('');
  el.myTasksButton.classList.toggle('active', state.myOnly);
  el.photoFilterButton.classList.toggle('active', state.photoOnly);
}

function renderFloors(state) {
  const allCount = state.floors.reduce((sum, floor) => sum + floor.count, 0);
  const floors = [{ id: '', label: 'Все', count: allCount }, ...state.floors];
  el.floorGrid.innerHTML = floors.map((floor) => `
    <button class="floorButton ${state.floor === floor.id ? 'active' : ''}"
      data-floor="${escapeHtml(floor.id)}" type="button">
      <strong>${escapeHtml(floor.id ? (floor.label === 'Без этажа' ? floor.label : `Этаж ${floor.label}`) : 'Все')}</strong>
      <span>${floor.count}</span>
    </button>
  `).join('');
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

  el.taskList.innerHTML = state.tasks.map((task, index) => {
    const stickers = splitWbStickers(task.wbSticker);
    const mainSticker = stickers[0] || task.wbSticker || '—';
    return `
      <button class="taskCard ${state.selectedToken === task.taskToken ? 'selected' : ''}"
        data-task-token="${escapeHtml(task.taskToken)}" type="button">
        <div class="cardHeader">
          <div>
            <span class="cardLabel">WB-стикер</span>
            <strong class="wbSticker">${escapeHtml(mainSticker)}</strong>
          </div>
          <span class="zoneBadge">${escapeHtml(task.zone || '—')}</span>
        </div>
        <div class="cardMx">
          <span>MX</span>
          <strong>${escapeHtml(task.mx || '—')}</strong>
        </div>
        <h3>${escapeHtml(task.itemName || 'Без наименования')}</h3>
        <div class="routeLine">${escapeHtml(formatRoute(task))}</div>
        <div class="cardFacts">
          ${task.itemId ? `<span>ID ${escapeHtml(task.itemId)}</span>` : ''}
          ${task.box ? `<span>BOX ${escapeHtml(task.box)}</span>` : ''}
          ${task.timeFilled ? `<span>${escapeHtml(task.timeFilled)}</span>` : ''}
          <span>${escapeHtml(task.statusSearch || 'Поиск')}</span>
          ${task.photoCount ? `<span class="photoFact">Фото ${task.photoCount}</span>` : ''}
        </div>
        <div class="routeIndex">Маршрут ${index + 1 + ((state.page - 1) * 0)} из ${state.filteredCount}</div>
      </button>
    `;
  }).join('');

  el.loadMoreButton.hidden = !state.hasMore;
  el.loadMoreButton.disabled = state.loading;
  el.loadMoreButton.textContent = state.loading ? 'Загрузка…' : 'Показать ещё';
}

function renderDetail(state) {
  const task = state.selectedTask;
  el.detailEmpty.hidden = Boolean(task);
  el.taskDetail.hidden = !task;
  el.detailBackdrop.hidden = !task || window.innerWidth >= 900;
  document.documentElement.classList.toggle('detailOpen', Boolean(task));
  if (!task) return;

  el.detailSource.textContent = task.sourceLabel || task.zone || 'Задание';
  el.detailSticker.textContent = splitWbStickers(task.wbSticker)[0] || task.wbSticker || '—';
  el.detailName.textContent = task.itemName || 'Без наименования';
  el.detailMx.textContent = task.mx || '—';
  el.detailRoute.textContent = formatRoute(task);
  el.detailBadges.innerHTML = [
    task.zone && `<span class="zoneBadge">${escapeHtml(task.zone)}</span>`,
    task.statusSearch && `<span>${escapeHtml(task.statusSearch)}</span>`,
    task.itemStatus && `<span>${escapeHtml(task.itemStatus)}</span>`,
    task.photoCount && `<span class="photoFact">Фото ${task.photoCount}</span>`
  ].filter(Boolean).join('');

  const details = [
    ['WB-стикер', task.wbSticker],
    ['Товар / ID', task.itemId],
    ['BOX', task.box],
    ['Этаж', task.floor],
    ['Ряд', task.row],
    ['Место', task.place],
    ['Полка', task.shelf],
    ['Ячейка', task.cell],
    ['Время', task.timeFilled],
    ['ID сотрудника', task.employeeId || 'Свободно'],
    ['ID сборщика', task.pickerId],
    ['Действие', task.action],
    ['Комментарий', task.comment],
    ['Дата выгрузки', task.createdAt]
  ];
  el.detailGrid.innerHTML = details.map(([label, value]) => `
    <div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value || '—')}</dd></div>
  `).join('');

  el.photoCountLabel.textContent = task.photoCount || 0;
  renderPhotos(task, state.photoBusy);
}

function renderPhotos(task, busy) {
  const ids = task.photoFileIds || [];
  if (!ids.length) {
    el.photoList.innerHTML = '<div class="photoEmpty">Фото пока не добавлено</div>';
    return;
  }
  el.photoList.innerHTML = ids.map((fileId, index) => {
    const dataUrl = photoCache.get(fileId);
    if (dataUrl) {
      return `<button class="photoThumb" data-file-id="${escapeHtml(fileId)}" type="button">
        <img src="${escapeHtml(dataUrl)}" alt="Фото ${index + 1}">
      </button>`;
    }
    return `<button class="photoPlaceholder" data-file-id="${escapeHtml(fileId)}"
      type="button" ${busy ? 'disabled' : ''}>Открыть фото ${index + 1}</button>`;
  }).join('');
}

function selectTask(task, { persist = true } = {}) {
  const startedAt = performance.now();
  if (persist) sessionStorage.setItem('product_search_selected_task', task.taskToken);
  store.set({ selectedTask: task, selectedToken: task.taskToken });
  recordMetric('open_task', startedAt, { taskToken: task.taskToken.slice(0, 8) });
}

function clearSelection() {
  sessionStorage.removeItem('product_search_selected_task');
  store.set({ selectedTask: null, selectedToken: '' });
}

async function openPhoto(fileId) {
  const task = store.get().selectedTask;
  if (!task || store.get().photoBusy) return;
  if (photoCache.has(fileId)) {
    showPhoto(photoCache.get(fileId));
    return;
  }
  store.set({ photoBusy: true });
  const startedAt = performance.now();
  try {
    const data = await api.get('getTaskPhoto', {
      taskToken: task.taskToken,
      fileId
    });
    const dataUrl = `data:${data.mimeType || 'image/jpeg'};base64,${data.base64}`;
    photoCache.set(fileId, dataUrl);
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
  const button = event.target.closest('[data-file-id]');
  if (button) openPhoto(button.dataset.fileId);
});
el.loadMoreButton.addEventListener('click', () => loadCatalog({ append: true }));
el.refreshButton.addEventListener('click', () => loadCatalog());
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
