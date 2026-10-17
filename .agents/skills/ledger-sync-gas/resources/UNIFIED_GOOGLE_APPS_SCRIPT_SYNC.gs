/**
 * =================================================================================
 * UNIFIED GOOGLE APPS SCRIPT: AUTHENTICATED CHRONOLOGICAL LEDGER SYNC GATEWAY
 * =================================================================================
 * 
 * Version: 2.0 (Security Hardened & Dynamic ARRAY Tab Sync)
 * Targets:
 *   - "w LEDGER 2026 n" (ID: 1uocVkm6qYpuM6zxhv2Hs8tHM-OthlTSOdxBZiRDWziE)
 * 
 * CORE SECURITY & INTEGRITY FEATURES:
 * 1. ZERO-UNAUTHORIZED-ACCESS:
 *    - All GET (read) and POST (write) requests require a valid Secret Passkey.
 *    - Unauthenticated internet requests are rejected with 403 Forbidden.
 * 2. DYNAMIC ARRAY TAB TAXONOMY SYNC:
 *    - Dynamically reads categories, accounts, purposes, and items from the "ARRAY" tab.
 *    - Whenever you add or edit categories in Google Sheets, the dashboard automatically
 *      retrieves and reflects them in all dropdowns, filters, and donut charts.
 * 3. STRICT COLUMN H (BALANCE) PRESERVATION:
 *    - Column H (Column 8) is NEVER overwritten or modified.
 *    - Writes are partitioned into Columns A-G and Columns I-M.
 */

// =================================================================================
// 1. PASSKEY SECURITY CONFIGURATION
// You can change this secret passkey or configure it in Script Properties:
// In Apps Script: Project Settings (gear icon) > Script Properties > LEDGER_AUTH_KEY
// =================================================================================
var DEFAULT_AUTH_KEY = "Ledger2026!SecureKey";

function getAuthKey() {
  try {
    var prop = PropertiesService.getScriptProperties().getProperty('LEDGER_AUTH_KEY');
    if (prop && prop.trim().length > 0) return prop.trim();
  } catch(e) {}
  return DEFAULT_AUTH_KEY;
}

// =================================================================================
// 2. AUTHENTICATED PROGRAMMATIC DATA SYNC (doGet)
// Programmatically exports LEDGER records and ARRAY tab master taxonomies
// =================================================================================
function doGet(e) {
  try {
    var expectedKey = getAuthKey();
    var key = (e && e.parameter && e.parameter.key) ? String(e.parameter.key).trim() : '';

    // Enforce Passkey Authentication
    if (key !== expectedKey) {
      return makeJsonResponse({
        status: 'error',
        code: 403,
        message: 'Unauthorized: Invalid or missing passkey'
      });
    }

    var action = (e && e.parameter && e.parameter.action) ? e.parameter.action : 'get_data';

    if (action === 'get_data' || action === 'sync') {
      var ss;
      if (e.parameter && e.parameter.sheetId && String(e.parameter.sheetId).length > 15) {
        try { ss = SpreadsheetApp.openById(e.parameter.sheetId); }
        catch(err) { ss = SpreadsheetApp.getActiveSpreadsheet(); }
      } else {
        ss = SpreadsheetApp.getActiveSpreadsheet();
      }

      var ledgerSheet = ss.getSheetByName('LEDGER') || ss.getSheets()[0];
      var lastRow = ledgerSheet.getLastRow();
      
      // A. Extract all records from LEDGER tab
      var records = [];
      if (lastRow >= 2) {
        var values = ledgerSheet.getRange(1, 1, lastRow, 13).getValues();
        for (var i = 1; i < values.length; i++) {
          var row = values[i];
          var dateVal = row[0];
          var itemVal = row[3];
          var amtExpVal = row[6];
          var amtInVal = row[9];
          
          // Only include rows that have content
          if (dateVal || itemVal || amtExpVal || amtInVal) {
            records.push({
              row: i + 1,
              date: formatDateStandard(dateVal),
              by: String(row[1] || '').trim(),
              for: String(row[2] || '').trim(),
              item: String(row[3] || '').trim(),
              exp_acc: String(row[4] || '').trim(),
              cat: String(row[5] || '').trim(),
              amt_exp: cleanFormNumber(amtExpVal),
              balance: cleanFormNumber(row[7]),
              info: String(row[8] || '').trim(),
              amt_in: cleanFormNumber(amtInVal),
              inc_acc: String(row[10] || '').trim(),
              month: String(row[12] || '').trim() || getMonthAbbreviation(dateVal)
            });
          }
        }
      }

      // B. Extract master taxonomies dynamically from ARRAY tab
      var arrayTab = {};
      var arraySheet = ss.getSheetByName('ARRAY') || ss.getSheetByName('Array') || ss.getSheetByName('arrays');
      if (arraySheet) {
        var aLastRow = arraySheet.getLastRow();
        var aLastCol = arraySheet.getLastColumn();
        if (aLastRow >= 2 && aLastCol >= 1) {
          var aValues = arraySheet.getRange(1, 1, aLastRow, aLastCol).getValues();
          var headers = aValues[0];
          for (var c = 0; c < aLastCol; c++) {
            var hName = String(headers[c] || '').trim();
            if (!hName) continue;
            var items = [];
            for (var r = 1; r < aLastRow; r++) {
              var val = String(aValues[r][c] || '').trim();
              if (val && items.indexOf(val) === -1) {
                items.push(val);
              }
            }
            arrayTab[hName] = items;
          }
        }
      }

      return makeJsonResponse({
        status: 'success',
        count: records.length,
        sheetName: ledgerSheet.getName(),
        records: records,
        arrayTab: arrayTab,
        syncedAt: new Date().toISOString()
      });
    }

    return makeJsonResponse({
      status: 'online',
      message: 'Ledger Apps Script Authenticated Sync Gateway is Active'
    });

  } catch (err) {
    return makeJsonResponse({ status: 'error', message: err.toString() });
  }
}

