// ---------------------------------------------------------------------------
// HUDUMALINK — HTTP ROUTES
//
// The three externally-facing surfaces of the product:
//
//   1. WhatsApp Cloud API webhook (GET verify + POST inbound) — the entire
//      user interface. Inbound messages are classified and driven through the
//      router; replies are dispatched back into the same thread.
//   2. M-Pesa Daraja callback — the financial layer. A reconciled STK result
//      locks (or fails) escrow and, for software services, triggers execution.
//   3. Programmatic/status endpoints — a direct STK-push, order status, a
//      wa.me deep-link generator (the "Zero-Click Social Entry Point"), and an
//      honest configuration status.
//
// SECURITY POSTURE (matches the rest of this server):
//   * The WhatsApp webhook verifies X-Hub-Signature-256 over the RAW body,
//     timing-safe, and fails closed when the app secret is unset.
//   * The M-Pesa callback relies on a secret path segment + amount/reference
//     re-verification (Daraja signs nothing); it fails closed with no secret.
//   * No route reads money or identity from a request body where the server
//     can derive it. Money comes from the catalog; the caller's phone is the
//     user key.
// ---------------------------------------------------------------------------

import { store } from '../store.js';
import { now, recordError } from './helpers.js';
import { requireFeature } from '../features.js';
import * as waInbound from '../connectors/whatsapp.js';
import * as mpesa from '../connectors/mpesa.js';
import * as waOutbound from '../domain/huduma/whatsapp.js';
import * as router from '../domain/huduma/router.js';
import * as orders from '../domain/huduma/orders.js';
import * as users from '../domain/huduma/users.js';
import * as catalog from '../domain/huduma/catalog.js';
import * as executor from '../domain/huduma/executor.js';
import { status as cryptoStatus } from '../domain/huduma/crypto.js';

