# kaloria.uz sayti: qanday ishlaydi va domenni qanday ulash kerak

## Nima qo'shildi

| Qism | Qayerda | Vazifasi |
|---|---|---|
| Sayt (landing) | `artifacts/web/public/index.html` | Rasionlar, menyu, kun tartibi, narx cheki, muzlatish kalendari, ogohlantirish, FAQ. UZ/RU tugmasi tepada doim ko'rinadi |
| Kalkulyator | `/hisoblash` (`hisoblash.html`) | 5 savol → kkal ochiq → ism + telefon (Value Gate) → BJU, mos rasion va narx |
| Oferta | `/oferta` | Loyiha matni (yurist tekshirishi kerak), tibbiy ogohlantirish, 18:00 va muzlatish qoidalari |
| Umumiy formula | `lib/nutrition` | Ilovadagi Mifflin-St Jeor algoritmining aynan nusxasi (24 960 holatda solishtirilgan, farq 0) |
| CRM | `leads` jadvali (`lib/db`) | Ism, telefon, bo'y/vazn/yosh, maqsad, kkal/BJU, mos rasion, tanlangan tarif, UTM, holat |
| API | `artifacts/api-server/src/routes/leads.ts` | `POST /api/v1/leads`, `POST /api/v1/leads/:id/intent`, `GET /api/v1/site-config` |
| Telegram xabari | `src/lib/leadNotify.ts` | Har yangi lead va har tarif tanlovi menejerga Telegram'da keladi |

Sayt alohida server talab qilmaydi: mavjud API server (`Dockerfile`) `/` manzilda saytni, `/api` da API'ni beradi.
`GET /` endi HTML qaytaradi (200), shuning uchun DigitalOcean health check'i avvalgidek ishlaydi.

> Hozircha "Buyurtma berish" tugmasi buyurtmani CRM'ga yozadi va menejerga yuboradi; menejer mijozga
> Payme/Click/Uzum to'lov havolasini yuboradi. Saytning o'zida avtomatik to'lov (checkout) keyingi bosqichda
> ovqat uchun alohida kassa kalitlari bilan ulanadi.

## Sozlamalar (DigitalOcean → App → Settings → Environment Variables)

| O'zgaruvchi | Misol | Izoh |
|---|---|---|
| `PUBLIC_BASE_URL` | `https://kaloria.uz` | Domen ulangandan keyin |
| `SITE_PRICES` | `{"ozish":159000,"balans":179000,"sport":209000}` | **Majburiy** — o'rnatilmaguncha saytda "Namuna narxlar" yozuvi chiqadi |
| `SITE_DISCOUNTS` | `{"d3":0,"w1":0,"w2":3,"w3":5,"w4":7,"m1":10}` | Foizda |
| `MANAGER_TELEGRAM_URL` | `https://t.me/kaloria_uz` | Saytdagi barcha Telegram tugmalari |
| `MANAGER_PHONE` | `+998901234567` | Footer'da chiqadi |
| `TELEGRAM_LEADS_CHAT_ID` | `-100123…` | Leadlar keladigan guruh. Bo'sh bo'lsa `TELEGRAM_ADMIN_CHAT_ID` ga keladi. `TELEGRAM_BOT_TOKEN` ham kerak |
| `META_PIXEL_ID`, `TIKTOK_PIXEL_ID` | | Instagram/TikTok reklamasi uchun (ixtiyoriy) |

Guruh chat ID'sini bilish: botni guruhga qo'shing, guruhga biror xabar yozing va
`https://api.telegram.org/bot<TOKEN>/getUpdates` ni oching — `"chat":{"id":-100…}`.

## Domenni ulash — DigitalOcean App Platform

1. **cloud.digitalocean.com → Apps →** ilovangiz (`dieta-ai`) **→ Settings → Domains → Add Domain**.
2. `kaloria.uz` ni kiriting. DigitalOcean ikki yo'l taklif qiladi:
   - **"We manage your domain" (tavsiya)** — domen DNS'ini DigitalOcean boshqaradi.
     Domenni sotib olgan joyingizda (.uz registrator kabinetida) **NS serverlarni** quyidagiga almashtiring:
     `ns1.digitalocean.com`, `ns2.digitalocean.com`, `ns3.digitalocean.com`.
     DigitalOcean kerakli yozuvlarni o'zi yaratadi.
   - **"You manage your domain"** — DNS registrator'da qoladi. DigitalOcean ko'rsatgan CNAME qiymatini
     (`dieta-ai-xxxxx.ondigitalocean.app`) yozing. Asosiy domen (`kaloria.uz`, `@`) uchun ko'p .uz
     registratorlarda CNAME qo'yib bo'lmaydi — bunday holda birinchi yo'lni tanlang.
3. Yana **Add Domain → `www.kaloria.uz`** (Alias). Server `www` ni avtomatik `kaloria.uz` ga yo'naltiradi.
4. SSL (HTTPS) sertifikatini DigitalOcean o'zi chiqaradi — DNS tarqalgach (odatda 15 daqiqa – bir necha soat)
   domen holati **Active** bo'ladi.
5. **Environment Variables** ga `PUBLIC_BASE_URL=https://kaloria.uz` va yuqoridagi sozlamalarni qo'shing → **Save**
   (ilova qayta deploy bo'ladi).
6. Tekshirish: `https://kaloria.uz`, `https://kaloria.uz/hisoblash`, `https://kaloria.uz/api/healthz`.

Payme/Click/Uzum kabinetlaridagi webhook manzillarini ham yangi domenga almashtiring
(`https://kaloria.uz/api/pay/...`, ro'yxat `docs/TOLOV-TIZIMI.md` da). Eski `*.ondigitalocean.app` manzili ham
ishlashda davom etadi, shuning uchun mobil ilova buzilmaydi.

## Agar bu oddiy VPS (Droplet) bo'lsa

1. Registrator'da `A` yozuvlari: `@` → VPS IP, `www` → VPS IP.
2. VPS'da: `docker compose --env-file .env up -d --build` (API 8080-portda).
3. Nginx reverse proxy (`server_name kaloria.uz www.kaloria.uz; proxy_pass http://127.0.0.1:8080;`
   va `X-Forwarded-For`/`X-Forwarded-Proto` sarlavhalari), keyin `certbot --nginx -d kaloria.uz -d www.kaloria.uz`.
4. `.env` da `TRUST_PROXY=1` qoldiring.
