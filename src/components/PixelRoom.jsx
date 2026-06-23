/* =====================================================================
   PixelRoom.jsx — Render pixel-art estilo lab de investigación.
   ---------------------------------------------------------------------
   Dibuja el croquis real (880×500) en un <canvas> con cámara que sigue
   al jugador. Estética: piso de baldosa crema, escritorios de madera,
   sillas azules, módulos detallados (rack, cajas, brazo, archiveros).
   Nombres de personas en un pase final (encima de todo).
   ===================================================================== */

import { useRef, useEffect } from 'react';
import { STAGE_W, STAGE_H, SEAT } from '../lib/lab-layout.js';
import { drawAvatar } from '../lib/avatarSprite.js';

const TILE = 20;
const VIEW_W = 420, VIEW_H = 264;

export default function PixelRoom({
  mesas, seatPeople, pos, dir, moving, sitting, phase,
  playerSprite, decoItems, miMesa, nearModule, doorRect, playerName,
}) {
  const canvasRef = useRef(null);
  const stateRef = useRef({});
  stateRef.current = { mesas, seatPeople, pos, dir, moving, sitting, phase, playerSprite, decoItems, miMesa, nearModule, doorRect, playerName };

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

    // ---- chair (silla de oficina azul) ----
    function drawChair(cx, cy) {
      const x = Math.round(cx - SEAT/2), y = Math.round(cy - SEAT/2);
      ctx.fillStyle = '#1e3a6e'; ctx.fillRect(x+3, y-2, SEAT-6, 4);      // respaldo
      ctx.fillStyle = '#2a5298'; ctx.fillRect(x+1, y+2, SEAT-2, SEAT-4); // asiento
      ctx.fillStyle = '#1e3a6e'; ctx.fillRect(x+1, y+SEAT-4, SEAT-2, 3); // base
      ctx.fillStyle = '#4a7adf'; ctx.fillRect(x+3, y+3, SEAT-6, 3);       // brillo asiento
    }

    // ---- escritorio (mesa normal) ----
    function drawDesk(m) {
      const wood = (m.color && m.color !== '#ffffff') ? m.color : '#c89a5a';
      const wsh = shade(wood, -0.25), whi = shade(wood, 0.15);
      const dr = (rx, ry, rw, rh) => {
        ctx.fillStyle = wsh; ctx.fillRect(rx, ry+rh-3, rw, 3);            // sombra base
        ctx.fillStyle = wood; ctx.fillRect(rx, ry, rw, rh-3);
        ctx.fillStyle = whi; ctx.fillRect(rx, ry, rw, 2);                 // borde luz
        ctx.fillStyle='rgba(60,35,10,0.12)';
        for (let gx=rx+5;gx<rx+rw-2;gx+=8) ctx.fillRect(gx,ry+3,1,rh-8); // veta
        ctx.strokeStyle='#5a3a18'; ctx.lineWidth=1.2;
        ctx.strokeRect(rx+0.5,ry+0.5,rw-1,rh-1);
      };
      if (m.forma === 'L') {
        const ah = Math.round(m.h*0.48);
        dr(m.x, m.y, m.w, ah);
        dr(m.x+Math.round(m.w*0.72), m.y, Math.round(m.w*0.28), m.h);
      } else {
        dr(m.x, m.y, m.w, m.h);
      }
      // monitor (PC)
      if (m.pc) {
        const mx = m.x+m.w-24, my = m.y+3;
        ctx.fillStyle='#1a2236'; ctx.fillRect(mx,my,20,13);
        ctx.fillStyle='#2a4a8c'; ctx.fillRect(mx+1,my+1,18,10);
        ctx.fillStyle='rgba(120,180,255,0.3)'; ctx.fillRect(mx+1,my+1,18,3);
        ctx.fillStyle='#3a4252'; ctx.fillRect(mx+7,my+13,6,3);
      }
      // nombre
      ctx.font = '7px "Silkscreen",monospace'; ctx.textAlign='center';
      ctx.fillStyle='rgba(60,35,10,0.65)';
      ctx.fillText(m.nombre, m.x+m.w/2, m.y+m.h/2+2); ctx.textAlign='left';
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
      // servidor / rack negro con LEDs
      ctx.fillStyle = '#c0291a'; ctx.fillRect(m.x-4, m.y+m.h-6, m.w+8, 8); // alfombra roja
      ctx.fillStyle = '#111827'; ctx.fillRect(m.x, m.y, m.w, m.h);
      ctx.fillStyle = '#1f2937'; ctx.fillRect(m.x+2, m.y+2, m.w-4, m.h-4);
      // bahías
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
      // brazo mecánico
      const bx=m.x+m.w/2-4, by=m.y+3;
      ctx.fillStyle='#9ca3af'; ctx.fillRect(bx,by+6,8,8);     // base
      ctx.fillStyle='#d1d5db'; ctx.fillRect(bx+2,by+2,4,8);  // brazo vertical
      ctx.fillStyle='#f3f4f6'; ctx.fillRect(bx+4,by,6,4);    // brazo horizontal
      ctx.fillStyle='#fbbf24'; ctx.fillRect(bx+8,by+1,2,2);  // pinza
      ctx.strokeStyle = near?'#FACC15':'#1f2937'; ctx.lineWidth=1;
      ctx.strokeRect(m.x+0.5,m.y+0.5,m.w-1,m.h-1);
      ctx.font='6px "Silkscreen",monospace'; ctx.fillStyle='#d1d5db'; ctx.textAlign='center';
      ctx.fillText('BRAZO', m.x+m.w/2, m.y+m.h-2); ctx.textAlign='left';
    }

    function drawInventario(m, near) {
      // archivero azul con monitor
      ctx.fillStyle='#1e3a6e'; ctx.fillRect(m.x,m.y,m.w,m.h);
      ctx.fillStyle='#2a5298'; ctx.fillRect(m.x,m.y,m.w,m.h-4);
      ctx.fillStyle='#4a7adf'; ctx.fillRect(m.x,m.y,m.w,3);
      // cajones
      for (let ry=m.y+6; ry<m.y+m.h-8; ry+=12) {
        ctx.fillStyle='#1e3a6e'; ctx.fillRect(m.x+4,ry,m.w-8,10);
        ctx.fillStyle='#c0c0c0'; ctx.fillRect(m.x+m.w/2-4,ry+4,8,2); // tirador
      }
      ctx.strokeStyle = near?'#FACC15':'#1a2e54'; ctx.lineWidth=1.2;
      ctx.strokeRect(m.x+0.5,m.y+0.5,m.w-1,m.h-1);
      ctx.font='6px "Silkscreen",monospace'; ctx.fillStyle='#fff'; ctx.textAlign='center';
      ctx.fillText('INV', m.x+m.w/2, m.y+9); ctx.textAlign='left';
    }

    function drawAlmacen(m, near) {
      // cajas de cartón apiladas
      const c1='#d4a05a', c2='#b8883a', c3='#e8bc70';
      ctx.fillStyle=c1; ctx.fillRect(m.x,m.y,m.w,m.h);
      // caja grande
      ctx.fillStyle=c2; ctx.fillRect(m.x+2,m.y+m.h*0.55,m.w-4,m.h*0.42);
      ctx.fillStyle=c3; ctx.fillRect(m.x+2,m.y+m.h*0.55,m.w-4,4);
      ctx.fillStyle='rgba(90,50,10,0.3)'; ctx.fillRect(m.x+m.w/2-1,m.y+m.h*0.55,2,m.h*0.42);
      // caja pequeña
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

    // ---- OXXO físico ----
    function drawOxxo(d, near) {
      const x=d.x-8, y=d.y-6, w=d.w+8, h=d.h+12;
      ctx.fillStyle='#9c1f15'; ctx.fillRect(x,y,w,h);
      ctx.fillStyle='#DA291C'; ctx.fillRect(x,y,w,h-4);
      for(let i=0;i<h;i+=10){ ctx.fillStyle=i%20===0?'#FFC72C':'#fff'; ctx.fillRect(x-4,y+i,5,8); }
      ctx.fillStyle='#0c1422'; ctx.fillRect(x+w/2-7,y+h/2-8,14,18);
      ctx.fillStyle='rgba(120,200,255,0.25)'; ctx.fillRect(x+w/2-5,y+h/2-6,5,14);
      ctx.strokeStyle=near?'#FACC15':'#7a160d'; ctx.lineWidth=near?2:1;
      ctx.strokeRect(x+0.5,y+0.5,w-1,h-1);
      ctx.save(); ctx.translate(x+w/2,y+16);
      ctx.font='8px "Press Start 2P",monospace'; ctx.fillStyle='#fff'; ctx.textAlign='center';
      ctx.fillText('OXXO',0,0); ctx.restore(); ctx.textAlign='left';
    }

    // ---- prompt (E para entrar) ----
    function drawPrompt(wx, wy, text) {
      ctx.font='bold 8px "Silkscreen",monospace'; ctx.textAlign='center';
      const w=ctx.measureText(text).width+12;
      ctx.fillStyle='rgba(15,23,42,0.88)'; ctx.fillRect(wx-w/2,wy-11,w,13);
      ctx.fillStyle='#FACC15'; ctx.fillText(text, wx, wy-1.5); ctx.textAlign='left';
    }

    function draw() {
      const s = stateRef.current;
      const p = s.pos || { x: STAGE_W/2, y: STAGE_H/2 };
      cam.x = clamp(p.x-VIEW_W/2, 0, STAGE_W-VIEW_W);
      cam.y = clamp(p.y-VIEW_H/2, 0, STAGE_H-VIEW_H);
      ctx.setTransform(1,0,0,1,0,0);
      ctx.clearRect(0,0,VIEW_W,VIEW_H);
      ctx.translate(-Math.round(cam.x),-Math.round(cam.y));

      // ---- piso baldosa crema (estilo lab real) ----
      const x0=Math.floor(cam.x/TILE)-1, y0=Math.floor(cam.y/TILE)-1;
      for(let ty=y0;ty<y0+VIEW_H/TILE+3;ty++) {
        for(let tx=x0;tx<x0+VIEW_W/TILE+3;tx++) {
          const px=tx*TILE, py=ty*TILE;
          const out=px<0||py<0||px>=STAGE_W||py>=STAGE_H;
          if(out){
            ctx.fillStyle='#c8b898'; ctx.fillRect(px,py,TILE,TILE);
            ctx.fillStyle='#b8a888'; ctx.fillRect(px,py,TILE,2);
            continue;
          }
          ctx.fillStyle=(tx+ty)%2===0?'#ede0c4':'#e4d7b8';
          ctx.fillRect(px,py,TILE,TILE);
          ctx.fillStyle='rgba(120,90,40,0.12)';
          ctx.fillRect(px,py,TILE,1); ctx.fillRect(px,py,1,TILE);
          // mínimo brillo en esquina
          ctx.fillStyle='rgba(255,255,255,0.08)';
          ctx.fillRect(px+1,py+1,TILE-2,1);
        }
      }
      // zócalo / borde de paredes (crema con acento)
      ctx.strokeStyle='#a0906a'; ctx.lineWidth=6;
      ctx.strokeRect(3,3,STAGE_W-6,STAGE_H-6);
      ctx.strokeStyle='#c8b890'; ctx.lineWidth=2;
      ctx.strokeRect(8,8,STAGE_W-16,STAGE_H-16);

      // ---- OXXO físico ----
      if(s.doorRect) drawOxxo(s.doorRect, false);

      // ---- y-sort: muebles + sillas + sprites ----
      const draws = [];
      const labels = []; // acumulamos nombres para dibujarlos AL FINAL, encima de todo

      (s.mesas||[]).forEach(m => {
        if(m.kind==='mesa') draws.push({y:m.y+m.h, fn:()=>drawDesk(m)});
        else draws.push({y:m.y+m.h, fn:()=>drawModule(m, s.nearModule&&s.nearModule.id===m.id)});
      });

      // deco en mi mesa
      if(s.decoItems&&s.decoItems.length&&s.miMesa) {
        const mm=s.miMesa;
        draws.push({y:mm.y, fn:()=>{
          ctx.font='11px serif'; ctx.textAlign='center';
          const total=s.decoItems.length, gap=13;
          s.decoItems.forEach((d,i)=>ctx.fillText(d.emoji, mm.x+mm.w/2+(i-(total-1)/2)*gap, mm.y-4));
          ctx.textAlign='left';
        }});
      }

      // sillas + personas sentadas
      (s.seatPeople||[]).forEach(seat => {
        draws.push({y:seat.y, fn:()=>{
          drawChair(seat.x, seat.y);
          if(seat.info) {
            drawAvatar(ctx, seat.x, seat.y+2, {
              ...(seat.info.sprite||{}), dir:'up', sitting:true, sleeping:!seat.info.presente
            }, 1);
            // acumular etiqueta para pase final
            labels.push({ cx:seat.x, fy:seat.y+2, name:seat.info.nombre, you:false, present:seat.info.presente, dot:true });
          }
        }});
      });

      // jugador
      const p2=s.pos||{x:STAGE_W/2,y:STAGE_H/2};
      draws.push({y:p2.y, fn:()=>{
        drawAvatar(ctx, p2.x, p2.y+4, {
          ...(s.playerSprite||{}), dir:s.dir, sitting:s.sitting, frame:s.moving?s.phase:0
        }, 1.05);
        labels.push({ cx:p2.x, fy:p2.y+4, name:s.playerName, you:true });
      }});

      draws.sort((a,b)=>a.y-b.y).forEach(d=>d.fn());

      // ---- PASE FINAL: nombres encima de todo ----
      labels.forEach(l => {
        if(!l.name) return;
        const top = l.fy - 28;
        // sombra
        ctx.font = 'bold 8px "Silkscreen",monospace'; ctx.textAlign='center';
        ctx.fillStyle='rgba(0,0,0,0.7)';
        ctx.fillText(l.name, l.cx+1, top+1);
        // texto
        ctx.fillStyle = l.you ? '#FACC15' : '#ffffff';
        ctx.fillText(l.name, l.cx, top);
        // punto de presencia
        if(l.dot) {
          ctx.fillStyle = l.present?'#22C55E':'#94A3B8';
          ctx.strokeStyle='#000'; ctx.lineWidth=1;
          ctx.beginPath(); ctx.arc(l.cx+ctx.measureText(l.name).width/2+5, top-2, 2.5, 0, Math.PI*2);
          ctx.fill(); ctx.stroke();
        }
        ctx.textAlign='left';
      });

      // prompt módulo
      if(s.nearModule) drawPrompt(s.nearModule.x+s.nearModule.w/2, s.nearModule.y-4, '→ Entrar · E');

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
