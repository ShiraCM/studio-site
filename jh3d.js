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
  { name: 'Kitchen and dining', note: 'The new kitchen faces the dining table.', img: 'img/jh-styled-dining.jpg', r: [560, 440, 960, 940] },
  { name: 'Children’s room', note: 'This room was the kitchen.', img: 'img/jh-styled-kids.jpg', r: [968, 442, 1192, 806] },
  { name: 'Main bedroom', note: 'Closets along the wall it shares with the kitchen.', img: 'img/jh-styled-bedroom.jpg', r: [216, 442, 529, 789] },
  { name: 'Second bedroom', note: 'The safe room, set up as a bedroom.', img: 'img/jh-styled-bedroom2.jpg', r: [60, 60, 380, 402] }
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
  [T.rise[0], '3/3', '3D model', 'Three bedrooms, with the kitchen open to the living area.'],
  ...ROOMS.map((rm, i) => [leg(i).fly[0] + 1.2, '', rm.name, rm.note]),
  [T.back[0], '3/3', '3D model', 'Three bedrooms, with the kitchen open to the living area.']
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
function changes(O, C) {
  const o = O.data, c = C.data, er = new Uint8Array(W * H), dr = new Uint8Array(W * H);
  for (let p = 0; p < W * H; p++) {
    const i = p * 4;
    if (Math.abs(o[i] - c[i]) + Math.abs(o[i + 1] - c[i + 1]) + Math.abs(o[i + 2] - c[i + 2]) <= 40) continue;
    (lum(c, i) > lum(o, i) ? er : dr)[p] = 1;
  }
  const order = (a, b) => (a.y0 + a.x0 * .3) - (b.y0 + b.x0 * .3);
  const erase = parts(er, 3, 30).sort(order), draw = parts(dr, 3, 30).sort(order);
  const list = [];                         // [pixel, time]
  const schedule = (group, [a, b], jitter) => {
    const n = group.length; if (!n) return;
    const slot = (b - a) / n;
    group.forEach((pt, k) => {
      const horiz = pt.x1 - pt.x0 >= pt.y1 - pt.y0;
      const len = Math.max(1, horiz ? pt.x1 - pt.x0 : pt.y1 - pt.y0);
      for (const p of pt.px) {
        const x = p % W, y = (p / W) | 0;
        const f = (horiz ? x - pt.x0 : y - pt.y0) / len;
        list.push([p, a + slot * k + slot * .9 * clamp01(f * (1 - jitter) + Math.random() * jitter)]);
      }
    });
  };
  schedule(erase, T.erase, .35);           // the eraser rubs: rough, back and forth
  schedule(draw, T.draw, 0);               // the pen draws: clean, end to end
  list.sort((a, b) => a[1] - b[1]);
  return { list };
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
    beds: parts(bedM, 3, 400).map(rect),
    closets: parts(closetM, 3, 400).map(rect)
  };
}

