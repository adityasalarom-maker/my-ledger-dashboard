# 🔧 SECURITY REMEDIATION PLAN: PRODUCTION-SAFETY HARDENING

**System:** GitHub Pages Mobile & Desktop Ledger Analytics Dashboard  
**Auditor Role:** Senior Application Security Engineer & GitHub Deployment Specialist  
**Target Repository:** `https://github.com/adityasalarom-maker/my-ledger-dashboard`  
**Live Site:** `https://adityasalarom-maker.github.io/my-ledger-dashboard/mobile.html`  
**Date:** October 13, 2026  
**Status:** PROPOSED (Awaiting User Review & Approval for Stage C)

---

## 1. Executive Strategy & Guiding Principles

1. **Non-Negotiable:** Automatic data fetching and synchronization MUST be preserved. Security cannot be achieved by turning off features or reverting to manual CSV downloads.
2. **Spreadsheet Safety:** The original Google Spreadsheet (`w LEDGER 2026 n`), formulas, and transaction history must not be deleted, modified, or overwritten.
3. **Defense-in-Depth:** Secure the data flow at all four tiers:
   - **Google Sheets:** Restrict access so anonymous internet scrapers cannot download raw spreadsheets.
   - **Google Apps Script:** Enforce token/secret verification on all `doGet` and `doPost` operations.
   - **Public Repository & GitHub Pages:** Remove sensitive personal financial records from static assets and replace with sanitized sample templates.
   - **Frontend Dashboard:** Provide automated, credentialed data retrieval for the authorized user while denying unauthorized public visitors.

---

## 2. Target Hardened Architecture

```
[ AUTHORIZED USER DEVICE ]                      [ UNAUTHENTICATED VISITOR / BOT ]
       │                                                       │
       ├── Has Saved Ledger Passkey                            ├── No Passkey
       │                                                       │
       ▼                                                       ▼
[ GitHub Pages Frontend ]                               [ GitHub Pages Frontend ]
  (mobile.html / mobile.js)                               (mobile.html / mobile.js)
       │                                                       │
       │ Automated Background Fetch                            │ Fallback / Lock State
       │ with Auth Token:                                      │
       │ GET /exec?action=get_data&key=TOKEN                   │ Shows PIN Entry Screen
       │                                                       │ or Sanitized Demo Data
       ▼                                                       ▼
[ Google Apps Script (Executes as Owner) ]              [ No Real Data Accessible ]
       │
       ├── Validates Auth Token against Script Properties
       ├── Token MATCH: Queries Restricted Sheet & Returns JSON
       └── Token MISMATCH: Returns 403 Forbidden
       ▼
[ Google Sheet ("w LEDGER 2026 n") ]
  (Sharing: RESTRICTED - Only Sheet Owner Has Access)
  (Direct public CSV export URL now returns 401/403 to public scrapers)
```

---

## 3. Prioritized Action Register

| Step | Action Item | Priority | Target Component | Complexity | Required Approval | Rollback Path |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **ACT-01** | **Restrict Google Sheet Sharing** | P0 (Critical) | Google Drive / Sheets permissions | Very Low | User action in Google Drive | Re-enable link sharing if ever needed |
| **ACT-02** | **Upgrade Google Apps Script with Auth** | P0 (Critical) | `UNIFIED_GOOGLE_APPS_SCRIPT_SYNC.gs` | Low | User deploy in Apps Script | Revert to previous script version |
| **ACT-03** | **Sanitize Public `ledger-data.js`** | P0 (Critical) | Git repo / GitHub Pages | Low | Antigravity / User commit | Restore from local backup if needed |
| **ACT-04** | **Enable Passkey Gating on Frontend** | P1 (High) | `mobile.js`, `mobile.html`, `desktop.html` | Medium | Staged rollout | Toggle flag or rollback commit |
| **ACT-05** | **Rotate Compromised Webhook URL** | P1 (High) | Google Apps Script deployment | Low | User creates new deployment | Update frontend config with new URL |
| **ACT-06** | **Implement Content Security Policy (CSP)** | P2 (Medium) | HTML `<meta>` tags | Low | Code review | Remove meta tags if any CDN blocked |
| **ACT-07** | **Security Documentation & Maintenance** | P3 (Low) | `README_SECURITY.md` | Low | None | N/A |

---

## 4. Step-by-Step Remediation Workflows

### Phase 1: Containment & Data Lockdown (Google Cloud & Sheets)

#### Step 1.1: Restrict Google Spreadsheet Permissions (ACT-01)
- **Problem:** Currently, anyone with the spreadsheet URL (`1uocVkm6qYpuM6zxhv2Hs8tHM-OthlTSOdxBZiRDWziE`) can download the entire financial ledger anonymously via CSV export.
- **Remediation:**
  1. Open Google Sheets (`w LEDGER 2026 n`).
  2. Click **Share** (top right).
  3. Under "General access", change from **"Anyone with the link"** to **"Restricted"**.
  4. Perform the same step for the historical sheet (`ag LEDGER 2026`, ID: `1qVzr4XNstdYC7aqjLw_ueghBhrKJmIZkPKHeAp4UH-4`).
- **Effect on Functionality:**
  - Public web crawlers and unauthorized people will receive an immediate HTTP 302/403 Google login requirement.
  - Apps Script deployments set to **"Execute as: Me"** will continue to have full access because they run with the owner's credentials.

