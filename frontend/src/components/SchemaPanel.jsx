/* Shows table / column metadata and sample queries */

const FIRST_NAMES = ['Sara', 'Ali', 'Mona', 'Omar', 'Layla', 'Faris', 'Noor', 'Khalid', 'Hana', 'Yusuf'];
const LAST_NAMES  = ['Ali', 'Hassan', 'Ahmed', 'Salem', 'Nasser', 'Karimi', 'Smith', 'Khan', 'Lee', 'Tanaka'];
const COUNTRIES   = ['Kuwait', 'Saudi Arabia', 'UAE', 'USA', 'UK', 'Japan', 'Germany', 'France', 'Egypt', 'India'];

function randomInsertCustomer() {
  const id        = Math.floor(Math.random() * 9000) + 100;
  const firstName = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
  const lastName  = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];
  const age       = Math.floor(Math.random() * 43) + 18;
  const country   = COUNTRIES[Math.floor(Math.random() * COUNTRIES.length)];
  return `INSERT INTO Customers (customer_id, first_name, last_name, age, country)\nVALUES (${id}, '${firstName}', '${lastName}', ${age}, '${country}');`;
}

export default function SchemaPanel({ schema, onSampleQuery }) {
  if (!schema) return <div className="schema-loading">Loading schema…</div>;

  const samples = [
    { label: 'All customers', sql: 'SELECT * FROM Customers;' },
    { label: 'All orders', sql: 'SELECT * FROM Orders;' },
    { label: 'Insert a customer', sql: null, generate: randomInsertCustomer },
    { label: 'Orders with customer name', sql: `SELECT o.order_id, c.first_name, c.last_name, o.item, o.amount\nFROM Orders o\nJOIN Customers c ON c.customer_id = o.customer_id\nORDER BY o.order_id;` },
    { label: 'Pending shipments', sql: `SELECT s.shipping_id, c.first_name, c.last_name, s.status\nFROM Shippings s\nJOIN Customers c ON c.customer_id = s.customer\nWHERE s.status = 'Pending';` },
    { label: 'Total spent per customer', sql: `SELECT c.first_name, c.last_name, SUM(o.amount) AS total_spent\nFROM Customers c\nLEFT JOIN Orders o ON o.customer_id = c.customer_id\nGROUP BY c.customer_id, c.first_name, c.last_name\nORDER BY total_spent DESC;` },
  ];

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

      <section className="schema-section">
        <h3>Sample Queries</h3>
        <ul className="samples-list">
          {samples.map((s) => (
            <li key={s.label}>
              <button className="sample-btn" onClick={() => onSampleQuery(s.generate ? s.generate() : s.sql)}>
                {s.label}
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
