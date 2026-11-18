/* Jerusalem Heights: how two bedrooms became three, as one self-playing sequence (no buttons).
   1. The developer's plan.
   2. The walls that come out are rubbed away; then the new walls are drawn in
      (pixel by pixel from the demolition-and-construction plan, which is aligned with it).
   3. The drawing rises into a model: walls from the revised plan's black walls (with the beam over
      each window), beds and closets from its fill colours, the kitchen, fridge and pantry placed from
      the plan, in the colours of the styled pictures. The floor turns into the revised plan as it rises.
   4. A tour: the camera goes to each room in turn and that room's styled picture opens out of it.
   It plays when it comes into view and starts again at the end. three.js loads on demand. */
let THREE;

const W = 1250, H = 1340;                 // plan canvas, px (all three plans are drawn into this)
const U = 100;                            // plan px per world unit
const PXCM = 1.05;                        // plan px per cm (a 190 cm bed is 189 px; the 60 cm closet 65 px)
const h = cm => cm * PXCM / U;            // cm -> world height
const wx = px => (px - W / 2) / U, wz = py => (py - H / 2) / U;

const clamp01 = v => Math.min(1, Math.max(0, v));
const span = (t, a, b) => clamp01((t - a) / (b - a));
const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const easeOut = t => 1 - Math.pow(1 - t, 3);
const lerp = (a, b, t) => a + (b - a) * t;

// Rooms for the tour, plan px [x0, y0, x1, y1], in the order the camera visits them.
const ROOMS = [
  { key: 'kitchen', name: 'Kitchen', note: 'Carved out of the old laundry area and part of the entrance.', img: 'img/jh-kitchen-real.webp', pos: '26% 50%', r: [700, 440, 970, 760], zoom: .9 },
  { key: 'dining', name: 'Kitchen and dining', note: 'The kitchen faces the dining table.', img: 'img/jh-styled-dining.jpg', r: [560, 700, 920, 1100] },
  { key: 'kids', name: 'Children’s room', note: 'This room was the kitchen.', img: 'img/jh-styled-kids.jpg', r: [968, 442, 1192, 806] },
  { key: 'main', name: 'Main bedroom', note: 'Closets along the wall it shares with the kitchen.', img: 'img/jh-styled-bedroom.jpg', r: [216, 442, 529, 789] },
  { key: 'safe', name: 'Second bedroom', note: 'The safe room, set up as a bedroom.', img: 'img/jh-styled-bedroom2.jpg', r: [60, 60, 380, 402] }
];


// Timeline, seconds
const TOUR = 11.6, LEG = 7.2;             // each room: fly in, open the picture, hold, close it
const T = {
  erase: [1.8, 4.4], draw: [4.7, 6.9], rise: [7.6, 10.2], floor: [7.6, 9.4], cam: [7.4, 11.0]
};
T.back = [TOUR + ROOMS.length * LEG + .2, TOUR + ROOMS.length * LEG + 2.4];
T.end = T.back[1] + 1.6;
const leg = i => { const a = TOUR + i * LEG; return { fly: [a, a + 2.2], open: [a + 2.4, a + 3.6], close: [a + 6.2, a + 7.0] }; };
const STEPS = [
  [0, '1/3', 'Developer’s plan', 'The kitchen has its own room off the living area.'],
  [T.erase[0], '2/3', 'Demolition and new walls', 'The kitchen walls come out and new walls go in.'],
  [T.rise[0], '3/3', '3D model', 'Three bedrooms within the same outer walls, with no extension.'],
  ...ROOMS.map((rm, i) => [leg(i).fly[0] + 1.2, '', rm.name, rm.note]),
  [T.back[0], '3/3', '3D model', 'Three bedrooms within the same outer walls, with no extension.']
];

const box = document.querySelector('.jh-anim');
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
function webglOK() {
  try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch { return false; }
}
if (box && !reduce && webglOK()) {
  const io = new IntersectionObserver(es => {
    if (es.some(e => e.isIntersecting)) { io.disconnect(); start().catch(err => console.error(err)); }
  }, { rootMargin: '200px' });
  io.observe(box);
}

const load = src => new Promise((resolve, reject) => { const i = new Image(); i.onload = () => resolve(i); i.onerror = reject; i.src = src; });
function pixels(img) {
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d', { willReadFrequently: true });
  g.fillStyle = '#fff'; g.fillRect(0, 0, W, H); g.drawImage(img, 0, 0, W, H);
  return g.getImageData(0, 0, W, H);
}
const lum = (d, i) => .2126 * d[i] + .7152 * d[i + 1] + .0722 * d[i + 2];

// connected parts of a mask (with a small reach so dashes and hatching hold together)
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

// Step 2: which pixels change between the developer's plan and the construction plan, and when.
// Each pixel is sorted on its own: lighter in the construction plan = erased, darker = drawn,
// so a new wall next to a removed one is still drawn with the other new walls.
const INK = [70, 82, 46];                   // new walls are drawn in a deep olive, so they stand out from the charcoal existing walls
const PAPER = [247, 244, 237], INKLINE = [46, 43, 39];
  const BALCONY = [[185, 1025, 340, 260], [185, 820, 150, 205]];
  const PLAN_WINDOWS = [[80, 410, 90, 25], [910, 885, 20, 135], [935, 795, 135, 15], [335, 915, 25, 60]];
  function renderPlan(walls, drawn, extra = []) {
const img = new ImageData(W, H), d = img.data;
const put = (p, c) => { const i = p * 4; d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = 255; };
const grid = PAPER.map((v, k) => Math.round(v * .82 + INKLINE[k] * .18));
for (let p = 0; p < W * H; p++) put(p, PAPER);
for (const [bx, by, bw, bh] of BALCONY) for (let y = by; y < by + bh; y++) for (let x = bx; x < bx + bw; x++) if ((x - 185) % 42 === 0 || (y - 820) % 42 === 0) put(y * W + x, grid);
for (let p = 0; p < W * H; p++) if (walls[p]) put(p, INKLINE);
if (drawn) for (let p = 0; p < W * H; p++) if (drawn[p]) put(p, INK);
for (const [x0, y0, w, hh] of PLAN_WINDOWS) {
  const horiz = w >= hh;
  for (const f of [.3, .7]) {
    if (horiz) { const y = Math.round(y0 + hh * f); for (let x = x0; x < x0 + w; x++) { put(y * W + x, INKLINE); } }
    else { const x = Math.round(x0 + w * f); for (let y = y0; y < y0 + hh; y++) put(y * W + x, INKLINE); }
  }
}
for (const [x0, y0, w, hh] of extra) for (let y = y0; y < y0 + hh; y++) for (let x = x0; x < x0 + w; x++) put(y * W + x, INK);
return img;
  }
