// ---------------------------------------------------------------------------
// FEED COMPOSITION — the home feed as one magazine, not a card dump.
//
// One place turns ranked objects + published Tea into a composed feed with a
// deliberate rhythm (hero → tea → discovery → opportunities → more). Two rules
// the master build demands, enforced here centrally rather than scattered in
// components:
//
//   DEDUPLICATION — the same object can appear in Around, a collection and a
//     Tea article; the composed feed shows it once. Keyed by object id (and
//     tea slug for articles).
//   RANKING — objects are already ranked by discovery.discoverable(); Tea by
//     tea.listPublished(). This module composes and dedupes; it does not invent
//     a second score.
//
// It reads only what already exists — nothing here fabricates a count, a
// headline or a section. An empty section is omitted, not padded.
// ---------------------------------------------------------------------------

/** A composed feed: typed slots, each deduped against everything before it. */
export function composeFeed({ objects = [], tea = [], heroLimit = 1, discoveryLimit = 4, opportunityLimit = 3 } = {}) {
  const seen = new Set();
  const hero = [];
  const discovery = [];
  const opportunities = [];
  const rest = [];

  const take = (obj) => {
    if (!obj?.id) return false;
    if (seen.has(obj.id)) return false;
    seen.add(obj.id);
    return true;
  };

  // Hero: the top object(s) that can carry a strong visual.
  for (const o of objects) {
    if (hero.length < heroLimit) { if (take(o)) hero.push(o); continue; }
    break;
  }

  // Discovery + opportunities from what remains, in ranked order.
  for (const o of objects) {
    if (seen.has(o.id)) continue;
    if (o.type === 'opportunity' && opportunities.length < opportunityLimit) {
      if (take(o)) opportunities.push(o);
      continue;
    }
    if (discovery.length < discoveryLimit) {
      if (take(o)) discovery.push(o);
      continue;
    }
    if (take(o)) rest.push(o);
  }

  // Tea: the top published article (deduped by slug against itself only —
  // an article is not an object, so they do not collide).
  const teaSeen = new Set();
  const featuredTea = tea.find((a) => {
    if (teaSeen.has(a.slug)) return false;
    teaSeen.add(a.slug);
    return true;
  }) ?? null;
  const moreTea = tea.filter((a) => a.slug !== featuredTea?.slug).slice(0, 3);

  return {
    hero,
    discovery,
    opportunities,
    more: rest,
    tea: featuredTea,
    moreTea,
    // Honest totals, for a real "N things nearby" readout if the client wants it.
    counts: {
      objects: objects.length,
      tea: tea.length,
      deduped: objects.length - (hero.length + discovery.length + opportunities.length + rest.length)
    }
  };
}
