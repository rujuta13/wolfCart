# Expense Splitter

A lightweight, no-backend expense splitter for tracking shared receipts and who owes what. Sign in with Google, log receipts and their items, split each item between people, and see a running per-person total — all backed by a Google Sheet you control.

## How it works

- **Frontend**: a single static `index.html` (no build step, no server) — deployable anywhere that serves static files, including GitHub Pages.
- **Auth**: Google Sign-In is used only to identify who's using the app. No Google Sheets API scope is ever requested by the browser.
- **Data**: all reads/writes to the spreadsheet happen through a Google Apps Script Web App, deployed separately from inside the Sheet itself. It verifies each request's Google identity token, optionally checks it against an allow-list, and is the only thing that ever touches the Sheet.

```
Browser (index.html)  --ID token-->  Apps Script Web App  --reads/writes-->  Google Sheet
```

## One-time setup

### 1. Google Cloud OAuth Client ID
1. Create a project at [console.cloud.google.com](https://console.cloud.google.com).
2. **APIs & Services → OAuth consent screen** — set it up as External, add scopes `.../auth/userinfo.email` and `openid`/`profile` (default), and add your Google account(s) as **test users** (the app stays unverified, which is fine for personal/small-group use).
3. **APIs & Services → Credentials → Create Credentials → OAuth client ID** → type **Web application**. Add every origin you'll load the page from under "Authorized JavaScript origins" (e.g. `http://localhost:8000` for local testing, `https://<you>.github.io` for the deployed site).
4. Copy the Client ID into `CONFIG.CLIENT_ID` in `index.html`.

### 2. Google Sheet + Apps Script backend
1. Create a blank Google Sheet.
2. **Extensions → Apps Script**, paste in `apps-script.gs` (kept locally, not committed — see below), and set its `CONFIG.CLIENT_ID` to the same value as above.
3. Optionally restrict access via `CONFIG.ALLOWED_EMAILS` in that file (an array of allowed emails; leave empty to allow any Google account that can obtain a valid identity token for this Client ID).
4. **Deploy → New deployment → Web app** — Execute as **Me**, access **Anyone**.
5. Copy the resulting `/exec` URL into `CONFIG.APPS_SCRIPT_URL` in `index.html`.

Any time you edit `apps-script.gs`, you need to push a **new version** of the *existing* deployment (Deploy → Manage deployments → edit → Version: New version) for changes to go live — creating a brand-new deployment instead will change the `/exec` URL and require updating `index.html` again.

> `apps-script.gs` is intentionally excluded from this repo (see `.gitignore`) since it may contain real email addresses in `ALLOWED_EMAILS`. Keep your working copy locally and in the Apps Script editor.

## Running locally

```
python3 -m http.server 8000
```
then open `http://localhost:8000`.

## Deploying

Push this repo to GitHub and enable **Settings → Pages** (serve from the `main` branch, root folder). Remember to add the resulting `https://<you>.github.io/...` origin to the OAuth Client's authorized JavaScript origins, or sign-in will fail.
