/* Apartment 12 (project-furniture-study.html): the living and dining room as a live 3D model.
   Owner, Nov 21: "lets improve the 3d model" → a real model like Kaduri and Neve Amim, with the two
   drag-to-compare pictures kept as the fallback (no WebGL, or before three.js loads).
   A "Sales plan | True size" switch moves the furniture between the size the developer's sales plan
   draws it and its real size: the dining table grows, the chairs grow and two end chairs appear, and at
   true size the end chair runs into the loveseat and the path to the hallway closes.
   Measured from the two plans (furniture-1-sales / furniture-1-scaled, 1126 × 756 px): about 1.5 cm per
   px (the six-seat table, 90 × 193 cm, is 60 × 129 px). Walls are cut at 105 cm, like a cutaway. */
let THREE;
const CM = 1.703;                                 // cm per plan px: the owner's 705 cm from the kitchen wall to the bedroom wall (Nov 21)
const S = CM / 100;                               // world metres per plan px
const CX = 400, CY = 380;                         // plan px at the world origin
const wx = px => (px - CX) * S, wz = py => (py - CY) * S, h = cm => cm / 100;

// ---- the room, plan px [x0, y0, x1, y1]
const WALLS = [
  [78, 288, 92, 583], [78, 288, 300, 302], [284, 240, 300, 302],       // west wall, the kitchen's north wall, the entry jog
  [284, 161, 410, 175], [400, 175, 410, 224],                          // the entry hall
  [400, 215, 541, 224], [532, 224, 541, 307],                          // the closet wall above the dining area and its stub
  [506, 355, 657, 362], [506, 362, 513, 583],                          // the bedroom beside the living room
  [603, 140, 613, 290]                                                 // the bathroom along the hallway
];
const FACADE = { y0: 562, y1: 580, wall: [[78, 105], [173, 196], [263, 320], [467, 564], [627, 660]], glass: [[105, 173], [196, 263], [320, 467], [564, 627]] };
const FLOORS = [[92, 302, 506, 562], [300, 175, 400, 302], [400, 224, 532, 302], [506, 302, 541, 355], [541, 224, 603, 355], [513, 355, 657, 562]];

// ---- furniture: where the sales plan draws it, and where it really goes at true size
const SOFA = { sales: [316, 434, 364, 558], true: [309, 417, 363, 558] };
const LOVESEAT = { sales: [374, 383, 457, 429], true: [369, 378, 461, 431] };
const COFFEE = { sales: [403, 462, 437, 532], true: [400, 460, 437, 530] };
const TABLE = { sales: [426, 225, 467, 320], true: [405, 271, 465, 400] };
const chairs = [];
for (const [i, cy] of [245, 275, 305].entries()) {
  const ty = [290, 330, 370][i];
  chairs.push({ face: 'e', sales: [407, cy - 9, 426, cy + 9], true: [376, ty - 15, 405, ty + 15] });
  chairs.push({ face: 'w', sales: [467, cy - 9, 486, cy + 9], true: [465, ty - 15, 494, ty + 15] });
}
chairs.push({ face: 's', sales: null, true: [420, 242, 450, 271] });          // the end chairs appear at true size
chairs.push({ face: 'n', sales: null, true: [420, 400, 450, 429], clash: true });
const ROUTE = [[180, 352], [300, 352], [515, 334], [566, 314], [572, 244]];
const CLASH = [436, 412];
// Rearranged (owner, Nov 21: "show the furniture being rearranged so it doesn't bump into each other and
// doesn't block the pathway to the bedrooms … the point is to show that the alternatives aren't great"):
// owner: "the table has to go where the seating is currently". The dining table turns and moves into the
// living area by the windows, with all eight chairs; the sofa turns and goes into the dining nook, its
// back to the nook's wall, facing the table; the loveseat and the coffee table have no room left.
// The path to the bedrooms opens.
const RE_TABLE = { c: [392, 500], rot: Math.PI / 2 };
const RE_SOFA = { c: [415.5, 251], rot: -Math.PI / 2 };
const RE_CHAIRS = {
  0: { c: [348, 455.5], face: 's' }, 2: { c: [392, 455.5], face: 's' }, 4: { c: [436, 455.5], face: 's' },
  1: { c: [348, 544.5], face: 'n' }, 3: { c: [392, 544.5], face: 'n' }, 5: { c: [436, 544.5], face: 'n' },
  6: { c: [313, 500], face: 'e' }, 7: { c: [471, 500], face: 'w' }
};
const ANG = { e: 0, n: Math.PI / 2, w: Math.PI, s: -Math.PI / 2 };
// Our solution (owner, Nov 21: "come up with an idea that DOES help", then: a religious family needs a
// big table "and DEFINITELY put people at the 2 heads"): the table turns to run across the room, between
// the kitchen and the living area, with three chairs on each side and both heads (eight seats). The walk
// from the front door to the bedrooms runs along the empty dining nook, past the table's east head. The
// sofa and coffee table stay; an armchair by the window takes the loveseat's place.
const FIX_TABLE = { c: [394.5, 335], rot: Math.PI / 2 };
const FIX_CHAIRS = {
  0: { c: [352, 290.5], face: 's' }, 2: { c: [395, 290.5], face: 's' }, 4: { c: [437, 290.5], face: 's' },
  1: { c: [352, 379.5], face: 'n' }, 3: { c: [395, 379.5], face: 'n' }, 5: { c: [437, 379.5], face: 'n' },
  6: { c: [315.5, 335], face: 'e' }, 7: { c: [473.5, 335], face: 'w' }
};
const FIX_ARMCHAIR = { c: [464, 532], sx: 48 / 92, rot: Math.PI };
const ROUTE_FIX = [[345, 190], [350, 252], [490, 256], [524, 318], [566, 314], [572, 244]];
// The solution (owner, Nov 21: the bedroom wall stays; "what if we move the kitchen to this wall?"): the
// kitchen becomes one long run along the north wall, backing onto the entrance hall. The dining table then
// runs east-west along the windows, eight seats with both heads; the living room takes the east side, the
// sofa's back to the table, facing the TV on the bedroom wall, the loveseat along the windows.
const SOL = {
  sofa: { c: [362, 470.5] }, loveseat: { c: [441, 532.5], rot: Math.PI }, coffee: { c: [428.5, 470] },
  table: { c: [214.5, 460], rot: Math.PI / 2 }, rug: { c: [420, 470] }, tree: { c: [312, 545] },
  chairs: { 0: [172, 415.5, 's'], 2: [215, 415.5, 's'], 4: [257, 415.5, 's'], 1: [172, 504.5, 'n'], 3: [215, 504.5, 'n'], 5: [257, 504.5, 'n'], 6: [135.5, 460, 'e'], 7: [293.5, 460, 'w'] }
};
const ROUTE_SOL = [[345, 190], [350, 258], [480, 264], [524, 318], [566, 314], [572, 244]];
const ROUTE_KITCHEN = [[470, 280], [478, 335], [430, 372], [300, 372], [150, 372]];

