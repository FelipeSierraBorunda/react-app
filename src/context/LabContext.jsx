/* =====================================================================
   LabContext — Mesas, presencia y reservas del laboratorio
   ---------------------------------------------------------------------
   Carga la distribución (sembrando la default si la BD está vacía), la
   presencia (check-ins) y las reservas. Expone acciones que escriben en
   Supabase y actualizan el estado de inmediato. Las vistas usan
   useLab().
   ===================================================================== */

import { createContext, useContext, useEffect, useState, useCallback, useMemo, useRef } from 'react';
import * as Lab from '../lib/lab.js';
import { logAudit } from '../lib/inventory.js';
import { TOTAL_SILLAS, normalizeMesa, DEFAULT_MODULE_COLOR } from '../lib/lab-layout.js';
import { useAuth } from './AuthContext.jsx';

const LabContext = createContext(null);
export const useLab = () => useContext(LabContext);

const uid = () => 'm' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

export function LabProvider({ children }) {
  const { session, accounts } = useAuth();
  const [mesas, setMesas] = useState([]);
  const [presencia, setPresencia] = useState([]);
  const [reservas, setReservas] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [now, setNow] = useState(new Date());

  // Reloj vivo: refresca "now" cada 30 s para que las duraciones, las
  // sillas amarillas (próximas) y los estados de reserva avancen solos.
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(t);
  }, []);

  // Carga perezosa: solo la primera vez que alguien la pide (ver ensureLoaded).
  const load = useCallback(async () => {
    const [m, p, r] = await Promise.all([
      Lab.seedMesasIfEmpty(),
      Lab.fetchPresencia(),
      Lab.fetchReservas(),
    ]);
    setMesas(Array.isArray(m) ? m.map(normalizeMesa) : []);
    setPresencia(Array.isArray(p) ? p : []);
    setReservas(Array.isArray(r) ? r : []);
    setLoaded(true);
  }, []);

  const ensureLoaded = useCallback(() => { if (!loaded) load(); }, [loaded, load]);

  // Refresca manualmente (botón "Actualizar").
  const refresh = useCallback(async () => {
    const [p, r] = await Promise.all([Lab.fetchPresencia(), Lab.fetchReservas()]);
    setPresencia(Array.isArray(p) ? p : []);
    setReservas(Array.isArray(r) ? r : []);
    setNow(new Date());
  }, []);

  // ---------- cuentas registradas (para asignar dueños / identificar) ----------
  const cuentas = useMemo(
    () => Object.values(accounts || {}).map((u) => ({ email: u.email, nombre: u.nombre })),
    [accounts]
  );
  const nombreDe = useCallback(
    (email) => (accounts && accounts[email] ? accounts[email].nombre : email),
    [accounts]
  );

  // ---------- derivados ----------
  const presentes = useMemo(() => presencia.filter((p) => !p.salida), [presencia]);

  const presentesPorMesa = useMemo(() => {
    const m = {};
    presentes.forEach((p) => { if (p.mesa) { (m[p.mesa] = m[p.mesa] || []).push(p); } });
    return m;
  }, [presentes]);

  const reservasActivasPorMesa = useMemo(() => {
    const m = {};
    reservas.forEach((r) => { if (Lab.isActiveNow(r, now)) { (m[r.mesa] = m[r.mesa] || []).push(r); } });
    return m;
  }, [reservas, now]);

  // Reservas que empiezan dentro de 30 min (silla amarilla intermitente).
  const reservasProximasPorMesa = useMemo(() => {
    const m = {};
    reservas.forEach((r) => { if (Lab.isUpcoming(r, now, 30)) { (m[r.mesa] = m[r.mesa] || []).push(r); } });
    return m;
  }, [reservas, now]);

  // Mi check-in abierto (si estoy dentro).
  const miPresencia = useMemo(
    () => presentes.find((p) => session && p.email === session.email) || null,
    [presentes, session]
  );

  const totalSillas = useMemo(
    () => mesas.reduce((s, m) => s + (m.sillas || 0), 0) || TOTAL_SILLAS,
    [mesas]
  );
  const ocupadas = presentes.length;
  const lleno = ocupadas >= totalSillas;

  const esDueno = useCallback((mesa) => {
    if (!session || !mesa) return false;
    const d = mesa.duenos || [];
    return d.includes(session.email) || d.includes(session.nombre);
  }, [session]);

  // ---------- acciones de presencia ----------
  const entrar = useCallback(async (mesaId) => {
    if (!session) return { ok: false, error: 'Inicia sesión' };
    if (miPresencia) return { ok: false, error: 'Ya estás dentro del laboratorio' };
    const row = await Lab.checkIn(session, mesaId);
    setPresencia((prev) => [row, ...prev]);
    const mesa = mesas.find((m) => m.id === mesaId);
    logAudit(session, { modulo: 'lab', accion: 'entrar', objeto: mesa ? mesa.nombre : mesaId, detalle: 'Check-in' });
    return { ok: true };
  }, [session, miPresencia, mesas]);

  const salir = useCallback(async () => {
    if (!miPresencia) return { ok: false, error: 'No tienes una entrada abierta' };
    const row = await Lab.checkOut(miPresencia.id);
    setPresencia((prev) => prev.map((p) => (p.id === miPresencia.id ? { ...p, salida: row?.salida || new Date().toISOString() } : p)));
    logAudit(session, { modulo: 'lab', accion: 'salir', objeto: miPresencia.mesa || '', detalle: 'Check-out' });
    return { ok: true };
  }, [miPresencia, session]);

  // Admin: registrar la salida de otra persona que olvidó hacer check-out.
  const forzarSalida = useCallback(async (presenceId) => {
    const row = await Lab.checkOut(presenceId);
    const salida = row?.salida || new Date().toISOString();
    const p0 = presencia.find((p) => p.id === presenceId);
    setPresencia((prev) => prev.map((p) => (p.id === presenceId ? { ...p, salida } : p)));
    logAudit(session, { modulo: 'lab', accion: 'salir', objeto: p0 ? p0.nombre : presenceId, detalle: 'Salida forzada (admin)' });
    return { ok: true };
  }, [session, presencia]);

  // ---------- reservas (con regla dueño/externo) ----------
  const reservar = useCallback(async ({ mesa, inicio, fin }) => {
    if (!session) return { ok: false, error: 'Inicia sesión' };
    const owner = esDueno(mesa);
    const conflictos = reservas.filter(
      (r) => r.mesa === mesa.id && r.estado === 'activa' && Lab.overlaps(inicio, fin, r.inicio, r.fin)
    );
    if (conflictos.length) {
      const hayDueno = conflictos.some((r) => r.es_dueno);
      if (!owner) return { ok: false, error: 'Ese horario ya está reservado.' };
      if (hayDueno) return { ok: false, error: 'El dueño ya tiene ese horario reservado.' };
      const desplazadas = [];
      for (const c of conflictos) {
        await Lab.setReservaEstado(c.id, 'desplazada');
        desplazadas.push(c.id);
      }
      setReservas((prev) => prev.map((r) => (desplazadas.includes(r.id) ? { ...r, estado: 'desplazada' } : r)));
    }
    const row = await Lab.createReserva({ mesa: mesa.id, session, inicio, fin, esDueno: owner });
    setReservas((prev) => [...prev, row]);
    logAudit(session, { modulo: 'lab', accion: 'reservar', objeto: mesa.nombre, detalle: `${new Date(inicio).toLocaleString('es')} – ${new Date(fin).toLocaleString('es')}` });
    return { ok: true, desplazadas: conflictos.filter((c) => !c.es_dueno).length };
  }, [session, reservas, esDueno]);

  const cancelarReserva = useCallback(async (id) => {
    const r0 = reservas.find((r) => r.id === id);
    await Lab.deleteReserva(id);
    setReservas((prev) => prev.filter((r) => r.id !== id));
    logAudit(session, { modulo: 'lab', accion: 'cancelar', objeto: r0 ? r0.mesa : id, detalle: 'Reserva cancelada' });
  }, [reservas, session]);

  // ---------- edición de mesas (admin) ----------
  // Solo estado local (para el arrastre fluido en el modo edición).
  const setMesaLocal = useCallback((id, patch) => {
    setMesas((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m)));
  }, []);

  // Persiste (optimista): actualiza el estado primero y luego intenta
  // escribir en Supabase. Si las columnas nuevas aún no existen (falta el
  // ALTER), el cambio se ve en pantalla aunque no se guarde.
  const guardarMesa = useCallback(async (id, patch) => {
    const p = { ...patch };
    if (Array.isArray(p.seats)) p.sillas = p.seats.filter((s) => s.on).length;
    setMesas((prev) => prev.map((m) => (m.id === id ? { ...m, ...p } : m)));
    try {
      await Lab.updateMesa(id, p);
    } catch (e) {
      console.error('[lab] guardarMesa:', e);
    }
    return p;
  }, []);

  const agregarMesa = useCallback(async (data = {}) => {
    const esMod = data.kind && data.kind !== 'mesa';
    const base = normalizeMesa({
      id: uid(), nombre: esMod ? 'Módulo nuevo' : 'Mesa nueva', kind: 'mesa', x: 380, y: 230,
      w: esMod ? 110 : 100, h: 48, forma: 'rect', sillas: 0, silla_dir: 'bottom', duenos: [], objetos: [],
      pc: false, orden: 60, descripcion: '',
      color: esMod ? (DEFAULT_MODULE_COLOR[data.kind] || '#475569') : '#ffffff',
      ...data,
    });
    setMesas((prev) => [...prev, base]);
    try {
      await Lab.createMesa(base);
    } catch (e) {
      console.error('[lab] agregarMesa:', e);
    }
    return base;
  }, []);

  const eliminarMesa = useCallback(async (id) => {
    setMesas((prev) => prev.filter((m) => m.id !== id));
    try {
      await Lab.deleteMesa(id);
    } catch (e) {
      console.error('[lab] eliminarMesa:', e);
    }
  }, []);

  const value = {
    mesas, presencia, reservas, loaded, now,
    cuentas, nombreDe,
    presentes, presentesPorMesa, reservasActivasPorMesa, reservasProximasPorMesa, miPresencia,
    totalSillas, ocupadas, lleno, esDueno,
    ensureLoaded, refresh,
    entrar, salir, forzarSalida, reservar, cancelarReserva,
    guardarMesa, agregarMesa, eliminarMesa, setMesaLocal,
  };
  return <LabContext.Provider value={value}>{children}</LabContext.Provider>;
}
