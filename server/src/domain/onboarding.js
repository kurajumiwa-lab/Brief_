// ---------------------------------------------------------------------------
// ONBOARDING & THE SERVICE LADDER
//
// TWO IDEAS, ONE MODULE.
//
// 1. THE LADDER. Brief offers a lot: capture, hosting, selling, distribution,
//    money, automation. Showing all of it to someone on their first minute is
//    what makes a capable product feel unusable. So the surfaces are ordered
//    into rungs — you reach a service by passing through the step below it.
//    Intent is the goal; the ladder is the path to it.
//
// 2. ACTIVATION. The first rung that matters is the "aha": the moment a new
//    person keeps something real from Brief. Everything before it is trimmed
//    to the minimum (identity + one segmentation tap), and everything after it
//    is disclosed only when the rung below has genuinely been climbed.
//
// HOW A RUNG IS DECIDED.
//
// From REAL ROWS wherever a row exists — a confirmation, a captured object, a
// campaign, a listing, an order, a registration. Where no server row can
// exist (choosing a goal, granting location, saving locally) the client
// records a named event, stored append-only in `activationEvents`. An event is
// a fact about what a person did, timestamped when it happened; nothing here
// invents progress the user did not make, and nothing stores a total that a
// scan could contradict.
//
// WHAT IS DELIBERATELY NOT HERE.
//
// No route enforcement. The ladder shapes what is OFFERED, not what is
// permitted: authority stays with `identity.js` and the domain modules, which
// already refuse anything the caller may not do. A ladder that also became an
// authorisation layer would be a second source of truth about permission.
// ---------------------------------------------------------------------------

import { store, newId } from '../store.js';

/** The rungs, in order. You pass through each one to reach the next. */
export const RUNGS = [
  {
    id: 'identity',
    label: 'Be someone',
    detail: 'An account so what you keep is yours on the next device.',
    cta: 'Continue with Google'
  },
  {
    id: 'orient',
    label: 'Say what you came for',
    detail: 'One tap. It orders the feed and nothing else.',
    cta: 'Pick what you are here for'
  },
  {
    id: 'value',
    label: 'Keep your first real thing',
    detail: 'Open something from the feed and save or confirm it. This is the point of Brief.',
    cta: 'Save something from the feed'
  },
  {
    id: 'contribute',
    label: 'Add something of your own',
    detail: 'Paste a message, a poster or a link. Brief turns it into a findable object.',
    cta: 'Capture something'
  },
  {
    id: 'reach',
    label: 'Put it in front of people',
    detail: 'Host it, sell it or send it out. The tools open once there is something to carry.',
    cta: 'Host, list or distribute'
  }
];

export const RUNG_IDS = RUNGS.map((r) => r.id);

/**
 * Secondary services and the rung each one follows.
 *
 * `surface` is how the client finds it (tab + section) so the ladder and the
 * router cannot drift apart.
 */
export const SERVICES = [
  { id: 'stream',       label: 'Around you',            requires: 'identity',   surface: { tab: 'nearby', section: 'stream' } },
  { id: 'saved',        label: 'Your layer',            requires: 'identity',   surface: { tab: 'mylayer', section: 'saved' } },
  // Ligi sits one rung BELOW the rest of Arena, and that is the whole point of
  // its priority listing: a free seat with a weekly rhythm is the cheapest
  // reason to come back, so it opens as soon as someone has oriented rather
  // than waiting behind a kept object. The staking half of the game is not a
  // second ladder rung — it is gated inside the game by the same compliance
  // answer every paid surface gives, which is a stricter gate than any rung.
  { id: 'ligi',         label: 'Ligi (African fantasy football)', requires: 'orient', surface: { tab: 'arena', section: 'ligi' } },
  { id: 'capture',      label: 'Capture',               requires: 'value',      surface: { tab: 'capture' } },
  { id: 'play',         label: 'Arena',                 requires: 'value',      surface: { tab: 'arena' } },
  { id: 'campaigns',    label: 'Host an event',         requires: 'contribute', surface: { tab: 'workflows', section: 'campaigns' } },
  { id: 'market',       label: 'Sell something',        requires: 'contribute', surface: { tab: 'nearby', section: 'market' } },
  { id: 'tea',          label: 'Story studio',          requires: 'contribute', surface: { tab: 'workflows', section: 'tea' } },
  { id: 'distribution', label: 'Share kit and banners', requires: 'reach',      surface: { tab: 'workflows', section: 'distribution' } },
  { id: 'money',        label: 'Money and ledger',      requires: 'reach',      surface: { tab: 'workflows', section: 'money' } },
  { id: 'engine',       label: 'Automation engine',     requires: 'reach',      surface: { tab: 'workflows', section: 'engine' } },
  { id: 'groupbuy',     label: 'Group buying',          requires: 'reach',      surface: { tab: 'workflows', section: 'groupbuy' } },
  { id: 'vault',        label: 'The Vault',             requires: 'reach',      surface: { tab: 'workflows', section: 'vault' } }
];

