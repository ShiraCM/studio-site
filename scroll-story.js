/* Scrolling drives the plan story on the project pages, the way the kitchen story works on the home page.
   Shared by jh3d.js (Kaduri) and al3d.js (Neve Amim).
   Owner, Nov 19: "someone scrolling down the page totally misses the 3d animation". A pinned version felt
   "stuck"; one tied only to the model's position on screen rushed "the whole demolition and construction
   process". So: three short captions (developer's plan · demolition and new walls · the model) scroll by
   with the page, and the model stays beside them (wide screens) or under the header (phones). The caption
   at the reading line sets the story's time, so the demolition gets a whole caption's worth of scrolling.
   When the last caption reaches the line the model is complete and handed over (turn, move, room buttons).
   Scrolling back up plays it backwards until then. */
export function scrollStory({ box, steps, end, frame, done }) {
  const stage = box.querySelector('.jh-stage');
  const list = document.createElement('ol');
  list.className = 'jh-steps';
  for (const [, num, name, note] of steps) {
    const li = document.createElement('li');
    li.className = 'jh-step';
    const h = document.createElement('p'); h.className = 'jh-step-name';
    const b = document.createElement('b'); b.textContent = num;
    h.append(b, ' ' + name);
    const p = document.createElement('p'); p.className = 'jh-step-note'; p.textContent = note;
    li.append(h, p);
    list.append(li);
  }
  stage.before(list);
  box.classList.add('jh-scrolly');
  const items = [...list.children];

  // the time shown when each caption's middle is at the reading line: the plan still whole, the new
  // walls all drawn, the model risen
  const AT = [steps[1][0], steps[2][0], end];
  const phone = matchMedia('(max-width: 900px)');
  let finished = false, raf = 0, shown = -1, on = -1;
  function readingLine() {
    const ih = innerHeight;
    if (!phone.matches) return ih * .55;
    const below = stage.getBoundingClientRect().bottom;      // phones: the middle of the space under the model
    return below + (ih - below) / 2;
  }
  function update() {
    raf = 0;
    if (finished) return;
    const line = readingLine();
    const c = items.map(li => { const r = li.getBoundingClientRect(); return r.top + r.height / 2; });
    let t;
    if (c[0] >= line) t = Math.max(0, AT[0] * (1 - (c[0] - line) / innerHeight));   // the plan, before the first caption arrives
    else if (c[c.length - 1] <= line) t = end;
    else {
      // captions further down the page sit lower on screen: find the two the line falls between
      let i = 0; while (c[i + 1] <= line) i++;
      const f = (line - c[i]) / Math.max(1, c[i + 1] - c[i]);
      t = AT[i] + (AT[i + 1] - AT[i]) * Math.min(1, Math.max(0, f));
    }
    // the caption nearest the line is the current one
    let near = 0; c.forEach((y, i) => { if (Math.abs(y - line) < Math.abs(c[near] - line)) near = i; });
    if (near !== on) { on = near; items.forEach((li, i) => li.classList.toggle('on', i === near)); }
    if (t !== shown) { shown = t; frame(t); }
    if (t >= end) stop();
  }
  const ask = () => { if (!raf) raf = requestAnimationFrame(update); };
  function stop() {
    if (finished) return;
    finished = true;
    removeEventListener('scroll', ask);
    removeEventListener('resize', ask);
    items.forEach(li => li.classList.add('on'));
    done();
  }
  addEventListener('scroll', ask, { passive: true });
  addEventListener('resize', ask);
  update();
  return { update, stop };
}
