/* =====================================================================
   supabase.js — Cliente REST genérico para Supabase (PostgREST)
   ---------------------------------------------------------------------
   Mismo enfoque que el prototipo: fetch directo, sin librerías externas.
   Las credenciales ahora vienen de variables de entorno (.env).
   ===================================================================== */

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.warn('[supabase] Faltan VITE_SUPABASE_URL / VITE_SUPABASE_KEY en .env');
}

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
