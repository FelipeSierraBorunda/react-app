/* =====================================================================
   ExportImport.jsx — Herramientas de backup y restauración
   ===================================================================== */

import { useState } from 'react';
import { useInventory } from '../context/InventoryContext.jsx';
import { T, btn, card } from '../theme.js';

export default function ExportImport() {
  const { comps, importMany } = useInventory();
  const [busy, setBusy] = useState(false);

  function exportJSON() {
    const data = { componentes: comps, exportDate: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `inventario-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function importJSON(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const data = JSON.parse(evt.target.result);
        if (!Array.isArray(data.componentes) && !Array.isArray(data)) {
          alert('Formato inválido. Debe contener un array de componentes.');
          return;
        }
        const items = Array.isArray(data) ? data : data.componentes;
        if (!window.confirm(`¿Importar ${items.length} componentes? Los que tengan el mismo ID se actualizarán.`)) return;
        setBusy(true);
        const n = await importMany(items);
        setBusy(false);
        alert(`✓ ${n} componentes importados correctamente.`);
      } catch (err) {
        setBusy(false);
        alert('Error al importar: ' + err.message);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  return (
    <div style={{ ...card, padding: 24 }}>
      <h3 style={{ margin: '0 0 14px', fontSize: 14 }}>Backup & Restauración</h3>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button onClick={exportJSON} style={btn('primary')}>
          ↓ Descargar JSON ({comps.length} componentes)
        </button>
        <label style={{ ...btn('ghost'), cursor: busy ? 'wait' : 'pointer', display: 'inline-flex', alignItems: 'center', opacity: busy ? 0.6 : 1 }}>
          {busy ? 'Importando…' : '↑ Importar JSON'}
          <input type="file" accept=".json" onChange={importJSON} disabled={busy} style={{ display: 'none' }} />
        </label>
      </div>
    </div>
  );
}
