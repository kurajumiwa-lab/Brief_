# Trace — The WhatsApp Business Integration (Builder Prompt)

> Status: **the outbound rail is standing; the inbound rail is recorded as
> absent — in the tree's own words.** The prompt cites
> "`server/src/connectors/whatsapp.js` (already implemented)" — the file is
> `whatsappMeta.js`, and it is the **outbound** adapter: Meta Cloud API
> direct, no BSP, fails closed with credentials named, and a header that
> already carries the prompt's own rule — "Outbound mass messaging outside
> the 24h window requires Meta-approved templates, which is the operator's
> obligation, not something this connector papers over." The inbound side —
> the bot this prompt really is — is written down as a gap in
> `twilio.js:33`: **"Outbound only. Inbound SMS/WhatsApp receive is a
> separate, unbuilt rail."** The group buy engine already fans out to
> WhatsApp via the Universal Data Router. Voice notes have no
> transcription provider anywhere in the tree.
>
> Read **Corrections first**. Verified against the tree on 2026-09-21.

---

## Corrections first (what was changed, and why)

1. **The citation: wrong filename, right spirit — and the gap named in
   the tree's own words.** `whatsappMeta.js` wraps
   `domain/huduma/whatsapp.js` ("single source of truth — one Graph API
   implementation, not two"), exposes the standard send interface, and
   reports `direct: true — no BSP/SaaS middleman`. Env names differ from
   the prompt's list (`WHATSAPP_TOKEN` + `WHATSAPP_PHONE_NUMBER_ID`, not
   `WHATSAPP_ACCESS_TOKEN`). What does not exist is anything that
   *hears*: Twilio's notes say it outright — "Outbound only. Inbound
   SMS/WhatsApp receive is a separate, unbuilt rail." This prompt is that
   rail. The webhook-handling pattern exists next door (Telegram ingestion
   at `/api/webhooks/telegram`, feature-gated, raw items persisted before
   processing) — the WhatsApp inbound door should be its sibling, not a
   new architecture.

2. **The conversational bot is genuinely new — the first in this repo.**
   Telegram ingestion stores channel posts; it does not converse. The
   command parser, the per-user state machine (`USER_STATE` with one
   `currentFlow` at a time), the ambiguity fallback ("Sijaelewa. Reply
   HELP") — all new, all consistent with the house way: states are rows,
   sessions are timestamps, an unknown command is refused with the way
   out, the same refusal philosophy as every door in this series. The
   command vocabulary's discipline ("the user learns 3–5 commands, not
   20"; never SAVE_ORDER, never INITIATE_PAYMENT) is the same law as the
   UI's — jargon is a refused API call wearing a chat bubble.

3. **Voice notes are gated on a provider decision, like every money rail
   in this series.** No speech-to-text exists anywhere in the tree —
   no Whisper, no Azure, no Google — and `assist.js` already reports the
   honest state for its own AI dependency: "No AI provider is
   configured." The voice-note flow's confidence thresholds (≥0.85
   proceed, 0.60–0.85 confirm, <0.60 ask) are a good spec for a provider
   that isn't chosen. Until one is: voice notes must be refused with the
   reason — "voice is not supported yet, type or send a photo" — never
   half-understood. The prompt's own audit instinct ("the transcript is
   stored as a text row, so the audit trail is preserved") is exactly
   right and kept.

4. **Photo handling meets the documents decision for the third time.**
   Storefront photos, product photos, receipts — all fine (uploads
   exist). The partner flow's ID photo and selfie-with-ID is the same
   identity-evidence question the Verification and Partners records
   faced against "no documents, ever." Three prompts now want the same
   rule changed. That is no longer drift; it is a decision waiting to be
   made once, in writing, with retention limits — and until it is made,
   the WhatsApp registration flow collects structured facts, not ID
   images, on the field-agent gate's precedent.

5. **"Chat on WhatsApp" replacement — refused twice over.** The prompt
   would replace the shop's own WhatsApp link with "the Trace Business
   number routing" — making Trace the middleman of every buyer-seller
   conversation. The recorded design is the opposite: the owner controls
   their contact, the digits are theirs (with the hide-the-digits
   trade-off documented), and "Trace is the record, WhatsApp stays the
   chat." It is also practically wrong: Meta's rules route sessions per
   user-consent; a buyer message to Trace's number about *another
   business's* order creates a consent and 24-hour window Trace cannot
   honestly claim. The shop's own number stays. Trace's number is for
   Trace's own transactions — dispatch, receipts, disputes — which is
   precisely what the rest of this prompt builds.

