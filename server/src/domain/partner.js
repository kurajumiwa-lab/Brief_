// ---------------------------------------------------------------------------
// PARTNER — first-class distribution partners (the B2B2C infrastructure layer)
//
// The strategy critique's core recommendation, built as infrastructure rather
// than a referral hack. A PARTNER is an organisation that already holds a
// trusted group of women, workers, traders, suppliers or entrepreneurs and
// brings that group onto Brief. The chain reads:
//
//   partner (organisation) → program → cohort → members (attributed at signup)
//     → verified commercial activity → derived revenue share → finance-confirmed
//     settlement.
//
// The first three hops are STORED records (a partner is a real, contracted
// thing). Everything economic below them is DERIVED from the attribution keys
// plus real rows — never stored, never fabricated. See domain/attribution.js
// for the member→activity derivation this module builds on.
//
// HONESTY (unchanged rules, restated):
//   * a partner record is created by an operator, never by a member claim.
//   * partnerType is a closed set; an unknown type is refused, not guessed.
//   * the revenue share is a DERIVED OBLIGATION — floor(shareRate × verified
//     commercial activity). It is a number, not money. It becomes money only
//     through a settlement that finance CONFIRMS, which writes a real ledger
//     transaction (type partner_revenue_share). Nothing here mints money.
//   * a partner with no attributed members and no activity shows ZERO, plainly.
//   * a settlement snapshots its gross+share at record time, so later activity
//     can never rewrite what a partner was paid.
// ---------------------------------------------------------------------------

import { store, newId } from '../store.js';
import * as attribution from './attribution.js';
import { createTransaction, transitionTransaction } from './ledger.js';

// Closed sets — an operator cannot invent a category the reporting code has
// no idea how to treat.
export const PARTNER_TYPES = [
  'women_org', 'bank', 'sacco', 'cooperative', 'ngo', 'employer', 'network', 'other'
];
// The only basis we can honestly compute is the partner's own cohort's
// verified commercial activity. Platform-wide service revenue is NOT
// attributable to a single partner and is deliberately absent here.
export const BASIS_TYPES = ['verified_commercial'];
export const PARTNER_STATUS = ['active', 'paused', 'archived'];
export const SETTLEMENT_STATUS = ['pending', 'confirmed', 'refused'];

function fail(message, status = 400, code = 'validation_error') {
  const e = new Error(message);
  e.status = status;
  e.code = code;
  throw e;
}

/** A partner key is a lowercase slug; used to join against attribution keys. */
function keyOf(value, fallback = null) {
  const s = String(value ?? fallback ?? '').trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '-');
  return s.replace(/^-+|-+$/g, '').slice(0, 96) || null;
}
function nameOf(value) {
  const s = String(value ?? '').trim();
  return s ? s.slice(0, 120) : null;
}

// ---------------------------------------------------------------------------
// PARTNERS
// ---------------------------------------------------------------------------
export function createPartner({ name, partnerType, key = null, operatorId = null }) {
  const n = nameOf(name);
  if (!n) fail('partner name is required');
  if (!PARTNER_TYPES.includes(partnerType)) fail(`partnerType must be one of ${PARTNER_TYPES.join(', ')}`);
  const k = keyOf(key, n);
  if (!k) fail('a partner key could not be derived');
  if (store.find('partners', (p) => p.key === k)) fail('a partner with that key already exists', 409, 'duplicate_key');
  const now = new Date().toISOString();
  return store.insert('partners', {
    id: newId('ptn'),
    key: k,
    name: n,
    partnerType,
    status: 'active',
    createdBy: operatorId ?? null,
    createdAt: now,
    updatedAt: now
  });
}