export function register(app) {
  app.use('/api/huduma', requireFeature('huduma'));

  // --- Honest configuration status -----------------------------------------

  app.get('/api/huduma/status', (_req, res) => {
    res.json({
      product: 'HudumaLink',
      whatsappInbound: waInbound.isConfigured(),
      whatsappOutbound: waOutbound.status(),
      mpesa: mpesa.status(),
      crypto: cryptoStatus(),
      executor: executor.isConfigured(),
      services: catalog.allServices().length
    });
  });

  // --- The "Zero-Click Social Entry Point" --------------------------------
  //
  // Ads, QR codes and TikTok links do not point at a website; they deep-link
  // into WhatsApp with a pre-filled line. This builds that wa.me URL from a
  // configured business number + an optional pre-filled message.

  app.get('/api/huduma/deeplink', (req, res) => {
    const number = process.env.HUDUMA_WA_NUMBER; // e.g. 254712345678
    if (!number) {
      return res.status(503).json({
        available: false,
        reason: 'HUDUMA_WA_NUMBER not configured',
        template: 'https://wa.me/<number>?text=<urlencoded message>'
      });
    }
    const text = (req.query.text ?? 'I need help with a government service.').toString();
    const url = `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
    res.json({ available: true, url, text });
  });

  app.post('/api/huduma/deeplink', (req, res) => {
    const number = process.env.HUDUMA_WA_NUMBER;
    if (!number) return res.status(503).json({ available: false, reason: 'HUDUMA_WA_NUMBER not configured' });
    const text = (req.body?.text ?? 'I need help with a government service.').toString().slice(0, 1000);
    res.json({ available: true, url: `https://wa.me/${number}?text=${encodeURIComponent(text)}`, text });
  });

  // --- WhatsApp Cloud API webhook -----------------------------------------

  app.get('/api/huduma/webhook', (req, res) => {
    const check = waInbound.verifySubscription(req.query);
    if (!check.ok) return res.status(check.status ?? 403).json({ error: check.error });
    // Meta expects the raw challenge string back.
    return res.status(200).type('text/plain').send(String(check.challenge ?? ''));
  });

  app.post('/api/huduma/webhook', async (req, res) => {
    // Verify over the RAW body — the HMAC must be computed over Meta's exact bytes.
    const sig = waInbound.verifySignature(req.rawBody, req.headers['x-hub-signature-256']);
    if (!sig.ok) {
      recordError('huduma_whatsapp', null, `rejected inbound: ${sig.error}`);
      return res.status(401).json({ error: 'signature verification failed' });
    }

    const events = extractMessages(req.body);
    if (events.length === 0) {
      // An empty/status webhook is valid; acknowledge and move on.
      return res.status(200).json({ ok: true, handled: 0 });
    }

    // Respond 200 to Meta FAST, then dispatch replies. A slow response triggers
    // Meta's retry, which (with idempotent handling) is harmless but wasteful.
    res.status(200).json({ ok: true, handled: events.length });

    // Fire replies in the background. Failures are recorded, never thrown to a
    // client that has already been acknowledged.
    for (const ev of events) {
      try {
        await router.handleInbound(ev, { dispatch: waOutbound.realDispatch });
      } catch (e) {
        recordError('huduma_whatsapp', ev.phone ?? null, String(e.message ?? e));
      }
    }
  });

  // --- Programmatic STK push (alternative entry, e.g. a PWA) ---------------

  app.post('/api/huduma/stk-push', async (req, res) => {
    try {
      const phone = users.normalisePhone(req.body?.phone);
      const serviceId = req.body?.serviceId;
      const capturedInputs = req.body?.inputs ?? {};
      if (!phone) return res.status(400).json({ error: 'a valid phone is required' });
      if (!catalog.getService(serviceId)) return res.status(400).json({ error: 'unknown service' });

      const order = orders.createOrder({ phone, serviceId, capturedInputs });
      orders.attachUser(order.id, users.getOrCreateUser(phone).id);

      const push = await mpesa.stkPush({
        amount: order.totalFee, phone, accountReference: order.id, description: order.serviceTitle
      });
      if (!push.ok) {
        // Honest: the order is saved and PENDING; M-Pesa could not start.
        return res.status(502).json({ order, charged: false, error: push.reason, detail: push });
      }
      orders.registerStkPush(order.id, { mpesaCheckoutId: push.checkoutRequestId, amount: order.totalFee });
      res.status(201).json({ order, charged: true, checkoutRequestId: push.checkoutRequestId });
    } catch (e) {
      res.status(400).json({ error: String(e.message ?? e) });
    }
  });

  // --- M-Pesa Daraja callback ---------------------------------------------

  app.post('/api/huduma/webhooks/mpesa/:secret', async (req, res) => {
    const check = mpesa.verifyCallbackSecret(req.params.secret);
    // Persist every callback (accepted or not) for audit, like the Tuma route.
    store.insert('paymentCallbacks', {
      id: `hcb_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
      provider: 'mpesa-daraja', accepted: check.ok,
      reason: check.reason ?? null, body: req.body ?? null, at: now()
    });
    if (!check.ok) {
      recordError('huduma_mpesa', null, `rejected callback: ${check.reason}`);
      return res.status(403).json({ error: 'rejected' });
    }

    const parsed = mpesa.parseCallback(req.body);
    if (!parsed.ok) {
      recordError('huduma_mpesa', null, 'unrecognised callback payload');
      return res.status(400).json({ error: 'unrecognised payload' });
    }

    const applied = router.applyPayment(parsed);
    if (!applied.ok) {
      recordError('huduma_mpesa', null, `callback not applied: ${applied.reason}`);
      // 200 to Daraja: a retry will not help, and Daraja retries on non-2xx.
      return res.status(200).json({ ok: false, reason: applied.reason });
    }

    // On a fresh lock, attempt fulfilment. Software services can complete
    // synchronously (when an executor is registered); runner services stay PAID
    // until a field operator closes them. An unconfigured executor honestly
    // leaves the order PAID with escrow LOCKED — the money is held, never
    // silently "completed".
    if (applied.applied === 'locked' && !applied.duplicate && applied.order) {
      const o = orders.getOrder(applied.order.id);
      if (o?.execution === catalog.EXECUTION.SOFTWARE) {
        const exec = executor.execute(o.id);
        if (exec.ok && exec.document && o.phone) {
          // Deliver the artefact back into the same chat thread.
          try {
            await waOutbound.send(waOutbound.document(o.phone, exec.document.url, {
              caption: `Your ${o.serviceTitle} is ready. Reference ${o.id}.`,
              filename: `${o.serviceType}.pdf`
            }));
            await waOutbound.send(waOutbound.text(o.phone,
              `✅ Done! Your ${o.serviceTitle} is attached. Funds have been released from escrow.`));
          } catch (e) {
            recordError('huduma_mpesa', o.id, `delivery failed: ${String(e.message ?? e)}`);
          }
        }
      }
    }

    res.status(200).json({ ok: true, applied: applied.applied, duplicate: Boolean(applied.duplicate) });
  });

  // --- Order status (for the citizen or a PWA) ----------------------------

  app.get('/api/huduma/orders/:id', (req, res) => {
    const order = orders.getOrder(req.params.id);
    if (!order) return res.status(404).json({ error: 'order not found' });
    res.json({ order });
  });
}

/**
 * Extract conversational events from a Cloud API webhook payload.
 *
 * Returns one event per inbound message with the fields the router needs:
 *   { phone, name, text, interactive }
 *
 * Interactive (button_reply / list_reply) is preserved structurally so the
 * router's classifier can read a definitive id rather than guessing intent.
 */
function extractMessages(payload) {
  const out = [];
  for (const entry of payload?.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value ?? {};
      const contacts = value.contacts ?? [];
      for (const msg of value.messages ?? []) {
        const contact = contacts.find((c) => c.wa_id === msg.from);
        out.push({
          phone: msg.from ?? null,
          name: contact?.profile?.name ?? null,
          text: msg.text?.body ?? msg.caption ?? null,
          interactive: msg.interactive ?? null
        });
      }
    }
  }
  return out;
}
