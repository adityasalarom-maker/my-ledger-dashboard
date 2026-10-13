# 🛡️ SECURITY & OPERATIONAL GUIDE (README_SECURITY)

**Project:** GitHub Pages Personal Ledger Dashboard  
**Classification:** Confidential Personal Financial Management System  
**Last Updated:** October 13, 2026  

---

## 1. Data Classification: Public vs. Private Boundaries

| Asset / Data Element | Classification | Intended Visibility | Storage Location | Exposure Risk Control |
| :--- | :--- | :--- | :--- | :--- |
| **Live Financial Ledger** | **RESTRICTED / CONFIDENTIAL** | Owner only | Google Sheets (`w LEDGER 2026 n`) | Sharing set to "Restricted". Programmatic access only via authenticated Apps Script. |
| **Historical Financial Ledger** | **RESTRICTED / CONFIDENTIAL** | Owner only | Google Sheets (`ag LEDGER 2026`) | Sharing set to "Restricted". |
| **Bundled Fallback Dataset** (`ledger-data.js`) | **PUBLIC** | Public internet | GitHub Repo / Pages CDN | Sanitized template containing synthetic placeholder rows only. |
| **Ledger Access Key (Passkey)** | **CONFIDENTIAL** | Owner only | Device `localStorage` & Apps Script Secret | Never committed to Git; never sent over plaintext HTTP. |
| **Dashboard Source Code** (`mobile.html`, `mobile.js`, `mobile.css`) | **PUBLIC** | Public internet | GitHub Repository | Zero hardcoded personal records or secrets. Sanitized inputs. |
| **Apps Script Webhook URL** | **INTERNAL** | Owner / Frontend | `mobile.js` config | Protected by server-side Passkey authentication on all routes. |

---

## 2. How Automatic Fetching is Secured

### The Architecture:
1. **Google Sheets Security:** The Google Spreadsheet permissions are set to **"Restricted"**. Direct CSV downloads by unauthenticated web crawlers or scrapers are blocked with HTTP 401/403.
2. **Authenticated Apps Script Gateway:** Google Apps Script executes with the authority of the sheet owner. It serves two secured endpoints:
   - `GET /exec?action=get_data&key=YOUR_PASSKEY`: Reads the restricted sheet, serializes the transactions to JSON, and returns the dataset.
   - `POST /exec` with `{action: ..., key: YOUR_PASSKEY, ...}`: Authorizes transaction inserts, edits, and deletions.
3. **Seamless Client Experience:**
   - On the owner's smartphone or desktop, the passkey is entered once and securely retained in browser `localStorage`.
   - On page load and background refresh timers, the dashboard automatically invokes the authenticated `doGet` endpoint.
   - Real-time data synchronization continues automatically without manual intervention.
4. **Public Visitor Experience:**
   - Any random visitor or bot navigating to `https://adityasalarom-maker.github.io/my-ledger-dashboard/mobile.html` sees either a lock screen prompting for the Passkey or harmless synthetic demo transactions. No private financial records are ever served to them.

---

## 3. Where Secrets are Stored

1. **Server-Side Secret:**
   - Stored in Google Apps Script `ScriptProperties` under key `LEDGER_AUTH_KEY` (or as a private constant in the Apps Script project).
   - This value is never visible to web crawlers or repository clones.
2. **Client-Side Secret:**
   - Stored in the browser's `localStorage.getItem('ledger_auth_key')` on the owner's personal devices.
   - Kept out of all committed repository files, pull requests, and deployment artifacts.

---

## 4. How to Rotate Credentials

If you suspect your Ledger Passkey or Apps Script deployment URL has been leaked:

### Step 1: Rotate the Passkey in Google Apps Script
1. Open your Google Sheet `w LEDGER 2026 n`.
2. Go to **Extensions** → **Apps Script**.
3. In `Project Settings` (gear icon) → **Script Properties**, update `LEDGER_AUTH_KEY` with a new high-entropy string (or update the script constant `AUTH_SECRET_KEY = "NEW_SECRET_HERE"`).
4. Save the project.

### Step 2: (Optional) Rotate the Webhook Deployment URL
1. In the Apps Script editor, click **Deploy** → **Manage Deployments**.
2. Click the archive/delete icon on the active Web App deployment.
3. Click **Deploy** → **New Deployment** → **Web App**.
4. Set:
   - **Execute as:** `Me (your Google email)`
   - **Who has access:** `Anyone`
5. Copy the newly generated URL (`https://script.google.com/macros/s/.../exec`).

### Step 3: Update the Client Key
1. Open the dashboard on your phone.
2. Tap the settings menu → **Change Access Key**.
3. Enter the new Passkey.

---

## 5. How to Deploy Safely to GitHub Pages

1. **Verify No Secrets in Staged Files:**
   Before running `git commit`, run:
   ```powershell
   git diff --staged | Select-String -Pattern "1uocVkm|AKfycb|LEDGER_AUTH_KEY"
   ```
2. **Never Commit Real Records to `ledger-data.js`:**
   Ensure `ledger-data.js` only contains synthetic dummy data.
3. **Deploy via Standard Git Push:**
   ```powershell
   git add .
   git commit -m "Security hardening: passkey gating & sanitized templates"
   git push origin main
   ```
   GitHub Pages will automatically build and publish the clean static files.

---

## 6. How to Reproduce Security Checks

You can verify that your ledger remains secure using these simple terminal checks:

### Check 1: Verify `ledger-data.js` on GitHub Pages Contains No Private Data
```bash
curl -s https://adityasalarom-maker.github.io/my-ledger-dashboard/ledger-data.js | head -n 10
```
*Expected Result:* Displays synthetic demo data (e.g. `Demo Groceries`) instead of real medical bills or personal bank accounts.

### Check 2: Verify Anonymous Google Sheets CSV Download is Blocked
```bash
curl -sI "https://docs.google.com/spreadsheets/d/1uocVkm6qYpuM6zxhv2Hs8tHM-OthlTSOdxBZiRDWziE/export?format=csv"
```
*Expected Result:* HTTP 302 Found / 401 Unauthorized / 403 Forbidden (redirecting to `accounts.google.com`).

### Check 3: Verify Unauthenticated Apps Script Calls are Rejected
```bash
curl -s -X POST -H "Content-Type: application/json" \
  -d '{"action":"delete_row","row":2}' \
  "YOUR_APPS_SCRIPT_URL"
```
*Expected Result:* `{"status":"error","message":"Unauthorized: Invalid or missing passkey"}` with HTTP 403.
