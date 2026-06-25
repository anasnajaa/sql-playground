'use strict';

const { ModelStudentCourse }   = require('../models/student_course');
const { ModelCourse }          = require('../models/course');
const { ModelSemester }        = require('../models/semester');
const { ModelInstructor }      = require('../models/instructor');
const { generatePassword, hashPassword } = require('../services/passwordService');
const { buildDbName, createStudentDb, resetStudentDb, dropStudentDb, createStudentMssqlLogin } = require('../services/studentDbService');
const { mail_gun_send_email }  = require('../integrations/mail_gun');

// ── GET /api/instructor/orgs ─────────────────────────────────────────────
exports.getOrgs = async (req, res) => {
  const orgs = await ModelInstructor.distinct('organization');
  res.json({ ok: true, orgs });
};

// ── GET /api/instructor/courses ──────────────────────────────────────────
exports.getCourses = async (req, res) => {
  const courses = await ModelCourse.find({ organization: req.user.org, active: true, deleted: { $ne: true } })
    .select('code code_f title')
    .lean();
  res.json({ ok: true, courses });
};

// ── GET /api/instructor/semesters ────────────────────────────────────────
exports.getSemesters = async (req, res) => {
  const semesters = await ModelSemester.find({ active: true, deleted: { $ne: true } })
    .select('shortCode code title isCurrent')
    .sort({ startDate: -1 })
    .lean();
  res.json({ ok: true, semesters });
};

// ── GET /api/instructor/students ─────────────────────────────────────────
exports.getStudents = async (req, res) => {
  const { courseCode, semesterShortCode } = req.query;
  const filter = { instAid: req.user.instAid, active: true, deleted: { $ne: true } };
  if (courseCode)        filter.courseCode        = courseCode.toUpperCase();
  if (semesterShortCode) filter.semesterShortCode = semesterShortCode;

  const students = await ModelStudentCourse.find(filter).select('-password').lean();
  res.json({ ok: true, students });
};

// ── GET /api/instructor/course-settings ──────────────────────────────────
exports.getCourseSettings = async (req, res) => {
  const { courseCode, semesterShortCode } = req.query;
  if (!courseCode || !semesterShortCode) {
    return res.status(400).json({ ok: false, error: 'courseCode and semesterShortCode are required.' });
  }
  const student = await ModelStudentCourse.findOne({
    courseCode: courseCode.toUpperCase(), semesterShortCode, deleted: { $ne: true },
  }).lean();
  res.json({ ok: true, connStringEnabled: student?.connStringEnabled || false });
};

// ── POST /api/instructor/course-settings ─────────────────────────────────
exports.updateCourseSettings = async (req, res) => {
  const { courseCode, semesterShortCode, connStringEnabled } = req.body || {};
  if (!courseCode || !semesterShortCode || typeof connStringEnabled !== 'boolean') {
    return res.status(400).json({ ok: false, error: 'courseCode, semesterShortCode, and connStringEnabled (boolean) are required.' });
  }
  await ModelStudentCourse.updateMany(
    { courseCode: courseCode.toUpperCase(), semesterShortCode, deleted: { $ne: true } },
    { $set: { connStringEnabled } }
  );
  res.json({ ok: true, connStringEnabled });
};

