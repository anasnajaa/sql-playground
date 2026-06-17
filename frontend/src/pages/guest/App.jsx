import { useState, useEffect, useCallback, useRef } from 'react';
import {
  ThemeProvider, CssBaseline,
  AppBar, Toolbar, Box, IconButton, Tooltip, Chip, Button, Snackbar, Alert,
  Typography, Dialog, DialogTitle, DialogContent, DialogActions,
  Drawer, TextField, Stack, Card, CardContent,
} from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import CameraAltIcon from '@mui/icons-material/CameraAlt';
import LightModeIcon from '@mui/icons-material/LightMode';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import SchemaIcon from '@mui/icons-material/Schema';
import SettingsIcon from '@mui/icons-material/Settings';
import LoginIcon from '@mui/icons-material/Login';
import LogoutIcon from '@mui/icons-material/Logout';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import TableChartIcon from '@mui/icons-material/TableChart';
import SchoolIcon from '@mui/icons-material/School';
import MonitorIcon from '@mui/icons-material/Monitor';
import NoteAltIcon from '@mui/icons-material/NoteAlt';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import CloseIcon from '@mui/icons-material/Close';
import StorageIcon from '@mui/icons-material/Storage';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import SqlEditor from '../../components/SqlEditor';
import ResultsTable from '../../components/ResultsTable';
import SchemaPanel from '../../components/SchemaPanel';
import TechStack from '../../components/TechStack';
import { executeQuery, fetchSchema, studentResetDb, fetchStudentMe } from '../../api/client';
import { darkTheme, lightTheme } from '../../theme';

const STORAGE_KEY   = 'sql_playground_query';
const THEME_KEY     = 'sql_playground_theme';
const NOTES_KEY     = 'sql_playground_notes';
const JWT_STUDENT   = 'sql_student_jwt';
const JWT_INSTRUCTOR = 'sql_instructor_jwt';
const DEFAULT_QUERY = 'SELECT * FROM Customers;';

function parseJwt(t) {
  try { return JSON.parse(atob(t.split('.')[1])); } catch { return null; }
}

