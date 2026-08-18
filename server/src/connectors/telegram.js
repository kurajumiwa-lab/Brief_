// ---------------------------------------------------------------------------
// TELEGRAM CONNECTOR (real Bot API)
//
// What the Bot API genuinely allows, and what it does not:
//
//   CAN   getMe                  -- validate a bot token
//   CAN   getUpdates / webhook   -- receive messages pushed to the bot
//   CAN   read group messages    -- ONLY if privacy mode is disabled, or the
//                                   bot is an admin, or the message is a
//                                   command / a reply to the bot
//   CAN   read channel posts     -- ONLY if the bot is a member/admin of that
//                                   channel
//   CANNOT read history          -- there is no Bot API method to fetch past
//                                   messages. A bot sees traffic only from the
//                                   moment it joins. Backfill requires MTProto
//                                   (a user account), which is a different
//                                   authorization model entirely.
//   CANNOT join a channel itself -- a human admin must add it.
//
// The token never leaves the server (spec 28).
// ---------------------------------------------------------------------------

const API = 'https://api.telegram.org';

function token() {
  return process.env.TELEGRAM_BOT_TOKEN || '';
}

export function isConfigured() {
  return token().length > 0;
}

async function call(method, params, timeoutMs = 10000) {
  if (!isConfigured()) {
    return { ok: false, error: 'TELEGRAM_BOT_TOKEN is not set', unconfigured: true };
  }
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${API}/bot${token()}/${method}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(params ?? {}),
      signal: ctrl.signal
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok || body.ok === false) {
      return {
        ok: false,
        status: res.status,
        error: body.description || `HTTP ${res.status}`,
        // 429 carries retry_after; respected by the caller (spec 31).
        retryAfter: body.parameters?.retry_after ?? null
      };
    }
    return { ok: true, result: body.result };
  } catch (err) {
    return { ok: false, error: err.name === 'AbortError' ? 'timeout' : String(err.message) };
  } finally {
    clearTimeout(timer);
  }
}

/** Validate the token and identify the bot. */
export async function verify() {
  const res = await call('getMe');
  if (!res.ok) return res;
  return {
    ok: true,
    bot: {
      id: res.result.id,
      username: res.result.username,
      canReadAllGroupMessages: res.result.can_read_all_group_messages ?? false,
      canJoinGroups: res.result.can_join_groups ?? false
    }
  };
}

/** Pull queued updates (long-poll style, used when no webhook is set). */
export async function fetchUpdates(offset) {
  const res = await call('getUpdates', { offset, timeout: 0, limit: 100 });
  if (!res.ok) return res;
  return { ok: true, updates: res.result };
}

export async function setWebhook(url, secret) {
  return call('setWebhook', {
    url,
    secret_token: secret,
    allowed_updates: ['message', 'channel_post', 'edited_message', 'edited_channel_post']
  });
}

export async function deleteWebhook() {
  return call('deleteWebhook', {});
}

export async function getWebhookInfo() {
  return call('getWebhookInfo', {});
}

/** Confirm the bot can actually see a given chat before claiming access. */
export async function getChat(chatId) {
  return call('getChat', { chat_id: chatId });
}

/**
 * Normalize a Telegram update into the shape storeRawItem expects.
 * Returns null for updates carrying no usable text.
 */
// Telegram caps a message at 4096 characters; anything vastly larger is not
// a real Telegram message and is refused rather than stored.
const MAX_TEXT_LENGTH = 16384;

/**
 * Structural validation for an inbound update.
 *
 * Separate from `normalizeUpdate` so the route can distinguish three cases
 * that used to be conflated:
 *
 *   - valid and usable            -> process it
 *   - valid but nothing to ingest -> 200 with `ignored` (a photo, a join event)
 *   - PERMANENTLY malformed       -> 400, so the sender stops retrying
 *
 * Only rejects what can never succeed. An update carrying no text is NOT
 * malformed -- Telegram legitimately sends those, and they are ignored.
 */
