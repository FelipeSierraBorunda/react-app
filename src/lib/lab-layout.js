/* =====================================================================
   lab-layout.js — Distribución por defecto del croquis (semilla)
   ---------------------------------------------------------------------
   Coordenadas del plano aprobado (v4). El lienzo lógico mide 880×500.
   La primera vez que se abre el croquis y la tabla "mesas" está vacía,
   estas filas se suben a Supabase. Después, la fuente de verdad es la BD
   (el admin puede mover/editar mesas y se guarda allá).
   ===================================================================== */

// Lienzo lógico de referencia (el croquis escala a este tamaño).
export const STAGE_W = 880;
export const STAGE_H = 500;

// kind: mesa | inventario | granja | brazo | almacen
// forma: rect | L     · silla_dir: bottom | top | left | right
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

// Capacidad total (suma de sillas) — usada para el aviso de "lab lleno".
export const TOTAL_SILLAS = DEFAULT_MESAS.reduce((s, m) => s + (m.sillas || 0), 0);
