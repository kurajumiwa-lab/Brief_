# Brief — production deployment & durability

## What runs where

- **Build:** `npm run build:client` (Vite → `preview/dist`), registered in
  `railway.json` as `buildCommand`.
- **Start:** `npm start` → `cd server && npm start` → `node src/index.js`.
- **Port:** `PORT` (Railway sets 8080). Express serves the API and, in
  production, the compiled frontend + SPA fallback (see `DEPLOYMENT-FIX-REPORT.md`).

## Data durability (the one thing to get right)

Brief's store is a synchronous JSON document store (`BRIEF_DATA_DIR/brief.json`,
default `server/data`). It writes atomically and takes snapshots, but **Railway's
container filesystem is ephemeral**: everything under the default path is wiped
on every redeploy. That is why the discovery surface resets to empty after a
fresh deploy.

### Fix: attach a persistent volume

1. In Railway → your service → **Volumes**, add a volume, e.g. named `brief-data`,
   mount path `/data`.
2. Set the environment variable **`BRIEF_DATA_DIR=/data`**.
3. Redeploy. The store (and its `backups/` snapshots) now live on the volume and
   survive redeploys.

### Defense in depth (already in code)

- **Snapshots on a cadence** — `BRIEF_BACKUP_INTERVAL_MS` (default 15 min)
  copies the data file into `backups/`; the newest 14 are kept.
- **Boot restore** — if the data file is missing/empty but a snapshot exists
  (e.g. a volume re-attached after a crash), the server restores the newest one.
- **Graceful-shutdown backup** — a final snapshot is taken on SIGTERM/SIGINT.
- **Corrupt-file recovery** — an unreadable data file is moved aside, not fatal.

> Note: snapshots alone do NOT survive an ephemeral filesystem. The volume is
> the durability guarantee; snapshots are the crash-recovery guarantee.

## Environment variables

| Var | Purpose | Required |
|---|---|---|
| `PORT` | Listen port (Railway sets it) | yes |
| `BRIEF_DATA_DIR` | Data dir (point at the volume) | for durability |
| `BRIEF_PUBLIC_ORIGIN` | Canonical origin for share links + Tuma callback | for distribution/payments |
| `BRIEF_BACKUP_INTERVAL_MS` | Snapshot cadence (default 900000) | no |
| `TUMA_EMAIL` / `TUMA_API_KEY` / `TUMA_WEBHOOK_SECRET` | Payment collection (server-side only) | for live payments |
| `HANDOFF_SECRET` | Signs vault handoff/entry tokens | for Vault |
| `TELEGRAM_BOT_TOKEN` / `TELEGRAM_WEBHOOK_SECRET` / `WHATSAPP_APP_SECRET` / `WHATSAPP_VERIFY_TOKEN` | Ingestion connectors | per connector |

## Demo content

`npm run seed` populates the discovery surface with realistic Nairobi-local demo
content through the real extraction pipeline (marked `seedBatch`, removable with
`npm run seed:clear`). It creates no money records. Seed the deployed instance
via Railway's shell (`npm run seed`) to see the product behave before real
ingestion is connected.