export function validateUpdateShape(update) {
  if (update === null || typeof update !== 'object' || Array.isArray(update)) {
    return { ok: false, error: 'update must be a JSON object' };
  }

  const msg =
    update.message || update.channel_post ||
    update.edited_message || update.edited_channel_post;

  // No message at all is a legitimate update Brief simply ignores.
  if (msg === undefined || msg === null) return { ok: true };
  if (typeof msg !== 'object' || Array.isArray(msg)) {
    return { ok: false, error: 'message must be an object' };
  }

  // message_id and chat.id form the dedup key, so they must be scalars.
  if (msg.message_id !== undefined &&
      typeof msg.message_id !== 'number' && typeof msg.message_id !== 'string') {
    return { ok: false, error: 'message_id must be a number or string' };
  }
  if (msg.chat !== undefined) {
    if (typeof msg.chat !== 'object' || msg.chat === null || Array.isArray(msg.chat)) {
      return { ok: false, error: 'chat must be an object' };
    }
    if (msg.chat.id !== undefined &&
        typeof msg.chat.id !== 'number' && typeof msg.chat.id !== 'string') {
      return { ok: false, error: 'chat.id must be a number or string' };
    }
    if (msg.chat.type !== undefined && msg.chat.type !== null &&
        typeof msg.chat.type !== 'string') {
      return { ok: false, error: 'chat.type must be a string' };
    }
  }
  if (msg.text !== undefined && msg.text !== null && typeof msg.text !== 'string') {
    return { ok: false, error: 'text must be a string' };
  }
  if (msg.caption !== undefined && msg.caption !== null && typeof msg.caption !== 'string') {
    return { ok: false, error: 'caption must be a string' };
  }
  // `date` is unix seconds. A non-numeric date would silently become an
  // Invalid Date and poison publishedAt.
  if (msg.date !== undefined && msg.date !== null &&
      (typeof msg.date !== 'number' || !Number.isFinite(msg.date))) {
    return { ok: false, error: 'date must be a unix timestamp in seconds' };
  }

  const text = typeof msg.text === 'string' ? msg.text
             : typeof msg.caption === 'string' ? msg.caption : '';
  if (text.length > MAX_TEXT_LENGTH) {
    return { ok: false, error: `text exceeds ${MAX_TEXT_LENGTH} characters` };
  }

  return { ok: true };
}

export function normalizeUpdate(update) {
  const msg =
    update.message || update.channel_post ||
    update.edited_message || update.edited_channel_post;
  if (!msg) return null;

  const text = msg.text || msg.caption || '';
  if (!text.trim()) return null;

  const chat = msg.chat ?? {};
  const from = msg.from ?? {};

  // A public link is only constructible for a chat with a username.
  const rawUrl = chat.username
    ? `https://t.me/${chat.username}/${msg.message_id}`
    : null;

  const media = [];
  if (msg.photo?.length) {
    media.push({ kind: 'image', reference: msg.photo.at(-1).file_id, caption: msg.caption ?? null });
  }
  if (msg.document) {
    media.push({ kind: 'document', reference: msg.document.file_id, caption: msg.document.file_name ?? null });
  }

  return {
    externalId: `${chat.id}:${msg.message_id}`,
    messageId: String(msg.message_id),
    author: from.username || [from.first_name, from.last_name].filter(Boolean).join(' ') || null,
    text,
    media,
    publishedAt: msg.date ? new Date(msg.date * 1000).toISOString() : null,
    rawUrl,
    chat: {
      id: chat.id,
      title: chat.title || chat.username || null,
      type: chat.type || null,
      username: chat.username || null
    }
  };
}

/** Honest capability report (spec 27). */
export const capabilities = {
  connector: 'telegram',
  authenticate: 'yes - getMe with a bot token',
  receive: 'yes - webhook or getUpdates',
  history: 'no - Bot API exposes no history; a bot only sees messages sent after it joins',
  privateGroups: 'conditional - requires the bot to be added and privacy mode disabled or admin rights',
  channels: 'conditional - the bot must be a member/admin of the channel',
  notes: 'Backfilling old posts requires MTProto (user account auth), which is a different authorization model and is not implemented.'
};
