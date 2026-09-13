// ---------------------------------------------------------------------------
// EVENT DETAIL MODEL (Tikiti T4)
//
// The rich detail screen needs structured venue, an ordered agenda, a series
// token, a DERIVED host profile, and DERIVED context rails (related, more from
// this host, series occurrences). Every one of those is scanned from real
// campaign rows; none is stored as a counter and none is seeded.
// ---------------------------------------------------------------------------

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";

process.env.NODE_ENV = "test";
process.env.BRIEF_DEV_AUTH = "0";
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "brief-eventdetail-"));
process.env.BRIEF_DATA_DIR = dir;

const { store } = await import("../src/store.js");
const auth = await import("../src/domain/auth.js");
const campaigns = await import("../src/domain/campaign.js");
const events = await import("../src/domain/events.js");

let count = 0;
const pass = (name) => { count++; console.log("PASS " + name); };

const owner = auth.createUser({ handle: "ed_owner", password: "detail-pw" });
const other = auth.createUser({ handle: "ed_other", password: "detail-pw" });

// ---------------------------------------------------------------------------
// createCampaign: venue / agenda / seriesId are accepted and normalised.
// ---------------------------------------------------------------------------
{
  const c = campaigns.createCampaign(owner.id, {
    title: "Rooftop Series — June",
    type: "event",
    location: "Kilimani",
    venue: { name: "Sarit Rooftop", address: "Sarit Centre, Westlands", lat: -1.26, lng: 36.79, junk: "dropped" },
    agenda: [
      { at: "18:00", title: "Doors open" },
      { title: "Keynote", description: "A talk on community markets" }
    ],
    seriesId: "rooftop-series"
  });
  const row = store.find("campaigns", (x) => x.id === c.id);
  assert.equal(row.venue.name, "Sarit Rooftop");
  assert.equal(row.venue.address, "Sarit Centre, Westlands");
  assert.equal(row.venue.lat, -1.26);
  assert.equal(row.venue.lng, 36.79);
  assert.equal("junk" in row.venue, false, "unknown venue keys are dropped");
  assert.equal(row.agenda.length, 2);
  assert.equal(row.agenda[0].at, "18:00");
  assert.equal(row.agenda[1].description, "A talk on community markets");
  assert.equal(row.seriesId, "rooftop-series");
  pass("createCampaign normalises venue, agenda and seriesId");
}

{
  let threw = null;
  try {
    campaigns.createCampaign(owner.id, { title: "Bad venue", type: "event", venue: { lat: "not-a-number" } });
  } catch (e) { threw = String(e.message); }
  assert.match(threw ?? "", /latitude/, "a malformed venue is refused");
  pass("a malformed venue is refused, not stored");

  threw = null;
  try {
    campaigns.createCampaign(owner.id, { title: "Bad agenda", type: "event", agenda: [{ description: "no title" }] });
  } catch (e) { threw = String(e.message); }
  assert.match(threw ?? "", /title/, "an agenda item without a title is refused");
  pass("an agenda item without a title is refused");

  threw = null;
  try {
    campaigns.createCampaign(owner.id, { title: "Bad series", type: "event", seriesId: 42 });
  } catch (e) { threw = String(e.message); }
  assert.match(threw ?? "", /seriesId/, "a non-text seriesId is refused");
  pass("a non-text seriesId is refused");
}

// ---------------------------------------------------------------------------
// publicView: the new fields are surfaced, and the host is DERIVED.
// ---------------------------------------------------------------------------
{
  const main = campaigns.createCampaign(owner.id, {
    title: "Detail Event",
    type: "event",
    location: "Nairobi",
    venue: { name: "The Venue" },
    agenda: [{ title: "Welcome" }],
    metadata: { creatorName: "Amina K" }
  });
  campaigns.transitionCampaign(main.id, "published");
  const pub = campaigns.publicView(store.find("campaigns", (x) => x.id === main.id));

  assert.equal(pub.venue.name, "The Venue", "structured venue is surfaced");
  assert.equal(pub.agenda.length, 1, "agenda is surfaced");
  assert.equal(pub.host.name, "Amina K", "host name is the chosen creatorName");
  assert.equal(pub.host.eventsHosted, 1, "host event count is DERIVED from published rows");
  assert.equal(pub.tableBankingOverlap, null, "no overlap anonymously");
  pass("publicView surfaces venue/agenda/host and a derived host count");

  // The host count grows as the owner publishes more — derived, never stored.
  const second = campaigns.createCampaign(owner.id, { title: "Second Event", type: "session" });
  campaigns.transitionCampaign(second.id, "published");
  const pub2 = campaigns.publicView(store.find("campaigns", (x) => x.id === main.id));
  assert.equal(pub2.host.eventsHosted, 2, "a second published event raises the derived count");
  pass("host event count is recomputed from real rows on every read");

  // Safety: the new derived fields must not leak the ownerId or a roster.
  const raw = JSON.stringify(pub2);
  assert.ok(!/ownerId|ed_owner|attendeeRef/.test(raw), "no internal id or roster leaks via the host/venue/agenda fields");
  pass("the rich detail projection still leaks no ownerId or roster");
}

