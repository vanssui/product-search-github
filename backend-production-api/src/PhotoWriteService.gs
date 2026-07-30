function uploadTaskPhotoApi_(payload) {
  var taskToken = requireText_(payload.taskToken, 'taskToken', 120);
  var identity = requireIdentity_(payload);
  var context = getWritableTaskContextByToken_(taskToken, {
    photoRequired: true
  });

  var image = decodePhotoPayload_(payload);
  var folder = DriveApp.getFolderById(APP_CONFIG.photoFolderId);
  var file = folder.createFile(
    Utilities.newBlob(image.bytes, image.mimeType, image.fileName)
  );

  try {
    var existingIds = extractDriveFileIds_(
      getCell_(context.row, context.columns.photo)
    );
    var nextIds = existingIds
      .concat([file.getId()])
      .slice(-APP_CONFIG.maxPhotoIdsPerTask);
    context.sheet
      .getRange(context.rowNumber, context.columns.photo + 1)
      .setValue(nextIds.join('\n'));
    SpreadsheetApp.flush();
    clearSnapshotCache_();
    return {
      uploaded: true,
      photoToken: buildPhotoToken_(taskToken, file.getId()),
      fileName: file.getName(),
      photoCount: nextIds.length,
      message: 'Фото добавлено.',
      employeeId: identity.employeeId,
      taskToken: taskToken
    };
  } catch (error) {
    try {
      file.setTrashed(true);
    } catch (rollbackError) {
      console.error('Photo rollback failed: ' + rollbackError.message);
    }
    throw error;
  }
}

function decodePhotoPayload_(payload) {
  var dataUrl = requireText_(payload.dataUrl, 'dataUrl');
  var match = dataUrl.match(/^data:([^;]+);base64,([A-Za-z0-9+/=\s]+)$/);
  if (!match) {
    throw apiError_(
      'INVALID_IMAGE',
      'Изображение должно быть передано как base64 data URL.'
    );
  }
  var mimeType = stringify_(match[1]).toLowerCase();
  if (['image/jpeg', 'image/png', 'image/webp'].indexOf(mimeType) === -1) {
    throw apiError_('INVALID_MIME_TYPE', 'Разрешены JPEG, PNG и WebP.');
  }
  if (match[2].length > Math.ceil(APP_CONFIG.maxPhotoBytes * 4 / 3) + 16) {
    throw apiError_('PHOTO_TOO_LARGE', 'Фотография превышает допустимый размер.');
  }
  var bytes = Utilities.base64Decode(match[2]);
  if (bytes.length > APP_CONFIG.maxPhotoBytes) {
    throw apiError_('PHOTO_TOO_LARGE', 'Фотография превышает допустимый размер.');
  }
  return {
    bytes: bytes,
    mimeType: mimeType,
    fileName: buildSafePhotoName_(payload.fileName, mimeType)
  };
}

function buildSafePhotoName_(originalName, mimeType) {
  var extension = mimeType === 'image/png'
    ? 'png'
    : mimeType === 'image/webp' ? 'webp' : 'jpg';
  var base = stringify_(originalName)
    .replace(/\.[a-z0-9]{2,5}$/i, '')
    .replace(/[^a-zA-Z0-9а-яА-ЯёЁ._-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80);
  var stamp = Utilities.formatDate(
    new Date(),
    APP_CONFIG.timezone,
    'yyyyMMdd_HHmmss'
  );
  return (base || 'task_photo') + '_' + stamp + '.' + extension;
}
