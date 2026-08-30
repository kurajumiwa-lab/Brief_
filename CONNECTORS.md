# Connectors — the files, the credentials, the wiring

Every connector seam **fails closed**: with no credentials the endpoint refuses with a stated reason, `/api/capabilities` reports the true state, and nothing pretends to work. This map tells you exactly which file does what, which env vars each needs, and where to get them.

---

## 1. Telegram — onboarding + group/channel ingestion

**The loop:** person taps START in your bot → the bot replies with one button, **"Open Brief"** → the Mini App opens inside Telegram → `initData` signs them in (`POST /api/telegram/init`) → the normal onboarding runs. Group and channel messages to the same webhook become discovery content.

| File | What it is |
|---|---|
| `server/src/connectors/telegram.js` | Bot API client: `verifyInitData` (HMAC), `setWebhook`, `classifyOnboardingCommand`, `sendWebAppButton`, `setChatMenuButton`, `setMyCommands` |
| `server/src/routes/connectors.js` | `/api/telegram/init` (Mini App auth) · `/api/webhooks/telegram` (ingest + the private `/start`–`/help` handshake) · `/api/connectors/telegram/verify`, `/sync`, `/webhook-config` |
| `scripts/telegram-setup.mjs` | The one-time setup: proves the token, sets the webhook + secret header, makes the menu button the Mini App, sets `/start` + `/help` |
| `App.tsx` (~line 5228) | Client: detects the Mini App, exchanges `initData` for a session, binds it to a Brief account |

**Credentials (from [@BotFather](https://t.me/BotFather)):**
1. `/newbot` → the token → `TELEGRAM_BOT_TOKEN`
2. Generate a webhook secret: `node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"` → `TELEGRAM_WEBHOOK_SECRET`
3. Your public https URL → `BRIEF_PUBLIC_ORIGIN` (also used by the Mini App button)

**Run it:**
```bash
TELEGRAM_BOT_TOKEN=… TELEGRAM_WEBHOOK_SECRET=… BRIEF_PUBLIC_ORIGIN=https://your.host \
  node scripts/telegram-setup.mjs
```

**Test it:** open the bot, tap START — you should get one button. In the app:
```bash
curl -s https://your.host/api/connectors/telegram/verify
```

**Honest limits:** the bot only sees chats it was added to (`member_access`); normal WhatsApp-style channel scraping needs the bot as admin; no file on this side is needed — everything is env + code.

---

## 2. WhatsApp (Meta Cloud API) — receive + basic ack

**The loop:** a person messages your WhatsApp Business number → Meta POSTs to your webhook (signature-checked) → the message becomes a raw item → discovery content → **the sender gets a one-line ack** ("Received. Your message is saved in Brief.") when sending is configured.

| File | What it is |
|---|---|
| `server/src/connectors/whatsapp.js` | `verifySubscription` (the GET handshake), `verifySignature` (X-Hub-Signature-256), `normalizeWebhook`, `sendText` (Cloud API, fail-closed), `isSendConfigured` |
| `server/src/routes/connectors.js` | `/api/webhooks/whatsapp` GET (verify) + POST (ingest + ack) |
| `server/src/domain/huduma/whatsapp.js` | The HudumaLink conversational payloads (buttons/lists/documents) — a separate, phone-keyed product |

**Credentials (from [developers.facebook.com](https://developers.facebook.com)):**
1. Create an app → add the *WhatsApp* product → a test or live phone number
2. **Receive:** App secret → `WHATSAPP_APP_SECRET`; a token of your choice → `WHATSAPP_VERIFY_TOKEN`
3. **Send (the ack):** a permanent System User access token → `WHATSAPP_ACCESS_TOKEN`; the phone number id from the dashboard → `WHATSAPP_PHONE_NUMBER_ID`
4. In the app dashboard → WhatsApp → Configuration: set the **Callback URL** to `https://your.host/api/webhooks/whatsapp` and the **Verify token** to your `WHATSAPP_VERIFY_TOKEN`, then complete "Subscribe to the field" (that is the GET handshake — this repo answers it)

**Test it:**
```bash
# the handshake (should echo the challenge):
curl -s "https://your.host/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=YOUR_TOKEN&hub.challenge=1234567"
# then message the business number from your phone; the ack should arrive
```

**Honest limits:** *group chats are NOT ingestable* — the Cloud API has no group access; unofficial libraries violate ToS and risk a permanent ban. Only messages sent **to your business number** arrive. Template messages (needed to initiate conversations outside the 24h window) are not used; the ack only rides the reply window your own message opens.

---

## 3. The rest of the seams (same pattern)

| Seam | File | Env | State without it |
|---|---|---|---|
| M-Pesa Daraja (STK) | `server/src/connectors/mpesa.js` | (HudumaLink-scoped) | HudumaLink payment step refuses |
| Twilio (SMS/WhatsApp send) | `server/src/connectors/twilio.js` | Twilio creds in env | outbound `sms`/`whatsapp` honestly unconfigured |
| Paystack | `server/src/connectors/paystack.js` | — | collections off; the compliance gate owns the door |
| Smile ID (KYC) | `server/src/connectors/smileid.js` | — | verification submits fail closed |
| Tuma (payments) | `server/src/connectors/tuma.js` | `TUMA_EMAIL`, `TUMA_API_KEY`, `TUMA_WEBHOOK_SECRET` | collections off |
| Web/RSS ingestion | `server/src/connectors/web.js`, `rss.js` | — | works; per-source authorisation |

**Pochi la Biashara has no API** — service fees stay manual by design (member submits the M-Pesa code, a `BRIEF_FINANCE` operator confirms it).

---

## 4. Verify everything at once

```bash
node scripts/preflight.mjs https://your.host --admin-token <jwt>   # the go-live gate
curl -s https://your.host/api/capabilities -H "Authorization: Bearer <jwt>"  # every connector's true state
```

Both are honest: an unconfigured seam is reported as off, never as healthy.
