/* =====================================================================
   App.jsx — Layout raíz + router de vistas
   ---------------------------------------------------------------------
   "Router" mínimo basado en estado (no react-router): cambia `view` y
   renderiza la vista. Para escalar a URLs reales, reemplaza el switch
   por <Routes> de react-router-dom — las vistas no cambian.
   ===================================================================== */

import { useState } from 'react';
import { useAuth } from './context/AuthContext.jsx';
import { useInventory } from './context/InventoryContext.jsx';
import { T } from './theme.js';
import Nav from './components/Nav.jsx';
import AuthModal from './components/AuthModal.jsx';
import VisualView from './views/VisualView.jsx';
import TableView from './views/TableView.jsx';
import StatsView from './views/StatsView.jsx';
import ManageView from './views/ManageView.jsx';
import AccountView from './views/AccountView.jsx';
import AdminPanel from './views/AdminPanel.jsx';
import MenuView from './views/MenuView.jsx';
import CroquisView from './views/CroquisView.jsx';
import LabStatsView from './views/LabStatsView.jsx';
import GameView from './views/GameView.jsx';
import AuditView from './views/AuditView.jsx';
import ComprasView from './views/ComprasView.jsx';
import ProyectosView from './views/ProyectosView.jsx';

export default function App() {
  const { ready, loggedIn, invAccess, isAdmin, recovery } = useAuth();
  const { loading } = useInventory();
  const [view, setView] = useState('menu');
  const [authOpen, setAuthOpen] = useState(false);
  const [editComp, setEditComp] = useState(null); // componente en edición
  const [addDraft, setAddDraft] = useState(null); // borrador prellenado (p. ej. desde compras)

  // Exige sesión antes de una acción; si no hay, abre el modal de login.
  const requireAuth = (fn) => (loggedIn ? fn() : setAuthOpen(true));

  // Ir a editar un componente concreto
  const goEdit = (comp) => { setEditComp(comp); setAddDraft(null); setView('manage'); };
  // Ir a agregar (sin edición)
  const goAdd = () => { setEditComp(null); setAddDraft(null); setView('manage'); };
  // Ir a agregar con datos prellenados (desde un pedido recibido en Compras)
  const goAddDraft = (d) => { setEditComp(null); setAddDraft(d); setView('manage'); };

  // El usuario abrió el enlace de "recuperar contraseña": pantalla dedicada.
  if (recovery) {
    return <ResetPasswordScreen />;
  }

  if (!ready || loading) {
    return <Center>Cargando inventario…</Center>;
  }

  // El inventario es privado: requiere sesión + aprobación del admin.
  const invGate = (node) => {
    if (invAccess) return node;
    return <InventoryGate loggedIn={loggedIn} onAuth={() => setAuthOpen(true)} go={setView} />;
  };

  const views = {
    menu: <MenuView go={setView} />,
    croquis: <CroquisView go={setView} />,
    labstats: <LabStatsView go={setView} />,
    juego: loggedIn ? <GameView go={setView} /> : <GameLoginGate onAuth={() => setAuthOpen(true)} go={setView} />,
    granja: (
      <div style={{ maxWidth: 520, margin: '40px auto 0', textAlign: 'center', background: '#fff', border: `1px solid ${T.border}`, borderRadius: 16, padding: 36 }}>
        <div style={{ fontSize: 17, fontWeight: 700, color: T.ink, marginBottom: 8 }}>Granja FPGA</div>
        <p style={{ fontSize: 13.5, color: T.muted, lineHeight: 1.5, margin: '0 0 18px' }}>El acceso a la granja de FPGAs se configurará próximamente. Cuando tengas el enlace, lo conectamos aquí.</p>
        <button onClick={() => setView('menu')} style={{ padding: '9px 18px', borderRadius: 8, border: `1px solid ${T.border}`, background: '#fff', color: T.inkSoft, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>← Volver al menú</button>
      </div>
    ),
    visual: invGate(<VisualView go={setView} goEdit={goEdit} requireAuth={requireAuth} />),
    table: invGate(<TableView go={setView} goEdit={goEdit} requireAuth={requireAuth} />),
    stats: invGate(<StatsView />),
    auditoria: invGate(<AuditView />),
    compras: invGate(<ComprasView go={setView} goAddDraft={goAddDraft} />),
    proyectos: invGate(<ProyectosView go={setView} />),
    manage: invGate(<ManageView go={setView} editComp={editComp} clearEdit={() => setEditComp(null)} draft={addDraft} clearDraft={() => setAddDraft(null)} />),
    account: loggedIn ? <AccountView go={setView} /> : <Center>Debes iniciar sesión</Center>,
    admin: (loggedIn && isAdmin) ? <AdminPanel /> : <Center>Acceso denegado</Center>,
  };

  return (
    <div style={{ minHeight: '100vh', background: T.bg }}>
      <Nav view={view} setView={(v) => { if (v === 'manage') setEditComp(null); if (v !== 'manage') setAddDraft(null); setView(v); }} requireAuth={requireAuth} onAuth={() => setAuthOpen(true)} />
      <main className="resp-main" style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 20px 64px' }}>
        {views[view] || views.visual}
      </main>
      {authOpen && <AuthModal onClose={() => setAuthOpen(false)} />}
    </div>
  );
}

// Pantalla mostrada cuando alguien sin sesión intenta abrir el juego.
function GameLoginGate({ onAuth, go }) {
  return (
    <div style={{ maxWidth: 480, margin: '40px auto 0', textAlign: 'center', background: '#fff', border: `1px solid ${T.border}`, borderRadius: 16, padding: 36 }}>
      <div style={{ width: 52, height: 52, borderRadius: 13, background: '#F5F3FF', color: '#7C3AED', display: 'grid', placeItems: 'center', margin: '0 auto 16px', fontSize: 24 }}>🎮</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: T.ink, marginBottom: 8 }}>El laboratorio: EL JUEGO</div>
      <p style={{ fontSize: 13.5, color: T.muted, lineHeight: 1.55, margin: '0 0 18px' }}>
        Necesitas una cuenta para jugar (tu avatar, monedas y progreso se guardan en tu perfil). Inicia sesión o crea una cuenta para entrar.
      </p>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
        <button onClick={onAuth} style={{ padding: '10px 20px', borderRadius: 8, border: 'none', background: T.primary, color: '#fff', fontWeight: 600, fontSize: 14, cursor: 'pointer', fontFamily: T.font }}>Iniciar sesión</button>
        <button onClick={() => go('menu')} style={{ padding: '10px 20px', borderRadius: 8, border: `1px solid ${T.border}`, background: '#fff', color: T.inkSoft, fontWeight: 600, fontSize: 14, cursor: 'pointer', fontFamily: T.font }}>← Menú</button>
      </div>
    </div>
  );
}

