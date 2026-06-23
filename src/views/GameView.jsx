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
import { useInventory } from '../context/InventoryContext.jsx';
import { STAGE_W, STAGE_H, SEAT } from '../lib/lab-layout.js';
import {
  TIENDA, EQUIPADO_DEFAULT, PELOS, PIELES, PELO_COLORES, CARAS, itemById, ES_ACUMULABLE,
  fetchJuego, saveJuego, calcRecompensa, empleadoSemana,
  INSIGNIAS, insigniaDe, siguienteInsignia,
  PREMIO_EMPLEADO_MONEDAS, PREMIO_EMPLEADO_ITEM, semanaId,
  fetchQuiz, quizActivas, crearPregunta, responderPregunta, QUIZ_PREMIO,
} from '../lib/game.js';
import { T } from '../theme.js';
import { Avatar, Pet, sleeperLook, lookFromEquipado } from '../components/Avatar.jsx';

const STEP = 9, AV = 30;
// Mismo recorte que el croquis (hueco abajo-izquierda).
const L_CLIP = 'polygon(0 0,100% 0,100% 100%,72% 100%,72% 48%,0 48%)';
const DOOR = { x: STAGE_W - 40, y: 14, w: 40, h: 96 }; // zona OXXO (pared derecha)
const SPAWN_FALLBACK = { x: 156, y: 392 };               // punto libre si no tienes mesa asignada
const BASE_OWNED = ['out_bata', 'hat_none', 'pet_none', 'desk_gris', 'aura_none'];

