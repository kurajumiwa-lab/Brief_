// VERIFICATION + EMAIL SUBSCRIPTION ROUTES (Tikiti T6 + T7).
//
// Verification review is capability-gated (moderate) and audited -- the same
// operator rules as every consequential act. Email subscription confirm and
// unsubscribe are token-addressed (the token arrives by mail; no auth needed
// to LEAVE a list, which is the privacy-correct direction).

import { callerId } from '../identity.js';
import { store } from '../store.js';
import * as verification from '../domain/verification.js';
import * as smileid from '../connectors/smileid.js';
import { requireAuth, requireCap, recordAudit } from './helpers.js';

/**
 * KYC ASSIST (never KYC autopilot). When the Smile ID connector is
 * configured, an identity/phone submission is checked against the register
 * and ONLY THE OUTCOME CODES are attached to the record for the reviewer.
 *
 *   * the reviewer still decides on the audited decision route -- a provider
 *     result is evidence, not a verdict
 *   * PII minimisation: the ID/phone number goes to the provider for the
 *     check and is never persisted on the record
 *   * every failure mode is recorded as exactly what it was; nothing is
 *     inferred from silence
 */
async function assistRecord(kind, details) {
  if (!smileid.isConfigured()) return null;
  const at = new Date().toISOString();
  if (kind === 'identity' && details?.idNumber) {
    const r = await smileid.lookupId({ idNumber: String(details.idNumber).trim() });
    return r.ok
      ? { provider: 'smileid', at, ok: true, resultCode: r.resultCode, resultText: r.resultText }
      : { provider: 'smileid', at, ok: false, reason: r.reason };
  }
  if (kind === 'phone' && details?.phoneNumber) {
    const r = await smileid.lookupPhone({ phoneNumber: String(details.phoneNumber).trim() });
    return r.ok
      ? { provider: 'smileid', at, ok: true, resultCode: r.resultCode, resultText: r.resultText }
      : { provider: 'smileid', at, ok: false, reason: r.reason };
  }
  return null;
}

export function register(app) {
  // --- T6: verification ------------------------------------------------------

  app.post('/api/verification', async (req, res) => {
    const me = requireAuth(req, res);
    if (!me) return;
    try {
      const { record, changed } = verification.submitVerification(me, {
        kind: req.body?.kind,
        providerRef: req.body?.providerRef ?? null,
        note: req.body?.note ?? null
      });
      // Attach the provider assist AFTER the record exists, only on the
      // submission that created/changed it (a no-op resubmit carries the
      // original assist; re-checking would bill a second check for nothing).
      let assisted = record.providerAssist ?? null;
      if (changed) {
        const assist = await assistRecord(record.kind, {
          idNumber: req.body?.idNumber ?? null,
          phoneNumber: req.body?.phoneNumber ?? null
        });
        if (assist) {
          assisted = assist;
          store.update('verificationRecords', record.id, { providerAssist: assist });
        }
      }
      res.status(changed ? 201 : 200).json({
        record: changed ? (store.find('verificationRecords', (r) => r.id === record.id) ?? record) : record,
        changed,
        // Honest either way: 'smileid' when a check ran, null when the
        // reviewer is on their own (no provider configured).
        assistProvider: smileid.isConfigured() ? 'smileid' : null
      });
    } catch (e) {
      res.status(400).json({ error: String(e.message ?? e) });
    }
  });

  app.get('/api/verification/me', (req, res) => {
    const me = requireAuth(req, res);
    if (!me) return;
    res.json({ records: verification.myRecords(me), standing: verification.standingOf(me) });
  });

  app.get('/api/ops/verification', (req, res) => {
    const gate = requireCap(req, res, 'moderate');
    if (!gate) return;
    res.json({ queue: verification.reviewQueue() });
  });

  app.post('/api/ops/verification/:id/decision', (req, res) => {
    const gate = requireCap(req, res, 'moderate');
    if (!gate) return;
    try {
      // Snapshot as a copy: store.find returns the LIVE row, and decide()
      // below would otherwise rewrite "before" into "after".
      const liveRow = store.find('verificationRecords', (r) => r.id === req.params.id) ?? null;
      const before = liveRow ? { status: liveRow.status } : null;
      const record = verification.decide(callerId(req), req.params.id, {
        decision: req.body?.decision,
        reason: req.body?.reason ?? null
      });
      recordAudit('verification.decision', {
        actorId: callerId(req),
        objectType: 'verificationRecord',
        objectId: req.params.id,
        before: before ? { status: before.status } : null,
        after: { status: record.status },
        reason: record.reason
      });
      res.json({ record });
    } catch (e) {
      res.status(400).json({ error: String(e.message ?? e) });
    }
  });

  app.post('/api/ops/verification/:id/revoke', (req, res) => {
    const gate = requireCap(req, res, 'moderate');
    if (!gate) return;
    try {
      const record = verification.revoke(callerId(req), req.params.id, req.body?.reason ?? '');
      recordAudit('verification.revoke', {
        actorId: callerId(req),
        objectType: 'verificationRecord',
        objectId: req.params.id,
        before: { status: 'approved' },
        after: { status: 'revoked' },
        reason: record.reason
      });
      res.json({ record });
    } catch (e) {
      res.status(400).json({ error: String(e.message ?? e) });
    }
  });

  // --- T7: email subscriptions ------------------------------------------------

  app.post('/api/email-subscriptions', (req, res) => {
    try {
      const { subscription, changed } = verification.subscribeEmail(req.body?.email, req.body?.topics);
      res.status(changed ? 201 : 200).json({
        // The token is the subscriber's own secret; it is returned once here
        // (the mail that would carry it cannot be sent without a provider)
        // and never appears in any list endpoint.
        subscription: changed ? subscription : { ...subscription, token: undefined },
        delivery: 'no email provider is configured, so the verification mail was not sent; the token is returned here instead',
        changed
      });
    } catch (e) {
      res.status(400).json({ error: String(e.message ?? e) });
    }
  });

  app.get('/api/email-subscriptions/confirm', (req, res) => {
    const result = verification.confirmEmail(req.query?.token);
    if (!result.ok) return res.status(404).json({ error: 'this confirmation link is not valid' });
    res.json({ ok: true, already: Boolean(result.already), topics: result.subscription.topics });
  });

  app.post('/api/email-subscriptions/unsubscribe', (req, res) => {
    const result = verification.unsubscribe(req.body?.token ?? req.body?.email);
    if (!result.ok) return res.status(404).json({ error: 'no subscription matches that address or token' });
    res.json({ ok: true, already: Boolean(result.already) });
  });

  app.get('/api/ops/email-log', (req, res) => {
    const gate = requireCap(req, res, 'ops.read');
    if (!gate) return;
    res.json({ log: verification.deliveryLog({ limit: Number(req.query?.limit) || 50 }) });
  });
}
