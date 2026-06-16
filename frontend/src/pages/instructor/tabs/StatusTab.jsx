import { useState, useEffect, useCallback } from 'react';
import {
  Box, Grid, Paper, Stack, Typography, Chip, IconButton, Tooltip,
  Table, TableHead, TableBody, TableRow, TableCell, TableContainer,
  LinearProgress, Alert, Button, CircularProgress, Divider,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import MemoryIcon from '@mui/icons-material/Memory';
import StorageIcon from '@mui/icons-material/Storage';
import CloudIcon from '@mui/icons-material/Cloud';
import DnsIcon from '@mui/icons-material/Dns';
import RefreshIcon from '@mui/icons-material/Refresh';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import { fetchStatus, adminResetGuestDb } from '../../../api/client';

function fmtUptime(s) {
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600),
        m = Math.floor((s % 3600) / 60), sec = s % 60;
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m ${sec}s`;
  return `${m}m ${sec}s`;
}

function StatusChip({ ok, label }) {
  return (
    <Chip
      icon={ok ? <CheckCircleIcon /> : <ErrorIcon />}
      label={label} color={ok ? 'success' : 'error'}
      size="small" variant="outlined"
    />
  );
}

function SRow({ label, value }) {
  return (
    <Stack direction="row" justifyContent="space-between" alignItems="center"
      sx={{ py: 0.4, borderBottom: 1, borderColor: 'divider', '&:last-child': { border: 0 } }}>
      <Typography variant="caption" color="text.secondary">{label}</Typography>
      <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>{value}</Typography>
    </Stack>
  );
}

function SCard({ icon, title, children }) {
  return (
    <Paper variant="outlined" sx={{ p: 2, height: '100%' }}>
      <Stack direction="row" alignItems="center" spacing={1} mb={1.5}>
        <Box sx={{ color: 'primary.main' }}>{icon}</Box>
        <Typography variant="subtitle2" fontWeight={700}>{title}</Typography>
      </Stack>
      {children}
    </Paper>
  );
}

export default function StatusTab({ token, isAdmin, onAsk }) {
  const [data,       setData]       = useState(null);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState(null);
  const [lastAt,     setLastAt]     = useState(null);
  const [resetting,  setResetting]  = useState(false);
  const [resetMsg,   setResetMsg]   = useState(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const d = await fetchStatus();
      setData(d); setLastAt(new Date());
    } catch (e) { setError(e.message || 'Failed to load status.'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  function handleReset() {
    onAsk('Reset Guest Database', 'Reset the shared guest database to baseline? All guest data will be wiped.', async () => {
      setResetMsg(null); setResetting(true);
      try {
        const d = await adminResetGuestDb(token);
        setResetMsg({ ok: d.ok, text: d.ok ? `Reset complete — ${d.durationMs}ms, ${d.statementsExecuted} statements.` : d.error });
      } catch { setResetMsg({ ok: false, text: 'Network error.' }); }
      finally { setResetting(false); }
    });
  }

  return (
    <>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h6" fontWeight={700}>Server Status</Typography>
        <Stack direction="row" spacing={1} alignItems="center">
          {lastAt && (
            <Typography variant="caption" color="text.secondary">
              Updated {lastAt.toLocaleTimeString()}
            </Typography>
          )}
          <Tooltip title="Refresh">
            <IconButton size="small" onClick={load} disabled={loading}>
              <RefreshIcon fontSize="small"
                sx={loading ? { animation: 'spin 0.7s linear infinite' } : {}} />
            </IconButton>
          </Tooltip>
        </Stack>
      </Stack>

      {loading && !data && <LinearProgress sx={{ mb: 2, borderRadius: 1 }} />}
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {data && (
        <>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap mb={3}>
            <StatusChip ok={data.mssql.ok}  label={`MSSQL: ${data.mssql.ok  ? 'Connected' : 'Error'}`} />
            <StatusChip ok={data.mongo.ok}  label={`MongoDB: ${data.mongo.ok ? 'Connected' : 'Error'}`} />
            <StatusChip ok={data.docker.ok} label={`Docker: ${data.docker.ok ? 'OK' : 'Error'}`} />
          </Stack>

          <Grid container spacing={2}>
            <Grid item xs={12} sm={6} md={4}>
              <SCard icon={<MemoryIcon />} title="System">
                <SRow label="Hostname"  value={data.system.hostname} />
                <SRow label="Platform"  value={data.system.platform} />
                <SRow label="Node.js"   value={data.system.nodeVersion} />
                <SRow label="Uptime"    value={fmtUptime(data.system.uptime)} />
                <SRow label="CPU Cores" value={data.system.cpu.cores} />
                <SRow label="CPU Model" value={data.system.cpu.model} />
                <SRow label="Load 1m"   value={data.system.cpu.loadAvg1m} />
                <SRow label="Load 5m"   value={data.system.cpu.loadAvg5m} />
              </SCard>
            </Grid>

            <Grid item xs={12} sm={6} md={4}>
              <SCard icon={<StorageIcon />} title="Memory">
                <SRow label="Total" value={`${data.system.memory.totalMb} MB`} />
                <SRow label="Used"  value={`${data.system.memory.usedMb} MB`} />
                <SRow label="Free"  value={`${data.system.memory.freeMb} MB`} />
                <Box sx={{ mt: 1.5 }}>
                  <Stack direction="row" justifyContent="space-between" mb={0.5}>
                    <Typography variant="caption" color="text.secondary">Usage</Typography>
                    <Typography variant="caption">{data.system.memory.usedPct}%</Typography>
                  </Stack>
                  <LinearProgress
                    variant="determinate" value={data.system.memory.usedPct}
                    color={data.system.memory.usedPct > 85 ? 'error' : 'primary'}
                    sx={{ borderRadius: 1, height: 8 }}
                  />
                </Box>
              </SCard>
            </Grid>

            <Grid item xs={12} sm={6} md={4}>
              <SCard icon={<StorageIcon />} title="MSSQL">
                <Stack mb={1}><StatusChip ok={data.mssql.ok} label={data.mssql.ok ? 'Connected' : 'Unreachable'} /></Stack>
                {data.mssql.ok && <>
                  <SRow label="Version"  value={data.mssql.version} />
                  <SRow label="Edition"  value={data.mssql.edition} />
                  <SRow label="Latency"  value={`${data.mssql.latencyMs} ms`} />
                  <SRow label="User DBs" value={data.mssql.userDbs} />
                </>}
                {data.mssql.error && <Typography variant="caption" color="error.main">{data.mssql.error}</Typography>}
              </SCard>
            </Grid>

            <Grid item xs={12} sm={6} md={4}>
              <SCard icon={<CloudIcon />} title="MongoDB">
                <Stack mb={1}><StatusChip ok={data.mongo.ok} label={data.mongo.ok ? 'Connected' : (data.mongo.state || 'Error')} /></Stack>
                {data.mongo.ok && <>
                  <SRow label="Latency" value={`${data.mongo.latencyMs} ms`} />
                  <SRow label="State"   value={data.mongo.state} />
                </>}
                {data.mongo.error && <Typography variant="caption" color="error.main">{data.mongo.error}</Typography>}
              </SCard>
            </Grid>

            <Grid item xs={12} md={8}>
              <SCard icon={<DnsIcon />} title="Docker Containers">
                {data.docker.ok ? (
                  data.docker.containers.length === 0
                    ? <Typography variant="caption" color="text.secondary">No running containers.</Typography>
                    : (
                      <TableContainer>
                        <Table size="small">
                          <TableHead>
                            <TableRow>
                              <TableCell>Name</TableCell>
                              <TableCell>Image</TableCell>
                              <TableCell>Status</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {data.docker.containers.map((c, i) => (
                              <TableRow key={i}>
                                <TableCell sx={{ fontFamily: 'monospace', fontSize: 12 }}>{c.name}</TableCell>
                                <TableCell sx={{ fontFamily: 'monospace', fontSize: 12 }}>{c.image}</TableCell>
                                <TableCell><StatusChip ok={c.status?.startsWith('Up')} label={c.status} /></TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    )
                ) : (
                  <Typography variant="caption" color="error.main">{data.docker.error || 'Docker unavailable'}</Typography>
                )}
              </SCard>
            </Grid>
          </Grid>
        </>
      )}

      {isAdmin && (
        <>
          <Divider sx={{ my: 3 }} />
          <Typography variant="h6" fontWeight={700} mb={2}>Admin — Guest Database</Typography>
          <Stack spacing={2} maxWidth={400}>
            <Button
              variant="contained" color="error"
              startIcon={resetting ? <CircularProgress size={16} color="inherit" /> : <RestartAltIcon />}
              onClick={handleReset}
              disabled={resetting}
            >
              {resetting ? 'Resetting…' : 'Reset Guest DB to Baseline'}
            </Button>
            {resetMsg && (
              <Alert severity={resetMsg.ok ? 'success' : 'error'} onClose={() => setResetMsg(null)}>
                {resetMsg.text}
              </Alert>
            )}
            <Typography variant="caption" color="text.secondary">
              Seed tables: Customers (5), Orders (5), Shippings (5), Teachers, supervisor_salaries
            </Typography>
          </Stack>
        </>
      )}
    </>
  );
}
