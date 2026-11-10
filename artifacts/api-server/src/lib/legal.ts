/**
 * Public legal pages (privacy policy, data/account deletion) in English,
 * Uzbek and Russian. These are the URLs given to Google Play, so the text must
 * match what the app and server actually do — update it when behaviour changes.
 */

export type LegalLang = "en" | "uz" | "ru";

const APP = "Kaloria.uz";
const DEVELOPER = "Muydinov Javlonbek";
const EMAIL = process.env["MERCHANT_EMAIL"]?.trim() || "moydinovjavlonbek5813@gmail.com";
const UPDATED: Record<LegalLang, string> = {
  en: "Last updated: 10 November 2026",
  uz: "So'nggi yangilanish: 2026-yil 10-noyabr",
  ru: "Последнее обновление: 10 ноября 2026 г.",
};

export function pickLegalLang(query: unknown, accept: string | undefined): LegalLang {
  if (query === "en" || query === "uz" || query === "ru") return query;
  for (const part of (accept ?? "").split(",")) {
    const base = part.split(";")[0]!.trim().toLowerCase().split("-")[0];
    if (base === "uz" || base === "ru" || base === "en") return base;
  }
  return "en";
}

function shell(lang: LegalLang, title: string, path: string, body: string, extraHead = ""): string {
  const link = (l: LegalLang, label: string) =>
    l === lang ? `<strong>${label}</strong>` : `<a href="${path}?lang=${l}">${label}</a>`;
  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title} — ${APP}</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 800px; margin: 0 auto; padding: 24px 16px; color: #1a1a1a; line-height: 1.7; }
    h1 { color: #193e2c; }
    h2 { color: #333; margin-top: 32px; }
    p { margin: 12px 0; }
    li { margin: 6px 0; }
    a { color: #2d7a2d; }
    .langs { font-size: 14px; color: #666; margin-bottom: 8px; }
    .langs a, .langs strong { margin-right: 12px; }
    .date { color: #888; font-size: 14px; }
    .box { background: #f0faf0; border-left: 4px solid #2d7a2d; padding: 12px 16px; border-radius: 4px; margin: 16px 0; }
    .warn { background: #fff8e1; border-left: 4px solid #f39c12; padding: 12px 16px; border-radius: 4px; margin: 16px 0; }
    .meta { background: #f9f9f9; border: 1px solid #e0e0e0; border-radius: 8px; padding: 16px; margin-bottom: 24px; }
    .meta p { margin: 4px 0; }
    input { font: inherit; padding: 10px 12px; border: 1px solid #bbb; border-radius: 8px; width: 100%; max-width: 340px; box-sizing: border-box; }
    button { font: inherit; padding: 10px 18px; border: 0; border-radius: 8px; background: #c0392b; color: #fff; font-weight: 600; margin-top: 8px; cursor: pointer; }
    #msg { font-weight: 600; margin-top: 10px; }
  </style>
  ${extraHead}
</head>
<body>
  <div class="langs">${link("en", "English")}${link("uz", "O'zbekcha")}${link("ru", "Русский")}</div>
  ${body}
</body>
</html>`;
}

const metaBox = (appLabel: string, devLabel: string, contactLabel: string) => `
  <div class="meta">
    <p><strong>${appLabel}:</strong> ${APP}</p>
    <p><strong>${devLabel}:</strong> ${DEVELOPER}</p>
    <p><strong>${contactLabel}:</strong> <a href="mailto:${EMAIL}">${EMAIL}</a></p>
  </div>`;

// ─── Privacy policy ─────────────────────────────────────────────────────────

const PRIVACY: Record<LegalLang, { title: string; body: string }> = {
  en: {
    title: "Privacy Policy",
    body: `
  <h1>Privacy Policy</h1>
  <p class="date">${UPDATED.en}</p>
  ${metaBox("App", "Developer", "Contact")}
  <p>This policy explains what data the <strong>${APP}</strong> mobile app (calorie and nutrition tracker) and its website handle, why, and what choices you have. The app is intended for adults (18+).</p>

  <h2>1. Data kept on your phone</h2>
  <p>Your profile (name, gender, date of birth, height, weight, goal), food diary, weight log, body measurements, water, steps and fasting records, progress photos and settings are stored on your device. Progress photos never leave the device.</p>

  <h2>2. Data sent to our server</h2>
  <ul>
    <li><strong>AI features.</strong> When you scan a food photo, type a meal, use the AI chat or ask for a meal or workout plan, the photo or text is sent to our server together with the profile details needed for a personal answer (gender, age, height, weight, goal, daily calorie and macro targets) and, for the chat, your food diary for today and yesterday. Our server passes the request to an AI model provider and returns the answer. <strong>Our server does not store these photos, messages or answers.</strong></li>
    <li><strong>Cloud backup (optional, off by default).</strong> If you turn on backup, the data listed in section 1 except photos is uploaded so you can restore it on another phone. It is stored encrypted (AES-256) with a key derived from your personal backup code. The code itself is not stored on the server, so only someone who has the code can read the backup.</li>
    <li><strong>Premium account.</strong> For a Premium account we store the login, a salted hash of the password (never the password itself), the validity period and how many times the account was restored.</li>
    <li><strong>Payments.</strong> Premium is purchased on our website. Payment is made on the page of the payment provider or bank; card details never reach us. We keep the order number, amount, date and status. If you pay through our Telegram bot, we also keep your Telegram ID, username, the name and phone number you provide, and the payment receipt image.</li>
    <li><strong>Installation identifier.</strong> The app creates a random identifier for the installation. It is used only to apply fair-use limits to AI requests and to prevent abuse. It is not linked to your identity and is kept in server memory for up to 24 hours.</li>
    <li><strong>Barcode products.</strong> A scanned barcode number is looked up in our product database and in the public Open Food Facts database. If you add a missing product and choose to share it, its name and nutrition values are saved to the shared database without any information about you.</li>
    <li><strong>Technical logs.</strong> Like any web service, our hosting records the IP address, time and address of requests for security and troubleshooting.</li>
  </ul>
  <p>The app does <strong>not</strong> collect your location, contacts, advertising ID or microphone audio, and it contains no advertising or analytics SDKs.</p>

  <h2>3. How the data is used</h2>
  <ul>
    <li>to calculate your calorie and nutrition plan and analyse your food;</li>
    <li>to answer your questions in the AI chat;</li>
    <li>to back up and restore your data when you ask for it;</li>
    <li>to provide and verify Premium access;</li>
    <li>to protect the service from abuse.</li>
  </ul>
  <p>We do not sell your data and do not use it for advertising.</p>

  <h2>4. Service providers</h2>
  <p>We use other companies only to run the service on our behalf: an AI model provider (currently OpenRouter and the model vendors it routes to, such as Google) to process AI requests; cloud hosting and database providers (currently DigitalOcean and Neon); payment providers and banks for payments; Telegram if you use our bot. They receive only the data needed for their task.</p>

  <h2>5. Security</h2>
  <p>All traffic between the app and the server is encrypted with HTTPS. Cloud backups are encrypted at rest. Passwords are stored only as salted hashes.</p>

  <h2>6. Retention</h2>
  <ul>
    <li>Photos, typed meals and chat messages sent for AI analysis: not stored by our server.</li>
    <li>Cloud backup: until you delete it or ask us to delete it.</li>
    <li>Premium account: until you ask us to delete it.</li>
    <li>Payment records: as long as accounting and tax law requires.</li>
    <li>Technical logs: a limited period needed for security.</li>
  </ul>

  <h2>7. Your choices and deleting your data</h2>
  <ul>
    <li>In the app: Profile → Privacy policy → "Delete all data" removes everything stored on the phone.</li>
    <li>Cloud backup and Premium account: see <a href="/delete-account?lang=en">the data deletion page</a> or email us.</li>
    <li>You can use the app without cloud backup and without a Premium account.</li>
  </ul>

  <h2>8. Health information</h2>
  <div class="box"><p>${APP} gives general nutrition and fitness information. It is not a medical device and does not diagnose, treat or prevent any disease. Talk to a doctor before changing your diet or exercise routine, especially if you are pregnant or have a medical condition.</p></div>

  <h2>9. Children</h2>
  <p>${APP} is intended for people aged 18 and over. We do not knowingly collect data from children. If you believe a child has given us data, contact us and we will delete it.</p>

  <h2>10. Changes</h2>
  <p>If this policy changes, the new version is published on this page with a new date.</p>

  <h2>11. Contact</h2>
  <p><a href="mailto:${EMAIL}">${EMAIL}</a></p>`,
  },
  uz: {
    title: "Maxfiylik siyosati",
    body: `
  <h1>Maxfiylik siyosati</h1>
  <p class="date">${UPDATED.uz}</p>
  ${metaBox("Ilova", "Dasturchi", "Aloqa")}
  <p>Ushbu siyosat <strong>${APP}</strong> mobil ilovasi (kaloriya va ovqatlanish hisobi) hamda uning sayti qanday ma'lumotlar bilan ishlashini, nima uchun ishlashini va sizda qanday tanlovlar borligini tushuntiradi. Ilova kattalar (18+) uchun mo'ljallangan.</p>

  <h2>1. Telefoningizda saqlanadigan ma'lumotlar</h2>
  <p>Profilingiz (ism, jins, tug'ilgan sana, bo'y, vazn, maqsad), ovqatlanish kundaligi, vazn tarixi, tana o'lchovlari, suv, qadam va ochlik yozuvlari, progress suratlari va sozlamalar qurilmangizda saqlanadi. Progress suratlari qurilmadan tashqariga chiqmaydi.</p>

  <h2>2. Serverimizga yuboriladigan ma'lumotlar</h2>
  <ul>
    <li><strong>AI funksiyalari.</strong> Ovqat rasmini skanerlaganingizda, taomni yozganingizda, AI suhbatidan foydalanganingizda yoki ovqat/mashq rejasini so'raganingizda rasm yoki matn serverimizga yuboriladi. U bilan birga shaxsiy javob uchun kerak bo'lgan profil ma'lumotlari (jins, yosh, bo'y, vazn, maqsad, kunlik kaloriya va makro me'yorlari), suhbat uchun esa bugungi va kechagi ovqat kundaligingiz ham yuboriladi. Serverimiz so'rovni AI model provayderiga uzatadi va javobni qaytaradi. <strong>Serverimiz bu rasm, xabar va javoblarni saqlamaydi.</strong></li>
    <li><strong>Bulutli zaxira (ixtiyoriy, standart holatda o'chiq).</strong> Zaxirani yoqsangiz, 1-bo'limdagi ma'lumotlar (suratlardan tashqari) boshqa telefonda tiklash uchun yuklanadi. Ular shaxsiy zaxira kodingizdan olingan kalit bilan shifrlangan (AES-256) holda saqlanadi. Kodning o'zi serverda saqlanmaydi, shuning uchun zaxirani faqat kodga ega odam o'qiy oladi.</li>
    <li><strong>Premium hisob.</strong> Premium hisob uchun login, parolning tuzlangan xeshi (parolning o'zi emas), amal qilish muddati va hisob necha marta tiklangani saqlanadi.</li>
    <li><strong>To'lovlar.</strong> Premium saytimizda sotib olinadi. To'lov to'lov tizimi yoki bank sahifasida amalga oshiriladi, karta ma'lumotlari bizga kelmaydi. Biz buyurtma raqami, summa, sana va holatni saqlaymiz. Telegram botimiz orqali to'lasangiz, Telegram ID, username, siz kiritgan ism va telefon raqami hamda to'lov cheki rasmi ham saqlanadi.</li>
    <li><strong>O'rnatish identifikatori.</strong> Ilova o'rnatish uchun tasodifiy identifikator yaratadi. U faqat AI so'rovlariga adolatli limit qo'yish va suiiste'molning oldini olish uchun ishlatiladi. U shaxsingizga bog'lanmaydi va server xotirasida 24 soatgacha turadi.</li>
    <li><strong>Shtrix-kodli mahsulotlar.</strong> Skanerlangan shtrix-kod raqami mahsulotlar bazamizdan va ochiq Open Food Facts bazasidan qidiriladi. Bazada yo'q mahsulotni qo'shib, ulashishni tanlasangiz, uning nomi va ozuqaviy qiymati siz haqingizda hech qanday ma'lumotsiz umumiy bazaga yoziladi.</li>
    <li><strong>Texnik jurnallar.</strong> Har qanday veb-xizmat kabi, xostingimiz xavfsizlik va nosozliklarni tuzatish uchun so'rovlarning IP manzili, vaqti va manzilini qayd etadi.</li>
  </ul>
  <p>Ilova joylashuvingiz, kontaktlaringiz, reklama identifikatori yoki mikrofon ovozini <strong>yig'maydi</strong>. Unda reklama va analitika SDK'lari yo'q.</p>

  <h2>3. Ma'lumotlar qanday ishlatiladi</h2>
  <ul>
    <li>kaloriya va ovqatlanish rejangizni hisoblash, ovqatni tahlil qilish;</li>
    <li>AI suhbatida savollaringizga javob berish;</li>
    <li>so'rovingiz bo'yicha ma'lumotlarni zaxiralash va tiklash;</li>
    <li>Premium kirishni taqdim etish va tekshirish;</li>
    <li>xizmatni suiiste'moldan himoya qilish.</li>
  </ul>
  <p>Biz ma'lumotlaringizni sotmaymiz va reklama uchun ishlatmaymiz.</p>

  <h2>4. Xizmat ko'rsatuvchilar</h2>
  <p>Boshqa kompaniyalardan faqat xizmatni bizning nomimizdan ishlatish uchun foydalanamiz: AI so'rovlarini qayta ishlash uchun AI model provayderi (hozirda OpenRouter va u yo'naltiradigan model ishlab chiquvchilari, masalan Google); bulutli xosting va ma'lumotlar bazasi provayderlari (hozirda DigitalOcean va Neon); to'lovlar uchun to'lov tizimlari va banklar; botdan foydalansangiz, Telegram. Ular faqat o'z vazifasi uchun zarur ma'lumotni oladi.</p>

  <h2>5. Xavfsizlik</h2>
  <p>Ilova va server o'rtasidagi barcha ma'lumotlar HTTPS orqali shifrlanadi. Bulutli zaxiralar serverda shifrlangan holda saqlanadi. Parollar faqat tuzlangan xesh ko'rinishida saqlanadi.</p>

  <h2>6. Saqlash muddati</h2>
  <ul>
    <li>AI tahlili uchun yuborilgan rasm, matn va suhbat xabarlari: serverimizda saqlanmaydi.</li>
    <li>Bulutli zaxira: siz o'chirguningizcha yoki o'chirishni so'raguningizcha.</li>
    <li>Premium hisob: o'chirishni so'raguningizcha.</li>
    <li>To'lov yozuvlari: buxgalteriya va soliq qonunchiligi talab qilgan muddat davomida.</li>
    <li>Texnik jurnallar: xavfsizlik uchun zarur cheklangan muddat.</li>
  </ul>

  <h2>7. Tanlovlaringiz va ma'lumotlarni o'chirish</h2>
  <ul>
    <li>Ilovada: Profil → Maxfiylik siyosati → "Barcha ma'lumotlarni o'chirish" telefonda saqlangan hamma narsani o'chiradi.</li>
    <li>Bulutli zaxira va Premium hisob: <a href="/delete-account?lang=uz">ma'lumotlarni o'chirish sahifasiga</a> qarang yoki bizga yozing.</li>
    <li>Ilovadan bulutli zaxirasiz va Premium hisobsiz ham foydalanish mumkin.</li>
  </ul>

  <h2>8. Sog'liqqa oid ma'lumot</h2>
  <div class="box"><p>${APP} ovqatlanish va jismoniy faollik bo'yicha umumiy ma'lumot beradi. U tibbiy qurilma emas, kasalliklarga tashxis qo'ymaydi, davolamaydi va oldini olmaydi. Parhez yoki mashq tartibingizni o'zgartirishdan oldin, ayniqsa homilador bo'lsangiz yoki surunkali kasalligingiz bo'lsa, shifokor bilan maslahatlashing.</p></div>

  <h2>9. Bolalar</h2>
  <p>${APP} 18 yosh va undan katta foydalanuvchilar uchun mo'ljallangan. Biz bolalardan ataylab ma'lumot yig'maymiz. Agar bola bizga ma'lumot bergan deb hisoblasangiz, biz bilan bog'laning, uni o'chiramiz.</p>

  <h2>10. O'zgarishlar</h2>
  <p>Siyosat o'zgarsa, yangi tahriri shu sahifada yangi sana bilan e'lon qilinadi.</p>

  <h2>11. Aloqa</h2>
  <p><a href="mailto:${EMAIL}">${EMAIL}</a></p>`,
  },
  ru: {
    title: "Политика конфиденциальности",
    body: `
  <h1>Политика конфиденциальности</h1>
  <p class="date">${UPDATED.ru}</p>
  ${metaBox("Приложение", "Разработчик", "Контакт")}
  <p>Эта политика объясняет, какие данные обрабатывают мобильное приложение <strong>${APP}</strong> (подсчёт калорий и питания) и его сайт, зачем это нужно и какой у вас есть выбор. Приложение предназначено для взрослых (18+).</p>

  <h2>1. Данные, которые хранятся на телефоне</h2>
  <p>Профиль (имя, пол, дата рождения, рост, вес, цель), дневник питания, история веса, замеры тела, записи о воде, шагах и голодании, фото прогресса и настройки хранятся на вашем устройстве. Фото прогресса не покидают устройство.</p>

  <h2>2. Данные, которые отправляются на наш сервер</h2>
  <ul>
    <li><strong>Функции ИИ.</strong> Когда вы сканируете фото еды, вводите блюдо текстом, пользуетесь ИИ-чатом или запрашиваете план питания либо тренировок, фото или текст отправляется на наш сервер вместе с данными профиля, нужными для персонального ответа (пол, возраст, рост, вес, цель, дневные нормы калорий и макронутриентов), а для чата — ещё и дневник питания за сегодня и вчера. Сервер передаёт запрос поставщику ИИ-модели и возвращает ответ. <strong>Наш сервер не хранит эти фото, сообщения и ответы.</strong></li>
    <li><strong>Облачная резервная копия (по желанию, по умолчанию выключена).</strong> Если вы включите копирование, данные из раздела 1, кроме фото, загружаются, чтобы их можно было восстановить на другом телефоне. Они хранятся в зашифрованном виде (AES-256), ключ получается из вашего личного кода резервной копии. Сам код на сервере не хранится, поэтому прочитать копию может только тот, у кого есть код.</li>
    <li><strong>Премиум-аккаунт.</strong> Для премиум-аккаунта мы храним логин, хеш пароля с солью (не сам пароль), срок действия и число восстановлений аккаунта.</li>
    <li><strong>Платежи.</strong> Премиум покупается на нашем сайте. Оплата проходит на странице платёжной системы или банка, данные карты к нам не попадают. Мы храним номер заказа, сумму, дату и статус. Если вы платите через нашего Telegram-бота, мы также храним ваш Telegram ID, имя пользователя, указанные вами имя и номер телефона и изображение чека.</li>
    <li><strong>Идентификатор установки.</strong> Приложение создаёт случайный идентификатор установки. Он используется только для справедливых лимитов на запросы к ИИ и защиты от злоупотреблений. Он не связан с вашей личностью и хранится в памяти сервера до 24 часов.</li>
    <li><strong>Товары по штрихкоду.</strong> Номер отсканированного штрихкода ищется в нашей базе продуктов и в открытой базе Open Food Facts. Если вы добавляете отсутствующий продукт и решаете поделиться им, его название и пищевая ценность сохраняются в общей базе без каких-либо сведений о вас.</li>
    <li><strong>Технические журналы.</strong> Как и любой веб-сервис, наш хостинг записывает IP-адрес, время и адрес запросов для безопасности и устранения неполадок.</li>
  </ul>
  <p>Приложение <strong>не</strong> собирает ваше местоположение, контакты, рекламный идентификатор и звук с микрофона. В нём нет рекламных и аналитических SDK.</p>

  <h2>3. Как используются данные</h2>
  <ul>
    <li>для расчёта плана калорий и питания и анализа еды;</li>
    <li>для ответов на ваши вопросы в ИИ-чате;</li>
    <li>для резервного копирования и восстановления данных по вашему запросу;</li>
    <li>для предоставления и проверки премиум-доступа;</li>
    <li>для защиты сервиса от злоупотреблений.</li>
  </ul>
  <p>Мы не продаём ваши данные и не используем их для рекламы.</p>

  <h2>4. Поставщики услуг</h2>
  <p>Мы привлекаем другие компании только для работы сервиса от нашего имени: поставщика ИИ-моделей (сейчас OpenRouter и разработчики моделей, к которым он направляет запросы, например Google) для обработки запросов к ИИ; поставщиков облачного хостинга и базы данных (сейчас DigitalOcean и Neon); платёжные системы и банки для платежей; Telegram, если вы пользуетесь ботом. Они получают только данные, необходимые для их задачи.</p>

  <h2>5. Безопасность</h2>
  <p>Весь обмен данными между приложением и сервером шифруется по HTTPS. Облачные копии хранятся в зашифрованном виде. Пароли хранятся только в виде хешей с солью.</p>

  <h2>6. Сроки хранения</h2>
  <ul>
    <li>Фото, текст и сообщения чата, отправленные на анализ ИИ: на нашем сервере не хранятся.</li>
    <li>Облачная копия: пока вы её не удалите или не попросите нас удалить.</li>
    <li>Премиум-аккаунт: пока вы не попросите его удалить.</li>
    <li>Записи о платежах: столько, сколько требует бухгалтерское и налоговое законодательство.</li>
    <li>Технические журналы: ограниченный срок, необходимый для безопасности.</li>
  </ul>

  <h2>7. Ваш выбор и удаление данных</h2>
  <ul>
    <li>В приложении: Профиль → Политика конфиденциальности → «Удалить все данные» удаляет всё, что хранится на телефоне.</li>
    <li>Облачная копия и премиум-аккаунт: см. <a href="/delete-account?lang=ru">страницу удаления данных</a> или напишите нам.</li>
    <li>Приложением можно пользоваться без облачной копии и без премиум-аккаунта.</li>
  </ul>

  <h2>8. Информация о здоровье</h2>
  <div class="box"><p>${APP} даёт общую информацию о питании и физической активности. Это не медицинское изделие, оно не диагностирует, не лечит и не предотвращает заболевания. Перед изменением рациона или режима тренировок, особенно при беременности или хронических заболеваниях, посоветуйтесь с врачом.</p></div>

  <h2>9. Дети</h2>
  <p>${APP} предназначено для пользователей от 18 лет. Мы сознательно не собираем данные детей. Если вы считаете, что ребёнок передал нам данные, свяжитесь с нами, и мы их удалим.</p>

  <h2>10. Изменения</h2>
  <p>Если политика изменится, новая редакция будет опубликована на этой странице с новой датой.</p>

  <h2>11. Контакт</h2>
  <p><a href="mailto:${EMAIL}">${EMAIL}</a></p>`,
  },
};

export function renderPrivacy(lang: LegalLang): string {
  const p = PRIVACY[lang];
  return shell(lang, p.title, "/privacy", p.body);
}

// ─── Account and data deletion ──────────────────────────────────────────────

interface DeleteText {
  title: string;
  intro: string;
  phoneH: string;
  phoneP: string;
  backupH: string;
  backupP: string;
  codeLabel: string;
  button: string;
  confirm: string;
  ok: string;
  notFound: string;
  badCode: string;
  failed: string;
  accountH: string;
  steps: string[];
  mailSubject: string;
  mailButton: string;
  deletedH: string;
  deleted: string[];
  keptH: string;
  kept: string;
  privacy: string;
}

const DELETION: Record<LegalLang, DeleteText> = {
  en: {
    title: "Delete your account and data",
    intro: `How to delete the data that the <strong>${APP}</strong> app (developer: ${DEVELOPER}) holds about you.`,
    phoneH: "1. Data on your phone",
    phoneP: `Open the app → Profile → Privacy policy → <strong>"Delete all data"</strong>. Everything stored on the phone is erased immediately. Uninstalling the app has the same effect.`,
    backupH: "2. Cloud backup",
    backupP: "If you turned on cloud backup, enter your backup code to delete the copy stored on our server. This takes effect immediately and cannot be undone.",
    codeLabel: "Backup code (UZD-XXXX-XXXX-XXXX-XXXX)",
    button: "Delete cloud backup",
    confirm: "Delete the cloud backup for this code permanently?",
    ok: "The cloud backup has been deleted.",
    notFound: "No backup was found for this code.",
    badCode: "The code is not in the right format.",
    failed: "Could not delete right now. Please try again later or email us.",
    accountH: "3. Premium account",
    steps: [
      `Send an email to <a href="mailto:${EMAIL}">${EMAIL}</a>.`,
      "Use the subject: <code>Account deletion request</code>.",
      "Include your Premium login (for example DAI-ABC234) or the Telegram username you paid from. Do not send your password.",
      "We delete the account within <strong>7 working days</strong> and confirm by reply.",
    ],
    mailSubject: "Account deletion request",
    mailButton: "Send email",
    deletedH: "What is deleted",
    deleted: [
      "Premium login, password hash and validity period;",
      "name, phone number, Telegram ID and username linked to the purchase;",
      "the payment receipt image, if you paid through the Telegram bot;",
      "your cloud backup, if you delete it with the form above.",
    ],
    keptH: "What may be kept",
    kept: "Payment records (order number, amount, date) may be kept for as long as accounting and tax law requires, without your profile or health data. Technical logs expire on their own after a limited period.",
    privacy: "Privacy policy",
  },
  uz: {
    title: "Hisob va ma'lumotlarni o'chirish",
    intro: `<strong>${APP}</strong> ilovasi (dasturchi: ${DEVELOPER}) siz haqingizda saqlaydigan ma'lumotlarni qanday o'chirish mumkin.`,
    phoneH: "1. Telefondagi ma'lumotlar",
    phoneP: `Ilovani oching → Profil → Maxfiylik siyosati → <strong>"Barcha ma'lumotlarni o'chirish"</strong>. Telefonda saqlangan hamma narsa darhol o'chadi. Ilovani o'chirib tashlash ham xuddi shunday ta'sir qiladi.`,
    backupH: "2. Bulutli zaxira",
    backupP: "Bulutli zaxirani yoqqan bo'lsangiz, serverimizdagi nusxani o'chirish uchun zaxira kodingizni kiriting. O'chirish darhol kuchga kiradi va uni ortga qaytarib bo'lmaydi.",
    codeLabel: "Zaxira kodi (UZD-XXXX-XXXX-XXXX-XXXX)",
    button: "Bulutli zaxirani o'chirish",
    confirm: "Shu kodga tegishli bulutli zaxira butunlay o'chirilsinmi?",
    ok: "Bulutli zaxira o'chirildi.",
    notFound: "Bu kod bilan zaxira topilmadi.",
    badCode: "Kod noto'g'ri formatda.",
    failed: "Hozir o'chirib bo'lmadi. Keyinroq urinib ko'ring yoki bizga yozing.",
    accountH: "3. Premium hisob",
    steps: [
      `<a href="mailto:${EMAIL}">${EMAIL}</a> manziliga xat yuboring.`,
      "Xat mavzusi: <code>Hisobni o'chirish so'rovi</code>.",
      "Premium loginingizni (masalan DAI-ABC234) yoki to'lov qilgan Telegram username'ingizni yozing. Parolni yubormang.",
      "Hisobni <strong>7 ish kuni</strong> ichida o'chiramiz va javob xati bilan tasdiqlaymiz.",
    ],
    mailSubject: "Hisobni o'chirish so'rovi",
    mailButton: "Xat yuborish",
    deletedH: "Nimalar o'chiriladi",
    deleted: [
      "Premium login, parol xeshi va amal qilish muddati;",
      "xaridga bog'langan ism, telefon raqami, Telegram ID va username;",
      "Telegram bot orqali to'lagan bo'lsangiz, to'lov cheki rasmi;",
      "yuqoridagi shakl orqali o'chirsangiz, bulutli zaxirangiz.",
    ],
    keptH: "Nimalar saqlanib qolishi mumkin",
    kept: "To'lov yozuvlari (buyurtma raqami, summa, sana) buxgalteriya va soliq qonunchiligi talab qilgan muddat davomida, profil va sog'liq ma'lumotlarisiz saqlanishi mumkin. Texnik jurnallar cheklangan muddatdan keyin o'zi o'chadi.",
    privacy: "Maxfiylik siyosati",
  },
  ru: {
    title: "Удаление аккаунта и данных",
    intro: `Как удалить данные, которые приложение <strong>${APP}</strong> (разработчик: ${DEVELOPER}) хранит о вас.`,
    phoneH: "1. Данные на телефоне",
    phoneP: `Откройте приложение → Профиль → Политика конфиденциальности → <strong>«Удалить все данные»</strong>. Всё, что хранится на телефоне, удаляется сразу. Удаление приложения даёт тот же результат.`,
    backupH: "2. Облачная резервная копия",
    backupP: "Если вы включали облачную копию, введите код резервной копии, чтобы удалить её с нашего сервера. Удаление происходит сразу и необратимо.",
    codeLabel: "Код резервной копии (UZD-XXXX-XXXX-XXXX-XXXX)",
    button: "Удалить облачную копию",
    confirm: "Удалить облачную копию для этого кода без возможности восстановления?",
    ok: "Облачная копия удалена.",
    notFound: "Копия с таким кодом не найдена.",
    badCode: "Неверный формат кода.",
    failed: "Сейчас удалить не удалось. Попробуйте позже или напишите нам.",
    accountH: "3. Премиум-аккаунт",
    steps: [
      `Отправьте письмо на <a href="mailto:${EMAIL}">${EMAIL}</a>.`,
      "Тема письма: <code>Запрос на удаление аккаунта</code>.",
      "Укажите ваш премиум-логин (например DAI-ABC234) или имя пользователя Telegram, с которого вы платили. Пароль не отправляйте.",
      "Мы удалим аккаунт в течение <strong>7 рабочих дней</strong> и подтвердим ответным письмом.",
    ],
    mailSubject: "Запрос на удаление аккаунта",
    mailButton: "Отправить письмо",
    deletedH: "Что удаляется",
    deleted: [
      "премиум-логин, хеш пароля и срок действия;",
      "имя, номер телефона, Telegram ID и имя пользователя, связанные с покупкой;",
      "изображение чека, если вы платили через Telegram-бота;",
      "ваша облачная копия, если вы удалите её через форму выше.",
    ],
    keptH: "Что может сохраняться",
    kept: "Записи о платежах (номер заказа, сумма, дата) могут храниться столько, сколько требует бухгалтерское и налоговое законодательство, без данных профиля и здоровья. Технические журналы удаляются сами по истечении ограниченного срока.",
    privacy: "Политика конфиденциальности",
  },
};

export function renderDeletion(lang: LegalLang, nonce: string): string {
  const t = DELETION[lang];
  const js = JSON.stringify({ confirm: t.confirm, ok: t.ok, notFound: t.notFound, badCode: t.badCode, failed: t.failed });
  const body = `
  <h1>${t.title}</h1>
  <p class="date">${UPDATED[lang]}</p>
  <p>${t.intro}</p>

  <h2>${t.phoneH}</h2>
  <p>${t.phoneP}</p>

  <h2>${t.backupH}</h2>
  <p>${t.backupP}</p>
  <form id="f">
    <label for="code">${t.codeLabel}</label><br />
    <input id="code" name="code" autocomplete="off" autocapitalize="characters" spellcheck="false" maxlength="40" required />
    <br /><button type="submit">${t.button}</button>
    <p id="msg" role="status"></p>
  </form>

  <h2>${t.accountH}</h2>
  <ol>${t.steps.map((s) => `<li>${s}</li>`).join("")}</ol>
  <p><a href="mailto:${EMAIL}?subject=${encodeURIComponent(t.mailSubject)}">${t.mailButton}</a></p>

  <h2>${t.deletedH}</h2>
  <ul>${t.deleted.map((s) => `<li>${s}</li>`).join("")}</ul>

  <h2>${t.keptH}</h2>
  <div class="warn"><p>${t.kept}</p></div>

  <p><a href="/privacy?lang=${lang}">${t.privacy}</a></p>
  <script nonce="${nonce}">
    (function () {
      var T = ${js};
      var f = document.getElementById("f"), msg = document.getElementById("msg");
      f.addEventListener("submit", function (e) {
        e.preventDefault();
        var raw = document.getElementById("code").value.toUpperCase().replace(/[^A-Z2-7]/g, "");
        if (raw.indexOf("UZD") === 0) raw = raw.slice(3);
        if (raw.length !== 16) { msg.textContent = T.badCode; return; }
        var code = "UZD-" + raw.slice(0, 4) + "-" + raw.slice(4, 8) + "-" + raw.slice(8, 12) + "-" + raw.slice(12, 16);
        if (!window.confirm(T.confirm)) return;
        msg.textContent = "…";
        fetch("/api/backup", { method: "DELETE", headers: { "x-backup-code": code } })
          .then(function (r) { msg.textContent = r.ok ? T.ok : r.status === 404 ? T.notFound : T.failed; if (r.ok) f.reset(); })
          .catch(function () { msg.textContent = T.failed; });
      });
    })();
  </script>`;
  return shell(lang, t.title, "/delete-account", body);
}
