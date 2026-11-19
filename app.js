(function () {
  // Before/after sliders
  document.querySelectorAll('.compare').forEach(function (box) {
    var r = box.querySelector('input[type=range]');
    if (r) r.addEventListener('input', function () { box.style.setProperty('--pos', r.value + '%'); });
  });

  // Plan viewers (tabs)
  document.querySelectorAll('.viewer').forEach(function (v) {
    var btns = v.querySelectorAll('[role=tab]');
    var panels = v.querySelectorAll('[role=tabpanel]');
    function show(i) {
      btns.forEach(function (b, j) { b.setAttribute('aria-selected', i === j ? 'true' : 'false'); b.tabIndex = i === j ? 0 : -1; });
      panels.forEach(function (p, j) { p.hidden = i !== j; });
    }
    btns.forEach(function (b, i) {
      b.addEventListener('click', function () { show(i); });
      b.addEventListener('keydown', function (e) {
        var n = e.key === 'ArrowRight' ? i + 1 : e.key === 'ArrowLeft' ? i - 1 : null;
        if (n === null) return;
        n = (n + btns.length) % btns.length; show(n); btns[n].focus(); e.preventDefault();
      });
    });
  });

  // Lightbox for plans and photos
  var zooms = document.querySelectorAll('img[data-zoom]');
  if (zooms.length) {
    var dlg = document.createElement('dialog');
    dlg.className = 'lb';
    dlg.innerHTML = '<button type="button" aria-label="Close">×</button><img alt=""><p></p>';
    document.body.appendChild(dlg);
    var big = dlg.querySelector('img'), cap = dlg.querySelector('p');
    dlg.querySelector('button').addEventListener('click', function () { dlg.close(); });
    dlg.addEventListener('click', function (e) { if (e.target === dlg) dlg.close(); });
    zooms.forEach(function (img) {
      img.tabIndex = 0;
      img.setAttribute('role', 'button');
      function open() {
        big.src = img.dataset.zoom || img.src; big.alt = img.alt; cap.textContent = img.alt;
        if (dlg.showModal) dlg.showModal();
      }
      img.addEventListener('click', open);
      img.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
    });
  }

  // Contact form: build an inquiry and copy it
  var form = document.getElementById('inquiry-form');
  if (form) {
    var status = document.getElementById('copy-status');
    var fallback = document.getElementById('copy-fallback');
    var pkg = form.elements.namedItem('package');
    function fromHash() {
      var h = (location.hash || '').slice(1);
      if (h && Array.prototype.some.call(pkg.options, function (o) { return o.value === h; })) pkg.value = h;
    }
    fromHash();
    window.addEventListener('hashchange', fromHash);
    form.addEventListener('input', function () { status.textContent = ''; fallback.hidden = true; });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!form.reportValidity()) return;
      var v = new FormData(form);
      var lines = ['Hello Shira Svei Design Studio team,', '', 'Could we discuss the plans for this apartment?', '',
        'Name: ' + String(v.get('name')).trim(),
        'Stage: ' + v.get('stage')];
      if (pkg.value) lines.push('Package: ' + pkg.selectedOptions[0].textContent);
      if (v.get('purpose')) lines.push('Plans for the apartment: ' + v.get('purpose'));
      if (String(v.get('deadline') || '').trim()) lines.push('Next deadline: ' + String(v.get('deadline')).trim());
      lines.push('Project and upcoming decisions: ' + String(v.get('details')).trim());
      var text = lines.join('\n');
      var to = form.getAttribute('data-email');
      if (to) {
        location.href = 'mailto:' + to + '?subject=' + encodeURIComponent('Apartment inquiry: ' + String(v.get('name')).trim()) + '&body=' + encodeURIComponent(text);
        status.textContent = 'Your email app should open with your message ready. Press Send there.';
        return;
      }
      function showFallback() {
        fallback.value = text; fallback.hidden = false; fallback.focus(); fallback.select();
        status.textContent = 'Copy the selected text below.';
      }
      try {
        navigator.clipboard.writeText(text).then(function () { status.textContent = 'Inquiry copied.'; }, showFallback);
      } catch (err) { showFallback(); }
    });
  }
})();

