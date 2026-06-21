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
import { TIPOS, TC, CONTAINERS } from '../lib/constants.js';
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
  const [contMesa, setContMesa] = useState({}); // { contenedorId: mesaId }
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

      // Mapa contenedor → mesa/módulo (compartido en Supabase, fallback local).
      let cm = await Inv.fetchAjuste('cont_mesa');
      if (!cm) { try { cm = JSON.parse(localStorage.getItem('li_cont_mesa') || '{}'); } catch (e) { cm = {}; } }
      setContMesa(cm || {});

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

  // ---------- ubicación (almacenamiento jerárquico) ----------
  // Catálogo completo de contenedores (base + personalizados), cada uno
  // con la mesa/módulo donde está físicamente (ubicación general).
  const allContainers = useMemo(
    () => [...CONTAINERS, ...customBoxes].map((c) => ({ ...c, mesa: contMesa[c.id] || c.mesa || null })),
    [customBoxes, contMesa]
  );
  const containerById = useCallback((id) => allContainers.find((c) => c.id === id) || null, [allContainers]);

  // ¿Está suelto (no vive en un contenedor)?
  const esSuelto = useCallback((c) => !c.contenedor || c.contenedor === 'SUELTO', []);

  // Ubicación general (mesa/módulo) de un componente: si está suelto, su
  // campo `mesa`; si vive en un contenedor, la mesa de ese contenedor.
  const generalLocOf = useCallback((c) => {
    if (esSuelto(c)) return c.mesa || null;
    const ct = containerById(c.contenedor);
    return ct ? ct.mesa : null;
  }, [esSuelto, containerById]);

  // Contenedores asignados a una mesa/módulo.
  const containersInMesa = useCallback((mesaId) => allContainers.filter((c) => c.mesa === mesaId), [allContainers]);
  // Componentes sueltos asentados directamente en una mesa/módulo.
  const looseInMesa = useCallback((mesaId) => comps.filter((c) => esSuelto(c) && c.mesa === mesaId), [comps, esSuelto]);

  // Admin: asigna (o limpia) la mesa/módulo de un contenedor. Persiste en
  // Supabase (ajustes.cont_mesa) y en localStorage como respaldo.
  const setContenedorMesa = useCallback((contId, mesaId) => {
    setContMesa((prev) => {
      const next = { ...prev };
      if (mesaId) next[contId] = mesaId; else delete next[contId];
      try { localStorage.setItem('li_cont_mesa', JSON.stringify(next)); } catch (e) {}
      Inv.saveAjuste('cont_mesa', next);
      return next;
    });
  }, []);

  const value = { comps, usage, changelog, loading, customBoxes, customTypes, tipos, tcMap, add, edit, remove, use, addCustomBox, addTipo, removeTipo, importMany,
    allContainers, containerById, esSuelto, generalLocOf, containersInMesa, looseInMesa, contMesa, setContenedorMesa };
  return <InventoryContext.Provider value={value}>{children}</InventoryContext.Provider>;
}
