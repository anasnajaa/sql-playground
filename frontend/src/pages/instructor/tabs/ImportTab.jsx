import { useState, useEffect, useRef } from 'react';
import {
  Box, Grid, TextField, MenuItem, Button, Alert, Typography,
  Paper, Stack, LinearProgress, Chip, Divider,
  Dialog, DialogTitle, DialogContent, DialogActions,
} from '@mui/material';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import ClearIcon from '@mui/icons-material/Clear';
import { importStudent } from '../../../api/client';

const SECTIONS = Array.from({ length: 20 }, (_, i) => String(i + 1).padStart(2, '0'));

// ── Minimal client-side CSV parser (handles quoted fields) ─────────────
function splitCsvLine(line) {
  const result = [];
  let cur = '';
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuote && line[i + 1] === '"') { cur += '"'; i++; }
      else inQuote = !inQuote;
    } else if (ch === ',' && !inQuote) {
      result.push(cur); cur = '';
    } else {
      cur += ch;
    }
  }
  result.push(cur);
  return result;
}

function parseCsv(text) {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim().split('\n');
  if (lines.length < 2) return [];
  const headers = splitCsvLine(lines[0]).map(h => h.trim());
  return lines.slice(1)
    .filter(l => l.trim())
    .map(line => {
      const vals = splitCsvLine(line);
      const row = {};
      headers.forEach((h, i) => { row[h] = (vals[i] || '').trim(); });
      return row;
    });
}

function rowToStudent(row) {
  return {
    firstname: row['First name'] || row['firstname'] || row['first_name'] || '',
    surname:   row['Surname']    || row['surname']   || row['last_name']  || '',
    email:     (row['Email address'] || row['emailaddress'] || row['email'] || '').toLowerCase().trim(),
  };
}

// ── Progress dialog ────────────────────────────────────────────────────
function ProgressDialog({ open, title, rows, doneCount, created, skipped, errors, onClose }) {
  const total = rows.length;
  const pct   = total ? Math.round((doneCount / total) * 100) : 0;
  const done  = doneCount >= total;
  return (
    <Dialog open={open} maxWidth="sm" fullWidth disableEscapeKeyDown={!done}>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <Stack spacing={1.5}>
          <Typography variant="body2" color="text.secondary">
            {done
              ? `Done — ${created} created, ${skipped} skipped${errors.length ? `, ${errors.length} error(s)` : ''}.`
              : `Processing ${doneCount + 1} of ${total}…`}
          </Typography>
          <LinearProgress variant="determinate" value={pct} sx={{ borderRadius: 1, height: 6 }} />
          {done && (
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              {created > 0  && <Chip size="small" color="success" label={`${created} created`} />}
              {skipped > 0  && <Chip size="small" color="default" label={`${skipped} skipped`} />}
              {errors.length > 0 && <Chip size="small" color="warning" label={`${errors.length} errors`} />}
            </Stack>
          )}
          {errors.length > 0 && (
            <Alert severity="warning" sx={{ mt: 0.5 }}>
              <Box component="ul" sx={{ pl: 2, mb: 0, mt: 0 }}>
                {errors.map((e, i) => <li key={i}>{e.email}: {e.reason}</li>)}
              </Box>
            </Alert>
          )}
        </Stack>
      </DialogContent>
      {done && (
        <DialogActions>
          <Button onClick={onClose} variant="contained">Done</Button>
        </DialogActions>
      )}
    </Dialog>
  );
}

