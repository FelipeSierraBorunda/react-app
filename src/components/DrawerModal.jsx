/* =====================================================================
   DrawerModal.jsx — Contenido completo de un cajón (todos sus componentes)
   ---------------------------------------------------------------------
   Replica el modal del prototipo: lista TODOS los componentes de un
   cajón en una tabla, con acciones Usar / Editar / Eliminar por fila.
   ===================================================================== */

import { useState } from 'react';
import { useInventory } from '../context/InventoryContext.jsx';
import { rgba } from '../lib/constants.js';
import { T } from '../theme.js';
import { Overlay } from './AuthModal.jsx';

export default function DrawerModal({ title, items, onClose, onUse, onDelete, onEdit, onAddHere, loggedIn }) {
  const { tcMap } = useInventory();
  const [useTarget, setUseTarget] = useState(null); // {component} cuando se va a usar
  const [useQty, setUseQty] = useState(1);

  async function confirmUse() {
    await onUse(useTarget.id, useQty);
    setUseTarget(null);
    setUseQty(1);
  }

  return (
    <Overlay onClose={onClose}>
      <div style={{ background: '#fff', borderRadius: 14, width: '100%', maxWidth: 820, maxHeight: '80vh', display: 'flex', flexDirection: 'column' }} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={{ padding: '18px 24px', borderBottom: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: T.ink, margin: 0 }}>{title}</h3>
            <p style={{ fontSize: 12, color: T.muted, marginTop: 3 }}>
              {items.length === 0 ? 'Sin componentes registrados' : `${items.length} componente${items.length !== 1 ? 's' : ''}`}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {loggedIn && onAddHere && (
              <button onClick={onAddHere} style={{ padding: '7px 14px', background: T.primary, color: '#fff', border: 'none', borderRadius: 7, cursor: 'pointer', fontSize: 13, fontWeight: 600, fontFamily: T.font }}>+ Agregar aquí</button>
            )}
            <button onClick={onClose} style={{ width: 32, height: 32, border: `1px solid ${T.border}`, borderRadius: 7, background: '#fff', cursor: 'pointer', color: T.muted, fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
          </div>
        </div>

        {/* Body */}
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {items.length === 0 ? (
            <div style={{ padding: 56, textAlign: 'center', color: T.muted }}>
              <div style={{ fontSize: 40, marginBottom: 16 }}>📦</div>
              <p style={{ fontSize: 14 }}>Cajón vacío</p>
              {loggedIn && onAddHere && (
                <button onClick={onAddHere} style={{ marginTop: 16, padding: '9px 18px', background: T.primary, color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600, fontFamily: T.font }}>+ Agregar componente aquí</button>
              )}
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#F8FAFC', borderBottom: `1px solid ${T.border}` }}>
                  {['CÓDIGO', 'TIPO', 'FABRICANTE', 'DESCRIPCIÓN', 'CANT.', ''].map((h, i) => (
                    <th key={i} style={{ padding: '10px 16px', textAlign: i === 4 ? 'right' : 'left', fontSize: 11, fontWeight: 700, color: '#64748B', letterSpacing: '0.05em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((mi) => (
                  <tr key={mi.id} style={{ borderBottom: '1px solid #F8FAFC' }}>
                    <td style={{ padding: '10px 16px', fontSize: 12, fontFamily: T.mono, color: T.inkSoft }}>{mi.codigoInterno}</td>
                    <td style={{ padding: '10px 16px' }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: tcMap[mi.tipo] || '#64748B', background: rgba(tcMap[mi.tipo] || '#64748B', 0.1), padding: '3px 8px', borderRadius: 9 }}>{mi.tipo}</span>
                    </td>
                    <td style={{ padding: '10px 16px', fontSize: 12, fontFamily: T.mono, color: T.ink }}>{mi.codigoFabricante}</td>
                    <td style={{ padding: '10px 16px', fontSize: 13, color: T.ink, maxWidth: 220 }}>{mi.descripcion}</td>
                    <td style={{ padding: '10px 16px', fontSize: 13, textAlign: 'right', fontWeight: 600, color: T.ink }}>{mi.cantidad}</td>
                    <td style={{ padding: '10px 16px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                      {loggedIn && (
                        <div style={{ display: 'inline-flex', gap: 4 }}>
                          <button onClick={() => { setUseTarget(mi); setUseQty(1); }} style={mini('#EFF6FF', '#1D4ED8', '#BFDBFE')}>Usar</button>
                          <button onClick={() => onEdit(mi)} style={mini('#fff', '#334155', T.border)}>Editar</button>
                          <button onClick={() => onDelete(mi.id)} style={mini('#fff', '#DC2626', '#FEE2E2')}>✕</button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Submodal: usar */}
      {useTarget && (
        <div onClick={() => setUseTarget(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', borderRadius: 14, padding: 26, maxWidth: 420, width: '100%' }}>
            <h3 style={{ fontSize: 17, fontWeight: 700, color: T.ink, marginBottom: 4 }}>Usar componente</h3>
            <p style={{ fontSize: 13, color: T.muted, marginBottom: 18 }}>{useTarget.descripcion || useTarget.codigoFabricante}</p>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#F8FAFC', border: `1px solid ${T.border}`, borderRadius: 8, padding: '12px 14px', marginBottom: 18 }}>
              <span style={{ fontSize: 13, color: T.muted }}>Disponible</span>
              <span style={{ fontSize: 15, fontWeight: 700, color: T.ink }}>{useTarget.cantidad}</span>
            </div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>¿Cuántas unidades vas a usar?</label>
            <input type="number" min="1" max={useTarget.cantidad} value={useQty} onChange={(e) => setUseQty(Math.max(1, parseInt(e.target.value, 10) || 1))} style={{ width: '100%', padding: '10px 12px', border: `1px solid ${T.border}`, borderRadius: 8, fontSize: 14, fontFamily: T.font, color: T.ink, outline: 'none', marginBottom: 20 }} />
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button onClick={() => setUseTarget(null)} style={{ padding: '10px 20px', border: `1px solid ${T.border}`, borderRadius: 8, background: '#fff', cursor: 'pointer', fontSize: 14, color: T.inkSoft, fontFamily: T.font }}>Cancelar</button>
              <button onClick={confirmUse} disabled={useQty > useTarget.cantidad} style={{ padding: '10px 22px', background: T.primary, color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 600, fontFamily: T.font, opacity: useQty > useTarget.cantidad ? 0.5 : 1 }}>Confirmar uso</button>
            </div>
          </div>
        </div>
      )}
    </Overlay>
  );
}

const mini = (bg, color, border) => ({
  padding: '4px 9px', border: `1px solid ${border}`, borderRadius: 5, background: bg,
  cursor: 'pointer', fontSize: 11, color, fontWeight: 600, fontFamily: T.font,
});
