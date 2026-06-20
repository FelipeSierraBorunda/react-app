/* =====================================================================
   TypesManager.jsx — Gestión de tipos de componente (nombre + color)
   ---------------------------------------------------------------------
   Los tipos personalizados se guardan en la tabla "tipos" de Supabase y
   se comparten entre todos los usuarios. El color define el recuadro en
   la vista física y los chips en tablas y estadísticas.
   ===================================================================== */

import { useState } from 'react';
import { useInventory } from '../context/InventoryContext.jsx';
import { TIPOS, TC } from '../lib/constants.js';
import { T, card, btn } from '../theme.js';

// Paleta sugerida para elegir rápido (claves visualmente distintas).
const PRESETS = [
  '#DC2626', '#EA580C', '#D97706', '#CA8A04', '#65A30D', '#16A34A',
  '#059669', '#0D9488', '#0891B2', '#2563EB', '#4F46E5', '#7C3AED',
  '#C026D3', '#DB2777', '#E11D48', '#6366F1', '#0EA5E9', '#64748B',
];

export default function TypesManager() {
  const { customTypes, addTipo, removeTipo } = useInventory();
  const [nombre, setNombre] = useState('');
  const [color, setColor] = useState('#2563EB');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const customNames = customTypes.map((t) => t.nombre);

  async function add() {
    setError('');
    const name = nombre.trim();
    if (!name) return setError('Escribe un nombre para el tipo.');
    if (TIPOS.includes(name) && !customNames.includes(name)) {
      return setError(`"${name}" ya es un tipo base. Elige otro nombre.`);
    }
    setBusy(true);
    try {
      await addTipo({ nombre: name, color });
      setNombre('');
      setColor('#2563EB');
    } catch (e) {
      setError('No se pudo guardar. ¿Creaste la tabla "tipos" en Supabase? ' + e.message);
    }
    setBusy(false);
  }

  async function recolor(name, newColor) {
    try { await addTipo({ nombre: name, color: newColor }); } catch (e) {}
  }

  return (
    <div style={{ ...card, padding: 24, marginBottom: 16 }}>
      <h3 style={{ margin: '0 0 4px', fontSize: 14 }}>Tipos de componente</h3>
      <p style={{ margin: '0 0 18px', fontSize: 12, color: T.muted }}>
        Crea tipos propios con su color de recuadro. Se aplican en toda la app y se comparten con todos los usuarios.
      </p>

      {/* Formulario de alta */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <label style={lbl}>Nombre del tipo</label>
          <input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && add()}
            placeholder="p. ej. Optoacoplador"
            style={input}
          />
        </div>
        <div>
          <label style={lbl}>Color</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="color" value={color} onChange={(e) => setColor(e.target.value)}
              style={{ width: 40, height: 38, padding: 0, border: `1px solid ${T.border}`, borderRadius: 8, background: '#fff', cursor: 'pointer' }} />
            <span style={{ fontSize: 12, fontFamily: T.mono, color: T.inkSoft }}>{color.toUpperCase()}</span>
          </div>
        </div>
        <button onClick={add} disabled={busy} style={{ ...btn('primary'), height: 38 }}>
          {busy ? 'Guardando…' : '+ Agregar tipo'}
        </button>
      </div>

      {/* Paleta rápida */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
        {PRESETS.map((c) => (
          <button key={c} type="button" onClick={() => setColor(c)} title={c}
            style={{ width: 22, height: 22, borderRadius: 6, background: c, cursor: 'pointer',
              border: color.toLowerCase() === c.toLowerCase() ? '2px solid #0F172A' : '1px solid rgba(0,0,0,0.1)' }} />
        ))}
      </div>

      {error && <div style={{ color: T.danger, fontSize: 12, marginTop: 12, padding: 10, background: '#FEF2F2', borderRadius: 8, border: '1px solid #FEE2E2' }}>{error}</div>}

      {/* Tipos personalizados */}
      <div style={{ marginTop: 22 }}>
        <div style={sectionHdr}>Tipos personalizados</div>
        {customTypes.length === 0 ? (
          <p style={{ fontSize: 12, color: T.muted, margin: '8px 0 0' }}>Aún no has creado tipos personalizados.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
            {customTypes.map((t) => (
              <div key={t.nombre} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', background: '#F8FAFC', border: `1px solid ${T.border}`, borderRadius: 8 }}>
                <input type="color" value={t.color} onChange={(e) => recolor(t.nombre, e.target.value)} title="Cambiar color"
                  style={{ width: 26, height: 26, padding: 0, border: 'none', borderRadius: 6, background: 'transparent', cursor: 'pointer', flexShrink: 0 }} />
                <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: T.ink }}>{t.nombre}</span>
                <span style={{ fontSize: 11, fontFamily: T.mono, color: T.muted }}>{(t.color || '').toUpperCase()}</span>
                <button onClick={() => removeTipo(t.nombre)} style={{ ...btn('danger'), padding: '5px 10px', fontSize: 12 }}>Eliminar</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Tipos base (solo referencia) */}
      <div style={{ marginTop: 22 }}>
        <div style={sectionHdr}>Tipos base (no editables)</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
          {TIPOS.map((t) => (
            <div key={t} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 10px 3px 6px', background: '#F8FAFC', border: `1px solid ${T.border}`, borderRadius: 20 }}>
              <span style={{ width: 12, height: 12, borderRadius: 3, background: TC[t] || '#64748B', flexShrink: 0 }} />
              <span style={{ fontSize: 12, color: T.inkSoft }}>{t}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const input = { width: '100%', padding: '9px 12px', border: `1px solid ${T.border}`, borderRadius: 8, fontSize: 13, fontFamily: T.font, color: '#0F172A', outline: 'none', background: '#fff', boxSizing: 'border-box' };
const lbl = { display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 };
const sectionHdr = { fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' };
