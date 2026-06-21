/* =====================================================================
   lab-layout.js — Distribución por defecto del croquis (semilla) + helpers
   ---------------------------------------------------------------------
   Coordenadas del plano aprobado (v4). El lienzo lógico mide 880×500.
   La primera vez que se abre el croquis y la tabla "mesas" está vacía,
   estas filas se suben a Supabase. Después, la fuente de verdad es la BD
   (el admin puede mover/editar mesas y se guarda allá).

   NUEVO (modo edición admin):
   - max_sillas : tope de sillas por mesa (regla del lab, editable).
   - seats      : posiciones reubicables de cada silla [{dx,dy,on}],
                  dx/dy = offset en px respecto a la esquina sup-izq de la mesa.
   - color      : color de relleno de la mesa.
   ===================================================================== */

// Lienzo lógico de referencia (el croquis escala a este tamaño).
export const STAGE_W = 880;
export const STAGE_H = 500;

// Tamaño visual de una silla (diámetro en px).
export const SEAT = 22;

// Paleta de colores permitidos para las mesas (modo edición).
export const MESA_COLORS = [
  '#ffffff', '#E2E8F0', '#DBEAFE', '#CCFBF1',
  '#FEF3C7', '#EDE9FE', '#FFE4E6', '#DCFCE7',
];

// kind: mesa | inventario | granja | brazo | almacen
// forma: rect | L     · silla_dir (legacy): bottom | top | left | right
export const DEFAULT_MESAS = [
  // ----- fila superior -----
  { id: '1',  nombre: 'Mesa 1', kind: 'mesa', x: 14,  y: 14,  w: 150, h: 96, forma: 'L', sillas: 1, silla_dir: 'bottom', duenos: ['Yumil'], pc: false, orden: 1 },
  { id: '2',  nombre: 'Mesa 2', kind: 'mesa', x: 168, y: 14,  w: 150, h: 96, forma: 'L', sillas: 3, silla_dir: 'bottom', duenos: [], pc: false, orden: 2 },
  { id: '3',  nombre: 'Mesa 3', kind: 'mesa', x: 356, y: 14,  w: 100, h: 48, forma: 'rect', sillas: 1, silla_dir: 'bottom', duenos: [], pc: false, orden: 3 },
  { id: '4',  nombre: 'Mesa 4', kind: 'mesa', x: 464, y: 14,  w: 100, h: 48, forma: 'rect', sillas: 1, silla_dir: 'bottom', duenos: [], pc: true,  orden: 4 },
  { id: 'granja', nombre: 'Granja FPGA', kind: 'granja', x: 600, y: 14, w: 118, h: 48, forma: 'rect', sillas: 0, silla_dir: 'bottom', duenos: [], link: '', orden: 5 },

  // ----- pared derecha -----
  { id: '7',  nombre: 'Mesa 7', kind: 'mesa', x: 826, y: 118, w: 48,  h: 120, forma: 'rect', sillas: 2, silla_dir: 'left', duenos: [], pc: false, orden: 7 },
  { id: 'brazo', nombre: 'Brazo robot', kind: 'brazo', x: 808, y: 248, w: 66, h: 24, forma: 'rect', sillas: 0, silla_dir: 'left', duenos: [], link: '', orden: 99 },
  { id: '8',  nombre: 'Mesa 8', kind: 'mesa', x: 826, y: 282, w: 48,  h: 66,  forma: 'rect', sillas: 1, silla_dir: 'left', duenos: [], pc: false, orden: 8 },
  { id: '9',  nombre: 'Mesa 9', kind: 'mesa', x: 826, y: 358, w: 48,  h: 66,  forma: 'rect', sillas: 1, silla_dir: 'left', duenos: [], pc: false, orden: 9 },

  // ----- pared izquierda / banda media -----
  { id: 'inv', nombre: 'Inventario', kind: 'inventario', x: 14, y: 150, w: 58, h: 80, forma: 'rect', sillas: 0, silla_dir: 'bottom', duenos: [], orden: 50 },
  { id: 'A',  nombre: 'Mesa A', kind: 'mesa', x: 14,  y: 238, w: 58,  h: 158, forma: 'rect', sillas: 0, silla_dir: 'right', duenos: [], objetos: [{ nombre: 'Estación de electrónica' }], pc: false, orden: 14 },
  { id: '5',  nombre: 'Mesa 5', kind: 'mesa', x: 236, y: 182, w: 92,  h: 46,  forma: 'rect', sillas: 1, silla_dir: 'top', duenos: [], pc: true, orden: 5 },
  { id: 'B',  nombre: 'Mesa B', kind: 'mesa', x: 328, y: 150, w: 90,  h: 150, forma: 'rect', sillas: 0, silla_dir: 'right', duenos: [], objetos: [{ nombre: 'Impresora' }], pc: false, orden: 15 },
  { id: '6',  nombre: 'Mesa 6', kind: 'mesa', x: 418, y: 200, w: 210, h: 58,  forma: 'rect', sillas: 2, silla_dir: 'bottom', duenos: [], pc: false, orden: 6 },

  // ----- fila inferior -----
  { id: '10', nombre: 'Mesa 10', kind: 'mesa', x: 120, y: 440, w: 80,  h: 48, forma: 'rect', sillas: 1, silla_dir: 'top', duenos: [], pc: false, orden: 10 },
  { id: '11', nombre: 'Mesa 11', kind: 'mesa', x: 216, y: 440, w: 150, h: 48, forma: 'rect', sillas: 2, silla_dir: 'top', duenos: [], pc: false, orden: 11 },
  { id: '12', nombre: 'Mesa 12', kind: 'mesa', x: 382, y: 440, w: 150, h: 48, forma: 'rect', sillas: 2, silla_dir: 'top', duenos: [], pc: false, orden: 12 },
  { id: '13', nombre: 'Mesa 13', kind: 'mesa', x: 548, y: 440, w: 150, h: 48, forma: 'rect', sillas: 2, silla_dir: 'top', duenos: [], pc: false, orden: 13 },
  { id: 'almacen', nombre: 'Almacén', kind: 'almacen', x: 716, y: 430, w: 150, h: 58, forma: 'rect', sillas: 0, silla_dir: 'top', duenos: [], orden: 51 },
];

