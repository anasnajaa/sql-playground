import { useState, useEffect, useCallback } from 'react';
import {
  ThemeProvider, CssBaseline,
  AppBar, Toolbar, Box, IconButton, Tooltip, Chip, Button,
  Typography, Dialog, DialogTitle, DialogContent, DialogActions,
} from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
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
import SqlEditor from './components/SqlEditor';
import ResultsTable from './components/ResultsTable';
import SchemaPanel from './components/SchemaPanel';
import TechStack from './components/TechStack';
import { executeQuery, fetchSchema, studentResetDb } from './api/client';
import { darkTheme, lightTheme } from './theme';

const STORAGE_KEY = 'sql_playground_query';
const THEME_KEY   = 'sql_playground_theme';
const JWT_STUDENT = 'sql_student_jwt';
const DEFAULT_QUERY = 'SELECT * FROM Customers;';

function parseJwt(t) {
  try { return JSON.parse(atob(t.split('.')[1])); } catch { return null; }
}

export default function App() {
  const [sql, setSql] = useState(() => sessionStorage.getItem(STORAGE_KEY) || DEFAULT_QUERY);
  const studentToken = localStorage.getItem(JWT_STUDENT);
  const studentUser  = studentToken ? parseJwt(studentToken) : null;

  const [result,        setResult]        = useState(null);
  const [error,         setError]         = useState(null);
  const [loading,       setLoading]       = useState(false);
  const [schema,        setSchema]        = useState(null);
  const [schemaVisible, setSchemaVisible] = useState(true);
  const [theme,         setTheme]         = useState(() => localStorage.getItem(THEME_KEY) || 'dark');
  const [techOpen,      setTechOpen]      = useState(false);
  const [resetConfirm,  setResetConfirm]  = useState(false);

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
              alert(d.message || d.error);
            }}>Reset</Button>
          </DialogActions>
        </Dialog>
      )}

      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
        <AppBar position="static" color="default" elevation={0}
          sx={{ borderBottom: 1, borderColor: 'divider', bgcolor: 'background.paper', flexShrink: 0 }}>
          <Toolbar variant="dense" sx={{ gap: 0.5, minHeight: 44 }}>
            <Box component="img" src="/logo_small.png" sx={{ height: 26, mr: 1 }} />
            <Typography variant="subtitle2" fontWeight={700} sx={{ flexGrow: 1 }}>
              SQL Online Compiler
            </Typography>

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

            <Tooltip title="Schema Diagram">
              <IconButton size="small" href="/erd"><SchemaIcon fontSize="small" /></IconButton>
            </Tooltip>
            <Tooltip title="Server Status">
              <IconButton size="small" href="/status"><MonitorIcon fontSize="small" /></IconButton>
            </Tooltip>
            <Tooltip title="Tech Stack">
              <IconButton size="small" onClick={() => setTechOpen(v => !v)}><SettingsIcon fontSize="small" /></IconButton>
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

        <main className={`main ${schemaVisible ? 'with-schema' : ''}`} style={{ flex: 1, overflow: 'hidden' }}>
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
                <IconButton size="small" onClick={() => setSchemaVisible(false)} title="Hide schema panel">
                  <span className="material-icons" style={{ fontSize: 16 }}>close</span>
                </IconButton>
              </div>
              <SchemaPanel schema={schema} />
            </aside>
          )}
        </main>
      </Box>
    </ThemeProvider>
  );
}
