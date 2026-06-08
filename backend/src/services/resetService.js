'use strict';

const fs = require('fs');
const path = require('path');
const { getPool } = require('../db/pool');

const SEED_PATH = path.join(__dirname, '../../resources/seed.sql');
const COOLDOWN_MS = parseInt(process.env.RESET_COOLDOWN_MS || '30000', 10);

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

    lastResetAt = Date.now();
    return { durationMs: Date.now() - start, statementsExecuted: statements.length };
  } finally {
    resetInProgress = false;
  }
}

module.exports = { resetDatabase };
