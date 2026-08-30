// ---------------------------------------------------------------------------
// MSHIKANO — the peer-to-peer cooperation network (Kenyan-born).
//
// "What one person has can help another." The unit is not the product, it is
// the RELATIONSHIP: two people who actually worked together, both sides
// saying so. Everything here follows the repo's honesty rules:
//   * four post intents, matched complementarity (HAVE<->NEED,
//     CAN HELP<->LOOKING FOR), every match carrying WHY it matched;
//   * a cooperation exists only when BOTH parties confirm it — one-sided
//     claims stay pending and count for nothing;
//   * trust is an EVIDENCE LIST derived from confirmed rows (verified
//     cooperations, repeat partners, recommendations, identity verification,
//     disputes) — never a five-star average, never an invented percentage;
//   * empty is empty: no seeded users, no fake cooperation history.
// ---------------------------------------------------------------------------

import { store, newId } from '../store.js';
import * as auth from './auth.js';
import { notify } from './notifications.js';
import { emitSignal } from './signal.js';

export const INTENTS = ['have', 'need', 'can_help', 'looking_for'];
export const COMPLEMENT = { have: 'need', need: 'have', can_help: 'looking_for', looking_for: 'can_help' };
export const INTENT_LABELS = { have: 'Have', need: 'Need', can_help: 'Can help', looking_for: 'Looking for' };

const STOP = new Set(['a', 'an', 'the', 'and', 'or', 'of', 'for', 'in', 'with', 'to', 'is', 'are', 'i', 'my', 'me', 'we', 'our', 'you', 'your', 'on', 'at', 'by', 'who', 'can', 'help', 'need', 'needs', 'have', 'has', 'want', 'looking', 'for']);

function tokens(...texts) {
  const out = new Set();
  for (const t of texts) {
    if (!t) continue;
    for (const w of String(t).toLowerCase().split(/[^a-z0-9]+/)) {
      if (w.length > 2 && !STOP.has(w)) out.add(w);
    }
  }
  return out;
}

// --- posts ---------------------------------------------------------------------

export function createPost(actorId, input = {}) {
  if (!actorId) throw new Error('sign in to post');
  const intent = String(input.intent ?? '');
  if (!INTENTS.includes(intent)) throw new Error(`intent must be one of ${INTENTS.join(', ')}`);
  const title = String(input.title ?? '').trim();
  if (!title || title.length < 4) throw new Error('say what you have or need (at least a few words)');
  const county = input.county ? String(input.county).trim().slice(0, 40) : null;
  const town = input.town ? String(input.town).trim().slice(0, 40) : null;
  return store.insert('coopPosts', {
    id: newId('coop'),
    userId: actorId,
    intent,
    title: title.slice(0, 140),
    body: String(input.body ?? '').trim().slice(0, 600) || null,
    category: input.category ? String(input.category).trim().slice(0, 40) : null,
    town,
    county,
    createdAt: new Date().toISOString(),
    status: 'open'
  });
}

export function removePost(actorId, postId) {
  const post = store.find('coopPosts', (p) => p.id === postId);
  if (!post) throw new Error('post not found');
  if (post.userId !== actorId) throw new Error('only the author may remove a post');
  store.update('coopPosts', postId, { status: 'removed' });
  return true;
}

function authorOf(userId) {
  const u = auth.getUser(userId);
  return {
    id: userId,
    handle: u?.handle ?? null,
    displayName: u?.displayName ?? u?.handle ?? 'A member'
  };
}

/** Public shape of a post: author + DERIVED trust evidence, never a naked score. */
export function postView(p, viewerId = null) {
  const author = authorOf(p.userId);
  return {
    id: p.id,
    intent: p.intent,
    intentLabel: INTENT_LABELS[p.intent],
    title: p.title,
    body: p.body,
    category: p.category,
    town: p.town,
    county: p.county,
    createdAt: p.createdAt,
    status: p.status,
    mine: viewerId != null && p.userId === viewerId,
    author,
    trust: trustFor(p.userId)
  };
}

