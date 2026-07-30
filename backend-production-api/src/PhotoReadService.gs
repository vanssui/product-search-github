function getTaskPhotosApi_(payload) {
  var task = requireActiveTaskForPhoto_(payload);
  return {
    taskToken: task.taskToken,
    photoCount: task.photoFileIds.length,
    photos: task.photoFileIds.map(function(fileId, index) {
      return {
        photoToken: buildPhotoToken_(task.taskToken, fileId),
        index: index,
        contentEndpoint: 'getTaskPhoto'
      };
    })
  };
}

function getTaskPhotoApi_(payload) {
  var task = requireActiveTaskForPhoto_(payload);
  var photoToken = requireText_(payload.photoToken, 'photoToken', 120);
  var fileId = resolvePhotoFileId_(task, photoToken);
  if (!fileId) {
    throw apiError_('PHOTO_NOT_ALLOWED', 'Фото не связано с выбранным заданием.');
  }

  var cached = readPhotoCache_(fileId);
  if (cached) return cached;

  var file = DriveApp.getFileById(fileId);
  if (file.getSize() > APP_CONFIG.maxPhotoBytes) {
    throw apiError_('PHOTO_TOO_LARGE', 'Фото слишком большое для просмотра в приложении.');
  }
  var blob = file.getBlob();
  var mimeType = stringify_(blob.getContentType());
  if (mimeType.indexOf('image/') !== 0) {
    throw apiError_('PHOTO_INVALID', 'Связанный файл не является изображением.');
  }
  var result = {
    fileName: file.getName(),
    mimeType: mimeType,
    base64: Utilities.base64Encode(blob.getBytes())
  };
  writePhotoCache_(fileId, result);
  return result;
}

function buildPhotoToken_(taskToken, fileId) {
  return webSafeHmac_([
    'photo-v1',
    taskToken,
    fileId
  ].join('|'));
}

function resolvePhotoFileId_(task, photoToken) {
  for (var index = 0; index < task.photoFileIds.length; index += 1) {
    var fileId = task.photoFileIds[index];
    if (buildPhotoToken_(task.taskToken, fileId) === photoToken) return fileId;
  }
  return '';
}

function requireActiveTaskForPhoto_(payload) {
  var taskToken = stringify_(payload.taskToken);
  if (!taskToken) {
    throw apiError_('VALIDATION_ERROR', 'Не указан идентификатор задания.');
  }
  var task = findTaskByToken_(getTaskSnapshot_().tasks, taskToken);
  if (!task) {
    throw apiError_('TASK_NOT_FOUND', 'Задание больше не находится в активном поиске.');
  }
  return task;
}

function photoCacheBaseKey_(fileId) {
  return APP_CONFIG.photoCachePrefix + webSafeHmac_(fileId).slice(0, 32) + '_';
}

function readPhotoCache_(fileId) {
  var cache = getScriptCache_();
  if (!cache) return null;
  var base = photoCacheBaseKey_(fileId);
  var meta = safeJsonParse_(cache.get(base + 'meta'), null);
  if (!meta || !meta.chunks || meta.chunks > 12) return null;
  var parts = [];
  for (var index = 0; index < meta.chunks; index += 1) {
    var part = cache.get(base + 'chunk_' + index);
    if (!part) return null;
    parts.push(part);
  }
  return safeJsonParse_(parts.join(''), null);
}

function writePhotoCache_(fileId, photo) {
  var cache = getScriptCache_();
  if (!cache) return;
  var serialized = JSON.stringify(photo);
  if (serialized.length > APP_CONFIG.maxPhotoCacheBytes) return;
  var base = photoCacheBaseKey_(fileId);
  var chunks = [];
  for (var offset = 0; offset < serialized.length; offset += APP_CONFIG.cacheChunkSize) {
    chunks.push(serialized.slice(offset, offset + APP_CONFIG.cacheChunkSize));
  }
  var values = {};
  chunks.forEach(function(chunk, index) {
    values[base + 'chunk_' + index] = chunk;
  });
  values[base + 'meta'] = JSON.stringify({ chunks: chunks.length });
  cache.putAll(values, APP_CONFIG.photoCacheSeconds);
}
