import { useState, useEffect, useCallback } from 'react';
import {
  ThemeProvider, CssBaseline,
  Box, AppBar, Toolbar, Typography, IconButton, Tooltip,
  Grid, Paper, Chip, LinearProgress, Stack, Table, TableHead,
  TableBody, TableRow, TableCell, TableContainer, Alert,
} from '@mui/material';
import HomeIcon from '@mui/icons-material/Home';
import RefreshIcon from '@mui/icons-material/Refresh';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import MemoryIcon from '@mui/icons-material/Memory';
import StorageIcon from '@mui/icons-material/Storage';
import CloudIcon from '@mui/icons-material/Cloud';
import DnsIcon from '@mui/icons-material/Dns';
import { darkTheme } from '../../theme';
import { fetchStatus } from '../../api/client';

function StatusChip({ ok, label }) {
  return (
    <Chip
      icon={ok ? <CheckCircleIcon /> : <ErrorIcon />}
      label={label}
      color={ok ? 'success' : 'error'}
      size="small"
      variant="outlined"
    />
  );
}

function StatCard({ icon, title, children }) {
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

function Row({ label, value }) {
  return (
    <Stack direction="row" justifyContent="space-between" alignItems="center"
      sx={{ py: 0.4, borderBottom: 1, borderColor: 'divider', '&:last-child': { border: 0 } }}>
      <Typography variant="caption" color="text.secondary">{label}</Typography>
      <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>{value}</Typography>
    </Stack>
  );
}

function fmtUptime(s) {
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600),
        m = Math.floor((s % 3600) / 60), sec = s % 60;
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m ${sec}s`;
  return `${m}m ${sec}s`;
}

export default function StatusPage() {
  if (!localStorage.getItem('sql_instructor_jwt')) {
    window.location.href = '/instructor/login';
    return null;
  }

  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);
  const [lastAt,  setLastAt]  = useState(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const d = await fetchStatus();
      setData(d); setLastAt(new Date());
    } catch (e) { setError(e.message || 'Failed to load status.'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { const id = setInterval(load, 30000); return () => clearInterval(id); }, [load]);

  return (
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />
      <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        <AppBar position="static" color="default" elevation={0}
          sx={{ borderBottom: 1, borderColor: 'divider', bgcolor: 'background.paper' }}>
          <Toolbar variant="dense" sx={{ gap: 1 }}>
            <Box component="img" src="/logo_small.png" sx={{ height: 28, mr: 1 }} />
            <Typography variant="subtitle1" fontWeight={700} sx={{ flexGrow: 1 }}>
              Server Status
            </Typography>
            {lastAt && (
              <Typography variant="caption" color="text.secondary">
                Updated {lastAt.toLocaleTimeString()}
              </Typography>
            )}
            <Tooltip title="Playground"><IconButton size="small" href="/"><HomeIcon fontSize="small" /></IconButton></Tooltip>
            <Tooltip title="Refresh">
              <IconButton size="small" onClick={load} disabled={loading}>
                <RefreshIcon fontSize="small" sx={loading ? { animation: 'spin 0.7s linear infinite' } : {}} />
              </IconButton>
            </Tooltip>
          </Toolbar>
          {loading && <LinearProgress sx={{ height: 2 }} />}
        </AppBar>

        <Box sx={{ flex: 1, p: 3 }}>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

          {data && (
            <>
              {/* Summary chips */}
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap mb={3}>
                <StatusChip ok={data.mssql.ok}  label={`MSSQL: ${data.mssql.ok  ? 'Connected' : 'Error'}`} />
                <StatusChip ok={data.mongo.ok}  label={`MongoDB: ${data.mongo.ok ? 'Connected' : 'Error'}`} />
                <StatusChip ok={data.docker.ok} label={`Docker: ${data.docker.ok ? 'OK' : 'Error'}`} />
              </Stack>

              <Grid container spacing={2}>
                {/* System */}
                <Grid item xs={12} sm={6} md={4}>
                  <StatCard icon={<MemoryIcon />} title="System">
                    <Row label="Hostname"   value={data.system.hostname} />
                    <Row label="Platform"   value={data.system.platform} />
                    <Row label="Node.js"    value={data.system.nodeVersion} />
                    <Row label="Uptime"     value={fmtUptime(data.system.uptime)} />
                    <Row label="CPU Cores"  value={data.system.cpu.cores} />
                    <Row label="CPU Model"  value={data.system.cpu.model} />
                    <Row label="Load 1m"    value={data.system.cpu.loadAvg1m} />
                    <Row label="Load 5m"    value={data.system.cpu.loadAvg5m} />
                  </StatCard>
                </Grid>

                {/* Memory */}
                <Grid item xs={12} sm={6} md={4}>
                  <StatCard icon={<StorageIcon />} title="Memory">
                    <Row label="Total" value={`${data.system.memory.totalMb} MB`} />
                    <Row label="Used"  value={`${data.system.memory.usedMb} MB`} />
                    <Row label="Free"  value={`${data.system.memory.freeMb} MB`} />
                    <Box sx={{ mt: 1.5 }}>
                      <Stack direction="row" justifyContent="space-between" mb={0.5}>
                        <Typography variant="caption" color="text.secondary">Usage</Typography>
                        <Typography variant="caption">{data.system.memory.usedPct}%</Typography>
                      </Stack>
                      <LinearProgress
                        variant="determinate"
                        value={data.system.memory.usedPct}
                        color={data.system.memory.usedPct > 85 ? 'error' : 'primary'}
                        sx={{ borderRadius: 1, height: 8 }}
                      />
                    </Box>
                  </StatCard>
                </Grid>

                {/* MSSQL */}
                <Grid item xs={12} sm={6} md={4}>
                  <StatCard icon={<StorageIcon />} title="MSSQL">
                    <Stack mb={1}><StatusChip ok={data.mssql.ok} label={data.mssql.ok ? 'Connected' : 'Unreachable'} /></Stack>
                    {data.mssql.ok && <>
                      <Row label="Version"  value={data.mssql.version} />
                      <Row label="Edition"  value={data.mssql.edition} />
                      <Row label="Latency"  value={`${data.mssql.latencyMs} ms`} />
                      <Row label="User DBs" value={data.mssql.userDbs} />
                    </>}
                    {data.mssql.error && <Typography variant="caption" color="error.main">{data.mssql.error}</Typography>}
                  </StatCard>
                </Grid>

                {/* MongoDB */}
                <Grid item xs={12} sm={6} md={4}>
                  <StatCard icon={<CloudIcon />} title="MongoDB">
                    <Stack mb={1}><StatusChip ok={data.mongo.ok} label={data.mongo.ok ? 'Connected' : (data.mongo.state || 'Error')} /></Stack>
                    {data.mongo.ok && <>
                      <Row label="Latency" value={`${data.mongo.latencyMs} ms`} />
                      <Row label="State"   value={data.mongo.state} />
                    </>}
                    {data.mongo.error && <Typography variant="caption" color="error.main">{data.mongo.error}</Typography>}
                  </StatCard>
                </Grid>

                {/* Docker */}
                <Grid item xs={12} md={8}>
                  <StatCard icon={<DnsIcon />} title="Docker Containers">
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
                                    <TableCell>
                                      <StatusChip ok={c.status?.startsWith('Up')} label={c.status} />
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </TableContainer>
                        )
                    ) : (
                      <Typography variant="caption" color="error.main">{data.docker.error || 'Docker unavailable'}</Typography>
                    )}
                  </StatCard>
                </Grid>
              </Grid>
            </>
          )}
        </Box>
      </Box>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </ThemeProvider>
  );
}