export function listPosts({ intent = null, q = null, county = null, mine = null } = {}, viewerId = null) {
  let rows = store.all('coopPosts').filter((p) => p.status === 'open');
  if (intent) rows = rows.filter((p) => p.intent === intent);
  if (county) rows = rows.filter((p) => (p.county ?? '').toLowerCase() === String(county).toLowerCase());
  if (mine) rows = rows.filter((p) => p.userId === mine);
  if (q) {
    const qs = tokens(q);
    rows = rows.filter((p) => {
      const pt = tokens(p.title, p.body, p.category);
      return [...qs].some((w) => pt.has(w));
    });
  }
  return rows
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .map((p) => postView(p, viewerId));
}

// --- matching ------------------------------------------------------------------
//
// Complementary intents only (a HAVE matches a NEED, never another HAVE) and
// every match carries its REASONS — token overlap, same county, same town —
// so the UI can say why, and nobody has to trust a black box.

export function matchesForPost(postId, viewerId) {
  const post = store.find('coopPosts', (p) => p.id === postId);
  if (!post) throw new Error('post not found');
  const wanted = COMPLEMENT[post.intent];
  const postTokens = tokens(post.title, post.body, post.category);

  const rows = store.all('coopPosts').filter((p) =>
    p.status === 'open' && p.intent === wanted && p.userId !== post.userId
  );

  return rows.map((p) => {
    const other = tokens(p.title, p.body, p.category);
    const shared = [...postTokens].filter((t) => other.has(t));
    const reasons = [];
    if (shared.length) reasons.push(`both mention: ${shared.slice(0, 4).join(', ')}`);
    if (post.county && p.county && post.county.toLowerCase() === p.county.toLowerCase()) reasons.push(`same county (${p.county})`);
    if (post.town && p.town && post.town.toLowerCase() === p.town.toLowerCase()) reasons.push(`same town (${p.town})`);
    const ageDays = Math.max(0, (Date.now() - Date.parse(p.createdAt)) / 86_400_000);
    const score = shared.length * 10
      + (reasons.some((r) => r.startsWith('same county')) ? 8 : 0)
      + (reasons.some((r) => r.startsWith('same town')) ? 6 : 0)
      + Math.max(0, 6 - ageDays); // gentle recency, never dominant
    return { post: postView(p, viewerId), sharedCount: shared.length, reasons, score: Math.round(score) };
  })
    .filter((m) => m.score > 0 || m.reasons.length > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 12);
}

// --- cooperations (the relationship unit) ---------------------------------------
//
// A cooperation row exists only as a PROPOSAL until the partner confirms.
// Only confirmed rows build the graph and trust. This mirrors the arena
// report/confirm pattern: the two parties are the witnesses.

export function proposeCooperation(actorId, { postId = null, partnerUserId = null, summary = null } = {}) {
  if (!actorId) throw new Error('sign in first');
  if (!partnerUserId) throw new Error('name the partner');
  if (partnerUserId === actorId) throw new Error('you cannot cooperate with yourself');
  if (postId) {
    const post = store.find('coopPosts', (p) => p.id === postId);
    if (!post) throw new Error('post not found');
  }
  const partnership = store.insert('coopPartnerships', {
    id: newId('coopx'),
    postId: postId ?? null,
    fromUserId: actorId,
    toUserId: partnerUserId,
    summary: summary ? String(summary).trim().slice(0, 300) : null,
    status: 'pending',
    recommendations: [],
    createdAt: new Date().toISOString(),
    confirmedAt: null,
    declinedAt: null
  });
  notify(partnerUserId, {
    kind: 'coop',
    title: 'A cooperation is proposed',
    body: `${authorOf(actorId).displayName} says you worked together${summary ? `: ${String(summary).slice(0, 80)}` : ''}. Confirm it so it counts for both of you.`,
    objectId: partnership.id
  });
  return partnership;
}

export function respondToCooperation(actorId, partnershipId, accept) {
  const p = store.find('coopPartnerships', (x) => x.id === partnershipId);
  if (!p) throw new Error('cooperation not found');
  if (p.toUserId !== actorId) throw new Error('only the named partner may respond');
  if (p.status !== 'pending') throw new Error(`this cooperation is already ${p.status}`);
  if (!accept) {
    const row = store.update('coopPartnerships', partnershipId, { status: 'declined', declinedAt: new Date().toISOString() });
    return row;
  }
  const row = store.update('coopPartnerships', partnershipId, { status: 'confirmed', confirmedAt: new Date().toISOString() });
  emitSignal({ type: 'coop_confirmed', actorId, metadata: { cooperationId: row.id, from: row.fromUserId, to: row.toUserId } });
  notify(row.fromUserId, {
    kind: 'coop',
    title: 'Cooperation confirmed',
    body: `${authorOf(row.toUserId).displayName} confirmed you worked together. It now counts on both graphs.`,
    objectId: row.id
  });
  return row;
}

