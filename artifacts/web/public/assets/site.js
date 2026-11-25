/* kaloria.uz — landing page: section tabs, menu by meal, price calculator, order form. */
(function () {
  'use strict';
  var K = window.K;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  var IMG = { A: 'm1-breakfast', Y: 'm2-yogurt', C: 'm3-chicken', W: 'm4-bowl', S: 'm5-salmon' };
  var MENU = ['A', 'Y', 'C', 'W', 'S'];
  var TIMES = ['08:00', '11:00', '13:30', '16:30', '19:30'];
  // Sample day per tier (kcal per meal) and day totals — replace with the kitchen's real menu.
  var KC = [[280, 120, 380, 110, 310], [360, 170, 500, 160, 410], [480, 250, 680, 240, 550]];
  var TOT = [{ k: 1200, p: 90, f: 40, c: 120 }, { k: 1600, p: 110, f: 53, c: 172 }, { k: 2200, p: 150, f: 70, c: 245 }];
  var TIERS = ['1200', '1600', '2200'];
  var RATIONS = ['ozish', 'balans', 'sport'];
  var PLANS = ['d3', 'w1', 'w2', 'w3', 'w4', 'm1'];
  var SW = ['#2F8A50', '#E0A100', '#FF6A3D'];
  var TABS = ['rations', 'menu', 'price', 'how', 'faq'];
  // Hash names people can share: kaloria.uz/#narxlar
  var HASH = { rations: 'rasionlar', menu: 'menyu', price: 'narxlar', how: 'yetkazish', faq: 'savollar' };

  var S = { tab: 'rations', tier: 1, meal: 2, ration: 1, plan: 0 };

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
    var D = K.d(), share = KC[S.tier][i] / TOT[S.tier].k, T = TOT[S.tier];
    return { img: '/assets/img/' + IMG[code] + '.webp', name: D.dish[code], type: D.types[i], time: TIMES[i], kcal: KC[S.tier][i], p: Math.round(T.p * share), f: Math.round(T.f * share), c: Math.round(T.c * share) };
  }

  function renderRations() {
    var D = K.d();
    $('.js-rations').innerHTML = RATIONS.map(function (id, i) {
      var r = D.rations[id], T = TOT[i];
      return '<article class="card ration"><div class="top"><span class="sw" style="background:' + SW[i] + '"></span><span class="nm">' + r[0] + '</span></div>' +
        '<span class="rg">' + r[1] + ' <small>' + D.kcal + '</small></span>' +
        '<div class="macros"><span>' + D.P + ' <b>' + T.p + D.g + '</b></span><span>' + D.F + ' <b>' + T.f + D.g + '</b></span><span>' + D.C + ' <b>' + T.c + D.g + '</b></span></div>' +
        '<p>' + r[2] + '</p><a class="btn btn-soft btn-sm js-quiz" href="/hisoblash">' + D.choose + '</a></article>';
    }).join('');
  }

  function renderMenu() {
    var D = K.d(), meals = MENU.map(meal), m = meals[S.meal], T = TOT[S.tier];
    $('.js-tiers').innerHTML = TIERS.map(function (l, i) { return '<button type="button" data-tier="' + i + '" aria-pressed="' + (S.tier === i) + '">' + l + ' ' + D.kcal + '</button>'; }).join('');
    $('.js-mtabs').innerHTML = meals.map(function (x, i) {
      return '<button type="button" class="mtab" role="tab" data-meal="' + i + '" aria-selected="' + (S.meal === i) + '"><b>' + K.esc(x.type) + '</b><small>' + x.time + '</small></button>';
    }).join('');
    $('.js-dish').innerHTML = '<div class="pic"><img src="' + m.img + '" alt="' + K.esc(m.name) + '" width="720" height="540"></div>' +
      '<div class="bd"><span class="mt">' + K.esc(m.type) + ' · ' + m.time + '</span><span class="nm">' + K.esc(m.name) + '</span>' +
      '<span class="k"><b>' + m.kcal + '</b><span class="mt">' + D.kcal + '</span></span>' +
      '<div class="macros"><span>' + D.P + ' <b>' + m.p + D.g + '</b></span><span>' + D.F + ' <b>' + m.f + D.g + '</b></span><span>' + D.C + ' <b>' + m.c + D.g + '</b></span></div></div>';
    $('.js-daytot').innerHTML = '<span>' + D.dayTot + '</span><span><b>' + K.fmt(T.k) + ' ' + D.kcal + '</b> · ' + D.P1 + T.p + ' ' + D.F1 + T.f + ' ' + D.C1 + T.c + '</span>';
  }

  function renderPrice() {
    var D = K.d(), plan = PLANS[S.plan], ration = RATIONS[S.ration], pt = K.planTotal(ration, plan), now = new Date();
    $('.js-rseg').innerHTML = RATIONS.map(function (id, i) { return '<button type="button" data-ration="' + i + '" aria-pressed="' + (S.ration === i) + '">' + D.rations[id][0] + '</button>'; }).join('');
    $('.js-tiles').innerHTML = PLANS.map(function (p, i) {
      var disc = K.CFG.discounts[p] || 0;
      return '<button type="button" class="tile" data-plan="' + i + '" aria-pressed="' + (S.plan === i) + '"><b>' + D.plans[p] + '</b>' + (p === 'd3' ? '<span class="tag">' + D.testTag + '</span>' : '') +
        '<span class="ts">' + K.CFG.planDays[p] + ' ' + D.daysW + (disc ? ' · −' + disc + '%' : '') + '</span></button>';
    }).join('');
    $('.js-rc-date').textContent = K.fdate(now);
    $('.js-rc-ration').textContent = D.rations[ration][0] + ' ' + TIERS[S.ration];
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
    $('.js-sample').style.display = K.CFG.samplePrices ? '' : 'none';
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
  function openOrder(intent) {
    var D = K.d();
    orderCtx = { intent: intent, plan: PLANS[S.plan], planRation: RATIONS[S.ration] };
    $('.js-of-kicker').textContent = D.ofKick[intent];
    $('.js-of-title').textContent = D.ofTitle[intent];
    $('.js-of-fields').style.display = ''; $('.js-of-ok').style.display = 'none'; $('.js-of-err').textContent = '';
    var last = K.lastLead();
    if (last && !$('#ofName').value) { $('#ofName').value = last.name || ''; $('#ofPhone').value = K.phoneFmt(K.phoneDigits(last.phone)); }
    openModal($('.js-order-modal'));
    K.track('InitiateCheckout', { content_name: orderCtx.planRation + '_' + orderCtx.plan });
    K.goal('order_open_' + intent);
  }
  $('#ofPhone').addEventListener('input', function (e) { e.target.value = K.phoneFmt(K.phoneDigits(e.target.value)); });
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
    if (t.dataset.tab) { showTab(t.dataset.tab, true); return; }
    if (t.dataset.goto) { e.preventDefault(); showTab(t.dataset.goto, true); return; }
    if (t.dataset.tier != null) { S.tier = +t.dataset.tier; renderMenu(); return; }
    if (t.dataset.meal != null) { S.meal = +t.dataset.meal; renderMenu(); return; }
    if (t.dataset.ration != null) { S.ration = +t.dataset.ration; renderPrice(); return; }
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

  var dock = $('.js-dock'), foot = $('.foot');
  if ('IntersectionObserver' in window && dock && foot) {
    new IntersectionObserver(function (es) { dock.classList.toggle('away', es[0].isIntersecting); }).observe(foot);
  }

  function renderAll() {
    $$('.js-kcal-w').forEach(function (e) { e.textContent = K.d().kcal; });
    renderRations(); renderMenu(); renderPrice();
  }
  K.onLang(renderAll);
  K.initLinks();
  K.applyLang();
  var initial = tabFromHash();
  showTab(initial || 'rations', !!initial, true);
})();
