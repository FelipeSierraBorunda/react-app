/* =====================================================================
   CroquisView.jsx — Plano interactivo del laboratorio
   ---------------------------------------------------------------------
   Sub-vistas (pestañas): Plano · Reservar · Reservas.
   - Plano: estado de cada silla (libre / ocupada / reservada / próxima)
     y panel de presencia. En "modo edición" (admin) las mesas se
     arrastran y redimensionan, las sillas se reubican y un panel lateral
     edita nombre, color, tamaño, posición, tope y dueños.
   - Reservar: elige día y hora y mira la disponibilidad de las mesas.
   - Reservas: lista de reservas hechas (cancelables).
   Estadísticas del lab → vista aparte ("labstats").
   ===================================================================== */

import { useEffect, useMemo, useRef, useState } from 'react';
import { useLab } from '../context/LabContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { STAGE_W, STAGE_H, SEAT, MESA_COLORS, resizeSeats } from '../lib/lab-layout.js';
import { overlaps, isActiveNow } from '../lib/lab.js';
import { T, btn } from '../theme.js';
import { Overlay } from '../components/AuthModal.jsx';
import MesaDetailModal from '../components/MesaDetailModal.jsx';

const C = {
  libre: '#22C55E', ocupada: '#EF4444', reservada: '#F59E0B', proxima: '#FACC15',
  mesaBorde: '#475569', tinta: '#0F172A',
  inv: '#2563EB', invBorde: '#1D4ED8', granja: '#EA580C', granjaBorde: '#C2410C',
  brazo: '#1E293B', puerta: '#0EA5E9',
};
const DARK = { ocupada: '#DC2626', reservada: '#D97706', proxima: '#CA8A04', libre: '#16A34A' };

