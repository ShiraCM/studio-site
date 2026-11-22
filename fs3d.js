/* Apartment 12 (project-furniture-study.html): the living and dining room as a live 3D model.
   Owner, Nov 21: "lets improve the 3d model" → a real model like Kaduri and Neve Amim, with the two
   drag-to-compare pictures kept as the fallback (no WebGL, or before three.js loads).
   A "Sales plan | True size" switch moves the furniture between the size the developer's sales plan
   draws it and its real size: the dining table grows, the chairs grow and two end chairs appear, and at
   true size the end chair runs into the loveseat and the path to the hallway closes.
   Measured from the two plans (furniture-1-sales / furniture-1-scaled, 1126 × 756 px): about 1.5 cm per
   px (the six-seat table, 90 × 193 cm, is 60 × 129 px). Walls are full height (WALL_H, 260 cm; Nov 22). */
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
  [506, 355, 660, 362], [708, 355, 716, 583],                          // the bedroom beside the living room: north wall to its door, east wall
  [603, 140, 613, 290]                                                 // the bathroom along the hallway
];
const WALL_H = 260;   // full-height walls (owner, Nov 22: "pull up the walls to full height"); they were cut at 105 cm
const FACADE = { y0: 562, y1: 580, wall: [[78, 105], [173, 196], [263, 320], [467, 564], [627, 716]], glass: [[105, 173], [196, 263], [320, 467], [564, 627]] };
const FLOORS = [[92, 302, 506, 562], [300, 175, 400, 302], [400, 224, 532, 302], [506, 302, 541, 355], [541, 224, 603, 355], [513, 355, 708, 562], [506, 355, 513, 562], [603, 290, 716, 355]];   // the last: the hallway outside the bedroom door
// The bedroom's west wall (and the start of its north wall), which Option 3 moves 1 m east (owner, Nov 22;
// the bedroom is 334 cm wide inside, x 513–709 on the plan).
const BWALL_OLD = [[506, 362, 513, 583]];   // the bedroom's north wall is structural and stays (owner, Nov 22)
const BWALL_NEW = [[565, 362, 572, 583]];

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
// The way to the bedrooms at true size, from the front door: it runs into the table and the end chair (red past x 360).
// No path is shown on the sales plan (owner, Nov 22).
const ROUTE = [[345, 190], [350, 300], [350, 345], [515, 334], [566, 314], [572, 244]];
const CLASH = [436, 412];
// Rearranged (owner, Nov 21: "show the furniture being rearranged so it doesn't bump into each other and
// doesn't block the pathway to the bedrooms … the point is to show that the alternatives aren't great"):
// owner: "the table has to go where the seating is currently". The dining table turns and moves into the
// living area by the windows, with all eight chairs; the sofa turns and goes into the dining nook, its
// back to the nook's wall, facing the table; the loveseat and the coffee table have no room left.
// The path to the bedrooms opens.
const RE_TABLE = { c: [392, 500], rot: Math.PI / 2 };
const RE_SOFA = { c: [461.5, 251], rot: -Math.PI / 2 };   // pushed into the nook's corner, out of the way in (owner)
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
// Option 2, redone (owner, Nov 22: "rotate the table 90 degrees. instead of a whole seating thing, do a L
// shaped sectional against the bedroom wall and sliding door wall with a coffee table"): the table runs
// north-south beside the kitchen, eight seats with both heads; an L sectional fills the corner of the
// bedroom wall and the window wall, a coffee table in front of it. Sofa, loveseat and TV console go.
// Then (owner, Nov 22): the kitchen becomes one run along the west (back) wall with the fridge, a 110 cm
// aisle, then a peninsula off the window wall; the living room moves to the sliding doors: a three-seat
// sofa with its back to them, a chair each side, a coffee table. The table turns across the room.
// Then (owner, Nov 22: "switch the couch area with the table and still have a normal setup"): the table
// runs east-west along the sliding doors, eight seats with both heads; the sofa backs onto it, facing a TV
// console on the nook wall, with a coffee table and one armchair (a second one would block the step down
// from the entrance). The peninsula is 70 cm deep, with seats at its north end.
// Then (owner, Nov 22: "still not loving option 2"): the kitchen goes back to the developer's L, mirrored:
// the long run on the west wall, its foot along the window wall (the fridge stays at the north end, not
// in front of the window); the table, eight seats with both heads, moves up into the corner where the
// L's foot and fridge stood; an L sectional fills the corner of the bedroom wall and the sliding doors,
// with a coffee table and rug.
// Then (owner, Nov 22: "rotate the table 90 degree"): the table runs east-west, 100 cm from the kitchen
// run at its west head and about 66 cm below the north wall, so the way from the entrance to the kitchen
// stays open behind the north chairs.
// Then (owner, Nov 22): the kitchen goes back to the developer's L as drawn (fixKitchen is no longer
// shown), and the table moves down toward the window wall.
// Then (owner, Nov 22): a bit toward the kitchen (17 cm) and 50 cm off the windows.
const FIX_TABLE = { c: [270.5, 468.6], rot: Math.PI / 2 };
const FIX_CHAIRS = {
  0: { c: [228, 424.1], face: 's' }, 2: { c: [270.5, 424.1], face: 's' }, 4: { c: [313, 424.1], face: 's' },
  1: { c: [228, 513.1], face: 'n' }, 3: { c: [270.5, 513.1], face: 'n' }, 5: { c: [313, 513.1], face: 'n' },
  6: { c: [191.5, 468.6], face: 'e' }, 7: { c: [349.5, 468.6], face: 'w' }
};
// Then (owner, Nov 22): the sectional runs the whole bedroom wall, four seats, with one seat turning
// toward the kitchen; the coffee table and rug turn to follow it. The kitchen's foot is a little longer.
const SECTIONAL = { sales: null, true: [394, 362, 506, 562] };
const FIX_COFFEE = { c: [415, 440] };
const FIX_RUG = { c: [440, 455], rot: Math.PI / 2 };
const FIX_TREE = { c: [372, 545] };
// Then (owner, Nov 22): an entry closet, 60 cm deep, along the nook's north wall where the path ran; the
// path to the bedrooms now passes in front of it.
const ENTRY_CLOSET = { sales: null, true: [400, 224, 532, 259] };   // the full nook wall, 215 cm tall like the fridge
const ROUTE_FIX = [[345, 190], [350, 285], [495, 285], [524, 318], [566, 314], [572, 244]];
// The solution (owner, Nov 21: the bedroom wall stays; "what if we move the kitchen to this wall?"): the
// kitchen becomes one long run along the north wall, backing onto the entrance hall. The dining table then
// runs east-west along the windows, eight seats with both heads; the living room takes the east side, the
// sofa's back to the table, facing the TV on the bedroom wall, the loveseat along the windows.
const SOL = {
  sofa: { c: [362, 470.5] }, loveseat: { c: [441, 532.5], rot: Math.PI }, coffee: { c: [428.5, 470] },
  table: { c: [214.5, 460], rot: Math.PI / 2 }, rug: { c: [420, 470] }, tree: { c: [312, 545] },
  chairs: { 0: [172, 415.5, 's'], 2: [215, 415.5, 's'], 4: [257, 415.5, 's'], 1: [172, 504.5, 'n'], 3: [215, 504.5, 'n'], 5: [257, 504.5, 'n'], 6: [135.5, 460, 'e'], 7: [293.5, 460, 'w'] }
};
// Then (owner, Nov 22: "sectional against the bedroom wall and window wall"): Option 2 uses the same corner
// sectional, coffee table and rug as Option 1; its sofa, loveseat and TV console go.
// Then (owner, Nov 22): in Option 2 the corner sectional loses the seat nearest the hallway (it made the way
// in too tight): three seats along the bedroom wall, the corner one included, and one along the windows.
const SOL_SOFA4 = { sales: null, true: [394, 413, 506, 562] };
// Option 3 (owner, Nov 22: "move the bedroom wall over 1 meter, show how there is still room for a bed with a
// trundle and a small closet. put a proper sitting area - still with the sectional but add 2 arm chairs and
// a larger rug"): the developer's kitchen and Option 1's table and entry closet; the sectional moves east
// with the wall, two armchairs face it across the coffee table, one larger rug under the seating.
const BIG_SECTIONAL = { sales: null, true: [453, 413, 565, 562] };
const BIG_ARMCHAIRS = { sales: null, true: [395, 412, 439, 506] };
const BEDROOM3 = { sales: null, true: [572, 362, 709, 562] };
const BIG_ENTRY_TOP = { sales: null, true: [400, 224, 532, 259] };   // Option 3: the entry closet topped up to the ceiling
// Option 4 (owner, Nov 22, her drawing; replaces the first "crazy idea"): a U-shaped kitchen in the
// developer's kitchen corner (north wall, west wall, and a run facing back into it); behind that run, along the
// windows, a small bedroom (thin walls) with a twin bed whose trundle pulls out 50 cm and a closet; the dining
// table in the middle; the bedroom beside the living room opens up (its west wall comes out) and becomes the
// living room: the sectional, two armchairs, a coffee table and rug. Entry closet as in Option 1.
const U4_WALLS = [[92, 443, 308, 448], [301, 448, 308, 513]];   // 25 cm narrower (owner, Nov 22)
const U4_TABLE = { c: [410, 420] };
const U4_CHAIRS = {
  0: [365.5, 381, 'e'], 2: [365.5, 420, 'e'], 4: [365.5, 459, 'e'], 1: [454.5, 381, 'w'], 3: [454.5, 420, 'w'], 5: [454.5, 459, 'w'],
  6: [410, 341, 's'], 7: [410, 499, 'n']
};
const U4_BEDROOM = { sales: null, true: [92, 448, 301, 530] };
const U4_ENTRY = { sales: null, true: [400, 224, 532, 259] };   // Option 4: the entry closet to the ceiling, 10 cm shorter at the entrance end, with a wall there
const U4_SECT = { sales: null, true: [596, 413, 708, 562] };
const U4_ARMS = { sales: null, true: [513, 405, 557, 499] };
const ROUTE_U4 = [[345, 190], [350, 285], [495, 285], [524, 318], [566, 314], [572, 244]];
// Walking access (owner, Nov 22: "kitchen, dining, bedrooms" only; a path must never cross a wall): from the
// entrance to the kitchen and to the dining table (Option 4 also into the living room, through the opening where
// the old bedroom's wall stood, and on through its old door to the bedroom hallway, owner Nov 22), added to each option's path to the bedrooms (Option 2's
// kitchen path is ROUTE_KITCHEN). Every segment was checked against the walls and the fridge.
const ACCESS = {
  true: [[[350, 300], [300, 365], [165, 380]], [[350, 300], [372, 330]]],   // at true size the kitchen and the table can still be reached
  fix: [[[350, 285], [300, 375], [165, 385]], [[350, 285], [380, 440]]],
  big: [[[350, 285], [300, 375], [165, 385]], [[350, 285], [380, 440]]],
  sol: [[[430, 372], [340, 455]]],
  u4: [[[350, 285], [320, 320], [315, 375], [270, 378]], [[350, 285], [372, 338]], [[315, 375], [330, 400], [330, 535], [285, 540]], [[350, 285], [480, 335], [492, 385], [575, 385], [684, 385], [684, 325]]],
  f5: [[[350, 285], [300, 380], [150, 392]], [[350, 285], [470, 330], [494, 395], [512, 418]]]
};
// Option 5, the plan we built at Neve Amim (Neve Amim page only, owner, Nov 22: "decided on option 5 - gave up a
// bedroom so there could be ample living space and a large kitchen"). Taken from al3d.js, whose plan is the same
// apartment at about 2 px per plan px here: NX / NY turn its plan px into this plan's px.
const NX = n => 92 + (n - 64) / 2.029, NY = n => 302 + (n - 608) / 2.023;
const NR = ([x0, y0, x1, y1]) => [NX(x0), NY(y0), NX(x1), NY(y1)];
const F5_WALLS = [[506, 362, 513, 381], [653, 362, 660, 381]];   // the two short walls either side of the sefarim bookcase
const F5_ISLAND = { sales: null, true: NR([230, 790, 420, 976]) };   // the island and its two stools
const F5_LIVING = { sales: null, true: NR([524, 712, 864, 1112]) };   // rug, sofa, two swivel chairs, round coffee table
const F5_TABLE = { c: [582 + 20 / CM, 465], rot: Math.PI / 2 };   // the table from the other options, across the old bedroom, eight seats with both heads; 20 cm toward the east wall once the sideboard went (owner, Nov 22)
const F5_BOOKS = { sales: null, true: [513, 362, 653, 379] };       // the sefarim bookcase on the hall wall, to the ceiling
const ROUTE_SOL = [[345, 190], [350, 258], [480, 264], [524, 318], [566, 314], [572, 244]];
const ROUTE_KITCHEN = [[470, 280], [478, 335], [430, 372], [300, 372], [150, 372]];

