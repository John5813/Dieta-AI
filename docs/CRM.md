# kaloria.uz CRM (/admin) — A bosqichi

## Kirish
1. Admin (egasi) Telegram botga **/login** yozadi → bot 10 daqiqalik bir martalik havola yuboradi → `https://kaloria.uz/admin`.
   - Birinchi marta: `TELEGRAM_ADMIN_CHAT_ID` (yoki `ADMIN_OWNER_TELEGRAM_IDS` ro'yxatidagi) shaxsiy Telegram ID **avtomatik admin** bo'ladi.
2. Menejer qo'shish: menejer botga /login yozadi → bot uning Telegram ID raqamini ko'rsatadi → admin CRM → **Xodimlar** bo'limida ism + shu ID ni qo'shadi → menejer yana /login yozadi.
3. Rollar: **admin** (owner) — hammasi + xodimlar; **menejer** — arizalar, mijozlar, buyurtmalar, yetkazish.

Oshxona va kuryerlar panelga kirmaydi — ular uchun "Yetkazish" bo'limidan CSV (smena va kuryer turi bo'yicha alohida). 18:00/18:05 avtomatik Telegram hisobot — B bosqichida.

## Bo'limlar
| Bo'lim | Nima qilinadi |
|---|---|
| **Arizalar** | Sayt/ilova so'rovlari (yangi → aloqaga chiqildi → buyurtma bo'ldi / rad). Qo'ng'iroq natijasi, buyurtma yaratish, mijoz kartasi |
| **Mijozlar** | Telefon/ism bo'yicha qidiruv; **+ Yangi mijoz qo'shish** (yuqori panelda ham doim bor): ism, telefon, manba (Telefon / Instagram / Telegram / Sayt), tuman, manzil, izoh; ixtiyoriy — shu oynaning o'zida buyurtma (rasion, muddat, vaqt, kuryer). Raqam bazada bo'lsa dublikat ochilmaydi — ogohlantirish va mavjud karta; mijoz kartasi: ma'lumot, obunalar (holat, to'lov, smena, kuryer — joyida o'zgartiriladi), tarix (qo'ng'iroq/izoh) |
| **Yetkazish** | Tanlangan kun (standart — ertaga): oshxona uchun kaloriya bo'yicha sonlar; 4 ta ro'yxat: ertalab/kechki × ichki/tashqi kuryer (har qatorda kuryerni o'zgartirish), CSV; **Uzaytirishga qo'ng'iroq** — obunasi tugashiga 1–2 kun qolganlar |

## Qoidalar
- Bitta telefon (+998…) = bitta mijoz; sayt arizalari avtomatik shu mijozga bog'lanadi (eski arizalar ham birlashtirildi).
- Boshlanish sanasi standart: 18:00 gacha bo'lsa ertadan, keyin indindan; yakshanba yetkazilmaydi. Menejer o'zgartira oladi.
- Yetkazish vaqti: **ertalab 08:00–10:00** yoki **kechki 18:00–22:30**. Kuryer: **ichki** yoki **tashqi (autsors)** — buyurtma bo'yicha yoki alohida kun bo'yicha.
- Buyurtma "To'langan" qilinsa avtomatik **Faol** bo'ladi va yetkazish ro'yxatiga tushadi (to'lanmaganlar ro'yxatda ko'rinmaydi).
- "Tugamoqda" / "Muzlatilgan" holatlari yetkazish kunlaridan hisoblanadi.

## Keyingi bosqichlar uchun tayyor
- `customers.phone_verified_at/_via`, `phone_verifications` (telegram | sms) — Telegram deep-link yoki Eskiz SMS orqali raqam tasdiqlash.
- `app_links` (ilova qurilmasi ↔ mijoz) va `mealPremiumUntil()` — faol, to'langan obuna oxirgi yetkazish kunigacha ilova Premium'ini ochadi (3 kun → 3 kun, 1 oy → 1 oy).
