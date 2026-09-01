/* =====================================================================
   ComprasView.jsx — Módulo de Compras
   ---------------------------------------------------------------------
   Flujo: por pedir → pedido → en camino → recibido → en inventario.
   Dos vistas del mismo dato: Tablero (kanban) y Tabla (+ panel de
   detalle). Cada renglón vive en la tabla "compras" de Supabase.
   "Pasar a inventario" abre el formulario Agregar componente
   prellenado; al guardar, la compra se archiva (queda "en inventario").
   ===================================================================== */

import { useMemo, useState } from 'react';
import { useInventory } from '../context/InventoryContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { T, card, btn } from '../theme.js';
import CompraDetail from '../components/CompraDetail.jsx';

const fmt = (s) => { if (!s) return '—'; try { return new Date(s).toLocaleDateString('es', { day: '2-digit', month: 'short', year: '2-digit' }); } catch (e) { return s; } };
const money = (n, m) => `${(parseFloat(n) || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${m || 'MXN'}`;

const EMPTY = { descripcion: '', tipo: '', proyecto: '', cantidad_sol: 1, proveedor: '', link: '', datasheet: '', precio_unit: 0, codigoFabricante: '', notas: '' };

// Definición de columnas del tablero (orden = flujo).
const COLS = [
  { id: 'lista', title: 'Por pedir', hint: 'Falta hacer el pedido', color: '#B45309', match: (c) => c.estado === 'lista' },
  { id: 'pedido', title: 'Pedido', hint: 'Esperando que llegue', color: '#7C3AED', match: (c) => c.estado === 'pedido' || c.estado === 'parcial' },
  { id: 'recibido', title: 'Recibido', hint: 'Llegó, falta pasarlo al inventario', color: '#15803D', match: (c) => c.estado === 'recibido' },
  { id: 'inventario', title: 'En inventario', hint: 'Ya forma parte del inventario', color: '#64748B', match: (c) => c.estado === 'archivado' },
];

const ESTADO_CHIP = {
  lista: { fg: '#B45309', bg: '#FFFBEB', label: 'Por pedir' },
  pedido: { fg: '#6D28D9', bg: '#F5F3FF', label: 'Pedido' },
  parcial: { fg: '#6D28D9', bg: '#F5F3FF', label: 'Pedido (parcial)' },
  recibido: { fg: '#15803D', bg: '#F0FDF4', label: 'Recibido' },
  archivado: { fg: '#475569', bg: '#F1F5F9', label: 'En inventario' },
  cancelado: { fg: '#B91C1C', bg: '#FEF2F2', label: 'Cancelado' },
};

