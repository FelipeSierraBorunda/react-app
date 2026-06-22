/* =====================================================================
   PrestamosView.jsx — Equipo prestable (no consumible)
   ---------------------------------------------------------------------
   Lista los componentes marcados como "prestable" (FPGA, multímetro,
   osciloscopio…) agrupados por estado: disponible / prestado / retrasado.
   Permite prestar (a una cuenta registrada, con fecha de devolución) y
   registrar la devolución. El histórico vive en la tabla 'prestamos'.
   ===================================================================== */

import { useState, useMemo, useEffect } from 'react';
import { useInventory } from '../context/InventoryContext.jsx';
import { useLab } from '../context/LabContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useLang } from '../context/LangContext.jsx';
import { T } from '../theme.js';

const pad = (x) => String(x).padStart(2, '0');
const toLocalInput = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
const fmt = (s) => { if (!s) return '—'; try { return new Date(s).toLocaleString('es', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }); } catch (e) { return s; } };

const ESTADO = {
  disponible: { bg: '#F0FDF4', bd: '#BBF7D0', fg: '#15803D', dot: '#16A34A' },
  prestado: { bg: '#FFFBEB', bd: '#FDE68A', fg: '#B45309', dot: '#D97706' },
  retrasado: { bg: '#FEF2F2', bd: '#FECACA', fg: '#B91C1C', dot: '#DC2626' },
};

export default function PrestamosView({ go }) {
  const { comps, prestamos, loanState, lend, returnLoan } = useInventory();
  const { cuentas, ensureLoaded } = useLab();
  const { loggedIn } = useAuth();
  const { t } = useLang();
  const [open, setOpen] = useState(null); // id del componente en panel de préstamo

  useEffect(() => { ensureLoaded(); }, [ensureLoaded]);

  const prestables = useMemo(() => comps.filter((c) => c.prestable), [comps]);
  const grupos = useMemo(() => {
    const g = { retrasado: [], prestado: [], disponible: [] };
    prestables.forEach((c) => g[loanState(c)].push(c));
    return g;
  }, [prestables, loanState]);

  const historialActivos = prestamos.filter((p) => p.estado === 'activo');

  if (prestables.length === 0) {
    return (
      <div style={{ maxWidth: 760 }}>
        <Header t={t} n={0} />
        <div style={{ background: '#fff', border: `1px solid ${T.border}`, borderRadius: 12, padding: 40, textAlign: 'center', color: T.muted }}>
          <div style={{ fontSize: 34, marginBottom: 10 }}>🔬</div>
          <p style={{ fontSize: 14, margin: 0 }}>No hay equipo prestable todavía.</p>
          <p style={{ fontSize: 12.5, margin: '6px 0 0' }}>Marca un componente como <strong>“equipo prestable”</strong> al crearlo o editarlo (FPGA, multímetro…).</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 880 }}>
      <Header t={t} n={prestables.length} />

      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        <Pill color={ESTADO.disponible} label={t('loan.available')} n={grupos.disponible.length} />
        <Pill color={ESTADO.prestado} label={t('loan.lent')} n={grupos.prestado.length} />
        <Pill color={ESTADO.retrasado} label={t('loan.overdue')} n={grupos.retrasado.length} />
      </div>

      {['retrasado', 'prestado', 'disponible'].map((estado) => grupos[estado].length > 0 && (
        <div key={estado} style={{ marginBottom: 22 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: ESTADO[estado].fg, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 9 }}>
            {t('loan.' + (estado === 'disponible' ? 'available' : estado === 'prestado' ? 'lent' : 'overdue'))} · {grupos[estado].length}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
            {grupos[estado].map((c) => (
              <LoanCard key={c.id} comp={c} estado={estado} t={t} loggedIn={loggedIn}
                open={open === c.id} setOpen={(v) => setOpen(v ? c.id : null)}
                cuentas={cuentas} onLend={lend} onReturn={returnLoan} />
            ))}
          </div>
        </div>
      ))}

      {historialActivos.length > 0 && (
        <div style={{ marginTop: 14, fontSize: 12, color: T.muted }}>
          {historialActivos.length} préstamo(s) activo(s) · histórico completo en Auditoría.
        </div>
      )}
    </div>
  );
}

function Header({ t, n }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: T.ink, margin: '0 0 4px', letterSpacing: '-0.01em' }}>{t('loan.equipment')}</h1>
      <p style={{ fontSize: 13, color: T.muted, margin: 0 }}>{n} equipo(s) prestable(s) · {t('loan.consumables')} no aparecen aquí.</p>
    </div>
  );
}