const L_CLIP = 'polygon(0 0,100% 0,100% 100%,72% 100%,72% 48%,0 48%)';
const iniciales = (n = '') => n.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('') || '?';
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const pad = (x) => String(x).padStart(2, '0');
const toDateInput = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const toTimeInput = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
const fmtRange = (a, b) => {
  try {
    const da = new Date(a), db = new Date(b);
    const f = (x) => x.toLocaleString('es', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
    return `${f(da)} – ${db.toLocaleString('es', { hour: '2-digit', minute: '2-digit' })}`;
  } catch (e) { return ''; }
};

export default function CroquisView({ go }) {
  const lab = useLab();
  const { loggedIn, isAdmin } = useAuth();
  const {
    mesas, presentes, presentesPorMesa, reservasActivasPorMesa, reservasProximasPorMesa,
    miPresencia, totalSillas, ocupadas, lleno, ensureLoaded, refresh, salir, now,
  } = lab;

  const [mode, setMode] = useState('plano');     // plano | reservar | reservas
  const [editMode, setEditMode] = useState(false);
  const [editSel, setEditSel] = useState(null);  // id de mesa seleccionada (edición)
  const [sel, setSel] = useState(null);          // mesa abierta en el modal (vista normal)
  const [info, setInfo] = useState(null);        // popup granja/brazo
  const [scale, setScale] = useState(1);

  const wrapRef = useRef(null);
  const mesasRef = useRef(mesas); mesasRef.current = mesas;
  const scaleRef = useRef(scale); scaleRef.current = scale;
  const [drag, setDrag] = useState(null);

  useEffect(() => { ensureLoaded(); }, [ensureLoaded]);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const apply = () => setScale(Math.min(1, el.clientWidth / STAGE_W));
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => ro.disconnect();
  }, [mode]);

  // ---- arrastre en modo edición (mover mesa / redimensionar / reubicar silla) ----
  useEffect(() => {
    if (!drag) return;
    const move = (e) => {
      const s = scaleRef.current || 1;
      const dx = (e.clientX - drag.cx) / s;
      const dy = (e.clientY - drag.cy) / s;
      if (drag.type === 'mesa') {
        lab.setMesaLocal(drag.id, { x: Math.round(clamp(drag.ox + dx, 0, STAGE_W - 16)), y: Math.round(clamp(drag.oy + dy, 0, STAGE_H - 16)) });
      } else if (drag.type === 'resize') {
        lab.setMesaLocal(drag.id, { w: Math.max(40, Math.round(drag.ow + dx)), h: Math.max(34, Math.round(drag.oh + dy)) });
      } else if (drag.type === 'seat') {
        const m = mesasRef.current.find((x) => x.id === drag.id);
        if (!m) return;
        const seats = m.seats.map((st, i) => (i === drag.idx ? { ...st, dx: Math.round(drag.osx + dx), dy: Math.round(drag.osy + dy) } : st));
        lab.setMesaLocal(drag.id, { seats });
      }
    };
    const up = () => {
      const m = mesasRef.current.find((x) => x.id === drag.id);
      if (m) lab.guardarMesa(m.id, { x: m.x, y: m.y, w: m.w, h: m.h, seats: m.seats });
      setDrag(null);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
  }, [drag, lab]);

  const onMesaClick = (m) => {
    if (editMode) { setEditSel(m.id); return; }
    setSel(m);
  };

  const selLive = sel ? mesas.find((m) => m.id === sel.id) || sel : null;
  const editLive = editSel ? mesas.find((m) => m.id === editSel) || null : null;

  const tabBtn = (id, label) => (
    <button onClick={() => { setMode(id); setEditMode(false); }} style={{
      padding: '7px 14px', borderRadius: 8, border: `1px solid ${mode === id ? T.primary : T.border}`,
      background: mode === id ? T.primary : '#fff', color: mode === id ? '#fff' : T.inkSoft,
      fontSize: 13, fontWeight: 600, fontFamily: T.font, cursor: 'pointer',
    }}>{label}</button>
  );

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      {/* Encabezado */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: T.ink, margin: '0 0 4px', letterSpacing: '-0.02em' }}>Croquis &amp; ocupación</h1>
          <p style={{ fontSize: 13, color: T.muted, margin: 0 }}>Plano del laboratorio, disponibilidad de lugares y reservas.</p>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <Counter ocupadas={ocupadas} total={totalSillas} lleno={lleno} />
          <button onClick={() => go('labstats')} style={{ ...btn('ghost') }}>📊 Estadísticas</button>
          <button onClick={refresh} style={{ ...btn('ghost') }}>&#8635; Actualizar</button>
        </div>
      </div>

      {/* Pestañas + toggle edición */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 16 }}>
        {tabBtn('plano', 'Plano')}
        {tabBtn('reservar', 'Reservar')}
        {tabBtn('reservas', 'Reservas')}
        {mode === 'plano' && isAdmin && (
          <button onClick={() => { setEditMode((v) => !v); setEditSel(null); }} style={{
            marginLeft: 'auto', padding: '7px 14px', borderRadius: 8,
            border: `1px solid ${editMode ? '#B45309' : T.border}`,
            background: editMode ? '#FEF3C7' : '#fff', color: editMode ? '#B45309' : T.inkSoft,
            fontSize: 13, fontWeight: 700, fontFamily: T.font, cursor: 'pointer',
          }}>{editMode ? '✓ Modo edición' : '✎ Editar plano'}</button>
        )}
      </div>

      {lleno && mode === 'plano' && !editMode && (
        <div style={{ marginBottom: 14, padding: '10px 16px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, color: '#B91C1C', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 16 }}>&#9888;</span> El laboratorio está lleno ({ocupadas}/{totalSillas} lugares ocupados).
        </div>
      )}

      {editMode && (
        <div style={{ marginBottom: 14, padding: '10px 16px', background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 10, color: '#92400E', fontSize: 12.5, fontWeight: 500 }}>
          Arrastra una mesa para moverla, su esquina ◢ para redimensionar y cada silla para ubicarla. Haz clic en una mesa para editar sus datos en el panel derecho.
        </div>
      )}

      {/* ===================== PLANO ===================== */}
      {mode === 'plano' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 320px', gap: 18, alignItems: 'start' }} className="croquis-grid">
          <div style={{ background: '#fff', border: `1px solid ${T.border}`, borderRadius: 12, padding: 16 }}>
            <Legend />
            <div ref={wrapRef} style={{ width: '100%', marginTop: 12 }}>
              <div style={{ position: 'relative', height: STAGE_H * scale }}>
                <div style={{
                  position: 'absolute', top: 0, left: 0, width: STAGE_W, height: STAGE_H,
                  transform: `scale(${scale})`, transformOrigin: 'top left',
                  borderRadius: 6, border: '3px solid #CBD5E1', backgroundColor: '#F8FAFC',
                  backgroundImage: 'linear-gradient(#EEF2F7 1px,transparent 1px),linear-gradient(90deg,#EEF2F7 1px,transparent 1px)',
                  backgroundSize: '32px 32px', touchAction: editMode ? 'none' : 'auto',
                }}>
                  <div style={{ position: 'absolute', right: -3, top: 14, width: 6, height: 88, background: C.puerta, borderRadius: 3 }} />
                  <div style={{ position: 'absolute', right: 14, top: 18, fontSize: 11, fontWeight: 600, color: C.puerta }}>Puerta →</div>

                  {mesas.map((m) => (
                    <MesaNode
                      key={m.id} m={m}
                      occupants={presentesPorMesa[m.id] || []}
                      reservadas={reservasActivasPorMesa[m.id] || []}
                      proximas={reservasProximasPorMesa[m.id] || []}
                      editMode={editMode} selected={editSel === m.id}
                      onClick={() => onMesaClick(m)}
                      onMesaDown={(e) => { e.stopPropagation(); setEditSel(m.id); setDrag({ type: 'mesa', id: m.id, cx: e.clientX, cy: e.clientY, ox: m.x, oy: m.y }); }}
                      onResizeDown={(e) => { e.stopPropagation(); setDrag({ type: 'resize', id: m.id, cx: e.clientX, cy: e.clientY, ow: m.w, oh: m.h }); }}
                      onSeatDown={(e, idx) => { e.stopPropagation(); setDrag({ type: 'seat', id: m.id, idx, cx: e.clientX, cy: e.clientY, osx: m.seats[idx].dx, osy: m.seats[idx].dy }); }}
                      nombreDe={lab.nombreDe}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>

          {editMode ? (
            <MesaEditor mesa={editLive} lab={lab} onClose={() => setEditSel(null)} onSelect={setEditSel} />
          ) : (
            <PresencePanel presentes={presentes} miPresencia={miPresencia} loggedIn={loggedIn} isAdmin={isAdmin} mesas={mesas} onSalir={salir} onForzar={lab.forzarSalida} now={now} />
          )}
        </div>
      )}

      {/* ===================== RESERVAR ===================== */}
      {mode === 'reservar' && <ReserveHub lab={lab} loggedIn={loggedIn} />}

      {/* ===================== RESERVAS ===================== */}
      {mode === 'reservas' && <ReservasList lab={lab} isAdmin={isAdmin} />}

      {selLive && !editMode && <MesaDetailModal mesa={selLive} onClose={() => setSel(null)} go={go} />}
      {info && <InfoModal item={info} onClose={() => setInfo(null)} />}

      <style>{`
        @media (max-width: 860px){ .croquis-grid{ grid-template-columns: 1fr !important; } }
        @keyframes blinkSeat { 0%,100%{ opacity:1 } 50%{ opacity:.35 } }
      `}</style>
    </div>
  );
}

/* ---------- contador ---------- */
function Counter({ ocupadas, total, lleno }) {
  return (
    <div style={{ textAlign: 'right' }}>
      <div style={{ fontSize: 22, fontWeight: 700, lineHeight: 1, color: lleno ? '#DC2626' : T.ink }}>
        {ocupadas}<span style={{ fontSize: 14, color: T.muted, fontWeight: 500 }}> / {total}</span>
      </div>
      <div style={{ fontSize: 10, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 3 }}>lugares ocupados</div>
    </div>
  );
}

/* ---------- leyenda ---------- */
function Legend() {
  const item = (color, label, ring) => (
    <span style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, color: T.inkSoft }}>
      <span style={{ width: 14, height: 14, borderRadius: ring ? '50%' : 3, background: color, border: ring ? '2px solid #fff' : 'none', boxShadow: ring ? `0 0 0 1px ${color}` : 'none' }} />
      {label}
    </span>
  );
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
      {item(C.libre, 'Silla libre', true)}
      {item(C.ocupada, 'Ocupada', true)}
      {item(C.reservada, 'Reservada (ahora)', true)}
      {item(C.proxima, 'En ≤30 min', true)}
      {item(C.inv, 'Inventario')}
      {item(C.granja, 'Granja FPGA')}
      {item(C.brazo, 'Brazo robot')}
    </div>
  );
}

