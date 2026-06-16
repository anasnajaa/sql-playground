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
    columns: { town: 'town', supervisor: 'supervisor', salary: 'salary' },
  },
  {
    file: 'kuwait_governorate.csv',
    table: 'kuwait_governorate',
    columns: { id: 'id', governorate_en: 'governorate_en', governorate_ar: 'governorate_ar' },
  },
  {
    file: 'kuwait_area.csv',
    table: 'kuwait_area',
    columns: { area_name_en: 'area_name_en', area_name_ar: 'area_name_ar', id: 'id' },
  },
  {
    file: 'kuwait_education_level_by_gov.csv',
    table: 'kuwait_education_level_by_gov',
    columns: {
      'edu_Illiterate':                       'edu_illiterate',
      'edu_read_write':                       'edu_read_write',
      'edu_primary':                          'edu_primary',
      'edu_intermediate':                     'edu_intermediate',
      'edu_secondary':                        'edu_secondary',
      'edu_above_secondary_below_university': 'edu_above_secondary_below_university',
      'edu_university':                       'edu_university',
      'edu_above_university':                 'edu_above_university',
      'edu_not_stated':                       'edu_not_stated',
      'gender':                               'gender',
      'governorate_id':                       'governorate_id',
    },
  },
  {
    file: 'kuwait_nationality_by_gov.csv',
    table: 'kuwait_nationality_by_gov',
    columns: {
      'kuwaiti_male':       'kuwaiti_male',
      'kuwaiti_female':     'kuwaiti_female',
      'non_kuwaiti_male':   'non_kuwaiti_male',
      'non_kuwaiti_female': 'non_kuwaiti_female',
      'governorate_id':     'governorate_id',
    },
  },
  {
    file: 'kuwait_population_count_by_area.csv',
    table: 'kuwait_population_count_by_area',
    columns: { 'population_count': 'population_count', 'area_id': 'area_id' },
  },
  {
    file: 'kuwait_work_status_by_age_group.csv',
    table: 'kuwait_work_status_by_age_group',
    columns: {
      'age_group':             'age_group',
      'gender':                'gender',
      'government_worker':     'government_worker',
      'non_government_worker': 'non_government_worker',
      'domestic_worker':       'domestic_worker',
      'unemployed':            'unemployed',
      'student':               'student',
      'full_time_home_worker': 'full_time_home_worker',
      'retired_with_income':   'retired_with_income',
      'not_stated':            'not_stated',
    },
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

    const rows = parseCsv(fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, ''));
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
