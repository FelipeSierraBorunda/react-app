/* =====================================================================
   lab.js — CRUD del módulo de laboratorio (mesas, presencia, reservas)
   ---------------------------------------------------------------------
   Capa de datos pura sobre Supabase, sin estado de React. La consume
   LabContext. Mismas convenciones que inventory.js.
   ===================================================================== */

import { db } from './supabase.js';
import { DEFAULT_MESAS } from './lab-layout.js';

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2);

// ---------- mesas ----------

export async function fetchMesas() {
  return db.select('mesas', { order: 'orden.asc' });
}

// Siembra la distribución por defecto si la tabla está vacía.
export async function seedMesasIfEmpty() {
  const rows = await fetchMesas();
  if (Array.isArray(rows) && rows.length > 0) return rows;
  const seed = DEFAULT_MESAS.map((m) => ({
    objetos: [], duenos: [], link: '', pc: false, forma: 'rect', sillas: 0, silla_dir: 'bottom', kind: 'mesa',
    ...m,
  }));
  try {
    const out = await db.upsert('mesas', seed);
    return Array.isArray(out) ? out : seed;
  } catch (e) {
    console.error('[lab] seedMesas:', e);
    return seed; // funciona en memoria aunque la tabla no exista aún
  }
}

export async function updateMesa(id, patch) {
  const res = await db.patch('mesas', 'id', id, patch);
  return Array.isArray(res) ? res[0] : res;
}

export async function createMesa(data) {
  const row = {
    id: data.id || 'm' + uid(),
    nombre: data.nombre || 'Mesa',
    kind: data.kind || 'mesa',
    x: data.x ?? 40, y: data.y ?? 40, w: data.w ?? 100, h: data.h ?? 48,
    forma: data.forma || 'rect', sillas: data.sillas ?? 0, silla_dir: data.silla_dir || 'bottom',
    duenos: data.duenos || [], objetos: data.objetos || [], link: data.link || '',
    pc: !!data.pc, orden: data.orden ?? 60,
  };
  return db.insert('mesas', row);
}

export async function deleteMesa(id) {
  return db.del('mesas', 'id', id);
}

// ---------- presencia (check-in / check-out) ----------

export async function fetchPresencia() {
  // Todo el historial (orden reciente primero). El "presente" se filtra en el contexto.
  return db.select('presencia', { order: 'entrada.desc', limit: 1000 });
}

export async function checkIn(session, mesaId) {
  const row = {
    id: uid(), email: session.email, nombre: session.nombre,
    mesa: mesaId || null, entrada: new Date().toISOString(), salida: null,
  };
  return db.insert('presencia', row);
}

export async function checkOut(presenceId) {
  const res = await db.patch('presencia', 'id', presenceId, { salida: new Date().toISOString() });
  return Array.isArray(res) ? res[0] : res;
}

// ---------- reservas ----------

export async function fetchReservas() {
  return db.select('reservas', { order: 'inicio.asc', limit: 1000 });
}

export async function createReserva({ mesa, session, inicio, fin, esDueno }) {
  const row = {
    id: uid(), mesa, email: session.email, nombre: session.nombre,
    inicio, fin, es_dueno: !!esDueno, estado: 'activa', creada: new Date().toISOString(),
  };
  return db.insert('reservas', row);
}

export async function setReservaEstado(id, estado) {
  const res = await db.patch('reservas', 'id', id, { estado });
  return Array.isArray(res) ? res[0] : res;
}

export async function deleteReserva(id) {
  return db.del('reservas', 'id', id);
}

// ---------- helpers de lógica ----------

// ¿Se solapan dos rangos [aIni,aFin) y [bIni,bFin)?
export function overlaps(aIni, aFin, bIni, bFin) {
  return new Date(aIni) < new Date(bFin) && new Date(bIni) < new Date(aFin);
}

// ¿La reserva está activa AHORA?
export function isActiveNow(r, now = new Date()) {
  return r.estado === 'activa' && new Date(r.inicio) <= now && now < new Date(r.fin);
}
