'use strict';

const express = require('express');
const { requireInstructorJwt } = require('../middleware/auth');
const c = require('../controllers/instructorController');

const router = express.Router();
router.use(requireInstructorJwt);

router.get('/orgs',                              c.getOrgs);
router.get('/courses',                           c.getCourses);
router.get('/semesters',                         c.getSemesters);
router.get('/students',                          c.getStudents);
router.get('/course-settings',                   c.getCourseSettings);
router.post('/course-settings',                  c.updateCourseSettings);
router.post('/import/student',                   c.importStudent);
router.post('/students/:id/send-password',       c.sendStudentPassword);
router.post('/students/:id/reset-db',            c.resetStudentDb);
router.post('/students/:id/delete',              c.deleteStudent);
router.patch('/students/:id',                    c.updateStudent);
router.post('/students/:id/conn-string',          c.updateStudentConnString);
router.post('/students/:id/regenerate-password', c.regenerateStudentPassword);
router.post('/admin/reset-guest-db',             c.adminResetGuestDb);
router.get('/admin/health',                      c.adminHealth);

module.exports = router;
