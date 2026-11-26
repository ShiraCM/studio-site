// Phone menu: the button in the header opens a list of the site's parts.
(function () {
  var btn = document.querySelector('.menu-btn'), panel = document.getElementById('site-menu');
  if (!btn || !panel) return;
  function set(open) {
    btn.setAttribute('aria-expanded', String(open));
    panel.hidden = !open;
    document.documentElement.classList.toggle('menu-open', open);
  }
  btn.addEventListener('click', function () { set(panel.hidden); });
  panel.addEventListener('click', function (e) { if (e.target.closest('a')) set(false); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !panel.hidden) { set(false); btn.focus(); } });
  document.addEventListener('click', function (e) { if (!panel.hidden && !e.target.closest('header.top')) set(false); });
  addEventListener('resize', function () { if (innerWidth > 760 && !panel.hidden) set(false); });
})();

// "← Home" links: if you came from another page of this site, they say "← Back" and take you back
// to exactly where you were (the browser restores the scroll position). Opened directly, they go home.
(function () {
  var ref = document.referrer, same = false;
  try { same = ref && new URL(ref).origin === location.origin && new URL(ref).pathname !== location.pathname; } catch (e) {}
  if (!same || history.length < 2) return;
  document.querySelectorAll('a.back').forEach(function (a) {
    a.textContent = '← Back';
    a.addEventListener('click', function (e) { e.preventDefault(); history.back(); });
  });
})();

// drawings that draw themselves in when they scroll into view
(function () {
  if (!window.IntersectionObserver) return;
  document.querySelectorAll('.closet-plan').forEach(function (el) {
    el.classList.add('armed');
    new IntersectionObserver(function (es, io) { if (es[0].isIntersecting) { el.classList.add('in'); io.disconnect(); } }, { threshold: .35 }).observe(el);
  });
})();

/* Phones (owner, Nov 26): the "On this page" bar on the home page, and a back-to-top button on every page.
   (menu.js loads on every page, including the hand-written index.html, which has no app.js.) */
(function () {
  // Phones (owner, Nov 26): the "On this page" bar underlines the part you're in, and a small button
  // takes you back to the top once you've scrolled a couple of screens.
  var jump = document.querySelector('.jump');
  if (jump && 'IntersectionObserver' in window) {
    var links = [].slice.call(jump.querySelectorAll('a'));
    var parts = links.map(function (a) { return document.querySelector(a.getAttribute('href')); });
    var seen = {};
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { seen[e.target.id] = e.isIntersecting; });
      var cur = null;
      parts.forEach(function (p) { if (p && seen[p.id]) cur = cur || p.id; });
      links.forEach(function (a) {
        var on = cur && a.getAttribute('href') === '#' + cur;
        if (on) { a.setAttribute('aria-current', 'true'); if (jump.scrollWidth > jump.clientWidth) jump.scrollTo({ left: a.offsetLeft - 12, behavior: 'smooth' }); }
        else a.removeAttribute('aria-current');
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    parts.forEach(function (p) { if (p) io.observe(p); });
  }
  var up = document.createElement('button');
  up.type = 'button'; up.className = 'to-top'; up.setAttribute('aria-label', 'Back to top'); up.hidden = true;
  up.innerHTML = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M8 13V3M4 7l4-4 4 4"/></svg>';
  document.body.appendChild(up);
  up.addEventListener('click', function () {
    window.scrollTo({ top: 0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  });
  var upQueued = false;
  addEventListener('scroll', function () {
    if (upQueued) return; upQueued = true;
    requestAnimationFrame(function () { upQueued = false; up.hidden = scrollY < innerHeight * 1.5; });
  }, { passive: true });

})();
