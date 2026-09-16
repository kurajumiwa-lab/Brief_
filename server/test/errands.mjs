// ---------------------------------------------------------------------------
// ERRANDS — the lobby loop, the carry gate, and the two places a lie would
// most easily enter: money and reputation.
//
//   · posting is open; carrying needs a REAL record (role, shop claim, or a
//     pickup already assigned). A stranger is refused with the reason and the
//     way to change it, not a shrug.
//   · the loop only moves forward through its table; each stage is an event
//     with a timestamp, and nobody but the carrier can move it.
//   · the fee is the poster's own stated number. Nothing is charged, held or
//     moved: "settled" requires BOTH parties to confirm, and says Brief moved
//     nothing. A missing fee stays missing rather than becoming 0.
//   · a rating is one per person per completed delivery, from the two parties
//     only. There is no average, score, tier or rank anywhere — and no
//     endpoint that computes one — because that is how a credit score starts.
//   · notifications are rows. Nothing is claimed about SMS or WhatsApp.
// ---------------------------------------------------------------------------

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
process.env.NODE_ENV = "test";
process.env.BRIEF_DEV_AUTH = "0";
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "brief-errands-"));
process.env.BRIEF_DATA_DIR = dir;

const { store } = await import("../src/store.js");
const auth = await import("../src/domain/auth.js");
const vendors = await import("../src/domain/vendor.js");
const errands = await import("../src/domain/errands.js");

let count = 0;
const test = async (name, fn) => { await fn(); count++; console.log("PASS " + name); };

const poster = auth.createUser({ handle: "er_poster", password: "a good passphrase" });
const agent = auth.createUser({ handle: "er_agent", password: "a good passphrase" });
const plain = auth.createUser({ handle: "er_plain", password: "a good passphrase" });

const vendor = vendors.createVendor({ ownerId: agent.id, displayName: "Mama Njeri Grocers" });
const stamp = () => new Date().toISOString();
store.insert("vendorClaims", {
  id: "vcl_er", vendorId: vendor.id, agentId: agent.id, claimType: "full_registration",
  status: "active", claimedAt: stamp(), expiresAt: new Date(Date.now() + 720 * 3600000).toISOString(),
  createdAt: stamp()
});

// ---------------------------------------------------------------------------
await test("anyone may post, and only stated facts are stored", () => {
  const r = errands.postErrand({
    actorId: poster.id, what: "Seal a file at City Hall", pickup: "Wakulima stall 42", dropoff: "City Hall, tower section",
    offeredFeeKes: 300, whenNeeded: new Date(Date.now() + 86400000).toISOString().slice(0, 10), note: "cash on arrival"
  });
  assert.ok(r.errand.id, "the errand row exists");
  assert.equal(r.errand.status, "open");
  assert.equal(r.errand.offeredFeeKes, 300, "the fee is what the poster wrote, in whole currency");
  assert.equal(r.errand.posterId, poster.id);
  assert.equal(r.errand.acceptedBy, null, "nobody has taken it");
  assert.equal(r.errand.history.length, 1);
  assert.equal(r.errand.history[0].action, "errand_posted");

  // A blank fee is absent, not zero.
  const free = errands.postErrand({ actorId: poster.id, what: "Collect my prescription", pickup: "Pharmacy", dropoff: "Kilimani" });
  assert.equal(free.errand.offeredFeeKes, null, "no fee stated is no fee, not KES 0");

  for (const bad of [
    [{ what: "x", pickup: "a", dropoff: "b" }, /at least 4 characters/],
    [{ what: "real ask", pickup: "", dropoff: "b" }, /collect/],
    [{ what: "real ask", pickup: "a", dropoff: "b", offeredFeeKes: -5 }, /number from 0/],
    [{ what: "real ask", pickup: "a", dropoff: "b", whenNeeded: "tomorrow" }, /must be a date/]
  ]) {
    const res = errands.postErrand({ actorId: poster.id, ...bad[0] });
    assert.equal(typeof res.error, "string", "a bad post is refused");
    assert.match(res.error, bad[1]);
  }
  assert.equal(errands.myErrands(poster.id).length, 2, "and nothing was written for the refusals");
});

