---
name: ledger-sync-gas
description: Trigger when deploying, synchronizing, testing, or modifying the Google Apps Script gateway (UNIFIED_GOOGLE_APPS_SCRIPT_SYNC.gs) and webhook endpoints for Google Sheets data exchange.
---

# Skill: Google Apps Script (GAS) Ledger Sync Gateway

## Overview
Manages bidirectional synchronization between the client web applications (`mobile.html`, `assistant.html`) and Google Sheets via the Apps Script Webhook endpoint.

## Operational Workflow

### Step 1: Endpoint & Secret Validation
1. Verify the configured Web App URL in `assistant.js` and `mobile.js`:
   `https://script.google.com/macros/s/.../exec`
2. Ensure requests include the security passkey or auth token in the payload or query parameters.

### Step 2: Payload Schema Enforcement
When executing an append or update, the payload must conform to:
```json
{
  "action": "appendRows",
  "passkey": "<SECRET_PASSKEY>",
  "rows": [
    {
      "date": "YYYY-MM-DD",
      "time": "HH:mm",
      "particulars": "Item description",
      "category": "Sabji | Rashan | etc.",
      "expenseAccount": "Hom Cash | PNB Online | etc.",
      "expenseAmount": 250,
      "incomeAmount": 0,
      "by": "Honey",
      "for": "Home"
    }
  ]
}
```

### Step 3: Column H Formula Preservation in GAS
The Apps Script `doPost` handler MUST inject the dynamic formula in Column H:
```javascript
sheet.getRange(nextRow, 8).setFormula(`=IF(ISBLANK(A${nextRow}), "", N(H${nextRow-1}) + N(J${nextRow}) - N(G${nextRow}))`);
```
**NEVER calculate and set a static value in Column H.**

### Step 4: Verification & Response Handling
- Test `GET` request to verify return code 200 and schema `[{ Date, Particulars, Category, Amount, Balance }]`.
- Test `POST` with a mock transaction, verify sheet row addition, and ensure Column H computes properly.
