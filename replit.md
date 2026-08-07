# Bir Burda / Dieta AI

O‘zbek tilidagi ovqatlanish va sog‘lom hayot ilovasi: kaloriya hisoblash, AI maslahatlari va Telegram orqali premium to‘lovlarni boshqarish.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server locally
- `pnpm --filter @workspace/dieta-ai run dev` — run the Expo mobile app
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `docker compose --env-file .env up --build` — run API + PostgreSQL locally
- `docker compose config` — validate the Compose file before deployment
- Required runtime env: `DATABASE_URL`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_ADMIN_CHAT_ID`

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/dieta-ai` — Expo mobile application
- `artifacts/api-server` — Express API, payment routes, AI routes and Telegram bot
- `lib/db` — PostgreSQL connection, idempotent startup schema and Drizzle tables
- `Dockerfile`, `docker-compose.yml` — production API container and local Postgres stack
- `deploy/digitalocean-app.yaml` — DigitalOcean App Platform Docker deployment template

## Architecture decisions

- PostgreSQL is the only server-side database. Startup schema creation is idempotent so a new container can boot without a separate migration process.
- Telegram uses long polling and explicitly removes any previous webhook before polling. Keep the DigitalOcean service at one instance unless polling is replaced with webhooks.
- The API binds to `0.0.0.0`, exposes a dependency-free `GET /` readiness probe, and logs Telegram API failures without logging the bot token.
- Secrets are runtime environment values; they are never committed to Docker files or application source.

## Product

- Onboarding and personal nutrition profile
- Food diary, calorie and macro tracking
- AI food analysis, chat, exercise and meal plans
- Telegram-linked payment receipt review and premium activation
- Admin Telegram controls for approvals, partial payments, broadcasts and promo codes

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- `pnpm-lock.yaml` is generated with pnpm 10.26.1; Docker must keep that exact package-manager major/version for frozen installs.
- In production, missing `DATABASE_URL` is a fatal startup error; in development the API can boot without persistence for readiness checks.
- Telegram polling requires both `TELEGRAM_BOT_TOKEN` and `TELEGRAM_ADMIN_CHAT_ID`. If either is missing, startup logs a warning and leaves the API available.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