6. **"Any WhatsApp integration that isn't through the official Business
   API" — scoped, or it condemns a built connector.** Twilio's WhatsApp
   is a legitimate Meta BSP path — the prompt itself lists Twilio as an
   acceptable BSP two sections earlier. The removal as written would
   delete one of the two standing send providers. Scope it to what it
   means (no unofficial/gateway hacks; none exist) and both connectors
   survive — outbound.js keeps its fail-closed pair, Meta direct and
   Twilio, exactly as built.

7. **Group buy: the engine exists and already shouts to WhatsApp.**
   `groupbuy.js` runs contributions as real ledger rows through a
   server-authoritative stepper (Funding Pool Initiated → Target
   Achieved → Merchant Escrow Locked → Bulk Order Dispatched →
   Individual Delivery) — and its signals "fan out to the group's
   WhatsApp / Telegram / webhook endpoints" through the Universal Data
   Router. The prompt's organiser Q&A (product → wholesaler → prices →
   threshold → close → own commitment → CONFIRM) is the missing front
   door to a built engine, and the copy-paste share message is the
   right shape: Trace composes, the estate group converses, the rows
   stay here. Its money honesty is already the tree's ("a contribution
   is a RECORD, not a settled payment — no provider is connected, and
   nothing here pretends otherwise").

8. **The buyer flow prints "★ 4.6 (12)" — the aggregate now appears in a
   fourth surface.** Public page, Nearby card, share preview, and now
   the WhatsApp shop list — each new surface inherits the Reviews
   record's unresolved decision rather than making it. The WhatsApp
   list must read the same one read function with the same threshold,
   and it cannot ship ratings before that decision is written. (The
   Buni STK payment half of the same flow, notably, is standing — the
   buyer's PAY step is the one payment this whole series can actually
   complete today.)

9. **Identity: the WhatsApp number is the account — the same decision,
   second asking.** The Consumer Profile record faced "the phone is the
   account" against the real auth boundary (scrypt passwords, sessions,
   named passwordless variants). The WhatsApp bot makes the question
   sharper: WhatsApp-first users will exist whose only identity is a
   wa_id. The answer is the same and must be written once: extend the
   boundary (a verified WhatsApp identity as an `authProvider` variant —
   the model already anticipates non-password providers), never a fork.
   The masked-number display and the STOP semantics ride the shop
   brief's prefs pattern (explicit choices, structurally enforced).

10. **Templates: the two template systems finally reconciled on paper.**
    `spaceAudience.js` templates are the *vendor's own words* — prefill,
    never send. The prompt's five are *system* UTILITY templates — sent,
    transactional, approval-gated. Different objects, no conflict, and
    the prompt's "no marketing templates exist. No 're-engage,' no 'we
    miss you'" is the no-engagement law restated in Meta's vocabulary.
    "Every message ends with an action," enforced by a test that loops
    every template asserting an action keyword, is the house law made
    mechanical — build that test exactly as written.

11. **Rate limits and fallback: the seam already fails closed; the queue
    is the house queue.** Per-user outbound throttling rides
    `queue.js`'s token bucket (`allow(key, ratePerMin, burst)` — the
    same infrastructure the Settlement record pointed at); "order-related
    messages not rate limited" needs a deliberate, stated exception, not
    a silent bypass. The SMS fallback is real and near: the outbound
    seam's channels already include sms with Twilio standing — the
    fallback is a routing rule at the seam, same content, same action,
    exactly as the prompt says. The honesty it preserves (messages
    arrive late, not never; nothing fabricated as delivered) is already
    the seam's constitution.

12. **The recap: fourteenth claimed, thirteenth arrived.** Group Buy
    Streams is phantom a third time — counted in the table, ordered in
    the build sequence, never sent. Thirteen prompts have genuinely
    arrived, this being the thirteenth. The remaining honest list:
    Space Editor v2, The Trace Card, The Field Agent App, The Protection
    Fund, Trace for Cooperatives (which will meet `coop.js`,
    `coopOperations.js` and the circle treasury — tell the writer to
    read first).

---

## The prompt's test requirements, mapped

