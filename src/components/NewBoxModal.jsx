/* =====================================================================
   NewBoxModal.jsx — Crear cajas personalizadas
   ===================================================================== */

import { useState } from 'react';
import { T, card, btn } from '../theme.js';
import { Overlay } from './AuthModal.jsx';
import { COMPARTMENTS_BY_TYPE, imageUrl } from '../lib/constants.js';

export default function NewBoxModal({ onClose, onConfirm }) {
  const [form, setForm] = useState({ name: '', type: 'truper', image: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit() {
    setError('');
    if (!form.name.trim()) return setError('El nombre es obligatorio');
    setBusy(true);
    try {
      await onConfirm({
        name: form.name.trim(),
        type: form.type,
        compartments: COMPARTMENTS_BY_TYPE[form.type],
        image: imageUrl(form.image),
      });
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
            <option value="truper">Caja Truper · 18 divisiones (6·4·2·6)</option>
            <option value="caja12">Caja · 12 compartimentos</option>
            <option value="caja_libre">Caja libre · sin divisiones</option>
          </select>
        </label>

        <label style={{ display: 'block', marginBottom: 14 }}>
          <span style={{ display: 'block', fontSize: 12, fontWeight: 600, color: T.inkSoft, marginBottom: 5 }}>Imagen (nombre de archivo)</span>
          <input value={form.image} onChange={set('image')} placeholder="Ej. caja-truper-5.png" style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: `1px solid ${T.border}`, fontSize: 14, fontFamily: T.font, outline: 'none' }} />
          <span style={{ display: 'block', fontSize: 11, color: T.muted, marginTop: 5 }}>Sube el archivo a <code>public/images/</code> en GitHub con este mismo nombre. Opcional.</span>
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
