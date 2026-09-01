/* =====================================================================
   CompraDetail.jsx — Panel de detalle de un renglón de compra
   ---------------------------------------------------------------------
   Muestra todos los campos del pedido y las acciones del flujo según su
   estado. Se usa desde la vista de tabla de ComprasView.
   ===================================================================== */

import { useState } from 'react';
import { T, card, btn } from '../theme.js';
import { Overlay } from './AuthModal.jsx';

const fmt = (s) => { if (!s) return '—'; try { return new Date(s).toLocaleString('es', { day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' }); } catch (e) { return s; } };
const money = (n, m) => `${(parseFloat(n) || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${m || 'MXN'}`;

const ESTADO = {
  lista: 'Por pedir', pedido: 'Pedido', parcial: 'Pedido (parcial)',
  recibido: 'Recibido', archivado: 'En inventario', cancelado: 'Cancelado',
};

export default function CompraDetail({ compra: c, proyById, loggedIn, onClose, acciones }) {
  const [rec, setRec] = useState('');
  const [busy, setBusy] = useState(false);
  if (!c) return null;
  const p = c.proyecto ? proyById(c.proyecto) : null;

  const run = (fn) => async () => { setBusy(true); try { await fn(); } catch (e) { alert('Error: ' + e.message); } setBusy(false); };

  async function recibir() {
    const q = parseInt(rec, 10);
    if (!q || q < 1) return;
    setBusy(true);
    try { await acciones.registrarRecepcion(c.id, q); setRec(''); } catch (e) { alert('Error: ' + e.message); }
    setBusy(false);
  }

  return (
    <Overlay onClose={onClose}>
      <div style={{ ...card, padding: 26, maxWidth: 500, width: '100%' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <h2 style={{ margin: '0 0 4px', fontSize: 18 }}>{c.descripcion}</h2>
          <span style={{ flexShrink: 0, fontSize: 11.5, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: '#F1F5F9', color: '#475569' }}>{ESTADO[c.estado] || c.estado}</span>
        </div>
        {c.codigoFabricante && <p style={{ margin: '0 0 16px', fontSize: 12.5, color: T.muted, fontFamily: T.mono }}>{c.codigoFabricante}</p>}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginBottom: 16 }}>
          <Stat label="Solicitadas" value={c.cantidad_sol} />
          <Stat label="Recibidas" value={c.cantidad_rec || 0} />
          <Stat label="Proyecto" value={p ? p.nombre : '—'} />
          <Stat label="Tipo" value={c.tipo || '—'} />
          <Stat label="Proveedor" value={c.proveedor || '—'} />
          <Stat label="Precio unitario" value={(parseFloat(c.precio_unit) || 0) > 0 ? money(c.precio_unit, c.moneda) : '—'} />
          <Stat label="Solicitó" value={c.solicitado_por || '—'} />
          <Stat label="Creado" value={fmt(c.creado)} />
          {c.pedido_en && <Stat label="Pedido" value={fmt(c.pedido_en)} />}
          {c.recibido_en && <Stat label="Última recepción" value={fmt(c.recibido_en)} />}
        </div>

        {(c.link || c.datasheet) && (
          <div style={{ display: 'flex', gap: 14, marginBottom: 14, fontSize: 13 }}>
            {c.link && <a href={c.link} target="_blank" rel="noopener noreferrer" style={{ color: T.primary, fontWeight: 600 }}>🛒 Producto</a>}
            {c.datasheet && <a href={c.datasheet} target="_blank" rel="noopener noreferrer" style={{ color: T.primary, fontWeight: 600 }}>📄 Datasheet</a>}
          </div>
        )}

        {c.notas && (
          <div style={{ marginBottom: 16, padding: 12, background: '#F8FAFC', borderRadius: 8, fontSize: 13, color: T.ink }}>
            <strong>Notas:</strong> {c.notas}
          </div>
        )}

        {loggedIn && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, borderTop: `1px solid ${T.border}`, paddingTop: 14 }}>
            {c.estado === 'lista' && (
              <button onClick={run(() => acciones.marcarPedido(c.id))} disabled={busy} style={btn('primary')}>Marcar como pedido</button>
            )}
            {(c.estado === 'pedido' || c.estado === 'parcial') && (
              <div style={{ display: 'flex', gap: 8 }}>
                <input type="number" min="1" value={rec} onChange={(e) => setRec(e.target.value)} placeholder="¿Cuántas llegaron?" style={{ ...inp, flex: 1 }} />
                <button onClick={recibir} disabled={busy} style={btn('primary')}>Registrar recepción</button>
              </div>
            )}
            {c.estado === 'recibido' && (
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => { acciones.pasarAInventario(c); onClose(); }} style={{ ...btn('primary'), flex: 1 }}>→ Pasar a inventario</button>
                <button onClick={run(() => acciones.archivarCompra(c.id))} disabled={busy} style={btn('ghost')}>Archivar</button>
              </div>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              {c.estado !== 'cancelado' && c.estado !== 'archivado' && (
                <button onClick={run(() => acciones.updateCompra(c.id, { estado: 'cancelado' }))} disabled={busy} style={{ ...btn('ghost'), flex: 1 }}>Cancelar pedido</button>
              )}
              <button onClick={() => { if (window.confirm('¿Eliminar este renglón?')) { acciones.removeCompra(c.id); onClose(); } }} style={{ ...btn('danger'), flex: 1 }}>Eliminar</button>
            </div>
          </div>
        )}

        <button onClick={onClose} style={{ ...btn('ghost'), width: '100%', marginTop: 10 }}>Cerrar</button>
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

const inp = { padding: '9px 12px', borderRadius: 8, border: `1px solid ${T.border}`, fontSize: 13, fontFamily: T.font, outline: 'none', boxSizing: 'border-box', background: '#fff', color: T.ink };
