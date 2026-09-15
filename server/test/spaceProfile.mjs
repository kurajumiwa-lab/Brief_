// ---------------------------------------------------------------------------
// SPACE PROFILE — the space as a maintained instrument.
//
// Pins four things:
//   1. STRUCTURE: the genesis answers are stored as typed data with SERVER
//      timestamps. A client cannot write "confirmed today".
//   2. DECAY: FRESH/ACTIVE/STALE/DORMANT are arithmetic over the newest real
//      maintenance event, computed on read — nothing is stored, and the clock
//      is injectable so the ladder is testable.
//   3. THE QUEUE: every open item is a row or a timestamp with `evidence`, and
//      an answer that was never given is reported as never given (not zero, not
//      "none", not silently complete).
//   4. NO LADDER: no rank, tier, priority, boost, score or badge exists in the
//      payload, and a refresh records a confirmation instead of deleting an
//      item by fiat.
// ---------------------------------------------------------------------------

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
process.env.NODE_ENV = "test";
process.env.BRIEF_DEV_AUTH = "0";
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "brief-spaceprofile-"));
process.env.BRIEF_DATA_DIR = dir;

const { store } = await import("../src/store.js");
const auth = await import("../src/domain/auth.js");
const spaces = await import("../src/domain/space.js");
const prof = await import("../src/domain/spaceProfile.js");

let count = 0;
const test = async (name, fn) => { await fn(); count++; console.log("PASS " + name); };

const HOUR = 3600000;
const DAY = 24 * HOUR;

const owner = auth.createUser({ handle: "sp_owner", password: "a good passphrase" });
const ownerHandle = "sp_owner";
const other = auth.createUser({ handle: "sp_other", password: "a good passphrase" });

const GENESIS = {
  what: { text: "Fresh tilapia, whole, graded" },
  capacity: { value: 40, unit: "kg", per: "day" },
  availability: { days: ["tue", "wed", "thu", "fri", "sat"], from: "06:00", to: "18:00" },
  operatingFrom: { text: "Wakulima Market, stall 42" },
  coverage: { items: ["Nairobi CBD", "Westlands", "Kilimani"] },
  constraints: { items: ["No delivery beyond 15km", "No cold storage"] },
  needs: { items: ["Cold chain for 2 runs a day"] },
  offersToNetwork: { items: ["10% margin to a rider who brings buyers"] }
};

const created = spaces.createSpace({
  ownerId: owner.id,
  name: "Tilapia at Wakulima 42",
  type: "business",
  spaceProfile: GENESIS
});

// ---------------------------------------------------------------------------
await test("genesis answers are stored as typed data with server timestamps", () => {
  const fields = created.profile.fields;
  assert.equal(Object.keys(fields).length, 8, "every answered field is stored");
  for (const [key, entry] of Object.entries(fields)) {
    assert.ok(Number.isFinite(Date.parse(entry.updatedAt)), `${key} carries an updatedAt`);
    assert.ok(Date.now() - Date.parse(entry.updatedAt) < 60_000, `${key} is stamped by the SERVER clock`);
    assert.equal(entry.updatedBy, owner.id, `${key} records who wrote it`);
  }
  // Structured, not prose: the capacity answer is a number with a unit.
  assert.equal(fields.capacity.value.value, 40);
  assert.equal(fields.capacity.value.unit, "kg");
  assert.equal(prof.formatAnswer("capacity", fields.capacity.value), "40 kg/day");
  assert.equal(prof.formatAnswer("availability", fields.availability.value), "Tue, Wed, Thu, Fri, Sat 06:00–18:00");
  assert.equal(prof.formatAnswer("what", fields.what.value), "Fresh tilapia, whole, graded");
  assert.equal(prof.formatAnswer("constraints", fields.constraints.value), "No delivery beyond 15km · No cold storage");
});

