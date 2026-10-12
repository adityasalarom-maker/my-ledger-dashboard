/**
 * =================================================================================
 * UNIFIED GOOGLE APPS SCRIPT: CHRONOLOGICAL ROW INSERTION & LEDGER SYNC
 * =================================================================================
 * 
 * Works for both:
 * 1. "ag LEDGER 2026" (ID: 1qVzr4XNstdYC7aqjLw_ueghBhrKJmIZkPKHeAp4UH-4)
 * 2. "w LEDGER 2026 n" (ID: 1uocVkm6qYpuM6zxhv2Hs8tHM-OthlTSOdxBZiRDWziE)
 * 
 * STRICT COLUMN H (BALANCE) PRESERVATION RULE:
 * Column H (Column 8) is NEVER overwritten, touched, or modified for ANY
 * action (insert, add, or edit).
 * Writes are strictly split into:
 *   - Columns A to G (1 to 7): Date, By, For, Item, Exp Acc, Cat, Amt Exp
 *   - Columns I to M (9 to 13): Info, Amt In, Inc Acc, Blank, Month
 * Column H remains completely untouched so all sheet balance calculations
 * and formulas are 100% preserved.
 */

// =================================================================================
// PART 1: WEBHOOK RECEIVER FOR IN-DASHBOARD '+' BUTTON & EDITS (METHOD 1)
// =================================================================================
function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return makeJsonResponse({ status: 'error', message: 'No payload received' });
    }

    var payload = JSON.parse(e.postData.contents);
    var action = payload.action; // 'insert_transaction', 'add_transaction', 'edit_transaction', 'delete_row', 'clear_row_489_balance'
    var sheetName = payload.sheetName || 'LEDGER';
    var data = payload.data || {};
    var rowNum = Number(payload.row);

    // Support dual sheet target dynamically via sheetId
    var ss;
    if (payload.sheetId && String(payload.sheetId).length > 15) {
      try {
        ss = SpreadsheetApp.openById(payload.sheetId);
      } catch(openErr) {
        ss = SpreadsheetApp.getActiveSpreadsheet();
      }
    } else {
      ss = SpreadsheetApp.getActiveSpreadsheet();
    }

    var sheet = ss.getSheetByName(sheetName) || ss.getSheets()[0];

    // Determine normalized Month abbreviation from date
    var monthAbbr = getMonthAbbreviation(data.date);

    // Columns A to G (Columns 1 to 7)
    var colsA_to_G = [
      data.date || '',
      data.by || 'Honey',
      data.for || 'Home',
      data.item || '',
      data.exp_acc || 'Hom Cash',
      data.cat || 'misc expn',
      Number(data.amt_exp) > 0 ? Number(data.amt_exp) : ''
    ];

    // Columns I to M (Columns 9 to 13) - SKIP COLUMN H (COLUMN 8) COMPLETELY!
    var colsI_to_M = [
      data.info || '',
      Number(data.amt_in) > 0 ? Number(data.amt_in) : '',
      data.inc_acc || '',
      '',
      monthAbbr
    ];

    // Safe writer: writes Columns A-G and Columns I-M, NEVER touching Column H (8)
    function writeRowPreservingColumnH(targetSheet, r) {
      targetSheet.getRange(r, 1, 1, 7).setValues([colsA_to_G]);
      targetSheet.getRange(r, 9, 1, 5).setValues([colsI_to_M]);
    }

    // 1. Explicit in-place row insertion (sent from mobile dashboard when middle insertion is detected)
    if (action === 'insert_transaction') {
      var insertAfterRow = Number(payload.insertAfterRow);
      if (!insertAfterRow || insertAfterRow < 1) {
        insertAfterRow = findLastRowBeforeDate(sheet, data.date);
      }
      sheet.insertRowAfter(insertAfterRow);
      var targetRow = insertAfterRow + 1;
      writeRowPreservingColumnH(sheet, targetRow);
      return makeJsonResponse({
        status: 'success',
        action: action,
        row: targetRow,
        insertedAfter: insertAfterRow,
        sheetName: sheet.getName(),
        message: 'Transaction inserted after row ' + insertAfterRow + ' at row ' + targetRow
      });
    }

    // 2. Add transaction with automatic date checking
    if (action === 'add_transaction') {
      var nextBlank = findNextBlankDateRow(sheet);
      var lastBefore = findLastRowBeforeDate(sheet, data.date);

      // If date falls before latest entry, insert in the middle
      if (lastBefore > 0 && lastBefore < nextBlank - 1) {
        sheet.insertRowAfter(lastBefore);
        var targetRow = lastBefore + 1;
        writeRowPreservingColumnH(sheet, targetRow);
        return makeJsonResponse({
          status: 'success',
          action: 'insert_transaction',
          row: targetRow,
          insertedAfter: lastBefore,
          sheetName: sheet.getName(),
          message: 'Transaction auto-inserted after row ' + lastBefore + ' at row ' + targetRow
        });
      } else {
        // Normal append at the bottom of the sheet
        writeRowPreservingColumnH(sheet, nextBlank);
        return makeJsonResponse({
          status: 'success',
          action: 'add_transaction',
          row: nextBlank,
          sheetName: sheet.getName(),
          message: 'Transaction successfully written at row ' + nextBlank
        });
      }
    }

    // 3. Edit transaction in-place (NEVER touches Column H)
    if (action === 'edit_transaction') {
      var targetRow = (rowNum && rowNum >= 2) ? rowNum : findNextBlankDateRow(sheet);
      writeRowPreservingColumnH(sheet, targetRow);
      return makeJsonResponse({
        status: 'success',
        action: action,
        row: targetRow,
        sheetName: sheet.getName(),
        message: 'Transaction successfully written at row ' + targetRow
      });
    }

    // 4. Delete row
    if (action === 'delete_row') {
      var delRow = Number(payload.row);
      if (delRow >= 2 && delRow <= sheet.getLastRow()) {
        sheet.deleteRow(delRow);
        return makeJsonResponse({
          status: 'success',
          action: action,
          row: delRow,
          sheetName: sheet.getName(),
          message: 'Row ' + delRow + ' deleted successfully'
        });
      }
    }

    // 5. Utility action: clear Column H on Row 489 if requested
    if (action === 'clear_row_489_balance') {
      sheet.getRange(489, 8).clearContent();
      return makeJsonResponse({
        status: 'success',
        action: action,
        message: 'Cleared Column H on Row 489'
      });
    }

    return makeJsonResponse({ status: 'error', message: 'Unknown action: ' + action });

  } catch (err) {
    return makeJsonResponse({ status: 'error', message: err.toString() });
  }
}

