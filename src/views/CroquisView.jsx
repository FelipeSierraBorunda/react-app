/* =====================================================================
   CroquisView.jsx — Plano interactivo del laboratorio
   ---------------------------------------------------------------------
   Estilo "Claro minimal" sobre la distribución aprobada (v4). Muestra el
   croquis con el estado de cada silla (libre / ocupada / reservada), un
   panel lateral de presencia (quién está, contador, aviso de lleno) y los
   controles de check-in/out. Al hacer click en una mesa se abre el
   detalle, con reserva (regla dueño/externo) y edición.
   ===================================================================== */

import { useEffect, useRef, useState } from 'react';
import { useLab } from '../context/LabContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { STAGE_W, STAGE_H } from '../lib/lab-layout.js';
import { T, btn } from '../theme.js';
import { Overlay } from './AuthModal.jsx';
import MesaDetailModal from '../components/MesaDetailModal.jsx';

const C = {
  libre: '#22C55E', ocupada: '#EF4444', reservada: '#F59E0B',
  mesa: '#fff', mesaBorde: '#475569', tinta: '#0F172A',
  inv: '#2563EB', invBorde: '#1D4ED8', granja: '#EA580C', granjaBorde: '#C2410C',
  brazo: '#1E293B', puerta: '#0EA5E9',
};

// Posición de las sillas alrededor de una mesa según su dirección.
export function seatPositions(m) {
  const n = m.sillas || 0;
  const size = 22, gap = 8;
  const dir = m.silla_dir || 'bottom';
  const pos = [];
  if (dir === 'bottom' || dir === 'top') {
    const total = n * size + (n - 1) * gap;
    const sx = m.x + m.w / 2 - total / 2;
    const sy = dir === 'bottom' ? m.y + m.h + gap : m.y - size - gap;
    for (let i = 0; i < n; i++) pos.push({ left: sx + i * (size + gap), top: sy });
  } else {
    const total = n * size + (n - 1) * gap;
    const sy = m.y + m.h / 2 - total / 2;
    const sx = dir === 'right' ? m.x + m.w + gap : m.x - size - gap;
    for (let i = 0; i < n; i++) pos.push({ left: sx, top: sy + i * (size + gap) });
  }
  return pos;
}

// clip-path para la forma de L (codo arriba-derecha, brazo vertical 72%).
const L_CLIP = 'polygon(0 0,100% 0,100% 100%,72% 100%,72% 48%,0 48%)';

const iniciales = (nombre = '') =>
  nombre.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('') || '?';

