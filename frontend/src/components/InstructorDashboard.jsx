import { useState, useEffect, useCallback } from 'react';
import {
  ThemeProvider, CssBaseline,
  Box, AppBar, Toolbar, Typography, IconButton, Tabs, Tab,
  Grid, Paper, Stack, TextField, MenuItem, Button, Chip,
  Table, TableHead, TableBody, TableRow, TableCell, TableContainer,
  Alert, CircularProgress, Tooltip, Dialog, DialogTitle,
  DialogContent, DialogContentText, DialogActions, LinearProgress,
} from '@mui/material';
import HomeIcon from '@mui/icons-material/Home';
import LogoutIcon from '@mui/icons-material/Logout';
import GroupIcon from '@mui/icons-material/Group';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import SendIcon from '@mui/icons-material/Send';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep';
import MarkEmailReadIcon from '@mui/icons-material/MarkEmailRead';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import MonitorHeartIcon from '@mui/icons-material/MonitorHeart';
import { darkTheme } from '../theme';
import {
  fetchInstructorCourses, fetchInstructorSemesters, fetchInstructorStudents,
  importCsv, sendStudentPassword, bulkSendPasswords, bulkResetDbs,
  bulkDeleteStudents, resetStudentDb,
  adminResetGuestDb, adminHealth,
} from '../api/client';

const JWT_KEY = 'sql_instructor_jwt';

function parseJwt(t) {
  try { return JSON.parse(atob(t.split('.')[1])); } catch { return null; }
}

function TabPanel({ value, index, children }) {
  return value === index ? <Box sx={{ pt: 3 }}>{children}</Box> : null;
}

