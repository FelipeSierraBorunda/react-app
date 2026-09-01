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
  const [prestamos, setPrestamos] = useState([]);
  const [auditoria, setAuditoria] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [c, u, ch, tp, pr, au] = await Promise.all([
        Inv.fetchComponents(),
        Inv.fetchUsage(),
        Inv.fetchChangelog(),
        Inv.fetchTipos(),
        Inv.fetchPrestamos(),
        Inv.fetchAuditoria(),
      ]);
      setComps(Array.isArray(c) ? c : []);
      setUsage(u || []);
      setChangelog(ch || []);
      setCustomTypes(Array.isArray(tp) ? tp : []);
      setPrestamos(Array.isArray(pr) ? pr : []);
      setAuditoria(Array.isArray(au) ? au : []);
      
      // Cajas personalizadas: ahora viven en Supabase (compartidas entre
      // cuentas). Si la tabla aún tiene menos filas que el localStorage de
      // este navegador, subimos las que falten (migración única del modelo
      // viejo, que solo guardaba en localStorage).
      let boxes = await Inv.fetchContenedores();
      boxes = Array.isArray(boxes) ? boxes : [];
      try {
        const saved = JSON.parse(localStorage.getItem('li_custom_boxes') || '[]');
        const faltan = saved.filter((b) => b && b.id && !boxes.some((x) => x.id === b.id));
        for (const b of faltan) {
          try { await Inv.createContenedor(b); boxes.push(b); } catch (e) {}
        }
        // Ya migradas: el localStorage deja de ser la fuente de verdad.
        if (saved.length) localStorage.removeItem('li_custom_boxes');
      } catch (e) {}
      setCustomBoxes(boxes);

      // Mapa contenedor → mesa/módulo (compartido en Supabase, fallback local).
      let cm = await Inv.fetchAjuste('cont_mesa');
      if (!cm) { try { cm = JSON.parse(localStorage.getItem('li_cont_mesa') || '{}'); } catch (e) { cm = {}; } }
      setContMesa(cm || {});

      setLoading(false);
    })();
  }, []);

  // Registra una entrada de auditoría (y la refleja en el estado local).
  const audit = useCallback(async (entry) => {
    const row = await Inv.logAudit(session, entry);
    setAuditoria((prev) => [row, ...prev]);
  }, [session]);

  const add = useCallback(async (data) => {
    const row = await Inv.createComponent(data, comps);
    setComps((prev) => [...prev, row]);
    await Inv.logChange(session, { type: 'agregar', codigo: row.codigoInterno, descripcion: row.descripcion, tipo: row.tipo, cantidad: row.cantidad });
    audit({ modulo: 'inventario', accion: 'agregar', objeto: row.codigoInterno, detalle: row.descripcion });
    return row;
  }, [comps, session, audit]);

  const edit = useCallback(async (id, patch) => {
    const row = await Inv.updateComponent(id, patch);
    setComps((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
    await Inv.logChange(session, { type: 'modificar', codigo: patch.codigoInterno, descripcion: patch.descripcion, tipo: patch.tipo, cantidad: patch.cantidad });
    audit({ modulo: 'inventario', accion: 'modificar', objeto: patch.codigoInterno, detalle: patch.descripcion });
    return row;
  }, [session, audit]);

  const remove = useCallback(async (id) => {
    const target = comps.find((c) => c.id === id);
    await Inv.deleteComponent(id);
    setComps((prev) => prev.filter((c) => c.id !== id));
    if (target) {
      await Inv.logChange(session, { type: 'eliminar', codigo: target.codigoInterno, descripcion: target.descripcion, tipo: target.tipo, cantidad: target.cantidad });
      audit({ modulo: 'inventario', accion: 'eliminar', objeto: target.codigoInterno, detalle: target.descripcion });
    }
  }, [comps, session, audit]);

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
    audit({ modulo: 'inventario', accion: 'usar', objeto: c.codigoInterno, detalle: `${qty} × ${c.descripcion}` });
  }, [comps, session, audit]);

  // ---------- préstamos (equipo no consumible) ----------
  const lend = useCallback(async (id, { email, nombre, devolverAntes }) => {
    const c = comps.find((x) => x.id === id);
    if (!c) return;
    const { patch, reg } = await Inv.lendComponent(c, { email, nombre, devolverAntes }, session);
    setComps((prev) => prev.map((x) => (x.id === id ? { ...x, ...patch } : x)));
    setPrestamos((prev) => [reg, ...prev]);
    audit({ modulo: 'prestamo', accion: 'prestar', objeto: c.codigoInterno, detalle: `${c.descripcion} → ${nombre}` });
  }, [comps, session, audit]);

  const returnLoan = useCallback(async (id) => {
    const c = comps.find((x) => x.id === id);
    if (!c) return;
    const { patch, prestamoId, hasta } = await Inv.returnComponent(c, prestamos, session);
    setComps((prev) => prev.map((x) => (x.id === id ? { ...x, ...patch } : x)));
    if (prestamoId) setPrestamos((prev) => prev.map((p) => (p.id === prestamoId ? { ...p, hasta, estado: 'devuelto' } : p)));
    audit({ modulo: 'prestamo', accion: 'devolver', objeto: c.codigoInterno, detalle: c.descripcion });
  }, [comps, prestamos, session, audit]);

  // Estado de un componente prestable: 'disponible' | 'prestado' | 'retrasado'.
  const loanState = useCallback((c) => {
    if (!c.prestado_a) return 'disponible';
    if (c.devolver_antes && new Date(c.devolver_antes) < new Date()) return 'retrasado';
    return 'prestado';
  }, []);

  // Crear caja personalizada (compartida en Supabase).
  const addCustomBox = useCallback(async (data) => {
    const box = { id: 'U' + uid(), ...data };
    await Inv.createContenedor(box);
    setCustomBoxes((prev) => [...prev, box]);
    audit({ modulo: 'inventario', accion: 'agregar', objeto: box.name, detalle: 'Nueva caja / contenedor' });
    return box;
  }, [audit]);

  // Eliminar caja personalizada (no toca los componentes que tuviera dentro).
  const removeCustomBox = useCallback(async (id) => {
    const box = customBoxes.find((b) => b.id === id);
    await Inv.deleteContenedor(id);
    setCustomBoxes((prev) => prev.filter((b) => b.id !== id));
    if (box) audit({ modulo: 'inventario', accion: 'eliminar', objeto: box.name, detalle: 'Caja / contenedor eliminado' });
  }, [customBoxes, audit]);

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

  const value = { comps, usage, changelog, loading, customBoxes, customTypes, tipos, tcMap, add, edit, remove, use, addCustomBox, removeCustomBox, addTipo, removeTipo, importMany,
    prestamos, auditoria, audit, lend, returnLoan, loanState,
    allContainers, containerById, esSuelto, generalLocOf, containersInMesa, looseInMesa, contMesa, setContenedorMesa };
  return <InventoryContext.Provider value={value}>{children}</InventoryContext.Provider>;
}
