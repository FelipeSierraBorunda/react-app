/* =====================================================================
   game.js — Laboratorio virtual: monedas, tienda y progreso del avatar
   ---------------------------------------------------------------------
   Cada usuario tiene una fila en la tabla 'juego' con: monedas, ítems
   comprados, ítems equipados y la marca de la última recompensa.

   Regla de monedas: 10 monedas por cada 30 minutos DENTRO del laboratorio
   (mientras hay un check-in abierto). Se acreditan al abrir el juego y
   periódicamente; 'ult_recompensa' avanza en bloques de 30 min para no
   duplicar pagos entre sesiones.
   ===================================================================== */

import { db } from './supabase.js';

export const BLOQUE_MIN = 30;      // minutos por bloque
export const MONEDAS_BLOQUE = 10;  // monedas por bloque

// ---------- catálogo de la tienda ----------
// tipo: skin (color de ropa) | sombrero | mascota | escritorio
export const TIENDA = [
  // Skins (color de la bata / ropa)
  { id: 'skin_azul',    tipo: 'skin', nombre: 'Bata azul',       precio: 0,   color: '#2563EB' },
  { id: 'skin_rojo',    tipo: 'skin', nombre: 'Bata roja',       precio: 30,  color: '#DC2626' },
  { id: 'skin_verde',   tipo: 'skin', nombre: 'Bata verde',      precio: 30,  color: '#16A34A' },
  { id: 'skin_morado',  tipo: 'skin', nombre: 'Bata morada',     precio: 60,  color: '#7C3AED' },
  { id: 'skin_dorado',  tipo: 'skin', nombre: 'Bata dorada',     precio: 200, color: '#D97706' },
  // Sombreros
  { id: 'hat_none',     tipo: 'sombrero', nombre: 'Sin sombrero', precio: 0,  color: 'transparent' },
  { id: 'hat_grad',     tipo: 'sombrero', nombre: 'Birrete',      precio: 80,  color: '#0F172A' },
  { id: 'hat_safety',   tipo: 'sombrero', nombre: 'Casco',        precio: 50,  color: '#F59E0B' },
  { id: 'hat_crown',    tipo: 'sombrero', nombre: 'Corona',       precio: 250, color: '#EAB308' },
  // Mascotas
  { id: 'pet_none',     tipo: 'mascota', nombre: 'Sin mascota',   precio: 0,   color: 'transparent' },
  { id: 'pet_robot',    tipo: 'mascota', nombre: 'Robot',         precio: 120, color: '#64748B' },
  { id: 'pet_cat',      tipo: 'mascota', nombre: 'Gato',          precio: 90,  color: '#F97316' },
  { id: 'pet_chip',     tipo: 'mascota', nombre: 'Chip vivo',     precio: 150, color: '#10B981' },
  // Escritorios (color del tapete)
  { id: 'desk_gris',    tipo: 'escritorio', nombre: 'Tapete gris', precio: 0,  color: '#E2E8F0' },
  { id: 'desk_azul',    tipo: 'escritorio', nombre: 'Tapete azul', precio: 40, color: '#BFDBFE' },
  { id: 'desk_neon',    tipo: 'escritorio', nombre: 'Tapete neón', precio: 110, color: '#A7F3D0' },
];

export const EQUIPADO_DEFAULT = { skin: 'skin_azul', sombrero: 'hat_none', mascota: 'pet_none', escritorio: 'desk_gris' };

export function itemById(id) { return TIENDA.find((i) => i.id === id) || null; }

// ---------- persistencia ----------
export async function fetchJuego(email) {
  try {
    const rows = await db.select('juego');
    const mine = (rows || []).find((r) => r.email === email);
    return { rows: rows || [], mine: mine || null };
  } catch (e) {
    console.error('[game] fetchJuego:', e);
    return { rows: [], mine: null };
  }
}

export async function saveJuego(email, patch) {
  const row = { email, actualizado: new Date().toISOString(), ...patch };
  try { await db.upsert('juego', [row]); } catch (e) { console.error('[game] saveJuego:', e); }
  return row;
}

// Calcula recompensa pendiente dado el check-in abierto y la última recompensa.
// Devuelve { monedas, nuevaMarca } o null si no hay nada que acreditar.
export function calcRecompensa(miPresencia, ultRecompensa, now = new Date()) {
  if (!miPresencia || !miPresencia.entrada) return null;
  const entrada = new Date(miPresencia.entrada).getTime();
  const base = ultRecompensa ? Math.max(entrada, new Date(ultRecompensa).getTime()) : entrada;
  const elapsedMin = (now.getTime() - base) / 60000;
  const bloques = Math.floor(elapsedMin / BLOQUE_MIN);
  if (bloques <= 0) return null;
  const nuevaMarca = new Date(base + bloques * BLOQUE_MIN * 60000).toISOString();
  return { monedas: bloques * MONEDAS_BLOQUE, nuevaMarca };
}

// ---------- empleado de la semana ----------
// Suma minutos de presencia por usuario en la semana actual (lunes→domingo).
export function empleadoSemana(presencia, now = new Date()) {
  const inicioSemana = startOfWeek(now);
  const acc = {}; // email -> { nombre, min }
  (presencia || []).forEach((p) => {
    if (!p.entrada) return;
    const ini = new Date(p.entrada);
    const fin = p.salida ? new Date(p.salida) : now;
    // recorta al rango de la semana
    const a = Math.max(ini.getTime(), inicioSemana.getTime());
    const b = Math.min(fin.getTime(), now.getTime());
    if (b <= a) return;
    const min = (b - a) / 60000;
    if (!acc[p.email]) acc[p.email] = { email: p.email, nombre: p.nombre, min: 0 };
    acc[p.email].min += min;
  });
  const lista = Object.values(acc).sort((x, y) => y.min - x.min);
  return lista;
}

export function startOfWeek(d) {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7; // lunes = 0
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - day);
  return x;
}
