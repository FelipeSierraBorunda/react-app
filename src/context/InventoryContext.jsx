/* =====================================================================
   InventoryContext — Componentes + actividad (carga y CRUD)
   ---------------------------------------------------------------------
   Mantiene en estado el array de componentes, las transacciones y el
   changelog. Expone acciones que escriben en Supabase y actualizan el
   estado de inmediato (optimista). Las vistas consumen esto con
   useInventory().
   ===================================================================== */

import { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import * as Inv from '../lib/inventory.js';
import { TIPOS, TC } from '../lib/constants.js';
import { useAuth } from './AuthContext.jsx';

const InventoryContext = createContext(null);
export const useInventory = () => useContext(InventoryContext);

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2);

export function InventoryProvider({ children }) {
  const { session } = useAuth();
  const [comps, setComps] = useState([]);
  const [usage, setUsage] = useState([]);
  const [changelog, setChangelog] = useState([]);
  const [customBoxes, setCustomBoxes] = useState([]);
  const [customTypes, setCustomTypes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [c, u, ch, tp] = await Promise.all([
        Inv.fetchComponents(),
        Inv.fetchUsage(),
        Inv.fetchChangelog(),
        Inv.fetchTipos(),
      ]);
      setComps(Array.isArray(c) ? c : []);
      setUsage(u || []);
      setChangelog(ch || []);
      setCustomTypes(Array.isArray(tp) ? tp : []);
      
      // Restaurar cajas personalizadas desde localStorage
      try {
        const saved = localStorage.getItem('li_custom_boxes');
        if (saved) setCustomBoxes(JSON.parse(saved));
      } catch (e) {}
      
      setLoading(false);
    })();
  }, []);

  const add = useCallback(async (data) => {
    const row = await Inv.createComponent(data, comps);
    setComps((prev) => [...prev, row]);
    await Inv.logChange(session, { type: 'agregar', codigo: row.codigoInterno, descripcion: row.descripcion, tipo: row.tipo, cantidad: row.cantidad });
    return row;
  }, [comps, session]);

  const edit = useCallback(async (id, patch) => {
    const row = await Inv.updateComponent(id, patch);
    setComps((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
    await Inv.logChange(session, { type: 'modificar', codigo: patch.codigoInterno, descripcion: patch.descripcion, tipo: patch.tipo, cantidad: patch.cantidad });
    return row;
  }, [session]);

  const remove = useCallback(async (id) => {
    const target = comps.find((c) => c.id === id);
    await Inv.deleteComponent(id);
    setComps((prev) => prev.filter((c) => c.id !== id));
    if (target) await Inv.logChange(session, { type: 'eliminar', codigo: target.codigoInterno, descripcion: target.descripcion, tipo: target.tipo, cantidad: target.cantidad });
  }, [comps, session]);

  // Consumir N unidades de un componente (registra transacción).
  const use = useCallback(async (id, qty) => {
    const c = comps.find((x) => x.id === id);
    if (!c) return;
    const left = Math.max(0, (parseInt(c.cantidad, 10) || 0) - qty);
    await Inv.updateComponent(id, { cantidad: left });
    setComps((prev) => prev.map((x) => (x.id === id ? { ...x, cantidad: left } : x)));
    const tx = { type: 'usar', codigo: c.codigoInterno, descripcion: c.descripcion, tipo: c.tipo, cantidad: qty, contenedor: c.contenedor };
    await Inv.logUsage(session, tx);
    setUsage((prev) => [{ ...tx, email: session?.email, usuario: session?.nombre, ts: new Date().toISOString() }, ...prev]);
  }, [comps, session]);

  // Crear caja personalizada (localStorage)
  const addCustomBox = useCallback((data) => {
    const box = { id: 'U' + uid(), ...data };
    setCustomBoxes((prev) => {
      const next = [...prev, box];
      try { localStorage.setItem('li_custom_boxes', JSON.stringify(next)); } catch (e) {}
      return next;
    });
    return box;
  }, []);

  // Importación en masa desde JSON
  const importMany = useCallback(async (items) => {
    const rows = await Inv.importComponents(items);
    // Fusiona con el estado actual (reemplaza por id, agrega nuevos)
    setComps((prev) => {
      const map = {};
      prev.forEach((c) => { map[c.id] = c; });
      rows.forEach((c) => { map[c.id] = c; });
      return Object.values(map);
    });
    await Inv.logChange(session, { type: 'importar', codigo: '—', descripcion: `Importación de ${rows.length} componentes`, tipo: '', cantidad: rows.length });
    return rows.length;
  }, [session]);

  // ---------- tipos de componente ----------
  // Lista final de tipos = catálogo base (constants) + personalizados.
  const tipos = useMemo(() => {
    const extra = customTypes.map((t) => t.nombre).filter((n) => !TIPOS.includes(n));
    return [...TIPOS, ...extra];
  }, [customTypes]);

  // Mapa color por tipo = colores base sobrescritos/ampliados por los personalizados.
  const tcMap = useMemo(() => {
    const m = { ...TC };
    customTypes.forEach((t) => { if (t && t.nombre) m[t.nombre] = t.color; });
    return m;
  }, [customTypes]);

  const addTipo = useCallback(async ({ nombre, color }) => {
    await Inv.createTipo({ nombre, color });
    setCustomTypes((prev) => {
      const without = prev.filter((t) => t.nombre !== nombre);
      return [...without, { nombre, color }];
    });
  }, []);

  const removeTipo = useCallback(async (nombre) => {
    await Inv.deleteTipo(nombre);
    setCustomTypes((prev) => prev.filter((t) => t.nombre !== nombre));
  }, []);

  const value = { comps, usage, changelog, loading, customBoxes, customTypes, tipos, tcMap, add, edit, remove, use, addCustomBox, addTipo, removeTipo, importMany };
  return <InventoryContext.Provider value={value}>{children}</InventoryContext.Provider>;
}
