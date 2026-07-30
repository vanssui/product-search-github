function getCatalogApi_(payload) {
  if (parseBoolean_(payload.fresh)) {
    clearSnapshotCache_();
  }
  var snapshot = getTaskSnapshot_();
  var filters = normalizeCatalogFilters_(payload);
  var matching = filterTasks_(snapshot.tasks, filters, true);
  var page = parsePositiveInteger_(payload.page, 1);
  var pageSize = parsePositiveInteger_(payload.pageSize, 60, APP_CONFIG.maxPageSize);
  var offset = (page - 1) * pageSize;
  var pageTasks = matching.slice(offset, offset + pageSize).map(projectTask_);

  return {
    generatedAt: snapshot.generatedAt,
    mode: 'read-only',
    totalActive: snapshot.tasks.length,
    filteredCount: matching.length,
    page: page,
    pageSize: pageSize,
    pageCount: Math.max(1, Math.ceil(matching.length / pageSize)),
    hasMore: offset + pageTasks.length < matching.length,
    blocks: buildBlockFacets_(snapshot.tasks, filters),
    floors: buildFloorFacets_(snapshot.tasks, filters),
    photoCount: matching.filter(function(task) { return task.hasPhoto; }).length,
    tasks: pageTasks
  };
}

function getTaskApi_(payload) {
  var token = stringify_(payload.taskToken);
  if (!token) throw apiError_('VALIDATION_ERROR', 'Не указан taskToken.');
  var task = findTaskByToken_(getTaskSnapshot_().tasks, token);
  if (!task) {
    throw apiError_('TASK_NOT_FOUND', 'Задание больше не находится в активном поиске.');
  }
  return projectTask_(task);
}

function normalizeCatalogFilters_(payload) {
  return {
    zone: stringify_(payload.zone).toUpperCase(),
    floor: stringify_(payload.floor),
    query: normalizeSearch_(payload.query),
    photoOnly: parseBoolean_(payload.photoOnly),
    myOnly: parseBoolean_(payload.myOnly),
    employeeId: stringify_(payload.employeeId).toUpperCase()
  };
}

function filterTasks_(tasks, filters, includeFloor) {
  return tasks.filter(function(task) {
    if (filters.zone && task.zone !== filters.zone) return false;
    if (includeFloor && filters.floor && floorLabel_(task.floor) !== filters.floor) return false;
    if (filters.photoOnly && !task.hasPhoto) return false;
    if (filters.myOnly &&
        stringify_(task.employeeId).toUpperCase() !== filters.employeeId) return false;
    if (filters.query && task.searchText.indexOf(filters.query) === -1) return false;
    return true;
  });
}

function buildBlockFacets_(tasks, filters) {
  var counts = {};
  APP_CONFIG.zoneNames.forEach(function(zone) { counts[zone] = 0; });
  tasks.forEach(function(task) {
    if (filters.photoOnly && !task.hasPhoto) return;
    if (filters.myOnly &&
        stringify_(task.employeeId).toUpperCase() !== filters.employeeId) return;
    if (filters.query && task.searchText.indexOf(filters.query) === -1) return;
    counts[task.zone] = (counts[task.zone] || 0) + 1;
  });
  return APP_CONFIG.zoneNames.map(function(zone) {
    return { id: zone, label: zone, count: counts[zone] || 0 };
  }).filter(function(block) {
    return block.count > 0;
  });
}

function buildFloorFacets_(tasks, filters) {
  var withoutFloor = {
    zone: filters.zone,
    floor: '',
    query: filters.query,
    photoOnly: filters.photoOnly,
    myOnly: filters.myOnly,
    employeeId: filters.employeeId
  };
  var counts = {};
  filterTasks_(tasks, withoutFloor, false).forEach(function(task) {
    var floor = floorLabel_(task.floor);
    counts[floor] = (counts[floor] || 0) + 1;
  });
  return Object.keys(counts).sort(compareNatural_).map(function(floor) {
    return { id: floor, label: floor, count: counts[floor] };
  });
}

function floorLabel_(value) {
  return stringify_(value) || 'Без этажа';
}

function compareNatural_(a, b) {
  var aMatch = String(a).match(/\d+/);
  var bMatch = String(b).match(/\d+/);
  var aNumber = aMatch ? Number(aMatch[0]) : NaN;
  var bNumber = bMatch ? Number(bMatch[0]) : NaN;
  if (!isNaN(aNumber) && !isNaN(bNumber) && aNumber !== bNumber) {
    return aNumber - bNumber;
  }
  if (!isNaN(aNumber)) return -1;
  if (!isNaN(bNumber)) return 1;
  return String(a).localeCompare(String(b), 'ru');
}

