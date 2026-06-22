/* =====================================================================
   GameView.jsx — Laboratorio virtual (mapa tipo Habbo)
   ---------------------------------------------------------------------
   Réplica EXACTA del croquis (lienzo 880×500). Muévete con WASD; las
   mesas y módulos son el mobiliario y las sillas del croquis son asientos
   donde aparecen, "dormidas" (💤), las personas con check-in abierto.
   Ganas 10 monedas por cada 30 min dentro del lab. La tienda es el OXXO
   de la puerta: acércate a la salida (derecha) para comprar.
   Personalización gratuita: pelo, color de pelo y tono de piel.
   Solo se juega en computadora/laptop (requiere teclado).
   ===================================================================== */

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useLab } from '../context/LabContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useLang } from '../context/LangContext.jsx';
import { STAGE_W, STAGE_H, SEAT } from '../lib/lab-layout.js';
import {
  TIENDA, EQUIPADO_DEFAULT, PELOS, PIELES, PELO_COLORES, itemById,
  fetchJuego, saveJuego, calcRecompensa, empleadoSemana,
} from '../lib/game.js';
import { T } from '../theme.js';

const STEP = 9, AV = 30;
const DOOR = { x: STAGE_W - 40, y: 14, w: 40, h: 96 }; // zona OXXO (pared derecha)

