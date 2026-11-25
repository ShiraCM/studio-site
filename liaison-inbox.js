/* "See what this looks like": a short animation under Contractor and supplier liaison on the Packages page (owner, Nov 24).
   It replaces the old actor video (media/buying-on-paper.mp4, off the site since Nov 17), which the owner felt
   looked less professional. No actor: the inbox itself. Hebrew messages from the contractor and suppliers arrive
   on Israel time (with the hour in New York), the unread count climbs; then each message gets our short note in
   English and the count falls to zero; then the close. The messages are invented examples, never a client's.
   With prefers-reduced-motion it opens on the finished, sorted inbox. The Hebrew site translates the English
   through i18n-he.js and leaves out the New York hour. */
(function () {
  var open = document.querySelector('[data-open="liaison-inbox"]');
  if (!open) return;
  var HE = window.__lang === 'he';
  var CALL = 'https://calendar.app.google/oiMrJbxqETnfsCGP8';

  // [sender, subject, Israel time, New York time, our note, deadline tag]
  var MAIL = [
    ['מחלקת שינויי דיירים', 'נדרש אישור: תוכנית חשמל, גרסה 3', '08:05', '1:05 a.m.',
      'Electrical plan, version 3. It matches what you approved, except one outlet moved in the main bedroom. We’ve flagged it with the contractor.', 'Reply by Thursday'],
    ['מחלקת שינויי דיירים', 'נדרש אישור: תוכנית אינסטלציה', '08:30', '1:30 a.m.',
      'Plumbing plan for approval. We checked the toilet, shower and laundry points against your bathroom design. One drain is in the wrong place, and we’ve asked for it to be moved.', 'Reply by Thursday'],
    ['ספק מיזוג האוויר', 'אפשרויות לשדרוג מערכת המיזוג', '09:10', '2:10 a.m.',
      'Air conditioning upgrade options: a stronger unit for the living room, or a separate unit in each bedroom. We compared the prices and what fits your ceilings, and sent you our recommendation.', 'Decide by the 20th'],
    ['הנהלת חשבונות', 'דרישת תשלום מס׳ 4', '09:35', '2:35 a.m.',
      'Payment 4 is due Sunday. Part of it is linked to the construction index, so we checked the amount against your contract.', 'Due Sunday'],
    ['מחלקת שינויי דיירים', 'תזכורת דחופה: תוכנית חשמל', '10:05', '3:05 a.m.',
      'A reminder about the electrical plan. We answered it this morning, so there’s nothing more to do.', ''],
    ['ספק המטבחים', 'תיאום פגישה באולם התצוגה', '10:30', '3:30 a.m.',
      'The kitchen supplier asked for a showroom date. You’re in Israel the week of the 4th, so we booked the kitchen showroom for Monday and the tile supplier for Tuesday, and sent you both confirmations.', ''],
    ['ספק האלומיניום', 'בחירת גוון לחלונות ולתריסים', '10:50', '3:50 a.m.',
      'Window and shutter colors. The standard is white; we sent you the three options that suit your design, with the price of each.', 'Your choice needed'],
    ['ספק המטבחים', 'הזמנת מטבח ותוכנית תשתיות לחתימה', '11:15', '4:15 a.m.',
      'Your kitchen order and its plumbing and electrical plan are ready to sign. We checked that the sink, dishwasher, oven and outlets on the plan match your kitchen design, so the connections are built in the right places.', 'Sign by the 18th'],
    ['ספק המטבחים', 'חסרה מידה לנישת המקרר', '11:40', '4:40 a.m.',
      'The kitchen supplier needs your fridge’s exact size. We sent them the model you chose, with its measurements.', ''],
    ['ספק הדלתות', 'בחירת דלתות פנים: קטלוג ודגמים', '12:10', '5:10 a.m.',
      'The door supplier sent the catalog. We marked the three models that suit the finishes you chose, and priced an upgraded front door.', 'Reply by Monday'],
    ['מחלקת שינויי דיירים', 'זיכוי על כלים סניטריים', '12:35', '5:35 a.m.',
      'If you buy your own sinks and toilets, the contractor gives you a credit. We checked the amount: it covers about half of what you chose.', ''],
    ['ספק הקרמיקה', 'הזמנת קרמיקה לחתימה', '13:05', '6:05 a.m.',
      'Your tile order is ready to sign. We checked every line against what you chose at the supplier: codes, sizes, finishes and quantities, with extra for cuts.', 'Sign by Wednesday'],
    ['מחלקת שינויי דיירים', 'שינוי שלא ניתן לבצע', '13:30', '6:30 a.m.',
      'The contractor turned down moving the guest bathroom door. We found another way to keep your storage wall and resubmitted the change.', ''],
    ['מחלקת שינויי דיירים', 'מועד אחרון להגשת שינויים', '14:00', '7:00 a.m.',
      'The last day for changes is the 14th. Your kitchen and storage changes are already submitted.', 'Deadline: the 14th'],
    ['הנהלת חשבונות', 'עדכון מדד תשומות הבנייה', '14:25', '7:25 a.m.',
      'The construction index went up this month, so payment 5 will be a little higher. We added the new figure to your payment schedule.', ''],
    ['עו״ד הפרויקט', 'נספח שינויים לחתימה', '14:50', '7:50 a.m.',
      'An addendum for your changes, from the developer’s lawyer. We checked that it lists exactly the changes and prices you agreed. Your lawyer should still review it.', 'Sign by the 22nd'],
    ['מנהל הפרויקט', 'עדכון לוח זמנים לבנייה', '15:20', '8:20 a.m.',
      'A schedule update. Handover is still planned for the spring. Nothing here needs an answer from you.', ''],
    ['מנהל הפרויקט', 'סיור בדירה בשלב השלד', '15:45', '8:45 a.m.',
      'The apartment can be visited at the frame stage next week. We confirmed a time that works for you and sent the details.', ''],
    ['ספק הקרמיקה', 'תעודת משלוח: ריצוף לדירה', '16:25', '9:25 a.m.',
      'Your floor tiles were delivered to the site. We checked the delivery note and photos against your order: the right tile, size, finish and quantity.', ''],
    ['ספק הקרמיקה', 'אריח החיפוי לאמבטיה חסר במלאי', '17:10', '10:10 a.m.',
      'The bathroom wall tile you chose is out of stock. We found two close matches and sent you photos.', 'Your choice needed']
  ];

  var dlg = document.createElement('dialog');
  dlg.className = 'lx-dlg';
  dlg.setAttribute('aria-labelledby', 'lx-title');
  dlg.innerHTML =
    '<div class="lx">' +
      '<button type="button" class="lx-x" aria-label="Close">×</button>' +
      '<p class="label lx-kicker" id="lx-title">Contractor and supplier liaison</p>' +
      '<button type="button" class="lx-skip">Skip to the end</button>' +
      '<p class="lx-cap" aria-live="polite"></p>' +
      '<div class="lx-box">' +
        '<div class="lx-bar"><span class="lx-bar-name">Contractor &amp; suppliers</span><span class="lx-count"><b>0</b> <span class="lx-count-w">unread</span></span></div>' +
        '<ol class="lx-list"></ol>' +
      '</div>' +
      '<div class="lx-end">' +
        '<p class="lx-end-h">Every message read, explained and answered.</p>' +
        '<p class="lx-end-p">We read each message from the contractor and suppliers, tell you in English what it means and what’s due, and answer them for you in Hebrew.</p>' +
        '<div class="lx-end-btns"><a class="btn btn-primary" href="' + CALL + '" target="_blank" rel="noopener">Book a free call</a>' +
        '<button type="button" class="btn btn-ghost lx-again">Watch again</button></div>' +
      '</div>' +
    '</div>';
  document.body.append(dlg);

  var list = dlg.querySelector('.lx-list'), cap = dlg.querySelector('.lx-cap'), count = dlg.querySelector('.lx-count b'),
      end = dlg.querySelector('.lx-end'), wrap = dlg.querySelector('.lx');

  var rows = MAIL.map(function (m) {
    var li = document.createElement('li');
    li.className = 'lx-row';
    li.innerHTML =
      '<span class="lx-dot" aria-hidden="true"></span>' +
      '<div class="lx-msg">' +
        '<div class="lx-head"><p class="lx-time"></p><p class="lx-from" lang="he" dir="rtl"></p></div>' +
        '<p class="lx-subj" lang="he" dir="rtl"></p>' +
      '</div>' +
      '<div class="lx-note"><div><p class="lx-note-t"></p>' + (m[5] ? '<p class="lx-due"></p>' : '') + '</div></div>';
    li.querySelector('.lx-from').textContent = m[0];
    li.querySelector('.lx-subj').textContent = m[1];
    li.querySelector('.lx-time').textContent = HE ? m[2] : m[2] + ' Israel · ' + m[3] + ' New York';
    li.querySelector('.lx-note-t').textContent = m[4];
    if (m[5]) li.querySelector('.lx-due').textContent = m[5];
    list.append(li);
    return li;
  });

  var timers = [];
  var at = function (ms, fn) { timers.push(setTimeout(fn, ms)); };
  var setCap = function (t) { cap.textContent = t; };
  function reset() {
    timers.forEach(clearTimeout); timers = [];
    rows.forEach(function (r) { r.classList.remove('in', 'done'); });
    wrap.classList.remove('lx-over', 'lx-playing', 'lx-many');
    count.textContent = '0';
  }
  function finished() {
    rows.forEach(function (r) { r.classList.add('in', 'done'); });
    count.textContent = '0';
    setCap('We read every one and tell you, in English, what it means.');
    wrap.classList.remove('lx-playing', 'lx-many');
    wrap.classList.add('lx-over');
  }
  function play() {
    reset();
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { finished(); return; }
    wrap.classList.add('lx-playing');
    setCap('During construction, the messages come in Hebrew, on Israel time.');
    // the messages arrive faster and faster, and the list follows the newest one
    var t = 600;
    rows.forEach(function (r, i) {
      at(t, function () {
        r.classList.add('in'); count.textContent = String(i + 1);
        wrap.classList.toggle('lx-many', i >= 9);
        list.scrollTo({ top: r.offsetTop + r.offsetHeight - list.clientHeight, behavior: 'smooth' });
      });
      if (i === 10) at(t, function () { setCap('And they keep coming.'); });
      t += Math.max(260, 760 - i * 45);
    });
    t += 1500;
    at(t, function () { setCap('We read every one and tell you, in English, what it means.'); list.scrollTo({ top: 0, behavior: 'smooth' }); });
    t += 1100;
    rows.forEach(function (r, i) {
      at(t + i * 1000, function () {
        r.classList.add('done');
        count.textContent = String(rows.length - i - 1);
        wrap.classList.toggle('lx-many', rows.length - i - 1 > 9);
        list.scrollTo({ top: Math.max(0, r.offsetTop - 8), behavior: 'smooth' });
      });
    });
    t += rows.length * 1000 + 1000;
    at(t, function () { wrap.classList.remove('lx-playing'); wrap.classList.add('lx-over'); end.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); });
  }

  open.hidden = false;
  open.addEventListener('click', function () {
    if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', '');
    wrap.scrollTop = 0; list.scrollTop = 0;
    play();
  });
  dlg.querySelector('.lx-x').addEventListener('click', function () { dlg.close(); });
  dlg.querySelector('.lx-skip').addEventListener('click', function () {
    timers.forEach(clearTimeout); timers = []; finished(); end.scrollIntoView({ block: 'nearest' });
  });
  dlg.querySelector('.lx-again').addEventListener('click', function () { wrap.scrollTop = 0; list.scrollTop = 0; play(); });
  dlg.addEventListener('click', function (e) { if (e.target === dlg) dlg.close(); });
  dlg.addEventListener('close', reset);
})();
