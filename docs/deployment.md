# Deployment and update procedure

## Frontend

1. Run tests and a production Vite build.
2. Scan tracked files for credentials, private Google IDs and table data.
3. Commit an intentional source state.
4. Push to the public GitHub repository.
5. Set repository variable `VITE_BACKEND_URL` to the approved web app URL.
6. Run the Pages workflow.
7. Verify title, real counts, search, card details, lazy photo, CORS and mobile
   layout.

## Backend

1. Keep private values only in Script Properties.
2. Run the Apps Script syntax and Node safety tests.
3. Push source to the separate backend project.
4. create an immutable numbered Apps Script version;
5. update or create a WEB_APP deployment in the Apps Script UI;
6. verify `health`, capabilities, catalog, statistics, photo metadata and CORS;
7. send a harmless POST and confirm `READ_ONLY` while writes are disabled.

Never use this procedure on V12.06/version 51.

## Version compatibility

The frontend always sends `apiVersion=v1`. A backend that cannot support it
returns `API_VERSION_UNSUPPORTED`. Adding v2 means creating a parallel router
contract and keeping v1 until the deployed frontend no longer uses it.
