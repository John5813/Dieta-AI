import { logger } from "./logger";

const BOT_TOKEN = (process.env.TELEGRAM_BOT_TOKEN || "").trim();
const ADMIN_CHAT_ID = (process.env.TELEGRAM_ADMIN_CHAT_ID || "").trim();
const REQUEST_TIMEOUT_MS = Number(process.env.TELEGRAM_REQUEST_TIMEOUT_MS || "30000");

let _botUsername: string | null = null;

export function isConfigured() {
  return !!(BOT_TOKEN && ADMIN_CHAT_ID);
}

export function getAdminChatId() {
  return ADMIN_CHAT_ID;
}

export function getBotUsername() {
  return _botUsername;
}

type TelegramResponse<T> = {
  ok: boolean;
  error_code?: number;
  description?: string;
  result: T;
};

async function api<T = any>(
  method: string,
  body?: Record<string, unknown>,
): Promise<TelegramResponse<T>> {
  if (!BOT_TOKEN) {
    throw new Error("TELEGRAM_BOT_TOKEN is not configured");
  }

  try {
    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    const payload = (await res.json()) as {
      ok?: boolean;
      error_code?: number;
      description?: string;
      result?: T;
    };

    if (!res.ok || payload.ok !== true) {
      const error = new Error(
        `Telegram API ${method} failed (${payload.error_code ?? res.status}): ${payload.description ?? res.statusText}`,
      );
      logger.error(
        { method, statusCode: res.status, telegramErrorCode: payload.error_code, description: payload.description },
        "Telegram API request failed",
      );
      throw error;
    }

    return {
      ok: true,
      result: payload.result as T,
    };
  } catch (err) {
    if (err instanceof Error && err.message.startsWith("Telegram API ")) {
      throw err;
    }
    logger.error({ err, method }, "Telegram API network error");
    throw err;
  }
}

export async function getMe(): Promise<{ id: number; username: string } | null> {
  const response = await api<{ id: number; username?: string }>("getMe");
  const result = response.result;
  if (result?.username) {
    _botUsername = result.username;
    return { id: result.id, username: result.username };
  }
  return null;
}

export async function sendMessage(
  chatId: string | number,
  text: string,
  opts: { replyMarkup?: object; parseMode?: "HTML" | "MarkdownV2"; disablePreview?: boolean } = {},
) {
  return api("sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: opts.parseMode ?? "HTML",
    disable_web_page_preview: opts.disablePreview ?? true,
    ...(opts.replyMarkup ? { reply_markup: opts.replyMarkup } : {}),
  });
}

export async function sendPhotoBuffer(
  chatId: string | number,
  photoBuffer: Buffer,
  filename: string,
  caption: string,
  replyMarkup?: object,
): Promise<any> {
  if (!BOT_TOKEN) {
    throw new Error("TELEGRAM_BOT_TOKEN is not configured");
  }
  const boundary = `----Boundary${Date.now()}${Math.random().toString(36).slice(2)}`;
  const parts: Buffer[] = [];
  const addField = (name: string, value: string) => {
    parts.push(
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`,
      ),
    );
  };
  addField("chat_id", String(chatId));
  addField("caption", caption);
  addField("parse_mode", "HTML");
  if (replyMarkup) addField("reply_markup", JSON.stringify(replyMarkup));

  const ext = filename.split(".").pop()?.toLowerCase();
  const mime = ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";
  parts.push(
    Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="photo"; filename="${filename}"\r\nContent-Type: ${mime}\r\n\r\n`,
    ),
  );
  parts.push(photoBuffer);
  parts.push(Buffer.from(`\r\n--${boundary}--\r\n`));

  try {
    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`, {
      method: "POST",
      headers: { "Content-Type": `multipart/form-data; boundary=${boundary}` },
      body: Buffer.concat(parts),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    const payload = (await res.json()) as { ok?: boolean; error_code?: number; description?: string; result?: unknown };
    if (!res.ok || payload.ok !== true) {
      logger.error(
        { method: "sendPhoto", statusCode: res.status, telegramErrorCode: payload.error_code, description: payload.description },
        "Telegram API request failed",
      );
      throw new Error(
        `Telegram API sendPhoto failed (${payload.error_code ?? res.status}): ${payload.description ?? res.statusText}`,
      );
    }
    return payload;
  } catch (err) {
    if (!(err instanceof Error && err.message.startsWith("Telegram API sendPhoto "))) {
      logger.error({ err, method: "sendPhoto" }, "Telegram API network error");
    }
    throw err;
  }
}

export async function editMessageCaption(
  chatId: string | number,
  messageId: number,
  caption: string,
  replyMarkup?: object,
) {
  return api("editMessageCaption", {
    chat_id: chatId,
    message_id: messageId,
    caption,
    parse_mode: "HTML",
    ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
  });
}

export async function editMessageReplyMarkup(
  chatId: string | number,
  messageId: number,
  replyMarkup: object,
) {
  return api("editMessageReplyMarkup", {
    chat_id: chatId,
    message_id: messageId,
    reply_markup: replyMarkup,
  });
}

export async function answerCallbackQuery(callbackQueryId: string, text?: string, alert = false) {
  return api("answerCallbackQuery", {
    callback_query_id: callbackQueryId,
    ...(text ? { text } : {}),
    ...(alert ? { show_alert: true } : {}),
  });
}

export async function setWebhook(url: string) {
  return api("setWebhook", { url });
}

export async function deleteWebhook() {
  return api("deleteWebhook", { drop_pending_updates: false });
}

export async function forwardMessage(
  toChatId: string | number,
  fromChatId: string | number,
  messageId: number,
): Promise<any> {
  return api("forwardMessage", {
    chat_id: toChatId,
    from_chat_id: fromChatId,
    message_id: messageId,
  });
}

export async function getUpdates(offset: number, timeoutSec = 25): Promise<any[]> {
  const response = await api<any[]>("getUpdates", {
    offset,
    timeout: timeoutSec,
    allowed_updates: ["message", "callback_query"],
  });
  return Array.isArray(response.result) ? response.result : [];
}
