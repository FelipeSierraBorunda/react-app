/* =====================================================================
   ComponentDetailModal.jsx — Detalles y uso de un componente
   ===================================================================== */

import { useState } from 'react';
import { T, card, btn } from '../theme.js';
import { TC } from '../lib/constants.js';
import { Overlay } from './AuthModal.jsx';

export default function ComponentDetailModal({ component, onClose, onUse, onDelete, onEdit }) {
  const [useQty, setUseQty] = useState(1);
  const [busy, setBusy] = useState(false);

  async function handleUse() {
    setBusy(true);
    try {
      await onUse(useQty);
      onClose();
    } catch (e) {
      alert('Error: ' + e.message);
    }
    setBusy(false);
  }

  async function handleDelete() {
    if (!window.confirm('¿Eliminar este componente?')) return;
    setBusy(true);
    try {
      await onDelete();
      onClose();
    } catch (e) {
      alert('Error: ' + e.message);
    }
    setBusy(false);
  }

  if (!component) return null;

  return (
    <Overlay onClose={onClose}>
      <div style={{ ...card, padding: 28, maxWidth: 480, width: '100%' }} onClick={(e) => e.stopPropagation()}>
        <h2 style={{ margin: '0 0 4px', fontSize: 18 }}>{component.descripcion || component.codigoFabricante}</h2>
        <p style={{ margin: '0 0 20px', fontSize: 13, color: T.muted }}>
          <span style={{ color: TC[component.tipo], fontWeight: 600 }}>{component.tipo}</span> · 
          {' '}<span style={{ fontFamily: T.mono }}>{component.codigoInterno}</span>
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginBottom: 20 }}>
          <Stat label="Código fabricante" value={component.codigoFabricante} />
          <Stat label="Contenedor" value={component.contenedor} />
          <Stat label="Cajón" value={component.cajon} />
          <Stat label="Cantidad" value={component.cantidad} />
          <Stat label="Espacio" value={component.espacioOcupado} />
        </div>

        {component.notas && (
          <div style={{ marginBottom: 20, padding: 12, background: '#F8FAFC', borderRadius: 8, fontSize: 13, color: T.ink }}>
            <strong>Notas:</strong> {component.notas}
          </div>
        )}

        <div style={{ display: 'grid', gap: 12, marginBottom: 12 }}>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: T.inkSoft, marginBottom: 5 }}>Usar unidades</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input type="number" min="1" value={useQty} onChange={(e) => setUseQty(Math.max(1, parseInt(e.target.value, 10) || 1))} style={{ flex: 1, padding: '8px 12px', borderRadius: 8, border: `1px solid ${T.border}`, fontSize: 14, fontFamily: T.font, outline: 'none' }} />
              <button onClick={handleUse} disabled={busy || useQty > component.cantidad} style={{ ...btn('primary'), width: 100 }}>
                {busy ? 'Usando…' : 'Usar'}
              </button>
            </div>
            {useQty > component.cantidad && <p style={{ fontSize: 12, color: T.danger, marginTop: 4 }}>No hay suficientes unidades</p>}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onEdit} style={{ ...btn('ghost'), flex: 1 }}>Editar</button>
          <button onClick={handleDelete} disabled={busy} style={{ ...btn('ghost'), flex: 1, color: T.danger, borderColor: '#FEE2E2' }}>
            {busy ? 'Eliminando…' : 'Eliminar'}
          </button>
          <button onClick={onClose} style={{ ...btn('primary'), flex: 1 }}>Cerrar</button>
        </div>
      </div>
    </Overlay>
  );
}

function Stat({ label, value }) {
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 600, color: T.muted, marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 13, color: T.ink, fontWeight: 600 }}>{value}</div>
    </div>
  );
}
