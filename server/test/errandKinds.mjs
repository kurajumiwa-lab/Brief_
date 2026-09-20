// ---------------------------------------------------------------------------
// ERRAND KINDS — a taxonomy that is stored, or no taxonomy at all.
//
// The brief asked for 1xBet's two-column category grid on Errands. A grid of
// buttons that filters nothing is decoration, and decoration that looks like a
// filter is worse than none: it teaches people the app lies to them. So the kind
// is validated on the row, read back on the view, and the board filters on the
// stored value. Four rules these tests hold:
//
//   * kind is OPTIONAL and an unlabelled errand is never hidden — it shows under
//     "any", exactly as an untagged listing shows on the marketplace board;
//   * an unknown kind is REFUSED with the list, not coerced into "other";
//   * no tile carries a count, so six zeros cannot be printed as a shop window;
//   * the labels come from the server, so the UI cannot invent a seventh kind.
// ---------------------------------------------------------------------------
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";

process.env.NODE_ENV = "test";
process.env.BRIEF_DEV_AUTH = "0";
process.env.BRIEF_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "brief-ekinds-"));

const { store } = await import("../src/store.js");
const auth = await import("../src/domain/auth.js");
const errands = await import("../src/domain/errands.js");

let count = 0;
const test = async (name, fn) => { await fn(); count++; console.log("PASS " + name); };

const poster = auth.createUser({ handle: "ek_poster", password: "a good passphrase" });
const carrier = auth.createUser({ handle: "ek_carrier", password: "a good passphrase" });
const base = { actorId: poster.id, pickup: "Kikuyu market", dropoff: "Westlands, Bishops Court" };

await test("the kinds are data on the domain, not a UI list", () => {
  assert.ok(Array.isArray(errands.ERRAND_KINDS) && errands.ERRAND_KINDS.length === 6);
  for (const k of errands.ERRAND_KINDS) {
    assert.ok(k.id && /^[a-z_]+$/.test(k.id), `${k.id} needs a slug id`);
    assert.ok(k.label?.trim().length > 2 && k.blurb?.trim().length > 3, `${k.id} carries words a person reads`);
  }
  assert.deepEqual(errands.ERRAND_KIND_IDS, errands.ERRAND_KINDS.map((k) => k.id));
  assert.equal(errands.kindLabel("delivery"), "Delivery");
  assert.equal(errands.kindLabel(null), null, "no kind is not a kind");
});

await test("posting with a kind stores it and reads back labelled", () => {
  const out = errands.postErrand({ ...base, what: "Two crates of tomatoes", kind: "delivery" });
  assert.equal(out.errand.kind, "delivery");
  const view = errands.errandView(out.errand);
  assert.deepEqual([view.kind, view.kindLabel], ["delivery", "Delivery"]);
});

await test("kind is optional, and blank is stored as blank — not 'other'", () => {
  for (const blank of [undefined, null, "", "   "]) {
    const out = errands.postErrand({ ...base, what: "Collect the parcel from the baraka", kind: blank });
    assert.equal(out.errand.kind, null, `blank (${JSON.stringify(blank)}) must stay unlabelled`);
  }
  const other = errands.postErrand({ ...base, what: "Hold my place in the queue", kind: "other" });
  assert.equal(other.errand.kind, "other", "an explicit 'other' is a real answer");
});

await test("an unknown kind is refused with the list, not coerced", () => {
  const bad = errands.postErrand({ ...base, what: "Something unusual", kind: "gambling" });
  assert.equal(typeof bad.error, "string", "postErrand answers with a refusal, it does not throw or half-write");
  assert.match(bad.error, /kind must be one of delivery, pickup, food, skilled, care, other — or left blank/);
  assert.match(bad.error, /left blank/, "and it says the blank is allowed");
  assert.equal(bad.status, 400);
  // store.find answers null for "no row" — asserted as it actually behaves,
  // because a refusal that quietly wrote a row is the failure worth catching.
  assert.equal(store.find("errands", (e) => e.what === "Something unusual"), null, "nothing was written");
});

