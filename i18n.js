/* English / עברית switch (owner, Nov 19: "a button that switches all of the text to hebrew").
   Loaded in <head> on every page. The choice is kept in localStorage, so it carries from page to page.
   In Hebrew the page turns right-to-left and the dictionary (i18n-he.js, written in during parsing so it
   is there before any other script runs) replaces each piece of text: the topmost element that holds text
   directly, matched by its English text and given its Hebrew HTML (so <em>, <a>, <b> stay in place);
   alt / aria-label / placeholder / title attributes; the page title. Text that scripts write later (the plan
   steps, room captions, form messages) is caught by a MutationObserver; canvas labels ask window.__t(). */
(function () {
  var lang = 'en';
  try { lang = localStorage.getItem('lang') === 'he' ? 'he' : 'en'; } catch (e) {}
  var he = lang === 'he', root = document.documentElement;
  window.__lang = lang;
  window.__t = function (s) { return s; };
  if (he) {
    root.lang = 'he'; root.dir = 'rtl';
    document.write('<script src="i18n-he.js"><\/script>');
  }

  var norm = function (s) { return s.replace(/\s+/g, ' ').trim(); };
  var SKIP = { SCRIPT: 1, STYLE: 1, NOSCRIPT: 1, TEMPLATE: 1 };
  var ATTRS = ['alt', 'aria-label', 'placeholder', 'title'];
  // sentences the order form builds from numbers
  var RULES = [
    [/^1 package \+ consultation$/, 'חבילה אחת + ייעוץ'],
    [/^(\d+) packages \+ consultation$/, '$1 חבילות + ייעוץ'],
    [/You save (.+?) with (\d+) packages\./g, 'אתם חוסכים $1 עם $2 חבילות.'],
    [/Add another package to save (.+?) more\./g, 'הוסיפו חבילה וחסכו עוד $1.'],
    [/Free if you add any package\./g, 'חינם עם כל חבילה.'],
    [/^See the (.+) finished$/, function (m, name) { return 'לראות את ' + (lookCase(name) || name) + ' גמור'; }]
  ];
  function lookCase(name) {
    var U = window.HE && window.HE.u, k = name.charAt(0).toUpperCase() + name.slice(1);
    return U && U[k] ? U[k].replace(/<[^>]+>/g, '') : null;
  }
  function byRules(t) {
    var out = t, hit = false;
    for (var i = 0; i < RULES.length; i++) if (RULES[i][0].test(out)) { RULES[i][0].lastIndex = 0; out = out.replace(RULES[i][0], RULES[i][1]); hit = true; }
    return hit ? out : null;
  }
  function hasText(el) {
    for (var n = el.firstChild; n; n = n.nextSibling) if (n.nodeType === 3 && n.nodeValue.trim()) return true;
    return false;
  }
  function attrs(el) {
    var A = window.HE.a;
    for (var i = 0; i < ATTRS.length; i++) {
      var v = el.getAttribute(ATTRS[i]); if (!v) continue;
      var k = norm(v), h = A[k] || window.HE.u[k] || byRules(k);
      if (h && h !== v) el.setAttribute(ATTRS[i], h.replace(/<[^>]+>/g, ''));
    }
  }
  function unit(el) {
    var U = window.HE.u, key = norm(el.textContent), h = U[key];
    if (h && !el.querySelector('input,select,textarea')) { if (el.innerHTML !== h) el.innerHTML = h; return; }
    // not a whole match (or it holds form fields): translate its own text pieces, then look inside
    for (var n = el.firstChild; n; n = n.nextSibling) {
      if (n.nodeType !== 3 || !n.nodeValue.trim()) continue;
      var k = norm(n.nodeValue), t = U[k] || byRules(k);
      if (t) n.nodeValue = n.nodeValue.replace(n.nodeValue.trim(), t.replace(/<[^>]+>/g, ''));
    }
    walk(el);
  }
  function walk(el) {
    for (var k = el.firstElementChild; k; k = k.nextElementSibling) {
      if (SKIP[k.tagName] || k.closest('.brand-word,.brand-sub,[translate="no"],.lang-btn')) continue;
      attrs(k);
      if (hasText(k)) unit(k); else walk(k);
    }
  }
  function node(el) {
    if (!el || el.nodeType !== 1 || el.closest('.brand-word,.brand-sub,[translate="no"],.lang-btn,script,style')) return;
    attrs(el);
    if (hasText(el)) unit(el); else walk(el);
  }
  function title() {
    var parts = document.title.split(' · '), T = window.HE.titles;
    if (T[parts[0]]) { parts[0] = T[parts[0]]; document.title = parts.join(' · '); }
  }

  // the switch, in the header beside "Let's talk" and at the end of the phone menu
  function addSwitch() {
    var nav = document.querySelector('header .links'); if (!nav) return;
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'lang-btn';
    b.lang = he ? 'en' : 'he';
    b.textContent = he ? 'English' : 'עברית';
    b.setAttribute('aria-label', he ? 'Switch to English' : 'החלפה לעברית');
    b.addEventListener('click', function () {
      try { localStorage.setItem('lang', he ? 'en' : 'he'); } catch (e) {}
      location.reload();
    });
    nav.insertBefore(b, nav.querySelector('.btn-primary') || nav.firstChild);
  }

  document.addEventListener('DOMContentLoaded', function () {
    addSwitch();
    if (!he || !window.HE) return;
    var C = window.HE.canvas;
    window.__t = function (s) { return C[s] || (window.HE.u[s] ? window.HE.u[s].replace(/<[^>]+>/g, '') : s); };
    title();
    walk(document.body);
    // text written later by the page's scripts
    new MutationObserver(function (list) {
      for (var i = 0; i < list.length; i++) {
        var m = list[i], t = m.type === 'characterData' ? m.target.parentElement : m.target;
        if (m.type === 'attributes') { if (t.closest && !t.closest('.lang-btn')) attrs(t); continue; }
        node(t);
      }
    }).observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });
  });
})();
