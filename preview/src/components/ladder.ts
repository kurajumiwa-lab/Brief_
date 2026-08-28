// ---------------------------------------------------------------------------
// THE SERVICE LADDER (client side)
//
// The server derives the ladder; this module is the pure, testable logic the
// UI needs around it — which surface belongs to which service, whether that
// service is open yet, and WHERE the ladder is allowed to show itself.
//
// TWO RULES THAT MATTER.
//
// 1. UNKNOWN MEANS OPEN. If the ladder has not loaded (offline, dead API, a
//    render test with no server) nothing is locked. A gate that fails closed
//    would turn a backend outage into a product that refuses to work, which is
//    a far worse failure than showing a service early.
//
// 2. THE LADDER IS NOT SHOWN EVERYWHERE. Saved (Your Layer) and Actions
//    (Workflows) are the two index screens people go to on purpose, already
//    knowing what they want. Locks, step counters and "unlocks after" chrome
//    are suppressed there by design: those screens list what exists, they do
//    not sell it. The ladder lives where discovery happens — the shelf, the
//    home surface and the first-run flow.
// ---------------------------------------------------------------------------

import type { Ladder, LadderRungId, LadderService } from '../api/briefApi';

export type { Ladder, LadderRungId, LadderService };

export const RUNG_ORDER: LadderRungId[] = ['identity', 'orient', 'value', 'contribute', 'reach'];

/**
 * Surfaces that never render ladder chrome.
 *
 * `mylayer` is the Saved screen; `workflows` is the Actions desk. Both are
 * destinations, not shop windows.
 */
export const LADDER_QUIET_TABS = ['mylayer', 'workflows'] as const;

export function showsLadder(tab: string | null | undefined): boolean {
  if (!tab) return false;
  return !(LADDER_QUIET_TABS as readonly string[]).includes(tab);
}

/** Find the service that owns a surface, if any. */
export function serviceForSurface(
  ladder: Ladder | null,
  tab: string,
  section?: string | null
): LadderService | null {
  if (!ladder) return null;
  const exact = ladder.services.find(
    (s) => s.surface.tab === tab && (s.surface.section ?? null) === (section ?? null)
  );
  if (exact) return exact;
  return ladder.services.find((s) => s.surface.tab === tab && !s.surface.section) ?? null;
}

/**
 * Is this surface open to the person yet?
 *
 * A pure question about the SERVICE, deliberately not about the screen the
 * question came from. Rule 2 is enforced by WHO CALLS THIS: the shelf, the
 * drawer and the home surface do; the Saved and Actions index screens do not
 * ask at all, so their rows open normally and carry no lock chrome. Baking the
 * exemption in here instead would silently unlock a service just because it
 * happened to live under those tabs.
 */
export function isSurfaceUnlocked(
  ladder: Ladder | null,
  tab: string,
  section?: string | null
): boolean {
  if (!ladder) return true;
  const service = serviceForSurface(ladder, tab, section);
  return service ? service.unlocked : true;
}

/** The named step a locked surface is waiting on ("Keep your first real thing"). */
export function unlockHint(
  ladder: Ladder | null,
  tab: string,
  section?: string | null
): string | null {
  if (!ladder) return null;
  const service = serviceForSurface(ladder, tab, section);
  if (!service || service.unlocked) return null;
  return service.unlocksAfter;
}

/** How far up the ladder, as a 1-based position and a total. */
export function ladderProgress(ladder: Ladder | null): { done: number; total: number } {
  if (!ladder) return { done: 0, total: RUNG_ORDER.length };
  return { done: ladder.reached.length, total: ladder.rungs.length };
}

export function rungById(ladder: Ladder | null, id: LadderRungId) {
  return ladder?.rungs.find((r) => r.id === id) ?? null;
}

/** Has this person hit the aha moment (kept their first real thing)? */
export function isActivated(ladder: Ladder | null): boolean {
  return Boolean(ladder?.activated);
}

/**
 * Should the first-run flow open?
 *
 * Only when there is a real reason: no session at all, or a session that has
 * never answered the one segmentation question and has not skipped it. A
 * returning, oriented user never sees it again.
 */
export function shouldOpenFirstRun(input: {
  signedIn: boolean;
  goal: string | null | undefined;
  finishedAt: string | null | undefined;
  skippedAt: string | null | undefined;
}): boolean {
  if (!input.signedIn) return true;
  if (input.finishedAt || input.skippedAt) return false;
  return !input.goal;
}
