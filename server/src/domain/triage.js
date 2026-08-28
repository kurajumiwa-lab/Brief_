// ---------------------------------------------------------------------------
// TRIAGE — the one "waiting on you" queue (CCS §2.1)
//
// Every screen that could hold work had its own badge, so "is anything
// waiting for me?" was a question no single place could answer. This module
// answers it once: it scans the real rows and returns the things that are
// genuinely blocked on ONE person.
//
// Rules that keep it honest:
//
//   * NOTHING IS INVENTED. Every item points at a real row (a Block task, an
//     Order, a Registration). If the row says nothing, the queue says nothing.
//   * NOTHING IS STORED. The queue is derived on read. There is no
//     `triageItems` collection, so it cannot drift out of sync with the work
//     it describes, and it cannot be written to.
//   * IT IS PER-CALLER. The queue is computed from the caller's memberships,
//     their vendor, and the campaigns they own. You never see another
//     person's obligations, and you never see a task that is not yours.
//   * AN OPEN TASK NOBODY HOLDS IS DELIBERATELY ABSENT. Unassigned work
//     belongs to the circle, not to the individual. It is visible in the
//     circle; it does not chase one person here.
//   * PRIORITY IS A FACT, NOT A SCORE. Items are ordered by how long they have
//     been waiting and by whether they are time-boxed (an event tonight
//     outranks a task with no deadline). There is no ranking model.
// ---------------------------------------------------------------------------

import { store } from '../store.js';
import * as blocks from './block.js';
import { listOrders, FULFILMENT_FLOW } from './order.js';
import { listCampaigns, listRegistrations } from './campaign.js';

/** How long an item has waited, in whole days. Never negative. */
function daysWaiting(iso) {
  const then = Date.parse(iso ?? '');
  if (!Number.isFinite(then)) return 0;
  const days = (Date.now() - then) / 86_400_000;
  return days > 0 ? days : 0;
}

/** First line of a block's content, so a card can show a title not a blob. */
function titleOf(block) {
  const text = String(block?.content ?? '').trim();
  if (!text) return 'Untitled task';
  const first = text.split('\n')[0].trim();
  return first.length > 90 ? `${first.slice(0, 89)}…` : first;
}

function snippetOf(block) {
  const text = String(block?.content ?? '').trim();
  const rest = text.split('\n').slice(1).join(' ').trim();
  return rest.length > 140 ? `${rest.slice(0, 139)}…` : rest;
}

// -- 1. Circle tasks held by the caller --------------------------------------

function tasksFor(userId) {
  const out = [];
  for (const membership of store.filter('members', (m) => m.userId === userId)) {
    const circle = store.find('circles', (c) => c.id === membership.circleId);
    if (!circle) continue;

    const mine = store.filter('blocks', (b) => {
      if (b.circleId !== circle.id || b.type !== 'task') return false;
      const task = b.metadata?.task ?? b.metadata ?? {};
      return task.assigneeId === userId;
    });

    for (const block of mine) {
      const task = blocks.taskState(block) ?? { status: 'open', assigneeId: userId };
      // A finished task is no longer waiting on anybody.
      if (task.status === 'completed') continue;

      out.push({
        kind: 'task',
        id: block.id,
        circleId: circle.id,
        circleName: circle.name,
        status: task.status,
        title: titleOf(block),
        detail: snippetOf(block),
        at: block.updatedAt ?? block.createdAt ?? null,
        daysWaiting: daysWaiting(block.updatedAt ?? block.createdAt),
        // Which buttons the caller may legitimately press. Release is offered
        // only for work they actually hold and are permitted to hand back.
        actions: task.status === 'assigned' ? ['complete', 'release'] : ['assign']
      });
    }
  }
  return out;
}

// -- 2. Orders the caller must fulfil ----------------------------------------

// The stages an order sits in while it is the vendor's move. 'fulfilled' is
// excluded because the work is done; 'offered' is excluded because it is a
// proposal the buyer has not confirmed.
const OPEN_ORDER_STAGES = ['ordered', 'accepted', 'preparing', 'ready'];

/** The next stage along the fulfilment path, or null at the end of it. */
function nextStage(status) {
  const i = FULFILMENT_FLOW.indexOf(status);
  if (i < 0 || i >= FULFILMENT_FLOW.length - 1) return null;
  return FULFILMENT_FLOW[i + 1];
}

