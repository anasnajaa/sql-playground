/* Renders query results as a scrollable table */
export default function ResultsTable({ result, error, loading }) {
  if (loading) {
    return <div className="results-status">Running query…</div>;
  }

  if (error) {
    return (
      <div className="results-error">
        <strong>Error:</strong> {error}
      </div>
    );
  }

  if (!result) {
    return <div className="results-status results-empty">Run a query to see results here.</div>;
  }

  const { columns, rows, rowCount, truncated, maxRows, rowsAffected, durationMs } = result;

  return (
    <div className="results-wrap">
      <div className="results-meta">
        {columns.length > 0
          ? `${rowCount} row${rowCount !== 1 ? 's' : ''} returned`
          : `${rowsAffected} row${rowsAffected !== 1 ? 's' : ''} affected`}
        {truncated && (
          <span className="results-truncated">
            {' '}(truncated to {maxRows} rows)
          </span>
        )}
        <span className="results-time"> · {durationMs}ms</span>
      </div>

      {columns.length > 0 && (
        <div className="table-scroll">
          <table className="results-table">
            <thead>
              <tr>
                {columns.map((col) => (
                  <th key={col}>{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i}>
                  {columns.map((col) => (
                    <td key={col}>
                      {row[col] === null ? <span className="null-val">NULL</span> : String(row[col])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
