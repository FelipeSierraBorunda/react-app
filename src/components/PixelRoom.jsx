/* =====================================================================
   PixelRoom.jsx — Render estilo RPG top-down (GBA) del laboratorio.
   ---------------------------------------------------------------------
   Dibuja el CROQUIS REAL (mismas coords que el plano: lienzo 880×500)
   en un <canvas> pixel-art, con cámara que sigue al jugador y el OXXO
   como tienda física dentro del mapa. NO cambia la lógica del juego:
   recibe por props la posición/estado que ya calcula GameView.

   Arte 100% original (estilo del género top-down, no assets de terceros).
   ===================================================================== */

import { useRef, useEffect } from 'react';
import { STAGE_W, STAGE_H, SEAT } from '../lib/lab-layout.js';
import { drawAvatar, shade as shadeColor } from '../lib/avatarSprite.js';

const TILE = 20;                 // tamaño de baldosa en coords de mundo
const VIEW_W = 420, VIEW_H = 264; // viewport lógico (cámara acercada)

const MOD_ICON = { granja: '🌾', brazo: '🦾', inventario: '📦', almacen: '🗄️' };
const MOD_COLOR = { inventario: '#3D6FB4', almacen: '#3D6FB4', granja: '#C9772E', brazo: '#2A3142' };

