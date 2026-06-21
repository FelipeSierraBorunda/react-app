/* =====================================================================
   auth.js — Registro, login y sesión (respaldado por Supabase)
   ---------------------------------------------------------------------
   Funciones puras de autenticación. El estado de React (quién está
   logueado) lo gestiona AuthContext; aquí solo hablamos con Supabase y
   con localStorage para recordar la sesión entre recargas.

   NOTA DE SEGURIDAD: el hash es un placeholder de prototipo. En
   producción, usa Supabase Auth (auth.signUp / signInWithPassword) que
   hace el hashing del lado del servidor — no guardes contraseñas tú.
   ===================================================================== */

import { db } from './supabase.js';

const SESSION_KEY = 'li_session';

// Hash determinista simple — SOLO para no guardar texto plano en el proto.
function hash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h << 5) - h + str.charCodeAt(i);
    h |= 0;
  }
  return String(Math.abs(h));
}
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2);

// Trae todas las cuentas indexadas por email (se cachea en AuthContext).
export async function fetchAccounts() {
  const rows = await db.select('usuarios');
  const map = {};
  (rows || []).forEach((u) => { map[u.email] = u; });
  return map;
}

export async function register({ nombre, email, password }, accounts) {
  nombre = (nombre || '').trim();
  email = (email || '').trim().toLowerCase();
  if (!nombre || !email || !password) return { ok: false, error: 'Completa nombre, correo y contraseña' };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { ok: false, error: 'El correo no es válido' };
  if (password.length < 4) return { ok: false, error: 'La contraseña debe tener al menos 4 caracteres' };
  if (accounts[email]) return { ok: false, error: 'Ya existe una cuenta con ese correo' };

  const acc = { id: uid(), email, nombre, pass: hash(password), creado: new Date().toISOString() };
  try {
    await db.insert('usuarios', acc);
  } catch (e) {
    console.error('[auth] register:', e);
    return { ok: false, error: 'No se pudo crear la cuenta (error de conexión)' };
  }
  saveSession(email);
  return { ok: true, user: acc, accounts: { ...accounts, [email]: acc } };
}

export function login({ email, password }, accounts) {
  email = (email || '').trim().toLowerCase();
  const acc = accounts[email];
  if (!acc || acc.pass !== hash(password || '')) {
    return { ok: false, error: 'Correo o contraseña incorrectos' };
  }
  saveSession(email);
  return { ok: true, user: acc };
}

export function logout() {
  try { localStorage.removeItem(SESSION_KEY); } catch (e) {}
}

// Admin: concede o revoca el acceso al inventario de una cuenta.
export async function setInvAccess(email, value) {
  const res = await db.patch('usuarios', 'email', email, { inv_access: !!value });
  return Array.isArray(res) ? res[0] : res;
}

function saveSession(email) {
  try { localStorage.setItem(SESSION_KEY, JSON.stringify(email)); } catch (e) {}
}

// Restaura la sesión guardada validándola contra las cuentas cargadas.
export function restoreSession(accounts) {
  let email = null;
  try { email = JSON.parse(localStorage.getItem(SESSION_KEY)); } catch (e) {}
  if (email && accounts[email]) {
    return { email, nombre: accounts[email].nombre };
  }
  return null;
}
