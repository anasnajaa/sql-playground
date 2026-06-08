'use strict';

require('dotenv').config();
const sql = require('mssql');

const config = {
  server: process.env.MSSQL_HOST || '127.0.0.1',
  port: parseInt(process.env.MSSQL_PORT || '1433', 10),
  user: process.env.MSSQL_USER || 'sa',
  password: process.env.MSSQL_PASSWORD,
  database: process.env.MSSQL_DATABASE || 'SqlPlayground',
  options: {
    trustServerCertificate: true,
    enableArithAbort: true,
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
  },
  connectionTimeout: 10000,
  requestTimeout: parseInt(process.env.QUERY_TIMEOUT_MS || '5000', 10),
};

let pool = null;

async function getPool() {
  if (pool && pool.connected) return pool;
  pool = await new sql.ConnectionPool(config).connect();
  pool.on('error', (err) => {
    console.error('[db] Pool error:', err.message);
    pool = null;
  });
  return pool;
}

async function close() {
  if (pool) {
    await pool.close();
    pool = null;
  }
}

module.exports = { getPool, close, sql };
