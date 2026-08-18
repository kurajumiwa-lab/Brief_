// ---------------------------------------------------------------------------
// AUCTION
//
// The chain, unchanged from the rest of Brief:
//
//   Object -> Listing -> Auction -> Bid -> Close -> Winner
//        -> Order -> Payment -> Ledger -> Settlement -> Payout + commission
//
// An auction is a PRICE DISCOVERY MECHANISM bolted onto the existing listing,
// not a second marketplace. When it closes, the winner gets an ordinary Order
// against the ordinary listing, which flows through the ordinary payment,
// ledger, settlement and payout code. There is no auction wallet, no auction
// balance, no auction commission rate and no auction transaction type.
//
// FIVE RULES, EACH ENFORCED BELOW RATHER THAN DOCUMENTED AND HOPED FOR.
//
//   1. A BID IS NOT A TRANSACTION AND NOT REVENUE. Placing a bid moves no
//      money, writes no ledger row and creates no order. It is a standing
//      offer. `bids` is its own collection precisely so that nothing which
//      scans `ledgerTransactions` can ever mistake one for income.
//
//   2. A LOSING BID IS NO ECONOMIC ACTIVITY AT ALL. When an auction closes,
//      losers are simply marked `lost`. Nothing is charged, refunded,
//      reserved or held, because nothing was ever taken.
//
//   3. THE HIGHEST VALID BID IS DERIVED. There is no `currentPrice` column on
//      the auction and no `highestBidId` pointer. Both are computed by
//      scanning the bid rows every time they are read. A stored leader is a
//      second source of truth that goes stale the moment a bid is retracted.
//
//   4. CLOSING IS SERVER-AUTHORITATIVE AND DETERMINISTIC. The end time is the
//      server's, `closeAuction` compares against the server clock, and the
//      winner is chosen by (amount DESC, placedAt ASC, id ASC) -- a total
//      order, so the same bid set always produces the same winner. Ties are
//      broken by who bid first, never randomly.
//
//   5. A CLOSED AUCTION DOES NOT CASUALLY REOPEN. `closed`, `settled`,
//      `cancelled` and `failed` are terminal. There is no edit-after-close
//      and no "extend by five minutes" backdoor.
//
// WINNER NON-PAYMENT is an explicit path, not an oversight: `defaultWinner()`
// records that the winner did not pay, cancels their order and puts the
// auction into `failed`. The item is not silently re-awarded to the runner-up,
// because that is a commercial decision a human makes.
//
// BIDDER PRIVACY. `publicView()` never exposes bidder identities. A public
// observer sees the leading AMOUNT and the bid COUNT -- enough to bid
// against -- but not who is bidding, which is what makes targeted shill
// bidding and off-platform poaching possible.
// ---------------------------------------------------------------------------

import { store, newId } from '../store.js';
import * as listings from './listing.js';
import * as signals from './signal.js';

export const AUCTION_STATUS = ['draft', 'open', 'closed', 'settled', 'cancelled', 'failed'];

export const BID_STATUS = ['active', 'retracted', 'won', 'lost'];

/**
 * Auction formats.
 *
 * These are VARIANTS OF ONE MECHANISM, not four features. They differ only in
 * which fields are meaningful; the bidding, closing and settlement code below
 * is shared by all of them.
 */
export const AUCTION_TYPES = [
  'ascending',  // classic timed ascending auction
  'popup',      // creator / pop-up sale, usually short and promoted
  'circle'      // restricted to members of one Circle
];

const TERMINAL = ['closed', 'settled', 'cancelled', 'failed'];

const now = () => new Date().toISOString();

/** Whole shillings only. Sub-cent bids are a rounding attack, not a bid. */
function validAmount(n) {
  return Number.isSafeInteger(n) && n > 0 && n <= 1_000_000_000;
}

// ---------------------------------------------------------------------------
// CREATE
// ---------------------------------------------------------------------------

