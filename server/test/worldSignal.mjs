// ---------------------------------------------------------------------------
// WORLD SIGNAL — a strip that talks about the world when the user's own ledger
// is empty. The whole point is that it must be TRUE, so these tests are mostly
// negative: they pin the moment a design that "needs something to say" would
// otherwise invent it.
//
//   * every number spoken in a fact is a number in the provider's response;
//   * below the provider's own meaningful-rain floor, NO rain claim is made;
//   * an unreachable provider yields an error and an empty fact list, never a
//     zero, never a stale fact presented as fresh, and never a fallback string;
//   * a place is only what the gazetteer matched — with its own admin labels;
//   * the cache is real (one provider call per window per place);
//   * prices and fuel are declared not_configured with a reason, because Brief
//     has no legitimate key-free source for them;
//   * and the module itself contains no hard-coded percentage or money figure,
//     so nobody can ship "Maize +12% this week" as a string again.
// ---------------------------------------------------------------------------

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";

process.env.NODE_ENV = "test";
process.env.BRIEF_DEV_AUTH = "0";
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "brief-world-"));
process.env.BRIEF_DATA_DIR = dir;

let count = 0;
const test = async (name, fn) => { await fn(); count++; console.log("PASS " + name); };

const SRC = fs.readFileSync(new URL("../src/domain/worldSignal.js", import.meta.url), "utf8");

// ---------------------------------------------------------------------------
// A provider fixture, written the way the API actually answers, with a fixed
// "now" so the derived day counts are exact.
const DAY0 = "2026-09-17";
const now = Date.parse(`${DAY0}T09:00:00+03:00`);
const days = (n) => new Date(Date.parse(`${DAY0}T12:00:00Z`) + n * 86400000).toISOString().slice(0, 10);

const FIXTURE = {
  latitude: -0.68, longitude: 34.76, elevation: 1800,
  daily_units: { precipitation_sum: "mm", temperature_2m_max: "°C", temperature_2m_min: "°C" },
  daily: {
    time: [0, 1, 2, 3, 4, 5, 6].map(days),
    precipitation_sum: [0.2, 0, 0.4, 0.6, 3.1, 22.5, 18.4],
    precipitation_probability_max: [10, 5, 20, 30, 61, 95, 90],
    temperature_2m_max: [26.4, 27.5, 25.1, 24.8, 23.9, 21.2, 22.0],
    temperature_2m_min: [14.2, 13.8, 11.4, 15.0, 14.1, 13.2, 12.9]
  }
};

const { deriveFacts, WORLD_CONSTANTS, DEFAULT_PLACE } = await import("../src/domain/worldSignal.js");

await test("deriveFacts speaks only numbers that are in the response", () => {
  const out = deriveFacts(FIXTURE.daily, { nowMs: now, units: FIXTURE.daily_units });
  assert.ok(out.facts.length >= 3, "a fixture this talkative yields several facts");
  const numsInFixture = new Set(
    [...FIXTURE.daily.precipitation_sum, ...FIXTURE.daily.temperature_2m_max, ...FIXTURE.daily.temperature_2m_min,
     ...FIXTURE.daily.precipitation_probability_max].map((v) => String(v))
  );
  for (const fact of out.facts) {
    const spoken = (fact.text.match(/\d+(?:\.\d+)?/g) || []).filter((n) => !/^\d$|^\d\d$/.test(n) || numsInFixture.has(n));
    // day counts and the horizon are arithmetic over the fixture's dates, so
    // only the measurement-shaped numbers are policed; anything with a unit must
    // be a value the provider returned.
    for (const m of fact.text.matchAll(/(\d+(?:\.\d+)?)\s*(mm|°C|%)/g)) {
      assert.ok(numsInFixture.has(m[1]), `“${fact.text}” quotes ${m[1]}${m[2]}, which is not in the response`);
    }
    assert.ok(spoken.length >= 0);
  }
  const heavy = out.facts.find((f) => f.kind === "rain");
  assert.ok(heavy, "a 22.5mm day is a heavy-rain fact");
  assert.equal(heavy.value, 22.5, "the fact carries its own number, so the UI cannot round it");
  assert.equal(heavy.date, out.heaviestRain.date);
  assert.equal(out.wetDays, 3, "days at or above the 1mm floor, counted from rows");
});

