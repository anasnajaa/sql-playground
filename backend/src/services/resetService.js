'use strict';

const fs = require('fs');
const path = require('path');
const { getPool } = require('../db/pool');

const SEED_PATH = path.join(__dirname, '../../resources/seed.sql');
const CSV_DIR   = path.join(__dirname, '../../resources');
const COOLDOWN_MS = parseInt(process.env.RESET_COOLDOWN_MS || '30000', 10);

// CSV table definitions: filename → { table, columns }
// Only columns present in the CSV need to be listed; others default to NULL.
const CSV_IMPORTS = [
  {
    file: 'supervisor_salaries.csv',
    table: 'supervisor_salaries',
    // maps CSV header name → DB column name (identity columns are omitted)
    columns: { town: 'town', supervisor: 'supervisor', salary: 'salary' },
  },
];

// Parse a simple CSV (first row = headers, comma-delimited, no quoted commas)
function parseCsv(raw) {
  const lines = raw.trim().split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h => h.trim());
  return lines.slice(1).map(line => {
    const vals = line.split(',').map(v => v.trim());
    const row = {};
    headers.forEach((h, i) => { row[h] = vals[i] ?? null; });
    return row;
  });
}

async function importCsvs(pool) {
  for (const def of CSV_IMPORTS) {
    const filePath = path.join(CSV_DIR, def.file);
    if (!fs.existsSync(filePath)) continue;

    const rows = parseCsv(fs.readFileSync(filePath, 'utf8'));
    const dbCols = Object.values(def.columns);
    const csvCols = Object.keys(def.columns);

    for (const row of rows) {
      const req = pool.request();
      const placeholders = dbCols.map((col, i) => {
        const val = row[csvCols[i]] ?? null;
        req.input(`p${i}`, val === '' ? null : val);
        return `@p${i}`;
      });
      const sql = `INSERT INTO ${def.table} (${dbCols.join(', ')}) VALUES (${placeholders.join(', ')})`;
      req.timeout = 10000;
      await req.query(sql);
    }
  }
}


let lastResetAt = 0;
let resetInProgress = false;

// Split the seed file into individual statements (split on GO or semicolons).
function parseSeedStatements(raw) {
  // Remove line comments
  const cleaned = raw
    .split('\n')
    .filter((line) => !line.trim().startsWith('--'))
    .join('\n');

  // Split on GO (batch separator) first, then on semicolons within each batch.
  const batches = cleaned.split(/^\s*GO\s*$/im);
  const statements = [];
  for (const batch of batches) {
    const parts = batch.split(';');
    for (const part of parts) {
      const s = part.trim();
      if (s.length > 0) statements.push(s);
    }
  }
  return statements;
}

async function resetDatabase() {
  const now = Date.now();
  const elapsed = now - lastResetAt;

  if (elapsed < COOLDOWN_MS) {
    const wait = Math.ceil((COOLDOWN_MS - elapsed) / 1000);
    throw new Error(`Reset is on cooldown. Please wait ${wait} more second(s).`);
  }

  if (resetInProgress) {
    throw new Error('A reset is already in progress. Please wait a moment and try again.');
  }

  resetInProgress = true;
  const start = Date.now();

  try {
    const raw = fs.readFileSync(SEED_PATH, 'utf8');
    const statements = parseSeedStatements(raw);

    const pool = await getPool();
    for (const stmt of statements) {
      const req = pool.request();
      req.timeout = 15000; // generous timeout for DDL
      await req.query(stmt);
    }

    await importCsvs(pool);

    lastResetAt = Date.now();
    return { durationMs: Date.now() - start, statementsExecuted: statements.length };
  } finally {
    resetInProgress = false;
  }
}

module.exports = { resetDatabase };