export default function PixelRoom({
  mesas, seatPeople, pos, dir, moving, sitting, phase,
  playerSprite, decoItems, miMesa, nearModule, doorRect, playerName,
  floorTone = '#caa46b',
}) {
  const canvasRef = useRef(null);
  const stateRef = useRef({});
  stateRef.current = { mesas, seatPeople, pos, dir, moving, sitting, phase, playerSprite, decoItems, miMesa, nearModule, doorRect, playerName, floorTone };

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    let raf;
    const cam = { x: 0, y: 0 };

    const shade = (hex, amt) => {
      const h = String(hex).replace('#', ''); if (h.length < 6) return hex;
      const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
      const f = (c) => Math.max(0, Math.min(255, Math.round(c + (amt < 0 ? c : 255 - c) * amt)));
      const x = (c) => f(c).toString(16).padStart(2, '0');
      return '#' + x(r) + x(g) + x(b);
    };
    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

    // etiqueta de nombre + punto de presencia sobre un sprite
    function label(cx, feetY, name, you, opts) {
      const top = feetY - 26;
      if (name) {
        ctx.font = '7px "Silkscreen",monospace'; ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(255,255,255,0.92)'; ctx.fillText(name, cx + 0.6, top - 3.4);
        ctx.fillStyle = you ? '#15223e' : '#33406b'; ctx.fillText(name, cx, top - 4); ctx.textAlign = 'left';
      }
      if (opts && opts.dot) {
        ctx.fillStyle = opts.present ? '#22C55E' : '#94A3B8'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(cx + 6, top, 1.8, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      }
    }

    function drawChair(cx, cy) {
      const x = Math.round(cx - SEAT / 2), y = Math.round(cy - SEAT / 2);
      ctx.fillStyle = '#3A4252'; ctx.fillRect(x + 4, y - 1, SEAT - 8, 4);
      ctx.fillStyle = '#5B6675'; ctx.fillRect(x + 2, y + 3, SEAT - 4, SEAT - 5);
      ctx.fillStyle = '#3A4252'; ctx.fillRect(x + 2, y + SEAT - 3, SEAT - 4, 2);
    }

    function drawDesk(m) {
      const wood = (m.color && m.color !== '#ffffff') ? m.color : '#C8A06A';
      const drawRect = (rx, ry, rw, rh) => {
        ctx.fillStyle = shade(wood, -0.28); ctx.fillRect(rx, ry, rw, rh);
        ctx.fillStyle = wood; ctx.fillRect(rx, ry, rw, rh - 3);
        ctx.fillStyle = shade(wood, 0.2); ctx.fillRect(rx, ry, rw, 3);
        ctx.fillStyle = 'rgba(70,45,20,0.18)';
        for (let gx = rx + 4; gx < rx + rw - 2; gx += 7) ctx.fillRect(gx, ry + 4, 1, rh - 7);
        ctx.strokeStyle = '#3a2a18'; ctx.lineWidth = 1; ctx.strokeRect(rx + 0.5, ry + 0.5, rw - 1, rh - 1);
      };
      if (m.forma === 'L') {
        // recorte en L: pata vertical (derecha) + brazo superior
        const armH = Math.round(m.h * 0.48);
        drawRect(m.x, m.y, m.w, armH);
        drawRect(m.x + Math.round(m.w * 0.72), m.y, Math.round(m.w * 0.28), m.h);
      } else {
        drawRect(m.x, m.y, m.w, m.h);
      }
      if (m.pc) { ctx.fillStyle = '#1E293B'; ctx.fillRect(m.x + m.w - 22, m.y + 4, 16, 11);
        ctx.fillStyle = '#38BDF8'; ctx.fillRect(m.x + m.w - 20, m.y + 6, 12, 7); }
      // nombre
      ctx.font = '7px "Silkscreen",monospace'; ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(60,38,14,0.7)'; ctx.fillText(m.nombre, m.x + m.w / 2, m.y + m.h / 2 + 2);
      ctx.textAlign = 'left';
    }

    function drawModule(m, near) {
      const fill = MOD_COLOR[m.kind] || m.color || '#475569';
      ctx.fillStyle = shade(fill, -0.3); ctx.fillRect(m.x, m.y, m.w, m.h);
      ctx.fillStyle = fill; ctx.fillRect(m.x, m.y, m.w, m.h - 4);
      ctx.fillStyle = shade(fill, 0.18); ctx.fillRect(m.x, m.y, m.w, 3);
      // puerta/panel
      ctx.fillStyle = shade(fill, -0.45); ctx.fillRect(m.x + m.w / 2 - 7, m.y + m.h - 14, 14, 12);
      ctx.strokeStyle = near ? '#FACC15' : '#15223e'; ctx.lineWidth = near ? 2 : 1;
      ctx.strokeRect(m.x + 0.5, m.y + 0.5, m.w - 1, m.h - 1);
      ctx.font = '12px serif'; ctx.textAlign = 'center';
      ctx.fillText(MOD_ICON[m.kind] || '⬛', m.x + m.w / 2, m.y + m.h / 2 + 1);
      ctx.font = '7px "Silkscreen",monospace'; ctx.fillStyle = '#fff';
      ctx.fillText(m.nombre, m.x + m.w / 2, m.y + 9);
      ctx.textAlign = 'left';
    }

    function drawOxxo(d, near) {
      // edificio rojo OXXO contra la pared derecha
      const x = d.x - 8, y = d.y - 6, w = d.w + 8, h = d.h + 12;
      ctx.fillStyle = '#9c1f15'; ctx.fillRect(x, y, w, h);
      ctx.fillStyle = '#DA291C'; ctx.fillRect(x, y, w, h - 4);
      // toldo a rayas
      for (let i = 0; i < h; i += 10) { ctx.fillStyle = i % 20 === 0 ? '#FFC72C' : '#fff'; ctx.fillRect(x - 4, y + i, 5, 8); }
      // puerta de cristal
      ctx.fillStyle = '#0c1422'; ctx.fillRect(x + w / 2 - 7, y + h / 2 - 8, 14, 18);
      ctx.fillStyle = 'rgba(120,200,255,0.25)'; ctx.fillRect(x + w / 2 - 5, y + h / 2 - 6, 5, 14);
      ctx.strokeStyle = near ? '#FACC15' : '#7a160d'; ctx.lineWidth = near ? 2 : 1;
      ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
      // letrero vertical
      ctx.save(); ctx.translate(x + w / 2, y + 14); ctx.font = '9px "Press Start 2P",monospace';
      ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.fillText('OXXO', 0, 0); ctx.restore();
      ctx.textAlign = 'left';
    }

    function prompt(wx, wy, text) {
      ctx.font = '7px "Silkscreen",monospace'; ctx.textAlign = 'center';
      const w = ctx.measureText(text).width + 10;
      ctx.fillStyle = '#0F172A'; ctx.fillRect(wx - w / 2, wy - 10, w, 12);
      ctx.fillStyle = '#fff'; ctx.fillText(text, wx, wy - 1.5); ctx.textAlign = 'left';
    }

    function draw() {
      const s = stateRef.current;
      const p = s.pos || { x: STAGE_W / 2, y: STAGE_H / 2 };
      cam.x = clamp(p.x - VIEW_W / 2, 0, STAGE_W - VIEW_W);
      cam.y = clamp(p.y - VIEW_H / 2, 0, STAGE_H - VIEW_H);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, VIEW_W, VIEW_H);
      ctx.translate(-Math.round(cam.x), -Math.round(cam.y));

      // ---- piso de duela (cálido, estilo lab GBA) ----
      const tone = s.floorTone || '#caa46b';
      const x0 = Math.floor(cam.x / TILE) - 1, y0 = Math.floor(cam.y / TILE) - 1;
      for (let ty = y0; ty < y0 + VIEW_H / TILE + 3; ty++) {
        for (let tx = x0; tx < x0 + VIEW_W / TILE + 3; tx++) {
          const px = tx * TILE, py = ty * TILE;
          const out = px < 0 || py < 0 || px >= STAGE_W || py >= STAGE_H;
          if (out) { ctx.fillStyle = '#5b6677'; ctx.fillRect(px, py, TILE, TILE);
            ctx.fillStyle = '#6c788c'; ctx.fillRect(px, py, TILE, 3); continue; }
          const alt = (tx + ty) % 2 === 0;
          ctx.fillStyle = alt ? tone : shade(tone, -0.05); ctx.fillRect(px, py, TILE, TILE);
          ctx.fillStyle = 'rgba(90,60,25,0.10)'; ctx.fillRect(px, py, TILE, 1); ctx.fillRect(px, py, 1, TILE);
          ctx.fillStyle = 'rgba(255,255,255,0.05)'; ctx.fillRect(px, py + 1, TILE, 1);
        }
      }
      // borde del cuarto
      ctx.strokeStyle = '#8a7350'; ctx.lineWidth = 4; ctx.strokeRect(2, 2, STAGE_W - 4, STAGE_H - 4);

      // ---- OXXO físico ----
      if (s.doorRect) {
        const near = s.nearModule == null && s.pos && s.pos.x > s.doorRect.x - 30;
        drawOxxo(s.doorRect, near);
      }

      // ---- y-sort: muebles, sillas, personas, jugador ----
      const draws = [];
      (s.mesas || []).forEach((m) => {
        if (m.kind === 'mesa') draws.push({ y: m.y + m.h, fn: () => drawDesk(m) });
        else draws.push({ y: m.y + m.h, fn: () => drawModule(m, s.nearModule && s.nearModule.id === m.id) });
      });
      // deco en mi mesa
      if (s.decoItems && s.decoItems.length && s.miMesa) {
        const mm = s.miMesa;
        draws.push({ y: mm.y, fn: () => {
          ctx.font = '11px serif'; ctx.textAlign = 'center';
          const total = s.decoItems.length, gap = 13;
          s.decoItems.forEach((d, i) => ctx.fillText(d.emoji, mm.x + mm.w / 2 + (i - (total - 1) / 2) * gap, mm.y - 4));
          ctx.textAlign = 'left';
        } });
      }
      (s.seatPeople || []).forEach((seat) => {
        draws.push({ y: seat.y, fn: () => {
          drawChair(seat.x, seat.y);
          if (seat.info) {
            drawAvatar(ctx, seat.x, seat.y + 2, { ...(seat.info.sprite || {}), dir: 'up', sitting: true, sleeping: !seat.info.presente }, 1);
            label(seat.x, seat.y + 2, seat.info.nombre, false, { dot: true, present: seat.info.presente });
          }
        } });
      });
      // jugador
      const p2 = s.pos || { x: STAGE_W / 2, y: STAGE_H / 2 };
      draws.push({ y: p2.y, fn: () => {
        drawAvatar(ctx, p2.x, p2.y + 4, { ...(s.playerSprite || {}), dir: s.dir, sitting: s.sitting, frame: s.moving ? s.phase : 0 }, 1.05);
        label(p2.x, p2.y + 4, s.playerName, true);
      } });
      draws.sort((a, b) => a.y - b.y).forEach((d) => d.fn());

      // prompt módulo
      if (s.nearModule) prompt(s.nearModule.x + s.nearModule.w / 2, s.nearModule.y - 2, (s.nearModule.link ? '🔗 ' : '➡ ') + 'Entrar · E');

      raf = requestAnimationFrame(draw);
    }
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div style={{ width: '100%', maxWidth: 880, margin: '0 auto', borderRadius: 8, overflow: 'hidden', border: '5px solid #2a3147', boxShadow: '0 0 0 3px #1b2030, 0 14px 40px rgba(0,0,0,0.4)', background: '#000' }}>
      <canvas
        ref={canvasRef}
        width={VIEW_W}
        height={VIEW_H}
        style={{ display: 'block', width: '100%', height: 'auto', imageRendering: 'pixelated' }}
      />
    </div>
  );
}
