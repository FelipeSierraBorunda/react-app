/* =====================================================================
   avatarSprite.js — Sprite pixel-art detallado (estilo RPG top-down).
   ---------------------------------------------------------------------
   Una sola función dibuja el avatar en cualquier <canvas>, parametrizada
   para dar MUCHA variedad: peinados, camisas, pantalones, lentes, gorras,
   tono de piel y color de pelo. Se usa en el juego (PixelRoom) y en la
   personalización de "Mi cuenta" (AvatarPixel), así el modelo es idéntico
   en todos lados. Arte 100% original.

   Anclaje: (cx, cy) = punto medio de los PIES. El sprite mide 16×26 px
   lógicos; `S` es la escala en píxeles por unidad.
   ===================================================================== */

const OUT = '#1b2236';          // contorno
const SHADOW = 'rgba(15,23,42,0.22)';

// aclara (+) / oscurece (-) un color hex
export function shade(hex, amt) {
  const h = String(hex || '#000').replace('#', '');
  if (h.length < 6) return hex;
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
  const f = (c) => Math.max(0, Math.min(255, Math.round(c + (amt < 0 ? c : 255 - c) * amt)));
  const x = (c) => f(c).toString(16).padStart(2, '0');
  return '#' + x(r) + x(g) + x(b);
}

export function drawAvatar(ctx, cx, cy, o = {}, S = 3) {
  const dir = o.dir || 'down';
  const skin = o.skin || '#F2C9A0';
  const skinSh = shade(skin, -0.18);
  const hairStyle = o.hairStyle || 'pelo_corto';
  const hairColor = o.hairColor || '#3B2A20';
  const shirt = o.shirtColor || '#E2E8F0';
  const shirtSh = shade(shirt, -0.2), shirtHi = shade(shirt, 0.16);
  const accent = o.shirtAccent || null;
  const pants = o.pantsColor || '#3A4256';
  const pantsSh = shade(pants, -0.22);
  const shoe = '#23304a';
  const sleeping = o.sleeping;
  const sitting = o.sitting;
  const frame = o.frame || 0;            // 0 idle, 1/3 paso, 2 idle
  const step = frame === 1 ? 1 : frame === 3 ? -1 : 0;

  // origen (esquina sup-izq del sprite 16×26)
  const ox = Math.round(cx - 8 * S);
  const oy = Math.round(cy - 25 * S);
  const P = (px, py, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(ox + px * S, oy + py * S, w * S, h * S); };

  // sombra al piso
  ctx.fillStyle = SHADOW;
  ctx.beginPath();
  ctx.ellipse(cx, cy - 0.5 * S, 6 * S, 2.2 * S, 0, 0, Math.PI * 2);
  ctx.fill();

  // ---------- PIERNAS / ZAPATOS ----------
  if (!sitting) {
    const lA = step, lB = -step;            // alternan al caminar
    // pierna izq
    P(4, 18 + Math.max(0, lA), 3, 5 - Math.max(0, lA), pants); P(4, 17, 3, 1, pantsSh);
    P(4, 22 + lA, 3, 2, shoe);
    // pierna der
    P(9, 18 + Math.max(0, lB), 3, 5 - Math.max(0, lB), pants); P(9, 17, 3, 1, pantsSh);
    P(9, 22 + lB, 3, 2, shoe);
    // contorno piernas
    P(4, 17, 1, 7, shade(pants, -0.35)); P(11, 17, 1, 7, shade(pants, -0.35));
  } else {
    // sentado: muslos hacia el frente
    P(4, 19, 8, 4, pants); P(4, 19, 8, 1, pantsSh); P(4, 22, 8, 2, shoe);
  }

  // ---------- TORSO (camisa / bata) ----------
  const torsoTop = 11, torsoH = sitting ? 7 : 8;
  P(3, torsoTop, 10, torsoH, OUT);                 // contorno
  P(4, torsoTop, 8, torsoH - 1, shirt);            // relleno
  P(4, torsoTop, 8, 1, shirtHi);                   // luz hombros
  P(4, torsoTop + torsoH - 2, 8, 1, shirtSh);      // sombra bajo
  // acento (franja/cierre) para outfits premium
  if (accent) { P(7, torsoTop + 1, 2, torsoH - 2, accent); }
  // bata/lab coat: collar en V visible cuando la camisa es blanca/clara
  const isLabCoat = !accent && (shirt === '#E2E8F0' || shirt === '#F6F8FC' || shirt === '#EEF2F7' || shirt === '#FFFFFF' || shirt === '#ffffff' || shirt.toLowerCase() === '#e2e8f0' || shirt.toLowerCase() === '#eef2f7');
  if (isLabCoat && dir !== 'up') {
    P('#d0d8e8', 6, torsoTop + 1, 2, torsoH - 2);   // solapa izquierda
    P('#d0d8e8', 8, torsoTop + 1, 2, 3);             // solapa derecha (corta)
    P(OUT, 7, torsoTop + 1, 1, torsoH - 2);          // línea central bata
  }
  // brazos / mangas
  const armSwing = sitting ? 0 : step;
  P(2, torsoTop + 1, 2, 5, OUT); P(2, torsoTop + 1 - armSwing, 2, 5, shade(shirt, -0.08));
  P(12, torsoTop + 1, 2, 5, OUT); P(12, torsoTop + 1 + armSwing, 2, 5, shade(shirt, -0.08));
  // manos
  P(2, torsoTop + 6 - armSwing, 2, 2, skin); P(12, torsoTop + 6 + armSwing, 2, 2, skin);

  // ---------- CABEZA ----------
  const hy = 2;                                    // top de la cabeza
  P(3, hy, 10, 9, OUT);                            // contorno cabeza
  P(4, hy + 1, 8, 7, skin);                        // cara
  P(4, hy + 6, 8, 1, skinSh);                      // mentón sombreado
  // orejas (de perfil)
  if (dir === 'left') P(3, hy + 4, 1, 2, skinSh);
  if (dir === 'right') P(12, hy + 4, 1, 2, skinSh);

  // ---------- PELO ----------
  drawHair(P, hairStyle, hairColor, dir, hy, shade);

  // ---------- CARA ----------
  if (dir !== 'up') {
    const eyeY = hy + 4;
    if (sleeping) {
      P(5, eyeY + 1, 2, 1, OUT); P(9, eyeY + 1, 2, 1, OUT);
    } else if (dir === 'left') {
      P(5, eyeY, 1.6, 2, OUT);
    } else if (dir === 'right') {
      P(9.4, eyeY, 1.6, 2, OUT);
    } else {
      P(5, eyeY, 1.6, 2, OUT); P(9.4, eyeY, 1.6, 2, OUT);
      // boca
      P(7, eyeY + 3, 2, 1, shade(skin, -0.4));
    }
    // ---------- LENTES ----------
    drawGlasses(P, o.glasses, dir, eyeY);
  }

  // ---------- GORRA / SOMBRERO ----------
  if (o.hatType && o.hatType !== 'hat_none') drawHat(P, o.hatType, o.hatColor || '#DC2626', dir, hy, shade);

  // ---------- z (dormido) ----------
  if (sleeping) { ctx.fillStyle = '#64748b'; ctx.font = `${5 * S}px "Silkscreen",monospace`; ctx.fillText('z', ox + 14 * S, oy + 2 * S); }
}

