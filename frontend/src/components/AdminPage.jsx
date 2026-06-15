import { useState } from 'react';
import {
  ThemeProvider, CssBaseline,
  Box, Paper, Stack, Typography, TextField,
  Button, Alert, CircularProgress, Link, Divider,
} from '@mui/material';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import MonitorHeartIcon from '@mui/icons-material/MonitorHeart';
import LogoutIcon from '@mui/icons-material/Logout';
import LoginIcon from '@mui/icons-material/Login';
import { darkTheme } from '../theme';

const STORAGE_KEY = 'sql_admin_token';

export default function AdminPage() {
  const [token,      setToken]      = useState(() => sessionStorage.getItem(STORAGE_KEY) || '');
  const [authed,     setAuthed]     = useState(() => !!sessionStorage.getItem(STORAGE_KEY));
  const [input,      setInput]      = useState('');
  const [loginError, setLoginError] = useState(null);
  const [loggingIn,  setLoggingIn]  = useState(false);
  const [status,     setStatus]     = useState(null);
  const [resetting,  setResetting]  = useState(false);
  const [dbStatus,   setDbStatus]   = useState(null);

  async function handleLogin(e) {
    e.preventDefault();
    setLoginError(null); setLoggingIn(true);
    try {
      const res = await fetch('/api/admin/verify', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${input}`, 'Content-Type': 'application/json' },
      });
      if (res.status === 401) { setLoginError('Invalid token.'); return; }
      sessionStorage.setItem(STORAGE_KEY, input);
      setToken(input); setAuthed(true);
    } catch { setLoginError('Network error.'); }
    finally { setLoggingIn(false); }
  }

  async function handleReset() {
    if (resetting) return;
    setResetting(true); setStatus(null);
    try {
      const res = await fetch('/api/admin/reset', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (res.status === 401) { setAuthed(false); sessionStorage.removeItem(STORAGE_KEY); return; }
      setStatus({ ok: data.ok, message: data.ok ? `Reset complete — ${data.durationMs}ms, ${data.statementsExecuted} statements.` : data.error });
    } catch { setStatus({ ok: false, message: 'Network error.' }); }
    finally { setResetting(false); }
  }

  async function handleHealth() {
    setDbStatus(null);
    try {
      const res = await fetch('/api/health');
      const data = await res.json();
      setDbStatus({ ok: data.ok, message: data.ok ? 'Database connected.' : data.error });
    } catch { setDbStatus({ ok: false, message: 'Network error.' }); }
  }

  return (
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />
      <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'linear-gradient(135deg, #0d1117 0%, #161b22 100%)', p: 2 }}>
        <Paper elevation={4} sx={{ width: '100%', maxWidth: 440, p: { xs: 3, sm: 4 }, borderRadius: 2 }}>

          <Stack direction="row" alignItems="center" spacing={1.5} mb={3}>
            <AdminPanelSettingsIcon color="primary" fontSize="large" />
            <Box>
              <Typography variant="h6" fontWeight={700} lineHeight={1.2}>Admin Panel</Typography>
              <Typography variant="caption" color="text.secondary">sql.kuwaitdevs.com</Typography>
            </Box>
          </Stack>

          {!authed ? (
            <Stack component="form" onSubmit={handleLogin} spacing={2}>
              <TextField
                label="Admin Token" type="password" value={input}
                onChange={e => setInput(e.target.value)}
                placeholder="Enter admin token…"
                required size="small" fullWidth autoFocus
              />
              {loginError && <Alert severity="error" sx={{ py: 0.5 }}>{loginError}</Alert>}
              <Button type="submit" variant="contained" fullWidth size="large"
                startIcon={loggingIn ? <CircularProgress size={16} color="inherit" /> : <LoginIcon />}
                disabled={!input || loggingIn}>
                {loggingIn ? 'Verifying…' : 'Login'}
              </Button>
            </Stack>
          ) : (
            <Stack spacing={2}>
              <Stack direction="row" spacing={1.5}>
                <Button variant="contained" color="error" startIcon={resetting ? <CircularProgress size={16} color="inherit" /> : <RestartAltIcon />}
                  onClick={handleReset} disabled={resetting} fullWidth>
                  {resetting ? 'Resetting…' : 'Reset to Baseline'}
                </Button>
                <Button variant="outlined" startIcon={<MonitorHeartIcon />} onClick={handleHealth} fullWidth>
                  Check Health
                </Button>
              </Stack>

              {status   && <Alert severity={status.ok   ? 'success' : 'error'} onClose={() => setStatus(null)}>{status.message}</Alert>}
              {dbStatus && <Alert severity={dbStatus.ok ? 'success' : 'error'} onClose={() => setDbStatus(null)}>{dbStatus.message}</Alert>}

              <Divider />
              <Typography variant="caption" color="text.secondary">
                Seed tables: Customers (5), Orders (5), Shippings (5), Teachers, supervisor_salaries
              </Typography>

              <Button variant="text" startIcon={<LogoutIcon />} size="small"
                onClick={() => { setAuthed(false); sessionStorage.removeItem(STORAGE_KEY); setToken(''); setStatus(null); }}>
                Logout
              </Button>
            </Stack>
          )}

          <Divider sx={{ my: 2 }} />
          <Link href="/" variant="caption" color="text.secondary">← Back to playground</Link>
        </Paper>
      </Box>
    </ThemeProvider>
  );
}
