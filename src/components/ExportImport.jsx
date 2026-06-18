/* =====================================================================
   ExportImport.jsx — Herramientas de backup y restauración
   ===================================================================== */

import { useInventory } from '../context/InventoryContext.jsx';
import { T, btn, card } from '../theme.js';

export default function ExportImport() {
  const { comps } = useInventory();

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
    reader.onload = (evt) => {
      try {
        const data = JSON.parse(evt.target.result);
        if (!Array.isArray(data.componentes) && !Array.isArray(data)) {
          alert('Formato inválido. Debe contener un array de componentes.');
          return;
        }
        const items = Array.isArray(data) ? data : data.componentes;
        alert(`Se importarían ${items.length} componentes. (La importación en masa aún no está implementada en esta versión.)`);
      } catch (err) {
        alert('Error al leer el archivo: ' + err.message);
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
        <label style={{ ...btn('ghost'), cursor: 'pointer', display: 'inline-flex', alignItems: 'center' }}>
          ↑ Importar JSON
          <input type="file" accept=".json" onChange={importJSON} style={{ display: 'none' }} />
        </label>
      </div>
    </div>
  );
}
