/* =====================================================================
   AuthModal.jsx — Login / Registro
   ---------------------------------------------------------------------
   Usa las acciones del AuthContext. Demuestra el patrón de formulario
   controlado + manejo de error que repetirás en otros modales.
   ===================================================================== */

import { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { T, btn, card } from '../theme.js';

export default function AuthModal({ onClose }) {
  const { login, register } = useAuth();
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ nombre: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit() {
    setError('');
    setBusy(true);
    const res = mode === 'login' ? login(form) : await register(form);
    setBusy(false);
    if (!res.ok) return setError(res.error);
    onClose();
  }

  return (
    <Overlay onClose={onClose}>
      <div style={{ ...card, padding: 28, maxWidth: 380, width: '100%' }} onClick={(e) => e.stopPropagation()}>
        <h2 style={{ margin: '0 0 4px', fontSize: 18 }}>
          {mode === 'login' ? 'Iniciar sesión' : 'Crear cuenta'}
        </h2>
        <p style={{ margin: '0 0 20px', fontSize: 13, color: T.muted }}>
          {mode === 'login' ? 'Accede a tu cuenta del laboratorio' : 'Regístrate para gestionar el inventario'}
        </p>

        {mode === 'register' && (
          <Field label="Nombre" value={form.nombre} onChange={set('nombre')} />
        )}
        <Field label="Correo" type="email" value={form.email} onChange={set('email')} />
        <Field label="Contraseña" type="password" value={form.password} onChange={set('password')} />

        {error && <div style={{ color: T.danger, fontSize: 13, marginBottom: 12 }}>{error}</div>}

        <button onClick={submit} disabled={busy} style={{ ...btn('primary'), width: '100%', marginTop: 4 }}>
          {busy ? 'Procesando…' : mode === 'login' ? 'Entrar' : 'Crear cuenta'}
        </button>

        <div style={{ textAlign: 'center', marginTop: 14, fontSize: 13, color: T.inkSoft }}>
          {mode === 'login' ? '¿No tienes cuenta?' : '¿Ya tienes cuenta?'}{' '}
          <button
            onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); }}
            style={{ background: 'none', border: 'none', color: T.primary, cursor: 'pointer', fontWeight: 600, fontSize: 13 }}
          >
            {mode === 'login' ? 'Regístrate' : 'Inicia sesión'}
          </button>
        </div>
      </div>
    </Overlay>
  );
}

function Field({ label, ...props }) {
  return (
    <label style={{ display: 'block', marginBottom: 12 }}>
      <span style={{ display: 'block', fontSize: 12, fontWeight: 600, color: T.inkSoft, marginBottom: 5 }}>{label}</span>
      <input
        {...props}
        style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: `1px solid ${T.border}`, fontSize: 14, fontFamily: T.font, outline: 'none' }}
      />
    </label>
  );
}

export function Overlay({ children, onClose }) {
  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
    >
      {children}
    </div>
  );
}
