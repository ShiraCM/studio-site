/* Rotate, zoom and room buttons for the project 3D models (owner, Nov 19: "i dont want it to run itself -
   i want to be able to rotate it and i want buttons in each room where you can click on it and the photo
   pops up"). Shared by jh3d.js (Kaduri) and al3d.js (Neve Amim).
   - Drag to turn the model (mouse: around and up/down; touch: sideways only, so a vertical swipe still
     scrolls the page). Zoom with the + and − buttons, or a trackpad pinch. ↺ returns to the first view.
   - A button sits on each room that has a picture; it opens the picture in the site's lightbox. */
export function modelControls({ THREE, renderer, scene, camera, view, rooms, from, target, beforeRender }) {
  const off = from.clone().sub(target);
  let r = off.length(), theta = Math.atan2(off.x, off.z), phi = Math.acos(Math.min(1, Math.max(-1, off.y / r)));
  const home = { r, theta, phi };
  const PHI_MIN = .1, PHI_MAX = 1.25, R_MIN = home.r * .35, R_MAX = home.r * 1.3;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  // ---- the buttons
  const ui = document.createElement('div');
  ui.className = 'm3d-ui';
  ui.innerHTML = '<button type="button" class="m3d-btn" data-act="in" aria-label="Zoom in">+</button>' +
    '<button type="button" class="m3d-btn" data-act="out" aria-label="Zoom out">&minus;</button>' +
    '<button type="button" class="m3d-btn" data-act="home" aria-label="Back to the first view">&#8634;</button>';
  view.append(ui);
  const hint = document.createElement('p');
  hint.className = 'm3d-hint'; hint.textContent = 'Drag to turn · tap a room to see it';
  view.append(hint);
  ui.addEventListener('click', e => {
    const act = e.target.closest('button')?.dataset.act;
    if (act === 'in') r = clamp(r * .8, R_MIN, R_MAX);
    if (act === 'out') r = clamp(r * 1.25, R_MIN, R_MAX);
    if (act === 'home') ({ r, theta, phi } = home);
    request();
  });

  // the room buttons, and the picture that opens from them
  const dlg = document.createElement('dialog');
  dlg.className = 'lb m3d-lb';
  dlg.innerHTML = '<button type="button" aria-label="Close">×</button><img alt=""><p></p>';
  document.body.append(dlg);
  const big = dlg.querySelector('img'), cap = dlg.querySelector('p');
  dlg.querySelector('button').addEventListener('click', () => dlg.close());
  dlg.addEventListener('click', e => { if (e.target === dlg) dlg.close(); });
  const spots = rooms.filter(rm => rm.img).map(rm => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'm3d-spot';
    b.innerHTML = '<span class="m3d-dot" aria-hidden="true"></span><span class="m3d-name"></span>';
    b.querySelector('.m3d-name').textContent = rm.name;
    b.setAttribute('aria-label', 'See the ' + rm.name.toLowerCase() + ' finished');
    b.addEventListener('click', () => {
      big.src = rm.img; big.alt = rm.alt || rm.name; cap.textContent = rm.note ? rm.name + ' · ' + rm.note : rm.name;
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
    if (beforeRender) beforeRender();
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

  // ---- dragging
  let drag = null;
  view.addEventListener('pointerdown', e => {
    if (!view.classList.contains('m3d-on') || e.target.closest('button')) return;
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY, touch: e.pointerType === 'touch' };
    view.classList.add('m3d-drag');
    if (!drag.touch) view.setPointerCapture(e.pointerId);
  });
  view.addEventListener('pointermove', e => {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    drag.x = e.clientX; drag.y = e.clientY;
    theta -= dx * .008;
    if (!drag.touch) phi = clamp(phi - dy * .006, PHI_MIN, PHI_MAX);
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
  // arrow keys turn it when the model has focus
  view.tabIndex = 0;
  view.setAttribute('aria-label', '3D model. Drag or use the arrow keys to turn it.');
  view.addEventListener('keydown', e => {
    if (!view.classList.contains('m3d-on') || e.target !== view) return;
    const k = { ArrowLeft: [.12, 0], ArrowRight: [-.12, 0], ArrowUp: [0, -.08], ArrowDown: [0, .08] }[e.key];
    if (!k) return;
    e.preventDefault(); theta += k[0]; phi = clamp(phi + k[1], PHI_MIN, PHI_MAX); request();
  });

  return {
    show() { view.classList.add('m3d-on'); render(); },
    render
  };
}
