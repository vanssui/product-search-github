function getSpreadsheet_() {
  hydrateRuntimeConfig_();
  var spreadsheet = SpreadsheetApp.openById(APP_CONFIG.spreadsheetId);
  if (spreadsheet.getName() !== APP_CONFIG.expectedSpreadsheetName) {
    throw apiError_(
      'CONFIG_ERROR',
      'Backend отказался открыть таблицу с неожиданным названием.'
    );
  }
  return spreadsheet;
}

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
    statusSearch: findStatusSearchCol_(headers),
    extraStatus: findCol_(headers, ['статус']),
    report: findCol_(headers, ['отчет', 'отчёт']),
    dateCreated: findCol_(headers, ['дата создания', 'дата создания выгрузки', 'дата']),
    timeFilled: findCol_(headers, ['время заполнения', 'ручное время', 'время поиска', 'время создания', 'время']),
    photo: findCol_(headers, ['фото товара', 'фото']),
    comment: findCol_(headers, ['комментарий']),
    employeeId: findCol_(headers, ['id сотрудника'])
  };
}

function findStatusSearchCol_(headers) {
  var exact = findCol_(headers, [
    'статус поиска (после поиска на мх)',
    'статус поиска'
  ]);
  return exact >= 0 ? exact : 12;
}

function validateReadColumns_(columns, headerLength, sheetName) {
  if (columns.statusSearch < 0 || columns.statusSearch >= headerLength) {
    throw apiError_(
      'SCHEMA_ERROR',
      'На одном из production-листов не найдена колонка статуса поиска.'
    );
  }
  if (!stringify_(sheetName)) {
    throw apiError_('SCHEMA_ERROR', 'Не удалось определить production-лист.');
  }
}

function validateWriteColumns_(columns, headerLength, options) {
  validateReadColumns_(columns, headerLength, options && options.sheetName);
  if (columns.employeeId < 0 || columns.employeeId >= headerLength) {
    throw apiError_(
      'SCHEMA_ERROR',
      'На production-листе не найдена колонка ID сотрудника.'
    );
  }
  if (options && options.photoRequired &&
      (columns.photo < 0 || columns.photo >= headerLength)) {
    throw apiError_(
      'SCHEMA_ERROR',
      'На production-листе не найдена колонка фото.'
    );
  }
}

function findSourceConfig_(sheetName) {
  hydrateRuntimeConfig_();
  for (var index = 0; index < APP_CONFIG.sourceSheets.length; index += 1) {
    if (stringify_(APP_CONFIG.sourceSheets[index].name) === sheetName) {
      return APP_CONFIG.sourceSheets[index];
    }
  }
  return null;
}

function getWritableTaskContextByToken_(taskToken, options) {
  var token = requireText_(taskToken, 'taskToken', 120);
  var reference = decodeTaskReference_(token);
  var sourceConfig = APP_CONFIG.sourceSheets[reference.sourceIndex];
  var sheetName = stringify_(sourceConfig.name);
  var rowNumber = reference.rowNumber;

  var spreadsheet = getSpreadsheet_();
  var sheet = spreadsheet.getSheetByName(sheetName);
  if (!sheet || rowNumber > sheet.getLastRow()) {
    throw apiError_('TASK_NOT_FOUND', 'Строка задания больше не существует.');
  }
  var lastColumn = sheet.getLastColumn();
  var headers = normalizeHeaders_(
    sheet.getRange(1, 1, 1, lastColumn).getValues()[0]
  );
  var columns = buildColumnMap_(headers);
  validateWriteColumns_(columns, headers.length, {
    sheetName: sheetName,
    photoRequired: options && options.photoRequired
  });
  var row = sheet.getRange(rowNumber, 1, 1, lastColumn).getValues()[0];
  var timezone = spreadsheet.getSpreadsheetTimeZone() || APP_CONFIG.timezone;
  var currentTask = buildTask_(
    sheetName,
    rowNumber,
    row,
    columns,
    resolveZone_(sourceConfig.zone, sheetName, getCell_(row, columns.mx)),
    timezone
  );
  if (currentTask.taskToken !== token) {
    throw apiError_(
      'TASK_CHANGED',
      'Строка задания изменилась. Обновите каталог.'
    );
  }
  return {
    spreadsheet: spreadsheet,
    sheet: sheet,
    sheetName: sheetName,
    rowNumber: rowNumber,
    row: row,
    columns: columns,
    task: currentTask
  };
}
