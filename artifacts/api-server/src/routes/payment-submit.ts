import { Router } from "express";
import multer from "multer";
import { randomUUID, randomBytes } from "crypto";
import { db, paymentsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { logger } from "../lib/logger";
import * as tg from "../lib/telegram";
import { adminKeyboard, buildAdminCaption } from "../lib/bot";
import { normalizeLogin, normalizePassword, verifyPassword } from "../lib/credentials";

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

const DEFAULT_AMOUNT = 260_000;

function makeLinkToken() {
  // 12-char URL-safe token
  return randomBytes(9).toString("base64url");
}

/**
 * POST /api/payment/init
 * Creates a new payment record and returns a Telegram deep link the user
 * should open to bind their chat to this payment request.
 */
router.post("/payment/init", async (req, res) => {
  try {
    const { name, phone } = (req.body ?? {}) as { name?: string; phone?: string };
    const id = randomUUID();
    const linkToken = makeLinkToken();
    // Bot username keshda bo'lmasa (server endi ko'tarilgan / polling
    // hali getMe'ni tugatmagan), to'g'ridan-to'g'ri Telegram'dan so'raymiz.
    // Aks holda foydalanuvchi "Telegram bot sozlanmagan" xatosini ko'radi.
    let username = tg.getBotUsername();
    if (!username && tg.isConfigured()) {
      try {
        const me = await tg.getMe();
        username = me?.username ?? null;
      } catch {}
    }

    await db.insert(paymentsTable).values({
      id,
      linkToken,
      name: name?.trim() || null,
      phone: phone?.trim() || null,
      amount: DEFAULT_AMOUNT,
      status: "pending",
    });

    res.json({
      paymentId: id,
      linkToken,
      botUsername: username,
      botUrl: username ? `https://t.me/${username}?start=${linkToken}` : null,
      amount: DEFAULT_AMOUNT,
    });
  } catch (err) {
    logger.error({ err }, "payment init error");
    res.status(500).json({ error: "Server xatoligi" });
  }
});

/**
 * GET /api/payment/:id
 * Returns current state of a payment. Used by the app to poll.
 */
router.get("/payment/:id", async (req, res) => {
  try {
    const rows = await db
      .select()
      .from(paymentsTable)
      .where(eq(paymentsTable.id, String(req.params.id)));
    const p = rows[0];
    if (!p) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    res.json({
      paymentId: p.id,
      status: p.status,
      amount: p.amount,
      linked: !!p.telegramChatId,
      telegramUsername: p.telegramUsername,
      telegramName: p.telegramName,
      passwordUsed: p.passwordUsed,
    });
  } catch (err) {
    logger.error({ err }, "payment get error");
    res.status(500).json({ error: "Server xatoligi" });
  }
});

/**
 * POST /api/payment/:id/submit  (multipart)
 * Fields: name, phone, receipt(file)
 * Sends the receipt photo to the admin chat with action buttons.
 */
router.post("/payment/:id/submit", upload.single("receipt"), async (req, res) => {
  try {
    const { name, phone } = req.body as { name?: string; phone?: string };
    if (!req.file) {
      res.status(400).json({ error: "Chek rasmi talab qilinadi" });
      return;
    }
    const rows = await db
      .select()
      .from(paymentsTable)
      .where(eq(paymentsTable.id, String(req.params.id)));
    const p = rows[0];
    if (!p) {
      res.status(404).json({ error: "Toʻlov topilmadi" });
      return;
    }
    if (!p.telegramChatId) {
      res.status(400).json({ error: "Avval Telegram botga ulanish kerak" });
      return;
    }
    if (p.status === "approved" || p.status === "redeemed") {
      res.status(400).json({ error: "Allaqachon tasdiqlangan" });
      return;
    }

    const finalName = (name?.trim() || p.name || p.telegramName || "—").slice(0, 80);
    const finalPhone = (phone?.trim() || p.phone || "").slice(0, 40) || null;

    await db
      .update(paymentsTable)
      .set({
        name: finalName,
        phone: finalPhone,
        status: "submitted",
        updatedAt: new Date(),
      })
      .where(eq(paymentsTable.id, p.id));

    if (!tg.isConfigured()) {
      logger.warn("Telegram not configured; payment recorded without admin notification");
      res.json({ success: true, paymentId: p.id });
      return;
    }

    const adminChatId = tg.getAdminChatId();
    const caption = buildAdminCaption({
      id: p.id,
      name: finalName,
      phone: finalPhone,
      amount: p.amount,
      paidAmount: p.paidAmount,
      telegramUsername: p.telegramUsername,
      telegramName: p.telegramName,
      status: "submitted",
    });

    const result: any = await tg.sendPhotoBuffer(
      adminChatId,
      req.file.buffer,
      req.file.originalname || "receipt.jpg",
      caption,
      adminKeyboard(p.id),
    );

    if (result?.ok && result.result?.message_id) {
      await db
        .update(paymentsTable)
        .set({
          adminChatId,
          adminMessageId: result.result.message_id,
          receiptFileId: result.result?.photo?.at(-1)?.file_id ?? null,
          updatedAt: new Date(),
        })
        .where(eq(paymentsTable.id, p.id));
    } else {
      logger.warn({ result }, "Failed to forward receipt to admin");
    }

    res.json({ success: true, paymentId: p.id });
  } catch (err) {
    logger.error({ err }, "payment submit error");
    res.status(500).json({ error: "Server xatoligi" });
  }
});

/**
 * POST /api/payment/:id/redeem
 * Body: { login, password }
 * Verifies the one-time credentials and activates yearly premium.
 */
router.post("/payment/:id/redeem", async (req, res) => {
  try {
    const { login, password } = (req.body ?? {}) as { login?: string; password?: string };
    if (!login || !password) {
      res.status(400).json({ error: "Login va parolni kiriting" });
      return;
    }
    const normLogin = normalizeLogin(login);
    const normPass = normalizePassword(password);

    // Universal master credential — istalgan qurilmada premium faollashtiradi
    const masterLogin = normalizeLogin(process.env["MASTER_LOGIN"] ?? "");
    const masterPassword = normalizePassword(process.env["MASTER_PASSWORD"] ?? "");
    if (
      masterLogin &&
      masterPassword &&
      normLogin === masterLogin &&
      normPass === masterPassword
    ) {
      const premiumUntil = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
      res.json({ success: true, premiumUntil: premiumUntil.toISOString() });
      return;
    }

    const rows = await db
      .select()
      .from(paymentsTable)
      .where(eq(paymentsTable.id, String(req.params.id)));
    const p = rows[0];
    if (!p) {
      res.status(404).json({ error: "Toʻlov topilmadi" });
      return;
    }

    // Strict: credentials MUST belong to THIS payment id. No cross-payment fallback.
    const target = p;

    if (
      !target.login ||
      target.login !== normLogin ||
      !target.passwordHash ||
      !target.passwordSalt
    ) {
      res.status(401).json({ error: "Login yoki parol notoʻgʻri" });
      return;
    }
    if (target.passwordUsed || target.status === "redeemed") {
      res.status(409).json({ error: "Bu parol allaqachon ishlatilgan" });
      return;
    }
    if (target.status !== "approved") {
      res.status(409).json({ error: "Toʻlov hali tasdiqlanmagan" });
      return;
    }

    if (!verifyPassword(normPass, target.passwordHash, target.passwordSalt)) {
      res.status(401).json({ error: "Login yoki parol notoʻgʻri" });
      return;
    }

    const premiumUntil =
      target.premiumUntil ?? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);

    // Atomic single-use redemption: only succeeds if still approved & unused.
    const updated = await db
      .update(paymentsTable)
      .set({
        passwordUsed: true,
        status: "redeemed",
        redeemedAt: new Date(),
        premiumUntil,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(paymentsTable.id, target.id),
          eq(paymentsTable.status, "approved"),
          eq(paymentsTable.passwordUsed, false),
        ),
      )
      .returning({ id: paymentsTable.id });

    if (updated.length === 0) {
      res.status(409).json({ error: "Bu parol allaqachon ishlatilgan" });
      return;
    }

    // Notify admin & user
    if (tg.isConfigured()) {
      if (target.adminChatId && target.adminMessageId) {
        const caption = buildAdminCaption({
          id: target.id,
          name: target.name,
          phone: target.phone,
          amount: target.amount,
          paidAmount: target.paidAmount,
          telegramUsername: target.telegramUsername,
          telegramName: target.telegramName,
          status: "redeemed",
        });
        await tg.editMessageCaption(target.adminChatId, target.adminMessageId, caption, {
          inline_keyboard: [],
        });
      }
      if (target.telegramChatId) {
        await tg.sendMessage(
          target.telegramChatId,
          `🎉 <b>Yillik Premium faollashtirildi!</b>\n\nBir Burda'dan toʻliq foydalaning. Sogʻlom hayotni boshlash vaqti keldi! 💪`,
        );
      }
    }

    res.json({
      success: true,
      premiumUntil: premiumUntil.toISOString(),
    });
  } catch (err) {
    logger.error({ err }, "payment redeem error");
    res.status(500).json({ error: "Server xatoligi" });
  }
});

export default router;
