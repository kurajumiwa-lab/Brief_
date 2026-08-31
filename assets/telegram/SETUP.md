# Telegram — wire the bot into Brief

Two steps: create the bot (your phone), then connect it (Railway). The server
already has the full connector (`server/src/connectors/telegram.js`): token
validation (`getMe`), webhook + pull ingestion, and honest "not configured"
reporting. This document only supplies the credential and the public URL.

---

## Step 1 — Create the bot (your phone, 5 minutes)

Follow `BOTFATHER.txt`. You end up with:

- `TELEGRAM_BOT_TOKEN` — the secret token from @BotFather.

Keep it to yourself. It is the one thing standing between "Telegram not
configured" and "the city feeds itself".

---

## Step 2 — Connect it (Railway)

### 2a. Set the token
Railway → your service → **Variables** → add:

```
TELEGRAM_BOT_TOKEN=<token from BotFather>
```

Redeploy. From now on the connector dashboard will show Telegram as connected
(validated by a `getMe` call against the real Bot API).

### 2b. Choose ingestion mode

**Webhook (recommended — messages arrive instantly):**
The bot's public origin is your live site. Call the config endpoint once
(from anywhere with a token-authenticated session, or `curl`):

```
curl -X POST https://brief-production-5575.up.railway.app/api/connectors/telegram/webhook-config \
  -H 'Content-Type: application/json' \
  -d '{"url":"https://brief-production-5575.up.railway.app/api/webhooks/telegram"}'
```

The server sets the webhook on Telegram (with a generated secret if
`TELEGRAM_WEBHOOK_SECRET` is unset) and records the channel.

**Pull (no reliance on the webhook):**

```
curl -X POST https://brief-production-5575.up.railway.app/api/connectors/telegram/sync
```

This long-polls `getUpdates` and ingests queued messages. Use it to test the
token before committing to webhook mode.

### 2c. Verify (the honest checks)

1. `GET /api/connectors/telegram/status` reports `operational: true` — a real
   `getMe` + `getWebhookInfo` round trip, not just "a token string is set".
   (`/api/capabilities` still reports `telegram.configured` synchronously; its
   `telegram.verified` field carries the last verified connectivity result.)
2. `GET /api/connectors/telegram/webhook-info` shows the live webhook URL,
   pending-update count and any persistent delivery error.
3. Post a message the bot can see (a DM, or a `channel_post` from a channel the
   bot was added to): *"Saturday popup at Kilimani Studio, KES 300 entry,
   4PM-10PM"*.
4. Open Brief → the object appears in the ranked feed with Telegram as its
   provenance source.

---

## Channel ingestion (`channel_post`)

Brief ingests `channel_post` updates as well as direct messages. For Telegram to
deliver a channel's posts to the bot, ALL of these must be true:

1. **The bot must be added to the channel.** A human admin adds it
   (Bot API cannot join a channel on its own).
2. **The bot must have permission to read posts.** Add it as an administrator
   (or at minimum with read-post access).
3. **Telegram must actually deliver `channel_post` updates.** The webhook is
   registered with `allowed_updates` including `channel_post` and
   `edited_channel_post` (the connector's `setWebhook` does this).

Brief cannot read a channel's *historical* posts through the Bot API. It only
processes posts Telegram delivers to the bot from the moment the bot is added.

---

## What NOT to expect (honesty)

- **No outbound replies.** Brief has no send connector yet (see the
  architecture report §4.3). The bot ingests; it does not reply, remind, or
  confirm. That is a real, unbuilt rail — not something to fake.
- **No backfill of history.** A bot sees only posts made after it joined a
  channel/chat. Old posts require MTProto (a user account), which is not
  implemented.
- **Unconfigured until the token is set.** Until `TELEGRAM_BOT_TOKEN` exists,
  `telegram/status` reports `configured: false` with a diagnostic, and the
  dashboard shows "Needs authorization". This is correct, not a bug.

> **Webhook registration needs an operator.** `POST
> /api/connectors/telegram/webhook-config` requires an authenticated session
> holding the `ops.run` capability (it records an audit entry). The call is
> idempotent: if the webhook URL already matches, it returns `{changed:false}`
> instead of re-registering.

---

## Files

- `bot-avatar-512.png` — the round brand mark (upload as the profile picture).
- `bot-mark-transparent-512.png` — transparent variant for any other surface.
- `BOTFATHER.txt` — the exact copy-paste texts.
