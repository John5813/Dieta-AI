import { Router } from "express";
import { pickLegalLang, renderPrivacy } from "../lib/legal";

const router = Router();

router.get("/", (req, res) => {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache");
  res.send(renderPrivacy(pickLegalLang(req.query.lang, req.headers["accept-language"])));
});

export default router;
