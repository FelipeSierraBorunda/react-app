/* =====================================================================
   InventoryContext — Componentes + actividad (carga y CRUD)
   ---------------------------------------------------------------------
   Mantiene en estado el array de componentes, las transacciones y el
   changelog. Expone acciones que escriben en Supabase y actualizan el
   estado de inmediato (optimista). Las vistas consumen esto con
   useInventory().
   ===================================================================== */

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import * as Inv from '../lib/inventory.js';
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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [c, u, ch] = await Promise.all([
        Inv.fetchComponents(),
        Inv.fetchUsage(),
        Inv.fetchChangelog(),
      ]);
      setComps(Array.isArray(c) ? c : []);
      setUsage(u || []);
      setChangelog(ch || []);
      
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

  const value = { comps, usage, changelog, loading, customBoxes, add, edit, remove, use, addCustomBox };
  return <InventoryContext.Provider value={value}>{children}</InventoryContext.Provider>;
}
