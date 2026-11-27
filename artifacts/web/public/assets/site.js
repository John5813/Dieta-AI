/* kaloria.uz — landing page: section tabs, menu by meal, price calculator, order form. */
(function () {
  'use strict';
  var K = window.K;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  var IMG = { A: 'm1-breakfast', Y: 'm2-yogurt', C: 'm3-chicken', W: 'm4-bowl', S: 'm5-salmon' };
  var MENU = ['A', 'Y', 'C', 'W', 'S'];
  var TIMES = ['08:00', '11:00', '13:30', '16:30', '19:30'];
  // Sample day for every calorie option (kcal per meal) and day totals — replace with the kitchen's real menu.
  // The options match the quiz recommendation and the CRM: Ozish 1200/1400, Balans 1600/1900, Sport 2200/2500.
  var KC = {
    1200: [280, 120, 380, 110, 310], 1400: [320, 140, 440, 130, 370], 1600: [360, 170, 500, 160, 410],
    1900: [430, 200, 590, 190, 490], 2200: [480, 250, 680, 240, 550], 2500: [550, 280, 770, 270, 630]
  };
  var TOT = {
    1200: { p: 90, f: 40, c: 120 }, 1400: { p: 100, f: 47, c: 146 }, 1600: { p: 110, f: 53, c: 172 },
    1900: { p: 130, f: 63, c: 205 }, 2200: { p: 150, f: 70, c: 245 }, 2500: { p: 170, f: 80, c: 280 }
  };
  var TIERS = [1200, 1400, 1600, 1900, 2200, 2500];
  var RATIONS = ['ozish', 'balans', 'sport'];
  var SKUS = K.SKUS;
  var PLANS = ['d3', 'w1', 'w2', 'w3', 'w4', 'm1'];
  var SW = ['#2F8A50', '#E0A100', '#FF6A3D'];
  var TABS = ['rations', 'menu', 'price', 'how', 'faq'];
  // Hash names people can share: kaloria.uz/#narxlar
  var HASH = { rations: 'rasionlar', menu: 'menyu', price: 'narxlar', how: 'yetkazish', faq: 'savollar' };

  // tier = kcal shown in the menu; ration + sku + plan = the price calculator and the order.
  var S = { tab: 'rations', tier: 1600, meal: 2, ration: 1, sku: 1600, plan: 0 };

  // ── section tabs ──
  function showTab(id, scroll, silent) {
    if (TABS.indexOf(id) < 0) id = 'rations';
    S.tab = id;
    TABS.forEach(function (t) {
      var b = $('#t-' + t), p = $('#p-' + t), on = t === id;
      b.setAttribute('aria-selected', String(on)); b.tabIndex = on ? 0 : -1; p.hidden = !on;
    });
    // Center the active pill inside the horizontally scrolling tab row without moving the page.
    var active = $('#t-' + id), row = $('.tabs');
    if (active && row) row.scrollTo({ left: active.offsetLeft - (row.clientWidth - active.offsetWidth) / 2, behavior: 'smooth' });
    if (scroll) {
      var bar = $('#bolimlar'), top = bar.getBoundingClientRect().top + window.pageYOffset - ($('.hdr').offsetHeight || 0);
      window.scrollTo({ top: top, behavior: 'smooth' });
    }
    if (silent) return;
    if (history.replaceState) history.replaceState(null, '', '#' + HASH[id]);
    K.goal('tab_' + id);
  }
  function tabFromHash() {
    var h = (location.hash || '').slice(1);
    for (var k in HASH) if (HASH[k] === h || k === h) return k;
    return null;
  }

  function meal(code, i) {
    var D = K.d(), share = KC[S.tier][i] / S.tier, T = TOT[S.tier];
    return { img: '/assets/img/' + IMG[code] + '.webp', name: D.dish[code], type: D.types[i], time: TIMES[i], kcal: KC[S.tier][i], p: Math.round(T.p * share), f: Math.round(T.f * share), c: Math.round(T.c * share) };
  }

  function renderRations() {
    var D = K.d();
    $('.js-rations').innerHTML = RATIONS.map(function (id, i) {
      var r = D.rations[id], T = TOT[SKUS[id][0]];
      return '<article class="card ration"><div class="top"><span class="sw" style="background:' + SW[i] + '"></span><span class="nm">' + r[0] + '</span></div>' +
        '<span class="rg">' + r[1] + ' <small>' + D.kcal + '</small></span>' +
        '<div class="macros"><span>' + D.P + ' <b>' + T.p + D.g + '</b></span><span>' + D.F + ' <b>' + T.f + D.g + '</b></span><span>' + D.C + ' <b>' + T.c + D.g + '</b></span></div>' +
        '<p>' + r[2] + '</p><a class="btn btn-soft btn-sm js-quiz" href="/hisoblash">' + D.choose + '</a></article>';
    }).join('');
  }

  function renderMenu() {
    var D = K.d(), meals = MENU.map(meal), m = meals[S.meal], T = TOT[S.tier];
    $('.js-tiers').innerHTML = TIERS.map(function (k) { return '<button type="button" data-tier="' + k + '" aria-pressed="' + (S.tier === k) + '">' + k + '<small> ' + D.kcal + '</small></button>'; }).join('');
    $('.js-mtabs').innerHTML = meals.map(function (x, i) {
      return '<button type="button" class="mtab" role="tab" data-meal="' + i + '" aria-selected="' + (S.meal === i) + '"><b>' + K.esc(x.type) + '</b><small>' + x.time + '</small></button>';
    }).join('');
    $('.js-dish').innerHTML = '<div class="pic"><img src="' + m.img + '" alt="' + K.esc(m.name) + '" width="720" height="540"></div>' +
      '<div class="bd"><span class="mt">' + K.esc(m.type) + ' · ' + m.time + '</span><span class="nm">' + K.esc(m.name) + '</span>' +
      '<span class="k"><b>' + m.kcal + '</b><span class="mt">' + D.kcal + '</span></span>' +
      '<div class="macros"><span>' + D.P + ' <b>' + m.p + D.g + '</b></span><span>' + D.F + ' <b>' + m.f + D.g + '</b></span><span>' + D.C + ' <b>' + m.c + D.g + '</b></span></div></div>';
    $('.js-daytot').innerHTML = '<span>' + D.dayTot + '</span><span><b>' + K.fmt(S.tier) + ' ' + D.kcal + '</b> · ' + D.P1 + T.p + ' ' + D.F1 + T.f + ' ' + D.C1 + T.c + '</span>';
  }

  function renderPrice() {
    var D = K.d(), plan = PLANS[S.plan], ration = RATIONS[S.ration], pt = K.planTotal(ration, plan), now = new Date();
    $('.js-rseg').innerHTML = RATIONS.map(function (id, i) { return '<button type="button" data-ration="' + i + '" aria-pressed="' + (S.ration === i) + '">' + D.rations[id][0] + '</button>'; }).join('');
    $('.js-kseg').innerHTML = SKUS[ration].map(function (k) { return '<button type="button" data-psku="' + k + '" aria-pressed="' + (S.sku === k) + '">' + k + ' ' + D.kcal + '</button>'; }).join('');
    $('.js-tiles').innerHTML = PLANS.map(function (p, i) {
      var disc = K.CFG.discounts[p] || 0;
      return '<button type="button" class="tile" data-plan="' + i + '" aria-pressed="' + (S.plan === i) + '"><b>' + D.plans[p] + '</b>' + (p === 'd3' ? '<span class="tag">' + D.testTag + '</span>' : '') +
        '<span class="ts">' + K.CFG.planDays[p] + ' ' + D.daysW + (disc ? ' · −' + disc + '%' : '') + '</span></button>';
    }).join('');
    $('.js-rc-date').textContent = K.fdate(now);
    $('.js-rc-ration').textContent = D.rations[ration][0] + ' · ' + S.sku + ' ' + D.kcal;
    $('.js-rc-term').textContent = D.plans[plan];
    $('.js-rc-days').textContent = pt.days + ' ' + D.daysW;
    $('.js-rc-price').textContent = K.fmt(pt.price) + ' ' + D.sum;
    $('.js-rc-disc').textContent = pt.disc ? '−' + pt.disc + '% (' + K.fmt(pt.gross - pt.total) + ')' : '—';
    $('.js-rc-total').textContent = K.fmt(pt.total);
    $$('.js-sum').forEach(function (e) { e.textContent = ' ' + D.sum; });
    $('.js-rc-perday').textContent = '≈ ' + K.fmt(pt.total / pt.days) + ' ' + D.sum + ' / ' + D.perDay;
    var test = plan === 'd3';
    $('.js-mgr').style.display = test ? 'none' : '';
    $('.js-test-note').style.display = test ? '' : 'none';
  }

  // ── order modal ──
  var lastFocus = null;
  function openModal(m) {
    lastFocus = document.activeElement;
    m.classList.add('open'); m.setAttribute('aria-hidden', 'false'); document.body.classList.add('noscroll');
    var f = m.querySelector('input:not(.hp)'); if (f) setTimeout(function () { f.focus(); }, 50);
  }
  function closeModal(m) {
    m.classList.remove('open'); m.setAttribute('aria-hidden', 'true'); document.body.classList.remove('noscroll');
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') $$('.modal.open').forEach(closeModal); });
  $$('.modal').forEach(function (m) { m.addEventListener('click', function (e) { if (e.target.closest('.js-close')) closeModal(m); }); });

  var orderCtx = { intent: 'test_drive' };
  // Texts that depend on the request type and the current selection (also re-run on language change).
  function orderTexts() {
    var D = K.d(), intent = orderCtx.intent, pt = K.planTotal(orderCtx.planRation, orderCtx.plan);
    $('.js-of-kicker').textContent = D.ofKick[intent];
    $('.js-of-title').textContent = D.ofTitle[intent];
    $('.js-of-submit').textContent = D.ofSend[intent];
    var sum = $('.js-of-sum'); sum.textContent = '';
    var row = function (a, b, cls) { var d = document.createElement('div'); d.className = cls || 'r'; var x = document.createElement('span'); x.textContent = a; var y = document.createElement('b'); y.textContent = b; d.appendChild(x); d.appendChild(y); sum.appendChild(d); };
    row(D.ofChoice, D.rations[orderCtx.planRation][0] + ' · ' + orderCtx.planSku + ' ' + D.kcal);
    row(D.plans[orderCtx.plan], pt.days + ' ' + D.daysW + (pt.disc ? ' · −' + pt.disc + '%' : ''));
    row(D.ofTotal, K.fmt(pt.total) + ' ' + D.sum, 'r tot');
  }
  function openOrder(intent) {
    orderCtx = { intent: intent, plan: PLANS[S.plan], planRation: RATIONS[S.ration], planSku: S.sku };
    orderTexts();
    $('.js-of-fields').style.display = ''; $('.js-of-ok').style.display = 'none'; $('.js-of-err').textContent = '';
    var last = K.lastLead();
    if (last && !$('#ofName').value) { $('#ofName').value = last.name || ''; $('#ofPhone').value = K.phoneFmt(K.phoneDigits(last.phone)); }
    openModal($('.js-order-modal'));
    K.track('InitiateCheckout', { content_name: orderCtx.planRation + '_' + orderCtx.plan });
    K.goal('order_open_' + intent);
  }
  $('#ofPhone').addEventListener('input', function (e) { e.target.value = K.phoneFmt(K.phoneDigits(e.target.value)); });
  // We deliver only inside Tashkent: say so as soon as "Other / region" is picked.
  $('#ofDistrict').addEventListener('change', function (e) { $('.js-other-note').hidden = e.target.value !== 'other'; });
  $('.js-order-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var D = K.d(), f = e.target, name = f.name.value.trim(), digits = K.phoneDigits(f.phone.value), btn = $('.js-of-submit');
    var district = f.district.value, address = f.address.value.trim().slice(0, 200), note = f.note.value.trim().slice(0, 500);
    var slot = (f.querySelector('input[name=deliverySlot]:checked') || {}).value || 'morning';
    if (name.length < 2 || digits.length !== 9) { $('.js-of-err').textContent = D.errContact; return; }
    btn.disabled = true; $('.js-of-err').textContent = '';
    var a = K.attribution(), last = K.lastLead();
    var req = last && last.phone === '+998' + digits
      ? K.post('/api/v1/leads/' + last.id + '/intent', { key: last.key, intent: orderCtx.intent, plan: orderCtx.plan, planRation: orderCtx.planRation, planSku: orderCtx.planSku, district: district, address: address, note: note, deliverySlot: slot })
      : K.post('/api/v1/leads', { name: name, phone: digits, lang: K.lang, intent: orderCtx.intent, plan: orderCtx.plan, planRation: orderCtx.planRation, planSku: orderCtx.planSku, district: district, address: address, note: note, deliverySlot: slot, website: f.website.value, utm: a.utm, referrer: a.referrer, landingPath: a.landingPath });
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
    if (t.dataset.tab) { showTab(t.dataset.tab, true); return; }
    if (t.dataset.goto) { e.preventDefault(); showTab(t.dataset.goto, true); return; }
    if (t.dataset.tier != null) { S.tier = +t.dataset.tier; renderMenu(); return; }
    if (t.dataset.psku != null) { S.sku = +t.dataset.psku; renderPrice(); return; }
    if (t.dataset.meal != null) { S.meal = +t.dataset.meal; renderMenu(); return; }
    if (t.dataset.ration != null) { S.ration = +t.dataset.ration; S.sku = SKUS[RATIONS[S.ration]][0]; renderPrice(); return; }
    if (t.dataset.plan != null) { S.plan = +t.dataset.plan; renderPrice(); return; }
    if (t.classList.contains('js-order')) { openOrder(PLANS[S.plan] === 'd3' ? 'test_drive' : 'subscription'); return; }
    if (t.classList.contains('js-mgr')) { openOrder('manager'); return; }
  });
  // arrow keys move between tabs (WAI-ARIA tabs pattern)
  $('.tabs').addEventListener('keydown', function (e) {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    var i = TABS.indexOf(S.tab) + (e.key === 'ArrowRight' ? 1 : -1);
    i = (i + TABS.length) % TABS.length; showTab(TABS[i], false); $('#t-' + TABS[i]).focus();
  });
  window.addEventListener('hashchange', function () { var t = tabFromHash(); if (t && t !== S.tab) showTab(t, true); });

  // The sticky bottom CTA only appears when no other "calculate" button is on screen:
  // hidden while the hero buttons, the final CTA band or the footer are visible.
  var dock = $('.js-dock');
  if (dock) {
    var watched = $$('.hero-ctas, .final, .foot'), visible = {};
    if ('IntersectionObserver' in window && watched.length) {
      dock.classList.add('away');
      var io = new IntersectionObserver(function (es) {
        es.forEach(function (e) { visible[watched.indexOf(e.target)] = e.isIntersecting; });
        dock.classList.toggle('away', Object.keys(visible).some(function (k) { return visible[k]; }));
      });
      watched.forEach(function (el) { io.observe(el); });
    }
  }

  function renderAll() {
    $$('.js-kcal-w').forEach(function (e) { e.textContent = K.d().kcal; });
    renderRations(); renderMenu(); renderPrice();
    if ($('.js-order-modal').classList.contains('open')) orderTexts();
  }
  K.onLang(renderAll);
  K.initLinks();
  K.applyLang();
  // /?plan=sport&kcal=2500&slot=evening#narxlar (from the quiz result) preselects the ration, its calories,
  // the 1-week plan and the delivery time in the price calculator and the order form.
  var qs = new URLSearchParams(location.search), pi = RATIONS.indexOf(qs.get('plan'));
  if (pi >= 0) {
    var kc = +qs.get('kcal');
    S.ration = pi; S.sku = SKUS[RATIONS[pi]].indexOf(kc) >= 0 ? kc : SKUS[RATIONS[pi]][0]; S.tier = S.sku;
    S.plan = PLANS.indexOf('w1'); renderPrice(); renderMenu();
  }
  var slotIn = document.querySelector('.js-order-form input[name=deliverySlot][value="' + (qs.get('slot') === 'evening' ? 'evening' : 'morning') + '"]');
  if (slotIn) slotIn.checked = true;
  var initial = tabFromHash();
  showTab(initial || 'rations', !!initial, true);
})();
