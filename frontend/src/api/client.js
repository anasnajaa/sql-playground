const BASE = '/api';

async function post(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json();
}

async function get(path) {
  const res = await fetch(`${BASE}${path}`);
  return res.json();
}

export const executeQuery = (sql) => post('/execute', { sql });
export const resetDatabase = () => post('/reset', {});
export const fetchSchema = () => get('/schema');
export const fetchHealth = () => get('/health');
