# Data contract and source adapters

Google Sheets remains the production record store, but its physical schema is
private backend configuration.

## Business task DTO

The public task contract includes:

- opaque task token;
- block/zone;
- item ID, WB sticker(s), item name, MX and BOX;
- floor, row, place, shelf and cell;
- picker and employee IDs;
- item/search/extra statuses;
- action, report and comment;
- created/time-filled values;
- `hasPhoto` and `photoCount`.

It intentionally excludes Spreadsheet ID, sheet name, row number, header names,
Drive file IDs and folder IDs.

## Mapping rules preserved from V12.06

- Active task status is `Поиск`.
- Sources are selected only from the private allow-list.
- Block comes from configured source mapping, then MX/source fallback rules.
- Route uses explicit floor/row when present and MX-derived location otherwise.
- Completion results are only `Найдено` or `Не найдено`.
- Search covers the business identifiers and content fields, not storage
  metadata.

## Schema changes

When a sheet header changes:

1. add or adjust a backend header alias;
2. validate the exact source in read-only mode;
3. compare catalog counts and representative cards with V12.06;
4. deploy a new immutable backend version;
5. do not change frontend DTOs unless the business concept itself changed.