| Required by the prompt | Where it stands |
| --- | --- |
| `HI` returns the welcome flow | new — the inbound rail (corrections 1–2) |
| `BUY` returns the shop search | new — the list is `listPublicSpaces` re-ranked; the ratings line waits on the aggregate decision (correction 8) |
| voice note transcribed; low confidence clarifies | **gated** — no STT provider exists (correction 3) |
| photo handled by context; unclear asks | new — ID photos gated on the documents decision (correction 4) |
| partner registration via WhatsApp | new — and gated on carriers + documents (Partners record) |
| ONLINE/OFFLINE via WhatsApp | new — on the two-field availability fix |
| job offer to nearest, first accept wins | new — the dispatch filter from the Partners record |
| order placed, paid, confirmed via WhatsApp only | held in the decisive half — Buni STK collection is the one complete money path today |
| group buy created via WhatsApp only | **held in substance** — the engine exists, the router already fans out to WhatsApp; the front door is new (correction 7) |
| run created via WhatsApp only | gated — the run itself is unbuilt (shopping spec) |
| nothing non-essential outside the 24h window | **held** — written into the connector header as the operator's obligation (correction 1) |
| templates UTILITY-only, no marketing | new — the no-engagement law in Meta's vocabulary (correction 10) |
| SMS fallback works | near-standing — the outbound seam has both channels; the routing rule is new (correction 11) |
| STOP opts out of non-essential | new — prefs pattern from the shop brief |
| language preference persists | new — a field on the user row |
| every template ends with an action | new test — house law made mechanical |

## What is genuinely new here

The inbound rail — webhook, parser, state machine, the refusal-with-a-way-out
fallback · the command vocabulary in two languages · the buyer, partner, shop
and organiser conversational flows · the voice-note door (gated on a provider
decision) · the SMS fallback rule · the mechanical ends-with-an-action test ·
STOP and language as stored preferences. Beneath it: outbound to both
channels, the 24-hour rule, the group buy engine with its router fan-out,
Buni collection, uploads, the queue, and the fail-closed constitution are
standing. The prompt's own thesis is the tree's thesis: WhatsApp is not a
feature — it is the second half of a channel whose first half was built
waiting for it.

---

## The prompt, as received (verbatim)

What follows is the prompt exactly as it was received — unedited, including
the mis-cited file and the middleman routing. It is kept so the corrections
can be checked against the ask, and so no future builder has to trust a
paraphrase.

````markdown
# Trace — The WhatsApp Business Integration (Builder Prompt)

You are building the WhatsApp Business Integration: the
channel through which most Trace users will actually
interact with the platform. Not the app. Not the website.
WhatsApp.

Every feature you've built assumes a user opens an app. In
Kenya, a boda rider, a fish trader, and a shopper at Githurai
do not open apps. They open WhatsApp. It's already on their
phone. It's already their primary communication channel. It's
already how they do business.

The app is a companion. WhatsApp is the product.

## The problem it solves

Joseph is a boda rider in Kilimani. He has an Android phone
with 4GB of data per month. He uses WhatsApp, M-Pesa, and
YouTube. He does not install new apps. He does not fill
forms. He does not read English well.

If Trace requires an app download, Joseph will not register.
If Trace requires a form, Joseph will abandon it. If Trace
requires navigating four screens to accept a job, Joseph
will miss the notification.

But if Trace sends Joseph a WhatsApp message — "New job,
Yaya Centre to Lavington, KES 340, reply ACCEPT" — Joseph
will reply ACCEPT. He already does this for Uber-like
services. He already does this for his SACCO. He already
does this for his family group.

Trace's job is to meet Joseph on WhatsApp. Not to make him
use a new product.

## What you are building (and what you are NOT)

You ARE building:
- A Trace WhatsApp Business account (verified, with a green
  badge once eligible)
- A command vocabulary that works in Swahili and English
- A state machine per user role (buyer, seller, rider,
  field agent, organiser)
- Voice note handling (a user can send a voice note instead
  of typing)
- Photo handling (a user can send a photo instead of a
  listing)
- The full order flow via WhatsApp
- The full partner onboarding via WhatsApp
- The full shop onboarding via WhatsApp
- Group buy coordination via WhatsApp
- Shopping run coordination via WhatsApp
- The five templates per surface, in plain language
- Honest fallbacks when WhatsApp delivery fails

You are NOT building:
- A chatbot that pretends to be human
- Any "AI assistant" branding or framing
- Any flow that requires the user to learn 20 commands
- Any flow that isn't available in the app as well
- Any incentive or gamification in WhatsApp
- Any message that isn't a real transaction or
  notification
- Any spam, marketing, or engagement message

WhatsApp is a channel for real work. Not a marketing
surface. Not a feed. Not a place to send "you have 5
unread messages!"

## Non-negotiables

- **Every message has a purpose.** Orders, confirmations,
  dispatch, refunds, disputes. Nothing else.