await test("the board filters on the stored value, and 'any' shows everything", () => {
  errands.postErrand({ ...base, what: "Hot githeri for four", kind: "food" });
  const all = errands.listErrands({ status: "open" });
  const food = errands.listErrands({ status: "open", kind: "food" });
  const any = errands.listErrands({ status: "open", kind: "any" });
  assert.ok(food.length >= 1 && food.every((e) => e.kind === "food"), "the filter returns only that kind");
  assert.equal(any.length, all.length, '"any" is the whole board, unlabelled rows included');
  assert.ok(all.some((e) => e.kind === null), "a row nobody labelled is still on the board, not hidden");
  assert.deepEqual(errands.listErrands({ kind: "invented" }), [], "an unknown filter yields nothing, not everything");
});

await test("no fabricated numbers ride the tiles", () => {
  const json = JSON.stringify(errands.ERRAND_KINDS);
  assert.ok(!/"count"|"total"|"open"|"zero"/.test(json), "a kind carries an id, a label and a blurb, nothing else");
  for (const k of errands.ERRAND_KINDS) assert.equal(Object.keys(k).sort().join(","), "blurb,id,label");
});

await test("HTTP: the taxonomy is served and the query filters", async () => {
  const { default: app } = await import("../src/index.js");
  const srv = app.listen(0);
  const port = srv.address().port;
  const tok = auth.issueSession(poster.id).token;
  const call = async (p) => {
    const r = await fetch(`http://127.0.0.1:${port}${p}`, { headers: { authorization: `Bearer ${tok}` } });
    return { status: r.status, body: await r.json().catch(() => null) };
  };
  const list = await call("/api/errands");
  assert.equal(list.status, 200);
  assert.equal(list.body.kinds.length, 6, "the client reads the kinds from the server");
  assert.equal(list.body.filtered, false, "an unfiltered board says so");
  const filtered = await call("/api/errands?kind=food");
  assert.equal(filtered.body.filtered, true);
  assert.ok(filtered.body.open.every((e) => e.kind === "food"));
  assert.ok(filtered.body.open.length < list.body.open.length, "the filter actually removed rows");
  const post = await fetch(`http://127.0.0.1:${port}/api/errands`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${tok}` },
    body: JSON.stringify({ what: "A cake for the birthday", pickup: "Nairobi West", dropoff: "Langata", kind: "not-a-kind" })
  });
  assert.equal(post.status, 400, "the refusal is the API's answer, not the client's job");
  const msg = await post.json();
  assert.match(msg.error, /kind must be one of/);
  const okPost = await fetch(`http://127.0.0.1:${port}/api/errands`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${tok}` },
    body: JSON.stringify({ what: "A cake for the birthday", pickup: "Nairobi West", dropoff: "Langata", kind: "  FOOD  " })
  });
  const saved = await okPost.json();
  assert.equal(saved.errand.kind, "food", "case and padding are normalised, the answer is kept");
  srv.close();
});

await test("an existing row keeps working: no backfill, no invented default", () => {
  // Rows written before this field existed have no `kind` at all. They must read
  // as unlabelled rather than being silently filed somewhere to look tidy.
  store.insert("errands", {
    id: "erd_legacy", posterId: poster.id, what: "Legacy errand with no kind field",
    pickup: "Ruaraka", dropoff: "Eastleigh", status: "open", createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(), history: []
  });
  const row = store.find("errands", (e) => e.id === "erd_legacy");
  assert.ok(row.kind === undefined || row.kind === null, "the row really has no value to inherit");
  const view = errands.errandView(row);
  assert.equal(view.kind, null);
  assert.equal(view.kindLabel, null, "and it is reported as none, not as a guess");
  assert.ok(errands.listErrands({ status: "open" }).some((e) => e.id === "erd_legacy"), "it is still on the board");
});

console.log(`PASSED ${count} FAILED 0`);
