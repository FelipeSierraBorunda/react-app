/* =====================================================================
   StatsView.jsx — Estadísticas  [MIGRADA · fiel al HTML]
   ===================================================================== */

import { useMemo } from 'react';
import { useInventory } from '../context/InventoryContext.jsx';
import { CONTAINERS, TIPOS, TC, rgba, fmtDate } from '../lib/constants.js';
import { T } from '../theme.js';

export default function StatsView() {
  const { comps, customBoxes, usage } = useInventory();
  const allBoxes = useMemo(() => [...CONTAINERS, ...customBoxes], [customBoxes]);

  const totalQty = useMemo(() => comps.reduce((s, c) => s + (parseInt(c.cantidad, 10) || 0), 0), [comps]);
  const occupied = useMemo(() => new Set(comps.map((c) => `${c.contenedor}-${c.cajon}`)).size, [comps]);
  const totalDrawers = useMemo(() => allBoxes.reduce((s, c) => s + (c.compartments || 0), 0), [allBoxes]);

  // Por tipo: count (tipos distintos) + qty (unidades)
  const typeBars = useMemo(() => {
    const byTipo = {};
    TIPOS.forEach((t) => { byTipo[t] = { count: 0, qty: 0 }; });
    comps.forEach((c) => {
      const t = c.tipo || 'Otro';
      if (!byTipo[t]) byTipo[t] = { count: 0, qty: 0 };
      byTipo[t].count++;
      byTipo[t].qty += parseInt(c.cantidad, 10) || 0;
    });
    const bars = Object.entries(byTipo)
      .filter(([, v]) => v.count > 0)
      .sort((a, b) => b[1].count - a[1].count)
      .map(([t, d]) => ({ t, count: d.count, qty: d.qty, col: TC[t] || '#64748B' }));
    const mx = bars.length ? bars[0].count : 1;
    bars.forEach((b) => { b.pct = Math.round((b.count / mx) * 100); });
    return bars;
  }, [comps]);

  // Por contenedor
  const ctCards = useMemo(() => allBoxes.map((c) => {
    const cs = comps.filter((x) => x.contenedor === c.id);
    return { ...c, count: cs.length, qty: cs.reduce((s, x) => s + (parseInt(x.cantidad, 10) || 0), 0) };
  }), [allBoxes, comps]);

  // Consumo del laboratorio (todas las cuentas, transacciones 'usar')
  const consumedAll = useMemo(() => usage.filter((u) => u.type === 'usar'), [usage]);
  const consumedTotal = consumedAll.reduce((s, u) => s + (parseInt(u.cantidad, 10) || 0), 0);
  const consumedByType = useMemo(() => {
    const m = {};
    consumedAll.forEach((u) => { const t = u.tipo || 'Otro'; m[t] = (m[t] || 0) + (parseInt(u.cantidad, 10) || 0); });
    const arr = Object.entries(m).sort((a, b) => b[1] - a[1]).map(([t, q]) => ({ t, q, col: TC[t] || '#64748B' }));
    const mx = arr.length ? arr[0].q : 1;
    arr.forEach((b) => { b.pct = Math.round((b.q / mx) * 100); });
    return arr;
  }, [consumedAll]);
  const consumedByUser = useMemo(() => {
    const m = {};
    consumedAll.forEach((u) => { const n = u.usuario || u.email || '—'; m[n] = (m[n] || 0) + (parseInt(u.cantidad, 10) || 0); });
    const arr = Object.entries(m).sort((a, b) => b[1] - a[1]).map(([n, q]) => ({ n, q, initial: (n || '?').charAt(0).toUpperCase() }));
    const mx = arr.length ? arr[0].q : 1;
    arr.forEach((b) => { b.pct = Math.round((b.q / mx) * 100); });
    return arr;
  }, [consumedAll]);

  return (
    <div>
      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
        <Kpi label="Tipos de componentes" value={comps.length} />
        <Kpi label="Total de componentes" value={totalQty} />
        <Kpi label="Cajones Ocupados" value={occupied} sub={`de ${totalDrawers} compartimentos`} />
      </div>

      {/* 2 columnas: Por tipo / Por contenedor */}
      <div className="resp-2col" style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: 20, alignItems: 'start' }}>
        {/* Por tipo */}
        <div style={{ background: '#fff', borderRadius: 12, border: `1px solid ${T.border}`, padding: 24 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: '#0F172A', marginBottom: 20 }}>Por Tipo de Componente</h3>
          {typeBars.map((bar) => (
            <div key={bar.t} style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                <span style={{ fontSize: 13, fontWeight: 500, color: '#0F172A' }}>{bar.t}</span>
                <div style={{ display: 'flex', gap: 14 }}>
                  <span style={{ fontSize: 12, color: '#64748B' }}>{bar.count} tipos</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#374151', minWidth: 70, textAlign: 'right' }}>{bar.qty} unidades</span>
                </div>
              </div>
              <div style={{ height: 6, background: '#F1F5F9', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${bar.pct}%`, background: bar.col, borderRadius: 3 }} />
              </div>
            </div>
          ))}
          {typeBars.length === 0 && <p style={{ fontSize: 13, color: '#94A3B8' }}>Sin datos todavía</p>}
        </div>

        {/* Por contenedor */}
        <div style={{ background: '#fff', borderRadius: 12, border: `1px solid ${T.border}`, padding: 24 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: '#0F172A', marginBottom: 20 }}>Por Contenedor</h3>
          {ctCards.map((c) => (
            <div key={c.id} style={{ padding: '10px 0', borderBottom: '1px solid #F8FAFC', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#0F172A' }}>{c.name}</span>
              <div style={{ display: 'flex', gap: 16, textAlign: 'right' }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#0F172A' }}>{c.count}</div>
                  <div style={{ fontSize: 10, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>tipos</div>
                </div>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#0F172A' }}>{c.qty}</div>
                  <div style={{ fontSize: 10, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>unidades</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Consumo del laboratorio */}
      <div style={{ background: '#fff', borderRadius: 12, border: `1px solid ${T.border}`, overflow: 'hidden', marginTop: 20 }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #F1F5F9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <div>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: '#0F172A', margin: 0 }}>Consumo del laboratorio</h3>
            <p style={{ fontSize: 12, color: '#94A3B8', marginTop: 2 }}>Qué tipos de componentes se han consumido, cuánto y por quién</p>
          </div>
          <div style={{ display: 'flex', gap: 20 }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#0F172A' }}>{consumedTotal}</div>
              <div style={{ fontSize: 10, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>unidades consumidas</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#0F172A' }}>{consumedByType.length}</div>
              <div style={{ fontSize: 10, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>tipos distintos</div>
            </div>
          </div>
        </div>
        {consumedAll.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: '#94A3B8', fontSize: 14 }}>Todavía no se ha consumido ningún componente en el laboratorio.</div>
        ) : (
          <div className="resp-2col" style={{ padding: 20, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 28 }}>
            {/* Por tipo */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 14 }}>Por tipo de componente</div>
              {consumedByType.map((b) => (
                <div key={b.t} style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 13, color: '#0F172A' }}>{b.t}</span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>{b.q} uds</span>
                  </div>
                  <div style={{ height: 6, background: '#F1F5F9', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${b.pct}%`, background: b.col, borderRadius: 3 }} />
                  </div>
                </div>
              ))}
            </div>
            {/* Por usuario */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 14 }}>Consumido por</div>
              {consumedByUser.map((u) => (
                <div key={u.n} style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, color: '#0F172A' }}>
                      <span style={{ width: 20, height: 20, borderRadius: '50%', background: '#0F172A', color: '#fff', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{u.initial}</span>
                      {u.n}
                    </span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>{u.q} uds</span>
                  </div>
                  <div style={{ height: 6, background: '#F1F5F9', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${u.pct}%`, background: T.primary, borderRadius: 3 }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Kpi({ label, value, sub }) {
  return (
    <div style={{ background: '#fff', borderRadius: 12, border: `1px solid ${T.border}`, padding: 20 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 36, fontWeight: 700, color: '#0F172A', letterSpacing: '-1px' }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 4 }}>{sub}</div>}
    </div>
  );
}
