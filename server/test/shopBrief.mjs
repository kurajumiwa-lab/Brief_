// ---------------------------------------------------------------------------
// THE MORNING BRIEF — one day of a business, and every figure in it re-added by
// hand from the rows.
//
// This is the read an owner is told is the truth, so these tests are mostly
// arithmetic and mostly refusals:
//
//   * the day a sale belongs to is the day the ORDER's own history says it
//     moved — not the day it was placed, and not the day somebody read it;
//   * a business with two spaces splits its money, and the order no space can
//     claim is counted once, for the shop, and NAMED (`spaceMoneyScope.mjs`
//     killed the same bug one level down, where a dashboard would have
//     multiplied it across every space);
//   * the shelf flag exists only because `stockChanges` rows exist (see
//     stockLog.mjs), and it fires on a comparison of counts — not on a
//     "declared stock" field or an `expectedRemaining` this store has never had;
//   * nothing is printed for a quiet day, nothing is sent at an hour the owner
//     did not name, and no name is printed for a person no user row describes.
//
// Every test builds its OWN shop, so every number asserted here is exact rather
// than "at least".
// ---------------------------------------------------------------------------
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";

process.env.NODE_ENV = "test";
process.env.BRIEF_DEV_AUTH = "0";
process.env.BRIEF_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "brief-brief-"));

const { store } = await import("../src/store.js");
const auth = await import("../src/domain/auth.js");
const vendors = await import("../src/domain/vendor.js");
const listings = await import("../src/domain/listing.js");
const orders = await import("../src/domain/order.js");
const spaces = await import("../src/domain/space.js");
const audience = await import("../src/domain/spaceAudience.js");
const notifications = await import("../src/domain/notifications.js");
const brief = await import("../src/domain/shopBrief.js");
const { dayBucket } = await import("../src/dayBoundary.js");

let count = 0;
const test = async (name, fn) => { await fn(); count++; console.log("PASS " + name); };

const DAY = "2026-09-20";          // a Sunday, and the day these briefs are about
const NEXT = "2026-09-21";
const at = (day, hhmm) => `${day}T${hhmm}:00.000Z`;
/** 03:00 UTC is 06:00 in Nairobi: the morning the brief is read at. */
const MORNING = new Date(at(NEXT, "03:00"));

const TODAY = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Africa/Nairobi", year: "numeric", month: "2-digit", day: "2-digit"
}).format(new Date());

let seq = 0;
const handle = (p) => `${p}${++seq}`;

/** A shop of one's own: owner, buyer, vendor, and the named spaces. */
function shop({ name = "Testshop", spaceNames = ["Counter", "Bulk book"] } = {}) {
  const owner = auth.createUser({ handle: handle("own"), password: "a good passphrase" });
  const buyer = auth.createUser({ handle: handle("buy"), password: "a good passphrase" });
  const vendor = vendors.createVendor({ ownerId: owner.id, displayName: name });
  const made = spaceNames.map((n) => {
    const sp = spaces.createSpace({ ownerId: owner.id, name: n, type: "business" });
    store.update("spaces", sp.id, { vendorId: vendor.id });
    return sp;
  });
  const s = {
    owner, buyer, vendor,
    spaces: made,
    space: (i = 0) => made[i],
    read: (day = DAY, now = MORNING) => brief.shopBriefForOwner(owner.id, { day, now }),
    /** A stock-tracked offer of this shop, filed under `space` (or nowhere). */
    offer(space, price, { title = `Loaf ${price}`, stock = null } = {}) {
      const l = listings.createListing({ vendorId: vendor.id, title, price, currency: "KES", quantityAvailable: stock });
      if (space) store.update("listings", l.id, { spaceId: space.id });
      listings.transitionListing(l.id, "active");
      return listings.getListing(l.id);
    },
    /** A sale against it, moved into the counted set and stamped onto a day
     *  exactly the way the order rail writes those fields. */
    soldOn(l, day, { qty = 1, place = "06:00", mark = "15:00" } = {}) {
      const o = orders.createOrder({ listingId: l.id, buyerId: buyer.id, quantity: qty });
      const row = store.find("orders", (x) => x.id === o.id);
      store.update("orders", o.id, {
        status: "fulfilled",
        fulfilledAt: at(day, mark),
        total: row.total,
        createdAt: at(day, place),
        history: [
          { status: "ordered", at: at(day, place) },
          { status: "fulfilled", at: at(day, mark) }
        ]
      });
      return store.find("orders", (x) => x.id === o.id);
    },
    /** A sale, dated onto `day` along with the shelf rows it wrote, so the day
     *  being read is coherent: an order taken and units off the count, no
     *  marking. This is the shape a shopkeeper's morning actually looks like. */
    soldOnShelf(l, day, qty = 1) {
      const o = orders.createOrder({ listingId: l.id, buyerId: buyer.id, quantity: qty });
      store.update("orders", o.id, {
        createdAt: at(day, "08:00"),
        history: [{ status: "ordered", at: at(day, "08:00") }]
      });
      for (const r of store.all("stockChanges").filter((x) => x.listingId === l.id)) {
        store.update("stockChanges", r.id, { at: at(day, "08:00") });
      }
      return store.find("orders", (x) => x.id === o.id);
    },
    /** Backdate every shelf row of one offer to the read day. */
    shelfDay(l, day, hhmm = "08:00") {
      for (const r of store.all("stockChanges").filter((x) => x.listingId === l.id)) {
        store.update("stockChanges", r.id, { at: at(day, hhmm) });
      }
    }
  };
  return s;
}

