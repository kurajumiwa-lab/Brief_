// AUCTION ROUTES — extracted from index.js (zero behaviour change).
// Each route keeps its original body verbatim; only its home file changed.
import { callerId } from '../identity.js';
import * as auctions from '../domain/auction.js';
import { requireAuth } from './helpers.js';

export function register(app) {
// --- Auction --------------------------------------------------------------
//
// An auction is price discovery over an EXISTING listing. When it closes, the
// winner receives an ordinary Order that flows through the ordinary payment,
// ledger, settlement and payout routes. There is no auction wallet, no
// auction balance and no auction-specific money endpoint anywhere below.
//
// Bidder identities are never returned to anyone but the seller (who must be
// able to see who they are selling to) and each bidder about their own bids.


app.get('/api/auctions', (req, res) => {
  // Opportunistic close: an auction whose time is up is finalised the next
  // time anyone looks, so no cron daemon is required.
  auctions.sweepExpired();
  const status = req.query.status ?? null;
  const list = auctions.listAuctions({ status });
  const me = callerId(req);
  // The public projection by default; the seller sees their own in full.
  res.json({
    auctions: list.map((a) => (a.ownerId === me ? a : auctions.publicView(a)))
  });
});



app.get('/api/auctions/:id', (req, res) => {
  auctions.sweepExpired();
  const a = auctions.getAuction(req.params.id);
  if (!a) return res.status(404).json({ error: 'auction not found' });
  const me = callerId(req);
  res.json({ auction: a.ownerId === me ? a : auctions.publicView(a) });
});


/** The seller's view of who is bidding. Nobody else may read this. */

app.get('/api/auctions/:id/bids', (req, res) => {
  const me = requireAuth(req, res);
  if (!me) return;
  const a = auctions.getAuction(req.params.id);
  if (!a) return res.status(404).json({ error: 'auction not found' });
  if (a.ownerId !== me) {
    return res.status(403).json({ error: 'only the seller may see the bidders' });
  }
  res.json({ bids: auctions.activeBids(a.id) });
});



app.post('/api/auctions', (req, res) => {
  const me = requireAuth(req, res);
  if (!me) return;
  try {
    const auction = auctions.createAuction({
      listingId: req.body?.listingId,
      ownerId: me,
      type: req.body?.type ?? 'ascending',
      startingPrice: req.body?.startingPrice,
      reservePrice: req.body?.reservePrice ?? null,
      buyNowPrice: req.body?.buyNowPrice ?? null,
      endsAt: req.body?.endsAt,
      circleId: req.body?.circleId ?? null
    });
    res.status(201).json({ auction });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});



app.post('/api/auctions/:id/open', (req, res) => {
  const me = requireAuth(req, res);
  if (!me) return;
  try {
    res.json({ auction: auctions.openAuction(req.params.id, me) });
  } catch (e) {
    const code = /not found/.test(e.message) ? 404 : /only the owner/.test(e.message) ? 403 : 400;
    res.status(code).json({ error: e.message });
  }
});



app.post('/api/auctions/:id/bids', (req, res) => {
  const me = requireAuth(req, res);
  if (!me) return;
  try {
    const { bid, reused } = auctions.placeBid({
      auctionId: req.params.id,
      bidderId: me,
      amount: req.body?.amount,
      idempotencyKey: req.body?.idempotencyKey ?? null
    });
    // The bidder sees their own bid plus the public state of the auction.
    res.status(reused ? 200 : 201).json({
      bid,
      reused,
      auction: auctions.publicView(auctions.getAuction(req.params.id))
    });
  } catch (e) {
    const code = /not found/.test(e.message) ? 404 : 400;
    res.status(code).json({ error: e.message });
  }
});



app.post('/api/bids/:id/retract', (req, res) => {
  const me = requireAuth(req, res);
  if (!me) return;
  try {
    res.json({ bid: auctions.retractBid({ bidId: req.params.id, actorId: me }) });
  } catch (e) {
    const code = /not found/.test(e.message) ? 404 : /only the bidder/.test(e.message) ? 403 : 400;
    res.status(code).json({ error: e.message });
  }
});



app.get('/api/bids/mine', (req, res) => {
  const me = requireAuth(req, res);
  if (!me) return;
  res.json({ bids: auctions.bidsByUser(me) });
});



app.post('/api/auctions/:id/buy-now', (req, res) => {
  const me = requireAuth(req, res);
  if (!me) return;
  try {
    const r = auctions.buyNow({
      auctionId: req.params.id,
      buyerId: me,
      idempotencyKey: req.body?.idempotencyKey ?? null
    });
    res.json({ auction: r.auction, sold: r.sold, buyNow: true });
  } catch (e) {
    const code = /not found/.test(e.message) ? 404 : 400;
    res.status(code).json({ error: e.message });
  }
});



app.post('/api/auctions/:id/close', (req, res) => {
  const me = requireAuth(req, res);
  if (!me) return;
  try {
    const r = auctions.closeAuction({ auctionId: req.params.id, actorId: me });
    res.json({ auction: r.auction, changed: r.changed, sold: r.sold ?? false });
  } catch (e) {
    const code = /not found/.test(e.message) ? 404 : 400;
    res.status(code).json({ error: e.message });
  }
});


/** Winner -> Order. The join back to the ordinary commerce chain. */

app.post('/api/auctions/:id/order', (req, res) => {
  const me = requireAuth(req, res);
  if (!me) return;
  try {
    const { order, reused } = auctions.createWinnerOrder({ auctionId: req.params.id, actorId: me });
    res.status(reused ? 200 : 201).json({ order, reused });
  } catch (e) {
    const code = /not found/.test(e.message) ? 404 : /only the winner/.test(e.message) ? 403 : 400;
    res.status(code).json({ error: e.message });
  }
});


/** The winner did not pay. Explicit, seller-only, and refused once paid. */

app.post('/api/auctions/:id/default', (req, res) => {
  const me = requireAuth(req, res);
  if (!me) return;
  try {
    const auction = auctions.defaultWinner({
      auctionId: req.params.id,
      actorId: me,
      reason: req.body?.reason ?? 'winner did not pay'
    });
    res.json({ auction });
  } catch (e) {
    const code = /not found/.test(e.message) ? 404 : /only the seller/.test(e.message) ? 403 : 400;
    res.status(code).json({ error: e.message });
  }
});



app.post('/api/auctions/:id/cancel', (req, res) => {
  const me = requireAuth(req, res);
  if (!me) return;
  try {
    res.json({ auction: auctions.cancelAuction({ auctionId: req.params.id, actorId: me, reason: req.body?.reason ?? '' }) });
  } catch (e) {
    const code = /not found/.test(e.message) ? 404 : /only the owner/.test(e.message) ? 403 : 400;
    res.status(code).json({ error: e.message });
  }
});
}

