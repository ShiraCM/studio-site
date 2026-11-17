/* Kitchen, plan to model to rendering.
   The cabinet maker's plan (img/kitchen-plan-clean.svg) lies flat on the floor,
   the walls and cabinets rise out of it, the camera comes down to eye level,
   and the scene dissolves into the photorealistic rendering.
   All geometry comes from the plan: 1.5 SVG px = 1 cm, interior corner at (128,130).
   Two uses: on kitchen-3d.html it loops with stage buttons; as a home-reel scene
   (.k3d-reel) it plays once each time reel.js shows the scene (scene:show event).
   three.js loads only when the animation is first needed. */
let THREE;


const X = px => (px - 128) / 150;          // SVG x -> metres from the left wall
const Z = py => (py - 130) / 150;          // SVG y -> metres from the back wall
const clamp01 = v => Math.min(1, Math.max(0, v));
const span = (t, a, b) => clamp01((t - a) / (b - a));
const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const easeOut = t => 1 - Math.pow(1 - t, 3);
const lerp = (a, b, t) => a + (b - a) * t;

// Timeline in seconds. It opens by hand: the contractor's standard kitchen plan, an invisible
// eraser wipes it, and our plan is sketched line by line (PRE). Everything after starts at D.
const D = 4.4;
const PRE = { erase: [1.0, 2.2], draw: [2.3, 4.1], snap: [3.9, 4.4] };
const T = { plan: D + 1.4, rise: [D + 1.4, D + 4.6], planFade: [D + 3.2, D + 4.8], cam: [D + 3.4, D + 8.6], photo: [D + 9.6, D + 11.2], end: D + 15 };
const STAGES = [D + 0.6, D + 7.4, D + 11.2];          // where the Plan / Model / Rendering buttons jump to


function webglOK() {
  try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch { return false; }
}

async function planTexture(src, clearPaper = false) {
  const img = new Image();
  // onload, not img.decode(): Safari rejects decode() for SVG images
  await new Promise((resolve, reject) => { img.onload = resolve; img.onerror = reject; img.src = src; });
  const c = document.createElement('canvas');
  c.width = 1800; c.height = 1720;
const g = c.getContext('2d', { willReadFrequently: clearPaper });
g.drawImage(img, 0, 0, c.width, c.height);
if (clearPaper) {
  const d = g.getImageData(0, 0, c.width, c.height), p = d.data;
  for (let i = 0; i < p.length; i += 4) {
    const a = 255 - Math.min(p[i], p[i + 1], p[i + 2]);
    if (a === 0) { p[i + 3] = 0; continue; }
    for (let k = 0; k < 3; k++) p[i + k] = Math.round(255 - (255 - p[i + k]) * 255 / a);
    p[i + 3] = a;
  }
  g.putImageData(d, 0, 0);
}
const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

// ---- The hand-drawn opening ----
// Same "paper to transparent" rule as planTexture, for one CSS colour.
function alphaColor(css, clear) {
  const m = css && css.match(/rgba?\(([^)]+)\)/); if (!m) return null;
  const [r, g, b, a = 1] = m[1].split(/[\s,\/]+/).filter(Boolean).map(Number);
  if (!clear) return `rgba(${r},${g},${b},${a})`;
  const al = 255 - Math.min(r, g, b);
  if (al === 0) return 'rgba(0,0,0,0)';
  const f = v => Math.round(255 - (255 - v) * 255 / al);
  return `rgba(${f(r)},${f(g)},${f(b)},${(al / 255 * a).toFixed(3)})`;
}

