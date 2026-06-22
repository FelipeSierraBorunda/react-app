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
import PrestamosView from './views/PrestamosView.jsx';
import AuditView from './views/AuditView.jsx';

export default function App() {
  const { ready, loggedIn, invAccess, isAdmin } = useAuth();
  const { loading } = useInventory();
  const [view, setView] = useState('menu');
  const [authOpen, setAuthOpen] = useState(false);
  const [editComp, setEditComp] = useState(null); // componente en edición

  // Exige sesión antes de una acción; si no hay, abre el modal de login.
  const requireAuth = (fn) => (loggedIn ? fn() : setAuthOpen(true));

  // Ir a editar un componente concreto
  const goEdit = (comp) => { setEditComp(comp); setView('manage'); };
  // Ir a agregar (sin edición)
  const goAdd = () => { setEditComp(null); setView('manage'); };

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
    juego: <CroquisView go={setView} initialMode="juego" />,
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
    prestamos: invGate(<PrestamosView go={setView} />),
    auditoria: invGate(<AuditView />),
    manage: invGate(<ManageView go={setView} editComp={editComp} clearEdit={() => setEditComp(null)} />),
    account: loggedIn ? <AccountView go={setView} /> : <Center>Debes iniciar sesión</Center>,
    admin: loggedIn ? <AdminPanel /> : <Center>Acceso denegado</Center>,
  };

  return (
    <div style={{ minHeight: '100vh', background: T.bg }}>
      <Nav view={view} setView={(v) => { if (v === 'manage') setEditComp(null); setView(v); }} requireAuth={requireAuth} onAuth={() => setAuthOpen(true)} />
      <main className="resp-main" style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 20px 64px' }}>
        {views[view] || views.visual}
      </main>
      {authOpen && <AuthModal onClose={() => setAuthOpen(false)} />}
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