// ---------------------------------------------------------------------------
// the shape of the read
// ---------------------------------------------------------------------------
await test("a business with no space is not a business that sold nothing", () => {
  const s = shop({ spaceNames: [] });
  const out = s.read();
  assert.equal(out.reason, "no_spaces");
  assert.equal(out.empty, true);
  assert.equal(out.money, null, "no figures at all — a 0 here would be a claim about sales");
  assert.equal(out.orders, null);
  assert.equal(out.views, null);
  assert.deepEqual(out.flags, [], "and nothing to flag");
  assert.equal(out.stored, false, "which is also the answer to “where is the brief row saved?” — nowhere");
});

await test("the money belongs to the day the order says it moved", () => {
  const s = shop();
  s.soldOn(s.offer(s.space(0), 1500), DAY);
  const out = s.read();
  assert.equal(out.orders.marked, 1);
  assert.equal(out.money.inKes, 1500, `the figure is the order's own total, got ${out.money.inKes}`);
  const before = s.read("2026-09-19");
  assert.equal(before.orders.placed, 0, "the day before saw nothing, because nothing happened");
  assert.equal(before.empty, true, "and it is reported as a quiet day, not as a day of sales equal to zero");
});

await test("an order placed one day and marked in the next is in the second day only", () => {
  const s = shop();
  const l = s.offer(s.space(1), 900);
  const o = orders.createOrder({ listingId: l.id, buyerId: s.buyer.id, quantity: 1 });
  store.update("orders", o.id, {
    createdAt: at("2026-09-19", "08:00"),
    history: [{ status: "ordered", at: at("2026-09-19", "08:00") }]
  });
  orders.transitionOrder(o.id, "fulfilled");                  // the move happens now
  const placedDay = s.read("2026-09-19");
  assert.equal(placedDay.orders.placed, 1, "the placing day counts an order taken");
  assert.equal(placedDay.money.inKes, 0, "and no money, because nothing was marked in on its say-so");
  const movedDay = s.read(TODAY, new Date());
  assert.equal(movedDay.orders.marked, 1, "the marking day sees it");
  assert.equal(movedDay.money.inKes, 900, "and carries its amount");
  assert.equal(movedDay.spaces.find((x) => x.name === "Bulk book").money.inKes, 900,
    "on the space the offer is filed under — not on the counter next door");
});

await test("a day with nothing in it is not a page of zeros", () => {
  const s = shop();
  const out = s.read("2026-01-04");
  assert.equal(out.empty, true);
  assert.equal(out.reason, "quiet_day");
  assert.deepEqual(out.flags, []);
  assert.deepEqual(out.spaces, [], "no space lines, because no space had a row");
  assert.deepEqual(out.quietSpaces, ["Counter", "Bulk book"], "and the names of the quiet ones are given");
  assert.equal(out.dayLabel, brief.dayLabel("2026-01-04"), "the day is named through the app's own rule");
  assert.equal(out.money.inKes, 0, "the zeroes that do appear are counts of rows, which is the one thing allowed");
});

await test("asked for a day that has not arrived, it refuses instead of projecting", () => {
  const s = shop();
  assert.throws(() => s.read("2030-01-01", new Date(at(NEXT, "03:00"))), /has not arrived/);
  assert.throws(() => s.read("yesterday"), /real calendar date/);
  assert.throws(() => s.read("2026-02-30"), /real calendar date/);
  assert.throws(() => s.read("2026-9-2"), /real calendar date/);
});