// ── Main component ─────────────────────────────────────────────────────
export default function ImportTab({ token, courses, semesters }) {
  const [impSemester, setImpSemester] = useState('');
  const [impCourse,   setImpCourse]   = useState('');
  const [impSection,  setImpSection]  = useState('');
  const [parsedRows,  setParsedRows]  = useState(null); // null = no file chosen
  const [parseError,  setParseError]  = useState(null);
  const fileInputRef = useRef(null);

  // Progress dialog
  const [prog, setProg] = useState(null);

  useEffect(() => {
    const cur = semesters.find(s => s.isCurrent);
    if (cur) setImpSemester(cur.shortCode);
  }, [semesters]);

  function handleFileChange(e) {
    const file = e.target.files[0] || null;
    setParsedRows(null);
    setParseError(null);
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const rows = parseCsv(ev.target.result);
        const students = rows.map(rowToStudent).filter(s => s.email);
        if (students.length === 0) {
          setParseError('No valid rows found. Make sure the CSV has an "Email address" column.');
        } else {
          setParsedRows(students);
        }
      } catch (err) {
        setParseError(`Parse error: ${err.message}`);
      }
    };
    reader.readAsText(file, 'utf-8');
  }

  function clearFile() {
    setParsedRows(null);
    setParseError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function handleImport() {
    if (!parsedRows || !impCourse || !impSemester) return;

    let created = 0, skipped = 0;
    const errors = [];

    setProg({ rows: parsedRows, doneCount: 0, created: 0, skipped: 0, errors: [] });

    for (let i = 0; i < parsedRows.length; i++) {
      const s = parsedRows[i];
      try {
        const d = await importStudent(token, {
          courseCode:        impCourse,
          semesterShortCode: impSemester,
          courseSection:     impSection,
          firstname:         s.firstname,
          surname:           s.surname,
          email:             s.email,
        });
        if (!d.ok)         errors.push({ email: s.email, reason: d.error || 'Unknown error' });
        else if (d.skipped) skipped++;
        else                created++;
      } catch (err) {
        errors.push({ email: s.email, reason: err.message });
      }
      setProg({ rows: parsedRows, doneCount: i + 1, created, skipped, errors: [...errors] });
    }
  }

  function closeProg() {
    setProg(null);
    clearFile();
  }

  const canImport = !!parsedRows && parsedRows.length > 0 && !!impCourse && !!impSemester;

  return (
    <>
      {prog && (
        <ProgressDialog
          open
          title={`Importing into ${prog.rows.length > 0 ? impCourse : '…'}`}
          rows={prog.rows}
          doneCount={prog.doneCount}
          created={prog.created}
          skipped={prog.skipped}
          errors={prog.errors}
          onClose={closeProg}
        />
      )}

      <Typography variant="body2" color="text.secondary" mb={2}>
        Export participants from Moodle (Course → Participants → Download CSV).
        Required columns: <code>First name</code>, <code>Surname</code>, <code>Email address</code>.
      </Typography>

      {/* Filter card */}
      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={6} md={3}>
            <TextField select label="Semester" value={impSemester} required size="small" fullWidth
              onChange={e => setImpSemester(e.target.value)}>
              <MenuItem value="">— Select Semester —</MenuItem>
              {semesters.map(s => (
                <MenuItem key={s.shortCode} value={s.shortCode}>
                  {s.shortCode}{s.isCurrent ? ' ★' : ''}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <TextField select label="Course" value={impCourse} required size="small" fullWidth
              onChange={e => setImpCourse(e.target.value)}>
              <MenuItem value="">— Select Course —</MenuItem>
              {courses.map(c => (
                <MenuItem key={c.code} value={c.code}>
                  {c.code}{c.title ? ` — ${c.title}` : ''}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid item xs={6} sm={4} md={2}>
            <TextField select label="Section" value={impSection} size="small" fullWidth
              onChange={e => setImpSection(e.target.value)}>
              <MenuItem value="">— None —</MenuItem>
              {SECTIONS.map(sec => <MenuItem key={sec} value={sec}>{sec}</MenuItem>)}
            </TextField>
          </Grid>
          <Grid item xs={6} sm={8} md={4}>
            <Button
              variant="outlined" component="label" fullWidth size="medium"
              startIcon={<UploadFileIcon />}
              sx={{ height: 40, textTransform: 'none', justifyContent: 'flex-start' }}
            >
              {parsedRows ? `${parsedRows.length} student(s) ready` : 'Choose CSV File…'}
              <input
                ref={fileInputRef}
                type="file" accept=".csv,text/csv" hidden
                onChange={handleFileChange}
              />
            </Button>
          </Grid>
        </Grid>
      </Paper>

      {parseError && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setParseError(null)}>
          {parseError}
        </Alert>
      )}

      {/* Preview + action bar */}
      {parsedRows && parsedRows.length > 0 && (
        <Paper variant="outlined" sx={{ px: 2, py: 1.25, mb: 2 }}>
          <Stack direction="row" alignItems="center" spacing={2}>
            <Chip
              size="small"
              color="primary"
              variant="outlined"
              label={`${parsedRows.length} student(s) parsed from CSV`}
            />
            <Box sx={{ flex: 1 }} />
            <Button size="small" variant="text" color="inherit" startIcon={<ClearIcon fontSize="small" />}
              onClick={clearFile} sx={{ textTransform: 'none' }}>
              Clear
            </Button>
            <Divider orientation="vertical" flexItem />
            <Button
              variant="contained" size="small"
              startIcon={<UploadFileIcon fontSize="small" />}
              disabled={!canImport}
              onClick={handleImport}
              sx={{ textTransform: 'none' }}
            >
              Import {parsedRows.length} student(s)
            </Button>
          </Stack>
        </Paper>
      )}

      {/* Compact preview table */}
      {parsedRows && parsedRows.length > 0 && (
        <Paper variant="outlined">
          <Box sx={{ px: 2, py: 1, borderBottom: 1, borderColor: 'divider' }}>
            <Typography variant="caption" color="text.secondary" fontWeight={600}>
              PREVIEW
            </Typography>
          </Box>
          <Box sx={{ overflowX: 'auto', maxHeight: 280, overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: 'transparent' }}>
                  {['First name', 'Surname', 'Email'].map(h => (
                    <th key={h} style={{ padding: '6px 12px', textAlign: 'left', fontWeight: 600, borderBottom: '1px solid var(--divider, #e0e0e0)', whiteSpace: 'nowrap' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {parsedRows.map((s, i) => (
                  <tr key={i}>
                    <td style={{ padding: '4px 12px', borderBottom: '1px solid var(--divider, #e0e0e0)' }}>{s.firstname}</td>
                    <td style={{ padding: '4px 12px', borderBottom: '1px solid var(--divider, #e0e0e0)' }}>{s.surname}</td>
                    <td style={{ padding: '4px 12px', borderBottom: '1px solid var(--divider, #e0e0e0)', fontFamily: 'monospace' }}>{s.email}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Box>
        </Paper>
      )}
    </>
  );
}
