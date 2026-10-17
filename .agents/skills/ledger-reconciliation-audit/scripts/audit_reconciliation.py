# -*- coding: utf-8 -*-
"""
Ledger Balance & Column H Invariant Reconciliation Script
Checks consistency of cumulative running balance:
Balance[i] == Balance[i-1] + Income[i] - Expense[i]
"""

import json
import os
import sys

def audit_ledger(data):
    records = data.get("records", data) if isinstance(data, dict) else data
    print("=" * 60)
    print("LEDGER MATHEMATICAL RECONCILIATION AUDIT")
    print(f"Total Rows Analyzed: {len(records)}")
    print("=" * 60)
    
    discrepancies = []
    running_balance = 0.0
    total_expense = 0.0
    total_income = 0.0
    
    for idx, row in enumerate(records):
        date = row.get("date") or row.get("Date") or "Unknown"
        particulars = row.get("item") or row.get("Particulars") or ""
        expense = float(row.get("amt_exp", 0) or row.get("Expense", 0) or 0)
        income = float(row.get("amt_in", 0) or row.get("Income", 0) or 0)
        reported_balance = float(row.get("balance", 0) or row.get("Balance", 0) or 0)
        
        total_expense += expense
        total_income += income
        
        expected_balance = running_balance + income - expense
        
        if idx > 0 and abs(expected_balance - reported_balance) > 0.05:
            discrepancies.append({
                "row_index": idx + 2, # Sheet row
                "date": date,
                "particulars": particulars,
                "expected": expected_balance,
                "reported": reported_balance,
                "difference": reported_balance - expected_balance
            })
            # Reset running to reported to continue tracking single-row faults
            running_balance = reported_balance
        else:
            running_balance = expected_balance
            
    print(f"Total Aggregated Income / Inflow : Rs. {total_income:,.2f}")
    print(f"Total Aggregated Expense / Outflow: Rs. {total_expense:,.2f}")
    print(f"Final Computed Balance          : Rs. {running_balance:,.2f}")
    
    if discrepancies:
        print(f"\nWARNING: Found {len(discrepancies)} row discrepancy(ies):")
        for d in discrepancies[:5]:
            print(f"  Row {d['row_index']} ({d['date']}): Expected {d['expected']}, Got {d['reported']} (Diff: {d['difference']})")
    else:
        print("\nSTATUS: 100% PERFECT RECONCILIATION. Column H formula integrity verified.")
        
    return len(discrepancies) == 0

if __name__ == "__main__":
    ledger_json_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "..", "scratch", "live_ledger_869.json"))
    if os.path.exists(ledger_json_path):
        with open(ledger_json_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        audit_ledger(data)
    else:
        print("Note: live_ledger_869.json not found in scratch directory; script ready for dynamic data.")
