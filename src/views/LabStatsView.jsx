/* =====================================================================
   LabStatsView.jsx — Estadísticas del laboratorio (ocupación)
   ---------------------------------------------------------------------
   A partir del historial de presencia (check-in / check-out):
   - Ranking semanal: quién ha pasado más tiempo y cuánto.
   - Horas más concurridas (estilo "horas punta" de Google Maps).
   - Día de la semana más concurrido.
   - Registro general de entradas y salidas.
   Visible para todos; las acciones de borrar presencia (admin) viven en
   el panel de presencia del croquis.
   ===================================================================== */

import { useEffect, useMemo } from 'react';
import { useLab } from '../context/LabContext.jsx';
import { T, btn } from '../theme.js';

const iniciales = (n = '') => n.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('') || '?';
const fmtDur = (min) => {
  min = Math.max(0, Math.round(min));
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)} h ${min % 60} min`;
};
const fmtDate = (s) => { try { return new Date(s).toLocaleString('es', { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }); } catch (e) { return s; } };
const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const HORAS = Array.from({ length: 16 }, (_, i) => i + 7); // 7:00 – 22:00

export default function LabStatsView({ go }) {
  const lab = useLab();
  const { presencia, mesas, now, ensureLoaded } = lab;
  useEffect(() => { ensureLoaded(); }, [ensureLoaded]);

  const nombreMesa = (id) => { const m = mesas.find((x) => x.id === id); return m ? m.nombre : '—'; };

  // Sesiones con duración (fin = salida o ahora si sigue dentro).
  const sesiones = useMemo(() => presencia.map((p) => {
    const a = new Date(p.entrada);
    const b = p.salida ? new Date(p.salida) : now;
    return { ...p, a, b, min: Math.max(0, (b - a) / 60000), dentro: !p.salida };
  }), [presencia, now]);

  const weekStart = useMemo(() => new Date(now.getTime() - 7 * 86400000), [now]);
  const month = useMemo(() => new Date(now.getTime() - 30 * 86400000), [now]);

  const sem = useMemo(() => sesiones.filter((s) => s.a >= weekStart), [sesiones, weekStart]);

  // KPIs semanales
  const totalMin = sem.reduce((s, x) => s + x.min, 0);
  const personas = new Set(sem.map((s) => s.email)).size;
  const promedio = sem.length ? totalMin / sem.length : 0;

  // Ranking: tiempo por persona (semana)
  const ranking = useMemo(() => {
    const m = {};
    sem.forEach((s) => { const k = s.email; (m[k] = m[k] || { nombre: s.nombre, min: 0, visitas: 0 }); m[k].min += s.min; m[k].visitas++; });
    const arr = Object.values(m).sort((a, b) => b.min - a.min);
    const mx = arr.length ? arr[0].min : 1;
    arr.forEach((r) => { r.pct = Math.round((r.min / mx) * 100); });
    return arr;
  }, [sem]);

  // Horas concurridas (últimos 30 días) — cuántas visitas tocaron cada hora
  const horas = useMemo(() => {
    const cnt = Object.fromEntries(HORAS.map((h) => [h, 0]));
    sesiones.filter((s) => s.a >= month).forEach((s) => {
      const h0 = s.a.getHours();
      let h1 = s.b.getHours() + (s.b.getMinutes() > 0 ? 1 : 0);
      if (s.b < s.a) h1 = h0 + 1;
      for (let h = h0; h < h1; h++) if (cnt[h] != null) cnt[h]++;
    });
    const mx = Math.max(1, ...Object.values(cnt));
    return HORAS.map((h) => ({ h, n: cnt[h], pct: Math.round((cnt[h] / mx) * 100) }));
  }, [sesiones, month]);

  // Día de la semana concurrido (últimos 30 días)
  const dias = useMemo(() => {
    const cnt = [0, 0, 0, 0, 0, 0, 0];
    sesiones.filter((s) => s.a >= month).forEach((s) => { cnt[(s.a.getDay() + 6) % 7]++; });
    const mx = Math.max(1, ...cnt);
    return cnt.map((n, i) => ({ d: DIAS[i], n, pct: Math.round((n / mx) * 100) }));
  }, [sesiones, month]);

  // Registro general (más recientes primero)
  const registro = useMemo(() => [...sesiones].sort((a, b) => b.a - a.a).slice(0, 60), [sesiones]);

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: T.ink, margin: '0 0 4px', letterSpacing: '-0.02em' }}>Estadísticas del laboratorio</h1>
          <p style={{ fontSize: 13, color: T.muted, margin: 0 }}>Ocupación, tiempo de uso y horas más concurridas.</p>
        </div>
        <button onClick={() => go('croquis')} style={{ ...btn('ghost') }}>← Volver al croquis</button>
      </div>

      {/* KPIs semanales */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 16, marginBottom: 22 }}>
        <Kpi label="Visitas (7 días)" value={sem.length} />
        <Kpi label="Horas en el lab" value={(totalMin / 60).toFixed(1)} sub="últimos 7 días" />
        <Kpi label="Personas distintas" value={personas} sub="esta semana" />
        <Kpi label="Promedio por visita" value={fmtDur(promedio)} />
      </div>

      <div className="resp-2col" style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: 20, alignItems: 'start', marginBottom: 20 }}>
        {/* Ranking de tiempo */}
        <Card title="Quién ha pasado más tiempo" sub="Últimos 7 días">
          {ranking.length === 0 ? <Empty>Sin visitas esta semana.</Empty> : ranking.map((r, i) => (
            <div key={i} style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: T.ink }}>
                  <span style={{ width: 22, height: 22, borderRadius: '50%', background: '#0F172A', color: '#fff', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{iniciales(r.nombre)}</span>
                  <span style={{ fontWeight: 600 }}>{r.nombre}</span>
                  <span style={{ fontSize: 11, color: T.muted }}>· {r.visitas} visita{r.visitas === 1 ? '' : 's'}</span>
                </span>
                <span style={{ fontSize: 12.5, fontWeight: 600, color: '#374151' }}>{fmtDur(r.min)}</span>
              </div>
              <div style={{ height: 6, background: '#F1F5F9', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${r.pct}%`, background: T.primary, borderRadius: 3 }} />
              </div>
            </div>
          ))}
        </Card>

        {/* Día de la semana */}
        <Card title="Días más concurridos" sub="Últimos 30 días">
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 150, padding: '8px 0' }}>
            {dias.map((d) => (
              <div key={d.d} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, height: '100%', justifyContent: 'flex-end' }}>
                <div style={{ width: '100%', maxWidth: 26, height: `${Math.max(4, d.pct)}%`, background: d.pct >= 70 ? '#0D9488' : '#99F6E4', borderRadius: 4, transition: 'height .2s' }} title={`${d.n} visitas`} />
                <span style={{ fontSize: 11, color: T.muted }}>{d.d}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Horas concurridas */}
      <Card title="Horas más concurridas" sub="Estilo horas punta · últimos 30 días">
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 160, padding: '8px 0' }}>
          {horas.map((h) => (
            <div key={h.h} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, height: '100%', justifyContent: 'flex-end' }}>
              <div style={{ width: '100%', height: `${Math.max(3, h.pct)}%`, background: h.pct >= 70 ? '#EA580C' : h.pct >= 35 ? '#FB923C' : '#FED7AA', borderRadius: 3, transition: 'height .2s' }} title={`${h.n} visitas tocaron las ${h.h}:00`} />
              <span style={{ fontSize: 9.5, color: T.muted }}>{h.h}</span>
            </div>
          ))}
        </div>
        <p style={{ fontSize: 11.5, color: T.muted, margin: '6px 0 0' }}>Cada barra = cuántas visitas estuvieron presentes en esa franja horaria.</p>
      </Card>

      {/* Registro general */}
      <div style={{ background: '#fff', borderRadius: 12, border: `1px solid ${T.border}`, overflow: 'hidden', marginTop: 20 }}>
        <div style={{ padding: '16px 20px', borderBottom: `1px solid ${T.border}` }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: T.ink, margin: 0 }}>Registro de entradas y salidas</h3>
          <p style={{ fontSize: 12, color: T.muted, marginTop: 2 }}>Historial general (60 más recientes).</p>
        </div>
        {registro.length === 0 ? (
          <Empty pad>Todavía no hay registros de presencia.</Empty>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr style={{ background: '#F8FAFC', borderBottom: `1px solid ${T.border}` }}>
                <Th>PERSONA</Th><Th>MESA</Th><Th>ENTRADA</Th><Th>SALIDA</Th><Th right>DURACIÓN</Th>
              </tr></thead>
              <tbody>
                {registro.map((s) => (
                  <tr key={s.id} style={{ borderBottom: '1px solid #F8FAFC' }}>
                    <td style={{ padding: '9px 16px', fontSize: 13, color: T.ink, fontWeight: 500 }}>{s.nombre}</td>
                    <td style={{ padding: '9px 16px', fontSize: 12.5, color: T.inkSoft }}>{nombreMesa(s.mesa)}</td>
                    <td style={{ padding: '9px 16px', fontSize: 12, color: T.muted, whiteSpace: 'nowrap' }}>{fmtDate(s.entrada)}</td>
                    <td style={{ padding: '9px 16px', fontSize: 12, whiteSpace: 'nowrap' }}>
                      {s.dentro ? <span style={{ fontSize: 11, fontWeight: 700, color: '#15803D', background: '#F0FDF4', padding: '2px 8px', borderRadius: 20 }}>Dentro</span> : <span style={{ color: T.muted }}>{fmtDate(s.salida)}</span>}
                    </td>
                    <td style={{ padding: '9px 16px', fontSize: 13, textAlign: 'right', fontWeight: 600, color: '#374151', whiteSpace: 'nowrap' }}>{fmtDur(s.min)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function Kpi({ label, value, sub }) {
  return (
    <div style={{ background: '#fff', borderRadius: 12, border: `1px solid ${T.border}`, padding: 20 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 30, fontWeight: 700, color: T.ink, letterSpacing: '-0.5px' }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: T.muted, marginTop: 4 }}>{sub}</div>}
    </div>
  );
}
function Card({ title, sub, children }) {
  return (
    <div style={{ background: '#fff', borderRadius: 12, border: `1px solid ${T.border}`, padding: 22 }}>
      <div style={{ marginBottom: 16 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: T.ink, margin: 0 }}>{title}</h3>
        {sub && <p style={{ fontSize: 12, color: T.muted, margin: '2px 0 0' }}>{sub}</p>}
      </div>
      {children}
    </div>
  );
}
function Empty({ children, pad }) {
  return <div style={{ padding: pad ? 36 : 0, textAlign: pad ? 'center' : 'left', fontSize: 13, color: T.muted }}>{children}</div>;
}
function Th({ children, right }) {
  return <th style={{ padding: '9px 16px', textAlign: right ? 'right' : 'left', fontSize: 11, fontWeight: 700, color: '#64748B', letterSpacing: '0.05em' }}>{children}</th>;
}
