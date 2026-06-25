/* =====================================================================
   avatarSprite.js — Sprite pixel-art "cabezón" (idéntico al del HTML
   Lab Game). Una sola función dibuja el avatar en cualquier <canvas>,
   parametrizada con peinados, camisa, pantalón, lentes, gorra, piel y
   color de pelo. Se usa en el juego (PixelRoom) y en la personalización
   (AvatarPixel), así el modelo es idéntico en todos lados.

   Anclaje: (cx, cy) = punto medio de los PIES. Sprite 16×26 lógico; `S`
   es la escala en píxeles por unidad.
   ===================================================================== */

// aclara (+) / oscurece (-) un color hex
export function shade(hex, amt) {
  const h = String(hex || '#000').replace('#', '');
  if (h.length < 6) return hex;
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
  const f = (c) => Math.max(0, Math.min(255, Math.round(c + (amt < 0 ? c : 255 - c) * amt)));
  const x = (c) => f(c).toString(16).padStart(2, '0');
  return '#' + x(r) + x(g) + x(b);
}

export function drawAvatar(ctx, cx, cy, o = {}, S = 1) {
  S = S || 1;
  const dir = o.dir || 'down', skin = o.skin || '#F2C9A0', skinSh = shade(skin, -0.18), skinHi = shade(skin, 0.12);
  const hair = o.hairColor || '#3B2A20', hStyle = o.hairStyle || 'pelo_corto';
  const brow = shade(hair, -0.15);
  // molde fijo (forma), pero color de ropa sí se aplica
  const COAT = o.shirtColor || '#ffffff', COAT_SH = shade(COAT, -0.15), COAT_LP = shade(COAT, -0.08);
  const PANT = o.pantsColor || '#f1f3f6', PANT_SH = shade(PANT, -0.18), SHOE = '#3a2a1e', SHOE_SH = '#2a1d14';
  const sit = o.sitting, sleep = o.sleeping, fr = o.frame || 0, step = fr === 1 ? 1 : fr === 3 ? -1 : 0;
  const ox = Math.round(cx - 8 * S), oy = Math.round(cy - 26 * S);
  const P = (c, px, py, w, h) => { ctx.fillStyle = c; ctx.fillRect(ox + px * S, oy + py * S, w * S, h * S); };
  // sombra
  ctx.fillStyle = 'rgba(15,23,42,0.22)'; ctx.beginPath(); ctx.ellipse(cx, cy - 0.5 * S, 6.5 * S, 2.3 * S, 0, 0, Math.PI * 2); ctx.fill();

  // ---- PIERNAS (cuerpo muy chico) ----
  if (!sit) {
    P(SHOE_SH, 5, 19, 3, 5); P(PANT, 5, 19, 2, 2); P(skin, 5, 21, 2, 1); P(SHOE, 5, 22 + step, 2, 2);
    P(SHOE_SH, 8, 19, 3, 5); P(PANT, 8, 19, 2, 2); P(skin, 8, 21, 2, 1); P(SHOE, 8, 22 - step, 2, 2);
  } else {
    P(SHOE_SH, 5, 20, 6, 4); P(PANT, 5, 20, 6, 1); P(skin, 5, 21, 6, 1); P(SHOE, 5, 22, 6, 2);
  }

  // ---- TORSO (bata, muy chico) ----
  const tT = 14, tH = 5;
  P(SHOE_SH, 5, tT, 6, tH);
  P(COAT, 6, tT, 4, tH - 1);
  P(COAT_SH, 6, tT + tH - 2, 4, 1);
  if (dir !== 'up') { P(COAT_LP, 6, tT + 1, 1, tH - 2); P(COAT_LP, 9, tT + 1, 1, 2); P(SHOE_SH, 8, tT + 1, 1, tH - 2); }

  // ---- BRAZOS ----
  const aw = sit ? 0 : step;
  P(SHOE_SH, 4, tT, 2, 4); P(COAT, 4, tT, 2, 2 - Math.max(0, aw)); P(skin, 4, tT + 2 - aw, 2, 2);
  P(SHOE_SH, 10, tT, 2, 4); P(COAT, 10, tT, 2, 2 - Math.max(0, aw)); P(skin, 10, tT + 2 + aw, 2, 2);

  // ---- CABEZA GRANDE (cabezón) ----
  const hy = 0;
  P(SHOE_SH, 1, hy, 14, 14);                  // contorno cabeza (14x14)
  P(skin, 2, hy + 1, 12, 12);                 // piel
  P(skinHi, 2, hy + 1, 12, 1);                // luz frente
  P(skinSh, 2, hy + 11, 12, 1);               // mentón
  // orejas
  P(SHOE_SH, 0, hy + 6, 1, 3); P(skin, 0, hy + 7, 1, 2);
  P(SHOE_SH, 15, hy + 6, 1, 3); P(skin, 15, hy + 7, 1, 2);
  if (dir === 'left') P(skinSh, 2, hy + 5, 1, 4);
  if (dir === 'right') P(skinSh, 13, hy + 5, 1, 4);

  drawHair(P, hStyle, hair, dir, hy);

  // ---- CARA ----
  if (dir !== 'up') {
    const ey = hy + 6, eyebrowY = hy + 4;
    if (sleep) {
      P(SHOE_SH, 4, ey + 1, 3, 1); P(SHOE_SH, 9, ey + 1, 3, 1);
    } else if (dir === 'left') {
      P(brow, 4, eyebrowY, 3, 1);
      P(SHOE_SH, 4, ey, 3, 3); P('#ffffff', 4, ey, 3, 3); P('#2a1d14', 5, ey + 1, 2, 2);
    } else if (dir === 'right') {
      P(brow, 9, eyebrowY, 3, 1);
      P(SHOE_SH, 9, ey, 3, 3); P('#ffffff', 9, ey, 3, 3); P('#2a1d14', 9, ey + 1, 2, 2);
    } else {
      P(brow, 4, eyebrowY, 3, 1); P(brow, 9, eyebrowY, 3, 1);
      P(SHOE_SH, 4, ey, 3, 3); P(SHOE_SH, 9, ey, 3, 3);
      P('#ffffff', 4, ey, 3, 3); P('#ffffff', 9, ey, 3, 3);
      P('#2a1d14', 5, ey + 1, 2, 2); P('#2a1d14', 10, ey + 1, 2, 2);
      P('#ffffff', 5, ey + 1, 1, 1); P('#ffffff', 10, ey + 1, 1, 1);   // brillo
      P(skinSh, 8, ey + 3, 1, 1);                                       // nariz
    }
    drawGlasses(P, o.glasses, dir, ey);
  }
  if (o.hatType && o.hatType !== 'hat_none') drawHat(P, o.hatType, o.hatColor || '#DC2626', dir, hy);
  if (sleep) { ctx.fillStyle = '#64748b'; ctx.font = (5 * S) + 'px "Silkscreen",monospace'; ctx.fillText('z', ox + 15 * S, oy); }
}