export default function CroquisView({ go }) {
  const lab = useLab();
  const { loggedIn } = useAuth();
  const {
    mesas, presentes, presentesPorMesa, reservasActivasPorMesa,
    miPresencia, totalSillas, ocupadas, lleno, ensureLoaded, refresh, salir,
  } = lab;

  const [sel, setSel] = useState(null);        // mesa seleccionada (modal)
  const [info, setInfo] = useState(null);      // popup granja/brazo
  const [scale, setScale] = useState(1);
  const wrapRef = useRef(null);

  useEffect(() => { ensureLoaded(); }, [ensureLoaded]);

  // Escala el lienzo lógico (880×500) al ancho disponible.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const apply = () => setScale(Math.min(1, el.clientWidth / STAGE_W));
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const onMesaClick = (m) => {
    if (m.kind === 'inventario' || m.kind === 'almacen') return go('table');
    if (m.kind === 'granja' || m.kind === 'brazo') return setInfo(m);
    setSel(m);
  };

  // Mesa abierta en el modal, recalculada desde el estado vivo.
  const selLive = sel ? mesas.find((m) => m.id === sel.id) || sel : null;

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      {/* Encabezado */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 18 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: T.ink, margin: '0 0 4px', letterSpacing: '-0.02em' }}>Croquis &amp; ocupación</h1>
          <p style={{ fontSize: 13, color: T.muted, margin: 0 }}>Toca una mesa para ver detalle, reservar o registrar tu entrada.</p>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <Counter ocupadas={ocupadas} total={totalSillas} lleno={lleno} />
          <button onClick={refresh} style={{ ...btn('ghost') }}>&#8635; Actualizar</button>
        </div>
      </div>

      {/* Aviso de lleno */}
      {lleno && (
        <div style={{ marginBottom: 14, padding: '10px 16px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, color: '#B91C1C', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 16 }}>&#9888;</span> El laboratorio está lleno ({ocupadas}/{totalSillas} lugares ocupados).
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 300px', gap: 18, alignItems: 'start' }} className="croquis-grid">
        {/* ---------- LIENZO ---------- */}
        <div style={{ background: '#fff', border: `1px solid ${T.border}`, borderRadius: 12, padding: 16 }}>
          <Legend />
          <div ref={wrapRef} style={{ width: '100%', marginTop: 12 }}>
            <div style={{ position: 'relative', height: STAGE_H * scale }}>
              <div style={{
                position: 'absolute', top: 0, left: 0, width: STAGE_W, height: STAGE_H,
                transform: `scale(${scale})`, transformOrigin: 'top left',
                borderRadius: 6, border: '3px solid #CBD5E1',
                backgroundColor: '#F8FAFC',
                backgroundImage: 'linear-gradient(#EEF2F7 1px,transparent 1px),linear-gradient(90deg,#EEF2F7 1px,transparent 1px)',
                backgroundSize: '32px 32px',
              }}>
                {/* Puerta (pared derecha, junto a la granja) */}
                <div style={{ position: 'absolute', right: -3, top: 14, width: 6, height: 88, background: C.puerta, borderRadius: 3 }} />
                <div style={{ position: 'absolute', right: 14, top: 18, fontSize: 11, fontWeight: 600, color: C.puerta }}>Puerta →</div>

                {mesas.map((m) => (
                  <MesaNode
                    key={m.id} m={m}
                    occupants={presentesPorMesa[m.id] || []}
                    reservadas={reservasActivasPorMesa[m.id] || []}
                    onClick={() => onMesaClick(m)}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ---------- PANEL PRESENCIA ---------- */}
        <PresencePanel
          presentes={presentes} miPresencia={miPresencia} loggedIn={loggedIn}
          mesas={mesas} onSalir={salir} now={lab.now}
        />
      </div>

      {selLive && (
        <MesaDetailModal
          mesa={selLive}
          onClose={() => setSel(null)}
          go={go}
        />
      )}
      {info && <InfoModal item={info} onClose={() => setInfo(null)} />}

      <style>{`@media (max-width: 820px){ .croquis-grid{ grid-template-columns: 1fr !important; } }`}</style>
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
      {item(C.reservada, 'Reservada', true)}
      {item(C.inv, 'Inventario')}
      {item(C.granja, 'Granja FPGA')}
      {item(C.brazo, 'Brazo robot')}
    </div>
  );
}

/* ---------- nodo de mesa + sillas ---------- */
function MesaNode({ m, occupants, reservadas, onClick }) {
  const seats = seatPositions(m);
  const isMesa = m.kind === 'mesa';
  const isL = m.forma === 'L';

  let bg = C.mesa, border = C.mesaBorde, txt = C.tinta, label = m.nombre.replace(/^Mesa\s*/, '');
  if (m.kind === 'inventario' || m.kind === 'almacen') { bg = C.inv; border = C.invBorde; txt = '#fff'; }
  if (m.kind === 'granja') { bg = C.granja; border = C.granjaBorde; txt = '#fff'; label = 'Granja FPGA'; }
  if (m.kind === 'brazo') { bg = C.brazo; border = C.brazo; txt = '#fff'; label = 'Brazo robot'; }

  const nOcc = occupants.length, nRes = reservadas.length;

  return (
    <>
      {/* cuerpo de la mesa */}
      <div
        onClick={onClick}
        title={m.nombre}
        style={{
          position: 'absolute', left: m.x, top: m.y, width: m.w, height: m.h, cursor: 'pointer',
          filter: isL ? 'drop-shadow(0 1px 1.5px rgba(15,23,42,0.18))' : 'none',
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
            {(m.kind === 'inventario' || m.kind === 'almacen' || m.kind === 'granja') && <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.85)' }}>abrir →</span>}
          </div>
        )}
        {/* etiqueta dueño */}
        {isMesa && (m.duenos || []).length > 0 && (
          <span style={{ position: 'absolute', top: -9, left: isL ? 'auto' : 6, right: isL ? 0 : 'auto', background: '#7C3AED', color: '#fff', fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 10, whiteSpace: 'nowrap' }}>
            {m.duenos[0]}
          </span>
        )}
      </div>

      {/* sillas */}
      {seats.map((s, i) => {
        const occ = i < nOcc;
        const res = !occ && i < nOcc + nRes;
        const color = occ ? C.ocupada : res ? C.reservada : C.libre;
        const dark = occ ? '#DC2626' : res ? '#D97706' : '#16A34A';
        return (
          <div key={i} onClick={onClick} title={occ ? occupants[i].nombre : res ? 'Reservada' : 'Libre'}
            style={{ position: 'absolute', left: s.left, top: s.top, width: 22, height: 22, borderRadius: '50%', background: color, border: '2px solid #fff', boxShadow: `0 0 0 1px ${dark}`, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, fontWeight: 700, color: '#fff' }}>
            {occ ? iniciales(occupants[i].nombre) : ''}
          </div>
        );
      })}
    </>
  );
}

/* ---------- panel de presencia ---------- */
function PresencePanel({ presentes, miPresencia, loggedIn, mesas, onSalir, now }) {
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16, maxHeight: 320, overflowY: 'auto' }}>
          {presentes.map((p) => (
            <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', background: '#F8FAFC', border: `1px solid ${T.border}`, borderRadius: 9 }}>
              <div style={{ width: 30, height: 30, borderRadius: '50%', background: '#0F172A', color: '#fff', display: 'grid', placeItems: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{iniciales(p.nombre)}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: T.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.nombre}</div>
                <div style={{ fontSize: 11, color: T.muted }}>{nombreMesa(p.mesa)} · {dur(p.entrada)}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* mi estado */}
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
      </div>
    </aside>
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
