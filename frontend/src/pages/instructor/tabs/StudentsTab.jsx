import { useState, useEffect, useCallback } from 'react';
import {
  Box, Grid, TextField, MenuItem, Button, Paper, Stack, Divider,
  Table, TableHead, TableBody, TableRow, TableCell, TableContainer,
  Alert, Tooltip, IconButton, LinearProgress, Chip,
  Switch, FormControlLabel, Typography, InputAdornment, Checkbox,
  Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions,
} from '@mui/material';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import DeleteIcon from '@mui/icons-material/Delete';
import MarkEmailReadIcon from '@mui/icons-material/MarkEmailRead';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Clear';
import StorageIcon from '@mui/icons-material/Storage';
import {
  fetchInstructorStudents, sendStudentPassword, resetStudentDb,
  fetchCourseSettings, updateCourseSettings, deleteStudent,
} from '../../../api/client';

function connString(s) {
  const loginName = (s.emailaddress || '').split('@')[0].replace(/[^a-zA-Z0-9_]/g, '_');
  return `Server=sql.kuwaitdevs.com,1433;Database=${s.dbName};User Id=${loginName};Password=${s.plaintextPassword};TrustServerCertificate=True;`;
}

// Progress dialog
function ProgressDialog({ open, title, items, doneCount, errors, onClose }) {
  const total = items.length;
  const pct   = total ? Math.round((doneCount / total) * 100) : 0;
  const done  = doneCount >= total;
  return (
    <Dialog open={open} maxWidth="sm" fullWidth disableEscapeKeyDown={!done}>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <Stack spacing={1.5}>
          <Typography variant="body2" color="text.secondary">
            {done
              ? `Done — processed ${doneCount} of ${total} student(s).`
              : `Processing ${doneCount + 1} of ${total}…`}
          </Typography>
          <LinearProgress variant="determinate" value={pct} sx={{ borderRadius: 1, height: 6 }} />
          {errors.length > 0 && (
            <Alert severity="warning" sx={{ mt: 0.5 }}>
              {errors.length} error(s):
              <Box component="ul" sx={{ pl: 2, mb: 0, mt: 0.5 }}>
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

export default function StudentsTab({ token, courses, semesters }) {
  const [filterSemester, setFilterSemester] = useState('');
  const [filterCourse,   setFilterCourse]   = useState('');
  const [filterSection,  setFilterSection]  = useState('');
  const [search,         setSearch]         = useState('');
  const [students,       setStudents]       = useState([]);
  const [loading,        setLoading]        = useState(false);
  const [msg,            setMsg]            = useState(null);
  const [connEnabled,    setConnEnabled]    = useState(false);
  const [connToggling,   setConnToggling]   = useState(false);
  const [confirm,        setConfirm]        = useState(null);
  const [copied,         setCopied]         = useState(null);
  const [selected,       setSelected]       = useState(new Set());
  const [prog,           setProg]           = useState(null);

  useEffect(() => {
    const cur = semesters.find(s => s.isCurrent);
    if (cur) setFilterSemester(cur.shortCode);
  }, [semesters]);

  const loadStudents = useCallback(async () => {
    if (!filterCourse || !filterSemester) { setStudents([]); setSelected(new Set()); return; }
    setLoading(true); setMsg(null);
    try {
      const [sd, cs] = await Promise.all([
        fetchInstructorStudents(token, filterCourse, filterSemester),
        fetchCourseSettings(token, filterCourse, filterSemester),
      ]);
      if (sd.ok) { setStudents(sd.students); setSelected(new Set()); }
      else setMsg({ ok: false, text: sd.error });
      setConnEnabled(cs?.connStringEnabled || false);
    } catch { setMsg({ ok: false, text: 'Network error.' }); }
    finally { setLoading(false); }
  }, [token, filterCourse, filterSemester]);

  useEffect(() => { loadStudents(); }, [loadStudents]);

  const sections = [...new Set(students.map(s => s.courseSection).filter(Boolean))].sort();
  const q = search.trim().toLowerCase();
  const visible = students.filter(s => {
    if (filterSection && s.courseSection !== filterSection) return false;
    if (q && !`${s.firstname} ${s.surname}`.toLowerCase().includes(q) && !s.emailaddress?.toLowerCase().includes(q)) return false;
    return true;
  });

  const visibleIds  = visible.map(s => s._id);
  const allChecked  = visibleIds.length > 0 && visibleIds.every(id => selected.has(id));
  const someChecked = visibleIds.some(id => selected.has(id));
  const selCount    = [...selected].filter(id => students.find(s => s._id === id)).length;
  const selectedStudents = students.filter(s => selected.has(s._id));

  function toggleAll() {
    if (allChecked) {
      setSelected(prev => { const n = new Set(prev); visibleIds.forEach(id => n.delete(id)); return n; });
    } else {
      setSelected(prev => new Set([...prev, ...visibleIds]));
    }
  }
  function toggleOne(id) {
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }
  function clearSelection() { setSelected(new Set()); }

  async function runOnSelected(title, targets, action, onDone) {
    setProg({ title, items: targets, doneCount: 0, errors: [] });
    const errors = [];
    for (let i = 0; i < targets.length; i++) {
      try { await action(targets[i]); }
      catch (err) { errors.push({ email: targets[i].emailaddress, reason: err.message }); }
      setProg({ title, items: targets, doneCount: i + 1, errors: [...errors] });
    }
    if (onDone) onDone(errors);
  }
  function closeProg() { setProg(null); loadStudents(); }
  function ask(title, text, onConfirm) { setConfirm({ title, text, onConfirm }); }

  async function handleConnToggle(val) {
    setConnToggling(true);
    try { await updateCourseSettings(token, filterCourse, filterSemester, val); setConnEnabled(val); }
    catch { /* non-fatal */ }
    finally { setConnToggling(false); }
  }

  async function handleSendPassword(id) {
    try {
      const d = await sendStudentPassword(token, id);
      setMsg({ ok: d.ok, text: d.message || d.error });
    } catch { setMsg({ ok: false, text: 'Network error.' }); }
  }

  function handleResetDb(id, dbName) {
    ask('Reset Database', `Reset "${dbName}" to baseline? All changes will be lost.`, async () => {
      try {
        const d = await resetStudentDb(token, id);
        setMsg({ ok: d.ok, text: d.message || d.error });
      } catch { setMsg({ ok: false, text: 'Network error.' }); }
    });
  }

  function handleDeleteRow(s) {
    ask('Delete Student', `Remove ${s.firstname} ${s.surname} and drop their database?`, async () => {
      try {
        const d = await deleteStudent(token, s._id);
        if (d.ok) {
          setStudents(prev => prev.filter(p => p._id !== s._id));
          setSelected(prev => { const n = new Set(prev); n.delete(s._id); return n; });
        } else setMsg({ ok: false, text: d.error });
      } catch { setMsg({ ok: false, text: 'Network error.' }); }
    });
  }

  const getTargets = () => selCount > 0 ? selectedStudents : visible;

  function handleBulkSend() {
    const t = getTargets();
    ask('Send Passwords', `Regenerate & email passwords for ${t.length} student(s)?`,
      () => runOnSelected('Sending passwords…', t, s => sendStudentPassword(token, s._id)));
  }

  function handleBulkResetDbs() {
    const t = getTargets();
    ask('Reset Databases', `Reset databases for ${t.length} student(s)? All changes will be lost.`,
      () => runOnSelected('Resetting databases…', t, s => resetStudentDb(token, s._id)));
  }

  function handleBulkDelete() {
    const t = getTargets();
    ask('Delete Students', `Soft-delete ${t.length} student(s) and drop their databases?`,
      () => runOnSelected('Deleting students…', t, s => deleteStudent(token, s._id),
        (errors) => {
          if (!errors.length) {
            const ids = new Set(t.map(s => s._id));
            setStudents(prev => prev.filter(p => !ids.has(p._id)));
            setSelected(new Set());
          }
        }
      )
    );
  }

  function copyConn(s) {
    navigator.clipboard?.writeText(connString(s));
    setCopied(s._id);
    setTimeout(() => setCopied(null), 1500);
  }

  const hasFilters = !!filterCourse && !!filterSemester;
  const bulkLabel  = selCount > 0 ? `${selCount} selected` : `all ${visible.length}`;

  return (
    <>
      <Dialog open={!!confirm} onClose={() => setConfirm(null)} maxWidth="xs" fullWidth>
        <DialogTitle>{confirm?.title}</DialogTitle>
        <DialogContent><DialogContentText>{confirm?.text}</DialogContentText></DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirm(null)}>Cancel</Button>
          <Button color="error" variant="contained" onClick={async () => {
            const fn = confirm?.onConfirm; setConfirm(null); if (fn) await fn();
          }}>Confirm</Button>
        </DialogActions>
      </Dialog>

      {prog && (
        <ProgressDialog
          open
          title={prog.title}
          items={prog.items}
          doneCount={prog.doneCount}
          errors={prog.errors}
          onClose={closeProg}
        />
      )}

      {/* Filter card */}
      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={6} md={3}>
            <TextField select label="Semester" value={filterSemester} size="small" fullWidth
              onChange={e => { setFilterSemester(e.target.value); setFilterSection(''); setSearch(''); }}>
              <MenuItem value="">— All Semesters —</MenuItem>
              {semesters.map(s => (
                <MenuItem key={s.shortCode} value={s.shortCode}>
                  {s.shortCode}{s.isCurrent ? ' ★' : ''}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <TextField select label="Course" value={filterCourse} size="small" fullWidth
              onChange={e => { setFilterCourse(e.target.value); setFilterSection(''); setSearch(''); }}>
              <MenuItem value="">— All Courses —</MenuItem>
              {courses.map(c => (
                <MenuItem key={c.code} value={c.code}>
                  {c.code}{c.title ? ` — ${c.title}` : ''}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid item xs={6} sm={4} md={2}>
            <TextField select label="Section" value={filterSection} size="small" fullWidth
              disabled={!hasFilters || sections.length === 0}
              onChange={e => setFilterSection(e.target.value)}>
              <MenuItem value="">All Sections</MenuItem>
              {sections.map(sec => <MenuItem key={sec} value={sec}>{sec}</MenuItem>)}
            </TextField>
          </Grid>
          <Grid item xs={6} sm={8} md={4}>
            <TextField
              label="Search" placeholder="Name or email…"
              value={search} size="small" fullWidth
              disabled={!hasFilters}
              onChange={e => setSearch(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment>
                ),
                endAdornment: search ? (
                  <InputAdornment position="end">
                    <IconButton size="small" edge="end" onClick={() => setSearch('')}>
                      <ClearIcon fontSize="small" />
                    </IconButton>
                  </InputAdornment>
                ) : null,
              }}
            />
          </Grid>
        </Grid>
      </Paper>

      {/* Action toolbar */}
      {hasFilters && !loading && students.length > 0 && (
        <Paper variant="outlined" sx={{ px: 2, py: 1.25, mb: 2 }}>
          <Stack direction="row" alignItems="center" spacing={2} flexWrap="wrap" useFlexGap>
            <FormControlLabel
              sx={{ mr: 0, my: 0 }}
              control={
                <Switch
                  checked={connEnabled}
                  onChange={e => handleConnToggle(e.target.checked)}
                  disabled={connToggling}
                  color="success"
                  size="small"
                />
              }
              label={
                <Stack direction="row" alignItems="center" spacing={0.5}>
                  <StorageIcon sx={{ fontSize: 14, color: connEnabled ? 'success.main' : 'text.disabled' }} />
                  <Typography variant="caption" color={connEnabled ? 'success.main' : 'text.secondary'}>
                    SSMS Connect
                  </Typography>
                </Stack>
              }
            />
            <Divider orientation="vertical" flexItem />
            <Box sx={{ flex: 1, minWidth: 0 }}>
              {selCount > 0 ? (
                <Chip
                  size="small"
                  label={`${selCount} of ${visible.length} selected`}
                  color="primary"
                  variant="outlined"
                  onDelete={clearSelection}
                  deleteIcon={<ClearIcon />}
                />
              ) : (
                <Typography variant="caption" color="text.disabled" noWrap>
                  No selection — bulk actions apply to all {visible.length} visible
                </Typography>
              )}
            </Box>
            <Stack direction="row" spacing={1}>
              <Tooltip title={`Send passwords for ${bulkLabel}`} placement="top">
                <Button size="small" variant="outlined"
                  startIcon={<MarkEmailReadIcon fontSize="small" />}
                  onClick={handleBulkSend} sx={{ textTransform: 'none' }}>
                  Send
                </Button>
              </Tooltip>
              <Tooltip title={`Reset databases for ${bulkLabel}`} placement="top">
                <Button size="small" variant="outlined" color="warning"
                  startIcon={<RestartAltIcon fontSize="small" />}
                  onClick={handleBulkResetDbs} sx={{ textTransform: 'none' }}>
                  Reset DBs
                </Button>
              </Tooltip>
              <Tooltip title={`Delete ${bulkLabel}`} placement="top">
                <Button size="small" variant="outlined" color="error"
                  startIcon={<DeleteIcon fontSize="small" />}
                  onClick={handleBulkDelete} sx={{ textTransform: 'none' }}>
                  Delete
                </Button>
              </Tooltip>
            </Stack>
          </Stack>
        </Paper>
      )}

      {msg && (
        <Alert severity={msg.ok ? 'success' : 'error'} sx={{ mb: 2 }} onClose={() => setMsg(null)}>
          {msg.text}
        </Alert>
      )}

      {loading && <LinearProgress sx={{ mb: 2, borderRadius: 1 }} />}

      {!hasFilters && (
        <Box sx={{ py: 8, textAlign: 'center' }}>
          <Typography color="text.disabled" variant="body2">
            Select a semester and course to view students.
          </Typography>
        </Box>
      )}

      {hasFilters && !loading && students.length === 0 && (
        <Box sx={{ py: 8, textAlign: 'center' }}>
          <Typography color="text.disabled" variant="body2">
            No students found for this course / semester.
          </Typography>
        </Box>
      )}

      {visible.length > 0 && (
        <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 'calc(100vh - 380px)' }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell padding="checkbox" sx={{ bgcolor: 'background.paper' }}>
                  <Checkbox size="small" indeterminate={someChecked && !allChecked} checked={allChecked} onChange={toggleAll} />
                </TableCell>
                <TableCell sx={{ fontWeight: 600, bgcolor: 'background.paper' }}>Name</TableCell>
                <TableCell sx={{ fontWeight: 600, bgcolor: 'background.paper', width: 56 }}>Sec</TableCell>
                <TableCell sx={{ fontWeight: 600, bgcolor: 'background.paper' }}>Email</TableCell>
                <TableCell sx={{ fontWeight: 600, bgcolor: 'background.paper', width: 130 }}>Password</TableCell>
                <TableCell sx={{ fontWeight: 600, bgcolor: 'background.paper', width: 160 }}>Database</TableCell>
                <TableCell align="right" sx={{ fontWeight: 600, bgcolor: 'background.paper', width: 108 }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {visible.map(s => (
                <TableRow key={s._id} hover selected={selected.has(s._id)}
                  sx={{ cursor: 'pointer' }} onClick={() => toggleOne(s._id)}>
                  <TableCell padding="checkbox" onClick={e => e.stopPropagation()}>
                    <Checkbox size="small" checked={selected.has(s._id)} onChange={() => toggleOne(s._id)} />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" noWrap fontWeight={500}>{s.firstname} {s.surname}</Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" fontFamily="monospace" fontSize={12} color="text.secondary">
                      {s.courseSection || '—'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" fontFamily="monospace" fontSize={12} noWrap>{s.emailaddress}</Typography>
                  </TableCell>
                  <TableCell onClick={e => e.stopPropagation()}>
                    <Tooltip title={s.plaintextPassword || '—'} placement="top">
                      <Typography variant="body2" fontFamily="monospace" fontSize={11} noWrap
                        sx={{ maxWidth: 120, color: 'text.secondary', cursor: 'default' }}>
                        {s.plaintextPassword || '—'}
                      </Typography>
                    </Tooltip>
                  </TableCell>
                  <TableCell onClick={e => e.stopPropagation()}>
                    <Tooltip title={s.dbName} placement="top">
                      <Typography variant="body2" fontFamily="monospace" fontSize={11} noWrap
                        sx={{ maxWidth: 150, color: 'text.secondary', cursor: 'default' }}>
                        {s.dbName}
                      </Typography>
                    </Tooltip>
                  </TableCell>
                  <TableCell align="right" onClick={e => e.stopPropagation()}>
                    <Stack direction="row" spacing={0} justifyContent="flex-end">
                      <Tooltip title={copied === s._id ? 'Copied!' : 'Copy SSMS connection string'}>
                        <IconButton size="small" color={copied === s._id ? 'success' : 'default'} onClick={() => copyConn(s)}>
                          <ContentCopyIcon sx={{ fontSize: 15 }} />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Regenerate & email password">
                        <IconButton size="small" color="primary" onClick={() => handleSendPassword(s._id)}>
                          <MarkEmailReadIcon sx={{ fontSize: 15 }} />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Reset database to baseline">
                        <IconButton size="small" color="warning" onClick={() => handleResetDb(s._id, s.dbName)}>
                          <RestartAltIcon sx={{ fontSize: 15 }} />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete student">
                        <IconButton size="small" color="error" onClick={() => handleDeleteRow(s)}>
                          <DeleteIcon sx={{ fontSize: 15 }} />
                        </IconButton>
                      </Tooltip>
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {visible.length > 0 && (
        <Typography variant="caption" color="text.disabled" sx={{ mt: 1, display: 'block' }}>
          {visible.length === students.length
            ? `${students.length} student(s)`
            : `${visible.length} of ${students.length} student(s) shown`}
          {selCount > 0 && ` · ${selCount} selected`}
        </Typography>
      )}
    </>
  );
}
