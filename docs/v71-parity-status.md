# GitHub Pages ↔ v71 parity checkpoint (23 November 2026)

**Status: VISUAL MIRROR + READ-ONLY EXPERIMENT. NOT a production replacement.**

## Exact visual source
- /v71/index.html: the exact SaaS UI HTML, CSS and frontend JS from immutable production v71, with server template includes expanded.
- /v71/classic.html: exact classic UI in the same format.
- frontend/public/v71/V71_SOURCE_HASHES.json: SHA-256 of the seven upstream UI source files.
- Only a safe transport adapter and an unobtrusive notice were added.
- No actual Google Apps Script source, deployment, source spreadsheet, or staff records are changed.

## Browser transport
GitHub Pages is static hosting and cannot execute google.script.run outside Google's HtmlService runtime.

The standalone bridge.js does:
- Read API v1 active catalog pages and build task lists, zone/floor totals.
- Map public business task DTOs into the original v71 frontend, without exposing physical row IDs.
- Read task photos through API v1 photo tokens.
- Support the google.script.run success and failure callback syntax, with no write RPC calls.
- Block status updates and photo uploads instead of sending incompatible writes.
- Show a clear error for v71 period-based analytics, not fabricated data.

## Critical gaps before functional 1:1
1. Old API v1 uses a different task identity and status-writing path. It writes M and U separately, unlike the atomic v71 M/U/AE plus durable receipt ledger. No safe write parity has been verified.
2. Old API catalog may omit active tasks outside its fixed 5,000-row tail per source sheet. Production v71 reads active tasks throughout much larger sheets. The API also caps one page at 100 tasks, unlike the v71 cached full snapshot. Equality to v71 is not established.
3. API v1 currently returns updateTask/uploadTaskPhoto enabled in its public health endpoint even though July documentation says read-only. That contradiction is NOT evidence of safe v71 compatibility.
4. The old API is itself hosted on script.google.com. It does not bypass browser/ISP blocks of that host, even when GitHub Pages loads successfully.
5. v71 period analytics do not exist in API v1.
6. Physical Android, MAX WebView and corporate-Wi-Fi connectivity still need testing.

Do not merge this branch as a production replacement, advertise it as a working writable application, or enable writes without a separate compatible backend and full data/parity validation.

## Reproducible local build
- python3 tools/sync-v71-view.py /path/to/immutable-v71/src
- VITE_BACKEND_URL=... node tools/configure-v71-runtime.mjs (public URL only)
- cd frontend && npm install && npm test && npm run build
- The original GitHub Pages root page remains unchanged. Preview is under /v71/.
