/* =====================================================================
   AccountView.jsx — Mi cuenta  [MIGRADA · fiel al HTML]
   ===================================================================== */

import { useMemo, useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { useInventory } from '../context/InventoryContext.jsx';
import { useLang } from '../context/LangContext.jsx';
import { fmtDate, TYPELBL, TYPECLR, rgba } from '../lib/constants.js';
import { T, card, btn } from '../theme.js';
import { Overlay } from '../components/AuthModal.jsx';
import { Avatar, AVATAR_CSS, lookFromEquipado } from '../components/Avatar.jsx';
import {
  EQUIPADO_DEFAULT, PELOS, PIELES, PELO_COLORES, CARAS, TIENDA, itemById,
  fetchJuego, saveJuego,
} from '../lib/game.js';

export default function AccountView() {
  const { session, isAdmin, logout, enterAdmin, exitAdmin } = useAuth();
  const { usage, changelog } = useInventory();
  const { t } = useLang();
  const [adminOpen, setAdminOpen] = useState(false);

  // Consumido por mí (transacciones type 'usar')
  const myConsumed = useMemo(
    () => usage.filter((u) => u.email === session?.email && u.type === 'usar'),
    [usage, session]
  );
  // Mis cambios administrativos (changelog hecho por mí)
  const myAdmin = useMemo(
    () => changelog.filter((c) => c.usuario === session?.nombre),
    [changelog, session]
  );

  const activityCount = myConsumed.length + myAdmin.length;

  return (
    <div style={{ maxWidth: 980 }}>
      {/* Perfil + acciones */}
      <div style={{ ...card, padding: 24, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ width: 52, height: 52, borderRadius: '50%', background: T.primary, color: '#fff', fontSize: 20, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          {(session?.nombre || '?').trim().charAt(0).toUpperCase()}
        </div>
        <div style={{ flex: 1, minWidth: 160 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#0F172A' }}>{session?.nombre}</div>
          <div style={{ fontSize: 13, color: '#64748B' }}>{session?.email}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 26, fontWeight: 700, color: '#0F172A' }}>{activityCount}</div>
          <div style={{ fontSize: 11, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>acciones registradas</div>
        </div>
        <button onClick={logout} style={{ padding: '10px 18px', border: '1px solid #FEE2E2', borderRadius: 8, background: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#DC2626', fontFamily: T.font }}>Cerrar sesión</button>
        {isAdmin
          ? <button onClick={exitAdmin} style={{ padding: '10px 18px', border: '1px solid #FCD34D', borderRadius: 8, background: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#B45309', fontFamily: T.font }}>Salir de admin</button>
          : <button onClick={() => setAdminOpen(true)} style={{ padding: '10px 18px', border: '1px solid #DBEAFE', borderRadius: 8, background: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#1D4ED8', fontFamily: T.font }}>Convertir en admin</button>}
      </div>

      {/* Dos columnas: consumidos / cambios administrativos */}
      <div className="resp-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        {/* Consumidos */}
        <div style={{ ...card, overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #F1F5F9' }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: '#0F172A', margin: 0 }}>Componentes que he consumido</h3>
            <p style={{ fontSize: 12, color: '#94A3B8', marginTop: 2 }}>Lo que has tomado del inventario</p>
          </div>
          {myConsumed.length === 0 ? (
            <div style={{ padding: 36, textAlign: 'center', color: '#94A3B8', fontSize: 13 }}>Aún no has consumido componentes.</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr style={{ background: '#F8FAFC', borderBottom: `1px solid ${T.border}` }}>
                  <Th>CÓDIGO</Th><Th>COMPONENTE</Th><Th right>CANT.</Th><Th>FECHA</Th>
                </tr></thead>
                <tbody>
                  {myConsumed.map((a, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #F8FAFC' }}>
                      <td style={{ padding: '9px 16px', fontSize: 12, fontFamily: T.mono, color: '#475569' }}>{a.codigo}</td>
                      <td style={{ padding: '9px 16px', fontSize: 13, color: '#0F172A', maxWidth: 200 }}>{a.descripcion}</td>
                      <td style={{ padding: '9px 16px', fontSize: 13, textAlign: 'right', fontWeight: 600, color: T.primary }}>{a.cantidad}</td>
                      <td style={{ padding: '9px 16px', fontSize: 12, color: '#94A3B8', whiteSpace: 'nowrap' }}>{fmtDate(a.ts)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Cambios administrativos */}
        <div style={{ ...card, overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #F1F5F9' }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: '#0F172A', margin: 0 }}>Mis cambios administrativos</h3>
            <p style={{ fontSize: 12, color: '#94A3B8', marginTop: 2 }}>Cajas y componentes que agregaste, editaste o eliminaste</p>
          </div>
          {myAdmin.length === 0 ? (
            <div style={{ padding: 36, textAlign: 'center', color: '#94A3B8', fontSize: 13 }}>Aún no tienes cambios administrativos.</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr style={{ background: '#F8FAFC', borderBottom: `1px solid ${T.border}` }}>
                  <Th>ACCIÓN</Th><Th>CÓDIGO</Th><Th>COMPONENTE</Th><Th>FECHA</Th>
                </tr></thead>
                <tbody>
                  {myAdmin.map((c, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #F8FAFC' }}>
                      <td style={{ padding: '9px 16px' }}>
                        <Badge type={c.type} />
                      </td>
                      <td style={{ padding: '9px 16px', fontSize: 12, fontFamily: T.mono, color: '#475569' }}>{c.codigo}</td>
                      <td style={{ padding: '9px 16px', fontSize: 13, color: '#0F172A', maxWidth: 160 }}>{c.descripcion}</td>
                      <td style={{ padding: '9px 16px', fontSize: 12, color: '#94A3B8', whiteSpace: 'nowrap' }}>{fmtDate(c.ts)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Personalización del avatar */}
      <AvatarCard session={session} t={t} />

      {adminOpen && <AdminModal onClose={() => setAdminOpen(false)} onConfirm={enterAdmin} />}
    </div>
  );
}

/* ---------- Personalización del avatar (compartida con el juego) ---------- */
function AvatarCard({ session, t }) {
  const [equipado, setEquipado] = useState(EQUIPADO_DEFAULT);
  const [comprados, setComprados] = useState(['out_bata', 'hat_none', 'pet_none', 'aura_none']);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!session) return;
    let alive = true;
    (async () => {
      const { mine } = await fetchJuego(session.email);
      if (!alive) return;
      if (mine) {
        setEquipado({ ...EQUIPADO_DEFAULT, ...(mine.equipado || {}) });
        if (Array.isArray(mine.comprados) && mine.comprados.length) setComprados(mine.comprados);
      }
      setLoaded(true);
    })();
    return () => { alive = false; };
  }, [session]);

  function update(patch) {
    const ne = { ...equipado, ...patch };
    setEquipado(ne);
    if (session) saveJuego(session.email, { equipado: ne });
  }

  const owned = (tipo) => TIENDA.filter((i) => i.tipo === tipo && (comprados.includes(i.id) || i.precio === 0));

  return (
    <div style={{ ...card, overflow: 'hidden', marginBottom: 16 }}>
      <div style={{ padding: '16px 20px', borderBottom: '1px solid #F1F5F9' }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: '#0F172A', margin: 0 }}>{t('account.avatar')}</h3>
        <p style={{ fontSize: 12, color: '#94A3B8', marginTop: 2 }}>{t('account.avatarHint')}</p>
      </div>
      <div className="resp-2col" style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: 0 }}>
        {/* preview */}
        <div style={{ display: 'grid', placeItems: 'center', padding: '26px 0', background: 'linear-gradient(180deg,#F8FAFC,#EEF2F7)', borderRight: `1px solid ${T.border}` }}>
          <div style={{ transform: 'scale(2)', transformOrigin: 'center' }}>
            <Avatar look={lookFromEquipado(equipado)} name="" you />
          </div>
        </div>
        {/* controles */}
        <div style={{ padding: '18px 20px' }}>
          <Section label={t('account.body')}>
            <Field label={t('game.hair')}>
              <Chips opciones={PELOS.map((p) => [p.id, p.nombre])} value={equipado.pelo} onPick={(v) => update({ pelo: v })} />
            </Field>
            <Field label={t('game.hairColor')}>
              <Swatches values={PELO_COLORES} active={equipado.pelo_color} onPick={(c) => update({ pelo_color: c })} />
            </Field>
            <Field label={t('game.skin')}>
              <Swatches values={PIELES} active={equipado.piel} onPick={(c) => update({ piel: c })} />
            </Field>
            <Field label={t('game.face')}>
              <Chips opciones={CARAS.map((c) => [c.id, c.nombre])} value={equipado.cara} onPick={(v) => update({ cara: v })} />
            </Field>
          </Section>

          <Section label={t('account.equipOwned')}>
            {[['outfit', '👕'], ['sombrero', '🎩'], ['mascota', '🐾'], ['aura', '✨']].map(([tipo, emo]) => {
              const items = owned(tipo);
              if (!items.length) return null;
              return (
                <Field key={tipo} label={emo}>
                  <Chips opciones={items.map((i) => [i.id, i.nombre])} value={equipado[tipo]} onPick={(v) => update({ [tipo]: v })} />
                </Field>
              );
            })}
            <p style={{ fontSize: 11.5, color: T.muted, margin: '4px 0 0' }}>{t('account.getMore')}</p>
          </Section>
        </div>
      </div>
      <style>{AVATAR_CSS}</style>
    </div>
  );
}

function Section({ label, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>{label}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>{children}</div>
    </div>
  );
}
function Field({ label, children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
      <span style={{ fontSize: 12, fontWeight: 600, color: T.inkSoft, width: 64, flexShrink: 0 }}>{label}</span>
      <div style={{ flex: 1 }}>{children}</div>
    </div>
  );
}
function Chips({ opciones, value, onPick }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {opciones.map(([id, nombre]) => {
        const on = value === id;
        return (
          <button key={id} onClick={() => onPick(id)} style={{
            padding: '6px 11px', borderRadius: 8, cursor: 'pointer', fontSize: 12.5, fontWeight: 600, fontFamily: T.font,
            border: `1px solid ${on ? T.primary : T.border}`, background: on ? T.primarySoft : '#fff', color: on ? T.primary : '#475569',
          }}>{nombre}</button>
        );
      })}
    </div>
  );
}
function Swatches({ values, active, onPick }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
      {values.map((c) => <button key={c} onClick={() => onPick(c)} title={c} style={{ width: 28, height: 28, borderRadius: 8, background: c, cursor: 'pointer', border: `3px solid ${active === c ? T.primary : 'rgba(15,23,42,0.15)'}` }} />)}
    </div>
  );
}

function Badge({ type }) {
  const clr = TYPECLR[type] || '#64748B';
  return <span style={{ fontSize: 11, fontWeight: 600, color: clr, background: rgba(clr, 0.1), padding: '3px 9px', borderRadius: 9 }}>{TYPELBL[type] || type}</span>;
}
function Th({ children, right }) {
  return <th style={{ padding: '9px 16px', textAlign: right ? 'right' : 'left', fontSize: 11, fontWeight: 700, color: '#64748B', letterSpacing: '0.05em' }}>{children}</th>;
}

/* Modal de contraseña para activar el modo administrador. */
function AdminModal({ onClose, onConfirm }) {
  const [pwd, setPwd] = useState('');
  const [error, setError] = useState('');

  function submit() {
    const res = onConfirm(pwd);
    if (!res.ok) return setError(res.error);
    onClose();
  }

  return (
    <Overlay onClose={onClose}>
      <div style={{ ...card, padding: 28, maxWidth: 360, width: '100%' }} onClick={(e) => e.stopPropagation()}>
        <h2 style={{ margin: '0 0 4px', fontSize: 18 }}>Modo administrador</h2>
        <p style={{ margin: '0 0 18px', fontSize: 13, color: T.muted }}>Ingresa la contraseña para activar el panel.</p>
        <input
          type="password" autoFocus value={pwd}
          onChange={(e) => setPwd(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          placeholder="Contraseña"
          style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: `1px solid ${T.border}`, fontSize: 14, fontFamily: T.font, outline: 'none' }}
        />
        {error && <div style={{ color: T.danger, fontSize: 13, marginTop: 10 }}>{error}</div>}
        <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
          <button onClick={onClose} style={{ ...btn('ghost'), flex: 1 }}>Cancelar</button>
          <button onClick={submit} style={{ ...btn('primary'), flex: 1 }}>Activar</button>
        </div>
      </div>
    </Overlay>
  );
}
