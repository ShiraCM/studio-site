/* Hero reel: each scene starts as a drawing, then a reveal line sweeps across
   and turns it into the rendering or result. Cycles on its own; the stage
   buttons jump to a stage and stop the cycle. A stage can have several scenes
   (data-stage), each with its own caption (data-text) and length in ms
   (data-duration). Each scene gets a scene:show event when it comes up, which
   the 3D kitchen (kitchen3d.js) uses to play from the plan. */
(function () {
  var box = document.getElementById('model');
  if (!box) return;
  var scenes = box.querySelectorAll('.scene');
  var cap = box.querySelector('.model-cap');
  var pips = box.querySelectorAll('.model-pips button');
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var META = {
    1: ['Stage 01', 'תוכנית מכר', 'The sales plan, then the furniture drawn to scale'],
    2: ['Stage 02', 'שינויי דיירים', 'The contractor’s plan, reworked around the family'],
    3: ['Stage 03', 'מפרט טכני', 'Your plan and finishes, rendered before work starts'],
    4: ['Stage 04', 'מסירת דירה', 'Custom built-ins, furnished and ready to live in']
  };
  // stage of each scene: explicit data-stage, otherwise the next stage in order
  var stageOf = [], s = 0;
  scenes.forEach(function (el) { s = +el.dataset.stage || s + 1; stageOf.push(s); });
  var idx = 0, auto = !reduce, revealTimer, nextTimer;
  box.classList.add('live');

  function show(i, user) {
    idx = i;
    if (user) auto = false;
    clearTimeout(revealTimer); clearTimeout(nextTimer);
    scenes.forEach(function (el, j) {
      var on = j === i;
      el.classList.toggle('active', on);
      el.classList.remove('reveal');
      el.setAttribute('aria-hidden', on ? 'false' : 'true');
    });
    var cur = scenes[i], st = stageOf[i];
    void cur.offsetWidth;
    cur.dispatchEvent(new Event('scene:show'));
    if (reduce) cur.classList.add('reveal');
    else revealTimer = setTimeout(function () { cur.classList.add('reveal'); }, 1500);
    if (cap) {
      cap.classList.remove('in'); void cap.offsetWidth;
      cap.querySelector('.n').textContent = META[st][0];
      cap.querySelector('.he').textContent = META[st][1];
      cap.querySelector('.t').textContent = cur.dataset.text || META[st][2];
      cap.classList.add('in');
    }
    pips.forEach(function (p, j) { p.setAttribute('aria-pressed', j + 1 === st ? 'true' : 'false'); });
    if (auto) nextTimer = setTimeout(function () { show((idx + 1) % scenes.length); }, +cur.dataset.duration || 7200);
  }
  function goStage(n, user) { show(Math.max(0, stageOf.indexOf(n)), user); }
  pips.forEach(function (p, j) { p.addEventListener('click', function () { goStage(j + 1, true); }); });

  // pause the cycle while the reel is off screen
  if (window.IntersectionObserver) {
    new IntersectionObserver(function (es) {
      if (!auto) return;
      if (es[0].isIntersecting) show(idx); else { clearTimeout(nextTimer); clearTimeout(revealTimer); }
    }).observe(box);
  }

  show(0);
  window.__model = { go: function (n) { goStage(n, true); } };
})();