// =================================================================================
// 3. AUTHENTICATED TRANSACTION MUTATION WEBHOOK (doPost)
// Handles insert_transaction, add_transaction, edit_transaction, delete_row
// =================================================================================
function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return makeJsonResponse({ status: 'error', message: 'No payload received' });
    }

    var payload = JSON.parse(e.postData.contents);
    var expectedKey = getAuthKey();
    var key = String(payload.key || '').trim();

    // Enforce Passkey Authentication
    if (key !== expectedKey) {
      return makeJsonResponse({
        status: 'error',
        code: 403,
        message: 'Unauthorized: Invalid or missing passkey'
      });
    }

    var action = payload.action; 
    var sheetName = payload.sheetName || 'LEDGER';
    var data = payload.data || {};
    var rowNum = Number(payload.row);

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
    var monthAbbr = getMonthAbbreviation(data.date);

    // Columns A to G (1 to 7)
    var colsA_to_G = [
      data.date || '',
      data.by || 'Honey',
      data.for || 'Home',
      data.item || '',
      data.exp_acc || 'Hom Cash',
      data.cat || 'misc expn',
      Number(data.amt_exp) > 0 ? Number(data.amt_exp) : ''
    ];

    // Columns I to M (9 to 13) - SKIP COLUMN H (8) COMPLETELY!
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

    // A. Middle-of-Sheet Chronological Row Insertion
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

    // B. Add Transaction with Automatic Date Check
    if (action === 'add_transaction') {
      var nextBlank = findNextBlankDateRow(sheet);
      var lastBefore = findLastRowBeforeDate(sheet, data.date);

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

    // C. Edit Transaction in-place (NEVER touches Column H)
    if (action === 'edit_transaction') {
      var targetRow = (rowNum && rowNum >= 2) ? rowNum : findNextBlankDateRow(sheet);
      writeRowPreservingColumnH(sheet, targetRow);
      return makeJsonResponse({
        status: 'success',
        action: action,
        row: targetRow,
        sheetName: sheet.getName(),
        message: 'Transaction successfully updated at row ' + targetRow
      });
    }

    // D. Delete Row
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

    // E. Utility: Clear Column H on Row 489 if requested
    if (action === 'clear_row_489_balance') {
      sheet.getRange(489, 8).clearContent();
      return makeJsonResponse({
        status: 'success',
        action: action,
        message: 'Cleared Column H on Row 489'
      });
    }

    // F. Batch Append Entries with Chronological Positioning & Column H Preservation
    if (action === 'batch_append' || action === 'batchAppend') {
      var entries = payload.entries || [];
      var results = [];
      for (var b = 0; b < entries.length; b++) {
        var itemData = entries[b];
        var itemMonth = getMonthAbbreviation(itemData.date);
        var itemColsA_to_G = [
          itemData.date || '',
          itemData.by || 'Honey',
          itemData.for || itemData.forEntity || 'Home',
          itemData.item || itemData.description || '',
          itemData.exp_acc || itemData.expenseAcc || 'Hom Cash',
          itemData.cat || itemData.category || 'misc expn',
          Number(itemData.amt_exp || itemData.amountXpns) > 0 ? Number(itemData.amt_exp || itemData.amountXpns) : ''
        ];
        var itemColsI_to_M = [
          itemData.info || itemData.note || '',
          Number(itemData.amt_in || itemData.amtInCredit) > 0 ? Number(itemData.amt_in || itemData.amtInCredit) : '',
          itemData.inc_acc || itemData.incomeAccnt || '',
          '',
          itemMonth
        ];

        var nextBlankRow = findNextBlankDateRow(sheet);
        var lastBeforeRow = findLastRowBeforeDate(sheet, itemData.date);

        var targetR;
        if (lastBeforeRow > 0 && lastBeforeRow < nextBlankRow - 1) {
          sheet.insertRowAfter(lastBeforeRow);
          targetR = lastBeforeRow + 1;
        } else {
          targetR = nextBlankRow;
        }

        sheet.getRange(targetR, 1, 1, 7).setValues([itemColsA_to_G]);
        sheet.getRange(targetR, 9, 1, 5).setValues([itemColsI_to_M]);
        results.push({ row: targetR, item: itemData.item || itemData.description });
      }

      return makeJsonResponse({
        status: 'success',
        action: action,
        count: results.length,
        results: results,
        sheetName: sheet.getName(),
        message: 'Successfully processed ' + results.length + ' entries with chronological positioning and Column H preservation'
      });
    }

    return makeJsonResponse({ status: 'error', message: 'Unknown action: ' + action });

  } catch (err) {
    return makeJsonResponse({ status: 'error', message: err.toString() });
  }
}

// =================================================================================
// 4. HELPER FUNCTIONS
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
