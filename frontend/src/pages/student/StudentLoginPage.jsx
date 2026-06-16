import { useState, useEffect } from 'react';
import {
  ThemeProvider, CssBaseline,
  Box, Paper, Stack, Typography, TextField, MenuItem,
  Button, Alert, CircularProgress, Link, Divider,
} from '@mui/material';
import LoginIcon from '@mui/icons-material/Login';
import SchoolIcon from '@mui/icons-material/School';
import { darkTheme, lightTheme } from '../../theme';
import { studentLogin, fetchOrgs, fetchPublicSemesters, fetchPublicCourses } from '../../api/client';

const THEME_KEY = 'sql_playground_theme';
const JWT_KEY = 'sql_student_jwt';

export default function StudentLoginPage() {
  const [orgs,      setOrgs]      = useState([]);
  const [semesters, setSemesters] = useState([]);
  const [courses,   setCourses]   = useState([]);

  const [org,      setOrg]      = useState('ktech');
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [semester, setSemester] = useState('');
  const [course,   setCourse]   = useState('');

  const [error,   setError]   = useState(null);
  const [loading, setLoading] = useState(false);
  const [coursesLoading, setCoursesLoading] = useState(false);
  const muiTheme = localStorage.getItem(THEME_KEY) === 'light' ? lightTheme : darkTheme;

  // Load orgs + semesters (with current default) on mount
  useEffect(() => {
    fetchOrgs().then(d => { if (d.ok && d.orgs?.length) setOrgs(d.orgs); }).catch(() => {});
    fetchPublicSemesters().then(d => {
      if (!d.ok) return;
      setSemesters(d.semesters || []);
      const cur = (d.semesters || []).find(s => s.isCurrent);
      if (cur) setSemester(cur.shortCode);
    }).catch(() => {});
  }, []);

  // When semester changes, reload courses
  useEffect(() => {
    if (!semester) { setCourses([]); setCourse(''); return; }
    setCoursesLoading(true);
    setCourse('');
    fetchPublicCourses(semester)
      .then(d => { if (d.ok) setCourses(d.courses || []); })
      .catch(() => {})
      .finally(() => setCoursesLoading(false));
  }, [semester]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const data = await studentLogin({
        org, email: email.trim(), password,
        semesterShortCode: semester,
        courseCode: course,
      });
      if (!data.ok) { setError(data.error || 'Login failed.'); return; }
      localStorage.setItem(JWT_KEY, data.token);
      window.location.href = '/';
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
          p: 2,
        }}
      >
        <Paper
          elevation={4}
          sx={{ width: '100%', maxWidth: 420, p: { xs: 3, sm: 4 }, borderRadius: 2 }}
        >
          {/* Header */}
          <Stack direction="row" alignItems="center" spacing={1.5} mb={3}>
            <SchoolIcon color="primary" fontSize="large" />
            <Box pb={4}>
              <Typography variant="h6" fontWeight={700} lineHeight={3}>Student Login</Typography>
              <Typography variant="caption" color="text.secondary">SQL Online Compiler</Typography>
            </Box>
          </Stack>

          <Divider sx={{ mb: 2 }} />

          <Stack component="form" onSubmit={handleSubmit} spacing={2}>
            {/* Organization */}
            <TextField
              select label="Organization" value={org}
              onChange={e => setOrg(e.target.value)}
              required size="small" fullWidth
            >
              {orgs.length > 0
                ? orgs.map(o => <MenuItem key={o} value={o}>{o}</MenuItem>)
                : <MenuItem value="ktech">ktech</MenuItem>}
            </TextField>

            {/* Email */}
            <TextField
              label="Email" type="email" value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="240100796@ktech.edu.kw"
              required size="small" fullWidth autoComplete="username"
            />

            {/* Password */}
            <TextField
              label="Password" type="password" value={password}
              onChange={e => setPassword(e.target.value)}
              required size="small" fullWidth autoComplete="current-password"
            />

            {/* Semester */}
            <TextField
              select label="Semester" value={semester}
              onChange={e => setSemester(e.target.value)}
              required size="small" fullWidth
            >
              {semesters.length > 0
                ? semesters.map(s => (
                    <MenuItem key={s.shortCode} value={s.shortCode}>
                      {s.shortCode}{s.title ? ` — ${s.title}` : ''}
                      {s.isCurrent ? ' ★' : ''}
                    </MenuItem>
                  ))
                : <MenuItem value="" disabled>Loading…</MenuItem>}
            </TextField>

            {/* Course */}
            <TextField
              select label="Course" value={course}
              onChange={e => setCourse(e.target.value)}
              required size="small" fullWidth
              disabled={!semester || coursesLoading}
              helperText={!semester ? 'Select a semester first' : coursesLoading ? 'Loading courses…' : undefined}
              SelectProps={{ displayEmpty: true }}
            >
              {courses.length > 0
                ? courses.map(c => (
                    <MenuItem key={c.code} value={c.code}>
                      {c.code}{c.title ? ` — ${c.title}` : ''}
                    </MenuItem>
                  ))
                : <MenuItem value="" disabled>{semester && !coursesLoading ? 'No courses found' : '—'}</MenuItem>}
            </TextField>

            {error && <Alert severity="error" sx={{ py: 0.5 }}>{error}</Alert>}

            <Button
              type="submit"
              variant="contained"
              startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <LoginIcon />}
              disabled={loading || !org || !email || !password || !semester || !course}
              fullWidth
              size="large"
            >
              {loading ? 'Signing in…' : 'Sign In'}
            </Button>
          </Stack>

          <Divider sx={{ my: 2 }} />

          <Stack direction="row" justifyContent="center" spacing={2}>
            <Link href="/" variant="caption" color="text.secondary">← Guest Mode</Link>
            <Link href="/instructor/login" variant="caption" color="text.secondary">Instructor Login</Link>
          </Stack>
        </Paper>
      </Box>
    </ThemeProvider>
  );
}
