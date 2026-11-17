/* Jerusalem Heights: how two bedrooms became three, as one self-playing sequence (no buttons).
   1. The developer's plan.
   2. The walls that come out are rubbed away; the new walls are drawn in
      (both taken pixel by pixel from the demolition-and-construction plan, which is aligned with it).
   3. Our revised plan.
   4. The revised plan rises into a model: walls from its black walls, beds and closets from its
      coloured furniture, the kitchen from its drawn counters, in the colours of the styled pictures.
   5. The camera turns to the old kitchen, now the children's room, and the styled picture opens.
   It plays when it comes into view, holds at the end, and starts again. three.js loads on demand. */
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

// Timeline, seconds
const T = {
  erase: [1.8, 4.4], draw: [4.7, 6.9], revised: [7.6, 8.8],
  rise: [10.0, 12.6], cam: [9.8, 13.4], fly: [14.2, 16.6], photo: [16.8, 18.2], end: 24
};
const STEPS = [
  [0, 'Developer’s plan', 'The kitchen has its own room off the living area.'],
  [T.erase[0], 'Demolition and new walls', 'The kitchen walls come out and new walls go in.'],
  [T.revised[0], 'Our revised plan', 'The kitchen moves into the open living area.'],
  [T.rise[0], '3D model', 'Three bedrooms, with the kitchen facing the dining table.'],
  [T.photo[0], 'The finished room', 'The old kitchen is now the children’s room.']
];
// the old kitchen / children's room on the plan, px
const KIDS = { x0: 968, y0: 442, x1: 1192, y1: 806 };

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

// connected parts of a mask (8-neighbours, with a small reach so dashes and hatching hold together)
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

// Steps 1-2: which pixels change between the developer's plan and the construction plan, and when.
function changes(O, C) {
  const o = O.data, c = C.data, mask = new Uint8Array(W * H);
  for (let p = 0; p < W * H; p++) {
    const i = p * 4;
    if (Math.abs(o[i] - c[i]) + Math.abs(o[i + 1] - c[i + 1]) + Math.abs(o[i + 2] - c[i + 2]) > 40) mask[p] = 1;
  }
  const all = parts(mask, 3, 30);
  const erase = [], draw = [];
  for (const pt of all) {
    let lo = 0, lc = 0;
    for (const p of pt.px) { lo += lum(o, p * 4); lc += lum(c, p * 4); }
    (lo < lc ? erase : draw).push(pt);
  }
  const order = (a, b) => (a.y0 + a.x0 * .3) - (b.y0 + b.x0 * .3);
  erase.sort(order); draw.sort(order);
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
  let x0 = W, y0 = H, x1 = 0, y1 = 0;
  for (const pt of all) { x0 = Math.min(x0, pt.x0); y0 = Math.min(y0, pt.y0); x1 = Math.max(x1, pt.x1); y1 = Math.max(y1, pt.y1); }
  return { list, rect: [x0, y0, x1 - x0 + 1, y1 - y0 + 1] };
}