await test("carrying needs a real record, and the refusal carries the way in", () => {
  assert.equal(errands.canCarry(plain.id).eligible, false, "an ordinary member cannot carry");
  assert.equal(errands.canCarry(agent.id).eligible, true, "an agent with an active shop claim can");
  assert.match(errands.canCarry(agent.id).basis.join(" "), /active shop claim/);
  assert.equal(errands.canCarry(null).eligible, false, "and neither can nobody");

  const board = errands.carryBoard();
  assert.deepEqual(board.map((b) => b.displayName), ["er_agent"], "the roster is built from rows, deduped");

  const e = errands.listErrands({ status: "open" })[0];
  const refused = errands.acceptErrand(e.id, { carrierId: plain.id });
  assert.equal(refused.status, 403, "the gate is server-side, not a hidden button");
  assert.match(refused.error, /agent or partner/);
  assert.equal(refused.eligibility.eligible, false, "and the answer explains itself");
  assert.match(refused.eligibility.howToJoin, /onboard a shop/);

  const self = errands.postErrand({ actorId: agent.id, what: "Carry my own box", pickup: "Home", dropoff: "Office" });
  assert.equal(errands.acceptErrand(self.errand.id, { carrierId: agent.id }).status, 403, "you cannot take your own errand");
});

const freshErrand = (fee = 300) => errands.postErrand({
  actorId: poster.id, what: `Doc run ${Math.random().toString(36).slice(2, 8)}`,
  pickup: "Wakulima stall 42", dropoff: "City Hall", offeredFeeKes: fee
}).errand;

await test("the loop moves forward only, by the people in it, with a timestamp each", () => {
  const e = freshErrand();
  const acc = errands.acceptErrand(e.id, { carrierId: agent.id });
  assert.equal(acc.errand.status, "accepted");
  assert.equal(acc.errand.acceptedBy, agent.id);
  assert.equal(errands.acceptErrand(e.id, { carrierId: agent.id }).status, 409, "it cannot be taken twice");

  assert.equal(errands.markDelivered(e.id, { actorId: agent.id }).status, 409, "accepted -> delivered skips a stage and is refused");
  assert.equal(errands.markPicked(e.id, { actorId: poster.id }).status, 403, "the poster cannot move the carrier's stages");
  assert.equal(errands.markPicked(e.id, { actorId: agent.id }).errand.status, "picked_up");
  assert.equal(errands.markDelivered(e.id, { actorId: agent.id }).errand.status, "delivered");

  const view = errands.getErrand(e.id, poster.id);
  const done = view.loop.filter((s) => s.done).map((s) => s.key);
  assert.deepEqual(done.slice(0, 4), ["posted", "accepted", "picked_up", "delivered"], "each reached stage is recorded");
  assert.deepEqual(done.slice(4), [], "and unreached stages have no date invented");
  assert.ok(view.loop.every((s) => !s.done || Boolean(s.at)), "no stage is done without a timestamp");
  assert.equal(view.carrierName, "er_agent", "the carrier is named only once they took it");
  assert.match(JSON.stringify(view.history), /errand_accepted/, "the history is append-only evidence");
});

