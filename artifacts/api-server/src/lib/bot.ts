import { db, paymentsTable, botUsersTable, promoCodesTable } from "@workspace/db";
import { eq, and, count, sum, gt, sql } from "drizzle-orm";
import { logger } from "./logger";
import * as tg from "./telegram";
import { generateLogin, generatePassword, hashPassword } from "./credentials";

const CARD_NUMBER = process.env.PAYMENT_CARD_NUMBER ?? "9860160606136655";
const CARD_OWNER  = process.env.PAYMENT_CARD_OWNER  ?? "";

// ─── Admin pending holatlar ──────────────────────────────────────────────────
type AdminPending =
  | { action: "awaiting_amount"; paymentId: string; messageId: number }
  | { action: "awaiting_partial"; paymentId: string; messageId: number }
  | { action: "awaiting_broadcast" }
  | { action: "awaiting_rejection_reason"; paymentId: string; userChatId: string }
  | { action: "awaiting_promo_code" }
  | { action: "awaiting_promo_discount"; code: string };

const adminPending = new Map<string, AdminPending>();

// ─── Mijoz pending holatlar ───────────────────────────────────────────────────
type ClientPending = { action: "awaiting_promo_code" };
const clientPending = new Map<string, ClientPending>();

// ─── Tugmalar ────────────────────────────────────────────────────────────────
function paymentKeyboard(paymentId: string) {
  return {
    inline_keyboard: [
      [
        { text: "✅ Tasdiqlash (1 yil)", callback_data: `approve:${paymentId}` },
        { text: "❌ Rad etish", callback_data: `reject:${paymentId}` },
      ],
      [
        { text: "💸 Qisman to'lov", callback_data: `partial:${paymentId}` },
        { text: "💰 Umumiy summa", callback_data: `amount:${paymentId}` },
      ],
    ],
  };
}

function clientMenuKeyboard() {
  return {
    inline_keyboard: [
      [{ text: "📤 Chek yuborish", callback_data: "cli:send_receipt" }],
      [
        { text: "💳 Karta raqami", callback_data: "cli:show_card" },
        { text: "📊 Holatim", callback_data: "cli:my_status" },
      ],
      [
        { text: "🎟 Promokod ishlatish", callback_data: "cli:promo" },
        { text: "❓ Yordam", callback_data: "cli:help" },
      ],
    ],
  };
}

function payRestKeyboard() {
  return {
    inline_keyboard: [
      [{ text: "✅ To'lovni yakunlash", callback_data: "cli:send_receipt" }],
      [
        { text: "💳 Karta raqami", callback_data: "cli:show_card" },
        { text: "❓ Yordam", callback_data: "cli:help" },
      ],
    ],
  };
}

function resendReceiptKeyboard() {
  return {
    inline_keyboard: [
      [{ text: "🔁 Qayta chek yuborish", callback_data: "cli:send_receipt" }],
      [{ text: "❓ Yordam", callback_data: "cli:help" }],
    ],
  };
}

function adminMenuKeyboard() {
  return {
    inline_keyboard: [
      [
        { text: "📊 Statistika", callback_data: "menu:stats" },
        { text: "👥 Foydalanuvchilar", callback_data: "menu:users" },
      ],
      [
        { text: "📣 Reklama yuborish", callback_data: "menu:broadcast" },
        { text: "🎟 Promokodlar", callback_data: "menu:promo" },
      ],
    ],
  };
}

function promoListKeyboard(codes: { code: string; discount: number }[]) {
  const rows = codes.map((c) => [
    { text: `🗑 ${c.code} (−${fmtAmount(c.discount)})`, callback_data: `promo:del:${c.code}` },
  ]);
  rows.push([{ text: "➕ Yangi promokod yaratish", callback_data: "promo:create" }]);
  rows.push([{ text: "🔙 Admin menyu", callback_data: "menu:back" }]);
  return { inline_keyboard: rows };
}

// ─── Formatlash ──────────────────────────────────────────────────────────────
function fmtAmount(n: number) {
  return n.toLocaleString("ru-RU").replace(/,/g, " ") + " so'm";
}

function buildPaymentCaption(p: {
  id: string;
  name: string | null;
  phone: string | null;
  amount: number;
  paidAmount?: number | null;
  originalAmount?: number | null;
  promoCode?: string | null;
  telegramUsername: string | null;
  telegramName: string | null;
  status: string;
}) {
  const tag =
    p.status === "approved"
      ? "✅ <b>TASDIQLANDI</b>\n\n"
      : p.status === "rejected"
        ? "❌ <b>RAD ETILDI</b>\n\n"
        : p.status === "redeemed"
          ? "🎉 <b>FAOLLASHTIRILDI</b>\n\n"
          : p.status === "partial"
            ? "💸 <b>Qisman to'langan</b>\n\n"
            : "💳 <b>Yangi so'rov</b>\n\n";

  const tgLine = p.telegramUsername
    ? `📨 Telegram: @${p.telegramUsername}\n`
    : p.telegramName
      ? `📨 Telegram: ${p.telegramName}\n`
      : "";

  const paid = p.paidAmount ?? 0;
  const remaining = Math.max(0, p.amount - paid);

  const promoLine = p.promoCode
    ? `🎟 Promokod: <code>${p.promoCode}</code> (asl: ${fmtAmount(p.originalAmount ?? p.amount)})\n`
    : "";

  const amountBlock =
    paid > 0
      ? `💰 Umumiy: <b>${fmtAmount(p.amount)}</b>\n` +
        `✅ To'langan: <b>${fmtAmount(paid)}</b>\n` +
        `🧾 Qoldiq: <b>${fmtAmount(remaining)}</b>\n`
      : `💰 Summa: <b>${fmtAmount(p.amount)}</b>\n`;

  return (
    `${tag}` +
    `👤 Ism: <b>${p.name || "—"}</b>\n` +
    (p.phone ? `📱 Tel: ${p.phone}\n` : "") +
    tgLine +
    promoLine +
    amountBlock +
    `🆔 ID: <code>${p.id.slice(0, 8).toUpperCase()}</code>`
  );
}

