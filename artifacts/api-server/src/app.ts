import path from "node:path";
import fs from "node:fs";
import express, { type Express, type NextFunction, type Request, type Response } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import privacyRouter from "./routes/privacy";
import deleteAccountRouter from "./routes/delete-account";
import { payPages } from "./routes/pay";
import { logger } from "./lib/logger";

const app: Express = express();

app.disable("x-powered-by");
// Number of reverse proxies in front of the server (DigitalOcean's load
// balancer = 1). Wrong values make every user share one IP for rate limits;
// the first requests are logged below so it can be verified.
const trustProxy = process.env["TRUST_PROXY"] ?? "1";
app.set("trust proxy", /^\d+$/.test(trustProxy) ? Number(trustProxy) : trustProxy === "false" ? false : trustProxy);
let ipProbes = 0;
app.use((req, _res, next) => {
  if (ipProbes < 5 && req.path.startsWith("/api")) {
    ipProbes++;
    logger.info({ ip: req.ip, xff: req.headers["x-forwarded-for"] }, "client ip probe (check TRUST_PROXY)");
  }
  next();
});

app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Strict-Transport-Security", "max-age=15552000; includeSubDomains");
  next();
});

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

// Native apps send no Origin header and the web build is served by this same
// server, so cross-origin browser access only needs an explicit allow-list.
const allowedOrigins = new Set(
  [process.env["PUBLIC_BASE_URL"], ...(process.env["CORS_ORIGINS"] ?? "").split(",")]
    .map((o) => o?.trim().replace(/\/+$/, ""))
    .filter((o): o is string => !!o),
);
app.use(
  cors({
    origin: (origin, cb) => cb(null, !origin || allowedOrigins.has(origin)),
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    maxAge: 600,
  }),
);

// Small default body limit. The two routes that legitimately carry big bodies
// (food photo, cloud backup) parse their own, after their rate limits ran.
const BIG_BODY_PATHS = new Set(["/api/ai/analyze-image", "/api/backup"]);
const smallJson = express.json({ limit: "256kb" });
app.use((req, res, next) => (BIG_BODY_PATHS.has(req.path) ? next() : smallJson(req, res, next)));
app.use(express.urlencoded({ extended: false, limit: "64kb" }));

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
// Website payments (Click, Payme, Uzum, cards). Must come before the SPA fallback below.
app.use("/pay", payPages);

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

// Last resort: never leak stack traces or internals to clients.
app.use((err: unknown, req: Request, res: Response, _next: NextFunction) => {
  const status = (err as { status?: number; statusCode?: number })?.status ?? (err as { statusCode?: number })?.statusCode;
  if (status === 413) {
    res.status(413).json({ error: "So'rov juda katta" });
    return;
  }
  if (typeof status === "number" && status >= 400 && status < 500) {
    res.status(status).json({ error: "Noto'g'ri so'rov" });
    return;
  }
  logger.error({ err, url: req.url?.split("?")[0] }, "unhandled error");
  if (!res.headersSent) res.status(500).json({ error: "Server xatoligi" });
});

export default app;
