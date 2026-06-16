'use strict';

const { ModelStudentCourse } = require('../models/student_course');
const { resetStudentDb }     = require('../services/studentDbService');

const cooldowns  = new Map(); // stCourseAId → lastResetAt timestamp
const COOLDOWN_MS = parseInt(process.env.RESET_COOLDOWN_MS || '30000', 10);

// ── GET /api/student/me ──────────────────────────────────────────────────
exports.getMe = async (req, res) => {
  const student = await ModelStudentCourse.findOne({ stCourseAId: req.user.stCourseAId })
    .select('-password')
    .lean();
  if (!student) return res.status(404).json({ ok: false, error: 'Student record not found.' });

  const loginName = (student.emailaddress || '').split('@')[0].replace(/[^a-zA-Z0-9_]/g, '_');

  res.json({
    ok: true,
    name:              `${student.firstname} ${student.surname}`,
    email:             student.emailaddress,
    org:               student.organization,
    courseCode:        student.courseCode,
    courseSection:     student.courseSection || '',
    semesterShortCode: student.semesterShortCode,
    dbName:            student.dbName,
    loginName,
    plaintextPassword: student.plaintextPassword || '',
    connStringEnabled: student.connStringEnabled || false,
  });
};

// ── POST /api/student/reset-db ───────────────────────────────────────────
exports.resetDb = async (req, res) => {
  const id   = req.user.stCourseAId;
  const now  = Date.now();
  const last = cooldowns.get(id) || 0;

  if (now - last < COOLDOWN_MS) {
    const wait = Math.ceil((COOLDOWN_MS - (now - last)) / 1000);
    return res.status(429).json({ ok: false, error: `Please wait ${wait} more second(s) before resetting again.` });
  }

  try {
    await resetStudentDb(req.user.dbName);
    cooldowns.set(id, Date.now());
    res.json({ ok: true, message: 'Your database has been reset to baseline.' });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
};