function getTaskSnapshot_() {
  hydrateRuntimeConfig_();
  var cached = readSnapshotCache_();
  if (cached) return cached;

  var lock = LockService.getScriptLock();
  var hasLock = lock.tryLock(45000);
  if (!hasLock) {
    cached = readSnapshotCache_();
    if (cached) return cached;
    throw apiError_(
      'BACKEND_BUSY',
      'Каталог обновляется. Повторите запрос через несколько секунд.'
    );
  }
  try {
    cached = readSnapshotCache_();
    if (cached) return cached;
    var built = buildTaskSnapshot_();
    writeSnapshotCache_(built);
    return built;
  } finally {
    lock.releaseLock();
  }
}

function buildTaskSnapshot_() {
  var spreadsheet = getSpreadsheet_();
  var timezone = spreadsheet.getSpreadsheetTimeZone() || APP_CONFIG.timezone;
  var tasks = [];
  APP_CONFIG.sourceSheets.forEach(function(config) {
    Array.prototype.push.apply(
      tasks,
      readActiveTasksFromSheet_(spreadsheet, config, timezone)
    );
  });
  tasks.sort(compareTasks_);
  return {
    generatedAt: nowIso_(),
    tasks: tasks
  };
}

function readActiveTasksFromSheet_(spreadsheet, config, timezone) {
  var sheetName = stringify_(config.name);
  var sheet = spreadsheet.getSheetByName(sheetName);
  if (!sheet) {
    throw apiError_('SCHEMA_ERROR', 'Один из настроенных production-листов не найден.');
  }
  var lastRow = sheet.getLastRow();
  var lastColumn = sheet.getLastColumn();
  if (lastRow < 2 || lastColumn < 1) return [];

  var headerValues = sheet.getRange(1, 1, 1, lastColumn).getValues()[0];
  var headers = normalizeHeaders_(headerValues);
  var columns = buildColumnMap_(headers);
  validateReadColumns_(columns, headers.length, sheetName);
  var startRow = Math.max(2, lastRow - APP_CONFIG.maxTailRowsPerSheet + 1);
  var values = sheet.getRange(
    startRow,
    1,
    lastRow - startRow + 1,
    lastColumn
  ).getValues();
  var tasks = [];

  for (var index = values.length - 1; index >= 0; index -= 1) {
    var row = values[index];
    if (!isActiveStatus_(getCell_(row, columns.statusSearch))) continue;
    var zone = resolveZone_(config.zone, sheetName, getCell_(row, columns.mx));
    if (APP_CONFIG.zoneNames.indexOf(zone) === -1) continue;
    tasks.push(buildTask_(
      sheetName,
      startRow + index,
      row,
      columns,
      zone,
      timezone
    ));
  }
  return tasks;
}

function buildTask_(sheetName, rowNumber, row, columns, zone, timezone) {
  var location = parseMxLocation_(getCell_(row, columns.mx));
  var photoIds = extractDriveFileIds_(getCell_(row, columns.photo));
  var itemId = stringify_(getCell_(row, columns.itemId));
  var wbSticker = stringify_(getCell_(row, columns.wbSticker));
  var mx = stringify_(getCell_(row, columns.mx));
  var floor = cleanLocation_(getCell_(row, columns.floor), 'Этаж') || location.floor;
  var task = {
    _sheetName: sheetName,
    _rowNumber: rowNumber,
    zone: zone,
    sourceLabel: sheetName,
    itemId: itemId,
    wbSticker: wbSticker,
    wbStickers: splitStickers_(wbSticker),
    itemName: stringify_(getCell_(row, columns.itemName)),
    mx: mx,
    box: stringify_(getCell_(row, columns.box)),
    floor: floor,
    row: cleanLocation_(getCell_(row, columns.row), 'Ряд') || location.row,
    place: location.place,
    shelf: location.shelf,
    cell: location.cell,
    pickerId: stringify_(getCell_(row, columns.pickerId)),
    itemStatus: stringify_(getCell_(row, columns.itemStatus)),
    action: stringify_(getCell_(row, columns.action)),
    statusSearch: stringify_(getCell_(row, columns.statusSearch)),
    extraStatus: stringify_(getCell_(row, columns.extraStatus)),
    report: stringify_(getCell_(row, columns.report)),
    comment: stringify_(getCell_(row, columns.comment)),
    employeeId: stringify_(getCell_(row, columns.employeeId)),
    createdAt: formatDateCell_(getCell_(row, columns.dateCreated), timezone),
    timeFilled: formatTimeCell_(getCell_(row, columns.timeFilled), timezone),
    photoFileIds: photoIds,
    photoCount: photoIds.length,
    hasPhoto: photoIds.length > 0
  };
  task.taskToken = buildTaskToken_(task);
  task.searchText = normalizeSearch_([
    itemId,
    wbSticker,
    task.itemName,
    mx,
    task.box,
    task.floor,
    task.row,
    task.place,
    task.shelf,
    task.cell,
    task.action,
    task.comment,
    task.sourceLabel
  ].join(' '));
  return task;
}

