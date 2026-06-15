const BASE = '/api';

const JWT_STUDENT_KEY    = 'sql_student_jwt';
const JWT_INSTRUCTOR_KEY = 'sql_instructor_jwt';

function getToken() {
  return localStorage.getItem(JWT_STUDENT_KEY)
    || localStorage.getItem(JWT_INSTRUCTOR_KEY)
    || null;
}

async function post(path, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  return res.json();
}

async function get(path, token) {
  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, { headers });
  return res.json();
}

async function postForm(path, formData, token) {
  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, { method: 'POST', headers, body: formData });
  return res.json();
}

// ── Guest / student execute ──────────────────────────────────────────────
export const executeQuery = (sql) => post('/execute', { sql }, getToken());
export const resetDatabase = () => post('/reset', {});
export const fetchSchema = () => get('/schema', getToken());
export const fetchHealth = () => get('/health');
export const fetchErd    = () => get('/erd', getToken());
export const fetchStatus = () => get('/status');

// ── Auth ─────────────────────────────────────────────────────────────────
export const requestInstructorOtp = (body) => post('/auth/instructor/request-otp', body);
export const verifyInstructorOtp  = (body) => post('/auth/instructor/verify-otp',  body);
export const studentLogin         = (body) => post('/auth/student/login',           body);
export const fetchOrgs            = ()     => get('/auth/orgs');
export const fetchCurrentSemester = ()     => get('/auth/current-semester');
export const fetchPublicSemesters = ()     => get('/auth/semesters');
export const fetchPublicCourses   = (sem)  => get(`/auth/courses?semesterShortCode=${encodeURIComponent(sem)}`);

// ── Instructor ───────────────────────────────────────────────────────────
export const fetchInstructorCourses   = (t) => get('/instructor/courses', t);
export const fetchInstructorSemesters = (t) => get('/instructor/semesters', t);
export const fetchInstructorStudents  = (t, courseCode, semesterShortCode) =>
  get(`/instructor/students?courseCode=${encodeURIComponent(courseCode)}&semesterShortCode=${encodeURIComponent(semesterShortCode)}`, t);
export const importCsv = (t, courseCode, semesterShortCode, file) => {
  const fd = new FormData();
  fd.append('courseCode',        courseCode);
  fd.append('semesterShortCode', semesterShortCode);
  fd.append('file',              file);
  return postForm('/instructor/import', fd, t);
};
export const sendStudentPassword  = (t, id) => post(`/instructor/students/${id}/send-password`,         {}, t);
export const bulkSendPasswords    = (t, courseCode, semesterShortCode) =>
  post('/instructor/students/bulk-send-passwords', { courseCode, semesterShortCode }, t);
export const bulkResetDbs         = (t, courseCode, semesterShortCode) =>
  post('/instructor/students/bulk-reset-dbs',      { courseCode, semesterShortCode }, t);
export const bulkDeleteStudents   = (t, courseCode, semesterShortCode) =>
  post('/instructor/students/bulk-delete',         { courseCode, semesterShortCode }, t);
export const resetStudentDb       = (t, id) => post(`/instructor/students/${id}/reset-db`,              {}, t);
export const regeneratePassword   = (t, id) => post(`/instructor/students/${id}/regenerate-password`,   {}, t);
export const adminResetGuestDb    = (t)      => post('/instructor/admin/reset-guest-db',                 {}, t);
export const adminHealth          = (t)      => get('/instructor/admin/health', t);

// ── Student ──────────────────────────────────────────────────────────────
export const fetchStudentMe       = (t) => get('/student/me', t);
export const studentResetDb       = (t) => post('/student/reset-db', {}, t);
