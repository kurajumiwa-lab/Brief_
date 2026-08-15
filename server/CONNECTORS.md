# Brief connectors — what actually works

Every claim below was executed against the real API, not simulated. Where a
capability is missing, the reason is technical or legal, and it is stated
rather than worked around.

Test suite: `node test/run.js` → **94 passed, 0 failed, 1 skipped**
(the skip is the authenticated Telegram test; it needs a bot token).

---

## Capability matrix

| | Telegram | WhatsApp Cloud | Web | RSS | Manual |
|---|---|---|---|---|---|
| Authenticate / configure | ✅ `getMe` | ✅ app secret + verify token | n/a | n/a | n/a |
| Receive real content | ✅ webhook + `getUpdates` | ✅ inbound DMs | ✅ HTTP GET | ✅ HTTP GET | ✅ paste |
| Store raw item | ✅ | ✅ | ✅ | ✅ | ✅ |
| Normalize | ✅ | ✅ | ✅ | ✅ | ✅ |
| Extract object | ✅ | ✅ | ✅ | ✅ | ✅ |
| Preserve provenance | ✅ | ⚠️ no permalink exists | ✅ | ✅ | ⚠️ user-supplied |
| Deduplicate | ✅ | ✅ | ✅ | ✅ | ✅ |
| Connect to graph | ✅ | ✅ | ✅ | ✅ | ✅ |
| Open original source | ✅ public chats only | ❌ **no public URL exists** | ✅ | ✅ | ⚠️ if supplied |
| Read group history | ❌ **not possible** | ❌ **not possible** | n/a | n/a | n/a |

---

## Telegram — works, with one hard limit

**Verified against the live API.** With no token configured, `getMe` returns a
genuine `401 Unauthorized` from `api.telegram.org` — proof the code path is
real. Webhook ingestion was exercised end to end: secret-token rejection,
message → raw item → event + vendor + product, and redelivery dedup.

**What the Bot API cannot do:** there is no method to fetch history. A bot sees
only messages sent *after* it joins. Backfilling an existing group requires
MTProto (full user-account authentication), a different authorization model
with materially different privacy implications. Not implemented.

**Conditions for group/channel reading:** the bot must be added by an admin,
and either privacy mode must be disabled or the bot must be an admin.
Otherwise Telegram delivers only commands and replies. Brief cannot grant
itself this access.

**Permalinks** are only constructible for chats with a username. Private groups
have no public URL, so `sourceUrl` stays `null` rather than being faked.

## WhatsApp — inbound DMs only. Group ingestion is impossible.

**Works:** the Cloud API webhook. Subscription handshake and
`X-Hub-Signature-256` HMAC verification are implemented and tested
(valid accepted, tampered rejected, missing rejected — timing-safe).

**Does not work, and cannot:** ordinary WhatsApp **group** ingestion. The Cloud
API has no group-messaging capability; a business number cannot join a normal
group and no webhook event exists for group traffic. Channels are likewise not
readable by third parties.

The only alternatives are unofficial reverse-engineered libraries that breach
the WhatsApp ToS and risk a permanent number ban. **Refused.** The supported
path is exporting a chat and pasting it through the manual connector, which
keeps provenance honest about where the text came from.

WhatsApp messages have no public permalink, so `sourceUrl` is always `null`.

## Web — real fetching, robots.txt honoured

Live-tested against example.com, Wikipedia, GitHub and Facebook.

- **robots.txt is enforced.** Facebook's `Disallow: /` blocks the fetch.
- Full REP matching: `*` wildcards, `$` anchors, longest-match-wins, and
  `Allow` overrides. GitHub's `/search$` and `/*/*/pulse` are correctly blocked
  while ordinary repo pages are allowed.
- **SSRF guarded**: localhost, `127.0.0.0/8`, `10/8`, `192.168/16`,
  `172.16-31`, `169.254` (cloud metadata) and non-HTTP schemes are all refused.
- Extraction uses OpenGraph, `<meta>` and JSON-LD. It is regex-based, not a DOM
  parser — JavaScript-rendered pages yield little, which is stated rather than
  hidden.

> ⚠️ A parser bug found and fixed during testing: a blank line between
> `User-agent: *` and its rules was ending the group early, silently dropping
> every wildcard rule. Brief would have crawled disallowed paths believing it
> had permission. A regression test now covers it.

## RSS — works

Live-tested against the BBC world feed: 24 items parsed, links and publish
dates preserved. RSS 2.0 and Atom, dependency-free. Non-feed URLs are rejected
honestly rather than half-parsed. Authenticated/paywalled feeds unsupported.

## Manual / Brief It — always available

The fallback for any platform Brief cannot integrate with. Preview writes
nothing; the user chooses to save.

---

## Pipeline guarantees (tested)

- **Nothing is invented.** "Saturday popup" yields `dayOfWeek: saturday` and
  *no* calendar date. Sparse messages produce no price and no location.
  Conversation (`"hey is anyone going today?"`) produces no object at all.
- **Every field carries evidence** — the exact substring it came from — so a
  reviewer can audit the parser instead of trusting it.
- **Admission fees are not products.** "Entry KES 300" produces no product.
  (Found in testing: it was creating a product called "Entry".)
- **One canonical object per real-world thing.** The same popup from Telegram,
  a WhatsApp export and a manual paste = 1 event with 3 sources, escalated to
  `cross_source_confirmed`. A genuinely different event is not merged.
- **Private sources default to non-public.** An object from a member-access
  source is `source_members`; only a genuinely public source yields `public`.
- **"From your groups" requires a real membership row.** `userHasAccess` is
  false until a membership is explicitly recorded. Membership cannot be
  inferred from a source being popular.
- **Confidence is layered**: `sourceConfidence`, `extractionConfidence` and
  `verificationStatus` are tracked separately and never conflated.

## Security

Secrets stay server-side (`TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`,
`WHATSAPP_APP_SECRET`, `WHATSAPP_VERIFY_TOKEN`). The client calls `/ingest/*`,
proxied by Vite; no token is ever sent to the browser. Webhook secrets are
verified before any processing, rate limiting is token-bucket per host/endpoint,
and retries use exponential backoff honouring Telegram's `retry_after`.

## Running it

```bash
cd server && npm install && npm start        # :8787
TELEGRAM_BOT_TOKEN=... npm start             # enables live Telegram
node test/run.js                             # 84 tests
OFFLINE=1 node test/run.js                   # skip network tests
```

To receive Telegram pushes you need a public HTTPS URL:
`POST /api/connectors/telegram/webhook-config {"url":"https://.../api/webhooks/telegram"}`.
Without one, use `POST /api/connectors/telegram/sync` (pull mode).