function Pill({ color, label, n }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 7, background: color.bg, border: `1px solid ${color.bd}`, borderRadius: 10, padding: '7px 13px' }}>
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: color.dot }} />
      <span style={{ fontSize: 13, fontWeight: 700, color: color.fg }}>{n}</span>
      <span style={{ fontSize: 12.5, color: color.fg }}>{label}</span>
    </div>
  );
}

function LoanCard({ comp, estado, t, loggedIn, open, setOpen, cuentas, onLend, onReturn }) {
  const c = ESTADO[estado];
  const disponible = estado === 'disponible';
  const [email, setEmail] = useState('');
  const [due, setDue] = useState(toLocalInput(new Date(Date.now() + 24 * 3600 * 1000)));
  const [busy, setBusy] = useState(false);

  async function doLend() {
    if (!email) return;
    const u = cuentas.find((x) => x.email === email);
    setBusy(true);
    await onLend(comp.id, { email, nombre: u ? u.nombre : email, devolverAntes: due ? new Date(due).toISOString() : null });
    setBusy(false); setOpen(false); setEmail('');
  }

  return (
    <div style={{ background: '#fff', border: `1px solid ${T.border}`, borderRadius: 12, padding: 14, display: 'flex', flexDirection: 'column', gap: 9 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: T.ink, lineHeight: 1.25 }}>{comp.descripcion || comp.codigoFabricante}</div>
          <div style={{ fontSize: 11.5, color: T.muted, fontFamily: T.mono, marginTop: 2 }}>{comp.codigoInterno || comp.codigoFabricante}</div>
        </div>
        <span style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 5, background: c.bg, border: `1px solid ${c.bd}`, color: c.fg, fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 20 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: c.dot }} />
          {t('loan.' + (disponible ? 'available' : estado === 'prestado' ? 'lent' : 'overdue'))}
        </span>
      </div>

      {!disponible && (
        <div style={{ fontSize: 12, color: T.inkSoft, background: c.bg, border: `1px solid ${c.bd}`, borderRadius: 8, padding: '7px 10px' }}>
          <div><strong>{t('loan.lentTo')}:</strong> {comp.prestado_nombre || comp.prestado_a}</div>
          {comp.devolver_antes && <div style={{ marginTop: 2 }}><strong>{t('loan.due')}:</strong> {fmt(comp.devolver_antes)}</div>}
        </div>
      )}

      {loggedIn && disponible && !open && (
        <button onClick={() => setOpen(true)} style={{ ...btnSm(T.primary, '#fff'), border: 'none' }}>{t('loan.lend')}</button>
      )}
      {loggedIn && disponible && open && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7, borderTop: `1px solid ${T.border}`, paddingTop: 9 }}>
          <select value={email} onChange={(e) => setEmail(e.target.value)} style={inp}>
            <option value="">— {t('loan.lentTo')} —</option>
            {cuentas.map((u) => <option key={u.email} value={u.email}>{u.nombre} · {u.email}</option>)}
          </select>
          <label style={{ fontSize: 11, fontWeight: 600, color: T.inkSoft }}>{t('loan.due')}
            <input type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} style={{ ...inp, marginTop: 3 }} />
          </label>
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={() => setOpen(false)} style={{ ...btnSm('#fff', '#475569'), flex: 1, border: `1px solid ${T.border}` }}>{t('common.cancel')}</button>
            <button onClick={doLend} disabled={!email || busy} style={{ ...btnSm(T.primary, '#fff'), flex: 1, border: 'none', opacity: !email || busy ? 0.5 : 1 }}>{busy ? '…' : t('loan.lend')}</button>
          </div>
        </div>
      )}
      {loggedIn && !disponible && (
        <button onClick={() => onReturn(comp.id)} style={{ ...btnSm('#fff', '#15803D'), border: '1px solid #BBF7D0' }}>{t('loan.return')}</button>
      )}
    </div>
  );
}

const inp = { width: '100%', padding: '7px 10px', borderRadius: 7, border: `1px solid ${T.border}`, fontSize: 12.5, fontFamily: T.font, outline: 'none', boxSizing: 'border-box', background: '#fff', color: T.ink };
const btnSm = (bg, fg) => ({ padding: '8px 12px', borderRadius: 8, cursor: 'pointer', fontSize: 12.5, fontWeight: 700, fontFamily: T.font, background: bg, color: fg });
