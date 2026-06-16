'use strict';

const express  = require('express');
const multer   = require('multer');
const { parse } = require('csv-parse/sync');
const { requireInstructorJwt } = require('../middleware/auth');
const { ModelStudentCourse }   = require('../models/student_course');
const { ModelCourse }          = require('../models/course');
const { ModelSemester }        = require('../models/semester');
const { generatePassword, hashPassword } = require('../services/passwordService');
const { buildDbName, createStudentDb, resetStudentDb, dropStudentDb, createStudentMssqlLogin } = require('../services/studentDbService');
const { mail_gun_send_email } = require('../integrations/mail_gun');

const router = express.Router();
router.use(requireInstructorJwt);

// Multer: store CSV in memory (max 2MB)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) return cb(null, true);
    cb(new Error('Only CSV files are accepted.'));
  },
});

// ── GET /api/instructor/orgs ─────────────────────────────────────────────
router.get('/orgs', async (req, res) => {
  const { ModelInstructor } = require('../models/instructor');
  const orgs = await ModelInstructor.distinct('organization');
  res.json({ ok: true, orgs });
});

// ── GET /api/instructor/courses ──────────────────────────────────────────
router.get('/courses', async (req, res) => {
  const courses = await ModelCourse.find({ organization: req.user.org, active: true, deleted: { $ne: true } })
    .select('code code_f title')
    .lean();
  res.json({ ok: true, courses });
});

// ── GET /api/instructor/semesters ────────────────────────────────────────
router.get('/semesters', async (req, res) => {
  const semesters = await ModelSemester.find({ active: true, deleted: { $ne: true } })
    .select('shortCode code title isCurrent')
    .sort({ startDate: -1 })
    .lean();
  res.json({ ok: true, semesters });
});

// ── GET /api/instructor/students ─────────────────────────────────────────
// Query params: courseCode, semesterShortCode
router.get('/students', async (req, res) => {
  const { courseCode, semesterShortCode } = req.query;
  const filter = {
    instAid:  req.user.instAid,
    active:   true,
    deleted:  { $ne: true },
  };
  if (courseCode)        filter.courseCode        = courseCode.toUpperCase();
  if (semesterShortCode) filter.semesterShortCode = semesterShortCode;

  const students = await ModelStudentCourse.find(filter)
    .select('-password')
    .lean();
  res.json({ ok: true, students });
});

