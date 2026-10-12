/**
 * LEDGER MOBILE DASHBOARD - MOBILE.JS
 * Complete Reactive Controller for Samsung Galaxy S25 Ultra
 * Live Google Sheets GViz Sync • Interactive Donut Charts • Multi-Criteria Filtering
 */

(function () {
  'use strict';

  // ==================== DUAL GOOGLE SHEETS CONFIGURATION ====================
  const SHEETS_CONFIG = {
    sheet1: {
      id: '1qVzr4XNstdYC7aqjLw_ueghBhrKJmIZkPKHeAp4UH-4',
      name: 'ag LEDGER 2026',
      shortName: 'ag LEDGER 2026',
      url: 'https://docs.google.com/spreadsheets/d/1qVzr4XNstdYC7aqjLw_ueghBhrKJmIZkPKHeAp4UH-4/edit'
    },
    sheet2: {
      id: '1uocVkm6qYpuM6zxhv2Hs8tHM-OthlTSOdxBZiRDWziE',
      name: 'w LEDGER 2026 n',
      shortName: 'w LEDGER 2026 n',
      url: 'https://docs.google.com/spreadsheets/d/1uocVkm6qYpuM6zxhv2Hs8tHM-OthlTSOdxBZiRDWziE/edit'
    }
  };

  function detectInitialSheet() {
    const params = new URLSearchParams(window.location.search);
    const s = (params.get('sheet') || '').toLowerCase();
    if (s === '2' || s === 'w' || s === 'sheet2' || s.includes('1uocvkm6qypu')) return 'sheet2';
    if (s === '1' || s === 'ag' || s === 'sheet1' || s.includes('1qvzr4xnstd')) return 'sheet1';
    const id = params.get('id');
    if (id === SHEETS_CONFIG.sheet2.id) return 'sheet2';
    return 'sheet1';
  }

  let currentSheetKey = detectInitialSheet();
  let activeDetailTx = null;

  // Master In-Memory Dataset
  let rawLedgerData = Array.isArray(window.LEDGER_DATA) ? window.LEDGER_DATA : [];
  let normalizedData = [];

  // ==================== 1. MOBILE APP STATE ====================
  const state = {
    currentTab: 'tabViewOverview',
    previousTab: 'tabViewOverview',
    catDonutTxMinimized: false,
    accDonutTxMinimized: false,
    selectedMonth: 'All',
    selectedCategory: 'All',
    selectedPerson: 'All',
    selectedFor: 'All',
    selectedExpenseAcc: 'All',
    selectedIncomeAcc: 'All',
    onlyIncome: false,
    searchKeyword: '',
    searchMode: 'similar', // 'similar' or 'exact'
    sortOrder: 'date_desc',
    displayMode: 'cards', // 'cards' or 'table'
    visibleLimit: 50,
    isSyncing: false,
    lastSyncTime: 0
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

  function parseDateValue(dateStr) {
    if (!dateStr) return new Date(0);
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) return d;
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

  // Toast Notification
  function showToast(msg) {
    const toast = document.getElementById('mobileToast');
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.remove('hidden');
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => {
      toast.classList.add('hidden');
    }, 2400);
  }


  // ==================== DIRECT GOOGLE SHEETS CSV PARSER ====================
  function parseCSV(text) {
    const lines = [];
    let row = [];
    let inQuotes = false;
    let curVal = '';

    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      const next = text[i + 1];

      if (c === '"') {
        if (inQuotes && next === '"') {
          curVal += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (c === ',' && !inQuotes) {
        row.push(curVal);
        curVal = '';
      } else if ((c === '\r' || c === '\n') && !inQuotes) {
        if (c === '\r' && next === '\n') i++;
        row.push(curVal);
        if (row.some(cell => cell.trim().length > 0)) {
          lines.push(row);
        }
        row = [];
        curVal = '';
      } else {
        curVal += c;
      }
    }
    if (curVal || row.length > 0) {
      row.push(curVal);
      if (row.some(cell => cell.trim().length > 0)) lines.push(row);
    }
    return lines;
  }

  function cleanNumVal(val) {
    if (!val) return 0;
    const cleaned = String(val).replace(/,/g, '').replace(/₹/g, '').replace(/Rs\./gi, '').trim();
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : num;
  }

  function parseLedgerRecordsFromCSV(csvText) {
    const rows = parseCSV(csvText);
    if (!rows || rows.length <= 1) return [];

    const dataRows = rows.slice(1);
    const parsed = [];

    dataRows.forEach((r, idx) => {
      if (!r || !r.some(c => c && c.trim().length > 0)) return;

      const date = (r[0] || '').trim();
      const by = (r[1] || '').trim();
      const forEnt = (r[2] || '').trim();
      const item = (r[3] || '').trim();
      const expAcc = (r[4] || '').trim();
      const cat = (r[5] || '').trim();
      const amtExp = cleanNumVal(r[6]);
      const bal = cleanNumVal(r[7]);
      const info = (r[8] || '').trim();
      const amtIn = cleanNumVal(r[9]);
      const incAcc = (r[10] || '').trim();
      const month = (r[12] || '').trim();

      if (date || item || amtExp > 0 || amtIn > 0) {
        parsed.push({
          row: idx + 2,
          date: date,
          by: by || 'Honey',
          for: forEnt || 'Home',
          item: item,
          exp_acc: expAcc || 'Hom Cash',
          cat: cat || 'misc expn',
          amt_exp: amtExp,
          bal: bal,
          info: info,
          amt_in: amtIn,
          inc_acc: incAcc,
          month: month
        });
      }
    });

    return parsed;
  }

  // ==================== LIVE SHEET DATA SYNC CONTROLLER ====================
  async function syncActiveSheetData(isManual = false) {
    const cfg = SHEETS_CONFIG[currentSheetKey] || SHEETS_CONFIG.sheet1;
    const syncIcon = document.getElementById('mobileSyncIcon');
    const statusLabel = document.getElementById('syncStatusLabel');
    const subtitle = document.getElementById('headerSyncSubtitle');
    const selector = document.getElementById('mobileSheetSelector');

    if (selector && selector.value !== currentSheetKey) {
      selector.value = currentSheetKey;
    }

    if (syncIcon) syncIcon.classList.add('spinning');
    if (statusLabel) statusLabel.textContent = 'Syncing...';

    const csvUrl = `https://docs.google.com/spreadsheets/d/${cfg.id}/export?format=csv&t=${Date.now()}`;

    try {
      const resp = await fetch(csvUrl, { cache: 'no-store' });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const csvText = await resp.text();
      const parsed = parseLedgerRecordsFromCSV(csvText);

      if (parsed && parsed.length > 0) {
        rawLedgerData = parsed;
        try {
          localStorage.setItem(`cached_ledger_${currentSheetKey}`, JSON.stringify(parsed));
          localStorage.setItem(`cached_time_${currentSheetKey}`, Date.now().toString());
        } catch(e) {}

        if (statusLabel) statusLabel.textContent = 'Live';
        if (subtitle) {
          const timeStr = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
          subtitle.textContent = `${cfg.shortName} • Synced ${timeStr}`;
        }

        processAndRenderAll();
        if (isManual) {
          showToast(`✓ Synced ${parsed.length} rows from ${cfg.shortName}`);
        }
        return;
      }
    } catch (err) {
      console.warn('Direct fetch failed, falling back to cache:', err);
      try {
        const cached = localStorage.getItem(`cached_ledger_${currentSheetKey}`);
        if (cached) {
          rawLedgerData = JSON.parse(cached);
          if (statusLabel) statusLabel.textContent = 'Cached';
          if (subtitle) subtitle.textContent = `${cfg.shortName} • Offline Cache`;
          processAndRenderAll();
          showToast(`Offline: Loaded cached data for ${cfg.shortName}`);
          return;
        }
      } catch(e) {}

      if (currentSheetKey === 'sheet1' && Array.isArray(window.LEDGER_DATA) && window.LEDGER_DATA.length > 0) {
        rawLedgerData = window.LEDGER_DATA;
        if (statusLabel) statusLabel.textContent = 'Bundled';
        processAndRenderAll();
      } else {
        if (statusLabel) statusLabel.textContent = 'Offline';
        showToast(`Sync error: ${err.message}`);
      }
    } finally {
      if (syncIcon) syncIcon.classList.remove('spinning');
    }
  }

  // ==================== TACTILE LONG-TAP EVENT BINDER ====================
  function bindTouchLongPress(el, onLongPress, onClick) {
    let pressTimer = null;
    let startX = 0, startY = 0;
    let isLongPress = false;

    el.addEventListener('touchstart', (e) => {
      isLongPress = false;
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      el.classList.add('touch-pressing');

      pressTimer = setTimeout(() => {
        isLongPress = true;
        el.classList.remove('touch-pressing');
        if (navigator.vibrate) {
          try { navigator.vibrate(50); } catch(err) {}
        }
        onLongPress(e);
      }, 480);
    }, { passive: true });

    el.addEventListener('touchmove', (e) => {
      const dx = Math.abs(e.touches[0].clientX - startX);
      const dy = Math.abs(e.touches[0].clientY - startY);
      if (dx > 12 || dy > 12) {
        clearTimeout(pressTimer);
        el.classList.remove('touch-pressing');
      }
    }, { passive: true });

    el.addEventListener('touchend', (e) => {
      clearTimeout(pressTimer);
      el.classList.remove('touch-pressing');
      if (!isLongPress && onClick) {
        onClick(e);
      }
    });

    el.addEventListener('touchcancel', () => {
      clearTimeout(pressTimer);
      el.classList.remove('touch-pressing');
    });

    // Right-click support on desktop / mouse
    el.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      onLongPress(e);
    });
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
  function populateDrawerDropdowns() {
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

    fillSelect('drawerCategorySelect', categories, state.selectedCategory, 'All Categories');
    fillSelect('drawerPersonSelect', persons, state.selectedPerson, 'All Persons');
    fillSelect('drawerForSelect', purposes, state.selectedFor, 'All Purposes');
    fillSelect('drawerExpenseAccSelect', expenseAccs, state.selectedExpenseAcc, 'All Accounts');
    fillSelect('drawerIncomeAccSelect', incomeAccs, state.selectedIncomeAcc, 'All Banks');

    const monthEl = document.getElementById('drawerMonthSelect');
    if (monthEl) monthEl.value = state.selectedMonth;

    const incomeOnlySwitch = document.getElementById('drawerIncomeOnlySwitch');
    if (incomeOnlySwitch) incomeOnlySwitch.checked = state.onlyIncome;
  }

  // ==================== 4. FILTERING & SORTING ENGINE ====================
  function getFilteredAndSortedTransactions() {
    let list = normalizedData.filter(item => {
      // Month
      if (state.selectedMonth !== 'All' && item.month !== state.selectedMonth) return false;
      // Category
      if (state.selectedCategory !== 'All' && item.category !== state.selectedCategory) return false;
      // Person (By)
      if (state.selectedPerson !== 'All' && item.by !== state.selectedPerson) return false;
      // Purpose (For)
      if (state.selectedFor !== 'All' && item.forEntity !== state.selectedFor) return false;
      // Expense Account
      if (state.selectedExpenseAcc !== 'All' && item.expenseAcc !== state.selectedExpenseAcc) return false;
      // Income Account
      if (state.selectedIncomeAcc !== 'All' && state.selectedIncomeAcc !== 'All Banks' && item.incomeAccnt !== state.selectedIncomeAcc) return false;
      // Only Income Results (Cell J8)
      if (state.onlyIncome && item.amtInCredit <= 0) return false;

      // Search Query
      if (state.searchKeyword) {
        const query = state.searchKeyword.toLowerCase().trim();
        const itemText = (item.item || '').toLowerCase();
        const infoText = (item.info || '').toLowerCase();
        const catText = (item.category || '').toLowerCase();

        if (state.searchMode === 'exact') {
          if (itemText !== query && infoText !== query && catText !== query) return false;
        } else {
          if (!itemText.includes(query) && !infoText.includes(query) && !catText.includes(query)) return false;
        }
      }

      return true;
    });

    // Sorting
    list.sort((a, b) => {
      switch (state.sortOrder) {
        case 'date_desc': return b.dateObj.getTime() - a.dateObj.getTime();
        case 'date_asc': return a.dateObj.getTime() - b.dateObj.getTime();
        case 'exp_desc': return b.amountXpns - a.amountXpns;
        case 'inc_desc': return b.amtInCredit - a.amtInCredit;
        case 'bal_desc': return b.balance - a.balance;
        case 'item_asc': return (a.item || '').localeCompare(b.item || '');
        case 'cat_asc': return (a.category || '').localeCompare(b.category || '');
        default: return b.dateObj.getTime() - a.dateObj.getTime();
      }
    });

    return list;
  }

  // Count Active Non-default Filters
  function countActiveFilters() {
    let count = 0;
    if (state.selectedMonth !== 'All') count++;
    if (state.selectedCategory !== 'All') count++;
    if (state.selectedPerson !== 'All') count++;
    if (state.selectedFor !== 'All') count++;
    if (state.selectedExpenseAcc !== 'All') count++;
    if (state.selectedIncomeAcc !== 'All' && state.selectedIncomeAcc !== 'All Banks') count++;
    if (state.onlyIncome) count++;
    if (state.searchKeyword) count++;
    return count;
  }

  // ==================== 5. RENDER TAB 1: OVERVIEW & KPIS ====================
  function renderOverviewTab(filteredData) {
    let totalExp = 0;
    let totalInc = 0;

    filteredData.forEach(t => {
      totalExp += t.amountXpns;
      totalInc += t.amtInCredit;
    });

    const netBalance = totalInc - totalExp;

    // Closing Balance
    let closingBalance = 0;
    for (let i = normalizedData.length - 1; i >= 0; i--) {
      if (normalizedData[i].balance !== 0) {
        closingBalance = normalizedData[i].balance;
        break;
      }
    }
    if (closingBalance === 0 && normalizedData.length > 0) {
      closingBalance = normalizedData[normalizedData.length - 1].balance;
    }

    // Elements
    const elExp = document.getElementById('kpiTotalExpense');
    const elInc = document.getElementById('kpiTotalIncome');
    const elNet = document.getElementById('kpiNetBalance');
    const elBal = document.getElementById('kpiClosingBalance');

    if (elExp) elExp.textContent = formatINR(totalExp);
    if (elInc) elInc.textContent = formatINR(totalInc);
    if (elBal) elBal.textContent = formatINR(closingBalance);

    if (elNet) {
      elNet.textContent = (netBalance < 0 ? '-' : '') + formatINR(Math.abs(netBalance));
      elNet.className = netBalance < 0 ? 'kpi-card-value font-mono text-rose-400' : 'kpi-card-value font-mono text-cyan-300';
    }

    // Cash Flow Ratio
    const totalVolume = totalExp + totalInc;
    const incPct = totalVolume > 0 ? Math.round((totalInc / totalVolume) * 100) : 50;
    const expPct = 100 - incPct;

    const fillInc = document.getElementById('ratioFillIncome');
    const fillExp = document.getElementById('ratioFillExpense');
    const ratioBadge = document.getElementById('cashFlowRatioBadge');
    const ratioIncText = document.getElementById('ratioIncText');
    const ratioExpText = document.getElementById('ratioExpText');

    if (fillInc) fillInc.style.width = `${incPct}%`;
    if (fillExp) fillExp.style.width = `${expPct}%`;
    if (ratioBadge) ratioBadge.textContent = `${incPct}% Inflow • ${expPct}% Outflow`;
    if (ratioIncText) ratioIncText.textContent = formatINR(totalInc);
    if (ratioExpText) ratioExpText.textContent = formatINR(totalExp);

    // Top 5 Spending Categories Mini-List
    const catMap = {};
    filteredData.forEach(t => {
      if (t.amountXpns > 0) {
        const c = t.category || 'misc expn';
        catMap[c] = (catMap[c] || 0) + t.amountXpns;
      }
    });

    const sortedCats = Object.keys(catMap).map(c => ({
      name: c,
      amount: catMap[c]
    })).sort((a, b) => b.amount - a.amount);

    const miniListEl = document.getElementById('topCategoriesMiniList');
    if (miniListEl) {
      if (sortedCats.length === 0) {
        miniListEl.innerHTML = '<div class="text-xs text-slate-500 py-2 text-center">No expenses in selection</div>';
      } else {
        const top5 = sortedCats.slice(0, 5);
        const maxVal = top5[0].amount || 1;
        miniListEl.innerHTML = top5.map((c, idx) => {
          const width = Math.min(100, Math.round((c.amount / maxVal) * 100));
          const pctOfTotal = totalExp > 0 ? ((c.amount / totalExp) * 100).toFixed(1) : '0';
          const color = CATEGORY_COLORS[idx % CATEGORY_COLORS.length];
          return `
            <div class="cat-progress-item">
              <div class="cat-progress-labels">
                <span class="cat-progress-name">#${idx + 1} ${escapeHTML(c.name)}</span>
                <span class="cat-progress-val font-mono">${formatINR(c.amount)} (${pctOfTotal}%)</span>
              </div>
              <div class="cat-progress-track">
                <div class="cat-progress-fill" style="width: ${width}%; background-color: ${color}"></div>
              </div>
            </div>
          `;
        }).join('');
      }
    }

    // Top Accounts Distribution
    const accMap = {};
    filteredData.forEach(t => {
      if (t.amountXpns > 0) {
        const a = t.expenseAcc || 'Hom Cash';
        accMap[a] = (accMap[a] || 0) + t.amountXpns;
      }
    });

    const sortedAccs = Object.keys(accMap).map(a => ({
      name: a,
      amount: accMap[a]
    })).sort((a, b) => b.amount - a.amount);

    const accMiniList = document.getElementById('accountProgressMiniList');
    if (accMiniList) {
      if (sortedAccs.length === 0) {
        accMiniList.innerHTML = '<div class="text-xs text-slate-500 py-2 text-center">No account debits</div>';
      } else {
        accMiniList.innerHTML = sortedAccs.map(a => {
          const pct = totalExp > 0 ? ((a.amount / totalExp) * 100).toFixed(1) : '0';
          const color = ACCOUNT_COLORS[a.name] || '#3b82f6';
          return `
            <div class="cat-progress-item">
              <div class="cat-progress-labels">
                <span class="cat-progress-name">${escapeHTML(a.name)}</span>
                <span class="cat-progress-val font-mono">${formatINR(a.amount)} (${pct}%)</span>
              </div>
              <div class="cat-progress-track">
                <div class="cat-progress-fill" style="width: ${pct}%; background-color: ${color}"></div>
              </div>
            </div>
          `;
        }).join('');
      }
    }

    // Update Filter Summary Banner
    const bannerText = document.getElementById('overviewFilterSummary');
    const bannerReset = document.getElementById('bannerResetBtn');
    const activeCount = countActiveFilters();

    if (bannerText) {
      if (activeCount === 0) {
        bannerText.textContent = `All ${normalizedData.length} Transactions`;
        if (bannerReset) bannerReset.classList.add('hidden');
      } else {
        const parts = [];
        if (state.selectedMonth !== 'All') parts.push(`Month: ${state.selectedMonth}`);
        if (state.selectedCategory !== 'All') parts.push(`Cat: ${state.selectedCategory}`);
        if (state.selectedPerson !== 'All') parts.push(`By: ${state.selectedPerson}`);
        if (state.onlyIncome) parts.push('💚 Income Only');
        if (state.searchKeyword) parts.push(`"${state.searchKeyword}"`);
        bannerText.textContent = `${filteredData.length} records (${parts.join(' • ')})`;
        if (bannerReset) bannerReset.classList.remove('hidden');
      }
    }
  }

  // ==================== 6. RENDER TAB 2: 🍩 VISUAL CHARTS & MATRICES ====================
  function renderMobileDonut(svgId, centerNumId, centerNameId, legendId, items, totalAmount, onSelectCallback) {
    const svgEl = document.getElementById(svgId);
    const numEl = document.getElementById(centerNumId);
    const nameEl = document.getElementById(centerNameId);
    const legendEl = document.getElementById(legendId);

    if (!svgEl || !numEl || !legendEl) return;

    if (totalAmount <= 0 || items.length === 0) {
      svgEl.innerHTML = `<circle cx="100" cy="100" r="72" fill="none" stroke="#1e293b" stroke-width="24" />`;
      numEl.textContent = '₹0';
      if (nameEl) nameEl.textContent = 'No Spend';
      legendEl.innerHTML = '<div class="text-xs text-slate-500 py-3 text-center">No transactions found</div>';
      return;
    }

    numEl.textContent = formatINR(totalAmount);
    if (nameEl) nameEl.textContent = `${items.length} items`;

    const radius = 72;
    const circumference = 2 * Math.PI * radius;
    let offset = 0;
    let paths = '';
    let legendHtml = '';

    if (items.length === 1) {
      const item = items[0];
      const color = item.color || '#10b981';
      paths = `
        <circle 
          cx="100" cy="100" r="${radius}" 
          fill="none" 
          stroke="${color}" 
          stroke-width="24" 
          class="mobile-donut-slice"
          data-name="${escapeHTML(item.name)}"
          data-amount="${item.amount}"
          data-pct="100.0"
        />
      `;
      legendHtml = `
        <div class="mobile-legend-row" data-name="${escapeHTML(item.name)}">
          <div class="legend-col-left">
            <span class="legend-dot-color" style="background-color: ${color}"></span>
            <span class="legend-item-name" title="${escapeHTML(item.name)}">${escapeHTML(item.name)}</span>
          </div>
          <div class="legend-col-right">
            <span class="legend-item-amt font-mono">${formatINR(item.amount)}</span>
            <span class="legend-item-pct font-mono">100.0%</span>
          </div>
        </div>
      `;
    } else {
      items.forEach((item, idx) => {
        const pct = (item.amount / totalAmount) * 100;
        const strokeDasharray = `${(pct / 100) * circumference} ${circumference}`;
        const strokeDashoffset = -offset;
        const color = item.color || CATEGORY_COLORS[idx % CATEGORY_COLORS.length];

        paths += `
          <circle 
            cx="100" cy="100" r="${radius}" 
            fill="none" 
            stroke="${color}" 
            stroke-width="24" 
            stroke-dasharray="${strokeDasharray}" 
            stroke-dashoffset="${strokeDashoffset}"
            class="mobile-donut-slice"
            data-name="${escapeHTML(item.name)}"
            data-amount="${item.amount}"
            data-pct="${pct.toFixed(1)}"
          />
        `;

        offset += (pct / 100) * circumference;

        legendHtml += `
          <div class="mobile-legend-row" data-name="${escapeHTML(item.name)}">
            <div class="legend-col-left">
              <span class="legend-dot-color" style="background-color: ${color}"></span>
              <span class="legend-item-name" title="${escapeHTML(item.name)}">${escapeHTML(item.name)}</span>
            </div>
            <div class="legend-col-right">
              <span class="legend-item-amt font-mono">${formatINR(item.amount)}</span>
              <span class="legend-item-pct font-mono">${pct.toFixed(1)}%</span>
            </div>
          </div>
        `;
      });
    }

    svgEl.innerHTML = paths;
    legendEl.innerHTML = legendHtml;

    // Attach Interactive Touch Events
    const slices = svgEl.querySelectorAll('.mobile-donut-slice');
    slices.forEach(slice => {
      slice.addEventListener('click', () => {
        const name = slice.getAttribute('data-name');
        const amt = parseFloat(slice.getAttribute('data-amount')) || 0;
        const pct = slice.getAttribute('data-pct');
        numEl.textContent = formatINR(amt);
        if (nameEl) nameEl.textContent = `${name} (${pct}%)`;
        if (typeof onSelectCallback === 'function') onSelectCallback(name);
      });
    });

    const legendRows = legendEl.querySelectorAll('.mobile-legend-row');
    legendRows.forEach(row => {
      row.addEventListener('click', () => {
        const name = row.getAttribute('data-name');
        if (typeof onSelectCallback === 'function') onSelectCallback(name);
      });
    });
  }

  function renderChartsTab(filteredData) {
    let totalExpense = 0;
    let totalIncome = 0;
    const catMap = {};
    const accMap = {};

    filteredData.forEach(t => {
      totalExpense += (t.amountXpns || 0);
      totalIncome += (t.amtInCredit || 0);
    });

    const isIncomeMode = state.onlyIncome || (totalExpense === 0 && totalIncome > 0);
    const totalAmount = isIncomeMode ? totalIncome : totalExpense;

    filteredData.forEach(t => {
      const amt = isIncomeMode ? (t.amtInCredit || 0) : (t.amountXpns || 0);
      if (amt > 0) {
        const c = t.category || (isIncomeMode ? 'Income' : 'misc expn');
        const a = (isIncomeMode ? (t.incomeAccnt || t.expenseAcc) : t.expenseAcc) || 'Hom Cash';
        catMap[c] = (catMap[c] || 0) + amt;
        accMap[a] = (accMap[a] || 0) + amt;
      }
    });

    // Update Titles and Headers dynamically for Income vs Expense mode
    const catCardTitle = document.getElementById('mobileCatDonutCardTitle');
    const catCenterType = document.getElementById('mobileCatDonutCenterType');
    const accCardTitle = document.getElementById('mobileAccDonutCardTitle');
    const accCenterType = document.getElementById('mobileAccDonutCenterType');

    const catMatrixTitle = document.getElementById('mobileCatMatrixTitle');
    const catMatrixThAmt = document.getElementById('mobileCatMatrixThAmount');
    const accMatrixTitle = document.getElementById('mobileAccMatrixTitle');
    const accMatrixThCol = document.getElementById('mobileAccMatrixThCol');
    const accMatrixThAmt = document.getElementById('mobileAccMatrixThAmount');

    if (isIncomeMode) {
      if (catCardTitle) catCardTitle.textContent = 'Income by Category';
      if (catCenterType) catCenterType.textContent = 'Income';
      if (accCardTitle) accCardTitle.textContent = 'Income by Bank / Account';
      if (accCenterType) accCenterType.textContent = 'Bank';

      if (catMatrixTitle) catMatrixTitle.textContent = 'Income Matrix (Category)';
      if (catMatrixThAmt) catMatrixThAmt.textContent = 'Total Inflow';
      if (accMatrixTitle) accMatrixTitle.textContent = 'Bank / Income Account Matrix';
      if (accMatrixThCol) accMatrixThCol.textContent = 'Bank / Account';
      if (accMatrixThAmt) accMatrixThAmt.textContent = 'Total Inflow';
    } else {
      if (catCardTitle) catCardTitle.textContent = 'Expenses by Category';
      if (catCenterType) catCenterType.textContent = 'Expense';
      if (accCardTitle) accCardTitle.textContent = 'Expenses by Account';
      if (accCenterType) accCenterType.textContent = 'Account';

      if (catMatrixTitle) catMatrixTitle.textContent = 'Category Matrix (S10:T)';
      if (catMatrixThAmt) catMatrixThAmt.textContent = 'Total Expense';
      if (accMatrixTitle) accMatrixTitle.textContent = 'Expense Account Matrix (U10:V)';
      if (accMatrixThCol) accMatrixThCol.textContent = 'Account';
      if (accMatrixThAmt) accMatrixThAmt.textContent = 'Total Expense';
    }

    // 1. Donut 1: Category
    const sortedCats = Object.keys(catMap).map((c, i) => ({
      name: c,
      amount: catMap[c],
      color: isIncomeMode ? ['#10b981', '#06b6d4', '#8b5cf6', '#3b82f6', '#f59e0b', '#ec4899'][i % 6] : CATEGORY_COLORS[i % CATEGORY_COLORS.length]
    })).sort((a, b) => b.amount - a.amount);

    renderMobileDonut(
      'mobileCategoryDonutSvg',
      'mobileCatDonutAmount',
      'mobileCatDonutLabel',
      'mobileCategoryLegend',
      sortedCats,
      totalAmount,
      (catName) => {
        window.selectCategoryFilter(catName);
      }
    );

    // 2. Donut 2: Account (Curated Bank Colors for Income Mode)
    const BANK_COLORS = {
      'Cash Earning I': '#10b981',
      'CO Bank': '#06b6d4',
      'Trishaa Savng GPay': '#8b5cf6',
      'SBI Vil': '#f59e0b',
      'PNB Online': '#3b82f6',
      'Hom Cash': '#ec4899'
    };

    let accColorIdx = 0;
    const sortedAccs = Object.keys(accMap).map(a => ({
      name: a,
      amount: accMap[a],
      color: BANK_COLORS[a] || ACCOUNT_COLORS[a] || DEFAULT_ACC_COLORS[(accColorIdx++) % DEFAULT_ACC_COLORS.length]
    })).sort((a, b) => b.amount - a.amount);

    renderMobileDonut(
      'mobileAccountDonutSvg',
      'mobileAccDonutAmount',
      'mobileAccDonutLabel',
      'mobileAccountLegend',
      sortedAccs,
      totalAmount,
      (accName) => {
        if (isIncomeMode) {
          window.selectIncomeAccountFilter(accName);
        } else {
          window.selectAccountFilter(accName);
        }
      }
    );

    // 3. Category Matrix Table
    const catBadge = document.getElementById('catMatrixCountBadge');
    if (catBadge) catBadge.textContent = `${sortedCats.length} categories`;

    const catTbody = document.getElementById('mobileCategoryMatrixTbody');
    if (catTbody) {
      if (sortedCats.length === 0) {
        catTbody.innerHTML = `<tr><td colspan="3" class="text-center text-slate-500 py-3">${isIncomeMode ? 'No income items' : 'No expenses'}</td></tr>`;
      } else {
        catTbody.innerHTML = sortedCats.map(c => {
          const pct = totalAmount > 0 ? ((c.amount / totalAmount) * 100).toFixed(1) : '0.0';
          return `
            <tr style="cursor: pointer" onclick="window.selectCategoryFilter('${escapeHTML(c.name)}')">
              <td><strong>${escapeHTML(c.name)}</strong></td>
              <td class="text-right font-mono">${formatINR(c.amount)}</td>
              <td class="text-right text-slate-400 font-mono">${pct}%</td>
            </tr>
          `;
        }).join('');
      }
    }

    // 4. Account Matrix Table
    const accTbody = document.getElementById('mobileAccountMatrixTbody');
    if (accTbody) {
      if (sortedAccs.length === 0) {
        accTbody.innerHTML = `<tr><td colspan="3" class="text-center text-slate-500 py-3">${isIncomeMode ? 'No income accounts' : 'No expenses'}</td></tr>`;
      } else {
        accTbody.innerHTML = sortedAccs.map(a => {
          const pct = totalAmount > 0 ? ((a.amount / totalAmount) * 100).toFixed(1) : '0.0';
          const clickFn = isIncomeMode ? `window.selectIncomeAccountFilter('${escapeHTML(a.name)}')` : `window.selectAccountFilter('${escapeHTML(a.name)}')`;
          return `
            <tr style="cursor: pointer" onclick="${clickFn}">
              <td><strong>${escapeHTML(a.name)}</strong></td>
              <td class="text-right font-mono">${formatINR(a.amount)}</td>
              <td class="text-right text-slate-400 font-mono">${pct}%</td>
            </tr>
          `;
        }).join('');
      }
    }

    // 5. Monthly Cash Flow Dual Progress Bars
    const monthlyMap = {};
    const monthsOrder = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    normalizedData.forEach(t => {
      const m = t.month;
      if (!monthlyMap[m]) monthlyMap[m] = { exp: 0, inc: 0 };
      monthlyMap[m].exp += t.amountXpns;
      monthlyMap[m].inc += t.amtInCredit;
    });

    let maxVal = 1;
    Object.keys(monthlyMap).forEach(m => {
      if (monthlyMap[m].exp > maxVal) maxVal = monthlyMap[m].exp;
      if (monthlyMap[m].inc > maxVal) maxVal = monthlyMap[m].inc;
    });

    const barsContainer = document.getElementById('mobileMonthlyBarsContainer');
    if (barsContainer) {
      const activeMonths = monthsOrder.filter(m => monthlyMap[m]);
      barsContainer.innerHTML = activeMonths.map(m => {
        const exp = monthlyMap[m].exp;
        const inc = monthlyMap[m].inc;
        const expWidth = Math.min(100, Math.round((exp / maxVal) * 100));
        const incWidth = Math.min(100, Math.round((inc / maxVal) * 100));
        return `
          <div class="monthly-bar-unit">
            <div class="unit-top-labels">
              <span class="unit-month-name"><strong>${m}</strong></span>
              <div class="unit-amounts">
                <span class="unit-inc font-mono">+${formatINR(inc)}</span>
                <span class="unit-exp font-mono">-${formatINR(exp)}</span>
              </div>
            </div>
            <div class="ratio-bar-track">
              <div class="ratio-fill-income" style="width: ${incWidth}%" title="Income: ${formatINR(inc)}"></div>
            </div>
            <div class="ratio-bar-track" style="margin-top: 2px;">
              <div class="ratio-fill-expense" style="width: ${expWidth}%" title="Expense: ${formatINR(exp)}"></div>
            </div>
          </div>
        `;
      }).join('');
    }
  }

  // ==================== 7. RENDER TAB 3: 📋 TRANSACTIONS LEDGER ====================
  function getCategoryBadgeStyle(cat) {
    const c = (cat || '').toLowerCase();
    if (c.includes('food') || c.includes('sabji')) return 'background-color: rgba(16, 185, 129, 0.2); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.4);';
    if (c.includes('rashan')) return 'background-color: rgba(59, 130, 246, 0.2); color: #93c5fd; border: 1px solid rgba(59, 130, 246, 0.4);';
    if (c.includes('fuel')) return 'background-color: rgba(245, 158, 11, 0.2); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.4);';
    if (c.includes('stay') || c.includes('rent')) return 'background-color: rgba(168, 85, 247, 0.2); color: #d8b4fe; border: 1px solid rgba(168, 85, 247, 0.4);';
    if (c.includes('budget')) return 'background-color: rgba(6, 182, 212, 0.2); color: #67e8f9; border: 1px solid rgba(6, 182, 212, 0.4);';
    return 'background-color: rgba(51, 65, 85, 0.5); color: #cbd5e1; border: 1px solid rgba(51, 65, 85, 0.6);';
  }

  function renderLedgerTab(filteredData) {
    const streamEl = document.getElementById('transactionsCardsStream');
    const tbodyEl = document.getElementById('mobileDenseTbody');
    const countPill = document.getElementById('ledgerCountPill');
    const pageText = document.getElementById('ledgerPageCountText');
    const navBadge = document.getElementById('navRecordBadge');

    const total = filteredData.length;
    if (countPill) countPill.textContent = `${total} records`;
    if (navBadge) navBadge.textContent = total;

    const visibleRows = filteredData.slice(0, state.visibleLimit);
    if (pageText) pageText.textContent = `Showing ${visibleRows.length} of ${total} records`;

    if (visibleRows.length === 0) {
      const emptyHtml = `
        <div class="text-center py-10 text-slate-400">
          <div style="font-size: 2rem; margin-bottom: 0.5rem">🔍</div>
          <strong>No transactions match filter criteria</strong><br>
          <span class="text-xs text-slate-500">Tap "Reset All" in Filters to show all transactions</span>
        </div>
      `;
      if (streamEl) streamEl.innerHTML = emptyHtml;
      if (tbodyEl) tbodyEl.innerHTML = '<tr><td colspan="10" class="text-center py-6 text-slate-500">No records</td></tr>';
      return;
    }

    // 1. Render Mobile Cards Stream
    let cardsHtml = '';
    let tableHtml = '';

    visibleRows.forEach((item, index) => {
      const isExp = item.amountXpns > 0;
      const isInc = item.amtInCredit > 0;
      const amtStr = isExp ? `-${formatINR(item.amountXpns)}` : (isInc ? `+${formatINR(item.amtInCredit)}` : '₹0');
      const amtClass = isExp ? 'expense' : (isInc ? 'income' : '');
      const badgeStyle = getCategoryBadgeStyle(item.category);

      cardsHtml += `
        <div class="tx-card" data-tx-index="${index}">
          <div class="tx-card-row-main">
            <div class="tx-main-left">
              <span class="tx-date">${escapeHTML(item.date)}</span>
              <span class="tx-dot-sep">•</span>
              <span class="tx-item-title">${escapeHTML(item.item || 'Transaction')}</span>
            </div>
            <span class="tx-amount ${amtClass}">${amtStr}</span>
          </div>
          <div class="tx-card-row-sub">
            <div class="tx-sub-left">
              <span class="tx-cat-badge font-mono" style="${badgeStyle}">${escapeHTML(item.category)}</span>
              <span class="tx-pill-acc">${escapeHTML(item.incomeAccnt || item.expenseAcc || '-')}</span>
              <span class="tx-pill-by">${escapeHTML(item.by)}</span>
            </div>
            <div class="tx-sub-right">
              ${item.balance !== 0 ? `<span class="tx-balance-num">Bal: ${formatINR(item.balance)}</span>` : ''}
            </div>
          </div>
        </div>
      `;

      tableHtml += `
        <tr>
          <td>${escapeHTML(item.date)}</td>
          <td>${escapeHTML(item.by)}</td>
          <td>${escapeHTML(item.forEntity)}</td>
          <td><strong>${escapeHTML(item.item)}</strong></td>
          <td>${escapeHTML(item.category)}</td>
          <td class="text-right text-rose-400 font-mono">${isExp ? formatINR(item.amountXpns) : '-'}</td>
          <td class="text-slate-400">${escapeHTML(item.info || '-')}</td>
          <td class="text-right text-emerald-400 font-mono">${isInc ? formatINR(item.amtInCredit) : '-'}</td>
          <td>${escapeHTML(item.incomeAccnt || item.expenseAcc)}</td>
          <td class="text-right font-mono">${item.balance !== 0 ? formatINR(item.balance) : '-'}</td>
        </tr>
      `;
    });

    if (streamEl) {
      streamEl.innerHTML = cardsHtml;
      // Attach tactile long-press for editing & single tap for details
      streamEl.querySelectorAll('.tx-card').forEach(c => {
        const idx = parseInt(c.getAttribute('data-tx-index'), 10);
        if (visibleRows[idx]) {
          bindTouchLongPress(
            c,
            () => openEditTransactionModal(visibleRows[idx], 'edit'),
            () => openTransactionModal(visibleRows[idx])
          );
        }
      });
    }

    if (tbodyEl) {
      tbodyEl.innerHTML = tableHtml;
      tbodyEl.querySelectorAll('tr').forEach((tr, idx) => {
        if (visibleRows[idx]) {
          bindTouchLongPress(
            tr,
            () => openEditTransactionModal(visibleRows[idx], 'edit'),
            () => openTransactionModal(visibleRows[idx])
          );
        }
      });
    }
  }


  // ==================== IN-PLACE TRANSACTION EDIT & ADD CONTROLLER ====================
  let currentEditMode = 'edit'; // 'edit' or 'new'
  let currentEditItem = null;

  function openEditTransactionModal(item, mode = 'edit') {
    currentEditMode = mode;
    currentEditItem = item;

    const modal = document.getElementById('editTransactionModalBackdrop');
    const headerTitle = document.getElementById('editModalHeaderTitle');
    const rowBadge = document.getElementById('editModalRowBadge');
    const cfg = SHEETS_CONFIG[currentSheetKey] || SHEETS_CONFIG.sheet1;

    // Close detail modal if open
    const detailModal = document.getElementById('transactionModalBackdrop');
    if (detailModal) detailModal.classList.add('hidden');

    if (!modal) return;

    // Populate Category Datalist
    const catList = document.getElementById('catDatalist');
    if (catList) {
      const uniqueCats = Array.from(new Set(normalizedData.map(d => d.category).filter(Boolean))).sort();
      catList.innerHTML = uniqueCats.map(c => `<option value="${escapeHTML(c)}"></option>`).join('');
    }

    const rowIndexInput = document.getElementById('editTxRowIndex');
    const sheetRowInput = document.getElementById('editTxSheetRow');
    const dateInput = document.getElementById('editTxDate');
    const byInput = document.getElementById('editTxBy');
    const forInput = document.getElementById('editTxFor');
    const catInput = document.getElementById('editTxCat');
    const itemInput = document.getElementById('editTxItem');
    const amtExpInput = document.getElementById('editTxAmtExp');
    const expAccInput = document.getElementById('editTxExpAcc');
    const amtInInput = document.getElementById('editTxAmtIn');
    const incAccInput = document.getElementById('editTxIncAcc');
    const infoInput = document.getElementById('editTxInfo');
    const pillExp = document.getElementById('typePillExpense');
    const pillInc = document.getElementById('typePillIncome');
    const boxExp = document.getElementById('editGroupExpense');
    const boxInc = document.getElementById('editGroupIncome');

    if (mode === 'edit' && item) {
      if (headerTitle) headerTitle.textContent = `✏️ Edit Transaction`;
      if (rowBadge) rowBadge.textContent = `${cfg.shortName} • Sheet Row #${item.row}`;
      if (rowIndexInput) rowIndexInput.value = item.rawIndex !== undefined ? item.rawIndex : '';
      if (sheetRowInput) sheetRowInput.value = item.row || '';
      if (dateInput) dateInput.value = item.date || '';
      if (byInput) byInput.value = item.by || 'Honey';
      if (forInput) forInput.value = item.forEntity || 'Home';
      if (catInput) catInput.value = item.category || 'misc expn';
      if (itemInput) itemInput.value = item.item || '';
      if (amtExpInput) amtExpInput.value = item.amountXpns > 0 ? item.amountXpns : '';
      if (expAccInput) expAccInput.value = item.expenseAcc || 'Hom Cash';
      if (amtInInput) amtInInput.value = item.amtInCredit > 0 ? item.amtInCredit : '';
      if (incAccInput) incAccInput.value = item.incomeAccnt || '';
      if (infoInput) infoInput.value = item.info || '';

      const isIncome = item.amtInCredit > 0 && item.amountXpns === 0;
      setEditTxType(isIncome ? 'income' : 'expense');
    } else {
      // New Transaction mode
      const today = new Date();
      const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      const todayStr = `${today.getDate()}-${monthNames[today.getMonth()]}-${today.getFullYear()}`;

      if (headerTitle) headerTitle.textContent = `➕ Add New Transaction`;
      if (rowBadge) rowBadge.textContent = `${cfg.shortName} • Appending New Row`;
      if (rowIndexInput) rowIndexInput.value = '';
      if (sheetRowInput) sheetRowInput.value = (rawLedgerData.length + 2);
      if (dateInput) dateInput.value = todayStr;
      if (byInput) byInput.value = 'Honey';
      if (forInput) forInput.value = 'Home';
      if (catInput) catInput.value = '';
      if (itemInput) itemInput.value = '';
      if (amtExpInput) amtExpInput.value = '';
      if (expAccInput) expAccInput.value = 'Hom Cash';
      if (amtInInput) amtInInput.value = '';
      if (incAccInput) incAccInput.value = '';
      if (infoInput) infoInput.value = '';

      setEditTxType('expense');
    }

    modal.classList.remove('hidden');
  }

  function setEditTxType(type) {
    const pillExp = document.getElementById('typePillExpense');
    const pillInc = document.getElementById('typePillIncome');
    const boxExp = document.getElementById('editGroupExpense');
    const boxInc = document.getElementById('editGroupIncome');

    if (type === 'income') {
      if (pillInc) pillInc.className = 'type-pill-btn active-income';
      if (pillExp) pillExp.className = 'type-pill-btn';
      if (boxInc) boxInc.classList.remove('hidden');
      if (boxExp) boxExp.classList.add('hidden');
    } else {
      if (pillExp) pillExp.className = 'type-pill-btn active-expense';
      if (pillInc) pillInc.className = 'type-pill-btn';
      if (boxExp) boxExp.classList.remove('hidden');
      if (boxInc) boxInc.classList.add('hidden');
    }
  }

  function saveTransactionFromForm() {
    const modal = document.getElementById('editTransactionModalBackdrop');
    const rowIndexVal = document.getElementById('editTxRowIndex').value;
    const sheetRowVal = parseInt(document.getElementById('editTxSheetRow').value, 10) || (rawLedgerData.length + 2);
    const dateVal = (document.getElementById('editTxDate').value || '').trim();
    const byVal = (document.getElementById('editTxBy').value || 'Honey').trim();
    const forVal = (document.getElementById('editTxFor').value || 'Home').trim();
    const catVal = (document.getElementById('editTxCat').value || 'misc expn').trim();
    const itemVal = (document.getElementById('editTxItem').value || '').trim();
    const amtExpVal = parseFloat(document.getElementById('editTxAmtExp').value) || 0;
    const expAccVal = (document.getElementById('editTxExpAcc').value || 'Hom Cash').trim();
    const amtInVal = parseFloat(document.getElementById('editTxAmtIn').value) || 0;
    const incAccVal = (document.getElementById('editTxIncAcc').value || '').trim();
    const infoVal = (document.getElementById('editTxInfo').value || '').trim();

    if (!itemVal && amtExpVal === 0 && amtInVal === 0) {
      showToast('Please provide an item description or amount');
      return;
    }

    const cfg = SHEETS_CONFIG[currentSheetKey] || SHEETS_CONFIG.sheet1;

    const recordData = {
      row: sheetRowVal,
      date: dateVal,
      by: byVal,
      for: forVal,
      item: itemVal,
      exp_acc: expAccVal,
      cat: catVal,
      amt_exp: amtExpVal,
      bal: 0,
      info: infoVal,
      amt_in: amtInVal,
      inc_acc: incAccVal,
      month: ''
    };

    if (currentEditMode === 'edit' && rowIndexVal !== '') {
      const idx = parseInt(rowIndexVal, 10);
      if (rawLedgerData[idx]) {
        rawLedgerData[idx] = Object.assign({}, rawLedgerData[idx], recordData);
      }
    } else {
      // Append new record
      rawLedgerData.push(recordData);
    }

    // Persist to local cache
    try {
      localStorage.setItem(`cached_ledger_${currentSheetKey}`, JSON.stringify(rawLedgerData));
      localStorage.setItem(`cached_time_${currentSheetKey}`, Date.now().toString());
    } catch(e) {}

    // Immediate reactive re-render
    processAndRenderAll();

    if (modal) modal.classList.add('hidden');
    showToast(`✓ Row #${sheetRowVal} saved to ${cfg.shortName}`);

    // If Google Apps Script Web App URL is configured, push to Google Sheet live
    const gasUrl = localStorage.getItem('gas_webapp_url');
    if (gasUrl) {
      fetch(gasUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: currentEditMode === 'edit' ? 'edit_transaction' : 'add_transaction',
          sheetId: cfg.id,
          sheetName: 'LEDGER',
          row: sheetRowVal,
          data: recordData
        })
      }).catch(err => console.warn('GAS push notification:', err));
    }
  }

  // Transaction Detail Modal
  function openTransactionModal(t) {
    activeDetailTx = t;
    const modal = document.getElementById('transactionModalBackdrop');
    const title = document.getElementById('modalItemTitle');
    const content = document.getElementById('modalSheetContent');

    if (!modal || !content) return;
    if (title) title.textContent = t.item || 'Transaction Detail';

    content.innerHTML = `
      <div class="sheet-detail-row">
        <span class="detail-label">Date:</span>
        <span class="detail-value font-mono">${escapeHTML(t.date)}</span>
      </div>
      <div class="sheet-detail-row">
        <span class="detail-label">By (Person):</span>
        <span class="detail-value">${escapeHTML(t.by)}</span>
      </div>
      <div class="sheet-detail-row">
        <span class="detail-label">For (Purpose):</span>
        <span class="detail-value">${escapeHTML(t.forEntity)}</span>
      </div>
      <div class="sheet-detail-row">
        <span class="detail-label">Category:</span>
        <span class="detail-value">${escapeHTML(t.category)}</span>
      </div>
      <div class="sheet-detail-row">
        <span class="detail-label">Expense Amount:</span>
        <span class="detail-value font-mono text-rose-400">${t.amountXpns > 0 ? formatINR(t.amountXpns) : '₹0'}</span>
      </div>
      <div class="sheet-detail-row">
        <span class="detail-label">Credit / Income:</span>
        <span class="detail-value font-mono text-emerald-400">${t.amtInCredit > 0 ? formatINR(t.amtInCredit) : '₹0'}</span>
      </div>
      <div class="sheet-detail-row">
        <span class="detail-label">Expense Account:</span>
        <span class="detail-value">${escapeHTML(t.expenseAcc)}</span>
      </div>
      <div class="sheet-detail-row">
        <span class="detail-label">Income Account:</span>
        <span class="detail-value">${escapeHTML(t.incomeAccnt || '-')}</span>
      </div>
      <div class="sheet-detail-row">
        <span class="detail-label">Running Balance:</span>
        <span class="detail-value font-mono">${t.balance !== 0 ? formatINR(t.balance) : '-'}</span>
      </div>
      <div class="sheet-detail-row" style="border: none;">
        <span class="detail-label">Notes / Remarks:</span>
        <span class="detail-value" style="font-weight: 500">${escapeHTML(t.info || 'None')}</span>
      </div>
    `;

    modal.classList.remove('hidden');
  }


  // Render Inline Transaction Grid List Under Donut Card (Supports Cards & Table Views + Sort Sync)
  function renderDonutInlineTxList(containerId, countBadgeId, titleId, listTitle, transactions) {
    const panel = document.getElementById(containerId);
    const badge = document.getElementById(countBadgeId);
    const titleEl = document.getElementById(titleId);
    const listEl = document.querySelector(`#${containerId} .donut-tx-list-scroll`);
    const tableBodyEl = document.querySelector(`#${containerId} .donut-table-tbody`);
    const sortSelect = document.querySelector(`#${containerId} .donut-sort-dropdown`);

    if (!panel || !listEl) return;

    if (badge) badge.textContent = `${transactions.length} records`;
    if (titleEl) titleEl.textContent = listTitle;

    // Sync Sort Select dropdown value
    if (sortSelect && sortSelect.value !== state.sortOrder) {
      sortSelect.value = state.sortOrder;
    }

    if (transactions.length === 0) {
      listEl.innerHTML = '<div class="text-xs text-slate-500 py-4 text-center">No transactions match</div>';
      if (tableBodyEl) tableBodyEl.innerHTML = '<tr><td colspan="10" class="text-center py-4 text-slate-500">No records</td></tr>';
      return;
    }

    // 1. Render Cards
    listEl.innerHTML = transactions.map((item, idx) => {
      const isExp = item.amountXpns > 0;
      const isInc = item.amtInCredit > 0;
      const amtStr = isExp ? `-${formatINR(item.amountXpns)}` : (isInc ? `+${formatINR(item.amtInCredit)}` : '₹0');
      const amtColor = isExp ? 'text-rose-400' : (isInc ? 'text-emerald-400' : 'text-slate-300');

      return `
        <div class="donut-tx-card" onclick="window.openDetailFromInlineTx(${item.id})">
          <div class="donut-tx-row-main">
            <div class="donut-tx-main-left">
              <span class="donut-tx-date">${escapeHTML(item.date)}</span>
              <span class="donut-tx-dot-sep">•</span>
              <span class="donut-tx-desc">${escapeHTML(item.item || 'Transaction')}</span>
            </div>
            <span class="donut-tx-amount ${amtColor}">${amtStr}</span>
          </div>
          <div class="donut-tx-row-sub">
            <div class="donut-tx-sub-left">
              <span>${escapeHTML(item.category)}</span>
              <span>${escapeHTML(item.incomeAccnt || item.expenseAcc || '-')}</span>
              <span>${escapeHTML(item.by)}</span>
            </div>
            <div class="donut-tx-sub-right">
              ${item.balance !== 0 ? `<span>Bal: ${formatINR(item.balance)}</span>` : '<span>›</span>'}
            </div>
          </div>
        </div>
      `;
    }).join('');

    // 2. Render Dense Table Rows
    if (tableBodyEl) {
      tableBodyEl.innerHTML = transactions.map(item => {
        const isExp = item.amountXpns > 0;
        const isInc = item.amtInCredit > 0;
        return `
          <tr onclick="window.openDetailFromInlineTx(${item.id})" style="cursor: pointer;">
            <td>${escapeHTML(item.date)}</td>
            <td>${escapeHTML(item.by)}</td>
            <td>${escapeHTML(item.forEntity)}</td>
            <td><strong>${escapeHTML(item.item)}</strong></td>
            <td>${escapeHTML(item.category)}</td>
            <td class="text-right text-rose-400 font-mono">${isExp ? formatINR(item.amountXpns) : '-'}</td>
            <td class="text-slate-400">${escapeHTML(item.info || '-')}</td>
            <td class="text-right text-emerald-400 font-mono">${isInc ? formatINR(item.amtInCredit) : '-'}</td>
            <td>${escapeHTML(item.incomeAccnt || item.expenseAcc)}</td>
            <td class="text-right font-mono">${item.balance !== 0 ? formatINR(item.balance) : '-'}</td>
          </tr>
        `;
      }).join('');
    }
  }

  window.openDetailFromInlineTx = function(id) {
    const item = normalizedData.find(t => t.id === id);
    if (item) openTransactionModal(item);
  };

  window.minimizeCatTransactions = function(e) {
    if (e && e.preventDefault) e.preventDefault();
    state.catDonutTxMinimized = true;
    const panel = document.getElementById('catDonutTxPanel');
    if (panel) {
      panel.classList.add('hidden');
      panel.style.display = 'none';
    }
    showToast('Category grid minimized');
  };

  window.minimizeAccTransactions = function(e) {
    if (e && e.preventDefault) e.preventDefault();
    state.accDonutTxMinimized = true;
    const panel = document.getElementById('accDonutTxPanel');
    if (panel) {
      panel.classList.add('hidden');
      panel.style.display = 'none';
    }
    showToast('Account grid minimized');
  };

  // ==================== 8. MASTER VIEW DISPATCHER ====================
  function updateAllViews() {
    const filtered = getFilteredAndSortedTransactions();

    // Update Header active filter count badge
    const filterBadge = document.getElementById('activeFilterBadge');
    const count = countActiveFilters();
    if (filterBadge) {
      if (count > 0) {
        filterBadge.textContent = count;
        filterBadge.classList.remove('hidden');
      } else {
        filterBadge.classList.add('hidden');
      }
    }

    // Update Drawer Apply Button Counter Preview
    const applyCount = document.getElementById('applyCountPreview');
    if (applyCount) applyCount.textContent = filtered.length;

    renderOverviewTab(filtered);
    renderChartsTab(filtered);
    renderLedgerTab(filtered);

    // Update View-Only Pop-up if currently open
    const popupEl = document.getElementById('filterDetailsPopup');
    if (popupEl && !popupEl.classList.contains('hidden')) {
      updateFilterDetailsPopup(filtered);
    }

    // Update Inline Transaction Grid for Category Donut
    const catTxPanel = document.getElementById('catDonutTxPanel');
    if (catTxPanel) {
      if (state.selectedCategory !== 'All' && !state.catDonutTxMinimized) {
        catTxPanel.classList.remove('hidden');
        catTxPanel.style.display = 'flex';
        const catTxItems = filtered.filter(t => (t.category || 'misc expn') === state.selectedCategory);
        renderDonutInlineTxList('catDonutTxPanel', 'catDonutTxCountBadge', 'catDonutTxTitle', `${state.selectedCategory} Transactions`, catTxItems);
      } else {
        catTxPanel.classList.add('hidden');
        catTxPanel.style.display = 'none';
      }
    }

    // Update Inline Transaction Grid for Account Donut (Handles Expense & Income Accounts)
    const accTxPanel = document.getElementById('accDonutTxPanel');
    if (accTxPanel) {
      const isFilteredExp = state.selectedExpenseAcc !== 'All';
      const isFilteredInc = state.selectedIncomeAcc !== 'All' && state.selectedIncomeAcc !== 'All Banks';

      if ((isFilteredExp || isFilteredInc) && !state.accDonutTxMinimized) {
        accTxPanel.classList.remove('hidden');
        accTxPanel.style.display = 'flex';
        const targetAcc = isFilteredInc ? state.selectedIncomeAcc : state.selectedExpenseAcc;
        const accTxItems = filtered.filter(t => (t.incomeAccnt === targetAcc || t.expenseAcc === targetAcc));
        renderDonutInlineTxList('accDonutTxPanel', 'accDonutTxCountBadge', 'accDonutTxTitle', `${targetAcc} Transactions`, accTxItems);
      } else {
        accTxPanel.classList.add('hidden');
        accTxPanel.style.display = 'none';
      }
    }

    // Update Chart 1 & Chart 2 Back/Undo Buttons visibility
    const catResetBtn = document.getElementById('btnResetCategoryChart');
    if (catResetBtn) {
      if (state.selectedCategory !== 'All') {
        catResetBtn.classList.remove('hidden');
        catResetBtn.style.display = 'inline-flex';
        catResetBtn.setAttribute('title', `Undo filter: ${state.selectedCategory}`);
      } else {
        catResetBtn.classList.add('hidden');
        catResetBtn.style.display = 'none';
      }
    }

    const accResetBtn = document.getElementById('btnResetAccountChart');
    if (accResetBtn) {
      const isFilteredExp = state.selectedExpenseAcc !== 'All';
      const isFilteredInc = state.selectedIncomeAcc !== 'All' && state.selectedIncomeAcc !== 'All Banks';
      if (isFilteredExp || isFilteredInc) {
        accResetBtn.classList.remove('hidden');
        accResetBtn.style.display = 'inline-flex';
        accResetBtn.setAttribute('title', `Undo filter: ${isFilteredInc ? state.selectedIncomeAcc : state.selectedExpenseAcc}`);
      } else {
        accResetBtn.classList.add('hidden');
        accResetBtn.style.display = 'none';
      }
    }
  }

  // Tab Switcher
  function switchToTab(targetViewId) {
    if (state.currentTab !== 'tabViewFilters') {
      state.previousTab = state.currentTab;
    }
    state.currentTab = targetViewId;
    document.querySelectorAll('.mobile-tab-view').forEach(view => {
      view.classList.remove('active');
    });
    const target = document.getElementById(targetViewId);
    if (target) target.classList.add('active');

    // Update Bottom Nav
    document.querySelectorAll('.mobile-bottom-nav .nav-tab-item').forEach(btn => {
      if (btn.getAttribute('data-target') === targetViewId) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    // Update Header Filter Button Active State
    const openFilterBtn = document.getElementById('openFilterDrawerBtn');
    if (openFilterBtn) {
      if (targetViewId === 'tabViewFilters') {
        openFilterBtn.classList.add('filter-active');
      } else {
        openFilterBtn.classList.remove('filter-active');
      }
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }



  // Render and populate Filter Details Pop-Up Menu (View Only)
  function updateFilterDetailsPopup(filtered) {
    const popup = document.getElementById('filterDetailsPopup');
    if (!popup) return;

    let totalExp = 0;
    let totalInc = 0;
    filtered.forEach(t => {
      totalExp += (t.amountXpns || 0);
      totalInc += (t.amtInCredit || 0);
    });

    const countEl = document.getElementById('popupFilterCount');
    const expEl = document.getElementById('popupFilterExpense');
    const incEl = document.getElementById('popupFilterIncome');
    if (countEl) countEl.textContent = filtered.length;
    if (expEl) expEl.textContent = formatINR(totalExp);
    if (incEl) incEl.textContent = formatINR(totalInc);

    const listEl = document.getElementById('filterPopupDetailsList');
    if (!listEl) return;

    const rows = [
      { label: '📅 Month', value: state.selectedMonth, active: state.selectedMonth !== 'All' },
      { label: '🏷️ Category', value: state.selectedCategory, active: state.selectedCategory !== 'All' },
      { label: '💳 Expense Account', value: state.selectedExpenseAcc, active: state.selectedExpenseAcc !== 'All' },
      { label: '👤 Person (By)', value: state.selectedPerson, active: state.selectedPerson !== 'All' },
      { label: '🎯 Purpose (For)', value: state.selectedFor, active: state.selectedFor !== 'All' },
      { label: '🏦 Income Account', value: state.selectedIncomeAcc, active: state.selectedIncomeAcc !== 'All' },
      { label: '🔍 Search Keyword', value: state.searchKeyword ? `"${state.searchKeyword}" (${state.searchMode})` : 'None', active: Boolean(state.searchKeyword) },
      { label: '💚 Only Income (J8)', value: state.onlyIncome ? 'ON (Credits & Budget only)' : 'OFF (All transactions)', active: state.onlyIncome }
    ];

    listEl.innerHTML = rows.map(r => `
      <div class="filter-detail-row">
        <span class="filter-detail-label">${r.label}</span>
        <span class="filter-detail-value ${r.active ? 'active-highlight' : ''}">${escapeHTML(r.value)}</span>
      </div>
    `).join('');
  }

  // Toggle View-Only Filter Details Pop-Up Menu
  window.toggleFilterMenu = function (e) {
    if (e && e.preventDefault) e.preventDefault();
    const popup = document.getElementById('filterDetailsPopup');
    const openBtn = document.getElementById('openFilterDrawerBtn');
    if (!popup) return;

    const isHidden = popup.classList.contains('hidden');
    if (isHidden) {
      updateFilterDetailsPopup(getFilteredAndSortedTransactions());
      popup.classList.remove('hidden');
      if (openBtn) openBtn.classList.add('filter-active');
    } else {
      popup.classList.add('hidden');
      if (openBtn) openBtn.classList.remove('filter-active');
    }
  };

  window.resetFromPopup = function(e) {
    if (e && e.preventDefault) e.preventDefault();
    resetAllFilters();
    updateFilterDetailsPopup(getFilteredAndSortedTransactions());
    showToast('Filters reset to defaults');
  };


  window.handleNavFilterClick = function (e) {
    if (state.currentTab === 'tabViewFilters') {
      if (e && e.preventDefault) e.preventDefault();
      const returnTab = (state.previousTab && state.previousTab !== 'tabViewFilters') ? state.previousTab : 'tabViewOverview';
      switchToTab(returnTab);
    }
  };

  window.selectCategoryFilter = function (cat) {
    if (state.selectedCategory === cat) {
      state.selectedCategory = 'All';
      state.catDonutTxMinimized = false;
      showToast('Category reset to All');
    } else {
      state.selectedCategory = cat;
      state.catDonutTxMinimized = false;
      showToast(`Filtered Category: ${cat}`);
    }
    populateDrawerDropdowns();
    updateAllViews();
  };

  window.resetCategoryChartFilter = function (e) {
    if (e && e.preventDefault) e.preventDefault();
    state.selectedCategory = 'All';
    populateDrawerDropdowns();
    updateAllViews();
    showToast('↩ Undid Category filter');
  };

  window.selectAccountFilter = function (acc) {
    if (state.selectedExpenseAcc === acc) {
      state.selectedExpenseAcc = 'All';
      state.accDonutTxMinimized = false;
      showToast('Account reset to All');
    } else {
      state.selectedExpenseAcc = acc;
      state.accDonutTxMinimized = false;
      showToast(`Filtered Account: ${acc}`);
    }
    populateDrawerDropdowns();
    updateAllViews();
  };

  window.selectIncomeAccountFilter = function (acc) {
    if (state.selectedIncomeAcc === acc) {
      state.selectedIncomeAcc = 'All';
      state.accDonutTxMinimized = false;
      showToast('Income Account reset to All');
    } else {
      state.selectedIncomeAcc = acc;
      state.accDonutTxMinimized = false;
      showToast(`Filtered Income Account: ${acc}`);
    }
    populateDrawerDropdowns();
    updateAllViews();
  };

  window.resetAccountChartFilter = function (e) {
    if (e && e.preventDefault) e.preventDefault();
    state.selectedExpenseAcc = 'All';
    state.selectedIncomeAcc = 'All';
    populateDrawerDropdowns();
    updateAllViews();
    showToast('↩ Undid Account filter');
  };


  // ==================== 9. LIVE SYNC ENGINE (GOOGLE SHEETS) ====================
  async function fetchLiveSyncData(isManual = false) { return syncActiveSheetData(isManual); }
  async function _legacyFetchLiveSyncData(isManual = false) {
    if (state.isSyncing) return;
    state.isSyncing = true;

    const syncBtn = document.getElementById('mobileSyncBtn');
    const syncIcon = document.getElementById('mobileSyncIcon');
    const statusLabel = document.getElementById('syncStatusLabel');
    const subTitle = document.getElementById('headerSyncSubtitle');

    if (syncIcon) syncIcon.classList.add('spinning');
    if (isManual) showToast('Syncing from Google Sheets...');

    try {
      const resp = await fetch('/api/sync', { cache: 'no-store' });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();

      if (data && Array.isArray(data.records) && data.records.length > 0) {
        rawLedgerData = data.records;
        normalizedData = normalizeRawRecords(rawLedgerData);
        state.lastSyncTime = Date.now();

        populateDrawerDropdowns();
        updateAllViews();

        const timeStr = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        if (statusLabel) statusLabel.textContent = `Live (${normalizedData.length})`;
        if (subTitle) subTitle.textContent = `Synced at ${timeStr}`;
        if (isManual) showToast(`✓ Synced ${normalizedData.length} records!`);
      }
    } catch (e) {
      console.warn('[Mobile Sync Warn]: Using offline cached data.', e);
      if (statusLabel) statusLabel.textContent = 'Cached';
      if (isManual) showToast('Using local ledger cache');
    } finally {
      state.isSyncing = false;
      if (syncIcon) syncIcon.classList.remove('spinning');
    }
  }

  // ==================== 10. EVENT HANDLERS & WIRING ====================
  function setupEventListeners() {
    // 1. Bottom Nav Tabs (With toggle minimize for filters tab)
    document.querySelectorAll('.mobile-bottom-nav .nav-tab-item').forEach(btn => {
      btn.addEventListener('click', () => {
        const target = btn.getAttribute('data-target');
        if (!target) return;
        if (target === 'tabViewFilters' && state.currentTab === 'tabViewFilters') {
          // If already on Filters tab, clicking again minimizes it back to previous view!
          const returnTab = (state.previousTab && state.previousTab !== 'tabViewFilters') ? state.previousTab : 'tabViewOverview';
          switchToTab(returnTab);
        } else {
          switchToTab(target);
        }
      });
    });

    // 2. Overview Banner Link to Charts
    const linkCharts = document.getElementById('linkToChartsTab');
    if (linkCharts) {
      linkCharts.addEventListener('click', () => {
        switchToTab('tabViewCharts');
      });
    }

    // 3. Reset Banner Action
    const bannerReset = document.getElementById('bannerResetBtn');
    if (bannerReset) {
      bannerReset.addEventListener('click', resetAllFilters);
    }

    // 4. Header Filter Icon (Toggles View-Only Pop-Up Menu - Strictly NO Tab Shifting!)
    const openFilterBtn = document.getElementById('openFilterDrawerBtn');
    if (openFilterBtn) {
      openFilterBtn.addEventListener('click', (e) => {
        if (e && e.preventDefault) e.preventDefault();
        if (e && e.stopPropagation) e.stopPropagation();
        window.toggleFilterMenu(e);
      });
    }

    // Dismiss Pop-Up Menu when clicking outside of it
    document.addEventListener('click', (e) => {
      const popup = document.getElementById('filterDetailsPopup');
      const openBtn = document.getElementById('openFilterDrawerBtn');
      if (popup && !popup.classList.contains('hidden')) {
        if (!popup.contains(e.target) && (!openBtn || !openBtn.contains(e.target))) {
          popup.classList.add('hidden');
          if (openBtn) openBtn.classList.remove('filter-active');
        }
      }
    });

    // Chart 1 & Chart 2 Undo/Reset Listeners (Clickable Back button beside Chart badges)
    const catResetBtn = document.getElementById('btnResetCategoryChart');
    if (catResetBtn) {
      catResetBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        state.selectedCategory = 'All';
        populateDrawerDropdowns();
        updateAllViews();
        showToast('↩ Undid Category filter');
      });
    }

    const accResetBtn = document.getElementById('btnResetAccountChart');
    if (accResetBtn) {
      accResetBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        state.selectedExpenseAcc = 'All';
        populateDrawerDropdowns();
        updateAllViews();
        showToast('↩ Undid Account filter');
      });
    }

    // 5. Header Manual Sync
    const syncBtn = document.getElementById('mobileSyncBtn');
    if (syncBtn) {
      syncBtn.addEventListener('click', () => {
        fetchLiveSyncData(true);
      });
    }

    // 6. Search Bar & Clear
    const searchInput = document.getElementById('mobileSearchInput');
    const clearSearch = document.getElementById('mobileClearSearchBtn');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        state.searchKeyword = e.target.value;
        if (clearSearch) {
          if (state.searchKeyword) clearSearch.classList.remove('hidden');
          else clearSearch.classList.add('hidden');
        }
        state.visibleLimit = 50;
        updateAllViews();
      });
    }

    if (clearSearch) {
      clearSearch.addEventListener('click', () => {
        if (searchInput) searchInput.value = '';
        state.searchKeyword = '';
        clearSearch.classList.add('hidden');
        state.visibleLimit = 50;
        updateAllViews();
      });
    }

    // 7. Search Mode Toggle (Similar / Exact)
    const btnSim = document.getElementById('btnModeSimilar');
    const btnExact = document.getElementById('btnModeExact');
    if (btnSim && btnExact) {
      btnSim.addEventListener('click', () => {
        btnSim.classList.add('active');
        btnExact.classList.remove('active');
        state.searchMode = 'similar';
        updateAllViews();
      });
      btnExact.addEventListener('click', () => {
        btnExact.classList.add('active');
        btnSim.classList.remove('active');
        state.searchMode = 'exact';
        updateAllViews();
      });
    }

    // 8. Horizontal Quick Chips Scrollbar
    document.querySelectorAll('#quickChipsScroll .chip-pill[data-chip-type]').forEach(pill => {
      pill.addEventListener('click', () => {
        const type = pill.getAttribute('data-chip-type');
        const val = pill.getAttribute('data-value');

        if (type === 'month') {
          state.selectedMonth = val;
          document.querySelectorAll('#quickChipsScroll [data-chip-type="month"]').forEach(p => p.classList.remove('active'));
          pill.classList.add('active');
        } else if (type === 'person') {
          state.selectedPerson = state.selectedPerson === val ? 'All' : val;
          pill.classList.toggle('active');
        }

        populateDrawerDropdowns();
        state.visibleLimit = 50;
        updateAllViews();
      });
    });

    // Special Income Only Chip
    const incomeChip = document.getElementById('chipIncomeOnly');
    if (incomeChip) {
      incomeChip.addEventListener('click', () => {
        state.onlyIncome = !state.onlyIncome;
        incomeChip.classList.toggle('active');
        const drawerSwitch = document.getElementById('drawerIncomeOnlySwitch');
        if (drawerSwitch) drawerSwitch.checked = state.onlyIncome;
        state.visibleLimit = 50;
        updateAllViews();
        showToast(state.onlyIncome ? 'Showing Income & Budget only' : 'Showing all transactions');
      });
    }

    // 9. Drawer Selects
    const drawerMonth = document.getElementById('drawerMonthSelect');
    if (drawerMonth) {
      drawerMonth.addEventListener('change', (e) => {
        state.selectedMonth = e.target.value;
        // Sync quick chip
        document.querySelectorAll('#quickChipsScroll [data-chip-type="month"]').forEach(p => {
          if (p.getAttribute('data-value') === state.selectedMonth) p.classList.add('active');
          else p.classList.remove('active');
        });
        updateAllViews();
      });
    }

    const drawerCat = document.getElementById('drawerCategorySelect');
    if (drawerCat) {
      drawerCat.addEventListener('change', (e) => {
        state.selectedCategory = e.target.value;
        updateAllViews();
      });
    }

    const drawerPerson = document.getElementById('drawerPersonSelect');
    if (drawerPerson) {
      drawerPerson.addEventListener('change', (e) => {
        state.selectedPerson = e.target.value;
        updateAllViews();
      });
    }

    const drawerFor = document.getElementById('drawerForSelect');
    if (drawerFor) {
      drawerFor.addEventListener('change', (e) => {
        state.selectedFor = e.target.value;
        updateAllViews();
      });
    }

    const drawerExpAcc = document.getElementById('drawerExpenseAccSelect');
    if (drawerExpAcc) {
      drawerExpAcc.addEventListener('change', (e) => {
        state.selectedExpenseAcc = e.target.value;
        updateAllViews();
      });
    }

    const drawerIncAcc = document.getElementById('drawerIncomeAccSelect');
    if (drawerIncAcc) {
      drawerIncAcc.addEventListener('change', (e) => {
        state.selectedIncomeAcc = e.target.value;
        updateAllViews();
      });
    }

    const drawerIncomeSwitch = document.getElementById('drawerIncomeOnlySwitch');
    if (drawerIncomeSwitch) {
      drawerIncomeSwitch.addEventListener('change', (e) => {
        state.onlyIncome = e.target.checked;
        if (incomeChip) incomeChip.classList.toggle('active', state.onlyIncome);
        updateAllViews();
      });
    }

    // 10. Drawer Buttons (Apply & Reset)
    const applyBtn = document.getElementById('applyFiltersBtn');
    if (applyBtn) {
      applyBtn.addEventListener('click', () => {
        switchToTab('tabViewLedger');
        showToast('Filters Applied!');
      });
    }

    const drawerReset = document.getElementById('filtersPanelResetBtn');
    if (drawerReset) {
      drawerReset.addEventListener('click', resetAllFilters);
    }

    // 11. Sort Selects (Main Grid + Category Donut Grid + Account Donut Grid)
    function handleSortChange(newSortOrder, label) {
      state.sortOrder = newSortOrder;
      // Keep all 3 sort dropdowns perfectly in sync
      const mainSort = document.getElementById('mobileSortSelect');
      const catSort = document.getElementById('catDonutSortSelect');
      const accSort = document.getElementById('accDonutSortSelect');
      if (mainSort) mainSort.value = newSortOrder;
      if (catSort) catSort.value = newSortOrder;
      if (accSort) accSort.value = newSortOrder;

      updateAllViews();
      showToast(`Sorted: ${label}`);
    }

    const sortSelect = document.getElementById('mobileSortSelect');
    if (sortSelect) {
      sortSelect.addEventListener('change', (e) => {
        handleSortChange(e.target.value, e.target.options[e.target.selectedIndex].text);
      });
    }

    const catDonutSort = document.getElementById('catDonutSortSelect');
    if (catDonutSort) {
      catDonutSort.addEventListener('change', (e) => {
        handleSortChange(e.target.value, e.target.options[e.target.selectedIndex].text);
      });
    }

    const accDonutSort = document.getElementById('accDonutSortSelect');
    if (accDonutSort) {
      accDonutSort.addEventListener('change', (e) => {
        handleSortChange(e.target.value, e.target.options[e.target.selectedIndex].text);
      });
    }

    // Category Donut Grid Display Mode Toggle (Cards vs Table)
    const btnToggleCatMode = document.getElementById('btnToggleCatDisplayMode');
    const catCards = document.getElementById('catDonutTxList');
    const catTable = document.getElementById('catDonutTableWrap');
    if (btnToggleCatMode && catCards && catTable) {
      btnToggleCatMode.addEventListener('click', () => {
        if (state.catInlineDisplayMode === 'cards') {
          state.catInlineDisplayMode = 'table';
          catCards.classList.add('hidden');
          catTable.classList.remove('hidden');
          showToast('Category Grid: Table View');
        } else {
          state.catInlineDisplayMode = 'cards';
          catCards.classList.remove('hidden');
          catTable.classList.add('hidden');
          showToast('Category Grid: Cards View');
        }
      });
    }

    // Account Donut Grid Display Mode Toggle (Cards vs Table)
    const btnToggleAccMode = document.getElementById('btnToggleAccDisplayMode');
    const accCards = document.getElementById('accDonutTxList');
    const accTable = document.getElementById('accDonutTableWrap');
    if (btnToggleAccMode && accCards && accTable) {
      btnToggleAccMode.addEventListener('click', () => {
        if (state.accInlineDisplayMode === 'cards') {
          state.accInlineDisplayMode = 'table';
          accCards.classList.add('hidden');
          accTable.classList.remove('hidden');
          showToast('Account Grid: Table View');
        } else {
          state.accInlineDisplayMode = 'cards';
          accCards.classList.remove('hidden');
          accTable.classList.add('hidden');
          showToast('Account Grid: Cards View');
        }
      });
    }

    // 12. Display Mode Toggle (Cards vs Table)
    const displayModeBtn = document.getElementById('btnToggleDisplayMode');
    const cardsStream = document.getElementById('transactionsCardsStream');
    const tableWrap = document.getElementById('transactionsTableWrap');
    if (displayModeBtn && cardsStream && tableWrap) {
      displayModeBtn.addEventListener('click', () => {
        if (state.displayMode === 'cards') {
          state.displayMode = 'table';
          cardsStream.classList.add('hidden');
          tableWrap.classList.remove('hidden');
          showToast('Table View Active');
        } else {
          state.displayMode = 'cards';
          cardsStream.classList.remove('hidden');
          tableWrap.classList.add('hidden');
          showToast('Cards View Active');
        }
      });
    }

    // 13. Pagination (Load More / Show All)
    const loadMoreBtn = document.getElementById('mobileLoadMoreBtn');
    if (loadMoreBtn) {
      loadMoreBtn.addEventListener('click', () => {
        state.visibleLimit += 50;
        renderLedgerTab(getFilteredAndSortedTransactions());
      });
    }

    const showAllBtn = document.getElementById('mobileShowAllBtn');
    if (showAllBtn) {
      showAllBtn.addEventListener('click', () => {
        state.visibleLimit = 99999;
        renderLedgerTab(getFilteredAndSortedTransactions());
      });
    }

    // 14. Modal Close
    const closeModalBtn = document.getElementById('closeModalBtn');
    const modalBackdrop = document.getElementById('transactionModalBackdrop');
    if (closeModalBtn && modalBackdrop) {
      closeModalBtn.addEventListener('click', () => modalBackdrop.classList.add('hidden'));
      modalBackdrop.addEventListener('click', (e) => {
        if (e.target === modalBackdrop) modalBackdrop.classList.add('hidden');
      });
    }

    // --- Dual Sheet Switcher, FAB, Edit Modal Listeners ---
    const sheetSelectEl = document.getElementById('mobileSheetSelector');
    if (sheetSelectEl) {
      sheetSelectEl.value = currentSheetKey;
      sheetSelectEl.addEventListener('change', (e) => {
        const newKey = e.target.value;
        if (newKey && SHEETS_CONFIG[newKey]) {
          currentSheetKey = newKey;
          const newUrl = new URL(window.location.href);
          newUrl.searchParams.set('sheet', newKey === 'sheet2' ? '2' : '1');
          window.history.replaceState({}, '', newUrl.toString());
          showToast(`Switching to ${SHEETS_CONFIG[newKey].shortName}...`);
          syncActiveSheetData(false);
        }
      });
    }

    const mobileSyncBtn = document.getElementById('mobileSyncBtn');
    if (mobileSyncBtn) {
      mobileSyncBtn.addEventListener('click', () => {
        syncActiveSheetData(true);
      });
    }

    const fabBtn = document.getElementById('fabAddTransaction');
    if (fabBtn) {
      fabBtn.addEventListener('click', () => {
        openEditTransactionModal(null, 'new');
      });
    }

    const editDetailBtn = document.getElementById('btnEditFromDetail');
    if (editDetailBtn) {
      editDetailBtn.addEventListener('click', () => {
        if (activeDetailTx) {
          openEditTransactionModal(activeDetailTx, 'edit');
        }
      });
    }

    const closeEditModalBtn = document.getElementById('closeEditModalBtn');
    const btnCancelEditTx = document.getElementById('btnCancelEditTx');
    const editModalBackdrop = document.getElementById('editTransactionModalBackdrop');
    if (closeEditModalBtn) {
      closeEditModalBtn.addEventListener('click', () => {
        if (editModalBackdrop) editModalBackdrop.classList.add('hidden');
      });
    }
    if (btnCancelEditTx) {
      btnCancelEditTx.addEventListener('click', () => {
        if (editModalBackdrop) editModalBackdrop.classList.add('hidden');
      });
    }

    const pillExp = document.getElementById('typePillExpense');
    const pillInc = document.getElementById('typePillIncome');
    if (pillExp) pillExp.addEventListener('click', () => setEditTxType('expense'));
    if (pillInc) pillInc.addEventListener('click', () => setEditTxType('income'));

    const editForm = document.getElementById('editTxForm');
    if (editForm) {
      editForm.addEventListener('submit', (e) => {
        e.preventDefault();
        saveTransactionFromForm();
      });
    }
    const btnSaveEdit = document.getElementById('btnSaveEditTx');
    if (btnSaveEdit) {
      btnSaveEdit.addEventListener('click', (e) => {
        e.preventDefault();
        saveTransactionFromForm();
      });
    }

  }

  function resetAllFilters() {
    state.catDonutTxMinimized = false;
    state.accDonutTxMinimized = false;
    state.selectedMonth = 'All';
    state.selectedCategory = 'All';
    state.selectedPerson = 'All';
    state.selectedFor = 'All';
    state.selectedExpenseAcc = 'All';
    state.selectedIncomeAcc = 'All';
    state.onlyIncome = false;
    state.searchKeyword = '';
    state.searchMode = 'similar';
    state.visibleLimit = 50;

    const searchInput = document.getElementById('mobileSearchInput');
    const clearBtn = document.getElementById('mobileClearSearchBtn');
    if (searchInput) searchInput.value = '';
    if (clearBtn) clearBtn.classList.add('hidden');

    const incomeChip = document.getElementById('chipIncomeOnly');
    if (incomeChip) incomeChip.classList.remove('active');

    document.querySelectorAll('#quickChipsScroll [data-chip-type="month"]').forEach(p => {
      p.classList.toggle('active', p.getAttribute('data-value') === 'All');
    });
    document.querySelectorAll('#quickChipsScroll [data-chip-type="person"]').forEach(p => {
      p.classList.remove('active');
    });

    populateDrawerDropdowns();
    updateAllViews();
    showToast('All filters reset to defaults');
  }

  // ==================== 11. INITIALIZATION ====================
  function init() {
    normalizedData = normalizeRawRecords(rawLedgerData);
    populateDrawerDropdowns();
    updateAllViews();
    setupEventListeners();

    // Trigger live sync immediately
    fetchLiveSyncData(false);

    // Auto-poll every 18 seconds
    setInterval(() => {
      fetchLiveSyncData(false);
    }, 18000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