export default function GameView() {
  const lab = useLab();
  const { session } = useAuth();
  const { t } = useLang();
  const { mesas, presentes, presencia, presentesPorMesa, ensureLoaded, nombreDe } = lab;

  useEffect(() => { ensureLoaded(); }, [ensureLoaded]);

  // --- ¿móvil? el juego requiere teclado ---
  const isMobile = useMemo(() => {
    if (typeof window === 'undefined') return false;
    const coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    const touch = ('ontouchstart' in window) && (navigator.maxTouchPoints || 0) > 0;
    return (coarse && touch) || window.innerWidth < 820;
  }, []);

  // --- progreso ---
  const [monedas, setMonedas] = useState(0);
  const [comprados, setComprados] = useState(['out_bata', 'hat_none', 'pet_none', 'desk_gris', 'aura_none']);
  const [equipado, setEquipado] = useState(EQUIPADO_DEFAULT);
  const [ultRecompensa, setUltRecompensa] = useState(null);
  const [shopOpen, setShopOpen] = useState(false);
  const [custOpen, setCustOpen] = useState(false);
  const [flash, setFlash] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [atDoor, setAtDoor] = useState(false);

  const ranking = useMemo(() => empleadoSemana(presencia, new Date()), [presencia]);
  const topEmp = ranking[0] || null;

  // ---------- carga ----------
  useEffect(() => {
    if (!session) { setLoaded(true); return; }
    (async () => {
      const { mine } = await fetchJuego(session.email);
      if (mine) {
        setMonedas(mine.monedas || 0);
        setComprados(Array.isArray(mine.comprados) && mine.comprados.length ? mine.comprados : ['out_bata', 'hat_none', 'pet_none', 'desk_gris', 'aura_none']);
        setEquipado({ ...EQUIPADO_DEFAULT, ...(mine.equipado || {}) });
        setUltRecompensa(mine.ult_recompensa || null);
      }
      setLoaded(true);
    })();
  }, [session]);

  const persist = useCallback((patch) => {
    if (session) saveJuego(session.email, { monedas, comprados, equipado, ult_recompensa: ultRecompensa, ...patch });
  }, [session, monedas, comprados, equipado, ultRecompensa]);

  // ---------- recompensa por tiempo en el lab ----------
  const miPresencia = useMemo(
    () => presentes.find((p) => session && p.email === session.email) || null,
    [presentes, session]
  );
  const otorgar = useCallback(() => {
    if (!session || !miPresencia) return;
    const r = calcRecompensa(miPresencia, ultRecompensa, new Date());
    if (!r) return;
    setMonedas((m) => { const nm = m + r.monedas; saveJuego(session.email, { monedas: nm, comprados, equipado, ult_recompensa: r.nuevaMarca }); return nm; });
    setUltRecompensa(r.nuevaMarca);
    setFlash(`+${r.monedas} 🪙`); setTimeout(() => setFlash(null), 2600);
  }, [session, miPresencia, ultRecompensa, comprados, equipado]);
  useEffect(() => {
    if (!loaded || isMobile) return;
    otorgar();
    const iv = setInterval(otorgar, 60000);
    return () => clearInterval(iv);
  }, [loaded, isMobile, otorgar]);

  // ---------- comprar / equipar / personalizar ----------
  function comprar(item) {
    if (comprados.includes(item.id)) return equipar(item);
    if (monedas < item.precio) { setFlash(t('game.notEnough')); setTimeout(() => setFlash(null), 1800); return; }
    const nm = monedas - item.precio, nc = [...comprados, item.id], ne = { ...equipado, [item.tipo]: item.id };
    setMonedas(nm); setComprados(nc); setEquipado(ne); persist({ monedas: nm, comprados: nc, equipado: ne });
  }
  function equipar(item) { const ne = { ...equipado, [item.tipo]: item.id }; setEquipado(ne); persist({ equipado: ne }); }
  function setLook(patch) { const ne = { ...equipado, ...patch }; setEquipado(ne); persist({ equipado: ne }); }

  // ---------- avatar WASD ----------
  const [pos, setPos] = useState({ x: STAGE_W / 2, y: STAGE_H - 40 });
  const [dir, setDir] = useState('down');
  const keys = useRef({});
  const obstaculos = useMemo(() => (mesas || []).filter((m) => m && typeof m.x === 'number'), [mesas]);

  useEffect(() => {
    if (isMobile) return;
    const game = (k) => ['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k);
    const down = (e) => {
      const tag = e.target.tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
      const k = e.key.toLowerCase();
      if (game(k)) { keys.current[k] = true; e.preventDefault(); }
    };
    const up = (e) => { keys.current[e.key.toLowerCase()] = false; };
    window.addEventListener('keydown', down); window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, [isMobile]);

  useEffect(() => {
    if (isMobile) return;
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
        let nx = clamp(p.x + dx, AV / 2, STAGE_W - AV / 2);
        let ny = clamp(p.y + dy, AV / 2, STAGE_H - AV / 2);
        if (hits(nx, p.y, obstaculos)) nx = p.x;
        if (hits(nx, ny, obstaculos)) ny = p.y;
        const near = nx > DOOR.x - 26 && ny > DOOR.y - 10 && ny < DOOR.y + DOOR.h + 10;
        setAtDoor(near);
        return { x: nx, y: ny };
      });
    }, 33);
    return () => clearInterval(iv);
  }, [obstaculos, isMobile]);

  // abrir OXXO al tocar la puerta
  useEffect(() => { if (atDoor && !shopOpen) setShopOpen(true); }, [atDoor]); // eslint-disable-line

  // ---------- asientos ocupados ----------
  const seatPeople = useMemo(() => {
    const out = [];
    (mesas || []).forEach((m) => {
      if (!m.seats) return;
      const onSeats = m.seats.filter((s) => s.on);
      const occ = (presentesPorMesa[m.id] || []).filter((p) => !(session && p.email === session.email));
      onSeats.forEach((s, i) => {
        const person = occ[i] || null;
        out.push({ key: m.id + '-' + i, x: m.x + s.dx + SEAT / 2, y: m.y + s.dy + SEAT / 2, person });
      });
    });
    return out;
  }, [mesas, presentesPorMesa, session]);

  const look = {
    piel: equipado.piel, pelo: equipado.pelo, peloColor: equipado.pelo_color,
    outfit: itemById(equipado.outfit) || itemById('out_bata'),
    sombrero: itemById(equipado.sombrero),
    aura: itemById(equipado.aura),
  };
  const pet = itemById(equipado.mascota);
  const desk = itemById(equipado.escritorio) || itemById('desk_gris');

  // ----------------- MÓVIL: bloqueo -----------------
  if (isMobile) {
    return (
      <div style={{ maxWidth: 520, margin: '24px auto', textAlign: 'center', background: '#fff', border: `1px solid ${T.border}`, borderRadius: 16, padding: 32 }}>
        <div style={{ fontSize: 40, marginBottom: 10 }}>🖥️</div>
        <h2 style={{ fontSize: 18, fontWeight: 800, color: T.ink, margin: '0 0 8px' }}>{t('game.title')}</h2>
        <p style={{ fontSize: 13.5, color: T.muted, lineHeight: 1.55, margin: 0 }}>{t('game.desktopOnly')}</p>
      </div>
    );
  }

  return (
    <div>
      {/* HUD */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 12, padding: '8px 14px' }}>
          <span style={{ fontSize: 17 }}>🪙</span>
          <span style={{ fontSize: 16, fontWeight: 800, color: '#B45309' }}>{monedas}</span>
          {flash && <span style={{ marginLeft: 4, fontSize: 13, fontWeight: 800, color: '#16A34A', animation: 'gv-pop .3s ease' }}>{flash}</span>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'linear-gradient(90deg,#FEF3C7,#FDE68A)', border: '1px solid #FCD34D', borderRadius: 12, padding: '7px 14px' }}>
          <span style={{ fontSize: 18 }}>🏆</span>
          <div>
            <div style={{ fontSize: 10.5, fontWeight: 700, color: '#92400E', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{t('game.employee')}</div>
            <div style={{ fontSize: 13.5, fontWeight: 800, color: '#78350F' }}>
              {topEmp ? `${nombreDe ? nombreDe(topEmp.email) : topEmp.nombre} · ${t('game.hoursWeek', { h: (topEmp.min / 60).toFixed(1) })}` : t('game.noEmployee')}
            </div>
          </div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button onClick={() => setCustOpen(true)} style={btnHud('#fff', T.ink, T.border)}>🎨 {t('game.customize')}</button>
          <button onClick={() => setShopOpen(true)} style={btnHud('#DA291C', '#fff', '#DA291C')}>🏪 OXXO</button>
        </div>
      </div>

      {!miPresencia && (
        <div style={{ marginBottom: 12, padding: '9px 14px', background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 10, color: '#1D4ED8', fontSize: 12.5, fontWeight: 600 }}>
          {t('game.mustCheckin')}
        </div>
      )}

      {/* CUARTO — réplica del croquis */}
      <div ref={useScaleToWidth(STAGE_W)} style={{ position: 'relative', margin: '0 auto' }}>
        <div style={{
          position: 'absolute', top: 0, left: 0, width: STAGE_W, height: STAGE_H, transformOrigin: 'top left',
          borderRadius: 6, border: '3px solid #CBD5E1',
          backgroundColor: '#F4F6FA', overflow: 'hidden',
          backgroundImage: 'linear-gradient(#EAEEF4 1px,transparent 1px),linear-gradient(90deg,#EAEEF4 1px,transparent 1px)',
          backgroundSize: '32px 32px',
        }}>
          {/* tapete del jugador (piso comprado) */}
          <div style={{ position: 'absolute', inset: 0, background: desk.color, opacity: 0.12, pointerEvents: 'none' }} />

          {/* OXXO en la puerta (pared derecha) */}
          <div style={{ position: 'absolute', left: DOOR.x, top: DOOR.y, width: DOOR.w, height: DOOR.h, background: '#DA291C', borderRadius: '6px 0 0 6px', border: '2px solid #B71C12', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, boxShadow: 'inset 0 0 0 3px #FFC72C' }}>
            <span style={{ fontSize: 9, fontWeight: 900, color: '#fff', letterSpacing: '0.05em', writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>OXXO</span>
          </div>
          <div style={{ position: 'absolute', left: DOOR.x - 30, top: DOOR.y + DOOR.h / 2 - 8, fontSize: 10, fontWeight: 700, color: '#B71C12', textAlign: 'right', width: 28, lineHeight: 1.1 }}>Tienda →</div>

          {/* mobiliario */}
          {(mesas || []).map((m) => <Furniture key={m.id} m={m} />)}

          {/* asientos + personas dormidas */}
          {seatPeople.map((s) => (
            <div key={s.key} style={{ position: 'absolute', left: s.x - SEAT / 2, top: s.y - SEAT / 2 }}>
              <Chair />
              {s.person && (
                <div style={{ position: 'absolute', left: SEAT / 2 - AV / 2, top: -AV + 4 }}>
                  <Avatar look={sleeperLook(s.person)} sitting sleeping name={nombreDe ? nombreDe(s.person.email) : s.person.nombre} />
                </div>
              )}
            </div>
          ))}

          {/* mascota */}
          {pet && pet.color !== 'transparent' && (
            <div style={{ position: 'absolute', left: pos.x - AV / 2 - 18, top: pos.y + 4, transition: 'left .12s linear, top .12s linear' }}>
              <Pet color={pet.color} kind={pet.id} />
            </div>
          )}

          {/* jugador */}
          <div style={{ position: 'absolute', left: pos.x - AV / 2, top: pos.y - AV / 2 - 10, zIndex: 5 }}>
            <Avatar look={look} dir={dir} name={session ? (nombreDe ? nombreDe(session.email) : session.nombre) : t('game.you')} you />
          </div>
        </div>
      </div>

      <p style={{ textAlign: 'center', fontSize: 12.5, color: T.muted, marginTop: 12 }}>
        ⌨️ {t('game.move')} · {t('game.earnHint')} · 🏪 {t('game.shopHint')}
      </p>

      {shopOpen && <OxxoShop t={t} monedas={monedas} comprados={comprados} equipado={equipado} onBuy={comprar} onClose={() => { setShopOpen(false); setPos((p) => ({ ...p, x: DOOR.x - 40 })); setAtDoor(false); }} />}
      {custOpen && <Customizer t={t} equipado={equipado} onLook={setLook} onClose={() => setCustOpen(false)} />}

      <style>{`@keyframes gv-pop{0%{transform:scale(.6);opacity:0}100%{transform:scale(1);opacity:1}}
        @keyframes gv-z{0%,100%{transform:translateY(0);opacity:.5}50%{transform:translateY(-4px);opacity:1}}
        @keyframes gv-bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-2px)}}
        @keyframes gv-aura{0%,100%{transform:scale(1);opacity:.5}50%{transform:scale(1.15);opacity:.85}}`}</style>
    </div>
  );
}

/* ---------- mobiliario (replica el croquis) ---------- */
function Furniture({ m }) {
  const esMesa = m.kind === 'mesa';
  const fill = esMesa ? (m.color && m.color !== '#ffffff' ? m.color : '#D8C19A') : (m.color || '#94A3B8');
  const isL = m.forma === 'L';
  return (
    <div title={m.nombre} style={{
      position: 'absolute', left: m.x, top: m.y, width: m.w, height: m.h,
      background: fill, border: '2px solid rgba(15,23,42,0.4)', borderRadius: esMesa ? 5 : 4,
      boxShadow: 'inset 0 -5px 0 rgba(0,0,0,0.14), 0 3px 0 rgba(15,23,42,0.18)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      clipPath: isL ? 'polygon(0 0, 62% 0, 62% 55%, 100% 55%, 100% 100%, 0 100%)' : 'none',
    }}>
      <span style={{ fontSize: 10, fontWeight: 800, color: esMesa ? 'rgba(15,23,42,0.62)' : 'rgba(255,255,255,0.92)', textShadow: esMesa ? '0 1px 0 rgba(255,255,255,0.4)' : '0 1px 1px rgba(0,0,0,0.3)', pointerEvents: 'none', padding: 2, textAlign: 'center' }}>{m.nombre}</span>
    </div>
  );
}

function Chair() {
  return (
    <div style={{ width: SEAT, height: SEAT, borderRadius: '50%', background: '#475569', border: '2px solid #1E293B', boxShadow: 'inset 0 -3px 0 rgba(0,0,0,0.2)' }} />
  );
}

/* ---------- avatar detallado por capas (Habbo) ---------- */
function Avatar({ look, dir = 'down', name, sleeping, sitting, you }) {
  const piel = look.piel || '#F2C9A0';
  const peloColor = look.peloColor || '#3B2A20';
  const outfit = look.outfit || { color: '#E5E7EB', acento: '#94A3B8' };
  const eyeX = dir === 'left' ? 3 : dir === 'right' ? 7 : 5;
  return (
    <div style={{ width: AV, position: 'relative', textAlign: 'center', animation: you ? 'gv-bob 1.5s ease-in-out infinite' : 'none' }}>
      {/* aura */}
      {look.aura && look.aura.color !== 'transparent' && (
        <div style={{ position: 'absolute', left: '50%', top: 12, transform: 'translateX(-50%)', width: 30, height: 30, borderRadius: '50%', background: look.aura.color, filter: 'blur(5px)', opacity: 0.6, animation: 'gv-aura 1.8s ease-in-out infinite' }} />
      )}
      {sleeping && <span style={{ position: 'absolute', top: -12, right: -2, fontSize: 11, animation: 'gv-z 1.8s ease-in-out infinite', zIndex: 3 }}>💤</span>}
      <div style={{ position: 'absolute', bottom: -2, left: '50%', transform: 'translateX(-50%)', width: 20, height: 5, background: 'rgba(15,23,42,0.22)', borderRadius: '50%' }} />

      {/* sombrero */}
      {look.sombrero && look.sombrero.color !== 'transparent' && <Hat item={look.sombrero} />}
      {/* pelo (detrás cuando es largo) */}
      <Hair style={look.pelo} color={peloColor} />
      {/* cabeza */}
      <div style={{ position: 'relative', width: 16, height: 14, background: piel, border: '2px solid #11203a', borderRadius: 6, margin: '-2px auto 0', zIndex: 2 }}>
        {!sleeping ? (
          <>
            <span style={{ position: 'absolute', top: 5, left: eyeX, width: 2.4, height: 2.4, background: '#11203a', borderRadius: '50%' }} />
            <span style={{ position: 'absolute', top: 5, left: eyeX + 4.5, width: 2.4, height: 2.4, background: '#11203a', borderRadius: '50%' }} />
            <span style={{ position: 'absolute', top: 9.5, left: 6, width: 4, height: 1.6, background: 'rgba(180,90,90,0.6)', borderRadius: 2 }} />
          </>
        ) : (
          <span style={{ position: 'absolute', top: 7, left: 4, right: 4, height: 2, borderTop: '2px solid #11203a' }} />
        )}
      </div>
      {/* cuello */}
      <div style={{ width: 6, height: 2, background: piel, margin: '-1px auto 0' }} />
      {/* cuerpo (outfit) */}
      <div style={{ position: 'relative', width: 22, height: sitting ? 12 : 16, background: outfit.color, border: '2px solid #11203a', borderRadius: '5px 5px 6px 6px', margin: '0 auto', zIndex: 1 }}>
        {/* cierre / acento */}
        <span style={{ position: 'absolute', top: 1, bottom: 1, left: '50%', transform: 'translateX(-50%)', width: 2, background: outfit.acento, opacity: 0.8 }} />
        {/* brazos */}
        <span style={{ position: 'absolute', top: 1, left: -4, width: 4, height: sitting ? 8 : 11, background: outfit.color, border: '2px solid #11203a', borderRadius: 3 }} />
        <span style={{ position: 'absolute', top: 1, right: -4, width: 4, height: sitting ? 8 : 11, background: outfit.color, border: '2px solid #11203a', borderRadius: 3 }} />
      </div>
      {/* piernas (de pie) */}
      {!sitting && (
        <div style={{ display: 'flex', gap: 3, justifyContent: 'center', marginTop: -1 }}>
          <span style={{ width: 6, height: 6, background: '#1F2937', border: '2px solid #11203a', borderRadius: '0 0 3px 3px' }} />
          <span style={{ width: 6, height: 6, background: '#1F2937', border: '2px solid #11203a', borderRadius: '0 0 3px 3px' }} />
        </div>
      )}
      <div style={{ fontSize: 9, fontWeight: 800, color: you ? '#0F172A' : '#475569', marginTop: 2, whiteSpace: 'nowrap', textShadow: '0 1px 0 rgba(255,255,255,0.85)' }}>{(name || '').split(' ')[0]}</div>
    </div>
  );
}

function Hair({ style, color }) {
  if (style === 'pelo_none') return null;
  const base = { position: 'relative', margin: '0 auto', zIndex: 3 };
  if (style === 'pelo_largo')
    return <div style={{ ...base, width: 20, height: 9, background: color, borderRadius: '9px 9px 3px 3px', boxShadow: `0 9px 0 -2px ${color}, 0 13px 0 -4px ${color}` }} />;
  if (style === 'pelo_chongo')
    return <div style={{ ...base, width: 17, height: 7, background: color, borderRadius: '8px 8px 2px 2px' }}><span style={{ position: 'absolute', top: -5, left: '50%', transform: 'translateX(-50%)', width: 7, height: 7, background: color, borderRadius: '50%' }} /></div>;
  if (style === 'pelo_afro')
    return <div style={{ ...base, width: 24, height: 14, background: color, borderRadius: '50%', marginBottom: -4 }} />;
  if (style === 'pelo_punk')
    return <div style={{ ...base, width: 17, height: 6, background: color, borderRadius: '6px 6px 0 0' }}><span style={{ position: 'absolute', top: -6, left: '50%', transform: 'translateX(-50%)', width: 4, height: 7, background: color, borderRadius: 2 }} /></div>;
  // corto (default)
  return <div style={{ ...base, width: 18, height: 7, background: color, borderRadius: '8px 8px 2px 2px' }} />;
}

function Hat({ item }) {
  const c = item.color;
  if (item.id === 'hat_grad')
    return <div style={{ position: 'relative', margin: '0 auto', zIndex: 4 }}><div style={{ width: 22, height: 4, background: c, margin: '0 auto', borderRadius: 1 }} /><div style={{ width: 11, height: 5, background: c, margin: '-1px auto 0', borderRadius: '0 0 2px 2px' }} /></div>;
  if (item.id === 'hat_crown')
    return <div style={{ width: 16, height: 7, margin: '0 auto', zIndex: 4, position: 'relative', background: c, clipPath: 'polygon(0 100%, 0 40%, 20% 70%, 40% 20%, 50% 60%, 60% 20%, 80% 70%, 100% 40%, 100% 100%)' }} />;
  if (item.id === 'hat_cap')
    return <div style={{ position: 'relative', margin: '0 auto', zIndex: 4, width: 16, height: 6, background: c, borderRadius: '6px 6px 0 0' }}><span style={{ position: 'absolute', bottom: 0, left: 14, width: 8, height: 3, background: c, borderRadius: '0 3px 3px 0' }} /></div>;
  if (item.id === 'hat_safety')
    return <div style={{ width: 18, height: 8, margin: '0 auto', zIndex: 4, position: 'relative', background: c, borderRadius: '9px 9px 0 0' }}><span style={{ position: 'absolute', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: 2, height: 8, background: 'rgba(0,0,0,0.2)' }} /></div>;
  // beanie u otros
  return <div style={{ width: 17, height: 7, margin: '0 auto', zIndex: 4, background: c, borderRadius: '7px 7px 0 0' }} />;
}

function Pet({ color, kind }) {
  const face = kind === 'pet_cat' ? '🐱' : kind === 'pet_dog' ? '🐶' : kind === 'pet_robot' ? '🤖' : kind === 'pet_drone' ? '🛸' : kind === 'pet_chip' ? '🔲' : '●';
  return <div style={{ width: 18, height: 18, display: 'grid', placeItems: 'center', fontSize: 15, animation: 'gv-bob 1.1s ease-in-out infinite', filter: 'drop-shadow(0 1px 0 rgba(15,23,42,0.25))' }}>{face}</div>;
}

/* ---------- OXXO (tienda) ---------- */
function OxxoShop({ t, monedas, comprados, equipado, onBuy, onClose }) {
  const grupos = [
    ['outfit', '👕 ' + t('game.outfits')],
    ['sombrero', '🎩 ' + t('game.hats')],
    ['mascota', '🐾 ' + t('game.pets')],
    ['escritorio', '🟫 ' + t('game.floors')],
    ['aura', '✨ ' + t('game.auras')],
  ];
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', zIndex: 500, display: 'grid', placeItems: 'center', padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 600, maxHeight: '88vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', border: '3px solid #DA291C' }}>
        <div style={{ background: '#DA291C', padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: 'inset 0 -4px 0 #FFC72C' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 20 }}>🏪</span>
            <h2 style={{ fontSize: 19, fontWeight: 900, color: '#fff', margin: 0, letterSpacing: '0.06em' }}>OXXO</h2>
            <span style={{ fontSize: 11, color: '#FFE08A', fontWeight: 700 }}>{t('game.shop')}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 14, fontWeight: 800, color: '#7F1D1D', background: '#FFC72C', padding: '5px 12px', borderRadius: 20 }}>🪙 {monedas}</span>
            <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid rgba(255,255,255,0.5)', background: 'rgba(255,255,255,0.15)', cursor: 'pointer', fontSize: 15, color: '#fff' }}>✕</button>
          </div>
        </div>
        <div style={{ padding: '16px 22px 22px', overflowY: 'auto' }}>
          {grupos.map(([tipo, titulo]) => (
            <div key={tipo} style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 11.5, fontWeight: 700, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 9 }}>{titulo}</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(124px,1fr))', gap: 10 }}>
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
                        <span style={{ width: 22, height: 22, borderRadius: 6, background: item.color === 'transparent' ? 'repeating-linear-gradient(45deg,#fff,#fff 3px,#E2E8F0 3px,#E2E8F0 6px)' : item.color, border: '1px solid rgba(15,23,42,0.2)', flexShrink: 0 }} />
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

/* ---------- personalización gratuita ---------- */
function Customizer({ t, equipado, onLook, onClose }) {
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', zIndex: 500, display: 'grid', placeItems: 'center', padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 460, maxHeight: '86vh', overflow: 'auto', padding: '20px 22px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <h2 style={{ fontSize: 18, fontWeight: 800, color: T.ink, margin: 0 }}>🎨 {t('game.customize')}</h2>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 8, border: `1px solid ${T.border}`, background: '#fff', cursor: 'pointer', fontSize: 15, color: T.muted }}>✕</button>
        </div>
        <p style={{ fontSize: 12, color: T.muted, margin: '0 0 16px' }}>{t('game.free')} · {t('game.previewHint')}</p>

        {/* vista previa */}
        <div style={{ display: 'grid', placeItems: 'center', padding: '14px 0 22px', background: '#F8FAFC', borderRadius: 12, marginBottom: 16 }}>
          <Avatar look={{ piel: equipado.piel, pelo: equipado.pelo, peloColor: equipado.pelo_color, outfit: itemById(equipado.outfit) || itemById('out_bata'), sombrero: itemById(equipado.sombrero), aura: itemById(equipado.aura) }} name="" you />
        </div>

        <Group label={t('game.hair')}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {PELOS.map((p) => (
              <button key={p.id} onClick={() => onLook({ pelo: p.id })} style={chipBtn(equipado.pelo === p.id)}>{p.nombre}</button>
            ))}
          </div>
        </Group>
        <Group label={t('game.hairColor')}>
          <Swatches values={PELO_COLORES} active={equipado.pelo_color} onPick={(c) => onLook({ pelo_color: c })} />
        </Group>
        <Group label={t('game.skin')}>
          <Swatches values={PIELES} active={equipado.piel} onPick={(c) => onLook({ piel: c })} />
        </Group>
      </div>
    </div>
  );
}

