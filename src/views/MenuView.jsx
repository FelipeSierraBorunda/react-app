/* =====================================================================
   MenuView.jsx — Menú principal (home) de Lab I&R 4.0
   ---------------------------------------------------------------------
   Punto de entrada. Tarjetas que llevan a cada módulo. El botón "Menú"
   de la barra superior regresa aquí.
   ===================================================================== */

import { useEffect } from 'react';
import { useLab } from '../context/LabContext.jsx';
import { useInventory } from '../context/InventoryContext.jsx';
import { useLang } from '../context/LangContext.jsx';
import { T } from '../theme.js';

export default function MenuView({ go }) {
  const { comps } = useInventory();
  const { ocupadas, totalSillas, presentes, ensureLoaded } = useLab();
  const { t } = useLang();

  useEffect(() => { ensureLoaded(); }, [ensureLoaded]);

  const cards = [
    {
      id: 'inventario', view: 'table', accent: '#2563EB', soft: '#EFF6FF',
      title: t('menu.inventory'), desc: t('menu.inventoryDesc'),
      stat: t('menu.comps', { n: comps.length }),
      icon: (
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="7" height="7" rx="1.5" stroke="currentColor" stroke-width="1.8"/><rect x="14" y="3" width="7" height="7" rx="1.5" stroke="currentColor" stroke-width="1.8"/><rect x="3" y="14" width="7" height="7" rx="1.5" stroke="currentColor" stroke-width="1.8"/><rect x="14" y="14" width="7" height="7" rx="1.5" stroke="currentColor" stroke-width="1.8"/></svg>
      ),
    },
    {
      id: 'croquis', view: 'croquis', accent: '#0D9488', soft: '#F0FDFA',
      title: t('menu.croquis'), desc: t('menu.croquisDesc'),
      stat: t('menu.occ', { a: ocupadas, b: totalSillas, n: presentes.length }),
      icon: (
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" stroke-width="1.8"/><path d="M3 9h18M9 9v12" stroke="currentColor" stroke-width="1.8"/></svg>
      ),
    },
    {
      id: 'granja', view: 'granja', accent: '#EA580C', soft: '#FFF7ED',
      title: t('menu.farm'), desc: t('menu.farmDesc'),
      stat: t('menu.farmStat'),
      icon: (
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none"><rect x="5" y="5" width="14" height="14" rx="1.5" stroke="currentColor" stroke-width="1.8"/><path d="M9 2v3M15 2v3M9 19v3M15 19v3M2 9h3M2 15h3M19 9h3M19 15h3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
      ),
    },
  ];

  return (
    <div style={{ maxWidth: 880, margin: '0 auto' }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, color: T.ink, margin: '0 0 6px', letterSpacing: '-0.02em' }}>Lab I&amp;R 4.0</h1>
        <p style={{ fontSize: 14, color: T.muted, margin: 0 }}>{t('menu.subtitle')}</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 18 }}>
        {cards.map((c) => (
          <button
            key={c.id}
            onClick={() => go(c.view)}
            style={{
              textAlign: 'left', background: '#fff', border: `1px solid ${T.border}`, borderRadius: 16,
              padding: 24, cursor: 'pointer', fontFamily: T.font, display: 'flex', flexDirection: 'column',
              gap: 14, transition: 'transform .12s, box-shadow .12s', boxShadow: '0 1px 2px rgba(15,23,42,0.04)',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 12px 28px rgba(15,23,42,0.10)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 1px 2px rgba(15,23,42,0.04)'; }}
          >
            <div style={{ width: 52, height: 52, borderRadius: 13, background: c.soft, color: c.accent, display: 'grid', placeItems: 'center' }}>{c.icon}</div>
            <div>
              <div style={{ fontSize: 17, fontWeight: 700, color: T.ink, marginBottom: 5 }}>{c.title}</div>
              <div style={{ fontSize: 13, color: T.inkSoft, lineHeight: 1.45 }}>{c.desc}</div>
            </div>
            <div style={{ marginTop: 'auto', fontSize: 12, fontWeight: 600, color: c.accent, background: c.soft, padding: '5px 10px', borderRadius: 8, alignSelf: 'flex-start' }}>{c.stat}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
