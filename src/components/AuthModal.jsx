/* =====================================================================
   AuthModal.jsx — Login / Registro
   ---------------------------------------------------------------------
   Usa las acciones del AuthContext. Demuestra el patrón de formulario
   controlado + manejo de error que repetirás en otros modales.
   ===================================================================== */

import { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { T, btn, card } from '../theme.js';

// mode: 'login' | 'register' | 'forgot'
const TITULO = { login: 'Iniciar sesión', register: 'Crear cuenta', forgot: 'Recuperar contraseña' };
const SUBTITULO = {
  login: 'Accede a tu cuenta del laboratorio',
  register: 'Regístrate para gestionar el inventario',
  forgot: 'Te enviaremos un enlace a tu correo para fijar una nueva contraseña',
};

export default function AuthModal({ onClose }) {
  const { login, register, requestPasswordReset } = useAuth();
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ nombre: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const go = (m) => { setMode(m); setError(''); setInfo(''); };

  async function submit() {
    setError('');
    setInfo('');
    setBusy(true);
    try {
      if (mode === 'forgot') {
        const res = await requestPasswordReset(form.email);
        if (!res.ok) return setError(res.error);
        setInfo('Si el correo tiene una cuenta, te enviamos un enlace para restablecer la contraseña. Revisa tu bandeja y la carpeta de spam.');
        return;
      }
      const res = mode === 'login' ? await login(form) : await register(form);
      if (!res.ok) return setError(res.error);
      if (mode === 'register' && res.needsConfirmation) {
        setInfo('Cuenta creada. Revisa tu correo para confirmarla antes de iniciar sesión.');
        return;
      }
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Overlay onClose={onClose}>
      <div style={{ ...card, padding: 28, maxWidth: 380, width: '100%' }} onClick={(e) => e.stopPropagation()}>
        <h2 style={{ margin: '0 0 4px', fontSize: 18 }}>{TITULO[mode]}</h2>
        <p style={{ margin: '0 0 20px', fontSize: 13, color: T.muted }}>{SUBTITULO[mode]}</p>

        {mode === 'register' && (
          <Field label="Nombre" value={form.nombre} onChange={set('nombre')} />
        )}
        <Field label="Correo" type="email" value={form.email} onChange={set('email')} />
        {mode !== 'forgot' && (
          <Field label="Contraseña" type="password" value={form.password} onChange={set('password')} />
        )}

        {mode === 'login' && (
          <div style={{ textAlign: 'right', marginTop: -4, marginBottom: 12 }}>
            <button
              onClick={() => go('forgot')}
              style={{ background: 'none', border: 'none', color: T.primary, cursor: 'pointer', fontWeight: 600, fontSize: 12.5, padding: 0 }}
            >
              ¿Olvidaste tu contraseña?
            </button>
          </div>
        )}

        {error && <div style={{ color: T.danger, fontSize: 13, marginBottom: 12 }}>{error}</div>}
        {info && <div style={{ color: '#15803D', fontSize: 13, marginBottom: 12, lineHeight: 1.4 }}>{info}</div>}

        <button onClick={submit} disabled={busy} style={{ ...btn('primary'), width: '100%', marginTop: 4 }}>
          {busy ? 'Procesando…' : mode === 'login' ? 'Entrar' : mode === 'register' ? 'Crear cuenta' : 'Enviar enlace'}
        </button>

        <div style={{ textAlign: 'center', marginTop: 14, fontSize: 13, color: T.inkSoft }}>
          {mode === 'forgot' ? (
            <button
              onClick={() => go('login')}
              style={{ background: 'none', border: 'none', color: T.primary, cursor: 'pointer', fontWeight: 600, fontSize: 13 }}
            >
              ← Volver a iniciar sesión
            </button>
          ) : (
            <>
              {mode === 'login' ? '¿No tienes cuenta?' : '¿Ya tienes cuenta?'}{' '}
              <button
                onClick={() => go(mode === 'login' ? 'register' : 'login')}
                style={{ background: 'none', border: 'none', color: T.primary, cursor: 'pointer', fontWeight: 600, fontSize: 13 }}
              >
                {mode === 'login' ? 'Regístrate' : 'Inicia sesión'}
              </button>
            </>
          )}
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
