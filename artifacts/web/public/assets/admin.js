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
        if (!r.ok) throw new Error(j.error || 'Xatolik');
        return j;
      });
    });
  }
  function toast(msg, err) {
    var t = h('div', { class: 'toast' + (err ? ' err' : ''), role: 'status', text: msg });
    document.body.appendChild(t); setTimeout(function () { t.remove(); }, 2600);
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
    source: { web: 'Sayt', mobile_app: 'Ilova', phone: 'Telefon', telegram: 'Telegram' },
    district: { bektemir: 'Bektemir', chilonzor: 'Chilonzor', mirobod: 'Mirobod', mirzo_ulugbek: 'Mirzo Ulug‘bek', olmazor: 'Olmazor', sergeli: 'Sergeli', shayxontohur: 'Shayxontohur', uchtepa: 'Uchtepa', yakkasaroy: 'Yakkasaroy', yangihayot: 'Yangihayot', yashnobod: 'Yashnobod', yunusobod: 'Yunusobod', other: 'Boshqa / viloyat' },
    event: { call: '📞 Qo‘ng‘iroq', note: '📝 Izoh', lead: '🌐 Ariza', lead_status: '↪ Ariza holati', order_created: '🧾 Buyurtma yaratildi', order_updated: '✏️ Buyurtma o‘zgardi', delivery_change: '🚚 Yetkazish o‘zgardi' }
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

  var ME = null, root = document.getElementById('app');

  // ── modal ──
  function modal(title, body, wide) {
    var m = h('div', { class: 'modal open' });
    var close = function () { m.remove(); document.body.classList.remove('noscroll'); };
    m.appendChild(h('div', { class: 'scrim', onclick: close }));
    m.appendChild(h('div', { class: 'sheet' + (wide ? ' wide' : ''), role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
      h('div', { class: 'grab' }),
      h('div', { class: 'sheet-h' }, h('b', { class: 'nm', text: title }), h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Yopish', onclick: close, text: '✕' })),
      h('div', { style: 'margin-top:14px' }, body)));
    document.body.appendChild(m); document.body.classList.add('noscroll');
    var f = m.querySelector('input,select,textarea'); if (f) setTimeout(function () { f.focus(); }, 30);
    document.addEventListener('keydown', function esc(e) { if (e.key === 'Escape') { close(); document.removeEventListener('keydown', esc); } });
    return close;
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
        h('span', { class: 'a-user' }, ME.name + ' · ' + (ME.role === 'owner' ? 'admin' : 'menejer'),
          h('form', { method: 'post', action: '/admin/logout' }, h('button', { type: 'submit', class: 'btn btn-line btn-xs', text: 'Chiqish' })))),
      h('nav', { class: 'a-tabs', 'aria-label': 'Bo‘limlar' }, tabs.map(function (t) {
        return h('a', { class: 'tab', href: '#' + t[0], 'data-view': t[0], 'aria-selected': 'false' }, t[1], t[0] === 'inbox' ? h('span', { class: 'cnt js-inbox-cnt', hidden: true }) : null);
      }))));
    root.appendChild(h('main', { class: 'a-main', id: 'view' }));
  }

  function route() {
    var hash = (location.hash || '#inbox').slice(1), parts = hash.split('/');
    var view = parts[0] === 'c' ? 'customers' : parts[0];
    if (!['inbox', 'customers', 'delivery', 'staff'].includes(view)) view = 'inbox';
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
    if (l.district || l.address) meta.push([lbl('district', l.district), l.address].filter(function (x) { return x && x !== '—'; }).join(', '));
    if (l.utmSource) meta.push('UTM: ' + [l.utmSource, l.utmCampaign].filter(Boolean).join(' / '));
    return h('div', { class: 'item' },
      h('div', { class: 'row sp' },
        h('div', { class: 'row' }, h('span', { class: 'nm', text: l.name || 'Ismsiz' }), phoneLink(l.phone)),
        h('div', { class: 'row' }, badge(l.status, lbl('lead', l.status)), h('span', { class: 'a-sub', text: when(l.createdAt) }))),
      h('div', { class: 'row' }, badge('contacted', lbl('intent', l.intent)), l.healthRisk ? badge('risk', '⚠ Sog‘liq cheklovi') : null, l.lang === 'ru' ? badge('finished', 'RU') : null),
      meta.length ? h('div', { class: 'meta' }, meta.map(function (m) { return h('span', { text: m }); })) : null,
      h('div', { class: 'acts' },
        h('button', { type: 'button', class: 'btn btn-hot btn-xs', onclick: function () { orderForm({ customerId: l.customerId, leadId: l.id, source: 'web', ration: l.ration, sku: l.sku, plan: l.plan, deliverySlot: l.deliverySlot, district: l.district, address: l.address }, route); }, text: 'Buyurtma yaratish' }),
        h('button', { type: 'button', class: 'btn btn-soft btn-xs', onclick: function () { callForm(l.customerId, l.id, route); }, text: '📞 Qo‘ng‘iroq natijasi' }),
        l.customerId ? h('a', { class: 'btn btn-line btn-xs', href: '#c/' + l.customerId, text: 'Mijoz kartasi' }) : null,
        l.status !== 'lost' ? h('button', { type: 'button', class: 'btn btn-line btn-xs', onclick: function () { api('POST', '/leads/' + l.id + '/status', { status: 'lost' }).then(route).catch(fail); }, text: 'Rad etildi' }) : null));
  }

  function callForm(customerId, leadId, done) {
    if (!customerId) { toast('Mijoz topilmadi', true); return; }
    var outcome = select('outcome', [['Gaplashildi', 'Gaplashildi'], ['Javob bermadi', 'Javob bermadi'], ['Qayta qo‘ng‘iroq', 'Keyinroq qo‘ng‘iroq qilish'], ['O‘ylab ko‘radi', 'O‘ylab ko‘radi'], ['Rad etdi', 'Rad etdi']], 'Gaplashildi');
    outcome.className = 'inp';
    var note = h('textarea', { name: 'body', placeholder: 'Nima kelishildi? (ixtiyoriy)' });
    var close = modal('Qo‘ng‘iroq natijasi', h('form', { class: 'form', onsubmit: function (e) {
      e.preventDefault();
      api('POST', '/customers/' + customerId + '/events', { type: 'call', outcome: outcome.value, body: note.value, leadId: leadId }).then(function () { close(); toast('Saqlandi'); done && done(); }).catch(fail);
    } }, h('label', null, 'Natija', outcome), h('label', null, 'Izoh', note), h('button', { type: 'submit', class: 'btn btn-hot btn-block', text: 'Saqlash' })));
  }

  // ── order form (new subscription; also for phone orders) ──
  function orderForm(pre, done) {
    if (!pre.customerId) { toast('Avval mijozni tanlang', true); return; }
    var O = ME.options, P = ME.pricing;
    var ration = select('ration', O.rations.map(function (r) { return [r.id, lbl('ration', r.id)]; }), pre.ration || 'balans');
    var sku = h('select', { class: 'inp', name: 'sku' });
    var plan = select('plan', O.plans.map(function (p) { return [p.id, lbl('plan', p.id)]; }), pre.plan || 'w1');
    var start = h('input', { class: 'inp', type: 'date', name: 'startDate', value: ME.defaultStart, required: true });
    var slot = select('deliverySlot', opts('slot', ['morning', 'evening']), pre.deliverySlot || 'morning');
    var courier = select('courierType', opts('courier', ['internal', 'external']), pre.courierType || 'internal');
    var district = select('district', [['', 'Tanlang']].concat(O.districts.map(function (d) { return [d, lbl('district', d)]; })), pre.district || '');
    var address = h('input', { class: 'inp', name: 'address', maxlength: '200', value: pre.address || '', placeholder: 'Ko‘cha, uy, mo‘ljal' });
    var price = h('input', { class: 'inp', type: 'number', name: 'pricePerDay', min: '1000', step: '1000' });
    var pay = select('paymentStatus', opts('pay', ['unpaid', 'pending', 'paid']), 'unpaid');
    var source = select('source', opts('source', O.sources), pre.source || 'phone');
    var note = h('textarea', { name: 'note', placeholder: 'Allergiya, domofon, qo‘shimcha talablar…' });
    var sum = h('div', { class: 'sum' });
    [ration, plan, slot, courier, district, pay, source].forEach(function (s) { s.className = 'inp'; });
    function fillSku() {
      var r = O.rations.filter(function (x) { return x.id === ration.value; })[0];
      clear(sku); r.skus.forEach(function (k) { var o = h('option', { value: k, text: k + ' kkal' }); if (+pre.sku === k) o.selected = true; sku.appendChild(o); });
      price.placeholder = fmt(P.prices[ration.value]) + ' (standart)';
    }
    function recalc() {
      var p = O.plans.filter(function (x) { return x.id === plan.value; })[0], per = +price.value || P.prices[ration.value], disc = P.discounts[plan.value] || 0;
      var total = Math.round(p.days * per * (1 - disc / 100) / 1000) * 1000;
      clear(sum); add(sum, [p.days + ' kun × ' + fmt(per) + ' so‘m' + (disc ? ' − ' + disc + '%' : '') + ' = ', h('b', { text: fmt(total) + ' so‘m' })]);
    }
    ration.addEventListener('change', function () { pre.sku = null; fillSku(); recalc(); });
    plan.addEventListener('change', recalc); price.addEventListener('input', recalc);
    fillSku(); recalc();
    var hint = ME.cutoffPassed ? 'Soat 18:00 o‘tdi — standart boshlanish indinga qo‘yildi.' : 'Standart: ertadan (18:00 gacha). Yakshanba yetkazilmaydi.';
    var close = modal('Yangi buyurtma', h('form', { class: 'form', onsubmit: function (e) {
      e.preventDefault();
      var body = { customerId: pre.customerId, leadId: pre.leadId || null, ration: ration.value, sku: +sku.value, plan: plan.value, startDate: start.value, deliverySlot: slot.value, courierType: courier.value, district: district.value || null, address: address.value, paymentStatus: pay.value, source: source.value, note: note.value };
      if (price.value) body.pricePerDay = +price.value;
      api('POST', '/orders', body).then(function () { close(); toast('Buyurtma yaratildi'); done && done(); }).catch(fail);
    } },
      h('div', { class: 'two' }, h('label', null, 'Rasion', ration), h('label', null, 'Kaloriya', sku)),
      h('div', { class: 'two' }, h('label', null, 'Muddat', plan), h('label', null, 'Boshlanish sanasi', start)),
      h('span', { class: 'a-sub', text: hint }),
      h('div', { class: 'two' }, h('label', null, 'Yetkazish vaqti', slot), h('label', null, 'Kuryer', courier)),
      h('div', { class: 'two' }, h('label', null, 'Tuman', district), h('label', null, 'Manzil', address)),
      h('div', { class: 'two' }, h('label', null, 'Kunlik narx (ixtiyoriy)', price), h('label', null, 'To‘lov', pay)),
      h('label', null, 'Manba', source), h('label', null, 'Izoh', note), sum,
      h('button', { type: 'submit', class: 'btn btn-hot btn-block', text: 'Buyurtmani saqlash' })), true);
  }

  // ── 2. Mijozlar ──
  var lastQuery = '';
  function viewCustomers(v) {
    var q = h('input', { class: 'inp', type: 'search', placeholder: 'Telefon yoki ism bo‘yicha qidirish', value: lastQuery, 'aria-label': 'Qidirish' });
    var list = h('div', { class: 'list' });
    v.appendChild(h('div', { class: 'a-h' }, h('h1', { text: 'Mijozlar va obunalar' }),
      h('button', { type: 'button', class: 'btn btn-hot btn-xs', onclick: newCustomerForm, text: '+ Telefon buyurtma' })));
    v.appendChild(h('div', { class: 'toolbar' }, q));
    v.appendChild(list);
    var timer;
    function load() {
      lastQuery = q.value.trim();
      api('GET', '/customers' + (lastQuery ? '?q=' + encodeURIComponent(lastQuery) : '')).then(function (d) {
        clear(list);
        if (!d.items.length) { list.appendChild(h('div', { class: 'empty', text: lastQuery ? 'Topilmadi' : 'Hozircha mijoz yo‘q' })); return; }
        d.items.forEach(function (c) {
          var o = c.order;
          list.appendChild(h('a', { class: 'item click', href: '#c/' + c.id, style: 'text-decoration:none' },
            h('div', { class: 'row sp' }, h('div', { class: 'row' }, h('span', { class: 'nm', text: c.name || 'Ismsiz' }), h('span', { class: 'ph', text: fmtPhone(c.phone) })),
              o ? badge(o.status, lbl('order', o.status)) : badge('finished', 'Buyurtma yo‘q')),
            o ? h('div', { class: 'meta' }, h('span', { text: lbl('ration', o.ration) + ' ' + o.sku + ' · ' + lbl('plan', o.plan) }),
              o.progress ? h('span', { text: 'Qoldi: ' + o.progress.remaining + ' / ' + o.daysTotal + ' kun' }) : null,
              h('span', { text: lbl('pay', o.paymentStatus) }), h('span', { text: lbl('slot', o.deliverySlot) })) : h('div', { class: 'meta', text: lbl('source', c.firstSource) + ' · ' + when(c.createdAt) })));
        });
      }).catch(fail);
    }
    q.addEventListener('input', function () { clearTimeout(timer); timer = setTimeout(load, 300); });
    load();
  }

  function newCustomerForm() {
    var phone = h('input', { class: 'inp', name: 'phone', inputmode: 'tel', placeholder: '90 123 45 67', required: true });
    var name = h('input', { class: 'inp', name: 'name', maxlength: '60' });
    var district = select('district', [['', 'Tanlang']].concat(ME.options.districts.map(function (d) { return [d, lbl('district', d)]; })), ''); district.className = 'inp';
    var address = h('input', { class: 'inp', name: 'address', maxlength: '200' });
    var slot = select('deliverySlot', opts('slot', ['morning', 'evening']), 'morning'); slot.className = 'inp';
    var close = modal('Telefon orqali yangi mijoz', h('form', { class: 'form', onsubmit: function (e) {
      e.preventDefault();
      api('POST', '/customers', { phone: phone.value, name: name.value, district: district.value || null, address: address.value, deliverySlot: slot.value, source: 'phone' }).then(function (d) {
        close();
        api('POST', '/customers/' + d.customer.id + '/events', { type: 'call', outcome: 'Kiruvchi qo‘ng‘iroq', body: '' }).catch(function () {});
        orderForm({ customerId: d.customer.id, source: 'phone', deliverySlot: slot.value, district: district.value, address: address.value }, function () { location.hash = '#c/' + d.customer.id; });
      }).catch(fail);
    } },
      h('label', null, 'Telefon (+998)', phone), h('label', null, 'Ism', name),
      h('div', { class: 'two' }, h('label', null, 'Tuman', district), h('label', null, 'Yetkazish vaqti', slot)),
      h('label', null, 'Manzil', address),
      h('span', { class: 'a-sub', text: 'Bu raqam bazada bo‘lsa, mavjud mijoz ochiladi (dublikat bo‘lmaydi).' }),
      h('button', { type: 'submit', class: 'btn btn-hot btn-block', text: 'Davom etish → buyurtma' })));
  }

  function viewCustomer(v, id) {
    v.appendChild(h('div', { class: 'empty', text: 'Yuklanmoqda…' }));
    api('GET', '/customers/' + id).then(function (d) {
      clear(v);
      var c = d.customer, reload = function () { viewCustomer(clear(v), id); };
      v.appendChild(h('div', { class: 'a-h' },
        h('div', null, h('a', { href: '#customers', class: 'a-sub', text: '← Mijozlar' }), h('h1', { text: c.name || 'Ismsiz' })),
        h('div', { class: 'acts' }, phoneLink(c.phone),
          h('button', { type: 'button', class: 'btn btn-soft btn-xs', onclick: function () { callForm(c.id, null, reload); }, text: '📞 Qo‘ng‘iroq' }),
          h('button', { type: 'button', class: 'btn btn-hot btn-xs', onclick: function () { orderForm({ customerId: c.id, source: 'phone', deliverySlot: c.deliverySlot, district: c.district, address: c.address }, reload); }, text: '+ Buyurtma' }))));

      // info card (editable)
      var name = h('input', { class: 'inp', value: c.name || '', maxlength: '60' });
      var district = select('district', [['', '—']].concat(ME.options.districts.map(function (x) { return [x, lbl('district', x)]; })), c.district || ''); district.className = 'inp';
      var address = h('input', { class: 'inp', value: c.address || '', maxlength: '200' });
      var slot = select('slot', [['', '—']].concat(opts('slot', ['morning', 'evening'])), c.deliverySlot || ''); slot.className = 'inp';
      var notes = h('textarea', { text: c.notes || '' });
      var info = h('form', { class: 'card form', onsubmit: function (e) {
        e.preventDefault();
        api('PATCH', '/customers/' + c.id, { name: name.value, district: district.value || null, address: address.value, deliverySlot: slot.value || null, notes: notes.value }).then(function () { toast('Saqlandi'); }).catch(fail);
      } }, h('h3', { text: 'Mijoz' }),
        h('label', null, 'Ism', name), h('div', { class: 'two' }, h('label', null, 'Tuman', district), h('label', null, 'Yetkazish vaqti', slot)),
        h('label', null, 'Manzil', address), h('label', null, 'Izohlar', notes),
        h('div', { class: 'meta' }, h('span', { text: 'Manba: ' + lbl('source', c.firstSource) }), c.utmSource ? h('span', { text: 'UTM: ' + c.utmSource + (c.utmCampaign ? ' / ' + c.utmCampaign : '') }) : null, h('span', { text: 'Qo‘shilgan: ' + when(c.createdAt) })),
        h('button', { type: 'submit', class: 'btn btn-soft btn-xs', text: 'Saqlash' }));

      // orders
      var orders = h('div', { class: 'card' }, h('h3', { text: 'Obunalar' }));
      if (!d.orders.length) orders.appendChild(h('div', { class: 'a-sub', text: 'Hali buyurtma yo‘q' }));
      d.orders.forEach(function (o) { orders.appendChild(orderBlock(o, reload)); });

      // history
      var note = h('input', { class: 'inp', placeholder: 'Izoh qo‘shish…', maxlength: '2000' });
      var tl = h('ul', { class: 'tl' });
      d.events.forEach(function (e) {
        tl.appendChild(h('li', null, h('div', null, h('div', null, h('b', { text: lbl('event', e.type) + ' ' }), h('span', { text: e.body ? (e.type === 'lead' ? lbl('intent', e.body) : e.type === 'lead_status' ? lbl('lead', e.body) : e.body) : '' })),
          h('div', { class: 't', text: when(e.createdAt) + (e.staffName ? ' · ' + e.staffName : '') }))));
      });
      var hist = h('div', { class: 'card' }, h('h3', { text: 'Tarix' }),
        h('form', { class: 'toolbar', onsubmit: function (e) { e.preventDefault(); if (!note.value.trim()) return; api('POST', '/customers/' + c.id + '/events', { type: 'note', body: note.value }).then(reload).catch(fail); } }, note, h('button', { type: 'submit', class: 'btn btn-soft btn-xs', text: 'Qo‘shish' })),
        tl);

      v.appendChild(h('div', { class: 'grid2' }, h('div', { class: 'list' }, info, hist), orders));
    }).catch(fail);
  }

  function orderBlock(o, reload) {
    var p = o.progress || { remaining: 0, delivered: 0, frozen: 0 };
    var patch = function (field) { return function (e) { var b = {}; b[field] = e.target.value; api('PATCH', '/orders/' + o.id, b).then(function () { toast('Saqlandi'); reload(); }).catch(fail); }; };
    var done = Math.min(100, Math.round(p.delivered / Math.max(1, o.daysTotal) * 100));
    return h('div', { class: 'item', style: 'margin-top:10px' },
      h('div', { class: 'row sp' }, h('b', { class: 'nm', text: lbl('ration', o.ration) + ' ' + o.sku + ' kkal · ' + lbl('plan', o.plan) }), badge(o.status, lbl('order', o.status))),
      h('div', { class: 'prog-bar', 'aria-hidden': 'true' }, h('i', { style: 'width:' + done + '%' })),
      h('div', { class: 'meta' },
        h('span', { text: 'Boshlanish: ' + o.startDate }), h('span', { text: 'Qoldi: ' + p.remaining + ' kun' }), h('span', { text: 'Yetkazildi: ' + p.delivered }),
        p.frozen ? h('span', { text: 'Muzlatilgan: ' + p.frozen }) : null, p.lastDay ? h('span', { text: 'Oxirgi kun: ' + p.lastDay }) : null,
        h('span', { text: fmt(o.amount) + ' so‘m' + (o.paidAmount ? ' (to‘langan ' + fmt(o.paidAmount) + ')' : '') }), h('span', { text: lbl('source', o.source) })),
      h('div', { class: 'row' },
        select('crmStatus', opts('order', ME.options.orderStatuses), o.crmStatus, patch('crmStatus')),
        select('paymentStatus', opts('pay', ME.options.paymentStatuses), o.paymentStatus, patch('paymentStatus')),
        select('deliverySlot', opts('slot', ['morning', 'evening']), o.deliverySlot, patch('deliverySlot')),
        select('courierType', opts('courier', ['internal', 'external']), o.courierType, patch('courierType'))),
      o.address || o.district ? h('div', { class: 'meta', text: [lbl('district', o.district), o.address].filter(function (x) { return x && x !== '—'; }).join(', ') }) : null,
      o.note ? h('div', { class: 'meta', text: '📝 ' + o.note }) : null);
  }

  // ── 3. Yetkazish: tomorrow's lists + renewals ──
  var deliveryDay = null;
  function viewDelivery(v) {
    if (!deliveryDay) { var t = new Date(ME.today + 'T00:00:00Z'); t.setUTCDate(t.getUTCDate() + 1); deliveryDay = t.toISOString().slice(0, 10); }
    var date = h('input', { class: 'inp', type: 'date', value: deliveryDay, style: 'max-width:200px', onchange: function (e) { deliveryDay = e.target.value; route(); } });
    v.appendChild(h('div', { class: 'a-h' }, h('h1', { text: 'Yetkazish va uzaytirish' }), h('div', { class: 'acts' }, date,
      h('a', { class: 'btn btn-line btn-xs', href: '/api/admin/delivery.csv?day=' + deliveryDay, text: '⬇ CSV (hammasi)' }))));
    var kitchen = h('div', { class: 'kitchen' }), groups = h('div', { class: 'groups' }), renew = h('div', { class: 'list' });
    v.appendChild(h('div', { class: 'card', style: 'margin-bottom:14px' }, h('h3', { text: 'Oshxona uchun: ' + deliveryDay }), kitchen));
    v.appendChild(groups);
    v.appendChild(h('div', { class: 'a-h', style: 'margin-top:24px' }, h('h1', { text: 'Uzaytirishga qo‘ng‘iroq' }), h('span', { class: 'a-sub', text: 'Obunasi tugashiga 1–2 kun qolganlar' })));
    v.appendChild(renew);

    api('GET', '/delivery?day=' + deliveryDay).then(function (d) {
      var skus = Object.keys(d.kitchen).sort();
      if (!skus.length) kitchen.appendChild(h('span', { text: 'Bu kunga faol yetkazish yo‘q' }));
      var total = 0;
      skus.forEach(function (k) { total += d.kitchen[k]; kitchen.appendChild(h('span', null, k + ' kkal: ', h('b', { text: d.kitchen[k] }))); });
      if (total) kitchen.appendChild(h('span', null, 'Jami: ', h('b', { text: total })));
      [['morning', 'internal'], ['morning', 'external'], ['evening', 'internal'], ['evening', 'external']].forEach(function (g) {
        var rows = d.rows.filter(function (r) { return r.deliverySlot === g[0] && r.courierType === g[1]; });
        var card = h('div', { class: 'card group' }, h('h3', null, h('span', { text: lbl('slot', g[0]) + ' · ' + lbl('courier', g[1]) + ' (' + rows.length + ')' }),
          rows.length ? h('a', { class: 'btn btn-line btn-xs', href: '/api/admin/delivery.csv?day=' + d.day + '&slot=' + g[0] + '&courier=' + g[1], text: 'CSV' }) : null));
        if (!rows.length) card.appendChild(h('div', { class: 'a-sub', text: 'Bo‘sh' }));
        rows.forEach(function (r) {
          card.appendChild(h('div', { class: 'drow' },
            h('div', null, h('div', null, h('a', { href: '#c/' + r.customerId, class: 'nm', style: 'font-size:15px;text-decoration:none', text: r.name || 'Ismsiz' }), ' ', phoneLink(r.phone)),
              h('div', { class: 'meta' }, h('span', { text: r.sku + ' kkal' }), h('span', { text: [lbl('district', r.district), r.address].filter(function (x) { return x && x !== '—'; }).join(', ') || 'Manzil yo‘q' }), r.note ? h('span', { text: '📝 ' + r.note }) : null)),
            select('courierType', [['internal', 'Ichki'], ['external', 'Tashqi']], r.courierType, function (e) {
              api('PATCH', '/delivery-days/' + r.dayId, { courierType: e.target.value }).then(function () { toast('Kuryer o‘zgardi'); route(); }).catch(fail);
            })));
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
    var tgId = h('input', { class: 'inp', placeholder: 'Telegram ID (bot /login yozganda ko‘rsatadi)', inputmode: 'numeric' });
    var role = select('role', [['manager', 'Menejer'], ['owner', 'Admin']], 'manager'); role.className = 'inp';
    var list = h('div', { class: 'list' });
    v.appendChild(h('div', { class: 'a-h' }, h('h1', { text: 'Xodimlar' })));
    v.appendChild(h('form', { class: 'card form', style: 'margin-bottom:14px', onsubmit: function (e) {
      e.preventDefault();
      api('POST', '/staff', { name: name.value, telegramChatId: tgId.value, role: role.value }).then(function () { toast('Qo‘shildi — endi u botga /login yozsin'); route(); }).catch(fail);
    } }, h('h3', { text: 'Xodim qo‘shish' }), h('div', { class: 'two' }, name, tgId), role, h('button', { type: 'submit', class: 'btn btn-hot btn-xs', text: 'Qo‘shish' })));
    v.appendChild(list);
    api('GET', '/staff').then(function (d) {
      d.items.forEach(function (s) {
        list.appendChild(h('div', { class: 'item' }, h('div', { class: 'row sp' },
          h('div', { class: 'row' }, h('span', { class: 'nm', text: s.name }), badge(s.active ? 'active' : 'finished', s.role === 'owner' ? 'Admin' : 'Menejer'), h('span', { class: 'a-sub', text: 'TG ' + s.telegramChatId })),
          s.id !== ME.id ? h('button', { type: 'button', class: 'btn btn-line btn-xs', onclick: function () { api('PATCH', '/staff/' + s.id, { active: !s.active }).then(route).catch(fail); }, text: s.active ? 'O‘chirish' : 'Yoqish' }) : h('span', { class: 'a-sub', text: 'Siz' }))));
      });
    }).catch(fail);
  }

  // ── boot ──
  api('GET', '/me').then(function (me) {
    ME = me; shell(); route();
    window.addEventListener('hashchange', route);
  }).catch(function (e) { if (e.message !== 'auth') { clear(root).appendChild(h('div', { class: 'login' }, h('h1', { text: 'Xatolik' }), h('p', { text: e.message }))); } });
})();
