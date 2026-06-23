/* =====================================================================
   Avatar.jsx — Avatar por capas (compartido)
   ---------------------------------------------------------------------
   Render del muñeco pixel-art del laboratorio virtual. Se usa tanto en
   el juego (GameView) como en la personalización de "Mi cuenta".
   Incluye las animaciones necesarias en AVATAR_CSS (inyéctalo una vez
   con <style>{AVATAR_CSS}</style> en cada vista que lo use).
   ===================================================================== */

import { itemById, PIELES, PELO_COLORES, PELOS } from '../lib/game.js';

export const AV = 30;

export const AVATAR_CSS = `@keyframes gv-pop{0%{transform:scale(.6);opacity:0}100%{transform:scale(1);opacity:1}}
@keyframes gv-z{0%,100%{transform:translateY(0);opacity:.5}50%{transform:translateY(-4px);opacity:1}}
@keyframes gv-bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-2px)}}
@keyframes gv-aura{0%,100%{transform:scale(1);opacity:.5}50%{transform:scale(1.15);opacity:.85}}`;

export function Avatar({ look, dir = 'down', name, sleeping, sitting, moving, phase = 0, you }) {
  const piel = look.piel || '#F2C9A0';
  const peloColor = look.peloColor || '#3B2A20';
  const outfit = look.outfit || { color: '#E5E7EB', acento: '#94A3B8' };
  const eyeX = dir === 'left' ? 3 : dir === 'right' ? 7 : 5;
  // piernas: alterna según fase al caminar
  const swing = moving ? (phase === 1 ? 3 : phase === 3 ? -3 : 0) : 0;
  return (
    <div style={{ width: AV, position: 'relative', textAlign: 'center', animation: you && !moving ? 'gv-bob 1.5s ease-in-out infinite' : 'none' }}>
      {look.aura && look.aura.color !== 'transparent' && (
        <div style={{ position: 'absolute', left: '50%', top: 12, transform: 'translateX(-50%)', width: 30, height: 30, borderRadius: '50%', background: look.aura.color, filter: 'blur(5px)', opacity: 0.6, animation: 'gv-aura 1.8s ease-in-out infinite' }} />
      )}
      {sleeping && <span style={{ position: 'absolute', top: -12, right: -2, fontSize: 11, animation: 'gv-z 1.8s ease-in-out infinite', zIndex: 3 }}>💤</span>}
      <div style={{ position: 'absolute', bottom: -2, left: '50%', transform: 'translateX(-50%)', width: 20, height: 5, background: 'rgba(15,23,42,0.22)', borderRadius: '50%' }} />

      {look.sombrero && look.sombrero.color !== 'transparent' && <Hat item={look.sombrero} />}
      <Hair style={look.pelo} color={peloColor} />
      <div style={{ position: 'relative', width: 16, height: 14, background: piel, border: '2px solid #11203a', borderRadius: 6, margin: '-2px auto 0', zIndex: 2 }}>
        {!sleeping ? (
          (() => {
            const cara = look.cara || 'cara_normal';
            const big = cara === 'cara_kawaii';
            const eD = big ? 3.2 : 2.4;
            return (
              <>
                <span style={{ position: 'absolute', top: 5, left: eyeX, width: eD, height: eD, background: '#11203a', borderRadius: '50%' }} />
                {cara === 'cara_guino'
                  ? <span style={{ position: 'absolute', top: 6.4, left: eyeX + 4, width: 3.6, height: 1.6, background: '#11203a', borderRadius: 2 }} />
                  : <span style={{ position: 'absolute', top: 5, left: eyeX + 4.5, width: eD, height: eD, background: '#11203a', borderRadius: '50%' }} />}
                {big && (
                  <>
                    <span style={{ position: 'absolute', top: 8.6, left: eyeX - 2, width: 2.6, height: 1.6, background: 'rgba(244,114,182,0.6)', borderRadius: 2 }} />
                    <span style={{ position: 'absolute', top: 8.6, left: eyeX + 7, width: 2.6, height: 1.6, background: 'rgba(244,114,182,0.6)', borderRadius: 2 }} />
                  </>
                )}
                <span style={faceMouth(cara)} />
              </>
            );
          })()
        ) : (
          <span style={{ position: 'absolute', top: 7, left: 4, right: 4, height: 2, borderTop: '2px solid #11203a' }} />
        )}
      </div>
      <div style={{ width: 6, height: 2, background: piel, margin: '-1px auto 0' }} />
      <div style={{ position: 'relative', width: 22, height: sitting ? 12 : 16, background: outfit.color, border: '2px solid #11203a', borderRadius: '5px 5px 6px 6px', margin: '0 auto', zIndex: 1 }}>
        <span style={{ position: 'absolute', top: 1, bottom: 1, left: '50%', transform: 'translateX(-50%)', width: 2, background: outfit.acento, opacity: 0.8 }} />
        <span style={{ position: 'absolute', top: 1, left: -4, width: 4, height: sitting ? 8 : 11, background: outfit.color, border: '2px solid #11203a', borderRadius: 3 }} />
        <span style={{ position: 'absolute', top: 1, right: -4, width: 4, height: sitting ? 8 : 11, background: outfit.color, border: '2px solid #11203a', borderRadius: 3 }} />
      </div>
      {!sitting && (
        <div style={{ display: 'flex', gap: 3, justifyContent: 'center', marginTop: -1 }}>
          <span style={{ width: 6, height: 6, background: '#1F2937', border: '2px solid #11203a', borderRadius: '0 0 3px 3px', transform: `translateY(${swing > 0 ? swing : 0}px)` }} />
          <span style={{ width: 6, height: 6, background: '#1F2937', border: '2px solid #11203a', borderRadius: '0 0 3px 3px', transform: `translateY(${swing < 0 ? -swing : 0}px)` }} />
        </div>
      )}
      {name !== '' && <div style={{ fontSize: 9, fontWeight: 800, color: you ? '#0F172A' : '#475569', marginTop: 2, whiteSpace: 'nowrap', textShadow: '0 1px 0 rgba(255,255,255,0.85)' }}>{(name || '').split(' ')[0]}</div>}
    </div>
  );
}