function changes(O, C, Ci) {
  const o = O.data, c = C.data, er = new Uint8Array(W * H), dr = new Uint8Array(W * H);
  const target = new Uint8ClampedArray(Ci.data);  // what each pixel becomes
  for (let p = 0; p < W * H; p++) {
    const i = p * 4;
    if (Math.abs(o[i] - c[i]) + Math.abs(o[i + 1] - c[i + 1]) + Math.abs(o[i + 2] - c[i + 2]) <= 40) continue;
    const ink = c[i] === INK[0] && c[i + 1] === INK[1] && c[i + 2] === INK[2];   // becomes a new wall: drawn, even where an old wall stood
    (lum(c, i) > lum(o, i) && !ink ? er : dr)[p] = 1;
  }
  // around each removed wall, its dashed outline and stray thin lines go too, so no broken wall is left
  for (const pt of parts(er, 4, 20)) {
    for (let y = Math.max(0, pt.y0 - 5); y <= Math.min(H - 1, pt.y1 + 5); y++) for (let x = Math.max(0, pt.x0 - 5); x <= Math.min(W - 1, pt.x1 + 5); x++) {
      const p = y * W + x; if (dr[p] || lum(c, p * 4) > 249) continue;
      // keep only solid walls (a mostly dark 7x7 block); thin outlines and dashes go
      let n = 0;
      for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
        const xx = x + dx, yy = y + dy;
        if (xx >= 0 && yy >= 0 && xx < W && yy < H && lum(c, (yy * W + xx) * 4) < 110) n++;
      }
      if (n < 34) er[p] = 1;
    }
  }
  // new walls: close the hatching into a solid band, then ink it
  const drawParts = parts(dr, 3, 30);
  for (const pt of drawParts) {
    const x0 = Math.max(0, pt.x0 - 4), y0 = Math.max(0, pt.y0 - 4), x1 = Math.min(W - 1, pt.x1 + 4), y1 = Math.min(H - 1, pt.y1 + 4);
    const bw = x1 - x0 + 1, bh = y1 - y0 + 1, m = new Uint8Array(bw * bh), dil = new Uint8Array(bw * bh);
    for (const p of pt.px) m[((p / W | 0) - y0) * bw + (p % W) - x0] = 1;
    const R = 3;
    for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) {
      let on = 0;
      for (let dy = -R; dy <= R && !on; dy++) for (let dx = -R; dx <= R; dx++) { const xx = x + dx, yy = y + dy; if (xx >= 0 && yy >= 0 && xx < bw && yy < bh && m[yy * bw + xx]) { on = 1; break; } }
      dil[y * bw + x] = on;
    }
    const px = [];
    for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) {
      let all = dil[y * bw + x];
      for (let dy = -R + 1; dy <= R - 1 && all; dy++) for (let dx = -R + 1; dx <= R - 1; dx++) { const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= bw || yy >= bh || !dil[yy * bw + xx]) { all = 0; break; } }
      if (all) { const p = (y + y0) * W + x + x0, i = p * 4; px.push(p); dr[p] = 1; er[p] = 0; target[i] = INK[0]; target[i + 1] = INK[1]; target[i + 2] = INK[2]; }
    }
    pt.px = px;
  }
  const list = [];                          // [pixel, start time, fade seconds]
  // the eraser: one hand moving from wall to wall, rubbing back and forth across each in quick strokes
  const order = (a, b) => (a.y0 + a.x0 * .3) - (b.y0 + b.x0 * .3);
  const erase = parts(er, 4, 20).sort(order);
  const path = [];                          // [x, y] points along the eraser's way, evenly spaced in time
  const step = 3;
  const lineTo = (x, y) => {
    const [px, py] = path.length ? path[path.length - 1] : [x, y];
    const n = Math.max(1, Math.ceil(Math.hypot(x - px, y - py) / step));
    for (let k = 1; k <= n; k++) path.push([px + (x - px) * k / n, py + (y - py) * k / n]);
  };
  for (const pt of erase) {
    const horiz = pt.x1 - pt.x0 >= pt.y1 - pt.y0, m = 7;
    const a0 = (horiz ? pt.x0 : pt.y0) - m, a1 = (horiz ? pt.x1 : pt.y1) + m;
    const b0 = (horiz ? pt.y0 : pt.x0) - m, b1 = (horiz ? pt.y1 : pt.x1) + m;
    const at = (a, b) => horiz ? [a, b] : [b, a];
    if (!path.length) path.push(at(a0, b0));
    lineTo(...at(a0, b0));
    let side = 0;
    for (let a = a0; a <= a1 + 8; a += 8) { lineTo(...at(a + 4, side ? b0 : b1)); side ^= 1; }
  }
  const tmap = new Float32Array(W * H).fill(Infinity), RR = 11;
  const dur = T.erase[1] - T.erase[0];
  path.forEach(([x, y], k) => {
    const t = T.erase[0] + dur * k / Math.max(1, path.length - 1);
    for (let dy = -RR; dy <= RR; dy++) for (let dx = -RR; dx <= RR; dx++) {
      if (dx * dx + dy * dy > RR * RR) continue;
      const xx = Math.round(x + dx), yy = Math.round(y + dy); if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
      const p = yy * W + xx; if (er[p] && t < tmap[p]) tmap[p] = t;
    }
  });
  const listed = new Uint8Array(W * H);
  for (const pt of erase) for (const p of pt.px) {
    const i = p * 4; if (!dr[p]) { target[i] = PAPER[0]; target[i + 1] = PAPER[1]; target[i + 2] = PAPER[2]; }
    list.push([p, Math.min(tmap[p], T.erase[1]), .16]); listed[p] = 1;
  }
  // any stray erased pixel too small to be a wall part goes at the end of the erasing
  for (let p = 0; p < W * H; p++) if (er[p] && !listed[p] && !dr[p]) { const i = p * 4; target[i] = PAPER[0]; target[i + 1] = PAPER[1]; target[i + 2] = PAPER[2]; list.push([p, T.erase[1] - .3, .3]); }
  // the pen: each new wall drawn from one end to the other, one after another
  drawParts.sort(order);
  const slot = (T.draw[1] - T.draw[0]) / Math.max(1, drawParts.length);
  drawParts.forEach((pt, k) => {
    const horiz = pt.x1 - pt.x0 >= pt.y1 - pt.y0, len = Math.max(1, horiz ? pt.x1 - pt.x0 : pt.y1 - pt.y0);
    for (const p of pt.px) {
      const f = ((horiz ? p % W : p / W | 0) - (horiz ? pt.x0 : pt.y0)) / len;
      list.push([p, T.draw[0] + slot * k + slot * .85 * clamp01(f), .1]);
    }
  });
  list.sort((a, b) => a[1] - b[1]);
  return { list, target, drawn: dr, erased: er };
}

