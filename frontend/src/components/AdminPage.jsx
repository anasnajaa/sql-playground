import { useState } from 'react';

const STORAGE_KEY = 'sql_admin_token';

export default function AdminPage() {
  const [token, setToken] = useState(() => sessionStorage.getItem(STORAGE_KEY) || '');
  const [authed, setAuthed] = useState(() => !!sessionStorage.getItem(STORAGE_KEY));
  const [input, setInput] = useState('');
  const [loginError, setLoginError] = useState(null);
  const [loggingIn, setLoggingIn] = useState(false);
  const [status, setStatus] = useState(null);
  const [resetting, setResetting] = useState(false);
  const [dbStatus, setDbStatus] = useState(null);

  async function handleLogin(e) {
    e.preventDefault();
    setLoginError(null);
    setLoggingIn(true);
    try {
      const res = await fetch('/api/admin/verify', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${input}`, 'Content-Type': 'application/json' },
      });
      if (res.status === 401) {
        setLoginError('Invalid token.');
        return;
      }
      sessionStorage.setItem(STORAGE_KEY, input);
      setToken(input);
      setAuthed(true);
    } catch {
      setLoginError('Network error.');
    } finally {
      setLoggingIn(false);
    }
  }

  async function handleReset() {
    if (resetting) return;
    setResetting(true);
    setStatus(null);
    try {
      const res = await fetch('/api/admin/reset', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (res.status === 401) { setAuthed(false); sessionStorage.removeItem(STORAGE_KEY); return; }
      setStatus({ ok: data.ok, message: data.ok ? `Reset complete — ${data.durationMs}ms, ${data.statementsExecuted} statements executed.` : data.error });
    } catch {
      setStatus({ ok: false, message: 'Network error.' });
    } finally {
      setResetting(false);
    }
  }

  async function handleHealth() {
    setDbStatus(null);
    try {
      const res = await fetch('/api/health');
      const data = await res.json();
      setDbStatus({ ok: data.ok, message: data.ok ? 'Database connected.' : data.error });
    } catch {
      setDbStatus({ ok: false, message: 'Network error.' });
    }
  }

  return (
    <div className="admin-page">
      <div className="admin-card">
        <div className="admin-header">
          <img src="/logo_small.png" alt="KuwaitDevs" className="brand-logo" />
          <div>
            <h1>Admin Panel</h1>
            <p>SQL Playground — sql.kuwaitdevs.com</p>
          </div>
        </div>

        {!authed ? (
          <form className="admin-login" onSubmit={handleLogin}>
            <label htmlFor="token">Admin Token</label>
            <input
              id="token"
              type="password"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Enter admin token…"
              autoFocus
            />
            <button type="submit" className="btn btn-run" disabled={!input || loggingIn}>
              {loggingIn ? 'Verifying…' : '→ Login'}
            </button>
            {loginError && (
              <div className="admin-msg admin-msg-error">{loginError}</div>
            )}
          </form>
        ) : (
          <div className="admin-actions">
            <div className="admin-section">
              <h2>Database</h2>
              <div className="admin-row">
                <button className="btn btn-run" onClick={handleReset} disabled={resetting}>
                  {resetting ? 'Resetting…' : '↺ Reset Database to Baseline'}
                </button>
                <button className="btn btn-secondary" onClick={handleHealth}>
                  ⚡ Check Health
                </button>
              </div>
              {status && (
                <div className={`admin-msg ${status.ok ? 'admin-msg-ok' : 'admin-msg-error'}`}>
                  {status.message}
                </div>
              )}
              {dbStatus && (
                <div className={`admin-msg ${dbStatus.ok ? 'admin-msg-ok' : 'admin-msg-error'}`}>
                  {dbStatus.message}
                </div>
              )}
            </div>

            <div className="admin-section admin-info">
              <h2>Seed Tables</h2>
              <ul>
                <li><strong>Customers</strong> — 5 rows</li>
                <li><strong>Orders</strong> — 5 rows</li>
                <li><strong>Shippings</strong> — 5 rows</li>
              </ul>
            </div>

            <button
              className="btn btn-secondary admin-logout"
              onClick={() => { setAuthed(false); sessionStorage.removeItem(STORAGE_KEY); setToken(''); setStatus(null); }}
            >
              Logout
            </button>
          </div>
        )}

        <a href="/" className="admin-back">← Back to playground</a>
      </div>
    </div>
  );
}