/** Segmentation answers. Short on purpose: one question, four honest options. */
export const GOALS = [
  { id: 'discover', label: 'Find what is happening near me', leadsTo: { tab: 'nearby', section: 'stream' } },
  { id: 'host',     label: 'Organise an event or gathering',  leadsTo: { tab: 'nearby', section: 'stream' } },
  { id: 'sell',     label: 'Sell a product or service',       leadsTo: { tab: 'nearby', section: 'market' } },
  { id: 'play',     label: 'Play and compete',                leadsTo: { tab: 'arena' } }
];

/**
 * Personalisation, kept to one honest move.
 *
 * The segmentation answer promotes the service that answer is ABOUT by one
 * rung — someone who said they came to play should not find Arena behind a
 * step about saving things. It never promotes below `orient` (you have to have
 * answered for it to apply) and it never promotes anything else, so the ladder
 * stays a ladder instead of quietly collapsing for anyone who picks the right
 * option.
 */
export const GOAL_SERVICE = {
  discover: 'stream',
  host: 'campaigns',
  sell: 'market',
  play: 'play'
};

function promotedRequirement(requires) {
  const index = RUNG_IDS.indexOf(requires);
  if (index <= 1) return requires;
  return RUNG_IDS[Math.max(1, index - 1)];
}

export const EVENTS = [
  'onboarding_started',
  'signed_in',
  'goal_chosen',
  'place_chosen',
  'feed_seen',
  'object_opened',
  'object_saved',
  'object_confirmed',
  'capture_saved',
  'onboarding_skipped',
  'onboarding_finished',
  'service_locked_tapped'
];

const nowIso = () => new Date().toISOString();

// ---------------------------------------------------------------------------
// PROFILE — the answers a person gave, and nothing else
// ---------------------------------------------------------------------------

export function getProfile(userId) {
  if (!userId) return null;
  return store.find('onboardingProfiles', (p) => p.userId === userId);
}

export function ensureProfile(userId) {
  if (!userId) throw new Error('a user is required');
  const existing = getProfile(userId);
  if (existing) return existing;
  return store.insert('onboardingProfiles', {
    id: newId('onb'),
    userId,
    goal: null,
    place: null,
    // Referral attribution: which link brought this person in (tiktok, x,
    // whatsapp...). Recorded only when a link actually carried it.
    source: null,
    startedAt: nowIso(),
    finishedAt: null,
    skippedAt: null,
    createdAt: nowIso(),
    updatedAt: nowIso()
  });
}

export function setGoal(userId, goal) {
  const known = GOALS.some((g) => g.id === goal);
  if (!known) throw new Error('unknown goal');
  const profile = ensureProfile(userId);
  recordEvent(userId, 'goal_chosen', { goal });
  return store.update('onboardingProfiles', profile.id, { goal });
}

export function setPlace(userId, place) {
  const label = String(place ?? '').trim();
  if (!label) throw new Error('a place is required');
  const profile = ensureProfile(userId);
  recordEvent(userId, 'place_chosen', { place: label });
  return store.update('onboardingProfiles', profile.id, { place: label });
}

export function setSource(userId, source) {
  const label = String(source ?? '').trim().toLowerCase().slice(0, 40);
  if (!label) return getProfile(userId);
  const profile = ensureProfile(userId);
  // First touch wins: the link that actually brought someone in is not
  // rewritten by a later visit.
  if (profile.source) return profile;
  return store.update('onboardingProfiles', profile.id, { source: label });
}

