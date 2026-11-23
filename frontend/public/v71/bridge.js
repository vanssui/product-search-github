/**
 * GitHub Pages read-only bridge for the original v71 HtmlService UI.
 *
 * IMPORTANT: Apps Script's google.script.run exists only within HtmlService,
 * not on GitHub Pages. This bridge uses the *separate* historical API v1.
 * It never sends a POST: API v1 was developed for v51 and its write semantics
 * are NOT equivalent to v71 atomic M/U/AE/receipt writes.
 *
 * A real production write bridge requires a verified v71-compatible API;
 * silently forwarding to v1 would risk corrupting live warehouse data.
 */
(function () {
  'use strict';

  var API_URL = String(window.__V71_API_BASE_URL__ || '').trim();
  var MAX_PAGES = 40;
  var PAGE_SIZE = 800;
  var timeoutMs = 95000;
  var cachedTasks = [];
  var lastCatalogAt = 0;
  var catalogPromise = null;

  function fail(message) { throw new Error(message); }

  function checkConfigured() {
    if (!/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(API_URL)) {
      fail('GitHub-копия: API чтения не настроен. Основной Apps Script не изменялся.');
    }
  }

  async function readApi(action, input) {
    checkConfigured();
    var url = new URL(API_URL);
    url.searchParams.set('apiVersion', 'v1');
    url.searchParams.set('action', action);
    Object.entries(input || {}).forEach(function (entry) {
      if (entry[1] !== undefined && entry[1] !== null && entry[1] !== '') {
        url.searchParams.set(entry[0], String(entry[1]));
      }
    });
    var controller = new AbortController();
    var timer = setTimeout(function () { controller.abort(); }, timeoutMs);
    try {
      var res = await fetch(url.toString(), {
        method: 'GET', mode: 'cors', credentials: 'omit',
        cache: 'no-store', signal: controller.signal
      });
      if (!res.ok) fail('GitHub API: сервер вернул HTTP ' + res.status);
      var body = await res.json();
      if (!body || !body.ok) {
        fail('GitHub API: ' + String(body && body.error && body.error.message || 'некорректный ответ'));
      }
      return body.data;
    } catch (error) {
      if (error && error.name === 'AbortError') fail('Не получен ответ от старого GitHub API. Это отдельный Apps Script, не v71.');
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  function isActive(t) { return String(t.statusSearch || 'Поиск').trim().toLowerCase() === 'поиск'; }
  function syntheticSheetName(zone) {
    return zone === 'B3' ? 'Выгрузка Б3' : zone === 'B4' ? 'Выгрузка Б4' : 'Каталог ' + (zone || '');
  }

  function convertTask(task, index) {
    var t = Object.assign({}, task);
    var n = Math.max(0, Math.min(12, Number(task.photoCount) || 0));
    t.sheetName = syntheticSheetName(t.zone);
    // Synthetic identity used ONLY as a browser rendering key, never as
    // a physical spreadsheet row or in a write operation.
    t.rowNumber = index + 2;
    t.photoFileIds = Array.from({length: n}, function(_,i) {return 'github-preview-photo-' + i;});
    t.photoFileId = t.photoFileIds[0] || '';
    t.photoCount = Number(task.photoCount) || 0;
    t.hasPhoto = Boolean(task.hasPhoto || t.photoCount);
    return t;
  }

  function zoneStats(tasks) {
    var stats = {};
    tasks.forEach(function (t) {
      var zone = t.zone || 'UNKNOWN';
      var info = stats[zone] || (stats[zone] = {total: 0, floors: {}, photos: 0, sources: {}});
      info.total++;
      info.floors[String(t.floor || 'Без этажа')] = (info.floors[String(t.floor || 'Без этажа')] || 0) + 1;
      if (t.hasPhoto) info.photos++;
      info.sources[t.sheetName] = (info.sources[t.sheetName] || 0) + 1;
    });
    return stats;
  }

  async function loadCompleteCatalog() {
    var all = [], first = null, page = 1;
    for (; page <= MAX_PAGES; page++) {
      var result = await readApi('getCatalog', {page: page, pageSize: PAGE_SIZE});
      if (!result || !Array.isArray(result.tasks)) fail('GitHub API: недействительный каталог.');
      if (!first) first = result;
      all.push.apply(all, result.tasks);
      if (!result.hasMore) break;
      if (result.tasks.length === 0) fail('GitHub API: сервер не отдаёт следующие страницы.');
    }
    if (page > MAX_PAGES) fail('GitHub API: достигнут предел выгрузки каталога. Неполные данные не показываются.');
    if (all.length !== Number(first.filteredCount)) fail('GitHub API: каталог неполный. Сохранённые статусы не менялись.');
    cachedTasks = all.filter(isActive).map(convertTask);
    lastCatalogAt = Date.now();
    return {
      count: cachedTasks.length,
      tasks: cachedTasks,
      zoneStats: zoneStats(cachedTasks),
      generatedAt: first.generatedAt || new Date().toISOString(),
      stale: false,
      source: 'github-api-v1-read-only'
    };
  }

  function getTasks() {
    if (!catalogPromise) {
      catalogPromise = loadCompleteCatalog().finally(function () {catalogPromise = null;});
    }
    return catalogPromise;
  }

  function findCachedTask(input) {
    var candidate = cachedTasks.find(function (t) {
      return t.sheetName === input.sheetName && Number(t.rowNumber) === Number(input.rowNumber);
    });
    if (!candidate || !candidate.taskToken) fail('Карточка не найдена в снимке API. Обновите список.');
    return candidate;
  }

  async function getTaskPhotoData(input) {
    var task = findCachedTask(input);
    var meta = await readApi('getTaskPhotos', {taskToken: task.taskToken});
    if (!meta || !Array.isArray(meta.photos)) fail('Фото недоступно.');
    var index = Number(String(input.fileId || '').replace('github-preview-photo-','')) || 0;
    var photo = meta.photos[index];
    if (!photo || !photo.photoToken) fail('Фото не связано с выбранной карточкой.');
    return readApi('getTaskPhoto', {taskToken: task.taskToken, photoToken: photo.photoToken});
  }

  function forbiddenWrite() {
    fail('GitHub v71: сохранение отключено. Старый API v1 не совместим с атомарной записью M/U/AE версии 71. Используйте рабочую веб-версию для закрытия заданий.');
  }

  async function dispatch(name, args) {
    if (name === 'getTasks') return getTasks();
    if (name === 'getTaskPhotoData') return getTaskPhotoData(args[0] || {});
    if (name === 'logClientEvent') {
      // Never store potentially identifying event payloads in public GitHub.
      return {ok:true};
    }
    if (name === 'updateTask' || name === 'uploadTaskPhoto') return forbiddenWrite();
    if (name === 'getTaskUpdateResult') return forbiddenWrite();
    if (name === 'getSearchAnalytics') {
      fail('Периодная аналитика v71 отсутствует в старом API. Данные не подменяются.');
    }
    fail('GitHub v71: API не поддерживает ' + name);
  }

  function chain(onSuccess, onFailure) {
    return new Proxy({}, {
      get: function (_target, name) {
        if (name === 'withSuccessHandler') return function (fn) { return chain(fn, onFailure); };
        if (name === 'withFailureHandler') return function (fn) { return chain(onSuccess, fn); };
        if (name === 'withUserObject') return function () { return chain(onSuccess, onFailure); };
        if (name === 'then') return undefined;
        return function () {
          var args = Array.prototype.slice.call(arguments);
          Promise.resolve().then(function () { return dispatch(String(name), args); }).then(
            function (value) { if (onSuccess) onSuccess(value); },
            function (error) { if (onFailure) onFailure(error); else console.warn('[GitHub v71 bridge]', String(error)); }
          );
        };
      }
    });
  }

  window.google = window.google || {};
  window.google.script = window.google.script || {};
  window.google.script.run = chain(null, null);
  window.githubV71BridgeStatus = function () {
    return {configured: /^https:\/\/script\.google\.com\//.test(API_URL),
      readOnly: true, version: 'v71-ui-github-preview', backend: 'legacy-api-v1',
      catalogCount: cachedTasks.length, lastCatalogAt: lastCatalogAt};
  };

  function addReadOnlyNotice() {
    if (!document.body || document.getElementById('githubV71Notice')) return;
    var bar = document.createElement('div');
    bar.id = 'githubV71Notice';
    bar.setAttribute('role', 'status');
    bar.textContent = 'GitHub • Копия интерфейса v71 · Просмотр заданий. Сохранение здесь отключено.';
    bar.style.cssText = 'position:fixed;bottom:0;left:0;right:0;z-index:999999;padding:8px 12px;' +
      'text-align:center;background:#30251b;color:#fff8ed;font:12px/1.35 system-ui,sans-serif;' +
      'box-shadow:0 -3px 14px #0003;pointer-events:none';
    document.body.appendChild(bar);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', addReadOnlyNotice);
  else addReadOnlyNotice();
})();
