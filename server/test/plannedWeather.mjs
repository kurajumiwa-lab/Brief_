// ---------------------------------------------------------------------------
// PLANNED WEATHER — a forecast that only speaks on a day you have committed to.
//
// Home used to carry a whole weather strip for everyone, which is what every
// other app does and why nobody reads it. The rule this suite pins is the
// opposite: the strip exists ONLY at the join between the provider's dated facts
// and the member's own registration rows. Seven rules:
//
//   * nothing planned → nothing shown, with the reason named (`nothing_planned`).
//     Not a generic forecast, not a filler sentence about the week;
//   * planned, but the provider gave no dated fact for that day → still empty
//     (`no_dated_fact_for_those_days`), because "3 wet days this week" is not a
//     statement about YOUR Saturday;
//   * provider unreachable → `available: false`, and no stale line is repeated
//     as if it were fresh;
//   * an undated campaign is left out rather than defaulted to today;
//   * a cancelled registration, and a draft campaign, are not plans;
//   * every number in a returned line is the provider's, quoted not computed;
//   * and the route is caller-scoped: an anonymous request gets the empty shape,
//     never somebody else's diary.
// ---------------------------------------------------------------------------
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";

process.env.NODE_ENV = "test";
process.env.BRIEF_DEV_AUTH = "0";
process.env.BRIEF_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "brief-pweather-"));

const { store } = await import("../src/store.js");
const auth = await import("../src/domain/auth.js");
const campaigns = await import("../src/domain/campaign.js");
const pw = await import("../src/domain/plannedWeather.js");

let count = 0;
const test = async (name, fn) => { await fn(); count++; console.log("PASS " + name); };

// A fixed "now": Thursday 17 September 2026, 09:00 in Nairobi.
const DAY0 = "2026-09-17";
const now = Date.parse(`${DAY0}T09:00:00+03:00`);
const day = (n) => new Date(Date.parse(`${DAY0}T12:00:00Z`) + n * 86400000).toISOString().slice(0, 10);

// The provider, exactly as it answers. Index 5 is the only heavy-rain day, so
// the expected match is a single day and the test cannot pass by accident.
const FIXTURE = {
  latitude: -0.68, longitude: 34.76, elevation: 1800,
  daily_units: { precipitation_sum: "mm", temperature_2m_max: "°C", temperature_2m_min: "°C" },
  daily: {
    time: [0, 1, 2, 3, 4, 5, 6].map(day),
    precipitation_sum: [0.2, 0, 0.4, 0.6, 1.1, 26.5, 0.3],
    precipitation_probability_max: [10, 5, 20, 30, 40, 95, 12],
    temperature_2m_max: [26.4, 27.5, 25.1, 24.8, 23.9, 21.2, 26.0],
    temperature_2m_min: [14.2, 13.8, 11.4, 15.0, 14.1, 13.2, 15.1]
  }
};

const realFetch = global.fetch;
let providerState = { fail: false };
global.fetch = async (url) => {
  const u = String(url);
  if (u.includes("geocoding-api")) {
    const wanted = new URL(u).searchParams.get("name") || "Nairobi";
    return { ok: true, status: 200, json: async () => ({ results: [{ name: wanted, admin1: `${wanted} County`, country: "Kenya", latitude: -0.68, longitude: 34.76, elevation: 1800 }] }) };
  }
  if (u.includes("api.open-meteo.com")) {
    if (providerState.fail) throw new Error("socket hang up");
    return { ok: true, status: 200, json: async () => FIXTURE };
  }
  return { ok: false, status: 404, json: async () => ({}) };
};
const { __clearWorldCache } = await import("../src/domain/worldSignal.js");
const clearCache = () => { __clearWorldCache(); providerState = { fail: false }; };

const host = auth.createUser({ handle: "pw_host", password: "a good passphrase" });
const member = auth.createUser({ handle: "pw_member", password: "a good passphrase" });

function plan({ title, startsAt, status = "published", price = 0 }) {
  const c = campaigns.createCampaign(host.id, { title, startsAt, price, type: "event" });
  // The transition returns the fresh row; `register` reads the status off the
  // object it is handed, so passing the pre-publish one would be refused —
  // and a test that "worked" by registering against a draft would be fiction.
  if (status !== "draft") return campaigns.transitionCampaign(c.id, status) ?? store.find("campaigns", (x) => x.id === c.id);
  return c;
}
function attend(campaign, who = member.id, ref = who) {
  return campaigns.register(campaign, { attendeeRef: ref, name: "Wanjiku", userId: who });
}

// ---------------------------------------------------------------------------
await test("nothing planned yields nothing shown, and says why", async () => {
  clearCache();
  const out = await pw.plannedWeather({ userId: member.id, nowMs: now });
  assert.equal(out.available, true, "the read itself worked");
  assert.deepEqual(out.matched, [], "and no weather line exists without a plan");
  assert.equal(out.reason, "nothing_planned", "the emptiness is named, not left to be guessed");
  assert.ok(/only/.test(out.note), "and the note explains the rule rather than apologising");
  // The silence must not be a hidden forecast: no stray sentence is smuggled in.
  assert.ok(!JSON.stringify(out).includes("Heavy rain"), "nothing is quoted when nothing matched");
});

