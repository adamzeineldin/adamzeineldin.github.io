/* Interactive dot field: dots drift away from the cursor and ripple on click.
   The click ripple also knocks the letters of the name (h1) as it passes them.
   On touch devices (no mouse) the dots are drawn but stay still. */
(() => {
  const SPACING = 13;
  const RADIUS = 160;
  const PUSH = 36;
  const DOT_SIZE = 0.8;
  const canvas = document.createElement('canvas');
  canvas.id = 'field';
  document.body.prepend(canvas);
  const ctx = canvas.getContext('2d');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const hasMouse = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  let dots = [];
  let mouse = { x: -9999, y: -9999 };
  let ripples = [];
  let raf = null;

  const PALETTE = ['rgba(205,80,80,0.32)', 'rgba(80,100,205,0.28)'];
  const RIPPLE_MS = 1400;
  const RIPPLE_REACH = 600;
  const LETTER_PUSH = 14;
  const LETTER_BAND = 55;
  let letters = [];

  /** Wraps each letter of the name in its own span so the ripple can move it. */
  function splitName() {
    const h1 = document.querySelector('h1');
    if (!h1) return;
    const name = h1.textContent.trim();
    h1.setAttribute('aria-label', name);
    const parts = name.split(' ').map(word => {
      const w = document.createElement('span');
      w.className = 'name-word';
      w.setAttribute('aria-hidden', 'true');
      for (const ch of word) {
        const l = document.createElement('span');
        l.className = 'name-letter';
        l.textContent = ch;
        w.append(l);
      }
      return w;
    });
    h1.replaceChildren(...parts.flatMap((w, i) => (i ? [' ', w] : [w])));
    letters = [...h1.querySelectorAll('.name-letter')].map(node => ({ node, x: 0, y: 0 }));
  }

  /** Pushes each letter outward while a ripple ring passes over it. */
  function moveLetters(now) {
    let moving = false;
    for (const l of letters) {
      const r0 = l.node.getBoundingClientRect();
      const hx = r0.left + r0.width / 2 - l.x, hy = r0.top + r0.height / 2 - l.y;
      let tx = 0, ty = 0;
      for (const r of ripples) {
        const rr = ((now - r.t) / RIPPLE_MS) * RIPPLE_REACH;
        const rd = Math.hypot(hx - r.x, hy - r.y);
        const band = 1 - Math.min(Math.abs(rd - rr) / LETTER_BAND, 1);
        if (band > 0) {
          const fade = 1 - (now - r.t) / RIPPLE_MS;
          tx += ((hx - r.x) / (rd || 1)) * LETTER_PUSH * band * fade;
          ty += ((hy - r.y) / (rd || 1)) * LETTER_PUSH * band * fade;
        }
      }
      l.x += (tx - l.x) * 0.18;
      l.y += (ty - l.y) * 0.18;
      if (Math.abs(l.x) < 0.05 && Math.abs(l.y) < 0.05 && tx === 0 && ty === 0) { l.x = 0; l.y = 0; }
      else moving = true;
      l.node.style.transform = l.x || l.y ? `translate(${l.x.toFixed(2)}px, ${l.y.toFixed(2)}px)` : '';
    }
    return moving;
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
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    const now = performance.now();
    ripples = ripples.filter(r => now - r.t < RIPPLE_MS);
    let moving = ripples.length > 0;
    for (const d of dots) {
      let tx = d.hx, ty = d.hy, size = DOT_SIZE;
      const dx = d.hx - mouse.x, dy = d.hy - mouse.y;
      const dist = Math.hypot(dx, dy);
      if (dist < RADIUS) {
        const f = (1 - dist / RADIUS) ** 2;
        tx += (dx / (dist || 1)) * PUSH * f;
        ty += (dy / (dist || 1)) * PUSH * f;
        size += f * 2.4;
      }
      for (const r of ripples) {
        const rr = ((now - r.t) / RIPPLE_MS) * RIPPLE_REACH;
        const rd = Math.hypot(d.hx - r.x, d.hy - r.y);
        const band = 1 - Math.min(Math.abs(rd - rr) / 40, 1);
        if (band > 0) {
          const fade = 1 - (now - r.t) / RIPPLE_MS;
          tx += ((d.hx - r.x) / (rd || 1)) * 10 * band * fade;
          ty += ((d.hy - r.y) / (rd || 1)) * 10 * band * fade;
          size += band * fade * 1.4;
        }
      }
      d.x += (tx - d.x) * 0.18;
      d.y += (ty - d.y) * 0.18;
      if (Math.abs(tx - d.x) > 0.05 || Math.abs(ty - d.y) > 0.05) moving = true;
      ctx.fillStyle = PALETTE[d.c];
      ctx.fillRect(d.x - size / 2, d.y - size / 2, size, size);
    }
    if (letters.length && moveLetters(now)) moving = true;
    raf = moving ? requestAnimationFrame(draw) : null;
  }

  function kick() { if (!raf && !reduceMotion) raf = requestAnimationFrame(draw); }

  addEventListener('resize', build);
  if (hasMouse) {
    if (!reduceMotion) splitName();
    addEventListener('pointermove', e => { mouse = { x: e.clientX, y: e.clientY }; kick(); });
    addEventListener('pointerleave', () => { mouse = { x: -9999, y: -9999 }; kick(); });
    addEventListener('pointerdown', e => { ripples.push({ x: e.clientX, y: e.clientY, t: performance.now() }); kick(); });
  }
  build();
})();