// Pantalla para fijar la nueva contraseña tras abrir el enlace del correo.
function ResetPasswordScreen() {
  const { updatePassword, clearRecovery } = useAuth();
  const [p1, setP1] = useState('');
  const [p2, setP2] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setError('');
    if (p1.length < 6) return setError('La contraseña debe tener al menos 6 caracteres');
    if (p1 !== p2) return setError('Las contraseñas no coinciden');
    setBusy(true);
    const res = await updatePassword(p1);
    setBusy(false);
    if (!res.ok) return setError(res.error);
    setDone(true);
  }

  const box = {
    maxWidth: 400, width: '100%', background: '#fff', border: `1px solid ${T.border}`,
    borderRadius: 16, padding: 32, textAlign: 'center', fontFamily: T.font,
  };
  const input = {
    width: '100%', padding: '10px 12px', borderRadius: 8, border: `1px solid ${T.border}`,
    fontSize: 14, fontFamily: T.font, outline: 'none', marginBottom: 12,
  };
  const primary = {
    width: '100%', padding: '11px 18px', borderRadius: 8, border: 'none', background: T.primary,
    color: '#fff', fontWeight: 600, fontSize: 14, cursor: 'pointer', fontFamily: T.font,
  };

  return (
    <div style={{ display: 'grid', placeItems: 'center', minHeight: '100vh', background: T.bg, padding: 20 }}>
      <div style={box}>
        <div style={{ width: 52, height: 52, borderRadius: 13, background: '#EFF6FF', color: '#2563EB', display: 'grid', placeItems: 'center', margin: '0 auto 16px', fontSize: 24 }}>🔑</div>
        {done ? (
          <>
            <div style={{ fontSize: 18, fontWeight: 700, color: T.ink, marginBottom: 8 }}>Contraseña actualizada</div>
            <p style={{ fontSize: 13.5, color: T.muted, lineHeight: 1.55, margin: '0 0 18px' }}>
              Ya puedes usar tu nueva contraseña.
            </p>
            <button onClick={clearRecovery} style={primary}>Entrar a la app</button>
          </>
        ) : (
          <>
            <div style={{ fontSize: 18, fontWeight: 700, color: T.ink, marginBottom: 8 }}>Nueva contraseña</div>
            <p style={{ fontSize: 13.5, color: T.muted, lineHeight: 1.55, margin: '0 0 18px' }}>
              Escribe la contraseña que usarás de ahora en adelante.
            </p>
            <input style={input} type="password" placeholder="Nueva contraseña" value={p1}
              onChange={(e) => setP1(e.target.value)} />
            <input style={input} type="password" placeholder="Repite la contraseña" value={p2}
              onChange={(e) => setP2(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submit()} />
            {error && <div style={{ color: T.danger, fontSize: 13, marginBottom: 12 }}>{error}</div>}
            <button onClick={submit} disabled={busy} style={primary}>
              {busy ? 'Guardando…' : 'Guardar contraseña'}
            </button>
            <div style={{ marginTop: 12 }}>
              <button onClick={clearRecovery} style={{ background: 'none', border: 'none', color: T.muted, cursor: 'pointer', fontSize: 12.5 }}>
                Cancelar
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Center({ children }) {
  return (
    <div style={{ display: 'grid', placeItems: 'center', minHeight: '100vh', color: T.muted, fontFamily: T.font }}>
      {children}
    </div>
  );
}

// Pantalla mostrada cuando alguien sin permiso intenta abrir el inventario.
function InventoryGate({ loggedIn, onAuth, go }) {
  return (
    <div style={{ maxWidth: 480, margin: '40px auto 0', textAlign: 'center', background: '#fff', border: `1px solid ${T.border}`, borderRadius: 16, padding: 36 }}>
      <div style={{ width: 52, height: 52, borderRadius: 13, background: '#EFF6FF', color: '#2563EB', display: 'grid', placeItems: 'center', margin: '0 auto 16px', fontSize: 24 }}>🔒</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: T.ink, marginBottom: 8 }}>Inventario privado</div>
      {!loggedIn ? (
        <>
          <p style={{ fontSize: 13.5, color: T.muted, lineHeight: 1.55, margin: '0 0 18px' }}>
            El inventario solo está disponible para usuarios autorizados. Inicia sesión y espera la aprobación del administrador.
          </p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
            <button onClick={onAuth} style={{ padding: '10px 20px', borderRadius: 8, border: 'none', background: T.primary, color: '#fff', fontWeight: 600, fontSize: 14, cursor: 'pointer', fontFamily: T.font }}>Iniciar sesión</button>
            <button onClick={() => go('menu')} style={{ padding: '10px 20px', borderRadius: 8, border: `1px solid ${T.border}`, background: '#fff', color: T.inkSoft, fontWeight: 600, fontSize: 14, cursor: 'pointer', fontFamily: T.font }}>← Menú</button>
          </div>
        </>
      ) : (
        <>
          <p style={{ fontSize: 13.5, color: T.muted, lineHeight: 1.55, margin: '0 0 18px' }}>
            Tu cuenta aún no tiene acceso al inventario. Pídele al administrador que te habilite desde el <strong>Panel administrador → Acceso al inventario</strong>.
          </p>
          <button onClick={() => go('menu')} style={{ padding: '10px 20px', borderRadius: 8, border: `1px solid ${T.border}`, background: '#fff', color: T.inkSoft, fontWeight: 600, fontSize: 14, cursor: 'pointer', fontFamily: T.font }}>← Volver al menú</button>
        </>
      )}
    </div>
  );
}