function faceMouth(cara) {
  if (cara === 'cara_feliz')
    return { position: 'absolute', top: 8.4, left: 4.5, width: 7, height: 3.4, border: '1.6px solid rgba(150,70,70,0.75)', borderTop: 'none', borderRadius: '0 0 7px 7px' };
  if (cara === 'cara_serio')
    return { position: 'absolute', top: 10, left: 6, width: 4, height: 1.6, background: '#6B4A4A', borderRadius: 1 };
  if (cara === 'cara_guino')
    return { position: 'absolute', top: 8.8, left: 5, width: 6, height: 2.6, border: '1.6px solid rgba(150,70,70,0.75)', borderTop: 'none', borderRadius: '0 0 6px 6px' };
  if (cara === 'cara_kawaii')
    return { position: 'absolute', top: 9.4, left: 6.4, width: 3.2, height: 2.8, background: 'rgba(150,70,70,0.7)', borderRadius: '0 0 4px 4px' };
  return { position: 'absolute', top: 9.5, left: 6, width: 4, height: 1.6, background: 'rgba(180,90,90,0.6)', borderRadius: 2 };
}

function Hair({ style, color }) {
  if (style === 'pelo_none') return null;
  const base = { position: 'relative', margin: '0 auto', zIndex: 3 };
  if (style === 'pelo_largo')
    return <div style={{ ...base, width: 20, height: 9, background: color, borderRadius: '9px 9px 3px 3px', boxShadow: `0 9px 0 -2px ${color}, 0 13px 0 -4px ${color}` }} />;
  if (style === 'pelo_chongo')
    return <div style={{ ...base, width: 17, height: 7, background: color, borderRadius: '8px 8px 2px 2px' }}><span style={{ position: 'absolute', top: -5, left: '50%', transform: 'translateX(-50%)', width: 7, height: 7, background: color, borderRadius: '50%' }} /></div>;
  if (style === 'pelo_afro')
    return <div style={{ ...base, width: 24, height: 14, background: color, borderRadius: '50%', marginBottom: -4 }} />;
  if (style === 'pelo_punk')
    return <div style={{ ...base, width: 17, height: 6, background: color, borderRadius: '6px 6px 0 0' }}><span style={{ position: 'absolute', top: -6, left: '50%', transform: 'translateX(-50%)', width: 4, height: 7, background: color, borderRadius: 2 }} /></div>;
  return <div style={{ ...base, width: 18, height: 7, background: color, borderRadius: '8px 8px 2px 2px' }} />;
}

