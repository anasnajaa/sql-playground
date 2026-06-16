'use strict';

const express = require('express');
const c       = require('../controllers/authController');

const router = express.Router();

router.get('/orgs',                     c.getOrgs);
router.get('/current-semester',         c.getCurrentSemester);
router.get('/semesters',                c.getSemesters);
router.get('/courses',                  c.getCourses);
router.post('/instructor/request-otp',  c.requestInstructorOtp);
router.post('/instructor/verify-otp',   c.verifyInstructorOtp);
router.post('/student/login',           c.studentLogin);

module.exports = router;
