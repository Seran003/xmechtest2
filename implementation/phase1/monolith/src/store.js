const XLSX = require("xlsx");
const path = require("path");

const DB_PATH = path.resolve(__dirname, "../../db_files/CRM_Datastore_Quickstart_v1.xlsx");

function readWorkbook() {
  return XLSX.readFile(DB_PATH);
}

function writeWorkbook(wb) {
  XLSX.writeFile(wb, DB_PATH);
}

function getSheetRows(wb, sheetName) {
  const ws = wb.Sheets[sheetName];
  if (!ws) return [];
  return XLSX.utils.sheet_to_json(ws, { defval: "" });
}

function replaceSheetRows(wb, sheetName, rows) {
  const ws = wb.Sheets[sheetName];
  if (!ws) {
    console.error(`Sheet "${sheetName}" not found in workbook`);
    return;
  }
  // Get existing headers from sheet to preserve column order
  const existing = XLSX.utils.sheet_to_json(ws, { header: 1 });
  const headers = (existing[0] || []).filter(Boolean);
  if (!headers.length) {
    console.error(`Sheet "${sheetName}" has no headers in row 1`);
    return;
  }
  // Build array-of-arrays: header row + data rows
  const data = [headers, ...rows.map(r => headers.map(h => r[h] ?? ""))];
  const newWs = XLSX.utils.aoa_to_sheet(data);
  wb.Sheets[sheetName] = newWs;
}

function nowIso() {
  return new Date().toISOString();
}

function nextId(prefix, rows, key) {
  const nums = rows
    .map(r => String(r[key] || ""))
    .filter(id => id.startsWith(prefix))
    .map(id => parseInt(id.slice(prefix.length), 10))
    .filter(n => !isNaN(n));
  const max = nums.length > 0 ? Math.max(...nums) : 0;
  return `${prefix}${String(max + 1).padStart(4, "0")}`;
}

module.exports = { readWorkbook, writeWorkbook, getSheetRows, replaceSheetRows, nowIso, nextId };