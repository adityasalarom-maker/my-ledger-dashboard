---
name: ledger-reconciliation-audit
description: Trigger when performing mathematical reconciliation audits on the ledger, verifying Column H balance formulas, checking row sequence continuity, or identifying financial discrepancies.
---

# Skill: Ledger Reconciliation & Mathematical Audit Engine

## Overview
Provides strict mathematical verification of ledger data integrity, formula consistency in Column H, and account balance reconciliation across historical rows.

## Operational Workflow

### Step 1: Data Extraction & Pre-flight Validation
1. Load all ledger records (from `ledger-data.js` or via live GAS endpoint).
2. Verify total row count, non-empty date fields, and numerical validity of amounts.

### Step 2: Formula Invariant Verification
Iterate from Row 2 to Row N:
```python
# Invariant:
expected_balance[r] = balance[r-1] + income[r] - expense[r]
if abs(actual_balance[r] - expected_balance[r]) > 0.01:
    raise DiscrepancyError(row=r, expected=expected_balance[r], actual=actual_balance[r])
```

### Step 3: Column H Formula Check
Confirm that for every row in Google Sheets, Column H contains the relative formula:
`=IF(ISBLANK(A{r}), "", N(H{r-1}) + N(J{r}) - N(G{r}))`
Flag any cells containing hardcoded static numbers.

### Step 4: Account Sub-ledger Reconciliation
1. Compute wallet/account balances:
   - `Hom Cash Balance = Sum(Cash Inflow) - Sum(Cash Outflow)`
   - `PNB Online Balance = Sum(PNB Inflow) - Sum(PNB Outflow)`
2. Compare sub-ledger totals against overall cumulative ledger balance.
3. Generate a structured Audit Report with Pass/Fail status and remediation actions.
