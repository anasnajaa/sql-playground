'use strict';

const fs   = require('fs');
const path = require('path');
const sql  = require('mssql');
const { getPool } = require('../db/pool');
const { runQuery } = require('./queryService');

const SEED_PATH = path.join(__dirname, '../../resources/seed.sql');

// ── Shared base config (no database set — used for cross-DB admin ops) ──────
function baseConfig() {
  return {
    server:  process.env.MSSQL_HOST || '127.0.0.1',
    port:    parseInt(process.env.MSSQL_PORT || '1433', 10),
    user:    process.env.MSSQL_USER || 'sa',
    password: process.env.MSSQL_PASSWORD,
    database: 'master',
    options: { trustServerCertificate: true, enableArithAbort: true },
    pool: { max: 3, min: 0, idleTimeoutMillis: 10000 },
    connectionTimeout: 10000,
    requestTimeout: 20000,
  };
}

/**
 * Sanitize a string to be safe as part of an MSSQL identifier.
 * Lowercase, replace non-alphanumeric with _.
 */
function sanitizeIdPart(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
}

/**
 * Build the student database name from enrollment fields.
 * e.g. sp_ktech_03_2025_2026_it101_240100796
 */
function buildDbName(org, semesterShortCode, courseCode, studentId) {
  const parts = [
    'sp',
    sanitizeIdPart(org),
    sanitizeIdPart(semesterShortCode),
    sanitizeIdPart(courseCode),
    sanitizeIdPart(studentId),
  ];
  return parts.join('_');
}

// ── Seed helpers (reused from resetService pattern) ──────────────────────────
function parseSeedStatements(raw) {
  const cleaned = raw.split('\n')
    .filter(l => !l.trim().startsWith('--'))
    .join('\n');
  const batches = cleaned.split(/^\s*GO\s*$/im);
  const stmts = [];
  for (const batch of batches) {
    for (const part of batch.split(';')) {
      const s = part.trim();
      if (s.length > 0) stmts.push(s);
    }
  }
  return stmts;
}

/**
 * Seed a specific database (run seed.sql statements + CSV imports inside it).
 * Uses a dedicated one-off connection scoped to that database.
 */
async function seedDatabase(dbName) {
  const cfg = { ...baseConfig(), database: dbName, requestTimeout: 15000 };
  const pool = await new sql.ConnectionPool(cfg).connect();
  try {
    const raw  = fs.readFileSync(SEED_PATH, 'utf8');
    const stmts = parseSeedStatements(raw);
    for (const stmt of stmts) {
      const req = pool.request();
      req.timeout = 15000;
      await req.query(stmt);
    }
    // CSV imports (supervisor_salaries)
    await _importCsvs(pool);
  } finally {
    await pool.close();
  }
}

async function _importCsvs(pool) {
  const CSV_IMPORTS = [
    {
      file: path.join(__dirname, '../../resources/supervisor_salaries.csv'),
      table: 'supervisor_salaries',
      columns: { town: 'town', supervisor: 'supervisor', salary: 'salary' },
    },
  ];
  for (const def of CSV_IMPORTS) {
    if (!fs.existsSync(def.file)) continue;
    const lines = fs.readFileSync(def.file, 'utf8').trim().split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length < 2) continue;
    const headers = lines[0].split(',').map(h => h.trim());
    const csvCols = Object.keys(def.columns);
    const dbCols  = Object.values(def.columns);
    for (const line of lines.slice(1)) {
      const vals = line.split(',').map(v => v.trim());
      const row  = {};
      headers.forEach((h, i) => { row[h] = vals[i] ?? null; });
      const req = pool.request();
      const placeholders = dbCols.map((col, i) => {
        const val = row[csvCols[i]] ?? null;
        req.input(`p${i}`, val === '' ? null : val);
        return `@p${i}`;
      });
      req.timeout = 10000;
      await req.query(`INSERT INTO ${def.table} (${dbCols.join(', ')}) VALUES (${placeholders.join(', ')})`);
    }
  }
}

/**
 * Create a new student database and seed it with the baseline data.
 * No-op if the database already exists.
 */
async function createStudentDb(dbName) {
  const masterPool = await getPool(); // sa on SqlPlayground; switch to master for DDL
  const createReq = masterPool.request();
  createReq.timeout = 20000;
  // CREATE DATABASE only if it doesn't exist
  await createReq.query(`
    IF NOT EXISTS (SELECT name FROM sys.databases WHERE name = N'${dbName}')
    BEGIN
      EXEC('CREATE DATABASE [${dbName}]');
    END
  `);
  await seedDatabase(dbName);
}

