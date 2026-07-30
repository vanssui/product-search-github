# Production completion gate

## Current state — 30 July 2026

- GitHub frontend reads real production tasks through the separate API.
- V12.06/version 51 is unchanged and remains available in parallel.
- Read-only parity has been rechecked on a live snapshot.
- The API v1 router, layers, capabilities and disabled write safety foundation
  are deployed in the separate backend.
- Public task/photo DTOs do not expose Sheets or Drive storage identifiers.
- All production writes remain blocked by master flag, per-feature flags and
  readonly OAuth scopes.

## Remaining gated work

Write functions must be enabled one at a time:

1. owner chooses one safe real task and states its WB sticker/task identity;
2. save backend properties, manifest and task state;
3. temporarily grant the minimum scope for one operation;
4. enable only that operation;
5. execute the same scenario in V12.06 and GitHub;
6. compare row values, active catalog, Drive files and user-visible result;
7. restore the selected task;
8. keep the flag enabled only after exact parity; otherwise disable and roll
   back immediately.

Recommended order:

1. `takeTask` and `releaseTask` — optional enhancement, not present in v51;
2. `markFound` / completion;
3. `markNotFound` / completion;
4. `uploadTaskPhoto`;
5. employee profile persistence only if a real backend write is actually
   needed.

Because take/release is absent from V12.06, its acceptance criterion is safe
concurrency and no table mutation, not visual parity.

## Cutover conditions

Do not switch employees or disable V12.06 until:

- every critical scenario has a completed parity row in the matrix;
- a limited pilot has no unresolved data divergence;
- rollback artifacts and private configuration backups exist;
- performance is measured on phone and tablet;
- the owner gives an explicit cutover command.

Archiving old deployments is a separate operation and is not implied by
frontend cutover.
