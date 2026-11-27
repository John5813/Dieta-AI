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
| **Arizalar** | Sayt/ilova so'rovlari (tanlangan rasion + kkal, allergiya/izoh ham ko'rinadi; izoh mijozning doimiy eslatmasiga qo'shiladi) (yangi → aloqaga chiqildi → buyurtma bo'ldi / rad). Qo'ng'iroq natijasi, buyurtma yaratish, mijoz kartasi |
| **Mijozlar** | Qidiruv (✕ bilan tozalanadi, boshqa bo'limga o'tganda o'zi tozalanadi) va filtrlar: Hammasi / Faol / To'lov kutilmoqda / Buyurtma yo'q / Arxiv. Yangi mijoz faqat yuqori paneldagi **+ Yangi mijoz qo'shish** tugmasi bilan: ism va to'g'ri telefon majburiy; raqam bazada bo'lsa ism avtomatik to'ladi (raqam o'zgarsa tozalanadi); kuryer standart "Ichki" — kerak bo'lsa admin qo'lda "Tashqi"ni tanlaydi; to'lov "Qisman" bo'lsa summa kiritiladi |
| **Mijoz kartasi** | Ism, telefon (band raqam — ogohlantirish), tuman, manzil, **doimiy eslatma** (allergiya, domofon — oshxona va kuryer ro'yxatida ham chiqadi). **Arxivlash / Arxivdan qaytarish** (faol obunasi bor mijozni arxivlab bo'lmaydi), admin uchun **butunlay o'chirish** (telefonning oxirgi 4 raqami bilan tasdiq). **Tarix** — qo'ng'iroqlar, izohlar va barcha o'zgarishlar |
| **Obuna** | Holat, To'lov, Yetkazish vaqti, Kuryer (yorliqlar bilan); to'langan summa va qarz; **Tahrirlash** (boshlanish sanasi, rasion/kkal, muddat, kunlar soni, narx, manzil, izoh); **Muzlatish (pauza)** — sanalar oralig'i, kunlar obuna oxiriga qo'shiladi, muzlatilgan kunni "qaytarish" mumkin; admin uchun xato/test buyurtmani o'chirish |
| **Yetkazish** | Tanlangan kun (standart — ertaga): oshxona jadvali (rasion + kkal × ertalab/kechki/jami) va allergiya/izohlar; 4 ta ro'yxat: ertalab/kechki × ichki/tashqi; har qatorda shu kun uchun vaqt va kuryerni o'zgartirish; yetkazish kuni kelganda **✓ Yetkazildi / O'tkazib yuborildi** (bekor qilsa bo'ladi); CSV va **Excel (.xlsx)** — hammasi yoki har bir kuryer ro'yxati alohida (tayyor formatlangan jadval: sarlavha, ustun kengliklari, filtr, chop etishga moslangan); **oshxona uchun**: «Chop etish» (faqat oshxona varaqasi), «Telegramga nusxalash» (tayyor matn), «Oshxona Excel» — uchalasida ham mijoz telefoni va manzili yo'q; **Uzaytirishga qo'ng'iroq** |
| **Xodimlar** (admin) | Qo'shish, rolni o'zgartirish (Admin/Menejer), faolsizlantirish (sessiya darhol tugaydi), faol bo'lmagan xodimni o'chirish |

| **Menyu** | Hafta kunlari (Dushanba–Shanba) × 5 mahal: taom nomi va mahsulotlar — har bir kaloriya (1200…2500) uchun gramm, turi: «Asosiy oqsil» (2x go'sht / +Oqsil shunga qo'llanadi), «Garnir» (Garnirsiz / kamroq), «Boshqa». «1600 dan hisoblash» boshqa kaloriyalarni mutanosib to'ldiradi. Pastda maxsus porsiyalar katalogi (narx/kun va ta'siri — faqat admin o'zgartiradi) |

## Maxsus porsiya / qo'shimchalar
- Tanlov: 2x go'sht, +Oqsil, Garnir kamroq, Garnirsiz, Laktozasiz, Yong'oqsiz (+ soni ×1–3) va ixtiyoriy «boshqa maxsus talab» (narx bilan yoki narxsiz).
- Mijoz kartasida **doimiy** talab saqlanadi va har bir yangi buyurtmada (+ Buyurtma, arizadan buyurtma, Yangi mijoz) avtomatik tanlanadi; buyurtmada alohida o'zgartirish mumkin («Tahrirlash»).
- Narxli qo'shimchalar kunlik narxga qo'shiladi: summa = kunlar × (rasion narxi + qo'shimchalar) − chegirma.
- Ro'yxat, obuna kartasi va yetkazish qatorlarida belgi (badge) bilan ko'rinadi; CSV/Excel'da «Maxsus porsiya» ustuni.

## Oshxona uchun (ekran, Chop etish, Telegramga nusxalash, kitchen.xlsx)
Telefon va manzil hech qayerda chiqmaydi. Uch qism: **a) Rasionlar** (ertalab/kechki/jami + «3 ta (1 ta: 2x go'sht)»), **b) Taom va mahsulotlar yig'indisi** — o'sha kun menyusi bo'yicha har bir taom va mahsulotdan nechta porsiya va necha gramm (2x go'sht = 2 porsiya, Garnirsiz = 0), **c) Quti yorlig'i** — mijoz, rasion·kkal, smena, maxsus porsiya, allergiya/izoh. kitchen.xlsx — 3 varaq.

## Qoidalar
- Bitta telefon (+998…) = bitta mijoz; sayt arizalari avtomatik shu mijozga bog'lanadi (eski arizalar ham birlashtirildi).
- Boshlanish sanasi standart: 18:00 gacha bo'lsa ertadan, keyin indindan; yakshanba yetkazilmaydi. Menejer o'zgartira oladi.
- Yetkazish vaqti: **ertalab 08:00–10:00** yoki **kechki 18:00–22:30**. Kuryer: **ichki** yoki **tashqi (autsors)** — buyurtma bo'yicha yoki alohida kun bo'yicha.
- Buyurtma "To'langan" qilinsa avtomatik **Faol** bo'ladi va yetkazish ro'yxatiga tushadi (to'lanmaganlar ro'yxatda ko'rinmaydi).
- "Tugamoqda" / "Muzlatilgan" holatlari yetkazish kunlaridan hisoblanadi.
- Muzlatish: ertangi kunni faqat 18:00 gacha; muzlatilgan kun 30 kun ichida ishlatilmasa kuyadi.
- Sayt arizasidan buyurtma yaratilsa ariza "Buyurtma bo'ldi"ga o'tadi va undagi tugmalar yashiriladi; rad etilgan arizani "Qayta ochish" mumkin.

## Keyingi bosqichlar uchun tayyor
- `customers.phone_verified_at/_via`, `phone_verifications` (telegram | sms) — Telegram deep-link yoki Eskiz SMS orqali raqam tasdiqlash.
- `app_links` (ilova qurilmasi ↔ mijoz) va `mealPremiumUntil()` — faol, to'langan obuna oxirgi yetkazish kunigacha ilova Premium'ini ochadi (3 kun → 3 kun, 1 oy → 1 oy).
