/* =====================================================================
   TableView.jsx — Inventario completo (VISTA MIGRADA · ejemplo de datos)
   ---------------------------------------------------------------------
   Demuestra el patrón central de la app:
     useInventory() -> comps  →  filtrar/ordenar con useMemo  →  render
   Incluye filtros, ordenamiento por columna, "usar" y "eliminar".
   Usa esta vista como molde para migrar las demás.
   ===================================================================== */

import { useMemo, useState } from 'react';
import { useInventory } from '../context/InventoryContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useLab } from '../context/LabContext.jsx';
import { CONTAINERS, rgba } from '../lib/constants.js';
import { T, card } from '../theme.js';
import ComponentDetailModal from '../components/ComponentDetailModal.jsx';

export default function TableView({ go, goEdit, requireAuth }) {
  const { comps, use, remove, edit, tipos, tcMap, generalLocOf, esSuelto, changelog, auditoria } = useInventory();
  const { loggedIn } = useAuth();
  const { mesas } = useLab();
  const mesaNombre = (id) => { const m = mesas.find((x) => x.id === id); return m ? m.nombre : null; };
  const [filters, setFilters] = useState({ tipo: '', cont: '', q: '' });
  const [sort, setSort] = useState({ col: 'codigoInterno', dir: 'asc' });
  const [recientes, setRecientes] = useState(false);
  const [detail, setDetail] = useState(null);

  // Código → fecha de alta (último evento 'agregar' en auditoría + changelog).
  const addedAt = useMemo(() => {
    const m = {};
    const consider = (codigo, ts) => {
      if (!codigo) return;
      const v = new Date(ts).getTime();
      if (!m[codigo] || v > m[codigo]) m[codigo] = v;
    };
    (auditoria || []).forEach((a) => { if (a.accion === 'agregar') consider(a.objeto, a.ts); });
    (changelog || []).forEach((c) => { if (c.type === 'agregar') consider(c.codigo, c.ts); });
    return m;
  }, [auditoria, changelog]);

  const rows = useMemo(() => {
    const limite = Date.now() - 7 * 24 * 60 * 60 * 1000;
    let r = comps.filter((c) => {
      if (filters.tipo && c.tipo !== filters.tipo) return false;
      if (filters.cont && c.contenedor !== filters.cont) return false;
      if (recientes && !((addedAt[c.codigoInterno] || 0) >= limite)) return false;
      if (filters.q) {
        const q = filters.q.toLowerCase();
        const hay = [c.codigoInterno, c.codigoFabricante, c.descripcion, c.tipo]
          .some((v) => String(v || '').toLowerCase().includes(q));
        if (!hay) return false;
      }
      return true;
    });
    if (recientes) {
      r = [...r].sort((a, b) => (addedAt[b.codigoInterno] || 0) - (addedAt[a.codigoInterno] || 0));
      return r;
    }
    const { col, dir } = sort;
    r = [...r].sort((a, b) => {
      const av = a[col], bv = b[col];
      const n = typeof av === 'number' && typeof bv === 'number'
        ? av - bv
        : String(av || '').localeCompare(String(bv || ''));
      return dir === 'asc' ? n : -n;
    });
    return r;
  }, [comps, filters, sort, recientes, addedAt]);

  const sortBy = (col) =>
    setSort((s) => ({ col, dir: s.col === col && s.dir === 'asc' ? 'desc' : 'asc' }));
  const caret = (col) => (sort.col === col ? (sort.dir === 'asc' ? ' ↑' : ' ↓') : '');

  const set = (k) => (e) => setFilters((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 16 }}>
        <h1 style={{ fontSize: 20, margin: 0 }}>Inventario</h1>
        <span style={{ fontSize: 13, color: T.muted }}>{rows.length} de {comps.length} componentes</span>
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        <input className="resp-filter-input" placeholder="Buscar…" value={filters.q} onChange={set('q')} style={input} />
        <select className="resp-filter-input" value={filters.tipo} onChange={set('tipo')} style={input}>
          <option value="">Todos los tipos</option>
          {tipos.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <select className="resp-filter-input" value={filters.cont} onChange={set('cont')} style={input}>
          <option value="">Todos los contenedores</option>
          {CONTAINERS.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <button
          onClick={() => setRecientes((v) => !v)}
          style={{ padding: '8px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600, fontFamily: T.font, cursor: 'pointer', border: `1px solid ${recientes ? T.primary : T.border}`, background: recientes ? T.primarySoft : '#fff', color: recientes ? T.primary : '#475569' }}
        >🕒 Recientes</button>
      </div>

      {/* Tabla */}
      <div style={{ ...card, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#F8FAFC', borderBottom: `1px solid ${T.border}` }}>
                {[
                  ['codigoInterno', 'CÓDIGO'], ['tipo', 'TIPO'], ['descripcion', 'DESCRIPCIÓN'],
                  ['cantidad', 'CANT.'], ['contenedor', 'CONTENEDOR'],
                ].map(([col, label]) => (
                  <Th key={col} onClick={() => sortBy(col)}>{label}{caret(col)}</Th>
                ))}
                <Th>MESA/MÓDULO</Th>
                <Th>ACCIONES</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id} style={{ borderBottom: `1px solid #F1F5F9` }}>
                  <Td mono>{c.codigoInterno}</Td>
                  <Td><Chip color={tcMap[c.tipo]}>{c.tipo}</Chip></Td>
                  <Td>{c.descripcion}</Td>
                  <Td>{c.cantidad}</Td>
                  <Td>{esSuelto(c) ? <span style={{ color: T.muted }}>Suelto</span> : c.contenedor}</Td>
                  <Td>{mesaNombre(generalLocOf(c)) || <span style={{ color: '#CBD5E1' }}>—</span>}</Td>
                  <Td>
                    {loggedIn && (
                      <button onClick={() => setDetail(c)} style={miniBtn}>Ver</button>
                    )}
                  </Td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><Td colSpan={7}><div style={{ textAlign: 'center', color: T.muted, padding: 28 }}>Sin resultados</div></Td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {detail && (
        <ComponentDetailModal
          component={detail}
          onClose={() => setDetail(null)}
          onUse={(qty) => use(detail.id, qty)}
          onDelete={() => remove(detail.id)}
          onEdit={() => { const c = detail; setDetail(null); goEdit && goEdit(c); }}
        />
      )}
    </div>
  );
}

const input = { padding: '8px 12px', border: `1px solid ${T.border}`, borderRadius: 8, fontSize: 13, fontFamily: T.font, background: '#fff', color: '#374151' };
const miniBtn = { padding: '4px 10px', borderRadius: 6, border: `1px solid ${T.border}`, background: '#fff', fontSize: 12, fontWeight: 600, color: T.inkSoft, cursor: 'pointer', fontFamily: T.font };

function Th({ children, onClick }) {
  return <th onClick={onClick} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#64748B', letterSpacing: '0.05em', cursor: onClick ? 'pointer' : 'default', userSelect: 'none' }}>{children}</th>;
}
function Td({ children, mono, ...p }) {
  return <td {...p} style={{ padding: '10px 16px', fontFamily: mono ? T.mono : T.font, color: T.ink }}>{children}</td>;
}
function Chip({ color, children }) {
  return <span style={{ padding: '2px 9px', borderRadius: 20, fontSize: 12, fontWeight: 600, color, background: rgba(color || '#64748B', 0.1) }}>{children}</span>;
}
