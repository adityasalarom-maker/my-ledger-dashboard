// ================================================================
// ASSET: GAS-01 - Google Apps Script Middleware (doPost & Telegram Webhook Handler)
// TYPE: Google Apps Script (JS) | TARGET: Extensions > Apps Script > Code.gs
// NOTES: Complete production Google Apps Script webhook engine. Connects Telegram Bot, Gemini 2.0 Flash structured JSON parsing, QuickChart.io visual charts, and direct append to LEDGER sheet. Includes authentication checks for Telegram user ID, command routing (/start, /chart, /balance), and lump-sum math reconciliation.
// ================================================================

/**
 * PRODUCTION FINANCIAL OPERATING SYSTEM MIDDLEWARE
 * Connects Telegram Bot Webhook, Gemini Pro Parsing, QuickChart, and Google Sheets
 */

const SCRIPT_PROPERTIES = PropertiesService.getScriptProperties();

function initializeSystemProperties() {
  SCRIPT_PROPERTIES.setProperties({
    'TELEGRAM_BOT_TOKEN': 'PASTE_YOUR_TELEGRAM_BOT_TOKEN_HERE',
    'GEMINI_API_KEY': 'PASTE_YOUR_GEMINI_API_KEY_HERE',
    'AUTHORIZED_CHAT_ID': 'PASTE_YOUR_NUMERIC_TELEGRAM_USER_ID_HERE',
    'SPREADSHEET_SHEET_NAME': 'LEDGER'
  });
}

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return ContentService.createTextOutput("Empty payload");
    }
    
    const update = JSON.parse(e.postData.contents);
    if (!update.message || !update.message.text) {
      return ContentService.createTextOutput("No text message");
    }
    
    const chatId = update.message.chat.id.toString();
    const authorizedId = SCRIPT_PROPERTIES.getProperty('AUTHORIZED_CHAT_ID');
    
    if (chatId !== authorizedId) {
      sendTelegramMessage(chatId, "Unauthorized access rejected.");
      return ContentService.createTextOutput("Unauthorized");
    }
    
    const userMessage = update.message.text.trim();
    
    if (userMessage.startsWith('/start')) {
      sendTelegramMessage(chatId, "Bookkeeping System Online.\nSend expenses directly (e.g., '13 sep 800 - 200 seb, 30 bhindi...').\nUse /chart to view category breakdowns.");
      return ContentService.createTextOutput("Success");
    }
    
    if (userMessage.startsWith('/chart')) {
      handleVisualReporting(chatId);
      return ContentService.createTextOutput("Success");
    }
    
    if (userMessage.startsWith('/balance')) {
      handleBalanceQuery(chatId);
      return ContentService.createTextOutput("Success");
    }
    
    sendTelegramMessage(chatId, "Analyzing and parsing transaction...");
    const parsedData = parseExpenseTextWithGemini(userMessage);
    
    if (!parsedData || !parsedData.transactions || parsedData.transactions.length === 0) {
      sendTelegramMessage(chatId, "Parsing failed. Please verify the entry format.");
      return ContentService.createTextOutput("Parsing error");
    }
    
    const summary = appendTransactionsToLedger(parsedData.transactions);
    sendTelegramMessage(chatId, summary);
    
  } catch (err) {
    Logger.log("doPost Error: " + err.toString());
  }
  return ContentService.createTextOutput("OK");
}

function parseExpenseTextWithGemini(rawText) {
  const apiKey = SCRIPT_PROPERTIES.getProperty('GEMINI_API_KEY');
  const endpoint = `[link removed]{apiKey}`;
  
  const systemInstruction = `
You are an expert financial accountant parsing unstructured expense logs into structured ledger rows.
Strict Master Taxonomies:
CATEGORIES: BUDGET, Sabji, Rashan, misc expn, Charity, Food, Stay, Fuel, Personal Care, Bills, Recharges, Housing, Accessories, Fruits, Medical, Other Houses, Clothes, Services \\ Repairs, Pets, Insurances \\ PUC, Savings, EMI, Business, Deposits, Work, Gas, Gifts.
EXPENSE ACCOUNTS: Hom Cash, PNB Online, Cash Earning E, Trishaa Cash, Trishaa Online Sav Acc, Trishaa Online Current Acc, Trishaa GPay, Co bank, SBI Vil, PO Bk, Maa SBI BK, All.
INCOME ACCOUNTS: CO Bank, SBI Vil, Cash Earning I, Trishaa HDFC Sav Acc, PNB Bnk, PO Bk, Maa SBI BK, Trishaa Currnt GPay, All Banks.
ENTITIES: By: Honey, Trishaa, Maa. For: Budget, Staying, Outer, Trishaa, Honey, Home, Maa, Work.

RULES:
- If a lump-sum balance contains unpriced items (e.g. 800 total, 200 fruit, 30 veg, and tamatar), deduct explicit items and assign remainder to the unpriced item.
- Default Expense Accn to "Hom Cash" for household cash shopping, and "PNB Online" for bills/fuel/medical.
- Default 'By' to 'Honey' and 'For' to 'Home' unless specified.
- Return ONLY valid JSON adhering to schema.
`;

  const payload = {
    contents: [
      {
        role: "user",
        parts: [{ text: `Current Reference Date: ${Utilities.formatDate(new Date(), "Asia/Kolkata", "yyyy-MM-dd")}\n\nParse this text:\n${rawText}` }]
      }
    ],
    systemInstruction: {
      parts: [{ text: systemInstruction }]
    },
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.1
    }
  };

  const options = {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  const response = UrlFetchApp.fetch(endpoint, options);
  const responseData = JSON.parse(response.getContentText());
  
  if (responseData.candidates && responseData.candidates[0].content.parts[0].text) {
    return JSON.parse(responseData.candidates[0].content.parts[0].text);
  }
  return null;
}

