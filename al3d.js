/* Expanded living space: the plan animation, then the apartment as a furnished 3D model, then a tour.
   1-2. The developer's plan and the demolition / new walls: the same drawing as al-plan.js
        (window.AL_PLAN), painted onto the model's floor.
   3.   The drawing rises into a model built from the same wall rectangles (KEEP + NEW), with a beam over
        every window and doorway, glass in the windows and oak door frames. Each room is furnished after
        its picture: the kitchen, dining, primary bedroom, en-suite, main bathroom and safe room from the
        owner's photos and styled pictures; the laundry room from her SketchUp sketches; the second bedroom
        after the twin-bed picture (model only, no picture in the tour).
   4.   A tour: the camera goes to each room; where there is a picture, it opens in a circle out of the room.
   It plays when it comes into view and loops. three.js loads on demand. Plan px are the 2000 × 1500
   drawings; about 1.16 plan px per cm (the laundry room, 1.53 × 1.83 m, is 178 × 212 px). */
let THREE;

const W = 2000, H = 1500;
const U = 100;                            // plan px per world unit
const PXCM = 1.16;                        // plan px per cm
const h = cm => cm * PXCM / U;            // cm -> world height
const wx = px => (px - W / 2) / U, wz = py => (py - H / 2) / U;

const clamp01 = v => Math.min(1, Math.max(0, v));
const span = (t, a, b) => clamp01((t - a) / (b - a));
const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const easeOut = t => 1 - Math.pow(1 - t, 3);
const lerp = (a, b, t) => a + (b - a) * t;

// Rooms for the tour, plan px [x0, y0, x1, y1], in the order the camera visits them
const ROOMS = [
  { key: 'kitchen', name: 'Kitchen', note: 'Open to the living and dining area, with a stone island at its center.', img: 'img/al-kitchen.jpg', r: [64, 608, 430, 1134], dir: [.5, .85, .14] },   // seen from the living area, looking west, as in its picture,
  { key: 'dining', name: 'Dining', note: 'Set where the developer’s third bedroom once stood, now part of one open living space.', img: 'img/al-dining-living.jpg', r: [906, 740, 1314, 1134] },
  { key: 'bedroom', name: 'Bedroom', note: 'Two single beds, with built-in closets.', r: [1322, 740, 1716, 1134] },
  { key: 'ensuite', name: 'En-suite', note: 'In its original place, now reached directly from the primary bedroom along an open, unhurried route, planned with aging in place in mind.', img: 'img/al-bath-ensuite.webp', r: [1726, 752, 1952, 1134], zoom: 1.15 },
  { key: 'primary', name: 'Primary bedroom', note: 'A full wall of built-in closets and generous clearances, with a comfortable, direct approach to the en-suite.', img: 'img/al-primary-bedroom.jpg', r: [1598, 266, 1952, 740] },
  { key: 'bath', name: 'Main bathroom', note: 'With the washer moved to a laundry room of its own, a long vanity and a full bath.', img: 'img/al-bath-main.webp', r: [1324, 366, 1586, 578], zoom: 1.15 },
  { key: 'laundry', name: 'Laundry room', note: 'Once the guest toilet: the washer and dryer side by side, with storage above.', r: [1136, 366, 1314, 578], zoom: 1.4, dir: [-.42, .9, .12] },   // seen from the west, so the machines' fronts show
  { key: 'safe', name: 'Safe room', note: 'The reinforced safe room, furnished as a child’s bedroom with a trundle bed and closets built around it.', img: 'img/al-safe-room.jpg', r: [696, 94, 1102, 436] }
];

// Timeline, seconds. The drawing (al-plan.js) runs to 7.6; the model rises after a short hold.
const T = { rise: [8.8, 11.4], floor: [8.8, 10.6], cam: [8.6, 12.2] };
const TOUR = 12.8;
const LEGS = [];
{ let a = TOUR; for (const rm of ROOMS) { const d = rm.img ? 7.2 : 4.6; LEGS.push({ fly: [a, a + 2.2], open: [a + 2.4, a + 3.6], close: [a + d - 1.0, a + d - .2] }); a += d; } T.back = [a + .2, a + 2.4]; }
T.end = T.back[1] + 1.6;

const box = document.querySelector('.al-anim[data-three]');
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
function webglOK() {
  try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch { return false; }
}
if (box && webglOK()) {
  const io = new IntersectionObserver(es => {
    if (es.some(e => e.isIntersecting)) { io.disconnect(); start().catch(err => console.error(err)); }
  }, { rootMargin: '200px' });
  io.observe(box);
}

