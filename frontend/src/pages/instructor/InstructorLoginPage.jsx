import { useState, useEffect } from 'react';
import {
  ThemeProvider, CssBaseline,
  Box, Paper, Stack, Typography, TextField, MenuItem,
  Button, Alert, CircularProgress, Link, Divider,
} from '@mui/material';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import VerifiedIcon from '@mui/icons-material/Verified';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { darkTheme, lightTheme } from '../../theme';
import { requestInstructorOtp, verifyInstructorOtp, fetchOrgs } from '../../api/client';

const THEME_KEY = 'sql_playground_theme';
const JWT_KEY = 'sql_instructor_jwt';

export default function InstructorLoginPage() {
  const [orgs,  setOrgs]  = useState([]);
  const [step,  setStep]  = useState(1);
  const [org,   setOrg]   = useState('ktech');
  const [email, setEmail] = useState('');
  const [otp,   setOtp]   = useState('');
  const [error,   setError]   = useState(null);
  const [loading, setLoading] = useState(false);
  const muiTheme = localStorage.getItem(THEME_KEY) === 'light' ? lightTheme : darkTheme;

  useEffect(() => {
    fetchOrgs().then(d => { if (d.ok && d.orgs?.length) setOrgs(d.orgs); }).catch(() => {});
  }, []);

  async function handleRequestOtp(e) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const data = await requestInstructorOtp({ org: org.trim(), email: email.trim() });
      if (data.ok) { setStep(2); }
      else setError(data.error || 'Failed to send code.');
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp(e) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const data = await verifyInstructorOtp({ org: org.trim(), email: email.trim(), otp: otp.trim() });
      if (!data.ok) { setError(data.error || 'Invalid code.'); return; }
      localStorage.setItem(JWT_KEY, data.token);
      window.location.href = '/instructor';
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <ThemeProvider theme={muiTheme}>
      <CssBaseline />
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #0d1117 0%, #161b22 100%)',
          p: 2,
        }}
      >
        <Paper
          elevation={4}
          sx={{ width: '100%', maxWidth: 400, p: { xs: 3, sm: 4 }, borderRadius: 2 }}
        >
          <Stack direction="row" alignItems="center" spacing={1.5} mb={5}>
            <LockOpenIcon color="primary" fontSize="large" />
            <Box pb={4}>
              <Typography variant="h6" fontWeight={700} lineHeight={3}>Instructor Login</Typography>
              <Typography variant="caption" color="text.secondary">SQL Online Compiler</Typography>
            </Box>
          </Stack>
          <Divider sx={{ mb: 2 }} />
          {step === 1 ? (
            <Stack component="form" onSubmit={handleRequestOtp} spacing={2}>
              <TextField
                select label="Organization" value={org}
                onChange={e => setOrg(e.target.value)}
                required size="small" fullWidth
              >
                {orgs.length > 0
                  ? orgs.map(o => <MenuItem key={o} value={o}>{o}</MenuItem>)
                  : <MenuItem value="ktech">ktech</MenuItem>}
              </TextField>

              <TextField
                label="Email" type="email" value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="instructor@ktech.edu.kw"
                required size="small" fullWidth autoComplete="email"
              />

              {error && <Alert severity="error" sx={{ py: 0.5 }}>{error}</Alert>}

              <Button
                type="submit"
                variant="contained"
                startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <LockOpenIcon />}
                disabled={loading || !org || !email}
                fullWidth size="large"
              >
                {loading ? 'Sending…' : 'Send Login Code'}
              </Button>
            </Stack>
          ) : (
            <Stack component="form" onSubmit={handleVerifyOtp} spacing={2}>
              <Alert severity="info" sx={{ py: 0.5 }}>
                A 6-digit code was sent to <strong>{email}</strong>. Valid for 10 minutes.
              </Alert>

              <TextField
                label="Login Code" value={otp}
                onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                inputProps={{ inputMode: 'numeric', maxLength: 6 }}
                required size="small" fullWidth autoFocus
              />

              {error && <Alert severity="error" sx={{ py: 0.5 }}>{error}</Alert>}

              <Button
                type="submit"
                variant="contained"
                startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <VerifiedIcon />}
                disabled={loading || otp.length < 6}
                fullWidth size="large"
              >
                {loading ? 'Verifying…' : 'Verify & Sign In'}
              </Button>

              <Button
                variant="text"
                startIcon={<ArrowBackIcon />}
                onClick={() => { setStep(1); setOtp(''); setError(null); }}
                fullWidth
              >
                Back
              </Button>
            </Stack>
          )}

          <Divider sx={{ my: 2 }} />
          <Stack direction="row" justifyContent="center" spacing={2}>
            <Link href="/" variant="caption" color="text.secondary">← Playground</Link>
            <Link href="/login" variant="caption" color="text.secondary">Student Login</Link>
          </Stack>
        </Paper>
      </Box>
    </ThemeProvider>
  );
}
