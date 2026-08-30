/* =====================================================================
   AuthContext — Sesión de usuario + modo administrador
   ---------------------------------------------------------------------
   Envuelve la app y expone: session, accounts, isAdmin, recovery y las
   acciones login/register/logout/enterAdmin/exitAdmin + las de
   recuperación de contraseña. La sesión la gestiona Supabase Auth; aquí
   la traducimos a { email, nombre } (lo que consume el resto de la app)
   combinando el usuario de Supabase con su fila en `perfiles`.
   ===================================================================== */

import { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import * as Auth from '../lib/auth.js';
import { ADMIN_PASSWORD } from '../lib/constants.js';
import { supabase } from '../lib/supabase.js';

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

// ¿Abrimos la app desde el enlace de "recuperar contraseña"?
function urlEsRecuperacion() {
  try {
    const h = window.location.hash || '';
    const q = window.location.search || '';
    return h.includes('type=recovery') || q.includes('type=recovery');
  } catch (e) { return false; }
}

export function AuthProvider({ children }) {
  const [accounts, setAccounts] = useState({});
  const [session, setSession] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [ready, setReady] = useState(false);
  const [recovery, setRecovery] = useState(urlEsRecuperacion);

  // Usuario de Supabase + perfil  →  { email, nombre }
  const buildSession = useCallback(async (user) => {
    if (!user) return null;
    const email = (user.email || '').toLowerCase();
    let nombre = user.user_metadata?.nombre || '';
    const perfil = await Auth.fetchPerfil(user.id);
    if (perfil?.nombre) nombre = perfil.nombre;
    return { email, nombre: nombre || email };
  }, []);

  const refreshAccounts = useCallback(async () => {
    const accs = await Auth.fetchAccounts();
    setAccounts(accs);
    return accs;
  }, []);

  useEffect(() => {
    let alive = true;

    (async () => {
      try { setIsAdmin(localStorage.getItem('li_admin') === '1'); } catch (e) {}
      const { data } = await supabase.auth.getSession();
      const s = await buildSession(data.session?.user);
      if (!alive) return;
      setSession(s);
      await refreshAccounts();
      if (!alive) return;
      setReady(true);
    })();

    const { data: sub } = supabase.auth.onAuthStateChange(async (event, sess) => {
      if (event === 'PASSWORD_RECOVERY') setRecovery(true);
      const s = await buildSession(sess?.user);
      if (!alive) return;
      setSession(s);
      if (sess?.user) refreshAccounts();
    });

    return () => { alive = false; sub.subscription.unsubscribe(); };
  }, [buildSession, refreshAccounts]);

  const login = useCallback(async (creds) => {
    const res = await Auth.login(creds);
    if (res.ok) {
      const s = await buildSession(res.user);
      setSession(s);
      await refreshAccounts();
    }
    return res;
  }, [buildSession, refreshAccounts]);

  const register = useCallback(async (data) => {
    const res = await Auth.register(data);
    if (res.ok && res.session && res.user) {
      const s = await buildSession(res.user);
      setSession(s);
      await refreshAccounts();
    }
    return res;
  }, [buildSession, refreshAccounts]);

  const exitAdmin = useCallback(() => {
    try { localStorage.removeItem('li_admin'); } catch (e) {}
    setIsAdmin(false);
  }, []);

  const logout = useCallback(async () => {
    await Auth.logout();
    setSession(null);
    exitAdmin();
  }, [exitAdmin]);

  const enterAdmin = useCallback((password) => {
    if (password !== ADMIN_PASSWORD) return { ok: false, error: 'Contraseña incorrecta' };
    try { localStorage.setItem('li_admin', '1'); } catch (e) {}
    setIsAdmin(true);
    return { ok: true };
  }, []);

  // ── Recuperación de contraseña ──────────────────────────────────────
  const requestPasswordReset = useCallback((email) => Auth.requestPasswordReset(email), []);

  const updatePassword = useCallback(async (nueva) => {
    const res = await Auth.updatePassword(nueva);
    if (res.ok) {
      setRecovery(false);
      await refreshAccounts();
    }
    return res;
  }, [refreshAccounts]);

  const clearRecovery = useCallback(() => setRecovery(false), []);

  // Admin: concede/revoca acceso al inventario y refresca el estado local.
  const setInvAccess = useCallback(async (email, value) => {
    await Auth.setInvAccess(email, value);
    setAccounts((prev) => ({ ...prev, [email]: { ...prev[email], inv_access: !!value } }));
  }, []);

  // ¿La sesión actual puede ver el inventario? El admin siempre puede.
  const invAccess = useMemo(() => {
    if (isAdmin) return true;
    if (!session) return false;
    return !!(accounts[session.email] && accounts[session.email].inv_access);
  }, [isAdmin, session, accounts]);

  const value = {
    accounts, session, isAdmin, ready, recovery,
    loggedIn: !!session,
    invAccess, setInvAccess,
    login, register, logout, enterAdmin, exitAdmin,
    requestPasswordReset, updatePassword, clearRecovery,
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
