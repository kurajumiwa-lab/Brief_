// ---------------------------------------------------------------------------
// FLOWS — the supply board read as routes, not as a shelf.
//
// A marketplace shows products. A supply chain shows MOVEMENT: this commodity,
// leaving this place, going to this kind of buyer. Brief's sellers are mostly
// wholesale, group and source-direct, so the browse surface is built around the
// route a seller actually runs, and the four axes the vendor declares on the
// listing itself (see listing.js):
//
//   flow        bulk | direct | niche | group   — who it is going to, and how
//   originKind  warehouse | source | producer | manufacturer | importer
//   originName / destinationName                 — the two endpoints a flow needs
//   unitLabel / minOrderQuantity                 — "per crate, min 5", not a unit price
//
// What this module returns is arithmetic over those rows plus the platform's
// open demand (public Requests with no accepted quote). It never invents a
// route: a listing that has not stated its origin and destination is counted as
// UNTAGGED and the read says so, because a board that quietly guesses "Wakulima
// → Kilimani" from a title is a fabricated supply chain.
//
// The gap panel is deliberately blunt about its own method: matching is on the
// STATED category and the STATED place text. It is not a semantic model, and a
// "no listing reaches this" line means "nothing says so in the fields", not
// "nobody can do it".
// ---------------------------------------------------------------------------

import { store } from '../store.js';
import { UNMET_STATUSES } from './gaps.js';

export const FLOWS = [
  {
    key: 'bulk',
    label: 'Bulk',
    sub: 'for vendors & shops',
    originKinds: ['warehouse', 'producer', 'importer'],
    subFilters: ['Produce', 'Dry goods', 'Beverages', 'Packaging', 'Textiles', 'Livestock']
  },
  {
    key: 'direct',
    label: 'Direct',
    sub: 'source-direct',
    originKinds: ['source', 'producer', 'manufacturer'],
    subFilters: ['Farm-gate', 'Factory', 'Importer', 'Artisan', 'Fishery']
  },
  {
    key: 'niche',
    label: 'Niche',
    sub: 'curated for consumers',
    originKinds: ['manufacturer', 'producer'],
    subFilters: ['Specialty', 'Craft', 'Vintage', 'Wellness', 'Books', 'Fashion']
  },
  {
    key: 'group',
    label: 'Group',
    sub: 'pooled demand',
    originKinds: ['warehouse', 'source', 'producer'],
    subFilters: ['Neighbourhood', 'Business collective', 'Event pool', 'Cooperative']
  }
];

/**
 * What each flow demands of a listing, in field names. This is the same rule
 * `listing.js` enforces on create and on update (`flowProblem`); it is restated
 * here as data so the BOARD can explain an empty flow in the seller's own terms
 * — "a bulk offer needs an origin and a destination; without both it is niche".
 * A test in flows.mjs fails if the two ever disagree, so this cannot quietly
 * drift into a friendlier lie about the rule.
 */
export const FLOW_REQUIRES = {
  bulk: ['originName', 'destinationName'],
  direct: ['originName'],
  group: ['destinationName'],
  niche: []
};

const norm = (v) => String(v ?? '').trim().toLowerCase();
const wordHits = (haystack, needle) => {
  const h = norm(haystack);
  const n = norm(needle);
  if (!h || !n) return false;
  return h.split(/[^a-z0-9]+/).filter((w) => w.length > 3).includes(n) || h.includes(n);
};

/** Active, non-archived listings — the only thing a buyer can actually take. */
function liveListings() {
  return store.filter('listings', (l) => l.status === 'active');
}

/** Public, unanswered demand. Same status set the gap engine uses. */
function openDemand() {
  return store.filter('requests', (r) => r.visibility === 'public' && UNMET_STATUSES.has(r.status) && !r.acceptedQuote);
}

/**
 * Routes for one flow: grouped by the endpoints the SELLER wrote. Each route
 * carries how many listings run it, who runs them, and how much open demand
 * names the same commodity and destination.
 */
