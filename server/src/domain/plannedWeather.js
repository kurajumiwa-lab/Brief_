// ---------------------------------------------------------------------------
// PLANNED WEATHER — a forecast is only worth a screen when it lands on a day
// the member has already committed to.
//
// The brief's instruction was explicit: "everyone has a weather app unless it
// gives prediction of weather pattern on day and event is planned." So this is
// not a weather feed with a nice layout — it is a JOIN, and it returns nothing
// when the join is empty. Three rules:
//
//   * the days come from real registration rows for a published or live
//     campaign, exactly the rows the ticket bar already trusts;
//   * the sentences come from `worldSignal`, which composes them from the
//     provider's own numbers. Only a fact that carries a `date` can match a
//     planned day — a count ("3 wet days") or a run ("dry spell holds") says
//     nothing about YOUR Saturday, so it is never used to fill the line;
//   * when nothing overlaps, the answer is an empty list and a reason. Not a
//     generic forecast, not "no rain expected", not a zero. A blank that is
//     explained is honest; a blank that is filled is a lie.
//
// What this file deliberately does NOT do: no advice ("bring a tarpaulin"), no
// probability dressed as certainty, no claim about how many people are affected,
// and no urgency. A forecast is a model output with a provider and a licence,
// and the view keeps both attached so a reader can go and check.
// ---------------------------------------------------------------------------
import { store } from '../store.js';
import { dayBucket, todayKey } from '../dayBoundary.js';
import { worldSignal } from './worldSignal.js';

const OPEN_STATUSES = ['registered', 'checked_in'];
const LIVE_CAMPAIGNS = ['published', 'live'];

/**
 * The member's planned days, oldest first. `startsAt` is bucketed into the
 * Nairobi calendar day (the `dayBoundary` rule), because a Saturday market is
 * a Saturday in Kenya, not a UTC boundary.
 */
export function plannedDays(userId, { nowMs = Date.now(), horizonDays = 14 } = {}) {
  if (!userId) return [];
  const today = todayKey(nowMs);
  const byDate = new Map();
  const regs = store.filter(
    'registrations',
    (r) => (r.userId === userId || r.attendeeRef === userId) && OPEN_STATUSES.includes(r.status)
  );
  for (const reg of regs) {
    const campaign = store.find('campaigns', (c) => c.id === reg.campaignId);
    if (!campaign || !LIVE_CAMPAIGNS.includes(campaign.status)) continue;
    const when = campaign.startsAt ?? campaign.date ?? null;
    const date = when ? dayBucket(when) : null;
    // Undated, and in the past: nothing to plan around. A campaign with no
    // date at all is left out rather than defaulted to "today", which would be
    // a fabricated schedule.
    if (!date || date === 'day' || date < today) continue;
    const dayIndex = (Date.parse(`${date}T12:00:00Z`) - Date.parse(`${today}T12:00:00Z`)) / 86400000;
    if (!(dayIndex >= 0) || dayIndex >= horizonDays) continue;
    if (!byDate.has(date)) byDate.set(date, { date, dayIndex, events: [] });
    byDate.get(date).events.push({
      campaignId: campaign.id,
      title: campaign.title ?? 'your event',
      // Only a real slug becomes a link. A campaign published without one (or
      // whose publication state changed) gets no href rather than a URL that
      // would 404 in front of the member.
      slug: campaign.publicSlug ?? null,
      location: campaign.location ?? null,
      startsAt: when ?? null,
      registrationId: reg.id,
      entryState: reg.status === 'checked_in' ? 'checked-in' : 'upcoming'
    });
  }
  return [...byDate.values()].sort((a, b) => (a.date < b.date ? -1 : 1));
}

/**
 * The join. Every returned match is one planned day with one dated weather
 * fact about it — and the fact is quoted, never re-worded or recomputed here.
 */
export async function plannedWeather({ userId = null, place = null, nowMs = Date.now() } = {}) {
  const base = {
    available: false,
    matched: [],
    plannedDays: [],
    reason: null,
    provider: null,
    providerLicence: null,
    horizonDays: null,
    note: 'Weather is shown only for a day you have something planned. Nothing planned, nothing shown.'
  };
  if (!userId) return { ...base, reason: 'anonymous' };

  const days = plannedDays(userId, { nowMs });
  if (!days.length) return { ...base, available: true, reason: 'nothing_planned' };

  let world = null;
  try {
    world = await worldSignal({ place, now: nowMs });
  } catch {
    world = null;
  }
  if (!world || world.available !== true || !Array.isArray(world.facts)) {
    // The provider is unreachable. The surface shows nothing rather than
    // falling back to a generic line — "we could not read it" is not a forecast.
    return { ...base, available: false, plannedDays: days, reason: 'world_read_unavailable' };
  }

  const dated = world.facts.filter((f) => typeof f?.date === 'string' && f.date);
  const byDay = new Map(dated.map((f) => [f.date, f]));
  const matched = [];
  for (const day of days) {
    const fact = byDay.get(day.date);
    if (!fact) continue;
    matched.push({
      date: day.date,
      dayIndex: day.dayIndex,
      eventTitle: day.events[0]?.title ?? 'your event',
      campaignId: day.events[0]?.campaignId ?? null,
      slug: day.events[0]?.slug ?? null,
      eventCount: day.events.length,
      startsAt: day.events[0]?.startsAt ?? null,
      location: day.events[0]?.location ?? null,
      fact: { kind: fact.kind, text: fact.text, value: fact.value ?? null, unit: fact.unit ?? null }
    });
  }
  // Days inside the forecast window that the provider gave no dated fact for:
  // said as a count, so the reader is not left to wonder whether the absence is
  // their schedule's fault or the model's.
  const unmatchedDays = days.filter((d) => !byDay.has(d.date)).length;

  return {
    available: true,
    matched,
    plannedDays: days,
    unmatchedDays,
    reason: matched.length ? null : (world.horizonDays ? 'no_dated_fact_for_those_days' : 'no_facts'),
    provider: world.provider ?? null,
    providerLicence: world.providerLicence ?? null,
    horizonDays: world.horizonDays ?? null,
    note: base.note
  };
}
