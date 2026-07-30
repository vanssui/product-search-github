# Production API configuration

This Apps Script project is an API layer separate from V12.06. Do not place
runtime values in Git, GitHub Actions, the frontend, logs, or documentation.

## Required Script Properties

- `ENVIRONMENT=production`
- `READ_ONLY=true`
- `SPREADSHEET_ID`
- `EXPECTED_SPREADSHEET_NAME`
- `SOURCE_SHEETS_JSON`
- `TOKEN_SECRET` (at least 32 characters)

`SOURCE_SHEETS_JSON` is a private adapter configuration:

```json
[
  {"name":"PRIVATE_SHEET_NAME","zone":"B3"}
]
```

The public API never returns Spreadsheet IDs, sheet names, row numbers, Drive
file IDs, or Script Properties.

## Write feature flags

Every flag defaults to `false`:

- `FEATURE_UPDATE_TASK`
- `FEATURE_UPLOAD_PHOTO`

`READ_ONLY=true` is the master switch and overrides every feature flag. The
manifest contains the Sheets and Drive scopes required by the two original
version 51 writes, but the master switch and both feature flags stay disabled
until a controlled production pilot.

Photo upload additionally requires private `PHOTO_FOLDER_ID`.

## Activation rule

Do not enable both writes at once. For each operation:

1. choose one explicitly approved safe production task;
2. save the current Script Properties and manifest as the rollback point;
3. grant only the minimum required OAuth scope;
4. set `READ_ONLY=false` and enable only one feature flag;
5. compare V12.06 and the new API result;
6. restore the task;
7. disable the feature immediately if parity is not exact.

The protected V12.06 project and deployment 51 are not part of this procedure.
