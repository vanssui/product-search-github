function getCapabilitiesApi_() {
  hydrateRuntimeConfig_();
  return getCapabilities_();
}

function getCapabilities_() {
  hydrateRuntimeConfig_();
  var write = {};
  Object.keys(WRITE_FEATURE_PROPERTIES_).forEach(function(action) {
    write[action] = !APP_CONFIG.readOnly &&
      APP_CONFIG.writeFeatures[action] === true;
  });
  return {
    apiVersion: API_VERSION_,
    read: {
      catalog: true,
      task: true,
      statistics: true,
      photos: true,
      operationStatus: true
    },
    write: write,
    masterReadOnly: APP_CONFIG.readOnly,
    requireClaimForCompletion: APP_CONFIG.requireClaimForCompletion
  };
}

function assertWriteActionEnabled_(action) {
  hydrateRuntimeConfig_();
  if (APP_CONFIG.readOnly) {
    throw apiError_(
      'READ_ONLY',
      'Production backend работает в режиме только чтения.'
    );
  }
  if (!WRITE_FEATURE_PROPERTIES_[action] ||
      APP_CONFIG.writeFeatures[action] !== true) {
    throw apiError_(
      'FEATURE_DISABLED',
      'Эта операция записи ещё не включена.'
    );
  }
  if (action === 'uploadTaskPhoto' && !APP_CONFIG.photoFolderId) {
    throw apiError_(
      'CONFIG_ERROR',
      'Для загрузки фото не настроена production-папка.'
    );
  }
}