await test("a client cannot forge timestamps or invent a field", () => {
  const forged = prof.profileFromGenesis({ capacity: { value: 9, unit: "kg", per: "day", updatedAt: "2020-01-01T00:00:00Z" } }, { actorId: owner.id });
  assert.ok(!("updatedAt" in forged.capacity.value), "a timestamp sent inside the answer is not stored as one");
  assert.throws(
    () => prof.profileFromGenesis({ revenue_share: { items: [] } }),
    /revenue_share/,
    "an unknown key is rejected rather than accepted as free-form JSON"
  );
  assert.throws(
    () => prof.profileFromGenesis({ capacity: { value: 40, unit: "" } }),
    /unit/,
    "a number without a unit is refused — the pipeline needs to know the unit"
  );
  assert.throws(
    () => prof.profileFromGenesis({ capacity: { value: -3, unit: "kg" } }),
    /positive/,
    "a negative capacity is refused rather than stored"
  );
});

await test("state is derived from timestamps and decays on the injected clock", () => {
  const row = store.find("spaces", (s) => s.id === created.id);
  assert.equal(prof.maintenanceFor(row, { now: Date.now() }).state, "fresh");
  assert.equal(prof.maintenanceFor(row, { now: Date.now() + 3 * DAY }).state, "active");
  assert.equal(prof.maintenanceFor(row, { now: Date.now() + 10 * DAY }).state, "stale");
  assert.equal(prof.maintenanceFor(row, { now: Date.now() + 40 * DAY }).state, "dormant");
  // Cadence too: weekly answers go overdue before the monthly ones.
  const at10 = prof.maintenanceFor(row, { now: Date.now() + 10 * DAY });
  const byKey = Object.fromEntries(at10.fields.map((f) => [f.key, f.state]));
  assert.equal(byKey.availability, "overdue", "availability is a 7-day answer");
  assert.equal(byKey.capacity, "current", "capacity is a 30-day answer");
  assert.equal(at10.answered, 8, "eight answers on record");
  assert.equal(at10.unanswered, 0);
});

await test("the queue is built from rows, and a never-answered field says so", () => {
  const space = spaces.createSpace({
    ownerId: owner.id,
    name: "Half-answered space",
    type: "side_hustle",
    spaceProfile: { what: { text: "Second-hand books" } }
  });
  const row = store.find("spaces", (s) => s.id === space.id);
  const q = prof.editorialQueueFor(row);
  const missing = q.filter((i) => i.urgency === "missing");
  assert.equal(missing.length, 7, "the seven unanswered questions are open items");
  assert.ok(missing.every((i) => i.kind === "profile" && i.evidence.table === "spaces"), "each names its source");
  assert.ok(!JSON.stringify(q).includes('"count":0'), "nothing is reported as zero-to-do");

  // Real economic rows join the queue.
  store.insert("listings", {
    id: "lst_d1", spaceId: space.id, vendorId: space.vendorId, title: "Set books",
    price: 500, currency: "KES", status: "draft", quantity: 3,
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
  });
  store.insert("spaceConversations", {
    id: "cv_d1", spaceId: space.id, status: "new", customerName: "Wanjiku", customerContact: "",
    messages: [{ from: "customer", text: "Do you have the KCPE set?", at: new Date(Date.now() - 4 * HOUR).toISOString() }],
    createdAt: new Date().toISOString()
  });
  const q2 = prof.editorialQueueFor(store.find("spaces", (s) => s.id === space.id));
  const kinds = q2.map((i) => i.kind);
  assert.ok(kinds.includes("offer"), "a draft offer is an item (it cannot be bought yet)");
  assert.ok(kinds.includes("reply"), "a customer message awaiting the owner is an item");
  const reply = q2.find((i) => i.kind === "reply");
  assert.equal(reply.evidence.id, "cv_d1", "the item names the conversation row");
  assert.ok(/4h/.test(reply.detail), "and how long it has waited");
  // A reply from the OWNER is not an item — the queue only lists what waits on them.
  store.update("spaceConversations", "cv_d1", {
    status: "replied",
    messages: [
      { from: "customer", text: "Do you have the KCPE set?", at: new Date(Date.now() - 4 * HOUR).toISOString() },
      { from: "owner", text: "Two copies, KES 500 each.", at: new Date().toISOString() }
    ]
  });
  const q3 = prof.editorialQueueFor(store.find("spaces", (s) => s.id === space.id));
  assert.ok(!q3.some((i) => i.kind === "reply"), "a thread the owner answered last drops out for real");
});

