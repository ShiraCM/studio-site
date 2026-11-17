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