// ---------------------------------------------------------------------
// Tope de sillas por defecto (regla del laboratorio). El admin lo puede
// sobrescribir por mesa desde el modo edición.
//   Mesa 1, 3, 4, 5, 8, 9, 10, A → 1
//   Mesa 2                       → 3
//   Mesa B                       → 0
//   resto (6, 7, 11, 12, 13…)    → 2
// ---------------------------------------------------------------------
export function topeDefault(id, kind = 'mesa') {
  if (kind !== 'mesa') return 0;
  if (id === '2') return 3;
  if (id === 'B') return 0;
  if (['1', '3', '4', '5', '8', '9', '10', 'A'].includes(id)) return 1;
  return 2;
}

// Posiciones "legacy" (alrededor de la mesa según silla_dir) para `count`
// sillas. Devuelve offsets {dx,dy} respecto a la esquina sup-izq de la mesa.
// Se usa para sembrar `seats` cuando una mesa aún no tiene posiciones.
export function legacySeats(m, count) {
  const gap = 8;
  const dir = m.silla_dir || 'bottom';
  const pos = [];
  const n = Math.max(count, 1);
  if (dir === 'bottom' || dir === 'top') {
    const total = n * SEAT + (n - 1) * gap;
    const sx = m.w / 2 - total / 2;
    const sy = dir === 'bottom' ? m.h + gap : -SEAT - gap;
    for (let i = 0; i < count; i++) pos.push({ dx: Math.round(sx + i * (SEAT + gap)), dy: Math.round(sy) });
  } else {
    const total = n * SEAT + (n - 1) * gap;
    const sy = m.h / 2 - total / 2;
    const sx = dir === 'right' ? m.w + gap : -SEAT - gap;
    for (let i = 0; i < count; i++) pos.push({ dx: Math.round(sx), dy: Math.round(sy + i * (SEAT + gap)) });
  }
  return pos;
}

// Normaliza una mesa cargada de la BD (o de la semilla) garantizando que
// tenga max_sillas, seats[] y color. NO escribe nada: la migración vive en
// memoria hasta que el admin guarda (entonces sí se persisten las columnas).
export function normalizeMesa(m) {
  const max = (m.max_sillas != null) ? m.max_sillas : topeDefault(m.id, m.kind);

  let seats = Array.isArray(m.seats) ? m.seats.filter(Boolean) : null;
  if (!seats || seats.length === 0) {
    const onCount = Math.min(m.sillas ?? 0, max);
    const base = legacySeats(m, Math.max(max, onCount, 0));
    seats = base.map((p, i) => ({ dx: p.dx, dy: p.dy, on: i < onCount }));
  }
  // Limita a max ranuras; si hay menos que max, completa con ranuras apagadas.
  if (seats.length > max) seats = seats.slice(0, max);
  if (seats.length < max) {
    const extra = legacySeats(m, max).slice(seats.length);
    seats = [...seats, ...extra.map((p) => ({ dx: p.dx, dy: p.dy, on: false }))];
  }

  const sillas = seats.filter((s) => s.on).length;
  const color = m.color || (m.kind === 'mesa' ? '#ffffff' : null);
  return { ...m, max_sillas: max, seats, color, sillas };
}

// Reconstruye el array de seats cuando cambia el tope (max_sillas).
export function resizeSeats(m, nuevoMax) {
  let seats = Array.isArray(m.seats) ? [...m.seats] : [];
  if (seats.length > nuevoMax) {
    seats = seats.slice(0, nuevoMax);
  } else if (seats.length < nuevoMax) {
    const extra = legacySeats(m, nuevoMax).slice(seats.length);
    seats = [...seats, ...extra.map((p) => ({ dx: p.dx, dy: p.dy, on: false }))];
  }
  return seats;
}

// Capacidad total (suma de sillas activas) — usada para el aviso de "lab lleno".
export const TOTAL_SILLAS = DEFAULT_MESAS.reduce((s, m) => s + (m.sillas || 0), 0);