// ---------------------------------------------------------------------------
// the money, and who it belongs to
// ---------------------------------------------------------------------------
await test("two spaces split the day, and the order no space claims is named", () => {
  const s = shop();
  s.soldOn(s.offer(s.space(0), 1500), DAY);
  s.soldOn(s.offer(s.space(1), 2000), DAY);
  s.soldOn(s.offer(null, 340), DAY);

  const out = s.read();
  assert.equal(out.orders.marked, 3, "three orders moved, counted once each at the top");
  assert.equal(out.money.inKes, 3840, `1500 + 2000 + 340, got ${out.money.inKes}`);

  const byName = Object.fromEntries(out.spaces.map((x) => [x.name, x]));
  assert.equal(byName.Counter.money.inKes, 1500, "the counter's line is the counter's money");
  assert.equal(byName["Bulk book"].money.inKes, 2000, "and the bulk book's is the bulk book's");
  assert.equal(byName.Counter.scope, "this space only", "each line says what it covers");

  assert.equal(out.unassigned.orders, 1, "the third order is reported, not absorbed");
  assert.equal(out.unassigned.inKes, 340);
  const addsUp = out.spaces.reduce((n, x) => n + x.money.inKes, 0) + out.unassigned.inKes;
  assert.equal(addsUp, out.money.inKes, "the parts add to the whole, which is the whole point");

  const flag = out.flags.find((f) => f.kind === "money_unattributed");
  assert.ok(flag, "and a flag says it out loud");
  assert.ok(flag.message.includes(brief.formatKes(340)), `carrying the figure: ${flag.message}`);
  assert.equal(flag.evidenceIds.length, 1, "pointing at the order row");
});

await test("a sole space folds the unfiled offer in, and says that is what it did", () => {
  const s = shop({ name: "One Duka", spaceNames: ["Shelf"] });
  s.soldOn(s.offer(null, 40, { title: "Chapo" }), DAY);
  const out = s.read();
  assert.equal(out.unassigned.orders, 0, "with one space there is nothing it could be confused with");
  assert.equal(out.spaces.length, 1);
  assert.equal(out.spaces[0].money.inKes, 40);
  assert.equal(out.spaces[0].scope, "sole space of this business", "and the line admits the reason");
  assert.equal(out.flags.some((f) => f.kind === "money_unattributed"), false, "so there is nothing to ask");
});

await test("a 15:40 UTC sale is the 20th in Nairobi and the 21st in London", () => {
  const s = shop();
  // 2026-09-20T21:40:00Z is 2026-09-21T00:40 in Nairobi: a Monday's trade.
  const l = s.offer(s.space(0), 250);
  const o = s.soldOn(l, DAY, { place: "21:30", mark: "21:40" });
  store.update("orders", o.id, {
    createdAt: "2026-09-20T21:30:00.000Z",
    fulfilledAt: "2026-09-21T00:40:00.000Z",
    history: [
      { status: "ordered", at: "2026-09-20T21:30:00.000Z" },
      { status: "fulfilled", at: "2026-09-21T00:40:00.000Z" }
    ]
  });
  assert.equal(dayBucket("2026-09-21T00:40:00.000Z"), "2026-09-21", "the shared day rule puts it on Monday");
  assert.equal(s.read(DAY).money.inKes, 0, "so Sunday's brief does not carry it");
  assert.equal(s.read("2026-09-21", new Date("2026-09-21T06:00:00.000Z")).money.inKes, 250,
    "and Monday's does, read at 09:00 local");
});

await test("an order marked paid with no timestamp anywhere is counted nowhere, and said", () => {
  const s = shop();
  const l = s.offer(s.space(0), 999, { title: "Unstamped sale" });
  const o = orders.createOrder({ listingId: l.id, buyerId: s.buyer.id, quantity: 1 });
  store.update("orders", o.id, {
    status: "fulfilled", fulfilledAt: null, settledAt: null,
    createdAt: at(DAY, "06:00"), history: [{ status: "ordered", at: at(DAY, "06:00") }]
  });
  const out = s.read();
  assert.equal(out.orders.unstamped, 1, "the brief counts the fact that it could not date this row");
  assert.equal(out.money.inKes, 0, "and the amount does not enter the day on a guess");
  assert.equal(out.orders.placed, 1, "it is still counted as placed, because that stamp does exist");
  assert.equal(out.empty, false, "so the day is not called quiet: something happened, it has no date on it");
});

await test("a cancellation that day is printed, and a day of only that is not quiet", () => {
  const s = shop();
  const l = s.offer(s.space(1), 500, { title: "Returnable crate" });
  const o = orders.createOrder({ listingId: l.id, buyerId: s.buyer.id, quantity: 1 });
  orders.transitionOrder(o.id, "cancelled");
  store.update("orders", o.id, {
    createdAt: at(DAY, "07:00"),
    history: [{ status: "ordered", at: at(DAY, "07:00") }, { status: "cancelled", at: at(DAY, "07:30") }]
  });
  const out = s.read();
  assert.equal(out.orders.cancelled, 1, "the one status change a shopkeeper has a reason not to mention");
  assert.equal(out.orders.placed, 1);
  assert.equal(out.money.inKes, 0, "and it is not counted as money in");
  assert.equal(out.empty, false);
});

