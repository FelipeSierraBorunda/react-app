/* =====================================================================
   AdminPanel.jsx — Panel de administrador  [MIGRADA COMPLETA]
   ===================================================================== */

import { useMemo } from 'react';
import { useInventory } from '../context/InventoryContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { TYPELBL, TYPECLR, rgba, fmtDate } from '../lib/constants.js';
import { T, card } from '../theme.js';

export default function AdminPanel() {
  const { changelog } = useInventory();
  const { accounts, setInvAccess, session } = useAuth();

  const rows = useMemo(() => changelog.slice(0, 100), [changelog]);
  const cuentas = useMemo(() => Object.values(accounts || {}).sort((a, b) => (a.nombre || '').localeCompare(b.nombre || '')), [accounts]);

  return (
    <div>
      <h1 style={{ fontSize: 20, margin: '0 0 16px' }}>Panel administrador</h1>

      {/* Acceso al inventario */}
      <div style={{ ...card, overflow: 'hidden', marginBottom: 24 }}>
        <div style={{ padding: '16px 20px', borderBottom: `1px solid ${T.border}` }}>
          <h3 style={{ margin: 0, fontSize: 14 }}>Acceso al inventario</h3>
          <p style={{ margin: '2px 0 0', fontSize: 12, color: T.muted }}>El inventario es privado. Habilita qué correos pueden verlo y editarlo (el croquis y la granja quedan abiertos a invitados).</p>
        </div>
        {cuentas.length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center', color: T.muted, fontSize: 13 }}>Aún no hay cuentas registradas.</div>
        ) : (
          <div>
            {cuentas.map((u) => {
              const on = !!u.inv_access;
              return (
                <div key={u.email} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 20px', borderBottom: `1px solid ${T.border}` }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: T.ink }}>{u.nombre}{session && u.email === session.email ? ' · tú' : ''}</div>
                    <div style={{ fontSize: 12, color: T.muted, fontFamily: T.mono }}>{u.email}</div>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: on ? '#15803D' : '#B45309', background: on ? '#F0FDF4' : '#FFFBEB', padding: '3px 9px', borderRadius: 20 }}>
                    {on ? 'Con acceso' : 'Sin acceso'}
                  </span>
                  <button onClick={() => setInvAccess(u.email, !on)} style={{
                    padding: '7px 14px', borderRadius: 8, border: `1px solid ${on ? '#FECACA' : T.primary}`,
                    background: on ? '#fff' : T.primary, color: on ? '#DC2626' : '#fff',
                    fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: T.font, whiteSpace: 'nowrap',
                  }}>{on ? 'Revocar' : 'Dar acceso'}</button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Resumen */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 24 }}>
        <Stat label="Cambios registrados" value={changelog.length} />
        <Stat label="Últimos 7 días" value={changelog.filter((c) => {
          const d = new Date(c.ts);
          const now = new Date();
          return (now - d) / (1000 * 60 * 60 * 24) < 7;
        }).length} />
      </div>

      {/* Registro global */}
      <div style={{ ...card, overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: `1px solid ${T.border}` }}>
          <h3 style={{ margin: 0, fontSize: 14 }}>Registro global de cambios</h3>
          <p style={{ margin: '2px 0 0', fontSize: 12, color: T.muted }}>Todas las altas, ediciones y bajas del inventario</p>
        </div>
        {rows.length === 0 ? (
          <div style={{ padding: 28, textAlign: 'center', color: T.muted, fontSize: 13 }}>Sin cambios registrados</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <tbody>
                {rows.map((c, i) => (
                  <tr key={i} style={{ borderBottom: `1px solid ${T.border}` }}>
                    <td style={{ padding: '10px 20px' }}>
                      <span style={{ fontWeight: 600, color: TYPECLR[c.type], background: rgba(TYPECLR[c.type] || '#64748B', 0.1), padding: '2px 9px', borderRadius: 20, fontSize: 11, whiteSpace: 'nowrap' }}>
                        {TYPELBL[c.type] || c.type}
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px', fontWeight: 600, fontSize: 12 }}>{c.usuario || 'Sistema'}</td>
                    <td style={{ padding: '10px 12px', fontFamily: T.mono, color: T.inkSoft, fontSize: 12, whiteSpace: 'nowrap' }}>{c.codigo}</td>
                    <td style={{ padding: '10px 12px', fontSize: 12 }}>{c.descripcion}</td>
                    <td style={{ padding: '10px 12px', fontSize: 12, color: T.inkSoft }}>
                      {c.tipo && <span style={{ color: '#7C3AED', fontWeight: 600 }}>{c.tipo}</span>}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontSize: 12, color: T.muted, whiteSpace: 'nowrap' }}>×{c.cantidad || 1}</td>
                    <td style={{ padding: '10px 20px', textAlign: 'right', fontSize: 12, color: T.muted, whiteSpace: 'nowrap' }}>{fmtDate(c.ts)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div style={{ ...card, padding: 18 }}>
      <div style={{ fontSize: 28, fontWeight: 700, color: T.ink }}>{value}</div>
      <div style={{ fontSize: 12, color: T.muted, marginTop: 2 }}>{label}</div>
    </div>
  );
}
