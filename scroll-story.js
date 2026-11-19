/* Scrolling drives the plan story on the project pages (owner, Nov 19: "someone scrolling down the page
   totally misses the 3d animation"). Shared by jh3d.js (Kaduri) and al3d.js (Neve Amim).
   The step caption and the model stay pinned under the header while the visitor scrolls a stretch of
   the page (.jh-run), and the scroll position is the story's time: developer's plan → walls out and new
   walls in → the model rises. Scrolling back up plays it backwards. The story is finished a little before
   the stretch ends, so the finished model holds for a moment; then it is handed over (turn, move, room
   buttons) and the page scrolls on. */
export function scrollStory({ box, end, frame, done }) {
  const fig = box.querySelector('.jh-stage');
  const pin = document.createElement('div');
  pin.className = 'jh-pin';
  while (fig.firstChild) pin.append(fig.firstChild);
  const run = document.createElement('div');
  run.className = 'jh-run';
  run.setAttribute('aria-hidden', 'true');
  fig.append(pin, run);
  box.classList.add('jh-scrolly');

  const FINISH_AT = .82;   // share of the stretch at which the model is complete
  let finished = false, raf = 0, shown = -1;
  function update() {
    raf = 0;
    if (finished) return;
    const r = fig.getBoundingClientRect();
    const top = parseFloat(getComputedStyle(pin).top) || 0;
    const travel = Math.max(1, r.height - pin.offsetHeight);
    const p = Math.min(1, Math.max(0, (top - r.top) / travel));
    const t = Math.min(end, p / FINISH_AT * end);
    if (t !== shown) { shown = t; frame(t); }
    if (t >= end) stop();
  }
  const on = () => { if (!raf) raf = requestAnimationFrame(update); };
  function stop() {
    if (finished) return;
    finished = true;
    removeEventListener('scroll', on);
    removeEventListener('resize', on);
    done();
  }
  addEventListener('scroll', on, { passive: true });
  addEventListener('resize', on);
  update();
  return { update, stop };
}
