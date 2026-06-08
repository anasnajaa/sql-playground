/* Tech stack info popover */
import { useEffect, useRef } from 'react';

const STACK = [
  { icon: '⚛',  name: 'React 18',                  role: 'Frontend UI',       color: '#61dafb' },
  { icon: '🟩', name: 'Node.js 18 + Express',       role: 'Backend API',       color: '#68a063' },
  { icon: '🗄',  name: 'Microsoft SQL Server 2025',  role: 'Database',          color: '#e74c3c' },
  { icon: '🐋', name: 'Docker',                     role: 'Container runtime', color: '#2496ed' },
  { icon: '🔀', name: 'nginx',                      role: 'Reverse proxy',     color: '#009639' },
  { icon: '🔒', name: "Let's Encrypt",              role: 'TLS / HTTPS',       color: '#ffd700' },
];

export default function TechStack({ onClose }) {
  const ref = useRef(null);

  // Close on Escape key or click outside
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose(); }
    function onOutside(e) { if (ref.current && !ref.current.contains(e.target)) onClose(); }
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onOutside);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onOutside);
    };
  }, [onClose]);

  return (
    <div className="techstack-backdrop">
      <div className="techstack-panel" ref={ref} role="dialog" aria-label="Tech stack">
        <div className="techstack-header">
          <h2>Tech Stack</h2>
          <button className="techstack-close" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <ul className="techstack-list">
          {STACK.map((item) => (
            <li key={item.name} className="techstack-item">
              <span className="techstack-icon" style={{ color: item.color }}>{item.icon}</span>
              <div className="techstack-info">
                <span className="techstack-name">{item.name}</span>
                <span className="techstack-role">{item.role}</span>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