/* ---------- nodo de mesa + sillas ---------- */
function MesaNode({ m, occupants, reservadas, proximas, editMode, selected, onClick, onMesaDown, onResizeDown, onSeatDown, nombreDe }) {
  const isMesa = m.kind === 'mesa';
  const isL = m.forma === 'L';

  let bg = m.color || '#fff', border = C.mesaBorde, txt = C.tinta;
  let label = m.nombre.replace(/^Mesa\s*/, '');
  if (m.kind === 'inventario' || m.kind === 'almacen') { bg = C.inv; border = C.invBorde; txt = '#fff'; }
  if (m.kind === 'granja') { bg = C.granja; border = C.granjaBorde; txt = '#fff'; label = 'Granja FPGA'; }
  if (m.kind === 'brazo') { bg = C.brazo; border = C.brazo; txt = '#fff'; label = 'Brazo robot'; }
  if (m.kind === 'modulo') { bg = m.color || '#475569'; border = '#334155'; txt = '#fff'; label = m.nombre; }
  const esMod = m.kind !== 'mesa';

  const nOcc = occupants.length, nRes = reservadas.length, nProx = proximas.length;
  const seats = m.seats || [];
  const activeSeats = seats.filter((s) => s.on);

  // Asigna estado a cada silla activa: ocupada → reservada → próxima → libre.
  const stateFor = (i) => {
    if (i < nOcc) return 'ocupada';
    if (i < nOcc + nRes) return 'reservada';
    if (i < nOcc + nRes + nProx) return 'proxima';
    return 'libre';
  };

  return (
    <>
      <div
        onClick={editMode ? undefined : onClick}
        onPointerDown={editMode ? onMesaDown : undefined}
        title={m.nombre}
        style={{
          position: 'absolute', left: m.x, top: m.y, width: m.w, height: m.h,
          cursor: editMode ? 'move' : 'pointer',
          filter: isL ? 'drop-shadow(0 1px 1.5px rgba(15,23,42,0.18))' : 'none',
          outline: selected ? '2px solid #2563EB' : 'none', outlineOffset: 2,
        }}
      >
        {isL ? (
          <>
            <div style={{ position: 'absolute', inset: 0, background: border, clipPath: L_CLIP }} />
            <div style={{ position: 'absolute', inset: 2, background: bg, clipPath: L_CLIP, display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end', padding: 8 }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: txt }}>{label}</span>
            </div>
          </>
        ) : (
          <div style={{
            position: 'absolute', inset: 0, background: bg, border: `2px solid ${border}`, borderRadius: 4,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3, textAlign: 'center', padding: 4,
          }}>
            <span style={{ fontSize: isMesa ? 15 : 11, fontWeight: 700, color: txt, lineHeight: 1.1 }}>{label}</span>
            {m.pc && <span style={{ position: 'absolute', bottom: 2, right: 4, background: '#EFF6FF', color: '#2563EB', fontSize: 8, fontWeight: 700, padding: '1px 5px', borderRadius: 4 }}>PC</span>}
            {esMod && <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.85)' }}>ver →</span>}
          </div>
        )}
        {isMesa && (m.duenos || []).length > 0 && (
          <span style={{ position: 'absolute', top: -9, left: isL ? 'auto' : 6, right: isL ? 0 : 'auto', background: '#7C3AED', color: '#fff', fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 10, whiteSpace: 'nowrap' }}>
            {nombreDe((m.duenos || [])[0])}
          </span>
        )}
        {/* tirador de redimensión */}
        {editMode && selected && (
          <div onPointerDown={onResizeDown} style={{ position: 'absolute', right: -7, bottom: -7, width: 16, height: 16, borderRadius: 4, background: '#2563EB', border: '2px solid #fff', cursor: 'nwse-resize', boxShadow: '0 1px 3px rgba(0,0,0,.3)' }} />
        )}
      </div>

      {/* sillas — modo normal: solo activas con estado */}
      {!editMode && activeSeats.map((s, i) => {
        const st = stateFor(i);
        const color = C[st], dark = DARK[st];
        return (
          <div key={i} onClick={onClick} title={st === 'ocupada' ? occupants[i].nombre : st === 'reservada' ? 'Reservada ahora' : st === 'proxima' ? 'Se usará en ≤30 min' : 'Libre'}
            style={{ position: 'absolute', left: m.x + s.dx, top: m.y + s.dy, width: SEAT, height: SEAT, borderRadius: '50%', background: color, border: '2px solid #fff', boxShadow: `0 0 0 1px ${dark}`, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, fontWeight: 700, color: '#fff', animation: st === 'proxima' ? 'blinkSeat 1s infinite' : 'none' }}>
            {st === 'ocupada' ? iniciales(occupants[i].nombre) : ''}
          </div>
        );
      })}

      {/* sillas — modo edición: todas (on sólidas, off fantasma), arrastrables */}
      {editMode && seats.map((s, i) => (
        <div key={i} onPointerDown={(e) => onSeatDown(e, i)} title={`Silla ${i + 1}${s.on ? '' : ' (apagada)'}`}
          style={{ position: 'absolute', left: m.x + s.dx, top: m.y + s.dy, width: SEAT, height: SEAT, borderRadius: '50%', background: s.on ? '#0D9488' : '#fff', border: s.on ? '2px solid #fff' : '2px dashed #94A3B8', boxShadow: s.on ? '0 0 0 1px #0F766E' : 'none', opacity: s.on ? 1 : 0.7, cursor: 'grab', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: s.on ? '#fff' : '#64748B' }}>
          {i + 1}
        </div>
      ))}
    </>
  );
}

/* ---------- panel de presencia ---------- */
function PresencePanel({ presentes, miPresencia, loggedIn, isAdmin, mesas, onSalir, onForzar, now }) {
  const nombreMesa = (id) => { const m = mesas.find((x) => x.id === id); return m ? m.nombre : 'Sin mesa'; };
  const dur = (entrada) => {
    const min = Math.max(0, Math.floor((now - new Date(entrada)) / 60000));
    if (min < 60) return `${min} min`;
    return `${Math.floor(min / 60)} h ${min % 60} min`;
  };
  return (
    <aside style={{ background: '#fff', border: `1px solid ${T.border}`, borderRadius: 12, padding: 18, position: 'sticky', top: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: T.ink, margin: 0 }}>Quién está</h3>
        <span style={{ fontSize: 12, fontWeight: 700, color: '#16A34A', background: '#F0FDF4', padding: '3px 9px', borderRadius: 20 }}>{presentes.length} dentro</span>
      </div>

      {presentes.length === 0 ? (
        <p style={{ fontSize: 13, color: T.muted, margin: '4px 0 16px' }}>Nadie en el laboratorio ahora mismo.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16, maxHeight: 360, overflowY: 'auto' }}>
          {presentes.map((p) => (
            <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', background: '#F8FAFC', border: `1px solid ${T.border}`, borderRadius: 9 }}>
              <div style={{ width: 30, height: 30, borderRadius: '50%', background: '#0F172A', color: '#fff', display: 'grid', placeItems: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{iniciales(p.nombre)}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: T.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.nombre}</div>
                <div style={{ fontSize: 11, color: T.muted }}>{nombreMesa(p.mesa)} · {dur(p.entrada)}</div>
              </div>
              {isAdmin && (
                <button onClick={() => onForzar(p.id)} title="Registrar salida (admin)" style={{ width: 26, height: 26, borderRadius: 7, border: '1px solid #FEE2E2', background: '#fff', color: '#DC2626', cursor: 'pointer', fontSize: 13, flexShrink: 0, lineHeight: 1 }}>⏏</button>
              )}
            </div>
          ))}
        </div>
      )}

      <div style={{ borderTop: `1px solid ${T.border}`, paddingTop: 14 }}>
        {!loggedIn ? (
          <p style={{ fontSize: 12, color: T.muted, margin: 0 }}>Inicia sesión para registrar tu entrada.</p>
        ) : miPresencia ? (
          <>
            <div style={{ fontSize: 12, color: T.inkSoft, marginBottom: 8 }}>Estás dentro desde hace <strong>{dur(miPresencia.entrada)}</strong>{miPresencia.mesa ? ` · ${nombreMesa(miPresencia.mesa)}` : ''}.</div>
            <button onClick={onSalir} style={{ ...btn('danger'), width: '100%' }}>Registrar salida</button>
          </>
        ) : (
          <p style={{ fontSize: 12, color: T.muted, margin: 0 }}>Abre una mesa en el croquis y pulsa <strong>“Entrar aquí”</strong> para registrar tu llegada.</p>
        )}
        {isAdmin && presentes.length > 0 && <p style={{ fontSize: 11, color: T.muted, margin: '10px 0 0' }}>⏏ junto a una persona registra su salida (admin).</p>}
      </div>
    </aside>
  );
}

/* ---------- panel de edición de mesa (admin) ---------- */
function MesaEditor({ mesa, lab, onClose, onSelect }) {
  const crear = async (kind) => { const m = await lab.agregarMesa(kind ? { kind } : {}); if (m && onSelect) onSelect(m.id); };
  if (!mesa) {
    return (
      <aside style={{ background: '#fff', border: `1px solid ${T.border}`, borderRadius: 12, padding: 18, position: 'sticky', top: 16 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: T.ink, margin: '0 0 8px' }}>Editar plano</h3>
        <p style={{ fontSize: 12.5, color: T.muted, margin: '0 0 16px' }}>Selecciona una mesa o módulo en el plano para editar sus datos, o crea uno nuevo.</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button onClick={() => crear(null)} style={{ ...btn('primary'), width: '100%' }}>+ Nueva mesa</button>
          <button onClick={() => crear('modulo')} style={{ ...btn('ghost'), width: '100%' }}>+ Nuevo módulo</button>
        </div>
        <p style={{ fontSize: 11.5, color: T.muted, margin: '12px 0 0' }}>Una <strong>mesa</strong> lleva sillas y reservas. Un <strong>módulo</strong> (granja, brazo, estación…) no lleva sillas, pero puede alojar gabinetes y cajas.</p>
      </aside>
    );
  }

  const esMesa = mesa.kind === 'mesa';
  const set = (patch) => lab.guardarMesa(mesa.id, patch);
  const setNum = (k, v) => lab.setMesaLocal(mesa.id, { [k]: v });          // vivo
  const saveNum = (k, v) => lab.guardarMesa(mesa.id, { [k]: Math.round(+v || 0) });

  const onCount = (mesa.seats || []).filter((s) => s.on).length;
  const toggleSeat = (i) => {
    const seats = mesa.seats.map((s, j) => (j === i ? { ...s, on: !s.on } : s));
    lab.guardarMesa(mesa.id, { seats });
  };
  const changeMax = (v) => {
    const nuevo = Math.max(0, Math.min(8, parseInt(v, 10) || 0));
    const seats = resizeSeats(mesa, nuevo);
    lab.guardarMesa(mesa.id, { max_sillas: nuevo, seats });
  };
  const toggleDueno = (email) => {
    const has = (mesa.duenos || []).includes(email);
    const duenos = has ? mesa.duenos.filter((d) => d !== email) : [...(mesa.duenos || []), email].slice(0, 2);
    lab.guardarMesa(mesa.id, { duenos });
  };

  return (
    <aside style={{ background: '#fff', border: `1px solid ${T.border}`, borderRadius: 12, padding: 18, position: 'sticky', top: 16, maxHeight: 'calc(100vh - 32px)', overflowY: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: T.ink, margin: 0 }}>Editar · {mesa.nombre}</h3>
        <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: 7, border: `1px solid ${T.border}`, background: '#fff', cursor: 'pointer', color: T.muted, fontSize: 14 }}>✕</button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Field label="Nombre / número">
          <input defaultValue={mesa.nombre} key={'n' + mesa.id} onBlur={(e) => set({ nombre: e.target.value.trim() || mesa.nombre })} style={inp} />
        </Field>

        <Field label="Descripción">
          <textarea defaultValue={mesa.descripcion || ''} key={'d' + mesa.id} onBlur={(e) => set({ descripcion: e.target.value.trim() })} rows={2} placeholder={esMesa ? 'Notas de la mesa…' : 'Para qué sirve este módulo…'} style={{ ...inp, resize: 'vertical', minHeight: 48 }} />
        </Field>

        {/* color */}
        <Field label="Color">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {MESA_COLORS.map((c) => (
              <button key={c} onClick={() => set({ color: c })} title={c} style={{ width: 26, height: 26, borderRadius: 7, background: c, cursor: 'pointer', border: (mesa.color || '#ffffff') === c ? '2px solid #2563EB' : '1px solid #CBD5E1' }} />
            ))}
          </div>
        </Field>

        {/* forma */}
        {esMesa && (
          <Field label="Forma">
            <div style={{ display: 'flex', gap: 6 }}>
              {[['rect', 'Cuadrada'], ['L', 'En L']].map(([id, lbl]) => (
                <button key={id} onClick={() => set({ forma: id })} style={{ flex: 1, padding: '8px 0', borderRadius: 8, border: `1px solid ${mesa.forma === id ? T.primary : T.border}`, background: mesa.forma === id ? T.primarySoft : '#fff', color: mesa.forma === id ? T.primary : T.inkSoft, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>{lbl}</button>
              ))}
            </div>
          </Field>
        )}

        {/* posición / tamaño */}
        <div style={{ display: 'flex', gap: 8 }}>
          <Field label="X" style={{ flex: 1 }}><input type="number" value={Math.round(mesa.x)} onChange={(e) => setNum('x', +e.target.value)} onBlur={(e) => saveNum('x', e.target.value)} style={inp} /></Field>
          <Field label="Y" style={{ flex: 1 }}><input type="number" value={Math.round(mesa.y)} onChange={(e) => setNum('y', +e.target.value)} onBlur={(e) => saveNum('y', e.target.value)} style={inp} /></Field>
          <Field label="Ancho" style={{ flex: 1 }}><input type="number" value={Math.round(mesa.w)} onChange={(e) => setNum('w', +e.target.value)} onBlur={(e) => saveNum('w', e.target.value)} style={inp} /></Field>
          <Field label="Alto" style={{ flex: 1 }}><input type="number" value={Math.round(mesa.h)} onChange={(e) => setNum('h', +e.target.value)} onBlur={(e) => saveNum('h', e.target.value)} style={inp} /></Field>
        </div>

        {esMesa && (
          <>
            {/* sillas */}
            <Field label={`Tope de sillas (${onCount} activas de ${mesa.max_sillas})`}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input type="number" min={0} max={8} value={mesa.max_sillas} onChange={(e) => changeMax(e.target.value)} style={{ ...inp, width: 80 }} />
                <span style={{ fontSize: 11.5, color: T.muted }}>Arrastra las sillas en el plano para ubicarlas.</span>
              </div>
            </Field>
            {mesa.max_sillas > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {mesa.seats.map((s, i) => (
                  <button key={i} onClick={() => toggleSeat(i)} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, padding: '5px 10px', borderRadius: 8, cursor: 'pointer', border: `1px solid ${s.on ? '#0F766E' : T.border}`, background: s.on ? '#CCFBF1' : '#F8FAFC', color: s.on ? '#0F766E' : T.muted }}>
                    <span style={{ width: 9, height: 9, borderRadius: '50%', background: s.on ? '#0D9488' : '#CBD5E1' }} /> Silla {i + 1}
                  </button>
                ))}
              </div>
            )}

            {/* dueños (cuentas registradas) */}
            <Field label="Dueños (máx 2 · cuentas registradas)">
              {lab.cuentas.length === 0 ? (
                <span style={{ fontSize: 12.5, color: T.muted }}>No hay cuentas registradas todavía.</span>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 150, overflowY: 'auto', border: `1px solid ${T.border}`, borderRadius: 8, padding: 8 }}>
                  {lab.cuentas.map((u) => {
                    const checked = (mesa.duenos || []).includes(u.email);
                    return (
                      <label key={u.email} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: T.ink, cursor: 'pointer' }}>
                        <input type="checkbox" checked={checked} onChange={() => toggleDueno(u.email)} />
                        <span style={{ fontWeight: 600 }}>{u.nombre}</span>
                        <span style={{ fontSize: 11, color: T.muted }}>{u.email}</span>
                      </label>
                    );
                  })}
                </div>
              )}
            </Field>

            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: T.inkSoft, cursor: 'pointer' }}>
              <input type="checkbox" checked={!!mesa.pc} onChange={(e) => set({ pc: e.target.checked })} /> Tiene PC
            </label>
          </>
        )}

        <Field label="Enlace (opcional)">
          <input defaultValue={mesa.link || ''} key={'l' + mesa.id} onBlur={(e) => set({ link: e.target.value.trim() })} placeholder="https://…" style={inp} />
        </Field>

        <div style={{ display: 'flex', gap: 8, borderTop: `1px solid ${T.border}`, paddingTop: 12 }}>
          <button onClick={() => crear(null)} style={{ ...btn('ghost'), flex: 1 }}>+ Mesa</button>
          <button onClick={() => crear('modulo')} style={{ ...btn('ghost'), flex: 1 }}>+ Módulo</button>
          <button onClick={() => { if (confirm(`¿Eliminar ${mesa.nombre}?`)) { lab.eliminarMesa(mesa.id); onClose(); } }} style={{ ...btn('danger'), flex: 1 }}>Eliminar</button>
        </div>
      </div>
    </aside>
  );
}

