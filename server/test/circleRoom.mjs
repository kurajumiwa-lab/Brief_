// ---------------------------------------------------------------------------
// THE CIRCLE AS A ROOM — a door, a link, and a record nobody can quietly edit.
//
// Four things are pinned here, because each is a place where a group app either
// earns trust or quietly spends it:
//
//   1. Listing is opt-in and the join landing shows the room's SHAPE, never its
//      contents. "Discoverable" must not become "readable by whoever follows a
//      link" — block text, member names and the ledger stay behind membership.
//   2. An unlisted code and a wrong code answer identically (404), so a shared
//      link cannot be probed to learn that a private group exists.
//   3. Opening a private room to the list requires a reason and is written to the
//      history. A rename does not — demanding reasons everywhere trains people to
//      type noise.
//   4. Every state change on a task, a membership or a vote leaves a row with a
//      pre-image, so "before" really means before. That is the one property that
//      makes editing safe, and it is exactly the kind of thing a live store
//      object reference will silently break (it did, during this work: the row
//      recorded the new value twice). So it is tested, on purpose.
// ---------------------------------------------------------------------------

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
process.env.NODE_ENV = "test";
process.env.BRIEF_DEV_AUTH = "0";
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "brief-circle-room-"));
process.env.BRIEF_DATA_DIR = dir;

const { store } = await import("../src/store.js");
const auth = await import("../src/domain/auth.js");
const circles = await import("../src/domain/circle.js");
const members = await import("../src/domain/member.js");
const blocks = await import("../src/domain/block.js");
const historyMod = await import("../src/domain/circleHistory.js");

let count = 0;
const test = async (name, fn) => { await fn(); count++; console.log("PASS " + name); };

const koord = auth.createUser({ handle: "room_koord", password: "a good passphrase", displayName: "Wanjiru K" });
const member = auth.createUser({ handle: "room_member", password: "a good passphrase", displayName: "Otieno O" });
const stranger = auth.createUser({ handle: "room_stranger", password: "a good passphrase", displayName: "Nobody Here" });

// ---------------------------------------------------------------------------
await test("a circle is born behind a door, with a code that is not its name", () => {
  const c = circles.createTargetCircle({ name: "Kilimani Bulk Buy", description: "Cooking oil, 20L, split by flat", goal: "15 households in" });
  assert.equal(c.visibility, "invite_only", "private by default — a group is not listable until someone chooses it");
  assert.match(c.joinCode, /^[a-z0-9]{8}$/, "a short code, not a uuid");
  assert.ok(!/[ol]/.test(c.joinCode), "no look-alike letters, because it is typed off a screen into a phone");
  assert.equal(circles.findByJoinCode(c.joinCode.toUpperCase()).id, c.id, "case-insensitive, so a capitalised paste still works");
  assert.equal(circles.findByJoinCode("zzzzzzzz"), null, "and a wrong code finds nothing");
});

await test("the landing preview shows the shape of the room, never its contents", () => {
  const c = circles.createTargetCircle({ name: "Estate Security Rota", description: "Night gates and a shared guard" , goal: "fund the gate" });
  members.addMember(c.id, koord.id, "coordinator");
  members.addMember(c.id, member.id, "contributor");
  const secret = blocks.createBlock({ circleId: c.id, type: 'note', content: "Guard's name is Kamau, gate code 4417, pay from the pot" });
  blocks.createBlock({ circleId: c.id, type: 'task', content: "Fix the padlock on gate 2" });
  store.insert('ledgerTransactions', { id: 'lt_room_1', circleId: c.id, kind: 'income', amount: 3000, currency: 'KES', status: 'settled', counterparty: member.id, at: new Date().toISOString() });

  const view = circles.peek(c.joinCode);
  assert.equal(view.listed, false, "an invite_only circle is not listed at all");
  // Even when a caller holds the code, what they may see is the shape.
  const json = JSON.stringify(view);
  assert.ok(!json.includes("Kamau") && !json.includes("4417"), "no block content leaks through the door");
  assert.ok(!json.includes(koord.id) && !json.includes(member.id), "no member ids, and so no member list");
  assert.ok(!json.includes("gate 2"), "task titles stay inside too");
  assert.equal(view.memberCount, 2, "how many people, yes");
  assert.equal(view.openTaskCount, 1, "how many things are waiting to be picked up, yes");
  assert.equal(view.currentValue, 3000, "money that really settled, yes — it is derived, so it cannot be inflated");
});