await test("a plan on the provider's heavy-rain day yields exactly that fact", async () => {
  clearCache();
  const wet = plan({ title: "Kisii Saturday market", startsAt: `${day(5)}T08:00:00+03:00` });
  attend(wet);
  const out = await pw.plannedWeather({ userId: member.id, nowMs: now });
  assert.equal(out.matched.length, 1, `one planned day had a dated fact, got ${out.matched.length}`);
  const m = out.matched[0];
  assert.equal(m.date, day(5), "matched to the day the event is actually on");
  assert.equal(m.eventTitle, "Kisii Saturday market", "the plan is named, so the line is about a thing");
  assert.equal(m.fact.kind, "rain", "the fact is the provider's rain statement, not a paraphrase");
  assert.match(m.fact.text, /26\.5 mm/, "carrying the millimetres it read");
  assert.equal(m.fact.value, 26.5, "as a number the surface can quote, never re-round");
  assert.match(m.fact.text, /95% likely/, "and the probability the provider gave");
  assert.ok(!/bring|cover|warning|alert/i.test(JSON.stringify(m)), "no advice, no alarm: a fact, not an instruction");
});

await test("the quoted fact is the provider's words and numbers, unchanged", async () => {
  clearCache();
  const { deriveFacts } = await import("../src/domain/worldSignal.js");
  const direct = deriveFacts(FIXTURE.daily, { nowMs: now, units: FIXTURE.daily_units });
  const wetFact = direct.facts.find((f) => f.date === day(5) && (f.kind === "rain" || f.kind === "rain-due"));
  assert.ok(wetFact, "the fixture yields a dated rain fact for that day");
  const out = await pw.plannedWeather({ userId: member.id, nowMs: now });
  assert.equal(out.matched[0].fact.text, wetFact.text, "the line is quoted, not reworded");
  assert.equal(out.matched[0].fact.value, wetFact.value, "with the provider's number");
  assert.equal(out.matched[0].fact.unit, wetFact.unit, "and its unit");
  assert.ok(out.provider && out.providerLicence, "and the provenance travels with it");
});

await test("a plan on a day with no dated fact is counted, not filled", async () => {
  clearCache();
  // The silent day is derived from the provider's own output rather than chosen
  // by hand, because a hand-picked index can accidentally be the hottest or
  // coolest day — and a test that passes by luck proves nothing.
  const { deriveFacts } = await import("../src/domain/worldSignal.js");
  const dated = new Set(deriveFacts(FIXTURE.daily, { nowMs: now, units: FIXTURE.daily_units }).facts
    .filter((f) => f.date).map((f) => f.date));
  const silent = [1, 2, 3, 4, 6].map(day).find((d) => !dated.has(d));
  assert.ok(silent, "the fixture must leave at least one horizon day without a dated fact");
  const quiet = plan({ title: "Quiet Wednesday walk-through", startsAt: `${silent}T07:00:00+03:00` });
  const only = auth.createUser({ handle: "pw_quiet", password: "a good passphrase" });
  attend(quiet, only.id, only.id);
  const out = await pw.plannedWeather({ userId: only.id, nowMs: now });
  assert.equal(out.matched.length, 0, "no fact, no line");
  assert.equal(out.reason, "no_dated_fact_for_those_days", "and the emptiness is named");
  assert.equal(out.unmatchedDays, 1, "the day is reported as unmatched, not dropped");
});

await test("an undated campaign is not turned into today's weather", async () => {
  clearCache();
  const nobody = auth.createUser({ handle: "pw_undated", password: "a good passphrase" });
  const c = plan({ title: "Dateless meet-up", startsAt: null });
  attend(c, nobody.id, nobody.id);
  const out = await pw.plannedWeather({ userId: nobody.id, nowMs: now });
  assert.deepEqual(out.plannedDays, [], "a missing date stays missing; defaulting it to today would fabricate a schedule");
});

await test("cancelled and draft plans are not plans", async () => {
  clearCache();
  const solo = auth.createUser({ handle: "pw_solo", password: "a good passphrase" });
  const drafted = plan({ title: "Not published yet", startsAt: `${day(5)}T08:00:00+03:00`, status: "draft" });
  const draftReg = store.insert("registrations", {
    id: "reg_draft_1", campaignId: drafted.id, attendeeRef: solo.id, userId: solo.id,
    status: "registered", name: "Wanjiku", createdAt: new Date(now).toISOString()
  });
  assert.ok(draftReg, "a row written straight past the guard, which is the case the read must still refuse");
  const cancelledCampaign = plan({ title: "Cancelled market day", startsAt: `${day(5)}T08:00:00+03:00` });
  const reg = attend(cancelledCampaign, solo.id, solo.id);
  store.update("registrations", reg.id, { status: "cancelled" });

  const out = await pw.plannedWeather({ userId: solo.id, nowMs: now });
  assert.deepEqual(out.plannedDays, [], "a draft campaign and a cancelled seat are not plans");
  const stranger = await pw.plannedWeather({ userId: "pw_nobody", nowMs: now });
  assert.equal(stranger.matched.length, 0, "and a stranger's id sees none of these rows");
  const mine = await pw.plannedWeather({ userId: member.id, nowMs: now });
  assert.ok(mine.matched.length >= 1, "the real plan from earlier still produces its one line");
});

