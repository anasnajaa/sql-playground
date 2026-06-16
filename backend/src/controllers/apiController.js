'use strict';

const { runQuery }      = require('../services/queryService');
const { resetDatabase } = require('../services/resetService');
const { getPool }       = require('../db/pool');
const { runStudentQuery } = require('../services/studentDbService');

// ── Allowlist patterns ────────────────────────────────────────────────────
const GUEST_ALLOWED = /^\s*(?:SELECT|WITH)\b/i;
const USER_ALLOWED  = /^\s*(?:SELECT|WITH|INSERT(?:\s+INTO)?|UPDATE|DELETE(?:\s+FROM)?|MERGE|TRUNCATE\s+TABLE|CREATE\s+TABLE|ALTER\s+TABLE|DROP\s+TABLE)\b/i;

function stripComments(sql) {
  return sql.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/--[^\r\n]*/g, ' ');
}
function firstInvalidStatement(sql, pattern) {
  return stripComments(sql).split(';').map(s => s.trim()).filter(Boolean).find(s => !pattern.test(s)) || null;
}

// ── POST /api/execute ─────────────────────────────────────────────────────
exports.execute = async (req, res) => {
  const { sql } = req.body;
  if (!sql || typeof sql !== 'string') {
    return res.status(400).json({ error: 'Request body must include a "sql" string field.' });
  }

  const role = req.user?.role;

  if (role === 'student' || role === 'instructor') {
    const bad = firstInvalidStatement(sql, USER_ALLOWED);
    if (bad) {
      return res.status(403).json({
        ok: false,
        error: 'Only SELECT, INSERT, UPDATE, DELETE, MERGE, TRUNCATE TABLE, CREATE TABLE, ALTER TABLE, and DROP TABLE are allowed.',
      });
    }
  } else {
    const bad = firstInvalidStatement(sql, GUEST_ALLOWED);
    if (bad) {
      return res.status(403).json({
        ok: false,
        error: 'Guest users may only run SELECT queries. Log in as a student to make changes.',
      });
    }
  }

  try {
    const result = (role === 'student' && req.user?.dbName)
      ? await runStudentQuery(req.user.dbName, sql)
      : await runQuery(sql);
    return res.json({ ok: true, ...result });
  } catch (err) {
    return res.status(400).json({ ok: false, error: err.message });
  }
};

// ── POST /api/admin/verify ────────────────────────────────────────────────
exports.adminVerify = (req, res) => res.json({ ok: true });

// ── POST /api/admin/reset ─────────────────────────────────────────────────
exports.adminReset = async (req, res) => {
  try {
    const result = await resetDatabase();
    return res.json({ ok: true, message: 'Database reset to baseline successfully.', ...result });
  } catch (err) {
    const status = err.message.includes('cooldown') || err.message.includes('in progress') ? 429 : 500;
    return res.status(status).json({ ok: false, error: err.message });
  }
};

// ── GET /api/ip ───────────────────────────────────────────────────────────
exports.getIp = (req, res) => {
  const ip = req.headers['x-forwarded-for']?.split(',')[0].trim()
          || req.socket?.remoteAddress
          || 'unknown';
  res.json({ ip });
};

// ── GET /api/health ───────────────────────────────────────────────────────
exports.health = async (req, res) => {
  try {
    const pool = await getPool();
    const r = pool.request();
    r.timeout = 3000;
    await r.query('SELECT 1 AS ok');
    return res.json({ ok: true, db: 'connected' });
  } catch (err) {
    return res.status(503).json({ ok: false, db: 'unreachable', error: err.message });
  }
};

