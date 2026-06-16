import { useState, useEffect, useCallback } from 'react';
import {
  ThemeProvider, CssBaseline,
  Box, AppBar, Toolbar, Typography, IconButton, Tabs, Tab,
  Grid, Paper, Stack, TextField, MenuItem, Button, Chip,
  Table, TableHead, TableBody, TableRow, TableCell, TableContainer,
  Alert, CircularProgress, Tooltip, Dialog, DialogTitle,
  DialogContent, DialogContentText, DialogActions, LinearProgress,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import CloudIcon from '@mui/icons-material/Cloud';
import DnsIcon from '@mui/icons-material/Dns';
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
import StorageIcon from '@mui/icons-material/Storage';
import MemoryIcon from '@mui/icons-material/Memory';
import RefreshIcon from '@mui/icons-material/Refresh';
import { darkTheme } from '../../theme';
import {
  fetchInstructorCourses, fetchInstructorSemesters, fetchInstructorStudents,
  importCsv, sendStudentPassword, bulkSendPasswords, bulkResetDbs,
  bulkDeleteStudents, resetStudentDb,
  adminResetGuestDb, adminHealth, fetchStatus,
} from '../../api/client';

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
  // Status tab
  const [statusData,    setStatusData]    = useState(null);
  const [statusLoading, setStatusLoading] = useState(false);
  const [statusError,   setStatusError]   = useState(null);
  const [statusLastAt,  setStatusLastAt]  = useState(null);
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

  const loadStatus = useCallback(async () => {
    setStatusLoading(true); setStatusError(null);
    try {
      const d = await fetchStatus();
      setStatusData(d); setStatusLastAt(new Date());
    } catch (e) { setStatusError(e.message || 'Failed to load status.'); }
    finally { setStatusLoading(false); }
  }, []);

  useEffect(() => {
    if (tab === 2) loadStatus();
  }, [tab, loadStatus]);

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
            <Tab icon={<MonitorHeartIcon />} iconPosition="start" label="Server Status" />
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
          {/* ── Status Tab ───────────────────────── */}
          <TabPanel value={tab} index={2}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
              <Typography variant="h6" fontWeight={700}>Server Status</Typography>
              <Stack direction="row" spacing={1} alignItems="center">
                {statusLastAt && (
                  <Typography variant="caption" color="text.secondary">
                    Updated {statusLastAt.toLocaleTimeString()}
                  </Typography>
                )}
                <Tooltip title="Refresh">
                  <IconButton size="small" onClick={loadStatus} disabled={statusLoading}>
                    <RefreshIcon fontSize="small" sx={statusLoading ? { animation: 'spin 0.7s linear infinite' } : {}} />
                  </IconButton>
                </Tooltip>
              </Stack>
            </Stack>
            {statusLoading && !statusData && <LinearProgress sx={{ mb: 2, borderRadius: 1 }} />}
            {statusError && <Alert severity="error" sx={{ mb: 2 }}>{statusError}</Alert>}
            {statusData && (() => {
              const d = statusData;
              const fmtUptime = s => {
                const dd = Math.floor(s / 86400), hh = Math.floor((s % 86400) / 3600),
                      mm = Math.floor((s % 3600) / 60), ss = s % 60;
                if (dd > 0) return `${dd}d ${hh}h ${mm}m`;
                if (hh > 0) return `${hh}h ${mm}m ${ss}s`;
                return `${mm}m ${ss}s`;
              };
              const StatusChip = ({ ok, label }) => (
                <Chip
                  icon={ok ? <CheckCircleIcon /> : <ErrorIcon />}
                  label={label} color={ok ? 'success' : 'error'}
                  size="small" variant="outlined"
                />
              );
              const SRow = ({ label, value }) => (
                <Stack direction="row" justifyContent="space-between" alignItems="center"
                  sx={{ py: 0.4, borderBottom: 1, borderColor: 'divider', '&:last-child': { border: 0 } }}>
                  <Typography variant="caption" color="text.secondary">{label}</Typography>
                  <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>{value}</Typography>
                </Stack>
              );
              const SCard = ({ icon, title, children }) => (
                <Paper variant="outlined" sx={{ p: 2, height: '100%' }}>
                  <Stack direction="row" alignItems="center" spacing={1} mb={1.5}>
                    <Box sx={{ color: 'primary.main' }}>{icon}</Box>
                    <Typography variant="subtitle2" fontWeight={700}>{title}</Typography>
                  </Stack>
                  {children}
                </Paper>
              );
              return (
                <>
                  <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap mb={3}>
                    <StatusChip ok={d.mssql.ok}  label={`MSSQL: ${d.mssql.ok  ? 'Connected' : 'Error'}`} />
                    <StatusChip ok={d.mongo.ok}  label={`MongoDB: ${d.mongo.ok ? 'Connected' : 'Error'}`} />
                    <StatusChip ok={d.docker.ok} label={`Docker: ${d.docker.ok ? 'OK' : 'Error'}`} />
                  </Stack>
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={6} md={4}>
                      <SCard icon={<MemoryIcon />} title="System">
                        <SRow label="Hostname"  value={d.system.hostname} />
                        <SRow label="Platform"  value={d.system.platform} />
                        <SRow label="Node.js"   value={d.system.nodeVersion} />
                        <SRow label="Uptime"    value={fmtUptime(d.system.uptime)} />
                        <SRow label="CPU Cores" value={d.system.cpu.cores} />
                        <SRow label="CPU Model" value={d.system.cpu.model} />
                        <SRow label="Load 1m"   value={d.system.cpu.loadAvg1m} />
                        <SRow label="Load 5m"   value={d.system.cpu.loadAvg5m} />
                      </SCard>
                    </Grid>
                    <Grid item xs={12} sm={6} md={4}>
                      <SCard icon={<StorageIcon />} title="Memory">
                        <SRow label="Total" value={`${d.system.memory.totalMb} MB`} />
                        <SRow label="Used"  value={`${d.system.memory.usedMb} MB`} />
                        <SRow label="Free"  value={`${d.system.memory.freeMb} MB`} />
                        <Box sx={{ mt: 1.5 }}>
                          <Stack direction="row" justifyContent="space-between" mb={0.5}>
                            <Typography variant="caption" color="text.secondary">Usage</Typography>
                            <Typography variant="caption">{d.system.memory.usedPct}%</Typography>
                          </Stack>
                          <LinearProgress
                            variant="determinate" value={d.system.memory.usedPct}
                            color={d.system.memory.usedPct > 85 ? 'error' : 'primary'}
                            sx={{ borderRadius: 1, height: 8 }}
                          />
                        </Box>
                      </SCard>
                    </Grid>
                    <Grid item xs={12} sm={6} md={4}>
                      <SCard icon={<StorageIcon />} title="MSSQL">
                        <Stack mb={1}><StatusChip ok={d.mssql.ok} label={d.mssql.ok ? 'Connected' : 'Unreachable'} /></Stack>
                        {d.mssql.ok && <>
                          <SRow label="Version"  value={d.mssql.version} />
                          <SRow label="Edition"  value={d.mssql.edition} />
                          <SRow label="Latency"  value={`${d.mssql.latencyMs} ms`} />
                          <SRow label="User DBs" value={d.mssql.userDbs} />
                        </>}
                        {d.mssql.error && <Typography variant="caption" color="error.main">{d.mssql.error}</Typography>}
                      </SCard>
                    </Grid>
                    <Grid item xs={12} sm={6} md={4}>
                      <SCard icon={<CloudIcon />} title="MongoDB">
                        <Stack mb={1}><StatusChip ok={d.mongo.ok} label={d.mongo.ok ? 'Connected' : (d.mongo.state || 'Error')} /></Stack>
                        {d.mongo.ok && <>
                          <SRow label="Latency" value={`${d.mongo.latencyMs} ms`} />
                          <SRow label="State"   value={d.mongo.state} />
                        </>}
                        {d.mongo.error && <Typography variant="caption" color="error.main">{d.mongo.error}</Typography>}
                      </SCard>
                    </Grid>
                    <Grid item xs={12} md={8}>
                      <SCard icon={<DnsIcon />} title="Docker Containers">
                        {d.docker.ok ? (
                          d.docker.containers.length === 0
                            ? <Typography variant="caption" color="text.secondary">No running containers.</Typography>
                            : (
                              <TableContainer>
                                <Table size="small">
                                  <TableHead>
                                    <TableRow>
                                      <TableCell>Name</TableCell>
                                      <TableCell>Image</TableCell>
                                      <TableCell>Status</TableCell>
                                    </TableRow>
                                  </TableHead>
                                  <TableBody>
                                    {d.docker.containers.map((c, i) => (
                                      <TableRow key={i}>
                                        <TableCell sx={{ fontFamily: 'monospace', fontSize: 12 }}>{c.name}</TableCell>
                                        <TableCell sx={{ fontFamily: 'monospace', fontSize: 12 }}>{c.image}</TableCell>
                                        <TableCell><StatusChip ok={c.status?.startsWith('Up')} label={c.status} /></TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              </TableContainer>
                            )
                        ) : (
                          <Typography variant="caption" color="error.main">{d.docker.error || 'Docker unavailable'}</Typography>
                        )}
                      </SCard>
                    </Grid>
                  </Grid>
                </>
              );
            })()}
          </TabPanel>

          {/* ── Admin Tab (a.najaa only) ─────────── */}
          {isAdmin && (
            <TabPanel value={tab} index={3}>
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
