/* =====================================================================
   GameView.jsx — Laboratorio virtual (mapa tipo Habbo/Pokémon)
   ---------------------------------------------------------------------
   Sub-sección de Croquis & Ocupación. Muévete con WASD por una réplica
   del laboratorio; las mesas del croquis son el mobiliario. Las personas
   con check-in abierto aparecen como avatares "dormidos" (💤) en su mesa.
   Ganas 10 monedas por cada 30 min dentro del lab; gástalas en la tienda
   (ropa, sombreros, mascotas, tapetes). Arriba: el empleado de la semana.
   ===================================================================== */

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { useLang } from '../context/LangContext.jsx';
import {
  TIENDA, EQUIPADO_DEFAULT, itemById, fetchJuego, saveJuego,
  calcRecompensa, empleadoSemana,
} from '../lib/game.js';
import { T } from '../theme.js';

const ROOM_W = 720, ROOM_H = 460, PAD = 46, STEP = 6, AV = 26;

export default function GameView({ mesas = [], presentes = [], presencia = [] }) {
  const { session } = useAuth();
  const { t } = useLang();

  // --- progreso del jugador ---
  const [monedas, setMonedas] = useState(0);
  const [comprados, setComprados] = useState(['skin_azul', 'hat_none', 'pet_none', 'desk_gris']);
  const [equipado, setEquipado] = useState(EQUIPADO_DEFAULT);
  const [ultRecompensa, setUltRecompensa] = useState(null);
  const [shopOpen, setShopOpen] = useState(false);
  const [flash, setFlash] = useState(null);
  const [loaded, setLoaded] = useState(false);

  // --- mapeo del croquis al cuarto del juego ---
  const obstaculos = useMemo(() => mapMesas(mesas), [mesas]);

  // --- empleado de la semana ---
  const ranking = useMemo(() => empleadoSemana(presencia, new Date()), [presencia]);
  const top = ranking[0] || null;

  // ---------- carga del progreso ----------
  useEffect(() => {
    if (!session) { setLoaded(true); return; }
    (async () => {
      const { mine } = await fetchJuego(session.email);
      if (mine) {
        setMonedas(mine.monedas || 0);
        setComprados(Array.isArray(mine.comprados) && mine.comprados.length ? mine.comprados : ['skin_azul', 'hat_none', 'pet_none', 'desk_gris']);
        setEquipado({ ...EQUIPADO_DEFAULT, ...(mine.equipado || {}) });
        setUltRecompensa(mine.ult_recompensa || null);
      }
      setLoaded(true);
    })();
  }, [session]);

  // ---------- recompensa por tiempo en el lab ----------
  const miPresencia = useMemo(
    () => presentes.find((p) => session && p.email === session.email) || null,
    [presentes, session]
  );

  const otorgar = useCallback(() => {
    if (!session || !miPresencia) return;
    const r = calcRecompensa(miPresencia, ultRecompensa, new Date());
    if (!r) return;
    setMonedas((m) => {
      const nm = m + r.monedas;
      saveJuego(session.email, { monedas: nm, comprados, equipado, ult_recompensa: r.nuevaMarca });
      return nm;
    });
    setUltRecompensa(r.nuevaMarca);
    setFlash(`+${r.monedas} 🪙`);
    setTimeout(() => setFlash(null), 2600);
  }, [session, miPresencia, ultRecompensa, comprados, equipado]);

  useEffect(() => {
    if (!loaded) return;
    otorgar();
    const iv = setInterval(otorgar, 60000);
    return () => clearInterval(iv);
  }, [loaded, otorgar]);

  // ---------- comprar / equipar ----------
  function comprar(item) {
    if (comprados.includes(item.id)) { equipar(item); return; }
    if (monedas < item.precio) { setFlash(t('game.notEnough')); setTimeout(() => setFlash(null), 1800); return; }
    const nm = monedas - item.precio;
    const nc = [...comprados, item.id];
    const ne = { ...equipado, [item.tipo]: item.id };
    setMonedas(nm); setComprados(nc); setEquipado(ne);
    if (session) saveJuego(session.email, { monedas: nm, comprados: nc, equipado: ne, ult_recompensa: ultRecompensa });
  }
  function equipar(item) {
    const ne = { ...equipado, [item.tipo]: item.id };
    setEquipado(ne);
    if (session) saveJuego(session.email, { monedas, comprados, equipado: ne, ult_recompensa: ultRecompensa });
  }

  // ---------- avatar: movimiento WASD ----------
  const [pos, setPos] = useState({ x: ROOM_W / 2, y: ROOM_H - 70 });
  const [dir, setDir] = useState('down');
  const keys = useRef({});
  const posRef = useRef(pos);
  posRef.current = pos;

  useEffect(() => {
    const isGameKey = (k) => ['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k);
    const down = (e) => {
      const k = e.key.toLowerCase();
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') return;
      if (isGameKey(k)) { keys.current[k] = true; e.preventDefault(); }
    };
    const up = (e) => { keys.current[e.key.toLowerCase()] = false; };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, []);

  useEffect(() => {
    const iv = setInterval(() => {
      const k = keys.current;
      let dx = 0, dy = 0;
      if (k['w'] || k['arrowup']) dy -= STEP;
      if (k['s'] || k['arrowdown']) dy += STEP;
      if (k['a'] || k['arrowleft']) dx -= STEP;
      if (k['d'] || k['arrowright']) dx += STEP;
      if (!dx && !dy) return;
      setDir(dy < 0 ? 'up' : dy > 0 ? 'down' : dx < 0 ? 'left' : 'right');
      setPos((p) => {
        let nx = clamp(p.x + dx, AV / 2 + 6, ROOM_W - AV / 2 - 6);
        let ny = clamp(p.y + dy, AV / 2 + 6, ROOM_H - AV / 2 - 6);
        // colisión con mobiliario (intenta ejes por separado para deslizar)
        if (hits(nx, p.y, obstaculos)) nx = p.x;
        if (hits(nx, ny, obstaculos)) ny = p.y;
        return { x: nx, y: ny };
      });
    }, 33);
    return () => clearInterval(iv);
  }, [obstaculos]);

  const skin = itemById(equipado.skin) || itemById('skin_azul');
  const hat = itemById(equipado.sombrero);
  const pet = itemById(equipado.mascota);
  const desk = itemById(equipado.escritorio) || itemById('desk_gris');

  return (
    <div>
      {/* HUD superior */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 12, padding: '8px 14px' }}>
          <span style={{ fontSize: 17 }}>🪙</span>
          <span style={{ fontSize: 16, fontWeight: 800, color: '#B45309' }}>{monedas}</span>
          {flash && <span style={{ marginLeft: 4, fontSize: 13, fontWeight: 800, color: '#16A34A', animation: 'gv-pop .3s ease' }}>{flash}</span>}
        </div>

        {/* empleado de la semana */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'linear-gradient(90deg,#FEF3C7,#FDE68A)', border: '1px solid #FCD34D', borderRadius: 12, padding: '7px 14px' }}>
          <span style={{ fontSize: 18 }}>🏆</span>
          <div>
            <div style={{ fontSize: 10.5, fontWeight: 700, color: '#92400E', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{t('game.employee')}</div>
            <div style={{ fontSize: 13.5, fontWeight: 800, color: '#78350F' }}>
              {top ? `${top.nombre} · ${t('game.hoursWeek', { h: (top.min / 60).toFixed(1) })}` : t('game.noEmployee')}
            </div>
          </div>
        </div>

        <button onClick={() => setShopOpen(true)} style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, padding: '9px 16px', borderRadius: 10, border: 'none', background: T.primary, color: '#fff', fontWeight: 700, fontSize: 13.5, cursor: 'pointer', fontFamily: T.font }}>
          🛍️ {t('game.shop')}
        </button>
      </div>

      {!miPresencia && (
        <div style={{ marginBottom: 12, padding: '9px 14px', background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 10, color: '#1D4ED8', fontSize: 12.5, fontWeight: 600 }}>
          {t('game.mustCheckin')}
        </div>
      )}

      {/* CUARTO */}
      <div style={{ position: 'relative', width: ROOM_W, maxWidth: '100%', aspectRatio: `${ROOM_W} / ${ROOM_H}`, margin: '0 auto', borderRadius: 14, overflow: 'hidden', border: '3px solid #1E293B', boxShadow: '0 10px 40px rgba(15,23,42,0.18)' }}>
        <div style={{ position: 'absolute', inset: 0, width: ROOM_W, height: ROOM_H, transformOrigin: 'top left' }} ref={useScaleToWidth(ROOM_W)}>
          {/* piso a cuadros */}
          <div style={{ position: 'absolute', inset: 0, background: `repeating-conic-gradient(${desk.color} 0% 25%, #F8FAFC 0% 50%) 0 0 / 48px 48px`, opacity: 0.55 }} />
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(255,255,255,0.25), rgba(15,23,42,0.06))' }} />

          {/* mobiliario (mesas del croquis) */}
          {obstaculos.map((o) => (
            <div key={o.id} title={o.nombre} style={{
              position: 'absolute', left: o.x, top: o.y, width: o.w, height: o.h,
              background: o.color, border: '2px solid rgba(15,23,42,0.35)', borderRadius: o.kind === 'mesa' ? 6 : 4,
              boxShadow: 'inset 0 -4px 0 rgba(0,0,0,0.12), 0 3px 0 rgba(15,23,42,0.18)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <span style={{ fontSize: 10, fontWeight: 800, color: 'rgba(15,23,42,0.6)', textShadow: '0 1px 0 rgba(255,255,255,0.5)', pointerEvents: 'none' }}>{o.nombre}</span>
            </div>
          ))}

          {/* avatares dormidos (otras personas presentes) */}
          {presentes.filter((p) => !(session && p.email === session.email)).map((p, i) => {
            const spot = spotForMesa(p.mesa, obstaculos, i);
            return (
              <div key={p.id} style={{ position: 'absolute', left: spot.x - AV / 2, top: spot.y - AV / 2 }}>
                <PixelAvatar skin="#94A3B8" hat={null} sleeping name={p.nombre} />
              </div>
            );
          })}

          {/* mascota (sigue al jugador) */}
          {pet && pet.color !== 'transparent' && (
            <div style={{ position: 'absolute', left: pos.x - AV / 2 - 16, top: pos.y + 2, transition: 'left .12s linear, top .12s linear' }}>
              <Pet color={pet.color} kind={pet.id} />
            </div>
          )}

          {/* jugador */}
          <div style={{ position: 'absolute', left: pos.x - AV / 2, top: pos.y - AV / 2 - 8 }}>
            <PixelAvatar skin={skin.color} hat={hat && hat.color !== 'transparent' ? hat : null} dir={dir} name={session ? session.nombre : t('game.you')} you />
          </div>
        </div>
      </div>

      <p style={{ textAlign: 'center', fontSize: 12.5, color: T.muted, marginTop: 12 }}>
        ⌨️ {t('game.move')} · {t('game.earnHint')}
      </p>

      {shopOpen && (
        <Shop t={t} monedas={monedas} comprados={comprados} equipado={equipado} onBuy={comprar} onClose={() => setShopOpen(false)} />
      )}

      <style>{`@keyframes gv-pop{0%{transform:scale(.6);opacity:0}100%{transform:scale(1);opacity:1}}
        @keyframes gv-z{0%,100%{transform:translateY(0);opacity:.5}50%{transform:translateY(-4px);opacity:1}}
        @keyframes gv-bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-2px)}}`}</style>
    </div>
  );
}

/* ---------- TIENDA ---------- */
function Shop({ t, monedas, comprados, equipado, onBuy, onClose }) {
  const grupos = [
    ['skin', '👕 ' + 'Ropa'],
    ['sombrero', '🎩 ' + 'Sombreros'],
    ['mascota', '🐾 ' + t('game.pets')],
    ['escritorio', '🟦 ' + 'Tapetes'],
  ];
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', zIndex: 500, display: 'grid', placeItems: 'center', padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 560, maxHeight: '86vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '18px 22px', borderBottom: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ fontSize: 18, fontWeight: 800, color: T.ink, margin: 0 }}>🛍️ {t('game.shop')}</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 14, fontWeight: 800, color: '#B45309', background: '#FFFBEB', border: '1px solid #FDE68A', padding: '5px 12px', borderRadius: 20 }}>🪙 {monedas}</span>
            <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 8, border: `1px solid ${T.border}`, background: '#fff', cursor: 'pointer', fontSize: 15, color: T.muted }}>✕</button>
          </div>
        </div>
        <div style={{ padding: '16px 22px 22px', overflowY: 'auto' }}>
          {grupos.map(([tipo, titulo]) => (
            <div key={tipo} style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 11.5, fontWeight: 700, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 9 }}>{titulo}</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px,1fr))', gap: 10 }}>
                {TIENDA.filter((i) => i.tipo === tipo).map((item) => {
                  const owned = comprados.includes(item.id);
                  const eq = equipado[item.tipo] === item.id;
                  return (
                    <button key={item.id} onClick={() => onBuy(item)} style={{
                      textAlign: 'left', padding: 11, borderRadius: 11, cursor: 'pointer', fontFamily: T.font,
                      border: `2px solid ${eq ? T.primary : T.border}`, background: eq ? T.primarySoft : '#fff',
                      display: 'flex', flexDirection: 'column', gap: 8,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ width: 22, height: 22, borderRadius: 6, background: item.color === 'transparent' ? '#fff' : item.color, border: '1px solid rgba(15,23,42,0.2)', flexShrink: 0 }} />
                        <span style={{ fontSize: 12.5, fontWeight: 700, color: T.ink, lineHeight: 1.2 }}>{item.nombre}</span>
                      </div>
                      <span style={{ fontSize: 11.5, fontWeight: 700, color: eq ? T.primary : owned ? '#16A34A' : '#B45309' }}>
                        {eq ? '✓ ' + t('game.equipped') : owned ? t('game.equip') : (item.precio === 0 ? t('game.equip') : '🪙 ' + item.precio)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ---------- avatar pixelado ---------- */
function PixelAvatar({ skin, hat, dir = 'down', name, sleeping, you }) {
  const eyeX = dir === 'left' ? 3 : dir === 'right' ? 7 : 5;
  return (
    <div style={{ width: AV, position: 'relative', textAlign: 'center', animation: you ? 'gv-bob 1.6s ease-in-out infinite' : 'none' }}>
      {sleeping && <span style={{ position: 'absolute', top: -12, right: -4, fontSize: 11, animation: 'gv-z 1.8s ease-in-out infinite' }}>💤</span>}
      {/* sombra */}
      <div style={{ position: 'absolute', bottom: -3, left: '50%', transform: 'translateX(-50%)', width: 18, height: 5, background: 'rgba(15,23,42,0.22)', borderRadius: '50%' }} />
      {/* sombrero */}
      {hat && <div style={{ width: 16, height: 6, background: hat.color, margin: '0 auto -1px', borderRadius: '3px 3px 0 0', border: '1px solid rgba(15,23,42,0.3)' }} />}
      {/* cabeza */}
      <div style={{ width: 15, height: 13, background: '#F2C9A0', border: '2px solid #11203a', borderRadius: 5, margin: '0 auto', position: 'relative', imageRendering: 'pixelated' }}>
        {!sleeping ? (
          <>
            <span style={{ position: 'absolute', top: 4, left: eyeX, width: 2, height: 2, background: '#11203a' }} />
            <span style={{ position: 'absolute', top: 4, left: eyeX + 4, width: 2, height: 2, background: '#11203a' }} />
          </>
        ) : (
          <span style={{ position: 'absolute', top: 6, left: 4, right: 4, height: 2, borderTop: '2px solid #11203a' }} />
        )}
      </div>
      {/* cuerpo (bata = skin) */}
      <div style={{ width: 19, height: 14, background: skin, border: '2px solid #11203a', borderRadius: '4px 4px 5px 5px', margin: '-1px auto 0' }} />
      {/* nombre */}
      <div style={{ fontSize: 9, fontWeight: 800, color: you ? '#0F172A' : '#475569', marginTop: 1, whiteSpace: 'nowrap', textShadow: '0 1px 0 rgba(255,255,255,0.8)' }}>{(name || '').split(' ')[0]}</div>
    </div>
  );
}

function Pet({ color, kind }) {
  const face = kind === 'pet_cat' ? '🐱' : kind === 'pet_robot' ? '🤖' : kind === 'pet_chip' ? '🔲' : '●';
  return (
    <div style={{ width: 16, height: 16, display: 'grid', placeItems: 'center', fontSize: 13, animation: 'gv-bob 1.1s ease-in-out infinite' }}>
      <span style={{ filter: 'drop-shadow(0 1px 0 rgba(15,23,42,0.25))' }}>{face}</span>
    </div>
  );
}

/* ---------- helpers de mapeo ---------- */
function mapMesas(mesas) {
  const items = (mesas || []).filter((m) => m && typeof m.x === 'number' && typeof m.y === 'number');
  if (items.length === 0) return [];
  const minX = Math.min(...items.map((m) => m.x));
  const minY = Math.min(...items.map((m) => m.y));
  const maxX = Math.max(...items.map((m) => m.x + (m.w || 100)));
  const maxY = Math.max(...items.map((m) => m.y + (m.h || 48)));
  const sx = (ROOM_W - PAD * 2) / Math.max(1, maxX - minX);
  const sy = (ROOM_H - PAD * 2) / Math.max(1, maxY - minY);
  const s = Math.min(sx, sy);
  return items.map((m) => ({
    id: m.id, nombre: m.nombre, kind: m.kind,
    x: PAD + (m.x - minX) * s, y: PAD + (m.y - minY) * s,
    w: Math.max(20, (m.w || 100) * s), h: Math.max(16, (m.h || 48) * s),
    color: m.kind === 'mesa' ? (m.color && m.color !== '#ffffff' ? m.color : '#CDB793') : (m.color || '#94A3B8'),
  }));
}

function spotForMesa(mesaId, obstaculos, i) {
  const o = obstaculos.find((x) => x.id === mesaId);
  if (o) return { x: o.x + o.w / 2, y: o.y + o.h + 16 };
  return { x: 60 + (i % 6) * 40, y: 60 + Math.floor(i / 6) * 44 };
}

function hits(cx, cy, obstaculos) {
  const half = AV / 2 - 2;
  const l = cx - half, r = cx + half, tp = cy - half, b = cy + half;
  return obstaculos.some((o) => r > o.x && l < o.x + o.w && b > o.y && tp < o.y + o.h);
}

function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

// Escala el cuarto (de ancho fijo ROOM_W) al ancho real del contenedor.
function useScaleToWidth(designW) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const parent = el.parentElement;
    const apply = () => {
      const w = parent.clientWidth;
      const s = w / designW;
      el.style.transform = `scale(${s})`;
    };
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(parent);
    return () => ro.disconnect();
  }, [designW]);
  return ref;
}
