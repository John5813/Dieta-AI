import { Router, type Request } from "express";
import { createHash } from "crypto";
import { backupsTable, db } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger";

const router = Router();

// Codes look like "UZD-XXXX-XXXX-XXXX-XXXX" (16 base32 chars ≈ 80 bits).
const CODE_RE = /^UZD(-[A-Z2-7]{4}){4}$/;
const MAX_BYTES = 5 * 1024 * 1024;
// Failed restores per IP per hour; codes are unguessable, this just stops hammering.
const LOOKUP_LIMIT = 30;
const lookups = new Map<string, { count: number; resetAt: number }>();

function codeFrom(req: Request): string | null {
  const raw = String(req.header("x-backup-code") ?? "").trim().toUpperCase();
  return CODE_RE.test(raw) ? raw : null;
}

const idFor = (code: string) => createHash("sha256").update(`uzdieta-backup:${code}`).digest("hex");

/** PUT /api/backup — replaces the backup for the code in X-Backup-Code. */
router.put("/backup", async (req, res) => {
  const code = codeFrom(req);
  const data = (req.body ?? {}).data;
  if (!code || data == null || typeof data !== "object") {
    res.status(400).json({ error: "Noto'g'ri so'rov" });
    return;
  }
  const json = JSON.stringify(data);
  const size = Buffer.byteLength(json, "utf8");
  if (size > MAX_BYTES) {
    res.status(413).json({ error: "Zaxira juda katta" });
    return;
  }
  try {
    const now = new Date();
    await db
      .insert(backupsTable)
      .values({ id: idFor(code), data: json, size, updatedAt: now })
      .onConflictDoUpdate({ target: backupsTable.id, set: { data: json, size, updatedAt: now } });
    res.json({ success: true, updatedAt: now.toISOString(), size });
  } catch (err) {
    logger.error({ err }, "backup save failed");
    res.status(500).json({ error: "Zaxirani saqlab bo'lmadi" });
  }
});

/** GET /api/backup — returns the backup for the code in X-Backup-Code. */
router.get("/backup", async (req, res) => {
  const ip = req.ip ?? "unknown";
  const now = Date.now();
  const hit = lookups.get(ip);
  if (hit && hit.resetAt > now && hit.count >= LOOKUP_LIMIT) {
    res.status(429).json({ error: "Juda ko'p urinish. Bir soatdan keyin qayta urinib ko'ring." });
    return;
  }
  const code = codeFrom(req);
  if (!code) {
    res.status(400).json({ error: "Zaxira kodi noto'g'ri yozilgan" });
    return;
  }
  try {
    const [row] = await db.select().from(backupsTable).where(eq(backupsTable.id, idFor(code)));
    if (!row) {
      lookups.set(ip, hit && hit.resetAt > now ? { ...hit, count: hit.count + 1 } : { count: 1, resetAt: now + 3600_000 });
      res.status(404).json({ error: "Bu kod bilan zaxira topilmadi" });
      return;
    }
    res.json({ data: JSON.parse(row.data), updatedAt: row.updatedAt.toISOString() });
  } catch (err) {
    logger.error({ err }, "backup read failed");
    res.status(500).json({ error: "Zaxirani o'qib bo'lmadi" });
  }
});

export default router;
