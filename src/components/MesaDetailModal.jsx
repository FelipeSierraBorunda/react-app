/* =====================================================================
   MesaDetailModal.jsx — Detalle de una mesa
   ---------------------------------------------------------------------
   Muestra dueños, objetos/equipo, sillas y quién está. Permite registrar
   entrada en la mesa, reservar (con la regla dueño/externo de LabContext)
   y editar la mesa (cualquier usuario con sesión).
   ===================================================================== */

import { useState } from 'react';
import { useLab } from '../context/LabContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { T, btn } from '../theme.js';
import { Overlay } from './AuthModal.jsx';

const iniciales = (n = '') => n.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('') || '?';
const pad = (x) => String(x).padStart(2, '0');
const toLocalInput = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
const fmt = (s) => { try { return new Date(s).toLocaleString('es', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }); } catch (e) { return s; } };

export default function MesaDetailModal({ mesa, onClose, go }) {
  const lab = useLab();
  const { loggedIn, session } = useAuth();
  const { presentesPorMesa, reservas, miPresencia, esDueno, entrar, salir, reservar, cancelarReserva } = lab;
  const [tab, setTab] = useState('info'); // info | reservar | editar
  const [msg, setMsg] = useState(null);

  const occ = presentesPorMesa[mesa.id] || [];
  const owner = esDueno(mesa);
  const misReservas = reservas.filter((r) => r.mesa === mesa.id && r.estado === 'activa' && new Date(r.fin) > new Date());
  const aquiYo = miPresencia && miPresencia.mesa === mesa.id;

  async function doEntrar() {
    const r = await entrar(mesa.id);
    setMsg(r.ok ? { ok: true, t: 'Entrada registrada en ' + mesa.nombre } : { ok: false, t: r.error });
  }

  return (
    <Overlay onClose={onClose}>
      <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 460, maxHeight: '88vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }} onClick={(e) => e.stopPropagation()}>
        {/* cabecera */}
        <div style={{ padding: '20px 22px 0' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
            <div>
              <h2 style={{ fontSize: 19, fontWeight: 700, margin: '0 0 4px', color: T.ink }}>{mesa.nombre}</h2>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {(mesa.duenos || []).map((d) => (
                  <span key={d} style={{ fontSize: 11, fontWeight: 600, color: '#7C3AED', background: '#F5F3FF', padding: '2px 8px', borderRadius: 20 }}>👤 {d}</span>
                ))}
                {mesa.pc && <span style={{ fontSize: 11, fontWeight: 600, color: '#2563EB', background: '#EFF6FF', padding: '2px 8px', borderRadius: 20 }}>PC</span>}
                <span style={{ fontSize: 11, fontWeight: 600, color: T.inkSoft, background: '#F1F5F9', padding: '2px 8px', borderRadius: 20 }}>{mesa.sillas} silla{mesa.sillas === 1 ? '' : 's'}</span>
                {owner && <span style={{ fontSize: 11, fontWeight: 600, color: '#16A34A', background: '#F0FDF4', padding: '2px 8px', borderRadius: 20 }}>Eres dueño</span>}
              </div>
            </div>
            <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 8, border: `1px solid ${T.border}`, background: '#fff', cursor: 'pointer', fontSize: 16, color: T.muted, flexShrink: 0 }}>✕</button>
          </div>

          {/* pestañas */}
          <div style={{ display: 'flex', gap: 4, marginTop: 16, borderBottom: `1px solid ${T.border}` }}>
            {[['info', 'Detalle'], ['reservar', 'Reservar'], loggedIn && ['editar', 'Editar']].filter(Boolean).map(([id, label]) => (
              <button key={id} onClick={() => { setTab(id); setMsg(null); }} style={{
                padding: '8px 12px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
                color: tab === id ? T.primary : T.muted, borderBottom: `2px solid ${tab === id ? T.primary : 'transparent'}`, marginBottom: -1,
              }}>{label}</button>
            ))}
          </div>
        </div>

        {/* cuerpo */}
        <div style={{ padding: '18px 22px 22px', overflowY: 'auto' }}>
          {msg && (
            <div style={{ marginBottom: 14, padding: '9px 12px', borderRadius: 8, fontSize: 13, fontWeight: 500, background: msg.ok ? '#F0FDF4' : '#FEF2F2', color: msg.ok ? '#15803D' : '#B91C1C', border: `1px solid ${msg.ok ? '#BBF7D0' : '#FECACA'}` }}>{msg.t}</div>
          )}

          {tab === 'info' && (
            <InfoTab mesa={mesa} occ={occ} misReservas={misReservas} onCancel={cancelarReserva} go={go} />
          )}
          {tab === 'reservar' && (
            <ReserveTab mesa={mesa} owner={owner} loggedIn={loggedIn} onReservar={reservar} setMsg={setMsg} />
          )}
          {tab === 'editar' && loggedIn && (
            <EditTab mesa={mesa} lab={lab} setMsg={setMsg} onClose={onClose} />
          )}

          {/* acción check-in (siempre visible en Detalle) */}
          {tab === 'info' && loggedIn && (
            <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
              {aquiYo ? (
                <button onClick={async () => { await salir(); setMsg({ ok: true, t: 'Salida registrada' }); }} style={{ ...btn('danger'), flex: 1 }}>Registrar salida</button>
              ) : (
                <button onClick={doEntrar} disabled={!!miPresencia} style={{ ...btn('primary'), flex: 1, opacity: miPresencia ? 0.5 : 1, cursor: miPresencia ? 'not-allowed' : 'pointer' }}>
                  {miPresencia ? 'Ya estás dentro' : 'Entrar aquí'}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </Overlay>
  );
}

/* ---------- pestaña Detalle ---------- */
function InfoTab({ mesa, occ, misReservas, onCancel, go }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* objetos / equipo */}
      <Section title="Equipo y objetos">
        {(mesa.objetos || []).length === 0 ? (
          <Empty>Sin objetos registrados.</Empty>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {mesa.objetos.map((o, i) => (
              <span key={i} style={{ fontSize: 12, fontWeight: 600, color: T.inkSoft, background: '#F1F5F9', border: `1px solid ${T.border}`, padding: '4px 10px', borderRadius: 8 }}>{o.nombre || o}</span>
            ))}
          </div>
        )}
      </Section>

      {/* presentes */}
      <Section title={`Quién está (${occ.length})`}>
        {occ.length === 0 ? <Empty>Nadie en esta mesa.</Empty> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {occ.map((p) => (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                <div style={{ width: 26, height: 26, borderRadius: '50%', background: '#0F172A', color: '#fff', display: 'grid', placeItems: 'center', fontSize: 10, fontWeight: 700 }}>{iniciales(p.nombre)}</div>
                <span style={{ fontSize: 13, color: T.ink }}>{p.nombre}</span>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* reservas activas */}
      <Section title="Reservas próximas">
        {misReservas.length === 0 ? <Empty>Sin reservas activas.</Empty> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {misReservas.map((r) => (
              <div key={r.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '7px 10px', background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 8 }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#92400E' }}>{r.nombre}{r.es_dueno ? ' · dueño' : ''}</div>
                  <div style={{ fontSize: 11, color: '#B45309' }}>{fmt(r.inicio)} – {fmt(r.fin)}</div>
                </div>
                <button onClick={() => onCancel(r.id)} style={{ fontSize: 11, fontWeight: 600, color: '#B91C1C', background: 'none', border: 'none', cursor: 'pointer' }}>Cancelar</button>
              </div>
            ))}
          </div>
        )}
      </Section>

      {mesa.link && <a href={mesa.link} target="_blank" rel="noreferrer" style={{ fontSize: 13, fontWeight: 600, color: T.primary }}>Abrir enlace →</a>}
    </div>
  );
}

/* ---------- pestaña Reservar ---------- */
function ReserveTab({ mesa, owner, loggedIn, onReservar, setMsg }) {
  const now = new Date();
  const start = new Date(now.getTime() + 5 * 60000);
  const [inicio, setInicio] = useState(toLocalInput(start));
  const [dur, setDur] = useState(60);
  const [busy, setBusy] = useState(false);

  if (!loggedIn) return <Empty>Inicia sesión para reservar esta mesa.</Empty>;

  async function submit() {
    setBusy(true); setMsg(null);
    const ini = new Date(inicio);
    const fin = new Date(ini.getTime() + dur * 60000);
    const r = await onReservar({ mesa, inicio: ini.toISOString(), fin: fin.toISOString() });
    setBusy(false);
    if (!r.ok) return setMsg({ ok: false, t: r.error });
    setMsg({ ok: true, t: r.desplazadas ? `Reserva creada. Desplazaste ${r.desplazadas} reserva(s) de externos.` : 'Reserva creada.' });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ fontSize: 12.5, color: T.inkSoft, background: owner ? '#F0FDF4' : '#F8FAFC', border: `1px solid ${owner ? '#BBF7D0' : T.border}`, borderRadius: 8, padding: '9px 12px', lineHeight: 1.5 }}>
        {owner
          ? 'Eres dueño de esta mesa: tu reserva tiene prioridad y puede desplazar la de un externo.'
          : 'Como externo puedes reservar si el horario está libre, pero el dueño podría desplazarte.'}
      </div>
      <Field label="Inicio">
        <input type="datetime-local" value={inicio} onChange={(e) => setInicio(e.target.value)} style={inp} />
      </Field>
      <Field label="Duración">
        <select value={dur} onChange={(e) => setDur(+e.target.value)} style={inp}>
          <option value={30}>30 minutos</option>
          <option value={60}>1 hora</option>
          <option value={90}>1 h 30 min</option>
          <option value={120}>2 horas</option>
          <option value={180}>3 horas</option>
          <option value={240}>4 horas</option>
        </select>
      </Field>
      <button onClick={submit} disabled={busy} style={{ ...btn('primary'), width: '100%' }}>{busy ? 'Reservando…' : 'Confirmar reserva'}</button>
    </div>
  );
}

/* ---------- pestaña Editar ---------- */
function EditTab({ mesa, lab, setMsg, onClose }) {
  const maxSillas = mesa.id === '2' ? 3 : 2;
  const [f, setF] = useState({
    nombre: mesa.nombre,
    duenos: (mesa.duenos || []).join(', '),
    sillas: mesa.sillas || 0,
    silla_dir: mesa.silla_dir || 'bottom',
    pc: !!mesa.pc,
    link: mesa.link || '',
    objetos: [...(mesa.objetos || []).map((o) => (o.nombre || o))],
  });
  const [nuevoObj, setNuevoObj] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const esMesa = mesa.kind === 'mesa';

  async function save() {
    setBusy(true);
    const patch = {
      nombre: f.nombre.trim() || mesa.nombre,
      duenos: f.duenos.split(',').map((s) => s.trim()).filter(Boolean).slice(0, 2),
      sillas: Math.max(0, Math.min(maxSillas, parseInt(f.sillas, 10) || 0)),
      silla_dir: f.silla_dir,
      pc: f.pc,
      link: f.link.trim(),
      objetos: f.objetos.map((n) => ({ nombre: n })),
    };
    await lab.guardarMesa(mesa.id, patch);
    setBusy(false);
    setMsg({ ok: true, t: 'Mesa actualizada.' });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <Field label="Nombre"><input value={f.nombre} onChange={(e) => set('nombre', e.target.value)} style={inp} /></Field>

      {esMesa && (
        <>
          <Field label="Dueños (1–2, separados por coma)">
            <input value={f.duenos} onChange={(e) => set('duenos', e.target.value)} placeholder="Ej. Yumil, Ana" style={inp} />
          </Field>
          <div style={{ display: 'flex', gap: 10 }}>
            <Field label={`Sillas (máx ${maxSillas})`} style={{ flex: 1 }}>
              <input type="number" min={0} max={maxSillas} value={f.sillas} onChange={(e) => set('sillas', e.target.value)} style={inp} />
            </Field>
            <Field label="Lado de sillas" style={{ flex: 1 }}>
              <select value={f.silla_dir} onChange={(e) => set('silla_dir', e.target.value)} style={inp}>
                <option value="bottom">Abajo</option>
                <option value="top">Arriba</option>
                <option value="left">Izquierda</option>
                <option value="right">Derecha</option>
              </select>
            </Field>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: T.inkSoft, cursor: 'pointer' }}>
            <input type="checkbox" checked={f.pc} onChange={(e) => set('pc', e.target.checked)} /> Tiene PC
          </label>
        </>
      )}

      {/* objetos */}
      <Field label="Objetos / equipo">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
          {f.objetos.map((o, i) => (
            <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: T.inkSoft, background: '#F1F5F9', border: `1px solid ${T.border}`, padding: '4px 6px 4px 10px', borderRadius: 8 }}>
              {o}
              <button onClick={() => set('objetos', f.objetos.filter((_, j) => j !== i))} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#B91C1C', fontSize: 13, lineHeight: 1 }}>✕</button>
            </span>
          ))}
          {f.objetos.length === 0 && <Empty>Sin objetos.</Empty>}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <input value={nuevoObj} onChange={(e) => setNuevoObj(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && nuevoObj.trim()) { set('objetos', [...f.objetos, nuevoObj.trim()]); setNuevoObj(''); } }} placeholder="Ej. Osciloscopio, monitor…" style={{ ...inp, flex: 1 }} />
          <button onClick={() => { if (nuevoObj.trim()) { set('objetos', [...f.objetos, nuevoObj.trim()]); setNuevoObj(''); } }} style={{ ...btn('ghost') }}>+ Añadir</button>
        </div>
      </Field>

      <Field label="Enlace (opcional)"><input value={f.link} onChange={(e) => set('link', e.target.value)} placeholder="https://…" style={inp} /></Field>

      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={save} disabled={busy} style={{ ...btn('primary'), flex: 1 }}>{busy ? 'Guardando…' : 'Guardar cambios'}</button>
      </div>
    </div>
  );
}

/* ---------- helpers UI ---------- */
function Section({ title, children }) {
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>{title}</div>
      {children}
    </div>
  );
}
function Field({ label, children, style }) {
  return (
    <label style={{ display: 'block', ...style }}>
      <span style={{ display: 'block', fontSize: 12, fontWeight: 600, color: T.inkSoft, marginBottom: 5 }}>{label}</span>
      {children}
    </label>
  );
}
function Empty({ children }) {
  return <span style={{ fontSize: 12.5, color: T.muted }}>{children}</span>;
}
const inp = { width: '100%', padding: '9px 12px', borderRadius: 8, border: `1px solid ${T.border}`, fontSize: 13.5, fontFamily: T.font, outline: 'none', boxSizing: 'border-box', background: '#fff', color: T.ink };
