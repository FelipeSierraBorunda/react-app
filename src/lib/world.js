/* =====================================================================
   world.js — Geometría del mundo del juego (compartida por GameView +
   PixelRoom). El laboratorio real (croquis 880×500 desde Supabase) se
   mantiene igual; a su DERECHA se le añade un pasillo de 4 losas y una
   sala OXXO de 8×8 caminable (estilo tienda de conveniencia).
   ===================================================================== */

import { STAGE_W, STAGE_H } from './lab-layout.js';

export const TILE = 20;

// Laboratorio (mundo original)
export const LAB_W = STAGE_W;   // 880
export const LAB_H = STAGE_H;   // 500

// Pasillo: 4 losas de largo, sale de la pared derecha del lab (a media altura
// del croquis, libre de mesas). Conecta lab ↔ OXXO.
export const HALL = { x: LAB_W, y: 60, w: 4 * TILE, h: 4 * TILE };   // 880..960 × 60..140

// Sala OXXO: 8×8 losas, a la derecha del pasillo, centrada sobre él.
export const OXXO = { x: HALL.x + HALL.w, y: 20, w: 8 * TILE, h: 8 * TILE }; // 960..1120 × 20..180

export const WORLD_W = OXXO.x + OXXO.w;   // 1120
export const WORLD_H = LAB_H;             // 500

// Mostrador / caja (interactúa con E para abrir la tienda)
export const SHOP = { x: OXXO.x + 2 * TILE, y: OXXO.y + TILE, w: 3 * TILE, h: TILE - 4 };

// Mobiliario fijo del OXXO (sólido): refrigeradores, góndolas y caja.
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

// Refrigerador del laboratorio (mueble fijo, estilo HTML). Va en una zona
// libre del centro-izquierda del croquis.
export const LAB_FRIDGE = { x: 120, y: 300, w: 20, h: 27 };
export function labSolids() { return [LAB_FRIDGE]; }

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

// Cuerpo del jugador (~±9px horizontal, desde la cabeza a los pies).
export function walkableBody(cx, cy, half = 9) {
  return walkablePoint(cx - half, cy) && walkablePoint(cx + half, cy)
      && walkablePoint(cx, cy - half + 6) && walkablePoint(cx, cy + half);
}

// Colisión con el mobiliario fijo del OXXO o el refri del lab.
export function hitsOxxo(cx, cy, half = 11) {
  const l = cx - half, r = cx + half, t = cy - half + 6, b = cy + half;
  return [...oxxoSolids(), ...labSolids()].some((o) => r > o.x && l < o.x + o.w && b > o.y && t < o.y + o.h);
}

// ¿Está el jugador junto a la caja del OXXO?
export function nearShop(cx, cy) {
  const r = SHOP;
  const nx = Math.max(r.x, Math.min(cx, r.x + r.w));
  const ny = Math.max(r.y, Math.min(cy, r.y + r.h));
  return Math.hypot(cx - nx, cy - ny) < 30;
}

// Punto de aparición por defecto si no tienes mesa: boca del pasillo (en el lab).
export const SPAWN_HALL = { x: LAB_W - 24, y: HALL.y + HALL.h / 2 };
