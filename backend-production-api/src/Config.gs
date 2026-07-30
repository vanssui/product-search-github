var APP_CONFIG = {
  projectName: 'Product Search Production API',
  timezone: 'Europe/Moscow',
  environment: '',
  readOnly: true,
  spreadsheetId: '',
  expectedSpreadsheetName: '',
  sourceSheets: [],
  tokenSecret: '',
  zoneNames: ['B3', 'B4', 'B5'],
  activeStatus: 'Поиск',
  cachePrefix: 'prod_catalog_v2_',
  cacheSeconds: 300,
  maxTailRowsPerSheet: 5000,
  maxPageSize: 100,
  maxPhotoBytes: 8 * 1024 * 1024,
  maxCacheBytes: 850000,
  cacheChunkSize: 75000
};

function hydrateRuntimeConfig_() {
  if (APP_CONFIG.runtimeHydrated) return;

  var properties = PropertiesService.getScriptProperties();
  APP_CONFIG.environment = stringify_(properties.getProperty('ENVIRONMENT'));
  APP_CONFIG.readOnly = stringify_(properties.getProperty('READ_ONLY')).toLowerCase() === 'true';
  APP_CONFIG.spreadsheetId = stringify_(properties.getProperty('SPREADSHEET_ID'));
  APP_CONFIG.expectedSpreadsheetName = stringify_(
    properties.getProperty('EXPECTED_SPREADSHEET_NAME')
  );
  APP_CONFIG.sourceSheets = safeJsonParse_(
    properties.getProperty('SOURCE_SHEETS_JSON'),
    []
  );
  APP_CONFIG.tokenSecret = stringify_(properties.getProperty('TOKEN_SECRET'));

  if (APP_CONFIG.environment !== 'production' || !APP_CONFIG.readOnly) {
    throw apiError_(
      'CONFIG_ERROR',
      'Production API должен быть явно настроен в режиме только чтения.'
    );
  }
  if (!APP_CONFIG.spreadsheetId || !APP_CONFIG.expectedSpreadsheetName ||
      !Array.isArray(APP_CONFIG.sourceSheets) || !APP_CONFIG.sourceSheets.length ||
      APP_CONFIG.tokenSecret.length < 32) {
    throw apiError_('CONFIG_ERROR', 'Runtime-конфигурация backend неполна.');
  }
  APP_CONFIG.sourceSheets.forEach(function(config) {
    if (!config || !stringify_(config.name)) {
      throw apiError_('CONFIG_ERROR', 'SOURCE_SHEETS_JSON содержит пустое имя листа.');
    }
  });
  APP_CONFIG.runtimeHydrated = true;
}
