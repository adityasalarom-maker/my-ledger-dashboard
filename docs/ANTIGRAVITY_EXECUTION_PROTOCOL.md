# 🛰️ Antigravity Execution Protocol: My Ledger Dashboard
**Specification Version:** 2026.10  
**Effective Date:** October 14, 2026  
**Status:** Active Protocol (Phase 0 Reconciled)  
**Platform Deprecation Guard:** Migrated from legacy IDE workflows (`.agents/workflows/`) ahead of the October 19, 2026 platform cutoff. Standardized on persistent Project Rules (`AGENTS.md`) and focused Agent Skills (`.agents/skills/`).

---

## 1. Executive Context & System Inventory

| Application Surface | Target Devices / Roles | Key Files | Source Status |
| :--- | :--- | :--- | :--- |
| **Mobile Production PWA** | Primary smartphone dashboard (Samsung Galaxy S25 Ultra, 360px–480px) | `mobile.html`, `mobile.css`, `mobile.js`, `index.html`, `manifest.json`, `sw.js` | Active Production (`main`) |
| **Ledger Intelligence Assistant** | Natural language queries, Quick Add parser, audit log inspector | `assistant.html`, `assistant.css`, `assistant.js` | Active Production (`main`) |
| **Desktop Dashboard** | Widescreen split-view visualizer & grid | `desktop.html`, `index.css`, `app.js` | Legacy Surface (Local & Web) |
| **Cloud Webhook Gateway** | Authenticated read/write middleware for Google Sheets | `UNIFIED_GOOGLE_APPS_SCRIPT_SYNC.gs` | Live Cloud Deployment |

---

## 2. Phase 0: Architecture Alternatives & Technical Trade-offs

### A. Data Ingestion Architecture
* **Alternative 1: Direct Google Sheets CSV Export**
  * *Mechanism:* Anonymous `GET` from `/export?format=csv`.
  * *Assessment:* Rejected during Security Audit. Requires public "Anyone with link" sheet sharing, exposing confidential personal finances to unauthenticated scrapers.
* **Alternative 2: Heavy Client-Side Node/Express Backend on Cloud Run**
  * *Mechanism:* Full containerized Node server routing Google Sheets API v4.
  * *Assessment:* Excessive maintenance overhead, cold-start latency, and monthly hosting cost risks for single-user personal finance.
* **Alternative 3: Authenticated Google Apps Script Middleware + Client-Side Deterministic Engine (Chosen)**
  * *Mechanism:* Free serverless Google Apps Script executing with sheet owner authority, gated by a master passkey (`LEDGER_AUTH_KEY`). Static client hosted on GitHub Pages.
  * *Assessment:* Zero hosting cost, sub-3-second response, zero third-party token leaks, and strict Column H balance preservation.

### B. Free-Tier Limits & Quota Audit
1. **GitHub Pages (Static Hosting)**:
   - Bandwidth Quota: 100 GB / month.
   - Repository Size Quota: 1 GB.
   - Current Consumption: ~480 KB total repository assets (<0.05% of quota).
2. **Google Apps Script (Cloud Gateway)**:
   - Execution Quota: 20,000 URL Fetch calls/day; 90 min/day trigger execution time.
   - Current Consumption: ~50–150 fetch calls/day on personal devices (<0.8% of quota). 100% Free.
3. **AI / Model Tokens**:
   - Zero Gemini API tokens consumed on read/query/filter flows. Deterministic regex & fuzzy token processing executes locally in browser JavaScript.

### C. Data Classification & Privacy Boundaries
* **Confidential Tier**: Real Google Sheet transactions (Sheet ID: `1uocVkm6qYpuM6zxhv2Hs8tHM-OthlTSOdxBZiRDWziE`), tenant records, salary inflow, running balance. Stored exclusively in Google Sheets & authenticated client `localStorage`.
* **Public Tier**: Static frontend code (`mobile.html`, `assistant.html`), sanitized demo template (`ledger-data.js` containing 5 synthetic demo rows).

---

## 3. Inviolable Operational Rules (AGENTS.md Alignment)
1. **Column H Running Balance Invariant**:
   `=IF(ISBLANK(A{row}), "", N(H{row-1}) + N(J{row}) - N(G{row}))`
   Never write static numbers to Column H.
2. **Zero Framework Bloat**:
   Vanilla HTML5, ES6+, and CSS3 only. Zero Tailwind, zero npm runtime dependencies.
3. **Deterministic Execution**:
   Client queries in `assistant.js` and `mobile.js` run deterministic client-side logic.

---

## 4. Verification & Testing Protocol (Acceptance Criteria)

### Test 1: Capability & Discovery Audit
* Verify `AGENTS.md` is detected at repository root.
* Verify 5 focused skills in `.agents/skills/`:
  1. `ask-my-ledger-query`
  2. `ledger-reconciliation-audit`
  3. `ledger-sync-gas`
  4. `pwa-mobile-deployment`
  5. `quick-add-transaction-parser`
* Confirm zero reliance on `.agents/workflows/` or `.gemini/workflows/`.

### Test 2: Intent-Trigger & Progressive Loading Check (Dry-Run)
* Verify that user intent dynamically loads the exact `SKILL.md` without loading entire workspace into context.
* Verify rule compliance and structured step-by-step resolution path.