// ─── Statistika ──────────────────────────────────────────────────────────────
async function buildStatsText(): Promise<string> {
  const now = new Date();

  const [botUsersRow] = await db.select({ total: count() }).from(botUsersTable);
  const totalBotUsers = botUsersRow?.total ?? 0;

  const statusRows = await db
    .select({ status: paymentsTable.status, cnt: count() })
    .from(paymentsTable)
    .groupBy(paymentsTable.status);

  const statusMap: Record<string, number> = {};
  for (const r of statusRows) statusMap[r.status] = r.cnt;

  const [activeRow] = await db
    .select({ cnt: count() })
    .from(paymentsTable)
    .where(and(eq(paymentsTable.status, "redeemed"), gt(paymentsTable.premiumUntil, now)));
  const activePremium = activeRow?.cnt ?? 0;

  const [revenueRow] = await db
    .select({ total: sum(paymentsTable.amount) })
    .from(paymentsTable)
    .where(sql`${paymentsTable.status} IN ('approved', 'redeemed')`);
  const revenue = Number(revenueRow?.total ?? 0);

  const promoCodes = await db.select({ code: promoCodesTable.code, cnt: promoCodesTable.usedCount }).from(promoCodesTable).where(eq(promoCodesTable.isActive, true));
  const promoLine = promoCodes.length > 0
    ? `\n🎟 Faol promokodlar: <b>${promoCodes.length}</b> ta`
    : "";

  return (
    `📊 <b>BIR BURDA — STATISTIKA</b>\n\n` +
    `👥 Bot foydalanuvchilari: <b>${totalBotUsers}</b>\n\n` +
    `💳 <b>To'lovlar holati:</b>\n` +
    `  ⏳ Kutilmoqda: ${statusMap["pending"] ?? 0}\n` +
    `  🔗 Bog'landi: ${statusMap["linked"] ?? 0}\n` +
    `  📩 Ko'rib chiqilmoqda: ${statusMap["submitted"] ?? 0}\n` +
    `  ✅ Tasdiqlangan: ${statusMap["approved"] ?? 0}\n` +
    `  🎉 Faollashtirilgan: ${statusMap["redeemed"] ?? 0}\n` +
    `  ❌ Rad etilgan: ${statusMap["rejected"] ?? 0}\n\n` +
    `⭐ Faol premium: <b>${activePremium}</b>\n` +
    `💰 Jami daromad: <b>${fmtAmount(revenue)}</b>` +
    promoLine
  );
}

// ─── So'nggi foydalanuvchilar ─────────────────────────────────────────────────
async function buildUsersText(): Promise<string> {
  const users = await db
    .select()
    .from(botUsersTable)
    .orderBy(sql`${botUsersTable.lastSeen} DESC`)
    .limit(10);

  if (users.length === 0) return "👥 Hali foydalanuvchilar yo'q.";

  const lines = users.map((u, i) => {
    const uname = u.username ? `@${u.username}` : u.name || "nomsiz";
    const date = u.lastSeen ? new Date(u.lastSeen).toLocaleDateString("uz-UZ") : "—";
    return `${i + 1}. <code>${u.chatId}</code> — ${uname} (${date})`;
  });

  return `👥 <b>So'nggi 10 foydalanuvchi:</b>\n\n` + lines.join("\n");
}

// ─── Promokodlar ro'yxati ─────────────────────────────────────────────────────
async function buildPromoListText(): Promise<string> {
  const codes = await db.select().from(promoCodesTable).where(eq(promoCodesTable.isActive, true));
  if (codes.length === 0) return `🎟 <b>Promokodlar</b>\n\nHozircha faol promokod yo'q.`;

  const lines = codes.map((c) =>
    `• <code>${c.code}</code> — −${fmtAmount(c.discount)}` +
    (c.description ? ` (${c.description})` : "") +
    ` | Ishlatildi: ${c.usedCount} marta`
  );
  return `🎟 <b>Faol promokodlar (${codes.length} ta):</b>\n\n` + lines.join("\n");
}

// ─── Tasdiqlash (1 yil) ──────────────────────────────────────────────────────
async function approvePayment(paymentId: string, durationMs = 365 * 24 * 60 * 60 * 1000) {
  const rows = await db.select().from(paymentsTable).where(eq(paymentsTable.id, paymentId));
  const p = rows[0];
  if (!p) return { ok: false as const, error: "not_found" };
  if (p.status !== "submitted") return { ok: false as const, error: "bad_state", status: p.status };

  const login = generateLogin();
  const password = generatePassword();
  const { hash, salt } = hashPassword(password);
  const premiumUntil = new Date(Date.now() + durationMs);

  const updated = await db
    .update(paymentsTable)
    .set({ status: "approved", login, passwordHash: hash, passwordSalt: salt, passwordUsed: false, approvedAt: new Date(), premiumUntil, updatedAt: new Date() })
    .where(and(eq(paymentsTable.id, paymentId), eq(paymentsTable.status, "submitted")))
    .returning({ id: paymentsTable.id });

  if (updated.length === 0) {
    const fresh = await db.select().from(paymentsTable).where(eq(paymentsTable.id, paymentId));
    return { ok: false as const, error: "bad_state", status: fresh[0]?.status ?? "unknown" };
  }

  const durationLabel = durationMs < 2 * 24 * 60 * 60 * 1000 ? "1 kunlik" : "Yillik";

  if (p.telegramChatId) {
    await tg.sendMessage(
      p.telegramChatId,
      `✅ <b>Tasdiqlandi!</b>\n\n` +
      `${durationLabel} kirish uchun quyidagi <b>login va parolni</b> ilovaning faollashtirish bo'limiga kiriting.\n\n` +
      `🔑 <b>Login:</b>\n<code>${login}</code>\n\n` +
      `🔒 <b>Parol:</b>\n<code>${password}</code>\n\n` +
      `⚠️ <i>Parol faqat <b>1 marta</b> ishlaydi.</i>`,
    );
  }

  return { ok: true as const, login };
}