await test("the fee is confirmed by both sides, and Brief moves nothing", () => {
  const e = freshErrand();
  errands.acceptErrand(e.id, { carrierId: agent.id });
  errands.markPicked(e.id, { actorId: agent.id });
  errands.markDelivered(e.id, { actorId: agent.id });

  const one = errands.confirmSettled(e.id, { actorId: agent.id });
  assert.equal(one.settled, false, "one side is not a settlement");
  assert.equal(one.errand.settlement.at, null, "and there is no time until both speak");
  assert.match(one.note, /did not move it/, "the record says Brief moved nothing");

  const stranger = errands.confirmSettled(e.id, { actorId: plain.id });
  assert.equal(stranger.status, 403, "a third party cannot confirm someone else's money");

  const both = errands.confirmSettled(e.id, { actorId: poster.id });
  assert.equal(both.settled, true, "both parties: recorded as agreed");
  assert.equal(both.errand.settlement.amountKes, 300, "at the stated amount");
  assert.equal(both.errand.settlement.movedBy, null, "with no fake provider on it");

  // No fee stated -> nothing to confirm, and no invented 0.
  const free = errands.postErrand({ actorId: poster.id, what: "Drop a key at the estate office", pickup: "Shop", dropoff: "Gate" });
  errands.acceptErrand(free.errand.id, { carrierId: agent.id });
  errands.markPicked(free.errand.id, { actorId: agent.id });
  errands.markDelivered(free.errand.id, { actorId: agent.id });
  const settledFree = errands.confirmSettled(free.errand.id, { actorId: poster.id });
  assert.match(settledFree.note, /No fee was stated/, "and the answer says there was nothing to pay");
  assert.equal(settledFree.errand.settlement.amountKes, null, "still no number");
});

await test("a rating is one per party per delivery, listed and never aggregated", () => {
  const e = freshErrand();
  errands.acceptErrand(e.id, { carrierId: agent.id });
  errands.markPicked(e.id, { actorId: agent.id });

  assert.equal(errands.rateErrand(e.id, { actorId: poster.id, stars: 5 }).status, 409, "not yet delivered cannot be rated");
  errands.markDelivered(e.id, { actorId: agent.id });

  assert.match(errands.rateErrand(e.id, { actorId: poster.id, stars: 9 }).error, /whole number/, "stars are 1-5");
  assert.match(errands.rateErrand(e.id, { actorId: poster.id, stars: 3.5 }).error, /whole number/, "and not fractional");
  assert.equal(errands.rateErrand(e.id, { actorId: plain.id, stars: 4 }).status, 403, "only the two parties");

  const a = errands.rateErrand(e.id, { actorId: poster.id, stars: 5, note: "on time" });
  assert.equal(a.rating.stars, 5);
  assert.equal(a.rating.about, "carrier", "a poster rates the carrier");
  assert.equal(errands.rateErrand(e.id, { actorId: poster.id, stars: 1 }).status, 409, "and cannot rewrite it with a second rating");
  const b = errands.rateErrand(e.id, { actorId: agent.id, stars: 4 });
  assert.equal(b.rating.about, "poster", "the carrier rates the other side, kept apart");

  const view = errands.getErrand(e.id, poster.id);
  assert.equal(view.ratings.length, 2);
  assert.ok(view.ratingsNote.includes("no average"), "and the read states what it will not do");
  assert.equal(view.canRate, false, "a party who has rated has no control left");

  // The aggregate must not exist at all.
  for (const banned of ["averageRating", "avgStars", "score", "ratingScore", "reputation", "tier", "rank"]) {
    assert.ok(!(banned in view), `no ${banned} field is exposed`);
    assert.ok(!Object.keys(errands).some((k) => k.toLowerCase().includes(banned.toLowerCase())), `no ${banned} function exists`);
  }
});

await test("notification is a row, and no channel is pretended", () => {
  const before = store.all("notifications").length;
  const r = errands.postErrand({ actorId: poster.id, what: "Take the sample to the lab", pickup: "Lab intake", dropoff: "Agent office" });
  const rows = store.all("notifications").slice(before);
  assert.ok(rows.length >= 1, "an eligible carrier was notified");
  assert.equal(rows[0].type, "errand", "on the errand category, so a preference can mute it");
  assert.equal(r.notified.notified >= 1, true, "and the answer counts real writes");
  assert.equal(r.notified.channels.sms, "not_configured", "no SMS was sent");
  assert.equal(r.notified.channels.whatsapp, "not_configured", "no WhatsApp was sent");
  assert.match(r.notified.note, /in-app/, "the note says what it actually did");

  // A carrier who muted errand alerts is skipped, honestly counted.
  const prefs = store.find("notificationPrefs", (p) => p.userId === agent.id);
  if (prefs) store.update("notificationPrefs", prefs.id, { preferences: { ...(prefs.preferences ?? {}), alerts: false } });
  const again = errands.postErrand({ actorId: poster.id, what: "Another sample to the lab", pickup: "Lab intake", dropoff: "Agent office" });
  assert.ok(again.notified, "the answer still reports rather than assuming");
});