export default function App() {
  const [sql, setSql] = useState(() => sessionStorage.getItem(STORAGE_KEY) || DEFAULT_QUERY);
  const studentToken    = localStorage.getItem(JWT_STUDENT);
  const studentUser     = studentToken ? parseJwt(studentToken) : null;
  const instructorToken = localStorage.getItem(JWT_INSTRUCTOR);
  const isInstructor    = !!instructorToken;

  const [result,        setResult]        = useState(null);
  const [error,         setError]         = useState(null);
  const [loading,       setLoading]       = useState(false);
  const [schema,        setSchema]        = useState(null);
  const [schemaVisible, setSchemaVisible] = useState(true);
  const [theme,         setTheme]         = useState(() => localStorage.getItem(THEME_KEY) || 'dark');
  const [techOpen,      setTechOpen]      = useState(false);
  const [resetConfirm,  setResetConfirm]  = useState(false);
  const [resetResult,   setResetResult]   = useState(null); // { ok, text }
  const [capturing,     setCapturing]     = useState(false);
  const [captureMsg,    setCaptureMsg]    = useState(null); // { ok, text }
  const [notesOpen,     setNotesOpen]     = useState(false);
  const [notes,         setNotes]         = useState(() => {
    try { return JSON.parse(sessionStorage.getItem(NOTES_KEY)) || []; } catch { return []; }
  });
  const [studentProfile, setStudentProfile] = useState(null); // full /me data
  const [connOpen,       setConnOpen]       = useState(false);
  const [infoOpen,       setInfoOpen]       = useState(false);
  const captureRef = useRef(null);

  // Fetch full student profile (includes connStringEnabled, loginName, plaintextPassword)
  useEffect(() => {
    if (studentToken) {
      fetchStudentMe(studentToken).then(d => { if (d.ok) setStudentProfile(d); }).catch(() => {});
    }
  }, [studentToken]);

  useEffect(() => {
    sessionStorage.setItem(NOTES_KEY, JSON.stringify(notes));
  }, [notes]);

  function addNote() {
    const id = Date.now();
    setNotes(prev => [{ id, content: '' }, ...prev]);
  }

  function updateNote(id, content) {
    setNotes(prev => prev.map(n => n.id === id ? { ...n, content } : n));
  }

  function deleteNote(id) {
    setNotes(prev => prev.filter(n => n.id !== id));
  }

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  useEffect(() => { sessionStorage.setItem(STORAGE_KEY, sql); }, [sql]);

  useEffect(() => {
    fetchSchema().then(d => { if (d.ok) setSchema(d); }).catch(() => {});
  }, []);

  const handleRun = useCallback(async () => {
    if (loading) return;
    setLoading(true); setError(null); setResult(null);
    try {
      const data = await executeQuery(sql);
      if (data.ok) setResult(data); else setError(data.error || 'Unknown error');
    } catch { setError('Network error: could not reach the server.'); }
    finally { setLoading(false); }
  }, [sql, loading]);

  useEffect(() => {
    function onKey(e) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); handleRun(); }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleRun]);

  const muiTheme = theme === 'dark' ? darkTheme : lightTheme;

  const handleCapture = useCallback(async () => {
    const target = captureRef.current;
    if (!target || capturing) return;
    setCapturing(true);
    try {
      const html2canvas = (await import('html2canvas')).default;

      // Temporarily hide the schema panel so only editor+results are captured
      const schemaEl = target.querySelector('.schema-aside');
      if (schemaEl) schemaEl.style.display = 'none';
      const prevClass = target.className;
      target.className = target.className.replace('with-schema', '').trim();

      // Build label
      const label = studentUser
        ? `${studentUser.name}  ·  ${studentUser.courseCode}  ·  ${studentUser.email || ''}`
        : 'Guest';
      const timestamp = new Date().toLocaleString();

      // Fetch client IP for watermark
      let ip = '';
      try {
        const ipRes = await fetch('/api/ip');
        const ipData = await ipRes.json();
        ip = ipData.ip || '';
      } catch { /* non-fatal */ }

      const canvas = await html2canvas(target, {
        useCORS: true,
        backgroundColor: '#ffffff',
        scale: 2,
        logging: false,
      });

      // Restore schema panel
      if (schemaEl) schemaEl.style.display = '';
      target.className = prevClass;

      // Add header banner on top
      const BANNER = 44;
      const final = document.createElement('canvas');
      final.width  = canvas.width;
      final.height = canvas.height + BANNER * 2;
      const ctx = final.getContext('2d');

      // Banner background
      ctx.fillStyle = '#1971c2';
      ctx.fillRect(0, 0, final.width, BANNER * 2);

      // Banner text
      ctx.fillStyle = '#ffffff';
      ctx.font = `bold ${BANNER * 0.55}px Inter, Segoe UI, sans-serif`;
      ctx.textBaseline = 'middle';
      ctx.fillText('SQL Online Compiler — sql.kuwaitdevs.com', BANNER * 0.4, BANNER * 0.55);
      ctx.font = `${BANNER * 0.45}px Inter, Segoe UI, sans-serif`;
      ctx.fillText(`${label}    ${timestamp}${ip ? '    IP: ' + ip : ''}`, BANNER * 0.4, BANNER * 1.5);

      // Draw captured content below banner
      ctx.drawImage(canvas, 0, BANNER * 2);

      // Convert to blob
      const blob = await new Promise(res => final.toBlob(res, 'image/png'));

      // Copy to clipboard
      let copied = false;
      try {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
        copied = true;
      } catch { /* clipboard may be blocked — fall back to download only */ }

      // Download
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `sql-capture-${Date.now()}.png`;
      a.click();
      URL.revokeObjectURL(url);

      setCaptureMsg({ ok: true, text: copied ? 'Screenshot copied to clipboard and downloaded.' : 'Screenshot downloaded.' });
    } catch (err) {
      setCaptureMsg({ ok: false, text: `Capture failed: ${err.message}` });
    } finally {
      setCapturing(false);
    }
  }, [studentUser, capturing]);

  return (
    <ThemeProvider theme={muiTheme}>
      <CssBaseline />

      {/* Reset confirm dialog */}
      {studentUser && (
        <Dialog open={resetConfirm} onClose={() => setResetConfirm(false)} maxWidth="xs" fullWidth>
          <DialogTitle>Reset Your Database?</DialogTitle>
          <DialogContent>All your changes will be lost and the database will return to baseline.</DialogContent>
          <DialogActions>
            <Button onClick={() => setResetConfirm(false)}>Cancel</Button>
            <Button color="error" variant="contained" onClick={async () => {
              setResetConfirm(false);
              const d = await studentResetDb(studentToken);
              setResetResult({ ok: !!d.ok, text: d.message || d.error || 'Reset completed.' });
            }}>Reset</Button>
          </DialogActions>
        </Dialog>
      )}

      {studentUser && !!resetResult && (
        <Dialog open onClose={() => setResetResult(null)} maxWidth="xs" fullWidth>
          <DialogTitle>{resetResult.ok ? 'Database Reset Complete' : 'Database Reset Failed'}</DialogTitle>
          <DialogContent>
            <Alert severity={resetResult.ok ? 'success' : 'error'} sx={{ mt: 0.5 }}>
              {resetResult.text}
            </Alert>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setResetResult(null)} variant="contained">OK</Button>
          </DialogActions>
        </Dialog>
      )}

      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
        <AppBar position="static" color="default" elevation={0}
          sx={{ borderBottom: 1, borderColor: 'divider', bgcolor: 'background.paper', flexShrink: 0 }}>
          <Toolbar variant="dense" sx={{ gap: 0.5, minHeight: 44 }}>
            <Box component="img" src="/logo_small.png" sx={{ height: 26, mr: 0.5 }} />
            <Typography variant="subtitle2" fontWeight={700} sx={{ mr: 1, letterSpacing: 0.2 }}>
              SQL Playground
            </Typography>

            {/* Spacer pushes right-side controls to the end */}
            <Box sx={{ flexGrow: 1 }} />

            {studentUser ? (
              <>
                <Chip
                  icon={<SchoolIcon sx={{ fontSize: '14px !important' }} />}
                  label={`${studentUser.name} · ${studentUser.courseCode}`}
                  size="small"
                  variant="outlined"
                  color="primary"
                  title={`DB: ${studentUser.dbName}`}
                />
                <Tooltip title="Reset my database">
                  <IconButton size="small" onClick={() => setResetConfirm(true)} color="warning">
                    <RestartAltIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Logout">
                  <IconButton size="small" onClick={() => { localStorage.removeItem(JWT_STUDENT); window.location.reload(); }}>
                    <LogoutIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </>
            ) : (
              <Tooltip title="Student Login">
                <IconButton size="small" href="/login"><LoginIcon fontSize="small" /></IconButton>
              </Tooltip>
            )}

            <Tooltip title="Capture screenshot (editor + results)">
              <span>
                <IconButton size="small" onClick={handleCapture} disabled={capturing}>
                  <CameraAltIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title="My Notes (session only)">
              <IconButton size="small" onClick={() => setNotesOpen(v => !v)} color={notesOpen ? 'primary' : 'default'}>
                <NoteAltIcon fontSize="small" />
              </IconButton>
            </Tooltip>

            <Tooltip title="Schema Diagram">
              <IconButton size="small" href="/erd"><SchemaIcon fontSize="small" /></IconButton>
            </Tooltip>
            {isInstructor && (
              <Tooltip title="Server Status">
                <IconButton size="small" href="/status"><MonitorIcon fontSize="small" /></IconButton>
              </Tooltip>
            )}
            {isInstructor && (
              <Tooltip title="Tech Stack">
                <IconButton size="small" onClick={() => setTechOpen(v => !v)}><SettingsIcon fontSize="small" /></IconButton>
              </Tooltip>
            )}
            <Tooltip title="About this project">
              <IconButton size="small" onClick={() => setInfoOpen(true)}>
                <InfoOutlinedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}>
              <IconButton size="small" onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}>
                {theme === 'dark' ? <LightModeIcon fontSize="small" /> : <DarkModeIcon fontSize="small" />}
              </IconButton>
            </Tooltip>
            <Tooltip title={schemaVisible ? 'Hide schema panel' : 'Show schema panel'}>
              <IconButton size="small" onClick={() => setSchemaVisible(v => !v)}>
                <TableChartIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Toolbar>
        </AppBar>

        {techOpen && <TechStack onClose={() => setTechOpen(false)} />}

        <main ref={captureRef} className={`main ${schemaVisible ? 'with-schema' : ''}`} style={{ flex: 1, overflow: 'hidden' }}>
          <div className="editor-section">
            <div className="toolbar">
              <Button
                variant="contained"
                size="small"
                startIcon={loading ? null : <PlayArrowIcon />}
                onClick={handleRun}
                disabled={loading}
                title="Run query (Ctrl+Enter)"
                sx={{ minWidth: 80 }}
              >
                {loading ? 'Running…' : 'Run'}
              </Button>
              <span className="toolbar-hint">Ctrl+Enter</span>
            </div>
            <SqlEditor value={sql} onChange={setSql} theme={theme} />
          </div>

          <div className="results-section">
            <ResultsTable result={result} error={error} loading={loading} />
          </div>

          {schemaVisible && (
            <aside className="schema-aside">
              <div className="schema-aside-header">
                <span>Tables</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  {studentProfile?.connStringEnabled && (
                    <Tooltip title="Connect via SSMS">
                      <IconButton size="small" onClick={() => setConnOpen(true)} color="primary">
                        <StorageIcon style={{ fontSize: 15 }} />
                      </IconButton>
                    </Tooltip>
                  )}
                  <IconButton size="small" onClick={() => setSchemaVisible(false)} title="Hide schema panel">
                    <span className="material-icons" style={{ fontSize: 16 }}>close</span>
                  </IconButton>
                </div>
              </div>
              <SchemaPanel schema={schema} />
            </aside>
          )}
        </main>
      </Box>

      {/* About dialog */}
      <Dialog open={infoOpen} onClose={() => setInfoOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <InfoOutlinedIcon color="primary" fontSize="small" />
          About SQL Playground
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            <Typography variant="body2">
              <strong>SQL Playground</strong> is an interactive, browser-based SQL learning environment built for students and instructors.
            </Typography>
            <Typography variant="body2">
              Each enrolled student gets a <strong>personal Microsoft SQL Server database</strong> pre-loaded with practice datasets. You can write and run SQL queries directly in the browser, no software installation needed.
            </Typography>
            <Typography variant="body2" component="div">
              <strong>Features include:</strong>
              <Box component="ul" sx={{ pl: 2, mt: 0.5, mb: 0 }}>
                <li>Live SQL editor with syntax highlighting</li>
                <li>Instant query results</li>
                <li>Schema browser showing all tables and columns</li>
                <li>Entity Relationship Diagram (ERD) viewer</li>
                <li>Personal note-taking panel (session-scoped)</li>
                <li>Screenshot capture with watermark for submissions</li>
                <li>Optional SSMS external connection credentials</li>
                <li>Relevant Datasets from <a target='_blank' href="https://census.csb.gov.kw/index_EN">Census of Kuwait</a></li>
              </Box>
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setInfoOpen(false)} variant="contained">Got it</Button>
        </DialogActions>
      </Dialog>

      {/* Connection String Dialog */}
      {studentProfile?.connStringEnabled && (
        <Dialog open={connOpen} onClose={() => setConnOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <StorageIcon color="primary" fontSize="small" />
            Connect via SSMS
          </DialogTitle>
          <DialogContent dividers>
            <Typography variant="caption" color="text.secondary" gutterBottom display="block">
              Use these credentials in SQL Server Management Studio (SSMS) to connect directly to your personal database.
            </Typography>
            {[
              { label: 'Server',         value: 'sql.kuwaitdevs.com,1433' },
              { label: 'Authentication', value: 'SQL Server Authentication' },
              { label: 'Login',          value: studentProfile.loginName },
              { label: 'Password',       value: studentProfile.plaintextPassword },
              { label: 'Database',       value: studentProfile.dbName },
            ].map(({ label, value }) => (
              <Box key={label} sx={{ mb: 1.5 }}>
                <Typography variant="caption" color="text.secondary">{label}</Typography>
                <Stack direction="row" alignItems="center" spacing={1} mt={0.3}>
                  <Box sx={{
                    flex: 1, fontFamily: 'monospace', fontSize: 13,
                    bgcolor: 'action.hover', px: 1.5, py: 0.8, borderRadius: 1,
                    border: 1, borderColor: 'divider', wordBreak: 'break-all',
                  }}>{value}</Box>
                  <Tooltip title="Copy">
                    <IconButton size="small" onClick={() => navigator.clipboard?.writeText(value)}>
                      <ContentCopyIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Stack>
              </Box>
            ))}
            <Box sx={{ mt: 2 }}>
              <Typography variant="caption" color="text.secondary">ADO.NET connection string</Typography>
              <Stack direction="row" alignItems="center" spacing={1} mt={0.3}>
                <Box sx={{
                  flex: 1, fontFamily: 'monospace', fontSize: 11,
                  bgcolor: 'action.hover', px: 1.5, py: 0.8, borderRadius: 1,
                  border: 1, borderColor: 'divider', wordBreak: 'break-all',
                }}>
                  {`Server=sql.kuwaitdevs.com,1433;Database=${studentProfile.dbName};User Id=${studentProfile.loginName};Password=${studentProfile.plaintextPassword};TrustServerCertificate=True;`}
                </Box>
                <Tooltip title="Copy">
                  <IconButton size="small" onClick={() => navigator.clipboard?.writeText(
                    `Server=sql.kuwaitdevs.com,1433;Database=${studentProfile.dbName};User Id=${studentProfile.loginName};Password=${studentProfile.plaintextPassword};TrustServerCertificate=True;`
                  )}>
                    <ContentCopyIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Stack>
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setConnOpen(false)}>Close</Button>
          </DialogActions>
        </Dialog>
      )}

      {/* Notes Drawer */}
      <Drawer
        anchor="right"
        open={notesOpen}
        onClose={() => setNotesOpen(false)}
        variant="temporary"
        sx={{
          '& .MuiDrawer-paper': {
            width: 300,
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column',
            bgcolor: 'background.paper',
          },
        }}
      >
        {/* Drawer header */}
        <Stack
          direction="row" alignItems="center"
          sx={{ px: 1.5, py: 1, borderBottom: 1, borderColor: 'divider', flexShrink: 0 }}
        >
          <NoteAltIcon fontSize="small" sx={{ color: 'primary.main', mr: 1 }} />
          <Typography variant="subtitle2" fontWeight={700} sx={{ flexGrow: 1 }}>My Notes</Typography>
          <Tooltip title="Add note">
            <IconButton size="small" onClick={addNote} color="primary">
              <AddIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Close">
            <IconButton size="small" onClick={() => setNotesOpen(false)}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>

        {/* Notes list */}
        <Box sx={{ flex: 1, overflowY: 'auto', p: 1.5, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {notes.length === 0 ? (
            <Box sx={{ textAlign: 'center', mt: 6, opacity: 0.45 }}>
              <NoteAltIcon sx={{ fontSize: 40, mb: 1, display: 'block', mx: 'auto' }} />
              <Typography variant="caption">No notes yet.<br />Click + to add one.</Typography>
            </Box>
          ) : (
            notes.map(note => (
              <Card
                key={note.id}
                variant="outlined"
                sx={{
                  borderRadius: 1.5,
                  '&:hover': { borderColor: 'primary.main' },
                  position: 'relative',
                }}
              >
                <CardContent sx={{ p: '10px !important', pb: '10px !important' }}>
                  <TextField
                    multiline
                    fullWidth
                    minRows={3}
                    maxRows={12}
                    value={note.content}
                    onChange={e => updateNote(note.id, e.target.value)}
                    placeholder="Type your note here…"
                    variant="standard"
                    InputProps={{ disableUnderline: true }}
                    inputProps={{ style: { fontFamily: 'monospace', fontSize: 13, lineHeight: 1.6 } }}
                  />
                  <Stack direction="row" justifyContent="flex-end" mt={0.5}>
                    <Tooltip title="Copy note">
                      <IconButton
                        size="small"
                        onClick={() => navigator.clipboard?.writeText(note.content)}
                        sx={{ opacity: 0.5, '&:hover': { opacity: 1 } }}
                      >
                        <Typography variant="caption" sx={{ fontSize: 10, fontFamily: 'monospace' }}>COPY</Typography>
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete note">
                      <IconButton
                        size="small"
                        onClick={() => deleteNote(note.id)}
                        sx={{ opacity: 0.5, '&:hover': { opacity: 1, color: 'error.main' } }}
                      >
                        <DeleteIcon sx={{ fontSize: 16 }} />
                      </IconButton>
                    </Tooltip>
                  </Stack>
                </CardContent>
              </Card>
            ))
          )}
        </Box>

        <Typography variant="caption" color="text.secondary"
          sx={{ px: 1.5, py: 1, borderTop: 1, borderColor: 'divider', textAlign: 'center', flexShrink: 0 }}>
          Notes are session-only and cleared on logout.
        </Typography>
      </Drawer>

      <Snackbar
        open={!!captureMsg}
        autoHideDuration={4000}
        onClose={() => setCaptureMsg(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={captureMsg?.ok ? 'success' : 'error'} onClose={() => setCaptureMsg(null)} sx={{ width: '100%' }}>
          {captureMsg?.text}
        </Alert>
      </Snackbar>
    </ThemeProvider>
  );
}
