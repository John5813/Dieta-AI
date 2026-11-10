import { Router } from "express";
import { randomBytes } from "crypto";
import { pickLegalLang, renderDeletion } from "../lib/legal";

const router = Router();

router.get("/", (req, res) => {
  const nonce = randomBytes(16).toString("base64");
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader(
    "Content-Security-Policy",
    `default-src 'self'; script-src 'nonce-${nonce}'; style-src 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'`,
  );
  res.send(renderDeletion(pickLegalLang(req.query.lang, req.headers["accept-language"]), nonce));
});

export default router;