export default function GameView({ go }) {
  const lab = useLab();
  const { session, invAccess, accounts } = useAuth();
  const { t } = useLang();
  const inv = useInventory();
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
  const [juegoRows, setJuegoRows] = useState([]);
  const [shopOpen, setShopOpen] = useState(false);
  const [custOpen, setCustOpen] = useState(false);
  const [quizOpen, setQuizOpen] = useState(false);
  const [modulo, setModulo] = useState(null);
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
      const { mine, rows } = await fetchJuego(session.email);
      setJuegoRows(rows || []);
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

  // Ref con el estado COMPLETO del progreso. El upsert de Supabase usa
  // merge-duplicates, que REEMPLAZA toda la fila: si guardas solo {monedas}
  // se borran comprados/deco/equipado. Por eso cada guardado envía la fila
  // entera, tomando la base de este ref (siempre actualizado) + el patch.
  const progresoRef = useRef({ monedas: 0, gastado: 0, comprados: BASE_OWNED, deco: [], equipado: EQUIPADO_DEFAULT, ult_recompensa: null, premio_sem: '' });
  useEffect(() => {
    progresoRef.current = { monedas, gastado, comprados, deco, equipado, ult_recompensa: ultRecompensa, premio_sem: premioSem };
  }, [monedas, gastado, comprados, deco, equipado, ultRecompensa, premioSem]);

  const persist = useCallback((patch) => {
    if (!session) return;
    const full = { ...progresoRef.current, ...patch };
    progresoRef.current = full;           // adelanta el ref para que dos saves seguidos no se pisen
    saveJuego(session.email, full);
  }, [session]);

  // ---------- recompensa por tiempo ----------
  const miPresencia = useMemo(
    () => presentes.find((p) => session && p.email === session.email) || null,
    [presentes, session]
  );
  const otorgar = useCallback(() => {
    if (!session || !miPresencia) return;
    const r = calcRecompensa(miPresencia, ultRecompensa, new Date());
    if (!r) return;
    setMonedas((m) => { const nm = m + r.monedas; persist({ monedas: nm, ult_recompensa: r.nuevaMarca }); return nm; });
    setUltRecompensa(r.nuevaMarca);
    showFlash(`+${r.monedas} 🪙`);
  }, [session, miPresencia, ultRecompensa, showFlash, persist]);
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
  const [pos, setPos] = useState(SPAWN_FALLBACK);
  const [dir, setDir] = useState('up');
  const [moving, setMoving] = useState(false);
  const [sitting, setSitting] = useState(true);
  const [phase, setPhase] = useState(0);
  const keys = useRef({});
  const posRef = useRef(SPAWN_FALLBACK);
  const movedRef = useRef(false);
  const nearRef = useRef(null);
  const atDoorRef = useRef(false);
  const obstaculos = useMemo(() => (mesas || []).filter((m) => m && typeof m.x === 'number'), [mesas]);
  const modulos = useMemo(() => obstaculos.filter((m) => m.kind && m.kind !== 'mesa'), [obstaculos]);

  // Mi mesa = aquella cuyos dueños incluyen mi nombre (o mi email).
  const miMesa = useMemo(() => {
    if (!session) return null;
    const full = (session.nombre || '').trim().toLowerCase();
    const first = full.split(' ')[0];
    const myEmail = (session.email || '').trim().toLowerCase();
    return (mesas || []).find((m) => Array.isArray(m.duenos) && m.duenos.some((d) => {
      const dn = String(d || '').trim().toLowerCase();
      if (myEmail && dn === myEmail) return true;
      if (!full) return false;
      return dn === full || dn === first || dn.split(' ')[0] === first;
    })) || null;
  }, [mesas, session]);

  // Punto de aparición: la misma silla que ocuparía mi fantasma en mi mesa.
  const spawnPoint = useMemo(() => {
    if (miMesa && Array.isArray(miMesa.seats)) {
      const onSeats = miMesa.seats.filter((s) => s.on);
      if (onSeats.length) {
        const myName = (session?.nombre || '').trim().toLowerCase();
        const myEmail = (session?.email || '').trim().toLowerCase();
        const ownerIdx = (miMesa.duenos || []).findIndex((d) => {
          const dn = String(d || '').trim().toLowerCase();
          if (myEmail && dn === myEmail) return true;
          return dn === myName || dn.split(' ')[0] === myName.split(' ')[0];
        });
        const idx = ownerIdx >= 0 ? Math.min(ownerIdx, onSeats.length - 1) : 0;
        const s = onSeats[idx];
        return { x: miMesa.x + s.dx + SEAT / 2, y: miMesa.y + s.dy + SEAT / 2 };
      }
    }
    return SPAWN_FALLBACK;
  }, [miMesa, session]);

  // Coloca el avatar en su spawn una vez que cargan las mesas (si aún no se ha movido).
  const placedRef = useRef(false);
  useEffect(() => {
    if (placedRef.current || movedRef.current) return;
    if (!mesas || !mesas.length) return;
    placedRef.current = true;
    posRef.current = { x: spawnPoint.x, y: spawnPoint.y };
    setPos({ x: spawnPoint.x, y: spawnPoint.y });
  }, [mesas, spawnPoint]);

  useEffect(() => {
    if (isMobile) return;
    const game = (k) => ['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'e'].includes(k);
    const down = (e) => {
      const tag = e.target.tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
      const k = e.key.toLowerCase();
      if (k === 'e') { entrarModulo(); return; }
      if (k === 'f') { toggleSit(); return; }
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
    setModulo(m); // abre el panel dentro del juego (sin salir de la pestaña)
  }

  // Sentarse en la silla libre más cercana (o levantarse si ya está sentado).
  function toggleSit() {
    if (sittingRef.current) { setSitting(false); return; }
    const p = posRef.current;
    let best = null, bd = 1e9;
    (seatRef.current || []).forEach((s) => {
      if (s.info) return; // silla ocupada
      const d = Math.hypot(s.x - p.x, s.y - p.y);
      if (d < bd) { bd = d; best = s; }
    });
    if (best && bd < 64) {
      posRef.current = { x: best.x, y: best.y };
      setPos({ x: best.x, y: best.y });
      setSitting(true); setDir('up'); movedRef.current = true;
    }
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
      setSitting(false);
      movedRef.current = true;
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

  // ---------- asientos: dueños en su mesa + visitantes presentes ----------
  const lookByEmail = useMemo(() => {
    const m = {};
    (juegoRows || []).forEach((r) => { if (r && r.email && r.equipado) m[r.email] = lookFromEquipado(r.equipado); });
    return m;
  }, [juegoRows]);

  const emailByName = useMemo(() => {
    const m = {};
    Object.values(accounts || {}).forEach((a) => {
      if (!a || !a.nombre) return;
      const full = String(a.nombre).trim().toLowerCase();
      if (!(full in m)) m[full] = a.email;
      const first = full.split(' ')[0];
      if (first && !(first in m)) m[first] = a.email;
    });
    return m;
  }, [accounts]);

  const presentEmails = useMemo(() => new Set((presentes || []).map((p) => p.email)), [presentes]);

  const seatPeople = useMemo(() => {
    const out = [];
    const myName = (session?.nombre || '').trim().toLowerCase();
    const myFirst = myName.split(' ')[0];
    const isMe = (person) => {
      if (!session) return false;
      if (person.email && person.email === session.email) return true;
      const pn = String(person.nombre || '').trim().toLowerCase();
      return pn === myName || (myFirst && pn.split(' ')[0] === myFirst);
    };
    const resolveEmail = (nombre) => {
      const raw = String(nombre || '').trim();
      const key = raw.toLowerCase();
      // El dueño puede estar guardado ya como email (cuentas nuevas) o como nombre (legado).
      if (accounts && accounts[raw]) return raw;
      if (key.includes('@')) return raw;
      return emailByName[key] || emailByName[key.split(' ')[0]] || null;
    };
    (mesas || []).forEach((m) => {
      if (!m.seats) return;
      const onSeats = m.seats.filter((s) => s.on);
      if (!onSeats.length) return;

      const owners = (m.duenos || []).map((nombre) => ({ nombre, email: resolveEmail(nombre) }));
      const ownerEmails = new Set(owners.map((o) => o.email).filter(Boolean));
      const visitors = (presentesPorMesa[m.id] || [])
        .filter((p) => !(session && p.email === session.email))
        .filter((p) => !ownerEmails.has(p.email))
        .map((p) => ({ nombre: p.nombre, email: p.email }));

      const people = [...owners, ...visitors].slice(0, onSeats.length);

      onSeats.forEach((s, i) => {
        const person = people[i] || null;
        let info = null;
        if (person && !isMe(person)) {
          const presente = person.email ? presentEmails.has(person.email) : false;
          const look = (person.email && lookByEmail[person.email]) || sleeperLook({ email: person.email, nombre: person.nombre });
          info = { nombre: person.nombre, look, presente };
        }
        out.push({ key: m.id + '-' + i, x: m.x + s.dx + SEAT / 2, y: m.y + s.dy + SEAT / 2, info });
      });
    });
    return out;
  }, [mesas, presentesPorMesa, session, emailByName, lookByEmail, presentEmails]);

  const sittingRef = useRef(true); sittingRef.current = sitting;
  const seatRef = useRef([]); seatRef.current = seatPeople;

  const look = {
    piel: equipado.piel, pelo: equipado.pelo, peloColor: equipado.pelo_color, cara: equipado.cara,
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
          borderRadius: 4, border: '5px solid #9A8C73', backgroundColor: '#E9E1D2', overflow: 'hidden',
          backgroundImage: 'linear-gradient(rgba(120,100,70,0.11) 1px, transparent 1px), linear-gradient(90deg, rgba(120,100,70,0.11) 1px, transparent 1px), linear-gradient(45deg, rgba(120,100,70,0.06) 25%, transparent 25%, transparent 75%, rgba(120,100,70,0.06) 75%), linear-gradient(45deg, rgba(120,100,70,0.06) 25%, transparent 25%, transparent 75%, rgba(120,100,70,0.06) 75%)',
          backgroundSize: '44px 44px, 44px 44px, 88px 88px, 88px 88px',
          backgroundPosition: '0 0, 0 0, 0 0, 44px 44px',
          boxShadow: 'inset 0 0 0 4px rgba(255,255,255,0.4), inset 0 14px 22px rgba(80,60,30,0.12), inset 0 0 46px rgba(80,60,30,0.14)',
        }}>
          <div style={{ position: 'absolute', inset: 0, background: deskFloor.color, opacity: 0.1, pointerEvents: 'none' }} />

          {/* OXXO */}
          <div style={{ position: 'absolute', left: DOOR.x, top: DOOR.y, width: DOOR.w, height: DOOR.h, background: '#DA291C', borderRadius: '6px 0 0 6px', border: '2px solid #B71C12', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'inset 0 0 0 3px #FFC72C' }}>
            <span style={{ fontSize: 9, fontWeight: 900, color: '#fff', letterSpacing: '0.05em', writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>OXXO</span>
          </div>

          {/* mi escritorio (decoración propia) */}
          {decoItems.length > 0 && miMesa && (
            <div style={{ position: 'absolute', left: miMesa.x, top: miMesa.y - 16, width: miMesa.w, display: 'flex', justifyContent: 'center', gap: 3, fontSize: 14, pointerEvents: 'none', zIndex: 4 }}>
              {decoItems.map((d) => <span key={d.id} title={d.nombre} style={{ filter: 'drop-shadow(0 1px 0 rgba(15,23,42,0.25))' }}>{d.emoji}</span>)}
            </div>
          )}
          {decoItems.length > 0 && !miMesa && (
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
              {s.info && (
                <div style={{ position: 'absolute', left: SEAT / 2 - AV / 2, top: -AV + 4, opacity: s.info.presente ? 1 : 0.6 }}>
                  <Avatar look={s.info.look} sitting sleeping={!s.info.presente} name={s.info.nombre} />
                  <span title={s.info.presente ? 'Presente ahora' : 'Ausente'} style={{ position: 'absolute', top: 0, right: 3, width: 8, height: 8, borderRadius: '50%', background: s.info.presente ? '#22C55E' : '#94A3B8', border: '1.5px solid #fff', zIndex: 5 }} />
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
          <div style={{ position: 'absolute', left: pos.x - AV / 2, top: pos.y - AV / 2 - 10, zIndex: 6, transition: moving ? 'none' : 'left .12s, top .12s' }}>
            <Avatar look={look} dir={dir} moving={moving} sitting={sitting} phase={phase} name={session ? (nombreDe ? nombreDe(session.email) : session.nombre) : t('game.you')} you />
          </div>
        </div>
      </div>

      <p style={{ textAlign: 'center', fontSize: 12.5, color: T.muted, marginTop: 12 }}>
        ⌨️ {t('game.move')} · {t('game.enterHint')} · 🪑 F {t('game.sit')} · 🏪 {t('game.shopHint')}
      </p>

      {/* leyenda de zonas */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginTop: 8 }}>
        {[
          ['📦', t('menu.inventory')], ['🗄️', 'Almacén'], ['🌾', 'Granja FPGA'], ['🦾', 'Brazo'], ['🏪', 'OXXO'],
        ].map(([icon, lbl]) => (
          <span key={lbl} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5, fontWeight: 600, color: T.inkSoft, background: '#fff', border: `1px solid ${T.border}`, borderRadius: 20, padding: '4px 10px' }}>
            <span style={{ fontSize: 13 }}>{icon}</span>{lbl}
          </span>
        ))}
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5, fontWeight: 600, color: T.inkSoft, background: '#fff', border: `1px solid ${T.border}`, borderRadius: 20, padding: '4px 10px' }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#22C55E' }} /> {t('game.present')}
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#94A3B8', marginLeft: 6 }} /> {t('game.away')}
        </span>
      </div>

      {shopOpen && <OxxoShop t={t} monedas={monedas} comprados={comprados} deco={deco} equipado={equipado} insignia={insignia} gastado={gastado} onBuy={comprar} onClose={() => { setShopOpen(false); const np = { x: DOOR.x - 50, y: posRef.current.y }; posRef.current = np; setPos(np); atDoorRef.current = false; setAtDoor(false); }} />}
      {custOpen && <Customizer t={t} equipado={equipado} onLook={setLook} onClose={() => setCustOpen(false)} />}
      {quizOpen && <QuizModal t={t} session={session} preguntas={activas} mis={misRespuestas} onResponder={responder} onCrear={nuevaPregunta} onClose={() => setQuizOpen(false)} />}
      {modulo && <ModuloModal t={t} modulo={modulo} inv={inv} invAccess={invAccess} go={go} onClose={() => setModulo(null)} />}

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
  const isL = m.forma === 'L';
  const icon = !esMesa ? ({ granja: '🌾', brazo: '🦾', inventario: '📦', almacen: '🗄️' }[m.kind] || '⬛') : null;

  if (esMesa) {
    const wood = (m.color && m.color !== '#ffffff') ? m.color : '#C8A878';
    return (
      <div title={m.nombre} style={{
        position: 'absolute', left: m.x, top: m.y, width: m.w, height: m.h,
        background: wood, borderRadius: 5,
        border: `2px solid ${highlight ? '#0F172A' : 'rgba(70,45,20,0.45)'}`,
        backgroundImage: 'repeating-linear-gradient(90deg, rgba(90,55,20,0.10) 0 2px, transparent 2px 13px), linear-gradient(180deg, rgba(255,255,255,0.28), rgba(0,0,0,0.06))',
        boxShadow: highlight ? '0 0 0 3px rgba(15,23,42,0.25), 0 4px 0 rgba(70,45,20,0.3)' : 'inset 0 2px 0 rgba(255,255,255,0.3), 0 4px 0 rgba(70,45,20,0.3)',
        display: 'flex', flexDirection: 'column', gap: 2,
        alignItems: isL ? 'flex-end' : 'center', justifyContent: isL ? 'flex-start' : 'center',
        paddingTop: isL ? 6 : 0, paddingRight: isL ? 7 : 0,
        clipPath: isL ? L_CLIP : 'none',
      }}>
        {m.pc && (
          <div style={{ position: 'absolute', top: 4, right: 5, width: 18, height: 13, background: '#1E293B', borderRadius: 2, border: '1.5px solid #0F172A', boxShadow: 'inset 0 0 0 2px #38BDF8' }}>
            <span style={{ position: 'absolute', bottom: -4, left: '50%', transform: 'translateX(-50%)', width: 8, height: 3, background: '#334155', borderRadius: '0 0 2px 2px' }} />
          </div>
        )}
        <span style={{ fontSize: 10, fontWeight: 800, color: 'rgba(50,30,10,0.7)', textShadow: '0 1px 0 rgba(255,255,255,0.45)', pointerEvents: 'none', padding: 2, textAlign: 'center' }}>{m.nombre}</span>
      </div>
    );
  }

  // módulo (zona no-mesa)
  const fill = m.color || '#94A3B8';
  return (
    <div title={m.nombre} style={{
      position: 'absolute', left: m.x, top: m.y, width: m.w, height: m.h,
      background: fill, border: `2px solid ${highlight ? '#0F172A' : 'rgba(15,23,42,0.45)'}`, borderRadius: 4,
      backgroundImage: 'linear-gradient(180deg, rgba(255,255,255,0.22), rgba(0,0,0,0.14))',
      boxShadow: highlight ? '0 0 0 3px rgba(15,23,42,0.25), inset 0 -5px 0 rgba(0,0,0,0.18)' : 'inset 0 -5px 0 rgba(0,0,0,0.18), 0 3px 0 rgba(15,23,42,0.2)',
      display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'center', justifyContent: 'center',
    }}>
      <span style={{ fontSize: 16, lineHeight: 1 }}>{icon}</span>
      <span style={{ fontSize: 10, fontWeight: 800, color: 'rgba(255,255,255,0.96)', textShadow: '0 1px 1px rgba(0,0,0,0.35)', pointerEvents: 'none', padding: 2, textAlign: 'center' }}>{m.nombre}</span>
    </div>
  );
}

function Chair() {
  return (
    <div style={{ width: SEAT, height: SEAT, position: 'relative' }}>
      <div style={{ position: 'absolute', top: -3, left: '20%', right: '20%', height: 6, borderRadius: 3, background: '#3A4252', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.15)' }} />
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, top: 2, borderRadius: '42% 42% 46% 46%', background: '#5B6675', border: '2px solid #3A4252', boxShadow: 'inset 0 -3px 0 rgba(0,0,0,0.22), inset 0 3px 0 rgba(255,255,255,0.16)' }} />
    </div>
  );
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
          <Avatar look={{ piel: equipado.piel, pelo: equipado.pelo, peloColor: equipado.pelo_color, cara: equipado.cara, outfit: itemById(equipado.outfit) || itemById('out_bata'), sombrero: itemById(equipado.sombrero), aura: itemById(equipado.aura) }} name="" you />
        </div>
        <Group label={t('game.face')}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {CARAS.map((c) => <button key={c.id} onClick={() => onLook({ cara: c.id })} style={chipBtn(equipado.cara === c.id)}>{c.nombre}</button>)}
          </div>
        </Group>
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

/* ---------- panel de m\u00f3dulo (dentro del juego) ---------- */
const MODULO_META = {
  inventario: { icon: '\ud83d\udce6', titulo: 'Inventario', vista: 'table' },
  almacen: { icon: '\ud83d\uddc4\ufe0f', titulo: 'Almac\u00e9n', vista: 'visual' },
  granja: { icon: '\ud83c\udf3e', titulo: 'Granja FPGA', vista: 'granja' },
  brazo: { icon: '\ud83e\uddbe', titulo: 'Brazo robot', vista: 'granja' },
};

function ModuloModal({ t, modulo, inv, invAccess, go, onClose }) {
  const [q, setQ] = useState('');
  const meta = MODULO_META[modulo.kind] || { icon: '\u2b1b', titulo: modulo.nombre, vista: null };
  const esInv = modulo.kind === 'inventario';
  const esAlm = modulo.kind === 'almacen';

  const items = useMemo(() => {
    if (esInv) {
      if (!invAccess) return [];
      const needle = q.trim().toLowerCase();
      return (inv.comps || [])
        .filter((c) => !needle || [c.codigoInterno, c.codigoFabricante, c.descripcion, c.tipo].some((v) => String(v || '').toLowerCase().includes(needle)))
        .slice(0, 250);
    }
    if (esAlm) return inv.looseInMesa ? inv.looseInMesa('almacen') : [];
    return [];
  }, [esInv, esAlm, q, inv, invAccess]);

  const contenedores = esAlm && inv.containersInMesa ? inv.containersInMesa('almacen') : [];

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', zIndex: 500, display: 'grid', placeItems: 'center', padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 640, maxHeight: '88vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', border: `1px solid ${T.border}` }}>
        <div style={{ padding: '16px 22px', borderBottom: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 22 }}>{meta.icon}</span>
          <div style={{ flex: 1 }}>
            <h2 style={{ fontSize: 18, fontWeight: 800, color: T.ink, margin: 0 }}>{meta.titulo}</h2>
            <div style={{ fontSize: 12, color: T.muted }}>{modulo.nombre}</div>
          </div>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 8, border: `1px solid ${T.border}`, background: '#fff', cursor: 'pointer', fontSize: 15, color: T.muted }}>\u2715</button>
        </div>

        <div style={{ padding: '16px 22px', overflowY: 'auto' }}>
          {esInv && !invAccess && (
            <div style={{ textAlign: 'center', padding: '28px 10px', color: T.muted }}>
              <div style={{ fontSize: 30, marginBottom: 8 }}>\ud83d\udd12</div>
              <p style={{ fontSize: 13.5, margin: 0 }}>Tu cuenta a\u00fan no tiene acceso al inventario. Pide al administrador que te habilite.</p>
            </div>
          )}

          {esInv && invAccess && (
            <>
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar c\u00f3digo, descripci\u00f3n o tipo\u2026" style={{ width: '100%', padding: '9px 12px', borderRadius: 9, border: `1px solid ${T.border}`, fontSize: 13, fontFamily: T.font, outline: 'none', boxSizing: 'border-box', marginBottom: 12 }} />
              <CompactList items={items} inv={inv} />
            </>
          )}

          {esAlm && (
            <>
              {contenedores.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 11.5, fontWeight: 700, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Contenedores aqu\u00ed</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {contenedores.map((c) => (
                      <span key={c.id} style={{ fontSize: 12.5, fontWeight: 600, color: T.inkSoft, background: '#F1F5F9', border: `1px solid ${T.border}`, borderRadius: 8, padding: '6px 11px' }}>\ud83d\udce6 {c.name || c.id}</span>
                    ))}
                  </div>
                </div>
              )}
              <div style={{ fontSize: 11.5, fontWeight: 700, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Componentes sueltos aqu\u00ed</div>
              {items.length ? <CompactList items={items} inv={inv} /> : <p style={{ fontSize: 13, color: T.muted, margin: 0 }}>No hay componentes sueltos registrados en el almac\u00e9n.</p>}
            </>
          )}

          {!esInv && !esAlm && (
            <div style={{ textAlign: 'center', padding: '24px 10px', color: T.muted }}>
              <p style={{ fontSize: 13.5, margin: 0, lineHeight: 1.5 }}>Este m\u00f3dulo se gestiona en su vista completa. \u00c1brela cuando quieras; tu avatar te espera aqu\u00ed.</p>
            </div>
          )}
        </div>

        {meta.vista && (
          <div style={{ padding: '14px 22px', borderTop: `1px solid ${T.border}`, display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <button onClick={onClose} style={{ padding: '9px 16px', borderRadius: 9, border: `1px solid ${T.border}`, background: '#fff', color: T.inkSoft, fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: T.font }}>Seguir en el juego</button>
            <button onClick={() => { onClose(); go && go(meta.vista); }} style={{ padding: '9px 16px', borderRadius: 9, border: 'none', background: T.primary, color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: T.font }}>Abrir vista completa \u2192</button>
          </div>
        )}
      </div>
    </div>
  );
}

function CompactList({ items, inv }) {
  if (!items.length) return <p style={{ fontSize: 13, color: T.muted, textAlign: 'center', padding: 20, margin: 0 }}>Sin resultados.</p>;
  return (
    <div style={{ border: `1px solid ${T.border}`, borderRadius: 10, overflow: 'hidden' }}>
      {items.map((c) => (
        <div key={c.id} style={{ display: 'grid', gridTemplateColumns: '78px 1fr auto', gap: 10, alignItems: 'center', padding: '9px 12px', borderBottom: `1px solid ${T.borderSoft || '#F1F5F9'}` }}>
          <span style={{ fontFamily: T.mono, fontSize: 11.5, color: T.inkSoft }}>{c.codigoInterno}</span>
          <span style={{ fontSize: 12.5, color: T.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {c.descripcion}
            <span style={{ marginLeft: 8, fontSize: 11, color: inv.tcMap ? (inv.tcMap[c.tipo] || T.muted) : T.muted, fontWeight: 600 }}>{c.tipo}</span>
          </span>
          <span style={{ fontSize: 12.5, fontWeight: 700, color: T.ink }}>{c.cantidad}</span>
        </div>
      ))}
    </div>
  );
}

/* ---------- helpers ---------- */
function hits(cx, cy, obstaculos) {
  const half = AV / 2 - 4;
  const l = cx - half, r = cx + half, tp = cy - half + 6, b = cy + half;
  const overlap = (ox, oy, ow, oh) => (r > ox && l < ox + ow && b > oy && tp < oy + oh);
  return obstaculos.some((o) => {
    if (!overlap(o.x, o.y, o.w, o.h)) return false;
    // Mesa en L (mismo recorte que el croquis): sólida en la banda superior
    // (0–48% alto) y en la columna derecha (72–100% ancho); hueco abajo-izq.
    if (o.forma === 'L') {
      const topBand = overlap(o.x, o.y, o.w, o.h * 0.48);
      const rightCol = overlap(o.x + o.w * 0.72, o.y, o.w * 0.28, o.h);
      return topBand || rightCol;
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