function doGet(e) {
  return makeJsonResponse({
    status: 'online',
    message: 'Google Apps Script Ledger Sync Webhook is Active with Column H Balance Protection!'
  });
}

// =================================================================================
// PART 2: GOOGLE FORM AUTOMATIC APPEND TRIGGER (METHOD 2)
// =================================================================================
function onFormSubmit(e) {
  try {
    if (!e || !e.values) return;
    
    var vals = e.values;
    var rawDate = vals[1] || '';
    var by = vals[2] || 'Honey';
    var forEntity = vals[3] || 'Home';
    var item = vals[4] || '';
    var cat = vals[5] || 'misc expn';
    var expAcc = vals[6] || 'Hom Cash';
    var amtExp = cleanFormNumber(vals[7]);
    var info = vals[8] || '';
    var type = (vals[9] || 'Expense').toLowerCase();
    var amtIn = 0;
    var incAcc = '';

    if (type.indexOf('income') !== -1 || type.indexOf('credit') !== -1) {
      amtIn = amtExp;
      amtExp = 0;
      incAcc = expAcc;
      expAcc = '';
    }

    var formattedDate = formatDateStandard(rawDate);
    var monthAbbr = getMonthAbbreviation(formattedDate);

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var ledgerSheet = ss.getSheetByName('LEDGER');
    if (!ledgerSheet) return;

    var colsA_to_G = [
      formattedDate,
      by,
      forEntity,
      item,
      expAcc,
      cat,
      amtExp > 0 ? amtExp : ''
    ];

    var colsI_to_M = [
      info,
      amtIn > 0 ? amtIn : '',
      incAcc,
      '',
      monthAbbr
    ];

    var nextBlank = findNextBlankDateRow(ledgerSheet);
    var lastBefore = findLastRowBeforeDate(ledgerSheet, formattedDate);

    if (lastBefore > 0 && lastBefore < nextBlank - 1) {
      ledgerSheet.insertRowAfter(lastBefore);
      var targetRow = lastBefore + 1;
      ledgerSheet.getRange(targetRow, 1, 1, 7).setValues([colsA_to_G]);
      ledgerSheet.getRange(targetRow, 9, 1, 5).setValues([colsI_to_M]);
      Logger.log('Auto-inserted form entry after row ' + lastBefore + ' at row ' + targetRow);
    } else {
      ledgerSheet.getRange(nextBlank, 1, 1, 7).setValues([colsA_to_G]);
      ledgerSheet.getRange(nextBlank, 9, 1, 5).setValues([colsI_to_M]);
      Logger.log('Saved form entry to LEDGER row ' + nextBlank);
    }

  } catch (err) {
    Logger.log('Error in onFormSubmit: ' + err.toString());
  }
}