// ── GET /api/status ───────────────────────────────────────────────────────
exports.status = async (req, res) => {
  const os       = require('os');
  const mongoose = require('mongoose');
  const { execSync } = require('child_process');

  let mssql = { ok: false, latencyMs: null, error: null };
  try {
    const t0   = Date.now();
    const pool = await getPool();
    const r    = pool.request();
    r.timeout  = 3000;
    const result = await r.query(`
      SELECT
        SERVERPROPERTY('ProductVersion') AS version,
        SERVERPROPERTY('Edition')        AS edition,
        (SELECT COUNT(*) FROM sys.databases WHERE name NOT IN ('master','tempdb','model','msdb')) AS userDbs
    `);
    mssql = {
      ok: true, latencyMs: Date.now() - t0,
      version: result.recordset[0].version,
      edition: result.recordset[0].edition,
      userDbs: result.recordset[0].userDbs,
    };
  } catch (err) { mssql.error = err.message; }

  let mongo = { ok: false, latencyMs: null, error: null };
  try {
    const t0    = Date.now();
    const state = mongoose.connection.readyState;
    if (state === 1) {
      await mongoose.connection.db.admin().ping();
      mongo = { ok: true, latencyMs: Date.now() - t0, state: 'connected' };
    } else {
      mongo = { ok: false, state: ['disconnected','connected','connecting','disconnecting'][state] || String(state) };
    }
  } catch (err) { mongo.error = err.message; }

  let docker = { ok: false, containers: [] };
  try {
    const raw = execSync(
      'docker ps --format "{{.Names}}\\t{{.Status}}\\t{{.Image}}" 2>/dev/null',
      { timeout: 4000, encoding: 'utf8' }
    ).trim();
    docker = {
      ok: true,
      containers: raw ? raw.split('\n').map(line => {
        const [name, status, image] = line.split('\t');
        return { name, status, image };
      }) : [],
    };
  } catch (err) { docker.error = err.message; }

  const totalMem = os.totalmem();
  const freeMem  = os.freemem();
  const usedMem  = totalMem - freeMem;
  const cpus     = os.cpus();
  const loadAvg  = os.loadavg();

  const system = {
    hostname:    os.hostname(),
    platform:    os.platform(),
    nodeVersion: process.version,
    uptime:      Math.floor(process.uptime()),
    memory: {
      totalMb: Math.round(totalMem / 1024 / 1024),
      usedMb:  Math.round(usedMem  / 1024 / 1024),
      freeMb:  Math.round(freeMem  / 1024 / 1024),
      usedPct: Math.round((usedMem / totalMem) * 100),
    },
    cpu: {
      model:      cpus[0]?.model || 'unknown',
      cores:      cpus.length,
      loadAvg1m:  Math.round(loadAvg[0] * 100) / 100,
      loadAvg5m:  Math.round(loadAvg[1] * 100) / 100,
      loadAvg15m: Math.round(loadAvg[2] * 100) / 100,
    },
  };

  res.json({ ok: true, mssql, mongo, docker, system });
};

// ── GET /api/schema ───────────────────────────────────────────────────────
const SCHEMA_QUERY = `
  SELECT t.TABLE_NAME AS tableName, c.COLUMN_NAME AS columnName,
         c.DATA_TYPE AS dataType, c.IS_NULLABLE AS nullable
  FROM INFORMATION_SCHEMA.TABLES t
  JOIN INFORMATION_SCHEMA.COLUMNS c
    ON c.TABLE_NAME = t.TABLE_NAME AND c.TABLE_SCHEMA = t.TABLE_SCHEMA
  WHERE t.TABLE_TYPE = 'BASE TABLE' AND t.TABLE_SCHEMA = 'dbo'
  ORDER BY t.TABLE_NAME, c.ORDINAL_POSITION;
`;

async function openStudentPool(dbName) {
  const sql = require('mssql');
  const cfg = {
    server:   process.env.MSSQL_HOST || '127.0.0.1',
    port:     parseInt(process.env.MSSQL_PORT || '1433', 10),
    user:     process.env.MSSQL_USER || 'sa',
    password: process.env.MSSQL_PASSWORD,
    database: dbName,
    options:  { trustServerCertificate: true, enableArithAbort: true },
    pool:     { max: 2, min: 0, idleTimeoutMillis: 10000 },
    connectionTimeout: 10000,
    requestTimeout:    5000,
  };
  return new sql.ConnectionPool(cfg).connect();
}