/**
 * Create an auction over an EXISTING listing.
 *
 * The listing is the supply primitive. An auction does not carry its own
 * title, price or stock -- that would be a duplicate listing wearing a
 * different hat.
 */
export function createAuction({
  listingId,
  ownerId,
  type = 'ascending',
  startingPrice,
  reservePrice = null,
  buyNowPrice = null,
  endsAt,
  circleId = null
}) {
  if (!ownerId) throw new Error('ownerId is required');
  if (!AUCTION_TYPES.includes(type)) {
    throw new Error(`type must be one of ${AUCTION_TYPES.join(', ')}`);
  }

  const listing = store.find('listings', (l) => l.id === listingId);
  if (!listing) throw new Error('listing not found');

  const vendor = store.find('vendors', (v) => v.id === listing.vendorId);
  if (!vendor) throw new Error('vendor not found');
  if (vendor.ownerId !== ownerId) {
    throw new Error('only the listing owner may auction it');
  }

  // One live auction per listing. Two open auctions over one crate of
  // tomatoes is a promise to sell the same thing twice.
  const existing = store.find(
    'auctions',
    (a) => a.listingId === listingId && (a.status === 'open' || a.status === 'draft')
  );
  if (existing) throw new Error('this listing already has an auction');

  if (!validAmount(startingPrice)) {
    throw new Error('startingPrice must be a whole positive amount');
  }
  if (reservePrice !== null && !validAmount(reservePrice)) {
    throw new Error('reservePrice must be a whole positive amount');
  }
  if (reservePrice !== null && reservePrice < startingPrice) {
    throw new Error('reservePrice may not be below startingPrice');
  }
  if (buyNowPrice !== null) {
    if (!validAmount(buyNowPrice)) throw new Error('buyNowPrice must be a whole positive amount');
    // A Buy Now at or below the start price makes bidding pointless.
    if (buyNowPrice <= startingPrice) {
      throw new Error('buyNowPrice must be above startingPrice');
    }
    if (reservePrice !== null && buyNowPrice < reservePrice) {
      throw new Error('buyNowPrice may not be below reservePrice');
    }
  }

  const ends = new Date(endsAt);
  if (Number.isNaN(ends.getTime())) throw new Error('endsAt must be a valid date');
  if (ends.getTime() <= Date.now()) throw new Error('endsAt must be in the future');

  if (type === 'circle' && !circleId) {
    throw new Error('a circle auction requires a circleId');
  }

  const at = now();
  const auction = store.insert('auctions', {
    id: newId('auc'),
    listingId: listing.id,
    // Snapshot, for the same reason an order snapshots what was bought.
    listingTitle: listing.title,
    vendorId: vendor.id,
    ownerId,
    type,
    status: 'draft',
    startingPrice,
    reservePrice,
    buyNowPrice,
    currency: listing.currency,
    circleId: type === 'circle' ? circleId : null,
    endsAt: ends.toISOString(),
    closedAt: null,
    // Set at close. Until then there is no winner, and no field pretends
    // otherwise.
    winningBidId: null,
    winnerId: null,
    winningAmount: null,
    orderId: null,
    history: [{ status: 'draft', at }],
    createdAt: at,
    updatedAt: at
  });

  return hydrate(auction);
}

/** Open an auction for bidding. Only the owner, only from draft. */
export function openAuction(id, actorId) {
  const auction = store.find('auctions', (a) => a.id === id);
  if (!auction) throw new Error('auction not found');
  if (auction.ownerId !== actorId) throw new Error('only the owner may open this auction');
  if (auction.status === 'open') return hydrate(auction);
  if (auction.status !== 'draft') {
    throw new Error(`cannot open an auction that is ${auction.status}`);
  }
  if (new Date(auction.endsAt).getTime() <= Date.now()) {
    throw new Error('cannot open an auction whose end time has already passed');
  }

  const updated = store.update('auctions', id, {
    status: 'open',
    updatedAt: now(),
    history: [...auction.history, { status: 'open', at: now() }]
  });

  signals.emitSignal({
    type: 'auction_opened',
    actorId,
    metadata: { auctionId: id, listingId: auction.listingId, startingPrice: auction.startingPrice }
  });

  return hydrate(updated);
}