await test("an unreachable provider yields no line rather than a stale one", async () => {
  clearCache();
  providerState = { fail: true };
  const out = await pw.plannedWeather({ userId: member.id, nowMs: now });
  assert.equal(out.available, false, "the read says it could not be done");
  assert.deepEqual(out.matched, [], "and the surface is given nothing to render");
  assert.equal(out.reason, "world_read_unavailable", "with the reason named");
  assert.ok(out.plannedDays.length >= 1, "the plan is still real — only the sky is unreadable");
  providerState = { fail: false };
});

await test("the horizon is the provider's, and a far plan is left out", async () => {
  clearCache();
  const distant = auth.createUser({ handle: "pw_far", password: "a good passphrase" });
  const far = plan({ title: "Next month's fair", startsAt: `${day(40)}T08:00:00+03:00` });
  attend(far, distant.id, distant.id);
  const out = await pw.plannedWeather({ userId: distant.id, nowMs: now });
  assert.ok(!out.plannedDays.some((d) => d.date === day(40)),
    "a day no forecast reaches is not shown as a plan, because the line could never be honest");
});

await test("HTTP: the route is caller-scoped and never 5xx on a provider gap", async () => {
  clearCache();
  // The route cannot be passed `nowMs` — it uses the wall clock. The frozen
  // Thursday this file is built on (17 Sep 2026) is already in Nairobi's past
  // once UTC rolls past 21:00, so reusing `member`'s plan would make
  // `matched[0]` undefined and the identity assertion a TypeError rather than
  // a failure about identity. Plant a plan on a day that is still ahead in
  // Nairobi AND in a forecast window the mock answers for.
  const todayEat = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Nairobi", year: "numeric", month: "2-digit", day: "2-digit"
  }).format(new Date());
  const wallDays = [0, 1, 2, 3, 4, 5, 6].map((n) =>
    new Date(Date.parse(`${todayEat}T12:00:00Z`) + n * 86400000).toISOString().slice(0, 10)
  );
  const savedTime = FIXTURE.daily.time;
  FIXTURE.daily.time = wallDays;
  const httpUser = auth.createUser({ handle: "pw_http", password: "a good passphrase" });
  const httpPlan = plan({ title: "HTTP-day market", startsAt: `${wallDays[1]}T08:00:00+03:00` });
  attend(httpPlan, httpUser.id, httpUser.id);

  const { default: app } = await import("../src/index.js");
  const srv = app.listen(0);
  const port = srv.address().port;
  const call = async (path, token = null) => {
    const res = await realFetch(`http://127.0.0.1:${port}${path}`, {
      headers: token ? { authorization: `Bearer ${token}` } : {}
    });
    return { status: res.status, body: await res.json().catch(() => ({})) };
  };
  try {
    const anon = await call("/api/planned-weather");
    // The route is not on the public allow-list, because its payload is a
    // person's diary. The platform's answer to that is the standing gate, and
    // the body carries no plans in it either way.
    assert.equal(anon.status, 401, "an anonymous read is gated, not answered");
    assert.equal(anon.body.gate, "account_required", "and says what is missing");
    assert.ok(!("matched" in anon.body), "no diary field at all");
    const mine = await call("/api/planned-weather", auth.issueSession(httpUser.id).token);
    assert.equal(mine.status, 200);
    assert.ok(Array.isArray(mine.body.matched), "the member gets the same shape with their own rows");
    assert.equal(mine.body.matched.length, 1, "the planted day is the only match");
    assert.ok(mine.body.matched.every((m) => m.eventTitle && m.fact?.text), "every line names both the plan and the fact");
    assert.ok(typeof mine.body.available === "boolean" && typeof mine.body.note === "string", "with the rule stated on the way out");
    // The link is only ever a slug the campaign actually has: the surface can
    // point at the plan, and cannot be tempted to invent an address.
    const one = mine.body.matched[0];
    assert.ok(one, "a match exists to carry identity — the TypeError was the test using a plan that had already happened");
    assert.ok("slug" in one && "campaignId" in one, "a match carries its plan's identity");
    assert.ok(one.slug === null || typeof one.slug === "string", "slug is a real one or absent, never a guess");
    assert.equal(one.campaignId, httpPlan.id, "and it is THIS plan, not somebody else's leftover");
  } finally {
    FIXTURE.daily.time = savedTime;
    srv.close();
    global.fetch = realFetch;
  }
});

console.log(`PASSED ${count} FAILED 0`);