export function routesFor(flowKey, { limit = 12 } = {}) {
  const rows = liveListings().filter((l) => (flowKey ? l.flow === flowKey : true) && l.originName && l.destinationName);
  const demand = openDemand();
  const byRoute = new Map();

  for (const l of rows) {
    const key = `${norm(l.originName)}→${norm(l.destinationName)}`;
    const route = byRoute.get(key) ?? {
      origin: String(l.originName).trim(),
      destination: String(l.destinationName).trim(),
      flow: l.flow ?? null,
      listings: 0,
      sellers: new Set(),
      commodities: new Map(),
      minOrderFrom: null,
      unit: null,
      listingIds: []
    };
    route.listings++;
    const vendor = store.find('vendors', (v) => v.id === l.vendorId);
    if (vendor?.displayName) route.sellers.add(vendor.displayName);
    // Only a DECLARED commodity counts. A listing that says "Tomatoes, 20
    // crates" in its title but declares nothing contributes a listing to the
    // route and no commodity, so the demand line stays honest about what the
    // seller actually stated.
    const declared = norm(l.commodity);
    if (declared) {
      route.commodities.set(declared, (route.commodities.get(declared) ?? 0) + 1);
      route.commodityCount++;
    }
    if (l.minOrderQuantity != null) {
      route.minOrderFrom = route.minOrderFrom === null ? l.minOrderQuantity : Math.min(route.minOrderFrom, l.minOrderQuantity);
    }
    if (!route.unit && l.unitLabel) route.unit = l.unitLabel;
    route.listingIds.push(l.id);
    byRoute.set(key, route);
  }

  const out = [...byRoute.values()].map((r0) => {
    // Resolve the commodity map ONCE, here, into the two shapes the rest of the
    // function needs: the ordered labels a buyer sees, and the list a demand
    // match is tested against.
    const ranked = [...r0.commodities.entries()].sort((a, b) => b[1] - a[1]);
    const r = {
      ...r0,
      topCommodities: ranked.slice(0, 3).map(([name]) => name),
      commodities: ranked.map(([name]) => name),
      declared: r0.commodities.size
    };
    // Demand that names this destination and one of this route's commodities.
    const matching = demand.filter((d) => {
      const where = `${d.location ?? ''} ${d.title ?? ''} ${d.category ?? ''}`;
      const hitsDestination = wordHits(where, r.destination);
      const hitsCommodity = r.commodities.some((c) => wordHits(`${d.title} ${d.category} ${d.subcategory}`, c) || wordHits(c, d.category));
      return hitsDestination && hitsCommodity;
    });
    const quantity = matching.reduce((n, d) => n + (Number(d.quantity) || 0), 0);
    return {
      origin: r.origin,
      destination: r.destination,
      flow: r.flow,
      listings: r.listings,
      sellers: [...r.sellers],
      topCommodities: r.topCommodities,
      commodities: r.commodities,
      // A route with listings but no declared commodity cannot claim demand.
      commodityUndeclared: r.commodities.length === 0 ? r.listings : null,
      minOrderFrom: r.minOrderFrom,
      unit: r.unit,
      listingIds: r.listingIds.slice(0, 12),
      // Counted, and labelled as counted — never "8 buyers waiting" as a promise.
      openDemand: matching.length,
      openDemandQuantity: quantity > 0 ? quantity : null,
      openDemandRequestIds: matching.slice(0, 6).map((d) => d.id)
    };
  });

  return out
    .sort((a, b) => b.openDemand - a.openDemand || b.listings - a.listings)
    .slice(0, limit);
}

/**
 * Where demand has no route yet: an open request whose stated commodity and
 * place are not covered by any active listing that declares a destination.
 * A listing with no declared endpoints does NOT count as coverage — that is the
 * whole point of asking sellers for the two endpoints.
 */
export function unmappedDemand({ limit = 12 } = {}) {
  const demand = openDemand();
  const routes = routesFor(null, { limit: 500 });
  const allDestinations = routes.map((r) => norm(r.destination));

  const rows = [];
  for (const d of demand) {
    const where = norm(d.location);
    const what = `${d.title} ${d.category} ${d.subcategory}`;
    const served = routes.filter((r) => norm(r.destination) === where && r.topCommodities.some((c) => wordHits(what, c) || wordHits(c, d.category)));
    const anyListingMentions = liveListings().some((l) => wordHits(`${l.title} ${l.description}`, d.category) && wordHits(where, l.locationName ?? ''));
    if (served.length > 0) continue;
    rows.push({
      requestId: d.id,
      title: d.title,
      category: d.category || null,
      quantity: d.quantity ?? null,
      unit: d.unit ?? null,
      location: d.location ?? null,
      requiredBy: d.requiredBy ?? null,
      requesterType: d.requesterType ?? null,
      // Three honest states, never a fake "no supplier exists" verdict.
      coverage: served.length > 0 ? 'routed' : anyListingMentions ? 'listing_without_route' : 'no_route_declared',
      destinationsInUse: allDestinations.filter(Boolean).slice(0, 6)
    });
    if (rows.length >= limit) break;
  }
  return rows;
}

/** The tile counts, including the honest "not yet declared" bucket. */
export function flowSummary() {
  const listings = liveListings();
  const byFlow = new Map(FLOWS.map((f) => [f.key, 0]));
  let untagged = 0;
  for (const l of listings) {
    if (l.flow && byFlow.has(l.flow)) byFlow.set(l.flow, byFlow.get(l.flow) + 1);
    else untagged++;
  }
  const demand = openDemand();
  const otherFlows = FLOWS.reduce((n, f) => n + (f.key ? byFlow.get(f.key) : 0), 0);
  return {
    // The board's own reach, stated rather than implied: nothing here is
    // filtered by the viewer's area, because there is no area filter. Saying so
    // is what stops "0 in Bulk" from being read as "0 near me".
    scope: 'national',
    areaFiltered: false,
    flows: FLOWS.map((f) => {
      const listings = byFlow.get(f.key);
      const zeroReason = listings > 0
        ? null
        : untagged > 0
          ? 'untagged_only'
          : listings === 0 && otherFlows > 0
            ? 'other_flows_only'
            : 'nothing_on_the_board';
      return {
      key: f.key,
      label: f.label,
      sub: f.sub,
      subFilters: f.subFilters,
      requires: FLOW_REQUIRES[f.key] ?? [],
      zeroReason,
      listings: listings,
      // How many open requests name this flow's usual commodity words — a hint
      // at where to look, counted from stated fields, not a match engine.
      openDemand: demand.filter((d) => wordHits(`${d.category} ${d.title}`, f.key === 'bulk' ? 'wholesale' : f.key)).length
      };
    }),
    untagged,
    totals: {
      activeListings: listings.length,
      declaredRoutes: routesFor(null, { limit: 500 }).length,
      openPublicDemand: demand.length
    },
    note:
      'Counts are of active listings whose seller declared that flow, and of public Requests still without an accepted quote. ' +
      `${untagged} active listing${untagged === 1 ? '' : 's'} declare no flow, so they appear under All and in no route — this board will not infer a supply chain from a title.`
  };
}
