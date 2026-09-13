// ---------------------------------------------------------------------------
// SPACE SIGNALS — the honest "what needs your attention" derivation.
//
// Home used to show a hardcoded "Today" queue (fabricated people, fabricated
// timestamps). This replaces it with a derived signal: a space needs a
// check-in when REAL rows say so —
//   * conversations not yet converted/closed  →  "needs a reply"
//   * offers still in draft                   →  "not published"
//   * active orders                           →  "to fulfil"
//
// All three come from rows already on the Space (recentConversations, offers,
// metrics). Nothing here is stored, guessed, or seeded — it is recomputed from
// the hydrated space on every render.
// ---------------------------------------------------------------------------

import type { Space } from '../../api/types';

export interface AttentionItem {
  kind: 'conversation' | 'offer' | 'order';
  label: string;
  count: number;
}

const OPEN_CONVERSATION = new Set(['new', 'active', 'replied']);

function plural(n: number, word: string) {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

/** What genuinely needs doing in this space, derived from its real rows. */
export function needsAttention(space: Space): AttentionItem[] {
  const items: AttentionItem[] = [];

  const open = (space.recentConversations ?? []).filter((c) => OPEN_CONVERSATION.has(c.status));
  if (open.length > 0) {
    items.push({ kind: 'conversation', label: `${plural(open.length, 'conversation')} need a reply`, count: open.length });
  }

  const draftOffers = (space.offers ?? []).filter((o) => o.status === 'draft');
  if (draftOffers.length > 0) {
    items.push({ kind: 'offer', label: `${plural(draftOffers.length, 'offer')} not published yet`, count: draftOffers.length });
  }

  const activeOrders = space.metrics?.activeOrdersCount ?? 0;
  if (activeOrders > 0) {
    items.push({ kind: 'order', label: `${plural(activeOrders, 'active order')} to fulfil`, count: activeOrders });
  }

  return items;
}

/** Active spaces that need a check-in, most-needing first. */
export function attentionQueue(spaces: Space[]): Array<{ space: Space; items: AttentionItem[] }> {
  return spaces
    .filter((s) => s.status !== 'archived')
    .map((s) => ({ space: s, items: needsAttention(s) }))
    .filter((e) => e.items.length > 0)
    .sort((a, b) => b.items.length - a.items.length);
}

/** Split the feed: active spaces vs archived (collapsible). */
export function splitSpaces(spaces: Space[]): { active: Space[]; archived: Space[] } {
  return {
    active: spaces.filter((s) => s.status !== 'archived'),
    archived: spaces.filter((s) => s.status === 'archived')
  };
}