// Step 3: the model, read from the revised plan.
function readModel(R) {
  const d = R.data;
  const S = 5, cw = Math.floor(W / S), ch = Math.floor(H / S);
  const wall = new Uint8Array(cw * ch), line = new Uint8Array(cw * ch);
  for (let cy = 0; cy < ch; cy++) for (let cx = 0; cx < cw; cx++) {
    let n = 0, m = 0;
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const l = lum(d, ((cy * S + y) * W + cx * S + x) * 4);
      if (l < 70) n++; if (l < 150) m++;
    }
    if (n >= S * S * .7) wall[cy * cw + cx] = 1; else if (m >= 3) line[cy * cw + cx] = 1;
  }
  // walls: merged into runs along each row
  const rowRuns = mask => {
    const out = [];
    for (let cy = 0; cy < ch; cy++) {
      let run = -1;
      for (let cx = 0; cx <= cw; cx++) {
        const on = cx < cw && mask[cy * cw + cx];
        if (on && run < 0) run = cx;
        if (!on && run >= 0) { out.push([run * S, cy * S, (cx - run) * S, S]); run = -1; }
      }
    }
    return out;
  };
  // windows: a gap in a wall line that the plan crosses with thin lines (the frame and glass).
  // The beam over it spans the gap and takes the thickness of the wall at its ends.
  const beam = new Uint8Array(cw * ch);
  const at = (cx, cy) => cx >= 0 && cy >= 0 && cx < cw && cy < ch ? wall[cy * cw + cx] : 0;
  const scan = (horizontal) => {
    const A = horizontal ? ch : cw, B = horizontal ? cw : ch;
    const isWall = (a, b) => horizontal ? at(b, a) : at(a, b);
    const isLine = (a, b) => horizontal ? line[a * cw + b] : line[b * cw + a];
    const mark = (a, b) => { if (horizontal) beam[a * cw + b] = 1; else beam[b * cw + a] = 1; };
    for (let a = 0; a < A; a++) {
      let b = 0;
      while (b < B) {
        if (!isWall(a, b)) { b++; continue; }
        while (b < B && isWall(a, b)) b++;
        const g0 = b; while (b < B && !isWall(a, b)) b++;
        const g1 = b;                                   // gap [g0, g1) with a wall on each side
        if (g1 >= B || g1 - g0 < 4 || g1 - g0 > 70) continue;
        let n = 0; for (let k = g0; k < g1; k++) if (isLine(a, k)) n++;
        if (n < (g1 - g0) * .85) continue;
        // thickness: the wall cells across this line at both ends
        let t0 = a, t1 = a;
        while (t0 > 0 && isWall(t0 - 1, g0 - 1) && isWall(t0 - 1, g1)) t0--;
        while (t1 < A - 1 && isWall(t1 + 1, g0 - 1) && isWall(t1 + 1, g1)) t1++;
        if (t1 - t0 > 8) continue;                      // not a wall line (a room's width)
        for (let aa = t0; aa <= t1; aa++) for (let k = g0; k < g1; k++) mark(aa, k);
      }
    }
  };
  scan(true); scan(false);
  // doorways: a gap of 60 to 120 cm between two ends of the same wall
  const doorKeys = new Set(), doors = [];
  const scanDoors = (horizontal) => {
    const A = horizontal ? ch : cw, B = horizontal ? cw : ch;
    const isWall = (a, b) => horizontal ? at(b, a) : at(a, b);
    for (let a = 0; a < A; a++) {
      let b = 0;
      while (b < B) {
        if (!isWall(a, b)) { b++; continue; }
        while (b < B && isWall(a, b)) b++;
        const g0 = b; while (b < B && !isWall(a, b)) b++;
        const g1 = b;
        if (g1 >= B || g1 - g0 < 12 || g1 - g0 > 24) continue;
        let t0 = a, t1 = a;
        while (t0 > 0 && isWall(t0 - 1, g0 - 1) && isWall(t0 - 1, g1)) t0--;
        while (t1 < A - 1 && isWall(t1 + 1, g0 - 1) && isWall(t1 + 1, g1)) t1++;
        if (t1 - t0 > 8 || t1 - t0 < 1) continue;
        const key = [horizontal, t0, g0, g1].join();
        if (doorKeys.has(key)) continue; doorKeys.add(key);
        doors.push(horizontal ? [g0 * S, t0 * S, (g1 - g0) * S, (t1 - t0 + 1) * S] : [t0 * S, g0 * S, (t1 - t0 + 1) * S, (g1 - g0) * S]);
      }
    }
  };
  scanDoors(true); scanDoors(false);
  const near = (i, r, g, b, tol) => Math.abs(d[i] - r) < tol && Math.abs(d[i + 1] - g) < tol && Math.abs(d[i + 2] - b) < tol;
  const bedM = new Uint8Array(W * H), closetM = new Uint8Array(W * H);
  for (let p = 0; p < W * H; p++) {
    const i = p * 4;
    if (near(i, 232, 210, 190, 14)) bedM[p] = 1;
    else if (d[i + 1] > d[i] && d[i + 1] - d[i + 2] >= 6 && d[i] > 190 && d[i] < 240) closetM[p] = 1;
  }
  const rect = pt => [pt.x0, pt.y0, pt.x1 - pt.x0 + 1, pt.y1 - pt.y0 + 1];
  return {
    runs: rowRuns(wall),
    beams: rowRuns(beam),
    doors,
    windows: (() => {
      const out = [];
      for (const [x, y, w, d] of rowRuns(beam).sort((p, q) => p[0] - q[0] || p[2] - q[2] || p[1] - q[1])) {
        const last = out[out.length - 1];
        if (last && last[0] === x && last[2] === w && last[1] + last[3] === y) last[3] += d; else out.push([x, y, w, d]);
      }
      return out.filter(([, , w, d]) => Math.max(w, d) >= 30);
    })(),
    beds: parts(bedM, 3, 400).map(rect),
    closets: parts(closetM, 3, 400).map(rect)
  };
}

