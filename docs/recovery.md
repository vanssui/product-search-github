# Backup and recovery

## Before every release

- record the Git commit and Pages workflow run;
- record the backend Apps Script version and deployment ID outside the public
  repository;
- export the private Script Properties to a secure, non-repository backup;
- keep the previous Pages artifact and backend deployment available;
- do not delete Apps Script versions;
- do not modify V12.06/version 51 as part of a rollback.

## Frontend rollback

Re-run Pages from the last known-good commit with its approved
`VITE_BACKEND_URL`. No Sheets or Drive rollback is required for a read-only UI
release.

## Backend rollback

Point the separate WEB_APP deployment to the last known-good numbered version,
then smoke-test `health`, catalog and a harmless read-only POST. Restore Script
Properties only from the matching secure snapshot.

## Write incident

1. Set `READ_ONLY=true`.
2. Disable every write feature flag.
3. Verify capabilities report all writes false.
4. Preserve idempotency records and execution logs for diagnosis.
5. Compare the affected row/file with the pre-operation backup.
6. Restore only the explicitly affected task or test file.

Do not perform a broad table or Drive restore without a separate owner approval.