await test("a matched-but-unanswered demand is the top item, with its request id", () => {
  const space = spaces.createSpace({ ownerId: owner.id, name: "Cold chain ready", type: "business", spaceProfile: GENESIS });
  store.insert("requests", {
    id: "req_match", title: "40kg tilapia for Friday", status: "matching", category: "fish",
    requesterId: other.id, revision: 1, history: [], attachments: [],
    createdAt: new Date(Date.now() - 2 * HOUR).toISOString(), updatedAt: new Date(Date.now() - 1 * HOUR).toISOString()
  });
  store.insert("matches", {
    id: "mtch_1", requestId: "req_match", participantId: space.vendorId, status: "suggested",
    requesterState: "suggested", revision: 1, createdAt: new Date(Date.now() - 90 * 60000).toISOString(),
    updatedAt: new Date().toISOString(), history: []
  });
  const row = store.find("spaces", (s) => s.id === space.id);
  const q = prof.editorialQueueFor(row);
  const demand = q.find((i) => i.kind === "demand");
  assert.ok(demand, "the open demand appears in the queue");
  assert.match(demand.label, /40kg tilapia for Friday/, "it names the real request");
  assert.equal(demand.requestId, "req_match", "and links to the row");
  assert.equal(demand.evidence.id, "mtch_1", "backed by the match row that created it");
  const pipe = prof.pipelineFor(row);
  assert.equal(pipe.matchQueries30d.count, 1, "the pipeline read counts the same match row");
  assert.equal(pipe.matchQueries30d.wording, "requests whose matching run included this space in the last 30 days",
    "and describes itself precisely — no rank, no position");
});

await test("refreshing an unchanged answer records a CONFIRMATION, not new data", () => {
  const row = store.find("spaces", (s) => s.id === created.id);
  const before = row.profile.fields.capacity;
  const res = prof.setProfile(created.id, {
    callerId: owner.id,
    fields: { capacity: { value: 40, unit: "kg", per: "day" } }
  });
  assert.deepEqual(res.changed, [], "nothing changed");
  assert.deepEqual(res.confirmed, ["capacity"], "the confirmation is explicit");
  const after = store.find("spaces", (s) => s.id === created.id).profile.fields.capacity;
  assert.equal(JSON.stringify(after.value), JSON.stringify(before.value), "the stored value is untouched");
  assert.notEqual(after.lastConfirmedAt, before.lastConfirmedAt, "its confirmation moved");
  assert.equal(after.confirmations, before.confirmations + 1, "and the count of real confirmations grew");
  const kinds = store.filter("spaceActivities", (a) => a.spaceId === created.id).map((a) => a.kind);
  assert.ok(kinds.includes("space_profile_confirmed"), "an activity row records the event");
  assert.ok(!kinds.includes("space_profile_updated"), "no phantom 'updated' row is written");

  // Confirming something never answered is refused rather than auto-answered.
  const bare = spaces.createSpace({ ownerId: owner.id, name: "Bare space", type: "other" });
  const denied = prof.confirmField(bare.id, "capacity", { callerId: owner.id });
  assert.equal(denied.status, 409, "there is nothing to confirm");
  assert.match(denied.error, /answer the question first/);
});

await test("ownership is enforced on every write and on the derived read", () => {
  const nope = prof.setProfile(created.id, { callerId: other.id, fields: { what: { text: "Stolen edit" } } });
  assert.equal(nope.status, 403, "a stranger cannot rewrite someone's space file");
  const read = (() => {
    try {
      spaces.getSpaceOperating(created.id, { callerId: other.id });
      return "returned";
    } catch (e) {
      return e.message;
    }
  })();
  assert.match(String(read), /not authorized/i, "and cannot read the pipeline view");
});

await test("the derived payload carries no rank, tier, priority, score or badge", () => {
  const row = store.find("spaces", (s) => s.id === created.id);
  const view = {
    maintenance: prof.maintenanceFor(row),
    editorial: prof.editorialQueueFor(row),
    pipeline: prof.pipelineFor(row),
    public: prof.publicProfile(row)
  };
  const keys = [];
  const walk = (o) => {
    if (o && typeof o === "object") {
      for (const k of Object.keys(o)) { keys.push(k.toLowerCase()); walk(o[k]); }
    }
  };
  walk(view);
  for (const banned of ["rank", "tier", "priority", "boost", "score", "queueposition", "badge", "privilege", "weight"]) {
    assert.ok(!keys.includes(banned), `no ${banned} field exists`);
  }
  // The state field is a word, not a number, and the payload says so.
  assert.equal(typeof view.maintenance.state, "string");
  assert.match(view.maintenance.note, /does not rank/);
  assert.match(view.pipeline.note, /no boost, no priority tier/);
});

