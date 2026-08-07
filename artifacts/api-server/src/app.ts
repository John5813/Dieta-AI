import path from "node:path";
import fs from "node:fs";
import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import privacyRouter from "./routes/privacy";
import deleteAccountRouter from "./routes/delete-account";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ extended: true, limit: "20mb" }));

// DigitalOcean App Platform uses GET / as the default readiness probe.
// Keep this endpoint dependency-free so the container can report readiness
// before any API or database-specific work is requested.
app.get("/", (_req, res) => {
  res.status(200).json({ status: "ok", service: "api-server" });
});

app.use("/api", router);
app.use("/privacy", privacyRouter);
app.use("/api/privacy", privacyRouter);
app.use("/delete-account", deleteAccountRouter);
app.use("/api/delete-account", deleteAccountRouter);

// Ishlab chiqarishda (masalan DigitalOcean) bitta server ham /api, ham web
// statik fayllarini xizmat qiladi. WEB_DIR o'rnatilmagan bo'lsa (Replit dev),
// faqat /api ishlaydi.
const webDir = process.env.WEB_DIR;
if (webDir && fs.existsSync(webDir)) {
  logger.info({ webDir }, "Serving static web build");
  app.use(express.static(webDir));
  // SPA / expo-router uchun: /api (va /api/*) bo'lmagan barcha so'rovlarga index.html.
  app.get(/^\/(?!api(?:\/|$)).*/, (_req, res, next) => {
    const indexFile = path.join(webDir, "index.html");
    if (fs.existsSync(indexFile)) {
      res.sendFile(indexFile);
    } else {
      next();
    }
  });
}

export default app;
