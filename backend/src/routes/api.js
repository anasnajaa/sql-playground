'use strict';

const express = require('express');
const { runQuery } = require('../services/queryService');
const { resetDatabase } = require('../services/resetService');
const { getPool } = require('../db/pool');

const router = express.Router();

// ── Auth middleware for admin routes ──────────────────────────────────
function requireAdminToken(req, res, next) {
  const token = process.env.ADMIN_TOKEN;
  if (!token) return res.status(503).json({ ok: false, error: 'Admin token not configured.' });
  const auth = req.headers['authorization'] || '';
  const provided = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!provided || provided !== token) {
    return res.status(401).json({ ok: false, error: 'Unauthorized.' });
  }
  next();
}

// POST /api/execute
// Body: { sql: "SELECT ..." }
router.post('/execute', async (req, res) => {
  const { sql } = req.body;

  if (!sql || typeof sql !== 'string') {
    return res.status(400).json({ error: 'Request body must include a "sql" string field.' });
  }

  try {
    const result = await runQuery(sql);
    return res.json({ ok: true, ...result });
  } catch (err) {
    return res.status(400).json({ ok: false, error: err.message });
  }
});

// POST /api/admin/verify — check token only, no side effects
router.post('/admin/verify', requireAdminToken, (req, res) => {
  res.json({ ok: true });
});

// POST /api/admin/reset — protected with Bearer token
router.post('/admin/reset', requireAdminToken, async (req, res) => {
  try {
    const result = await resetDatabase();
    return res.json({ ok: true, message: 'Database reset to baseline successfully.', ...result });
  } catch (err) {
    const status = err.message.includes('cooldown') || err.message.includes('in progress') ? 429 : 500;
    return res.status(status).json({ ok: false, error: err.message });
  }
});

// POST /api/reset — kept disabled for public access
router.post('/reset', (req, res) => {
  res.status(403).json({ ok: false, error: 'Reset is disabled. Contact the administrator.' });
});

// GET /api/health
router.get('/health', async (req, res) => {
  try {
    const pool = await getPool();
    const req2 = pool.request();
    req2.timeout = 3000;
    await req2.query('SELECT 1 AS ok');
    return res.json({ ok: true, db: 'connected' });
  } catch (err) {
    return res.status(503).json({ ok: false, db: 'unreachable', error: err.message });
  }
});

// GET /api/schema  — returns table/column metadata for the schema panel
router.get('/schema', async (req, res) => {
  const metaQuery = `
    SELECT
      t.TABLE_NAME  AS tableName,
      c.COLUMN_NAME AS columnName,
      c.DATA_TYPE   AS dataType,
      c.IS_NULLABLE AS nullable
    FROM INFORMATION_SCHEMA.TABLES  t
    JOIN INFORMATION_SCHEMA.COLUMNS c
      ON c.TABLE_NAME = t.TABLE_NAME AND c.TABLE_SCHEMA = t.TABLE_SCHEMA
    WHERE t.TABLE_TYPE = 'BASE TABLE'
      AND t.TABLE_SCHEMA = 'dbo'
    ORDER BY t.TABLE_NAME, c.ORDINAL_POSITION;
  `;

  try {
    const pool = await getPool();
    const request = pool.request();
    request.timeout = 5000;
    const result = await request.query(metaQuery);

    // Group by table
    const tables = {};
    for (const row of result.recordset) {
      if (!tables[row.tableName]) tables[row.tableName] = { name: row.tableName, columns: [] };
      tables[row.tableName].columns.push({
        name: row.columnName,
        type: row.dataType,
        nullable: row.nullable === 'YES',
      });
    }

    return res.json({ ok: true, tables: Object.values(tables) });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = router;
