import { useState, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Stack, TextField, Button, Alert, CircularProgress, Typography,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';

export default function InstructorEditStudentDialog({ open, student, onClose, onSuccess, token }) {
  const [form, setForm] = useState({ firstname: '', surname: '', email: '', section: '', password: '', passwordConfirm: '' });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);

  useEffect(() => {
    if (!open || !student) return;
    setForm({
      firstname:       student.firstname    || '',
      surname:         student.surname      || '',
      email:           student.emailaddress || '',
      section:         student.courseSection || '',
      password:        '',
      passwordConfirm: '',
    });
    setErr(null);
  }, [open, student]);

  function handleClose() { setErr(null); onClose(); }
  const set = (k) => (e) => setForm(p => ({ ...p, [k]: e.target.value }));

  const pwMismatch = form.password && form.password !== form.passwordConfirm;
  const canSubmit  = !!form.firstname && !!form.surname && !!form.email && !pwMismatch &&
                     (form.password === '' || form.password.length >= 4);

  async function handleSubmit(e) {
    e.preventDefault();
    setErr(null);
    setSaving(true);
    try {
      const body = {
        firstname:     form.firstname,
        surname:       form.surname,
        email:         form.email.trim().toLowerCase(),
        courseSection: form.section,
      };
      if (form.password) body.password = form.password;

      const response = await fetch(`/api/instructor/students/${student._id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });
      const d = await response.json();
      if (!d.ok) throw new Error(d.error || 'Failed to update student.');
      onSuccess(`${form.firstname} ${form.surname} updated.`);
    } catch (e) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth>
      <DialogTitle>Edit Student</DialogTitle>
      <DialogContent>
        <Stack component="form" id="edit-student-form" onSubmit={handleSubmit} spacing={2} sx={{ mt: 0.5 }}>
          <Stack direction="row" spacing={1.5}>
            <TextField label="First name" value={form.firstname} onChange={set('firstname')} size="small" fullWidth required autoFocus />
            <TextField label="Surname"    value={form.surname}   onChange={set('surname')}   size="small" fullWidth required />
          </Stack>
          <TextField label="Email" type="email" value={form.email} onChange={set('email')} size="small" fullWidth required />
          <TextField label="Section (optional)" value={form.section} onChange={set('section')} size="small" fullWidth />

          <Typography variant="caption" color="text.secondary" sx={{ pb: 0 }}>
            New Password — leave blank to keep current
          </Typography>
          <Stack direction="row" spacing={1.5}>
            <TextField
              label="New password"
              type="password"
              value={form.password}
              onChange={set('password')}
              size="small" fullWidth
              helperText="Min 4 characters"
              inputProps={{ minLength: 0 }}
            />
            <TextField
              label="Confirm"
              type="password"
              value={form.passwordConfirm}
              onChange={set('passwordConfirm')}
              size="small" fullWidth
              error={!!pwMismatch}
              helperText={pwMismatch ? 'No match' : ''}
            />
          </Stack>

          {err && <Alert severity="error" sx={{ py: 0.5 }}>{err}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={saving}>Cancel</Button>
        <Button type="submit" form="edit-student-form" variant="contained"
          startIcon={saving ? <CircularProgress size={14} color="inherit" /> : <EditIcon />}
          disabled={saving || !canSubmit}>
          {saving ? 'Saving…' : 'Save Changes'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
