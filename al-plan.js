/* Expanded living space: the developer's plan redraws itself into the revised plan, with no buttons.
   1. The developer's plan.
   2. The walls that come out are rubbed away, the furniture moves to its new places, and the new
      walls are drawn in olive, wall by wall.
   3. The revised plan holds, then the sequence starts again.
   Everything comes from the two plan drawings themselves, aligned pixel for pixel. It plays when it
   comes into view, pauses when it leaves, and shows the revised plan as a still with reduced motion. */
(function () {
  const box = document.querySelector('.al-anim');
  if (!box) return;
  const W = 1600, H = 1200;                     // drawn larger than shown, so lines stay crisp on sharp screens
  const INK = [70, 82, 46];
  const T = { erase: [1.8, 4.2], swap: [4.0, 5.2], draw: [5.2, 7.4], back: [12.6, 13.6], end: 14.2 };
  const STEPS = [
    [0, '1/3', 'Developer’s plan', 'A third bedroom sits between the living area and the bedrooms.'],
    [T.erase[0], '2/3', 'Demolition and new walls', 'That bedroom opens into the living room; the bathrooms and closets are redrawn.'],
    [T.draw[1], '3/3', 'Revised plan', 'A larger living area, a laundry room, built-in closets and a larger en-suite.'],
    [T.back[0], '1/3', 'Developer’s plan', 'A third bedroom sits between the living area and the bedrooms.']
  ];
  const clamp01 = v => Math.min(1, Math.max(0, v));
  const lum = (d, i) => .2126 * d[i] + .7152 * d[i + 1] + .0722 * d[i + 2];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce) return;                                   // the static revised plan stays

  const io = new IntersectionObserver(es => {
    if (es.some(e => e.isIntersecting)) { io.disconnect(); start().catch(err => console.error(err)); }
  }, { rootMargin: '200px' });
  io.observe(box);

  const load = src => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
  function pixels(img) {
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d', { willReadFrequently: true });
    g.fillStyle = '#fff'; g.fillRect(0, 0, W, H); g.drawImage(img, 0, 0, W, H);
    return g.getImageData(0, 0, W, H);
  }
  function parts(mask, reach = 2, min = 40) {
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
  const grow = (m, r) => {
    const o = new Uint8Array(W * H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (m[y * W + x])
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { const xx = x + dx, yy = y + dy; if (xx >= 0 && yy >= 0 && xx < W && yy < H) o[yy * W + xx] = 1; }
    return o;
  };

  async function start() {
    const [io_, ir] = await Promise.all(['img/apartment-original-furnished.webp', 'img/apartment-revised-furnished.webp'].map(load));
    const O = pixels(io_), R = pixels(ir), o = O.data, r = R.data;
    // walls only (owner, Nov 18: "take out all of the furniture"): the coloured beds and closets, with
    // their outlines (peach beds, sage closets), are cleared from both plans so only the building changes
    for (const d of [o, r]) {
      const tint = new Uint8Array(W * H);
      for (let p = 0; p < W * H; p++) { const i = p * 4; const mx = Math.max(d[i], d[i + 1], d[i + 2]); if (mx > 70 && (mx - Math.min(d[i], d[i + 1], d[i + 2]) > 12 || (d[i + 1] > d[i] + 8 && d[i + 1] > d[i + 2] + 8))) tint[p] = 1; }
      const m = grow(tint, 3);
      for (let p = 0; p < W * H; p++) if (m[p]) { const i = p * 4; d[i] = d[i + 1] = d[i + 2] = 255; }
    }
    // walls: dark, colourless pixels. Old walls are dark only in the developer's plan, new walls only in ours.
    const dark = d => { const m = new Uint8Array(W * H); for (let p = 0; p < W * H; p++) { const i = p * 4, mx = Math.max(d[i], d[i + 1], d[i + 2]), mn = Math.min(d[i], d[i + 1], d[i + 2]); m[p] = lum(d, i) < 150 && mx - mn < 40 ? 1 : 0; } return m; };
    const dO = dark(o), dR = dark(r);
    const oldW = new Uint8Array(W * H), newW = new Uint8Array(W * H);
    for (let p = 0; p < W * H; p++) { if (dO[p] && !dR[p]) oldW[p] = 1; if (dR[p] && !dO[p]) newW[p] = 1; }
    for (const m of [oldW, newW]) for (const pt of parts(m, 1, 1)) if (pt.px.length < 50) for (const p of pt.px) m[p] = 0;   // specks
    const oldNear = grow(oldW, 2), newNear = grow(newW, 2);
    const er = new Uint8Array(W * H), dr = new Uint8Array(W * H), sw = new Uint8Array(W * H);
    for (let p = 0; p < W * H; p++) {
      const i = p * 4; if (Math.abs(o[i] - r[i]) + Math.abs(o[i + 1] - r[i + 1]) + Math.abs(o[i + 2] - r[i + 2]) <= 36) continue;
      if (newNear[p]) dr[p] = 1; else if (oldNear[p]) er[p] = 1; else sw[p] = 1;
    }
    const target = new Uint8ClampedArray(r);
    for (let p = 0; p < W * H; p++) if (newW[p]) { const i = p * 4; target[i] = INK[0]; target[i + 1] = INK[1]; target[i + 2] = INK[2]; }
    const list = [];                                    // [pixel, start, fade]
    // the eraser: one hand, wall to wall, in quick back-and-forth strokes
    const order = (a, b) => (a.y0 + a.x0 * .3) - (b.y0 + b.x0 * .3);
    const erase = parts(er, 4, 20).sort(order), path = [];
    const lineTo = (x, y) => { const [px, py] = path.length ? path[path.length - 1] : [x, y]; const n = Math.max(1, Math.ceil(Math.hypot(x - px, y - py) / 3)); for (let k = 1; k <= n; k++) path.push([px + (x - px) * k / n, py + (y - py) * k / n]); };
    for (const pt of erase) {
      const horiz = pt.x1 - pt.x0 >= pt.y1 - pt.y0, m = 6;
      const a0 = (horiz ? pt.x0 : pt.y0) - m, a1 = (horiz ? pt.x1 : pt.y1) + m, b0 = (horiz ? pt.y0 : pt.x0) - m, b1 = (horiz ? pt.y1 : pt.x1) + m;
      const at = (a, b) => horiz ? [a, b] : [b, a];
      if (!path.length) path.push(at(a0, b0));
      lineTo(...at(a0, b0)); let side = 0;
      for (let a = a0; a <= a1 + 7; a += 7) { lineTo(...at(a + 3.5, side ? b0 : b1)); side ^= 1; }
    }
    const tmap = new Float32Array(W * H).fill(Infinity), RR = 9, dur = T.erase[1] - T.erase[0];
    path.forEach(([x, y], k) => {
      const t = T.erase[0] + dur * k / Math.max(1, path.length - 1);
      for (let dy = -RR; dy <= RR; dy++) for (let dx = -RR; dx <= RR; dx++) {
        if (dx * dx + dy * dy > RR * RR) continue;
        const xx = Math.round(x + dx), yy = Math.round(y + dy); if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
        const p = yy * W + xx; if (er[p] && t < tmap[p]) tmap[p] = t;
      }
    });
    for (let p = 0; p < W * H; p++) if (er[p]) list.push([p, Math.min(tmap[p], T.erase[1] - .2), .16]);
    // the furniture moves: it fades across, left to right
    for (let p = 0; p < W * H; p++) if (sw[p]) list.push([p, T.swap[0] + (T.swap[1] - T.swap[0] - .5) * (p % W) / W, .5]);
    // the pen: each new wall drawn from one end to the other
    const draws = parts(dr, 3, 20).sort(order), slot = (T.draw[1] - T.draw[0]) / Math.max(1, draws.length);
    draws.forEach((pt, k) => {
      const horiz = pt.x1 - pt.x0 >= pt.y1 - pt.y0, len = Math.max(1, horiz ? pt.x1 - pt.x0 : pt.y1 - pt.y0);
      for (const p of pt.px) { const f = ((horiz ? p % W : p / W | 0) - (horiz ? pt.x0 : pt.y0)) / len; list.push([p, T.draw[0] + slot * k + slot * .85 * clamp01(f), .1]); }
    });
    const inDraw = new Uint8Array(W * H); for (const pt of draws) for (const p of pt.px) inDraw[p] = 1;
    for (let p = 0; p < W * H; p++) if (dr[p] && !inDraw[p]) list.push([p, T.draw[1] - .3, .3]);
    list.sort((a, b) => a[1] - b[1]);

    // the canvas
    const view = box.querySelector('.jh-view'), stepEl = box.querySelector('.k3d-tag-step'), noteEl = box.querySelector('.jh-tag-note');
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H; view.append(cv);
    const g = cv.getContext('2d'); const cur = new ImageData(new Uint8ClampedArray(o), W, H);
    // the finished drawing (the revised plan, new walls in olive): the last faint differences settle into it
    const fin = document.createElement('canvas'); fin.width = W; fin.height = H; fin.getContext('2d').putImageData(new ImageData(target, W, H), 0, 0);
    const orig = document.createElement('canvas'); orig.width = W; orig.height = H; orig.getContext('2d').putImageData(O, 0, 0);
    box.classList.add('jh-live');
    let done = 0, lastT = -1, step = -1;
    function frame(t) {
      const d = cur.data;
      if (t < lastT) { d.set(o); done = 0; }
      lastT = t;
      if (t < T.back[0]) {
        let k = done, allDone = true;
        for (; k < list.length && list[k][1] <= t; k++) {
          const [p, t0, fade] = list[k], i = p * 4, a = clamp01((t - t0) / fade);
          for (let c = 0; c < 3; c++) d[i + c] = o[i + c] + (target[i + c] - o[i + c]) * a;
          if (a < 1) allDone = false; else if (allDone) done = k + 1;
        }
        g.putImageData(cur, 0, 0);
        const f = clamp01((t - T.draw[1]) / .6);
        if (f > 0) { g.globalAlpha = f; g.drawImage(fin, 0, 0); g.globalAlpha = 1; }
      } else {                                         // back to the developer's plan, as a soft cross-fade
        const a = clamp01((t - T.back[0]) / (T.back[1] - T.back[0]));
        g.drawImage(fin, 0, 0);
        g.globalAlpha = a; g.drawImage(orig, 0, 0); g.globalAlpha = 1;
      }
      let s = 0; for (let i = 0; i < STEPS.length; i++) if (t >= STEPS[i][0]) s = i;
      if (s !== step) { step = s; const [, num, name, note] = STEPS[s]; stepEl.innerHTML = (num ? '<b>' + num + '</b> ' : '') + name; noteEl.textContent = note; }
    }
    let time = 0, last = 0, playing = false, raf = 0;
    const tick = now => {
      const dt = Math.min(.1, (now - last) / 1000); last = now;
      time += dt; if (time > T.end) time = 0;
      frame(time);
      raf = playing ? requestAnimationFrame(tick) : 0;
    };
    new IntersectionObserver(es => {
      const on = es[0].isIntersecting;
      if (on && !playing) { playing = true; last = performance.now(); if (!raf) raf = requestAnimationFrame(tick); }
      if (!on) playing = false;
    }, { threshold: .2 }).observe(view);
    frame(0);
    window.__al = { jump: t => { time = t; frame(t); }, T };
  }
})();
