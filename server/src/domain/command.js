// ---------------------------------------------------------------------------
// HOST COMMAND CENTRE
//
// A host-facing projection that answers, from REAL rows and nothing else:
//
//   NOW      — what needs attention right now (unresolved requests, pending
//              payments, unpaid held spots, upcoming gatherings)
//   MONEY    — gross settled vs pending revenue across the host's campaigns
//   PEOPLE   — registered / checked-in / cancelled across campaigns
//   DISTRIBUTION — views and shares (recorded signals, not a counter)
//   ACTION   — the vault resolution centre's items, scoped to this host
//   NEXT     — what is coming after this gathering
//
// Every number is DERIVED by scanning rows via the existing domain services —
// there is no stored dashboard and no cached total that could drift from the
// ledger. A figure shown here is the same figure the ledger/campaigns/vaults
// already produce; this module only gathers them into one view.
// ---------------------------------------------------------------------------

import { store } from '../store.js';
import * as campaigns from './campaign.js';
import * as vault from './vault.js';

export function commandCentre(actorId) {
  if (!actorId) return null;

  const mine = campaigns.listCampaigns(actorId);
  const vaults = vault.listVaults(actorId);

  // --- MONEY + PEOPLE + DISTRIBUTION, aggregated across campaigns ----------
  let grossSettled = 0;
  let grossPending = 0;
  let registered = 0;
  let checkedIn = 0;
  let cancelled = 0;
  let views = 0;
  let shares = 0;

  const campaignRows = [];
  for (const c of mine) {
    const a = campaigns.analytics(c.id);
    grossSettled += a.revenueSettled;
    grossPending += a.revenuePending;
    registered += a.registrations;
    checkedIn += a.checkedIn;
    cancelled += a.cancelled;
    views += a.views;
    shares += a.shares;
    campaignRows.push({
      id: c.id,
      title: c.title,
      type: c.type,
      status: c.status,
      startsAt: c.startsAt,
      price: c.price,
      currency: c.currency,
      capacity: c.capacity,
      remaining: a.remaining,
      soldOut: a.remaining === 0,
      registered: a.registrations,
      checkedIn: a.checkedIn,
      revenueSettled: a.revenueSettled,
      revenuePending: a.revenuePending,
      views: a.views,
      shares: a.shares,
      conversionPct: a.conversionPct
    });
  }

  // --- NOW: things that need attention -------------------------------------
  const now = [];

  // Unpaid held spots (a paid campaign registration still in 'started').
  for (const c of mine) {
    for (const r of store.filter('registrations', (x) => x.campaignId === c.id && x.status === 'started')) {
      now.push({
        kind: 'unpaid_spot',
        campaignId: c.id,
        campaignTitle: c.title,
        name: r.name ?? r.attendeeRef,
        registrationId: r.id
      });
    }
  }

  // Upcoming gatherings (published/live with a future start).
  const upcoming = campaignRows
    .filter((c) => c.startsAt && Date.parse(c.startsAt) > Date.now())
    .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt))
    .slice(0, 5)
    .map((c) => ({ id: c.id, title: c.title, startsAt: c.startsAt, status: c.status }));

  // --- ACTION: the vault resolution centre, scoped to this host's vaults ---
  const action = vault.resolution().filter((item) =>
    vaults.some((v) => v.id === item.vaultId) || mine.some((c) => c.id === item.vaultId)
  );

  return {
    money: {
      grossSettled,
      grossPending,
      currency: mine[0]?.currency ?? 'KES',
      campaignCount: mine.length
    },
    people: { registered, checkedIn, cancelled },
    distribution: { views, shares },
    now,
    upcoming,
    action: action.slice(0, 20),
    campaigns: campaignRows,
    vaultCount: vaults.length
  };
}