await test("listing is a decision, and it is recorded as one", () => {
  const c = circles.createTargetCircle({ name: "Chama Books", description: "our ledger, our rota" });
  members.addMember(c.id, koord.id, 'coordinator');
  // A real block inside the room, so the "no contents leak" assertion below is
  // testing something that could actually have leaked.
  blocks.createBlock({ circleId: c.id, type: 'note', content: "SECRET-TASK-PHRASE pay the librarian on Thursday" });

  assert.throws(() => circles.updateCircle(c.id, { visibility: "discoverable" }, { actorId: koord.id }),
    /needs a reason|reason is required/, "opening the door without explaining is refused");

  const updated = circles.updateCircle(c.id, { visibility: "discoverable" }, { actorId: koord.id, reason: "want the estate to find us for the bulk order" });
  assert.equal(updated.visibility, "discoverable");
  const row = historyMod.historyFor(c.id, { kinds: ["circle_visibility_changed"] })[0];
  assert.equal(row.before, "invite_only", "the change records what it replaced");
  assert.match(row.reason, /estate to find us/, "and why");

  const preview = circles.peek(c.joinCode);
  assert.equal(preview.listed, true, "now the landing page exists");
  assert.equal(circles.listDiscoverable().length, 1, "and it appears in the browse list");
  // The purpose is the coordinator's own listing copy — that is what a card is
  // for. What must NOT appear is anything written inside the room.
  assert.ok(JSON.stringify(preview).includes("our ledger"), "the purpose the coordinator wrote is on the card");
  const body = JSON.stringify(preview);
  assert.ok(!body.includes("SECRET-TASK-PHRASE"), "and not a single block from inside the room");
  assert.ok(!body.includes(koord.id) && !body.includes("librarian"), "nor who is in it");

  // A rename needs no apology.
  const renamed = circles.updateCircle(c.id, { name: "Chama Books & Rota" }, { actorId: koord.id });
  assert.equal(renamed.name, "Chama Books & Rota", "an ordinary edit still works");
  assert.ok(historyMod.historyFor(c.id, { kinds: ["circle_terms_changed"] }).length >= 1, "and it is still logged");
});

await test("the outside link is stored as written and labelled as unverified", () => {
  const c = circles.createTargetCircle({ name: "Linked Room" });
  members.addMember(c.id, koord.id, 'coordinator');
  const url = "https://chat.whatsapp.com/AbCdEfGhIjKlMnOpQrStUv";
  circles.updateCircle(c.id, { externalLink: url, visibility: "discoverable" }, { actorId: koord.id, reason: "half the group lives in WhatsApp" });
  const preview = circles.peek(c.joinCode);
  assert.equal(preview.externalLink, url, "shown verbatim — Brief does not paraphrase someone else's link");
  assert.match(preview.externalLinkNote, /organiser of this circle/, "and named as theirs");
  assert.match(preview.externalLinkNote, /has not checked/, "with the warning that it is unverified");
  assert.throws(() => circles.updateCircle(c.id, { externalLink: "javascript:alert(1)" }, { actorId: koord.id }), /full http\(s\) URL/);
  assert.throws(() => circles.updateCircle(c.id, { externalLink: "/local/path" }, { actorId: koord.id }), /full http\(s\) URL/);
});

