import fs from "node:fs";
import path from "node:path";
import express, { type Express, type Request, type Response } from "express";
import { logger } from "./logger";
import { getSiteConfig, pixelIds } from "./siteConfig";

/**
 * Serves the kaloria.uz marketing site (artifacts/web/public): a few
 * hand-written HTML pages plus /assets. Each page gets the business config
 * (prices, contacts) and the optional ad pixels injected at the
 * `<!--KALORIA:HEAD-->` marker, so the browser needs no extra request.
 */

const PAGES: Record<string, string> = {
  "/": "index.html",
  "/hisoblash": "hisoblash.html",
  "/oferta": "oferta.html",
};

export function resolveSiteDir(): string | null {
  const candidates = [
    process.env["SITE_DIR"],
    path.resolve(process.cwd(), "../web/public"),
    path.resolve(process.cwd(), "artifacts/web/public"),
  ].filter((p): p is string => !!p);
  for (const dir of candidates) {
    if (fs.existsSync(path.join(dir, "index.html"))) return dir;
  }
  return null;
}

function headSnippet(): string {
  const cfg = getSiteConfig();
  const json = JSON.stringify(cfg).replace(/</g, "\\u003c");
  const parts = [`<script>window.KALORIA=${json};</script>`];
  const { meta, tiktok } = pixelIds();
  if (meta) {
    parts.push(
      `<script>!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${meta}');fbq('track','PageView');</script>`,
    );
  }
  if (tiktok) {
    parts.push(
      `<script>!function(w,d,t){w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie"];ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e};ttq.load=function(e,n){var i="https://analytics.tiktok.com/i18n/pixel/events.js";ttq._i=ttq._i||{};ttq._i[e]=[];ttq._i[e]._u=i;ttq._t=ttq._t||{};ttq._t[e]=+new Date;ttq._o=ttq._o||{};ttq._o[e]=n||{};var o=document.createElement("script");o.type="text/javascript";o.async=!0;o.src=i+"?sdkid="+e+"&lib="+t;var a=document.getElementsByTagName("script")[0];a.parentNode.insertBefore(o,a)};ttq.load('${tiktok}');ttq.page();}(window,document,'ttq');</script>`,
    );
  }
  return parts.join("\n");
}

export function mountSite(app: Express): boolean {
  const dir = resolveSiteDir();
  if (!dir) {
    logger.warn("Website files not found (artifacts/web/public); serving the API only");
    return false;
  }
  logger.info({ dir }, "Serving kaloria.uz website");
  const cache = new Map<string, string>();
  const isProd = process.env["NODE_ENV"] === "production";

  const render = (file: string): string => {
    const cached = isProd ? cache.get(file) : undefined;
    const raw = cached ?? fs.readFileSync(path.join(dir, file), "utf8");
    if (isProd) cache.set(file, raw);
    return raw.replace("<!--KALORIA:HEAD-->", headSnippet());
  };

  // www.kaloria.uz → kaloria.uz, so links, cookies and pixels see one origin.
  app.use((req, res, next) => {
    const host = req.hostname;
    if (host && host.startsWith("www.") && (req.method === "GET" || req.method === "HEAD")) {
      res.redirect(301, `${req.protocol}://${host.slice(4)}${req.originalUrl}`);
      return;
    }
    next();
  });

  for (const [route, file] of Object.entries(PAGES)) {
    const handler = (_req: Request, res: Response) => {
      try {
        res.setHeader("Cache-Control", "no-cache");
        res.type("html").send(render(file));
      } catch (err) {
        logger.error({ err, file }, "Failed to render site page");
        res.status(500).send("Server xatoligi");
      }
    };
    app.get(route, handler);
    if (route !== "/") app.get(`${route}.html`, (_req, res) => res.redirect(301, route));
  }

  app.use(
    "/assets",
    express.static(path.join(dir, "assets"), {
      maxAge: isProd ? "7d" : 0,
      fallthrough: false,
      index: false,
    }),
  );
  app.get("/favicon.png", (_req, res) => res.sendFile(path.join(dir, "assets", "favicon.png")));
  app.get("/favicon.ico", (_req, res) => res.sendFile(path.join(dir, "assets", "favicon.png")));
  return true;
}