export default function ComprasView({ go, goAddDraft }) {
  const { compras, proyectos, tipos, addCompra, updateCompra, removeCompra, marcarPedido, registrarRecepcion, archivarCompra } = useInventory();
  const { loggedIn } = useAuth();
  const [modo, setModo] = useState('tablero'); // tablero | tabla
  const [form, setForm] = useState(EMPTY);
  const [formOpen, setFormOpen] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [detail, setDetail] = useState(null);
  const [tblFiltro, setTblFiltro] = useState({ proyecto: '', proveedor: '', estado: '' });

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const proyById = (id) => proyectos.find((p) => p.id === id) || null;

  const metrics = useMemo(() => {
    const activos = compras.filter((c) => ['lista', 'pedido', 'parcial'].includes(c.estado));
    const gasto = activos.reduce((s, c) => s + (parseFloat(c.precio_unit) || 0) * (parseInt(c.cantidad_sol, 10) || 0), 0);
    return {
      porPedir: compras.filter((c) => c.estado === 'lista').length,
      enCamino: compras.filter((c) => c.estado === 'pedido' || c.estado === 'parcial').length,
      recibido: compras.filter((c) => c.estado === 'recibido').length,
      gasto,
    };
  }, [compras]);

  const proveedores = useMemo(() => [...new Set(compras.map((c) => c.proveedor).filter(Boolean))].sort(), [compras]);

  const filasTabla = useMemo(() => {
    return compras.filter((c) => {
      if (tblFiltro.proyecto && c.proyecto !== tblFiltro.proyecto) return false;
      if (tblFiltro.proveedor && c.proveedor !== tblFiltro.proveedor) return false;
      if (tblFiltro.estado && c.estado !== tblFiltro.estado) return false;
      return true;
    });
  }, [compras, tblFiltro]);

  async function agregar() {
    setError('');
    if (!form.descripcion.trim()) return setError('La descripción es obligatoria.');
    setBusy(true);
    try {
      await addCompra({ ...form, cantidad_sol: parseInt(form.cantidad_sol, 10) || 1, precio_unit: parseFloat(form.precio_unit) || 0 });
      setForm(EMPTY); setFormOpen(false);
    } catch (e) {
      setError('No se pudo guardar. ¿Ejecutaste mejoras5-schema.sql en Supabase? ' + e.message);
    }
    setBusy(false);
  }

  function pasarAInventario(c) {
    goAddDraft && goAddDraft({
      descripcion: c.descripcion,
      tipo: c.tipo || 'Resistencia',
      codigoFabricante: c.codigoFabricante || '',
      cantidad: c.cantidad_rec || c.cantidad_sol || 0,
      datasheet: c.datasheet || '',
      proyectos: c.proyecto ? [c.proyecto] : [],
      __compraId: c.id,
    });
  }

  const acciones = { marcarPedido, registrarRecepcion, archivarCompra, removeCompra, updateCompra, pasarAInventario };

  return (
    <div style={{ maxWidth: 1100 }}>
      <div style={{ marginBottom: 18 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: T.ink, margin: '0 0 4px', letterSpacing: '-0.01em' }}>Compras</h1>
        <p style={{ fontSize: 13, color: T.muted, margin: 0 }}>Lista de compras, pedidos y recepción de material para el inventario.</p>
      </div>

      {/* Métricas */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 18, flexWrap: 'wrap' }}>
        <Metric label="Por pedir" value={metrics.porPedir} color="#B45309" />
        <Metric label="En pedido" value={metrics.enCamino} color="#7C3AED" />
        <Metric label="Recibido sin inventariar" value={metrics.recibido} color="#15803D" />
        <Metric label="Gasto estimado pendiente" value={money(metrics.gasto)} color={T.ink} />
      </div>

      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 4, padding: 4, background: '#fff', border: `1px solid ${T.border}`, borderRadius: 10 }}>
          {[['tablero', 'Tablero'], ['tabla', 'Tabla']].map(([id, lbl]) => (
            <button key={id} onClick={() => setModo(id)} style={{
              padding: '7px 16px', borderRadius: 7, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, fontFamily: T.font,
              background: modo === id ? T.ink : 'transparent', color: modo === id ? '#fff' : T.inkSoft,
            }}>{lbl}</button>
          ))}
        </div>
        {loggedIn && (
          <button onClick={() => setFormOpen((v) => !v)} style={btn('primary')}>
            {formOpen ? 'Cerrar' : '+ Agregar a la lista'}
          </button>
        )}
      </div>

      {/* Alta */}
      {loggedIn && formOpen && (
        <div style={{ ...card, padding: 20, marginBottom: 22 }}>
          <div className="resp-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <Field label="¿Qué se necesita? *">
              <input value={form.descripcion} onChange={set('descripcion')} placeholder="p. ej. Resistencias 10k 0402" style={input} />
            </Field>
            <Field label="Código fabricante (opcional)">
              <input value={form.codigoFabricante} onChange={set('codigoFabricante')} style={{ ...input, fontFamily: T.mono }} />
            </Field>
            <Field label="Tipo">
              <select value={form.tipo} onChange={set('tipo')} style={input}>
                <option value="">— Sin tipo —</option>
                {tipos.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="Proyecto">
              <select value={form.proyecto} onChange={set('proyecto')} style={input}>
                <option value="">— Ninguno —</option>
                {proyectos.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              </select>
            </Field>
            <Field label="Cantidad"><input type="number" min="1" value={form.cantidad_sol} onChange={set('cantidad_sol')} style={input} /></Field>
            <Field label="Precio unitario (MXN)"><input type="number" min="0" step="0.01" value={form.precio_unit} onChange={set('precio_unit')} style={input} /></Field>
            <Field label="Proveedor / tienda"><input value={form.proveedor} onChange={set('proveedor')} placeholder="Digi-Key, Steren…" style={input} /></Field>
            <Field label="Link del producto"><input value={form.link} onChange={set('link')} placeholder="https://…" style={input} /></Field>
            <Field label="Datasheet (URL)"><input value={form.datasheet} onChange={set('datasheet')} placeholder="https://…" style={input} /></Field>
            <Field label="Notas"><input value={form.notas} onChange={set('notas')} style={input} /></Field>
          </div>
          {error && <div style={{ color: T.danger, fontSize: 13, marginTop: 12 }}>{error}</div>}
          <div style={{ display: 'flex', gap: 10, marginTop: 16, justifyContent: 'flex-end' }}>
            <button onClick={() => { setFormOpen(false); setForm(EMPTY); setError(''); }} style={btn('ghost')}>Cancelar</button>
            <button onClick={agregar} disabled={busy} style={btn('primary')}>{busy ? 'Guardando…' : '+ Agregar'}</button>
          </div>
        </div>
      )}

      {compras.length === 0 ? (
        <div style={{ ...card, padding: 44, textAlign: 'center', color: T.muted }}>
          <div style={{ fontSize: 34, marginBottom: 10 }}>🛒</div>
          <p style={{ fontSize: 14, margin: 0 }}>No hay compras registradas.</p>
          <p style={{ fontSize: 12.5, margin: '6px 0 0' }}>Usa <strong>+ Agregar a la lista</strong> para empezar.</p>
        </div>
      ) : modo === 'tablero' ? (
        <Kanban compras={compras} loggedIn={loggedIn} proyById={proyById} onOpen={setDetail} acciones={acciones} />
      ) : (
        <Tabla filas={filasTabla} total={compras.length} filtro={tblFiltro} setFiltro={setTblFiltro}
          proyectos={proyectos} proveedores={proveedores} proyById={proyById} onOpen={setDetail} />
      )}

      {detail && (
        <CompraDetail
          compra={compras.find((c) => c.id === detail.id) || detail}
          proyById={proyById}
          loggedIn={loggedIn}
          onClose={() => setDetail(null)}
          acciones={acciones}
        />
      )}
    </div>
  );
}

