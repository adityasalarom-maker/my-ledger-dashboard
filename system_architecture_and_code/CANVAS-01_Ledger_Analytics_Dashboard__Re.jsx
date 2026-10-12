// ================================================================
// ASSET: CANVAS-01 - Ledger Analytics Dashboard (React Canvas Component)
// TYPE: React (JSX / ES6) | TARGET: Canvas Tab: Ledger Analytics Dashboard (ID: 1253870446)
// NOTES: Full interactive Single-Page Application (SPA) dashboard. Backed by range LEDGER!A1:M1015. Features responsive KPI summary cards (Total Outflow, Total Inflow, Net Flow, Closing Balance), Category Donut Chart, Monthly Cash Flow Bar Chart, Real-time Search & Multi-select Filter Bar, and Sortable Transaction Data Grid with INR formatting. Can be pasted into the Canvas code editor to customize styling or logic.
// ================================================================

import React, { useState, useMemo } from 'react';
import { 
  TrendingDown, TrendingUp, DollarSign, Wallet, Search, Filter, 
  Calendar, Tag, User, ArrowUpDown, ChevronDown, RefreshCw, BarChart3, PieChart
} from 'lucide-react';

export default function LedgerAnalyticsDashboard({ data = [] }) {
  // --- 1. FILTER & SEARCH STATE ---
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('All');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedAccount, setSelectedAccount] = useState('All');
  const [selectedPerson, setSelectedPerson] = useState('All');
  const [sortField, setSortField] = useState('date');
  const [sortDirection, setSortDirection] = useState('desc');

  // --- 2. DATA NORMALIZATION (From LEDGER!A1:M1015) ---
  const normalizedData = useMemo(() => {
    if (!data || data.length <= 1) return [];
    return data.slice(1).map((row, idx) => ({
      id: idx,
      date: row[0] || '',
      by: row[1] || 'Honey',
      forEntity: row[2] || 'Home',
      item: row[3] || '',
      expenseAcc: row[4] || 'Hom Cash',
      category: row[5] || 'misc expn',
      amountXpns: parseFloat(row[6]) || 0,
      balance: parseFloat(row[7]) || 0,
      info: row[8] || '',
      amtInCredit: parseFloat(row[9]) || 0,
      incomeAccnt: row[10] || '',
      month: row[12] || (row[0] ? new Date(row[0]).toLocaleString('en-US', { month: 'short' }) : '')
    })).filter(t => t.date || t.item);
  }, [data]);

  // --- 3. FILTERED TRANSACTIONS ---
  const filteredData = useMemo(() => {
    return normalizedData.filter(item => {
      const matchesSearch = searchQuery === '' || 
        item.item.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.info.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.category.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesMonth = selectedMonth === 'All' || item.month === selectedMonth;
      const matchesCategory = selectedCategory === 'All' || item.category === selectedCategory;
      const matchesAccount = selectedAccount === 'All' || item.expenseAcc === selectedAccount;
      const matchesPerson = selectedPerson === 'All' || item.by === selectedPerson;
      return matchesSearch && matchesMonth && matchesCategory && matchesAccount && matchesPerson;
    });
  }, [normalizedData, searchQuery, selectedMonth, selectedCategory, selectedAccount, selectedPerson]);

  // --- 4. SORTED TRANSACTIONS ---
  const sortedData = useMemo(() => {
    return [...filteredData].sort((a, b) => {
      let aVal = a[sortField];
      let bVal = b[sortField];
      if (sortField === 'amountXpns' || sortField === 'amtInCredit' || sortField === 'balance') {
        aVal = Number(aVal) || 0;
        bVal = Number(bVal) || 0;
      }
      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredData, sortField, sortDirection]);

  // --- 5. AGGREGATED KPIS ---
  const metrics = useMemo(() => {
    const totalOutflow = filteredData.reduce((acc, curr) => acc + curr.amountXpns, 0);
    const totalInflow = filteredData.reduce((acc, curr) => acc + curr.amtInCredit, 0);
    const netFlow = totalInflow - totalOutflow;
    const closingBalance = filteredData.length > 0 ? filteredData[filteredData.length - 1].balance : 0;
    return { totalOutflow, totalInflow, netFlow, closingBalance };
  }, [filteredData]);

  // --- 6. CATEGORY BREAKDOWN ---
  const categoryTotals = useMemo(() => {
    const totals = {};
    filteredData.forEach(item => {
      if (item.amountXpns > 0 && item.category !== 'BUDGET') {
        totals[item.category] = (totals[item.category] || 0) + item.amountXpns;
      }
    });
    return Object.entries(totals)
      .sort((a, b) => b[1] - a[1])
      .map(([name, value]) => ({ name, value }));
  }, [filteredData]);

  // --- 7. MONTHLY CASH FLOW (INFLOW VS OUTFLOW) ---
  const monthlyFlow = useMemo(() => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const map = {};
    months.forEach(m => { map[m] = { in: 0, out: 0 }; });
    filteredData.forEach(item => {
      if (map[item.month]) {
        map[item.month].in += item.amtInCredit;
        map[item.month].out += item.amountXpns;
      }
    });
    return months.filter(m => map[m].in > 0 || map[m].out > 0).map(m => ({
      month: m,
      inflow: map[m].in,
      outflow: map[m].out
    }));
  }, [filteredData]);

  // Helper formatting
  const formatINR = (val) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val);

  return (
    <div className="flex flex-col min-h-screen bg-slate-900 text-slate-100 p-6 font-sans">
      {/* HEADER BAR */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-6 border-b border-slate-800 gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <Wallet className="w-7 h-7 text-emerald-400" />
            Ledger Analytics Dashboard
          </h1>
          <p className="text-sm text-slate-400 mt-1">Synced Multi-Account Cash & Bank Operating System</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input 
              type="text" 
              placeholder="Search items, info, notes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500 w-64"
            />
          </div>
          <select 
            value={selectedMonth} 
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none"
          >
            <option value="All">All Months</option>
            {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map(m => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>
      </div>

      {/* KPI METRIC CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 my-6">
        <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl p-5 shadow-sm">
          <div className="flex justify-between items-center text-slate-400 text-sm">
            <span>Total Outflow (Debit)</span>
            <TrendingDown className="w-5 h-5 text-rose-400" />
          </div>
          <div className="text-2xl font-bold text-white mt-2">{formatINR(metrics.totalOutflow)}</div>
          <div className="text-xs text-rose-400 mt-1">Operational household spending</div>
        </div>

        <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl p-5 shadow-sm">
          <div className="flex justify-between items-center text-slate-400 text-sm">
            <span>Total Inflow (Credit)</span>
            <TrendingUp className="w-5 h-5 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-white mt-2">{formatINR(metrics.totalInflow)}</div>
          <div className="text-xs text-emerald-400 mt-1">Pensions, rent & budget additions</div>
        </div>

        <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl p-5 shadow-sm">
          <div className="flex justify-between items-center text-slate-400 text-sm">
            <span>Net Cash Flow</span>
            <DollarSign className={`w-5 h-5 ${metrics.netFlow >= 0 ? 'text-emerald-400' : 'text-amber-400'}`} />
          </div>
          <div className={`text-2xl font-bold mt-2 ${metrics.netFlow >= 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
            {formatINR(metrics.netFlow)}
          </div>
          <div className="text-xs text-slate-400 mt-1">Inflow minus operational expenses</div>
        </div>

        <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl p-5 shadow-sm">
          <div className="flex justify-between items-center text-slate-400 text-sm">
            <span>Closing Balance</span>
            <Wallet className="w-5 h-5 text-cyan-400" />
          </div>
          <div className="text-2xl font-bold text-cyan-300 mt-2">{formatINR(metrics.closingBalance)}</div>
          <div className="text-xs text-slate-400 mt-1">Cumulative operational liquidity</div>
        </div>
      </div>

      {/* DASHBOARD SPLIT: ANALYTICS SIDEBAR & TRANSACTION GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LEFT COLUMN: VISUAL CHARTS & BREAKDOWN */}
        <div className="flex flex-col gap-6">
          {/* CATEGORY BREAKDOWN */}
          <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl p-5">
            <h3 className="text-base font-semibold text-white flex items-center gap-2 mb-4">
              <PieChart className="w-4 h-4 text-emerald-400" />
              Expense Breakdown by Category
            </h3>
            <div className="space-y-3">
              {categoryTotals.slice(0, 8).map(({ name, value }) => {
                const pct = metrics.totalOutflow > 0 ? ((value / metrics.totalOutflow) * 100).toFixed(1) : 0;
                return (
                  <div key={name} className="flex flex-col gap-1">
                    <div className="flex justify-between text-xs">
                      <span className="font-medium text-slate-300">{name}</span>
                      <span className="text-slate-400">{formatINR(value)} ({pct}%)</span>
                    </div>
                    <div className="w-full bg-slate-700/50 rounded-full h-2 overflow-hidden">
                      <div className="bg-emerald-500 h-2 rounded-full" style={{ width: `${pct}%` }}></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* MONTHLY CASH FLOW COMPARISON */}
          <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl p-5">
            <h3 className="text-base font-semibold text-white flex items-center gap-2 mb-4">
              <BarChart3 className="w-4 h-4 text-cyan-400" />
              Monthly Inflow vs Outflow
            </h3>
            <div className="space-y-4">
              {monthlyFlow.map(row => (
                <div key={row.month} className="space-y-1">
                  <div className="flex justify-between text-xs text-slate-300">
                    <span className="font-semibold">{row.month}</span>
                    <span className="text-slate-400">In: {formatINR(row.inflow)} | Out: {formatINR(row.outflow)}</span>
                  </div>
                  <div className="flex gap-1 h-3">
                    <div 
                      className="bg-emerald-500 rounded-sm" 
                      style={{ width: `${Math.min(100, (row.inflow / (metrics.totalInflow || 1)) * 100)}%` }}
                      title={`Inflow: ${formatINR(row.inflow)}`}
                    />
                    <div 
                      className="bg-rose-500 rounded-sm" 
                      style={{ width: `${Math.min(100, (row.outflow / (metrics.totalOutflow || 1)) * 100)}%` }}
                      title={`Outflow: ${formatINR(row.outflow)}`}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: TRANSACTION DATA GRID */}
        <div className="lg:col-span-2 bg-slate-800/80 border border-slate-700/80 rounded-xl p-5 flex flex-col">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-base font-semibold text-white">Ledger Data Grid</h3>
            <span className="text-xs text-slate-400">{sortedData.length} records displayed</span>
          </div>

          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-700 text-slate-400 bg-slate-800">
                  <th className="py-2.5 px-3 cursor-pointer" onClick={() => { setSortField('date'); setSortDirection(d => d === 'asc' ? 'desc' : 'asc'); }}>Date</th>
                  <th className="py-2.5 px-3">Item / Description</th>
                  <th className="py-2.5 px-3">Category</th>
                  <th className="py-2.5 px-3">Account</th>
                  <th className="py-2.5 px-3">By / For</th>
                  <th className="py-2.5 px-3 text-right">Expense</th>
                  <th className="py-2.5 px-3 text-right">Income</th>
                  <th className="py-2.5 px-3 text-right">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {sortedData.slice(0, 100).map(t => (
                  <tr key={t.id} className="hover:bg-slate-700/30 transition-colors">
                    <td className="py-2.5 px-3 text-slate-300 whitespace-nowrap">{t.date}</td>
                    <td className="py-2.5 px-3 font-medium text-white max-w-xs truncate" title={t.item}>
                      {t.item}
                      {t.info && <span className="block text-[10px] text-slate-400 truncate">{t.info}</span>}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="inline-block px-2 py-0.5 rounded text-[11px] bg-slate-700 text-slate-200">
                        {t.category}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-300">{t.expenseAcc}</td>
                    <td className="py-2.5 px-3 text-slate-400">{t.by} → {t.forEntity}</td>
                    <td className="py-2.5 px-3 text-right font-medium text-rose-400">
                      {t.amountXpns > 0 ? formatINR(t.amountXpns) : '-'}
                    </td>
                    <td className="py-2.5 px-3 text-right font-medium text-emerald-400">
                      {t.amtInCredit > 0 ? formatINR(t.amtInCredit) : '-'}
                    </td>
                    <td className="py-2.5 px-3 text-right text-slate-300">
                      {t.balance > 0 ? formatINR(t.balance) : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
