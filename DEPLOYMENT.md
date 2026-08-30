# Brief — production deployment & durability

## Three ways to run it

### 1) Docker (self-host, one command)
```bash
cp .env.example .env        # fill in what your deployment uses
docker compose up -d --build
node scripts/preflight.mjs http://127.0.0.1:8080
```
The container builds the client, runs the server (which serves the compiled
frontend at `/`), keeps ALL state in the `brief-data` volume, and health-checks
itself against `/api/health`. Put TLS in front (Caddy/nginx) and set
`BRIEF_PUBLIC_ORIGIN` to the public URL.

### 2) Railway (already wired: `railway.json`, `Procfile`, `nixpacks.toml`)
Build `npm run build:client`, start `npm start`, port from `PORT`. **Attach a
volume** at `/data` and set `BRIEF_DATA_DIR=/data` — the container filesystem is
ephemeral and wipes the default path on every redeploy.

### 3) Any VPS with Node 20
```bash
git clone <repo> && cd Brief_
npm install && npm run build:client
cp .env.example .env && $EDITOR .env
BRIEF_DATA_DIR=/var/lib/brief PORT=8787 node server/src/index.js
```
Run it under systemd (`Restart=always`, `EnvironmentFile=`), put TLS in front,
and mount `/var/lib/brief` on real disk.

## Data durability (the one thing to get right)

The store is a synchronous JSON document store (`$BRIEF_DATA_DIR/brief.json`).
**The volume is the durability guarantee**; snapshots are the crash-recovery
guarantee:

- Snapshots on a cadence (`BRIEF_BACKUP_INTERVAL_MS`, default 15 min; newest 14 kept).
- Boot restore from the newest snapshot if the data file is missing/empty.
- Graceful-shutdown backup on SIGTERM/SIGINT; corrupt files are moved aside, not fatal.
- Uploads are files on the same disk — keep `BRIEF_UPLOAD_DIR` on the volume too.

## Environment

`.env.example` is the complete, commented list. The essentials:

| Var | Purpose |
|---|---|
| `PORT` / `NODE_ENV` | listen port / production |
| `BRIEF_DATA_DIR` | **point at a persistent volume** |
| `BRIEF_PUBLIC_ORIGIN` | canonical origin for share links + callbacks (unset = surfaces say so honestly) |
| `BRIEF_ADMINS` / `BRIEF_OPERATORS` / `BRIEF_REVIEWERS` / `BRIEF_FINANCE` | comma-separated handles bootstrapped with capabilities at startup — **the members desk needs an admin here** |
| `BRIEF_POCHI_NUMBER` | the Pochi number members pay service fees to (unset = the fee surface says so) |
| `BRIEF_GAMING_LICENCE_ID` | real-money arena stakes stay off without it |
| `GOOGLE_CLIENT_ID` (+ `VITE_GOOGLE_CLIENT_ID` in the client build) | Google sign-in; unset = 503 with a reason |
| `TELEGRAM_*` / `WHATSAPP_*` / `TUMA_*` / `HUDUMA_*` | connector seams — each fails closed until set |

## Go-live checklist

1. Volume mounted, `BRIEF_DATA_DIR` set; restart and confirm the data survives.
2. `BRIEF_ADMINS` names your operator handle; sign in once.
3. `BRIEF_POCHI_NUMBER` set if you will collect service fees; a
   `BRIEF_FINANCE` handle exists to confirm M-Pesa codes.
4. `BRIEF_PUBLIC_ORIGIN` set to the real URL behind TLS.
5. `node scripts/preflight.mjs https://<host> --admin-token <jwt>` —
   **exit 0 and "READY"** is the gate. Warnings are read, not ignored.
6. Seed starter content if the deployment is empty: `npm run seed`
   (marked `seedBatch`, removable with `npm run seed:clear`).
7. Legal: `/api/legal/terms` + `/api/legal/privacy` are public and versioned;
   read them and adjust the copy to your operation before onboarding.

## What "run" means, honestly

No payment provider configured → payouts/collect **refuse with a reason**. No
WhatsApp/Telegram credentials → ingestion connectors stay off. No gaming
licence → arena stakes refuse at the compliance gate. These are the intended
states, reported truthfully by `/api/capabilities`, not gaps to paper over.