async function start() {
  THREE = await import('./vendor/three.module.min.js');
  const view = box.querySelector('.jh-view');
  const fallback = box.querySelector('.jh-fallback');
  if (fallback) fallback.style.visibility = 'hidden';   // no scan flashes while the drawing gets ready
  const stepEl = box.querySelector('.jh-tag .k3d-tag-step');
  const noteEl = box.querySelector('.jh-tag-note');
  const legend = box.querySelector('.jh-legend');
  // one picture per room, stacked over the model
  const tpl = box.querySelector('.jh-photo');
  const photos = ROOMS.map((rm, i) => {
    const el = i ? tpl.cloneNode() : tpl;
    el.src = rm.img; el.loading = 'eager'; el.style.objectPosition = rm.pos || '';
    if (i) view.append(el);
    return el;
  });

  const R = pixels(await load('img/plan-jh-revised-no-ac.webp'));
  // The drawing's walls, as clean straight blocks [x, y, w, h] in plan px (owner, Nov 18: "lines look
  // jagged, clean them up, even if it's not 100% accurate"). Traced by hand from the developer's and
  // the revised plans, with the owner's corrections. KEEP: in both plans, charcoal. OLD: only in the
  // developer's plan, erased. NEW: only in the revised plan, drawn in olive.
  const KEEP = [
    [40, 36, 612, 28], [40, 64, 32, 384],                       // outer walls: north, west
    [376, 64, 28, 256], [376, 396, 28, 40], [166, 404, 238, 32], // safe room east (with its door), safe room / bedroom
    [444, 64, 24, 108], [404, 140, 64, 32],                     // shaft
    [400, 292, 72, 20], [544, 284, 86, 20], [630, 64, 20, 240], // bath: south (two pieces), east
    [500, 432, 144, 14], [524, 408, 40, 24], [628, 408, 16, 64], // hall wall, column, entry stub
    [758, 88, 18, 348], [758, 416, 450, 20], [1188, 416, 20, 398], [1064, 790, 144, 24],   // entry, kitchen north, east, south
    [904, 790, 26, 94], [904, 1016, 26, 228], [508, 1208, 422, 36],                       // living room east and south
    [184, 436, 32, 388], [330, 788, 34, 128], [330, 968, 34, 60], [330, 996, 210, 32],   // bedroom west, balcony side
    [452, 788, 70, 20], [522, 580, 38, 16], [522, 596, 18, 480]                           // bedroom / dining
  ];
  const OLD = [
    [566, 446, 20, 150], [560, 580, 26, 16],                    // bedroom east wall (the fridge niche goes there)
    [758, 436, 18, 160], [758, 580, 52, 16], [896, 436, 14, 160], [882, 580, 28, 16],     // utility room
    [904, 688, 26, 102]                                         // between the old kitchen and the dining area
  ];
  const NEW = [
    [468, 432, 32, 14], [522, 446, 18, 134], [560, 580, 72, 16], // closets and fridge niche
    [952, 436, 20, 276], [904, 696, 68, 16]                     // the third bedroom
  ];
  const rectMask = list => { const m = new Uint8Array(W * H); for (const [x0, y0, w, hh] of list) for (let y = y0; y < y0 + hh; y++) for (let x = x0; x < x0 + w; x++) m[y * W + x] = 1; return m; };
  const before = rectMask([...KEEP, ...OLD]), after = rectMask(KEEP), newWalls = rectMask(NEW);
  const Oi = renderPlan(before, null), Ti = renderPlan(after, newWalls);
  const ch = changes(Oi, Ti, Ti);
  const model = readModel(R);

  // the drawing sheet: one canvas, used as the floor texture throughout
  const sheet = document.createElement('canvas'); sheet.width = W; sheet.height = H;
  const sg = sheet.getContext('2d');
  const cur = new ImageData(new Uint8ClampedArray(Oi.data), W, H);
  const revisedImg = document.createElement('canvas'); revisedImg.width = W; revisedImg.height = H;
  revisedImg.getContext('2d').putImageData(R, 0, 0);
  const tiled = document.createElement('canvas'); tiled.width = W; tiled.height = H;
  { const g = tiled.getContext('2d'); g.fillStyle = '#e9e2d6'; g.fillRect(0, 0, W, H);
    g.strokeStyle = 'rgba(80,60,40,.08)'; g.lineWidth = 1;
    for (let x = 0; x < W; x += 63) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); }
    for (let y = 0; y < H; y += 63) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
    g.globalAlpha = .3; g.globalCompositeOperation = 'multiply'; g.drawImage(revisedImg, 0, 0); }
  // room names in the site's small spaced capitals: [name, x, y, appears (s), goes (s)]
  const LABELS = [
    ['Safe room', 190, 245], ['Bedroom', 345, 630], ['Bath', 515, 205], ['Entry', 700, 255],
    ['Dining', 700, 760], ['Living', 690, 1080], ['Balcony', 262, 1165],
    ['Kitchen', 1078, 640, null, T.erase[0]], ['Utility\nroom', 830, 512, null, T.erase[0]],
    ['Bedroom 3', 1078, 640, T.draw[1] - .6], ['Kitchen', 840, 548, T.draw[1] - .3]
  ];
  function drawLabels(t) {
    sg.save();
    sg.font = '600 23px "Hanken Grotesk", Helvetica, Arial, sans-serif';
    sg.textAlign = 'center'; sg.textBaseline = 'middle';
    try { sg.letterSpacing = '4px'; } catch (e) {}
    for (const [name, x, y, from, to] of LABELS) {
      let a = 1;
      if (from != null) a *= clamp01((t - from) / .6);
      if (to != null) a *= 1 - clamp01((t - to) / .8);
      if (a <= 0) continue;
      sg.globalAlpha = a * .72; sg.fillStyle = 'rgb(70,64,56)';
      name.toUpperCase().split('\n').forEach((line, k, all) => sg.fillText(line, x, y + (k - (all.length - 1) / 2) * 30));
    }
    sg.restore();
  }
  let done = 0;                             // changed pixels before this index are finished
  function sheetAt(t) {
    const L = ch.list, tg = ch.target, d = cur.data, o = Oi.data;
    if (sheetAt.t !== undefined && t < sheetAt.t) { d.set(o); done = 0; }   // loop back
    sheetAt.t = t;
    let moved = false, k = done, allDone = true;
    for (; k < L.length && L[k][1] <= t; k++) {
      const [p, t0, fade] = L[k], i = p * 4, a = clamp01((t - t0) / fade);
      d[i] = o[i] + (tg[i] - o[i]) * a; d[i + 1] = o[i + 1] + (tg[i + 1] - o[i + 1]) * a; d[i + 2] = o[i + 2] + (tg[i + 2] - o[i + 2]) * a;
      moved = true;
      if (a < 1) allDone = false; else if (allDone) done = k + 1;
    }
    const f = ease(span(t, ...T.floor));
    const fading = t > T.erase[0] - .1 && t < T.erase[0] + 1.2 || t > T.draw[1] - .9 && t < T.draw[1] + .5;
    if (moved || fading || t < 1 || f > 0 && f < 1 || sheetAt.k !== f) {
      sg.putImageData(cur, 0, 0);
      drawLabels(t);
      if (f > 0) { sg.globalAlpha = f; sg.drawImage(tiled, 0, 0); sg.globalAlpha = 1; }
      sheetAt.k = f;
      return true;
    }
    return false;
  }

  // ---- scene
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  view.prepend(renderer.domElement);
  box.classList.add('jh-live');

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, .1, 200);
  scene.add(new THREE.HemisphereLight(0xfffaf2, 0xd9d2c6, 1.6));
  const sun = new THREE.DirectionalLight(0xfff1de, 2.2);
  sun.position.set(-6, 14, 9);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9, near: 1, far: 40 });
  sun.shadow.bias = -.0004; sun.shadow.radius = 4;
  scene.add(sun);
  const fill = new THREE.DirectionalLight(0xf1f3f5, 1.1); fill.position.set(9, 9, -7); scene.add(fill);   // keeps the walls in shade white, not grey

  const tex = new THREE.CanvasTexture(sheet);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(W / U, H / U), new THREE.MeshStandardMaterial({ map: tex, roughness: .95, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: .9 }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true;
  scene.add(floor);

  // walls: white plaster, with the plan's black poche on top; a beam over every window
  const unit = new THREE.BoxGeometry(1, 1, 1); unit.translate(0, .5, 0);
  const WALL = h(260), HEAD = h(212);
  const plaster = new THREE.MeshStandardMaterial({ color: 0xf3efe8, roughness: .9 });
  const poche = new THREE.MeshStandardMaterial({ color: 0x2a2825, roughness: .8 });
  // the windows (plan px [x, y, w, d], sill in cm), read off the plan: wall gaps the plan crosses with
  // window lines. The detector also flags the front door and the pantry niche, so they are listed by hand.
  const WINDOWS = [[80, 410, 90, 25, 100], [910, 885, 20, 135, 60], [935, 795, 135, 15, 90], [335, 915, 25, 60, 110]];
  // doorways get only the wall above the opening, never glass (the main bedroom’s door to the balcony)
  const overlaps = ([ax, ay, aw, ad], [bx, by, bw, bd]) => ax < bx + bw && bx < ax + aw && ay < by + bd && by < ay + ad;
  const DOORS = [[230, 795, 100, 20], ...model.doors.filter(dr => Math.min(dr[2], dr[3]) >= 16 && !overlaps(dr, [515, 400, 130, 200]) && !WINDOWS.some(w => overlaps(dr, w)) && !overlaps(dr, [230, 795, 100, 20]))];   // real walls only, not the pantry niche
  // new walls that the revised plan draws only as thin lines: the wall that wraps the bar
  // (the children's room wall, then a short return under the bar)
  // and the short wall that closes the fridge niche on the living-room side (white, as seen from the salon)
  model.runs.push([954, 438, 11, 272], [904, 700, 61, 10], [527, 586, 105, 10], [527, 586, 9, 100]);
  const blocks = [...model.runs.map(r => [r, 0, WALL]), ...[...WINDOWS, ...DOORS].map(([x, y, w, d]) => [[x, y, w, d], HEAD, WALL])];
  const built = new THREE.Group(); scene.add(built);
  const walls = new THREE.InstancedMesh(unit, plaster, blocks.length);
  const caps = new THREE.InstancedMesh(unit, poche, blocks.length);
  const m4 = new THREE.Matrix4();
  blocks.forEach(([[x, y, w, d], y0, y1], i) => {
    m4.makeScale(w / U, y1 - y0, d / U).setPosition(wx(x + w / 2), y0, wz(y + d / 2)); walls.setMatrixAt(i, m4);
    m4.makeScale(w / U, .012, d / U).setPosition(wx(x + w / 2), WALL, wz(y + d / 2)); caps.setMatrixAt(i, m4);
  });
  walls.castShadow = walls.receiveShadow = true;
  // the windows: dark aluminium frames and glass, with a low wall under the smaller ones
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x4a4d50, roughness: .45, metalness: .4 });
  const glassMat = new THREE.MeshStandardMaterial({ color: 0xcfdfe4, roughness: .05, metalness: .1, transparent: true, opacity: .35 });
  const winGroup = new THREE.Group();
  const slab = (x, y, w, d, y0, y1, m) => {
    const mesh = new THREE.Mesh(unit, m);
    mesh.scale.set(w / U, y1 - y0, d / U); mesh.position.set(wx(x + w / 2), y0, wz(y + d / 2));
    mesh.castShadow = m !== glassMat; mesh.receiveShadow = true; winGroup.add(mesh);
  };
  for (const [x, y, w, d, sillcm] of WINDOWS) {
    const horiz = w >= d, long = Math.max(w, d), sill = h(Math.max(2, sillcm));
    if (sill > h(5)) slab(x, y, w, d, 0, sill, plaster);
    // the glass is centred in the wall's thickness (w for a north-south wall, d for an east-west one)
    const px = horiz ? x : x + w / 2 - 2, py = horiz ? y + d / 2 - 2 : y, pw = horiz ? w : 4, pd = horiz ? 4 : d;
    slab(px, py, pw, pd, sill, HEAD, glassMat);
    slab(px, py, pw, pd, sill, sill + h(5), frameMat);
    slab(px, py, pw, pd, HEAD - h(5), HEAD, frameMat);
    const n = Math.max(1, Math.round(long / 90));
    for (let i = 0; i <= n; i++) {
      const o = Math.min(long - 4, Math.max(0, long * i / n - 2));
      slab(horiz ? x + o : px, horiz ? py : y + o, horiz ? 4 : pw, horiz ? pd : 4, sill, HEAD, frameMat);
    }
  }
  // door frames: a jamb each side and a head, in pale oak, so each doorway reads as a door
  const jambMat = new THREE.MeshStandardMaterial({ color: 0xd9c3a2, roughness: .6 });
  for (const [x, y, w, d] of DOORS) {
    const horiz = w >= d, DH = h(212), T2 = 3;
    if (horiz) { slab(x, y - 1, T2, d + 2, 0, DH, jambMat); slab(x + w - T2, y - 1, T2, d + 2, 0, DH, jambMat); slab(x, y - 1, w, d + 2, DH - h(4), DH, jambMat); }
    else { slab(x - 1, y, w + 2, T2, 0, DH, jambMat); slab(x - 1, y + d - T2, w + 2, T2, 0, DH, jambMat); slab(x - 1, y, w + 2, d, DH - h(4), DH, jambMat); }
  }
  built.add(walls, caps, winGroup);

  // ---- furniture: shaped and coloured after the styled pictures, so the model reads as rooms, not blocks
  const furn = new THREE.Group(); scene.add(furn);
  // a box with softly rounded edges, sitting on y = 0, centred in x and z
  function rbox(w, hh, d, r = .015) {
    r = Math.max(.001, Math.min(r, w / 2 - .001, d / 2 - .001, hh / 2 - .001));
    const x = w / 2 - r, z = d / 2 - r, s = new THREE.Shape();
    s.moveTo(-x, -z); s.lineTo(x, -z); s.lineTo(x, z); s.lineTo(-x, z); s.lineTo(-x, -z);
    const g = new THREE.ExtrudeGeometry(s, { depth: Math.max(.001, hh - 2 * r), bevelEnabled: true, bevelSize: r, bevelThickness: r, bevelSegments: 3, curveSegments: 4 });
    g.rotateX(-Math.PI / 2); g.translate(0, r, 0);
    return g;
  }
  // canvas textures: wood grain, woven fabric, slats, a patterned rug
  function canvasTex(w, hh, draw, rep = [1, 1]) {
    const c = document.createElement('canvas'); c.width = w; c.height = hh;
    draw(c.getContext('2d'), w, hh);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...rep); return t;
  }
  const seeded = (() => { let s = 7; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();
  const grain = (base, line) => canvasTex(256, 256, (g, w, hh) => {
    g.fillStyle = base; g.fillRect(0, 0, w, hh);
    for (let i = 0; i < 70; i++) { g.strokeStyle = line; g.globalAlpha = .05 + seeded() * .12; g.lineWidth = .6 + seeded() * 1.6; const y = seeded() * hh; g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(w * .3, y + seeded() * 6 - 3, w * .6, y + seeded() * 6 - 3, w, y); g.stroke(); }
  });
  const weave = base => canvasTex(128, 128, (g, w, hh) => {
    g.fillStyle = base; g.fillRect(0, 0, w, hh);
    for (let i = 0; i < 1400; i++) { g.fillStyle = seeded() < .5 ? '#000' : '#fff'; g.globalAlpha = .035; g.fillRect(seeded() * w, seeded() * hh, 2, 1); }
  }, [3, 3]);
  const slats = canvasTex(256, 64, (g, w, hh) => {
    g.fillStyle = '#c29468'; g.fillRect(0, 0, w, hh);
    for (let x = 0; x < w; x += 8) { g.fillStyle = '#7d5a3a'; g.globalAlpha = .55; g.fillRect(x, 0, 2, hh); g.globalAlpha = .12; g.fillStyle = '#fff'; g.fillRect(x + 3, 0, 2, hh); }
  }, [3, 1]);
  const rugTex = (bg, a, b) => canvasTex(256, 192, (g, w, hh) => {
    g.fillStyle = bg; g.fillRect(0, 0, w, hh);
    g.strokeStyle = a; g.lineWidth = 6; g.strokeRect(10, 10, w - 20, hh - 20);
    g.strokeStyle = b; g.lineWidth = 3; g.strokeRect(22, 22, w - 44, hh - 44);
    g.fillStyle = a; g.globalAlpha = .8;
    for (const [cx, cy, r] of [[w / 2, hh / 2, 46], [w * .22, hh / 2, 20], [w * .78, hh / 2, 20]]) { g.beginPath(); g.moveTo(cx, cy - r); g.lineTo(cx + r, cy); g.lineTo(cx, cy + r); g.lineTo(cx - r, cy); g.closePath(); g.fill(); }
    g.globalAlpha = .07; for (let i = 0; i < 2500; i++) { g.fillStyle = seeded() < .5 ? '#000' : '#fff'; g.fillRect(seeded() * w, seeded() * hh, 2, 2); }
  });
  const M = (o) => new THREE.MeshStandardMaterial({ roughness: .8, ...o });
  const mats = {
    oak: M({ map: grain('#c49a6c', '#6d4a2c'), roughness: .65 }),
    paleOak: M({ map: grain('#d9bc94', '#8b6a48'), roughness: .65 }),
    white: M({ color: 0xf6f4ef, roughness: .5 }),
    lacquer: M({ color: 0xf4f3f0, roughness: .25 }),
    stone: M({ color: 0xece8e1, roughness: .35 }),
    steel: M({ color: 0xc9cbcc, roughness: .3, metalness: .7 }),
    fridge: M({ color: 0xe1e3e3, roughness: .32, metalness: .25 }),
    glass: M({ color: 0xd6e4e8, roughness: .05, metalness: .2, transparent: true, opacity: .4 }),
    deck: M({ map: canvasTex(256, 256, (g, w, hh) => { g.fillStyle = '#cfc6b8'; g.fillRect(0, 0, w, hh); g.strokeStyle = 'rgba(70,55,40,.25)'; g.lineWidth = 2; for (let k = 0; k <= w; k += 64) { g.beginPath(); g.moveTo(k, 0); g.lineTo(k, hh); g.stroke(); g.beginPath(); g.moveTo(0, k); g.lineTo(w, k); g.stroke(); } }, [3, 3]), roughness: .95 }),
    black: M({ color: 0x232220, roughness: .4 }),
    dark: M({ color: 0x3a3733, roughness: .6 }),
    linen: M({ map: weave('#efe9de') }),
    ivory: M({ map: weave('#f5f1e8') }),
    greyUph: M({ map: weave('#bdb7ae') }),
    taupe: M({ map: weave('#9c958b') }),
    rust: M({ map: weave('#b0603f') }),
    navy: M({ map: weave('#34405a') }),
    blueGrey: M({ map: weave('#8c9aa6') }),
    sage: M({ map: weave('#9aab8e') }),
    olive: M({ map: weave('#6f7a55') }),
    sageWall: M({ map: weave('#b9c4ad'), roughness: .9 }),
    slats: M({ map: slats, roughness: .7 }),
    terracotta: M({ color: 0xb4734f, roughness: .9 }),
    leaf: M({ color: 0x6b7a52, roughness: .9 }),
    milk: M({ color: 0xfff6e6, emissive: 0xffe9c4, emissiveIntensity: .6, roughness: .3 }),
    rugWarm: M({ map: rugTex('#e3d2bd', '#b0603f', '#34405a'), roughness: 1 }),
    rugBlue: M({ map: rugTex('#c9ccc9', '#5b6b80', '#8c9aa6'), roughness: 1 }),
    rugKids: M({ map: rugTex('#efe4d2', '#c07a4e', '#6f7a55'), roughness: 1 })
  };
  let item = null;
  const begin = () => { item = new THREE.Group(); furn.add(item); return item; };
  // add a rounded box to the current item: plan px for x/y/w/d, cm for height and lift
  const add = (x, y, w, d, hcm, mat, liftcm = 0, r = .015) => {
    const m = new THREE.Mesh(rbox(w / U, h(hcm), d / U, r), mat);
    m.position.set(wx(x + w / 2), h(liftcm), wz(y + d / 2));
    m.castShadow = m.receiveShadow = true; item.add(m); return m;
  };
  const cyl = (x, y, rpx, hcm, mat, liftcm = 0, top = rpx) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(top / U, rpx / U, h(hcm), 20), mat);
    m.position.set(wx(x), h(liftcm + hcm / 2), wz(y)); m.castShadow = true; item.add(m); return m;
  };
  // a made bed. head: which side the headboard is on ('n', 's', 'w', 'e')
  function bed(x, y, w, d, head, o) {
    begin();
    const along = head === 'n' || head === 's' ? 'y' : 'x';
    add(x, y, w, d, 26, o.base, 0, .02);                                   // base
    add(x + 3, y + 3, w - 6, d - 6, 20, mats.ivory, 26, .03);              // mattress and sheet
    // duvet over the lower three quarters, then a throw across the foot
    const part = (f0, f1, inset, hcm, mat, lift) => {
      if (along === 'y') { const a = head === 'n' ? y + d * f0 : y + d * (1 - f1); add(x + inset, a, w - 2 * inset, d * (f1 - f0), hcm, mat, lift, .025); }
      else { const a = head === 'w' ? x + w * f0 : x + w * (1 - f1); add(a, y + inset, w * (f1 - f0), d - 2 * inset, hcm, mat, lift, .025); }
    };
    part(.27, 1, 0, 9, o.duvet, 44);
    part(.7, .9, -2, 5, o.throw, 52);
    // pillows
    const n = o.pillows || 1;
    for (let i = 0; i < n; i++) {
      if (along === 'y') { const pw = (w - 16) / n; add(x + 8 + i * pw, head === 'n' ? y + 6 : y + d - 30, pw - 4, 24, 14, i % 2 ? o.accent : mats.ivory, 46, .04); }
      else { const pw = (d - 16) / n; add(head === 'w' ? x + 6 : x + w - 30, y + 8 + i * pw, 24, pw - 4, 14, i % 2 ? o.accent : mats.ivory, 46, .04); }
    }
    // headboard
    if (along === 'y') add(x - 2, head === 'n' ? y - 6 : y + d, w + 4, 8, o.hb || 100, o.headMat, 0, .03);
    else add(head === 'w' ? x - 6 : x + w, y - 2, 8, d + 4, o.hb || 100, o.headMat, 0, .03);
  }
  function nightstand(x, y, w, d) {
    begin();
    add(x, y, w, d, 50, mats.oak, 0, .012);
    cyl(x + w * .35, y + d * .45, 6, 2, mats.black, 50);                    // lamp: base, stem, shade
    cyl(x + w * .35, y + d * .45, 1.2, 30, mats.black, 52);
    cyl(x + w * .35, y + d * .45, 9, 14, mats.linen, 76, 6);
    cyl(x + w * .7, y + d * .6, 5, 14, mats.stone, 50, 3);                  // a small vase
  }
  function closet(x, y, w, d) {
    begin();
    add(x, y, w, d, 250, mats.paleOak, 0, .01);
    // door joints and pulls on both long faces
    const long = w >= d ? 'x' : 'y', L = long === 'x' ? w : d, doors = Math.max(1, Math.round(L / 48));
    for (let i = 1; i < doors; i++) {
      if (long === 'x') { add(x + L * i / doors - .6, y - .6, 1.2, d + 1.2, 246, mats.dark, 2, .001); }
      else { add(x - .6, y + L * i / doors - .6, w + 1.2, 1.2, 246, mats.dark, 2, .001); }
    }
    for (let i = 0; i < doors; i++) {
      const c = L * (i + .5) / doors;
      if (long === 'x') { add(x + c - 1, y - 1.5, 2, d + 3, 30, mats.dark, 100, .002); }
      else { add(x - 1.5, y + c - 1, w + 3, 2, 30, mats.dark, 100, .002); }
    }
  }
  function rug(x, y, w, d, mat) { begin(); add(x, y, w, d, 1.2, mat, 0, .004); }

  // --- children's room (the old kitchen): white bunk bed, sage and rust bedding, sage wallpaper, rug
  const kids = ROOMS.find(r => r.key === 'kids').r;
  const inKids = ([x, y, w, d]) => x >= kids[0] - 10 && x + w <= kids[2] + 10 && y >= kids[1] - 10 && y + d <= kids[3] + 10;
  const inSafe = ([x, y]) => x < 400 && y < 420;
  for (const r of model.beds) {
    const [x, y, w, d] = r;
    if (inKids(r)) {
      begin();
      add(x, y, w, d, 30, mats.white, 0, .01);                               // drawers under the bed
      add(x + 4, y + 4, w - 8, d - 8, 16, mats.ivory, 30, .03);
      add(x + w * .3, y + 4, w * .7 - 4, d - 8, 7, mats.olive, 46, .025);
      add(x + w * .55, y + 2, w * .25, d - 4, 4, mats.rust, 52, .02);
      for (const [px, py] of [[x, y], [x + w - 6, y], [x, y + d - 6], [x + w - 6, y + d - 6]]) add(px, py, 6, 6, 175, mats.white, 0, .004);  // posts
      add(x, y, w, d, 10, mats.white, 140, .008);                             // upper bunk
      add(x + 4, y + 4, w - 8, d - 8, 14, mats.ivory, 150, .03);
      add(x + w * .35, y + 2, w * .4, d - 4, 6, mats.sage, 164, .025);
      add(x, y, w, 4, 22, mats.white, 150, .004);                             // guard rail
      add(x + w - 12, y + d - 4, 10, 4, 140, mats.white, 0, .003);            // ladder
      rug(1005, 600, 165, 120, mats.rugKids);
      begin(); add(963, 450, 4, 250, 250, mats.sageWall, 0, .002);   // stops short of the doorway at the room’s south-west corner            // the sage wallpaper wall
    } else if (!inSafe(r)) {
      // main bedroom: grey upholstered headboards, white duvets, blue-grey and charcoal throws
      bed(x, y, w, d, 'w', { base: mats.greyUph, duvet: mats.ivory, throw: y < 520 ? mats.blueGrey : mats.taupe, headMat: mats.greyUph, accent: mats.blueGrey, pillows: 2 });
    }
  }
  rug(250, 520, 200, 120, mats.rugBlue);
  // the safe room: two single beds with their heads on the window wall side (west), the window to the
  // left of the left bed, a night table between them, an oak slat wall behind (as in its picture)
  begin(); add(68, 104, 6, 252, 250, mats.slats, 0, .002);
  bed(74, 118, 190, 84, 'w', { base: mats.white, duvet: mats.linen, throw: mats.rust, headMat: mats.white, accent: mats.rust, hb: 85, pillows: 1 });
  bed(74, 266, 190, 84, 'w', { base: mats.white, duvet: mats.linen, throw: mats.navy, headMat: mats.white, accent: mats.navy, hb: 85, pillows: 1 });
  nightstand(76, 212, 42, 46);
  rug(170, 140, 130, 190, mats.rugWarm);
  for (const r of model.closets) closet(...r);