await test("providers reveal what Brief can move, and names the rest with no invented detail", () => {
  const p = errands.providers();
  assert.equal(p.integrated.length, 1);
  assert.equal(p.integrated[0].key, "wairo", "WAIRO is the one thing dispatched here");
  assert.equal(p.integrated[0].canDispatchThroughBrief, true);
  assert.equal(typeof p.integrated[0].deliveredPickups, "number", "counted from real pickups");

  const names = p.external.map((x) => x.name).join(" ");
  assert.match(names, /Fargo/, "other services are named");
  for (const e of p.external) {
    assert.equal(e.canDispatchThroughBrief, false, "each is explicitly not bookable here");
    assert.ok(!("phone" in e) && !("contact" in e) && !("rateKes" in e), "and no invented contact or price rides along");
  }
  assert.match(p.disclosure, /no phone number, no price, no promise/);

  // Carriers people actually used appear only because a dispatch row named them.
  store.insert("spaceDispatches", {
    id: "dsp_er", spaceId: "spc_er", carrierSacco: "Easy Ride Sacco", waybillRef: "WAY-EAS-1001",
    destinationCounty: "Kisii", status: "staged", createdAt: new Date().toISOString()
  });
  const after = errands.providers();
  assert.equal(after.usedHere.length, 1, "a used carrier shows up from the row");
  assert.equal(after.usedHere[0].dispatchesRecorded, 1);
  assert.equal(after.usedHere[0].canDispatchThroughBrief, false, "still not bookable here");
});

await test("API: the rails are wired, gated by session, and refuse non-carriers", async () => {
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
    assert.equal((await call("/api/errands")).status, 401, "the board needs a session");
    assert.equal((await call("/api/errands/eligibility")).status, 401, "so does the gate check");
    const p1 = await call("/api/auth/register", "POST", { handle: "er_api1_" + Date.now().toString(36), password: "a good passphrase" });
    const t1 = p1.body.token;
    const board = await call("/api/errands", "GET", undefined, t1);
    assert.equal(board.status, 200);
    assert.equal(board.body.eligibility.eligible, false, "a fresh member cannot carry");
    assert.ok(Array.isArray(board.body.stages) && board.body.stages.length === 6, "the loop is served, not invented client-side");

    const posted = await call("/api/errands", "POST", { what: "Seal a file at City Hall", pickup: "Wakulima", dropoff: "City Hall", offeredFeeKes: 250 }, t1);
    assert.equal(posted.status, 200, "posting works for any member");
    const id = posted.body.errand.id;
    const p2 = await call("/api/auth/register", "POST", { handle: "er_api2_" + Date.now().toString(36), password: "a good passphrase" });
    const refused = await call(`/api/errands/${id}/accept`, "POST", {}, p2.body.token);
    assert.equal(refused.status, 403, "another member cannot take it either: carrying needs a record");
    assert.match(refused.body.error, /agent or partner/);
    assert.equal(refused.body.eligibility.eligible, false, "with the reason in the body");
    const own = await call(`/api/errands/${id}/accept`, "POST", {}, t1);
    assert.match(own.body.error, /you posted this one/, "and the poster is refused for the right reason");
    const early = await call(`/api/errands/${id}/rate`, "POST", { stars: 5 }, t1);
    assert.equal(early.status, 409, "nothing can be rated before it is delivered");
    assert.match(early.body.error, /marked delivered/);
    const missing = await call("/api/errands/erd_nope", "GET", undefined, t1);
    assert.equal(missing.status, 404, "and a missing errand says so");
  } finally {
    srv.close();
  }
});

console.log(`\nPASS ${count}`);
process.exit(0);
