function normalizeHeaders_(headers) {
  return headers.map(function(header) {
    return stringify_(header).replace(/\s+/g, ' ').toLowerCase();
  });
}

function findCol_(headers, names) {
  for (var i = 0; i < headers.length; i += 1) {
    for (var j = 0; j < names.length; j += 1) {
      if (headers[i].indexOf(names[j]) !== -1) return i;
    }
  }
  return -1;
}

function buildColumnMap_(headers) {
  return {
    person: findCol_(headers, ['фио', 'ответственный']),
    itemId: findCol_(headers, ['идентификатор товара']),
    wbSticker: findCol_(headers, ['вб стикер', 'wb стикер', 'wbsticker', 'wb sticker']),
    itemStatus: findCol_(headers, ['статус товара']),
    itemName: findCol_(headers, ['наименование']),
    price: findCol_(headers, ['стоимость']),
    mx: findCol_(headers, ['mx', 'мх']),
    box: findCol_(headers, ['box', 'бокс']),
    floor: findCol_(headers, ['этаж']),
    row: findCol_(headers, ['ряд']),
    pickerId: findCol_(headers, ['id сборщика']),
    action: findCol_(headers, ['действия с товаром', 'действие с товаром']),
    statusSearch: findCol_(headers, ['статус поиска']),
    dateCreated: findCol_(headers, ['дата создания']),
    timeFilled: findCol_(headers, ['время заполнения', 'время поиска']),
    photo: findCol_(headers, ['фото товара', 'фото']),
    comment: findCol_(headers, ['комментарий']),
    employeeId: findCol_(headers, ['id сотрудника'])
  };
}

function validateColumns_(columns, headerLength, forWrite) {
  if (columns.statusSearch < 0 || columns.statusSearch >= headerLength) {
    throw apiError_('SCHEMA_ERROR', 'Не найдена колонка "Статус поиска".');
  }
  if (forWrite && columns.employeeId < 0) {
    throw apiError_('SCHEMA_ERROR', 'Не найдена колонка "ID сотрудника".');
  }
}

function getTasksApi_(payload) {
  var cache = getScriptCache_();
  var cached = cache ? cache.get(APP_CONFIG.cacheKey) : '';
  if (cached) return JSON.parse(cached);

  var spreadsheet = getSpreadsheet_();
  var timezone = spreadsheet.getSpreadsheetTimeZone() || APP_CONFIG.timezone;
  var tasks = [];
  APP_CONFIG.sourceSheets.forEach(function(config) {
    Array.prototype.push.apply(tasks, readActiveTasksFromSheet_(spreadsheet, config, timezone));
  });
  tasks.sort(compareTasks_);

  var result = {
    generatedAt: nowIso_(),
    count: tasks.length,
    tasks: tasks,
    zoneStats: buildZoneStats_(tasks)
  };
  if (cache) {
    var serialized = JSON.stringify(result);
    if (serialized.length < 90000) cache.put(APP_CONFIG.cacheKey, serialized, APP_CONFIG.cacheSeconds);
  }
  return result;
}

function getTaskDetailsApi_(payload) {
  return rowContextToTask_(getRowContext_(payload, false));
}

function readActiveTasksFromSheet_(spreadsheet, config, timezone) {
  var sheet = spreadsheet.getSheetByName(config.name);
  if (!sheet) return [];
  var lastRow = sheet.getLastRow();
  var lastColumn = sheet.getLastColumn();
  if (lastRow < 2 || lastColumn < 1) return [];

  var headerValues = sheet.getRange(1, 1, 1, lastColumn).getValues()[0];
  var headers = normalizeHeaders_(headerValues);
  var columns = buildColumnMap_(headers);
  validateColumns_(columns, headers.length, false);
  var startRow = Math.max(2, lastRow - APP_CONFIG.maxTailRowsPerSheet + 1);
  var values = sheet.getRange(startRow, 1, lastRow - startRow + 1, lastColumn).getValues();
  var tasks = [];

  for (var index = values.length - 1; index >= 0; index -= 1) {
    var row = values[index];
    if (!isActiveStatus_(getCell_(row, columns.statusSearch))) continue;
    var zone = resolveZone_(config.zone, config.name, getCell_(row, columns.mx));
    if (APP_CONFIG.zoneNames.indexOf(zone) === -1) continue;
    tasks.push(buildTask_(config.name, startRow + index, row, columns, zone, timezone));
  }
  return tasks;
}

function getRowContext_(payload, forWrite) {
  var sheetName = requireText_(payload.sheetName, 'sheetName', 100);
  var rowNumber = Number(payload.rowNumber);
  var taskToken = requireText_(payload.taskToken, 'taskToken', 120);
  if (!isAllowedSheet_(sheetName)) throw apiError_('SHEET_NOT_ALLOWED', 'Лист не разрешён.');
  if (!Number.isInteger(rowNumber) || rowNumber < 2) {
    throw apiError_('INVALID_ROW', 'Некорректный номер строки.');
  }

  var sheet = getSpreadsheet_().getSheetByName(sheetName);
  if (!sheet || rowNumber > sheet.getLastRow()) {
    throw apiError_('ROW_NOT_FOUND', 'Строка не найдена.');
  }
  var lastColumn = sheet.getLastColumn();
  var headers = normalizeHeaders_(sheet.getRange(1, 1, 1, lastColumn).getValues()[0]);
  var columns = buildColumnMap_(headers);
  validateColumns_(columns, headers.length, forWrite);
  var row = sheet.getRange(rowNumber, 1, 1, lastColumn).getValues()[0];
  var expectedToken = buildTaskToken_(sheetName, rowNumber, row, columns);
  if (taskToken !== expectedToken) {
    throw apiError_('TASK_CHANGED', 'Строка изменилась. Обновите список заданий.');
  }
  var config = APP_CONFIG.sourceSheets.filter(function(item) { return item.name === sheetName; })[0];
  return {
    sheet: sheet,
    sheetName: sheetName,
    rowNumber: rowNumber,
    row: row,
    columns: columns,
    zone: resolveZone_(config ? config.zone : '', sheetName, getCell_(row, columns.mx)),
    taskToken: expectedToken
  };
}