export default function InstructorDashboard() {
  const token = localStorage.getItem(JWT_KEY);
  const me    = token ? parseJwt(token) : null;
  if (!token) { window.location.href = '/instructor/login'; return null; }

  const isAdmin = me?.email?.split('@')[0] === 'a.najaa';

  const [tab, setTab] = useState(0);

  // Data
  const [courses,   setCourses]   = useState([]);
  const [semesters, setSemesters] = useState([]);
  // Students tab
  const [filterCourse,   setFilterCourse]   = useState('');
  const [filterSemester, setFilterSemester] = useState('');
  const [students,    setStudents]    = useState([]);
  const [studLoading, setStudLoading] = useState(false);
  const [studMsg,     setStudMsg]     = useState(null);
  // Import tab
  const [impCourse,   setImpCourse]   = useState('');
  const [impSemester, setImpSemester] = useState('');
  const [impFile,     setImpFile]     = useState(null);
  const [impLoading,  setImpLoading]  = useState(false);
  const [impResult,   setImpResult]   = useState(null);
  // Admin tab
  const [adminResetting,  setAdminResetting]  = useState(false);
  const [adminStatus,     setAdminStatus]     = useState(null);
  const [adminDbStatus,   setAdminDbStatus]   = useState(null);
  // Confirm dialog
  const [confirm, setConfirm] = useState(null); // { title, text, onConfirm }

  useEffect(() => {
    fetchInstructorCourses(token).then(d => d.ok && setCourses(d.courses)).catch(() => {});
    fetchInstructorSemesters(token).then(d => {
      if (!d.ok) return;
      setSemesters(d.semesters);
      const cur = d.semesters.find(s => s.isCurrent);
      if (cur) { setFilterSemester(cur.shortCode); setImpSemester(cur.shortCode); }
    }).catch(() => {});
  }, [token]);

  const loadStudents = useCallback(async () => {
    if (!filterCourse || !filterSemester) { setStudents([]); return; }
    setStudLoading(true); setStudMsg(null);
    try {
      const d = await fetchInstructorStudents(token, filterCourse, filterSemester);
      if (d.ok) setStudents(d.students); else setStudMsg({ ok: false, text: d.error });
    } catch { setStudMsg({ ok: false, text: 'Network error.' }); }
    finally { setStudLoading(false); }
  }, [token, filterCourse, filterSemester]);

  useEffect(() => { loadStudents(); }, [loadStudents]);

  function ask(title, text, onConfirm) { setConfirm({ title, text, onConfirm }); }

  async function handleSendPassword(id) {
    try {
      const d = await sendStudentPassword(token, id);
      setStudMsg({ ok: d.ok, text: d.message || d.error });
    } catch { setStudMsg({ ok: false, text: 'Network error.' }); }
  }

  async function handleResetDb(id, dbName) {
    ask('Reset Database', `Reset "${dbName}" to baseline? All student changes will be lost.`, async () => {
      try {
        const d = await resetStudentDb(token, id);
        setStudMsg({ ok: d.ok, text: d.message || d.error });
      } catch { setStudMsg({ ok: false, text: 'Network error.' }); }
    });
  }

  async function handleBulkSend() {
    ask('Send All Passwords', `Email new passwords to all ${students.length} student(s) in ${filterCourse} / ${filterSemester}?`, async () => {
      try {
        const d = await bulkSendPasswords(token, filterCourse, filterSemester);
        setStudMsg({ ok: d.ok, text: d.ok ? `Sent to ${d.sent} student(s). Errors: ${d.errors?.length || 0}` : d.error });
      } catch { setStudMsg({ ok: false, text: 'Network error.' }); }
    });
  }

  async function handleBulkResetDbs() {
    ask('Reset All Databases', `Reset ALL databases for ${students.length} student(s) in ${filterCourse} / ${filterSemester}? This cannot be undone.`, async () => {
      try {
        const d = await bulkResetDbs(token, filterCourse, filterSemester);
        setStudMsg({ ok: d.ok, text: d.ok ? `Reset ${d.reset} DB(s). Errors: ${d.errors?.length || 0}` : d.error });
      } catch { setStudMsg({ ok: false, text: 'Network error.' }); }
    });
  }

  async function handleBulkDelete() {
    ask('Delete All Students', `Soft-delete all ${students.length} student(s) from ${filterCourse} / ${filterSemester}?`, async () => {
      try {
        const d = await bulkDeleteStudents(token, filterCourse, filterSemester);
        setStudMsg({ ok: d.ok, text: d.ok ? `Deleted ${d.deleted} student(s).` : d.error });
        if (d.ok) setStudents([]);
      } catch { setStudMsg({ ok: false, text: 'Network error.' }); }
    });
  }

  async function handleImport(e) {
    e.preventDefault();
    if (!impFile || !impCourse || !impSemester) return;
    setImpLoading(true); setImpResult(null);
    try {
      const d = await importCsv(token, impCourse, impSemester, impFile);
      setImpResult(d);
      if (d.ok) { setImpFile(null); e.target.reset(); }
    } catch { setImpResult({ ok: false, error: 'Network error.' }); }
    finally { setImpLoading(false); }
  }

  function logout() { localStorage.removeItem(JWT_KEY); window.location.href = '/instructor/login'; }

  async function handleAdminReset() {
    setAdminStatus(null);
    setAdminResetting(true);
    try {
      const data = await adminResetGuestDb(token);
      setAdminStatus({ ok: data.ok, message: data.ok ? `Reset complete — ${data.durationMs}ms, ${data.statementsExecuted} statements.` : data.error });
    } catch { setAdminStatus({ ok: false, message: 'Network error.' }); }
    finally { setAdminResetting(false); }
  }

  async function handleAdminHealth() {
    setAdminDbStatus(null);
    try {
      const data = await adminHealth(token);
      setAdminDbStatus({ ok: data.ok, message: data.ok ? 'Database connected.' : data.error });
    } catch { setAdminDbStatus({ ok: false, message: 'Network error.' }); }
  }

  const semesterLabel = (sc) => {
    const s = semesters.find(x => x.shortCode === sc);
    return s ? `${s.shortCode}${s.title ? ' — ' + s.title : ''}` : sc;
  };

  return (
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />

      {/* Confirm Dialog */}
      <Dialog open={!!confirm} onClose={() => setConfirm(null)} maxWidth="xs" fullWidth>
        <DialogTitle>{confirm?.title}</DialogTitle>
        <DialogContent>
          <DialogContentText>{confirm?.text}</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirm(null)}>Cancel</Button>
          <Button color="error" variant="contained" onClick={async () => {
            const fn = confirm?.onConfirm;
            setConfirm(null);
            if (fn) await fn();
          }}>Confirm</Button>
        </DialogActions>
      </Dialog>

      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
        <AppBar position="static" color="default" elevation={0}
          sx={{ borderBottom: 1, borderColor: 'divider', bgcolor: 'background.paper' }}>
          <Toolbar variant="dense" sx={{ gap: 1 }}>
            <Box component="img" src="/logo_small.png" sx={{ height: 28, mr: 1 }} />
            <Typography variant="subtitle1" fontWeight={700} sx={{ flexGrow: 1 }}>
              SQL Playground — Instructor
            </Typography>
            <Chip label={`${me?.name} · ${me?.org}`} size="small" variant="outlined" />
            <Tooltip title="Playground">
              <IconButton size="small" href="/"><HomeIcon fontSize="small" /></IconButton>
            </Tooltip>
            <Tooltip title="Logout">
              <IconButton size="small" onClick={logout}><LogoutIcon fontSize="small" /></IconButton>
            </Tooltip>
          </Toolbar>
        </AppBar>

        <Box sx={{ flex: 1, overflow: 'auto', p: 3 }}>
          <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3, borderBottom: 1, borderColor: 'divider' }}>
            <Tab icon={<GroupIcon />} iconPosition="start" label="Students" />
            <Tab icon={<UploadFileIcon />} iconPosition="start" label="Import CSV" />
            {isAdmin && <Tab icon={<AdminPanelSettingsIcon />} iconPosition="start" label="Admin" />}
          </Tabs>

          {/* ── Students Tab ─────────────────────────── */}
          <TabPanel value={tab} index={0}>
            <Grid container spacing={2} alignItems="center" mb={2}>
              <Grid item xs={12} sm={4} md={3}>
                <TextField
                  select label="Semester" value={filterSemester}
                  onChange={e => setFilterSemester(e.target.value)}
                  size="small" fullWidth
                >
                  <MenuItem value="">— Semester —</MenuItem>
                  {semesters.map(s => (
                    <MenuItem key={s.shortCode} value={s.shortCode}>
                      {s.shortCode}{s.isCurrent ? ' ★' : ''}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid item xs={12} sm={4} md={3}>
                <TextField
                  select label="Course" value={filterCourse}
                  onChange={e => setFilterCourse(e.target.value)}
                  size="small" fullWidth
                >
                  <MenuItem value="">— Course —</MenuItem>
                  {courses.map(c => (
                    <MenuItem key={c.code} value={c.code}>
                      {c.code}{c.title ? ` — ${c.title}` : ''}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>
              {students.length > 0 && (
                <Grid item xs={12} sm="auto">
                  <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                    <Button size="small" variant="outlined" startIcon={<MarkEmailReadIcon />} onClick={handleBulkSend}>
                      Send All ({students.length})
                    </Button>
                    <Button size="small" variant="outlined" color="warning" startIcon={<RestartAltIcon />} onClick={handleBulkResetDbs}>
                      Reset All DBs
                    </Button>
                    <Button size="small" variant="outlined" color="error" startIcon={<DeleteSweepIcon />} onClick={handleBulkDelete}>
                      Delete All
                    </Button>
                  </Stack>
                </Grid>
              )}
            </Grid>

            {studMsg && (
              <Alert severity={studMsg.ok ? 'success' : 'error'} sx={{ mb: 2 }} onClose={() => setStudMsg(null)}>
                {studMsg.text}
              </Alert>
            )}

            {studLoading && <LinearProgress sx={{ mb: 2 }} />}

            {!studLoading && students.length === 0 && filterCourse && filterSemester && (
              <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
                No students found for this course / semester.
              </Typography>
            )}

            {students.length > 0 && (
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Name</TableCell>
                      <TableCell>Email</TableCell>
                      <TableCell>Password</TableCell>
                      <TableCell>Database</TableCell>
                      <TableCell align="right">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {students.map(s => (
                      <TableRow key={s._id} hover>
                        <TableCell>{s.firstname} {s.surname}</TableCell>
                        <TableCell sx={{ fontFamily: 'monospace', fontSize: 12 }}>{s.emailaddress}</TableCell>
                        <TableCell sx={{ fontFamily: 'monospace', fontSize: 12, maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          <Tooltip title={s.plaintextPassword || '—'}>
                            <span>{s.plaintextPassword || '—'}</span>
                          </Tooltip>
                        </TableCell>
                        <TableCell sx={{ fontFamily: 'monospace', fontSize: 11, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          <Tooltip title={s.dbName}><span>{s.dbName}</span></Tooltip>
                        </TableCell>
                        <TableCell align="right">
                          <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                            <Tooltip title="Regenerate & email password">
                              <IconButton size="small" color="primary" onClick={() => handleSendPassword(s._id)}>
                                <SendIcon fontSize="inherit" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Reset database to baseline">
                              <IconButton size="small" color="error" onClick={() => handleResetDb(s._id, s.dbName)}>
                                <RestartAltIcon fontSize="inherit" />
                              </IconButton>
                            </Tooltip>
                          </Stack>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </TabPanel>

          {/* ── Import Tab ───────────────────────────── */}
          <TabPanel value={tab} index={1}>
            <Typography variant="body2" color="text.secondary" mb={2}>
              Export participants from Moodle (Course → Participants → Download CSV).
              Expected columns: <code>First name</code>, <code>Surname</code>, <code>Email address</code>.
            </Typography>

            <Box component="form" onSubmit={handleImport}>
              <Grid container spacing={2} mb={2}>
                <Grid item xs={12} sm={4}>
                  <TextField
                    select label="Semester" value={impSemester}
                    onChange={e => setImpSemester(e.target.value)}
                    required size="small" fullWidth
                  >
                    <MenuItem value="">— Select Semester —</MenuItem>
                    {semesters.map(s => (
                      <MenuItem key={s.shortCode} value={s.shortCode}>
                        {s.shortCode}{s.isCurrent ? ' ★' : ''}
                      </MenuItem>
                    ))}
                  </TextField>
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField
                    select label="Course" value={impCourse}
                    onChange={e => setImpCourse(e.target.value)}
                    required size="small" fullWidth
                  >
                    <MenuItem value="">— Select Course —</MenuItem>
                    {courses.map(c => (
                      <MenuItem key={c.code} value={c.code}>
                        {c.code}{c.title ? ` — ${c.title}` : ''}
                      </MenuItem>
                    ))}
                  </TextField>
                </Grid>
                <Grid item xs={12} sm={4}>
                  <Button variant="outlined" component="label" fullWidth size="medium" startIcon={<UploadFileIcon />}
                    sx={{ height: 40 }}>
                    {impFile ? impFile.name : 'Choose CSV File'}
                    <input type="file" accept=".csv,text/csv" hidden
                      onChange={e => setImpFile(e.target.files[0] || null)} />
                  </Button>
                </Grid>
              </Grid>

              <Button
                type="submit" variant="contained"
                startIcon={impLoading ? <CircularProgress size={16} color="inherit" /> : <UploadFileIcon />}
                disabled={impLoading || !impFile || !impCourse || !impSemester}
              >
                {impLoading ? 'Importing…' : 'Import'}
              </Button>
            </Box>

            {impResult && (
              <Alert severity={impResult.ok ? 'success' : 'error'} sx={{ mt: 2 }} onClose={() => setImpResult(null)}>
                {impResult.ok ? (
                  <>
                    <strong>Import complete</strong> — Created: {impResult.created}, Skipped: {impResult.skipped}
                    {impResult.errors?.length > 0 && (
                      <Box component="ul" sx={{ mt: 1, pl: 2, mb: 0 }}>
                        {impResult.errors.map((err, i) => (
                          <li key={i}>{err.email || JSON.stringify(err.row)} — {err.reason}</li>
                        ))}
                      </Box>
                    )}
                  </>
                ) : impResult.error}
              </Alert>
            )}
          </TabPanel>
          {/* ── Admin Tab (a.najaa only) ─────────── */}
          {isAdmin && (
            <TabPanel value={tab} index={2}>
              <Typography variant="h6" fontWeight={700} mb={2}>Admin — Guest Database</Typography>
              <Stack spacing={2} maxWidth={480}>
                <Stack direction="row" spacing={1.5}>
                  <Button
                    variant="contained" color="error" fullWidth
                    startIcon={adminResetting ? <CircularProgress size={16} color="inherit" /> : <RestartAltIcon />}
                    onClick={() => ask('Reset Guest Database', 'Reset the shared guest database to baseline? All guest data will be wiped.', handleAdminReset)}
                    disabled={adminResetting}
                  >
                    {adminResetting ? 'Resetting…' : 'Reset Guest DB to Baseline'}
                  </Button>
                  <Button
                    variant="outlined" fullWidth
                    startIcon={<MonitorHeartIcon />}
                    onClick={handleAdminHealth}
                  >
                    Check Health
                  </Button>
                </Stack>

                {adminStatus   && <Alert severity={adminStatus.ok   ? 'success' : 'error'} onClose={() => setAdminStatus(null)}>{adminStatus.message}</Alert>}
                {adminDbStatus && <Alert severity={adminDbStatus.ok ? 'success' : 'error'} onClose={() => setAdminDbStatus(null)}>{adminDbStatus.message}</Alert>}

                <Typography variant="caption" color="text.secondary">
                  Seed tables: Customers (5), Orders (5), Shippings (5), Teachers, supervisor_salaries
                </Typography>
              </Stack>
            </TabPanel>
          )}

        </Box>
      </Box>
    </ThemeProvider>
  );
}
