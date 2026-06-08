import { useState, useEffect, useCallback } from 'react';
import SqlEditor from './components/SqlEditor';
import ResultsTable from './components/ResultsTable';
import SchemaPanel from './components/SchemaPanel';
import TechStack from './components/TechStack';
import { executeQuery, fetchSchema } from './api/client';

const STORAGE_KEY = 'sql_playground_query';
const THEME_KEY   = 'sql_playground_theme';
const DEFAULT_QUERY = 'SELECT * FROM Customers;';

export default function App() {
  const [sql, setSql] = useState(
    () => sessionStorage.getItem(STORAGE_KEY) || DEFAULT_QUERY
  );
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [schema, setSchema] = useState(null);
  const [schemaVisible, setSchemaVisible] = useState(true);
  const [theme, setTheme] = useState(
    () => localStorage.getItem(THEME_KEY) || 'dark'
  );
  const [techOpen, setTechOpen] = useState(false);

  // Apply theme to <html> element
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  const toggleTheme = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'));

  // Persist editor content to session storage
  useEffect(() => {
    sessionStorage.setItem(STORAGE_KEY, sql);
  }, [sql]);

  // Load schema on mount
  useEffect(() => {
    fetchSchema()
      .then((data) => { if (data.ok) setSchema(data); })
      .catch(() => {}); // schema is non-critical
  }, []);

  const handleRun = useCallback(async () => {
    if (loading) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const data = await executeQuery(sql);
      if (data.ok) {
        setResult(data);
      } else {
        setError(data.error || 'Unknown error');
      }
    } catch (e) {
      setError('Network error: could not reach the server.');
    } finally {
      setLoading(false);
    }
  }, [sql, loading]);

  // Keyboard shortcut: Ctrl+Enter / Cmd+Enter to run
  useEffect(() => {
    function onKey(e) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        handleRun();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleRun]);

  return (
    <div className="layout">
      <header className="header">
        <div className="header-brand">
          <img src="/logo_small.png" alt="KuwaitDevs" className="brand-logo" />
          <span className="brand-name">SQL Online Compiler</span>
        </div>
        <div className="header-actions">
          <button
            className="icon-btn"
            onClick={() => setTechOpen((v) => !v)}
            title="Tech stack"
            aria-label="Tech stack info"
          >
            ⚙
          </button>
          <button
            className="icon-btn"
            onClick={toggleTheme}
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? '☀' : '🌙'}
          </button>
          <button
            className="icon-btn"
            onClick={() => setSchemaVisible((v) => !v)}
            title={schemaVisible ? 'Hide schema panel' : 'Show schema panel'}
            aria-label="Toggle schema panel"
          >
            {schemaVisible ? '⊟' : '⊞'}
          </button>
        </div>
      </header>

      {techOpen && (
        <TechStack onClose={() => setTechOpen(false)} />
      )}

      <main className={`main ${schemaVisible ? 'with-schema' : ''}`}>
        <div className="editor-section">
          <div className="toolbar">
            <button
              className="btn btn-run"
              onClick={handleRun}
              disabled={loading}
              title="Run query (Ctrl+Enter)"
            >
              {loading ? 'Running…' : '▶ Run'}
            </button>
            <span className="toolbar-hint">Ctrl+Enter to run</span>
          </div>

          <SqlEditor value={sql} onChange={setSql} theme={theme} />

        </div>

        <div className="results-section">
          <ResultsTable result={result} error={error} loading={loading} />
        </div>

        {schemaVisible && (
          <aside className="schema-aside">
            <div className="schema-aside-header">
              <span>Tables & Queries</span>
              <button
                className="icon-btn schema-aside-close"
                onClick={() => setSchemaVisible(false)}
                title="Hide schema panel"
                aria-label="Hide schema panel"
              >✕</button>
            </div>
            <SchemaPanel schema={schema} onSampleQuery={setSql} />
          </aside>
        )}
      </main>
    </div>
  );
}
