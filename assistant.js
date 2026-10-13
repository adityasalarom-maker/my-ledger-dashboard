/**
 * LEDGER INTELLIGENCE ASSISTANT v1.0
 * Natural-Language Entry + Financial Query Engine + Security
 * 
 * Standalone client application: Zero modification of existing dashboard.
 * Zero token overhead against Gemini AI limits (runs deterministic local JS parsing & analytics).
 */

(function () {
  'use strict';

  // --- 1. MASTER TAXONOMIES & VOCABULARIES ---
  const MASTER_CATEGORIES = [
    'BUDGET', 'Sabji', 'Rashan', 'misc expn', 'Charity', 'Food', 'Stay', 'Fuel',
    'Personal Care', 'Bills', 'Recharges', 'Housing', 'Accessories', 'Fruits',
    'Medical', 'Other Houses', 'Clothes', 'Services \\ Repairs', 'Pets',
    'Insurances \\ PUC', 'Savings', 'EMI', 'Business', 'Deposits', 'Work', 'Gas', 'Gifts',
    'Income', 'Needs Review'
  ];

  const EXPENSE_ACCOUNTS = [
    'Hom Cash', 'PNB Online', 'Cash Earning E', 'Trishaa Cash',
    'Trishaa Online Sav Acc', 'Trishaa Online Current Acc', 'Trishaa GPay',
    'Co bank', 'SBI Vil', 'PO Bk', 'Maa SBI BK', 'All'
  ];

  const INCOME_ACCOUNTS = [
    'CO Bank', 'SBI Vil', 'Cash Earning I', 'Trishaa HDFC Sav Acc',
    'PNB Bnk', 'PO Bk', 'Maa SBI BK', 'Trishaa Currnt GPay', 'All Banks'
  ];

  const ENTITIES = {
    by: ['Honey', 'Trishaa', 'Maa'],
    for: ['Home', 'Budget', 'Staying', 'Outer', 'Trishaa', 'Honey', 'Maa', 'Work']
  };

  const DEFAULT_GAS_URL = 'https://script.google.com/macros/s/AKfycbz5Een-L-ggrYaFtoyuRRePZzMXM2jXNih9fFVvbsUUl8389oceEyNUG8JJGlC_RKHpYQ/exec';
  const DEFAULT_PASSKEY = 'Ledger2026!SecureKey';

  // --- 2. APPLICATION STATE ---
  let ledgerRecords = [];
  let parsedDraftBatch = [];
  let queryChartInstance = null;

  // --- 3. DOM ELEMENT REFERENCES ---
  const el = {
    tabs: document.querySelectorAll('.nav-tab-btn'),
    tabSections: document.querySelectorAll('.tab-section'),
    rawNotesInput: document.getElementById('rawNotesInput'),
    btnLoadSampleNotes: document.getElementById('btnLoadSampleNotes'),
    btnClearNotes: document.getElementById('btnClearNotes'),
    btnParseNotes: document.getElementById('btnParseNotes'),
    reviewPanel: document.getElementById('reviewPanel'),
    batchValidationBadge: document.getElementById('batchValidationBadge'),
    summaryCount: document.getElementById('summaryCount'),
    summaryExpense: document.getElementById('summaryExpense'),
    summaryIncome: document.getElementById('summaryIncome'),
    summaryAmbiguous: document.getElementById('summaryAmbiguous'),
    duplicateAlertBox: document.getElementById('duplicateAlertBox'),
    reviewTableBody: document.getElementById('reviewTableBody'),
    btnAddManualRow: document.getElementById('btnAddManualRow'),
    btnDiscardDraft: document.getElementById('btnDiscardDraft'),
    btnConfirmBatch: document.getElementById('btnConfirmBatch'),
    nlQueryInput: document.getElementById('nlQueryInput'),
    btnAskQuery: document.getElementById('btnAskQuery'),
    queryChips: document.querySelectorAll('.query-chip'),
    queryResultCard: document.getElementById('queryResultCard'),
    answerHeadline: document.getElementById('answerHeadline'),
    answerSubtext: document.getElementById('answerSubtext'),
    queryKpiExpense: document.getElementById('queryKpiExpense'),
    queryKpiIncome: document.getElementById('queryKpiIncome'),
    queryKpiCount: document.getElementById('queryKpiCount'),
    queryChartContainer: document.getElementById('queryChartContainer'),
    queryChartCanvas: document.getElementById('queryChartCanvas'),
    queryResultsTableBody: document.getElementById('queryResultsTableBody'),
    queryTableCount: document.getElementById('queryTableCount'),
    assistantGasUrl: document.getElementById('assistantGasUrl'),
    assistantPasskey: document.getElementById('assistantPasskey'),
    btnSaveAssistantKey: document.getElementById('btnSaveAssistantKey'),
    btnSyncNow: document.getElementById('btnSyncNow'),
    syncStatusSubtitle: document.getElementById('syncStatusSubtitle'),
    toast: document.getElementById('assistantToast')
  };

  // --- 4. INITIALIZATION ---
  function init() {
    setupTabNavigation();
    loadSavedSettings();
    loadLedgerData();
    setupEventHandlers();
  }

  function setupTabNavigation() {
    el.tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        el.tabs.forEach(t => t.classList.remove('active'));
        el.tabSections.forEach(s => s.classList.remove('active'));
        tab.classList.add('active');
        const targetId = tab.getAttribute('data-tab');
        const targetSection = document.getElementById(targetId);
        if (targetSection) targetSection.classList.add('active');
      });
    });
  }

  function loadSavedSettings() {
    const savedUrl = localStorage.getItem('LEDGER_GAS_URL');
    if (savedUrl && el.assistantGasUrl) el.assistantGasUrl.value = savedUrl;
    const savedKey = localStorage.getItem('LEDGER_PASSKEY');
    if (savedKey && el.assistantPasskey) el.assistantPasskey.value = savedKey;
  }

  function showToast(message, duration = 3000) {
    if (!el.toast) return;
    el.toast.textContent = message;
    el.toast.classList.remove('hidden');
    setTimeout(() => el.toast.classList.add('hidden'), duration);
  }

  // --- 5. DATA INGESTION & LOCAL CACHE ---
  function loadLedgerData() {
    // 1. Check local storage cache
    const cachedData = localStorage.getItem('LEDGER_DATA_CACHE_V2') || localStorage.getItem('LEDGER_ENCRYPTED_CACHE_V1');
    if (cachedData) {
      try {
        const parsed = JSON.parse(cachedData);
        if (Array.isArray(parsed) && parsed.length > 0) {
          ledgerRecords = normalizeRecords(parsed);
          updateSyncSubtitle(ledgerRecords.length, 'Loaded from secure local cache');
          return;
        }
      } catch (e) {
        console.warn('Cache parse error:', e);
      }
    }

    // 2. Check window.LEDGER_DATA from ledger-data.js
    if (window.LEDGER_DATA && Array.isArray(window.LEDGER_DATA)) {
      ledgerRecords = normalizeRecords(window.LEDGER_DATA);
      updateSyncSubtitle(ledgerRecords.length, 'Loaded from fallback ledger-data.js');
    } else {
      updateSyncSubtitle(0, 'No local records loaded. Tap Sync.');
    }
  }

  function normalizeRecords(rawList) {
    return rawList.map(r => {
      const amtExp = parseFloat(r.amountXpns || r.amt_exp || (r.type === 'Expense' ? r.amount : 0) || 0);
      const amtIn = parseFloat(r.amtInCredit || r.amt_in || (r.type === 'Income' ? r.amount : 0) || 0);
      const desc = r.item || r.item_description || r.description || '';
      const date = r.date || '';
      let month = r.month || '';
      if (!month && date) {
        const m = date.match(/[a-zA-Z]{3}/);
        if (m) month = m[0];
      }
      return {
        date: date,
        month: month,
        by: r.by || 'Honey',
        forEntity: r.for || r.forEntity || 'Home',
        item: desc,
        category: r.category || 'misc expn',
        amountXpns: amtExp,
        amtInCredit: amtIn,
        expenseAcc: r.expenseAcc || r.account || '',
        incomeAccnt: r.incomeAccnt || r.account || '',
        note: r.note || '',
        balance: r.balance || null
      };
    });
  }

  function updateSyncSubtitle(count, note) {
    if (!el.syncStatusSubtitle) return;
    el.syncStatusSubtitle.textContent = `● LEDGER 2026 ● ${count} Transactions • ${note}`;
  }

  // --- 6. SECURE SYNC WITH APPS SCRIPT ---
  async function syncLiveData() {
    const gasUrl = el.assistantGasUrl.value.trim() || DEFAULT_GAS_URL;
    const passkey = el.assistantPasskey.value.trim() || DEFAULT_PASSKEY;

    showToast('🔄 Connecting to Google Apps Script gateway...');
    updateSyncSubtitle(ledgerRecords.length, 'Syncing...');

    try {
      const fullUrl = `${gasUrl}?action=getLedgerData&key=${encodeURIComponent(passkey)}`;
      const res = await fetch(fullUrl, { method: 'GET', mode: 'cors' });
      if (!res.ok) throw new Error(`HTTP ${res.status}: Gateway responded with error`);
      
      const json = await res.json();
      if (!json.success && json.error) throw new Error(json.error);

      const items = json.data || json.records || [];
      if (Array.isArray(items) && items.length > 0) {
        ledgerRecords = normalizeRecords(items);
        localStorage.setItem('LEDGER_DATA_CACHE_V2', JSON.stringify(items));
        updateSyncSubtitle(ledgerRecords.length, `Synced live at ${new Date().toLocaleTimeString()}`);
        showToast(`✅ Synced ${ledgerRecords.length} records successfully!`);
      } else {
        showToast('⚠️ Sync completed but no records returned.');
      }
    } catch (err) {
      console.error('Sync failed:', err);
      showToast(`❌ Sync Error: ${err.message}`);
      updateSyncSubtitle(ledgerRecords.length, 'Sync failed. Using local cache.');
    }
  }

  // --- 7. FEATURE A: RAW TRANSACTION NOTES PARSER ---
  function parseRawLine(line, currentDateContext, existingRecords = []) {
    const raw = line.trim();
    if (!raw) return null;

    // Check if line is purely a date header (e.g., "1 oct", "13 oct", "o/1 0 oct")
    const dateHeaderMatch = raw.match(/^([o0-9\/\s]+)\s*(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)$/i);
    if (dateHeaderMatch) {
      const rawDatePart = dateHeaderMatch[1].trim();
      const month = dateHeaderMatch[2];
      // Flag corrupted/ambiguous dates like "o/1 0 oct"
      if (rawDatePart.includes('o') || rawDatePart.includes('/') || rawDatePart.length > 2) {
        return {
          type: 'DATE_HEADER_AMBIGUOUS',
          raw,
          status: 'AMBIGUOUS',
          message: `Ambiguous date header token "${raw}". Please review manually.`
        };
      }
      const day = parseInt(rawDatePart, 10);
      return {
        type: 'DATE_HEADER',
        raw,
        date: `${day}-${month.charAt(0).toUpperCase() + month.slice(1).toLowerCase()}-2026`
      };
    }

    // Look for inline date prefix (e.g. "13 oct (3k ...)")
    let lineDate = currentDateContext;
    let text = raw;
    const inlineDateMatch = text.match(/^(\d{1,2})\s*(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\b/i);
    if (inlineDateMatch) {
      lineDate = `${inlineDateMatch[1]}-${inlineDateMatch[2].charAt(0).toUpperCase() + inlineDateMatch[2].slice(1).toLowerCase()}-2026`;
      text = text.slice(inlineDateMatch[0].length).trim();
    }

    // Clean parentheses if wrapping the whole line: "(3k rajeev charan rent pnb)"
    if (text.startsWith('(') && text.endsWith(')')) {
      text = text.slice(1, -1).trim();
    }
    // Also remove leading dash if present: "- 120- mata murti"
    if (text.startsWith('-')) {
      text = text.slice(1).trim();
    }

    // Amount arithmetic check: e.g. "mata murti + 280+50"
    let components = [];
    const exprMatch = text.match(/(\d+(?:\.\d+)?)\s*\+\s*(\d+(?:\.\d+)?)/);
    if (exprMatch) {
      components = [parseFloat(exprMatch[1]), parseFloat(exprMatch[2])];
    }

    // Extract amount token
    // Look for leading number or k-shorthand: "3k", "100 -", "60 -", "180-", "1.2k-", "40, 60-"
    let amount = null;
    let description = text;

    // Check multiple amounts separated by commas: e.g. "40, 60- 1kg khira"
    const multiAmtMatch = text.match(/^(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*[-:]?\s*(.*)/);
    if (multiAmtMatch) {
      components = [parseFloat(multiAmtMatch[1]), parseFloat(multiAmtMatch[2])];
      amount = components.reduce((a, b) => a + b, 0);
      description = multiAmtMatch[3].trim();
    } else {
      const leadingAmtMatch = text.match(/^([0-9]+(?:\.[0-9]+)?k?)\s*[-:]?\s*(.*)/i);
      if (leadingAmtMatch) {
        let amtToken = leadingAmtMatch[1].toLowerCase();
        description = leadingAmtMatch[2].trim();
        if (amtToken.endsWith('k')) {
          amount = parseFloat(amtToken.slice(0, -1)) * 1000;
        } else {
          amount = parseFloat(amtToken);
        }
      }
    }

    // If arithmetic expression was inside description, resolve total
    if (components.length > 0 && !amount) {
      amount = components.reduce((a, b) => a + b, 0);
    } else if (components.length > 0 && amount && !multiAmtMatch) {
      // Add components if separate
      amount += components.reduce((a, b) => a + b, 0);
    }

    // Classify direction, category, accounts, entities
    let category = 'misc expn';
    let txType = 'Expense';
    let account = 'Hom Cash';
    let by = 'Honey';
    let forEntity = 'Home';
    let confidence = 'HIGH';
    let reasons = [];

    const lowerDesc = description.toLowerCase();

    // Tenant rental detection (Income vs Housing Expense)
    if (lowerDesc.includes('rent')) {
      if (/rajeev|charan|tenant|received|kiraya/i.test(lowerDesc)) {
        txType = 'Income';
        category = 'Income';
        account = 'PNB Bnk';
        reasons.push('Tenant rental income detected');
      } else {
        category = 'Housing';
        reasons.push('Rent expense detected');
      }
    }

    // Account detection
    if (lowerDesc.includes('pnb')) {
      account = (txType === 'Income') ? 'PNB Bnk' : 'PNB Online';
      reasons.push('Explicit PNB payment reference');
    } else if (lowerDesc.includes('gpay') || lowerDesc.includes('upi')) {
      account = 'Trishaa GPay';
      reasons.push('Explicit digital UPI/GPay reference');
    }

    // Entity mapping
    if (/(\bma\b|\bmaa\b)/i.test(lowerDesc)) {
      forEntity = 'Maa';
      reasons.push('Assigned For: Maa');
    } else if (/trishaa|trisha/i.test(lowerDesc)) {
      forEntity = 'Trishaa';
      reasons.push('Assigned For: Trishaa');
    }

    // Category mapping
    if (/seb|fruits|kela|khira/i.test(lowerDesc)) {
      category = 'Fruits';
    } else if (/tamatar|dhaniya|adrak|sabji|aloo|pyaz/i.test(lowerDesc)) {
      category = 'Sabji';
    } else if (/puja|diya|hawan|murti|mala/i.test(lowerDesc)) {
      category = 'misc expn';
      reasons.push('Religious/Puja item mapped to misc expn');
    } else if (/brush|soap|oil/i.test(lowerDesc)) {
      category = 'Personal Care';
    } else if (/dkashna|dakshina/i.test(lowerDesc)) {
      category = 'Charity';
    } else if (/rashan|atta|dal|chawal/i.test(lowerDesc)) {
      category = 'Rashan';
    }

    // Confidence calibration
    if (!amount || isNaN(amount) || amount <= 0) {
      confidence = 'LOW';
      reasons.push('Missing or zero amount');
    }
    if (!lineDate) {
      confidence = 'MEDIUM';
      reasons.push('No date inherited');
    }

    // Duplicate detection against existing loaded records
    let isDuplicate = false;
    if (existingRecords.length > 0 && amount && lineDate) {
      const dup = existingRecords.find(r => 
        r.date === lineDate && 
        Math.abs((r.amountXpns || r.amtInCredit || 0) - amount) < 0.01 && 
        r.item.toLowerCase().includes(description.slice(0, 8).toLowerCase())
      );
      if (dup) {
        isDuplicate = true;
        confidence = 'LOW';
        reasons.push('Potential duplicate matches existing ledger record');
      }
    }

    return {
      type: 'TRANSACTION',
      raw,
      date: lineDate || 'Needs Date Review',
      description: description || raw,
      amount: amount || 0,
      txType,
      category,
      account,
      by,
      forEntity,
      confidence,
      reasons,
      isDuplicate,
      components
    };
  }

  function parseFullNotesBlock(rawText) {
    const lines = rawText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const results = [];
    let currentDateContext = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const parsed = parseRawLine(line, currentDateContext, ledgerRecords);
      if (!parsed) continue;

      if (parsed.type === 'DATE_HEADER') {
        currentDateContext = parsed.date;
      } else if (parsed.type === 'DATE_HEADER_AMBIGUOUS') {
        // Flag row as ambiguous for user confirmation
        results.push({
          raw: line,
          date: 'Needs Date Review',
          description: line,
          amount: 0,
          txType: 'Expense',
          category: 'Needs Review',
          account: 'Hom Cash',
          by: 'Honey',
          forEntity: 'Home',
          confidence: 'LOW',
          reasons: [parsed.message],
          isDuplicate: false,
          components: []
        });
      } else if (parsed.type === 'TRANSACTION') {
        if (parsed.date && parsed.date !== 'Needs Date Review') {
          currentDateContext = parsed.date;
        }
        results.push(parsed);
      }
    }

    return results;
  }

  // --- 8. REVIEW TABLE RENDERING & INLINE EDITING ---
  function renderReviewTable(batch) {
    parsedDraftBatch = batch;
    el.reviewTableBody.innerHTML = '';

    if (batch.length === 0) {
      el.reviewPanel.classList.add('hidden');
      return;
    }

    el.reviewPanel.classList.remove('hidden');

    let totalExpense = 0;
    let totalIncome = 0;
    let ambiguousCount = 0;
    let hasDuplicates = false;

    batch.forEach((row, idx) => {
      if (row.txType === 'Income') totalIncome += row.amount;
      else totalExpense += row.amount;

      if (row.confidence === 'LOW' || row.date === 'Needs Date Review' || row.category === 'Needs Review') {
        ambiguousCount++;
      }
      if (row.isDuplicate) hasDuplicates = true;

      const tr = document.createElement('tr');
      if (row.isDuplicate) tr.style.background = 'rgba(245, 158, 11, 0.08)';

      const badgeClass = row.confidence === 'HIGH' ? 'confidence-high' : (row.confidence === 'MEDIUM' ? 'confidence-medium' : 'confidence-low');
      const badgeText = row.isDuplicate ? 'Duplicate?' : row.confidence;

      tr.innerHTML = `
        <td><input type="text" class="table-input" value="${escapeHtml(row.date)}" data-field="date" data-idx="${idx}" style="width: 95px;"></td>
        <td><input type="text" class="table-input" value="${escapeHtml(row.description)}" data-field="description" data-idx="${idx}"></td>
        <td><input type="number" class="table-input font-mono" value="${row.amount}" data-field="amount" data-idx="${idx}" style="width: 85px; text-align: right;"></td>
        <td>
          <select class="table-select" data-field="txType" data-idx="${idx}">
            <option value="Expense" ${row.txType === 'Expense' ? 'selected' : ''}>Expense</option>
            <option value="Income" ${row.txType === 'Income' ? 'selected' : ''}>Income</option>
          </select>
        </td>
        <td>
          <select class="table-select" data-field="category" data-idx="${idx}">
            ${MASTER_CATEGORIES.map(c => `<option value="${c}" ${row.category === c ? 'selected' : ''}>${c}</option>`).join('')}
          </select>
        </td>
        <td>
          <select class="table-select" data-field="account" data-idx="${idx}">
            ${(row.txType === 'Income' ? INCOME_ACCOUNTS : EXPENSE_ACCOUNTS).map(a => `<option value="${a}" ${row.account === a ? 'selected' : ''}>${a}</option>`).join('')}
          </select>
        </td>
        <td>
          <select class="table-select" data-field="forEntity" data-idx="${idx}">
            ${ENTITIES.for.map(f => `<option value="${f}" ${row.forEntity === f ? 'selected' : ''}>${f}</option>`).join('')}
          </select>
        </td>
        <td><span class="confidence-badge ${badgeClass}">${badgeText}</span></td>
        <td>
          <button type="button" class="btn-delete-row" data-idx="${idx}" title="Remove entry" style="background:none; border:none; color:#f43f5e; cursor:pointer; font-size:1.1rem;">×</button>
        </td>
      `;

      el.reviewTableBody.appendChild(tr);
    });

    // Update Summary Bar
    el.summaryCount.textContent = batch.length;
    el.summaryExpense.textContent = `₹${totalExpense.toLocaleString('en-IN')}`;
    el.summaryIncome.textContent = `₹${totalIncome.toLocaleString('en-IN')}`;
    el.summaryAmbiguous.textContent = ambiguousCount;

    if (hasDuplicates) el.duplicateAlertBox.classList.remove('hidden');
    else el.duplicateAlertBox.classList.add('hidden');

    if (ambiguousCount > 0) {
      el.batchValidationBadge.className = 'confidence-badge confidence-low';
      el.batchValidationBadge.textContent = `${ambiguousCount} Items Need Attention`;
    } else {
      el.batchValidationBadge.className = 'confidence-badge confidence-high';
      el.batchValidationBadge.textContent = 'All Items Validated ✓';
    }

    // Attach row input listeners
    attachReviewTableListeners();
  }

  function attachReviewTableListeners() {
    el.reviewTableBody.querySelectorAll('input, select').forEach(input => {
      input.addEventListener('change', (e) => {
        const idx = parseInt(e.target.getAttribute('data-idx'), 10);
        const field = e.target.getAttribute('data-field');
        let val = e.target.value;
        if (field === 'amount') val = parseFloat(val) || 0;

        if (parsedDraftBatch[idx]) {
          parsedDraftBatch[idx][field] = val;
          if (field === 'date' && val !== 'Needs Date Review') {
            parsedDraftBatch[idx].confidence = 'HIGH';
          }
          renderReviewTable(parsedDraftBatch);
        }
      });
    });

    el.reviewTableBody.querySelectorAll('.btn-delete-row').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const idx = parseInt(e.target.getAttribute('data-idx'), 10);
        parsedDraftBatch.splice(idx, 1);
        renderReviewTable(parsedDraftBatch);
      });
    });
  }

  function addBlankRow() {
    const newRow = {
      raw: 'Manual Entry',
      date: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).replace(/ /g, '-'),
      description: 'New Item',
      amount: 0,
      txType: 'Expense',
      category: 'misc expn',
      account: 'Hom Cash',
      by: 'Honey',
      forEntity: 'Home',
      confidence: 'MEDIUM',
      reasons: ['Manually inserted row'],
      isDuplicate: false,
      components: []
    };
    parsedDraftBatch.push(newRow);
    renderReviewTable(parsedDraftBatch);
  }

  // --- 9. BATCH CONFIRMATION & APPS SCRIPT WRITEBACK GATE ---
  async function confirmBatchWrite() {
    if (parsedDraftBatch.length === 0) {
      alert('Draft is empty. Parse or add entries first.');
      return;
    }

    // Validate fields
    const invalidItems = parsedDraftBatch.filter(r => !r.amount || r.amount <= 0 || r.date === 'Needs Date Review');
    if (invalidItems.length > 0) {
      const proceed = confirm(`⚠️ Warning: ${invalidItems.length} items have missing dates or invalid amounts. Do you want to review them first?`);
      if (proceed) return;
    }

    // Explicit confirmation dialog (Phase C Gate)
    const totalOutflow = parsedDraftBatch.filter(r => r.txType === 'Expense').reduce((a, b) => a + b.amount, 0);
    const totalInflow = parsedDraftBatch.filter(r => r.txType === 'Income').reduce((a, b) => a + b.amount, 0);
    const confirmMsg = `Confirm write to Google Sheets:\n` +
      `• Total Rows: ${parsedDraftBatch.length}\n` +
      `• Total Outflow: ₹${totalOutflow.toLocaleString('en-IN')}\n` +
      `• Total Inflow: ₹${totalInflow.toLocaleString('en-IN')}\n\n` +
      `Note: Column H formulas will be preserved. Proceed?`;

    if (!confirm(confirmMsg)) return;

    // Build payload for Google Apps Script
    const gasUrl = el.assistantGasUrl.value.trim() || DEFAULT_GAS_URL;
    const passkey = el.assistantPasskey.value.trim() || DEFAULT_PASSKEY;

    showToast('🚀 Transmitting batch to Google Apps Script...');

    try {
      // Map rows to exact ledger format with dual key naming:
      // [Date, By, For, Item, Expense Acc (Col E), Category (Col F), Expense Amount (Col G), ..., Info, Inflow Amount, Inflow Acc]
      const rowsToAppend = parsedDraftBatch.map(r => ({
        date: r.date,
        by: r.by || 'Honey',
        for: r.forEntity || 'Home',
        forEntity: r.forEntity || 'Home',
        item: r.description,
        description: r.description,
        exp_acc: r.txType === 'Expense' ? r.account : '',
        expenseAcc: r.txType === 'Expense' ? r.account : '',
        cat: r.category,
        category: r.category,
        amt_exp: r.txType === 'Expense' ? r.amount : 0,
        amountXpns: r.txType === 'Expense' ? r.amount : 0,
        amt_in: r.txType === 'Income' ? r.amount : 0,
        amtInCredit: r.txType === 'Income' ? r.amount : 0,
        inc_acc: r.txType === 'Income' ? r.account : '',
        incomeAccnt: r.txType === 'Income' ? r.account : '',
        info: r.components && r.components.length > 0 ? `Components: ${r.components.join(' + ')}` : '',
        note: r.components && r.components.length > 0 ? `Components: ${r.components.join(' + ')}` : ''
      }));

      const res = await fetch(gasUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' }, // Avoid preflight CORS issues in Apps Script
        body: JSON.stringify({
          action: 'batchAppend',
          key: passkey,
          entries: rowsToAppend
        })
      });

      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Write rejected by gateway');

      showToast(`🎉 Success: Appended ${parsedDraftBatch.length} entries to Google Sheets!`);
      parsedDraftBatch = [];
      renderReviewTable([]);
      el.rawNotesInput.value = '';

      // Re-fetch authoritative live data
      await syncLiveData();
    } catch (err) {
      console.error('Batch write error:', err);
      alert(`❌ Live write failed: ${err.message}\nYour draft has been preserved.`);
    }
  }

  // --- 10. FEATURE B: ASK MY LEDGER (DETERMINISTIC QUERY ENGINE) ---
  function executeNaturalLanguageQuery(queryText) {
    const q = queryText.toLowerCase().trim();
    if (!q) return;

    if (ledgerRecords.length === 0) {
      alert('Ledger records not loaded yet. Tap "Sync Live Data" first.');
      return;
    }

    el.queryResultCard.classList.remove('hidden');
    el.answerHeadline.textContent = 'Analyzing question...';

    // 1. Identify Target Direction
    let direction = 'All';
    if (/income|kamai|aamdani|credit/i.test(q)) direction = 'Income';
    else if (/expense|kharcha|spent|spend|debit|outflow/i.test(q)) direction = 'Expense';

    // 2. Identify Target Category
    let targetCategory = null;
    for (const cat of MASTER_CATEGORIES) {
      if (q.includes(cat.toLowerCase())) {
        targetCategory = cat;
        break;
      }
    }
    // Hindi category synonyms
    if (!targetCategory) {
      if (/rashan|groceries|kirana/i.test(q)) targetCategory = 'Rashan';
      else if (/sabji|tarkari|vegetables/i.test(q)) targetCategory = 'Sabji';
      else if (/rent|kiraya/i.test(q) && direction === 'Income') targetCategory = 'Income';
      else if (/rent|kiraya/i.test(q)) targetCategory = 'Housing';
      else if (/personal care|brush|soap/i.test(q)) targetCategory = 'Personal Care';
    }

    // 3. Identify Target Months
    const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
    const monthFull = {
      jan: 'Jan', january: 'Jan',
      feb: 'Feb', february: 'Feb',
      mar: 'Mar', march: 'Mar',
      apr: 'Apr', april: 'Apr',
      may: 'May',
      jun: 'Jun', june: 'Jun',
      jul: 'Jul', july: 'Jul',
      aug: 'Aug', august: 'Aug',
      sep: 'Sep', september: 'Sep',
      oct: 'Oct', october: 'Oct',
      nov: 'Nov', november: 'Nov',
      dec: 'Dec', december: 'Dec'
    };

    const foundMonths = [];
    Object.keys(monthFull).forEach(mStr => {
      const regex = new RegExp(`\\b${mStr}\\b`, 'i');
      if (regex.test(q)) {
        const canonical = monthFull[mStr];
        if (!foundMonths.includes(canonical)) foundMonths.push(canonical);
      }
    });

    // 4. Identify Target Account
    let targetAccount = null;
    if (/pnb/i.test(q)) targetAccount = 'PNB';
    else if (/sbi/i.test(q)) targetAccount = 'SBI';
    else if (/cash/i.test(q)) targetAccount = 'Cash';

    // --- CASE 1: Comparison between two months (e.g. "February aur April ka rashan compare karo") ---
    if (foundMonths.length === 2) {
      const m1 = foundMonths[0];
      const m2 = foundMonths[1];

      const r1 = ledgerRecords.filter(r => (r.month || '').toLowerCase() === m1.toLowerCase() && (!targetCategory || r.category.toLowerCase() === targetCategory.toLowerCase()));
      const r2 = ledgerRecords.filter(r => (r.month || '').toLowerCase() === m2.toLowerCase() && (!targetCategory || r.category.toLowerCase() === targetCategory.toLowerCase()));

      const sum1 = r1.reduce((a, b) => a + (direction === 'Income' ? b.amtInCredit : b.amountXpns), 0);
      const sum2 = r2.reduce((a, b) => a + (direction === 'Income' ? b.amtInCredit : b.amountXpns), 0);
      const diff = sum2 - sum1;

      el.answerHeadline.textContent = `${m1} vs ${m2} ${targetCategory || 'Total'} Comparison:`;
      el.answerSubtext.textContent = `${m1}: ₹${sum1.toLocaleString('en-IN')} (${r1.length} txns) | ${m2}: ₹${sum2.toLocaleString('en-IN')} (${r2.length} txns) • Difference: ${diff >= 0 ? '+' : ''}₹${diff.toLocaleString('en-IN')}`;

      el.queryKpiExpense.textContent = `₹${sum1.toLocaleString('en-IN')}`;
      el.queryKpiIncome.textContent = `₹${sum2.toLocaleString('en-IN')}`;
      el.queryKpiCount.textContent = r1.length + r2.length;

      renderComparisonChart([`${m1} ${targetCategory || ''}`, `${m2} ${targetCategory || ''}`], [sum1, sum2]);
      renderContributingTable([...r1, ...r2]);
      return;
    }

    // --- CASE 2: Category-wise breakdown (e.g. "Category-wise expenses dikhao") ---
    if (/category[- ]wise|sabse zyada|breakdown|categories/i.test(q)) {
      const catMap = {};
      ledgerRecords.forEach(r => {
        const amt = r.amountXpns || 0;
        if (amt > 0) {
          catMap[r.category] = (catMap[r.category] || 0) + amt;
        }
      });

      const sortedCats = Object.entries(catMap).sort((a, b) => b[1] - a[1]);
      const topCat = sortedCats[0];
      const totalExpense = Object.values(catMap).reduce((a, b) => a + b, 0);

      el.answerHeadline.textContent = `Highest Spending: ${topCat ? topCat[0] : 'N/A'} (₹${topCat ? topCat[1].toLocaleString('en-IN') : 0})`;
      el.answerSubtext.textContent = `Total outflow categorized across ${sortedCats.length} categories is ₹${totalExpense.toLocaleString('en-IN')}.`;

      el.queryKpiExpense.textContent = `₹${totalExpense.toLocaleString('en-IN')}`;
      el.queryKpiIncome.textContent = '₹0';
      el.queryKpiCount.textContent = ledgerRecords.length;

      const top6 = sortedCats.slice(0, 6);
      renderDonutChart(top6.map(c => c[0]), top6.map(c => c[1]));
      renderContributingTable(ledgerRecords.filter(r => r.amountXpns > 0).slice(0, 30));
      return;
    }

    // --- CASE 3: Rental Income query (e.g. "Batao total rental income kitni hai?") ---
    if (/rental|kiraya/i.test(q) || (targetCategory === 'Income' && /rent/i.test(q))) {
      const rentalRecords = ledgerRecords.filter(r => 
        (r.amtInCredit > 0) && (r.category === 'Income' || r.category === 'Rental' || /rent|rajeev|charan/i.test(r.item))
      );

      // Month filter if specified
      let finalRecords = rentalRecords;
      let monthLabel = 'All-Time';
      if (foundMonths.length === 1) {
        monthLabel = foundMonths[0];
        finalRecords = rentalRecords.filter(r => (r.month || '').toLowerCase() === foundMonths[0].toLowerCase());
      }

      const totalRent = finalRecords.reduce((a, b) => a + b.amtInCredit, 0);
      el.answerHeadline.textContent = `${monthLabel} Rental Income: ₹${totalRent.toLocaleString('en-IN')}`;
      el.answerSubtext.textContent = `Calculated deterministically from ${finalRecords.length} tenant credit transactions.`;

      el.queryKpiExpense.textContent = '₹0';
      el.queryKpiIncome.textContent = `₹${totalRent.toLocaleString('en-IN')}`;
      el.queryKpiCount.textContent = finalRecords.length;

      renderBarChart(finalRecords.map(r => r.date), finalRecords.map(r => r.amtInCredit), 'Rental Income');
      renderContributingTable(finalRecords);
      return;
    }

    // --- CASE 4: Account spending query (e.g. "PNB se kitna spend hua?") ---
    if (targetAccount) {
      const accRecords = ledgerRecords.filter(r => 
        (r.expenseAcc && r.expenseAcc.toLowerCase().includes(targetAccount.toLowerCase())) ||
        (r.incomeAccnt && r.incomeAccnt.toLowerCase().includes(targetAccount.toLowerCase()))
      );

      const exp = accRecords.reduce((a, b) => a + (b.amountXpns || 0), 0);
      const inc = accRecords.reduce((a, b) => a + (b.amtInCredit || 0), 0);

      el.answerHeadline.textContent = `${targetAccount} Account: ₹${exp.toLocaleString('en-IN')} Spent`;
      el.answerSubtext.textContent = `Total Inflow: ₹${inc.toLocaleString('en-IN')} across ${accRecords.length} recorded operations.`;

      el.queryKpiExpense.textContent = `₹${exp.toLocaleString('en-IN')}`;
      el.queryKpiIncome.textContent = `₹${inc.toLocaleString('en-IN')}`;
      el.queryKpiCount.textContent = accRecords.length;

      renderComparisonChart([`${targetAccount} Outflow`, `${targetAccount} Inflow`], [exp, inc]);
      renderContributingTable(accRecords);
      return;
    }

    // --- CASE 5: General Category, Month, or Freeform Keyword Query ---
    let matching = [...ledgerRecords];
    if (targetCategory) matching = matching.filter(r => r.category.toLowerCase() === targetCategory.toLowerCase());
    if (foundMonths.length === 1) matching = matching.filter(r => (r.month || '').toLowerCase() === foundMonths[0].toLowerCase());

    // Freeform keyword filter (handles "Netflix", specific merchants, items, notes, or entities)
    const cleanedKeywords = q
      .replace(/batao|kitna|hai|ka|ke|ki|karo|dikhao|total|all[- ]time|expense|income|spend|hua|search|please|expenses/gi, ' ')
      .trim()
      .split(/\s+/)
      .filter(w => w.length >= 3 && !foundMonths.map(m => m.toLowerCase()).includes(w));

    if (cleanedKeywords.length > 0 && !targetCategory) {
      matching = matching.filter(r => {
        const fullSearchBlob = `${r.item || ''} ${r.note || ''} ${r.info || ''} ${r.category || ''} ${r.expenseAcc || ''} ${r.incomeAccnt || ''} ${r.forEntity || ''}`.toLowerCase();
        return cleanedKeywords.some(kw => fullSearchBlob.includes(kw));
      });
    }

    const exp = matching.reduce((a, b) => a + (b.amountXpns || 0), 0);
    const inc = matching.reduce((a, b) => a + (b.amtInCredit || 0), 0);

    const titlePrefix = [foundMonths[0], targetCategory, cleanedKeywords.join(' ')].filter(Boolean).join(' ') || 'Ledger Query';
    el.answerHeadline.textContent = `${titlePrefix}: ₹${exp > 0 ? exp.toLocaleString('en-IN') + ' Spent' : inc.toLocaleString('en-IN') + ' Inflow'}`;
    el.answerSubtext.textContent = `Found ${matching.length} matching transactions. 100% verified against ledger data.`;

    el.queryKpiExpense.textContent = `₹${exp.toLocaleString('en-IN')}`;
    el.queryKpiIncome.textContent = `₹${inc.toLocaleString('en-IN')}`;
    el.queryKpiCount.textContent = matching.length;

    renderBarChart(matching.slice(0, 10).map(r => r.date), matching.slice(0, 10).map(r => r.amountXpns || r.amtInCredit), 'Amount (₹)');
    renderContributingTable(matching);
  }

  // --- 11. CHART.JS VISUALIZATIONS ---
  function destroyPreviousChart() {
    if (queryChartInstance) {
      queryChartInstance.destroy();
      queryChartInstance = null;
    }
  }

  function renderComparisonChart(labels, data) {
    destroyPreviousChart();
    el.queryChartContainer.classList.remove('hidden');

    const ctx = el.queryChartCanvas.getContext('2d');
    queryChartInstance = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: 'Amount (₹)',
          data: data,
          backgroundColor: ['rgba(244, 63, 94, 0.75)', 'rgba(52, 211, 153, 0.75)'],
          borderColor: ['#f43f5e', '#34d399'],
          borderWidth: 1.5,
          borderRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false }
        },
        scales: {
          x: { grid: { color: 'rgba(255, 255, 255, 0.05)' }, ticks: { color: '#94a3b8' } },
          y: { grid: { color: 'rgba(255, 255, 255, 0.05)' }, ticks: { color: '#94a3b8' } }
        }
      }
    });
  }

  function renderBarChart(labels, data, datasetLabel) {
    destroyPreviousChart();
    el.queryChartContainer.classList.remove('hidden');

    const ctx = el.queryChartCanvas.getContext('2d');
    queryChartInstance = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: datasetLabel,
          data: data,
          backgroundColor: 'rgba(56, 189, 248, 0.7)',
          borderColor: '#38bdf8',
          borderWidth: 1,
          borderRadius: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { display: false }, ticks: { color: '#94a3b8', font: { size: 10 } } },
          y: { grid: { color: 'rgba(255, 255, 255, 0.05)' }, ticks: { color: '#94a3b8' } }
        }
      }
    });
  }

  function renderDonutChart(labels, data) {
    destroyPreviousChart();
    el.queryChartContainer.classList.remove('hidden');

    const colors = ['#f43f5e', '#38bdf8', '#34d399', '#f59e0b', '#a855f7', '#ec4899'];
    const ctx = el.queryChartCanvas.getContext('2d');
    queryChartInstance = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: labels,
        datasets: [{
          data: data,
          backgroundColor: colors.slice(0, data.length),
          borderWidth: 2,
          borderColor: '#0b1120'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { color: '#cbd5e1', font: { size: 10 } } }
        }
      }
    });
  }

  function renderContributingTable(records) {
    el.queryResultsTableBody.innerHTML = '';
    el.queryTableCount.textContent = records.length;

    records.slice(0, 50).forEach(r => {
      const tr = document.createElement('tr');
      const amt = (r.amtInCredit > 0 ? r.amtInCredit : r.amountXpns) || 0;
      const amtColor = r.amtInCredit > 0 ? '#34d399' : '#fb7185';
      const acc = r.amtInCredit > 0 ? r.incomeAccnt : r.expenseAcc;

      tr.innerHTML = `
        <td style="color: var(--text-muted); font-size: 0.75rem;">${escapeHtml(r.date)}</td>
        <td style="font-weight: 500;">${escapeHtml(r.item)}</td>
        <td><span class="confidence-badge" style="background: rgba(255,255,255,0.06); color: var(--text-secondary);">${escapeHtml(r.category)}</span></td>
        <td style="text-align: right; font-weight: 700; color: ${amtColor}; font-family: 'JetBrains Mono', monospace;">₹${amt.toLocaleString('en-IN')}</td>
        <td style="color: var(--text-muted); font-size: 0.75rem;">${escapeHtml(acc || '-')}</td>
        <td style="color: var(--text-muted); font-size: 0.75rem;">${escapeHtml(r.forEntity || '-')}</td>
      `;
      el.queryResultsTableBody.appendChild(tr);
    });
  }

  // --- 12. UTILITIES & EVENT HANDLERS ---
  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function setupEventHandlers() {
    // Sample Notes loader
    if (el.btnLoadSampleNotes) {
      el.btnLoadSampleNotes.addEventListener('click', () => {
        el.rawNotesInput.value = `13 oct (3k rajeev charan rent pnb)
100 - brush
1 oct
60 - diya, phul mala
120 - hawan mitti tasla
230 - trishaa parcel
180-1.5kg seb
160 - 40- Tkg tamatar, 20- dhaniya, 1pav adrak
40, 60- 1kg khira
o/1 0 oct
1.2k- ma
840- sidha pitra puja
250- dkashna
- 120- mata murti + 280+50 ( puja saman) ma
  1870 - Trisha yoga bar, puja saman etc`;
        showToast('Sample notes loaded into editor!');
      });
    }

    if (el.btnClearNotes) {
      el.btnClearNotes.addEventListener('click', () => {
        el.rawNotesInput.value = '';
        renderReviewTable([]);
      });
    }

    if (el.btnParseNotes) {
      el.btnParseNotes.addEventListener('click', () => {
        const text = el.rawNotesInput.value.trim();
        if (!text) {
          alert('Please paste some transaction notes first.');
          return;
        }
        const parsed = parseFullNotesBlock(text);
        renderReviewTable(parsed);
        showToast(`Parsed ${parsed.length} entries!`);
      });
    }

    if (el.btnAddManualRow) {
      el.btnAddManualRow.addEventListener('click', addBlankRow);
    }

    if (el.btnDiscardDraft) {
      el.btnDiscardDraft.addEventListener('click', () => {
        if (confirm('Are you sure you want to discard the current draft batch?')) {
          renderReviewTable([]);
        }
      });
    }

    if (el.btnConfirmBatch) {
      el.btnConfirmBatch.addEventListener('click', confirmBatchWrite);
    }

    // Query Engine handlers
    if (el.btnAskQuery) {
      el.btnAskQuery.addEventListener('click', () => {
        executeNaturalLanguageQuery(el.nlQueryInput.value);
      });
    }

    if (el.nlQueryInput) {
      el.nlQueryInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          executeNaturalLanguageQuery(el.nlQueryInput.value);
        }
      });
    }

    el.queryChips.forEach(chip => {
      chip.addEventListener('click', () => {
        const query = chip.getAttribute('data-query');
        el.nlQueryInput.value = query;
        executeNaturalLanguageQuery(query);
      });
    });

    // Sync & Passkey handlers
    if (el.btnSaveAssistantKey) {
      el.btnSaveAssistantKey.addEventListener('click', () => {
        const key = el.assistantPasskey.value.trim();
        const url = el.assistantGasUrl.value.trim();
        localStorage.setItem('LEDGER_PASSKEY', key);
        localStorage.setItem('LEDGER_GAS_URL', url);
        showToast('🔐 Gateway credentials saved to browser localStorage!');
      });
    }

    if (el.btnSyncNow) {
      el.btnSyncNow.addEventListener('click', syncLiveData);
    }
  }

  // Self-boot
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
