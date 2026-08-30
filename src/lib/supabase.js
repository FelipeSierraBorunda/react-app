/* =====================================================================
   supabase.js — Acceso a Supabase
   ---------------------------------------------------------------------
   Dos cosas conviven aquí:

   1. `supabase`  — cliente oficial @supabase/supabase-js. Se usa SOLO
      para autenticación (registro, login, recuperar contraseña) y para
      leer/escribir la tabla `perfiles`. Ver src/lib/auth.js.

   2. `db`        — helper REST mínimo (fetch directo a PostgREST) que
      usa el resto de la app para componentes, mesas, juego, etc. Se
      mantiene tal cual: funciona con la clave publishable y las
      políticas RLS `public_all`.

   Las credenciales vienen de variables de entorno (.env).
   ===================================================================== */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.warn('[supabase] Faltan VITE_SUPABASE_URL / VITE_SUPABASE_KEY en .env');
}

// Cliente oficial: gestiona la sesión (JWT) en localStorage, la renueva
// sola y detecta el enlace de "recuperar contraseña" al abrir la app.
export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

const baseHeaders = {
  'Content-Type': 'application/json',
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
};

const rest = (path) => `${SUPABASE_URL}/rest/v1/${path}`;

export const db = {
  // SELECT * FROM <table> [ORDER BY ...] [LIMIT ...]
  async select(table, { order, limit } = {}) {
    try {
      let url = rest(`${table}?select=*`);
      if (order) url += `&order=${order}`;
      if (limit) url += `&limit=${limit}`;
      const res = await fetch(url, { method: 'GET', headers: baseHeaders });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (e) {
      console.error(`[supabase] select ${table}:`, e);
      return [];
    }
  },

  // INSERT INTO <table> (...) VALUES (...) RETURNING *
  async insert(table, row) {
    const res = await fetch(rest(table), {
      method: 'POST',
      headers: { ...baseHeaders, Prefer: 'return=representation' },
      body: JSON.stringify(row),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(`INSERT ${table}: HTTP ${res.status} ${JSON.stringify(err)}`);
    }
    const data = await res.json();
    return Array.isArray(data) ? data[0] : data;
  },

  // UPDATE <table> SET ... WHERE <col> = <val> RETURNING *
  async patch(table, col, val, patch) {
    const res = await fetch(rest(`${table}?${col}=eq.${encodeURIComponent(val)}`), {
      method: 'PATCH',
      headers: { ...baseHeaders, Prefer: 'return=representation' },
      body: JSON.stringify(patch),
    });
    if (!res.ok) throw new Error(`PATCH ${table}: HTTP ${res.status}`);
    return await res.json();
  },

  // UPSERT (insert masivo; actualiza filas con id duplicado)
  async upsert(table, rows) {
    const res = await fetch(rest(table), {
      method: 'POST',
      headers: { ...baseHeaders, Prefer: 'resolution=merge-duplicates,return=representation' },
      body: JSON.stringify(rows),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(`UPSERT ${table}: HTTP ${res.status} ${JSON.stringify(err)}`);
    }
    return await res.json();
  },

  // DELETE FROM <table> WHERE <col> = <val>
  async del(table, col, val) {
    const res = await fetch(rest(`${table}?${col}=eq.${encodeURIComponent(val)}`), {
      method: 'DELETE',
      headers: baseHeaders,
    });
    if (!res.ok) throw new Error(`DELETE ${table}: HTTP ${res.status}`);
    return true;
  },
};

// ── Sala del juego ─────────────────────────────────────────────────────────
// Una sola fila (id='lab') con la distribución del juego (posición de mesas,
// sillas, refri, color, textura) para que todos vean los mismos cambios del
// editor admin sin necesidad de recargar la página.
export async function saveSala(config) {
  try {
    await db.upsert('sala', [{ id: 'lab', config, actualizado: new Date().toISOString() }]);
  } catch (e) {
    console.error('[supabase] saveSala:', e);
  }
}

export async function loadSala() {
  try {
    const rows = await db.select('sala');
    const r = (rows || []).find((x) => x.id === 'lab');
    return r ? r.config : null;
  } catch (e) {
    console.error('[supabase] loadSala:', e);
    return null;
  }
}