// the main bathroom (from the revised plan): washer with the dryer on top, beside the reduced vanity
// with a mirror over it, then the toilet and the bath
begin();
add(401, 171, 62, 59, 85, mats.white, 0, .01);                          // washer
add(401, 171, 62, 59, 85, mats.white, 86, .01);                         // dryer on top
for (const lift of [42, 128]) { const m = cyl(462, 200, 15, 1, mats.dark, lift); m.rotation.z = Math.PI / 2; m.position.x = wx(463); }
add(401, 233, 52, 62, 35, mats.paleOak, 50, .01);                       // floating vanity
add(400, 232, 54, 64, 3, mats.stone, 85, .006);
add(418, 248, 26, 32, 1, mats.white, 88, .02);                          // basin
cyl(410, 264, 1.4, 22, mats.steel, 88);
add(400, 238, 2, 52, 75, mats.glass, 105, .002);                        // mirror
add(496, 112, 36, 24, 80, mats.white, 0, .02);                          // toilet: cistern and bowl
add(500, 134, 28, 40, 40, mats.white, 0, .04);
add(555, 110, 76, 170, 55, mats.white, 0, .03);                         // bath
add(563, 118, 60, 154, 2, mats.stone, 54, .04);
cyl(593, 124, 1.6, 20, mats.steel, 55);