// =================================================================================
// UTILITY: 1-CLICK CLEANUP FOR COLUMN H ON ROW 489
// Run this function from Apps Script Editor (Run > clearRow489Balance)
// =================================================================================
function clearRow489Balance() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('LEDGER') || ss.getSheets()[0];
  sheet.getRange(489, 8).clearContent();
  Logger.log('Successfully cleared Column H on Row 489.');
}

// =================================================================================
// HELPER FUNCTIONS
// =================================================================================

function parseLedgerDate(dateVal) {
  if (!dateVal) return null;
  if (dateVal instanceof Date) return dateVal;
  var str = String(dateVal).trim();
  
  var months = {
    'jan':0, 'feb':1, 'mar':2, 'apr':3, 'may':4, 'jun':5,
    'jul':6, 'aug':7, 'sep':8, 'oct':9, 'nov':10, 'dec':11,
    'une':5
  };
  
  var parts = str.split(/[-/ ]+/);
  if (parts.length >= 2) {
    var day = parseInt(parts[0], 10);
    var mToken = parts[1].toLowerCase().slice(0, 3);
    var m = months[mToken];
    var year = parts.length >= 3 ? parseInt(parts[2], 10) : 2026;
    if (isNaN(year) || year < 100) year = 2026;
    if (!isNaN(day) && m !== undefined) {
      return new Date(Date.UTC(year, m, day));
    }
  }
  
  var d = new Date(str);
  if (!isNaN(d.getTime())) return d;
  return null;
}

function findLastRowBeforeDate(sheet, targetDateStr) {
  var targetDate = parseLedgerDate(targetDateStr);
  if (!targetDate) return findNextBlankDateRow(sheet) - 1;

  var targetTime = targetDate.getTime();
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return 1;

  var dateColValues = sheet.getRange(1, 1, lastRow, 1).getValues();
  var lastRowBefore = 1;

  for (var i = 1; i < dateColValues.length; i++) {
    var cellVal = dateColValues[i][0];
    if (cellVal === null || cellVal === undefined || String(cellVal).trim() === '') continue;

    var rowDate = parseLedgerDate(cellVal);
    if (rowDate && rowDate.getTime() <= targetTime) {
      lastRowBefore = i + 1;
    }
  }

  return lastRowBefore;
}

function findNextBlankDateRow(sheet) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return 2;
  
  var dateColValues = sheet.getRange(1, 1, lastRow, 1).getValues();
  var lastFilledRow = 1;
  for (var i = 1; i < dateColValues.length; i++) {
    var d = dateColValues[i][0];
    if (d !== null && d !== undefined && String(d).trim().length > 0) {
      lastFilledRow = i + 1;
    }
  }
  return lastFilledRow + 1;
}

function getMonthAbbreviation(dateStr) {
  if (!dateStr) return '';
  var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  var parts = String(dateStr).split(/[-/ ]+/);
  if (parts.length >= 2) {
    for (var i = 0; i < months.length; i++) {
      if (parts[1].toLowerCase().indexOf(months[i].toLowerCase()) !== -1) {
        return months[i];
      }
    }
    if (parts[1].toLowerCase().indexOf('une') !== -1) return 'Jun';
  }
  return '';
}

function formatDateStandard(rawDate) {
  if (!rawDate) {
    var now = new Date();
    var m = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return now.getDate() + '-' + m[now.getMonth()] + '-' + now.getFullYear();
  }
  var d = new Date(rawDate);
  if (!isNaN(d.getTime())) {
    var m = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return d.getDate() + '-' + m[d.getMonth()] + '-' + d.getFullYear();
  }
  return String(rawDate).trim();
}

function cleanFormNumber(val) {
  if (!val) return 0;
  var cleaned = String(val).replace(/,/g, '').replace(/₹/g, '').replace(/Rs\./gi, '').trim();
  var num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

function makeJsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