#### Step 1.2: Upgrade Google Apps Script with Authentication & Secure Fetch (ACT-02)
- **Problem:** Currently, `doPost(e)` executes `delete_row` and `edit_transaction` without checking any secret or identity. Furthermore, there is no secure programmatic read endpoint (`doGet`).
- **Remediation:**
  1. Update `UNIFIED_GOOGLE_APPS_SCRIPT_SYNC.gs` to define an `AUTH_SECRET_KEY` (configured either via `ScriptProperties` or script constant).
  2. Update `doGet(e)`:
     - Check `if (e.parameter.key !== AUTH_KEY) return error403();`
     - If valid and `action === 'get_data'`:
       - Read active rows from `LEDGER` tab.
       - Format as JSON array of transactions.
       - Return HTTP 200 JSON with CORS headers.
  3. Update `doPost(e)`:
     - Parse payload and verify `payload.key === AUTH_KEY`.
     - Reject unauthorized calls immediately with `403 Forbidden`.
  4. Deploy a new version of the Web App in Google Apps Script editor.

---

### Phase 2: Static Asset Sanitization (GitHub Repository)

#### Step 2.1: Replace `ledger-data.js` with Anonymous Sample Data (ACT-03)
- **Problem:** `ledger-data.js` in the public repository currently contains 869 real transactions (196 KB) with doctor visits, bank accounts, and rental income.
- **Remediation:**
  1. Replace the contents of `ledger-data.js` with a generic, sanitized demo array of 5 synthetic transactions (e.g. `Groceries`, `Salary Demo`, `Coffee`).
  2. Ensure the array structure strictly matches `[{row, date, by, for, item, category, amount, type, account, note, balance}]` so that if offline or in preview mode, all charts and UI components render without syntax errors.
  3. Commit and push the sanitized file.
- **Effect on Functionality:**
  - Cloned public repositories or public users browsing GitHub Pages will only see demo placeholder data.
  - The live dashboard for the owner will immediately override the demo data with live real data upon entering their passkey.

---

### Phase 3: Client-Side Dashboard Hardening (Mobile & Desktop)

#### Step 3.1: Implement Transparent Passkey-Driven Automatic Sync (ACT-04)
- **Problem:** The frontend must securely fetch live data without exposing the secret key in the public JavaScript code.
- **Remediation:**
  1. On first visit, the dashboard checks `localStorage.getItem('ledger_auth_key')`.
  2. If missing:
     - Renders a clean, biometric/passkey unlock modal (prompting: *"Enter Ledger Access Key"*).
     - Once entered, tests the key against the Apps Script endpoint.
     - If verified, saves the key in `localStorage` so future sessions automatically and silently fetch the live data without reprompting!
  3. If present:
     - Automatically calls `GET ${GAS_URL}?action=get_data&key=${savedKey}` on startup and on background refresh intervals.
     - Parses the live sheet data and renders the full ledger dashboard.
     - When submitting edits, new transactions, or deletions, attaches `key: savedKey` in the POST payload.
  4. Provides a "Lock / Change Key" option in the dashboard settings menu.
- **Effect on Functionality:**
  - Zero disruption to the user's daily workflow: enter passkey once on the device, and all automatic refreshes, edits, and additions proceed seamlessly.
  - Zero private financial data leaks to visitors without the key.

#### Step 3.2: Implement Content Security Policy (ACT-06)
- **Problem:** No Content Security Policy is defined, leaving the client vulnerable to injection if a third-party dependency is compromised.
- **Remediation:**
  - Add standard CSP `<meta>` tags to `mobile.html`, `desktop.html`, and `index.html`:
    ```html
    <meta http-equiv="Content-Security-Policy" content="
      default-src 'self';
      script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net;
      style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
      font-src 'self' https://fonts.gstatic.com;
      img-src 'self' data: https:;
      connect-src 'self' https://script.google.com https://script.googleusercontent.com https://docs.google.com;
    ">
    ```

---

## 5. Rollback Strategy & Risk Mitigation

| Component | Potential Risk | Mitigation / Rollback Action |
| :--- | :--- | :--- |
| **Google Sheet Permission** | Owner loses API access | Apps Script executes as owner and is immune; if any issue occurs, owner can switch sharing back in Google Drive in 10 seconds. |
| **Apps Script Deployment** | Syntax error in script deployment | Deploy as a new version. The Apps Script editor retains historical versioned deployments that can be reverted with one click under "Manage Deployments". |
| **Frontend Code Changes** | Passkey prompt prevents dashboard loading | Local backups of `mobile.js`, `mobile.html`, `desktop.html` are preserved in `backup/mobile_dashboard_code/` and git commit history (`git revert`). |
| **Static Data Fallback** | User cannot view dashboard offline without key | Cached data in `localStorage` persists on the device, allowing offline viewing for the authorized user. |

---

## 6. Execution Checklist for Stage C

- [ ] **Approval Gate 1:** User confirms authorization to proceed with Stage C implementation.
- [ ] **Approval Gate 2:** User selects or approves the Ledger Passkey (e.g. a strong secret passphrase or alphanumeric PIN).
- [ ] **Code Implementation:** Prepare the updated `UNIFIED_GOOGLE_APPS_SCRIPT_SYNC.gs` with authenticated `doGet` and `doPost`.
- [ ] **Code Implementation:** Prepare the updated `mobile.js` and `mobile.html` with passkey storage, secure fetch, and CSP.
- [ ] **Data Sanitization:** Prepare the sanitized `ledger-data.js` template.
- [ ] **Testing & Validation:** Execute automated test suite (SEC-TEST-01 to SEC-TEST-06) to confirm zero regressions and verified security.
