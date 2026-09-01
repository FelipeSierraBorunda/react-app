/* =====================================================================
   ProjectsManager.jsx — Gestión de proyectos (rubro de un componente)
   ---------------------------------------------------------------------
   Los proyectos se guardan en la tabla "proyectos" de Supabase y se
   comparten entre todas las cuentas. Un componente puede pertenecer a
   varios (campo componentes.proyectos, arreglo de ids). El color se usa
   en los chips de la tabla y del detalle de componente.
   Accesible para cualquier cuenta con acceso al inventario.
   ===================================================================== */

import { useState } from 'react';
import { useInventory } from '../context/InventoryContext.jsx';
import { T, card, btn } from '../theme.js';

const PRESETS = [
  '#DC2626', '#EA580C', '#D97706', '#CA8A04', '#65A30D', '#16A34A',
  '#059669', '#0D9488', '#0891B2', '#2563EB', '#4F46E5', '#7C3AED',
  '#C026D3', '#DB2777', '#E11D48', '#6366F1', '#0EA5E9', '#64748B',
];

export default function ProjectsManager() {
  const { proyectos, comps, addProyecto, editProyecto, removeProyecto } = useInventory();
  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [color, setColor] = useState('#2563EB');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function add() {
    setError('');
    const name = nombre.trim();
    if (!name) return setError('Escribe un nombre para el proyecto.');
    if (proyectos.some((p) => (p.nombre || '').toLowerCase() === name.toLowerCase())) {
      return setError(`Ya existe un proyecto llamado "${name}".`);
    }
    setBusy(true);
    try {
      await addProyecto({ nombre: name, color, descripcion: descripcion.trim() });
      setNombre(''); setDescripcion(''); setColor('#2563EB');
    } catch (e) {
      setError('No se pudo guardar. ¿Ejecutaste mejoras5-schema.sql en Supabase? ' + e.message);
    }
    setBusy(false);
  }

  const count = (id) => comps.filter((c) => Array.isArray(c.proyectos) && c.proyectos.includes(id)).length;

  async function del(p) {
    const n = count(p.id);
    const msg = n
      ? `"${p.nombre}" está asignado a ${n} componente(s). Se eliminará el proyecto; los componentes no se borran, solo dejan de mostrar la etiqueta. ¿Continuar?`
      : `¿Eliminar el proyecto "${p.nombre}"?`;
    if (!window.confirm(msg)) return;
    try { await removeProyecto(p.id); } catch (e) { alert('Error: ' + e.message); }
  }

  return (
    <div style={{ ...card, padding: 24 }}>
      <h3 style={{ margin: '0 0 4px', fontSize: 14 }}>Proyectos</h3>
      <p style={{ margin: '0 0 18px', fontSize: 12, color: T.muted }}>
        Agrupa componentes por proyecto. Un componente puede pertenecer a varios. Se comparten con todas las cuentas.
      </p>

      {/* Alta */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 180 }}>
          <label style={lbl}>Nombre del proyecto</label>
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()}
            placeholder="p. ej. Estación meteorológica" style={input} />
        </div>
        <div style={{ flex: 1, minWidth: 180 }}>
          <label style={lbl}>Descripción (opcional)</label>
          <input value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder="Breve nota" style={input} />
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
          {busy ? 'Guardando…' : '+ Agregar proyecto'}
        </button>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
        {PRESETS.map((c) => (
          <button key={c} type="button" onClick={() => setColor(c)} title={c}
            style={{ width: 22, height: 22, borderRadius: 6, background: c, cursor: 'pointer',
              border: color.toLowerCase() === c.toLowerCase() ? '2px solid #0F172A' : '1px solid rgba(0,0,0,0.1)' }} />
        ))}
      </div>

      {error && <div style={{ color: T.danger, fontSize: 12, marginTop: 12, padding: 10, background: '#FEF2F2', borderRadius: 8, border: '1px solid #FEE2E2' }}>{error}</div>}

      {/* Lista */}
      <div style={{ marginTop: 22 }}>
        <div style={sectionHdr}>Proyectos ({proyectos.length})</div>
        {proyectos.length === 0 ? (
          <p style={{ fontSize: 12, color: T.muted, margin: '8px 0 0' }}>Aún no hay proyectos.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
            {proyectos.map((p) => (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', background: '#F8FAFC', border: `1px solid ${T.border}`, borderRadius: 8 }}>
                <input type="color" value={p.color || '#2563EB'} onChange={(e) => editProyecto(p.id, { color: e.target.value })} title="Cambiar color"
                  style={{ width: 26, height: 26, padding: 0, border: 'none', borderRadius: 6, background: 'transparent', cursor: 'pointer', flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: T.ink }}>{p.nombre}</div>
                  {p.descripcion && <div style={{ fontSize: 11, color: T.muted }}>{p.descripcion}</div>}
                </div>
                <span style={{ fontSize: 11, color: T.muted, whiteSpace: 'nowrap' }}>{count(p.id)} comp.</span>
                <button onClick={() => del(p)} style={{ ...btn('danger'), padding: '5px 10px', fontSize: 12 }}>Eliminar</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const input = { width: '100%', padding: '9px 12px', border: `1px solid ${T.border}`, borderRadius: 8, fontSize: 13, fontFamily: T.font, color: '#0F172A', outline: 'none', background: '#fff', boxSizing: 'border-box' };
const lbl = { display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 };
const sectionHdr = { fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' };
