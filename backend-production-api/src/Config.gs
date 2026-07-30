var APP_CONFIG = {
  projectName: 'Product Search Production API',
  timezone: 'Europe/Moscow',
  environment: '',
  readOnly: true,
  spreadsheetId: '',
  expectedSpreadsheetName: '',
  sourceSheets: [],
  tokenSecret: '',
  photoFolderId: '',
  zoneNames: ['B3', 'B4', 'B5'],
  activeStatus: 'Поиск',
  foundStatus: 'Найдено',
  notFoundStatus: 'Не найдено',
  cachePrefix: 'prod_catalog_v3_',
  photoCachePrefix: 'prod_photo_v1_',
  cacheSeconds: 300,
  photoCacheSeconds: 600,
  maxTailRowsPerSheet: 5000,
  maxPageSize: 100,
  maxPhotoIdsPerTask: 6,
  maxPhotoBytes: 8 * 1024 * 1024,
  maxPhotoCacheBytes: 650000,
  maxCacheBytes: 850000,
  cacheChunkSize: 75000,
  writeLockTimeoutMs: 45000,
  claimTtlMs: 10 * 60 * 1000,
  idempotencyTtlMs: 24 * 60 * 60 * 1000,
  requireClaimForCompletion: false,
  writeFeatures: {}
};

var WRITE_FEATURE_PROPERTIES_ = {
  takeTask: 'FEATURE_TAKE_TASK',
  releaseTask: 'FEATURE_RELEASE_TASK',
  markFound: 'FEATURE_COMPLETE_TASK',
  markNotFound: 'FEATURE_COMPLETE_TASK',
  updateTask: 'FEATURE_COMPLETE_TASK',
  completeTask: 'FEATURE_COMPLETE_TASK',
  uploadTaskPhoto: 'FEATURE_UPLOAD_PHOTO',
  updateEmployee: 'FEATURE_UPDATE_EMPLOYEE'
};

function hydrateRuntimeConfig_() {
  if (APP_CONFIG.runtimeHydrated) return;

  var properties = PropertiesService.getScriptProperties();
  APP_CONFIG.environment = stringify_(properties.getProperty('ENVIRONMENT'));
  APP_CONFIG.readOnly = propertyIsTrue_(properties, 'READ_ONLY', true);
  APP_CONFIG.spreadsheetId = stringify_(properties.getProperty('SPREADSHEET_ID'));
  APP_CONFIG.expectedSpreadsheetName = stringify_(
    properties.getProperty('EXPECTED_SPREADSHEET_NAME')
  );
  APP_CONFIG.sourceSheets = safeJsonParse_(
    properties.getProperty('SOURCE_SHEETS_JSON'),
    []
  );
  APP_CONFIG.tokenSecret = stringify_(properties.getProperty('TOKEN_SECRET'));
  APP_CONFIG.photoFolderId = stringify_(properties.getProperty('PHOTO_FOLDER_ID'));
  APP_CONFIG.requireClaimForCompletion = propertyIsTrue_(
    properties,
    'REQUIRE_CLAIM_FOR_COMPLETION',
    false
  );
  APP_CONFIG.writeFeatures = {};
  Object.keys(WRITE_FEATURE_PROPERTIES_).forEach(function(action) {
    APP_CONFIG.writeFeatures[action] = propertyIsTrue_(
      properties,
      WRITE_FEATURE_PROPERTIES_[action],
      false
    );
  });

  if (APP_CONFIG.environment !== 'production') {
    throw apiError_('CONFIG_ERROR', 'Backend должен быть настроен как production API.');
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

function propertyIsTrue_(properties, key, fallback) {
  var value = properties.getProperty(key);
  if (value === null || value === undefined || value === '') return Boolean(fallback);
  return stringify_(value).toLowerCase() === 'true';
}
