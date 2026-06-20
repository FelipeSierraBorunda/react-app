/* =====================================================================
   ManageView.jsx — Alta / edición de componentes  [MIGRADA · fiel al HTML]
   ===================================================================== */

import { useState, useEffect } from 'react';
import { useInventory } from '../context/InventoryContext.jsx';
import { CONTAINERS, TIPOS } from '../lib/constants.js';
import { nextCode } from '../lib/inventory.js';
import { T } from '../theme.js';

const EMPTY = {
  contenedor: 'G1', cajon: 1, posicion: 1, tipo: 'Resistencia',
  codigoFabricante: '', codigoInterno: '', descripcion: '', cantidad: 0, espacioOcupado: 'Bajo', notas: '',
};

export default function ManageView({ go, editComp, clearEdit }) {
  const { comps, customBoxes, add, edit } = useInventory();
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const isEditing = !!editComp;

  // Precargar datos al entrar en modo edición
  useEffect(() => {
    if (editComp) {
      setForm({ ...EMPTY, ...editComp });
    } else {
      setForm(EMPTY);
    }
  }, [editComp]);

  const allBoxes = [...CONTAINERS, ...customBoxes];
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const ct = allBoxes.find((c) => c.id === form.contenedor);
  const hasComp = !!ct?.compartments;
  const gridCols = ct?.type === 'gabinete' ? 8 : 6;
  const cajonButtons = hasComp ? Array.from({ length: ct.compartments }, (_, i) => i + 1) : [];
  // En edición conserva su código; al agregar calcula el siguiente
  const code = isEditing ? (form.codigoInterno || '') : nextCode(form.contenedor, comps);

  function onContChange(e) {
    const c = e.target.value;
    setForm((f) => ({ ...f, contenedor: c, cajon: 1 }));
  }

  async function save(go2) {
    setError('');
    if (!form.codigoFabricante) return setError('El Código Fabricante es obligatorio');
    setBusy(true);
    try {
      if (isEditing) {
        await edit(editComp.id, { ...form, codigoInterno: code });
        clearEdit && clearEdit();
        go && go('table');
      } else {
        await add({ ...form, codigoInterno: code });
        setForm(EMPTY);
        if (go2) go && go('visual');
      }
    } catch (e) {
      setError(e.message);
    }
    setBusy(false);
  }

  function cancel() {
    clearEdit && clearEdit();
    go && go('table');
  }

  return (
    <div style={{ maxWidth: 700 }}>
      <div style={{ background: '#fff', borderRadius: 12, border: `1px solid ${T.border}`, padding: 28 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: '#0F172A', marginBottom: 4 }}>{isEditing ? 'Editar componente' : 'Agregar componente'}</h2>
        <p style={{ fontSize: 13, color: '#94A3B8', marginBottom: 24 }}>{isEditing ? `Editando ${code}` : 'El código interno se asigna automáticamente. Solo el Código Fabricante es obligatorio.'}</p>

        <div className="resp-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <Field label="Código Fabricante *">
            <input value={form.codigoFabricante} onChange={set('codigoFabricante')} placeholder="RC0402FR-0710KL" style={{ ...input, fontFamily: T.mono }} />
          </Field>
          <Field label="Tipo">
            <select value={form.tipo} onChange={set('tipo')} style={input}>
              {TIPOS.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </Field>
          <Field label="Contenedor">
            <select value={form.contenedor} onChange={onContChange} style={input}>
              {allBoxes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
          <Field label="Descripción">
            <input value={form.descripcion} onChange={set('descripcion')} placeholder="Descripción legible en español" style={input} />
          </Field>

          {hasComp && (
            <div style={{ gridColumn: '1/-1' }}>
              <label style={lbl}>Cajón / Compartimento — selecciona uno</label>
              <div style={{ display: 'grid', gridTemplateColumns: `repeat(${gridCols}, 1fr)`, gap: 4, padding: 10, background: '#F8FAFC', borderRadius: 8, border: `1px solid ${T.border}`, maxHeight: 192, overflowY: 'auto' }}>
                {cajonButtons.map((n) => {
                  const sel = parseInt(form.cajon, 10) === n;
                  return (
                    <button key={n} type="button" onClick={() => setForm((f) => ({ ...f, cajon: n }))}
                      style={{ padding: '7px 0', borderRadius: 6, border: `1px solid ${sel ? T.primary : T.border}`, background: sel ? T.primarySoft : '#fff', color: sel ? T.primary : '#475569', fontWeight: 600, fontSize: 12, cursor: 'pointer', fontFamily: T.font }}>
                      {n}
                    </button>
                  );
                })}
              </div>
              <p style={{ marginTop: 6, fontSize: 12, color: '#64748B' }}>Seleccionado: <strong style={{ color: '#0F172A' }}>Cajón {form.cajon}</strong></p>
            </div>
          )}

          <Field label="Cantidad">
            <input type="number" min="0" value={form.cantidad} onChange={set('cantidad')} style={input} />
          </Field>
          <Field label="Espacio Ocupado">
            <select value={form.espacioOcupado} onChange={set('espacioOcupado')} style={input}>
              <option value="Bajo">Bajo</option>
              <option value="Medio">Medio</option>
              <option value="Alto">Alto</option>
            </select>
          </Field>
          <div style={{ gridColumn: '1/-1' }}>
            <label style={lbl}>Notas</label>
            <input value={form.notas} onChange={set('notas')} placeholder="Encapsulado, tolerancia, observaciones…" style={input} />
          </div>
        </div>

        {error && <div style={{ color: T.danger, fontSize: 13, marginTop: 16, padding: 10, background: '#FEF2F2', borderRadius: 8, border: '1px solid #FEE2E2' }}>{error}</div>}

        <div style={{ display: 'flex', gap: 12, marginTop: 24, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          {isEditing ? (
            <>
              <button onClick={cancel} disabled={busy} style={{ padding: '10px 20px', border: `1px solid ${T.border}`, borderRadius: 8, background: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 500, color: '#475569', fontFamily: T.font }}>Cancelar</button>
              <button onClick={() => save(false)} disabled={busy} style={{ padding: '10px 24px', background: T.primary, color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 600, fontFamily: T.font }}>
                {busy ? 'Guardando…' : 'Guardar cambios'}
              </button>
            </>
          ) : (
            <>
              <button onClick={() => save(false)} disabled={busy} style={{ padding: '10px 20px', border: `1px solid ${T.primary}`, borderRadius: 8, background: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 600, color: T.primary, fontFamily: T.font }}>
                Agregar y seguir aquí
              </button>
              <button onClick={() => save(true)} disabled={busy} style={{ padding: '10px 24px', background: T.primary, color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 600, fontFamily: T.font }}>
                {busy ? 'Guardando…' : 'Agregar e ir a la caja'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

const input = { width: '100%', padding: '9px 12px', border: `1px solid ${T.border}`, borderRadius: 8, fontSize: 13, fontFamily: T.font, color: '#0F172A', outline: 'none', background: '#fff' };
const lbl = { display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 };
function Field({ label, children }) {
  return <div><label style={lbl}>{label}</label>{children}</div>;
}
