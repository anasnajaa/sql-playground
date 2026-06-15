'use strict';

// Polyfill globalThis.crypto for MongoDB driver (requires Web Crypto API, Node 18+)
if (!globalThis.crypto) {
  globalThis.crypto = require('node:crypto').webcrypto;
}

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const { close } = require('./db/pool');
const { connectMongo } = require('./db/mongo');
const apiRouter        = require('./routes/api');
const authRoutes       = require('./routes/authRoutes');
const instructorRoutes = require('./routes/instructorRoutes');
const studentRoutes    = require('./routes/studentRoutes');

const PORT = parseInt(process.env.PORT || '3456', 10);
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || 'https://sql.kuwaitdevs.com';

const app = express();

// ── Middleware ─────────────────────────────────────────────────────────────
app.set('trust proxy', 1); // nginx is the single upstream proxy

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || origin === ALLOWED_ORIGIN) return cb(null, true);
    return cb(new Error('CORS: origin not allowed'));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
}));

app.use(express.json({ limit: '64kb' }));

// Global rate limit: 120 requests / minute per IP
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: 'Too many requests. Please slow down.' },
});
app.use('/api', limiter);

// Tighter limit on execute: 30 queries / minute per IP
const executeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: 'Query rate limit reached. Please wait before running more queries.' },
});
app.use('/api/execute', executeLimiter);

// ── Routes ─────────────────────────────────────────────────────────────────
app.use('/api/auth',       authRoutes);
app.use('/api/instructor', instructorRoutes);
app.use('/api/student',    studentRoutes);
app.use('/api',            apiRouter);

// 404 catch-all
app.use((req, res) => res.status(404).json({ ok: false, error: 'Not found.' }));

// Error handler
app.use((err, req, res, _next) => {
  console.error('[server] Unhandled error:', err.message);
  res.status(500).json({ ok: false, error: 'Internal server error.' });
});

// ── Start ──────────────────────────────────────────────────────────────────
async function start() {
  await connectMongo();
  const server = app.listen(PORT, '127.0.0.1', () => {
    console.log(`[server] SQL Playground API listening on 127.0.0.1:${PORT}`);
  });

  function shutdown() {
    console.log('[server] Shutting down…');
    server.close(async () => {
      await close();
      process.exit(0);
    });
  }

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

start().catch(err => {
  console.error('[server] Startup failed:', err.stack || err.message);
  process.exit(1);
});
