/**
 * LEDGER ANALYTICS DASHBOARD - CLIENT CONTROLLER
 * Full Live Google Sheets Synchronization & Reactive Visual Infographics
 */

(function () {
  'use strict';

  // Master In-Memory Dataset
  let rawLedgerData = Array.isArray(window.LEDGER_DATA) ? window.LEDGER_DATA : [];
  let normalizedData = [];

  // ==================== 1. APPLICATION STATE ====================
  const state = {
    selectedMonth: 'All',
    selectedCategory: 'All',
    selectedPerson: 'All',
    selectedFor: 'All',
    searchKeyword: '',
    searchMode: 'similar', // 'similar' or 'exact'
    selectedExpenseAcc: 'All',
    selectedIncomeAcc: 'All',
    sortField: 'date',
    sortDirection: 'desc',
    visibleLimit: 100,
    mobileViewMode: 'table', // 'table' or 'cards'
    activeView: 'split',    // 'split', 'visuals', 'grid'
    isSyncing: false,
    lastSyncTimestamp: 0
  };

  // Color Palettes
  const CATEGORY_COLORS = [
    '#10B981', '#3B82F6', '#8B5CF6', '#EC4899', 
    '#F59E0B', '#06B6D4', '#14B8A6', '#64748B',
    '#EA4335', '#FBBC04', '#4285F4', '#34A853'
  ];

  const ACCOUNT_COLORS = {
    'Hom Cash': '#10b981',
    'PNB Online': '#3b82f6',
    'Trishaa Cash': '#f59e0b',
    'Trishaa GPay': '#8b5cf6',
    'Cash Earning E': '#06b6d4',
    'Cash Earning I': '#14b8a6'
  };

  const DEFAULT_ACC_COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4'];

  // Indian Rupee Currency Formatter
  function formatINR(val) {
    if (val === null || val === undefined || isNaN(val)) return '₹0';
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(Number(val));
  }

  function escapeHTML(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // Parse Date strings safely
  function parseDateValue(dateStr) {
    if (!dateStr) return new Date(0);
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) return d;
    // Format: 1-Jan-2026 or 01-Jan-2026
    const parts = String(dateStr).split('-');
    if (parts.length === 3) {
      const monthNames = { 'jan':0, 'feb':1, 'mar':2, 'apr':3, 'may':4, 'jun':5, 'jul':6, 'aug':7, 'sep':8, 'oct':9, 'nov':10, 'dec':11 };
      const day = parseInt(parts[0], 10);
      const m = monthNames[parts[1].toLowerCase().slice(0, 3)];
      const y = parseInt(parts[2], 10);
      if (!isNaN(day) && m !== undefined && !isNaN(y)) {
        return new Date(y, m, day);
      }
    }
    return new Date(0);
  }

  // ==================== 2. DATA NORMALIZATION ====================
  function normalizeRawRecords(records) {
    if (!Array.isArray(records)) return [];
    return records.map((row, idx) => {
      const dateVal = row.date || '';
      const amtExp = typeof row.amt_exp === 'number' ? row.amt_exp : parseFloat(row.amt_exp) || 0;
      const amtIn = typeof row.amt_in === 'number' ? row.amt_in : parseFloat(row.amt_in) || 0;
      const bal = typeof row.bal === 'number' ? row.bal : parseFloat(row.bal) || 0;
      
      let monthVal = row.month || '';
      if (!monthVal && dateVal) {
        const d = parseDateValue(dateVal);
        if (!isNaN(d.getTime()) && d.getTime() > 0) {
          monthVal = d.toLocaleString('en-US', { month: 'short' });
        }
      }

      return {
        id: idx,
        rowNumber: row.row || idx + 2,
        date: dateVal,
        dateObj: parseDateValue(dateVal),
        by: row.by || 'Honey',
        forEntity: row.for || 'Home',
        item: row.item || '',
        expenseAcc: row.exp_acc || 'Hom Cash',
        category: row.cat || 'misc expn',
        amountXpns: amtExp,
        balance: bal,
        info: row.info || '',
        amtInCredit: amtIn,
        incomeAccnt: row.inc_acc || '',
        month: monthVal || 'Other'
      };
    }).filter(t => t.date || t.item || t.amountXpns || t.amtInCredit);
  }

  // ==================== 3. FILTER DROPDOWNS POPULATION ====================
  function populateFilterDropdowns() {
    const categories = new Set();
    const persons = new Set();
    const purposes = new Set();
    const expenseAccs = new Set();
    const incomeAccs = new Set();

    normalizedData.forEach(item => {
      if (item.category) categories.add(item.category);
      if (item.by) persons.add(item.by);
      if (item.forEntity) purposes.add(item.forEntity);
      if (item.expenseAcc) expenseAccs.add(item.expenseAcc);
      if (item.incomeAccnt) incomeAccs.add(item.incomeAccnt);
    });

    function fillSelect(selectId, setValues, currentValue, defaultLabel) {
      const el = document.getElementById(selectId);
      if (!el) return;
      const sorted = Array.from(setValues).sort();
      let html = `<option value="All">${defaultLabel}</option>`;
      sorted.forEach(val => {
        const isSelected = val === currentValue ? 'selected' : '';
        html += `<option value="${escapeHTML(val)}" ${isSelected}>${escapeHTML(val)}</option>`;
      });
      el.innerHTML = html;
    }

    fillSelect('filterCategorySelect', categories, state.selectedCategory, 'All Categories');
    fillSelect('filterPersonSelect', persons, state.selectedPerson, 'All Persons');
    fillSelect('filterForSelect', purposes, state.selectedFor, 'All Purposes');
    fillSelect('filterExpenseAccSelect', expenseAccs, state.selectedExpenseAcc, 'All Accounts');
    fillSelect('filterIncomeAccSelect', incomeAccs, state.selectedIncomeAcc, 'All Banks');
  }

  // ==================== 4. DATA FILTERING & SORTING ====================
  function getFilteredAndSortedData() {
    let list = normalizedData.filter(item => {
      // Month Filter
      if (state.selectedMonth !== 'All' && item.month !== state.selectedMonth) return false;
      // Category Filter
      if (state.selectedCategory !== 'All' && item.category !== state.selectedCategory) return false;
      // Person Filter
      if (state.selectedPerson !== 'All' && item.by !== state.selectedPerson) return false;
      // Purpose Filter
      if (state.selectedFor !== 'All' && item.forEntity !== state.selectedFor) return false;
      // Expense Account Filter
      if (state.selectedExpenseAcc !== 'All' && item.expenseAcc !== state.selectedExpenseAcc) return false;
      // Income Account Filter
      if (state.selectedIncomeAcc !== 'All' && item.incomeAccnt !== state.selectedIncomeAcc) return false;

      // Keyword Search
      if (state.searchKeyword) {
        const query = state.searchKeyword.toLowerCase().trim();
        const itemText = (item.item || '').toLowerCase();
        const infoText = (item.info || '').toLowerCase();

        if (state.searchMode === 'exact') {
          const matchItem = itemText === query;
          const matchInfo = infoText === query;
          if (!matchItem && !matchInfo) return false;
        } else {
          // Similar / Substring mode
          const matchItem = itemText.includes(query);
          const matchInfo = infoText.includes(query);
          if (!matchItem && !matchInfo) return false;
        }
      }

      return true;
    });

    // Sorting
    list.sort((a, b) => {
      let valA, valB;
      if (state.sortField === 'date') {
        valA = a.dateObj.getTime();
        valB = b.dateObj.getTime();
      } else if (state.sortField === 'amountXpns') {
        valA = a.amountXpns;
        valB = b.amountXpns;
      } else if (state.sortField === 'amtInCredit') {
        valA = a.amtInCredit;
        valB = b.amtInCredit;
      } else if (state.sortField === 'balance') {
        valA = a.balance;
        valB = b.balance;
      } else if (state.sortField === 'item') {
        valA = (a.item || '').toLowerCase();
        valB = (b.item || '').toLowerCase();
      } else if (state.sortField === 'category') {
        valA = (a.category || '').toLowerCase();
        valB = (b.category || '').toLowerCase();
      } else if (state.sortField === 'by') {
        valA = (a.by || '').toLowerCase();
        valB = (b.by || '').toLowerCase();
      } else if (state.sortField === 'forEntity') {
        valA = (a.forEntity || '').toLowerCase();
        valB = (b.forEntity || '').toLowerCase();
      } else if (state.sortField === 'expenseAcc') {
        valA = (a.expenseAcc || '').toLowerCase();
        valB = (b.expenseAcc || '').toLowerCase();
      } else {
        valA = a.id;
        valB = b.id;
      }

      if (valA < valB) return state.sortDirection === 'asc' ? -1 : 1;
      if (valA > valB) return state.sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return list;
  }

  // ==================== 5. RENDER KPI CARDS (ON LEFT) ====================
  function renderKPIs(filteredData) {
    let totalExpense = 0;
    let totalIncome = 0;

    filteredData.forEach(item => {
      totalExpense += item.amountXpns;
      totalIncome += item.amtInCredit;
    });

    const netBalance = totalIncome - totalExpense;

    // Closing Balance from active dataset
    let closingBalance = 0;
    if (normalizedData.length > 0) {
      // Find latest non-zero balance or last record
      for (let i = normalizedData.length - 1; i >= 0; i--) {
        if (normalizedData[i].balance !== 0) {
          closingBalance = normalizedData[i].balance;
          break;
        }
      }
      if (closingBalance === 0 && normalizedData.length > 0) {
        closingBalance = normalizedData[normalizedData.length - 1].balance;
      }
    }

    // Update Elements
    const elExp = document.getElementById('valTotalExpense');
    const elInc = document.getElementById('valTotalIncome');
    const elNet = document.getElementById('valNetBalance');
    const elBal = document.getElementById('valClosingBalance');

    if (elExp) elExp.textContent = formatINR(totalExpense);
    if (elInc) elInc.textContent = formatINR(totalIncome);
    if (elBal) elBal.textContent = formatINR(closingBalance);

    if (elNet) {
      elNet.textContent = (netBalance < 0 ? '-' : '') + formatINR(Math.abs(netBalance));
      if (netBalance < 0) {
        elNet.className = 'kpi-value text-rose-400 font-mono';
      } else {
        elNet.className = 'kpi-value text-cyan-300 font-mono';
      }
    }
  }

  // ==================== 6. RENDER DONUT CHARTS (SVG) ====================
  function renderDonutChart(svgId, centerAmountId, centerSubId, legendId, dataMap, totalAmount, emptyLabel) {
    const svgEl = document.getElementById(svgId);
    const amountEl = document.getElementById(centerAmountId);
    const subEl = document.getElementById(centerSubId);
    const legendEl = document.getElementById(legendId);

    if (!svgEl || !amountEl || !legendEl) return;

    if (totalAmount <= 0 || dataMap.length === 0) {
      svgEl.innerHTML = `
        <circle cx="100" cy="100" r="75" fill="none" stroke="#334155" stroke-width="26" opacity="0.3" />
      `;
      amountEl.textContent = '₹0';
      if (subEl) subEl.textContent = emptyLabel;
      legendEl.innerHTML = '<div class="text-xs text-slate-500 py-2 text-center">No expenses in selection</div>';
      return;
    }

    amountEl.textContent = formatINR(totalAmount);
    if (subEl) subEl.textContent = `${dataMap.length} items`;

    const radius = 72;
    const circumference = 2 * Math.PI * radius;
    let accumulatedOffset = 0;
    let svgPaths = '';
    let legendHtml = '';

    dataMap.forEach((item, idx) => {
      const pct = (item.amount / totalAmount) * 100;
      const strokeDasharray = `${(pct / 100) * circumference} ${circumference}`;
      const strokeDashoffset = -accumulatedOffset;
      const color = item.color || CATEGORY_COLORS[idx % CATEGORY_COLORS.length];

      svgPaths += `
        <circle 
          cx="100" cy="100" r="${radius}" 
          fill="none" 
          stroke="${color}" 
          stroke-width="24" 
          stroke-dasharray="${strokeDasharray}" 
          stroke-dashoffset="${strokeDashoffset}"
          class="donut-slice"
          data-name="${escapeHTML(item.name)}"
          data-amount="${item.amount}"
          data-pct="${pct.toFixed(1)}"
        />
      `;

      accumulatedOffset += (pct / 100) * circumference;

      legendHtml += `
        <div class="legend-item" data-name="${escapeHTML(item.name)}" data-amount="${item.amount}">
          <div class="legend-item-left">
            <span class="legend-color-dot" style="background-color: ${color}"></span>
            <span class="legend-name" title="${escapeHTML(item.name)}">${escapeHTML(item.name)}</span>
          </div>
          <div class="legend-item-right">
            <span class="legend-amount">${formatINR(item.amount)}</span>
            <span class="legend-pct">${pct.toFixed(1)}%</span>
          </div>
        </div>
      `;
    });

    svgEl.innerHTML = svgPaths;
    legendEl.innerHTML = legendHtml;

    // Attach Hover & Click Events to Slices
    const tooltip = document.getElementById('chartTooltip');
    const slices = svgEl.querySelectorAll('.donut-slice');
    slices.forEach(slice => {
      slice.addEventListener('click', () => {
        const name = slice.getAttribute('data-name');
        if (typeof onSelectCallback === 'function') onSelectCallback(name);
      });
      slice.addEventListener('mouseenter', (e) => {
        const name = slice.getAttribute('data-name');
        const amt = parseFloat(slice.getAttribute('data-amount')) || 0;
        const pct = slice.getAttribute('data-pct');

        amountEl.textContent = formatINR(amt);
        if (subEl) subEl.textContent = `${name} (${pct}%)`;

        if (tooltip) {
          tooltip.innerHTML = `<strong>${escapeHTML(name)}</strong><br>${formatINR(amt)} (${pct}%)`;
          tooltip.classList.remove('hidden');
        }
      });

      slice.addEventListener('mousemove', (e) => {
        if (tooltip && !tooltip.classList.contains('hidden')) {
          tooltip.style.left = (e.clientX + 12) + 'px';
          tooltip.style.top = (e.clientY + 12) + 'px';
        }
      });

      slice.addEventListener('mouseleave', () => {
        amountEl.textContent = formatINR(totalAmount);
        if (subEl) subEl.textContent = `${dataMap.length} items`;
        if (tooltip) tooltip.classList.add('hidden');
      });
    });
  }

  function renderCategoryDonut(filteredData) {
    const catMap = {};
    let totalCatExpense = 0;

    filteredData.forEach(item => {
      if (item.amountXpns > 0) {
        const cat = item.category || 'misc expn';
        catMap[cat] = (catMap[cat] || 0) + item.amountXpns;
        totalCatExpense += item.amountXpns;
      }
    });

    const sortedCats = Object.keys(catMap).map((cat, idx) => ({
      name: cat,
      amount: catMap[cat],
      color: CATEGORY_COLORS[idx % CATEGORY_COLORS.length]
    })).sort((a, b) => b.amount - a.amount);

    renderDonutChart(
      'categoryDonutSvg',
      'categoryDonutCenterAmount',
      'categoryDonutCenterSub',
      'categoryLegendList',
      sortedCats,
      totalCatExpense,
      'No Expenses',
      (catName) => {
        state.selectedCategory = catName;
        const sel = document.getElementById('selectCategory');
        if (sel) sel.value = catName;
        updateAllViews();
        showToast(`Filtered Category: ${catName}`);
      }
    );
  }

  function renderAccountDonut(filteredData) {
    const accMap = {};
    let totalAccExpense = 0;

    filteredData.forEach(item => {
      if (item.amountXpns > 0) {
        const acc = item.expenseAcc || 'Hom Cash';
        accMap[acc] = (accMap[acc] || 0) + item.amountXpns;
        totalAccExpense += item.amountXpns;
      }
    });

    let colorIdx = 0;
    const sortedAccs = Object.keys(accMap).map(acc => {
      const color = ACCOUNT_COLORS[acc] || DEFAULT_ACC_COLORS[(colorIdx++) % DEFAULT_ACC_COLORS.length];
      return {
        name: acc,
        amount: accMap[acc],
        color: color
      };
    }).sort((a, b) => b.amount - a.amount);

    renderDonutChart(
      'accountDonutSvg',
      'accountDonutCenterAmount',
      'accountDonutCenterSub',
      'accountLegendList',
      sortedAccs,
      totalAccExpense,
      'No Spend'
    );
  }

  // ==================== 7. RENDER MATRICES & DUAL BARS ====================
  function renderMatrices(filteredData) {
    // 7.1 Category Matrix (S10:T)
    const catMap = {};
    let totalExpense = 0;
    filteredData.forEach(item => {
      if (item.amountXpns > 0) {
        const cat = item.category || 'misc expn';
        catMap[cat] = (catMap[cat] || 0) + item.amountXpns;
        totalExpense += item.amountXpns;
      }
    });

    const sortedCats = Object.keys(catMap).map(cat => ({
      name: cat,
      amount: catMap[cat]
    })).sort((a, b) => b.amount - a.amount);

    const catBadge = document.getElementById('categoryCountBadge');
    if (catBadge) catBadge.textContent = `${sortedCats.length} categories`;

    const catTbody = document.getElementById('categoryMatrixTbody');
    if (catTbody) {
      if (sortedCats.length === 0) {
        catTbody.innerHTML = '<tr><td colspan="3" class="text-center text-slate-500 py-3">No expenses</td></tr>';
      } else {
        catTbody.innerHTML = sortedCats.map(c => {
          const pct = totalExpense > 0 ? ((c.amount / totalExpense) * 100).toFixed(1) : '0.0';
          return `
            <tr>
              <td><strong>${escapeHTML(c.name)}</strong></td>
              <td class="text-right">${formatINR(c.amount)}</td>
              <td class="text-right text-slate-400">${pct}%</td>
            </tr>
          `;
        }).join('');
      }
    }

    // 7.2 Expense Account Matrix (U10:V)
    const accMap = {};
    filteredData.forEach(item => {
      if (item.amountXpns > 0) {
        const acc = item.expenseAcc || 'Hom Cash';
        accMap[acc] = (accMap[acc] || 0) + item.amountXpns;
      }
    });

    const sortedAccs = Object.keys(accMap).map(acc => ({
      name: acc,
      amount: accMap[acc]
    })).sort((a, b) => b.amount - a.amount);

    const accTbody = document.getElementById('accountMatrixTbody');
    if (accTbody) {
      if (sortedAccs.length === 0) {
        accTbody.innerHTML = '<tr><td colspan="3" class="text-center text-slate-500 py-3">No expenses</td></tr>';
      } else {
        accTbody.innerHTML = sortedAccs.map(a => {
          const pct = totalExpense > 0 ? ((a.amount / totalExpense) * 100).toFixed(1) : '0.0';
          return `
            <tr>
              <td><strong>${escapeHTML(a.name)}</strong></td>
              <td class="text-right">${formatINR(a.amount)}</td>
              <td class="text-right text-slate-400">${pct}%</td>
            </tr>
          `;
        }).join('');
      }
    }

    // 7.3 Monthly Cash Flow Dual Bars
    const monthlyMap = {};
    const monthsOrder = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    // Aggregate by month for normalizedData
    normalizedData.forEach(item => {
      const m = item.month;
      if (!monthlyMap[m]) monthlyMap[m] = { exp: 0, inc: 0 };
      monthlyMap[m].exp += item.amountXpns;
      monthlyMap[m].inc += item.amtInCredit;
    });

    let maxMonthVal = 1;
    Object.keys(monthlyMap).forEach(m => {
      if (monthlyMap[m].exp > maxMonthVal) maxMonthVal = monthlyMap[m].exp;
      if (monthlyMap[m].inc > maxMonthVal) maxMonthVal = monthlyMap[m].inc;
    });

    const barsContainer = document.getElementById('monthlyFlowBarsContainer');
    if (barsContainer) {
      const monthsPresent = monthsOrder.filter(m => monthlyMap[m]);
      if (monthsPresent.length === 0) {
        barsContainer.innerHTML = '<div class="text-xs text-slate-500 text-center py-2">No monthly flow data</div>';
      } else {
        barsContainer.innerHTML = monthsPresent.map(m => {
          const exp = monthlyMap[m].exp;
          const inc = monthlyMap[m].inc;
          const expWidth = Math.min(100, Math.round((exp / maxMonthVal) * 100));
          const incWidth = Math.min(100, Math.round((inc / maxMonthVal) * 100));
          return `
            <div class="monthly-flow-row">
              <div class="month-label-row">
                <span class="month-name">${m}</span>
                <div class="month-totals">
                  <span class="month-inc">In: ${formatINR(inc)}</span>
                  <span class="month-exp">Out: ${formatINR(exp)}</span>
                </div>
              </div>
              <div class="bar-track">
                <div class="bar-fill-inflow" style="width: ${incWidth}%" title="Income: ${formatINR(inc)}"></div>
              </div>
              <div class="bar-track" style="margin-top: 2px;">
                <div class="bar-fill-outflow" style="width: ${expWidth}%" title="Expense: ${formatINR(exp)}"></div>
              </div>
            </div>
          `;
        }).join('');
      }
    }
  }

  // ==================== 8. RENDER LEDGER DATA GRID (ON RIGHT) ====================
  function getCategoryColor(cat) {
    const c = (cat || '').toLowerCase();
    if (c.includes('food') || c.includes('grocerry')) return 'background-color: rgba(16, 185, 129, 0.2); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.4);';
    if (c.includes('fuel') || c.includes('petrol')) return 'background-color: rgba(245, 158, 11, 0.2); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.4);';
    if (c.includes('rent') || c.includes('house')) return 'background-color: rgba(99, 102, 241, 0.2); color: #a5b4fc; border: 1px solid rgba(99, 102, 241, 0.4);';
    if (c.includes('budget')) return 'background-color: rgba(6, 182, 212, 0.2); color: #67e8f9; border: 1px solid rgba(6, 182, 212, 0.4);';
    if (c.includes('personal') || c.includes('trishaa')) return 'background-color: rgba(236, 72, 153, 0.2); color: #f472b6; border: 1px solid rgba(236, 72, 153, 0.4);';
    return 'background-color: rgba(51, 65, 85, 0.5); color: #cbd5e1; border: 1px solid rgba(51, 65, 85, 0.7);';
  }

  function renderDataGrid(filteredData) {
    const tbody = document.getElementById('resultGridTbody');
    const cardsView = document.getElementById('mobileCardsView');
    const recordsPill = document.getElementById('recordsPill');
    const footerCountText = document.getElementById('footerCountText');
    const activeFilterSummary = document.getElementById('activeFilterSummary');

    const totalCount = filteredData.length;
    if (recordsPill) recordsPill.textContent = `${totalCount} records`;

    // Filter Breadcrumb Pill
    if (activeFilterSummary) {
      const activeFilters = [];
      if (state.selectedMonth !== 'All') activeFilters.push(`Month: ${state.selectedMonth}`);
      if (state.selectedCategory !== 'All') activeFilters.push(`Cat: ${state.selectedCategory}`);
      if (state.selectedPerson !== 'All') activeFilters.push(`By: ${state.selectedPerson}`);
      if (state.selectedFor !== 'All') activeFilters.push(`For: ${state.selectedFor}`);
      if (state.searchKeyword) activeFilters.push(`"${state.searchKeyword}"`);
      activeFilterSummary.textContent = activeFilters.length > 0 ? activeFilters.join(' • ') : 'All Records';
    }

    const visibleRows = filteredData.slice(0, state.visibleLimit);
    if (footerCountText) {
      footerCountText.textContent = `Showing ${visibleRows.length} of ${totalCount} records`;
    }

    if (!tbody) return;

    if (visibleRows.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="11" class="text-center py-8 text-slate-400">
            <div style="font-size: 1.5rem; margin-bottom: 0.5rem;">🔍</div>
            <strong>No transactions matching active filter criteria</strong><br>
            <span class="text-xs text-slate-500">Try adjusting dropdown filters or clearing search query</span>
          </td>
        </tr>
      `;
      if (cardsView) cardsView.innerHTML = '<div class="text-center py-6 text-slate-500">No transactions found</div>';
      return;
    }

    // Build Table Rows
    let tableHtml = '';
    let cardsHtml = '';

    visibleRows.forEach(item => {
      const catStyle = getCategoryColor(item.category);
      const expText = item.amountXpns > 0 ? formatINR(item.amountXpns) : '-';
      const incText = item.amtInCredit > 0 ? formatINR(item.amtInCredit) : '-';
      const balText = item.balance !== 0 ? formatINR(item.balance) : '-';

      tableHtml += `
        <tr>
          <td class="cell-date">${escapeHTML(item.date)}</td>
          <td class="cell-person"><span class="badge-person">${escapeHTML(item.by)}</span></td>
          <td class="cell-for"><span class="badge-for">${escapeHTML(item.forEntity)}</span></td>
          <td class="cell-item">
            <span class="item-title" title="${escapeHTML(item.item)}">${escapeHTML(item.item)}</span>
          </td>
          <td class="cell-account"><span class="account-pill">${escapeHTML(item.expenseAcc)}</span></td>
          <td class="cell-category">
            <span class="category-tag" style="${catStyle}">${escapeHTML(item.category)}</span>
          </td>
          <td class="cell-expense">${expText}</td>
          <td class="cell-notes" title="${escapeHTML(item.info)}">${escapeHTML(item.info || '-')}</td>
          <td class="cell-credit">${incText}</td>
          <td class="cell-account">${escapeHTML(item.incomeAccnt || '-')}</td>
          <td class="cell-balance">${balText}</td>
        </tr>
      `;

      // Cards View Alternative
      cardsHtml += `
        <div class="record-card">
          <div class="record-card-top">
            <span class="card-date">${escapeHTML(item.date)}</span>
            <span class="category-tag" style="${catStyle}">${escapeHTML(item.category)}</span>
          </div>
          <div class="record-card-item">${escapeHTML(item.item)}</div>
          <div style="font-size: 0.7rem; color: #94a3b8; display: flex; gap: 0.5rem;">
            <span>By: <strong>${escapeHTML(item.by)}</strong></span>
            <span>•</span>
            <span>For: <strong>${escapeHTML(item.forEntity)}</strong></span>
            <span>•</span>
            <span>Acc: <strong>${escapeHTML(item.expenseAcc)}</strong></span>
          </div>
          ${item.info ? `<div style="font-size: 0.68rem; color: #64748b; font-style: italic;">${escapeHTML(item.info)}</div>` : ''}
          <div class="record-card-bottom">
            <div class="card-amount-box">
              ${item.amountXpns > 0 ? `<span style="color: #f43f5e">Exp: ${formatINR(item.amountXpns)}</span>` : ''}
              ${item.amtInCredit > 0 ? `<span style="color: #10b981">Inc: ${formatINR(item.amtInCredit)}</span>` : ''}
            </div>
            <div style="font-size: 0.72rem; color: #e2e8f0; font-family: var(--font-mono)">Bal: ${balText}</div>
          </div>
        </div>
      `;
    });

    tbody.innerHTML = tableHtml;
    if (cardsView) cardsView.innerHTML = cardsHtml;
  }

  // ==================== 9. MASTER UI UPDATE DISPATCHER ====================
  function updateDashboard() {
    const filtered = getFilteredAndSortedData();
    renderKPIs(filtered);
    renderCategoryDonut(filtered);
    renderAccountDonut(filtered);
    renderMatrices(filtered);
    renderDataGrid(filtered);
  }

  // ==================== 10. LIVE SYNC ENGINE (GOOGLE SHEETS) ====================
  async function fetchLiveSyncData(isManualClick = false) {
    if (state.isSyncing) return;
    state.isSyncing = true;

    const syncBtn = document.getElementById('btnManualSync');
    const syncIcon = document.getElementById('syncIconSvg');
    const syncText = document.getElementById('syncStatusText');
    const syncBadge = document.getElementById('syncRecordBadge');

    if (syncIcon) syncIcon.classList.add('spinning');
    if (isManualClick && syncText) syncText.textContent = 'Syncing...';

    try {
      const resp = await fetch('/api/sync', { cache: 'no-store' });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const result = await resp.json();

      if (result && Array.isArray(result.records) && result.records.length > 0) {
        rawLedgerData = result.records;
        normalizedData = normalizeRawRecords(rawLedgerData);
        state.lastSyncTimestamp = result.timestamp || Date.now();

        // Refresh dropdowns while keeping active selections
        populateFilterDropdowns();

        // Re-render UI
        updateDashboard();

        const timeStr = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        if (syncText) syncText.textContent = `Live Synced (${timeStr})`;
        if (syncBadge) syncBadge.textContent = `${normalizedData.length} rows`;
      }
    } catch (err) {
      console.warn('[Sync Error]: Could not reach /api/sync endpoint, using offline data cache.', err);
      if (syncText) syncText.textContent = 'Live Cache Active';
    } finally {
      state.isSyncing = false;
      if (syncIcon) syncIcon.classList.remove('spinning');
    }
  }

  // Auto Polling Every 18 seconds
  function startBackgroundAutoPolling() {
    setInterval(() => {
      fetchLiveSyncData(false);
    }, 18000);
  }

  // ==================== 11. EVENT LISTENERS & WIRING ====================
  function attachEventHandlers() {
    // 1. Month Filter
    const monthSelect = document.getElementById('filterMonthSelect');
    if (monthSelect) {
      monthSelect.addEventListener('change', (e) => {
        state.selectedMonth = e.target.value;
        state.visibleLimit = 100;
        updateDashboard();
      });
    }

    // 2. Category Filter
    const catSelect = document.getElementById('filterCategorySelect');
    if (catSelect) {
      catSelect.addEventListener('change', (e) => {
        state.selectedCategory = e.target.value;
        state.visibleLimit = 100;
        updateDashboard();
      });
    }

    // 3. Person Filter
    const personSelect = document.getElementById('filterPersonSelect');
    if (personSelect) {
      personSelect.addEventListener('change', (e) => {
        state.selectedPerson = e.target.value;
        state.visibleLimit = 100;
        updateDashboard();
      });
    }

    // 4. Purpose Filter
    const forSelect = document.getElementById('filterForSelect');
    if (forSelect) {
      forSelect.addEventListener('change', (e) => {
        state.selectedFor = e.target.value;
        state.visibleLimit = 100;
        updateDashboard();
      });
    }

    // 5. Expense Account Filter
    const expAccSelect = document.getElementById('filterExpenseAccSelect');
    if (expAccSelect) {
      expAccSelect.addEventListener('change', (e) => {
        state.selectedExpenseAcc = e.target.value;
        state.visibleLimit = 100;
        updateDashboard();
      });
    }

    // 6. Income Account Filter
    const incAccSelect = document.getElementById('filterIncomeAccSelect');
    if (incAccSelect) {
      incAccSelect.addEventListener('change', (e) => {
        state.selectedIncomeAcc = e.target.value;
        state.visibleLimit = 100;
        updateDashboard();
      });
    }

    // 7. Search Input & Clear
    const searchInput = document.getElementById('searchKeywordInput');
    const clearBtn = document.getElementById('clearSearchBtn');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        state.searchKeyword = e.target.value;
        state.visibleLimit = 100;
        if (clearBtn) {
          if (state.searchKeyword) clearBtn.classList.remove('hidden');
          else clearBtn.classList.add('hidden');
        }
        updateDashboard();
      });
    }

    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        if (searchInput) searchInput.value = '';
        state.searchKeyword = '';
        clearBtn.classList.add('hidden');
        state.visibleLimit = 100;
        updateDashboard();
      });
    }

    // 8. Search Mode Toggle (Similar vs Exact)
    const btnSim = document.getElementById('btnModeSimilar');
    const btnExact = document.getElementById('btnModeExact');
    if (btnSim && btnExact) {
      btnSim.addEventListener('click', () => {
        btnSim.classList.add('active');
        btnExact.classList.remove('active');
        state.searchMode = 'similar';
        updateDashboard();
      });
      btnExact.addEventListener('click', () => {
        btnExact.classList.add('active');
        btnSim.classList.remove('active');
        state.searchMode = 'exact';
        updateDashboard();
      });
    }

    // 9. Reset Filters Button
    const resetBtn = document.getElementById('resetAllFiltersBtn');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        state.selectedMonth = 'All';
        state.selectedCategory = 'All';
        state.selectedPerson = 'All';
        state.selectedFor = 'All';
        state.selectedExpenseAcc = 'All';
        state.selectedIncomeAcc = 'All';
        state.searchKeyword = '';
        state.searchMode = 'similar';
        state.sortField = 'date';
        state.sortDirection = 'desc';
        state.visibleLimit = 100;

        if (monthSelect) monthSelect.value = 'All';
        if (catSelect) catSelect.value = 'All';
        if (personSelect) personSelect.value = 'All';
        if (forSelect) forSelect.value = 'All';
        if (expAccSelect) expAccSelect.value = 'All';
        if (incAccSelect) incAccSelect.value = 'All';
        if (searchInput) searchInput.value = '';
        if (clearBtn) clearBtn.classList.add('hidden');
        if (btnSim) btnSim.classList.add('active');
        if (btnExact) btnExact.classList.remove('active');

        updateDashboard();
      });
    }

    // 10. Manual Sync Button
    const syncBtn = document.getElementById('btnManualSync');
    if (syncBtn) {
      syncBtn.addEventListener('click', () => {
        fetchLiveSyncData(true);
      });
    }

    // 11. View Mode Toggle (Split, Visuals, Grid)
    const workspace = document.getElementById('dashboardWorkspace');
    const modeBtns = document.querySelectorAll('#viewModeToggleGroup .mode-btn');
    modeBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        modeBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const view = btn.getAttribute('data-view') || 'split';
        state.activeView = view;
        if (workspace) workspace.setAttribute('data-view', view);
      });
    });

    // 12. Toggle Cards vs Table
    const toggleCardsBtn = document.getElementById('toggleMobileCardsBtn');
    const tableEl = document.getElementById('sheetResultTable');
    const cardsEl = document.getElementById('mobileCardsView');
    if (toggleCardsBtn && tableEl && cardsEl) {
      toggleCardsBtn.addEventListener('click', () => {
        if (state.mobileViewMode === 'table') {
          state.mobileViewMode = 'cards';
          toggleCardsBtn.textContent = 'Table Mode';
          tableEl.classList.add('hidden');
          cardsEl.classList.remove('hidden');
        } else {
          state.mobileViewMode = 'table';
          toggleCardsBtn.textContent = 'Cards Mode';
          tableEl.classList.remove('hidden');
          cardsEl.classList.add('hidden');
        }
      });
    }

    // 13. Table Header Sorting
    const thEls = document.querySelectorAll('.sheet-result-table th[data-sort]');
    thEls.forEach(th => {
      th.addEventListener('click', () => {
        const field = th.getAttribute('data-sort');
        if (state.sortField === field) {
          state.sortDirection = state.sortDirection === 'asc' ? 'desc' : 'asc';
        } else {
          state.sortField = field;
          state.sortDirection = field === 'date' || field === 'amountXpns' || field === 'amtInCredit' || field === 'balance' ? 'desc' : 'asc';
        }

        // Update Sort Icons
        thEls.forEach(el => {
          const icon = el.querySelector('.sort-icon');
          if (icon) icon.textContent = '↕';
        });
        const activeIcon = th.querySelector('.sort-icon');
        if (activeIcon) {
          activeIcon.textContent = state.sortDirection === 'asc' ? '↑' : '↓';
        }

        updateDashboard();
      });
    });

    // 14. Scroll to Top
    const scrollBtn = document.getElementById('scrollToTopBtn');
    const scrollBox = document.getElementById('dataGridScrollBox');
    if (scrollBtn && scrollBox) {
      scrollBtn.addEventListener('click', () => {
        scrollBox.scrollTo({ top: 0, behavior: 'smooth' });
      });
    }

    // 15. Pagination (Load More / Show All)
    const loadMoreBtn = document.getElementById('loadMoreBtn');
    const loadAllBtn = document.getElementById('loadAllBtn');
    if (loadMoreBtn) {
      loadMoreBtn.addEventListener('click', () => {
        state.visibleLimit += 50;
        updateDashboard();
      });
    }
    if (loadAllBtn) {
      loadAllBtn.addEventListener('click', () => {
        state.visibleLimit = 99999;
        updateDashboard();
      });
    }
  }

  // ==================== 12. INITIALIZATION ====================
  function init() {
    // Set workspace default view
    const workspace = document.getElementById('dashboardWorkspace');
    if (workspace) workspace.setAttribute('data-view', 'split');

    // Normalize offline cache first
    normalizedData = normalizeRawRecords(rawLedgerData);

    // Populate dropdowns & render offline UI immediately
    populateFilterDropdowns();
    updateDashboard();

    // Attach all event handlers
    attachEventHandlers();

    // Immediately trigger live sync from Google Sheets
    fetchLiveSyncData(false);

    // Start background auto-polling
    startBackgroundAutoPolling();
  }

  // Execute on DOM Ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
