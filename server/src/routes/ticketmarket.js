// TICKET RESALE MARKET ROUTES (Tikiti integration T1).
//
// Where it lives in the product (§2 — no sixth destination):
//   * Nearby: an event's context shows its resale listings (commerce only
//     inside context, exactly as the brief mandates).
//   * Workflows → Sell: the seller's listings, orders and refunds.
//   * My Layer → Kept: the holder's ticket with the live scan code.
//
// Moderation (listing removal, ticket voiding) is capability-gated and
// audited — the same operator rules as every other consequential act.

import { store } from '../store.js';
import { callerId } from '../identity.js';
import * as ticketMarket from '../domain/ticketMarket.js';
import * as payment from '../domain/payment.js';
import { requireAuth, requireCap, recordAudit, recordError } from './helpers.js';

export function register(app) {
  app.use('/api/ticket-market', (req, res, next) => {
    // Every surface here belongs to a signed-in person: browsing a market is
    // not a public crawl, and every listing names its seller.
    if (!requireAuth(req, res)) return;
    next();
  });

  // --- browsing ---------------------------------------------------------------

  app.get('/api/ticket-market/events/:eventId/listings', (req, res) => {
    res.json({ listings: ticketMarket.listingsForEvent(req.params.eventId) });
  });

  app.get('/api/ticket-market/me/tickets', (req, res) => {
    const mine = store.filter('tickets', (t) => t.ownerUserId === callerId(req))
      .map(ticketMarket.ticketOwnerView);
    res.json({ tickets: mine });
  });

  app.get('/api/ticket-market/me/listings', (req, res) => {
    const listings = store.filter('ticketListings', (l) => l.sellerId === callerId(req));
    const orders = store.filter('ticketOrders', (o) => o.sellerId === callerId(req) || o.buyerId === callerId(req));
    res.json({ listings, orders });
  });

  // --- selling ----------------------------------------------------------------

  app.post('/api/ticket-market/listings', (req, res) => {
    try {
      const listing = ticketMarket.listForResale(
        callerId(req),
        String(req.body?.ticketId ?? ''),
        req.body?.price,
        { note: req.body?.note ?? null, expiresAt: req.body?.expiresAt ?? null }
      );
      res.status(201).json({ listing });
    } catch (e) {
      res.status(400).json({ error: String(e.message ?? e) });
    }
  });

  app.post('/api/ticket-market/listings/:id/cancel', (req, res) => {
    try {
      const listing = ticketMarket.cancelListing(callerId(req), req.params.id);
      res.json({ listing, changed: true });
    } catch (e) {
      res.status(400).json({ error: String(e.message ?? e) });
    }
  });

  // --- buying -----------------------------------------------------------------

  app.post('/api/ticket-market/orders', (req, res) => {
    try {
      const order = ticketMarket.buyListing(callerId(req), String(req.body?.listingId ?? ''));
      res.status(201).json({ order });
    } catch (e) {
      const conflict = /own listing/.test(String(e.message ?? ''));
      res.status(conflict ? 400 : 400).json({ error: String(e.message ?? e) });
    }
  });

  app.post('/api/ticket-market/orders/:id/cancel', (req, res) => {
    try {
      const order = ticketMarket.cancelOrder(callerId(req), req.params.id);
      res.json({ order, changed: true });
    } catch (e) {
      res.status(400).json({ error: String(e.message ?? e) });
    }
  });

  /**
   * Pay for a ticket order. With no payment provider connected this answers
   * 503 charged:false — the same honest posture as the product marketplace.
   * Ownership NEVER moves without a genuinely settled ledger row.
   */
  app.post('/api/ticket-market/orders/:id/pay', async (req, res) => {
    try {
      const order = store.find('ticketOrders', (o) => o.id === req.params.id);
      if (!order) return res.status(404).json({ error: 'order not found' });
      if (order.buyerId !== callerId(req)) return res.status(403).json({ error: 'only the buyer may pay for this order' });
      if (!payment.activeProvider()) {
        return res.status(503).json({
          charged: false,
          error: 'no payment provider is configured, so Brief cannot collect this payment',
          ...payment.providerStatus()
        });
      }
      // A provider exists (sandbox/live): the money rail lands with the
      // provider integration (T9). Until then this branch stays unreachable
      // rather than fake a charge.
      return res.status(501).json({
        charged: false,
        error: 'provider payment rails for ticket orders arrive with the payments phase',
        ...payment.providerStatus()
      });
    } catch (e) {
      recordError('ticket-market pay', req.params.id, String(e.message ?? e));
      res.status(500).json({ error: 'payment attempt failed' });
    }
  });

  /**
   * Settle: attach a genuinely settled ledger row and take ownership. The
   * transaction id is validated against the order (amount, currency, buyer,
   * status) inside the domain — nothing from the client is trusted but the
   * reference, and the reference is checked.
   */
  app.post('/api/ticket-market/orders/:id/settle', (req, res) => {
    try {
      const { order, changed } = ticketMarket.settleOrder(callerId(req), req.params.id, {
        transactionId: req.body?.transactionId ?? null
      });
      res.json({ order, changed });
    } catch (e) {
      res.status(400).json({ error: String(e.message ?? e) });
    }
  });

  app.post('/api/ticket-market/orders/:id/refund', (req, res) => {
    try {
      const { order, ticket } = ticketMarket.refundOrder(callerId(req), req.params.id);
      res.json({ order, ticket, changed: true });
    } catch (e) {
      res.status(400).json({ error: String(e.message ?? e) });
    }
  });

  // --- gifting ----------------------------------------------------------------

  app.post('/api/ticket-market/tickets/:id/transfer', (req, res) => {
    try {
      const ticket = ticketMarket.transferTicket(callerId(req), req.params.id, String(req.body?.toUserId ?? ''));
      res.json({ ticket: ticketMarket.ticketOwnerView(ticket) });
    } catch (e) {
      res.status(400).json({ error: String(e.message ?? e) });
    }
  });

  // --- moderation (capability-gated, audited) ----------------------------------

  app.post('/api/ticket-market/listings/:id/remove', (req, res) => {
    const gate = requireCap(req, res, 'moderate');
    if (!gate) return;
    try {
      const before = store.find('ticketListings', (l) => l.id === req.params.id) ?? null;
      const listing = ticketMarket.removeListing(callerId(req), req.params.id, req.body?.reason ?? '');
      recordAudit('ticket_market.listing_removed', {
        actorId: callerId(req),
        objectType: 'ticketListing',
        objectId: req.params.id,
        before: before ? { status: before.status, price: before.price } : null,
        after: { status: listing.status, removedReason: listing.removedReason },
        reason: listing.removedReason
      });
      res.json({ listing });
    } catch (e) {
      res.status(400).json({ error: String(e.message ?? e) });
    }
  });

  app.post('/api/ticket-market/tickets/:id/void', (req, res) => {
    const gate = requireCap(req, res, 'moderate');
    if (!gate) return;
    try {
      const before = store.find('tickets', (t) => t.id === req.params.id) ?? null;
      const ticket = ticketMarket.voidTicket(callerId(req), req.params.id, req.body?.reason ?? '');
      recordAudit('ticket_market.ticket_voided', {
        actorId: callerId(req),
        objectType: 'ticket',
        objectId: req.params.id,
        before: before ? { status: before.status, ownerUserId: before.ownerUserId } : null,
        after: { status: ticket.status },
        reason: String(req.body?.reason ?? '')
      });
      res.json({ ticket: ticketMarket.ticketOwnerView(ticket) });
    } catch (e) {
      res.status(400).json({ error: String(e.message ?? e) });
    }
  });
}