// ─── Rad etish ───────────────────────────────────────────────────────────────
async function rejectPayment(paymentId: string, reason?: string | null) {
  const rows = await db.select().from(paymentsTable).where(eq(paymentsTable.id, paymentId));
  const p = rows[0];
  if (!p) return { ok: false as const, error: "not_found" };
  if (p.status !== "submitted") return { ok: false as const, error: "bad_state", status: p.status };

  const updated = await db
    .update(paymentsTable)
    .set({ status: "rejected", rejectedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(paymentsTable.id, paymentId), eq(paymentsTable.status, "submitted")))
    .returning({ id: paymentsTable.id });

  if (updated.length === 0) {
    const fresh = await db.select().from(paymentsTable).where(eq(paymentsTable.id, paymentId));
    return { ok: false as const, error: "bad_state", status: fresh[0]?.status ?? "unknown" };
  }

  if (p.telegramChatId) {
    const msg = reason
      ? `❌ <b>So'rovingiz rad etildi.</b>\n\n📝 <b>Sabab:</b> ${reason}\n\nTo'g'ri to'lov chekini qaytadan yuborishingiz mumkin.`
      : `❌ <b>So'rovingiz rad etildi.</b>\n\nTo'g'ri to'lov chekini qaytadan yuborishingiz mumkin.`;
    await tg.sendMessage(p.telegramChatId, msg, { replyMarkup: resendReceiptKeyboard() });
  }
  return { ok: true as const };
}

// ─── Summani o'zgartirish ─────────────────────────────────────────────────────
async function setPaymentAmount(paymentId: string, newAmount: number) {
  await db.update(paymentsTable).set({ amount: newAmount, updatedAt: new Date() }).where(eq(paymentsTable.id, paymentId));
}

// ─── Admin xabarini yangilash ─────────────────────────────────────────────────
async function refreshAdminMessage(paymentId: string) {
  const rows = await db.select().from(paymentsTable).where(eq(paymentsTable.id, paymentId));
  const p = rows[0];
  if (!p || !p.adminChatId || !p.adminMessageId) return;
  const caption = buildPaymentCaption(p);
  if (["approved", "rejected", "redeemed"].includes(p.status)) {
    await tg.editMessageCaption(p.adminChatId, p.adminMessageId, caption, { inline_keyboard: [] });
  } else {
    await tg.editMessageCaption(p.adminChatId, p.adminMessageId, caption, paymentKeyboard(paymentId));
  }
}

// ─── Broadcast ───────────────────────────────────────────────────────────────
async function broadcastMessage(text: string, adminChatId: string): Promise<{ sent: number; failed: number }> {
  const users = await db.select({ chatId: botUsersTable.chatId }).from(botUsersTable);
  let sent = 0;
  let failed = 0;
  for (const u of users) {
    if (u.chatId === adminChatId) continue;
    try {
      await tg.sendMessage(u.chatId, text);
      sent++;
      await new Promise((r) => setTimeout(r, 40));
    } catch {
      failed++;
    }
  }
  return { sent, failed };
}

// ─── Bot user ni saqlash/yangilash ───────────────────────────────────────────
async function upsertBotUser(chatId: string, username?: string, name?: string) {
  try {
    await db
      .insert(botUsersTable)
      .values({ chatId, username: username ?? null, name: name ?? null })
      .onConflictDoUpdate({
        target: botUsersTable.chatId,
        set: { username: username ?? null, name: name ?? null, lastSeen: new Date() },
      });
  } catch (err) {
    logger.warn({ err, chatId }, "upsertBotUser failed");
  }
}

// ─── Qisman to'lov ───────────────────────────────────────────────────────────
async function recordPartialPayment(paymentId: string, addAmount: number) {
  const rows = await db.select().from(paymentsTable).where(eq(paymentsTable.id, paymentId));
  const p = rows[0];
  if (!p) return { ok: false as const, error: "not_found" };

  const newPaid = (p.paidAmount ?? 0) + addAmount;
  const remaining = p.amount - newPaid;
  const fullyPaid = remaining <= 0;

  await db
    .update(paymentsTable)
    .set({ paidAmount: fullyPaid ? p.amount : newPaid, status: fullyPaid ? "submitted" : "partial", updatedAt: new Date() })
    .where(eq(paymentsTable.id, paymentId));

  if (p.telegramChatId) {
    if (fullyPaid) {
      await tg.sendMessage(
        p.telegramChatId,
        `✅ <b>To'lov to'liq qabul qilindi!</b>\n\n💰 Umumiy: <b>${fmtAmount(p.amount)}</b>\n✅ To'langan: <b>${fmtAmount(p.amount)}</b>\n\n⏳ Admin yakuniy tasdiqdan o'tkazmoqda — login va parol tez orada yuboriladi.`,
      );
    } else {
      await tg.sendMessage(
        p.telegramChatId,
        `💸 <b>Qisman to'lov qabul qilindi.</b>\n\n💰 Umumiy: <b>${fmtAmount(p.amount)}</b>\n✅ To'langan: <b>${fmtAmount(newPaid)}</b>\n🧾 <b>Qolgan qarz: ${fmtAmount(remaining)}</b>\n\nQolgan summani to'lab, chek yuboring:\n` + buildPaymentDetailsRemaining(remaining),
        { replyMarkup: payRestKeyboard() },
      );
    }
  }
  return { ok: true as const, fullyPaid, remaining: Math.max(0, remaining), newPaid };
}

function buildPaymentDetails(amount: number) {
  const cardLine = CARD_NUMBER
    ? `💳 <b>Karta raqami:</b>\n<code>${CARD_NUMBER}</code>\n` + (CARD_OWNER ? `👤 <b>Karta egasi:</b> ${CARD_OWNER}\n` : "")
    : "";
  return cardLine + `💰 <b>To'lov summasi:</b> ${fmtAmount(amount)}\n`;
}

function buildPaymentDetailsRemaining(remaining: number) {
  const cardLine = CARD_NUMBER
    ? `💳 <b>Karta raqami:</b>\n<code>${CARD_NUMBER}</code>\n` + (CARD_OWNER ? `👤 <b>Karta egasi:</b> ${CARD_OWNER}\n` : "")
    : "";
  return cardLine + `🧾 <b>To'lash kerak:</b> ${fmtAmount(remaining)}\n`;
}

