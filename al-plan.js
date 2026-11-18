/* Expanded living space: the developer's plan redraws itself into the revised plan, with no buttons.
   Owner, Nov 18: walls solid and clean, and the process in order:
   1. the developer's plan; 2. the bathroom fittings (and doors) that change come out;
   3. the old walls are rubbed away; 4. the new walls are drawn in olive; 5. the new fittings go in.
   Walls are the solid dark areas of the two plans, cleaned (closed, then opened, so thin lines drop
   out and small gaps fill) and drawn as one flat charcoal; everything else is the plans' own linework.
   Furniture (peach beds, sage closets) is left out. Plays in view, loops; still with reduced motion. */
(function () {
  const box = document.querySelector('.al-anim');
  if (!box || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const W = 2000, H = 1500;                     // the plans’ own size: no resampling, so lines stay crisp
  const WALL = [46, 43, 39], INK = [70, 82, 46];
  const T = { fitOut: [1.8, 3.0], wallOut: [3.4, 5.6], wallIn: [6.0, 8.2], fitIn: [8.6, 10.0], back: [14.6, 15.6], end: 16.2 };
  const STEPS = [
    [0, '1/4', 'Developer’s plan', 'A third bedroom sits between the living area and the bedrooms.'],
    [T.fitOut[0], '2/4', 'Fittings out', 'The bathroom fittings that move come out first.'],
    [T.wallOut[0], '3/4', 'Demolition and new walls', 'The old walls come down; the new walls go up in olive.'],
    [T.fitIn[0], '4/4', 'Revised plan', 'New fittings go in: a laundry room and a larger en-suite, and the living area opens up.'],
    [T.back[0], '1/4', 'Developer’s plan', 'A third bedroom sits between the living area and the bedrooms.']
  ];
  const clamp01 = v => Math.min(1, Math.max(0, v));
  const lum = (d, i) => .2126 * d[i] + .7152 * d[i + 1] + .0722 * d[i + 2];

  const io = new IntersectionObserver(es => {
    if (es.some(e => e.isIntersecting)) { io.disconnect(); start().catch(err => console.error(err)); }
  }, { rootMargin: '200px' });
  io.observe(box);

  const load = src => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
  function pixels(img, dx = 0) {
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d', { willReadFrequently: true });
    g.fillStyle = '#fff'; g.fillRect(0, 0, W, H); g.drawImage(img, dx, 0, W, H);
    return g.getImageData(0, 0, W, H).data;
  }
  // square max (grow) or min (shrink) filter of radius r, in two passes
  function morph(m, r, grow) {
    const a = new Uint8Array(W * H), b = new Uint8Array(W * H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      let v = grow ? 0 : 1;
      for (let k = -r; k <= r; k++) { const xx = x + k, s = xx < 0 || xx >= W ? 0 : m[y * W + xx]; if (grow ? s : !s) { v = grow ? 1 : 0; break; } }
      a[y * W + x] = v;
    }
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      let v = grow ? 0 : 1;
      for (let k = -r; k <= r; k++) { const yy = y + k, s = yy < 0 || yy >= H ? 0 : a[yy * W + x]; if (grow ? s : !s) { v = grow ? 1 : 0; break; } }
      b[y * W + x] = v;
    }
    return b;
  }
  const close = (m, r) => morph(morph(m, r, true), r, false);
  const open = (m, r) => morph(morph(m, r, false), r, true);
  function parts(mask, reach = 2, min = 20) {
    const seen = new Uint8Array(W * H), out = [];
    for (let p = 0; p < W * H; p++) {
      if (!mask[p] || seen[p]) continue;
      const st = [p], px = []; seen[p] = 1;
      let x0 = W, y0 = H, x1 = 0, y1 = 0;
      while (st.length) {
        const q = st.pop(); px.push(q);
        const x = q % W, y = (q / W) | 0;
        if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
        for (let dy = -reach; dy <= reach; dy++) for (let dx = -reach; dx <= reach; dx++) {
          const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
          const k = yy * W + xx; if (mask[k] && !seen[k]) { seen[k] = 1; st.push(k); }
        }
      }
      if (px.length >= min) out.push({ px, x0, y0, x1, y1 });
    }
    return out;
  }

  async function start() {
    const [imO, imR] = await Promise.all(['img/apartment-original-furnished.webp', 'img/apartment-revised-furnished.webp'].map(load));
    const o = pixels(imO), r = pixels(imR, 4);   // the revised plan sits 4 px left of the developer’s; aligned here
    // leave out the furniture: light tinted pixels (peach beds, sage closets) and their outlines
    for (const d of [o, r]) {
      const tint = new Uint8Array(W * H);
      for (let p = 0; p < W * H; p++) { const i = p * 4, mx = Math.max(d[i], d[i + 1], d[i + 2]); if (mx > 70 && (mx - Math.min(d[i], d[i + 1], d[i + 2]) > 12 || (d[i + 1] > d[i] + 6 && d[i + 1] > d[i + 2] + 4))) tint[p] = 1; }
      const m = morph(tint, 3, true);
      for (let p = 0; p < W * H; p++) if (tint[p] || (m[p] && lum(d, p * 4) >= 120)) { const i = p * 4; d[i] = d[i + 1] = d[i + 2] = 255; }   // never shave a wall
    }
    // walls on a 4 px grid (owner: "walls need to be filled in"): a cell is wall when most of it is dark;
    // one-cell bumps are shaved and one-cell notches filled, so every edge runs straight and walls are solid
    const S = 2, CW = W / S, CH = H / S;
    const cellsOf = d => {
      let c = new Uint8Array(CW * CH);
      for (let cy = 0; cy < CH; cy++) for (let cx = 0; cx < CW; cx++) {
        let n = 0; for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) if (lum(d, ((cy * S + y) * W + cx * S + x) * 4) < 120) n++;
        c[cy * CW + cx] = n >= 3 ? 1 : 0;
      }
      const at = (m, x, y) => x >= 0 && y >= 0 && x < CW && y < CH ? m[y * CW + x] : 0;
      for (let pass = 0; pass < 2; pass++) {
        const nx = new Uint8Array(c);
        for (let y = 0; y < CH; y++) for (let x = 0; x < CW; x++) {
          const nb = at(c, x - 1, y) + at(c, x + 1, y) + at(c, x, y - 1) + at(c, x, y + 1);
          if (c[y * CW + x] && nb <= 1) nx[y * CW + x] = 0;
          if (!c[y * CW + x] && nb >= 3) nx[y * CW + x] = 1;
        }
        c = nx;
      }
      // drop anything thinner than a wall (under 6 px: door leaves, frames, hatching)
      const er = new Uint8Array(CW * CH), op = new Uint8Array(CW * CH);
      for (let y = 0; y < CH; y++) for (let x = 0; x < CW; x++) { let all = 1; for (let dy = -1; dy <= 1 && all; dy++) for (let dx = -1; dx <= 1; dx++) if (!at(c, x + dx, y + dy)) { all = 0; break; } er[y * CW + x] = all; }
      for (let y = 0; y < CH; y++) for (let x = 0; x < CW; x++) if (er[y * CW + x]) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const xx = x + dx, yy = y + dy; if (xx >= 0 && yy >= 0 && xx < CW && yy < CH) op[yy * CW + xx] = 1; }
      return op;
    };
    const cO = cellsOf(o), cR = cellsOf(r);
    const cellParts = m => { const seen = new Uint8Array(CW * CH), out = []; for (let s0 = 0; s0 < CW * CH; s0++) { if (!m[s0] || seen[s0]) continue; const st = [s0], px = []; seen[s0] = 1; while (st.length) { const q = st.pop(); px.push(q); const x = q % CW, y = q / CW | 0; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= CW || yy >= CH) continue; const k = yy * CW + xx; if (m[k] && !seen[k]) { seen[k] = 1; st.push(k); } } } out.push(px); } return out; };
    // a change counts only if it is a real piece of wall, not a one-cell sliver along a kept wall
    const changedCells = (a, b) => { const m = a.map((v, k) => v && !b[k] ? 1 : 0); const keep = new Uint8Array(CW * CH); for (const px of cellParts(m)) { const xs = px.map(k => k % CW), ys = px.map(k => k / CW | 0); const w = Math.max(...xs) - Math.min(...xs) + 1, hh = Math.max(...ys) - Math.min(...ys) + 1; if (px.length >= 24 && Math.min(w, hh) >= 4) for (const k of px) keep[k] = 1; } return keep; };
    const cOld = changedCells(cO, cR), cNew = changedCells(cR, cO);
    const toPx = c => { const m = new Uint8Array(W * H); for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) m[y * W + x] = c[(y / S | 0) * CW + (x / S | 0)]; return m; };
    const wO = toPx(cO), wR = toPx(cR), oldW = toPx(cOld), newW = toPx(cNew);
    const keepW = wO.map((v, p) => v && !oldW[p] ? 1 : 0);
    const wallFinal = keepW.map((v, p) => v || newW[p] ? 1 : 0);
    // the linework (everything but walls), from each plan
    const line = (d, near) => { const L = new Uint8ClampedArray(W * H * 4).fill(255); for (let p = 0; p < W * H; p++) if (!near[p]) { const i = p * 4; L[i] = d[i]; L[i + 1] = d[i + 1]; L[i + 2] = d[i + 2]; } return L; };
    const LO = line(o, morph(wO, 2, true)), LR = line(r, morph(wallFinal.map((v, p) => v || wR[p] ? 1 : 0), 2, true));
    const paint = (L, wall, col) => { const s = new Uint8ClampedArray(L); for (let p = 0; p < W * H; p++) if (wall[p]) { const i = p * 4, c = col(p); s[i] = c[0]; s[i + 1] = c[1]; s[i + 2] = c[2]; } return s; };
    const fitOutM = new Uint8Array(W * H), fitInM = new Uint8Array(W * H);
    // a line counts as changed only if the other plan has no line within a few pixels (the two drawings are a pixel or two apart)
    const inkOf = L => { const m = new Uint8Array(W * H); for (let p = 0; p < W * H; p++) m[p] = lum(L, p * 4) < 235 ? 1 : 0; return m; };
    const iO = inkOf(LO), iR = inkOf(LR), nO = morph(iO, 4, true), nR = morph(iR, 4, true);
    for (let p = 0; p < W * H; p++) { if (iO[p] && !nR[p]) fitOutM[p] = 1; if (iR[p] && !nO[p]) fitInM[p] = 1; }
    for (const m of [fitOutM, fitInM]) for (const pt of parts(m, 3, 1)) if (pt.px.length < 40) for (const p of pt.px) m[p] = 0;
    const fo = morph(fitOutM, 2, true), fi = morph(fitInM, 2, true);       // whole fittings, soft edges included
    // the five states the drawing passes through
    const S0 = paint(LO, wO, () => WALL);
    const L1 = new Uint8ClampedArray(LO); for (let p = 0; p < W * H; p++) if (fo[p]) { const i = p * 4; L1[i] = L1[i + 1] = L1[i + 2] = 255; }
    const S1 = paint(L1, wO, () => WALL);
    const S2 = paint(L1, keepW, () => WALL);
    const S3 = paint(L1, wallFinal, p => newW[p] ? INK : WALL);
    const L4 = new Uint8ClampedArray(L1); for (let p = 0; p < W * H; p++) if (fi[p] || fo[p]) { const i = p * 4; L4[i] = LR[i]; L4[i + 1] = LR[i + 1]; L4[i + 2] = LR[i + 2]; }
    const S4 = paint(L4, wallFinal, p => newW[p] ? INK : WALL);

    // timing: each phase's changed pixels, in order
    const list = [];                                    // [pixel, start, fade, phase]
    const diffMask = (A, B) => { const m = new Uint8Array(W * H); for (let p = 0; p < W * H; p++) { const i = p * 4; if (A[i] !== B[i] || A[i + 1] !== B[i + 1] || A[i + 2] !== B[i + 2]) m[p] = 1; } return m; };
    const order = (a, b) => (a.y0 + a.x0 * .3) - (b.y0 + b.x0 * .3);
    const fade = (m, span, ph, f) => { const ps = parts(m, 5, 1).sort(order), n = Math.max(1, ps.length); ps.forEach((pt, k) => { for (const p of pt.px) list.push([p, span[0] + (span[1] - span[0] - f) * k / n, f, ph]); }); };
    fade(diffMask(S0, S1), T.fitOut, 1, .35);
    { // the eraser over the old walls, in quick back-and-forth strokes
      const m = diffMask(S1, S2), ps = parts(m, 4, 1).sort(order), path = [];
      const lineTo = (x, y) => { const [px, py] = path.length ? path[path.length - 1] : [x, y]; const n = Math.max(1, Math.ceil(Math.hypot(x - px, y - py) / 3)); for (let k = 1; k <= n; k++) path.push([px + (x - px) * k / n, py + (y - py) * k / n]); };
      for (const pt of ps) {
        const horiz = pt.x1 - pt.x0 >= pt.y1 - pt.y0, mg = 6;
        const a0 = (horiz ? pt.x0 : pt.y0) - mg, a1 = (horiz ? pt.x1 : pt.y1) + mg, b0 = (horiz ? pt.y0 : pt.x0) - mg, b1 = (horiz ? pt.y1 : pt.x1) + mg;
        const at = (a, b) => horiz ? [a, b] : [b, a];
        if (!path.length) path.push(at(a0, b0));
        lineTo(...at(a0, b0)); let side = 0;
        for (let a = a0; a <= a1 + 8; a += 8) { lineTo(...at(a + 4, side ? b0 : b1)); side ^= 1; }
      }
      const tmap = new Float32Array(W * H).fill(Infinity), RR = 12, dur = T.wallOut[1] - T.wallOut[0];
      path.forEach(([x, y], k) => {
        const t = T.wallOut[0] + dur * k / Math.max(1, path.length - 1);
        for (let dy = -RR; dy <= RR; dy++) for (let dx = -RR; dx <= RR; dx++) {
          if (dx * dx + dy * dy > RR * RR) continue;
          const xx = Math.round(x + dx), yy = Math.round(y + dy); if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
          const p = yy * W + xx; if (m[p] && t < tmap[p]) tmap[p] = t;
        }
      });
      for (let p = 0; p < W * H; p++) if (m[p]) list.push([p, Math.min(tmap[p], T.wallOut[1] - .2), .15, 2]);
    }
    { // the pen over the new walls, wall by wall, end to end
      const m = diffMask(S2, S3), ps = parts(m, 3, 1).sort(order), slot = (T.wallIn[1] - T.wallIn[0]) / Math.max(1, ps.length);
      ps.forEach((pt, k) => {
        const horiz = pt.x1 - pt.x0 >= pt.y1 - pt.y0, len = Math.max(1, horiz ? pt.x1 - pt.x0 : pt.y1 - pt.y0);
        for (const p of pt.px) { const f = ((horiz ? p % W : p / W | 0) - (horiz ? pt.x0 : pt.y0)) / len; list.push([p, T.wallIn[0] + slot * k + slot * .85 * clamp01(f), .08, 3]); }
      });
    }
    fade(diffMask(S3, S4), T.fitIn, 4, .35);
    list.sort((a, b) => a[1] - b[1]);
    const STATES = [S0, S1, S2, S3, S4];

    // the canvas
    const view = box.querySelector('.jh-view'), stepEl = box.querySelector('.k3d-tag-step'), noteEl = box.querySelector('.jh-tag-note');
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H; view.append(cv);
    const g = cv.getContext('2d'); const cur = new ImageData(new Uint8ClampedArray(S0), W, H);
    const asCanvas = s => { const c = document.createElement('canvas'); c.width = W; c.height = H; c.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(s), W, H), 0, 0); return c; };
    const first = asCanvas(S0), last = asCanvas(S4);
    box.classList.add('jh-live');
    let done = 0, lastT = -1, step = -1;
    function frame(t) {
      const d = cur.data;
      let moved = false;
      if (t < lastT) { d.set(S0); done = 0; moved = true; }
      lastT = t;
      if (t < T.back[0]) {
        let k = done, allDone = true;
        for (; k < list.length && list[k][1] <= t; k++) {
          const [p, t0, f, ph] = list[k], i = p * 4, a = clamp01((t - t0) / f), A = STATES[ph - 1], B = STATES[ph];
          for (let c = 0; c < 3; c++) d[i + c] = A[i + c] + (B[i + c] - A[i + c]) * a;
          if (a < 1) allDone = false; else if (allDone) done = k + 1;
          moved = true;
        }
        if (moved || frame.back) g.putImageData(cur, 0, 0);   // only when something changed (a full-size copy is costly)
        frame.back = false;
      } else {
        g.drawImage(last, 0, 0); frame.back = true;
        g.globalAlpha = clamp01((t - T.back[0]) / (T.back[1] - T.back[0])); g.drawImage(first, 0, 0); g.globalAlpha = 1;
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
    window.__al = { jump: t => { time = t; frame(t); }, T };
  }
})();
