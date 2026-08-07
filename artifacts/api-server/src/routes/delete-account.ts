import { Router } from "express";

const router = Router();

router.get("/", (_req, res) => {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(`<!DOCTYPE html>
<html lang="uz">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Hisobni o'chirish — Bir Burda</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 680px; margin: 0 auto; padding: 32px 16px; color: #1a1a1a; line-height: 1.7; }
    h1 { color: #c0392b; }
    h2 { color: #333; margin-top: 28px; }
    .step { background: #f8f8f8; border-left: 4px solid #c0392b; padding: 12px 16px; margin: 12px 0; border-radius: 4px; }
    .warn { background: #fff8e1; border-left: 4px solid #f39c12; padding: 12px 16px; margin: 20px 0; border-radius: 4px; }
    a { color: #c0392b; }
    .btn { display: inline-block; background: #c0392b; color: white; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: bold; margin-top: 8px; }
  </style>
</head>
<body>
  <h1>Hisobni o'chirish</h1>
  <p>Bir Burda ilovasidagi hisobingizni va barcha shaxsiy ma'lumotlaringizni o'chirish uchun quyidagi ko'rsatmalarga amal qiling.</p>

  <h2>Hisob o'chirish tartibi</h2>

  <div class="step">
    <strong>1-qadam:</strong> Quyidagi email manzilga xat yozing.
  </div>
  <div class="step">
    <strong>2-qadam:</strong> Xat mavzusi: <code>Hisob o'chirish so'rovi</code>
  </div>
  <div class="step">
    <strong>3-qadam:</strong> Xatda ilovaga ro'yxatdan o'tishda ishlatilgan <strong>foydalanuvchi nomi</strong> yoki <strong>Telegram raqamingizni</strong> ko'rsating.
  </div>
  <div class="step">
    <strong>4-qadam:</strong> So'rovingiz <strong>7 ish kuni</strong> ichida ko'rib chiqiladi va hisobingiz o'chiriladi.
  </div>

  <a class="btn" href="mailto:moydinovjavlonbek5813@gmail.com?subject=Hisob%20o%27chirish%20so%27rovi">
    Email yuborish
  </a>

  <div class="warn">
    <strong>⚠️ Diqqat:</strong> Hisob o'chirilganda quyidagi ma'lumotlar butunlay o'chiriladi:
    <ul>
      <li>Shaxsiy ma'lumotlar (ism, yosh, vazn, bo'y)</li>
      <li>Ovqatlanish tarixi va kaloriya yozuvlari</li>
      <li>Obuna ma'lumotlari</li>
      <li>Login va parol</li>
    </ul>
    Bu amalni ortga qaytarib bo'lmaydi.
  </div>

  <h2>Faqat ma'lumotlarni o'chirish (hisob saqlanadi)</h2>
  <p>
    Hisobingizni o'chirmasdan faqat ma'lumotlarni o'chirmoqchi bo'lsangiz, ham yuqoridagi email orqali so'rov yuboring va xatda "faqat ma'lumotlarni o'chirish" deb yozing.
  </p>

  <h2>Bog'lanish</h2>
  <p>Email: <a href="mailto:moydinovjavlonbek5813@gmail.com">moydinovjavlonbek5813@gmail.com</a></p>
  <p><a href="/privacy">Maxfiylik siyosati</a></p>
</body>
</html>`);
});

export default router;
