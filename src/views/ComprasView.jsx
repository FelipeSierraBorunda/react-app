/* =====================================================================
   ComprasView.jsx — Planificador de compras
   ---------------------------------------------------------------------
   Flujo: lista de compras → pedido → recepción (cuántos llegaron) →
   inventario. Cada renglón vive en la tabla "compras" de Supabase
   (compartida). "Pasar a inventario" abre el formulario Agregar
   componente prellenado; al guardar, la compra se archiva.
   Cualquier cuenta con acceso al inventario puede usarlo.
   ===================================================================== */

import { useMemo, useState } from 'react';
import { useInventory } from '../context/InventoryContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { T, card, btn } from '../theme.js';

const fmt = (s) => { if (!s) return '—'; try { return new Date(s).toLocaleDateString('es', { day: '2-digit', month: 'short', year: '2-digit' }); } catch (e) { return s; } };
const money = (n, m) => `${(parseFloat(n) || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${m || 'MXN'}`;

const EMPTY = { descripcion: '', tipo: '', proyecto: '', cantidad_sol: 1, proveedor: '', link: '', datasheet: '', precio_unit: 0, codigoFabricante: '', notas: '' };

export default function ComprasView({ go, goAddDraft }) {
  const { compras, proyectos, tipos, addCompra, removeCompra, marcarPedido, registrarRecepcion, archivarCompra } = useInventory();
  const { loggedIn } = useAuth();
  const [form, setForm] = useState(EMPTY);
  const [formOpen, setFormOpen] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [verHistorico, setVerHistorico] = useState(false);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const proyNombre = (id) => (proyectos.find((p) => p.id === id) || {}).nombre;
  const proyColor = (id) => (proyectos.find((p) => p.id === id) || {}).color || '#64748B';

  const grupos = useMemo(() => {
    const g = { lista: [], camino: [], recibido: [], historico: [] };
    compras.forEach((c) => {
      if (c.estado === 'lista') g.lista.push(c);
      else if (c.estado === 'pedido' || (c.estado === 'parcial' && (c.cantidad_rec || 0) === 0)) g.camino.push(c);
      else if (c.estado === 'parcial' || c.estado === 'recibido') g.recibido.push(c);
      else g.historico.push(c); // archivado | cancelado
    });
    return g;
  }, [compras]);

  const metrics = useMemo(() => {
    const activos = compras.filter((c) => ['lista', 'pedido', 'parcial'].includes(c.estado));
    const gasto = activos.reduce((s, c) => s + (parseFloat(c.precio_unit) || 0) * (parseInt(c.cantidad_sol, 10) || 0), 0);
    return { porPedir: grupos.lista.length, enCamino: grupos.camino.length + grupos.recibido.length, gasto };
  }, [compras, grupos]);

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

  return (
    <div style={{ maxWidth: 960 }}>
      <div style={{ marginBottom: 18 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: T.ink, margin: '0 0 4px', letterSpacing: '-0.01em' }}>Planificador de compras</h1>
        <p style={{ fontSize: 13, color: T.muted, margin: 0 }}>Lista de compras → pedido → recepción → inventario.</p>
      </div>

      {/* Métricas */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 18, flexWrap: 'wrap' }}>
        <Metric label="Por pedir" value={metrics.porPedir} />
        <Metric label="En camino / por recibir" value={metrics.enCamino} />
        <Metric label="Gasto estimado (pendiente)" value={money(metrics.gasto)} />
      </div>

      {/* Alta */}
      {loggedIn && (
        <div style={{ ...card, padding: formOpen ? 20 : 0, marginBottom: 22 }}>
          {!formOpen ? (
            <button onClick={() => setFormOpen(true)} style={{ ...btn('ghost'), width: '100%', padding: '12px', borderStyle: 'dashed' }}>
              + Agregar a la lista de compras
            </button>
          ) : (
            <>
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
                <Field label="Cantidad">
                  <input type="number" min="1" value={form.cantidad_sol} onChange={set('cantidad_sol')} style={input} />
                </Field>
                <Field label="Precio unitario (MXN)">
                  <input type="number" min="0" step="0.01" value={form.precio_unit} onChange={set('precio_unit')} style={input} />
                </Field>
                <Field label="Proveedor / tienda">
                  <input value={form.proveedor} onChange={set('proveedor')} placeholder="Digi-Key, Steren…" style={input} />
                </Field>
                <Field label="Link del producto">
                  <input value={form.link} onChange={set('link')} placeholder="https://…" style={input} />
                </Field>
                <Field label="Datasheet (URL)">
                  <input value={form.datasheet} onChange={set('datasheet')} placeholder="https://…" style={input} />
                </Field>
                <Field label="Notas">
                  <input value={form.notas} onChange={set('notas')} style={input} />
                </Field>
              </div>
              {error && <div style={{ color: T.danger, fontSize: 13, marginTop: 12 }}>{error}</div>}
              <div style={{ display: 'flex', gap: 10, marginTop: 16, justifyContent: 'flex-end' }}>
                <button onClick={() => { setFormOpen(false); setForm(EMPTY); setError(''); }} style={btn('ghost')}>Cancelar</button>
                <button onClick={agregar} disabled={busy} style={btn('primary')}>{busy ? 'Guardando…' : '+ Agregar a la lista'}</button>
              </div>
            </>
          )}
        </div>
      )}

      <Section title={`Por pedir · ${grupos.lista.length}`} color="#B45309">
        {grupos.lista.map((c) => (
          <CompraCard key={c.id} c={c} proyNombre={proyNombre} proyColor={proyColor} loggedIn={loggedIn}
            actions={[
              { label: 'Marcar pedido', primary: true, on: () => marcarPedido(c.id) },
              { label: 'Eliminar', danger: true, on: () => window.confirm('¿Eliminar este renglón?') && removeCompra(c.id) },
            ]} />
        ))}
        {grupos.lista.length === 0 && <Empty>Nada pendiente por pedir.</Empty>}
      </Section>

      <Section title={`En camino · ${grupos.camino.length}`} color="#0891B2">
        {grupos.camino.map((c) => (
          <CompraCard key={c.id} c={c} proyNombre={proyNombre} proyColor={proyColor} loggedIn={loggedIn} recepcion
            onRecepcion={(n) => registrarRecepcion(c.id, n)} />
        ))}
        {grupos.camino.length === 0 && <Empty>No hay pedidos en camino.</Empty>}
      </Section>

      <Section title={`Recibido · ${grupos.recibido.length}`} color="#15803D">
        {grupos.recibido.map((c) => (
          <CompraCard key={c.id} c={c} proyNombre={proyNombre} proyColor={proyColor} loggedIn={loggedIn}
            recepcion={c.estado === 'parcial'} onRecepcion={(n) => registrarRecepcion(c.id, n)}
            actions={[
              { label: '→ Pasar a inventario', primary: true, on: () => pasarAInventario(c) },
              { label: 'Archivar', on: () => archivarCompra(c.id) },
            ]} />
        ))}
        {grupos.recibido.length === 0 && <Empty>Nada recibido pendiente de inventariar.</Empty>}
      </Section>

      <div style={{ marginTop: 10 }}>
        <button onClick={() => setVerHistorico((v) => !v)} style={{ ...btn('ghost'), fontSize: 12 }}>
          {verHistorico ? 'Ocultar' : 'Ver'} histórico ({grupos.historico.length})
        </button>
        {verHistorico && (
          <Section title="Histórico (archivado / cancelado)" color="#64748B">
            {grupos.historico.map((c) => (
              <CompraCard key={c.id} c={c} proyNombre={proyNombre} proyColor={proyColor} loggedIn={loggedIn}
                actions={[{ label: 'Eliminar', danger: true, on: () => window.confirm('¿Eliminar definitivamente?') && removeCompra(c.id) }]} />
            ))}
            {grupos.historico.length === 0 && <Empty>Sin registros archivados.</Empty>}
          </Section>
        )}
      </div>
    </div>
  );
}

