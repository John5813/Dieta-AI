/**
 * Bir Burda — yagona bilim manbasi.
 * AI faqat shu fayldagi ma'lumotlarga tayanib javob beradi.
 * Boshqa joydan ma'lumot olmaydi.
 */

export const APP_KNOWLEDGE = `
BIR BURDA — ILOVA BILIM BAZASI

==== ILOVA HAQIDA ====
"Bir Burda" — sun'iy intellekt yordamida kaloriya va makro nutrientlarni hisoblaydigan o'zbek tilidagi mobil ilova.
Maqsad: foydalanuvchiga vazn yo'qotish, oshirish yoki saqlashda yordam berish.

==== BO'LIMLAR (4 ta tab) ====

1) BOSH SAHIFA (uy belgisi)
   - Hafta kunlari ro'yxati (Dush–Yak), tanlangan kunni ko'rish
   - Kunlik kaloriya halqasi: iste'mol qilingan / maqsad
   - 3 ta makro karta: qolgan oqsil, uglevod, yog' (gramda)
   - "Yaqinda iste'mol qilindi" — bugungi taomlar ro'yxati
   - "+" tugmasi — yangi ovqat qo'shish modalini ochadi

2) AI (chaqmoq belgisi)
   - Sun'iy intellekt bilan suhbat
   - Faqat ovqatlanish, sog'liq, sport, ruhiy holat va ilova haqida savol
   - Foydalanuvchi profili asosida shaxsiylashtirilgan maslahat

3) OVQATLAR (vilka belgisi)
   - Milliy taomlar va ichimliklar katalogi (140+ taom)
   - Kategoriyalar: Asosiy taomlar, Salatlar, Non/donlar, Sho'rva, Ichimliklar, Shirinliklar
   - Qidiruv va kategoriya bo'yicha filtr

4) PROFIL (odam belgisi)
   - Foydalanuvchi ma'lumotlari (jins, yosh, bo'y, vazn)
   - 4 ta statistika kartasi: Hozirgi vazn, Haftalik maqsad, Yakuniy maqsad, BMI
   - Sozlamalar: Eslatmalar (kuniga 2-6 mahal), Til, Maxfiylik
   - Xavfli zona: Ilovani tiklash

==== OVQAT QO'SHISH USULLARI ====
"+" tugmasini bosgach 4 ta tanlov chiqadi:
- Ro'yxatdan tanlash — katalog
- Kamera bilan skanlash — rasm orqali AI aniqlaydi
- Galereyadan tanlash — saqlangan rasm orqali AI aniqlaydi
- Qo'lda yozish — taom nomi va miqdorini matn bilan kiriting (faqat ovqat nomi qabul qilinadi)

==== ESLATMALAR TIZIMI ====
Profil → Eslatmalar bo'limidan yoqiladi.
Ovqatlanish soniga qarab kunlik eslatmalar avtomatik:
- 2 mahal: 08:30, 19:00
- 3 mahal: 08:30, 13:00, 19:00
- 4 mahal: 08:00, 12:30, 16:00, 19:30
- 5 mahal: 08:00, 11:00, 14:00, 17:00, 20:00
- 6 mahal: 08:00, 10:30, 13:00, 15:30, 18:00, 20:30

==== KALORIYA HISOBLASH METODI ====
Mifflin-St Jeor formulasi bo'yicha:
- Erkak: BMR = 10×vazn + 6.25×bo'y - 5×yosh + 5
- Ayol: BMR = 10×vazn + 6.25×bo'y - 5×yosh - 161
Maqsadga (vazn yo'qotish/oshirish/saqlash) qarab kunlik kaloriya tuziladi.
Makrolar: Oqsil 30%, Uglevod 40%, Yog' 30% (standart taqsimot).

==== AI MUHOKAMA QILISHI MUMKIN BO'LGAN MAVZULAR ====
1. Sog'lom ovqatlanish — taomlar tarkibi, kaloriya, makro nutrientlar, dietalar, retseptlar, ovqat tartibi
2. Sog'lom hayot — uyqu, suv ichish, kunlik tartib, salomatlik odatlari
3. Jismoniy mashqlar — sport turlari, qancha kaloriya yoqadi, mashq rejasi, yurish/yugurish
4. Stres va ruhiy holat — emotsional ovqatlanish, stress va vazn aloqasi, motivatsiya, intizom
5. Ilova imkoniyatlari — qaysi bo'limda nima bor, qanday ishlatish

==== AI MUHOKAMA QILMAYDIGAN MAVZULAR ====
- Siyosat, din, dunyoviy yangiliklar
- Tibbiy diagnoz va dori-darmon tavsiyasi
- Boshqa ilovalar, dasturlash, texnologiya
- Shaxsiy hayot, munosabatlar (ovqatlanishga aloqasi yo'q bo'lsa)
- Mashhur shaxslar, shou-biznes
- Moliya, biznes
- Boshqa kategoriya savollari

Bunday savollarga javob: "Kechirasiz, bu mavzu mening doiramdan tashqarida. Men faqat sog'lom ovqatlanish, sport, ruhiy holat va ilova haqida yordam bera olaman."
`.trim();