/**
 * Drop all user tables in the student database, then re-seed.
 */
async function resetStudentDb(dbName) {
  const cfg  = { ...baseConfig(), database: dbName, requestTimeout: 15000 };
  const pool = await new sql.ConnectionPool(cfg).connect();
  try {
    // Drop all FK constraints first, then all tables
    const dropFks = await pool.request().query(`
      SELECT 'ALTER TABLE [' + TABLE_SCHEMA + '].[' + TABLE_NAME + '] DROP CONSTRAINT [' + CONSTRAINT_NAME + ']' AS cmd
      FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
      WHERE CONSTRAINT_TYPE = 'FOREIGN KEY'
    `);
    for (const r of dropFks.recordset) {
      await pool.request().query(r.cmd);
    }
    const dropTables = await pool.request().query(`
      SELECT 'DROP TABLE [' + TABLE_SCHEMA + '].[' + TABLE_NAME + ']' AS cmd
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_TYPE = 'BASE TABLE' AND TABLE_SCHEMA = 'dbo'
    `);
    for (const r of dropTables.recordset) {
      await pool.request().query(r.cmd);
    }
  } finally {
    await pool.close();
  }
  await seedDatabase(dbName);
}

/**
 * Create an MSSQL login + user + db_owner role for the student.
 * loginName: the SQL login name (e.g. "240100796")
 * password:  plaintext (MSSQL will enforce its own policy — we meet it with our generator)
 * dbName:    the student's database
 */
async function createStudentMssqlLogin(loginName, password, dbName) {
  const masterPool = await getPool();

  // Create or update login at server level
  const loginReq = masterPool.request();
  loginReq.timeout = 10000;
  await loginReq.query(`
    IF NOT EXISTS (SELECT name FROM sys.server_principals WHERE name = N'${loginName}')
      CREATE LOGIN [${loginName}] WITH PASSWORD = '${password.replace(/'/g, "''")}', CHECK_POLICY = OFF
    ELSE
      ALTER LOGIN [${loginName}] WITH PASSWORD = '${password.replace(/'/g, "''")}'
  `);

  // Create or ensure user in the student's DB
  const cfg  = { ...baseConfig(), database: dbName, requestTimeout: 10000 };
  const dbPool = await new sql.ConnectionPool(cfg).connect();
  try {
    await dbPool.request().query(`
      IF NOT EXISTS (SELECT name FROM sys.database_principals WHERE name = N'${loginName}')
        CREATE USER [${loginName}] FOR LOGIN [${loginName}]
    `);
    await dbPool.request().query(`
      ALTER ROLE db_owner ADD MEMBER [${loginName}]
    `);
  } finally {
    await dbPool.close();
  }
}

/**
 * Execute a SQL statement in the context of a specific student database.
 * Uses a one-off connection so there's no cross-DB context pollution.
 */
async function runStudentQuery(dbName, sqlText) {
  const cfg  = { ...baseConfig(), database: dbName, requestTimeout: parseInt(process.env.QUERY_TIMEOUT_MS || '5000', 10) };
  const pool = await new sql.ConnectionPool(cfg).connect();
  try {
    return await runQuery(sqlText, pool);
  } finally {
    await pool.close();
  }
}

/**
 * Drop the student database and the associated MSSQL login.
 * Safe to call even if the DB or login doesn't exist.
 */
async function dropStudentDb(dbName, loginName) {
  const pool = await new sql.ConnectionPool(baseConfig()).connect();
  try {
    // Kill active connections then drop the database
    await pool.request().query(`
      IF EXISTS (SELECT name FROM sys.databases WHERE name = N'${dbName}')
      BEGIN
        ALTER DATABASE [${dbName}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
        DROP DATABASE [${dbName}];
      END
    `);
    // Drop the login if provided
    if (loginName) {
      await pool.request().query(`
        IF EXISTS (SELECT name FROM sys.server_principals WHERE name = N'${loginName}')
          DROP LOGIN [${loginName}]
      `);
    }
  } finally {
    await pool.close();
  }
}

module.exports = {
  buildDbName,
  createStudentDb,
  resetStudentDb,
  dropStudentDb,
  createStudentMssqlLogin,
  runStudentQuery,
};