function Group({ label, children }) {
  return <div style={{ marginBottom: 16 }}><div style={{ fontSize: 11.5, fontWeight: 700, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>{label}</div>{children}</div>;
}
function Swatches({ values, active, onPick }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
      {values.map((c) => (
        <button key={c} onClick={() => onPick(c)} title={c} style={{ width: 30, height: 30, borderRadius: 8, background: c, cursor: 'pointer', border: `3px solid ${active === c ? T.primary : 'rgba(15,23,42,0.15)'}` }} />
      ))}
    </div>
  );
}
const chipBtn = (on) => ({ padding: '7px 12px', borderRadius: 8, cursor: 'pointer', fontSize: 12.5, fontWeight: 600, fontFamily: T.font, border: `1px solid ${on ? T.primary : T.border}`, background: on ? T.primarySoft : '#fff', color: on ? T.primary : '#475569' });
const btnHud = (bg, fg, bd) => ({ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 15px', borderRadius: 10, border: `1px solid ${bd}`, background: bg, color: fg, fontWeight: 800, fontSize: 13, cursor: 'pointer', fontFamily: T.font });

/* ---------- helpers ---------- */
// "Look" determinista para una persona dormida a partir de su correo.
function sleeperLook(person) {
  const seed = (person.email || person.nombre || '').split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const piel = PIELES[seed % PIELES.length];
  const peloColor = PELO_COLORES[(seed * 7) % PELO_COLORES.length];
  const pelo = PELOS[(seed * 3) % PELOS.length].id;
  return { piel, pelo, peloColor, outfit: { color: '#CBD5E1', acento: '#94A3B8' }, sombrero: null, aura: null };
}
function hits(cx, cy, obstaculos) {
  const half = AV / 2 - 4;
  const l = cx - half, r = cx + half, tp = cy - half + 6, b = cy + half;
  return obstaculos.some((o) => r > o.x && l < o.x + o.w && b > o.y && tp < o.y + o.h);
}
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function useScaleToWidth(designW) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const parent = el.parentElement;
    const board = el.firstElementChild;
    const apply = () => {
      const w = parent.clientWidth;
      const s = Math.min(1.35, w / designW);
      el.style.width = (designW * s) + 'px';
      el.style.height = (STAGE_H * s) + 'px';
      if (board) board.style.transform = `scale(${s})`;
    };
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(parent);
    return () => ro.disconnect();
  }, [designW]);
  return ref;
}
