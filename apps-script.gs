// Paste this into Extensions > Apps Script inside your Google Sheet, replacing the
// default Code.gs contents. Then Deploy > New deployment > type "Web app":
//   - Execute as: Me
//   - Who has access: Anyone
// (Access is "Anyone" at the Apps Script layer because this script does its own
// identity check below via the ID token — it does not rely on Google's deployment
// gate. Anyone who calls the URL without a valid, matching ID token gets rejected.)
// Copy the resulting /exec URL into CONFIG.APPS_SCRIPT_URL in index.html.
//
// Whenever you edit this file, you must create a NEW deployment version
// (Deploy > Manage deployments > Edit > Version: New version) for changes to go live.

const CONFIG = {
  // Must match CONFIG.CLIENT_ID in index.html.
  CLIENT_ID: 'CLIENT_ID.apps.googleusercontent.com',
  // Optional allow-list. Leave empty to allow any Google account with a valid identity.
  ALLOWED_EMAILS: [],
};

const TABS = {
  People: ['Name'],
  Receipts: ['ID', 'Name', 'Date', 'Tax', 'Participants'],
  Items: ['ID', 'ReceiptID', 'Name', 'Price', 'SplitWith'],
  Users: ['Email', 'Name'],
};

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    const email = verifyIdToken_(body.idToken);
    if (CONFIG.ALLOWED_EMAILS.length && CONFIG.ALLOWED_EMAILS.indexOf(email) === -1) {
      return jsonResponse_({ error: email + ' is not authorized.' });
    }

    ensureTabs_();

    if (body.action === 'load') {
      const result = loadState_();
      result.email = email;
      result.myName = getMyName_(email);
      return jsonResponse_(result);
    }
    if (body.action === 'sync') {
      saveState_(body.state);
      return jsonResponse_({ ok: true });
    }
    if (body.action === 'setName') {
      const name = String(body.name || '').trim();
      if (!name) throw new Error('Name cannot be empty');
      setMyName_(email, name);
      return jsonResponse_({ ok: true });
    }
    return jsonResponse_({ error: 'Unknown action: ' + body.action });
  } catch (err) {
    return jsonResponse_({ error: err.message });
  }
}

function verifyIdToken_(idToken) {
  if (!idToken) throw new Error('Missing ID token');
  const res = UrlFetchApp.fetch(
    'https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(idToken),
    { muteHttpExceptions: true }
  );
  const data = JSON.parse(res.getContentText());
  if (data.error) throw new Error('Invalid or expired ID token');
  if (data.aud !== CONFIG.CLIENT_ID) throw new Error('Token was not issued for this app');
  return data.email;
}

function ensureTabs_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  Object.keys(TABS).forEach(function (title) {
    const headers = TABS[title];
    let sheet = ss.getSheetByName(title);
    if (!sheet) {
      sheet = ss.insertSheet(title);
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    } else if (sheet.getLastColumn() < headers.length) {
      // Backfill headers for columns added in a later version of this script
      // (e.g. Participants) onto a sheet created by an older version.
      const existingCols = sheet.getLastColumn();
      const missing = headers.slice(existingCols);
      sheet.getRange(1, existingCols + 1, 1, missing.length).setValues([missing]);
    }
  });
}

function readRows_(ss, title) {
  const sheet = ss.getSheetByName(title);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  return sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getValues();
}

function writeRows_(ss, title, rows) {
  const sheet = ss.getSheetByName(title);
  const lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).clearContent();
  }
  if (rows.length) {
    sheet.getRange(2, 1, rows.length, rows[0].length).setValues(rows);
  }
}

function loadState_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const people = readRows_(ss, 'People').map(function (r) { return r[0]; }).filter(Boolean);

  const receipts = readRows_(ss, 'Receipts').map(function (r) {
    return {
      id: String(r[0]), name: r[1] || '', date: r[2] || '', tax: Number(r[3]) || 0,
      participants: String(r[4] || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean),
      items: [],
    };
  });

  const items = readRows_(ss, 'Items').map(function (r) {
    return {
      id: String(r[0]),
      receiptId: String(r[1]),
      name: r[2] || '',
      price: Number(r[3]) || 0,
      splitWith: String(r[4] || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean),
    };
  });

  items.forEach(function (item) {
    const receipt = receipts.filter(function (r) { return r.id === item.receiptId; })[0];
    if (receipt) receipt.items.push(item);
  });

  return { people: people, receipts: receipts };
}

function saveState_(state) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  writeRows_(ss, 'People', state.people.map(function (p) { return [p]; }));
  writeRows_(ss, 'Receipts', state.receipts.map(function (r) {
    return [r.id, r.name, r.date, r.tax, (r.participants || []).join(', ')];
  }));

  const itemRows = [];
  state.receipts.forEach(function (r) {
    r.items.forEach(function (item) {
      itemRows.push([item.id, r.id, item.name, item.price, item.splitWith.join(', ')]);
    });
  });
  writeRows_(ss, 'Items', itemRows);
}

function getMyName_(email) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const rows = readRows_(ss, 'Users');
  for (let i = 0; i < rows.length; i++) {
    if (String(rows[i][0]).toLowerCase() === email.toLowerCase()) return rows[i][1];
  }
  return null;
}

function setMyName_(email, name) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Users');
  const rows = readRows_(ss, 'Users');

  let rowIndex = -1;
  for (let i = 0; i < rows.length; i++) {
    if (String(rows[i][0]).toLowerCase() === email.toLowerCase()) { rowIndex = i; break; }
  }

  if (rowIndex === -1) {
    sheet.appendRow([email, name]);
  } else {
    sheet.getRange(rowIndex + 2, 2).setValue(name); // +2: header row + 1-based index
  }

  addPersonIfMissing_(name);
}

function addPersonIfMissing_(name) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const people = readRows_(ss, 'People').map(function (r) { return r[0]; });
  if (people.indexOf(name) === -1) {
    ss.getSheetByName('People').appendRow([name]);
  }
}

function jsonResponse_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
