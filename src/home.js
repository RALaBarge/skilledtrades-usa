(function () {
  'use strict';
  var COLLEGES = window.COLLEGES, OCC = window.OCC, Q = window.TradeQuiz;
  var PATHS = { 'onjob-short': 'On the job (days to months)', 'onjob-mid': 'On the job (months)', 'onjob-long': 'On the job (a year or more)', certificate: 'Certificate or short program', apprenticeship: 'Apprenticeship', associate: '2-year degree', college: 'College degree', unknown: 'Varies' };

  function el(tag, props, kids) {
    var e = document.createElement(tag);
    for (var k in props || {}) {
      if (k === 'text') e.textContent = props[k];
      else if (k === 'class') e.className = props[k];
      else e.setAttribute(k, props[k]);
    }
    (kids || []).forEach(function (c) { if (c) e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return e;
  }
  function link(text, href, cls) { return el('a', { href: href, rel: 'noopener', 'class': cls || 'btn', text: text }); }
  function money(n) { return n == null ? 'n/a' : '$' + n.toLocaleString('en-US'); }

  /* ---------- state dropdown and college card ---------- */
  var MICHIGAN = { state: 'Michigan', college: 'Washtenaw Community College', city: 'Ann Arbor',
    college_home_url: 'https://www.wccnet.edu/', trades_page_url: '', local: 'michigan.html',
    programs: ['Construction technology', 'Welding', 'HVAC', 'Electrical (credit toward apprenticeship)', 'Automotive', 'Machining'], credentials: 'Certificates and associate degrees' };
  var states = COLLEGES.concat([MICHIGAN]).sort(function (a, b) { return a.state.localeCompare(b.state); });
  var sel = document.getElementById('statesel'), card = document.getElementById('statecard');
  states.forEach(function (s) { sel.appendChild(el('option', { value: s.state, text: s.state })); });

  function showState() {
    card.textContent = '';
    var s = states.filter(function (x) { return x.state === sel.value; })[0];
    if (!s) return;
    var kids = [el('h3', { text: s.college }), el('p', { 'class': 'meta', text: [s.city, s.credentials].filter(Boolean).join(' · ') })];
    if (s.programs && s.programs.length) {
      kids.push(el('p', { text: 'Trades programs listed:' }));
      kids.push(el('ul', { 'class': 'chips' }, s.programs.slice(0, 10).map(function (p) { return el('li', { text: p }); })));
    }
    var acts = [];
    if (s.local) acts.push(el('a', { href: s.local, 'class': 'btn', text: 'Read the full Michigan guide' }));
    if (s.trades_page_url) acts.push(link('See trades programs', s.trades_page_url));
    if (s.college_home_url) acts.push(link('College website', s.college_home_url, 'btn alt'));
    if (s.state_workforce_url) acts.push(link('State workforce office', s.state_workforce_url, 'btn alt'));
    kids.push(el('div', { 'class': 'actions' }, acts));
    kids.push(el('p', { 'class': 'note', text: 'One college to start from. Others in ' + s.state + ' may offer more, and many trades also train through paid apprenticeships.' }));
    card.appendChild(el('div', { 'class': 'card' }, kids));
  }
  sel.addEventListener('change', showState);

  /* ---------- quiz ---------- */
  var box = document.getElementById('quizbox'), ctx = Q.prepare(OCC), step = 0, ans = {};
  function startQuiz() { step = 0; ans = {}; renderQ(); }
  function renderQ() {
    var q = Q.QUESTIONS[step];
    box.textContent = '';
    var fs = el('fieldset', { 'class': 'q' }, [el('legend', { text: q.text })]);
    var opts = el('div', { 'class': 'opts' });
    var cur = ans[q.id] || (q.type === 'multi' ? [] : '');
    q.options.forEach(function (o, i) {
      var id = 'q' + step + 'o' + i;
      var inp = el('input', { type: q.type === 'multi' ? 'checkbox' : 'radio', name: 'q' + step, id: id, value: o[0] });
      inp.checked = q.type === 'multi' ? cur.indexOf(o[0]) >= 0 : cur === o[0];
      inp.addEventListener('change', function () {
        if (q.type === 'multi') {
          var picked = [].slice.call(opts.querySelectorAll('input:checked')).map(function (x) { return x.value; });
          if (picked.length > q.max) { inp.checked = false; picked = picked.filter(function (v) { return v !== o[0]; }); }
          ans[q.id] = picked;
        } else ans[q.id] = o[0];
      });
      opts.appendChild(el('label', { 'for': id }, [inp, el('span', { text: o[1] })]));
    });
    fs.appendChild(opts);
    var nav = el('div', { 'class': 'qnav' });
    if (step > 0) { var b = el('button', { type: 'button', 'class': 'btn alt', text: 'Back' }); b.addEventListener('click', function () { step--; renderQ(); }); nav.appendChild(b); }
    var last = step === Q.QUESTIONS.length - 1;
    var n = el('button', { type: 'button', 'class': 'btn', text: last ? 'Show my careers' : 'Next' });
    n.addEventListener('click', function () { if (last) renderResults(); else { step++; renderQ(); } });
    nav.appendChild(n);
    box.appendChild(el('p', { 'class': 'prog', text: 'Question ' + (step + 1) + ' of ' + Q.QUESTIONS.length + (q.type === 'multi' ? '. Pick up to ' + q.max + '.' : '') }));
    box.appendChild(fs); box.appendChild(nav);
    var first = box.querySelector('input'); if (first && step > 0) first.focus();
  }
  function renderResults() {
    box.textContent = '';
    var recs = Q.recommend(ans, ctx, 5);
    box.appendChild(el('h3', { text: 'Careers that fit you', tabindex: '-1', id: 'results-h' }));
    var ul = el('ul', { 'class': 'res' });
    recs.forEach(function (r) {
      var o = OCC.filter(function (x) { return x.soc === r.soc; })[0] || {};
      var kids = [el('h3', { text: r.name }), el('p', { 'class': 'meta', text: r.family }), el('p', { text: r.blurb })];
      if (r.because.length) kids.push(el('ul', { 'class': 'why' }, r.because.map(function (b) { return el('li', { text: b }); })));
      kids.push(el('p', { 'class': 'sub note', text: 'Way in: ' + (PATHS[o.path] || 'Varies') + '. US median pay ' + money(o.wage) + '.' }));
      ul.appendChild(el('li', {}, [el('div', { 'class': 'card' }, kids)]));
    });
    box.appendChild(ul);
    box.appendChild(el('p', { 'class': 'note', text: 'These are suggestions from a simple scoring of what you picked, not a test or a promise. Talk with a counselor, and visit a shop or a college to see the work.' }));
    var acts = el('div', { 'class': 'actions' });
    var again = el('button', { type: 'button', 'class': 'btn alt', text: 'Start over' });
    again.addEventListener('click', startQuiz);
    var find = el('a', { href: '#state', 'class': 'btn', text: 'Find a college near me' });
    acts.appendChild(find); acts.appendChild(again);
    box.appendChild(acts);
    document.getElementById('results-h').focus();
  }
  startQuiz();

  /* ---------- browse careers ---------- */
  var q = document.getElementById('q'), fam = document.getElementById('fam'), pth = document.getElementById('path'), set = document.getElementById('set');
  var cards = document.getElementById('cards'), count = document.getElementById('count'), more = document.getElementById('more'), shown = 24;
  function uniq(a) { return a.filter(function (v, i) { return a.indexOf(v) === i; }); }
  uniq(OCC.map(function (o) { return o.family; })).sort().forEach(function (f) { fam.appendChild(el('option', { value: f, text: f })); });
  uniq(OCC.map(function (o) { return o.path; })).forEach(function (p) { pth.appendChild(el('option', { value: p, text: PATHS[p] || p })); });
  var sorted = OCC.filter(function (o) { return !/all other|^miscellaneous|^helpers/i.test(o.name); })
    .sort(function (a, b) { return (b.deepDive ? 1 : 0) - (a.deepDive ? 1 : 0) || (b.workers || 0) - (a.workers || 0); });
  function renderBrowse(reset) {
    if (reset) shown = 24;
    var s = q.value.trim().toLowerCase();
    var rows = sorted.filter(function (o) {
      if (fam.value && o.family !== fam.value) return false;
      if (pth.value && o.path !== pth.value) return false;
      if (set.value && o.tags.setting !== set.value) return false;
      return !s || (o.name + ' ' + o.family + ' ' + o.blurb).toLowerCase().indexOf(s) >= 0;
    });
    cards.textContent = '';
    rows.slice(0, shown).forEach(function (o) {
      cards.appendChild(el('li', {}, [el('h3', { text: o.name }), el('p', { 'class': 'sub', text: o.family }), el('p', { text: o.blurb }),
        el('p', { 'class': 'sub', text: (PATHS[o.path] || 'Varies') + ' · US median ' + money(o.wage) + (o.growth != null ? ' · ' + (o.growth > 0 ? '+' : '') + o.growth + '% growth' : '') })]));
    });
    count.textContent = 'Showing ' + Math.min(shown, rows.length) + ' of ' + rows.length + ' careers';
    more.hidden = shown >= rows.length;
  }
  [q, fam, pth, set].forEach(function (e) { e.addEventListener('input', function () { renderBrowse(true); }); });
  more.addEventListener('click', function () { shown += 24; renderBrowse(false); });
  renderBrowse(true);
})();
