// ---------------------------------------------------------------------------
// QUOTE VOTES — the group decides which quote to accept for a COLLECTIVE
// request (a request placed on behalf of a table-banking group). Members vote;
// a strict majority is a real, derived tally (never stored as a counter). When
// the group reaches a majority approval, the requester (their delegate) may
// accept the quote through the EXISTING quote-accept path — the vote is the
// authorisation, the accept is the same tested mutation as a single click.
//
// Honesty: votes are real rows; the tally is recomputed on every read; no
// quote is accepted without the same validations a single requester would
// face. This module never fabricates a quote or a vote.
// ---------------------------------------------------------------------------

import { store, newId } from '../store.js';
import * as quotes from './quotes.js';
import * as tableBanking from './tableBanking.js';

/** The derived tally for one quote. */
export function quoteVoteState(quoteId) {
  const votes = store.filter('quoteVotes', (v) => v.quoteId === quoteId);
  const approveCount = votes.filter((v) => v.approve).length;
  const declineCount = votes.length - approveCount;
  return { approveCount, declineCount, total: votes.length, votes };
}

/** Which quotes are open for the group's collective requests (derived). */
export function listGroupQuotes(tableBankingId) {
  const reqs = store.filter('requests', (r) => r.businessContext?.tableBankingId === tableBankingId);
  const out = [];
  for (const r of reqs) {
    const invitations = store.filter('quoteRequests', (qr) => qr.requestId === r.id);
    for (const inv of invitations) {
      for (const q of store.filter('requestQuotes', (x) => x.quoteRequestId === inv.id)) {
        out.push({
          quoteId: q.id,
          requestId: r.id,
          requestTitle: r.title,
          requesterId: r.requesterId,
          status: q.status,
          vote: quoteVoteState(q.id),
          // The group's size determines the quorum; derived, never stored.
          quorum: Math.max(1, Math.floor((store.find('tableBanking', (g) => g.id === tableBankingId)?.members.length ?? 1) / 2) + 1)
        });
      }
    }
  }
  return out;
}

/** One member's vote on a quote for their group's collective request. */
export function voteOnQuote(tableBankingId, voterId, quoteId, approve) {
  const group = tableBanking.getTableBanking(tableBankingId);
  if (!group) { const e = new Error('group not found'); e.status = 404; e.code = 'not_found'; throw e; }
  if (!group.members.some((m) => m.userId === voterId)) { const e = new Error('you are not a member of this group'); e.status = 403; e.code = 'not_member'; throw e; }

  const q = store.lookup('requestQuotes', quoteId);
  if (!q) { const e = new Error('quote not found'); e.status = 404; e.code = 'not_found'; throw e; }
  const r = store.lookup('requests', q.requestId);
  if (!r || r.businessContext?.tableBankingId !== tableBankingId) {
    const e = new Error('quote not found'); e.status = 404; e.code = 'not_found'; throw e;
  }
  if (store.find('quoteVotes', (v) => v.quoteId === quoteId && v.voterId === voterId)) {
    const e = new Error('you already voted on this quote'); e.status = 409; e.code = 'already_voted'; throw e;
  }
  store.insert('quoteVotes', {
    id: newId('qv'),
    quoteId,
    tableBankingId,
    voterId,
    approve: Boolean(approve),
    at: new Date().toISOString()
  });
  return quoteVoteState(quoteId);
}

/**
 * Accept a quote the group has approved, on the requester's behalf. This runs
 * the SAME validations a single requester click would; a quote that is not in
 * an acceptable state (or that fails validation) is reported honestly, never
 * silently "accepted".
 */
export function acceptQuoteByGroupVote(tableBankingId, quoteId) {
  const state = quoteVoteState(quoteId);
  const group = store.find('tableBanking', (g) => g.id === tableBankingId);
  const quorum = Math.max(1, Math.floor((group?.members.length ?? 1) / 2) + 1);
  if (state.approveCount < quorum) {
    const e = new Error('the group has not approved this quote'); e.status = 409; e.code = 'no_majority'; throw e;
  }
  const q = store.lookup('requestQuotes', quoteId);
  if (!q) { const e = new Error('quote not found'); e.status = 404; e.code = 'not_found'; throw e; }
  const r = store.lookup('requests', q.requestId);
  if (!r) { const e = new Error('request not found'); e.status = 404; e.code = 'not_found'; throw e; }
  return quotes.mutate(r.requesterId, quoteId, {
    action: 'accept',
    revision: q.revision,
    requestRevision: r.revision,
    idempotencyKey: `group-vote-${quoteId}`
  });
}
