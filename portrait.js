/* Halftone portrait.
   The photo is redrawn as a grid of small squares that dissolves at the edges.
   Hovering reveals the real photo in a soft circle that follows the cursor;
   clicking (or tapping) develops the whole photo for a moment.
   Dot colours come from CSS: --dot-ink ("r, g, b"), --dot-mix and
   --dot-invert (1 on dark backgrounds, so light areas get the big dots). */
(() => {
  const root = document.querySelector('.portrait');
  if (!root) return;
  const photo = root.querySelector('.portrait-photo');
  const dotsCanvas = root.querySelector('.portrait-dots');
  const revealCanvas = root.querySelector('.portrait-reveal');
  const dctx = dotsCanvas.getContext('2d');
  const rctx = revealCanvas.getContext('2d');
  const vignette = document.createElement('canvas');
  const vctx = vignette.getContext('2d');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const CELL = 5;               // grid spacing in CSS px
  const CENTER_Y = 0.46;         // vignette centre (fraction of height)
  const SPOT_RADIUS = 0.24;      // spotlight radius as a fraction of width
  const LOAD_MS = 1100;          // dots fade in on load over this long
  const DEVELOP = { grow: 650, hold: 1500, fade: 900 };
  const EASE = 0.2;

  const size = { w: 0, h: 0 };
  let cells = [];
  let bornAt = 0;
  let develop = null;            // { x, y, t } while a click-develop runs
  let raf = null;
  const spot = { x: 0, y: 0, r: 0, tx: 0, ty: 0, tr: 0 };

  const theme = readTheme();

  /** Dot colouring for the current theme, read from CSS custom properties. */
  function readTheme() {
    const css = getComputedStyle(root);
    const ink = css.getPropertyValue('--dot-ink').split(',').map(Number);
    return {
      ink: ink.length === 3 && ink.every(Number.isFinite) ? ink : [52, 58, 82],
      mix: parseFloat(css.getPropertyValue('--dot-mix')) || 0.42,
      invert: css.getPropertyValue('--dot-invert').trim() === '1',
    };
  }
  const clamp01 = v => Math.min(Math.max(v, 0), 1);
  const smooth = (a, b, v) => { const t = clamp01((v - a) / (b - a)); return t * t * (3 - 2 * t); };
  const easeOut = t => 1 - (1 - t) ** 3;
  /** Stable pseudo-random value in [0, 1) for a grid cell. */
  const hash = (i, j) => { const s = Math.sin(i * 127.1 + j * 311.7) * 43758.5453; return s - Math.floor(s); };

  /* ── Sampling the photo into cells ─────────────────────────── */

  /** Draws the photo into a context like `object-fit: cover`. */
  function drawCover(c, w, h) {
    const s = Math.max(w / photo.naturalWidth, h / photo.naturalHeight);
    const dw = photo.naturalWidth * s, dh = photo.naturalHeight * s;
    c.drawImage(photo, (w - dw) / 2, (h - dh) / 2, dw, dh);
  }

  function sample() {
    const cols = Math.floor(size.w / CELL), rows = Math.floor(size.h / CELL);
    const off = document.createElement('canvas');
    off.width = cols; off.height = rows;
    const octx = off.getContext('2d', { willReadFrequently: true });
    drawCover(octx, cols, rows);
    const px = octx.getImageData(0, 0, cols, rows).data;
    const next = [];
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        const cell = makeCell(px, i, j, cols, rows);
        if (cell) next.push(cell);
      }
    }
    return next;
  }

  function makeCell(px, i, j, cols, rows) {
    const k = (j * cols + i) * 4;
    const rgb = [px[k], px[k + 1], px[k + 2]];
    const nx = (i + 0.5) / cols * 2 - 1;
    const ny = ((j + 0.5) / rows - CENTER_Y) * 2;
    const fade = 1 - smooth(0.55, 1.0, Math.hypot(nx, ny * 0.95));
    if (hash(i, j) > fade * 1.15) return null;  // ragged, dissolving edge
    const light = (0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]) / 255;
    const weight = theme.invert ? light : 1 - light;
    const ink = clamp01((weight - 0.12) / 0.62) ** 0.8;
    const [r, g, b] = rgb.map((c, n) => Math.round(c * (1 - theme.mix) + theme.ink[n] * theme.mix));
    return {
      x: i * CELL + CELL / 2,
      y: j * CELL + CELL / 2,
      size: Math.max(0.9, ink * CELL * 0.92),
      color: `rgb(${r},${g},${b})`,
      alpha: (0.35 + ink * 0.65) * fade,
      delay: hash(j + 7, i + 3) * LOAD_MS * 0.6,
    };
  }

  /* ── Canvas setup ──────────────────────────────────────────── */

  function fit(canvas, ctx) {
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(size.w * dpr);
    canvas.height = Math.round(size.h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  /** Soft oval that keeps the revealed photo inside the same shape as the dots. */
  function paintVignette() {
    vctx.save();
    vctx.translate(size.w / 2, size.h * CENTER_Y);
    vctx.scale(size.w / 2, size.h * 0.52);
    const g = vctx.createRadialGradient(0, 0, 0, 0, 0, 1);
    g.addColorStop(0.55, '#000');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    vctx.fillStyle = g;
    vctx.fillRect(-1, -1, 2, 2);
    vctx.restore();
  }

  function resize() {
    const w = root.clientWidth, h = root.clientHeight;
    if (w === size.w && h === size.h) return false;
    size.w = w; size.h = h;
    [[dotsCanvas, dctx], [revealCanvas, rctx], [vignette, vctx]].forEach(([c, x]) => fit(c, x));
    paintVignette();
    cells = sample();
    return true;
  }

  /* ── Drawing ───────────────────────────────────────────────── */

  /** A soft-edged disc, used for every kind of reveal. */
  function blob(ctx, x, y, r, a) {
    if (r < 0.5 || a <= 0) return;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(0,0,0,${a})`);
    g.addColorStop(0.42, `rgba(0,0,0,${a})`);
    g.addColorStop(0.72, `rgba(0,0,0,${a * 0.45})`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  /** Paints the dots; returns true while the load-in fade is still running. */
  function paintDots(now) {
    dctx.clearRect(0, 0, size.w, size.h);
    const age = reduceMotion ? Infinity : now - bornAt;
    let loading = false;
    for (const c of cells) {
      const t = clamp01((age - c.delay) / (LOAD_MS * 0.4));
      if (t < 1) loading = true;
      if (t <= 0) continue;
      const s = c.size * (0.4 + 0.6 * t);
      dctx.globalAlpha = c.alpha * t;
      dctx.fillStyle = c.color;
      dctx.fillRect(c.x - s / 2, c.y - s / 2, s, s);
    }
    dctx.globalAlpha = 1;
    return loading;
  }

  /** Radius and opacity of the click-develop circle at `now`, or null when done. */
  function developState(now) {
    if (!develop) return null;
    const t = now - develop.t;
    const total = DEVELOP.grow + DEVELOP.hold + DEVELOP.fade;
    if (t >= total) { develop = null; return null; }
    const full = Math.hypot(size.w, size.h) * 1.4;
    const r = reduceMotion ? full : full * easeOut(clamp01(t / DEVELOP.grow));
    const a = 1 - clamp01((t - DEVELOP.grow - DEVELOP.hold) / DEVELOP.fade);
    return { r, a };
  }

  /** Builds the visible photo layer: reveal shapes, filled with the photo, cut to the oval. */
  function paintReveal(dev) {
    rctx.globalCompositeOperation = 'source-over';
    rctx.clearRect(0, 0, size.w, size.h);
    blob(rctx, spot.x, spot.y, spot.r, 1);
    if (dev) blob(rctx, develop.x, develop.y, dev.r, dev.a);
    rctx.globalCompositeOperation = 'source-in';
    drawCover(rctx, size.w, size.h);
    rctx.globalCompositeOperation = 'destination-in';
    rctx.drawImage(vignette, 0, 0, size.w, size.h);
    rctx.globalCompositeOperation = 'source-over';
  }

  /** Eases the spotlight toward the pointer; returns true while it is still moving. */
  function moveSpot() {
    const k = reduceMotion ? 1 : EASE;
    spot.x += (spot.tx - spot.x) * k;
    spot.y += (spot.ty - spot.y) * k;
    spot.r += (spot.tr - spot.r) * k;
    if (Math.abs(spot.tr - spot.r) < 0.3) spot.r = spot.tr;
    return Math.abs(spot.tx - spot.x) > 0.3 || Math.abs(spot.ty - spot.y) > 0.3 || spot.r !== spot.tr;
  }

  let loading = true;
  function frame(now) {
    const moving = moveSpot();
    if (loading) loading = paintDots(now);
    const dev = developState(now);
    paintReveal(dev);
    raf = loading || moving || dev ? requestAnimationFrame(frame) : null;
  }

  function kick() { if (!raf) raf = requestAnimationFrame(frame); }

  /* ── Input ─────────────────────────────────────────────────── */

  function point(e) {
    const box = root.getBoundingClientRect();
    return [e.clientX - box.left, e.clientY - box.top];
  }

  function aim(e, jump) {
    [spot.tx, spot.ty] = point(e);
    if (jump) { spot.x = spot.tx; spot.y = spot.ty; }
    kick();
  }

  function onEnter(e) {
    if (e.pointerType !== 'mouse') return;
    aim(e, spot.r < 1);
    spot.tr = size.w * SPOT_RADIUS;
  }

  function onDown(e) {
    const [x, y] = point(e);
    develop = { x, y, t: performance.now() };
    kick();
  }

  function start() {
    resize();
    bornAt = performance.now();
    kick();
    root.addEventListener('pointerenter', onEnter);
    root.addEventListener('pointermove', e => { if (e.pointerType === 'mouse') aim(e, false); });
    root.addEventListener('pointerleave', () => { spot.tr = 0; kick(); });
    root.addEventListener('pointerdown', onDown);
    new ResizeObserver(() => { if (resize()) { paintDots(Infinity); kick(); } }).observe(root);
  }

  if (photo.complete && photo.naturalWidth) start();
  else photo.addEventListener('load', start, { once: true });
})();