/** Either party to a CONFIRMED cooperation may recommend the other, once, in words. */
export function recommendPartner(actorId, partnershipId, note) {
  const p = store.find('coopPartnerships', (x) => x.id === partnershipId);
  if (!p) throw new Error('cooperation not found');
  if (p.status !== 'confirmed') throw new Error('only a confirmed cooperation can carry a recommendation');
  if (actorId !== p.fromUserId && actorId !== p.toUserId) throw new Error('only the two partners may recommend');
  const text = String(note ?? '').trim();
  if (text.length < 4) throw new Error('say what was good about working together');
  if (p.recommendations.some((r) => r.byUserId === actorId)) throw new Error('you already recommended this cooperation');
  const recs = [...p.recommendations, { byUserId: actorId, forUserId: actorId === p.fromUserId ? p.toUserId : p.fromUserId, note: text.slice(0, 240), at: new Date().toISOString() }];
  return store.update('coopPartnerships', partnershipId, { recommendations: recs });
}

/**
 * A dispute is the honest opposite of a confirmation: one of the two partners
 * says the cooperation on record did not go as written. The row leaves the
 * confirmed graph immediately -- the credit is WITHDRAWN, not deleted -- the
 * dispute is counted on both trust records, and the reason is kept, because
 * an accusation nobody can read is not accountability.
 */
export function disputeCooperation(actorId, partnershipId, reason) {
  const p = store.find('coopPartnerships', (x) => x.id === partnershipId);
  if (!p) throw new Error('cooperation not found');
  if (actorId !== p.fromUserId && actorId !== p.toUserId) throw new Error('only the two partners may raise a dispute');
  if (p.status === 'disputed') throw new Error('this cooperation is already disputed');
  if (p.status !== 'confirmed') throw new Error('only a confirmed cooperation can be disputed');
  const text = String(reason ?? '').trim();
  if (text.length < 4) throw new Error('say what went wrong (a few words at least)');
  const partner = actorId === p.fromUserId ? p.toUserId : p.fromUserId;
  const row = store.update('coopPartnerships', partnershipId, {
    status: 'disputed',
    disputedAt: new Date().toISOString(),
    dispute: { byUserId: actorId, note: text.slice(0, 300), at: new Date().toISOString() }
  });
  notify(partner, {
    kind: 'coop',
    title: 'A cooperation you confirmed is disputed',
    body: `${authorOf(actorId).displayName} says this did not go as written: "${text.slice(0, 120)}". The confirmation no longer counts for either of you until it is resolved.`,
    objectId: partnershipId
  });
  return row;
}

export function listCooperations(actorId) {
  const rows = store.all('coopPartnerships').filter((x) => x.fromUserId === actorId || x.toUserId === actorId);
  const shape = (p) => ({
    ...p,
    direction: p.fromUserId === actorId ? 'outgoing' : 'incoming',
    partner: authorOf(p.fromUserId === actorId ? p.toUserId : p.fromUserId)
  });
  return {
    pending: rows.filter((p) => p.status === 'pending').map(shape),
    confirmed: rows.filter((p) => p.status === 'confirmed').map(shape),
    declined: rows.filter((p) => p.status === 'declined').map(shape),
    // A disputed row stays LISTED for both partners. Withdrawing the credit
    // and hiding it would be two different lies.
    disputed: rows.filter((p) => p.status === 'disputed').map(shape)
  };
}

// --- the cooperation graph + EVIDENCE-BASED trust --------------------------------

export function graphFor(userId) {
  const confirmed = store.all('coopPartnerships').filter((p) => p.status === 'confirmed' && (p.fromUserId === userId || p.toUserId === userId));
  const partnerCount = (p) => (p.fromUserId === userId ? p.toUserId : p.fromUserId);
  const helped = [];
  const received = [];
  const perPartner = {};
  for (const p of confirmed) {
    const other = partnerCount(p);
    perPartner[other] = (perPartner[other] ?? 0) + 1;
    if (p.fromUserId === userId) helped.push({ partnershipId: p.id, with: authorOf(other), at: p.confirmedAt, summary: p.summary });
    else received.push({ partnershipId: p.id, with: authorOf(other), at: p.confirmedAt, summary: p.summary });
  }
  const repeatPartners = Object.entries(perPartner).filter(([, n]) => n >= 2).map(([id]) => authorOf(id));
  return {
    userId,
    helped,
    received,
    totals: { confirmed: confirmed.length, helped: helped.length, received: received.length, repeatPartners: repeatPartners.length },
    repeatPartners
  };
}