// the balcony (mirpeset): outdoor stone, glass railing with a dark top rail, two chairs, a table, a planter
begin();
add(185, 1025, 340, 260, 1.5, mats.deck, 0, .002);
add(185, 820, 150, 205, 1.5, mats.deck, 0, .002);
const rail = (x, y, w, d) => { add(x, y, w, d, 100, mats.glass, 4, .002); add(x - 1, y - 1, w + 2, d + 2, 4, mats.black, 104, .002); };
rail(185, 820, 4, 465); rail(185, 1281, 340, 4);
begin(); add(330, 1110, 52, 52, 3, mats.black, 70, .01); cyl(356, 1136, 2, 70, mats.black);
for (const [cx, cy] of [[270, 1112], [400, 1160]]) { begin(); add(cx, cy, 46, 46, 6, mats.linen, 40, .02); add(cx, cy, 46, 6, 80, mats.black, 0, .01); for (const [lx, ly] of [[cx + 3, cy + 3], [cx + 41, cy + 3], [cx + 3, cy + 41], [cx + 41, cy + 41]]) cyl(lx, ly, 1.2, 40, mats.black); }
begin(); add(200, 1230, 46, 46, 50, mats.terracotta, 0, .02);
const bush = new THREE.Mesh(new THREE.IcosahedronGeometry(h(40), 1), mats.leaf); bush.position.set(wx(223), h(85), wz(1253)); bush.castShadow = true; item.add(bush);

  // the bedroom side of the new kitchen: a thin partition, then the pantry and the fridge,
  // their doors facing the kitchen (east)
  begin();
  add(555, 443, 10, 147, 260, plaster, 0, .002);
  add(565, 443, 64, 72, 250, mats.lacquer, 0, .01);                       // pantry: two doors and pulls
  add(628.6, 478, 1.2, 1.2, 246, mats.dark, 2, .001);
  add(629, 470, 1.6, 2.4, 90, mats.steel, 90, .002); add(629, 484, 1.6, 2.4, 90, mats.steel, 90, .002);
  add(565, 515, 64, 72, 185, mats.fridge, 0, .012);                       // fridge: stainless, freezer below
  add(628.6, 517, 1.2, 68, 1.2, mats.dark, 70, .001);
  add(629.5, 522, 2, 2.6, 40, mats.dark, 110, .002); add(629.5, 522, 2, 2.6, 30, mats.dark, 28, .002);
  add(565, 515, 64, 72, 63, mats.lacquer, 187, .01);                      // cupboard over the fridge

  // the kitchen, as on the revised plan and in the kitchen photo: a U open to the west.
  // North run: a tall unit at its open end, then drawers and the first sink. East run (the wall shared
  // with the children's room): the oven, with the upper cabinets above it. South run: the bar, with
  // the second sink, the gas hob at its east end, and an overhang on the living-room side for two stools.
  begin();
  const base = (x, y, w, d) => {
    add(x + 3, y + 3, w - 6, d - 6, 10, mats.dark, 0, .002);              // toe kick
    add(x, y, w, d, 76, mats.lacquer, 10, .006);
  };
  base(787, 440, 105, 67); base(892, 440, 62, 262); base(724, 584, 168, 66);
  add(724, 440, 63, 67, 232, mats.lacquer, 0, .008);                       // tall unit
  add(722, 470, 2, 3, 110, mats.steel, 70, .002);                          // its long pull
  add(785, 438, 171, 71, 4, mats.stone, 86, .006);                         // worktops
  add(890, 507, 66, 79, 4, mats.stone, 86, .006);
  add(722, 582, 234, 122, 4, mats.stone, 86, .006);                        // the bar top, with its overhang
  // drawer joints along the north run, door joints along the bar
  for (const x of [822, 857]) add(x, 506, 1.2, 2, 70, mats.dark, 14, .001);
  for (const y of [470, 492]) add(787, y, 105, 1.4, 1.2, mats.dark, 50, .001);
  add(852, 582, 58, 2, 58, mats.black, 18, .004);   // oven under the hob, facing into the U                          // oven door, facing the U
  add(855, 581.5, 52, 2.5, 2, mats.steel, 70, .002);
  // two 40 cm sinks (owner, Nov 18): one in the east run under the uppers, beside the oven, as in the
  // kitchen photo; one in the bar. Each with a gooseneck tap on the far side from where you stand.
  add(906, 510, 36, 42, 1, mats.steel, 90, .01);   // its left side against the seam of the two worktops                           // east-run sink
  add(752, 598, 42, 36, 1, mats.steel, 90, .01);                           // bar sink
  add(849, 594, 62, 46, 1, mats.black, 90, .008);                          // hob
  for (const [bx, by] of [[862, 606], [895, 606], [862, 629], [895, 629]]) cyl(bx, by, 5, 1.5, mats.dark, 91);
  // a gooseneck tap: a post, then a spout reaching over the sink (dx, dy point toward the sink, px)
  const tap = (x, y, dx, dy) => {
    cyl(x, y, 2.2, 3, mats.steel, 90);
    cyl(x, y, 1.3, 30, mats.steel, 93);
    add(Math.min(x, x + dx) - 1, Math.min(y, y + dy) - 1, Math.abs(dx) + 2, Math.abs(dy) + 2, 2.4, mats.steel, 121, .004);
    cyl(x + dx, y + dy, 1.1, 6, mats.steel, 116);
  };
  tap(949, 531, -16, 0);                                                    // east-run sink: tap at the wall
  tap(773, 640, 0, -15);                                                    // bar sink: tap on the bar side
  add(922, 440, 34, 160, 70, mats.lacquer, 145, .006);                     // uppers over the oven, east wall
  add(787, 440, 135, 34, 70, mats.lacquer, 145, .006);                     // uppers on the back wall too
  for (const x of [832, 877]) add(x, 474, 1.2, 1.2, 66, mats.dark, 147, .001);
  for (const y of [480, 520, 560]) add(921, y, 1.2, 1.2, 66, mats.dark, 147, .001);
  for (const sx of [760, 823]) {                                          // two stools at the bar
    begin(); cyl(sx + 19, 728, 19, 5, mats.linen, 62, 18);
    for (const [lx, ly] of [[sx + 5, 714], [sx + 33, 714], [sx + 5, 742], [sx + 33, 742]]) cyl(lx, ly, 1.3, 62, mats.paleOak);
  }
  // dining: a white table, long side north to south, six grey chairs, a warm rug, a milk-glass pendant
  rug(630, 765, 205, 200, mats.rugWarm);
  begin();
  add(685, 772, 95, 168, 4, mats.white, 72, .01);
  for (const [lx, ly] of [[692, 780], [772, 780], [692, 932], [772, 932]]) cyl(lx, ly, 2.5, 72, mats.paleOak);
  for (const cy of [782, 836, 890]) for (const [cx, bx] of [[646, 640], [787, 813]]) {
    begin(); add(cx, cy, 32, 40, 46, mats.greyUph, 0, .03);
    add(bx, cy, 6, 40, 90, mats.greyUph, 0, .02);
  }
  begin(); cyl(732, 856, 15, 15, mats.milk, 200, 12); cyl(732, 856, .4, 45, mats.dark, 215);
  // sofa under the window, with cushions, and an olive tree in a basket
  begin();
  add(600, 1110, 230, 88, 42, mats.linen, 0, .04);
  add(600, 1170, 230, 28, 82, mats.linen, 0, .04);
  add(600, 1110, 26, 88, 62, mats.linen, 0, .04); add(804, 1110, 26, 88, 62, mats.linen, 0, .04);
  add(640, 1148, 34, 18, 34, mats.rust, 42, .05); add(760, 1148, 34, 18, 34, mats.olive, 42, .05);
  begin(); cyl(866, 1160, 18, 34, mats.paleOak, 0, 20);
  cyl(866, 1160, 2, 90, mats.dark, 34);
  const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(h(48), 1), mats.leaf);
  crown.position.set(wx(866), h(150), wz(1160)); crown.castShadow = true; item.add(crown);

  furn.children.forEach(g => { g.userData.k = 0; });

  // ---- camera: straight down on the plan, a bird's-eye view, then each room in turn
  const fit = () => { const a = camera.aspect; return Math.max(H / U, (W / U) / a) * .5 / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * 1.06; };
  const DIR = new THREE.Vector3(-.08, .94, .34).normalize();   // steep, so the near walls do not hide the room
  const roomPose = ROOMS.map(rm => {
    const [x0, y0, x1, y1] = rm.r;
    const c = new THREE.Vector3(wx((x0 + x1) / 2), h(60), wz((y0 + y1) / 2));
    const ext = Math.max(x1 - x0, y1 - y0) / U;
    return { pos: c.clone().addScaledVector(DIR, (ext * 2.35 + .6) * (rm.zoom || 1)), look: c, mid: c.clone().setY(h(90)) };
  });
  const top = { pos: new THREE.Vector3(), look: new THREE.Vector3() }, bird = { pos: new THREE.Vector3(), look: new THREE.Vector3() };
  const tmpP = new THREE.Vector3(), tmpL = new THREE.Vector3();
  function cameraAt(t) {
    const dist = fit();
    top.pos.set(0, dist, .001); top.look.set(0, 0, 0);
    bird.pos.set(-dist * .52, dist * .98, dist * .86); bird.look.set(-.9, 0, .5);
    let k = ease(span(t, ...T.cam));
    tmpP.lerpVectors(top.pos, bird.pos, k); tmpL.lerpVectors(top.look, bird.look, k);
    let prev = bird;
    ROOMS.forEach((_, i) => {
      const f = ease(span(t, ...leg(i).fly));
      if (f > 0) { tmpP.lerpVectors(prev.pos, roomPose[i].pos, f); tmpL.lerpVectors(prev.look, roomPose[i].look, f); }
      prev = roomPose[i];
    });
    const b = ease(span(t, ...T.back));
    if (b > 0) { tmpP.lerpVectors(prev.pos, bird.pos, b); tmpL.lerpVectors(prev.look, bird.look, b); }
    camera.position.copy(tmpP); camera.lookAt(tmpL);
  }
  const shot = new THREE.Vector3();
  const onScreen = v => { shot.copy(v).project(camera); return [(shot.x * .5 + .5) * 100, (-shot.y * .5 + .5) * 100]; };

  // ---- frame
  let stepNow = -1;
  function frame(t) {
    if (sheetAt(t)) tex.needsUpdate = true;
    const r = easeOut(span(t, ...T.rise));
    floor.material.emissiveIntensity = lerp(.9, .32, ease(span(t, ...T.cam)));   // white paper while flat, lit floor once built
    built.visible = r > 0; built.scale.y = Math.max(r, .001);
    furn.children.forEach((g, i) => {
      const k = easeOut(span(t, T.rise[0] + .5 + i * .03, T.rise[1] + .3 + i * .03));
      g.visible = k > 0; g.scale.y = Math.max(k, .001);
    });
    cameraAt(t);
    photos.forEach((el, i) => {
      const L = leg(i), p = easeOut(span(t, ...L.open)) * (1 - ease(span(t, ...L.close)));
      if (p > 0) {
        const [cx, cy] = onScreen(roomPose[i].mid);
        el.style.clipPath = `circle(${(p * 125).toFixed(2)}% at ${cx.toFixed(1)}% ${cy.toFixed(1)}%)`;
        el.style.visibility = 'visible';
      } else el.style.visibility = 'hidden';
    });
    const out = span(t, T.end - .9, T.end);
    renderer.domElement.style.opacity = (1 - out).toFixed(3);
    if (legend) legend.classList.toggle('on', t >= T.erase[0] - .3 && t < T.rise[0]);
    let s = 0; for (let i = 0; i < STEPS.length; i++) if (t >= STEPS[i][0]) s = i;
    if (s !== stepNow) {
      stepNow = s;
      const [, num, name, note] = STEPS[s];
      if (num) { const b = document.createElement('b'); b.textContent = num; stepEl.replaceChildren(b, ' ' + name); }
      else stepEl.replaceChildren(name);
      noteEl.textContent = note;
    }
    renderer.render(scene, camera);
  }

  function resize() {
    const w = view.clientWidth, hh = view.clientHeight;
    renderer.setSize(w, hh, false);
    camera.aspect = w / hh; camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(view);
  resize();

  // ---- play while in view; loop
  let time = 0, last = 0, playing = false, raf = 0;
  function tick(now) {
    raf = 0;
    if (!playing) return;
    const dt = Math.min(.05, (now - last) / 1000); last = now;
    time += dt; if (time > T.end) time = 0;
    frame(time);
    raf = requestAnimationFrame(tick);
  }
  new IntersectionObserver(es => {
    const on = es.some(e => e.isIntersecting);
    if (on && !playing) { playing = true; last = performance.now(); if (!raf) raf = requestAnimationFrame(tick); }
    if (!on) playing = false;
  }, { threshold: .35 }).observe(box);
  frame(0);
  window.__jh = { jump: t => { time = t; frame(t); }, model, T, leg };
}
