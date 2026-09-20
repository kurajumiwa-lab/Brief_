// ---------------------------------------------------------------------------
// SPACE MODES — one business, several arms, and no new owner of the facts.
//
// The ask was a "shop" parent above Spaces, so a bakery could hold a retail
// counter, a wholesale book and its own delivery arm. That parent already
// exists: the VENDOR owns the till, the ledger and the members, and a second
// table claiming the same ownership is how you end up with two answers to "how
// much did this shop take". So the mode is a field on the space row — a word the
// owner chooses about WHO A SPACE IS FOR — and nothing more. Five rules here:
//
//   * the taxonomy is server data, so a client cannot invent a seventh arm and
//     a directory cannot offer a filter that leads nowhere;
//   * no mode is a real state. An unmarked space reads as unstated, never as
//     "Retail" by default — that default would silently reclassify every shop
//     already in the tree;
//   * an unknown mode is refused with the list, not coerced into "other";
//   * a filter that cannot be honoured returns NOTHING, not everything with a
//     label on it;
//   * and a mode is never a ranking. Two spaces with different modes are
//     different rooms, not better and worse ones.
// ---------------------------------------------------------------------------
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";

process.env.NODE_ENV = "test";
process.env.BRIEF_DEV_AUTH = "0";
process.env.BRIEF_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "brief-modes-"));

const { store } = await import("../src/store.js");
const auth = await import("../src/domain/auth.js");
const spaces = await import("../src/domain/space.js");

let count = 0;
const test = async (name, fn) => { await fn(); count++; console.log("PASS " + name); };

const owner = auth.createUser({ handle: "sm_owner", password: "a good passphrase" });
const mk = (over = {}) => spaces.createSpace({
  ownerId: owner.id, name: over.name ?? "Testshop", type: "business", goal: "", ...over
});

await test("the modes are data on the domain, with words and no counts", () => {
  assert.ok(Array.isArray(spaces.SPACE_MODES) && spaces.SPACE_MODES.length === 6);
  for (const m of spaces.SPACE_MODES) {
    assert.ok(m.id && /^[a-z_]+$/.test(m.id), `${m.id} needs a slug id`);
    assert.ok(m.label?.trim().length > 2, `${m.id} carries a label a person reads`);
    assert.ok(m.blurb?.trim().length > 8, `${m.id} says who the arm is for`);
    // The point of the rule: a tile must not be able to print a zero as a
    // shopwindow. The server sends no count field at all.
    for (const banned of ["count", "orders", "offers", "revenue", "rank", "tier"]) {
      assert.ok(!(banned in m), `${m.id} must not carry ${banned}`);
    }
  }
  assert.deepEqual(spaces.SPACE_MODE_IDS, ["retail", "wholesale", "services", "training", "delivery", "other"]);
  assert.equal(spaces.modeLabel("wholesale"), "Wholesale", "the label comes from here, not from the client");
  assert.equal(spaces.modeLabel("nope"), null, "an unknown id has no label, and no fake one");
  assert.equal(spaces.modeLabel(null), null, "and unstated stays unstated");
});

await test("a space can be created as one arm of the business", () => {
  const s = mk({ name: "Testshop Retail", mode: "retail" });
  assert.equal(s.mode, "retail", "stored on the row");
  assert.equal(s.modeLabel, "Retail", "and the server's own word for it");
  const again = spaces.getSpace(s.id, { callerId: owner.id });
  assert.equal(again.mode, "retail", "read back from the row, not from the call");
});

await test("no mode is a real state, and never defaults to retail", () => {
  for (const blank of [undefined, null, "", "  "]) {
    const s = mk({ name: `Unstated ${String(blank)}`, mode: blank });
    assert.equal(s.mode, null, `${JSON.stringify(blank)} is not a mode`);
    assert.equal(s.modeLabel, null, "and there is no word to show");
  }
  // Nothing in the tree was rewritten to carry a label it never chose.
  const plain = mk({ name: "Plain" });
  const row = store.find("spaces", (x) => x.id === plain.id);
  assert.equal(row.mode ?? null, null, "the stored row agrees");
});

await test("an unknown mode is refused with the list, not filed under other", () => {
  let message = null;
  try { mk({ name: "Odd Shop", mode: "night_market" }); } catch (e) { message = e.message; }
  assert.ok(message, "creating with a bad mode throws");
  assert.match(message, /mode must be one of retail, wholesale, services, training, delivery, other — or left blank/);
  assert.equal(store.find("spaces", (x) => x.name === "Odd Shop"), null, "and nothing was written");
});

