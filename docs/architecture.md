# Architecture

```text
GitHub Pages
┌──────────────────────────────────────────────┐
│ Pages → Components → Store → API client      │
│ UI knows only business DTOs and capabilities │
└──────────────────────┬───────────────────────┘
                       │ HTTPS JSON API v1
                       ▼
Separate Apps Script API
┌──────────────────────────────────────────────┐
│ Router → services → private adapters         │
│ auth/config/locks/idempotency/cache/validation│
└───────────────┬───────────────────┬──────────┘
                │                   │
                ▼                   ▼
        Google Sheets          Google Drive
        business records       task photos
```

## Boundaries

- GitHub Pages owns presentation, navigation, local filters, transient UI state
  and performance metrics.
- The API owns business DTOs, validation, source mapping, status transitions,
  concurrency, idempotency, cache invalidation, Sheets access and Drive access.
- Sheets and Drive remain the source of truth.
- V12.06/version 51 remains an independent parallel client until a separate
  cutover approval.

The frontend receives opaque task and photo tokens. Changing a sheet name,
column position, source order, or Drive file ID requires only an adapter/config
change in the separate backend, not a frontend change.

## Dependency direction

`Pages → Components → Store → ProductSearchApi → ApiClient`

Components do not call `fetch`. Store code does not parse Sheets rows. The API
router does not depend on buttons, cards, breakpoints or routes.

Backend dependency direction:

`Api router → domain services → Spreadsheet/Drive adapters`

Cross-cutting services provide runtime configuration, feature flags,
idempotency, locking, token signing and cache management.

## Current safety boundary

Read parity is deployed. Write code exists behind three independent gates:

1. master `READ_ONLY=true`;
2. every write feature flag is false;
3. the manifest contains only readonly OAuth scopes.

This is intentionally not declared a completed migration until each production
write scenario has passed an approved one-task parity test.
