import { useState, useEffect } from 'react';
import {
  ThemeProvider, CssBaseline,
  Box, AppBar, Toolbar, Typography, IconButton, Tabs, Tab, Chip,
  Button, Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions,
} from '@mui/material';
import HomeIcon from '@mui/icons-material/Home';
import LogoutIcon from '@mui/icons-material/Logout';
import GroupIcon from '@mui/icons-material/Group';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import MonitorHeartIcon from '@mui/icons-material/MonitorHeart';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import LightModeIcon from '@mui/icons-material/LightMode';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import { darkTheme, lightTheme } from '../../theme';
import { fetchInstructorCourses, fetchInstructorSemesters } from '../../api/client';
import StudentsTab from './tabs/StudentsTab';
import ImportTab   from './tabs/ImportTab';
import StatusTab   from './tabs/StatusTab';
import AdminTab    from './tabs/AdminTab';

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

  const [tab,       setTab]       = useState(0);
  const [courses,   setCourses]   = useState([]);
  const [semesters, setSemesters] = useState([]);
  const [confirm,   setConfirm]   = useState(null);
  const [theme,     setTheme]     = useState(() => localStorage.getItem('sql_playground_theme') || 'dark');

  useEffect(() => { localStorage.setItem('sql_playground_theme', theme); }, [theme]);

  const muiTheme = theme === 'dark' ? darkTheme : lightTheme;

  useEffect(() => {
    fetchInstructorCourses(token).then(d => d.ok && setCourses(d.courses)).catch(() => {});
    fetchInstructorSemesters(token).then(d => {
      if (d.ok) setSemesters(d.semesters);
    }).catch(() => {});
  }, [token]);

  function logout() { localStorage.removeItem(JWT_KEY); window.location.href = '/instructor/login'; }

  function ask(title, text, onConfirm) { setConfirm({ title, text, onConfirm }); }

  return (
    <ThemeProvider theme={muiTheme}>
      <CssBaseline />

      {/* Shared confirm dialog */}
      <Dialog open={!!confirm} onClose={() => setConfirm(null)} maxWidth="xs" fullWidth>
        <DialogTitle>{confirm?.title}</DialogTitle>
        <DialogContent>
          <DialogContentText>{confirm?.text}</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirm(null)}>Cancel</Button>
          <Button color="error" variant="contained" onClick={async () => {
            const fn = confirm?.onConfirm; setConfirm(null); if (fn) await fn();
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
            <IconButton size="small" onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}>
              {theme === 'dark' ? <LightModeIcon fontSize="small" /> : <DarkModeIcon fontSize="small" />}
            </IconButton>
            <IconButton size="small" href="/"><HomeIcon fontSize="small" /></IconButton>
            <IconButton size="small" onClick={logout}><LogoutIcon fontSize="small" /></IconButton>
          </Toolbar>
        </AppBar>

        <Box sx={{ flex: 1, overflow: 'auto', p: { xs: 2, sm: 3 } }}>
          <Tabs value={tab} onChange={(_, v) => setTab(v)}
            sx={{ mb: 3, borderBottom: 1, borderColor: 'divider' }}>
            <Tab icon={<GroupIcon />} iconPosition="start" label="Students" />
            <Tab icon={<UploadFileIcon />} iconPosition="start" label="Import CSV" />
            <Tab icon={<MonitorHeartIcon />} iconPosition="start" label="Server Status" />
            {isAdmin && <Tab icon={<AdminPanelSettingsIcon />} iconPosition="start" label="Admin" />}
          </Tabs>

          <TabPanel value={tab} index={0}>
            <StudentsTab token={token} courses={courses} semesters={semesters} />
          </TabPanel>

          <TabPanel value={tab} index={1}>
            <ImportTab token={token} courses={courses} semesters={semesters} />
          </TabPanel>

          <TabPanel value={tab} index={2}>
            <StatusTab />
          </TabPanel>

          {isAdmin && (
            <TabPanel value={tab} index={3}>
              <AdminTab token={token} onAsk={ask} />
            </TabPanel>
          )}
        </Box>
      </Box>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </ThemeProvider>
  );
}