exports.schema = async (req, res) => {
  try {
    let pool;
    let ownPool = false;

    if (req.user?.role === 'student' && req.user?.dbName) {
      pool    = await openStudentPool(req.user.dbName);
      ownPool = true;
    } else {
      pool = await getPool();
    }

    try {
      const request = pool.request();
      request.timeout = 5000;
      const result  = await request.query(SCHEMA_QUERY);
      const tables  = {};
      for (const row of result.recordset) {
        if (!tables[row.tableName]) tables[row.tableName] = { name: row.tableName, columns: [] };
        tables[row.tableName].columns.push({ name: row.columnName, type: row.dataType, nullable: row.nullable === 'YES' });
      }
      return res.json({ ok: true, tables: Object.values(tables) });
    } finally {
      if (ownPool) await pool.close();
    }
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
};

// ── GET /api/erd ──────────────────────────────────────────────────────────
const COLUMNS_QUERY = `
  SELECT t.TABLE_NAME AS tableName, c.COLUMN_NAME AS columnName,
         c.DATA_TYPE AS dataType, c.IS_NULLABLE AS nullable
  FROM INFORMATION_SCHEMA.TABLES t
  JOIN INFORMATION_SCHEMA.COLUMNS c
    ON c.TABLE_NAME = t.TABLE_NAME AND c.TABLE_SCHEMA = t.TABLE_SCHEMA
  WHERE t.TABLE_TYPE = 'BASE TABLE' AND t.TABLE_SCHEMA = 'dbo'
  ORDER BY t.TABLE_NAME, c.ORDINAL_POSITION;
`;
const PKS_QUERY = `
  SELECT tc.TABLE_NAME AS tableName, kcu.COLUMN_NAME AS columnName
  FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
  JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE kcu
    ON kcu.CONSTRAINT_NAME = tc.CONSTRAINT_NAME AND kcu.TABLE_SCHEMA = tc.TABLE_SCHEMA
  WHERE tc.CONSTRAINT_TYPE = 'PRIMARY KEY' AND tc.TABLE_SCHEMA = 'dbo';
`;
const RELATIONS_QUERY = `
  SELECT fk.TABLE_NAME AS fromTable, fkc.COLUMN_NAME AS fromColumn,
         pk.TABLE_NAME AS toTable,   pkc.COLUMN_NAME AS toColumn
  FROM INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS rc
  JOIN INFORMATION_SCHEMA.TABLE_CONSTRAINTS fk  ON fk.CONSTRAINT_NAME  = rc.CONSTRAINT_NAME
  JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE  fkc ON fkc.CONSTRAINT_NAME = rc.CONSTRAINT_NAME AND fkc.TABLE_SCHEMA = fk.TABLE_SCHEMA
  JOIN INFORMATION_SCHEMA.TABLE_CONSTRAINTS pk  ON pk.CONSTRAINT_NAME  = rc.UNIQUE_CONSTRAINT_NAME
  JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE  pkc ON pkc.CONSTRAINT_NAME = rc.UNIQUE_CONSTRAINT_NAME AND pkc.TABLE_SCHEMA = pk.TABLE_SCHEMA
  WHERE fk.TABLE_SCHEMA = 'dbo';
`;

exports.erd = async (req, res) => {
  try {
    let pool;
    let ownPool = false;

    if (req.user?.role === 'student' && req.user?.dbName) {
      pool    = await openStudentPool(req.user.dbName);
      ownPool = true;
    } else {
      pool = await getPool();
    }

    try {
      const [colRes, pkRes, relRes] = await Promise.all([
        pool.request().query(COLUMNS_QUERY),
        pool.request().query(PKS_QUERY),
        pool.request().query(RELATIONS_QUERY),
      ]);
      const pkSet = new Set(pkRes.recordset.map(r => `${r.tableName}.${r.columnName}`));
      const tables = {};
      for (const row of colRes.recordset) {
        if (!tables[row.tableName]) tables[row.tableName] = { name: row.tableName, columns: [] };
        tables[row.tableName].columns.push({
          name: row.columnName, type: row.dataType,
          nullable: row.nullable === 'YES',
          isPk: pkSet.has(`${row.tableName}.${row.columnName}`),
        });
      }
      return res.json({
        ok: true,
        tables: Object.values(tables),
        relations: relRes.recordset.map(r => ({
          fromTable: r.fromTable, fromColumn: r.fromColumn,
          toTable: r.toTable,   toColumn: r.toColumn,
        })),
      });
    } finally {
      if (ownPool) await pool.close();
    }
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
};
