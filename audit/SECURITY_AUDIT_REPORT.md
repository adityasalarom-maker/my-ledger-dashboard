# 🛡️ SECURITY AUDIT REPORT: LEDGER DASHBOARD

**System:** GitHub Pages Mobile & Desktop Ledger Analytics Dashboard  
**Auditor Role:** Senior Application Security Engineer & Web Security Auditor  
**Audit Type:** Deep Evidence-Based Code, Architecture, & Exposure Audit (STAGE A: Read-Only)  
**Target Repository:** `https://github.com/adityasalarom-maker/my-ledger-dashboard`  
**Production Deployment:** `https://adityasalarom-maker.github.io/my-ledger-dashboard/mobile.html`  
**Date of Audit:** October 13, 2026  
**Overall Risk Posture:** **CRITICAL** (Active Financial Data Exposure & Unauthenticated Write Webhook)  
**Audit Scope:** Local workspace, Git commit history, GitHub Pages deployment, network endpoints, data ingestion flows, Google Sheets sharing configuration, and client-side web application code.

---

## 1. Executive Summary

A comprehensive, evidence-based security audit of the `my-ledger-dashboard` codebase and its live data-fetching architecture was conducted.

### Core Finding Summary:
1. **Public Financial Data Exposure (CRITICAL):**
   - The GitHub repository is **Public** (`api.github.com/repos/...` returned `"private": false`).
   - The GitHub Pages site serves `ledger-data.js` publicly. This file contains **869 complete, unencrypted personal financial transactions** dating from 1-Jan-2026 to 13-Oct-2026.
   - Any unauthenticated internet user can view full transaction descriptions, exact rupee amounts, bank account names (PNB, SBI, CO Bank), healthcare medical bills and hospital visits, property tenant names, rental income, and running cash balances.
2. **Public Google Sheets CSV Feed (CRITICAL):**
   - The live Google Spreadsheet (`w LEDGER 2026 n`, ID: `1uocVkm6qYpuM6zxhv2Hs8tHM-OthlTSOdxBZiRDWziE`) is currently shared as **"Anyone with the link can view"**.
   - An anonymous, unauthenticated HTTP request to `https://docs.google.com/spreadsheets/d/1uocVkm6qYpuM6zxhv2Hs8tHM-OthlTSOdxBZiRDWziE/export?format=csv` successfully retrieved the entire raw 68,493-byte ledger without prompting for Google credentials.
   - The deprecated previous sheet (`ag LEDGER 2026`, ID: `1qVzr4XNstdYC7aqjLw_ueghBhrKJmIZkPKHeAp4UH-4`) remains similarly public and accessible (71,202 bytes).
3. **Unauthenticated Google Apps Script Write Webhook (CRITICAL):**
   - The Google Apps Script deployment URL (`DEFAULT_GAS_URL` in `mobile.js`) is committed in plaintext in the public repository.
   - Inspection of `UNIFIED_GOOGLE_APPS_SCRIPT_SYNC.gs` reveals that `doPost(e)` processes actions including `add_transaction`, `edit_transaction`, and **`delete_row`** without any authentication, API key, passkey, or origin validation.
   - Any malicious actor with network access to this URL can forge POST requests to alter or delete transactions in the owner's live Google Sheet.
4. **Client-Side Code Quality & Malware Assessment (PASSED / CLEAN):**
   - Static analysis across all 19 JavaScript and HTML files detected **zero** instances of obfuscated code, `eval()`, malicious payloads, trojans, crypto-miners, or unexpected third-party data exfiltration destinations.
   - Dynamic user-controlled transaction properties are sanitized using `escapeHTML()` before being injected into HTML template strings.

---

## 2. Architecture & Data Flow Diagram

```
[ UNTRUSTED INTERNET / PUBLIC VISITOR ]
                 │
                 ├──► 1. Clones Public GitHub Repo ────► Reads 869 private records in ledger-data.js
                 │
                 ├──► 2. Visits GitHub Pages ─────────► Downloads mobile.html & ledger-data.js
                 │
                 ├──► 3. Fetches Google Sheets CSV ──► Downloads live private financial CSV (68 KB)
                 │       (https://docs.google.com/spreadsheets/d/1uoc.../export?format=csv)
                 │
                 └──► 4. Calls Apps Script Webhook ──► Can invoke delete_row / edit_transaction (NO AUTH)
                         (https://script.google.com/macros/s/AKfycb.../exec)

========================================================================================

CURRENT DATA FLOW (INSECURE BY CONSTRAINTS OF SERVERLESS GITHUB PAGES):

[ Google Sheets (w LEDGER 2026 n) ]
   │ (Shared: Anyone with link can view)
   ▼
[ Google Sheets CSV Export Endpoint ] (Unauthenticated GET)
   │
   ▼
[ Browser Client (mobile.js) ] (Running on GitHub Pages or Localhost)
   │
   ├──► Stores unencrypted raw transactions in localStorage (`cached_ledger_sheet2`)
   ├──► Pulls bundled fallback from `window.LEDGER_DATA` in `ledger-data.js`
   └──► Writes changes via unauthenticated POST to Google Apps Script Web App
```

---

## 3. Risk Register & Vulnerability Inventory

