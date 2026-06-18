import { T } from '../theme.js';

/* Marcador visual para secciones aún no migradas desde el prototipo. */
export default function Placeholder({ title, note }) {
  return (
    <div style={{ border: `2px dashed ${T.border}`, borderRadius: 10, padding: 32, textAlign: 'center', background: '#F8FAFC' }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: T.inkSoft }}>{title}</div>
      {note && <div style={{ fontSize: 13, color: T.muted, marginTop: 6, maxWidth: 420, marginInline: 'auto' }}>{note}</div>}
    </div>
  );
}
