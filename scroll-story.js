/* Scrolling drives the plan story on the project pages. Shared by jh3d.js (Kaduri) and al3d.js (Neve Amim).
   Owner, Nov 19: "someone scrolling down the page totally misses the 3d animation"; then, of a pinned
   version: "it feels like the scrolling is stuck". So nothing is pinned: the page scrolls normally, and
   the story follows where the model sits on the screen. It starts as the model comes up from the bottom
   (developer's plan), the walls change as it moves up, and the model has risen by the time its top
   reaches the header. Scrolling back up plays it backwards. Then the model is handed over (turn, move,
   room buttons) and stays that way. */
export function scrollStory({ box, end, frame, done }) {
  const view = box.querySelector('.jh-view');
  const HEADER = 76;              // the sticky header, plus a little air
  let finished = false, raf = 0, shown = -1;
  function update() {
    raf = 0;
    if (finished) return;
    const ih = innerHeight, top = view.getBoundingClientRect().top;
    const from = ih * .8;         // story starts when the model's top is 80% down the screen
    const to = HEADER;            // and is complete when its top reaches the header
    const p = Math.min(1, Math.max(0, (from - top) / Math.max(1, from - to)));
    const t = p * end;
    if (t !== shown) { shown = t; frame(t); }
    if (p >= 1) stop();
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