// ---------------------------------------------------------------------------
// DERIVED STATE
// ---------------------------------------------------------------------------

/** Every bid that still counts. Retracted bids are excluded everywhere. */
export function activeBids(auctionId) {
  return store
    .filter('bids', (b) => b.auctionId === auctionId && b.status !== 'retracted')
    .sort(compareBids);
}

/**
 * The total order that makes the winner deterministic:
 * highest amount, then earliest placement, then lowest id.
 */
function compareBids(a, b) {
  if (b.amount !== a.amount) return b.amount - a.amount;
  if (a.placedAt !== b.placedAt) return a.placedAt < b.placedAt ? -1 : 1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/** DERIVED, never stored. */
export function highestBid(auctionId) {
  return activeBids(auctionId)[0] ?? null;
}

/** What the next bidder must beat. */
export function currentPrice(auctionId) {
  const auction = store.find('auctions', (a) => a.id === auctionId);
  if (!auction) throw new Error('auction not found');
  const top = highestBid(auctionId);
  return top ? top.amount : auction.startingPrice;
}

export function hasEnded(auction) {
  return new Date(auction.endsAt).getTime() <= Date.now();
}

function hydrate(auction) {
  const bids = activeBids(auction.id);
  const top = bids[0] ?? null;
  return {
    ...auction,
    bidCount: bids.length,
    // The leading amount is public; the leading bidder is not.
    currentPrice: top ? top.amount : auction.startingPrice,
    highestBidId: top ? top.id : null,
    reserveMet: auction.reservePrice === null ? true : Boolean(top && top.amount >= auction.reservePrice),
    ended: hasEnded(auction),
    biddable: auction.status === 'open' && !hasEnded(auction)
  };
}

export function getAuction(id) {
  const a = store.find('auctions', (x) => x.id === id);
  return a ? hydrate(a) : null;
}

export function listAuctions({ status = null, ownerId = null, circleId = null } = {}) {
  return store
    .filter('auctions', (a) =>
      (status === null || a.status === status) &&
      (ownerId === null || a.ownerId === ownerId) &&
      (circleId === null || a.circleId === circleId))
    .map(hydrate)
    .sort((x, y) => (x.endsAt < y.endsAt ? -1 : 1));
}

/**
 * The public projection.
 *
 * NO BIDDER IDENTITIES. This is the shape a non-participant may see, and the
 * omission is the point: knowing WHO is bidding is what enables shill
 * bidding, harassment and off-platform poaching.
 */
export function publicView(auction) {
  const h = hydrate(auction);
  return {
    id: h.id,
    listingId: h.listingId,
    title: h.listingTitle,
    type: h.type,
    status: h.status,
    currency: h.currency,
    startingPrice: h.startingPrice,
    currentPrice: h.currentPrice,
    bidCount: h.bidCount,
    buyNowPrice: h.buyNowPrice,
    // Whether a reserve EXISTS is public; its value is not, or bidders would
    // simply bid the reserve and nothing more.
    hasReserve: h.reservePrice !== null,
    reserveMet: h.reserveMet,
    endsAt: h.endsAt,
    biddable: h.biddable,
    winningAmount: h.winningAmount
  };
}

// ---------------------------------------------------------------------------
// BIDDING
// ---------------------------------------------------------------------------

/**
 * Place a bid.
 *
 * Writes ONE row to `bids`. No ledger row, no order, no money.
 */
export function placeBid({ auctionId, bidderId, amount, idempotencyKey = null }) {
  if (!bidderId) throw new Error('bidderId is required');

  const auction = store.find('auctions', (a) => a.id === auctionId);
  if (!auction) throw new Error('auction not found');

  // Duplicate submission protection, matching orders: a double-tapped bid
  // button on a slow connection must not bid twice.
  if (idempotencyKey) {
    const prior = store.find(
      'bids',
      (b) => b.auctionId === auctionId && b.bidderId === bidderId && b.idempotencyKey === idempotencyKey
    );
    if (prior) return { bid: prior, reused: true };
  }

  if (auction.status !== 'open') {
    throw new Error(`this auction is not open for bidding (${auction.status})`);
  }
  // The SERVER clock decides, not the client's.
  if (hasEnded(auction)) {
    throw new Error('this auction has ended');
  }
  if (auction.ownerId === bidderId) {
    throw new Error('you cannot bid on your own auction');
  }
  if (auction.type === 'circle') {
    // Membership is the row's existence. Member rows carry a role and an
    // evidence list, not a status column -- inventing one here would have
    // silently excluded every real member.
    const member = store.find(
      'members',
      (m) => m.circleId === auction.circleId && m.userId === bidderId
    );
    if (!member) throw new Error('this auction is limited to circle members');
  }
  if (!validAmount(amount)) {
    throw new Error('a bid must be a whole positive amount');
  }

  // Must beat the derived leader, not a stored one.
  const top = highestBid(auctionId);
  const floor = top ? top.amount : auction.startingPrice;
  if (top && amount <= floor) {
    throw new Error(`a bid must exceed the current price of ${floor}`);
  }
  if (!top && amount < floor) {
    throw new Error(`the first bid must be at least the starting price of ${floor}`);
  }

  const at = now();
  const bid = store.insert('bids', {
    id: newId('bid'),
    auctionId,
    bidderId,
    amount,
    currency: auction.currency,
    status: 'active',
    idempotencyKey: idempotencyKey ?? null,
    placedAt: at,
    createdAt: at
  });

  signals.emitSignal({
    type: 'bid_placed',
    actorId: bidderId,
    // The amount is public information; it is already the visible price.
    metadata: { auctionId, bidId: bid.id, amount }
  });

  return { bid, reused: false };
}

/**
 * Retract a bid.
 *
 * Allowed only while the auction is live, and only by the bidder. Retracting
 * removes the bid from every derived figure -- which is exactly why the
 * leading price is computed rather than stored.
 */
export function retractBid({ bidId, actorId }) {
  const bid = store.find('bids', (b) => b.id === bidId);
  if (!bid) throw new Error('bid not found');
  if (bid.bidderId !== actorId) throw new Error('only the bidder may retract this bid');
  if (bid.status === 'retracted') return bid;
  if (bid.status !== 'active') throw new Error('this bid can no longer be retracted');

  const auction = store.find('auctions', (a) => a.id === bid.auctionId);
  if (!auction || auction.status !== 'open' || hasEnded(auction)) {
    throw new Error('bids cannot be retracted after the auction closes');
  }

  return store.update('bids', bidId, { status: 'retracted', retractedAt: now() });
}

/** A bidder's own bids. Used by "my bids" -- never exposes other bidders. */
export function bidsByUser(userId) {
  return store.filter('bids', (b) => b.bidderId === userId).sort(compareBids);
}

// ---------------------------------------------------------------------------
// CLOSING
// ---------------------------------------------------------------------------

/**
 * Close an auction and determine the winner.
 *
 * Callable by the owner (an early close is their prerogative) or by anyone
 * once the end time has passed -- which is what lets a scheduled sweep or the
 * next reader finalise it without a background job daemon.
 *
 * Deterministic: same bids in, same winner out.
 */
export function closeAuction({ auctionId, actorId = null, force = false }) {
  const auction = store.find('auctions', (a) => a.id === auctionId);
  if (!auction) throw new Error('auction not found');

  // Terminal means terminal. No reopening, no re-closing with a new winner.
  if (TERMINAL.includes(auction.status)) {
    return { auction: hydrate(auction), changed: false };
  }
  if (auction.status !== 'open') {
    throw new Error(`cannot close an auction that is ${auction.status}`);
  }

  const ended = hasEnded(auction);
  const isOwner = actorId !== null && actorId === auction.ownerId;
  if (!ended && !isOwner && !force) {
    throw new Error('this auction has not ended yet');
  }

  const bids = activeBids(auctionId);
  const winning = bids[0] ?? null;
  const at = now();

  // No bids, or the reserve was never met: the auction closes with no sale.
  // This is a NORMAL outcome, not an error, and it produces no economic
  // activity whatsoever.
  const reserveMet = auction.reservePrice === null || (winning && winning.amount >= auction.reservePrice);
  if (!winning || !reserveMet) {
    for (const b of bids) store.update('bids', b.id, { status: 'lost' });
    const updated = store.update('auctions', auctionId, {
      status: 'closed',
      closedAt: at,
      updatedAt: at,
      history: [...auction.history, { status: 'closed', at, note: winning ? 'reserve not met' : 'no bids' }]
    });
    signals.emitSignal({
      type: 'auction_closed',
      actorId,
      metadata: { auctionId, sold: false, reason: winning ? 'reserve_not_met' : 'no_bids' }
    });
    return { auction: hydrate(updated), changed: true, sold: false, order: null };
  }

  // Mark winner and losers. A losing bid costs nothing and does nothing.
  store.update('bids', winning.id, { status: 'won' });
  for (const b of bids.slice(1)) store.update('bids', b.id, { status: 'lost' });

  const updated = store.update('auctions', auctionId, {
    status: 'closed',
    closedAt: at,
    updatedAt: at,
    winningBidId: winning.id,
    winnerId: winning.bidderId,
    winningAmount: winning.amount,
    history: [...auction.history, { status: 'closed', at, note: `won at ${winning.amount}` }]
  });

  signals.emitSignal({
    type: 'auction_closed',
    actorId,
    metadata: { auctionId, sold: true, amount: winning.amount }
  });

  return { auction: hydrate(updated), changed: true, sold: true, winningBid: winning };
}

/**
 * Buy Now: end the auction immediately at the fixed price.
 *
 * Implemented as a bid at exactly the Buy Now price followed by a close, so
 * the winner is chosen by the same code path as every other auction. There is
 * no separate "instant purchase" flow to keep in sync.
 */
export function buyNow({ auctionId, buyerId, idempotencyKey = null }) {
  const auction = store.find('auctions', (a) => a.id === auctionId);
  if (!auction) throw new Error('auction not found');
  if (auction.buyNowPrice === null) throw new Error('this auction has no Buy Now price');
  if (auction.status !== 'open') throw new Error(`this auction is not open (${auction.status})`);
  if (hasEnded(auction)) throw new Error('this auction has ended');
  if (auction.ownerId === buyerId) throw new Error('you cannot buy your own auction');

  // A standing bid already at or above Buy Now would otherwise be beaten by a
  // lower Buy Now purchase.
  const top = highestBid(auctionId);
  if (top && top.amount >= auction.buyNowPrice) {
    throw new Error('bidding has already reached the Buy Now price');
  }

  const { bid } = placeBid({
    auctionId,
    bidderId: buyerId,
    amount: auction.buyNowPrice,
    idempotencyKey
  });
  const closed = closeAuction({ auctionId, actorId: auction.ownerId, force: true });
  return { ...closed, bid, buyNow: true };
}

// ---------------------------------------------------------------------------
// WINNER -> ORDER
// ---------------------------------------------------------------------------

/**
 * Turn a won auction into an ordinary Order.
 *
 * THIS IS THE JOIN BACK TO THE EXISTING CHAIN. From here the winner pays
 * through the normal payment routes, the ledger records it, settlement splits
 * it at the normal commission rate and the seller is paid through the normal
 * payout path. Nothing about the money is auction-specific.
 *
 * The amount is DERIVED from the winning bid row inside this function. No
 * caller supplies a price -- same rule as `createOrder`.
 */
export function createWinnerOrder({ auctionId, actorId }) {
  const auction = store.find('auctions', (a) => a.id === auctionId);
  if (!auction) throw new Error('auction not found');
  if (auction.status !== 'closed') {
    throw new Error(`an order can only be raised for a closed auction (this one is ${auction.status})`);
  }
  if (!auction.winningBidId) throw new Error('this auction had no winner');

  // Only the winner or the seller may raise it.
  if (actorId !== auction.winnerId && actorId !== auction.ownerId) {
    throw new Error('only the winner or the seller may raise this order');
  }

  // Idempotent: the order is created once.
  if (auction.orderId) {
    const existing = store.find('orders', (o) => o.id === auction.orderId);
    if (existing) return { order: existing, reused: true };
  }

  const bid = store.find('bids', (b) => b.id === auction.winningBidId);
  if (!bid) throw new Error('winning bid not found');

  const listing = store.find('listings', (l) => l.id === auction.listingId);
  if (!listing) throw new Error('listing not found');
  const vendor = store.find('vendors', (v) => v.id === auction.vendorId);
  if (!vendor) throw new Error('vendor not found');

  const at = now();
  // Written directly rather than through createOrder() because the price
  // comes from the winning BID, not the listing's asking price. It is still
  // server-derived -- read from the bid row above, never from a caller.
  const order = store.insert('orders', {
    id: newId('ord'),
    listingId: listing.id,
    listingTitle: listing.title,
    listingType: listing.type,
    buyerId: auction.winnerId,
    vendorId: vendor.id,
    vendorOwnerId: vendor.ownerId,
    quantity: 1,
    unitPrice: bid.amount,
    total: bid.amount,
    currency: auction.currency,
    note: `Auction ${auction.id}`,
    // Provenance, so an order raised by an auction can always be traced back
    // to the bid that set its price.
    auctionId: auction.id,
    bidId: bid.id,
    idempotencyKey: `auction:${auction.id}`,
    status: 'ordered',
    transactionId: null,
    fulfilledAt: null,
    settledAt: null,
    history: [{ status: 'ordered', at, note: 'auction winner' }],
    createdAt: at,
    updatedAt: at
  });

  // A won auction consumes the stock it sold.
  if (listing.quantityAvailable !== null) {
    listings.consumeStock(listing.id, 1);
  }

  store.update('auctions', auctionId, { orderId: order.id, updatedAt: at });

  signals.emitSignal({
    type: 'auction_order_raised',
    actorId,
    metadata: { auctionId, orderId: order.id, amount: bid.amount }
  });

  return { order, reused: false };
}

/**
 * The winner did not pay.
 *
 * An EXPLICIT path, because the alternative -- leaving the auction closed
 * forever with an unpaid order attached -- silently misreports both the item's
 * availability and the seller's expected earnings.
 *
 * The item is NOT auto-awarded to the runner-up. Re-offering is a commercial
 * decision, made by the seller, through a new auction.
 */
export function defaultWinner({ auctionId, actorId, reason = 'winner did not pay' }) {
  const auction = store.find('auctions', (a) => a.id === auctionId);
  if (!auction) throw new Error('auction not found');
  if (auction.ownerId !== actorId) throw new Error('only the seller may record a default');
  if (auction.status !== 'closed') {
    throw new Error(`only a closed auction can be defaulted (this one is ${auction.status})`);
  }
  if (!auction.winnerId) throw new Error('this auction had no winner');

  // Refuse if the money actually arrived. A seller cannot cancel a sale that
  // has been paid for by calling it a default.
  if (auction.orderId) {
    const order = store.find('orders', (o) => o.id === auction.orderId);
    if (order) {
      const tx = order.transactionId
        ? store.find('ledgerTransactions', (t) => t.id === order.transactionId)
        : null;
      if (tx && tx.status === 'settled') {
        throw new Error('this auction has been paid for and cannot be defaulted');
      }
      store.update('orders', order.id, {
        status: 'cancelled',
        updatedAt: now(),
        history: [...order.history, { status: 'cancelled', at: now(), note: reason }]
      });
      // The item goes back on the shelf.
      const listing = store.find('listings', (l) => l.id === order.listingId);
      if (listing && listing.quantityAvailable !== null) {
        store.update('listings', listing.id, { quantityAvailable: listing.quantityAvailable + 1 });
      }
    }
  }

  const at = now();
  const updated = store.update('auctions', auctionId, {
    status: 'failed',
    updatedAt: at,
    defaultedAt: at,
    defaultReason: reason,
    history: [...auction.history, { status: 'failed', at, note: reason }]
  });

  signals.emitSignal({
    type: 'auction_winner_defaulted',
    actorId,
    metadata: { auctionId, winnerId: auction.winnerId }
  });

  return hydrate(updated);
}

/**
 * Cancel an auction before it produces a winner.
 *
 * Permitted from draft, and from open ONLY while no bids stand: cancelling
 * under a live bid is how a seller escapes a price they dislike.
 */
export function cancelAuction({ auctionId, actorId, reason = '' }) {
  const auction = store.find('auctions', (a) => a.id === auctionId);
  if (!auction) throw new Error('auction not found');
  if (auction.ownerId !== actorId) throw new Error('only the owner may cancel this auction');
  if (auction.status === 'cancelled') return hydrate(auction);
  if (TERMINAL.includes(auction.status)) {
    throw new Error(`cannot cancel an auction that is ${auction.status}`);
  }
  if (auction.status === 'open' && activeBids(auctionId).length > 0) {
    throw new Error('cannot cancel an auction that already has bids');
  }

  const at = now();
  const updated = store.update('auctions', auctionId, {
    status: 'cancelled',
    updatedAt: at,
    history: [...auction.history, { status: 'cancelled', at, note: reason }]
  });
  signals.emitSignal({ type: 'auction_cancelled', actorId, metadata: { auctionId } });
  return hydrate(updated);
}

/**
 * Mark a closed auction settled once its order really is settled.
 *
 * Derived, not asserted: this reads the order's ledger transaction and
 * refuses unless it is genuinely settled. It cannot be used to fake a sale.
 */
export function markSettled(auctionId) {
  const auction = store.find('auctions', (a) => a.id === auctionId);
  if (!auction) throw new Error('auction not found');
  if (auction.status === 'settled') return hydrate(auction);
  if (auction.status !== 'closed') throw new Error('only a closed auction can settle');
  if (!auction.orderId) throw new Error('this auction has no order');

  const order = store.find('orders', (o) => o.id === auction.orderId);
  const tx = order?.transactionId
    ? store.find('ledgerTransactions', (t) => t.id === order.transactionId)
    : null;
  if (!tx || tx.status !== 'settled') {
    throw new Error('the auction order has not settled');
  }

  const at = now();
  const updated = store.update('auctions', auctionId, {
    status: 'settled',
    updatedAt: at,
    history: [...auction.history, { status: 'settled', at }]
  });
  return hydrate(updated);
}

/**
 * Close every auction whose time has expired.
 *
 * Called opportunistically (on read and at startup) rather than by a cron
 * daemon: an auction that ended is closed the next time anybody looks, which
 * keeps the deployment a single process.
 */
export function sweepExpired() {
  const due = store.filter('auctions', (a) => a.status === 'open' && hasEnded(a));
  const closed = [];
  for (const a of due) {
    try {
      const r = closeAuction({ auctionId: a.id, force: true });
      if (r.changed) closed.push(r.auction.id);
    } catch {
      // One bad auction must not stop the sweep.
    }
  }
  return { closed: closed.length, ids: closed };
}