function drawHair(P, style, color, dir, hy, shade) {
  const hi = shade(color, 0.18), sh = shade(color, -0.25);
  if (style === 'pelo_none' || style === 'pelo_rapado') {
    // rapado: solo sombra superior
    P(4, hy, 8, 2, color); return;
  }
  if (dir === 'up') {
    // de espaldas: cubre casi toda la cabeza
    P(3, hy, 10, 7, color); P(3, hy, 10, 2, hi);
    if (style === 'pelo_largo' || style === 'pelo_coleta') P(3, hy + 7, 10, 3, color);
    return;
  }
  // top + laterales (frente)
  switch (style) {
    case 'pelo_largo':
      P(3, hy - 1, 10, 4, color); P(3, hy - 1, 10, 1, hi);
      P(3, hy + 2, 2, 7, color); P(11, hy + 2, 2, 7, color); break;       // mechones a los lados
    case 'pelo_coleta':
      P(3, hy - 1, 10, 4, color); P(3, hy - 1, 10, 1, hi);
      P(3, hy + 2, 1, 4, color); P(12, hy + 2, 1, 4, color);
      P(13, hy + 1, 2, 6, color); break;                                  // coleta lateral
    case 'pelo_chongo':
      P(3, hy - 1, 10, 4, color); P(3, hy - 1, 10, 1, hi);
      P(6, hy - 4, 4, 4, color); P(6, hy - 4, 4, 1, hi); break;           // moño arriba
    case 'pelo_afro':
      P(2, hy - 3, 12, 6, color); P(2, hy - 3, 12, 2, hi);
      P(2, hy + 1, 2, 4, color); P(12, hy + 1, 2, 4, color); break;
    case 'pelo_mohawk':
      P(6, hy - 4, 4, 6, color); P(6, hy - 4, 4, 2, hi); break;           // cresta
    case 'pelo_fleco':
      P(3, hy - 1, 10, 4, color); P(3, hy - 1, 10, 1, hi);
      P(4, hy + 3, 8, 1, sh); break;                                      // flequillo recto
    case 'pelo_punk':
      P(4, hy - 2, 8, 4, color); P(4, hy - 4, 1, 3, color); P(7, hy - 5, 1, 4, color); P(10, hy - 4, 1, 3, color); break; // picos
    default: // pelo_corto
      P(3, hy - 1, 10, 4, color); P(3, hy - 1, 10, 1, hi);
      P(3, hy + 2, 1, 3, color); P(12, hy + 2, 1, 3, color);
  }
}