await test("an order left open before the day is aged, and names the oldest row", () => {
  const s = shop();
  const l = s.offer(s.space(0), 800, { title: "Tray cake" });
  const o = orders.createOrder({ listingId: l.id, buyerId: s.buyer.id, quantity: 1 });
  store.update("orders", o.id, { createdAt: at("2026-09-18", "12:00") });
  const out = s.read();
  assert.equal(out.orders.aged, 1);
  assert.equal(out.orders.open, 1, "open and aged are different questions and both are answered");
  const flag = out.flags.find((f) => f.kind === "orders_aged");
  assert.ok(flag);
  assert.equal(flag.evidenceIds[0], o.id, "and the flag points at the order row");
  assert.match(flag.message, /still open$/);
  assert.ok(!/overdue since|you should|chase/.test(flag.message + flag.detail), "it reports, it does not advise");
});

await test("money marked in with nothing recorded out is asked about, not accused", () => {
  const s = shop();
  s.soldOn(s.offer(s.space(0), 1240), DAY);
  const out = s.read();
  const flag = out.flags.find((f) => f.kind === "outflow_unrecorded");
  assert.ok(flag, "this day has marked-in money and no expense rows");
  assert.match(flag.message, /KES 1,240 marked in, and nothing was recorded out/);
  assert.match(flag.detail, /does not accuse/);
  assert.equal(out.money.outKes, 0, "0 is allowed here: it is the true count of expense rows");
  assert.equal(out.money.netKes, 1240);
  assert.match(out.basis.net, /not profit/, "and the read itself refuses the word profit");
  assert.equal(out.money.railSettledKes, null, "and no money is claimed to have settled through a rail");

  // Recording one expense answers the question and clears the flag.
  spaces.recordSpaceExpense({
    spaceId: s.space(0).id, category: "supplies", description: "Flour sacks",
    amountKes: 400, date: DAY, callerId: s.owner.id
  });
  const after = s.read();
  assert.equal(after.money.outKes, 400);
  assert.match(after.basis.out, /nothing is imported/);
  assert.equal(after.spaces.find((x) => x.name === "Counter").money.outKes, 400);
  assert.equal(after.money.netKes, 840);
  assert.equal(after.flags.some((f) => f.kind === "outflow_unrecorded"), false, "the question is answered");
});

await test("an expense is counted on the day it was dated, not the day it was typed", () => {
  const s = shop();
  s.soldOn(s.offer(s.space(0), 700), DAY);
  spaces.recordSpaceExpense({
    spaceId: s.space(0).id, category: "supplies", description: "Backdated sacks",
    amountKes: 100, date: "2026-09-18", callerId: s.owner.id
  });
  assert.equal(s.read("2026-09-18").money.outKes, 100, "it lands on the 18th");
  assert.equal(s.read(DAY).money.outKes, 0, "and not on the day the button was pressed");
});

// ---------------------------------------------------------------------------
// the shelf
// ---------------------------------------------------------------------------
await test("the shelf flag fires when the count ends above what the sales leave", () => {
  const s = shop();
  const l = s.offer(s.space(0), 120, { title: "Maize flour 2kg", stock: 10 });
  for (let i = 0; i < 4; i++) s.soldOnShelf(l, DAY);
  listings.updateListing(l.id, { quantityAvailable: 10 }, { actorId: s.owner.id });
  s.shelfDay(l, DAY, "17:04");

  const out = s.read();
  assert.equal(out.empty, false, "a shelf row is a row for the day");
  const flag = out.flags.find((f) => f.kind === "stock_recount");
  assert.ok(flag, "4 sold and the count back at 10: that is asked about");
  assert.equal(out.orders.placed, 4, "the four sales are there too, as counts");
  assert.equal(flag.direction, "up");
  assert.deepEqual(flag.counts, { start: 10, sold: 4, allowed: 6, end: 10, gap: 4 });
  assert.ok(flag.message.includes("Maize flour 2kg"), `it names the offer: ${flag.message}`);
  assert.match(flag.detail, /restock looks exactly like this/, "and it concedes a restock cannot be told apart");
  // The row was written at 17:04 UTC, which the brief prints as a Nairobi clock:
  // 20:04. A brief that showed the server's zone would be an hour-and-a-half
  // argument with the owner's own watch.
  assert.match(flag.detail, /typed by you at 20:04/, "naming the actor and the time the edit row carries, in EAT");
  assert.equal(flag.evidenceIds.length, 5, "four sale rows and the edit row, once each");
  assert.equal(new Set(flag.evidenceIds).size, 5, "and no id is repeated to make the pile look bigger");
  assert.equal(flag.orderIds.length, 4, "the four orders are named as orders, separately");
  assert.equal(flag.spaceName, "Counter", "against the space it sits in");
});