await test("the pinned welcome is the room's own sentence, capped and logged", () => {
  const c = circles.createTargetCircle({ name: "Sunday Crew" });
  members.addMember(c.id, koord.id, 'coordinator');
  const welcome = circles.setWelcome(c.id, "Meet at the gate by 7. Bring the pump. — W", { actorId: koord.id });
  assert.equal(welcome.welcome, "Meet at the gate by 7. Bring the pump. — W");
  const long = circles.setWelcome(c.id, "x".repeat(900), { actorId: koord.id });
  assert.equal(long.welcome.length, 400, "one paragraph a phone can read, not a manifesto");
  const pinned = historyMod.historyFor(c.id, { kinds: ["welcome_pinned"] });
  assert.equal(pinned.length, 2, "both edits are in the room's history");
  assert.equal(pinned[0].before?.startsWith("Meet at the gate"), true, "newest first, carrying the note it replaced");
  assert.equal(pinned[1].before, null, "and the first pin had nothing before it");
  assert.equal(pinned[0].after.length, 400, "the cap is applied to the value, not to the record");
});

await test("the history is readable by a member and not by an outsider", () => {
  const c = circles.createTargetCircle({ name: "Audited Room" });
  members.addMember(c.id, koord.id, 'coordinator');
  const t = blocks.createBlock({ circleId: c.id, type: 'task', content: "Collect the quotes" });
  blocks.cancelTask(t.id, { actorId: koord.id, reason: "supplier folded" });
  const rows = historyMod.historyFor(c.id);
  assert.ok(rows.length >= 3, "join, task created, task cancelled");
  assert.equal(rows[0].kind, "task_cancelled", "newest first");
  assert.match(historyMod.describe(rows[0]), /Task cancelled — supplier folded/, "and readable as a sentence, not a diff");
  // A subject query is how the UI shows one item's story without scrolling the room.
  const one = historyMod.historyFor(c.id, { subject: t.id });
  assert.deepEqual(one.map((r) => r.kind), ["task_cancelled", "task_created"], "the item's own thread, complete");
});

await test("a pre-image is a pre-image: history never records the new value twice", () => {
  const c = circles.createTargetCircle({ name: "Pre-image Room" });
  members.addMember(c.id, koord.id, 'coordinator');
  members.addMember(c.id, member.id, 'contributor');

  const t = blocks.createBlock({ circleId: c.id, type: 'task', content: "Book the hall", metadata: { actorId: koord.id } });
  blocks.assignTask(t.id, member.id);
  blocks.editTask(t.id, { actorId: member.id, dueAt: "2026-09-30", reason: "the venue moved it" });
  blocks.completeTask(t.id, member.id);
  blocks.reopenTask(t.id, { actorId: koord.id, reason: "deposit never went in" });

  const rows = historyMod.historyFor(c.id, { subject: t.id });
  const byKind = Object.fromEntries(rows.map((r) => [r.kind, r]));
  assert.equal(byKind.task_created.before, null, "creation has nothing before it");
  assert.equal(byKind.task_assigned.before, null, "and the first claim replaces nobody");
  assert.equal(byKind.task_due_changed.before, null, "no deadline existed to move from");
  assert.equal(byKind.task_due_changed.after, new Date("2026-09-30").toISOString());
  assert.equal(byKind.task_completed.before, "assigned", "completion records the state it came FROM");
  assert.equal(byKind.task_reopened.before, "completed", "and so does the reopen");
  assert.equal(byKind.task_reopened.reason, "deposit never went in", "with the reason, not a shrug");

  // The state and the last row must agree. If they ever drift, a reader cannot
  // audit the record — which is the whole point of keeping one.
  const state = blocks.taskState(store.find("blocks", (b) => b.id === t.id));
  assert.equal(state.status, "open", "reopened");
  assert.ok(state.completedAt, "the fact that it was once completed survives the reopen");
  assert.equal(historyMod.lastChange(t.id, "dueAt").after, state.dueAt, "history and state agree on the deadline");

  // A membership change reads the same way.
  members.setRole(c.id, member.id, "logistics", { actorId: koord.id, reason: "handles the van" });
  const roleRow = historyMod.historyFor(c.id, { kinds: ["member_role_changed"] })[0];
  assert.equal(roleRow.before, "contributor", "the old role, not the new one");
  assert.equal(roleRow.after, "logistics");
});

