/* =====================================================================
   GameView.jsx — Laboratorio virtual (mapa tipo Habbo)
   ---------------------------------------------------------------------
   Réplica del croquis (lienzo 880×500). Muévete con WASD (piernas
   animadas). Las sillas del croquis son asientos donde aparecen, dormidas
   (💤), las personas con check-in abierto. Acércate a un MÓDULO (Granja
   FPGA, Brazo, Inventario…) y pulsa E para entrar. La puerta es el OXXO
   (tienda). Quiz colaborativo (📚): responde preguntas de otros para ganar
   monedas o crea las tuyas. Insignias por gasto y premio al empleado de
   la semana. Solo se juega en computadora/laptop (requiere teclado).
   ===================================================================== */

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useLab } from '../context/LabContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useLang } from '../context/LangContext.jsx';
import { STAGE_W, STAGE_H, SEAT } from '../lib/lab-layout.js';
import {
  TIENDA, EQUIPADO_DEFAULT, PELOS, PIELES, PELO_COLORES, itemById, ES_ACUMULABLE,
  fetchJuego, saveJuego, calcRecompensa, empleadoSemana,
  INSIGNIAS, insigniaDe, siguienteInsignia,
  PREMIO_EMPLEADO_MONEDAS, PREMIO_EMPLEADO_ITEM, semanaId,
  fetchQuiz, quizActivas, crearPregunta, responderPregunta, QUIZ_PREMIO,
} from '../lib/game.js';
import { T } from '../theme.js';

const STEP = 9, AV = 30;
const DOOR = { x: STAGE_W - 40, y: 14, w: 40, h: 96 }; // zona OXXO (pared derecha)
const BASE_OWNED = ['out_bata', 'hat_none', 'pet_none', 'desk_gris', 'aura_none'];

// Mapa de módulo (kind) → vista destino de la app.
const MODULO_VISTA = { inventario: 'table', almacen: 'visual', granja: 'granja', brazo: 'granja' };

