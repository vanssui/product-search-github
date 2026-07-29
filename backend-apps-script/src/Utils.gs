function apiError_(code, message) {
  var error = new Error(message);
  error.apiCode = code;
  return error;
}

function requireText_(value, fieldName, maxLength) {
  var text = stringify_(value);
  if (!text) throw apiError_('VALIDATION_ERROR', 'Поле "' + fieldName + '" обязательно.');
  if (maxLength && text.length > maxLength) {
    throw apiError_('VALIDATION_ERROR', 'Поле "' + fieldName + '" слишком длинное.');
  }
  return text;
}

function stringify_(value) {
  return String(value === null || value === undefined ? '' : value).trim();
}

function getCell_(row, index) {
  if (index < 0 || index >= row.length) return '';
  return row[index] === null || row[index] === undefined ? '' : row[index];
}

function hashWebSafe_(value) {
  var digest = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    String(value),
    Utilities.Charset.UTF_8
  );
  return Utilities.base64EncodeWebSafe(digest).replace(/=+$/, '');
}

function nowIso_() {
  return new Date().toISOString();
}

function getSpreadsheet_() {
  hydrateRuntimeConfig_();
  var spreadsheet = SpreadsheetApp.openById(APP_CONFIG.spreadsheetId);
  if (APP_CONFIG.environment === 'test' && APP_CONFIG.spreadsheetNamePrefix &&
      spreadsheet.getName().indexOf(APP_CONFIG.spreadsheetNamePrefix) !== 0) {
    throw apiError_('CONFIG_ERROR', 'Тестовый backend отказался открывать таблицу с неожиданным названием.');
  }
  return spreadsheet;
}

function isAllowedSheet_(sheetName) {
  hydrateRuntimeConfig_();
  return APP_CONFIG.sourceSheets.some(function(config) {
    return config.name === sheetName;
  });
}

function getScriptCache_() {
  try {
    return CacheService.getScriptCache();
  } catch (error) {
    return null;
  }
}

function clearTaskCache_() {
  var cache = getScriptCache_();
  if (cache) cache.remove(APP_CONFIG.cacheKey);
}

function safeJsonParse_(value, fallback) {
  try {
    return JSON.parse(value);
  } catch (error) {
    return fallback;
  }
}

function clampText_(value, maxLength) {
  return stringify_(value).slice(0, maxLength);
}