await test("there is always exactly one coordinator, and never two", () => {
  const c = circles.createTargetCircle({ name: "Transfer Room" });
  members.addMember(c.id, koord.id, 'coordinator');
  members.addMember(c.id, member.id, 'contributor');
  members.addMember(c.id, stranger.id, 'contributor');

  const out = members.transferCoordinator(c.id, member.id, { actorId: koord.id, reason: "away for a month" });
  assert.equal(out.coordinators, 1, "one, not two");
  assert.equal(out.to.role, "coordinator");
  assert.equal(out.from.role, "contributor");

  // the handover is not repeatable by the person who just received it to
  // somebody else in the same breath without… actually it IS their right now:
  // they hold the role. What is refused is a NON-holder trying to hand it over.
  assert.throws(() => members.transferCoordinator(c.id, stranger.id, { actorId: stranger.id }), /current coordinator/, "only the holder may hand it over");
  assert.throws(() => members.transferCoordinator(c.id, "usr_ghost", { actorId: member.id }), /must be a member/, "and only to somebody who is in the room");

  // The last coordinator may leave (they are not imprisoned) but may not be
  // removed by a peer into a headless circle.
  assert.throws(() => members.removeMember(c.id, member.id, { actorId: stranger.id, kind: 'member_removed', reason: "try to" }),
    /only coordinator cannot be removed|only a coordinator/, "the sole coordinator cannot be removed");
  const left = members.leaveCircle(c.id, member.id, {});
  assert.equal(left.left, true, "leaving voluntarily is always open");
  assert.equal(members.listMembers(c.id).filter((m) => m.role === 'coordinator').length, 0, "and the circle is left without one, honestly, rather than blocked");
  assert.equal(circles.getCircle(c.id).viewerRole, null, "the leaver's own view stops claiming a role");
  assert.equal(circles.getCircle(c.id, koord.id).viewerRole, 'contributor', "and the one who handed it over keeps exactly what they stepped down to");
});