const box = document.querySelector('.fs3d[data-three]');
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
function webglOK() {
  try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch { return false; }
}
if (box && webglOK()) {
  const io = new IntersectionObserver(es => {
    if (es.some(e => e.isIntersecting)) { io.disconnect(); start().catch(err => console.error(err)); }
  }, { rootMargin: '300px' });
  io.observe(box);
}

async function start() {
  THREE = await import('./vendor/three.module.min.js');

  // ---- the view, the switch and the status line, in front of the fallback pictures
  const view = document.createElement('div');
  view.className = 'jh-view fs-view';
  const sw = document.createElement('div');
  sw.className = 'm3d-seg fs-switch'; sw.setAttribute('role', 'group'); sw.setAttribute('aria-label', 'Furniture size');
  sw.innerHTML = '<button type="button" class="m3d-btn m3d-txt" data-size="sales" aria-pressed="false">Sales plan</button>' +
                 '<button type="button" class="m3d-btn m3d-txt" data-size="true" aria-pressed="true">True size</button>' +
                 '<button type="button" class="m3d-btn m3d-txt" data-size="re" aria-pressed="false">Try 1</button>' +
                 '<button type="button" class="m3d-btn m3d-txt" data-size="fix" aria-pressed="false">Try 2</button>' +
                 '<button type="button" class="m3d-btn m3d-txt" data-size="sol" aria-pressed="false">Solution</button>' +
                 '<button type="button" class="m3d-btn m3d-txt fs-play" data-play aria-pressed="false">▶ Play</button>';
  view.append(sw);
  const clashTag = document.createElement('span');
  clashTag.className = 'fs-clash'; clashTag.textContent = 'Chair meets sofa';
  view.append(clashTag);
  const fourTag = document.createElement('span'); fourTag.className = 'fs-clash fs-note-tag'; fourTag.textContent = 'The seating area, at the entrance'; view.append(fourTag);
  const loveTag = document.createElement('span'); loveTag.className = 'fs-clash fs-note-tag'; loveTag.textContent = 'No room for the loveseat or coffee table'; view.append(loveTag);
  const fixTags = ['Seats eight, with both heads', 'Tight way to the kitchen', 'Clear path to the bedrooms'].map(t => { const el = document.createElement('span'); el.className = 'fs-clash fs-fix-tag'; el.textContent = t; view.append(el); return el; });
  fixTags[1].className = 'fs-clash';
  const solTags = ['The kitchen, along this wall', 'A 16 in closet behind the kitchen', 'Seats eight, with both heads'].map(t => { const el = document.createElement('span'); el.className = 'fs-clash fs-fix-tag'; el.textContent = t; view.append(el); return el; });
  const status = document.createElement('p');
  status.className = 'cap fs-status'; status.setAttribute('aria-live', 'polite');
  box.querySelector('.compare').before(view);
  view.after(status);
  const when = box.querySelector('.titleblock .when');
  if (when) when.textContent = 'Turn it · switch sizes';

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = .88;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  view.prepend(renderer.domElement);
  box.classList.add('fs3d-live');

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 4 / 3, .1, 200);

  // ---- light: a soft room of light for reflections (a small "studio" baked into an environment map),
  // warm sun through the windows for the shadows, and a cool fill
  {
    const pm = new THREE.PMREMGenerator(renderer), env = new THREE.Scene();
    env.add(new THREE.Mesh(new THREE.BoxGeometry(14, 6, 14), new THREE.MeshBasicMaterial({ color: 0x9c9488, side: THREE.BackSide })));
    const panel = (w, hh, pos, rot, k) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, hh), new THREE.MeshBasicMaterial({ color: new THREE.Color(1, .96, .9).multiplyScalar(k), side: THREE.DoubleSide }));
      m.position.set(...pos); m.rotation.set(...rot); env.add(m);
    };
    panel(8, 4, [0, 2.95, 0], [Math.PI / 2, 0, 0], 1.5);       // the ceiling
    panel(9, 2.4, [0, 1.6, 6.9], [0, 0, 0], 2.2);              // the windows, south
    panel(5, 2, [-6.9, 1.6, 0], [0, Math.PI / 2, 0], 1.4);
    scene.environment = pm.fromScene(env, .04).texture;
    pm.dispose();
  }
  scene.add(new THREE.HemisphereLight(0xfffaf2, 0xcfc6b8, .35));
  const sun = new THREE.DirectionalLight(0xffe6c8, 2.9);
  sun.position.set(-3.5, 10, 8.5);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -7, right: 7, top: 6, bottom: -6, near: 1, far: 30 });
  sun.shadow.bias = -.0003; sun.shadow.normalBias = .02; sun.shadow.radius = 5;
  scene.add(sun);
  const fill = new THREE.DirectionalLight(0xeef2f6, .45); fill.position.set(7, 8, -6); scene.add(fill);

  // ---- materials, with textures painted on canvases (no image downloads)
  const rnd = (() => { let q = 11; return () => (q = (q * 16807) % 2147483647) / 2147483647; })();
  function canvasTex(w, hh, draw, metres, color = true) {
    const c = document.createElement('canvas'); c.width = w; c.height = hh;
    draw(c.getContext('2d'), w, hh);
    const t = new THREE.CanvasTexture(c);
    if (color) t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1 / metres, 1 / metres);
    t.anisotropy = renderer.capabilities.getMaxAnisotropy();
    return t;
  }
  const grainLines = (g, w, hh, line, n, a0 = .05) => {
    for (let i = 0; i < n; i++) {
      g.strokeStyle = line; g.globalAlpha = a0 + rnd() * .12; g.lineWidth = .5 + rnd() * 1.6;
      const y = rnd() * hh; g.beginPath(); g.moveTo(0, y);
      g.bezierCurveTo(w * .3, y + rnd() * 8 - 4, w * .7, y + rnd() * 8 - 4, w, y + rnd() * 4 - 2); g.stroke();
    }
    g.globalAlpha = 1;
  };
  // natural oak floor: planks 18 cm wide, staggered lengths, each a slightly different tone
  const oakFloor = canvasTex(1024, 1024, (g, w, hh) => {
    const rows = 11, ph = hh / rows;
    for (let r = 0; r < rows; r++) {
      let x = -rnd() * 400;
      while (x < w) {
        const len = 260 + rnd() * 380, t = rnd();
        g.fillStyle = `hsl(${32 + t * 6}, ${34 + t * 10}%, ${70 + t * 9}%)`;
        g.fillRect(x, r * ph, len, ph);
        g.save(); g.beginPath(); g.rect(x, r * ph, len, ph); g.clip();
        g.translate(0, r * ph); grainLines(g, w, ph, '#7a5634', 9, .04); g.restore();
        g.fillStyle = 'rgba(90,62,36,.35)'; g.fillRect(x, r * ph, 1.5, ph);
        x += len;
      }
      g.fillStyle = 'rgba(90,62,36,.4)'; g.fillRect(0, r * ph, w, 1.5);
    }
  }, 2);
  oakFloor.rotation = Math.PI / 2;
  const grain = (base, line, m = .8) => canvasTex(512, 512, (g, w, hh) => { g.fillStyle = base; g.fillRect(0, 0, w, hh); grainLines(g, w, hh, line, 90); }, m);
  const weave = (base, m = .25) => canvasTex(256, 256, (g, w, hh) => {
    g.fillStyle = base; g.fillRect(0, 0, w, hh);
    for (let y = 0; y < hh; y += 2) { g.fillStyle = `rgba(0,0,0,${.02 + rnd() * .05})`; g.fillRect(0, y, w, 1); }
    for (let x = 0; x < w; x += 2) { g.fillStyle = `rgba(255,255,255,${.02 + rnd() * .05})`; g.fillRect(x, 0, 1, hh); }
    for (let i = 0; i < 1800; i++) { g.fillStyle = rnd() < .5 ? 'rgba(0,0,0,.06)' : 'rgba(255,255,255,.07)'; g.fillRect(rnd() * w, rnd() * hh, 3, 1); }
  }, m);
  const bumpWeave = canvasTex(256, 256, (g, w, hh) => {
    g.fillStyle = '#808080'; g.fillRect(0, 0, w, hh);
    for (let y = 0; y < hh; y += 3) { g.fillStyle = '#9a9a9a'; g.fillRect(0, y, w, 1); }
    for (let x = 0; x < w; x += 3) { g.fillStyle = '#6a6a6a'; g.fillRect(x, 0, 1, hh); }
  }, .08, false);
  const travertine = canvasTex(512, 512, (g, w, hh) => {
    g.fillStyle = '#ddd0b9'; g.fillRect(0, 0, w, hh);
    for (let i = 0; i < 60; i++) { g.fillStyle = `rgba(${150 + rnd() * 40},${120 + rnd() * 30},${90 + rnd() * 20},${.05 + rnd() * .1})`; const y = rnd() * hh; g.fillRect(0, y, w, 1 + rnd() * 6); }
    for (let i = 0; i < 260; i++) { g.fillStyle = 'rgba(120,96,70,.25)'; g.beginPath(); g.ellipse(rnd() * w, rnd() * hh, 1 + rnd() * 3, .6 + rnd(), 0, 0, 7); g.fill(); }
  }, .6);
  const quartz = canvasTex(512, 512, (g, w, hh) => {
    g.fillStyle = '#efece6'; g.fillRect(0, 0, w, hh);
    for (let i = 0; i < 2500; i++) { g.fillStyle = `rgba(${120 + rnd() * 80},${115 + rnd() * 70},${110 + rnd() * 60},.18)`; g.fillRect(rnd() * w, rnd() * hh, 1.5, 1.5); }
    g.strokeStyle = 'rgba(150,140,125,.18)'; g.lineWidth = 1.2;
    for (let i = 0; i < 6; i++) { g.beginPath(); let x = rnd() * w, y = 0; g.moveTo(x, y); while (y < hh) { x += rnd() * 30 - 15; y += 20; g.lineTo(x, y); } g.stroke(); }
  }, .8);
  const plaster = canvasTex(256, 256, (g, w, hh) => {
    g.fillStyle = '#f2eee7'; g.fillRect(0, 0, w, hh);
    for (let i = 0; i < 1200; i++) { g.fillStyle = rnd() < .5 ? 'rgba(0,0,0,.018)' : 'rgba(255,255,255,.05)'; g.beginPath(); g.arc(rnd() * w, rnd() * hh, 2 + rnd() * 6, 0, 7); g.fill(); }
  }, 1);
  const wool = canvasTex(256, 256, (g, w, hh) => {
    g.fillStyle = '#ddd2bf'; g.fillRect(0, 0, w, hh);
    for (let i = 0; i < 5000; i++) { g.fillStyle = rnd() < .5 ? 'rgba(120,100,70,.08)' : 'rgba(255,255,255,.18)'; g.beginPath(); g.arc(rnd() * w, rnd() * hh, 1 + rnd() * 1.5, 0, 7); g.fill(); }
  }, .3);

  const M = o => new THREE.MeshStandardMaterial({ roughness: .8, ...o });
  const mats = {
    floor: M({ map: oakFloor, roughness: .55 }), wall: M({ map: plaster, roughness: .95 }), cut: M({ color: 0x3b3833, roughness: .9 }),
    glass: new THREE.MeshPhysicalMaterial({ color: 0xdde8ec, roughness: .05, metalness: 0, transparent: true, opacity: .32, envMapIntensity: 1.4 }),
    frame: M({ color: 0x8f8a83, roughness: .45, metalness: .3 }),
    counter: M({ map: quartz, roughness: .3 }), front: M({ color: 0xe4ddd1, roughness: .55 }), plinth: M({ color: 0x6d675f, roughness: .8 }),
    groove: M({ color: 0x8b8378, roughness: .9 }), steel: M({ color: 0xc9cbcc, roughness: .28, metalness: .85 }),
    hob: M({ color: 0x1d1d1d, roughness: .15, metalness: .1 }), brass: M({ color: 0xb08d57, roughness: .35, metalness: .9 }),
    linen: M({ map: weave('#aab69c'), bumpMap: bumpWeave, bumpScale: .6, roughness: .95 }),
    linenDark: M({ map: weave('#98a58b'), bumpMap: bumpWeave, bumpScale: .6, roughness: .95 }),
    cushion: M({ map: weave('#e7dfd0'), bumpMap: bumpWeave, bumpScale: .5, roughness: .95 }),
    clay: M({ map: weave('#c98a6b'), bumpMap: bumpWeave, bumpScale: .5, roughness: .95 }),
    oak: M({ map: grain('#b98a5e', '#6b4628'), roughness: .5 }), oakLight: M({ map: grain('#d6b48c', '#8a6440'), roughness: .55 }),
    seat: M({ map: weave('#e3dacb'), bumpMap: bumpWeave, bumpScale: .4, roughness: .95 }),
    travertine: M({ map: travertine, roughness: .45 }), rug: M({ map: wool, roughness: 1 }),
    ceramic: M({ color: 0xe7dfd2, roughness: .6 }), terracotta: M({ color: 0xb9774f, roughness: .85 }),
    leaf: M({ color: 0x6f7d55, roughness: .8 }), leafDark: M({ color: 0x55633f, roughness: .8 }), bark: M({ color: 0x6b5a48, roughness: .9 }),
    book: M({ color: 0x8b5e4a, roughness: .8 }), bookB: M({ color: 0xd9cfbd, roughness: .8 }),
    path: M({ color: 0x4e5a33, roughness: .9 }), pathBad: M({ color: 0xb8452e, roughness: .9 })
  };
  function rbox(w, hh, d, r = .012) {
    r = Math.max(.001, Math.min(r, w / 2 - .001, d / 2 - .001, hh / 2 - .001));
    const x = w / 2 - r, z = d / 2 - r, s = new THREE.Shape();
    s.moveTo(-x, -z); s.lineTo(x, -z); s.lineTo(x, z); s.lineTo(-x, z); s.lineTo(-x, -z);
    const g = new THREE.ExtrudeGeometry(s, { depth: Math.max(.001, hh - 2 * r), bevelEnabled: true, bevelSize: r, bevelThickness: r, bevelSegments: 4, curveSegments: 6 });
    g.rotateX(-Math.PI / 2); g.translate(0, r, 0);
    return g;
  }
  // a box from plan px, cm heights, into a parent; local = relative to the parent's centre
  function block(parent, [x0, y0, x1, y1], hcm, mat, lift = 0, r = .012, local = null) {
    const w = (x1 - x0) * S, d = (y1 - y0) * S;
    const m = new THREE.Mesh(rbox(w, h(hcm), d, r), mat);
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    if (local) m.position.set((cx - local[0]) * S, h(lift), (cy - local[1]) * S);
    else m.position.set(wx(cx), h(lift), wz(cy));
    m.castShadow = m.receiveShadow = true; parent.add(m); return m;
  }
  function cyl(parent, x, y, rcm, hcm, mat, lift = 0, top = rcm, seg = 28) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(h(top), h(rcm), h(hcm), seg), mat);
    m.position.set(wx(x), h(lift + hcm / 2), wz(y)); m.castShadow = m.receiveShadow = true; parent.add(m); return m;
  }

  // ---- architecture
  for (const f of FLOORS) { const m = block(scene, f, 1, mats.floor, -1, .001); m.castShadow = false; }
  for (const w of WALLS) { block(scene, w, 105, mats.wall, 0, .002); block(scene, w, .6, mats.cut, 105, .001); }
  for (const [a, b] of FACADE.wall) { block(scene, [a, FACADE.y0, b, FACADE.y1], 105, mats.wall, 0, .002); block(scene, [a, FACADE.y0, b, FACADE.y1], .6, mats.cut, 105, .001); }
  for (const [a, b] of FACADE.glass) {
    block(scene, [a, FACADE.y0, b, FACADE.y1], 45, mats.wall, 0, .002);
    block(scene, [a, FACADE.y0 + 6, b, FACADE.y1 - 6], 3, mats.frame, 45, .002);
    for (const xx of [a, (a + b) / 2 - 1, b - 2]) block(scene, [xx, FACADE.y0 + 7, xx + 2, FACADE.y1 - 7], 60, mats.frame, 45, .002);
    const g = block(scene, [a, FACADE.y0 + 8, b, FACADE.y1 - 8], 60, mats.glass, 45, .001); g.castShadow = false;
  }
  // the kitchen: flat-front cabinets under a quartz top, the sink and tap, the hob, and a tall fridge column.
  // As drawn by the developer, an L along the west wall (oldKitchen); in the solution (owner, Nov 21:
  // "what if we move the kitchen to this wall?") one long run along the north wall (newKitchen)
  function kitchen(parent, runs, sinks, tap, hob, fridge) {
    for (const [x0, y0, x1, y1, face] of runs) {
      block(parent, [x0, y0, x1, y1], 8, mats.plinth, 0, .002);
      if (face === 'e') block(parent, [x0, y0, x1 - 1.5, y1], 80, mats.front, 8, .004);
      else block(parent, [x0, y0, x1, y1 - 1.5], 80, mats.front, 8, .004);
      block(parent, [x0 - .5, y0 - .5, x1 + 1, y1 + 1], 3.5, mats.counter, 88, .004);
      if (face === 'e') for (let y = y0 + 40; y < y1 - 5; y += 40) block(parent, [x1 - 1.7, y - .4, x1 - 1.1, y + .4], 78, mats.groove, 9, .001);
      else for (let x = x0 + 40; x < x1 - 5; x += 40) block(parent, [x - .4, y1 - 1.7, x + .4, y1 - 1.1], 78, mats.groove, 9, .001);
      if (face === 'e') for (let y = y0 + 20; y < y1; y += 40) block(parent, [x1 - 1.3, y - 6, x1 - .4, y + 6], 1.2, mats.brass, 80, .002);
      else for (let x = x0 + 20; x < x1; x += 40) block(parent, [x - 6, y1 - 1.3, x + 6, y1 - .4], 1.2, mats.brass, 80, .002);
    }
    for (const r of sinks) block(parent, r, 1, mats.steel, 90.6, .01);
    cyl(parent, tap[0], tap[1], 1.2, 26, mats.steel, 91.5);
    block(parent, hob, .8, mats.hob, 91.4, .004);
    const hx = (hob[0] + hob[2]) / 2, hy = (hob[1] + hob[3]) / 2, dx = (hob[2] - hob[0]) / 4, dy = (hob[3] - hob[1]) / 4;
    for (const [x, y] of [[hx - dx, hy - dy], [hx + dx, hy - dy], [hx - dx, hy + dy], [hx + dx, hy + dy]]) {
      const r = new THREE.Mesh(new THREE.TorusGeometry(h(8), h(.35), 6, 36), mats.steel); r.rotation.x = Math.PI / 2; r.position.set(wx(x), h(92.4), wz(y)); parent.add(r);
    }
    block(parent, fridge, 215, mats.front, 0, .006);
    block(parent, [fridge[0] + 4, fridge[3] - 2, fridge[0] + 6, fridge[3] - .4], 90, mats.brass, 95, .002);
  }
  const oldKitchen = new THREE.Group(); scene.add(oldKitchen);
  kitchen(oldKitchen, [[92, 340, 128, 562, 'e'], [92, 302, 208, 340, 's']], [[98, 396, 122, 428], [98, 430, 122, 458]], [96, 428], [98, 520, 124, 558], [210, 302, 262, 350]);
  const newKitchen = new THREE.Group(); scene.add(newKitchen);
  // the fridge column at the west end (owner), and a 40 cm closet back to back with the kitchen where the
  // run crosses the entrance hall, its doors facing the way in
  kitchen(newKitchen, [[135, 302, 405, 340, 's']], [[240, 306, 262, 334], [264, 306, 284, 334]], [263, 304], [160, 306, 202, 334], [93, 302, 135, 346]);
  block(newKitchen, [300, 278.5, 405, 302], 100, mats.front, 0, .004);
  for (let x = 300 + 26; x < 405 - 5; x += 26) block(newKitchen, [x - .4, 278.1, x + .4, 279], 92, mats.groove, 4, .001);
  for (let x = 300 + 13; x < 405; x += 26) block(newKitchen, [x - .5, 277.6, x + .5, 278.5], 14, mats.brass, 46, .002);
  block(newKitchen, [300, 278.5, 405, 302], .6, mats.cut, 100, .001);
  newKitchen.visible = false;
  // ---- furniture, each built at true size around its own centre; the sales size scales it
  const items = [];
  function piece(spec, build) {
    const g = new THREE.Group(); scene.add(g);
    const [x0, y0, x1, y1] = spec.true, c = [(x0 + x1) / 2, (y0 + y1) / 2];
    build(g, c);
    items.push({ g, spec, c, w: x1 - x0, d: y1 - y0 });
    return g;
  }
  const leg = (g, x, y, c, lift = 0, hcm = 8) => block(g, [x - 1.5, y - 1.5, x + 1.5, y + 1.5], hcm, mats.oak, lift, .003, c);
  // the sofa: a low linen sofa, its back along the west, facing the coffee table, with cushions
  piece(SOFA, (g, c) => {
    const [x0, y0, x1, y1] = SOFA.true;
    for (const [x, y] of [[x0 + 3, y0 + 3], [x1 - 3, y0 + 3], [x0 + 3, y1 - 3], [x1 - 3, y1 - 3]]) leg(g, x, y, c);
    block(g, [x0, y0, x1, y1], 30, mats.linenDark, 8, .035, c);
    block(g, [x0, y0 + 5, x0 + 10, y1 - 5], 42, mats.linen, 34, .05, c);
    block(g, [x0, y0, x1, y0 + 6], 26, mats.linen, 36, .03, c); block(g, [x0, y1 - 6, x1, y1], 26, mats.linen, 36, .03, c);
    const n = 3, sp = (y1 - y0 - 12) / n;
    for (let k = 0; k < n; k++) { const a = y0 + 6 + sp * k; block(g, [x0 + 10, a + .7, x1 - 1, a + sp - .7], 14, mats.linen, 36, .06, c); }
    for (const [ya, mat] of [[y0 + 10, mats.cushion], [y0 + 28, mats.clay], [y1 - 26, mats.cushion]]) { const m = block(g, [x0 + 10, ya, x0 + 16, ya + 16], 32, mat, 48, .06, c); m.rotation.z = -.25; }
  });
  // the loveseat: its back along the north, facing south
  piece(LOVESEAT, (g, c) => {
    const [x0, y0, x1, y1] = LOVESEAT.true;
    for (const [x, y] of [[x0 + 3, y0 + 3], [x1 - 3, y0 + 3], [x0 + 3, y1 - 3], [x1 - 3, y1 - 3]]) leg(g, x, y, c);
    block(g, [x0, y0, x1, y1], 30, mats.linenDark, 8, .035, c);
    block(g, [x0 + 5, y0, x1 - 5, y0 + 10], 42, mats.linen, 34, .05, c);
    block(g, [x0, y0, x0 + 6, y1], 26, mats.linen, 36, .03, c); block(g, [x1 - 6, y0, x1, y1], 26, mats.linen, 36, .03, c);
    const sp = (x1 - x0 - 12) / 2;
    for (let k = 0; k < 2; k++) { const a = x0 + 6 + sp * k; block(g, [a + .7, y0 + 10, a + sp - .7, y1 - 1], 14, mats.linen, 36, .06, c); }
    const m = block(g, [x1 - 24, y0 + 10, x1 - 8, y0 + 16], 32, mats.cushion, 48, .06, c); m.rotation.x = .25;
  });
  // the coffee table: a rounded block of travertine, with a bowl and a few books
  piece(COFFEE, (g, c) => {
    block(g, COFFEE.true, 38, mats.travertine, 0, .12, c);
    const [x0, y0, x1, y1] = COFFEE.true, cx = (x0 + x1) / 2;
    block(g, [cx - 8, y0 + 12, cx + 8, y0 + 26], 4, mats.bookB, 38, .004, c);
    const bowl = new THREE.Mesh(new THREE.SphereGeometry(h(10), 24, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), mats.ceramic);
    bowl.rotation.x = Math.PI; bowl.position.set(0, h(48), (y1 - 18 - c[1]) * S); bowl.castShadow = true; g.add(bowl);
  });
  // the dining table: oak top on tapered legs, a vase of olive branches in the middle
  piece(TABLE, (g, c) => {
    const [x0, y0, x1, y1] = TABLE.true;
    block(g, [x0, y0, x1, y1], 4, mats.oak, 72, .008, c);
    for (const [a, b] of [[x0 + 4, y0 + 5], [x1 - 7, y0 + 5], [x0 + 4, y1 - 8], [x1 - 7, y1 - 8]]) block(g, [a, b, a + 3, b + 3], 72, mats.oak, 0, .004, c);
    const v = new THREE.Mesh(new THREE.CylinderGeometry(h(5), h(7), h(22), 20), mats.ceramic);
    v.position.set(0, h(87), 0); v.castShadow = true; g.add(v);
    for (let i = 0; i < 7; i++) { const m = new THREE.Mesh(new THREE.IcosahedronGeometry(h(5 + rnd() * 3), 0), mats.leaf); m.position.set((rnd() - .5) * h(18), h(102 + rnd() * 14), (rnd() - .5) * h(18)); m.castShadow = true; g.add(m); }
  });
  let clashChair = null;
  for (const ch of chairs) {
    const g = piece(ch, (g, c) => {
      const [x0, y0, x1, y1] = ch.true, mat = ch.clash ? mats.oakLight.clone() : mats.oakLight;
      for (const [a, b] of [[x0 + 3, y0 + 3], [x1 - 5, y0 + 3], [x0 + 3, y1 - 5], [x1 - 5, y1 - 5]]) block(g, [a, b, a + 2, b + 2], 42, mat, 0, .003, c);
      block(g, [x0 + 2, y0 + 2, x1 - 2, y1 - 2], 3, mat, 42, .006, c);
      block(g, [x0 + 3, y0 + 3, x1 - 3, y1 - 3], 4, mats.seat, 45, .015, c);
      const back = { n: [x0 + 2, y1 - 4, x1 - 2, y1 - 2], s: [x0 + 2, y0 + 2, x1 - 2, y0 + 4], e: [x0 + 2, y0 + 2, x0 + 4, y1 - 2], w: [x1 - 4, y0 + 2, x1 - 2, y1 - 2] }[ch.face];
      block(g, back, 34, mat, 50, .008, c);
      if (ch.clash) clashChair = mat;
    });
    if (ch.clash) g.userData.clash = true;
  }
  // the TV console, and the rug under the seating: they move with the living room in the solution
  const CONSOLE = { sales: [489, 430, 505, 550], true: [489, 430, 505, 550] };
  piece(CONSOLE, (g, c) => {
    block(g, [489, 430, 505, 550], 46, mats.oak, 4, .01, c); block(g, [491, 432, 503, 548], 4, mats.plinth, 0, .002, c);
    const v = new THREE.Mesh(new THREE.CylinderGeometry(h(4), h(6), h(26), 20), mats.ceramic); v.position.set((497 - c[0]) * S, h(63), (450 - c[1]) * S); v.castShadow = true; g.add(v);
    block(g, [491, 505, 503, 530], 4, mats.bookB, 50, .004, c); block(g, [492, 507, 502, 528], 3, mats.book, 54, .004, c);
  });
  // an olive tree in a pot by the window
  const TREE = { sales: [157, 525, 187, 555], true: [157, 525, 187, 555] };
  piece(TREE, (g, c) => {
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(h(18), h(15), h(34), 28), mats.terracotta); pot.position.set(0, h(17), 0); pot.castShadow = true; g.add(pot);
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(h(1.2), h(1.8), h(80), 8), mats.bark); trunk.position.set(0, h(72), 0); g.add(trunk);
    for (let i = 0; i < 70; i++) {
      const a = rnd() * 7, rr = Math.sqrt(rnd()) * 24, y = 104 + rnd() * 46;
      const m = new THREE.Mesh(new THREE.IcosahedronGeometry(h(3 + rnd() * 3), 0), rnd() < .5 ? mats.leaf : mats.leafDark);
      m.position.set(Math.cos(a) * h(rr), h(y), Math.sin(a) * h(rr)); m.rotation.set(rnd() * 3, rnd() * 3, 0); m.castShadow = true; g.add(m);
    }
  });
  const RUG = { sales: [326, 446, 484, 556], true: [326, 446, 484, 556] };
  piece(RUG, (g, c) => { const m = block(g, RUG.true, .8, mats.rug, 0, .01, c); m.castShadow = false; });

  // ---- the path to the hallway, a dashed line on the floor
  function route(pts) {
    const list = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, ay] = pts[i], [bx, by] = pts[i + 1], len = Math.hypot(bx - ax, by - ay), n = Math.max(1, Math.round(len / 14));
      for (let k = 0; k < n; k++) {
        const t = (k + .25) / n, x = ax + (bx - ax) * t, y = ay + (by - ay) * t;
        const m = new THREE.Mesh(new THREE.BoxGeometry(7 * S, .004, 2.2 * S), mats.path);
        m.position.set(wx(x), .004, wz(y)); m.rotation.y = -Math.atan2(by - ay, bx - ax);
        m.userData.x = x; scene.add(m); list.push(m);
      }
    }
    const [ex, ey] = pts[pts.length - 1];
    const tip = new THREE.Mesh(new THREE.ConeGeometry(6 * S, 12 * S, 3), mats.path);
    tip.rotation.x = -Math.PI / 2; tip.position.set(wx(ex), .006, wz(ey - 6)); tip.scale.y = .1; scene.add(tip);
    return { list, tip };
  }
  const { list: dashes, tip } = route(ROUTE);
  const routeFix = route(ROUTE_FIX);
  const routeSol = route(ROUTE_SOL), routeKitchen = route(ROUTE_KITCHEN);
  const ring = new THREE.Mesh(new THREE.RingGeometry(22 * S, 26 * S, 40), new THREE.MeshBasicMaterial({ color: 0xb8452e, transparent: true }));
  ring.rotation.x = -Math.PI / 2; ring.position.set(wx(CLASH[0]), .006, wz(CLASH[1])); scene.add(ring);

  // what each piece does when the room is rearranged: undefined = stays, null = has no room
  items[0].re = RE_SOFA;
  items[1].re = null;                                                    // the loveseat
  items[2].re = null;                                                    // the coffee table
  items[3].re = RE_TABLE;
  chairs.forEach((ch, j) => { const r = RE_CHAIRS[j]; items[4 + j].re = r ? { c: r.c, rot: ANG[r.face] - ANG[ch.face] } : null; });
  items[1].fix = FIX_ARMCHAIR; items[3].fix = FIX_TABLE;
  chairs.forEach((ch, j) => { const r = FIX_CHAIRS[j]; items[4 + j].fix = r ? { c: r.c, rot: ANG[r.face] - ANG[ch.face] } : null; });
  items[0].sol = SOL.sofa; items[1].sol = SOL.loveseat; items[2].sol = SOL.coffee; items[3].sol = SOL.table;
  chairs.forEach((ch, j) => { const [x, y, f] = SOL.chairs[j]; items[4 + j].sol = { c: [x, y], rot: ANG[f] - ANG[ch.face] }; });
  items[13].sol = SOL.tree; items[14].sol = SOL.rug;
  // where the loveseat stood: a pale footprint when it has to go
  const ghost = new THREE.Mesh(new THREE.PlaneGeometry((LOVESEAT.true[2] - LOVESEAT.true[0]) * S, (LOVESEAT.true[3] - LOVESEAT.true[1]) * S),
    new THREE.MeshBasicMaterial({ color: 0xb8452e, transparent: true, opacity: 0, depthWrite: false }));
  ghost.rotation.x = -Math.PI / 2; ghost.position.set(wx((LOVESEAT.true[0] + LOVESEAT.true[2]) / 2), .007, wz((LOVESEAT.true[1] + LOVESEAT.true[3]) / 2)); scene.add(ghost);

  // ---- the switch between the three layouts
  const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  const lerp = (a, b, t) => a + (b - a) * t;
  const angLerp = (a, b, t) => { let d = b - a; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return a + d * t; };
  const ok = new THREE.Color(0xffffff), bad = new THREE.Color(0xe0614a);
  function targetOf(it, st) {
    const tc = it.c, base = { x: tc[0], y: tc[1], sx: 1, sz: 1, r: 0, v: 1 };
    if (st === 'true') return base;
    if (st === 'sales') {
      const s = it.spec.sales;
      if (!s) return { ...base, v: 0 };
      return { x: (s[0] + s[2]) / 2, y: (s[1] + s[3]) / 2, sx: (s[2] - s[0]) / it.w, sz: (s[3] - s[1]) / it.d, r: 0, v: 1 };
    }
    const alt = st === 'fix' ? it.fix : st === 'sol' ? it.sol : it.re;
    if (alt === undefined) return base;
    if (alt === null) return { ...base, v: 0 };
    return { x: alt.c[0], y: alt.c[1], sx: alt.sx || 1, sz: alt.sz || 1, r: alt.rot || 0, v: 1 };
  }
  const weights = st => ({ bad: st === 'true' ? 1 : 0, re: st === 're' ? 1 : 0, fix: st === 'fix' ? 1 : 0, sol: st === 'sol' ? 1 : 0 });
  let W = weights('true'), Wfrom = W, Wto = W;
  for (const it of items) it.cur = targetOf(it, 'true');
  let fromP = [], toP = [], t0 = 0, anim = 0;
  function apply(p) {
    items.forEach((it, i) => {
      const q = p[i]; it.cur = q;
      it.g.position.set(wx(q.x), 0, wz(q.y)); it.g.rotation.y = q.r;
      it.g.scale.set(q.sx, Math.max(q.v, .001), q.sz); it.g.visible = q.v > .02;
    });
    if (clashChair) clashChair.color.copy(ok).lerp(bad, W.bad);
    for (const m of dashes) m.material = W.bad > .5 && m.userData.x > 360 ? mats.pathBad : mats.path;
    tip.material = W.bad > .5 ? mats.pathBad : mats.path;
    ring.visible = W.bad > .05; ring.material.opacity = W.bad;
    ghost.visible = W.re > .05; ghost.material.opacity = .18 * W.re;
    const way = W.fix > .5 ? 'fix' : W.sol > .5 ? 'sol' : 'base';
    const show = (r, on) => { for (const m of r.list) m.visible = on; r.tip.visible = on; };
    show({ list: dashes, tip }, way === 'base'); show(routeFix, way === 'fix'); show(routeSol, way === 'sol'); show(routeKitchen, way === 'sol');
    oldKitchen.scale.y = Math.max(1 - W.sol, .001); oldKitchen.visible = W.sol < .98;
    newKitchen.scale.y = Math.max(W.sol, .001); newKitchen.visible = W.sol > .02;
  }
  const TEXT = {
    sales: 'As the sales plan draws it: the table looks small, and there’s a clear path between it and the loveseat to the hallway.',
    true: 'At true size, the table and its chairs take far more room: the end chair runs into the loveseat, and the path to the hallway closes.',
    fix: 'Second try: turn the table across the room. It seats eight with both heads, but the way from the front door into the kitchen squeezes to about 26 in, between the fridge and the head chair.',
    sol: 'The solution: move the kitchen to the wall along the entrance, with a 16 in closet back to back with it facing the way in. The dining table then runs along the windows and seats eight with both heads, the living room gets its own corner facing the TV, and the ways to the kitchen and the bedrooms stay clear.',
    re: 'First try: swap the areas. Nothing collides and the path to the bedrooms opens, but the dining table takes over the living room, and the seating area shrinks to a single sofa at the entrance.'
  };
  let size = 'true';
  function setSize(st, instant) {
    size = st;
    sw.querySelectorAll('[data-size]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.size === st)));
    status.textContent = TEXT[st];
    fromP = items.map(it => ({ ...it.cur })); toP = items.map(it => targetOf(it, st));
    Wfrom = { ...W }; Wto = weights(st); t0 = performance.now();
    if (instant || reduce) { W = Wto; apply(toP); controls && controls.render(); return; }
    if (!anim) anim = requestAnimationFrame(step);
  }
  function step(now) {
    anim = 0;
    const p = Math.min(1, (now - t0) / 1300), e = ease(p);
    W = {}; for (const key in Wto) W[key] = lerp(Wfrom[key], Wto[key], e);
    apply(fromP.map((a, i) => { const b = toP[i]; return { x: lerp(a.x, b.x, e), y: lerp(a.y, b.y, e), sx: lerp(a.sx, b.sx, e), sz: lerp(a.sz, b.sz, e), r: angLerp(a.r, b.r, e), v: lerp(a.v, b.v, e) }; }));
    controls.render();
    if (p < 1) anim = requestAnimationFrame(step);
  }
  // Play: the whole search, one step after another, from the sales plan to the solution
  const ORDER = ['sales', 'true', 're', 'fix', 'sol'];
  const playBtn = sw.querySelector('[data-play]');
  let playTimer = 0;
  const stopPlay = () => { clearTimeout(playTimer); playTimer = 0; playBtn.setAttribute('aria-pressed', 'false'); };
  function playFrom(i) {
    setSize(ORDER[i]);
    if (i < ORDER.length - 1) playTimer = setTimeout(() => playFrom(i + 1), reduce ? 2500 : 4200);
    else stopPlay();
  }
  sw.addEventListener('click', e => {
    if (e.target.closest('[data-play]')) { if (playTimer) stopPlay(); else { playBtn.setAttribute('aria-pressed', 'true'); playFrom(0); } return; }
    const b = e.target.closest('[data-size]'); if (!b) return;
    stopPlay(); if (b.dataset.size !== size) setSize(b.dataset.size);
  });

  // the tags follow their spots on screen: the clash at true size, the compromises when rearranged
  const TAGS = [
    { el: clashTag, at: new THREE.Vector3(wx(CLASH[0]), h(95), wz(CLASH[1])), w: () => W.bad },
    { el: fourTag, at: new THREE.Vector3(wx(415), h(95), wz(251)), w: () => W.re },
    { el: loveTag, at: new THREE.Vector3(wx(415), h(40), wz(404)), w: () => W.re },
    { el: fixTags[0], at: new THREE.Vector3(wx(380), h(80), wz(372)), w: () => W.fix },
    { el: fixTags[1], at: new THREE.Vector3(wx(282), h(80), wz(338)), w: () => W.fix },
    { el: solTags[0], at: new THREE.Vector3(wx(250), h(110), wz(321)), w: () => W.sol },
    { el: solTags[1], at: new THREE.Vector3(wx(352), h(108), wz(290)), w: () => W.sol },
    { el: solTags[2], at: new THREE.Vector3(wx(214), h(95), wz(460)), w: () => W.sol },
    { el: fixTags[2], at: new THREE.Vector3(wx(530), h(10), wz(300)), w: () => W.fix }
  ];
  function onRender() {
    const w = view.clientWidth, hh = view.clientHeight;
    for (const t of TAGS) {
      const p = t.at.clone().project(camera);
      const x = (p.x * .5 + .5) * w, y = (-p.y * .5 + .5) * hh;
      const show = t.w() > .9 && p.z < 1 && x > 20 && x < w - 20 && y > 20 && y < hh - 20;
      t.el.style.visibility = show ? 'visible' : 'hidden';
      if (show) t.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -100%)`;
    }
  }

  // ---- camera and controls (turn, move, zoom, reset), shared with the other models
  const target = new THREE.Vector3(wx(390), 0, wz(380));
  const fromPos = target.clone().add(new THREE.Vector3(-6.4, 12, 11.1));
  camera.position.copy(fromPos); camera.lookAt(target);
  const { modelControls } = await import('./model-controls.js');
  const controls = modelControls({ THREE, renderer, scene, camera, view, rooms: [], from: fromPos, target, bounds: [wx(120), wx(620), wz(200), wz(560)], onRender });
  function resize() {
    const w = view.clientWidth, hh = view.clientHeight;
    renderer.setSize(w, hh, false);
    camera.aspect = w / hh; camera.updateProjectionMatrix();
    controls.render();
  }
  new ResizeObserver(resize).observe(view);
  setSize('true', true);
  controls.show();
  resize();
  window.__fs3d = { setSize, renderer, render: () => controls.render() };
}
