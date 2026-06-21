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

export default function App() {
  const { ready, loggedIn } = useAuth();
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

  const views = {
    menu: <MenuView go={setView} />,
    croquis: <CroquisView go={setView} />,
    granja: (
      <div style={{ maxWidth: 520, margin: '40px auto 0', textAlign: 'center', background: '#fff', border: `1px solid ${T.border}`, borderRadius: 16, padding: 36 }}>
        <div style={{ fontSize: 17, fontWeight: 700, color: T.ink, marginBottom: 8 }}>Granja FPGA</div>
        <p style={{ fontSize: 13.5, color: T.muted, lineHeight: 1.5, margin: '0 0 18px' }}>El acceso a la granja de FPGAs se configurará próximamente. Cuando tengas el enlace, lo conectamos aquí.</p>
        <button onClick={() => setView('menu')} style={{ padding: '9px 18px', borderRadius: 8, border: `1px solid ${T.border}`, background: '#fff', color: T.inkSoft, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>← Volver al menú</button>
      </div>
    ),
    visual: <VisualView go={setView} goEdit={goEdit} requireAuth={requireAuth} />,
    table: <TableView go={setView} goEdit={goEdit} requireAuth={requireAuth} />,
    stats: <StatsView />,
    manage: loggedIn ? <ManageView go={setView} editComp={editComp} clearEdit={() => setEditComp(null)} /> : <Center>Debes iniciar sesión</Center>,
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
