function setupTestEnvironment() {
  if (APP_CONFIG.environment !== 'test') {
    throw new Error('setupTestEnvironment разрешена только в test.');
  }
  var spreadsheet = getSpreadsheet_();
  var sourceNames = APP_CONFIG.sourceSheets.map(function(config) { return config.name; });
  var keepNames = sourceNames.concat([APP_CONFIG.logSheetName]);

  if (!spreadsheet.getSheetByName('__SETUP_TEMP__')) {
    spreadsheet.insertSheet('__SETUP_TEMP__');
  }
  spreadsheet.getSheets().forEach(function(sheet) {
    if (keepNames.indexOf(sheet.getName()) === -1 && sheet.getName() !== '__SETUP_TEMP__') {
      spreadsheet.deleteSheet(sheet);
    }
  });

  var headers = [
    'Ответственный',
    'Идентификатор товара',
    'ВБ стикер',
    'Статус товара',
    'Наименование',
    'Стоимость',
    'MX',
    'BOX',
    'Этаж',
    'Ряд',
    'ID сборщика',
    'Действия с товаром',
    'Статус поиска (после поиска на МХ)',
    'Статус',
    'ЛО',
    'Отчет',
    'Дата создания выгрузки',
    'Время заполнения',
    'Фото товара',
    'Комментарий',
    'id сотрудника'
  ];

  var globalIndex = 0;
  APP_CONFIG.sourceSheets.forEach(function(config, sheetIndex) {
    var sheet = spreadsheet.getSheetByName(config.name) || spreadsheet.insertSheet(config.name);
    sheet.clear();
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    var rows = [];
    for (var index = 0; index < 20; index += 1) {
      globalIndex += 1;
      var zoneNumber = config.zone ? config.zone.slice(-1) : String(3 + (index % 3));
      var floor = 1 + (globalIndex % 8);
      var warehouseRow = 1 + (globalIndex % 60);
      var wb = String(88000000000 + globalIndex);
      if (globalIndex % 10 === 0) wb += '\n' + String(99000000000 + globalIndex);
      rows.push([
        '',
        String(48000000000 + globalIndex),
        wb,
        'APG',
        'Тестовый товар ' + globalIndex,
        100 + globalIndex,
        'ВЛАД' + zoneNumber + '.' + pad2_(floor) + '.' + pad2_(warehouseRow) + '.' + pad3_(globalIndex) + '.02.01',
        String(330000000 + globalIndex),
        'Этаж ' + floor,
        'Ряд ' + warehouseRow,
        String(1700000 + globalIndex),
        'Инвент',
        APP_CONFIG.activeStatus,
        '',
        '',
        '',
        '29.07.2026',
        pad2_(8 + (globalIndex % 10)) + ':' + pad2_(globalIndex % 60),
        '',
        'Синтетическая тестовая строка',
        ''
      ]);
    }
    sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
    sheet.setFrozenRows(1);
    sheet.autoResizeColumns(1, headers.length);
  });

  var logSheet = spreadsheet.getSheetByName(APP_CONFIG.logSheetName) || spreadsheet.insertSheet(APP_CONFIG.logSheetName);
  logSheet.clear();
  logSheet.getRange(1, 1, 1, 5).setValues([['Timestamp', 'Request ID', 'Action', 'Code', 'Message']]);
  logSheet.setFrozenRows(1);
  var temp = spreadsheet.getSheetByName('__SETUP_TEMP__');
  if (temp && spreadsheet.getSheets().length > 1) spreadsheet.deleteSheet(temp);
  PropertiesService.getScriptProperties().deleteAllProperties();
  clearTaskCache_();
  SpreadsheetApp.flush();

  return {
    ok: true,
    spreadsheetId: spreadsheet.getId(),
    sheets: keepNames,
    testRows: globalIndex,
    photoFolderId: APP_CONFIG.photoFolderId
  };
}

function pad2_(value) {
  return ('0' + value).slice(-2);
}

function pad3_(value) {
  return ('00' + value).slice(-3);
}