// ── POST /api/instructor/import/student ──────────────────────────────────
exports.importStudent = async (req, res) => {
  const { courseCode, semesterShortCode, courseSection, firstname, surname, email: rawEmail } = req.body || {};
  if (!courseCode || !semesterShortCode || !rawEmail) {
    return res.status(400).json({ ok: false, error: 'courseCode, semesterShortCode, and email are required.' });
  }

  const email     = rawEmail.toLowerCase().trim();
  const studentId = email.split('@')[0];
  const dbName    = buildDbName(req.user.org, semesterShortCode, courseCode, studentId);
  const loginName = studentId.replace(/[^a-zA-Z0-9_]/g, '_');

  const exists = await ModelStudentCourse.findOne({
    emailaddress: email, courseCode: courseCode.toUpperCase(), semesterShortCode, deleted: { $ne: true },
  }).lean();
  if (exists) return res.json({ ok: true, skipped: true });

  const plainPassword = generatePassword();
  const hashedPw      = await hashPassword(plainPassword);

  const softDeleted = await ModelStudentCourse.findOne({
    emailaddress: email, courseCode: courseCode.toUpperCase(), semesterShortCode, deleted: true,
  }).lean();

  try {
    if (softDeleted) {
      await ModelStudentCourse.findByIdAndUpdate(softDeleted._id, {
        firstname:         firstname || softDeleted.firstname,
        surname:           surname   || softDeleted.surname,
        password:          hashedPw,
        plaintextPassword: plainPassword,
        dbName,
        courseSection:     courseSection || softDeleted.courseSection || '',
        active:            true,
        deleted:           false,
      });
    } else {
      const last   = await ModelStudentCourse.findOne().sort({ stCourseAId: -1 }).lean();
      const nextId = (last?.stCourseAId || 0) + 1;
      await ModelStudentCourse.create({
        stCourseAId:       nextId,
        instAid:           req.user.instAid,
        organization:      req.user.org,
        firstname:         firstname || '',
        surname:           surname   || '',
        emailaddress:      email,
        password:          hashedPw,
        plaintextPassword: plainPassword,
        dbName,
        courseCode:        courseCode.toUpperCase(),
        semesterShortCode,
        courseSection:     courseSection || '',
        active:            true,
        deleted:           false,
      });
    }
    await createStudentDb(dbName);
    await createStudentMssqlLogin(loginName, plainPassword, dbName);
    return res.json({ ok: true, created: true });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
};

// ── Helper shared by send-password and regenerate-password ───────────────
async function regenerateAndSend(student) {
  const plain  = generatePassword();
  const hashed = await hashPassword(plain);

  await ModelStudentCourse.findByIdAndUpdate(student._id, {
    password: hashed, plaintextPassword: plain,
  });

  try {
    const loginName = student.emailaddress.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '_');
    await createStudentMssqlLogin(loginName, plain, student.dbName);
  } catch (_) { /* non-fatal */ }

  await mail_gun_send_email({
    to: student.emailaddress,
    subject: `SQL Playground — Your Login Password (${student.courseCode})`,
    text: [
      `Hello ${student.firstname},`,
      '',
      `Your SQL Playground credentials for ${student.courseCode} (${student.semesterShortCode}):`,
      `  Email:    ${student.emailaddress}`,
      `  Password: ${plain}`,
      `  URL:      https://sql.kuwaitdevs.com/login`,
      '',
      'Your personal database: ' + student.dbName,
    ].join('\n'),
    html: `
      <p>Hello ${student.firstname},</p>
      <p>Your SQL Playground credentials for <strong>${student.courseCode}</strong> (${student.semesterShortCode}):</p>
      <table style="border-collapse:collapse;font-family:monospace">
        <tr><td style="padding:4px 12px 4px 0"><strong>Email</strong></td><td>${student.emailaddress}</td></tr>
        <tr><td style="padding:4px 12px 4px 0"><strong>Password</strong></td><td>${plain}</td></tr>
        <tr><td style="padding:4px 12px 4px 0"><strong>URL</strong></td><td><a href="https://sql.kuwaitdevs.com/login">sql.kuwaitdevs.com/login</a></td></tr>
        <tr><td style="padding:4px 12px 4px 0"><strong>Database</strong></td><td>${student.dbName}</td></tr>
      </table>
    `,
  });
  return plain;
}

