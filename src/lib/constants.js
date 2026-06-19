/* =====================================================================
   constants.js — Catálogos fijos del inventario
   ---------------------------------------------------------------------
   Contenedores físicos, tipos de componente, colores y prefijos de
   código. Si más adelante quieres que los contenedores vivan en
   Supabase, mueve CONTAINERS a una tabla y cárgalos en inventory.js.
   ===================================================================== */

// Prefijo base (en GitHub Pages es '/react-app/', en local '/')
const B = import.meta.env.BASE_URL;

export const CONTAINERS = [
  { id: 'G1', name: 'Gabinete 1', type: 'gabinete', compartments: 64, image: B + 'images/gabinete.png' },
  { id: 'G2', name: 'Gabinete 2', type: 'gabinete', compartments: 64, image: B + 'images/gabinete.png' },
  { id: 'C1', name: 'Caja 1', type: 'caja12', compartments: 12, image: B + 'images/caja12.png' },
  { id: 'C2', name: 'Caja 2', type: 'caja12', compartments: 12, image: B + 'images/caja12.png' },
  { id: 'C3', name: 'Caja 3', type: 'caja_libre', image: B + 'images/caja-c3.png' },
  { id: 'C4', name: 'Caja 4', type: 'caja_libre', image: B + 'images/caja-c4.png' },
];

export const TIPOS = [
  'Resistencia', 'Capacitor', 'IC', 'Transistor', 'Sensor', 'Regulador',
  'Diodo', 'LED', 'Inductor', 'Conector', 'Actuador', 'Módulo', 'Cristal', 'Relay', 'Otro',
];

// Color por tipo de componente
export const TC = {
  Resistencia: '#DC2626', Capacitor: '#2563EB', IC: '#7C3AED', Transistor: '#D97706',
  Sensor: '#059669', Regulador: '#0891B2', Diodo: '#E11D48', LED: '#F59E0B',
  Inductor: '#0D9488', Conector: '#C026D3', Actuador: '#65A30D', 'Módulo': '#16A34A', Cristal: '#6366F1',
  Relay: '#EA580C', Otro: '#64748B',
};

// Prefijo de código interno por contenedor
export const PREFIX = { G1: '0', G2: '1', C1: '2', C2: '3', C3: '4', C4: '5' };

// Etiquetas y colores para el registro de actividad
export const TYPELBL = {
  usar: 'Usó', agregar: 'Agregó', modificar: 'Modificó',
  eliminar: 'Eliminó', importar: 'Importó',
};
export const TYPECLR = {
  usar: '#2563EB', agregar: '#16A34A', modificar: '#D97706',
  eliminar: '#DC2626', importar: '#0891B2',
};

// Contraseña del modo administrador (prototipo). En producción, valida
// roles en Supabase (columna "rol" en usuarios) en vez de una constante.
export const ADMIN_PASSWORD = '1234';

// ---- helpers compartidos ----
export const rgba = (hex, a) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
};

export const fmtDate = (ts) => {
  try {
    return new Date(ts).toLocaleString('es', {
      day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit',
    });
  } catch (e) { return ts; }
};