- **Every message ends with an action.** ACCEPT, SKIP, YES,
  NO, PICKED, DELIVERED. If there's no action, there's no
  reason to send the message.
- **No message is sent without the user's action.** No
  "you haven't opened Trace in 3 days!" No "5 new shops in
  your area!" No engagement nags.
- **The user can stop at any time.** Reply STOP, and all
  non-essential messages stop. Essential messages (an
  active order confirmation, a payment receipt) continue
  because they're part of a transaction the user started.
- **Swahili is the default for first contact.** English is
  chosen by the user on first reply if they prefer. The
  user's language preference is stored on their row.
- **Voice notes work.** A user can send a voice note
  instead of typing. The system transcribes (in Swahili or
  English) and acts on it. If the transcription is
  uncertain, the system asks a clarifying question in the
  same language.
- **Photos work.** A user can send a photo of a shop, a
  product, an ID, or a receipt. The system acts on it
  based on context.
- **No WhatsApp Business API fees are passed to the user.**
  The platform pays for WhatsApp messages. A user never
  sees a "message fee."
- **No message is sent outside the 24-hour window** for
  non-essential (utility) messages. Meta's rules require
  the 24-hour window for session messages. Template
  messages (which require approval) are used for
  notifications outside the window.
- **The fallback is SMS.** If WhatsApp delivery fails
  (offline, no data, template rejected), the message
  falls back to SMS. Same content, same action, different
  channel.

## The WhatsApp Business account setup

Prerequisites:
- Meta Business Manager account for Trace
- WhatsApp Business Account (WABA) created and verified
- Business verification (legal entity, ID, address)
- A dedicated phone number for Trace (not a personal
  number)
- Display name approved by Meta ("Trace")
- Message templates submitted and approved

Approved template categories used by Trace:
- **UTILITY** — order confirmations, dispatch notifications,
  receipts. Automatically approved if they contain
  transaction details.
- **AUTHENTICATION** — OTP, phone verification. Used only
  for login.
- **MARKETING** — deliberately NOT used by Trace. We do not
  send marketing messages.

The WhatsApp Business API provider: Meta Cloud API direct,
or a Business Solution Provider (BSP). For scale, a BSP is
recommended (Twilio, MessageBird, 360dialog, or Africa's
Talking). For the initial launch, Meta Cloud API direct is
sufficient and cheaper.

Environment variables required:
```
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_BUSINESS_ACCOUNT_ID=
WHATSAPP_ACCESS_TOKEN=
WHATSAPP_APP_SECRET=
WHATSAPP_VERIFY_TOKEN=
WHATSAPP_WEBHOOK_URL=https://trace.africa/api/webhooks/whatsapp
```

The webhook is verified by `X-Hub-Signature-256` HMAC (this
is already implemented in the codebase — see
`server/src/connectors/whatsapp.js`).

## The command vocabulary

Commands are short, memorable, and work in both Swahili and
English. The user learns 3–5 commands total, not 20.

| Command | Purpose | Who uses it |
|---|---|---|
| `HI` / `HABARI` | Start, help, menu | Everyone |
| `BUY` / `NUNUA` | Start an order | Buyers |
| `TRACK` / `FUATILIA` | Order status | Buyers |
| `JOB` / `KAZI` | Partner job flow | Partners |
| `ONLINE` / `OFFLINE` | Partner availability | Partners |
| `ACCEPT` / `KUBALI` | Accept a job or order | Partners |
| `SKIP` / `RUKA` | Decline a job | Partners |
| `PICKED` / `NIMECHUKUA` | Mark a pickup done | Partners |
| `DELIVERED` / `NIMEFIKISHA` | Mark a delivery done | Partners |
| `PAY` / `LIPA` | Initiate payment | Everyone |
| `HELP` / `SAIDIA` | Escalate to a human | Everyone |
| `STOP` / `ACHA` | Opt out of notifications | Everyone |
| `LANG` / `LUGHA` | Change language | Everyone |
| `ME` / `MIMI` | Show profile summary | Everyone |
| `SAVE` / `HIFADHI` | Save a shop | Buyers |
| `SHARE` / `SHARE` | Share a shop link | Buyers |

**What the user never sees:** SAVE_ORDER, INITIATE_PAYMENT,
CONFIRM_DELIVERY, MARK_AS_FULFILLED. Jargon is a UX failure.

**Every command works as a reply to a message.** If the user
replies to a job notification with `ACCEPT`, the system
knows which job. If the user sends `ACCEPT` without context,
the system asks "Accept what? You have 1 open job. Reply
YES to accept job #4821."

## The state machine (per user role)

