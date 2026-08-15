# Brief

An information layer for what is happening around you. Brief structures what
communities already post — on Telegram, on the web, in feeds — into objects you
can find, verify and act on. It is deliberately **not** a marketplace: commerce
happens inside context, reached through discovery.

---

## Repository layout

```
App.tsx              The entire client application (~11,200 lines, React + TS)
server/              Ingestion backend: connectors, pipeline, HTTP API
preview/             Vite dev server + the jsdom test suites (605 assertions)
tc/                  Strict TypeScript typecheck harness
uploads/             Screenshots of the deployed app
```

`App.tsx` at the root is the source of truth. `preview/src/App.tsx` and
`tc/src/App.tsx` are working copies that the dev server and typechecker read;
both are refreshed by copying the root file over them.

---

## Running it

### The app

```bash
cd preview
npm install
npm run dev            # http://localhost:5173
```

The dev server proxies `/ingest/*` to the ingestion API on port 8787, so the
browser never talks to the backend directly.

### The ingestion server

```bash
cd server
npm install
cp .env.example .env   # fill in tokens for live connectors
npm start              # http://localhost:8787
```

It runs without any credentials. Web, RSS and manual ingestion work
immediately; Telegram and WhatsApp report **"Needs authorization"** in the
connector dashboard until their tokens are set. Brief keeps working either way
— a dead connector never breaks the app.

---

## Tests

```bash
# Client: 605 assertions across 18 suites
cd preview
cp ../App.tsx src/App.tsx
for f in e2e.final chain sys pure ing inbox pursuit pmatch parse capture \
         group groupui access arena quests econ nav dest; do
  npx esbuild $f.jsx --bundle --platform=node --outfile=$f.run.cjs \
      --format=cjs --loader:.tsx=tsx --external:jsdom
  node $f.run.cjs
done

# Server: 94 assertions, including live network tests
cd server && node test/run.js
OFFLINE=1 node test/run.js     # skip anything needing the network

# Typecheck
cd tc && cp ../App.tsx src/App.tsx && npx tsc -p tsconfig.json
```

The server suite hits real third parties (BBC's RSS feed, GitHub's robots.txt,
Telegram's API). Those tests **skip** rather than pass when the network is
unavailable, so a green run always means something real happened.

---

## Architecture notes

**Five primary destinations** — Nearby, Arena, My Layer, Workflows, Pulse.
There is no router: navigation is conceptual, driven by state. Do not add a
sixth destination; put new surfaces under an existing one's secondary nav.

**No fabricated data.** The rule the ingestion pipeline exists to enforce is
that a field which was not stated stays unstated. "Saturday popup" yields a
day, never a calendar date. Messages with nothing concrete in them produce no
object at all. Every extracted value stores the substring it came from so the
parser can be audited rather than trusted.

**Provenance is first-class.** One real-world thing is one canonical object
with many attached sources. Seeing the same event on Telegram and in a WhatsApp
export escalates it to `cross_source_confirmed` — it does not create two
events.

**Privacy.** Objects derived from a private source default to `source_members`,
not `public`. "From your groups" renders only when a real membership record
exists; membership is never inferred.

See [`server/CONNECTORS.md`](server/CONNECTORS.md) for exactly what each
connector can and cannot do, including the things that are genuinely impossible
(WhatsApp group ingestion, Telegram history backfill) and why.

---

## Deployment

The client is a static Vite build:

```
Build command:     npm run build
Output directory:  dist
Install command:   npm install
```

Environment variables for the client need the `VITE_` prefix to be exposed to
the browser. The ingestion server's secrets must **never** carry that prefix —
they stay server-side.