// ─── Mijozning faol to'lovini topish ─────────────────────────────────────────
async function findActivePayment(chatId: string) {
  const rows = await db
    .select()
    .from(paymentsTable)
    .where(and(eq(paymentsTable.telegramChatId, chatId), sql`${paymentsTable.status} IN ('linked', 'partial', 'rejected')`))
    .orderBy(sql`${paymentsTable.updatedAt} DESC`)
    .limit(1);
  return rows[0] ?? null;
}

// ─── Promokod qo'llash (mijoz) ────────────────────────────────────────────────
async function applyPromoCode(chatId: string, codeInput: string): Promise<{
  ok: boolean;
  error?: "not_found" | "no_payment" | "already_used" | "already_has_promo";
  discount?: number;
  originalAmount?: number;
  newAmount?: number;
}> {
  const code = codeInput.trim().toUpperCase();

  const payment = await findActivePayment(chatId);
  if (!payment) return { ok: false, error: "no_payment" };
  if (payment.promoCode) return { ok: false, error: "already_has_promo" };

  const [promo] = await db.select().from(promoCodesTable).where(and(eq(promoCodesTable.code, code), eq(promoCodesTable.isActive, true)));
  if (!promo) return { ok: false, error: "not_found" };

  const originalAmount = payment.originalAmount ?? payment.amount;
  const newAmount = Math.max(1000, originalAmount - promo.discount);

  await db
    .update(paymentsTable)
    .set({ amount: newAmount, originalAmount, promoCode: code, updatedAt: new Date() })
    .where(eq(paymentsTable.id, payment.id));

  await db
    .update(promoCodesTable)
    .set({ usedCount: (promo.usedCount ?? 0) + 1 })
    .where(eq(promoCodesTable.code, code));

  return { ok: true, discount: promo.discount, originalAmount, newAmount };
}

// ─── /start handler ───────────────────────────────────────────────────────────
async function handleStartCommand(msg: any, payload: string) {
  const chatId = msg.chat.id.toString();
  const username: string | undefined = msg.from?.username;
  const fullName = [msg.from?.first_name, msg.from?.last_name].filter(Boolean).join(" ");
  const adminChatId = tg.getAdminChatId();

  await upsertBotUser(chatId, username, fullName || undefined);
  logger.info({ chatId, username, payload: payload || "(none)" }, "bot /start received");

  if (chatId === adminChatId && !payload) {
    await tg.sendMessage(chatId, `👋 <b>Salom, Admin!</b>\n\nBir Burda boshqaruv paneli:`, { replyMarkup: adminMenuKeyboard() });
    return;
  }

  if (!payload) {
    await tg.sendMessage(chatId, `👋 <b>Salom, ${msg.from?.first_name || "do'st"}!</b>\n\nMen <b>Bir Burda</b> botiman. Ilovadan faollashtirish uchun mening havolam orqali kiring.`);
    return;
  }

  const rows = await db.select().from(paymentsTable).where(eq(paymentsTable.linkToken, payload));
  const p = rows[0];

  if (!p) {
    await tg.sendMessage(chatId, `⚠️ Bu havola yaroqsiz yoki muddati o'tgan. Ilovadan yangi havola oling.`);
    return;
  }

  if (p.status !== "pending" && p.status !== "linked") {
    await tg.sendMessage(chatId, `ℹ️ Bu so'rov allaqachon qayta ishlangan (holat: <b>${p.status}</b>).`);
    return;
  }

  if (p.telegramChatId && p.telegramChatId !== chatId) {
    await tg.sendMessage(chatId, `⚠️ Bu havola boshqa foydalanuvchiga bog'langan. Yangi havola oling.`);
    return;
  }

  const updated = await db
    .update(paymentsTable)
    .set({ telegramChatId: chatId, telegramUsername: username || null, telegramName: fullName || null, status: "linked", updatedAt: new Date() })
    .where(and(eq(paymentsTable.id, p.id), eq(paymentsTable.linkToken, payload)))
    .returning({ id: paymentsTable.id });

  if (updated.length === 0) {
    await tg.sendMessage(chatId, `⚠️ Havolani bog'lab bo'lmadi. Qaytadan urinib ko'ring.`);
    return;
  }

  logger.info({ chatId, paymentId: p.id }, "bot /start: payment linked");

  await tg.sendMessage(
    chatId,
    `✅ <b>Hisobingiz botga muvaffaqiyatli bog'landi!</b>\n\n` +
    `Bu — <b>Bir Burda</b> ilovasining to'lov boti. Premium versiyani faollashtirish uchun to'lovni shu yerda amalga oshirasiz.\n\n` +
    `📋 <b>To'lash tartibi:</b>\n` +
    `1️⃣ Karta raqamiga summani o'tkazing\n` +
    `2️⃣ To'lov chekini shu chatga yuboring\n` +
    `3️⃣ Admin tekshiradi va <b>login + parol</b> yuboriladi\n\n` +
    `🎟 Promokodingiz bo'lsa — "Promokod ishlatish" tugmasini bosing!\n\n` +
    `━━━━━━━━━━━━━━━\n` +
    buildPaymentDetails(p.amount) +
    `━━━━━━━━━━━━━━━\n\n` +
    `👇 Quyidagi tugmalardan foydalaning:`,
    { replyMarkup: clientMenuKeyboard() },
  );
}