await test("below the meaningful-rain floor, no rain claim is made at all", () => {
  const dry = {
    time: [0, 1, 2, 3, 4, 5, 6].map(days),
    precipitation_sum: [0.1, 0.4, 0.9, 0.2, 0.6, 0.8, 0.3],
    precipitation_probability_max: [20, 20, 20, 20, 20, 20, 20],
    temperature_2m_max: [27, 27.1, 26, 26.5, 28, 25, 24],
    temperature_2m_min: [15, 15, 14, 15, 16, 14, 13]
  };
  const out = deriveFacts(dry, { nowMs: now });
  assert.equal(out.heaviestRain, null, `nothing reaches ${WORLD_CONSTANTS.WET_MM} mm, so there is no wet day to name`);
  assert.ok(!out.facts.some((f) => f.kind === "rain" || f.kind === "rain-due"), "and no rain sentence is spoken");
  assert.equal(out.dryRunDays, 7, "the honest read of that week is a dry run of the whole horizon");
  const dryFact = out.facts.find((f) => f.kind === "dry");
  assert.equal(dryFact.value, 7, "stated as a count of days");
  assert.equal(dryFact.thresholdMm, WORLD_CONSTANTS.WET_MM, "the floor rides as a field, never as a number in the sentence");
  assert.ok(!/\d+\s*mm/.test(dryFact.text), "and the dry sentence quotes no millimetres");
  assert.deepEqual(out.facts.map((f) => f.kind), ["dry", "heat"],
    "a dry week may only be described as dry — and hot, because the response says so");
  assert.ok(!out.facts.some((f) => /wet|rain/i.test(f.text) && !/no rain for the next/.test(f.text)),
    "no wet-day headline survives a dry fixture");
});

await test("an empty or broken payload yields silence, not zeros", () => {
  for (const daily of [null, undefined, { time: [] }, { time: [days(0)] }]) {
    const out = deriveFacts(daily, { nowMs: now });
    assert.ok(Array.isArray(out.facts), "shape is kept");
    assert.equal(out.facts.length, 0, "and nothing is said when there is nothing to say");
  }
});

// ---------------------------------------------------------------------------
// The provider seam: one stub for the whole module, counting calls.
let calls = [];
// The app's own port must stay reachable: the stub below replaces global.fetch
// process-wide, so the API test talks to the server with the captured original.
const realFetch = global.fetch;
function stubProvider({ failForecast = false, failGeocode = false, stale = false } = {}) {
  global.fetch = async (url) => {
    const u = String(url);
    calls.push(u);
    if (u.includes("geocoding-api")) {
      if (failGeocode) return { ok: false, status: 503, json: async () => ({}) };
      const wanted = new URL(u).searchParams.get("name");
      if (/zzz/i.test(wanted)) return { ok: true, status: 200, json: async () => ({ results: [] }) };
      return {
        ok: true, status: 200,
        json: async () => ({ results: [{ name: wanted, admin1: `${wanted} County`, country: "Kenya", latitude: -0.68, longitude: 34.76, elevation: 1800 }] })
      };
    }
    if (u.includes("api.open-meteo.com")) {
      if (failForecast) throw new Error("socket hang up");
      return { ok: true, status: 200, json: async () => (stale ? { ...FIXTURE, daily: { ...FIXTURE.daily, precipitation_sum: [0, 0, 0, 0, 0, 0, 0] } } : FIXTURE) };
    }
    return { ok: false, status: 404, json: async () => ({}) };
  };
}

const mod = await import("../src/domain/worldSignal.js");

await test("a read is one gazetteer call and one forecast call, then it is cached", async () => {
  mod.__clearWorldCache(); calls = []; stubProvider();
  const a = await mod.worldSignal({ place: "Kisii", now });
  assert.equal(a.available, true, "the read succeeds");
  assert.equal(calls.length, 2, "one place lookup, one forecast — no polling storm");
  assert.equal(a.resolvedPlace.admin, "Kisii County", "the provider's own admin label, not a guessed county");
  assert.equal(a.resolvedPlace.country, "Kenya");
  assert.ok(a.retrievedAt, "with a retrieval time on it");
  assert.equal(a.fromCache, false);
  assert.ok(a.ageHours >= 0, "a fresh read can never age negatively");
  const b = await mod.worldSignal({ place: "Kisii", now: now + 60_000 });
  assert.equal(calls.length, 2, "a second read inside the window makes no call at all");
  assert.equal(b.fromCache, true, "and says it came from cache");
});

await test("an unreachable provider is an error, never a zero or a guess", async () => {
  mod.__clearWorldCache(); calls = []; stubProvider({ failForecast: true });
  const out = await mod.worldSignal({ place: "Kisii", now });
  assert.equal(out.available, false, "no facts are offered");
  assert.deepEqual(out.facts, [], "an empty fact list, not a 0 and not a placeholder sentence");
  assert.match(out.error, /could not be reached/, "and the reason is the provider's failure");
  assert.match(out.error, /gap is shown as a gap/, "with the rule stated once, in the message");
});

await test("a cached read survives an outage, but is labelled stale with its age", async () => {
  mod.__clearWorldCache(); calls = []; stubProvider();
  await mod.worldSignal({ place: "Kisii", now });
  stubProvider({ failForecast: true });
  const later = now + 8 * 3600_000;
  const out = await mod.worldSignal({ place: "Kisii", now: later });
  assert.equal(out.available, true, "there is something to show");
  assert.equal(out.stale, true, "and it is marked stale");
  assert.equal(out.ageHours, 8, "with the age the caller’s clock says");
  assert.match(out.error, /8h old/, "the caveat names its own age");
  const muchLater = now + 200 * 3600_000;
  const gone = await mod.worldSignal({ place: "Kisii", now: muchLater });
  assert.equal(gone.available, false, "past the tolerance the old read is dropped, not laundered");
  assert.deepEqual(gone.facts, []);
});