Each user has a state. The state determines what the next
message does.

```
USER_STATE
├── userId
├── role                ('buyer' | 'seller' | 'partner'
│                        | 'field_agent' | 'organiser' | null)
├── language            ('sw' | 'en')
├── currentFlow         (null | 'ordering' | 'registering'
│                        | 'job_dispatch' | 'dispute_open')
├── currentFlowContext  (JSON — depends on the flow)
├── lastMessageAt
└── sessionWindowUntil  (ISO — 24h from last inbound message)
```

A user can be in only one `currentFlow` at a time. If they
start a new flow, the old one is abandoned (with a note).

**Ambiguity handling:** if the user sends a message that
doesn't match any command and they're not in a flow, the
system replies:

```
Sijaelewa. Reply HELP for assistance.
(I didn't understand. Reply HELP for assistance.)
```

Not a menu. Not a list of options. A single fallback.

## Voice note handling

A user sends a voice note. The system:

1. Receives the audio file via webhook.
2. Transcribes via a speech-to-text service (Whisper API,
   Azure Speech, or Google Speech-to-Text).
3. Detects language (Swahili or English).
4. Treats the transcript as if the user had typed it.
5. Replies in the same language as the voice note.

Transcription accuracy thresholds:
- **≥ 0.85 confidence:** proceed with the flow.
- **0.60–0.85 confidence:** confirm before proceeding.
  "You said: 'Nataka kununua samaki kilo tatu.' Reply YES
  to continue."
- **< 0.60 confidence:** ask the user to type or try again.
  "Samahani, sikusikia vizuri. Andika kwa maandishi au
  tuma tena."

**The transcript is stored as a text message row.** So the
audit trail is preserved. A dispute over what was said can
look at the transcript.

## Photo handling

A user sends a photo. Context determines the action:

**If they're a buyer and they replied to a shop's message:**
The photo is treated as a photo of an item they want. The
system does a best-effort match against the shop's catalog
and asks "Is this the item you want? Reply YES to add."

**If they're a seller and they're onboarding:**
The photo is treated as the shop's storefront. Stored as
part of the verification.

**If they're a seller and they replied with a new product
name:** The photo becomes the offer's image.

**If they're a partner and they're being verified:**
The photo is treated as their ID or their selfie, depending
on the current prompt.

**If the context is unclear:** the system asks. "Thanks for
the photo. What would you like me to do with it?" with a
short list: 1 = add to my shop, 2 = my ID, 3 = a receipt,
4 = something else.

## The buyer flow (via WhatsApp)

```
BUYER: HI

TRACE: Karibu Trace. Unatafuta nini leo?
       (Welcome to Trace. What are you looking for
        today?)

BUYER: samaki

TRACE: Shops near you that sell samaki:

       1. Testshop · 0.3 km · ★ 4.6 (12)
       2. Kikao Fish · 0.8 km · ★ 4.4 (8)
       3. Green Harvest · 1.2 km · ★ 4.8 (24)

       Reply with a number to see the shop.

BUYER: 1

TRACE: Testshop ✓
       Food · Kilimani · Open now

       ON THE COUNTER
       · Meals · KES 150
       · Tilapia (whole) · KES 340/kg

       Reply BUY to start an order.
       Reply CHAT to message the shop.

BUYER: BUY

TRACE: What would you like to order?
       (You can send a voice note.)

BUYER: [voice note: "Nataka kilo tatu ya tilapia"]

TRACE: You said: "I want 3kg of tilapia."
       Reply YES to confirm.

BUYER: YES

TRACE: Order summary:

       3kg tilapia · KES 340/kg
       Subtotal: KES 1,020

       Delivery: KES 100
       Total: KES 1,120

       Reply PAY to pay via M-Pesa.
       Reply CANCEL to cancel.

BUYER: PAY

TRACE: M-Pesa request sent to 0712 345 678.
       Enter your PIN to complete.

       (Waiting for confirmation...)

       [30 seconds later]

TRACE: Payment confirmed ✓

       Order #4821 · Testshop
       Total: KES 1,120

       Pickup or delivery?
       Reply PICKUP or DELIVER.
```

Every step is one message. One action. No menus to navigate.

## The partner flow (via WhatsApp)

