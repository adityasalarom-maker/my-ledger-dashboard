/**
 * LEDGER INTELLIGENCE ASSISTANT v2.0
 * Natural-Language Entry + Financial Query Engine + Security
 * 
 * Standalone client application: Zero modification of existing core calculations.
 * Zero token overhead against Gemini AI limits (100% deterministic local JS parsing & analytics).
 */

(function () {
  'use strict';

  // --- 1. REGISTER SERVICE WORKER FOR ANDROID PWA INSTALLATION ---
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch(err => console.log('SW register error:', err));
    });
  }

  // --- 2. MASTER TAXONOMIES & VOCABULARIES ---
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
  const LEDGER_SHEET_ID = '1uocVkm6qYpuM6zxhv2Hs8tHM-OthlTSOdxBZiRDWziE';

  // --- 3. APPLICATION STATE ---
  let ledgerRecords = [];
  let parsedDraftBatch = [];
  let queryChartInstance = null;
  let activeCategoryFilter = null;
  let currentReviewFilter = 'ALL'; // 'ALL' or 'ATTENTION'
  let currentHistoryFilter = 'ALL'; // 'ALL', 'HOURLY', 'DAILY'
  let lastQueryContributingRecords = [];

  // --- 4. DOM ELEMENT REFERENCES ---
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
    btnFilterAllRows: document.getElementById('btnFilterAllRows'),
    btnFilterAttentionRows: document.getElementById('btnFilterAttentionRows'),
    pillCountAll: document.getElementById('pillCountAll'),
    pillCountAttention: document.getElementById('pillCountAttention'),
    duplicateAlertBox: document.getElementById('duplicateAlertBox'),
    reviewTableBody: document.getElementById('reviewTableBody'),
    btnAddManualRow: document.getElementById('btnAddManualRow'),
    btnDiscardDraft: document.getElementById('btnDiscardDraft'),
    btnConfirmBatch: document.getElementById('btnConfirmBatch'),
    nlQueryInput: document.getElementById('nlQueryInput'),
    btnClearNlQuery: document.getElementById('btnClearNlQuery'),
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
    queryDonutCategoryPanel: document.getElementById('queryDonutCategoryPanel'),
    queryCatBreakdownGrid: document.getElementById('queryCatBreakdownGrid'),
    btnClearCatFilter: document.getElementById('btnClearCatFilter'),
    activeGridFilterLabel: document.getElementById('activeGridFilterLabel'),
    queryResultsTableBody: document.getElementById('queryResultsTableBody'),
    queryTableCount: document.getElementById('queryTableCount'),
    queryHistoryCount: document.getElementById('queryHistoryCount'),
    queryHistoryList: document.getElementById('queryHistoryList'),
    btnCopyQueryHistory: document.getElementById('btnCopyQueryHistory'),
    btnClearQueryHistory: document.getElementById('btnClearQueryHistory'),
    btnHistFilterAll: document.getElementById('btnHistFilterAll'),
    btnHistFilterHourly: document.getElementById('btnHistFilterHourly'),
    btnHistFilterDaily: document.getElementById('btnHistFilterDaily'),
    histCountAll: document.getElementById('histCountAll'),
    historyActiveViewLabel: document.getElementById('historyActiveViewLabel'),
    assistantGasUrl: document.getElementById('assistantGasUrl'),
    assistantPasskey: document.getElementById('assistantPasskey'),
    btnSaveAssistantKey: document.getElementById('btnSaveAssistantKey'),
    btnSyncNow: document.getElementById('btnSyncNow'),
    syncStatusSubtitle: document.getElementById('syncStatusSubtitle'),
    toast: document.getElementById('assistantToast')
  };

  // --- 5. INITIALIZATION ---
  function init() {
    setupTabNavigation();
    loadSavedSettings();
    loadLedgerData();
    setupEventHandlers();
    renderQueryHistory();
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
    const savedUrl = localStorage.getItem('gas_webapp_url') || localStorage.getItem('LEDGER_GAS_URL');
    if (savedUrl && el.assistantGasUrl) el.assistantGasUrl.value = savedUrl;
    const savedKey = localStorage.getItem('ledger_auth_key') || localStorage.getItem('LEDGER_PASSKEY');
    if (savedKey && el.assistantPasskey) el.assistantPasskey.value = savedKey;
  }

  function showToast(message, duration = 3000) {
    if (!el.toast) return;
    el.toast.textContent = message;
    el.toast.classList.remove('hidden');
    setTimeout(() => el.toast.classList.add('hidden'), duration);
  }

  // Dynamic Array Taxonomies Merge (Learned from ARRAY Tab)
  function mergeTaxonomies(arrayTab) {
    if (!arrayTab || typeof arrayTab !== 'object') return;
    const catList = arrayTab['Category'] || arrayTab['Cat'] || arrayTab['Categories'] || [];
    if (Array.isArray(catList)) {
      catList.forEach(c => {
        const trimmed = String(c).trim();
        if (trimmed && !MASTER_CATEGORIES.includes(trimmed)) {
          MASTER_CATEGORIES.push(trimmed);
        }
      });
    }
  }

  // --- 6. DATA INGESTION & SHARED LOCAL CACHE ---
  function loadLedgerData() {
    // 1. Primary Check: Shared mobile dashboard cache (sheet2)
    let rawList = null;
    const cachedSheet2 = localStorage.getItem('cached_ledger_sheet2');
    const cachedV2 = localStorage.getItem('LEDGER_DATA_CACHE_V2');
    const cachedSheet1 = localStorage.getItem('cached_ledger_sheet1');
    const cachedV1 = localStorage.getItem('LEDGER_ENCRYPTED_CACHE_V1');

    if (cachedSheet2) {
      try { rawList = JSON.parse(cachedSheet2); } catch(e) {}
    } else if (cachedV2) {
      try { rawList = JSON.parse(cachedV2); } catch(e) {}
    } else if (cachedSheet1) {
      try { rawList = JSON.parse(cachedSheet1); } catch(e) {}
    } else if (cachedV1) {
      try { rawList = JSON.parse(cachedV1); } catch(e) {}
    }

    // Merge cached ARRAY tab taxonomies
    const cachedArrays = localStorage.getItem('cached_array_taxonomies');
    if (cachedArrays) {
      try { mergeTaxonomies(JSON.parse(cachedArrays)); } catch(e) {}
    }

    if (Array.isArray(rawList) && rawList.length > 5) {
      ledgerRecords = normalizeRecords(rawList);
      updateSyncSubtitle(ledgerRecords.length, 'Loaded from secure local cache');
      return;
    }

    // 2. Fallback template data (5 rows)
    if (window.LEDGER_DATA && Array.isArray(window.LEDGER_DATA)) {
      ledgerRecords = normalizeRecords(window.LEDGER_DATA);
      updateSyncSubtitle(ledgerRecords.length, 'Loaded from fallback template');
    } else {
      updateSyncSubtitle(0, 'No local records loaded. Connecting live...');
    }

    // Automatically trigger live sync in background if only template is present!
    syncLiveData();
  }

  function normalizeRecords(rawList) {
    return rawList.map(r => {
      const amtExp = parseFloat(r.amt_exp !== undefined ? r.amt_exp : (r.amountXpns !== undefined ? r.amountXpns : (r.type === 'Expense' ? r.amount : 0)) || 0);
      const amtIn = parseFloat(r.amt_in !== undefined ? r.amt_in : (r.amtInCredit !== undefined ? r.amtInCredit : (r.type === 'Income' ? r.amount : 0)) || 0);
      const desc = r.item || r.item_description || r.description || '';
      const date = r.date || '';

      // Clean and robust month extraction (resolves #REF! or empty values from sheet)
      let month = String(r.month || '').trim();
      if (!month || month.startsWith('#') || month.length > 5) {
        if (date) {
          const m = String(date).match(/[a-zA-Z]{3}/);
          if (m) month = m[0];
        }
      }
      if (month && month.length >= 3) {
        month = month.charAt(0).toUpperCase() + month.slice(1, 3).toLowerCase();
      }

      return {
        date: date,
        month: month,
        by: r.by || 'Honey',
        forEntity: r.for || r.forEntity || 'Home',
        item: desc,
        category: r.cat || r.category || 'misc expn',
        amountXpns: amtExp,
        amtInCredit: amtIn,
        expenseAcc: r.exp_acc || r.expenseAcc || r.account || '',
        incomeAccnt: r.inc_acc || r.incomeAccnt || r.account || '',
        note: r.info || r.note || '',
        balance: r.balance !== undefined ? r.balance : null
      };
    });
  }

  function updateSyncSubtitle(count, note) {
    if (!el.syncStatusSubtitle) return;
    el.syncStatusSubtitle.textContent = `● LEDGER 2026 ● ${count} Transactions • ${note}`;
  }

  // --- 7. SECURE SYNC WITH APPS SCRIPT ---
  async function syncLiveData() {
    const gasUrl = (el.assistantGasUrl ? el.assistantGasUrl.value.trim() : '') || 
      localStorage.getItem('gas_webapp_url') || 
      localStorage.getItem('LEDGER_GAS_URL') || 
      DEFAULT_GAS_URL;

    const passkey = (el.assistantPasskey ? el.assistantPasskey.value.trim() : '') || 
      localStorage.getItem('ledger_auth_key') || 
      localStorage.getItem('LEDGER_PASSKEY') || 
      DEFAULT_PASSKEY;

    showToast('🔄 Connecting to Google Apps Script gateway...');
    updateSyncSubtitle(ledgerRecords.length, 'Syncing...');

    try {
      // Must use action=get_data and sheetId to match Google Apps Script doGet protocol!
      const fullUrl = `${gasUrl}?action=get_data&key=${encodeURIComponent(passkey)}&sheetId=${LEDGER_SHEET_ID}&t=${Date.now()}`;
      const res = await fetch(fullUrl, { method: 'GET', mode: 'cors' });
      if (!res.ok) throw new Error(`HTTP ${res.status}: Gateway responded with error`);
      
      const json = await res.json();
      if (json.status === 'error' && json.message) throw new Error(json.message);

      const items = json.records || json.data || [];
      if (Array.isArray(items) && items.length > 0) {
        ledgerRecords = normalizeRecords(items);
        
        // Save to BOTH shared dashboard keys and assistant keys
        localStorage.setItem('cached_ledger_sheet2', JSON.stringify(items));
        localStorage.setItem('cached_time_sheet2', Date.now().toString());
        localStorage.setItem('LEDGER_DATA_CACHE_V2', JSON.stringify(items));

        if (json.arrayTab) {
          localStorage.setItem('cached_array_taxonomies', JSON.stringify(json.arrayTab));
          mergeTaxonomies(json.arrayTab);
        }

        updateSyncSubtitle(ledgerRecords.length, `Synced live (${items.length} records) at ${new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`);
        showToast(`✅ Synced ${ledgerRecords.length} records successfully!`);
      } else {
        showToast('⚠️ Sync completed but no records returned.');
        updateSyncSubtitle(ledgerRecords.length, 'Sync returned 0 records');
      }
    } catch (err) {
      console.error('Sync failed:', err);
      showToast(`❌ Sync Error: ${err.message}`);
      updateSyncSubtitle(ledgerRecords.length, 'Sync failed. Using local cache.');
    }
  }

  // --- 8. FEATURE A: RAW TRANSACTION NOTES PARSER ---
  function parseRawLine(line, currentDateContext, existingRecords = []) {
    const raw = line.trim();
    if (!raw) return null;

    // RULE 1: Ignore lines that contain only punctuation (e.g. ".", "-", "*", "_", ",") or no alphanumeric characters
    if (!/[a-zA-Z0-9]/.test(raw)) return null;

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
          message: `Ambiguous date token "${raw}". Please review manually.`
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
    // Also remove leading dash/dot if present: "- 120- mata murti"
    if (text.startsWith('-') || text.startsWith('.')) {
      text = text.slice(1).trim();
    }

    // Amount arithmetic check: e.g. "mata murti + 280+50"
    let components = [];
    const exprMatch = text.match(/(\d+(?:\.\d+)?)\s*\+\s*(\d+(?:\.\d+)?)/);
    if (exprMatch) {
      components = [parseFloat(exprMatch[1]), parseFloat(exprMatch[2])];
    }

    // Extract amount token
    // Look for leading number or k-shorthand: "3k", "100 -", "60 -", "180-", "1.2k-", "40, 60-", "1k for"
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
      amount += components.reduce((a, b) => a + b, 0);
    }

    // Default classifications
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

    // Entity mapping (Learned from real ledger)
    if (/(\bma\b|\bmaa\b)/i.test(lowerDesc)) {
      forEntity = 'Maa';
      reasons.push('Assigned For: Maa');
    } else if (/trishaa|trisha/i.test(lowerDesc)) {
      forEntity = 'Trishaa';
      reasons.push('Assigned For: Trishaa');
    }

    // Category mapping learned directly from user ledger patterns:
    if (/worker|maid|kamwali/i.test(lowerDesc)) {
      category = 'Housing';
      reasons.push('Home worker categorized as Housing (per ledger convention)');
    } else if (/dudh|milk|doodh/i.test(lowerDesc)) {
      category = 'Rashan';
      reasons.push('Monthly dudh mapped to Rashan');
    } else if (/rashan|atta|dal|chawal|oil|grocery|groceries/i.test(lowerDesc)) {
      category = 'Rashan';
    } else if (/tamatar|dhaniya|adrak|sabji|aloo|pyaz|vegetables/i.test(lowerDesc)) {
      category = 'Sabji';
    } else if (/seb|fruits|kela|khira|apple|mango/i.test(lowerDesc)) {
      category = 'Fruits';
    } else if (/puja|diya|hawan|murti|mala|pooja|ashram|pitra|kanya/i.test(lowerDesc)) {
      category = 'Charity';
      reasons.push('Puja/Charity mapped to Charity');
    } else if (/brush|soap|cream|mehendi|shampoo|personal/i.test(lowerDesc)) {
      category = 'Personal Care';
    } else if (/dkashna|dakshina/i.test(lowerDesc)) {
      category = 'Charity';
    } else if (/cylinder|gas\b/i.test(lowerDesc)) {
      category = 'Gas';
    } else if (/jio|airtel|vi\b|recharge/i.test(lowerDesc)) {
      category = 'Recharges';
    } else if (/dava|doctor|hospital|medical|medicine|dental/i.test(lowerDesc)) {
      category = 'Medical';
    } else if (/for ma\b|to ma\b|to maa\b/i.test(lowerDesc)) {
      category = 'Sabji'; // Common daily cash for Maa in user ledger
      reasons.push('Daily cash for Maa mapped to Sabji');
    }

    // Confidence calibration
    if (!amount || isNaN(amount) || amount <= 0) {
      confidence = 'LOW';
      reasons.push('Missing or zero amount');
    }
    if (!lineDate || lineDate === 'Needs Date Review') {
      confidence = 'LOW';
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
      if (!parsed) continue; // Strips lone dots and empty punctuation

      if (parsed.type === 'DATE_HEADER') {
        currentDateContext = parsed.date;
      } else if (parsed.type === 'DATE_HEADER_AMBIGUOUS') {
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

  // --- 9. REVIEW TABLE RENDERING & FILTERING ---
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
    let attentionCount = 0;
    let hasDuplicates = false;

    batch.forEach(row => {
      if (row.txType === 'Income') totalIncome += row.amount;
      else totalExpense += row.amount;

      if (row.confidence === 'LOW' || row.date === 'Needs Date Review' || row.category === 'Needs Review' || !row.amount) {
        attentionCount++;
      }
      if (row.isDuplicate) hasDuplicates = true;
    });

    // Update Summary & Badges
    el.summaryCount.textContent = batch.length;
    el.summaryExpense.textContent = `₹${totalExpense.toLocaleString('en-IN')}`;
    el.summaryIncome.textContent = `₹${totalIncome.toLocaleString('en-IN')}`;
    el.summaryAmbiguous.textContent = attentionCount;

    if (el.pillCountAll) el.pillCountAll.textContent = batch.length;
    if (el.pillCountAttention) el.pillCountAttention.textContent = attentionCount;

    if (hasDuplicates) el.duplicateAlertBox.classList.remove('hidden');
    else el.duplicateAlertBox.classList.add('hidden');

    if (attentionCount > 0) {
      el.batchValidationBadge.className = 'confidence-badge confidence-low';
      el.batchValidationBadge.textContent = `${attentionCount} Items Need Attention ⚠️`;
    } else {
      el.batchValidationBadge.className = 'confidence-badge confidence-high';
      el.batchValidationBadge.textContent = 'All Items Validated ✓';
    }

    // Render Table Rows (Respecting active filter)
    batch.forEach((row, idx) => {
      const isAttention = (row.confidence === 'LOW' || row.date === 'Needs Date Review' || row.category === 'Needs Review' || !row.amount);
      if (currentReviewFilter === 'ATTENTION' && !isAttention) return;

      const tr = document.createElement('tr');
      if (isAttention) tr.classList.add('row-needs-attention');

      const badgeClass = isAttention ? 'confidence-low' : (row.confidence === 'HIGH' ? 'confidence-high' : 'confidence-medium');
      const badgeText = isAttention ? '⚠️ Review' : (row.isDuplicate ? 'Duplicate?' : row.confidence);

      tr.innerHTML = `
        <td><input type="text" class="table-input" value="${escapeHtml(row.date)}" data-field="date" data-idx="${idx}" style="width: 100px; ${row.date === 'Needs Date Review' ? 'border-color: #f59e0b; color: #fbbf24;' : ''}"></td>
        <td><input type="text" class="table-input" value="${escapeHtml(row.description)}" data-field="description" data-idx="${idx}"></td>
        <td><input type="number" class="table-input font-mono" value="${row.amount}" data-field="amount" data-idx="${idx}" style="width: 85px; text-align: right; ${!row.amount ? 'border-color: #f43f5e;' : ''}"></td>
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
        <td><span class="confidence-badge ${badgeClass}" title="${row.reasons.join(', ')}">${badgeText}</span></td>
        <td>
          <button type="button" class="btn-delete-row" data-idx="${idx}" title="Remove entry" style="background:none; border:none; color:#f43f5e; cursor:pointer; font-size:1.1rem;">×</button>
        </td>
      `;

      el.reviewTableBody.appendChild(tr);
    });

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

  // --- 10. BATCH CONFIRMATION & SAFE APPS SCRIPT WRITEBACK GATE ---
  async function confirmBatchWrite() {
    if (parsedDraftBatch.length === 0) {
      alert('Draft is empty. Parse or add entries first.');
      return;
    }

    const invalidItems = parsedDraftBatch.filter(r => !r.amount || r.amount <= 0 || r.date === 'Needs Date Review');
    if (invalidItems.length > 0) {
      const proceed = confirm(`⚠️ Warning: ${invalidItems.length} items have missing dates or invalid amounts. Do you want to review them first?`);
      if (proceed) return;
    }

    const totalOutflow = parsedDraftBatch.filter(r => r.txType === 'Expense').reduce((a, b) => a + b.amount, 0);
    const totalInflow = parsedDraftBatch.filter(r => r.txType === 'Income').reduce((a, b) => a + b.amount, 0);
    const confirmMsg = `Confirm write to Google Sheets:\n` +
      `• Total Rows: ${parsedDraftBatch.length}\n` +
      `• Total Outflow: ₹${totalOutflow.toLocaleString('en-IN')}\n` +
      `• Total Inflow: ₹${totalInflow.toLocaleString('en-IN')}\n\n` +
      `Note: Column H formulas will be preserved. Proceed?`;

    if (!confirm(confirmMsg)) return;

    const gasUrl = el.assistantGasUrl.value.trim() || DEFAULT_GAS_URL;
    const passkey = el.assistantPasskey.value.trim() || DEFAULT_PASSKEY;

    showToast('🚀 Transmitting batch to Google Apps Script...');

    try {
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
        headers: { 'Content-Type': 'text/plain' },
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

      await syncLiveData();
    } catch (err) {
      console.error('Batch write error:', err);
      alert(`❌ Live write failed: ${err.message}\nYour draft has been preserved.`);
    }
  }

  // --- 11. FEATURE B: ASK MY LEDGER (DETERMINISTIC QUERY ENGINE) ---
  function executeNaturalLanguageQuery(queryText) {
    const rawQ = queryText.trim();
    if (!rawQ) return;

    const q = rawQ.toLowerCase();

    if (ledgerRecords.length === 0) {
      alert('Ledger records not loaded yet. Tap "Sync Live Data" first.');
      return;
    }

    el.queryResultCard.classList.remove('hidden');
    el.answerHeadline.textContent = 'Analyzing question...';

    // 1. Identify Target Direction
    let direction = 'All';
    if (/income|kamai|aamdani|credit/i.test(q)) direction = 'Income';
    else if (/expense|kharcha|spent|spend|debit|outflow|list/i.test(q)) direction = 'Expense';

    // 2. Relative Month & Typo Resolver
    // Handles "lasr month", "last month", "pichle mahine", "this month"
    const monthOrder = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
    const monthAbbrMap = {
      jan: 'Jan', feb: 'Feb', mar: 'Mar', apr: 'Apr', may: 'May', jun: 'Jun',
      jul: 'Jul', aug: 'Aug', sep: 'Sep', oct: 'Oct', nov: 'Nov', dec: 'Dec'
    };

    let targetRelativeMonth = null;
    if (/lasr month|last month|pichle mahine|pichla month|prev month|previous month/i.test(q)) {
      targetRelativeMonth = 'LAST_MONTH';
    } else if (/this month|is month|current month|is mahine/i.test(q)) {
      targetRelativeMonth = 'THIS_MONTH';
    }

    // Determine current month in context
    const currentMonthAbbr = 'Oct'; // October 2026
    const currIdx = monthOrder.indexOf(currentMonthAbbr.toLowerCase());
    const prevIdx = (currIdx - 1 + 12) % 12;
    const lastMonthAbbr = monthAbbrMap[monthOrder[prevIdx]];

    const foundMonths = [];
    if (targetRelativeMonth === 'LAST_MONTH') {
      foundMonths.push(lastMonthAbbr);
    } else if (targetRelativeMonth === 'THIS_MONTH') {
      foundMonths.push(currentMonthAbbr);
    } else {
      Object.keys(monthAbbrMap).forEach(mStr => {
        const regex = new RegExp(`\\b${mStr}\\b`, 'i');
        if (regex.test(q)) {
          const canonical = monthAbbrMap[mStr];
          if (!foundMonths.includes(canonical)) foundMonths.push(canonical);
        }
      });
    }

    // 3. Identify Target Category
    let targetCategory = null;
    for (const cat of MASTER_CATEGORIES) {
      if (q.includes(cat.toLowerCase())) {
        targetCategory = cat;
        break;
      }
    }
    if (!targetCategory) {
      if (/rashan|groceries|kirana/i.test(q)) targetCategory = 'Rashan';
      else if (/sabji|tarkari|vegetables/i.test(q)) targetCategory = 'Sabji';
      else if (/rent|kiraya/i.test(q) && direction === 'Income') targetCategory = 'Income';
      else if (/rent|kiraya/i.test(q)) targetCategory = 'Housing';
      else if (/personal care|brush|soap/i.test(q)) targetCategory = 'Personal Care';
    }

    // 4. Identify Target Account
    let targetAccount = null;
    if (/pnb/i.test(q)) targetAccount = 'PNB';
    else if (/sbi/i.test(q)) targetAccount = 'SBI';
    else if (/cash/i.test(q)) targetAccount = 'Cash';

    // --- CASE 1: Monthly Expense List / Donut Breakdown ("last month ke expense list do" / "category-wise") ---
    if (!targetCategory && ((foundMonths.length === 1 && (direction === 'Expense' || /list|breakdown/i.test(q))) || /category[- ]wise|sabse zyada|breakdown|categories/i.test(q))) {
      const monthFilter = foundMonths.length === 1 ? foundMonths[0] : null;
      let monthTx = ledgerRecords.filter(r => (r.amountXpns || 0) > 0);
      if (monthFilter) {
        monthTx = monthTx.filter(r => (r.month || '').toLowerCase() === monthFilter.toLowerCase());
      }

      const catMap = {};
      monthTx.forEach(r => {
        const c = r.category || 'misc expn';
        catMap[c] = (catMap[c] || 0) + (r.amountXpns || 0);
      });

      const sortedCats = Object.entries(catMap).sort((a, b) => b[1] - a[1]);
      const totalExpense = Object.values(catMap).reduce((a, b) => a + b, 0);
      const topCat = sortedCats[0];

      const monthLabel = monthFilter ? `${monthFilter} 2026` : 'All-Time';
      el.answerHeadline.textContent = `${monthLabel} Total Expense: ₹${totalExpense.toLocaleString('en-IN')}`;
      el.answerSubtext.textContent = `Calculated across ${monthTx.length} transactions across ${sortedCats.length} categories. Highest: ${topCat ? topCat[0] : 'None'} (₹${topCat ? topCat[1].toLocaleString('en-IN') : 0}).`;

      el.queryKpiExpense.textContent = `₹${totalExpense.toLocaleString('en-IN')}`;
      el.queryKpiIncome.textContent = '₹0';
      el.queryKpiCount.textContent = monthTx.length;

      // Render Donut & Category Cards
      renderInteractiveDonut(sortedCats, monthTx);
      lastQueryContributingRecords = monthTx;
      renderContributingTable(monthTx);

      logQueryAudit(rawQ, el.answerHeadline.textContent, totalExpense, 0, monthTx.length);
      return;
    }

    // --- CASE 1B: Single Category in a Specific Month (e.g. "March rental income", "September ka rashan") ---
    if (foundMonths.length === 1 && targetCategory) {
      const monthStr = foundMonths[0];
      const monthCatRecords = ledgerRecords.filter(r => 
        (r.month || '').toLowerCase() === monthStr.toLowerCase() &&
        r.category.toLowerCase() === targetCategory.toLowerCase()
      );
      const isInc = (direction === 'Income' || targetCategory === 'Income' || /rent|kiraya/i.test(q));
      const totalAmt = monthCatRecords.reduce((a, b) => a + (isInc ? b.amtInCredit : b.amountXpns), 0);

      el.answerHeadline.textContent = `${monthStr} 2026 ${targetCategory}: ₹${totalAmt.toLocaleString('en-IN')}`;
      el.answerSubtext.textContent = `Found ${monthCatRecords.length} transactions in ${monthStr} 2026. 100% deterministic calculation.`;

      el.queryKpiExpense.textContent = isInc ? '₹0' : `₹${totalAmt.toLocaleString('en-IN')}`;
      el.queryKpiIncome.textContent = isInc ? `₹${totalAmt.toLocaleString('en-IN')}` : '₹0';
      el.queryKpiCount.textContent = monthCatRecords.length;

      hideDonutPanel();
      renderBarChart(
        monthCatRecords.map(r => r.date),
        monthCatRecords.map(r => isInc ? r.amtInCredit : r.amountXpns),
        `${targetCategory} (₹)`
      );
      lastQueryContributingRecords = monthCatRecords;
      renderContributingTable(monthCatRecords);
      logQueryAudit(rawQ, el.answerHeadline.textContent, isInc ? 0 : totalAmt, isInc ? totalAmt : 0, monthCatRecords.length);
      return;
    }

    // --- CASE 2: Comparison between two months ("Feb vs Apr rashan") ---
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

      hideDonutPanel();
      renderComparisonChart([`${m1} ${targetCategory || ''}`, `${m2} ${targetCategory || ''}`], [sum1, sum2]);
      lastQueryContributingRecords = [...r1, ...r2];
      renderContributingTable(lastQueryContributingRecords);

      logQueryAudit(rawQ, el.answerHeadline.textContent, sum1, sum2, r1.length + r2.length);
      return;
    }

    // --- CASE 3: Rental Income query ---
    if (/rental|kiraya/i.test(q) || (targetCategory === 'Income' && /rent/i.test(q))) {
      const rentalRecords = ledgerRecords.filter(r => 
        (r.amtInCredit > 0) && (r.category === 'Income' || r.category === 'Rental' || /rent|rajeev|charan/i.test(r.item))
      );

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

      hideDonutPanel();
      renderBarChart(finalRecords.map(r => r.date), finalRecords.map(r => r.amtInCredit), 'Rental Income');
      lastQueryContributingRecords = finalRecords;
      renderContributingTable(finalRecords);

      logQueryAudit(rawQ, el.answerHeadline.textContent, 0, totalRent, finalRecords.length);
      return;
    }

    // --- CASE 4: Account spending query ("PNB se kitna spend hua?") ---
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

      hideDonutPanel();
      renderComparisonChart([`${targetAccount} Outflow`, `${targetAccount} Inflow`], [exp, inc]);
      lastQueryContributingRecords = accRecords;
      renderContributingTable(accRecords);

      logQueryAudit(rawQ, el.answerHeadline.textContent, exp, inc, accRecords.length);
      return;
    }

    // --- CASE 5: General Category, Month, or Freeform Keyword Query (e.g. "Netflix") ---
    let matching = [...ledgerRecords];
    if (targetCategory) matching = matching.filter(r => r.category.toLowerCase() === targetCategory.toLowerCase());
    if (foundMonths.length === 1) matching = matching.filter(r => (r.month || '').toLowerCase() === foundMonths[0].toLowerCase());

    const cleanedKeywords = q
      .replace(/batao|kitna|hai|ka|ke|ki|karo|dikhao|total|all[- ]time|expense|income|spend|hua|search|please|expenses|category|categories/gi, ' ')
      .trim()
      .split(/\s+/)
      .filter(w => w.length >= 3 && !foundMonths.map(m => m.toLowerCase()).includes(w) && (!targetCategory || !targetCategory.toLowerCase().includes(w)));

    if (cleanedKeywords.length > 0 && !targetCategory) {
      matching = matching.filter(r => {
        const fullSearchBlob = `${r.item || ''} ${r.note || ''} ${r.category || ''} ${r.expenseAcc || ''} ${r.incomeAccnt || ''} ${r.forEntity || ''}`.toLowerCase();
        return cleanedKeywords.some(kw => fullSearchBlob.includes(kw));
      });
    }

    const exp = matching.reduce((a, b) => a + (b.amountXpns || 0), 0);
    const inc = matching.reduce((a, b) => a + (b.amtInCredit || 0), 0);

    let titlePrefix = '';
    if (targetCategory) {
      titlePrefix = [foundMonths[0], targetCategory].filter(Boolean).join(' ');
    } else {
      titlePrefix = [foundMonths[0], cleanedKeywords.join(' ')].filter(Boolean).join(' ') || 'Ledger Query';
    }

    el.answerHeadline.textContent = `${titlePrefix}: ₹${exp > 0 ? exp.toLocaleString('en-IN') + ' Spent' : inc.toLocaleString('en-IN') + ' Inflow'}`;
    el.answerSubtext.textContent = `Found ${matching.length} matching transactions. 100% verified against ledger data.`;

    el.queryKpiExpense.textContent = `₹${exp.toLocaleString('en-IN')}`;
    el.queryKpiIncome.textContent = `₹${inc.toLocaleString('en-IN')}`;
    el.queryKpiCount.textContent = matching.length;

    hideDonutPanel();
    renderBarChart(matching.slice(0, 10).map(r => r.date), matching.slice(0, 10).map(r => r.amountXpns || r.amtInCredit), 'Amount (₹)');
    lastQueryContributingRecords = matching;
    renderContributingTable(matching);

    logQueryAudit(rawQ, el.answerHeadline.textContent, exp, inc, matching.length);
  }

  // --- 12. CHART.JS & DONUT DRILL-DOWN VISUALIZATIONS ---
  function destroyPreviousChart() {
    if (queryChartInstance) {
      queryChartInstance.destroy();
      queryChartInstance = null;
    }
  }

  function hideDonutPanel() {
    if (el.queryDonutCategoryPanel) el.queryDonutCategoryPanel.classList.add('hidden');
    if (el.activeGridFilterLabel) el.activeGridFilterLabel.textContent = '';
    activeCategoryFilter = null;
  }

  function renderInteractiveDonut(sortedCategories, fullTxList) {
    destroyPreviousChart();
    el.queryChartContainer.classList.remove('hidden');
    el.queryDonutCategoryPanel.classList.remove('hidden');

    const totalExp = sortedCategories.reduce((a, b) => a + b[1], 0);
    const topCategories = sortedCategories.slice(0, 8);
    const labels = topCategories.map(c => c[0]);
    const data = topCategories.map(c => c[1]);
    const colors = ['#f43f5e', '#38bdf8', '#34d399', '#f59e0b', '#a855f7', '#ec4899', '#06b6d4', '#eab308'];

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
        },
        onClick: (evt, activeEls) => {
          if (activeEls && activeEls.length > 0) {
            const clickedIdx = activeEls[0].index;
            const clickedCat = labels[clickedIdx];
            applyCategoryDrillDown(clickedCat, fullTxList);
          }
        }
      }
    });

    // Populate Category Breakdown Cards (Mobile Dashboard style)
    el.queryCatBreakdownGrid.innerHTML = '';
    sortedCategories.forEach(([catName, catAmt], i) => {
      const pct = totalExp > 0 ? ((catAmt / totalExp) * 100).toFixed(1) : 0;
      const card = document.createElement('div');
      card.className = 'cat-breakdown-card';
      card.setAttribute('data-category', catName);
      card.innerHTML = `
        <div class="cat-card-header">
          <span style="font-weight: 600; color: #f8fafc;">#${i + 1} ${escapeHtml(catName)}</span>
          <span>${pct}%</span>
        </div>
        <div class="cat-card-amount">₹${catAmt.toLocaleString('en-IN')}</div>
      `;

      card.addEventListener('click', () => {
        applyCategoryDrillDown(catName, fullTxList);
      });

      el.queryCatBreakdownGrid.appendChild(card);
    });
  }

  function applyCategoryDrillDown(categoryName, fullTxList) {
    activeCategoryFilter = categoryName;

    // Highlight card
    el.queryCatBreakdownGrid.querySelectorAll('.cat-breakdown-card').forEach(c => {
      if (c.getAttribute('data-category') === categoryName) c.classList.add('active');
      else c.classList.remove('active');
    });

    if (el.btnClearCatFilter) el.btnClearCatFilter.classList.remove('hidden');
    if (el.activeGridFilterLabel) el.activeGridFilterLabel.textContent = `Filtered by: ${categoryName}`;

    // Filter table below
    const catRecords = fullTxList.filter(r => (r.category || '').toLowerCase() === categoryName.toLowerCase());
    renderContributingTable(catRecords);
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
        plugins: { legend: { display: false } },
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

  function renderContributingTable(records) {
    el.queryResultsTableBody.innerHTML = '';
    el.queryTableCount.textContent = records.length;

    records.slice(0, 75).forEach(r => {
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

  // --- 13. PERSISTENT QUERY HISTORY & AUDIT LOG ---
  function logQueryAudit(queryText, headline, expense, income, count) {
    try {
      const history = JSON.parse(localStorage.getItem('LEDGER_QUERY_AUDIT_LOG_V1') || '[]');
      const now = new Date();
      const newEntry = {
        id: Date.now(),
        timestampRaw: Date.now(),
        dateStr: now.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
        timeStr: now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }),
        timestamp: now.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }),
        query: queryText,
        headline: headline,
        expense: expense,
        income: income,
        count: count
      };
      history.unshift(newEntry);
      // Keep last 50 queries
      if (history.length > 50) history.pop();
      localStorage.setItem('LEDGER_QUERY_AUDIT_LOG_V1', JSON.stringify(history));
      renderQueryHistory();
    } catch(e) {
      console.warn('Audit log error:', e);
    }
  }

  function renderQueryHistory() {
    if (!el.queryHistoryList) return;
    try {
      const history = JSON.parse(localStorage.getItem('LEDGER_QUERY_AUDIT_LOG_V1') || '[]');
      if (el.queryHistoryCount) el.queryHistoryCount.textContent = history.length;
      if (el.histCountAll) el.histCountAll.textContent = history.length;

      if (history.length === 0) {
        el.queryHistoryList.innerHTML = '<p style="font-size: 0.75rem; color: var(--text-muted); font-style: italic; padding: 0.5rem 0;">No queries in history yet. Ask a question above to start logging.</p>';
        return;
      }

      el.queryHistoryList.innerHTML = '';

      if (currentHistoryFilter === 'ALL') {
        history.forEach((item, idx) => {
          el.queryHistoryList.appendChild(createHistoryItemElement(item, idx));
        });
      } else if (currentHistoryFilter === 'HOURLY') {
        const now = Date.now();
        const buckets = {
          'Past 1 Hour': [],
          '1 to 3 Hours Ago': [],
          '3 to 6 Hours Ago': [],
          'Earlier Today': [],
          'Older than 24 Hours': []
        };

        history.forEach((item, idx) => {
          const itemTime = item.timestampRaw || item.id || now;
          const diffMinutes = Math.floor((now - itemTime) / 60000);
          if (diffMinutes < 60) buckets['Past 1 Hour'].push({ item, idx });
          else if (diffMinutes < 180) buckets['1 to 3 Hours Ago'].push({ item, idx });
          else if (diffMinutes < 360) buckets['3 to 6 Hours Ago'].push({ item, idx });
          else if (diffMinutes < 1440) buckets['Earlier Today'].push({ item, idx });
          else buckets['Older than 24 Hours'].push({ item, idx });
        });

        Object.entries(buckets).forEach(([bucketName, entries]) => {
          if (entries.length === 0) return;
          const header = document.createElement('div');
          header.className = 'history-group-header';
          header.innerHTML = `<span>⏱️ ${bucketName}</span><span style="font-size:0.65rem; opacity:0.8;">${entries.length} queries</span>`;
          el.queryHistoryList.appendChild(header);

          entries.forEach(({ item, idx }) => {
            el.queryHistoryList.appendChild(createHistoryItemElement(item, idx));
          });
        });
      } else if (currentHistoryFilter === 'DAILY') {
        const todayStr = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
        const yesterday = new Date(Date.now() - 86400000);
        const yesterdayStr = yesterday.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

        const dayGroups = {};
        history.forEach((item, idx) => {
          let dayKey = item.dateStr;
          if (!dayKey && item.timestampRaw) {
            dayKey = new Date(item.timestampRaw).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
          }
          if (!dayKey) dayKey = 'Other';

          let label = dayKey;
          if (dayKey === todayStr) label = 'Today (' + dayKey + ')';
          else if (dayKey === yesterdayStr) label = 'Yesterday (' + dayKey + ')';

          if (!dayGroups[label]) dayGroups[label] = [];
          dayGroups[label].push({ item, idx });
        });

        Object.entries(dayGroups).forEach(([dayLabel, entries]) => {
          const header = document.createElement('div');
          header.className = 'history-group-header';
          header.innerHTML = `<span>📅 ${dayLabel}</span><span style="font-size:0.65rem; opacity:0.8;">${entries.length} queries</span>`;
          el.queryHistoryList.appendChild(header);

          entries.forEach(({ item, idx }) => {
            el.queryHistoryList.appendChild(createHistoryItemElement(item, idx));
          });
        });
      }
    } catch(e) {
      console.warn('Render history error:', e);
    }
  }

  function createHistoryItemElement(item, idx) {
    const div = document.createElement('div');
    div.className = 'history-item';
    div.innerHTML = `
      <div class="history-prompt">
        <span>💬 "${escapeHtml(item.query)}"</span>
        <div style="display:flex; align-items:center; gap:0.4rem;">
          <span style="font-size: 0.68rem; color: var(--text-muted); font-weight: 400;">${item.timeStr ? item.timeStr : item.timestamp}</span>
          <button type="button" class="history-item-del-btn" data-id="${item.id}" title="Remove entry">✕</button>
        </div>
      </div>
      <div class="history-reply">${escapeHtml(item.headline)}</div>
      <div class="history-meta">Outflow: ₹${Number(item.expense).toLocaleString('en-IN')} • Inflow: ₹${Number(item.income).toLocaleString('en-IN')} • Records: ${item.count}</div>
    `;

    // Click to re-run
    div.addEventListener('click', (e) => {
      if (e.target && e.target.classList.contains('history-item-del-btn')) return;
      el.nlQueryInput.value = item.query;
      if (el.btnClearNlQuery) el.btnClearNlQuery.classList.remove('hidden');
      executeNaturalLanguageQuery(item.query);
    });

    // Delete item handler
    const delBtn = div.querySelector('.history-item-del-btn');
    if (delBtn) {
      delBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        deleteHistoryItem(item.id);
      });
    }

    return div;
  }

  function deleteHistoryItem(id) {
    try {
      const history = JSON.parse(localStorage.getItem('LEDGER_QUERY_AUDIT_LOG_V1') || '[]');
      const filtered = history.filter(h => h.id !== id);
      localStorage.setItem('LEDGER_QUERY_AUDIT_LOG_V1', JSON.stringify(filtered));
      renderQueryHistory();
      showToast('Entry removed from log');
    } catch(e) {}
  }

  // --- 14. UTILITIES & EVENT HANDLERS ---
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
    if (el.btnLoadSampleNotes) {
      el.btnLoadSampleNotes.addEventListener('click', () => {
        el.rawNotesInput.value = `13 oct 
250 for ma 
1600 home worker monthly paid
2760 monthly dudh 
1k for rashan and sabji expenses to ma`;
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
        currentReviewFilter = 'ALL';
        renderReviewTable(parsed);
        showToast(`Parsed ${parsed.length} entries cleanly!`);
      });
    }

    // Filter Review Table Pills (All vs Needs Attention)
    if (el.btnFilterAllRows) {
      el.btnFilterAllRows.addEventListener('click', () => {
        currentReviewFilter = 'ALL';
        el.btnFilterAllRows.classList.add('active');
        if (el.btnFilterAttentionRows) el.btnFilterAttentionRows.classList.remove('active');
        renderReviewTable(parsedDraftBatch);
      });
    }

    if (el.btnFilterAttentionRows) {
      el.btnFilterAttentionRows.addEventListener('click', () => {
        currentReviewFilter = 'ATTENTION';
        el.btnFilterAttentionRows.classList.add('active');
        if (el.btnFilterAllRows) el.btnFilterAllRows.classList.remove('active');
        renderReviewTable(parsedDraftBatch);
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

    // Query Engine handlers & Clear Cross Button
    if (el.nlQueryInput && el.btnClearNlQuery) {
      el.nlQueryInput.addEventListener('input', () => {
        if (el.nlQueryInput.value.trim().length > 0) {
          el.btnClearNlQuery.classList.remove('hidden');
        } else {
          el.btnClearNlQuery.classList.add('hidden');
        }
      });

      el.btnClearNlQuery.addEventListener('click', () => {
        el.nlQueryInput.value = '';
        el.btnClearNlQuery.classList.add('hidden');
        el.nlQueryInput.focus();
      });
    }

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
        if (el.btnClearNlQuery) el.btnClearNlQuery.classList.remove('hidden');
        executeNaturalLanguageQuery(query);
      });
    });

    // Reset Category Drill Down
    if (el.btnClearCatFilter) {
      el.btnClearCatFilter.addEventListener('click', () => {
        hideDonutPanel();
        renderContributingTable(lastQueryContributingRecords);
      });
    }

    // Copy / Clear History
    if (el.btnCopyQueryHistory) {
      el.btnCopyQueryHistory.addEventListener('click', () => {
        try {
          const history = JSON.parse(localStorage.getItem('LEDGER_QUERY_AUDIT_LOG_V1') || '[]');
          if (history.length === 0) {
            showToast('Log is currently empty');
            return;
          }
          let text = `=== LEDGER INTELLIGENCE AUDIT LOG ===\nExported: ${new Date().toLocaleString()}\nTotal Queries Logged: ${history.length}\n\n`;
          history.forEach((h, i) => {
            text += `[${i + 1}] ${h.dateStr || ''} ${h.timeStr || h.timestamp || ''}\n`;
            text += `Q: "${h.query}"\n`;
            text += `A: ${h.headline}\n`;
            text += `Outflow: ₹${Number(h.expense).toLocaleString('en-IN')} | Inflow: ₹${Number(h.income).toLocaleString('en-IN')} | Txns: ${h.count}\n\n`;
          });
          navigator.clipboard.writeText(text).then(() => {
            showToast('📋 Formatted audit log copied to clipboard!');
          }).catch(() => {
            prompt('Copy audit log:', text);
          });
        } catch(e) {}
      });
    }

    if (el.btnClearQueryHistory) {
      el.btnClearQueryHistory.addEventListener('click', () => {
        if (confirm('Clear query history log?')) {
          localStorage.removeItem('LEDGER_QUERY_AUDIT_LOG_V1');
          renderQueryHistory();
          showToast('Query history cleared.');
        }
      });
    }

    // History View Filter Toggles (All / Hourly / Daily)
    const histBtns = [
      { btn: el.btnHistFilterAll, view: 'ALL', label: 'Chronological Log' },
      { btn: el.btnHistFilterHourly, view: 'HOURLY', label: 'Hourly Groups' },
      { btn: el.btnHistFilterDaily, view: 'DAILY', label: 'Daily Groups' }
    ];

    histBtns.forEach(({ btn, view, label }) => {
      if (btn) {
        btn.addEventListener('click', () => {
          histBtns.forEach(b => b.btn && b.btn.classList.remove('active'));
          btn.classList.add('active');
          currentHistoryFilter = view;
          if (el.historyActiveViewLabel) el.historyActiveViewLabel.textContent = label;
          renderQueryHistory();
        });
      }
    });

    // Sync & Passkey handlers
    if (el.btnSaveAssistantKey) {
      el.btnSaveAssistantKey.addEventListener('click', () => {
        const key = el.assistantPasskey.value.trim();
        const url = el.assistantGasUrl.value.trim();
        localStorage.setItem('ledger_auth_key', key);
        localStorage.setItem('LEDGER_PASSKEY', key);
        localStorage.setItem('gas_webapp_url', url);
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