// Read our plan SVG into a list of strokes to draw one after another, in drawing order:
// walls first, then everything else as it appears in the file. Text and dimension ticks
// arrive when the sketch hands over to the finished plan texture.
async function buildSketch(src, clear) {
  const holder = document.createElement('div');
  holder.setAttribute('aria-hidden', 'true');
  holder.style.cssText = 'position:absolute;left:-10000px;top:0;width:900px;height:860px;overflow:hidden;visibility:hidden;pointer-events:none';
  holder.innerHTML = await (await fetch(src)).text();
  document.body.appendChild(holder);
  const svg = holder.querySelector('svg');
  const measure = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  svg.appendChild(measure);
  const num = (el, k) => parseFloat(el.getAttribute(k)) || 0;
  const walls = [], rest = [], floor = [];
  function add(el, ctm, list) {
    const cs = getComputedStyle(el);
    let stroke = cs.stroke && cs.stroke !== 'none' ? alphaColor(cs.stroke, clear) : null;
    const fill = cs.fill && cs.fill !== 'none' && !cs.fill.startsWith('url') ? alphaColor(cs.fill, clear) : null;
    let sw = parseFloat(cs.strokeWidth) || 1;
    if (!stroke && fill) { stroke = fill; sw = 1; }          // filled shapes are outlined first, then filled
    const dash = cs.strokeDasharray && cs.strokeDasharray !== 'none' ? cs.strokeDasharray.split(/[\s,]+/).map(parseFloat).filter(v => v > 0) : null;
    const mx = { a: ctm.a, b: ctm.b, c: ctm.c, d: ctm.d, e: ctm.e, f: ctm.f };
    const tag = el.tagName.toLowerCase();
    if (tag === 'path') {
      const subs = el.getAttribute('d').split(/(?=[Mm])/).filter(s => s.trim());
      for (const d of subs) { measure.setAttribute('d', d); list.push({ path: new Path2D(d), len: Math.max(1, measure.getTotalLength()), stroke, fill: subs.length > 1 ? null : fill, sw, dash, mx }); }
      return;
    }
    const path = new Path2D(); let len = 1;
    if (tag === 'rect') {
      const x = num(el, 'x'), y = num(el, 'y'), w = num(el, 'width'), h = num(el, 'height'), r = Math.min(num(el, 'rx'), w / 2, h / 2);
      if (r && path.roundRect) path.roundRect(x, y, w, h, r); else path.rect(x, y, w, h);
      len = 2 * (w + h);
    } else if (tag === 'circle') { const r = num(el, 'r'); path.arc(num(el, 'cx'), num(el, 'cy'), r, -Math.PI / 2, Math.PI * 1.5); len = 2 * Math.PI * r; }
    else if (tag === 'line') { path.moveTo(num(el, 'x1'), num(el, 'y1')); path.lineTo(num(el, 'x2'), num(el, 'y2')); len = Math.hypot(num(el, 'x2') - num(el, 'x1'), num(el, 'y2') - num(el, 'y1')); }
    else return;
    list.push({ path, len: Math.max(1, len), stroke, fill, sw, dash, mx });
  }
  for (const el of svg.querySelectorAll('rect, circle, line, path, use')) {
    if (el.closest('defs') || el === measure) continue;
    if (el.parentNode === svg && el.tagName.toLowerCase() === 'rect' && num(el, 'width') >= 900) continue;   // the paper
    const ctm = el.getCTM(); if (!ctm) continue;
    if (el.tagName.toLowerCase() === 'use') {
      const ref = svg.querySelector((el.getAttribute('href') || el.getAttribute('xlink:href')));
      if (ref) for (const k of ref.querySelectorAll('rect, circle, line, path')) add(k, ctm, rest);
      continue;
    }
    const g = el.parentNode;
    if (g.hasAttribute && g.hasAttribute('clip-path')) add(el, ctm, floor);
    else if (g.getAttribute && g.getAttribute('fill') === '#2b2926' && !el.getAttribute('stroke') && g !== svg) add(el, ctm, walls);
    else add(el, ctm, rest);
  }
  holder.remove();
  const items = [...walls, ...rest];
  let total = 0;
  for (const it of items) { it.start = total; total += it.len; }
  return { items, floor, total, clear };
}

function paintItem(g, it, p, k, clear, fade) {
  const m = it.mx;
  g.setTransform(k * m.a, k * m.b, k * m.c, k * m.d, k * m.e, k * m.f);
  if (it.fill) {
    const fa = fade ? p : clamp01((p - .8) / .2);
    if (fa > 0) {
      g.globalAlpha = fa;
      if (clear && !fade) { g.globalCompositeOperation = 'destination-out'; g.fill(it.path); g.globalCompositeOperation = 'source-over'; }
      g.fillStyle = it.fill; g.fill(it.path);
    }
  }
  if (it.stroke) {
    g.lineWidth = it.sw; g.strokeStyle = it.stroke; g.lineCap = 'round'; g.lineJoin = 'round';
    if (it.dash || fade) { g.globalAlpha = p; g.setLineDash(it.dash || []); }
    else { g.globalAlpha = 1; g.setLineDash(p < 1 ? [it.len * p, it.len + 2] : []); }
    g.stroke(it.path);
  }
  g.globalAlpha = 1; g.setLineDash([]);
}

