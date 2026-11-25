/* kaloria.uz — calorie quiz. The full result is open; name + phone are asked only to order or get the menu. */
(function () {
  'use strict';
  var K = window.K;
  var $ = function (s, r) { return (r || document).querySelector(s); };

  // Uzbek texts for the quiz (Russian ones live in i18n.js → K.RU).
  var UZ = {
    back: 'Orqaga', next: 'Davom etish', labelDef: 'Kaloriya yorlig‘i', intro: '5 ta savol, 30 soniya. Ilova yuklash shart emas.',
    s0k: '1 / 5 savol', s0: 'Jinsingiz', s1k: '2 / 5 savol', s1: 'Maqsadingiz qanday?', s2k: '3 / 5 savol', s2: 'Yosh, bo‘y va vazn',
    s3k: '4 / 5 savol', s3: 'Kuningiz qanchalik faol?', s4k: '5 / 5 savol', s4: 'Sizda qandli diabet, buyrak kasalligi yoki og‘ir oziq-ovqat allergiyasi bormi?',
    s4p: 'Taomlarimiz sog‘lom insonlar uchun. Javobingizga qarab sizga eng xavfsiz yo‘lni taklif qilamiz.',
    near: 'Sizning me’yoringiz {k} kkal — eng yaqin tayyor rasion {sku} kkal (farqi {d} kkal). Menejer kerak bo‘lsa porsiyani moslab beradi.',
    exact: 'Me’yoringiz rasionga to‘liq mos keladi.', result: 'Natija', q: 'Savol',
    s5k: 'Natija tayyor', s5: 'Kunlik me’yoringiz hisoblandi', gateHint: 'Oqsil, yog‘, uglevod, sizga mos menyu va narxni ko‘rish uchun ma’lumot qoldiring.', gateBtn: 'Menyu va narxni ko‘rish',
    name: 'Ismingiz', phone: 'Telefon raqamingiz', consent: 'Tugmani bosib, ma’lumotlarim qayta ishlanishiga rozilik beraman.', privacy: 'Maxfiylik siyosati',
    s6: 'Sizga mos rasion tayyor', match: 'Sizga mos rasion', from: 'Narx', payTest: '3 kunlik sinov — buyurtma', subs: '1 hafta – 1 oy obuna', mgr: 'Menejer bog‘lansin',
    riskNote: 'Siz sog‘lig‘ingiz bo‘yicha cheklov borligini belgiladingiz. Onlayn buyurtma o‘rniga menejer siz bilan bog‘lanadi va shifokoringiz tavsiyasini inobatga olgan holda maslahat beradi.',
    disc: 'Taomlar sog‘lom insonlar uchun mo‘ljallangan va tibbiy davo (qandli diabet, buyrak kasalliklari, og‘ir allergiya) o‘rnini bosmaydi.',
    contactH: 'Davom etamizmi?', contactHint: 'Ism va telefon faqat buyurtma berish yoki menyuni yuborish uchun kerak — natijani ko‘rish uchun shart emas.',
    sendMenu: 'Menyuni Telegram’ga yuborish', sendMenuSub: 'menejer bog‘lanadi',
    okMenu: 'Menejer tez orada Telegram yoki telefon orqali bog‘lanib, sizga mos menyuni yuboradi.',
    kcalDay: 'kkal / kun', empty: 'Javoblaringiz shu yerda yig‘iladi', okH: 'So‘rovingiz qabul qilindi!', okQ: 'Menejer tez orada qo‘ng‘iroq qilib buyurtmani tasdiqlaydi va Payme, Click yoki Uzum orqali to‘lov havolasini yuboradi.', home: 'Bosh sahifaga'
  };
  var NAME_PH = { uz: 'Masalan, Dilnoza', ru: 'Например, Анна' };
  var RUX = {
    near: 'Ваша норма {k} ккал — ближайший готовый рацион {sku} ккал (разница {d} ккал). При необходимости менеджер подберёт порции.',
    contactH: 'Продолжим?', contactHint: 'Имя и телефон нужны только чтобы оформить заказ или получить меню — результат виден и без них.',
    sendMenu: 'Отправить меню в Telegram', sendMenuSub: 'менеджер свяжется',
    okMenu: 'Менеджер скоро свяжется с вами в Telegram или по телефону и пришлёт подходящее меню.',
    exact: 'Ваша норма полностью совпадает с рационом.', okQ: 'Менеджер скоро позвонит, подтвердит заказ и пришлёт ссылку на оплату через Payme, Click или Uzum.', result: 'Результат', q: 'Вопрос'
  };
  function tr(k) { return K.lang === 'ru' ? (RUX[k] != null ? RUX[k] : K.RU[k] != null ? K.RU[k] : UZ[k]) : UZ[k]; }

  var ACT = [1.2, 1.375, 1.55, 1.725];
  var GOALS = ['ozish', 'saqlash', 'oshirish'];
  var LIM = { age: [16, 80], height: [140, 210], weight: [40, 180] };
  var S = { step: 0, gender: null, goal: null, age: 29, height: 165, weight: 72, act: null, risk: null, name: '', phone: '', lead: null, result: null, sending: false, err: '', done: null };

  // Same formula as @workspace/nutrition (and the mobile app); the server recomputes it.
  function calc() {
    var w = S.weight, h = S.height, a = S.age;
    var bmr = S.gender === 1 ? 10 * w + 6.25 * h - 5 * a + 5 : 10 * w + 6.25 * h - 5 * a - 161;
    var tdee = bmr * (S.act == null ? 1.375 : ACT[S.act]);
    var delta = (0.5 * 7700) / 7;
    var c = S.goal === 0 ? tdee - delta : S.goal === 2 ? tdee + delta : tdee;
    c = Math.max(c, w * 20); c = Math.round(c / 10) * 10;
    var p = Math.round(w * (S.goal === 0 ? 2.0 : 1.8)), f = Math.round((c * 0.25) / 9);
    return { bmr: Math.round(bmr), tdee: Math.round(tdee), calories: c, protein: p, fat: f, carbs: Math.max(Math.round((c - p * 4 - f * 9) / 4), 0) };
  }
  function match(k) {
    if (k < 1500) return { ration: 'ozish', sku: k < 1300 ? 1200 : 1400 };
    if (k < 2050) return { ration: 'balans', sku: k < 1750 ? 1600 : 1900 };
    return { ration: 'sport', sku: k < 2350 ? 2200 : 2500 };
  }
  function ready() { return S.gender != null && S.goal != null && S.step > 2 && S.act != null; }
  function canNext() { return S.step === 0 ? S.gender != null : S.step === 1 ? S.goal != null : S.step === 3 ? S.act != null : S.step === 4 ? S.risk != null : true; }

  var TICK = '<span class="tick" aria-hidden="true"><svg width="14" height="14"><use href="#i-check"/></svg></span>';
  function opt(group, i, on, inner, cls) { return '<button type="button" class="opt' + (cls ? ' ' + cls : '') + '" data-' + group + '="' + i + '" aria-pressed="' + on + '">' + inner + TICK + '</button>'; }
  function head(k, h, small) { return '<span class="kick">' + tr(k) + '</span><h1 class="qh' + (small ? ' s' : '') + '">' + tr(h) + '</h1>'; }

  function stepHtml() {
    var D = K.d(), r;
    switch (S.step) {
      case 0:
        return head('s0k', 's0') + '<div class="opts two">' + D.genders.map(function (g, i) {
          var icon = i === 0
            ? '<svg width="56" height="56" viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="24" r="16" fill="none" stroke="currentColor" stroke-width="4"/><path d="M32 40 V60 M23 51 H41" fill="none" stroke="#FF5B2E" stroke-width="4" stroke-linecap="round"/></svg>'
            : '<svg width="56" height="56" viewBox="0 0 64 64" aria-hidden="true"><circle cx="26" cy="38" r="16" fill="none" stroke="currentColor" stroke-width="4"/><path d="M37.5 26.5 L56 8 M44 8 H56 V20" fill="none" stroke="#FF5B2E" stroke-width="4" stroke-linecap="round"/></svg>';
          return opt('gender', i, S.gender === i, icon + '<span class="lbl-big">' + g + '</span>', 'tall');
        }).join('') + '</div><p style="margin:4px 0 0;font-size:14px;color:var(--muted2)">' + tr('intro') + '</p>';
      case 1:
        return head('s1k', 's1') + '<div class="opts g3">' + D.goals.map(function (g, i) {
          return opt('goal', i, S.goal === i, '<span class="sign">' + g[0] + '</span><span class="tx"><b>' + g[1] + '</b><span class="od">' + g[2] + '</span></span>');
        }).join('') + '</div>';
      case 2:
        return head('s2k', 's2') + '<div class="sls">' + ['age', 'height', 'weight'].map(function (k, i) {
          var lo = LIM[k][0], hi = LIM[k][1], pct = Math.round((S[k] - lo) / (hi - lo) * 100);
          return '<div class="sl"><div class="sl-top"><label for="q-' + k + '">' + D.sl[i] + '</label><span class="val"><b class="js-v-' + k + '">' + S[k] + '</b><span class="m" style="font-size:13px"> ' + D.units[i] + '</span></span></div>' +
            '<div class="sl-row"><button type="button" class="pm" data-dec="' + k + '" aria-label="−"><svg width="16" height="16"><use href="#i-minus"/></svg></button>' +
            '<input id="q-' + k + '" class="rng" type="range" min="' + lo + '" max="' + hi + '" value="' + S[k] + '" data-range="' + k + '" style="background:linear-gradient(90deg,#121512 ' + pct + '%,#E2E6DE 0)">' +
            '<button type="button" class="pm" data-inc="' + k + '" aria-label="+"><svg width="16" height="16"><use href="#i-plus"/></svg></button></div></div>';
        }).join('') + '</div>';
      case 3:
        return head('s3k', 's3') + '<div class="opts g2">' + D.acts.map(function (a, i) {
          var bars = [0, 1, 2, 3].map(function (j) { return '<i class="' + (j <= i ? 'on' : '') + '" style="height:' + (8 + j * 7) + 'px"></i>'; }).join('');
          return opt('act', i, S.act === i, '<span class="actb" aria-hidden="true">' + bars + '</span><span class="tx"><b>' + a[0] + '</b><span class="od">' + a[1] + '</span></span>');
        }).join('') + '</div>';
      case 4:
        return head('s4k', 's4', true) + '<p class="lead-p" style="font-size:15px">' + tr('s4p') + '</p><div class="opts g2">' + D.health.map(function (h, i) {
          return opt('risk', i, S.risk === i, '<span class="tx"><b>' + h[0] + '</b><span class="od">' + h[1] + '</span></span>');
        }).join('') + '</div>';
      case 5:
        r = S.result || calc();
        var m = S.result ? { ration: S.result.ration, sku: S.result.sku } : match(r.calories);
        var price = K.CFG.prices[m.ration], rn = D.rations[m.ration][0];
        var bars = [[D.P, r.protein, '#1E6B3A'], [D.F, r.fat, '#FF5B2E'], [D.C, r.carbs, '#121512']].map(function (b) {
          return '<div class="brow" style="grid-template-columns:96px minmax(0,1fr) 60px;font-size:14px"><b style="font-weight:600">' + b[0] + '</b><span class="bar" style="height:10px"><i style="width:' + Math.min(100, Math.round(b[1] / 300 * 100)) + '%;background:' + b[2] + '"></i></span><span class="m" style="text-align:right;font-weight:600">' + b[1] + ' ' + D.g + '</span></div>';
        }).join('');
        var risk = S.risk === 1
          ? '<div class="risk"><svg width="24" height="24"><use href="#i-warn"/></svg><span>' + tr('riskNote') + '</span></div>'
          : '<span style="font-size:12px;line-height:1.5;color:var(--muted2)">' + tr('disc') + '</span>';
        var thumbs = ['m1-breakfast', 'm2-yogurt', 'm3-chicken', 'm4-bowl', 'm5-salmon'].map(function (f) { return '<img src="/assets/img/' + f + '.webp" alt="" width="64" height="64">'; }).join('');
        return '<div class="result"><div style="display:flex;flex-direction:column;gap:14px">' +
          '<span class="kick">' + D.kick + (S.name ? ' · ' + K.esc(S.name) : '') + '</span><h1 class="qh s">' + tr('s6') + '</h1>' +
          '<div class="big-k" style="border-bottom:0;padding-bottom:0"><b>' + K.fmt(r.calories) + '</b><span class="m" style="font-size:14px">' + tr('kcalDay') + '</span></div>' +
          '<div class="bars" style="gap:12px">' + bars + '</div>' + risk + '</div>' +
          '<div style="display:flex;flex-direction:column;gap:16px;min-width:0"><div class="rec"><span class="mt">' + tr('match') + '</span><div class="row"><span class="nm">' + rn + '</span><span class="m" style="font-weight:600">' + m.sku + ' ' + D.kcal + '</span></div>' +
          '<div style="height:7px;background:var(--ink)"></div>' +
          '<span class="near">' + (Math.abs(r.calories - m.sku) <= 20 ? tr('exact') : tr('near').replace('{k}', K.fmt(r.calories)).replace('{sku}', m.sku).replace('{d}', Math.abs(r.calories - m.sku))) + '</span>' +
          '<div class="thumbs">' + thumbs + '</div>' +
          '<div class="row" style="border-top:1px solid var(--ink);padding-top:10px"><span style="font-size:14px">' + tr('from') + '</span><span><span class="d" style="font-size:24px;font-weight:800">' + K.fmt(price) + '</span><span class="m" style="font-size:12px"> ' + D.sumDay + '</span></span></div>' +
          '</div>' + contactHtml(m.ration) + '</div></div>';
    }
    return '';
  }

  // Optional contact card under the result: name + phone only when the visitor wants to order or get the menu.
  function contactHtml(ration) {
    var D = K.d();
    if (S.done) {
      return '<div class="rec ok-box" role="status"><span class="ok-ic"><svg width="24" height="24"><use href="#i-check"/></svg></span><b class="d" style="font-size:20px">' + tr('okH') + '</b>' +
        '<span style="font-size:14px;line-height:1.5;color:var(--muted)">' + tr(S.done === 'manager' ? 'okMenu' : 'okQ') + '</span><a class="btn btn-line btn-block" href="/">' + tr('home') + '</a></div>';
    }
    var testTotal = K.planTotal(ration, 'd3').total, dis = S.sending ? ' disabled' : '';
    var btns = S.risk === 1
      ? '<button type="submit" class="btn btn-hot btn-block" data-intent="manager"' + dis + '>' + tr('mgr') + '</button>'
      : '<button type="submit" class="btn btn-hot btn-block" data-intent="test_drive" style="justify-content:space-between"' + dis + '><span>' + tr('payTest') + '</span><span class="m" style="font-size:12px">' + K.fmt(testTotal) + ' ' + D.sum + '</span></button>' +
        '<button type="submit" class="btn btn-line btn-block" data-intent="manager"' + dis + '><span class="bl"><span>' + tr('sendMenu') + '</span><small>' + tr('sendMenuSub') + '</small></span></button>' +
        '<a class="btn btn-ink btn-block" href="/#price">' + tr('subs') + '</a>';
    return '<form class="rec js-contact" novalidate style="gap:12px"><b class="d" style="font-size:20px">' + tr('contactH') + '</b>' +
      '<span style="font-size:13px;line-height:1.45;color:var(--muted)">' + tr('contactHint') + '</span>' +
      '<div class="fld"><label for="gName">' + tr('name') + '</label><input id="gName" class="inp" name="name" autocomplete="given-name" maxlength="60" value="' + K.esc(S.name) + '" placeholder="' + NAME_PH[K.lang] + '"></div>' +
      '<div class="fld"><label for="gPhone">' + tr('phone') + '</label><div class="pfx"><span>+998</span><input id="gPhone" name="phone" inputmode="tel" autocomplete="tel-national" placeholder="90 123 45 67" value="' + K.phoneFmt(S.phone) + '"></div></div>' +
      '<input class="hp" name="website" tabindex="-1" autocomplete="off" aria-hidden="true">' +
      '<span class="err js-err" role="alert">' + K.esc(S.err) + '</span>' + btns +
      '<span class="consent">' + tr('consent') + ' <a href="/privacy">' + tr('privacy') + '</a></span></form>';
  }

  function actionsHtml() {
    if (S.step < 5) {
      return '<button type="button" class="btn btn-ink btn-block wide js-next"' + (canNext() ? '' : ' disabled') + '><span>' + tr('next') + '</span><svg width="18" height="18"><use href="#i-arrow"/></svg></button>';
    }
    return '';
  }

  function renderLabel() {
    var D = K.d(), r = calc(), rd = ready(), unlocked = S.step >= 5;
    var rows = [
      S.gender == null ? null : D.genders[S.gender],
      S.goal == null ? null : D.goals[S.goal][1],
      S.step >= 2 ? S.age + ' ' + D.units[0] : null,
      S.step >= 2 ? S.height + ' ' + D.units[1] : null,
      S.step >= 2 ? S.weight + ' ' + D.units[2] : null,
      S.act == null ? null : D.acts[S.act][0]
    ];
    $('.js-lrows').innerHTML = rows.map(function (v, i) { return '<div class="lrow"><span>' + D.rows[i] + '</span><span class="v' + (v ? '' : ' e') + '">' + (v ? K.esc(v) : '—') + '</span></div>'; }).join('');
    $('.js-l-title').textContent = unlocked && S.name ? S.name : tr('labelDef');
    $('.js-bmr').textContent = rd ? K.fmt(r.bmr) : '—';
    $('.js-tdee').textContent = rd ? K.fmt(r.tdee) : '—';
    $('.js-l-k').textContent = rd ? K.fmt(r.calories) : '—';
    var bju = $('.js-l-bju');
    bju.innerHTML = '<span>' + D.P1 + ' ' + (unlocked ? r.protein : '··') + D.g + '</span><span>' + D.F1 + ' ' + (unlocked ? r.fat : '··') + D.g + '</span><span>' + D.C1 + ' ' + (unlocked ? r.carbs : '··') + D.g + '</span>';
    bju.classList.toggle('blur', !unlocked);
    var strip = rows.filter(Boolean);
    $('.js-strip').textContent = strip.length ? strip.join(' · ') : tr('empty');
    $('.js-strip-k').textContent = rd ? K.fmt(r.calories) : '—';
    document.querySelectorAll('.js-kcal').forEach(function (e) { e.textContent = D.kcal; });
  }

  function render(focus) {
    $('.js-step').innerHTML = '<div class="qstep">' + stepHtml() + '</div>';
    $('.js-actions').innerHTML = actionsHtml();
    document.querySelectorAll('.js-prog i').forEach(function (el, i) { el.classList.toggle('on', i <= Math.min(S.step, 5)); });
    $('.js-steplbl').textContent = S.step < 5 ? tr('q') + ' ' + (S.step + 1) + ' / 5' : tr('result');
    var canBack = S.step > 0 && !S.done;
    document.querySelector('.qz-foot').style.display = S.step >= 5 ? 'none' : '';
    document.querySelector('.qz-main').style.paddingBottom = S.step >= 5 ? '40px' : '';
    $('.js-back').style.display = canBack ? '' : 'none';
    $('.js-home').style.display = canBack ? 'none' : '';
    $('.js-back2').style.visibility = canBack ? 'visible' : 'hidden';
    renderLabel();
    if (focus) { var h = $('.qh'); if (h) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); } window.scrollTo(0, 0); }
  }

  var seen = {};
  function go(step) {
    S.step = step; S.err = ''; render(true);
    if (!seen[step]) {
      seen[step] = 1;
      K.goal('quiz_step_' + (step + 1));
      if (step === 5) { K.goal('quiz_result'); K.track('ViewContent', { content_name: 'quiz_result', value: calc().calories }); }
    }
  }
  K.goal('quiz_step_1');

  // One request: a new lead with the quiz answers and the chosen intent, or an intent update for a known lead.
  function submitContact(intent) {
    var D = K.d(), nameEl = $('#gName'), phoneEl = $('#gPhone');
    S.name = (nameEl ? nameEl.value : S.name).trim().slice(0, 60);
    S.phone = K.phoneDigits(phoneEl ? phoneEl.value : S.phone);
    if (S.name.length < 2 || S.phone.length !== 9) { S.err = D.errContact; var e = $('.js-err'); if (e) e.textContent = S.err; if (nameEl && S.name.length < 2) nameEl.focus(); else if (phoneEl) phoneEl.focus(); return; }
    if (S.sending) return;
    S.sending = true; S.err = ''; render(false);
    var ration = S.result ? S.result.ration : match(calc().calories).ration;
    var plan = intent === 'test_drive' ? 'd3' : undefined;
    var a = K.attribution(), hp = document.querySelector('.js-contact input[name=website]');
    var req = S.lead
      ? K.post('/api/v1/leads/' + S.lead.id + '/intent', { key: S.lead.key, intent: intent, plan: plan, planRation: ration })
      : K.post('/api/v1/leads', {
          name: S.name, phone: S.phone, lang: K.lang, intent: intent, plan: plan, planRation: ration, website: hp ? hp.value : '',
          quiz: { gender: S.gender === 1 ? 'erkak' : 'ayol', goal: GOALS[S.goal], age: S.age, height: S.height, weight: S.weight, activity: ACT[S.act], healthRisk: S.risk === 1 },
          utm: a.utm, referrer: a.referrer, landingPath: a.landingPath
        });
    req.then(function (r) {
      S.sending = false;
      if (!r.ok) { S.err = (r.data && r.data.error) || D.errNet; render(false); return; }
      if (!S.lead && r.data.key) {
        S.lead = { id: r.data.id, key: r.data.key };
        if (r.data.result) S.result = r.data.result;
        K.saveLead({ id: r.data.id, key: r.data.key, name: S.name, phone: '+998' + S.phone });
        K.track('Lead', { content_name: 'quiz_' + intent, value: S.result ? S.result.calories : undefined });
        K.goal('quiz_lead');
      }
      S.done = intent;
      K.track(intent === 'test_drive' ? 'InitiateCheckout' : 'Contact', { content_name: intent });
      K.goal('quiz_intent_' + intent);
      render(false);
    }).catch(function () { S.sending = false; S.err = D.errNet; render(false); });
  }

  document.addEventListener('click', function (e) {
    var t = e.target.closest('button'); if (!t) return;
    var ds = t.dataset;
    if (ds.gender != null) { S.gender = +ds.gender; render(false); return; }
    if (ds.goal != null) { S.goal = +ds.goal; render(false); return; }
    if (ds.act != null) { S.act = +ds.act; render(false); return; }
    if (ds.risk != null) { S.risk = +ds.risk; render(false); return; }
    if (ds.dec || ds.inc) { var k = ds.dec || ds.inc; S[k] = Math.max(LIM[k][0], Math.min(LIM[k][1], S[k] + (ds.dec ? -1 : 1))); render(false); return; }
    if (t.classList.contains('js-next') && canNext()) { go(S.step + 1); return; }
    if (t.classList.contains('js-back') || t.classList.contains('js-back2')) { if (S.step > 0) go(S.step - 1); return; }
  });
  document.addEventListener('submit', function (e) {
    if (!e.target.classList.contains('js-contact')) return;
    e.preventDefault();
    var btn = e.submitter && e.submitter.dataset ? e.submitter.dataset.intent : null;
    submitContact(btn || (S.risk === 1 ? 'manager' : 'test_drive'));
  });
  document.addEventListener('input', function (e) {
    var t = e.target;
    if (t.dataset && t.dataset.range) {
      var k = t.dataset.range; S[k] = +t.value;
      var lo = LIM[k][0], hi = LIM[k][1];
      t.style.background = 'linear-gradient(90deg,#121512 ' + Math.round((S[k] - lo) / (hi - lo) * 100) + '%,#E2E6DE 0)';
      var v = $('.js-v-' + k); if (v) v.textContent = S[k];
      renderLabel();
    }
    if (t.id === 'gPhone') { S.phone = K.phoneDigits(t.value); t.value = K.phoneFmt(S.phone); }
    if (t.id === 'gName') S.name = t.value;
  });

  K.onLang(function () { render(false); });
  K.applyLang();
})();
