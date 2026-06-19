/* =====================================================================
   VisualView.jsx — Vista física de contenedores  [MIGRADA · fiel al HTML]
   ===================================================================== */

import { useMemo, useState } from 'react';
import { useInventory } from '../context/InventoryContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { CONTAINERS, TC, rgba } from '../lib/constants.js';
import { T, card } from '../theme.js';
import NewBoxModal from '../components/NewBoxModal.jsx';
import DrawerModal from '../components/DrawerModal.jsx';

export default function VisualView({ go, goEdit }) {
  const { comps, customBoxes, addCustomBox, use, remove } = useInventory();
  const { loggedIn } = useAuth();
  const [active, setActive] = useState(CONTAINERS[0].id);
  const [newBoxOpen, setNewBoxOpen] = useState(false);
  const [drawer, setDrawer] = useState(null); // {cid, n} o {cid, all:true}

  const allBoxes = useMemo(() => [...CONTAINERS, ...customBoxes], [customBoxes]);
  const ct = allBoxes.find((c) => c.id === active);
  const isG = ct?.type === 'gabinete';
  const isC12 = ct?.type === 'caja12';
  const isCL = ct?.type === 'caja_libre';

  const ctComps = useMemo(() => comps.filter((c) => c.contenedor === active), [comps, active]);

  // Celdas — réplica exacta de cells() del prototipo
  const cells = useMemo(() => {
    if (!ct?.compartments) return [];
    return Array.from({ length: ct.compartments }, (_, i) => {
      const n = i + 1;
      const its = ctComps.filter((c) => parseInt(c.cajon, 10) === n);
      const col = its.length ? (TC[its[0].tipo] || '#64748B') : null;

      // fillColor según espacio ocupado (no por tipo)
      let fillColor = '#E2E8F0';
      if (its.length) {
        if (its.some((c) => c.espacioOcupado === 'Alto')) fillColor = '#EF4444';
        else if (its.some((c) => c.espacioOcupado === 'Medio')) fillColor = '#F59E0B';
        else fillColor = '#22C55E';
      }

      return {
        num: n,
        hasItems: its.length > 0,
        itemCount: its.length,
        title: `Cajón ${n} · ${its.length ? its.length + ' comp.' : 'vacío'}`,
        bg: col ? rgba(col, 0.15) : 'transparent',
        borderColor: col ? rgba(col, 0.5) : '#E2E8F0',
        drawerBg: col ? rgba(col, 0.38) : '#3A3A3A',
        drawerBorder: col ? rgba(col, 0.65) : '#4D4D4D',
        labelColor: its.length > 0 ? '#CCC' : '#555',
        fillColor,
      };
    });
  }, [ct, ctComps]);

  const stats = useMemo(() => {
    const totalDrawers = ct?.compartments || 0;
    const occupied = new Set(ctComps.map((c) => parseInt(c.cajon, 10))).size;
    const units = ctComps.reduce((s, c) => s + (parseInt(c.cantidad, 10) || 0), 0);
    const pct = totalDrawers ? Math.round((occupied / totalDrawers) * 100) : 0;
    return { totalDrawers, occupied, units, pct };
  }, [ct, ctComps]);

  const legendTypes = useMemo(() => {
    const present = {};
    ctComps.forEach((c) => { present[c.tipo] = TC[c.tipo] || '#64748B'; });
    return Object.entries(present).map(([t, col]) => ({ t, col }));
  }, [ctComps]);

  const drawerItems = useMemo(() => {
    if (!drawer) return [];
    if (drawer.all) return comps.filter((c) => c.contenedor === drawer.cid);
    return comps.filter((c) => c.contenedor === drawer.cid && parseInt(c.cajon, 10) === drawer.n);
  }, [drawer, comps]);

  const drawerTitle = drawer
    ? (drawer.all ? `${ct?.name} — Todo el contenido` : `${ct?.name} · Cajón ${drawer.n}`)
    : '';

  return (
    <div>
      {/* Tabs de contenedores — cada uno con SU PROPIO conteo */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap', alignItems: 'stretch' }}>
        {allBoxes.map((c) => {
          const cnt = comps.filter((x) => x.contenedor === c.id).length;
          const isActive = c.id === active;
          return (
            <button key={c.id} onClick={() => setActive(c.id)}
              style={{ padding: '8px 16px', borderRadius: 8, border: `1px solid ${isActive ? T.primary : T.border}`, background: isActive ? T.primarySoft : '#fff', color: isActive ? T.primary : '#475569', fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: T.font, display: 'flex', alignItems: 'center', gap: 7 }}>
              {c.name}
              <span style={{ fontSize: 11, fontWeight: 700, padding: '1px 7px', borderRadius: 10, background: isActive ? T.primary : '#F1F5F9', color: isActive ? '#fff' : '#94A3B8' }}>{cnt}</span>
            </button>
          );
        })}
        {loggedIn && <button onClick={() => setNewBoxOpen(true)} style={{ padding: '8px 16px', borderRadius: 8, border: '1px dashed #94A3B8', background: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#475569', fontFamily: T.font }}>+ Nueva caja</button>}
      </div>

      {/* Contenedor */}
      <div style={{ ...card, padding: 24 }}>
        <h2 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 700 }}>{ct.name}</h2>
        <p style={{ margin: '0 0 20px', fontSize: 13, color: '#64748B' }}>
          {(isG || isC12) ? 'Haz clic en un cajón para ver su contenido · los cajones coloreados tienen componentes' : 'Esta caja no tiene compartimentos · consulta su contenido abajo'}
        </p>

        {/* GABINETE 8×8 */}
        {isG && (
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <div style={{ background: 'linear-gradient(160deg,#2D2D2D,#1C1C1C)', borderRadius: 12, padding: 14, boxShadow: '0 8px 28px rgba(0,0,0,0.35),inset 0 1px 0 rgba(255,255,255,0.06)', width: 440, maxWidth: '100%' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, padding: '0 2px' }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#666', letterSpacing: '0.1em', textTransform: 'uppercase' }}>{ct.name}</span>
                <span style={{ fontSize: 10, color: '#555', fontFamily: T.mono }}>{stats.totalDrawers} cajones · 8×8</span>
              </div>
              <div style={{ background: '#161616', borderRadius: 6, padding: 8, border: '1px solid #333' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 4 }}>
                  {cells.map((cell) => (
                    <div key={cell.num} onClick={() => setDrawer({ cid: active, n: cell.num })} title={cell.title}
                      style={{ aspectRatio: '1', cursor: 'pointer', borderRadius: 3, background: cell.drawerBg, border: `1px solid ${cell.drawerBorder}`, position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1, transition: 'all 0.15s' }}
                      onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#60A5FA'; e.currentTarget.style.filter = 'brightness(1.4)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.borderColor = cell.drawerBorder; e.currentTarget.style.filter = 'brightness(1)'; }}>
                      {cell.hasItems && <span style={{ fontSize: 9, fontWeight: 700, color: '#E5E7EB', lineHeight: 1, pointerEvents: 'none', zIndex: 1 }}>{cell.itemCount}</span>}
                      <span style={{ fontSize: 6, color: cell.labelColor, lineHeight: 1, pointerEvents: 'none' }}>{cell.num}</span>
                      {cell.hasItems && <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 2, background: cell.fillColor, pointerEvents: 'none' }} />}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* CAJA 12 — imagen + grilla */}
        {isC12 && (
          <div className="resp-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 28, alignItems: 'start' }}>
            {ct.image && <img src={ct.image} alt={ct.name} style={{ width: '100%', aspectRatio: '1/1.05', borderRadius: 8, border: `1px solid ${T.border}`, objectFit: 'cover', background: '#F8FAFC' }} />}
            <div>
              <p style={{ fontSize: 13, color: '#64748B', marginBottom: 16 }}>Haz clic en un compartimento para ver su contenido:</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 8 }}>
                {cells.map((cell) => (
                  <div key={cell.num} onClick={() => setDrawer({ cid: active, n: cell.num })} title={cell.title}
                    style={{ aspectRatio: '1', cursor: 'pointer', borderRadius: 8, background: cell.bg, border: `2px solid ${cell.borderColor}`, position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3, minHeight: 52, transition: 'all 0.15s' }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = T.primary; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = cell.borderColor; }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#475569', pointerEvents: 'none' }}>{cell.num}</span>
                    {cell.hasItems && <span style={{ fontSize: 9, color: T.primary, background: '#DBEAFE', borderRadius: 3, padding: '0 4px', pointerEvents: 'none', lineHeight: 1.5 }}>{cell.itemCount}</span>}
                    {cell.hasItems && <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 3, background: cell.fillColor, pointerEvents: 'none' }} />}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* CAJA LIBRE — imagen + texto */}
        {isCL && (
          <div className="resp-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 32, alignItems: 'start' }}>
            {ct.image && <img src={ct.image} alt={ct.name} style={{ width: '100%', aspectRatio: '1/0.92', borderRadius: 8, border: `1px solid ${T.border}`, objectFit: 'cover', background: '#F8FAFC' }} />}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingTop: 8 }}>
              <p style={{ fontSize: 14, color: '#64748B', lineHeight: 1.7 }}>
                Caja sin compartimentos. Todos los componentes están en el interior sin división interna. Consulta las estadísticas abajo.
              </p>
            </div>
          </div>
        )}

        {/* ESTADÍSTICAS DEL CONTENEDOR */}
        <div style={{ marginTop: 24, borderTop: '1px solid #F1F5F9', paddingTop: 22 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14 }}>
            {/* % utilizado con barra de progreso */}
            <div style={{ background: '#F8FAFC', borderRadius: 10, border: `1px solid ${T.border}`, padding: 16 }}>
              <div style={statLabel}>{isG ? 'Gabinete utilizado' : isC12 ? 'Caja utilizada' : 'Componentes guardados'}</div>
              <div style={statBig}>{isCL ? ctComps.length : `${stats.pct}%`}</div>
              {!isCL && (
                <div style={{ height: 8, background: '#EEF2F7', borderRadius: 4, overflow: 'hidden', marginTop: 10 }}>
                  <div style={{ height: '100%', width: `${stats.pct}%`, background: T.primary, borderRadius: 4, transition: 'width 0.3s' }} />
                </div>
              )}
              <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 6 }}>{isCL ? 'tipos distintos aquí' : `${stats.occupied} de ${stats.totalDrawers} cajones`}</div>
            </div>
            <div style={{ background: '#F8FAFC', borderRadius: 10, border: `1px solid ${T.border}`, padding: 16 }}>
              <div style={statLabel}>Componentes guardados</div>
              <div style={statBig}>{ctComps.length}</div>
              <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 6 }}>tipos distintos aquí</div>
            </div>
            <div style={{ background: '#F8FAFC', borderRadius: 10, border: `1px solid ${T.border}`, padding: 16 }}>
              <div style={statLabel}>Unidades</div>
              <div style={statBig}>{stats.units}</div>
              <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 6 }}>piezas en total</div>
            </div>
          </div>
          <button onClick={() => setDrawer({ cid: active, all: true })} style={{ marginTop: 14, padding: '10px 18px', background: '#0F172A', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600, fontFamily: T.font }}>Ver contenido completo →</button>

          {/* LEYENDA (solo gabinete/caja12) */}
          {(isG || isC12) && (
            <div style={{ marginTop: 22, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 24 }}>
              <div>
                <div style={legendHdr}>Color del recuadro = tipo de componente</div>
                {legendTypes.length > 0 ? (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {legendTypes.map(({ t, col }) => (
                      <div key={t} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 10px 3px 6px', background: '#F8FAFC', border: `1px solid ${T.border}`, borderRadius: 20 }}>
                        <div style={{ width: 13, height: 13, borderRadius: 3, background: col, flexShrink: 0 }} />
                        <span style={{ fontSize: 12, color: '#475569' }}>{t}</span>
                      </div>
                    ))}
                  </div>
                ) : <p style={{ fontSize: 12, color: '#94A3B8' }}>Aún no hay componentes en este contenedor.</p>}
              </div>
              <div>
                <div style={legendHdr}>Barra inferior = qué tan lleno está el cajón</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                  {[['#22C55E', 'Bajo — cajón con espacio libre'], ['#F59E0B', 'Medio — cajón a media capacidad'], ['#EF4444', 'Alto — cajón lleno']].map(([col, label]) => (
                    <div key={col} style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                      <div style={{ width: 24, height: 4, borderRadius: 2, background: col, flexShrink: 0 }} />
                      <span style={{ fontSize: 12, color: '#64748B' }}>{label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {newBoxOpen && (
        <NewBoxModal onClose={() => setNewBoxOpen(false)} onConfirm={(data) => addCustomBox(data)} />
      )}

      {drawer && (
        <DrawerModal
          title={drawerTitle}
          items={drawerItems}
          loggedIn={loggedIn}
          onClose={() => setDrawer(null)}
          onUse={(id, qty) => use(id, qty)}
          onDelete={(id) => remove(id)}
          onEdit={(mi) => { setDrawer(null); goEdit && goEdit(mi); }}
          onAddHere={!drawer.all ? () => { setDrawer(null); go && go('manage'); } : null}
        />
      )}
    </div>
  );
}

const statLabel = { fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 };
const statBig = { fontSize: 30, fontWeight: 700, color: '#0F172A', letterSpacing: '-1px' };
const legendHdr = { fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 };