await test("no flag when the count went down by exactly what was sold", () => {
  const s = shop();
  const l = s.offer(s.space(0), 60, { title: "Sugar 1kg", stock: 10 });
  for (let i = 0; i < 4; i++) s.soldOnShelf(l, DAY);
  s.shelfDay(l, DAY, "09:00");
  const out = s.read();
  assert.deepEqual(out.flags, [], "the shelf and the sales agree, so the brief has nothing to say");
  assert.equal(out.empty, false, "and the day is not called quiet: four orders were taken");
  assert.equal(out.orders.placed, 4);
  assert.equal(out.money.inKes, 0, "with nothing marked in, because nothing was marked");
  assert.equal(store.find("listings", (x) => x.id === l.id).quantityAvailable, 6);
});

await test("a count that fell below the sales is its own flag, in the other direction", () => {
  const s = shop();
  const l = s.offer(s.space(1), 60, { title: "Rice 5kg", stock: 10 });
  s.soldOnShelf(l, DAY, 2);
  listings.updateListing(l.id, { quantityAvailable: 5 }, { actorId: s.owner.id });
  s.shelfDay(l, DAY, "10:00");
  const flag = s.read().flags.find((f) => f.kind === "stock_recount");
  assert.ok(flag, "3 units left the shelf with no order behind them");
  assert.equal(flag.direction, "down");
  assert.equal(flag.counts.gap, -3);
  assert.match(flag.detail, /write-off looks exactly like this/);
});

await test("a shelf with no starting count is unmeasurable, and is not a zero", () => {
  const s = shop();
  const l = s.offer(s.space(1), 300, { title: "Broom", stock: null });
  listings.updateListing(l.id, { quantityAvailable: 12 }, { actorId: s.owner.id });
  s.soldOnShelf(l, DAY, 4);
  s.shelfDay(l, DAY, "11:00");
  const out = s.read();
  assert.equal(out.flags.some((f) => f.kind === "stock_recount"), false,
    "the day's first row had no `from`, so the arithmetic has an unknown in it and the brief keeps quiet");
});

await test("an untracked offer whose orders exceed it is not a stock story at all", () => {
  const s = shop();
  const l = s.offer(s.space(0), 250, { title: "Custom cake", stock: null });
  s.soldOn(l, DAY, { qty: 3 });
  const out = s.read();
  assert.deepEqual(out.flags.map((f) => f.kind), ["outflow_unrecorded"],
    "the money question is real, and it is the ONLY one this day raises");
  assert.equal(out.orders.placed, 1, "the sale is counted as an order taken");
  assert.equal(out.money.inKes, 750, "and as money marked in");
  assert.equal(store.all("stockChanges").filter((r) => r.listingId === l.id).length, 0,
    "a service-like offer has no shelf to log, and no flag is manufactured for it");
});

// ---------------------------------------------------------------------------
// people, and the public face
// ---------------------------------------------------------------------------
await test("who wrote something: a name only when a user row has one", () => {
  const s = shop();
  const act = spaces.recordSpaceActivity({
    spaceId: s.space(0).id, kind: "quote_sent", title: "Sent a quote", actorId: s.owner.id
  });
  // The rail stamps its own time, so the fixture moves it back to the day the
  // brief is being read for — the same row, an earlier morning.
  store.update("spaceActivities", act.id, { createdAt: at(DAY, "13:00") });
  store.insert("spaceActivities", {
    id: "act_ghost", spaceId: s.space(0).id, kind: "message_sent", title: "Answered a customer",
    actorId: "usr_ghost", metadata: {}, createdAt: at(DAY, "14:00")
  });
  const people = s.read().people;
  const me = people.find((p) => p.actorId === s.owner.id);
  assert.ok(me, "the owner's rows are attributed to the owner");
  assert.equal(me.isOwner, true);
  assert.equal(me.name, s.owner.handle, "read off the user row, never guessed from a phone number");
  assert.deepEqual(me.kinds, ["quote_sent"], "and what they did is the kind the row carries");
  const ghost = people.find((p) => p.actorId === "usr_ghost");
  assert.equal(ghost.name, null, "a person with no user row has no name printed");
  assert.equal(ghost.actions, 1);
  assert.ok(people.every((p) => /^\d{2}:\d{2}$/.test(p.lastClock)), "and every time is a Nairobi clock");
  const noFlags = people.filter((p) => p.name === null);
  assert.equal(noFlags.length, 1, "so the honest gap is a null, not an invented 'Grace'");
});