/* ---------- hub de reservas (elige día/hora → disponibilidad) ---------- */
function ReserveHub({ lab, loggedIn }) {
  const { mesas, reservas, reservar, nombreDe, now } = lab;
  const next30 = new Date(Math.ceil(now.getTime() / (30 * 60000)) * 30 * 60000);
  const [fecha, setFecha] = useState(toDateInput(next30));
  const [hora, setHora] = useState(toTimeInput(next30));
  const [dur, setDur] = useState(60);
  const [msg, setMsg] = useState(null);

  const inicio = useMemo(() => new Date(`${fecha}T${hora}`), [fecha, hora]);
  const fin = useMemo(() => new Date(inicio.getTime() + dur * 60000), [inicio, dur]);
  const valido = !isNaN(inicio) && inicio.getTime() > now.getTime() - 60000;

  const reservables = mesas.filter((m) => m.kind === 'mesa' && m.max_sillas > 0);
  const dispo = reservables.map((m) => {
    const conflictos = reservas.filter((r) => r.mesa === m.id && r.estado === 'activa' && overlaps(inicio.toISOString(), fin.toISOString(), r.inicio, r.fin));
    return { m, libre: conflictos.length === 0, por: conflictos[0] ? nombreDe(conflictos[0].email) : null };
  });
  const libres = dispo.filter((d) => d.libre).length;

  async function doReservar(m) {
    setMsg(null);
    const r = await reservar({ mesa: m, inicio: inicio.toISOString(), fin: fin.toISOString() });
    setMsg(r.ok ? { ok: true, t: `Reserva creada en ${m.nombre}.${r.desplazadas ? ` Desplazaste ${r.desplazadas} de externos.` : ''}` } : { ok: false, t: r.error });
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr)', gap: 16 }}>
      <div style={{ background: '#fff', border: `1px solid ${T.border}`, borderRadius: 12, padding: 20 }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, color: T.ink, margin: '0 0 4px' }}>Reservar por día y hora</h3>
        <p style={{ fontSize: 13, color: T.muted, margin: '0 0 16px' }}>Elige un horario y mira qué mesas están disponibles.</p>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <Field label="Día" style={{ flex: '1 1 150px' }}><input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} style={inp} /></Field>
          <Field label="Hora" style={{ flex: '1 1 120px' }}><input type="time" step={300} value={hora} onChange={(e) => setHora(e.target.value)} style={inp} /></Field>
          <Field label="Duración" style={{ flex: '1 1 120px' }}>
            <select value={dur} onChange={(e) => setDur(+e.target.value)} style={inp}>
              <option value={30}>30 min</option><option value={60}>1 hora</option><option value={90}>1 h 30</option>
              <option value={120}>2 horas</option><option value={180}>3 horas</option><option value={240}>4 horas</option>
            </select>
          </Field>
          <div style={{ flex: '1 1 140px', textAlign: 'right', fontSize: 13, color: T.inkSoft }}>
            <strong style={{ color: T.ink }}>{libres}</strong> de {reservables.length} mesas libres
          </div>
        </div>
        {!valido && <div style={{ marginTop: 12, fontSize: 12.5, color: '#B91C1C' }}>Elige una fecha y hora válidas (en el futuro).</div>}
        {msg && <div style={{ marginTop: 12, padding: '9px 12px', borderRadius: 8, fontSize: 13, fontWeight: 500, background: msg.ok ? '#F0FDF4' : '#FEF2F2', color: msg.ok ? '#15803D' : '#B91C1C', border: `1px solid ${msg.ok ? '#BBF7D0' : '#FECACA'}` }}>{msg.t}</div>}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 12 }}>
        {dispo.map(({ m, libre, por }) => (
          <div key={m.id} style={{ background: '#fff', border: `1px solid ${libre ? '#BBF7D0' : '#FDE68A'}`, borderRadius: 12, padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: T.ink }}>{m.nombre}</span>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: libre ? C.libre : C.reservada }} />
            </div>
            <div style={{ fontSize: 12, color: libre ? '#15803D' : '#B45309', fontWeight: 600 }}>{libre ? 'Disponible' : `Reservada · ${por}`}</div>
            {(m.duenos || []).length > 0 && <div style={{ fontSize: 11, color: T.muted }}>Dueño: {(m.duenos).map(nombreDe).join(', ')}</div>}
            <button onClick={() => doReservar(m)} disabled={!loggedIn || !valido} style={{ ...btn(libre ? 'primary' : 'ghost'), width: '100%', marginTop: 'auto', opacity: (!loggedIn || !valido) ? 0.5 : 1, cursor: (!loggedIn || !valido) ? 'not-allowed' : 'pointer' }}>
              {libre ? 'Reservar' : 'Reservar igual'}
            </button>
          </div>
        ))}
        {reservables.length === 0 && <p style={{ fontSize: 13, color: T.muted }}>No hay mesas reservables.</p>}
      </div>
      {!loggedIn && <p style={{ fontSize: 12.5, color: T.muted, margin: 0 }}>Inicia sesión para reservar.</p>}
    </div>
  );
}