function buildTask_(sheetName, rowNumber, row, columns, zone, timezone) {
  var location = parseMxLocation_(getCell_(row, columns.mx));
  var photoIds = extractDriveFileIds_(getCell_(row, columns.photo));
  var wbSticker = getCell_(row, columns.wbSticker);
  return {
    taskToken: buildTaskToken_(sheetName, rowNumber, row, columns),
    sheetName: sheetName,
    rowNumber: rowNumber,
    zone: zone,
    sourceLabel: sheetName,
    itemId: getCell_(row, columns.itemId),
    wbSticker: wbSticker,
    wbStickers: splitStickers_(wbSticker),
    itemName: getCell_(row, columns.itemName),
    mx: getCell_(row, columns.mx),
    box: getCell_(row, columns.box),
    floor: stringify_(getCell_(row, columns.floor)).replace(/этаж/i, '').trim() || location.floor,
    row: stringify_(getCell_(row, columns.row)).replace(/ряд/i, '').trim() || location.row,
    place: location.place,
    shelf: location.shelf,
    cell: location.cell,
    pickerId: getCell_(row, columns.pickerId),
    itemStatus: getCell_(row, columns.itemStatus),
    action: getCell_(row, columns.action),
    statusSearch: getCell_(row, columns.statusSearch),
    comment: getCell_(row, columns.comment),
    employeeId: getCell_(row, columns.employeeId),
    createdAt: formatDateCell_(getCell_(row, columns.dateCreated), timezone),
    timeFilled: formatTimeCell_(getCell_(row, columns.timeFilled), timezone),
    photoFileId: photoIds[0] || '',
    photoFileIds: photoIds,
    photoCount: photoIds.length,
    hasPhoto: photoIds.length > 0
  };
}

function rowContextToTask_(context) {
  var timezone = context.sheet.getParent().getSpreadsheetTimeZone() || APP_CONFIG.timezone;
  return buildTask_(
    context.sheetName,
    context.rowNumber,
    context.row,
    context.columns,
    context.zone,
    timezone
  );
}

function buildTaskToken_(sheetName, rowNumber, row, columns) {
  return hashWebSafe_([
    sheetName,
    rowNumber,
    stringify_(getCell_(row, columns.itemId)),
    stringify_(getCell_(row, columns.wbSticker)),
    stringify_(getCell_(row, columns.mx))
  ].join('|'));
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
  if (APP_CONFIG.zoneNames.indexOf(configuredZone) !== -1) return configuredZone;
  var text = (stringify_(mx) + ' ' + stringify_(sheetName)).toUpperCase().replace(/\s+/g, '');
  if (text.indexOf('ВЛАД3') !== -1 || text.indexOf('Б3') !== -1 || text.indexOf('B3') !== -1) return 'B3';
  if (text.indexOf('ВЛАД4') !== -1 || text.indexOf('Б4') !== -1 || text.indexOf('B4') !== -1) return 'B4';
  if (text.indexOf('ВЛАД5') !== -1 || text.indexOf('Б5') !== -1 || text.indexOf('B5') !== -1) return 'B5';
  return '';
}

function parseMxLocation_(value) {
  var parts = stringify_(value).split('.').map(stringify_).filter(Boolean).slice(-5);
  if (parts.length < 5) return { floor: '', row: '', place: '', shelf: '', cell: '' };
  return {
    floor: stripLeadingZeros_(parts[0]),
    row: stripLeadingZeros_(parts[1]),
    place: stripLeadingZeros_(parts[2]),
    shelf: stripLeadingZeros_(parts[3]),
    cell: stripLeadingZeros_(parts[4])
  };
}

function stripLeadingZeros_(value) {
  return stringify_(value).replace(/^0+(\d)/, '$1') || '0';
}

function numericRoute_(value) {
  var number = Number(stringify_(value).replace(/[^\d-]/g, ''));
  return isNaN(number) ? 999999999 : number;
}

function compareTasks_(a, b) {
  var keys = ['zone', 'floor', 'row', 'place', 'shelf', 'cell'];
  for (var i = 0; i < keys.length; i += 1) {
    var key = keys[i];
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

function buildZoneStats_(tasks) {
  var stats = {};
  APP_CONFIG.zoneNames.forEach(function(zone) {
    stats[zone] = { total: 0, photos: 0, floors: {} };
  });
  tasks.forEach(function(task) {
    if (!stats[task.zone]) stats[task.zone] = { total: 0, photos: 0, floors: {} };
    stats[task.zone].total += 1;
    if (task.hasPhoto) stats[task.zone].photos += 1;
    var floor = stringify_(task.floor) || 'Без этажа';
    stats[task.zone].floors[floor] = (stats[task.zone].floors[floor] || 0) + 1;
  });
  return stats;
}

function formatDateCell_(value, timezone) {
  if (value instanceof Date && !isNaN(value.getTime())) {
    return Utilities.formatDate(value, timezone, 'dd.MM.yyyy');
  }
  return stringify_(value);
}

function formatTimeCell_(value, timezone) {
  if (value instanceof Date && !isNaN(value.getTime())) {
    return Utilities.formatDate(value, timezone, 'HH:mm');
  }
  var match = stringify_(value).match(/(\d{1,2}):(\d{2})/);
  return match ? ('0' + match[1]).slice(-2) + ':' + match[2] : '';
}