await test("no schedule exists, so nobody is ever reported absent", () => {
  const s = shop();
  const out = s.read();
  assert.equal(out.people.length, 0, "a day with no activity rows has no staff section");
  assert.ok(!out.flags.some((f) => /absent|scheduled|no activity logged/i.test(f.message)),
    "and the 'Grace was scheduled Monday' flag is not built, because nothing stores a rota");
});

await test("views are page opens, and the owner's own opens are left out", () => {
  const s = shop();
  store.update("spaces", s.space(0).id, { visibility: "public", status: "active" });
  const visitor = auth.createUser({ handle: handle("visit"), password: "a good passphrase" });
  audience.recordView(s.space(0).id, { viewerId: s.buyer.id });
  audience.recordView(s.space(0).id, { viewerId: visitor.id });
  audience.recordView(s.space(0).id, { viewerId: s.owner.id });
  for (const sig of store.all("signals").filter((x) => x.type === "space_viewed")) {
    store.update("signals", sig.id, { createdAt: at(DAY, "12:00") });
  }
  const out = s.read();
  assert.equal(out.views.count, 2, `two strangers, got ${out.views.count}`);
  assert.equal(out.views.ownOpensExcluded, 1, "and the exclusion is stated rather than invisible");
  assert.equal(out.spaces.find((x) => x.name === "Counter").views, 2, "on the space that was looked at");
  assert.match(out.basis.views, /your own opens are left out/);
});

await test("a private space's API reads are not views", () => {
  const s = shop();
  assert.equal(s.read().views.count, 0, "nothing was public, so nothing was opened");
});

// ---------------------------------------------------------------------------
// the arithmetic, checked against the rows by a second pair of hands
// ---------------------------------------------------------------------------
await test("every figure the brief prints can be re-added from the rows", () => {
  const s = shop();
  s.soldOn(s.offer(s.space(0), 1500), DAY);
  s.soldOn(s.offer(s.space(1), 2000), DAY);
  s.soldOn(s.offer(null, 340), DAY);
  s.soldOn(s.offer(s.space(0), 90), DAY, { qty: 2 });     // 180
  spaces.recordSpaceExpense({
    spaceId: s.space(1).id, category: "transport", description: "Matangi",
    amountKes: 260, date: DAY, callerId: s.owner.id
  });

  const spaceIds = new Set(store.filter("spaces", (x) => x.ownerId === s.owner.id).map((x) => x.id));
  const mine = store.all("orders").filter((o) => o.vendorOwnerId === s.owner.id
    || o.vendorId === s.vendor.id || (o.spaceId && spaceIds.has(o.spaceId)));
  const inSum = mine.reduce((n, o) => {
    const entry = (o.history ?? []).find((h) => ["paid", "completed", "settled", "fulfilled"].includes(h.status));
    const when = entry?.at ?? o.settledAt ?? o.fulfilledAt ?? null;
    return when && dayBucket(when) === DAY ? n + (Number(o.total) || 0) : n;
  }, 0);
  const outSum = store.all("spaceExpenses")
    .filter((e) => spaceIds.has(e.spaceId) && (e.date || dayBucket(e.createdAt)) === DAY)
    .reduce((n, e) => n + (Number(e.amountKes) || 0), 0);

  const out = s.read();
  assert.equal(inSum, 1500 + 2000 + 340 + 180, "the hand sum, added here before it is compared to anything");
  assert.equal(outSum, 260);
  assert.equal(out.money.inKes, inSum, `the brief's in (${out.money.inKes}) is the rows' sum (${inSum})`);
  assert.equal(out.money.outKes, outSum);
  assert.equal(out.money.netKes, inSum - outSum);
  assert.equal(out.orders.placed, mine.filter((o) => dayBucket(o.createdAt) === DAY).length,
    "and the count of orders placed is a count, not a story");
  assert.equal(out.orders.marked, 4);
});

await test("nothing in the brief ranks, averages, benchmarks or advises", () => {
  const s = shop();
  s.soldOn(s.offer(s.space(0), 1500), DAY);
  s.soldOn(s.offer(s.space(1), 2000), DAY);
  const json = JSON.stringify(s.read()).toLowerCase();
  for (const banned of ["rank", "tier", "badge", "streak", "leaderboard", "top ", "trending",
    "benchmark", "average", "sector", "you should", "recommend", "verified", "rating", "urgent", "don't miss"]) {
    assert.ok(!json.includes(banned), `"${banned}" has no business in a brief`);
  }
});