export function finish(userId, { skipped = false } = {}) {
  const profile = ensureProfile(userId);
  recordEvent(userId, skipped ? 'onboarding_skipped' : 'onboarding_finished', {});
  return store.update('onboardingProfiles', profile.id, {
    finishedAt: nowIso(),
    skippedAt: skipped ? nowIso() : profile.skippedAt
  });
}

// ---------------------------------------------------------------------------
// EVENTS — append-only, named, timestamped
// ---------------------------------------------------------------------------

export function recordEvent(userId, name, meta = {}) {
  if (!userId) throw new Error('a user is required');
  if (!EVENTS.includes(name)) throw new Error(`unknown event: ${name}`);
  return store.insert('activationEvents', {
    id: newId('act'),
    userId,
    name,
    meta: meta && typeof meta === 'object' ? meta : {},
    at: nowIso()
  });
}

export function eventsFor(userId) {
  return store.filter('activationEvents', (e) => e.userId === userId);
}

function firstEventAt(events, name) {
  const hit = events.filter((e) => e.name === name).sort((a, b) => a.at.localeCompare(b.at))[0];
  return hit ? hit.at : null;
}

// ---------------------------------------------------------------------------
// LADDER — derived, never stored
// ---------------------------------------------------------------------------

/**
 * Evidence for every rung, scanned live.
 *
 * Each entry answers "what actually happened", so the UI can show the reason a
 * rung is complete rather than a bare tick.
 */
export function evidenceFor(userId) {
  const events = eventsFor(userId);
  const profile = getProfile(userId);

  const user = store.find('users', (u) => u.id === userId);
  const confirmation = store
    .filter('confirmations', (c) => c.actorId === userId)
    .sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)))[0] ?? null;
  const captureMembership = store.find(
    'sourceMemberships',
    (m) => m.userId === userId && m.accessMethod === 'captured'
  );
  const campaign = store.find('campaigns', (c) => c.ownerId === userId);
  const vendor = store.find('vendors', (v) => v.ownerId === userId);
  const listing = vendor ? store.find('listings', (l) => l.vendorId === vendor.id) : null;
  const banner = store.find('campaignBanners', (b) => b.ownerId === userId);
  const savedEventAt = firstEventAt(events, 'object_saved');

  return {
    identity: (() => {
      if (user) {
        const how = user.authProvider === 'google'
          ? 'Signed in with Google'
          : user.authProvider === 'email_link'
          ? 'Recognised from a link'
          : 'Account created';
        return { done: true, at: user.createdAt, how };
      }
      // A caller with a live session but no user row is the development
      // fallback identity. It is a session, so the rung is genuinely climbed
      // — it just says plainly that no account is attached to it yet.
      if (profile) return { done: true, at: profile.startedAt, how: 'Device session, no account yet' };
      return { done: false, at: null, how: null };
    })(),
    orient: profile?.goal
      ? { done: true, at: firstEventAt(events, 'goal_chosen') ?? profile.updatedAt ?? profile.createdAt, how: `Here to ${profile.goal}` }
      : { done: false, at: null, how: null },
    value: (() => {
      if (savedEventAt) return { done: true, at: savedEventAt, how: 'Saved something from the feed' };
      if (confirmation) return { done: true, at: confirmation.createdAt, how: 'Confirmed an object as real' };
      return { done: false, at: null, how: null };
    })(),
    contribute: (() => {
      const captureAt = firstEventAt(events, 'capture_saved');
      if (captureAt) return { done: true, at: captureAt, how: 'Captured something into Brief' };
      if (captureMembership) return { done: true, at: captureMembership.connectedAt, how: 'Captured something into Brief' };
      return { done: false, at: null, how: null };
    })(),
    reach: (() => {
      if (campaign) return { done: true, at: campaign.createdAt, how: 'Created a campaign' };
      if (listing) return { done: true, at: listing.createdAt, how: 'Listed something for sale' };
      if (banner) return { done: true, at: banner.createdAt, how: 'Made a share banner' };
      return { done: false, at: null, how: null };
    })()
  };
}

