'use strict';

const { ModelStudentCourse }                   = require('../models/student_course');
const { resetStudentDb, createStudentMssqlLogin } = require('../services/studentDbService');
const { generatePassword, hashPassword, verifyPassword } = require('../services/passwordService');
const { mail_gun_send_email } = require('../integrations/mail_gun');

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

// ── POST /api/student/change-password ────────────────────────────────────
exports.changePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ ok: false, error: 'currentPassword and newPassword are required.' });
  }
  if (!/^\d{5}$/.test(newPassword)) {
    return res.status(400).json({ ok: false, error: 'New password must be exactly 5 digits.' });
  }

  const student = await ModelStudentCourse.findOne({ stCourseAId: req.user.stCourseAId });
  if (!student) return res.status(404).json({ ok: false, error: 'Student record not found.' });

  const valid = await verifyPassword(currentPassword, student.password);
  if (!valid) return res.status(401).json({ ok: false, error: 'Current password is incorrect.' });

  const hashed = await hashPassword(newPassword);
  student.password          = hashed;
  student.plaintextPassword = newPassword;
  await student.save();

  try {
    const loginName = student.emailaddress.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '_');
    await createStudentMssqlLogin(loginName, newPassword, student.dbName);
  } catch (_) { /* non-fatal */ }

  res.json({ ok: true, message: 'Password updated successfully.' });
};

// ── POST /api/student/request-password-reset ─────────────────────────────
exports.requestPasswordReset = async (req, res) => {
  const student = await ModelStudentCourse.findOne({ stCourseAId: req.user.stCourseAId });
  if (!student) return res.status(404).json({ ok: false, error: 'Student record not found.' });

  const plain  = generatePassword();
  const hashed = await hashPassword(plain);

  student.password          = hashed;
  student.plaintextPassword = plain;
  await student.save();

  try {
    const loginName = student.emailaddress.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '_');
    await createStudentMssqlLogin(loginName, plain, student.dbName);
  } catch (_) { /* non-fatal */ }

  try {
    await mail_gun_send_email({
      to: student.emailaddress,
      subject: `SQL Playground — Password Reset (${student.courseCode})`,
      text: [
        `Hello ${student.firstname},`,
        '',
        `Your SQL Playground password has been reset.`,
        `  Email:    ${student.emailaddress}`,
        `  Password: ${plain}`,
        `  URL:      https://sql.kuwaitdevs.com/login`,
        '',
        'You will need to log in again with your new password.',
      ].join('\n'),
      html: `
        <p>Hello ${student.firstname},</p>
        <p>Your SQL Playground password has been reset.</p>
        <table style="border-collapse:collapse;font-family:monospace">
          <tr><td style="padding:4px 12px 4px 0"><strong>Email</strong></td><td>${student.emailaddress}</td></tr>
          <tr><td style="padding:4px 12px 4px 0"><strong>Password</strong></td><td style="font-size:1.2em;font-weight:bold">${plain}</td></tr>
          <tr><td style="padding:4px 12px 4px 0"><strong>URL</strong></td><td><a href="https://sql.kuwaitdevs.com/login">sql.kuwaitdevs.com/login</a></td></tr>
        </table>
        <p style="color:#888;font-size:0.85em">Please log in again with your new password.</p>
      `,
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: 'Password was reset but email could not be sent: ' + err.message });
  }

  res.json({ ok: true, message: `A new password has been sent to ${student.emailaddress}. Please log in again.` });
};