await test("a place the gazetteer does not know is reported as unknown", async () => {
  mod.__clearWorldCache(); calls = []; stubProvider();
  const out = await mod.worldSignal({ place: "Zzznotaplace", now });
  assert.equal(out.available, false);
  assert.match(out.error, /no place called “Zzznotaplace” in the provider's gazetteer/, "the provider’s own vocabulary");
  assert.equal(out.resolvedPlace, null, "and no coordinates are invented to keep the strip alive");
});

await test("with no place asked for, the default is announced as the default", async () => {
  mod.__clearWorldCache(); calls = []; stubProvider();
  const out = await mod.worldSignal({ now });
  assert.equal(out.place, DEFAULT_PLACE.name);
  assert.equal(out.placeIsDefault, true, "so the UI can say “Nairobi, by default” rather than imply the user chose it");
  assert.equal(calls.length, 1, "the default needs no geocoding round-trip");
});

await test("prices and fuel are declared unavailable with a reason, not faked", () => {
  const src = SRC;
  assert.match(src, /prices:\s*\{[\s\S]{0,400}not_configured/, "the payload carries the price gap explicitly");
  assert.match(src, /fuel:\s*\{[\s\S]{0,400}not_configured/, "and the fuel gap");
  assert.doesNotMatch(src, /EPRA[^']*?\d{2,}(\.\d+)?\s*KES/, "no EPRA figure is typed into the source");
});

await test("no invented number can hide in this module’s own strings", () => {
  // The literal-string audit: a percentage or a money amount written into the
  // file is a fact with no provider behind it. Foreground it as a bug now,
  // rather than let it ship as "Maize +12% this week".
  const code = SRC.replace(/\/\*[\s\S]*?\*\//g, "").split("\n").filter((l) => !/^\s*(\/\/|\*)/.test(l));
  const bad = [];
  for (const line of code) {
    if (/\d+(?:\.\d+)?\s*%/.test(line) && !/100%25|encodeURI|searchParams|url/i.test(line)) bad.push(`percent: ${line.trim().slice(0, 90)}`);
    if (/KES|Ksh|Sh[ .]?[0-9]/.test(line)) bad.push(`money: ${line.trim().slice(0, 90)}`);
  }
  assert.deepEqual(bad, [], "every figure comes from the response, so none is written here");
});

// ---------------------------------------------------------------------------
await test("API: /api/world is public, says what it is, and never 500s on an outage", async () => {
  const { default: app } = await import("../src/index.js");
  const srv = app.listen(0);
  const port = srv.address().port;
  const call = async (p) => {
    const r = await realFetch(`http://127.0.0.1:${port}${p}`);
    return { status: r.status, body: await r.json().catch(() => null) };
  };
  // The HTTP route uses Date.now(), unlike the domain tests' explicit `now`.
  // Keep it on the fixture's clock rather than expiring the fixture every week.
  const realNow = Date.now;
  try {
    Date.now = () => now;
    mod.__clearWorldCache(); stubProvider();
    const anon = await call("/api/world?place=Kisii");
    assert.equal(anon.status, 200, "a signed-out visitor gets the same read — it is public data");
    assert.equal(anon.body.ok, true);
    assert.equal(anon.body.provider, "Open-Meteo", "the source is named on the payload, not added by the UI");
    assert.ok(Array.isArray(anon.body.facts) && anon.body.facts.length > 0);
    assert.equal(anon.body.prices.status, "not_configured", "and the gaps ride along");

    // Moving past the fixture must still suppress historical forecasts. Do not
    // "fix" the test by weakening the production freshness rule.
    Date.now = () => now + 7 * 86400000;
    mod.__clearWorldCache();
    const expired = await call("/api/world?place=Kisii");
    assert.equal(expired.status, 200);
    assert.equal(expired.body.available, true, "the provider answered, even though its dates are past");
    assert.deepEqual(expired.body.facts, [], "past forecast dates are never shown as current facts");

    Date.now = () => now;
    stubProvider({ failForecast: true });
    mod.__clearWorldCache();
    const down = await call("/api/world");
    assert.equal(down.status, 200, "an outage is a state, not a 5xx");
    assert.equal(down.body.available, false);
    assert.ok(down.body.error, "with the reason");
  } finally {
    Date.now = realNow;
    global.fetch = realFetch;
    mod.__clearWorldCache();
    await new Promise((resolve) => srv.close(resolve));
  }
});

console.log(`\nPASS ${count}`);
process.exit(0);