await test("the owner can move a space to another arm, or take the label off", () => {
  const s = mk({ name: "Testshop Bulk", mode: "retail" });
  const moved = spaces.updateSpace(s.id, { mode: "wholesale" }, { callerId: owner.id });
  assert.equal(moved.mode, "wholesale", "a changed arm is an ordinary edit");
  assert.equal(moved.modeLabel, "Wholesale");
  const cleared = spaces.updateSpace(s.id, { mode: null }, { callerId: owner.id });
  assert.equal(cleared.mode, null, "and clearing it is an ordinary edit too");
  assert.equal(cleared.modeLabel, null, "with no leftover label from the previous value");
  let bad = null;
  try { spaces.updateSpace(s.id, { mode: "premium" }, { callerId: owner.id }); } catch (e) { bad = e.message; }
  assert.match(bad ?? "", /mode must be one of/, "a bad PATCH is refused the same way");
  assert.equal(store.find("spaces", (x) => x.id === s.id).mode, null, "a refused PATCH wrote nothing");
});

await test("the owner's own list groups by mode, and an unknown filter is nothing", () => {
  mk({ name: "Counter", mode: "retail" });
  mk({ name: "Bulk book", mode: "wholesale" });
  mk({ name: "Moto boys", mode: "delivery" });
  mk({ name: "No label" });
  const all = spaces.listSpacesForOwner(owner.id);
  assert.ok(all.length >= 4, "everything they own, marked or not");
  assert.ok(all.some((s) => s.mode === null), "an unmarked space is not dropped from the owner's view");
  const bulk = spaces.listSpacesForOwner(owner.id, { mode: "wholesale" });
  assert.deepEqual(bulk.map((s) => s.name), ["Bulk book"], "one arm, exactly");
  assert.deepEqual(spaces.listSpacesForOwner(owner.id, { mode: "wholesale " }).map((s) => s.name), ["Bulk book"],
    "a stray space in the query is the same question");
  assert.deepEqual(spaces.listSpacesForOwner(owner.id, { mode: "not_a_mode" }), [],
    "a filter the server cannot honour returns nothing, never the whole list");
  assert.deepEqual(spaces.listSpacesForOwner("usr_nobody", { mode: "retail" }), [], "and never another owner's rows");
});

await test("the public directory can be narrowed to one arm", () => {
  const pub = mk({ name: "Public Retail", mode: "retail", visibility: "public" });
  mk({ name: "Public Bulk", mode: "wholesale", visibility: "public" });
  mk({ name: "Private Retail", mode: "retail", visibility: "private" });
  const view = spaces.publicSpaceView(store.find("spaces", (s) => s.id === pub.id));
  assert.equal(view.mode, "retail", "the arm is on the public card, because the owner declared it");
  assert.equal(view.modeLabel, "Retail");
  const all = spaces.listPublicSpaces();
  assert.equal(all.filter((s) => s.name.startsWith("Public ")).length, 2, "both public arms are listed");
  const retail = spaces.listPublicSpaces(50, { mode: "retail" });
  assert.deepEqual(retail.filter((s) => s.name.startsWith("Public ")).map((s) => s.name), ["Public Retail"],
    "and narrowing to one arm shows only that arm");
  assert.ok(!retail.some((s) => s.name === "Private Retail"), "a private space stays out on both reads");
  assert.deepEqual(spaces.listPublicSpaces(50, { mode: "unknown_arm" }), [],
    "an arm that does not exist has no shops, not all of them");
});

await test("a mode is a label, not a boost: the order is still recency", () => {
  const a = mk({ name: "Older Retail", mode: "wholesale", visibility: "public" });
  const b = mk({ name: "Newer Retail", mode: "retail", visibility: "public" });
  const list = spaces.listPublicSpaces(50, { mode: "retail" });
  assert.ok(list.some((s) => s.id === b.id), "the retail arm is there");
  assert.ok(!list.some((s) => s.id === a.id), "and the wholesale one is not, however new it is");
  const everything = spaces.listPublicSpaces(100);
  const ia = everything.findIndex((s) => s.id === a.id);
  const ib = everything.findIndex((s) => s.id === b.id);
  assert.ok(ib < ia, "the newest is first whether or not it says what arm it is");
  assert.ok(!("rank" in everything[0]) && !("score" in everything[0]), "and no rank or score is attached to any of them");
});

console.log(`PASSED ${count} FAILED 0`);
