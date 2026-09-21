// ---------------------------------------------------------------------------
// DECISIONS — refusal tests.
//
// Every operator decision in docs/DECISIONS.md is enforced here by a test that
// FAILS IF THE THING COMES BACK. A decision recorded in a document is not
// enforced; a decision enforced by a test is. These are written to be run
// against the live tree, so they read the real exports, the real rows and the
// real routes — never a fixture that restates the decision to itself.
//
// Deliberately negative-shaped: most assertions below are absences. That is the
// point. If a future change re-adds a featured slot, a popularity sort or a
// "3 from your Circle going" string, one of these fails and names the decision
// it broke.
//
// Currently implemented: D6 (events scoping).
// ---------------------------------------------------------------------------

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
process.env.NODE_ENV = "test";
process.env.BRIEF_DEV_AUTH = "0";
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "brief-decisions-"));
process.env.BRIEF_DATA_DIR = dir;

const { store } = await import("../src/store.js");
const auth = await import("../src/domain/auth.js");
const campaigns = await import("../src/domain/campaign.js");
const events = await import("../src/domain/events.js");
const { discoverSummary } = await import("../src/domain/discoverSummary.js");
const { test, step, run } = await import("./harness.mjs");

const DAY = 86400000;
const iso = (offsetDays) => new Date(Date.now() + offsetDays * DAY).toISOString();

const host = auth.createUser({ handle: "d6_host", password: "decisions-pw" });
const r1 = auth.createUser({ handle: "d6_r1", password: "decisions-pw" });
const r2 = auth.createUser({ handle: "d6_r2", password: "decisions-pw" });
const r3 = auth.createUser({ handle: "d6_r3", password: "decisions-pw" });

/** Publish an event with a chosen start date and capacity. */
function publish(title, startsAt, capacity) {
  const c = campaigns.createCampaign(host.id, { title, type: "event", location: "Nairobi", startsAt, capacity });
  campaigns.transitionCampaign(c.id, "published");
  return store.find("campaigns", (x) => x.id === c.id);
}

// ---------------------------------------------------------------------------
// FIXTURE — two events engineered so that a popularity sort and a startsAt
// sort give DIFFERENT answers. "Sooner" starts first and has no registrations;
// "Later" starts last and has three. Any reordering by popularity is therefore
// detectable, not merely asserted.
// ---------------------------------------------------------------------------
let sooner = null, later = null;
step("fixture: two published events whose popularity order contradicts their date order", () => {
  sooner = publish("D6 Sooner Event", iso(2), 40);
  later = publish("D6 Later Event", iso(10), 40);
  campaigns.register(later, { attendeeRef: "d6-a", userId: r1.id });
  campaigns.register(later, { attendeeRef: "d6-b", userId: r2.id });
  campaigns.register(later, { attendeeRef: "d6-c", userId: r3.id });
});

const ids = (rows) => rows.map((r) => r.title);

// ---------------------------------------------------------------------------
// D6 — FEATURED: none. No promoted events. No featured slot. Anywhere.
// ---------------------------------------------------------------------------
test("D6: events.js exports no setFeatured — there is no featured slot to set", () => {
  assert.equal(events.setFeatured, undefined,
    "setFeatured must not exist (D6: 'No promoted events. No featured slot.')");
});

test("D6: browseEvents does not narrow on a featured filter", () => {
  const all = events.browseEvents({});
  const only = events.browseEvents({ featured: true });
  assert.deepEqual(ids(only.events), ids(all.events),
    "a featured filter must not narrow the list (D6)");
});

test("D6: no event row exposes a featured flag", () => {
  for (const row of events.browseEvents({}).events) {
    assert.equal("featured" in row, false,
      `${row.title} still exposes 'featured' (D6: no featured slot anywhere)`);
  }
});

test("D6: no stored campaign can carry a featured flag in its metadata", () => {
  for (const c of store.all("campaigns")) {
    assert.equal(c.metadata?.featured, undefined,
      `campaign ${c.id} carries metadata.featured (D6)`);
  }
});

// ---------------------------------------------------------------------------
// D6 — SORTING: `startsAt` ascending. Period.
// ---------------------------------------------------------------------------
test("D6: browseEvents sorts startsAt ascending", () => {
  const got = ids(events.browseEvents({}).events);
  const soonerAt = got.indexOf("D6 Sooner Event");
  const laterAt = got.indexOf("D6 Later Event");
  assert.ok(soonerAt !== -1 && laterAt !== -1, "both fixture events are listed");
  assert.ok(soonerAt < laterAt, "the sooner event is listed first (D6: startsAt ascending)");
});

test("D6: asking for a popularity sort does not reorder anything", () => {
  const byDate = ids(events.browseEvents({ sort: "date" }).events);
  const byPop = ids(events.browseEvents({ sort: "popularity" }).events);
  assert.deepEqual(byPop, byDate,
    "sort=popularity must not reorder (D6: sorting is startsAt ascending, period). " +
    "The fixture is built so a real popularity sort WOULD differ.");
});

// ---------------------------------------------------------------------------
// D6 — SOCIAL PROOF: none. No "X going". No attendee names. No view count.
// The only number permitted is seats remaining.
// ---------------------------------------------------------------------------
test("D6: no event row exposes a popularity/registration count", () => {
  for (const row of events.browseEvents({}).events) {
    assert.equal("popularity" in row, false,
      `${row.title} still exposes 'popularity' (D6: no social proof, no 'X going')`);
  }
});