// ─── Mijoz callback amallari ──────────────────────────────────────────────────
async function handleClientCallback(cb: any, data: string, chatId: string): Promise<boolean> {
  if (!data.startsWith("cli:")) return false;
  const action = data.slice("cli:".length);

  if (action === "show_card") {
    const payment = await findActivePayment(chatId);
    const remaining = payment ? Math.max(0, payment.amount - (payment.paidAmount ?? 0)) : null;
    await tg.sendMessage(
      chatId,
      `💳 <b>To'lov ma'lumotlari</b>\n\n` +
      (remaining !== null && remaining > 0 ? buildPaymentDetailsRemaining(remaining) : buildPaymentDetails(payment?.amount ?? 0)) +
      `\nTo'lovdan so'ng chekni shu yerga yuboring.`,
      { replyMarkup: clientMenuKeyboard() },
    );
    await tg.answerCallbackQuery(cb.id);
    return true;
  }

  if (action === "my_status") {
    const payment = await findActivePayment(chatId);
    if (!payment) {
      await tg.sendMessage(chatId, `ℹ️ Faol to'lov so'rovingiz topilmadi.\n\nIlovaning to'lov sahifasini ochib, qaytadan boshlang.`);
      await tg.answerCallbackQuery(cb.id);
      return true;
    }
    const paid = payment.paidAmount ?? 0;
    const remaining = Math.max(0, payment.amount - paid);
    const statusLabel =
      payment.status === "linked" ? "⏳ To'lov kutilmoqda"
      : payment.status === "partial" ? "💸 Qisman to'langan"
      : payment.status === "rejected" ? "❌ Rad etilgan — qayta chek yuboring"
      : payment.status;

    const promoLine = payment.promoCode
      ? `\n🎟 Promokod: <code>${payment.promoCode}</code> (chegirma: −${fmtAmount((payment.originalAmount ?? payment.amount) - payment.amount)})`
      : "";

    await tg.sendMessage(
      chatId,
      `📊 <b>Sizning holatingiz</b>\n\n` +
      `Holat: <b>${statusLabel}</b>\n` +
      `💰 To'lash kerak: <b>${fmtAmount(payment.amount)}</b>\n` +
      `✅ To'langan: <b>${fmtAmount(paid)}</b>\n` +
      `🧾 Qolgan qarz: <b>${fmtAmount(remaining)}</b>` +
      promoLine,
      { replyMarkup: payment.status === "rejected" ? resendReceiptKeyboard() : clientMenuKeyboard() },
    );
    await tg.answerCallbackQuery(cb.id);
    return true;
  }

  if (action === "send_receipt") {
    const payment = await findActivePayment(chatId);
    if (!payment) {
      await tg.sendMessage(chatId, `ℹ️ Faol to'lov so'rovingiz topilmadi.\n\nIlovaning to'lov sahifasini ochib, qaytadan boshlang.`);
      await tg.answerCallbackQuery(cb.id);
      return true;
    }
    const remaining = Math.max(0, payment.amount - (payment.paidAmount ?? 0));
    await tg.sendMessage(
      chatId,
      `📤 <b>Chek yuborish</b>\n\n` +
      (remaining > 0 ? `🧾 To'lash kerak: <b>${fmtAmount(remaining)}</b>\n\n` : "") +
      `To'lov chekini (ekran rasmi yoki fayl) <b>shu chatga yuboring</b>.\nAdmin ko'rib chiqadi.`,
    );
    await tg.answerCallbackQuery(cb.id);
    return true;
  }

  if (action === "promo") {
    const payment = await findActivePayment(chatId);
    if (!payment) {
      await tg.sendMessage(chatId, `ℹ️ Faol to'lov so'rovingiz topilmadi.\n\nIlovadan to'lov sahifasini ochib, botga ulaning.`);
      await tg.answerCallbackQuery(cb.id);
      return true;
    }
    if (payment.promoCode) {
      await tg.sendMessage(
        chatId,
        `ℹ️ Siz allaqachon <code>${payment.promoCode}</code> promokodidan foydalangansiz.\n\nHar bir to'lovda faqat bitta promokod ishlatish mumkin.`,
      );
      await tg.answerCallbackQuery(cb.id);
      return true;
    }
    clientPending.set(chatId, { action: "awaiting_promo_code" });
    await tg.sendMessage(
      chatId,
      `🎟 <b>Promokod kiriting</b>\n\nPromokodingizni yuboring (masalan: <code>DIETA20</code>).\n\nBekor qilish: /cancel`,
    );
    await tg.answerCallbackQuery(cb.id);
    return true;
  }

  if (action === "help") {
    await tg.sendMessage(
      chatId,
      `❓ <b>Yordam</b>\n\n` +
      `<b>Bir Burda</b> premium versiyasini faollashtirish:\n\n` +
      `1️⃣ <b>Karta raqami</b> tugmasi orqali rekvizitlarni oling\n` +
      `2️⃣ Summani kartaga o'tkazing\n` +
      `3️⃣ <b>Chek yuborish</b> tugmasini bosib, chek yuboring\n` +
      `4️⃣ Admin tasdiqlaydi — login va parol keladi\n\n` +
      `🎟 Promokodingiz bo'lsa — <b>Promokod ishlatish</b> tugmasini bosing\n` +
      `💸 To'lovni bo'lib qilsangiz — qoldiq ko'rsatib boriladi`,
      { replyMarkup: clientMenuKeyboard() },
    );
    await tg.answerCallbackQuery(cb.id);
    return true;
  }

  await tg.answerCallbackQuery(cb.id);
  return true;
}

