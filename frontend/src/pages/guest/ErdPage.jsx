import { useState, useEffect, useCallback } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  Position,
  Handle,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

const THEME_KEY      = 'sql_playground_theme';
const JWT_STUDENT    = 'sql_student_jwt';
const JWT_INSTRUCTOR = 'sql_instructor_jwt';

function parseJwt(t) {
  try { return JSON.parse(atob(t.split('.')[1])); } catch { return null; }
}

function layoutKey(studentToken, instructorToken) {
  if (studentToken) {
    const p = parseJwt(studentToken);
    return `erd_pos_student_${p?.dbName || 'unknown'}`;
  }
  if (instructorToken) {
    const p = parseJwt(instructorToken);
    return `erd_pos_instructor_${p?.email || 'unknown'}`;
  }
  return 'erd_pos_guest';
}

function loadPositions(key) {
  try { return JSON.parse(localStorage.getItem(key)) || {}; } catch { return {}; }
}

function persistPositions(key, nodes) {
  const pos = {};
  nodes.forEach(n => { pos[n.id] = n.position; });
  localStorage.setItem(key, JSON.stringify(pos));
}

function TableNode({ data }) {
  return (
    <div className="erd-node">
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />
      <div className="erd-node-header">{data.label}</div>
      {data.columns.map((col) => (
        <div
          key={col.name}
          className={`erd-node-col${col.isPk ? ' pk' : col.isFk ? ' fk' : ''}`}
        >
          <span className="erd-node-col-name">{col.name}</span>
          <span className="erd-node-col-type">{col.type}</span>
          <span className="erd-node-badges">
            {col.isPk && <span className="erd-badge erd-pk">PK</span>}
            {col.isFk && <span className="erd-badge erd-fk">FK</span>}
          </span>
        </div>
      ))}
    </div>
  );
}

const nodeTypes = { table: TableNode };

/* ── Auto-layout: left-to-right columns ───────────────────────────── */
function buildGraph(erd) {
  const fkCols = new Set(erd.relations.map(r => `${r.fromTable}.${r.fromColumn}`));
  const COL_W = 240, COL_GAP = 120;

  // Group: pure-referenced (no outgoing FKs) → referencing → isolated
  const referenced  = new Set(erd.relations.map(r => r.toTable));
  const referencing = new Set(erd.relations.map(r => r.fromTable));
  const cols = [
    erd.tables.filter(t => referenced.has(t.name)  && !referencing.has(t.name)),
    erd.tables.filter(t => referencing.has(t.name)),
    erd.tables.filter(t => !referenced.has(t.name) && !referencing.has(t.name)),
  ].filter(c => c.length > 0);

  let x = 60;
  const nodes = [];
  cols.forEach(col => {
    let y = 60;
    col.forEach(table => {
      const height = 38 + table.columns.length * 48;
      nodes.push({
        id: table.name,
        type: 'table',
        position: { x, y },
        data: {
          label: table.name,
          columns: table.columns.map(c => ({
            ...c,
            isFk: fkCols.has(`${table.name}.${c.name}`),
          })),
        },
        style: { width: COL_W },
      });
      y += height + 40;
    });
    x += COL_W + COL_GAP;
  });

  const edges = erd.relations.map((rel, i) => ({
    id: `e${i}`,
    source: rel.fromTable,
    target: rel.toTable,
    label: `${rel.fromColumn} → ${rel.toColumn}`,
    type: 'smoothstep',
    animated: true,
    style: { stroke: 'var(--accent)', strokeWidth: 1.5 },
    labelStyle: { fill: 'var(--text-muted)', fontSize: 10, fontFamily: 'var(--font-mono)' },
    labelBgStyle: { fill: 'var(--surface)', fillOpacity: 0.85 },
    markerEnd: { type: 'arrowclosed', color: 'var(--accent)' },
  }));

  return { nodes, edges };
}

/* ── Page ──────────────────────────────────────────────────────────── */
export default function ErdPage() {
  const [erd,   setErd]   = useState(null);
  const [error, setError] = useState(null);
  const [theme]           = useState(() => localStorage.getItem(THEME_KEY) || 'dark');

  const studentToken    = localStorage.getItem(JWT_STUDENT);
  const instructorToken = localStorage.getItem(JWT_INSTRUCTOR);
  const authToken       = studentToken || instructorToken;
  const posKey          = layoutKey(studentToken, instructorToken);

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    const headers = {};
    if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
    fetch('/api/erd', { headers })
      .then(r => r.json())
      .then(d => {
        if (!d.ok) { setError(d.error); return; }
        setErd(d);
        const { nodes: n, edges: e } = buildGraph(d);
        // Apply saved positions if available
        const saved = loadPositions(posKey);
        const positioned = n.map(node =>
          saved[node.id] ? { ...node, position: saved[node.id] } : node
        );
        setNodes(positioned);
        setEdges(e);
      })
      .catch(() => setError('Network error — could not load schema.'));
  }, [theme, authToken, posKey, setNodes, setEdges]);

  const handleNodeDragStop = useCallback((_, __, nodes) => {
    persistPositions(posKey, nodes);
  }, [posKey]);

  const header = (
    <div className="erd-topbar">
      <a href="/" className="icon-btn" title="Back to playground" aria-label="Back">
        <span className="material-icons">arrow_back</span>
      </a>
      <h1>Schema &amp; Relationships</h1>
      {erd && (
        <span className="erd-subtitle">
          {erd.tables.length} tables · {erd.relations.length} relationships
          {studentToken && ' · your database'}
        </span>
      )}
    </div>
  );

  if (error) return <div className="erd-page">{header}<div className="erd-notice erd-error">{error}</div></div>;
  if (!erd)  return <div className="erd-page">{header}<div className="erd-notice">Loading schema…</div></div>;

  const isDark = theme === 'dark';

  return (
    <div className="erd-page">
      {header}
      <div className="erd-flow-wrap">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          onNodeDragStop={handleNodeDragStop}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          minZoom={0.3}
          maxZoom={2}
          nodesDraggable
          colorMode={isDark ? 'dark' : 'light'}
        >
          <Background color={isDark ? '#2d3150' : '#c8cfe8'} gap={24} size={1} />
          <Controls />
          <MiniMap
            nodeColor={() => isDark ? '#22263a' : '#e8ecf7'}
            maskColor={isDark ? 'rgba(15,17,23,0.6)' : 'rgba(240,242,250,0.6)'}
          />
        </ReactFlow>
      </div>
    </div>
  );
}
