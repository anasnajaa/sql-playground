'use strict';

const { ModelInstructor }    = require('../models/instructor');
const { ModelStudentCourse } = require('../models/student_course');
const { ModelCourse }        = require('../models/course');
const { ModelSemester }      = require('../models/semester');
const { generateOtp, verifyOtp } = require('../services/otpService');
const { verifyPassword }         = require('../services/passwordService');
const { mail_gun_send_email }    = require('../integrations/mail_gun');
const { signToken }              = require('../middleware/auth');

// ── GET /api/auth/orgs ────────────────────────────────────────────────────
exports.getOrgs = async (req, res) => {
  const orgs = await ModelInstructor.distinct('organization');
  res.json({ ok: true, orgs });
};

// ── GET /api/auth/current-semester ───────────────────────────────────────
exports.getCurrentSemester = async (req, res) => {
  const s = await ModelSemester.findOne({ isCurrent: true, active: true, deleted: { $ne: true } })
    .select('shortCode code title')
    .lean();
  res.json({ ok: true, semester: s || null });
};

// ── GET /api/auth/semesters ──────────────────────────────────────────────
exports.getSemesters = async (req, res) => {
  const semesters = await ModelSemester.find({ active: true, deleted: { $ne: true } })
    .select('shortCode code title isCurrent')
    .sort({ startDate: -1 })
    .lean();
  res.json({ ok: true, semesters });
};

// ── GET /api/auth/courses?semesterShortCode= ─────────────────────────────
// Returns courses from the Course model filtered to those that have active
// student enrollments in the requested semester.
exports.getCourses = async (req, res) => {
  const { semesterShortCode } = req.query;
  if (!semesterShortCode) return res.json({ ok: true, courses: [] });

  // Find course codes that have at least one active student in this semester
  const enrolled = await ModelStudentCourse.distinct('courseCode', {
    semesterShortCode,
    active: true,
    deleted: { $ne: true },
  });

  if (!enrolled.length) return res.json({ ok: true, courses: [] });

  const courses = await ModelCourse.find({
    code:    { $in: enrolled },
    active:  true,
    deleted: { $ne: true },
  })
    .select('code title shortDesc')
    .sort({ code: 1 })
    .lean();

  res.json({ ok: true, courses });
};

// ── POST /api/auth/instructor/request-otp ────────────────────────────────
exports.requestInstructorOtp = async (req, res) => {
  const { org, email } = req.body || {};
  if (!org || !email) return res.status(400).json({ ok: false, error: 'org and email are required.' });

  const instructor = await ModelInstructor.findOne({
    organization: org.trim(),
    emailaddress: email.trim().toLowerCase(),
    active: true,
    deleted: { $ne: true },
  }).lean();

  if (!instructor) {
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
};

// ── POST /api/auth/instructor/verify-otp ─────────────────────────────────
exports.verifyInstructorOtp = async (req, res) => {
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
};

// ── POST /api/auth/student/login ─────────────────────────────────────────
exports.studentLogin = async (req, res) => {
  const { org, email, password, semesterShortCode, courseCode } = req.body || {};
  if (!org || !email || !password || !semesterShortCode || !courseCode) {
    return res.status(400).json({ ok: false, error: 'org, email, password, semesterShortCode and courseCode are required.' });
  }

  const student = await ModelStudentCourse.findOne({
    organization:      org.trim(),
    emailaddress:      email.trim().toLowerCase(),
    semesterShortCode: semesterShortCode.trim(),
    courseCode:        courseCode.trim().toUpperCase(),
    active: true,
    deleted: { $ne: true },
  }).lean();

  if (!student) return res.status(401).json({ ok: false, error: 'Invalid credentials.' });

  const valid = await verifyPassword(password, student.password);
  if (!valid) return res.status(401).json({ ok: false, error: 'Invalid credentials.' });

  const token = signToken({
    role:              'student',
    stCourseAId:       student.stCourseAId,
    email:             student.emailaddress,
    org:               student.organization,
    courseCode:        student.courseCode,
    semesterShortCode: student.semesterShortCode,
    dbName:            student.dbName,
    name:              `${student.firstname} ${student.surname}`,
  });

  res.json({
    ok: true,
    token,
    name:              `${student.firstname} ${student.surname}`,
    dbName:            student.dbName,
    courseCode:        student.courseCode,
    semesterShortCode: student.semesterShortCode,
  });
};