// The contractor's original kitchen plan, turned and scaled onto our plan: its window wall
// becomes our left wall and its long counter wall our back wall (435 px there = 430 cm here).
async function contractorLayer(src, k, clear) {
  const img = new Image();
  await new Promise((resolve, reject) => { img.onload = resolve; img.onerror = reject; img.src = src; });
  const c = document.createElement('canvas'); c.width = 900 * k; c.height = 860 * k;
  const g = c.getContext('2d', { willReadFrequently: clear });
  const s = 645 / 435;
  g.setTransform(k, 0, 0, k, 0, 0);
  g.beginPath(); g.rect(84, 88, 732, 676); g.clip();
  g.transform(0, s, -s, 0, 128 + 585 * s, 130 - 190 * s);
  g.drawImage(img, 0, 0);
  g.clearRect(548, 334, 110, 249);                   // leave out the living-room sofa
  if (clear) {
    g.setTransform(1, 0, 0, 1, 0, 0);
    const d = g.getImageData(0, 0, c.width, c.height), p = d.data;
    for (let i = 0; i < p.length; i += 4) {
      if (!p[i + 3]) continue;
      const a = 255 - Math.min(p[i], p[i + 1], p[i + 2]);
      if (a < 6) { p[i + 3] = 0; continue; }
      for (let j = 0; j < 3; j++) p[i + j] = Math.round(255 - (255 - p[i + j]) * 255 / a);
      p[i + 3] = Math.round(a * p[i + 3] / 255);
    }
    g.putImageData(d, 0, 0);
  }
  return c;
}

// The eraser's path: back and forth across the drawing, a little uneven, like a hand.
function eraserPath() {
  const pts = [];
  let row = 0;
  for (let y = 70; y <= 800; y += 70, row++) {
    const xs = row % 2 ? [830, 70] : [70, 830];
    for (let i = 0; i <= 12; i++) {
      const x = lerp(xs[0], xs[1], i / 12);
      pts.push([x, y + Math.sin(x * .018 + row * 1.7) * 14 + (i / 12) * 22]);
    }
  }
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  return { pts, cum, total: cum[cum.length - 1] };
}

