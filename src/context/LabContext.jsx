/* =====================================================================
   LabContext — Mesas, presencia y reservas del laboratorio
   ---------------------------------------------------------------------
   Carga la distribución (sembrando la default si la BD está vacía), la
   presencia (check-ins) y las reservas. Expone acciones que escriben en
   Supabase y actualizan el estado de inmediato. Las vistas usan
   useLab().
   ===================================================================== */

import { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import * as Lab from '../lib/lab.js';
import { TOTAL_SILLAS } from '../lib/lab-layout.js';
import { useAuth } from './AuthContext.jsx';

const LabContext = createContext(null);
export const useLab = () => useContext(LabContext);

export function LabProvider({ children }) {
  const { session } = useAuth();
  const [mesas, setMesas] = useState([]);
  const [presencia, setPresencia] = useState([]);
  const [reservas, setReservas] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [now, setNow] = useState(new Date());

  // Carga perezosa: solo la primera vez que alguien la pide (ver ensureLoaded).
  const load = useCallback(async () => {
    const [m, p, r] = await Promise.all([
      Lab.seedMesasIfEmpty(),
      Lab.fetchPresencia(),
      Lab.fetchReservas(),
    ]);
    setMesas(Array.isArray(m) ? m : []);
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
    return d.includes(session.nombre) || d.includes(session.email);
  }, [session]);

  // ---------- acciones de presencia ----------
  const entrar = useCallback(async (mesaId) => {
    if (!session) return { ok: false, error: 'Inicia sesión' };
    if (miPresencia) return { ok: false, error: 'Ya estás dentro del laboratorio' };
    const row = await Lab.checkIn(session, mesaId);
    setPresencia((prev) => [row, ...prev]);
    return { ok: true };
  }, [session, miPresencia]);

  const salir = useCallback(async () => {
    if (!miPresencia) return { ok: false, error: 'No tienes una entrada abierta' };
    const row = await Lab.checkOut(miPresencia.id);
    setPresencia((prev) => prev.map((p) => (p.id === miPresencia.id ? { ...p, salida: row?.salida || new Date().toISOString() } : p)));
    return { ok: true };
  }, [miPresencia]);

  // ---------- reservas (con regla dueño/externo) ----------
  const reservar = useCallback(async ({ mesa, inicio, fin }) => {
    if (!session) return { ok: false, error: 'Inicia sesión' };
    const owner = esDueno(mesa);
    // Reservas activas que se solapan en esta mesa.
    const conflictos = reservas.filter(
      (r) => r.mesa === mesa.id && r.estado === 'activa' && Lab.overlaps(inicio, fin, r.inicio, r.fin)
    );
    if (conflictos.length) {
      const hayDueno = conflictos.some((r) => r.es_dueno);
      if (!owner) return { ok: false, error: 'Ese horario ya está reservado.' };
      if (hayDueno) return { ok: false, error: 'El dueño ya tiene ese horario reservado.' };
      // Dueño desplaza a los externos.
      const desplazadas = [];
      for (const c of conflictos) {
        await Lab.setReservaEstado(c.id, 'desplazada');
        desplazadas.push(c.id);
      }
      setReservas((prev) => prev.map((r) => (desplazadas.includes(r.id) ? { ...r, estado: 'desplazada' } : r)));
    }
    const row = await Lab.createReserva({ mesa: mesa.id, session, inicio, fin, esDueno: owner });
    setReservas((prev) => [...prev, row]);
    return { ok: true, desplazadas: conflictos.filter((c) => !c.es_dueno).length };
  }, [session, reservas, esDueno]);

  const cancelarReserva = useCallback(async (id) => {
    await Lab.deleteReserva(id);
    setReservas((prev) => prev.filter((r) => r.id !== id));
  }, []);

  // ---------- edición de mesas (admin / sesión) ----------
  const guardarMesa = useCallback(async (id, patch) => {
    const row = await Lab.updateMesa(id, patch);
    setMesas((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m)));
    return row;
  }, []);

  const agregarMesa = useCallback(async (data) => {
    const row = await Lab.createMesa(data);
    setMesas((prev) => [...prev, row]);
    return row;
  }, []);

  const eliminarMesa = useCallback(async (id) => {
    await Lab.deleteMesa(id);
    setMesas((prev) => prev.filter((m) => m.id !== id));
  }, []);

  const value = {
    mesas, presencia, reservas, loaded, now,
    presentes, presentesPorMesa, reservasActivasPorMesa, miPresencia,
    totalSillas, ocupadas, lleno, esDueno,
    ensureLoaded, refresh,
    entrar, salir, reservar, cancelarReserva,
    guardarMesa, agregarMesa, eliminarMesa,
  };
  return <LabContext.Provider value={value}>{children}</LabContext.Provider>;
}