/* ---------- lista de reservas hechas ---------- */
function ReservasList({ lab, isAdmin }) {
  const { reservas, mesas, cancelarReserva, nombreDe, now } = lab;
  const { session } = useAuth();
  const nombreMesa = (id) => { const m = mesas.find((x) => x.id === id); return m ? m.nombre : id; };

  const proximas = reservas
    .filter((r) => r.estado === 'activa' && new Date(r.fin) > now)
    .sort((a, b) => new Date(a.inicio) - new Date(b.inicio));

  return (
    <div style={{ background: '#fff', border: `1px solid ${T.border}`, borderRadius: 12, overflow: 'hidden' }}>
      <div style={{ padding: '16px 20px', borderBottom: `1px solid ${T.border}` }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, color: T.ink, margin: 0 }}>Reservas hechas</h3>
        <p style={{ fontSize: 12.5, color: T.muted, margin: '2px 0 0' }}>Reservas activas próximas. {proximas.length} en total.</p>
      </div>
      {proximas.length === 0 ? (
        <div style={{ padding: 40, textAlign: 'center', color: T.muted, fontSize: 13.5 }}>No hay reservas activas.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {proximas.map((r) => {
            const activa = isActiveNow(r, now);
            const puede = isAdmin || (session && r.email === session.email);
            return (
              <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px', borderBottom: `1px solid ${T.border}` }}>
                <div style={{ width: 44, textAlign: 'center', flexShrink: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: T.ink }}>{nombreMesa(r.mesa).replace(/^Mesa\s*/, '')}</div>
                  <div style={{ fontSize: 9, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>mesa</div>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: T.ink }}>{nombreDe(r.email)}{r.es_dueno ? ' · dueño' : ''}</div>
                  <div style={{ fontSize: 12, color: T.muted }}>{fmtRange(r.inicio, r.fin)}</div>
                </div>
                {activa && <span style={{ fontSize: 11, fontWeight: 700, color: '#B45309', background: '#FEF3C7', padding: '3px 9px', borderRadius: 20 }}>En curso</span>}
                {puede && <button onClick={() => cancelarReserva(r.id)} style={{ ...btn('danger') }}>Cancelar</button>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ---------- popup granja / brazo ---------- */
function InfoModal({ item, onClose }) {
  const accent = item.kind === 'granja' ? C.granja : C.brazo;
  const desc = item.kind === 'granja'
    ? 'Granja de FPGAs del laboratorio. El enlace de acceso se configurará próximamente.'
    : 'Brazo robótico del laboratorio. Documentación y enlace de control por definir.';
  return (
    <Overlay onClose={onClose}>
      <div style={{ background: '#fff', borderRadius: 14, padding: 24, maxWidth: 380, width: '100%' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ width: 44, height: 44, borderRadius: 11, background: accent, display: 'grid', placeItems: 'center', color: '#fff', fontWeight: 700, marginBottom: 12 }}>
          {item.kind === 'granja' ? 'FP' : '🤖'}
        </div>
        <h2 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 6px' }}>{item.nombre}</h2>
        <p style={{ fontSize: 13, color: T.inkSoft, lineHeight: 1.5, margin: '0 0 18px' }}>{desc}</p>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onClose} style={{ ...btn('ghost'), flex: 1 }}>Cerrar</button>
          <button disabled style={{ ...btn('primary'), flex: 1, opacity: 0.5, cursor: 'not-allowed' }}>Enlace por definir</button>
        </div>
      </div>
    </Overlay>
  );
}

/* ---------- helpers UI ---------- */
function Field({ label, children, style }) {
  return (
    <label style={{ display: 'block', ...style }}>
      <span style={{ display: 'block', fontSize: 12, fontWeight: 600, color: T.inkSoft, marginBottom: 5 }}>{label}</span>
      {children}
    </label>
  );
}
const inp = { width: '100%', padding: '9px 12px', borderRadius: 8, border: `1px solid ${T.border}`, fontSize: 13.5, fontFamily: T.font, outline: 'none', boxSizing: 'border-box', background: '#fff', color: T.ink };
