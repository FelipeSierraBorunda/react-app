/* =====================================================================
   AuthContext — Sesión de usuario + modo administrador
   ---------------------------------------------------------------------
   Envuelve la app y expone: session, accounts, isAdmin y las acciones
   login/register/logout/enterAdmin/exitAdmin. Carga las cuentas de
   Supabase una vez al montar y restaura la sesión guardada.
   ===================================================================== */

import { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import * as Auth from '../lib/auth.js';
import { ADMIN_PASSWORD } from '../lib/constants.js';

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [accounts, setAccounts] = useState({});
  const [session, setSession] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      const accs = await Auth.fetchAccounts();
      setAccounts(accs);
      setSession(Auth.restoreSession(accs));
      try { setIsAdmin(localStorage.getItem('li_admin') === '1'); } catch (e) {}
      setReady(true);
    })();
  }, []);

  const login = useCallback((creds) => {
    const res = Auth.login(creds, accounts);
    if (res.ok) setSession({ email: res.user.email, nombre: res.user.nombre });
    return res;
  }, [accounts]);

  const register = useCallback(async (data) => {
    const res = await Auth.register(data, accounts);
    if (res.ok) {
      setAccounts(res.accounts);
      setSession({ email: res.user.email, nombre: res.user.nombre });
    }
    return res;
  }, [accounts]);

  const logout = useCallback(() => {
    Auth.logout();
    setSession(null);
    exitAdmin();
  }, []);

  const enterAdmin = useCallback((password) => {
    if (password !== ADMIN_PASSWORD) return { ok: false, error: 'Contraseña incorrecta' };
    try { localStorage.setItem('li_admin', '1'); } catch (e) {}
    setIsAdmin(true);
    return { ok: true };
  }, []);

  const exitAdmin = useCallback(() => {
    try { localStorage.removeItem('li_admin'); } catch (e) {}
    setIsAdmin(false);
  }, []);

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
    accounts, session, isAdmin, ready,
    loggedIn: !!session,
    invAccess, setInvAccess,
    login, register, logout, enterAdmin, exitAdmin,
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
