/* =====================================================================
   ProyectosView.jsx — Qué pertenece a cada proyecto (solo lectura)
   ---------------------------------------------------------------------
   Lo principal: qué componentes (y placas) están asignados a cada
   proyecto y dónde están. El estado de las compras se menciona en una
   línea secundaria. El alta/edición de proyectos vive en el Panel
   administrador → Creaciones.
   ===================================================================== */

import { useMemo, useState } from 'react';
import { useInventory } from '../context/InventoryContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useLab } from '../context/LabContext.jsx';
import { T, card } from '../theme.js';
import { rgba } from '../lib/constants.js';

export default function ProyectosView({ go }) {
  const { proyectos, comps, compras, tcMap, containerById, esSuelto } = useInventory();
  const { isAdmin } = useAuth();
  const { mesas } = useLab();
  const [sel, setSel] = useState('');

  const mesaNombre = (id) => { const m = mesas.find((x) => x.id === id); return m ? m.nombre : null; };
  const ubicacion = (c) => {
    if (esSuelto(c)) return mesaNombre(c.mesa) || 'Suelto';
    const ct = containerById(c.contenedor);
    return `${ct ? ct.name : c.contenedor}${ct?.compartments ? ` · cajón ${c.cajon}` : ''}`;
  };

  const activos = useMemo(() => proyectos.filter((p) => p.estado !== 'archivado'), [proyectos]);
  const lista = sel ? activos.filter((p) => p.id === sel) : activos;

  const dataFor = (pid) => {
    const inv = comps.filter((c) => Array.isArray(c.proyectos) && c.proyectos.includes(pid));
    const cps = compras.filter((c) => c.proyecto === pid);
    return {
      inv,
      unidades: inv.reduce((s, c) => s + (parseInt(c.cantidad, 10) || 0), 0),
      porPedir: cps.filter((c) => c.estado === 'lista').length,
      enProceso: cps.filter((c) => c.estado === 'pedido' || c.estado === 'parcial').length,
      recibido: cps.filter((c) => c.estado === 'recibido').length,
    };
  };

  const sinAsignar = comps.filter((c) => !Array.isArray(c.proyectos) || c.proyectos.length === 0).length;

  return (
    <div style={{ maxWidth: 1000 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: T.ink, margin: '0 0 4px', letterSpacing: '-0.01em' }}>Proyectos</h1>
          <p style={{ fontSize: 13, color: T.muted, margin: 0 }}>Qué componentes y placas pertenecen a cada proyecto y dónde están.</p>
        </div>
        {isAdmin && (
          <button onClick={() => go && go('admin')} style={{ padding: '8px 14px', borderRadius: 8, border: `1px solid ${T.border}`, background: '#fff', color: T.inkSoft, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: T.font }}>
            Gestionar proyectos →
          </button>
        )}
      </div>

      {proyectos.length === 0 ? (
        <div style={{ ...card, padding: 40, textAlign: 'center', color: T.muted }}>
          <div style={{ fontSize: 34, marginBottom: 10 }}>🗂️</div>
          <p style={{ fontSize: 14, margin: 0 }}>Aún no hay proyectos.</p>
          <p style={{ fontSize: 12.5, margin: '6px 0 0' }}>Créalos en <strong>Panel administrador → Creaciones</strong> y asígnalos a los componentes al agregarlos o editarlos.</p>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 18 }}>
            <Chip active={!sel} onClick={() => setSel('')} color="#64748B">Todos</Chip>
            {activos.map((p) => (
              <Chip key={p.id} active={sel === p.id} onClick={() => setSel(p.id)} color={p.color || '#64748B'}>{p.nombre}</Chip>
            ))}
          </div>

          <div style={{ display: 'grid', gap: 16 }}>
            {lista.map((p) => {
              const d = dataFor(p.id);
              return (
                <div key={p.id} style={{ ...card, padding: 20 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ width: 12, height: 12, borderRadius: 4, background: p.color || '#64748B' }} />
                    <h2 style={{ fontSize: 17, fontWeight: 700, color: T.ink, margin: 0 }}>{p.nombre}</h2>
                    <span style={{ fontSize: 12.5, color: T.muted }}>
                      · {d.inv.length} componente{d.inv.length === 1 ? '' : 's'} · {d.unidades} unidades
                    </span>
                  </div>
                  {p.descripcion && <p style={{ fontSize: 12.5, color: T.muted, margin: '6px 0 0' }}>{p.descripcion}</p>}

                  {/* Componentes del proyecto — contenido principal */}
                  {d.inv.length === 0 ? (
                    <p style={{ fontSize: 13, color: '#94A3B8', margin: '14px 0 0' }}>Ningún componente asignado a este proyecto todavía.</p>
                  ) : (
                    <div style={{ marginTop: 14, border: `1px solid ${T.border}`, borderRadius: 10, overflow: 'hidden' }}>
                      <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                          <thead>
                            <tr style={{ background: '#F8FAFC', borderBottom: `1px solid ${T.border}` }}>
                              {['CÓDIGO', 'DESCRIPCIÓN', 'TIPO', 'CANT.', 'UBICACIÓN'].map((h) => (
                                <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 10.5, fontWeight: 700, color: '#64748B', letterSpacing: '0.04em' }}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {d.inv.map((c) => (
                              <tr key={c.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                                <td style={{ ...td, fontFamily: T.mono }}>{c.codigoInterno || '—'}</td>
                                <td style={td}>{c.descripcion || c.codigoFabricante || '—'}</td>
                                <td style={td}>
                                  <span style={{ padding: '1px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600, color: tcMap[c.tipo] || '#64748B', background: rgba(tcMap[c.tipo] || '#64748B', 0.1) }}>{c.tipo || '—'}</span>
                                </td>
                                <td style={td}>{c.cantidad}</td>
                                <td style={{ ...td, color: T.inkSoft }}>{ubicacion(c)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Compras — línea secundaria */}
                  {(d.porPedir + d.enProceso + d.recibido) > 0 && (
                    <div style={{ marginTop: 12, fontSize: 12, color: T.muted, display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                      <span>🛒 Compras:</span>
                      {d.porPedir > 0 && <span>{d.porPedir} por pedir</span>}
                      {d.enProceso > 0 && <span>{d.enProceso} en pedido</span>}
                      {d.recibido > 0 && <span>{d.recibido} recibidas sin inventariar</span>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {sinAsignar > 0 && (
            <p style={{ fontSize: 12, color: T.muted, marginTop: 16 }}>
              {sinAsignar} componente(s) sin proyecto asignado.
            </p>
          )}
        </>
      )}
    </div>
  );
}

function Chip({ active, onClick, color, children }) {
  return (
    <button onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 20, cursor: 'pointer',
      fontFamily: T.font, fontSize: 12.5, fontWeight: 600,
      border: `1px solid ${active ? color : T.border}`, background: active ? rgba(color, 0.12) : '#fff', color: active ? color : '#64748B',
    }}>
      <span style={{ width: 8, height: 8, borderRadius: 3, background: color }} />{children}
    </button>
  );
}

const td = { padding: '8px 12px', color: T.ink };