/**
 * The ladder for one user.
 *
 * A rung is only "reached" when every rung below it is. That is the whole
 * point of a ladder: someone who somehow created a listing before saving
 * anything still has the save step in front of them, because the step is the
 * path, not a badge.
 */
export function ladderFor(userId) {
  const evidence = evidenceFor(userId);
  let broken = false;
  const rungs = RUNGS.map((rung, index) => {
    const own = evidence[rung.id] ?? { done: false, at: null, how: null };
    const reached = !broken && own.done;
    if (!reached) broken = true;
    return {
      ...rung,
      index,
      done: own.done,
      reached,
      at: own.at,
      how: own.how
    };
  });

  const current = rungs.find((r) => !r.reached) ?? null;
  const activated = Boolean(rungs.find((r) => r.id === 'value')?.reached);
  const activatedAt = rungs.find((r) => r.id === 'value')?.at ?? null;
  const reachedIds = rungs.filter((r) => r.reached).map((r) => r.id);

  const profile = getProfile(userId);
  const promotedServiceId = profile?.goal ? GOAL_SERVICE[profile.goal] ?? null : null;

  const services = SERVICES.map((service) => {
    const requires = service.id === promotedServiceId
      ? promotedRequirement(service.requires)
      : service.requires;
    const unlocked = reachedIds.includes(requires);
    return {
      ...service,
      requires,
      // Stated, not hidden: the UI can say why this one opened early.
      promoted: requires !== service.requires,
      unlocked,
      unlocksAfter: unlocked ? null : RUNGS.find((r) => r.id === requires)?.label ?? requires
    };
  });

  return {
    rungs,
    reached: reachedIds,
    currentRungId: current ? current.id : null,
    nextStep: current
      ? { id: current.id, label: current.label, detail: current.detail, cta: current.cta }
      : null,
    complete: !current,
    activated,
    activatedAt,
    services
  };
}

/** Everything the first-run client needs, in one round trip. */
export function stateFor(userId) {
  const profile = getProfile(userId);
  return {
    profile: profile
      ? {
          goal: profile.goal,
          place: profile.place,
          source: profile.source,
          startedAt: profile.startedAt,
          finishedAt: profile.finishedAt,
          skippedAt: profile.skippedAt
        }
      : null,
    goals: GOALS,
    ladder: ladderFor(userId)
  };
}

// ---------------------------------------------------------------------------
// METRICS — activation and drop-off, derived by scanning
// ---------------------------------------------------------------------------

/**
 * Where people stop. Every figure is a scan of real rows, so it cannot drift
 * from what happened; there is no stored counter to disagree with.
 */
export function metrics() {
  const profiles = store.all('onboardingProfiles');
  const perRung = Object.fromEntries(RUNG_IDS.map((id) => [id, 0]));
  const timesToActivate = [];

  for (const profile of profiles) {
    const ladder = ladderFor(profile.userId);
    for (const id of ladder.reached) perRung[id] += 1;
    if (ladder.activated && ladder.activatedAt && profile.startedAt) {
      const ms = Date.parse(ladder.activatedAt) - Date.parse(profile.startedAt);
      if (Number.isFinite(ms) && ms >= 0) timesToActivate.push(ms);
    }
  }

  const started = profiles.length;
  const activated = perRung.value;
  timesToActivate.sort((a, b) => a - b);
  const median = timesToActivate.length
    ? timesToActivate[Math.floor(timesToActivate.length / 2)]
    : null;

  // Drop-off between consecutive rungs: how many reached N but not N+1.
  const dropOff = RUNG_IDS.slice(0, -1).map((id, i) => ({
    from: id,
    to: RUNG_IDS[i + 1],
    lost: Math.max(0, perRung[id] - perRung[RUNG_IDS[i + 1]])
  }));

  return {
    started,
    activated,
    activationRate: started ? activated / started : null,
    medianSecondsToActivate: median === null ? null : Math.round(median / 1000),
    perRung,
    dropOff,
    // Stated plainly: with no cohort yet, there is nothing to report.
    note: started ? null : 'No one has started onboarding on this deployment yet.'
  };
}