/**
 * Trust as EVIDENCE, not a score. Every number below is counted from real
 * confirmed rows; the LEVEL is derived from those counts and says so in
 * words. Nothing here can be bought or clicked into existence: five-star
 * spam contributes exactly nothing.
 */
export function trustFor(userId) {
  const graph = graphFor(userId);
  const recommendations = [];
  for (const p of store.all('coopPartnerships')) {
    if (p.status !== 'confirmed') continue;
    for (const r of p.recommendations ?? []) {
      if (r.forUserId === userId) recommendations.push({ by: authorOf(r.byUserId), note: r.note, at: r.at });
    }
  }
  const identityVerified = Boolean(store.find('verificationRecords', (v) => v.userId === userId && v.status === 'approved'));
  const disputes = store.all('coopPartnerships').filter((p) => (p.status === 'disputed') && (p.fromUserId === userId || p.toUserId === userId)).length;
  const t = graph.totals;
  let level = 'new'; // no confirmed cooperation yet — an honest starting point
  if (t.confirmed >= 1) level = 'cooperating';
  if (t.confirmed >= 3) level = 'proven';
  if (t.repeatPartners >= 1 || t.confirmed >= 8) level = 'established';
  return {
    userId,
    level,
    levelWords: {
      new: 'No confirmed cooperation yet',
      cooperating: 'Has worked with someone, both sides confirmed',
      proven: 'Repeatedly confirmed in cooperation',
      established: 'People come back to cooperate again'
    }[level],
    evidence: {
      confirmedCooperations: t.confirmed,
      repeatPartners: t.repeatPartners,
      recommendations: recommendations.length,
      identityVerified,
      disputes
    },
    recommendationNotes: recommendations.slice(0, 5)
  };
}

// --- "Who can help?" -------------------------------------------------------------
//
// The typed question, answered from real rows only, grouped by who they are.
// Empty groups are EMPTY — never padded with invented members.

export function whoCanHelp(q) {
  const query = String(q ?? '').trim();
  if (query.length < 3) throw new Error('ask a real question (a few words at least)');
  const qs = tokens(query);

  const hit = (...texts) => {
    const pt = tokens(...texts);
    return [...qs].some((w) => pt.has(w));
  };

  const offering = store.all('coopPosts').filter((p) =>
    p.status === 'open' && (p.intent === 'have' || p.intent === 'can_help') && hit(p.title, p.body, p.category)
  );

  const vendorIds = new Set(store.all('vendors').filter((v) => v.status === 'active' && hit(v.displayName, v.description)).map((v) => v.id));
  const businessPosts = offering.filter((p) => store.find('vendors', (v) => v.ownerId === p.userId && v.status === 'active'));
  const peoplePosts = offering.filter((p) => !businessPosts.includes(p));

  const guides = store.all('teaArticles')
    .filter((a) => a.status === 'published' && hit(a.title, a.dek, a.body))
    .slice(0, 4)
    .map((a) => ({ id: a.id, slug: a.slug, title: a.title }));

  // Groups answer honestly too: real circles whose name or description
  // matches the question, surfaced with their ACTUAL member count. No circle
  // matches -> [] and 0, and the answer says so rather than padding.
  const groups = store.all('circles')
    .filter((c) => hit(c.name, c.description))
    .slice(0, 4)
    .map((c) => ({
      id: c.id,
      name: c.name,
      description: c.description || null,
      visibility: c.visibility ?? null,
      members: store.filter('members', (m) => m.circleId === c.id).length
    }));

  return {
    query,
    counts: {
      people: peoplePosts.length,
      businesses: businessPosts.length,
      groups: groups.length,
      guides: guides.length
    },
    people: peoplePosts.slice(0, 8).map((p) => postView(p)),
    businesses: businessPosts.slice(0, 6).map((p) => ({ ...postView(p), vendorIds: [...vendorIds] })),
    groups,
    guides
  };
}
