// ---------------------------------------------------------------------------
// ESCROW-AS-RECORDS — one honest read layer over the existing escrow patterns.
//
// Brief holds no money (no provider is configured; the compliance gate owns
// the door). But three flows already RECORD funds held between two sides
// until a real-world fact releases them:
//
//   GROUP BUY     contributions pool toward a target; the "Merchant Escrow
//                 Locked" stage holds them until delivery.
//   TICKETS       a resale order holds the buyer's price between order and
//                 confirm-received.
//   HUDUMA        orders hold a citizen's payment until the result is
//                 delivered (phone-keyed, so it is not attributed in
//                 /mine — an operator reads it at the desk).
//
// This module stores NOTHING. It derives "what is held on your behalf, and
// what has been released" from those rows, so a member has one place to see
// escrow across Brief instead of three. When a fourth escrow pattern appears,
// it gets an adapter here — not a second source of truth.
// ---------------------------------------------------------------------------

import { store } from '../store.js';

function groupBuyRows(userId) {
  const mine = store.filter('groupBuys', (b) => b.ownerId === userId);
  const contributed = store
    .filter('groupBuyContributions', (c) => c.memberRef === userId || c.actorId === userId)
    .map((c) => c.groupBuyId);
  const ids = new Set([...mine.map((b) => b.id), ...contributed]);
  return [...ids]
    .map((id) => store.find('groupBuys', (b) => b.id === id))
    .filter(Boolean)
    .map((b) => {
      const total = store
        .filter('groupBuyContributions', (c) => c.groupBuyId === b.id)
        .reduce((t, c) => t + c.amount, 0);
      const stageOrder = ['funding', 'target_met', 'escrow', 'dispatched', 'delivered'];
      const idx = stageOrder.indexOf(b.stage);
      // Held once the merchant escrow locks; released at delivery.
      const locked = idx >= 2;
      const released = b.stage === 'delivered';
      return {
        id: `esc_gb_${b.id}`,
        kind: 'group_buy',
        refId: b.id,
        title: b.title,
        role: b.ownerId === userId ? 'owner' : 'contributor',
        state: released ? 'released' : locked ? 'locked' : 'pending',
        amountKes: total,
        updatedAt: b.updatedAt ?? b.createdAt
      };
    });
}

function ticketRows(userId) {
  return store
    .filter('ticketOrders', (o) => o.buyerId === userId || o.sellerId === userId)
    .map((o) => ({
      id: `esc_tk_${o.id}`,
      kind: 'ticket',
      refId: o.id,
      title: o.reference,
      role: o.buyerId === userId ? 'buyer' : 'seller',
      // Held between order and confirm-received; released when received.
      state: o.status === 'completed' ? 'released' : o.status === 'cancelled' ? 'refunded' : 'locked',
      amountKes: o.total,
      updatedAt: o.updatedAt ?? o.createdAt
    }));
}

/** Everything held or released for one member, across all escrow patterns. */
export function myEscrows(userId) {
  const rows = [...groupBuyRows(userId), ...ticketRows(userId)].sort((a, b) =>
    String(b.updatedAt).localeCompare(String(a.updatedAt))
  );
  const held = rows.filter((r) => r.state === 'locked');
  const released = rows.filter((r) => r.state === 'released');
  return {
    rows,
    totals: {
      heldKes: held.reduce((t, r) => t + r.amountKes, 0),
      releasedKes: released.reduce((t, r) => t + r.amountKes, 0),
      heldCount: held.length
    },
    note: 'Records of funds held between two sides until delivery — Brief moves no money itself. HudumaLink citizen escrow is phone-keyed and read at the operator desk.'
  };
}