// ---------------------------------------------------------------------------
// the morning delivery
// ---------------------------------------------------------------------------
await test("no hour is stored, and no brief is sent, before the owner picks one", () => {
  const s = shop();
  const prefs = brief.getBriefPrefs(s.owner.id);
  assert.equal(prefs.enabled, false, "the default is OFF: the app does not announce a time nobody chose");
  assert.equal(prefs.hour, null, "and there is no stored 6am in a row that was never written");
  assert.throws(() => brief.setBriefPrefs(s.owner.id, { enabled: true }), /hour you want it at/);
  assert.throws(() => brief.setBriefPrefs(s.owner.id, { enabled: true, hour: 24 }), /Nairobi time/);
  assert.throws(() => brief.setBriefPrefs(s.owner.id, { enabled: true, hour: "half past five" }), /Nairobi time/);
  const on = brief.setBriefPrefs(s.owner.id, { enabled: true, hour: 7 });
  assert.equal(on.hour, 7);
  assert.equal(on.hourLabel, "07:00 in Nairobi time", "the label names the zone, because '7' alone does not");
  const off = brief.setBriefPrefs(s.owner.id, { enabled: false });
  assert.equal(off.enabled, false);
  assert.equal(off.hour, null, "switching it off forgets the hour too — nothing is kept against an opted-out owner");
});

await test("the sweep waits for the hour the owner named, then sends once", () => {
  const s = shop({ name: "Kariokor Groceries" });
  s.soldOn(s.offer(s.space(0), 1500), DAY);
  brief.setBriefPrefs(s.owner.id, { enabled: true, hour: 6 });
  const mine = () => store.filter("notifications", (n) => n.userId === s.owner.id);

  const early = brief.morningSweep({ now: new Date(at(NEXT, "02:59")) });
  assert.equal(early.sent, 0, "02:59 UTC is 05:59 in Nairobi, and 06:00 has not come");
  assert.equal(early.notYet, 1, "the sweep counted it as not-yet rather than skipping it silently");
  assert.equal(mine().length, 0, "so nothing was sent");

  const ran = brief.morningSweep({ now: new Date(at(NEXT, "03:01")) });
  assert.equal(ran.sent, 1, `one brief, got ${JSON.stringify(ran)}`);
  const row = mine()[0];
  assert.equal(row.type, "shop_brief");
  assert.equal(row.dest, "shopbrief", "and tapping it has somewhere real to go");
  assert.equal(row.title, `Kariokor Groceries · ${brief.dayLabel(DAY)}`);
  const expected = brief.briefNotificationText(s.read());
  assert.equal(row.body, expected.body, "the notification carries the brief's own figures, not a paraphrase");
  assert.ok(row.body.includes(brief.formatKes(1500)), `the in figure is there: ${row.body}`);
  assert.ok(row.body.includes("marked in"), "and it says marked, because no rail settled anything");
  assert.equal(row.priority, "important", "flags were up, so it is not a quiet dot");

  const again = brief.morningSweep({ now: new Date(at(NEXT, "04:00")) });
  assert.equal(again.looked, 0, "once per day, however often the timer runs");
  assert.equal(mine().length, 1, "and no second row");
});

await test("an owner who never asked is never told, even on a busy day", () => {
  const s = shop();
  s.soldOn(s.offer(s.space(0), 4400), DAY);
  const before = store.all("notifications").length;
  const out = brief.morningSweep({ now: new Date(at(NEXT, "22:00")) });
  assert.equal(out.sent, 0, "a row for an owner who never opted in cannot exist");
  assert.equal(store.filter("notifications", (n) => n.userId === s.owner.id).length, 0);
  assert.equal(store.all("notifications").length, before);
});

await test("a quiet day sends nothing, and is not retried into the evening", () => {
  const s = shop({ name: "Shut Shop", spaceNames: ["Closed shelf"] });
  brief.setBriefPrefs(s.owner.id, { enabled: true, hour: 5 });
  const out = brief.morningSweep({ now: new Date(at(NEXT, "03:00")) });
  assert.equal(out.sent, 0, "the day had no rows, so the sweep noticed and said nothing");
  assert.equal(store.filter("notifications", (n) => n.userId === s.owner.id).length, 0);
  assert.equal(brief.getBriefPrefs(s.owner.id).lastBriefDay, NEXT, "and the day is marked read, so it stays quiet");
});

