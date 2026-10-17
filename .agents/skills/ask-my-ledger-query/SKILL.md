---
name: ask-my-ledger-query
description: Trigger when processing, testing, or refining natural-language financial questions (in Hindi, Hinglish, or English), intent matching regexes, donut charts, or ledger balance queries.
---

# Skill: Ask My Ledger - Natural Language Financial Query Engine

## Overview
Executes deterministic, zero-token client-side processing of financial queries across ledger datasets. Supports English, Hindi, and colloquial Hinglish (e.g., *"last month ke expense list do"*, *"kitna bacha hai"*, *"sabji pe total kitna kharch hua"*).

## Operational Workflow

### Step 1: Intent Normalization & Tokenization
1. Convert input query to lowercase and strip superfluous punctuation.
2. Normalize Hinglish transliterations:
   - `kharcha`, `kharch`, `spent`, `expense` -> `EXPENSE`
   - `bacha`, `balance`, `saving`, `remaning` -> `BALANCE`
   - `pichle mahine`, `last month`, `past month` -> `TIME_LAST_MONTH`
   - `is mahine`, `this month`, `current month` -> `TIME_THIS_MONTH`
   - `aaj`, `today`, `kal`, `yesterday` -> Relative date anchors.

### Step 2: Intent Matching & Scoring
Match query tokens against pattern handlers:
- **`EXPENSE_SUMMARY`**: Total expenses for a period or category.
- **`CATEGORY_BREAKDOWN`**: Returns category aggregation with dynamic Donut visualization.
- **`TRANSACTION_LIST`**: Returns itemized list of matching entries with clickable detail modal.
- **`BALANCE_CHECK`**: Returns current bank, cash, or cumulative ledger balance.
- **`COMPARISON`**: Month-over-month or category comparison charts.

### Step 3: Visualization & Response Scaffolding
- When returning categorical breakdowns, render interactive **Chart.js Donut Visualizations** accompanied by an expandable detail table.
- Provide clear KPI cards for `Total Inflow`, `Total Outflow`, `Net Difference`, and `Active Balance`.
- Provide a 1-click **Clear (X)** button on the search input to reset state instantly.

### Step 4: Log Tracking
Every processed query and its outcome must be appended to the local query history log (`localStorage` key: `ledger_assistant_query_logs`), including timestamp, raw query, matched intent, and result row count.
