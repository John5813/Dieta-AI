/* kaloria.uz — shared helpers: language, texts, UTM, API, formatting. */
(function () {
  'use strict';

  // Russian texts for [data-i18n] elements. Uzbek is the HTML itself, captured on load.
  var RU = {
    nav0: 'Рационы', nav1: 'Меню', nav2: 'Цены', nav3: 'Заморозка', nav4: 'Вопросы',
    ctaShort: 'Рассчитать', ctaCalc: 'Рассчитать мои калории', sec30: '30 секунд', ctaTest: 'Пробные 3 дня',
    eyebrow: 'По всему Ташкенту · Пн–Сб, каждое утро',
    h1a: 'Еда готова.', h1b: 'Калории', h1c: 'посчитаны.',
    sub: '5 приёмов пищи, взвешенных до грамма, — на каждом контейнере этикетка с ккал и БЖУ. Вы просто едите, считаем мы.',
    f1: 'приёмов пищи каждый день', f2: 'до этого — бесплатная заморозка', f3b: 'Вс', f3: 'воскресенье — выходной',
    boxTitle: 'Бокс на сегодня', boxSub: 'Выберите калорийность', total: 'Итого за день',
    k1: '01 — Рационы', rationsH: 'Три рациона под вашу цель', rationsSub: 'Калькулятор сам подберёт подходящую калорийность — ломать голову не нужно.',
    k2: '02 — Меню', menuH: 'Меню на один день', menuSub: 'Каждый день новые блюда. В воскресенье отдыхаем.',
    k3: '03 — Распорядок', dayH: 'Вечером заказ фиксируется — утром он у вашей двери',
    st1h: 'Заказ фиксируется', st1p: 'До этого времени можно заморозить завтрашний день или сменить адрес.',
    st2h: 'Кухня готовит', st2p: 'Кухня-партнёр взвешивает каждую порцию и клеит этикетку.',
    st3h: 'К вашей двери', st3p: 'Курьер привозит бокс на весь день в термосумке.',
    sun1: 'Воскресенье', sun2: 'выходной',
    k4: '04 — Цены', priceH: 'Выберите срок — чек посчитается сразу', rLabel: 'Рацион', dLabel: 'Срок',
    sundayNote: 'В воскресенье доставки нет, поэтому 1 неделя = 6 дней доставки. Замороженные дни переносятся в конец подписки.',
    rcTitle: 'KALORIA.UZ · ЧЕК', rcRation: 'Рацион', rcTerm: 'Срок', rcDays: 'Дней доставки', rcPrice: 'Цена за день', rcDisc: 'Скидка', rcTotal: 'ИТОГО',
    order: 'Оформить заказ', mgr: 'Связаться с менеджером', testNote: 'Пробный бокс — только онлайн-оплата', sample: '* Примерные цены',
    rcThanks: '*** Спасибо! Приятного аппетита ***',
    k5: '05 — Заморозка', freezeH: 'Планы изменились? Заморозьте день.',
    r1: 'Заморозка бесплатна и без условий — сколько угодно дней.',
    r2: 'Завтрашний день можно заморозить до 18:00. После 18:00 заказ на завтра фиксируется.',
    r3: 'Замороженный день не пропадает — он переносится в конец подписки.',
    r4: 'Замороженный день нужно использовать в течение 1 месяца. Через месяц он сгорает.',
    calHint: 'Нажмите на день, чтобы заморозить', tryTime: 'Сейчас:',
    lgFrz: 'Заморожен', lgLock: 'Зафиксирован', lgSun: 'Выходной', lgToday: 'Сегодня', frozenN: 'Замороженные дни', burnFirst: 'Использовать до',
    kitchenTag: 'Временное фото', k6: '06 — Доверие', trustH: 'Кто готовит еду и кто её проверяет?',
    tr1h: 'Кухня-партнёр', tr1p: 'Профессиональная кухня, соответствующая санитарным требованиям.', tr1x: '[название кухни, документы]',
    tr2h: 'Меню составляет диетолог', tr2p: 'Каждый рацион сбалансирован по калориям и БЖУ.', tr2x: '[имя и фото диетолога]',
    tr3h: 'Этикетка на каждом контейнере', tr3p: 'Дата приготовления, срок хранения, ккал и БЖУ.',
    warnT: 'ВНИМАНИЕ', warn: 'Блюда предназначены для здоровых людей и не заменяют лечебное питание (сахарный диабет, болезни почек, тяжёлая аллергия). В таких случаях сначала проконсультируйтесь с врачом.',
    k7: '07 — Вопросы', faqH: 'Частые вопросы', faqAsk: 'Спросить в Telegram',
    q1: 'Когда и как доставляется еда?', a1: 'С понедельника по субботу каждое утро с 06:00 до 09:00 привозим бокс на весь день в термосумке. Воскресенье — выходной.',
    q2: 'Как заморозить день?', a2: 'Через менеджера или Telegram-бот, для завтрашнего дня — до 18:00. Заморозка бесплатна, день переносится в конец подписки и должен быть использован в течение 1 месяца — потом сгорает.',
    q3: 'Можно сменить адрес?', a3: 'Да. Адрес завтрашней доставки можно сменить до 18:00.',
    q4: 'Какой рацион мне подходит?', a4: 'Пройдите калькулятор: по полу, возрасту, росту, весу и активности посчитаем вашу норму калорий и покажем подходящий рацион.',
    q5: 'Как оплатить?', a5: 'Через Payme, Click или Uzum. После заказа менеджер пришлёт ссылку на оплату. По подпискам от 1 недели можно договориться с менеджером.',
    finalH: 'Узнайте свою норму калорий за 30 секунд', finalP: 'Приложение скачивать не нужно. Вместе с результатом покажем подходящий рацион и цену.',
    footTag: 'Доставка диетического питания с точно рассчитанной калорийностью по Ташкенту.', offer: 'Публичная оферта', privacy: 'Политика конфиденциальности',
    name: 'Ваше имя', phone: 'Номер телефона', consent: 'Нажимая кнопку, я соглашаюсь на обработку моих данных.', send: 'Отправить',
    okH: 'Заявка принята!', okP: 'Менеджер скоро свяжется с вами и пришлёт ссылку на оплату.', close: 'Закрыть',
    shDate: 'Замораживаемый день', terms: 'Условия заморозки', shAdded: 'Добавится к подписке', plus1: '+1 день', shBurn: 'Использовать до', shAgree: 'Я ознакомлен(а) с условиями', shOk: 'Заморозить',
    // quiz page
    back: 'Назад', next: 'Далее', yourLabel: 'ВАША ЭТИКЕТКА', labelDef: 'Этикетка калорий', labelSub: 'Заполняется по мере ответов', daily: 'Норма в день',
    formula: 'Расчёт по формуле Миффлина–Сан Жеора — тот же алгоритм, что и в нашем приложении. Результат не является медицинским диагнозом.',
    intro: '5 вопросов, 30 секунд. Скачивать приложение не нужно.',
    s0k: 'Вопрос 1 / 5', s0: 'Ваш пол', s1k: 'Вопрос 2 / 5', s1: 'Какая у вас цель?', s2k: 'Вопрос 3 / 5', s2: 'Возраст, рост и вес',
    s3k: 'Вопрос 4 / 5', s3: 'Насколько активен ваш день?', s4k: 'Вопрос 5 / 5', s4: 'Есть ли у вас сахарный диабет, болезни почек или тяжёлая пищевая аллергия?',
    s4p: 'Наша еда для здоровых людей. По вашему ответу предложим самый безопасный вариант.',
    s5k: 'Результат готов', s5: 'Ваша дневная норма рассчитана', gateHint: 'Оставьте контакты, чтобы увидеть БЖУ, подходящее меню и цену.', gateBtn: 'Показать меню и цену',
    s6: 'Подходящий рацион готов', match: 'Ваш рацион', from: 'Цена', payTest: 'Пробные 3 дня — заказать', subs: 'Подписка от 1 недели до 1 месяца',
    riskNote: 'Вы отметили ограничения по здоровью. Вместо онлайн-заказа с вами свяжется менеджер и проконсультирует с учётом рекомендаций врача.',
    disc: 'Блюда предназначены для здоровых людей и не заменяют лечебное питание (сахарный диабет, болезни почек, тяжёлая аллергия).',
    kcalDay: 'ккал / день', home: 'На главную', empty: 'Здесь соберутся ваши ответы',
    offerTitle: 'Публичная оферта'
  };

  var DATA = {
    uz: {
      kcal: 'kkal', g: 'g', sum: 'so‘m', P: 'Oqsil', F: 'Yog‘', C: 'Uglevod', P1: 'B', F1: 'Y', C1: 'U',
      types: ['Nonushta', 'Perekus', 'Tushlik', 'Perekus', 'Kechki ovqat'],
      dish: { A: 'Avokado-tost va tuxum', Y: 'Yunon yogurti, qulupnay', C: 'Grilda tovuq, sabzavotlar', W: 'Tofu va guruch bouli', S: 'Losos, kinoa, yashil loviya', L: 'Mol go‘shtli iliq salat', V: 'No‘xat va avokado bouli' },
      tick: 'ERTANGI MENYU', meals5: '5 MAHAL',
      rations: { ozish: ['Ozish', '1200–1400', 'Kaloriya defitsiti bilan vazn kamaytirish uchun'], balans: ['Balans', '1600–1900', 'Vaznni ushlab turish va tartibli ovqatlanish uchun'], sport: ['Sport', '2200+', 'Mashg‘ulot qiladiganlar va mushak massasi uchun'] },
      rationMeta: '5 mahal · 1 kunlik qiymat', kcalWord: 'Kaloriya', choose: 'Menga mosini hisoblash',
      dows: ['Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh', 'Ya'], off: 'dam',
      plans: { d3: '3 kun', w1: '1 hafta', w2: '2 hafta', w3: '3 hafta', w4: '4 hafta', m1: '1 oy' }, testTag: 'Sinov', daysW: 'kun', perDay: 'kun',
      months: ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr'],
      monthsN: ['Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun', 'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr'],
      until: 'gacha',
      ofKick: { test_drive: '3 kunlik sinov', subscription: 'Obuna', manager: 'Menejer' },
      ofTitle: { test_drive: 'Sinov boksini buyurtma qilish', subscription: 'Obunani rasmiylashtirish', manager: 'Menejer qo‘ng‘iroq qiladi' },
      errContact: 'Ism va telefon raqamini to‘g‘ri kiriting', errNet: 'Internet bilan bog‘lanib bo‘lmadi. Qaytadan urinib ko‘ring.',
      genders: ['Ayol', 'Erkak'],
      goals: [['−', 'Ozish', 'Ortiqcha vazndan xalos bo‘lish'], ['=', 'Vaznni saqlash', 'To‘g‘ri va tartibli ovqatlanish'], ['+', 'Massa olish', 'Mashg‘ulot va mushak uchun']],
      sl: ['Yosh', 'Bo‘y', 'Vazn'], units: ['yosh', 'sm', 'kg'],
      acts: [['Kam harakat', 'Ofis ishi, deyarli sport yo‘q'], ['Yengil faol', 'Haftada 1–3 marta mashg‘ulot'], ['O‘rtacha faol', 'Haftada 3–5 marta mashg‘ulot'], ['Juda faol', 'Har kuni sport yoki jismoniy ish']],
      health: [['Yo‘q', 'Sog‘lig‘im bo‘yicha cheklov yo‘q'], ['Ha, bor', 'Menejer siz bilan alohida gaplashadi']],
      rows: ['Jins', 'Maqsad', 'Yosh', 'Bo‘y', 'Vazn', 'Faollik'], kick: 'Natija', sumDay: 'so‘m / kun'
    },
    ru: {
      kcal: 'ккал', g: 'г', sum: 'сум', P: 'Белки', F: 'Жиры', C: 'Углеводы', P1: 'Б', F1: 'Ж', C1: 'У',
      types: ['Завтрак', 'Перекус', 'Обед', 'Перекус', 'Ужин'],
      dish: { A: 'Тост с авокадо и яйцом', Y: 'Греческий йогурт с клубникой', C: 'Курица гриль с овощами', W: 'Боул с тофу и рисом', S: 'Лосось, киноа, стручковая фасоль', L: 'Тёплый салат с говядиной', V: 'Боул с нутом и авокадо' },
      tick: 'МЕНЮ НА ЗАВТРА', meals5: '5 ПРИЁМОВ',
      rations: { ozish: ['Похудение', '1200–1400', 'Для снижения веса с дефицитом калорий'], balans: ['Баланс', '1600–1900', 'Для поддержания веса и режима питания'], sport: ['Спорт', '2200+', 'Для тренирующихся и набора мышечной массы'] },
      rationMeta: '5 приёмов · значения за день', kcalWord: 'Калории', choose: 'Рассчитать подходящий',
      dows: ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'], off: 'вых',
      plans: { d3: '3 дня', w1: '1 неделя', w2: '2 недели', w3: '3 недели', w4: '4 недели', m1: '1 месяц' }, testTag: 'Тест', daysW: 'дн.', perDay: 'день',
      months: ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'],
      monthsN: ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'],
      until: '',
      ofKick: { test_drive: 'Пробные 3 дня', subscription: 'Подписка', manager: 'Менеджер' },
      ofTitle: { test_drive: 'Заказать пробный бокс', subscription: 'Оформить подписку', manager: 'Менеджер перезвонит' },
      errContact: 'Введите имя и номер телефона правильно', errNet: 'Нет связи с интернетом. Попробуйте ещё раз.',
      genders: ['Женщина', 'Мужчина'],
      goals: [['−', 'Похудеть', 'Избавиться от лишнего веса'], ['=', 'Держать вес', 'Правильный режим питания'], ['+', 'Набрать массу', 'Для тренировок и мышц']],
      sl: ['Возраст', 'Рост', 'Вес'], units: ['лет', 'см', 'кг'],
      acts: [['Минимум движения', 'Офис, почти без спорта'], ['Лёгкая активность', '1–3 тренировки в неделю'], ['Средняя активность', '3–5 тренировок в неделю'], ['Высокая активность', 'Спорт каждый день или физический труд']],
      health: [['Нет', 'Ограничений по здоровью нет'], ['Да, есть', 'Менеджер свяжется с вами отдельно']],
      rows: ['Пол', 'Цель', 'Возраст', 'Рост', 'Вес', 'Активность'], kick: 'Результат', sumDay: 'сум / день'
    }
  };

  var CFG = window.KALORIA || {};
  CFG.prices = CFG.prices || { ozish: 159000, balans: 179000, sport: 209000 };
  CFG.discounts = CFG.discounts || { d3: 0, w1: 0, w2: 3, w3: 5, w4: 7, m1: 10 };
  CFG.planDays = CFG.planDays || { d3: 3, w1: 6, w2: 12, w3: 18, w4: 24, m1: 26 };
  CFG.telegram = CFG.telegram || 'https://t.me/';

  function store(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } return null; }

  // ── language ──
  var listeners = [];
  var lang = (function () {
    var q = new URLSearchParams(location.search).get('lang');
    if (q === 'ru' || q === 'uz') return q;
    var s = store('k_lang');
    if (s === 'ru' || s === 'uz') return s;
    return 'uz';
  })();
  var nodes = null;
  function capture() {
    nodes = Array.prototype.map.call(document.querySelectorAll('[data-i18n]'), function (el) { return { el: el, key: el.getAttribute('data-i18n'), uz: el.innerHTML }; });
  }
  function applyLang() {
    if (!nodes) capture();
    document.documentElement.lang = lang;
    nodes.forEach(function (n) { var v = lang === 'ru' ? RU[n.key] : n.uz; if (v != null && n.el.innerHTML !== v) n.el.innerHTML = v; });
    document.querySelectorAll('[data-lang]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-lang') === lang)); });
    listeners.forEach(function (fn) { fn(lang); });
  }
  function setLang(l) { lang = l; store('k_lang', l); applyLang(); }

  // ── UTM / attribution (first touch, kept 30 days) ──
  (function () {
    var p = new URLSearchParams(location.search);
    var utm = {};
    ['source', 'medium', 'campaign', 'content', 'term'].forEach(function (k) { var v = p.get('utm_' + k); if (v) utm[k] = v.slice(0, 200); });
    if (!utm.source && p.get('fbclid')) utm.source = 'facebook';
    if (!utm.source && p.get('ttclid')) utm.source = 'tiktok';
    var prev = null;
    try { prev = JSON.parse(store('k_attr') || 'null'); } catch (e) { prev = null; }
    var fresh = prev && prev.t > Date.now() - 30 * 864e5;
    if (Object.keys(utm).length || !fresh) {
      store('k_attr', JSON.stringify({ utm: Object.keys(utm).length ? utm : (fresh ? prev.utm : {}), referrer: document.referrer ? document.referrer.slice(0, 300) : (fresh ? prev.referrer : ''), landingPath: (location.pathname + location.search).slice(0, 300), t: Date.now() }));
    }
  })();
  function attribution() {
    try { var a = JSON.parse(store('k_attr') || 'null'); if (a) return { utm: a.utm || {}, referrer: a.referrer || '', landingPath: a.landingPath || '' }; } catch (e) {}
    return { utm: {}, referrer: '', landingPath: location.pathname };
  }

  function track(ev, params) {
    try { if (window.fbq) window.fbq('track', ev, params || {}); } catch (e) {}
    try { if (window.ttq) window.ttq.track(ev === 'Lead' ? 'SubmitForm' : ev === 'InitiateCheckout' ? 'InitiateCheckout' : ev, params || {}); } catch (e) {}
  }

  function post(url, body) {
    return fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { return { ok: r.ok, status: r.status, data: j }; }); });
  }

  function fmt(n) { return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' '); }
  function phoneDigits(v) { var d = String(v || '').replace(/\D/g, ''); if (d.length > 9 && d.indexOf('998') === 0) d = d.slice(3); return d.slice(0, 9); }
  function phoneFmt(d) { return [d.slice(0, 2), d.slice(2, 5), d.slice(5, 7), d.slice(7, 9)].filter(Boolean).join(' '); }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function fdate(d) { var D = DATA[lang]; return lang === 'uz' ? d.getDate() + '-' + D.months[d.getMonth()] : d.getDate() + ' ' + D.months[d.getMonth()]; }
  function planTotal(ration, plan) {
    var days = CFG.planDays[plan], price = CFG.prices[ration], disc = CFG.discounts[plan] || 0;
    var gross = days * price; var total = Math.round(gross * (1 - disc / 100) / 1000) * 1000;
    return { days: days, price: price, disc: disc, gross: gross, total: total };
  }

  // Keep the last lead (id + key) so a later plan choice updates the same CRM row.
  function saveLead(l) { store('k_lead', JSON.stringify({ id: l.id, key: l.key, name: l.name, phone: l.phone, t: Date.now() })); }
  function lastLead() { try { var l = JSON.parse(store('k_lead') || 'null'); return l && l.t > Date.now() - 14 * 864e5 ? l : null; } catch (e) { return null; } }

  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-lang]');
    if (b) setLang(b.getAttribute('data-lang'));
  });

  function initLinks() {
    document.querySelectorAll('.js-tg').forEach(function (a) { a.href = CFG.telegram; });
    if (CFG.phone) document.querySelectorAll('.js-phone').forEach(function (a) { a.href = 'tel:' + CFG.phone; a.textContent = CFG.phone; a.style.display = ''; });
  }

  window.K = {
    RU: RU, DATA: DATA, CFG: CFG,
    get lang() { return lang; }, d: function () { return DATA[lang]; }, t: function (key) { return lang === 'ru' ? RU[key] : null; },
    onLang: function (fn) { listeners.push(fn); }, applyLang: applyLang, setLang: setLang,
    attribution: attribution, track: track, post: post, fmt: fmt, esc: esc, fdate: fdate, planTotal: planTotal,
    phoneDigits: phoneDigits, phoneFmt: phoneFmt, saveLead: saveLead, lastLead: lastLead, initLinks: initLinks
  };
})();