function projectTask_(task) {
  return {
    taskToken: task.taskToken,
    zone: task.zone,
    itemId: task.itemId,
    wbSticker: task.wbSticker,
    wbStickers: task.wbStickers,
    itemName: task.itemName,
    mx: task.mx,
    box: task.box,
    floor: task.floor,
    row: task.row,
    place: task.place,
    shelf: task.shelf,
    cell: task.cell,
    pickerId: task.pickerId,
    itemStatus: task.itemStatus,
    action: task.action,
    statusSearch: task.statusSearch,
    extraStatus: task.extraStatus,
    report: task.report,
    comment: task.comment,
    employeeId: task.employeeId,
    createdAt: task.createdAt,
    timeFilled: task.timeFilled,
    photoCount: task.photoCount,
    hasPhoto: task.hasPhoto
  };
}

function findTaskByToken_(tasks, token) {
  for (var index = 0; index < tasks.length; index += 1) {
    if (tasks[index].taskToken === token) return tasks[index];
  }
  return null;
}

function buildTaskToken_(task) {
  var reference = [
    '1',
    sourceIndexForSheet_(task._sheetName),
    task._rowNumber
  ].join(':');
  var encodedReference = Utilities.base64EncodeWebSafe(
    Utilities.newBlob(reference).getBytes()
  ).replace(/=+$/, '');
  var signature = webSafeHmac_([
    encodedReference,
    task.itemId,
    task.wbSticker,
    task.mx
  ].join('|'));
  return encodedReference + '.' + signature;
}

function sourceIndexForSheet_(sheetName) {
  for (var index = 0; index < APP_CONFIG.sourceSheets.length; index += 1) {
    if (stringify_(APP_CONFIG.sourceSheets[index].name) === sheetName) {
      return index;
    }
  }
  throw apiError_('CONFIG_ERROR', 'Источник задания не настроен.');
}

function decodeTaskReference_(taskToken) {
  var parts = stringify_(taskToken).split('.');
  if (parts.length !== 2) {
    throw apiError_('TASK_INVALID', 'Некорректный taskToken.');
  }
  var decoded;
  try {
    decoded = Utilities.newBlob(
      Utilities.base64DecodeWebSafe(parts[0])
    ).getDataAsString();
  } catch (error) {
    throw apiError_('TASK_INVALID', 'Некорректный taskToken.');
  }
  var values = decoded.split(':');
  var sourceIndex = Number(values[1]);
  var rowNumber = Number(values[2]);
  if (values[0] !== '1' || !Number.isInteger(sourceIndex) ||
      sourceIndex < 0 || sourceIndex >= APP_CONFIG.sourceSheets.length ||
      !Number.isInteger(rowNumber) || rowNumber < 2) {
    throw apiError_('TASK_INVALID', 'Некорректная ссылка на задание.');
  }
  return {
    encodedReference: parts[0],
    signature: parts[1],
    sourceIndex: sourceIndex,
    rowNumber: rowNumber
  };
}

function isActiveStatus_(value) {
  return stringify_(value).toLowerCase() === APP_CONFIG.activeStatus.toLowerCase();
}

function splitStickers_(value) {
  var unique = {};
  stringify_(value).split(/[\s,;|/]+/).forEach(function(item) {
    var text = stringify_(item);
    if (text) unique[text] = true;
  });
  return Object.keys(unique);
}

