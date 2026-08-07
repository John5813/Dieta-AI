import app from "./app";
import { logger } from "./lib/logger";
import { ensureSchema, pool } from "@workspace/db";
import { startBotPolling, stopBotPolling } from "./lib/bot";

const rawPort = process.env["PORT"]?.trim();
const port = Number(rawPort ?? "8080");

if (!rawPort) {
  logger.warn("PORT environment variable was not provided, defaulting to 8080");
}

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort ?? "8080"}"`);
}

const server = app.listen(port, "0.0.0.0", async (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");

  try {
    await ensureSchema();
    logger.info("Database schema is ready");
  } catch (error) {
    logger.error({ err: error }, "Database schema initialization failed");
    process.exit(1);
  }

  try {
    await startBotPolling();
  } catch (error) {
    logger.error({ err: error }, "Telegram bot startup failed; server will remain available");
  }
});

pool?.on("error", (error) => {
  logger.error({ err: error }, "Unexpected PostgreSQL pool error");
});

async function shutdown(signal: string) {
  logger.info({ signal }, "Shutdown requested");
  stopBotPolling();
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await pool?.end();
  process.exit(0);
}

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.once(signal, () => {
    void shutdown(signal);
  });
}
