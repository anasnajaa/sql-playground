'use strict';

const express  = require('express');
const { ModelInstructor }    = require('../models/instructor');
const { ModelStudentCourse } = require('../models/student_course');
const { ModelSemester }      = require('../models/semester');
const { generateOtp, verifyOtp } = require('../services/otpService');
const { verifyPassword }         = require('../services/passwordService');
const { mail_gun_send_email }    = require('../integrations/mail_gun');
const { signToken }              = require('../middleware/auth');

const router = express.Router();

// ── GET /api/auth/orgs ────────────────────────────────────────────────────
// Public — returns distinct orgs (for login page dropdowns)
router.get('/orgs', async (req, res) => {
  const orgs = await ModelInstructor.distinct('organization');
  res.json({ ok: true, orgs });
});

// ── GET /api/auth/current-semester ────────────────────────────────────────
// Public — returns the current semester
router.get('/current-semester', async (req, res) => {
  const s = await ModelSemester.findOne({ isCurrent: true, active: true, deleted: { $ne: true } })
    .select('shortCode code title')
    .lean();
  res.json({ ok: true, semester: s || null });
});

// ── GET /api/auth/semesters ───────────────────────────────────────────────
// Public — returns all active semesters (for student login dropdown)
router.get('/semesters', async (req, res) => {
  const semesters = await ModelSemester.find({ active: true, deleted: { $ne: true } })
    .select('shortCode code title isCurrent')
    .sort({ startDate: -1 })
    .lean();
  res.json({ ok: true, semesters });
});

// ── GET /api/auth/courses?semesterShortCode= ─────────────────────────────
// Public — returns distinct enrolled courses for a given semester
router.get('/courses', async (req, res) => {
  const { semesterShortCode } = req.query;
  if (!semesterShortCode) return res.json({ ok: true, courses: [] });

  const agg = await ModelStudentCourse.aggregate([
    { $match: { semesterShortCode, active: true, deleted: { $ne: true } } },
    { $group: { _id: '$courseCode', courseName: { $first: '$courseName' } } },
    { $project: { _id: 0, code: '$_id', title: '$courseName' } },
    { $sort: { code: 1 } },
  ]);
  res.json({ ok: true, courses: agg });
});

// ── POST /api/auth/instructor/request-otp ─────────────────────────────────
// Body: { org, email }
router.post('/instructor/request-otp', async (req, res) => {
  const { org, email } = req.body || {};
  if (!org || !email) return res.status(400).json({ ok: false, error: 'org and email are required.' });

  const instructor = await ModelInstructor.findOne({
    organization: org.trim(),
    emailaddress: email.trim().toLowerCase(),
    active: true,
    deleted: { $ne: true },
  }).lean();

  if (!instructor) {
    // Don't reveal whether the account exists
    return res.json({ ok: true, message: 'If your account exists, a code has been sent.' });
  }

  const otp = generateOtp(email.trim().toLowerCase());

  try {
    await mail_gun_send_email({
      to: email.trim(),
      subject: 'SQL Playground — Your Login Code',
      text: `Your one-time login code is: ${otp}\n\nThis code expires in 10 minutes.`,
      html: `<p>Your one-time login code is: <strong style="font-size:24px">${otp}</strong></p><p>This code expires in 10 minutes.</p>`,
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: 'Failed to send OTP email. Please try again.' });
  }

  res.json({ ok: true, message: 'If your account exists, a code has been sent.' });
});

// ── POST /api/auth/instructor/verify-otp ─────────────────────────────────
// Body: { org, email, otp }
router.post('/instructor/verify-otp', async (req, res) => {
  const { org, email, otp } = req.body || {};
  if (!org || !email || !otp) return res.status(400).json({ ok: false, error: 'org, email and otp are required.' });

  const key = email.trim().toLowerCase();

  if (!verifyOtp(key, otp)) {
    return res.status(401).json({ ok: false, error: 'Invalid or expired code.' });
  }

  const instructor = await ModelInstructor.findOne({
    organization: org.trim(),
    emailaddress: key,
    active: true,
    deleted: { $ne: true },
  }).lean();

  if (!instructor) {
    return res.status(401).json({ ok: false, error: 'Account not found.' });
  }

  const token = signToken({
    role:    'instructor',
    instAid: instructor.instAid,
    org:     instructor.organization,
    email:   instructor.emailaddress,
    name:    `${instructor.firstname} ${instructor.surname}`,
  });

  res.json({ ok: true, token, name: `${instructor.firstname} ${instructor.surname}`, org: instructor.organization });
});

// ── POST /api/auth/student/login ─────────────────────────────────────────
// Body: { org, email, password, semesterShortCode, courseCode }
router.post('/student/login', async (req, res) => {
  const { org, email, password, semesterShortCode, courseCode } = req.body || {};
  if (!org || !email || !password || !semesterShortCode || !courseCode) {
    return res.status(400).json({ ok: false, error: 'org, email, password, semesterShortCode and courseCode are required.' });
  }

  const student = await ModelStudentCourse.findOne({
    organization:       org.trim(),
    emailaddress:       email.trim().toLowerCase(),
    semesterShortCode:  semesterShortCode.trim(),
    courseCode:         courseCode.trim().toUpperCase(),
    active: true,
    deleted: { $ne: true },
  }).lean();

  if (!student) {
    return res.status(401).json({ ok: false, error: 'Invalid credentials.' });
  }

  const valid = await verifyPassword(password, student.password);
  if (!valid) {
    return res.status(401).json({ ok: false, error: 'Invalid credentials.' });
  }

  const token = signToken({
    role:               'student',
    stCourseAId:        student.stCourseAId,
    email:              student.emailaddress,
    org:                student.organization,
    courseCode:         student.courseCode,
    semesterShortCode:  student.semesterShortCode,
    dbName:             student.dbName,
    name:               `${student.firstname} ${student.surname}`,
  });

  res.json({
    ok: true,
    token,
    name:  `${student.firstname} ${student.surname}`,
    dbName: student.dbName,
    courseCode:        student.courseCode,
    semesterShortCode: student.semesterShortCode,
  });
});

module.exports = router;
