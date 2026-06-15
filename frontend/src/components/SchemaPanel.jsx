/* Shows table / column metadata */

export default function SchemaPanel({ schema }) {
  if (!schema) return <div className="schema-loading">Loading schema…</div>;

  return (
    <div className="schema-panel">
      <section className="schema-section">
        <h3>Tables</h3>
        {schema.tables.map((table) => (
          <details key={table.name} className="schema-table">
            <summary>{table.name}</summary>
            <ul>
              {table.columns.map((col) => (
                <li key={col.name}>
                  <span className="col-name">{col.name}</span>
                  <span className="col-type">{col.type}</span>
                  {col.nullable && <span className="col-null">nullable</span>}
                </li>
              ))}
            </ul>
          </details>
        ))}
      </section>
    </div>
  );
}