// ─── Callback handler ─────────────────────────────────────────────────────────
async function handleCallback(cb: any) {
  const data: string = cb.data || "";
  const chatId = cb.message?.chat?.id?.toString() || "";
  const messageId = cb.message?.message_id;
  const fromChatId = cb.from?.id?.toString();
  const adminChatId = tg.getAdminChatId();

  if (data.startsWith("cli:")) {
    await handleClientCallback(cb, data, chatId);
    return;
  }

  if (fromChatId !== adminChatId) {
    await tg.answerCallbackQuery(cb.id, "Faqat admin uchun.", true);
    return;
  }

  // ── Admin menyu ──
  if (data === "menu:stats") {
    const text = await buildStatsText();
    await tg.sendMessage(adminChatId, text);
    await tg.answerCallbackQuery(cb.id);
    return;
  }

  if (data === "menu:users") {
    const text = await buildUsersText();
    await tg.sendMessage(adminChatId, text);
    await tg.answerCallbackQuery(cb.id);
    return;
  }

  if (data === "menu:broadcast") {
    adminPending.set(adminChatId, { action: "awaiting_broadcast" });
    await tg.sendMessage(adminChatId, `📣 <b>Reklama matni</b>\n\nYuboriladigan xabarni yozing (HTML: b, i, code teglari ishlaydi).\n\nBekor qilish: /cancel`);
    await tg.answerCallbackQuery(cb.id);
    return;
  }

  if (data === "menu:back") {
    await tg.sendMessage(adminChatId, `👋 <b>Admin paneli:</b>`, { replyMarkup: adminMenuKeyboard() });
    await tg.answerCallbackQuery(cb.id);
    return;
  }

  if (data === "menu:promo") {
    const text = await buildPromoListText();
    const codes = await db.select({ code: promoCodesTable.code, discount: promoCodesTable.discount }).from(promoCodesTable).where(eq(promoCodesTable.isActive, true));
    await tg.sendMessage(adminChatId, text, { replyMarkup: promoListKeyboard(codes) });
    await tg.answerCallbackQuery(cb.id);
    return;
  }

  if (data === "promo:create") {
    adminPending.set(adminChatId, { action: "awaiting_promo_code" });
    await tg.sendMessage(adminChatId, `🎟 <b>Yangi promokod</b>\n\nPromokod nomini yuboring (faqat lotin harflari va raqamlar, masalan: <code>DIETA20</code>).\n\nBekor qilish: /cancel`);
    await tg.answerCallbackQuery(cb.id);
    return;
  }

  if (data.startsWith("promo:del:")) {
    const code = data.slice("promo:del:".length);
    await db.update(promoCodesTable).set({ isActive: false }).where(eq(promoCodesTable.code, code));
    await tg.sendMessage(adminChatId, `🗑 <b>${code}</b> promokodi o'chirildi.`);
    const updatedCodes = await db.select({ code: promoCodesTable.code, discount: promoCodesTable.discount }).from(promoCodesTable).where(eq(promoCodesTable.isActive, true));
    const text = await buildPromoListText();
    await tg.sendMessage(adminChatId, text, { replyMarkup: promoListKeyboard(updatedCodes) });
    await tg.answerCallbackQuery(cb.id, "O'chirildi ✅");
    return;
  }

  // ── To'lov amallari ──
  const [action, paymentId] = data.split(":");
  if (!paymentId) {
    await tg.answerCallbackQuery(cb.id);
    return;
  }

  if (action === "approve") {
    const r = await approvePayment(paymentId);
    if (!r.ok) {
      await tg.answerCallbackQuery(cb.id, r.error === "not_found" ? "Topilmadi" : `Holat: ${(r as any).status}`, true);
      return;
    }
    await refreshAdminMessage(paymentId);
    await tg.answerCallbackQuery(cb.id, "Tasdiqlandi ✅");
    return;
  }

  if (action === "reject") {
    const rows = await db.select().from(paymentsTable).where(eq(paymentsTable.id, paymentId));
    const p = rows[0];
    if (!p || p.status !== "submitted") {
      await tg.answerCallbackQuery(cb.id, p ? `Holat: ${p.status}` : "Topilmadi", true);
      return;
    }
    adminPending.set(chatId, { action: "awaiting_rejection_reason", paymentId, userChatId: p.telegramChatId ?? "" });
    await tg.sendMessage(chatId, `❌ <b>Rad etish sababi</b>\n\nMijozga yuboriladigan sababni yozing.\nSababsiz rad etish: /skip\nBekor qilish: /cancel`);
    await tg.answerCallbackQuery(cb.id);
    return;
  }

  if (action === "amount") {
    adminPending.set(chatId, { action: "awaiting_amount", paymentId, messageId });
    await tg.sendMessage(chatId, `💰 Yangi <b>umumiy</b> summani yuboring (faqat raqam, masalan: <code>320000</code>).\n\nBekor qilish: /cancel`);
    await tg.answerCallbackQuery(cb.id);
    return;
  }

  if (action === "partial") {
    const rows = await db.select().from(paymentsTable).where(eq(paymentsTable.id, paymentId));
    const p = rows[0];
    if (!p) {
      await tg.answerCallbackQuery(cb.id, "Topilmadi", true);
      return;
    }
    const remaining = Math.max(0, p.amount - (p.paidAmount ?? 0));
    adminPending.set(chatId, { action: "awaiting_partial", paymentId, messageId });
    await tg.sendMessage(
      chatId,
      `💸 <b>Qisman to'lov</b>\n\n💰 Umumiy: <b>${fmtAmount(p.amount)}</b>\n✅ To'langan: <b>${fmtAmount(p.paidAmount ?? 0)}</b>\n🧾 Qoldiq: <b>${fmtAmount(remaining)}</b>\n\nMijoz <b>hozirgina to'lagan</b> summani yuboring (faqat raqam).\n\nBekor qilish: /cancel`,
    );
    await tg.answerCallbackQuery(cb.id);
    return;
  }

  await tg.answerCallbackQuery(cb.id);
}

