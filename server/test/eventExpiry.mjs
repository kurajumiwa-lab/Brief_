// ---------------------------------------------------------------------------
// NATURAL EXPIRY — a dated event ends itself on the calendar, not on someone
// remembering to close it. Derived from endsAt: past events drop out of the
// browse/related/series "what's on" rails, the public view reports hasEnded,
// and the event stays resolvable by slug (someone still holds the link).
// ---------------------------------------------------------------------------

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
process.env.NODE_ENV = "test";
process.env.BRIEF_DEV_AUTH = "0";
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "brief-expiry-"));
process.env.BRIEF_DATA_DIR = dir;
const { store } = await import("../src/store.js");
const auth = await import("../src/domain/auth.js");
const campaigns = await import("../src/domain/campaign.js");
const events = await import("../src/domain/events.js");

let count = 0;
const test = (name, fn) => { fn(); count++; console.log("PASS " + name); };
const user = (handle) => auth.createUser({ handle, password: "expiry-pw" });

const owner = user("exp_owner");
const past = () => new Date(Date.now() - 86400000).toISOString();   // yesterday
const future = () => new Date(Date.now() + 86400000).toISOString(); // tomorrow

function mk(title, over = {}) {
  const c = campaigns.createCampaign(owner.id, { title, type: "event", ...over });
  campaigns.transitionCampaign(c.id, "published");
  return store.find("campaigns", (x) => x.id === c.id);
}

test("a dated event with a past endsAt has naturally ended (derived)", () => {
  const pastEvent = mk("Ended Market", { endsAt: past() });
  const futureEvent = mk("Upcoming Market", { endsAt: future() });
  const endless = mk("Open-ended Market", {});

  assert.equal(events.hasEnded(pastEvent), true, "past endsAt -> ended");
  assert.equal(events.hasEnded(futureEvent), false, "future endsAt -> not ended");
  assert.equal(events.hasEnded(endless), false, "no endsAt -> never ended");
});

test("past events drop out of browse, but stay resolvable by slug", () => {
  const pastEvent = mk("Ended Browse", { endsAt: past() });
  const futureEvent = mk("Upcoming Browse", { endsAt: future() });

  const browsed = events.browseEvents({});
  assert.ok(!browsed.events.some((e) => e.slug === pastEvent.publicSlug), "past event is not advertised");
  assert.ok(browsed.events.some((e) => e.slug === futureEvent.publicSlug), "future event is advertised");

  // A person still holding the link can open the ended event's page.
  assert.ok(campaigns.getPublicBySlug(pastEvent.publicSlug), "slug still resolves");
});

test("the public view reports hasEnded honestly", () => {
  const pastEvent = mk("Ended Public", { endsAt: past() });
  const futureEvent = mk("Upcoming Public", { endsAt: future() });
  assert.equal(campaigns.publicView(pastEvent).hasEnded, true);
  assert.equal(campaigns.publicView(futureEvent).hasEnded, false);
});

test("related + series rails exclude past occurrences", () => {
  const main = mk("Series Seed", { location: "Karen", seriesId: "s1", endsAt: future() });
  const pastRelated = mk("Past Same-Type", { location: "Westlands", endsAt: past() });
  const pastOccurrence = mk("Past Series", { seriesId: "s1", endsAt: past() });
  const futureOccurrence = mk("Next Series", { seriesId: "s1", endsAt: future() });

  const related = events.relatedEvents(main, 10).map((e) => e.slug);
  assert.ok(!related.includes(pastRelated.publicSlug), "a past event is not a related suggestion");

  const occs = events.seriesOccurrences("s1", main.id, 10).map((e) => e.slug);
  assert.ok(!occs.includes(pastOccurrence.publicSlug), "a past instalment is not a next occurrence");
  assert.ok(occs.includes(futureOccurrence.publicSlug), "the upcoming instalment is listed");
});

console.log(`\nPASS ${count}`);
process.exit(0);
