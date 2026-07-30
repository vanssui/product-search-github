# Production read-only completion baseline

Updated: 30 July 2026.

## Source of truth

- V12.06 version 51 code and behavior were audited.
- The actual production spreadsheet, configured sources and real fields were
  read without changing code, triggers, properties, rows or Drive files.
- V12.06/version 51 remains untouched.

## Preserved business model

The backend scans a bounded tail of five privately configured sources. Only
rows with search status `Поиск` and a resolvable B3/B4/B5 block enter the active
catalog.

Block mapping, MX route parsing, explicit floor/row precedence, item/WB/MX/BOX
fields, employee filters, photo presence and terminal results
`Найдено`/`Не найдено` follow the audited v51 rules.

Reports and ID statistics in v51 are local parsers for manually pasted TSV;
they are not hidden production sheets or API write functions.

## Live parity evidence

During the final API v1 check, the real table was changing as employees added
tasks. An explicit refresh was therefore added to bypass the five-minute read
cache only on user request.

On the same refreshed snapshot, both interfaces showed:

- 72 active tasks;
- B3 = 4;
- B5 = 68;
- B3 floors: 2 = 2, 3 = 1, 7 = 1;
- the same first B3 tasks, WB stickers, names, MX and routes.

Minutes later the separate API correctly showed the newly arrived B4 and B3
rows as the total advanced to 74. This is live data movement, not a parity
failure.

## Implemented read functionality

- real blocks, counts, floors, active catalog and route order;
- search, all blocks, my tasks and photo filter;
- business cards and complete details;
- paginated/complete bounded snapshot;
- explicit fresh refresh plus cached background refresh;
- statistics endpoint;
- lazy photo metadata and image payload;
- selected-task restoration;
- mobile detail surface and tablet/desktop split layout;
- in-memory performance metrics.

## Storage independence

The public task contract contains no Spreadsheet ID, sheet name, row number or
Drive file ID. The frontend receives only business DTOs plus signed opaque task
and photo tokens.

## Current write state

The write services are implemented but disabled:

- take/release claim;
- found/not-found/completion;
- photo upload;
- employee identity normalization;
- idempotency and GET operation confirmation.

Production deployment reports all write capabilities false and rejects a POST
with `READ_ONLY`. Its manifest has only readonly OAuth scopes.

## Known functional gaps

| Scenario | V12.06 | GitHub/API | State |
|---|---|---|---|
| Read catalog and cards | production | production | parity confirmed |
| Search/item ID | item ID not explicit | item ID included | intentional extension |
| Reports | local pasted TSV parser | absent | not yet migrated |
| ID statistics | local pasted TSV parser | API aggregates exist, pasted workflow absent | partial |
| Completion | first-write-wins | implemented, disabled | needs approved one-task pilot |
| Photo upload | Drive + row reference | implemented, disabled | needs approved one-task pilot |
| take/release claim | absent | implemented, disabled | optional enhancement decision |
