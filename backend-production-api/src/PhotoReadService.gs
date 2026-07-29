function getTaskPhotoApi_(payload) {
  var taskToken = stringify_(payload.taskToken);
  var fileId = stringify_(payload.fileId);
  if (!taskToken || !fileId) {
    throw apiError_('VALIDATION_ERROR', 'Не указан идентификатор задания или фото.');
  }

  var task = findTaskByToken_(getTaskSnapshot_().tasks, taskToken);
  if (!task) {
    throw apiError_('TASK_NOT_FOUND', 'Задание больше не находится в активном поиске.');
  }
  if (task.photoFileIds.indexOf(fileId) === -1) {
    throw apiError_('PHOTO_NOT_ALLOWED', 'Фото не связано с выбранным заданием.');
  }

  var file = DriveApp.getFileById(fileId);
  if (file.getSize() > APP_CONFIG.maxPhotoBytes) {
    throw apiError_('PHOTO_TOO_LARGE', 'Фото слишком большое для просмотра в приложении.');
  }
  var blob = file.getBlob();
  var mimeType = stringify_(blob.getContentType());
  if (mimeType.indexOf('image/') !== 0) {
    throw apiError_('PHOTO_INVALID', 'Связанный файл не является изображением.');
  }
  return {
    fileId: fileId,
    fileName: file.getName(),
    mimeType: mimeType,
    base64: Utilities.base64Encode(blob.getBytes())
  };
}