async function init(box) {
  THREE = await import('./vendor/three.module.min.js');
  const reel = box.classList.contains('k3d-reel');
  const hero = box.classList.contains('k3d-hero');
  const scrolled = box.classList.contains('k3d-scroll');  // driven by page scroll, on a transparent background      // the home-page hero: loops, stage buttons overlaid at the bottom
  let wrapped = false;                                    // true after the first loop, so the rendering fades back into the plan
  // Camera poses: straight down on the plan, then the rendering's eye-level view.
  const TOP = { pos: new THREE.Vector3(2.15, 9.4, 2.0), look: new THREE.Vector3(2.15, 0, 2.0), fov: 34 };
  const EYE = { pos: new THREE.Vector3(1.95, 1.05, 5.9), look: new THREE.Vector3(1.95, 0.9, 0), fov: 40 };
  const stageEl = box.querySelector('.k3d-stage');
  const photo = box.querySelector('.k3d-photo');
  const buttons = box.querySelectorAll('.k3d-steps button');
  const replay = box.querySelector('.k3d-replay');
  const full = box.classList.contains('k3d-full');        // full-screen pinned hero: words on one side, kitchen in the free space
  const story = box.classList.contains('k3d-story');      // the page scrolls; text blocks pass by and the kitchen follows them
  const copyEl = box.querySelector('.k3d-copy');
  const marks = box.querySelectorAll('.k3d-line li');
  const focus = { x: 0, y: 0, w: 1, h: 1 };              // where the kitchen sits on screen, in px
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: scrolled });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.25;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.setAttribute('aria-hidden', 'true');
  stageEl.prepend(renderer.domElement);

  const scene = new THREE.Scene();
  const paper = new THREE.Color('#ffffff'), room = new THREE.Color('#ece8e1');
  scene.background = scrolled ? null : paper.clone();
  const camera = new THREE.PerspectiveCamera(TOP.fov, 2, 0.05, 60);

  // Light: soft sky fill, warm daylight through the left windows
  scene.add(new THREE.HemisphereLight('#fffaf2', '#d8cbb8', 1.35));
  const sun = new THREE.DirectionalLight('#fff3e2', 2.4);
  sun.position.set(-4.5, 5.5, 2.4);
  sun.target.position.set(2.2, 0, 2);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -5, right: 5, top: 5, bottom: -5, near: 1, far: 16 });
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.02;
  scene.add(sun, sun.target);

  const M = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: .78, metalness: 0, ...extra });
  const mat = {
    wall: M('#f4f1ec'), cab: M('#e2dcd2', { roughness: .62 }), tall: M('#e6e0d6', { roughness: .6 }),
    stone: M('#f3f0ea', { roughness: .35 }), dark: M('#1d1c1b', { roughness: .3, metalness: .3 }),
    steel: M('#bfc0bf', { roughness: .3, metalness: .6 }), glass: new THREE.MeshBasicMaterial({ color: '#f7f8f6', toneMapped: false }),
    floor: M('#dcc8ac', { roughness: .7, transparent: true, opacity: 0 }), stool: M('#efe9df', { roughness: .9, side: THREE.DoubleSide }),
    chrome: M('#c9c8c4', { roughness: .3 }), groove: M('#b3ab9e', { roughness: .8 }),
    led: new THREE.MeshBasicMaterial({ color: '#fff3d6', toneMapped: false }),
  };
  const edgeMat = new THREE.LineBasicMaterial({ color: '#2b2926', transparent: true, opacity: .9 });

  // A rising group: everything in it grows up out of the floor.
  const risers = [];
  function group(order, opts = {}) {
    const g = new THREE.Group();
    g.userData = { order, drop: !!opts.drop };
    g.visible = false;
    scene.add(g); risers.push(g);
    return g;
  }
  // Box by SVG footprint (x0,y0)-(x1,y1) and height range h0..h1 (m)
  function block(g, x0, y0, x1, y1, h0, h1, m, edges = true) {
    const w = X(x1) - X(x0), d = Z(y1) - Z(y0), h = h1 - h0;
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    mesh.position.set(X(x0) + w / 2, h0 + h / 2, Z(y0) + d / 2);
    mesh.castShadow = mesh.receiveShadow = true;
    g.add(mesh);
    if (edges) {
      const e = new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry), edgeMat);
      e.position.copy(mesh.position); g.add(e);
    }
    return mesh;
  }
  // Box in metres, for small parts
  function part(g, x, y, z, w, h, d, m) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true;
    g.add(mesh); return mesh;
  }

  const H = 2.7, BASE = .86, TOP_ = .9;

  // Walls (order 0)
  const walls = group(0);
  block(walls, 98, 100, 803, 130, 0, H, mat.wall);
  block(walls, 773, 130, 803, 648, 0, H, mat.wall);
  block(walls, 98, 130, 128, 163, 0, H, mat.wall);
  block(walls, 98, 346, 128, 412, 0, H, mat.wall);
  block(walls, 98, 592, 128, 730, 0, H, mat.wall);
  for (const [a, b] of [[163, 346], [412, 592]]) {      // the two windows: sill, head, bright glass
    block(walls, 98, a, 128, b, 0, 1.0, mat.wall);
    block(walls, 98, a, 128, b, 2.42, H, mat.wall);
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(Z(b) - Z(a), 1.42), mat.glass);
    glass.rotation.y = Math.PI / 2; glass.position.set(X(110), 1.71, (Z(a) + Z(b)) / 2);
    walls.add(glass);
  }

  // Window-wall run (order 1): cooktop, oven below the counter, sink, dishwasher
  const left = group(1);
  block(left, 128, 130, 218, 667, 0, BASE, mat.cab);
  block(left, 128, 130, 218, 667, BASE, TOP_, mat.stone, false);
  part(left, X(173), TOP_ + .006, Z(301), .5, .012, .58, mat.dark);                 // induction cooktop
  part(left, X(218) + .006, .48, Z(427), .012, .56, .58, mat.dark);                 // oven front
  part(left, X(171), TOP_ + .003, Z(535), .4, .01, .62, mat.steel);                 // sink
  part(left, X(209), TOP_ + .2, Z(535), .025, .4, .025, mat.dark);                  // tap

  // Back run (order 1): base cabinets, main sink, uppers above (order 3, drop in)
  const back = group(1);
  block(back, 218, 130, 683, 220, 0, BASE, mat.cab);
  block(back, 218, 130, 683, 220, BASE, TOP_, mat.stone, false);
  part(back, X(522), TOP_ + .003, Z(174), .78, .01, .42, mat.steel);
  part(back, X(522), TOP_ + .2, Z(140), .025, .4, .025, mat.dark);