function appendTransactionsToLedger(transactions) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheetName = SCRIPT_PROPERTIES.getProperty('SPREADSHEET_SHEET_NAME');
  const sheet = ss.getSheetByName(sheetName);
  
  let summaryText = `Added ${transactions.length} record(s):\n`;
  let totalDisbursed = 0;
  
  for (let i = 0; i < transactions.length; i++) {
    const t = transactions[i];
    
    const row = [
      t.date || Utilities.formatDate(new Date(), "Asia/Kolkata", "yyyy-MM-dd"),
      t.by || "Honey",
      t.for_entity || "Home",
      t.item || "Expense",
      t.expense_accn || "Hom Cash",
      t.category || "misc expn",
      t.amount_xpns || "",
      "", 
      t.info || "",
      t.amt_in_credit || "",
      t.income_accnt || "",
      t.months || Utilities.formatDate(new Date(), "Asia/Kolkata", "MMM")
    ];
    
    sheet.appendRow(row);
    
    const amt = Number(t.amount_xpns) || 0;
    totalDisbursed += amt;
    summaryText += `• ${t.item} (${t.category}): Rs. ${amt || t.amt_in_credit} [${t.expense_accn}]\n`;
  }
  
  summaryText += `Total Outflow: Rs. ${totalDisbursed}`;
  return summaryText;
}

function handleVisualReporting(chatId) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SCRIPT_PROPERTIES.getProperty('SPREADSHEET_SHEET_NAME'));
  const data = sheet.getDataRange().getValues();
  
  if (data.length <= 1) {
    sendTelegramMessage(chatId, "The ledger contains no data to generate a chart.");
    return;
  }
  
  const categoryTotals = {};
  for (let i = 1; i < data.length; i++) {
    const cat = data[i][5];
    const amount = Number(data[i][6]) || 0;
    if (cat && amount > 0 && cat !== 'BUDGET') {
      categoryTotals[cat] = (categoryTotals[cat] || 0) + amount;
    }
  }
  
  const sortedCategories = Object.keys(categoryTotals)
    .sort((a, b) => categoryTotals[b] - categoryTotals[a])
    .slice(0, 8);
  
  const chartLabels = [];
  const chartValues = [];
  sortedCategories.forEach(cat => {
    chartLabels.push(cat);
    chartValues.push(categoryTotals[cat]);
  });
  
  const chartConfig = {
    type: 'pie',
    data: {
      labels: chartLabels,
      datasets: [{
        data: chartValues,
        backgroundColor: ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40', '#8AC926', '#1982C4']
      }]
    },
    options: {
      title: { display: true, text: 'Top Expenditures by Category', fontSize: 16 }
    }
  };
  
  const chartUrl = `[link removed]{encodeURIComponent(JSON.stringify(chartConfig))}`;
  sendTelegramPhoto(chatId, chartUrl, "Current Category Breakdown");
}

function handleBalanceQuery(chatId) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SCRIPT_PROPERTIES.getProperty('SPREADSHEET_SHEET_NAME'));
  const data = sheet.getDataRange().getValues();
  
  const balances = { "Hom Cash": 0, "PNB Online": 0, "Cash Earning E": 0 };
  
  for (let i = 1; i < data.length; i++) {
    const expenseAcc = data[i][4];
    const expenseAmt = Number(data[i][6]) || 0;
    const creditAmt = Number(data[i][9]) || 0;
    
    if (balances.hasOwnProperty(expenseAcc)) {
      balances[expenseAcc] += (creditAmt - expenseAmt);
    }
  }
  
  let msg = "CURRENT ACCOUNT BALANCES\n==========================\n";
  for (const [acc, bal] of Object.entries(balances)) {
    msg += `${acc.padEnd(16)}: Rs. ${bal}\n`;
  }
  msg += "==========================";
  sendTelegramMessage(chatId, msg);
}

function sendTelegramMessage(chatId, text) {
  const token = SCRIPT_PROPERTIES.getProperty('TELEGRAM_BOT_TOKEN');
  const url = `[link removed]{token}/sendMessage`;
  const payload = { chat_id: chatId, text: text };
  UrlFetchApp.fetch(url, {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });
}

function sendTelegramPhoto(chatId, photoUrl, caption) {
  const token = SCRIPT_PROPERTIES.getProperty('TELEGRAM_BOT_TOKEN');
  const url = `[link removed]{token}/sendPhoto`;
  const payload = { chat_id: chatId, photo: photoUrl, caption: caption };
  UrlFetchApp.fetch(url, {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });
}
