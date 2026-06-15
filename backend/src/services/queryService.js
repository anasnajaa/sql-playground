'use strict';

const { getPool, sql } = require('../db/pool');

const MAX_ROWS = parseInt(process.env.MAX_ROWS || '500', 10);
const QUERY_TIMEOUT_MS = parseInt(process.env.QUERY_TIMEOUT_MS || '5000', 10);

// Reject obviously dangerous DDL/DCL outside the explicit reset path.
const BLOCKED_KEYWORDS = /\b(DROP\s+DATABASE|CREATE\s+DATABASE|ALTER\s+DATABASE|SHUTDOWN|xp_cmdshell|sp_configure|BULK\s+INSERT|OPENROWSET|OPENDATASOURCE)\b/i;

async function runQuery(rawSql, externalPool) {
  if (!rawSql || typeof rawSql !== 'string') {
    throw new Error('Query must be a non-empty string.');
  }

  const trimmed = rawSql.trim();
  if (trimmed.length === 0) throw new Error('Query is empty.');
  if (trimmed.length > 10000) throw new Error('Query exceeds maximum allowed length (10,000 characters).');

  if (BLOCKED_KEYWORDS.test(trimmed)) {
    throw new Error('Query contains a disallowed command. Only data queries are permitted.');
  }

  const pool = externalPool || await getPool();
  const request = pool.request();
  request.timeout = QUERY_TIMEOUT_MS;

  const start = Date.now();
  const result = await request.query(trimmed);
  const durationMs = Date.now() - start;

  // result.recordsets holds multiple statement results; surface the first non-empty set.
  const recordsets = result.recordsets || [];
  let rows = [];
  let columns = [];

  for (const rs of recordsets) {
    if (rs && rs.length > 0) {
      rows = rs;
      columns = Object.keys(rs[0]);
      break;
    }
  }

  const truncated = rows.length > MAX_ROWS;
  if (truncated) rows = rows.slice(0, MAX_ROWS);

  return {
    columns,
    rows,
    rowCount: rows.length,
    truncated,
    maxRows: MAX_ROWS,
    rowsAffected: result.rowsAffected ? result.rowsAffected.reduce((a, b) => a + b, 0) : 0,
    durationMs,
  };
}

module.exports = { runQuery };