// Back wall, from the cabinet maker's elevation of wall B (order PDF p.14):
// three 90 cm upper modules (270 cm), 50 cm from the window-wall corner, from 135 to 240 cm high:
// 45 cm lift-up doors (HK) below, 60 cm doors (two per module) on top, LED strip underneath.
// Stone backsplash behind, as in the rendering.
const splash = group(1);
block(splash, 128, 130, 683, 132, TOP_, H, mat.stone, false);
const uppers = group(3, { drop: true });
const U0 = 128 + 50 * 1.5, U1 = U0 + 270 * 1.5, UB = 1.35, US = 1.80, UT = 2.40, UD = 130 + 35 * 1.5;
block(uppers, U0, 130, U1, UD, UB, UT, mat.cab);
const uw = X(U1) - X(U0), front = Z(UD) + .002;
part(uppers, (X(U0) + X(U1)) / 2, US, front, uw, .006, .004, mat.groove);
for (let i = 1; i < 6; i++) part(uppers, X(U0) + uw * i / 6, (US + UT) / 2, front, .006, UT - US, .004, mat.groove);
for (let i = 1; i < 3; i++) part(uppers, X(U0) + uw * i / 3, (UB + US) / 2, front, .006, US - UB, .004, mat.groove);
part(uppers, (X(U0) + X(U1)) / 2, UB - .012, Z(UD) - .06, uw - .04, .012, .03, mat.led);

  // Tall wall (order 2): pantries, oven column, fridge, utility
  const tall = group(2);
  block(tall, 683, 130, 773, 648, 0, 2.5, mat.tall);
  for (const py of [226, 322, 442, 584]) part(tall, X(682), 1.25, Z(py), .004, 2.5, .006, mat.dark);
  part(tall, X(682), 1.2, Z(383), .012, .58, .56, mat.dark);                        // wall oven
  part(tall, X(682), 1.0, Z(513), .014, 2.0, .9, mat.dark);                         // fridge doors

  // Island (order 2): cabinets, fold-out table slot, seating end with a waterfall
  const island = group(2);
  block(island, 381, 379, 519, 669, 0, BASE, mat.cab);
  block(island, 381, 379, 519, 674, BASE, TOP_, mat.stone, false);
  block(island, 381, 669, 519, 674, 0, BASE, mat.stone, false);

  // Stools (order 4), as in the rendering: round cream upholstered seats with a low curved back,
  // thin chrome legs and a footrest ring, tucked in along both sides of the island.
  const stools = group(4);
