# Production read-only API

This Apps Script project is a separate API layer. It does not update or deploy
the production V12.06 project.

Required Script Properties:

- `ENVIRONMENT=production`
- `READ_ONLY=true`
- `SPREADSHEET_ID`
- `EXPECTED_SPREADSHEET_NAME`
- `SOURCE_SHEETS_JSON`
- `TOKEN_SECRET`

`SOURCE_SHEETS_JSON` has this shape:

```json
[
  {"name":"SOURCE_A","zone":"B3"},
  {"name":"SOURCE_B","zone":"B4"}
]
```

The real values belong only in Script Properties. Do not add them to this
repository, Actions variables, frontend environment variables, logs, or URLs.

The deployed read-only build accepts only `GET` actions. Every `POST` returns
`READ_ONLY`.