```
PARTNER: JOB

TRACE: Karibu. You're not registered as a partner yet.
       Reply REGISTER to sign up.

PARTNER: REGISTER

TRACE: Karibu. What's your name?

PARTNER: Joseph Ogallo

TRACE: Karibu, Joseph. Send a photo of your National ID
       (front).

PARTNER: [photo]

TRACE: Got it. Now send a selfie holding your ID next
       to your face.

PARTNER: [selfie]

TRACE: What's your boda registration number?

PARTNER: KMEE 123A

TRACE: Send a photo of the number plate.

PARTNER: [photo]

TRACE: Asante, Joseph. Your registration is being
       verified. You'll hear back within 24 hours.

       While you wait, save this number as "Trace Jobs."

       [4 hours later]

TRACE: Hongera, Joseph. You're verified.

       Reply ONLINE to start receiving jobs.
       Reply OFFLINE to stop.

PARTNER: ONLINE

TRACE: You're online. Jobs near you will arrive shortly.

       [2 minutes later]

TRACE: New job available.

       Pickup: Yaya Centre, Kilimani
       Dropoff: Lavington Mall
       Distance: 6.2 km
       Fee: KES 340
       Expected: 25 min

       Reply ACCEPT to take it.
       Reply SKIP to pass.
       Offer expires in 2 minutes.

PARTNER: ACCEPT

TRACE: Job confirmed.

       PICKUP
       Yaya Centre, Ground floor
       Contact: Mary, 0712 345 678

       DROPOFF
       Lavington Mall, Main entrance

       Reply PICKED when you have the package.
       Reply DELIVERED when complete.

PARTNER: PICKED

TRACE: Pickup confirmed. 25 min to dropoff.

PARTNER: DELIVERED

TRACE: Job complete ✓

       Your earnings: KES 340
       Total this week: KES 1,240
       Next payout: Friday 11 Oct

       Next job coming soon.
```

**No app. No forms. No PDFs. Just WhatsApp.**

## The shop onboarding flow (via WhatsApp)

```
SELLER: HI

TRACE: Karibu Trace. Unatafuta nini leo?

SELLER: nataka kuuza

TRACE: Karibu. Unauza nini?
       (Welcome. What do you sell?)

SELLER: samaki

TRACE: Sawa. What's your shop's name?

SELLER: Kikao Fish

TRACE: Where is your shop?
       (Send a location pin or type the address.)

SELLER: [location pin]

TRACE: Got it: Kilimani, near Yaya Centre.

       Send a photo of your shop's front.

SELLER: [photo]

TRACE: Asante. When are you open?
       Reply with a day and time, e.g., "Mon-Sat 8am-6pm".

SELLER: Mon-Sat 8am-6pm

TRACE: What's your first offer?
       Send a photo and a price, e.g., "Tilapia 340/kg".

SELLER: [photo] Tilapia 340/kg

TRACE: Sawa. Your shop is live.

       Public page: trace.africa/s/kikao-fish

       Reply SHARE to send the link to your customers.
       Reply OFFERS to add more.
       Reply HELP for assistance.
```

**The shop is live in under 5 minutes, via WhatsApp, with
photos.**

## The group buy coordination (via WhatsApp)

```
ORGANISER: START GROUP BUY

TRACE: Karibu. What's the product?

ORGANISER: Pishori Rice, 50kg sack

TRACE: Who's the wholesaler? Reply with their name or
       Trace handle.

ORGANISER: Naivas Wholesale

TRACE: Sawa. What's the wholesale price per kg?

ORGANISER: 120

TRACE: What's the retail price (for comparison)?

ORGANISER: 180

TRACE: Threshold (minimum kg to execute)?

ORGANISER: 100

TRACE: Closes when?

ORGANISER: 25 Sept 6pm

TRACE: Your own commitment?

ORGANISER: 5kg

TRACE: Group buy summary:

       Pishori Rice · Naivas Wholesale
       KES 120/kg (retail: KES 180/kg, save 33%)
       Threshold: 100kg
       Closes: 25 Sept 6pm
       Your commitment: 5kg (KES 600)

       Reply CONFIRM to create.
       Reply CANCEL to cancel.

ORGANISER: CONFIRM

TRACE: ✓ Group buy created.

       Share this message with your group:
       [copy-paste message with the buy link]

       Progress: 5/100kg
       When the threshold is met, everyone is notified.
       If it isn't met, everyone is refunded.

       Reply STATUS anytime to see progress.
```

**The organiser can then paste that message into their
estate WhatsApp group.**

## The shopping run coordination (via WhatsApp)