// ── POST /api/instructor/import ──────────────────────────────────────────
// multipart/form-data: courseCode, semesterShortCode, file (CSV)
router.post('/import', upload.single('file'), async (req, res) => {
  const { courseCode, semesterShortCode } = req.body || {};

  if (!courseCode || !semesterShortCode) {
    return res.status(400).json({ ok: false, error: 'courseCode and semesterShortCode are required.' });
  }
  if (!req.file) {
    return res.status(400).json({ ok: false, error: 'A CSV file is required.' });
  }

  let rows;
  try {
    rows = parse(req.file.buffer.toString('utf8'), {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });
  } catch (err) {
    return res.status(400).json({ ok: false, error: `CSV parse error: ${err.message}` });
  }

  const results = { created: 0, skipped: 0, errors: [] };

  for (const row of rows) {
    // Moodle export headers: "First name", Surname, "Email address", Groups
    const firstname  = row['First name']    || row['firstname']    || '';
    const surname    = row['Surname']        || row['surname']      || '';
    const email      = (row['Email address'] || row['emailaddress'] || '').toLowerCase().trim();

    if (!email) { results.errors.push({ row, reason: 'Missing email address.' }); continue; }

    // studentId derived from email prefix (e.g. "240100796" from "240100796@ktech.edu.kw")
    const studentId = email.split('@')[0];
    const dbName    = buildDbName(req.user.org, semesterShortCode, courseCode, studentId);

    // Skip if this exact enrollment already exists (and is NOT soft-deleted)
    const exists = await ModelStudentCourse.findOne({
      emailaddress:      email,
      courseCode:        courseCode.toUpperCase(),
      semesterShortCode: semesterShortCode,
      deleted:           { $ne: true },
    }).lean();

    if (exists) { results.skipped++; continue; }

    // If a soft-deleted record exists, restore it instead of creating a new one
    const deleted = await ModelStudentCourse.findOne({
      emailaddress:      email,
      courseCode:        courseCode.toUpperCase(),
      semesterShortCode: semesterShortCode,
      deleted:           true,
    }).lean();

    try {
      const plainPassword = generatePassword();
      const hashedPw      = await hashPassword(plainPassword);
      const loginName     = studentId.replace(/[^a-zA-Z0-9_]/g, '_');

      if (deleted) {
        // Restore the soft-deleted record with a fresh password
        await ModelStudentCourse.findByIdAndUpdate(deleted._id, {
          firstname,
          surname,
          password:          hashedPw,
          plaintextPassword: plainPassword,
          dbName,
          active:            true,
          deleted:           false,
        });
      } else {
        // Determine next stCourseAId
        const last = await ModelStudentCourse.findOne().sort({ stCourseAId: -1 }).lean();
        const nextId = (last?.stCourseAId || 0) + 1;

        // Persist to MongoDB
        await ModelStudentCourse.create({
          stCourseAId:       nextId,
          instAid:           req.user.instAid,
          organization:      req.user.org,
          firstname,
          surname,
          emailaddress:      email,
          password:          hashedPw,
          plaintextPassword: plainPassword,
          dbName,
          courseCode:        courseCode.toUpperCase(),
          semesterShortCode: semesterShortCode,
          active:            true,
          deleted:           false,
        });
      }

      // Provision MSSQL database + login (createStudentDb is idempotent)
      await createStudentDb(dbName);
      await createStudentMssqlLogin(loginName, plainPassword, dbName);

      results.created++;
    } catch (err) {
      results.errors.push({ email, reason: err.message });
    }
  }

  res.json({ ok: true, ...results });
});

