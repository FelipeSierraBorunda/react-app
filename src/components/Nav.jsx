/* =====================================================================
   Nav.jsx — Barra superior + navegación entre vistas
   ---------------------------------------------------------------------
   Las pestañas "Mi cuenta" y "Panel administrador" solo aparecen según
   sesión / rol (leídos de AuthContext).
   ===================================================================== */

import { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { T } from '../theme.js';

export default function Nav({ view, setView, onAuth }) {
  const { loggedIn, isAdmin, session, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  // Las pestañas de inventario solo se muestran dentro del módulo de inventario.
  const inventoryViews = ['visual', 'table', 'stats', 'manage'];
  const inInventory = inventoryViews.includes(view);

  const tabs = [];
  if (inInventory) {
    tabs.push(
      { id: 'visual', label: 'Vista Física' },
      { id: 'table', label: 'Inventario' },
      { id: 'stats', label: 'Estadísticas' },
      { id: 'manage', label: '+ Agregar componente' },
    );
  }
  if (loggedIn) tabs.push({ id: 'account', label: 'Mi cuenta' });
  if (loggedIn && isAdmin) tabs.push({ id: 'admin', label: 'Panel administrador' });

  const pick = (id) => { setView(id); setMenuOpen(false); };

  return (
    <header style={{ background: '#0F172A', color: '#fff' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 16 }}>
        <button
          onClick={() => setView('menu')}
          title="Ir al menú principal"
          style={{ display: 'flex', alignItems: 'center', gap: 9, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
        >
          {view !== 'menu' && <span style={{ color: '#94A3B8', fontSize: 17, lineHeight: 1 }}>&#8592;</span>}
          <span style={{ fontWeight: 700, fontSize: 15, letterSpacing: '-0.01em', whiteSpace: 'nowrap', color: '#fff' }}>Lab I&amp;R 4.0</span>
        </button>
        <nav className="resp-desktop-nav" style={{ display: 'flex', gap: 4, flex: 1 }}>
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

        {/* Botón hamburguesa — solo visible en móvil */}
        <button
          className="resp-hamburger"
          onClick={() => setMenuOpen(true)}
          aria-label="Menú"
          style={{
            display: 'none', marginLeft: 'auto', width: 38, height: 38, alignItems: 'center',
            justifyContent: 'center', background: 'rgba(255,255,255,0.08)',
            border: '1px solid rgba(255,255,255,0.16)', borderRadius: 8, cursor: 'pointer', flexShrink: 0,
          }}
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <line x1="2" y1="5" x2="16" y2="5" stroke="#E2E8F0" strokeWidth="1.6" strokeLinecap="round" />
            <line x1="2" y1="9" x2="16" y2="9" stroke="#E2E8F0" strokeWidth="1.6" strokeLinecap="round" />
            <line x1="2" y1="13" x2="16" y2="13" stroke="#E2E8F0" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </button>

        {loggedIn ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.85)' }}>{session.nombre}</span>
            <button onClick={logout} style={ghost}>Salir</button>
          </div>
        ) : (
          <button onClick={onAuth} style={ghost}>Iniciar sesión</button>
        )}
      </div>

      {/* Ventana emergente del menú (móvil) */}
      {menuOpen && (
        <div
          onClick={() => setMenuOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 450, display: 'flex', justifyContent: 'flex-end' }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: '#0F172A', width: '78%', maxWidth: 300, height: '100%', padding: '18px 16px', display: 'flex', flexDirection: 'column', gap: 6, boxShadow: '-8px 0 30px rgba(0,0,0,0.4)' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, padding: '0 4px' }}>
              <span style={{ color: 'rgba(255,255,255,0.55)', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Menú</span>
              <button onClick={() => setMenuOpen(false)} aria-label="Cerrar" style={{ width: 30, height: 30, border: '1px solid rgba(255,255,255,0.16)', borderRadius: 7, background: 'transparent', color: 'rgba(255,255,255,0.7)', cursor: 'pointer', fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
            </div>
            <button
              onClick={() => pick('menu')}
              style={{
                padding: '12px 14px', borderRadius: 9, border: 'none', cursor: 'pointer',
                fontSize: 15, fontWeight: 600, fontFamily: T.font, textAlign: 'left',
                background: view === 'menu' ? 'rgba(255,255,255,0.14)' : 'transparent',
                color: view === 'menu' ? '#fff' : 'rgba(255,255,255,0.7)',
              }}
            >
              ← Menú principal
            </button>
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => pick(t.id)}
                style={{
                  padding: '12px 14px', borderRadius: 9, border: 'none', cursor: 'pointer',
                  fontSize: 15, fontWeight: 600, fontFamily: T.font, textAlign: 'left',
                  background: view === t.id ? 'rgba(255,255,255,0.14)' : 'transparent',
                  color: view === t.id ? '#fff' : 'rgba(255,255,255,0.7)',
                }}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </header>
  );
}

const ghost = {
  padding: '6px 14px', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600,
  fontFamily: T.font, background: 'rgba(255,255,255,0.08)',
  border: '1px solid rgba(255,255,255,0.16)', color: '#fff',
};
