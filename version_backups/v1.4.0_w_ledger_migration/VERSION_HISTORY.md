# 📜 Version History & Snapshot Registry
This registry maintains historical snapshots, commit references, and change logs for future-proofing, easy comparison, and instant single-command rollbacks.

---

## 🏷️ Release Manifest

### [v1.4.0] - Exclusive w LEDGER 2026 n Migration & Full Audit (Current)
- **Date**: 13-Oct-2026
- **Status**: Active Production (main)
- **Key Changes**:
  - **Removed ag LEDGER 2026**: Completely decoupled old g LEDGER 2026 from all configs, scripts, and views.
  - **Sole Source of Truth**: Standardized 100% on w LEDGER 2026 n (Spreadsheet ID: 1uocVkm6qYpuM6zxhv2Hs8tHM-OthlTSOdxBZiRDWziE).
  - **Bundled Fallback Synchronized**: ledger-data.js updated to the live 869 rows (ending on 13-Oct-2026 'Ghhee', closing balance ₹28,035).
  - **Header Refinement**: Replaced the dual-sheet select with a dedicated clean title badge (w LEDGER 2026 n) with backward-compatible DOM mapping.
  - **Background Daemon Terminated & Updated**: Stopped lingering background sync_server.py and repointed its default URL to w LEDGER 2026 n.
  - **Comprehensive Audit**: Full mathematical, UI, write-back, and chart verification executed.

### [v1.3.2] - Income by Accounts Charts & Visuals
- **Date**: 13-Oct-2026
- **Status**: Active Production (`main`)
- **Key Changes**:
  - **Income by Accounts Donut Chart**: Added directly below Expense by Category with matching layout, visuals, and interactive slice selection.
  - **Inline Result Grid / List**: Expandable `#incAccDonutTxPanel` with Cards vs Dense Table toggle, sort dropdown, and minimize controls.
  - **Income Account Matrix Table**: Symmetrical matrix table displaying each income source, total inflow amount, and percentage share.
  - **Live Search & Word Behavior**: Search terms dynamically filter matching incomes by account in-place across Donut, Legend, and inline cards.
  - **Undo / Back Button**: Added `↩ Back` trigger (`#btnResetIncomeAccountChart`) to revert income account filter in 1 tap.

### [v1.3.1] - Sheet Persistence & Cache Hardening
- **Date**: 13-Oct-2026
- **Status**: Stable Production
- **Key Changes**:
  - Added `localStorage` persistence for active sheet choice (`w LEDGER 2026 n` vs `ag LEDGER 2026`).
  - Pre-cached startup dataset to eliminate cold-start flicker.

### [v1.3.0] - Stable Production
- **Date**: 13-Oct-2026
- **Status**: Active Production (`main`)
- **Key Changes**:
  - **In-Place Universal Search**: Searching works seamlessly across **Charts Tab**, **Overview/Summary Tab**, and **Ledger Tab** without unwanted tab-switching.
  - **Multi-Token Cross-Field Search**: Supports queries spanning multiple columns (e.g., `netflix recharges`, `netflix 150`, `pnb netflix`, singular/plural stems).
  - **Grid Card View Update**: Displays **For Purpose** (`item.forEntity`) instead of By Person; completely hides Balance from cards.
  - **Tactile Long-Press & Debounce**: Eliminated modal opening flicker via capturing-phase ghost click interception and GPU hardware acceleration (`transform: translate3d(0,0,0)`).
  - **Column H Balance Protection**: Preserves Google Sheet Column H formulas by splitting write ranges into Columns 1–7 (A–G) and Columns 9–13 (I–M).
  - **Chronological Date Placement**: Automatically identifies prior chronological date row to insert entries in correct order.
- **Snapshot Path**: [`version_backups/v1.3.0_stable_production/`](file:///version_backups/v1.3.0_stable_production/)

---

### [v1.2.0] - Touch Debounce & Form Enhancements
- **Date**: 13-Oct-2026
- **Commit**: `b6df542`
- **Key Changes**:
  - Long-press touch debouncing to prevent double `contextmenu` firing on Android.
  - Category autocomplete dropdown max-height expanded to 310px.
  - Date input integrated with native popup calendar picker (`editTxHiddenDatePicker`).

---

### [v1.1.0] - Dual-Sheet Live Bridge & Quick Write-Back
- **Date**: 12-Oct-2026
- **Commit**: `282e3f7`
- **Key Changes**:
  - Dual sheet support for `ag LEDGER 2026` and `w LEDGER 2026 n`.
  - Direct Apps Script webhook write-back integration.
  - Column H running balance protection in Apps Script.

---

### [v1.0.0] - Initial Mobile-First Ledger Dashboard
- **Date**: 11-Oct-2026
- **Key Changes**:
  - Baseline mobile analytics dashboard for Samsung Galaxy S25 Ultra.
  - Overview KPI cards, interactive SVG donut charts, and live ledger stream.

---

## 🛠️ Instant Rollback & Fetching Guide

If you ever need to inspect or restore any historical file:

1. **View Historical Snapshot**:
   Open the folder directly in [`version_backups/`](file:///version_backups/).
2. **Git Commit History**:
   Run `git log --oneline -n 10` in terminal to view past commits.
3. **Restore Any File to a Past Commit**:
   ```bash
   git checkout <commit_hash> -- mobile.js
   ```
