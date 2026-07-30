# Backend

The production API is a separate Apps Script project. It does not import or
deploy V12.06.

## Modules

- `Api.gs` — v1 allow-list router and response envelope.
- `Config.gs` — private runtime configuration and feature flags.
- `CatalogService.gs` — active snapshot, mapping, filtering, pagination and
  opaque task tokens.
- `StatisticsService.gs` — aggregate business DTOs.
- `PhotoReadService.gs` — membership validation, opaque photo tokens and lazy
  cached reads.
- `SpreadsheetService.gs` — schema discovery and exact-row write adapter.
- `ClaimService.gs` — optional employee/session ownership.
- `TaskWriteService.gs` — completion state transitions.
- `PhotoWriteService.gs` — validated Drive upload plus Sheets reference update.
- `IdempotencyService.gs` — durable operation states and global write lock.
- `FeatureFlags.gs` — capabilities and per-operation gates.
- `Utils.gs` — validation, hashing, encoding and common helpers.

## Data access

The adapter reads only configured source sheets and the last bounded tail of
each source. Header aliases are resolved server-side. Only rows whose search
status equals the active production status become catalog tasks.

Writes never scan the whole snapshot under lock. The signed task token resolves
to an allow-listed source index and row; the adapter rereads the exact header
and row and verifies the token against stable business fields.

## Cache

- Chunked task snapshot: 5 minutes.
- Explicit user refresh clears only the task snapshot.
- Photo payload: up to 10 minutes when it fits the Apps Script cache limit.
- Photos larger than the safe cache budget remain uncached.
- Successful writes clear the task snapshot.

Cache is an optimization, never a write source of truth.

## Concurrency

Write operations execute under ScriptLock. Completion rereads the current row
status inside the critical section, so the first successful completion wins.
Claims add a stronger optional ownership layer without changing V12.06
semantics unless explicitly enabled.