for (const [px, side] of [[381 - 22, -1], [519 + 22, 1]]) {
  const s = new THREE.Group();
  s.position.set(X(px), 0, 2.4);         // set back along the island, as in the rendering
  const seat = new THREE.Mesh(new THREE.CylinderGeometry(.2, .19, .08, 40), mat.stool);
  seat.position.y = .66;
  const back = new THREE.Mesh(new THREE.CylinderGeometry(.2, .2, .17, 40, 1, true, side > 0 ? 0 : -Math.PI, Math.PI), mat.stool);
  back.position.y = .78;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(.165, .007, 8, 40), mat.chrome);
  ring.rotation.x = Math.PI / 2; ring.position.y = .26;
  s.add(seat, back, ring);
  for (const a of [.25, .75, 1.25, 1.75]) {
    const ang = a * Math.PI, leg = new THREE.Mesh(new THREE.CylinderGeometry(.008, .008, .64, 8), mat.chrome);
    leg.position.set(Math.cos(ang) * .17, .31, Math.sin(ang) * .17);
    leg.rotation.set(Math.sin(ang) * .06, 0, -Math.cos(ang) * .06);
    s.add(leg);
  }
  s.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  stools.add(s);
  }

  // Floor (oak) and the plan drawing on top of it
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(4.7, 7.6), mat.floor);
floor.rotation.x = -Math.PI / 2; floor.position.set(2.15, 0, 3.6); floor.receiveShadow = true;
if (scrolled) {
  // fade the floor out into the living room, so the model has no hard edge on the page
  const a = document.createElement('canvas'); a.width = 4; a.height = 256;
  const ag = a.getContext('2d'), gr = ag.createLinearGradient(0, 0, 0, 256);
  gr.addColorStop(0, '#fff'); gr.addColorStop(.55, '#fff'); gr.addColorStop(.74, '#000'); gr.addColorStop(1, '#000');
  ag.fillStyle = gr; ag.fillRect(0, 0, 4, 256);
  mat.floor.alphaMap = new THREE.CanvasTexture(a);
}
  scene.add(floor);
  const planMat = new THREE.MeshBasicMaterial({ map: await planTexture('img/kitchen-plan-clean.svg', scrolled), transparent: true, toneMapped: false });
  const plan = new THREE.Mesh(new THREE.PlaneGeometry(6, 860 / 150), planMat);
  plan.rotation.x = -Math.PI / 2; plan.position.set(X(450), .003, Z(430));
  scene.add(plan);

  // The hand-drawn opening lives on its own canvas, laid exactly over the finished plan.
  const SK = 1.5;                                                    // canvas px per SVG px
  const [sketch, oldPlan] = await Promise.all([
    buildSketch('img/kitchen-plan-clean.svg', scrolled),
    contractorLayer('img/kitchen-plan-contractor.png', SK, scrolled)
  ]);
  const eraser = eraserPath();
  const skCanvas = document.createElement('canvas'); skCanvas.width = 900 * SK; skCanvas.height = 860 * SK;
  const skg = skCanvas.getContext('2d');
  const skTex = new THREE.CanvasTexture(skCanvas); skTex.colorSpace = THREE.SRGBColorSpace; skTex.anisotropy = 8;
  const skMat = new THREE.MeshBasicMaterial({ map: skTex, transparent: true, toneMapped: false, depthWrite: false });
  const skMesh = new THREE.Mesh(plan.geometry, skMat);
  skMesh.rotation.x = -Math.PI / 2; skMesh.position.set(X(450), .004, Z(430));
  scene.add(skMesh);
  const tag = box.querySelector('.k3d-tag'), tagText = tag ? tag.textContent : '';
  let skLast = -1;
  function drawOpening(t) {
    const q = Math.round(Math.min(t, PRE.snap[1]) * 120) / 120;
    if (q === skLast) return;
    skLast = q;
    skg.setTransform(1, 0, 0, 1, 0, 0);
    skg.clearRect(0, 0, skCanvas.width, skCanvas.height);
    const e = span(t, ...PRE.erase);
    if (e < 1) {
      skg.drawImage(oldPlan, 0, 0);
      if (e > 0) {
        // rub out the contractor's plan along the eraser's path so far
        const L = e * eraser.total, P = eraser.pts;
        skg.setTransform(SK, 0, 0, SK, 0, 0);
        skg.globalCompositeOperation = 'destination-out';
        skg.lineWidth = 120; skg.lineCap = 'round'; skg.lineJoin = 'round';
        skg.beginPath(); skg.moveTo(P[0][0], P[0][1]);
        for (let i = 1; i < P.length; i++) {
          if (eraser.cum[i] <= L) { skg.lineTo(P[i][0], P[i][1]); continue; }
          const u = (L - eraser.cum[i - 1]) / (eraser.cum[i] - eraser.cum[i - 1]);
          skg.lineTo(lerp(P[i - 1][0], P[i][0], u), lerp(P[i - 1][1], P[i][1], u));
          break;
        }
        skg.stroke();
        skg.globalCompositeOperation = 'source-over';
      }
    }
    const P = span(t, ...PRE.draw);
    if (P > 0) {
      const fp = span(P, .55, 1);
      if (fp > 0) for (const it of sketch.floor) paintItem(skg, it, fp, SK, scrolled, true);
      const pos = P * sketch.total;
      for (const it of sketch.items) {
        if (pos <= it.start) break;
        paintItem(skg, it, clamp01((pos - it.start) / it.len), SK, scrolled, false);
      }
    }
    skg.setTransform(1, 0, 0, 1, 0, 0);
    skTex.needsUpdate = true;
  }

  // ---- timeline ----
  const look = new THREE.Vector3();
  function frame(t) {
    // rise, one group after another
    const [r0, r1] = T.rise;
    for (const g of risers) {
      const o = g.userData.order, a = r0 + o * .55, k = easeOut(span(t, a, a + 1.4));
      g.visible = k > 0.001;
      if (g.userData.drop) { g.position.y = (1 - k) * 1.2; g.scale.y = 1; }
      else g.scale.y = Math.max(k, 0.001);
    }
    const f = ease(span(t, ...T.planFade));
    // the sketch hands over to the finished plan (with its labels and dimensions)
    const snap = ease(span(t, ...PRE.snap));
    skMesh.visible = snap < 1;
    if (skMesh.visible) drawOpening(t);
    skMat.opacity = 1 - snap;
    planMat.opacity = snap * (1 - f);
    if (tag) {
      const label = t < PRE.erase[0] + .3 ? 'Before · the contractor’s kitchen plan' : t < T.rise[0] ? 'After · our kitchen plan' : tagText;
      if (tag.textContent !== label) tag.textContent = label;
    }
    mat.floor.opacity = f;
    edgeMat.opacity = .9 - .7 * span(t, D + 5, D + 8);
    if (scene.background) scene.background.copy(paper).lerp(room, f);

    const c = ease(span(t, ...T.cam));
    camera.position.lerpVectors(TOP.pos, EYE.pos, c);
    camera.position.y = lerp(TOP.pos.y, EYE.pos.y, ease(span(t, T.cam[0] + .6, T.cam[1])));
    look.lerpVectors(TOP.look, EYE.look, c);
    camera.fov = lerp(TOP.fov, EYE.fov, c);
    camera.up.set(0, c > 0.02 ? 1 : 0, c > 0.02 ? 0 : -1);
    camera.lookAt(look);
    camera.updateProjectionMatrix();

const st = t < T.rise[0] + .8 ? 0 : t < T.photo[0] + .6 ? 1 : 2;
if (full || story) {
  // the rendering opens in a growing circle from the middle of the kitchen
  const k = ease(span(t, ...T.photo)), R = Math.hypot(Math.max(focus.x, focus.w - focus.x), Math.max(focus.y, focus.h - focus.y));
  photo.style.opacity = k > 0 ? 1 : 0;
  photo.style.clipPath = `circle(${(k * R).toFixed(1)}px at ${focus.x.toFixed(1)}px ${focus.y.toFixed(1)}px)`;
  marks.forEach((m, i) => { m.classList.toggle('on', i === st); m.classList.toggle('done', i < st); });
} else photo.style.opacity = Math.max(ease(span(t, ...T.photo)), wrapped ? 1 - ease(span(t, 0, .9)) : 0);
buttons.forEach((b, i) => b.setAttribute('aria-pressed', i === st ? 'true' : 'false'));
    renderer.render(scene, camera);
  }

  function size() {
    const w = stageEl.clientWidth, h = stageEl.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // keep the whole plan in view on narrow screens; in the reel, keep it above the caption
    TOP.pos.y = reel ? 13.6 : (hero ? 9.9 : 9.4) * Math.max(1, 1.25 / camera.aspect);
    const lift = reel ? .075 : hero && !scrolled ? .05 : 0;            // keep the plan clear of what's overlaid at the bottom
TOP.pos.z = TOP.look.z = 2.0 + lift * TOP.pos.y * 2 * Math.tan(17 * Math.PI / 180);
if (full) {
  // Free space beside the words (wide screens) or below them (phones). Centre the kitchen
  // there with a view offset, and size the plan to fit it.
  const sr = stageEl.getBoundingClientRect(), cr = copyEl.getBoundingClientRect();
  const wide = w > 900;
  const x0 = wide ? cr.right - sr.left + 16 : 0, y0 = wide ? 0 : cr.bottom - sr.top + 4;
  if (wide) {
    const x1 = w, y1 = h - 72;
    focus.x = (x0 + x1) / 2; focus.y = (y0 + y1) / 2; focus.w = w; focus.h = h;
    const fw = Math.max(.2, (x1 - x0) / w), fh = Math.max(.2, (y1 - y0) / h);
    const V = Math.max((860 / 150) / fh, (900 / 150) / (fw * camera.aspect)) * 1.02;
    TOP.pos.y = V / (2 * Math.tan(TOP.fov * Math.PI / 360));
    stageEl.style.setProperty('--k3d-top', '0px');
    camera.setViewOffset(w, h, -(focus.x - w / 2), -(focus.y - h / 2), w, h);
  } else {
    // phones: the canvas and the rendering fill only the space under the words
    const ch = Math.max(180, h - y0);
    stageEl.style.setProperty('--k3d-top', y0 + 'px');
    renderer.setSize(w, ch, false);
    camera.aspect = w / ch;
    camera.clearViewOffset();
    focus.x = w / 2; focus.y = ch / 2; focus.w = w; focus.h = ch;
    const V = Math.max(860 / 150, (900 / 150) / camera.aspect) * 1.04;
    TOP.pos.y = V / (2 * Math.tan(TOP.fov * Math.PI / 360));
  }
  TOP.pos.z = TOP.look.z = 2.0;
}
if (story) {
  // the kitchen fills its own sticky box beside (or above) the text
  camera.clearViewOffset();
  focus.x = w / 2; focus.y = h / 2; focus.w = w; focus.h = h;
  const V = Math.max(860 / 150, (900 / 150) / camera.aspect) * 1.03;
  TOP.pos.y = V / (2 * Math.tan(TOP.fov * Math.PI / 360));
  TOP.pos.z = TOP.look.z = 2.0;
}
frame(time);
  }

  let time = reduce ? STAGES[hero ? 2 : 0] : 0, playing = !reduce && !reel && !scrolled, visible = true, last = 0;
  function loop(now) {
    requestAnimationFrame(loop);
    if (!playing || !visible) { last = now; return; }
    const dt = Math.min(.05, (now - last) / 1000 || 0); last = now;
    time += dt;
    if (reel && time >= T.photo[1]) { time = T.photo[1]; playing = false; }
    if (time > T.end) { time = 0; wrapped = true; }
    frame(time);
  }
  function jump(t, keepPlaying = false) { time = t; wrapped = false; playing = keepPlaying && !reduce; frame(time); }