// Step 4: the model, read from the revised plan.
function readModel(R) {
  const d = R.data;
  // walls: 5 px cells that are mostly black, merged into runs along each row
  const S = 5, cw = Math.floor(W / S), ch = Math.floor(H / S), runs = [];
  for (let cy = 0; cy < ch; cy++) {
    let run = -1;
    for (let cx = 0; cx <= cw; cx++) {
      let wall = false;
      if (cx < cw) {
        let n = 0;
        for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) if (lum(d, ((cy * S + y) * W + cx * S + x) * 4) < 70) n++;
        wall = n >= S * S * .7;
      }
      if (wall && run < 0) run = cx;
      if (!wall && run >= 0) { runs.push([run * S, cy * S, (cx - run) * S, S]); run = -1; }
    }
  }
  const near = (i, r, g, b, tol) => Math.abs(d[i] - r) < tol && Math.abs(d[i + 1] - g) < tol && Math.abs(d[i + 2] - b) < tol;
  const bedM = new Uint8Array(W * H), closetM = new Uint8Array(W * H);
  for (let p = 0; p < W * H; p++) {
    const i = p * 4;
    if (near(i, 232, 210, 190, 14)) bedM[p] = 1;
    else if (d[i + 1] > d[i] && d[i + 1] - d[i + 2] >= 6 && d[i] > 190 && d[i] < 240) closetM[p] = 1;
  }
  const rect = pt => [pt.x0, pt.y0, pt.x1 - pt.x0 + 1, pt.y1 - pt.y0 + 1];
  return {
    runs,
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
  const photo = box.querySelector('.jh-photo');

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
    const k = ease(span(t, ...T.revised));
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

  // walls: white plaster, with the plan's black poche on top
  const unit = new THREE.BoxGeometry(1, 1, 1); unit.translate(0, .5, 0);
  const WALL = h(260);
  const walls = new THREE.InstancedMesh(unit, new THREE.MeshStandardMaterial({ color: 0xf3efe8, roughness: .9 }), model.runs.length);
  const caps = new THREE.InstancedMesh(unit, new THREE.MeshStandardMaterial({ color: 0x2a2825, roughness: .8 }), model.runs.length);
  const m4 = new THREE.Matrix4();
  model.runs.forEach(([x, y, w, d], i) => {
    m4.makeScale(w / U, WALL, d / U).setPosition(wx(x + w / 2), 0, wz(y + d / 2)); walls.setMatrixAt(i, m4);
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
    mesh.castShadow = mesh.receiveShadow = true; furn.add(mesh); return mesh;
  };
  const linen = mat(0xeee6d8), oak = mat(0xc49a6c), sage = mat(0xa7b39b), white = mat(0xf6f4ef), rust = mat(0xa8583a), stone = mat(0xe9e5dd), dark = mat(0x3a3733);
  const inKids = ([x, y, w, d]) => x >= KIDS.x0 - 10 && x + w <= KIDS.x1 + 10 && y >= KIDS.y0 - 10 && y + d <= KIDS.y1 + 10;
  for (const r of model.beds) {
    if (inKids(r)) {                                      // the bunk bed: white frame, sage and rust bedding
      piece(...r, h(30), white); piece(r[0] + 6, r[1] + 6, r[2] - 12, r[3] - 12, h(20), sage, h(30));
      piece(...r, h(14), white, h(140)); piece(r[0] + 6, r[1] + 6, r[2] - 12, r[3] - 12, h(16), rust, h(154));
    } else {
      piece(...r, h(32), stone); piece(r[0] + 4, r[1] + 4, r[2] - 8, r[3] - 8, h(22), linen, h(32));
    }
  }
  for (const r of model.closets) piece(...r, h(225), oak);
  // the kitchen, from the counters drawn on the revised plan: back counter, return, and the peninsula
  const counters = [[723, 460, 233, 66], [891, 526, 65, 77], [723, 603, 237, 97]];
  for (const r of counters) { piece(...r, h(86), white); piece(...r, h(4), stone, h(86)); }
  for (const x of [760, 823]) piece(x, 707, 38, 38, h(66), dark);   // two stools at the peninsula

  // ---- camera path: straight down on the plan, then a bird's-eye view, then the old kitchen
  const fit = () => { const a = camera.aspect; return Math.max(H / U, (W / U) / a) * .5 / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * 1.06; };
  const kidsC = new THREE.Vector3(wx((KIDS.x0 + KIDS.x1) / 2), 0, wz((KIDS.y0 + KIDS.y1) / 2));
  const posA = new THREE.Vector3(), posB = new THREE.Vector3(), posC = new THREE.Vector3(), look = new THREE.Vector3(), lookC = kidsC.clone().setY(h(60));
  function cameraAt(t) {
    const dist = fit();
    posA.set(0, dist, .001);
    posB.set(-dist * .52, dist * .98, dist * .86);
    posC.copy(kidsC).add(new THREE.Vector3(-2.2, 11.5, 6.4));   // high above, looking down into the room
    const k = ease(span(t, ...T.cam)), f = ease(span(t, ...T.fly));
    camera.position.lerpVectors(posA, posB, k).lerp(posC, f);
    look.set(-.9 * k, 0, .5 * k).lerp(lookC, f);
    camera.lookAt(look);
  }
  const shot = new THREE.Vector3();
  function kidsOnScreen() {
    shot.copy(kidsC).setY(h(80)).project(camera);
    return [(shot.x * .5 + .5) * 100, (-shot.y * .5 + .5) * 100];
  }

  // ---- frame
  let stepNow = -1;
  function frame(t) {
    if (sheetAt(t)) tex.needsUpdate = true;
    const r = easeOut(span(t, ...T.rise));
    floor.material.emissiveIntensity = lerp(.9, .32, ease(span(t, ...T.cam)));   // white paper while flat, lit floor once built
    built.visible = r > 0; built.scale.y = Math.max(r, .001);
    furn.children.forEach((m, i) => {
      const k = easeOut(span(t, T.rise[0] + .6 + i * .05, T.rise[1] + .4 + i * .05));
      m.visible = k > 0; m.scale.y = m.userData.h ??= m.scale.y; m.scale.y = m.userData.h * Math.max(k, .001);
      m.position.y = (m.userData.y ??= m.position.y) * k;
    });
    cameraAt(t);
    const p = easeOut(span(t, ...T.photo)), back = span(t, T.end - .9, T.end);
    if (p > 0) {
      const [cx, cy] = kidsOnScreen();
      photo.style.clipPath = `circle(${(p * 120).toFixed(2)}% at ${cx.toFixed(1)}% ${cy.toFixed(1)}%)`;
      photo.style.opacity = (1 - back).toFixed(3);
    } else { photo.style.clipPath = 'circle(0% at 50% 50%)'; photo.style.opacity = '1'; }
    renderer.domElement.style.opacity = t > T.end - .9 ? (1 - back).toFixed(3) : '1';
    if (legend) legend.classList.toggle('on', t >= T.erase[0] - .3 && t < T.revised[1]);
    let s = 0; for (let i = 0; i < STEPS.length; i++) if (t >= STEPS[i][0]) s = i;
    if (s !== stepNow) {
      stepNow = s;
      const b = document.createElement('b'); b.textContent = `${s + 1}/${STEPS.length}`;
      stepEl.replaceChildren(b, ' ' + STEPS[s][1]);
      noteEl.textContent = STEPS[s][2];
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
  window.__jh = { jump: t => { time = t; frame(t); }, model };
}
