# Storefront and Groups pass — 2026-09-25

## Implemented

- Filled category illustrations and primary navigation marks. Errands and delivery runs have distinct illustrations. Scoped decorative-border removal, contrast panels and visible keyboard focus. IBM Plex/blue identity retained; no fabricated photography or activity counts.
- Removed the external courier filler from Errands. Expanded All with explicit commerce, wholesale, direct sourcing, group-buy, event, group and errand destinations.
- Mine has a shop-focused empty state and delegated-team access. Shop headers use only the shop's brand cover, never the first product's image. Catalog search/type filters tolerate legacy offers without a type.
- Live Home, Mine and Spaces creation entry points use the short shop flow: brand preview, cover upload and server-owned category choices; create a private shell without a first offer. Within the mounted flow, failed publishing retries reuse the saved shop/offer rather than creating duplicates.
- Groups is the user-facing name; legacy circle routes/IDs remain compatible. Creation requires approved owner identity verification and an active owned commercial shop, not business verification.
- Public directory is explicit opt-in and supports location, industry and purpose. Coordinators can edit existing entries with an audited reason. Listing alone does **not** grant admission: discoverable groups require invitations; only open groups permit self-join. The directory never includes membership identities, messages or financial records. Public join previews no longer reveal financial progress.
- Owner/manager/staff roles are shop-scoped. Owner assigns/revokes roles; manager edits brand; staff reads that shop's catalog. Team APIs do not grant money, verification, ownership, generic-role or cross-shop authority.

## Intentionally unfinished

- Purpose categories do not yet connect Groups to full table-banking, pooled-buy or event-coordination workspaces. Existing domain tools remain separate; selecting a category does not create a financial facility.
- Broader delegated operations (catalog writes, order fulfillment, refunds, money) need an explicit permission matrix. This pass grants none of these to managers/staff.
- Legacy unmounted `CreateSpaceModal` remains in source for older consumers; live creation entry points use `CreateFlowModal`.
- Main client bundle still triggers Vite's large-chunk warning. Full accessibility conformance and exhaustive legacy-endpoint privacy review are not established by the browser smoke test.
- Report moderation, phone-first accounts, document-verification readiness and KCB payouts retain the dependencies/order in `ACTIVE-BACKLOG.md`. This pass does not enable automated transfers or collect real identity documents.

## Validation

- `npm run test:client`: **2,298 passed, 0 failed**, no crashed suites.
- `npm test`: passed, including new `groups.mjs` (9 cases) and `shopTeam.mjs` (4 cases).
- `npm run test:typecheck`: passed.
- `npm run build`: passed, with the bundle-size warning above.
- `git diff --check`: passed.
- Chromium smoke at 390×844 and 1440×1000: Mine, creation preview, create-without-product, persisted retail category, resulting shop, Groups and expanded All menu. No browser runtime errors. QA accounts/shops were confined to `/tmp/brief-storefront-preview`, not the production store. No identity verification or real payments were seeded.

No deployment, commit or push was performed. Live development preview uses Vite on port 5173 and its same-origin `/ingest` proxy to the isolated API on port 8787.
