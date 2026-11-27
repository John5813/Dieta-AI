/* kaloria.uz — website checkout: delivery point (GPS or a pin on the map) → Tashkent check → Payme / Click / Uzum.
 * Used by the order modal (site.js) and the calculator result (quiz.js). The server re-checks the point
 * against the Tashkent city boundary; payment opens only for a point inside the city. */
(function () {
  'use strict';
  var K = window.K;
  var LEAFLET = {
    js: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js',
    jsSri: 'sha512-puJW3E/qXDqYp9IfhAI54BJEaWIfloJ7JWs7OeD5i6ruC9JZL1gERT1wjtwXFlh7CjE7ZJ+/vcRZRkIYIb6p4g==',
    css: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css',
    cssSri: 'sha512-h9FcoyWjHcOcmEVkxOfTLnmZFWIH0iZhZT1H2TbOq55xssQGEJHEaIm+PgoUaZbRvQTNTluNOEfb1ZRy6D3BOw=='
  };
  var T = {
    uz: {
      geoH: 'O‘zingiz joylashuvingizni ko‘rsating', geoP: 'Yetkazib berish faqat Toshkent shahri ichida. To‘lovdan oldin yetkazish nuqtasini tekshiramiz.',
      gps: '📍 Mening hozirgi joylashuvimni aniqlash', map: '🗺 Yoki xaritadan yetkazish joyini belgilang', mapHint: 'Uyingiz yoki ishxonangiz joylashgan nuqtani xaritada bosing (belgini surish mumkin).',
      locating: 'Joylashuv aniqlanmoqda…', checking: 'Tekshirilmoqda…', confirm: 'Shu nuqtaga yetkazish — tasdiqlash', back: 'Orqaga',
      pinIn: '✓ Toshkent shahri ichida', pinOut: '✕ Toshkent shahridan tashqarida', pinNone: 'Xaritada nuqtani tanlang',
      outH: 'Hududingiz Toshkent shahri maydoniga kirmaydi — menejer sizga telefon qiladi.',
      pinOutH: 'Belgilangan nuqta Toshkent shahri maydoniga kirmaydi — menejer sizga telefon qiladi.',
      deniedH: 'Joylashuvni aniqlab bo‘lmadi — menejer sizga telefon qiladi.',
      sent: 'Arizangiz va joylashuv menejerga yuborildi. Onlayn to‘lov faqat Toshkent shahri ichidagi manzil uchun.',
      inside2: 'Yetkazish manzilingiz Toshkent ichida bo‘lsa (uy yoki ishxona), uni xaritada belgilang — darhol to‘lovga o‘tasiz.',
      pickOther: '🗺 Xaritadan Toshkent ichidagi manzilni belgilash', retry: '📍 Qayta aniqlash',
      okPoint: '✓ Yetkazish nuqtasi Toshkent shahri ichida', change: 'Nuqtani o‘zgartirish',
      payH: 'To‘lov usulini tanlang', total: 'To‘lanadi', demo: 'Demo rejim: haqiqiy pul yechilmaydi — tugmani bossangiz to‘lov darhol tasdiqlanadi.',
      paying: 'To‘lov amalga oshirilmoqda…',
      doneH: 'To‘lov muvaffaqiyatli (demo)! Siz ro‘yxatdan o‘tdingiz.', doneLive: 'To‘lov muvaffaqiyatli! Siz ro‘yxatdan o‘tdingiz.',
      doneP: 'Obunangiz faollashtirildi. Menejer birinchi yetkazishdan oldin siz bilan bog‘lanadi.',
      order: 'Buyurtma', start: 'Boshlanish', slot: 'Yetkazish vaqti', paidBy: 'To‘lov', amount: 'Summa', point: 'Yetkazish nuqtasi',
      morning: 'Ertalab 08:00–10:00', evening: 'Kechqurun 18:00–22:30', days: 'kun',
      noGeo: 'Brauzeringiz joylashuvni aniqlay olmaydi.', mapFail: 'Xaritani yuklab bo‘lmadi. Internetni tekshirib qayta urinib ko‘ring.', err: 'Xatolik. Qaytadan urinib ko‘ring.'
    },
    ru: {
      geoH: 'Укажите своё местоположение', geoP: 'Доставляем только по городу Ташкенту. Перед оплатой проверим точку доставки.',
      gps: '📍 Определить моё местоположение', map: '🗺 Или отметьте место доставки на карте', mapHint: 'Нажмите на карте точку дома или работы (метку можно перетащить).',
      locating: 'Определяем местоположение…', checking: 'Проверяем…', confirm: 'Доставить в эту точку — подтвердить', back: 'Назад',
      pinIn: '✓ В пределах города Ташкента', pinOut: '✕ За пределами Ташкента', pinNone: 'Выберите точку на карте',
      outH: 'Ваш адрес не входит в территорию города Ташкента — менеджер вам позвонит.',
      pinOutH: 'Отмеченная точка не входит в территорию города Ташкента — менеджер вам позвонит.',
      deniedH: 'Не удалось определить местоположение — менеджер вам позвонит.',
      sent: 'Заявка и местоположение отправлены менеджеру. Онлайн-оплата доступна только для адреса в Ташкенте.',
      inside2: 'Если адрес доставки в Ташкенте (дом или работа), отметьте его на карте — и сразу перейдёте к оплате.',
      pickOther: '🗺 Отметить адрес в Ташкенте на карте', retry: '📍 Определить ещё раз',
      okPoint: '✓ Точка доставки в пределах Ташкента', change: 'Изменить точку',
      payH: 'Выберите способ оплаты', total: 'К оплате', demo: 'Демо-режим: деньги не списываются — оплата подтверждается сразу после нажатия.',
      paying: 'Проводим оплату…',
      doneH: 'Оплата прошла успешно (демо)! Вы зарегистрированы.', doneLive: 'Оплата прошла успешно! Вы зарегистрированы.',
      doneP: 'Подписка активирована. Менеджер свяжется с вами перед первой доставкой.',
      order: 'Заказ', start: 'Начало', slot: 'Время доставки', paidBy: 'Оплата', amount: 'Сумма', point: 'Точка доставки',
      morning: 'Утром 08:00–10:00', evening: 'Вечером 18:00–22:30', days: 'дн.',
      noGeo: 'Браузер не умеет определять местоположение.', mapFail: 'Не удалось загрузить карту. Проверьте интернет и попробуйте снова.', err: 'Ошибка. Попробуйте ещё раз.'
    }
  };
  var tr = function (k) { return (T[K.lang] || T.uz)[k]; };
  var esc = K.esc;
  var boundary = null, leafletP = null;

  function loadLeaflet() {
    if (window.L) return Promise.resolve(window.L);
    if (leafletP) return leafletP;
    leafletP = new Promise(function (resolve, reject) {
      var css = document.createElement('link'); css.rel = 'stylesheet'; css.href = LEAFLET.css; css.integrity = LEAFLET.cssSri; css.crossOrigin = 'anonymous'; document.head.appendChild(css);
      var s = document.createElement('script'); s.src = LEAFLET.js; s.integrity = LEAFLET.jsSri; s.crossOrigin = 'anonymous';
      s.onload = function () { resolve(window.L); }; s.onerror = function () { leafletP = null; reject(new Error('leaflet')); };
      document.head.appendChild(s);
    });
    return leafletP;
  }
  function loadBoundary() {
    if (boundary) return Promise.resolve(boundary);
    return fetch('/api/v1/geo/tashkent').then(function (r) { return r.json(); }).then(function (j) { boundary = j.city; return boundary; });
  }
  // Same ray casting as the server (the server's answer is the one that counts).
  function inside(lat, lng) {
    if (!boundary) return null;
    return boundary.some(function (ring) {
      var c = false;
      for (var i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        var yi = ring[i][0], xi = ring[i][1], yj = ring[j][0], xj = ring[j][1];
        if ((yi > lat) !== (yj > lat) && lng < (xj - xi) * (lat - yi) / (yj - yi) + xi) c = !c;
      }
      return c;
    });
  }

  /**
   * opts: { leadId, key, summary: [[label, value]], total: "966 000 so‘m", onDone(result) }
   * Returns { render(box) } — call render again after the host re-renders its HTML.
   */
  function create(opts) {
    var S = { step: 'geo', reason: '', busy: '', err: '', pin: null, point: null, result: null };
    var box = null, map = null, marker = null;
    var cfg = K.CFG.payments || { mode: 'demo', providers: [{ id: 'payme', title: 'Payme' }, { id: 'click', title: 'Click' }, { id: 'uzum', title: 'Uzum' }] };

    function sendLocation(body) {
      body.key = opts.key;
      return K.post('/api/v1/leads/' + opts.leadId + '/location', body).then(function (r) {
        if (!r.ok) throw new Error((r.data && r.data.error) || tr('err'));
        return r.data;
      });
    }
    function afterCheck(d, src) {
      S.busy = '';
      if (d.canPay) { S.step = 'pay'; K.goal('checkout_geo_inside'); }
      else { S.step = 'blocked'; S.reason = d.status === 'denied' ? 'denied' : src === 'map' ? 'pinOut' : 'out'; K.goal('checkout_geo_' + d.status); }
      draw();
    }
    function useGps() {
      if (!navigator.geolocation) { S.busy = 'checking'; draw(); sendLocation({ status: 'unavailable' }).then(function (d) { afterCheck(d, 'gps'); }).catch(fail); return; }
      S.busy = 'locating'; S.err = ''; draw();
      navigator.geolocation.getCurrentPosition(function (pos) {
        S.busy = 'checking'; S.point = { lat: pos.coords.latitude, lng: pos.coords.longitude }; draw();
        sendLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy, source: 'gps' }).then(function (d) { afterCheck(d, 'gps'); }).catch(fail);
      }, function (e) {
        S.busy = 'checking'; draw();
        sendLocation({ status: e && e.code === 1 ? 'denied' : 'unavailable' }).then(function (d) { afterCheck(d, 'gps'); }).catch(fail);
      }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 });
    }
    function confirmPin() {
      if (!S.pin) return;
      S.busy = 'checking'; S.err = ''; draw();
      sendLocation({ lat: S.pin.lat, lng: S.pin.lng, source: 'map' }).then(function (d) { S.point = S.pin; afterCheck(d, 'map'); }).catch(fail);
    }
    function pay(provider) {
      S.busy = 'paying'; S.err = ''; draw();
      K.post('/api/v1/checkout', { leadId: opts.leadId, key: opts.key, provider: provider }).then(function (r) {
        S.busy = '';
        if (!r.ok) { S.err = (r.data && r.data.error) || tr('err'); draw(); return; }
        if (r.data.status === 'redirect' && r.data.url) { location.href = r.data.url; return; }
        S.step = 'done'; S.result = r.data; draw();
        K.track('Purchase', { value: r.data.order.amount, currency: 'UZS', content_name: r.data.order.ration + '_' + r.data.order.plan });
        if (opts.onDone) opts.onDone(r.data);
      }).catch(fail);
    }
    function fail(e) { S.busy = ''; S.err = (e && e.message) || tr('err'); draw(); }

    function openMap() { S.step = 'map'; S.err = ''; draw(); }
    function initMap(el) {
      Promise.all([loadLeaflet(), loadBoundary()]).then(function (res) {
        var L = res[0];
        if (!el.isConnected) return;
        if (map) { map.remove(); map = null; }
        map = L.map(el, { zoomControl: true, attributionControl: true }).setView(S.pin ? [S.pin.lat, S.pin.lng] : [41.3111, 69.2797], S.pin ? 14 : 11);
        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' }).addTo(map);
        L.polygon(boundary, { color: '#1E6B3A', weight: 2, fillColor: '#2F8A50', fillOpacity: 0.06, interactive: false }).addTo(map);
        var setPin = function (ll) {
          S.pin = { lat: ll.lat, lng: ll.lng };
          if (!marker) { marker = L.marker(ll, { draggable: true }).addTo(map); marker.on('dragend', function () { setPin(marker.getLatLng()); }); }
          else marker.setLatLng(ll);
          pinInfo();
        };
        marker = null;
        if (S.pin) setPin(S.pin);
        map.on('click', function (e) { setPin(e.latlng); });
        api.map = map; api.setPin = setPin;
        pinInfo();
      }).catch(function () { S.err = tr('mapFail'); var e = box && box.querySelector('.ck-err'); if (e) e.textContent = S.err; });
    }
    function pinInfo() {
      var info = box && box.querySelector('.ck-pin'), btn = box && box.querySelector('.js-ck-confirm');
      if (!info) return;
      if (!S.pin) { info.textContent = tr('pinNone'); info.className = 'ck-pin'; if (btn) btn.disabled = true; return; }
      var ins = inside(S.pin.lat, S.pin.lng);
      info.textContent = (ins ? tr('pinIn') : tr('pinOut')) + ' · ' + S.pin.lat.toFixed(5) + ', ' + S.pin.lng.toFixed(5);
      info.className = 'ck-pin ' + (ins ? 'in' : 'out');
      if (btn) btn.disabled = false;
    }

    function rows(list) { return '<div class="of-sum">' + list.map(function (x) { return '<div class="r"><span>' + esc(x[0]) + '</span><b>' + esc(x[1]) + '</b></div>'; }).join('') + '</div>'; }
    function html() {
      var b = S.busy, dis = b ? ' disabled' : '';
      var busy = b ? '<p class="ck-busy" role="status">' + tr(b) + '</p>' : '';
      var err = '<p class="err ck-err" role="alert">' + esc(S.err) + '</p>';
      if (S.step === 'geo') {
        return '<div class="ck"><b class="ck-h">' + tr('geoH') + '</b><p class="ck-p">' + tr('geoP') + '</p>' +
          '<button type="button" class="btn btn-hot btn-block js-ck-gps"' + dis + '>' + tr('gps') + '</button>' +
          '<button type="button" class="btn btn-line btn-block js-ck-map"' + dis + '>' + tr('map') + '</button>' + busy + err + '</div>';
      }
      if (S.step === 'map') {
        return '<div class="ck"><b class="ck-h">' + tr('map').replace(/^🗺\s*/, '') + '</b><p class="ck-p">' + tr('mapHint') + '</p>' +
          '<div class="ck-map js-ck-mapbox" role="application" aria-label="Xarita"></div><p class="ck-pin">' + tr('pinNone') + '</p>' +
          '<button type="button" class="btn btn-hot btn-block js-ck-confirm"' + (S.pin && !b ? '' : ' disabled') + '>' + tr('confirm') + '</button>' +
          '<button type="button" class="btn btn-line btn-block js-ck-back"' + dis + '>' + tr('back') + '</button>' + busy + err + '</div>';
      }
      if (S.step === 'blocked') {
        return '<div class="ck"><div class="ck-block" role="alert"><b>' + tr(S.reason === 'denied' ? 'deniedH' : S.reason === 'pinOut' ? 'pinOutH' : 'outH') + '</b><span>' + tr('sent') + '</span></div>' +
          '<p class="ck-p">' + tr('inside2') + '</p>' +
          '<button type="button" class="btn btn-soft btn-block js-ck-map"' + dis + '>' + tr('pickOther') + '</button>' +
          (S.reason === 'pinOut' ? '' : '<button type="button" class="btn btn-line btn-block js-ck-gps"' + dis + '>' + tr('retry') + '</button>') + busy + err + '</div>';
      }
      if (S.step === 'pay') {
        return '<div class="ck"><p class="ck-ok">' + tr('okPoint') + (S.point ? ' · <a href="https://maps.google.com/?q=' + S.point.lat.toFixed(6) + ',' + S.point.lng.toFixed(6) + '" target="_blank" rel="noopener">' + S.point.lat.toFixed(5) + ', ' + S.point.lng.toFixed(5) + '</a>' : '') + '</p>' +
          rows((opts.summary || []).concat([[tr('total'), opts.total || '']])) +
          '<b class="ck-h">' + tr('payH') + '</b><div class="ck-prov">' + cfg.providers.map(function (p) {
            return '<button type="button" class="btn ck-pbtn ck-' + p.id + ' js-ck-pay" data-provider="' + p.id + '"' + dis + '>' + esc(p.title) + (cfg.mode === 'demo' ? '<small>demo</small>' : '') + '</button>';
          }).join('') + '</div>' +
          (cfg.mode === 'demo' ? '<p class="ck-demo">' + tr('demo') + '</p>' : '') +
          '<button type="button" class="linkbtn js-ck-map"' + dis + '>' + tr('change') + '</button>' + busy + err + '</div>';
      }
      if (S.step === 'done') {
        var o = S.result.order, D = K.d(), P = { payme: 'Payme', click: 'Click', uzum: 'Uzum' };
        return '<div class="ck ok-box" role="status"><span class="ok-ic"><svg width="24" height="24"><use href="#i-check"/></svg></span>' +
          '<b class="ck-h big">' + (S.result.mode === 'demo' ? tr('doneH') : tr('doneLive')) + '</b><p class="ck-p">' + tr('doneP') + '</p>' +
          rows([[tr('order'), '#' + o.id + ' · ' + D.rations[o.ration][0] + ' ' + o.sku + ' ' + D.kcal + ' · ' + (D.mOpt ? D.mOpt[o.meals] : o.meals)],
            [D.plans[o.plan] || o.plan, o.days + ' ' + tr('days')], [tr('start'), o.startDate], [tr('slot'), tr(o.deliverySlot === 'evening' ? 'evening' : 'morning')],
            [tr('paidBy'), (P[S.result.provider] || S.result.provider) + (S.result.mode === 'demo' ? ' (demo)' : '')], [tr('amount'), K.fmt(o.amount) + ' ' + D.sum]]) + '</div>';
      }
      return '';
    }
    function draw() {
      if (!box) return;
      if (map && S.step !== 'map') { map.remove(); map = null; marker = null; }
      box.innerHTML = html();
      var q = function (s) { return box.querySelectorAll(s); };
      Array.prototype.forEach.call(q('.js-ck-gps'), function (b) { b.onclick = useGps; });
      Array.prototype.forEach.call(q('.js-ck-map'), function (b) { b.onclick = openMap; });
      Array.prototype.forEach.call(q('.js-ck-back'), function (b) { b.onclick = function () { S.step = S.reason ? 'blocked' : 'geo'; draw(); }; });
      Array.prototype.forEach.call(q('.js-ck-confirm'), function (b) { b.onclick = confirmPin; });
      Array.prototype.forEach.call(q('.js-ck-pay'), function (b) { b.onclick = function () { pay(b.getAttribute('data-provider')); }; });
      if (S.step === 'map') { var mb = box.querySelector('.js-ck-mapbox'); if (map && map.getContainer() !== mb) { map.remove(); map = null; } if (!map) initMap(mb); else pinInfo(); }
    }
    var api = {
      render: function (el) { box = el; draw(); },
      state: S
    };
    K.onLang(function () { if (box && box.isConnected) draw(); });
    K.checkout.last = api; // handy for support / automated tests (map + pin)
    return api;
  }

  K.checkout = { create: create, inTashkent: function (lat, lng) { return loadBoundary().then(function () { return inside(lat, lng); }); } };
})();
