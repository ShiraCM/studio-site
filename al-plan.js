/* Expanded living space: the developer's plan redraws itself into the revised plan, with no buttons.
   Owner, Nov 18: clean, solid walls, and the process in order:
   1/4 the developer's plan; 2/4 the fittings that change come out (each area as a whole);
   3/4 the old walls are rubbed away and the new walls drawn in olive, one by one; 4/4 the new fittings go in.
   Walls are traced by hand as rectangles (plan px of the 2000 × 1500 drawings) and drawn as flat shapes,
   so every edge is straight. Everything else (windows, kitchen, fittings, doors) is the plans' own
   linework, with the furniture left out. The revised drawing sits 4 px left of the developer's; it is
   aligned here. Plays in view and loops; with reduced motion the revised plan stays as a still. */
(function () {
  const box = document.querySelector('.al-anim');
  if (!box || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const W = 2000, H = 1500;
  const WALL = '#2e2b27', INK = '#46522e';
  // walls [x, y, w, h]: kept, taken out, and new
  const KEEP = [
    [674, 70, 464, 24], [674, 94, 22, 266], [1104, 82, 48, 30], [1102, 228, 26, 234], [1138, 230, 14, 136],
    [1126, 344, 10, 118], [1116, 462, 20, 130], [1560, 236, 428, 30], [1560, 266, 36, 100], [1952, 266, 36, 218],
    [1490, 330, 70, 36], [1154, 330, 10, 36], [1234, 330, 102, 36], [456, 332, 218, 20], [456, 352, 20, 18],
    [454, 496, 24, 114], [38, 584, 416, 24], [38, 608, 26, 528], [684, 360, 24, 102], [710, 436, 290, 24],
    [952, 460, 18, 166], [1136, 578, 12, 14], [1230, 578, 170, 14], [1480, 580, 118, 12], [1586, 366, 12, 226], [904, 720, 302, 20], [1300, 720, 204, 20], [1586, 592, 12, 24], [1586, 696, 12, 26],
    [1314, 740, 8, 396], [1952, 626, 36, 326], [1952, 1022, 36, 150],
    [50, 1134, 44, 38], [234, 1134, 50, 38], [424, 1134, 120, 38], [850, 1134, 202, 38], [1194, 1134, 118, 38],
    [1322, 1134, 168, 38], [1632, 1134, 318, 38]
  ];
  const OLD = [[1254, 368, 10, 222], [906, 740, 8, 394], [1574, 722, 376, 10], [1726, 924, 226, 8], [1716, 918, 10, 26], [1716, 1030, 10, 104]];
  const NEW = [[1314, 366, 10, 226],
    [1504, 728, 8, 98], [1504, 818, 234, 8], [1740, 740, 22, 12], [1870, 740, 82, 12], [1740, 752, 10, 382]];
  // lines the owner asked to clear: the threshold across the main bathroom door, a door jamb by the third bedroom
  const CLEAR = [[1406, 582, 70, 6], [1180, 744, 14, 28], [1712, 840, 18, 76]];
  // areas whose fittings and doors change: each comes out, and later goes back in, as a whole
  const AREAS = [[1138, 368, 262, 210], [1322, 592, 630, 244], [1700, 752, 252, 382], [1140, 740, 174, 96]];
  const T = { fitOut: [1.8, 3.0], wallOut: [3.4, 5.6], wallIn: [6.0, 8.2], fitIn: [8.6, 9.8], back: [14.4, 15.4], end: 16.0 };
  const STEPS = [
    [0, '1/4', 'Developer’s plan', 'A third bedroom sits between the living area and the bedrooms.'],
    [T.fitOut[0], '2/4', 'Fittings out', 'The bathroom fittings and doors that change come out first.'],
    [T.wallOut[0], '3/4', 'Demolition and new walls', 'The old walls come down; the new walls go up in olive.'],
    [T.fitIn[0], '4/4', 'Revised plan', 'New fittings go in: a laundry room and a larger en-suite, and the living area opens up.'],
    [T.back[0], '1/4', 'Developer’s plan', 'A third bedroom sits between the living area and the bedrooms.']
  ];
  const clamp01 = v => Math.min(1, Math.max(0, v));
  const ease = t => t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

  const io = new IntersectionObserver(es => {
    if (es.some(e => e.isIntersecting)) { io.disconnect(); start().catch(err => console.error(err)); }
  }, { rootMargin: '200px' });
  io.observe(box);

  const load = src => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
  // a plan's linework: furniture and walls cleared (walls are drawn as shapes on top)
  function linework(img, dx) {
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d', { willReadFrequently: true });
    g.fillStyle = '#fff'; g.fillRect(0, 0, W, H); g.drawImage(img, dx, 0);
    g.fillStyle = '#fff'; for (const [x, y, w, h] of [...KEEP, ...NEW]) g.fillRect(x - 3, y - 3, w + 6, h + 6);
    for (const [x, y, w, h] of [...OLD, ...CLEAR]) g.fillRect(x - 8, y - 8, w + 16, h + 16);   // removed walls leave no ghost lines
    const id = g.getImageData(0, 0, W, H), d = id.data, tint = new Uint8Array(W * H);
    for (let p = 0; p < W * H; p++) {
      const i = p * 4, mx = Math.max(d[i], d[i + 1], d[i + 2]), mn = Math.min(d[i], d[i + 1], d[i + 2]);
      if (mx > 70 && (mx - mn > 12 || (d[i + 1] > d[i] + 6 && d[i + 1] > d[i + 2] + 4))) tint[p] = 1;   // peach beds, sage closets
    }
    const near = new Uint8Array(W * H);                                  // the furniture's outline: 3 px around it
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (tint[y * W + x]) for (let dy = -3; dy <= 3; dy++) for (let dx2 = -3; dx2 <= 3; dx2++) { const xx = x + dx2, yy = y + dy; if (xx >= 0 && yy >= 0 && xx < W && yy < H) near[yy * W + xx] = 1; }
    for (let p = 0; p < W * H; p++) if (near[p]) { const i = p * 4; if (tint[p] || .2126 * d[i] + .7152 * d[i + 1] + .0722 * d[i + 2] >= 120) d[i] = d[i + 1] = d[i + 2] = 255; }
    g.putImageData(id, 0, 0);
    return c;
  }

  async function start() {
    const [imO, imR] = await Promise.all(['img/apartment-original-furnished.webp', 'img/apartment-revised-furnished.webp'].map(load));
    const LO = linework(imO, 0), LR = linework(imR, 4);
    const base = document.createElement('canvas'); base.width = W; base.height = H;   // what stays: the developer's linework outside the areas
    { const b = base.getContext('2d'); b.drawImage(LO, 0, 0); b.fillStyle = '#fff'; for (const [x, y, w, h] of AREAS) b.fillRect(x, y, w, h); }
    const view = box.querySelector('.jh-view'), stepEl = box.querySelector('.k3d-tag-step'), noteEl = box.querySelector('.jh-tag-note');
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H; view.append(cv);
    const g = cv.getContext('2d');
    box.classList.add('jh-live');
    const slot = (span, n, k, f = .8) => { const s = (span[1] - span[0]) / n; return [span[0] + s * k, span[0] + s * k + s * f]; };
    const along = (r, a, fromEnd) => {                                    // the part of a wall from one end, a = 0..1
      const [x, y, w, h] = r;
      if (w >= h) return fromEnd ? [x + w * (1 - a), y, w * a, h] : [x, y, w * a, h];
      return fromEnd ? [x, y + h * (1 - a), w, h * a] : [x, y, w, h * a];
    };
    function draw(t) {
      g.fillStyle = '#fff'; g.fillRect(0, 0, W, H);
      g.drawImage(base, 0, 0);
      AREAS.forEach(([x, y, w, h], k) => {                                // fittings: out, then in, area by area
        const o = 1 - ease(clamp01((t - slot(T.fitOut, AREAS.length, k)[0]) / .5));
        const n = ease(clamp01((t - slot(T.fitIn, AREAS.length, k)[0]) / .5));
        if (o > 0) { g.globalAlpha = o; g.drawImage(LO, x, y, w, h, x, y, w, h); }
        if (n > 0) { g.globalAlpha = n; g.drawImage(LR, x, y, w, h, x, y, w, h); }
        g.globalAlpha = 1;
      });
      g.fillStyle = WALL; for (const r of KEEP) g.fillRect(...r);
      OLD.forEach((r, k) => {                                             // old walls: wiped away from one end
        const [a0, a1] = slot(T.wallOut, OLD.length, k), left = 1 - clamp01((t - a0) / (a1 - a0));
        if (left > 0) { g.fillStyle = WALL; g.fillRect(...along(r, left, true)); }
      });
      NEW.forEach((r, k) => {                                             // new walls: drawn from one end
        const [a0, a1] = slot(T.wallIn, NEW.length, k), got = clamp01((t - a0) / (a1 - a0));
        if (got > 0) { g.fillStyle = INK; g.fillRect(...along(r, got, false)); }
      });
    }
    const snap = t => { draw(t); const c = document.createElement('canvas'); c.width = W; c.height = H; c.getContext('2d').drawImage(cv, 0, 0); return c; };
    const first = snap(0), last = snap(T.back[0] - .01);
    let step = -1, held = false;
    function frame(t) {
      if (t < T.back[0]) {
        const busy = t > T.fitOut[0] - .1 && t < T.fitIn[1] + .6;
        if (busy || !held) draw(t);
        held = !busy;
      } else {
        g.drawImage(last, 0, 0);
        g.globalAlpha = ease(clamp01((t - T.back[0]) / (T.back[1] - T.back[0]))); g.drawImage(first, 0, 0); g.globalAlpha = 1;
        held = false;
      }
      let s = 0; for (let i = 0; i < STEPS.length; i++) if (t >= STEPS[i][0]) s = i;
      if (s !== step) { step = s; const [, num, name, note] = STEPS[s]; stepEl.innerHTML = (num ? '<b>' + num + '</b> ' : '') + name; noteEl.textContent = note; }
    }
    let time = 0, lastNow = 0, playing = false, raf = 0;
    const tick = now => {
      const dt = Math.min(.1, (now - lastNow) / 1000); lastNow = now;
      time += dt; if (time > T.end) time = 0;
      frame(time);
      raf = playing ? requestAnimationFrame(tick) : 0;
    };
    new IntersectionObserver(es => {
      const on = es[0].isIntersecting;
      if (on && !playing) { playing = true; lastNow = performance.now(); if (!raf) raf = requestAnimationFrame(tick); }
      if (!on) playing = false;
    }, { threshold: .2 }).observe(view);
    frame(0);
    window.__al = { jump: t => { time = t; held = false; frame(t); }, T };
  }
})();
