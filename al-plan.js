/* Expanded living space: the developer's plan redraws itself into the revised plan, with no buttons.
   Owner, Nov 18 (latest): "do it exactly like the other project. areas labeled, but not detailed".
   So this is drawn the same way as the Kaduri plan: warm paper, solid charcoal walls, windows as two
   thin lines, the balcony as a light grid and room names in spaced capitals. No fixtures, furniture or
   door swings. Three steps: 1/3 the developer's plan; 2/3 the old walls are rubbed away and the new
   walls drawn in orange, one by one; 3/3 the revised plan, with its room names. Plays in view and loops.
   Walls are rectangles typed by hand in plan px (the 2000 × 1500 drawings, developer's-plan coordinates).
   With reduced motion the revised plan is drawn once and stays. */
(function () {
  const box = document.querySelector('.al-anim');
  if (!box) return;
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const W = 2000, H = 1500;
  const PAPER = '#f7f4ed', WALL = '#2e2b27', INK = '#d2662b';   // new walls in a bold orange (owner, Nov 19; was olive)
  // walls [x, y, w, h]: in both plans, only in the developer's plan, only in the revised plan
  const KEEP = [
    [674, 70, 464, 24], [674, 94, 22, 266], [1104, 82, 48, 30], [1102, 228, 26, 234], [1138, 230, 14, 136],
    [1126, 344, 10, 118], [1116, 462, 20, 130], [1560, 236, 428, 30], [1560, 266, 36, 100], [1952, 266, 36, 218],
    [1490, 330, 70, 36], [1154, 330, 10, 36], [1234, 330, 102, 36], [456, 332, 218, 20], [456, 352, 20, 18],
    [454, 496, 24, 114], [38, 584, 416, 24], [38, 608, 26, 528],
    [674, 360, 22, 100], [674, 436, 326, 24],             // bedroom's west wall runs straight down into its south wall (owner: the offset piece looked sloppy)
    [952, 460, 18, 166], [1136, 578, 12, 14], [1230, 578, 170, 14], [1480, 580, 118, 12], [1586, 366, 12, 226],
    [1586, 592, 12, 24], [904, 720, 302, 20],
    [1300, 720, 64, 20],                                   // owner: only this short piece is thick; the rest was a thin line and a door
    [1314, 740, 8, 396], [1952, 626, 36, 326], [1952, 1022, 36, 150],
    [38, 1134, 56, 38], [234, 1134, 50, 38], [424, 1134, 120, 38], [850, 1134, 202, 38], [1194, 1134, 296, 38],
    [1632, 1134, 356, 38]
  ];
  const OLD = [
    [906, 740, 8, 394],                                    // the bedroom between the living area and the bedrooms
    [1254, 368, 10, 222],                                  // guest toilet / main bathroom
    [1364, 722, 116, 10], [1574, 722, 376, 10],            // the hall's thin wall, either side of the old suite door
    [1586, 696, 12, 26],                                   // old door jamb (owner: remove)
    [1726, 924, 226, 8]                                    // the en-suite's north wall: it opens up to the primary bedroom (owner: remove)
  ];
  // the en-suite stays where it was (owner: show that only its access changed): its west wall is kept,
  // the old door from the lower bedroom is closed, and it now opens to the primary bedroom
  KEEP.push([1716, 918, 10, 26], [1716, 1030, 10, 104]);
  const NEW = [
    [1314, 366, 10, 226],                                  // laundry room / main bathroom
    [1506, 592, 14, 40],                                   // owner: a jamb below the bathroom wall
    [1478, 728, 34, 10],                                   // owner: a jamb at the closets' corner
    [1364, 722, 32, 18],                                   // owner: a short wall so the bedroom closet can run the length of its west wall
    [1504, 728, 8, 98], [1504, 818, 212, 8],               // built-in closets
    [1716, 944, 10, 86],                                   // the en-suite's old door, closed
    [1716, 740, 46, 12], [1870, 740, 82, 12], [1716, 752, 10, 166]   // the passage from the primary bedroom to the en-suite
  ];
  // windows and the balcony doors: two thin lines across a gap in the outer walls
  const WINDOWS = [
    [1104, 112, 48, 116], [1164, 330, 70, 36], [1336, 330, 154, 36], [1952, 484, 36, 142], [1952, 952, 36, 70],
    [94, 1134, 140, 38], [284, 1134, 140, 38], [544, 1134, 306, 38], [1052, 1134, 142, 38], [1490, 1134, 142, 38]
  ];
  const BALCONY = [454, 1172, 786, 294];
  const T = { wallOut: [2.6, 4.8], wallIn: [5.2, 7.6], back: [13.6, 14.6], end: 15.2 };
  // room names: [name, x, y, appears (s), goes (s), size px]; the small rooms get smaller letters
  const LABELS = [
    ['Bedroom', 900, 250], ['Entry', 580, 545], ['Kitchen', 255, 880], ['Living', 600, 940], ['Bath', 1430, 470],
    ['Hall', 1400, 655], ['Balcony', 847, 1320],
    ['Guest\nWC', 1192, 470, null, T.wallOut[0], 28], ['Bedroom', 1110, 930, null, T.wallOut[0]], ['En-suite', 1838, 1040, null, null, 28],
    ['Bedroom', 1770, 560, null, T.wallOut[0]], ['Primary\nbedroom', 1525, 1000, null, T.wallOut[0]],
    // revised plan (owner): the primary bedroom is the top right one
    ['Laundry', 1225, 470, T.wallIn[1] - .4, null, 28], ['Dining', 1010, 930, T.wallIn[1] - .4],
    ['Primary\nbedroom', 1770, 560, T.wallIn[1] - .4], ['Bedroom', 1525, 1000, T.wallIn[1] - .4]
  ];
  const STEPS = [
    [0, '1/3', 'Developer’s plan', 'A bedroom sits between the living area and the bedrooms.'],
    [T.wallOut[0], '2/3', 'Demolition and new walls', 'The old walls come down; the new walls go up in orange.'],
    [T.wallIn[1], '3/3', 'Revised plan', 'A larger living area, a laundry room, built-in closets and a larger en-suite.'],
    [T.back[0], '1/3', 'Developer’s plan', 'A bedroom sits between the living area and the bedrooms.']
  ];
  const clamp01 = v => Math.min(1, Math.max(0, v));
  const ease = t => t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  const slot = (span, n, k, f = .8) => { const s = (span[1] - span[0]) / n; return [span[0] + s * k, span[0] + s * k + s * f]; };
  const along = (r, a, fromEnd) => {                      // the part of a wall from one end, a = 0..1
    const [x, y, w, h] = r;
    if (w >= h) return fromEnd ? [x + w * (1 - a), y, w * a, h] : [x, y, w * a, h];
    return fromEnd ? [x, y + h * (1 - a), w, h * a] : [x, y, w, h * a];
  };

  // what never changes: paper, balcony grid, kept walls, windows
  function paper() {
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d');
    g.fillStyle = PAPER; g.fillRect(0, 0, W, H);
    const [bx, by, bw, bh] = BALCONY;
    g.strokeStyle = 'rgba(46,43,39,.16)'; g.lineWidth = 2;
    g.beginPath();
    for (let x = bx; x <= bx + bw; x += 66) { g.moveTo(x, by); g.lineTo(x, by + bh); }
    for (let y = by; y <= by + bh; y += 66) { g.moveTo(bx, y); g.lineTo(bx + bw, y); }
    g.moveTo(bx + bw, by); g.lineTo(bx + bw, by + bh); g.lineTo(bx, by + bh);
    g.stroke();
    g.fillStyle = WALL; for (const r of KEEP) g.fillRect(...r);
    g.strokeStyle = WALL; g.lineWidth = 2.5;
    g.beginPath();
    for (const [x, y, w, h] of WINDOWS) for (const f of [.3, .7]) {
      if (w >= h) { g.moveTo(x, y + h * f); g.lineTo(x + w, y + h * f); } else { g.moveTo(x + w * f, y); g.lineTo(x + w * f, y + h); }
    }
    g.stroke();
    return c;
  }

  // the drawing at time t, painted into any 2D context (the 3D model uses it for its floor)
  function labels(g, t) {
      g.save(); g.textAlign = 'center'; g.textBaseline = 'middle';
      for (const [name, x, y, from, to, size = 37] of LABELS) {
        g.font = '600 ' + size + 'px "Hanken Grotesk", Helvetica, Arial, sans-serif';
        try { g.letterSpacing = Math.round(size / 6) + 'px'; } catch (e) {}
        let a = 1;
        if (from != null) a *= clamp01((t - from) / .6);
        if (to != null) a *= 1 - clamp01((t - to) / .8);
        if (a <= 0) continue;
        g.globalAlpha = a * .62; g.fillStyle = 'rgb(70,64,56)';
        name.toUpperCase().split('\n').forEach((line, k, all) => g.fillText(line, x, y + (k - (all.length - 1) / 2) * size * 1.25));
      }
      g.restore();
  }
  function paint(g, base, t) {
      g.drawImage(base, 0, 0);
      OLD.forEach((r, k) => {                              // old walls: wiped away from one end
        const [a0, a1] = slot(T.wallOut, OLD.length, k), left = 1 - clamp01((t - a0) / (a1 - a0));
        if (left > 0) { g.fillStyle = WALL; g.fillRect(...along(r, left, true)); }
      });
      NEW.forEach((r, k) => {                              // new walls: drawn from one end
        const [a0, a1] = slot(T.wallIn, NEW.length, k), got = clamp01((t - a0) / (a1 - a0));
        if (got > 0) { g.fillStyle = INK; g.fillRect(...along(r, got, false)); }
      });
      labels(g, t);
  }

  function start() {
    const view = box.querySelector('.jh-view'), stepEl = box.querySelector('.k3d-tag-step'), noteEl = box.querySelector('.jh-tag-note');
    const base = paper();
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H; view.append(cv);
    const g = cv.getContext('2d');
    box.classList.add('jh-live');
    const draw = t => paint(g, base, t);
    const setStep = s => { const [, num, name, note] = STEPS[s]; stepEl.innerHTML = '<b>' + num + '</b> ' + name; noteEl.textContent = note; };
    if (still) { draw(T.back[0] - .01); setStep(2); return; }
    const snap = t => { draw(t); const c = document.createElement('canvas'); c.width = W; c.height = H; c.getContext('2d').drawImage(cv, 0, 0); return c; };
    const first = snap(0), last = snap(T.back[0] - .01);
    let step = -1, shown = -1;
    function frame(t) {
      const busy = t > T.wallOut[0] - .1 && t < T.wallIn[1] + .9;
      if (t >= T.back[0]) {
        g.drawImage(last, 0, 0);
        g.globalAlpha = ease(clamp01((t - T.back[0]) / (T.back[1] - T.back[0]))); g.drawImage(first, 0, 0); g.globalAlpha = 1;
        shown = -1;
      } else if (busy || shown !== (t < T.wallOut[0] ? 0 : 1)) {
        draw(t); shown = busy ? -1 : (t < T.wallOut[0] ? 0 : 1);
      }
      let s = 0; for (let i = 0; i < STEPS.length; i++) if (t >= STEPS[i][0]) s = i;
      if (s !== step) { step = s; setStep(s); }
    }
    let time = 0, lastNow = 0, playing = false, raf = 0;
    const tick = now => {
      const dt = Math.min(.1, (now - lastNow) / 1000); lastNow = now;
      time += dt; if (time > T.end) { time = 0; shown = -1; }
      frame(time);
      raf = playing ? requestAnimationFrame(tick) : 0;
    };
    new IntersectionObserver(es => {
      const on = es[0].isIntersecting;
      if (on && !playing) { playing = true; lastNow = performance.now(); if (!raf) raf = requestAnimationFrame(tick); }
      if (!on) playing = false;
    }, { threshold: .2 }).observe(view);
    frame(0);
    window.__al = { jump: t => { time = t; shown = -1; frame(t); }, T };
  }
  window.AL_PLAN = { W, H, KEEP, OLD, NEW, WINDOWS, BALCONY, T, STEPS, paper, paint };
  // with WebGL (and motion allowed) the 3D model (al3d.js) plays this drawing and then builds on it
  const gl = (() => { try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch (e) { return false; } })();
  if (!still && gl && box.hasAttribute('data-three')) return;
  const go = () => (document.fonts ? document.fonts.ready : Promise.resolve()).then(start).catch(err => console.error(err));
  const io = new IntersectionObserver(es => {
    if (es.some(e => e.isIntersecting)) { io.disconnect(); go(); }
  }, { rootMargin: '200px' });
  io.observe(box);
})();
