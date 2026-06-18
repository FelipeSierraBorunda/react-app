/* Tokens visuales compartidos. Si más adelante quieres un sistema de
   estilos (CSS Modules, Tailwind), este es el punto único a reemplazar. */

export const T = {
  font: "'IBM Plex Sans', sans-serif",
  mono: "'IBM Plex Mono', monospace",
  bg: '#F1F5F9',
  surface: '#FFFFFF',
  border: '#E2E8F0',
  ink: '#0F172A',
  inkSoft: '#475569',
  muted: '#94A3B8',
  primary: '#2563EB',
  primarySoft: '#EFF6FF',
  danger: '#DC2626',
  radius: 12,
};

export const card = {
  background: T.surface,
  borderRadius: T.radius,
  border: `1px solid ${T.border}`,
};

export const btn = (variant = 'primary') => {
  const base = {
    padding: '9px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600,
    fontFamily: T.font, cursor: 'pointer', border: '1px solid transparent',
  };
  if (variant === 'primary') return { ...base, background: T.primary, color: '#fff' };
  if (variant === 'ghost') return { ...base, background: '#fff', color: T.inkSoft, borderColor: T.border };
  if (variant === 'danger') return { ...base, background: '#fff', color: T.danger, borderColor: '#FEE2E2' };
  return base;
};