export function getPartner(id) {
  return store.find('partners', (p) => p.id === id) ?? null;
}
export function getPartnerByKey(key) {
  const k = keyOf(key);
  if (!k) return null;
  return store.find('partners', (p) => p.key === k) ?? null;
}
export function listPartners() {
  return store.all('partners').slice().sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

// ---------------------------------------------------------------------------
// PROGRAMS & COHORTS
// ---------------------------------------------------------------------------
export function createProgram(partnerId, { key, name }) {
  const partner = getPartner(partnerId);
  if (!partner) fail('partner not found', 404, 'not_found');
  const n = nameOf(name);
  if (!n) fail('program name is required');
  const k = keyOf(key, n);
  if (!k) fail('a program key could not be derived');
  if (store.find('partnerPrograms', (p) => p.partnerId === partnerId && p.key === k)) {
    fail('a program with that key already exists for this partner', 409, 'duplicate_key');
  }
  const now = new Date().toISOString();
  return store.insert('partnerPrograms', {
    id: newId('prg'), partnerId, key: k, name: n, status: 'active', createdAt: now, updatedAt: now
  });
}

export function createCohort(programId, { key, name }) {
  const program = store.find('partnerPrograms', (p) => p.id === programId);
  if (!program) fail('program not found', 404, 'not_found');
  const n = nameOf(name);
  if (!n) fail('cohort name is required');
  const k = keyOf(key, n);
  if (!k) fail('a cohort key could not be derived');
  if (store.find('partnerCohorts', (c) => c.programId === programId && c.key === k)) {
    fail('a cohort with that key already exists for this program', 409, 'duplicate_key');
  }
  const now = new Date().toISOString();
  return store.insert('partnerCohorts', {
    id: newId('chrt'), programId, partnerId: program.partnerId, key: k, name: n, status: 'active', createdAt: now, updatedAt: now
  });
}

export function programsOf(partnerId) {
  return store.filter('partnerPrograms', (p) => p.partnerId === partnerId);
}
export function cohortsOf(programId) {
  return store.filter('partnerCohorts', (c) => c.programId === programId);
}

// ---------------------------------------------------------------------------
// COMMERCIAL AGREEMENT (append-only; one active per partner)
// ---------------------------------------------------------------------------
export function activeAgreement(partnerId) {
  return store.find('commercialAgreements', (a) => a.partnerId === partnerId && a.status === 'active') ?? null;
}

export function setAgreement(partnerId, { shareRate, basis = 'verified_commercial' }) {
  const partner = getPartner(partnerId);
  if (!partner) fail('partner not found', 404, 'not_found');
  const rate = Number(shareRate);
  if (!Number.isFinite(rate) || rate < 0 || rate > 1) {
    fail('shareRate must be a number between 0 and 1');
  }
  if (!BASIS_TYPES.includes(basis)) fail(`basis must be one of ${BASIS_TYPES.join(', ')}`);
  // Supersede any active agreement; history is preserved, never rewritten.
  const prior = activeAgreement(partnerId);
  if (prior) {
    store.update('commercialAgreements', prior.id, { status: 'superseded', supersededAt: new Date().toISOString() });
  }
  const now = new Date().toISOString();
  return store.insert('commercialAgreements', {
    id: newId('agr'),
    partnerId,
    shareRate: rate,
    basis,
    status: 'active',
    effectiveAt: now,
    supersededAt: null,
    createdAt: now
  });
}

// ---------------------------------------------------------------------------
// DERIVED ECONOMICS — the transparent split, never stored.
// ---------------------------------------------------------------------------
export function partnerEconomics(partnerId) {
  const partner = getPartner(partnerId);
  if (!partner) fail('partner not found', 404, 'not_found');
  const summary = attribution.cohortSummary({ partnerKey: partner.key });
  const agreement = activeAgreement(partnerId);
  const shareRate = agreement?.shareRate ?? null;
  const grossKes = summary.verifiedCommercialKes;
  const partnerShareKes = shareRate === null ? null : Math.floor(shareRate * grossKes);

  const settlements = store.filter('partnerSettlements', (s) => s.partnerId === partnerId);
  const confirmedKes = settlements.filter((s) => s.status === 'confirmed').reduce((sum, s) => sum + s.shareKes, 0);
  const pendingKes = settlements.filter((s) => s.status === 'pending').reduce((sum, s) => sum + s.shareKes, 0);

  return {
    partner: { id: partner.id, key: partner.key, name: partner.name, partnerType: partner.partnerType, status: partner.status },
    members: summary.members,
    activity: {
      ordersBought: summary.ordersBought,
      ordersSold: summary.ordersSold,
      workRequested: summary.workRequested,
      workFulfilled: summary.workFulfilled,
      repeatPatterns: summary.repeatPatterns,
      requestsCreated: summary.requestsCreated
    },
    grossKes,
    basis: agreement?.basis ?? null,
    shareRate,
    partnerShareKes,
    // Settlement ledger against this partner: what is actually owed/pending/paid.
    settlements: { pendingKes, confirmedKes },
    note: 'partnerShareKes is a derived obligation against verified commercial activity. It is not money until a settlement is recorded and confirmed by finance.'
  };
}

// ---------------------------------------------------------------------------
// SETTLEMENT — the only place partner money becomes real.
// ---------------------------------------------------------------------------
export function requestSettlement(partnerId, { from = null, to = null, operatorId = null } = {}) {
  const partner = getPartner(partnerId);
  if (!partner) fail('partner not found', 404, 'not_found');
  const agreement = activeAgreement(partnerId);
  if (!agreement || agreement.shareRate <= 0) {
    fail('this partner has no active revenue-share agreement', 409, 'no_agreement');
  }
  const grossKes = attribution.cohortSummary({ partnerKey: partner.key }).verifiedCommercialKes;
  const shareKes = Math.floor(agreement.shareRate * grossKes);
  if (shareKes <= 0) {
    fail('no qualifying commercial activity to settle against', 409, 'no_activity');
  }
  // Idempotent per period: the obligation is snapshotted once, so a re-request
  // of the same period cannot double-book a partner payment.
  const periodKey = `${partner.id}:${from ?? 'all'}:${to ?? 'all'}`;
  if (store.find('partnerSettlements', (s) => s.periodKey === periodKey && s.status !== 'refused')) {
    fail('a settlement for this period already exists', 409, 'duplicate_settlement');
  }
  const tx = createTransaction({
    amount: shareKes,
    type: 'partner_revenue_share',
    description: `Partner revenue share — ${partner.name} (${agreement.shareRate * 100}% of verified commercial activity)`,
    counterparty: partner.id,
    metadata: {
      partnerId: partner.id,
      partnerKey: partner.key,
      shareRate: agreement.shareRate,
      grossKes,
      periodFrom: from,
      periodTo: to
    }
  });
  transitionTransaction(tx.id, 'pending', 'awaiting finance confirmation of partner payout');
  const now = new Date().toISOString();
  return store.insert('partnerSettlements', {
    id: newId('pstl'),
    partnerId: partner.id,
    periodKey,
    periodFrom: from,
    periodTo: to,
    grossKes,
    shareRate: agreement.shareRate,
    shareKes,
    basis: agreement.basis,
    ledgerId: tx.id,
    status: 'pending',
    requestedBy: operatorId ?? null,
    confirmedBy: null,
    confirmedAt: null,
    refusedReason: null,
    createdAt: now,
    updatedAt: now
  });
}

export function confirmSettlement(settlementId, { operatorId = null, accept = true, note = '' } = {}) {
  const row = store.find('partnerSettlements', (s) => s.id === settlementId);
  if (!row) fail('settlement not found', 404, 'not_found');
  if (row.status !== 'pending') fail(`this settlement is already ${row.status}`, 409, 'invalid_state');
  const reason = String(note ?? '').trim();
  if (!accept) {
    if (reason.length < 4) fail('say why the settlement is refused');
    transitionTransaction(row.ledgerId, 'failed', reason.slice(0, 200));
    return store.update('partnerSettlements', row.id, {
      status: 'refused', refusedReason: reason.slice(0, 300),
      updatedAt: new Date().toISOString()
    });
  }
  transitionTransaction(row.ledgerId, 'confirmed', 'partner payout confirmed by finance');
  return store.update('partnerSettlements', row.id, {
    status: 'confirmed', confirmedBy: operatorId, confirmedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });
}

export function listSettlements(partnerId) {
  return store.filter('partnerSettlements', (s) => s.partnerId === partnerId)
    .slice().sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

// ---------------------------------------------------------------------------
// HYDRATED VIEWS
// ---------------------------------------------------------------------------
export function partnerView(partnerId) {
  const partner = getPartner(partnerId);
  if (!partner) return null;
  const programs = programsOf(partnerId).map((p) => ({
    ...p,
    cohorts: cohortsOf(p.id).map((c) => ({
      id: c.id, key: c.key, name: c.name, status: c.status
    }))
  }));
  return {
    ...partner,
    programs,
    agreement: activeAgreement(partnerId),
    economics: partnerEconomics(partnerId)
  };
}

export function listPartnerViews() {
  return listPartners().map((p) => partnerView(p.id));
}
