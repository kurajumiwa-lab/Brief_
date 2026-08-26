# Live verification (§20)

These are **not** unit tests. They run against a **running server** and the
**production build's** proxy (`:4173/ingest` -> `:8787`), so they exercise the
same path a real browser takes, including the Vite preview proxy.

    # 1. stop the API, seed a second seller (see note), restart, then:
    node live/2-commerce-over-http.mjs
    node live/3-public-campaign.mjs
    node live/5-release-smoke.mjs
    RELEASE_SMOKE_WRITES=1 node live/5-release-smoke.mjs

## Why phase 1 is separate

`callerId()` returns a constant in this deployment (no auth provider is
connected). A *second* actor therefore cannot be created over HTTP, and the
buyer/seller authorization tests need one. Phase 1 writes that seller through
the domain layer while the server is **stopped** -- the JSON store loads into
memory once at boot, so two processes writing it concurrently lose updates.

Run order:

    ss -ltnp | grep 8787 | grep -oP 'pid=\K[0-9]+' | xargs -r kill -9
    node live/1-seed-rival-seller.mjs
    # restart the API, then run phases 2 and 3

## What they proved (last run)

* phase 2 -- 37/37: server-derived totals (a client-sent price of 1 was
  ignored, total stayed 5000), concurrent idempotency, six invalid quantities
  refused, buyer-cannot-fulfil/settle/advance (403), unknown order 404,
  idempotent cancel emitting exactly one signal, balanced reconciliation,
  zero earnings with payout correctly unavailable, arena stake refused 403.
* phase 3 -- 26/26: draft campaigns unreachable publicly, published link
  resolves without auth, no ownerId/roster/sourceId/rawItem leakage, stranger
  registration, dedupe on re-capture and re-registration, 404s that leak
  nothing.
