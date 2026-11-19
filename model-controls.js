/* Turn, move, zoom and room buttons for the project 3D models. Shared by jh3d.js (Kaduri) and al3d.js
   (Neve Amim). Owner, Nov 19: "i want to be able to rotate it and i want buttons in each room where you
   can click on it and the photo pops up", then: "i want to be able to pan in the model as well … the
   notations … need to be more sophisticated … i dont see a reset button".
   - A Turn | Move switch. Turn: drag to turn the model (on touch, sideways only, so a vertical swipe
     still scrolls the page). Move: drag to slide the model (on touch too). With a mouse, a right-drag
     or Shift-drag always moves.
   - + and − zoom (a trackpad pinch too); Reset returns to the first view and re-centres it.
   - A button sits on each room that has a picture; it opens the picture with the room's name and note. */
export function modelControls({ THREE, renderer, scene, camera, view, rooms, from, target, bounds }) {
  const off = from.clone().sub(target);
  let r = off.length(), theta = Math.atan2(off.x, off.z), phi = Math.acos(Math.min(1, Math.max(-1, off.y / r)));
  const home = { r, theta, phi, target: target.clone() };
  const PHI_MIN = .1, PHI_MAX = 1.25, R_MIN = home.r * .3, R_MAX = home.r * 1.3;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  let mode = 'turn';

  // ---- the controls
  const ui = document.createElement('div');
  ui.className = 'm3d-ui';
  ui.innerHTML =
    '<div class="m3d-seg" role="group" aria-label="Drag to">' +
      '<button type="button" class="m3d-btn m3d-txt" data-mode="turn" aria-pressed="true">Turn</button>' +
      '<button type="button" class="m3d-btn m3d-txt" data-mode="pan" aria-pressed="false">Move</button>' +
    '</div>' +
    '<button type="button" class="m3d-btn" data-act="in" aria-label="Zoom in">+</button>' +
    '<button type="button" class="m3d-btn" data-act="out" aria-label="Zoom out">&minus;</button>' +
    '<button type="button" class="m3d-btn m3d-txt" data-act="home">Reset</button>';
  view.append(ui);
  const hint = document.createElement('p');
  hint.className = 'm3d-hint';
  view.append(hint);
  const setMode = m => {
    mode = m;
    ui.querySelectorAll('[data-mode]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.mode === m)));
    view.classList.toggle('m3d-pan', m === 'pan');
    hint.textContent = m === 'pan' ? 'Drag to move · tap a room to see it' : 'Drag to turn · tap a room to see it';
  };
  setMode('turn');
  ui.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.mode) { setMode(b.dataset.mode); return; }
    const act = b.dataset.act;
    if (act === 'in') r = clamp(r * .8, R_MIN, R_MAX);
    if (act === 'out') r = clamp(r * 1.25, R_MIN, R_MAX);
    if (act === 'home') { ({ r, theta, phi } = home); target.copy(home.target); }
    request();
  });

  // the room buttons, and the picture that opens from them, with the room's name and note
  const dlg = document.createElement('dialog');
  dlg.className = 'lb m3d-lb';
  dlg.innerHTML = '<button type="button" aria-label="Close">×</button><figure><img alt=""><figcaption>' +
    '<span class="m3d-cap-name"></span><span class="m3d-cap-note"></span></figcaption></figure>';
  document.body.append(dlg);
  const big = dlg.querySelector('img'), capName = dlg.querySelector('.m3d-cap-name'), capNote = dlg.querySelector('.m3d-cap-note');
  dlg.querySelector('button').addEventListener('click', () => dlg.close());
  dlg.addEventListener('click', e => { if (e.target === dlg) dlg.close(); });
  const spots = rooms.filter(rm => rm.img).map(rm => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'm3d-spot';
    b.innerHTML = '<span class="m3d-dot" aria-hidden="true"></span><span class="m3d-name"></span>';
    b.querySelector('.m3d-name').textContent = rm.name;
    b.setAttribute('aria-label', 'See the ' + rm.name.toLowerCase() + ' finished');
    b.addEventListener('click', () => {
      big.src = rm.img; big.alt = rm.alt || rm.name;
      capName.textContent = rm.name; capNote.textContent = rm.note || '';
      if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', '');
    });
    view.append(b);
    return { b, at: rm.at };
  });

  // ---- drawing
  const v = new THREE.Vector3();
  function render() {
    camera.position.set(target.x + r * Math.sin(phi) * Math.sin(theta), target.y + r * Math.cos(phi), target.z + r * Math.sin(phi) * Math.cos(theta));
    camera.lookAt(target);
    renderer.render(scene, camera);
    const w = view.clientWidth, hh = view.clientHeight;
    for (const { b, at } of spots) {
      v.copy(at).project(camera);
      const x = (v.x * .5 + .5) * w, y = (-v.y * .5 + .5) * hh;
      const out = v.z > 1 || x < 8 || y < 8 || x > w - 8 || y > hh - 8;
      b.style.visibility = out ? 'hidden' : 'visible';
      if (!out) b.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-11px, -50%)`;
    }
  }
  let raf = 0;
  const request = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; render(); }); };

  // slide the model: along the ground, relative to where the camera faces
  function pan(dx, dy) {
    const k = r * .0016;
    const rx = Math.cos(theta), rz = -Math.sin(theta);          // the camera's right, on the ground
    const fx = -Math.sin(theta), fz = -Math.cos(theta);         // away from the camera, on the ground
    target.x = clamp(target.x - rx * dx * k + fx * dy * k, bounds[0], bounds[1]);
    target.z = clamp(target.z - rz * dx * k + fz * dy * k, bounds[2], bounds[3]);
  }

  // ---- dragging
  let drag = null;
  view.addEventListener('contextmenu', e => { if (view.classList.contains('m3d-on') && !e.target.closest('button')) e.preventDefault(); });
  view.addEventListener('pointerdown', e => {
    if (!view.classList.contains('m3d-on') || e.target.closest('button')) return;
    const touch = e.pointerType === 'touch';
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY, touch, pan: mode === 'pan' || (!touch && (e.button === 2 || e.shiftKey)) };
    view.classList.add('m3d-drag');
    if (!touch || drag.pan) view.setPointerCapture(e.pointerId);
  });
  view.addEventListener('pointermove', e => {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    drag.x = e.clientX; drag.y = e.clientY;
    if (drag.pan) pan(dx, dy);
    else {
      theta -= dx * .008;
      if (!drag.touch) phi = clamp(phi - dy * .006, PHI_MIN, PHI_MAX);
    }
    request();
  });
  const end = () => { drag = null; view.classList.remove('m3d-drag'); };
  view.addEventListener('pointerup', end); view.addEventListener('pointercancel', end);
  // a trackpad pinch arrives as a wheel event with ctrlKey; plain scrolling is left to the page
  view.addEventListener('wheel', e => {
    if (!view.classList.contains('m3d-on') || !e.ctrlKey) return;
    e.preventDefault();
    r = clamp(r * Math.exp(e.deltaY * .01), R_MIN, R_MAX); request();
  }, { passive: false });
  // arrow keys turn it when the model has focus (with Shift, they move it)
  view.tabIndex = 0;
  view.setAttribute('aria-label', '3D model. Drag or use the arrow keys to turn it; Shift and the arrow keys move it.');
  view.addEventListener('keydown', e => {
    if (!view.classList.contains('m3d-on') || e.target !== view) return;
    const k = { ArrowLeft: [1, 0], ArrowRight: [-1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
    if (!k) return;
    e.preventDefault();
    if (e.shiftKey) pan(k[0] * 40, k[1] * 40);
    else { theta += k[0] * .12; phi = clamp(phi + k[1] * .08, PHI_MIN, PHI_MAX); }
    request();
  });

  return {
    show() { view.classList.add('m3d-on'); render(); },
    render
  };
}
