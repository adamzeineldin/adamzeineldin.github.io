/* Interactive dot field: dots drift away from the cursor and ripple on click. */
(() => {
  const SPACING = 13;
  const RADIUS = 160;
  const PUSH = 36;
  const canvas = document.createElement('canvas');
  canvas.id = 'field';
  document.body.prepend(canvas);
  const ctx = canvas.getContext('2d');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let dots = [];
  let mouse = { x: -9999, y: -9999 };
  let ripples = [];
  let raf = null;

  function colors() {
    const dark = document.documentElement.dataset.theme === 'dark';
    return dark
      ? ['rgba(230,120,120,0.28)', 'rgba(130,150,240,0.28)']
      : ['rgba(205,80,80,0.42)', 'rgba(80,100,205,0.38)'];
  }

  function build() {
    const dpr = window.devicePixelRatio || 1;
    canvas.width = innerWidth * dpr;
    canvas.height = innerHeight * dpr;
    canvas.style.width = innerWidth + 'px';
    canvas.style.height = innerHeight + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    dots = [];
    for (let y = SPACING / 2; y < innerHeight; y += SPACING) {
      for (let x = SPACING / 2; x < innerWidth; x += SPACING) {
        dots.push({ hx: x, hy: y, x, y, c: (x / SPACING + y / SPACING) % 2 | 0 });
      }
    }
    draw();
  }

  function draw() {
    const palette = colors();
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    const now = performance.now();
    ripples = ripples.filter(r => now - r.t < 1400);
    let moving = ripples.length > 0;
    for (const d of dots) {
      let tx = d.hx, ty = d.hy, size = 1.1;
      const dx = d.hx - mouse.x, dy = d.hy - mouse.y;
      const dist = Math.hypot(dx, dy);
      if (dist < RADIUS) {
        const f = (1 - dist / RADIUS) ** 2;
        tx += (dx / (dist || 1)) * PUSH * f;
        ty += (dy / (dist || 1)) * PUSH * f;
        size += f * 3;
      }
      for (const r of ripples) {
        const rr = ((now - r.t) / 1400) * 600;
        const rd = Math.hypot(d.hx - r.x, d.hy - r.y);
        const band = 1 - Math.min(Math.abs(rd - rr) / 40, 1);
        if (band > 0) {
          const fade = 1 - (now - r.t) / 1400;
          tx += ((d.hx - r.x) / (rd || 1)) * 10 * band * fade;
          ty += ((d.hy - r.y) / (rd || 1)) * 10 * band * fade;
          size += band * fade * 1.4;
        }
      }
      d.x += (tx - d.x) * 0.18;
      d.y += (ty - d.y) * 0.18;
      if (Math.abs(tx - d.x) > 0.05 || Math.abs(ty - d.y) > 0.05) moving = true;
      ctx.fillStyle = palette[d.c];
      ctx.fillRect(d.x - size / 2, d.y - size / 2, size, size);
    }
    raf = moving ? requestAnimationFrame(draw) : null;
  }

  function kick() { if (!raf && !reduceMotion) raf = requestAnimationFrame(draw); }

  addEventListener('resize', build);
  addEventListener('pointermove', e => { mouse = { x: e.clientX, y: e.clientY }; kick(); });
  addEventListener('pointerleave', () => { mouse = { x: -9999, y: -9999 }; kick(); });
  addEventListener('pointerdown', e => { ripples.push({ x: e.clientX, y: e.clientY, t: performance.now() }); kick(); });
  document.getElementById('themeToggle').addEventListener('click', () => setTimeout(draw, 0));
  build();
})();
