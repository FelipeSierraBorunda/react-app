/* =====================================================================
   AuditView.jsx — Auditoría unificada
   ---------------------------------------------------------------------
   Línea de tiempo de TODAS las acciones: inventario, préstamos, lab
   (entradas/salidas/reservas), cuentas y admin. Lee la tabla 'auditoria'
   y, como respaldo histórico, fusiona el changelog y las transacciones
   previas. Filtrable por módulo y por texto. Solo lectura.
   ===================================================================== */

import { useMemo, useState } from 'react';
import { useInventory } from '../context/InventoryContext.jsx';
import { useLang } from '../context/LangContext.jsx';
import { T } from '../theme.js';

const fmt = (s) => { try { return new Date(s).toLocaleString('es', { day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' }); } catch (e) { return s; } };

const ACC = {
  agregar: { c: '#16A34A', bg: '#F0FDF4', lbl: 'Agregó' },
  modificar: { c: '#D97706', bg: '#FFFBEB', lbl: 'Modificó' },
  eliminar: { c: '#DC2626', bg: '#FEF2F2', lbl: 'Eliminó' },
  usar: { c: '#2563EB', bg: '#EFF6FF', lbl: 'Usó' },
  importar: { c: '#0891B2', bg: '#ECFEFF', lbl: 'Importó' },
  prestar: { c: '#7C3AED', bg: '#F5F3FF', lbl: 'Prestó' },
  devolver: { c: '#0D9488', bg: '#F0FDFA', lbl: 'Devolvió' },
  entrar: { c: '#16A34A', bg: '#F0FDF4', lbl: 'Entró' },
  salir: { c: '#64748B', bg: '#F1F5F9', lbl: 'Salió' },
  reservar: { c: '#D97706', bg: '#FFFBEB', lbl: 'Reservó' },
  cancelar: { c: '#DC2626', bg: '#FEF2F2', lbl: 'Canceló' },
  acceso: { c: '#2563EB', bg: '#EFF6FF', lbl: 'Acceso' },
};
const MODULOS = ['inventario', 'prestamo', 'lab', 'cuenta', 'admin'];
const MODLBL = { inventario: 'Inventario', prestamo: 'Préstamos', lab: 'Laboratorio', cuenta: 'Cuentas', admin: 'Admin' };

export default function AuditView() {
  const { auditoria, changelog, usage } = useInventory();
  const { t } = useLang();
  const [mod, setMod] = useState('todos');
  const [q, setQ] = useState('');

  // Fusiona la auditoría nueva con el histórico previo (changelog + usage).
  const eventos = useMemo(() => {
    const fromAudit = (auditoria || []).map((a) => ({
      id: a.id, ts: a.ts, usuario: a.usuario, email: a.email, modulo: a.modulo || 'inventario',
      accion: a.accion, objeto: a.objeto, detalle: a.detalle,
    }));
    const seen = new Set(fromAudit.map((e) => e.id));
    const fromChange = (changelog || []).filter((c) => !seen.has(c.id)).map((c) => ({
      id: 'ch-' + (c.id || c.ts), ts: c.ts, usuario: c.usuario, email: '', modulo: 'inventario',
      accion: c.type, objeto: c.codigo, detalle: c.descripcion,
    }));
    const fromUsage = (usage || []).map((u, i) => ({
      id: 'us-' + (u.id || u.ts + i), ts: u.ts, usuario: u.usuario, email: u.email, modulo: 'inventario',
      accion: 'usar', objeto: u.codigo, detalle: `${u.cantidad} × ${u.descripcion}`,
    }));
    return [...fromAudit, ...fromChange, ...fromUsage].sort((a, b) => new Date(b.ts) - new Date(a.ts));
  }, [auditoria, changelog, usage]);

  const filtrados = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return eventos.filter((e) => {
      if (mod !== 'todos' && e.modulo !== mod) return false;
      if (!needle) return true;
      return [e.usuario, e.objeto, e.detalle, e.accion].some((x) => String(x || '').toLowerCase().includes(needle));
    });
  }, [eventos, mod, q]);

  return (
    <div style={{ maxWidth: 920 }}>
      <div style={{ marginBottom: 18 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: T.ink, margin: '0 0 4px', letterSpacing: '-0.01em' }}>{t('audit.title')}</h1>
        <p style={{ fontSize: 13, color: T.muted, margin: 0 }}>{filtrados.length} de {eventos.length} registros · quién hizo qué y cuándo.</p>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <button onClick={() => setMod('todos')} style={chip(mod === 'todos')}>{t('common.all')}</button>
        {MODULOS.map((m) => <button key={m} onClick={() => setMod(m)} style={chip(mod === m)}>{MODLBL[m]}</button>)}
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('common.search')} style={{ marginLeft: 'auto', padding: '8px 12px', borderRadius: 8, border: `1px solid ${T.border}`, fontSize: 13, fontFamily: T.font, outline: 'none', minWidth: 200 }} />
      </div>

      <div style={{ background: '#fff', border: `1px solid ${T.border}`, borderRadius: 12, overflow: 'hidden' }}>
        {filtrados.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: T.muted, fontSize: 13 }}>{t('audit.empty')}</div>
        ) : (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: '150px 110px 1fr 130px', gap: 12, padding: '10px 16px', borderBottom: `1px solid ${T.border}`, fontSize: 11, fontWeight: 700, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              <span>{t('audit.who')}</span><span>{t('audit.action')}</span><span>{t('audit.detail')}</span><span style={{ textAlign: 'right' }}>{t('audit.when')}</span>
            </div>
            <div style={{ maxHeight: '64vh', overflowY: 'auto' }}>
              {filtrados.slice(0, 600).map((e) => {
                const a = ACC[e.accion] || { c: '#64748B', bg: '#F1F5F9', lbl: e.accion };
                return (
                  <div key={e.id} style={{ display: 'grid', gridTemplateColumns: '150px 110px 1fr 130px', gap: 12, padding: '11px 16px', borderBottom: `1px solid ${T.borderSoft || '#F1F5F9'}`, alignItems: 'center' }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: T.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.usuario || '—'}</span>
                    <span><span style={{ fontSize: 11.5, fontWeight: 700, color: a.c, background: a.bg, padding: '2px 8px', borderRadius: 6 }}>{a.lbl}</span></span>
                    <span style={{ fontSize: 12.5, color: T.inkSoft, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {e.objeto && <strong style={{ color: T.ink, fontFamily: T.mono, fontSize: 11.5, marginRight: 6 }}>{e.objeto}</strong>}
                      {e.detalle}
                    </span>
                    <span style={{ fontSize: 11.5, color: T.muted, textAlign: 'right' }}>{fmt(e.ts)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const chip = (on) => ({
  padding: '7px 13px', borderRadius: 8, cursor: 'pointer', fontSize: 12.5, fontWeight: 600, fontFamily: T.font,
  border: `1px solid ${on ? T.primary : T.border}`, background: on ? T.primarySoft : '#fff', color: on ? T.primary : '#475569',
});