const box = document.querySelector('.fs3d[data-three]');
const PROCESS = !!box && box.dataset.mode === 'process';
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
  // On the Neve Amim page (data-mode="process") the same model tells the design process: Options 1 to 5, no
  // sales plan or true-size views (owner, Nov 22)
  if (PROCESS) sw.setAttribute('aria-label', 'Layout options');
  sw.innerHTML = (PROCESS ? '' : '<button type="button" class="m3d-btn m3d-txt" data-size="sales" aria-pressed="false">Sales plan</button>' +
                 '<button type="button" class="m3d-btn m3d-txt" data-size="true" aria-pressed="true">True size</button>') +
                 '<button type="button" class="m3d-btn m3d-txt" data-size="fix" aria-pressed="false">Option 1</button>' +
                 '<button type="button" class="m3d-btn m3d-txt" data-size="sol" aria-pressed="false">Option 2</button>' +
                 '<button type="button" class="m3d-btn m3d-txt" data-size="big" aria-pressed="false">Option 3</button>' +
                 '<button type="button" class="m3d-btn m3d-txt" data-size="u4" aria-pressed="false">Option 4</button>' +
                 (PROCESS ? '<button type="button" class="m3d-btn m3d-txt" data-size="f5" aria-pressed="false">Option 5</button>' : '') +
                 '<button type="button" class="m3d-btn m3d-txt fs-play" data-play aria-pressed="false">▶ Play</button>';
  view.append(sw);
  const clashTag = document.createElement('span');
  clashTag.className = 'fs-clash'; clashTag.textContent = 'Chair meets sofa';
  view.append(clashTag);
  const fourTag = document.createElement('span'); fourTag.className = 'fs-clash fs-note-tag'; fourTag.textContent = 'The seating area, at the entrance'; view.append(fourTag);
  const loveTag = document.createElement('span'); loveTag.className = 'fs-clash fs-note-tag'; loveTag.textContent = 'No room for the loveseat or coffee table'; view.append(loveTag);
  const fixTags = ['Seats eight, with both heads', 'The kitchen, as the developer drew it', 'Clear path to the bedrooms', 'A sectional in the corner', 'An entry closet'].map(t => { const el = document.createElement('span'); el.className = 'fs-clash fs-fix-tag'; el.textContent = t; view.append(el); return el; });
  const solTags = ['The kitchen, along this wall', 'A 16 in closet behind the kitchen', 'Seats eight, with both heads'].map(t => { const el = document.createElement('span'); el.className = 'fs-clash fs-fix-tag'; el.textContent = t; view.append(el); return el; });
  const bigTags = ['The bedroom wall, moved 3 ft 3 in', 'A bed with a trundle, and a small closet', 'A sitting area for six'].map(t => { const el = document.createElement('span'); el.className = 'fs-clash fs-fix-tag'; el.textContent = t; view.append(el); return el; });
  const u4Tags = ['A bedroom with a trundle and a closet', 'A U-shaped kitchen', 'Seats eight, with both heads', 'The living room, in the old bedroom'].map(t => { const el = document.createElement('span'); el.className = 'fs-clash fs-fix-tag'; el.textContent = t; view.append(el); return el; });
  const status = document.createElement('p');
  status.className = 'cap fs-status'; status.setAttribute('aria-live', 'polite');
  box.querySelector('.compare, .fs-slot').before(view);
  view.after(status);
  const when = box.querySelector('.titleblock .when');
  if (when) when.textContent = PROCESS ? 'Turn it · switch options' : 'Turn it · switch sizes';

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
    path: new THREE.MeshBasicMaterial({ color: 0x55633a }), pathBad: new THREE.MeshBasicMaterial({ color: 0xb8452e })
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
  for (const w of WALLS) { block(scene, w, WALL_H, mats.wall, 0, .002); block(scene, w, .6, mats.cut, WALL_H, .001); }
  const wallOld = new THREE.Group(), wallNew = new THREE.Group(); scene.add(wallOld, wallNew);
  for (const w of BWALL_OLD) { block(wallOld, w, WALL_H, mats.wall, 0, .002); block(wallOld, w, .6, mats.cut, WALL_H, .001); }
  for (const w of BWALL_NEW) { block(wallNew, w, WALL_H, mats.wall, 0, .002); block(wallNew, w, .6, mats.cut, WALL_H, .001); }
  wallNew.visible = false;
  const u4Walls = new THREE.Group(); scene.add(u4Walls); u4Walls.visible = false;
  for (const w of U4_WALLS) { block(u4Walls, w, WALL_H, mats.wall, 0, .002); block(u4Walls, w, .6, mats.cut, WALL_H, .001); }
  const f5Walls = new THREE.Group(); scene.add(f5Walls); f5Walls.visible = false;
  for (const w of F5_WALLS) { block(f5Walls, w, WALL_H, mats.wall, 0, .002); block(f5Walls, w, .6, mats.cut, WALL_H, .001); }
  for (const [a, b] of FACADE.wall) { block(scene, [a, FACADE.y0, b, FACADE.y1], WALL_H, mats.wall, 0, .002); block(scene, [a, FACADE.y0, b, FACADE.y1], .6, mats.cut, WALL_H, .001); }
  for (const [a, b] of FACADE.glass) {
    block(scene, [a, FACADE.y0, b, FACADE.y1], 45, mats.wall, 0, .002);
    block(scene, [a, FACADE.y0 + 6, b, FACADE.y1 - 6], 3, mats.frame, 45, .002);
    for (const xx of [a, (a + b) / 2 - 1, b - 2]) block(scene, [xx, FACADE.y0 + 7, xx + 2, FACADE.y1 - 7], 192, mats.frame, 45, .002);
    block(scene, [a, FACADE.y0 + 6, b, FACADE.y1 - 6], 3, mats.frame, 237, .002);
    block(scene, [a, FACADE.y0, b, FACADE.y1], WALL_H - 240, mats.wall, 240, .002); block(scene, [a, FACADE.y0, b, FACADE.y1], .6, mats.cut, WALL_H, .001);
    const g = block(scene, [a, FACADE.y0 + 8, b, FACADE.y1 - 8], 195, mats.glass, 45, .001); g.castShadow = false;
  }
  // the kitchen: flat-front cabinets under a quartz top, the sink and tap, the hob, and a tall fridge column.
  // As drawn by the developer, an L along the west wall (oldKitchen); in the solution (owner, Nov 21:
  // "what if we move the kitchen to this wall?") one long run along the north wall (newKitchen)
  function kitchen(parent, runs, sinks, tap, hob, fridge) {
    for (const [x0, y0, x1, y1, face] of runs) {
      block(parent, [x0, y0, x1, y1], 8, mats.plinth, 0, .002);
      if (face === 'e') block(parent, [x0, y0, x1 - 1.5, y1], 80, mats.front, 8, .004);
      else if (face === 'w') block(parent, [x0 + 1.5, y0, x1, y1], 80, mats.front, 8, .004);
      else if (face === 'n') block(parent, [x0, y0 + 1.5, x1, y1], 80, mats.front, 8, .004);
      else block(parent, [x0, y0, x1, y1 - 1.5], 80, mats.front, 8, .004);
      block(parent, [x0 - .5, y0 - .5, x1 + 1, y1 + 1], 3.5, mats.counter, 88, .004);
      if (face === 'e') for (let y = y0 + 40; y < y1 - 5; y += 40) block(parent, [x1 - 1.7, y - .4, x1 - 1.1, y + .4], 78, mats.groove, 9, .001);
      else if (face === 'w') for (let y = y0 + 40; y < y1 - 5; y += 40) block(parent, [x0 + 1.1, y - .4, x0 + 1.7, y + .4], 78, mats.groove, 9, .001);
      else if (face === 'n') for (let x = x0 + 76; x < x1 - 5; x += 40) block(parent, [x - .4, y0 + 1.1, x + .4, y0 + 1.7], 78, mats.groove, 9, .001);
      else for (let x = x0 + 40; x < x1 - 5; x += 40) block(parent, [x - .4, y1 - 1.7, x + .4, y1 - 1.1], 78, mats.groove, 9, .001);
      if (face === 'e') for (let y = y0 + 20; y < y1; y += 40) block(parent, [x1 - 1.3, y - 6, x1 - .4, y + 6], 1.2, mats.brass, 80, .002);
      else if (face === 'w') for (let y = y0 + 20; y < y1; y += 40) block(parent, [x0 + .4, y - 6, x0 + 1.3, y + 6], 1.2, mats.brass, 80, .002);
      else if (face === 'n') for (let x = x0 + 56; x < x1; x += 40) block(parent, [x - 6, y0 + .4, x + 6, y0 + 1.3], 1.2, mats.brass, 80, .002);
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
  // Option 2's kitchen (owner, Nov 22): the developer's L mirrored, its foot along the window wall; the
  // fridge column at the north end of the long run
  const fixKitchen = new THREE.Group(); scene.add(fixKitchen);
  kitchen(fixKitchen, [[92, 346, 128, 524, 'e'], [92, 524, 238, 562, 'n']], [[98, 420, 122, 442], [98, 444, 122, 466]], [96, 443], [160, 530, 202, 556], [92, 302, 135, 346]);
  // Option 4's U-shaped kitchen in the developer's kitchen corner
  const uKitchen = new THREE.Group(); scene.add(uKitchen); uKitchen.visible = false;
  kitchen(uKitchen, [[92, 302, 250, 338, 's'], [92, 338, 129, 407, 'e'], [92, 407, 307, 443, 'n']], [[170, 307, 194, 333], [196, 307, 220, 333]], [195, 305], [98, 350, 124, 395], [250, 302, 298, 346]);
  const newKitchen = new THREE.Group(); scene.add(newKitchen);
  // the fridge column at the west end (owner), the run ending 1.2 m short of the short wall (owner), and a
  // 40 cm closet back to back with the kitchen where the
  // run crosses the entrance hall, its doors facing the way in
  kitchen(newKitchen, [[135, 302, 461, 340, 's']], [[240, 306, 262, 334], [264, 306, 284, 334]], [263, 304], [160, 306, 202, 334], [93, 302, 135, 346]);
  block(newKitchen, [300, 278.5, 461, 302], 180, mats.front, 0, .004);   // 180 cm tall (owner, Nov 22)
  for (let x = 300 + 26; x < 461 - 5; x += 26) block(newKitchen, [x - .4, 278.1, x + .4, 279], 172, mats.groove, 4, .001);
  for (let x = 300 + 13; x < 461; x += 26) block(newKitchen, [x - .5, 277.6, x + .5, 278.5], 40, mats.brass, 70, .002);
  newKitchen.visible = false;
  // Option 5's large kitchen (al3d.js): a U along the west wall and under the windows, the hob under the first
  // window and a second sink under the second, two rows of uppers on the back wall, and tall units with the
  // fridge and an oven at eye level along the whole north wall, to the entry corner
  const f5Kitchen = new THREE.Group(); scene.add(f5Kitchen); f5Kitchen.visible = false;
  kitchen(f5Kitchen, [[92, NY(678), NX(134), 562, 'e'], [NX(134), NY(1064), NX(380), 562, 'n']], [[98, NY(850), 120, NY(916)], [NX(300), NY(1076), NX(356), NY(1118)]], [95, NY(883)], [NR([110, 1078, 170, 1126])[0], NY(1078), NR([110, 1078, 170, 1126])[2], NY(1126)], [92, 302, NX(124), NY(678)]);
  block(f5Kitchen, [NX(124), 302, NX(454), NY(678)], 224, mats.front, 8, .006);
  block(f5Kitchen, [NX(124), 302.5, NX(454), NY(678) - .5], 8, mats.plinth, 0, .002);
  for (let xx = 154; xx < 454; xx += 60) block(f5Kitchen, [NX(xx) - .4, NY(678) - .3, NX(xx) + .4, NY(678) + .4], 222, mats.groove, 9, .001);
  block(f5Kitchen, [NX(140), NY(678) - .2, NX(180), NY(678) + .6], 40, mats.hob, 120, .002);   // the oven at eye level
  block(f5Kitchen, [92, NY(700), NX(102), NY(1050)], 104, mats.front, 145, .006);          // two rows of uppers
  for (const yy of [770, 840, 910, 980]) block(f5Kitchen, [NX(102) - .3, NY(yy) - .4, NX(102) + .4, NY(yy) + .4], 100, mats.groove, 147, .001);
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
  // Option 2's L-shaped sectional: one arm along the bedroom wall, one along the window wall
  piece(SECTIONAL, (g, c) => {
    const E = [453, 362, 506, 562], Sx = [394, 509, 453, 562];
    for (const [x, y] of [[456, 365], [503, 365], [503, 559], [397, 512], [397, 559], [450, 512]]) leg(g, x, y, c);
    block(g, E, 30, mats.linenDark, 8, .035, c); block(g, Sx, 30, mats.linenDark, 8, .035, c);
    block(g, [496, 362, 506, 562], 42, mats.linen, 34, .05, c); block(g, [394, 552, 506, 562], 42, mats.linen, 34, .05, c);
    block(g, [453, 362, 506, 368], 26, mats.linen, 36, .03, c); block(g, [394, 509, 400, 562], 26, mats.linen, 36, .03, c);
    for (let k = 0; k < 4; k++) { const a = 368 + 46 * k; block(g, [453, a + .7, 496, a + 46 - .7], 14, mats.linen, 36, .06, c); }
    block(g, [400.7, 509, 452.3, 552], 14, mats.linen, 36, .06, c);
    for (const [r, mat, rz, rx] of [[[488, 376, 494, 392], mats.cushion, .25, 0], [[488, 532, 494, 548], mats.clay, .25, 0], [[410, 544, 426, 550], mats.cushion, 0, -.25]]) { const m = block(g, r, 32, mat, 48, .06, c); m.rotation.z = rz; m.rotation.x = rx; }
  });

  // Option 2's entry closet on the nook wall, doors facing south, full height like the fridge
  piece(ENTRY_CLOSET, (g, c) => {
    const [x0, y0, x1, y1] = ENTRY_CLOSET.true;
    block(g, [x0 + 1, y0, x1 - 1, y1 - 2], 8, mats.plinth, 0, .002, c);
    block(g, [x0, y0, x1, y1], 207, mats.front, 8, .004, c);
    const n = 4, w = (x1 - x0) / n;
    for (let k = 1; k < n; k++) block(g, [x0 + w * k - .4, y1 - .6, x0 + w * k + .4, y1 + .1], 205, mats.groove, 9, .001, c);
    for (let k = 0; k < n; k++) { const x = x0 + w * k + (k % 2 ? 4 : w - 4); block(g, [x - .6, y1, x + .6, y1 + .9], 50, mats.brass, 80, .002, c); }
  });

  // Option 2's sectional: three seats along the bedroom wall, one turning along the windows
  piece(SOL_SOFA4, (g, c) => {
    const E = [453, 413, 506, 562], Sx = [394, 509, 453, 562];
    for (const [x, y] of [[456, 416], [503, 416], [503, 559], [397, 512], [397, 559], [450, 512]]) leg(g, x, y, c);
    block(g, E, 30, mats.linenDark, 8, .035, c); block(g, Sx, 30, mats.linenDark, 8, .035, c);
    block(g, [496, 413, 506, 562], 42, mats.linen, 34, .05, c); block(g, [394, 552, 506, 562], 42, mats.linen, 34, .05, c);
    block(g, [453, 413, 506, 419], 26, mats.linen, 36, .03, c); block(g, [394, 509, 400, 562], 26, mats.linen, 36, .03, c);
    for (const [a, b] of [[419, 464.5], [464.5, 509]]) block(g, [453, a + .7, 496, b - .7], 14, mats.linen, 36, .06, c);
    block(g, [453, 509.7, 496, 552], 14, mats.linen, 36, .06, c);
    block(g, [400.7, 509, 452.3, 552], 14, mats.linen, 36, .06, c);
    for (const [r, mat, rz, rx] of [[[488, 426, 494, 442], mats.cushion, .25, 0], [[488, 532, 494, 548], mats.clay, .25, 0], [[410, 544, 426, 550], mats.cushion, 0, -.25]]) { const m = block(g, r, 32, mat, 48, .06, c); m.rotation.z = rz; m.rotation.x = rx; }
  });

  // Option 3's sectional: three seats along the moved bedroom wall, one turning along the windows
  function sect3(spec, d) { piece(spec, (g, c) => {
    const E = [453 + d, 413, 506 + d, 562], Sx = [394 + d, 509, 453 + d, 562];
    for (const [x, y] of [[456, 416], [503, 416], [503, 559], [397, 512], [397, 559], [450, 512]]) leg(g, x + d, y, c);
    block(g, E, 30, mats.linenDark, 8, .035, c); block(g, Sx, 30, mats.linenDark, 8, .035, c);
    block(g, [496 + d, 413, 506 + d, 562], 42, mats.linen, 34, .05, c); block(g, [394 + d, 552, 506 + d, 562], 42, mats.linen, 34, .05, c);
    block(g, [453 + d, 413, 506 + d, 419], 26, mats.linen, 36, .03, c); block(g, [394 + d, 509, 400 + d, 562], 26, mats.linen, 36, .03, c);
    for (const [a, b] of [[419, 464.5], [464.5, 509]]) block(g, [453 + d, a + .7, 496 + d, b - .7], 14, mats.linen, 36, .06, c);
    block(g, [453 + d, 509.7, 496 + d, 552], 14, mats.linen, 36, .06, c);
    block(g, [400.7 + d, 509, 452.3 + d, 552], 14, mats.linen, 36, .06, c);
    for (const [r, mat, rz, rx] of [[[488 + d, 426, 494 + d, 442], mats.cushion, .25, 0], [[488 + d, 532, 494 + d, 548], mats.clay, .25, 0], [[410 + d, 544, 426 + d, 550], mats.cushion, 0, -.25]]) { const m = block(g, r, 32, mat, 48, .06, c); m.rotation.z = rz; m.rotation.x = rx; }
  }); }
  sect3(BIG_SECTIONAL, 59);
  // Option 3's two armchairs, facing the sectional across the coffee table
  function arms2(spec, x0) { piece(spec, (g, c) => {
    const y00 = spec.true[1];
    for (const y0 of [y00, y00 + 50]) {
      const x1 = x0 + 44, y1 = y0 + 44;
      for (const [x, y] of [[x0 + 3, y0 + 3], [x1 - 3, y0 + 3], [x0 + 3, y1 - 3], [x1 - 3, y1 - 3]]) leg(g, x, y, c, 0, 10);
      block(g, [x0, y0, x1, y1], 28, mats.linenDark, 10, .035, c);
      block(g, [x0, y0, x0 + 9, y1], 40, mats.linen, 36, .05, c);
      block(g, [x0, y0, x1, y0 + 6], 22, mats.linen, 36, .03, c); block(g, [x0, y1 - 6, x1, y1], 22, mats.linen, 36, .03, c);
      block(g, [x0 + 9, y0 + 6.5, x1 - 1, y1 - 6.5], 12, mats.linen, 36, .06, c);
    }
  }); }
  arms2(BIG_ARMCHAIRS, 395);
  // Option 3's smaller bedroom: a twin bed (97 × 190 cm) along the window wall with its trundle pulled out 50 cm,
  // and a small closet (60 cm deep) on the north wall, clear of the door
  piece(BEDROOM3, (g, c) => {
    // the bed against the living-room wall, head by the window, 50 cm of the trundle showing (owner, Nov 22)
    block(g, [572, 450, 629, 562], 26, mats.oak, 6, .01, c);
    block(g, [573.5, 451.5, 627.5, 560.5], 20, mats.seat, 32, .04, c);
    block(g, [572, 450, 629, 506], 4, mats.linen, 51, .03, c);
    block(g, [577, 542, 624, 556], 10, mats.cushion, 52, .05, c);
    block(g, [572, 559, 629, 562], 50, mats.oak, 30, .006, c);
    block(g, [622, 455, 629 + 50 / CM, 556], 14, mats.oak, 4, .01, c);
    block(g, [623.5, 456.5, 629 + 50 / CM - 1.5, 554.5], 12, mats.seat, 18, .04, c);
    block(g, [574, 362, 652, 397], 8, mats.plinth, 0, .002, c);
    block(g, [574, 362, 652, 397], 207, mats.front, 8, .004, c);
    block(g, [612.6, 396.4, 613.4, 397.1], 205, mats.groove, 9, .001, c);
    for (const x of [608, 617]) block(g, [x - .6, 397, x + .6, 397.9], 50, mats.brass, 80, .002, c);
  });

  // Option 4's small bedroom along the windows: a twin bed (97 × 202 cm) head to the west wall, 50 cm of its trundle
  // showing (it pulls out fully), and a closet at its foot against the kitchen's back
  piece(U4_BEDROOM, (g, c) => {
    block(g, [92, 449, 211, 501], 26, mats.oak, 6, .01, c);
    block(g, [93.5, 450.5, 209.5, 499.5], 20, mats.seat, 32, .04, c);
    block(g, [140, 449, 211, 501], 4, mats.linen, 51, .03, c);
    block(g, [97, 455, 111, 495], 10, mats.cushion, 52, .05, c);
    block(g, [92, 449, 95, 501], 50, mats.oak, 30, .006, c);
    block(g, [96, 494, 208, 501 + 50 / CM], 14, mats.oak, 4, .01, c);   // 50 cm of the trundle showing (owner, Nov 22)
    block(g, [97.5, 495.5, 206.5, 501 + 50 / CM - 1.5], 12, mats.seat, 18, .04, c);
    block(g, [211, 448, 301, 486], 8, mats.plinth, 0, .002, c);
    block(g, [211, 448, 301, 486], WALL_H - 8, mats.front, 8, .004, c);   // to the ceiling (owner, Nov 22)
    for (let k = 1; k < 3; k++) { const x = 211 + 30 * k; block(g, [x - .4, 485.4, x + .4, 486.1], WALL_H - 10, mats.groove, 9, .001, c); }
    for (const x of [237, 245, 297]) block(g, [x - .6, 486, x + .6, 486.9], 50, mats.brass, 80, .002, c);
  });
  sect3(U4_SECT, 202);
  arms2(U4_ARMS, 513);
  piece(U4_ENTRY, (g, c) => {
    const w = 400 + 10 / CM;
    block(g, [400, 224, w, 259], WALL_H, mats.wall, 0, .002, c); block(g, [400, 224, w, 259], .6, mats.cut, WALL_H, .001, c);
    block(g, [w + 1, 224, 531, 257], 8, mats.plinth, 0, .002, c);
    block(g, [w, 224, 532, 259], WALL_H - 8, mats.front, 8, .004, c);
    const n = 4, dw = (532 - w) / n;
    for (let k = 1; k < n; k++) block(g, [w + dw * k - .4, 258.4, w + dw * k + .4, 259.1], WALL_H - 10, mats.groove, 9, .001, c);
    for (let k = 0; k < n; k++) { const x = w + dw * k + (k % 2 ? 4 : dw - 4); block(g, [x - .6, 259, x + .6, 259.9], 50, mats.brass, 80, .002, c); }
  });
  piece(BIG_ENTRY_TOP, (g, c) => {
    block(g, [400, 224, 532, 259], WALL_H - 215, mats.front, 215, .004, c);
    for (const x of [433, 466, 499]) block(g, [x - .4, 258.4, x + .4, 259.1], WALL_H - 217, mats.groove, 216, .001, c);
  });

  // ---- Option 5 (Neve Amim page), from al3d.js: pieces 26 to 28
  const disc = (g, x, y, rpx, hcm, mat, lift, c, top = rpx) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(top * S, rpx * S, h(hcm), 32), mat);
    m.position.set((x - c[0]) * S, h(lift + hcm / 2), (y - c[1]) * S); m.castShadow = m.receiveShadow = true; g.add(m); return m;
  };
  // the stone island, long side east-west, a stool on each side at its east end
  piece(F5_ISLAND, (g, c) => {
    block(g, NR([230, 836, 420, 932]), 90, mats.counter, 0, .01, c);
    for (const sy of [814, 954]) {
      disc(g, NX(386), NY(sy), 9, 6, mats.linen, 64, c);
      for (const [lx, ly] of [[-6, -6], [6, -6], [-6, 6], [6, 6]]) disc(g, NX(386) + lx, NY(sy) + ly, .6, 64, mats.steel, 0, c);
    }
  });
  // the living room: a large rug, the sofa with its back to the balcony doors, two swivel chairs facing it with
  // a small side table between them, and a round travertine coffee table
  piece(F5_LIVING, (g, c) => {
    const rug = block(g, NR([524, 712, 864, 1092]), .8, mats.rug, 0, .01, c); rug.castShadow = false;
    const [sx0, sy0, sx1, sy1] = NR([574, 1002, 824, 1112]);
    for (const [x, y] of [[sx0 + 3, sy0 + 3], [sx1 - 3, sy0 + 3], [sx0 + 3, sy1 - 3], [sx1 - 3, sy1 - 3]]) leg(g, x, y, c);
    block(g, [sx0, sy0, sx1, sy1], 30, mats.linenDark, 8, .035, c);
    block(g, [sx0 + 5, sy1 - 10, sx1 - 5, sy1], 42, mats.linen, 34, .05, c);
    block(g, [sx0, sy0, sx0 + 7, sy1], 26, mats.linen, 36, .03, c); block(g, [sx1 - 7, sy0, sx1, sy1], 26, mats.linen, 36, .03, c);
    const sp = (sx1 - sx0 - 14) / 3;
    for (let k = 0; k < 3; k++) { const a = sx0 + 7 + sp * k; block(g, [a + .7, sy0 + 1, a + sp - .7, sy1 - 10], 14, mats.linen, 36, .06, c); }
    for (const [xa, mat] of [[sx0 + 12, mats.cushion], [sx1 - 28, mats.clay]]) { const m = block(g, [xa, sy1 - 16, xa + 16, sy1 - 10], 32, mat, 48, .06, c); m.rotation.x = -.25; }
    disc(g, NX(699), NY(900), 26, 38, mats.travertine, 0, c);
    for (const cx of [632, 766]) {
      disc(g, NX(cx), NY(757), 8, 12, mats.brass, 0, c, 3);
      disc(g, NX(cx), NY(757), 21, 33, mats.cushion, 12, c);
      block(g, NR([cx - 41, 714, cx + 41, 734]), 33, mats.cushion, 45, .08, c);
      block(g, NR([cx - 43, 726, cx - 29, 778]), 22, mats.cushion, 45, .06, c); block(g, NR([cx + 29, 726, cx + 43, 778]), 22, mats.cushion, 45, .06, c);
    }
    disc(g, NX(699), NY(757), 8, 50, mats.oakLight, 0, c, 7);
  });
  // dining in the old bedroom: the same oak table and eight chairs as the other options (items 3 to 11; owner, Nov 22);
  // no sideboard (owner, Nov 22: "get rid of the buffet")
  // the sefarim bookcase between the two short walls, to the ceiling, with rows of leather-bound volumes
  piece(F5_BOOKS, (g, c) => {
    const [x0, y0, x1, y1] = F5_BOOKS.true;
    block(g, [x0, y0, x1, y0 + 2], WALL_H, mats.front, 0, .004, c);
    for (const x of [x0, x0 + (x1 - x0) / 4, x0 + (x1 - x0) / 2, x0 + 3 * (x1 - x0) / 4, x1 - 1.5]) block(g, [x, y0, x + 1.5, y1], WALL_H, mats.front, 0, .003, c);
    const spines = [0x2c3a55, 0x6a2a2e, 0x2f4a3a, 0x1f1d1b].map(color => M({ color, roughness: .6 }));   // deep blue, burgundy, dark green, black leather
    for (let r = 0; r < 6; r++) {
      const lift = 8 + r * 42;
      block(g, [x0, y0, x1, y1], 2, mats.front, lift, .003, c);
      for (let k = 0; k < 4; k++) {
        const a = x0 + (x1 - x0) * k / 4 + 2.5, b = a + (x1 - x0) / 4 - 6 - rnd() * 6;
        block(g, [a, y0 + 3, b, y1 - 3], 26 + rnd() * 6, spines[(r + k) % 4], lift + 2, .003, c);
      }
    }
  });

  // ---- the path to the hallway, a dashed line on the floor
  // A walking path: a fine line of small dots with softly rounded corners and a slim chevron at its end (owner,
  // Nov 22: "more sophisticated looking"; it was chunky dashes and a cone)
  const dotGeo = new THREE.CircleGeometry(1.9 * S, 14); dotGeo.rotateX(-Math.PI / 2);
  function smooth(pts) {
    let p = pts.map(q => q.slice());
    for (let it = 0; it < 3; it++) {
      const out = [p[0]];
      for (let i = 0; i < p.length - 1; i++) {
        const [ax, ay] = p[i], [bx, by] = p[i + 1];
        if (i > 0) out.push([ax * .75 + bx * .25, ay * .75 + by * .25]);
        if (i < p.length - 2) out.push([ax * .25 + bx * .75, ay * .25 + by * .75]);
      }
      out.push(p[p.length - 1]); p = out;
    }
    return p;
  }
  function route(pts) {
    const list = [], p = smooth(pts), gap = 8;
    let total = 0; const seg = [];
    for (let i = 0; i < p.length - 1; i++) { const l = Math.hypot(p[i + 1][0] - p[i][0], p[i + 1][1] - p[i][1]); seg.push(l); total += l; }
    const at = d => { let i = 0; while (i < seg.length - 1 && d > seg[i]) { d -= seg[i]; i++; } const t = seg[i] ? d / seg[i] : 0; return [p[i][0] + (p[i + 1][0] - p[i][0]) * t, p[i][1] + (p[i + 1][1] - p[i][1]) * t]; };
    for (let d = 3; d < total - 9; d += gap) {
      const [x, y] = at(d), m = new THREE.Mesh(dotGeo, mats.path);
      m.position.set(wx(x), .012, wz(y)); m.userData.x = x; scene.add(m); list.push(m);
    }
    const [ex, ey] = at(total - 2), [px, py] = at(total - 10), ang = Math.atan2(ey - py, ex - px);
    const tip = new THREE.Group(); tip.position.set(wx(ex), .013, wz(ey)); tip.rotation.y = -ang; scene.add(tip);
    for (const sgn of [1, -1]) {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(8 * S, .002, 1.5 * S), mats.path);
      arm.position.set(-3.4 * S, 0, sgn * 2.2 * S); arm.rotation.y = sgn * .62; tip.add(arm);
    }
    return { list, tip };
  }
  const { list: dashes, tip } = route(ROUTE);
  const routeFix = route(ROUTE_FIX);
  const routeSol = route(ROUTE_SOL), routeKitchen = route(ROUTE_KITCHEN), routeU4 = route(ROUTE_U4);
  const access = {}; for (const k in ACCESS) access[k] = ACCESS[k].map(route);
  const ring = new THREE.Mesh(new THREE.RingGeometry(22 * S, 26 * S, 40), new THREE.MeshBasicMaterial({ color: 0xb8452e, transparent: true }));
  ring.rotation.x = -Math.PI / 2; ring.position.set(wx(CLASH[0]), .006, wz(CLASH[1])); scene.add(ring);

  // what each piece does when the room is rearranged: undefined = stays, null = has no room
  items[0].re = RE_SOFA;
  items[1].re = null;                                                    // the loveseat
  items[2].re = null;                                                    // the coffee table
  items[3].re = RE_TABLE;
  chairs.forEach((ch, j) => { const r = RE_CHAIRS[j]; items[4 + j].re = r ? { c: r.c, rot: ANG[r.face] - ANG[ch.face] } : null; });
  items[0].fix = null; items[1].fix = null; items[2].fix = FIX_COFFEE; items[3].fix = FIX_TABLE; items[12].fix = null; items[13].fix = FIX_TREE; items[14].fix = FIX_RUG;
  items[15].only = 'fix'; items[17].only = 'sol'; items[18].only = 'big'; items[19].only = 'big'; items[20].only = 'big'; items[21].only = 'u4'; items[22].only = 'u4'; items[23].only = 'u4'; items[24].only = 'u4'; items[25].only = 'big';
  chairs.forEach((ch, j) => { const r = FIX_CHAIRS[j]; items[4 + j].fix = r ? { c: r.c, rot: ANG[r.face] - ANG[ch.face] } : null; });
  items[0].sol = SOL.sofa; items[1].sol = SOL.loveseat; items[2].sol = SOL.coffee; items[3].sol = SOL.table;
  chairs.forEach((ch, j) => { const [x, y, f] = SOL.chairs[j]; items[4 + j].sol = { c: [x, y], rot: ANG[f] - ANG[ch.face] }; });
  items[13].sol = SOL.tree; items[14].sol = SOL.rug;
  items[0].sol = null; items[1].sol = null; items[12].sol = null; items[2].sol = { c: [415, 455] };
  for (const it of items) it.big = it.fix;
  for (const it of items) it.u4 = null;
  items[3].u4 = U4_TABLE;
  chairs.forEach((ch, j) => { const [x, y, f] = U4_CHAIRS[j]; items[4 + j].u4 = { c: [x, y], rot: ANG[f] - ANG[ch.face] }; });
  items[2].u4 = { c: [610, 455] }; items[13].u4 = { c: [482, 545] };
  items[14].u4 = { c: [605, 470], sx: 150 / 158, sz: 160 / 110 };
  items[2].big = { c: [478, 459] }; items[14].big = { c: [470, 472.5], sx: 180 / 158, sz: 175 / 110 }; items[15].only = 'fix'; items[14].sol = FIX_RUG; items[16].only = ['fix', 'big'];
  // Option 5: only its own pieces, and Option 4's entry closet with its short wall (Neve Amim's coat closet)
  for (const it of items) it.f5 = null;
  items[3].f5 = F5_TABLE;
  chairs.forEach((ch, j) => { const r = FIX_CHAIRS[j]; items[4 + j].f5 = { c: [r.c[0] + F5_TABLE.c[0] - FIX_TABLE.c[0], r.c[1] + F5_TABLE.c[1] - FIX_TABLE.c[1]], rot: ANG[r.face] - ANG[ch.face] }; });
  for (const i of [26, 27, 28]) items[i].only = 'f5';
  items[24].only = ['u4', 'f5'];
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
    if (it.only) return [].concat(it.only).includes(st) ? base : { ...base, v: 0 };
    if (st === 'true') return base;
    if (st === 'sales') {
      const s = it.spec.sales;
      if (!s) return { ...base, v: 0 };
      return { x: (s[0] + s[2]) / 2, y: (s[1] + s[3]) / 2, sx: (s[2] - s[0]) / it.w, sz: (s[3] - s[1]) / it.d, r: 0, v: 1 };
    }
    const alt = st === 'fix' ? it.fix : st === 'sol' ? it.sol : st === 'big' ? it.big : st === 'u4' ? it.u4 : st === 'f5' ? it.f5 : it.re;
    if (alt === undefined) return base;
    if (alt === null) return { ...base, v: 0 };
    return { x: alt.c[0], y: alt.c[1], sx: alt.sx || 1, sz: alt.sz || 1, r: alt.rot || 0, v: 1 };
  }
  const weights = st => ({ bad: st === 'true' ? 1 : 0, re: st === 're' ? 1 : 0, fix: st === 'fix' ? 1 : 0, sol: st === 'sol' ? 1 : 0, big: st === 'big' ? 1 : 0, u4: st === 'u4' ? 1 : 0, f5: st === 'f5' ? 1 : 0 });
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
    for (const c of tip.children) c.material = W.bad > .5 ? mats.pathBad : mats.path;
    ring.visible = W.bad > .05; ring.material.opacity = W.bad;
    ghost.visible = W.re > .05; ghost.material.opacity = .18 * W.re;
    const way = W.fix > .5 || W.big > .5 ? 'fix' : W.sol > .5 ? 'sol' : W.u4 > .5 || W.f5 > .5 ? 'u4' : 'base';
    const show = (r, on) => { for (const m of r.list) m.visible = on; r.tip.visible = on; };
    show({ list: dashes, tip }, way === 'base' && W.bad > .5); show(routeFix, way === 'fix'); show(routeSol, way === 'sol'); show(routeKitchen, way === 'sol'); show(routeU4, way === 'u4');
    const opt = W.bad > .5 ? 'true' : ['fix', 'sol', 'big', 'u4', 'f5'].find(k => W[k] > .5);
    for (const k in access) for (const r of access[k]) show(r, k === opt);
    oldKitchen.scale.y = Math.max(1 - W.sol - W.u4 - W.f5, .001); oldKitchen.visible = W.sol + W.u4 + W.f5 < .98;
    f5Kitchen.scale.y = Math.max(W.f5, .001); f5Kitchen.visible = W.f5 > .02;
    f5Walls.scale.y = Math.max(W.f5, .001); f5Walls.visible = W.f5 > .02;
    uKitchen.scale.y = Math.max(W.u4, .001); uKitchen.visible = W.u4 > .02;
    u4Walls.scale.y = Math.max(W.u4, .001); u4Walls.visible = W.u4 > .02;
    fixKitchen.visible = false;
    newKitchen.scale.y = Math.max(W.sol, .001); newKitchen.visible = W.sol > .02;
    wallOld.scale.y = Math.max(1 - W.big - W.u4 - W.f5, .001); wallOld.visible = W.big + W.u4 + W.f5 < .98;
    wallNew.scale.y = Math.max(W.big, .001); wallNew.visible = W.big > .02;
  }
  const TEXT = {
    sales: 'As the developer’s sales plan draws it: the furniture is drawn smaller than its real size, so the room looks bigger than it is. The table looks small, and there’s a clear path between it and the loveseat to the hallway.',
    true: 'At true size, the table and its chairs take far more room: the end chair runs into the loveseat, and the path to the hallway closes.',
    fix: 'Option 1: no structural changes, and the developer’s standard kitchen stays as drawn. The table moves toward the windows and seats eight with both heads, an L-shaped sectional runs the length of the bedroom wall with a coffee table, and an entry closet fills the wall along the way to the bedrooms. It works, but it doesn’t have the spacious feel the sales plan suggests, and the dining table feels like it’s in the kitchen.',
    sol: 'Option 2: no structural changes, but an upgraded kitchen would be required. The kitchen is defined against a single wall along the entrance, with a 16 in closet back to back with it, which gives the plan a defined entryway and very generous storage. The plan is very open: the dining table runs along the windows, seats eight with both heads and has plenty of room to extend, and an L-shaped sectional fills the corner of the bedroom wall and the windows.',
    big: 'Option 3: move the bedroom wall over 3 ft 3 in. The bedroom still fits a bed with a trundle and a small closet, and the living room gains a proper sitting area: the sectional, two armchairs facing it and a larger rug. The kitchen stays as the developer drew it, and the table still seats eight with both heads.',
    u4: 'Option 4: a compact U-shaped kitchen fills the developer’s kitchen corner, and behind it, along the windows, a small bedroom fits a bed with a trundle, and a closet. The bedroom beside the living room opens up and becomes the living room, with the sectional, two armchairs and a rug. The dining table stands in the middle and seats eight with both heads, with plenty of space for it to open, and an entry closet fills the wall along the way to the bedrooms.',
    f5: 'Option 5, the plan we chose: we gave up a bedroom. Its wall comes down and the dining table moves into it, which leaves ample living space for hosting between the dining table and the kitchen. The kitchen grows into a large U with a stone island, tall units along the whole north wall and two rows of uppers.',
    re: 'Option 1: swap the areas. Nothing collides and the path to the bedrooms opens, but the dining table takes over the living room, and the seating area shrinks to a single sofa at the entrance.'
  };
  // On the Neve Amim page the options are told as the search for the plan we built (owner, Nov 22)
  if (PROCESS) Object.assign(TEXT, {
    fix: 'Option 1: no structural changes, and the developer’s kitchen stays as drawn. It works, but it doesn’t offer enough space: the dining table feels like it’s in the kitchen, and the seating area is tight.',
    sol: 'Option 2: no structural changes. The kitchen moves to a single wall along the entrance, with an entry closet behind it. Very open, but still not enough space for how this family lives and hosts.',
    big: 'Option 3: the bedroom wall moves over 3 ft 3 in, for a proper sitting area with a sectional and two armchairs. Better, but the kitchen still feels like part of the living room.',
    u4: 'Option 4: the bedroom beside the living room opens up and becomes the living room, and a small bedroom goes in behind a compact U-shaped kitchen. Enough living space, but the kitchen is too small.'
  });
  let size = PROCESS ? 'fix' : 'true';
  function setSize(st, instant) {
    size = st;
    sw.querySelectorAll('[data-size]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.size === st)));
    status.textContent = TEXT[st];
    const note = box.querySelector('.fs-note'); if (note) note.hidden = st === 'sales';   // the sales plan view is not to scale (owner, Nov 22)
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
  const ORDER = PROCESS ? ['fix', 'sol', 'big', 'u4', 'f5'] : ['sales', 'true', 'fix', 'sol', 'big', 'u4'];   // the old Option 1 ('re') was removed (owner, Nov 22)
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
    { el: fourTag, at: new THREE.Vector3(wx(461), h(95), wz(251)), w: () => W.re },
    { el: loveTag, at: new THREE.Vector3(wx(415), h(40), wz(404)), w: () => W.re },
    { el: fixTags[0], at: new THREE.Vector3(wx(270), h(85), wz(469)), w: () => W.fix },
    { el: fixTags[3], at: new THREE.Vector3(wx(470), h(80), wz(500)), w: () => W.fix },
    { el: fixTags[4], at: new THREE.Vector3(wx(466), h(225), wz(241)), w: () => W.fix },
    { el: fixTags[1], at: new THREE.Vector3(wx(190), h(100), wz(330)), w: () => W.fix },
    { el: fixTags[2], at: new THREE.Vector3(wx(530), h(10), wz(300)), w: () => W.fix },
    { el: bigTags[0], at: new THREE.Vector3(wx(568), h(115), wz(380)), w: () => W.big },
    { el: bigTags[1], at: new THREE.Vector3(wx(640), h(90), wz(440)), w: () => W.big },
    { el: bigTags[2], at: new THREE.Vector3(wx(430), h(80), wz(470)), w: () => W.big },
    { el: u4Tags[0], at: new THREE.Vector3(wx(160), h(70), wz(520)), w: () => W.u4 },
    { el: u4Tags[1], at: new THREE.Vector3(wx(170), h(100), wz(370)), w: () => W.u4 },
    { el: u4Tags[2], at: new THREE.Vector3(wx(412), h(85), wz(420)), w: () => W.u4 },
    { el: u4Tags[3], at: new THREE.Vector3(wx(610), h(80), wz(440)), w: () => W.u4 },
    { el: solTags[0], at: new THREE.Vector3(wx(250), h(110), wz(321)), w: () => W.sol },
    { el: solTags[1], at: new THREE.Vector3(wx(352), h(108), wz(290)), w: () => W.sol },
    { el: solTags[2], at: new THREE.Vector3(wx(214), h(95), wz(460)), w: () => W.sol },
  ];
  // Room sizes, quiet labels on the floor (owner, Nov 22: feet and inches in English, metres in Hebrew; "not
  // obtrusive but should be there"). Inside wall-to-wall sizes in cm, measured off the plan at CM cm per px.
  const base = () => 1 - W.fix - W.sol - W.big - W.u4 - W.f5, notBig = () => 1 - W.big - W.u4 - W.f5;
  const K = ['Kitchen', 'מטבח'], D = ['Dining', 'פינת אוכל'], L = ['Living', 'סלון'], E = ['Entry', 'כניסה'], B = ['Bedroom', 'חדר שינה'];
  // Each area with its floor area (owner, Nov 22: "i want each area marked", "square feet of each area"). r = the
  // area in plan px; room: true for a walled room (its wall-to-wall size is shown too); open-plan zones are
  // approximate and say so. at = where the label sits.
  const DIMS = [
    { name: E, r: [300, 175, 400, 302], room: true, at: [350, 235], w: () => 1 },
    { name: B, r: [513, 362, 709, 562], room: true, at: [640, 405], w: notBig },
    { name: K, r: [92, 302, 262, 562], at: [175, 420], w: base }, { name: D, r: [262, 302, 506, 420], at: [436, 300], w: base }, { name: L, r: [262, 420, 506, 562], at: [380, 500], w: base },
    { name: K, r: [92, 302, 262, 409], at: [175, 360], w: () => W.fix + W.big }, { name: D, r: [128, 409, 380, 562], at: [270, 530], w: () => W.fix + W.big },
    { name: L, r: [380, 302, 506, 562], at: [470, 475], w: () => W.fix }, { name: L, r: [380, 302, 565, 562], at: [500, 475], w: () => W.big },
    { name: K, r: [92, 302, 461, 382], at: [300, 360], w: () => W.sol }, { name: D, r: [92, 382, 380, 562], at: [214, 525], w: () => W.sol }, { name: L, r: [380, 382, 506, 562], at: [480, 470], w: () => W.sol },
    { name: B, r: [572, 362, 709, 562], room: true, at: [675, 430], w: () => W.big },
    { name: K, r: [92, 302, 307, 443], at: [235, 322], w: () => W.u4 }, { name: B, r: [92, 448, 301, 562], room: true, at: [160, 480], w: () => W.u4 },
    { name: D, r: [308, 302, 506, 562], at: [410, 525], w: () => W.u4 }, { name: L, r: [513, 362, 709, 562], room: true, at: [640, 405], w: () => W.u4 },
    { name: K, r: [92, 302, 300, 562], at: [150, 490], w: () => W.f5 }, { name: L, r: [300, 302, 506, 562], at: [470, 470], w: () => W.f5 }, { name: D, r: [506, 381, 709, 562], at: [600, 540], w: () => W.f5 }
  ];
  const ftin = cm => { const t = Math.round(cm / 2.54); return Math.floor(t / 12) + '′ ' + (t % 12) + '″'; };
  const metres = cm => (cm / 100).toFixed(2);
  let dimLang = '';
  for (const d of DIMS) {
    d.el = document.createElement('span'); d.el.className = 'fs-dim'; d.el.setAttribute('translate', 'no'); view.append(d.el);
    TAGS.push({ el: d.el, at: new THREE.Vector3(wx(d.at[0]), .02, wz(d.at[1])), w: d.w });
  }
  function onRender() {
    const w = view.clientWidth, hh = view.clientHeight;
    const lang = (document.documentElement.lang || '').startsWith('he') ? 'he' : 'en';
    if (lang !== dimLang) {
      dimLang = lang;
      for (const d of DIMS) {
        const he = lang === 'he', nm = d.name[he ? 1 : 0];
        const wc = (d.r[2] - d.r[0]) * CM, dc = (d.r[3] - d.r[1]) * CM, a = wc * dc;
        const area = he ? (d.room ? '' : 'כ־') + (a / 1e4).toFixed(1) + ' מ״ר' : (d.room ? '' : 'about ') + Math.round(a / 929.03) + ' sq ft';
        const size = !d.room ? '' : he ? metres(wc) + ' × ' + metres(dc) + ' מ׳' : ftin(wc) + ' × ' + ftin(dc);
        d.el.innerHTML = '<b>' + nm + '</b>' + (size ? '<span>' + size + '</span>' : '') + '<span>' + area + '</span>';
        d.el.dir = lang === 'he' ? 'rtl' : 'ltr';
      }
    }
    for (const t of TAGS) {
      const p = t.at.clone().project(camera);
      const x = (p.x * .5 + .5) * w, y = (-p.y * .5 + .5) * hh;
      const show = t.w() > .9 && p.z < 1 && x > 20 && x < w - 20 && y > 20 && y < hh - 20;
      t.el.style.visibility = show ? 'visible' : 'hidden';
      if (show) t.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -100%)`;
    }
  }

  // ---- camera and controls (turn, move, zoom, reset), shared with the other models
  const target = new THREE.Vector3(wx(405), 0, wz(380));   // a little east, so Option 3's bedroom is in view
  const fromPos = target.clone().add(new THREE.Vector3(-6.4, 12, 11.1).multiplyScalar(1.06));
  camera.position.copy(fromPos); camera.lookAt(target);
  const { modelControls } = await import('./model-controls.js');
  const controls = modelControls({ THREE, renderer, scene, camera, view, rooms: [], from: fromPos, target, bounds: [wx(120), wx(700), wz(200), wz(560)], onRender });
  function resize() {
    const w = view.clientWidth, hh = view.clientHeight;
    renderer.setSize(w, hh, false);
    camera.aspect = w / hh; camera.updateProjectionMatrix();
    controls.render();
  }
  new ResizeObserver(resize).observe(view);
  setSize(PROCESS ? 'fix' : 'true', true);
  controls.show();
  resize();
  window.__fs3d = { setSize, renderer, render: () => controls.render() };
}