async function start() {
  const P = window.AL_PLAN;
  if (!P) return;
  THREE = await import('./vendor/three.module.min.js');
  if (document.fonts) await document.fonts.ready;
  const view = box.querySelector('.jh-view');
  const stepEl = box.querySelector('.k3d-tag-step'), noteEl = box.querySelector('.jh-tag-note');
  const STEPS = [
    P.STEPS[0], P.STEPS[1],
    [T.rise[0], '3/3', '3D model', 'Turn it or move it, and tap a room to see it finished.']
  ];
  // ---- the drawing sheet (floor texture): the plan animation, then the finished floors
  const sheet = document.createElement('canvas'); sheet.width = W; sheet.height = H;
  const sg = sheet.getContext('2d');
  const paperBase = P.paper();
  const finished = document.createElement('canvas'); finished.width = W; finished.height = H;
  {
    const g = finished.getContext('2d');
    let s = 11; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
    g.fillStyle = '#c8a27a'; g.fillRect(0, 0, W, H);                       // oak planks, laid east to west
    for (let y = 0; y < H; y += 22) {
      let x = -rnd() * 300;
      while (x < W) {
        const len = 180 + rnd() * 160, tone = 196 + rnd() * 26;
        g.fillStyle = `rgb(${tone},${tone * .81 | 0},${tone * .61 | 0})`; g.fillRect(x, y, len, 21);
        g.globalAlpha = .07; g.fillStyle = '#5a3a1e';
        for (let k = 0; k < 4; k++) g.fillRect(x, y + rnd() * 20, len, .8);
        g.globalAlpha = 1; g.fillStyle = 'rgba(80,55,30,.35)'; g.fillRect(x + len - 1, y, 1, 21);
        x += len;
      }
      g.fillStyle = 'rgba(80,55,30,.3)'; g.fillRect(0, y + 21, W, 1);
    }
    const tiles = ([x, y, w, d], c, step) => {
      g.fillStyle = c; g.fillRect(x, y, w, d);
      g.strokeStyle = 'rgba(0,0,0,.12)'; g.lineWidth = 1.5; g.beginPath();
      for (let k = x; k <= x + w; k += step) { g.moveTo(k, y); g.lineTo(k, y + d); }
      for (let k = y; k <= y + d; k += step) { g.moveTo(x, k); g.lineTo(x + w, k); }
      g.stroke();
    };
    tiles([1316, 360, 276, 224], '#6b655c', 70);                           // main bathroom: dark stone
    tiles([1720, 746, 236, 392], '#d4c7b1', 70);                           // en-suite: warm beige stone
    tiles([1130, 360, 190, 224], '#d9d6cf', 52);                           // laundry room: pale porcelain
    tiles(P.BALCONY, '#cfc6b8', 66);                                       // balcony
    g.fillStyle = PAPER_OUT; g.fillRect(0, 1172, 454, H); g.fillRect(1240, 1172, W, H);   // outside the apartment
    g.fillRect(0, 0, W, 70); g.fillRect(0, 0, 38, H); g.fillRect(1988, 0, 12, H);
    for (const r of [[38, 70, 418, 514], [456, 70, 218, 262], [1152, 70, 408, 260], [1560, 70, 440, 166]]) g.fillRect(...r);
    g.globalAlpha = .15; g.globalCompositeOperation = 'multiply'; g.drawImage(paperBase, 0, 0); g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;   // the walls' footprint, no room names
  }
  let sheetKey = '';
  function sheetAt(t) {
    const tp = Math.min(t, P.T.wallIn[1] + .9);
    const phase = t < P.T.wallOut[0] - .1 ? 'a' : t < P.T.wallIn[1] + .9 ? tp.toFixed(2) : 'b';
    const f = ease(span(t, ...T.floor));
    const key = phase + '|' + f.toFixed(3);
    if (key === sheetKey) return false;
    sheetKey = key;
    P.paint(sg, paperBase, tp);
    if (f > 0) { sg.globalAlpha = f; sg.drawImage(finished, 0, 0); sg.globalAlpha = 1; }
    return true;
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
  const camera = new THREE.PerspectiveCamera(30, 4 / 3, .1, 200);
  scene.add(new THREE.HemisphereLight(0xfffaf2, 0xd9d2c6, 1.6));
  const sun = new THREE.DirectionalLight(0xfff1de, 2.2);
  sun.position.set(-6, 14, 10);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -11, right: 11, top: 9, bottom: -9, near: 1, far: 40 });
  sun.shadow.bias = -.0004; sun.shadow.radius = 4;
  scene.add(sun);
  const fill = new THREE.DirectionalLight(0xf1f3f5, 1.1); fill.position.set(9, 9, -7); scene.add(fill);

  const tex = new THREE.CanvasTexture(sheet);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(W / U, H / U), new THREE.MeshStandardMaterial({ map: tex, roughness: .9, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: .9 }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true;
  scene.add(floor);

  // ---- walls: the drawing's own rectangles, white plaster with the plan's dark poche on top
  const unit = new THREE.BoxGeometry(1, 1, 1); unit.translate(0, .5, 0);
  const WALL = h(260), HEAD = h(212);
  const plaster = new THREE.MeshStandardMaterial({ color: 0xf3efe8, roughness: .9 });
  const poche = new THREE.MeshStandardMaterial({ color: 0x2a2825, roughness: .8 });
  const SILLS = [90, 130, 110, 60, 150, 100, 100, 0, 60, 90];              // cm, in the order of AL_PLAN.WINDOWS
  const WINDOWS = P.WINDOWS.map((r, i) => [...r, SILLS[i] ?? 90]);
  const DOORS = [
    [454, 370, 24, 126],      // front door
    [1000, 436, 102, 24],     // safe room
    [1148, 578, 82, 14],      // laundry room
    [1400, 580, 80, 12],      // main bathroom
    [1206, 720, 94, 20],      // hall to the dining area
    [1396, 722, 82, 18],      // second bedroom (beside the new short wall for its closet)
    [1762, 740, 108, 12],     // en-suite, from the primary bedroom
    [1502, 621, 12, 107]      // into the primary bedroom from the hall (90 cm)
  ];
  const blocks = [...P.KEEP, ...P.NEW].map(r => [r, 0, WALL]).concat([...WINDOWS, ...DOORS].map(([x, y, w, d]) => [[x, y, w, d], HEAD, WALL]));
  const built = new THREE.Group(); scene.add(built);
  const walls = new THREE.InstancedMesh(unit, plaster, blocks.length);
  const caps = new THREE.InstancedMesh(unit, poche, blocks.length);
  const m4 = new THREE.Matrix4();
  blocks.forEach(([[x, y, w, d], y0, y1], i) => {
    m4.makeScale(w / U, y1 - y0, d / U).setPosition(wx(x + w / 2), y0, wz(y + d / 2)); walls.setMatrixAt(i, m4);
    m4.makeScale(w / U, .012, d / U).setPosition(wx(x + w / 2), WALL, wz(y + d / 2)); caps.setMatrixAt(i, m4);
  });
  walls.castShadow = walls.receiveShadow = true;
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x4a4d50, roughness: .45, metalness: .4 });
  const glassMat = new THREE.MeshStandardMaterial({ color: 0xcfdfe4, roughness: .05, metalness: .1, transparent: true, opacity: .35 });
  const winGroup = new THREE.Group();
  const slab = (x, y, w, d, y0, y1, m, grp = winGroup) => {
    const mesh = new THREE.Mesh(unit, m);
    mesh.scale.set(w / U, y1 - y0, d / U); mesh.position.set(wx(x + w / 2), y0, wz(y + d / 2));
    mesh.castShadow = m !== glassMat; mesh.receiveShadow = true; grp.add(mesh); return mesh;
  };
  for (const [x, y, w, d, sillcm] of WINDOWS) {
    const horiz = w >= d, long = Math.max(w, d), sill = h(Math.max(2, sillcm));
    if (sill > h(5)) slab(x, y, w, d, 0, sill, plaster);
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
  const jambMat = new THREE.MeshStandardMaterial({ color: 0xd9c3a2, roughness: .6 });
  for (const [x, y, w, d] of DOORS) {
    const horiz = w >= d, DH = h(212), T2 = 3;
    if (horiz) { slab(x, y - 1, T2, d + 2, 0, DH, jambMat); slab(x + w - T2, y - 1, T2, d + 2, 0, DH, jambMat); slab(x, y - 1, w, d + 2, DH - h(4), DH, jambMat); }
    else { slab(x - 1, y, w + 2, T2, 0, DH, jambMat); slab(x - 1, y + d - T2, w + 2, T2, 0, DH, jambMat); slab(x - 1, y, w + 2, d, DH - h(4), DH, jambMat); }
  }
  built.add(walls, caps, winGroup);

  // ---- materials
  function rbox(w, hh, d, r = .015) {
    r = Math.max(.001, Math.min(r, w / 2 - .001, d / 2 - .001, hh / 2 - .001));
    const x = w / 2 - r, z = d / 2 - r, s = new THREE.Shape();
    s.moveTo(-x, -z); s.lineTo(x, -z); s.lineTo(x, z); s.lineTo(-x, z); s.lineTo(-x, -z);
    const g = new THREE.ExtrudeGeometry(s, { depth: Math.max(.001, hh - 2 * r), bevelEnabled: true, bevelSize: r, bevelThickness: r, bevelSegments: 3, curveSegments: 4 });
    g.rotateX(-Math.PI / 2); g.translate(0, r, 0);
    return g;
  }
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
  const weave = (base, rep = 3) => canvasTex(128, 128, (g, w, hh) => {
    g.fillStyle = base; g.fillRect(0, 0, w, hh);
    for (let i = 0; i < 1400; i++) { g.fillStyle = seeded() < .5 ? '#000' : '#fff'; g.globalAlpha = .035; g.fillRect(seeded() * w, seeded() * hh, 2, 1); }
  }, [rep, rep]);
  const boucle = base => canvasTex(128, 128, (g, w, hh) => {
    g.fillStyle = base; g.fillRect(0, 0, w, hh);
    for (let i = 0; i < 900; i++) { g.strokeStyle = seeded() < .5 ? 'rgba(0,0,0,.07)' : 'rgba(255,255,255,.25)'; g.lineWidth = 1; g.beginPath(); g.arc(seeded() * w, seeded() * hh, 1.2 + seeded() * 1.5, 0, 6.3); g.stroke(); }
  }, [4, 4]);
  const stoneTex = (base, vein) => canvasTex(256, 256, (g, w, hh) => {
    g.fillStyle = base; g.fillRect(0, 0, w, hh);
    for (let i = 0; i < 9; i++) { g.strokeStyle = vein; g.globalAlpha = .15 + seeded() * .2; g.lineWidth = .8; g.beginPath(); let x = seeded() * w, y = 0; g.moveTo(x, y); while (y < hh) { x += seeded() * 30 - 15; y += 18; g.lineTo(x, y); } g.stroke(); }
  });
  const slats = canvasTex(256, 64, (g, w, hh) => {
    g.fillStyle = '#c29468'; g.fillRect(0, 0, w, hh);
    for (let x = 0; x < w; x += 8) { g.fillStyle = '#7d5a3a'; g.globalAlpha = .55; g.fillRect(x, 0, 2, hh); g.globalAlpha = .12; g.fillStyle = '#fff'; g.fillRect(x + 3, 0, 2, hh); }
  }, [3, 1]);
  const spines = base => canvasTex(64, 64, (g, w, hh) => {
    g.fillStyle = base; g.fillRect(0, 0, w, hh);
    for (let x = 0; x < w; x += 8) { g.fillStyle = 'rgba(0,0,0,.45)'; g.fillRect(x, 0, 1, hh); g.fillStyle = 'rgba(255,255,255,.07)'; g.fillRect(x + 2, 0, 2, hh); }
    g.fillStyle = '#b8954f'; g.fillRect(0, 10, w, 3); g.fillRect(0, 48, w, 3);
    g.fillStyle = 'rgba(200,165,90,.5)'; for (let x = 3; x < w; x += 8) g.fillRect(x, 26, 2, 6);
  }, [3, 1]);
  const wallpaper = canvasTex(128, 128, (g, w, hh) => {   // safe room: a small tone-on-tone botanical print
    g.fillStyle = '#f2ebdf'; g.fillRect(0, 0, w, hh);
    g.strokeStyle = 'rgba(150,128,100,.55)'; g.lineWidth = 1;
    for (let i = 0; i < 22; i++) { const x = seeded() * w, y = seeded() * hh; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + 4, y - 8, x + 2, y - 16); g.stroke(); for (let k = 0; k < 3; k++) { g.beginPath(); g.ellipse(x + 2 + (k % 2 ? 4 : -3), y - 4 - k * 5, 2.4, 1.2, k % 2 ? .6 : -.6, 0, 6.3); g.stroke(); } }
  }, [4, 4]);
  const rugTex = (bg, a, b) => canvasTex(256, 192, (g, w, hh) => {
    g.fillStyle = bg; g.fillRect(0, 0, w, hh);
    g.strokeStyle = a; g.lineWidth = 6; g.strokeRect(10, 10, w - 20, hh - 20);
    g.strokeStyle = b; g.lineWidth = 2; g.strokeRect(22, 22, w - 44, hh - 44);
    g.globalAlpha = .07; for (let i = 0; i < 2500; i++) { g.fillStyle = seeded() < .5 ? '#000' : '#fff'; g.fillRect(seeded() * w, seeded() * hh, 2, 2); }
  });
  const M = (o) => new THREE.MeshStandardMaterial({ roughness: .8, ...o });
  const mats = {
    oak: M({ map: grain('#c49a6c', '#6d4a2c'), roughness: .65 }),
    paleOak: M({ map: grain('#d9bc94', '#8b6a48'), roughness: .65 }),
    white: M({ color: 0xf6f4ef, roughness: .5 }),
    warmWhite: M({ color: 0xf1ece3, roughness: .55 }),
    putty: M({ color: 0xcfc6ba, roughness: .6 }),
    greige: M({ color: 0xd6cdbf, roughness: .5 }),               // the kitchen fronts
    slate: M({ color: 0x7c8898, roughness: .55 }),               // the laundry joinery, as in the sketches
    stoneWarm: M({ map: stoneTex('#ece4d6', '#b9a98e'), roughness: .35 }),
    darkStone: M({ map: stoneTex('#5f5950', '#9d958a'), roughness: .45 }),
    beigeStone: M({ map: stoneTex('#d3c6b0', '#b5a68c'), roughness: .5 }),
    vanityGrey: M({ color: 0x5a5c5e, roughness: .5 }),
    ribbed: M({ map: canvasTex(64, 64, (g, w, hh) => { g.fillStyle = '#d8cdbb'; g.fillRect(0, 0, w, hh); for (let x = 0; x < w; x += 6) { g.fillStyle = 'rgba(0,0,0,.08)'; g.fillRect(x, 0, 2, hh); } }, [6, 1]), roughness: .6 }),
    steel: M({ color: 0xc9cbcc, roughness: .3, metalness: .7 }),
    brass: M({ color: 0xc19a5b, roughness: .35, metalness: .75 }),
    glass: M({ color: 0xd6e4e8, roughness: .05, metalness: .2, transparent: true, opacity: .35 }),
    mirror: M({ color: 0xc6ccd0, roughness: .08, metalness: .8 }),
    black: M({ color: 0x232220, roughness: .4 }),
    dark: M({ color: 0x3a3733, roughness: .6 }),
    linen: M({ map: weave('#efe9de') }),
    ivory: M({ map: weave('#f5f1e8') }),
    oatmeal: M({ map: weave('#d9ccb6') }),
    boucle: M({ map: boucle('#efe8dc'), roughness: .95 }),
    navy: M({ map: weave('#2f3a52') }),
    sheer: M({ color: 0xf4eee4, roughness: .9, transparent: true, opacity: .55 }),
    slats: M({ map: slats, roughness: .7 }),
    // leather-bound sets: a spine every few px, two gold bands
    setBlue: M({ map: spines('#22314d'), roughness: .55 }),
    setRed: M({ map: spines('#5a2226'), roughness: .55 }),
    setGreen: M({ map: spines('#26352b'), roughness: .55 }),
    setBlack: M({ map: spines('#1d1c1b'), roughness: .55 }),
    wallpaper: M({ map: wallpaper, roughness: .9 }),
    rattan: M({ map: weave('#c9a26b', 2), roughness: .8 }),
    jute: M({ map: weave('#c8b08a', 5), roughness: 1 }),
    leaf: M({ color: 0x6b7a52, roughness: .9 }),
    terracotta: M({ color: 0xb4734f, roughness: .9 }),
    glow: M({ color: 0xfff3dc, emissive: 0xffe2b0, emissiveIntensity: .9, roughness: .3 }),
    globe: M({ color: 0xf3efe6, emissive: 0xffe6bf, emissiveIntensity: .5, roughness: .1, transparent: true, opacity: .7 }),
    rugOat: M({ map: rugTex('#e4dac8', '#d3c5ad', '#cbbc9f'), roughness: 1 }),
    rugLiving: M({ map: rugTex('#ece5d8', '#ddd2bf', '#d6cab5'), roughness: 1 }),
    deck: M({ color: 0xcfc6b8, roughness: .95 })
  };

  // ---- furniture: plan px for x/y/w/d, cm for heights and lifts
  const furn = new THREE.Group(); scene.add(furn);
  let item = null;
  const begin = () => { item = new THREE.Group(); furn.add(item); return item; };
  const add = (x, y, w, d, hcm, mat, liftcm = 0, r = .015) => {
    const m = new THREE.Mesh(rbox(w / U, h(hcm), d / U, r), mat);
    m.position.set(wx(x + w / 2), h(liftcm), wz(y + d / 2));
    m.castShadow = m.receiveShadow = true; item.add(m); return m;
  };
  const cyl = (x, y, rpx, hcm, mat, liftcm = 0, top = rpx) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(top / U, rpx / U, h(hcm), 20), mat);
    m.position.set(wx(x), h(liftcm + hcm / 2), wz(y)); m.castShadow = true; item.add(m); return m;
  };
  const ball = (x, y, rpx, liftcm, mat) => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(rpx / U, 20, 14), mat);
    m.position.set(wx(x), h(liftcm), wz(y)); item.add(m); return m;
  };
  // a made bed; head: the side the headboard is on ('n', 's', 'w', 'e')
  function bed(x, y, w, d, head, o) {
    begin();
    const along = head === 'n' || head === 's' ? 'y' : 'x';
    add(x, y, w, d, o.baseH || 30, o.base, 0, .02);
    add(x + 3, y + 3, w - 6, d - 6, 20, mats.ivory, o.baseH || 30, .03);
    const top = (o.baseH || 30) + 20;
    const part = (f0, f1, inset, hcm, mat, lift) => {
      if (along === 'y') { const a = head === 'n' ? y + d * f0 : y + d * (1 - f1); add(x + inset, a, w - 2 * inset, d * (f1 - f0), hcm, mat, lift, .025); }
      else { const a = head === 'w' ? x + w * f0 : x + w * (1 - f1); add(a, y + inset, w * (f1 - f0), d - 2 * inset, hcm, mat, lift, .025); }
    };
    part(.27, 1, -1, 8, o.duvet, top - 2);
    part(.72, .9, -2, 4, o.throw, top + 5);
    const n = o.pillows || 1;
    for (let i = 0; i < n; i++) {
      const pm = o.pillowMats ? o.pillowMats[i % o.pillowMats.length] : mats.ivory;
      if (along === 'y') { const pw = (w - 16) / n; add(x + 8 + i * pw, head === 'n' ? y + 6 : y + d - 30, pw - 4, 24, 14, pm, top, .04); }
      else { const pw = (d - 16) / n; add(head === 'w' ? x + 6 : x + w - 30, y + 8 + i * pw, 24, pw - 4, 14, pm, top, .04); }
    }
    if (o.accent) {
      if (along === 'y') add(x + w * .3, head === 'n' ? y + 26 : y + d - 40, w * .4, 12, 12, o.accent, top + 4, .04);
      else add(head === 'w' ? x + 28 : x + w - 40, y + d * .3, 12, d * .4, 12, o.accent, top + 4, .04);
    }
    if (along === 'y') add(x - 2, head === 'n' ? y - 8 : y + d, w + 4, 8, o.hb || 100, o.headMat, 0, .03);
    else add(head === 'w' ? x - 8 : x + w, y - 2, 8, d + 4, o.hb || 100, o.headMat, 0, .03);
  }
  // built-in closet along a wall: face = the side its doors face; doors = number of doors
  function closet(x, y, w, d, face, mat, doors) {
    begin();
    add(x, y, w, d, 250, mat, 0, .006);
    const long = w >= d, L = long ? w : d;
    const fx = face === 'e' ? x + w : face === 'w' ? x - 1.2 : null, fy = face === 's' ? y + d : face === 'n' ? y - 1.2 : null;
    for (let i = 1; i < doors; i++) {
      const o = L * i / doors;
      if (long) add(x + o - .6, fy, 1.2, 1.2, 246, mats.dark, 2, .001); else add(fx, y + o - .6, 1.2, 1.2, 246, mats.dark, 2, .001);
    }
  }
  function rug(x, y, w, d, mat) { begin(); add(x, y, w, d, 1.2, mat, 0, .004); }
  // a dining chair with a curved back; back: the side its back is on
  function chair(x, y, back, seat, frame) {
    begin();
    for (const [lx, ly] of [[x + 4, y + 4], [x + 40, y + 4], [x + 4, y + 40], [x + 40, y + 40]]) cyl(lx, ly, 1.6, 44, frame);
    add(x, y, 44, 44, 7, seat, 42, .03);
    const b = { n: [x, y, 44, 8], s: [x, y + 36, 44, 8], w: [x, y, 8, 44], e: [x + 36, y, 8, 44] }[back];
    add(...b, 30, seat, 52, .03);
    const r = { n: [x, y - 2, 44, 4], s: [x, y + 42, 44, 4], w: [x - 2, y, 4, 44], e: [x + 42, y, 4, 44] }[back];
    add(...r, 4, frame, 80, .01);
  }

  // --- kitchen, as in its picture (taken looking west): a U of greige cabinets with stone worktops.
  // Back (west) wall: the long run with the main sink, a stone backsplash and two rows of uppers with a
  // light strip under them. Left (south) wall: the run under the windows with the gas hob, the oven
  // under it, and a second sink. Right (north) wall: the tall units with the oven at eye level.
  // In the middle a stone island, long side east-west, with a stool on each side at its east end.
  begin();
  const base = (x, y, w, d) => { add(x + 3, y + 3, w - 6, d - 6, 10, mats.dark, 0, .002); add(x, y, w, d, 76, mats.greige, 10, .006); };
  base(64, 678, 70, 386); base(64, 1064, 316, 70);
  add(62, 678, 74, 388, 4, mats.stoneWarm, 86, .006);                      // worktops
  add(62, 1062, 320, 72, 4, mats.stoneWarm, 86, .006);
  add(64, 680, 2, 382, 52, mats.stoneWarm, 90, .002);                      // stone backsplash on the back wall
  add(64, 608, 390, 70, 232, mats.greige, 0, .008);                       // tall units along the whole north wall, to the entry corner (owner)
  for (let xx = 124; xx < 454; xx += 60) add(xx, 677.5, 1.2, 1.2, 228, mats.dark, 2, .001);
  add(140, 678.5, 40, 1, 40, mats.black, 120, .002);                       // the oven at eye level
  add(64, 700, 38, 350, 104, mats.greige, 145, .006);                      // two rows of uppers, up to the ceiling
  add(101.5, 700, 1.2, 350, 1.2, mats.dark, 210, .001);
  for (const yy of [770, 840, 910, 980]) add(101.5, yy, 1.2, 1.2, 100, mats.dark, 147, .001);
  add(102, 702, 1, 346, 1, mats.glow, 144, .001);                          // light strip under them
  add(76, 850, 46, 66, 1, mats.steel, 90, .01);                            // main sink on the back wall
  cyl(70, 883, 1.8, 32, mats.steel, 90); add(70, 882, 16, 2.5, 2.5, mats.steel, 120, .004);
  add(110, 1078, 60, 48, 1, mats.black, 90, .008);                        // gas hob under the first window
  for (const [bx, by] of [[122, 1090], [158, 1090], [122, 1114], [158, 1114]]) cyl(bx, by, 6, 1.5, mats.dark, 91);
  add(108, 1063, 64, 1, 58, mats.black, 18, .002);                         // the oven under the hob
  add(300, 1076, 56, 42, 1, mats.steel, 90, .01);                          // second sink under the second window
  cyl(328, 1126, 1.8, 32, mats.steel, 90); add(327, 1112, 2.5, 16, 2.5, mats.steel, 120, .004);
  for (const yy of [720, 790, 940, 1010]) add(133.5, yy, 1, 22, 1.2, mats.brass, 80, .001);   // brass bar pulls
  for (const xx of [200, 240, 280]) add(xx, 1063.5, 22, 1, 1.2, mats.brass, 80, .001);
  add(230, 836, 190, 96, 90, mats.stoneWarm, 0, .01);                     // the island, stone down to the floor
  for (const sy of [814, 954]) { begin(); cyl(386, sy, 18, 6, mats.linen, 64, 19); for (const [lx, ly] of [[374, sy - 12], [398, sy - 12], [374, sy + 12], [398, sy + 12]]) cyl(lx, ly, 1.2, 64, mats.steel); }
  for (const px of [290, 360]) { begin(); ball(px, 884, 14, 180, mats.globe); cyl(px, 884, .5, 66, mats.black, 194); cyl(px, 884, 3, 5, mats.brass, 190); }

  // --- living (owner, Nov 19): a larger rug reaching toward the coat closet, set 40 cm toward the kitchen,
  // with the furniture centred on it: the sofa on the south side facing north, two swivel armchairs facing
  // it with a small side table between them, a round stone coffee table and a floor lamp; a clear strip
  // stays in front of the coat closet doors
  rug(524, 712, 340, 380, mats.rugLiving);   // 40 cm toward the kitchen, the furniture centred on it (owner)
  // true sizes (owner, Nov 19: "are the arm chairs and couch … to scale?"), at 1.16 plan px per cm:
  // sofa 216 × 95 cm, seat 42 cm; swivel tub chairs 75 cm across, seat 45 cm, back 78 cm; coffee table
  // 90 cm across, 38 cm high; about 40 cm between the coffee table and the seats all round
  begin();
  add(574, 1002, 250, 110, 42, mats.oatmeal, 0, .05);                     // sofa seat, 95 cm deep
  add(574, 1082, 250, 30, 80, mats.oatmeal, 0, .05);                      // back, toward the balcony doors
  add(574, 1002, 26, 110, 60, mats.oatmeal, 0, .05); add(798, 1002, 26, 110, 60, mats.oatmeal, 0, .05);
  add(624, 1056, 42, 24, 36, mats.ivory, 42, .06); add(732, 1056, 42, 24, 36, mats.ivory, 42, .06);
  begin(); cyl(699, 900, 52, 38, mats.stoneWarm, 0, 52);                   // round travertine coffee table, 90 cm
  for (const cx of [632, 766]) {                                           // two swivel tub chairs, facing south
    begin(); cyl(cx, 757, 16, 12, mats.brass, 0, 6);                       // brass swivel base
    cyl(cx, 757, 43, 33, mats.boucle, 12, 43);                             // the tub, seat at 45 cm
    add(cx - 41, 714, 82, 20, 33, mats.boucle, 45, .08);                   // the back, to 78 cm
    add(cx - 43, 726, 14, 52, 22, mats.boucle, 45, .06); add(cx + 29, 726, 14, 52, 22, mats.boucle, 45, .06);   // the arms
  }
  begin(); cyl(699, 757, 16, 50, mats.paleOak, 0, 14);                     // a small side table between them
  cyl(699, 757, 7, 14, mats.stoneWarm, 50, 5);
  begin(); cyl(552, 738, 12, 2, mats.brass); cyl(552, 738, 1.4, 160, mats.brass, 2); cyl(574, 750, 20, 14, mats.brass, 150, 12);   // floor lamp

  // --- dining: an oak table (clear of the sideboard), six oak chairs with cream seats, three glass
  // globes on brass rods, a white sideboard with an oak top, the bookcase on the hall wall, sheers
  begin();
  add(985, 886, 180, 104, 5, mats.oak, 72, .01);
  add(1055, 918, 40, 40, 72, mats.oak, 0, .01); add(1040, 904, 70, 68, 3, mats.oak, 0, .01);
  for (const cx of [1005, 1095]) { chair(cx, 838, 'n', mats.boucle, mats.paleOak); chair(cx, 994, 's', mats.boucle, mats.paleOak); }
  chair(937, 916, 'w', mats.boucle, mats.paleOak); chair(1169, 916, 'e', mats.boucle, mats.paleOak);
  begin(); cyl(1075, 938, 18, 24, mats.stoneWarm, 77, 12);                 // vase with olive branches
  ball(1075, 938, 22, 115, mats.leaf).scale.set(1.2, .7, 1.2);
  for (const px of [1020, 1075, 1130]) { begin(); ball(px, 938, 14, 170, mats.globe); cyl(px, 938, .6, 74, mats.brass, 184); }
  begin(); add(1256, 820, 58, 260, 76, mats.white, 4, .008); add(1254, 818, 60, 264, 4, mats.oak, 80, .006);   // sideboard
  for (const yy of [872, 924, 976, 1028]) add(1255, yy, 1, 1.2, 70, mats.dark, 6, .001);
  begin(); add(1308, 880, 5, 140, 120, mats.oak, 140, .004); add(1306, 886, 3, 128, 108, mats.linen, 146, .002);   // the art
  // the sefarim bookcase on the hall wall (owner: the printed panel "looked really weird"): a white case
  // with uprights and shelves, and on each shelf one or two matching sets of leather-bound volumes with
  // gold bands on their spines, deep blue, burgundy, dark green and black, with a little space left over
  {
    begin();
    const X = 917, Y = 740, Wd = 276, D = 34, Hc = 259, cols = 4, rows = 6, t = 3;   // between its two new 30 cm walls
    add(X, Y, Wd, 3, Hc, mats.white, 0, .002);                                   // back
    for (let c = 0; c <= cols; c++) add(X + (Wd - t) * c / cols, Y, t, D, Hc, mats.white, 0, .002);   // uprights
    for (let k = 0; k <= rows; k++) add(X, Y, Wd, D, 2.5, mats.white, k * (Hc - 2.5) / rows, .002);  // shelves
    const pick = (() => { let q = 5; return () => (q = (q * 16807) % 2147483647) / 2147483647; })();
    const sets = [mats.setBlue, mats.setRed, mats.setGreen, mats.setBlack, mats.setBlue, mats.setRed];
    const cw = (Wd - t) / cols, sh = (Hc - 2.5) / rows;
    for (let c = 0; c < cols; c++) for (let k = 0; k < rows; k++) {
      let x = X + (Wd - t) * c / cols + t + 1;
      const end = x + cw - t - 2, n = pick() < .55 ? 2 : 1;
      for (let m = 0; m < n && x < end - 8; m++) {
        const w = Math.min(end - x, (cw - 8) * (n === 1 ? .7 + pick() * .25 : .35 + pick() * .2));
        const hh = 24 + pick() * 6;
        add(x, Y + 6, w, D - 9, Math.min(hh, sh - 4), sets[(c * 3 + k * 2 + m) % sets.length], k * sh + 2.5, .003);
        x += w + 1.5;
      }
    }
  }
  begin(); add(1036, 1112, 26, 14, 250, mats.sheer, 0, .01); add(1186, 1112, 26, 14, 250, mats.sheer, 0, .01);  // sheers

  // --- entry (owner, Nov 19): a sefarim cabinet about 30 cm deep along the bedroom wall, with doors on its
  // face toward the entry, closed off by a short wall; and a coat closet about 60 cm deep under the bedroom's
  // south wall, its doors facing the living area, between the new 60 cm wall and the existing stub
  {
    begin();
    add(640, 352, 34, 164, 260, mats.warmWhite, 0, .004);   // to the ceiling (owner)
    for (let k = 1; k < 3; k++) add(639.4, 352 + 164 * k / 3 - .6, 1.2, 1.2, 256, mats.dark, 2, .001);   // three doors (owner: wider)
    for (let k = 0; k < 3; k++) add(638.8, 352 + 164 * (k + .5) / 3 - 1, 1.6, 2, 30, mats.brass, 85, .002);
  }
  closet(690, 460, 262, 64, 's', mats.warmWhite, 4);   // four doors (owner: wider still)
  begin(); for (let k = 0; k < 4; k++) add(690 + 262 * (k + .5) / 4 - 1, 524.2, 2, 1.6, 30, mats.brass, 90, .002);

  // --- laundry room (from the SketchUp sketches): along the east wall a tall built-in unit 65 cm deep,
  // with the washer and dryer side by side on a drawer base and wire baskets and shelves above;
  // under the window a low unit 52 cm deep and 126 cm high (ironing board, iron, robot vacuum)
  begin();
  add(1239, 366, 75, 212, 250, mats.slate, 0, .006);
  for (const [y0, dy] of [[414, 77], [491, 77]]) {
    add(1236, y0 + 2, 4, dy - 4, 85, mats.white, 82, .008);                 // the machines' white fronts
    const door = cyl(1234, y0 + dy / 2, 22, 2, mats.mirror, 0); door.rotation.z = Math.PI / 2; door.position.set(wx(1234), h(118), wz(y0 + dy / 2));
    add(1236, y0 + 4, 4, dy - 8, 10, mats.steel, 155, .004);               // control panels
  }
  for (const lift of [26, 54]) add(1237.5, 414, 1.5, 154, 1.2, mats.dark, lift, .001);   // drawer joints under the machines
  add(1237, 414, 3, 154, 2, mats.dark, 170, .001);                          // the shelf over the machines
  for (const [y0, dy] of [[416, 74], [492, 74]]) for (const lift of [178, 205, 232]) add(1238, y0, 3, dy, 18, mats.black, lift, .002);   // wire baskets
  add(1238, 368, 2, 44, 245, mats.dark, 4, .002);                           // the open shelf column
  for (const lift of [40, 90, 140, 190]) add(1240, 368, 72, 44, 2, mats.slate, lift, .002);
  add(1136, 366, 103, 60, 126, mats.slate, 0, .006);                        // the low unit under the window
  add(1146, 425, 40, 2, 1.2, mats.dark, 2, .001);
  add(1140, 424, 96, 3, 1.2, mats.dark, 80, .001);
  begin(); add(1140, 440, 4, 120, 4, mats.white, 175, .01);                  // the white drying rail on the west wall

  // --- main bathroom (as in its picture): a long dark grey floating vanity with a lit mirror on the
  // west wall, the wall-hung toilet under the window with a stone ledge, the bath along the east wall
  begin();
  for (const [x, y, w, d] of [[1324, 368, 2, 210], [1584, 368, 2, 210], [1324, 576, 76, 2], [1480, 576, 106, 2]]) add(x, y, w, d, 250, mats.darkStone, 0, .001);
  add(1326, 392, 50, 160, 38, mats.vanityGrey, 47, .01);
  add(1325, 390, 54, 164, 3, mats.vanityGrey, 85, .006);
  add(1338, 420, 28, 60, 1, mats.dark, 86, .01);
  add(1327, 395, 2, 150, 80, mats.mirror, 110, .002); add(1328, 393, 1, 154, 1, mats.glow, 109, .001);
  cyl(1330, 450, 1.6, 2, mats.brass, 96); add(1330, 448, 10, 3, 2, mats.brass, 97, .002);
  add(1380, 368, 140, 20, 105, mats.darkStone, 0, .006);                    // ledge under the window
  add(1430, 388, 40, 48, 36, mats.white, 32, .05);                          // wall-hung toilet
  add(1440, 387, 20, 1, 10, mats.brass, 80, .002);
  add(1508, 370, 76, 206, 55, mats.darkStone, 0, .01);                      // bath
  add(1514, 376, 64, 194, 2, mats.white, 54, .03);
  add(1508, 370, 2, 100, 150, mats.glass, 55, .002);
  cyl(1395, 520, 14, 45, mats.black, 0, 16);                                // basket

  // --- en-suite (as in its picture): the vanity with ribbed fronts and a lit mirror on the window wall,
  // the toilet, and a walk-in shower behind a glass screen at the far end
  begin();
  for (const [x, y, w, d] of [[1726, 752, 2, 382], [1948, 752, 2, 382], [1726, 1132, 224, 2], [1726, 752, 36, 2], [1870, 752, 80, 2]]) add(x, y, w, d, 250, mats.beigeStone, 0, .001);
  add(1894, 790, 54, 150, 40, mats.ribbed, 40, .01);
  add(1891, 788, 58, 154, 4, mats.white, 80, .01);
  add(1905, 820, 30, 60, 1, mats.warmWhite, 84, .01);
  add(1946, 795, 2, 140, 70, mats.mirror, 105, .002); add(1945, 790, 2, 150, 2, mats.glow, 180, .002);
  add(1932, 950, 18, 86, 100, mats.beigeStone, 0, .006);                    // ledge
  add(1892, 970, 42, 40, 36, mats.white, 32, .05);                          // wall-hung toilet
  add(1726, 1030, 224, 2, 200, mats.glass, 0, .002);                        // shower screen, door, rain head
  add(1838, 1029, 1.5, 4, 40, mats.brass, 90, .002);
  cyl(1838, 1090, 12, 1.5, mats.brass, 205);

  // --- primary bedroom (as in its picture): a double bed against a putty headboard wall with bedside
  // ledges and a lamp, putty closets along the north wall, an oatmeal rug, a boucle armchair and a lamp
  closet(1598, 266, 354, 68, 's', mats.putty, 5);
  // owner's marks: the bed between the closets and the room's middle, heads on the west wall
  // the headboard panel and the bedside ledge stay within the west wall, which ends at y 616 (owner)
  begin(); add(1598, 340, 12, 272, 120, mats.putty, 0, .006);
  add(1610, 342, 40, 42, 4, mats.putty, 52, .004);
  cyl(1630, 363, 9, 24, mats.warmWhite, 56, 7); cyl(1630, 363, 14, 16, mats.linen, 80, 10);   // lamp
  add(1600, 460, 3, 60, 66, mats.oak, 160, .004); add(1601, 465, 2, 50, 56, mats.terracotta, 165, .002);   // the flower painting
  bed(1610, 389, 206, 203, 'w', { base: mats.ivory, duvet: mats.linen, throw: mats.oatmeal, headMat: mats.ivory, hb: 110, pillows: 3, pillowMats: [mats.ivory, mats.oatmeal, mats.ivory], accent: mats.oatmeal, baseH: 32 });
  rug(1660, 370, 240, 260, mats.rugOat);
  begin(); add(1830, 630, 74, 74, 42, mats.boucle, 0, .08); add(1890, 630, 16, 74, 75, mats.boucle, 0, .06);
  begin(); cyl(1920, 712, 12, 2, mats.brass); cyl(1920, 712, 1.4, 165, mats.brass, 2); cyl(1890, 700, 20, 14, mats.brass, 152, 12);

  // --- safe room (as in its picture): the botanical wallpaper on the back wall, a trundle bed against
  // the south wall, a rattan bedside table, and the closet along the north wall: 55 cm deep, with a
  // divider just above the bed for the first 2.10 m (five doors above it), then full-height doors
  begin(); add(696, 94, 3, 342, 250, mats.wallpaper, 0, .001);
  bed(702, 336, 206, 100, 'w', { base: mats.oatmeal, duvet: mats.white, throw: mats.oatmeal, headMat: mats.oatmeal, hb: 95, pillows: 2, pillowMats: [mats.ivory, mats.oatmeal], baseH: 34 });
  add(712, 434, 186, 1, 1.2, mats.dark, 14, .001);                          // the trundle drawer's joint
  begin(); add(702, 270, 42, 40, 55, mats.rattan, 0, .01); cyl(723, 290, 7, 14, mats.oatmeal, 55, 5);
  add(698, 300, 6, 6, 8, mats.brass, 140, .004);
  {
    begin();
    const cx = 700, cy = 94, L = 305, D = 64, F = cy + D, split = 244;       // owner's marks: closet to x 1005; 2.10 m with the divider
    add(cx, cy, L, D, 250, mats.warmWhite, 0, .006);
    add(cx, F, split, 1.2, 1.2, mats.dark, 60, .001);                       // the divider line, just above the bed
    for (let k = 1; k < 5; k++) add(cx + split * k / 5 - .6, F, 1.2, 1.2, 188, mats.dark, 61, .001);
    add(cx + split - .6, F, 1.2, 1.2, 248, mats.dark, 1, .001);
    for (let k = 0; k < 5; k++) add(cx + split * (k + .5) / 5 - .8, F, 1.6, 1.6, 20, mats.oak, 66, .001);
    add(cx + split + (L - split) / 2 - .8, F, 1.6, 1.6, 30, mats.oak, 95, .001);
  }
  // a desk in the corner by the window, with its chair (owner's marks)
  begin(); add(1008, 96, 92, 66, 4, mats.paleOak, 72, .008);
  for (const [lx, ly] of [[1012, 100], [1094, 100], [1012, 156], [1094, 156]]) cyl(lx, ly, 1.6, 72, mats.paleOak);
  begin(); cyl(1054, 192, 20, 6, mats.oatmeal, 44, 20); add(1034, 210, 40, 6, 36, mats.oatmeal, 46, .02);
  for (const [lx, ly] of [[1040, 178], [1068, 178], [1040, 206], [1068, 206]]) cyl(lx, ly, 1.2, 44, mats.paleOak);
  rug(790, 190, 180, 120, mats.rugOat);

  // --- second bedroom (after the twin-bed picture; model only): two white beds with drawers, heads on
  // the east wall against an oak slat wall, an oak night table between, navy cushions and throw, a jute
  // rug, a linen roman blind at the window, and built-in closets
  begin(); add(1710, 828, 6, 304, 250, mats.slats, 0, .002);
  bed(1502, 834, 206, 100, 'e', { base: mats.white, duvet: mats.linen, throw: mats.linen, headMat: mats.white, hb: 90, pillows: 1, accent: mats.navy, baseH: 34 });
  bed(1502, 1028, 206, 100, 'e', { base: mats.white, duvet: mats.linen, throw: mats.navy, headMat: mats.white, hb: 90, pillows: 1, accent: mats.navy, baseH: 34 });
  begin(); add(1660, 944, 48, 76, 52, mats.paleOak, 0, .01); add(1659, 944, 1, 76, 1.2, mats.dark, 26, .001);
  cyl(1680, 966, 9, 22, mats.stoneWarm, 52, 6); ball(1680, 966, 14, 92, mats.leaf).scale.set(1, 1.2, 1);
  cyl(1695, 1000, 4, 2, mats.dark, 52); cyl(1695, 1000, .8, 40, mats.dark, 54); cyl(1688, 1000, 6, 8, mats.dark, 90, 4);
  rug(1420, 900, 150, 200, mats.jute);
  closet(1322, 740, 74, 394, 'e', mats.white, 6);                          // owner: the full length of the west wall
  closet(1512, 738, 204, 80, 'n', mats.putty, 4);                        // the primary bedroom's closet, opening north into it (owner)
  begin(); add(1490, 1124, 142, 8, 45, mats.linen, 165, .01);

  // --- balcony: stone deck, glass railing, two chairs and a table, an olive in a planter
  begin();
  const [bx, by, bw, bd] = P.BALCONY;
  add(bx, by, bw, bd, 1.5, mats.deck, 0, .002);
  const rail = (x, y, w, d) => { add(x, y, w, d, 100, mats.glass, 4, .002); add(x - 1, y - 1, w + 2, d + 2, 4, mats.black, 104, .002); };
  rail(bx, by, 4, bd); rail(bx, by + bd - 4, bw, 4); rail(bx + bw - 4, by, 4, bd);
  begin(); add(760, 1300, 56, 56, 3, mats.black, 70, .01); cyl(788, 1328, 2, 70, mats.black);
  for (const [cx, cy] of [[690, 1306], [836, 1306]]) { begin(); add(cx, cy, 46, 46, 6, mats.linen, 40, .02); add(cx, cy + 40, 46, 6, 80, mats.black, 0, .01); for (const [lx, ly] of [[cx + 3, cy + 3], [cx + 43, cy + 3], [cx + 3, cy + 43], [cx + 43, cy + 43]]) cyl(lx, ly, 1.2, 40, mats.black); }
  begin(); add(1180, 1190, 46, 46, 50, mats.terracotta, 0, .02); ball(1203, 1213, 30, 92, mats.leaf);

  furn.children.forEach(g => { g.userData.k = 0; });

  // ---- camera: straight down on the plan, a bird's-eye view, then each room in turn
  const fit = () => { const a = camera.aspect; return Math.max(H / U, (W / U) / a) * .5 / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * 1.04; };
  const DIR = new THREE.Vector3(-.06, .94, .34).normalize();
  const roomPose = ROOMS.map(rm => {
    const [x0, y0, x1, y1] = rm.r;
    const c = new THREE.Vector3(wx((x0 + x1) / 2), h(60), wz((y0 + y1) / 2));
    const ext = Math.max(x1 - x0, y1 - y0) / U;
    const dir = rm.dir ? new THREE.Vector3(...rm.dir).normalize() : DIR;
    return { pos: c.clone().addScaledVector(dir, (ext * 2.0 + .5) * (rm.zoom || 1)), look: c, mid: c.clone().setY(h(90)) };
  });
  const top = { pos: new THREE.Vector3(), look: new THREE.Vector3() }, bird = { pos: new THREE.Vector3(), look: new THREE.Vector3() };
  const tmpP = new THREE.Vector3(), tmpL = new THREE.Vector3();
  function cameraAt(t) {
    const dist = fit();
    top.pos.set(0, dist, .001); top.look.set(0, 0, 0);
    bird.pos.set(-dist * .32, dist * .76, dist * .72); bird.look.set(.2, 0, .4);   // closer (owner, Nov 19)
    const k = ease(span(t, ...T.cam));
    tmpP.lerpVectors(top.pos, bird.pos, k); tmpL.lerpVectors(top.look, bird.look, k);
    let prev = bird;
    ROOMS.forEach((_, i) => {
      const f = ease(span(t, ...LEGS[i].fly));
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
    floor.material.emissiveIntensity = lerp(.9, .32, ease(span(t, ...T.cam)));
    built.visible = r > 0; built.scale.y = Math.max(r, .001);
    furn.children.forEach((g, i) => {
      const k = easeOut(span(t, T.rise[0] + .5 + i * .02, T.rise[1] + .3 + i * .02));
      g.visible = k > 0; g.scale.y = Math.max(k, .001);
    });
    cameraAt(t);
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
    if (controls) controls.render(); else frame(time);
  }

  // ---- the plan story plays once when it comes into view, the model rises, and then it is the
  // visitor's: drag to turn it, zoom, and open each room's picture from its button (owner, Nov 19)
  const INTRO_END = T.cam[1] + .2;
  let controls = null;
  async function done() {
    frame(INTRO_END);
    const { modelControls } = await import('./model-controls.js');
    const rooms = ROOMS.map(rm => ({ ...rm, at: new THREE.Vector3(wx((rm.r[0] + rm.r[2]) / 2), h(120), wz((rm.r[1] + rm.r[3]) / 2)) }));
    controls = modelControls({ THREE, renderer, scene, camera, view, rooms, from: camera.position.clone(), target: bird.look.clone(), bounds: [wx(38), wx(1988), wz(70), wz(1466)] });
    controls.show();
  }
  // scrolling plays the story (scroll-story.js); with reduced motion the finished model straight away
  let time = 0, introDone = false, story = null;
  const finishIntro = () => { if (introDone) return; introDone = true; time = INTRO_END; done(); };
  new ResizeObserver(resize).observe(view);
  resize();
  if (reduce) finishIntro();
  else {
    frame(0);
    const { scrollStory } = await import('./scroll-story.js');
    story = scrollStory({ box, steps: STEPS, end: INTRO_END, frame: t => { if (!introDone) { time = t; frame(t); } }, done: finishIntro });
  }
  window.__al3d = { jump: t => { if (!controls) { time = t; frame(t); } }, finish: () => { if (story) story.stop(); else finishIntro(); }, T, ROOMS };
}
const PAPER_OUT = '#f7f4ed';
