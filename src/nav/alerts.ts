// ---------------------------------------------------------------------------
// DESTINATION ALERTS — the red "something happened" dots on the sidebar
// titles (desktop rail + mobile dock).
//
// HONESTY RULES, same as everywhere else:
//   * a dot appears ONLY when real server data says something changed:
//       - unread notifications (signed in) — each kind routed to the
//         destination it belongs to;
//       - public freshness: feed items / EPL rooms created AFTER the last
//         time the viewer opened that destination.
//   * first visit baselines silently (no fake "everything is new").
//   * nothing is invented to make the UI look alive; unreachable services
//     mean zero dots, not placeholder dots.
// ---------------------------------------------------------------------------

import type { Destination } from '../App';

export interface AlertNotificationLike {
  kind: string;
  read: boolean;
  createdAt?: string;
}

export interface AlertRoomLike {
  createdAt?: string | null;
}

export interface AlertFeedItemLike {
  createdAt?: string | null;
  publishedAt?: string | null;
  updatedAt?: string | null;
}

/** Notification kinds routed to the destination they actually belong to. */
const KIND_TO_DESTINATION: Record<string, Destination> = {
  challenge: 'arena',
  workflow: 'workflows',
  confirmed: 'mylayer',
  saved_changed: 'mylayer',
  event_soon: 'mylayer',
  system: 'mylayer'
};

const SEEN_KEY = 'brief.seen.v1';

function seenMap(): Record<string, number> {
  try {
    const raw = typeof localStorage === 'undefined' ? null : localStorage.getItem(SEEN_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return typeof parsed === 'object' && parsed ? parsed : {};
  } catch {
    return {};
  }
}

/**
 * The last time the viewer opened a destination. A MISSING value means
 * first visit: baseline to now so years-old content never lights the dot.
 */
export function readLastSeen(dest: Destination, now = Date.now()): number {
  const m = seenMap();
  const v = m[dest];
  if (typeof v === 'number' && Number.isFinite(v) && v > 0) return v;
  writeLastSeen(dest, now);
  return now;
}

export function writeLastSeen(dest: Destination, ts = Date.now()): void {
  try {
    if (typeof localStorage === 'undefined') return;
    const m = seenMap();
    m[dest] = ts;
    localStorage.setItem(SEEN_KEY, JSON.stringify(m));
  } catch {
    /* private mode / test env: the dots simply re-derive each load */
  }
}

function tsOf(item: AlertFeedItemLike): number {
  const raw = item.publishedAt ?? item.createdAt ?? item.updatedAt ?? null;
  if (!raw) return 0;
  const t = Date.parse(raw);
  return Number.isFinite(t) ? t : 0;
}

export type DestinationAlerts = Record<Destination, number>;

/**
 * Derive the per-destination alert counts from real data. Any input may be
 * null (signed out, service unreachable) — that contributes ZERO, never a
 * guess. Counts are capped for display sanity.
 */
export function deriveDestinationAlerts(input: {
  notifications?: AlertNotificationLike[] | null;
  rooms?: AlertRoomLike[] | null;
  feedItems?: AlertFeedItemLike[] | null;
  lastSeen?: Partial<Record<Destination, number>>;
  now?: number;
}): DestinationAlerts {
  const now = input.now ?? Date.now();
  const seen = input.lastSeen ?? {};
  const out: DestinationAlerts = { nearby: 0, arena: 0, mylayer: 0, workflows: 0 };

  for (const n of input.notifications ?? []) {
    if (n.read) continue;
    const dest = KIND_TO_DESTINATION[n.kind];
    if (dest) out[dest] += 1;
  }

  const seenArena = seen.arena ?? now; // missing baseline = nothing new
  for (const r of input.rooms ?? []) {
    const t = r.createdAt ? Date.parse(r.createdAt) : 0;
    if (Number.isFinite(t) && t > 0 && t > seenArena) out.arena += 1;
  }

  const seenNearby = seen.nearby ?? now;
  for (const it of input.feedItems ?? []) {
    const t = tsOf(it);
    if (t > 0 && t > seenNearby) out.nearby += 1;
  }

  const CAP = 20;
  (Object.keys(out) as Destination[]).forEach((k) => { out[k] = Math.min(out[k], CAP); });
  return out;
}

/** "3" -> "3", "12" -> "9+" — the dot label never widens the dock. */
export function alertLabel(n: number): string {
  return n > 9 ? '9+' : String(n);
}
