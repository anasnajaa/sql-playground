import { useState } from 'react';
import {
  ThemeProvider, CssBaseline,
  Box, Paper, Stack, Typography, TextField,
  Button, Alert, CircularProgress, Link, Divider,
} from '@mui/material';
import LockResetIcon from '@mui/icons-material/LockReset';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutlineOutlined';
import { darkTheme, lightTheme } from '../../theme';

const THEME_KEY = 'sql_playground_theme';

async function doReset(token, newPassword) {
  const res = await fetch('/api/auth/student/reset-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, newPassword }),
  });
  return res.json();
}

export default function ResetPasswordPage() {
  const token = new URLSearchParams(window.location.search).get('token') || '';
  const muiTheme = localStorage.getItem(THEME_KEY) === 'light' ? lightTheme : darkTheme;

  const [newPassword, setNewPassword]     = useState('');
  const [confirmPassword, setConfirm]     = useState('');
  const [loading, setLoading]             = useState(false);
  const [error, setError]                 = useState(null);
  const [success, setSuccess]             = useState(false);

  const mismatch = !!confirmPassword && confirmPassword !== newPassword;
  const canSubmit = !loading && newPassword.length >= 4 && newPassword === confirmPassword;

  async function handleSubmit(e) {
    e.preventDefault();
    if (!canSubmit) return;
    setLoading(true);
    setError(null);
    try {
      const d = await doReset(token, newPassword);
      if (d.ok) {
        setSuccess(true);
      } else {
        setError(d.error || 'Failed to reset password.');
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <ThemeProvider theme={muiTheme}>
      <CssBaseline />
      <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', p: 2 }}>
        <Paper elevation={4} sx={{ width: '100%', maxWidth: 400, p: { xs: 3, sm: 4 }, borderRadius: 2 }}>
          <Stack direction="row" alignItems="center" spacing={1.5} mb={3}>
            <LockResetIcon color="primary" fontSize="large" />
            <Box>
              <Typography variant="h6" fontWeight={700} lineHeight={1.3}>Reset Password</Typography>
              <Typography variant="caption" color="text.secondary">SQL Online Compiler</Typography>
            </Box>
          </Stack>

          <Divider sx={{ mb: 3 }} />

          {!token ? (
            <Alert severity="error">
              Invalid reset link. Please request a new password reset from the{' '}
              <Link href="/login">login page</Link>.
            </Alert>
          ) : success ? (
            <Stack spacing={2} alignItems="center" py={1}>
              <CheckCircleOutlineIcon color="success" sx={{ fontSize: 56 }} />
              <Typography variant="body1" fontWeight={600} textAlign="center">
                Password updated successfully!
              </Typography>
              <Typography variant="body2" color="text.secondary" textAlign="center">
                You can now log in with your new password.
              </Typography>
              <Button variant="contained" href="/login" fullWidth>
                Go to Login
              </Button>
            </Stack>
          ) : (
            <Stack component="form" onSubmit={handleSubmit} spacing={2}>
              <Typography variant="body2" color="text.secondary">
                Enter a new password for your account.
              </Typography>

              <TextField
                label="New Password"
                type="password"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                required size="small" fullWidth
                autoComplete="new-password"
                helperText="At least 4 characters"
              />
              <TextField
                label="Confirm New Password"
                type="password"
                value={confirmPassword}
                onChange={e => setConfirm(e.target.value)}
                required size="small" fullWidth
                autoComplete="new-password"
                error={mismatch}
                helperText={mismatch ? 'Passwords do not match' : ''}
              />

              {error && <Alert severity="error" sx={{ py: 0.5 }}>{error}</Alert>}

              <Button
                type="submit"
                variant="contained"
                disabled={!canSubmit}
                startIcon={loading ? <CircularProgress size={16} color="inherit" /> : null}
                fullWidth
                size="large"
              >
                {loading ? 'Saving…' : 'Set New Password'}
              </Button>
            </Stack>
          )}

          <Divider sx={{ mt: 3, mb: 2 }} />
          <Stack direction="row" justifyContent="center">
            <Link href="/login" variant="caption" color="text.secondary">← Back to Login</Link>
          </Stack>
        </Paper>
      </Box>
    </ThemeProvider>
  );
}