function Metric({ label, value }) {
  return (
    <div style={{ ...card, padding: 16, minWidth: 150, flex: 1 }}>
      <div style={{ fontSize: 22, fontWeight: 700, color: T.ink }}>{value}</div>
      <div style={{ fontSize: 12, color: T.muted, marginTop: 2 }}>{label}</div>
    </div>
  );
}

function Section({ title, color, children }) {
  return (
    <div style={{ marginBottom: 22 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 9 }}>{title}</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>{children}</div>
    </div>
  );
}

function Empty({ children }) {
  return <div style={{ gridColumn: '1/-1', fontSize: 12.5, color: T.muted, padding: '8px 2px' }}>{children}</div>;
}

function CompraCard({ c, proyNombre, proyColor, loggedIn, actions = [], recepcion, onRecepcion }) {
  const [n, setN] = useState('');
  const [busy, setBusy] = useState(false);

  async function recibir() {
    const q = parseInt(n, 10);
    if (!q || q < 1) return;
    setBusy(true);
    try { await onRecepcion(q); setN(''); } catch (e) { alert('Error: ' + e.message); }
    setBusy(false);
  }

  return (
    <div style={{ background: '#fff', border: `1px solid ${T.border}`, borderRadius: 12, padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div>
        <div style={{ fontSize: 14, fontWeight: 700, color: T.ink, lineHeight: 1.25 }}>{c.descripcion}</div>
        <div style={{ fontSize: 11.5, color: T.muted, marginTop: 2 }}>
          {c.cantidad_sol} solicitadas{(c.cantidad_rec || 0) > 0 ? ` · ${c.cantidad_rec} recibidas` : ''}
          {c.proveedor ? ` · ${c.proveedor}` : ''}
        </div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, fontSize: 11.5 }}>
        {c.proyecto && proyNombre(c.proyecto) && (
          <span style={{ padding: '2px 9px', borderRadius: 20, fontWeight: 600, color: proyColor(c.proyecto), background: proyColor(c.proyecto) + '1a' }}>{proyNombre(c.proyecto)}</span>
        )}
        {c.tipo && <span style={{ padding: '2px 9px', borderRadius: 20, background: '#F1F5F9', color: '#475569' }}>{c.tipo}</span>}
        {(parseFloat(c.precio_unit) || 0) > 0 && <span style={{ color: T.muted }}>{money(c.precio_unit, c.moneda)} c/u</span>}
      </div>

      {(c.link || c.datasheet) && (
        <div style={{ display: 'flex', gap: 12, fontSize: 12 }}>
          {c.link && <a href={c.link} target="_blank" rel="noopener noreferrer" style={{ color: T.primary }}>🛒 Producto</a>}
          {c.datasheet && <a href={c.datasheet} target="_blank" rel="noopener noreferrer" style={{ color: T.primary }}>📄 Datasheet</a>}
        </div>
      )}

      {c.notas && <div style={{ fontSize: 12, color: T.inkSoft, background: '#F8FAFC', borderRadius: 8, padding: '6px 9px' }}>{c.notas}</div>}

      <div style={{ fontSize: 11, color: T.muted }}>
        {c.solicitado_por ? `Pidió ${c.solicitado_por}` : ''}{c.pedido_en ? ` · pedido ${fmt(c.pedido_en)}` : ''}{c.recibido_en ? ` · recibido ${fmt(c.recibido_en)}` : ''}
      </div>

      {loggedIn && recepcion && (
        <div style={{ display: 'flex', gap: 6, borderTop: `1px solid ${T.border}`, paddingTop: 9 }}>
          <input type="number" min="1" value={n} onChange={(e) => setN(e.target.value)} placeholder="¿Cuántas llegaron?" style={{ ...inp, flex: 1 }} />
          <button onClick={recibir} disabled={busy} style={{ ...btnSm(T.primary, '#fff') }}>{busy ? '…' : 'Registrar'}</button>
        </div>
      )}

      {loggedIn && actions.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {actions.map((a) => (
            <button key={a.label} onClick={a.on}
              style={{ ...btnSm(a.primary ? T.primary : '#fff', a.primary ? '#fff' : (a.danger ? T.danger : '#475569')), border: a.primary ? 'none' : `1px solid ${a.danger ? '#FEE2E2' : T.border}`, flex: a.primary ? 1 : 'unset' }}>
              {a.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const input = { width: '100%', padding: '9px 12px', border: `1px solid ${T.border}`, borderRadius: 8, fontSize: 13, fontFamily: T.font, color: '#0F172A', outline: 'none', background: '#fff', boxSizing: 'border-box' };
const inp = { padding: '7px 10px', borderRadius: 7, border: `1px solid ${T.border}`, fontSize: 12.5, fontFamily: T.font, outline: 'none', boxSizing: 'border-box', background: '#fff', color: T.ink };
const btnSm = (bg, fg) => ({ padding: '8px 12px', borderRadius: 8, cursor: 'pointer', fontSize: 12.5, fontWeight: 700, fontFamily: T.font, background: bg, color: fg });
const lbl = { display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 };
function Field({ label, children }) {
  return <div><label style={lbl}>{label}</label>{children}</div>;
}