```
ORGANISER: START RUN

TRACE: Karibu. Where are you going?

ORGANISER: Carrefour, Two Rivers

TRACE: What day and time?

ORGANISER: Sat 10am-2pm

TRACE: Pickup point?

ORGANISER: Membley Gate 1

TRACE: Total transport cost?

ORGANISER: 600

TRACE: How many seats?

ORGANISER: 12

TRACE: Run created.

       Saturday Carrefour Run
       Membley Gate 1 · 10am-2pm
       12 seats · KES 600 split
       KES 50 per person

       Share this link with your neighbours:
       trace.africa/r/membley-sat-1409

       Reply STATUS to see who has joined.
```

## The 5 templates per surface

WhatsApp template messages (the pre-approved messages
outside the 24h session) are used only for:

1. **Order confirmation** (UTILITY)
2. **Dispatch notification** (UTILITY)
3. **Delivery confirmation** (UTILITY)
4. **Payment receipt** (UTILITY)
5. **Job offer** (UTILITY)

**No marketing templates exist.** No "re-engage," no "we
miss you," no "new feature!"

## The rate limits

- **Per user:** 20 outbound messages per hour. Beyond that,
  messages queue.
- **Per phone number (WABA):** Meta's default tier limits
  apply. Upgrade based on usage.
- **Order-related messages:** not rate limited (they're
  transactional).
