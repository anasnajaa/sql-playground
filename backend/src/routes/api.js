'use strict';

const express = require('express');
const { optionalJwt } = require('../middleware/auth');
const c = require('../controllers/apiController');

const router = express.Router();

// Admin token guard (only used by /admin/* routes)
function requireAdminToken(req, res, next) {
  const token    = process.env.ADMIN_TOKEN;
  if (!token) return res.status(503).json({ ok: false, error: 'Admin token not configured.' });
  const provided = (req.headers['authorization'] || '').replace(/^Bearer /, '');
  if (!provided || provided !== token) return res.status(401).json({ ok: false, error: 'Unauthorized.' });
  next();
}

router.post('/execute',      optionalJwt, c.execute);
router.post('/admin/verify', requireAdminToken, c.adminVerify);
router.post('/admin/reset',  requireAdminToken, c.adminReset);
router.post('/reset',        (req, res) => res.status(403).json({ ok: false, error: 'Reset is disabled. Contact the administrator.' }));
router.get('/ip',            c.getIp);
router.get('/health',        c.health);
router.get('/status',        c.status);
router.get('/schema',        optionalJwt, c.schema);
router.get('/erd',           optionalJwt, c.erd);

module.exports = router;
