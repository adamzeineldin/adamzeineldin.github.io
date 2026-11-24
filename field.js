/* Static dot field: a quiet grid of tiny dots behind the page, for texture. */
(() => {
  const SPACING = 12;
  const DOT_SIZE = 1;
  // Same slate ink as the portrait's dots (--dot-ink), in two strengths.
  const PALETTE = ['rgba(52,58,82,0.2)', 'rgba(52,58,82,0.11)'];

  const canvas = document.createElement('canvas');
  canvas.id = 'field';
  canvas.setAttribute('aria-hidden', 'true');
  document.body.prepend(canvas);
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  function draw() {
    const dpr = window.devicePixelRatio || 1;
    canvas.width = innerWidth * dpr;
    canvas.height = innerHeight * dpr;
    canvas.style.width = innerWidth + 'px';
    canvas.style.height = innerHeight + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    for (let y = SPACING / 2, row = 0; y < innerHeight; y += SPACING, row++) {
      for (let x = SPACING / 2, col = 0; x < innerWidth; x += SPACING, col++) {
        ctx.fillStyle = PALETTE[(row + col) % 2];
        ctx.fillRect(x - DOT_SIZE / 2, y - DOT_SIZE / 2, DOT_SIZE, DOT_SIZE);
      }
    }
  }

  addEventListener('resize', draw);
  draw();
})();
