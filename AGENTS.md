# My Ledger Dashboard - Antigravity Project Rules & Architecture Standards

> **Persistent Repository Context & Operating Directives**  
> **Status:** Active Standard (Migrated from Legacy Workflows in compliance with Google Antigravity 2026 Standards)  
> **Deprecation Deadline Protection:** Legacy Workflows system deprecated on October 19, 2026; replaced with persistent Project Rules (`AGENTS.md`) and on-demand progressive Skills (`.agents/skills/`).

---

## 1. Project Overview & Topology

This repository hosts **My Ledger Dashboard** and the **Ledger Intelligence Assistant**, a production-grade personal finance management PWA synchronized with Google Sheets.

### Core Application Surfaces
- **Mobile Production Dashboard (`mobile.html`, `mobile.css`, `mobile.js`)**:
  - Live client-facing dashboard on GitHub Pages (`https://adityasalarom-maker.github.io/my-ledger-dashboard/mobile.html`).
  - **CRITICAL:** Do NOT modify `mobile.html` or `mobile.js` during assistant or sync updates unless explicitly requested by the user. Must remain stable, zero-regression.
- **Ledger Intelligence Assistant (`assistant.html`, `assistant.css`, `assistant.js`)**:
  - Standalone, dark-mode glassmorphism assistant interface.
  - Three operational modules:
    1. **Ask My Ledger**: Deterministic client-side natural language query engine (Hindi/Hinglish/English).
    2. **Quick Add**: Intelligent batch expense note parser into standardized double-entry rows.
    3. **Query & Audit Logs**: Real-time log inspector with hourly/daily grouping and JSON export.
- **Google Apps Script Cloud Gateway (`UNIFIED_GOOGLE_APPS_SCRIPT_SYNC.gs`)**:
  - Webhook & REST middleware deployed on Google Apps Script (GAS).
  - Handles `GET` (fetch ledger transactions) and `POST` (append new rows, batch sync).

---

## 2. Google Sheets Formula & Column H Integrity Policy

### The Inviolable Balance Invariant
The Google Sheet ledger relies on an exact cumulative running balance in **Column H (`Balance`)**:
```excel
=IF(ISBLANK(A2), "", N(H1) + N(J2) - N(G2))
```
- **Column A (`Date`)**: `YYYY-MM-DD` or `DD/MM/YYYY`. If blank, formula returns empty string `""`.
- **Column G (`Expense / Outflow`)**: Positive numeric value for money spent.
- **Column J (`Income / Credit / Budget`)**: Positive numeric value for funds received or budget additions.
- **Column H (`Balance`)**: Cumulative running balance calculated as `Previous Balance (H[r-1]) + Inflow (J[r]) - Outflow (G[r])`.

### Strict Operational Constraints
1. **Never Hardcode Column H**: Never write a static numerical value into Column H when appending or updating rows. Always inject the exact relative formula `=IF(ISBLANK(A{row}), "", N(H{row-1}) + N(J{row}) - N(G{row}))`.
2. **Double-Entry Append Order**: Appends must occur at the end of the sheet, and the formula must reference the exact prior row index.
3. **Reconciliation Audit**: Any operation that imports or reconciles data must verify that `Sum(Column J) - Sum(Column G) + Initial Balance == Last Row(Column H)`.

---

## 3. Technology Stack & Coding Standards

1. **Vanilla Web Technologies Only**:
   - Modern HTML5, ES6+ JavaScript, and Vanilla CSS3.
   - **NO TailwindCSS**, NO heavy npm runtime frameworks (React, Vue, Angular) in production client files unless explicitly requested.
   - Keep applications lightweight, ultra-fast loading, and offline-capable via Progressive Web App (PWA) standards.
2. **Visual Aesthetics & Design System**:
   - Rich dark-mode glassmorphism (`background: rgba(18, 22, 34, 0.85); backdrop-filter: blur(16px);`).
   - Modern typography: `Inter`, `Outfit`, `SF Pro Display`, `-apple-system`.
   - Dynamic micro-animations, smooth hover states, responsive touch-first layouts (360px to 1440px).
   - High accessibility contrast (WCAG AA compliant).
3. **Deterministic Zero-Token Client Execution**:
   - All query matching in `assistant.js` and `mobile.js` runs client-side using deterministic regex pattern scoring and fuzzy token matching against local cached ledger datasets.
   - **Zero Gemini API token consumption** on read/query workflows. Gemini is reserved exclusively for raw unstructured text breakdown when configured via backend webhooks.

---

## 4. Security & Authentication Architecture

1. **Passkey Protection**:
   - Protected actions (batch appending to Google Sheets, sensitive balance views) require master passkey verification (`Ledger2026!SecureKey` or user-defined secret).
   - Passkeys are never committed in plaintext in client repositories.
2. **Content Security Policy (CSP)**:
   - Script sources restricted to `'self'`, `https://cdn.jsdelivr.net` (for Chart.js), and Google Apps Script endpoints.
   - All user inputs sanitized before DOM injection to eliminate XSS risks (`sanitizeHTML()` or `textContent`).
3. **CORS & Webhook Integrity**:
   - Google Apps Script gateway validates payload tokens and verifies HMAC/Passkey on write requests.

---

## 5. Git & Deployment Conventions

1. **Main Branch as Production**:
   - Branch `main` automatically deploys to GitHub Pages (`adityasalarom-maker.github.io/my-ledger-dashboard`).
   - Every commit must maintain full functionality and not break mobile dashboard paths.
2. **Safe Backups**:
   - Before major refactors, preserve historical snapshots in `version_backups/` or `.agents/_legacy_workflows_archive/`.
3. **Commit Messages**:
   - Use conventional commit prefixes: `feat:`, `fix:`, `refactor:`, `chore:`, `docs:`.
