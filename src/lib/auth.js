/* =====================================================================
   auth.js — Registro, login, sesión y recuperación de contraseña
   ---------------------------------------------------------------------
   Ahora respaldado por Supabase Auth (auth.users). Supabase hace el
   hashing de la contraseña del lado del servidor y gestiona el JWT de
   sesión; aquí solo traducimos errores al español y leemos el perfil.

   Cada usuario de Supabase Auth tiene una fila en la tabla `perfiles`
   (id = auth.users.id) creada automáticamente por el trigger
   `handle_new_user` de la base de datos. Guarda: email, nombre e
   `inv_access` (permiso para ver el inventario privado).

   La forma de "sesión" que consume la app sigue siendo { email, nombre }
   (ver AuthContext), así que el resto del código no cambió.
   ===================================================================== */

import { supabase } from './supabase.js';

// URL a la que Supabase devuelve al usuario tras confirmar el correo o
// abrir el enlace de recuperación. En GitHub Pages es .../react-app/.
const redirectTo = () => `${window.location.origin}${import.meta.env.BASE_URL || '/'}`;

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

// Traduce los mensajes de Supabase (en inglés) a algo legible en español.
function traducir(msg = '') {
  const m = msg.toLowerCase();
  if (m.includes('invalid login credentials')) return 'Correo o contraseña incorrectos';
  if (m.includes('email not confirmed')) return 'Confirma tu correo antes de entrar. Revisa tu bandeja (y spam).';
  if (m.includes('already registered') || m.includes('already been registered')) return 'Ya existe una cuenta con ese correo. Inicia sesión.';
  if (m.includes('password should be at least')) return 'La contraseña debe tener al menos 6 caracteres';
  if (m.includes('unable to validate email address') || m.includes('invalid email')) return 'El correo no es válido';
  if (m.includes('for security purposes') || m.includes('rate limit') || m.includes('too many requests')) {
    return 'Demasiados intentos seguidos. Espera unos minutos e inténtalo de nuevo.';
  }
  return msg || 'Ocurrió un error. Inténtalo de nuevo.';
}

// ── Registro ──────────────────────────────────────────────────────────
export async function register({ nombre, email, password }) {
  nombre = (nombre || '').trim();
  email = (email || '').trim().toLowerCase();
  if (!nombre || !email || !password) return { ok: false, error: 'Completa nombre, correo y contraseña' };
  if (!EMAIL_RE.test(email)) return { ok: false, error: 'El correo no es válido' };
  if (password.length < 6) return { ok: false, error: 'La contraseña debe tener al menos 6 caracteres' };

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { nombre }, emailRedirectTo: redirectTo() },
  });
  if (error) return { ok: false, error: traducir(error.message) };

  // Correo ya registrado: Supabase devuelve un user con `identities` vacío.
  if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
    return { ok: false, error: 'Ya existe una cuenta con ese correo. Inicia sesión.' };
  }

  return {
    ok: true,
    user: data.user,
    session: data.session,
    // Si el proyecto exige confirmar el correo, no hay sesión todavía.
    needsConfirmation: !data.session,
  };
}

// ── Login ─────────────────────────────────────────────────────────────
export async function login({ email, password }) {
  email = (email || '').trim().toLowerCase();
  if (!email || !password) return { ok: false, error: 'Escribe tu correo y contraseña' };

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { ok: false, error: traducir(error.message) };
  return { ok: true, user: data.user, session: data.session };
}

// ── Logout ────────────────────────────────────────────────────────────
export async function logout() {
  try { await supabase.auth.signOut(); }
  catch (e) { console.error('[auth] logout:', e); }
}

// ── Recuperar contraseña (paso 1: enviar correo) ──────────────────────
export async function requestPasswordReset(email) {
  email = (email || '').trim().toLowerCase();
  if (!EMAIL_RE.test(email)) return { ok: false, error: 'Escribe un correo válido' };

  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: redirectTo() });
  if (error) return { ok: false, error: traducir(error.message) };
  return { ok: true };
}

// ── Recuperar contraseña (paso 2: fijar la nueva) ─────────────────────
// Solo funciona con la sesión temporal que crea el enlace del correo.
export async function updatePassword(nueva) {
  if (!nueva || nueva.length < 6) return { ok: false, error: 'La contraseña debe tener al menos 6 caracteres' };
  const { error } = await supabase.auth.updateUser({ password: nueva });
  if (error) return { ok: false, error: traducir(error.message) };
  return { ok: true };
}

// ── Perfiles ──────────────────────────────────────────────────────────

// Perfil de un usuario por su id (auth.users.id).
export async function fetchPerfil(id) {
  if (!id) return null;
  const { data, error } = await supabase
    .from('perfiles')
    .select('email, nombre, inv_access')
    .eq('id', id)
    .maybeSingle();
  if (error) { console.error('[auth] fetchPerfil:', error); return null; }
  return data || null;
}

// Todas las cuentas, indexadas por email (lo consume el panel admin).
export async function fetchAccounts() {
  const { data, error } = await supabase
    .from('perfiles')
    .select('email, nombre, inv_access');
  if (error) { console.error('[auth] fetchAccounts:', error); return {}; }
  const map = {};
  (data || []).forEach((p) => { if (p.email) map[p.email] = p; });
  return map;
}

// Admin: concede o revoca el acceso al inventario de una cuenta.
export async function setInvAccess(email, value) {
  const { error } = await supabase
    .from('perfiles')
    .update({ inv_access: !!value })
    .eq('email', (email || '').toLowerCase());
  if (error) console.error('[auth] setInvAccess:', error);
}
