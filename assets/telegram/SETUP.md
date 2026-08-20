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

1. `GET /api/capabilities` now reports `telegram.configured: true`.
2. Send the bot a message: *"Saturday popup at Kilimani Studio, KES 300
   entry, 4PM-10PM"*.
3. Open Brief → the object appears in the ranked feed with Telegram as its
   provenance source.

---

## What NOT to expect (honesty)

- **No outbound replies.** Brief has no send connector yet (see the
  architecture report §4.3). The bot ingests; it does not reply, remind, or
  confirm. That is a real, unbuilt rail — not something to fake.
- **No group ingestion.** The bot takes DMs only. Group messages are refused,
  matching the WhatsApp connector's behaviour.
- **Unconfigured until the token is set.** Until `TELEGRAM_BOT_TOKEN` exists,
  Telegram routes return 503 "not configured" and the dashboard shows "Needs
  authorization". This is correct, not a bug.

---

## Files

- `bot-avatar-512.png` — the round brand mark (upload as the profile picture).
- `bot-mark-transparent-512.png` — transparent variant for any other surface.
- `BOTFATHER.txt` — the exact copy-paste texts.