async function start() {
  THREE = await import('./vendor/three.module.min.js');
  const view = box.querySelector('.jh-view');
  const fallback = box.querySelector('.jh-fallback');
  if (fallback) fallback.src = 'img/plan-jh-original-no-ac.webp';   // while it gets ready, show where it starts
  const stepEl = box.querySelector('.jh-tag .k3d-tag-step');
  const noteEl = box.querySelector('.jh-tag-note');
  const legend = box.querySelector('.jh-legend');
  // one picture per room, stacked over the model
  const tpl = box.querySelector('.jh-photo');
  const photos = ROOMS.map((rm, i) => {
    const el = i ? tpl.cloneNode() : tpl;
    el.src = rm.img; el.loading = 'eager';
    if (i) view.append(el);
    return el;
  });

  const [io, ic, ir] = await Promise.all(['img/plan-jh-original-no-ac.webp', 'img/plan-jh-changes-construction-wall.webp', 'img/plan-jh-revised-no-ac.webp'].map(load));
  const O = pixels(io), C = pixels(ic), R = pixels(ir);
  const ch = changes(O, C);
  const model = readModel(R);

  // the drawing sheet: one canvas, used as the floor texture throughout
  const sheet = document.createElement('canvas'); sheet.width = W; sheet.height = H;
  const sg = sheet.getContext('2d');
  const cur = new ImageData(new Uint8ClampedArray(O.data), W, H);
  const revisedImg = document.createElement('canvas'); revisedImg.width = W; revisedImg.height = H;
  revisedImg.getContext('2d').putImageData(R, 0, 0);
  let done = 0;                             // how many changed pixels are already swapped in
  function sheetAt(t) {
    if (t < (ch.list[done - 1] || [0, -1])[1]) { cur.data.set(O.data); done = 0; }   // loop back
    let moved = false;
    while (done < ch.list.length && ch.list[done][1] <= t) {
      const p = ch.list[done][0] * 4;
      cur.data[p] = C.data[p]; cur.data[p + 1] = C.data[p + 1]; cur.data[p + 2] = C.data[p + 2];
      done++; moved = true;
    }
    const k = ease(span(t, ...T.floor));
    if (moved || t < 1 || k > 0 && k < 1 || sheetAt.k !== k) {
      sg.putImageData(cur, 0, 0);
      if (k > 0) { sg.globalAlpha = k; sg.drawImage(revisedImg, 0, 0); sg.globalAlpha = 1; }
      sheetAt.k = k;
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

  const tex = new THREE.CanvasTexture(sheet);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(W / U, H / U), new THREE.MeshStandardMaterial({ map: tex, roughness: .95, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: .9 }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true;
  scene.add(floor);

  // walls: white plaster, with the plan's black poche on top; a beam over every window
  const unit = new THREE.BoxGeometry(1, 1, 1); unit.translate(0, .5, 0);
  const WALL = h(260), HEAD = h(215);
  const plaster = new THREE.MeshStandardMaterial({ color: 0xf3efe8, roughness: .9 });
  const poche = new THREE.MeshStandardMaterial({ color: 0x2a2825, roughness: .8 });
  const blocks = [...model.runs.map(r => [r, 0, WALL]), ...model.beams.map(r => [r, HEAD, WALL])];
  const walls = new THREE.InstancedMesh(unit, plaster, blocks.length);
  const caps = new THREE.InstancedMesh(unit, poche, blocks.length);
  const m4 = new THREE.Matrix4();
  blocks.forEach(([[x, y, w, d], y0, y1], i) => {
    m4.makeScale(w / U, y1 - y0, d / U).setPosition(wx(x + w / 2), y0, wz(y + d / 2)); walls.setMatrixAt(i, m4);
    m4.makeScale(w / U, .012, d / U).setPosition(wx(x + w / 2), WALL, wz(y + d / 2)); caps.setMatrixAt(i, m4);
  });
  walls.castShadow = walls.receiveShadow = true;
  const built = new THREE.Group(); built.add(walls, caps); scene.add(built);

  // furniture, in the colours of the styled pictures
  const furn = new THREE.Group(); scene.add(furn);
  const mat = c => new THREE.MeshStandardMaterial({ color: c, roughness: .85 });
  const piece = (x, y, w, d, hgt, m, lift = 0) => {
    const mesh = new THREE.Mesh(unit, m);
    mesh.scale.set(w / U, hgt, d / U); mesh.position.set(wx(x + w / 2), lift, wz(y + d / 2));
    mesh.castShadow = mesh.receiveShadow = true;
    mesh.userData = { h: hgt, y: lift };
    furn.add(mesh); return mesh;
  };
  const linen = mat(0xeee6d8), oak = mat(0xc49a6c), sage = mat(0xa7b39b), white = mat(0xf6f4ef), rust = mat(0xa8583a), stone = mat(0xe9e5dd), dark = mat(0x3a3733);
  const steel = new THREE.MeshStandardMaterial({ color: 0xc9cbcc, roughness: .35, metalness: .6 });
  const kids = ROOMS[1].r;
  const inKids = ([x, y, w, d]) => x >= kids[0] - 10 && x + w <= kids[2] + 10 && y >= kids[1] - 10 && y + d <= kids[3] + 10;
  for (const r of model.beds) {
    if (inKids(r)) {                                      // the bunk bed: white frame, sage and rust bedding
      piece(...r, h(30), white); piece(r[0] + 6, r[1] + 6, r[2] - 12, r[3] - 12, h(20), sage, h(30));
      piece(...r, h(14), white, h(140)); piece(r[0] + 6, r[1] + 6, r[2] - 12, r[3] - 12, h(16), rust, h(154));
    } else {
      piece(...r, h(32), stone); piece(r[0] + 4, r[1] + 4, r[2] - 8, r[3] - 8, h(22), linen, h(32));
    }
  }
  for (const r of model.closets) piece(...r, h(250), oak);              // built-in, almost to the ceiling
  // the bedroom side of the new kitchen: a thin partition, then the pantry and the fridge (from the plan)
  piece(555, 443, 10, 147, h(260), white);
  piece(565, 443, 64, 72, h(250), white);                              // pantry
  piece(565, 515, 64, 72, h(185), steel);                              // fridge
  piece(565, 515, 64, 72, h(65), white, h(185));                       // cupboard over the fridge
  // the kitchen, from the counters drawn on the revised plan: back counter, return, and the peninsula
  const counters = [[723, 460, 233, 66], [891, 526, 65, 77], [723, 603, 237, 97]];
  for (const r of counters) { piece(...r, h(86), white); piece(...r, h(4), stone, h(86)); }
  for (const x of [760, 823]) piece(x, 707, 38, 38, h(66), dark);   // two stools at the peninsula

  // ---- camera: straight down on the plan, a bird's-eye view, then each room in turn
  const fit = () => { const a = camera.aspect; return Math.max(H / U, (W / U) / a) * .5 / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * 1.06; };
  const DIR = new THREE.Vector3(-.08, .94, .34).normalize();   // steep, so the near walls do not hide the room
  const roomPose = ROOMS.map(rm => {
    const [x0, y0, x1, y1] = rm.r;
    const c = new THREE.Vector3(wx((x0 + x1) / 2), h(60), wz((y0 + y1) / 2));
    const ext = Math.max(x1 - x0, y1 - y0) / U;
    return { pos: c.clone().addScaledVector(DIR, ext * 4.6 + 2), look: c, mid: c.clone().setY(h(90)) };
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
    furn.children.forEach((m, i) => {
      const k = easeOut(span(t, T.rise[0] + .6 + i * .05, T.rise[1] + .4 + i * .05));
      m.visible = k > 0;
      m.scale.y = m.userData.h * Math.max(k, .001);
      m.position.y = m.userData.y * k;
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