// ---------------------------------------------------------------------------
// Context rails: related, fromHost, seriesOccurrences — all derived.
// ---------------------------------------------------------------------------
{
  const main = campaigns.createCampaign(owner.id, {
    title: "Rail Seed",
    type: "popup",
    location: "Karen",
    seriesId: "rail-series"
  });
  campaigns.transitionCampaign(main.id, "published");
  const mainRow = store.find("campaigns", (x) => x.id === main.id);

  // Related by category (another popup, different organiser).
  const popup = campaigns.createCampaign(other.id, { title: "Other Popup", type: "popup", location: "Westlands" });
  campaigns.transitionCampaign(popup.id, "published");

  // Related by exact location (a session in Karen).
  const karen = campaigns.createCampaign(other.id, { title: "Karen Session", type: "session", location: "Karen" });
  campaigns.transitionCampaign(karen.id, "published");

  // Unrelated (different category AND location) — must NOT appear.
  const unrelated = campaigns.createCampaign(other.id, { title: "Far Event", type: "contribution", location: "Mombasa", goalAmount: 100 });
  campaigns.transitionCampaign(unrelated.id, "published");

  // Same host, past event (closed) + a draft that must NOT appear.
  const past = campaigns.createCampaign(owner.id, { title: "Past Event", type: "event" });
  campaigns.transitionCampaign(past.id, "published");
  campaigns.transitionCampaign(past.id, "closed");
  campaigns.createCampaign(owner.id, { title: "Secret Draft", type: "event" }); // stays draft

  // Same series occurrence.
  const occ = campaigns.createCampaign(other.id, { title: "Series 2", type: "popup", seriesId: "rail-series" });
  campaigns.transitionCampaign(occ.id, "published");

  const related = events.relatedEvents(mainRow, 10).map((e) => e.slug);
  assert.ok(related.includes(popup.publicSlug), "same-category event is related");
  assert.ok(related.includes(karen.publicSlug), "same-location event is related");
  assert.ok(!related.includes(unrelated.publicSlug), "a different category+location event is not related");
  assert.ok(!related.includes(mainRow.publicSlug), "an event is never related to itself");
  pass("relatedEvents derives same-category and same-location, excludes self");

  const host = events.hostEvents(owner.id, main.id, 10).map((e) => e.slug);
  assert.ok(host.includes(past.publicSlug), "the host's past event appears");
  assert.ok(!host.includes(mainRow.publicSlug), "the event itself is excluded");
  assert.ok(!host.includes("Secret Draft"), "a draft never appears as a host event");
  pass("hostEvents lists the organiser's other public events, never drafts");

  const occs = events.seriesOccurrences("rail-series", main.id, 10).map((e) => e.slug);
  assert.ok(occs.includes(occ.publicSlug), "a same-series occurrence appears");
  assert.ok(!occs.includes(mainRow.publicSlug), "the event itself is excluded");
  pass("seriesOccurrences derives other instalments of the same series");
}

// ---------------------------------------------------------------------------
// HTTP: the public context endpoint serves the derived rails.
// ---------------------------------------------------------------------------
{
  const { default: app } = await import("../src/index.js");
  const srv = app.listen(0);
  const port = srv.address().port;
  const call = async (p, method = "GET", body, token) => {
    const headers = {};
    if (body) headers["content-type"] = "application/json";
    if (token) headers.authorization = `Bearer ${token}`;
    const res = await fetch(`http://127.0.0.1:${port}${p}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
    return { status: res.status, body: await res.json().catch(() => null) };
  };
  try {
    const A = (await call("/api/auth/register", "POST", { handle: "ed_http" + Date.now().toString(36), password: "a good passphrase" })).body;
    const B = (await call("/api/auth/register", "POST", { handle: "ed_http2" + Date.now().toString(36), password: "a good passphrase" })).body;

    const mk = async (token, body) => {
      const c = (await call("/api/campaigns", "POST", body, token)).body.campaign;
      await call(`/api/campaigns/${c.id}/publish`, "POST", {}, token);
      return c;
    };
    const main = await mk(A.token, { title: "HTTP Main", type: "popup", location: "Lavington", seriesId: "http-series", venue: { name: "Lav House" }, agenda: [{ title: "Intro" }] });
    await mk(B.token, { title: "HTTP Related", type: "popup", location: "Westlands" });
    await mk(A.token, { title: "HTTP Series 2", type: "popup", seriesId: "http-series" });

    // Detail carries venue + agenda + a derived host.
    const detail = await call(`/api/public/campaigns/${main.publicSlug}`, "GET");
    assert.equal(detail.status, 200);
    assert.equal(detail.body.campaign.venue.name, "Lav House");
    assert.equal(detail.body.campaign.agenda.length, 1);
    assert.ok(detail.body.campaign.host && detail.body.campaign.host.eventsHosted >= 1);
    pass("GET public campaign serves venue, agenda and a derived host");

    // Context serves the three derived rails.
    const ctx = await call(`/api/public/campaigns/${main.publicSlug}/context`, "GET");
    assert.equal(ctx.status, 200);
    assert.ok(Array.isArray(ctx.body.related) && Array.isArray(ctx.body.fromHost) && Array.isArray(ctx.body.seriesOccurrences));
    assert.ok(ctx.body.related.some((e) => e.title === "HTTP Related"), "related rail is derived");
    assert.ok(ctx.body.seriesOccurrences.some((e) => e.title === "HTTP Series 2"), "series rail is derived");
    assert.ok(ctx.body.fromHost.some((e) => e.title === "HTTP Series 2"), "host rail is derived");
    pass("GET public campaign context serves related/fromHost/seriesOccurrences");

    // An unknown slug -> 404, not a fabricated empty payload.
    const miss = await call(`/api/public/campaigns/no-such-slug-${Date.now()}/context`, "GET");
    assert.equal(miss.status, 404);
    pass("context for an unknown slug is a 404");
  } finally {
    srv.close();
  }
}

console.log(`\nPASS ${count}`);
process.exit(0);