// ── POST /api/instructor/students/:id/send-password ──────────────────────
exports.sendStudentPassword = async (req, res) => {
  const student = await ModelStudentCourse.findOne({ _id: req.params.id, instAid: req.user.instAid }).lean();
  if (!student) return res.status(404).json({ ok: false, error: 'Student not found.' });
  try {
    await regenerateAndSend(student);
    res.json({ ok: true, message: `Password emailed to ${student.emailaddress}.` });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
};

// ── POST /api/instructor/students/:id/reset-db ───────────────────────────
exports.resetStudentDb = async (req, res) => {
  const student = await ModelStudentCourse.findOne({ _id: req.params.id, instAid: req.user.instAid }).lean();
  if (!student) return res.status(404).json({ ok: false, error: 'Student not found.' });
  try {
    await resetStudentDb(student.dbName);
    res.json({ ok: true, message: `Database ${student.dbName} reset to baseline.` });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
};

// ── POST /api/instructor/students/:id/delete ─────────────────────────────
exports.deleteStudent = async (req, res) => {
  const student = await ModelStudentCourse.findOne({
    _id: req.params.id, instAid: req.user.instAid, deleted: { $ne: true },
  }).lean();
  if (!student) return res.status(404).json({ ok: false, error: 'Student not found.' });

  await ModelStudentCourse.updateOne({ _id: student._id }, { $set: { deleted: true, active: false } });

  try {
    const loginName = student.emailaddress.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '_');
    await dropStudentDb(student.dbName, loginName);
  } catch (err) {
    return res.json({ ok: true, warning: `MongoDB deleted but MSSQL drop failed: ${err.message}` });
  }
  res.json({ ok: true, message: `Student ${student.emailaddress} deleted.` });
};

// ── POST /api/instructor/students/:id/conn-string ──────────────────────────
exports.updateStudentConnString = async (req, res) => {
  const { connStringEnabled } = req.body || {};
  if (typeof connStringEnabled !== 'boolean') {
    return res.status(400).json({ ok: false, error: 'connStringEnabled (boolean) is required.' });
  }
  const student = await ModelStudentCourse.findOneAndUpdate(
    { _id: req.params.id, instAid: req.user.instAid, deleted: { $ne: true } },
    { $set: { connStringEnabled } },
    { new: true }
  ).lean();
  if (!student) return res.status(404).json({ ok: false, error: 'Student not found.' });
  res.json({ ok: true, connStringEnabled: student.connStringEnabled });
};

// ── PATCH /api/instructor/students/:id ──────────────────────────────────
exports.updateStudent = async (req, res) => {
  const { firstname, surname, courseSection, email, password } = req.body || {};
  const update = {};
  if (firstname    !== undefined) update.firstname    = firstname.trim();
  if (surname      !== undefined) update.surname      = surname.trim();
  if (courseSection !== undefined) update.courseSection = courseSection.trim();

  // Email update
  if (email !== undefined) {
    const normalizedEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return res.status(400).json({ ok: false, error: 'Invalid email address.' });
    }
    // Ensure no other active student has this email in the same org/semester/course
    const existing = await ModelStudentCourse.findOne({
      emailaddress: normalizedEmail,
      _id: { $ne: req.params.id },
      deleted: { $ne: true },
    }).lean();
    if (existing) {
      return res.status(409).json({ ok: false, error: 'This email is already used by another student.' });
    }
    update.emailaddress = normalizedEmail;
  }

  // Password update
  if (password !== undefined && password.trim() !== '') {
    if (password.trim().length < 4) {
      return res.status(400).json({ ok: false, error: 'Password must be at least 4 characters.' });
    }
    update.password          = await hashPassword(password.trim());
    update.plaintextPassword = password.trim();
  }

  if (Object.keys(update).length === 0) {
    return res.status(400).json({ ok: false, error: 'No fields to update.' });
  }

  const student = await ModelStudentCourse.findOneAndUpdate(
    { _id: req.params.id, instAid: req.user.instAid, deleted: { $ne: true } },
    { $set: update },
    { new: true }
  ).lean();
  if (!student) return res.status(404).json({ ok: false, error: 'Student not found.' });

  // Sync new password to MSSQL login if password was changed
  if (update.plaintextPassword) {
    try {
      const loginName = student.emailaddress.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '_');
      await createStudentMssqlLogin(loginName, update.plaintextPassword, student.dbName);
    } catch (_) { /* non-fatal */ }
  }

  res.json({ ok: true, student });
};

// ── POST /api/instructor/students/:id/regenerate-password ────────────────
exports.regenerateStudentPassword = async (req, res) => {
  const student = await ModelStudentCourse.findOne({ _id: req.params.id, instAid: req.user.instAid }).lean();
  if (!student) return res.status(404).json({ ok: false, error: 'Student not found.' });
  try {
    await regenerateAndSend(student);
    res.json({ ok: true, message: `New password generated and emailed to ${student.emailaddress}.` });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
};

// ── POST /api/instructor/admin/reset-guest-db ────────────────────────────
exports.adminResetGuestDb = async (req, res) => {
  if ((req.user.email || '').split('@')[0] !== 'a.najaa') {
    return res.status(403).json({ ok: false, error: 'Access denied.' });
  }
  try {
    const { resetDatabase } = require('../services/resetService');
    const result = await resetDatabase();
    res.json({ ok: true, ...result });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
};

// ── GET /api/instructor/admin/health ─────────────────────────────────────
exports.adminHealth = async (req, res) => {
  if ((req.user.email || '').split('@')[0] !== 'a.najaa') {
    return res.status(403).json({ ok: false, error: 'Access denied.' });
  }
  try {
    const { getPool } = require('../db/pool');
    const pool = await getPool();
    const r = pool.request();
    r.timeout = 3000;
    await r.query('SELECT 1 AS ok');
    res.json({ ok: true, db: 'connected' });
  } catch (err) {
    res.status(503).json({ ok: false, db: 'unreachable', error: err.message });
  }
};