| Finding ID | Vulnerability / Exposure | Affected Component | Preconditions | Impact | Severity | Confidence |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **SEC-01** | **Public Exposure of Financial Records** | `ledger-data.js`, GitHub Pages, Git Repo | None (Public internet access) | Full breach of financial privacy (all 869 transactions, bank accounts, income, health expenses) | **CRITICAL** | Confirmed (Verified HTTP 200) |
| **SEC-02** | **Anonymous Google Sheet Download** | Google Sheets CSV Endpoint (`1uocVkm...`) | Knowledge of Spreadsheet ID (found in public JS/commits) | Real-time leakage of all spreadsheet tabs and financial history | **CRITICAL** | Confirmed (Verified HTTP 200) |
| **SEC-03** | **Unauthenticated Remote Sheet Modification / Deletion** | Google Apps Script Webhook (`DEFAULT_GAS_URL`) | Knowledge of Webhook URL (published in `mobile.js`) | Arbitrary row deletion, ledger tampering, loss of financial integrity | **CRITICAL** | Confirmed (Verified in Apps Script code) |
| **SEC-04** | **Unauthenticated Exposure of Previous Sheet** | Google Sheets (`1qVzr4X...`) | Knowledge of previous ID (in Git history & backups) | Exposure of historical financial records | **HIGH** | Confirmed (Verified HTTP 200) |
| **SEC-05** | **Absence of Content Security Policy (CSP)** | `mobile.html`, `index.html`, `desktop.html` | Browser rendering | Susceptibility to inline script injection should an XSS bug emerge | **MEDIUM** | Confirmed (No CSP headers/meta) |
| **SEC-06** | **Unencrypted Local Storage of Financial Data** | Browser `localStorage` (`cached_ledger_sheet2`) | Physical access or compromised extension | Local extraction of financial history from device cache | **LOW** | Confirmed (Standard Web Storage) |

---

## 4. Threat Model

### Threat Actor 1: Anonymous Public Visitor / Automated Scraper
- **Capability:** Crawls `github.io` domains or scrapes public repositories using search tools (TruffleHog, GitGuardian, Shodan, Google Dorking).
- **Attack Vector:** Discovers `https://github.com/adityasalarom-maker/my-ledger-dashboard`. Downloads `ledger-data.js` and extracts complete net worth, monthly cash flow, household spending, and personal names.
- **Likelihood:** **HIGH** (Public repositories are continuously indexed by web crawlers).

### Threat Actor 2: Malicious Webhook Exploiter
- **Capability:** Reads `DEFAULT_GAS_URL` in `mobile.js`.
- **Attack Vector:** Issues automated POST requests with payload `{"action": "delete_row", "row": 2}` in a loop.
- **Consequence:** Entire Google Sheet ledger wiped out row by row without any authorization or trace.

### Threat Actor 3: Local Device Snooper
- **Capability:** Accesses the unlocked Samsung Galaxy S25 device or browser session.
- **Attack Vector:** Inspects `localStorage` or browser history.
- **Consequence:** Extracts cached ledger data even when offline.

---

## 5. Detailed Technical Evidence

### Evidence A: Anonymous Access to Bundled Data on GitHub Pages
An unauthenticated request with a generic user-agent retrieved:
```bash
$ curl -sI https://adityasalarom-maker.github.io/my-ledger-dashboard/ledger-data.js
HTTP/2 200 
content-type: application/javascript; charset=utf-8
content-length: 196001
```
The file serves the raw JavaScript definition:
`window.LEDGER_DATA = [{"row": 2, "date": "1-Jan-2026", "by": "Honey", "for": "Budget", "item": "hom budget", ...}];`

### Evidence B: Anonymous Access to Live Google Spreadsheet CSV
```bash
$ curl -sI "https://docs.google.com/spreadsheets/d/1uocVkm6qYpuM6zxhv2Hs8tHM-OthlTSOdxBZiRDWziE/export?format=csv"
HTTP/2 200 
content-type: text/csv; charset=utf-8
content-disposition: attachment; filename="w LEDGER 2026 n - LEDGER.csv"
content-length: 68493
```
Anyone with this URL can stream the live spreadsheet data in real time.

### Evidence C: Unauthenticated Write Method in Apps Script
In `UNIFIED_GOOGLE_APPS_SCRIPT_SYNC.gs`:
```javascript
function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return makeJsonResponse({ status: 'error', message: 'No payload received' });
    }
    var payload = JSON.parse(e.postData.contents);
    var action = payload.action; // 'insert_transaction', 'add_transaction', 'edit_transaction', 'delete_row'
    // CRITICAL: NO API KEY, TOKEN, OR AUTH CHECK IS CONDUCTED HERE!
```

---

## 6. Audit Verdict

- **Malware / Backdoor Check:** **CLEAN** (No hostile code detected).
- **Client-Side Injection / XSS:** **WELL DEFENDED** (Consistent use of `escapeHTML` across template literals).
- **Data Privacy & Access Control:** **FAIL (CRITICAL)** (Live Google Sheets, bundled dataset, and Apps Script write endpoints are completely open to the public internet).

*Stage A Read-Only Audit Complete. No production files, credentials, or Google Sheets records were altered during this phase.*
