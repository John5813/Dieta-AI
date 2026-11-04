import { Router, type Request } from "express";
import express from "express";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";
import { clientIp, failures, rateLimit } from "../lib/guard";
import { backupsTable, db } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger";

const router = Router();

// Codes look like "UZD-XXXX-XXXX-XXXX-XXXX" (16 base32 chars ≈ 80 bits).
const CODE_RE = /^UZD(-[A-Z2-7]{4}){4}$/;
const MAX_BYTES = 5 * 1024 * 1024;
// Failed restores per IP per hour; codes are unguessable, this just stops hammering.
const LOOKUP_LIMIT = 20;
const HOUR = 3600_000;
const bigJson = express.json({ limit: "7mb" });

function codeFrom(req: Request): string | null {
  const raw = String(req.header("x-backup-code") ?? "").trim().toUpperCase();
  return CODE_RE.test(raw) ? raw : null;
}

/**
 * Backups hold health data, so they are encrypted at rest with a key derived
 * from the backup code. The code is never stored: a leaked database alone
 * cannot be read, only someone holding the code can.
 */
const keyFor = (code: string) => createHash("sha256").update(`uzdieta-backup-key:${code}`).digest();

function encrypt(plain: string, code: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", keyFor(code), iv);
  const enc = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return `enc1:${iv.toString("base64")}:${c.getAuthTag().toString("base64")}:${enc.toString("base64")}`;
}

function decrypt(stored: string, code: string): string {
  if (!stored.startsWith("enc1:")) return stored; // older, unencrypted rows
  const [, iv, tag, data] = stored.split(":") as [string, string, string, string];
  const d = createDecipheriv("aes-256-gcm", keyFor(code), Buffer.from(iv, "base64"));
  d.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([d.update(Buffer.from(data, "base64")), d.final()]).toString("utf8");
}

const idFor = (code: string) => createHash("sha256").update(`uzdieta-backup:${code}`).digest("hex");

/** PUT /api/backup — replaces the backup for the code in X-Backup-Code. */
router.put("/backup", rateLimit("backup-put", 60, HOUR), bigJson, async (req, res) => {
  const code = codeFrom(req);
  const data = (req.body ?? {}).data;
  if (!code || data == null || typeof data !== "object") {
    res.status(400).json({ error: "Noto'g'ri so'rov" });
    return;
  }
  const json = JSON.stringify(data);
  if (Array.isArray(data) || (data as { version?: unknown }).version !== 1) {
    res.status(400).json({ error: "Noto'g'ri so'rov" });
    return;
  }
  const size = Buffer.byteLength(json, "utf8");
  if (size > MAX_BYTES) {
    res.status(413).json({ error: "Zaxira juda katta" });
    return;
  }
  try {
    const now = new Date();
    await db
      .insert(backupsTable)
      .values({ id: idFor(code), data: encrypt(json, code), size, updatedAt: now })
      .onConflictDoUpdate({ target: backupsTable.id, set: { data: encrypt(json, code), size, updatedAt: now } });
    res.json({ success: true, updatedAt: now.toISOString(), size });
  } catch (err) {
    logger.error({ err }, "backup save failed");
    res.status(500).json({ error: "Zaxirani saqlab bo'lmadi" });
  }
});

/** GET /api/backup — returns the backup for the code in X-Backup-Code. */
router.get("/backup", async (req, res) => {
  const failKey = `backup-miss:${clientIp(req)}`;
  if (failures.blocked(failKey, LOOKUP_LIMIT)) {
    res.status(429).json({ error: "Juda ko'p urinish. Bir soatdan keyin qayta urinib ko'ring." });
    return;
  }
  const code = codeFrom(req);
  if (!code) {
    failures.fail(failKey, HOUR);
    res.status(400).json({ error: "Zaxira kodi noto'g'ri yozilgan" });
    return;
  }
  try {
    const [row] = await db.select().from(backupsTable).where(eq(backupsTable.id, idFor(code)));
    if (!row) {
      failures.fail(failKey, HOUR);
      res.status(404).json({ error: "Bu kod bilan zaxira topilmadi" });
      return;
    }
    res.json({ data: JSON.parse(decrypt(row.data, code)), updatedAt: row.updatedAt.toISOString() });
  } catch (err) {
    logger.error({ err }, "backup read failed");
    res.status(500).json({ error: "Zaxirani o'qib bo'lmadi" });
  }
});

export default router;
