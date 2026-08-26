# wolfCart

Split shared receipts and track who owes what. Sign in with Google, log receipts and items, and see running per-person totals — backed by a Google Sheet.

Static site (`index.html`, no build step) + a Google Apps Script Web App that's the only thing allowed to read/write the Sheet. The browser only ever gets a Google identity, never Sheets API access.

## Setup

**1. OAuth Client ID** (console.cloud.google.com)
- OAuth consent screen → External → add yourself as a test user.
- Credentials → Create Credentials → OAuth client ID → Web application → add your origins (e.g. `http://localhost:8000`, `https://<you>.github.io`).
- Paste the Client ID into `CONFIG.CLIENT_ID` in `index.html`.

**2. Google Sheet + backend**
- Create a blank Sheet → Extensions → Apps Script → paste in `apps-script.gs`.
- Set `CONFIG.CLIENT_ID` there to match, and optionally list allowed emails in `ALLOWED_EMAILS`.
- Deploy → New deployment → Web app → Execute as **Me**, access **Anyone**.
- Paste the `/exec` URL into `CONFIG.APPS_SCRIPT_URL` in `index.html`.

Editing the script later? Redeploy the *same* deployment (Manage deployments → edit → New version) so the URL doesn't change.

## Run locally

```
python3 -m http.server 8000
```

## Deploy

Push to GitHub, enable Settings → Pages (branch `main`, root), then add the `github.io` URL to the OAuth Client's authorized origins.
