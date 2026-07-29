# Runtime configuration

Реальные идентификаторы Google не хранятся в Git. После создания отдельного Apps Script-проекта владелец задаёт значения непосредственно в его Script Properties:

- `SPREADSHEET_ID`
- `PHOTO_FOLDER_ID`
- `SPREADSHEET_NAME_PREFIX`
- `SOURCE_SHEETS_JSON`

Пример формы `SOURCE_SHEETS_JSON` с вымышленными именами:

```json
[
  { "name": "TEST_ZONE_A", "zone": "B3" },
  { "name": "TEST_ZONE_B", "zone": "B4" }
]
```

Значения, экспорт Script Properties, `.clasp.json`, OAuth credentials и deployment URL не должны коммититься.
