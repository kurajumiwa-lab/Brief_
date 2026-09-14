// ---------------------------------------------------------------------------
// RECIPROCITY — the social-debt ledger, DERIVED from real favors.
//
// Commitments are unidirectional ("I promise to pay"). Reciprocity is the
// deeper edge: someone did something FOR you that they didn't have to, and now
// you owe them — not legally, but socially. In Brief, that debt is derived from
// rows that already exist, so it is measurable and visible.
//
// Three real favors are recognised today:
//   loan_guarantee  — a member signed as guarantor for someone else's loan,
//                     taking on real risk (value = the loan principal). The
//                     favor is discharged when the loan settles.
//   recommendation  — a partner publicly recommended you after a confirmed
//                     cooperation (mshikano recommendPartner).
//   delivery_cover  — a rider delivered a pickup from a shop ANOTHER agent
//                     onboarded, earning that agent the KES 20 origin fee.
//                     The delivery was the favor (value = the fee it earned).
//
// Derived on read, like commitments.js: a favor can never disagree with the row
// it came from. Every entry carries `evidence` so it is traceable.
//
// There is NO fabricated "coverage swap" or route favor — those rows do not
// exist, and inventing them would be the fraud this layer exists to avoid.
// ---------------------------------------------------------------------------

import { store } from '../store.js';

const DAY = 86400000;
export const RECIPROCITY_WINDOW_DAYS = 14;

const SETTLED_LOAN = new Set(['settled']);

function onboardingAgentOf(vendorId) {
  return store.find('vendorClaims', (c) =>
    c.vendorId === vendorId && c.claimType === 'full_registration' && c.status === 'active')?.agentId ?? null;
}

/**
 * The user's reciprocity ledger:
 *   owedToMe — favors others did for me that I have not yet reciprocated.
 *   owedByMe — favors I did for others that are unreciprocated.
 * `aging` flags a favor past its window — the honest "decay" (social debt
 * going cold), not a penalty score.
 */
export function reciprocityFor(partyId) {
  const now = Date.now();
  const rows = [];

  // --- LOAN GUARANTEE — a guarantor took on the borrower's risk ------------
  for (const loan of store.filter('tableBankingLoans', () => true)) {
    for (const g of loan.guarantors ?? []) {
      if (g !== partyId && loan.borrowerId !== partyId) continue;
      const settled = SETTLED_LOAN.has(loan.status);
      rows.push({
        id: `rcp_loan_${loan.id}_${g}`,
        kind: 'loan_guarantee',
        fromParty: g,
        toParty: loan.borrowerId,
        value: { amount: Number(loan.principal) || 0, currency: 'KES' },
        status: settled ? 'fulfilled' : 'open',
        createdAt: loan.createdAt,
        fulfilledAt: loan.settledAt ?? null,
        evidence: { table: 'tableBankingLoans', id: loan.id }
      });
    }
  }

  // --- RECOMMENDATION — a partner vouched for you --------------------------
  for (const p of store.filter('coopPartnerships', () => true)) {
    for (const r of p.recommendations ?? []) {
      if (r.byUserId !== partyId && r.forUserId !== partyId) continue;
      rows.push({
        id: `rcp_rec_${p.id}_${r.byUserId}`,
        kind: 'recommendation',
        fromParty: r.byUserId,
        toParty: r.forUserId,
        value: null,
        status: 'open', // a vouch is never "settled"; it stays on your record
        createdAt: r.at,
        fulfilledAt: null,
        evidence: { table: 'coopPartnerships', id: p.id }
      });
    }
  }

  // --- DELIVERY COVER — you delivered for another agent's onboarded shop ---
  for (const p of store.filter('pickups', (x) => x.status === 'delivered')) {
    const agent = onboardingAgentOf(p.originVendorId);
    if (!agent || agent === p.riderId) continue; // self-delivery is not a favor
    if (p.riderId !== partyId && agent !== partyId) continue;
    rows.push({
      id: `rcp_pickup_${p.id}`,
      kind: 'delivery_cover',
      fromParty: p.riderId,
      toParty: agent,
      value: { amount: 20, currency: 'KES' }, // the origin fee the delivery earned
      status: 'open',
      createdAt: p.completedAt ?? p.createdAt,
      fulfilledAt: null,
      evidence: { table: 'pickups', id: p.id }
    });
  }

  const owedToMe = rows.filter((c) => c.toParty === partyId && c.status === 'open');
  const owedByMe = rows.filter((c) => c.fromParty === partyId && c.status === 'open');
  const fulfilled = rows.filter((c) => c.status === 'fulfilled');

  const aging = (list) => list
    .filter((c) => now - Date.parse(c.createdAt) > RECIPROCITY_WINDOW_DAYS * DAY)
    .map((c) => ({ ...c, ageDays: Math.floor((now - Date.parse(c.createdAt)) / DAY) }));

  return {
    owedToMe,
    owedByMe,
    fulfilled,
    aging: aging([...owedToMe, ...owedByMe]),
    windowDays: RECIPROCITY_WINDOW_DAYS,
    derivedAt: new Date().toISOString(),
    note:
      'Reciprocity is derived from real favors already on record — a loan you guaranteed, a partner who vouched for you, a delivery you made for another agent\'s shop. Nothing is invented; each entry traces to its source row.'
  };
}