// ─── Admin matn handler ───────────────────────────────────────────────────────
async function handleAdminText(msg: any): Promise<boolean> {
  const chatId = msg.chat.id.toString();
  const text: string = (msg.text || "").trim();
  const pending = adminPending.get(chatId);

  if (text === "/cancel") {
    adminPending.delete(chatId);
    await tg.sendMessage(chatId, "Bekor qilindi.", { replyMarkup: adminMenuKeyboard() });
    return true;
  }

  if (text === "/skip" && pending?.action === "awaiting_rejection_reason") {
    adminPending.delete(chatId);
    const r = await rejectPayment(pending.paymentId, null);
    if (!r.ok) { await tg.sendMessage(chatId, `❌ Xato: ${(r as any).error}`); return true; }
    await refreshAdminMessage(pending.paymentId);
    await tg.sendMessage(chatId, `✅ Rad etildi (sababsiz).`);
    return true;
  }

  if (text === "/myid") {
    await tg.sendMessage(chatId, `🆔 <b>Sizning Chat ID:</b> <code>${chatId}</code>`);
    return true;
  }

  if (text === "/stats") {
    await tg.sendMessage(chatId, await buildStatsText());
    return true;
  }

  if (text === "/users") {
    await tg.sendMessage(chatId, await buildUsersText());
    return true;
  }

  if (text === "/admin") {
    await tg.sendMessage(chatId, `👋 <b>Admin paneli:</b>`, { replyMarkup: adminMenuKeyboard() });
    return true;
  }

  if (!pending) return false;

  if (pending.action === "awaiting_rejection_reason") {
    adminPending.delete(chatId);
    const r = await rejectPayment(pending.paymentId, text);
    if (!r.ok) { await tg.sendMessage(chatId, `❌ Xato: ${(r as any).error}`); return true; }
    await refreshAdminMessage(pending.paymentId);
    await tg.sendMessage(chatId, `✅ Rad etildi. Sabab mijozga yuborildi.`);
    return true;
  }

  if (pending.action === "awaiting_amount") {
    const num = Number(text.replace(/[^0-9]/g, ""));
    if (!num || num < 1000) {
      await tg.sendMessage(chatId, `❗ To'g'ri summani yuboring (masalan: <code>320000</code>).`);
      return true;
    }
    await setPaymentAmount(pending.paymentId, num);
    await refreshAdminMessage(pending.paymentId);
    adminPending.delete(chatId);
    await tg.sendMessage(chatId, `✅ Umumiy summa yangilandi: <b>${fmtAmount(num)}</b>`);
    return true;
  }

  if (pending.action === "awaiting_partial") {
    const num = Number(text.replace(/[^0-9]/g, ""));
    if (!num || num < 1) {
      await tg.sendMessage(chatId, `❗ To'g'ri summani yuboring (masalan: <code>40000</code>).`);
      return true;
    }
    const r = await recordPartialPayment(pending.paymentId, num);
    if (!r.ok) {
      await tg.sendMessage(chatId, `❌ Xato: ${(r as any).error}`);
      adminPending.delete(chatId);
      return true;
    }
    await refreshAdminMessage(pending.paymentId);
    adminPending.delete(chatId);
    if (r.fullyPaid) {
      await tg.sendMessage(chatId, `✅ <b>To'lov to'liq yakunlandi!</b>\nEndi "✅ Tasdiqlash (1 yil)" tugmasi orqali kirish bering.`);
    } else {
      await tg.sendMessage(chatId, `💸 Qisman to'lov yozildi.\n✅ To'langan: <b>${fmtAmount(r.newPaid)}</b>\n🧾 Qolgan qarz: <b>${fmtAmount(r.remaining)}</b>\n\nMijozga qoldiq haqida xabar yuborildi.`);
    }
    return true;
  }

  if (pending.action === "awaiting_broadcast") {
    adminPending.delete(chatId);
    await tg.sendMessage(chatId, `📣 Xabar yuborilmoqda...`);
    const { sent, failed } = await broadcastMessage(text, chatId);
    await tg.sendMessage(chatId, `✅ <b>Xabar yuborildi!</b>\n\n📤 Muvaffaqiyatli: <b>${sent}</b>\n❌ Yuborilmadi: <b>${failed}</b>`);
    return true;
  }

  if (pending.action === "awaiting_promo_code") {
    const code = text.toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (!code || code.length < 3 || code.length > 20) {
      await tg.sendMessage(chatId, `❗ Promokod nomi 3–20 ta lotin harfi/raqamdan iborat bo'lishi kerak.\n\nQayta yuboring yoki /cancel`);
      return true;
    }
    const existing = await db.select().from(promoCodesTable).where(eq(promoCodesTable.code, code));
    if (existing.length > 0) {
      await tg.sendMessage(chatId, `❗ <code>${code}</code> nomi allaqachon mavjud. Boshqa nom tanlang yoki /cancel`);
      return true;
    }
    adminPending.set(chatId, { action: "awaiting_promo_discount", code });
    await tg.sendMessage(chatId, `🎟 Promokod: <code>${code}</code>\n\nEndi chegirma miqdorini yuboring (so'mda, masalan: <code>20000</code>).\n\nBekor qilish: /cancel`);
    return true;
  }

  if (pending.action === "awaiting_promo_discount") {
    const discount = Number(text.replace(/[^0-9]/g, ""));
    if (!discount || discount < 100) {
      await tg.sendMessage(chatId, `❗ To'g'ri chegirma miqdorini yuboring (masalan: <code>20000</code>).\n\nBekor qilish: /cancel`);
      return true;
    }
    await db.insert(promoCodesTable).values({
      code: pending.code,
      discount,
      usedCount: 0,
      isActive: true,
    });
    adminPending.delete(chatId);
    const codes = await db.select({ code: promoCodesTable.code, discount: promoCodesTable.discount }).from(promoCodesTable).where(eq(promoCodesTable.isActive, true));
    await tg.sendMessage(
      chatId,
      `✅ <b>Promokod yaratildi!</b>\n\n🎟 Kod: <code>${pending.code}</code>\n💰 Chegirma: −${fmtAmount(discount)}`,
      { replyMarkup: promoListKeyboard(codes) },
    );
    return true;
  }

  return false;
}

