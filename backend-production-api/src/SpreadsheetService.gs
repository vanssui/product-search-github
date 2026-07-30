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
