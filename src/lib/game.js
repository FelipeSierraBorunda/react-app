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

// ---------- catálogo de la tienda (OXXO del lab) ----------
// tipo: outfit (ropa) | sombrero | mascota | escritorio | aura
export const TIENDA = [
  // Outfits (ropa completa) — color principal + acento
  { id: 'out_bata',    tipo: 'outfit', nombre: 'Bata de lab',     precio: 0,   color: '#E5E7EB', acento: '#94A3B8' },
  { id: 'out_azul',    tipo: 'outfit', nombre: 'Overol azul',     precio: 40,  color: '#2563EB', acento: '#1E3A8A' },
  { id: 'out_verde',   tipo: 'outfit', nombre: 'Polo verde',      precio: 40,  color: '#16A34A', acento: '#14532D' },
  { id: 'out_hoodie',  tipo: 'outfit', nombre: 'Hoodie negro',    precio: 90,  color: '#111827', acento: '#374151' },
  { id: 'out_varsity', tipo: 'outfit', nombre: 'Chamarra varsity', precio: 140, color: '#B91C1C', acento: '#FCD34D' },
  { id: 'out_neon',    tipo: 'outfit', nombre: 'Traje neón',      precio: 220, color: '#10B981', acento: '#A7F3D0' },
  { id: 'out_gold',    tipo: 'outfit', nombre: 'Traje dorado',    precio: 400, color: '#D97706', acento: '#FDE68A' },
  // Sombreros
  { id: 'hat_none',    tipo: 'sombrero', nombre: 'Sin sombrero',  precio: 0,   color: 'transparent' },
  { id: 'hat_cap',     tipo: 'sombrero', nombre: 'Gorra',         precio: 50,  color: '#DC2626' },
  { id: 'hat_safety',  tipo: 'sombrero', nombre: 'Casco EPP',     precio: 70,  color: '#F59E0B' },
  { id: 'hat_grad',    tipo: 'sombrero', nombre: 'Birrete',       precio: 120, color: '#0F172A' },
  { id: 'hat_beanie',  tipo: 'sombrero', nombre: 'Gorro',         precio: 90,  color: '#7C3AED' },
  { id: 'hat_crown',   tipo: 'sombrero', nombre: 'Corona',        precio: 500, color: '#EAB308' },
  // Mascotas
  { id: 'pet_none',    tipo: 'mascota', nombre: 'Sin mascota',    precio: 0,   color: 'transparent' },
  { id: 'pet_cat',     tipo: 'mascota', nombre: 'Gato',           precio: 110, color: '#F97316' },
  { id: 'pet_dog',     tipo: 'mascota', nombre: 'Perro',          precio: 130, color: '#A16207' },
  { id: 'pet_robot',   tipo: 'mascota', nombre: 'Robot',          precio: 200, color: '#64748B' },
  { id: 'pet_drone',   tipo: 'mascota', nombre: 'Dron',           precio: 260, color: '#0EA5E9' },
  { id: 'pet_chip',    tipo: 'mascota', nombre: 'Chip vivo',      precio: 320, color: '#10B981' },
  // Escritorios (color del tapete/piso bajo el avatar)
  { id: 'desk_gris',   tipo: 'escritorio', nombre: 'Piso gris',   precio: 0,   color: '#E2E8F0' },
  { id: 'desk_madera', tipo: 'escritorio', nombre: 'Piso madera', precio: 60,  color: '#D6A45B' },
  { id: 'desk_azul',   tipo: 'escritorio', nombre: 'Piso azul',   precio: 80,  color: '#BFDBFE' },
  { id: 'desk_neon',   tipo: 'escritorio', nombre: 'Piso neón',   precio: 180, color: '#A7F3D0' },
  // Auras (efecto alrededor del avatar)
  { id: 'aura_none',   tipo: 'aura', nombre: 'Sin aura',          precio: 0,   color: 'transparent' },
  { id: 'aura_glow',   tipo: 'aura', nombre: 'Aura brillante',    precio: 300, color: '#FACC15' },
  { id: 'aura_ice',    tipo: 'aura', nombre: 'Aura de hielo',     precio: 300, color: '#67E8F9' },
  // Decoración del escritorio propio (varias a la vez)
  { id: 'deco_planta', tipo: 'deco', nombre: 'Planta',     precio: 50,  emoji: '🪴' },
  { id: 'deco_lampara',tipo: 'deco', nombre: 'Lámpara',    precio: 60,  emoji: '💡' },
  { id: 'deco_taza',   tipo: 'deco', nombre: 'Café',       precio: 40,  emoji: '☕' },
  { id: 'deco_pc',     tipo: 'deco', nombre: 'Monitor',    precio: 120, emoji: '🖥️' },
  { id: 'deco_oscilo', tipo: 'deco', nombre: 'Osciloscopio', precio: 160, emoji: '📟' },
  { id: 'deco_poster', tipo: 'deco', nombre: 'Póster',     precio: 70,  emoji: '🖼️' },
  { id: 'deco_libro',  tipo: 'deco', nombre: 'Libros',     precio: 45,  emoji: '📚' },
  { id: 'deco_trofeo', tipo: 'deco', nombre: 'Trofeo',     precio: 140, emoji: '🏆' },
];

