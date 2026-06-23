/* =====================================================================
   AvatarPixel.jsx — Avatar pixel-art detallado renderizado en <canvas>.
   ---------------------------------------------------------------------
   Usa el MISMO sprite que el juego (avatarSprite.drawAvatar), así el
   modelo es idéntico en "Mi cuenta", el personalizador y el mapa.
   Por defecto muestra al frente; con animate gira/camina en bucle para
   lucir el avatar en la vista de cuenta.
   ===================================================================== */

import { useRef, useEffect } from 'react';
import { drawAvatar } from '../lib/avatarSprite.js';

export default function AvatarPixel({ sprite, size = 5, animate = false, dir = 'down', name }) {
  const ref = useRef(null);
  const sp = useRef(sprite); sp.current = sprite;

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    let raf, t0 = performance.now();
    const dirs = ['down', 'right', 'up', 'left'];

    function frame(now) {
      const cycle = Math.floor((now - t0) / 230);
      const fr = animate ? cycle % 4 : 0;
      const di = animate ? Math.floor(cycle / 4) % 4 : dirs.indexOf(dir);
      ctx.clearRect(0, 0, cv.width, cv.height);
      drawAvatar(ctx, cv.width / 2, cv.height - size * 2, { ...sp.current, dir: dirs[di < 0 ? 0 : di], frame: fr }, size);
      if (animate) raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [animate, dir, size]);

  return (
    <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
      <canvas
        ref={ref}
        width={18 * size}
        height={29 * size}
        style={{ imageRendering: 'pixelated', display: 'block' }}
      />
      {name ? <span style={{ fontSize: 11, fontWeight: 800, color: '#334155' }}>{name}</span> : null}
    </div>
  );
}
