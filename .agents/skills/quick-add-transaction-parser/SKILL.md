---
name: quick-add-transaction-parser
description: Trigger when parsing raw, informal English or Hinglish expense text notes into structured double-entry ledger rows, resolving lump sums, categories, and account allocations.
---

# Skill: Quick Add Transaction Parser

## Overview
Parses informal, mixed-format transaction logs into validated, categorized ledger rows ready for submission to Google Sheets.

## Operational Workflow

### Step 1: Text Ingestion & Line Normalization
1. Ingest multi-line text input:
   ```text
   13 oct
   250 for ma
   1600 home worker monthly paid
   2760 monthly dudh
   1k for rashan and sabji expenses to ma
   ```
2. Parse date anchors (e.g., `13 oct` -> `2026-10-13`). Propagate date anchor forward until a new date is encountered.
3. Clean out noise characters (bullet points, empty lines).

### Step 2: Token Extraction & Taxonomies
Match tokens against Master Taxonomies (`AI-03_Controlled_Master_Taxonomies__.json`):
- **Categories**: `Sabji`, `Rashan`, `Food`, `Medical`, `Services \ Repairs`, `Bills`, `Recharges`, `Housing`, `BUDGET`, `misc expn`.
- **Expense Accounts**: `Hom Cash`, `PNB Online`, `Trishaa Cash`, `Co bank`, `SBI Vil`, `PO Bk`.
- **Entities**:
  - `By`: Honey, Trishaa, Maa. (Default: `Honey`).
  - `For`: Maa, Home, Trishaa, Honey, Budget, Work.

### Step 3: Lump-Sum & Ambiguity Resolution
1. **Lump-Sum Decomposition**: If a line has *"800 - 200 seb, 30 lahsun, tamatar etc"*, compute `800 - (200 + 30) = 570` for `tamatar etc`.
2. **Ambiguity Flagging**: If a line cannot be parsed with >80% confidence, flag it with an attention badge (`⚠️ Review Needed`) and highlight specific fields for user review before submission.

### Step 4: Interactive Review Grid
Present parsed rows in an editable glassmorphic table allowing the user to modify Date, Particulars, Category, Amount, Account, and Entity before triggering the Google Sheets append.
