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
    mesa: c.mesa || '',
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

// ---------- auditoría (registro unificado) ----------
// Log central de acciones. Nunca rompe el flujo si la tabla no existe.
export async function logAudit(session, { modulo, accion, objeto, detalle }) {
  const row = {
    id: uid(),
    ts: new Date().toISOString(),
    email: session ? session.email : '',
    usuario: session ? session.nombre : 'Sistema',
    modulo: modulo || '',
    accion: accion || '',
    objeto: objeto || '',
    detalle: detalle || '',
  };
  try { await db.insert('auditoria', row); } catch (e) { console.error('[inventory] logAudit:', e); }
  return row;
}

export async function fetchAuditoria() {
  try { return await db.select('auditoria', { order: 'ts.desc', limit: 1000 }); }
  catch (e) { return []; }
}

// ---------- préstamos (equipo no consumible) ----------
export async function fetchPrestamos() {
  try { return await db.select('prestamos', { order: 'desde.desc', limit: 500 }); }
  catch (e) { return []; }
}

// Presta un componente: marca el componente y crea el registro histórico.
export async function lendComponent(comp, { email, nombre, devolverAntes }, session) {
  const desde = new Date().toISOString();
  const patch = {
    prestado_a: email, prestado_nombre: nombre,
    prestado_desde: desde, devolver_antes: devolverAntes || null,
  };
  await db.patch('componentes', 'id', comp.id, patch);
  const reg = {
    id: uid(), componente: comp.id, codigo: comp.codigoInterno || '', descripcion: comp.descripcion || '',
    email, usuario: nombre, por_email: session?.email || '', por_usuario: session?.nombre || '',
    desde, devolver_antes: devolverAntes || null, hasta: null, estado: 'activo',
  };
  try { await db.insert('prestamos', reg); } catch (e) { console.error('[inventory] lend:', e); }
  return { patch, reg };
}

// Devuelve un componente: limpia el componente y cierra el registro activo.
export async function returnComponent(comp, prestamos, session) {
  const hasta = new Date().toISOString();
  const patch = { prestado_a: '', prestado_nombre: '', prestado_desde: null, devolver_antes: null };
  await db.patch('componentes', 'id', comp.id, patch);
  const activo = (prestamos || []).find((p) => p.componente === comp.id && p.estado === 'activo');
  if (activo) {
    try { await db.patch('prestamos', 'id', activo.id, { hasta, estado: 'devuelto' }); }
    catch (e) { console.error('[inventory] return:', e); }
  }
  return { patch, prestamoId: activo ? activo.id : null, hasta };
}

// ---------- tipos de componente personalizados ----------
// Viven en la tabla "tipos" de Supabase (compartidos entre todos los
// usuarios). Si la tabla aún no existe, fetchTipos devuelve [] sin romper.

export async function fetchTipos() {
  return db.select('tipos', { order: 'creado.asc' });
}

// upsert por clave "nombre": crear uno nuevo o recolorear uno existente.
export async function createTipo({ nombre, color }) {
  return db.upsert('tipos', [{ nombre, color }]);
}

export async function deleteTipo(nombre) {
  return db.del('tipos', 'nombre', nombre);
}

// ---------- ajustes (clave/valor compartido en Supabase) ----------
// Guarda configuraciones compartidas entre usuarios. Hoy: 'cont_mesa'
// (mapa contenedor → mesa/módulo). Si la tabla no existe, devuelve null.
export async function fetchAjuste(clave) {
  try {
    const rows = await db.select('ajustes');
    const row = (rows || []).find((r) => r.clave === clave);
    return row ? row.valor : null;
  } catch (e) {
    console.error('[inventory] fetchAjuste:', e);
    return null;
  }
}

export async function saveAjuste(clave, valor) {
  try {
    await db.upsert('ajustes', [{ clave, valor, actualizado: new Date().toISOString() }]);
  } catch (e) {
    console.error('[inventory] saveAjuste:', e);
  }
}