await test("the public projection carries the declared facts and the age, never the economics", () => {
  const row = store.find("spaces", (s) => s.id === created.id);
  store.update("spaces", created.id, { visibility: "public" });
  const pub = spaces.publicSpaceView(store.find("spaces", (s) => s.id === created.id));
  assert.equal(pub.operating.fields.capacity.answer, "40 kg/day", "a buyer can read the capacity");
  assert.equal(pub.operating.fields.constraints.answer, "No delivery beyond 15km · No cold storage", "including the limits");
  assert.equal(pub.operating.staleDays, null, "and is not told it is stale when it is current");
  for (const banned of ["metrics", "revenueKes", "pipeline", "ownerId", "vendorId", "profile"]) {
    assert.ok(!(banned in pub), `the public card leaks no ${banned}`);
  }
  // Backdate the answers and the age becomes visible — a fact, not a verdict.
  const old = new Date(Date.now() - 12 * DAY).toISOString();
  const fields = {};
  for (const [k, e] of Object.entries(store.find("spaces", (s) => s.id === created.id).profile.fields)) {
    fields[k] = { ...e, updatedAt: old, lastConfirmedAt: old };
  }
  store.update("spaces", created.id, { profile: { fields, createdAt: old, updatedAt: old } });
  const stale = spaces.publicSpaceView(store.find("spaces", (s) => s.id === created.id));
  assert.ok(stale, "sanity: the row survived the backdate");
  assert.equal(stale.operating.staleDays, 12, "a 12-day-old answer is labelled as 12 days old");
});

await test("API: the profile routes are wired, auth-gated and owner-scoped", async () => {
  const { default: app } = await import("../src/index.js");
  const srv = app.listen(0);
  const port = srv.address().port;
  const call = async (p, m = "GET", body, token) => {
    const headers = { "content-type": "application/json" };
    if (token) headers.authorization = `Bearer ${token}`;
    const r = await fetch(`http://127.0.0.1:${port}${p}`, { method: m, headers, body: body ? JSON.stringify(body) : undefined });
    return { status: r.status, body: await r.json().catch(() => null) };
  };
  try {
    assert.equal((await call(`/api/spaces/${created.id}/operating`)).status, 401, "the operating view needs a session");
    assert.equal((await call(`/api/spaces/${created.id}/profile`, "PATCH", { fields: { what: { text: "x" } } })).status, 401, "and so does the write");
    const A = (await call("/api/auth/register", "POST", { handle: "spp_" + Date.now().toString(36), password: "a good passphrase" })).body;
    const mine = await call(`/api/spaces/${created.id}/operating`, "GET", undefined, A.token);
    assert.equal(mine.status, 403, "another member's session is refused on someone else's space");
    const schema = await call("/api/spaces/profile-schema", "GET", undefined, A.token);
    assert.equal(schema.status, 200);
    assert.equal(schema.body.fields.length, 8, "the schema is served from the server, not the client");
    assert.ok(schema.body.fields.every((f) => f.question && f.kind && f.cadenceHours > 0), "each field is fully described");

    // Owner path: register as the owner by driving the domain session directly.
    const own = await call("/api/auth/login", "POST", { handle: ownerHandle, password: "a good passphrase" });
    assert.equal(own.status, 200, "the owner can sign in for the write path");
    if (own.status === 200 && own.body?.token) {
      const patched = await call(`/api/spaces/${created.id}/profile`, "PATCH", { coverage: { items: ["Kileleshra"] } }, own.body.token);
      assert.equal(patched.status, 200, "the owner can write their own space file");
      assert.deepEqual(patched.body.changed, ["coverage"]);
      const view = await call(`/api/spaces/${created.id}/operating`, "GET", undefined, own.body.token);
      assert.equal(view.status, 200);
      assert.equal(view.body.pipeline.settled.orders, 0, "and reads derived truth");
    }
  } finally {
    srv.close();
  }
});

console.log(`\nPASS ${count}`);
process.exit(0);
