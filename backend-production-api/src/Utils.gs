function apiError_(code, message) {
  var error = new Error(message);
  error.apiCode = code;
  return error;
}

function stringify_(value) {
  return String(value === null || value === undefined ? '' : value).trim();
}

function getCell_(row, index) {
  if (index < 0 || index >= row.length) return '';
  return row[index] === null || row[index] === undefined ? '' : row[index];
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

function requireText_(value, fieldName, maxLength) {
  var text = stringify_(value);
  if (!text) {
    throw apiError_(
      'VALIDATION_ERROR',
      'Не заполнено обязательное поле: ' + fieldName + '.'
    );
  }
  return maxLength ? text.slice(0, maxLength) : text;
}

function parseBoolean_(value) {
  var text = stringify_(value).toLowerCase();
  return text === '1' || text === 'true' || text === 'yes';
}

function parsePositiveInteger_(value, fallback, maximum) {
  var number = Number(value);
  if (!Number.isInteger(number) || number < 1) return fallback;
  return maximum ? Math.min(number, maximum) : number;
}

function normalizeSearch_(value) {
  return stringify_(value).replace(/\s+/g, ' ').toLowerCase();
}

function nowIso_() {
  return new Date().toISOString();
}

function webSafeHmac_(value) {
  hydrateRuntimeConfig_();
  var bytes = Utilities.computeHmacSha256Signature(
    String(value),
    APP_CONFIG.tokenSecret,
    Utilities.Charset.UTF_8
  );
  return Utilities.base64EncodeWebSafe(bytes).replace(/=+$/, '');
}

function sha256WebSafe_(value) {
  var bytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    String(value),
    Utilities.Charset.UTF_8
  );
  return Utilities.base64EncodeWebSafe(bytes).replace(/=+$/, '');
}

function normalizeEmployeeId_(value) {
  return requireText_(value, 'employeeId', 64).toUpperCase();
}

function requireIdentity_(payload) {
  return {
    employeeId: normalizeEmployeeId_(payload.employeeId)
  };
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