export default function GameView({ go }) {
  const lab = useLab();
  const { session } = useAuth();
  const { t } = useLang();
  const { mesas, presentes, presencia, presentesPorMesa, ensureLoaded, nombreDe } = lab;

  useEffect(() => { ensureLoaded(); }, [ensureLoaded]);

  const isMobile = useMemo(() => {
    if (typeof window === 'undefined') return false;
    const coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    const touch = ('ontouchstart' in window) && (navigator.maxTouchPoints || 0) > 0;
    return (coarse && touch) || window.innerWidth < 820;
  }, []);

  // --- progreso ---
  const [monedas, setMonedas] = useState(0);
  const [gastado, setGastado] = useState(0);
  const [comprados, setComprados] = useState(BASE_OWNED);
  const [deco, setDeco] = useState([]);
  const [equipado, setEquipado] = useState(EQUIPADO_DEFAULT);
  const [ultRecompensa, setUltRecompensa] = useState(null);
  const [premioSem, setPremioSem] = useState('');
  const [shopOpen, setShopOpen] = useState(false);
  const [custOpen, setCustOpen] = useState(false);
  const [quizOpen, setQuizOpen] = useState(false);
  const [flash, setFlash] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [atDoor, setAtDoor] = useState(false);
  const [nearModule, setNearModule] = useState(null);

  // --- quiz ---
  const [quizPreguntas, setQuizPreguntas] = useState([]);
  const [quizRespuestas, setQuizRespuestas] = useState([]);

  const ranking = useMemo(() => empleadoSemana(presencia, new Date()), [presencia]);
  const topEmp = ranking[0] || null;
  const insignia = insigniaDe(gastado);

  const showFlash = useCallback((msg, ms = 2400) => { setFlash(msg); setTimeout(() => setFlash(null), ms); }, []);

  // ---------- carga ----------
  useEffect(() => {
    if (!session) { setLoaded(true); return; }
    (async () => {
      const { mine } = await fetchJuego(session.email);
      if (mine) {
        setMonedas(mine.monedas || 0);
        setGastado(mine.gastado || 0);
        setComprados(Array.isArray(mine.comprados) && mine.comprados.length ? mine.comprados : BASE_OWNED);
        setDeco(Array.isArray(mine.deco) ? mine.deco : []);
        setEquipado({ ...EQUIPADO_DEFAULT, ...(mine.equipado || {}) });
        setUltRecompensa(mine.ult_recompensa || null);
        setPremioSem(mine.premio_sem || '');
      }
      const q = await fetchQuiz();
      setQuizPreguntas(q.preguntas); setQuizRespuestas(q.respuestas);
      setLoaded(true);
    })();
  }, [session]);

  const persist = useCallback((patch) => {
    if (session) saveJuego(session.email, { monedas, gastado, comprados, deco, equipado, ult_recompensa: ultRecompensa, premio_sem: premioSem, ...patch });
  }, [session, monedas, gastado, comprados, deco, equipado, ultRecompensa, premioSem]);

  // ---------- recompensa por tiempo ----------
  const miPresencia = useMemo(
    () => presentes.find((p) => session && p.email === session.email) || null,
    [presentes, session]
  );
  const otorgar = useCallback(() => {
    if (!session || !miPresencia) return;
    const r = calcRecompensa(miPresencia, ultRecompensa, new Date());
    if (!r) return;
    setMonedas((m) => { const nm = m + r.monedas; saveJuego(session.email, { monedas: nm, ult_recompensa: r.nuevaMarca }); return nm; });
    setUltRecompensa(r.nuevaMarca);
    showFlash(`+${r.monedas} 🪙`);
  }, [session, miPresencia, ultRecompensa, showFlash]);
  useEffect(() => {
    if (!loaded || isMobile) return;
    otorgar();
    const iv = setInterval(otorgar, 60000);
    return () => clearInterval(iv);
  }, [loaded, isMobile, otorgar]);

  // ---------- premio empleado de la semana ----------
  useEffect(() => {
    if (!loaded || !session || !topEmp) return;
    const wk = semanaId(new Date());
    if (topEmp.email !== session.email) return;
    if (premioSem === wk) return;
    const nm = monedas + PREMIO_EMPLEADO_MONEDAS;
    const nc = comprados.includes(PREMIO_EMPLEADO_ITEM) ? comprados : [...comprados, PREMIO_EMPLEADO_ITEM];
    setMonedas(nm); setComprados(nc); setPremioSem(wk);
    persist({ monedas: nm, comprados: nc, premio_sem: wk });
    showFlash(`🏆 ${t('game.prizeGot', { n: PREMIO_EMPLEADO_MONEDAS })}`, 4000);
  }, [loaded, session, topEmp, premioSem]); // eslint-disable-line

  // ---------- comprar / equipar / personalizar ----------
  function comprar(item) {
    const acc = ES_ACUMULABLE(item.tipo);
    const yaTengo = acc ? deco.includes(item.id) : comprados.includes(item.id);
    if (yaTengo) { if (!acc) equipar(item); return; }
    if (monedas < item.precio) { showFlash(t('game.notEnough'), 1800); return; }
    const nm = monedas - item.precio, ng = gastado + item.precio;
    setMonedas(nm); setGastado(ng);
    if (acc) {
      const nd = [...deco, item.id]; setDeco(nd); persist({ monedas: nm, gastado: ng, deco: nd });
    } else {
      const nc = [...comprados, item.id], ne = { ...equipado, [item.tipo]: item.id };
      setComprados(nc); setEquipado(ne); persist({ monedas: nm, gastado: ng, comprados: nc, equipado: ne });
    }
    const prev = insigniaDe(gastado), now = insigniaDe(ng);
    if (now.id !== prev.id) showFlash(`${now.emoji} ${t('game.newBadge', { n: now.nombre })}`, 3500);
  }
  function equipar(item) { const ne = { ...equipado, [item.tipo]: item.id }; setEquipado(ne); persist({ equipado: ne }); }
  function toggleDeco(item) {
    // quitar/poner una pieza ya comprada del escritorio no cuesta; comprar si no se tiene.
    if (!deco.includes(item.id)) return comprar(item);
  }
  function setLook(patch) { const ne = { ...equipado, ...patch }; setEquipado(ne); persist({ equipado: ne }); }

  // ---------- quiz ----------
  const misRespuestas = useMemo(() => {
    const m = {};
    (quizRespuestas || []).forEach((r) => { if (session && r.email === session.email) m[r.pregunta] = r; });
    return m;
  }, [quizRespuestas, session]);
  const activas = useMemo(() => quizActivas(quizPreguntas, new Date()), [quizPreguntas]);
  const sinResponder = activas.filter((p) => !misRespuestas[p.id] && p.autor_email !== (session && session.email)).length;

  async function responder(pregunta, opcion) {
    if (!session) return;
    const row = await responderPregunta(session, pregunta, opcion);
    setQuizRespuestas((prev) => [...prev, row]);
    if (row.correcta) {
      const nm = monedas + (pregunta.premio || QUIZ_PREMIO);
      setMonedas(nm); persist({ monedas: nm });
      showFlash(`✅ +${pregunta.premio || QUIZ_PREMIO} 🪙`, 2600);
    } else {
      showFlash('❌', 1600);
    }
  }
  async function nuevaPregunta(data) {
    const row = await crearPregunta(session, data);
    setQuizPreguntas((prev) => [row, ...prev]);
  }

  // ---------- avatar WASD + animación ----------
  const [pos, setPos] = useState({ x: STAGE_W / 2, y: STAGE_H - 40 });
  const [dir, setDir] = useState('down');
  const [moving, setMoving] = useState(false);
  const [phase, setPhase] = useState(0);
  const keys = useRef({});
  const posRef = useRef({ x: STAGE_W / 2, y: STAGE_H - 40 });
  const nearRef = useRef(null);
  const atDoorRef = useRef(false);
  const obstaculos = useMemo(() => (mesas || []).filter((m) => m && typeof m.x === 'number'), [mesas]);
  const modulos = useMemo(() => obstaculos.filter((m) => m.kind && m.kind !== 'mesa'), [obstaculos]);

  useEffect(() => {
    if (isMobile) return;
    const game = (k) => ['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'e'].includes(k);
    const down = (e) => {
      const tag = e.target.tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
      const k = e.key.toLowerCase();
      if (k === 'e') { entrarModulo(); return; }
      if (game(k)) { keys.current[k] = true; e.preventDefault(); }
    };
    const up = (e) => { keys.current[e.key.toLowerCase()] = false; };
    window.addEventListener('keydown', down); window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, [isMobile, go]); // eslint-disable-line

  function entrarModulo() {
    const m = nearRef.current;
    if (!m) return;
    if (m.link) { window.open(m.link, '_blank', 'noreferrer'); return; }
    const vista = MODULO_VISTA[m.kind];
    if (vista && go) go(vista);
  }

  useEffect(() => {
    if (isMobile) return;
    const iv = setInterval(() => {
      const k = keys.current;
      let dx = 0, dy = 0;
      if (k['w'] || k['arrowup']) dy -= STEP;
      if (k['s'] || k['arrowdown']) dy += STEP;
      if (k['a'] || k['arrowleft']) dx -= STEP;
      if (k['d'] || k['arrowright']) dx += STEP;
      if (!dx && !dy) { setMoving(false); return; }
      setMoving(true);
      setPhase((p) => (p + 1) % 4);
      setDir(dy < 0 ? 'up' : dy > 0 ? 'down' : dx < 0 ? 'left' : 'right');
      const p = posRef.current;
      let nx = clamp(p.x + dx, AV / 2, STAGE_W - AV / 2);
      let ny = clamp(p.y + dy, AV / 2, STAGE_H - AV / 2);
      if (hits(nx, p.y, obstaculos)) nx = p.x;
      if (hits(nx, ny, obstaculos)) ny = p.y;
      posRef.current = { x: nx, y: ny };
      setPos({ x: nx, y: ny });
      // puerta OXXO
      const nearDoor = nx > DOOR.x - 26 && ny > DOOR.y - 10 && ny < DOOR.y + DOOR.h + 10;
      if (nearDoor !== atDoorRef.current) { atDoorRef.current = nearDoor; setAtDoor(nearDoor); }
      // módulo cercano
      const mod = modulos.find((o) => cerca(nx, ny, o, 28)) || null;
      if (mod !== nearRef.current) { nearRef.current = mod; setNearModule(mod); }
    }, 33);
    return () => clearInterval(iv);
  }, [obstaculos, modulos, isMobile]);

  useEffect(() => { if (atDoor && !shopOpen) setShopOpen(true); }, [atDoor]); // eslint-disable-line

  // ---------- asientos ocupados ----------
  const seatPeople = useMemo(() => {
    const out = [];
    (mesas || []).forEach((m) => {
      if (!m.seats) return;
      const onSeats = m.seats.filter((s) => s.on);
      const occ = (presentesPorMesa[m.id] || []).filter((p) => !(session && p.email === session.email));
      onSeats.forEach((s, i) => {
        out.push({ key: m.id + '-' + i, x: m.x + s.dx + SEAT / 2, y: m.y + s.dy + SEAT / 2, person: occ[i] || null });
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
  const deskFloor = itemById(equipado.escritorio) || itemById('desk_gris');
  const decoItems = deco.map(itemById).filter(Boolean);

  // ----------------- MÓVIL -----------------
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

        {/* insignia */}
        <div title={t('game.badgeHint')} style={{ display: 'flex', alignItems: 'center', gap: 7, background: '#fff', border: `1px solid ${insignia.color}`, borderRadius: 12, padding: '7px 13px' }}>
          <span style={{ fontSize: 16 }}>{insignia.emoji}</span>
          <span style={{ fontSize: 12.5, fontWeight: 800, color: insignia.color }}>{insignia.nombre}</span>
        </div>

        {/* empleado de la semana */}
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
          <button onClick={() => setQuizOpen(true)} style={btnHud('#fff', T.ink, T.border)}>
            📚 Quiz{sinResponder > 0 && <span style={{ marginLeft: 4, background: '#DC2626', color: '#fff', borderRadius: 20, padding: '1px 7px', fontSize: 11 }}>{sinResponder}</span>}
          </button>
          <button onClick={() => setCustOpen(true)} style={btnHud('#fff', T.ink, T.border)}>🎨 {t('game.customize')}</button>
          <button onClick={() => setShopOpen(true)} style={btnHud('#DA291C', '#fff', '#DA291C')}>🏪 OXXO</button>
        </div>
      </div>

      {!miPresencia && (
        <div style={{ marginBottom: 12, padding: '9px 14px', background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 10, color: '#1D4ED8', fontSize: 12.5, fontWeight: 600 }}>
          {t('game.mustCheckin')}
        </div>
      )}

      {/* CUARTO */}
      <div ref={useScaleToWidth(STAGE_W)} style={{ position: 'relative', margin: '0 auto' }}>
        <div style={{
          position: 'absolute', top: 0, left: 0, width: STAGE_W, height: STAGE_H, transformOrigin: 'top left',
          borderRadius: 6, border: '3px solid #CBD5E1', backgroundColor: '#F4F6FA', overflow: 'hidden',
          backgroundImage: 'linear-gradient(#EAEEF4 1px,transparent 1px),linear-gradient(90deg,#EAEEF4 1px,transparent 1px)',
          backgroundSize: '32px 32px',
        }}>
          <div style={{ position: 'absolute', inset: 0, background: deskFloor.color, opacity: 0.12, pointerEvents: 'none' }} />

          {/* OXXO */}
          <div style={{ position: 'absolute', left: DOOR.x, top: DOOR.y, width: DOOR.w, height: DOOR.h, background: '#DA291C', borderRadius: '6px 0 0 6px', border: '2px solid #B71C12', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'inset 0 0 0 3px #FFC72C' }}>
            <span style={{ fontSize: 9, fontWeight: 900, color: '#fff', letterSpacing: '0.05em', writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>OXXO</span>
          </div>

          {/* mi escritorio (decoración propia) */}
          {decoItems.length > 0 && (
            <div style={{ position: 'absolute', left: 8, bottom: 8, maxWidth: 150, background: 'rgba(255,255,255,0.85)', border: '1px solid #CBD5E1', borderRadius: 8, padding: '5px 8px' }}>
              <div style={{ fontSize: 8.5, fontWeight: 800, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 2 }}>{t('game.myDesk')}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, fontSize: 15 }}>
                {decoItems.map((d) => <span key={d.id} title={d.nombre}>{d.emoji}</span>)}
              </div>
            </div>
          )}

          {/* mobiliario */}
          {(mesas || []).map((m) => <Furniture key={m.id} m={m} highlight={nearModule && nearModule.id === m.id} />)}

          {/* asientos + personas */}
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

          {/* prompt de módulo */}
          {nearModule && (
            <div style={{ position: 'absolute', left: nearModule.x + nearModule.w / 2 - 60, top: nearModule.y - 26, width: 120, textAlign: 'center', zIndex: 8 }}>
              <span style={{ background: '#0F172A', color: '#fff', fontSize: 11, fontWeight: 700, padding: '4px 9px', borderRadius: 7, boxShadow: '0 2px 6px rgba(0,0,0,0.25)' }}>
                {nearModule.link ? '🔗' : '➡️'} {t('game.enter')} · E
              </span>
            </div>
          )}

          {/* mascota */}
          {pet && pet.color !== 'transparent' && (
            <div style={{ position: 'absolute', left: pos.x - AV / 2 - 18, top: pos.y + 4, transition: 'left .12s linear, top .12s linear' }}>
              <Pet kind={pet.id} />
            </div>
          )}

          {/* jugador */}
          <div style={{ position: 'absolute', left: pos.x - AV / 2, top: pos.y - AV / 2 - 10, zIndex: 6 }}>
            <Avatar look={look} dir={dir} moving={moving} phase={phase} name={session ? (nombreDe ? nombreDe(session.email) : session.nombre) : t('game.you')} you />
          </div>
        </div>
      </div>

      <p style={{ textAlign: 'center', fontSize: 12.5, color: T.muted, marginTop: 12 }}>
        ⌨️ {t('game.move')} · {t('game.enterHint')} · 🏪 {t('game.shopHint')}
      </p>

      {shopOpen && <OxxoShop t={t} monedas={monedas} comprados={comprados} deco={deco} equipado={equipado} insignia={insignia} gastado={gastado} onBuy={comprar} onClose={() => { setShopOpen(false); const np = { x: DOOR.x - 50, y: posRef.current.y }; posRef.current = np; setPos(np); atDoorRef.current = false; setAtDoor(false); }} />}
      {custOpen && <Customizer t={t} equipado={equipado} onLook={setLook} onClose={() => setCustOpen(false)} />}
      {quizOpen && <QuizModal t={t} session={session} preguntas={activas} mis={misRespuestas} onResponder={responder} onCrear={nuevaPregunta} onClose={() => setQuizOpen(false)} />}

      <style>{`@keyframes gv-pop{0%{transform:scale(.6);opacity:0}100%{transform:scale(1);opacity:1}}
        @keyframes gv-z{0%,100%{transform:translateY(0);opacity:.5}50%{transform:translateY(-4px);opacity:1}}
        @keyframes gv-bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-2px)}}
        @keyframes gv-aura{0%,100%{transform:scale(1);opacity:.5}50%{transform:scale(1.15);opacity:.85}}`}</style>
    </div>
  );
}

/* ---------- mobiliario ---------- */
function Furniture({ m, highlight }) {
  const esMesa = m.kind === 'mesa';
  const fill = esMesa ? (m.color && m.color !== '#ffffff' ? m.color : '#D8C19A') : (m.color || '#94A3B8');
  const isL = m.forma === 'L';
  const icon = !esMesa ? ({ granja: '🌾', brazo: '🦾', inventario: '📦', almacen: '🗄️' }[m.kind] || '⬛') : null;
  return (
    <div title={m.nombre} style={{
      position: 'absolute', left: m.x, top: m.y, width: m.w, height: m.h,
      background: fill, border: `2px solid ${highlight ? '#0F172A' : 'rgba(15,23,42,0.4)'}`, borderRadius: esMesa ? 5 : 4,
      boxShadow: highlight ? '0 0 0 3px rgba(15,23,42,0.25), inset 0 -5px 0 rgba(0,0,0,0.14)' : 'inset 0 -5px 0 rgba(0,0,0,0.14), 0 3px 0 rgba(15,23,42,0.18)',
      display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'center', justifyContent: 'center',
      clipPath: isL ? 'polygon(0 0, 62% 0, 62% 55%, 100% 55%, 100% 100%, 0 100%)' : 'none',
    }}>
      {icon && <span style={{ fontSize: 16, lineHeight: 1 }}>{icon}</span>}
      <span style={{ fontSize: 10, fontWeight: 800, color: esMesa ? 'rgba(15,23,42,0.62)' : 'rgba(255,255,255,0.95)', textShadow: esMesa ? '0 1px 0 rgba(255,255,255,0.4)' : '0 1px 1px rgba(0,0,0,0.3)', pointerEvents: 'none', padding: 2, textAlign: 'center' }}>{m.nombre}</span>
    </div>
  );
}

function Chair() {
  return <div style={{ width: SEAT, height: SEAT, borderRadius: '50%', background: '#475569', border: '2px solid #1E293B', boxShadow: 'inset 0 -3px 0 rgba(0,0,0,0.2)' }} />;
}

/* ---------- avatar por capas ---------- */
function Avatar({ look, dir = 'down', name, sleeping, sitting, moving, phase = 0, you }) {
  const piel = look.piel || '#F2C9A0';
  const peloColor = look.peloColor || '#3B2A20';
  const outfit = look.outfit || { color: '#E5E7EB', acento: '#94A3B8' };
  const eyeX = dir === 'left' ? 3 : dir === 'right' ? 7 : 5;
  // piernas: alterna según fase al caminar
  const swing = moving ? (phase === 1 ? 3 : phase === 3 ? -3 : 0) : 0;
  return (
    <div style={{ width: AV, position: 'relative', textAlign: 'center', animation: you && !moving ? 'gv-bob 1.5s ease-in-out infinite' : 'none' }}>
      {look.aura && look.aura.color !== 'transparent' && (
        <div style={{ position: 'absolute', left: '50%', top: 12, transform: 'translateX(-50%)', width: 30, height: 30, borderRadius: '50%', background: look.aura.color, filter: 'blur(5px)', opacity: 0.6, animation: 'gv-aura 1.8s ease-in-out infinite' }} />
      )}
      {sleeping && <span style={{ position: 'absolute', top: -12, right: -2, fontSize: 11, animation: 'gv-z 1.8s ease-in-out infinite', zIndex: 3 }}>💤</span>}
      <div style={{ position: 'absolute', bottom: -2, left: '50%', transform: 'translateX(-50%)', width: 20, height: 5, background: 'rgba(15,23,42,0.22)', borderRadius: '50%' }} />

      {look.sombrero && look.sombrero.color !== 'transparent' && <Hat item={look.sombrero} />}
      <Hair style={look.pelo} color={peloColor} />
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
      <div style={{ width: 6, height: 2, background: piel, margin: '-1px auto 0' }} />
      <div style={{ position: 'relative', width: 22, height: sitting ? 12 : 16, background: outfit.color, border: '2px solid #11203a', borderRadius: '5px 5px 6px 6px', margin: '0 auto', zIndex: 1 }}>
        <span style={{ position: 'absolute', top: 1, bottom: 1, left: '50%', transform: 'translateX(-50%)', width: 2, background: outfit.acento, opacity: 0.8 }} />
        <span style={{ position: 'absolute', top: 1, left: -4, width: 4, height: sitting ? 8 : 11, background: outfit.color, border: '2px solid #11203a', borderRadius: 3 }} />
        <span style={{ position: 'absolute', top: 1, right: -4, width: 4, height: sitting ? 8 : 11, background: outfit.color, border: '2px solid #11203a', borderRadius: 3 }} />
      </div>
      {!sitting && (
        <div style={{ display: 'flex', gap: 3, justifyContent: 'center', marginTop: -1 }}>
          <span style={{ width: 6, height: 6, background: '#1F2937', border: '2px solid #11203a', borderRadius: '0 0 3px 3px', transform: `translateY(${swing > 0 ? swing : 0}px)` }} />
          <span style={{ width: 6, height: 6, background: '#1F2937', border: '2px solid #11203a', borderRadius: '0 0 3px 3px', transform: `translateY(${swing < 0 ? -swing : 0}px)` }} />
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
  return <div style={{ width: 17, height: 7, margin: '0 auto', zIndex: 4, background: c, borderRadius: '7px 7px 0 0' }} />;
}

function Pet({ kind }) {
  const face = kind === 'pet_cat' ? '🐱' : kind === 'pet_dog' ? '🐶' : kind === 'pet_robot' ? '🤖' : kind === 'pet_drone' ? '🛸' : kind === 'pet_chip' ? '🔲' : '●';
  return <div style={{ width: 18, height: 18, display: 'grid', placeItems: 'center', fontSize: 15, animation: 'gv-bob 1.1s ease-in-out infinite', filter: 'drop-shadow(0 1px 0 rgba(15,23,42,0.25))' }}>{face}</div>;
}

/* ---------- OXXO ---------- */
function OxxoShop({ t, monedas, comprados, deco, equipado, insignia, gastado, onBuy, onClose }) {
  const sig = siguienteInsignia(gastado);
  const grupos = [
    ['outfit', '👕 ' + t('game.outfits')],
    ['sombrero', '🎩 ' + t('game.hats')],
    ['mascota', '🐾 ' + t('game.pets')],
    ['deco', '🪴 ' + t('game.deco')],
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
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 14, fontWeight: 800, color: '#7F1D1D', background: '#FFC72C', padding: '5px 12px', borderRadius: 20 }}>🪙 {monedas}</span>
            <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid rgba(255,255,255,0.5)', background: 'rgba(255,255,255,0.15)', cursor: 'pointer', fontSize: 15, color: '#fff' }}>✕</button>
          </div>
        </div>
        {/* progreso de insignia */}
        <div style={{ padding: '10px 22px', borderBottom: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, color: T.inkSoft }}>
          <span style={{ fontSize: 15 }}>{insignia.emoji}</span>
          <strong style={{ color: insignia.color }}>{insignia.nombre}</strong>
          {sig ? <span style={{ color: T.muted }}>· {t('game.toNext', { n: sig.min - gastado, b: sig.nombre })}</span> : <span style={{ color: T.muted }}>· {t('game.maxBadge')}</span>}
        </div>
        <div style={{ padding: '16px 22px 22px', overflowY: 'auto' }}>
          {grupos.map(([tipo, titulo]) => (
            <div key={tipo} style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 11.5, fontWeight: 700, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 9 }}>{titulo}</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(124px,1fr))', gap: 10 }}>
                {TIENDA.filter((i) => i.tipo === tipo).map((item) => {
                  const acc = tipo === 'deco';
                  const owned = acc ? deco.includes(item.id) : comprados.includes(item.id);
                  const eq = !acc && equipado[item.tipo] === item.id;
                  return (
                    <button key={item.id} onClick={() => onBuy(item)} disabled={acc && owned} style={{
                      textAlign: 'left', padding: 11, borderRadius: 11, cursor: acc && owned ? 'default' : 'pointer', fontFamily: T.font,
                      border: `2px solid ${eq ? T.primary : owned ? '#BBF7D0' : T.border}`, background: eq ? T.primarySoft : owned ? '#F0FDF4' : '#fff',
                      display: 'flex', flexDirection: 'column', gap: 8,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {item.emoji
                          ? <span style={{ fontSize: 20, width: 22, textAlign: 'center', flexShrink: 0 }}>{item.emoji}</span>
                          : <span style={{ width: 22, height: 22, borderRadius: 6, background: item.color === 'transparent' ? 'repeating-linear-gradient(45deg,#fff,#fff 3px,#E2E8F0 3px,#E2E8F0 6px)' : item.color, border: '1px solid rgba(15,23,42,0.2)', flexShrink: 0 }} />}
                        <span style={{ fontSize: 12.5, fontWeight: 700, color: T.ink, lineHeight: 1.2 }}>{item.nombre}</span>
                      </div>
                      <span style={{ fontSize: 11.5, fontWeight: 700, color: eq ? T.primary : owned ? '#16A34A' : '#B45309' }}>
                        {eq ? '✓ ' + t('game.equipped') : owned ? (acc ? '✓ ' + t('game.owned') : t('game.equip')) : (item.precio === 0 ? t('game.equip') : '🪙 ' + item.precio)}
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

/* ---------- personalización ---------- */
function Customizer({ t, equipado, onLook, onClose }) {
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', zIndex: 500, display: 'grid', placeItems: 'center', padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 460, maxHeight: '86vh', overflow: 'auto', padding: '20px 22px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <h2 style={{ fontSize: 18, fontWeight: 800, color: T.ink, margin: 0 }}>🎨 {t('game.customize')}</h2>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 8, border: `1px solid ${T.border}`, background: '#fff', cursor: 'pointer', fontSize: 15, color: T.muted }}>✕</button>
        </div>
        <p style={{ fontSize: 12, color: T.muted, margin: '0 0 16px' }}>{t('game.free')} · {t('game.previewHint')}</p>
        <div style={{ display: 'grid', placeItems: 'center', padding: '14px 0 22px', background: '#F8FAFC', borderRadius: 12, marginBottom: 16 }}>
          <Avatar look={{ piel: equipado.piel, pelo: equipado.pelo, peloColor: equipado.pelo_color, outfit: itemById(equipado.outfit) || itemById('out_bata'), sombrero: itemById(equipado.sombrero), aura: itemById(equipado.aura) }} name="" you />
        </div>
        <Group label={t('game.hair')}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {PELOS.map((p) => <button key={p.id} onClick={() => onLook({ pelo: p.id })} style={chipBtn(equipado.pelo === p.id)}>{p.nombre}</button>)}
          </div>
        </Group>
        <Group label={t('game.hairColor')}><Swatches values={PELO_COLORES} active={equipado.pelo_color} onPick={(c) => onLook({ pelo_color: c })} /></Group>
        <Group label={t('game.skin')}><Swatches values={PIELES} active={equipado.piel} onPick={(c) => onLook({ piel: c })} /></Group>
      </div>
    </div>
  );
}

/* ---------- QUIZ ---------- */
function QuizModal({ t, session, preguntas, mis, onResponder, onCrear, onClose }) {
  const [tab, setTab] = useState('responder'); // responder | crear
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', zIndex: 500, display: 'grid', placeItems: 'center', padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 560, maxHeight: '88vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '16px 22px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ fontSize: 18, fontWeight: 800, color: T.ink, margin: 0 }}>📚 {t('game.quizTitle')}</h2>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 8, border: `1px solid ${T.border}`, background: '#fff', cursor: 'pointer', fontSize: 15, color: T.muted }}>✕</button>
        </div>
        <div style={{ display: 'flex', gap: 4, padding: '12px 22px 0', borderBottom: `1px solid ${T.border}` }}>
          {[['responder', t('game.answer')], ['crear', t('game.createQ')]].map(([id, lbl]) => (
            <button key={id} onClick={() => setTab(id)} style={{ padding: '8px 14px', border: 'none', borderBottom: `2px solid ${tab === id ? T.primary : 'transparent'}`, background: 'transparent', cursor: 'pointer', fontSize: 13.5, fontWeight: 700, color: tab === id ? T.primary : T.muted, fontFamily: T.font }}>{lbl}</button>
          ))}
        </div>
        <div style={{ padding: '16px 22px 22px', overflowY: 'auto' }}>
          {!session && <p style={{ fontSize: 13, color: T.muted }}>{t('game.quizLogin')}</p>}
          {session && tab === 'responder' && <AnswerList t={t} session={session} preguntas={preguntas} mis={mis} onResponder={onResponder} />}
          {session && tab === 'crear' && <CreateForm t={t} onCrear={onCrear} />}
        </div>
      </div>
    </div>
  );
}

function AnswerList({ t, session, preguntas, mis, onResponder }) {
  if (!preguntas.length) return <p style={{ fontSize: 13, color: T.muted, textAlign: 'center', padding: 20 }}>{t('game.noQuiz')}</p>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {preguntas.map((p) => {
        const yo = p.autor_email === session.email;
        const r = mis[p.id];
        const horas = Math.max(0, Math.round((new Date(p.expira) - new Date()) / 3600000));
        return (
          <div key={p.id} style={{ border: `1px solid ${T.border}`, borderRadius: 12, padding: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
              <strong style={{ fontSize: 14, color: T.ink, lineHeight: 1.35 }}>{p.texto}</strong>
              <span style={{ flexShrink: 0, fontSize: 10.5, color: T.muted }}>⏳ {horas}h</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {p.opciones.map((op, i) => {
                const elegida = r && r.opcion === i;
                const esCorrecta = (r || yo) && i === p.correcta;
                const bg = esCorrecta ? '#F0FDF4' : (elegida && !r.correcta ? '#FEF2F2' : '#fff');
                const bd = esCorrecta ? '#16A34A' : (elegida ? '#DC2626' : T.border);
                return (
                  <button key={i} disabled={!!r || yo} onClick={() => onResponder(p, i)} style={{
                    textAlign: 'left', padding: '9px 12px', borderRadius: 9, border: `1.5px solid ${bd}`, background: bg,
                    cursor: r || yo ? 'default' : 'pointer', fontSize: 13, fontWeight: 600, color: T.ink, fontFamily: T.font,
                    display: 'flex', justifyContent: 'space-between', gap: 8,
                  }}>
                    <span>{op}</span>
                    {esCorrecta && <span style={{ color: '#16A34A' }}>✓</span>}
                    {elegida && !r.correcta && <span style={{ color: '#DC2626' }}>✕</span>}
                  </button>
                );
              })}
            </div>
            <div style={{ marginTop: 8, fontSize: 11, color: T.muted }}>
              {yo ? t('game.yourQ') : r ? (r.correcta ? t('game.gotIt', { n: p.premio }) : t('game.wrong')) : `🪙 ${p.premio} · ${t('game.byAuthor', { a: p.autor_nombre || '—' })}`}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function CreateForm({ t, onCrear }) {
  const [texto, setTexto] = useState('');
  const [ops, setOps] = useState(['', '', '']);
  const [correcta, setCorrecta] = useState(0);
  const [premio, setPremio] = useState(QUIZ_PREMIO);
  const [done, setDone] = useState(false);
  const valido = texto.trim() && ops.every((o) => o.trim());

  async function submit() {
    if (!valido) return;
    await onCrear({ texto: texto.trim(), opciones: ops.map((o) => o.trim()), correcta, premio: Number(premio) || QUIZ_PREMIO });
    setTexto(''); setOps(['', '', '']); setCorrecta(0); setPremio(QUIZ_PREMIO);
    setDone(true); setTimeout(() => setDone(false), 2500);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <p style={{ fontSize: 12, color: T.muted, margin: 0 }}>{t('game.createHint')}</p>
      <div>
        <label style={qlbl}>{t('game.question')}</label>
        <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={2} placeholder="¿Qué hace un capacitor en…?" style={{ ...qinp, resize: 'vertical' }} />
      </div>
      {ops.map((op, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={() => setCorrecta(i)} title={t('game.markCorrect')} style={{ width: 26, height: 26, flexShrink: 0, borderRadius: '50%', border: `2px solid ${correcta === i ? '#16A34A' : T.border}`, background: correcta === i ? '#16A34A' : '#fff', color: '#fff', cursor: 'pointer', fontSize: 13 }}>{correcta === i ? '✓' : ''}</button>
          <input value={op} onChange={(e) => setOps((a) => a.map((x, j) => (j === i ? e.target.value : x)))} placeholder={`${t('game.option')} ${i + 1}`} style={qinp} />
        </div>
      ))}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <label style={{ ...qlbl, margin: 0 }}>{t('game.reward')}</label>
        <input type="number" min={5} max={100} value={premio} onChange={(e) => setPremio(e.target.value)} style={{ ...qinp, width: 90 }} />
        <span style={{ fontSize: 12, color: T.muted }}>🪙</span>
      </div>
      <button onClick={submit} disabled={!valido} style={{ padding: '11px 16px', borderRadius: 10, border: 'none', background: valido ? T.primary : '#CBD5E1', color: '#fff', fontWeight: 700, fontSize: 14, cursor: valido ? 'pointer' : 'default', fontFamily: T.font }}>
        {done ? '✓ ' + t('game.published') : t('game.publish')}
      </button>
      <p style={{ fontSize: 11, color: T.muted, margin: 0 }}>{t('game.quizRules')}</p>
    </div>
  );
}

function Group({ label, children }) {
  return <div style={{ marginBottom: 16 }}><div style={{ fontSize: 11.5, fontWeight: 700, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>{label}</div>{children}</div>;
}
function Swatches({ values, active, onPick }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
      {values.map((c) => <button key={c} onClick={() => onPick(c)} title={c} style={{ width: 30, height: 30, borderRadius: 8, background: c, cursor: 'pointer', border: `3px solid ${active === c ? T.primary : 'rgba(15,23,42,0.15)'}` }} />)}
    </div>
  );
}
const chipBtn = (on) => ({ padding: '7px 12px', borderRadius: 8, cursor: 'pointer', fontSize: 12.5, fontWeight: 600, fontFamily: T.font, border: `1px solid ${on ? T.primary : T.border}`, background: on ? T.primarySoft : '#fff', color: on ? T.primary : '#475569' });
const btnHud = (bg, fg, bd) => ({ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 15px', borderRadius: 10, border: `1px solid ${bd}`, background: bg, color: fg, fontWeight: 800, fontSize: 13, cursor: 'pointer', fontFamily: T.font });
const qlbl = { display: 'block', fontSize: 11.5, fontWeight: 700, color: T.inkSoft, marginBottom: 5 };
const qinp = { width: '100%', padding: '9px 11px', borderRadius: 9, border: `1px solid ${T.border}`, fontSize: 13, fontFamily: T.font, outline: 'none', boxSizing: 'border-box', color: T.ink };

/* ---------- helpers ---------- */
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
  return obstaculos.some((o) => {
    if (!(r > o.x && l < o.x + o.w && b > o.y && tp < o.y + o.h)) return false;
    // Mesa en L: la esquina superior derecha está vacía (muesca).
    if (o.forma === 'L') {
      const notchX = o.x + o.w * 0.62, notchY = o.y + o.h * 0.55;
      if (l > notchX && b < notchY) return false; // dentro de la muesca → sin colisión
    }
    return true;
  });
}
function cerca(cx, cy, o, margen) {
  return cx > o.x - margen && cx < o.x + o.w + margen && cy > o.y - margen && cy < o.y + o.h + margen;
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