test("D6: no event row exposes a per-viewer circle overlap", () => {
  for (const viewerId of [null, host.id, r1.id]) {
    for (const row of events.browseEvents({ viewerId }).events) {
      assert.equal("tableBankingOverlap" in row, false,
        `${row.title} still exposes 'tableBankingOverlap' for viewer ${viewerId} ` +
        "(D6: 'no attendee names' also ends the per-viewer circle overlap)");
    }
  }
});

test("D6: events.js exports no overlap helper to compute one", () => {
  assert.equal(events.tableBankingOverlapFor, undefined,
    "tableBankingOverlapFor must not exist (D6)");
});

test("D6: the public event projection exposes no circle overlap", () => {
  const view = campaigns.publicView(later, host.id);
  assert.equal("tableBankingOverlap" in view, false,
    "publicView still carries tableBankingOverlap (D6)");
});

test("D6: the public event projection exposes no 'registered' social-proof count", () => {
  // campaign.js serves `registered` under a comment that calls it exactly what
  // D6 forbids: "Aggregate social proof: HOW MANY are registered". The seats
  // line below is the number the decision keeps; this one is not.
  const view = campaigns.publicView(later, host.id);
  assert.equal("registered" in view, false,
    "publicView still carries a 'registered' count (D6: no 'X going')");
});

test("D6: seats remaining IS still served — the one number the decision permits", () => {
  const view = campaigns.publicView(later, host.id);
  assert.equal(view.capacity, 40, "capacity survives");
  assert.equal(view.remaining, 37, "and so does the derived seat count: 37 of 40 remaining");
  assert.equal(view.soldOut, false, "with its sold-out state");
});

test("D6: the discover summary carries no social-proof language", () => {
  const s = JSON.stringify(discoverSummary({ viewerId: host.id }));
  for (const banned of ["most registrations", "busiest", "marked it featured", "from your circle", "registered —"]) {
    assert.equal(s.toLowerCase().includes(banned.toLowerCase()), false,
      `discover summary still says "${banned}" (D6: no social proof)`);
  }
});

test("D6: the discover summary exposes no registration count as interest", () => {
  const s = JSON.stringify(discoverSummary({ viewerId: host.id }));
  assert.equal(/"label":"registered"/.test(s), false,
    "discover summary still surfaces a 'registered' count (D6)");
  assert.equal(/"label":"registrations"/.test(s), false,
    "discover summary still surfaces a 'registrations' count (D6)");
});

// ---------------------------------------------------------------------------
// D6 — OVER THE WIRE. A retired route must 404, not return ok.
// ---------------------------------------------------------------------------
test("D6: POST /api/campaigns/:id/feature is retired (404)", async () => {
  const { default: app } = await import("../src/index.js");
  const srv = app.listen(0);
  const port = srv.address().port;
  const { token } = auth.issueSession(host.id);
  const call = async (p, m = "GET", body, tok) => {
    const headers = { "content-type": "application/json" };
    if (tok) headers.authorization = `Bearer ${tok}`;
    const r = await fetch(`http://127.0.0.1:${port}${p}`, { method: m, headers, body: body ? JSON.stringify(body) : undefined });
    return { status: r.status, body: await r.json().catch(() => null) };
  };
  try {
    const feature = await call(`/api/campaigns/${later.id}/feature`, "POST", { featured: true }, token);
    assert.equal(feature.status, 404,
      `the feature route still answers ${feature.status} (D6: no featured slot anywhere)`);
  } finally {
    srv.close();
  }
});

test("D6: GET /api/events ignores featured and sort=popularity, and serves no counts", async () => {
  const { default: app } = await import("../src/index.js");
  const srv = app.listen(0);
  const port = srv.address().port;
  const { token } = auth.issueSession(host.id);
  // /api/events is NOT in index.js PUBLIC_WITHOUT_SESSION, so the session gate
  // answers before the route — even though routes/events.js calls itself "the
  // public browsing surface". Same mismatch as /api/table-banking/templates.
  // Authenticated here so the assertion measures D6, not the gate; the gate is
  // pinned separately below and flagged for an operator decision.
  const get = async (q) => {
    const r = await fetch(`http://127.0.0.1:${port}/api/events${q}`, { headers: { authorization: `Bearer ${token}` } });
    return { status: r.status, body: await r.json().catch(() => null) };
  };
  try {
    const anon = await fetch(`http://127.0.0.1:${port}/api/events`);
    assert.equal(anon.status, 401, "the events hub is behind the session gate today (pinning reality)");
    const plain = await get("");
    assert.equal(plain.status, 200);
    const featured = await get("?featured=1");
    const pop = await get("?sort=popularity");
    const titles = (b) => (b?.events ?? []).map((e) => e.title);
    assert.deepEqual(titles(featured.body), titles(plain.body), "?featured=1 must not narrow (D6)");
    assert.deepEqual(titles(pop.body), titles(plain.body), "?sort=popularity must not reorder (D6)");
    for (const e of plain.body.events ?? []) {
      assert.equal("popularity" in e, false, "the wire still carries a popularity count (D6)");
      assert.equal("featured" in e, false, "the wire still carries a featured flag (D6)");
      assert.equal("tableBankingOverlap" in e, false, "the wire still carries a circle overlap (D6)");
    }
  } finally {
    srv.close();
  }
});

await run();
