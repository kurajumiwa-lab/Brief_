# Onboarding and the service ladder

What was built, why it is shaped this way, and exactly where the honest limits
are.

---

## The problem

Brief can do a great deal — capture, hosting, selling, distribution, money,
automation, Arena. All of it was reachable on the first screen, and the very
first thing the app did for a new person was silently mint an anonymous
device-only account they could never move to another phone. A capable product
presented that way reads as an unusable one.

Two changes follow from that:

1. **Identity comes first, and it is a choice.** Google leads, a handle is the
   fallback, a device-only account is an explicit option, and Telegram is not
   required to be a member.
2. **Everything else is a ladder.** Secondary services follow a first step.
   Your intent is the goal; you pass through the rungs to reach it.

---

## The ladder

| # | Rung | What proves it | What it opens |
|---|------|----------------|---------------|
| 1 | Be someone | a `users` row, or a live session | Around you, Your layer |
| 2 | Say what you came for | the segmentation answer | (orders the feed) |
| 3 | **Keep your first real thing** | an `object_saved` event or a `confirmations` row | Capture, Arena |
| 4 | Add something of your own | a `capture_saved` event or a captured `sourceMemberships` row | Host an event, Sell something, Story studio |
| 5 | Put it in front of people | a `campaigns`, `listings` or `campaignBanners` row | Share kit and banners, Money, Automation engine, Group buying, The Vault |

Rung 3 is the **aha moment** — the point at which Brief has demonstrably done
its job. The whole first-run flow exists to reach it in under a minute:
identity, one tap, one place, feed.

**A rung is only *reached* when every rung below it is.** Someone who somehow
creates a listing before saving anything still has the save step in front of
them; the step is the path, not a badge. `server/test/run.js` pins this down
directly.

### Derived, never stored

There is no `onboardingStep` column. `ladderFor(userId)` scans real rows
(confirmations, captures, campaigns, listings, banners) plus an append-only
`activationEvents` stream for the handful of steps that leave no row of their
own — choosing a goal, granting a place, saving locally. A stored step counter
would be a second source of truth waiting to disagree with the first, which is
the same rule the ledger already follows.

### The ladder is an offer, not an authorisation

`isSurfaceUnlocked()` shapes what the shelf and the drawer *offer*. It does not
guard a single route: authority still lives in `identity.js` and the domain
modules, which already refuse anything a caller may not do. And when the ladder
has not loaded — offline, dead API, a render test — **nothing is locked**. A
gate that failed closed would turn a backend outage into a product that refuses
to open.

### Where the ladder is silent

**Saved (Your Layer) and Actions (Workflows) show no ladder chrome at all** — no
locks, no step counters, no next-step card. Those two index screens are
destinations people navigate to on purpose, already knowing what they want.
They list what exists; they are not a shop window. The exemption is enforced by
*who asks*: those screens never call the ladder helpers, so their rows open
normally. It is deliberately **not** baked into `isSurfaceUnlocked()`, because
that would silently unlock a service just for living under those tabs.

---

## The first run

Three screens, all but the first skippable, no product tour anywhere.

1. **Be someone.** Google Identity Services button (with One Tap) when
   `GOOGLE_CLIENT_ID` is set; otherwise the screen says plainly that Google is
   not configured here and offers a handle. "Just look around on this device"
   creates the same device-only account that used to be minted behind
   everyone's back — now as a stated choice. A line on the screen says Telegram
   is a door, not a gate.
2. **What brought you here?** One question, four options, one tap. It orders
   the feed; it does not fork the product.
3. **Where should Brief look?** Location grant or a city tap. Skipping gives
   the global ranked feed rather than blocking on a permission dialog.

It renders as an **overlay on top of the running app**, so the feed is already
loading behind the flow and the screen after it is warm. It never re-opens for
someone who answered or skipped.

After that, progressive disclosure is a single card on Home: the rung you are
on, and the one action that opens the next one. It disappears when the ladder
is complete rather than inventing a further step to keep a streak alive.

### One personalisation, stated out loud

The segmentation answer promotes **the service that answer is about** by exactly
one rung: someone who said they came to play should not find Arena behind a
step about saving things. It never promotes below rung 2, never promotes
anything else, and the promoted service is flagged `promoted: true` so the UI
can say why it opened early. The ladder stays a ladder rather than quietly
collapsing for whoever picks the right option.

---

## Sign-in

### Google

`POST /api/auth/google` verifies the ID token rather than trusting it: RS256
signature against Google's published JWKS, then issuer, audience, expiry and
`email_verified`. Any failure is a 401 with the reason named. With no
`GOOGLE_CLIENT_ID` the route returns **503 `provider_not_configured`** and says
what to set — it never mints a session from a claim it cannot check.

To turn it on:

```
GOOGLE_CLIENT_ID=<your-client-id>.apps.googleusercontent.com   # server
VITE_GOOGLE_CLIENT_ID=<the same id>                            # client build
```

The server test signs real RS256 tokens with a locally generated key and
injects the JWK, so the verification path is exercised end to end without the
network.

### Telegram

`/api/telegram/init` is unchanged and still works inside the Mini App. It is
now one door among several: `providerStatus().telegram.required === false`, and
nothing outside the Mini App ever asks for it.

### Arriving from a TikTok link

**The honest limit first:** a TikTok (or Instagram, or Facebook) in-app browser
**cannot** hand a website the device's Google account. No browser exposes that.
Code claiming to read it would be inventing an identity, so none was written.

What is real, and what is implemented, in priority order:

1. **A Brief-signed link token.** `POST /api/auth/email-link/mint` produces an
   HMAC-signed token for an address you are inviting; append it as `?bt=…`. On
   arrival the client posts it to `POST /api/auth/email-link`, the server
   verifies the signature and expiry, and the person is signed in with one tap
   and no typing. A bare `?email=` in a URL is **refused** — anyone can type one
   in. The parameter is stripped from the URL after use so a forwarded link
   cannot replay it.
2. **An existing session** in that webview, resumed silently.
3. **Google Identity Services**, if it works in that webview — the flow asks
   for the redirect mode inside restricted webviews, where popups are usually
   blocked.

Anything else falls through to the ordinary sign-in screen. The visit is still
attributed: `arrivalSource()` reads `utm_source`/`ref` first and the user agent
second, and the channel is recorded once as the profile's `source` (first touch
wins).

---

## Measuring it

`GET /api/onboarding/metrics` returns activation rate, median seconds to
activation, per-rung counts and drop-off between consecutive rungs — all
scanned live, with no personal identifiers and no stored counters. With no
cohort yet it says so instead of reporting a zero that looks like a result.

---

## Where the code lives

```
server/src/domain/onboarding.js   rungs, services, goals, events, ladder, metrics
server/src/domain/federated.js    Google ID token verification, signed email links
server/src/routes/onboarding.js   /api/onboarding, /api/ladder, /api/onboarding/*
server/src/routes/auth.js         /api/auth/providers, /google, /email-link
src/components/ladder.ts          pure client ladder logic + the quiet-screen rule
src/components/arrival.ts         in-app browser detection, link tokens (pure)
src/components/Onboarding.tsx     the three-screen first run
src/components/NextStep.tsx       the one-card ladder on Home
src/components/MainShelf.tsx      progressive disclosure on the shelf
```

Tests: `preview/onboard.jsx` (66 assertions) and the two new sections in
`server/test/run.js` (43 assertions).