await test("a day is not marked sent when the owner's own alerts are off", () => {
  const s = shop();
  s.soldOn(s.offer(s.space(0), 600), DAY);
  brief.setBriefPrefs(s.owner.id, { enabled: true, hour: 6 });
  notifications.setPreferences(s.owner.id, { alerts: false });
  const out = brief.morningSweep({ now: new Date(at(NEXT, "03:30")) });
  assert.equal(out.blocked, 1, "notify() answered null, which is not a delivery");
  assert.equal(out.sent, 0);
  assert.equal(store.find("shopBriefPrefs", (p) => p.ownerId === s.owner.id).lastBriefDay, null,
    "so the day is still open: turning alerts back on is allowed to catch up");
  notifications.setPreferences(s.owner.id, { alerts: true });
  brief.morningSweep({ now: new Date(at(NEXT, "03:31")) });
  assert.equal(store.filter("notifications", (n) => n.userId === s.owner.id).length, 1,
    "and it did catch up, once");
});

// ---------------------------------------------------------------------------
// the doors
// ---------------------------------------------------------------------------
await test("the brief has no edit door, in the route file itself", () => {
  const src = fs.readFileSync(new URL("../src/routes/shopBrief.js", import.meta.url), "utf8");
  assert.match(src, /app\.get\(['"]\/api\/shop-brief['"]/);
  assert.equal((src.match(/app\.post\(/g) ?? []).length, 0, "a POST would let an owner edit the truth");
  assert.equal((src.match(/app\.patch\(/g) ?? []).length, 0);
  assert.equal((src.match(/app\.delete\(/g) ?? []).length, 0);
  assert.equal((src.match(/app\.put\(/g) ?? []).length, 1, "exactly one writable door, and it is the owner's own");
  assert.match(src, /app\.put\(['"]\/api\/shop-brief\/prefs['"]/);
});

await test("HTTP: the brief is the caller's own, its day is validated, and its prefs are theirs", async () => {
  const s = shop({ name: "HTTP Shop" });
  s.soldOn(s.offer(s.space(0), 1500), DAY);
  const { default: app } = await import("../src/index.js");
  const srv = app.listen(0);
  const port = srv.address().port;
  const call = async (p, method = "GET", body, tok) => {
    const r = await fetch(`http://127.0.0.1:${port}${p}`, {
      method,
      headers: { "content-type": "application/json", ...(tok ? { authorization: `Bearer ${tok}` } : {}) },
      body: body ? JSON.stringify(body) : undefined
    });
    return { status: r.status, body: await r.json().catch(() => null) };
  };
  const tok = auth.issueSession(s.owner.id).token;

  assert.equal((await call("/api/shop-brief")).status, 401, "no anonymous read of somebody's takings");
  const me = await call(`/api/shop-brief?day=${DAY}`, "GET", undefined, tok);
  assert.equal(me.status, 200);
  assert.equal(me.body.brief.day, DAY);
  assert.equal(me.body.brief.shop.name, "HTTP Shop");
  assert.equal(me.body.brief.money.inKes, 1500, "the figures are the caller's rows");
  assert.equal(me.body.brief.stored, false);

  const peeker = auth.createUser({ handle: handle("peek"), password: "a good passphrase" });
  const theirs = await call(`/api/shop-brief?day=${DAY}`, "GET", undefined, auth.issueSession(peeker.id).token);
  assert.equal(theirs.status, 200, "they get a brief too — their own");
  assert.equal(theirs.body.brief.money, null, "which contains none of HTTP Shop's money");
  assert.equal(theirs.body.brief.reason, "no_spaces", "and it says which kind of empty that is");

  assert.equal((await call("/api/shop-brief?day=2030-01-01", "GET", undefined, tok)).status, 400);
  assert.equal((await call("/api/shop-brief?day=nonsense", "GET", undefined, tok)).status, 400);
  const refusal = await call("/api/shop-brief?day=nonsense", "GET", undefined, tok);
  assert.match(refusal.body.error, /real calendar date/, "and the refusal is readable");

  const badHour = await call("/api/shop-brief/prefs", "PUT", { enabled: true, hour: 25 }, tok);
  assert.equal(badHour.status, 400);
  assert.match(badHour.body.error, /hour you want it at|Nairobi time/);
  const saved = await call("/api/shop-brief/prefs", "PUT", { enabled: true, hour: 7 }, tok);
  assert.equal(saved.status, 200);
  assert.equal(saved.body.prefs.hour, 7);
  const readBack = await call("/api/shop-brief/prefs", "GET", undefined, tok);
  assert.equal(readBack.body.prefs.enabled, true, "read back from the row, not from the request");
  assert.equal((await call("/api/shop-brief/prefs")).status, 401, "and not anybody's preference to read");
  srv.close();
});

console.log(`PASSED ${count} FAILED 0`);