// ─── Mijoz matn handler ────────────────────────────────────────────────────────
async function handleClientText(msg: any, chatId: string): Promise<boolean> {
  const text: string = (msg.text || "").trim();
  const pending = clientPending.get(chatId);

  if (text === "/cancel" && pending) {
    clientPending.delete(chatId);
    await tg.sendMessage(chatId, "Bekor qilindi.", { replyMarkup: clientMenuKeyboard() });
    return true;
  }

  if (text === "/myid") {
    await tg.sendMessage(chatId, `🆔 <b>Sizning Chat ID:</b> <code>${chatId}</code>`);
    return true;
  }

  if (!pending) return false;

  if (pending.action === "awaiting_promo_code") {
    clientPending.delete(chatId);
    const result = await applyPromoCode(chatId, text);

    if (!result.ok) {
      if (result.error === "not_found") {
        await tg.sendMessage(chatId, `❌ <b>Promokod topilmadi.</b>\n\n<code>${text.toUpperCase()}</code> nomi bo'yicha faol promokod mavjud emas.\n\nQayta tekshirib, to'g'ri kiring.`, { replyMarkup: clientMenuKeyboard() });
      } else if (result.error === "no_payment") {
        await tg.sendMessage(chatId, `ℹ️ Faol to'lov so'rovingiz topilmadi. Ilovadan to'lov sahifasini oching.`, { replyMarkup: clientMenuKeyboard() });
      } else if (result.error === "already_has_promo") {
        await tg.sendMessage(chatId, `ℹ️ Siz allaqachon promokod ishlatgansiz. Har bir to'lovda faqat bitta promokod mumkin.`, { replyMarkup: clientMenuKeyboard() });
      }
      return true;
    }

    const saved = (result.originalAmount ?? 0) - (result.newAmount ?? 0);
    await tg.sendMessage(
      chatId,
      `✅ <b>Promokod qabul qilindi!</b>\n\n` +
      `🎟 Kod: <code>${text.toUpperCase()}</code>\n` +
      `💰 Asl narx: <b>${fmtAmount(result.originalAmount ?? 0)}</b>\n` +
      `🎁 Chegirma: −<b>${fmtAmount(saved)}</b>\n` +
      `✅ <b>To'lash kerak: ${fmtAmount(result.newAmount ?? 0)}</b>\n\n` +
      `Endi ${fmtAmount(result.newAmount ?? 0)} ni kartaga o'tkazib, chek yuboring:\n` +
      buildPaymentDetails(result.newAmount ?? 0),
      { replyMarkup: clientMenuKeyboard() },
    );
    return true;
  }

  return false;
}

// ─── Yangilanish qayta ishlash ────────────────────────────────────────────────
async function processUpdate(update: any) {
  try {
    if (update.callback_query) {
      await handleCallback(update.callback_query);
      return;
    }
    if (update.message) {
      const msg = update.message;
      const text: string = msg.text || "";
      const chatId = msg.chat.id.toString();
      const adminChatId = tg.getAdminChatId();

      if (chatId === adminChatId) {
        const handled = await handleAdminText(msg);
        if (handled) return;
      }

      if (text.startsWith("/start")) {
        const payload = text.split(/\s+/, 2)[1] || "";
        await handleStartCommand(msg, payload);
        return;
      }

      if (chatId !== adminChatId) {
        const username: string | undefined = msg.from?.username;
        const fullName = [msg.from?.first_name, msg.from?.last_name].filter(Boolean).join(" ");
        await upsertBotUser(chatId, username, fullName || undefined);

        // Avval matn pending'larni tekshiramiz (promokod kiritish)
        const textHandled = await handleClientText(msg, chatId);
        if (textHandled) return;

        const hasMedia = !!(msg.photo || msg.document);
        if (hasMedia) {
          const payment = await findActivePayment(chatId);

          if (!payment) {
            await tg.sendMessage(chatId, `ℹ️ Faol to'lov so'rovingiz topilmadi. Ilovadan to'lov sahifasini oching va botga ulaning.`);
            return;
          }

          await tg.forwardMessage(adminChatId, chatId, msg.message_id);

          const caption = buildPaymentCaption({
            id: payment.id,
            name: payment.name,
            phone: payment.phone,
            amount: payment.amount,
            paidAmount: payment.paidAmount,
            originalAmount: payment.originalAmount,
            promoCode: payment.promoCode,
            telegramUsername: payment.telegramUsername,
            telegramName: payment.telegramName,
            status: "submitted",
          });
          const adminMsg = await tg.sendMessage(adminChatId, caption, { replyMarkup: paymentKeyboard(payment.id) });

          const adminMsgId = (adminMsg as any)?.result?.message_id ?? null;
          await db
            .update(paymentsTable)
            .set({ status: "submitted", adminChatId, adminMessageId: adminMsgId, updatedAt: new Date() })
            .where(eq(paymentsTable.id, payment.id));

          await tg.sendMessage(chatId, `✅ <b>Chek qabul qilindi!</b>\n\nAdmin ko'rib chiqmoqda. Tasdiqlansa, login va parol shu yerga yuboriladi.\n\n⏳ Biroz kuting...`);
          return;
        }

        await tg.sendMessage(chatId, `ℹ️ To'lov chekini <b>rasm yoki fayl ko'rinishida</b> yuboring.\n\nAgar hali to'lov qilmagan bo'lsangiz, ilovadan to'lov sahifasini oching.`, { replyMarkup: clientMenuKeyboard() });
      }
    }
  } catch (err) {
    logger.error({ err, update }, "bot processUpdate error");
  }
}

// ─── Polling ─────────────────────────────────────────────────────────────────
let pollingActive = false;

export async function startBotPolling() {
  if (!tg.isConfigured()) {
    logger.warn("Telegram bot sozlanmagan (TELEGRAM_BOT_TOKEN / TELEGRAM_ADMIN_CHAT_ID)");
    return;
  }
  if (pollingActive) return;
  pollingActive = true;

  let offset = 0;
  let backoffMs = 0;
  let connected = false;

  (async () => {
    while (pollingActive) {
      try {
        if (backoffMs > 0) {
          await new Promise((r) => setTimeout(r, backoffMs));
          backoffMs = 0;
        }

        if (!connected) {
          await tg.deleteWebhook();
          const me = await tg.getMe();
          if (!me) {
            throw new Error("Telegram getMe returned no bot identity");
          }
          connected = true;
          logger.info(
            { username: me.username, adminChatId: tg.getAdminChatId() },
            "Telegram bot tayyor (long polling)",
          );
        }

        const updates = await tg.getUpdates(offset, 25);
        for (const u of updates) {
          offset = Math.max(offset, u.update_id + 1);
          await processUpdate(u);
        }
      } catch (err) {
        logger.error({ err }, "bot polling loop error");
        connected = false;
        backoffMs = 5000;
      }
    }
  })();
}

export function stopBotPolling() {
  pollingActive = false;
}

export { refreshAdminMessage, paymentKeyboard as adminKeyboard, buildPaymentCaption as buildAdminCaption };
