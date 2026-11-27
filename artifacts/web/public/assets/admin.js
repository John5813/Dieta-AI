/* kaloria.uz CRM: Arizalar · Mijozlar · Yetkazish (+ Xodimlar for the owner).
 * Every value from the server is rendered with textContent (customer names and
 * addresses come from the public website), never as HTML. */
(function () {
  'use strict';

  // ── tiny DOM helper ──
  function h(tag, attrs) {
    var el = document.createElement(tag);
    if (attrs) for (var k in attrs) {
      var v = attrs[k];
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), v);
      else if (k === 'value') el.value = v;
      else el.setAttribute(k, v === true ? '' : v);
    }
    for (var i = 2; i < arguments.length; i++) add(el, arguments[i]);
    return el;
  }
  function add(el, c) {
    if (c == null || c === false) return;
    if (Array.isArray(c)) { c.forEach(function (x) { add(el, x); }); return; }
    el.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
  }
  function clear(el) { while (el.firstChild) el.removeChild(el.firstChild); return el; }

  // ── API ──
  function api(method, url, body) {
    var opt = { method: method, headers: { 'x-kaloria-admin': '1' }, credentials: 'same-origin' };
    if (body !== undefined) { opt.headers['content-type'] = 'application/json'; opt.body = JSON.stringify(body); }
    return fetch('/api/admin' + url, opt).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (r.status === 401) { showLogin(); throw new Error('auth'); }
        if (!r.ok) { var e = new Error(j.error || 'Xatolik'); e.data = j; throw e; }
        return j;
      });
    });
  }
  function toast(msg, err) {
    var t = h('div', { class: 'toast' + (err ? ' err' : ''), role: 'status', text: msg });
    document.body.appendChild(t); setTimeout(function () { t.remove(); }, 3000);
  }
  function fail(e) { if (e && e.message !== 'auth') toast(e.message || 'Xatolik', true); }

  // ── labels ──
  var L = {
    intent: { quiz: 'Kalkulyator', test_drive: '3 kunlik sinov', subscription: 'Obuna', manager: 'Menejer bog‘lansin' },
    lead: { new: 'Yangi', contacted: 'Aloqaga chiqildi', converted: 'Buyurtma bo‘ldi', lost: 'Rad etildi' },
    order: { new: 'Yangi', contacted: 'Aloqaga chiqildi', awaiting_payment: 'To‘lov kutilmoqda', active: 'Faol', frozen: 'Muzlatilgan', ending: 'Tugamoqda', finished: 'Tugadi', cancelled: 'Bekor' },
    pay: { unpaid: 'To‘lanmagan', pending: 'Kutilmoqda', paid: 'To‘langan', partial: 'Qisman', refunded: 'Qaytarilgan' },
    ration: { ozish: 'Ozish', balans: 'Balans', sport: 'Sport' },
    plan: { d3: '3 kun (sinov)', w1: '1 hafta (6 kun)', w2: '2 hafta', w3: '3 hafta', w4: '4 hafta', m1: '1 oy' },
    slot: { morning: 'Ertalab 08:00–10:00', evening: 'Kechki 18:00–22:30' },
    courier: { internal: 'Ichki kuryer', external: 'Tashqi (autsors)' },
    source: { phone: 'Telefon', instagram: 'Instagram', telegram: 'Telegram', web: 'Sayt', mobile_app: 'Ilova' },
    day: { scheduled: 'Rejada', locked: 'Qulflangan', delivered: 'Yetkazildi', failed: 'O‘tkazib yuborildi' },
    district: { bektemir: 'Bektemir', chilonzor: 'Chilonzor', mirobod: 'Mirobod', mirzo_ulugbek: 'Mirzo Ulug‘bek', olmazor: 'Olmazor', sergeli: 'Sergeli', shayxontohur: 'Shayxontohur', uchtepa: 'Uchtepa', yakkasaroy: 'Yakkasaroy', yangihayot: 'Yangihayot', yashnobod: 'Yashnobod', yunusobod: 'Yunusobod', other: 'Boshqa / viloyat' },
    event: { call: '📞 Qo‘ng‘iroq', note: '📝 Izoh', lead: '🌐 Ariza', lead_status: '↪ Ariza holati', order_created: '🧾 Buyurtma yaratildi', order_updated: '✏️ Buyurtma o‘zgardi', delivery_change: '🚚 Yetkazish', customer_added: '➕ Mijoz qo‘shildi', customer_updated: '👤 Mijoz o‘zgardi' }
  };
  var lbl = function (group, v) { return (L[group] && L[group][v]) || v || '—'; };
  var fmt = function (n) { return String(Math.round(n || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ' '); };
  function when(iso) {
    if (!iso) return '';
    var d = new Date(iso), diff = (Date.now() - d.getTime()) / 60000;
    if (diff < 1) return 'hozirgina';
    if (diff < 60) return Math.round(diff) + ' daq oldin';
    if (diff < 24 * 60) return Math.round(diff / 60) + ' soat oldin';
    return d.toLocaleDateString('ru-RU') + ' ' + d.toTimeString().slice(0, 5);
  }
  function badge(cls, text) { return h('span', { class: 'badge b-' + cls, text: text }); }
  function fmtPhone(p) { return String(p || '').replace(/^\+998(\d{2})(\d{3})(\d{2})(\d{2})$/, '+998 $1 $2 $3 $4'); }
  function phoneLink(p) { return h('a', { class: 'ph', href: 'tel:' + p, text: fmtPhone(p) }); }
  function select(name, options, value, onchange) {
    var s = h('select', { class: 'sel', name: name, onchange: onchange });
    options.forEach(function (o) { var op = h('option', { value: o[0], text: o[1] }); if (String(o[0]) === String(value)) op.selected = true; s.appendChild(op); });
    return s;
  }
  var opts = function (group, ids) { return ids.map(function (id) { return [id, lbl(group, id)]; }); };
  var place = function (district, address) { return [lbl('district', district), address].filter(function (x) { return x && x !== '—'; }).join(', '); };

  // Phones: +998 + operator / area code + 7 digits (same rule as the server).
  var UZ_CODES = ['20', '33', '50', '55', '61', '62', '65', '66', '67', '69', '70', '71', '72', '73', '74', '75', '76', '77', '78', '79', '88', '90', '91', '93', '94', '95', '97', '98', '99'];
  // "+998 90 123…" (formatted / pasted with +) or "998901234567" → the 9 local digits.
  function digits9(v) {
    var s = String(v || '').trim(), d = s.replace(/\D/g, '');
    if (d.indexOf('998') === 0 && (s.charAt(0) === '+' || d.length > 9)) d = d.slice(3);
    return d;
  }
  function phoneError(v) {
    var d = digits9(v);
    if (!d) return 'Telefon raqamini kiriting';
    if (d.length !== 9) return 'Telefon 9 ta raqam bo‘lishi kerak (+998 dan keyin), hozir ' + d.length + ' ta';
    if (UZ_CODES.indexOf(d.slice(0, 2)) < 0) return 'Operator kodi noto‘g‘ri: ' + d.slice(0, 2);
    return '';
  }
  // Live "+998 90 123 45 67" formatting for phone inputs.
  function phoneInput(attrs) {
    var el = h('input', Object.assign({ class: 'inp', name: 'phone', inputmode: 'tel', autocomplete: 'off', placeholder: '+998 90 123 45 67', maxlength: '17' }, attrs || {}));
    el.addEventListener('input', function () {
      var d = digits9(el.value).slice(0, 9);
      el.value = d ? '+998 ' + [d.slice(0, 2), d.slice(2, 5), d.slice(5, 7), d.slice(7, 9)].filter(Boolean).join(' ') : '';
    });
    return el;
  }
  function fieldError(el, msg) {
    var box = el.closest('label') || el.parentNode, e = box.querySelector('.ferr');
    if (!e) { e = h('span', { class: 'ferr', role: 'alert' }); box.appendChild(e); }
    e.textContent = msg || ''; el.setAttribute('aria-invalid', msg ? 'true' : 'false');
    return !msg;
  }

  var ME = null, root = document.getElementById('app');

  // ── modal ──
  function modal(title, body, wide) {
    var m = h('div', { class: 'modal open' });
    var onKey = function (e) { if (e.key === 'Escape') close(); };
    var close = function () { m.remove(); document.body.classList.remove('noscroll'); document.removeEventListener('keydown', onKey); };
    m.appendChild(h('div', { class: 'scrim', onclick: close }));
    m.appendChild(h('div', { class: 'sheet' + (wide ? ' wide' : ''), role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
      h('div', { class: 'grab' }),
      h('div', { class: 'sheet-h' }, h('b', { class: 'nm', text: title }), h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Yopish', onclick: close, text: '✕' })),
      h('div', { style: 'margin-top:14px' }, body)));
    document.body.appendChild(m); document.body.classList.add('noscroll');
    var f = m.querySelector('input:not([type=checkbox]),select,textarea'); if (f) setTimeout(function () { f.focus(); }, 30);
    document.addEventListener('keydown', onKey);
    return close;
  }
  function confirmBox(title, text, okText, onOk, danger) {
    var close = modal(title, h('div', { class: 'form' }, h('p', { class: 'lead-p', style: 'font-size:15px', text: text }),
      h('div', { class: 'two' }, h('button', { type: 'button', class: 'btn btn-line', onclick: function () { close(); }, text: 'Bekor qilish' }),
        h('button', { type: 'button', class: 'btn ' + (danger ? 'btn-danger' : 'btn-hot'), onclick: function () { close(); onOk(); }, text: okText }))));
  }

  // ── login / shell ──
  function showLogin() {
    clear(root).appendChild(h('div', { class: 'login' },
      h('h1', { text: 'kaloria.uz CRM' }),
      h('p', { class: 'lead-p' }, 'Kirish uchun Telegram botimizga ', h('code', { text: '/login' }), ' deb yozing — bot bir martalik havola yuboradi.'),
      h('p', { class: 'a-sub', text: 'Havola 10 daqiqa amal qiladi. Ro‘yxatda bo‘lmasangiz, bot sizning Telegram ID raqamingizni ko‘rsatadi — uni adminga yuboring.' })));
  }

  var VIEWS = [['inbox', 'Arizalar'], ['customers', 'Mijozlar'], ['delivery', 'Yetkazish']];
  function shell() {
    var tabs = VIEWS.slice();
    if (ME.role === 'owner') tabs.push(['staff', 'Xodimlar']);
    clear(root);
    root.appendChild(h('header', { class: 'a-top' },
      h('div', { class: 'a-top-in' },
        h('span', { class: 'a-brand' }, 'kaloria.uz', h('small', { text: 'CRM' })),
        h('button', { type: 'button', class: 'btn btn-hot btn-xs a-new', onclick: function () { newCustomerForm(); } }, h('span', { 'aria-hidden': 'true', text: '+ ' }), h('span', { class: 'a-new-long', text: 'Yangi mijoz qo‘shish' }), h('span', { class: 'a-new-short', text: 'Yangi mijoz' })),
        h('span', { class: 'a-user' }, ME.name + ' · ' + (ME.role === 'owner' ? 'admin' : 'menejer'),
          h('form', { method: 'post', action: '/admin/logout' }, h('button', { type: 'submit', class: 'btn btn-line btn-xs', text: 'Chiqish' })))),
      h('nav', { class: 'a-tabs', 'aria-label': 'Bo‘limlar' }, tabs.map(function (t) {
        return h('a', { class: 'tab', href: '#' + t[0], 'data-view': t[0], 'aria-selected': 'false' }, t[1], t[0] === 'inbox' ? h('span', { class: 'cnt js-inbox-cnt', hidden: true }) : null);
      }))));
    root.appendChild(h('main', { class: 'a-main', id: 'view' }));
  }

  var custState = { q: '', status: '' };
  function route() {
    var hash = (location.hash || '#inbox').slice(1), parts = hash.split('/');
    var view = parts[0] === 'c' ? 'customers' : parts[0];
    if (['inbox', 'customers', 'delivery', 'staff'].indexOf(view) < 0) view = 'inbox';
    // Customer search / filter only survive while working inside "Mijozlar".
    if (view !== 'customers') custState = { q: '', status: '' };
    root.querySelectorAll('[data-view]').forEach(function (a) { a.setAttribute('aria-selected', String(a.getAttribute('data-view') === view)); });
    var v = clear(document.getElementById('view'));
    if (parts[0] === 'c' && parts[1]) return viewCustomer(v, +parts[1]);
    if (view === 'inbox') return viewInbox(v);
    if (view === 'customers') return viewCustomers(v);
    if (view === 'delivery') return viewDelivery(v);
    if (view === 'staff') return viewStaff(v);
  }

  // ── 1. Arizalar ──
  var inboxFilter = '';
  function viewInbox(v) {
    v.appendChild(h('div', { class: 'a-h' }, h('h1', { text: 'Kiruvchi arizalar' }), h('span', { class: 'a-sub', text: 'Sayt va ilovadan kelgan so‘rovlar' })));
    var chips = h('div', { class: 'chips' }), list = h('div', { class: 'list' }, h('div', { class: 'empty', text: 'Yuklanmoqda…' }));
    v.appendChild(chips); v.appendChild(list);
    api('GET', '/inbox' + (inboxFilter ? '?status=' + inboxFilter : '')).then(function (d) {
      var c = d.counts || {};
      var cnt = root.querySelector('.js-inbox-cnt'); if (cnt) { cnt.textContent = c.new || 0; cnt.hidden = !c.new; }
      [['', 'Ishdagilar', (c.new || 0) + (c.contacted || 0)], ['new', 'Yangi', c.new || 0], ['contacted', 'Aloqaga chiqildi', c.contacted || 0], ['converted', 'Buyurtma bo‘ldi', c.converted || 0], ['lost', 'Rad etildi', c.lost || 0]].forEach(function (f) {
        chips.appendChild(h('button', { type: 'button', class: 'chipb', 'aria-pressed': String(inboxFilter === f[0]), onclick: function () { inboxFilter = f[0]; route(); } }, f[1] + ' · ' + f[2]));
      });
      clear(list);
      if (!d.items.length) { list.appendChild(h('div', { class: 'empty', text: 'Hozircha ariza yo‘q' })); return; }
      d.items.forEach(function (l) { list.appendChild(leadCard(l)); });
    }).catch(fail);
  }

  function leadCard(l) {
    var meta = [];
    if (l.ration) meta.push(lbl('ration', l.ration) + (l.sku ? ' ' + l.sku : ''));
    if (l.calories) meta.push('me’yor ' + l.calories + ' kkal');
    if (l.plan) meta.push(lbl('plan', l.plan));
    if (l.deliverySlot) meta.push(lbl('slot', l.deliverySlot));
    if (l.district || l.address) meta.push(place(l.district, l.address));
    if (l.utmSource) meta.push('UTM: ' + [l.utmSource, l.utmCampaign].filter(Boolean).join(' / '));
    var open = l.status === 'new' || l.status === 'contacted';
    var acts = [];
    if (open) {
      acts.push(h('button', { type: 'button', class: 'btn btn-hot btn-xs', onclick: function () { orderForm({ customerId: l.customerId, leadId: l.id, source: 'web', ration: l.ration, sku: l.sku, plan: l.plan, deliverySlot: l.deliverySlot, district: l.district, address: l.address }, route); }, text: 'Buyurtma yaratish' }));
      acts.push(h('button', { type: 'button', class: 'btn btn-soft btn-xs', onclick: function () { callForm(l.customerId, l.id, route); }, text: '📞 Qo‘ng‘iroq natijasi' }));
    }
    if (l.customerId) acts.push(h('a', { class: 'btn btn-line btn-xs', href: '#c/' + l.customerId, text: 'Mijoz kartasi' }));
    if (open) acts.push(h('button', { type: 'button', class: 'btn btn-line btn-xs', onclick: function () { confirmBox('Arizani rad etish', (l.name || 'Mijoz') + ' arizasi "Rad etildi" bo‘limiga o‘tadi.', 'Rad etish', function () { api('POST', '/leads/' + l.id + '/status', { status: 'lost' }).then(route).catch(fail); }); }, text: 'Rad etildi' }));
    if (l.status === 'lost') acts.push(h('button', { type: 'button', class: 'btn btn-line btn-xs', onclick: function () { api('POST', '/leads/' + l.id + '/status', { status: 'new' }).then(route).catch(fail); }, text: 'Qayta ochish' }));
    return h('div', { class: 'item' },
      h('div', { class: 'row sp' },
        h('div', { class: 'row' }, h('span', { class: 'nm', text: l.name || 'Ismsiz' }), phoneLink(l.phone)),
        h('div', { class: 'row' }, badge(l.status, lbl('lead', l.status)), h('span', { class: 'a-sub', text: when(l.createdAt) }))),
      h('div', { class: 'row' }, badge('contacted', lbl('intent', l.intent)), l.healthRisk ? badge('risk', '⚠ Sog‘liq cheklovi') : null, l.lang === 'ru' ? badge('finished', 'RU') : null),
      meta.length ? h('div', { class: 'meta' }, meta.map(function (m) { return h('span', { text: m }); })) : null,
      h('div', { class: 'acts' }, acts));
  }

  function callForm(customerId, leadId, done) {
    if (!customerId) { toast('Mijoz topilmadi', true); return; }
    var outcome = select('outcome', [['Gaplashildi', 'Gaplashildi'], ['Javob bermadi', 'Javob bermadi'], ['Qayta qo‘ng‘iroq', 'Keyinroq qo‘ng‘iroq qilish'], ['O‘ylab ko‘radi', 'O‘ylab ko‘radi'], ['Rad etdi', 'Rad etdi']], 'Gaplashildi');
    outcome.className = 'inp';
    var note = h('textarea', { name: 'body', placeholder: 'Nima kelishildi? (ixtiyoriy)' });
    var close = modal('Qo‘ng‘iroq natijasi', h('form', { class: 'form', onsubmit: function (e) {
      e.preventDefault();
      api('POST', '/customers/' + customerId + '/events', { type: 'call', outcome: outcome.value, body: note.value, leadId: leadId }).then(function () { close(); toast('Saqlandi'); done && done(); }).catch(fail);
    } }, h('label', null, 'Natija', outcome), h('label', null, 'Izoh (tarixga yoziladi)', note), h('button', { type: 'submit', class: 'btn btn-hot btn-block', text: 'Saqlash' })));
  }

  // ── order fields (shared by "Yangi buyurtma" and "Yangi mijoz qo'shish") ──
  // opts.slotEl: an outer "Yetkazish vaqti" select to use instead of an own one.
  function orderFields(pre, o2) {
    o2 = o2 || {};
    var O = ME.options, P = ME.pricing;
    var ration = select('ration', O.rations.map(function (r) { return [r.id, lbl('ration', r.id)]; }), pre.ration || 'balans');
    var sku = h('select', { class: 'inp', name: 'sku' });
    var plan = select('plan', O.plans.map(function (p) { return [p.id, lbl('plan', p.id)]; }), pre.plan || 'w1');
    var start = h('input', { class: 'inp', type: 'date', name: 'startDate', value: ME.defaultStart, min: ME.today, required: true });
    var slot = o2.slotEl || select('deliverySlot', opts('slot', ['morning', 'evening']), pre.deliverySlot || 'morning');
    var courier = select('courierType', opts('courier', ['internal', 'external']), pre.courierType || ((pre.deliverySlot === 'evening') ? 'external' : 'internal'));
    var price = h('input', { class: 'inp', type: 'number', name: 'pricePerDay', min: '1000', step: '1000' });
    var pay = select('paymentStatus', opts('pay', ['unpaid', 'pending', 'partial', 'paid']), 'unpaid');
    var paid = h('input', { class: 'inp', type: 'number', name: 'paidAmount', min: '0', step: '1000', placeholder: 'Masalan 200 000' });
    var paidBox = h('label', { hidden: true }, 'To‘langan summa (so‘m)', paid);
    var sum = h('div', { class: 'sum' });
    [ration, plan, courier, pay].forEach(function (x) { x.className = 'inp'; });
    if (!o2.slotEl) slot.className = 'inp';
    function total() {
      var p = O.plans.filter(function (x) { return x.id === plan.value; })[0], per = +price.value || P.prices[ration.value], disc = P.discounts[plan.value] || 0;
      return { days: p.days, per: per, disc: disc, total: Math.round(p.days * per * (1 - disc / 100) / 1000) * 1000 };
    }
    function fillSku() {
      var r = O.rations.filter(function (x) { return x.id === ration.value; })[0];
      clear(sku); r.skus.forEach(function (k) { var o = h('option', { value: k, text: k + ' kkal' }); if (+pre.sku === k) o.selected = true; sku.appendChild(o); });
      price.placeholder = fmt(P.prices[ration.value]) + ' (standart)';
    }
    function recalc() {
      var t = total();
      clear(sum); add(sum, [t.days + ' kun × ' + fmt(t.per) + ' so‘m' + (t.disc ? ' − ' + t.disc + '%' : '') + ' = ', h('b', { text: fmt(t.total) + ' so‘m' })]);
      if (pay.value === 'partial' && +paid.value) add(sum, ' · qarz: ' + fmt(Math.max(0, t.total - paid.value)) + ' so‘m');
    }
    ration.addEventListener('change', function () { pre.sku = null; fillSku(); recalc(); });
    plan.addEventListener('change', recalc); price.addEventListener('input', recalc); paid.addEventListener('input', recalc);
    pay.addEventListener('change', function () { paidBox.hidden = pay.value !== 'partial'; recalc(); });
    // Evening deliveries usually go to the outsourced company; the admin can still change it.
    slot.addEventListener('change', function () { courier.value = slot.value === 'evening' ? 'external' : 'internal'; });
    fillSku(); recalc();
    var hint = ME.cutoffPassed ? 'Soat 18:00 o‘tdi — standart boshlanish indinga qo‘yildi.' : 'Standart: ertadan (18:00 gacha). Yakshanba yetkazilmaydi.';
    var el = h('div', { class: 'form' },
      h('div', { class: 'two' }, h('label', null, 'Rasion', ration), h('label', null, 'Kaloriya', sku)),
      h('div', { class: 'two' }, h('label', null, 'Muddat', plan), h('label', null, 'Boshlanish sanasi', start)),
      h('span', { class: 'a-sub', text: hint }),
      h('div', { class: 'two' }, o2.slotEl ? null : h('label', null, 'Yetkazish vaqti', slot), h('label', null, 'Kuryer', courier)),
      h('div', { class: 'two' }, h('label', null, 'To‘lov', pay), h('label', null, 'Kunlik narx (ixtiyoriy)', price)),
      paidBox, sum);
    return {
      el: el,
      values: function () {
        var o = { ration: ration.value, sku: +sku.value, plan: plan.value, startDate: start.value, deliverySlot: slot.value, courierType: courier.value, paymentStatus: pay.value };
        if (price.value) o.pricePerDay = +price.value;
        if (pay.value === 'partial') o.paidAmount = +paid.value || 0;
        return o;
      },
      check: function () {
        if (pay.value === 'partial' && !(+paid.value > 0)) return fieldError(paid, 'Qisman to‘lov summasini kiriting');
        if (pay.value === 'partial' && +paid.value >= total().total) return fieldError(paid, 'Bu to‘liq to‘lov — "To‘langan"ni tanlang');
        return fieldError(paid, '');
      }
    };
  }

  // ── new order for an existing customer ──
  function orderForm(pre, done) {
    if (!pre.customerId) { toast('Avval mijozni tanlang', true); return; }
    var O = ME.options, f = orderFields(pre);
    var district = select('district', [['', 'Tanlang']].concat(O.districts.map(function (d) { return [d, lbl('district', d)]; })), pre.district || ''); district.className = 'inp';
    var address = h('input', { class: 'inp', name: 'address', maxlength: '200', value: pre.address || '', placeholder: 'Ko‘cha, uy, mo‘ljal' });
    var source = select('source', opts('source', O.sources), pre.source || 'phone'); source.className = 'inp';
    var note = h('textarea', { name: 'note', placeholder: 'Faqat shu buyurtma uchun: domofon, qavat, eshik kodi…' });
    var btn = h('button', { type: 'submit', class: 'btn btn-hot btn-block', text: 'Buyurtmani saqlash' });
    var close = modal('Yangi buyurtma', h('form', { class: 'form', onsubmit: function (e) {
      e.preventDefault();
      if (!f.check()) return;
      var body = f.values();
      body.customerId = pre.customerId; body.leadId = pre.leadId || null; body.district = district.value || null; body.address = address.value; body.source = source.value; body.note = note.value;
      btn.disabled = true;
      api('POST', '/orders', body).then(function () { close(); toast('Buyurtma yaratildi'); done && done(); }).catch(function (err) { btn.disabled = false; fail(err); });
    } },
      f.el,
      h('div', { class: 'two' }, h('label', null, 'Tuman', district), h('label', null, 'Manzil', address)),
      h('label', null, 'Manba', source), h('label', null, 'Buyurtma izohi', note), btn), true);
  }

  // ── "+ Yangi mijoz qo'shish": customer (call / interest) with an optional order ──
  function newCustomerForm() {
    var O = ME.options;
    var phone = phoneInput({ required: true });
    var name = h('input', { class: 'inp', name: 'name', maxlength: '60', autocomplete: 'off', required: true, placeholder: 'Masalan, Dilnoza' });
    var dup = h('div', { class: 'dup', hidden: true, role: 'status' });
    var source = select('source', opts('source', ['phone', 'instagram', 'telegram', 'web']), 'phone'); source.className = 'inp';
    var district = select('district', [['', 'Tanlang']].concat(O.districts.map(function (d) { return [d, lbl('district', d)]; })), ''); district.className = 'inp';
    var address = h('input', { class: 'inp', name: 'address', maxlength: '200', placeholder: 'Ko‘cha, uy, mo‘ljal' });
    var slot = select('deliverySlot', opts('slot', ['morning', 'evening']), 'morning'); slot.className = 'inp';
    var note = h('textarea', { name: 'note', placeholder: 'Allergiya, domofon, taom bo‘yicha istaklar…' });
    var withOrder = h('input', { type: 'checkbox', name: 'withOrder' });
    var of = orderFields({}, { slotEl: slot });
    var orderBox = h('div', { class: 'order-box', hidden: true }, of.el);
    var submit = h('button', { type: 'submit', class: 'btn btn-hot btn-block', text: 'Mijozni saqlash' });
    var existing = null, lastLookup = '', autoName = '', timer;

    withOrder.addEventListener('change', function () {
      orderBox.hidden = !withOrder.checked;
      submit.textContent = withOrder.checked ? 'Mijoz va buyurtmani saqlash' : 'Mijozni saqlash';
    });
    phone.addEventListener('input', function () {
      clearTimeout(timer);
      var d = digits9(phone.value);
      if (d !== lastLookup) {
        // The number changed: forget the previous match and the name it filled in.
        if (autoName && name.value === autoName) name.value = '';
        autoName = ''; existing = null; dup.hidden = true;
      }
      if (d.length !== 9) { lastLookup = ''; return; }
      fieldError(phone, phoneError(d));
      if (d === lastLookup) return;
      timer = setTimeout(function () {
        lastLookup = d;
        api('GET', '/customers/lookup?phone=' + d).then(function (r) {
          if (digits9(phone.value) !== d) return;
          existing = r.customer; clear(dup);
          if (!existing) { dup.hidden = true; return; }
          var o = existing.order;
          add(dup, [h('b', { text: 'Bu raqam bazada bor: ' + (existing.name || 'Ismsiz') + (existing.archived ? ' (arxivda)' : '') }),
            h('span', { text: o ? lbl('ration', o.ration) + ' ' + o.sku + ' · ' + lbl('plan', o.plan) + ' · ' + lbl('order', o.status) : 'Hali buyurtmasi yo‘q' }),
            h('span', { class: 'a-sub', text: 'Saqlasangiz yangi mijoz ochilmaydi — mavjud kartadagi bo‘sh maydonlar to‘ldiriladi' + (existing.archived ? ' va mijoz arxivdan qaytadi' : '') + '.' }),
            h('a', { class: 'btn btn-line btn-xs', href: '#c/' + existing.id, onclick: function () { closeModal(); }, text: 'Mavjud kartani ochish' })]);
          dup.hidden = false;
          if (!name.value && existing.name) { name.value = existing.name; autoName = existing.name; }
        }).catch(fail);
      }, 250);
    });
    name.addEventListener('input', function () { if (name.value !== autoName) autoName = ''; fieldError(name, ''); });

    var closeModal = modal('Yangi mijoz qo‘shish', h('form', { class: 'form', novalidate: true, onsubmit: function (e) {
      e.preventDefault();
      var ok = fieldError(phone, phoneError(phone.value));
      ok = fieldError(name, name.value.trim().length < 2 ? 'Mijoz ismini kiriting (kamida 2 harf)' : '') && ok;
      if (withOrder.checked) ok = of.check() && ok;
      if (!ok) { (phone.getAttribute('aria-invalid') === 'true' ? phone : name).focus(); return; }
      var body = { name: name.value.trim(), phone: phone.value, source: source.value, district: district.value || null, address: address.value, deliverySlot: slot.value, note: note.value };
      if (withOrder.checked) body.order = of.values();
      submit.disabled = true;
      api('POST', '/customers/quick', body).then(function (r) {
        closeModal();
        toast(r.existing ? 'Bu raqam bazada bor edi — mavjud mijoz yangilandi' + (r.order ? ' va buyurtma qo‘shildi' : '') : 'Yangi mijoz qo‘shildi' + (r.order ? ' (buyurtma bilan)' : ''));
        if (location.hash === '#c/' + r.customer.id) route(); else location.hash = '#c/' + r.customer.id;
      }).catch(function (err) { submit.disabled = false; fail(err); });
    } },
      h('div', { class: 'two two-m1' }, h('label', null, 'Telefon *', phone), h('label', null, 'Ism *', name)),
      dup,
      h('div', { class: 'two' }, h('label', null, 'Manba', source), h('label', null, 'Yetkazish vaqti', slot)),
      h('div', { class: 'two' }, h('label', null, 'Tuman', district), h('label', null, 'Manzil', address)),
      h('label', null, 'Doimiy eslatma (kartada saqlanadi)', note),
      h('label', { class: 'toggle' }, withOrder, h('span', { text: 'Shu yerning o‘zida buyurtma/obuna ham qo‘shish' })),
      orderBox,
      submit), true);
  }

  // ── 2. Mijozlar ──
  function viewCustomers(v) {
    var q = h('input', { class: 'inp', type: 'search', placeholder: 'Telefon yoki ism bo‘yicha qidirish', value: custState.q, 'aria-label': 'Qidirish' });
    var x = h('button', { type: 'button', class: 'icon-btn clear-x', 'aria-label': 'Qidiruvni tozalash', text: '✕', hidden: !custState.q, onclick: function () { q.value = ''; x.hidden = true; load(); q.focus(); } });
    var chips = h('div', { class: 'chips' });
    var list = h('div', { class: 'list' });
    v.appendChild(h('div', { class: 'a-h' }, h('h1', { text: 'Mijozlar va obunalar' }), h('span', { class: 'a-sub', text: 'Yangi mijozni yuqoridagi "+ Yangi mijoz qo‘shish" tugmasi bilan qo‘shing' })));
    v.appendChild(h('div', { class: 'toolbar' }, h('div', { class: 'search' }, q, x)));
    v.appendChild(chips); v.appendChild(list);
    [['', 'Hammasi'], ['active', 'Faol'], ['awaiting', 'To‘lov kutilmoqda'], ['none', 'Buyurtma yo‘q'], ['archived', 'Arxiv']].forEach(function (f) {
      chips.appendChild(h('button', { type: 'button', class: 'chipb', 'aria-pressed': String(custState.status === f[0]), onclick: function () { custState.status = f[0]; chips.querySelectorAll('.chipb').forEach(function (b) { b.setAttribute('aria-pressed', 'false'); }); this.setAttribute('aria-pressed', 'true'); load(); } }, f[1]));
    });
    var timer;
    function load() {
      custState.q = q.value.trim();
      var qs = [];
      if (custState.q) qs.push('q=' + encodeURIComponent(custState.q));
      if (custState.status) qs.push('status=' + custState.status);
      api('GET', '/customers' + (qs.length ? '?' + qs.join('&') : '')).then(function (d) {
        clear(list);
        if (!d.items.length) { list.appendChild(h('div', { class: 'empty', text: custState.q || custState.status ? 'Topilmadi' : 'Hozircha mijoz yo‘q' })); return; }
        d.items.forEach(function (c) {
          var o = c.order;
          list.appendChild(h('a', { class: 'item click', href: '#c/' + c.id, style: 'text-decoration:none' },
            h('div', { class: 'row sp' }, h('div', { class: 'row' }, h('span', { class: 'nm', text: c.name || 'Ismsiz' }), h('span', { class: 'ph', text: fmtPhone(c.phone) })),
              c.archivedAt ? badge('finished', 'Arxivda') : o ? badge(o.status, lbl('order', o.status)) : badge('finished', 'Buyurtma yo‘q')),
            o ? h('div', { class: 'meta' }, h('span', { text: lbl('ration', o.ration) + ' ' + o.sku + ' · ' + lbl('plan', o.plan) }),
              o.progress ? h('span', { text: 'Qoldi: ' + o.progress.remaining + ' / ' + o.daysTotal + ' kun' }) : null,
              h('span', { text: lbl('pay', o.paymentStatus) }), h('span', { text: lbl('slot', o.deliverySlot) })) : h('div', { class: 'meta', text: lbl('source', c.firstSource) + ' · ' + when(c.createdAt) })));
        });
      }).catch(fail);
    }
    q.addEventListener('input', function () { x.hidden = !q.value; clearTimeout(timer); timer = setTimeout(load, 300); });
    load();
  }

  function viewCustomer(v, id) {
    v.appendChild(h('div', { class: 'empty', text: 'Yuklanmoqda…' }));
    api('GET', '/customers/' + id).then(function (d) {
      clear(v);
      var c = d.customer, reload = function () { viewCustomer(clear(v), id); };
      var archived = !!c.archivedAt;
      var hasOpen = d.orders.some(function (o) { return o.crmStatus === 'active' && o.progress && (o.progress.remaining > 0 || o.progress.frozen > 0); });
      var acts = [phoneLink(c.phone),
        h('button', { type: 'button', class: 'btn btn-soft btn-xs', onclick: function () { callForm(c.id, null, reload); }, text: '📞 Qo‘ng‘iroq' }),
        h('button', { type: 'button', class: 'btn btn-hot btn-xs', onclick: function () { orderForm({ customerId: c.id, source: 'phone', deliverySlot: c.deliverySlot, district: c.district, address: c.address }, reload); }, text: '+ Buyurtma' })];
      if (archived) acts.push(h('button', { type: 'button', class: 'btn btn-line btn-xs', onclick: function () { api('POST', '/customers/' + c.id + '/archive', { archived: false }).then(function () { toast('Arxivdan qaytarildi'); reload(); }).catch(fail); }, text: 'Arxivdan qaytarish' }));
      else acts.push(h('button', { type: 'button', class: 'btn btn-line btn-xs', title: hasOpen ? 'Faol obunasi bor' : '', onclick: function () {
        if (hasOpen) { toast('Faol obunasi bor — avval obunani bekor qiling', true); return; }
        confirmBox('Arxivga olish', (c.name || 'Mijoz') + ' ro‘yxatlardan yashiriladi. Shu raqamdan yangi ariza kelsa, avtomatik qaytadi.', 'Arxivlash', function () {
          api('POST', '/customers/' + c.id + '/archive', { archived: true }).then(function () { toast('Arxivga olindi'); location.hash = '#customers'; }).catch(fail);
        });
      }, text: 'Arxivlash' }));
      if (ME.role === 'owner') acts.push(h('button', { type: 'button', class: 'btn btn-danger-line btn-xs', onclick: function () { deleteCustomerForm(c); }, text: 'O‘chirish' }));
      v.appendChild(h('div', { class: 'a-h' },
        h('div', null, h('a', { href: '#customers', class: 'a-sub', text: '← Mijozlar' }), h('h1', null, c.name || 'Ismsiz', archived ? ' ' : null, archived ? badge('finished', 'Arxivda') : null)),
        h('div', { class: 'acts' }, acts)));

      // customer details (editable)
      var name = h('input', { class: 'inp', value: c.name || '', maxlength: '60', required: true });
      var phone = phoneInput({ value: fmtPhone(c.phone) });
      var district = select('district', [['', '—']].concat(ME.options.districts.map(function (x) { return [x, lbl('district', x)]; })), c.district || ''); district.className = 'inp';
      var address = h('input', { class: 'inp', value: c.address || '', maxlength: '200' });
      var notes = h('textarea', { text: c.notes || '', placeholder: 'Allergiya, domofon, taom bo‘yicha istaklar — kuryer va oshxona ro‘yxatida ham ko‘rinadi' });
      var info = h('form', { class: 'card form', novalidate: true, onsubmit: function (e) {
        e.preventDefault();
        var ok = fieldError(phone, phoneError(phone.value));
        ok = fieldError(name, name.value.trim().length < 2 ? 'Ism kamida 2 harf' : '') && ok;
        if (!ok) return;
        api('PATCH', '/customers/' + c.id, { name: name.value.trim(), phone: phone.value, district: district.value || null, address: address.value, notes: notes.value })
          .then(function () { toast('Saqlandi'); reload(); })
          .catch(function (err) { if (err.data && err.data.code === 'phone_taken') fieldError(phone, err.message); else fail(err); });
      } }, h('h3', { text: 'Mijoz' }),
        h('div', { class: 'two two-m1' }, h('label', null, 'Ism *', name), h('label', null, 'Telefon *', phone)),
        h('div', { class: 'two' }, h('label', null, 'Tuman', district), h('label', null, 'Manzil', address)),
        h('label', null, 'Doimiy eslatma (allergiya, domofon…)', notes),
        h('div', { class: 'meta' }, h('span', { text: 'Manba: ' + lbl('source', c.firstSource) }), c.utmSource ? h('span', { text: 'UTM: ' + c.utmSource + (c.utmCampaign ? ' / ' + c.utmCampaign : '') }) : null, h('span', { text: 'Qo‘shilgan: ' + when(c.createdAt) })),
        h('button', { type: 'submit', class: 'btn btn-soft btn-xs', text: 'Saqlash' }));

      // subscriptions
      var orders = h('div', { class: 'card' }, h('h3', { text: 'Obunalar' }), h('p', { class: 'a-sub', style: 'margin:-4px 0 4px', text: 'Yetkazish vaqti, kuryer va manzil har bir obunada alohida saqlanadi.' }));
      if (!d.orders.length) orders.appendChild(h('div', { class: 'a-sub', text: 'Hali buyurtma yo‘q' }));
      d.orders.forEach(function (o) { orders.appendChild(orderBlock(o, c, reload)); });

      // history
      var note = h('input', { class: 'inp', placeholder: 'Tarixga izoh qo‘shish…', maxlength: '2000' });
      var tl = h('ul', { class: 'tl' });
      d.events.forEach(function (e) {
        tl.appendChild(h('li', null, h('div', null, h('div', null, h('b', { text: lbl('event', e.type) + ' ' }), h('span', { text: e.body ? (e.type === 'lead' ? lbl('intent', e.body) : e.type === 'lead_status' ? lbl('lead', e.body) : e.body) : '' })),
          h('div', { class: 't', text: when(e.createdAt) + (e.staffName ? ' · ' + e.staffName : '') }))));
      });
      var hist = h('div', { class: 'card' }, h('h3', { text: 'Tarix (qo‘ng‘iroqlar va izohlar)' }),
        h('form', { class: 'toolbar', onsubmit: function (e) { e.preventDefault(); if (!note.value.trim()) return; api('POST', '/customers/' + c.id + '/events', { type: 'note', body: note.value }).then(reload).catch(fail); } }, note, h('button', { type: 'submit', class: 'btn btn-soft btn-xs', text: 'Qo‘shish' })),
        tl);

      v.appendChild(h('div', { class: 'grid2' }, h('div', { class: 'list' }, info, hist), orders));
    }).catch(fail);
  }

  function deleteCustomerForm(c) {
    var code = h('input', { class: 'inp', inputmode: 'numeric', maxlength: '4', placeholder: c.phone.slice(-4).replace(/\d/g, '•') });
    var close = modal('Mijozni butunlay o‘chirish', h('form', { class: 'form', onsubmit: function (e) {
      e.preventDefault();
      api('DELETE', '/customers/' + c.id, { confirm: code.value }).then(function () { close(); toast('Mijoz o‘chirildi'); location.hash = '#customers'; }).catch(fail);
    } },
      h('p', { class: 'lead-p', style: 'font-size:15px', text: (c.name || 'Mijoz') + ' (' + fmtPhone(c.phone) + '): barcha buyurtmalari, yetkazish kunlari, tarixi va sayt arizalari o‘chiriladi. Buni qaytarib bo‘lmaydi. Oddiy holatda "Arxivlash" yetarli.' }),
      h('label', null, 'Tasdiqlash: telefonning oxirgi 4 raqami', code),
      h('button', { type: 'submit', class: 'btn btn-danger btn-block', text: 'Butunlay o‘chirish' })));
  }

  function orderBlock(o, c, reload) {
    var p = o.progress || { remaining: 0, delivered: 0, skipped: 0, frozen: 0, frozenDays: [] };
    var patch = function (body, msg) { api('PATCH', '/orders/' + o.id, body).then(function () { toast(msg || 'Saqlandi'); reload(); }).catch(function (e) { fail(e); reload(); }); };
    var done = Math.min(100, Math.round((p.delivered + p.skipped) / Math.max(1, o.daysTotal) * 100));
    var labeled = function (text, el) { return h('label', { class: 'lsel' }, h('span', { text: text }), el); };
    var paidInput = h('input', { class: 'sel', type: 'number', min: '0', step: '1000', value: o.paidAmount || 0, style: 'width:120px' });
    var debt = Math.max(0, o.amount - (o.paidAmount || 0));
    var cancelled = o.crmStatus === 'cancelled';
    var acts = [h('button', { type: 'button', class: 'btn btn-line btn-xs', onclick: function () { editOrderForm(o, reload); }, text: '✏️ Tahrirlash' })];
    if (!cancelled && o.crmStatus === 'active') acts.push(h('button', { type: 'button', class: 'btn btn-line btn-xs', onclick: function () { freezeForm(o, reload); }, text: '❄️ Muzlatish (pauza)' }));
    if (ME.role === 'owner') acts.push(h('button', { type: 'button', class: 'btn btn-danger-line btn-xs', onclick: function () {
      confirmBox('Buyurtmani o‘chirish', 'Buyurtma #' + o.id + ' va uning yetkazish kunlari butunlay o‘chiriladi (xato yoki test buyurtma uchun). Haqiqiy bekor qilish uchun Holat → "Bekor"ni tanlang.', 'O‘chirish', function () {
        api('DELETE', '/orders/' + o.id).then(function () { toast('Buyurtma o‘chirildi'); reload(); }).catch(fail);
      }, true);
    }, text: 'O‘chirish' }));
    return h('div', { class: 'item', style: 'margin-top:10px' },
      h('div', { class: 'row sp' }, h('b', { class: 'nm', text: lbl('ration', o.ration) + ' ' + o.sku + ' kkal · ' + lbl('plan', o.plan) + (o.daysTotal !== (ME.options.plans.filter(function (x) { return x.id === o.plan; })[0] || {}).days ? ' (' + o.daysTotal + ' kun)' : '') }), badge(o.status, lbl('order', o.status))),
      h('div', { class: 'prog-bar', 'aria-hidden': 'true' }, h('i', { style: 'width:' + done + '%' })),
      h('div', { class: 'meta' },
        h('span', { text: 'Boshlanish: ' + o.startDate }), h('span', { text: 'Qoldi: ' + p.remaining + ' kun' }), h('span', { text: 'Yetkazildi: ' + p.delivered }),
        p.skipped ? h('span', { text: 'O‘tkazildi: ' + p.skipped }) : null,
        p.frozen ? h('span', { text: 'Muzlatilgan: ' + p.frozen }) : null, p.lastDay ? h('span', { text: 'Oxirgi kun: ' + p.lastDay }) : null,
        h('span', { text: lbl('source', o.source) })),
      h('div', { class: 'selgrid' },
        labeled('Holat', select('crmStatus', opts('order', ME.options.orderStatuses), o.crmStatus, function (e) {
          var val = e.target.value;
          if (val === 'cancelled') { confirmBox('Obunani bekor qilish', 'Kelgusi yetkazish kunlari bekor qilinadi.', 'Bekor qilish', function () { patch({ crmStatus: val }); }, true); e.target.value = o.crmStatus; return; }
          patch({ crmStatus: val });
        })),
        labeled('To‘lov', select('paymentStatus', opts('pay', ME.options.paymentStatuses), o.paymentStatus, function (e) { patch({ paymentStatus: e.target.value }); })),
        labeled('Yetkazish vaqti', select('deliverySlot', opts('slot', ['morning', 'evening']), o.deliverySlot, function (e) {
          var b = { deliverySlot: e.target.value, courierType: e.target.value === 'evening' ? 'external' : 'internal' };
          patch(b, 'Saqlandi — kuryer: ' + lbl('courier', b.courierType));
        })),
        labeled('Kuryer', select('courierType', opts('courier', ['internal', 'external']), o.courierType, function (e) { patch({ courierType: e.target.value }); }))),
      h('form', { class: 'row pay-row', onsubmit: function (e) { e.preventDefault(); patch({ paidAmount: +paidInput.value || 0 }, 'To‘lov summasi saqlandi'); } },
        h('span', { class: 'meta', text: 'Summa: ' + fmt(o.amount) + ' so‘m · To‘langan:' }), paidInput,
        h('button', { type: 'submit', class: 'btn btn-soft btn-xs', text: 'Saqlash' }),
        debt && o.paymentStatus !== 'unpaid' ? badge('ending', 'Qarz: ' + fmt(debt) + ' so‘m') : null),
      o.address || o.district ? h('div', { class: 'meta', text: '📍 ' + place(o.district, o.address) }) : null,
      o.note ? h('div', { class: 'meta', text: '📝 ' + o.note }) : null,
      p.frozenDays && p.frozenDays.length ? h('div', { class: 'frozen-list' }, h('span', { class: 'a-sub', text: 'Muzlatilgan kunlar (obuna oxiriga qo‘shilgan):' }),
        p.frozenDays.map(function (f) {
          return h('span', { class: 'fz' }, f.day + (f.burnAt ? ' · kuyadi: ' + f.burnAt.slice(0, 10) : ''),
            f.day >= ME.firstEditableDay ? h('button', { type: 'button', class: 'linkbtn', onclick: function () { api('POST', '/orders/' + o.id + '/unfreeze', { dayId: f.id }).then(function () { toast('Kun qaytarildi'); reload(); }).catch(fail); }, text: 'qaytarish' }) : null);
        })) : null,
      h('div', { class: 'acts' }, acts));
  }

  function editOrderForm(o, reload) {
    var O = ME.options;
    var ration = select('ration', O.rations.map(function (r) { return [r.id, lbl('ration', r.id)]; }), o.ration); ration.className = 'inp';
    var sku = h('select', { class: 'inp', name: 'sku' });
    var fill = function (keep) { var r = O.rations.filter(function (x) { return x.id === ration.value; })[0]; clear(sku); r.skus.forEach(function (k) { var op = h('option', { value: k, text: k + ' kkal' }); if (keep && k === o.sku) op.selected = true; sku.appendChild(op); }); };
    fill(true); ration.addEventListener('change', function () { fill(false); });
    var plan = select('plan', O.plans.map(function (p) { return [p.id, lbl('plan', p.id)]; }), o.plan); plan.className = 'inp';
    var days = h('input', { class: 'inp', type: 'number', min: '1', max: '60', value: o.daysTotal });
    plan.addEventListener('change', function () { days.value = O.plans.filter(function (x) { return x.id === plan.value; })[0].days; });
    var started = o.progress && (o.progress.delivered + o.progress.skipped) > 0;
    var start = h('input', { class: 'inp', type: 'date', value: o.startDate, min: ME.today, disabled: started });
    var price = h('input', { class: 'inp', type: 'number', min: '1000', step: '1000', value: o.pricePerDay });
    var district = select('district', [['', '—']].concat(O.districts.map(function (x) { return [x, lbl('district', x)]; })), o.district || ''); district.className = 'inp';
    var address = h('input', { class: 'inp', value: o.address || '', maxlength: '200' });
    var note = h('textarea', { text: o.note || '' });
    var close = modal('Obunani tahrirlash', h('form', { class: 'form', onsubmit: function (e) {
      e.preventDefault();
      var b = {};
      if (ration.value !== o.ration) b.ration = ration.value;
      if (+sku.value !== o.sku) b.sku = +sku.value;
      if (plan.value !== o.plan) b.plan = plan.value;
      if (+days.value !== o.daysTotal || b.plan) b.daysTotal = +days.value;
      if (!started && start.value !== o.startDate) b.startDate = start.value;
      if (+price.value !== o.pricePerDay) b.pricePerDay = +price.value;
      if ((district.value || null) !== (o.district || null)) b.district = district.value || null;
      if (address.value !== (o.address || '')) b.address = address.value;
      if (note.value !== (o.note || '')) b.note = note.value;
      if (!Object.keys(b).length) { close(); return; }
      api('PATCH', '/orders/' + o.id, b).then(function () { close(); toast('Obuna yangilandi'); reload(); }).catch(fail);
    } },
      h('div', { class: 'two' }, h('label', null, 'Rasion', ration), h('label', null, 'Kaloriya', sku)),
      h('div', { class: 'two' }, h('label', null, 'Muddat', plan), h('label', null, 'Jami yetkazish kunlari', days)),
      h('div', { class: 'two' }, h('label', null, started ? 'Boshlanish (yetkazish boshlangan)' : 'Boshlanish sanasi', start), h('label', null, 'Kunlik narx (so‘m)', price)),
      h('span', { class: 'a-sub', text: 'Kunlar sonini o‘zgartirsangiz, obuna oxiriga kun qo‘shiladi yoki oxiridan olinadi; summa qayta hisoblanadi.' }),
      h('div', { class: 'two' }, h('label', null, 'Tuman', district), h('label', null, 'Manzil', address)),
      h('label', null, 'Buyurtma izohi', note),
      h('button', { type: 'submit', class: 'btn btn-hot btn-block', text: 'Saqlash' })), true);
  }

  function freezeForm(o, reload) {
    var from = h('input', { class: 'inp', type: 'date', value: ME.firstEditableDay, min: ME.firstEditableDay });
    var to = h('input', { class: 'inp', type: 'date', value: ME.firstEditableDay, min: ME.firstEditableDay });
    from.addEventListener('change', function () { if (to.value < from.value) to.value = from.value; to.min = from.value; });
    var close = modal('Obunani muzlatish (pauza)', h('form', { class: 'form', onsubmit: function (e) {
      e.preventDefault();
      api('POST', '/orders/' + o.id + '/freeze', { from: from.value, to: to.value }).then(function (r) { close(); toast(r.frozen + ' kun muzlatildi va obuna oxiriga qo‘shildi'); reload(); }).catch(fail);
    } },
      h('div', { class: 'two' }, h('label', null, 'Qaysi kundan', from), h('label', null, 'Qaysi kungacha (shu kun ham)', to)),
      h('ul', { class: 'rules-mini' },
        h('li', { text: 'Ertangi kunni faqat soat 18:00 gacha muzlatish mumkin.' }),
        h('li', { text: 'Muzlatilgan kunlar yo‘qolmaydi — obuna oxiriga qo‘shiladi.' }),
        h('li', { text: 'Muzlatilgan kunni 30 kun ichida ishlatish kerak, keyin kuyadi.' })),
      h('button', { type: 'submit', class: 'btn btn-hot btn-block', text: 'Muzlatish' })));
  }

  // ── 3. Yetkazish: day lists + kitchen + renewals ──
  var deliveryDay = null;
  function viewDelivery(v) {
    if (!deliveryDay) { var t = new Date(ME.today + 'T00:00:00Z'); t.setUTCDate(t.getUTCDate() + 1); deliveryDay = t.toISOString().slice(0, 10); }
    var date = h('input', { class: 'inp', type: 'date', value: deliveryDay, style: 'max-width:200px', 'aria-label': 'Kun', onchange: function (e) { deliveryDay = e.target.value; route(); } });
    v.appendChild(h('div', { class: 'a-h' }, h('h1', { text: 'Yetkazish va uzaytirish' }), h('div', { class: 'acts' }, date,
      h('a', { class: 'btn btn-line btn-xs', href: '/api/admin/delivery.csv?day=' + deliveryDay, text: '⬇ CSV (hammasi)' }))));
    var kitchen = h('div', { class: 'card', style: 'margin-bottom:14px' }), groups = h('div', { class: 'groups' }), renew = h('div', { class: 'list' });
    v.appendChild(kitchen); v.appendChild(groups);
    v.appendChild(h('div', { class: 'a-h', style: 'margin-top:24px' }, h('h1', { text: 'Uzaytirishga qo‘ng‘iroq' }), h('span', { class: 'a-sub', text: 'Obunasi tugashiga 1–2 kun qolganlar' })));
    v.appendChild(renew);

    api('GET', '/delivery?day=' + deliveryDay).then(function (d) {
      // Kitchen: portions per ration and calories, by shift; then allergies / notes.
      add(kitchen, h('h3', { text: 'Oshxona uchun: ' + d.day }));
      if (!d.kitchen.length) kitchen.appendChild(h('div', { class: 'a-sub', text: 'Bu kunga faol yetkazish yo‘q' }));
      else {
        var tot = { morning: 0, evening: 0, total: 0 };
        var tbl = h('table', { class: 'ktable' }, h('thead', null, h('tr', null, h('th', { text: 'Rasion' }), h('th', { text: 'Ertalab' }), h('th', { text: 'Kechki' }), h('th', { text: 'Jami' }))));
        var tb = h('tbody'); tbl.appendChild(tb);
        d.kitchen.forEach(function (k) {
          tot.morning += k.morning; tot.evening += k.evening; tot.total += k.total;
          tb.appendChild(h('tr', null, h('td', { text: lbl('ration', k.ration) + ' ' + k.sku }), h('td', { text: k.morning || '—' }), h('td', { text: k.evening || '—' }), h('th', { text: k.total })));
        });
        tb.appendChild(h('tr', { class: 'ktot' }, h('th', { text: 'Jami' }), h('th', { text: tot.morning }), h('th', { text: tot.evening }), h('th', { text: tot.total })));
        kitchen.appendChild(h('div', { class: 'ktable-wrap' }, tbl));
      }
      if (d.notes.length) kitchen.appendChild(h('div', { class: 'knotes' }, h('b', { text: '⚠ Allergiya va izohlar' }),
        d.notes.map(function (n) { return h('div', { class: 'meta' }, h('span', { text: (n.name || 'Ismsiz') + ' — ' + lbl('ration', n.ration) + ' ' + n.sku + ', ' + (n.deliverySlot === 'evening' ? 'kechki' : 'ertalab') + ':' }), h('b', { text: n.text })); })));

      var canMark = d.day <= d.today;
      [['morning', 'internal'], ['morning', 'external'], ['evening', 'internal'], ['evening', 'external']].forEach(function (g) {
        var rows = d.rows.filter(function (r) { return r.deliverySlot === g[0] && r.courierType === g[1]; });
        var card = h('div', { class: 'card group' }, h('h3', null, h('span', { text: lbl('slot', g[0]) + ' · ' + lbl('courier', g[1]) + ' (' + rows.length + ')' }),
          rows.length ? h('a', { class: 'btn btn-line btn-xs', href: '/api/admin/delivery.csv?day=' + d.day + '&slot=' + g[0] + '&courier=' + g[1], text: 'CSV' }) : null));
        if (!rows.length) card.appendChild(h('div', { class: 'a-sub', text: 'Bo‘sh' }));
        rows.forEach(function (r) {
          var setDay = function (body, msg) { api('PATCH', '/delivery-days/' + r.dayId, body).then(function () { toast(msg); route(); }).catch(fail); };
          var marks = canMark
            ? (r.status === 'delivered' || r.status === 'failed'
              ? [badge(r.status === 'delivered' ? 'active' : 'ending', lbl('day', r.status)), h('button', { type: 'button', class: 'linkbtn', onclick: function () { setDay({ status: 'scheduled' }, 'Belgi olib tashlandi'); }, text: 'bekor qilish' })]
              : [h('button', { type: 'button', class: 'btn btn-soft btn-xs', onclick: function () { setDay({ status: 'delivered' }, 'Yetkazildi'); }, text: '✓ Yetkazildi' }),
                 h('button', { type: 'button', class: 'btn btn-line btn-xs', onclick: function () { setDay({ status: 'failed' }, 'O‘tkazib yuborildi'); }, text: 'O‘tkazib yuborildi' })])
            : [h('span', { class: 'a-sub', text: 'Belgilash yetkazish kuni ochiladi' })];
          card.appendChild(h('div', { class: 'drow' },
            h('div', null,
              h('div', null, h('a', { href: '#c/' + r.customerId, class: 'nm', style: 'font-size:15px;text-decoration:none', text: r.name || 'Ismsiz' }), ' ', phoneLink(r.phone)),
              h('div', { class: 'meta' }, h('span', { text: lbl('ration', r.ration) + ' ' + r.sku }), h('span', { text: place(r.district, r.address) || 'Manzil yo‘q' })),
              r.customerNotes || r.note ? h('div', { class: 'meta warn-note', text: '⚠ ' + [r.customerNotes, r.note].filter(Boolean).join(' · ') }) : null,
              h('div', { class: 'row', style: 'margin-top:6px' }, marks)),
            h('div', { class: 'dsel' },
              select('deliverySlot', [['morning', 'Ertalab'], ['evening', 'Kechki']], r.deliverySlot, function (e) { setDay({ deliverySlot: e.target.value }, 'Smena o‘zgardi (faqat shu kun)'); }),
              select('courierType', [['internal', 'Ichki'], ['external', 'Tashqi']], r.courierType, function (e) { setDay({ courierType: e.target.value }, 'Kuryer o‘zgardi (faqat shu kun)'); }))));
        });
        groups.appendChild(card);
      });
    }).catch(fail);

    api('GET', '/renewals').then(function (d) {
      if (!d.items.length) { renew.appendChild(h('div', { class: 'empty', text: 'Hozircha tugayotgan obuna yo‘q' })); return; }
      d.items.forEach(function (r) {
        renew.appendChild(h('div', { class: 'item' },
          h('div', { class: 'row sp' }, h('div', { class: 'row' }, h('a', { href: '#c/' + r.customerId, class: 'nm', style: 'text-decoration:none', text: r.name || 'Ismsiz' }), phoneLink(r.phone)), badge('ending', 'Qoldi: ' + r.remaining + ' kun')),
          h('div', { class: 'meta' }, h('span', { text: lbl('ration', r.ration) + ' ' + r.sku + ' · ' + lbl('plan', r.plan) }), h('span', { text: 'Oxirgi kun: ' + r.lastDay }), r.lastContactAt ? h('span', { text: 'Oxirgi aloqa: ' + when(r.lastContactAt) }) : null),
          h('div', { class: 'acts' }, h('button', { type: 'button', class: 'btn btn-soft btn-xs', onclick: function () { callForm(r.customerId, null, route); }, text: '📞 Qo‘ng‘iroq natijasi' }))));
      });
    }).catch(fail);
  }

  // ── Xodimlar (owner) ──
  function viewStaff(v) {
    if (ME.role !== 'owner') { location.hash = '#inbox'; return; }
    var name = h('input', { class: 'inp', placeholder: 'Ism', maxlength: '60' });
    var tgId = h('input', { class: 'inp', placeholder: 'Telegram ID', inputmode: 'numeric' });
    var role = select('role', [['manager', 'Menejer'], ['owner', 'Admin']], 'manager'); role.className = 'inp';
    var list = h('div', { class: 'list' });
    v.appendChild(h('div', { class: 'a-h' }, h('h1', { text: 'Xodimlar' })));
    v.appendChild(h('form', { class: 'card form', style: 'margin-bottom:14px', onsubmit: function (e) {
      e.preventDefault();
      api('POST', '/staff', { name: name.value, telegramChatId: tgId.value, role: role.value }).then(function () { toast('Qo‘shildi — endi u botga /login yozsin'); route(); }).catch(fail);
    } }, h('h3', { text: 'Xodim qo‘shish' }),
      h('div', { class: 'two' }, h('label', null, 'Ism', name), h('label', null, 'Telegram ID', tgId)),
      h('span', { class: 'a-sub', text: 'Telegram ID: xodim botga /login yozganda bot uni ko‘rsatadi (faqat raqamlar).' }),
      h('label', null, 'Rol', role), h('button', { type: 'submit', class: 'btn btn-hot btn-xs', text: 'Qo‘shish' })));
    v.appendChild(list);
    api('GET', '/staff').then(function (d) {
      d.items.forEach(function (s) {
        var me = s.id === ME.id;
        var controls = me ? [h('span', { class: 'a-sub', text: 'Siz' })] : [
          select('role', [['manager', 'Menejer'], ['owner', 'Admin']], s.role, function (e) { api('PATCH', '/staff/' + s.id, { role: e.target.value }).then(function () { toast('Rol o‘zgardi'); route(); }).catch(fail); }),
          h('button', { type: 'button', class: 'btn btn-line btn-xs', onclick: function () {
            confirmBox(s.active ? 'Faolsizlantirish' : 'Faollashtirish', s.active ? s.name + ' CRM’ga kira olmaydi (sessiyasi darhol tugaydi).' : s.name + ' yana /login orqali kira oladi.', s.active ? 'Faolsizlantirish' : 'Faollashtirish', function () {
              api('PATCH', '/staff/' + s.id, { active: !s.active }).then(route).catch(fail);
            }, s.active);
          }, text: s.active ? 'Faolsizlantirish' : 'Faollashtirish' }),
          !s.active ? h('button', { type: 'button', class: 'btn btn-danger-line btn-xs', onclick: function () { confirmBox('Xodimni o‘chirish', s.name + ' ro‘yxatdan butunlay o‘chiriladi.', 'O‘chirish', function () { api('DELETE', '/staff/' + s.id).then(function () { toast('O‘chirildi'); route(); }).catch(fail); }, true); }, text: 'O‘chirish' }) : null];
        list.appendChild(h('div', { class: 'item' }, h('div', { class: 'row sp' },
          h('div', { class: 'row' }, h('span', { class: 'nm', text: s.name }), badge(s.active ? 'active' : 'finished', s.active ? (s.role === 'owner' ? 'Admin' : 'Menejer') : 'Faol emas'), h('span', { class: 'a-sub', text: 'TG ' + s.telegramChatId })),
          h('div', { class: 'row' }, controls))));
      });
    }).catch(fail);
  }

  // ── boot ──
  api('GET', '/me').then(function (me) {
    ME = me; shell(); route();
    window.addEventListener('hashchange', route);
  }).catch(function (e) { if (e.message !== 'auth') { clear(root).appendChild(h('div', { class: 'login' }, h('h1', { text: 'Xatolik' }), h('p', { text: e.message }))); } });
})();
