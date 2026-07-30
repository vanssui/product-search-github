# Adding functionality

## New read feature

1. Define a business DTO without storage identifiers.
2. Add a backend service method and allow-listed API action.
3. Add the method to `ProductSearchApi`.
4. Put orchestration in a Page, state in Store and presentation in Components.
5. Add unit tests and compare the result with the source-of-truth workflow.

## New write feature

1. Document the existing production rule and edge cases.
2. Implement exact-row validation and the smallest possible mutation.
3. Add a dedicated feature flag.
4. Include all mutation inputs in the idempotency fingerprint.
5. Test duplicate requests, two sessions, timeout confirmation, stale task,
  closed task and rollback.
6. Enable only for one approved task and compare with V12.06.

## New page or layout

Pages may reuse API methods and stores without changing the backend. A new
layout must consume the same business DTOs; it must not add parsing of source
rows, sheet names or Drive URLs.

## Review checklist

- no private IDs or credentials;
- no new table knowledge in frontend;
- stable versioned API contract;
- mobile behavior before desktop polish;
- bounded backend reads and lazy heavy data;
- write idempotency and recovery path;
- documented parity difference when behavior intentionally changes.
