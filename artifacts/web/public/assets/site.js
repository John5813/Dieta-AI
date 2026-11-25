/* kaloria.uz — landing page interactions. */
(function () {
  'use strict';
  var K = window.K;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  var IMG = { A: 'm1-breakfast', Y: 'm2-yogurt', C: 'm3-chicken', W: 'm4-bowl', S: 'm5-salmon', L: 'plate-salad', V: 'plate-veg' };
  var img = function (code) { return '/assets/img/' + IMG[code] + '.webp'; };
  var MENU = [['A', 'Y', 'C', 'W', 'S'], ['Y', 'V', 'S', 'W', 'L'], ['A', 'Y', 'L', 'V', 'C'], ['Y', 'V', 'C', 'W', 'S'], ['A', 'Y', 'S', 'V', 'L'], ['Y', 'V', 'L', 'W', 'C']];
  var TIMES = ['08:00', '11:00', '13:30', '16:30', '19:30'];
  // Sample day per tier (kcal per meal) and day totals — replace with the kitchen's real menu.
  var KC = [[280, 120, 380, 110, 310], [360, 170, 500, 160, 410], [480, 250, 680, 240, 550]];
  var TOT = [{ k: 1200, p: 90, f: 40, c: 120 }, { k: 1600, p: 110, f: 53, c: 172 }, { k: 2200, p: 150, f: 70, c: 245 }];
  var TIERS = ['1200', '1600', '2200'];
  var RATIONS = ['ozish', 'balans', 'sport'];
  var PLANS = ['d3', 'w1', 'w2', 'w3', 'w4', 'm1'];
  var SW = ['#1E6B3A', '#121512', '#FF5B2E'];

  var S = { tier: 1, meal: 2, day: 0, ration: 1, plan: 0, late: false, frozen: {}, sheet: null };

  function meal(code, i) {
    var D = K.d(), share = KC[S.tier][i] / TOT[S.tier].k, T = TOT[S.tier];
    return { code: code, img: img(code), name: D.dish[code], type: D.types[i], time: TIMES[i], kcal: KC[S.tier][i], p: Math.round(T.p * share), f: Math.round(T.f * share), c: Math.round(T.c * share) };
  }

  function renderTiers() {
    $$('.js-tiers').forEach(function (box) {
      box.innerHTML = TIERS.map(function (l, i) { return '<button type="button" data-tier="' + i + '" aria-pressed="' + (S.tier === i) + '">' + l + '</button>'; }).join('');
    });
  }

  function renderHero(animate) {
    var D = K.d(), meals = MENU[0].map(meal), h = meals[S.meal], T = TOT[S.tier];
    $('.js-meals').innerHTML = meals.map(function (m, i) {
      return '<button type="button" class="meal" data-meal="' + i + '" aria-pressed="' + (S.meal === i) + '"><img src="' + m.img + '" alt="" width="48" height="48" loading="lazy"><span style="display:flex;flex-direction:column;gap:1px;min-width:0"><span class="mt">' + K.esc(m.type) + ' · ' + m.time + '</span><span class="nm">' + K.esc(m.name) + '</span></span><span class="m" style="font-size:15px;font-weight:600">' + m.kcal + '</span></button>';
    }).join('');
    var im = $('.js-hero-img');
    if (im.getAttribute('src') !== h.img) im.src = h.img;
    im.alt = h.name;
    if (animate) { im.classList.remove('pop'); void im.offsetWidth; im.classList.add('pop'); }
    $('.js-hero-type').textContent = h.type + ' · ' + h.time;
    $('.js-hero-name').textContent = h.name;
    $('.js-hero-kcal').textContent = h.kcal;
    $('.js-hero-bju').textContent = D.P1 + ' ' + h.p + D.g + ' · ' + D.F1 + ' ' + h.f + D.g + ' · ' + D.C1 + ' ' + h.c + D.g;
    $$('.js-kcal').forEach(function (e) { e.textContent = ' ' + D.kcal; });
    $('.js-tot').textContent = K.fmt(T.k);
    $('.js-ring').textContent = ('KALORIA.UZ · ' + TIERS[S.tier] + ' ' + D.kcal.toUpperCase() + ' · ' + D.meals5 + ' · ').repeat(2);
    var bars = [[D.P, T.p, '#1E6B3A'], [D.F, T.f, '#FF5B2E'], [D.C, T.c, '#121512']];
    $('.js-bars').innerHTML = bars.map(function (b) {
      return '<div class="brow"><span style="font-weight:500">' + b[0] + '</span><span class="bar"><i style="width:' + Math.round(b[1] / 260 * 100) + '%;background:' + b[2] + '"></i></span><span class="m" style="text-align:right">' + b[1] + D.g + '</span></div>';
    }).join('');
  }

  function renderTicker() {
    var D = K.d(), items = [];
    for (var r = 0; r < 2; r++) { items.push(D.tick); MENU[1].forEach(function (c, i) { items.push(D.dish[c] + ' — ' + KC[S.tier][i] + ' ' + D.kcal); }); }
    $('.js-ticker').innerHTML = items.map(function (t) { return '<span><i>✱</i>' + K.esc(t) + '</span>'; }).join('');
  }

  function renderRations() {
    var D = K.d();
    $('.js-rations').innerHTML = RATIONS.map(function (id, i) {
      var r = D.rations[id], T = TOT[i];
      return '<article class="lbl ration"><div style="display:flex;justify-content:space-between;align-items:center"><span class="nm">' + r[0] + '</span><span class="sw" style="background:' + SW[i] + '"></span></div>' +
        '<span class="mt" style="margin-top:2px">' + D.rationMeta + '</span><div class="rx" style="margin:12px 0 8px"></div>' +
        '<div style="display:flex;justify-content:space-between;align-items:baseline"><b>' + D.kcalWord + '</b><span class="rg">' + r[1] + '</span></div><div class="rm" style="margin-top:8px"></div>' +
        [[D.P, T.p], [D.F, T.f], [D.C, T.c]].map(function (x) { return '<div class="rrow"><b>' + x[0] + '</b><span class="m">≈ ' + x[1] + ' ' + D.g + '</span></div>'; }).join('') +
        '<p>' + r[2] + '</p><a class="btn btn-ink btn-sm js-quiz" href="/hisoblash" style="margin-top:auto;justify-content:space-between"><span>' + D.choose + '</span><svg width="18" height="18"><use href="#i-arrow"/></svg></a></article>';
    }).join('');
  }

  function renderMenu() {
    var D = K.d();
    $('.js-days').innerHTML = D.dows.map(function (l, i) {
      return i === 6 ? '<button type="button" class="day" disabled>' + l + '<small>' + D.off + '</small></button>'
        : '<button type="button" class="day" data-day="' + i + '" aria-pressed="' + (S.day === i) + '">' + l + '<small>&nbsp;</small></button>';
    }).join('');
    $('.js-dishes').innerHTML = MENU[S.day].map(meal).map(function (m) {
      return '<article class="dish"><div class="ph-img"><img src="' + m.img + '" alt="' + K.esc(m.name) + '" loading="lazy" width="420" height="344"><span class="tm">' + m.time + '</span></div>' +
        '<div class="bd"><span class="mt">' + K.esc(m.type) + '</span><span class="nm">' + K.esc(m.name) + '</span><div class="ft"><span class="d" style="font-size:22px;font-weight:800">' + m.kcal + '</span><span class="m" style="font-size:11px;color:var(--muted)">' + D.P1 + m.p + ' ' + D.F1 + m.f + ' ' + D.C1 + m.c + '</span></div></div></article>';
    }).join('');
  }

  function renderPrice() {
    var D = K.d(), plan = PLANS[S.plan], ration = RATIONS[S.ration], pt = K.planTotal(ration, plan), now = new Date();
    $('.js-rseg').innerHTML = RATIONS.map(function (id, i) { return '<button type="button" data-ration="' + i + '" aria-pressed="' + (S.ration === i) + '">' + D.rations[id][0] + '</button>'; }).join('');
    $('.js-tiles').innerHTML = PLANS.map(function (p, i) {
      var disc = K.CFG.discounts[p] || 0;
      return '<button type="button" class="tile" data-plan="' + i + '" aria-pressed="' + (S.plan === i) + '"><b>' + D.plans[p] + '</b>' + (p === 'd3' ? '<span class="tag">' + D.testTag + '</span>' : '') +
        '<span class="ts">' + K.CFG.planDays[p] + ' ' + D.daysW + (disc ? ' · −' + disc + '%' : '') + '</span></button>';
    }).join('');
    $('.js-rc-date').textContent = K.fdate(now) + ' ' + now.getFullYear();
    $('.js-rc-ration').textContent = D.rations[ration][0] + ' ' + TIERS[S.ration];
    $('.js-rc-term').textContent = D.plans[plan];
    $('.js-rc-days').textContent = pt.days + ' ' + D.daysW;
    $('.js-rc-price').textContent = K.fmt(pt.price);
    $('.js-rc-disc').textContent = pt.disc ? '−' + pt.disc + '% (' + K.fmt(pt.gross - pt.total) + ')' : '—';
    $('.js-rc-total').textContent = K.fmt(pt.total);
    $$('.js-sum').forEach(function (e) { e.textContent = ' ' + D.sum; });
    $('.js-rc-perday').textContent = '≈ ' + K.fmt(pt.total / pt.days) + ' ' + D.sum + ' / ' + D.perDay;
    var test = plan === 'd3';
    $('.js-mgr').style.display = test ? 'none' : '';
    $('.js-test-note').style.display = test ? '' : 'none';
    $('.js-sample').style.display = K.CFG.samplePrices ? '' : 'none';
  }

  // ── freeze demo calendar ──
  function dkey(d) { return d.getFullYear() + '-' + d.getMonth() + '-' + d.getDate(); }
  function renderCal() {
    var D = K.d(), now = new Date(), base = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    var mon = new Date(base); mon.setDate(base.getDate() - ((base.getDay() + 6) % 7));
    var tom = new Date(base); tom.setDate(base.getDate() + 1);
    $('.js-month').textContent = D.monthsN[base.getMonth()] + ' ' + base.getFullYear();
    $('.js-dows').innerHTML = D.dows.map(function (w) { return '<span>' + w + '</span>'; }).join('');
    var html = '';
    for (var i = 0; i < 14; i++) {
      var d = new Date(mon); d.setDate(mon.getDate() + i);
      var key = dkey(d), sun = d.getDay() === 0, past = d < base, today = d.getTime() === base.getTime();
      var locked = !sun && (today || (d.getTime() === tom.getTime() && S.late));
      var fz = !!S.frozen[key];
      var cls = 'cell' + (past ? ' past' : sun ? ' sun' : fz ? ' frz' : locked ? ' lock' : '') + (today ? ' today' : '');
      var icon = fz && !past ? '<svg width="13" height="13"><use href="#i-snow"/></svg>' : locked && !past && !today ? '<svg width="13" height="13"><use href="#i-lock"/></svg>' : sun ? '<small>' + D.off + '</small>' : '';
      var usable = !(past || sun || locked);
      html += '<button type="button" class="' + cls + '" data-cell="' + d.getTime() + '"' + (usable ? '' : ' aria-disabled="true"') + ' aria-label="' + K.fdate(d) + '">' + d.getDate() + icon + '</button>';
    }
    $('.js-cal').innerHTML = html;
    var list = Object.keys(S.frozen).map(function (k) { return S.frozen[k]; }).sort(function (a, b) { return a - b; });
    $('.js-fz-n').textContent = list.length + ' ' + D.daysW;
    $('.js-fz-burn').textContent = list.length ? K.fdate(new Date(list[0] + 30 * 864e5)) : '—';
    $('.js-early').setAttribute('aria-pressed', String(!S.late));
    $('.js-late').setAttribute('aria-pressed', String(S.late));
  }

  // ── modals ──
  var lastFocus = null;
  function openModal(m) {
    lastFocus = document.activeElement;
    m.classList.add('open'); m.setAttribute('aria-hidden', 'false'); document.body.classList.add('noscroll');
    var f = m.querySelector('input:not(.hp), button.js-fz-ok, button'); if (f) setTimeout(function () { f.focus(); }, 50);
  }
  function closeModal(m) {
    m.classList.remove('open'); m.setAttribute('aria-hidden', 'true'); document.body.classList.remove('noscroll');
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') $$('.modal.open').forEach(closeModal); });
  $$('.modal').forEach(function (m) { m.addEventListener('click', function (e) { if (e.target.closest('.js-close')) closeModal(m); }); });

  function openFreeze(ts) {
    S.sheet = ts;
    var d = new Date(ts), m = $('.js-fz-modal');
    $('.js-fz-date').textContent = K.fdate(d);
    $('.js-fz-burn-d').textContent = K.fdate(new Date(ts + 30 * 864e5)) + (K.d().until ? ' ' + K.d().until : '');
    $('.js-fz-rules').innerHTML = $('.js-rules').innerHTML;
    var ag = $('.js-fz-agree'); ag.checked = false; $('.js-fz-ok').disabled = true;
    openModal(m);
  }
  $('.js-fz-agree').addEventListener('change', function (e) { $('.js-fz-ok').disabled = !e.target.checked; });
  $('.js-fz-ok').addEventListener('click', function () {
    if (!$('.js-fz-agree').checked || !S.sheet) return;
    S.frozen[dkey(new Date(S.sheet))] = S.sheet; S.sheet = null;
    closeModal($('.js-fz-modal')); renderCal();
  });

  // order form
  var orderCtx = { intent: 'test_drive' };
  function openOrder(intent) {
    var D = K.d(), m = $('.js-order-modal');
    orderCtx = { intent: intent, plan: PLANS[S.plan], planRation: RATIONS[S.ration] };
    $('.js-of-kicker').textContent = D.ofKick[intent];
    $('.js-of-title').textContent = D.ofTitle[intent];
    $('.js-of-fields').style.display = ''; $('.js-of-ok').style.display = 'none'; $('.js-of-err').textContent = '';
    var last = K.lastLead();
    if (last && !$('#ofName').value) { $('#ofName').value = last.name || ''; $('#ofPhone').value = K.phoneFmt(K.phoneDigits(last.phone)); }
    openModal(m);
    K.track('InitiateCheckout', { content_name: orderCtx.planRation + '_' + orderCtx.plan });
    K.goal('order_open_' + intent);
  }
  $('#ofPhone').addEventListener('input', function (e) { var d = K.phoneDigits(e.target.value); e.target.value = K.phoneFmt(d); });
  $('.js-order-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var D = K.d(), f = e.target, name = f.name.value.trim(), digits = K.phoneDigits(f.phone.value), btn = $('.js-of-submit');
    var district = f.district.value, address = f.address.value.trim().slice(0, 200);
    if (name.length < 2 || digits.length !== 9) { $('.js-of-err').textContent = D.errContact; return; }
    btn.disabled = true; $('.js-of-err').textContent = '';
    var a = K.attribution(), last = K.lastLead();
    var req = last && last.phone === '+998' + digits
      ? K.post('/api/v1/leads/' + last.id + '/intent', { key: last.key, intent: orderCtx.intent, plan: orderCtx.plan, planRation: orderCtx.planRation, district: district, address: address })
      : K.post('/api/v1/leads', { name: name, phone: digits, lang: K.lang, intent: orderCtx.intent, plan: orderCtx.plan, planRation: orderCtx.planRation, district: district, address: address, website: f.website.value, utm: a.utm, referrer: a.referrer, landingPath: a.landingPath });
    req.then(function (r) {
      btn.disabled = false;
      if (!r.ok) { $('.js-of-err').textContent = (r.data && r.data.error) || D.errNet; return; }
      if (r.data && r.data.key) K.saveLead({ id: r.data.id, key: r.data.key, name: name, phone: '+998' + digits });
      $('.js-of-fields').style.display = 'none'; $('.js-of-ok').style.display = '';
      K.track('Lead', { content_name: orderCtx.intent, content_category: orderCtx.planRation + '_' + orderCtx.plan });
      K.goal('order_submit_' + orderCtx.intent);
    }).catch(function () { btn.disabled = false; $('.js-of-err').textContent = D.errNet; });
  });

  // ── events ──
  document.addEventListener('click', function (e) {
    var t = e.target.closest('button,a'); if (!t) return;
    if (t.classList.contains('js-quiz')) K.goal('quiz_cta');
    if (t.dataset.tier != null) { S.tier = +t.dataset.tier; renderTiers(); renderHero(true); renderMenu(); renderTicker(); return; }
    if (t.dataset.meal != null) { S.meal = +t.dataset.meal; renderHero(true); return; }
    if (t.dataset.day != null) { S.day = +t.dataset.day; renderMenu(); return; }
    if (t.dataset.ration != null) { S.ration = +t.dataset.ration; renderPrice(); return; }
    if (t.dataset.plan != null) { S.plan = +t.dataset.plan; renderPrice(); return; }
    if (t.dataset.cell != null) {
      if (t.getAttribute('aria-disabled')) return;
      var ts = +t.dataset.cell, d = new Date(ts), k = dkey(d);
      if (S.frozen[k]) { delete S.frozen[k]; renderCal(); } else openFreeze(ts);
      return;
    }
    if (t.classList.contains('js-early')) { S.late = false; renderCal(); return; }
    if (t.classList.contains('js-late')) { S.late = true; renderCal(); return; }
    if (t.classList.contains('js-order')) { openOrder(PLANS[S.plan] === 'd3' ? 'test_drive' : 'subscription'); return; }
    if (t.classList.contains('js-mgr')) { openOrder('manager'); return; }
  });

  // hide the mobile dock while the footer or a modal is on screen
  var dock = $('.js-dock'), foot = $('.foot');
  if ('IntersectionObserver' in window && dock && foot) {
    new IntersectionObserver(function (es) { dock.classList.toggle('away', es[0].isIntersecting); }).observe(foot);
  }

  function renderAll() { renderTiers(); renderHero(false); renderTicker(); renderRations(); renderMenu(); renderPrice(); renderCal(); }
  K.onLang(renderAll);
  K.initLinks();
  K.applyLang();
})();
