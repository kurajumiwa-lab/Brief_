import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
process.env.NODE_ENV = "test";
process.env.BRIEF_DEV_AUTH = "0";
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "brief-overlap-"));
process.env.BRIEF_DATA_DIR = dir;

const { store } = await import("../src/store.js"),
  auth = await import("../src/domain/auth.js"),
  chama = await import("../src/domain/chama.js");
const events = await import("../src/domain/events.js");
let count = 0;
const pass = (name) => { count++; console.log("PASS " + name); };

// A chama of 3. The owner is the viewer; a member registers for an event.
const owner = auth.createUser({ handle: "ov_owner", password: "overlap-pw" });
const m2 = auth.createUser({ handle: "ov_m2", password: "overlap-pw" });
const m3 = auth.createUser({ handle: "ov_m3", password: "overlap-pw" });
const c = chama.createChama({ ownerId: owner.id, name: "Overlap Chama", contributionAmount: 5000 });
chama.joinChama(c.id, m2.id);
chama.joinChama(c.id, m3.id);

// A published campaign (event) + a registration by a chama member.
const campaigns = await import("../src/domain/campaign.js");
const event = campaigns.createCampaign(owner.id, { title: "Overlap Event", type: "event", location: "Nairobi" });
campaigns.transitionCampaign(event.id, "published");
const publishedEvent = store.find("campaigns", (c) => c.id === event.id); // re-read after transition
campaigns.register(publishedEvent, { attendeeRef: "m2-ref", userId: m2.id });

// ---------------------------------------------------------------------------
// chamaOverlap: null anonymously; derived per viewer.
// ---------------------------------------------------------------------------
{
  // Anonymous (viewerId null): no overlap can be computed.
  const anon = events.browseEvents({ viewerId: null });
  const e = anon.events.find((x) => x.title === "Overlap Event");
  assert.equal(e.chamaOverlap, null, "anonymous browse reports null overlap");
  pass("chamaOverlap is null for an anonymous viewer");

  // The owner (viewer) is in the chama; one member registered -> overlap.
  const ownerView = events.browseEvents({ viewerId: owner.id });
  const eo = ownerView.events.find((x) => x.title === "Overlap Event");
  assert.ok(eo.chamaOverlap, "overlap present for the owner");
  assert.equal(eo.chamaOverlap.length, 1);
  assert.equal(eo.chamaOverlap[0].chamaName, "Overlap Chama");
  assert.equal(eo.chamaOverlap[0].memberCount, 1, "one chama member registered");
  pass("chamaOverlap is derived for the viewer: 1 from Overlap Chama");

  // A member who IS in the chama also sees the overlap.
  const m2View = events.browseEvents({ viewerId: m2.id });
  const e2 = m2View.events.find((x) => x.title === "Overlap Event");
  assert.equal(e2.chamaOverlap[0].memberCount, 1);
  pass("a chama member sees the same derived overlap");

  // A viewer in NO chama sees null, even with a session.
  const stranger = auth.createUser({ handle: "ov_stranger", password: "overlap-pw" });
  const strangerView = events.browseEvents({ viewerId: stranger.id });
  const es = strangerView.events.find((x) => x.title === "Overlap Event");
  assert.equal(es.chamaOverlap, null, "no chama -> null overlap");
  pass("a viewer with no chama sees null overlap");
}

console.log(`\nPASS ${count}`);
process.exit(0);
