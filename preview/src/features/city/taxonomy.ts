// ---------------------------------------------------------------------------
// DISCOVER TAXONOMY — the client's view of the flow board.
//
// There are two axes, not a category tree:
//
//   destination  who takes it   → niche (a household), bulk (shops & resellers),
//                                 group (a pool), direct (bypassing the middle)
//   origin       where from     → warehouse/market, source, producer,
//                                 manufacturer, importer
//
// The flow LABELS and their sub-filter vocabulary live on the server
// (domain/flows.js) and arrive on GET /api/discover/summary, because a client-side
// copy is a second taxonomy that can drift out of the first. What lives here is
// only presentation: which icon, which order, which room key a tile opens.
//
// Nothing in this file can produce a number. A tile's count is the server's
// count of ACTIVE listings whose seller declared that flow; if nobody declared
// it, the tile reads 0 and the board says how many listings are untagged rather
// than quietly sorting them by keyword.
// ---------------------------------------------------------------------------

export type DiscoverRoom = 'bulk' | 'direct' | 'niche' | 'group' | 'events' | 'circles' | 'errands' | 'shops' | 'all';

/** The four flows, in the order the grid draws them (2 x 2, thumb-first). */
export const FLOW_ORDER: Array<{ key: 'bulk' | 'direct' | 'niche' | 'group'; icon: 'box' | 'leaf' | 'sparkle' | 'users' }> = [
  { key: 'bulk', icon: 'box' },
  { key: 'direct', icon: 'leaf' },
  { key: 'niche', icon: 'sparkle' },
  { key: 'group', icon: 'users' }
];

/** The second row: the mixed view plus the rooms that are not supply flows. */
export const SIDE_ORDER: Array<{ key: DiscoverRoom; label: string; unit: string; icon: 'feed' | 'calendar' | 'users' | 'bike' }> = [
  { key: 'all', label: 'All', unit: 'everything on the board', icon: 'feed' },
  { key: 'shops', label: 'Shops', unit: 'public storefronts', icon: 'feed' },
  { key: 'events', label: 'Events', unit: 'published', icon: 'calendar' },
  { key: 'circles', label: 'Groups', unit: 'you could join', icon: 'users' },
  { key: 'errands', label: 'Errands', unit: 'open runs', icon: 'bike' }
];

export const isFlowRoom = (room: DiscoverRoom): room is 'bulk' | 'direct' | 'niche' | 'group' =>
  room === 'bulk' || room === 'direct' || room === 'niche' || room === 'group';

/**
 * A route is only worth drawing when BOTH endpoints are on the row. That is the
 * seller's declaration, not our inference — so a listing without them is counted
 * as untagged on the tile, and never folded into a route it did not state.
 */
export function routeLabel(route: { origin: string; destination: string; unit?: string | null; minOrderFrom?: number | null }) {
  const moq = route.minOrderFrom ? ` · min ${route.minOrderFrom}${route.unit ? ` ${route.unit}` : ''}` : '';
  return `${route.origin} → ${route.destination}${moq}`;
}
