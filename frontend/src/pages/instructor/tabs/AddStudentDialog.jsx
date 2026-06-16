import { useState, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Stack, TextField, MenuItem, Button, Alert, CircularProgress,
} from '@mui/material';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import { importStudent } from '../../../api/client';

const empty = { firstname: '', surname: '', email: '', section: '', courseCode: '', semesterShortCode: '' };

export default function AddStudentDialog({ open, onClose, onSuccess, token, courses, semesters }) {
  const [form,   setForm]   = useState(empty);
  const [saving, setSaving] = useState(false);
  const [err,    setErr]    = useState(null);

  useEffect(() => {
    if (!open) return;
    const cur = semesters.find(s => s.isCurrent);
    if (cur) setForm(p => ({ ...p, semesterShortCode: p.semesterShortCode || cur.shortCode }));
  }, [open, semesters]);

  function handleClose() { setForm(empty); setErr(null); onClose(); }
  const set = (k) => (e) => setForm(p => ({ ...p, [k]: e.target.value }));

  async function handleSubmit(e) {
    e.preventDefault();
    setErr(null); setSaving(true);
    try {
      const d = await importStudent(token, {
        courseCode:        form.courseCode,
        semesterShortCode: form.semesterShortCode,
        courseSection:     form.section,
        firstname:         form.firstname,
        surname:           form.surname,
        email:             form.email,
      });
      if (!d.ok) throw new Error(d.error || 'Failed to add student.');
      const msg = d.skipped
        ? `${form.email} already exists — skipped.`
        : `${form.firstname} ${form.surname} added.`;
      setForm(empty);
      onSuccess(msg, d.skipped);
    } catch (e) { setErr(e.message); }
    finally { setSaving(false); }
  }

  const canSubmit = !!form.courseCode && !!form.semesterShortCode && !!form.firstname && !!form.surname && !!form.email;

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth>
      <DialogTitle>Add Student</DialogTitle>
      <DialogContent>
        <Stack component="form" id="add-student-form" onSubmit={handleSubmit} spacing={2} sx={{ mt: 0.5 }}>
          <Stack direction="row" spacing={1.5}>
            <TextField label="First name" value={form.firstname} onChange={set('firstname')} size="small" fullWidth required autoFocus />
            <TextField label="Surname"    value={form.surname}   onChange={set('surname')}   size="small" fullWidth required />
          </Stack>
          <TextField label="Email" type="email" value={form.email} onChange={set('email')} size="small" fullWidth required />
          <TextField select label="Semester" value={form.semesterShortCode} onChange={set('semesterShortCode')} size="small" fullWidth required>
            {semesters.map(s => (
              <MenuItem key={s.shortCode} value={s.shortCode}>
                {s.shortCode}{s.isCurrent ? ' ★' : ''}
              </MenuItem>
            ))}
          </TextField>
          <TextField select label="Course" value={form.courseCode} onChange={set('courseCode')} size="small" fullWidth required>
            <MenuItem value="">— Select course —</MenuItem>
            {courses.map(c => (
              <MenuItem key={c.code} value={c.code}>
                {c.code}{c.title ? ` — ${c.title}` : ''}
              </MenuItem>
            ))}
          </TextField>
          <TextField label="Section (optional)" value={form.section} onChange={set('section')} size="small" fullWidth />
          {err && <Alert severity="error" sx={{ py: 0.5 }}>{err}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={saving}>Cancel</Button>
        <Button type="submit" form="add-student-form" variant="contained"
          startIcon={saving ? <CircularProgress size={14} color="inherit" /> : <PersonAddIcon />}
          disabled={saving || !canSubmit}>
          {saving ? 'Adding…' : 'Add Student'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