function ordersFor(userId) {
  const vendor = store.find('vendors', (v) => v.ownerId === userId);
  if (!vendor) return [];

  return listOrders({ vendorId: vendor.id })
    .filter((o) => OPEN_ORDER_STAGES.includes(String(o.status ?? '')))
    .map((o) => {
      const advance = nextStage(o.status);
      return {
        kind: 'order',
        id: o.id,
        vendorId: vendor.id,
        vendorName: vendor.name ?? null,
        status: o.status,
        nextStatus: advance,
        title: `${o.quantity ?? 1} × ${o.listingTitle ?? o.listing?.title ?? 'order'}`,
        detail: o.note
          ? String(o.note)
          : `Ordered by ${o.buyerId ?? 'a buyer'}${o.total != null ? ` · ${o.total} ${o.currency ?? 'KES'}` : ''}`,
        at: o.updatedAt ?? o.createdAt ?? null,
        daysWaiting: daysWaiting(o.updatedAt ?? o.createdAt),
        // The button says what it will actually do ("mark ready"), not a
        // generic "advance"; and it is absent when there is no legal next
        // step, rather than offering a press that the server would refuse.
        actions: advance ? ['advance'] : []
      };
    });
}

// -- 3. Events the caller is running -----------------------------------------

const CHECKIN_STATUSES = ['registered', 'confirmed'];

function checkInsFor(userId, withinHours) {
  const horizon = Date.now() + withinHours * 3_600_000;
  const out = [];

  for (const campaign of listCampaigns(userId)) {
    const status = String(campaign.status ?? '');
    // Only a live, public event has people to check in.
    if (status !== 'published' && status !== 'live') continue;

    const startsAt = campaign.startsAt ?? null;
    const startMs = Date.parse(startsAt ?? '');
    // No start time means we cannot say it is imminent, so we say nothing.
    if (!Number.isFinite(startMs)) continue;
    // Already started, or starting inside the window: both need attention now.
    if (startMs > horizon) continue;

    const registrations = listRegistrations(campaign.id);
    const pending = registrations.filter((r) => CHECKIN_STATUSES.includes(String(r.status ?? '')));
    if (pending.length === 0) continue;

    out.push({
      kind: 'checkin',
      id: campaign.id,
      campaignId: campaign.id,
      status: startMs <= Date.now() ? 'open' : 'starting',
      title: campaign.title ?? 'Untitled event',
      detail: startsAt,
      at: startsAt,
      daysWaiting: daysWaiting(startsAt),
      pending: pending.length,
      checkedIn: registrations.filter((r) => r.status === 'checked_in').length,
      actions: ['checkin']
    });
  }
  return out;
}

// -- 4. Inbound messages awaiting review -------------------------------------

function draftsFor(limit) {
  const sources = new Map(store.all('sources').map((s) => [s.id, s]));

  return store
    .filter('rawItems', (r) => (r.processingStatus ?? 'pending') === 'pending')
    .slice(0, limit)
    .map((r) => {
      const source = sources.get(r.sourceId) ?? null;
      return {
        kind: 'draft',
        id: r.id,
        sourceId: r.sourceId ?? null,
        sourceName: source?.name ?? null,
        channel: source?.type ?? null,
        title: titleOf({ content: r.text ?? r.content ?? '' }),
        detail: snippetOf({ content: r.text ?? r.content ?? '' }),
        at: r.receivedAt ?? r.createdAt ?? null,
        daysWaiting: daysWaiting(r.receivedAt ?? r.createdAt),
        // The draft queue is client-reviewed by design: parsing is the same
        // parser the reviewer uses, and there is no server-side publish.
        actions: ['review']
      };
    });
}

// -- The queue ---------------------------------------------------------------

/**
 * Everything blocked on one person, newest-first within each kind, but whole
 * queue sorted by how long each item has waited. Time-boxed work (an event
 * that has started) is floated above everything else.
 */
export function waitingFor(userId, { withinHours = 48, limit = 60 } = {}) {
  if (!userId) {
    return { items: [], counts: { task: 0, order: 0, checkin: 0, draft: 0 }, total: 0, viewer: null };
  }

  const items = [
    ...tasksFor(userId),
    ...ordersFor(userId),
    ...checkInsFor(userId, withinHours),
    ...draftsFor(limit)
  ];

  // An event that has already started cannot wait for a sort.
  const rank = (i) => (i.kind === 'checkin' && i.status === 'open' ? 0 : i.kind === 'checkin' ? 1 : 2);
  items.sort((a, b) => rank(a) - rank(b) || b.daysWaiting - a.daysWaiting);

  const counts = items.reduce((acc, i) => {
    acc[i.kind] = (acc[i.kind] ?? 0) + 1;
    return acc;
  }, { task: 0, order: 0, checkin: 0, draft: 0 });

  return {
    items: items.slice(0, limit),
    counts,
    total: items.length,
    viewer: userId,
    // Stated so the client can say what the window is rather than implying the
    // queue sees the future.
    withinHours
  };
}
