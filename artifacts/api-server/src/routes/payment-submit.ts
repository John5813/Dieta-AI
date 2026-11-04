import { Router } from "express";
import multer from "multer";
import { randomUUID, randomBytes } from "crypto";
import { db, paymentsTable } from "@workspace/db";
import { eq, and, lt, sql } from "drizzle-orm";
import { logger } from "../lib/logger";
import * as tg from "../lib/telegram";
import { adminKeyboard, buildAdminCaption } from "../lib/bot";
import { normalizeLogin, normalizePassword, verifyPassword } from "../lib/credentials";
import { clientIp, failures, rateLimit } from "../lib/guard";
import { bearerFrom, signPremiumToken, verifyPremiumToken } from "../lib/premiumToken";
import { timingSafeEqual, createHash } from "crypto";

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024, files: 1, fields: 10, fieldSize: 1024 },
});

/** Receipts must really be images (checked by magic bytes, not the client's claim). */
function imageKind(buf: Buffer): "jpg" | "png" | "webp" | null {
  if (buf.length > 12 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpg";
  if (buf.length > 12 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
  if (buf.length > 12 && buf.subarray(0, 4).toString("latin1") === "RIFF" && buf.subarray(8, 12).toString("latin1") === "WEBP") return "webp";
  return null;
}

const UUID_RE = /^[0-9a-f-]{36}$/i;

// Redeem is the only place passwords are guessed: strict per-IP and per-login limits.
const REDEEM_IP_FAILS = 10;
const REDEEM_LOGIN_FAILS = 8;
const REDEEM_WINDOW = 15 * 60 * 1000;
// Used so that unknown logins cost the same CPU as known ones.
const DUMMY_HASH = "0".repeat(64);
const DUMMY_SALT = "0".repeat(32);

const safeEq = (a: string, b: string) => {
  const x = createHash("sha256").update(a).digest();
  const y = createHash("sha256").update(b).digest();
  return timingSafeEqual(x, y);
};

const DEFAULT_AMOUNT = 260_000;
// How many times already-redeemed credentials may re-activate premium on a
// new install. Covers phone changes/reinstalls without letting one purchase
// be shared across unlimited devices.
const MAX_RESTORES = 5;

function makeLinkToken() {
  // 12-char URL-safe token
  return randomBytes(9).toString("base64url");
}

/**
 * POST /api/payment/init
 * Creates a new payment record and returns a Telegram deep link the user
 * should open to bind their chat to this payment request.
 */
router.post("/payment/init", rateLimit("pay-init", 10, 60 * 60 * 1000), async (req, res) => {
  try {
    const { name, phone } = (req.body ?? {}) as { name?: string; phone?: string };
    const cleanName = typeof name === "string" ? name.trim().slice(0, 80) : "";
    const cleanPhone = typeof phone === "string" ? phone.trim().slice(0, 40) : "";
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
      name: cleanName || null,
      phone: cleanPhone || null,
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
router.get("/payment/:id", rateLimit("pay-get", 120, 60 * 60 * 1000), async (req, res) => {
  try {
    if (!UUID_RE.test(String(req.params.id))) {
      res.status(404).json({ error: "not_found" });
      return;
    }
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
router.post("/payment/:id/submit", rateLimit("pay-submit", 10, 60 * 60 * 1000), upload.single("receipt"), async (req, res) => {
  try {
    const { name, phone } = (req.body ?? {}) as { name?: string; phone?: string };
    if (!UUID_RE.test(String(req.params.id))) {
      res.status(404).json({ error: "Toʻlov topilmadi" });
      return;
    }
    if (!req.file) {
      res.status(400).json({ error: "Chek rasmi talab qilinadi" });
      return;
    }
    const kind = imageKind(req.file.buffer);
    if (!kind) {
      res.status(400).json({ error: "Faqat rasm (JPG, PNG yoki WEBP) yuboring" });
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
      `receipt.${kind}`,
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
 * First use activates yearly premium. Later uses of the same credentials
 * (new phone / reinstall) restore the existing premiumUntil, up to
 * MAX_RESTORES times. The :id is not used to find the payment.
 */
router.post("/payment/:id/redeem", async (req, res) => {
  try {
    const ip = clientIp(req);
    const ipKey = `redeem-ip:${ip}`;
    if (failures.blocked(ipKey, REDEEM_IP_FAILS)) {
      res.setHeader("Retry-After", String(REDEEM_WINDOW / 1000));
      res.status(429).json({ error: "Juda ko'p urinish. 15 daqiqadan keyin qayta urinib ko'ring." });
      return;
    }
    const { login, password } = (req.body ?? {}) as { login?: unknown; password?: unknown };
    if (typeof login !== "string" || typeof password !== "string" || !login || !password || login.length > 40 || password.length > 40) {
      res.status(400).json({ error: "Login va parolni kiriting" });
      return;
    }
    const normLogin = normalizeLogin(login);
    const normPass = normalizePassword(password);
    const loginKey = `redeem-login:${normLogin}`;
    if (failures.blocked(loginKey, REDEEM_LOGIN_FAILS)) {
      res.status(429).json({ error: "Bu login uchun juda ko'p urinish. 15 daqiqadan keyin qayta urinib ko'ring." });
      return;
    }
    const bad = () => {
      failures.fail(ipKey, REDEEM_WINDOW);
      failures.fail(loginKey, REDEEM_WINDOW);
    };

    // Universal master credential. Disabled unless both values are long enough
    // to be unguessable (12+ characters each).
    const masterLogin = normalizeLogin(process.env["MASTER_LOGIN"] ?? "");
    const masterPassword = normalizePassword(process.env["MASTER_PASSWORD"] ?? "");
    if (masterLogin.length >= 12 && masterPassword.length >= 12) {
      const okLogin = safeEq(normLogin, masterLogin);
      const okPass = safeEq(normPass, masterPassword);
      if (okLogin && okPass) {
        const premiumUntil = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
        const { token } = signPremiumToken({ login: masterLogin, premiumUntil: premiumUntil.getTime(), master: true });
        failures.reset(ipKey);
        res.json({ success: true, premiumUntil: premiumUntil.toISOString(), token });
        return;
      }
    }

    // Login is globally unique, so look it up directly instead of by the
    // :id in the URL — a reinstalled app or a new phone has a fresh payment
    // session id that the original credentials were never attached to.
    const rows = await db
      .select()
      .from(paymentsTable)
      .where(eq(paymentsTable.login, normLogin));
    const target = rows[0];

    const credsOk =
      !!target?.passwordHash &&
      !!target?.passwordSalt &&
      verifyPassword(normPass, target?.passwordHash ?? DUMMY_HASH, target?.passwordSalt ?? DUMMY_SALT);
    if (!target || !credsOk) {
      if (!target) verifyPassword(normPass, DUMMY_HASH, DUMMY_SALT);
      bad();
      res.status(401).json({ error: "Login yoki parol notoʻgʻri" });
      return;
    }
    failures.reset(loginKey);

    if (target.status === "redeemed" || target.passwordUsed) {
      const until = target.premiumUntil;
      if (!until || until.getTime() <= Date.now()) {
        res.status(409).json({ error: "Premium muddati tugagan." });
        return;
      }
      const restored = await db
        .update(paymentsTable)
        .set({
          restoreCount: sql`${paymentsTable.restoreCount} + 1`,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(paymentsTable.id, target.id),
            lt(paymentsTable.restoreCount, MAX_RESTORES),
          ),
        )
        .returning({ id: paymentsTable.id });
      if (restored.length === 0) {
        res.status(409).json({
          error: "Tiklash chegarasi tugadi. Qoʻllab-quvvatlash xizmatiga murojaat qiling.",
        });
        return;
      }
      const { token } = signPremiumToken({ login: normLogin, premiumUntil: until.getTime() });
      res.json({ success: true, restored: true, premiumUntil: until.toISOString(), token });
      return;
    }

    if (target.status !== "approved") {
      res.status(409).json({ error: "Toʻlov hali tasdiqlanmagan" });
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
          `🎉 <b>Yillik Premium faollashtirildi!</b>\n\nUzDieta AI'dan toʻliq foydalaning. Sogʻlom hayotni boshlash vaqti keldi! 💪`,
        );
      }
    }

    const { token } = signPremiumToken({ login: normLogin, premiumUntil: premiumUntil.getTime() });
    res.json({
      success: true,
      premiumUntil: premiumUntil.toISOString(),
      token,
    });
  } catch (err) {
    logger.error({ err }, "payment redeem error");
    res.status(500).json({ error: "Server xatoligi" });
  }
});

/**
 * POST /api/premium/refresh — swaps a still-valid token for a fresh one while
 * the purchase itself is still within its premium period.
 */
router.post("/premium/refresh", rateLimit("premium-refresh", 30, 60 * 60 * 1000), async (req, res) => {
  const old = verifyPremiumToken(bearerFrom(req.header("authorization")), 400 * 24 * 60 * 60 * 1000);
  if (!old) {
    res.status(401).json({ error: "Token yaroqsiz" });
    return;
  }
  try {
    if (old.m) {
      const ml = normalizeLogin(process.env["MASTER_LOGIN"] ?? "");
      if (ml.length < 12 || old.l !== ml) {
        res.status(401).json({ error: "Token yaroqsiz" });
        return;
      }
      const until = Date.now() + 365 * 24 * 60 * 60 * 1000;
      const { token } = signPremiumToken({ login: ml, premiumUntil: until, master: true });
      res.json({ success: true, token });
      return;
    }
    const [row] = await db.select().from(paymentsTable).where(eq(paymentsTable.login, old.l));
    if (!row?.premiumUntil || row.premiumUntil.getTime() <= Date.now() || (row.status !== "redeemed" && row.status !== "approved")) {
      res.status(401).json({ error: "Premium muddati tugagan" });
      return;
    }
    const { token } = signPremiumToken({ login: old.l, premiumUntil: row.premiumUntil.getTime() });
    res.json({ success: true, token, premiumUntil: row.premiumUntil.toISOString() });
  } catch (err) {
    logger.error({ err }, "premium refresh error");
    res.status(500).json({ error: "Server xatoligi" });
  }
});

export default router;
