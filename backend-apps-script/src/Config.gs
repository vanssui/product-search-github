var APP_CONFIG = {
  projectName: 'Product Search GitHub Backend',
  environment: 'test',
  timezone: 'Europe/Moscow',
  spreadsheetId: '',
  spreadsheetNamePrefix: '',
  photoFolderId: '',
  sourceSheets: [],
  zoneNames: ['B3', 'B4', 'B5'],
  activeStatus: 'Поиск',
  foundStatus: 'Найдено',
  notFoundStatus: 'Не найдено',
  cacheKey: 'github_api_active_tasks_v1',
  cacheSeconds: 20,
  maxTailRowsPerSheet: 5000,
  maxPhotoIdsPerTask: 6,
  maxPhotoBytes: 5 * 1024 * 1024,
  allowedPhotoMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
  lockTimeoutMs: 20000,
  claimTtlMs: 10 * 60 * 1000,
  idempotencyTtlMs: 24 * 60 * 60 * 1000,
  logSheetName: 'APP_API_LOG'
};

function hydrateRuntimeConfig_() {
  if (APP_CONFIG.runtimeHydrated) return;
  var properties = PropertiesService.getScriptProperties();
  APP_CONFIG.spreadsheetId = stringify_(properties.getProperty('SPREADSHEET_ID'));
  APP_CONFIG.photoFolderId = stringify_(properties.getProperty('PHOTO_FOLDER_ID'));
  APP_CONFIG.spreadsheetNamePrefix = stringify_(
    properties.getProperty('SPREADSHEET_NAME_PREFIX')
  );
  APP_CONFIG.sourceSheets = safeJsonParse_(
    properties.getProperty('SOURCE_SHEETS_JSON'),
    []
  );
  if (!APP_CONFIG.spreadsheetId || !APP_CONFIG.photoFolderId ||
      !APP_CONFIG.sourceSheets || !APP_CONFIG.sourceSheets.length) {
    throw apiError_(
      'CONFIG_ERROR',
      'Runtime-конфигурация backend не настроена в Script Properties.'
    );
  }
  APP_CONFIG.runtimeHydrated = true;
}