/* ---------------- Tablero (kanban) ---------------- */
function Kanban({ compras, loggedIn, proyById, onOpen, acciones }) {
  return (
    <div style={{ overflowX: 'auto', paddingBottom: 8 }}>
      <div style={{ display: 'flex', gap: 14, minWidth: 860, alignItems: 'flex-start' }}>
        {COLS.map((col, i) => {
          const items = compras.filter(col.match);
          return (
            <div key={col.id} style={{ flex: 1, minWidth: 205, background: '#F8FAFC', border: `1px solid ${T.border}`, borderRadius: 12, overflow: 'hidden' }}>
              <div style={{ borderTop: `3px solid ${col.color}`, padding: '10px 12px 8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: T.ink }}>{col.title}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#fff', background: col.color, borderRadius: 20, padding: '1px 7px', minWidth: 18, textAlign: 'center' }}>{items.length}</span>
                  {i < COLS.length - 1 && <span style={{ marginLeft: 'auto', color: '#CBD5E1', fontSize: 14 }}>→</span>}
                </div>
                <div style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>{col.hint}</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '0 10px 12px' }}>
                {items.map((c) => (
                  <KanbanCard key={c.id} c={c} col={col.id} color={col.color} loggedIn={loggedIn} proyById={proyById} onOpen={onOpen} acciones={acciones} />
                ))}
                {items.length === 0 && (
                  <div style={{ fontSize: 11.5, color: '#CBD5E1', textAlign: 'center', border: `1px dashed ${T.border}`, borderRadius: 8, padding: '14px 4px' }}>Vacío</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function KanbanCard({ c, col, color, loggedIn, proyById, onOpen, acciones }) {
  const [rec, setRec] = useState('');
  const p = c.proyecto ? proyById(c.proyecto) : null;
  const sol = parseInt(c.cantidad_sol, 10) || 0;
  const recibidas = parseInt(c.cantidad_rec, 10) || 0;
  const pct = sol ? Math.min(100, Math.round((recibidas / sol) * 100)) : 0;

  async function recibir() {
    const q = parseInt(rec, 10);
    if (!q || q < 1) return;
    try { await acciones.registrarRecepcion(c.id, q); setRec(''); } catch (e) { alert('Error: ' + e.message); }
  }

  return (
    <div style={{ background: '#fff', border: `1px solid ${T.border}`, borderRadius: 10, padding: 11, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <button onClick={() => onOpen(c)} style={{ textAlign: 'left', background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: T.font }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: T.ink, lineHeight: 1.3 }}>{c.descripcion}</div>
        <div style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>
          {col === 'inventario' ? `${recibidas || sol} en total` : `${sol} unidad${sol === 1 ? '' : 'es'}`}
        </div>
      </button>

      {(p || c.proveedor) && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
          {p && <span style={{ fontSize: 10.5, fontWeight: 600, padding: '1px 7px', borderRadius: 20, color: p.color || '#64748B', background: (p.color || '#64748B') + '1a' }}>{p.nombre}</span>}
          {c.proveedor && <span style={{ fontSize: 10.5, padding: '1px 7px', borderRadius: 20, background: '#F1F5F9', color: '#475569' }}>{c.proveedor}</span>}
        </div>
      )}

      {/* Progreso de recepción cuando ya se pidió y llegó algo */}
      {col === 'pedido' && recibidas > 0 && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10.5, color: T.muted, marginBottom: 3 }}>
            <span>Recibido</span><span>{recibidas}/{sol}</span>
          </div>
          <div style={{ height: 5, background: '#EEF2F7', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 3 }} />
          </div>
        </div>
      )}

      {loggedIn && col === 'lista' && (
        <button onClick={() => acciones.marcarPedido(c.id)} style={step(color)}>Marcar como pedido</button>
      )}
      {loggedIn && col === 'pedido' && (
        <div style={{ display: 'flex', gap: 5 }}>
          <input type="number" min="1" value={rec} onChange={(e) => setRec(e.target.value)} placeholder="¿cuántas llegaron?" style={{ ...miniInp, flex: 1 }} />
          <button onClick={recibir} style={{ ...step(color), width: 'auto', padding: '7px 12px' }}>Recibir</button>
        </div>
      )}
      {loggedIn && col === 'recibido' && (
        <>
          <button onClick={() => acciones.pasarAInventario(c)} style={step(color)}>Pasar a inventario →</button>
          <button onClick={() => acciones.archivarCompra(c.id)} style={{ background: 'none', border: 'none', color: T.muted, fontSize: 11, cursor: 'pointer', fontFamily: T.font, padding: 0, textAlign: 'left' }}>o solo archivar</button>
        </>
      )}
      {loggedIn && col === 'inventario' && (
        <button onClick={() => window.confirm('¿Eliminar este registro?') && acciones.removeCompra(c.id)} style={{ background: 'none', border: 'none', color: T.muted, fontSize: 11, cursor: 'pointer', fontFamily: T.font, padding: 0, textAlign: 'left' }}>Eliminar registro</button>
      )}
    </div>
  );
}

/* ---------------- Tabla ---------------- */
function Tabla({ filas, total, filtro, setFiltro, proyectos, proveedores, proyById, onOpen }) {
  const set = (k) => (e) => setFiltro((f) => ({ ...f, [k]: e.target.value }));
  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <select value={filtro.proyecto} onChange={set('proyecto')} style={input}>
          <option value="">Todos los proyectos</option>
          {proyectos.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
        </select>
        <select value={filtro.proveedor} onChange={set('proveedor')} style={input}>
          <option value="">Todos los proveedores</option>
          {proveedores.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <select value={filtro.estado} onChange={set('estado')} style={input}>
          <option value="">Todos los estados</option>
          {Object.entries(ESTADO_CHIP).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <span style={{ fontSize: 12.5, color: T.muted, alignSelf: 'center' }}>{filas.length} de {total}</span>
      </div>

      <div style={{ ...card, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#F8FAFC', borderBottom: `1px solid ${T.border}` }}>
                {['DESCRIPCIÓN', 'PROYECTO', 'PROVEEDOR', 'REC / SOL', 'PRECIO', 'ESTADO', 'FECHA'].map((h) => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#64748B', letterSpacing: '0.05em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filas.map((c) => {
                const p = c.proyecto ? proyById(c.proyecto) : null;
                const est = ESTADO_CHIP[c.estado] || ESTADO_CHIP.lista;
                return (
                  <tr key={c.id} onClick={() => onOpen(c)} style={{ borderBottom: '1px solid #F1F5F9', cursor: 'pointer' }}>
                    <td style={td}>{c.descripcion}</td>
                    <td style={td}>{p ? <span style={{ fontSize: 11.5, fontWeight: 600, padding: '1px 8px', borderRadius: 20, color: p.color || '#64748B', background: (p.color || '#64748B') + '1a' }}>{p.nombre}</span> : <span style={{ color: '#CBD5E1' }}>—</span>}</td>
                    <td style={td}>{c.proveedor || <span style={{ color: '#CBD5E1' }}>—</span>}</td>
                    <td style={td}>{c.cantidad_rec || 0} / {c.cantidad_sol}</td>
                    <td style={td}>{(parseFloat(c.precio_unit) || 0) > 0 ? money(c.precio_unit, c.moneda) : '—'}</td>
                    <td style={td}><span style={{ fontSize: 11.5, fontWeight: 700, padding: '2px 9px', borderRadius: 20, color: est.fg, background: est.bg }}>{est.label}</span></td>
                    <td style={td}>{fmt(c.creado)}</td>
                  </tr>
                );
              })}
              {filas.length === 0 && <tr><td colSpan={7} style={{ textAlign: 'center', color: T.muted, padding: 28 }}>Sin resultados</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value, color }) {
  return (
    <div style={{ ...card, padding: 16, minWidth: 150, flex: 1 }}>
      <div style={{ fontSize: 22, fontWeight: 700, color: color || T.ink }}>{value}</div>
      <div style={{ fontSize: 12, color: T.muted, marginTop: 2 }}>{label}</div>
    </div>
  );
}

const input = { padding: '9px 12px', border: `1px solid ${T.border}`, borderRadius: 8, fontSize: 13, fontFamily: T.font, color: '#0F172A', outline: 'none', background: '#fff', boxSizing: 'border-box', width: '100%' };
const td = { padding: '10px 14px', color: T.ink };
const step = (bg) => ({ padding: '7px 10px', borderRadius: 7, cursor: 'pointer', fontSize: 12, fontWeight: 700, fontFamily: T.font, background: bg, color: '#fff', border: 'none', width: '100%' });
const miniInp = { padding: '6px 8px', borderRadius: 7, border: `1px solid ${T.border}`, fontSize: 11.5, fontFamily: T.font, outline: 'none', boxSizing: 'border-box', background: '#fff', color: T.ink, minWidth: 0 };
const lbl = { display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 };
function Field({ label, children }) {
  return <div><label style={lbl}>{label}</label>{children}</div>;
}