- **Auth messages:** 5 per phone per hour (Meta's OTP limit).

## The fallback paths

**If WhatsApp delivery fails** (offline, no data):
- Retry with exponential backoff for 1 hour.
- If still failing, send via SMS.
- Same content, same action.
- SMS uses a short code that replies to Trace's SMS
  shortcode.

**If WhatsApp Business API is down:**
- New messages queue.
- Existing messages already delivered are still actionable
  (the user can reply).
- The queue is drained when the API is back.
- The user sees no error. The messages arrive late, not
  never.

**If the user's phone is offline:**
- WhatsApp queues the message on the user's side.
- When online, the message is delivered.

## What to remove from the current surface

- The hardcoded `wairoData.ts` mock — replaced with real
  partners.
- The "Chat on WhatsApp" that opens a link to the shop's
  personal WhatsApp number — replaced with the Trace
  Business number routing.
- Any WhatsApp integration that isn't through the official
  Business API.

## Test requirements

- A `HI` message returns the welcome flow.
- A `BUY` message returns the shop search flow.
- A voice note is transcribed and processed. Low confidence
  triggers a clarification.
- A photo is handled based on context. Unclear context
  triggers a prompt.
- A partner can register via WhatsApp. The registration
  creates a `partner` row.
- A partner can go ONLINE/OFFLINE via WhatsApp.
- A job offer is sent to the nearest partner. First accept
  wins.
- An order can be placed, paid, and confirmed via WhatsApp
  only.
- A group buy can be created and coordinated via WhatsApp
  only.
- A shopping run can be created via WhatsApp only.
- Non-essential messages are not sent outside the 24h
  window.
- Templates are only UTILITY category. No marketing.
- The fallback to SMS works when WhatsApp fails.
- STOP opts the user out of non-essential messages.
- The user's language preference persists across sessions.
- Every message ends with an action. A test loops through
  every outbound template and asserts it contains one of
  ACCEPT, SKIP, YES, NO, REPLY, PAY, PICKED, DELIVERED,
  or a URL.

## The one rule

WhatsApp is where the work happens. Not a marketing channel.
Not a place to nag. Not a place to say "you have 5 unread
messages."

Every message is a transaction. Every reply is an action.
Every action is a row.

If it wouldn't make sense to send by SMS in 2008, don't
send it by WhatsApp in 2026.

## Order of operations

1. WhatsApp Business account + verification.
2. The webhook handler (already exists, needs verification
   tests).
3. The command parser (Swahili + English).
4. The state machine (per user role).
5. The buyer flow (HI → BUY → PAY).
6. The partner flow (JOB → REGISTER → ONLINE → ACCEPT).
7. The shop onboarding flow (HI → sell → live).
8. Voice note handling.
9. Photo handling.
10. Group buy and shopping run coordination.
11. The 5 UTILITY templates (submitted and approved).
12. The SMS fallback.
13. Rate limiting and 24h window enforcement.

Each step ships separately. Each step has its own test.

## What this unblocks

- Boda riders can register without installing an app.
- Fish traders can list their offers via voice note.
- Shoppers can buy via a simple chat.
- Group buys can be created and coordinated in WhatsApp.
- Shopping runs can be announced and managed in WhatsApp.
- The semi-literate user has a real entry point.
- The app is no longer the only interface — it's the
  nicer interface for those who have it.
- Every feature you've built becomes reachable by the
  people who need it most.

## Reference

You built a shop. You built a rail. You built a marketplace.
But none of it matters if the fish trader in Githurai can't
reach it. WhatsApp is the bridge. Without it, Trace is a
nice app for Nairobi professionals. With it, Trace is the
platform for the trader, the rider, the shopper, and the
organiser.

WhatsApp-first is not a feature. It is the product. The app
is the companion.

Ship this. Then everything else reaches the people it was
built for.
````

---

## Operator's note (received with the prompt, outside it)

> **Why WhatsApp Integration, Next**
>
> Look at everything you've built:
>
> | Feature | How does a semi-literate user reach it? |
> |---|---|
> | Nearby | Opens an app? |
> | Shopping Runs | Opens an app? |
> | Group Buys | Opens an app? |
> | Events | Opens an app? |
> | Partner Onboarding | Opens an app? |
> | Settlement Rail | Behind the app |
> | Shop Brief | Behind the app |
> | Team & Roles | Behind the app |
>
> **Every single feature requires an app download.** For a
> boda rider, a fish trader, or a shopper at Githurai, that's
> an impossible barrier.
>
> The user said it directly:
>
> > *"I want to go deep reserve to that semi illiterate guy
> > who has an ambition... offer whatever services the
> > educated lot thinks are basic."*
>
> The "basic thing the educated lot takes for granted" is the
> **app download and login**. WhatsApp removes that. WhatsApp
> is the login. WhatsApp is the interface. WhatsApp is the
> product for that user.
>
> **Without WhatsApp-first, everything else you built is for
> people who don't need it.** With it, the whole stack becomes
> reachable by the market you're targeting.
>
> Ship this. Then everything else has an audience.
>
> ---
>
> **Where We Are Now** — fourteen builder prompts delivered:
>
> | # | Prompt | Depends on |
> |---|---|---|
> | 1 | Shop Brief | Team & Roles |
> | 2 | Settlement Rail | — |
> | 3 | Nearby | — |
> | 4 | Shopping Run Stream | Nearby + Rail |
> | 5 | Invite-a-Shop | Nearby + Rail |
> | 6 | Events & Ticketing | Rail |
> | 7 | Partner Onboarding | Rail |
> | 8 | Team & Roles | — |
> | 9 | Verification Flow | — |
> | 10 | Dispute Resolution | Rail + Verification |
> | 11 | Reviews | Rail + Disputes |
> | 12 | Group Buy Streams | Rail + Verification |
> | 13 | Consumer Profile | Orders + Rails |
> | 14 | WhatsApp Integration | Everything |
>
> **Recommended build order:**
>
> 1. **Settlement Rail** (ManualRail first) — nothing financial works without it
> 2. **Team & Roles** — attribution
> 3. **Verification Flow** — trust badge
> 4. **Dispute Resolution** — consequence layer
> 5. **Reviews** — trust gradient
> 6. **WhatsApp Integration** — reach the market
> 7. **Nearby** — consumer entry (app)
> 8. **Partner Onboarding** — supply side
> 9. **Consumer Profile** — buyer's home
> 10. **Shop Brief** — daily truth
> 11. **Invite-a-Shop** — growth
> 12. **Events & Ticketing** — consumer inflow
> 13. **Shopping Run Stream** — community
> 14. **Group Buy Streams** — demand pooling
>
> **Remaining prompts:**
>
> 1. **The Space Editor v2** — public page editing with history
> 2. **The Trace Card** — the shop's physical card for customers
> 3. **The Field Agent App** — the agent's surface in depth
> 4. **The Protection Fund** — the pool that covers failed wholesalers and disputes
> 5. **Trace for Cooperatives** — the SACCO-specific surface
>
> Say **"next"** and I'll pick the highest-leverage remaining one.

The quote is the series' founding sentence, and it deserves a straight
answer rather than a table correction alone (the table: fourteen
claimed, thirteen arrived; Group Buy Streams phantom a third time). The
straight answer is that the tree has been building toward this user the
whole time, in its own dialect: a connector that fails closed with the
missing credentials named, because a trader at Githurai must never be
told a message was delivered when it wasn't; a receipt hash verifiable
against stored rows, because a table-banking member must be able to
check; a fee printed as "100 points = KES X — always," because a
conversion that needs trust in the platform should not also need
suspicion of it. The half that was missing is the half this prompt
names — the door that hears — and the tree recorded its absence itself,
in Twilio's notes, in writing, the way it records everything: outbound
only, inbound a separate and unbuilt rail. Build the rail. Keep the
fail-closed dialect. And leave the shop's own number with the shop —
the bridge belongs to Trace; the conversation never did.