function drawGlasses(P, glasses, dir, eyeY) {
  if (!glasses || glasses === 'lentes_none') return;
  const lens = glasses === 'lentes_sol' ? '#1b2236' : 'rgba(120,200,255,0.45)';
  const rim = glasses === 'lentes_sol' ? '#0b0f1a' : '#2a3147';
  if (dir === 'up') return;
  if (dir === 'left') { P(4.6, eyeY - 0.5, 3, 3, rim); P(5, eyeY, 2.2, 2, lens); return; }
  if (dir === 'right') { P(8.6, eyeY - 0.5, 3, 3, rim); P(9, eyeY, 2.2, 2, lens); return; }
  // frente: dos lentes + puente
  P(4.4, eyeY - 0.5, 3, 3, rim); P(8.6, eyeY - 0.5, 3, 3, rim);
  P(4.8, eyeY, 2.2, 2, lens); P(9, eyeY, 2.2, 2, lens);
  P(7.4, eyeY + 0.5, 1.2, 1, rim);
  if (glasses === 'lentes_redondos') { /* mismas cajas, leídas como redondas a baja resolución */ }
}

function drawHat(P, type, color, dir, hy, shade) {
  const hi = shade(color, 0.2), sh = shade(color, -0.3);
  if (type === 'hat_cap') {
    P(3, hy - 1, 10, 3, color); P(3, hy - 1, 10, 1, hi);
    if (dir === 'down') P(4, hy + 2, 8, 1, sh);                 // visera al frente
    if (dir === 'left') P(1, hy + 1, 3, 2, sh);
    if (dir === 'right') P(12, hy + 1, 3, 2, sh);
    return;
  }
  if (type === 'hat_beanie') { P(3, hy - 2, 10, 4, color); P(3, hy - 2, 10, 1, hi); P(3, hy + 1, 10, 1, sh); return; }
  if (type === 'hat_safety') { P(3, hy - 2, 10, 4, color); P(2, hy + 1, 12, 1, color); P(7, hy - 2, 2, 4, sh); return; }
  if (type === 'hat_grad') { P(2, hy - 1, 12, 2, color); P(5, hy - 3, 6, 2, color); P(9, hy - 2, 3, 1, '#FACC15'); return; }
  if (type === 'hat_crown') { P(4, hy - 3, 8, 4, color); P(4, hy - 5, 1, 3, color); P(7, hy - 6, 1, 4, color); P(10, hy - 5, 1, 3, color); return; }
  // genérico
  P(3, hy - 1, 10, 3, color); P(3, hy - 1, 10, 1, hi);
}

// ---------------------------------------------------------------------
// Mapea un `equipado` (estado guardado) a las opciones del sprite.
// Si hay un outfit premium equipado (≠ bata), su color manda sobre la
// camisa personalizada y muestra un acento.
// ---------------------------------------------------------------------
export function spriteFromEquipado(equipado = {}, itemById) {
  const outfit = itemById ? itemById(equipado.outfit) : null;
  const premium = outfit && equipado.outfit && equipado.outfit !== 'out_bata';
  const hat = itemById ? itemById(equipado.sombrero) : null;
  return {
    skin: equipado.piel || '#F2C9A0',
    hairStyle: equipado.pelo || 'pelo_corto',
    hairColor: equipado.pelo_color || '#3B2A20',
    shirtColor: premium ? outfit.color : (equipado.camisa_color || '#2563EB'),
    shirtAccent: premium ? outfit.acento : null,
    pantsColor: equipado.pantalon_color || '#3A4256',
    glasses: equipado.lentes || 'lentes_none',
    hatType: hat && hat.color !== 'transparent' ? hat.id : 'hat_none',
    hatColor: hat ? hat.color : null,
  };
}

// Apariencia determinista por semilla (para personas sin fila de juego).
export function seededSprite(key, pieles, peloColores, peinados) {
  const seed = String(key || '').split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const camisas = ['#64748B', '#2563EB', '#16A34A', '#B45309', '#7C3AED', '#0EA5E9', '#DC2626'];
  return {
    skin: pieles[seed % pieles.length],
    hairStyle: peinados[(seed * 3) % peinados.length].id,
    hairColor: peloColores[(seed * 7) % peloColores.length],
    shirtColor: camisas[(seed * 5) % camisas.length],
    pantsColor: ['#3A4256', '#1E3A8A', '#334155', '#5B3A1E'][(seed * 2) % 4],
    glasses: seed % 4 === 0 ? 'lentes_normal' : 'lentes_none',
    hatType: 'hat_none',
  };
}
