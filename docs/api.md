# Product Search API v1

The frontend communicates only with this JSON API. It does not know the
Spreadsheet ID, sheet names, row numbers, Drive file IDs, Script Properties, or
column layout.

All requests include `apiVersion=v1`. POST bodies use
`Content-Type: text/plain;charset=utf-8` so Apps Script does not require a CORS
preflight.

## Envelope

Success:

```json
{
  "ok": true,
  "data": {},
  "error": null,
  "requestId": "uuid",
  "timestamp": "2026-07-30T00:00:00.000Z",
  "meta": {
    "apiVersion": "v1",
    "readOnly": true,
    "serverDurationMs": 420
  }
}
```

Failure:

```json
{
  "ok": false,
  "data": null,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Понятное сообщение"
  },
  "requestId": "uuid",
  "timestamp": "2026-07-30T00:00:00.000Z",
  "meta": {
    "apiVersion": "v1",
    "readOnly": true,
    "serverDurationMs": 35
  }
}
```

## Read endpoints

| HTTP | `action` | Purpose |
|---|---|---|
| GET | `health` | Runtime mode, API version and source count |
| GET | `getCapabilities` | Enabled read/write capabilities |
| GET | `getCatalog` | Paginated active catalog and facets |
| GET | `getTask` | Fresh active task by opaque `taskToken` |
| GET | `getStatistics` | Counts by block, floor, status and employee |
| GET | `getTaskPhotos` | Opaque photo references for one task |
| GET | `getTaskPhoto` | Lazy image payload by `photoToken` |
| GET | `getOperationStatus` | Confirm a timed-out write without repeating it |

`getCatalog` accepts `zone`, `floor`, `query`, `photoOnly`, `myOnly`,
`employeeId`, `page`, `pageSize`, and `fresh`. `fresh=true` is reserved for an
explicit user refresh and invalidates only the read snapshot cache.

The task projection contains business fields only: opaque `taskToken`, zone,
item/WB/MX/BOX/location fields, statuses, employee/picker IDs, action, comment,
time, and photo count. It does not contain the physical source location.

`getTaskPhotos` returns:

```json
{
  "taskToken": "opaque",
  "photoCount": 1,
  "photos": [
    {
      "photoToken": "opaque",
      "index": 0,
      "contentEndpoint": "getTaskPhoto"
    }
  ]
}
```

## Write endpoints

| HTTP | `action` | Required fields | Current state |
|---|---|---|---|
| POST | `takeTask` | identity, `taskToken`, idempotency key | disabled |
| POST | `releaseTask` | identity, `taskToken`, idempotency key | disabled |
| POST | `markFound` | identity, `taskToken`, idempotency key | disabled |
| POST | `markNotFound` | identity, `taskToken`, idempotency key | disabled |
| POST | `completeTask` | identity, task, result, idempotency key | disabled |
| POST | `updateTask` | compatibility alias of completion | disabled |
| POST | `uploadTaskPhoto` | identity, task, image, idempotency key | disabled |
| POST | `updateEmployee` | identity, idempotency key | disabled |

Identity is `{employeeId, sessionId}`. Every write also requires a unique
`idempotencyKey`.

`READ_ONLY=true` currently overrides all endpoint flags. The read-only OAuth
manifest is a second independent barrier.

## Write safety contract

- A signed opaque task token binds the configured source index, row, item ID,
  WB sticker and MX without exposing the source.
- The exact row is reread before a write; a changed row returns `TASK_CHANGED`.
- A closed task cannot be claimed from a stale catalog.
- A global Apps Script lock serializes critical write sections.
- The same idempotency key and payload return the original result.
- Reusing a key with another payload returns `IDEMPOTENCY_KEY_REUSED`.
- A pending operation is never automatically re-executed.
- After a timeout, the frontend performs GET `getOperationStatus`; it never
  sends a second POST automatically.
- Claims are owned by `employeeId + sessionId` and expire after ten minutes.
- Completion preserves V12.06 first-write-wins unless
  `REQUIRE_CLAIM_FOR_COMPLETION=true` is separately approved.
- Upload accepts JPEG, PNG and WebP, updates only the configured task row, and
  trashes the newly created file if the Sheets update fails.

## Error codes

Important stable codes include `READ_ONLY`, `FEATURE_DISABLED`,
`API_VERSION_UNSUPPORTED`, `TASK_NOT_FOUND`, `TASK_CHANGED`, `TASK_CLOSED`,
`TASK_LOCKED`, `NOT_TASK_OWNER`, `TASK_NOT_CLAIMED`,
`IDEMPOTENCY_KEY_REUSED`, `OPERATION_IN_PROGRESS`, `BACKEND_BUSY`,
`PHOTO_NOT_ALLOWED`, `PHOTO_TOO_LARGE`, and `SCHEMA_ERROR`.

## Apps Script constraints

Apps Script web apps answer through a Google redirect. Browser CORS behavior
must be smoke-tested after each deployment. Requests are subject to Apps Script
execution-time and service quotas; the client therefore treats a lost response
as an unknown result and confirms by idempotency key.
