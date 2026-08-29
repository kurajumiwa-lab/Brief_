# Live verification (§20)

These are **not** unit tests. They run against a **running server** and the
**production build's** proxy (`:4173/ingest` -> `:8787`), so they exercise the
same path a real browser takes, including the Vite preview proxy.

    cd preview && npx vite build && npx vite preview      # :4173
    NODE_ENV=production PORT=8787 \\
      BRIEF_OPERATORS=liveop \\
      BRIEF_FINANCE=liveop \\
      node server/src/index.js

Phases 2 and 4 exercise the capability-guarded operator surface, so the
API must be started with `BRIEF_OPERATORS=liveop BRIEF_FINANCE=liveop`.
The suites register (or log in) that handle themselves: `liveop` reads
diagnostics/reconciliation (ops.read + finance), and phase 4 also proves
a plain user gets 403 `forbidden_capability` first.

    node live/2-commerce-over-http.mjs
    node live/3-public-campaign.mjs
    node live/4-full-chain.mjs
    node live/5-release-smoke.mjs
    RELEASE_SMOKE_WRITES=1 node live/5-release-smoke.mjs

Run the API in **production** mode. Outside production the single-user
development fallback silently answers every unauthenticated request as
`usr_me`, and a script that posts as nobody then passes for the wrong reason —
which is exactly how phase 3 below came to be reported as green while four of
its checks were failing.

## Why phase 1 is no longer needed

`live/1-seed-rival-seller.mjs` exists because a second actor used to be
impossible to create over HTTP. Real authentication removed that limitation:
`live/2-commerce-over-http.mjs` now registers its rival seller over the wire
like any other user, and `live/3-public-campaign.mjs` registers its own
organiser. Phase 1 is kept only for backwards compatibility. Nothing in the
suite needs the server to be stopped.

## What they proved (2026-08-28, production mode, 0 failing)

* **phase 2 — 43/0**: server-derived totals (a client-sent price of 1 was
  ignored, total stayed 5000), concurrent idempotency, six invalid quantities
  refused, buyer-cannot-fulfil/settle/advance (403), unknown order 404,
  idempotent cancel emitting exactly one signal, balanced reconciliation,
  zero earnings with payout correctly unavailable, arena stake refused 403.
* **phase 3 — 27/0**: the organiser is a real registered identity; draft
  campaigns unreachable publicly; published link resolves with **no token at
  all**; no ownerId/roster/sourceId/rawItem leakage; stranger registration;
  dedupe on re-capture and re-registration; 404s that leak nothing.
* **phase 4 — 91/0**: identity -> object -> campaign -> participation ->
  listing/order -> fulfilment -> transaction -> ledger -> settlement ->
  payout, plus Arena, Fantasy and Auction, each with two real actors. Now also
  asserts that a manual save the extractor refuses is kept honestly rather
  than being published as something it is not.
* **phase 5 — 16/0 read-only, 26/0 with writes**: release handshake, home-feed
  timestamp, news wire shape, Arena entry point, and a full registration ->
  challenge -> campaign -> WhatsApp banner -> archive cycle.
