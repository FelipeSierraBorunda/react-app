/* =====================================================================
   PixelRoom.jsx — Render pixel-art del laboratorio + tienda OXXO.
   ---------------------------------------------------------------------
   Dibuja el croquis real (lab 880×500, desde Supabase) y, a su derecha,
   un pasillo de 4 losas que conecta con una sala OXXO de 8×8 caminable
   (refrigeradores, góndolas y caja, estilo 7-Eleven). Cámara que sigue al
   jugador con ZOOM ajustable. Mesas vacías (listas para decorar). Nombres
   en un pase final encima de todo.
   ===================================================================== */

import { useRef, useEffect } from 'react';
import { SEAT } from '../lib/lab-layout.js';
import { drawAvatar } from '../lib/avatarSprite.js';
import {
  TILE, LAB_W, LAB_H, HALL, OXXO, WORLD_W, WORLD_H, OXXO_FIXTURES, SHOP, FRIDGE_DEFAULT,
  regionAt, nearShop,
} from '../lib/world.js';

const VIEW_W = 420, VIEW_H = 264;

export default function PixelRoom({
  mesas, seatPeople, pos, dir, moving, sitting, phase,
  playerSprite, decoByMesa, miMesa, nearModule, playerName, zoom = 2, editSelId = null,
  deskEditId = null, fridge = null, pet = null, aura = null,
}) {
  const canvasRef = useRef(null);
  const stateRef = useRef({});
  stateRef.current = { mesas, seatPeople, pos, dir, moving, sitting, phase, playerSprite, decoByMesa, miMesa, nearModule, playerName, zoom, editSelId, deskEditId, fridge, pet, aura };

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    let raf;
    const cam = { x: 0, y: 0 };

    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    const shade = (hex, amt) => {
      const h = String(hex || '#888').replace('#', '');
      if (h.length < 6) return hex;
      const r = parseInt(h.slice(0,2),16), g = parseInt(h.slice(2,4),16), b = parseInt(h.slice(4,6),16);
      const f = c => Math.max(0,Math.min(255,Math.round(c+(amt<0?c:255-c)*amt)));
      const x = c => f(c).toString(16).padStart(2,'0');
      return '#'+x(r)+x(g)+x(b);
    };

    // ---- silla de oficina ROJA (vista superior, idéntica al HTML) ----
    function drawChair(cx, cy) {
      const x = Math.round(cx), y = Math.round(cy);
      ctx.fillStyle = 'rgba(15,23,42,0.18)'; ctx.beginPath(); ctx.ellipse(x, y + 8, 11, 4, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#1f1f24'; ctx.fillRect(x - 2, y + 4, 4, 8);          // poste
      ctx.fillStyle = '#0f0f12'; ctx.fillRect(x - 9, y + 10, 18, 3);        // base estrella
      ctx.fillStyle = '#7a1414'; ctx.fillRect(x - 9, y - 9, 18, 16);        // respaldo (contorno)
      ctx.fillStyle = '#b51f1f'; ctx.fillRect(x - 8, y - 8, 16, 14);        // tapizado
      ctx.fillStyle = '#d94a3a'; ctx.fillRect(x - 7, y - 7, 14, 3);         // brillo
      ctx.fillStyle = '#7a1414'; ctx.fillRect(x - 9, y - 2, 2, 7); ctx.fillRect(x + 7, y - 2, 2, 7); // descansabrazos
    }

    // textura sobre la superficie de la mesa (idéntica al HTML)
    function texOverlay(x, y, w, h, tex) {
      if (tex === 'vetas') { ctx.fillStyle = 'rgba(0,0,0,0.12)'; for (let gx = x + 4; gx < x + w - 2; gx += 7) ctx.fillRect(gx, y + 3, 1, h - 5); }
      else if (tex === 'cuadros') { ctx.fillStyle = 'rgba(0,0,0,0.10)'; for (let gx = x + 5; gx < x + w - 2; gx += 8) ctx.fillRect(gx, y + 2, 1, h - 3); for (let gy = y + 5; gy < y + h - 1; gy += 8) ctx.fillRect(x + 1, gy, w - 2, 1); }
    }
    // ---- escritorio (madera con vetas, idéntico al HTML) ----
    function drawDesk(m) {
      const wood = (m.color && m.color !== '#ffffff') ? m.color : '#c89a5a';
      const wsh = shade(wood, -0.25), whi = shade(wood, 0.15);
      const tex = m.tex || 'liso';
      const dr = (rx, ry, rw, rh) => {
        ctx.fillStyle = wsh; ctx.fillRect(rx, ry + rh - 3, rw, 3);
        ctx.fillStyle = wood; ctx.fillRect(rx, ry, rw, rh - 3);
        ctx.fillStyle = whi; ctx.fillRect(rx, ry, rw, 2);
        texOverlay(rx, ry, rw, rh - 3, tex);
        ctx.strokeStyle = '#5a3a18'; ctx.lineWidth = 1.2; ctx.strokeRect(rx + 0.5, ry + 0.5, rw - 1, rh - 1);
      };
      if (m.forma === 'L') {
        const ah = Math.round(m.h * 0.48);
        dr(m.x, m.y, m.w, ah);
        dr(m.x + Math.round(m.w * 0.72), m.y, Math.round(m.w * 0.28), m.h);
      } else {
        dr(m.x, m.y, m.w, m.h);
      }
      // monitor + teclado si la mesa tiene PC; si no, una bandeja chica
      if (m.pc) {
        const mx = m.x + m.w - 26, my = m.y + 3;
        ctx.fillStyle = '#1a2236'; ctx.fillRect(mx, my, 22, 14);
        ctx.fillStyle = '#2a4a8c'; ctx.fillRect(mx + 1, my + 1, 20, 11);
        ctx.fillStyle = 'rgba(120,180,255,0.35)'; ctx.fillRect(mx + 1, my + 1, 20, 3);
        ctx.fillStyle = '#3a4252'; ctx.fillRect(mx + 7, my + 14, 8, 3);
        ctx.fillStyle = '#c8c0b0'; ctx.fillRect(mx - 14, my + 6, 12, 7);
        ctx.fillStyle = '#b0a898'; ctx.fillRect(mx - 13, my + 7, 10, 2); ctx.fillRect(mx - 13, my + 10, 10, 2);
      } else if (m.w > 60) {
        ctx.fillStyle = '#8a7a6a'; ctx.fillRect(m.x + 6, m.y + 4, 8, 4);
        ctx.fillStyle = '#6a5a4a'; ctx.fillRect(m.x + 7, m.y + 5, 6, 2);
      }
      // nombre tenue (etiqueta)
      ctx.font = '7px "Silkscreen",monospace'; ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(60,35,10,0.65)';
      ctx.fillText(m.nombre, m.x + m.w / 2, m.y + m.h / 2 + 2); ctx.textAlign = 'left';
    }
    // ---- refrigerador (idéntico al HTML) ----
    function drawFridge(X, Y) {
      const body = '#dfe4e9', bodySh = '#b9c1c9', out = '#7c848d', line = '#9aa2ab';
      ctx.fillStyle = 'rgba(15,23,42,0.16)'; ctx.fillRect(X + 1, Y + 24, 18, 3);
      ctx.fillStyle = body; ctx.fillRect(X + 1, Y, 18, 26);
      ctx.fillStyle = bodySh; ctx.fillRect(X + 15, Y, 4, 26);
      ctx.fillStyle = '#eef2f5'; ctx.fillRect(X + 1, Y, 18, 2);
      ctx.fillStyle = line; ctx.fillRect(X + 1, Y + 10, 18, 1);
      ctx.fillStyle = '#6f777f'; ctx.fillRect(X + 3, Y + 3, 2, 5); ctx.fillRect(X + 3, Y + 13, 2, 8);
      ctx.fillStyle = '#bfe0d2'; ctx.fillRect(X + 12, Y + 14, 4, 4);
      ctx.strokeStyle = out; ctx.lineWidth = 1.2; ctx.strokeRect(X + 1.5, Y + 0.5, 17, 25);
    }

    // ---- módulos especiales ----
    function drawModule(m, near) {
      switch (m.kind) {
        case 'granja':   drawRack(m, near); break;
        case 'brazo':    drawBrazo(m, near); break;
        case 'inventario': drawInventario(m, near); break;
        case 'almacen':  drawAlmacen(m, near); break;
        default:         drawGenericModule(m, near);
      }
    }
    function drawRack(m, near) {
      ctx.fillStyle = '#c0291a'; ctx.fillRect(m.x-4, m.y+m.h-6, m.w+8, 8);
      ctx.fillStyle = '#111827'; ctx.fillRect(m.x, m.y, m.w, m.h);
      ctx.fillStyle = '#1f2937'; ctx.fillRect(m.x+2, m.y+2, m.w-4, m.h-4);
      for (let ry=m.y+4; ry<m.y+m.h-6; ry+=8) {
        ctx.fillStyle='#374151'; ctx.fillRect(m.x+3, ry, m.w-6, 6);
        ctx.fillStyle='rgba(0,255,100,0.85)'; ctx.fillRect(m.x+m.w-10, ry+2, 3, 2);
        ctx.fillStyle='rgba(0,120,255,0.75)'; ctx.fillRect(m.x+m.w-15, ry+2, 2, 2);
      }
      ctx.strokeStyle = near ? '#FACC15' : '#374151'; ctx.lineWidth=1.5;
      ctx.strokeRect(m.x+0.5,m.y+0.5,m.w-1,m.h-1);
      ctx.font='7px "Silkscreen",monospace'; ctx.fillStyle='#fff'; ctx.textAlign='center';
      ctx.fillText('GRANJA FPGA', m.x+m.w/2, m.y+8); ctx.textAlign='left';
    }
    function drawBrazo(m, near) {
      ctx.fillStyle='#374151'; ctx.fillRect(m.x, m.y, m.w, m.h);
      ctx.fillStyle='#4b5563'; ctx.fillRect(m.x,m.y,m.w,m.h-3);
      ctx.fillStyle='#6b7280'; ctx.fillRect(m.x,m.y,m.w,2);
      const bx=m.x+m.w/2-4, by=m.y+3;
      ctx.fillStyle='#9ca3af'; ctx.fillRect(bx,by+6,8,8);
      ctx.fillStyle='#d1d5db'; ctx.fillRect(bx+2,by+2,4,8);
      ctx.fillStyle='#f3f4f6'; ctx.fillRect(bx+4,by,6,4);
      ctx.fillStyle='#fbbf24'; ctx.fillRect(bx+8,by+1,2,2);
      ctx.strokeStyle = near?'#FACC15':'#1f2937'; ctx.lineWidth=1;
      ctx.strokeRect(m.x+0.5,m.y+0.5,m.w-1,m.h-1);
      ctx.font='6px "Silkscreen",monospace'; ctx.fillStyle='#d1d5db'; ctx.textAlign='center';
      ctx.fillText('BRAZO', m.x+m.w/2, m.y+m.h-2); ctx.textAlign='left';
    }
    function drawInventario(m, near) {
      ctx.fillStyle='#1e3a6e'; ctx.fillRect(m.x,m.y,m.w,m.h);
      ctx.fillStyle='#2a5298'; ctx.fillRect(m.x,m.y,m.w,m.h-4);
      ctx.fillStyle='#4a7adf'; ctx.fillRect(m.x,m.y,m.w,3);
      for (let ry=m.y+6; ry<m.y+m.h-8; ry+=12) {
        ctx.fillStyle='#1e3a6e'; ctx.fillRect(m.x+4,ry,m.w-8,10);
        ctx.fillStyle='#c0c0c0'; ctx.fillRect(m.x+m.w/2-4,ry+4,8,2);
      }
      ctx.strokeStyle = near?'#FACC15':'#1a2e54'; ctx.lineWidth=1.2;
      ctx.strokeRect(m.x+0.5,m.y+0.5,m.w-1,m.h-1);
      ctx.font='6px "Silkscreen",monospace'; ctx.fillStyle='#fff'; ctx.textAlign='center';
      ctx.fillText('INV', m.x+m.w/2, m.y+9); ctx.textAlign='left';
    }
    function drawAlmacen(m, near) {
      const c1='#d4a05a', c2='#b8883a', c3='#e8bc70';
      ctx.fillStyle=c1; ctx.fillRect(m.x,m.y,m.w,m.h);
      ctx.fillStyle=c2; ctx.fillRect(m.x+2,m.y+m.h*0.55,m.w-4,m.h*0.42);
      ctx.fillStyle=c3; ctx.fillRect(m.x+2,m.y+m.h*0.55,m.w-4,4);
      ctx.fillStyle='rgba(90,50,10,0.3)'; ctx.fillRect(m.x+m.w/2-1,m.y+m.h*0.55,2,m.h*0.42);
      ctx.fillStyle=c1; ctx.fillRect(m.x+6,m.y+m.h*0.2,m.w-18,m.h*0.32);
      ctx.fillStyle=c3; ctx.fillRect(m.x+6,m.y+m.h*0.2,m.w-18,3);
      ctx.fillStyle='rgba(90,50,10,0.25)'; ctx.fillRect(m.x+m.w/2-1,m.y+m.h*0.2,2,m.h*0.32);
      ctx.strokeStyle=near?'#FACC15':'#8B5E2A'; ctx.lineWidth=1.2;
      ctx.strokeRect(m.x+0.5,m.y+0.5,m.w-1,m.h-1);
      ctx.font='6px "Silkscreen",monospace'; ctx.fillStyle='#5a3a10'; ctx.textAlign='center';
      ctx.fillText('ALMACÉN', m.x+m.w/2, m.y+9); ctx.textAlign='left';
    }
    function drawGenericModule(m, near) {
      ctx.fillStyle='#4b5563'; ctx.fillRect(m.x,m.y,m.w,m.h);
      ctx.fillStyle='#6b7280'; ctx.fillRect(m.x,m.y,m.w,m.h-3);
      ctx.strokeStyle=near?'#FACC15':'#374151'; ctx.lineWidth=1;
      ctx.strokeRect(m.x+0.5,m.y+0.5,m.w-1,m.h-1);
      ctx.font='7px "Silkscreen",monospace'; ctx.fillStyle='#fff'; ctx.textAlign='center';
      ctx.fillText(m.nombre,m.x+m.w/2,m.y+m.h/2+2); ctx.textAlign='left';
    }

    // ---- losa individual ----
    function drawFloorTile(px, py, tx, ty, reg) {
      if (reg === 'oxxo') {
        const even = ((tx + ty) & 1) === 0;
        ctx.fillStyle = even ? '#f3f4f6' : '#e7eaf0'; ctx.fillRect(px, py, TILE, TILE);
        ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fillRect(px, py, TILE, 1); ctx.fillRect(px, py, 1, TILE);
        ctx.fillStyle = 'rgba(120,120,140,0.16)'; ctx.fillRect(px, py+TILE-1, TILE, 1); ctx.fillRect(px+TILE-1, py, 1, TILE);
        return;
      }
      // lab / pasillo: baldosa crema
      ctx.fillStyle = (tx + ty) % 2 === 0 ? '#ede0c4' : '#e4d7b8'; ctx.fillRect(px, py, TILE, TILE);
      ctx.fillStyle = 'rgba(120,90,40,0.12)'; ctx.fillRect(px, py, TILE, 1); ctx.fillRect(px, py, 1, TILE);
      ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fillRect(px+1, py+1, TILE-2, 1);
    }

    // ---- refrigeradores con bebidas (pared derecha del OXXO) ----
    function drawCoolers(x, y, w, h) {
      ctx.fillStyle='#8b949d'; ctx.fillRect(x-1,y-1,w+1,h+2);
      const doors=Math.max(1,Math.round(h/22)), dh=h/doors;
      const drinks=['#DA291C','#16A34A','#2563EB','#FFC72C','#ffffff','#F97316','#0EA5E9','#DC2626'];
      for(let i=0;i<doors;i++){ const dy=y+i*dh+1;
        ctx.fillStyle='#26333d'; ctx.fillRect(x+1,dy,w-2,dh-2);
        for(let s=0;s<2;s++)for(let b=0;b<3;b++){ ctx.fillStyle=drinks[(i*2+s*3+b)%drinks.length];
          ctx.fillRect(x+3+b*((w-6)/3), dy+2+s*((dh-3)/2), Math.max(2,(w-6)/3-1), (dh-3)/2-1); }
        ctx.fillStyle='rgba(190,225,255,0.16)'; ctx.fillRect(x+1,dy,w-2,2);
        ctx.fillStyle='rgba(255,255,255,0.20)'; ctx.fillRect(x+2,dy,2,dh-3);
        ctx.strokeStyle='#5e6973'; ctx.lineWidth=1; ctx.strokeRect(x+1.5,dy+0.5,w-3,dh-2);
      }
    }
    // ---- góndola (estante doble con producto) ----
    function drawGondola(x, y, w, h) {
      ctx.fillStyle='rgba(15,23,42,0.18)'; ctx.fillRect(x,y+h,w,3);
      ctx.fillStyle='#cfd4db'; ctx.fillRect(x,y,w,h);
      ctx.fillStyle='#aab1bb'; ctx.fillRect(x,y+h-3,w,3);
      ctx.fillStyle='#e8ebef'; ctx.fillRect(x,y,w,2);
      const prod=['#DA291C','#2563EB','#16A34A','#FFC72C','#7C3AED','#F97316','#0EA5E9','#DC2626','#10B981','#fff'];
      const n=Math.max(1,Math.floor(w/6));
      for(let i=0;i<n;i++){ ctx.fillStyle=prod[(i*7)%prod.length]; ctx.fillRect(x+2+i*(w-4)/n, y+2, Math.max(2,(w-4)/n-1), h-5); }
    }
    // ---- caja registradora / mostrador ----
    function drawCheckout(x, y, w, h) {
      ctx.fillStyle='rgba(15,23,42,0.18)'; ctx.fillRect(x,y+h,w,3);
      ctx.fillStyle='#7a160d'; ctx.fillRect(x,y,w,h);
      ctx.fillStyle='#b5482f'; ctx.fillRect(x,y,w,h-4);
      ctx.fillStyle='#FFC72C'; ctx.fillRect(x,y,w,3);
      ctx.fillStyle='#2a3147'; ctx.fillRect(x+w-15,y-8,11,9);
      ctx.fillStyle='#9fd2e6'; ctx.fillRect(x+w-14,y-7,9,4);
      ctx.fillStyle='#1b2230'; ctx.fillRect(x+w-13,y-2,7,2);
      ctx.fillStyle='#1f2937'; ctx.fillRect(x+4,y-5,6,6); ctx.fillStyle='#4ade80'; ctx.fillRect(x+5,y-4,4,2);
      const cc=['#DA291C','#16A34A','#2563EB','#FFC72C']; const cw=(w-4)/4;
      for(let i=0;i<4;i++){ ctx.fillStyle=cc[i]; ctx.fillRect(x+2+i*cw, y+h-5, cw-1, 4); }
      ctx.font='5px "Silkscreen",monospace'; ctx.fillStyle='#fff'; ctx.textAlign='center'; ctx.fillText('CAJA', x+w/2, y+h-1); ctx.textAlign='left';
    }
    function drawOxxoRoom() {
      const f = OXXO_FIXTURES;
      // letrero OXXO sobre la pared superior
      ctx.font='8px "Press Start 2P",monospace'; ctx.textAlign='center';
      ctx.fillStyle='#FFC72C'; ctx.fillRect(OXXO.x+OXXO.w/2-24, OXXO.y-13, 48, 11);
      ctx.fillStyle='#DA291C'; ctx.fillText('OXXO', OXXO.x+OXXO.w/2, OXXO.y-5);
      ctx.textAlign='left';
      drawCoolers(f.coolers.x, f.coolers.y, f.coolers.w, f.coolers.h);
      drawGondola(f.gondola1.x, f.gondola1.y, f.gondola1.w, f.gondola1.h);
      drawGondola(f.gondola2.x, f.gondola2.y, f.gondola2.w, f.gondola2.h);
      drawCheckout(f.checkout.x, f.checkout.y, f.checkout.w, f.checkout.h);
    }

    // ---- prompt (E) ----
    function drawSel(m) {
      ctx.strokeStyle = '#FACC15'; ctx.lineWidth = 2; ctx.setLineDash([4, 3]);
      ctx.strokeRect(m.x - 1.5, m.y - 1.5, m.w + 3, m.h + 3); ctx.setLineDash([]);
      const hs = 5; ctx.fillStyle = '#FACC15';
      [[m.x, m.y], [m.x + m.w, m.y], [m.x, m.y + m.h], [m.x + m.w, m.y + m.h]].forEach(([hx, hy]) =>
        ctx.fillRect(hx - hs/2, hy - hs/2, hs, hs));
    }
    function drawPrompt(wx, wy, text) {
      ctx.font='bold 8px "Silkscreen",monospace'; ctx.textAlign='center';
      const w=ctx.measureText(text).width+12;
      ctx.fillStyle='rgba(15,23,42,0.88)'; ctx.fillRect(wx-w/2,wy-11,w,13);
      ctx.fillStyle='#FACC15'; ctx.fillText(text, wx, wy-1.5); ctx.textAlign='left';
    }

    function draw() {
      const s = stateRef.current;
      const Z = s.zoom || 2;
      const vw = VIEW_W / Z, vh = VIEW_H / Z;
      const p = s.pos || { x: LAB_W/2, y: LAB_H/2 };
      cam.x = clamp(p.x - vw/2, 0, Math.max(0, WORLD_W - vw));
      cam.y = clamp(p.y - vh/2, 0, Math.max(0, WORLD_H - vh));

      ctx.setTransform(1,0,0,1,0,0);
      ctx.fillStyle='#0b0d14'; ctx.fillRect(0,0,VIEW_W,VIEW_H);   // vacío fuera de las salas
      ctx.setTransform(Z,0,0,Z, -Math.round(cam.x*Z), -Math.round(cam.y*Z));

      // ---- piso + paredes (solo losas visibles) ----
      const tx0=Math.floor(cam.x/TILE)-1, ty0=Math.floor(cam.y/TILE)-1;
      const tx1=Math.ceil((cam.x+vw)/TILE)+1, ty1=Math.ceil((cam.y+vh)/TILE)+1;
      for(let ty=ty0;ty<ty1;ty++) for(let tx=tx0;tx<tx1;tx++){
        const px=tx*TILE, py=ty*TILE;
        const reg=regionAt(px+TILE/2, py+TILE/2);
        if(reg){ drawFloorTile(px,py,tx,ty,reg); continue; }
        // ¿pared? (vacío junto a una sala)
        let adj=false;
        for(let dy=-1;dy<=1&&!adj;dy++)for(let dx=-1;dx<=1;dx++){ if(regionAt(px+TILE/2+dx*TILE, py+TILE/2+dy*TILE)){adj=true;break;} }
        if(adj){
          ctx.fillStyle='#f4f5f7'; ctx.fillRect(px,py,TILE,TILE);
          ctx.fillStyle='#ffffff'; ctx.fillRect(px,py,TILE,3);
          ctx.fillStyle='#d4d8de'; ctx.fillRect(px,py+TILE-3,TILE,3);
        }
      }

      // letrero del laboratorio
      ctx.fillStyle='#f5f0e0'; ctx.fillRect(10,4,320,20);
      ctx.strokeStyle='#8a7050'; ctx.lineWidth=1.5; ctx.strokeRect(10,4,320,20);
      ctx.font='bold 9px "Silkscreen",monospace'; ctx.fillStyle='#2a1a0a'; ctx.textAlign='left';
      ctx.fillText('LABORATORIO DE INVESTIGACIÓN', 16, 18); ctx.textAlign='left';

      // mobiliario interior del OXXO
      drawOxxoRoom();
      // refrigerador del laboratorio (movible)
      const fr = s.fridge || FRIDGE_DEFAULT;
      drawFridge(fr.x, fr.y);
      if (s.editSelId === '__fridge') drawSel(fr);

      // ---- y-sort: muebles + sillas + sprites ----
      const draws = [];
      const labels = [];

      (s.mesas||[]).forEach(m => {
        const sel = s.editSelId && m.id === s.editSelId;
        if(m.kind==='mesa') draws.push({y:m.y+m.h, fn:()=>{ drawDesk(m); if(sel) drawSel(m); }});
        else draws.push({y:m.y+m.h, fn:()=>{ drawModule(m, (s.nearModule&&s.nearModule.id===m.id)||sel); if(sel) drawSel(m); }});
      });

      // deco de TODAS las mesas (con posición guardada; default si no tiene).
      // Todos ven lo que cada quien compró y acomodó en su escritorio.
      if (s.decoByMesa) {
        (s.mesas || []).forEach((m) => {
          const items = s.decoByMesa[m.id];
          if (!items || !items.length) return;
          const total = items.length, gap = 13;
          const editing = s.deskEditId === m.id;
          draws.push({ y: m.y + m.h + 0.5, fn: () => {
            items.forEach((d, i) => {
              const dx = (d.dx == null) ? (m.w / 2 + (i - (total - 1) / 2) * gap) : d.dx;
              const dy = (d.dy == null) ? -4 : d.dy;
              const ox = m.x + dx, oy = m.y + dy;
              if (editing) {
                ctx.fillStyle = 'rgba(52,211,153,0.25)';
                ctx.strokeStyle = '#059669'; ctx.lineWidth = 1;
                ctx.beginPath(); ctx.arc(ox, oy - 3, 8, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
              }
              ctx.font = '11px serif'; ctx.textAlign = 'center';
              ctx.fillStyle = '#000';
              ctx.fillText(d.emoji, ox, oy);
              ctx.textAlign = 'left';
            });
          }});
        });
      }

      // sillas + personas sentadas
      (s.seatPeople||[]).forEach(seat => {
        draws.push({y:seat.y, fn:()=>{
          drawChair(seat.x, seat.y);
          if(seat.info) {
            drawAvatar(ctx, seat.x, seat.y+2, {
              ...(seat.info.sprite||{}), dir: seat.dir || 'up', sitting:true, sleeping:!seat.info.presente
            }, 1);
            // Nombre solo si el jugador está cerca (< 45 px) — evita amontonamiento
            if (Math.hypot(seat.x - p.x, seat.y - p.y) < 45) {
              labels.push({ cx:seat.x, fy:seat.y+2, name:seat.info.nombre, you:false, present:seat.info.presente, dot:true });
            }
          }
        }});
      });

      // jugador (con aura debajo y mascota al lado)
      const p2=s.pos||{x:LAB_W/2,y:LAB_H/2};
      draws.push({y:p2.y, fn:()=>{
        if (s.aura && s.aura.color && s.aura.color !== 'transparent' && s.aura.id !== 'aura_none') {
          ctx.save(); ctx.globalAlpha = 0.5; ctx.fillStyle = s.aura.color;
          ctx.beginPath(); ctx.ellipse(p2.x, p2.y, 13, 6, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
        }
        drawAvatar(ctx, p2.x, p2.y+4, {
          ...(s.playerSprite||{}), dir:s.dir, sitting:s.sitting, frame:s.moving?s.phase:0
        }, 1.05);
        if (s.pet && s.pet.emoji && s.pet.id !== 'pet_none') {
          ctx.font = '11px serif'; ctx.textAlign = 'center';
          ctx.fillText(s.pet.emoji, p2.x + 14, p2.y); ctx.textAlign = 'left';
        }
        labels.push({ cx:p2.x, fy:p2.y+4, name:s.playerName, you:true });
      }});

      draws.sort((a,b)=>a.y-b.y).forEach(d=>d.fn());

      // ---- nombres encima de todo ----
      labels.forEach(l => {
        if(!l.name) return;
        const top = l.fy - 28;
        ctx.font = 'bold 8px "Silkscreen",monospace'; ctx.textAlign='center';
        ctx.fillStyle='rgba(0,0,0,0.7)'; ctx.fillText(l.name, l.cx+1, top+1);
        ctx.fillStyle = l.you ? '#FACC15' : '#ffffff'; ctx.fillText(l.name, l.cx, top);
        if(l.dot) {
          ctx.fillStyle = l.present?'#22C55E':'#94A3B8';
          ctx.strokeStyle='#000'; ctx.lineWidth=1;
          ctx.beginPath(); ctx.arc(l.cx+ctx.measureText(l.name).width/2+5, top-2, 2.5, 0, Math.PI*2);
          ctx.fill(); ctx.stroke();
        }
        ctx.textAlign='left';
      });

      // prompts (E)
      if(s.nearModule) drawPrompt(s.nearModule.x+s.nearModule.w/2, s.nearModule.y-4, '→ Entrar · E');
      if(nearShop(p2.x, p2.y)) drawPrompt(SHOP.x+SHOP.w/2, SHOP.y-3, '🛒 Comprar · E');

      raf = requestAnimationFrame(draw);
    }
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div style={{ width:'100%', maxWidth:880, margin:'0 auto', borderRadius:10, overflow:'hidden',
      border:'6px solid #8a7050', boxShadow:'0 0 0 3px #5a4030, 0 14px 40px rgba(0,0,0,0.4)', background:'#000' }}>
      <canvas ref={canvasRef} width={VIEW_W} height={VIEW_H}
        style={{ display:'block', width:'100%', height:'auto', imageRendering:'pixelated' }} />
    </div>
  );
}