// La decoración se ACUMULA (no es "equipar"): compras varias y se ven en tu escritorio.
export const ES_ACUMULABLE = (tipo) => tipo === 'deco';

// ---------- insignias por gasto acumulado ----------
// Se desbloquean al gastar monedas (ranking de comprador). Solo cosmético/estatus.
export const INSIGNIAS = [
  { id: 'ins_0',    min: 0,    nombre: 'Novato',       emoji: '🌱', color: '#94A3B8' },
  { id: 'ins_100',  min: 100,  nombre: 'Comprador',    emoji: '🛒', color: '#10B981' },
  { id: 'ins_300',  min: 300,  nombre: 'Coleccionista',emoji: '💎', color: '#0EA5E9' },
  { id: 'ins_600',  min: 600,  nombre: 'Élite',        emoji: '⭐', color: '#8B5CF6' },
  { id: 'ins_1000', min: 1000, nombre: 'Leyenda',      emoji: '👑', color: '#F59E0B' },
];
export function insigniaDe(gastado) {
  let cur = INSIGNIAS[0];
  for (const i of INSIGNIAS) if ((gastado || 0) >= i.min) cur = i;
  return cur;
}
export function siguienteInsignia(gastado) {
  return INSIGNIAS.find((i) => i.min > (gastado || 0)) || null;
}

// ---------- premio de empleado de la semana ----------
export const PREMIO_EMPLEADO_MONEDAS = 100;
export const PREMIO_EMPLEADO_ITEM = 'aura_glow'; // aura exclusiva gratis esa semana
// Identificador de semana ISO-ish (lunes) para no premiar dos veces.
export function semanaId(d = new Date()) {
  const x = startOfWeek(d);
  return `${x.getFullYear()}-W${String(Math.ceil(((x - new Date(x.getFullYear(), 0, 1)) / 86400000 + 1) / 7)).padStart(2, '0')}`;
}

export const EQUIPADO_DEFAULT = {
  outfit: 'out_bata', sombrero: 'hat_none', mascota: 'pet_none', escritorio: 'desk_gris', aura: 'aura_none',
  // personalización gratuita
  pelo: 'pelo_corto', pelo_color: '#3B2A20', piel: '#F2C9A0',
};

// Estilos de pelo gratuitos (id + etiqueta). El render vive en GameView.
export const PELOS = [
  { id: 'pelo_none',  nombre: 'Rapado' },
  { id: 'pelo_corto', nombre: 'Corto' },
  { id: 'pelo_largo', nombre: 'Largo' },
  { id: 'pelo_chongo', nombre: 'Chongo' },
  { id: 'pelo_afro',  nombre: 'Afro' },
  { id: 'pelo_punk',  nombre: 'Punk' },
];

// Tonos de piel y de pelo sugeridos (gratis).
export const PIELES = ['#F8D9B8', '#F2C9A0', '#E0A875', '#C68642', '#8D5524', '#5C3A21'];
export const PELO_COLORES = ['#0F0F0F', '#3B2A20', '#6B4423', '#A65E2E', '#C9A227', '#9CA3AF', '#E5E7EB', '#7C3AED', '#DC2626', '#2563EB'];

export const ITEM_DEFAULT = { outfit: 'out_bata', sombrero: 'hat_none', mascota: 'pet_none', escritorio: 'desk_gris', aura: 'aura_none' };

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

// =====================================================================
// QUIZ colaborativo — preguntas creadas por usuarios, 3 opciones, 24 h,
// una respuesta por usuario. Respuesta correcta = monedas.
// =====================================================================
export const QUIZ_PREMIO = 15;        // monedas por acierto
export const QUIZ_VIDA_H = 24;        // horas que vive una pregunta

export async function fetchQuiz() {
  try {
    const [preguntas, respuestas] = await Promise.all([
      db.select('quiz_preguntas', { order: 'creado.desc', limit: 300 }),
      db.select('quiz_respuestas', { limit: 2000 }),
    ]);
    return { preguntas: preguntas || [], respuestas: respuestas || [] };
  } catch (e) {
    console.error('[game] fetchQuiz:', e);
    return { preguntas: [], respuestas: [] };
  }
}

export function quizActivas(preguntas, now = new Date()) {
  return (preguntas || []).filter((p) => new Date(p.expira) > now);
}

export async function crearPregunta(session, { texto, opciones, correcta, premio }) {
  const ahora = new Date();
  const row = {
    id: uid(),
    autor_email: session?.email || '',
    autor_nombre: session?.nombre || '',
    texto: (texto || '').trim(),
    opciones,
    correcta,
    premio: premio || QUIZ_PREMIO,
    creado: ahora.toISOString(),
    expira: new Date(ahora.getTime() + QUIZ_VIDA_H * 3600 * 1000).toISOString(),
  };
  try { await db.insert('quiz_preguntas', row); } catch (e) { console.error('[game] crearPregunta:', e); }
  return row;
}

export async function responderPregunta(session, pregunta, opcion) {
  const correcta = opcion === pregunta.correcta;
  const row = {
    id: uid(), pregunta: pregunta.id, email: session?.email || '', nombre: session?.nombre || '',
    opcion, correcta, ts: new Date().toISOString(),
  };
  try { await db.insert('quiz_respuestas', row); } catch (e) { console.error('[game] responder:', e); }
  return row;
}

// uid local (mismo formato corto que el resto del proyecto).
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
}
