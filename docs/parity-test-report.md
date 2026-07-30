# Functional parity matrix

Updated: 30 July 2026.

`confirmed` means observed against real production or completed in the isolated
write fixture. It does not mean production write activation is approved.

| Function | V12.06 behavior | GitHub/API behavior | Result | Next action |
|---|---|---|---|---|
| Active sources | five configured source tails | private adapter, same five sources | confirmed | keep read regression |
| Active status | `Поиск` | `Поиск` | confirmed | — |
| Blocks and counts | B3/B4/B5 | same live blocks/counts | confirmed | — |
| Floors | explicit columns, then MX | same | confirmed | — |
| Route ordering | zone/location order | same | confirmed | — |
| Search WB/product/MX/BOX | client search | local search on API DTO | confirmed | — |
| Search item ID | not included | not included | confirmed | — |
| My tasks | employee ID equality | same | implemented | real employee smoke |
| Photo filter | row has photo IDs | `hasPhoto` DTO | confirmed | — |
| Card/detail fields | vNext fields | same business fields, larger UI | confirmed | continuing visual QA |
| Storage abstraction | HTML knows returned row object | opaque DTO/tokens | improved | — |
| Photo list/read | Drive IDs then base64 | opaque token, lazy base64 | confirmed | — |
| Refresh | direct getTasks | cached + explicit fresh | confirmed | — |
| Take/release | absent | absent | confirmed | — |
| Second session | first completion wins | global lock + first completion wins | unit confirmed | production pilot |
| Found | `updateTask` | `updateTask("Найдено")` | unit confirmed | production pilot |
| Not found | `updateTask` | `updateTask("Не найдено")` | unit confirmed | production pilot |
| Duplicate write | first status reread | idempotency + status reread | isolated E2E/unit | production pilot |
| Lost response | failure callback | GET status, no second POST | unit confirmed | production pilot |
| Upload photo | Drive + last six IDs | same rule + rollback on row failure | isolated E2E | production pilot |
| Reports | pasted TSV modal | same local parser/modal | unit + build | browser E2E |
| ID statistics | pasted TSV modal | same local parser/ranking modal | unit + build | browser E2E |
| Phone 390 px | vNext mobile | mobile-first detail surface | previously confirmed | recheck every release |

## Automated checks

- 21 tests currently cover feature gates, readonly override, idempotency,
  pending-operation behavior, first-write-wins,
  API action allow-list, hidden storage identifiers, timeout confirmation,
  filters, route formatting and search.
- Production Vite build and Apps Script syntax checks pass.
- Browser smoke check found no console warnings or errors.
- Production POST smoke returns `READ_ONLY`.

## Completion rule

The migration cannot be labelled complete until completion, not-found and photo
upload each pass the approved one-task production comparison and are restored
without residual data or files.
