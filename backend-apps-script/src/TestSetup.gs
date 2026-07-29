function setupTestEnvironment() {
  assertTestEnvironment_();
  var spreadsheet = getSpreadsheet_();
  var photoFolder = getIsolatedTestPhotoFolder_();
  var deletedPhotoCount = clearTestPhotoFolder_(photoFolder);
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
    sheet
      .getRange(1, 1, sheet.getMaxRows(), sheet.getMaxColumns())
      .clearDataValidations();
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
  var scriptProperties = PropertiesService.getScriptProperties();
  var allProperties = scriptProperties.getProperties();
  var clearedStatePropertyCount = 0;
  Object.keys(allProperties).forEach(function(key) {
    if (key.indexOf('IDEMP_') === 0 || key.indexOf('CLAIM_') === 0) {
      scriptProperties.deleteProperty(key);
      clearedStatePropertyCount += 1;
    }
  });
  clearTaskCache_();
  SpreadsheetApp.flush();

  return {
    ok: true,
    spreadsheetId: spreadsheet.getId(),
    sheets: keepNames,
    testRows: globalIndex,
    photoFolderId: APP_CONFIG.photoFolderId,
    deletedPhotoCount: deletedPhotoCount,
    clearedStatePropertyCount: clearedStatePropertyCount
  };
}

function assertTestEnvironment_() {
  if (APP_CONFIG.environment !== 'test') {
    throw new Error('Операция разрешена только в test environment.');
  }
}

function getIsolatedTestPhotoFolder_() {
  assertTestEnvironment_();
  hydrateRuntimeConfig_();
  var folder = DriveApp.getFolderById(APP_CONFIG.photoFolderId);
  if (folder.getName().indexOf(APP_CONFIG.testPhotoFolderNamePrefix) !== 0) {
    throw new Error('Очистка остановлена: имя тестовой папки не соответствует защитному префиксу.');
  }
  return folder;
}

function clearTestPhotoFolder_(folder) {
  var deletedCount = 0;
  var files = folder.getFiles();
  while (files.hasNext()) {
    files.next().setTrashed(true);
    deletedCount += 1;
  }
  return deletedCount;
}

function getTestEnvironmentStatusApi_() {
  var folder = getIsolatedTestPhotoFolder_();
  var photoFileCount = 0;
  var files = folder.getFiles();
  while (files.hasNext()) {
    files.next();
    photoFileCount += 1;
  }

  var stateCounts = { claimCount: 0, idempotencyCount: 0 };
  var properties = PropertiesService.getScriptProperties().getProperties();
  Object.keys(properties).forEach(function(key) {
    if (key.indexOf('CLAIM_') === 0) stateCounts.claimCount += 1;
    if (key.indexOf('IDEMP_') === 0) stateCounts.idempotencyCount += 1;
  });

  var taskState = getTasksApi_();
  return {
    environment: APP_CONFIG.environment,
    activeTaskCount: taskState.count,
    photoFileCount: photoFileCount,
    claimCount: stateCounts.claimCount,
    idempotencyCount: stateCounts.idempotencyCount
  };
}

function pad2_(value) {
  return ('0' + value).slice(-2);
}

function pad3_(value) {
  return ('00' + value).slice(-3);
}
