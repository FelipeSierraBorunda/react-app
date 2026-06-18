/* =====================================================================
   Nav.jsx — Barra superior + navegación entre vistas
   ---------------------------------------------------------------------
   Las pestañas "Mi cuenta" y "Panel administrador" solo aparecen según
   sesión / rol (leídos de AuthContext).
   ===================================================================== */

import { useAuth } from '../context/AuthContext.jsx';
import { T } from '../theme.js';

export default function Nav({ view, setView, onAuth }) {
  const { loggedIn, isAdmin, session, logout } = useAuth();

  const tabs = [
    { id: 'visual', label: 'Vista Física' },
    { id: 'table', label: 'Inventario' },
    { id: 'stats', label: 'Estadísticas' },
    { id: 'manage', label: '+ Agregar componente' },
  ];
  if (loggedIn) tabs.push({ id: 'account', label: 'Mi cuenta' });
  if (loggedIn && isAdmin) tabs.push({ id: 'admin', label: 'Panel administrador' });

  return (
    <header style={{ background: '#0F172A', color: '#fff' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{ fontWeight: 700, fontSize: 15, letterSpacing: '-0.01em' }}>Inventario Lab</div>
        <nav style={{ display: 'flex', gap: 4, flex: 1 }}>
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setView(t.id)}
              style={{
                padding: '6px 14px', borderRadius: 6, border: 'none', cursor: 'pointer',
                fontSize: 13, fontWeight: 500, fontFamily: T.font,
                background: view === t.id ? 'rgba(255,255,255,0.14)' : 'transparent',
                color: view === t.id ? '#fff' : 'rgba(255,255,255,0.7)',
              }}
            >
              {t.label}
            </button>
          ))}
        </nav>
        {loggedIn ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.85)' }}>{session.nombre}</span>
            <button onClick={logout} style={ghost}>Salir</button>
          </div>
        ) : (
          <button onClick={onAuth} style={ghost}>Iniciar sesión</button>
        )}
      </div>
    </header>
  );
}

const ghost = {
  padding: '6px 14px', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600,
  fontFamily: T.font, background: 'rgba(255,255,255,0.08)',
  border: '1px solid rgba(255,255,255,0.16)', color: '#fff',
};
