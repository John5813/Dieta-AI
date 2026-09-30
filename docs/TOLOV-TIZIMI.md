# Premium to'lovi: sayt orqali (Click, Payme, Uzum, Visa/Mastercard)

Premium **ilova ichida sotilmaydi**. Mijoz saytda (`https://<domen>/pay`) to'laydi,
tizim unga **login va parol** beradi, ilovada esa faqat shu hisobga kiriladi.

## Nega shunday

App Store va Google Play raqamli xizmatni (Premium) faqat o'z to'lov tizimi orqali
sotishga ruxsat beradi. Ilovada Click/Payme tugmasi, narx, "saytda sotib oling" degan
havola yoki Telegram bot orqali sotib olish ko'rsatilsa, ilova rad etiladi.

Shuning uchun:

| Qayerda | Nima ko'rinadi |
|---|---|
| iOS / Android ilova | Faqat **"Hisobga kirish"** (login + parol). Narx, to'lov tugmasi, sayt havolasi yo'q. Sinov tugagach ham kundalik, suv, qadam, shtrix-kod va boshqa asosiy funksiyalar bepul ishlaydi, faqat AI rasm tahlili Premium talab qiladi. |
| Ilovaning web versiyasi | "Premium olish" tugmasi `/pay` sahifasini ochadi. |
| Sayt `/pay` | Tarif, to'lov usuli, to'lovdan keyin login/parol va "Ilovada ochish" tugmasi. |

Mijozlar saytga ilovadan emas, reklama, Instagram, Telegram kanal va bot orqali keladi.

> Kafolat haqida: Google Play uchun bu yo'l (ilovada faqat kirish, sotib olish yo'q)
> qoidalarga mos. Apple qoidasi (3.1.3(b)) rasman ilova ichida ham In‑App Purchase
> taklif qilishni kutadi; amalda ilova bepul qismi to'liq ishlasa va xaridga hech
> qanday ishora bo'lmasa odatda o'tadi, lekin Apple buni 100% kafolatlamaydi.
> AQSh do'konida esa endi saytga havola qo'yishga ruxsat bor.

## Qanday ishlaydi

1. Mijoz `/pay?lang=ru` sahifasini ochadi (10 til, fors tili o'ngdan chapga).
   Til `?lang=`, keyin cookie, keyin brauzer tili bo'yicha tanlanadi.
2. Tarif va to'lov usulini tanlaydi. Yangi hisob yoki mavjud loginni uzaytirish
   (`/pay?login=DAI-XXXXXX` bilan oldindan to'ldirish mumkin).
3. Server buyurtma yaratadi va mijozni provayder sahifasiga yuboradi.
4. Provayder serverimizga webhook yuboradi → buyurtma to'langan deb belgilanadi,
   `payments` jadvalida login yaratiladi (yoki mavjud login muddati uzaytiriladi).
   Admin Telegram'da xabar oladi.
5. Mijoz sayt sahifasiga qaytadi: login, parol va **"Ilovada ochish"** tugmasi
   (`uzdieta://activate?login=…&password=…`) chiqadi. Tugma ilovani ochib, hisobga
   avtomatik kiritadi.
6. Pul qaytarilsa (Payme `CancelTransaction`, Uzum `reverse`, Octo `canceled`),
   Premium avtomatik olib qo'yiladi.

Parol serverda ochiq saqlanmaydi: faqat xesh, va buyurtma sahifasi tokeni bilan
shifrlangan nusxa (tokensiz uni hech kim o'qiy olmaydi).

## Sozlash (environment variables)

Faqat kalitlari to'liq kiritilgan to'lov usuli saytda ko'rinadi.

| O'zgaruvchi | Tavsif |
|---|---|
| `PUBLIC_BASE_URL` | Saytning https manzili, masalan `https://dietaai-lexhk.ondigitalocean.app` |
| `PREMIUM_PLANS` | Tariflar (ixtiyoriy). Standart: 1 yil — 260 000 so'm. Misol: `[{"id":"month","months":1,"amount":49000},{"id":"year","months":12,"amount":260000}]` |
| `CLICK_SERVICE_ID`, `CLICK_MERCHANT_ID`, `CLICK_SECRET_KEY` | Click kabinetidan |
| `PAYME_MERCHANT_ID`, `PAYME_KEY` | Payme kabinetidan (kassa ID va kalit) |
| `PAYME_TEST=1` | Payme test muhiti (checkout.test.paycom.uz) — test paytida |
| `PAYME_ACCOUNT_FIELD` | Kabinetdagi hisob maydoni nomi (standart `order_id`) |
| `UZUM_SERVICE_ID`, `UZUM_LOGIN`, `UZUM_PASSWORD` | Uzum Bank bergan servis ID va webhook uchun Basic auth |
| `UZUM_CHECKOUT_URL` | Uzum to'lov sahifasi manzili (standart `https://www.uzumbank.uz/open-service`) |
| `OCTO_SHOP_ID`, `OCTO_SECRET`, `OCTO_UNIQUE_KEY` | Visa/Mastercard uchun Octo (octo.uz) kabinetidan |
| `OCTO_TEST=1` | Octo test rejimi |
| `MERCHANT_LEGAL_NAME`, `MERCHANT_INN`, `MERCHANT_ADDRESS`, `MERCHANT_PHONE`, `MERCHANT_EMAIL`, `MERCHANT_TELEGRAM` | Sotuvchi rekvizitlari — oferta va sahifa pastida chiqadi. Click/Payme moderatsiyasi buni talab qiladi. |
| `APP_STORE_URL`, `PLAY_STORE_URL` | To'lovdan keyin "Ilovani yuklab olish" havolalari |

## Provayder kabinetida ko'rsatiladigan manzillar

`<domen>` o'rniga `PUBLIC_BASE_URL` qiymatini qo'ying.

| Provayder | Manzil |
|---|---|
| Click — Prepare URL | `https://<domen>/api/pay/click/prepare` |
| Click — Complete URL | `https://<domen>/api/pay/click/complete` |
| Payme — Endpoint URL | `https://<domen>/api/pay/payme` (hisob maydoni: `order_id`) |
| Uzum Bank — check / create / confirm / reverse / status | `https://<domen>/api/pay/uzum/check` va hokazo |
| Octo — notify_url | avtomatik yuboriladi: `https://<domen>/api/pay/octo/notify` |

Moderatsiya uchun sayt sahifalari: `/pay` (narxlar va xizmat), `/pay/offer`
(ommaviy oferta, 14 kunlik qaytarish sharti bilan), `/privacy` (maxfiylik siyosati).

## Ishga tushirishdan oldin tekshirish

1. **Payme**: `PAYME_TEST=1` va test kalit bilan test.paycom.uz "Песочница"dagi
   barcha testlarni o'tkazing (bizning tomonda `CheckPerformTransaction`,
   `CreateTransaction`, `PerformTransaction`, `CancelTransaction`,
   `CheckTransaction`, `GetStatement` va xato kodlari yozilgan).
2. **Click**: Click bergan test vositasi bilan prepare/complete va imzo (`sign_string`)ni tekshiring.
3. **Uzum Bank** va **Octo**: ulanishda ular bergan hujjat va test muhitida
   so'rov/javob maydonlarini solishtiring — bu ikkisining protokoli ular bergan
   shartnomaga qarab farq qilishi mumkin.
4. Har biri bilan kichik summada haqiqiy to'lov qiling va login ilovada ishlashini tekshiring.

Eski Telegram bot orqali sotib olingan loginlar avvalgidek ishlaydi.
