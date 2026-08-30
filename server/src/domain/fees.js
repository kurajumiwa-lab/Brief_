// ---------------------------------------------------------------------------
// SERVICE FEES — paying Brief through Pochi la Biashara, manual-first.
//
// Pochi la Biashara has no developer API: it is a wallet on a phone number,
// activated by *334#, with no webhooks and no Daraja. So the flow is honest
// and manual at the seams:
//
//   1. Brief shows its Pochi number (BRIEF_POCHI_NUMBER; if unset, the
//      surface says so instead of inventing one) and the SERVER-SIDE price.
//   2. The member pays in their M-Pesa app and submits the M-Pesa
//      confirmation code.
//   3. The fee row is PENDING — a service never activates on trust alone —
//      until a finance-capable operator confirms the code is real.
//   4. Money truth stays in the ledger: the fee creates a ledger
//      transaction (created -> pending), confirmed or failed alongside the
//      fee row. Totals are DERIVED by scanning rows, never stored.
//
// The amount can only come from SERVICE_CATALOG — the client sends a service
// key, never a price. Server-authoritative money is a house rule.
// ---------------------------------------------------------------------------

import { store, newId } from '../store.js';
import { createTransaction, transitionTransaction } from './ledger.js';
import { notify } from './notifications.js';

/** The single price list. To change a price, change it HERE. */
export const SERVICE_CATALOG = {
  store_monthly: { label: 'Your store on Brief — one month', amountKes: 250 },
  promotion_weekly: { label: 'Promote a listing for one week', amountKes: 500 }
};

export function catalogView() {
  return Object.entries(SERVICE_CATALOG).map(([key, s]) => ({ key, label: s.label, amountKes: s.amountKes }));
}

// Safaricom M-PESA confirmation codes are short uppercase alphanumeric
// strings (e.g. QJD31X5K2S). We validate shape only — an operator still
// confirms the code is real, which is the part software cannot know.
const CODE_SHAPE = /^[A-Z0-9]{8,12}$/;

export function payServiceFee(actorId, { service, mpesaCode } = {}) {
  if (!actorId) throw new Error('sign in to pay for a service');
  const entry = SERVICE_CATALOG[service];
  if (!entry) throw new Error('unknown service');
  const code = String(mpesaCode ?? '').trim().toUpperCase();
  if (!CODE_SHAPE.test(code)) throw new Error('that does not look like an M-Pesa confirmation code');

  // One M-Pesa code is one payment, ever. A refused code stays locked too:
  // the operator already judged it invalid, and retrying the same code
  // should not produce a second pending row for anyone.
  if (store.find('servicePayments', (f) => f.mpesaCode === code)) {
    const e = new Error('this M-Pesa code has already been recorded');
    e.status = 409;
    throw e;
  }

  const tx = createTransaction({
    amount: entry.amountKes,
    type: 'service_fee',
    description: `${entry.label} (M-Pesa ${code})`,
    counterparty: actorId,
    metadata: { service, mpesaCode: code }
  });
  transitionTransaction(tx.id, 'pending', 'awaiting confirmation of the M-Pesa code');

  const row = store.insert('servicePayments', {
    id: newId('fee'),
    userId: actorId,
    service,
    label: entry.label,
    amountKes: entry.amountKes,
    mpesaCode: code,
    ledgerId: tx.id,
    status: 'pending',
    confirmedBy: null,
    confirmedAt: null,
    refusedReason: null,
    createdAt: new Date().toISOString()
  });
  return row;
}

/** Finance-capable operator accepts or refuses a pending code. */
export function respondServiceFee(operatorId, feeId, { accept, note = '' } = {}) {
  const row = store.find('servicePayments', (f) => f.id === feeId);
  if (!row) throw new Error('payment not found');
  if (row.status !== 'pending') throw new Error(`this payment is already ${row.status}`);
  const reason = String(note ?? '').trim();

  if (!accept) {
    if (reason.length < 4) throw new Error('say why the code is refused');
    transitionTransaction(row.ledgerId, 'failed', reason.slice(0, 200));
    const refused = store.update('servicePayments', row.id, { status: 'refused', refusedReason: reason.slice(0, 300) });
    notify(row.userId, {
      kind: 'system',
      title: 'Your service payment could not be confirmed',
      body: `${row.label} — the code ${row.mpesaCode} was refused: ${reason.slice(0, 140)}. If you paid, reply with a screenshot of the M-Pesa message.`
    });
    return refused;
  }

  transitionTransaction(row.ledgerId, 'confirmed', 'M-Pesa code confirmed by operator');
  const confirmed = store.update('servicePayments', row.id, {
    status: 'confirmed',
    confirmedBy: operatorId,
    confirmedAt: new Date().toISOString()
  });
  notify(row.userId, {
    kind: 'system',
    title: 'Your service payment is confirmed',
    body: `${row.label} — KES ${row.amountKes} confirmed. The service is active.`
  });
  return confirmed;
}

export function listServiceFees({ userId = null, status = null } = {}) {
  let rows = store.all('servicePayments');
  if (userId) rows = rows.filter((f) => f.userId === userId);
  if (status) rows = rows.filter((f) => f.status === status);
  return rows.slice().sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

/** Confirmed service revenue is DERIVED by scanning rows — never stored. */
export function confirmedServiceRevenue() {
  return listServiceFees({ status: 'confirmed' }).reduce((sum, f) => sum + f.amountKes, 0);
}