function resolveZone_(configuredZone, sheetName, mx) {
  var configured = stringify_(configuredZone).toUpperCase();
  if (APP_CONFIG.zoneNames.indexOf(configured) !== -1) return configured;
  var text = (stringify_(mx) + ' ' + stringify_(sheetName))
    .toUpperCase()
    .replace(/\s+/g, '');
  if (text.indexOf('ВЛАД3') !== -1 || text.indexOf('Б3') !== -1 ||
      text.indexOf('B3') !== -1) return 'B3';
  if (text.indexOf('ВЛАД4') !== -1 || text.indexOf('Б4') !== -1 ||
      text.indexOf('B4') !== -1) return 'B4';
  if (text.indexOf('ВЛАД5') !== -1 || text.indexOf('Б5') !== -1 ||
      text.indexOf('B5') !== -1 || text.indexOf('Б5КГТ') !== -1 ||
      text.indexOf('B5KGT') !== -1) return 'B5';
  return '';
}

function parseMxLocation_(value) {
  var parts = stringify_(value).split('.').map(function(part) {
    return stringify_(part);
  }).filter(Boolean).slice(-5);
  if (parts.length < 5) {
    return { floor: '', row: '', place: '', shelf: '', cell: '' };
  }
  return {
    floor: stripLeadingZeros_(parts[0]),
    row: stripLeadingZeros_(parts[1]),
    place: stripLeadingZeros_(parts[2]),
    shelf: stripLeadingZeros_(parts[3]),
    cell: stripLeadingZeros_(parts[4])
  };
}

function cleanLocation_(value, word) {
  return stringify_(value).replace(new RegExp(word, 'i'), '').trim();
}

function stripLeadingZeros_(value) {
  var text = stringify_(value);
  if (!text) return '';
  return text.replace(/^0+(\d)/, '$1') || '0';
}

function numericRoute_(value) {
  var number = Number(stringify_(value).replace(/[^\d-]/g, ''));
  return isNaN(number) ? 999999999 : number;
}

function compareTasks_(a, b) {
  var keys = ['zone', 'floor', 'row', 'place', 'shelf', 'cell'];
  for (var index = 0; index < keys.length; index += 1) {
    var key = keys[index];
    if (key === 'zone') {
      var zoneCompare = stringify_(a[key]).localeCompare(stringify_(b[key]), 'ru');
      if (zoneCompare) return zoneCompare;
    } else {
      var difference = numericRoute_(a[key]) - numericRoute_(b[key]);
      if (difference) return difference;
    }
  }
  return stringify_(a.wbSticker).localeCompare(stringify_(b.wbSticker), 'ru');
}

function extractDriveFileIds_(value) {
  var matches = stringify_(value).match(/[-\w]{25,}/g) || [];
  var unique = {};
  matches.forEach(function(id) { unique[id] = true; });
  return Object.keys(unique).slice(-6);
}

function readSnapshotCache_() {
  var cache = getScriptCache_();
  if (!cache) return null;
  var meta = safeJsonParse_(cache.get(APP_CONFIG.cachePrefix + 'meta'), null);
  if (!meta || !meta.chunks || meta.chunks < 1 || meta.chunks > 20) return null;
  var parts = [];
  for (var index = 0; index < meta.chunks; index += 1) {
    var part = cache.get(APP_CONFIG.cachePrefix + 'chunk_' + index);
    if (!part) return null;
    parts.push(part);
  }
  return safeJsonParse_(parts.join(''), null);
}

function writeSnapshotCache_(snapshot) {
  var cache = getScriptCache_();
  if (!cache) return;
  var serialized = JSON.stringify(snapshot);
  if (serialized.length > APP_CONFIG.maxCacheBytes) return;
  var chunks = [];
  for (var offset = 0; offset < serialized.length; offset += APP_CONFIG.cacheChunkSize) {
    chunks.push(serialized.slice(offset, offset + APP_CONFIG.cacheChunkSize));
  }
  var values = {};
  chunks.forEach(function(chunk, index) {
    values[APP_CONFIG.cachePrefix + 'chunk_' + index] = chunk;
  });
  values[APP_CONFIG.cachePrefix + 'meta'] = JSON.stringify({
    chunks: chunks.length,
    generatedAt: snapshot.generatedAt
  });
  cache.putAll(values, APP_CONFIG.cacheSeconds);
}

function clearSnapshotCache_() {
  var cache = getScriptCache_();
  if (!cache) return;
  var keys = [APP_CONFIG.cachePrefix + 'meta'];
  for (var index = 0; index < 20; index += 1) {
    keys.push(APP_CONFIG.cachePrefix + 'chunk_' + index);
  }
  cache.removeAll(keys);
}

function getScriptCache_() {
  try {
    return CacheService.getScriptCache();
  } catch (error) {
    return null;
  }
}
