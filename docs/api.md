# JSON API нового backend

Все ответы имеют единый envelope.

Успех:

```json
{
  "ok": true,
  "data": {},
  "error": null,
  "requestId": "uuid",
  "timestamp": "2026-07-29T00:00:00.000Z",
  "meta": {
    "serverDurationMs": 1200
  }
}
```

Ошибка:

```json
{
  "ok": false,
  "data": null,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Понятное сообщение"
  },
  "requestId": "uuid",
  "timestamp": "2026-07-29T00:00:00.000Z"
}
```

## Чтение

| HTTP | Action | Параметры | Назначение |
|---|---|---|---|
| GET | `health` | — | состояние test backend |
| GET | `getTasks` | — | активные строки всех разрешённых листов |
| GET | `getTaskDetails` | `sheetName`, `rowNumber`, `taskToken` | перечитать конкретную строку |
| GET | `getTaskPhoto` | `fileId` | получить тестовое фото как base64 |
| GET | `getOperationStatus` | `writeAction`, `idempotencyKey` | read-only подтверждение результата записи после timeout |
| GET | `getTestEnvironmentStatus` | — | test-only счётчики задач, фото и временных свойств |

## Запись

POST-body отправляется как JSON с `Content-Type: text/plain;charset=utf-8`, чтобы не инициировать CORS preflight, который Apps Script не обрабатывает.

| Action | Обязательные поля | Назначение |
|---|---|---|
| `takeTask` | identity + task + `idempotencyKey` | взять задание на 10 минут |
| `releaseTask` | identity + task + `idempotencyKey` | освободить своё задание |
| `updateTask` | identity + task + `newStatus`, `idempotencyKey` | совместимый alias завершения |
| `completeTask` | identity + task + `newStatus`, `idempotencyKey` | записать результат |
| `uploadTaskPhoto` | identity + task + file fields, `idempotencyKey` | добавить фото |

Identity:

```json
{
  "employeeId": "E017",
  "sessionId": "browser-session-uuid"
}
```

Task identity:

```json
{
  "sheetName": "Выгрузка Б3",
  "rowNumber": 2,
  "taskToken": "sha256-web-safe-token"
}
```

Разрешённые конечные статусы: `Найдено`, `Не найдено`.

## Защита

- allow-list actions;
- allow-list листов;
- целый `rowNumber >= 2`;
- `taskToken` включает лист, строку, item ID, WB и MX;
- ScriptLock для критических секций;
- владелец — пара `employeeId + sessionId`;
- claim TTL — 10 минут;
- обязательный idempotency key для каждой записи;
- потерянный или долгий POST-ответ не запускает второй POST: frontend опрашивает
  `getOperationStatus` с исходным idempotency key;
- серверный MIME allow-list: JPEG, PNG, WebP;
- максимальный декодированный размер фото — 5 МБ;
- чтение фото разрешено только из тестовой папки;
- ошибки журналируются без тела фото и персональных данных.

## Важное ограничение Apps Script

`ContentService` не позволяет приложению задавать произвольные CORS headers.
В deployment тестового backend Google возвращает `Access-Control-Allow-Origin: *`
для redirect и конечного JSON-ответа; это проверяется реальным браузером после
каждого изменения deployment.
