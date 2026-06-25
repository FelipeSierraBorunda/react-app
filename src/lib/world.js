/* =====================================================================
   world.js — Geometría del MUNDO DEL JUEGO (independiente del croquis).
   ---------------------------------------------------------------------
   El juego usa una cuadrícula de 19×15 losas (como el HTML) para que las
   proporciones avatar/mesa coincidan. Las mesas del croquis (Supabase,
   880×500) se ESCALAN a este espacio sólo para el juego; el croquis NO se
   modifica. A la derecha se añade un pasillo de 4 losas y una sala OXXO
   de 8×8 caminable.
   ===================================================================== */

export const TILE = 20;

// Croquis original (coordenadas de Supabase)
export const SRC_W = 880, SRC_H = 500;

// Laboratorio del JUEGO: 19×15 losas
export const LAB_COLS = 19, LAB_ROWS = 15;
export const LAB_W = LAB_COLS * TILE;   // 380
export const LAB_H = LAB_ROWS * TILE;   // 300

// Factor de escala croquis → juego
export const SCX = LAB_W / SRC_W;       // 0.4318
export const SCY = LAB_H / SRC_H;       // 0.6

// Escala una mesa del croquis al espacio del juego (incluye asientos).
export function scaleMesa(m) {
  const seats = Array.isArray(m.seats)
    ? m.seats.map((s) => ({ ...s, dx: s.dx * SCX, dy: s.dy * SCY }))
    : m.seats;
  return { ...m, x: m.x * SCX, y: m.y * SCY, w: m.w * SCX, h: m.h * SCY, seats };
}

// Pasillo: 4 losas, sale de la pared derecha del lab (filas 1–4).
export const HALL = { x: LAB_W, y: 0, w: 4 * TILE, h: 4 * TILE };

// Sala OXXO: 8×8 losas, a la derecha del pasillo.
export const OXXO = { x: HALL.x + HALL.w, y: 0, w: 8 * TILE, h: 8 * TILE };

export const WORLD_W = OXXO.x + OXXO.w;   // 620
export const WORLD_H = LAB_H;             // 300

// Mostrador / caja del OXXO (interactúa con E)
export const SHOP = { x: OXXO.x + 2 * TILE, y: OXXO.y + TILE, w: 3 * TILE, h: TILE - 4 };

// Mobiliario fijo del OXXO (sólido)
export const OXXO_FIXTURES = {
  coolers:  { x: OXXO.x + OXXO.w - TILE, y: OXXO.y + TILE,     w: TILE,     h: 6 * TILE },
  gondola1: { x: OXXO.x + 2 * TILE,      y: OXXO.y + 3 * TILE, w: 4 * TILE, h: TILE - 6 },
  gondola2: { x: OXXO.x + 2 * TILE,      y: OXXO.y + 5 * TILE, w: 4 * TILE, h: TILE - 6 },
  checkout: SHOP,
};
export function oxxoSolids() {
  const f = OXXO_FIXTURES;
  return [f.coolers, f.gondola1, f.gondola2, f.checkout];
}

// Refrigerador del laboratorio — MOVIBLE (posición en el layout del juego).
export const FRIDGE_DEFAULT = { x: TILE, y: 5 * TILE, w: TILE, h: 27 };

const inRect = (x, y, r) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;

export function inLab(x, y) { return x >= 0 && x < LAB_W && y >= 0 && y < LAB_H; }

// ¿En qué sala está el punto? null = fuera (pared/vacío).
export function regionAt(x, y) {
  if (inLab(x, y)) return 'lab';
  if (inRect(x, y, HALL)) return 'hall';
  if (inRect(x, y, OXXO)) return 'oxxo';
  return null;
}
export function walkablePoint(x, y) { return regionAt(x, y) != null; }

// Cuerpo del jugador
export function walkableBody(cx, cy, half = 6) {
  return walkablePoint(cx - half, cy) && walkablePoint(cx + half, cy)
      && walkablePoint(cx, cy - half + 4) && walkablePoint(cx, cy + half);
}

// Colisión con mobiliario fijo del OXXO (+ refri opcional)
export function hitsOxxo(cx, cy, half = 7, fridge = null) {
  const l = cx - half, r = cx + half, t = cy - half + 4, b = cy + half;
  const list = fridge ? [...oxxoSolids(), fridge] : oxxoSolids();
  return list.some((o) => r > o.x && l < o.x + o.w && b > o.y && t < o.y + o.h);
}

export function nearShop(cx, cy) {
  const r = SHOP;
  const nx = Math.max(r.x, Math.min(cx, r.x + r.w));
  const ny = Math.max(r.y, Math.min(cy, r.y + r.h));
  return Math.hypot(cx - nx, cy - ny) < 18;
}

// Punto de aparición por defecto: boca del pasillo (en el lab)
export const SPAWN_HALL = { x: LAB_W - 12, y: HALL.y + HALL.h / 2 };

// Paleta y texturas del editor (idénticas al HTML Lab Game)
export const FURNI_COLORS = ['#6e2222', '#356d6d', '#8a5a2a', '#3a4a78', '#4a4a52', '#2f6b3a', '#7a2d5a'];
export const FURNI_TEX = ['liso', 'vetas', 'cuadros'];