function Hat({ item }) {
  const c = item.color;
  if (item.id === 'hat_grad')
    return <div style={{ position: 'relative', margin: '0 auto', zIndex: 4 }}><div style={{ width: 22, height: 4, background: c, margin: '0 auto', borderRadius: 1 }} /><div style={{ width: 11, height: 5, background: c, margin: '-1px auto 0', borderRadius: '0 0 2px 2px' }} /></div>;
  if (item.id === 'hat_crown')
    return <div style={{ width: 16, height: 7, margin: '0 auto', zIndex: 4, position: 'relative', background: c, clipPath: 'polygon(0 100%, 0 40%, 20% 70%, 40% 20%, 50% 60%, 60% 20%, 80% 70%, 100% 40%, 100% 100%)' }} />;
  if (item.id === 'hat_cap')
    return <div style={{ position: 'relative', margin: '0 auto', zIndex: 4, width: 16, height: 6, background: c, borderRadius: '6px 6px 0 0' }}><span style={{ position: 'absolute', bottom: 0, left: 14, width: 8, height: 3, background: c, borderRadius: '0 3px 3px 0' }} /></div>;
  if (item.id === 'hat_safety')
    return <div style={{ width: 18, height: 8, margin: '0 auto', zIndex: 4, position: 'relative', background: c, borderRadius: '9px 9px 0 0' }}><span style={{ position: 'absolute', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: 2, height: 8, background: 'rgba(0,0,0,0.2)' }} /></div>;
  return <div style={{ width: 17, height: 7, margin: '0 auto', zIndex: 4, background: c, borderRadius: '7px 7px 0 0' }} />;
}

export function Pet({ kind }) {
  const face = kind === 'pet_cat' ? '🐱' : kind === 'pet_dog' ? '🐶' : kind === 'pet_robot' ? '🤖' : kind === 'pet_drone' ? '🛸' : kind === 'pet_chip' ? '🔲' : '●';
  return <div style={{ width: 18, height: 18, display: 'grid', placeItems: 'center', fontSize: 15, animation: 'gv-bob 1.1s ease-in-out infinite', filter: 'drop-shadow(0 1px 0 rgba(15,23,42,0.25))' }}>{face}</div>;
}

// Apariencia determinista (semilla por email) para las personas dormidas.
export function sleeperLook(person) {
  const seed = (person.email || person.nombre || '').split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const piel = PIELES[seed % PIELES.length];
  const peloColor = PELO_COLORES[(seed * 7) % PELO_COLORES.length];
  const pelo = PELOS[(seed * 3) % PELOS.length].id;
  return { piel, pelo, peloColor, outfit: { color: '#CBD5E1', acento: '#94A3B8' }, sombrero: null, aura: null };
}

// Construye el objeto `look` que espera <Avatar> a partir de un `equipado`.
export function lookFromEquipado(equipado = {}) {
  return {
    piel: equipado.piel, pelo: equipado.pelo, peloColor: equipado.pelo_color, cara: equipado.cara,
    outfit: itemById(equipado.outfit) || itemById('out_bata'),
    sombrero: itemById(equipado.sombrero),
    aura: itemById(equipado.aura),
  };
}