function drawHair(P, style, color, dir, hy) {
  const hi = shade(color, 0.18), sh = shade(color, -0.25);
  if (style === 'pelo_none' || style === 'pelo_rapado') { P(color, 4, hy, 8, 2); return; }
  if (dir === 'up') {
    switch (style) {
      case 'pelo_largo': P(color, 2, hy, 12, 9); P(hi, 2, hy, 12, 2); P(color, 2, hy + 9, 12, 4); break;
      case 'pelo_coleta': P(color, 2, hy, 12, 9); P(hi, 2, hy, 12, 2); P(color, 6, hy + 9, 4, 5); break;
      case 'pelo_chongo': P(color, 2, hy, 12, 9); P(hi, 2, hy, 12, 2); P(color, 6, hy - 4, 4, 4); P(hi, 6, hy - 4, 4, 1); break;
      case 'pelo_afro': P(color, 1, hy - 3, 14, 15); P(hi, 1, hy - 3, 14, 2); break;
      case 'pelo_mohawk': P(color, 2, hy, 12, 9); P(color, 7, hy - 4, 3, 5); P(hi, 7, hy - 4, 3, 2); break;
      case 'pelo_punk': P(color, 2, hy, 12, 8); P(color, 4, hy - 5, 1, 5); P(color, 8, hy - 6, 1, 6); P(color, 11, hy - 5, 1, 5); break;
      case 'pelo_fleco': P(color, 2, hy, 12, 9); P(hi, 2, hy, 12, 2); break;
      default: P(color, 2, hy, 12, 8); P(hi, 2, hy, 12, 2);
    }
    return;
  }
  switch (style) {
    case 'pelo_largo': P(color, 2, hy - 1, 12, 5); P(hi, 2, hy - 1, 12, 1); P(color, 2, hy + 3, 2, 9); P(color, 12, hy + 3, 2, 9); break;
    case 'pelo_coleta': P(color, 2, hy - 1, 12, 5); P(hi, 2, hy - 1, 12, 1); P(color, 2, hy + 3, 1, 5); P(color, 13, hy + 3, 1, 5); P(color, 14, hy + 2, 2, 7); break;
    case 'pelo_chongo': P(color, 2, hy - 1, 12, 5); P(hi, 2, hy - 1, 12, 1); P(color, 7, hy - 4, 4, 4); P(hi, 7, hy - 4, 4, 1); break;
    case 'pelo_afro': P(color, 1, hy - 3, 14, 7); P(hi, 1, hy - 3, 14, 2); P(color, 1, hy + 3, 2, 5); P(color, 13, hy + 3, 2, 5); break;
    case 'pelo_mohawk': if (dir === 'left' || dir === 'right') { P(color, 4, hy - 3, 8, 3); P(hi, 4, hy - 3, 8, 1); } else { P(color, 7, hy - 4, 2, 5); P(hi, 7, hy - 4, 2, 2); } break;
    case 'pelo_fleco': P(color, 2, hy - 1, 12, 5); P(hi, 2, hy - 1, 12, 1); P(sh, 3, hy + 4, 10, 1); break;
    case 'pelo_punk': P(color, 5, hy - 2, 6, 5); P(color, 4, hy - 5, 1, 4); P(color, 8, hy - 6, 1, 5); P(color, 11, hy - 5, 1, 4); break;
    default: P(color, 2, hy - 1, 12, 5); P(hi, 2, hy - 1, 12, 1); P(color, 2, hy + 3, 1, 4); P(color, 13, hy + 3, 1, 4);
  }
}

