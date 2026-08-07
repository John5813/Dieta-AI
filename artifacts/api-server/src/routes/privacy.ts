import { Router } from "express";

const router = Router();

router.get("/", (_req, res) => {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(`<!DOCTYPE html>
<html lang="uz">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Maxfiylik Siyosati — Bir Burda</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 800px; margin: 0 auto; padding: 24px 16px; color: #1a1a1a; line-height: 1.7; }
    h1 { color: #2d7a2d; }
    h2 { color: #333; margin-top: 32px; }
    p { margin: 12px 0; }
    a { color: #2d7a2d; }
    .date { color: #888; font-size: 14px; }
    .highlight { background: #f0faf0; border-left: 4px solid #2d7a2d; padding: 12px 16px; border-radius: 4px; margin: 16px 0; }
    .meta { background: #f9f9f9; border: 1px solid #e0e0e0; border-radius: 8px; padding: 16px; margin-bottom: 24px; }
    .meta p { margin: 4px 0; }
  </style>
</head>
<body>
  <h1>Maxfiylik Siyosati</h1>
  <p class="date">So'nggi yangilanish: 2025-yil 1-iyul</p>

  <div class="meta">
    <p><strong>Ilova nomi:</strong> Bir Burda - Kaloriya Hisobi</p>
    <p><strong>Dasturchi:</strong> Muydinov Javlonbek</p>
    <p><strong>Aloqa:</strong> <a href="mailto:moydinovjavlonbek5813@gmail.com">moydinovjavlonbek5813@gmail.com</a></p>
  </div>

  <p>
    Ushbu siyosat <strong>Bir Burda - Kaloriya Hisobi</strong> ilovasiga tegishli bo'lib,
    uni <strong>Muydinov Javlonbek</strong> ishlab chiqargan.
    Ilovamizdan foydalanish orqali siz ushbu Maxfiylik Siyosatiga rozilik bildirasiz.
  </p>

  <h2>1. Qanday ma'lumotlar to'planadi</h2>
  <ul>
    <li><strong>Shaxsiy ma'lumotlar:</strong> ism, jins, yosh, bo'y, vazn — ilova sozlamalari uchun.</li>
    <li><strong>Sog'liq ma'lumotlari:</strong> kunlik kaloriya, taom ro'yxati, faollik darajasi — kaloriya hisobi va dieta tahlili uchun.</li>
    <li><strong>Rasmlar:</strong> ovqat rasmlarini AI tahlil qilishi uchun yuboriladi, serverda saqlanmaydi.</li>
    <li><strong>To'lov ma'lumotlari:</strong> to'lov cheki rasmi (Telegram orqali) — faqat obuna tasdiqlash uchun.</li>
    <li><strong>Qurilma ma'lumotlari:</strong> ilova ishlashi uchun texnik ma'lumotlar.</li>
  </ul>

  <h2>2. Ma'lumotlarni saqlash (Data Retention)</h2>
  <div class="highlight">
    <p>
      Foydalanuvchilarning shaxsiy va sog'liq ma'lumotlari (yosh, vazn, ovqatlanish tarixi)
      <strong>serverlarimizda saqlanmaydi</strong>. Barcha ma'lumotlar faqat
      foydalanuvchining o'z qurilmasida (xotirasida) saqlanadi va ilova o'chirilganda
      avtomatik ravishda yo'qoladi.
    </p>
    <p>
      Foydalanuvchi akkountini o'chirganda barcha ma'lumotlar <strong>darhol</strong>
      qurilmadan o'chiriladi.
    </p>
  </div>

  <h2>3. Ma'lumotlar qanday ishlatiladi</h2>
  <ul>
    <li>Shaxsiy kaloriya va ovqatlanish rejasini tayyorlash.</li>
    <li>AI yordamida ovqat rasmlarini tahlil qilish.</li>
    <li>Obuna va to'lovlarni tasdiqlash.</li>
    <li>Ilova funksionalligini yaxshilash.</li>
  </ul>

  <h2>4. Ma'lumotlar uchinchi tomon bilan ulashiladimi</h2>
  <p>
    Biz sizning ma'lumotlaringizni reklama maqsadida sotmaymiz va uchinchi tomonlarga
    uzatmaymiz. Ovqat rasmlari faqat AI tahlil uchun OpenRouter xizmatiga yuboriladi
    va saqlanmaydi.
  </p>

  <h2>5. Ma'lumotlar xavfsizligi</h2>
  <p>
    Barcha ma'lumotlar HTTPS orqali shifrlangan holda uzatiladi.
    Shaxsiy ma'lumotlar qurilmangizning shifrlangan xotirasida saqlanadi.
    Rasmlar serverda doimiy saqlanmaydi.
  </p>

  <h2>6. Foydalanuvchi huquqlari</h2>
  <p>Siz quyidagi huquqlarga egasiz:</p>
  <ul>
    <li>O'z ma'lumotlaringizni ko'rish va o'chirish talabi.</li>
    <li>Ilovadan foydalanishni to'xtatish.</li>
    <li>Akkountingizni va barcha ma'lumotlaringizni istalgan vaqtda o'chirish.</li>
  </ul>
  <p>
    Ma'lumotlaringizni o'chirish uchun:
    <a href="mailto:moydinovjavlonbek5813@gmail.com">moydinovjavlonbek5813@gmail.com</a>
    ga murojaat qiling.
  </p>

  <h2>7. Bolalar maxfiyligi</h2>
  <p>
    Bir Burda 13 yoshdan kichik bolalar uchun mo'ljallanmagan.
    Biz ataylab 13 yoshdan kichik foydalanuvchilardan ma'lumot to'plamaymiz.
  </p>

  <h2>8. O'zgarishlar</h2>
  <p>
    Ushbu siyosat o'zgarganda foydalanuvchilar ilova orqali xabardor qilinadi.
    Ilovadan foydalanishni davom ettirish yangi siyosatga rozilik sifatida
    qabul qilinadi.
  </p>

  <h2>9. Bog'lanish</h2>
  <p>
    Savollar uchun:
    <a href="mailto:moydinovjavlonbek5813@gmail.com">moydinovjavlonbek5813@gmail.com</a>
  </p>
</body>
</html>`);
});

export default router;
