/* =====================================================================
   inventory.js — CRUD de componentes + registro de actividad
   ---------------------------------------------------------------------
   Toda la lógica de negocio del inventario vive aquí, separada de la UI.
   Las vistas (React) llaman a estas funciones y reciben datos planos.

   Las transacciones (quién usó qué) y el changelog (cambios globales) se
   registran en Supabase. La sesión activa la pasa quien llama (desde el
   AuthContext) para no acoplar esta capa al estado de React.
   ===================================================================== */

import { db } from './supabase.js';
import { PREFIX } from './constants.js';

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2);

// ---------- componentes ----------

export async function fetchComponents() {
  return db.select('componentes');
}

// Calcula el siguiente código interno para un contenedor (ej. "2.004")
export function nextCode(contId, comps) {
  const pfx = PREFIX[contId] || '9';
  const used = (comps || [])
    .filter((c) => String(c.codigoInterno || '').startsWith(pfx + '.'))
    .map((c) => parseInt(String(c.codigoInterno).split('.')[1], 10) || 0);
  const next = (used.length ? Math.max(...used) : 0) + 1;
  return `${pfx}.${String(next).padStart(3, '0')}`;
}

export async function createComponent(data, comps) {
  const codigoInterno = data.codigoInterno || nextCode(data.contenedor, comps);
  const row = {
    ...data,
    id: uid(),
    codigoInterno,
    cajon: parseInt(data.cajon, 10) || 1,
    posicion: parseInt(data.posicion, 10) || 1,
    cantidad: parseInt(data.cantidad, 10) || 0,
  };
  return db.insert('componentes', row);
}

export async function updateComponent(id, patch) {
  const res = await db.patch('componentes', 'id', id, patch);
  return Array.isArray(res) ? res[0] : res;
}

export async function deleteComponent(id) {
  return db.del('componentes', 'id', id);
}

// Importación en masa — normaliza y hace upsert por lotes.
export async function importComponents(items) {
  const norm = items.map((c) => ({
    id: c.id || uid(),
    codigoInterno: c.codigoInterno || '',
    contenedor: c.contenedor || '',
    cajon: parseInt(c.cajon, 10) || 1,
    posicion: parseInt(c.posicion, 10) || 1,
    tipo: c.tipo || 'Otro',
    codigoFabricante: c.codigoFabricante || '',
    descripcion: c.descripcion || '',
    cantidad: parseInt(c.cantidad, 10) || 0,
    espacioOcupado: c.espacioOcupado || 'Bajo',
    notas: c.notas || '',
  }));
  // Subir en lotes de 200 para no exceder límites de la API
  const out = [];
  for (let i = 0; i < norm.length; i += 200) {
    const batch = norm.slice(i, i + 200);
    const res = await db.upsert('componentes', batch);
    out.push(...(Array.isArray(res) ? res : []));
  }
  return out;
}

// ---------- registro de actividad ----------

// Una transacción de uso/consumo de un componente por un usuario.
export async function logUsage(session, entry) {
  if (!session) return;
  const row = {
    email: session.email,
    usuario: session.nombre,
    ts: new Date().toISOString(),
    ...entry,
  };
  try { await db.insert('transacciones', row); }
  catch (e) { console.error('[inventory] logUsage:', e); }
}

export async function fetchUsage() {
  return db.select('transacciones', { order: 'ts.desc', limit: 500 });
}

// Un cambio global al inventario (panel admin).
export async function logChange(session, entry) {
  const row = {
    usuario: session ? session.nombre : 'Sistema',
    ts: new Date().toISOString(),
    ...entry,
  };
  try { await db.insert('changelog', row); }
  catch (e) { console.error('[inventory] logChange:', e); }
}

export async function fetchChangelog() {
  return db.select('changelog', { order: 'ts.desc', limit: 500 });
}
