'use strict';

const express = require('express');
const { requireStudentJwt } = require('../middleware/auth');
const c = require('../controllers/studentController');

const router = express.Router();
router.use(requireStudentJwt);

router.get('/me',       c.getMe);
router.post('/reset-db', c.resetDb);
router.post('/change-password',         c.changePassword);
router.post('/request-password-reset',  c.requestPasswordReset);

module.exports = router;