// ── Helper: generate new password, save hash, email student ─────────────
async function regenerateAndSend(student) {
  const plain  = generatePassword();
  const hashed = await hashPassword(plain);

  await ModelStudentCourse.findByIdAndUpdate(student._id, {
    password: hashed,
    plaintextPassword: plain,
  });

  // Update MSSQL login password too
  try {
    const loginName = student.emailaddress.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '_');
    const { createStudentMssqlLogin: upsert } = require('../services/studentDbService');
    await upsert(loginName, plain, student.dbName);
  } catch (_) { /* non-fatal — MSSQL login update best-effort */ }

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
router.post('/students/:id/send-password', async (req, res) => {
  const student = await ModelStudentCourse.findOne({ _id: req.params.id, instAid: req.user.instAid }).lean();
  if (!student) return res.status(404).json({ ok: false, error: 'Student not found.' });

  try {
    await regenerateAndSend(student);
    res.json({ ok: true, message: `Password emailed to ${student.emailaddress}.` });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── POST /api/instructor/students/bulk-send-passwords ───────────────────
// Body: { courseCode, semesterShortCode }
router.post('/students/bulk-send-passwords', async (req, res) => {
  const { courseCode, semesterShortCode } = req.body || {};
  if (!courseCode || !semesterShortCode) {
    return res.status(400).json({ ok: false, error: 'courseCode and semesterShortCode are required.' });
  }

  const students = await ModelStudentCourse.find({
    instAid: req.user.instAid,
    courseCode: courseCode.toUpperCase(),
    semesterShortCode,
    active: true,
    deleted: { $ne: true },
  }).lean();

  const results = { sent: 0, errors: [] };
  for (const s of students) {
    try {
      await regenerateAndSend(s);
      results.sent++;
    } catch (err) {
      results.errors.push({ email: s.emailaddress, reason: err.message });
    }
  }

  res.json({ ok: true, ...results });
});

// ── POST /api/instructor/students/bulk-reset-dbs ────────────────────────
// Body: { courseCode, semesterShortCode }
router.post('/students/bulk-reset-dbs', async (req, res) => {
  const { courseCode, semesterShortCode } = req.body || {};
  if (!courseCode || !semesterShortCode) {
    return res.status(400).json({ ok: false, error: 'courseCode and semesterShortCode are required.' });
  }
  const students = await ModelStudentCourse.find({
    instAid: req.user.instAid,
    courseCode: courseCode.toUpperCase(),
    semesterShortCode,
    active: true,
    deleted: { $ne: true },
  }).lean();
  const results = { reset: 0, errors: [] };
  for (const s of students) {
    try { await resetStudentDb(s.dbName); results.reset++; }
    catch (err) { results.errors.push({ email: s.emailaddress, reason: err.message }); }
  }
  res.json({ ok: true, ...results });
});

// ── POST /api/instructor/students/bulk-delete ────────────────────────────
// Body: { courseCode, semesterShortCode }
// Soft-deletes in MongoDB AND drops MSSQL databases + logins.
router.post('/students/bulk-delete', async (req, res) => {
  const { courseCode, semesterShortCode } = req.body || {};
  if (!courseCode || !semesterShortCode) {
    return res.status(400).json({ ok: false, error: 'courseCode and semesterShortCode are required.' });
  }

  const students = await ModelStudentCourse.find({
    instAid: req.user.instAid,
    courseCode: courseCode.toUpperCase(),
    semesterShortCode,
    deleted: { $ne: true },
  }).lean();

  // Soft-delete all in MongoDB first
  await ModelStudentCourse.updateMany(
    {
      instAid: req.user.instAid,
      courseCode: courseCode.toUpperCase(),
      semesterShortCode,
    },
    { $set: { deleted: true, active: false } }
  );

  // Drop MSSQL databases + logins (best-effort, non-fatal)
  const sqlErrors = [];
  for (const s of students) {
    try {
      const loginName = s.emailaddress.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '_');
      await dropStudentDb(s.dbName, loginName);
    } catch (err) {
      sqlErrors.push({ email: s.emailaddress, reason: err.message });
    }
  }

  res.json({ ok: true, deleted: students.length, sqlErrors });
});

// ── POST /api/instructor/students/:id/reset-db ───────────────────────────
router.post('/students/:id/reset-db', async (req, res) => {
  const student = await ModelStudentCourse.findOne({ _id: req.params.id, instAid: req.user.instAid }).lean();
  if (!student) return res.status(404).json({ ok: false, error: 'Student not found.' });

  try {
    await resetStudentDb(student.dbName);
    res.json({ ok: true, message: `Database ${student.dbName} reset to baseline.` });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── POST /api/instructor/students/:id/regenerate-password ────────────────
router.post('/students/:id/regenerate-password', async (req, res) => {
  const student = await ModelStudentCourse.findOne({ _id: req.params.id, instAid: req.user.instAid }).lean();
  if (!student) return res.status(404).json({ ok: false, error: 'Student not found.' });

  try {
    await regenerateAndSend(student);
    res.json({ ok: true, message: `New password generated and emailed to ${student.emailaddress}.` });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── POST /api/instructor/admin/reset-guest-db ────────────────────────────
// Only accessible to the a.najaa instructor account (checked server-side).
router.post('/admin/reset-guest-db', async (req, res) => {
  const emailPrefix = (req.user.email || '').split('@')[0];
  if (emailPrefix !== 'a.najaa') {
    return res.status(403).json({ ok: false, error: 'Access denied.' });
  }
  try {
    const { resetDatabase } = require('../services/resetService');
    const result = await resetDatabase();
    res.json({ ok: true, ...result });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── GET /api/instructor/admin/health ─────────────────────────────────────
router.get('/admin/health', async (req, res) => {
  const emailPrefix = (req.user.email || '').split('@')[0];
  if (emailPrefix !== 'a.najaa') {
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
});

module.exports = router;