// Scroll mode: the page's scroll position is the timeline. The scroll range is the pinned
// hero on wide screens (.hero-pin is sticky) or the figure's own track on phones (figure is sticky).
const SCROLL_END = T.photo[1] + .4;
function scrollRange() {
  const pin = box.closest('.hero-pin'), section = box.closest('.hero-scroll'), track = box.closest('.k3d-track');
  let el, child;
  if (full && getComputedStyle(stageEl).position === 'sticky') { el = box; child = stageEl; }
  else if (pin && getComputedStyle(pin).position === 'sticky') { el = section; child = pin; }
  else if (getComputedStyle(box).position === 'sticky') { el = track; child = box; }
  else return null;
  const r = el.getBoundingClientRect(), top = parseFloat(getComputedStyle(child).top) || 0;
  return { start: top - r.top, len: Math.max(1, r.height - child.offsetHeight) };
}
// Story mode: the page scrolls normally. The text blocks (.story-step) pass the reading line
// (middle of the free part of the screen) and the kitchen follows them: the intro shows the plan,
// "01" holds the plan, "02" builds the 3D model, "03" opens the rendering.
const STEP_T = [.6, PRE.draw[0], D, D + 2.6, D + 5.6, D + 8.6, SCROLL_END]; // problem: the contractor’s plan; erased by "how we help"; ours drawn by 01; then 3D, eye level, rendering. One entry per .story-step.
const steps = [...box.querySelectorAll('.story-step')];
function fromStory() {
  const sr = stageEl.getBoundingClientRect();
  const stacked = sr.width > innerWidth * .8;                 // phones: the kitchen sits above the text
  const lineY = stacked ? sr.bottom + (innerHeight - sr.bottom) / 2 : innerHeight / 2;
  const d = steps.map(el => { const r = el.getBoundingClientRect(); return (r.top + r.height / 2) - lineY; });
  let t = STEP_T[STEP_T.length - 1];
  if (d[0] > 0) t = 0;
  else for (let k = 1; k < d.length; k++) {
    if (d[k] > 0) { t = lerp(STEP_T[k - 1], STEP_T[k], clamp01(-d[k - 1] / (d[k] - d[k - 1]))); break; }
  }
  time = t;
  steps.forEach((el, k) => el.classList.toggle('on', k === 0 || Math.abs(d[k]) < Math.max(160, innerHeight * .28)));
  frame(time);
}
function fromScroll() {
  if (story) return fromStory();
  const s = scrollRange();
  if (!s) { if (time !== STAGES[2]) { time = STAGES[2]; frame(time); } return; }
  time = clamp01(s.start / s.len) * SCROLL_END;
  frame(time);
}
if (scrolled) {
  let queued = false;
  const onScroll = () => { if (!queued) { queued = true; requestAnimationFrame(() => { queued = false; fromScroll(); }); } };
  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', onScroll);
  buttons.forEach((b, i) => b.addEventListener('click', () => {
    const s = scrollRange();
    if (!s) return jump(STAGES[i]);
    scrollTo({ top: scrollY + (STAGES[i] / SCROLL_END) * s.len - s.start, behavior: reduce ? 'auto' : 'smooth' });
  }));
} else buttons.forEach((b, i) => b.addEventListener('click', () => jump(STAGES[i])));
  replay?.addEventListener('click', () => { jump(0, true); });
  new IntersectionObserver(es => { visible = es[0].isIntersecting; }).observe(box);
  new ResizeObserver(size).observe(stageEl);
  box.classList.add('k3d-live');
  size();
  if (scrolled) fromScroll();
  requestAnimationFrame(loop);

  const api = { EYE, TOP, jump, sync: () => fromScroll(), play: () => jump(0, true), frame: () => frame(time), get time() { return time; } };
  window.__k3d = api;
  return api;
}

const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
for (const box of document.querySelectorAll('.k3d')) {
  if (!webglOK()) { box.classList.add('k3d-static'); continue; }
  if (box.classList.contains('k3d-reel')) {
    // In the reel: build on first show, replay from the plan every time the scene comes round.
    if (reduceMotion) continue;
    let ready = null;
    box.addEventListener('scene:show', () => {
      ready = ready || init(box).catch(e => { console.error('kitchen 3D:', e); return null; });
      ready.then(api => api && api.play());
    });
    if (box.classList.contains('active')) box.dispatchEvent(new Event('scene:show'));
  } else init(box).catch(e => console.error('kitchen 3D:', e));
}
