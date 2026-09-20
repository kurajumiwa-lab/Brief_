// ---------------------------------------------------------------------------
// THE DAY BOUNDARY — one rule for "which day is this", and where it applies.
//
// Brief is a Kenyan product, so the day a member means is the day in Nairobi.
// Reading a timestamp as UTC and slicing the date string is a three-hour
// disagreement with that: 00:40 in Nairobi is still "yesterday" to `toISOString()`,
// and anything phrased "today" (a one-row-per-day notification batch, a deadline
// that has or has not passed, a traffic day used to cap farming) rolled over at
// 03:00 local instead of midnight.
//
// USED FOR (all of them are "today" claims a human would argue with):
//   * notifications: the per-area, per-day batch key;
//   * requests: `requiredBy < today` (is this overdue);
//   * referrals: the day bucket behind the traffic-points cap.
//
// DELIBERATELY NOT USED FOR:
//   * date-string VALIDATION (`quoteValidation`, `requests.parseDate`): those
//     round-trip a value through `Date` to prove it is a plain calendar date with
//     no time part. Shifting them by three hours would reject a legitimate
//     'YYYY-MM-DD' at one end of the day and accept a malformed one at the other.
//     A check is not a calendar.
//   * document stamps (`pdf.js` "Exported <date>", the sitemap `<lastmod>`):
//     those say when a file was generated, and UTC is the correct, unambiguous
//     stamp for a machine artefact.
//   * worldSignal: it anchors the forecast day at 12:00 UTC on purpose, which
//     already sits inside the same Nairobi afternoon. Its provider returns local
//     dates, so it has no boundary to fix.
//
// The name-based zone is used rather than a fixed +03:00 offset because Intl
// cannot be mis-set by a host clock in a weird zone; the zone is stated, not
// inherited. Kenya has no DST, so the two agree today — this just keeps the rule
// readable if that ever changes.
// ---------------------------------------------------------------------------

export const EAT_TZ = 'Africa/Nairobi';

const FMT = new Intl.DateTimeFormat('en-CA', {
  timeZone: EAT_TZ, year: 'numeric', month: '2-digit', day: '2-digit'
});

/** The Nairobi calendar day a timestamp falls in, as 'YYYY-MM-DD'. */
export function dayBucket(isoOrNull) {
  const ms = typeof isoOrNull === 'number' ? isoOrNull : Date.parse(isoOrNull ?? '');
  if (!Number.isFinite(ms)) return 'day';
  return FMT.format(new Date(ms));
}

/** Today, in the day the member means. */
export function todayKey(nowMs = Date.now()) {
  return FMT.format(new Date(nowMs));
}