// Order page: tick packages, keep a running total, copy the order.
// Every package after the first saves data-saving dollars; the consultation is free with any package.
(function () {
  var form = document.getElementById('order-form');
  if (!form) return;
  var saving = +form.dataset.saving || 0;
  var consult = form.querySelector('.oitem.consult');
  var consultBox = consult.querySelector('input');
  var pkgs = Array.prototype.slice.call(form.querySelectorAll('.oitem:not(.consult)'));
  var countEl = document.getElementById('o-count'), totalEl = document.getElementById('o-total');
  var noteEl = document.getElementById('o-note'), statusEl = document.getElementById('o-status');
  var fallback = document.getElementById('o-fallback'), submit = form.querySelector('button[type=submit]');
  var pay = document.getElementById('o-pay');
  // Placeholder until PayPal is connected: explains instead of taking payment.
  pay.addEventListener('click', function () { statusEl.textContent = 'Online payment is coming soon. For now, copy your order and we’ll send you a PayPal invoice.'; });
  // The Hebrew site shows shekels: the dollar price × 3.1 (owner, Nov 19), written "2,325 ₪".
  var he = window.__lang === 'he';
  var money = he ? function (n) { return Math.round(n * 3.1).toLocaleString('en-US') + ' ₪'; }
                 : function (n) { return '$' + n.toLocaleString('en-US'); };
  if (he) form.querySelectorAll('.oitem').forEach(function (li) {
    li.querySelectorAll('.oprice s, .oprice .amt').forEach(function (el) { el.textContent = money(+li.dataset.price); });
  });
  var userConsult = false;

  function calc() {
    var picked = pkgs.filter(function (li) { return li.querySelector('input').checked; });
    var sub = picked.reduce(function (s, li) { return s + +li.dataset.price; }, 0);
    var off = Math.max(0, picked.length - 1) * saving;
    var consultFree = picked.length > 0;
    var consultOn = consultFree || consultBox.checked;
    if (consultOn && !consultFree) sub += +consult.dataset.price;
    return { picked: picked, sub: sub, off: off, total: sub - off, consultOn: consultOn, consultFree: consultFree };
  }

  function update() {
    var r = calc();
    consult.classList.toggle('included', r.consultFree);
    consultBox.checked = r.consultFree || userConsult;
    consultBox.disabled = r.consultFree;
    consult.querySelector('s').hidden = !r.consultFree;
    consult.querySelector('.amt').textContent = r.consultFree ? 'Included' : money(+consult.dataset.price);
    var n = r.picked.length;
    countEl.textContent = n ? n + (n === 1 ? ' package' : ' packages') + ' + consultation'
                            : (r.consultOn ? 'Consultation' : 'Nothing selected yet');
    totalEl.textContent = money(r.total);
    var notes = [];
    if (r.off) notes.push('You save ' + money(r.off) + ' with ' + n + ' packages.');
    if (n && n < pkgs.length) notes.push('Add another package to save ' + money(saving) + ' more.');
    if (!n && r.consultOn) notes.push('Free if you add any package.');
    noteEl.textContent = notes.join(' ');
    submit.disabled = !r.consultOn;
    pay.disabled = !r.consultOn;
    statusEl.textContent = ''; fallback.hidden = true;
  }
  consultBox.addEventListener('change', function () { userConsult = consultBox.checked; });
  form.addEventListener('change', update);

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var r = calc(); if (!r.consultOn) return;
    var lines = ['Hello Shira Svei Design Studio team,', '', 'I’d like to order:', ''];
    lines.push('• Consultation: ' + (r.consultFree ? 'included' : money(+consult.dataset.price)));
    r.picked.forEach(function (li) { lines.push('• ' + li.dataset.name + ': ' + money(+li.dataset.price)); });
    if (r.off) lines.push('', 'Package savings: −' + money(r.off));
    lines.push('Total: ' + money(r.total));
    var text = lines.join('\n');
    function showFallback() { fallback.value = text; fallback.hidden = false; fallback.focus(); fallback.select(); statusEl.textContent = 'Copy the selected text below.'; }
    try { navigator.clipboard.writeText(text).then(function () { statusEl.textContent = 'Order copied. Paste it into an email to us.'; }, showFallback); }
    catch (err) { showFallback(); }
  });
  update();
})();
