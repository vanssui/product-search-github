function uploadTaskPhotoApi_(payload) {
  var lock = LockService.getScriptLock();
  lock.waitLock(APP_CONFIG.lockTimeoutMs);
  try {
    var context = getRowContext_(payload, true);
    ensureOwnership_(context, payload);
    if (!isActiveStatus_(getCell_(context.row, context.columns.statusSearch))) {
      throw apiError_('TASK_CLOSED', 'Нельзя добавить фото к закрытому заданию.');
    }
    if (context.columns.photo < 0) {
      throw apiError_('SCHEMA_ERROR', 'Не найдена колонка "Фото товара".');
    }

    var dataUrl = requireText_(payload.dataUrl, 'dataUrl');
    var match = dataUrl.match(/^data:([^;]+);base64,([A-Za-z0-9+/=\s]+)$/);
    if (!match) throw apiError_('INVALID_IMAGE', 'Изображение должно быть передано как base64 data URL.');
    var mimeType = stringify_(match[1]).toLowerCase();
    if (APP_CONFIG.allowedPhotoMimeTypes.indexOf(mimeType) === -1) {
      throw apiError_('INVALID_MIME_TYPE', 'Разрешены JPEG, PNG и WebP.');
    }
    if (match[2].length > Math.ceil(APP_CONFIG.maxPhotoBytes * 4 / 3) + 16) {
      throw apiError_('PHOTO_TOO_LARGE', 'Размер фотографии превышает 5 МБ.');
    }
    var bytes = Utilities.base64Decode(match[2]);
    if (bytes.length > APP_CONFIG.maxPhotoBytes) {
      throw apiError_('PHOTO_TOO_LARGE', 'Размер фотографии превышает 5 МБ.');
    }

    var fileName = buildSafePhotoName_(payload.fileName, mimeType);
    var blob = Utilities.newBlob(bytes, mimeType, fileName);
    var folder = DriveApp.getFolderById(APP_CONFIG.photoFolderId);
    var file = folder.createFile(blob);
    var existingIds = extractDriveFileIds_(getCell_(context.row, context.columns.photo));
    var nextIds = existingIds.concat([file.getId()]).slice(-APP_CONFIG.maxPhotoIdsPerTask);
    context.sheet.getRange(context.rowNumber, context.columns.photo + 1).setValue(nextIds.join('\n'));
    SpreadsheetApp.flush();
    clearTaskCache_();
    return {
      fileId: file.getId(),
      fileIds: nextIds,
      photoCount: nextIds.length,
      fileName: file.getName()
    };
  } finally {
    lock.releaseLock();
  }
}

function getTaskPhotoApi_(payload) {
  hydrateRuntimeConfig_();
  var fileId = extractDriveFileIds_(requireText_(payload.fileId, 'fileId', 200))[0];
  if (!fileId) throw apiError_('PHOTO_NOT_FOUND', 'Фото не найдено.');
  var file = DriveApp.getFileById(fileId);
  var parents = file.getParents();
  var allowed = false;
  while (parents.hasNext()) {
    if (parents.next().getId() === APP_CONFIG.photoFolderId) {
      allowed = true;
      break;
    }
  }
  if (!allowed) throw apiError_('PHOTO_NOT_ALLOWED', 'Фото не относится к тестовой папке.');
  var blob = file.getBlob();
  return {
    fileId: fileId,
    fileName: file.getName(),
    mimeType: blob.getContentType(),
    base64: Utilities.base64Encode(blob.getBytes())
  };
}

function buildSafePhotoName_(originalName, mimeType) {
  var extension = mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : 'jpg';
  var base = stringify_(originalName)
    .replace(/\.[a-z0-9]{2,5}$/i, '')
    .replace(/[^a-zA-Z0-9а-яА-Я._-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80);
  var stamp = Utilities.formatDate(new Date(), APP_CONFIG.timezone, 'yyyyMMdd_HHmmss');
  return (base || 'task_photo') + '_' + stamp + '.' + extension;
}

function extractDriveFileIds_(value) {
  var matches = stringify_(value).match(/[-\w]{25,}/g) || [];
  var unique = {};
  matches.forEach(function(id) { unique[id] = true; });
  return Object.keys(unique);
}
