import { useState } from 'react';
import {
  Stack, Button, Alert, CircularProgress, Typography,
} from '@mui/material';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import MonitorHeartIcon from '@mui/icons-material/MonitorHeart';
import { adminResetGuestDb, adminHealth } from '../../../api/client';

export default function AdminTab({ token, onAsk }) {
  const [resetting,  setResetting]  = useState(false);
  const [resetMsg,   setResetMsg]   = useState(null);
  const [healthMsg,  setHealthMsg]  = useState(null);

  async function handleReset() {
    onAsk('Reset Guest Database', 'Reset the shared guest database to baseline? All guest data will be wiped.', async () => {
      setResetMsg(null); setResetting(true);
      try {
        const d = await adminResetGuestDb(token);
        setResetMsg({ ok: d.ok, text: d.ok ? `Reset complete — ${d.durationMs}ms, ${d.statementsExecuted} statements.` : d.error });
      } catch { setResetMsg({ ok: false, text: 'Network error.' }); }
      finally { setResetting(false); }
    });
  }

  async function handleHealth() {
    setHealthMsg(null);
    try {
      const d = await adminHealth(token);
      setHealthMsg({ ok: d.ok, text: d.ok ? 'Database connected.' : d.error });
    } catch { setHealthMsg({ ok: false, text: 'Network error.' }); }
  }

  return (
    <>
      <Typography variant="h6" fontWeight={700} mb={2}>Admin — Guest Database</Typography>
      <Stack spacing={2} maxWidth={480}>
        <Stack direction="row" spacing={1.5}>
          <Button
            variant="contained" color="error" fullWidth
            startIcon={resetting ? <CircularProgress size={16} color="inherit" /> : <RestartAltIcon />}
            onClick={handleReset}
            disabled={resetting}
          >
            {resetting ? 'Resetting…' : 'Reset Guest DB to Baseline'}
          </Button>
          <Button
            variant="outlined" fullWidth
            startIcon={<MonitorHeartIcon />}
            onClick={handleHealth}
          >
            Check Health
          </Button>
        </Stack>

        {resetMsg  && <Alert severity={resetMsg.ok  ? 'success' : 'error'} onClose={() => setResetMsg(null)}>{resetMsg.text}</Alert>}
        {healthMsg && <Alert severity={healthMsg.ok ? 'success' : 'error'} onClose={() => setHealthMsg(null)}>{healthMsg.text}</Alert>}

        <Typography variant="caption" color="text.secondary">
          Seed tables: Customers (5), Orders (5), Shippings (5), Teachers, supervisor_salaries
        </Typography>
      </Stack>
    </>
  );
}
