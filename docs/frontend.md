# Frontend

## Structure

- `src/pages/` — page orchestration and user scenarios.
- `src/components/` — pure HTML view builders for shell, filters, cards and
  details.
- `src/store/` — state container, persistence and catalog selectors.
- `src/api/` — versioned API client and product API facade.
- `src/types/` — public DTO documentation.
- `src/utils/` — business-neutral formatting and matching helpers.
- `src/ui/` — escaping and low-level UI helpers.
- `src/config/` — public build-time configuration only.

Compatibility re-export files at `src/api.js`, `src/state.js`, and
`src/utils.js` keep old imports working while callers move to the new modules.

## Runtime rules

- `VITE_BACKEND_URL` is the only backend connection setting.
- No Google IDs, sheet names, columns or Script Properties exist in frontend
  code.
- Initial load requests a bounded active snapshot; filtering then runs locally
  while the snapshot is complete.
- Explicit refresh requests `fresh=true`; background refreshes use the backend
  cache.
- Details restore from `sessionStorage` by opaque task token.
- Photo metadata and image bytes load only after the card is opened and the
  user requests the image.
- A timed-out write is confirmed through GET operation status; POST is never
  automatically repeated.

## Mobile-first behavior

Phone is the primary layout: one readable card column, a dedicated details
surface, large touch targets, no scaled desktop grid and no required horizontal
scroll. Tablet/desktop progressively enhance to a list-and-detail layout.

Supported CSS breakpoints cover approximately 360, 390, 430, 768 and 1024 px.
Any future visual change must pass `scrollWidth <= viewport width` and keep
primary action targets at least 44 px high.

## Performance metrics

The page records bounded in-memory timings at
`globalThis.__PRODUCT_SEARCH_METRICS__` for catalog load, pagination, task open,
photo load and failures. No task contents or personal data are sent to an
analytics service.