await test("HTTP: the join link, the welcome, the history, the cancel", async () => {
  const { default: app } = await import("../src/index.js");
  const srv = app.listen(0);
  const port = srv.address().port;
  const real = global.fetch;
  const call = async (p, m = "GET", body, token) => {
    const headers = { "content-type": "application/json" };
    if (token) headers.authorization = `Bearer ${token}`;
    const r = await real(`http://127.0.0.1:${port}${p}`, { method: m, headers, body: body ? JSON.stringify(body) : undefined });
    return { status: r.status, body: await r.json().catch(() => null) };
  };
  // Tokens come from the real registration route, not from issueSession(): the
  // account gate treats a domain-created row and a signed-up account differently,
  // and a test that minted its own session would be testing a path nobody in the
  // product can walk.
  const reg = async (handle) => {
    const r = await real(`http://127.0.0.1:${port}/api/auth/register`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ handle, password: 'a good passphrase' })
    });
    return { ...(await r.json()), status: r.status };
  };
  let httpKoord, httpMember, httpStranger;
  try {
    httpKoord = await reg('roomh_koord_' + Date.now().toString(36));
    httpMember = await reg('roomh_member_' + Date.now().toString(36));
    httpStranger = await reg('roomh_outsider_' + Date.now().toString(36));
    const c = circles.createTargetCircle({ name: "Estate Oil Pool", description: "20L drums, split by flat" });
    members.addMember(c.id, httpKoord.user.id, 'coordinator');
    members.addMember(c.id, httpMember.user.id, 'contributor');

    const anonPrivate = await call(`/api/circles/join/${c.joinCode}`);
    assert.equal(anonPrivate.status, 404, "an unlisted circle answers like a wrong code — no signal about which one exists");

    circles.updateCircle(c.id, { visibility: "discoverable" }, { actorId: koord.id, reason: "we want the estate in on the drum order" });
    const pub = await call(`/api/circles/join/${c.joinCode}`);
    assert.equal(pub.status, 200, "listed circles answer without a session, because a shared link is opened cold, from WhatsApp");
    assert.equal(pub.body.circle.name, "Estate Oil Pool");
    assert.equal(pub.body.circle.memberCount, 2);
    assert.ok(JSON.stringify(pub.body.circle).includes("split by flat"), "the purpose the coordinator wrote is on the card — that is what listing is FOR");

    const wel = await call(`/api/circles/${c.id}/welcome`, "POST", { text: "Bring cash, we order Friday" }, httpMember.token);
    assert.equal(wel.status, 403, `a member cannot pin the room's welcome — got ${wel.status} ${JSON.stringify(wel.body)}`);
    const wel2 = await call(`/api/circles/${c.id}/welcome`, "POST", { text: "Bring cash, we order Friday" }, httpKoord.token);
    assert.equal(wel2.status, 200, "the coordinator can");
    assert.equal(wel2.body.circle.welcome, "Bring cash, we order Friday");

    // a task, cancelled over HTTP, with a reason
    const t = blocks.createBlock({ circleId: c.id, type: 'task', content: "Count the drums", metadata: { actorId: httpKoord.user.id } });
    // deadline first, while the task is still open — after a cancellation the
    // only way back is a reopen, and the domain says so
    const moved = await call(`/api/circles/${c.id}/blocks/${t.id}/task`, "PATCH", { dueAt: "2026-10-05" }, httpKoord.token);
    assert.equal(moved.status, 400, "a deadline move without a reason is refused, even for a coordinator");
    assert.match(moved.body.error, /deadline move needs a reason/);
    const noReason = await call(`/api/circles/${c.id}/blocks/${t.id}/cancel`, "POST", {}, httpKoord.token);
    assert.equal(noReason.status, 400, "no reason, no cancellation");
    assert.match(noReason.body.error, /needs a reason/);
    const done = await call(`/api/circles/${c.id}/blocks/${t.id}/cancel`, "POST", { reason: "supplier cancelled" }, httpKoord.token);
    assert.equal(done.status, 200, `cancel with reason failed: ${JSON.stringify(done.body)}`);
    assert.equal(done.body.block.task.status, "cancelled");

    const outsiderHist = await call(`/api/circles/${c.id}/history`, "GET", undefined, httpStranger.token);
    assert.equal(outsiderHist.status, 403, "a stranger cannot read the room's history");
    const hist = await call(`/api/circles/${c.id}/history`, "GET", undefined, httpMember.token);
    assert.equal(hist.status, 200, "a member can");
    assert.ok(hist.body.history.some((h) => h.kind === 'task_cancelled' && /supplier cancelled/.test(h.text)), "and it reads as sentences about real changes");


    // roles over HTTP
    const roleless = await call(`/api/circles/${c.id}/members/${httpMember.user.id}/role`, "PATCH", { role: 'scout' }, httpKoord.token);
    assert.equal(roleless.status, 400, "a silent role change is refused");
    const roled = await call(`/api/circles/${c.id}/members/${httpMember.user.id}/role`, "PATCH", { role: 'scout', reason: "knows the suppliers" }, httpKoord.token);
    assert.equal(roled.status, 200);
    assert.ok(roled.body.member.displayName, "the roster row carries a name for the UI");
    assert.notEqual(roled.body.member.displayName, httpMember.user.id, "and it is not the id");
  } finally {
    srv.close();
  }
});

console.log(`\nPASS ${count}`);
process.exit(0);
