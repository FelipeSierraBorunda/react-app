/* =====================================================================
   NewBoxModal.jsx — Crear cajas personalizadas
   ===================================================================== */

import { useState } from 'react';
import { T, card, btn } from '../theme.js';
import { Overlay } from './AuthModal.jsx';

export default function NewBoxModal({ onClose, onConfirm }) {
  const [form, setForm] = useState({ name: '', type: 'caja12' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit() {
    setError('');
    if (!form.name.trim()) return setError('El nombre es obligatorio');
    setBusy(true);
    try {
      await onConfirm(form);
      onClose();
    } catch (e) {
      setError(e.message);
    }
    setBusy(false);
  }

  return (
    <Overlay onClose={onClose}>
      <div style={{ ...card, padding: 28, maxWidth: 420, width: '100%' }} onClick={(e) => e.stopPropagation()}>
        <h2 style={{ margin: '0 0 4px', fontSize: 18 }}>Nueva caja</h2>
        <p style={{ margin: '0 0 18px', fontSize: 13, color: T.muted }}>Crea un contenedor personalizado.</p>

        <label style={{ display: 'block', marginBottom: 14 }}>
          <span style={{ display: 'block', fontSize: 12, fontWeight: 600, color: T.inkSoft, marginBottom: 5 }}>Nombre</span>
          <input value={form.name} onChange={set('name')} placeholder="Ej. Caja módulos" style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: `1px solid ${T.border}`, fontSize: 14, fontFamily: T.font, outline: 'none' }} />
        </label>

        <label style={{ display: 'block', marginBottom: 14 }}>
          <span style={{ display: 'block', fontSize: 12, fontWeight: 600, color: T.inkSoft, marginBottom: 5 }}>Tipo</span>
          <select value={form.type} onChange={set('type')} style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: `1px solid ${T.border}`, fontSize: 14, fontFamily: T.font, outline: 'none' }}>
            <option value="gabinete">Gabinete · 64 cajones</option>
            <option value="caja12">Caja · 12 compartimentos</option>
            <option value="caja_libre">Caja libre · sin divisiones</option>
          </select>
        </label>

        {error && <div style={{ color: T.danger, fontSize: 13, marginBottom: 12 }}>{error}</div>}

        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onClose} style={{ ...btn('ghost'), flex: 1 }}>Cancelar</button>
          <button onClick={submit} disabled={busy} style={{ ...btn('primary'), flex: 1 }}>
            {busy ? 'Creando…' : 'Crear'}
          </button>
        </div>
      </div>
    </Overlay>
  );
}