function drawGlasses(P, g, dir, ey) {
  if (!g || g === 'lentes_none') return;
  const lens = g === 'lentes_sol' ? '#1b2236' : 'rgba(120,200,255,0.45)', rim = g === 'lentes_sol' ? '#0b0f1a' : '#2a3147';
  if (dir === 'left') { P(rim, 4, ey - 1, 3, 1); P(rim, 4, ey, 1, 3); P(rim, 6, ey, 1, 3); P(lens, 5, ey, 1, 2); return; }
  if (dir === 'right') { P(rim, 9, ey - 1, 3, 1); P(rim, 9, ey, 1, 3); P(rim, 11, ey, 1, 3); P(lens, 10, ey, 1, 2); return; }
  P(rim, 4, ey - 1, 8, 1);
  P(rim, 4, ey, 1, 3); P(rim, 7, ey, 1, 3); P(rim, 8, ey, 1, 3); P(rim, 11, ey, 1, 3);
  P(lens, 5, ey, 2, 2); P(lens, 9, ey, 2, 2);
}

function drawHat(P, type, color, dir, hy) {
  const hi = shade(color, 0.2), sh = shade(color, -0.3);
  if (type === 'hat_cap') { P(color, 2, hy - 1, 12, 3); P(hi, 2, hy - 1, 12, 1); if (dir === 'down') P(sh, 3, hy + 2, 10, 1); return; }
  if (type === 'hat_beanie') { P(color, 2, hy - 2, 12, 4); P(hi, 2, hy - 2, 12, 1); P(sh, 2, hy + 1, 12, 1); return; }
  if (type === 'hat_safety') { P(color, 2, hy - 2, 12, 4); P(color, 1, hy + 1, 14, 1); P(sh, 7, hy - 2, 2, 4); return; }
  if (type === 'hat_grad') { P(color, 1, hy - 1, 14, 2); P(color, 5, hy - 3, 6, 2); P('#FACC15', 10, hy - 2, 2, 1); return; }
  if (type === 'hat_crown') { P(color, 4, hy - 3, 8, 4); P(color, 4, hy - 5, 1, 3); P(color, 7, hy - 6, 1, 4); P(color, 11, hy - 5, 1, 3); return; }
  P(color, 2, hy - 1, 12, 3); P(hi, 2, hy - 1, 12, 1);
}

// ---------------------------------------------------------------------
// Mapea un `equipado` (estado guardado) a las opciones del sprite.
// ---------------------------------------------------------------------
export function spriteFromEquipado(equipado = {}, itemById) {
  const outfit = itemById ? itemById(equipado.outfit) : null;
  const premium = outfit && equipado.outfit && equipado.outfit !== 'out_bata';
  const hat = itemById ? itemById(equipado.sombrero) : null;
  return {
    skin: equipado.piel || '#F2C9A0',
    hairStyle: equipado.pelo || 'pelo_corto',
    hairColor: equipado.pelo_color || '#3B2A20',
    shirtColor: premium ? outfit.color : (equipado.camisa_color || '#ffffff'),
    pantsColor: equipado.pantalon_color || '#f1f3f6',
    glasses: equipado.lentes || 'lentes_none',
    hatType: hat && hat.color !== 'transparent' ? hat.id : 'hat_none',
    hatColor: hat ? hat.color : null,
  };
}

// Apariencia determinista por semilla (para personas sin fila de juego).
export function seededSprite(key, pieles, peloColores, peinados) {
  const seed = String(key || '').split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const camisas = ['#ffffff', '#2563EB', '#16A34A', '#B45309', '#7C3AED', '#0EA5E9', '#DC2626'];
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
